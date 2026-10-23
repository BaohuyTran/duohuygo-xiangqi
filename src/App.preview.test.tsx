// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import { coursePath, RELEASE_STATES } from './content/release';
import { squareName } from './engine';
import { expectedSelection } from './lessons/answers';
import { jumpTest } from './lessons/progress';
import type { Exercise, Unit } from './content/types';
import { createLearningRepository, createMemoryStore, createProgressRepository } from './storage';

afterEach(cleanup);

const tap = (square: string) => fireEvent.click(screen.getByRole('gridcell', { name: new RegExp(`^${square},`) }));
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

const learn = (id: string): Exercise =>
  ({ type: 'learn', id, version: 3, status: 'reviewed', source: { kind: 'authored' }, side: 'red', pieces: { e0: 'K', d9: 'k' }, text: 'u1l1.e3' }) as Exercise;

// New-course fixture units (reviewed, level not published): what the course preview shows.
const fixture: Unit[] = [
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
  { id: 'a03', title: 'u11.title', description: 'u11.desc', track: 'advanced', lessons: [{ id: 'a03l1', title: 'u1l3.title', exercises: [learn('a03l1-01')] }] },
];

describe('App in the course preview', () => {
  const course = coursePath(fixture, { preview: true, state: RELEASE_STATES['REL-P'] });

  it('shows the new-course path only, with the first lesson of each level open', () => {
    expect(course).toHaveLength(2);
    render(<App store={createMemoryStore()} course={course} />);
    expect(screen.getByRole('button', { name: 'The board (start)' })).toHaveProperty('disabled', false);
    expect(screen.getByRole('button', { name: 'The General (locked)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Advisor and Elephant (start)' })).toHaveProperty('disabled', false);
    expect(screen.queryByRole('button', { name: /Double Cannon/ })).toBeNull();
    expect(screen.getByText('0 of 3 lessons complete')).toBeTruthy();
  });

  it('records a new-course completion in the learning records, never in the v1 list (T18)', () => {
    const store = createMemoryStore();
    const now = () => new Date('2026-11-05T10:00:00.000Z');
    render(<App store={store} course={course} now={now} />);
    press('The board (start)');
    press('Continue');
    press('Continue'); // completion screen

    expect(screen.getByRole('button', { name: 'The board (completed)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'The General (start)' })).toHaveProperty('disabled', false);
    expect(createProgressRepository(store).completedLessons()).toEqual([]);
    expect(createLearningRepository(store).records().completed).toEqual({
      b09l1: { at: '2026-11-05T10:00:00.000Z', via: 'lesson', contentVersion: 3 },
    });

    // A fresh app on the same store reads the completion back from the records.
    cleanup();
    render(<App store={store} course={course} now={now} />);
    expect(screen.getByRole('button', { name: 'The board (completed)' })).toBeTruthy();
  });

  it('a passed jump test over new-course lessons grants completion via placement, never in the v1 list (T18)', () => {
    const palace = (id: string): Exercise =>
      ({
        type: 'select-squares',
        id,
        version: 2,
        status: 'reviewed',
        source: { kind: 'authored' },
        side: 'red',
        strand: 'RS',
        nature: 'tactic',
        critical: false,
        misconceptions: [],
        pieces: { e0: 'K', f9: 'k' },
        prompt: 'u1l1.e4',
        region: 'red-palace',
      }) as Exercise;
    const jumpCourse: Unit[] = [
      {
        id: 'b09',
        title: 'u1.title',
        description: 'u1.desc',
        track: 'basics',
        lessons: [
          { id: 'b09l1', title: 'u1l1.title', exercises: [learn('b09l1-01'), palace('b09l1-02')] },
          { id: 'b09l2', title: 'u1l2.title', exercises: [palace('b09l2-01')] },
          { id: 'b09l3', title: 'u1l3.title', exercises: [learn('b09l3-01')] },
        ],
      },
    ];
    const store = createMemoryStore();
    render(<App store={store} course={jumpCourse} now={() => new Date('2026-11-06T08:00:00.000Z')} />);

    press('Advisor and Elephant (locked)');
    expect(screen.getByRole('dialog').textContent).toMatch(/Lessons skipped: 2/);
    press('Start the test');
    const test = jumpTest(jumpCourse, 'b09l3', [])!;
    expect(test.exercises).toHaveLength(2);
    for (const ex of test.exercises) {
      if (ex.type !== 'select-squares') throw new Error('fixture has select-squares items only');
      for (const sq of expectedSelection(ex)) tap(squareName(sq));
      press(/Check/);
      expect(screen.getByRole('alert').textContent).toMatch(/Correct!/);
      press('Continue');
    }
    press('Continue'); // "You skipped ahead!"

    expect(screen.getByRole('button', { name: 'The board (completed)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'The General (completed)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Advisor and Elephant (start)' })).toHaveProperty('disabled', false);
    expect(createProgressRepository(store).completedLessons()).toEqual([]);
    expect(createLearningRepository(store).records().completed).toEqual({
      b09l1: { at: '2026-11-06T08:00:00.000Z', via: 'placement', contentVersion: 3 }, // highest item version in the lesson
      b09l2: { at: '2026-11-06T08:00:00.000Z', via: 'placement', contentVersion: 2 },
    });
  });
});
