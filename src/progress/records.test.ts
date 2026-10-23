import { describe, expect, it } from 'vitest';
import {
  ATTEMPT_LOG_CAP,
  RECORDS_SCHEMA,
  betterCompletion,
  betterScored,
  emptyRecords,
  isFirstRealCompletion,
  parseAttempts,
  parseRecords,
  type AttemptRecord,
  type MasteryGrant,
} from './records';

const at = '2026-10-20T10:00:00.000Z';
const completion = { at, via: 'lesson', contentVersion: 1 } as const;
const mastery: MasteryGrant = { at, via: 'check', score: 85, formId: 'b05-A', assessmentVersion: 1 };
const application = { at, via: 'practical', score: 70, taskVersion: 1 } as const;

describe('parseRecords', () => {
  it('reads anything that is not an object as empty records (T12)', () => {
    for (const raw of [null, undefined, 42, 'x', [], [1, 2], true]) expect(parseRecords(raw)).toEqual(emptyRecords());
  });

  it('keeps valid grants, including the optional fallback on application grants', () => {
    const raw = {
      schema: 1,
      completed: { b05l1: completion, b05l2: { ...completion, via: 'placement' } },
      mastered: { b05: { ...mastery, strandScores: { RS: 90, TC: 70 } } },
      applied: { 'b10-g1': { ...application, fallback: 'F1c' }, 'pb-g1': { ...application, via: 'placement', equivalentOf: 'b10-g1' } },
      exposed: ['b05-c01', 'b05-c02'],
    };
    expect(parseRecords(raw)).toEqual(raw);
  });

  it('treats a non-object section as empty, and a non-array exposed as empty (T12)', () => {
    const r = parseRecords({ completed: [completion], mastered: 'x', applied: null, exposed: { a: 1 } });
    expect(r).toEqual(emptyRecords());
  });

  it('drops individual entries with an invalid at, score, via, version or fallback (T12)', () => {
    const r = parseRecords({
      completed: {
        ok: completion,
        badAt: { ...completion, at: 'yesterday' },
        noAt: { via: 'lesson', contentVersion: 1 },
        badVia: { ...completion, via: 'migration' },
        badVersion: { ...completion, contentVersion: -1 },
        notObject: 'done',
      },
      mastered: {
        ok: mastery,
        nan: { ...mastery, score: Number.NaN },
        high: { ...mastery, score: 101 },
        low: { ...mastery, score: -1 },
        str: { ...mastery, score: '90' },
        badVia: { ...mastery, via: 'lesson' },
        noForm: { ...mastery, formId: '' },
      },
      applied: {
        ok: application,
        badFallback: { ...application, fallback: 'F9' },
        badVia: { ...application, via: 'check' },
        inf: { ...application, score: Number.POSITIVE_INFINITY },
        badEquivalent: { ...application, equivalentOf: 3 },
      },
      exposed: ['a', '', 7, 'a', 'b'],
    });
    expect(Object.keys(r.completed)).toEqual(['ok']);
    expect(Object.keys(r.mastered)).toEqual(['ok']);
    expect(Object.keys(r.applied)).toEqual(['ok']);
    expect(r.exposed).toEqual(['a', 'b']);
  });

  it('drops an invalid strand map or strand score but keeps the mastery grant', () => {
    expect(parseRecords({ mastered: { u: { ...mastery, strandScores: 'x' } } }).mastered.u).toEqual(mastery);
    expect(parseRecords({ mastered: { u: { ...mastery, strandScores: { RS: 120, XX: 50, TC: 40 } } } }).mastered.u).toEqual({
      ...mastery,
      strandScores: { TC: 40 },
    });
  });

  it('keeps unknown ids, unknown top-level fields, unknown grant fields and a higher schema', () => {
    const r = parseRecords({
      schema: 3,
      completed: { 'z99l9-not-in-content': { ...completion, reviewer: 'x' } },
      futureField: { a: [1] },
    });
    expect(r.schema).toBe(3);
    expect(r.futureField).toEqual({ a: [1] });
    expect(r.completed['z99l9-not-in-content']).toEqual({ ...completion, reviewer: 'x' });
    expect(parseRecords({ schema: 0 }).schema).toBe(RECORDS_SCHEMA);
    expect(parseRecords({ schema: 'two' }).schema).toBe(RECORDS_SCHEMA);
  });

  it('never lets an id change the prototype', () => {
    const r = parseRecords(JSON.parse(`{"completed": {"__proto__": ${JSON.stringify(completion)}}}`));
    expect(Object.getPrototypeOf(r.completed)).toBe(Object.prototype);
    expect(Object.hasOwn(r.completed, '__proto__')).toBe(true);
    expect(isFirstRealCompletion(r, 'constructor')).toBe(true);
  });

  it('is idempotent through JSON', () => {
    const once = parseRecords({ schema: 2, completed: { a: completion, b: 1 }, other: true, exposed: ['x', 'x'] });
    expect(parseRecords(JSON.parse(JSON.stringify(once)))).toEqual(once);
  });
});

describe('attempt log', () => {
  const attempt = (i: number): AttemptRecord => ({ itemId: `b05l2-0${i % 10}`, itemVersion: 1, mode: 'practice', at, credit: 1 });

  it('keeps valid entries only and the newest ATTEMPT_LOG_CAP', () => {
    expect(ATTEMPT_LOG_CAP).toBe(2000);
    expect(parseAttempts({})).toEqual([]);
    expect(parseAttempts([attempt(1), { ...attempt(2), credit: 2 }, { ...attempt(3), mode: 'quiz' }, 'x', { ...attempt(4), at: 'now' }])).toEqual([
      attempt(1),
    ]);
    const long = Array.from({ length: 2005 }, (_, i) => ({ ...attempt(i), seed: i }));
    const kept = parseAttempts(long);
    expect(kept).toHaveLength(2000);
    expect(kept[0].seed).toBe(5);
    expect(kept[1999].seed).toBe(2004);
  });
});

describe('scored grants and first completion', () => {
  it('prefers the higher score, then the later date, deterministically', () => {
    const later = { ...mastery, at: '2026-10-21T10:00:00.000Z' };
    expect(betterScored(mastery, { ...mastery, score: 90 }).score).toBe(90);
    expect(betterScored(later, mastery)).toBe(later);
    expect(betterScored(mastery, later)).toBe(later);
    const a = { ...mastery, formId: 'A' };
    const b = { ...mastery, formId: 'B' };
    expect(betterScored(a, b)).toBe(betterScored(b, a));
  });

  it('keeps the earlier completion, then lesson before placement, deterministically', () => {
    const a = { at: '2026-10-20T10:00:00.000Z', via: 'placement' as const, contentVersion: 1 };
    const b = { at: '2026-10-21T10:00:00.000Z', via: 'lesson' as const, contentVersion: 1 };
    expect(betterCompletion(a, b)).toBe(a);
    expect(betterCompletion(b, a)).toBe(a);
    const c = { ...a, via: 'lesson' as const };
    expect(betterCompletion(a, c)).toBe(c);
    expect(betterCompletion(c, a)).toBe(c);
    const d = { ...c, contentVersion: 2 };
    expect(betterCompletion(c, d)).toBe(betterCompletion(d, c));
  });

  it('counts only stored grants as completions for XP (MU4)', () => {
    const r = parseRecords({ completed: { b05l1: completion } });
    expect(isFirstRealCompletion(r, 'b05l1')).toBe(false);
    expect(isFirstRealCompletion(r, 'b05l2')).toBe(true);
  });
});

describe('progress purity (T17)', () => {
  it('src/progress has no gamification, React, DOM or storage imports', () => {
    const sources = import.meta.glob(['./*.ts', '!./*.test.ts'], { query: '?raw', import: 'default', eager: true });
    expect(Object.keys(sources).sort()).toEqual(expect.arrayContaining(['./legacy.ts', './records.ts']));
    const offenders = Object.entries(sources)
      .filter(([, src]) =>
        /from\s+['"](react|react-dom)(\/[^'"]*)?['"]|from\s+['"][./]*\/?gamification|from\s+['"][./]*\/?storage|localStorage|document\.|window\./.test(
          src as string,
        ),
      )
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
