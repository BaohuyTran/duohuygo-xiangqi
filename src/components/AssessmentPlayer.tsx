import { useMemo, useRef, useState } from 'react';
import type { Exercise, Lesson } from '../content/types';
import { useI18n } from '../i18n/I18nProvider';
import type { MoveJudge } from '../lessons/decision';
import type { LineJudge } from '../lessons/line';
import type { PartnerRegime } from '../assessment/regime';
import type { Analyzer } from '../play/policies';
import type { AttemptRecord } from '../progress/records';
import type { PlayRepository } from '../storage';
import { LessonPlayer } from './LessonPlayer';

/** What the result screen shows (texts are i18n keys with their parameters). */
export interface AssessmentSummary {
  tone: 'pass' | 'fail' | 'neutral';
  title: string;
  lines: { key: string; params?: Record<string, string | number> }[];
}

/** One assessment run: a unit check, a placement test, a level exam or a warm-up (built in src/components/assessmentRuns.ts). */
export interface AssessmentRun {
  /** Stable id of the run (form id). */
  id: string;
  /** Neutral title key (03 §4.2 rule 2): "Unit check", "Placement test", "Level exam", "Warm-up". */
  title: string;
  /** Attempt-record mode of the answers. */
  mode: AttemptRecord['mode'];
  items: Exercise[];
  /** Extra fields for each attempt record before it is logged (strand, unit, form id). */
  annotate?: (record: AttemptRecord) => AttemptRecord;
  /** After each answer: end the run now (early stop when passing has become impossible). */
  shouldStop?: (records: readonly AttemptRecord[]) => boolean;
  /** Called when the learner starts the run from the intro (a placement test counts as the day's attempt from here). */
  onStart?: () => void;
  /** The learner quit during the items (before the end): persists what the rules need (e.g. a failed check). */
  onQuit?: (records: readonly AttemptRecord[]) => void;
  /** Called once when the run ends (every item answered, or stopped): persists the outcome, returns the result screen. */
  finish: (records: readonly AttemptRecord[], stoppedEarly: boolean) => AssessmentSummary;
}

export interface AssessmentPlayerProps {
  run: AssessmentRun;
  /** Every answer (annotated attempt record), as it happens: the app logs it and marks the item exposed. */
  onRecord: (record: AttemptRecord) => void;
  /** Leave (quit, or after the result screen). */
  onExit: () => void;
  now?: () => Date;
  seed?: number;
  judge?: MoveJudge;
  lineJudge?: LineJudge;
  playStore?: PlayRepository;
  regime?: PartnerRegime;
  playAnalyzer?: () => Promise<Analyzer>;
}

/**
 * An assessment (03-assessment.md §4, §6, §7): a neutral intro, then the items in the lesson player's assessment mode
 * (no hints, no hearts or lives, each item answered once, first-answer credit only), then the result screen. Works at
 * 0 hearts and never awards XP (the app gives it no gamification at all, 03 §9).
 */
export function AssessmentPlayer({ run, onRecord, onExit, now, seed, judge, lineJudge, playStore, regime, playAnalyzer }: AssessmentPlayerProps) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<'intro' | 'play' | 'result'>('intro');
  const [summary, setSummary] = useState<AssessmentSummary | null>(null);
  const records = useRef<AttemptRecord[]>([]);
  const ended = useRef(false);
  const lesson: Lesson = useMemo(() => ({ id: `assessment-${run.id}`, title: run.title, exercises: run.items }), [run]);

  const end = (stoppedEarly: boolean) => {
    if (ended.current) return;
    ended.current = true;
    setSummary(run.finish(records.current, stoppedEarly));
    setPhase('result');
  };

  if (phase === 'play') {
    return (
      <LessonPlayer
        key={lesson.id}
        lesson={lesson}
        assessment={run.mode}
        onExit={() => {
          if (!ended.current) {
            ended.current = true;
            run.onQuit?.(records.current);
          }
          onExit();
        }}
        onComplete={() => end(false)}
        onEvent={(event) => {
          if (event.type !== 'attempt') return;
          const record = run.annotate ? run.annotate(event.record) : event.record;
          records.current = [...records.current, record];
          onRecord(record);
          if (records.current.length >= run.items.length) end(false);
          else if (run.shouldStop?.(records.current)) end(true);
        }}
        {...(now ? { now } : {})}
        {...(seed !== undefined ? { seed } : {})}
        {...(judge ? { judge } : {})}
        {...(lineJudge ? { lineJudge } : {})}
        {...(playStore ? { playStore } : {})}
        {...(regime ? { regime } : {})}
        {...(playAnalyzer ? { playAnalyzer } : {})}
      />
    );
  }

  const tone = summary?.tone ?? 'neutral';
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <section className="flex flex-1 flex-col items-center justify-center gap-5 text-center" data-testid={`assessment-${phase}`}>
        <p className="text-sm font-bold tracking-wide text-violet-600 uppercase">{t(run.title)}</p>
        {phase === 'intro' ? (
          <>
            <h2 className="text-2xl font-extrabold text-stone-800">{t(run.title)}</h2>
            <p className="text-lg text-stone-600">{t('assess.intro.body', { n: run.items.length })}</p>
            <button
              type="button"
              onClick={() => {
                run.onStart?.();
                setPhase('play');
              }}
              className="min-h-12 w-full max-w-xs rounded-2xl bg-violet-600 text-lg font-bold text-white shadow-[0_4px_0_#5b21b6] active:translate-y-1 active:shadow-none"
            >
              {t('assess.intro.start')}
            </button>
            <button type="button" onClick={onExit} className="min-h-11 rounded-2xl px-4 font-bold text-stone-500">
              {t('jump.cancel')}
            </button>
          </>
        ) : (
          summary && (
            <>
              <h2 className={`text-3xl font-extrabold ${tone === 'pass' ? 'text-green-700' : 'text-stone-700'}`} data-testid="assessment-title">
                {t(summary.title)}
              </h2>
              <ul className="flex w-full flex-col gap-2 text-left text-base text-stone-700" data-testid="assessment-lines">
                {summary.lines.map((line, i) => (
                  <li key={i} className="rounded-xl bg-white/70 px-4 py-2">
                    {t(line.key, line.params)}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={onExit}
                className="min-h-12 w-full max-w-xs rounded-2xl bg-green-500 text-lg font-bold text-white shadow-[0_4px_0_#15803d] active:translate-y-1 active:shadow-none"
              >
                {t('jump.back')}
              </button>
            </>
          )
        )}
      </section>
    </div>
  );
}
