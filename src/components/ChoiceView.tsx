import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { ChoiceExercise, ChoiceOption } from '../content/types';
import { findGeneral, isInCheck, type Move } from '../engine';
import { useI18n } from '../i18n/I18nProvider';
import { positionOf } from '../lessons/answers';
import { checkChoice, shuffleOptions, type ChoiceResult } from '../lessons/choice';
import { parseMoveKey } from '../lessons/decision';
import { formatMove } from '../notation/format';
import { useSound } from '../sound';
import { Board } from './Board';
import type { ItemViewProps } from './DecisionView';
import { FeedbackLine, FeedbackPanel, PrimaryButton, useOnwardKey, type HeartNote } from './FeedbackPanel';
import { useElementHeight } from './useElementHeight';

/**
 * A `choice` (02-curriculum.md §5.1): 3–4 options in a seeded order, one answer (radio) or every correct one
 * (checkboxes, `multi`). Keyboard: Tab + Space/Enter on an option, or the digit keys 1–4; then "Check".
 * After checking, each picked option shows its own feedback; a wrong pick tags its misconception.
 */
export function ChoiceView({ exercise: ex, onFinished, onMistake, onAnswer, onOutOfLives, seed }: ItemViewProps<ChoiceExercise>) {
  const { t, lang } = useI18n();
  const onwardKey = useOnwardKey();
  const { play } = useSound();
  const [footerRef, footerHeight] = useElementHeight<HTMLElement>();
  const start = useMemo(() => positionOf(ex), [ex]);
  const options = useMemo(() => shuffleOptions(ex.options, seed), [ex, seed]);
  const side = ex.side ?? 'red';
  const multi = ex.multi === true;

  const [picked, setPicked] = useState<readonly string[]>([]);
  const [result, setResult] = useState<ChoiceResult | null>(null);
  const [heartNote, setHeartNote] = useState<HeartNote | null>(null);
  const [hadMiss, setHadMiss] = useState(false);
  const answering = result === null;

  const toggle = (id: string) => {
    if (!answering) return;
    setPicked((prev) => (multi ? (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]) : [id]));
  };

  const check = () => {
    if (!answering || picked.length === 0) return;
    const r = checkChoice(ex, picked);
    setResult(r);
    if (r.correct) {
      onAnswer({ credit: 1, accepted: true });
      play('correct');
    } else {
      setHadMiss(true);
      play('wrong');
      setHeartNote(onMistake(r.misconception));
    }
  };

  const retry = () => {
    setPicked([]);
    setResult(null);
    setHeartNote(null);
  };

  // Digit keys 1–n pick the n-th option shown (Duolingo-style).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (!answering) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > options.length) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      toggle(options[n - 1].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const moveOf = (o: ChoiceOption): Move | null => (o.move ? parseMoveKey(o.move) : null);
  const label = (o: ChoiceOption) => {
    const m = moveOf(o);
    const parts = [m ? formatMove(m, start, 'traditional', lang) : null, o.text ? t(o.text) : null].filter(Boolean);
    return parts.join(' — ');
  };
  // The last picked option with a move is drawn on the board, so two compared moves can be seen one by one.
  const shownOption = [...picked].reverse().map((id) => options.find((o) => o.id === id)!).find((o) => o.move);
  const shownMove = shownOption ? moveOf(shownOption) : null;
  const checked = isInCheck(start) ? findGeneral(start.board, start.turn) : null;

  // Feedback is shown for picked options only: a wrong answer never reveals the key before the retry, and a
  // correct answer has picked every correct option.
  const stateOf = (o: ChoiceOption): 'right' | 'wrong' | null => (result && picked.includes(o.id) ? (o.correct ? 'right' : 'wrong') : null);

  return (
    <>
      <section className="flex-1 px-4 pb-4" style={{ '--footer-h': `${footerHeight}px` } as CSSProperties}>
        <p className="text-sm font-bold tracking-wide text-violet-600 uppercase">{t('lesson.type.choice')}</p>
        <h2 className="mt-1 mb-1 text-lg leading-snug font-bold text-stone-800" data-testid="prompt">
          {t(ex.prompt)}
        </h2>
        <p className="mb-3 text-sm font-semibold text-stone-500">{t('side.toMove', { side: t(`color.${side}`) })}</p>
        <div className="board-fit overflow-hidden rounded-xl shadow-md">
          <Board position={start} lastMove={shownMove} checkedGeneral={checked} orientation={side} fileNumbers />
        </div>
        <p className="mt-3 text-sm font-semibold text-stone-600" id="choice-instructions">
          {t(multi ? 'choice.pickAll' : 'choice.pickOne')} <span className="text-stone-500">{t('choice.keys', { n: options.length })}</span>
        </p>
        <div
          role={multi ? 'group' : 'radiogroup'}
          aria-labelledby="choice-instructions"
          className="mt-2 flex flex-col gap-2"
          data-testid="choice-options"
        >
          {options.map((o, i) => {
            const isPicked = picked.includes(o.id);
            const state = stateOf(o);
            const tone =
              state === 'right'
                ? 'border-green-500 bg-green-50'
                : state === 'wrong'
                  ? 'border-red-400 bg-red-50'
                  : isPicked
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-stone-300 bg-white';
            return (
              <div key={o.id} className="flex flex-col">
                <button
                  type="button"
                  role={multi ? 'checkbox' : 'radio'}
                  aria-checked={isPicked}
                  aria-disabled={!answering}
                  data-option={o.id}
                  onClick={() => toggle(o.id)}
                  className={`flex min-h-12 items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left font-semibold text-stone-800 ${tone}`}
                >
                  <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-stone-300 text-sm text-stone-500">
                    {i + 1}
                  </span>
                  <span>{label(o)}</span>
                </button>
                {state && (
                  <p
                    className={`mt-1 px-3 text-sm ${state === 'wrong' ? 'text-red-700' : 'text-green-800'}`}
                    data-testid={`option-feedback-${o.id}`}
                  >
                    <span className="font-bold">{t(state === 'wrong' ? 'choice.label.wrong' : 'choice.label.right')} </span>
                    {t(o.feedback)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <div aria-hidden className="shrink-0" style={{ height: footerHeight }} />

      {answering ? (
        <FeedbackPanel
          panelRef={footerRef}
          tone="idle"
          actions={
            <PrimaryButton onClick={check} disabled={picked.length === 0}>
              {t('lesson.check')}
            </PrimaryButton>
          }
        />
      ) : (
        <FeedbackPanel
          key={result.correct ? 'right' : 'wrong'}
          panelRef={footerRef}
          tone={result.correct ? 'correct' : 'incorrect'}
          title={t(result.correct ? 'feedback.correct' : 'feedback.incorrect')}
          heartNote={result.correct ? null : heartNote}
          actions={
            result.correct ? (
              <PrimaryButton onClick={() => onFinished(!hadMiss)}>{t('lesson.continue')}</PrimaryButton>
            ) : (
              <PrimaryButton tone="red" onClick={onOutOfLives ?? retry}>
                {t(onOutOfLives ? onwardKey : 'lesson.retry')}
              </PrimaryButton>
            )
          }
        >
          {!result.correct && <FeedbackLine>{t(result.missed.length > 0 && multi ? 'choice.missedSome' : 'choice.wrong')}</FeedbackLine>}
          {result.correct && ex.explanation && <FeedbackLine>{t(ex.explanation)}</FeedbackLine>}
        </FeedbackPanel>
      )}
    </>
  );
}
