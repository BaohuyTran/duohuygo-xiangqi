// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import { units } from './content';
import { squareName } from './engine';
import { expectedSelection } from './lessons/answers';
import { jumpTest } from './lessons/progress';
import { puzzles } from './puzzles/catalog';
import { createGamificationRepository, createMemoryStore, createProgressRepository } from './storage';
import { initialState } from './gamification';

afterEach(cleanup);

const tap = (square: string) => fireEvent.click(screen.getByRole('gridcell', { name: new RegExp(`^${square},`) }));
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('App', () => {
  it('unlocks the next lesson after completing one and remembers it', () => {
    const store = createMemoryStore();
    render(<App store={store} />);

    expect(screen.getByRole('button', { name: 'The General (locked)' })).toBeTruthy();
    press('The board (start)');

    press('Continue');
    press('Continue');
    press('Continue');
    for (const sq of ['d0', 'e0', 'f0', 'd1', 'e1', 'f1', 'd2', 'e2', 'f2']) tap(sq);
    press(/Check/);
    press('Continue');
    press('Continue'); // completion screen

    expect(screen.getByRole('button', { name: 'The board (completed)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'The General (start)' })).toHaveProperty('disabled', false);
    expect(screen.getByText('1 of 22 lessons complete')).toBeTruthy();

    // A fresh app on the same store keeps the progress.
    cleanup();
    render(<App store={store} />);
    expect(screen.getByRole('button', { name: 'The board (completed)' })).toBeTruthy();
  });

  it('opens the intermediate track from the start, next to the basics', () => {
    render(<App store={createMemoryStore()} />);
    expect(screen.getByRole('link', { name: /Already know the rules\?/ }).getAttribute('href')).toBe('#track-intermediate');
    expect(screen.getByRole('heading', { name: 'Basics' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Intermediate' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Double Cannon (start)' })).toHaveProperty('disabled', false);
    expect(screen.getByRole('button', { name: 'Smothered General (locked)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'The board (start)' })).toHaveProperty('disabled', false);
  });

  it('jumps ahead: a short test from a locked lesson completes the lessons before it', () => {
    const store = createMemoryStore();
    render(<App store={store} now={() => new Date(2026, 5, 1, 10, 0)} />);

    // Tapping a locked lesson asks first; "Not now" changes nothing.
    press('The Chariot (locked)');
    expect(screen.getByRole('dialog', { name: 'Jump to “The Chariot”?' }).textContent).toMatch(/Lessons skipped: 3/);
    press('Not now');
    expect(screen.queryByRole('dialog')).toBeNull();

    // The unit header offers the same jump.
    fireEvent.click(screen.getAllByRole('button', { name: 'Jump here' })[0]);
    press('Start the test');
    expect(screen.getByTestId('lesson-hearts').textContent).toMatch(/Hearts: 3/);
    for (const ex of jumpTest(units, 'u2l1', [])!.exercises) {
      if (ex.type === 'select-squares') {
        for (const sq of expectedSelection(ex)) tap(squareName(sq));
        press(/Check/);
      } else if (ex.type === 'move' || ex.type === 'capture') {
        if (!(ex.type === 'move' && ex.from)) tap(ex.solution.from);
        tap(ex.solution.to);
      }
      expect(screen.getByRole('alert').textContent).toMatch(/Correct!/);
      press('Continue');
    }
    expect(screen.getByText('You skipped ahead!')).toBeTruthy();
    press('Continue');

    for (const name of ['The board', 'The General', 'Advisor and Elephant']) expect(screen.getByRole('button', { name: `${name} (completed)` })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'The Chariot (start)' })).toBeTruthy();
    // No XP for skipped lessons, and the test never costs real hearts.
    expect(screen.getByText('Today: 0 of 20 XP')).toBeTruthy();
    expect(screen.getByText('5 of 5 hearts')).toBeTruthy();
  });

  it('hides the "jump to Intermediate" banner once an intermediate lesson is completed', () => {
    const store = createMemoryStore();
    createProgressRepository(store).markCompleted('u1l1'); // basics progress keeps it
    render(<App store={store} />);
    expect(screen.getByRole('link', { name: /Already know the rules\?/ })).toBeTruthy();
    cleanup();

    createProgressRepository(store).markCompleted('u7l1');
    render(<App store={store} />);
    expect(screen.queryByRole('link', { name: /Already know the rules\?/ })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Intermediate' })).toBeTruthy();
  });

  it('switches language and remembers the choice', () => {
    const store = createMemoryStore();
    render(<App store={store} />);
    press('Vietnamese');
    expect(screen.getByText('Bàn cờ và cung')).toBeTruthy();
    cleanup();
    render(<App store={store} />);
    expect(screen.getByText('Học cờ tướng từng bước một')).toBeTruthy();
  });

  it('navigates to the puzzles, records a solved puzzle and comes back', () => {
    const store = createMemoryStore();
    render(<App store={store} />);
    press('Puzzles');
    expect(screen.getByRole('heading', { name: 'Puzzles' })).toBeTruthy();
    expect(screen.getByText('0 of 60 puzzles solved')).toBeTruthy();
    press(/^Puzzle 1, /);
    // Puzzle 1 is the easiest; play its stored solution (a one-move puzzle).
    const p = puzzles[0];
    expect(p.solution).toHaveLength(1);
    tap(p.solution[0].from);
    tap(p.solution[0].to);
    expect(screen.getByRole('alert').textContent).toMatch(/Solved!/);
    press('Back to puzzles');
    expect(screen.getByText('1 of 60 puzzles solved')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Puzzle 1, .*, solved$/ })).toBeTruthy();
    press('Lessons');
    expect(screen.getByText('DuoHuyGo Xiangqi')).toBeTruthy();
  });

  describe('XP, hearts, daily goal and streak', () => {
    const playFirstLesson = () => {
      press('Continue');
      press('Continue');
      press('Continue');
      for (const sq of ['d0', 'e0', 'f0', 'd1', 'e1', 'f1', 'd2', 'e2', 'f2']) tap(sq);
      press(/Check/);
      press('Continue');
    };

    it('awards lesson XP, costs a heart for a wrong answer and meets the daily goal', () => {
      const store = createMemoryStore();
      const now = () => new Date(2026, 5, 1, 10, 0);
      render(<App store={store} now={now} />);
      expect(screen.getByText('Today: 0 of 20 XP')).toBeTruthy();
      expect(screen.getByText('5 of 5 hearts')).toBeTruthy();

      press('The board (start)');
      press('Continue');
      press('Continue');
      press('Continue');
      tap('a0');
      press(/Check/); // wrong selection
      expect(screen.getByRole('alert').textContent).toMatch(/You lost a heart\. 4 left\./);
      press('Try again');
      for (const sq of ['d0', 'e0', 'f0', 'd1', 'e1', 'f1', 'd2', 'e2', 'f2']) tap(sq);
      press(/Check/);
      press('Continue');
      expect(screen.getByText('+10 XP')).toBeTruthy();
      press('Continue');

      expect(screen.getByText('Today: 10 of 20 XP')).toBeTruthy();
      expect(screen.getByText('4 of 5 hearts')).toBeTruthy();
      expect(screen.getByText('Next heart in 30 min')).toBeTruthy();

      // Replay: +5 XP.
      press('The board (completed)');
      playFirstLesson();
      expect(screen.getByText('+5 XP')).toBeTruthy();
      press('Continue');
      expect(screen.getByText('Today: 15 of 20 XP')).toBeTruthy();

      // Lower the goal from the home screen: today's 15 XP now meets it and starts a streak.
      press(/Change daily goal/);
      press('10 XP per day');
      expect(screen.getByText('Today: 15 of 10 XP')).toBeTruthy();
      expect(screen.getByText('1-day streak')).toBeTruthy();
      expect(screen.getByText('Daily goal reached!')).toBeTruthy();

      // Persisted.
      cleanup();
      render(<App store={store} now={now} />);
      expect(screen.getByText('Today: 15 of 10 XP')).toBeTruthy();
      expect(screen.getByText('1-day streak')).toBeTruthy();
    });

    it('blocks new lessons at 0 hearts, keeps puzzles open, and refills over time', () => {
      const store = createMemoryStore();
      let clock = new Date(2026, 5, 1, 10, 0);
      createGamificationRepository(store).save({ ...initialState(clock), hearts: 0, heartsAnchor: clock.getTime() - 10 * 60 * 1000 });
      render(<App store={store} now={() => clock} />);

      expect(screen.getByText('0 of 5 hearts')).toBeTruthy();
      expect(screen.getByRole('status').textContent).toMatch(/Out of hearts.*Next heart in 20 min/);
      press('The board (start)');
      expect(screen.queryByRole('grid')).toBeNull(); // still on the home screen

      // Puzzles still work and award XP once.
      press('Puzzles');
      expect(screen.getByText('0 of 5 hearts')).toBeTruthy();
      press(/^Puzzle 1, /);
      const p = puzzles[0];
      tap(p.solution[0].from);
      tap(p.solution[0].to);
      expect(screen.getByRole('alert').textContent).toMatch(/\+5 XP/);
      press('Back to puzzles');
      expect(screen.getByText('Today: 5 of 20 XP')).toBeTruthy();
      press(/^Puzzle 1, /);
      tap(p.solution[0].from);
      tap(p.solution[0].to);
      expect(screen.getByRole('alert').textContent).toMatch(/Already solved: no XP this time/);
      press('Back to puzzles');
      expect(screen.getByText('Today: 5 of 20 XP')).toBeTruthy();

      // 20 minutes later a heart has come back: lessons can start again.
      clock = new Date(2026, 5, 1, 10, 20);
      press('Lessons');
      press('The board (start)');
      expect(screen.getByRole('grid')).toBeTruthy();
      expect(screen.getByTestId('lesson-hearts').textContent).toMatch(/Hearts: 1/);
    });
  });
});
