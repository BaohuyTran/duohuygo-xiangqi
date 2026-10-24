// The safety guard of an item (03-assessment.md §5.3). Kept apart from ./answers.ts because it needs
// src/analysis/judge.ts: screens load it lazily together with the analysis client (./decision.ts), so the
// analysis code stays out of the app's main chunk; the validator, scripts and tests import it directly.
import { guardForUnit, SAFETY_GUARDS, type SafetyGuard } from '../analysis/judge';
import type { GuardOverride } from '../content/types';

/** Which guard an item uses: its id (level, `guardForUnit`) and its h/k/T override. Plain data. */
export interface GuardSpec {
  itemId?: string;
  override?: GuardOverride;
}

/**
 * The level's guard from the item id (`b05l2-04`, `i07-p02`; `guardForUnit`), Basic for items without a
 * new-course id, with the item's h/k/T override.
 */
export function guardFor(itemId: string | undefined, override?: GuardOverride): SafetyGuard {
  const base = itemId !== undefined && /^[biaem]\d\d/.test(itemId) ? guardForUnit(itemId) : SAFETY_GUARDS.basics;
  return { ...base, ...override };
}

export const resolveGuard = (spec: GuardSpec): SafetyGuard => guardFor(spec.itemId, spec.override);
