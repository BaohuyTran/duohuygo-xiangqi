// Test-only fixture for `npm run ui:check`: a lesson-player-like screen with Black at the bottom
// (Board `orientation="black"`, per-side file numbers), Black to move after Red's Central Cannon.
// Tap a Black piece, then a legal point; the footer shows the move in traditional notation.
// `?lang=vi` switches the language. Built by scripts/ui-fixtures/vite.config.mjs, never by the app.
import { StrictMode, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { Board } from '../../src/components/Board';
import { useElementHeight } from '../../src/components/useElementHeight';
import { legalMovesFrom, makeMove, parseFen, parseSquare, START_FEN, type Move, type Square } from '../../src/engine';
import { I18nProvider, useI18n } from '../../src/i18n/I18nProvider';
import { formatMove } from '../../src/notation/format';
import './fixture.css';

// Red has played the Central Cannon (h2-e2); Black to move.
const START = makeMove(parseFen(START_FEN), { from: parseSquare('h2'), to: parseSquare('e2') });

function Fixture() {
  const { t, lang } = useI18n();
  const [position, setPosition] = useState(START);
  const [selected, setSelected] = useState<Square | null>(null);
  const [played, setPlayed] = useState<{ move: Move; text: string } | null>(null);
  const [footerRef, footerHeight] = useElementHeight<HTMLElement>();
  const dots = selected === null ? [] : legalMovesFrom(position, selected);

  const onSquareClick = (sq: Square) => {
    if (played) return;
    const p = position.board[sq];
    if (p?.color === position.turn) return setSelected(sq);
    if (selected !== null && dots.includes(sq)) {
      const move = { from: selected, to: sq };
      setPlayed({ move, text: formatMove(move, position, 'traditional', lang) });
      setPosition(makeMove(position, move));
      setSelected(null);
    }
  };
  const restart = () => {
    setPosition(START);
    setPlayed(null);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
      <header className="flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={restart}
          aria-label={t('lesson.quit')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-500 hover:bg-stone-200"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
        <p className="font-bold text-stone-700" data-testid="side">
          {t('side.toMove', { side: t('color.black') })}
        </p>
      </header>
      <section className="flex-1 px-4 pb-4" style={{ '--footer-h': `${footerHeight}px` } as CSSProperties}>
        <h2 className="mt-1 mb-3 text-lg leading-snug font-bold text-stone-800">{t('lesson.tapPiece')}</h2>
        <div className="board-fit overflow-hidden rounded-xl shadow-md">
          <Board
            position={position}
            orientation="black"
            fileNumbers
            selected={selected}
            dots={dots}
            lastMove={played?.move}
            animateMove={played?.move}
            onSquareClick={onSquareClick}
          />
        </div>
      </section>
      <div aria-hidden className="shrink-0" style={{ height: footerHeight }} />
      <footer
        ref={footerRef}
        className={`safe-px fixed inset-x-0 bottom-0 z-10 border-t-2 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${
          played ? 'border-green-200 bg-green-100' : 'border-stone-200 bg-[#fdf6e3]'
        }`}
      >
        <div className="mx-auto flex max-w-xl flex-col gap-3">
          {played && (
            <div role="alert">
              <p className="text-xl font-extrabold text-green-700">{t('feedback.correct')}</p>
              <p className="text-green-800" data-testid="notation">
                {played.text}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={restart}
            disabled={!played}
            className="min-h-12 w-full rounded-2xl bg-green-500 px-4 font-extrabold text-white uppercase disabled:opacity-40"
          >
            {t('lesson.continue')}
          </button>
        </div>
      </footer>
    </div>
  );
}

const lang = new URLSearchParams(location.search).get('lang') === 'vi' ? 'vi' : 'en';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider initial={lang}>
      <Fixture />
    </I18nProvider>
  </StrictMode>,
);
