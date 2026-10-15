// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findLesson } from '../content';
import { I18nProvider } from '../i18n/I18nProvider';
import { LessonPlayer } from './LessonPlayer';

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
});
