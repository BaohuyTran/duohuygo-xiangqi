// §5.7 item 3 ("≥ 3 narrow positions in the reference run") for tasks scored with the R6 line-share gate: the
// content-reviewer's ruling A (S2.14). An opening from the initial position has no narrow positions to author, but the
// gate itself makes the safe shuffler fail for the right reason (03 §5.2 remedy (2)). The item is "n/a (R6 gate)" only
// when ALL of these hold; otherwise it stays required (FAIL when the reference run has < 3 narrow positions):
// - the task scores line share (R6 / F2b gate);
// - every counted tree node is selective (0 < credited ≤ 1/3 of the guard-passing moves; off-tree positions are counted
//   only when selective by construction);
// - N2 fails ≥ 80 % of the counted runs;
// - the partner searches beyond the safety horizon h;
// - the reference run reaches L counted moves.
// Pure: used by scripts/verify-practical.ts.
import type { PartnerSpec } from '../content/types';

export interface NarrowRulingInput {
  scoresLineShare: boolean;
  treeNodesSelective: boolean;
  n2: { failed: number; of: number };
  partner: readonly PartnerSpec[];
  h: number;
  referenceCounted: number;
  L: number | undefined;
}

/** Plies a partner link searches: `d`, or 2k − 1 for a mate search of k moves. */
export function partnerPlies(link: PartnerSpec): number {
  if ('d' in link && typeof link.d === 'number') return link.d;
  if ('k' in link && typeof link.k === 'number') return 2 * link.k - 1;
  return 0;
}

/** 'n/a' when ruling A exempts the task from §5.7 item 3, else 'required'. */
export function narrowPositionsRuling(x: NarrowRulingInput): 'n/a' | 'required' {
  const n2Fails = x.n2.of > 0 && x.n2.failed >= 0.8 * x.n2.of;
  const deeper = x.partner.some((l) => partnerPlies(l) > x.h);
  const reachesL = x.L !== undefined && x.referenceCounted >= x.L;
  return x.scoresLineShare && x.treeNodesSelective && n2Fails && deeper && reachesL ? 'n/a' : 'required';
}
