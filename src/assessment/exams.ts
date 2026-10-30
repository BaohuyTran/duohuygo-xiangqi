// Level exams (design/03-assessment.md §6), unit / level / course progress states (§2) and the portfolio data model
// (§6.1). Pure: no React, DOM, storage or gamification, and no runtime import of src/analysis or practical.ts (Home
// reads these states from the main chunk).
//
// - Exams `xb`, `xi`, `xa`, `xe`, `xm` are built from exam-pool tasks, one slot after another. While `pressing` is not
//   validated (PARTNER_REGIME 'fallback', S2.18) the slots are those of fallback F (03 §5.2 F3 for `xb`, F4 for the
//   others: `EXAM_SLOTS_UNDER_F`, equal to the list in practical.ts, checked by exams.test.ts); in the main regime the
//   slots of the §6 table.
// - Pass (§6): every play task ≥ 75 with no critical failure (and not voided); review minimum 60 (`xb`, `xa`) or 70
//   (`xe`, `xm`); `xi` has no review. A voided task means the exam could not be assessed (no grant, no failure).
// - The exam grant (level "applied") is stored under the exam id, `via: 'exam'`, and records the exam-level fallback
//   provenance: `F3` for `xb` and `F4` for the other exams while they run under fallback F (carry-over of S2.12).
//   Passing `xm` also masters `m09` (§2).
// - States (§2): completed (per lesson, any provenance incl. migration), mastered (per unit grant: check / placement /
//   exam), applied (per practical task; "—" when a unit has none); level mastered = every unit mastered; level applied
//   = its exam passed; graduated = every level mastered and applied.

import type { AssessmentItem, Strand, TaskKind, Track, Unit } from '../content/types';
import type { CompletedState } from '../progress/legacy';
import type { ApplicationGrant, AttemptRecord, FallbackRegime, LearningRecords, MasteryGrant } from '../progress/records';
import type { PartnerRegime } from './regime';
import { pickForm, seededShuffle, textSeed, type Cap, type Need } from './form';

export const EXAM_IDS: Readonly<Record<Track, string>> = { basics: 'xb', intermediate: 'xi', advanced: 'xa', expert: 'xe', master: 'xm' };
export const TASK_PASS = 75;
/** Review minimum per exam (03 §6); null = the exam has no review. */
export const REVIEW_PASS: Readonly<Record<Track, number | null>> = { basics: 60, intermediate: null, advanced: 60, expert: 70, master: 70 };

/** One slot: `count` tasks of these kinds, played in this fallback form (null = authored rubrics). */
export interface ExamSlot {
  name: string;
  kinds: readonly (TaskKind | 'review')[];
  fallback: FallbackRegime | null;
  count: number;
  bothColours?: boolean;
}

/** 03 §5.2 F3 / F4 (= practical.ts `EXAM_SLOTS_UNDER_F`, which this module may not import at runtime). */
export const EXAM_SLOTS_UNDER_F: Readonly<Record<Track, readonly ExamSlot[]>> = {
  basics: [
    { name: 'xb-games', kinds: ['game'], fallback: 'F2', count: 2, bothColours: true },
    { name: 'xb-F3-hold', kinds: ['hold'], fallback: 'F1', count: 2 },
    { name: 'xb-review', kinds: ['review'], fallback: null, count: 1 },
  ],
  intermediate: [
    { name: 'xi-F5-opening', kinds: ['opening'], fallback: 'F5', count: 2, bothColours: true },
    { name: 'xi-F1c-convert', kinds: ['convert'], fallback: 'F1c', count: 1 },
  ],
  advanced: [
    { name: 'xa-F1-plan', kinds: ['plan'], fallback: 'F1', count: 1 },
    { name: 'xa-F1-defence', kinds: ['hold'], fallback: 'F1', count: 1 },
    { name: 'xa-endgame', kinds: ['convert', 'hold'], fallback: null, count: 1 },
    { name: 'xa-review', kinds: ['review'], fallback: null, count: 1 },
  ],
  expert: [
    { name: 'xe-F5-repertoire', kinds: ['opening'], fallback: 'F5', count: 2, bothColours: true },
    { name: 'xe-F1c-convert', kinds: ['convert'], fallback: 'F1c', count: 1 },
    { name: 'xe-F1-hold', kinds: ['hold'], fallback: 'F1', count: 1 },
    { name: 'xe-review', kinds: ['review'], fallback: null, count: 1 },
  ],
  master: [
    { name: 'xm-F5-opening', kinds: ['opening'], fallback: 'F5', count: 1 },
    { name: 'xm-F1-middlegame', kinds: ['plan'], fallback: 'F1', count: 1 },
    { name: 'xm-F1-defence', kinds: ['hold'], fallback: 'F1', count: 1 },
    { name: 'xm-endgame', kinds: ['convert', 'hold'], fallback: null, count: 1 },
    { name: 'xm-review', kinds: ['review'], fallback: null, count: 1 },
  ],
};

/** 03 §6 table, main regime (`pressing` validated). */
export const EXAM_SLOTS_MAIN: Readonly<Record<Track, readonly ExamSlot[]>> = {
  basics: [
    { name: 'xb-games', kinds: ['game'], fallback: null, count: 2, bothColours: true },
    { name: 'xb-review', kinds: ['review'], fallback: null, count: 1 },
  ],
  intermediate: [
    { name: 'xi-opening', kinds: ['opening'], fallback: null, count: 2, bothColours: true },
    { name: 'xi-convert', kinds: ['convert'], fallback: null, count: 1 },
  ],
  advanced: [
    { name: 'xa-plan', kinds: ['plan'], fallback: null, count: 1 },
    { name: 'xa-defence', kinds: ['hold'], fallback: null, count: 1 },
    { name: 'xa-endgame', kinds: ['convert', 'hold'], fallback: null, count: 1 },
    { name: 'xa-review', kinds: ['review'], fallback: null, count: 1 },
  ],
  expert: [
    { name: 'xe-repertoire', kinds: ['opening'], fallback: null, count: 2, bothColours: true },
    { name: 'xe-convert', kinds: ['convert'], fallback: null, count: 1 },
    { name: 'xe-hold', kinds: ['hold'], fallback: null, count: 1 },
    { name: 'xe-review', kinds: ['review'], fallback: null, count: 1 },
  ],
  master: [
    { name: 'xm-opening', kinds: ['opening'], fallback: null, count: 1 },
    { name: 'xm-middlegame', kinds: ['plan'], fallback: null, count: 1 },
    { name: 'xm-defence', kinds: ['hold'], fallback: null, count: 1 },
    { name: 'xm-endgame', kinds: ['convert', 'hold'], fallback: null, count: 1 },
    { name: 'xm-review', kinds: ['review'], fallback: null, count: 1 },
  ],
};

export const examSlots = (level: Track, regime: PartnerRegime): readonly ExamSlot[] => (regime === 'fallback' ? EXAM_SLOTS_UNDER_F : EXAM_SLOTS_MAIN)[level];

/** Every slot name of either regime (the validator checks an exam item's `slot` against it). */
export const ALL_EXAM_SLOTS: ReadonlySet<string> = new Set(
  [...Object.values(EXAM_SLOTS_UNDER_F), ...Object.values(EXAM_SLOTS_MAIN)].flatMap((slots) => slots.map((s) => s.name)),
);

/** The exam-level fallback provenance (03 §5.2): `xb` under F is F3, every other exam under F is F4. */
export const examFallback = (level: Track, regime: PartnerRegime): FallbackRegime | null => (regime === 'fallback' ? (level === 'basics' ? 'F3' : 'F4') : null);

const kindOf = (item: AssessmentItem): TaskKind | 'review' | null => (item.type === 'review' ? 'review' : item.type === 'play' ? item.task : null);

export interface ExamForm {
  kind: 'exam';
  level: Track;
  examId: string;
  regime: PartnerRegime;
  formId: string;
  assessmentVersion: number;
  /** Tasks in slot order. */
  tasks: { slot: string; item: AssessmentItem }[];
}

/**
 * Seeded exam: for each slot, `count` unexposed (then exposed) tasks of its kinds tagged with the slot (`item.slot`),
 * both colours where the slot asks for it; `xm` also needs both colours overall. Null when a slot cannot be filled.
 */
export function assembleExam(
  level: Track,
  regime: PartnerRegime,
  items: readonly AssessmentItem[],
  ctx: { exposed: ReadonlySet<string>; seed: number; assessmentVersion: number },
): ExamForm | null {
  const seed = textSeed(ctx.seed, EXAM_IDS[level]);
  const tasks: ExamForm['tasks'] = [];
  const used = new Set<string>();
  for (const [si, slot] of examSlots(level, regime).entries()) {
    const shuffled = seededShuffle(
      items.filter((i) => i.slot === slot.name && !used.has(i.id!) && slot.kinds.includes(kindOf(i) as TaskKind)),
      seed + si,
    );
    const ordered = [...shuffled.filter((i) => !ctx.exposed.has(i.id!)), ...shuffled.filter((i) => ctx.exposed.has(i.id!))];
    const needs: Need<AssessmentItem>[] = slot.bothColours
      ? [
          { label: 'red', min: 1, test: (i) => (i.side ?? 'red') === 'red' },
          { label: 'black', min: 1, test: (i) => i.side === 'black' },
        ]
      : [];
    const caps: Cap<AssessmentItem>[] = [];
    const picked = pickForm(ordered, { size: slot.count, needs, caps });
    if (!picked) return null;
    for (const item of picked) {
      used.add(item.id!);
      tasks.push({ slot: slot.name, item });
    }
  }
  if (level === 'master' && new Set(tasks.map((t) => t.item.side ?? 'red')).size < 2) return null;
  return { kind: 'exam', level, examId: EXAM_IDS[level], regime, formId: `${EXAM_IDS[level]}#${seed.toString(36)}`, assessmentVersion: ctx.assessmentVersion, tasks };
}

/** One finished exam task. */
export interface ExamTaskOutcome {
  /** 0–100 (play: task score; review: R7). */
  score: number;
  /** Play: the 03 §5.6 pass (≥ pass mark, no critical failure, gate passed). Review: unused. */
  pass: boolean;
  voided: boolean;
  fallback?: FallbackRegime | null;
}

export interface ExamResult {
  pass: boolean;
  couldNotAssess: boolean;
  /** Lowest play-task score (the grant's score). */
  score: number;
  failedTasks: string[];
}

export function scoreExam(form: ExamForm, outcomes: ReadonlyMap<string, ExamTaskOutcome>): ExamResult {
  const reviewMin = REVIEW_PASS[form.level];
  const failedTasks: string[] = [];
  let couldNotAssess = false;
  let score = 100;
  for (const { item } of form.tasks) {
    const o = outcomes.get(item.id!);
    if (!o) {
      failedTasks.push(item.id!);
      continue;
    }
    if (o.voided) {
      couldNotAssess = true;
      continue;
    }
    if (item.type === 'review') {
      if (reviewMin !== null && o.score < reviewMin - 1e-9) failedTasks.push(item.id!);
    } else {
      score = Math.min(score, o.score);
      if (!o.pass || o.score < TASK_PASS - 1e-9) failedTasks.push(item.id!);
    }
  }
  return { pass: !couldNotAssess && failedTasks.length === 0, couldNotAssess, score: Math.floor(score), failedTasks };
}

/** Grants of a passed exam: level "applied" under the exam id (with the F3/F4 provenance), and `m09` mastery for `xm`. */
export function examGrants(form: ExamForm, result: ExamResult, at: string): { applied: { taskId: string; grant: ApplicationGrant }; mastered: { unitId: string; grant: MasteryGrant } | null } | null {
  if (!result.pass) return null;
  const fallback = examFallback(form.level, form.regime);
  const applied = { taskId: form.examId, grant: { at, via: 'exam' as const, score: result.score, taskVersion: form.assessmentVersion, ...(fallback ? { fallback } : {}) } };
  const mastered =
    form.level === 'master'
      ? { unitId: 'm09', grant: { at, via: 'exam' as const, score: result.score, formId: form.formId, assessmentVersion: form.assessmentVersion } }
      : null;
  return { applied, mastered };
}

// ---------- Progress states (03 §2) ----------

export interface UnitProgress {
  unitId: string;
  lessons: number;
  completed: number;
  /** Lessons completed only through migration (shown as completed, never as mastered). */
  migrated: number;
  mastered: MasteryGrant | null;
  /** Practical tasks of the unit (`<unit>-gN` play / review items in its lessons). */
  tasks: string[];
  appliedTasks: string[];
  /** `n/a` = no practical task ("applied: —"); `none` / `some` / `all`. */
  applied: 'n/a' | 'none' | 'some' | 'all';
}

/** Practical task ids of a unit (03 §2: "unit = all its tasks"). */
export function unitTasks(unit: Unit): string[] {
  const pattern = new RegExp(`^${unit.id}-g\\d+$`);
  return [...new Set(unit.lessons.flatMap((l) => l.exercises.filter((e) => (e.type === 'play' || e.type === 'review') && e.id && pattern.test(e.id)).map((e) => e.id!)))];
}

export function unitProgress(unit: Unit, completed: ReadonlyMap<string, CompletedState>, records: LearningRecords): UnitProgress {
  const ids = unit.lessons.map((l) => l.id);
  const done = ids.filter((id) => completed.has(id));
  const migrated = done.filter((id) => completed.get(id)?.via === 'migration');
  const tasks = unitTasks(unit);
  const appliedTasks = tasks.filter((t) => Object.hasOwn(records.applied, t));
  return {
    unitId: unit.id,
    lessons: ids.length,
    completed: done.length,
    migrated: migrated.length,
    mastered: Object.hasOwn(records.mastered, unit.id) ? records.mastered[unit.id] : null,
    tasks,
    appliedTasks,
    applied: tasks.length === 0 ? 'n/a' : appliedTasks.length === 0 ? 'none' : appliedTasks.length === tasks.length ? 'all' : 'some',
  };
}

export interface LevelProgress {
  level: Track;
  units: UnitProgress[];
  /** Every unit mastered. */
  mastered: boolean;
  /** The level exam passed. */
  applied: boolean;
  exam: ApplicationGrant | null;
}

export function levelProgress(level: Track, units: readonly Unit[], completed: ReadonlyMap<string, CompletedState>, records: LearningRecords): LevelProgress {
  const mine = units.filter((u) => (u.track ?? 'basics') === level).map((u) => unitProgress(u, completed, records));
  const examId = EXAM_IDS[level];
  const exam = Object.hasOwn(records.applied, examId) ? records.applied[examId] : null;
  return { level, units: mine, mastered: mine.length > 0 && mine.every((u) => u.mastered !== null), applied: exam !== null, exam };
}

/** Course graduated: every level present mastered and applied (03 §2 rule 3). */
export function courseGraduated(levels: readonly LevelProgress[]): boolean {
  return levels.length > 0 && levels.every((l) => l.mastered && l.applied);
}

// ---------- Portfolio (03 §6.1) ----------

export interface Portfolio {
  units: UnitProgress[];
  /** Per strand: unit-check points earned / possible (scorable check answers carrying `strand`). */
  strands: { strand: Strand; earned: number; possible: number; percent: number }[];
  exams: { level: Track; examId: string; grant: ApplicationGrant | null }[];
  /** Reviewed games: review attempts (R7; their records carry `markedPly`). */
  reviewedGames: { itemId: string; score: number; at: string }[];
  /** Recurring mistake categories: misconception tags of wrong first answers, most frequent first. */
  mistakes: { tag: string; count: number }[];
  /** Strands below 80 % of their unit-check points, with the units whose check items were missed there. */
  remediation: { strand: Strand; units: string[] }[];
}

/** The generated summary of 03 §6.1 (not a certificate; no title, grade or rating). */
export function buildPortfolio(units: readonly Unit[], completed: ReadonlyMap<string, CompletedState>, records: LearningRecords, attempts: readonly AttemptRecord[]): Portfolio {
  const answers = attempts.filter((r) => r.form !== true && r.voided !== true);
  const checks = answers.filter((r) => r.mode === 'check' && typeof r.strand === 'string');
  const strandMap = new Map<Strand, { earned: number; possible: number; missed: Set<string> }>();
  for (const r of checks) {
    const s = r.strand as Strand;
    const v = strandMap.get(s) ?? { earned: 0, possible: 0, missed: new Set<string>() };
    v.earned += r.credit;
    v.possible += 1;
    if (r.credit < 1 && typeof r.unit === 'string') v.missed.add(r.unit);
    strandMap.set(s, v);
  }
  const strands = [...strandMap].map(([strand, v]) => ({ strand, earned: v.earned, possible: v.possible, percent: Math.floor((1000 * v.earned) / v.possible + 1e-9) / 10 }));
  const tags = new Map<string, number>();
  for (const r of answers) if (r.misconception && r.credit < 1) tags.set(r.misconception, (tags.get(r.misconception) ?? 0) + 1);
  const levels = [...new Set(units.map((u) => u.track ?? 'basics'))];
  return {
    units: units.map((u) => unitProgress(u, completed, records)),
    strands,
    exams: levels.map((level) => ({ level, examId: EXAM_IDS[level], grant: Object.hasOwn(records.applied, EXAM_IDS[level]) ? records.applied[EXAM_IDS[level]] : null })),
    reviewedGames: answers.filter((r) => typeof r.markedPly === 'number').map((r) => ({ itemId: r.itemId, score: Math.round(r.credit * 100), at: r.at })),
    mistakes: [...tags].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || (a.tag < b.tag ? -1 : 1)),
    remediation: [...strandMap].filter(([, v]) => 100 * v.earned < 80 * v.possible).map(([strand, v]) => ({ strand, units: [...v.missed].sort() })),
  };
}
