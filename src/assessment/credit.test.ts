import { describe, expect, it } from 'vitest';
import { decisionCredit } from '../lessons/decision';
import { lineCredit } from '../lessons/line';
import type { AttemptRecord } from '../progress/records';
import { answerFromRecord, independentCount, isCorrect, itemCredit, scorable } from './credit';

const rec = (over: Partial<AttemptRecord> = {}): AttemptRecord => ({ itemId: 'b09-c01', itemVersion: 1, mode: 'check', at: '2026-10-30T10:00:00.000Z', credit: 1, ...over });

describe('credit per item type (03 §3.2)', () => {
  it('select-squares, move, capture, combination and choice: full or nothing', () => {
    expect(itemCredit({ type: 'select-squares', exact: true })).toBe(1);
    expect(itemCredit({ type: 'select-squares', exact: false })).toBe(0);
    expect(itemCredit({ type: 'move', goalMet: true })).toBe(1);
    expect(itemCredit({ type: 'capture', goalMet: false })).toBe(0);
    expect(itemCredit({ type: 'combination', allConfirmed: true })).toBe(1);
    expect(itemCredit({ type: 'combination', allConfirmed: false })).toBe(0);
    expect(itemCredit({ type: 'choice', exact: true })).toBe(1);
    expect(itemCredit({ type: 'choice', exact: false })).toBe(0);
  });

  it('decision: target/sound 1; dubious 0.5 only when flagged partial; error 0 (same as decisionCredit)', () => {
    expect(itemCredit({ type: 'decision', class: 'target' })).toBe(1);
    expect(itemCredit({ type: 'decision', class: 'sound' })).toBe(1);
    expect(itemCredit({ type: 'decision', class: 'dubious' })).toBe(0);
    expect(itemCredit({ type: 'decision', class: 'dubious', partial: true })).toBe(0.5);
    expect(itemCredit({ type: 'decision', class: 'error', partial: true })).toBe(0);
    for (const c of ['target', 'sound', 'dubious', 'error'] as const) {
      for (const partial of [false, true]) expect(itemCredit({ type: 'decision', class: c, partial })).toBe(decisionCredit({ partial }, c));
    }
  });

  it('line: all accepted 1; any error 0; per-node mean only when flagged (same as lineCredit)', () => {
    expect(itemCredit({ type: 'line', classes: ['target', 'sound'] })).toBe(1);
    expect(itemCredit({ type: 'line', classes: ['target', 'error'], partial: true })).toBe(0);
    expect(itemCredit({ type: 'line', classes: ['target', 'dubious'] })).toBe(0);
    expect(itemCredit({ type: 'line', classes: ['target', 'dubious'], partial: true })).toBe(0.75);
    expect(itemCredit({ type: 'line', classes: ['target'], errored: true })).toBe(0);
    expect(itemCredit({ type: 'line', classes: ['target', 'dubious', 'sound'], partial: true })).toBe(lineCredit({ partial: true }, ['target', 'dubious', 'sound']));
  });

  it('play: score ÷ 100, 0 after a critical failure or a failed gate; review: R7 ÷ 100', () => {
    expect(itemCredit({ type: 'play', score: 82.5, criticalFailure: false })).toBe(0.825);
    expect(itemCredit({ type: 'play', score: 90, criticalFailure: true })).toBe(0);
    expect(itemCredit({ type: 'play', score: 90, criticalFailure: false, gateFailed: true })).toBe(0);
    expect(itemCredit({ type: 'review', score: 60 })).toBe(0.6);
  });
});

describe('first answer only, hints recorded beside it, voided answers', () => {
  it('uses the first-answer credit; a later right answer never raises it', () => {
    expect(answerFromRecord(rec({ credit: 0, attemptsBeforeSuccess: 2 }), 'check')).toEqual({ itemId: 'b09-c01', credit: 0, voided: false });
    expect(answerFromRecord(rec({ credit: 1, attemptsBeforeSuccess: 0 }), 'check').credit).toBe(1);
  });

  it('a hint before the first answer, or another mode, is not independent evidence', () => {
    expect(answerFromRecord(rec({ hintBeforeFirstAnswer: true, hints: 1 }), 'check').credit).toBe(0);
    expect(answerFromRecord(rec({ hints: 1 }), 'check').credit).toBe(0);
    expect(answerFromRecord(rec({ mode: 'practice' }), 'check').credit).toBe(0);
  });

  it('a voided answer has no credit and is flagged (removed from the score), never correct', () => {
    const a = answerFromRecord(rec({ voided: true, credit: 0 }), 'check');
    expect(a).toEqual({ itemId: 'b09-c01', credit: 0, voided: true });
    expect(isCorrect(a)).toBe(false);
    expect(scorable([rec({ voided: true }), rec()])).toHaveLength(1);
  });

  it('practice shows "independent: n of m"', () => {
    const log = [rec({ mode: 'practice' }), rec({ mode: 'practice', hintBeforeFirstAnswer: true }), rec({ mode: 'practice', credit: 0 }), rec({ mode: 'practice', voided: true })];
    expect(independentCount(log)).toEqual({ independent: 1, total: 3 });
  });
});
