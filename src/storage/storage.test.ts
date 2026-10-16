import { describe, expect, it } from 'vitest';
import { initialState } from '../gamification';
import {
  createGamificationRepository,
  createMemoryStore,
  createProgressRepository,
  createPuzzleProgressRepository,
  createSettingsRepository,
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
