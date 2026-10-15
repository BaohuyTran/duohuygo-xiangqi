import { describe, expect, it } from 'vitest';
import { createMemoryStore, createProgressRepository, createSettingsRepository } from './index';

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
});
