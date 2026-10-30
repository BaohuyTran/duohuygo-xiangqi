// @vitest-environment jsdom
// App-level assessment flows with TEST-ONLY pools (no real pool content exists yet): a unit check at 0 hearts, and a J2
// test-out. No XP, no hearts (03 §9); grants, exposure and the attempt log go through src/storage.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import { b08CheckPool, b09CheckPool, choiceItem } from './assessment/test-fixtures';
import type { AssessmentPool, Exercise, Unit } from './content/types';
import { initialState } from './gamification';
import { createLearningRepository, createMemoryStore } from './storage';

afterEach(cleanup);

const NOW = new Date('2026-11-05T10:00:00.000Z');
const now = () => NOW;
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const option = (id: string) => screen.getByTestId('choice-options').querySelector(`[data-option="${id}"]`) as HTMLElement;
const learn = (id: string): Exercise =>
  ({ type: 'learn', id, version: 1, status: 'reviewed', source: { kind: 'authored' }, side: 'red', pieces: { e0: 'K', d9: 'k' }, text: 'u1l1.e3' }) as Exercise;
const unit = (id: string, lessons: [string, string][]): Unit => ({
  id,
  track: 'basics',
  title: id === 'b09' ? 'u2.title' : 'u1.title',
  description: 'u1.desc',
  lessons: lessons.map(([l, title]) => ({ id: l, title, exercises: [learn(`${l}-01`)] })),
});
const course: Unit[] = [
  unit('b08', [['b08l1', 'u1l1.title']]),
  unit('b09', [
    ['b09l1', 'u1l2.title'],
    ['b09l2', 'u1l3.title'],
    ['b09l3', 'u2l1.title'],
  ]),
];
const pools: AssessmentPool[] = [b08CheckPool(), b09CheckPool()];
const zeroHearts = () => JSON.stringify({ ...initialState(NOW), hearts: 0, heartsAnchor: NOW.getTime() });

/** Answers every item of the running assessment: the key `a`, except the given 0-based indexes. */
function answerAll(n: number, wrong: number[] = []) {
  for (let i = 0; i < n; i++) {
    fireEvent.click(option(wrong.includes(i) ? 'b' : 'a'));
    press('Check');
    press('Continue');
  }
}

describe('unit check in the app', () => {
  it('works at 0 hearts, awards no XP, grants mastery by check and marks the items exposed', () => {
    const store = createMemoryStore({ 'gamification.state.v1': zeroHearts() });
    render(<App store={store} course={course} pools={pools} now={now} />);
    // b08 has too few items for a form (no earlier unit to interleave): unavailable, with the reason.
    expect(screen.getByText('Unit check unavailable: not enough new questions yet.')).toBeTruthy();
    press('Unit check');
    expect(screen.getByText('8 questions. No hints and no hearts: answer each question once.')).toBeTruthy();
    press('Start');
    answerAll(8);
    expect(screen.getByTestId('assessment-title').textContent).toBe('Unit mastered');
    press('Back to lessons');
    expect(screen.getByTestId('unit-mastery-b09').textContent).toBe('Mastered (unit check)');
    const learning = createLearningRepository(store);
    expect(learning.records().mastered.b09).toMatchObject({ via: 'check', score: 100, assessmentVersion: 1 });
    expect(learning.records().exposed).toHaveLength(8);
    const log = learning.attempts();
    expect(log.filter((r) => r.mode === 'check' && r.form !== true)).toHaveLength(8);
    expect(log.find((r) => r.form === true)).toMatchObject({ itemId: 'b09-check', outcome: 'mastered' });
    expect(log.every((r) => r.form === true || typeof r.strand === 'string')).toBe(true);
    const game = JSON.parse(store.get('gamification.state.v1')!);
    expect(game.totalXp).toBe(0);
    expect(game.hearts).toBe(0);
  });

  it('two misses: not mastered, the lessons to revisit are listed, nothing granted', () => {
    const store = createMemoryStore();
    render(<App store={store} course={course} pools={pools} now={now} />);
    press('Unit check');
    press('Start');
    answerAll(8, [0, 1]);
    expect(screen.getByTestId('assessment-title').textContent).toBe('Not mastered yet');
    expect(screen.getByTestId('assessment-lines').textContent).toContain('Score: 75 / 100');
    expect(createLearningRepository(store).records().mastered).toEqual({});
    press('Back to lessons');
    expect(screen.getByTestId('unit-mastery-b09').textContent).toBe('Mastery: not mastered yet');
  });
});

describe('J2 test-out in the app', () => {
  const pb: AssessmentPool = {
    id: 'pb',
    kind: 'placement',
    level: 'basics',
    version: 1,
    items: Array.from({ length: 10 }, (_, i) => choiceItem({ id: `pb-${String(i + 1).padStart(2, '0')}`, unit: 'b09', objective: 'b09l1', strand: i < 5 ? 'TC' : 'OD', point: 20 + i })),
  };

  it('replaces the jump test where a form exists: pass completes the skipped lessons (placement) and masters the covered unit', () => {
    const store = createMemoryStore({ 'progress.completedLessons.v1': JSON.stringify([]) });
    const b09only = [course[1]];
    render(<App store={store} course={b09only} pools={[pb]} now={now} />);
    press('The Chariot (locked)');
    expect(screen.getByRole('dialog').textContent).toContain('Pass a test of 10 questions');
    press('Start the test');
    press('Start');
    answerAll(10);
    expect(screen.getByTestId('assessment-title').textContent).toBe('Placement passed');
    press('Back to lessons');
    const records = createLearningRepository(store).records();
    expect(Object.keys(records.completed).sort()).toEqual(['b09l1', 'b09l2']);
    expect(Object.values(records.completed).every((g) => g.via === 'placement')).toBe(true);
    expect(records.mastered.b09).toMatchObject({ via: 'placement', score: 100 });
    // One attempt per target per local day: the start and end entries are logged.
    expect(createLearningRepository(store).attempts().filter((r) => r.form === true).map((r) => r.outcome)).toEqual(['started', 'passed']);
  });
});

describe('"more practice" (05 MU1)', () => {
  it('a unit with an extra-practice pool offers it; answers are logged as practice; no XP, no completion', () => {
    const poolItem = { ...choiceItem({ id: 'b09-p01', unit: 'b09', point: 31 }) } as unknown as Exercise;
    const withPool: Unit[] = [{ ...course[1], pool: [poolItem] }];
    const store = createMemoryStore();
    render(<App store={store} course={withPool} now={now} />);
    expect(screen.queryByRole('button', { name: 'Unit check' })).toBeNull();
    press('More practice');
    fireEvent.click(option('a'));
    press('Check');
    press('Continue');
    press('Continue'); // practice done screen
    expect(screen.getByRole('button', { name: 'More practice' })).toBeTruthy();
    const learning = createLearningRepository(store);
    expect(learning.attempts()).toMatchObject([{ itemId: 'b09-p01', mode: 'practice', credit: 1 }]);
    expect(learning.records().completed).toEqual({});
    expect(JSON.parse(store.get('gamification.state.v1') ?? '{"totalXp":0}').totalXp).toBe(0);
  });
});

describe('warm-up after a long break (03 §4.5, UA1 default)', () => {
  it('offers unexposed check items of mastered units; results only suggest lessons, no state changes', () => {
    const old = '2026-09-20T10:00:00.000Z';
    const mastered = { at: old, via: 'check', score: 87.5, formId: 'b09-check#a', assessmentVersion: 1 };
    const store = createMemoryStore({
      'learning.records.v1': JSON.stringify({ schema: 1, completed: {}, mastered: { b09: mastered }, applied: {}, exposed: [] }),
      'learning.attempts.v1': JSON.stringify([{ itemId: 'b09l1-02', itemVersion: 1, mode: 'practice', at: old, credit: 1 }]),
    });
    render(<App store={store} course={course} pools={pools} now={now} />);
    expect(screen.getByTestId('warmup').textContent).toContain('Welcome back!');
    press('Start the warm-up');
    expect(screen.getByText('5 questions. No hints and no hearts: answer each question once.')).toBeTruthy();
    press('Start');
    answerAll(5, [0]);
    expect(screen.getByTestId('assessment-title').textContent).toBe('Warm-up finished');
    expect(screen.getByTestId('assessment-lines').textContent).toContain('You might revisit:');
    press('Back to lessons');
    expect(screen.queryByTestId('warmup')).toBeNull();
    const records = createLearningRepository(store).records();
    expect(records.mastered.b09).toEqual(mastered);
    expect(createLearningRepository(store).attempts().filter((r) => r.warmUp === true)).toHaveLength(5);
  });
});

describe('quitting a check and remediation', () => {
  const practised = (lessonId: string, point: number) => ({ ...choiceItem({ id: `${lessonId}-02`, unit: 'b09', objective: lessonId, point }) }) as unknown as Exercise;
  const withPractice: Unit[] = [
    course[0],
    {
      ...course[1],
      lessons: course[1].lessons.map((l, i) => ({ ...l, exercises: [...l.exercises, practised(l.id, 28 + i)] })),
    },
  ];

  it('a quit after a wrong answer counts as failed: "not mastered yet", remediation (at 0 hearts) unlocks the retake', () => {
    const store = createMemoryStore({ 'gamification.state.v1': zeroHearts() });
    render(<App store={store} course={withPractice} pools={pools} now={now} />);
    press('Unit check');
    press('Start');
    fireEvent.click(option('b'));
    press('Check');
    press('Quit lesson');
    expect(screen.getByTestId('unit-mastery-b09').textContent).toBe('Mastery: not mastered yet');
    expect(createLearningRepository(store).attempts().find((r) => r.form === true)).toMatchObject({ outcome: 'failed', quit: true });
    expect(screen.queryByRole('button', { name: 'Unit check' })).toBeNull();
    // Remediation works at 0 hearts and costs none.
    press('Practise before the retake');
    expect(screen.queryByTestId('lesson-hearts')).toBeNull();
    fireEvent.click(option('a'));
    press('Check');
    press('Continue');
    press('Continue'); // practice done screen
    expect(screen.getByRole('button', { name: 'Unit check' })).toBeTruthy();
    expect(JSON.parse(store.get('gamification.state.v1')!).hearts).toBe(0);
  });

  it('a quit with no answer is neutral', () => {
    const store = createMemoryStore();
    render(<App store={store} course={withPractice} pools={pools} now={now} />);
    press('Unit check');
    press('Start');
    press('Quit lesson');
    expect(screen.getByTestId('unit-mastery-b09').textContent).toBe('Mastery: not assessed yet');
    expect(createLearningRepository(store).attempts()).toEqual([]);
    expect(screen.getByRole('button', { name: 'Unit check' })).toBeTruthy();
  });
});
