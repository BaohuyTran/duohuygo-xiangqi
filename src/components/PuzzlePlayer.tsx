import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Puzzle } from '../content/puzzle-types';
import { findGeneral, forcedWinMoves, isInCheck, legalMoves, makeMove, type Move, type Position, type Square } from '../engine';
import { useI18n } from '../i18n/I18nProvider';
import {
  attackerMovesLeft,
  checkPuzzleMove,
  defenderReply,
  materialGain,
  sameMove,
  startPosition,
  toMove,
  type PuzzleVerdict,
} from '../puzzles/logic';
import { Board, type MarkTone } from './Board';

/** Delay before the defender's automatic reply, and between moves when showing the solution. */
export const REPLY_DELAY_MS = 650;

type Phase = 'playing' | 'wrong' | 'opponent' | 'solved' | 'revealing' | 'revealed';

export interface PuzzlePlayerProps {
  puzzle: Puzzle;
  number: number;
  hasNext: boolean;
  onExit: () => void;
  onSolved: (id: string) => void;
  onNext: () => void;
}

export function PuzzlePlayer({ puzzle, number, hasNext, onExit, onSolved, onNext }: PuzzlePlayerProps) {
  const { t } = useI18n();
  const start = useMemo(() => startPosition(puzzle), [puzzle]);

  const [phase, setPhase] = useState<Phase>('playing');
  const [pos, setPos] = useState<Position>(start);
  const [step, setStep] = useState(0);
  const [onMainLine, setOnMainLine] = useState(true);
  const [selected, setSelected] = useState<Square | null>(null);
  const [wrongMove, setWrongMove] = useState<Move | null>(null);
  const [verdict, setVerdict] = useState<PuzzleVerdict | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [lastMove, setLastMove] = useState<Move | null>(null);

  // Pending timers (auto-replies, solution playback) are cancelled on unmount or restart.
  const timers = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };
  useEffect(() => () => clearTimers(), []);

  const shown = wrongMove ? makeMove(pos, wrongMove) : pos;

  /** The move a hint points to: the main line, or (after an accepted alternative) a move the engine finds. */
  const hintMove = useMemo((): Move | null => {
    if (phase !== 'playing') return null;
    if (onMainLine) return toMove(puzzle.solution[step]);
    if (puzzle.goal === 'win-material') {
      return legalMoves(pos).reduce<{ m: Move; g: number } | null>((best, m) => {
        const g = materialGain(puzzle, pos, m, step);
        return !best || g > best.g ? { m, g } : best;
      }, null)?.m ?? null;
    }
    return forcedWinMoves(pos, attackerMovesLeft(puzzle, step))[0] ?? null;
  }, [phase, onMainLine, puzzle, pos, step]);

  const playMove = (move: Move) => {
    const result = checkPuzzleMove(puzzle, step, pos, move);
    setSelected(null);
    if (result !== 'correct') {
      setVerdict(result);
      if (result === 'wrong') {
        setWrongMove(move);
        setLastMove(move);
      }
      setPhase('wrong');
      return;
    }
    const after = makeMove(pos, move);
    const stillMain = onMainLine && sameMove(move, toMove(puzzle.solution[step]));
    setPos(after);
    setLastMove(move);
    setHintLevel(0);
    if (step + 1 >= puzzle.solution.length) {
      setPhase('solved');
      onSolved(puzzle.id);
      return;
    }
    setPhase('opponent');
    later(() => {
      const reply = defenderReply(puzzle, step + 1, after, stillMain);
      setPos(makeMove(after, reply));
      setLastMove(reply);
      setOnMainLine(stillMain && sameMove(reply, toMove(puzzle.solution[step + 1])));
      setStep(step + 2);
      setPhase('playing');
    }, REPLY_DELAY_MS);
  };

  const onSquareClick = (sq: Square) => {
    if (phase !== 'playing') return;
    const piece = pos.board[sq];
    if (piece && piece.color === pos.turn) {
      setSelected(sq === selected ? null : sq);
      return;
    }
    if (selected !== null) playMove({ from: selected, to: sq });
  };

  const retry = () => {
    setWrongMove(null);
    setVerdict(null);
    setLastMove(null);
    setPhase('playing');
  };

  const restart = () => {
    clearTimers();
    setPos(start);
    setStep(0);
    setOnMainLine(true);
    setSelected(null);
    setWrongMove(null);
    setVerdict(null);
    setHintLevel(0);
    setLastMove(null);
    setPhase('playing');
  };

  const showSolution = () => {
    clearTimers();
    setPos(start);
    setStep(0);
    setOnMainLine(true);
    setSelected(null);
    setWrongMove(null);
    setVerdict(null);
    setHintLevel(0);
    setLastMove(null);
    setPhase('revealing');
    let cur = start;
    puzzle.solution.forEach((s, i) => {
      const move = toMove(s);
      const next = makeMove(cur, move);
      later(() => {
        setPos(next);
        setLastMove(move);
        if (i === puzzle.solution.length - 1) setPhase('revealed');
      }, REPLY_DELAY_MS * (i + 1));
      cur = next;
    });
  };

  // ----- Board decorations -----
  const marks = new Map<Square, MarkTone>();
  if (hintMove && hintLevel >= 1) marks.set(hintMove.from, 'hint');
  if (hintMove && hintLevel >= 2) marks.set(hintMove.to, 'hint');
  const dots = selected !== null && phase === 'playing' ? legalMoves(pos).filter((m) => m.from === selected).map((m) => m.to) : [];
  const checked = isInCheck(shown) ? findGeneral(shown.board, shown.turn) : null;
  const hintText = hintLevel >= 1 && onMainLine ? puzzle.solution[step]?.hint : undefined;

  const wrongText =
    verdict === 'illegal' || verdict === 'unsafe'
      ? t(`puzzle.wrong.${verdict}`)
      : t(puzzle.goal === 'win-material' ? 'puzzle.wrong.wrong.material' : 'puzzle.wrong.wrong.mate');

  const turnLabel = phase === 'opponent' ? t('puzzle.opponentMoving') : t(`puzzle.toMove.${puzzle.sideToMove}`);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
      <header className="flex items-center gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1">
        <button
          type="button"
          onClick={onExit}
          aria-label={t('puzzle.back')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-500 hover:bg-stone-200"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold text-stone-800">
            {t('puzzles.number', { n: number })} · {t(`goal.${puzzle.goal}`)}
          </h1>
          <p className="text-xs font-semibold text-stone-500">
            <span className="text-amber-500" aria-hidden>
              {'★'.repeat(puzzle.difficulty)}
            </span>{' '}
            {t(`theme.${puzzle.theme}`)}
          </p>
        </div>
      </header>

      <section className="flex-1 px-4 pb-48">
        <p role="status" aria-live="polite" className="mb-1 flex items-center gap-2 text-sm font-bold text-stone-700">
          <span aria-hidden className={`inline-block h-3 w-3 rounded-full ${phase === 'opponent' ? 'bg-stone-900' : 'bg-red-700'}`} />
          {turnLabel}
        </p>
        <h2 className="mb-3 text-lg leading-snug font-bold text-stone-800">{t(`puzzle.prompt.${puzzle.goal}`)}</h2>
        <div className="overflow-hidden rounded-xl shadow-md">
          <Board
            position={shown}
            selected={selected}
            dots={dots}
            marks={marks}
            lastMove={lastMove}
            animateMove={lastMove}
            checkedGeneral={checked}
            onSquareClick={onSquareClick}
          />
        </div>
        {hintText && <p className="mt-3 rounded-xl bg-violet-100 px-3 py-2 text-sm font-semibold text-violet-800">💡 {t(hintText)}</p>}
      </section>

      <footer
        className={`fixed inset-x-0 bottom-0 border-t-2 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${
          phase === 'solved'
            ? 'border-green-200 bg-green-100'
            : phase === 'wrong'
              ? 'border-red-200 bg-red-100'
              : phase === 'revealed'
                ? 'border-violet-200 bg-violet-100'
                : 'border-stone-200 bg-[#fdf6e3]'
        }`}
      >
        <div className="mx-auto flex max-w-xl flex-col gap-3">
          {(phase === 'playing' || phase === 'opponent' || phase === 'revealing') && (
            <div className="flex gap-3">
              <ActionButton tone="light" onClick={() => setHintLevel((h) => Math.min(2, h + 1))} disabled={phase !== 'playing' || hintLevel >= 2}>
                {t(hintLevel === 0 ? 'puzzle.hint' : 'puzzle.hintMore')}
              </ActionButton>
              <ActionButton tone="light" onClick={showSolution} disabled={phase === 'revealing'}>
                {t('puzzle.showSolution')}
              </ActionButton>
            </div>
          )}

          {phase === 'wrong' && (
            <>
              <div role="alert">
                <p className="text-xl font-extrabold text-red-700">{t('puzzle.wrong')}</p>
                <p className="text-red-700">{wrongText}</p>
              </div>
              <ActionButton tone="red" onClick={retry}>
                {t('puzzle.retry')}
              </ActionButton>
            </>
          )}

          {(phase === 'solved' || phase === 'revealed') && (
            <>
              <div role="alert">
                <p className={`text-xl font-extrabold ${phase === 'solved' ? 'text-green-700' : 'text-violet-800'}`}>
                  {t(phase === 'solved' ? 'puzzle.solvedTitle' : 'puzzle.revealedTitle')}
                </p>
                <p className={phase === 'solved' ? 'text-green-800' : 'text-violet-800'}>
                  {t(phase === 'solved' ? 'puzzle.solvedBody' : 'puzzle.revealedBody')}
                </p>
              </div>
              <div className="flex gap-3">
                {phase === 'revealed' && (
                  <ActionButton tone="light" onClick={restart}>
                    {t('puzzle.restart')}
                  </ActionButton>
                )}
                {hasNext ? (
                  <ActionButton tone="green" onClick={onNext}>
                    {t('puzzle.next')}
                  </ActionButton>
                ) : (
                  <ActionButton tone="green" onClick={onExit}>
                    {t('puzzle.back')}
                  </ActionButton>
                )}
              </div>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone: 'green' | 'red' | 'light';
}) {
  const colors = {
    green: 'bg-green-500 text-white shadow-[0_4px_0_#15803d]',
    red: 'bg-red-500 text-white shadow-[0_4px_0_#b91c1c]',
    light: 'border-2 border-stone-300 bg-white text-stone-700 shadow-[0_4px_0_#d6d3d1]',
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-12 flex-1 rounded-2xl px-3 text-base font-bold ${colors} active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:shadow-none`}
    >
      {children}
    </button>
  );
}
