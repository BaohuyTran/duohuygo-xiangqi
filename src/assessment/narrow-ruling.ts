// §5.7 item 3 ("≥ 3 narrow positions in the reference run") for tasks scored with the R6 line-share gate (content-reviewer
// rulings, DECISIONS D13). An opening from the initial position has no narrow positions to author, but the gate itself
// makes the safe shuffler fail for the right reason (03 §5.2 remedy (2)).
//
// Ruling A (S2.14): item 3 is "n/a (R6 gate)" when ALL of these hold:
// - the task scores line share (R6 / F2b gate);
// - every scored (counted) learner node of the tree is selective (0 < credited ≤ 1/3 of the guard-passing moves;
//   off-tree positions are counted only when selective by construction);
// - N2 fails ≥ 80 % of the counted runs;
// - the partner searches beyond the safety horizon h;
// - the reference run reaches L counted moves.
// Ruling D (S2.15, extends A): under fallback F5 or F2b, when the level's h is at least the partner's depth (e.g.
// safe-sparring(2) at Intermediate, h = 2), the "partner beyond h" condition is dropped, but then N2 voided runs must
// be ≤ 1/5 of the N2 runs as well. The task text discloses that the continuation partner adds no pressure beyond the
// safety check. Otherwise item 3 stays required (FAIL when the reference run has < 3 narrow positions).
// Pure: used by scripts/verify-practical.ts.
import type { PartnerSpec } from '../content/types';

export interface NarrowRulingInput {
  scoresLineShare: boolean;
  treeNodesSelective: boolean;
  n2: { failed: number; of: number };
  /** All N2 runs and the voided ones among them (ruling D). Optional for ruling A callers. */
  n2Runs?: { voided: number; total: number };
  partner: readonly PartnerSpec[];
  h: number;
  referenceCounted: number;
  L: number | undefined;
  /** The task's fallback regime ('F5', 'F2b', …; null in the main regime). */
  fallback?: string | null;
}

/** Plies a partner link searches: `d`, or 2k − 1 for a mate search of k moves. */
export function partnerPlies(link: PartnerSpec): number {
  if ('d' in link && typeof link.d === 'number') return link.d;
  if ('k' in link && typeof link.k === 'number') return 2 * link.k - 1;
  return 0;
}

export type NarrowRuling = 'n/a' | 'n/a-D' | 'required';

/** 'n/a' (ruling A) or 'n/a-D' (ruling D) when item 3 is exempt, else 'required'. */
export function narrowPositionsRuling(x: NarrowRulingInput): NarrowRuling {
  const n2Fails = x.n2.of > 0 && x.n2.failed >= 0.8 * x.n2.of;
  const reachesL = x.L !== undefined && x.referenceCounted >= x.L;
  if (!(x.scoresLineShare && x.treeNodesSelective && n2Fails && reachesL)) return 'required';
  if (x.partner.some((l) => partnerPlies(l) > x.h)) return 'n/a';
  const depth = Math.max(0, ...x.partner.map(partnerPlies));
  const ruleD =
    (x.fallback === 'F5' || x.fallback === 'F2b') &&
    x.h >= depth &&
    x.n2Runs !== undefined &&
    x.n2Runs.total > 0 &&
    x.n2Runs.voided * 5 <= x.n2Runs.total;
  return ruleD ? 'n/a-D' : 'required';
}
