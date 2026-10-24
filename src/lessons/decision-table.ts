// Move tables at authoring time (04-architecture.md §5.3): the rule for `computed` rows, the table proposer
// (scripts/move-table.ts), the synchronous `safe` check and refutation. Runs src/analysis synchronously, so it
// is for the validator (src/content/validate.ts), scripts and tests ONLY: screens judge through
// `MoveJudge` (./decision.ts) and the analysis client, never by importing this file.
import { evaluatePredicate, moveSignals, safetyGuard, search, type JudgeLimits, type Predicate, type SafetyGuard } from '../analysis';
import { forcedWinMoves, hasForcedWin, isInCheck, legalMoves, makeMove, squareName, type Move, type Position } from '../engine';
import type { MoveClass, MoveTableEntry } from '../content/types';
import { safetyVerdict, type SafetyCheck } from './answers';
import { isAccepted, moveKey, type MoveJudge, type Refutation } from './decision';
import { resolveGuard } from './guard';

/** Node limit per search when tables are computed (authoring time and the validator; deterministic). */
export const TABLE_MAX_NODES = 200_000;

/** Runtime-sized node limit (04 §5.5), for the synchronous `safe` check of the validator and tests. */
const RUNTIME_LIMITS: JudgeLimits = { maxNodes: 20_000 };

/** The synchronous safety guard for `checkMove` (goal `safe`) in the validator and tests. */
export const syncSafety =
  (limits: JudgeLimits = RUNTIME_LIMITS): SafetyCheck =>
  (pos, move, spec) =>
    safetyGuard(pos, move, resolveGuard(spec), limits);

export interface ComputedClass {
  /** The computed class, or 'not-checked' when a node limit stopped the guard or the objective. */
  readonly class: Exclude<MoveClass, 'sound'> | 'not-checked';
  readonly guard: ReturnType<typeof safetyGuard>;
  /** Objective result (null: no objective, or not checked). */
  readonly objective: boolean | null;
}

/**
 * The rule for `computed` rows: guard not passed -> `error`; objective met -> `target`; otherwise `dubious`.
 * (`sound` is a judgement and only ever authored.)
 */
export function computeMoveClass(
  pos: Position,
  move: Move,
  guard: SafetyGuard,
  objective: Predicate | undefined,
  limits: JudgeLimits = { maxNodes: TABLE_MAX_NODES },
): ComputedClass {
  const verdict = safetyGuard(pos, move, guard, limits);
  if (verdict.status === 'not-checked') return { class: 'not-checked', guard: verdict, objective: null };
  if (!verdict.safe) return { class: 'error', guard: verdict, objective: null };
  if (objective === undefined) return { class: 'dubious', guard: verdict, objective: null };
  const met = evaluatePredicate(objective, { before: pos, moves: [move], limits });
  if (met === null) return { class: 'not-checked', guard: verdict, objective: null };
  return { class: met ? 'target' : 'dubious', guard: verdict, objective: met };
}

/** Facts the author should look at before leaving a row `computed` (04 §5.3 "tempting" moves). */
export interface ProposedRow extends MoveTableEntry {
  readonly notes: {
    readonly capture: boolean;
    readonly check: boolean;
    /** Material loss L(m) = B − S(m) when the guard reports an allowed loss. */
    readonly loss: number | null;
    readonly allowsMate: boolean;
    /** Own pieces left hanging / en prise after the move (static; reported, not decisive). */
    readonly enPrise: readonly string[];
    readonly objective: boolean | null;
    /** The move misses a gain ≥ T (or, from Basic, a free capture) that another move takes (03 §5.3; null: not checked). */
    readonly missedGain: boolean | null;
    /** The position had a forced mate within the level's missed-mate depth and this move gives it up. */
    readonly missedMate: boolean | null;
    /** A node limit stopped the guard or the objective: the validator will refuse this position. */
    readonly notChecked: boolean;
    /** The author must decide this row: accepted, a capture or a check, or not checkable. */
    readonly review: boolean;
  };
}

/**
 * Proposes a complete table for `pos` (every legal move once, in move-generation order), all rows
 * `computed`. Rows that need the author's decision have `notes.review`. Used by scripts/move-table.ts.
 */
export function proposeMoveTable(pos: Position, guard: SafetyGuard, objective?: Predicate, limits?: JudgeLimits): ProposedRow[] {
  return legalMoves(pos).map((move) => {
    const c = computeMoveClass(pos, move, guard, objective, limits);
    const capture = pos.board[move.to] !== null;
    const check = isInCheck(makeMove(pos, move));
    const cls: MoveClass = c.class === 'not-checked' ? 'dubious' : c.class;
    const missed = moveSignals(pos, move, guard, { maxNodes: limits?.maxNodes ?? TABLE_MAX_NODES });
    const checked = missed.status === 'checked';
    return {
      move: moveKey(move),
      class: cls,
      source: 'computed',
      notes: {
        capture,
        check,
        loss: c.guard.allowedLoss && !c.guard.allowedLoss.mate ? c.guard.allowedLoss.loss : null,
        allowsMate: c.guard.allowedMate || Boolean(c.guard.allowedLoss?.mate),
        enPrise: c.guard.enPrise.map(squareName),
        objective: c.objective,
        missedGain: checked ? missed.missedGain : null,
        missedMate: checked ? missed.missedMate : null,
        notChecked: c.class === 'not-checked',
        review: c.class === 'not-checked' || isAccepted(cls) || capture || check,
      },
    };
  });
}

/**
 * The refutation computed synchronously (same rule as `clientJudge`). Only when the safety guard fails: the
 * mating reply (forced mate within k), else the first move of the best reply line that wins the material.
 * A move that passes the guard (e.g. an authored `error` beyond the horizon) gets no engine claim.
 */
export function refutationOf(pos: Position, move: Move, guard: SafetyGuard, limits: JudgeLimits = RUNTIME_LIMITS): Refutation {
  const none: Refutation = { reply: null, kind: null };
  const verdict = safetyGuard(pos, move, guard, limits);
  if (verdict.status !== 'checked' || verdict.safe) return none;
  const after = makeMove(pos, move);
  if (verdict.allowedMate) {
    for (let n = 1; n <= Math.max(1, guard.k); n++) {
      if (hasForcedWin(after, n)) return { reply: forcedWinMoves(after, n)[0] ?? null, kind: 'mate' };
    }
  }
  const r = search(after, { depth: Math.max(1, guard.h), ...limits });
  if (!r.complete || !r.pv[0]) return none;
  return { reply: r.pv[0], kind: verdict.allowedMate || verdict.allowedLoss?.mate ? 'mate' : 'material' };
}

/** Main-thread `MoveJudge` for tests that want full verdicts without a client. */
export const syncJudge: MoveJudge = {
  safety: (pos, move, spec) => Promise.resolve(safetyVerdict(safetyGuard(pos, move, resolveGuard(spec), RUNTIME_LIMITS))),
  refutation: (pos, move, spec) => Promise.resolve(refutationOf(pos, move, resolveGuard(spec))),
};
