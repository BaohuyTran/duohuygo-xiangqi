// Practical tasks at runtime (design/03-assessment.md §5.1–§5.7, 04-architecture.md §5.5–§5.7; S2.12).
//
// A task run is a JSON `TaskState` (persisted mid-game through src/storage `createPlayRepository`): the game record
// (src/play), where the learner is in the scripted tree, and the facts of every learner move. The screen
// (src/components/PlayView.tsx) and the content script (scripts/verify-practical.ts) drive it with the same three
// steps — `learnerTurn`, `partnerTurn`, `finishTask` — through an injected `Analyzer` (the app: the analysis Worker
// client; scripts and tests: `directAnalyzer()`), so a phone and CI compute the same facts and verdicts.
//
// - Partners (03 §5.2): the task kind fixes the chain of each regime (`partnerPlan`). `PARTNER_REGIME` is `fallback`
//   until `pressing` is validated (S2.18): F1 (plan/hold: the task ends when only pressing would move), F1c
//   (convert: → best-defence resist mode, k = d = 2 unless the task is `measured`), F2/F2b (games), F5 (openings).
//   F3/F4 are exam compositions: `EXAM_SLOTS_UNDER_F` + `levelReachable` (the 03 §5.2 reachability table).
// - Signals (03 §5.3) of every learner move are computed DURING the game in the Worker at the level's guard (h = 2
//   above Basic, D9), so the result screen needs no long wait. A move whose signals were not checked voids the run;
//   so does any partner safety-net move (03 §5.6).
// - Line share (R6, F2b): the class and the selectivity of every learner move (table on the tree; default class and
//   an early-stopping count of guard-passing / credited moves off it).
// - The full-game material rule (`adjudicate` → `materialAdjudication`, exhaustive mate checks) runs inside the async
//   turn functions, i.e. after the screen shows "Checking…", never synchronously in a tap handler.
//
// Loaded lazily by the screen (it pulls src/analysis and src/play), never in the app's main chunk.
import { development, enPrisePieces, mobility, positionKey, type Predicate, type SafetyGuard } from '../analysis';
import { isChecked, type RequestLimits } from '../analysis/requests';
import type { LineLearnerNode, LineLeaf, LineOpponentNode, LineReply, MoveClass, PartnerSpec, PlayExercise, TaskKind } from '../content/types';
import { isInCheck, legalMoves, makeMove, materialBalance, opposite, parseFen, type Color, type Move, type Position } from '../engine';
import { positionOf } from '../lessons/answers';
import { isAccepted, moveKey } from '../lessons/decision';
import { resolveGuard } from '../lessons/guard';
import { chooseReply, isLeaf, isLearnerNode, isOpponentNode, judgeLineMove, keyToMove, partnerPolicy } from '../lessons/line';
import * as play from '../play';
import type { PartnerRegime } from './regime';
import type { Analyzer, OpponentPolicy } from '../play/policies';
import type { ApplicationGrant, FallbackRegime } from '../progress/records';
import {
  lineShare,
  r0,
  r1,
  r2,
  r3,
  r4,
  r5,
  r6,
  scoreTask,
  scoringWeights,
  usesLineShare,
  type CriticalFailure,
  type DevelopmentFacts,
  type LineShare,
  type PenaltyKind,
  type ScoreTerm,
  type ShareStep,
  type TaskScore,
  type VoidReason,
} from './rubrics';

// ---------- Regimes and partner chains (03 §5.2) ----------

export { PARTNER_REGIME, type PartnerRegime } from './regime';

/** τ of safe-sparring by level (03 §5.2): 1.0 at Basic, 0.5 above. */
export const tauOf = (itemId: string | undefined): number => (itemId === undefined || itemId.startsWith('b') || itemId.startsWith('pb') ? 1.0 : 0.5);

/** The fallback a task runs under (null: main regime, or a drill, which is the same in both). */
export function fallbackOf(ex: Pick<PlayExercise, 'task' | 'f2b'>, regime: PartnerRegime): FallbackRegime | null {
  if (regime === 'main') return null;
  switch (ex.task) {
    case 'drill':
      return null;
    case 'opening':
      return 'F5';
    case 'plan':
    case 'hold':
      return 'F1';
    case 'convert':
      return 'F1c';
    case 'game':
      return ex.f2b ? 'F2b' : 'F2';
  }
}

export interface PartnerPlan {
  /** The scripted tree plays the opponent while the learner is on it. */
  tree: boolean;
  /** The chain after the tree (src/play `chain`). */
  links: PartnerSpec[];
  /** F1: when every link hands over (only `pressing` would move), the task ends and the position is scored. */
  endOnHandOver: boolean;
}

/** The 03 §5.2 "task kind → partner" table, main regime and fallback. */
export function partnerPlan(ex: Pick<PlayExercise, 'task' | 'f2b' | 'measured' | 'tree' | 'id'>, regime: PartnerRegime): PartnerPlan {
  const tau = tauOf(ex.id);
  const fb = fallbackOf(ex, regime);
  const hasTree = ex.tree !== undefined;
  const fa: PartnerSpec = { kind: 'forcing-attack', k: 2 };
  const pressing: PartnerSpec = { kind: 'pressing', d: 2 };
  switch (ex.task) {
    case 'drill':
      return { tree: hasTree, links: [{ kind: 'safe-sparring', d: 2, tau }], endOnHandOver: false };
    case 'opening':
      return { tree: hasTree, links: [fb === 'F5' ? { kind: 'safe-sparring', d: 2, tau } : pressing], endOnHandOver: false };
    case 'plan':
    case 'hold':
      return fb === 'F1' ? { tree: hasTree, links: [fa], endOnHandOver: true } : { tree: hasTree, links: [fa, pressing], endOnHandOver: false };
    case 'convert': {
      const k = ex.measured ? 3 : 2;
      return fb === 'F1c'
        ? { tree: hasTree, links: [fa, { kind: 'best-defence', resist: true, k, d: k }], endOnHandOver: false }
        : { tree: hasTree, links: [fa, pressing], endOnHandOver: false };
    }
    case 'game':
      if (fb === 'F2') return { tree: false, links: [{ kind: 'safe-sparring', d: 2, tau: 1.0 }], endOnHandOver: false };
      if (fb === 'F2b') return { tree: hasTree, links: [{ kind: 'safe-sparring', d: 2, tau: 1.0 }], endOnHandOver: false };
      return { tree: hasTree, links: [pressing], endOnHandOver: false };
  }
}

/** messages.ts keys shown on the task screen: the general sentence (03 §5.2), the tree, then every link's own key. */
export function disclosureKeys(ex: Pick<PlayExercise, 'task' | 'f2b' | 'measured' | 'tree' | 'id'>, regime: PartnerRegime): string[] {
  const plan = partnerPlan(ex, regime);
  const policy = partnerPolicy(play, plan.links);
  const own = [...(plan.tree ? [play.DISCLOSURE_KEYS.scripted] : []), ...policy.disclosureKeys];
  return [play.DISCLOSURE_KEYS.general, ...new Set(own)];
}

// ---------- F3 / F4: exam slots under fallback F and the reachability table (03 §5.2) ----------

export type Level = 'basics' | 'intermediate' | 'advanced' | 'expert' | 'master';

/** One slot of a level exam under F: tasks of these kinds, played in this fallback form, `count` of them. */
export interface ExamSlot {
  name: string;
  kinds: readonly (TaskKind | 'review')[];
  fallback: FallbackRegime | null;
  count: number;
  /** The `count` tasks must cover both colours. */
  bothColours?: boolean;
}

/**
 * 03 §5.2 F3 (`xb`) and F4 (`xi`, `xa`, `xe`, `xm`): what each exam is built from while `pressing` is not validated.
 * `xb`: two games (F2/F2b, one per colour) + two F3 hold tasks (tree-bounded, F1) + a review; `xi`: two F5 opening tasks (one per
 * colour) + an F1c conversion; `xa`: F1 plan + F1 positional defence + an endgame (F1c or F1) + review; `xe`: two F5
 * repertoire tasks + F1c conversion + F1 holding + review; `xm`: ≥ 5 tasks — opening F5, middlegame F1, defence F1,
 * endgame F1c or F1, review — both colours.
 */
export const EXAM_SLOTS_UNDER_F: Readonly<Record<Level, readonly ExamSlot[]>> = {
  basics: [
    { name: 'xb-games', kinds: ['game'], fallback: 'F2', count: 2, bothColours: true },
    { name: 'xb-F3-hold', kinds: ['hold'], fallback: 'F1', count: 2 },
    { name: 'xb-review', kinds: ['review'], fallback: null, count: 1 },
  ],
  intermediate: [
    { name: 'xi-F5-opening', kinds: ['opening'], fallback: 'F5', count: 2, bothColours: true },
    { name: 'xi-F1c-convert', kinds: ['convert'], fallback: 'F1c', count: 1 },
  ],
  advanced: [
    { name: 'xa-F1-plan', kinds: ['plan'], fallback: 'F1', count: 1 },
    { name: 'xa-F1-defence', kinds: ['hold'], fallback: 'F1', count: 1 },
    { name: 'xa-endgame', kinds: ['convert', 'hold'], fallback: null, count: 1 },
    { name: 'xa-review', kinds: ['review'], fallback: null, count: 1 },
  ],
  expert: [
    { name: 'xe-F5-repertoire', kinds: ['opening'], fallback: 'F5', count: 2, bothColours: true },
    { name: 'xe-F1c-convert', kinds: ['convert'], fallback: 'F1c', count: 1 },
    { name: 'xe-F1-hold', kinds: ['hold'], fallback: 'F1', count: 1 },
    { name: 'xe-review', kinds: ['review'], fallback: null, count: 1 },
  ],
  master: [
    { name: 'xm-F5-opening', kinds: ['opening'], fallback: 'F5', count: 1 },
    { name: 'xm-F1-middlegame', kinds: ['plan'], fallback: 'F1', count: 1 },
    { name: 'xm-F1-defence', kinds: ['hold'], fallback: 'F1', count: 1 },
    { name: 'xm-endgame', kinds: ['convert', 'hold'], fallback: null, count: 1 },
    { name: 'xm-review', kinds: ['review'], fallback: null, count: 1 },
  ],
};

/** A published task as the reachability check sees it. */
export interface PoolTask {
  id: string;
  level: Level;
  kind: TaskKind | 'review';
  side: Color;
  /** The task passes the §5.7 guard in its F form (verify-practical.ts). */
  passesGuardUnderF: boolean;
}

/**
 * Level application is reachable under F when every exam slot has `count` distinct published tasks of its kinds that
 * pass the §5.7 guard in their F form (both colours where required; `xm` must use both colours overall).
 */
export function levelReachable(level: Level, pool: readonly PoolTask[]): { reachable: boolean; missing: string[] } {
  const usable = pool.filter((t) => t.level === level && t.passesGuardUnderF);
  const used = new Set<string>();
  const missing: string[] = [];
  for (const slot of EXAM_SLOTS_UNDER_F[level]) {
    const free = usable.filter((t) => slot.kinds.includes(t.kind) && !used.has(t.id));
    let picked: PoolTask[] = [];
    if (slot.bothColours) {
      const red = free.find((t) => t.side === 'red');
      const black = free.find((t) => t.side === 'black');
      if (red && black) picked = [red, black, ...free.filter((t) => t !== red && t !== black)].slice(0, slot.count);
    } else picked = free.slice(0, slot.count);
    if (picked.length < slot.count) missing.push(slot.name);
    else picked.forEach((t) => used.add(t.id));
  }
  if (level === 'master' && missing.length === 0) {
    const sides = new Set(usable.filter((t) => used.has(t.id)).map((t) => t.side));
    if (sides.size < 2) missing.push('xm-both-colours');
  }
  return { reachable: missing.length === 0, missing };
}

// ---------- Task state (plain JSON, persisted mid-game) ----------

/** What one learner move contributed (signals, tree class, line share facts). */
export interface LearnerFact {
  /** Index of the move in the record. */
  ply: number;
  move: string;
  /** The single largest 03 §5.3 penalty, null = none, 'not-checked' = could not be computed (voids the run). */
  penalty: PenaltyKind | null | 'not-checked';
  /** Table class on the tree, default class off it (only computed when the task scores line share or is on the tree). */
  class?: MoveClass | 'not-checked';
  source?: 'table' | 'default';
  /** Line share facts (R6 / F2b). */
  share?: ShareStep;
}

export type TaskEndReason =
  /** Mate, stalemate, repetition, task cap or a full-game stop (`outcome`). */
  | 'adjudicated'
  /** F1: only `pressing` would move (the tree and forcing-attack ran out). */
  | 'tree-end'
  /** F1: an authored scoring leaf was reached. */
  | 'leaf'
  /** The partner had no move (all links handed over outside F1). */
  | 'partner-none';

export interface TaskState {
  v: 1;
  itemId: string;
  itemVersion: number;
  regime: PartnerRegime;
  fallback: FallbackRegime | null;
  seed: number;
  record: play.GameRecord;
  /** Move keys from the start while the run is on the tree; null once it left the tree (or there is none). */
  treePath: string[] | null;
  facts: LearnerFact[];
  /** Some partner move came from the safety net (voids the run). */
  safetyNet: boolean;
  /** R5 `any-move` holding predicate met after some learner move. */
  holdingMet: boolean;
  /** R4: after some learner move the opponent had a forced mate within 2. */
  opponentMate2: boolean;
  /** A per-move fact (holding, R4) could not be computed. */
  factNotChecked: boolean;
  end: { reason: TaskEndReason; outcome?: play.Outcome } | null;
}

export const itemIdOf = (ex: PlayExercise): string => ex.id ?? 'play';

export function startTask(ex: PlayExercise, regime: PartnerRegime, seed: number): TaskState {
  const start = positionOf(ex);
  const plan = partnerPlan(ex, regime);
  return {
    v: 1,
    itemId: itemIdOf(ex),
    itemVersion: ex.version ?? 0,
    regime,
    fallback: fallbackOf(ex, regime),
    seed: seed >>> 0,
    record: play.createRecord(start, { learner: ex.side ?? 'red', seed }),
    treePath: plan.tree && ex.tree ? [] : null,
    facts: [],
    safetyNet: false,
    holdingMet: false,
    opponentMate2: false,
    factNotChecked: false,
    end: null,
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * A stored state for `ex` (same item, version and regime, legal record from the task's start), else null. Used to
 * resume a game after a reload or a tab switch.
 */
export function parseTaskState(value: unknown, ex: PlayExercise, regime: PartnerRegime): TaskState | null {
  if (!isObj(value) || value.v !== 1 || value.itemId !== itemIdOf(ex) || value.itemVersion !== (ex.version ?? 0) || value.regime !== regime) return null;
  const rec = value.record;
  if (!isObj(rec) || typeof rec.startFen !== 'string' || !Array.isArray(rec.moves) || !Array.isArray(value.facts)) return null;
  try {
    const start = positionOf(ex);
    if (positionKey(parseFen(rec.startFen)) !== positionKey(start)) return null;
    // Replays every move (throws on an illegal one).
    let r = play.createRecord(start, { learner: ex.side ?? 'red', seed: Number(rec.seed) >>> 0 });
    for (const m of rec.moves as unknown[]) {
      if (!isObj(m) || !isObj(m.move)) return null;
      r = play.appendMove(r, { from: Number(m.move.from), to: Number(m.move.to) }, {
        ...(isObj(m.partner) ? { partner: m.partner as unknown as play.PartnerMeta } : {}),
        ...(typeof m.at === 'number' ? { at: m.at } : {}),
      });
    }
    const path = value.treePath;
    if (path !== null && !(Array.isArray(path) && path.every((k) => typeof k === 'string'))) return null;
    return { ...(value as unknown as TaskState), record: r };
  } catch {
    return null;
  }
}

// ---------- Helpers ----------

export const ruleset = (ex: Pick<PlayExercise, 'task' | 'cap'>): play.Ruleset =>
  ex.task === 'game' ? { kind: 'full-game' } : { kind: 'task', cap: ex.cap };

export const guardOf = (ex: Pick<PlayExercise, 'id' | 'guard'>): SafetyGuard => resolveGuard({ itemId: ex.id, override: ex.guard });

type TreeNode = LineLearnerNode | LineOpponentNode | LineLeaf;

/** The tree node after `path` (move keys from the start), or null when the path leaves the tree. */
export function treeNodeAt(root: LineLearnerNode, path: readonly string[]): TreeNode | null {
  let node: TreeNode = root;
  for (const key of path) {
    if (isLearnerNode(node)) {
      const next: LineOpponentNode | LineLeaf | undefined = node.next?.[key];
      if (!next) return null;
      node = next;
    } else if (isOpponentNode(node)) {
      const reply: LineReply | undefined = node.replies.find((r: LineReply) => r.move === key);
      if (!reply) return null;
      node = reply.next;
    } else return null;
  }
  return node;
}

/** 03 §5.3 rule 3 on a table: 0 < credited ÷ guard-passing ≤ 1/3. */
export function tableSelective(node: LineLearnerNode): boolean {
  const passing = node.table.filter((r) => r.class !== 'error').length;
  const credited = node.table.filter((r) => isAccepted(r.class)).length;
  return credited > 0 && credited * 3 <= passing;
}

/** Does the task score line share (R6, or F2b)? */
export function scoresLineShare(ex: PlayExercise, fallback: FallbackRegime | null): boolean {
  return usesLineShare(scoringWeights(ex.rubrics, fallback));
}

export interface TurnDeps {
  analyzer: Analyzer;
  limits?: RequestLimits;
  signal?: AbortSignal;
  /** Tree replies: how often each continuation of a path was met before (coverage); default none. */
  coverage?: (prefix: readonly string[]) => ReadonlyMap<string, number>;
  /** Assessment runs (placement, exams): the main authored reply, no coverage. */
  fixedReplies?: boolean;
  /** Timestamp for the record (injected clock). */
  now?: () => number;
}

const ask = <R extends Parameters<Analyzer['run']>[0]>(deps: TurnDeps, request: R) =>
  deps.analyzer.run({ ...request, ...(deps.limits ? { limits: deps.limits } : {}) }, deps.signal ? { signal: deps.signal } : undefined);

/** Default class off the tree (04 §5.4): guard → error; objective → target; else dubious. */
export async function defaultClass(deps: TurnDeps, pos: Position, move: Move, guard: SafetyGuard, objective?: Predicate): Promise<Exclude<MoveClass, 'sound'> | 'not-checked'> {
  const v = await ask(deps, { kind: 'safety-guard', position: pos, move, guard });
  if (!isChecked(v)) return 'not-checked';
  if (!v.value.safe) return 'error';
  if (!objective) return 'dubious';
  const o = await ask(deps, { kind: 'predicate', predicate: objective, before: pos, moves: [move], side: pos.turn });
  if (!isChecked(o)) return 'not-checked';
  return o.value ? 'target' : 'dubious';
}

/**
 * 03 §5.3 rule 3 off the tree: is 0 < credited ÷ guard-passing ≤ 1/3 in `pos`? Credited = passes the guard and meets
 * the objective. Early stop: the moves meeting the objective are guard-checked first (C = those passing), then the
 * other moves only until 3·|C| guard-passing moves are found. null = something could not be checked.
 */
export async function offTreeSelective(deps: TurnDeps, pos: Position, guard: SafetyGuard, objective?: Predicate): Promise<boolean | null> {
  if (!objective) return false;
  const moves = legalMoves(pos);
  const meets: Move[] = [];
  const rest: Move[] = [];
  for (const m of moves) {
    const o = await ask(deps, { kind: 'predicate', predicate: objective, before: pos, moves: [m], side: pos.turn });
    if (!isChecked(o)) return null;
    (o.value ? meets : rest).push(m);
  }
  let credited = 0;
  for (const m of meets) {
    const v = await ask(deps, { kind: 'safety-guard', position: pos, move: m, guard });
    if (!isChecked(v)) return null;
    if (v.value.safe) credited++;
  }
  if (credited === 0) return false;
  let passing = credited;
  for (const m of rest) {
    if (passing >= 3 * credited) break;
    const v = await ask(deps, { kind: 'safety-guard', position: pos, move: m, guard });
    if (!isChecked(v)) return null;
    if (v.value.safe) passing++;
  }
  return passing >= 3 * credited;
}

function afterAdjudication(ex: PlayExercise, state: TaskState): TaskState {
  if (state.end) return state;
  const outcome = play.adjudicate(state.record, ruleset(ex));
  return outcome ? { ...state, end: { reason: 'adjudicated', outcome } } : state;
}

// ---------- The learner's move ----------

/**
 * Plays the learner's (legal, already accepted by `checkLearnerMove`) move: table class on the tree, signals of the
 * move (Worker), line share facts, the R5 any-move holding predicate and the R4 opponent-mate fact, then adjudicates.
 */
export async function learnerTurn(ex: PlayExercise, state: TaskState, move: Move, deps: TurnDeps): Promise<TaskState> {
  if (state.end) return state;
  const pos = play.currentPosition(state.record);
  const learner = state.record.learner;
  if (pos.turn !== learner) throw new Error('learnerTurn: not the learner to move');
  const guard = guardOf(ex);
  const key = moveKey(move);
  const share = scoresLineShare(ex, state.fallback);
  const plan = partnerPlan(ex, state.regime);
  let treePath = state.treePath;
  let end: TaskState['end'] = null;
  const fact: LearnerFact = { ply: state.record.moves.length, move: key, penalty: null };

  // On the tree: the table class and where the move leads.
  const node = treePath && ex.tree ? treeNodeAt(ex.tree, treePath) : null;
  if (treePath && node && isLearnerNode(node)) {
    const v = judgeLineMove(node, pos, move);
    if (v.kind === 'class') {
      fact.class = v.entry.class;
      fact.source = 'table';
      if (share) fact.share = { counted: tableSelective(node), credited: isAccepted(v.entry.class) };
      if (v.next === undefined) treePath = null;
      else if (isLeaf(v.next)) {
        treePath = null;
        if (plan.endOnHandOver) end = { reason: 'leaf' };
      } else treePath = [...treePath, key];
    } else treePath = null;
  } else {
    treePath = null;
    if (share) {
      const cls = await defaultClass(deps, pos, move, guard, ex.objective);
      fact.class = cls;
      fact.source = 'default';
      const counted = cls === 'not-checked' ? null : await offTreeSelective(deps, pos, guard, ex.objective);
      fact.share = { counted, credited: cls === 'target' };
    }
  }

  // Signals at the level's guard (03 §5.3), computed now in the Worker (D9).
  const sig = await ask(deps, { kind: 'move-signals', position: pos, move, guard, threats: true });
  fact.penalty = isChecked(sig) ? sig.value.penalty : 'not-checked';

  let { holdingMet, opponentMate2, factNotChecked } = state;
  if (ex.holding && (ex.holding.when ?? 'end') === 'any-move' && !holdingMet) {
    const o = await ask(deps, { kind: 'predicate', predicate: ex.holding.predicate, before: pos, moves: [move], side: learner });
    if (isChecked(o)) holdingMet = o.value;
    else factNotChecked = true;
  }
  const after = makeMove(pos, move);
  if (ex.rubrics.some((r) => r.rubric === 'R4') && !opponentMate2 && legalMoves(after).length > 0) {
    const w = await ask(deps, { kind: 'forced-wins', position: after, n: 2 });
    if (isChecked(w)) opponentMate2 = w.value.length > 0;
    else factNotChecked = true;
  }

  const record = play.appendMove(state.record, move, { position: pos, ...(deps.now ? { at: deps.now() } : {}) });
  const next: TaskState = { ...state, record, treePath, facts: [...state.facts, fact], holdingMet, opponentMate2, factNotChecked, end };
  return afterAdjudication(ex, next);
}

// ---------- The partner's move ----------

export interface PartnerResult {
  state: TaskState;
  /** The analysis was cancelled: nothing happened (the screen may retry). */
  cancelled?: boolean;
}

/** The opponent's move: an authored reply on the tree, else the regime's chain; then adjudicates. */
export async function partnerTurn(ex: PlayExercise, state: TaskState, deps: TurnDeps): Promise<PartnerResult> {
  if (state.end) return { state };
  const pos = play.currentPosition(state.record);
  if (pos.turn === state.record.learner) throw new Error('partnerTurn: the learner is to move');
  const plan = partnerPlan(ex, state.regime);
  const at = deps.now ? { at: deps.now() } : {};

  const node = state.treePath && ex.tree ? treeNodeAt(ex.tree, state.treePath) : null;
  if (state.treePath && node && isOpponentNode(node)) {
    const counts = deps.coverage?.(state.treePath) ?? new Map<string, number>();
    const reply = chooseReply(node, { counts, seed: state.seed, ply: state.record.moves.length, fixed: deps.fixedReplies });
    const move = keyToMove(reply.move);
    const record = play.appendMove(state.record, move, { position: pos, partner: { policy: 'scripted' }, ...at });
    let treePath: string[] | null = [...state.treePath, reply.move];
    let end: TaskState['end'] = null;
    if (isLeaf(reply.next)) {
      treePath = null;
      if (plan.endOnHandOver) end = { reason: 'leaf' };
    }
    return { state: afterAdjudication(ex, { ...state, record, treePath, end }) };
  }

  const policy: OpponentPolicy = partnerPolicy(play, plan.links);
  const choice = await play.choosePartnerMove(policy, state.record, deps.analyzer, {
    ...(deps.limits ? { limits: deps.limits } : {}),
    ...(deps.signal ? { signal: deps.signal } : {}),
  });
  if (choice.kind === 'cancelled') return { state, cancelled: true };
  const safetyNet = state.safetyNet || (choice.kind !== 'no-move' && choice.safetyNet !== undefined);
  if (choice.kind !== 'move') {
    return { state: { ...state, treePath: null, safetyNet, end: { reason: plan.endOnHandOver ? 'tree-end' : 'partner-none' } } };
  }
  const record = play.appendMove(state.record, choice.move, {
    position: pos,
    partner: { policy: choice.policy, ...(choice.safetyNet ? { safetyNet: choice.safetyNet } : {}) },
    ...at,
  });
  return { state: afterAdjudication(ex, { ...state, record, treePath: null, safetyNet }) };
}

// ---------- The result ----------

export interface TaskResult {
  score: TaskScore;
  fallback: FallbackRegime | null;
  share: LineShare | null;
  end: NonNullable<TaskState['end']>;
  /** Learner moves played. */
  learnerMoves: number;
}

/** R2 facts from the record: development after the learner's n-th move, idle General/Advisor moves, over-moved pieces. */
export function developmentFacts(record: play.GameRecord, n: number, target: number): DevelopmentFacts {
  const positions = play.positionsOf(record);
  const learner = record.learner;
  let seen = 0;
  let developedAt = development(positions[0].board, learner).developed;
  let idle = 0;
  /** Square → how often the piece now standing there moved without capturing or answering a threat. */
  const moved = new Map<number, number>();
  let overmoved = false;
  for (let i = 0; i < record.moves.length && seen < n; i++) {
    if (!play.isLearnerMove(record, i)) continue;
    seen++;
    const before = positions[i];
    const m = record.moves[i].move;
    const piece = before.board[m.from]!;
    const capture = record.moves[i].capture;
    const inCheck = isInCheck(before);
    const threatened = inCheck || enPrisePieces(before.board, learner).includes(m.from);
    if ((piece.type === 'general' || piece.type === 'advisor') && !capture && !inCheck) idle++;
    const count = (moved.get(m.from) ?? 0) + (capture || threatened ? 0 : 1);
    moved.delete(m.from);
    moved.set(m.to, count);
    if (count > 3) overmoved = true;
    developedAt = development(positions[i + 1].board, learner).developed;
  }
  return { developed: developedAt, target, idleDefenderMoves: idle, overmoved };
}

/** Final facts and the score (03 §5.3–§5.6). Needs the analysis for R3/R5 predicates and the end threat. */
export async function finishTask(ex: PlayExercise, state: TaskState, deps: TurnDeps): Promise<TaskResult> {
  const end = state.end ?? { reason: 'adjudicated' as const };
  const learner = state.record.learner;
  const opponent = opposite(learner);
  const start = positionOf(ex);
  const final = play.currentPosition(state.record);
  const allMoves = state.record.moves.map((m) => m.move);
  const guard = guardOf(ex);
  const voids: VoidReason[] = [];
  if (state.safetyNet) voids.push('partner-safety-net');
  if (state.facts.some((f) => f.penalty === 'not-checked')) voids.push('signal-not-checked');
  if (state.factNotChecked) voids.push('fact-not-checked');

  const penalties = state.facts.map((f) => (f.penalty === 'not-checked' ? null : f.penalty));
  const r1Score = r1(penalties);
  const outcome = end.outcome;
  const mated = (outcome?.reason === 'checkmate' || outcome?.reason === 'stalemate') && outcome.winner === opponent;
  const won = (outcome?.reason === 'checkmate' || outcome?.reason === 'stalemate') && outcome.winner === learner;
  const startBalance = materialBalance(start.board, learner);
  const endBalance = materialBalance(final.board, learner);

  const terms = scoringWeights(ex.rubrics, state.fallback);
  const needs = new Set<ScoreTerm>(terms.map((t) => t.term));
  const values: Partial<Record<ScoreTerm, number>> = {};
  values.R1 = r1Score;
  values.R0 = r0(startBalance, endBalance);
  const dev = ex.development ? developmentFacts(state.record, ex.development.n, ex.development.target) : null;
  const r2Score = dev ? r2(dev) : 0;
  values.R2 = r2Score;

  const predicate = async (p: Predicate): Promise<boolean | null> => {
    const o = await ask(deps, { kind: 'predicate', predicate: p, before: start, moves: allMoves, side: learner });
    return isChecked(o) ? o.value : null;
  };
  if (needs.has('R3')) {
    const met = ex.objective ? await predicate(ex.objective) : false;
    if (met === null) voids.push('fact-not-checked');
    values.R3 = r3({ objectiveMet: met === true, r1: r1Score, mobilityStart: mobility(start.board, learner), mobilityEnd: mobility(final.board, learner) });
  }
  if (needs.has('R4')) {
    values.R4 = r4({ won, leadStart: startBalance, leadEnd: endBalance, opponentHadMate2: state.opponentMate2, r1: r1Score });
  }
  if (needs.has('R5')) {
    let threat = false;
    if (!mated) {
      const t = await ask(deps, { kind: 'threat-at-end', position: final, opponent, guard });
      if (isChecked(t)) threat = t.value.isThreat;
      else voids.push('fact-not-checked');
    }
    let holding = state.holdingMet;
    if (ex.holding && (ex.holding.when ?? 'end') === 'end') {
      const met = await predicate(ex.holding.predicate);
      if (met === null) voids.push('fact-not-checked');
      holding = met === true;
    }
    values.R5 = r5({ mated, startDeficit: -startBalance, endDeficit: -endBalance, threatAtEnd: threat === true, r1: r1Score, holding });
  }
  let share: LineShare | null = null;
  if (needs.has('R6') || needs.has('LS')) {
    share = lineShare(
      state.facts.filter((f) => f.share).map((f) => f.share!),
      ex.lineShare ?? 6,
    );
    if (share.unknown) voids.push('fact-not-checked');
    else if (share.voided) voids.push('line-share-window');
    values.R6 = r6(share, r2Score);
    values.LS = share.share * 100;
  }

  const critical: CriticalFailure[] = [];
  if (mated) critical.push('mated');
  if (outcome?.reason === 'perpetual-check' && outcome.winner === opponent) critical.push('perpetual-check');
  if (ex.task === 'convert' && !won) {
    // threatAtEnd looks for the opponent's forced mate within 2 (whoever is to move).
    const t = await ask(deps, { kind: 'threat-at-end', position: final, opponent, guard });
    if (!isChecked(t)) voids.push('fact-not-checked');
    else if (t.value.mate) critical.push('final-mate-threat');
  }
  if (ex.safetyGate && penalties.some((p) => p === 'serious-allowed-loss' || p === 'allowed-mate')) critical.push('safety-gate');

  const score = scoreTask({ weights: terms, values, critical, voids, ...(share ? { share } : {}), passMark: ex.passMark });
  return { score, fallback: state.fallback, share, end, learnerMoves: play.learnerMoveCount(state.record) };
}

/** The 03 §5.6 grant of a passed, non-voided run (records the fallback it was earned under), else null. */
export function applicationGrant(ex: PlayExercise, result: TaskResult, at: string, via: ApplicationGrant['via'] = 'practical'): ApplicationGrant | null {
  if (!result.score.pass) return null;
  return {
    at,
    via,
    score: Math.floor(result.score.score),
    taskVersion: ex.version ?? 0,
    ...(result.fallback ? { fallback: result.fallback } : {}),
  };
}

// ---------- Simulated learners (scripts/verify-practical.ts, tests) ----------

/** A learner for automated runs: returns the move to play (legal), or null to stop. */
export type SimLearner = (ctx: { ex: PlayExercise; state: TaskState; position: Position; learnerIndex: number; deps: TurnDeps; seed: number }) => Promise<Move | null>;

/**
 * May the learner play `m`? The learner's third-repetition rule (src/play `checkLearnerMove`, with its exceptions:
 * the opponent's perpetual check, the only move, every alternative failing the guard). Only moves that create a third
 * occurrence are asked (the others are always allowed).
 */
async function allowed(ex: PlayExercise, state: TaskState, pos: Position, m: Move, deps: TurnDeps): Promise<boolean> {
  if (!play.createsThirdOccurrence(state.record, m, pos)) return true;
  const v = await play.checkLearnerMove(state.record, m, deps.analyzer, guardOf(ex), deps.limits ? { limits: deps.limits } : {});
  return v.allowed;
}

/** N1: a random legal move the refusal rule allows (seeded). */
export const randomLearner: SimLearner = async ({ ex, state, position, deps, seed }) => {
  const rng = play.createRng(play.deriveSeed(seed, state.record.moves.length, 1));
  const pool = legalMoves(position);
  while (pool.length > 0) {
    const m = pool.splice(rng.int(pool.length), 1)[0];
    if (await allowed(ex, state, position, m, deps)) return m;
  }
  return null;
};

/** N2, the safe shuffler: a random move passing the level's guard and allowed by the refusal rule (seeded). */
export const safeShuffler: SimLearner = async ({ ex, state, position, deps, seed }) => {
  const rng = play.createRng(play.deriveSeed(seed, state.record.moves.length, 2));
  const pool = legalMoves(position);
  const guard = guardOf(ex);
  let fallback: Move | null = null;
  while (pool.length > 0) {
    const m = pool.splice(rng.int(pool.length), 1)[0];
    if (!(await allowed(ex, state, position, m, deps))) continue;
    fallback ??= m;
    const v = await ask(deps, { kind: 'safety-guard', position, move: m, guard });
    if (isChecked(v) && v.value.safe) return m;
  }
  // No guard-passing move: any allowed move.
  return fallback;
};

/**
 * The reference player (§5.7 item 1): the authored line's moves while they are legal, then forcing-attack (k = 3 in
 * positions of ≤ 12 pieces, else 2), then pressing(2) for the learner's side.
 */
export function referenceLearner(line: readonly string[] = []): SimLearner {
  return async ({ state, position, learnerIndex, deps }) => {
    const key = line[learnerIndex];
    if (key !== undefined) {
      const m = keyToMove(key);
      if (legalMoves(position).some((x) => x.from === m.from && x.to === m.to)) return m;
    }
    const k = position.board.filter(Boolean).length <= 12 ? 3 : 2;
    const policy = play.chain(play.forcingAttack(k), play.pressing(2));
    const choice = await play.choosePartnerMove(policy, state.record, deps.analyzer);
    return choice.kind === 'move' ? choice.move : null;
  };
}

export interface SimRun {
  state: TaskState;
  result: TaskResult;
  /** Wall-clock ms of each partner move (resist-mode cost, 03 §5.2 F1c), with its ply. */
  partnerMs: { ply: number; ms: number; policy: string }[];
}

/** Plays a whole run with a simulated learner (no UI). */
export async function simulateTask(
  ex: PlayExercise,
  regime: PartnerRegime,
  seed: number,
  learner: SimLearner,
  deps: TurnDeps,
  clock: () => number = () => 0,
): Promise<SimRun> {
  let state = startTask(ex, regime, seed);
  const partnerMs: SimRun['partnerMs'] = [];
  let learnerIndex = 0;
  for (let guardSteps = 0; guardSteps < 400 && !state.end; guardSteps++) {
    const pos = play.currentPosition(state.record);
    if (pos.turn === state.record.learner) {
      const move = await learner({ ex, state, position: pos, learnerIndex, deps, seed });
      if (!move) break;
      state = await learnerTurn(ex, state, move, deps);
      learnerIndex++;
    } else {
      const t0 = clock();
      const r = await partnerTurn(ex, state, deps);
      if (r.cancelled) break;
      const last = r.state.record.moves.at(-1);
      if (last && r.state.record.moves.length > state.record.moves.length) partnerMs.push({ ply: r.state.record.moves.length - 1, ms: clock() - t0, policy: last.partner?.policy ?? '' });
      state = r.state;
    }
  }
  const result = await finishTask(ex, state, deps);
  return { state, result, partnerMs };
}

// ---------- Re-exports for the lazily loaded screen ----------

export { checkLearnerMove, losesByRepetition, currentPosition, learnerMoveCount } from '../play';
export { directAnalyzer } from '../play/policies';
