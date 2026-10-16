import type { Unit } from '../content/types';
import { minutesUntil, type DailyGoal, type GamificationSummary } from '../gamification';
import { useI18n } from '../i18n/I18nProvider';
import type { LessonState } from '../lessons/progress';
import { LanguageToggle } from './LanguageToggle';
import { SoundToggle } from './SoundToggle';
import { HeartIcon, StatsBar } from './StatsBar';

const UNIT_COLORS = ['#16a34a', '#0284c7', '#9333ea', '#ea580c', '#db2777', '#ca8a04'];
// Horizontal offsets (px) that make the lesson path zig-zag like Duolingo's.
const ZIGZAG = [0, 44, 64, 44, 0, -44, -64, -44];

export interface HomeProps {
  units: readonly Unit[];
  states: ReadonlyMap<string, LessonState>;
  onStart: (lessonId: string) => void;
  onReset: () => void;
  stats: GamificationSummary;
  onGoalChange: (goal: DailyGoal) => void;
}

export function Home({ units, states, onStart, onReset, stats, onGoalChange }: HomeProps) {
  const { t } = useI18n();
  const all = units.flatMap((u) => u.lessons);
  const completedCount = all.filter((l) => states.get(l.id) === 'completed').length;

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-red-700">{t('app.title')}</h1>
          <p className="text-sm text-stone-500">{t('app.tagline')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <SoundToggle />
          <LanguageToggle />
        </div>
      </header>

      <StatsBar summary={stats} onGoalChange={onGoalChange} />

      {stats.hearts === 0 && (
        <div role="status" className="mb-5 flex items-start gap-3 rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3">
          <HeartIcon className="mt-0.5 h-7 w-7 shrink-0 text-stone-400" />
          <div>
            <p className="font-extrabold text-red-700">{t('hearts.empty.title')}</p>
            <p className="text-sm text-red-800">{t('hearts.empty.body', { min: minutesUntil(stats.nextHeartInMs ?? 0) })}</p>
          </div>
        </div>
      )}

      <div className="mb-6">
        <p className="mb-1 text-sm font-semibold text-stone-600">{t('home.progress', { done: completedCount, total: all.length })}</p>
        <div className="h-3 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full rounded-full bg-amber-400" style={{ width: `${(completedCount / all.length) * 100}%` }} />
        </div>
        {completedCount === all.length && <p className="mt-2 font-semibold text-green-700">{t('home.allDone')}</p>}
      </div>

      <ol className="flex flex-col gap-8">
        {units.map((unit, ui) => {
          const color = UNIT_COLORS[ui % UNIT_COLORS.length];
          return (
            <li key={unit.id}>
              <section aria-labelledby={`${unit.id}-title`}>
                <div className="mb-6 rounded-2xl px-4 py-3 text-white shadow-[0_4px_0_rgba(0,0,0,0.2)]" style={{ backgroundColor: color }}>
                  <p className="text-xs font-bold tracking-wider uppercase opacity-85">{t('home.unit', { n: ui + 1 })}</p>
                  <h2 id={`${unit.id}-title`} className="text-lg font-extrabold">
                    {t(unit.title)}
                  </h2>
                  <p className="text-sm opacity-90">{t(unit.description)}</p>
                </div>
                <ol className="flex flex-col items-center gap-5">
                  {unit.lessons.map((lesson, li) => (
                    <li key={lesson.id} style={{ transform: `translateX(${ZIGZAG[li % ZIGZAG.length]}px)` }}>
                      <LessonNode
                        title={t(lesson.title)}
                        state={states.get(lesson.id) ?? 'locked'}
                        color={color}
                        stateLabel={t(`home.lessonState.${states.get(lesson.id) ?? 'locked'}`)}
                        startLabel={t('home.start')}
                        onClick={() => onStart(lesson.id)}
                      />
                    </li>
                  ))}
                </ol>
              </section>
            </li>
          );
        })}
      </ol>

      <div className="mt-10 flex justify-center">
        <button
          type="button"
          onClick={() => {
            if (window.confirm(t('home.resetConfirm'))) onReset();
          }}
          className="min-h-11 rounded-xl px-4 text-sm font-semibold text-stone-500 underline"
        >
          {t('home.reset')}
        </button>
      </div>
    </div>
  );
}

function LessonNode({
  title,
  state,
  color,
  stateLabel,
  startLabel,
  onClick,
}: {
  title: string;
  state: LessonState;
  color: string;
  stateLabel: string;
  startLabel: string;
  onClick: () => void;
}) {
  const locked = state === 'locked';
  const bg = state === 'completed' ? '#f59e0b' : locked ? '#d6d3d1' : color;
  return (
    <div className="flex w-36 flex-col items-center">
      {state === 'available' && (
        <span className="mb-1 rounded-lg motion-safe:animate-bounce border-2 border-stone-200 bg-white px-2 py-0.5 text-xs font-extrabold tracking-wide uppercase" style={{ color }}>
          {startLabel}
        </span>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={locked}
        aria-label={`${title} (${stateLabel})`}
        className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-white transition-transform active:translate-y-1 disabled:cursor-not-allowed"
        style={{ backgroundColor: bg, boxShadow: locked ? '0 6px 0 #a8a29e' : '0 6px 0 rgba(0,0,0,0.25)' }}
      >
        {state === 'completed' ? (
          <svg viewBox="0 0 24 24" className="h-9 w-9" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : locked ? (
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-stone-500" aria-hidden>
            <rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-9 w-9" aria-hidden>
            <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="currentColor" />
          </svg>
        )}
      </button>
      <span className={`mt-3 text-center text-sm leading-tight font-bold ${locked ? 'text-stone-400' : 'text-stone-700'}`}>{title}</span>
    </div>
  );
}
