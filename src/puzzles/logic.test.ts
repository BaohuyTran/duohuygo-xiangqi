import { describe, expect, it } from 'vitest';
import type { Puzzle } from '../content/puzzle-types';
import { forcedWinMoves, legalMoves, makeMove, parseSquare as sq, positionFromPieces, toFen } from '../engine';
import { puzzles } from './catalog';
import { bestReplies, checkPuzzleMove, defenderReply, startPosition, toMove } from './logic';

const fen = (pieces: Record<string, string>) => toFen(positionFromPieces(pieces, 'red'));
const mv = (from: string, to: string) => ({ from: sq(from), to: sq(to) });

// Double-chariot mate: h1-h9 is the only mate.
const mateIn1: Puzzle = {
  id: 't-m1',
  fen: fen({ d0: 'K', e9: 'k', a8: 'R', h1: 'R', i6: 'p' }),
  sideToMove: 'red',
  goal: 'mate-in-1',
  difficulty: 1,
  theme: 'chariot',
  solution: [{ from: 'h1', to: 'h9' }],
};

describe('checkPuzzleMove', () => {
  const pos = startPosition(mateIn1);

  it('accepts the solution and rejects other legal moves', () => {
    expect(checkPuzzleMove(mateIn1, 0, pos, mv('h1', 'h9'))).toBe('correct');
    expect(checkPuzzleMove(mateIn1, 0, pos, mv('a8', 'a9'))).toBe('wrong');
  });

  it('explains impossible and unsafe moves', () => {
    expect(checkPuzzleMove(mateIn1, 0, pos, mv('h1', 'g2'))).toBe('illegal');
    expect(checkPuzzleMove(mateIn1, 0, pos, mv('e9', 'e8'))).toBe('illegal'); // not Red's piece
    expect(checkPuzzleMove(mateIn1, 0, pos, mv('d0', 'e0'))).toBe('unsafe'); // Generals would face
  });

  it('accepts listed alternatives', () => {
    const withAlt = { ...mateIn1, alternatives: [{ from: 'a8', to: 'a9' }] };
    expect(checkPuzzleMove(withAlt, 0, pos, mv('a8', 'a9'))).toBe('correct');
  });
});

describe('later moves and defender replies', () => {
  // A real mate-in-2 from the shipped content.
  const mateIn2 = puzzles.find((p) => p.goal === 'mate-in-2')!;
  const afterFirst = makeMove(startPosition(mateIn2), toMove(mateIn2.solution[0]));

  it('plays the stored reply on the main line and the engine’s best reply otherwise', () => {
    expect(defenderReply(mateIn2, 1, afterFirst, true)).toEqual(toMove(mateIn2.solution[1]));
    expect(bestReplies(mateIn2, afterFirst, 1)).toContainEqual(defenderReply(mateIn2, 1, afterFirst, false));
  });

  it('accepts exactly the mating moves at the second step, whatever Black replied', () => {
    for (const reply of legalMoves(afterFirst)) {
      const pos = makeMove(afterFirst, reply);
      const mates = forcedWinMoves(pos, 1);
      expect(mates.length).toBeGreaterThan(0); // every defence loses
      for (const m of legalMoves(pos)) {
        const expected = mates.some((x) => x.from === m.from && x.to === m.to) ? 'correct' : 'wrong';
        expect(checkPuzzleMove(mateIn2, 2, pos, m)).toBe(expected);
      }
    }
  });
});
