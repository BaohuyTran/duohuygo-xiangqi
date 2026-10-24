// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exercise, Lesson, LineExercise } from '../content/types';
import { I18nProvider } from '../i18n/I18nProvider';
import { translate } from '../i18n/messages';
import type { MoveJudge } from '../lessons/decision';
import { parseMoveKey } from '../lessons/decision';
import type { DefaultClass, LineJudge } from '../lessons/line';
import { forcedLineFixture, quietLineFixture, variedComboFixture } from '../lessons/line-fixtures';
import type { AttemptRecord } from '../progress/records';
import { COMBINATION_REPLY_MS, LessonPlayer, type LessonEvent } from './LessonPlayer';
import { LINE_REPLY_MS } from './LineView';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const en = (key: string, vars?: Record<string, string | number>) => translate('en', key, vars);
const tap = (square: string) => fireEvent.click(screen.getByRole('gridcell', { name: new RegExp(`^${square},`) }));
const play = (move: string) => {
  const [a, b] = move.split('-');
  tap(a);
  tap(b);
};
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const alertText = () => screen.getByRole('alert').textContent ?? '';
const status = () => screen.getByTestId('line-status').textContent ?? '';
const notes = () => screen.getByTestId('line-notes').textContent ?? '';
const NOW = new Date('2026-10-24T12:00:00.000Z');
const flush = async (ms = 0) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
};

/** No engine claims: tests of the refutation live with DecisionView. */
const quietJudge: MoveJudge = {
  safety: () => Promise.resolve('correct'),
  refutation: () => Promise.resolve({ reply: null, kind: null }),
};

/** A scripted LineJudge: classes and partner replies in order. */
function fakeLineJudge(classes: DefaultClass[], replies: string[]): LineJudge & { classify: ReturnType<typeof vi.fn> } {
  return {
    classify: vi.fn(() => Promise.resolve(classes.shift() ?? 'dubious')),
    goal: () => Promise.resolve(false),
    partnerMove: () => {
      const r = replies.shift();
      return Promise.resolve(r ? { move: parseMoveKey(r)!, policy: 'safe-sparring(1,1)' } : null);
    },
  } as LineJudge & { classify: ReturnType<typeof vi.fn> };
}

function renderLine(exercise: Exercise, props: { test?: boolean; lineJudge?: LineJudge; attempts?: AttemptRecord[] } = {}) {
  const lesson: Lesson = { id: 'e01l1', title: 'u1l1.title', exercises: [exercise] };
  const onMistake = vi.fn();
  const events: LessonEvent[] = [];
  render(
    <I18nProvider initial="en">
      <LessonPlayer
        lesson={lesson}
        hearts={5}
        onMistake={onMistake}
        onComplete={() => {}}
        onExit={() => {}}
        onEvent={(e) => events.push(e)}
        now={() => NOW}
        seed={1}
        judge={quietJudge}
        lineJudge={props.lineJudge ?? fakeLineJudge([], [])}
        attempts={() => props.attempts ?? []}
        test={props.test}
      />
    </I18nProvider>,
  );
  return { onMistake, events };
}
const records = (events: LessonEvent[]) => events.flatMap((e) => (e.type === 'attempt' ? [e.record] : []));
const seen = (path: string[]): AttemptRecord => ({ itemId: 'e01l1-02', itemVersion: 1, mode: 'practice', at: NOW.toISOString(), credit: 1, path });

describe('LineView: on the tree', () => {
  it('plays the unseen deviation, shows its explanation, ends at the leaf and records the run', async () => {
    // g5-e7 and d7-e8 were met before: coverage picks f9-f8.
    const { events, onMistake } = renderLine(forcedLineFixture(), { attempts: [seen(['e1-f1', 'g5-e7', 'h6-f7']), seen(['e1-f1', 'd7-e8', 'h6-f7'])] });
    expect(screen.getByText(en('lesson.type.line'))).toBeTruthy();
    play('e1-f1');
    expect(notes()).toContain(en('u2l1.e1')); // the authored reason of the target row
    expect(status()).toBe(en('combination.opponent.neutral'));
    await flush(LINE_REPLY_MS);
    expect(notes()).toContain(en('u3l1.e3')); // the reply's explanation
    expect(status()).toBe(en('side.toMove', { side: 'Red' }));
    play('h6-f5');
    expect(alertText()).toContain(en('line.done'));
    expect(alertText()).toContain(en('u2l1.e1')); // purpose
    press('Continue');
    expect(onMistake).not.toHaveBeenCalled();
    const [r] = records(events);
    expect(r).toMatchObject({ itemId: 'e01l1-02', credit: 1, attemptsBeforeSuccess: 0, path: ['e1-f1', 'f9-f8', 'h6-f5'] });
    expect(r.steps).toEqual([
      { ply: 0, move: 'e1-f1', class: 'target', source: 'table' },
      { ply: 2, move: 'h6-f5', class: 'target', source: 'table' },
    ]);
    expect(screen.getByText('1 of 1 exercises right on the first try')).toBeTruthy();
  });

  it('a dubious move is "try again" without a heart, and the first answer earns no credit', async () => {
    const { events, onMistake } = renderLine(forcedLineFixture(), { attempts: [seen(['e1-f1', 'g5-e7']), seen(['e1-f1', 'd7-e8'])] });
    play('e1-g1');
    expect(alertText()).toContain(en('decision.title.dubious'));
    expect(alertText()).toContain(en('decision.dubious.retry'));
    expect(onMistake).not.toHaveBeenCalled();
    press('Try again');
    play('e1-f1');
    await flush(LINE_REPLY_MS); // f9-f8
    play('h6-f5');
    press('Continue');
    expect(onMistake).not.toHaveBeenCalled();
    expect(records(events)[0]).toMatchObject({ credit: 0, attemptsBeforeSuccess: 1 });
  });

  it('an error-class move costs a heart, shows its reason, and zeroes the credit', async () => {
    const { events, onMistake } = renderLine(forcedLineFixture(), { attempts: [seen(['e1-f1', 'g5-e7']), seen(['e1-f1', 'd7-e8'])] });
    play('e1-f1');
    await flush(LINE_REPLY_MS); // f9-f8
    play('h6-f7'); // authored error at this node
    await flush();
    expect(onMistake).toHaveBeenCalledTimes(1);
    expect(alertText()).toContain(en('u2l1.e4'));
    expect(alertText()).toContain(en('hearts.lost', { n: 4 }));
    press('Try again');
    play('h6-f5');
    press('Continue');
    expect(records(events)[0]).toMatchObject({ credit: 0, attemptsBeforeSuccess: 1, path: ['e1-f1', 'f9-f8', 'h6-f5'] });
  });

  it('in a jump test the opponent plays the main reply and there are no hints', async () => {
    renderLine(forcedLineFixture(), { test: true, attempts: [seen(['e1-f1', 'g5-e7'])] });
    expect(screen.queryByRole('button', { name: en('decision.hint.next.idea') })).toBeNull();
    play('e1-f1');
    await flush(LINE_REPLY_MS);
    expect(notes()).toContain(en('u3l1.e5')); // g5-e7, the main reply, although already seen
  });

  it('offers the node hint ladder in practice', () => {
    const { events } = renderLine(forcedLineFixture());
    press(en('decision.hint.next.idea'));
    expect(screen.getByTestId('hint-text').textContent).toBe(en('u3l1.e4'));
    expect(events).toEqual([{ type: 'hint', itemId: 'e01l1-02', step: 'idea', at: NOW.toISOString() }]);
  });
});

describe('LineView: off the tree', () => {
  it('without a hand-over, an accepted move without a continuation ends the item (F1)', () => {
    const ex: LineExercise = { ...quietLineFixture(), handOver: undefined };
    const { events } = renderLine(ex);
    play('i0-g0'); // sound, no continuation
    expect(alertText()).toContain(en('line.end.tree'));
    press('Continue');
    expect(records(events)[0]).toMatchObject({ credit: 1, path: ['i0-g0'] });
  });

  it('hands over to the partner; off-tree moves get the default class; not checked is neutral and voids the record', async () => {
    const judge = fakeLineJudge(['target', 'not-checked'], ['e9-e8', 'e8-e9']);
    const { events, onMistake } = renderLine(quietLineFixture(), { lineJudge: judge });
    play('i0-g0');
    await flush();
    expect(screen.getByTestId('line-partner').textContent).toBe(en('line.partner'));
    expect(status()).toBe(en('line.offTree', { n: 2 }));
    play('b0-c2');
    await flush();
    expect(judge.classify).toHaveBeenCalledTimes(1);
    expect(notes()).toContain(en('line.offTree.target'));
    await flush();
    play('c2-e3');
    await flush();
    expect(onMistake).not.toHaveBeenCalled();
    expect(alertText()).toContain(en('line.end.cap'));
    press('Continue');
    const [r] = records(events);
    expect(r).toMatchObject({ voided: true, path: ['i0-g0', 'e9-e8', 'b0-c2', 'e8-e9', 'c2-e3'] });
    expect(r.steps).toEqual([
      { ply: 0, move: 'i0-g0', class: 'sound', source: 'table' },
      { ply: 2, move: 'b0-c2', class: 'target', source: 'default' },
      { ply: 4, move: 'c2-e3', class: 'not-checked', source: 'default' },
    ]);
  });

  it('an off-tree error costs a heart and is retried', async () => {
    const judge = fakeLineJudge(['error', 'dubious'], ['e9-e8', 'e8-e9']);
    const { onMistake } = renderLine(quietLineFixture(), { lineJudge: judge });
    play('i0-g0');
    await flush();
    play('g0-g9');
    await flush();
    expect(onMistake).toHaveBeenCalledTimes(1);
    expect(alertText()).toContain(en('feedback.incorrect'));
    press('Try again');
    play('b0-a2');
    await flush();
    expect(notes()).toContain(en('line.offTree.dubious'));
  });
});

describe('varied defence through the player', () => {
  it('the opponent meets an unseen best reply and the path is recorded', async () => {
    const lesson: Lesson = { id: 'e01l1', title: 'u1l1.title', exercises: [variedComboFixture()] };
    const events: LessonEvent[] = [];
    const log: AttemptRecord[] = [
      { ...seen(['e1-f1', 'f9-f8', 'h6-f5']), itemId: 'e01l1-03' },
      { ...seen(['e1-f1', 'g5-e7', 'h6-f7']), itemId: 'e01l1-03' },
    ];
    render(
      <I18nProvider initial="en">
        <LessonPlayer lesson={lesson} onComplete={() => {}} onExit={() => {}} onEvent={(e) => events.push(e)} now={() => NOW} seed={1} attempts={() => log} />
      </I18nProvider>,
    );
    play('e1-f1');
    await flush(COMBINATION_REPLY_MS);
    play('h6-f7'); // the mate after d7-e8, the only unseen best reply
    press('Continue');
    expect(records(events)[0]).toMatchObject({ itemId: 'e01l1-03', credit: 1, path: ['e1-f1', 'd7-e8', 'h6-f7'] });
  });

  it('in a jump test a varied-defence combination plays the stored line', async () => {
    const lesson: Lesson = { id: 'e01l1', title: 'u1l1.title', exercises: [variedComboFixture()] };
    const events: LessonEvent[] = [];
    // f9-f8 (the stored reply) was met before; coverage would avoid it, the test does not.
    const log: AttemptRecord[] = [{ ...seen(['e1-f1', 'f9-f8', 'h6-f5']), itemId: 'e01l1-03' }];
    render(
      <I18nProvider initial="en">
        <LessonPlayer lesson={lesson} test onComplete={() => {}} onExit={() => {}} onEvent={(e) => events.push(e)} now={() => NOW} seed={1} attempts={() => log} />
      </I18nProvider>,
    );
    play('e1-f1');
    await flush(COMBINATION_REPLY_MS);
    play('h6-f5'); // the mate after f9-f8 only
    press('Continue');
    expect(records(events)[0]).toMatchObject({ itemId: 'e01l1-03', mode: 'placement', credit: 1 });
    expect(records(events)[0].path).toBeUndefined();
  });
});
