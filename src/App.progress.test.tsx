// @vitest-environment jsdom
// App-level checks of the three-level progress storage (05-migration.md §8.10 T6, T12, T13, T18).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { initialState } from './gamification';
import { createLearningRepository, createMemoryStore, type KeyValueStore } from './storage';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const now = () => new Date(2026, 9, 22, 12);
const at = '2026-10-21T09:00:00.000Z';

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

const records = JSON.stringify({
  schema: 1,
  completed: { b05l1: { at, via: 'lesson', contentVersion: 1 } },
  mastered: { b05: { at, via: 'check', score: 90, formId: 'b05-A', assessmentVersion: 1 } },
  applied: { 'b10-g1': { at, via: 'practical', score: 70, taskVersion: 1, fallback: 'F1' } },
  exposed: ['b05-c01'],
});

describe('App and the learning records', () => {
  it('loading the app with v1 data writes no progress or learning key (T6)', () => {
    const { store, writes } = spyStore({
      'progress.completedLessons.v1': JSON.stringify(['u1l1', 'u5l1']),
      'learning.records.v1': records,
    });
    render(<App store={store} now={now} />);
    expect(screen.getByRole('button', { name: 'The board (completed)' })).toBeTruthy();
    // Only the gamification refresh (heart refill by time) writes on load, as before this change.
    expect(writes.filter((k) => k !== 'gamification.state.v1')).toEqual([]);
  });

  it('stays usable with corrupt records (T12)', () => {
    const { store, writes } = spyStore({ 'learning.records.v1': '{broken', 'learning.attempts.v1': 'also broken' });
    render(<App store={store} now={now} />);
    fireEvent.click(screen.getByRole('button', { name: 'The board (start)' }));
    expect(screen.getAllByRole('button', { name: 'Continue' }).length).toBeGreaterThan(0);
    expect(writes.filter((k) => k.startsWith('learning.'))).toEqual([]);
    expect(store.get('learning.records.v1')).toBe('{broken');
  });

  it('Reset clears v1 completion, the records and the attempt log; puzzles, settings and gamification unchanged (T13)', () => {
    const untouched: Record<string, string> = {
      'progress.solvedPuzzles.v1': JSON.stringify(['m1-01', 'wm-03']),
      'settings.language.v1': 'en',
      'settings.muted.v1': '1',
      'gamification.state.v1': JSON.stringify({ ...initialState(now()), totalXp: 75, currentStreak: 2, lastGoalDay: '2026-10-22' }),
    };
    const store = createMemoryStore({
      ...untouched,
      'progress.completedLessons.v1': JSON.stringify(['u1l1', 'u1l2']),
      'learning.records.v1': records,
      'learning.attempts.v1': JSON.stringify([{ itemId: 'b05-c01', itemVersion: 1, mode: 'check', at, credit: 1 }]),
    });
    expect(createLearningRepository(store).attempts()).toHaveLength(1);
    render(<App store={store} now={now} />);
    // Rendering refreshes hearts: compare gamification against the state after load, not the seed.
    const loaded = { ...untouched, 'gamification.state.v1': store.get('gamification.state.v1')! };
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Reset progress' }));

    expect(store.get('progress.completedLessons.v1')).toBeNull();
    expect(store.get('learning.records.v1')).toBeNull();
    expect(store.get('learning.attempts.v1')).toBeNull();
    for (const [k, v] of Object.entries(loaded)) expect(store.get(k)).toBe(v);
    expect(JSON.parse(store.get('gamification.state.v1')!).totalXp).toBe(75);
    expect(screen.getByRole('button', { name: 'The board (start)' })).toBeTruthy();
  });

  it('Reset cancelled changes nothing', () => {
    const store = createMemoryStore({ 'progress.completedLessons.v1': JSON.stringify(['u1l1']), 'learning.records.v1': records });
    render(<App store={store} now={now} />);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Reset progress' }));
    expect(store.get('learning.records.v1')).toBe(records);
    expect(store.get('progress.completedLessons.v1')).toBe(JSON.stringify(['u1l1']));
  });

  it('completing a (still live) legacy lesson writes the v1 list only, never the learning records (T18 counterpart)', () => {
    const { store, writes } = spyStore();
    render(<App store={store} now={now} />);
    const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
    press('The board (start)');
    press('Continue');
    press('Continue');
    press('Continue');
    for (const sq of ['d0', 'e0', 'f0', 'd1', 'e1', 'f1', 'd2', 'e2', 'f2']) {
      fireEvent.click(screen.getByRole('gridcell', { name: new RegExp(`^${sq},`) }));
    }
    press(/Check/);
    press('Continue');
    press('Continue');
    expect(screen.getByRole('button', { name: 'The board (completed)' })).toBeTruthy();
    expect(writes).toContain('progress.completedLessons.v1');
    expect(writes.filter((k) => k.startsWith('learning.'))).toEqual([]);
  });
});
