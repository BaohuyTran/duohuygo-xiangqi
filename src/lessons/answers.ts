// Answer checking for lesson exercises. Everything is derived from the rules engine.
// Colour-neutral: the mover is always the side to move in the exercise position (`pos.turn`), so a
// Black exercise (`side: 'black'`, Black to move) is judged exactly like its Red twin.
import {
  fileOf,
  gameStatus,
  hasForcedWin,
  inPalace,
  isInCheck,
  legalMoves,
  legalMovesFrom,
  makeMove,
  onOwnSide,
  parseFen,
  parseSquare,
  positionFromPieces,
  pseudoLegalTargets,
  PIECE_VALUES,
  rankOf,
  type Move,
  type Piece,
  type Position,
  type Square,
} from '../engine';
// Only static features of src/analysis are imported here: this module is in the app's main chunk. Searches
// (and src/analysis/judge.ts) run through the lazily loaded analysis client (src/lessons/decision.ts `MoveJudge`).
import { legalAttackers } from '../analysis/features';
import type { SafetyVerdict } from '../analysis/judge';
import type { GuardSpec } from './guard';
import type { AttemptRecord } from '../progress/records';
import type { CaptureExercise, Exercise, MoveExercise, PositionSpec, Region, SelectSquaresExercise, SquareQuery } from '../content/types';

export function positionOf(spec: PositionSpec): Position {
  return spec.fen !== undefined ? parseFen(spec.fen) : positionFromPieces(spec.pieces, spec.turn ?? 'red');
}

export function regionSquares(region: Region): Square[] {
  const squares: Square[] = [];
  for (let sq = 0; sq < 90; sq++) {
    const f = fileOf(sq);
    const r = rankOf(sq);
    const inside =
      region === 'red-palace'
        ? inPalace('red', f, r)
        : region === 'black-palace'
          ? inPalace('black', f, r)
          : region === 'red-side'
            ? onOwnSide('red', r)
            : onOwnSide('black', r);
    if (inside) squares.push(sq);
  }
  return squares;
}

/**
 * Legal capture facts of the piece on `sq` (03 / 02 b06.m4: a pinned piece neither attacks nor defends):
 * `attackers` = opponent pieces with a LEGAL capture on `sq` (pins and facing Generals respected);
 * `hanging` = some such capture cannot be answered by a legal recapture on `sq` in the position after it
 * (so screens that appear or vanish with the capture count: a Cannon may lose or gain its screen).
 */
export function captureFacts(board: Position['board'], sq: Square): { attackers: Square[]; hanging: boolean } {
  const victim = board[sq];
  if (!victim) return { attackers: [], hanging: false };
  const attackers = legalAttackers(board, sq, victim.color === 'red' ? 'black' : 'red');
  const hanging = attackers.some((from) => {
    const after = board.slice();
    after[sq] = after[from];
    after[from] = null;
    return legalAttackers(after, sq, victim.color).length === 0;
  });
  return { attackers, hanging };
}

/**
 * The points a `select-squares` query asks for (see `SquareQuery` in src/content/types.ts), computed from
 * the position with LEGAL captures only (pins, facing Generals and cannon screens as they really are).
 * Sorted by square index.
 */
export function querySquares(pos: Position, query: SquareQuery): Square[] {
  const board = pos.board;
  const pieces = (side: 'red' | 'black') =>
    board.flatMap((p, sq) => (p && p.color === side && p.type !== 'general' ? [sq] : []));
  switch (query.kind) {
    case 'attacked-by': {
      const enemy: Piece['color'] = query.side === 'red' ? 'black' : 'red';
      const out: Square[] = [];
      for (let sq = 0; sq < board.length; sq++) {
        if (board[sq]?.color === query.side) continue;
        // An empty point counts when the side could legally capture an enemy piece standing there.
        const probe = board[sq] ? board : board.map((p, i): Piece | null => (i === sq ? { color: enemy, type: 'soldier' } : p));
        if (legalAttackers(probe, sq, query.side).length > 0) out.push(sq);
      }
      return out;
    }
    case 'attacked-pieces':
      return pieces(query.side).filter((sq) => captureFacts(board, sq).attackers.length > 0);
    case 'hanging':
      return pieces(query.side).filter((sq) => captureFacts(board, sq).hanging);
    case 'can-capture': {
      const target = parseSquare(query.target);
      const victim = board[target];
      if (!victim) return [];
      return legalAttackers(board, target, victim.color === 'red' ? 'black' : 'red').sort((a, b) => a - b);
    }
    case 'point':
      return [parseSquare(query.square)];
  }
}

/** The exact set of squares a select-squares exercise expects. */
export function expectedSelection(ex: SelectSquaresExercise): Square[] {
  if (ex.region !== undefined) return regionSquares(ex.region);
  if (ex.query !== undefined) return querySquares(positionOf(ex), ex.query);
  return legalMovesFrom(positionOf(ex), parseSquare(ex.square)).sort((a, b) => a - b);
}

export interface SelectionResult {
  correct: boolean;
  missed: Square[];
  wrong: Square[];
}

export function checkSelection(ex: SelectSquaresExercise, picked: Iterable<Square>): SelectionResult {
  const expected = new Set(expectedSelection(ex));
  const pickedSet = new Set(picked);
  const missed = [...expected].filter((sq) => !pickedSet.has(sq));
  const wrong = [...pickedSet].filter((sq) => !expected.has(sq));
  return { correct: missed.length === 0 && wrong.length === 0, missed, wrong };
}

export type MoveVerdict =
  | 'correct'
  /** The piece cannot move like that at all. */
  | 'illegal'
  /** The piece moves like that, but it would leave (or put) the General in danger. */
  | 'unsafe'
  | 'wrong-piece'
  | 'wrong-target'
  | 'not-check'
  | 'not-checkmate'
  /** The move leaves the opponent a forced checkmate (in `goal.depth`, default one). */
  | 'allows-mate'
  | 'not-capture'
  | 'not-best'
  /** Goal `safe`: the move lets the opponent win material (≥ T within the horizon) that another move keeps. */
  | 'loses-material'
  /** Goal `safe`: a node limit stopped the guard. Never a penalty (04-architecture.md §5.4). */
  | 'not-checked';

/** Verdict of the safety guard as a move verdict. */
export function safetyVerdict(v: SafetyVerdict): MoveVerdict {
  if (v.status === 'not-checked') return 'not-checked';
  if (v.allowedMate) return 'allows-mate';
  return v.allowedLoss ? 'loses-material' : 'correct';
}

/** Shared legality check: returns 'illegal'/'unsafe' for moves the engine rejects, otherwise null. */
export function legality(pos: Position, move: Move): MoveVerdict | null {
  const p = pos.board[move.from];
  if (!p || p.color !== pos.turn) return 'illegal';
  if (legalMovesFrom(pos, move.from).includes(move.to)) return null;
  return pseudoLegalTargets(pos.board, move.from).includes(move.to) ? 'unsafe' : 'illegal';
}

/** The safety guard of goal `safe` (a node-limited search), injected so this module needs no search code. */
export type SafetyCheck = (pos: Position, move: Move, guard: GuardSpec) => SafetyVerdict;

/**
 * Judges a move. Goal `safe` needs `safety` (the validator and tests pass `syncSafety()` from
 * ./decision-table.ts); without it the verdict is 'not-checked'. The player judges `safe` through
 * `MoveJudge` (./decision.ts) and the analysis client instead.
 */
/** checkMove's checks before the goal: the fixed piece (`from`), then legality. Null when the goal decides. */
export function movePrecheck(ex: MoveExercise, move: Move, pos: Position = positionOf(ex)): MoveVerdict | null {
  if (ex.from !== undefined && move.from !== parseSquare(ex.from)) return 'wrong-piece';
  return legality(pos, move);
}

export function checkMove(ex: MoveExercise, move: Move, safety?: SafetyCheck): MoveVerdict {
  const pos = positionOf(ex);
  const pre = movePrecheck(ex, move, pos);
  if (pre) return pre;
  const after = makeMove(pos, move);
  switch (ex.goal.kind) {
    case 'any':
      return 'correct';
    case 'reach':
      return ex.goal.squares.map(parseSquare).includes(move.to) ? 'correct' : 'wrong-target';
    case 'check':
      return isInCheck(after) ? 'correct' : 'not-check';
    case 'checkmate':
      return gameStatus(after).kind === 'checkmate' ? 'correct' : 'not-checkmate';
    case 'defend':
      return hasForcedWin(after, ex.goal.depth ?? 1) ? 'allows-mate' : 'correct';
    case 'safe':
      return safety ? safetyVerdict(safety(pos, move, { itemId: ex.id, override: ex.goal.guard })) : 'not-checked';
  }
}

export { PIECE_VALUES } from '../engine';

/** Value captured minus the value of the capturing piece if the opponent can take it back at once. */
export function captureGain(pos: Position, move: Move): number {
  const captured = pos.board[move.to];
  const mover = pos.board[move.from];
  if (!captured || !mover) return 0;
  const after = makeMove(pos, move);
  const recapture = legalMoves(after).some((m) => m.to === move.to);
  return PIECE_VALUES[captured.type] - (recapture ? PIECE_VALUES[mover.type] : 0);
}

/** Best material gain among all legal captures (0 if no capture gains material). */
export function bestCaptureGain(pos: Position): number {
  return legalMoves(pos)
    .filter((m) => pos.board[m.to])
    .reduce((best, m) => Math.max(best, captureGain(pos, m)), 0);
}

export function checkCapture(ex: CaptureExercise, move: Move): MoveVerdict {
  const pos = positionOf(ex);
  const illegal = legality(pos, move);
  if (illegal) return illegal;
  if (!pos.board[move.to]) return 'not-capture';
  const gain = captureGain(pos, move);
  return gain > 0 && gain >= bestCaptureGain(pos) ? 'correct' : 'not-best';
}

// ---------- Attempt events (03-assessment.md §3.1; persisted by S2.10/S2.13) ----------

/** Hint ladder steps (02-curriculum.md §5.2): 1 the idea, 2 the piece, 3 the move. */
export const HINT_STEPS = ['idea', 'piece', 'move'] as const;
export type HintStep = (typeof HINT_STEPS)[number];

/** What the player tracked while one item was answered. */
export interface ItemAttempt {
  /** Wrong answers (each one also cost a heart where hearts apply). */
  wrong: number;
  /** Hint ladder steps taken. */
  hints: number;
  hintStep?: HintStep;
  /** A hint was taken before the first answer: the first answer is not independent (03 §3.2). */
  hintBeforeFirstAnswer: boolean;
  /** Credit of the FIRST answer, 0–1 (null until answered). */
  firstCredit: number | null;
  /** Misconception tag of the first wrong answer. */
  misconception?: string;
  /** Shuffle seed of a `choice`. */
  seed?: number;
  /**
   * The first answer could not be checked (a node limit or the safety net stopped the analysis): the record is
   * voided — no credit and no penalty (04-architecture.md §5.4, 03-assessment.md §3.2) — and scoring skips it.
   */
  voided?: boolean;
}

export const emptyAttempt = (): ItemAttempt => ({ wrong: 0, hints: 0, hintBeforeFirstAnswer: false, firstCredit: null });

/**
 * The attempt record of a finished item, or null for items without an id/version (legacy content) and
 * `learn` cards. `credit` is the first answer's credit; hints are recorded beside it, never folded in.
 */
export function attemptRecord(
  ex: Exercise,
  attempt: ItemAttempt,
  mode: AttemptRecord['mode'],
  at: Date,
): AttemptRecord | null {
  if (ex.type === 'learn' || ex.id === undefined || ex.version === undefined) return null;
  const record: AttemptRecord = {
    itemId: ex.id,
    itemVersion: ex.version,
    mode,
    at: at.toISOString(),
    colour: ex.side ?? 'red',
    credit: attempt.firstCredit ?? 0,
    hints: attempt.hints,
    attemptsBeforeSuccess: attempt.wrong,
  };
  if (attempt.hintStep) record.hintStep = attempt.hintStep;
  if (attempt.hintBeforeFirstAnswer) record.hintBeforeFirstAnswer = true;
  if (attempt.seed !== undefined) record.seed = attempt.seed;
  if (attempt.voided) record.voided = true;
  if (attempt.misconception) record.misconception = attempt.misconception;
  return record;
}
