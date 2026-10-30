import { createContext, useContext, type ReactNode, type Ref } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { HeartIcon } from './StatsBar';

/** What a wrong answer did to the hearts, for the feedback text. */
export interface HeartNote {
  lost: boolean;
  left: number;
}

/**
 * The i18n key of the red button that replaces "Try again" when `onOutOfLives` is set: "See result" in a jump-ahead
 * test with no lives left (default), "Continue" in an assessment (each item answered once, 03-assessment.md §7.2).
 */
const OnwardKey = createContext('jump.seeResult');
export const OnwardKeyProvider = OnwardKey.Provider;
export const useOnwardKey = (): string => useContext(OnwardKey);

export type FeedbackTone = 'correct' | 'incorrect' | 'neutral' | 'idle';

const TONES: Record<FeedbackTone, { box: string; title: string }> = {
  correct: { box: 'border-green-200 bg-green-100', title: 'text-green-700' },
  incorrect: { box: 'border-red-200 bg-red-100', title: 'feedback-shake text-red-700' },
  // A move that is safe but misses the idea, or could not be checked: no penalty.
  neutral: { box: 'border-amber-200 bg-amber-50', title: 'text-amber-800' },
  idle: { box: 'border-stone-200 bg-[#fdf6e3]', title: 'text-stone-700' },
};

/**
 * The fixed feedback footer of the lesson players (02-curriculum.md §7): a title, the feedback lines, the heart
 * note and the action buttons. `panelRef` lets the player measure it (useElementHeight) and reserve its height.
 * The text is announced (`role="alert"`) whenever a title is shown.
 */
export function FeedbackPanel({
  tone,
  title,
  children,
  heartNote,
  actions,
  panelRef,
}: {
  tone: FeedbackTone;
  title?: string;
  children?: ReactNode;
  heartNote?: HeartNote | null;
  actions: ReactNode;
  panelRef?: Ref<HTMLElement>;
}) {
  const { t } = useI18n();
  const style = TONES[tone];
  return (
    <footer
      ref={panelRef}
      data-testid="feedback-panel"
      data-tone={tone}
      className={`safe-px fixed inset-x-0 bottom-0 z-10 border-t-2 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${tone !== 'idle' ? 'feedback-in' : ''} ${style.box}`}
    >
      <div className="mx-auto flex max-h-[60dvh] max-w-xl flex-col gap-3 overflow-y-auto">
        {title && (
          <div role="alert">
            <p className={`text-xl font-extrabold ${style.title}`}>
              <span className={tone === 'correct' ? 'feedback-pop' : undefined}>{title}</span>
            </p>
            <div className={`flex flex-col gap-1 ${tone === 'correct' ? 'text-green-800' : tone === 'incorrect' ? 'text-red-700' : 'text-stone-700'}`}>
              {children}
            </div>
            {heartNote && (
              <p className="mt-1 flex items-center gap-1.5 font-bold text-red-700">
                <HeartIcon className="h-5 w-5 shrink-0" />
                {heartNote.lost ? t('hearts.lost', { n: heartNote.left }) : t('hearts.noneLeft')}
              </p>
            )}
          </div>
        )}
        <div className="flex gap-3">{actions}</div>
      </div>
    </footer>
  );
}

export function PrimaryButton({
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
  const colors = tone === 'green' ? 'bg-green-500 shadow-[0_4px_0_#15803d]' : 'bg-red-500 shadow-[0_4px_0_#b91c1c]';
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

/** A labelled feedback line ("Why it works: …"). */
export function FeedbackLine({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <p>
      {label && <span className="font-bold">{label} </span>}
      {children}
    </p>
  );
}
