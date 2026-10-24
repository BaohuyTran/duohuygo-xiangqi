// `line` exercises at runtime (02-curriculum.md §5.1, 04-architecture.md §5.2–§5.4, 03-assessment.md §3.2) and the
// coverage-driven choice shared with varied-defence combinations (02 e01, `VAR`). Pure: no React, no DOM, no storage.
//
// A line is an authored move tree (src/content/types.ts `LineExercise`):
// - learner nodes hold the COMPLETE move table of their position (the `decision` format: the verdict is a lookup);
//   a move with a continuation goes on along the tree, an accepted move without one leaves it;
// - opponent nodes hold authored replies (main line first, weights, explanation keys). Practice picks one by
//   coverage — replies this learner has not met yet first, counted from the local attempt log (`coverageCounts`
//   over `AttemptRecord.path`) — then by the seed, weighted. Tests (jump ahead) always play the main reply;
// - leaves end the item (their goal was proven at authoring time, src/content/validate.ts).
// Off the tree (`handOver`), the learner's moves get the DEFAULT CLASS of 04 §5.4 (safety guard → error; objective
// met → target; else dubious) computed in the analysis Worker, and the opponent is a src/play training partner chain.
// A move the analysis could not check is 'not-checked': neutral feedback, no heart, no credit (04 §5.4).
//
// Main chunk: this module is imported by the lesson player, so it imports only the engine, ./answers, ./decision and
// the tiny src/play/rng.ts statically. Analysis requests, guards and partner policies load lazily (`analyzerLineJudge`).
//
// For practical tasks (S2.12): `lineScript` turns a tree into the `scripted` partner's script, `learnerNodeStats`
// gives the per-node selectivity (0 < credited fraction ≤ 1/3 of the guard-passing moves, 03 §5.3 rule 3) and
// `lineDepth` the number of learner nodes a stored path supplies; the `LineStep` log of a run (table class on the
// tree, default class off it) is what the F5 line share counts.
import type { Predicate } from '../analysis/judge';
import type {
  LineExercise,
  LineGoal,
  LineLearnerNode,
  LineLeaf,
  LineOpponentNode,
  LineReply,
  MoveClass,
  MoveTableEntry,
  PartnerSpec,
} from '../content/types';
import { legalMoves, makeMove, materialBalance, toFen, type Color, type Move, type Position } from '../engine';
import type { Analyzer, OpponentPolicy, Script } from '../play/policies';
import { createRng, deriveSeed } from '../play/rng';
import type { AttemptRecord } from '../progress/records';
import { legality, type MoveVerdict } from './answers';
import { decisionCredit, isAccepted, moveKey, parseMoveKey } from './decision';
import type { GuardSpec } from './guard';

/** The guard of a line (the item's level from its id, then its override): learner moves and authored replies. */
export const lineGuard = (ex: Pick<LineExercise, 'id' | 'guard'>): GuardSpec => ({ itemId: ex.id, override: ex.guard });

/** Board + side to move (no move counters): the 07-sourcing.md §4.1 repetition key of a stored line. */
export const linePositionKey = (pos: Position): string => toFen(pos).split(' ').slice(0, 2).join(' ');

export const isLeaf = (n: unknown): n is LineLeaf => typeof n === 'object' && n !== null && (n as { kind?: unknown }).kind === 'leaf';
export const isOpponentNode = (n: unknown): n is LineOpponentNode =>
  typeof n === 'object' && n !== null && (n as { kind?: unknown }).kind === 'opponent';
export const isLearnerNode = (n: unknown): n is LineLearnerNode =>
  typeof n === 'object' && n !== null && (n as { kind?: unknown }).kind === 'learner';

// ---------- Learner nodes ----------

export type LineVerdict =
  | { kind: 'illegal'; verdict: MoveVerdict }
  /** `next`: the continuation of this move (undefined: the move leaves the tree, or is not played on). */
  | { kind: 'class'; entry: MoveTableEntry; next?: LineOpponentNode | LineLeaf };

/** Table lookup at a learner node (as `judgeDecision`); a missing row (stale content) is dubious, never wrong. */
export function judgeLineMove(node: LineLearnerNode, pos: Position, move: Move): LineVerdict {
  const bad = legality(pos, move);
  if (bad) return { kind: 'illegal', verdict: bad };
  const key = moveKey(move);
  const entry = node.table.find((e) => e.move === key) ?? { move: key, class: 'dubious' as const, source: 'computed' as const };
  const next = entry.class === 'error' ? undefined : node.next?.[key];
  return next ? { kind: 'class', entry, next } : { kind: 'class', entry };
}

// ---------- Coverage (unseen first) and the seeded choice ----------

/** The move keys of a path ("h2-e2"), as stored in `AttemptRecord.path`. */
export const pathKeys = (moves: readonly Move[]): string[] => moves.map(moveKey);

const isPath = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');

/**
 * How often this learner met each continuation of `prefix` (move keys from the item's start) in earlier attempts of
 * item `itemId`: the attempt log's `path` field (every move played, learner and opponent). Records of other items,
 * or without a path, are ignored.
 */
export function coverageCounts(attempts: readonly AttemptRecord[], itemId: string | undefined, prefix: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  if (itemId === undefined) return counts;
  for (const a of attempts) {
    const path = a.path;
    if (a.itemId !== itemId || !isPath(path) || path.length <= prefix.length) continue;
    if (!prefix.every((m, i) => path[i] === m)) continue;
    const next = path[prefix.length];
    counts.set(next, (counts.get(next) ?? 0) + 1);
  }
  return counts;
}

/**
 * Coverage first, then the seed: keeps the items met least often (unseen ones first), then picks one of them with
 * the seeded RNG, weighted by `weightOf` (non-positive weights count as 1). Deterministic per seed and counts.
 */
export function chooseByCoverage<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  counts: ReadonlyMap<string, number>,
  seed: number,
  weightOf: (item: T) => number = () => 1,
): T {
  if (items.length === 0) throw new Error('chooseByCoverage: nothing to choose from');
  const seen = (item: T) => counts.get(keyOf(item)) ?? 0;
  const least = Math.min(...items.map(seen));
  const pool = items.filter((item) => seen(item) === least);
  const weight = (item: T) => {
    const w = weightOf(item);
    return Number.isFinite(w) && w > 0 ? w : 1;
  };
  const total = pool.reduce((s, item) => s + weight(item), 0);
  let x = createRng(seed).next() * total;
  for (const item of pool) {
    x -= weight(item);
    if (x < 0) return item;
  }
  return pool[pool.length - 1];
}

/**
 * The opponent's reply at an opponent node. `fixed` (tests, 02 §5.1 "fixed per assessment item"): the main reply
 * (the first). Otherwise coverage, then the seed derived for this ply, weighted.
 */
export function chooseReply(node: LineOpponentNode, ctx: { counts: ReadonlyMap<string, number>; seed: number; ply: number; fixed?: boolean }): LineReply {
  if (ctx.fixed) return node.replies[0];
  return chooseByCoverage(node.replies, (r) => r.move, ctx.counts, deriveSeed(ctx.seed, ctx.ply), (r) => r.weight ?? 1);
}

// ---------- Credit and the step log ----------

/** One learner move of a run: its class from the node's table, or the default class off the tree (04 §5.4). */
export interface LineStep {
  /** Index of the move in the run's path. */
  ply: number;
  move: string;
  class: MoveClass | 'not-checked';
  source: 'table' | 'default';
}

/**
 * First-answer credit of a line (03-assessment.md §3.2) from the class of the FIRST answer at each on-tree learner
 * node visited: 0 after any error (incl. an illegal move or an error off the tree, `errored`); 1 when every first
 * answer was target/sound; with `partial`, the per-node credit (sum of `decisionCredit` ÷ nodes); else 0.
 * Off-tree moves never raise the credit, and an off-tree dubious (or not-checked) move does not lower it either: only
 * on-tree first answers and errors count (not-checked off the tree voids the record instead, `LineResult.voided`).
 */
export function lineCredit(ex: Pick<LineExercise, 'partial'>, firstClasses: readonly MoveClass[], errored = false): number {
  if (errored || firstClasses.includes('error')) return 0;
  if (firstClasses.every(isAccepted)) return 1;
  if (!ex.partial) return 0;
  return firstClasses.reduce((s, c) => s + decisionCredit({ partial: true }, c), 0) / firstClasses.length;
}

// ---------- Goals ----------

/**
 * A goal decided from the position alone (`checkmate`, `material`, `end`); `predicate` needs the analysis (null).
 * `moves` is the whole path from `start`; `learner` the learner's colour.
 */
export function staticGoalMet(goal: LineGoal, start: Position, moves: readonly Move[], learner: Color): boolean | null {
  const cur = moves.reduce(makeMove, start);
  switch (goal.kind) {
    case 'checkmate':
      return cur.turn !== learner && legalMoves(cur).length === 0;
    case 'material':
      return materialBalance(cur.board, learner) - materialBalance(start.board, learner) >= goal.gain;
    case 'end':
      return true;
    case 'predicate':
      return null;
  }
}

// ---------- Tree facts (validator, scripts, S2.12) ----------

/** Visits every learner node with its path of move keys from the start (depth first, table order). */
export function forEachLearnerNode(ex: Pick<LineExercise, 'root'>, visit: (node: LineLearnerNode, path: string[]) => void): void {
  const walk = (node: LineLearnerNode, path: string[]) => {
    visit(node, path);
    for (const [move, next] of Object.entries(node.next ?? {})) {
      if (!isOpponentNode(next)) continue;
      for (const reply of next.replies) if (isLearnerNode(reply.next)) walk(reply.next, [...path, move, reply.move]);
    }
  };
  walk(ex.root, []);
}

export interface LearnerNodeStat {
  path: string[];
  /** Rows of the table (= legal moves). */
  moves: number;
  /** Rows that pass the guard (every class but `error`). */
  guardPassing: number;
  /** Rows credited at this node (target / sound). */
  credited: number;
  /** 03 §5.3 rule 3: counted toward L only when 0 < credited ÷ guard-passing ≤ 1/3. */
  selective: boolean;
}

/** Per learner node: how selective its table is (03 §5.3 rule 3; S2.12 counts only selective nodes toward L). */
export function learnerNodeStats(ex: Pick<LineExercise, 'root'>): LearnerNodeStat[] {
  const stats: LearnerNodeStat[] = [];
  forEachLearnerNode(ex, (node, path) => {
    const guardPassing = node.table.filter((r) => r.class !== 'error').length;
    const credited = node.table.filter((r) => isAccepted(r.class)).length;
    stats.push({ path, moves: node.table.length, guardPassing, credited, selective: credited > 0 && credited * 3 <= guardPassing });
  });
  return stats;
}

/** The most learner nodes on one stored path (the counted moves a scripted part can supply at most). */
export function lineDepth(ex: Pick<LineExercise, 'root'>): number {
  const depth = (node: LineLearnerNode): number => {
    let best = 0;
    for (const next of Object.values(node.next ?? {})) {
      if (!isOpponentNode(next)) continue;
      for (const reply of next.replies) if (isLearnerNode(reply.next)) best = Math.max(best, depth(reply.next));
    }
    return 1 + best;
  };
  return depth(ex.root);
}

/**
 * The tree as the src/play `scripted` partner's script (S2.12: play tasks that start from a scripted line): the
 * authored replies keyed by the moves since the start in ICCS ("h2e2 h9g7"). `scripted` picks uniformly by its seed;
 * a task that needs the weights / coverage uses `chooseReply` on the tree instead.
 */
export function lineScript(ex: Pick<LineExercise, 'root'>): Script {
  const replies: Record<string, string[]> = {};
  const iccs = (key: string) => key.replace('-', '');
  forEachLearnerNode(ex, (node, path) => {
    for (const [move, next] of Object.entries(node.next ?? {})) {
      if (isOpponentNode(next)) replies[[...path, move].map(iccs).join(' ')] = next.replies.map((r) => iccs(r.move));
    }
  });
  return { replies };
}

// ---------- Runtime analysis (the Worker) ----------

/** The default class of 04 §5.4 for a move off the tree, or 'not-checked' (no penalty, no credit). */
export type DefaultClass = Exclude<MoveClass, 'sound'> | 'not-checked';

export interface PartnerRequest {
  start: Position;
  /** Every move played since `start` (the partner is the side to move after them). */
  moves: readonly Move[];
  learner: Color;
  partner: readonly PartnerSpec[];
  seed: number;
}

export interface PartnerReply {
  move: Move;
  /** Label of the policy that moved (e.g. `safe-sparring(1,1)`). */
  policy: string;
  /** The move came from the partner's safety net (its analysis was not checked; 03 §5.6). */
  safetyNet?: boolean;
}

/** Analysis a line needs at runtime. Every method resolves (never rejects). */
export interface LineJudge {
  /** The default class of a learner move off the tree: guard, then the objective (04 §5.4). */
  classify(pos: Position, move: Move, guard: GuardSpec, objective?: Predicate): Promise<DefaultClass>;
  /** Is `goal` met after `moves` from `start`? null = not checked. */
  goal(goal: LineGoal, start: Position, moves: readonly Move[], learner: Color): Promise<boolean | null>;
  /** The partner's move after `moves`, or null when it has none (hand-over, no legal move, failure). */
  partnerMove(request: PartnerRequest): Promise<PartnerReply | null>;
}

/** Builds the src/play policy chain for `specs` (the module is passed in, so it can be loaded lazily). */
export function partnerPolicy(play: typeof import('../play'), specs: readonly PartnerSpec[]): OpponentPolicy {
  const one = (s: PartnerSpec): OpponentPolicy => {
    switch (s.kind) {
      case 'best-defence':
        return play.bestDefence({ k: s.k, resist: s.resist, d: s.d });
      case 'forcing-attack':
        return play.forcingAttack(s.k ?? 2);
      case 'safe-sparring':
        return play.safeSparring(s.d ?? 2, s.tau ?? 1);
      case 'pressing':
        return play.pressing(s.d ?? 2);
    }
  };
  return play.chain(...specs.map(one));
}

/**
 * `LineJudge` over an analyzer: the app passes the analysis client loader (`loadAppAnalysisClient`, the Worker),
 * tests and scripts `() => Promise.resolve(directAnalyzer())` from src/play. Guards and the partner policies are
 * loaded on first use, so none of the search code enters the main chunk.
 */
export function analyzerLineJudge(get: () => Promise<Analyzer>): LineJudge {
  const loadGuard = (spec: GuardSpec) => import('./guard').then((m) => m.resolveGuard(spec));
  return {
    async classify(position, move, spec, objective) {
      try {
        const [a, guard] = await Promise.all([get(), loadGuard(spec)]);
        const v = await a.run({ kind: 'safety-guard', position, move, guard });
        if (v.status !== 'checked') return 'not-checked';
        if (!v.value.safe) return 'error';
        if (objective === undefined) return 'dubious';
        const o = await a.run({ kind: 'predicate', predicate: objective, before: position, moves: [move], side: position.turn });
        if (o.status !== 'checked') return 'not-checked';
        return o.value ? 'target' : 'dubious';
      } catch {
        return 'not-checked';
      }
    },
    async goal(goal, start, moves, learner) {
      const known = staticGoalMet(goal, start, moves, learner);
      if (known !== null || goal.kind !== 'predicate') return known;
      try {
        const a = await get();
        const o = await a.run({ kind: 'predicate', predicate: goal.predicate, before: start, moves, side: learner });
        return o.status === 'checked' ? o.value : null;
      } catch {
        return null;
      }
    },
    async partnerMove({ start, moves, learner, partner, seed }) {
      try {
        const [a, play] = await Promise.all([get(), import('../play')]);
        const record = moves.reduce((r, m) => play.appendMove(r, m), play.createRecord(start, { learner, seed }));
        const choice = await play.choosePartnerMove(partnerPolicy(play, partner), record, a);
        if (choice.kind !== 'move') return null;
        return { move: choice.move, policy: choice.policy, ...(choice.safetyNet ? { safetyNet: true } : {}) };
      } catch {
        return null;
      }
    },
  };
}

/** The app's line judge: the shared analysis Worker client, loaded on first use. */
export const appLineJudge = (): LineJudge =>
  analyzerLineJudge(() => import('../analysis/client').then((m) => m.getAnalysisClient()));

/** Parses a reply / table key, throwing on malformed content (the validator has checked it). */
export function keyToMove(key: string): Move {
  const m = parseMoveKey(key);
  if (!m) throw new Error(`Bad move key: ${key}`);
  return m;
}
