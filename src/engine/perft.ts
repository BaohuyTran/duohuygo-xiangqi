import { opposite } from './board';
import { isGeneralAttacked, pseudoLegalTargets } from './movegen';
import type { Board, Color, Position } from './types';

/** Counts leaf nodes of the legal move tree to `depth` plies. Used to validate move generation. */
export function perft(pos: Position, depth: number): number {
  return depth <= 0 ? 1 : count(pos.board.slice(), pos.turn, depth);
}

function count(board: Board, turn: Color, depth: number): number {
  let nodes = 0;
  for (let from = 0; from < board.length; from++) {
    const p = board[from];
    if (!p || p.color !== turn) continue;
    for (const to of pseudoLegalTargets(board, from)) {
      const captured = board[to];
      board[to] = p;
      board[from] = null;
      if (!isGeneralAttacked(board, turn)) nodes += depth === 1 ? 1 : count(board, opposite(turn), depth - 1);
      board[from] = p;
      board[to] = captured;
    }
  }
  return nodes;
}
