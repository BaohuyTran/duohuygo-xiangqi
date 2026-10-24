import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { CaptureExercise, ChoiceExercise, CombinationExercise, DecisionExercise, Exercise, Lesson, LineExercise } from '../content/types';
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
  attemptRecord,
  checkCapture,
  checkMove,
  emptyAttempt,
  legality,
  movePrecheck,
  checkSelection,
  expectedSelection,
  positionOf,
  regionSquares,
  type HintStep,
  type ItemAttempt,
  type MoveVerdict,
  type SelectionResult,
} from '../lessons/answers';
import { itemSeed } from '../lessons/choice';
import { clientJudge, loadAppAnalysisClient, moveKey, type MoveJudge } from '../lessons/decision';
import type { AttemptRecord } from '../progress/records';
import {
  checkCombinationMove,
  combinationDone,
  combinationReply,
  redMovesLeft,
  variedCombinationReply,
  type CombinationVerdict,
} from '../lessons/combination';
import { appLineJudge, coverageCounts, pathKeys, type LineJudge } from '../lessons/line';
import { sameMove, toMove } from '../puzzles/logic';
import { JUMP_TEST_LIVES } from '../lessons/progress';
import { moveSound, useSound } from '../sound';
import { Board, type MarkTone } from './Board';
import { Celebration } from './Celebration';
import { ChoiceView } from './ChoiceView';
import { DecisionView, type AnswerReport } from './DecisionView';
import { LineView, type LineResult } from './LineView';
import { PrimaryButton, type HeartNote } from './FeedbackPanel';
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
  /**
   * A jump-ahead test instead of a lesson: JUMP_TEST_LIVES lives of its own (real hearts are not
   * touched), running out ends the test with a "not this time" screen (`onExit`), and finishing it
   * shows a "you skipped ahead" screen (`onComplete`).
   */
  test?: boolean;
  /**
   * Attempt events (03-assessment.md §3.1): every hint step taken, and one `attempt` record per finished item
   * that has an id and version (new-course content). Persisted by the app (S2.10/S2.13); nothing is stored here.
   */
  onEvent?: (event: LessonEvent) => void;
  /** Clock for event times (tests inject a fixed one). */
  now?: () => Date;
  /** Session seed for `choice` shuffles (default random per lesson run); each item derives its own seed. */
  seed?: number;
  /** Runtime analysis (goal `safe`, decision refutations). Default: the app's analysis Worker client. */
  judge?: MoveJudge;
  /** Runtime analysis of `line` items off the tree (default class, partner moves). Default: the app's Worker client. */
  lineJudge?: LineJudge;
  /**
   * The local attempt log (the app passes `createLearningRepository(store).attempts`): coverage of line deviations and
   * varied-defence replies (unseen first). Default: none (every reply unseen).
   */
  attempts?: () => readonly AttemptRecord[];
}

/** New-course items carry an id and a version (schema v2); the new rules (03 §3.2) apply only to them. */
const isNewCourseItem = (ex: Exercise | undefined): boolean => ex !== undefined && ex.id !== undefined && ex.version !== undefined;

export type LessonEvent =
  | { type: 'hint'; itemId: string; step: HintStep; at: string }
  | { type: 'attempt'; record: AttemptRecord };

export function LessonPlayer({
  lesson,
  onExit,
  onComplete,
  hearts: realHearts,
  onMistake,
  completionXp,
  test = false,
  onEvent,
  now = () => new Date(),
  seed: seedProp,
  judge: judgeProp,
  lineJudge: lineJudgeProp,
  attempts,
}: LessonPlayerProps) {
  const judge = useMemo(() => judgeProp ?? clientJudge(loadAppAnalysisClient), [judgeProp]);
  const lineJudge = useMemo(() => lineJudgeProp ?? appLineJudge(), [lineJudgeProp]);
  const { t } = useI18n();
  const { play } = useSound();
  const [index, setIndex] = useState(0);
  const [firstTryCorrect, setFirstTryCorrect] = useState(0);
  const [heartsLost, setHeartsLost] = useState(0);
  const [failed, setFailed] = useState(false);
  const [randomSeed] = useState(() => Math.floor(Math.random() * 2 ** 32));
  const seed = seedProp ?? randomSeed;
  const hearts = test ? JUMP_TEST_LIVES - heartsLost : realHearts;
  const total = lesson.exercises.length;
  const done = index >= total;
  const current = lesson.exercises[index] as Exercise | undefined;
  const itemKey = current?.id ?? `${lesson.id}#${index}`;
  const currentSeed = itemSeed(seed, itemKey);

  // What happened while the current item was answered (reset when the item changes).
  const attempt = useRef<{ index: number; data: ItemAttempt }>({ index: 0, data: emptyAttempt() });
  const tracked = (): ItemAttempt => {
    if (attempt.current.index !== index) attempt.current = { index, data: emptyAttempt() };
    return attempt.current.data;
  };
  const noteWrong = (a: ItemAttempt, misconception?: string) => {
    if (a.firstCredit === null) a.firstCredit = 0;
    if (a.wrong === 0) a.misconception = misconception;
    a.wrong += 1;
  };
  const answered = (report: AnswerReport) => {
    const a = tracked();
    if (a.firstCredit === null) {
      a.firstCredit = report.credit;
      // A first answer below full credit is a wrong answer even when it ends the item (a dubious move in a test).
      if (report.credit < 1 && report.accepted) a.misconception = report.misconception;
    }
    if (!report.accepted) {
      if (a.wrong === 0) a.misconception = report.misconception;
      a.wrong += 1;
    }
  };
  /** The first answer could not be checked: void the item's first-answer credit (no credit, no penalty). */
  const voidAnswer = () => {
    const a = tracked();
    if (a.firstCredit !== null) return;
    a.firstCredit = 0;
    a.voided = true;
  };
  /** Extra attempt-record fields of the current item (`path` of a line / varied combination, the line's steps). */
  const extra = useRef<{ index: number; data: Record<string, unknown> }>({ index: 0, data: {} });
  const setExtra = (data: Record<string, unknown>) => {
    extra.current = { index, data };
  };
  /** How often each continuation of `prefix` was met in earlier attempts of the current item (coverage). */
  const coverage = (prefix: readonly string[]) => coverageCounts(attempts?.() ?? [], current?.id, prefix);
  /** A finished line: its 03 §3.2 credit replaces the first-answer credit; the run goes into the record. */
  const lineFinished = (result: LineResult) => {
    const a = tracked();
    a.firstCredit = result.credit;
    if (result.voided) a.voided = true;
    setExtra({ path: result.path, steps: result.steps, ...(result.safetyNet ? { safetyNet: true } : {}) });
    finishExercise(result.firstTry);
  };

  const hinted = (step: HintStep) => {
    const a = tracked();
    a.hints += 1;
    a.hintStep = step;
    if (a.firstCredit === null) a.hintBeforeFirstAnswer = true;
    onEvent?.({ type: 'hint', itemId: itemKey, step, at: now().toISOString() });
  };

  const finishExercise = (firstTry: boolean) => {
    // New-course items (id + version): "right on the first try" counts independent answers only, with no hint
    // before the first answer and not voided (03 §3.2). Legacy items keep their old count.
    const t0 = tracked();
    const independent = !isNewCourseItem(current) || (!t0.hintBeforeFirstAnswer && !t0.voided);
    if (firstTry && independent) setFirstTryCorrect((n) => n + 1);
    if (current && onEvent) {
      const a = tracked();
      if (a.firstCredit === null) a.firstCredit = 1;
      if (current.type === 'choice') a.seed = currentSeed;
      const record = attemptRecord(current, a, test ? 'placement' : 'practice', now());
      if (record) onEvent({ type: 'attempt', record: extra.current.index === index ? { ...record, ...extra.current.data } : record });
    }
    if (index + 1 >= total) play('complete');
    setIndex((i) => i + 1);
  };

  const mistake = (misconception?: string): HeartNote | null => {
    noteWrong(tracked(), misconception);
    if (hearts === undefined) return null;
    if (!test) onMistake?.();
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

      {failed ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-stone-200 text-stone-500" aria-hidden>
            <HeartIcon className="h-14 w-14" />
          </div>
          <h2 className="text-3xl font-extrabold text-stone-700">{t('jump.failed.title')}</h2>
          <p className="text-lg text-stone-600">{t('jump.failed.body')}</p>
          <button
            type="button"
            onClick={onExit}
            className="h-12 w-full max-w-xs rounded-2xl bg-green-500 text-lg font-bold text-white shadow-[0_4px_0_#15803d] active:translate-y-1 active:shadow-none"
          >
            {t('jump.back')}
          </button>
        </section>
      ) : done ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
          <Celebration />
          <div className="celebrate-pop flex h-28 w-28 items-center justify-center rounded-full bg-amber-400 text-6xl text-white shadow-lg" aria-hidden>
            ★
          </div>
          <h2 className="text-3xl font-extrabold text-amber-600">{t(test ? 'jump.passed.title' : 'done.title')}</h2>
          <p className="text-lg text-stone-600">{t(test ? 'jump.passed.body' : 'done.stats', { correct: firstTryCorrect, total })}</p>
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
          // In a test with no lives left, the red button ends the test instead of retrying.
          const outOfLives = test && hearts !== undefined && hearts <= 0 ? () => setFailed(true) : undefined;
          const common = {
            onFinished: finishExercise,
            onMistake: mistake,
            onAnswer: answered,
            onHint: hinted,
            onOutOfLives: outOfLives,
            allowHints: !test,
            test,
            judge,
            seed: currentSeed,
          };
          return ex.type === 'combination' ? (
            <CombinationView
              key={index}
              exercise={ex}
              onFinished={finishExercise}
              onMistake={mistake}
              onOutOfLives={outOfLives}
              onHint={hinted}
              noHints={test && isNewCourseItem(ex)}
              varied={ex.variedDefence === true && !test ? { seed: currentSeed, coverage, onPath: (path) => setExtra({ path }) } : undefined}
            />
          ) : ex.type === 'line' ? (
            <LineView key={index} exercise={ex} {...common} onDone={lineFinished} lineJudge={lineJudge} coverage={coverage} />
          ) : ex.type === 'decision' ? (
            <DecisionView key={index} exercise={ex} {...common} />
          ) : ex.type === 'choice' ? (
            <ChoiceView key={index} exercise={ex} {...common} />
          ) : (
            <ExerciseView key={index} exercise={ex} onFinished={finishExercise} onMistake={mistake} onOutOfLives={outOfLives} onVoid={voidAnswer} judge={judge} />
          );
        })()
      )}
    </div>
  );
}

type Status = 'answering' | 'checking' | 'correct' | 'incorrect';

function ExerciseView({
  exercise: ex,
  onFinished,
  onMistake,
  onOutOfLives,
  onVoid,
  judge,
}: {
  exercise: Exclude<Exercise, CombinationExercise | DecisionExercise | ChoiceExercise | LineExercise>;
  onFinished: (firstTry: boolean) => void;
  onMistake: () => HeartNote | null;
  /** Set when a jump-ahead test has no lives left: replaces "Try again". */
  onOutOfLives?: () => void;
  /** The analysis could not check the answer (goal `safe`): void it, no credit and no penalty. */
  onVoid: () => void;
  judge: MoveJudge;
}) {
  const { t } = useI18n();
  const { play } = useSound();
  const [footerRef, footerHeight] = useElementHeight<HTMLElement>();
  const start = useMemo(() => positionOf(ex), [ex]);
  const fixedFrom = ex.type === 'move' && ex.from !== undefined ? parseSquare(ex.from) : null;

  const [status, setStatus] = useState<Status>('answering');
  const checkTimer = useRef<number | undefined>(undefined);
  // Bumped on unmount so a late `judge` answer (goal `safe`) is ignored.
  const generation = useRef(0);
  useEffect(
    () => () => {
      window.clearTimeout(checkTimer.current);
      generation.current += 1;
    },
    [],
  );
  const [hadMistake, setHadMistake] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<Square>>(new Set());
  const [selected, setSelected] = useState<Square | null>(fixedFrom);
  const [played, setPlayed] = useState<Move | null>(null);
  const [verdict, setVerdict] = useState<MoveVerdict | null>(null);
  const [selection, setSelection] = useState<SelectionResult | null>(null);
  const [heartNote, setHeartNote] = useState<HeartNote | null>(null);
  /** The last move tried (also when illegal), for the tempting-alternative feedback. */
  const [tried, setTried] = useState<Move | null>(null);

  const position = played ? makeMove(start, played) : start;

  /** `delay`: seconds to wait so the verdict sound follows a move sound. */
  const succeed = (delay = 0) => {
    play('correct', delay);
    setStatus('correct');
  };
  /**
   * `penalty: false`: the move could not be checked (04-architecture.md §5.4): no heart, not a mistake (the
   * attempt is voided), just another try.
   */
  const fail = (delay = 0, penalty = true) => {
    play('wrong', delay);
    setStatus('incorrect');
    if (penalty) setHadMistake(true);
    else onVoid();
    setHeartNote(penalty ? onMistake() : null);
  };
  const retry = () => {
    setStatus('answering');
    setPicked(new Set());
    setSelected(fixedFrom);
    setPlayed(null);
    setVerdict(null);
    setSelection(null);
    setHeartNote(null);
    setTried(null);
  };

  const onSquareClick = (sq: Square) => {
    if (status !== 'answering') return;
    if (ex.type === 'select-squares') {
      // The piece's own point is never an answer: ignore taps on it instead of counting a hidden pick.
      if (ex.square !== undefined && sq === parseSquare(ex.square)) return;
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
    // Stopping a mate in 3 means searching Black's replies three moves deep, which can take a moment:
    // show the legal move with "Checking your move…" first, then judge it.
    if (ex.type === 'move' && ex.goal.kind === 'defend' && (ex.goal.depth ?? 1) >= 3 && legality(start, move) === null) {
      setStatus('checking');
      setPlayed(move);
      play(moveSound(start, move));
      setSelected(null);
      checkTimer.current = window.setTimeout(() => {
        setStatus('answering');
        judgeMove(move);
      }, 30);
      return;
    }
    // Goal `safe` searches (the level's safety guard): judged through `judge`, after "Checking your move…".
    // checkMove's own checks (the fixed piece, legality) come first, so the verdict equals checkMove's.
    if (ex.type === 'move' && ex.goal.kind === 'safe' && movePrecheck(ex, move, start) === null) {
      setStatus('checking');
      setPlayed(move);
      play(moveSound(start, move));
      setSelected(null);
      const gen = ++generation.current;
      judge
        .safety(start, move, { itemId: ex.id, override: ex.goal.guard })
        .catch((): MoveVerdict => 'not-checked')
        .then((result) => {
          if (gen !== generation.current) return;
          setStatus('answering');
          judgeMove(move, result);
        });
      return;
    }
    judgeMove(move);
  };

  const judgeMove = (move: Move, known?: MoveVerdict) => {
    const result = known ?? (ex.type === 'move' ? checkMove(ex, move) : checkCapture(ex as CaptureExercise, move));
    setVerdict(result);
    setTried(move);
    // Show the move on the board whenever it was legal, so the learner sees what happened.
    const shown = result !== 'illegal' && result !== 'unsafe' && result !== 'wrong-piece';
    if (shown) {
      setPlayed(move);
      play(moveSound(start, move));
    }
    setSelected(null);
    if (result === 'correct') succeed(shown ? 0.12 : 0);
    else fail(shown ? 0.12 : 0, result !== 'not-checked');
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
  // The four feedback parts (02-curriculum.md §7) of a move item: purpose + key reply when correct; the
  // tempting-move text when exactly that move was tried, else the common error, when wrong.
  const fb = ex.type === 'move' || ex.type === 'capture' ? ex.feedback : undefined;
  const temptedKey = fb && tried && fb.temptingAlternative.move === moveKey(tried);
  /** The analysis could not check the move: neutral feedback, no heart, no shake (04-architecture.md §5.4). */
  const neutral = verdict === 'not-checked';
  const explanation = ex.type !== 'learn' ? ex.explanation : undefined;

  return (
    <>
      <section className="flex-1 px-4 pb-4" style={{ '--footer-h': `${footerHeight}px` } as CSSProperties}>
        <p className="text-sm font-bold tracking-wide text-violet-600 uppercase">{t(`lesson.type.${ex.type}`)}</p>
        <h2 className="mt-1 mb-3 text-lg leading-snug font-bold text-stone-800" data-testid="prompt">
          {t(promptKey)}
        </h2>
        <div className={`board-fit overflow-hidden rounded-xl shadow-md ${status === 'incorrect' && !neutral ? 'feedback-shake' : ''}`}>
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
            orientation={ex.side ?? 'red'}
          />
        </div>
        {(ex.type === 'move' || ex.type === 'capture') && status === 'answering' && (
          <p className="mt-3 text-center text-sm text-stone-500">{t('lesson.tapPiece')}</p>
        )}
        {status === 'checking' && (
          <p className="mt-3 text-center text-sm font-semibold text-stone-500" data-testid="checking">
            {t('combination.checking')}
          </p>
        )}
      </section>
      {/* Reserves the fixed footer's height, so the board's last row can always scroll clear of it. */}
      <div aria-hidden className="shrink-0" style={{ height: footerHeight }} />

      {((status !== 'answering' && status !== 'checking') || ex.type === 'learn' || ex.type === 'select-squares') && (
      <footer
        key={status}
        ref={footerRef}
        className={`safe-px fixed inset-x-0 bottom-0 z-10 border-t-2 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${status !== 'answering' ? 'feedback-in' : ''} ${
          status === 'correct'
            ? 'border-green-200 bg-green-100'
            : status === 'incorrect'
              ? neutral
                ? 'border-amber-200 bg-amber-50'
                : 'border-red-200 bg-red-100'
              : 'border-stone-200 bg-[#fdf6e3]'
        }`}
      >
        <div className="mx-auto flex max-w-xl flex-col gap-3">
          {status !== 'answering' && (
            <div role="alert">
              <p className={`text-xl font-extrabold ${status === 'correct' ? 'text-green-700' : neutral ? 'text-amber-800' : 'feedback-shake text-red-700'}`}>
                <span className={status === 'correct' ? 'feedback-pop' : undefined}>
                  {t(status === 'correct' ? 'feedback.correct' : neutral ? 'feedback.notChecked' : 'feedback.incorrect')}
                </span>
              </p>
              {status === 'incorrect' && (
                <p className={neutral ? 'text-stone-700' : 'text-red-700'}>{t(selection ? 'verdict.selection' : `verdict.${verdict}`)}</p>
              )}
              {status === 'incorrect' && !neutral && fb && (
                <p className="text-red-700" data-testid="feedback-wrong">
                  {temptedKey ? (
                    <>
                      <span className="font-bold">{t('feedback.label.tempting')} </span>
                      {t(fb.temptingAlternative.text)}
                    </>
                  ) : (
                    t(fb.commonError)
                  )}
                </p>
              )}
              {status === 'correct' && fb && (
                <div className="text-green-800" data-testid="feedback-right">
                  <p>
                    <span className="font-bold">{t('feedback.label.purpose')} </span>
                    {t(fb.purpose)}
                  </p>
                  <p>
                    <span className="font-bold">{t('feedback.label.keyReply')} </span>
                    {t(fb.keyReply)}
                  </p>
                </div>
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
          {status === 'incorrect' && neutral && <PrimaryButton onClick={retry}>{t('lesson.retry')}</PrimaryButton>}
          {status === 'incorrect' && !neutral && (
            <PrimaryButton tone="red" onClick={onOutOfLives ?? retry}>
              {t(onOutOfLives ? 'jump.seeResult' : 'lesson.retry')}
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

/** Combinations with at least this many Red moves are judged after a short pause, so the board can paint first. */
const DEFERRED_CHECK_MOVES = 4;

type ComboPhase = 'playing' | 'checking' | 'opponent' | 'wrong' | 'done';

/** A combination: Red plays several moves, the engine answers each with a best defence. */
function CombinationView({
  exercise: ex,
  onFinished,
  onMistake,
  onOutOfLives,
  onHint,
  noHints,
  varied,
}: {
  exercise: CombinationExercise;
  onFinished: (firstTry: boolean) => void;
  onMistake: () => HeartNote | null;
  onOutOfLives?: () => void;
  /** The hint marks the piece to move (ladder step "piece"). */
  onHint: (step: HintStep) => void;
  /** A new-course item in a jump-ahead test: no hints (03-assessment.md §3.2). Legacy items keep their hint. */
  noHints: boolean;
  /**
   * Varied defence (`variedDefence`, practice only): the opponent picks among all best replies, unseen first (coverage
   * from the attempt log), then by the seed; the moves played are reported for the attempt record (`onPath`).
   */
  varied?: { seed: number; coverage: (prefix: readonly string[]) => ReadonlyMap<string, number>; onPath: (path: string[]) => void };
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
  /** The rejected move and its step, for the tempting-alternative feedback (first move only). */
  const [rejected, setRejected] = useState<{ move: Move; step: number } | null>(null);
  /** Moves played so far (learner and opponent), for varied-defence coverage. */
  const played = useRef<Move[]>([]);

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
    // Judging a move in a mate in 4 can take a moment: show the move and "Checking…" first.
    if (ex.moves >= DEFERRED_CHECK_MOVES && legality(pos, move) === null) {
      setPhase('checking');
      setWrongMove(move);
      later(() => {
        setWrongMove(null);
        judgeMove(move);
      }, 30);
      return;
    }
    judgeMove(move);
  };

  const judgeMove = (move: Move) => {
    const result = checkCombinationMove(ex, step, pos, move);
    if (result !== 'correct') {
      setVerdict(result);
      setRejected({ move, step });
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
    played.current = [...played.current, move];
    if (combinationDone(ex, after, step)) {
      varied?.onPath(pathKeys(played.current));
      setPhase('done');
      return;
    }
    setPhase('opponent');
    later(() => {
      const reply = varied
        ? variedCombinationReply(ex, step + 1, after, { seed: varied.seed, counts: varied.coverage(pathKeys(played.current)) })
        : combinationReply(ex, step + 1, after, stillMain);
      played.current = [...played.current, reply];
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
  // A Black exercise uses the colour-neutral twins of the keys that say "Black" (S2.3).
  const neutral = ex.side === 'black' ? '.neutral' : '';
  const wrongText =
    verdict === 'illegal' || verdict === 'unsafe'
      ? t(`verdict.${verdict}`)
      : t(ex.goal === 'checkmate' ? `combination.wrong.mate${neutral}` : 'combination.wrong.material');

  return (
    <>
      <section className="flex-1 px-4 pb-4" style={{ '--footer-h': `${footerHeight}px` } as CSSProperties}>
        <p className="text-sm font-bold tracking-wide text-violet-600 uppercase">{t('lesson.type.combination')}</p>
        <h2 className="mt-1 mb-1 text-lg leading-snug font-bold text-stone-800" data-testid="prompt">
          {t(ex.prompt)}
        </h2>
        <p className="mb-3 text-sm font-semibold text-stone-500" data-testid="combination-status">
          {phase === 'opponent'
            ? t(`combination.opponent${neutral}`)
            : phase === 'checking'
              ? t('combination.checking')
              : phase === 'done'
                ? t('combination.done')
                : t('combination.movesLeft', { n: left })}
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
            orientation={ex.side ?? 'red'}
          />
        </div>
        {phase === 'playing' && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <p className="text-center text-sm text-stone-500">{t('lesson.tapPiece')}</p>
            {noHints ? null : !showHint && onMainLine ? (
              <button
                type="button"
                onClick={() => {
                  setShowHint(true);
                  onHint('piece');
                }}
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
              {phase === 'wrong' && ex.feedback && (
                <p className="text-red-700" data-testid="feedback-wrong">
                  {rejected?.step === 0 && moveKey(rejected.move) === ex.feedback.temptingAlternative.move ? (
                    <>
                      <span className="font-bold">{t('feedback.label.tempting')} </span>
                      {t(ex.feedback.temptingAlternative.text)}
                    </>
                  ) : (
                    t(ex.feedback.commonError)
                  )}
                </p>
              )}
              {phase === 'wrong' && heartNote && (
                <p className="mt-1 flex items-center gap-1.5 font-bold text-red-700">
                  <HeartIcon className="h-5 w-5 shrink-0" />
                  {heartNote.lost ? t('hearts.lost', { n: heartNote.left }) : t('hearts.noneLeft')}
                </p>
              )}
              {phase === 'done' && ex.explanation && <p className="text-green-800">{t(ex.explanation)}</p>}
              {phase === 'done' && ex.feedback && (
                <div className="text-green-800" data-testid="feedback-right">
                  <p>
                    <span className="font-bold">{t('feedback.label.purpose')} </span>
                    {t(ex.feedback.purpose)}
                  </p>
                  <p>
                    <span className="font-bold">{t('feedback.label.keyReply')} </span>
                    {t(ex.feedback.keyReply)}
                  </p>
                </div>
              )}
            </div>
            {phase === 'done' ? (
              <PrimaryButton onClick={() => onFinished(!hadMistake)}>{t('lesson.continue')}</PrimaryButton>
            ) : (
              <PrimaryButton tone="red" onClick={onOutOfLives ?? retry}>
                {t(onOutOfLives ? 'jump.seeResult' : 'lesson.retry')}
              </PrimaryButton>
            )}
          </div>
        </footer>
      )}
    </>
  );
}
