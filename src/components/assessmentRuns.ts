// Builds the assessment runs the app offers (unit checks, J1/J2 placement, level exams, the warm-up) from the served
// pools and the learner's records, and persists their outcomes through the learning repository. No React: App wires
// these into src/components/AssessmentPlayer.tsx. Never touches gamification (03 §9: no XP, no hearts).

import type { AssessmentItem, AssessmentPool, Lesson, PlayExercise, Track, Unit } from '../content/types';
import { poolsOf } from '../content/pools';
import {
  answerFromRecord,
  assembleCheckForm,
  assembleExam,
  assembleJ1,
  assembleJ2,
  checkGrant,
  checkQuitRecord,
  checkStatus,
  checkSummaryRecord,
  coveredUnits,
  examGrants,
  levelsBelow,
  placementAvailableToday,
  placementCannotPass,
  placementEndRecord,
  placementOutcome,
  placementStartRecord,
  scoreCheck,
  scoreExam,
  scorePlacement,
  warmUpItems,
  warmUpSuggestions,
  weakestPointer,
  type CheckStatus,
  type ExamTaskOutcome,
  type PlacementForm,
  type PracticalOutcome,
  type ScoredAnswer,
} from '../assessment';
import type { PartnerRegime } from '../assessment/regime';
import { levelSkippedLessons, skippedLessons, unitsOfLessons } from '../lessons/progress';
import type { AttemptRecord } from '../progress/records';
import type { LearningRepository } from '../storage';
import type { AssessmentRun, AssessmentSummary } from './AssessmentPlayer';

export interface RunContext {
  /** The path Home shows. */
  units: readonly Unit[];
  /** Servable pools (src/content/pools.ts `servablePools`). */
  pools: readonly AssessmentPool[];
  learning: LearningRepository;
  /** Completed lesson ids as Home shows them (any provenance). */
  completed: () => string[];
  /** Completes a lesson (`placement` for a passed jump-ahead): new-course lessons go to the learning records. */
  markDone: (lesson: Lesson, via: 'lesson' | 'placement') => void;
  now: () => Date;
  seed: number;
  regime: PartnerRegime;
}

const exposedSet = (ctx: RunContext) => new Set(ctx.learning.records().exposed);
const masteredSet = (ctx: RunContext) => new Set(Object.keys(ctx.learning.records().mastered));
const unitOf = (ctx: RunContext, id: string) => ctx.units.find((u) => u.id === id);
const itemsOf = (pools: readonly AssessmentPool[]): AssessmentItem[] => pools.flatMap((p) => p.items);

/** Answers by item id: first-answer credit (and the misconception of a wrong first answer). */
function answersOf(records: readonly AttemptRecord[], mode: AttemptRecord['mode']): Map<string, ScoredAnswer & { misconception?: string }> {
  return new Map(records.map((r) => [r.itemId, { ...answerFromRecord(r, mode), ...(r.misconception ? { misconception: r.misconception } : {}) }]));
}

/** A practical task's run from its attempt record (score, runs, fallback and critical failures are on the record). */
export function practicalOutcomeOf(record: AttemptRecord, task: AssessmentItem): PracticalOutcome {
  const score = typeof record.score === 'number' ? record.score : 0;
  const critical = Array.isArray(record.critical) && record.critical.length > 0;
  const passMark = task.type === 'play' ? ((task as PlayExercise).passMark ?? 75) : 75;
  return {
    score,
    // The credit is 0 after a critical failure or a failed line share gate (03 §3.2).
    pass: record.voided !== true && record.credit > 0 && score >= passMark - 1e-9,
    criticalFailure: critical || (record.voided !== true && record.credit === 0),
    voided: record.voided === true,
    runs: typeof record.runs === 'number' ? record.runs : 1,
    voidedRuns: typeof record.voidedRuns === 'number' ? record.voidedRuns : 0,
    fallback: (record.fallback as PracticalOutcome['fallback']) ?? null,
  };
}

const annotate = (items: readonly AssessmentItem[], formId: string) => (record: AttemptRecord): AttemptRecord => {
  const item = items.find((i) => i.id === record.itemId);
  return item ? { ...record, strand: item.strand, unit: item.unit, objective: item.objective, formId } : { ...record, formId };
};

// ---------- Unit checks ----------

export type CheckOffer = { kind: 'none' } | CheckStatus | { kind: 'unavailable' };

/** What Home offers for a unit's check: nothing (no pool), available, remediation first, mastered, or unavailable. */
export function checkOffer(ctx: RunContext, unit: Unit, attempts: readonly AttemptRecord[]): CheckOffer {
  const pool = poolsOf(ctx.pools, 'check', { unit: unit.id })[0];
  if (!pool) return { kind: 'none' };
  const status = checkStatus(unit, { mastered: masteredSet(ctx).has(unit.id), attempts, units: ctx.units });
  if (status.kind !== 'available') return status;
  return checkRun(ctx, unit.id) ? status : { kind: 'unavailable' };
}

export function checkRun(ctx: RunContext, unitId: string): AssessmentRun | null {
  const unit = unitOf(ctx, unitId);
  const pool = poolsOf(ctx.pools, 'check', { unit: unitId })[0];
  if (!unit || !pool) return null;
  const index = ctx.units.indexOf(unit);
  const earlierUnits = new Set(ctx.units.slice(0, index).map((u) => u.id));
  const earlier = itemsOf(poolsOf(ctx.pools, 'check').filter((p) => p.unit && earlierUnits.has(p.unit)));
  const built = assembleCheckForm({
    unit: unitId,
    objectives: unit.lessons.map((l) => l.id),
    primaryStrand: pool.primaryStrand,
    poolId: pool.id,
    assessmentVersion: pool.version,
    own: pool.items,
    earlier,
    exposed: exposedSet(ctx),
    seed: ctx.seed,
  });
  if (!built.ok) return null;
  const { form } = built;
  return {
    id: form.formId,
    title: 'assess.check.title',
    mode: 'check',
    items: form.items,
    annotate: annotate(form.items, form.formId),
    onQuit(records) {
      // A quit after a non-voided wrong answer counts as failed for the retake rule (remediation first).
      const quit = checkQuitRecord(form, answersOf(records, 'check'), ctx.now().toISOString());
      if (quit) ctx.learning.logAttempt(quit);
    },
    finish(records) {
      const at = ctx.now().toISOString();
      const result = scoreCheck(form, answersOf(records, 'check'));
      const grant = checkGrant(form, result, at);
      if (grant) ctx.learning.grantMastery(unitId, grant);
      ctx.learning.logAttempt(checkSummaryRecord(form, result, at));
      const lines: AssessmentSummary['lines'] = [{ key: 'assess.result.score', params: { score: result.shown } }];
      if (result.incomplete) return { tone: 'neutral', title: 'assess.result.incompleteTitle', lines: [{ key: 'assess.result.incomplete' }] };
      if (result.mastered) return { tone: 'pass', title: 'assess.result.mastered', lines };
      lines.push({ key: 'assess.result.need' });
      if (result.criticalMissed.length > 0) lines.push({ key: 'assess.result.criticalMissed' });
      const lessons = [...new Set(result.failed.map((f) => f.objective))];
      const titles = ctx.units.flatMap((u) => u.lessons).filter((l) => lessons.includes(l.id));
      if (titles.length > 0) lines.push({ key: 'assess.result.revisit' }, ...titles.map((l) => ({ key: l.title })));
      lines.push({ key: 'assess.result.remediation' });
      return { tone: 'fail', title: 'assess.result.notMastered', lines };
    },
  };
}

/** The remediation practice of a failed check (03 §4.4): the cards and items of the set, as a practice lesson. */
export function remediationLesson(unitId: string, status: CheckStatus): Lesson | null {
  if (status.kind !== 'remediation') return null;
  const exercises = [...status.set.cards, ...status.set.items];
  return exercises.length > 0 ? { id: `remediation-${unitId}`, title: 'assess.remediation.title', exercises } : null;
}

/** "More practice" (05 MU1): the unit's extra-practice pool as a practice lesson. */
export function morePracticeLesson(unit: Unit): Lesson | null {
  return unit.pool && unit.pool.length > 0 ? { id: `${unit.id}-pool`, title: 'unit.morePractice', exercises: unit.pool } : null;
}

// ---------- Jump-ahead (J1 / J2) ----------

export type PlacementTarget = { kind: 'J1'; target: Track } | { kind: 'J2'; target: string };

interface BuiltPlacement {
  form: PlacementForm;
  skipped: Lesson[];
}

function buildPlacement(ctx: RunContext, t: PlacementTarget): BuiltPlacement | null {
  const completed = ctx.completed();
  const exposed = exposedSet(ctx);
  const mastered = masteredSet(ctx);
  if (t.kind === 'J1') {
    const skipped = levelSkippedLessons(ctx.units, t.target, completed);
    const below = levelsBelow(t.target);
    if (skipped.length === 0 || below.length === 0) return null;
    const placement: Partial<Record<Track, AssessmentItem[]>> = {};
    for (const level of below) placement[level] = itemsOf(poolsOf(ctx.pools, 'placement', { level }));
    const built = assembleJ1({
      target: t.target,
      placement,
      practical: itemsOf(poolsOf(ctx.pools, 'placement-practical', { level: below[below.length - 1] })),
      skippedUnits: unitsOfLessons(ctx.units, skipped).map((u) => u.id),
      mastered,
      exposed,
      seed: ctx.seed,
    });
    return built.ok ? { form: built.form, skipped } : null;
  }
  const skipped = skippedLessons(ctx.units, t.target, completed);
  const unit = ctx.units.find((u) => u.lessons.some((l) => l.id === t.target));
  if (!unit || skipped.length === 0) return null;
  const level = unit.track ?? 'basics';
  const built = assembleJ2({
    target: t.target,
    level,
    skippedUnits: unitsOfLessons(ctx.units, skipped).map((u) => u.id),
    placement: itemsOf(poolsOf(ctx.pools, 'placement', { level })),
    practical: itemsOf(poolsOf(ctx.pools, 'placement-practical', { level })),
    mastered,
    exposed,
    seed: ctx.seed,
  });
  return built.ok ? { form: built.form, skipped } : null;
}

export interface PlacementOffer {
  /** A form can be built from the served pools. */
  available: boolean;
  /** Already attempted today (one attempt per target per local day). */
  usedToday: boolean;
  questions: number;
  practical: boolean;
}

export function placementOffer(ctx: RunContext, t: PlacementTarget, attempts: readonly AttemptRecord[]): PlacementOffer {
  const built = buildPlacement(ctx, t);
  if (!built) return { available: false, usedToday: false, questions: 0, practical: false };
  return {
    available: true,
    usedToday: !placementAvailableToday(t.kind, t.target, attempts, ctx.now()),
    questions: built.form.items.length + (built.form.practical ? 1 : 0),
    practical: built.form.practical !== null,
  };
}

export function placementRun(ctx: RunContext, t: PlacementTarget): (AssessmentRun & { onStart: () => void }) | null {
  const built = buildPlacement(ctx, t);
  if (!built) return null;
  const { form, skipped } = built;
  const items = form.practical ? [...form.items, form.practical] : [...form.items];
  const practicalOf = (records: readonly AttemptRecord[]): PracticalOutcome | null => {
    const r = form.practical ? records.find((x) => x.itemId === form.practical!.id) : undefined;
    return r && form.practical ? practicalOutcomeOf(r, form.practical) : null;
  };
  const answers = (records: readonly AttemptRecord[]) => answersOf(records.filter((r) => r.itemId !== form.practical?.id), 'placement');
  const levelUnits = (ids: readonly string[]) => ctx.units.filter((u) => ids.includes(u.id));
  return {
    id: form.formId,
    title: 'assess.placement.title',
    mode: 'placement',
    items,
    annotate: annotate(items, form.formId),
    onStart: () => ctx.learning.logAttempt(placementStartRecord(form, ctx.now().toISOString())),
    shouldStop: (records) => placementCannotPass(form, answers(records), practicalOf(records)),
    finish(records, stoppedEarly) {
      const at = ctx.now().toISOString();
      const a = answers(records);
      const practical = practicalOf(records);
      const result = scorePlacement(form, a, practical);
      ctx.learning.logAttempt(placementEndRecord(form, result, at, stoppedEarly));
      if (result.couldNotAssess) return { tone: 'neutral', title: 'assess.placement.couldNotAssessTitle', lines: [{ key: 'assess.placement.couldNotAssess' }] };
      const lines: AssessmentSummary['lines'] = [{ key: 'assess.placement.total', params: { total: result.shown } }];
      for (const s of result.strands) lines.push({ key: `assess.placement.${s.ok ? 'strand' : 'strandLow'}.${s.strand}`, params: { percent: Math.floor(s.share * 100 + 1e-9) } });
      if (result.criticalMissed.length > 0) lines.push({ key: 'assess.result.criticalMissed' });
      if (practical && !practical.voided) lines.push({ key: result.practicalOk ? 'assess.placement.practicalOk' : 'assess.placement.practicalLow', params: { score: Math.floor(practical.score) } });
      const outcome = placementOutcome(form, result, a, practical, skipped.map((l) => ({ lessonId: l.id, unit: '', contentVersion: Math.max(1, ...l.exercises.map((e) => e.version ?? 1)) })), at);
      if (!outcome) {
        if (stoppedEarly) lines.unshift({ key: 'assess.placement.stoppedEarly' });
        const weak = weakestPointer(form, result);
        const unit = weak ? unitOf(ctx, weak.unit) : undefined;
        if (unit) lines.push({ key: 'assess.placement.weakest' }, { key: unit.title });
        lines.push({ key: 'assess.placement.tomorrow' });
        return { tone: 'fail', title: 'assess.placement.failed', lines };
      }
      // Pass: completed (placement) for every skipped lesson; covered units mastered; the practical task's "applied".
      for (const lesson of skipped) ctx.markDone(lesson, 'placement');
      for (const m of outcome.mastered) ctx.learning.grantMastery(m.unitId, m.grant);
      for (const ap of outcome.applied) ctx.learning.grantApplication(ap.taskId, ap.grant);
      const covered = levelUnits(coveredUnits(form, a));
      const notCovered = levelUnits(outcome.notCovered);
      if (covered.length > 0) lines.push({ key: 'assess.placement.covered' }, ...covered.map((u) => ({ key: u.title })));
      if (notCovered.length > 0) lines.push({ key: 'assess.placement.notCovered' }, ...notCovered.map((u) => ({ key: u.title })));
      return { tone: 'pass', title: 'assess.placement.passed', lines };
    },
  };
}

// ---------- Level exams ----------

export function examRun(ctx: RunContext, level: Track): AssessmentRun | null {
  const pool = poolsOf(ctx.pools, 'exam', { level })[0];
  if (!pool) return null;
  const form = assembleExam(level, ctx.regime, pool.items, { exposed: exposedSet(ctx), seed: ctx.seed, assessmentVersion: pool.version });
  if (!form) return null;
  const items = form.tasks.map((t) => t.item);
  return {
    id: form.formId,
    title: 'assess.exam.title',
    mode: 'exam',
    items,
    annotate: annotate(items, form.formId),
    finish(records) {
      const at = ctx.now().toISOString();
      const outcomes = new Map<string, ExamTaskOutcome>();
      for (const r of records) {
        const item = items.find((i) => i.id === r.itemId);
        if (!item) continue;
        if (item.type === 'review') outcomes.set(r.itemId, { score: typeof r.score === 'number' ? r.score : 0, pass: true, voided: r.voided === true });
        else {
          const p = practicalOutcomeOf(r, item);
          outcomes.set(r.itemId, { score: p.score, pass: p.pass, voided: p.voided, fallback: p.fallback });
        }
      }
      const result = scoreExam(form, outcomes);
      if (result.couldNotAssess) return { tone: 'neutral', title: 'assess.placement.couldNotAssessTitle', lines: [{ key: 'assess.placement.couldNotAssess' }] };
      const grants = examGrants(form, result, at);
      if (!grants) return { tone: 'fail', title: 'assess.exam.failed', lines: [{ key: 'assess.exam.failedBody', params: { n: result.failedTasks.length } }] };
      ctx.learning.grantApplication(grants.applied.taskId, grants.applied.grant);
      if (grants.mastered) ctx.learning.grantMastery(grants.mastered.unitId, grants.mastered.grant);
      return { tone: 'pass', title: 'assess.exam.passed', lines: [{ key: 'assess.exam.passedBody' }] };
    },
  };
}

// ---------- Warm-up after a long break (UA1 default: suggestions only) ----------

export function warmUpRun(ctx: RunContext, attempts: readonly AttemptRecord[]): AssessmentRun | null {
  const records = ctx.learning.records();
  const items = warmUpItems(ctx.now(), {
    attempts,
    mastered: new Set(Object.keys(records.mastered)),
    checkItems: itemsOf(poolsOf(ctx.pools, 'check')),
    exposed: new Set(records.exposed),
    seed: ctx.seed,
  });
  if (!items) return null;
  return {
    id: `warmup-${ctx.now().toISOString()}`,
    title: 'assess.warmup.title',
    mode: 'practice',
    items,
    annotate: (r) => ({ ...annotate(items, 'warmup')(r), warmUp: true }),
    finish(done) {
      // Results only drive suggestions: no state changes and no badge (UA1 default).
      const suggestions = warmUpSuggestions(items, answersOf(done, 'practice'));
      const lessons = ctx.units.flatMap((u) => u.lessons).filter((l) => suggestions.includes(l.id));
      if (lessons.length === 0) return { tone: 'pass', title: 'assess.warmup.done', lines: [{ key: 'assess.warmup.allGood' }] };
      return { tone: 'neutral', title: 'assess.warmup.done', lines: [{ key: 'assess.warmup.suggest' }, ...lessons.map((l) => ({ key: l.title }))] };
    },
  };
}
