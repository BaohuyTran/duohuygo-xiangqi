import { describe, expect, it } from 'vitest';
import { parseSquare as sq } from '../engine';
import type { CaptureExercise, MoveExercise, SelectSquaresExercise } from '../content/types';
import {
  attemptRecord,
  captureGain,
  checkCapture,
  checkMove,
  checkSelection,
  emptyAttempt,
  expectedSelection,
  positionOf,
  querySquares,
  regionSquares,
} from './answers';
import { syncSafety } from './decision-table';
import { guardFor } from './guard';
import { choiceFixture, decisionFixture, safeMoveFixture } from './test-fixtures';

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

describe('select-squares queries (computed, never stored)', () => {
  // Red: General e0, Advisor e1, Chariot a0, Horse c2, Cannon h2. Black: General e9, Soldier a6, Horse b4, Chariot h9.
  const pos = positionOf({ pieces: { e0: 'K', e1: 'A', a0: 'R', c2: 'N', h2: 'C', e9: 'k', a6: 'p', b4: 'n', h9: 'r' } });
  const names = (list: number[]) => list.map((s) => ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'][s % 9] + Math.floor(s / 9));

  it('attacked-by: every point the side controls, its own pieces excluded', () => {
    expect(names(querySquares(pos, { kind: 'attacked-by', side: 'black' }))).toEqual(
      ['a2', 'c2', 'h2', 'd3', 'h3', 'h4', 'a5', 'd5', 'h5', 'c6', 'h6', 'h7', 'e8', 'h8', 'd9', 'f9', 'g9', 'i9'],
    );
  });

  it('attacked pieces vs hanging pieces (attacked and not defended)', () => {
    expect(names(querySquares(pos, { kind: 'attacked-pieces', side: 'black' }))).toEqual(['b4', 'a6']);
    // The Soldier on a6 is defended by the Horse on b4, so only the Horse hangs.
    expect(names(querySquares(pos, { kind: 'hanging', side: 'black' }))).toEqual(['b4']);
    expect(names(querySquares(pos, { kind: 'hanging', side: 'red' }))).toEqual(['c2', 'h2']);
  });

  it('can-capture: the opponent pieces that can legally take the piece on the target', () => {
    expect(names(querySquares(pos, { kind: 'can-capture', target: 'b4' }))).toEqual(['c2']);
    expect(names(querySquares(pos, { kind: 'can-capture', target: 'h2' }))).toEqual(['h9']);
    // A pinned piece cannot capture: the Chariot on e5 shields its General from the Black Chariot on e8.
    const pinned = positionOf({ pieces: { e0: 'K', e5: 'R', e8: 'r', d9: 'k', a5: 'c' } });
    expect(querySquares(pinned, { kind: 'can-capture', target: 'a5' })).toEqual([]);
  });

  // Regression positions (S2.7 review): attacked / defended are LEGAL facts (02 b06.m4: a pinned piece does not defend).
  it.each([
    ['a pinned defender does not defend', '3k5/9/2r1r4/9/9/9/2R6/4N4/9/4K4 b', { kind: 'hanging', side: 'red' }, ['e2', 'c3']],
    ['a capture that removes the Cannon screen', '3k5/9/9/9/N8/9/r8/9/4A4/C3K4 b', { kind: 'hanging', side: 'red' }, ['a0', 'a5']],
    ['the attacker leaving the Cannon line opens a recapture', '3k5/9/N8/9/9/r8/9/N8/4A4/C3K4 b', { kind: 'hanging', side: 'red' }, ['a2']],
    ['… but the piece is still attacked', '3k5/9/N8/9/9/r8/9/N8/4A4/C3K4 b', { kind: 'attacked-pieces', side: 'red' }, ['a2', 'a7']],
    ['a pinned attacker does not attack', '4k4/9/4n4/2N6/9/9/9/4R4/9/3AK4 w', { kind: 'attacked-pieces', side: 'red' }, []],
    ['a pinned attacker controls no point', '4k4/9/4n4/2N6/9/9/9/4R4/9/3AK4 w', { kind: 'attacked-by', side: 'black' }, ['e8', 'd9', 'f9']],
    ['a piece between the Generals does not attack', 'r3k4/9/9/9/6r2/4N4/9/9/9/4K4 b', { kind: 'attacked-pieces', side: 'black' }, []],
  ] as const)('%s', (_name, fen, query, expected) => {
    expect(names(querySquares(positionOf({ fen }), query))).toEqual(expected);
  });

  it('attacked-pieces and hanging agree with can-capture', () => {
    for (const fen of ['4k4/9/4n4/2N6/9/9/9/4R4/9/3AK4 w', 'r3k4/9/9/9/6r2/4N4/9/9/9/4K4 b']) {
      const pos = positionOf({ fen });
      for (const side of ['red', 'black'] as const) {
        for (const sq of querySquares(pos, { kind: 'attacked-pieces', side })) {
          expect(querySquares(pos, { kind: 'can-capture', target: names([sq])[0] }).length).toBeGreaterThan(0);
        }
      }
      expect(querySquares(pos, { kind: 'can-capture', target: fen.startsWith('4k4') ? 'c6' : 'g5' })).toEqual([]);
    }
  });

  it('point: the single authored point', () => {
    expect(names(querySquares(pos, { kind: 'point', square: 'c2' }))).toEqual(['c2']);
  });

  it('expectedSelection uses the query', () => {
    const ex: SelectSquaresExercise = {
      type: 'select-squares',
      pieces: { e0: 'K', e1: 'A', a0: 'R', c2: 'N', h2: 'C', e9: 'k', a6: 'p', b4: 'n', h9: 'r' },
      query: { kind: 'hanging', side: 'red' },
      prompt: 'x',
    };
    expect(checkSelection(ex, [sq('c2'), sq('h2')]).correct).toBe(true);
    expect(checkSelection(ex, [sq('c2')]).correct).toBe(false);
  });
});

describe('move goal "safe" (the level safety guard)', () => {
  const ex = safeMoveFixture();

  it('accepts safe moves and names what an unsafe move allows', () => {
    const safety = syncSafety();
    expect(checkMove(ex, mv('b0', 'c2'), safety)).toBe('correct');
    expect(checkMove(ex, mv('i0', 'g0'), safety)).toBe('correct');
    expect(checkMove(ex, mv('i0', 'i5'), safety)).toBe('allows-mate');
    const loss = { ...ex, pieces: { f0: 'K', a2: 'R', d9: 'k', h9: 'r' }, solution: { from: 'a2', to: 'a1' } } as MoveExercise;
    expect(checkMove(loss, mv('a2', 'h2'), safety)).toBe('loses-material');
    expect(checkMove(loss, mv('a2', 'a1'), safety)).toBe('correct');
  });

  it('never penalises a move the node limit could not check', () => {
    expect(checkMove(ex, mv('b0', 'c2'), syncSafety({ maxNodes: 1 }))).toBe('not-checked');
    // Without a safety check (a screen never searches synchronously) the verdict is 'not-checked'.
    expect(checkMove(ex, mv('b0', 'c2'))).toBe('not-checked');
  });

  it('takes the guard from the item id and the override', () => {
    expect(guardFor(undefined)).toMatchObject({ h: 1, k: 1, T: 2 });
    expect(guardFor('i07l1-02')).toMatchObject({ h: 2, k: 2 });
    expect(guardFor('u7l1')).toMatchObject({ h: 1 });
    expect(guardFor('a01-p03', { h: 1, T: 3 })).toMatchObject({ h: 1, k: 2, T: 3 });
  });
});

describe('attempt records (03-assessment.md §3.1)', () => {
  const at = new Date('2026-10-23T10:00:00.000Z');

  it('records first-answer credit, hints, retries, seed and the first misconception', () => {
    const a = { ...emptyAttempt(), wrong: 2, hints: 2, hintStep: 'piece' as const, hintBeforeFirstAnswer: true, firstCredit: 0, misconception: 'b09.m2', seed: 7 };
    expect(attemptRecord(choiceFixture(), a, 'practice', at)).toEqual({
      itemId: 'b09l3-05',
      itemVersion: 2,
      mode: 'practice',
      at: '2026-10-23T10:00:00.000Z',
      colour: 'red',
      credit: 0,
      hints: 2,
      hintStep: 'piece',
      hintBeforeFirstAnswer: true,
      attemptsBeforeSuccess: 2,
      seed: 7,
      misconception: 'b09.m2',
    });
  });

  it('is null for legacy items without id/version and for learn cards', () => {
    expect(attemptRecord(safeMoveFixture(), emptyAttempt(), 'practice', at)).toBeNull();
    expect(attemptRecord({ type: 'learn', pieces: { e0: 'K', d9: 'k' }, text: 'x', id: 'b01l1-01', version: 1 }, emptyAttempt(), 'practice', at)).toBeNull();
    expect(attemptRecord({ ...decisionFixture(), side: 'black' }, { ...emptyAttempt(), firstCredit: 1 }, 'placement', at)).toMatchObject({
      colour: 'black',
      mode: 'placement',
      credit: 1,
    });
  });
});
