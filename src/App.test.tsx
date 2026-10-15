// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import { puzzles } from './puzzles/catalog';
import { createMemoryStore } from './storage';

afterEach(cleanup);

const tap = (square: string) => fireEvent.click(screen.getByRole('gridcell', { name: new RegExp(`^${square},`) }));
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('App', () => {
  it('unlocks the next lesson after completing one and remembers it', () => {
    const store = createMemoryStore();
    render(<App store={store} />);

    expect(screen.getByRole('button', { name: 'The General (locked)' })).toHaveProperty('disabled', true);
    press('The board (start)');

    press('Continue');
    press('Continue');
    press('Continue');
    for (const sq of ['d0', 'e0', 'f0', 'd1', 'e1', 'f1', 'd2', 'e2', 'f2']) tap(sq);
    press(/Check/);
    press('Continue');
    for (const sq of ['d7', 'e7', 'f7', 'd8', 'e8', 'f8', 'd9', 'e9', 'f9']) tap(sq);
    press(/Check/);
    press('Continue');
    press('Continue'); // completion screen

    expect(screen.getByRole('button', { name: 'The board (completed)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'The General (start)' })).toHaveProperty('disabled', false);
    expect(screen.getByText('1 of 18 lessons complete')).toBeTruthy();

    // A fresh app on the same store keeps the progress.
    cleanup();
    render(<App store={store} />);
    expect(screen.getByRole('button', { name: 'The board (completed)' })).toBeTruthy();
  });

  it('switches language and remembers the choice', () => {
    const store = createMemoryStore();
    render(<App store={store} />);
    press('Vietnamese');
    expect(screen.getByText('Bàn cờ và quân Tướng')).toBeTruthy();
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
});
