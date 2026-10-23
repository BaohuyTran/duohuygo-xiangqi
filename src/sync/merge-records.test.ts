import { describe, expect, it } from 'vitest';
import {
  emptyRecords,
  parseRecords,
  type ApplicationGrant,
  type CompletionGrant,
  type LearningRecords,
  type MasteryGrant,
} from '../progress/records';
import { mergeRecords, parseRemoteRecords, recordsFingerprint } from './merge-records';

const T1 = '2026-10-20T10:00:00.000Z';
const T2 = '2026-10-21T10:00:00.000Z';
const T3 = '2026-10-22T10:00:00.000Z';

const done = (at: string, via: CompletionGrant['via'] = 'lesson', contentVersion = 1): CompletionGrant => ({ at, via, contentVersion });
const mastery = (score: number, at: string, formId = 'A'): MasteryGrant => ({ at, via: 'check', score, formId, assessmentVersion: 1 });
const applied = (score: number, at: string, taskVersion = 1): ApplicationGrant => ({ at, via: 'practical', score, taskVersion });
const fp = recordsFingerprint;
const records = (patch: Partial<LearningRecords>): LearningRecords => ({ ...emptyRecords(), ...patch });

describe('records merge (T9)', () => {
  it('completed: union by id; same id -> earlier date, then lesson before placement, then string order', () => {
    const local = records({ completed: { b01l1: done(T2), b01l2: done(T1), b01l3: done(T1, 'placement') } });
    const remote = records({ completed: { b01l1: done(T1, 'placement'), b01l3: done(T1, 'lesson'), b02l1: done(T3) } });
    const m = mergeRecords(local, remote);
    expect(m.completed).toEqual({
      b01l1: done(T1, 'placement'), // earlier date wins over via
      b01l2: done(T1),
      b01l3: done(T1, 'lesson'), // same date: lesson < placement
      b02l1: done(T3),
    });
    // Same date and via: deterministic (JSON string order), whichever side is local.
    const a = records({ completed: { x: done(T1, 'lesson', 1) } });
    const b = records({ completed: { x: done(T1, 'lesson', 2) } });
    expect(mergeRecords(a, b).completed.x).toEqual(mergeRecords(b, a).completed.x);
  });

  it('mastered and applied: higher score, tie -> later date, tie -> string order; never lowered', () => {
    const local = records({
      mastered: { b01: mastery(90, T1), b02: mastery(70, T1), b03: mastery(80, T1, 'A') },
      applied: { 'b10-g1': applied(60, T3), 'b10-g2': applied(75, T1) },
    });
    const remote = records({
      mastered: { b01: mastery(60, T3), b02: mastery(70, T2), b03: mastery(80, T1, 'B'), b04: mastery(85, T2) },
      applied: { 'b10-g1': applied(80, T1), 'b10-g2': applied(75, T2) },
    });
    const m = mergeRecords(local, remote);
    expect(m.mastered.b01).toEqual(mastery(90, T1)); // a later, lower check never lowers mastery
    expect(m.mastered.b02).toEqual(mastery(70, T2)); // tie: later date
    expect(m.mastered.b03).toEqual(mergeRecords(remote, local).mastered.b03); // tie: deterministic
    expect(m.mastered.b04).toEqual(mastery(85, T2));
    expect(m.applied).toEqual({ 'b10-g1': applied(80, T1), 'b10-g2': applied(75, T2) });
  });

  it('exposed: union, sorted', () => {
    const m = mergeRecords(records({ exposed: ['b05-c02', 'b05-c01'] }), records({ exposed: ['b05-c01', 'pb-03'] }));
    expect(m.exposed).toEqual(['b05-c01', 'b05-c02', 'pb-03']);
  });

  it('no remote records: the local records unchanged', () => {
    const local = records({ completed: { b01l1: done(T1) } });
    expect(mergeRecords(local, null)).toBe(local);
    expect(parseRemoteRecords(null)).toBeNull();
    expect(parseRemoteRecords(undefined)).toBeNull();
  });

  it('keeps unknown top-level fields (local value, else remote) and never lowers a higher schema', () => {
    const local = parseRecords({ schema: 1, notes: 'local', a: 1 });
    const remote = parseRecords({ schema: 3, notes: 'remote', streaks: { x: 1 } });
    const m = mergeRecords(local, remote);
    expect(m.schema).toBe(3);
    expect(m).toMatchObject({ notes: 'local', a: 1, streaks: { x: 1 } });
    expect(mergeRecords(remote, local).schema).toBe(3);
  });

  it('an unknown field named __proto__ stays plain data', () => {
    const remote = parseRecords(JSON.parse('{"__proto__": {"polluted": true}}'));
    const m = mergeRecords(emptyRecords(), remote);
    expect(Object.getPrototypeOf(m)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  // ---- Properties over seeded random records ----

  function rng(seed: number) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const DATES = [T1, T2, T3, '2026-10-21T10:00:00Z'];
  function randomRecords(random: () => number): LearningRecords {
    const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)];
    const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`).filter(() => random() < 0.5);
    return {
      schema: pick([1, 1, 2]),
      completed: Object.fromEntries(ids('l', 6).map((id) => [id, done(pick(DATES), pick(['lesson', 'placement'] as const), pick([1, 2]))])),
      mastered: Object.fromEntries(ids('u', 5).map((id) => [id, mastery(pick([60, 80, 80, 100]), pick(DATES), pick(['A', 'B']))])),
      applied: Object.fromEntries(ids('g', 5).map((id) => [id, applied(pick([50, 75, 75]), pick(DATES), pick([1, 2]))])),
      exposed: ids('c', 8),
    };
  }
  it('is idempotent, commutative and monotone (300 seeded pairs)', () => {
    const random = rng(2026);
    for (let n = 0; n < 300; n++) {
      const l = randomRecords(random);
      const r = randomRecords(random);
      const m = mergeRecords(l, r);
      expect(fp(mergeRecords(m, r))).toBe(fp(m));
      expect(fp(mergeRecords(m, l))).toBe(fp(m));
      expect(fp(mergeRecords(m, m))).toBe(fp(m));
      expect(fp(mergeRecords(r, l))).toBe(fp(m));
      // Associative too, so any sync order of three devices converges.
      const x = randomRecords(random);
      expect(fp(mergeRecords(mergeRecords(l, r), x))).toBe(fp(mergeRecords(l, mergeRecords(r, x))));
      // Monotone: nothing is lost, no score goes down.
      for (const side of [l, r]) {
        for (const id of Object.keys(side.completed)) expect(m.completed[id]).toBeDefined();
        for (const id of Object.keys(side.mastered)) expect(m.mastered[id].score).toBeGreaterThanOrEqual(side.mastered[id].score);
        for (const id of Object.keys(side.applied)) expect(m.applied[id].score).toBeGreaterThanOrEqual(side.applied[id].score);
        for (const id of side.exposed) expect(m.exposed).toContain(id);
        expect(m.schema).toBeGreaterThanOrEqual(side.schema);
      }
      // The result is valid records: reading it back changes nothing.
      expect(fp(parseRecords(JSON.parse(JSON.stringify(m))))).toBe(fp(m));
    }
  });
});

describe('remote data_v2 corrupt or newer (T12, remote part)', () => {
  it('ignores a corrupt remote value or corrupt fields, never removing local data', () => {
    const local = records({ completed: { b01l1: done(T1) }, mastered: { b01: mastery(80, T1) }, exposed: ['c1'] });
    for (const raw of ['garbage', 42, [], true, { completed: 'x', mastered: [1], applied: null, exposed: 'c9' }]) {
      expect(fp(mergeRecords(local, parseRemoteRecords(raw)))).toBe(fp(local));
    }
    const partly = parseRemoteRecords({
      completed: { b01l2: done(T2), bad: { at: 'today', via: 'lesson', contentVersion: 1 } },
      mastered: { b01: { ...mastery(100, T2), score: 120 }, b02: mastery(70, T2) },
      exposed: ['c2', 5, ''],
    });
    const m = mergeRecords(local, partly);
    expect(Object.keys(m.completed)).toEqual(['b01l1', 'b01l2']);
    expect(m.mastered).toEqual({ b01: mastery(80, T1), b02: mastery(70, T2) });
    expect(m.exposed).toEqual(['c1', 'c2']);
  });

  it('preserves a higher remote schema and its unknown fields', () => {
    const m = mergeRecords(emptyRecords(), parseRemoteRecords({ schema: 4, completed: {}, review: { due: ['b01l1'] } }));
    expect(m.schema).toBe(4);
    expect(m.review).toEqual({ due: ['b01l1'] });
  });
});

describe('records fingerprint', () => {
  it('ignores key order and exposed order, sees every other difference', () => {
    const a = records({ completed: { x: done(T1), y: done(T2) }, exposed: ['b', 'a'] });
    const b = { exposed: ['a', 'b'], completed: { y: { contentVersion: 1, via: 'lesson', at: T2 }, x: done(T1) }, applied: {}, mastered: {}, schema: 1 };
    expect(recordsFingerprint(a)).toBe(recordsFingerprint(b));
    expect(recordsFingerprint(a)).not.toBe(recordsFingerprint({ ...a, schema: 2 }));
    expect(recordsFingerprint(a)).not.toBe(recordsFingerprint({ ...a, completed: { x: done(T1) } }));
    expect(recordsFingerprint(null)).not.toBe(recordsFingerprint(emptyRecords()));
  });
});
