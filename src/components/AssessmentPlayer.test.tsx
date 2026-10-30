// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { choiceItem } from '../assessment/test-fixtures';
import { I18nProvider } from '../i18n/I18nProvider';
import { translate } from '../i18n/messages';
import type { AttemptRecord } from '../progress/records';
import { AssessmentPlayer, type AssessmentRun } from './AssessmentPlayer';

afterEach(cleanup);

const en = (key: string, vars?: Record<string, string | number>) => translate('en', key, vars);
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const option = (id: string) => screen.getByTestId('choice-options').querySelector(`[data-option="${id}"]`) as HTMLElement;
const NOW = new Date('2026-10-30T12:00:00.000Z');

function setup(over: Partial<AssessmentRun> = {}) {
  const items = [choiceItem({ id: 'b09-c01', unit: 'b09', point: 1 }), choiceItem({ id: 'b09-c02', unit: 'b09', point: 2 })];
  const finish = vi.fn((records: readonly AttemptRecord[], stoppedEarly: boolean) => ({
    tone: 'fail' as const,
    title: 'assess.result.notMastered',
    lines: [{ key: 'assess.result.score', params: { score: records.filter((r) => r.credit === 1).length * 50 } }, ...(stoppedEarly ? [{ key: 'assess.placement.stoppedEarly' }] : [])],
  }));
  const onRecord = vi.fn();
  const onStart = vi.fn();
  const onExit = vi.fn();
  const run: AssessmentRun = { id: 'b09-check#1', title: 'assess.check.title', mode: 'check', items, finish, onStart, annotate: (r) => ({ ...r, unit: 'b09' }), ...over };
  render(
    <I18nProvider initial="en">
      <AssessmentPlayer run={run} onRecord={onRecord} onExit={onExit} now={() => NOW} seed={1} />
    </I18nProvider>,
  );
  return { finish, onRecord, onStart, onExit };
}

/** Answers the current choice item: `a` is the key, `b` a distractor. */
const answer = (id: 'a' | 'b') => {
  fireEvent.click(option(id));
  press('Check');
};

describe('AssessmentPlayer', () => {
  it('neutral intro, then each item answered once: no hearts, no hints; a wrong answer moves on with no credit', () => {
    const { finish, onRecord, onStart, onExit } = setup();
    expect(screen.getAllByText(en('assess.check.title')).length).toBeGreaterThan(0);
    expect(screen.getByText(en('assess.intro.body', { n: 2 }))).toBeTruthy();
    press(en('assess.intro.start'));
    expect(onStart).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('lesson-hearts')).toBeNull();
    expect(screen.queryByRole('button', { name: /hint/i })).toBeNull();
    answer('b');
    // No "Try again": the red button continues to the next item.
    expect(screen.queryByRole('button', { name: en('lesson.retry') })).toBeNull();
    expect(screen.getByRole('alert').textContent).not.toMatch(/heart/i);
    press(en('lesson.continue'));
    answer('a');
    press(en('lesson.continue'));
    expect(onRecord).toHaveBeenCalledTimes(2);
    const records = onRecord.mock.calls.map((c) => c[0] as AttemptRecord);
    expect(records.map((r) => [r.itemId, r.mode, r.credit, r.unit])).toEqual([
      ['b09-c01', 'check', 0, 'b09'],
      ['b09-c02', 'check', 1, 'b09'],
    ]);
    expect(finish).toHaveBeenCalledOnce();
    expect(finish.mock.calls[0][1]).toBe(false);
    expect(screen.getByTestId('assessment-title').textContent).toBe(en('assess.result.notMastered'));
    expect(screen.getByTestId('assessment-lines').textContent).toContain(en('assess.result.score', { score: 50 }));
    press(en('jump.back'));
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('stops early when the run says passing is impossible', () => {
    const { finish } = setup({ shouldStop: (records) => records.some((r) => r.credit === 0) });
    press(en('assess.intro.start'));
    answer('b');
    press(en('lesson.continue'));
    expect(finish).toHaveBeenCalledOnce();
    expect(finish.mock.calls[0][1]).toBe(true);
    expect(screen.getByTestId('assessment-lines').textContent).toContain(en('assess.placement.stoppedEarly'));
  });

  it('quitting during the items calls onQuit with the answers so far (never finish)', () => {
    const onQuit = vi.fn();
    const { finish, onExit } = setup({ onQuit });
    press(en('assess.intro.start'));
    answer('b');
    press(en('lesson.continue'));
    press(en('lesson.quit'));
    expect(onQuit).toHaveBeenCalledOnce();
    expect((onQuit.mock.calls[0][0] as AttemptRecord[]).map((r) => [r.itemId, r.credit])).toEqual([['b09-c01', 0]]);
    expect(finish).not.toHaveBeenCalled();
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('can be left from the intro without starting', () => {
    const { onStart, onExit } = setup();
    press(en('jump.cancel'));
    expect(onStart).not.toHaveBeenCalled();
    expect(onExit).toHaveBeenCalledOnce();
  });
});
