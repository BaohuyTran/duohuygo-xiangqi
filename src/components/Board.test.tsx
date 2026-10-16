// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { START_FEN, makeMove, parseFen, parseSquare } from '../engine';
import { I18nProvider } from '../i18n/I18nProvider';
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
