// Rubrics R0–R7, line share and the pass rules of practical tasks (design/03-assessment.md §5.3–§5.6). Pure: the
// inputs are FACTS about a finished run (signals per learner move, balances, predicate results), gathered by
// src/assessment/practical.ts in the analysis Worker; nothing here searches. No React, DOM, storage or gamification,
// and no runtime import of src/analysis (the review screen uses R7 from the main chunk), so the R1 deductions are
// repeated here (rubrics.test.ts checks they equal judge.ts `R1_PENALTIES`).
import type { RubricId, RubricWeight } from '../content/types';
import type { FallbackRegime } from '../progress/records';

/** 03 §5.3 per-move penalties (= src/analysis/judge.ts `PenaltyKind`). */
export type PenaltyKind = 'allowed-mate' | 'serious-allowed-loss' | 'allowed-loss' | 'missed-mate' | 'missed-gain';

/** R1 Safety deductions per move (03 §5.3). */
export const R1_DEDUCTIONS: Readonly<Record<PenaltyKind, number>> = {
  'allowed-mate': 50,
  'serious-allowed-loss': 50,
  'allowed-loss': 25,
  'missed-mate': 25,
  'missed-gain': 15,
};

/** Default pass mark of a task (03 §5.6). */
export const PASS_MARK = 75;
/** Line share gate (03 §5.3 rule 4). */
export const LINE_SHARE_GATE = 2 / 3;
/** Smallest line share window L (03 §5.3). */
export const MIN_LINE_SHARE_L = 6;

const clamp = (x: number) => Math.max(0, Math.min(100, x));

// ---------- R0–R5 ----------

/** R0 Material held: final balance ≥ start − 1: 100; ≥ start − 3: 50; else 0 (learner's view, static count). */
export function r0(startBalance: number, endBalance: number): number {
  if (endBalance >= startBalance - 1) return 100;
  if (endBalance >= startBalance - 3) return 50;
  return 0;
}

/** R1 Safety: 100 minus the single largest penalty of each learner move (null = no penalty); floor 0. */
export function r1(penalties: readonly (PenaltyKind | null)[]): number {
  return clamp(100 - penalties.reduce((s, p) => s + (p ? R1_DEDUCTIONS[p] : 0), 0));
}

export interface DevelopmentFacts {
  /** Developed pieces (chariots, horses, cannons off their start points) after the learner's n-th move (or the last). */
  developed: number;
  target: number;
  /** General / Advisor moves in the first n that were neither a capture nor a check evasion. */
  idleDefenderMoves: number;
  /** Some piece moved more than 3 times in the first n without capturing or answering a threat. */
  overmoved: boolean;
}

/** R2 Development: target 50 (pro rata) + no idle General/Advisor moves 25 + no piece moved > 3 times 25. */
export function r2(f: DevelopmentFacts): number {
  const dev = f.target <= 0 ? 50 : 50 * Math.min(1, f.developed / f.target);
  return clamp(dev + (f.idleDefenderMoves === 0 ? 25 : 0) + (f.overmoved ? 0 : 25));
}

/** R3 Plan: objective reached 50; reached with R1 ≥ 75: 30; own non-General mobility at the end ≥ start: 20. */
export function r3(f: { objectiveMet: boolean; r1: number; mobilityStart: number; mobilityEnd: number }): number {
  return (f.objectiveMet ? 50 : 0) + (f.objectiveMet && f.r1 >= 75 ? 30 : 0) + (f.mobilityEnd >= f.mobilityStart ? 20 : 0);
}

/**
 * R4 Conversion: mate (or stalemate win) within the cap 60, else lead at the end ≥ lead at the start 30; the opponent
 * never had a forced mate within 2: 20; R1 ≥ 75: 20. Without a mate the maximum is 70 (< 75).
 */
export function r4(f: { won: boolean; leadStart: number; leadEnd: number; opponentHadMate2: boolean; r1: number }): number {
  return (f.won ? 60 : f.leadEnd >= f.leadStart ? 30 : 0) + (f.opponentHadMate2 ? 0 : 20) + (f.r1 >= 75 ? 20 : 0);
}

/**
 * R5 Holding. Gate: not mated (0). Final deficit ≤ start deficit + 1: 30; no threat at the end: 20; R1 × 0.2;
 * holding predicate: 30. Without the predicate the maximum is 70 (< 75).
 */
export function r5(f: { mated: boolean; startDeficit: number; endDeficit: number; threatAtEnd: boolean; r1: number; holding: boolean }): number {
  if (f.mated) return 0;
  return (f.endDeficit <= f.startDeficit + 1 ? 30 : 0) + (f.threatAtEnd ? 0 : 20) + f.r1 * 0.2 + (f.holding ? 30 : 0);
}

// ---------- Line share (R6, F2b) ----------

/** One learner move for the line share (03 §5.3 rules 1–3). */
export interface ShareStep {
  /**
   * The move counts toward L: in its position 0 < credited ÷ guard-passing ≤ 1/3 (on the tree: the node's table; off
   * it: the default class of every legal move). null = could not be computed (voids the run).
   */
  counted: boolean | null;
  /** Credited: target/sound on the tree, default class `target` off it. */
  credited: boolean;
}

export interface LineShare {
  /** Counted moves inside the window (at most L). */
  counted: number;
  credited: number;
  /** credited ÷ L (the denominator never shrinks). */
  share: number;
  /**
   * Fewer than L counted moves, or a move whose counted fact could not be computed before the window filled: the run
   * is voided (03 §5.3 rule 3, §5.6) — a missing fact never just slides the window on.
   */
  voided: boolean;
  /** share ≥ 2/3. */
  gate: boolean;
  /** A move's counted fact could not be computed before the window filled (also sets `voided`). */
  unknown: boolean;
}

/** 03 §5.3: the first L counted moves; share = credited ÷ L; voided below L; gate ≥ 2/3. */
export function lineShare(steps: readonly ShareStep[], L: number): LineShare {
  let counted = 0;
  let credited = 0;
  let unknown = false;
  for (const s of steps) {
    if (counted >= L) break;
    if (s.counted === null) {
      unknown = true;
      continue;
    }
    if (!s.counted) continue;
    counted++;
    if (s.credited) credited++;
  }
  const share = L > 0 ? credited / L : 0;
  return { counted, credited, share, voided: counted < L || unknown, unknown, gate: share >= LINE_SHARE_GATE - 1e-9 };
}

/** R6 Opening line: share × 60 + R2 × 0.4 (the gate is a separate pass condition). */
export function r6(share: LineShare, r2Score: number): number {
  return clamp(share.share * 60 + r2Score * 0.4);
}

// ---------- R7 ----------

/**
 * R7 Self-review: marks one of the top 3 turning points 40; the better move is target/sound (authored game) or
 * improves S by ≥ T (own game) 40; the reason category matches the detected one 20.
 */
export function r7(f: { markedTurningPoint: boolean; betterMove: boolean; reasonMatches: boolean }): number {
  return (f.markedTurningPoint ? 40 : 0) + (f.betterMove ? 40 : 0) + (f.reasonMatches ? 20 : 0);
}

// ---------- Task score and pass rules (03 §5.6) ----------

/** A term of the task score: a rubric, or `LS` = line share × 100 (F2b). */
export type ScoreTerm = Exclude<RubricId, 'R7'> | 'LS';
export interface TermWeight {
  term: ScoreTerm;
  weight: number;
}

/**
 * The weights that score a task under its fallback (03 §5.2):
 * - F2 (full games): R1 × 0.6 + R2 × 0.2 + R0 × 0.2 (no result term);
 * - F2b: R1 × 0.4 + R2 × 0.2 + R0 × 0.1 + line share × 30, with the line share gate;
 * - F5 (opening tasks): only R6 (line share, R2), R1, R2 and R3 (own-side predicates) — no result, R4 or R5 term; the
 *   remaining authored weights are scaled back to 100;
 * - otherwise (main regime, F1, F1c, drills): the authored weights.
 */
export function scoringWeights(rubrics: readonly RubricWeight[], fallback: FallbackRegime | null): TermWeight[] {
  if (fallback === 'F2') return [{ term: 'R1', weight: 60 }, { term: 'R2', weight: 20 }, { term: 'R0', weight: 20 }];
  if (fallback === 'F2b') return [{ term: 'R1', weight: 40 }, { term: 'R2', weight: 20 }, { term: 'R0', weight: 10 }, { term: 'LS', weight: 30 }];
  if (fallback === 'F5') {
    const kept = rubrics.filter((r) => ['R1', 'R2', 'R3', 'R6'].includes(r.rubric));
    const total = kept.reduce((s, r) => s + r.weight, 0);
    if (total <= 0) return [{ term: 'R1', weight: 100 }];
    return kept.map((r) => ({ term: r.rubric, weight: (r.weight * 100) / total }));
  }
  return rubrics.map((r) => ({ term: r.rubric, weight: r.weight }));
}

/** The line share gate applies (R6 tasks, F2b games). */
export const usesLineShare = (weights: readonly TermWeight[]): boolean => weights.some((w) => w.term === 'R6' || w.term === 'LS');

export type CriticalFailure =
  /** The learner was checkmated or stalemated. */
  | 'mated'
  /** The learner lost by repetition rule (1) (perpetual check). */
  | 'perpetual-check'
  /** Conversion task: the opponent has a forced mate in the final position. */
  | 'final-mate-threat'
  /** `safetyGate` task: a serious allowed loss (an allowed mate is always serious). */
  | 'safety-gate';

export type VoidReason =
  /** A partner move came from the safety net (03 §5.6). */
  | 'partner-safety-net'
  /** A learner move's signals could not be computed within the budget ("not checked"). */
  | 'signal-not-checked'
  /** A fact needed for the score (end threat, predicate, line share class) could not be computed. */
  | 'fact-not-checked'
  /** Fewer than L counted moves (03 §5.3 rule 3). */
  | 'line-share-window';

export interface TaskScoreInput {
  weights: readonly TermWeight[];
  /** Values 0–100 of every term in `weights` (missing terms count 0). */
  values: Partial<Record<ScoreTerm, number>>;
  critical: readonly CriticalFailure[];
  voids: readonly VoidReason[];
  /** The line share, when the weights use it. */
  share?: LineShare;
  passMark?: number;
}

export interface TaskScore {
  /** The weighted score, one decimal, rounded down (the pass uses the unrounded value). */
  score: number;
  values: Partial<Record<ScoreTerm, number>>;
  critical: CriticalFailure[];
  /** Line share below 2/3 on a task that uses it: fails whatever the score. */
  gateFailed: boolean;
  voided: boolean;
  voids: VoidReason[];
  /** Score ≥ pass mark, no critical failure, gate passed, not voided. */
  pass: boolean;
}

/** Weighted sum of the terms; pass = score ≥ pass mark and no critical failure, gate passed and not voided (03 §5.6). */
export function scoreTask(input: TaskScoreInput): TaskScore {
  const total = input.weights.reduce((s, w) => s + w.weight, 0) || 1;
  const score = input.weights.reduce((s, w) => s + (w.weight / total) * (input.values[w.term] ?? 0), 0);
  // Shown and stored with one decimal, rounded DOWN, so a failing run never displays 75; the pass is decided on the
  // unrounded score.
  const shown = Math.floor(score * 10 + 1e-9) / 10;
  // A task scored with line share and no share facts fails closed.
  const gateFailed = usesLineShare(input.weights) && (input.share === undefined || !input.share.gate);
  const voids = [...new Set(input.voids)];
  const voided = voids.length > 0;
  const critical = [...new Set(input.critical)];
  return {
    score: shown,
    values: input.values,
    critical,
    gateFailed,
    voided,
    voids,
    pass: !voided && critical.length === 0 && !gateFailed && score >= (input.passMark ?? PASS_MARK) - 1e-9,
  };
}
