import { describe, expect, it } from 'vitest';
import { validateUnits } from './validate';

const K = { e0: 'K', d9: 'k' };

/** Wraps exercises in a minimal valid unit/lesson using existing i18n keys. */
const unitWith = (...exercises: unknown[]) => [
  { id: 'u1', title: 'u1.title', description: 'u1.desc', lessons: [{ id: 'u1l1', title: 'u1l1.title', exercises }] },
];
const errorsFor = (...exercises: unknown[]) => validateUnits(unitWith(...exercises));

describe('content validator', () => {
  it('accepts a minimal valid lesson of every exercise type', () => {
    expect(
      errorsFor(
        { type: 'learn', pieces: { ...K, a0: 'R' }, square: 'a0', text: 'u3l1.e1' },
        { type: 'select-squares', pieces: { ...K, a0: 'R' }, square: 'a0', prompt: 'u3l1.e2' },
        { type: 'select-squares', pieces: K, region: 'red-palace', prompt: 'u1l1.e4' },
        { type: 'move', pieces: { ...K, a0: 'R' }, from: 'a0', goal: { kind: 'reach', squares: ['a7'] }, solution: { from: 'a0', to: 'a7' }, prompt: 'u3l1.e3' },
        { type: 'capture', pieces: { ...K, a0: 'R', a7: 'c' }, solution: { from: 'a0', to: 'a7' }, prompt: 'u3l1.e4' },
      ),
    ).toEqual([]);
  });

  it.each([
    ['a non-array root', {}, /non-empty array of units/],
    ['a unit without lessons', [{ id: 'u1', title: 'u1.title', description: 'u1.desc', lessons: [] }], /"lessons"/],
    ['an unknown i18n key', [{ id: 'u1', title: 'nope.key', description: 'u1.desc', lessons: [{ id: 'l', title: 'u1l1.title', exercises: [{ type: 'learn', pieces: K, text: 'u1l1.e1' }] }] }], /nope\.key/],
    ['duplicate ids', [
      { id: 'u1', title: 'u1.title', description: 'u1.desc', lessons: [{ id: 'u1', title: 'u1l1.title', exercises: [{ type: 'learn', pieces: K, text: 'u1l1.e1' }] }] },
    ], /duplicate id/],
  ])('rejects %s', (_name, input, pattern) => {
    expect(validateUnits(input).join('\n')).toMatch(pattern);
  });

  it.each([
    ['an unknown exercise type', { type: 'quiz', pieces: K }, /unknown type/],
    ['both fen and pieces', { type: 'learn', pieces: K, fen: '4k4/9/9/9/9/9/9/9/9/4K4 w', text: 'u1l1.e1' }, /exactly one of "fen" or "pieces"/],
    ['a broken FEN', { type: 'learn', fen: 'xyz', text: 'u1l1.e1' }, /invalid position/],
    ['a missing general', { type: 'learn', pieces: { e0: 'K' }, text: 'u1l1.e1' }, /invalid position/],
    ['the opponent already in check', { type: 'learn', pieces: { ...K, d5: 'R' }, text: 'u1l1.e1' }, /illegal position/],
    ['Black to move in a non-learn exercise', { type: 'select-squares', pieces: { ...K, a0: 'R' }, turn: 'black', square: 'a0', prompt: 'u3l1.e2' }, /Red must be to move/],
    ['a square without a Red piece', { type: 'select-squares', pieces: K, square: 'a0', prompt: 'u3l1.e2' }, /must hold a Red piece/],
    ['a bad square name', { type: 'learn', pieces: K, square: 'z9', text: 'u1l1.e1' }, /square name/],
    ['a piece with nothing to select', { type: 'select-squares', pieces: { ...K, a0: 'N', a1: 'R', b0: 'R' }, square: 'a0', prompt: 'u3l2.e3' }, /nothing to select/],
    ['an unknown region', { type: 'select-squares', pieces: K, region: 'moon', prompt: 'u1l1.e4' }, /unknown region/],
    ['a missing prompt key', { type: 'select-squares', pieces: K, region: 'red-palace' }, /"prompt"/],
    ['an unreachable goal square', { type: 'move', pieces: { ...K, a0: 'R' }, goal: { kind: 'reach', squares: ['b5'] }, solution: { from: 'a0', to: 'a5' }, prompt: 'u3l1.e3' }, /b5 cannot be reached/],
    ['an illegal solution', { type: 'move', pieces: { ...K, a0: 'R' }, goal: { kind: 'any' }, solution: { from: 'a0', to: 'b1' }, prompt: 'u3l1.e3' }, /not accepted \(illegal\)/],
    ['a solution that misses the goal', { type: 'move', pieces: { ...K, a0: 'R' }, goal: { kind: 'check' }, solution: { from: 'a0', to: 'a5' }, prompt: 'u3l1.e3' }, /not accepted \(not-check\)/],
    ['an unknown goal', { type: 'move', pieces: { ...K, a0: 'R' }, goal: { kind: 'win' }, solution: { from: 'a0', to: 'a5' }, prompt: 'u3l1.e3' }, /goal\.kind/],
    ['a checkmate puzzle that also allows stalemate', {
      type: 'move', pieces: { d0: 'K', a8: 'R', h1: 'R', e9: 'k' }, goal: { kind: 'checkmate' }, solution: { from: 'h1', to: 'h9' }, prompt: 'u6l1.e4',
    }, /stalemates/],
    ['a capture puzzle with no winning capture', { type: 'capture', pieces: { ...K, a0: 'R', a5: 'p', a9: 'r' }, solution: { from: 'a0', to: 'a5' }, prompt: 'u3l1.e4' }, /no capture wins material/],
    ['a capture solution that is not a capture', { type: 'capture', pieces: { ...K, a0: 'R', h7: 'c' }, solution: { from: 'a0', to: 'a5' }, prompt: 'u3l1.e4' }, /no capture wins material|not-capture/],
    ['a losing capture as the solution', { type: 'capture', pieces: { ...K, a0: 'R', a5: 'p', a9: 'r', i0: 'R', i7: 'c' }, solution: { from: 'a0', to: 'a5' }, prompt: 'u3l1.e4' }, /not accepted \(not-best\)/],
    ['a pinned learn piece without allowNoMoves', { type: 'learn', pieces: { e0: 'K', e4: 'N', e9: 'k' }, square: 'e4', text: 'u1l1.e1' }, /allowNoMoves/],
  ])('rejects %s', (_name, exercise, pattern) => {
    const errors = errorsFor(exercise);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join('\n')).toMatch(pattern);
  });
});
