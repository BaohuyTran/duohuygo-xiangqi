import { describe, expect, it } from 'vitest';
import type { AssessmentItem, Track, Unit } from '../content/types';
import { completedView } from '../progress/legacy';
import { emptyRecords, type AttemptRecord, type LearningRecords } from '../progress/records';
import { checkLength } from './checks';
import {
  ALL_EXAM_SLOTS,
  assembleExam,
  buildPortfolio,
  courseGraduated,
  EXAM_IDS,
  EXAM_SLOTS_UNDER_F,
  examFallback,
  examGrants,
  examSlots,
  levelProgress,
  scoreExam,
  unitProgress,
  unitTasks,
  type ExamTaskOutcome,
} from './exams';
import * as practical from './practical';
import { choiceItem } from './test-fixtures';

const task = (id: string, slot: string, kind: string, side: 'red' | 'black' = 'red'): AssessmentItem =>
  ({ ...choiceItem({ id, unit: 'b10', side }), type: kind === 'review' ? 'review' : 'play', task: kind, slot }) as unknown as AssessmentItem;

const xbPool = [
  task('xb-g1', 'xb-games', 'game'),
  task('xb-g2', 'xb-games', 'game', 'black'),
  task('xb-g3', 'xb-F3-hold', 'hold'),
  task('xb-g4', 'xb-F3-hold', 'hold', 'black'),
  task('xb-r1', 'xb-review', 'review'),
];
const ok = (score: number, over: Partial<ExamTaskOutcome> = {}): ExamTaskOutcome => ({ score, pass: score >= 75, voided: false, ...over });

describe('exam slots (03 §6, §5.2 F3/F4)', () => {
  it('under fallback F the slots equal practical.ts EXAM_SLOTS_UNDER_F (copied: Home may not import practical.ts)', () => {
    expect(EXAM_SLOTS_UNDER_F).toEqual(practical.EXAM_SLOTS_UNDER_F);
    expect(examSlots('basics', 'fallback')).toBe(EXAM_SLOTS_UNDER_F.basics);
    expect(ALL_EXAM_SLOTS.has('xi-F5-opening')).toBe(true);
  });

  it('the exam-level fallback provenance: xb under F is F3, every other exam F4; none in the main regime', () => {
    expect(examFallback('basics', 'fallback')).toBe('F3');
    for (const l of ['intermediate', 'advanced', 'expert', 'master'] as Track[]) expect(examFallback(l, 'fallback')).toBe('F4');
    expect(examFallback('basics', 'main')).toBeNull();
  });
});

describe('exam form, pass rules and grants', () => {
  const form = assembleExam('basics', 'fallback', xbPool, { exposed: new Set(), seed: 1, assessmentVersion: 3 })!;

  it('fills every slot from tasks tagged with it', () => {
    expect(form.tasks.map((t) => t.slot)).toEqual(['xb-games', 'xb-games', 'xb-F3-hold', 'xb-F3-hold', 'xb-review']);
    expect(assembleExam('basics', 'fallback', xbPool.slice(1), { exposed: new Set(), seed: 1, assessmentVersion: 1 })).toBeNull();
    // The two xb games need both colours, in both regimes.
    const twoRed = [task('xb-g1', 'xb-games', 'game'), task('xb-g2', 'xb-games', 'game'), ...xbPool.slice(2)];
    expect(assembleExam('basics', 'fallback', twoRed, { exposed: new Set(), seed: 1, assessmentVersion: 1 })).toBeNull();
    expect(assembleExam('basics', 'main', twoRed, { exposed: new Set(), seed: 1, assessmentVersion: 1 })).toBeNull();
    expect(assembleExam('basics', 'main', [...xbPool.slice(0, 2), xbPool[4]], { exposed: new Set(), seed: 1, assessmentVersion: 1 })).not.toBeNull();
    // Both colours where the slot asks for it (xi openings).
    const xi = [task('xi-g1', 'xi-F5-opening', 'opening'), task('xi-g2', 'xi-F5-opening', 'opening'), task('xi-g3', 'xi-F1c-convert', 'convert')];
    expect(assembleExam('intermediate', 'fallback', xi, { exposed: new Set(), seed: 1, assessmentVersion: 1 })).toBeNull();
    xi[1] = task('xi-g2', 'xi-F5-opening', 'opening', 'black');
    expect(assembleExam('intermediate', 'fallback', xi, { exposed: new Set(), seed: 1, assessmentVersion: 1 })).not.toBeNull();
  });

  const outcomes = (scores: Record<string, ExamTaskOutcome>) => new Map(Object.entries(scores));
  const all = (games: number, holds: number, review: number) =>
    outcomes({ 'xb-g1': ok(games), 'xb-g2': ok(games), 'xb-g3': ok(holds), 'xb-g4': ok(holds), 'xb-r1': { score: review, pass: true, voided: false } });

  it('xb under F: both games and both hold tasks ≥ 75 with no critical failure, review ≥ 60', () => {
    expect(scoreExam(form, all(80, 75, 60)).pass).toBe(true);
    expect(scoreExam(form, all(80, 74.9, 60)).pass).toBe(false);
    expect(scoreExam(form, all(80, 80, 59)).pass).toBe(false);
    const critical = all(90, 90, 90);
    critical.set('xb-g1', ok(90, { pass: false }));
    expect(scoreExam(form, critical).pass).toBe(false);
  });

  it('a voided task: could not be assessed (no grant, no failure)', () => {
    const v = all(90, 90, 90);
    v.set('xb-g3', ok(0, { voided: true }));
    const r = scoreExam(form, v);
    expect(r.couldNotAssess).toBe(true);
    expect(examGrants(form, r, 'x')).toBeNull();
  });

  it('a passed exam grants level "applied" under the exam id, recording F3; xm also masters m09', () => {
    const g = examGrants(form, scoreExam(form, all(82, 77, 70)), '2026-10-30T10:00:00.000Z')!;
    expect(g.applied).toEqual({ taskId: 'xb', grant: { at: '2026-10-30T10:00:00.000Z', via: 'exam', score: 77, taskVersion: 3, fallback: 'F3' } });
    expect(g.mastered).toBeNull();
    const xmPool = [
      task('xm-g1', 'xm-F5-opening', 'opening'),
      task('xm-g2', 'xm-F1-middlegame', 'plan', 'black'),
      task('xm-g3', 'xm-F1-defence', 'hold'),
      task('xm-g4', 'xm-endgame', 'convert'),
      task('xm-r1', 'xm-review', 'review'),
    ];
    const xm = assembleExam('master', 'fallback', xmPool, { exposed: new Set(), seed: 1, assessmentVersion: 1 })!;
    const res = scoreExam(xm, new Map(xmPool.map((t) => [t.id!, ok(80)])));
    const grants = examGrants(xm, res, 'x')!;
    expect(grants.applied.grant.fallback).toBe('F4');
    expect(grants.mastered).toMatchObject({ unitId: 'm09', grant: { via: 'exam' } });
    // xm needs both colours overall.
    expect(assembleExam('master', 'fallback', xmPool.map((t) => ({ ...t, side: 'red' })) as AssessmentItem[], { exposed: new Set(), seed: 1, assessmentVersion: 1 })).toBeNull();
  });
});

// ---------- States (03 §2) ----------

const lesson = (id: string, extra: unknown[] = []) => ({ id, title: 'u1l1.title', exercises: [...extra] }) as Unit['lessons'][number];
const unitOf = (id: string, track: Track, lessons = [`${id}l1`, `${id}l2`], extra: unknown[] = []): Unit => ({
  id,
  track,
  title: 'u1.title',
  description: 'u1.desc',
  lessons: lessons.map((l, i) => lesson(l, i === 0 ? extra : [])),
});
const PREFIX: Record<Track, string> = { basics: 'b', intermediate: 'i', advanced: 'a', expert: 'e', master: 'm' };
const COUNTS: Record<Track, number> = { basics: 10, intermediate: 11, advanced: 10, expert: 9, master: 9 };
const course: Unit[] = (Object.keys(COUNTS) as Track[]).flatMap((t) => Array.from({ length: COUNTS[t] }, (_, k) => unitOf(`${PREFIX[t]}${String(k + 1).padStart(2, '0')}`, t)));
const at = '2026-10-30T10:00:00.000Z';

describe('unit, level and course states', () => {
  it('completed, mastered (and how) and applied are separate; migrated completion is never mastery', () => {
    const records = emptyRecords();
    const b05 = unitOf('b05', 'basics', ['b05l1', 'b05l2'], [{ type: 'play', id: 'b05-g1' }]);
    const view = completedView(records, ['u4l1'], { u4l1: ['b05l1'] });
    const p = unitProgress(b05, view, records);
    expect(p).toMatchObject({ completed: 1, migrated: 1, mastered: null, tasks: ['b05-g1'], appliedTasks: [], applied: 'none' });
    records.applied['b05-g1'] = { at, via: 'practical', score: 80, taskVersion: 1 };
    records.mastered.b05 = { at, via: 'placement', score: 95, formId: 'J1', assessmentVersion: 1 };
    expect(unitProgress(b05, view, records)).toMatchObject({ applied: 'all', mastered: { via: 'placement' } });
    expect(unitProgress(unitOf('b06', 'basics'), view, records).applied).toBe('n/a');
    expect(unitTasks(b05)).toEqual(['b05-g1']);
  });

  it('every unit is masterable by its check (m09 by xm); level mastery and graduation are reachable by working through', () => {
    for (const u of course) expect(checkLength(u.id) !== null || u.id === 'm09', u.id).toBe(true);
    const records: LearningRecords = emptyRecords();
    const view = completedView(records, []);
    const levels = () => (Object.keys(COUNTS) as Track[]).map((t) => levelProgress(t, course, view, records));
    expect(courseGraduated(levels())).toBe(false);
    for (const u of course) if (u.id !== 'm09') records.mastered[u.id] = { at, via: 'check', score: 87.5, formId: 'f', assessmentVersion: 1 };
    expect(levels().map((l) => l.mastered)).toEqual([true, true, true, true, false]);
    for (const t of Object.keys(COUNTS) as Track[]) records.applied[EXAM_IDS[t]] = { at, via: 'exam', score: 80, taskVersion: 1, fallback: t === 'basics' ? 'F3' : 'F4' };
    records.mastered.m09 = { at, via: 'exam', score: 80, formId: 'xm', assessmentVersion: 1 };
    expect(levels().every((l) => l.mastered && l.applied)).toBe(true);
    expect(courseGraduated(levels())).toBe(true);
  });
});

describe('portfolio (03 §6.1)', () => {
  it('summarises states, per-strand check points, exams, reviewed games, recurring mistakes and a remediation path', () => {
    const records = emptyRecords();
    records.applied.xb = { at, via: 'exam', score: 80, taskVersion: 1, fallback: 'F3' };
    const r = (itemId: string, credit: number, over: Partial<AttemptRecord> = {}): AttemptRecord => ({ itemId, itemVersion: 1, mode: 'check', at, credit, ...over });
    const attempts: AttemptRecord[] = [
      r('b01-c01', 1, { strand: 'RS', unit: 'b01' }),
      r('b01-c02', 0, { strand: 'RS', unit: 'b01', misconception: 'b01.m1' }),
      r('b02-c01', 1, { strand: 'TC', unit: 'b02' }),
      r('b02-c02', 0, { strand: 'TC', unit: 'b02', voided: true }),
      r('b01-check', 0.5, { form: true }),
      r('b05l1-03', 0, { mode: 'practice', misconception: 'b01.m1' }),
      r('b10-g3', 0.7, { mode: 'practice', markedPly: 4 }),
    ];
    const p = buildPortfolio(course.slice(0, 10), completedView(records, []), records, attempts);
    expect(p.strands).toEqual([
      { strand: 'RS', earned: 1, possible: 2, percent: 50 },
      { strand: 'TC', earned: 1, possible: 1, percent: 100 },
    ]);
    expect(p.remediation).toEqual([{ strand: 'RS', units: ['b01'] }]);
    expect(p.mistakes).toEqual([{ tag: 'b01.m1', count: 2 }]);
    expect(p.reviewedGames).toEqual([{ itemId: 'b10-g3', score: 70, at }]);
    expect(p.exams.find((e) => e.examId === 'xb')?.grant?.fallback).toBe('F3');
    expect(p.units).toHaveLength(10);
  });
});
