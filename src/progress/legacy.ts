// Legacy (v1) lesson completion, DERIVED at read time and never stored (05-migration.md §8.4).
// Pure TypeScript: no React, DOM, storage or gamification imports (enforced by a test).
//
// - The v1 list `progress.completedLessons.v1` stays the single source of legacy completion. Nothing here writes
//   anything: the view is recomputed from it on every read, so it is idempotent, order-independent, picks up
//   completions that older builds keep adding, and has nothing to undo on rollback.
// - `LEGACY_MAP` maps a RETIRED legacy lesson id to its new-course successor lesson(s) ("Completion →" of 05 §3).
//   Version 1 (release state REL-P): only the 9 orphan ids of 05 §6, each with no target. Each release of 05 §8.4.1
//   adds the entries of the legacy lessons it retires and bumps `LEGACY_MAP_VERSION`; corrections only ADD targets.
// - Ids in the v1 list that are not in the map (live legacy lessons, orphans, unknown ids, typos) give nothing.
// - Migration yields COMPLETED only: never mastered, never applied (03 §2 rule 4).

import type { CompletionGrant, LearningRecords } from './records';

export const LEGACY_MAP_VERSION = 1;

export type LegacyMap = Readonly<Record<string, readonly string[]>>;

export const LEGACY_MAP: LegacyMap = Object.freeze({
  u2l3: [],
  u3l3: [],
  u4l3: [],
  u5l1: [],
  u5l2: [],
  u5l3: [],
  u6l1: [],
  u6l2: [],
  u6l3: [],
});

/** Completion derived from the legacy list: no date, score or content version (the v1 data has none). */
export interface MigratedCompletion {
  via: 'migration';
  /** The legacy lesson ids it comes from, sorted. */
  from: string[];
  at: null;
}

export type CompletedState = CompletionGrant | MigratedCompletion;

/**
 * New-course lessons completed through the legacy v1 list. A target reached from several legacy lessons is
 * completed if ANY of them is, and `from` lists all of them. Corrupt input (not an array, non-strings) gives
 * nothing for the bad parts.
 */
export function legacyCompletion(v1Ids: readonly string[], map: LegacyMap = LEGACY_MAP): Map<string, MigratedCompletion> {
  const sources = new Map<string, Set<string>>();
  const ids: readonly unknown[] = Array.isArray(v1Ids) ? v1Ids : [];
  for (const id of ids) {
    // Own properties only: `constructor`, `__proto__`, … in a corrupt list must not hit Object.prototype.
    if (typeof id !== 'string' || !Object.hasOwn(map, id)) continue;
    const targets = map[id];
    if (!Array.isArray(targets)) continue;
    for (const target of targets) {
      if (!sources.has(target)) sources.set(target, new Set());
      sources.get(target)!.add(id);
    }
  }
  const view = new Map<string, MigratedCompletion>();
  for (const target of [...sources.keys()].sort()) {
    view.set(target, { via: 'migration', from: [...sources.get(target)!].sort(), at: null });
  }
  return view;
}

/**
 * Completed lessons as shown to the learner: stored grants ∪ derived legacy completion. Where both exist the
 * stored grant wins (it has a date and real evidence). Reads only; writes nothing.
 */
export function completedView(
  records: LearningRecords,
  v1Ids: readonly string[],
  map: LegacyMap = LEGACY_MAP,
): Map<string, CompletedState> {
  const view = new Map<string, CompletedState>(legacyCompletion(v1Ids, map));
  for (const [lessonId, grant] of Object.entries(records.completed)) view.set(lessonId, grant);
  return view;
}
