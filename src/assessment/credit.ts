// First-answer credit per item type and the evidence rules shared by checks, placement and exams
// (design/03-assessment.md §3). Pure: no React, DOM, storage or gamification.
//
// - Credit is decided by the FIRST answer only (03 §3.2); hints and retries are recorded beside it on the attempt
//   record (`hints`, `hintStep`, `attemptsBeforeSuccess`), never folded in. Assessments offer neither.
// - A voided answer (the analysis could not check it, or a practical run voided by the device fallback) carries no
//   credit and no penalty: scoring removes it from numerator AND denominator (03 §3.2 "removed").
// - The screens compute the per-type credit when the item is answered (decisionCredit, lineCredit, the play score);
//   `itemCredit` is the single statement of the 03 §3.2 table that those values must agree with (credit.test.ts).

import type { MoveClass } from '../content/types';
import { decisionCredit } from '../lessons/decision';
import { lineCredit } from '../lessons/line';
import type { AttemptRecord } from '../progress/records';

/** What the first answer of an item was, per item type (03 §3.2). */
export type FirstAnswer =
  /** Exact set: 1; any missing or extra square: 0 (no partial credit in assessments). */
  | { type: 'select-squares'; exact: boolean }
  /** The engine confirms the goal. */
  | { type: 'move' | 'capture'; goalMet: boolean }
  /** Every own move engine-confirmed the first time; any wrong move ends the item. */
  | { type: 'combination'; allConfirmed: boolean }
  /** Keyed option(s), exact for multi-select. */
  | { type: 'choice'; exact: boolean }
  /** target/sound 1; dubious 0.5 only when the item is flagged `partial`; error 0. */
  | { type: 'decision'; class: MoveClass; partial?: boolean }
  /** First answers at each on-tree learner node; any error 0; per-node mean only when flagged `partial`. */
  | { type: 'line'; classes: readonly MoveClass[]; errored?: boolean; partial?: boolean }
  /** Task score ÷ 100; 0 after a critical failure or a failed line share gate. */
  | { type: 'play'; score: number; criticalFailure: boolean; gateFailed?: boolean }
  /** R7 ÷ 100. */
  | { type: 'review'; score: number };

const unit = (x: number) => Math.max(0, Math.min(1, x));

/** The 03 §3.2 credit (0–1) of a first answer. */
export function itemCredit(a: FirstAnswer): number {
  switch (a.type) {
    case 'select-squares':
      return a.exact ? 1 : 0;
    case 'move':
    case 'capture':
      return a.goalMet ? 1 : 0;
    case 'combination':
      return a.allConfirmed ? 1 : 0;
    case 'choice':
      return a.exact ? 1 : 0;
    case 'decision':
      return decisionCredit({ partial: a.partial }, a.class);
    case 'line':
      return lineCredit({ partial: a.partial }, a.classes, a.errored ?? false);
    case 'play':
      return a.criticalFailure || a.gateFailed ? 0 : unit(a.score / 100);
    case 'review':
      return unit(a.score / 100);
  }
}

/** A scored answer of one form item: its credit, or `voided` (removed from the score). */
export interface ScoredAnswer {
  itemId: string;
  credit: number;
  voided: boolean;
}

/**
 * The answer a form gets from an attempt record: first-answer credit only (`attemptsBeforeSuccess` and hints are
 * ignored — an assessment offers neither, and a later right answer never raises the credit). A record of another
 * mode, or with hints before its first answer, does not count as an independent answer: credit 0.
 */
export function answerFromRecord(record: AttemptRecord, mode: AttemptRecord['mode']): ScoredAnswer {
  if (record.voided === true) return { itemId: record.itemId, credit: 0, voided: true };
  const independent = record.mode === mode && record.hintBeforeFirstAnswer !== true && (record.hints ?? 0) === 0;
  return { itemId: record.itemId, credit: independent ? unit(record.credit) : 0, voided: false };
}

/** Practice summary "independent: 5 of 8" (03 §3.2): full first-answer credit, no hint before it, not voided. */
export function independentCount(records: readonly AttemptRecord[]): { independent: number; total: number } {
  const counted = records.filter((r) => r.voided !== true);
  return { independent: counted.filter((r) => r.credit >= 1 && r.hintBeforeFirstAnswer !== true).length, total: counted.length };
}

/** Records that scoring may use: voided ones are kept in the log but never scored. */
export const scorable = (records: readonly AttemptRecord[]): AttemptRecord[] => records.filter((r) => r.voided !== true);

/** Whether an answer is fully correct (critical items, coverage): credit 1 and not voided. */
export const isCorrect = (a: ScoredAnswer | undefined): boolean => a !== undefined && !a.voided && a.credit >= 1;
