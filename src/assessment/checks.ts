// Unit checks: independent mastery (design/03-assessment.md §4). Pure: no React, DOM, storage or gamification; the
// clock and the seed are inputs.
//
// - Form (§4.1): 8 items (short form 6 for b01, b10, e09, m07; m09 has no check, its mastery is `xm`); every lesson
//   objective at least once; from b03 on exactly 2 items from earlier units (preferably sharing a strand), the rest
//   from this unit; from b02 on ≥ 1/3 as Black (i08 Red only, i09 Black only); units with primary PA, OD or DE ≥ 1/4
//   quiet; from b08 on ≥ 1 `critical` item.
// - Exposure (§4.3): items seen in a check are avoided; if no unexposed form exists, at most half the form may be
//   exposed; otherwise the check is unavailable until new items exist (reason `cannot-build`).
// - Mastery (§4.1): score ≥ 80/100 (exact) AND every critical item correct. Voided answers are removed from the score;
//   a voided critical item, or voids that break the §4.1 coverage (an objective with no scorable item, fewer than 6
//   scorable own-unit items — 4 in the short form), make the check `incomplete`: no grant, no failure, retake at once.
//   A check quit after a non-voided wrong answer counts as failed for the retake rule (`checkQuitRecord`).
// - Retake (§4.3) after a failed check once the remediation set (§4.4) is done; the check's summary is an entry of the
//   local attempt log (`form: true`), so the retake rule is local (a capped log forgets very old failures).
// - Warm-up (§4.5, UA1 default): after 30 days without activity, unexposed check items of mastered units; the results
//   only drive suggestions (lessons to revisit), never a badge or a state change.

import type { AssessmentItem, Exercise, Strand, Unit } from '../content/types';
import type { AttemptRecord, MasteryGrant } from '../progress/records';
import { isCorrect, type ScoredAnswer } from './credit';
import { pickForm, seededShuffle, spreadBy, textSeed, type Cap, type Need } from './form';

export const CHECK_LENGTH = 8;
export const SHORT_CHECK_LENGTH = 6;
/** Units with the 6-item short form (03 §4.1). */
export const SHORT_FORM_UNITS: readonly string[] = ['b01', 'b10', 'e09', 'm07'];
/** Units whose mastery comes from the level exam instead (03 §2: m09 via `xm`). */
export const EXAM_MASTERED_UNITS: readonly string[] = ['m09'];
/** Mastery: score ≥ 80/100 and every critical item correct (03 §4.1). */
export const MASTERY_SCORE = 80;
/** Items from earlier units from b03 on (03 §4.1). */
export const INTERLEAVED_ITEMS = 2;
/** Primary strands whose checks need ≥ 1/4 quiet items. */
export const QUIET_STRANDS: readonly Strand[] = ['PA', 'OD', 'DE'];
/** Inactivity before the warm-up is offered (03 §4.5). */
export const WARM_UP_AFTER_DAYS = 30;
export const WARM_UP_ITEMS = 5;

/** Check length of a unit, or null when the unit has no check (m09). */
export function checkLength(unitId: string): number | null {
  if (EXAM_MASTERED_UNITS.includes(unitId)) return null;
  return SHORT_FORM_UNITS.includes(unitId) ? SHORT_CHECK_LENGTH : CHECK_LENGTH;
}

/** True when `unitId` is `from` (a Basic unit like `b03`) or later: a later Basic number, or any higher level. */
export function isFromUnit(unitId: string, from: string): boolean {
  if (unitId[0] !== 'b') return /^[iaem]\d\d$/.test(unitId);
  return Number(unitId.slice(1)) >= Number(from.slice(1));
}

export interface CheckFormInput {
  unit: string;
  /** The unit's lesson ids (lesson objectives). */
  objectives: readonly string[];
  primaryStrand?: Strand;
  /** Pool id (`b09-check`) and its version (recorded on the grant). */
  poolId: string;
  assessmentVersion: number;
  /** Servable items of this unit's check pool. */
  own: readonly AssessmentItem[];
  /** Servable check items of earlier units (interleaving candidates). */
  earlier: readonly AssessmentItem[];
  /** Items the learner has seen in a check, placement or exam. */
  exposed: ReadonlySet<string>;
  seed: number;
}

export interface CheckForm {
  kind: 'check';
  unit: string;
  formId: string;
  poolId: string;
  assessmentVersion: number;
  items: AssessmentItem[];
  /** Exposed items in the form (0 unless no unexposed form existed; at most half). */
  exposedCount: number;
}

export type CheckFormResult = { ok: true; form: CheckForm } | { ok: false; reason: 'no-check' | 'cannot-build' };

const isBlack = (i: AssessmentItem) => i.side === 'black';
const isRed = (i: AssessmentItem) => (i.side ?? 'red') === 'red';

/** The 03 §4.1 constraints of a unit's check form (own/interleaved split, objectives, colour, quiet, critical). */
export function checkConstraints(input: Pick<CheckFormInput, 'unit' | 'objectives' | 'primaryStrand'>, length: number): { needs: Need<AssessmentItem>[]; caps: Cap<AssessmentItem>[] } {
  const { unit } = input;
  const own = (i: AssessmentItem) => i.unit === unit;
  const interleaved = isFromUnit(unit, 'b03') ? INTERLEAVED_ITEMS : 0;
  const needs: Need<AssessmentItem>[] = [{ label: 'own-unit', min: length - interleaved, test: own }];
  const caps: Cap<AssessmentItem>[] = [{ label: 'own-unit', max: length - interleaved, test: own }];
  if (interleaved > 0) needs.push({ label: 'interleaved', min: interleaved, test: (i) => !own(i) });
  for (const lesson of input.objectives) needs.push({ label: `objective:${lesson}`, min: 1, test: (i) => own(i) && i.objective === lesson });
  if (unit === 'i08') caps.push({ label: 'red-only', max: 0, test: isBlack });
  else if (unit === 'i09') caps.push({ label: 'black-only', max: 0, test: isRed });
  else if (isFromUnit(unit, 'b02')) needs.push({ label: 'black', min: Math.ceil(length / 3), test: isBlack });
  if (input.primaryStrand && QUIET_STRANDS.includes(input.primaryStrand)) needs.push({ label: 'quiet', min: Math.ceil(length / 4), test: (i) => i.nature === 'quiet' });
  if (isFromUnit(unit, 'b08')) needs.push({ label: 'critical', min: 1, test: (i) => i.critical === true });
  return { needs, caps };
}

/**
 * A seeded check form honouring 03 §4.1 and §4.3: unexposed items first (a seeded shuffle), interleaved items sharing
 * a strand with this unit's items first; an exposed-free form if one exists, else one with at most half exposed.
 */
export function assembleCheckForm(input: CheckFormInput): CheckFormResult {
  const length = checkLength(input.unit);
  if (length === null) return { ok: false, reason: 'no-check' };
  const seed = textSeed(input.seed, input.poolId);
  const own = input.own.filter((i) => i.unit === input.unit);
  const strands = new Set(own.map((i) => i.strand));
  const earlier = input.earlier.filter((i) => i.unit !== input.unit);
  const order = (list: readonly AssessmentItem[], s: number) => {
    const shuffled = seededShuffle(list, s);
    return [...shuffled.filter((i) => !input.exposed.has(i.id!)), ...shuffled.filter((i) => input.exposed.has(i.id!))];
  };
  const earlierOrdered = order(earlier, seed + 1);
  const candidates = [
    ...order(own, seed),
    ...earlierOrdered.filter((i) => strands.has(i.strand)),
    ...earlierOrdered.filter((i) => !strands.has(i.strand)),
  ];
  const { needs, caps } = checkConstraints(input, length);
  for (const maxExposed of [0, Math.floor(length / 2)]) {
    const items = pickForm(candidates, { size: length, needs, caps: [...caps, { label: 'exposed', max: maxExposed, test: (i) => input.exposed.has(i.id!) }] });
    if (items) {
      return {
        ok: true,
        form: {
          kind: 'check',
          unit: input.unit,
          formId: `${input.poolId}#${seed.toString(36)}`,
          poolId: input.poolId,
          assessmentVersion: input.assessmentVersion,
          items,
          exposedCount: items.filter((i) => input.exposed.has(i.id!)).length,
        },
      };
    }
  }
  return { ok: false, reason: 'cannot-build' };
}

// ---------- Scoring ----------

export interface FailedItem {
  itemId: string;
  /** Lesson objective of the item (remediation). */
  objective: string;
  unit: string;
  /** Misconception tag of the wrong answer. */
  misconception?: string;
}

export interface CheckResult {
  /** Exact score 0–100 over the scorable (non-voided) items. */
  score: number;
  /** Shown score, rounded down (a check at 79.9 never shows 80). */
  shown: number;
  mastered: boolean;
  /** No scorable item, an unanswered item, or a voided critical item: no grant, no failure. */
  incomplete: boolean;
  criticalMissed: string[];
  failed: FailedItem[];
  /** Per strand: percent of the strand's points (scorable items only). */
  strandScores: Partial<Record<Strand, number>>;
}

/** Scores a finished check (first-answer credit only; voided answers removed from numerator and denominator). */
export function scoreCheck(form: Pick<CheckForm, 'items'> & { unit?: string }, answers: ReadonlyMap<string, ScoredAnswer & { misconception?: string }>): CheckResult {
  let earned = 0;
  let count = 0;
  let incomplete = false;
  const criticalMissed: string[] = [];
  const failed: FailedItem[] = [];
  const strand = new Map<Strand, { earned: number; count: number }>();
  for (const item of form.items) {
    const a = answers.get(item.id!);
    if (!a) {
      incomplete = true;
      continue;
    }
    if (a.voided) {
      if (item.critical) incomplete = true;
      continue;
    }
    earned += a.credit;
    count++;
    if (item.strand) {
      const s = strand.get(item.strand) ?? { earned: 0, count: 0 };
      strand.set(item.strand, { earned: s.earned + a.credit, count: s.count + 1 });
    }
    if (!isCorrect(a)) {
      failed.push({ itemId: item.id!, objective: item.objective, unit: item.unit, ...(a.misconception ? { misconception: a.misconception } : {}) });
      if (item.critical) criticalMissed.push(item.id!);
    }
  }
  if (count === 0) incomplete = true;
  // 03 §4.1 coverage must still hold on the scorable answers: every objective of the form at least once and the unit's
  // own items (≥ 6; short form ≥ 4). Otherwise the voids leave too little evidence: incomplete, no grant, no failure.
  const unit = form.unit ?? form.items[0]?.unit;
  const own = form.items.filter((i) => i.unit === unit);
  const scorableOwn = own.filter((i) => answers.has(i.id!) && !answers.get(i.id!)!.voided);
  const length = unit ? checkLength(unit) : null;
  const ownNeeded = Math.min(own.length, (length ?? own.length) - (unit && isFromUnit(unit, 'b03') ? INTERLEAVED_ITEMS : 0));
  if (scorableOwn.length < ownNeeded) incomplete = true;
  for (const objective of new Set(own.map((i) => i.objective))) if (!scorableOwn.some((i) => i.objective === objective)) incomplete = true;
  const score = count > 0 ? (100 * earned) / count : 0;
  // Exact comparison: 100·earned ≥ 80·count (no rounding before the comparison).
  const mastered = !incomplete && criticalMissed.length === 0 && 100 * earned >= MASTERY_SCORE * count - 1e-9;
  const strandScores: Partial<Record<Strand, number>> = {};
  for (const [s, v] of strand) strandScores[s] = Math.floor((1000 * v.earned) / v.count + 1e-9) / 10;
  return { score, shown: Math.floor(score + 1e-9), mastered, incomplete, criticalMissed, failed, strandScores };
}

/** The mastery grant of a passed check (03 §2 rule 5: provenance, date, score, version), else null. */
export function checkGrant(form: CheckForm, result: CheckResult, at: string): MasteryGrant | null {
  if (!result.mastered) return null;
  return {
    at,
    via: 'check',
    score: Math.floor(result.score * 10 + 1e-9) / 10,
    ...(Object.keys(result.strandScores).length ? { strandScores: result.strandScores } : {}),
    formId: form.formId,
    assessmentVersion: form.assessmentVersion,
  };
}

// ---------- The check's summary in the local attempt log (retake rule) ----------

/** Log id of a unit check's summary entries. */
export const checkLogId = (unit: string): string => `${unit}-check`;

/** The summary entry written to the attempt log when a check ends (not when it is quit). */
export function checkSummaryRecord(form: CheckForm, result: CheckResult, at: string): AttemptRecord {
  return {
    itemId: checkLogId(form.unit),
    itemVersion: form.assessmentVersion,
    mode: 'check',
    at,
    credit: Math.max(0, Math.min(1, result.score / 100)),
    form: true,
    formId: form.formId,
    outcome: result.incomplete ? 'incomplete' : result.mastered ? 'mastered' : 'failed',
    items: form.items.map((i) => i.id!),
    failed: result.failed,
  };
}

/**
 * The summary entry of a check QUIT before its end: after at least one non-voided wrong answer it counts as failed for
 * the retake rule (remediation first), so quitting never turns a coming failure into a free retake. With only correct
 * or voided answers (or none) the quit is neutral: null, nothing logged.
 */
export function checkQuitRecord(form: CheckForm, answers: ReadonlyMap<string, ScoredAnswer & { misconception?: string }>, at: string): AttemptRecord | null {
  const failed: FailedItem[] = [];
  for (const item of form.items) {
    const a = answers.get(item.id!);
    if (!a || a.voided || isCorrect(a)) continue;
    failed.push({ itemId: item.id!, objective: item.objective, unit: item.unit, ...(a.misconception ? { misconception: a.misconception } : {}) });
  }
  if (failed.length === 0) return null;
  return { itemId: checkLogId(form.unit), itemVersion: form.assessmentVersion, mode: 'check', at, credit: 0, form: true, formId: form.formId, outcome: 'failed', quit: true, items: form.items.map((i) => i.id!), failed };
}

/** The outcome of the latest check of a unit in the log (`failed`, `mastered`, `incomplete`), or null. */
export function lastCheckOutcome(unitId: string, attempts: readonly AttemptRecord[]): string | null {
  const last = [...attempts].reverse().find((r) => r.form === true && r.itemId === checkLogId(unitId));
  return last && typeof last.outcome === 'string' ? last.outcome : null;
}

/** Summary entries are not item answers: coverage, remediation and portfolio code skip them. */
export const isSummaryRecord = (r: AttemptRecord): boolean => r.form === true;

export type CheckStatus =
  | { kind: 'no-check' }
  | { kind: 'available' }
  | { kind: 'mastered' }
  /** Failed: the remediation set must be practised before the retake (03 §4.4). */
  | { kind: 'remediation'; set: RemediationSet; failedAt: string };

export interface RemediationSet {
  /** Lessons to revisit, in course order. */
  lessons: string[];
  /** G1/G0 practice items of those lessons not yet answered correctly first time. */
  items: Exercise[];
  /** `learn` cards tied to the misconceptions of the wrong answers. */
  cards: Exercise[];
}

/**
 * 03 §4.4: per failed objective, that lesson's G1/G0 practice items not yet answered correctly first time (no hint
 * before the first answer), plus the `learn` cards whose misconceptions include a wrong answer's tag.
 */
export function remediationSet(failed: readonly FailedItem[], units: readonly Unit[], attempts: readonly AttemptRecord[]): RemediationSet {
  const objectives = new Set(failed.map((f) => f.objective));
  const tags = new Set(failed.map((f) => f.misconception).filter((m): m is string => !!m));
  const solved = new Set(
    attempts.filter((r) => r.mode === 'practice' && r.voided !== true && r.credit >= 1 && r.hintBeforeFirstAnswer !== true).map((r) => r.itemId),
  );
  const lessons: string[] = [];
  const items: Exercise[] = [];
  const cards: Exercise[] = [];
  for (const unit of units) {
    for (const lesson of unit.lessons) {
      if (objectives.has(lesson.id)) {
        lessons.push(lesson.id);
        for (const ex of lesson.exercises) {
          if (ex.type !== 'learn' && ex.id && (ex.assist === 'G1' || ex.assist === 'G0') && !solved.has(ex.id)) items.push(ex);
        }
      }
      for (const ex of lesson.exercises) {
        if (ex.type === 'learn' && (ex.misconceptions ?? []).some((m) => tags.has(m)) && !cards.includes(ex)) cards.push(ex);
      }
    }
  }
  return { lessons, items, cards };
}

/**
 * Where a unit's check stands: mastered (grant), available, or waiting for remediation after a failure. The
 * remediation is done once every item of the set has a practice record after the failure (learn cards have none);
 * an empty set unlocks the retake at once. An `incomplete` check never blocks a retake.
 */
export function checkStatus(
  unit: Unit,
  ctx: { mastered: boolean; attempts: readonly AttemptRecord[]; units: readonly Unit[] },
): CheckStatus {
  if (checkLength(unit.id) === null) return { kind: 'no-check' };
  if (ctx.mastered) return { kind: 'mastered' };
  const last = [...ctx.attempts].reverse().find((r) => isSummaryRecord(r) && r.itemId === checkLogId(unit.id));
  if (!last || last.outcome !== 'failed') return { kind: 'available' };
  const failed = Array.isArray(last.failed) ? (last.failed as FailedItem[]) : [];
  const before = ctx.attempts.filter((r) => Date.parse(r.at) <= Date.parse(last.at));
  const set = remediationSet(failed, ctx.units, before);
  const practisedAfter = new Set(ctx.attempts.filter((r) => r.mode === 'practice' && r.voided !== true && Date.parse(r.at) >= Date.parse(last.at)).map((r) => r.itemId));
  if (set.items.every((ex) => practisedAfter.has(ex.id!))) return { kind: 'available' };
  return { kind: 'remediation', set, failedAt: last.at };
}

// ---------- Warm-up after a long break (03 §4.5, UA1 default: suggestions only) ----------

/** The newest `at` in the log (any mode), or null. */
export function lastActivity(attempts: readonly AttemptRecord[]): number | null {
  let last: number | null = null;
  for (const r of attempts) {
    const t = Date.parse(r.at);
    if (Number.isFinite(t) && (last === null || t > last)) last = t;
  }
  return last;
}

/**
 * Warm-up items when the learner has been away ≥ 30 days and has mastered units with unexposed check items: up to 5,
 * one per mastered unit before any second, seeded. Null when no warm-up applies (new learner, recent activity, no
 * mastered unit, no unexposed item).
 */
export function warmUpItems(
  now: Date,
  ctx: { attempts: readonly AttemptRecord[]; mastered: ReadonlySet<string>; checkItems: readonly AssessmentItem[]; exposed: ReadonlySet<string>; seed: number },
): AssessmentItem[] | null {
  const last = lastActivity(ctx.attempts);
  if (last === null || now.getTime() - last < WARM_UP_AFTER_DAYS * 86_400_000) return null;
  const fresh = ctx.checkItems.filter((i) => ctx.mastered.has(i.unit) && i.id && !ctx.exposed.has(i.id));
  if (fresh.length === 0) return null;
  return spreadBy(seededShuffle(fresh, ctx.seed), (i) => i.unit).slice(0, WARM_UP_ITEMS);
}

/** Lessons to suggest after a warm-up: the objectives of the items not answered correctly (no state changes). */
export function warmUpSuggestions(items: readonly AssessmentItem[], answers: ReadonlyMap<string, ScoredAnswer>): string[] {
  return [...new Set(items.filter((i) => answers.has(i.id!) && !isCorrect(answers.get(i.id!)) && !answers.get(i.id!)!.voided).map((i) => i.objective))];
}
