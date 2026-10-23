// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { START_FEN, makeMove, parseFen, parseSquare } from '../engine';
import { I18nProvider } from '../i18n/I18nProvider';
import { translate } from '../i18n/messages';
import { Board } from './Board';

afterEach(cleanup);

describe('Board move and capture animation', () => {
  it('slides the moved piece and fades the captured one out (decorative only)', () => {
    // Red cannon b2 takes the Black horse on b9.
    const before = parseFen(START_FEN);
    const move = { from: parseSquare('b2'), to: parseSquare('b9') };
    const victim = before.board[move.to]!;
    const { container } = render(
      <I18nProvider initial="en">
        <Board position={makeMove(before, move)} animateMove={move} captured={{ at: move.to, piece: victim }} />
      </I18nProvider>,
    );
    expect(container.querySelectorAll('.piece-slide')).toHaveLength(1);
    const ghost = container.querySelectorAll('.piece-captured');
    expect(ghost).toHaveLength(1);
    expect(ghost[0].getAttribute('aria-hidden')).toBe('true');
    expect(ghost[0].textContent).toBe('馬');
  });

  it('draws no animation without a move', () => {
    const { container } = render(
      <I18nProvider initial="en">
        <Board position={parseFen(START_FEN)} />
      </I18nProvider>,
    );
    expect(container.querySelector('.piece-slide, .piece-captured')).toBeNull();
  });
});

describe('Board orientation (playing Black)', () => {
  const pos = parseFen(START_FEN);
  // Grid units: CELL 10, MARGIN 5.5 (+ the number band when file numbers are shown).
  const centre = (container: HTMLElement, name: string) => {
    const cell = [...container.querySelectorAll('[role="gridcell"]')].find((g) => g.getAttribute('aria-label')?.startsWith(`${name},`))!;
    const hit = cell.querySelector('rect')!;
    return { x: Number(hit.getAttribute('x')) + 5, y: Number(hit.getAttribute('y')) + 5 };
  };

  it('draws Red at the bottom by default: (file, 9 − rank)', () => {
    const { container } = render(
      <I18nProvider initial="en">
        <Board position={pos} />
      </I18nProvider>,
    );
    expect(centre(container, 'a0')).toEqual({ x: 5.5, y: 95.5 });
    expect(centre(container, 'i9')).toEqual({ x: 85.5, y: 5.5 });
    expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 91 101');
    expect(screen.getByTestId('river-left').textContent).toBe('楚 河');
    expect(screen.getByRole('grid', { name: 'Xiangqi board' })).toBeTruthy();
    expect(container.querySelector('[data-edge]')).toBeNull();
  });

  it('turns the board 180° with Black at the bottom: (8 − file, rank), river labels swapped', () => {
    const { container } = render(
      <I18nProvider initial="en">
        <Board position={pos} orientation="black" />
      </I18nProvider>,
    );
    expect(centre(container, 'a0')).toEqual({ x: 85.5, y: 5.5 });
    expect(centre(container, 'i9')).toEqual({ x: 5.5, y: 95.5 });
    expect(centre(container, 'e9')).toEqual({ x: 45.5, y: 95.5 });
    expect(screen.getByTestId('river-left').textContent).toBe('漢 界');
    expect(screen.getByTestId('river-right').textContent).toBe('楚 河');
    expect(screen.getByRole('grid', { name: 'Xiangqi board, Black at the bottom' })).toBeTruthy();
  });

  it('keeps accessible names on the right points and sends taps to the right square', () => {
    const taps: number[] = [];
    const { container } = render(
      <I18nProvider initial="vi">
        <Board position={pos} orientation="black" onSquareClick={(sq) => taps.push(sq)} />
      </I18nProvider>,
    );
    // The bottom-left point of a Black-oriented board is i9, a Black Chariot.
    const cells = [...container.querySelectorAll('[role="gridcell"]')];
    const bottomLeft = cells.find((g) => {
      const r = g.querySelector('rect')!;
      return r.getAttribute('x') === '0.5' && r.getAttribute('y') === '90.5';
    })!;
    expect(bottomLeft.getAttribute('aria-label')).toBe('i9, Đen Xe');
    fireEvent.click(bottomLeft);
    fireEvent.click(screen.getByRole('gridcell', { name: /^e0, Đỏ Tướng/ }));
    expect(taps).toEqual([parseSquare('i9'), parseSquare('e0')]);
  });

  it('shows each side’s file numbers 1–9 along its own edge', () => {
    const numbers = (container: HTMLElement, edge: string) =>
      [...container.querySelectorAll(`[data-edge="${edge}"] text`)]
        .map((el) => ({ x: Number(el.getAttribute('x')), n: el.textContent }))
        .sort((a, b) => a.x - b.x)
        .map((e) => e.n)
        .join('');
    const red = render(
      <I18nProvider initial="en">
        <Board position={pos} fileNumbers />
      </I18nProvider>,
    );
    // Red at the bottom: Red counts from its right (file i = 1), Black from its right (file a = 1).
    expect(numbers(red.container, 'bottom')).toBe('987654321');
    expect(numbers(red.container, 'top')).toBe('123456789');
    expect(red.container.querySelector('[data-edge="bottom"]')!.getAttribute('data-side')).toBe('red');
    expect(red.container.querySelector('[data-edge="bottom"]')!.getAttribute('aria-hidden')).toBe('true');
    expect(red.container.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 91 110');
    expect(centre(red.container, 'a0')).toEqual({ x: 5.5, y: 100 });
    cleanup();
    const black = render(
      <I18nProvider initial="en">
        <Board position={pos} orientation="black" fileNumbers />
      </I18nProvider>,
    );
    // Black at the bottom: Black's numbers there, 1 on the learner's right; Red's at the top.
    expect(numbers(black.container, 'bottom')).toBe('987654321');
    expect(black.container.querySelector('[data-edge="bottom"]')!.getAttribute('data-side')).toBe('black');
    expect(numbers(black.container, 'top')).toBe('123456789');
    expect(black.container.querySelector('[data-edge="top"]')!.getAttribute('data-side')).toBe('red');
  });

  it('has colour-neutral {side} text in both languages', () => {
    expect(translate('en', 'side.toMove', { side: translate('en', 'color.black') })).toBe('Black to move');
    expect(translate('vi', 'side.toMove', { side: translate('vi', 'color.black') })).toBe('Đen đi');
  });
});
