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

describe('content validator: combinations, defend and tracks', () => {
  // Mate in 2 with two Chariots (from the shipped course): Ri7-i8 is quiet, then Ri9-g9 mates.
  const twoChariots = {
    type: 'combination',
    pieces: { c2: 'p', e9: 'k', f1: 'K', f4: 'p', g9: 'n', i7: 'R', i9: 'R' },
    prompt: 'u8l2.p1',
    goal: 'checkmate',
    moves: 2,
    solution: [
      { from: 'i7', to: 'i8' },
      { from: 'c2', to: 'c1' },
      { from: 'i9', to: 'g9' },
    ],
  };

  it('accepts a valid combination and a valid defend exercise', () => {
    const defend = {
      type: 'move',
      pieces: { b3: 'r', b9: 'C', e9: 'k', f1: 'K', g8: 'r', g9: 'N' },
      prompt: 'u9l3.p1',
      goal: { kind: 'defend' },
      solution: { from: 'g9', to: 'e8' },
    };
    expect(errorsFor(twoChariots, defend)).toEqual([]);
  });

  it.each([
    ['a wrong number of moves', { ...twoChariots, moves: 3 }, /already mates in 2/],
    ['an unsupported length', { ...twoChariots, moves: 4 }, /"moves" must be 2 or 3/],
    ['an unknown goal', { ...twoChariots, goal: 'draw' }, /"goal" must be/],
    ['a line that does not end with a Red move', { ...twoChariots, solution: twoChariots.solution.slice(0, 2) }, /alternate Red\/Black/],
    ['a first move that does not win', { ...twoChariots, solution: [{ from: 'f1', to: 'f0' }, ...twoChariots.solution.slice(1)] }, /not accepted \(wrong\)/],
    [
      'a reply that is not a best defence',
      {
        ...twoChariots,
        // After the quiet Pf8-e8 Black's best try is Cc8-c9 (two mates left); Ph3-h2 leaves three.
        pieces: { c8: 'c', d7: 'P', d9: 'k', e0: 'K', f8: 'P', h3: 'p', i4: 'N', i7: 'b' },
        solution: [
          { from: 'f8', to: 'e8' },
          { from: 'h3', to: 'h2' },
          { from: 'd7', to: 'd8' },
        ],
      },
      /not a best defence/,
    ],
    ['a missing hint key', { ...twoChariots, hints: ['nope.hint'] }, /nope\.hint/],
    ['a defend exercise without a threat', { type: 'move', pieces: { ...K, a0: 'R' }, prompt: 'u9l3.p1', goal: { kind: 'defend' }, solution: { from: 'a0', to: 'a1' } }, /no mate-in-one threat/],
  ])('rejects %s', (_name, exercise, pattern) => {
    expect(errorsFor(exercise).join('\n')).toMatch(pattern);
  });

  const unit = (id: string, track?: string) => ({
    id,
    track,
    title: 'u1.title',
    description: 'u1.desc',
    lessons: [{ id: `${id}l`, title: 'u1l1.title', exercises: [{ type: 'learn', pieces: K, text: 'u1l1.e1' }] }],
  });

  it('checks tracks: known names, and units of one track kept together', () => {
    expect(validateUnits([unit('a'), unit('b', 'intermediate')])).toEqual([]);
    expect(validateUnits([unit('a', 'expert')]).join('\n')).toMatch(/"track" must be one of/);
    expect(validateUnits([unit('a'), unit('b', 'intermediate'), unit('c')]).join('\n')).toMatch(/must be consecutive/);
  });
});
