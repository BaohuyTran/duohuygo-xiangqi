import { describe, expect, it } from 'vitest';
import { parseSquare as sq } from '../engine';
import type { CaptureExercise, MoveExercise, SelectSquaresExercise } from '../content/types';
import { captureGain, checkCapture, checkMove, checkSelection, expectedSelection, positionOf, regionSquares } from './answers';

const mv = (from: string, to: string) => ({ from: sq(from), to: sq(to) });

describe('select-squares answers', () => {
  const ex: SelectSquaresExercise = { type: 'select-squares', pieces: { e0: 'K', d9: 'k', e4: 'N', e5: 'P' }, square: 'e4', prompt: 'x' };

  it('come from the engine, respecting a blocked horse leg', () => {
    expect(expectedSelection(ex)).toEqual(['c3', 'g3', 'd2', 'f2', 'c5', 'g5'].map(sq).sort((a, b) => a - b));
  });

  it('must match exactly: no missing and no extra squares', () => {
    const answer = expectedSelection(ex);
    expect(checkSelection(ex, answer)).toEqual({ correct: true, missed: [], wrong: [] });
    expect(checkSelection(ex, [...answer, sq('d6')])).toMatchObject({ correct: false, wrong: [sq('d6')] });
    expect(checkSelection(ex, answer.slice(1))).toMatchObject({ correct: false, missed: [answer[0]] });
  });

  it('regions are computed from the board model', () => {
    expect(regionSquares('red-palace')).toHaveLength(9);
    expect(regionSquares('black-side')).toHaveLength(45);
    expect(regionSquares('black-palace')).toContain(sq('e8'));
  });
});

describe('move answers', () => {
  const base = { type: 'move', pieces: { e0: 'K', d9: 'k', a0: 'R', h7: 'r' }, prompt: 'x', solution: { from: 'a0', to: 'a9' } } as const;

  it('reach: only the listed squares are correct', () => {
    const ex: MoveExercise = { ...base, goal: { kind: 'reach', squares: ['a7'] } };
    expect(checkMove(ex, mv('a0', 'a7'))).toBe('correct');
    expect(checkMove(ex, mv('a0', 'a6'))).toBe('wrong-target');
    expect(checkMove(ex, mv('a0', 'b1'))).toBe('illegal');
  });

  it('distinguishes an impossible move from one that endangers the General', () => {
    const ex: MoveExercise = { ...base, pieces: { e0: 'K', d9: 'k', e1: 'R', e7: 'r' }, goal: { kind: 'any' } };
    expect(checkMove(ex, mv('e1', 'd1'))).toBe('unsafe'); // the chariot is pinned
    expect(checkMove(ex, mv('e1', 'e5'))).toBe('correct');
    expect(checkMove(ex, mv('e0', 'd0'))).toBe('unsafe'); // facing generals on the d-file
    expect(checkMove(ex, mv('e0', 'e2'))).toBe('illegal'); // a General can't move two points
  });

  it('enforces the required piece', () => {
    const ex: MoveExercise = { ...base, from: 'a0', goal: { kind: 'any' } };
    expect(checkMove(ex, mv('e0', 'e1'))).toBe('wrong-piece');
  });

  it('check and checkmate goals are judged by the engine', () => {
    const check: MoveExercise = { ...base, goal: { kind: 'check' } };
    expect(checkMove(check, mv('a0', 'a9'))).toBe('correct');
    expect(checkMove(check, mv('a0', 'a8'))).toBe('not-check');

    const mate: MoveExercise = {
      ...base,
      pieces: { d0: 'K', a8: 'R', h1: 'R', e9: 'k', i6: 'p' },
      goal: { kind: 'checkmate' },
      solution: { from: 'h1', to: 'h9' },
    };
    expect(checkMove(mate, mv('h1', 'h9'))).toBe('correct');
    expect(checkMove(mate, mv('a8', 'a9'))).toBe('not-checkmate'); // check, but e8 is free
  });
});

describe('capture answers', () => {
  // Chariot can take a defended soldier (loses the chariot) or an undefended cannon.
  const ex: CaptureExercise = {
    type: 'capture',
    pieces: { e0: 'K', d9: 'k', a0: 'R', a5: 'p', a9: 'r', i0: 'R', i7: 'c' },
    prompt: 'x',
    solution: { from: 'i0', to: 'i7' },
  };

  it('scores captures by material won and lost to recapture', () => {
    const pos = positionOf(ex);
    expect(captureGain(pos, mv('i0', 'i7'))).toBe(4.5);
    expect(captureGain(pos, mv('a0', 'a5'))).toBe(1 - 9);
  });

  it('accepts only the best winning capture', () => {
    expect(checkCapture(ex, mv('i0', 'i7'))).toBe('correct');
    expect(checkCapture(ex, mv('a0', 'a5'))).toBe('not-best');
    expect(checkCapture(ex, mv('a0', 'a3'))).toBe('not-capture');
    expect(checkCapture(ex, mv('a0', 'b1'))).toBe('illegal');
  });
});
