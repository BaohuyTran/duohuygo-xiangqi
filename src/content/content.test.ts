import { describe, expect, it } from 'vitest';
import { legalMoves, makeMove, parseSquare, squareName } from '../engine';
import {
  checkCapture,
  checkMove,
  checkSelection,
  expectedSelection,
  positionOf,
} from '../lessons/answers';
import { allLessons, units } from './index';
import { validateUnits } from './validate';

describe('shipped lesson content', () => {
  it('passes the validator', () => {
    expect(validateUnits(units)).toEqual([]);
  });

  it('has 6 units of 3-5 lessons with 4-6 exercises each', () => {
    expect(units).toHaveLength(6);
    for (const unit of units) {
      expect(unit.lessons.length, unit.id).toBeGreaterThanOrEqual(3);
      expect(unit.lessons.length, unit.id).toBeLessThanOrEqual(5);
      for (const lesson of unit.lessons) {
        expect(lesson.exercises.length, lesson.id).toBeGreaterThanOrEqual(4);
        expect(lesson.exercises.length, lesson.id).toBeLessThanOrEqual(6);
      }
    }
  });

  it('uses every exercise type', () => {
    const types = new Set(allLessons.flatMap((l) => l.exercises.map((e) => e.type)));
    expect([...types].sort()).toEqual(['capture', 'learn', 'move', 'select-squares']);
  });

  // Plays every exercise through the engine: the stated answer is legal and accepted, and
  // at least one wrong answer exists, so the exercise actually tests something.
  for (const lesson of allLessons) {
    describe(lesson.id, () => {
      lesson.exercises.forEach((ex, i) => {
        const name = `exercise ${i + 1} (${ex.type})`;
        if (ex.type === 'learn') return;

        it(`${name} is solvable with a legal answer`, () => {
          const pos = positionOf(ex);
          if (ex.type === 'select-squares') {
            const answer = expectedSelection(ex);
            expect(answer.length).toBeGreaterThan(0);
            expect(checkSelection(ex, answer).correct).toBe(true);
            expect(checkSelection(ex, answer.slice(1)).correct).toBe(false);
            if (ex.square) {
              const legal = legalMoves(pos).filter((m) => m.from === parseSquare(ex.square!)).map((m) => m.to);
              expect(answer.map(squareName).sort()).toEqual(legal.map(squareName).sort());
            }
            return;
          }
          const solution = { from: parseSquare(ex.solution.from), to: parseSquare(ex.solution.to) };
          expect(legalMoves(pos)).toContainEqual(solution);
          expect(() => makeMove(pos, solution)).not.toThrow();
          const check = ex.type === 'move' ? (m: typeof solution) => checkMove(ex, m) : (m: typeof solution) => checkCapture(ex, m);
          expect(check(solution)).toBe('correct');
          const wrong = legalMoves(pos).filter((m) => check(m) !== 'correct');
          if (!(ex.type === 'move' && ex.goal.kind === 'any')) expect(wrong.length).toBeGreaterThan(0);
        });
      });
    });
  }
});
