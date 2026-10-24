// The app training ruleset (design/03-assessment.md §5.5, §8.3; 04 §5.7). The engine knows legal
// moves, check, mate and stalemate; repetition, move caps and the material rule live here.
//
// `adjudicate(record, ruleset)` runs after every move and returns the outcome when the game or task
// ends, else null. In order:
//   1. Checkmate / stalemate (the side to move loses).
//   2. Repetition, at the third occurrence of a position key (board + side to move):
//      (1) one side gave check on every one of its moves in the cycle and the other did not → the
//          checking side loses (perpetual check; a simplification of the official rules, disclosed);
//      (2) both or neither checked → draw. Perpetual CHASE is not adjudicated: a chase cycle is just
//          "neither checked" → draw (disclosed). The cycle is the repeated sequence: the moves between
//          the LAST TWO occurrences of the key (the second and the third). Moves before the repetition
//          began (e.g. a quiet move before a series of checks) do not count. A side "perpetually
//          checks" when every one of its moves in that cycle gave check.
//   3. Task cap (`{ kind: 'task', cap }`): after the learner's cap-th move the task ends, no result.
//   4. Full games (`{ kind: 'full-game' }`): after the learner's 80th move, or after 30 consecutive
//      learner moves without a capture by either side, the SAME material rule decides: the
//      quiescence-resolved lead ≥ 4 with no forced mate against the leader within 2 → training win
//      for the leader, else training draw.
//
// The learner may not create a third occurrence (`checkLearnerMove`) unless it is the only legal
// move, every other legal move fails the level's safety guard, or the repetition would be judged
// perpetual check AGAINST the opponent (the refusal only exists to stop chase exploits; a learner
// being perpetually checked must be able to claim the win, as under AXF the checking side must
// deviate). The partners avoid third occurrences in policies.ts (including one that would make the
// partner win by the learner's perpetual check: acceptable, it favours the learner). A learner's own
// perpetual check is therefore punished only through the learner's own third occurrence, which is
// allowed only by the only-move / all-alternatives-fail-guard exceptions; the UI (S2.12) should warn
// before accepting such a move when `losesByRepetition` is true.
import { positionKey, search } from '../analysis';
import type { SafetyGuard } from '../analysis';
import { isChecked, type RequestLimits } from '../analysis/requests';
import { gameStatus, hasForcedWin, legalMoves, makeMove, opposite } from '../engine';
import type { Color, Move, Position } from '../engine';
import type { Analyzer } from './policies';
import {
  appendMove,
  currentPosition,
  keysOf,
  learnerMoveCount,
  learnerMovesSinceCapture,
  sideOfMove,
  type GameRecord,
} from './record';

/** Full games stop after this many learner moves (03 §5.5). */
export const FULL_GAME_CAP = 80;
/** … or after this many consecutive learner moves without a capture by either side. */
export const NO_CAPTURE_LIMIT = 30;
/** Quiescence-resolved material lead that wins a stopped full game (a Horse or more). */
export const ADJUDICATION_LEAD = 4;
/** A forced mate against the leader within this many moves turns the stop into a draw. */
export const ADJUDICATION_MATE_DEPTH = 2;
/** Node cap of the quiescence search of the material rule (bounded anyway by its 8-ply cap). */
export const ADJUDICATION_MAX_NODES = 500_000;

export type Ruleset =
  /** A practical task: ends with no result after the learner's `cap`-th move. */
  | { readonly kind: 'task'; readonly cap: number }
  /** A full game (b10, `xb`, `pb-g*`): 80-move cap and 30-move no-capture limit, material rule. */
  | { readonly kind: 'full-game'; readonly cap?: number; readonly noCaptureLimit?: number };

export type OutcomeReason =
  | 'checkmate'
  | 'stalemate'
  /** Repetition rule (1): the side that checked on every move of the cycle loses. */
  | 'perpetual-check'
  /** Repetition rule (2): both or neither side checked throughout (a chase is not adjudicated). */
  | 'repetition-draw'
  /** Task move cap: no result; the rubrics score the position reached. */
  | 'task-cap'
  /** Full game: 80 learner moves (material rule). */
  | 'move-cap'
  /** Full game: 30 learner moves without a capture (material rule). */
  | 'no-capture';

export interface MaterialVerdict {
  /** The training winner, or null (training draw). */
  readonly winner: Color | null;
  /** Quiescence-resolved material lead of Red (negative: Black leads). */
  readonly redLead: number;
  /** The side leading by ≥ ADJUDICATION_LEAD, if any. */
  readonly leader: Color | null;
  /** The trailing side had a forced mate within ADJUDICATION_MATE_DEPTH against the leader. */
  readonly mateAgainstLeader: boolean;
  /** False when the node cap stopped the quiescence search (the static count was used). */
  readonly complete: boolean;
}

export interface Outcome {
  readonly reason: OutcomeReason;
  /** 'none' = the task ended without a result (task cap). */
  readonly result: 'win' | 'draw' | 'none';
  readonly winner: Color | null;
  /** A training result (repetition rule, move cap, no-capture limit), not an official rule. */
  readonly training: boolean;
  /** Repetition: the side(s) that checked on every move of the cycle. */
  readonly checkers?: readonly Color[];
  /** Full-game stops: the material verdict. */
  readonly material?: MaterialVerdict;
}

/**
 * 03 §5.5 material rule at a full-game stop. The lead is `search(pos, depth 0)` (capture quiescence,
 * same rules as the engine's material search) from Red's view. A forced mate against the leader
 * within 2 means: the trailing side to move has `hasForcedWin(pos, 2)`; the leader to move has no
 * move that escapes such a mate.
 *
 * Cost: the mate checks are the engine's exhaustive `hasForcedWin` (not node-limited); with the leader
 * to move it runs once per leader move. It runs once per game, at the stop, but on a busy board it can
 * take a noticeable time: S2.12 should call it from the Worker (or after a "Checking…" pause), not
 * synchronously in a UI handler.
 */
export function materialAdjudication(pos: Position, options: { readonly maxNodes?: number } = {}): MaterialVerdict {
  const r = search(pos, { depth: 0, maxNodes: options.maxNodes ?? ADJUDICATION_MAX_NODES });
  const redLead = pos.turn === 'red' ? r.score : -r.score;
  const leader: Color | null = redLead >= ADJUDICATION_LEAD ? 'red' : redLead <= -ADJUDICATION_LEAD ? 'black' : null;
  let mateAgainstLeader = false;
  if (leader) {
    if (pos.turn !== leader) {
      mateAgainstLeader = hasForcedWin(pos, ADJUDICATION_MATE_DEPTH);
    } else {
      const moves = legalMoves(pos);
      mateAgainstLeader = moves.length > 0 && moves.every((m) => hasForcedWin(makeMove(pos, m), ADJUDICATION_MATE_DEPTH));
    }
  }
  return {
    winner: leader && !mateAgainstLeader ? leader : null,
    redLead,
    leader,
    mateAgainstLeader,
    complete: r.complete,
  };
}

/**
 * The repetition rule at the LAST move of the record: null unless the current position is the third
 * (or later) occurrence of its key.
 */
export function repetitionOutcome(record: GameRecord): Outcome | null {
  const keys = keysOf(record);
  const last = keys.length - 1;
  const key = keys[last];
  const occurrences: number[] = [];
  for (let i = 0; i <= last; i++) if (keys[i] === key) occurrences.push(i);
  if (occurrences.length < 3) return null;
  // Moves of the cycle: between the last two occurrences (position indices p and last), i.e. moves p … last − 1.
  const from = occurrences[occurrences.length - 2];
  const allChecks: Record<Color, boolean> = { red: true, black: true };
  const moved: Record<Color, boolean> = { red: false, black: false };
  for (let i = from; i < last; i++) {
    const side = sideOfMove(record, i);
    moved[side] = true;
    if (!record.moves[i].check) allChecks[side] = false;
  }
  const checkers = (['red', 'black'] as const).filter((c) => moved[c] && allChecks[c]);
  if (checkers.length === 1) {
    return { reason: 'perpetual-check', result: 'win', winner: opposite(checkers[0]), training: true, checkers };
  }
  return { reason: 'repetition-draw', result: 'draw', winner: null, training: true, checkers };
}

/** The outcome after the last move of `record`, or null while the game goes on. */
export function adjudicate(record: GameRecord, ruleset: Ruleset, options: { readonly maxNodes?: number } = {}): Outcome | null {
  const pos = currentPosition(record);
  const status = gameStatus(pos);
  if (status.kind === 'checkmate' || status.kind === 'stalemate') {
    return { reason: status.kind, result: 'win', winner: status.winner, training: false };
  }
  const repetition = repetitionOutcome(record);
  if (repetition) return repetition;
  if (ruleset.kind === 'task') {
    return learnerMoveCount(record) >= ruleset.cap ? { reason: 'task-cap', result: 'none', winner: null, training: false } : null;
  }
  const cap = ruleset.cap ?? FULL_GAME_CAP;
  const noCapture = ruleset.noCaptureLimit ?? NO_CAPTURE_LIMIT;
  const reason: OutcomeReason | null =
    learnerMoveCount(record) >= cap ? 'move-cap' : learnerMovesSinceCapture(record) >= noCapture ? 'no-capture' : null;
  if (!reason) return null;
  const material = materialAdjudication(pos, options);
  return { reason, result: material.winner ? 'win' : 'draw', winner: material.winner, training: true, material };
}

/** True when playing `move` now would create the third (or later) occurrence of a position. */
export function createsThirdOccurrence(record: GameRecord, move: Move, position: Position = currentPosition(record)): boolean {
  const key = positionKey(makeMove(position, move));
  let n = 0;
  for (const k of keysOf(record)) if (k === key) n++;
  return n >= 2;
}

/** The repetition outcome `move` would cause now (null when it creates no third occurrence). */
export function repetitionAfter(record: GameRecord, move: Move, position: Position = currentPosition(record)): Outcome | null {
  if (!createsThirdOccurrence(record, move, position)) return null;
  return repetitionOutcome(appendMove(record, move, { position }));
}

/**
 * True when `move` would end the game as a loss for its own side under the repetition rule
 * (perpetual check at the third occurrence). Partners never play such a move unless forced.
 */
export function losesByRepetition(record: GameRecord, move: Move, position: Position = currentPosition(record)): boolean {
  const out = repetitionAfter(record, move, position);
  return out?.reason === 'perpetual-check' && out.winner === opposite(position.turn);
}

/** True when `move` would end the game as a WIN for its own side: the opponent checked perpetually. */
export function winsByRepetition(record: GameRecord, move: Move, position: Position = currentPosition(record)): boolean {
  const out = repetitionAfter(record, move, position);
  return out?.reason === 'perpetual-check' && out.winner === position.turn;
}

// ---------- The learner's third-repetition refusal (03 §5.5) ----------

export type LearnerMoveVerdict =
  | {
      readonly allowed: true;
      /**
       * Why a third occurrence was allowed; absent when the move creates none.
       * 'opponent-perpetual-check': the repetition is adjudicated as perpetual check by the opponent
       * (the learner wins); 'only-move' / 'all-alternatives-fail-guard': the 03 §5.5 exceptions.
       */
      readonly exception?: 'opponent-perpetual-check' | 'only-move' | 'all-alternatives-fail-guard';
    }
  | {
      readonly allowed: false;
      readonly reason: 'third-repetition';
      /** An alternative that passed the guard (null when none was proven, see `notChecked`). */
      readonly alternative: Move | null;
      /** Some alternative's guard verdict was 'not-checked' (none was proven safe or unsafe). */
      readonly notChecked: boolean;
    }
  /** The analysis was cancelled (`signal`); nothing was decided. */
  | { readonly allowed: false; readonly reason: 'cancelled' };

/** null when `move` creates no third occurrence; else the other legal moves (engine order). */
export function repetitionAlternatives(record: GameRecord, move: Move): Move[] | null {
  const pos = currentPosition(record);
  if (!createsThirdOccurrence(record, move, pos)) return null;
  return legalMoves(pos).filter((m) => m.from !== move.from || m.to !== move.to);
}

/**
 * The learner may not play a move that creates a third occurrence unless the repetition would be
 * adjudicated as perpetual check by the opponent (the learner wins; checked first, no analysis), it
 * is the only legal move, or every other legal move fails the level's safety guard (03 §5.5). Alternatives are checked in
 * engine order through the analyzer (safety-guard requests) until one passes. An alternative whose
 * verdict is 'not-checked' is not proven to fail, so the move stays refused (interpretation:
 * the refusal costs nothing and keeps the chase exploit closed); `notChecked` reports it.
 */
export async function checkLearnerMove(
  record: GameRecord,
  move: Move,
  analyzer: Analyzer,
  guard: SafetyGuard,
  options: { readonly limits?: RequestLimits; readonly signal?: AbortSignal } = {},
): Promise<LearnerMoveVerdict> {
  const alternatives = repetitionAlternatives(record, move);
  if (alternatives === null) return { allowed: true };
  if (winsByRepetition(record, move)) return { allowed: true, exception: 'opponent-perpetual-check' };
  if (alternatives.length === 0) return { allowed: true, exception: 'only-move' };
  const position = currentPosition(record);
  let notChecked = false;
  for (const alt of alternatives) {
    const outcome = await analyzer.run(
      { kind: 'safety-guard', position, move: alt, guard, ...(options.limits ? { limits: options.limits } : {}) },
      options.signal ? { signal: options.signal } : undefined,
    );
    if (!isChecked(outcome)) {
      if (outcome.reason === 'cancelled') return { allowed: false, reason: 'cancelled' };
      notChecked = true;
      continue;
    }
    if (outcome.value.safe) return { allowed: false, reason: 'third-repetition', alternative: alt, notChecked };
  }
  if (notChecked) return { allowed: false, reason: 'third-repetition', alternative: null, notChecked };
  return { allowed: true, exception: 'all-alternatives-fail-guard' };
}
