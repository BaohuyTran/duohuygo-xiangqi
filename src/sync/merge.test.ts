import { describe, expect, it } from 'vitest';
import { HEART_REFILL_MS, initialState, MAX_HEARTS, type GamificationState } from '../gamification';
import type { ProgressSnapshot } from '../storage';
import { fingerprint, mergeGamification, mergeSnapshots, parseRemote, REMOTE_VERSION, toRemote } from './merge';

const NOW = new Date(2026, 9, 16, 12, 0, 0);
const T = NOW.getTime();

const game = (patch: Partial<GamificationState> = {}): GamificationState => ({ ...initialState(NOW), ...patch });
const snap = (patch: Partial<ProgressSnapshot> = {}): ProgressSnapshot => ({
  completedLessons: [],
  solvedPuzzles: [],
  language: null,
  muted: null,
  gamification: null,
  ...patch,
});

describe('merge rule: id sets', () => {
  it('takes the union of completed lessons and solved puzzles (sorted, no duplicates)', () => {
    const m = mergeSnapshots(
      snap({ completedLessons: ['u1l2', 'u1l1'], solvedPuzzles: ['p3'] }),
      snap({ completedLessons: ['u1l1', 'u2l1'], solvedPuzzles: ['p1', 'p3'] }),
      NOW,
    );
    expect(m.completedLessons).toEqual(['u1l1', 'u1l2', 'u2l1']);
    expect(m.solvedPuzzles).toEqual(['p1', 'p3']);
  });

  it('never drops a local id when the account has none', () => {
    const m = mergeSnapshots(snap({ completedLessons: ['u1l1'] }), snap(), NOW);
    expect(m.completedLessons).toEqual(['u1l1']);
  });
});

describe('merge rule: XP', () => {
  it('takes the per-day maximum (no double counting) and keeps the total consistent', () => {
    const local = game({ totalXp: 30, xpByDay: { '2026-10-15': 10, '2026-10-16': 20 } });
    const remote = game({ totalXp: 35, xpByDay: { '2026-10-14': 5, '2026-10-16': 30 } });
    const m = mergeGamification(local, remote, NOW)!;
    expect(m.xpByDay).toEqual({ '2026-10-14': 5, '2026-10-15': 10, '2026-10-16': 30 });
    expect(m.totalXp).toBe(45);
  });

  it('keeps XP older than the per-day history (never below either total)', () => {
    // Local has 100 XP from long ago (pruned from xpByDay) + 10 today; remote has 20 today.
    const local = game({ totalXp: 110, xpByDay: { '2026-10-16': 10 } });
    const remote = game({ totalXp: 20, xpByDay: { '2026-10-16': 20 } });
    const m = mergeGamification(local, remote, NOW)!;
    expect(m.totalXp).toBe(120);
    expect(m.totalXp).toBeGreaterThanOrEqual(local.totalXp);
    expect(m.totalXp).toBeGreaterThanOrEqual(remote.totalXp);
  });

  it('prunes days older than the history window on both sides before merging', () => {
    const remote = game({ totalXp: 50, xpByDay: { '2026-01-01': 50 } });
    const m = mergeGamification(game(), remote, NOW)!;
    expect(m.xpByDay).toEqual({});
    expect(m.totalXp).toBe(50);
  });
});

describe('merge rule: streak', () => {
  it('the later goal day wins; best streak is the maximum', () => {
    const local = game({ currentStreak: 3, bestStreak: 9, lastGoalDay: '2026-10-15' });
    const remote = game({ currentStreak: 4, bestStreak: 4, lastGoalDay: '2026-10-16' });
    const m = mergeGamification(local, remote, NOW)!;
    expect(m).toMatchObject({ currentStreak: 4, lastGoalDay: '2026-10-16', bestStreak: 9 });
  });

  it('on the same goal day the longer streak wins', () => {
    const local = game({ currentStreak: 2, bestStreak: 2, lastGoalDay: '2026-10-16' });
    const remote = game({ currentStreak: 5, bestStreak: 5, lastGoalDay: '2026-10-16' });
    expect(mergeGamification(local, remote, NOW)).toMatchObject({ currentStreak: 5, bestStreak: 5 });
  });

  it('a side that never met a goal does not reset the streak', () => {
    const local = game({ currentStreak: 3, bestStreak: 3, lastGoalDay: '2026-10-16' });
    expect(mergeGamification(local, game(), NOW)).toMatchObject({ currentStreak: 3, lastGoalDay: '2026-10-16' });
    expect(mergeGamification(game(), local, NOW)).toMatchObject({ currentStreak: 3, lastGoalDay: '2026-10-16' });
  });
});

describe('merge rule: hearts', () => {
  it('never grants hearts: the side with fewer hearts wins', () => {
    const local = game({ hearts: 1, heartsAnchor: T - 60_000 });
    const remote = game({ hearts: MAX_HEARTS, heartsAnchor: T });
    expect(mergeGamification(local, remote, NOW)).toMatchObject({ hearts: 1, heartsAnchor: T - 60_000 });
    // A device that lost hearts elsewhere loses them here too.
    expect(mergeGamification(remote, local, NOW)).toMatchObject({ hearts: 1 });
  });

  it('refills both sides by time first, so a stale remote cannot take back refilled hearts', () => {
    const local = game({ hearts: MAX_HEARTS, heartsAnchor: T });
    const stale = game({ hearts: 4, heartsAnchor: T - HEART_REFILL_MS - 1000 });
    expect(mergeGamification(local, stale, NOW)).toMatchObject({ hearts: MAX_HEARTS });
  });

  it('a remote anchor in the future grants nothing', () => {
    const remote = game({ hearts: 2, heartsAnchor: T + 10 * HEART_REFILL_MS });
    expect(mergeGamification(game(), remote, NOW)).toMatchObject({ hearts: 2 });
  });
});

describe('merge rule: preferences', () => {
  it('local language, sound and daily goal win', () => {
    const m = mergeSnapshots(
      snap({ language: 'en', muted: false, gamification: game({ dailyGoal: 10 }) }),
      snap({ language: 'vi', muted: true, gamification: game({ dailyGoal: 50 }) }),
      NOW,
    );
    expect(m.language).toBe('en');
    expect(m.muted).toBe(false);
    expect(m.gamification!.dailyGoal).toBe(10);
  });

  it('the account values fill in what this device has not stored yet', () => {
    const remote = snap({ language: 'vi', muted: true, gamification: game({ dailyGoal: 50, totalXp: 7 }) });
    const m = mergeSnapshots(snap(), remote, NOW);
    expect(m).toMatchObject({ language: 'vi', muted: true });
    expect(m.gamification).toMatchObject({ dailyGoal: 50, totalXp: 7 });
  });
});

describe('merge rule: properties', () => {
  const local = snap({
    completedLessons: ['u1l1', 'u1l2'],
    solvedPuzzles: ['p2'],
    language: 'vi',
    muted: true,
    gamification: game({
      totalXp: 80,
      xpByDay: { '2026-10-15': 20, '2026-10-16': 15 },
      hearts: 3,
      heartsAnchor: T - 5 * 60_000,
      currentStreak: 2,
      bestStreak: 4,
      lastGoalDay: '2026-10-15',
    }),
  });
  const remote = snap({
    completedLessons: ['u1l1', 'u3l1'],
    solvedPuzzles: ['p1'],
    language: 'en',
    muted: false,
    gamification: game({
      totalXp: 60,
      xpByDay: { '2026-10-14': 10, '2026-10-16': 25 },
      hearts: 4,
      heartsAnchor: T - 60_000,
      currentStreak: 3,
      bestStreak: 3,
      lastGoalDay: '2026-10-16',
    }),
  });

  it('is idempotent', () => {
    const once = mergeSnapshots(local, remote, NOW);
    expect(mergeSnapshots(once, remote, NOW)).toEqual(once);
    expect(mergeSnapshots(once, once, NOW)).toEqual(once);
    expect(mergeSnapshots(once, local, NOW)).toEqual(once);
  });

  it('is commutative except for the per-device preferences', () => {
    const ab = mergeSnapshots(local, remote, NOW);
    const ba = mergeSnapshots(remote, local, NOW);
    const strip = (s: ProgressSnapshot) => ({ ...s, language: null, muted: null, gamification: { ...s.gamification!, dailyGoal: 0 } });
    expect(strip(ab)).toEqual(strip(ba));
  });

  it('never loses progress from either side', () => {
    const m = mergeSnapshots(local, remote, NOW);
    for (const side of [local, remote]) {
      for (const id of side.completedLessons) expect(m.completedLessons).toContain(id);
      for (const id of side.solvedPuzzles) expect(m.solvedPuzzles).toContain(id);
      const g = side.gamification!;
      expect(m.gamification!.totalXp).toBeGreaterThanOrEqual(g.totalXp);
      expect(m.gamification!.bestStreak).toBeGreaterThanOrEqual(g.bestStreak);
      for (const [day, xp] of Object.entries(g.xpByDay)) expect(m.gamification!.xpByDay[day]).toBeGreaterThanOrEqual(xp);
    }
    expect(m.gamification!.hearts).toBe(3);
  });

  it('round-trips through the account JSON', () => {
    const m = mergeSnapshots(local, remote, NOW);
    const json = JSON.parse(JSON.stringify(toRemote(m)));
    expect(json.version).toBe(REMOTE_VERSION);
    expect(parseRemote(json, NOW)).toEqual(m);
  });
});

describe('corrupt or missing remote data', () => {
  it.each([null, undefined, 42, 'text', [], {}, { version: 99 }])('%j merges as "nothing" and keeps local intact', (raw) => {
    const local = snap({ completedLessons: ['u1l1'], language: 'vi', muted: true, gamification: game({ totalXp: 10, hearts: 2 }) });
    const remote = parseRemote(raw, NOW);
    expect(remote).toEqual(snap());
    const m = mergeSnapshots(local, remote, NOW);
    expect(m).toEqual(local);
  });

  it('drops wrongly typed fields one by one', () => {
    const remote = parseRemote(
      {
        completedLessons: ['u1l1', 7, null, '', 'u1l2'],
        solvedPuzzles: 'p1',
        settings: { language: 'fr', muted: 'yes' },
        gamification: { totalXp: -5, hearts: 99, xpByDay: { bad: 3, '2026-10-16': 'x' }, bestStreak: 'a', dailyGoal: 7 },
      },
      NOW,
    );
    expect(remote.completedLessons).toEqual(['u1l1', 'u1l2']);
    expect(remote.solvedPuzzles).toEqual([]);
    expect(remote.language).toBeNull();
    expect(remote.muted).toBeNull();
    expect(remote.gamification).toMatchObject({ totalXp: 0, hearts: MAX_HEARTS, xpByDay: {}, bestStreak: 0, dailyGoal: 20 });
    // Corrupt remote gamification cannot lower local XP or grant hearts.
    const m = mergeGamification(game({ totalXp: 40, xpByDay: { '2026-10-16': 40 }, hearts: 1 }), remote.gamification, NOW)!;
    expect(m).toMatchObject({ totalXp: 40, hearts: 1 });
  });
});

describe('fingerprint', () => {
  it('ignores the hearts refill anchor and id order, but not real changes', () => {
    const a = snap({ completedLessons: ['b', 'a'], gamification: game({ heartsAnchor: 1 }) });
    const b = snap({ completedLessons: ['a', 'b'], gamification: game({ heartsAnchor: 2 }) });
    expect(fingerprint(a)).toBe(fingerprint(b));
    expect(fingerprint(a)).not.toBe(fingerprint({ ...a, solvedPuzzles: ['p1'] }));
    expect(fingerprint(a)).not.toBe(fingerprint({ ...a, gamification: game({ hearts: 4 }) }));
  });
});

describe('module boundaries', () => {
  const sources = import.meta.glob(['../**/*.ts', '../**/*.tsx', '!../**/*.test.ts', '!../**/*.test.tsx'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;

  it('only src/sync/supabase.ts imports Supabase (UI components never do)', () => {
    const importers = Object.entries(sources)
      .filter(([, text]) => text.includes('@supabase/'))
      .map(([path]) => path);
    expect(Object.keys(sources).length).toBeGreaterThan(20);
    expect(importers).toEqual(['./supabase.ts']);
  });

  it('nothing statically imports src/sync/supabase.ts (it is loaded with a dynamic import only)', () => {
    for (const [path, text] of Object.entries(sources)) {
      expect(text, path).not.toMatch(/from\s+['"][./]*(sync\/)?supabase['"]/);
    }
  });

  it('the merge rule and sync service have no React or DOM storage imports', () => {
    for (const path of ['./merge.ts', './service.ts']) {
      expect(sources[path], path).not.toMatch(/from\s+['"]react|localStorage|document\./);
    }
  });
});
