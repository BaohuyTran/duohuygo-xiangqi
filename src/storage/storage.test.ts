import { describe, expect, it } from 'vitest';
import { initialState } from '../gamification';
import {
  createGamificationRepository,
  createLearningRepository,
  createMemoryStore,
  createProgressRepository,
  createPuzzleProgressRepository,
  createSettingsRepository,
  readSnapshot,
  writeSnapshot,
  type KeyValueStore,
} from './index';
import { emptyRecords, type AttemptRecord, type CompletionGrant, type MasteryGrant } from '../progress/records';

describe('progress repository', () => {
  it('records completed lessons once each and can reset', () => {
    const repo = createProgressRepository(createMemoryStore());
    expect(repo.completedLessons()).toEqual([]);
    repo.markCompleted('u1l1');
    repo.markCompleted('u1l1');
    expect(repo.markCompleted('u1l2')).toEqual(['u1l1', 'u1l2']);
    repo.reset();
    expect(repo.completedLessons()).toEqual([]);
  });

  it('ignores corrupt stored data', () => {
    const repo = createProgressRepository(createMemoryStore({ 'progress.completedLessons.v1': '{not json' }));
    expect(repo.completedLessons()).toEqual([]);
  });

  it('stores the language setting', () => {
    const settings = createSettingsRepository(createMemoryStore());
    expect(settings.language()).toBeNull();
    settings.setLanguage('vi');
    expect(settings.language()).toBe('vi');
  });

  it('stores the muted setting (sound on by default)', () => {
    const store = createMemoryStore();
    const settings = createSettingsRepository(store);
    expect(settings.muted()).toBe(false);
    settings.setMuted(true);
    expect(createSettingsRepository(store).muted()).toBe(true);
    settings.setMuted(false);
    expect(settings.muted()).toBe(false);
  });

  it('keeps solved puzzles separate from lesson progress', () => {
    const store = createMemoryStore();
    const puzzles = createPuzzleProgressRepository(store);
    const lessons = createProgressRepository(store);
    puzzles.markSolved('m1-01');
    expect(puzzles.markSolved('m2-03')).toEqual(['m1-01', 'm2-03']);
    expect(lessons.completedLessons()).toEqual([]);
    lessons.reset();
    expect(puzzles.solvedPuzzles()).toEqual(['m1-01', 'm2-03']);
  });

  it('stores gamification state under a versioned key and falls back to defaults when corrupt', () => {
    const now = new Date(2026, 0, 1);
    const store = createMemoryStore();
    const repo = createGamificationRepository(store);
    expect(repo.load(now)).toEqual(initialState(now));
    repo.save({ ...initialState(now), totalXp: 30, hearts: 3 });
    expect(repo.load(now)).toMatchObject({ totalXp: 30, hearts: 3 });
    expect(store.get('gamification.state.v1')).toContain('"totalXp":30');
    store.set('gamification.state.v1', 'not json');
    expect(repo.load(now)).toEqual(initialState(now));
  });
});

describe('progress snapshot (used by account sync)', () => {
  const now = new Date(2026, 9, 16, 12);

  it('reads "nothing stored" as null so a merge can tell it from a default', () => {
    expect(readSnapshot(createMemoryStore(), now)).toEqual({
      completedLessons: [],
      solvedPuzzles: [],
      language: null,
      muted: null,
      gamification: null,
    });
  });

  it('writes and reads back every synced value through the repositories', () => {
    const store = createMemoryStore();
    const gamification = { ...initialState(now), totalXp: 12 };
    writeSnapshot(store, { completedLessons: ['u1l1'], solvedPuzzles: ['p1'], language: 'vi', muted: true, gamification });
    expect(readSnapshot(store, now)).toEqual({ completedLessons: ['u1l1'], solvedPuzzles: ['p1'], language: 'vi', muted: true, gamification });
    expect(createProgressRepository(store).completedLessons()).toEqual(['u1l1']);
    expect(createSettingsRepository(store).muted()).toBe(true);
  });

  it('leaves values it does not have untouched', () => {
    const store = createMemoryStore({ 'settings.language.v1': 'vi', 'settings.muted.v1': '1' });
    writeSnapshot(store, { completedLessons: [], solvedPuzzles: [], language: null, muted: null, gamification: null });
    expect(createSettingsRepository(store).language()).toBe('vi');
    expect(createSettingsRepository(store).muted()).toBe(true);
    expect(store.get('gamification.state.v1')).toBeNull();
  });
});

describe('learning repository (learning.records.v1, learning.attempts.v1)', () => {
  const at = '2026-10-22T09:00:00.000Z';
  const later = '2026-10-23T09:00:00.000Z';
  const completion: CompletionGrant = { at, via: 'lesson', contentVersion: 1 };
  const mastery: MasteryGrant = { at, via: 'check', score: 80, formId: 'b05-A', assessmentVersion: 1 };
  const attempt = (n: number): AttemptRecord => ({ itemId: 'b05l2-04', itemVersion: 1, mode: 'practice', at, credit: 1, seed: n });

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

  it('starts empty and stores the three states and the exposed set', () => {
    const store = createMemoryStore();
    const repo = createLearningRepository(store);
    expect(repo.records()).toEqual(emptyRecords());
    repo.grantCompletion('b05l1', completion);
    repo.grantMastery('b05', { ...mastery, strandScores: { RS: 75 } });
    repo.grantApplication('b10-g1', { at, via: 'practical', score: 64, taskVersion: 1, fallback: 'F1c' });
    repo.grantApplication('pb-g1', { at, via: 'placement', score: 70, taskVersion: 2, equivalentOf: 'b10-g1' });
    repo.markExposed(['b05-c01', 'b05-c02', 'b05-c01']);
    expect(JSON.parse(store.get('learning.records.v1')!)).toEqual({
      schema: 1,
      completed: { b05l1: completion },
      mastered: { b05: { ...mastery, strandScores: { RS: 75 } } },
      applied: {
        'b10-g1': { at, via: 'practical', score: 64, taskVersion: 1, fallback: 'F1c' },
        'pb-g1': { at, via: 'placement', score: 70, taskVersion: 2, equivalentOf: 'b10-g1' },
      },
      exposed: ['b05-c01', 'b05-c02'],
    });
    expect(createLearningRepository(store).records()).toEqual(repo.records());
  });

  it('keeps the first completion, the better mastery / application, and is monotone', () => {
    const repo = createLearningRepository(createMemoryStore());
    repo.grantCompletion('b05l1', completion);
    repo.grantCompletion('b05l1', { ...completion, at: later, via: 'placement' });
    expect(repo.records().completed.b05l1).toEqual(completion);
    repo.grantMastery('b05', mastery);
    repo.grantMastery('b05', { ...mastery, score: 60, at: later }); // a failed / lower later check never lowers mastery
    expect(repo.records().mastered.b05.score).toBe(80);
    repo.grantMastery('b05', { ...mastery, at: later }); // tie: later date
    expect(repo.records().mastered.b05.at).toBe(later);
    repo.grantApplication('b10-g1', { at, via: 'practical', score: 70, taskVersion: 1 });
    repo.grantApplication('b10-g1', { at, via: 'practical', score: 90, taskVersion: 1, fallback: 'F3' });
    expect(repo.records().applied['b10-g1']).toMatchObject({ score: 90, fallback: 'F3' });
  });

  it('ignores invalid grants and does not write for them', () => {
    const { store, writes } = spyStore();
    const repo = createLearningRepository(store);
    repo.grantCompletion('b05l1', { ...completion, at: 'today' });
    repo.grantCompletion('', completion);
    repo.grantMastery('b05', { ...mastery, score: 120 });
    repo.grantApplication('b10-g1', { at, via: 'practical', score: 50, taskVersion: 1, fallback: 'F7' as never });
    repo.markExposed([]);
    repo.logAttempt({ ...attempt(1), credit: 3 });
    expect(writes).toEqual([]);
    expect(repo.records()).toEqual(emptyRecords());
  });

  it('keeps the attempt log local and capped at the newest 2,000 entries', () => {
    const store = createMemoryStore();
    const repo = createLearningRepository(store);
    for (let n = 0; n < 2003; n++) repo.logAttempt(attempt(n));
    const log = repo.attempts();
    expect(log).toHaveLength(2000);
    expect(log[0].seed).toBe(3);
    expect(log.at(-1)?.seed).toBe(2002);
    expect(JSON.parse(store.get('learning.attempts.v1')!)).toHaveLength(2000);
    // The attempt log is not part of the synced records or of the v1 snapshot.
    expect(repo.records()).toEqual(emptyRecords());
    expect(Object.keys(readSnapshot(store, new Date()))).not.toContain('attempts');
    store.set('learning.attempts.v1', 'garbage');
    expect(repo.attempts()).toEqual([]);
  });

  it('corrupt records: reads empty without writing, backs up the raw value on the first write (T12)', () => {
    for (const raw of ['{not json', '[1,2]', '"text"', 'null']) {
      const { store, writes } = spyStore({ 'learning.records.v1': raw, 'learning.records.v1.backup': 'older backup' });
      const repo = createLearningRepository(store);
      expect(repo.records()).toEqual(emptyRecords());
      expect(writes).toEqual([]);
      repo.grantCompletion('b05l1', completion);
      expect(store.get('learning.records.v1.backup')).toBe(raw);
      expect(repo.records().completed).toEqual({ b05l1: completion });
      // Now valid: a further write does not touch the backup again.
      writes.length = 0;
      repo.markExposed(['x']);
      expect(writes).toEqual(['learning.records.v1']);
    }
  });

  it('field-level corruption drops entries but no backup is needed; unknown ids and fields survive a rewrite (T12)', () => {
    const stored = {
      schema: 4,
      completed: { 'zz9l9': completion, bad: { at: 'x' } },
      mastered: 'corrupt',
      applied: { 'b10-g1': { at, via: 'practical', score: 'high', taskVersion: 1 } },
      exposed: 7,
      newerFeature: { kept: true },
    };
    const store = createMemoryStore({ 'learning.records.v1': JSON.stringify(stored) });
    const repo = createLearningRepository(store);
    expect(repo.records()).toEqual({ ...emptyRecords(), schema: 4, completed: { zz9l9: completion }, newerFeature: { kept: true } });
    repo.grantCompletion('b05l1', completion);
    const written = JSON.parse(store.get('learning.records.v1')!);
    expect(written.schema).toBe(4);
    expect(written.newerFeature).toEqual({ kept: true });
    expect(Object.keys(written.completed).sort()).toEqual(['b05l1', 'zz9l9']);
    expect(store.get('learning.records.v1.backup')).toBeNull();
  });

  it('writes new-course ids only to learning.records.v1, never to the v1 completed list (T18, unit)', () => {
    const { store, writes } = spyStore({ 'progress.completedLessons.v1': JSON.stringify(['u1l1']) });
    const repo = createLearningRepository(store);
    repo.grantCompletion('b05l1', completion); // new lesson
    repo.grantCompletion('b05l2', { ...completion, via: 'placement' }); // placement
    repo.grantMastery('b05', mastery); // unit check
    repo.grantMastery('b06', { ...mastery, via: 'placement' });
    repo.grantApplication('b10-g1', { at, via: 'practical', score: 70, taskVersion: 1 }); // practical task
    repo.grantApplication('xb', { at, via: 'exam', score: 70, taskVersion: 1 }); // level exam
    repo.markExposed(['b05-c01']);
    repo.logAttempt(attempt(1));
    expect([...new Set(writes)].sort()).toEqual(['learning.attempts.v1', 'learning.records.v1']);
    expect(store.get('progress.completedLessons.v1')).toBe(JSON.stringify(['u1l1']));
  });

  it('reset removes the records and the attempt log only (T13, unit)', () => {
    const now = new Date(2026, 9, 22, 12);
    const store = createMemoryStore({
      'progress.completedLessons.v1': JSON.stringify(['u1l1']),
      'progress.solvedPuzzles.v1': JSON.stringify(['m1-01']),
      'settings.language.v1': 'vi',
      'settings.muted.v1': '1',
      'gamification.state.v1': JSON.stringify({ ...initialState(now), totalXp: 50 }),
    });
    const repo = createLearningRepository(store);
    repo.grantCompletion('b05l1', completion);
    repo.grantMastery('b05', mastery);
    repo.grantApplication('b10-g1', { at, via: 'practical', score: 70, taskVersion: 1 });
    repo.markExposed(['b05-c01']);
    repo.logAttempt(attempt(1));
    const untouched = ['progress.solvedPuzzles.v1', 'settings.language.v1', 'settings.muted.v1', 'gamification.state.v1'];
    const before = untouched.map((k) => store.get(k));
    createProgressRepository(store).reset();
    repo.reset();
    expect(store.get('progress.completedLessons.v1')).toBeNull();
    expect(store.get('learning.records.v1')).toBeNull();
    expect(store.get('learning.attempts.v1')).toBeNull();
    expect(repo.records()).toEqual(emptyRecords());
    expect(repo.attempts()).toEqual([]);
    expect(untouched.map((k) => store.get(k))).toEqual(before);
  });
});
