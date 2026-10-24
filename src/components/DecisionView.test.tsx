// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findLesson } from '../content';
import { createAnalysisClient } from '../analysis/client';
import { DEFAULT_REQUEST_BUDGET } from '../analysis/requests';
import type { CombinationExercise, Exercise, ItemFeedback, Lesson, MoveExercise } from '../content/types';
import { I18nProvider } from '../i18n/I18nProvider';
import { translate } from '../i18n/messages';
import { clientJudge, type MoveJudge } from '../lessons/decision';
import { blackDecisionFixture, decisionFixture, safeMoveFixture } from '../lessons/test-fixtures';
import { COMBINATION_REPLY_MS, LessonPlayer, type LessonEvent } from './LessonPlayer';

afterEach(cleanup);

const en = (key: string) => translate('en', key);
const tap = (square: string) => fireEvent.click(screen.getByRole('gridcell', { name: new RegExp(`^${square},`) }));
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const alertText = () => screen.getByRole('alert').textContent ?? '';
const NOW = new Date('2026-10-23T12:00:00.000Z');

/** The real analysis client in its synchronous fallback, with the full request budget (S2.5 test setup). */
const fullJudge = (): MoveJudge =>
  clientJudge(createAnalysisClient({ createWorker: null, syncBudget: DEFAULT_REQUEST_BUDGET, syncTimeoutMs: Infinity }));

function renderLesson(exercises: Exercise[], props: { test?: boolean; judge?: MoveJudge } = {}) {
  const lesson: Lesson = { id: 'b09l3', title: 'u1l1.title', exercises };
  const onMistake = vi.fn();
  const onComplete = vi.fn();
  const events: LessonEvent[] = [];
  render(
    <I18nProvider initial="en">
      <LessonPlayer
        lesson={lesson}
        hearts={5}
        onMistake={onMistake}
        onComplete={onComplete}
        onExit={() => {}}
        onEvent={(e) => events.push(e)}
        now={() => NOW}
        seed={1}
        judge={props.judge ?? fullJudge()}
        test={props.test}
      />
    </I18nProvider>,
  );
  return { onMistake, onComplete, events };
}
const attempts = (events: LessonEvent[]) => events.flatMap((e) => (e.type === 'attempt' ? [e.record] : []));

describe('DecisionView (through LessonPlayer)', () => {
  it('accepts a target move with the purpose and the key reply, and records full credit', () => {
    const { events, onMistake } = renderLesson([decisionFixture()]);
    expect(screen.getByText(en('lesson.type.decision'))).toBeTruthy();
    tap('b0');
    tap('c2');
    expect(alertText()).toContain('Correct!');
    expect(alertText()).toContain(en('u2l1.e1')); // purpose
    expect(alertText()).toContain(en('u2l1.e2')); // key reply
    press('Continue');
    expect(screen.getByText('1 of 1 exercises right on the first try')).toBeTruthy();
    expect(onMistake).not.toHaveBeenCalled();
    expect(attempts(events)).toEqual([
      { itemId: 'b09l3-04', itemVersion: 1, mode: 'practice', at: NOW.toISOString(), colour: 'red', credit: 1, hints: 0, attemptsBeforeSuccess: 0 },
    ]);
  });

  it('accepts a sound move with its authored reason', () => {
    renderLesson([decisionFixture()]);
    tap('i0');
    tap('g0');
    expect(alertText()).toContain('Good move!');
    expect(alertText()).toContain(en('u3l1.e2'));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
  });

  it('a dubious move is "try again" without losing a heart; the first answer earns no credit', () => {
    const { onMistake, events } = renderLesson([decisionFixture()]);
    tap('b0');
    tap('a2');
    expect(screen.getByTestId('feedback-panel').dataset.tone).toBe('neutral');
    expect(alertText()).toContain('Safe, but not the idea');
    expect(alertText()).toContain('No heart lost');
    expect(alertText()).toContain(en('u3l1.e4')); // the idea, not the move
    expect(screen.getByTestId('lesson-hearts').textContent).toMatch(/5/);
    expect(onMistake).not.toHaveBeenCalled();
    press('Try again');
    tap('b0');
    tap('c2');
    press('Continue');
    expect(screen.getByText('0 of 1 exercises right on the first try')).toBeTruthy();
    expect(attempts(events)[0]).toMatchObject({ credit: 0, attemptsBeforeSuccess: 1, misconception: 'b09.m1' });
  });

  it('shows the tempting-alternative text when the learner plays exactly that move', () => {
    renderLesson([decisionFixture()]);
    tap('i0');
    tap('i9');
    expect(alertText()).toContain(en('u3l1.e3')); // the row's reason
    expect(alertText()).toContain(en('u2l1.e4')); // why the tempting move fails
  });

  it('an error costs a heart and shows the refutation on the board and in notation', async () => {
    const { onMistake, events } = renderLesson([decisionFixture()]);
    tap('i0');
    tap('i1');
    expect(onMistake).toHaveBeenCalledOnce();
    expect(alertText()).toMatch(/You lost a heart\. 4 left\./);
    expect(alertText()).toContain(en('u2l1.e3')); // the common error
    // The opponent's mating reply Rh7-h0 (en notation R8+7: Black counts files from its own right, h = 8) is played.
    expect(await screen.findByText(/Your opponent answers R8\+7 and forces checkmate\./)).toBeTruthy();
    expect(screen.getByRole('gridcell', { name: /^h0, Black Chariot/ })).toBeTruthy();
    press('Try again');
    expect(screen.getByRole('gridcell', { name: /^i0, Red Chariot/ })).toBeTruthy();
    tap('b0');
    tap('c2');
    press('Continue');
    expect(attempts(events)[0]).toMatchObject({ credit: 0, attemptsBeforeSuccess: 1, misconception: 'b09.m2' });
  });

  it('offers the hint ladder idea -> piece -> move and records each step', () => {
    const { events } = renderLesson([decisionFixture()]);
    press('Show a hint');
    expect(screen.getByTestId('hint-text').textContent).toBe(en('u3l1.e4'));
    press('Which piece?');
    expect(screen.getByRole('gridcell', { name: /^b0, Red Horse.*hint/ })).toBeTruthy();
    press('Show the move');
    expect(screen.getByTestId('hint-text').textContent).toBe('One good move: H8+7.');
    expect(screen.getByRole('gridcell', { name: /^c2, .*target/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /hint|piece|move/i, hidden: false })?.textContent ?? '').not.toMatch(/Show the move/);
    tap('b0');
    tap('c2');
    press('Continue');
    // An answer after a hint is not independent: it does not count as "right on the first try".
    expect(screen.getByText('0 of 1 exercises right on the first try')).toBeTruthy();
    expect(events.filter((e) => e.type === 'hint').map((e) => (e.type === 'hint' ? e.step : null))).toEqual(['idea', 'piece', 'move']);
    expect(attempts(events)[0]).toMatchObject({ credit: 1, hints: 3, hintStep: 'move', hintBeforeFirstAnswer: true });
  });

  it('offers no hints in a jump-ahead test, and records the attempt as placement', () => {
    const { events } = renderLesson([decisionFixture()], { test: true });
    expect(screen.queryByRole('button', { name: 'Show a hint' })).toBeNull();
    tap('b0');
    tap('c2');
    press('Continue');
    expect(attempts(events)[0]).toMatchObject({ mode: 'placement', credit: 1 });
  });

  it('a dubious answer in a jump-ahead test ends the item: no free retry, no hint, credit 0', () => {
    const { events, onMistake } = renderLesson([decisionFixture()], { test: true });
    tap('b0');
    tap('a2');
    expect(alertText()).toContain(en('decision.dubious.final'));
    expect(alertText()).not.toContain(en('u3l1.e4')); // no idea hint in a test
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(onMistake).not.toHaveBeenCalled();
    press('Continue');
    expect(attempts(events)[0]).toMatchObject({ mode: 'placement', credit: 0, attemptsBeforeSuccess: 0, misconception: 'b09.m1' });
  });

  it('a dubious answer with "partial" in a test earns 0.5', () => {
    const { events } = renderLesson([{ ...decisionFixture(), partial: true }], { test: true });
    tap('b0');
    tap('a2');
    press('Continue');
    expect(attempts(events)[0]).toMatchObject({ credit: 0.5 });
  });

  it('makes no engine claim for an authored error on a move that passes the guard', async () => {
    const ex = decisionFixture();
    const authored = { ...ex, table: ex.table.map((r) => (r.move === 'e0-f0' ? { ...r, class: 'error' as const, source: 'authored' as const, reason: 'u3l1.e6' } : r)) };
    const { onMistake } = renderLesson([authored]);
    tap('e0');
    tap('f0');
    expect(onMistake).toHaveBeenCalledOnce();
    await act(async () => {});
    await act(async () => {});
    expect(alertText()).toContain(en('u3l1.e6'));
    expect(alertText()).not.toMatch(/answers|wins material|forces checkmate|Finding/);
    expect(alertText()).not.toContain(en('decision.error.generic'));
  });

  it('can be answered with the keyboard (piece and destination selects, then Play move)', () => {
    renderLesson([decisionFixture()]);
    const picker = screen.getByTestId('move-picker');
    fireEvent.click(picker.querySelector('summary')!);
    const piece = screen.getByRole('combobox', { name: 'Piece' }) as HTMLSelectElement;
    const target = screen.getByRole('combobox', { name: 'Move to' }) as HTMLSelectElement;
    expect(target.disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Play move' })).toHaveProperty('disabled', true);
    piece.focus();
    fireEvent.change(piece, { target: { value: String(1) } }); // b0 = square index 1
    expect([...target.options].map((o) => o.textContent).sort()).toEqual(['Choose a point', 'a2 · H8+9', 'c2 · H8+7', 'd1 · H8+6']);
    fireEvent.change(target, { target: { value: String(2 * 9 + 2) } }); // c2
    press('Play move');
    expect(alertText()).toContain('Correct!');
  });

  it('turns the board for a Black decision and judges it like its Red twin', () => {
    renderLesson([blackDecisionFixture()]);
    expect(screen.getByRole('grid').getAttribute('data-orientation')).toBe('black');
    expect(screen.getByText('Black to move')).toBeTruthy();
    tap('b9');
    tap('c7');
    expect(alertText()).toContain('Correct!');
  });

  it('answering never reloads the player or resets unrelated lesson state', async () => {
    const { onMistake } = renderLesson([{ type: 'learn', pieces: { e0: 'K', d9: 'k' }, text: 'u1l1.e1' }, decisionFixture()]);
    press('Continue');
    const quit = screen.getByRole('button', { name: en('lesson.quit') });
    const progress = screen.getByRole('progressbar');
    expect(progress.getAttribute('aria-valuenow')).toBe('1');
    // A dubious answer, a hint, an error and a retry: same header nodes, same progress, one heart lost.
    tap('b0');
    tap('a2');
    press('Try again');
    press('Show a hint');
    tap('i0');
    tap('i5');
    await act(async () => {});
    press('Try again');
    expect(screen.getByRole('button', { name: en('lesson.quit') })).toBe(quit);
    expect(screen.getByRole('progressbar')).toBe(progress);
    expect(progress.getAttribute('aria-valuenow')).toBe('1');
    expect(onMistake).toHaveBeenCalledOnce();
    // The hint ladder keeps its step across retries within the item.
    expect(screen.getByTestId('hint-text').textContent).toBe(en('u3l1.e4'));
    tap('b0');
    tap('c2');
    press('Continue');
    expect(screen.getByText('1 of 2 exercises right on the first try')).toBeTruthy();
  });
});

describe('move goal "safe" (judged through the analysis client)', () => {
  it('shows "Checking your move…", then accepts a safe move', async () => {
    renderLesson([safeMoveFixture()]);
    tap('b0');
    tap('c2');
    expect(screen.getByTestId('checking')).toBeTruthy();
    expect(await screen.findByText('Correct!')).toBeTruthy();
  });

  it('rejects a move that allows a mate, with a heart', async () => {
    const { onMistake } = renderLesson([safeMoveFixture()]);
    tap('i0');
    tap('i5');
    expect(await screen.findByText(en('verdict.allows-mate'))).toBeTruthy();
    expect(onMistake).toHaveBeenCalledOnce();
  });

  it('a move the analysis could not check costs no heart or test life (04 §5.4)', async () => {
    const notChecked: MoveJudge = { safety: () => Promise.resolve('not-checked'), refutation: () => Promise.resolve({ reply: null, kind: null }) };
    const item = { ...safeMoveFixture(), id: 'b09l3-07', version: 1 };
    const { onMistake, events } = renderLesson([item], { judge: notChecked, test: true });
    tap('b0');
    tap('c2');
    expect(await screen.findByText(en('verdict.not-checked'))).toBeTruthy();
    expect(onMistake).not.toHaveBeenCalled();
    expect(screen.getByTestId('lesson-hearts').textContent).toMatch(/Hearts: 3/); // test lives untouched
    press('Try again');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(events).toEqual([]);
  });

  it('records a voided attempt when the first answer could not be checked, and no credit', async () => {
    let calls = 0;
    const flaky: MoveJudge = {
      safety: () => Promise.resolve(calls++ === 0 ? 'not-checked' : 'correct'),
      refutation: () => Promise.resolve({ reply: null, kind: null }),
    };
    const item = { ...safeMoveFixture(), id: 'b09l3-07', version: 1 };
    const { events } = renderLesson([item], { judge: flaky });
    tap('b0');
    tap('c2');
    await screen.findByText(en('verdict.not-checked'));
    press('Try again');
    tap('b0');
    tap('c2');
    await screen.findByText('Correct!');
    press('Continue');
    expect(attempts(events)[0]).toMatchObject({ voided: true, credit: 0, attemptsBeforeSuccess: 0 });
    expect(screen.getByText('0 of 1 exercises right on the first try')).toBeTruthy();
  });

  it('with a fixed piece ("from"), a move by another piece is "wrong piece", never sent to the guard', async () => {
    const safety = vi.fn(() => Promise.resolve('correct' as const));
    const { onMistake } = renderLesson([{ ...safeMoveFixture(), from: 'b0' }], { judge: { safety, refutation: () => Promise.resolve({ reply: null, kind: null }) } });
    tap('i0'); // another own piece
    tap('g0'); // a safe move, but not by the Horse
    expect(alertText()).toContain(en('verdict.wrong-piece'));
    expect(safety).not.toHaveBeenCalled();
    expect(onMistake).toHaveBeenCalledOnce();
    press('Try again');
    tap('c2'); // the Horse on b0 is preselected
    expect(await screen.findByText('Correct!')).toBeTruthy();
    expect(safety).toHaveBeenCalledOnce();
  });
});

describe('feedback parts on move and combination items (02 §7)', () => {
  const feedback: ItemFeedback = { purpose: 'u2l1.e1', keyReply: 'u2l1.e2', commonError: 'u2l1.e3', temptingAlternative: { move: 'i0-i5', text: 'u2l1.e4' } };

  it('move item: purpose + key reply when correct; the tempting text for exactly that move, else the common error', async () => {
    const item: MoveExercise = { ...safeMoveFixture(), feedback };
    renderLesson([item]);
    tap('i0');
    tap('i5');
    expect(await screen.findByTestId('feedback-wrong')).toBeTruthy();
    expect(screen.getByTestId('feedback-wrong').textContent).toContain(en('u2l1.e4'));
    press('Try again');
    tap('i0');
    tap('i4');
    expect((await screen.findByTestId('feedback-wrong')).textContent).toBe(en('u2l1.e3'));
    press('Try again');
    tap('b0');
    tap('c2');
    expect((await screen.findByTestId('feedback-right')).textContent).toContain(en('u2l1.e1'));
    expect(screen.getByTestId('feedback-right').textContent).toContain(en('u2l1.e2'));
  });

  it('combination: the tempting first move gets its text, the finished combination the purpose and key reply', () => {
    vi.useFakeTimers();
    try {
      // Two Chariots, mate in 2 (u8l2): Rh6-h5 is the tempting quiet move.
      const combo = { ...(findLesson('u8l2')!.exercises[1] as CombinationExercise), feedback: { ...feedback, temptingAlternative: { move: 'h6-h5', text: 'u2l1.e4' } } };
      renderLesson([combo]);
      tap('h6');
      tap('h5');
      expect(screen.getByTestId('feedback-wrong').textContent).toContain(en('u2l1.e4'));
      press('Try again');
      tap('i7');
      tap('i8');
      act(() => vi.advanceTimersByTime(COMBINATION_REPLY_MS));
      tap('h6');
      tap('h9');
      expect(screen.getByTestId('feedback-right').textContent).toContain(en('u2l1.e1'));
      expect(screen.getByTestId('feedback-right').textContent).toContain(en('u2l1.e2'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('capture item: purpose + key reply when correct; the tempting text for exactly that move, else the common error', () => {
    // From "The General" (u1l2): the General on d2 takes the Soldier on e2; d2-e1 is the tempting wrong move.
    const capture = { ...findLesson('u1l2')!.exercises[3], feedback: { ...feedback, temptingAlternative: { move: 'd2-e1', text: 'u2l1.e4' } } } as Exercise;
    renderLesson([capture]);
    tap('d2');
    tap('e1');
    expect(screen.getByTestId('feedback-wrong').textContent).toContain(en('u2l1.e4'));
    press('Try again');
    tap('d2');
    tap('d1');
    expect(screen.getByTestId('feedback-wrong').textContent).toBe(en('u2l1.e3'));
    press('Try again');
    tap('d2');
    tap('e2');
    expect(screen.getByTestId('feedback-right').textContent).toContain(en('u2l1.e1'));
    expect(screen.getByTestId('feedback-right').textContent).toContain(en('u2l1.e2'));
  });

  it('a legacy combination keeps its hint in a jump-ahead test; a new-course one offers none', () => {
    const legacy = findLesson('u8l2')!.exercises[1];
    renderLesson([legacy], { test: true });
    expect(screen.getByRole('button', { name: 'Show a hint' })).toBeTruthy();
    cleanup();
    renderLesson([{ ...legacy, id: 'b09l3-08', version: 1 }], { test: true });
    expect(screen.queryByRole('button', { name: 'Show a hint' })).toBeNull();
  });

  it('a hint does not lower the first-try count of a legacy item, but does for a new-course item', () => {
    vi.useFakeTimers();
    try {
      const legacy = findLesson('u8l2')!.exercises[1];
      const solve = () => {
        press('Show a hint');
        tap('i7');
        tap('i8');
        act(() => vi.advanceTimersByTime(COMBINATION_REPLY_MS));
        tap('h6');
        tap('h9');
        press('Continue');
      };
      renderLesson([legacy]);
      solve();
      expect(screen.getByText('1 of 1 exercises right on the first try')).toBeTruthy();
      cleanup();
      renderLesson([{ ...legacy, id: 'b09l3-08', version: 1 }]);
      solve();
      expect(screen.getByText('0 of 1 exercises right on the first try')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
