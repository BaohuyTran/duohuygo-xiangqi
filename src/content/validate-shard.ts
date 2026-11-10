// TEST-ONLY: splits the new-course units over the validate-shard-*.test.ts files so Vitest validates them in parallel
// (one worker per file). Unit k goes to shard k mod SHARD_COUNT in loader order. Never import from app code.
import { allUnits } from './index';
import { isNewCourseUnitId } from './release';
import type { Unit } from './types';

export const SHARD_COUNT = 4;

/** The new-course units shard `k` validates. */
export function shardUnits(k: number): Unit[] {
  return allUnits.filter((u) => isNewCourseUnitId(u.id)).filter((_, i) => i % SHARD_COUNT === k);
}
