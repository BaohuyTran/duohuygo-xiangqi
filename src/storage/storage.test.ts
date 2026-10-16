import { describe, expect, it } from 'vitest';
import { initialState } from '../gamification';
import {
  createGamificationRepository,
  createMemoryStore,
  createProgressRepository,
  createPuzzleProgressRepository,
  createSettingsRepository,
  readSnapshot,
  writeSnapshot,
} from './index';

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
