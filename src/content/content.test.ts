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
import { allLessons, allUnits, units } from './index';
import { hasMessage } from '../i18n/messages';
import { validateUnits } from './validate';

describe('shipped lesson content', () => {
  // Proving every mate in 4 and defence against mate in 3 takes a while.
  it('passes the validator', () => {
    // DEEP_CONTENT=1 (npm run content:deep) also proves every stored firstMoves list is complete.
    expect(validateUnits(allUnits, { deep: process.env.DEEP_CONTENT === '1' })).toEqual([]);
  }, 1_800_000);

  it('has the five levels in order, each with 4-6 exercises per lesson', () => {
    const tracks = units.map((u) => u.track ?? 'basics');
    expect([...new Set(tracks)]).toEqual(['basics', 'intermediate', 'advanced', 'expert', 'master']);
    expect(tracks.filter((t) => t === 'basics')).toHaveLength(4);
    expect(units.filter((u) => (u.track ?? 'basics') === 'basics').flatMap((u) => u.lessons)).toHaveLength(9);
    expect(tracks.filter((t) => t === 'intermediate')).toHaveLength(4);
    for (const unit of units) {
      expect(unit.lessons.length, unit.id).toBeGreaterThanOrEqual(unit.track === 'intermediate' ? 3 : 2);
      expect(unit.lessons.length, unit.id).toBeLessThanOrEqual(5);
      for (const lesson of unit.lessons) {
        expect(lesson.exercises.length, lesson.id).toBeGreaterThanOrEqual(4);
        expect(lesson.exercises.length, lesson.id).toBeLessThanOrEqual(6);
      }
    }
  });

  it('has Home banner text for every level after the first (jumpBannerTrack)', () => {
    const tracks = [...new Set(units.map((u) => u.track ?? 'basics'))].slice(1);
    for (const track of tracks) {
      expect(hasMessage(`track.${track}.jumpTitle`), track).toBe(true);
      expect(hasMessage(`track.${track}.jumpBody`), track).toBe(true);
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
          }, 60_000);
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
          // Judging every move of a mate-in-3 defence (u15l3) takes ~10-20 s under load; 30 s is the default timeout.
        }, 120_000);
      });
    });
  }
});
