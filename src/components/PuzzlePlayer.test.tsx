// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { legalMoves, squareName } from '../engine';
import { I18nProvider } from '../i18n/I18nProvider';
import { puzzles } from '../puzzles/catalog';
import { acceptedFirstMoves, sameMove, startPosition } from '../puzzles/logic';
import { PuzzlePlayer, REPLY_DELAY_MS } from './PuzzlePlayer';

const cell = (square: string) => screen.getByRole('gridcell', { name: new RegExp(`^${square},`) });
const tap = (square: string) => fireEvent.click(cell(square));
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const move = (from: string, to: string) => {
  tap(from);
  tap(to);
};

const mateIn2 = puzzles.find((p) => p.goal === 'mate-in-2')!;

function renderPlayer(puzzle = mateIn2) {
  const onSolved = vi.fn();
  const onNext = vi.fn();
  render(
    <I18nProvider initial="en">
      <PuzzlePlayer puzzle={puzzle} number={7} hasNext onExit={vi.fn()} onSolved={onSolved} onNext={onNext} />
    </I18nProvider>,
  );
  return { onSolved, onNext };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('PuzzlePlayer', () => {
  it('shows who is to move and the goal', () => {
    renderPlayer();
    expect(screen.getByRole('status').textContent).toMatch(/Red to move/);
    expect(screen.getByText('Checkmate in two moves, whatever Black does.')).toBeTruthy();
  });

  it('rejects a wrong move with feedback and lets the player retry', () => {
    renderPlayer();
    const pos = startPosition(mateIn2);
    const wrong = legalMoves(pos).find((m) => !acceptedFirstMoves(mateIn2).some((a) => sameMove(a, m)))!;
    move(squareName(wrong.from), squareName(wrong.to));
    expect(screen.getByRole('alert').textContent).toMatch(/Not the winning move/);
    press('Try again');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(cell(squareName(wrong.from)).getAttribute('aria-label')).toMatch(/Red/); // move undone
  });

  it('gives a two-level hint: first the piece, then the target', () => {
    renderPlayer();
    const [first] = mateIn2.solution;
    press('Hint');
    expect(cell(first.from).getAttribute('aria-label')).toMatch(/hint/);
    expect(cell(first.to).getAttribute('aria-label')).not.toMatch(/hint/);
    press('Show target');
    expect(cell(first.to).getAttribute('aria-label')).toMatch(/hint/);
  });

  it('plays Black’s reply automatically, then accepts the mate', () => {
    const { onSolved } = renderPlayer();
    const [first, reply, mate] = mateIn2.solution;
    move(first.from, first.to);
    expect(screen.getByRole('status').textContent).toMatch(/Black replies/);
    act(() => vi.advanceTimersByTime(REPLY_DELAY_MS));
    expect(cell(reply.to).getAttribute('aria-label')).toMatch(/Black/);
    expect(screen.getByRole('status').textContent).toMatch(/Red to move/);
    move(mate.from, mate.to);
    expect(screen.getByRole('alert').textContent).toMatch(/Solved!/);
    expect(onSolved).toHaveBeenCalledWith(mateIn2.id);
  });

  it('can show the solution without counting the puzzle as solved', () => {
    const { onSolved, onNext } = renderPlayer();
    press('Show solution');
    act(() => vi.advanceTimersByTime(REPLY_DELAY_MS * mateIn2.solution.length));
    expect(screen.getByRole('alert').textContent).toMatch(/Solution/);
    expect(onSolved).not.toHaveBeenCalled();
    press('Next puzzle');
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('shows the XP earned on the success screen', () => {
    const mate1 = puzzles.find((p) => p.goal === 'mate-in-1')!;
    const { rerender } = render(
      <I18nProvider initial="en">
        <PuzzlePlayer puzzle={mate1} number={1} hasNext onExit={vi.fn()} onSolved={vi.fn()} onNext={vi.fn()} xpEarned={5} />
      </I18nProvider>,
    );
    move(mate1.solution[0].from, mate1.solution[0].to);
    expect(screen.getByRole('alert').textContent).toMatch(/Solved!.*\+5 XP/);
    rerender(
      <I18nProvider initial="en">
        <PuzzlePlayer puzzle={mate1} number={1} hasNext onExit={vi.fn()} onSolved={vi.fn()} onNext={vi.fn()} xpEarned={0} />
      </I18nProvider>,
    );
    expect(screen.getByRole('alert').textContent).toMatch(/Already solved: no XP this time/);
  });
});
