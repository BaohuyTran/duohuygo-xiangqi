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

  it('counts partner plies: d, or 2k − 1 for mate searches', () => {
    expect(partnerPlies({ kind: 'pressing', d: 2 })).toBe(2);
    expect(partnerPlies({ kind: 'forcing-attack', k: 2 })).toBe(3);
    expect(partnerPlies({ kind: 'forcing-attack' })).toBe(0);
  });
});
