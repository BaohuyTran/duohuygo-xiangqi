import { useState } from 'react';
import { DAILY_GOALS, minutesUntil, type DailyGoal, type GamificationSummary } from '../gamification';
import { useI18n } from '../i18n/I18nProvider';

export function FlameIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2.5 1.2-4 2.5-5 .2 2 1 3 2 3.5C11 8.5 11 5 12 2z" fill="currentColor" />
    </svg>
  );
}

export function HeartIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 20.5S3 15 3 8.8A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 9 2.8C21 15 12 20.5 12 20.5z" fill="currentColor" />
    </svg>
  );
}

export interface StatsBarProps {
  summary: GamificationSummary;
  /** When given, the XP item opens a picker to change the daily goal (home screen). */
  onGoalChange?: (goal: DailyGoal) => void;
}

/** Streak, today's XP against the daily goal, and hearts (with the time until the next heart). */
export function StatsBar({ summary: s, onGoalChange }: StatsBarProps) {
  const { t } = useI18n();
  const [picking, setPicking] = useState(false);
  const xpLabel = t('stats.todayXp', { xp: s.todayXp, goal: s.dailyGoal });
  const pct = Math.min(100, (s.todayXp / s.dailyGoal) * 100);

  const xpContent = (
    <>
      <span className="sr-only">{xpLabel}</span>
      <span aria-hidden className="flex w-full flex-col items-center gap-1">
        <span className={`text-sm font-extrabold ${s.goalMet ? 'text-green-700' : 'text-amber-600'}`}>
          {t('stats.xpShort', { xp: s.todayXp, goal: s.dailyGoal })}
        </span>
        <span className="block h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
          <span className={`block h-full rounded-full ${s.goalMet ? 'bg-green-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
        </span>
      </span>
    </>
  );
  const pill = 'flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border-2 border-stone-200 bg-white px-2';

  return (
    <section aria-label={t('stats.label')} className="mb-5">
      <div className="grid grid-cols-3 gap-2">
        <div className={`${pill} ${s.streak > 0 ? 'text-orange-500' : 'text-stone-400'}`}>
          <FlameIcon />
          <span className="sr-only">{t('stats.streak', { n: s.streak })}</span>
          <span aria-hidden className="text-lg font-extrabold">
            {s.streak}
          </span>
        </div>
        {onGoalChange ? (
          <button
            type="button"
            onClick={() => setPicking((p) => !p)}
            aria-expanded={picking}
            aria-controls="daily-goal-picker"
            title={t('dailyGoal.change')}
            className={`${pill} active:translate-y-0.5`}
          >
            {xpContent}
            <span className="sr-only">{t('dailyGoal.change')}</span>
          </button>
        ) : (
          <div className={pill}>{xpContent}</div>
        )}
        <div className={`${pill} ${s.hearts > 0 ? 'text-red-500' : 'text-stone-400'}`}>
          <HeartIcon />
          <span className="sr-only">{t('stats.hearts', { n: s.hearts, max: s.maxHearts })}</span>
          <span aria-hidden className="text-lg font-extrabold">
            {s.hearts}
          </span>
        </div>
      </div>

      {(s.nextHeartInMs !== null || s.goalMet) && (
        <p className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs font-semibold text-stone-500">
          {s.goalMet && <span className="text-green-700">{t('stats.goalMet')}</span>}
          {s.nextHeartInMs !== null && <span className="ml-auto">{t('stats.nextHeart', { min: minutesUntil(s.nextHeartInMs) })}</span>}
        </p>
      )}

      {onGoalChange && picking && (
        <div id="daily-goal-picker" className="mt-2 rounded-xl border-2 border-stone-200 bg-white p-3">
          <p className="mb-2 text-sm font-bold text-stone-700">{t('dailyGoal.title')}</p>
          <div role="group" aria-label={t('dailyGoal.title')} className="grid grid-cols-4 gap-2">
            {DAILY_GOALS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => onGoalChange(g)}
                aria-pressed={s.dailyGoal === g}
                aria-label={t('dailyGoal.optionLabel', { xp: g })}
                className={`min-h-11 rounded-lg text-sm font-bold ${s.dailyGoal === g ? 'bg-stone-800 text-white' : 'border-2 border-stone-200 text-stone-600'}`}
              >
                {t('dailyGoal.option', { xp: g })}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs font-semibold text-stone-500">{t('stats.bestStreak', { n: s.bestStreak })}</p>
        </div>
      )}
    </section>
  );
}
