// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findLesson } from '../content';
import { I18nProvider } from '../i18n/I18nProvider';
import { COMBINATION_REPLY_MS, LessonPlayer } from './LessonPlayer';

afterEach(cleanup);

const tap = (square: string) => fireEvent.click(screen.getByRole('gridcell', { name: new RegExp(`^${square},`) }));
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

function renderLesson(id: string, lang: 'en' | 'vi' = 'en') {
  const onComplete = vi.fn();
  const onExit = vi.fn();
  render(
    <I18nProvider initial={lang}>
      <LessonPlayer lesson={findLesson(id)!} onComplete={onComplete} onExit={onExit} />
    </I18nProvider>,
  );
  return { onComplete, onExit };
}

describe('LessonPlayer', () => {
  it('plays "The General" end to end, including a wrong answer and a retry', () => {
    const { onComplete } = renderLesson('u1l2');

    // Two "learn" cards.
    expect(screen.getByTestId('prompt').textContent).toMatch(/one point up, down, left or right/);
    press('Continue');
    press('Continue');

    // select-squares: General on e2 can reach e1, d2, f2.
    expect(screen.getByRole('button', { name: /Check/ })).toHaveProperty('disabled', true);
    tap('d2');
    tap('f2');
    tap('e1');
    press(/Check/);
    expect(screen.getByRole('alert').textContent).toMatch(/Correct!/);
    press('Continue');

    // select-squares: General on f2 can reach f1 and e2. Pick only one -> wrong.
    tap('f1');
    press(/Check/);
    expect(screen.getByRole('alert').textContent).toMatch(/Not quite/);
    press('Try again');
    tap('f1');
    tap('e2');
    press(/Check/);
    expect(screen.getByRole('alert').textContent).toMatch(/Correct!/);
    press('Continue');

    // move: the General on d1 is preselected; move it to the marked point e1.
    tap('e1');
    expect(screen.getByRole('alert').textContent).toMatch(/Correct!/);
    press('Continue');

    // Completion screen: 4 of 5 right first time (the second select had a mistake).
    expect(screen.getByText('Lesson complete!')).toBeTruthy();
    expect(screen.getByText('4 of 5 exercises right on the first try')).toBeTruthy();
    press('Continue');
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('explains why a move is rejected and lets the learner retry', () => {
    renderLesson('u1l3');
    press('Continue'); // learn

    // capture: General on d2 should take the soldier on e2. Try an illegal diagonal first.
    tap('d2');
    tap('e1');
    expect(screen.getByRole('alert').textContent).toMatch(/can’t move there/);
    press('Try again');
    tap('d2');
    tap('e2');
    expect(screen.getByRole('alert').textContent).toMatch(/Correct!/);
    press('Continue');

    press('Continue'); // learn
    // select-squares, then the "only safe square" move: d1 is the answer, e2 is attacked.
    tap('e0');
    tap('d1');
    tap('e2');
    press(/Check/);
    press('Continue');
    tap('e2');
    expect(screen.getByRole('alert').textContent).toMatch(/General under attack/);
    press('Try again');
    tap('d1');
    expect(screen.getByRole('alert').textContent).toMatch(/Correct!/);
  });

  it('shows lesson text in Vietnamese and can be quit', () => {
    const { onExit } = renderLesson('u2l1', 'vi');
    expect(screen.getByTestId('prompt').textContent).toMatch(/Sĩ/);
    press('Thoát bài học');
    expect(onExit).toHaveBeenCalledOnce();
  });

  describe('hearts', () => {
    // Plays the role of the app: owns the hearts and takes one per mistake (never below 0).
    function WithHearts({ initial, onMistake }: { initial: number; onMistake: () => void }) {
      const [hearts, setHearts] = useState(initial);
      return (
        <I18nProvider initial="en">
          <LessonPlayer
            lesson={findLesson('u1l3')!}
            hearts={hearts}
            completionXp={10}
            onMistake={() => {
              onMistake();
              setHearts((h) => Math.max(0, h - 1));
            }}
            onComplete={vi.fn()}
            onExit={vi.fn()}
          />
        </I18nProvider>
      );
    }

    it('shows the hearts and loses one per wrong answer', () => {
      const onMistake = vi.fn();
      render(<WithHearts initial={5} onMistake={onMistake} />);
      expect(screen.getByTestId('lesson-hearts').textContent).toMatch(/Hearts: 5/);
      press('Continue'); // learn

      tap('d2');
      tap('e1'); // illegal
      expect(onMistake).toHaveBeenCalledOnce();
      expect(screen.getByRole('alert').textContent).toMatch(/You lost a heart\. 4 left\./);
      expect(screen.getByTestId('lesson-hearts').textContent).toMatch(/Hearts: 4/);
      press('Try again');
      expect(screen.queryByRole('alert')).toBeNull();

      tap('d2');
      tap('e2'); // correct: no heart lost
      expect(screen.getByRole('alert').textContent).not.toMatch(/heart/);
      expect(onMistake).toHaveBeenCalledOnce();
      expect(screen.getByTestId('lesson-hearts').textContent).toMatch(/Hearts: 4/);
    });

    it('lets the learner finish the lesson after running out of hearts', () => {
      const onMistake = vi.fn();
      render(<WithHearts initial={1} onMistake={onMistake} />);
      press('Continue');
      tap('d2');
      tap('e1');
      expect(screen.getByRole('alert').textContent).toMatch(/You lost a heart\. 0 left\./);
      expect(screen.getByTestId('lesson-hearts').textContent).toMatch(/Hearts: 0/);
      press('Try again');
      tap('d2');
      tap('e1');
      expect(screen.getByRole('alert').textContent).toMatch(/out of hearts, but you can finish this lesson/);
      expect(onMistake).toHaveBeenCalledTimes(2);
      press('Try again');
      tap('d2');
      tap('e2');
      expect(screen.getByRole('alert').textContent).toMatch(/Correct!/);
    });

    it('shows the XP earned on the completion screen', () => {
      const onComplete = vi.fn();
      render(
        <I18nProvider initial="en">
          <LessonPlayer lesson={findLesson('u1l1')!} hearts={5} completionXp={5} onComplete={onComplete} onExit={vi.fn()} />
        </I18nProvider>,
      );
      press('Continue');
      press('Continue');
      press('Continue');
      for (const sq of ['d0', 'e0', 'f0', 'd1', 'e1', 'f1', 'd2', 'e2', 'f2']) tap(sq);
      press(/Check/);
      press('Continue');
      for (const sq of ['d7', 'e7', 'f7', 'd8', 'e8', 'f8', 'd9', 'e9', 'f9']) tap(sq);
      press(/Check/);
      press('Continue');
      expect(screen.getByText('Lesson complete!')).toBeTruthy();
      expect(screen.getByText('+5 XP')).toBeTruthy();
    });
  });

  it('plays a combination: wrong first move costs a heart, then the engine answers and Red mates', () => {
    vi.useFakeTimers();
    try {
      const onMistake = vi.fn();
      render(
        <I18nProvider initial="en">
          <LessonPlayer lesson={findLesson('u8l2')!} onComplete={vi.fn()} onExit={vi.fn()} hearts={5} onMistake={onMistake} />
        </I18nProvider>,
      );
      press('Continue'); // learn

      // Two Chariots, mate in 2 (Ri7-i8+, Ke8-e9, Rh6-h9#). A quiet move lets Black escape.
      expect(screen.getByText('Combination')).toBeTruthy();
      expect(screen.getByTestId('combination-status').textContent).toMatch(/moves left: 2/);
      tap('h6');
      tap('h5');
      expect(screen.getByRole('alert').textContent).toMatch(/lets Black escape/);
      expect(onMistake).toHaveBeenCalledOnce();
      press('Try again');

      // The hint marks the piece to move.
      press('Show a hint');
      expect(screen.getByText('Move the marked piece.')).toBeTruthy();

      tap('i7');
      tap('i8');
      expect(screen.getByTestId('combination-status').textContent).toMatch(/Black is answering/);
      act(() => vi.advanceTimersByTime(COMBINATION_REPLY_MS));
      expect(screen.getByRole('gridcell', { name: /^e9,/ }).getAttribute('aria-label')).toMatch(/Black General/i);
      expect(screen.getByTestId('combination-status').textContent).toMatch(/moves left: 1/);

      tap('h6');
      tap('h9');
      expect(screen.getByRole('alert').textContent).toMatch(/Correct!/);
      expect(screen.getByRole('alert').textContent).toMatch(/Chariots take turns/);
      press('Continue');
      expect(screen.getByTestId('combination-status').textContent).toMatch(/moves left: 2/);
    } finally {
      vi.useRealTimers();
    }
  });
});
