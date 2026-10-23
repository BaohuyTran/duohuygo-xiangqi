// One normal form for a position up to file mirror (files a <-> i) and colour swap (ranks flipped,
// colours exchanged, side to move exchanged). Two positions have the same `normalKey` exactly when
// one can be turned into the other by these transformations, so the key finds duplicates across
// lessons, pools, puzzles and assessment items (03-assessment.md §4.2 rule 4, 07-sourcing.md §4).
// Shifts of a piece pattern are NOT covered. Pure: no React, no DOM.
import { toFen, type Board, type Position } from '../engine';

const FILES = 9;
const RANKS = 10;

const transformBoard = (board: Board, map: (file: number, rank: number) => [number, number], swap: boolean): Board => {
  const out: Board = Array.from({ length: FILES * RANKS }, () => null);
  board.forEach((piece, sq) => {
    if (!piece) return;
    const [f, r] = map(sq % FILES, Math.floor(sq / FILES));
    out[r * FILES + f] = swap ? { type: piece.type, color: piece.color === 'red' ? 'black' : 'red' } : piece;
  });
  return out;
};

/** The position seen in a mirror: file a becomes file i, ranks and colours unchanged. */
export function mirrorFiles(pos: Position): Position {
  return { ...pos, board: transformBoard(pos.board, (f, r) => [FILES - 1 - f, r], false) };
}

/**
 * The colour-swapped twin: Red's pieces become Black's on the rank seen from the other side
 * (rank r -> 9 - r, file unchanged), and the other side is to move. A Red-to-move exercise becomes the
 * same exercise for Black (05-migration.md `BLK`).
 */
export function swapColours(pos: Position): Position {
  return {
    ...pos,
    board: transformBoard(pos.board, (f, r) => [f, RANKS - 1 - r], true),
    turn: pos.turn === 'red' ? 'black' : 'red',
  };
}

/** Piece placement and side to move, e.g. "4k4/9/.../4K4 w"; move counters are ignored. */
const placementKey = (pos: Position): string => toFen(pos).split(' ').slice(0, 2).join(' ');

/** The four variants of a position: itself, mirrored, colour-swapped, both. */
export function variants(pos: Position): Position[] {
  const swapped = swapColours(pos);
  return [pos, mirrorFiles(pos), swapped, mirrorFiles(swapped)];
}

/**
 * The normal form: the smallest placement key among the four variants. The side to move is part of
 * the key, so the same pieces with the other side to move are a different position.
 */
export function normalKey(pos: Position): string {
  return variants(pos).map(placementKey).sort()[0];
}

/**
 * Groups of entries whose positions share a normal form (only groups of two or more), each group in
 * input order and the groups ordered by their first entry.
 */
export function duplicateGroups<T extends { ref: string; position: Position }>(entries: readonly T[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const e of entries) {
    const key = normalKey(e.position);
    groups.set(key, [...(groups.get(key) ?? []), e.ref]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}
