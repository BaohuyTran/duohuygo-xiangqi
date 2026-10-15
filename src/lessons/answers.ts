// Answer checking for lesson exercises. Everything is derived from the rules engine.
import {
  fileOf,
  gameStatus,
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
  type Position,
  type Square,
} from '../engine';
import type { CaptureExercise, MoveExercise, PositionSpec, Region, SelectSquaresExercise } from '../content/types';

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

/** The exact set of squares a select-squares exercise expects. */
export function expectedSelection(ex: SelectSquaresExercise): Square[] {
  if (ex.region !== undefined) return regionSquares(ex.region);
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
  | 'not-capture'
  | 'not-best';

/** Shared legality check: returns 'illegal'/'unsafe' for moves the engine rejects, otherwise null. */
export function legality(pos: Position, move: Move): MoveVerdict | null {
  const p = pos.board[move.from];
  if (!p || p.color !== pos.turn) return 'illegal';
  if (legalMovesFrom(pos, move.from).includes(move.to)) return null;
  return pseudoLegalTargets(pos.board, move.from).includes(move.to) ? 'unsafe' : 'illegal';
}

export function checkMove(ex: MoveExercise, move: Move): MoveVerdict {
  const pos = positionOf(ex);
  if (ex.from !== undefined && move.from !== parseSquare(ex.from)) return 'wrong-piece';
  const illegal = legality(pos, move);
  if (illegal) return illegal;
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
