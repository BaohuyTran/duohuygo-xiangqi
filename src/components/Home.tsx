import type { Track, Unit } from '../content/types';
import type { UnitProgress } from '../assessment/exams';
import { minutesUntil, type DailyGoal, type GamificationSummary } from '../gamification';
import { useI18n } from '../i18n/I18nProvider';
import { useEffect, useRef, useState } from 'react';
import { JUMP_TEST_LIVES, jumpBannerTrack, jumpTest, skippedLessons, type LessonState } from '../lessons/progress';
import type { AccountService } from '../sync/service';
import { AccountButton } from './Account';
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
  /** Scroll this lesson into view when Home appears (the last one studied, or the one just left). */
  focusLessonId?: string | null;
  /** Called once Home has scrolled to `focusLessonId`. */
  onFocused?: () => void;
  /** Start the jump-ahead test that unlocks a locked lesson (and completes the lessons before it). */
  onJump: (lessonId: string) => void;
  onReset: () => void;
  stats: GamificationSummary;
  onGoalChange: (goal: DailyGoal) => void;
  /** Account login + sync; absent when sync is not configured (then no account UI at all). */
  account?: AccountService;
  /**
   * New-course units only (03 §2, MU1): the three progress states shown separately, the unit check and the "more
   * practice" entry. Units without a panel (legacy units) look exactly as before.
   */
  unitPanels?: ReadonlyMap<string, UnitPanel>;
  onCheck?: (unitId: string) => void;
  /** Practise the remediation set of a failed check (unlocks the retake). */
  onRemediate?: (unitId: string) => void;
  onPractice?: (unitId: string) => void;
  /** New-course levels: level mastered / exam passed, and whether the level exam can be taken. */
  levelPanels?: ReadonlyMap<Track, LevelPanel>;
  onExam?: (track: Track) => void;
  /** J1 level placement offered in the "jump to <level>" banner (03 §7.1), when a form can be built. */
  placement?: { track: Track; usedToday: boolean } | null;
  onPlacement?: (track: Track) => void;
  /** How a jump to a locked lesson works; default `legacy` (today's jump test). */
  jumpInfo?: (lessonId: string) => JumpInfo;
  /** A warm-up is offered after a long break (03 §4.5; suggestions only). */
  warmUp?: boolean;
  onWarmUp?: () => void;
  onDismissWarmUp?: () => void;
}

export interface UnitPanel {
  progress: UnitProgress;
  check: 'none' | 'available' | 'remediation' | 'mastered' | 'unavailable' | 'no-check';
  /** The latest check of the unit failed (not mastered): "Not mastered yet" instead of "not assessed yet". */
  checkFailed?: boolean;
  practice: boolean;
}

export interface LevelPanel {
  mastered: boolean;
  applied: boolean;
  exam: boolean;
}

/**
 * `legacy`: today's jump test; `J2`: the unit test-out of 03 §7 (`usedToday`: one attempt per target per day);
 * `master`: no test-out inside Master; `closed`: the level entry gate (PD-35) is shut, reached by J1 or the previous level.
 */
export type JumpInfo = { kind: 'legacy' } | { kind: 'J2'; questions: number; practical: boolean; usedToday: boolean } | { kind: 'master' } | { kind: 'closed' };

export function Home({
  units,
  states,
  onStart,
  onJump,
  onReset,
  stats,
  onGoalChange,
  account,
  focusLessonId,
  onFocused,
  unitPanels,
  onCheck,
  onRemediate,
  onPractice,
  levelPanels,
  onExam,
  placement,
  onPlacement,
  jumpInfo = () => ({ kind: 'legacy' }),
  warmUp,
  onWarmUp,
  onDismissWarmUp,
}: HomeProps) {
  const { t } = useI18n();
  const pathRef = useRef<HTMLOListElement>(null);
  // Bring the focus lesson to the middle of the screen at once (no smooth scroll: Home just appeared).
  useEffect(() => {
    if (!focusLessonId) return;
    const node = pathRef.current?.querySelector(`[data-lesson-id="${focusLessonId}"]`);
    node?.scrollIntoView?.({ block: 'center' });
    onFocused?.();
  }, [focusLessonId, onFocused]);
  // The locked lesson the learner tapped: asks whether to take the jump-ahead test.
  const [jumpTarget, setJumpTarget] = useState<string | null>(null);
  const all = units.flatMap((u) => u.lessons);
  const completedIds = all.filter((l) => states.get(l.id) === 'completed').map((l) => l.id);
  const completedCount = completedIds.length;
  const hasIntermediate = units.some((u) => u.track === 'intermediate');
  // Hidden once the learner has started that level (or a higher one).
  const bannerTrack = jumpBannerTrack(units, completedIds);

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-red-700">{t('app.title')}</h1>
          <p className="text-sm text-stone-500">{t('app.tagline')}</p>
        </div>
        {/* With the account button the controls may wrap onto two rows on narrow phones. */}
        <div className={`flex items-center gap-1 ${account ? 'min-w-0 flex-wrap justify-end' : 'shrink-0'}`}>
          {account && <AccountButton account={account} />}
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

      {warmUp && (
        <div role="status" className="mb-6 rounded-2xl border-2 border-sky-200 bg-sky-50 px-4 py-3 text-sky-900" data-testid="warmup">
          <p className="font-extrabold">{t('warmup.title')}</p>
          <p className="text-sm">{t('warmup.body')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={onWarmUp} className="min-h-11 rounded-xl bg-sky-600 px-4 font-bold text-white">
              {t('warmup.start')}
            </button>
            <button type="button" onClick={onDismissWarmUp} className="min-h-11 rounded-xl px-4 font-bold text-sky-800">
              {t('jump.cancel')}
            </button>
          </div>
        </div>
      )}

      {bannerTrack && placement?.track === bannerTrack && (
        <div className="mb-6 rounded-2xl border-2 border-violet-200 bg-violet-50 px-4 py-3 text-violet-800" data-testid="placement-banner">
          <span className="block font-extrabold">{t(`track.${bannerTrack}.jumpTitle`)}</span>
          <span className="block text-sm">{t('placement.banner.body')}</span>
          {placement.usedToday ? (
            <p className="mt-2 text-sm font-semibold">{t('placement.tomorrow')}</p>
          ) : (
            <button
              type="button"
              onClick={() => onPlacement?.(bannerTrack)}
              className="mt-2 min-h-11 rounded-xl bg-violet-600 px-4 font-bold text-white shadow-[0_3px_0_#5b21b6] active:translate-y-0.5 active:shadow-none"
            >
              {t('placement.start')}
            </button>
          )}
        </div>
      )}

      {bannerTrack && placement?.track !== bannerTrack && (
        <a
          href={`#track-${bannerTrack}`}
          className="mb-6 flex min-h-11 items-center justify-between gap-3 rounded-2xl border-2 border-violet-200 bg-violet-50 px-4 py-3 text-violet-800"
        >
          <span>
            <span className="block font-extrabold">{t(`track.${bannerTrack}.jumpTitle`)}</span>
            <span className="block text-sm">{t(`track.${bannerTrack}.jumpBody`)}</span>
          </span>
          <span aria-hidden className="text-2xl font-extrabold">
            ↓
          </span>
        </a>
      )}

      <ol ref={pathRef} className="flex flex-col gap-8">
        {units.map((unit, ui) => {
          const color = UNIT_COLORS[ui % UNIT_COLORS.length];
          const track = unit.track ?? 'basics';
          const startsTrack = hasIntermediate && (ui === 0 || (units[ui - 1].track ?? 'basics') !== track);
          return (
            <li key={unit.id}>
              {startsTrack && (
                <div id={`track-${track}`} className="mb-5 scroll-mt-4 border-b-2 border-stone-200 pb-2">
                  <h2 className="text-xl font-extrabold text-stone-800">{t(`track.${track}.title`)}</h2>
                  <p className="text-sm text-stone-500">{t(`track.${track}.desc`)}</p>
                  {levelPanels?.get(track) && <LevelStatus panel={levelPanels.get(track)!} onExam={() => onExam?.(track)} />}
                </div>
              )}
              <section aria-labelledby={`${unit.id}-title`}>
                <div className="mb-6 rounded-2xl px-4 py-3 text-white shadow-[0_4px_0_rgba(0,0,0,0.2)]" style={{ backgroundColor: color }}>
                  <p className="text-xs font-bold tracking-wider uppercase opacity-85">{t('home.unit', { n: ui + 1 })}</p>
                  <h2 id={`${unit.id}-title`} className="text-lg font-extrabold">
                    {t(unit.title)}
                  </h2>
                  <p className="text-sm opacity-90">{t(unit.description)}</p>
                  {unitPanels?.get(unit.id) && (
                    <UnitStatus
                      panel={unitPanels.get(unit.id)!}
                      onCheck={() => onCheck?.(unit.id)}
                      onRemediate={() => onRemediate?.(unit.id)}
                      onPractice={() => onPractice?.(unit.id)}
                    />
                  )}
                  {states.get(unit.lessons[0].id) === 'locked' && ['legacy', 'J2'].includes(jumpInfo(unit.lessons[0].id).kind) && (
                    <button
                      type="button"
                      onClick={() => setJumpTarget(unit.lessons[0].id)}
                      className="mt-2 min-h-11 rounded-xl border-2 border-white/70 bg-white/15 px-3 text-sm font-extrabold tracking-wide uppercase"
                    >
                      {t('jump.here')}
                    </button>
                  )}
                </div>
                <ol className="flex flex-col items-center gap-5">
                  {unit.lessons.map((lesson, li) => (
                    <li key={lesson.id} data-lesson-id={lesson.id} style={{ transform: `translateX(${ZIGZAG[li % ZIGZAG.length]}px)` }}>
                      <LessonNode
                        title={t(lesson.title)}
                        state={states.get(lesson.id) ?? 'locked'}
                        color={color}
                        stateLabel={t(`home.lessonState.${states.get(lesson.id) ?? 'locked'}`)}
                        startLabel={t('home.start')}
                        onClick={() => (states.get(lesson.id) === 'locked' ? setJumpTarget(lesson.id) : onStart(lesson.id))}
                      />
                    </li>
                  ))}
                </ol>
              </section>
            </li>
          );
        })}
      </ol>

      {jumpTarget && (
        <JumpDialog
          lessonTitle={t(all.find((l) => l.id === jumpTarget)?.title ?? '')}
          skipped={skippedLessons(units, jumpTarget, completedIds).length}
          questions={jumpTest(units, jumpTarget, completedIds)?.exercises.length ?? 0}
          info={jumpInfo(jumpTarget)}
          onStart={() => {
            onJump(jumpTarget);
            setJumpTarget(null);
          }}
          onCancel={() => setJumpTarget(null)}
        />
      )}

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
        aria-label={`${title} (${stateLabel})`}
        className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-white transition-transform active:translate-y-1"
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

function JumpDialog({
  lessonTitle,
  skipped,
  questions,
  info,
  onStart,
  onCancel,
}: {
  lessonTitle: string;
  skipped: number;
  questions: number;
  info: JumpInfo;
  onStart: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const body =
    info.kind === 'J2'
      ? info.usedToday
        ? t('placement.tomorrow')
        : t(info.practical ? 'placement.dialog.bodyPractical' : 'placement.dialog.body', { skipped, questions: info.questions })
      : info.kind === 'master'
        ? t('placement.master')
        : info.kind === 'closed'
          ? t('placement.closed')
          : t('jump.dialog.body', { skipped, questions, lives: JUMP_TEST_LIVES });
  const canStart = info.kind === 'legacy' || (info.kind === 'J2' && !info.usedToday);
  return (
    <div className="safe-px fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="jump-title"
        onClick={(e) => e.stopPropagation()}
        className="feedback-in w-full max-w-md rounded-t-3xl bg-white px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl"
      >
        <h2 id="jump-title" className="text-xl font-extrabold text-stone-800">
          {t('jump.dialog.title', { lesson: lessonTitle })}
        </h2>
        <p className="mt-2 text-stone-600">{body}</p>
        <div className="mt-5 flex flex-col gap-3">
          {canStart && (
            <button
              type="button"
              onClick={onStart}
              className="min-h-12 rounded-2xl bg-violet-600 text-lg font-bold text-white shadow-[0_4px_0_#5b21b6] active:translate-y-1 active:shadow-none"
            >
              {t('jump.start')}
            </button>
          )}
          <button type="button" onClick={onCancel} className="min-h-11 rounded-2xl font-bold text-stone-500">
            {t('jump.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The three progress states of a new-course unit, shown separately (03 §2), plus its check and "more practice". */
function UnitStatus({ panel, onCheck, onRemediate, onPractice }: { panel: UnitPanel; onCheck: () => void; onRemediate: () => void; onPractice: () => void }) {
  const { t } = useI18n();
  const p = panel.progress;
  const mastery = p.mastered ? t(`unit.status.mastered.${p.mastered.via}`) : t(panel.checkFailed ? 'unit.status.notMastered' : 'unit.status.notAssessed');
  const applied =
    p.applied === 'some' ? t('unit.status.applied.some', { n: p.appliedTasks.length, total: p.tasks.length }) : t(`unit.status.applied.${p.applied}`);
  const button = 'min-h-11 rounded-xl border-2 border-white/70 bg-white/15 px-3 text-sm font-extrabold';
  return (
    <div className="mt-2 text-sm" data-testid={`unit-status-${p.unitId}`}>
      <ul className="flex flex-col gap-0.5 opacity-95">
        <li>{t('unit.status.completed', { done: p.completed, total: p.lessons })}</li>
        <li data-testid={`unit-mastery-${p.unitId}`}>{mastery}</li>
        <li>{applied}</li>
      </ul>
      <div className="mt-2 flex flex-wrap gap-2">
        {panel.check === 'available' && (
          <button type="button" onClick={onCheck} className={button}>
            {t('unit.check.start')}
          </button>
        )}
        {panel.check === 'remediation' && (
          <button type="button" onClick={onRemediate} className={button}>
            {t('unit.check.remediation')}
          </button>
        )}
        {panel.check === 'unavailable' && <p className="text-xs">{t('unit.check.unavailable')}</p>}
        {panel.practice && (
          <button type="button" onClick={onPractice} className={button}>
            {t('unit.morePractice')}
          </button>
        )}
      </div>
    </div>
  );
}

/** Level mastered (every unit) and applied (exam passed), and the level exam entry (03 §2 rule 3, §6). */
function LevelStatus({ panel, onExam }: { panel: LevelPanel; onExam: () => void }) {
  const { t } = useI18n();
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-600">
      <span>{t(panel.mastered ? 'level.mastered' : 'level.notMastered')}</span>
      <span>{t(panel.applied ? 'level.applied' : 'level.notApplied')}</span>
      {panel.exam && !panel.applied && (
        <button type="button" onClick={onExam} className="min-h-11 rounded-xl bg-violet-600 px-3 font-bold text-white">
          {t('level.exam.start')}
        </button>
      )}
    </div>
  );
}
