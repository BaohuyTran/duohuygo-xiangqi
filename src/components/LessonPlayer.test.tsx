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
/** In "The General" (u1l2): plays the first exercises up to the capture (General d2 takes e2). */
function toCapture() {
  press('Continue');
  for (const sq of ['e1', 'd2', 'f2']) tap(sq);
  press(/Check/);
  press('Continue');
  press('Continue');
}

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
  it('plays "The General" end to end, including wrong answers and retries', () => {
    const { onComplete } = renderLesson('u1l2');

    expect(screen.getByTestId('prompt').textContent).toMatch(/one point up, down, left or right/);
    press('Continue');

    // select-squares: General on e2 can reach e1, d2, f2. Pick only one -> wrong.
    expect(screen.getByRole('button', { name: /Check/ })).toHaveProperty('disabled', true);
    tap('d2');
    press(/Check/);
    expect(screen.getByRole('alert').textContent).toMatch(/Not quite/);
    press('Try again');
    tap('d2');
    tap('f2');
    tap('e1');
    press(/Check/);
    expect(screen.getByRole('alert').textContent).toMatch(/Correct!/);
    press('Continue');

    press('Continue'); // learn: capturing
    tap('d2');
    tap('e2');
    expect(screen.getByRole('alert').textContent).toMatch(/Correct!/);
    press('Continue');

    press('Continue'); // learn: safety
    // The "only safe point" move: e2 is attacked by the Chariot on e4, d1 is safe.
    tap('e1');
    tap('e2');
    expect(screen.getByRole('alert').textContent).toMatch(/General under attack/);
    press('Try again');
    tap('e1');
    tap('d1');
    expect(screen.getByRole('alert').textContent).toMatch(/Correct!/);
    press('Continue');

    // Completion screen: 4 of 6 right first time (the select and the last move had mistakes).
    expect(screen.getByText('Lesson complete!')).toBeTruthy();
    expect(screen.getByText('4 of 6 exercises right on the first try')).toBeTruthy();
    press('Continue');
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('explains why a move is rejected and lets the learner retry', () => {
    renderLesson('u1l2');
    toCapture();

    // capture: General on d2 should take the soldier on e2. Try an illegal diagonal first.
    tap('d2');
    tap('e1');
    expect(screen.getByRole('alert').textContent).toMatch(/can’t move there/);
    press('Try again');
    tap('d2');
    tap('e2');
    expect(screen.getByRole('alert').textContent).toMatch(/Correct!/);
  });

  it('shows lesson text in Vietnamese and can be quit', () => {
    const { onExit } = renderLesson('u1l3', 'vi');
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
            lesson={findLesson('u1l2')!}
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
      toCapture();

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
      toCapture();
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

  describe('jump-ahead test mode', () => {
    // One exercise: the General on d2 captures the Soldier on e2 (from "The General").
    const capture = findLesson('u1l2')!.exercises[3];
    const testLesson = { id: 'jump-x', title: 'jump.title', exercises: [capture] };
    const renderTest = () => {
      const onComplete = vi.fn();
      const onExit = vi.fn();
      const onMistake = vi.fn();
      render(
        <I18nProvider initial="en">
          <LessonPlayer lesson={testLesson} test hearts={5} onMistake={onMistake} onComplete={onComplete} onExit={onExit} />
        </I18nProvider>,
      );
      return { onComplete, onExit, onMistake };
    };

    it('has 3 lives of its own and ends the test when they run out', () => {
      const { onExit, onMistake } = renderTest();
      expect(screen.getByTestId('lesson-hearts').textContent).toMatch(/Hearts: 3/);
      for (const left of [2, 1]) {
        tap('d2');
        tap('e1');
        expect(screen.getByRole('alert').textContent).toMatch(new RegExp(`You lost a heart\\. ${left} left\\.`));
        press('Try again');
      }
      tap('d2');
      tap('e1');
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
      press('See result');
      expect(screen.getByText('Not this time')).toBeTruthy();
      press('Back to lessons');
      expect(onExit).toHaveBeenCalledOnce();
      expect(onMistake).not.toHaveBeenCalled(); // real hearts are never touched
    });

    it('shows the skipped-ahead screen when passed', () => {
      const { onComplete } = renderTest();
      tap('d2');
      tap('e2');
      press('Continue');
      expect(screen.getByText('You skipped ahead!')).toBeTruthy();
      press('Continue');
      expect(onComplete).toHaveBeenCalledOnce();
    });
  });
});

