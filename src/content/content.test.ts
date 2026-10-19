import { describe, expect, it } from 'vitest';
import { legalMoves, makeMove, parseSquare, squareName } from '../engine';
import {
  checkCapture,
  checkMove,
  checkSelection,
  expectedSelection,
  positionOf,
} from '../lessons/answers';
import { checkCombinationMove, combinationDone, combinationReply } from '../lessons/combination';
import { toMove } from '../puzzles/logic';
import { allLessons, units } from './index';
import { validateUnits } from './validate';

describe('shipped lesson content', () => {
  it('passes the validator', () => {
    expect(validateUnits(units)).toEqual([]);
  });

  it('has 6 basic and 4 intermediate units of 3-5 lessons with 4-6 exercises each', () => {
    expect(units.map((u) => u.track ?? 'basics')).toEqual([...Array(6).fill('basics'), ...Array(4).fill('intermediate')]);
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
    expect([...types].sort()).toEqual(['capture', 'combination', 'learn', 'move', 'select-squares']);
  });

  it('makes the intermediate track harder: mostly multi-move combinations and mates', () => {
    const intermediate = units.filter((u) => u.track === 'intermediate').flatMap((u) => u.lessons.flatMap((l) => l.exercises));
    const combos = intermediate.filter((e) => e.type === 'combination');
    expect(combos.length).toBeGreaterThanOrEqual(30);
    expect(combos.some((e) => e.type === 'combination' && e.moves === 3)).toBe(true);
    expect(intermediate.some((e) => e.type === 'move' && e.goal.kind === 'defend')).toBe(true);
  });

  // Plays every exercise through the engine: the stated answer is legal and accepted, and
  // at least one wrong answer exists, so the exercise actually tests something.
  for (const lesson of allLessons) {
    describe(lesson.id, () => {
      lesson.exercises.forEach((ex, i) => {
        const name = `exercise ${i + 1} (${ex.type})`;
        if (ex.type === 'learn') return;

        if (ex.type === 'combination') {
          it(`${name} plays through against the engine's defence`, () => {
            // Follow the stored line with the player's own reply logic; it must finish exactly at its end.
            let pos = positionOf(ex);
            for (let step = 0; step < ex.solution.length; step += 2) {
              const move = toMove(ex.solution[step]);
              expect(checkCombinationMove(ex, step, pos, move), `step ${step}`).toBe('correct');
              pos = makeMove(pos, move);
              const last = step === ex.solution.length - 1;
              expect(combinationDone(ex, pos, step)).toBe(last);
              if (!last) {
                const reply = combinationReply(ex, step + 1, pos, true);
                expect(reply).toEqual(toMove(ex.solution[step + 1]));
                pos = makeMove(pos, reply);
              }
            }
            // Some first move fails, so the exercise tests something.
            const start = positionOf(ex);
            expect(legalMoves(start).some((m) => checkCombinationMove(ex, 0, start, m) === 'wrong')).toBe(true);
          });
          return;
        }

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
