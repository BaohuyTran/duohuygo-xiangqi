// Jump-ahead J1 (level placement) and J2 (unit test-out), design/03-assessment.md §7. Pure: no React, DOM, storage or
// gamification; clock and seed are inputs.
//
// - J1 (§7.2): 20 items × 4 points + one placement practical task worth 20 (task score ÷ 5). Exactly 4 items per
//   strand RS, TC, OD, PA, DE; TC/OD/PA/DE at least 2 of 4 from the highest skipped level; RS only from the Basic
//   placement pool (`full-board` RS items for targets above Intermediate), at least 2 RS items critical; ≥ 1/3 Black,
//   ≥ 1/4 quiet; one item per unit before any second. The practical task comes from the placement practical pool of
//   the level below the target (into Intermediate → `pb-g*`, …).
// - J2 (§7.2): n = 4 × skipped units, clamped to 10–20 items, equal weight totalling 100; with a PP-primary unit in
//   the range the items total 80 and that unit's placement practical task adds 20. No J2 within Master.
// - Units already mastered are excluded (the form shrinks within the clamps).
// - Pass (§7.3): exact total ≥ 90 (integer arithmetic, the screen shows it rounded DOWN), per-strand minimum (≥ 4
//   items: ≥ 75 % of the strand's points; fewer: all correct), all critical items correct, the practical task ≥ 75
//   with no critical failure in one run, first answers only. Voided answers are removed from numerator and
//   denominator (the items keep their share of the total); more than a quarter of a strand voided (any void in a
//   strand of < 4), a voided critical item, or a practical task still voided after its one replay ends with "could
//   not be assessed" (nothing changes, no retake limit, §5.6).
// - Early stop as soon as passing is impossible (every remaining answer assumed perfect).
// - Outcome (§7.4): pass → every skipped lesson completed (placement); a skipped unit mastered (placement) only if
//   covered (≥ 1 item, all correct); the practical task grants "applied" to the unit task it is equivalent to. No XP,
//   no hearts. Retake: one attempt per target per local day (UA2 default), counted when the test starts.

import type { AssessmentItem, Strand, Track } from '../content/types';
import type { ApplicationGrant, AttemptRecord, CompletionGrant, FallbackRegime, MasteryGrant } from '../progress/records';
import { isCorrect, type ScoredAnswer } from './credit';
import { pickForm, seededShuffle, spreadBy, textSeed, type Cap, type Need } from './form';

export const J1_ITEMS = 20;
export const J1_PER_STRAND = 4;
/** Strands sampled by placement items; PP is covered by the practical task. */
export const PLACEMENT_STRANDS: readonly Strand[] = ['RS', 'TC', 'OD', 'PA', 'DE'];
export const PRACTICAL_POINTS = 20;
export const PASS_TOTAL = 90;
export const PRACTICAL_PASS = 75;
export const J2_MIN_ITEMS = 10;
export const J2_MAX_ITEMS = 20;
/** Units whose primary strand is PP (03 §7.2; i11's PP is secondary). */
export const PP_PRIMARY_UNITS: readonly string[] = ['b10', 'a10', 'e09', 'm07', 'm08', 'm09'];
const LEVELS: readonly Track[] = ['basics', 'intermediate', 'advanced', 'expert', 'master'];
const PREFIX: Record<Track, string> = { basics: 'b', intermediate: 'i', advanced: 'a', expert: 'e', master: 'm' };

/** Placement pool id of a level (`pb`, `pi`, …); Master has none. */
export const placementPoolId = (level: Track): string => `p${PREFIX[level]}`;
/** Placement practical pool id of a level (`pb-g`, …). */
export const practicalPoolId = (level: Track): string => `p${PREFIX[level]}-g`;

export interface PlacementForm {
  kind: 'J1' | 'J2';
  /** J1: the target level; J2: the target lesson. */
  target: string;
  formId: string;
  items: AssessmentItem[];
  practical: AssessmentItem | null;
  /** Points of all items together (J1 80; J2 100, or 80 with a practical task). */
  itemPoints: number;
  /** Units the jump skips (outcome: covered → mastered). */
  skippedUnits: string[];
  assessmentVersion: number;
}

export type PlacementFormResult = { ok: true; form: PlacementForm } | { ok: false; reason: 'master' | 'nothing-to-test' | 'cannot-build' | 'no-practical' };

interface Tagged {
  item: AssessmentItem;
  level: Track;
}

const unexposedFirst = <T extends { item: AssessmentItem }>(list: readonly T[], exposed: ReadonlySet<string>): T[] => [
  ...list.filter((t) => !exposed.has(t.item.id!)),
  ...list.filter((t) => exposed.has(t.item.id!)),
];

/** Seeded order: unexposed first, then a shuffle, one per unit before any second. */
function order<T extends { item: AssessmentItem }>(list: readonly T[], exposed: ReadonlySet<string>, seed: number): T[] {
  const shuffled = seededShuffle(list, seed);
  return unexposedFirst(spreadBy(shuffled, (t) => t.item.unit), exposed);
}

function pickPractical(tasks: readonly AssessmentItem[], exposed: ReadonlySet<string>, seed: number): AssessmentItem | null {
  const ordered = unexposedFirst(seededShuffle(tasks, seed).map((item) => ({ item })), exposed);
  return ordered[0]?.item ?? null;
}

export interface J1Input {
  target: Track;
  /** Servable items of each level's placement pool (`pb`, `pi`, …). */
  placement: Partial<Record<Track, readonly AssessmentItem[]>>;
  /** Servable tasks of the placement practical pool of the level below the target. */
  practical: readonly AssessmentItem[];
  /** Units of the skipped levels, in course order. */
  skippedUnits: readonly string[];
  mastered: ReadonlySet<string>;
  exposed: ReadonlySet<string>;
  seed: number;
  assessmentVersion?: number;
}

/** The levels a J1 into `target` skips: every level below it. */
export const levelsBelow = (target: Track): Track[] => LEVELS.slice(0, LEVELS.indexOf(target));

export function assembleJ1(input: J1Input): PlacementFormResult {
  const skipped = levelsBelow(input.target);
  if (skipped.length === 0) return { ok: false, reason: 'nothing-to-test' };
  const highest = skipped[skipped.length - 1];
  const fullBoardRS = LEVELS.indexOf(input.target) > LEVELS.indexOf('intermediate');
  const tagged: Tagged[] = [];
  for (const level of skipped) {
    for (const item of input.placement[level] ?? []) {
      if (input.mastered.has(item.unit) || item.strand === 'PP' || !item.strand) continue;
      if (item.strand === 'RS' && (level !== 'basics' || (fullBoardRS && item.fullBoard !== true))) continue;
      tagged.push({ item, level });
    }
  }
  const seed = textSeed(input.seed, `J1:${input.target}`);
  const candidates = order(tagged, input.exposed, seed);
  const needs: Need<Tagged>[] = [];
  const caps: Cap<Tagged>[] = [];
  for (const s of PLACEMENT_STRANDS) {
    needs.push({ label: `strand:${s}`, min: J1_PER_STRAND, test: (t) => t.item.strand === s });
    caps.push({ label: `strand:${s}`, max: J1_PER_STRAND, test: (t) => t.item.strand === s });
    if (s === 'RS') needs.push({ label: 'RS-critical', min: 2, test: (t) => t.item.strand === 'RS' && t.item.critical === true });
    else needs.push({ label: `strand:${s}:highest`, min: 2, test: (t) => t.item.strand === s && t.level === highest });
  }
  needs.push({ label: 'black', min: Math.ceil(J1_ITEMS / 3), test: (t) => t.item.side === 'black' });
  needs.push({ label: 'quiet', min: Math.ceil(J1_ITEMS / 4), test: (t) => t.item.nature === 'quiet' });
  const practical = pickPractical(input.practical, input.exposed, seed + 7);
  if (!practical) return { ok: false, reason: 'no-practical' };
  const picked = pickWithExposure(candidates, J1_ITEMS, needs, caps, input.exposed);
  if (!picked) return { ok: false, reason: 'cannot-build' };
  return {
    ok: true,
    form: {
      kind: 'J1',
      target: input.target,
      formId: `J1:${input.target}#${seed.toString(36)}`,
      items: picked.map((t) => t.item),
      practical,
      itemPoints: 100 - PRACTICAL_POINTS,
      skippedUnits: [...input.skippedUnits],
      assessmentVersion: input.assessmentVersion ?? 1,
    },
  };
}

function pickWithExposure<T extends { item: AssessmentItem }>(candidates: readonly T[], size: number, needs: Need<T>[], caps: Cap<T>[], exposed: ReadonlySet<string>): T[] | null {
  // A new form avoids exposed items; if none can be built, at most half may be exposed (as 03 §4.3 for checks).
  for (const max of [0, Math.floor(size / 2)]) {
    const form = pickForm(candidates, { size, needs, caps: [...caps, { label: 'exposed', max, test: (t) => exposed.has(t.item.id!) }] });
    if (form) return form;
  }
  return null;
}

export interface J2Input {
  /** The locked lesson tapped. */
  target: string;
  level: Track;
  /** Units with skipped lessons, in course order (one level). */
  skippedUnits: readonly string[];
  /** Servable items of the level's placement pool. */
  placement: readonly AssessmentItem[];
  /** Servable tasks of the level's placement practical pool. */
  practical: readonly AssessmentItem[];
  mastered: ReadonlySet<string>;
  exposed: ReadonlySet<string>;
  seed: number;
  assessmentVersion?: number;
}

/** J2 length: 4 × units, clamped to 10–20. */
export const j2Length = (units: number): number => Math.max(J2_MIN_ITEMS, Math.min(J2_MAX_ITEMS, 4 * units));

export function assembleJ2(input: J2Input): PlacementFormResult {
  if (input.level === 'master') return { ok: false, reason: 'master' };
  const units = input.skippedUnits.filter((u) => !input.mastered.has(u));
  if (units.length === 0) return { ok: false, reason: 'nothing-to-test' };
  const size = j2Length(units.length);
  const ppUnit = units.find((u) => PP_PRIMARY_UNITS.includes(u));
  const seed = textSeed(input.seed, `J2:${input.target}`);
  let practical: AssessmentItem | null = null;
  if (ppUnit) {
    practical = pickPractical(
      input.practical.filter((t) => t.unit === ppUnit),
      input.exposed,
      seed + 7,
    );
    if (!practical) return { ok: false, reason: 'no-practical' };
  }
  const tagged = input.placement.filter((i) => units.includes(i.unit)).map((item) => ({ item, level: input.level }));
  const candidates = order(tagged, input.exposed, seed);
  // Coverage: every skipped unit at least once when the form is long enough (one item per unit before any second).
  const needs: Need<Tagged>[] = units.length <= size ? units.map((u) => ({ label: `unit:${u}`, min: 1, test: (t: Tagged) => t.item.unit === u })) : [];
  const picked = pickWithExposure(candidates, size, needs, [], input.exposed);
  if (!picked) return { ok: false, reason: 'cannot-build' };
  return {
    ok: true,
    form: {
      kind: 'J2',
      target: input.target,
      formId: `J2:${input.target}#${seed.toString(36)}`,
      items: picked.map((t) => t.item),
      practical,
      itemPoints: practical ? 100 - PRACTICAL_POINTS : 100,
      skippedUnits: units,
      assessmentVersion: input.assessmentVersion ?? 1,
    },
  };
}

// ---------- Scoring (03 §7.3) ----------

/** The placement practical task's run, as the player reports it. */
export interface PracticalOutcome {
  /** Task score 0–100 (one decimal, rounded down). */
  score: number;
  pass: boolean;
  /** A critical failure (03 §5.6) or a failed line share gate. */
  criticalFailure: boolean;
  voided: boolean;
  /** Assessed runs (must be 1: no retry inside the test). */
  runs: number;
  voidedRuns: number;
  fallback?: FallbackRegime | null;
}

export interface StrandResult {
  strand: Strand;
  items: number;
  /** Exact fraction of the strand's points (0–1). */
  share: number;
  ok: boolean;
}

export interface PlacementResult {
  /** Exact total 0–100 (for display only; the pass is decided in integers). */
  total: number;
  /** Rounded DOWN (89.8 shows 89). */
  shown: number;
  totalOk: boolean;
  strands: StrandResult[];
  criticalMissed: string[];
  practicalOk: boolean | null;
  /** Nothing can be decided: a voided critical item, the practical task voided twice, or nothing scorable. */
  couldNotAssess: boolean;
  pass: boolean;
}

/** Voided answers a strand may lose and still be decided: a quarter of its items, rounded down (none below 4). */
export const maxVoidedInStrand = (items: number): number => Math.floor(items / 4);

/**
 * Exact 03 §7.3 scoring, integer arithmetic.
 * - Items: each scorable item is worth 1000 units (credit × 1000 earned). Voided answers leave numerator and
 *   denominator, and the items keep their fixed share of the total (`itemPoints`), so voids never inflate the practical
 *   task's weight: total = itemPoints · E / P + score ÷ 5.
 * - Evidence: a strand may lose at most a quarter of its items (rounded down) to voids — none in a strand of fewer than
 *   4, so a strand with no scorable item is never decided — and no critical item; otherwise the test could not be
 *   assessed (nothing changes, no retake limit).
 * - Comparison without rounding: 50 · itemPoints · E + score10 · P ≥ 50 · 90 · P (score10 = score × 10, one decimal).
 */
export function scorePlacement(form: Pick<PlacementForm, 'items' | 'practical' | 'itemPoints'>, answers: ReadonlyMap<string, ScoredAnswer>, practical: PracticalOutcome | null): PlacementResult {
  let earned = 0;
  let possible = 0;
  let couldNotAssess = false;
  const criticalMissed: string[] = [];
  const perStrand = new Map<Strand, { earned: number; possible: number; items: number; voided: number }>();
  for (const item of form.items) {
    const a = answers.get(item.id!);
    const key = item.strand ?? ('none' as Strand);
    const s = perStrand.get(key) ?? { earned: 0, possible: 0, items: 0, voided: 0 };
    s.items++;
    perStrand.set(key, s);
    if (a?.voided) {
      s.voided++;
      if (item.critical) couldNotAssess = true;
      continue;
    }
    const e = Math.round((a ? a.credit : 0) * 1000);
    earned += e;
    possible += 1000;
    s.earned += e;
    s.possible += 1000;
    if (item.critical && !isCorrect(a)) criticalMissed.push(item.id!);
  }
  for (const s of perStrand.values()) if (s.voided > maxVoidedInStrand(s.items)) couldNotAssess = true;
  if (possible <= 0) couldNotAssess = true;
  let practicalOk: boolean | null = null;
  let score10 = 0;
  const itemPoints = form.practical ? form.itemPoints : 100;
  if (form.practical) {
    if (practical && practical.voided) {
      // A voided run is never scored. The player offers one replay (03 §5.6); a task still voided at the end (voided
      // again, or the replay declined) ends the test with "could not be assessed": nothing changes, no retake limit.
      couldNotAssess = true;
      practicalOk = false;
    } else if (practical) {
      score10 = Math.round(practical.score * 10);
      practicalOk = practical.pass && !practical.criticalFailure && practical.score >= PRACTICAL_PASS - 1e-9 && practical.runs <= 1;
    } else practicalOk = false;
  }
  const P = Math.max(1, possible);
  const numerator = 50 * itemPoints * earned + score10 * P;
  const totalOk = possible > 0 && numerator >= 50 * PASS_TOTAL * P;
  const total = possible > 0 ? numerator / (50 * P) : 0;
  const strands: StrandResult[] = [...perStrand]
    .filter(([strand]) => (strand as string) !== 'none')
    .map(([strand, s]) => ({
      strand,
      items: s.items,
      share: s.possible > 0 ? s.earned / s.possible : 0,
      // ≥ 4 items in the form: ≥ 75 % of the scorable points (4·earned ≥ 3·possible); fewer: perfect. No scorable item: not ok.
      ok: s.possible > 0 && (s.items >= 4 ? 4 * s.earned >= 3 * s.possible : s.earned === s.possible),
    }));
  const pass = !couldNotAssess && totalOk && strands.every((s) => s.ok) && criticalMissed.length === 0 && practicalOk !== false;
  return { total, shown: Math.floor(total + 1e-9), totalOk, strands, criticalMissed, practicalOk, couldNotAssess, pass };
}

/**
 * Early stop (§7.2): passing is already impossible, assuming every unanswered item fully correct and an unplayed
 * practical task at 100. A test that could not be assessed stops too.
 */
export function placementCannotPass(form: Pick<PlacementForm, 'items' | 'practical' | 'itemPoints'>, answers: ReadonlyMap<string, ScoredAnswer>, practical: PracticalOutcome | null): boolean {
  const optimistic = new Map(answers);
  for (const item of form.items) if (!optimistic.has(item.id!)) optimistic.set(item.id!, { itemId: item.id!, credit: 1, voided: false });
  const best = practical ?? (form.practical ? { score: 100, pass: true, criticalFailure: false, voided: false, runs: 1, voidedRuns: 0 } : null);
  const r = scorePlacement(form, optimistic, best);
  return r.couldNotAssess || !r.pass;
}

// ---------- Outcome (03 §7.4) ----------

export interface SkippedLesson {
  lessonId: string;
  unit: string;
  contentVersion: number;
}

export interface PlacementOutcome {
  completions: { lessonId: string; grant: CompletionGrant }[];
  mastered: { unitId: string; grant: MasteryGrant }[];
  /** Skipped units not covered: unmastered, their unit checks stay available. */
  notCovered: string[];
  applied: { taskId: string; grant: ApplicationGrant }[];
}

/** Units covered by the form: ≥ 1 item tagged with the unit and every such item correct. */
export function coveredUnits(form: Pick<PlacementForm, 'items' | 'skippedUnits'>, answers: ReadonlyMap<string, ScoredAnswer>): string[] {
  return form.skippedUnits.filter((u) => {
    const mine = form.items.filter((i) => i.unit === u);
    return mine.length > 0 && mine.every((i) => isCorrect(answers.get(i.id!)));
  });
}

/** The grants of a passed test (null when it did not pass). No XP, no hearts. */
export function placementOutcome(
  form: PlacementForm,
  result: PlacementResult,
  answers: ReadonlyMap<string, ScoredAnswer>,
  practical: PracticalOutcome | null,
  skipped: readonly SkippedLesson[],
  at: string,
): PlacementOutcome | null {
  if (!result.pass) return null;
  const covered = coveredUnits(form, answers);
  const strandScores: Partial<Record<Strand, number>> = {};
  for (const s of result.strands) strandScores[s.strand] = Math.floor(s.share * 1000 + 1e-9) / 10;
  const mastery = (): MasteryGrant => ({
    at,
    via: 'placement',
    score: Math.floor(result.total * 10 + 1e-9) / 10,
    ...(Object.keys(strandScores).length ? { strandScores } : {}),
    formId: form.formId,
    assessmentVersion: form.assessmentVersion,
  });
  const applied: PlacementOutcome['applied'] = [];
  if (form.practical?.equivalentOf && practical && !practical.voided) {
    applied.push({
      taskId: form.practical.equivalentOf,
      grant: {
        at,
        via: 'placement',
        score: Math.floor(practical.score),
        taskVersion: form.practical.version ?? 1,
        equivalentOf: form.practical.id!,
        ...(practical.fallback ? { fallback: practical.fallback } : {}),
      },
    });
  }
  return {
    completions: skipped.map((l) => ({ lessonId: l.lessonId, grant: { at, via: 'placement', contentVersion: l.contentVersion } })),
    mastered: covered.map((unitId) => ({ unitId, grant: mastery() })),
    notCovered: form.skippedUnits.filter((u) => !covered.includes(u)),
    applied,
  };
}

/** After a failed test: the weakest strand and the first skipped unit (in form-unit order) carrying it. */
export function weakestPointer(form: Pick<PlacementForm, 'items' | 'skippedUnits'>, result: PlacementResult): { strand: Strand; unit: string } | null {
  const weakest = [...result.strands].sort((a, b) => a.share - b.share)[0];
  if (!weakest) return null;
  const unit = form.skippedUnits.find((u) => form.items.some((i) => i.unit === u && i.strand === weakest.strand));
  return unit ? { strand: weakest.strand, unit } : null;
}

// ---------- One attempt per target per local day (03 §7.4, UA2 default) ----------

/** Log id of a placement target: `J1:intermediate`, `J2:b05l1`. */
export const placementLogId = (kind: 'J1' | 'J2', target: string): string => `${kind}:${target}`;

/** The device's local date `YYYY-MM-DD` of a time. */
export function localDay(t: Date): string {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

/** The entry logged when a test STARTS (a quit test counts as the day's attempt). */
export function placementStartRecord(form: PlacementForm, at: string): AttemptRecord {
  return { itemId: placementLogId(form.kind, form.target), itemVersion: form.assessmentVersion, mode: 'placement', at, credit: 0, form: true, formId: form.formId, outcome: 'started' };
}

/** The entry logged when a test ends (pass, fail, early stop or "could not be assessed"). */
export function placementEndRecord(form: PlacementForm, result: PlacementResult, at: string, stoppedEarly: boolean): AttemptRecord {
  return {
    itemId: placementLogId(form.kind, form.target),
    itemVersion: form.assessmentVersion,
    mode: 'placement',
    at,
    credit: Math.max(0, Math.min(1, result.total / 100)),
    form: true,
    formId: form.formId,
    outcome: result.couldNotAssess ? 'could-not-assess' : result.pass ? 'passed' : 'failed',
    ...(stoppedEarly ? { stoppedEarly: true } : {}),
  };
}

/**
 * Whether a target may be attempted today: no test started today for it, except tests that ended with "could not be
 * assessed" (no retake limit then, §5.6).
 */
export function placementAvailableToday(kind: 'J1' | 'J2', target: string, attempts: readonly AttemptRecord[], now: Date): boolean {
  const id = placementLogId(kind, target);
  const today = localDay(now);
  const mine = attempts.filter((r) => r.form === true && r.itemId === id && localDay(new Date(r.at)) === today);
  const started = mine.filter((r) => r.outcome === 'started').length;
  const released = mine.filter((r) => r.outcome === 'could-not-assess').length;
  return started - released <= 0;
}
