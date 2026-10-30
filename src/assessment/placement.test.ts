import { describe, expect, it } from 'vitest';
import type { AssessmentItem, Strand } from '../content/types';
import type { ScoredAnswer } from './credit';
import {
  assembleJ1,
  assembleJ2,
  coveredUnits,
  j2Length,
  localDay,
  placementAvailableToday,
  placementCannotPass,
  placementEndRecord,
  placementOutcome,
  placementStartRecord,
  PP_PRIMARY_UNITS,
  scorePlacement,
  weakestPointer,
  type PlacementForm,
  type PracticalOutcome,
} from './placement';
import { choiceItem } from './test-fixtures';

const STRANDS: Strand[] = ['RS', 'TC', 'OD', 'PA', 'DE'];

/** A J1-shaped form: 4 items per strand (the first RS item critical) + a practical task. */
function j1Form(): PlacementForm {
  const items = STRANDS.flatMap((s, si) =>
    [0, 1, 2, 3].map((k) => choiceItem({ id: `pb-${String(si * 4 + k + 1).padStart(2, '0')}`, unit: `b0${k + 1}`, strand: s, critical: s === 'RS' && k === 0 })),
  );
  const practical = { ...choiceItem({ id: 'pb-g1', unit: 'b10' }), type: 'play', equivalentOf: 'b10-g1', version: 2 } as unknown as AssessmentItem;
  return { kind: 'J1', target: 'intermediate', formId: 'J1:intermediate#x', items, practical, itemPoints: 80, skippedUnits: ['b01', 'b02', 'b03', 'b04'], assessmentVersion: 1 };
}

const answersFor = (form: Pick<PlacementForm, 'items'>, wrong: string[] = [], voided: string[] = []) =>
  new Map<string, ScoredAnswer>(form.items.map((i) => [i.id!, { itemId: i.id!, credit: wrong.includes(i.id!) ? 0 : 1, voided: voided.includes(i.id!) }]));
const run = (score: number, over: Partial<PracticalOutcome> = {}): PracticalOutcome => ({ score, pass: score >= 75, criticalFailure: false, voided: false, runs: 1, voidedRuns: 0, ...over });
/** The k-th item of a strand in j1Form. */
const id = (strand: Strand, k: number) => `pb-${String(STRANDS.indexOf(strand) * 4 + k + 1).padStart(2, '0')}`;

describe('J1 pass rule: the 03 §7.3 table', () => {
  const rows: { name: string; wrong: string[]; practical: number; total: number; shown: number; pass: boolean }[] = [
    { name: '20/20, practical 75', wrong: [], practical: 75, total: 95, shown: 95, pass: true },
    { name: '19/20 (1 TC), practical 75', wrong: [id('TC', 0)], practical: 75, total: 91, shown: 91, pass: true },
    { name: '19/20 (1 TC), practical 70: practical < 75', wrong: [id('TC', 0)], practical: 70, total: 90, shown: 90, pass: false },
    { name: '18/20 (1 TC, 1 PA), practical 100', wrong: [id('TC', 0), id('PA', 0)], practical: 100, total: 92, shown: 92, pass: true },
    { name: '18/20 (1 TC, 1 PA), practical 90: exactly 90', wrong: [id('TC', 0), id('PA', 0)], practical: 90, total: 90, shown: 90, pass: true },
    { name: '18/20 (1 TC, 1 PA), practical 89: 89.8 fails, shown 89', wrong: [id('TC', 0), id('PA', 0)], practical: 89, total: 89.8, shown: 89, pass: false },
    { name: '18/20 (2 TC), practical 100: TC 50 %', wrong: [id('TC', 0), id('TC', 1)], practical: 100, total: 92, shown: 92, pass: false },
    { name: '18/20 (1 PA, 1 RS critical), practical 100', wrong: [id('PA', 0), id('RS', 0)], practical: 100, total: 92, shown: 92, pass: false },
    { name: '17/20 (3 strands), practical 100: total', wrong: [id('TC', 0), id('PA', 0), id('OD', 0)], practical: 100, total: 88, shown: 88, pass: false },
  ];
  for (const row of rows) {
    it(row.name, () => {
      const form = j1Form();
      const r = scorePlacement(form, answersFor(form, row.wrong), run(row.practical));
      expect(r.total).toBeCloseTo(row.total, 9);
      expect(r.shown).toBe(row.shown);
      expect(r.pass).toBe(row.pass);
    });
  }

  it('decides exactly: 89.8 is below 90 and 90 is not, with no rounding before the comparison', () => {
    const form = j1Form();
    const a = answersFor(form, [id('TC', 0), id('PA', 0)]);
    expect(scorePlacement(form, a, run(89.9)).totalOk).toBe(false); // 72 + 17.98
    expect(scorePlacement(form, a, run(90)).totalOk).toBe(true);
  });

  it('the practical task needs one run, no critical failure and not voided; a voided one cannot be assessed', () => {
    const form = j1Form();
    expect(scorePlacement(form, answersFor(form), run(100, { runs: 2 })).pass).toBe(false);
    expect(scorePlacement(form, answersFor(form), run(100, { criticalFailure: true })).pass).toBe(false);
    const v = scorePlacement(form, answersFor(form), run(0, { voided: true, voidedRuns: 2 }));
    expect(v.couldNotAssess).toBe(true);
    expect(v.pass).toBe(false);
  });

  it('voided items leave numerator and denominator; a voided critical item cannot be assessed', () => {
    const form = j1Form();
    expect(scorePlacement(form, answersFor(form, [], [id('TC', 3)]), run(100)).total).toBe(100);
    expect(scorePlacement(form, answersFor(form, [], [id('RS', 0)]), run(100)).couldNotAssess).toBe(true);
  });
});

describe('voided answers never pass a test on too little evidence', () => {
  const all = (strand: Strand) => [0, 1, 2, 3].map((k) => id(strand, k));

  it('J1 with every TC item voided could not be assessed (a strand with no scorable item is never decided)', () => {
    const form = j1Form();
    const r = scorePlacement(form, answersFor(form, [], all('TC')), run(100));
    expect(r.couldNotAssess).toBe(true);
    expect(r.pass).toBe(false);
    expect(r.strands.find((s) => s.strand === 'TC')?.ok).toBe(false);
  });

  it('J1 with 16 of 20 voided, or 14 voided and a practical task at 75, could not be assessed', () => {
    const form = j1Form();
    const sixteen = form.items.slice(0, 16).map((i) => i.id!);
    expect(scorePlacement(form, answersFor(form, [], sixteen), run(100)).pass).toBe(false);
    expect(scorePlacement(form, answersFor(form, [], sixteen), run(100)).couldNotAssess).toBe(true);
    const fourteen = form.items.slice(1, 15).map((i) => i.id!);
    const r = scorePlacement(form, answersFor(form, [], fourteen), run(75));
    expect(r.pass).toBe(false);
    expect(r.couldNotAssess).toBe(true);
  });

  it('more than a quarter of a strand voided could not be assessed; one of four is tolerated', () => {
    const form = j1Form();
    expect(scorePlacement(form, answersFor(form, [], [id('TC', 0)]), run(100)).couldNotAssess).toBe(false);
    expect(scorePlacement(form, answersFor(form, [], [id('TC', 0), id('TC', 1)]), run(100)).couldNotAssess).toBe(true);
  });

  it('voids do not inflate the practical task: the items keep their 80 points (total = 80 · E/P + score ÷ 5)', () => {
    const form = j1Form();
    // One voided item per strand (tolerated), one TC miss among the 15 scorable, practical 75: 80 · 14/15 + 15 = 89.67.
    const voided = (['RS', 'TC', 'OD', 'PA', 'DE'] as Strand[]).map((s) => id(s, 3));
    const r = scorePlacement(form, answersFor(form, [id('TC', 1)], voided), run(75));
    expect(r.couldNotAssess).toBe(false);
    expect(r.total).toBeCloseTo(80 * (14 / 15) + 15, 9);
    expect(r.shown).toBe(89);
    expect(r.pass).toBe(false);
  });
});

describe('early stop (03 §7.2)', () => {
  it('stops as soon as passing is impossible, assuming the rest perfect', () => {
    const form = j1Form();
    const partial = (wrong: string[], answered: string[]) =>
      new Map([...answersFor(form, wrong)].filter(([k]) => answered.includes(k) || wrong.includes(k)));
    expect(placementCannotPass(form, partial([id('TC', 0)], []), null)).toBe(false);
    expect(placementCannotPass(form, partial([id('TC', 0), id('TC', 1)], []), null)).toBe(true); // TC 50 %
    expect(placementCannotPass(form, partial([id('RS', 0)], []), null)).toBe(true); // critical item
    expect(placementCannotPass(form, partial([id('TC', 0), id('PA', 0), id('OD', 0)], []), null)).toBe(true); // ≤ 88
    expect(placementCannotPass(form, answersFor(form, [id('TC', 0)]), run(70))).toBe(true);
  });
});

describe('J2 (03 §7.2)', () => {
  it('clamps 4 × units to 10–20 items; the PP-primary units', () => {
    expect([1, 2, 3, 4, 5, 6, 9].map(j2Length)).toEqual([10, 10, 12, 16, 20, 20, 20]);
    expect(PP_PRIMARY_UNITS).toEqual(['b10', 'a10', 'e09', 'm07', 'm08', 'm09']);
  });

  const pool = (units: string[], per: number, strands: Strand[] = ['TC', 'OD']) =>
    units.flatMap((u) => Array.from({ length: per }, (_, k) => choiceItem({ id: `pb-${u}-${k}`, unit: u, strand: strands[k % strands.length] })));

  it('samples every skipped unit, excludes mastered units, and has no J2 within Master', () => {
    const r = assembleJ2({ target: 'b05l1', level: 'basics', skippedUnits: ['b03', 'b04'], placement: pool(['b03', 'b04', 'b05'], 6), practical: [], mastered: new Set(), exposed: new Set(), seed: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.form.items).toHaveLength(10);
    expect(new Set(r.form.items.map((i) => i.unit))).toEqual(new Set(['b03', 'b04']));
    expect(r.form.itemPoints).toBe(100);
    expect(r.form.practical).toBeNull();
    const m = assembleJ2({ target: 'b05l1', level: 'basics', skippedUnits: ['b03', 'b04'], placement: pool(['b03', 'b04'], 10), practical: [], mastered: new Set(['b03']), exposed: new Set(), seed: 1 });
    expect(m.ok && m.form.items.every((i) => i.unit === 'b04')).toBe(true);
    expect(assembleJ2({ target: 'm02l1', level: 'master', skippedUnits: ['m01'], placement: [], practical: [], mastered: new Set(), exposed: new Set(), seed: 1 })).toEqual({ ok: false, reason: 'master' });
  });

  it('with a PP-primary unit: items total 80 and that unit’s placement practical task adds 20', () => {
    const task = { ...choiceItem({ id: 'pb-g1', unit: 'b10' }), type: 'play', equivalentOf: 'b10-g1' } as unknown as AssessmentItem;
    const r = assembleJ2({ target: 'b10l2', level: 'basics', skippedUnits: ['b09', 'b10'], placement: pool(['b09', 'b10'], 6), practical: [task], mastered: new Set(), exposed: new Set(), seed: 1 });
    expect(r.ok && r.form.itemPoints).toBe(80);
    expect(r.ok && r.form.practical?.id).toBe('pb-g1');
    expect(assembleJ2({ target: 'b10l2', level: 'basics', skippedUnits: ['b10'], placement: pool(['b10'], 12), practical: [], mastered: new Set(), exposed: new Set(), seed: 1 })).toEqual({
      ok: false,
      reason: 'no-practical',
    });
  });

  it('J2 with 9 of 10 voided could not be assessed on one answer', () => {
    const items = pool(['b03', 'b04'], 5);
    const form = { items, practical: null, itemPoints: 100 };
    const r = scorePlacement(form, answersFor(form, [], items.slice(1).map((i) => i.id!)), null);
    expect(r.couldNotAssess).toBe(true);
    expect(r.pass).toBe(false);
  });

  it('a strand with fewer than 4 items must be perfect; one with 4 needs 75 %', () => {
    const items = [...pool(['b03'], 8, ['TC']), ...pool(['b04'], 2, ['PA'])];
    const form = { items, practical: null, itemPoints: 100 };
    // 9/10 = exactly 90 with the miss in TC (8 items, 7/8 ≥ 75 %): pass.
    expect(scorePlacement(form, answersFor(form, [items[0].id!]), null).pass).toBe(true);
    // Same total with the miss in PA (2 items): fail.
    const r = scorePlacement(form, answersFor(form, [items[9].id!]), null);
    expect(r.totalOk).toBe(true);
    expect(r.strands.find((s) => s.strand === 'PA')?.ok).toBe(false);
    expect(r.pass).toBe(false);
  });
});

describe('J1 form assembly', () => {
  const level = (prefix: string, units: string[]) =>
    ['TC', 'OD', 'PA', 'DE'].flatMap((s, si) =>
      Array.from({ length: 6 }, (_, k) =>
        choiceItem({ id: `p${prefix}-${si}${k}`, unit: units[k % units.length], strand: s as Strand, side: k % 2 ? 'black' : 'red', nature: k % 3 === 0 ? 'quiet' : 'tactic' }),
      ),
    );
  const rs = Array.from({ length: 8 }, (_, k) =>
    choiceItem({ id: `pb-r${k}`, unit: k < 4 ? 'b08' : `b0${k - 3}`, strand: 'RS', critical: k % 2 === 0, fullBoard: k < 4, side: k % 2 ? 'black' : 'red' }),
  );
  const practical = [{ ...choiceItem({ id: 'pi-g1', unit: 'i11' }), type: 'play', equivalentOf: 'i11-g1' } as unknown as AssessmentItem];
  const input = (over = {}) => ({
    target: 'advanced' as const,
    placement: { basics: [...level('b', ['b03', 'b05', 'b06']), ...rs], intermediate: level('i', ['i01', 'i02', 'i03']) },
    practical,
    skippedUnits: ['b03', 'b05', 'b06', 'b08', 'i01', 'i02', 'i03'],
    mastered: new Set<string>(),
    exposed: new Set<string>(),
    seed: 4,
    ...over,
  });

  it('20 items: 4 per strand, ≥ 2 of 4 from the highest skipped level, RS from the Basic pool (full-board above Intermediate), ≥ 2 RS critical, shares', () => {
    const r = assembleJ1(input());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { items } = r.form;
    expect(items).toHaveLength(20);
    for (const s of STRANDS) expect(items.filter((i) => i.strand === s), s).toHaveLength(4);
    for (const s of ['TC', 'OD', 'PA', 'DE']) expect(items.filter((i) => i.strand === s && i.unit.startsWith('i')).length, s).toBeGreaterThanOrEqual(2);
    const rsItems = items.filter((i) => i.strand === 'RS');
    expect(rsItems.every((i) => i.fullBoard && i.unit === 'b08')).toBe(true);
    expect(rsItems.filter((i) => i.critical).length).toBeGreaterThanOrEqual(2);
    expect(items.filter((i) => i.side === 'black').length).toBeGreaterThanOrEqual(7);
    expect(items.filter((i) => i.nature === 'quiet').length).toBeGreaterThanOrEqual(5);
    expect(r.form.practical?.id).toBe('pi-g1');
    expect(r.form.itemPoints).toBe(80);
    expect(assembleJ1(input()).ok && (assembleJ1(input()) as { form: PlacementForm }).form.items.map((i) => i.id)).toEqual(items.map((i) => i.id));
  });

  it('into Intermediate, RS items need not be full-board; mastered units are excluded; no practical task, no form', () => {
    const r = assembleJ1(input({ target: 'intermediate', placement: { basics: [...level('b', ['b03', 'b05']), ...rs] } }));
    expect(r.ok).toBe(true);
    const m = assembleJ1(input({ mastered: new Set(['b03']) }));
    expect(m.ok && m.form.items.every((i) => i.unit !== 'b03')).toBe(true);
    expect(assembleJ1(input({ practical: [] }))).toEqual({ ok: false, reason: 'no-practical' });
  });
});

describe('outcome (03 §7.4)', () => {
  const form = j1Form();
  const skipped = ['b01l1', 'b02l1', 'b03l1', 'b04l1'].map((l) => ({ lessonId: l, unit: l.slice(0, 3), contentVersion: 1 }));

  it('pass: every skipped lesson completed (placement); covered units mastered; the practical task applies to its unit task', () => {
    const a = answersFor(form, [id('TC', 1)]); // a TC item of b02
    const result = scorePlacement(form, a, run(80, { fallback: 'F2' }));
    expect(result.pass).toBe(true);
    const o = placementOutcome(form, result, a, run(80, { fallback: 'F2' }), skipped, '2026-10-30T10:00:00.000Z')!;
    expect(o.completions.map((c) => c.lessonId)).toEqual(['b01l1', 'b02l1', 'b03l1', 'b04l1']);
    expect(o.completions.every((c) => c.grant.via === 'placement')).toBe(true);
    expect(o.mastered.map((m) => m.unitId)).toEqual(['b01', 'b03', 'b04']);
    expect(o.mastered[0].grant).toMatchObject({ via: 'placement', formId: form.formId, assessmentVersion: 1 });
    expect(o.notCovered).toEqual(['b02']);
    expect(o.applied).toEqual([
      { taskId: 'b10-g1', grant: { at: '2026-10-30T10:00:00.000Z', via: 'placement', score: 80, taskVersion: 2, equivalentOf: 'pb-g1', fallback: 'F2' } },
    ]);
    expect(coveredUnits(form, a)).toEqual(['b01', 'b03', 'b04']);
  });

  it('a unit with no item in the form is not covered', () => {
    const f = { ...form, skippedUnits: [...form.skippedUnits, 'b05'] };
    expect(coveredUnits(f, answersFor(f))).not.toContain('b05');
  });

  it('fail: no grants, and a pointer to the first skipped unit carrying the weakest strand', () => {
    const a = answersFor(form, [id('TC', 1), id('TC', 2)]);
    const result = scorePlacement(form, a, run(100));
    expect(placementOutcome(form, result, a, run(100), skipped, 'x')).toBeNull();
    expect(weakestPointer(form, result)).toEqual({ strand: 'TC', unit: 'b01' });
  });
});

describe('one attempt per target per local day (03 §7.4)', () => {
  const form = j1Form();
  it('counts a started test; "could not be assessed" releases it; the next local day is free', () => {
    const now = new Date(2026, 9, 30, 15, 0);
    const start = placementStartRecord(form, new Date(2026, 9, 30, 9, 0).toISOString());
    expect(placementAvailableToday('J1', 'intermediate', [], now)).toBe(true);
    expect(placementAvailableToday('J1', 'intermediate', [start], now)).toBe(false);
    expect(placementAvailableToday('J1', 'advanced', [start], now)).toBe(true);
    expect(placementAvailableToday('J1', 'intermediate', [start], new Date(2026, 9, 31, 0, 5))).toBe(true);
    const cna = scorePlacement(form, answersFor(form), run(0, { voided: true, voidedRuns: 2 }));
    expect(placementAvailableToday('J1', 'intermediate', [start, placementEndRecord(form, cna, now.toISOString(), false)], now)).toBe(true);
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
