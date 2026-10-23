import { describe, expect, it } from 'vitest';
import { initialState, lessonXp } from '../gamification';
import {
  createGamificationRepository,
  createLearningRepository,
  createMemoryStore,
  createProgressRepository,
  readSnapshot,
  writeSnapshot,
  type KeyValueStore,
} from '../storage';
import { mergeSnapshots, parseRemote, toRemote } from '../sync/merge';
import { LEGACY_MAP, LEGACY_MAP_VERSION, completedView, legacyCompletion, type LegacyMap } from './legacy';
import { emptyRecords, isFirstRealCompletion, parseRecords, type CompletionGrant } from './records';

/** The 9 orphan ids of 05-migration.md §6 (legacy-orphans table). */
const ORPHANS = ['u2l3', 'u3l3', 'u4l3', 'u5l1', 'u5l2', 'u5l3', 'u6l1', 'u6l2', 'u6l3'];

/** A map shaped like a later release (05 §8.5 cases), used to exercise the derivation itself. */
const TEST_MAP: LegacyMap = {
  ...LEGACY_MAP,
  u7l1: ['i01l1'], // single successor
  u10l1: ['i05l2', 'e02l1'], // split
  u13l2: ['e01l3'], // many-to-one
  u13l3: ['e01l3'],
  u14l1: ['e01l3'],
};

const grant: CompletionGrant = { at: '2026-10-22T09:00:00.000Z', via: 'lesson', contentVersion: 2 };

/** Seeded PRNG (mulberry32) so the random cases are reproducible. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function spyStore(initial: Record<string, string> = {}) {
  const inner = createMemoryStore(initial);
  const writes: string[] = [];
  const store: KeyValueStore = {
    get: inner.get,
    set: (k, v) => {
      writes.push(k);
      inner.set(k, v);
    },
    remove: (k) => {
      writes.push(k);
      inner.remove(k);
    },
  };
  return { store, writes };
}

describe('LEGACY_MAP version 1 (release state REL-P)', () => {
  it('lists exactly the 9 orphans, each with no target', () => {
    expect(LEGACY_MAP_VERSION).toBe(1);
    expect(Object.keys(LEGACY_MAP).sort()).toEqual(ORPHANS);
    for (const id of ORPHANS) expect(LEGACY_MAP[id]).toEqual([]);
    expect(Object.isFrozen(LEGACY_MAP)).toBe(true);
  });

  it('derives nothing from any of today\'s 36 lessons or the orphans', () => {
    const today = ['u1l1', 'u1l2', 'u1l3', 'u2l1', 'u2l2', 'u3l1', 'u3l2', 'u4l1', 'u4l2', 'u7l1', 'u15l3'];
    expect(legacyCompletion([...today, ...ORPHANS]).size).toBe(0);
  });
});

describe('legacyCompletion (T3)', () => {
  it('maps a single successor', () => {
    expect([...legacyCompletion(['u7l1'], TEST_MAP)]).toEqual([['i01l1', { via: 'migration', from: ['u7l1'], at: null }]]);
  });

  it('maps a split lesson to each of its successors', () => {
    const view = legacyCompletion(['u10l1'], TEST_MAP);
    expect([...view.keys()]).toEqual(['e02l1', 'i05l2']);
    expect(view.get('e02l1')).toEqual({ via: 'migration', from: ['u10l1'], at: null });
  });

  it('completes a many-to-one target when any source is completed, listing all of them', () => {
    expect(legacyCompletion(['u13l3'], TEST_MAP).get('e01l3')).toEqual({ via: 'migration', from: ['u13l3'], at: null });
    expect(legacyCompletion(['u14l1', 'u13l2', 'u13l3'], TEST_MAP).get('e01l3')?.from).toEqual(['u13l2', 'u13l3', 'u14l1']);
  });

  it('ignores orphans, unknown ids and duplicates', () => {
    expect(legacyCompletion([...ORPHANS, 'nope', 'u99l1', ''], TEST_MAP).size).toBe(0);
    expect([...legacyCompletion(['u7l1', 'u7l1', 'u7l1'], TEST_MAP)]).toEqual([['i01l1', { via: 'migration', from: ['u7l1'], at: null }]]);
  });

  it('gives nothing for an empty or corrupt list, and never reads Object.prototype', () => {
    expect(legacyCompletion([], TEST_MAP).size).toBe(0);
    for (const corrupt of [null, undefined, 'u7l1', { u7l1: true }, 5]) {
      expect(legacyCompletion(corrupt as unknown as string[], TEST_MAP).size).toBe(0);
    }
    expect(legacyCompletion([1, null, {}, ['u7l1']] as unknown as string[], TEST_MAP).size).toBe(0);
    expect(legacyCompletion(['constructor', '__proto__', 'toString', 'hasOwnProperty'], TEST_MAP).size).toBe(0);
  });

  it('a corrupt stored v1 list gives no legacy completion', () => {
    const store = createMemoryStore({ 'progress.completedLessons.v1': '{"u7l1": true' });
    expect(legacyCompletion(createProgressRepository(store).completedLessons(), TEST_MAP).size).toBe(0);
  });

  it('is order-independent and idempotent', () => {
    const ids = ['u13l2', 'u7l1', 'u10l1', 'u14l1'];
    const a = legacyCompletion(ids, TEST_MAP);
    expect(legacyCompletion([...ids].reverse(), TEST_MAP)).toEqual(a);
    expect(legacyCompletion([...ids, ...ids], TEST_MAP)).toEqual(a);
  });
});

describe('migration never yields mastered or applied (T4)', () => {
  it('for every map entry and for random id sets', () => {
    const pool = [...Object.keys(TEST_MAP), 'u1l1', 'u15l3', 'junk', 'constructor'];
    const random = rng(2026);
    const sets: string[][] = Object.keys(TEST_MAP).map((id) => [id]);
    for (let n = 0; n < 300; n++) sets.push(pool.filter(() => random() < 0.4));
    for (const ids of sets) {
      const records = emptyRecords();
      const before = JSON.stringify(records);
      for (const map of [LEGACY_MAP, TEST_MAP]) {
        for (const state of legacyCompletion(ids, map).values()) expect(Object.keys(state).sort()).toEqual(['at', 'from', 'via']);
        for (const state of completedView(records, ids, map).values()) {
          expect(state.via).toBe('migration');
          expect(state).not.toHaveProperty('score');
        }
      }
      // The inputs are never changed: mastered / applied stay empty.
      expect(JSON.stringify(records)).toBe(before);
      expect(records.mastered).toEqual({});
      expect(records.applied).toEqual({});
    }
  });
});

describe('completedView (T5)', () => {
  it('a stored grant beats the derived completion; at is null only for migration', () => {
    const records = parseRecords({ completed: { i01l1: grant, b05l1: grant } });
    const view = completedView(records, ['u7l1', 'u13l2'], TEST_MAP);
    expect(view.get('i01l1')).toEqual(grant);
    expect(view.get('b05l1')).toEqual(grant);
    expect(view.get('e01l3')).toEqual({ via: 'migration', from: ['u13l2'], at: null });
    for (const state of view.values()) {
      if (state.via === 'migration') expect(state.at).toBeNull();
      else expect(typeof state.at).toBe('string');
    }
  });

  it('with empty inputs is empty', () => {
    expect(completedView(emptyRecords(), []).size).toBe(0);
  });
});

describe('loading writes nothing (T6)', () => {
  it('reading v1 data, the records, the attempt log and the derived view does not write', () => {
    const { store, writes } = spyStore({
      'progress.completedLessons.v1': JSON.stringify(['u1l1', 'u7l1', 'u5l1']),
      'learning.records.v1': JSON.stringify({ schema: 1, completed: { b05l1: grant }, mastered: {}, applied: {}, exposed: [] }),
      'learning.attempts.v1': '[]',
    });
    const learning = createLearningRepository(store);
    const v1 = createProgressRepository(store).completedLessons();
    completedView(learning.records(), v1);
    completedView(learning.records(), v1, TEST_MAP);
    learning.attempts();
    expect(writes).toEqual([]);
  });

  it('with corrupt records or no records at all, loading still writes nothing', () => {
    for (const raw of ['{broken', '[]', null]) {
      const { store, writes } = spyStore(raw === null ? {} : { 'learning.records.v1': raw });
      expect(createLearningRepository(store).records()).toEqual(emptyRecords());
      expect(writes).toEqual([]);
    }
  });
});

describe('rollback simulation (T7)', () => {
  it("today's snapshot read / merge / write leave learning.records.v1 byte-identical; rolling forward gives the same view", () => {
    const now = new Date(2026, 9, 22, 12);
    const store = createMemoryStore({ 'progress.completedLessons.v1': JSON.stringify(['u7l1', 'u13l2']) });
    // New build writes records.
    const learning = createLearningRepository(store);
    learning.grantCompletion('b05l1', grant);
    learning.grantMastery('b05', { at: grant.at, via: 'check', score: 90, formId: 'b05-A', assessmentVersion: 1 });
    learning.grantApplication('b10-g1', { at: grant.at, via: 'practical', score: 75, taskVersion: 1, fallback: 'F2' });
    learning.markExposed(['b05-c01']);
    const bytes = store.get('learning.records.v1');
    const viewBefore = completedView(learning.records(), createProgressRepository(store).completedLessons(), TEST_MAP);

    // Old build (today's v1 code) runs on the same store: local snapshot, account merge, write back, and its own
    // legacy completion.
    const remote = parseRemote(toRemote({ ...readSnapshot(store, now), completedLessons: ['u14l1'] }), now);
    writeSnapshot(store, mergeSnapshots(readSnapshot(store, now), remote, now));
    createProgressRepository(store).markCompleted('u13l3');
    createProgressRepository(store).reset();
    createProgressRepository(store).markCompleted('u7l1');
    expect(store.get('learning.records.v1')).toBe(bytes);

    // Roll forward: same stored grants, and the legacy completions made meanwhile are picked up.
    const viewAfter = completedView(createLearningRepository(store).records(), createProgressRepository(store).completedLessons(), TEST_MAP);
    expect(viewAfter.get('b05l1')).toEqual(viewBefore.get('b05l1'));
    expect(viewAfter.get('i01l1')).toEqual(viewBefore.get('i01l1'));
    expect(createLearningRepository(store).records()).toEqual(learning.records());
  });

  it('a snapshot round trip without any old-build change gives the identical view', () => {
    const now = new Date(2026, 9, 22, 12);
    const store = createMemoryStore({ 'progress.completedLessons.v1': JSON.stringify(['u7l1', 'u13l2']) });
    createLearningRepository(store).grantCompletion('b05l1', grant);
    const before = completedView(createLearningRepository(store).records(), createProgressRepository(store).completedLessons(), TEST_MAP);
    const snap = readSnapshot(store, now);
    writeSnapshot(store, mergeSnapshots(snap, snap, now));
    const after = completedView(createLearningRepository(store).records(), createProgressRepository(store).completedLessons(), TEST_MAP);
    expect(after).toEqual(before);
  });
});

describe('gamification untouched by migration (T14)', () => {
  it('deriving the view never changes the stored gamification state', () => {
    const now = new Date(2026, 9, 22, 12);
    const { store, writes } = spyStore({ 'progress.completedLessons.v1': JSON.stringify(['u7l1', 'u13l2', 'u5l1']) });
    createGamificationRepository(store).save({ ...initialState(now), totalXp: 140, hearts: 2, currentStreak: 3 });
    const bytes = store.get('gamification.state.v1');
    writes.length = 0;
    const learning = createLearningRepository(store);
    const v1 = createProgressRepository(store).completedLessons();
    for (const map of [LEGACY_MAP, TEST_MAP]) completedView(learning.records(), v1, map);
    expect(writes).toEqual([]);
    expect(store.get('gamification.state.v1')).toBe(bytes);
  });

  it('MU4: the first real completion of a migration-completed lesson earns first-completion XP (10)', () => {
    const records = emptyRecords();
    const view = completedView(records, ['u7l1'], TEST_MAP);
    expect(view.get('i01l1')?.via).toBe('migration');
    expect(lessonXp(isFirstRealCompletion(records, 'i01l1'))).toBe(10);
    const after = parseRecords({ completed: { i01l1: grant } });
    expect(lessonXp(isFirstRealCompletion(after, 'i01l1'))).toBe(5);
  });
});
