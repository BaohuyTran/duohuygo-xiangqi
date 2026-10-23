// Piece-count and reachable-point rules for content positions, shared by the puzzle verifier
// (src/content/validate-puzzles.ts) and the lesson validator (src/content/validate.ts).
//
// The engine accepts any placement with one General per side; these rules reject placements that can
// never arise in a game (07-sourcing.md §4.1): more pieces of a type than a side starts with, or a
// piece on a point it can never reach (a General outside its palace, an Elephant off its seven points,
// a Soldier before its river on an odd file or behind its start rank), or two own Soldiers on one file
// before they cross the river (a Soldier cannot change file before crossing, and each file starts with
// at most one). "Legal" here still does not mean
// "reachable from the start position" (04-architecture.md §2.1). Pure: no React, no DOM.
import { fileOf, rankOf, squareName, type Board, type Color, type PieceType } from '../engine';

/** The most pieces of each type one side can have (its starting set; there is no promotion). */
export const MAX_COUNT: Readonly<Record<PieceType, number>> = {
  general: 1,
  advisor: 2,
  elephant: 2,
  horse: 2,
  chariot: 2,
  cannon: 2,
  soldier: 5,
};

const ELEPHANT_POINTS: readonly (readonly [number, number])[] = [
  [2, 0], [6, 0], [0, 2], [4, 2], [8, 2], [2, 4], [6, 4],
];

/** Can a `color` piece of `type` ever stand on (file, rank)? Ranks are absolute (rank 0 = Red's back rank). */
export function isReachablePoint(type: PieceType, color: Color, file: number, rank: number): boolean {
  const r = color === 'red' ? rank : 9 - rank; // rank counted from the owner's back rank
  switch (type) {
    case 'general':
      return file >= 3 && file <= 5 && r <= 2;
    case 'advisor':
      return (file === 4 && r === 1) || ((file === 3 || file === 5) && (r === 0 || r === 2));
    case 'elephant':
      return ELEPHANT_POINTS.some(([f, rr]) => f === file && rr === r);
    case 'soldier':
      // Starts on rank 3; before the river only files a, c, e, g, i are possible.
      return r >= 5 || (r >= 3 && file % 2 === 0);
    default:
      return true;
  }
}

/** Has a `color` Soldier on `rank` not crossed the river yet (still on its own half)? */
const beforeRiver = (color: Color, rank: number): boolean => (color === 'red' ? rank : 9 - rank) <= 4;

/**
 * Every piece-count and reachable-point problem of a board, Red first, then Black, by piece type.
 * Empty means the placement is possible in a game. Messages: "too many red soldiers (6)",
 * "black soldier on b6 can never stand there", "2 black soldiers on file a before the river (a5, a6)".
 */
export function placementProblems(board: Board): string[] {
  const problems: string[] = [];
  for (const color of ['red', 'black'] as const) {
    for (const type of Object.keys(MAX_COUNT) as PieceType[]) {
      const squares = board.flatMap((pc, sq) => (pc?.color === color && pc.type === type ? [sq] : []));
      if (squares.length > MAX_COUNT[type]) problems.push(`too many ${color} ${type}s (${squares.length})`);
      for (const sq of squares) {
        if (!isReachablePoint(type, color, fileOf(sq), rankOf(sq))) problems.push(`${color} ${type} on ${squareName(sq)} can never stand there`);
      }
      if (type === 'soldier') {
        // At most one own Soldier per file before it crosses the river.
        for (let file = 0; file < 9; file++) {
          const onFile = squares.filter((sq) => fileOf(sq) === file && beforeRiver(color, rankOf(sq)));
          if (onFile.length > 1) {
            problems.push(`${onFile.length} ${color} soldiers on file ${'abcdefghi'[file]} before the river (${onFile.map(squareName).join(', ')})`);
          }
        }
      }
    }
  }
  return problems;
}
