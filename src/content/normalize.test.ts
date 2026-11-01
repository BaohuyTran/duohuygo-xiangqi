import { describe, expect, it } from 'vitest';
import { parseFen, positionFromPieces, toFen } from '../engine';
import { positionOf } from '../lessons/answers';
import { puzzles } from '../puzzles/catalog';
import { startPosition } from '../puzzles/logic';
import { allUnits, units } from './index';
import { duplicateGroups, mirrorFiles, normalKey, swapColours, variants } from './normalize';

// A lopsided position so every transformation gives a different placement.
const base = positionFromPieces({ e0: 'K', a0: 'R', c3: 'P', h2: 'C', d9: 'k', b7: 'n', g6: 'p' });
const fen = (pos: Parameters<typeof toFen>[0]) => toFen(pos);

describe('normalize', () => {
  it('mirrors files a <-> i and keeps ranks, colours and the side to move', () => {
    const m = mirrorFiles(base);
    expect(fen(m)).toBe(fen(positionFromPieces({ e0: 'K', i0: 'R', g3: 'P', b2: 'C', f9: 'k', h7: 'n', c6: 'p' })));
    expect(fen(mirrorFiles(m))).toBe(fen(base));
  });

  it('swaps colours: ranks flipped, colours and side to move exchanged', () => {
    const s = swapColours(base);
    expect(fen(s)).toBe(fen(positionFromPieces({ e9: 'k', a9: 'r', c6: 'p', h7: 'c', d0: 'K', b2: 'N', g3: 'P' }, 'black')));
    expect(fen(swapColours(s))).toBe(fen(base));
  });

  it('gives the four variants one normal form, and a different one to other positions', () => {
    const keys = variants(base).map(normalKey);
    expect(new Set(keys).size).toBe(1);
    expect(new Set(variants(base).map(fen)).size).toBe(4);
    // Same pieces, other side to move: a different position.
    expect(normalKey({ ...base, turn: 'black' })).not.toBe(normalKey(base));
    // One piece moved: different.
    expect(normalKey(positionFromPieces({ e0: 'K', a1: 'R', c3: 'P', h2: 'C', d9: 'k', b7: 'n', g6: 'p' }))).not.toBe(normalKey(base));
    // Move counters do not matter.
    expect(normalKey({ ...base, halfmoveClock: 7, fullmoveNumber: 12 })).toBe(normalKey(base));
  });

  it('groups duplicate positions in input order', () => {
    const entries = [
      { ref: 'a', position: base },
      { ref: 'b', position: parseFen('4k4/9/9/9/9/9/9/9/9/4K4 w') },
      { ref: 'c', position: swapColours(mirrorFiles(base)) },
      { ref: 'd', position: mirrorFiles(base) },
    ];
    expect(duplicateGroups(entries)).toEqual([['a', 'c', 'd']]);
  });

  // 05-migration.md §9 command 4: over the 195 lesson positions and 60 puzzles, 7 groups, each a learn card
  // showing the position of the item after it; no lesson position equals a puzzle.
  it('reproduces the 7 duplicate groups of the shipped lessons and puzzles', () => {
    const entries = [
      ...units.flatMap((u) => u.lessons.flatMap((l) => l.exercises.map((e, i) => ({ ref: `${l.id}#${i}`, position: positionOf(e) })))),
      ...puzzles.map((p) => ({ ref: p.id, position: startPosition(p) })),
    ];
    expect(entries).toHaveLength(255);
    expect(duplicateGroups(entries)).toEqual([
      ['u1l1#0', 'u1l1#1'],
      ['u1l1#2', 'u1l1#3'],
      ['u9l3#0', 'u9l3#1'],
      ['u11l2#0', 'u11l2#1'],
      ['u11l3#0', 'u11l3#1'],
      ['u13l1#0', 'u13l1#1'],
      ['u15l3#0', 'u15l3#1'],
    ]);
  });

  // New-course items (REL-P pilot b09, S2.14) against every loaded lesson position and puzzle. The only duplicate is
  // intended: the practical task b09-g1 starts from the initial position (02 b09: "play from the start position"),
  // which the legacy learn cards u1l1#0/#1 also show. The lesson positions themselves are all distinct.
  it('new-course positions duplicate nothing except b09-g1 = the initial position', () => {
    const entries = [
      ...allUnits.flatMap((u) => u.lessons.flatMap((l) => l.exercises.map((e, i) => ({ ref: e.id ?? `${l.id}#${i}`, position: positionOf(e) })))),
      ...puzzles.map((p) => ({ ref: p.id, position: startPosition(p) })),
    ];
    expect(entries).toHaveLength(264);
    const isNew = (ref: string) => /^[biaem]\d\d/.test(ref);
    expect(duplicateGroups(entries).filter((g) => g.some(isNew))).toEqual([['u1l1#0', 'u1l1#1', 'b09-g1']]);
  });
});
