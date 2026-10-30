import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { DecisionExercise, MoveTableEntry } from '../content/types';
import {
  findGeneral,
  isInCheck,
  legalMoves,
  makeMove,
  squareName,
  type Move,
  type Piece,
  type Position,
  type Square,
} from '../engine';
import { useI18n } from '../i18n/I18nProvider';
import { positionOf, type HintStep, type MoveVerdict } from '../lessons/answers';
import { decisionCredit, decisionGuard, isAccepted, judgeDecision, parseMoveKey, type MoveJudge, type Refutation } from '../lessons/decision';
import { formatMove } from '../notation/format';
import { moveSound, useSound } from '../sound';
import { Board, type MarkTone } from './Board';
import { FeedbackLine, FeedbackPanel, PrimaryButton, useOnwardKey, type HeartNote } from './FeedbackPanel';
import { useElementHeight } from './useElementHeight';

/** What a view reports about an answer that is not a heart-costing mistake (accepted, or dubious). */
export interface AnswerReport {
  /** 03-assessment.md §3.2 credit of this answer, 0–1. */
  credit: number;
  /** The item is solved by this answer (target/sound, or a dubious move the item accepts). */
  accepted: boolean;
  misconception?: string;
}

/** Callbacks and services the lesson player gives the decision and choice views. */
export interface ItemViewProps<E> {
  exercise: E;
  /** Continue after the item is solved. `firstTry`: solved by the first answer. */
  onFinished: (firstTry: boolean) => void;
  /** A wrong answer that costs a heart; `misconception` tags it. */
  onMistake: (misconception?: string) => HeartNote | null;
  onAnswer: (report: AnswerReport) => void;
  onHint: (step: HintStep) => void;
  /** Set when a jump-ahead test has no lives left: replaces "Try again". */
  onOutOfLives?: () => void;
  /** Practice offers the hint ladder; tests never do (03-assessment.md §3.2). */
  allowHints: boolean;
  /** A test (jump ahead): no hints and no free retries (03-assessment.md §3.2). */
  test: boolean;
  judge: MoveJudge;
  /** Shuffle seed of this item (choice). */
  seed: number;
}

type Phase = 'answering' | 'accepted' | 'dubious' | 'error' | 'illegal';

const HINT_ORDER: readonly HintStep[] = ['idea', 'piece', 'move'];

/**
 * A `decision`: one move where several are reasonable (02-curriculum.md §5.1). The verdict is the committed
 * move table (instant); after an `error` move the refutation is fetched through `judge` and shown on the board.
 */
export function DecisionView({ exercise: ex, onFinished, onMistake, onAnswer, onHint, onOutOfLives, allowHints, test, judge }: ItemViewProps<DecisionExercise>) {
  const { t, lang } = useI18n();
  const onwardKey = useOnwardKey();
  const { play } = useSound();
  const [footerRef, footerHeight] = useElementHeight<HTMLElement>();
  const start = useMemo(() => positionOf(ex), [ex]);
  const side = ex.side ?? 'red';

  const [phase, setPhase] = useState<Phase>('answering');
  const [selected, setSelected] = useState<Square | null>(null);
  const [played, setPlayed] = useState<Move | null>(null);
  const [entry, setEntry] = useState<MoveTableEntry | null>(null);
  const [illegal, setIllegal] = useState<MoveVerdict | null>(null);
  const [refutation, setRefutation] = useState<Refutation | 'pending' | null>(null);
  const [heartNote, setHeartNote] = useState<HeartNote | null>(null);
  const [hadMiss, setHadMiss] = useState(false);
  const [hintStep, setHintStep] = useState(0);

  // Ignore a refutation that arrives after a retry or after the view is gone.
  const generation = useRef(0);
  useEffect(() => () => void (generation.current += 1), []);

  const hintMove = ex.hints ? parseMoveKey(ex.hints.move) : null;
  const hintsOn = allowHints && !test && ex.hints !== undefined;
  // A dubious answer ends the item when the item accepts it, and always in a test (no free retry there).
  const dubiousEnds = ex.dubious === 'accept' || test;

  const playMove = (move: Move) => {
    if (phase !== 'answering') return;
    setSelected(null);
    const verdict = judgeDecision(ex, move, start);
    if (verdict.kind === 'illegal' || !isAccepted(verdict.entry.class)) setHadMiss(true);
    if (verdict.kind === 'illegal') {
      setIllegal(verdict.verdict);
      play('wrong');
      setHeartNote(onMistake());
      setPhase('illegal');
      return;
    }
    const row = verdict.entry;
    setEntry(row);
    setPlayed(move);
    play(moveSound(start, move));
    if (isAccepted(row.class)) {
      onAnswer({ credit: decisionCredit(ex, row.class), accepted: true });
      play('correct', 0.12);
      setPhase('accepted');
      return;
    }
    if (row.class === 'dubious') {
      onAnswer({ credit: decisionCredit(ex, row.class), accepted: dubiousEnds, misconception: row.misconception });
      setPhase('dubious');
      return;
    }
    play('wrong', 0.12);
    setHeartNote(onMistake(row.misconception));
    setPhase('error');
    setRefutation('pending');
    const gen = ++generation.current;
    judge
      .refutation(start, move, decisionGuard(ex))
      .then((r) => {
        if (gen !== generation.current) return;
        setRefutation(r.reply && r.kind ? r : null);
        if (r.reply) play(moveSound(makeMove(start, move), r.reply));
      })
      .catch(() => {
        if (gen === generation.current) setRefutation(null);
      });
  };

  const retry = () => {
    generation.current += 1;
    setPhase('answering');
    setSelected(null);
    setPlayed(null);
    setEntry(null);
    setIllegal(null);
    setRefutation(null);
    setHeartNote(null);
  };

  const nextHint = () => {
    const step = HINT_ORDER[hintStep];
    if (!step) return;
    setHintStep(hintStep + 1);
    onHint(step);
  };

  const onSquareClick = (sq: Square) => {
    if (phase !== 'answering') return;
    const piece = start.board[sq];
    if (piece && piece.color === start.turn) {
      setSelected(sq === selected ? null : sq);
      return;
    }
    if (selected !== null) playMove({ from: selected, to: sq });
  };

  // ----- Board -----
  const afterLearner = played ? makeMove(start, played) : start;
  const reply = refutation && refutation !== 'pending' ? refutation.reply : null;
  const shown = reply ? makeMove(afterLearner, reply) : afterLearner;
  const shownMove = reply ?? played;
  const before = reply ? afterLearner : start;
  const victim = shownMove ? before.board[shownMove.to] : null;
  const marks = new Map<Square, MarkTone>();
  if (phase === 'answering' && hintMove) {
    if (hintStep >= 2) marks.set(hintMove.from, 'hint');
    if (hintStep >= 3) marks.set(hintMove.to, 'target');
  }
  const dots = selected !== null && phase === 'answering' ? legalMoves(start).filter((m) => m.from === selected).map((m) => m.to) : [];
  const checked = isInCheck(shown) ? findGeneral(shown.board, shown.turn) : null;

  // ----- Feedback -----
  const fb = ex.feedback;
  const tempted = fb && entry && fb.temptingAlternative.move === entry.move;
  const notation = (move: Move, pos: Position) => formatMove(move, pos, 'traditional', lang);
  let panel: { tone: 'correct' | 'incorrect' | 'neutral'; title: string; lines: { label?: string; text: string }[] } | null = null;
  if (phase === 'accepted' && entry) {
    const lines: { label?: string; text: string }[] = [];
    if (entry.reason) lines.push({ text: t(entry.reason) });
    else if (entry.class === 'sound') lines.push({ text: t('decision.sound.body') });
    if (fb) lines.push({ label: t('feedback.label.purpose'), text: t(fb.purpose) }, { label: t('feedback.label.keyReply'), text: t(fb.keyReply) });
    if (ex.explanation) lines.push({ text: t(ex.explanation) });
    panel = { tone: 'correct', title: t(entry.class === 'target' ? 'feedback.correct' : 'decision.title.sound'), lines };
  } else if (phase === 'dubious' && entry) {
    const lines: { label?: string; text: string }[] = [{ text: t(entry.reason ?? 'decision.dubious.body') }];
    if (tempted) lines.push({ label: t('feedback.label.tempting'), text: t(fb.temptingAlternative.text) });
    // Point to the idea without giving the move (02 §7 rule 3).
    if (!dubiousEnds && hintsOn) lines.push({ label: t('feedback.label.idea'), text: t(ex.hints!.idea) });
    lines.push({ text: t(test ? 'decision.dubious.final' : dubiousEnds ? 'decision.dubious.accepted' : 'decision.dubious.retry') });
    panel = { tone: 'neutral', title: t('decision.title.dubious'), lines };
  } else if (phase === 'error' && entry && played) {
    const lines: { label?: string; text: string }[] = [];
    if (refutation === 'pending') lines.push({ text: t('decision.refuting') });
    else if (refutation?.reply && refutation.kind) {
      lines.push({ text: t(refutation.kind === 'mate' ? 'decision.refute.mate' : 'decision.refute.material', { move: notation(refutation.reply, afterLearner) }) });
    } else if (!entry.reason) lines.push({ text: t('decision.error.generic') });
    // No engine claim without a refutation: an authored error beyond the horizon speaks through its reason.
    if (entry.reason) lines.push({ text: t(entry.reason) });
    if (tempted) lines.push({ label: t('feedback.label.tempting'), text: t(fb.temptingAlternative.text) });
    else if (fb) lines.push({ text: t(fb.commonError) });
    panel = { tone: 'incorrect', title: t('feedback.incorrect'), lines };
  } else if (phase === 'illegal' && illegal) {
    panel = { tone: 'incorrect', title: t('feedback.incorrect'), lines: [{ text: t(`verdict.${illegal}`) }] };
  }
  const solved = phase === 'accepted' || (phase === 'dubious' && dubiousEnds);

  return (
    <>
      <section className="flex-1 px-4 pb-4" style={{ '--footer-h': `${footerHeight}px` } as CSSProperties}>
        <p className="text-sm font-bold tracking-wide text-violet-600 uppercase">{t('lesson.type.decision')}</p>
        <h2 className="mt-1 mb-1 text-lg leading-snug font-bold text-stone-800" data-testid="prompt">
          {t(ex.prompt)}
        </h2>
        <p className="mb-3 text-sm font-semibold text-stone-500">{t('side.toMove', { side: t(`color.${side}`) })}</p>
        <div className={`board-fit overflow-hidden rounded-xl shadow-md ${phase === 'error' || phase === 'illegal' ? 'feedback-shake' : ''}`}>
          <Board
            position={shown}
            selected={selected}
            dots={dots}
            marks={marks}
            lastMove={shownMove}
            animateMove={shownMove}
            captured={shownMove && victim ? { at: shownMove.to, piece: victim as Piece } : null}
            checkedGeneral={checked}
            onSquareClick={onSquareClick}
            orientation={side}
            fileNumbers
          />
        </div>
        {phase === 'answering' && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <p className="text-center text-sm text-stone-500">{t('lesson.tapPiece')}</p>
            {hintsOn && hintStep > 0 && (
              <p className="text-center text-sm font-semibold text-violet-700" data-testid="hint-text">
                {hintStep === 1
                  ? t(ex.hints!.idea)
                  : hintStep === 2
                    ? t('combination.hintPiece')
                    : t('decision.hint.move', { move: hintMove ? notation(hintMove, start) : '' })}
              </p>
            )}
            {hintsOn && hintStep < HINT_ORDER.length && (
              <button type="button" onClick={nextHint} className="min-h-11 rounded-xl px-4 text-sm font-bold text-violet-700 underline">
                {t(`decision.hint.next.${HINT_ORDER[hintStep]}`)}
              </button>
            )}
            <MovePicker position={start} onMove={playMove} />
          </div>
        )}
      </section>
      <div aria-hidden className="shrink-0" style={{ height: footerHeight }} />

      {panel && (
        <FeedbackPanel
          key={phase}
          panelRef={footerRef}
          tone={panel.tone}
          title={panel.title}
          heartNote={phase === 'error' || phase === 'illegal' ? heartNote : null}
          actions={
            solved ? (
              <PrimaryButton onClick={() => onFinished(!hadMiss)}>{t('lesson.continue')}</PrimaryButton>
            ) : phase === 'dubious' ? (
              <PrimaryButton onClick={retry}>{t('lesson.retry')}</PrimaryButton>
            ) : (
              <PrimaryButton tone="red" onClick={onOutOfLives ?? retry}>
                {t(onOutOfLives ? onwardKey : 'lesson.retry')}
              </PrimaryButton>
            )
          }
        >
          {panel.lines.map((line, i) => (
            <FeedbackLine key={i} label={line.label}>
              {line.text}
            </FeedbackLine>
          ))}
        </FeedbackPanel>
      )}
    </>
  );
}

/**
 * Keyboard (and screen-reader) way to play a move: choose one of the side to move's pieces, then a legal
 * destination, then "Play move". Native selects and a button, so Tab / arrows / Enter work everywhere.
 */
export function MovePicker({ position, onMove }: { position: Position; onMove: (move: Move) => void }) {
  const { t, lang } = useI18n();
  const id = useId();
  const moves = useMemo(() => legalMoves(position), [position]);
  const froms = useMemo(() => [...new Set(moves.map((m) => m.from))].sort((a, b) => a - b), [moves]);
  const [from, setFrom] = useState<Square | null>(null);
  const [to, setTo] = useState<Square | null>(null);
  const targets = from === null ? [] : moves.filter((m) => m.from === from).map((m) => m.to);
  const pieceName = (sq: Square) => {
    const p = position.board[sq]!;
    return `${t(`piece.${p.type}`)} ${squareName(sq)}`;
  };
  const selectClass = 'min-h-11 w-full rounded-xl border-2 border-stone-300 bg-white px-2 text-base';
  return (
    <details className="w-full max-w-sm rounded-xl border-2 border-stone-200 bg-white/60" data-testid="move-picker">
      <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-bold text-stone-600">{t('picker.title')}</summary>
      <div className="flex flex-col gap-2 p-3">
        <label className="flex flex-col gap-1 text-sm font-semibold text-stone-600" htmlFor={`${id}-from`}>
          {t('picker.piece')}
          <select
            id={`${id}-from`}
            className={selectClass}
            value={from ?? ''}
            onChange={(e) => {
              setFrom(e.target.value === '' ? null : Number(e.target.value));
              setTo(null);
            }}
          >
            <option value="">{t('picker.choosePiece')}</option>
            {froms.map((sq) => (
              <option key={sq} value={sq}>
                {pieceName(sq)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-stone-600" htmlFor={`${id}-to`}>
          {t('picker.target')}
          <select
            id={`${id}-to`}
            className={selectClass}
            value={to ?? ''}
            disabled={from === null}
            onChange={(e) => setTo(e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">{t('picker.chooseTarget')}</option>
            {targets.map((sq) => (
              <option key={sq} value={sq}>
                {`${squareName(sq)} · ${formatMove({ from: from!, to: sq }, position, 'traditional', lang)}`}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={from === null || to === null}
          onClick={() => {
            if (from === null || to === null) return;
            onMove({ from, to });
            setFrom(null);
            setTo(null);
          }}
          className="min-h-11 rounded-xl bg-violet-600 px-4 font-bold text-white disabled:bg-stone-300"
        >
          {t('picker.play')}
        </button>
      </div>
    </details>
  );
}
