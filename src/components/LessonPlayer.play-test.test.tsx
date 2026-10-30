// @vitest-environment jsdom
// Practical tasks inside tests (carry-over of S2.12): a failed play task costs a jump-test life; a voided one costs
// nothing; in an assessment there are no lives at all. PlayView is replaced by a stub that reports a finished run.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { holdFixture } from '../assessment/play-fixtures';
import type { Exercise } from '../content/types';
import { I18nProvider } from '../i18n/I18nProvider';
import { translate } from '../i18n/messages';
import type { PlayReport } from './PlayView';
import { LessonPlayer, type LessonEvent } from './LessonPlayer';

const reports: PlayReport[] = [];
vi.mock('./PlayView', () => ({
  PlayView: ({ onDone, test }: { onDone: (r: PlayReport) => void; test: boolean }) => (
    <button type="button" data-test-mode={String(test)} onClick={() => onDone(reports.shift()!)}>
      finish-run
    </button>
  ),
}));

afterEach(() => {
  cleanup();
  reports.length = 0;
});

const en = (key: string) => translate('en', key);
const report = (over: Partial<PlayReport>): PlayReport => ({
  pass: false,
  score: 40,
  voided: false,
  fallback: 'F1',
  grant: null,
  path: [],
  values: {},
  critical: [],
  gateFailed: false,
  runs: 1,
  voidedRuns: 0,
  ...over,
});
const tasks = (n: number): Exercise[] => Array.from({ length: n }, (_, i) => ({ ...holdFixture(), id: `b10l9-0${i + 1}` }));
const lives = () => screen.getByTestId('lesson-hearts').textContent;

function renderTest(exercises: Exercise[], props: { test?: boolean; assessment?: 'placement' } = { test: true }) {
  const events: LessonEvent[] = [];
  const onExit = vi.fn();
  render(
    <I18nProvider initial="en">
      <LessonPlayer lesson={{ id: 'jump-b10l9', title: 'jump.title', exercises }} onComplete={() => {}} onExit={onExit} onEvent={(e) => events.push(e)} seed={1} {...props} />
    </I18nProvider>,
  );
  return { events, onExit };
}

describe('practical tasks in a jump-ahead test', () => {
  it('a failed run costs a test life and ends the task (one run, no retry inside the test)', () => {
    reports.push(report({}));
    const { events } = renderTest(tasks(2));
    expect(screen.getByRole('button', { name: 'finish-run' }).getAttribute('data-test-mode')).toBe('true');
    expect(lives()).toContain('3');
    fireEvent.click(screen.getByRole('button', { name: 'finish-run' }));
    expect(lives()).toContain('2');
    // The next task is shown.
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
    expect(events.find((e) => e.type === 'attempt')).toMatchObject({ record: { itemId: 'b10l9-01', mode: 'placement', credit: 0.4 } });
  });

  it('running out of lives on failed tasks ends the test', () => {
    reports.push(report({}), report({}), report({}));
    renderTest(tasks(4));
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'finish-run' }));
    expect(screen.getByText(en('jump.failed.title'))).toBeTruthy();
  });

  it('a voided run costs no life (no credit, no penalty)', () => {
    reports.push(report({ voided: true, score: 0, runs: 0, voidedRuns: 2 }));
    const { events } = renderTest(tasks(2));
    fireEvent.click(screen.getByRole('button', { name: 'finish-run' }));
    expect(lives()).toContain('3');
    expect(events.find((e) => e.type === 'attempt')).toMatchObject({ record: { voided: true, credit: 0 } });
  });

  it('a passed run costs nothing', () => {
    reports.push(report({ pass: true, score: 90 }));
    renderTest(tasks(2));
    fireEvent.click(screen.getByRole('button', { name: 'finish-run' }));
    expect(lives()).toContain('3');
  });

  it('in an assessment there are no lives: a failed task records its score as credit (score ÷ 100) and moves on', () => {
    reports.push(report({}));
    const { events } = renderTest(tasks(2), { assessment: 'placement' });
    expect(screen.queryByTestId('lesson-hearts')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'finish-run' }));
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
    expect(events.find((e) => e.type === 'attempt')).toMatchObject({ record: { mode: 'placement', credit: 0.4, runs: 1 } });
  });
});
