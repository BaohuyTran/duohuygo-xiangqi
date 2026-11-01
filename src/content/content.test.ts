import { describe, expect, it } from 'vitest';
import { legalMoves, makeMove, parseSquare, squareName } from '../engine';
import {
  checkCapture,
  checkMove,
  checkSelection,
  expectedSelection,
  positionOf,
} from '../lessons/answers';
import { checkChoice } from '../lessons/choice';
import { checkCombinationMove, combinationDone, combinationReply } from '../lessons/combination';
import { isAccepted, judgeDecision, parseMoveKey } from '../lessons/decision';
import { toMove } from '../puzzles/logic';
import { allLessons, allUnits, units } from './index';
import { hasMessage } from '../i18n/messages';
import { isNewCourseUnitId } from './release';
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
    // The legacy course (u1–u15); new-course lessons (REL-P pilot b09, S2.14) are checked below by the 02 §5.2 ladder.
    const legacyLessons = allUnits.filter((u) => !isNewCourseUnitId(u.id)).flatMap((u) => u.lessons);
    const types = new Set(legacyLessons.flatMap((l) => l.exercises.map((e) => e.type)));
    expect([...types].sort()).toEqual(['capture', 'combination', 'learn', 'move', 'select-squares']);
  });

  it('new-course lessons follow the 02 §5.2 ladder and lesson size of their level', () => {
    // 02-curriculum.md §5.2 "Ladder by level": counts of G2 / G1 / G0 / TR items and non-learn lesson size.
    const ladder: Record<string, { G2: [number, number]; G1: [number, number]; G0: [number, number]; TR: [number, number]; size: [number, number] }> = {
      basics: { G2: [2, 3], G1: [2, 3], G0: [1, 2], TR: [0, 1], size: [5, 8] },
      intermediate: { G2: [2, 3], G1: [2, 3], G0: [1, 2], TR: [0, 1], size: [5, 8] },
      advanced: { G2: [0, 0], G1: [2, 2], G0: [2, 3], TR: [1, 1], size: [5, 7] },
      expert: { G2: [0, 0], G1: [1, 2], G0: [2, 3], TR: [1, 1], size: [4, 6] },
      master: { G2: [0, 0], G1: [0, 0], G0: [3, 4], TR: [1, 1], size: [4, 5] },
    };
    const inRange = (n: number, [lo, hi]: [number, number]) => n >= lo && n <= hi;
    for (const unit of allUnits.filter((u) => isNewCourseUnitId(u.id))) {
      const rule = ladder[unit.track ?? 'basics'];
      for (const lesson of unit.lessons) {
        const practice = lesson.exercises.filter((e) => e.type !== 'learn');
        // A practical task (play / review) is a TR item even without an `assist` field.
        const level = (e: (typeof practice)[number]) => e.assist ?? (e.type === 'play' || e.type === 'review' ? 'TR' : undefined);
        expect(lesson.exercises.some((e) => e.type === 'learn'), `${lesson.id}: a learn card or worked example`).toBe(true);
        expect(inRange(practice.length, rule.size), `${lesson.id}: ${practice.length} non-learn items`).toBe(true);
        for (const g of ['G2', 'G1', 'G0', 'TR'] as const) {
          const n = practice.filter((e) => level(e) === g).length;
          expect(inRange(n, rule[g]), `${lesson.id}: ${n} ${g} items`).toBe(true);
        }
      }
    }
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
          if (ex.type === 'decision') {
            // The validator proves the table; here the player's lookup accepts every accepted row.
            const accepted = ex.table.filter((r) => isAccepted(r.class));
            expect(accepted.length).toBeGreaterThan(0);
            for (const r of accepted) expect(judgeDecision(ex, parseMoveKey(r.move)!, pos)).toEqual({ kind: 'class', entry: r });
            return;
          }
          if (ex.type === 'line') {
            // The validator proves the tree; the root has an accepted move that continues.
            expect(ex.root.table.some((r) => isAccepted(r.class) && ex.root.next?.[r.move] !== undefined)).toBe(true);
            return;
          }
          if (ex.type === 'choice') {
            expect(checkChoice(ex, ex.options.filter((o) => o.correct).map((o) => o.id)).correct).toBe(true);
            return;
          }
          // Practical tasks and reviews are proven by the validator and scripts/verify-practical.ts.
          if (ex.type === 'play' || ex.type === 'review') return;
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
