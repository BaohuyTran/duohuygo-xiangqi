// Assessment pools (03-assessment.md §4.3, §6, §7; backlog S2.13): unit check, placement, placement practical and
// exam pools, one JSON file each in ./assessment (never ./drafts). Pure TypeScript and light: the app bundles this
// loader; the validator is src/content/validate-pools.ts (tests and scripts only, like validate.ts).
//
// - A pool file is an `AssessmentPool` (src/content/types.ts); its `id` is the file name.
// - Serving (03 §4.2 rule 9: "draft or unreviewed items are never served"): an item is served only when its status
//   is `published`, or `reviewed` in the course preview, and only for a level the path shows (a published level, or
//   any level in the preview). The release test (src/content/release.test.ts) also requires an approving review
//   record for every served item; the loader does not filter by records (they are never bundled).
// - No pool content exists yet (pilot slices come with S2.16): with no files every function returns nothing, and the
//   app behaves exactly as before.

import { levelOfId, type ReleaseState } from './release';
import type { AssessmentItem, AssessmentPool, PoolKind, Track } from './types';

const files = import.meta.glob<AssessmentPool>('./assessment/*.json', { eager: true, import: 'default' });

/** `./assessment/b09-check.json` -> `b09-check`. */
export const poolFileId = (path: string): string => path.replace(/^.*\//, '').replace(/\.json$/, '');

/** Every loaded pool, keyed by file name (validated by src/content/validate-pools.ts). */
export const poolFiles: Readonly<Record<string, AssessmentPool>> = Object.fromEntries(
  Object.keys(files)
    .sort()
    .map((path) => [poolFileId(path), files[path]]),
);

/** Every loaded pool, sorted by id. */
export const allPools: AssessmentPool[] = Object.values(poolFiles);

/** The level a pool belongs to: its `level`, else the level prefix of its unit. */
export function poolLevel(pool: Pick<AssessmentPool, 'level' | 'unit'>): Track | undefined {
  if (pool.level) return pool.level;
  return pool.unit ? levelOfId(pool.unit) : undefined;
}

/** An item may be served: `published`, or `reviewed` in the course preview. Drafts and unreviewed items never are. */
export const isServable = (item: Pick<AssessmentItem, 'status'>, preview: boolean): boolean =>
  item.status === 'published' || (preview && item.status === 'reviewed');

export interface ServeOptions {
  preview: boolean;
  state: ReleaseState;
}

/**
 * The pools as the app may use them: only servable items, and only pools of a level the path shows (published
 * levels; every level in the course preview). Pools left with no item are dropped.
 */
export function servablePools(pools: readonly AssessmentPool[], { preview, state }: ServeOptions): AssessmentPool[] {
  const published = new Set(state.published);
  const out: AssessmentPool[] = [];
  for (const pool of pools) {
    const level = poolLevel(pool);
    if (!level || (!preview && !published.has(level))) continue;
    const items = (Array.isArray(pool.items) ? pool.items : []).filter((item) => isServable(item, preview));
    if (items.length > 0) out.push({ ...pool, items });
  }
  return out;
}

/** The pools of one kind (and level / unit, when given). */
export function poolsOf(pools: readonly AssessmentPool[], kind: PoolKind, where: { level?: Track; unit?: string } = {}): AssessmentPool[] {
  return pools.filter(
    (p) => p.kind === kind && (where.level === undefined || poolLevel(p) === where.level) && (where.unit === undefined || p.unit === where.unit),
  );
}
