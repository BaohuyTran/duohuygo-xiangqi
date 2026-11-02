import { describe, expect, it } from 'vitest';
import { narrowPositionsRuling, partnerPlies, type NarrowRulingInput } from './narrow-ruling';

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
});
