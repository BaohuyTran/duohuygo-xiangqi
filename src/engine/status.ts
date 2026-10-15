import { opposite } from './board';
import { isGeneralAttacked, legalMoves } from './movegen';
import type { GameStatus, Position } from './types';

/** True when the side to move is in check. */
export function isInCheck(pos: Position): boolean {
  return isGeneralAttacked(pos.board, pos.turn);
}

/**
 * Check, checkmate or stalemate for the side to move. Unlike western chess, a side with no legal
 * moves loses even when not in check. Repetition and perpetual check/chase are not handled.
 */
export function gameStatus(pos: Position): GameStatus {
  const inCheck = isInCheck(pos);
  if (legalMoves(pos).length > 0) return { kind: inCheck ? 'check' : 'ongoing' };
  const winner = opposite(pos.turn);
  return inCheck ? { kind: 'checkmate', winner } : { kind: 'stalemate', winner };
}
