import { legalMovesFrom, parseSquare, positionFromPieces, squareName } from './index';
import type { Color } from './types';

/** Sorted legal destination names for the piece on `from` in a position built from a piece map. */
export function targets(pieces: Record<string, string>, from: string, turn: Color = 'red'): string[] {
  const pos = positionFromPieces(pieces, turn);
  return legalMovesFrom(pos, parseSquare(from)).map(squareName).sort();
}
