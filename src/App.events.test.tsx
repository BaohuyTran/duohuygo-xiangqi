// @vitest-environment jsdom
// App wiring of the lesson player's events (carry-over a of S2.13), MU4 XP and T16 (05-migration.md §8.10). The lesson
// player is a stub that emits events; LEGACY_MAP gets one target (u4l1 → b09l1) so migrated completion can be shown.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { Exercise, Unit } from './content/types';
import type { LessonEvent, LessonPlayerProps } from './components/LessonPlayer';
import { createLearningRepository, createMemoryStore } from './storage';

const at = '2026-11-05T10:00:00.000Z';
const now = () => new Date(at);

vi.mock('./progress/legacy', async (importOriginal) => {
  const m = await importOriginal<typeof import('./progress/legacy')>();
  type Map = Parameters<typeof m.completedView>[2];
  return { ...m, completedView: (r: Parameters<typeof m.completedView>[0], v1: string[], map?: Map) => m.completedView(r, v1, map ?? { u4l1: ['b09l1'] }) };
});

const emitted: LessonEvent[] = [];
vi.mock('./components/LessonPlayer', () => ({
  LessonPlayer: (props: LessonPlayerProps) => (
    <div>
      <p data-testid="fake-xp">{String(props.completionXp)}</p>
      <p data-testid="fake-attempts">{typeof props.attempts === 'function' ? String(props.attempts().length) : 'none'}</p>
      <button
        type="button"
        onClick={() => {
          for (const e of emitted) props.onEvent?.(e);
          props.onComplete();
        }}
      >
        fake-finish
      </button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  emitted.length = 0;
});

const learn = (id: string): Exercise =>
  ({ type: 'learn', id, version: 2, status: 'reviewed', source: { kind: 'authored' }, side: 'red', pieces: { e0: 'K', d9: 'k' }, text: 'u1l1.e3' }) as Exercise;
const course: Unit[] = [
  {
    id: 'b09',
    title: 'u1.title',
    description: 'u1.desc',
    track: 'basics',
    lessons: [
      { id: 'b09l1', title: 'u1l1.title', exercises: [learn('b09l1-01')] },
      { id: 'b09l2', title: 'u1l2.title', exercises: [learn('b09l2-01')] },
    ],
  },
];
const record = { itemId: 'b09l1-02', itemVersion: 1, mode: 'practice' as const, at, credit: 0, voided: true, hints: 1, hintStep: 'idea', hintBeforeFirstAnswer: true };
const grant = { at, via: 'practical' as const, score: 80, taskVersion: 1, fallback: 'F1' as const };

describe('App: lesson events, MU4 and T16', () => {
  it('persists attempt records (voided ones too, hints included) and applied grants; passes the attempt log to the player', () => {
    const store = createMemoryStore();
    render(<App store={store} course={course} now={now} />);
    fireEvent.click(screen.getByRole('button', { name: 'The board (start)' }));
    expect(screen.getByTestId('fake-attempts').textContent).toBe('0');
    emitted.push({ type: 'hint', itemId: 'b09l1-02', step: 'idea', at }, { type: 'attempt', record }, { type: 'applied', taskId: 'b09-g1', grant });
    fireEvent.click(screen.getByRole('button', { name: 'fake-finish' }));
    const learning = createLearningRepository(store);
    expect(learning.attempts()).toEqual([record]);
    expect(learning.records().applied).toEqual({ 'b09-g1': grant });
    fireEvent.click(screen.getByRole('button', { name: 'The board (completed)' }));
    expect(screen.getByTestId('fake-attempts').textContent).toBe('1');
  });

  it('T16: a migrated lesson shows as completed, never as mastered; the unit says "not assessed yet"; the count includes it', () => {
    render(<App store={createMemoryStore({ 'progress.completedLessons.v1': JSON.stringify(['u4l1']) })} course={course} now={now} />);
    expect(screen.getByRole('button', { name: 'The board (completed)' })).toBeTruthy();
    expect(screen.getByText('1 of 2 lessons complete')).toBeTruthy();
    expect(screen.getByTestId('unit-mastery-b09').textContent).toBe('Mastery: not assessed yet');
    expect(screen.queryByText(/^Mastered/)).toBeNull();
    expect(screen.getByTestId('unit-status-b09').textContent).toContain('1 of 2 lessons completed');
    expect(screen.getByTestId('unit-status-b09').textContent).toContain('Applied in play: —');
  });

  it('MU4: the first real completion of a migration-completed lesson gives 10 XP, then replays give 5', () => {
    const store = createMemoryStore({ 'progress.completedLessons.v1': JSON.stringify(['u4l1']) });
    render(<App store={store} course={course} now={now} />);
    fireEvent.click(screen.getByRole('button', { name: 'The board (completed)' }));
    expect(screen.getByTestId('fake-xp').textContent).toBe('10');
    fireEvent.click(screen.getByRole('button', { name: 'fake-finish' }));
    expect(JSON.parse(store.get('gamification.state.v1')!).totalXp).toBe(10);
    expect(createLearningRepository(store).records().completed.b09l1).toMatchObject({ via: 'lesson' });
    fireEvent.click(screen.getByRole('button', { name: 'The board (completed)' }));
    expect(screen.getByTestId('fake-xp').textContent).toBe('5');
  });
});
