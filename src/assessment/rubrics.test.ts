import { describe, expect, it } from 'vitest';
import { R1_PENALTIES } from '../analysis';
import { createRng } from '../play/rng';
import {
  LINE_SHARE_GATE,
  PASS_MARK,
  R1_DEDUCTIONS,
  lineShare,
  r0,
  r1,
  r2,
  r3,
  r4,
  r5,
  r6,
  r7,
  scoreTask,
  scoringWeights,
  type ShareStep,
} from './rubrics';

describe('rubrics R0–R7 (03 §5.3)', () => {
  it('R1 deductions equal the analysis layer’s', () => expect(R1_DEDUCTIONS).toEqual(R1_PENALTIES));

  it.each([
    [5, 5, 100],
    [5, 4, 100],
    [5, 3, 50],
    [5, 2, 50],
    [5, 1, 0],
  ])('R0: start %d, end %d → %d', (s, e, want) => expect(r0(s, e)).toBe(want));

  it('R1: one penalty per move, floor 0', () => {
    expect(r1([null, null])).toBe(100);
    expect(r1(['missed-gain', null, 'allowed-loss'])).toBe(60);
    expect(r1(['allowed-mate', 'serious-allowed-loss', 'missed-mate'])).toBe(0);
  });

  it('R2: target pro rata 50, no idle General/Advisor moves 25, no piece moved > 3 times 25', () => {
    expect(r2({ developed: 4, target: 4, idleDefenderMoves: 0, overmoved: false })).toBe(100);
    expect(r2({ developed: 2, target: 4, idleDefenderMoves: 1, overmoved: false })).toBe(50);
    expect(r2({ developed: 0, target: 4, idleDefenderMoves: 2, overmoved: true })).toBe(0);
  });

  it('R3: objective 50, with R1 ≥ 75 another 30, mobility not reduced 20', () => {
    expect(r3({ objectiveMet: true, r1: 75, mobilityStart: 10, mobilityEnd: 10 })).toBe(100);
    expect(r3({ objectiveMet: true, r1: 50, mobilityStart: 10, mobilityEnd: 9 })).toBe(50);
    expect(r3({ objectiveMet: false, r1: 100, mobilityStart: 10, mobilityEnd: 12 })).toBe(20);
  });

  it('R4: without a mate at most 70 (< 75)', () => {
    expect(r4({ won: true, leadStart: 5, leadEnd: 5, opponentHadMate2: false, r1: 100 })).toBe(100);
    expect(r4({ won: false, leadStart: 5, leadEnd: 9, opponentHadMate2: false, r1: 100 })).toBe(70);
    expect(r4({ won: false, leadStart: 5, leadEnd: 4, opponentHadMate2: true, r1: 50 })).toBe(0);
  });

  it('R5: gate "not mated"; without the holding predicate at most 70', () => {
    const base = { mated: false, startDeficit: 3, endDeficit: 4, threatAtEnd: false, r1: 100 };
    expect(r5({ ...base, holding: true })).toBe(100);
    expect(r5({ ...base, holding: false })).toBe(70);
    expect(r5({ ...base, holding: true, mated: true })).toBe(0);
    expect(r5({ ...base, holding: true, endDeficit: 5, threatAtEnd: true, r1: 50 })).toBe(40);
  });

  it('R6 = share × 60 + R2 × 0.4; R7 = 40 + 40 + 20', () => {
    expect(r6(lineShare(Array(6).fill({ counted: true, credited: true }), 6), 100)).toBe(100);
    expect(r6(lineShare(Array(6).fill({ counted: true, credited: false }), 6), 50)).toBe(20);
    expect(r7({ markedTurningPoint: true, betterMove: true, reasonMatches: true })).toBe(100);
    expect(r7({ markedTurningPoint: true, betterMove: false, reasonMatches: true })).toBe(60);
    expect(r7({ markedTurningPoint: false, betterMove: false, reasonMatches: false })).toBe(0);
  });
});

describe('line share (03 §5.3 rules 1–4)', () => {
  const on = (credited: boolean): ShareStep => ({ counted: true, credited });
  const off: ShareStep = { counted: false, credited: false };

  it('counts the first L counted moves; the denominator never shrinks', () => {
    const s = lineShare([on(true), on(true), on(false), on(true), on(true), on(false), on(false), on(false)], 6);
    expect(s).toMatchObject({ counted: 6, credited: 4, voided: false, gate: true });
    expect(s.share).toBeCloseTo(4 / 6);
    expect(lineShare([on(true), on(true), on(true), on(false), on(false), on(false)], 6).gate).toBe(false);
  });

  it('a check evasion (nothing creditable) is played but not counted', () => {
    const evasion: ShareStep = { counted: false, credited: true };
    const s = lineShare([on(true), evasion, on(true), on(true), on(true), on(true), on(true)], 6);
    expect(s).toMatchObject({ counted: 6, credited: 6, gate: true });
  });

  it('a learner who develops faster than the tree is not charged for the later empty positions', () => {
    // Six counted developing moves, then positions where nothing is left to develop (not counted).
    const s = lineShare([...Array(6).fill(on(true)), off, off, off], 6);
    expect(s).toMatchObject({ counted: 6, credited: 6, gate: true, voided: false });
  });

  it('fewer than L counted moves voids the run; a fact not checked before the window fills voids it too', () => {
    expect(lineShare([on(true), off, on(true)], 6)).toMatchObject({ counted: 2, voided: true });
    expect(lineShare([{ counted: null, credited: false }, ...Array(6).fill(on(true))], 6)).toMatchObject({ voided: true, unknown: true });
    expect(lineShare([on(true), on(true), { counted: null, credited: false }, ...Array(4).fill(on(true))], 6)).toMatchObject({ voided: true, unknown: true });
    // After the window is full a missing fact no longer matters.
    expect(lineShare([...Array(6).fill(on(true)), { counted: null, credited: false }], 6)).toMatchObject({ voided: false, unknown: false });
  });

  it('a seeded N2 on selective fixture trees (credited ≤ 1/3 per counted move) fails the gate ≥ 80 % (≈ 90 % at L = 6)', () => {
    const rng = createRng(2026);
    for (const L of [6, 8]) {
      let fails = 0;
      const runs = 4000;
      for (let i = 0; i < runs; i++) {
        // Per counted node: 2 credited of 6–15 guard-passing moves (selective), uniform pick by the shuffler.
        const steps = Array.from({ length: L + 2 }, () => {
          const passing = 6 + rng.int(10);
          return on(rng.int(passing) < 2);
        });
        if (!lineShare(steps, L).gate) fails++;
      }
      expect(fails / runs).toBeGreaterThanOrEqual(L === 6 ? 0.8 : 0.9);
    }
    expect(LINE_SHARE_GATE).toBeCloseTo(2 / 3);
  });
});

describe('scoring weights by fallback and the pass rules (03 §5.2, §5.6)', () => {
  const rubrics = [
    { rubric: 'R6' as const, weight: 50 },
    { rubric: 'R1' as const, weight: 30 },
    { rubric: 'R5' as const, weight: 20 },
  ];

  it('F2 = R1 60 + R2 20 + R0 20 (no result); F2b adds line share × 30 with the gate', () => {
    expect(scoringWeights(rubrics, 'F2')).toEqual([
      { term: 'R1', weight: 60 },
      { term: 'R2', weight: 20 },
      { term: 'R0', weight: 20 },
    ]);
    expect(scoringWeights(rubrics, 'F2b').map((w) => [w.term, w.weight])).toEqual([
      ['R1', 40],
      ['R2', 20],
      ['R0', 10],
      ['LS', 30],
    ]);
  });

  it('F5 keeps R6, R1 (and R2/R3), drops result / R4 / R5 terms, scaled back to 100', () => {
    const w = scoringWeights(rubrics, 'F5');
    expect(w.map((x) => x.term)).toEqual(['R6', 'R1']);
    expect(w.reduce((s, x) => s + x.weight, 0)).toBeCloseTo(100);
    expect(scoringWeights(rubrics, 'F1')).toEqual(rubrics.map((r) => ({ term: r.rubric, weight: r.weight })));
  });

  it('pass = score ≥ 75, no critical failure, gate passed, not voided', () => {
    const weights = [{ term: 'R1' as const, weight: 100 }];
    expect(scoreTask({ weights, values: { R1: 75 }, critical: [], voids: [] })).toMatchObject({ score: 75, pass: true });
    expect(scoreTask({ weights, values: { R1: 74 }, critical: [], voids: [] }).pass).toBe(false);
    expect(scoreTask({ weights, values: { R1: 100 }, critical: ['mated'], voids: [] }).pass).toBe(false);
    expect(scoreTask({ weights, values: { R1: 100 }, critical: [], voids: ['partner-safety-net'] })).toMatchObject({ pass: false, voided: true });
    const share = lineShare(Array(6).fill({ counted: true, credited: false }), 6);
    expect(scoreTask({ weights: [{ term: 'R6', weight: 50 }, { term: 'R1', weight: 50 }], values: { R6: 100, R1: 100 }, critical: [], voids: [], share })).toMatchObject({ gateFailed: true, pass: false });
    expect(PASS_MARK).toBe(75);
  });

  it('decides the pass on the unrounded score and never shows 75 for a failed run (one decimal, rounded down)', () => {
    const weights = [{ term: 'R1' as const, weight: 50 }, { term: 'R0' as const, weight: 50 }];
    const s = scoreTask({ weights, values: { R1: 99.9, R0: 50 }, critical: [], voids: [] });
    expect(s.pass).toBe(false);
    expect(s.score).toBe(74.9);
    expect(scoreTask({ weights, values: { R1: 100, R0: 50 }, critical: [], voids: [] })).toMatchObject({ score: 75, pass: true });
  });

  it('fails closed when a line share task has no share facts', () => {
    expect(scoreTask({ weights: [{ term: 'R6', weight: 100 }], values: { R6: 100 }, critical: [], voids: [] })).toMatchObject({ gateFailed: true, pass: false });
    expect(scoreTask({ weights: [{ term: 'LS', weight: 100 }], values: { LS: 100 }, critical: [], voids: [] }).pass).toBe(false);
  });
});
