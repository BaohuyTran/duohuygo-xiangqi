import { describe, expect, it } from 'vitest';
import { parseFen, parseSquare, positionFromPieces, START_FEN, fileOf, rankOf } from '../engine';
import { puzzles } from '../puzzles/catalog';
import { startPosition } from '../puzzles/logic';
import { isReachablePoint, placementProblems } from './legality';

const at = (name: string): [number, number] => [fileOf(parseSquare(name)), rankOf(parseSquare(name))];

describe('legality: reachable points and piece counts', () => {
  it('accepts the start position', () => {
    expect(placementProblems(parseFen(START_FEN).board)).toEqual([]);
  });

  it.each([
    // [type, color, square, reachable]
    ['general', 'red', 'e0', true],
    ['general', 'red', 'f2', true],
    ['general', 'red', 'e3', false],
    ['general', 'black', 'd7', true],
    ['general', 'black', 'd2', false],
    ['advisor', 'red', 'e1', true],
    ['advisor', 'red', 'e0', false],
    ['advisor', 'black', 'f9', true],
    ['elephant', 'red', 'e2', true],
    ['elephant', 'red', 'c4', true],
    ['elephant', 'red', 'e4', false],
    ['elephant', 'black', 'g5', true],
    ['elephant', 'black', 'c4', false],
    ['soldier', 'red', 'a3', true],
    ['soldier', 'red', 'b3', false],
    ['soldier', 'red', 'c2', false],
    ['soldier', 'red', 'b5', true],
    ['soldier', 'red', 'd9', true],
    ['soldier', 'black', 'c6', true],
    ['soldier', 'black', 'b6', false],
    ['soldier', 'black', 'f4', true],
    ['soldier', 'black', 'a7', false],
    ['chariot', 'red', 'a9', true],
    ['horse', 'black', 'e0', true],
    ['cannon', 'red', 'i5', true],
  ] as const)('%s %s on %s: %s', (type, color, square, expected) => {
    expect(isReachablePoint(type, color, ...at(square))).toBe(expected);
  });

  it('reports too many pieces and unreachable points with the puzzle verifier’s messages', () => {
    const board = positionFromPieces({ e0: 'K', e9: 'k', a3: 'P', c3: 'P', e3: 'P', g3: 'P', i3: 'P', b5: 'P', d3: 'P', b6: 'p' }).board;
    expect(placementProblems(board)).toEqual([
      'too many red soldiers (7)',
      'red soldier on d3 can never stand there',
      'black soldier on b6 can never stand there',
    ]);
  });

  it('allows at most one own Soldier per file before it crosses the river', () => {
    // Two unpromoted Black Soldiers on file a (u13l2#4): impossible, each file starts with one.
    expect(placementProblems(positionFromPieces({ e0: 'K', e9: 'k', a5: 'p', a6: 'p' }).board)).toEqual([
      '2 black soldiers on file a before the river (a5, a6)',
    ]);
    expect(placementProblems(positionFromPieces({ e0: 'K', d9: 'k', e3: 'P', e4: 'P' }).board)).toEqual([
      '2 red soldiers on file e before the river (e3, e4)',
    ]);
    // Crossed Soldiers may share a file, also with one that has not crossed yet.
    expect(placementProblems(positionFromPieces({ e0: 'K', d9: 'k', c4: 'P', c5: 'P', c6: 'P' }).board)).toEqual([]);
    expect(placementProblems(positionFromPieces({ e0: 'K', d9: 'k', g5: 'p', g4: 'p', g3: 'p' }).board)).toEqual([]);
    // Different files, or different colours on one file, are fine.
    expect(placementProblems(positionFromPieces({ e0: 'K', d9: 'k', a3: 'P', c3: 'P', a6: 'p' }).board)).toEqual([]);
  });

  it('finds nothing to report in the shipped puzzles (the verifier applies the same rules)', () => {
    for (const p of puzzles) expect(placementProblems(startPosition(p).board), p.id).toEqual([]);
  });
});
