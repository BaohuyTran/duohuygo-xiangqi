// Small dev-time and runtime search built on the rules engine: forced wins (mate-in-N) and a
// depth-limited material search. It never changes rules; it only combines pseudoLegalTargets and
// isGeneralAttacked, playing moves on a scratch copy of the board.
import { opposite } from './board';
import { isGeneralAttacked, pseudoLegalTargets } from './movegen';
import type { Board, Color, Move, PieceType, Position } from './types';

/** Conventional beginner piece values. The general is priceless; it is never captured in legal play. */
export const PIECE_VALUES: Record<PieceType, number> = {
  general: 1000,
  chariot: 9,
  cannon: 4.5,
  horse: 4,
  advisor: 2,
  elephant: 2,
  soldier: 1,
};

/** Score for the side to move when it has no legal moves (checkmated or stalemated: a loss). */
export const MATE_SCORE = 100_000;

/** Calls `visit` for every legal move of `turn`, with the move already played on `board`. */
function forEachLegal(board: Board, turn: Color, visit: (from: number, to: number) => boolean | void): void {
  for (let from = 0; from < board.length; from++) {
    const p = board[from];
    if (!p || p.color !== turn) continue;
    for (const to of pseudoLegalTargets(board, from)) {
      const captured = board[to];
      board[to] = p;
      board[from] = null;
      const stop = !isGeneralAttacked(board, turn) && visit(from, to) === true;
      board[from] = p;
      board[to] = captured;
      if (stop) return;
    }
  }
}

function hasLegalMove(board: Board, turn: Color): boolean {
  let found = false;
  forEachLegal(board, turn, () => (found = true));
  return found;
}

/**
 * True when `turn` can force the opponent to have no legal moves (checkmate, or stalemate, which
 * also loses in Xiangqi) within `n` of its own moves, against any defence.
 */
function canForceWin(board: Board, turn: Color, n: number): boolean {
  const enemy = opposite(turn);
  let wins = false;
  forEachLegal(board, turn, () => {
    wins = winsAfterMove(board, enemy, n);
    return wins;
  });
  return wins;
}

/** After the attacker has just moved: does every defence lose within n - 1 further attacker moves? */
function winsAfterMove(board: Board, defender: Color, n: number): boolean {
  if (!hasLegalMove(board, defender)) return true;
  if (n <= 1) return false;
  let refuted = false;
  forEachLegal(board, defender, () => {
    refuted = !canForceWin(board, opposite(defender), n - 1);
    return refuted;
  });
  return !refuted;
}

/** Every first move that forces a win within `n` moves of the side to move. */
export function forcedWinMoves(pos: Position, n: number): Move[] {
  const board = pos.board.slice();
  const moves: Move[] = [];
  forEachLegal(board, pos.turn, (from, to) => {
    if (winsAfterMove(board, opposite(pos.turn), n)) moves.push({ from, to });
  });
  return moves;
}

export function hasForcedWin(pos: Position, n: number): boolean {
  return canForceWin(pos.board.slice(), pos.turn, n);
}

/** Material of `color` minus the opponent's (generals excluded). */
export function materialBalance(board: Board, color: Color): number {
  let sum = 0;
  for (const p of board) {
    if (!p || p.type === 'general') continue;
    sum += p.color === color ? PIECE_VALUES[p.type] : -PIECE_VALUES[p.type];
  }
  return sum;
}

const QUIESCENCE_LIMIT = 8;

function legalMoveList(board: Board, turn: Color): Move[] {
  const moves: Move[] = [];
  forEachLegal(board, turn, (from, to) => void moves.push({ from, to }));
  return moves;
}

/** Most valuable victim first, so alpha-beta cuts more. */
function orderMoves(board: Board, moves: Move[]): Move[] {
  const victim = (m: Move) => {
    const p = board[m.to];
    return p ? PIECE_VALUES[p.type] * 10 - PIECE_VALUES[board[m.from]!.type] / 10 : 0;
  };
  return moves.sort((a, b) => victim(b) - victim(a));
}

function play(board: Board, m: Move, then: () => number): number {
  const p = board[m.from];
  const captured = board[m.to];
  board[m.to] = p;
  board[m.from] = null;
  const score = then();
  board[m.from] = p;
  board[m.to] = captured;
  return score;
}

function quiesce(board: Board, turn: Color, alpha: number, beta: number, ply: number, qdepth: number): number {
  const all = legalMoveList(board, turn);
  if (all.length === 0) return -MATE_SCORE + ply;
  const inCheck = isGeneralAttacked(board, turn);
  let best = -Infinity;
  if (!inCheck) {
    best = materialBalance(board, turn);
    if (best >= beta || qdepth >= QUIESCENCE_LIMIT) return best;
    alpha = Math.max(alpha, best);
  } else if (qdepth >= QUIESCENCE_LIMIT) {
    return materialBalance(board, turn);
  }
  // In check every evasion is searched; otherwise only captures.
  const moves = orderMoves(board, inCheck ? all : all.filter((m) => board[m.to] !== null));
  for (const m of moves) {
    const score = -play(board, m, () => quiesce(board, opposite(turn), -beta, -alpha, ply + 1, qdepth + 1));
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

function negamax(board: Board, turn: Color, depth: number, alpha: number, beta: number, ply: number): number {
  if (depth <= 0) return quiesce(board, turn, alpha, beta, ply, 0);
  const moves = orderMoves(board, legalMoveList(board, turn));
  if (moves.length === 0) return -MATE_SCORE + ply;
  let best = -Infinity;
  for (const m of moves) {
    const score = -play(board, m, () => negamax(board, opposite(turn), depth - 1, -beta, -alpha, ply + 1));
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * Search score for the side to move: material balance expected after `depth` plies plus a capture
 * quiescence search, or about ±MATE_SCORE for a forced win/loss inside the horizon.
 */
export function searchScore(pos: Position, depth: number): number {
  return negamax(pos.board.slice(), pos.turn, depth, -Infinity, Infinity, 0);
}

/** Score of `move` for the side playing it: the opponent's search score after it, negated. */
export function moveScore(pos: Position, move: Move, depth: number): number {
  const board = pos.board.slice();
  return -play(board, move, () => negamax(board, opposite(pos.turn), depth - 1, -Infinity, Infinity, 1));
}

/** True when a score means a forced checkmate/stalemate was found inside the search horizon. */
export const isWinScore = (score: number): boolean => score > MATE_SCORE / 2;
