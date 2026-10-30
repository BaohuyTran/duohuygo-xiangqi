import { useMemo, useState, type CSSProperties } from 'react';
import { REVIEW_CATEGORIES, type ReviewCategory, type ReviewExercise } from '../content/types';
import { findGeneral, isInCheck, legalMoves, makeMove, type Move, type Piece, type Position, type Square } from '../engine';
import { useI18n } from '../i18n/I18nProvider';
import { positionOf } from '../lessons/answers';
import { isAccepted, moveKey, parseMoveKey } from '../lessons/decision';
import { formatMove } from '../notation/format';
import { PASS_MARK, r7 } from '../assessment/rubrics';
import { moveSound, useSound } from '../sound';
import { Board } from './Board';
import { MovePicker } from './DecisionView';
import { FeedbackLine, FeedbackPanel, PrimaryButton } from './FeedbackPanel';
import { useElementHeight } from './useElementHeight';

/** What a finished review reports (R7, 03-assessment.md §5.3). */
export interface ReviewReport {
  score: number;
  pass: boolean;
  markedPly: number;
  markedTurningPoint: boolean;
  betterMove: string;
  betterAccepted: boolean;
  reason: ReviewCategory;
  reasonMatches: boolean;
}

export interface ReviewViewProps {
  exercise: ReviewExercise;
  onDone: (report: ReviewReport) => void;
}

type Phase = 'mark' | 'better' | 'reason' | 'done';

/**
 * A `review` (03 §5.3 R7): step through an authored game, mark the turning point among the learner's moves, play a
 * better move there (judged by that turning point's decision table), choose the reason. R7 = 40 + 40 + 20.
 */
export function ReviewView({ exercise: ex, onDone }: ReviewViewProps) {
  const { t, lang } = useI18n();
  const { play } = useSound();
  const [footerRef, footerHeight] = useElementHeight<HTMLElement>();
  const start = useMemo(() => positionOf(ex), [ex]);
  const side = ex.side ?? 'red';
  const moves = useMemo(() => ex.moves.map((k) => parseMoveKey(k)!), [ex]);
  const positions = useMemo(() => {
    const out: Position[] = [start];
    for (const m of moves) out.push(makeMove(out[out.length - 1], m));
    return out;
  }, [start, moves]);

  const [phase, setPhase] = useState<Phase>('mark');
  /** Positions shown while stepping: index into `positions`. */
  const [view, setView] = useState(moves.length);
  const [marked, setMarked] = useState<number | null>(null);
  const [better, setBetter] = useState<Move | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [reason, setReason] = useState<ReviewCategory | null>(null);

  const tp = marked === null ? undefined : ex.turningPoints.find((p) => p.ply === marked);
  const notation = (ply: number) => formatMove(moves[ply], positions[ply], 'traditional', lang);
  const isLearnerPly = (ply: number) => positions[ply].turn === side;

  const result = useMemo(() => {
    if (marked === null || better === null || reason === null) return null;
    const row = tp?.table.find((r) => r.move === moveKey(better));
    const markedTurningPoint = tp !== undefined;
    const betterAccepted = row !== undefined && isAccepted(row.class);
    const reasonMatches = tp !== undefined && tp.category === reason;
    const score = r7({ markedTurningPoint, betterMove: betterAccepted, reasonMatches });
    return { score, pass: score >= (ex.passMark ?? PASS_MARK), markedTurningPoint, betterAccepted, reasonMatches };
  }, [marked, better, reason, tp, ex.passMark]);

  // ----- Board -----
  const shownIndex = phase === 'mark' ? view : marked ?? 0;
  const base = positions[shownIndex];
  const pos = phase !== 'mark' && better ? makeMove(base, better) : base;
  const lastMove = phase === 'mark' ? (view > 0 ? moves[view - 1] : null) : better;
  const prev = phase === 'mark' ? (view > 0 ? positions[view - 1] : start) : base;
  const victim = lastMove ? prev.board[lastMove.to] : null;
  const dots = phase === 'better' && selected !== null ? legalMoves(base).filter((m) => m.from === selected).map((m) => m.to) : [];
  const checked = isInCheck(pos) ? findGeneral(pos.board, pos.turn) : null;

  const playBetter = (m: Move) => {
    if (phase !== 'better') return;
    if (!legalMoves(base).some((x) => x.from === m.from && x.to === m.to)) return;
    play(moveSound(base, m));
    setBetter(m);
    setSelected(null);
    setPhase('reason');
  };
  const onSquareClick = (sq: Square) => {
    if (phase !== 'better') return;
    const piece = base.board[sq];
    if (piece && piece.color === base.turn) return void setSelected(sq === selected ? null : sq);
    if (selected !== null) playBetter({ from: selected, to: sq });
  };

  const top = ex.turningPoints[0];
  let panel: { tone: 'correct' | 'incorrect' | 'idle'; title: string; lines: string[]; action: { label: string; onClick: () => void; disabled?: boolean } } | null = null;
  if (phase === 'mark') {
    panel = {
      tone: 'idle',
      title: t('review.step.mark'),
      lines: marked === null ? [] : [t('review.move', { n: marked + 1, move: notation(marked) })],
      action: { label: t('review.mark'), onClick: () => setPhase('better'), disabled: marked === null },
    };
  } else if (phase === 'reason') {
    panel = { tone: 'idle', title: t('review.step.reason'), lines: [], action: { label: t('review.confirm'), onClick: () => setPhase('done'), disabled: reason === null } };
  } else if (phase === 'done' && result) {
    const yes = (ok: boolean) => t(ok ? 'review.result.yes' : 'review.result.no');
    const lines = [
      t('review.result.turningPoint', { ok: yes(result.markedTurningPoint) }),
      t('review.result.better', { ok: yes(result.betterAccepted) }),
      t('review.result.reason', { ok: yes(result.reasonMatches) }),
      t('play.result.score', { score: result.score, pass: ex.passMark ?? PASS_MARK }),
    ];
    if (!result.markedTurningPoint) lines.push(t('review.result.answer', { n: top.ply + 1, move: notation(top.ply) }));
    for (const p of ex.turningPoints) if (p.text) lines.push(t(p.text));
    if (ex.explanation) lines.push(t(ex.explanation));
    panel = {
      tone: result.pass ? 'correct' : 'incorrect',
      title: t(result.pass ? 'play.result.pass' : 'play.result.fail'),
      lines,
      action: {
        label: t('lesson.continue'),
        onClick: () =>
          onDone({
            score: result.score,
            pass: result.pass,
            markedPly: marked!,
            markedTurningPoint: result.markedTurningPoint,
            betterMove: moveKey(better!),
            betterAccepted: result.betterAccepted,
            reason: reason!,
            reasonMatches: result.reasonMatches,
          }),
      },
    };
  }

  return (
    <>
      <section className="flex-1 px-4 pb-4" style={{ '--footer-h': `${footerHeight}px` } as CSSProperties}>
        <p className="text-sm font-bold tracking-wide text-violet-600 uppercase">{t('lesson.type.review')}</p>
        <h2 className="mt-1 mb-2 text-lg leading-snug font-bold text-stone-800" data-testid="prompt">
          {t(ex.prompt)}
        </h2>
        {phase === 'better' && (
          <p className="mb-2 text-sm font-semibold text-violet-700" data-testid="review-step">
            {t('review.step.better')}
          </p>
        )}
        <div className="board-fit overflow-hidden rounded-xl shadow-md">
          <Board
            position={pos}
            selected={phase === 'better' ? selected : null}
            dots={dots}
            lastMove={lastMove}
            animateMove={lastMove}
            captured={lastMove && victim ? { at: lastMove.to, piece: victim as Piece } : null}
            checkedGeneral={checked}
            onSquareClick={phase === 'better' ? onSquareClick : undefined}
            orientation={side}
            fileNumbers
          />
        </div>
        {phase === 'mark' && (
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <button type="button" className="min-h-11 flex-1 rounded-xl border-2 border-stone-300 bg-white px-3 font-bold text-stone-700 disabled:opacity-40" disabled={view === 0} onClick={() => setView(view - 1)}>
                {t('review.prev')}
              </button>
              <button type="button" className="min-h-11 flex-1 rounded-xl border-2 border-stone-300 bg-white px-3 font-bold text-stone-700 disabled:opacity-40" disabled={view === moves.length} onClick={() => setView(view + 1)}>
                {t('review.next')}
              </button>
            </div>
            <ol className="flex flex-col gap-1" aria-label={t('review.moves')} data-testid="review-moves">
              {moves.map((_, ply) => (
                <li key={ply}>
                  {isLearnerPly(ply) ? (
                    <button
                      type="button"
                      aria-pressed={marked === ply}
                      onClick={() => {
                        setMarked(ply);
                        setView(ply + 1);
                      }}
                      className={`min-h-11 w-full rounded-xl border-2 px-3 text-left font-semibold ${marked === ply ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-stone-300 bg-white text-stone-700'}`}
                    >
                      {t('review.move', { n: ply + 1, move: notation(ply) })} {t('review.yours')}
                    </button>
                  ) : (
                    <p className="flex min-h-11 items-center px-3 text-stone-500">{t('review.move', { n: ply + 1, move: notation(ply) })}</p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
        {phase === 'better' && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <p className="text-center text-sm text-stone-500">{t('lesson.tapPiece')}</p>
            <MovePicker position={base} onMove={playBetter} />
          </div>
        )}
        {phase === 'reason' && (
          <fieldset className="mt-3 flex flex-col gap-2" data-testid="review-reasons">
            <legend className="mb-1 text-sm font-bold text-stone-600">{t('review.step.reason')}</legend>
            {REVIEW_CATEGORIES.map((c) => (
              <label key={c} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-2 px-3 font-semibold ${reason === c ? 'border-violet-500 bg-violet-50' : 'border-stone-300 bg-white'}`}>
                <input type="radio" name="review-reason" className="h-5 w-5" checked={reason === c} onChange={() => setReason(c)} />
                {t(`review.reason.${c}`)}
              </label>
            ))}
          </fieldset>
        )}
      </section>
      <div aria-hidden className="shrink-0" style={{ height: footerHeight }} />
      {panel && (
        <FeedbackPanel
          key={phase}
          panelRef={footerRef}
          tone={panel.tone}
          title={panel.title}
          actions={
            <PrimaryButton onClick={panel.action.onClick} disabled={panel.action.disabled}>
              {panel.action.label}
            </PrimaryButton>
          }
        >
          {panel.lines.map((line, i) => (
            <FeedbackLine key={i}>{line}</FeedbackLine>
          ))}
        </FeedbackPanel>
      )}
    </>
  );
}
