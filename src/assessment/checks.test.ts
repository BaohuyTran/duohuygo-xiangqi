import { describe, expect, it } from 'vitest';
import type { AssessmentItem, Exercise, Unit } from '../content/types';
import type { AttemptRecord } from '../progress/records';
import {
  assembleCheckForm,
  CHECK_LENGTH,
  checkConstraints,
  checkGrant,
  checkLength,
  checkQuitRecord,
  lastCheckOutcome,
  checkStatus,
  checkSummaryRecord,
  isFromUnit,
  remediationSet,
  scoreCheck,
  warmUpItems,
  warmUpSuggestions,
  type CheckForm,
  type CheckFormInput,
} from './checks';
import type { ScoredAnswer } from './credit';
import { b08CheckPool, b09CheckPool, choiceItem } from './test-fixtures';

const input = (over: Partial<CheckFormInput> = {}): CheckFormInput => {
  const pool = b09CheckPool();
  return {
    unit: 'b09',
    objectives: ['b09l1', 'b09l2', 'b09l3'],
    primaryStrand: 'OD',
    poolId: pool.id,
    assessmentVersion: pool.version,
    own: pool.items,
    earlier: b08CheckPool().items,
    exposed: new Set(),
    seed: 1,
    ...over,
  };
};

const formOf = (over: Partial<CheckFormInput> = {}): CheckForm => {
  const r = assembleCheckForm(input(over));
  if (!r.ok) throw new Error(r.reason);
  return r.form;
};

const answers = (form: { items: AssessmentItem[] }, wrong: string[] = [], voided: string[] = []) =>
  new Map<string, ScoredAnswer>(form.items.map((i) => [i.id!, { itemId: i.id!, credit: wrong.includes(i.id!) || voided.includes(i.id!) ? 0 : 1, voided: voided.includes(i.id!) }]));

describe('check length and units', () => {
  it('8 items; short form 6 for b01, b10, e09, m07; m09 has no check (mastered by xm)', () => {
    expect(checkLength('b09')).toBe(CHECK_LENGTH);
    for (const u of ['b01', 'b10', 'e09', 'm07']) expect(checkLength(u), u).toBe(6);
    expect(checkLength('m09')).toBeNull();
    // b10, e09 and m07 are reachable by checks.
    for (const u of ['b10', 'e09', 'm07']) expect(checkLength(u)).not.toBeNull();
  });

  it('"from bNN on" covers later Basic units and every higher level', () => {
    expect(isFromUnit('b02', 'b03')).toBe(false);
    expect(isFromUnit('b03', 'b03')).toBe(true);
    expect(isFromUnit('b10', 'b08')).toBe(true);
    expect(isFromUnit('i01', 'b08')).toBe(true);
    expect(isFromUnit('m07', 'b02')).toBe(true);
  });
});

describe('form assembly (03 §4.1, §4.3)', () => {
  it('honours the blueprint: 6 own + 2 interleaved, every objective, ≥ 1/3 Black, ≥ 1/4 quiet, ≥ 1 critical', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const form = formOf({ seed });
      expect(form.items).toHaveLength(8);
      expect(form.items.filter((i) => i.unit === 'b09')).toHaveLength(6);
      expect(form.items.filter((i) => i.unit === 'b08')).toHaveLength(2);
      for (const l of ['b09l1', 'b09l2', 'b09l3']) expect(form.items.some((i) => i.unit === 'b09' && i.objective === l), l).toBe(true);
      expect(form.items.filter((i) => i.side === 'black').length).toBeGreaterThanOrEqual(3);
      expect(form.items.filter((i) => i.nature === 'quiet').length).toBeGreaterThanOrEqual(2);
      expect(form.items.some((i) => i.critical)).toBe(true);
      expect(new Set(form.items.map((i) => i.id)).size).toBe(8);
    }
  });

  it('is deterministic per seed and varies with the seed', () => {
    const ids = (seed: number) => formOf({ seed }).items.map((i) => i.id);
    expect(ids(7)).toEqual(ids(7));
    expect(new Set([1, 2, 3, 4, 5, 6].map((s) => ids(s).join())).size).toBeGreaterThan(1);
  });

  it('prefers interleaved items sharing a strand with the unit', () => {
    const offStrand = [choiceItem({ id: 'b07-c01', unit: 'b07', strand: 'DE', point: 24 }), choiceItem({ id: 'b07-c02', unit: 'b07', strand: 'DE', point: 25 })];
    for (const seed of [1, 2, 3]) {
      const form = formOf({ seed, earlier: [...offStrand, ...b08CheckPool().items] });
      expect(form.items.filter((i) => i.unit !== 'b09').every((i) => i.strand !== 'DE')).toBe(true);
    }
  });

  it('b01 and b02 have no interleaving; i08 is Red only, i09 Black only; quiet only for PA / OD / DE units', () => {
    const labels = (unit: string, primary?: 'TC' | 'PA') => checkConstraints({ unit, objectives: [], primaryStrand: primary }, 8);
    expect(labels('b02').needs.map((n) => n.label)).not.toContain('interleaved');
    expect(labels('b01').needs.map((n) => n.label)).not.toContain('black');
    expect(labels('b02').needs.map((n) => n.label)).toContain('black');
    expect(labels('i08').caps.map((c) => c.label)).toContain('red-only');
    expect(labels('i09').caps.map((c) => c.label)).toContain('black-only');
    expect(labels('i03', 'TC').needs.map((n) => n.label)).not.toContain('quiet');
    expect(labels('a03', 'PA').needs.find((n) => n.label === 'quiet')?.min).toBe(2);
    expect(labels('b07').needs.map((n) => n.label)).not.toContain('critical');
    expect(labels('b08').needs.map((n) => n.label)).toContain('critical');
  });

  it('avoids exposed items whenever an exposure-free form exists', () => {
    const first = formOf({ seed: 1 });
    const exposed = new Set(first.items.map((i) => i.id!));
    const second = formOf({ seed: 2, exposed });
    // Is there a form without any of them? (Build one from the unexposed items only.)
    const free = assembleCheckForm(input({ seed: 2, own: b09CheckPool().items.filter((i) => !exposed.has(i.id!)), earlier: b08CheckPool().items.filter((i) => !exposed.has(i.id!)) }));
    expect(second.exposedCount === 0).toBe(free.ok);
    // A few exposed items are always avoided in a pool this size.
    const some = new Set(['b09-c04', 'b09-c05', 'b09-c08']);
    for (const seed of [1, 2, 3]) {
      const f = formOf({ seed, exposed: some });
      expect(f.exposedCount).toBe(0);
      expect(f.items.some((i) => some.has(i.id!))).toBe(false);
    }
  });

  it('falls back to at most half exposed items, then reports the check unavailable', () => {
    const own = b09CheckPool().items;
    // Only two unexposed own items left: 6 own needed, so 4 exposed (half of 8).
    const most = new Set(own.slice(2).map((i) => i.id!));
    const r = assembleCheckForm(input({ exposed: most, earlier: b08CheckPool().items }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.form.exposedCount).toBe(4);
    // Everything exposed: more than half would be exposed, so no form.
    const all = new Set([...own, ...b08CheckPool().items].map((i) => i.id!));
    expect(assembleCheckForm(input({ exposed: all }))).toEqual({ ok: false, reason: 'cannot-build' });
    expect(assembleCheckForm(input({ unit: 'm09' }))).toEqual({ ok: false, reason: 'no-check' });
  });
});

describe('mastery boundaries (03 §10)', () => {
  const eight = Array.from({ length: 8 }, (_, i) => choiceItem({ id: `b09-c${i + 1}`, unit: 'b09', critical: i === 0, point: i }));
  const six = eight.slice(0, 6);

  it('7/8 with every critical item right → mastered; 7/8 with the critical one missed → not; 6/8 → not', () => {
    expect(scoreCheck({ items: eight }, answers({ items: eight }, ['b09-c8'])).mastered).toBe(true);
    const missedCritical = scoreCheck({ items: eight }, answers({ items: eight }, ['b09-c1']));
    expect(missedCritical.mastered).toBe(false);
    expect(missedCritical.criticalMissed).toEqual(['b09-c1']);
    const r = scoreCheck({ items: eight }, answers({ items: eight }, ['b09-c7', 'b09-c8']));
    expect(r.score).toBe(75);
    expect(r.mastered).toBe(false);
  });

  it('short form: 5/6 → mastered (83.3); 4/6 → not', () => {
    const r = scoreCheck({ items: six }, answers({ items: six }, ['b09-c6']));
    expect(r.shown).toBe(83);
    expect(r.mastered).toBe(true);
    expect(scoreCheck({ items: six }, answers({ items: six }, ['b09-c5', 'b09-c6'])).mastered).toBe(false);
  });

  it('voided answers leave numerator and denominator; a voided critical item makes the check incomplete', () => {
    const r = scoreCheck({ items: eight }, answers({ items: eight }, [], ['b09-c8']));
    expect(r.score).toBe(100);
    expect(r.mastered).toBe(true);
    const c = scoreCheck({ items: eight }, answers({ items: eight }, [], ['b09-c1']));
    expect(c.incomplete).toBe(true);
    expect(c.mastered).toBe(false);
  });

  it('voids that break the §4.1 coverage make the check incomplete, never mastered', () => {
    // 7 of 8 voided, 1 correct.
    const r = scoreCheck({ items: eight }, answers({ items: eight }, [], eight.slice(1).map((i) => i.id!)));
    expect(r.incomplete).toBe(true);
    expect(r.mastered).toBe(false);
    // A real form (6 own + 2 interleaved): one own item voided leaves 5 < 6 own items.
    const form = formOf();
    const ownVoid = form.items.find((i) => i.unit === 'b09' && !i.critical)!.id!;
    expect(scoreCheck(form, answers(form, [], [ownVoid])).incomplete).toBe(true);
    // An interleaved (non-critical) item voided keeps the coverage: decided.
    const interleavedVoid = form.items.find((i) => i.unit === 'b08' && !i.critical);
    if (interleavedVoid) expect(scoreCheck(form, answers(form, [], [interleavedVoid.id!])).incomplete).toBe(false);
    // Every item of one objective voided: incomplete.
    const objectiveItems = [choiceItem({ id: 'x1', unit: 'b09', objective: 'b09l2', point: 9 })];
    const nine = [...eight, ...objectiveItems];
    expect(scoreCheck({ items: nine }, answers({ items: nine }, [], ['x1'])).incomplete).toBe(true);
  });

  it('the grant records provenance, date, score, strand scores, form and version', () => {
    const form = formOf();
    const result = scoreCheck(form, answers(form));
    expect(checkGrant(form, result, '2026-10-30T10:00:00.000Z')).toEqual({
      at: '2026-10-30T10:00:00.000Z',
      via: 'check',
      score: 100,
      strandScores: expect.any(Object),
      formId: form.formId,
      assessmentVersion: 1,
    });
    expect(checkGrant(form, scoreCheck(form, answers(form, form.items.slice(0, 2).map((i) => i.id!))), 'x')).toBeNull();
  });
});

// ---------- Remediation and retake (03 §4.3, §4.4) ----------

const practiceItem = (id: string, assist: 'G1' | 'G0' | 'G2'): Exercise => ({ ...choiceItem({ id, unit: 'b09' }), assist }) as Exercise;
const card = (id: string, misconceptions: string[]): Exercise =>
  ({ type: 'learn', id, version: 1, status: 'published', source: { kind: 'authored' }, side: 'red', pieces: { d0: 'K', f9: 'k' }, text: 'u1l1.e3', misconceptions }) as Exercise;
const units: Unit[] = [
  {
    id: 'b09',
    track: 'basics',
    title: 'u1.title',
    description: 'u1.desc',
    lessons: [
      { id: 'b09l1', title: 'u1l1.title', exercises: [card('b09l1-01', ['b09.m1']), practiceItem('b09l1-02', 'G1')] },
      { id: 'b09l2', title: 'u1l1.title', exercises: [card('b09l2-01', []), practiceItem('b09l2-02', 'G2'), practiceItem('b09l2-03', 'G1'), practiceItem('b09l2-04', 'G0')] },
    ],
  },
];
const at = (day: number) => `2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`;
const log = (itemId: string, day: number, over: Partial<AttemptRecord> = {}): AttemptRecord => ({ itemId, itemVersion: 1, mode: 'practice', at: at(day), credit: 1, ...over });

describe('remediation set and retake', () => {
  const failed = [{ itemId: 'b09-c03', objective: 'b09l2', unit: 'b09', misconception: 'b09.m1' }];

  it('per failed objective: the lesson’s G1/G0 items not yet right first time, plus the learn card of the misconception', () => {
    const set = remediationSet(failed, units, [log('b09l2-04', 1)]);
    expect(set.lessons).toEqual(['b09l2']);
    expect(set.items.map((e) => e.id)).toEqual(['b09l2-03']);
    expect(set.cards.map((e) => e.id)).toEqual(['b09l1-01']);
    // A hint before the first answer does not count as right first time.
    expect(remediationSet(failed, units, [log('b09l2-04', 1, { hintBeforeFirstAnswer: true })]).items.map((e) => e.id)).toEqual(['b09l2-03', 'b09l2-04']);
  });

  it('a failed check waits for the remediation; practising the set unlocks the retake; mastery ends it', () => {
    const form = formOf();
    const result = scoreCheck(form, answers(form, form.items.slice(0, 3).map((i) => i.id!)));
    const summary = { ...checkSummaryRecord(form, result, at(10)), failed };
    const unit = units[0];
    const status = checkStatus(unit, { mastered: false, attempts: [summary], units });
    expect(status.kind).toBe('remediation');
    const done = checkStatus(unit, { mastered: false, attempts: [summary, log('b09l2-03', 11, { credit: 0 }), log('b09l2-04', 11)], units });
    expect(done.kind).toBe('available');
    expect(checkStatus(unit, { mastered: true, attempts: [summary], units }).kind).toBe('mastered');
    expect(checkStatus(unit, { mastered: false, attempts: [], units }).kind).toBe('available');
    expect(checkStatus({ ...unit, id: 'm09' }, { mastered: false, attempts: [], units }).kind).toBe('no-check');
  });

  it('a quit after a non-voided wrong answer counts as failed for the retake rule; otherwise the quit is neutral', () => {
    const form = formOf();
    const [first, second] = form.items;
    const partial = (entries: [string, ScoredAnswer][]) => new Map(entries);
    expect(checkQuitRecord(form, partial([]), at(10))).toBeNull();
    expect(checkQuitRecord(form, partial([[first.id!, { itemId: first.id!, credit: 1, voided: false }]]), at(10))).toBeNull();
    expect(checkQuitRecord(form, partial([[first.id!, { itemId: first.id!, credit: 0, voided: true }]]), at(10))).toBeNull();
    const quit = checkQuitRecord(
      form,
      partial([
        [first.id!, { itemId: first.id!, credit: 1, voided: false }],
        [second.id!, { itemId: second.id!, credit: 0, voided: false }],
      ]),
      at(10),
    )!;
    expect(quit).toMatchObject({ itemId: 'b09-check', outcome: 'failed', quit: true, failed: [{ itemId: second.id }] });
    expect(lastCheckOutcome('b09', [quit])).toBe('failed');
    // With a remediation set to practise, the retake waits for it.
    const withFailedObjective = { ...quit, failed: [{ itemId: second.id!, objective: 'b09l2', unit: 'b09' }] };
    expect(checkStatus(units[0], { mastered: false, attempts: [withFailedObjective], units }).kind).toBe('remediation');
  });

  it('voided practice does not count as remediation done', () => {
    const form = formOf();
    const result = scoreCheck(form, answers(form, form.items.slice(0, 3).map((i) => i.id!)));
    const summary = { ...checkSummaryRecord(form, result, at(10)), failed: [{ itemId: 'b09-c03', objective: 'b09l2', unit: 'b09' }] };
    const voidedPractice = [log('b09l2-03', 11, { voided: true, credit: 0 }), log('b09l2-04', 11, { voided: true, credit: 0 })];
    expect(checkStatus(units[0], { mastered: false, attempts: [summary, ...voidedPractice], units }).kind).toBe('remediation');
  });

  it('an incomplete check never blocks a retake', () => {
    const form = formOf();
    const result = scoreCheck(form, new Map());
    expect(result.incomplete).toBe(true);
    expect(checkStatus(units[0], { mastered: false, attempts: [checkSummaryRecord(form, result, at(10))], units }).kind).toBe('available');
  });
});

describe('warm-up after a long break (03 §4.5, UA1: suggestions only)', () => {
  const items = b09CheckPool().items;
  const ctx = (attempts: AttemptRecord[], exposed: string[] = []) => ({ attempts, mastered: new Set(['b09']), checkItems: items, exposed: new Set(exposed), seed: 3 });

  it('offers up to 5 unexposed check items of mastered units after 30 days without activity', () => {
    const now = new Date('2026-12-01T10:00:00.000Z');
    const w = warmUpItems(now, ctx([log('x', 1)]));
    expect(w).toHaveLength(5);
    expect(w!.every((i) => i.unit === 'b09')).toBe(true);
    expect(warmUpItems(now, ctx([log('x', 1)], items.map((i) => i.id!)))).toBeNull();
    expect(warmUpItems(new Date('2026-10-20T10:00:00.000Z'), ctx([log('x', 1)]))).toBeNull();
    expect(warmUpItems(now, ctx([]))).toBeNull();
    expect(warmUpItems(now, { ...ctx([log('x', 1)]), mastered: new Set() })).toBeNull();
  });

  it('suggests the lessons of missed items; voided answers suggest nothing', () => {
    const w = items.slice(0, 3);
    const a = new Map<string, ScoredAnswer>([
      [w[0].id!, { itemId: w[0].id!, credit: 0, voided: false }],
      [w[1].id!, { itemId: w[1].id!, credit: 1, voided: false }],
      [w[2].id!, { itemId: w[2].id!, credit: 0, voided: true }],
    ]);
    expect(warmUpSuggestions(w, a)).toEqual([w[0].objective]);
  });
});
