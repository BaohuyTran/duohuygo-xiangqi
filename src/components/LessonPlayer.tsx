import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { CombinationExercise, Exercise, Lesson } from '../content/types';
import {
  findGeneral,
  isInCheck,
  legalMovesFrom,
  legalMoves,
  makeMove,
  parseSquare,
  type Move,
  type Piece,
  type Position,
  type Square,
} from '../engine';
import { useI18n } from '../i18n/I18nProvider';
import {
  checkCapture,
  checkMove,
  checkSelection,
  expectedSelection,
  positionOf,
  regionSquares,
  type MoveVerdict,
  type SelectionResult,
} from '../lessons/answers';
import {
  checkCombinationMove,
  combinationDone,
  combinationReply,
  redMovesLeft,
  type CombinationVerdict,
} from '../lessons/combination';
import { sameMove, toMove } from '../puzzles/logic';
import { moveSound, useSound } from '../sound';
import { Board, type MarkTone } from './Board';
import { Celebration } from './Celebration';
import { SoundToggle } from './SoundToggle';
import { HeartIcon } from './StatsBar';
import { useElementHeight } from './useElementHeight';

export interface LessonPlayerProps {
  lesson: Lesson;
  onExit: () => void;
  onComplete: () => void;
  /** Hearts left; when given, they are shown and every wrong answer calls `onMistake`. */
  hearts?: number;
  /** A wrong answer: the app takes a heart (never below 0). */
  onMistake?: () => void;
  /** XP the completion screen announces (awarded by the app on Continue). */
  completionXp?: number;
}

/** What a wrong answer did to the hearts, for the feedback text. */
interface HeartNote {
  lost: boolean;
  left: number;
}

export function LessonPlayer({ lesson, onExit, onComplete, hearts, onMistake, completionXp }: LessonPlayerProps) {
  const { t } = useI18n();
  const { play } = useSound();
  const [index, setIndex] = useState(0);
  const [firstTryCorrect, setFirstTryCorrect] = useState(0);
  const [heartsLost, setHeartsLost] = useState(0);
  const total = lesson.exercises.length;
  const done = index >= total;

  const finishExercise = (firstTry: boolean) => {
    if (firstTry) setFirstTryCorrect((n) => n + 1);
    if (index + 1 >= total) play('complete');
    setIndex((i) => i + 1);
  };

  const mistake = (): HeartNote | null => {
    if (hearts === undefined) return null;
    onMistake?.();
    if (hearts <= 0) return { lost: false, left: 0 };
    setHeartsLost((n) => n + 1);
    return { lost: true, left: hearts - 1 };
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
      <header className="flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={onExit}
          aria-label={t('lesson.quit')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-500 hover:bg-stone-200"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
        <div
          role="progressbar"
          aria-label={t('lesson.progress', { n: Math.min(index + 1, total), total })}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={index}
          className="h-4 flex-1 overflow-hidden rounded-full bg-stone-200"
        >
          <div className="h-full rounded-full bg-green-500 transition-[width] duration-300" style={{ width: `${(index / total) * 100}%` }} />
        </div>
        <SoundToggle />
        {hearts !== undefined && (
          <div className={`flex min-h-11 shrink-0 items-center gap-1 ${hearts > 0 ? 'text-red-500' : 'text-stone-400'}`} data-testid="lesson-hearts">
            {/* Re-keyed on every lost heart so the shake animation replays. */}
            <span key={heartsLost} className={heartsLost > 0 ? 'heart-lost' : undefined}>
              <HeartIcon className="h-7 w-7" />
            </span>
            <span className="sr-only">{t('lesson.hearts', { n: hearts })}</span>
            <span aria-hidden className="text-lg font-extrabold">
              {hearts}
            </span>
          </div>
        )}
      </header>

      {done ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
          <Celebration />
          <div className="celebrate-pop flex h-28 w-28 items-center justify-center rounded-full bg-amber-400 text-6xl text-white shadow-lg" aria-hidden>
            ★
          </div>
          <h2 className="text-3xl font-extrabold text-amber-600">{t('done.title')}</h2>
          <p className="text-lg text-stone-600">{t('done.stats', { correct: firstTryCorrect, total })}</p>
          {completionXp !== undefined && (
            <p className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-2 text-2xl font-extrabold text-amber-600">
              {t('xp.earned', { xp: completionXp })}
            </p>
          )}
          <button
            type="button"
            onClick={onComplete}
            className="h-12 w-full max-w-xs rounded-2xl bg-green-500 text-lg font-bold text-white shadow-[0_4px_0_#15803d] active:translate-y-1 active:shadow-none"
          >
            {t('lesson.continue')}
          </button>
        </section>
      ) : (
        (() => {
          const ex = lesson.exercises[index];
          return ex.type === 'combination' ? (
            <CombinationView key={index} exercise={ex} onFinished={finishExercise} onMistake={mistake} />
          ) : (
            <ExerciseView key={index} exercise={ex} onFinished={finishExercise} onMistake={mistake} />
          );
        })()
      )}
    </div>
  );
}

type Status = 'answering' | 'correct' | 'incorrect';

function ExerciseView({
  exercise: ex,
  onFinished,
  onMistake,
}: {
  exercise: Exclude<Exercise, CombinationExercise>;
  onFinished: (firstTry: boolean) => void;
  onMistake: () => HeartNote | null;
}) {
  const { t } = useI18n();
  const { play } = useSound();
  const [footerRef, footerHeight] = useElementHeight<HTMLElement>();
  const start = useMemo(() => positionOf(ex), [ex]);
  const fixedFrom = ex.type === 'move' && ex.from !== undefined ? parseSquare(ex.from) : null;

  const [status, setStatus] = useState<Status>('answering');
  const [hadMistake, setHadMistake] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<Square>>(new Set());
  const [selected, setSelected] = useState<Square | null>(fixedFrom);
  const [played, setPlayed] = useState<Move | null>(null);
  const [verdict, setVerdict] = useState<MoveVerdict | null>(null);
  const [selection, setSelection] = useState<SelectionResult | null>(null);
  const [heartNote, setHeartNote] = useState<HeartNote | null>(null);

  const position = played ? makeMove(start, played) : start;

  /** `delay`: seconds to wait so the verdict sound follows a move sound. */
  const succeed = (delay = 0) => {
    play('correct', delay);
    setStatus('correct');
  };
  const fail = (delay = 0) => {
    play('wrong', delay);
    setStatus('incorrect');
    setHadMistake(true);
    setHeartNote(onMistake());
  };
  const retry = () => {
    setStatus('answering');
    setPicked(new Set());
    setSelected(fixedFrom);
    setPlayed(null);
    setVerdict(null);
    setSelection(null);
    setHeartNote(null);
  };

  const onSquareClick = (sq: Square) => {
    if (status !== 'answering') return;
    if (ex.type === 'select-squares') {
      setPicked((prev) => {
        const next = new Set(prev);
        if (next.has(sq)) next.delete(sq);
        else next.add(sq);
        return next;
      });
      return;
    }
    if (ex.type !== 'move' && ex.type !== 'capture') return;
    const piece = start.board[sq];
    if (piece && piece.color === start.turn) {
      setSelected(sq === selected && fixedFrom === null ? null : sq);
      return;
    }
    if (selected === null) return;
    const move = { from: selected, to: sq };
    const result = ex.type === 'move' ? checkMove(ex, move) : checkCapture(ex, move);
    setVerdict(result);
    // Show the move on the board whenever it was legal, so the learner sees what happened.
    const shown = result !== 'illegal' && result !== 'unsafe' && result !== 'wrong-piece';
    if (shown) {
      setPlayed(move);
      play(moveSound(start, move));
    }
    setSelected(null);
    if (result === 'correct') succeed(shown ? 0.12 : 0);
    else fail(shown ? 0.12 : 0);
  };

  const checkPicked = () => {
    if (ex.type !== 'select-squares') return;
    const result = checkSelection(ex, picked);
    setSelection(result);
    if (result.correct) succeed();
    else fail();
  };

  // ----- Board decorations -----
  const marks = new Map<Square, MarkTone>();
  let dots: Square[] = [];
  let boardSelected: Square | null = selected;
  if (ex.type === 'learn') {
    const highlight = ex.highlight === undefined ? [] : typeof ex.highlight === 'string' ? regionSquares(ex.highlight) : ex.highlight.map(parseSquare);
    for (const sq of highlight) marks.set(sq, 'zone');
    if (ex.square) {
      boardSelected = parseSquare(ex.square);
      dots = legalMovesFrom(start, boardSelected);
    }
  } else if (ex.type === 'select-squares') {
    if (selection && status !== 'answering') {
      for (const sq of expectedSelection(ex)) marks.set(sq, selection.missed.includes(sq) ? 'missed' : 'good');
      for (const sq of selection.wrong) marks.set(sq, 'wrong');
    } else {
      for (const sq of picked) marks.set(sq, 'pick');
    }
    if (ex.square) boardSelected = parseSquare(ex.square);
  } else if (ex.type === 'move' && ex.goal.kind === 'reach' && !played) {
    for (const s of ex.goal.squares) marks.set(parseSquare(s), 'target');
  }
  const checked = isInCheck(position) ? findGeneral(position.board, position.turn) : null;
  const capturedPiece = played ? start.board[played.to] : null;

  const promptKey = ex.type === 'learn' ? ex.text : ex.prompt;
  const explanation = ex.type !== 'learn' ? ex.explanation : undefined;

  return (
    <>
      <section className="flex-1 px-4 pb-4" style={{ '--footer-h': `${footerHeight}px` } as CSSProperties}>
        <p className="text-sm font-bold tracking-wide text-violet-600 uppercase">{t(`lesson.type.${ex.type}`)}</p>
        <h2 className="mt-1 mb-3 text-lg leading-snug font-bold text-stone-800" data-testid="prompt">
          {t(promptKey)}
        </h2>
        <div className={`board-fit overflow-hidden rounded-xl shadow-md ${status === 'incorrect' ? 'feedback-shake' : ''}`}>
          <Board
            position={position}
            selected={boardSelected}
            dots={dots}
            marks={marks}
            lastMove={played}
            animateMove={played}
            captured={played && capturedPiece ? { at: played.to, piece: capturedPiece } : null}
            checkedGeneral={checked}
            onSquareClick={ex.type === 'learn' ? undefined : onSquareClick}
          />
        </div>
        {(ex.type === 'move' || ex.type === 'capture') && status === 'answering' && (
          <p className="mt-3 text-center text-sm text-stone-500">{t('lesson.tapPiece')}</p>
        )}
      </section>
      {/* Reserves the fixed footer's height, so the board's last row can always scroll clear of it. */}
      <div aria-hidden className="shrink-0" style={{ height: footerHeight }} />

      {(status !== 'answering' || ex.type === 'learn' || ex.type === 'select-squares') && (
      <footer
        key={status}
        ref={footerRef}
        className={`safe-px fixed inset-x-0 bottom-0 z-10 border-t-2 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${status !== 'answering' ? 'feedback-in' : ''} ${
          status === 'correct' ? 'border-green-200 bg-green-100' : status === 'incorrect' ? 'border-red-200 bg-red-100' : 'border-stone-200 bg-[#fdf6e3]'
        }`}
      >
        <div className="mx-auto flex max-w-xl flex-col gap-3">
          {status !== 'answering' && (
            <div role="alert">
              <p className={`text-xl font-extrabold ${status === 'correct' ? 'text-green-700' : 'feedback-shake text-red-700'}`}>
                <span className={status === 'correct' ? 'feedback-pop' : undefined}>
                  {t(status === 'correct' ? 'feedback.correct' : 'feedback.incorrect')}
                </span>
              </p>
              {status === 'incorrect' && (
                <p className="text-red-700">{t(selection ? 'verdict.selection' : `verdict.${verdict}`)}</p>
              )}
              {status === 'incorrect' && heartNote && (
                <p className="mt-1 flex items-center gap-1.5 font-bold text-red-700">
                  <HeartIcon className="h-5 w-5 shrink-0" />
                  {heartNote.lost ? t('hearts.lost', { n: heartNote.left }) : t('hearts.noneLeft')}
                </p>
              )}
              {status === 'correct' && explanation && <p className="text-green-800">{t(explanation)}</p>}
            </div>
          )}

          {status === 'answering' && ex.type === 'learn' && (
            <PrimaryButton onClick={() => onFinished(true)}>{t('lesson.continue')}</PrimaryButton>
          )}
          {status === 'answering' && ex.type === 'select-squares' && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPicked(new Set())}
                disabled={picked.size === 0}
                className="h-12 rounded-2xl border-2 border-stone-300 bg-white px-4 font-bold text-stone-600 disabled:opacity-40"
              >
                {t('lesson.clear')}
              </button>
              <PrimaryButton onClick={checkPicked} disabled={picked.size === 0}>
                {t('lesson.check')}
                {picked.size > 0 && <span className="ml-2 text-sm font-semibold opacity-80">({t('lesson.selected', { n: picked.size })})</span>}
              </PrimaryButton>
            </div>
          )}
          {status === 'correct' && <PrimaryButton onClick={() => onFinished(!hadMistake)}>{t('lesson.continue')}</PrimaryButton>}
          {status === 'incorrect' && (
            <PrimaryButton tone="red" onClick={retry}>
              {t('lesson.retry')}
            </PrimaryButton>
          )}
        </div>
      </footer>
      )}
    </>
  );
}

/** Delay before Black's automatic reply in a combination. */
export const COMBINATION_REPLY_MS = 650;

type ComboPhase = 'playing' | 'opponent' | 'wrong' | 'done';

/** A combination: Red plays several moves, the engine answers each with a best defence. */
function CombinationView({
  exercise: ex,
  onFinished,
  onMistake,
}: {
  exercise: CombinationExercise;
  onFinished: (firstTry: boolean) => void;
  onMistake: () => HeartNote | null;
}) {
  const { t } = useI18n();
  const { play } = useSound();
  const [footerRef, footerHeight] = useElementHeight<HTMLElement>();
  const start = useMemo(() => positionOf(ex), [ex]);

  const [phase, setPhase] = useState<ComboPhase>('playing');
  const [pos, setPos] = useState<Position>(start);
  const [step, setStep] = useState(0);
  const [onMainLine, setOnMainLine] = useState(true);
  const [selected, setSelected] = useState<Square | null>(null);
  const [wrongMove, setWrongMove] = useState<Move | null>(null);
  const [verdict, setVerdict] = useState<CombinationVerdict | null>(null);
  const [hadMistake, setHadMistake] = useState(false);
  const [heartNote, setHeartNote] = useState<HeartNote | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [captured, setCaptured] = useState<{ at: Square; piece: Piece } | null>(null);

  // The pending auto-reply is cancelled on unmount.
  const timers = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const showMove = (before: Position, move: Move | null) => {
    setLastMove(move);
    const victim = move ? before.board[move.to] : null;
    setCaptured(move && victim ? { at: move.to, piece: victim } : null);
    if (move) play(moveSound(before, move));
  };

  const playMove = (move: Move) => {
    setSelected(null);
    const result = checkCombinationMove(ex, step, pos, move);
    if (result !== 'correct') {
      setVerdict(result);
      if (result === 'wrong') {
        setWrongMove(move);
        showMove(pos, move);
      }
      play('wrong', result === 'wrong' ? 0.12 : 0);
      setHadMistake(true);
      setHeartNote(onMistake());
      setPhase('wrong');
      return;
    }
    const after = makeMove(pos, move);
    const stillMain = onMainLine && ex.solution[step] !== undefined && sameMove(move, toMove(ex.solution[step]));
    setPos(after);
    showMove(pos, move);
    setShowHint(false);
    play('correct', 0.12);
    if (combinationDone(ex, after, step)) {
      setPhase('done');
      return;
    }
    setPhase('opponent');
    later(() => {
      const reply = combinationReply(ex, step + 1, after, stillMain);
      setPos(makeMove(after, reply));
      showMove(after, reply);
      setOnMainLine(stillMain && ex.solution[step + 1] !== undefined && sameMove(reply, toMove(ex.solution[step + 1])));
      setStep(step + 2);
      setPhase('playing');
    }, COMBINATION_REPLY_MS);
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
    setHeartNote(null);
    showMove(pos, null);
    setPhase('playing');
  };

  const shown = wrongMove ? makeMove(pos, wrongMove) : pos;
  const hintKey = ex.hints?.[step / 2];
  const hintMove = showHint && onMainLine && ex.solution[step] ? toMove(ex.solution[step]) : null;
  const marks = new Map<Square, MarkTone>();
  if (hintMove) marks.set(hintMove.from, 'hint');
  const dots = selected !== null && phase === 'playing' ? legalMoves(pos).filter((m) => m.from === selected).map((m) => m.to) : [];
  const checked = isInCheck(shown) ? findGeneral(shown.board, shown.turn) : null;
  const shownMove = wrongMove ?? lastMove;
  const shownCapture = wrongMove ? (pos.board[wrongMove.to] ? { at: wrongMove.to, piece: pos.board[wrongMove.to]! } : null) : captured;
  const left = redMovesLeft(ex, step);
  const wrongText =
    verdict === 'illegal' || verdict === 'unsafe'
      ? t(`verdict.${verdict}`)
      : t(ex.goal === 'checkmate' ? 'combination.wrong.mate' : 'combination.wrong.material');

  return (
    <>
      <section className="flex-1 px-4 pb-4" style={{ '--footer-h': `${footerHeight}px` } as CSSProperties}>
        <p className="text-sm font-bold tracking-wide text-violet-600 uppercase">{t('lesson.type.combination')}</p>
        <h2 className="mt-1 mb-1 text-lg leading-snug font-bold text-stone-800" data-testid="prompt">
          {t(ex.prompt)}
        </h2>
        <p className="mb-3 text-sm font-semibold text-stone-500" data-testid="combination-status">
          {phase === 'opponent' ? t('combination.opponent') : phase === 'done' ? t('combination.done') : t('combination.movesLeft', { n: left })}
        </p>
        <div className={`board-fit overflow-hidden rounded-xl shadow-md ${phase === 'wrong' ? 'feedback-shake' : ''}`}>
          <Board
            position={shown}
            selected={selected}
            dots={dots}
            marks={marks}
            lastMove={shownMove}
            animateMove={shownMove}
            captured={shownCapture}
            checkedGeneral={checked}
            onSquareClick={onSquareClick}
          />
        </div>
        {phase === 'playing' && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <p className="text-center text-sm text-stone-500">{t('lesson.tapPiece')}</p>
            {!showHint && onMainLine ? (
              <button
                type="button"
                onClick={() => setShowHint(true)}
                className="min-h-11 rounded-xl px-4 text-sm font-bold text-violet-700 underline"
              >
                {t('combination.hint')}
              </button>
            ) : (
              showHint && <p className="text-center text-sm font-semibold text-violet-700">{t(hintKey ?? 'combination.hintPiece')}</p>
            )}
          </div>
        )}
      </section>
      <div aria-hidden className="shrink-0" style={{ height: footerHeight }} />

      {(phase === 'wrong' || phase === 'done') && (
        <footer
          key={phase}
          ref={footerRef}
          className={`safe-px feedback-in fixed inset-x-0 bottom-0 z-10 border-t-2 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${
            phase === 'done' ? 'border-green-200 bg-green-100' : 'border-red-200 bg-red-100'
          }`}
        >
          <div className="mx-auto flex max-w-xl flex-col gap-3">
            <div role="alert">
              <p className={`text-xl font-extrabold ${phase === 'done' ? 'text-green-700' : 'feedback-shake text-red-700'}`}>
                <span className={phase === 'done' ? 'feedback-pop' : undefined}>
                  {t(phase === 'done' ? 'feedback.correct' : 'feedback.incorrect')}
                </span>
              </p>
              {phase === 'wrong' && <p className="text-red-700">{wrongText}</p>}
              {phase === 'wrong' && heartNote && (
                <p className="mt-1 flex items-center gap-1.5 font-bold text-red-700">
                  <HeartIcon className="h-5 w-5 shrink-0" />
                  {heartNote.lost ? t('hearts.lost', { n: heartNote.left }) : t('hearts.noneLeft')}
                </p>
              )}
              {phase === 'done' && ex.explanation && <p className="text-green-800">{t(ex.explanation)}</p>}
            </div>
            {phase === 'done' ? (
              <PrimaryButton onClick={() => onFinished(!hadMistake)}>{t('lesson.continue')}</PrimaryButton>
            ) : (
              <PrimaryButton tone="red" onClick={retry}>
                {t('lesson.retry')}
              </PrimaryButton>
            )}
          </div>
        </footer>
      )}
    </>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  tone = 'green',
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'green' | 'red';
}) {
  const colors =
    tone === 'green' ? 'bg-green-500 shadow-[0_4px_0_#15803d]' : 'bg-red-500 shadow-[0_4px_0_#b91c1c]';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-12 flex-1 rounded-2xl text-lg font-bold text-white ${colors} active:translate-y-1 active:shadow-none disabled:bg-stone-300 disabled:shadow-none`}
    >
      {children}
    </button>
  );
}
