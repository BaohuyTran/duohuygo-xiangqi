// Merge rule for account sync. Pure TypeScript: no React, DOM or Supabase.
//
// The device's local store is the source of truth for the UI. When signed in, the app pulls the
// account's copy, merges it with the local copy using the rule below, writes the result locally and
// pushes it back. The rule never loses progress that either side has:
//
// - Completed lessons, solved puzzles: UNION of the id sets (sorted, so the result is order-independent).
// - XP per day: per-day MAX (two devices that both synced a day never double count it). XP older than
//   the kept history (XP_HISTORY_DAYS) is the part of totalXp not covered by `xpByDay`; the merged
//   total is MAX of that older part + the sum of the merged days, so it is never below either total.
// - Streak: the side whose `lastGoalDay` is later wins (`currentStreak` + `lastGoalDay` together);
//   on the same day the larger streak wins. Best streak: MAX (and at least the merged streak).
// - Hearts: both sides are first refilled up to `now` (timestamp rule); then the side with FEWER
//   hearts wins (on a tie, the later refill anchor). So sync can take hearts away but never grants any.
// - Preferences (language, sound muted, daily goal) are per device: the local value wins; the
//   account's value is used only when this device has none stored yet.
// - Missing or corrupt remote data is ignored field by field (it can only add, never remove).
// - Limitation: union cannot express deletion, so "Reset progress" on one device is undone by the
//   next sync while signed in.
//
// The merge is idempotent (merge(merge(l, r), r) = merge(l, r)), and commutative for everything
// except the per-device preferences.

import { refresh, type GamificationState, parseState } from '../gamification';
import { LANGUAGES } from '../i18n/messages';
import type { ProgressSnapshot } from '../storage';

/** Format version of the JSON stored in the account (`progress.data`). */
export const REMOTE_VERSION = 1;

/** The JSON stored in the account. */
export interface RemoteData {
  version: number;
  completedLessons: string[];
  solvedPuzzles: string[];
  settings: { language: string | null; muted: boolean | null };
  gamification: GamificationState | null;
}

export function toRemote(snapshot: ProgressSnapshot): RemoteData {
  return {
    version: REMOTE_VERSION,
    completedLessons: snapshot.completedLessons,
    solvedPuzzles: snapshot.solvedPuzzles,
    settings: { language: snapshot.language, muted: snapshot.muted },
    gamification: snapshot.gamification,
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '') : []);

/** Reads the account's JSON leniently: anything missing or corrupt becomes "nothing". */
export function parseRemote(raw: unknown, now: Date): ProgressSnapshot {
  const r = isRecord(raw) ? raw : {};
  const settings = isRecord(r.settings) ? r.settings : {};
  return {
    completedLessons: ids(r.completedLessons),
    solvedPuzzles: ids(r.solvedPuzzles),
    language: LANGUAGES.includes(settings.language as never) ? (settings.language as string) : null,
    muted: typeof settings.muted === 'boolean' ? settings.muted : null,
    gamification: isRecord(r.gamification) ? parseState(r.gamification, now) : null,
  };
}

const union = (a: string[], b: string[]): string[] => [...new Set([...a, ...b])].sort();
const sum = (days: Record<string, number>): number => Object.values(days).reduce((t, n) => t + n, 0);

export function mergeGamification(
  local: GamificationState | null,
  remote: GamificationState | null,
  now: Date,
): GamificationState | null {
  if (remote === null) return local;
  const r = refresh(remote, now);
  if (local === null) return r;
  const l = refresh(local, now);

  const xpByDay: Record<string, number> = { ...l.xpByDay };
  for (const [day, xp] of Object.entries(r.xpByDay)) xpByDay[day] = Math.max(xpByDay[day] ?? 0, xp);
  const older = Math.max(0, l.totalXp - sum(l.xpByDay), r.totalXp - sum(r.xpByDay));

  const laterGoal =
    (l.lastGoalDay ?? '') !== (r.lastGoalDay ?? '')
      ? (l.lastGoalDay ?? '') > (r.lastGoalDay ?? '')
        ? l
        : r
      : l.currentStreak >= r.currentStreak
        ? l
        : r;

  const fewerHearts =
    l.hearts !== r.hearts ? (l.hearts < r.hearts ? l : r) : l.heartsAnchor >= r.heartsAnchor ? l : r;

  return {
    totalXp: older + sum(xpByDay),
    xpByDay,
    hearts: fewerHearts.hearts,
    heartsAnchor: fewerHearts.heartsAnchor,
    dailyGoal: l.dailyGoal,
    currentStreak: laterGoal.currentStreak,
    lastGoalDay: laterGoal.lastGoalDay,
    bestStreak: Math.max(l.bestStreak, r.bestStreak, laterGoal.currentStreak),
  };
}

/** Merges the account's copy into the local copy (see the rule at the top of this file). */
export function mergeSnapshots(local: ProgressSnapshot, remote: ProgressSnapshot, now: Date): ProgressSnapshot {
  return {
    completedLessons: union(local.completedLessons, remote.completedLessons),
    solvedPuzzles: union(local.solvedPuzzles, remote.solvedPuzzles),
    language: local.language ?? remote.language,
    muted: local.muted ?? remote.muted,
    gamification: mergeGamification(local.gamification, remote.gamification, now),
  };
}

/**
 * A comparison key that ignores the hearts refill anchor, which moves on every refresh while hearts
 * are full. Used to skip writes, pushes and syncs when nothing meaningful changed.
 */
export function fingerprint(snapshot: ProgressSnapshot): string {
  const g = snapshot.gamification;
  return JSON.stringify({
    ...snapshot,
    completedLessons: [...snapshot.completedLessons].sort(),
    solvedPuzzles: [...snapshot.solvedPuzzles].sort(),
    gamification: g && { ...g, heartsAnchor: undefined, xpByDay: Object.entries(g.xpByDay).sort() },
  });
}
