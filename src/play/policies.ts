// Training partners: the OpponentPolicy of design/04-architecture.md §5.5–§5.6 and 03 §5.2.
//
// Division of work. Every search a policy needs is an analysis REQUEST (src/analysis/requests.ts,
// plain data) sent through an injected `Analyzer` — the app passes the Worker client
// (`getAnalysisClient()`), tests and content scripts pass `directAnalyzer()`. The requests return
// complete lists (scores, winning captures, mate distances); the choice among them — repetition
// avoidance, tolerance and the seeded tie-break — happens here, with a per-move seeded RNG
// (rng.ts: `deriveSeed(record.seed, ply)`). So a partner is deterministic per seed and per game, and
// its strength is set by depth and node limits, never by time.
//
// Policies (factories below; each has a learner-facing disclosure key, texts in messages.ts):
//   scripted(script)           authored replies keyed by the moves so far; off the script it hands over
//   bestDefence({ k })         exhaustive mate guard (k ≤ 3): the move that delays the opponent's
//                              forced mate longest (escapes best), seeded ties
//   bestDefence({ resist })    resist mode (03 §5.2, fallback F1c): the same mate guard, then the
//                              highest material score at d plies + quiescence; k = d = 2 by default
//   forcingAttack(k)           a forced mate within k (shortest first), else the highest winning
//                              capture (judge.winningCaptures: gain ≥ 2 at d = 2, 3 with ≤ 12 pieces),
//                              else hands over
//   safeSparring(d, τ)         material search at d; random among moves within τ of the best
//   pressing(d)                feature evaluation (eval.ts DEFAULT_WEIGHTS, the 04 prototype weights;
//                              tuned in S2.18) at d; the best, seeded ties
//   restricted(base, spec)     `base` limited to some pieces / squares (drill partner)
//   greedy()                   captures first (most valuable victim, then cheapest attacker), else
//                              random (drill partner; needs no analysis)
//   chain(a, b, …)             the first link that moves (hold/convert chains of 03 §5.2)
//
// Repetition (03 §5.2, §5.5). A partner never plays a move that loses by the repetition rule
// (perpetual check at the third occurrence) unless every candidate does, and avoids any move that
// creates a third occurrence unless every alternative loses ≥ T = 2 by its own search compared with
// the best repeating move (a move that allows a forced mate counts as losing ≥ T). `scripted` and
// `forcingAttack` simply skip repeating moves (they can hand over instead). A partner thus also avoids
// a third occurrence that would make IT win by the learner's perpetual check (acceptable: it favours
// the learner, whose perpetual check is punished only through the learner's own third occurrence,
// adjudicate.ts `checkLearnerMove`). Repetition cycles are judged as in adjudicate.ts (the moves
// between the last two occurrences).
//
// Safety net (04 §5.5, 03 §5.6). When the policy's analysis request is not checked (the Worker's
// wall-clock safety net, an error, or a node limit — in the synchronous fallback the budget depends
// on the device), the policy plays its d = 1 move (k = 1 for mate guards); if even that is not
// checked, a seeded random candidate. Either way the choice carries `safetyNet` and the record marks
// the move, which voids the run (record.ts `isVoided`). A cancelled request returns 'cancelled'.
import { WINNING_CAPTURE_THRESHOLD, type EvalWeights } from '../analysis';
import {
  MAX_RUNTIME_MATE_DEPTH,
  executeRequest,
  type AnalysisOutcome,
  type AnalysisRequest,
  type ExecuteEnv,
  type NotCheckedReason,
  type RequestLimits,
} from '../analysis/requests';
import { PIECE_VALUES, isLegalMove, legalMoves, makeMove, parseSquare } from '../engine';
import type { Move, PieceType, Position } from '../engine';
import { createsThirdOccurrence, losesByRepetition } from './adjudicate';
import { appendMove, currentPosition, iccsToMove, moveToIccs, type GameRecord } from './record';
import { createRng, deriveSeed, type Rng } from './rng';

// ---------- Analyzer (the analysis client, or a direct executor) ----------

/** The part of the analysis client (src/analysis/client.ts `AnalysisClient`) a policy uses. */
export interface Analyzer {
  run<R extends AnalysisRequest>(request: R, options?: { readonly signal?: AbortSignal }): Promise<AnalysisOutcome<R['kind']>>;
}

/** Runs requests on the calling thread with `executeRequest` (tests, content scripts, benchmarks). */
export function directAnalyzer(env: ExecuteEnv = {}): Analyzer {
  return {
    run<R extends AnalysisRequest>(request: R): Promise<AnalysisOutcome<R['kind']>> {
      return Promise.resolve(executeRequest(request as AnalysisRequest, env) as AnalysisOutcome<R['kind']>);
    },
  };
}

// ---------- Policy interface ----------

export type PolicyName =
  | 'scripted'
  | 'best-defence'
  | 'best-defence-resist'
  | 'forcing-attack'
  | 'safe-sparring'
  | 'pressing'
  | 'restricted'
  | 'greedy'
  | 'chain';

/** messages.ts keys of the learner-facing disclosures (en + vi; added by the integrating item). */
export const DISCLOSURE_KEYS = {
  /** 03 §5.2 general sentence shown on every task screen with a partner. */
  general: 'play.partner.general',
  scripted: 'play.partner.scripted',
  'best-defence': 'play.partner.bestDefence',
  'best-defence-resist': 'play.partner.bestDefenceResist',
  'forcing-attack': 'play.partner.forcingAttack',
  'safe-sparring': 'play.partner.safeSparring',
  pressing: 'play.partner.pressing',
  restricted: 'play.partner.restricted',
  greedy: 'play.partner.greedy',
} as const satisfies Record<Exclude<PolicyName, 'chain'> | 'general', string>;

export type SafetyNetReason = Exclude<NotCheckedReason, 'cancelled'>;

export type PolicyChoice =
  | {
      readonly kind: 'move';
      readonly move: Move;
      /** Label of the policy (chain: the link) that chose the move, e.g. `pressing(2)`. */
      readonly policy: string;
      /** The move came from the safety net (voids the run). */
      readonly safetyNet?: SafetyNetReason;
      /** The move creates a third occurrence (every alternative lost ≥ T, or it was forced). */
      readonly thirdOccurrence?: true;
    }
  /** The policy has nothing to play here (off the script, no forced win or winning capture, …). */
  | { readonly kind: 'hand-over'; readonly policy: string; readonly safetyNet?: SafetyNetReason }
  /** The side to move has no legal move (the game is over). */
  | { readonly kind: 'no-move' }
  | { readonly kind: 'cancelled' };

export interface PolicyContext {
  /** The game so far; the partner is the side to move in `position`. */
  readonly record: GameRecord;
  readonly position: Position;
  readonly analyzer: Analyzer;
  /** Per-move seed (deriveSeed(record.seed, ply); chains derive one per link). */
  readonly seed: number;
  /** Only these moves may be chosen (restricted); default: every legal move. */
  readonly candidates?: readonly Move[];
  /** Node limits for every request (a policy's own `limits` option takes precedence). */
  readonly limits?: RequestLimits;
  readonly signal?: AbortSignal;
}

export interface OpponentPolicy {
  readonly name: PolicyName;
  /** For the game record and logs, e.g. `safe-sparring(2,1)`. */
  readonly label: string;
  /** This policy's disclosure key (chain: its first link's). */
  readonly disclosureKey: string;
  /** Every disclosure key the learner should see for this partner (chain: all links, deduplicated). */
  readonly disclosureKeys: readonly string[];
  choose(ctx: PolicyContext): Promise<PolicyChoice>;
}

/** Losing at least this much (points) makes a third occurrence acceptable (03 §5.2: T = 2). */
export const REPETITION_LOSS_THRESHOLD = WINNING_CAPTURE_THRESHOLD;

const EPS = 1e-9;

// ---------- Shared helpers ----------

/** A step of a policy before the safety net: a choice, or a request that was not checked. */
type Step = PolicyChoice | { readonly kind: 'not-checked'; readonly reason: NotCheckedReason };

/** A candidate with its policy value: higher `rank` first, then higher `score`. */
interface Cand {
  readonly move: Move;
  readonly rank: number;
  readonly score: number;
}

const sameMove = (a: Move, b: Move) => a.from === b.from && a.to === b.to;
const moveOrder = (a: Move, b: Move) => a.from * 90 + a.to - (b.from * 90 + b.to);

function candidatesOf(ctx: PolicyContext): readonly Move[] {
  return ctx.candidates ?? legalMoves(ctx.position);
}

function inCandidates(ctx: PolicyContext, move: Move): boolean {
  return ctx.candidates ? ctx.candidates.some((c) => sameMove(c, move)) : isLegalMove(ctx.position, move);
}

/** `a` loses at least T compared with `b`: a lower rank, or the same rank and ≥ T less score. */
const losesVs = (a: Cand, b: Cand, T: number) => a.rank < b.rank || (a.rank === b.rank && a.score <= b.score - T + EPS);

const better = (a: Cand, b: Cand) => a.rank > b.rank || (a.rank === b.rank && a.score > b.score);

/**
 * 03 §5.2 / §5.5 repetition rule for partners. Returns the candidates the policy may choose from and
 * which of them create a third occurrence.
 */
function repetitionFilter(ctx: PolicyContext, cands: readonly Cand[], T = REPETITION_LOSS_THRESHOLD): { pool: Cand[]; third: Set<Cand> } {
  const third = new Set(cands.filter((c) => createsThirdOccurrence(ctx.record, c.move, ctx.position)));
  if (third.size === 0) return { pool: [...cands], third };
  let pool = cands.filter((c) => !(third.has(c) && losesByRepetition(ctx.record, c.move, ctx.position)));
  if (pool.length === 0) pool = [...cands]; // every candidate loses by repetition: forced
  const rep = pool.filter((c) => third.has(c));
  const others = pool.filter((c) => !third.has(c));
  if (rep.length > 0 && others.length > 0) {
    const bestRep = rep.reduce((a, b) => (better(b, a) ? b : a));
    if (!others.every((a) => losesVs(a, bestRep, T))) pool = others;
  }
  return { pool, third };
}

/** Highest rank, then every move within `tau` of the best score; one of them by the seed (square order). */
function pickBest(cands: readonly Cand[], tau: number, rng: Rng): Cand {
  const maxRank = Math.max(...cands.map((c) => c.rank));
  const top = cands.filter((c) => c.rank === maxRank);
  const best = Math.max(...top.map((c) => c.score));
  const near = top.filter((c) => c.score >= best - tau - EPS).sort((a, b) => moveOrder(a.move, b.move));
  return rng.pick(near);
}

/** Repetition filter + pickBest → a move choice. */
function choose(ctx: PolicyContext, label: string, cands: readonly Cand[], tau: number): PolicyChoice {
  if (cands.length === 0) return { kind: 'hand-over', policy: label };
  const { pool, third } = repetitionFilter(ctx, cands);
  const c = pickBest(pool, tau, createRng(ctx.seed));
  return { kind: 'move', move: c.move, policy: label, ...(third.has(c) ? { thirdOccurrence: true as const } : {}) };
}

/** Moves that create no third occurrence (scripted, forcing-attack: they can hand over instead). */
function withoutRepetition(ctx: PolicyContext, moves: readonly Move[]): Move[] {
  return moves.filter((m) => !createsThirdOccurrence(ctx.record, m, ctx.position));
}

function limitsOf(ctx: PolicyContext, own?: RequestLimits): { limits?: RequestLimits } {
  const limits = own ?? ctx.limits;
  return limits ? { limits } : {};
}

async function ask<R extends AnalysisRequest>(ctx: PolicyContext, request: R): Promise<AnalysisOutcome<R['kind']>> {
  return ctx.analyzer.run(request, ctx.signal ? { signal: ctx.signal } : undefined);
}

/**
 * The common frame of an analysed policy: no legal move → 'no-move'; no candidate → hand over;
 * `full` not checked → `net` (the d = 1 move), flagged; `net` not checked → seeded random candidate,
 * flagged. Cancellation anywhere → 'cancelled'.
 */
function analysed(
  name: PolicyName,
  label: string,
  full: (ctx: PolicyContext) => Promise<Step>,
  net: (ctx: PolicyContext) => Promise<Step>,
  disclosureKey: string = DISCLOSURE_KEYS[name as keyof typeof DISCLOSURE_KEYS],
): OpponentPolicy {
  return {
    name,
    label,
    disclosureKey,
    disclosureKeys: [disclosureKey],
    async choose(ctx) {
      if (legalMoves(ctx.position).length === 0) return { kind: 'no-move' };
      const cands = candidatesOf(ctx);
      if (cands.length === 0) return { kind: 'hand-over', policy: label };
      const first = await full(ctx);
      if (first.kind !== 'not-checked') return first;
      if (first.reason === 'cancelled') return { kind: 'cancelled' };
      const safetyNet: SafetyNetReason = first.reason;
      const second = await net(ctx);
      if (second.kind === 'cancelled' || (second.kind === 'not-checked' && second.reason === 'cancelled')) return { kind: 'cancelled' };
      if (second.kind === 'move' || second.kind === 'hand-over') return { ...second, safetyNet };
      if (second.kind === 'no-move') return second;
      // Even the d = 1 request failed: a seeded random candidate (still repetition-aware).
      return { ...choose(ctx, label, cands.map((move) => ({ move, rank: 0, score: 0 })), 0), safetyNet } as PolicyChoice;
    },
  };
}

function checkDepth(what: string, value: number, max: number): void {
  if (!(Number.isInteger(value) && value >= 1 && value <= max)) throw new Error(`${what} must be an integer 1–${max} (got ${value})`);
}

/**
 * Largest search depth (and mate depth k) a partner accepts. 04 §5.5 / 03 §5.2: depth 3 and
 * forcing-attack(3) fit the budget only in positions of ≤ ~12 pieces. The factories do NOT check the
 * position: task authoring must restrict 3 to such tasks, and the S2.12 practical-task validation
 * must enforce it (with the S2.6 measurements).
 */
export const MAX_PARTNER_DEPTH = 3;

// ---------- scripted ----------

/**
 * Authored replies (03 §5.2 `scripted`: line deviations, threat and counterplay trees), keyed by the
 * moves played since the record's start in ICCS, space-separated ("" = the start position). Several
 * replies at one node: one is picked by the seed.
 */
export interface Script {
  readonly replies: Readonly<Record<string, readonly string[]>>;
}

export function scripted(script: Script): OpponentPolicy {
  const label = 'scripted';
  return {
    name: 'scripted',
    label,
    disclosureKey: DISCLOSURE_KEYS.scripted,
    disclosureKeys: [DISCLOSURE_KEYS.scripted],
    async choose(ctx) {
      if (legalMoves(ctx.position).length === 0) return { kind: 'no-move' };
      const path = ctx.record.moves.map((m) => moveToIccs(m.move)).join(' ');
      const authored = (script.replies[path] ?? []).map(iccsToMove).filter((m) => inCandidates(ctx, m));
      const moves = withoutRepetition(ctx, authored);
      if (moves.length === 0) return { kind: 'hand-over', policy: label };
      return { kind: 'move', move: createRng(ctx.seed).pick(moves), policy: label };
    },
  };
}

// ---------- best-defence (and resist mode) ----------

export interface BestDefenceOptions {
  /** Forced-mate horizon (default 2; 3 only for positions measured within budget, S2.6). */
  readonly k?: number;
  /** Resist mode (03 §5.2, F1c): after the mate guard, the highest material score at `d`. */
  readonly resist?: boolean;
  /** Material search depth of resist mode (default 2). */
  readonly d?: number;
  readonly limits?: RequestLimits;
}

export function bestDefence(options: BestDefenceOptions = {}): OpponentPolicy {
  const k = options.k ?? 2;
  const d = options.d ?? 2;
  checkDepth('best-defence k', k, MAX_RUNTIME_MATE_DEPTH);
  checkDepth('best-defence d', d, MAX_PARTNER_DEPTH);
  const resist = options.resist === true;
  const name: PolicyName = resist ? 'best-defence-resist' : 'best-defence';
  const label = resist ? `best-defence-resist(${k},${d})` : `best-defence(${k})`;
  const step = (kk: number, dd: number) => async (ctx: PolicyContext): Promise<Step> => {
    const md = await ask(ctx, { kind: 'mate-distances', position: ctx.position, k: kk, moves: candidatesOf(ctx), ...limitsOf(ctx, options.limits) });
    if (md.status !== 'checked') return { kind: 'not-checked', reason: md.reason };
    // Rank: a move that ends the game (the opponent has no legal move: mate or stalemate win) first,
    // then an escape (no forced mate within kk), then the longest resistance. (mate-distances gives
    // null for a mating move too, because the mated side has no forced win.)
    const ranked = md.value.map(({ move, mateIn }) => ({
      move,
      rank: legalMoves(makeMove(ctx.position, move)).length === 0 ? kk + 2 : mateIn === null ? kk + 1 : mateIn,
      score: 0,
    }));
    if (!resist) return choose(ctx, label, ranked, 0);
    const maxRank = Math.max(...ranked.map((c) => c.rank));
    const survivors = ranked.filter((c) => c.rank === maxRank);
    const scored = await ask(ctx, {
      kind: 'score-moves',
      position: ctx.position,
      depth: dd,
      moves: survivors.map((c) => c.move),
      ...limitsOf(ctx, options.limits),
    });
    if (scored.status !== 'checked') return { kind: 'not-checked', reason: scored.reason };
    const cands: Cand[] = [
      ...scored.value.map((s) => ({ move: s.move, rank: maxRank, score: s.score })),
      ...ranked.filter((c) => c.rank !== maxRank),
    ];
    return choose(ctx, label, cands, 0);
  };
  return analysed(name, label, step(k, d), step(1, 1));
}

// ---------- forcing-attack(k) ----------

export interface ForcingAttackOptions {
  /** Winning-capture search depth (default: judge.winningCaptures' 2, or 3 with ≤ 12 pieces). */
  readonly d?: number;
  /** Winning-capture threshold (default T = 2). */
  readonly T?: number;
  readonly limits?: RequestLimits;
}

export function forcingAttack(k = 2, options: ForcingAttackOptions = {}): OpponentPolicy {
  checkDepth('forcing-attack k', k, MAX_RUNTIME_MATE_DEPTH);
  if (options.d !== undefined) checkDepth('forcing-attack d', options.d, MAX_PARTNER_DEPTH);
  const label = `forcing-attack(${k})`;
  const step = (kk: number, dd: number | undefined) => async (ctx: PolicyContext): Promise<Step> => {
    const rng = createRng(ctx.seed);
    for (let n = 1; n <= kk; n++) {
      const wins = await ask(ctx, { kind: 'forced-wins', position: ctx.position, n, ...limitsOf(ctx, options.limits) });
      if (wins.status !== 'checked') return { kind: 'not-checked', reason: wins.reason };
      const moves = withoutRepetition(
        ctx,
        wins.value.filter((m) => inCandidates(ctx, m)),
      ).sort(moveOrder);
      if (moves.length > 0) return { kind: 'move', move: rng.pick(moves), policy: label };
    }
    const caps = await ask(ctx, {
      kind: 'winning-captures',
      position: ctx.position,
      ...(dd === undefined ? {} : { depth: dd }),
      ...(options.T === undefined ? {} : { T: options.T }),
      ...limitsOf(ctx, options.limits),
    });
    if (caps.status !== 'checked') return { kind: 'not-checked', reason: caps.reason };
    // A capture never repeats a position (fewer pieces), so no repetition filter is needed.
    const captures = caps.value.captures.filter((c) => inCandidates(ctx, c.move));
    if (captures.length === 0) return { kind: 'hand-over', policy: label };
    return choose(ctx, label, captures.map((c) => ({ move: c.move, rank: 0, score: c.score })), 0);
  };
  return analysed('forcing-attack', label, step(k, options.d), step(1, 1));
}

// ---------- safe-sparring(d, τ) and pressing(d) ----------

export interface ScoringOptions {
  readonly limits?: RequestLimits;
}

/** Material search at d plies + quiescence; random among moves within τ of the best (τ = 1.0 Basic, 0.5 above). */
export function safeSparring(d = 2, tau = 1.0, options: ScoringOptions = {}): OpponentPolicy {
  checkDepth('safe-sparring d', d, MAX_PARTNER_DEPTH);
  if (!(tau >= 0)) throw new Error(`safe-sparring τ must be ≥ 0 (got ${tau})`);
  const label = `safe-sparring(${d},${tau})`;
  const step = (dd: number) => async (ctx: PolicyContext): Promise<Step> => {
    const r = await ask(ctx, { kind: 'score-moves', position: ctx.position, depth: dd, moves: candidatesOf(ctx), ...limitsOf(ctx, options.limits) });
    if (r.status !== 'checked') return { kind: 'not-checked', reason: r.reason };
    return choose(ctx, label, r.value.map((s) => ({ move: s.move, rank: 0, score: s.score })), tau);
  };
  return analysed('safe-sparring', label, step(d), step(1));
}

export interface PressingOptions extends ScoringOptions {
  /** Feature weights (default eval.ts DEFAULT_WEIGHTS; tuned in S2.18). */
  readonly weights?: EvalWeights;
  /** Tolerance below the best feature score (default 0: the best, seeded ties). */
  readonly tau?: number;
}

/** Material + palace pressure, hanging pieces and mobility (eval.ts featureEvaluator) at d plies + quiescence. */
export function pressing(d = 2, options: PressingOptions = {}): OpponentPolicy {
  checkDepth('pressing d', d, MAX_PARTNER_DEPTH);
  const tau = options.tau ?? 0;
  const label = `pressing(${d})`;
  const evalSpec = { kind: 'features' as const, ...(options.weights ? { weights: options.weights } : {}) };
  const step = (dd: number) => async (ctx: PolicyContext): Promise<Step> => {
    const r = await ask(ctx, {
      kind: 'score-moves',
      position: ctx.position,
      depth: dd,
      moves: candidatesOf(ctx),
      eval: evalSpec,
      ...limitsOf(ctx, options.limits),
    });
    if (r.status !== 'checked') return { kind: 'not-checked', reason: r.reason };
    return choose(ctx, label, r.value.map((s) => ({ move: s.move, rank: 0, score: s.score })), tau);
  };
  return analysed('pressing', label, step(d), step(1));
}

// ---------- restricted, greedy ----------

/** Which moves a restricted partner may play; every given field must match. Squares in ICCS. */
export interface RestrictionSpec {
  readonly pieceTypes?: readonly PieceType[];
  readonly from?: readonly string[];
  readonly to?: readonly string[];
}

/** `base` limited to the moves matching `spec` (a drill partner; never application evidence). */
export function restricted(base: OpponentPolicy, spec: RestrictionSpec): OpponentPolicy {
  const from = spec.from ? new Set(spec.from.map(parseSquare)) : null;
  const to = spec.to ? new Set(spec.to.map(parseSquare)) : null;
  const types = spec.pieceTypes ? new Set(spec.pieceTypes) : null;
  const label = `restricted(${base.label})`;
  return {
    name: 'restricted',
    label,
    disclosureKey: DISCLOSURE_KEYS.restricted,
    disclosureKeys: [DISCLOSURE_KEYS.restricted],
    async choose(ctx) {
      if (legalMoves(ctx.position).length === 0) return { kind: 'no-move' };
      const allowed = candidatesOf(ctx).filter(
        (m) =>
          (!from || from.has(m.from)) &&
          (!to || to.has(m.to)) &&
          (!types || types.has(ctx.position.board[m.from]!.type)),
      );
      if (allowed.length === 0) return { kind: 'hand-over', policy: label };
      const c = await base.choose({ ...ctx, candidates: allowed });
      return c.kind === 'move' || c.kind === 'hand-over' ? { ...c, policy: label } : c;
    },
  };
}

/** Captures first: the most valuable victim, then the cheapest attacker; else a seeded random move. */
export function greedy(): OpponentPolicy {
  const label = 'greedy';
  return {
    name: 'greedy',
    label,
    disclosureKey: DISCLOSURE_KEYS.greedy,
    disclosureKeys: [DISCLOSURE_KEYS.greedy],
    async choose(ctx) {
      if (legalMoves(ctx.position).length === 0) return { kind: 'no-move' };
      const board = ctx.position.board;
      const cands = candidatesOf(ctx).map((move) => {
        const victim = board[move.to];
        const score = victim ? PIECE_VALUES[victim.type] - PIECE_VALUES[board[move.from]!.type] / 1000 : 0;
        return { move, rank: 0, score };
      });
      return choose(ctx, label, cands, 0);
    },
  };
}

// ---------- chain ----------

/**
 * The first link that moves (03 §5.2 chains: hold = threat tree → forcingAttack(2) → pressing(2);
 * convert under F1c = counterplay tree → forcingAttack(2) → bestDefence({ resist: true })). Each
 * link gets its own seed stream. A safety-net flag of a link that handed over is carried to the move
 * finally played, so the run is still voided. All links hand over → hand-over.
 */
export function chain(...links: readonly OpponentPolicy[]): OpponentPolicy {
  if (links.length === 0) throw new Error('chain: no links');
  const label = `chain(${links.map((l) => l.label).join(' → ')})`;
  return {
    name: 'chain',
    label,
    disclosureKey: links[0].disclosureKey,
    disclosureKeys: [...new Set(links.flatMap((l) => l.disclosureKeys))],
    async choose(ctx) {
      let safetyNet: SafetyNetReason | undefined;
      for (let i = 0; i < links.length; i++) {
        const c = await links[i].choose({ ...ctx, seed: deriveSeed(ctx.seed, i) });
        if (c.kind === 'hand-over') {
          safetyNet ??= c.safetyNet;
          continue;
        }
        if (c.kind === 'move') {
          const net = c.safetyNet ?? safetyNet;
          return net ? { ...c, safetyNet: net } : c;
        }
        return c;
      }
      return { kind: 'hand-over', policy: label, ...(safetyNet ? { safetyNet } : {}) };
    },
  };
}

// ---------- Playing a partner move on a record ----------

export interface PartnerMoveOptions {
  readonly limits?: RequestLimits;
  readonly signal?: AbortSignal;
  /** Timestamp for the record (injected clock). */
  readonly at?: number;
}

/** The partner's choice for the side to move in `record` (seed = deriveSeed(record.seed, ply)). */
export async function choosePartnerMove(
  policy: OpponentPolicy,
  record: GameRecord,
  analyzer: Analyzer,
  options: PartnerMoveOptions = {},
): Promise<PolicyChoice> {
  const position = currentPosition(record);
  return policy.choose({
    record,
    position,
    analyzer,
    seed: deriveSeed(record.seed, record.moves.length),
    ...(options.limits ? { limits: options.limits } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });
}

/** Chooses and, when the choice is a move, appends it to the record with its partner metadata. */
export async function playPartnerMove(
  policy: OpponentPolicy,
  record: GameRecord,
  analyzer: Analyzer,
  options: PartnerMoveOptions = {},
): Promise<{ readonly choice: PolicyChoice; readonly record: GameRecord }> {
  const choice = await choosePartnerMove(policy, record, analyzer, options);
  if (choice.kind !== 'move') return { choice, record };
  const next = appendMove(record, choice.move, {
    partner: { policy: choice.policy, ...(choice.safetyNet ? { safetyNet: choice.safetyNet } : {}) },
    ...(options.at === undefined ? {} : { at: options.at }),
  });
  return { choice, record: next };
}
