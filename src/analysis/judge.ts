// Judging moves: the safety guard and signals of design/03-assessment.md §5.3, the "threat" of
// design/02-curriculum.md a06, the `forcing-attack` winning capture of 03 §5.2 and the declarative
// objective predicates of design/04-architecture.md §5.4 layer 2 (02 U4: a fixed built-in list,
// no per-item code).
//
// Material searches run through src/analysis/search.ts with the material evaluation, so they equal
// the engine's moveScore/searchScore, but they carry node limits: when a limit stops a search the
// verdict is 'not-checked' (04 §5.4: never a penalty). Forced-mate checks use the engine's exhaustive
// `hasForcedWin` (k ≤ 2 at runtime: milliseconds on a quiet full board, 04 §2.2) and are not limited.
import {
  MATE_SCORE,
  hasForcedWin,
  isGeneralAttacked,
  legalMoves,
  makeMove,
  materialBalance,
  opposite,
  parseSquare,
} from '../engine';
import type { Color, Move, Position, Square } from '../engine';
import {
  captureGain,
  connectedSoldierPairs,
  crossedSoldiers,
  development,
  generalFileExposure,
  piecesAhead,
  hangingPieces,
  hasCrossedRiver,
  enPrisePieces,
  legalAttackers,
  palaceDefenders,
  pieceCount,
  pieceMobility,
  soldierBlocked,
} from './features';
import { search, searchAtLeast, searchMove } from './search';

// ---------- Levels and the safety horizon (03 §5.3 table) ----------

export type AnalysisLevel = 'basics' | 'intermediate' | 'advanced' | 'expert' | 'master';

export interface SafetyGuard {
  /** Allowed-loss horizon: plies searched after the learner's move, opponent first, + quiescence. */
  readonly h: number;
  /** Allowed-mate depth: the opponent's forced mate within k moves. */
  readonly k: number;
  /** Material threshold in points. */
  readonly T: number;
  /** Missed gain: 'free-capture' = only captures with captureGain ≥ T (Basic); 'search' = S(m′) at h + 1. */
  readonly missedGain: 'free-capture' | 'search';
  /** Missed mate counted up to this depth (0 = never). */
  readonly missedMate: number;
}

/** Default guard per level (03 §5.3; h = 2 above Basic until S2.6 measures h = 3 within budget). */
export const SAFETY_GUARDS: Readonly<Record<AnalysisLevel, SafetyGuard>> = {
  basics: { h: 1, k: 1, T: 2, missedGain: 'free-capture', missedMate: 1 },
  intermediate: { h: 2, k: 2, T: 2, missedGain: 'search', missedMate: 1 },
  advanced: { h: 2, k: 2, T: 2, missedGain: 'search', missedMate: 2 },
  expert: { h: 2, k: 2, T: 2, missedGain: 'search', missedMate: 2 },
  master: { h: 2, k: 2, T: 2, missedGain: 'search', missedMate: 2 },
};

const LEVEL_BY_PREFIX: Record<string, AnalysisLevel> = {
  b: 'basics',
  i: 'intermediate',
  a: 'advanced',
  e: 'expert',
  m: 'master',
};

/**
 * Guard for a unit id (`b05`, `i07`, …; lesson and item ids work too). Intermediate refinements of
 * 03 §5.3: gains within 2 plies are counted from i02 on (i01 keeps Basic's free captures), mate in 2
 * from i05 on. Throws on an unknown prefix.
 */
export function guardForUnit(id: string): SafetyGuard {
  const m = /^([biaem])(\d{2})/.exec(id);
  if (!m) throw new Error(`Unknown unit id: ${id}`);
  const level = LEVEL_BY_PREFIX[m[1]];
  const base = SAFETY_GUARDS[level];
  if (level !== 'intermediate') return base;
  const n = Number(m[2]);
  return { ...base, missedGain: n >= 2 ? 'search' : 'free-capture', missedMate: n >= 5 ? 2 : 1 };
}

/** Search limits for one judge call; `maxNodes` applies to each search separately. */
export interface JudgeLimits {
  readonly maxNodes?: number;
  readonly abort?: { readonly aborted: boolean };
}

/** Default node cap per search (04 §5.5: ~20,000 nodes keeps an unlucky position bounded). */
export const DEFAULT_MAX_NODES = 20_000;

const MATE_BOUND = MATE_SCORE / 2;
const isLossScore = (s: number) => s < -MATE_BOUND;

const sameMove = (a: Move, b: Move) => a.from === b.from && a.to === b.to;

class NotChecked {}
const NOT_CHECKED = new NotChecked();

/** Runs searches with the shared limits, throwing NOT_CHECKED when one is stopped. */
function searcher(limits: JudgeLimits) {
  const opts = { maxNodes: limits.maxNodes ?? DEFAULT_MAX_NODES, abort: limits.abort };
  let nodes = 0;
  return {
    get nodes() {
      return nodes;
    },
    move(pos: Position, move: Move, depth: number): number {
      const r = searchMove(pos, move, { ...opts, depth });
      nodes += r.nodes;
      if (!r.complete) throw NOT_CHECKED;
      return r.score;
    },
    best(pos: Position, depth: number): number {
      const r = search(pos, { ...opts, depth });
      nodes += r.nodes;
      if (!r.complete) throw NOT_CHECKED;
      return r.score;
    },
    /** Null-window: is the best score of `pos` at `depth` ≥ threshold? */
    atLeast(pos: Position, depth: number, threshold: number): boolean {
      const r = searchAtLeast(pos, threshold, { ...opts, depth });
      nodes += r.nodes;
      if (!r.complete) throw NOT_CHECKED;
      return r.value;
    },
  };
}

/** True when, after `move` was played to reach `after`, its side still forces a win within n moves. */
export function keepsForcedWin(after: Position, n: number): boolean {
  const replies = legalMoves(after);
  if (replies.length === 0) return true;
  if (n <= 1) return false;
  return replies.every((r) => hasForcedWin(makeMove(after, r), n - 1));
}

// ---------- Threat (02 a06; 03 §5.3 "unanswered threat", "threat at the end") ----------

export interface ThreatResult {
  readonly status: 'checked' | 'not-checked';
  /**
   * False when the position with `side` to move again is not legal (the other side would be in
   * check, e.g. the move just played gave check): then there is no threat by definition.
   */
  readonly legal: boolean;
  /** `side` has a forced mate within k. */
  readonly mate: boolean;
  /** Material `side` gains within the horizon (search score − balance), when no mate was found. */
  readonly gain: number | null;
  /** mate, or gain ≥ T (threatAtEnd: also a check given to the other side, see there). */
  readonly isThreat: boolean;
  /** The other side is in check in `pos` (then `legal` is false). */
  readonly check: boolean;
  readonly nodes: number;
}

/**
 * The threat of `side` in `pos` (02 a06): with `side` to move (again), a forced mate within `k`
 * or a gain ≥ `T` within the horizon (`side`'s move + `h` plies + capture quiescence), on a legal
 * position. Works whoever is to move in `pos`.
 */
export function threatOf(
  pos: Position,
  side: Color,
  guard: Pick<SafetyGuard, 'h' | 'k' | 'T'>,
  limits: JudgeLimits = {},
): ThreatResult {
  const moved: Position = { ...pos, turn: side };
  if (isGeneralAttacked(pos.board, opposite(side))) {
    return { status: 'checked', legal: false, mate: false, gain: null, isThreat: false, check: true, nodes: 0 };
  }
  if (guard.k > 0 && hasForcedWin(moved, guard.k)) {
    return { status: 'checked', legal: true, mate: true, gain: null, isThreat: true, check: false, nodes: 0 };
  }
  const s = searcher(limits);
  try {
    const gain = s.best(moved, guard.h + 1) - materialBalance(pos.board, side);
    return { status: 'checked', legal: true, mate: false, gain, isThreat: gain >= guard.T, check: false, nodes: s.nodes };
  } catch (e) {
    if (e !== NOT_CHECKED) throw e;
    return { status: 'not-checked', legal: true, mate: false, gain: null, isThreat: false, check: false, nodes: s.nodes };
  }
}

/** The a06 "quiet threat" test: after `move`, does its side threaten (moving again)? A check is never one. */
export function threatAfterMove(
  pos: Position,
  move: Move,
  guard: Pick<SafetyGuard, 'h' | 'k' | 'T'>,
  limits: JudgeLimits = {},
): ThreatResult {
  return threatOf(makeMove(pos, move), pos.turn, guard, limits);
}

// ---------- Signals and the per-move penalty (03 §5.3) ----------

export type PenaltyKind = 'allowed-mate' | 'serious-allowed-loss' | 'allowed-loss' | 'missed-mate' | 'missed-gain';

/** R1 Safety deductions per move (03 §5.3). */
export const R1_PENALTIES: Readonly<Record<PenaltyKind, number>> = {
  'allowed-mate': 50,
  'serious-allowed-loss': 50,
  'allowed-loss': 25,
  'missed-mate': 25,
  'missed-gain': 15,
};

export interface AllowedLoss {
  /** L(m) = B − S(m). */
  readonly loss: number;
  /** L(m) − min L(m′) = best S − S(m). */
  readonly excess: number;
  /** excess ≥ 4. */
  readonly serious: boolean;
  /**
   * S(m) is a forced-mate score (the material search proved the learner gets mated inside its
   * horizon): `loss`/`excess` then carry mate-score sizes (~1e5), not points.
   */
  readonly mate: boolean;
}

export interface MoveSignals {
  /** 'not-checked' when a node limit or the abort flag stopped a search: no signal, no penalty. */
  readonly status: 'checked' | 'not-checked';
  /** B = materialBalance(P.board, learner). */
  readonly balance: number;
  /** S(m) = moveScore(P, m, h + 1) (null if not checked). */
  readonly score: number | null;
  /** max over legal m′ of S(m′), only when a second search was needed (else null). */
  readonly best: number | null;
  readonly allowedLoss: AllowedLoss | null;
  readonly allowedMate: boolean;
  readonly missedGain: boolean;
  readonly missedMate: boolean;
  /** Allowed loss/mate whose threat already existed in P (only with `threats: true`, else null). */
  readonly unansweredThreat: boolean | null;
  /** The move's single largest penalty (one penalty per move), or null. */
  readonly penalty: PenaltyKind | null;
  readonly nodes: number;
}

export interface SignalOptions extends JudgeLimits {
  /** Also compute the unanswered-threat signal (m03, feedback). Default false. */
  readonly threats?: boolean;
  /** Compute missed gain / missed mate (default true). The decision-item guard turns them off. */
  readonly missed?: boolean;
}

/** The single largest penalty among the signals (03 §5.3 "per-move penalty"). */
export function largestPenalty(s: Pick<MoveSignals, 'allowedLoss' | 'allowedMate' | 'missedGain' | 'missedMate'>): PenaltyKind | null {
  const kinds: PenaltyKind[] = [];
  if (s.allowedMate) kinds.push('allowed-mate');
  if (s.allowedLoss) kinds.push(s.allowedLoss.serious ? 'serious-allowed-loss' : 'allowed-loss');
  if (s.missedMate) kinds.push('missed-mate');
  if (s.missedGain) kinds.push('missed-gain');
  let best: PenaltyKind | null = null;
  for (const k of kinds) if (best === null || R1_PENALTIES[k] > R1_PENALTIES[best]) best = k;
  return best;
}

/**
 * Signals of the learner's legal move `m` in `P` (learner = P.turn), 03 §5.3:
 * - allowed loss: L(m) ≥ T and L(m) − min L(m′) ≥ T; the second (all-moves) search runs only when the
 *   first condition holds; a loss every move suffers (incl. a mate every move allows) is not penalised;
 * - allowed mate: the opponent mates within k after m and some legal alternative avoids it;
 * - missed gain: some m′ with S(m′) − B ≥ T and S(m′) − S(m) ≥ T (Basic: m′ ranges over free captures,
 *   captureGain ≥ T, only); a null-window search answers it when the exact best is not needed;
 * - missed mate: P had a forced mate within `missedMate` moves and m does not keep one;
 * - penalty: the single largest one.
 */
export function moveSignals(P: Position, m: Move, guard: SafetyGuard, options: SignalOptions = {}): MoveSignals {
  const learner = P.turn;
  const B = materialBalance(P.board, learner);
  const s = searcher(options);
  const missed = options.missed ?? true;
  const after = makeMove(P, m);
  try {
    const depth = guard.h + 1;
    const S = s.move(P, m, depth);
    let best: number | null = null;
    const bestScore = () => (best ??= s.best(P, depth));

    let allowedLoss: AllowedLoss | null = null;
    if (B - S >= guard.T) {
      const top = bestScore();
      const unavoidable = isLossScore(S) && isLossScore(top);
      const excess = top - S;
      if (!unavoidable && excess >= guard.T) allowedLoss = { loss: B - S, excess, serious: excess >= 4, mate: isLossScore(S) };
    }

    let allowedMate = false;
    if (guard.k > 0 && hasForcedWin(after, guard.k)) {
      allowedMate = legalMoves(P).some((alt) => !sameMove(alt, m) && !hasForcedWin(makeMove(P, alt), guard.k));
    }

    let missedGain = false;
    let missedMate = false;
    if (missed) {
      if (guard.missedGain === 'free-capture') {
        // Basic: only free captures (captureGain ≥ T) count as m′, but each must still satisfy the
        // S conditions: S(m′) − B ≥ T and S(m′) − S(m) ≥ T (a poisoned free capture does not count).
        missedGain = legalMoves(P)
          .filter((x) => P.board[x.to] && !sameMove(x, m) && captureGain(P, x) >= guard.T)
          .some((x) => {
            const Sx = s.move(P, x, depth);
            return Sx - B >= guard.T && Sx - S >= guard.T;
          });
      } else if (best !== null) {
        missedGain = best - B >= guard.T && best - S >= guard.T;
      } else {
        // max S(m′) ≥ max(B, S(m)) + T, by a null-window search (cheaper than the exact best).
        missedGain = s.atLeast(P, depth, Math.max(B, S) + guard.T);
      }
      if (guard.missedMate > 0 && hasForcedWin(P, guard.missedMate)) {
        missedMate = !keepsForcedWin(after, guard.missedMate);
      }
    }

    let unansweredThreat: boolean | null = null;
    if (options.threats) {
      unansweredThreat = false;
      if ((allowedLoss || allowedMate) && !isGeneralAttacked(P.board, learner)) {
        const t = threatOf(P, opposite(learner), guard, options);
        if (t.status === 'not-checked') throw NOT_CHECKED;
        unansweredThreat = t.isThreat;
      }
    }

    const signals = { allowedLoss, allowedMate, missedGain, missedMate };
    return {
      status: 'checked',
      balance: B,
      score: S,
      best,
      ...signals,
      unansweredThreat,
      penalty: largestPenalty(signals),
      nodes: s.nodes,
    };
  } catch (e) {
    if (e !== NOT_CHECKED) throw e;
    return {
      status: 'not-checked',
      balance: B,
      score: null,
      best: null,
      allowedLoss: null,
      allowedMate: false,
      missedGain: false,
      missedMate: false,
      unansweredThreat: null,
      penalty: null,
      nodes: s.nodes,
    };
  }
}

export interface SafetyVerdict {
  readonly status: 'checked' | 'not-checked';
  /** No allowed mate within k and no allowed loss ≥ T within h (compared with the best alternative). */
  readonly safe: boolean;
  readonly allowedLoss: AllowedLoss | null;
  readonly allowedMate: boolean;
  /**
   * Static attack-map fact (04 §5.4 layer 1): own pieces left hanging or attacked by a cheaper piece
   * after the move. Reported for feedback; it does not decide `safe`, because the search above
   * already sees every winning capture within the horizon and a static "en prise" can be a trap.
   */
  readonly enPrise: readonly Square[];
  readonly nodes: number;
}

/** Layer-1 safety guard of a `decision` move (04 §5.4) with the given horizon. */
export function safetyGuard(P: Position, m: Move, guard: SafetyGuard, limits: JudgeLimits = {}): SafetyVerdict {
  const sig = moveSignals(P, m, guard, { ...limits, missed: false });
  const enPrise = enPrisePieces(makeMove(P, m).board, P.turn);
  return {
    status: sig.status,
    safe: sig.status === 'checked' && !sig.allowedLoss && !sig.allowedMate,
    allowedLoss: sig.allowedLoss,
    allowedMate: sig.allowedMate,
    enPrise,
    nodes: sig.nodes,
  };
}

/**
 * 03 §5.3 "threat at the end": the opponent, if to move, mates within 2 or gains ≥ T.
 * Interpretation (not spelled out in 03): if the learner is in CHECK in the final position, "the
 * opponent to move" is not a legal position, and the check itself is the worst threat, so it counts
 * as a threat at the end (`isThreat: true`, `check: true`, `legal: false`). This keeps R5's "no
 * threat at the end" from being granted in a position where the learner is being checked. (The a06
 * quiet-threat test keeps the plain rule: a move that gives check is not a quiet threat.)
 */
export function threatAtEnd(pos: Position, opponent: Color, guard: SafetyGuard, limits: JudgeLimits = {}): ThreatResult {
  const t = threatOf(pos, opponent, { h: guard.h, k: 2, T: guard.T }, limits);
  return t.check ? { ...t, isThreat: true } : t;
}

// ---------- forcing-attack winning capture (03 §5.2, 04 §5.5) ----------

/** 03 §5.2: T = WIN_MATERIAL_THRESHOLD (src/puzzles/logic.ts), repeated here to keep the layer pure. */
export const WINNING_CAPTURE_THRESHOLD = 2;

export interface ScoredCapture {
  readonly move: Move;
  /** moveScore(P, m, d). */
  readonly score: number;
  /** score − materialBalance(P.board, mover). */
  readonly gain: number;
}

export interface WinningCaptures {
  readonly status: 'checked' | 'not-checked';
  /** Winning captures, highest score first (square order among equals). Empty if not checked. */
  readonly captures: readonly ScoredCapture[];
  /** Depth used: 2 plies, 3 in positions of ≤ 12 pieces, unless given. */
  readonly depth: number;
  readonly nodes: number;
}

/**
 * Captures m with moveScore(P, m, d) − materialBalance(P.board, mover) ≥ T (03 §5.2), d = 2 plies
 * + capture quiescence (3 in positions of ≤ 12 pieces).
 */
export function winningCaptures(
  pos: Position,
  options: JudgeLimits & { readonly depth?: number; readonly T?: number } = {},
): WinningCaptures {
  const depth = options.depth ?? (pieceCount(pos.board) <= 12 ? 3 : 2);
  const T = options.T ?? WINNING_CAPTURE_THRESHOLD;
  const B = materialBalance(pos.board, pos.turn);
  const s = searcher(options);
  try {
    const captures = legalMoves(pos)
      .filter((m) => pos.board[m.to])
      .map((move) => {
        const score = s.move(pos, move, depth);
        return { move, score, gain: score - B };
      })
      .filter((c) => c.gain >= T)
      .sort((a, b) => b.score - a.score);
    return { status: 'checked', captures, depth, nodes: s.nodes };
  } catch (e) {
    if (e !== NOT_CHECKED) throw e;
    return { status: 'not-checked', captures: [], depth, nodes: s.nodes };
  }
}

/** The highest-scoring winning capture, ties broken by the injected (seeded) `random` in [0, 1). */
export function chooseWinningCapture(
  pos: Position,
  random: () => number,
  options: JudgeLimits & { readonly depth?: number; readonly T?: number } = {},
): Move | null {
  const { captures } = winningCaptures(pos, options);
  if (captures.length === 0) return null;
  const top = captures.filter((c) => c.score === captures[0].score);
  return top[Math.min(top.length - 1, Math.floor(random() * top.length))].move;
}

// ---------- Objective predicates (04 §5.4 layer 2; declarative, JSON) ----------

/**
 * A piece is named by the square it stands on in the `before` position (ICCS, e.g. "h2"); it is
 * followed through the moves. "own" = the side that moves first from `before` unless `side` is set.
 */
export type Predicate =
  | { readonly kind: 'all'; readonly of: readonly Predicate[] }
  | { readonly kind: 'any'; readonly of: readonly Predicate[] }
  | { readonly kind: 'not'; readonly of: Predicate }
  /** Legal-move count of the named piece ≥ min and/or increased by ≥ increaseBy. */
  | { readonly kind: 'mobility'; readonly piece: string; readonly min?: number; readonly increaseBy?: number }
  /** The named piece stands on one of `squares`. */
  | { readonly kind: 'reach'; readonly piece: string; readonly squares: readonly string[] }
  /**
   * Xiangqi open file: at most `maxBlockers` (default 0) pieces of either colour stand on the named
   * piece's file in front of it, towards the opponent's back rank (features.piecesAhead).
   * `ownOnly: true` counts only own pieces in front (the line is blocked only by enemy pieces).
   */
  | { readonly kind: 'open-file'; readonly piece: string; readonly maxBlockers?: number; readonly ownOnly?: boolean }
  /** The named piece is on the opponent's side of the river. */
  | { readonly kind: 'crossed-river'; readonly piece: string }
  /** Own development (features.development) ≥ min and/or increased by ≥ increaseBy. */
  | {
      readonly kind: 'development';
      /**
       * developed = chariots, horses and cannons off their starting points (default); free-horses =
       * horses with no leg blocking an on-board jump; defenders-moved = advisors/elephants moved.
       */
      readonly measure?: 'developed' | 'chariots-out' | 'horses-out' | 'free-horses' | 'defenders-moved';
      readonly min?: number;
      readonly increaseBy?: number;
    }
  /** Own advisors + elephants ≥ min. */
  | { readonly kind: 'palace-defenders'; readonly min: number }
  /**
   * The own general's file is closed against an enemy chariot (a piece in front), a cannon (no empty
   * square behind exactly one blocker, features.generalFileExposure) or both.
   */
  | { readonly kind: 'general-file'; readonly against: 'chariot' | 'cannon' | 'both' }
  /** No own piece attacked and undefended. */
  | { readonly kind: 'no-hanging' }
  /** The named enemy piece can be legally captured by an own piece (if it were own turn). */
  | { readonly kind: 'attacks'; readonly target: string }
  /** The named enemy piece's mobility reduced by ≥ reduceBy and/or ≤ max (captured = 0). */
  | { readonly kind: 'restricts'; readonly target: string; readonly reduceBy?: number; readonly max?: number }
  /** Own soldiers across the river ≥ min. */
  | { readonly kind: 'crossed-soldiers'; readonly min: number }
  /** Own pairs of side-by-side soldiers ≥ min (default 1). */
  | { readonly kind: 'connected-soldiers'; readonly min?: number }
  /** The named soldier is (blocked: true, default) or is not blocked in front. */
  | { readonly kind: 'soldier-blocked'; readonly piece: string; readonly blocked?: boolean }
  /** The named piece is no longer on the board (03 R5 "an attacker exchanged" for an enemy piece). */
  | { readonly kind: 'captured'; readonly piece: string }
  /**
   * 02 a06: own side, moving again, mates within k or gains ≥ T within h (default: Advanced guard;
   * k ≤ 3, h ≤ 3; k = 3 only in small positions, 04 §5.5). `created: true` also requires that no
   * such threat existed in `before` (own side moving there). Predicates are judged on the final
   * position; for "at some point" (R5 counterplay) the caller evaluates each prefix of the moves.
   */
  | { readonly kind: 'threat'; readonly h?: number; readonly k?: number; readonly T?: number; readonly created?: boolean };

export type PredicateKind = Predicate['kind'];

export const PREDICATE_KINDS: readonly PredicateKind[] = [
  'all',
  'any',
  'not',
  'mobility',
  'reach',
  'open-file',
  'crossed-river',
  'development',
  'palace-defenders',
  'general-file',
  'no-hanging',
  'attacks',
  'restricts',
  'crossed-soldiers',
  'connected-soldiers',
  'soldier-blocked',
  'captured',
  'threat',
];

export interface PredicateContext {
  readonly before: Position;
  /** Moves played from `before` (a decision item: one move; a task: the whole game). */
  readonly moves: readonly Move[];
  /** Whose facts "own" means. Default: before.turn. */
  readonly side?: Color;
  readonly limits?: JudgeLimits;
}

/** Where the piece that stood on `from` is after `moves`, or null if it was captured. */
export function trackPiece(from: Square, moves: readonly Move[]): Square | null {
  let cur: Square | null = from;
  for (const m of moves) {
    if (cur === null) return null;
    if (m.from === cur) cur = m.to;
    else if (m.to === cur) cur = null;
  }
  return cur;
}

/**
 * Evaluates a predicate: true / false, or null = "not checked" (only `threat` searches; a node limit
 * stopped it). Three-valued: `all` is false if any part is false, `any` true if any part is true.
 */
export function evaluatePredicate(pred: Predicate, ctx: PredicateContext): boolean | null {
  const after = ctx.moves.reduce(makeMove, ctx.before);
  return evaluateOn(pred, ctx, after);
}

function evaluateOn(pred: Predicate, ctx: PredicateContext, after: Position): boolean | null {
  const side = ctx.side ?? ctx.before.turn;
  const track = (name: string) => trackPiece(parseSquare(name), ctx.moves);
  const atLeast = (now: number, was: number, min?: number, increaseBy?: number) =>
    (min === undefined || now >= min) && (increaseBy === undefined || now - was >= increaseBy);
  switch (pred.kind) {
    case 'all': {
      let unknown = false;
      for (const p of pred.of) {
        const v = evaluateOn(p, ctx, after);
        if (v === false) return false;
        if (v === null) unknown = true;
      }
      return unknown ? null : true;
    }
    case 'any': {
      let unknown = false;
      for (const p of pred.of) {
        const v = evaluateOn(p, ctx, after);
        if (v === true) return true;
        if (v === null) unknown = true;
      }
      return unknown ? null : false;
    }
    case 'not': {
      const v = evaluateOn(pred.of, ctx, after);
      return v === null ? null : !v;
    }
    case 'mobility': {
      const cur = track(pred.piece);
      if (cur === null) return false;
      return atLeast(pieceMobility(after.board, cur), pieceMobility(ctx.before.board, parseSquare(pred.piece)), pred.min, pred.increaseBy);
    }
    case 'reach': {
      const cur = track(pred.piece);
      return cur !== null && pred.squares.map(parseSquare).includes(cur);
    }
    case 'open-file': {
      const cur = track(pred.piece);
      if (cur === null) return false;
      const color = after.board[cur]!.color;
      const ahead = piecesAhead(after.board, cur).filter((sq) => !pred.ownOnly || after.board[sq]!.color === color);
      return ahead.length <= (pred.maxBlockers ?? 0);
    }
    case 'crossed-river': {
      const cur = track(pred.piece);
      return cur !== null && hasCrossedRiver(after.board, cur);
    }
    case 'development': {
      const measure = (board: Position['board']) => {
        const d = development(board, side);
        switch (pred.measure ?? 'developed') {
          case 'developed':
            return d.developed;
          case 'chariots-out':
            return d.chariotsOut;
          case 'horses-out':
            return d.horsesOut;
          case 'free-horses':
            return d.freeHorses;
          case 'defenders-moved':
            return d.defendersMoved;
        }
      };
      return atLeast(measure(after.board), measure(ctx.before.board), pred.min, pred.increaseBy);
    }
    case 'palace-defenders':
      return palaceDefenders(after.board, side) >= pred.min;
    case 'general-file': {
      const e = generalFileExposure(after.board, side);
      return (pred.against === 'cannon' || !e.chariot) && (pred.against === 'chariot' || !e.cannon);
    }
    case 'no-hanging':
      return hangingPieces(after.board, side).length === 0;
    case 'attacks': {
      const cur = track(pred.target);
      return cur !== null && legalAttackers(after.board, cur, side).length > 0;
    }
    case 'restricts': {
      const cur = track(pred.target);
      const now = cur === null ? 0 : pieceMobility(after.board, cur);
      const was = pieceMobility(ctx.before.board, parseSquare(pred.target));
      return (pred.reduceBy === undefined || was - now >= pred.reduceBy) && (pred.max === undefined || now <= pred.max);
    }
    case 'crossed-soldiers':
      return crossedSoldiers(after.board, side).length >= pred.min;
    case 'connected-soldiers':
      return connectedSoldierPairs(after.board, side).length >= (pred.min ?? 1);
    case 'soldier-blocked': {
      const cur = track(pred.piece);
      return cur !== null && soldierBlocked(after.board, cur) === (pred.blocked ?? true);
    }
    case 'captured':
      return track(pred.piece) === null;
    case 'threat': {
      const g = SAFETY_GUARDS.advanced;
      const guard = { h: pred.h ?? g.h, k: pred.k ?? g.k, T: pred.T ?? g.T };
      const t = threatOf(after, side, guard, ctx.limits);
      if (t.status === 'not-checked') return null;
      if (!t.isThreat || !pred.created) return t.isThreat;
      const before = threatOf(ctx.before, side, guard, ctx.limits);
      return before.status === 'not-checked' ? null : !before.isThreat;
    }
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const SQUARE = /^[a-i][0-9]$/;

/**
 * Shape errors of a predicate read from JSON (empty = valid). With `before`, named pieces must stand
 * on their squares there, `attacks`/`restricts` targets must be enemy pieces and `soldier-blocked`
 * must name a soldier.
 */
export function predicateErrors(value: unknown, before?: Position, path = 'predicate'): string[] {
  if (!isObj(value)) return [`${path}: must be an object`];
  const kind = value.kind;
  if (typeof kind !== 'string' || !PREDICATE_KINDS.includes(kind as PredicateKind)) return [`${path}: unknown kind ${String(kind)}`];
  const errors: string[] = [];
  const own = before?.turn;
  const num = (key: string, required: boolean, min = 0, max = Infinity) => {
    const v = value[key];
    if (v === undefined) {
      if (required) errors.push(`${path}.${key}: required`);
    } else if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
      errors.push(`${path}.${key}: must be a number ≥ ${min}${max < Infinity ? ` and ≤ ${max}` : ''}`);
    }
  };
  const piece = (key: string, who?: 'own' | 'enemy' | 'soldier') => {
    const v = value[key];
    if (typeof v !== 'string' || !SQUARE.test(v)) {
      errors.push(`${path}.${key}: must be a square name`);
      return;
    }
    if (!before) return;
    const p = before.board[parseSquare(v)];
    if (!p) errors.push(`${path}.${key}: no piece on ${v}`);
    else if (who === 'enemy' && p.color === own) errors.push(`${path}.${key}: ${v} is not an enemy piece`);
    else if (who === 'soldier' && p.type !== 'soldier') errors.push(`${path}.${key}: ${v} is not a soldier`);
  };
  const oneOf = (...keys: string[]) => {
    if (keys.every((k) => value[k] === undefined)) errors.push(`${path}: needs one of ${keys.join(', ')}`);
  };
  switch (kind as PredicateKind) {
    case 'all':
    case 'any':
      if (!Array.isArray(value.of) || value.of.length === 0) errors.push(`${path}.of: must be a non-empty array`);
      else value.of.forEach((p, i) => errors.push(...predicateErrors(p, before, `${path}.of[${i}]`)));
      break;
    case 'not':
      errors.push(...predicateErrors(value.of, before, `${path}.of`));
      break;
    case 'mobility':
      piece('piece');
      num('min', false);
      num('increaseBy', false, 1);
      oneOf('min', 'increaseBy');
      break;
    case 'reach':
      piece('piece');
      if (!Array.isArray(value.squares) || value.squares.length === 0 || !value.squares.every((s) => typeof s === 'string' && SQUARE.test(s))) {
        errors.push(`${path}.squares: must be a non-empty array of square names`);
      }
      break;
    case 'open-file':
      piece('piece');
      num('maxBlockers', false);
      if (value.ownOnly !== undefined && typeof value.ownOnly !== 'boolean') errors.push(`${path}.ownOnly: must be a boolean`);
      break;
    case 'captured':
      piece('piece');
      break;
    case 'crossed-river':
      piece('piece');
      break;
    case 'development':
      if (value.measure !== undefined && !['developed', 'chariots-out', 'horses-out', 'free-horses', 'defenders-moved'].includes(value.measure as string)) {
        errors.push(`${path}.measure: invalid`);
      }
      num('min', false);
      num('increaseBy', false, 1);
      oneOf('min', 'increaseBy');
      break;
    case 'palace-defenders':
    case 'crossed-soldiers':
      num('min', true);
      break;
    case 'connected-soldiers':
      num('min', false, 1);
      break;
    case 'general-file':
      if (!['chariot', 'cannon', 'both'].includes(value.against as string)) errors.push(`${path}.against: must be chariot, cannon or both`);
      break;
    case 'no-hanging':
      break;
    case 'attacks':
      piece('target', 'enemy');
      break;
    case 'restricts':
      piece('target', 'enemy');
      num('reduceBy', false, 1);
      num('max', false);
      oneOf('reduceBy', 'max');
      break;
    case 'soldier-blocked':
      piece('piece', 'soldier');
      if (value.blocked !== undefined && typeof value.blocked !== 'boolean') errors.push(`${path}.blocked: must be a boolean`);
      break;
    case 'threat':
      // Runtime budget (04 §5.5): k ≤ 2 on a full board, 3 only in positions of ≤ ~12 pieces.
      num('h', false, 0, 3);
      num('k', false, 0, 3);
      num('T', false, 0);
      if (value.created !== undefined && typeof value.created !== 'boolean') errors.push(`${path}.created: must be a boolean`);
      break;
  }
  return errors;
}
