// Merge rule for the learning records synced in the account's `data_v2` column (05-migration.md §8.6).
// Pure TypeScript: no React, DOM, storage or Supabase.
//
// `data_v2` is the whole `learning.records.v1` value (src/progress/records.ts): `schema`, `completed`,
// `mastered`, `applied`, `exposed` and any field written by a newer build. The attempt log stays local.
// The v1 JSON (`data`, src/sync/merge.ts) is unchanged and still written for older builds.
//
// - completed: UNION by lesson id; the same id on both sides keeps `betterCompletion` (earlier `at`, then
//   `lesson` before `placement`, then JSON string order). The same rule `grantCompletion` uses locally.
// - mastered, applied: per id the grant with the HIGHER score; tie -> later `at`; tie -> JSON string order
//   (`betterScored`). Monotone: mastery is never revoked (03 §2 rule 6, 05 §8.6 item 8).
// - exposed: UNION (sorted).
// - schema: the higher one (a newer build's schema is never lowered, 05 §8.6 item 7).
// - Unknown top-level fields (written by a newer build): the local value, else the remote one (preserved).
// - Missing or corrupt remote data is ignored field by field by `parseRecords`; it never removes local data.
//
// Idempotent, and commutative for completed / mastered / applied / exposed / schema (two devices converge
// whatever the sync order); unknown fields are the only per-device exception (same as the preferences in merge.ts).

import { betterCompletion, betterScored, parseRecords, type LearningRecords } from '../progress/records';

/** The account's `data_v2` JSON, read leniently; `null` when there is none (no row, or a null column). */
export function parseRemoteRecords(raw: unknown): LearningRecords | null {
  return raw === null || raw === undefined ? null : parseRecords(raw);
}

const KNOWN = new Set(['schema', 'completed', 'mastered', 'applied', 'exposed']);

function mergeSection<T>(local: Record<string, T>, remote: Record<string, T>, better: (a: T, b: T) => T): Record<string, T> {
  const out = new Map<string, T>(Object.entries(local));
  for (const [id, grant] of Object.entries(remote)) {
    const mine = out.get(id);
    out.set(id, mine === undefined ? grant : better(mine, grant));
  }
  // Sorted ids so the result does not depend on which side was local. fromEntries: `__proto__` stays a plain key.
  return Object.fromEntries([...out.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** Merges the account's records into the local records (rule at the top of this file). */
export function mergeRecords(local: LearningRecords, remote: LearningRecords | null): LearningRecords {
  if (remote === null) return local;
  const unknown = new Map<string, unknown>();
  for (const [key, value] of Object.entries(remote)) if (!KNOWN.has(key)) unknown.set(key, value);
  for (const [key, value] of Object.entries(local)) if (!KNOWN.has(key)) unknown.set(key, value);
  return {
    ...Object.fromEntries(unknown),
    schema: Math.max(local.schema, remote.schema),
    completed: mergeSection(local.completed, remote.completed, betterCompletion),
    mastered: mergeSection(local.mastered, remote.mastered, betterScored),
    applied: mergeSection(local.applied, remote.applied, betterScored),
    exposed: [...new Set([...local.exposed, ...remote.exposed])].sort(),
  };
}

/** JSON with object keys sorted at every level (arrays keep their order). */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : stable(v))).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * A comparison key for records (or a raw `data_v2` value): independent of key order and of the order of
 * `exposed`. Part of the sync fingerprint, so a records-only change triggers a sync and is pushed.
 */
export function recordsFingerprint(records: unknown): string {
  if (typeof records !== 'object' || records === null || Array.isArray(records)) return stable(records ?? null);
  const r = records as Record<string, unknown>;
  return stable(Array.isArray(r.exposed) ? { ...r, exposed: [...r.exposed].sort() } : r);
}
