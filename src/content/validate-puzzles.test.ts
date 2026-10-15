import { describe, expect, it } from 'vitest';
import { positionFromPieces, toFen } from '../engine';
import type { Puzzle } from './puzzle-types';
import { validatePuzzle, validatePuzzles } from './validate-puzzles';

const fen = (pieces: Record<string, string>) => toFen(positionFromPieces(pieces, 'red'));

const mateIn1: Puzzle = {
  id: 'm1-test',
  fen: fen({ d0: 'K', e9: 'k', a8: 'R', h1: 'R', i6: 'p' }),
  sideToMove: 'red',
  goal: 'mate-in-1',
  difficulty: 1,
  theme: 'chariot',
  solution: [{ from: 'h1', to: 'h9', hint: 'hint.chariot' }],
};

// Two chariots can each mate on rank 9: the horse on c7 guards e8, the red General guards d9.
const twoMates: Puzzle = { ...mateIn1, id: 'm1-two', fen: fen({ d0: 'K', e9: 'k', c7: 'N', a1: 'R', h1: 'R', i6: 'p' }) };

const freePiece: Puzzle = {
  id: 'wm-test',
  fen: fen({ d0: 'K', e9: 'k', a0: 'R', a5: 'n', i6: 'p' }),
  sideToMove: 'red',
  goal: 'win-material',
  difficulty: 1,
  theme: 'chariot',
  solution: [{ from: 'a0', to: 'a5' }],
};

const errors = (p: unknown) => validatePuzzle(p).join('\n');

describe('puzzle validator', () => {
  it('accepts a correct unique mate in 1 and a correct win-material puzzle', () => {
    expect(validatePuzzle(mateIn1)).toEqual([]);
    expect(validatePuzzle(freePiece)).toEqual([]);
  });

  it('rejects a puzzle with two winning first moves unless the other is listed as accepted', () => {
    expect(errors(twoMates)).toMatch(/winning first moves are \[.*,.*\]/);
    expect(validatePuzzle({ ...twoMates, alternatives: [{ from: 'a1', to: 'a9' }] })).toEqual([]);
  });

  it('rejects a win-material puzzle with more than one winning capture', () => {
    expect(errors({ ...freePiece, fen: fen({ d0: 'K', e9: 'k', a0: 'R', a5: 'n', i0: 'R', i5: 'c' }) })).toMatch(/material-winning first moves/);
  });

  it.each([
    ['a stored line that is not mate', { ...mateIn1, solution: [{ from: 'a8', to: 'a9' }] }, /not accepted \(wrong\)|does not end in checkmate/],
    ['an illegal stored move', { ...mateIn1, solution: [{ from: 'h1', to: 'g2' }] }, /not a legal move/],
    ['Black already in check', { ...mateIn1, fen: fen({ d0: 'K', e9: 'k', e5: 'R', a8: 'R' }) }, /Black is in check/],
    ['facing Generals', { ...mateIn1, fen: fen({ e0: 'K', e9: 'k', a8: 'R', h1: 'R' }) }, /Generals face/],
    ['a piece on an impossible point', { ...mateIn1, fen: fen({ d0: 'K', e9: 'k', a8: 'R', h1: 'R', e5: 'A' }) }, /advisor on e5 can never stand there/],
    ['a soldier behind its start line', { ...mateIn1, fen: fen({ d0: 'K', e9: 'k', a8: 'R', h1: 'R', b1: 'P' }) }, /soldier on b1/],
    ['too many chariots', { ...mateIn1, fen: fen({ d0: 'K', e9: 'k', a8: 'R', h1: 'R', b1: 'R' }) }, /too many red chariots/],
    ['a side to move that does not match the FEN', { ...mateIn1, sideToMove: 'black' }, /sideToMove/],
    ['a bad FEN', { ...mateIn1, fen: 'nonsense' }, /invalid FEN/],
    ['an unknown goal', { ...mateIn1, goal: 'mate-in-3' }, /unknown goal/],
    ['an unknown theme', { ...mateIn1, theme: 'queen' }, /unknown theme/],
    ['a bad difficulty', { ...mateIn1, difficulty: 6 }, /difficulty/],
    ['the wrong solution length', { ...mateIn1, solution: [mateIn1.solution[0], mateIn1.solution[0]] }, /must have 1 moves/],
    ['an unknown hint key', { ...mateIn1, solution: [{ from: 'h1', to: 'h9', hint: 'hint.nope' }] }, /not an i18n key/],
    ['a hint on a defender move', { ...mateIn1, goal: 'mate-in-2', solution: [mateIn1.solution[0], { from: 'e9', to: 'e8', hint: 'hint.check' }, mateIn1.solution[0]] }, /defender move and cannot have a hint/],
    ['a mate-in-2 that is really a mate in 1', { ...mateIn1, goal: 'mate-in-2', solution: [{ from: 'a8', to: 'a7' }, { from: 'i6', to: 'i5' }, { from: 'h1', to: 'h9' }] }, /already a mate in 1/],
    ['a win-material puzzle whose last move is not a capture', { ...freePiece, solution: [{ from: 'a0', to: 'a1' }] }, /must be a capture/],
  ])('rejects %s', (_name, puzzle, pattern) => {
    expect(errors(puzzle)).toMatch(pattern);
  });

  it('checks ids, duplicate positions and ordering across a set', () => {
    const second = { ...freePiece, id: 'wm-2', difficulty: 1 };
    expect(validatePuzzles([mateIn1, { ...mateIn1 }]).join('\n')).toMatch(/duplicate id[\s\S]*duplicate position/);
    expect(validatePuzzles([{ ...freePiece, difficulty: 3 }, second]).join('\n')).toMatch(/ordered by difficulty/);
  });
});
