import { describe, expect, it } from 'vitest';
import { maxScoreWithoutObjective, narrowPositionsRuling, narrowRulingF, partnerPlies, type NarrowRulingInput, type RulingFInput } from './narrow-ruling';

const ok: NarrowRulingInput = {
  scoresLineShare: true,
  treeNodesSelective: true,
  n2: { failed: 19, of: 19 },
  partner: [{ kind: 'safe-sparring', d: 2, tau: 1 }],
  h: 1,
  referenceCounted: 6,
  L: 6,
};

describe('§5.7 item 3 ruling A (R6 line-share gate)', () => {
  it('is n/a only when every condition holds', () => {
    expect(narrowPositionsRuling(ok)).toBe('n/a');
    expect(narrowPositionsRuling({ ...ok, scoresLineShare: false })).toBe('required');
    expect(narrowPositionsRuling({ ...ok, treeNodesSelective: false })).toBe('required');
    expect(narrowPositionsRuling({ ...ok, n2: { failed: 15, of: 20 } })).toBe('required');
    expect(narrowPositionsRuling({ ...ok, n2: { failed: 0, of: 0 } })).toBe('required');
    expect(narrowPositionsRuling({ ...ok, partner: [{ kind: 'safe-sparring', d: 1 }] })).toBe('required');
    expect(narrowPositionsRuling({ ...ok, referenceCounted: 5 })).toBe('required');
    expect(narrowPositionsRuling({ ...ok, L: undefined })).toBe('required');
  });

  it('ruling D: F5 / F2b with h ≥ partner depth drops "partner beyond h" but needs ≤ 1/5 voided N2 runs', () => {
    const atH = { ...ok, h: 2, fallback: 'F5', n2Runs: { voided: 2, total: 20 } };
    expect(narrowPositionsRuling(atH)).toBe('n/a-D');
    expect(narrowPositionsRuling({ ...atH, fallback: 'F2b' })).toBe('n/a-D');
    expect(narrowPositionsRuling({ ...atH, n2Runs: { voided: 4, total: 20 } })).toBe('n/a-D');
    expect(narrowPositionsRuling({ ...atH, n2Runs: { voided: 5, total: 20 } })).toBe('required');
    expect(narrowPositionsRuling({ ...atH, n2Runs: undefined })).toBe('required');
    expect(narrowPositionsRuling({ ...atH, fallback: 'F1' })).toBe('required');
    expect(narrowPositionsRuling({ ...atH, fallback: null })).toBe('required');
    expect(narrowPositionsRuling({ ...atH, treeNodesSelective: false })).toBe('required');
    expect(narrowPositionsRuling({ ...atH, referenceCounted: 5 })).toBe('required');
    expect(narrowPositionsRuling({ ...atH, n2: { failed: 10, of: 18 } })).toBe('required');
    // A partner deeper than h is still ruling A, whatever the void rate.
    expect(narrowPositionsRuling({ ...atH, h: 1, n2Runs: { voided: 10, total: 20 } })).toBe('n/a');
  });

  it('counts partner plies: d, or 2k − 1 for mate searches', () => {
    expect(partnerPlies({ kind: 'pressing', d: 2 })).toBe(2);
    expect(partnerPlies({ kind: 'forcing-attack', k: 2 })).toBe(3);
    expect(partnerPlies({ kind: 'forcing-attack' })).toBe(0);
  });

  it('ruling F: R3 / R4 tasks whose objective is necessary, with ≥ 3 selective tree nodes and a passing second plan', () => {
    const f: RulingFInput = {
      weights: [
        { term: 'R3', weight: 70 },
        { term: 'R1', weight: 30 },
      ],
      passMark: 75,
      referenceTreeNodes: 3,
      treeNodesSelective: true,
      secondPlanPasses: true,
      secondPlanDiffers: true,
    };
    expect(maxScoreWithoutObjective(f.weights)).toBe(44);
    expect(narrowRulingF(f)).toBe('n/a-F');
    // R3 at 20 % no longer makes the objective necessary: 4 + 80 = 84 ≥ 75.
    expect(narrowRulingF({ ...f, weights: [{ term: 'R3', weight: 20 }, { term: 'R1', weight: 80 }] })).toBe('required');
    expect(narrowRulingF({ ...f, weights: [{ term: 'R2', weight: 50 }, { term: 'R1', weight: 50 }] })).toBe('required');
    expect(narrowRulingF({ ...f, referenceTreeNodes: 2 })).toBe('required');
    expect(narrowRulingF({ ...f, treeNodesSelective: false })).toBe('required');
    expect(narrowRulingF({ ...f, secondPlanPasses: false })).toBe('required');
    expect(narrowRulingF({ ...f, secondPlanDiffers: false })).toBe('required');
    // R4 without a mate is at most 70: R4 80 % + R1 20 % → 56 + 20 = 76 ≥ 75, so not necessary.
    expect(narrowRulingF({ ...f, weights: [{ term: 'R4', weight: 80 }, { term: 'R1', weight: 20 }] })).toBe('required');
  });
});
