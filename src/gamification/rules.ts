// Duolingo-style motivation rules: XP, hearts, daily goal and streak.
// Pure TypeScript, no React/DOM. Every function takes the current time explicitly so day boundaries,
// heart refills and clock changes are testable. Days are the device's LOCAL calendar date.
//
// Rules (see also docs/PLAN.md, Task 4):
// - XP: +10 for a lesson's first completion, +5 for replaying a completed lesson, +5 for a puzzle's
//   first solve (no difficulty bonus), 0 for a revealed solution or re-solving a puzzle.
// - Hearts: max 5. A wrong lesson answer costs 1 (never below 0). One heart comes back every
//   30 minutes after the last refill anchor, up to the max. Computed from timestamps only.
// - Daily goal: 10 / 20 / 30 / 50 XP (default 20). It is met when today's XP >= goal.
// - Streak: +1 for each consecutive local day on which the goal was met. If a whole day passes
//   without meeting it, the streak shown is 0 (and the next met day starts again at 1).
// - Clock going backwards: never grants hearts and never breaks or extends a streak.

export const MAX_HEARTS = 5;
export const HEART_REFILL_MS = 30 * 60 * 1000;
export const DAILY_GOALS = [10, 20, 30, 50] as const;
export type DailyGoal = (typeof DAILY_GOALS)[number];
export const DEFAULT_DAILY_GOAL: DailyGoal = 20;
/** Per-day XP older than this many days is dropped to keep the stored state small. */
export const XP_HISTORY_DAYS = 30;

export const XP_REWARDS = {
  lessonFirst: 10,
  lessonReplay: 5,
  puzzleFirst: 5,
  revealed: 0,
} as const;

export interface GamificationState {
  totalXp: number;
  /** XP earned per local day, keyed `YYYY-MM-DD`. */
  xpByDay: Record<string, number>;
  /** Hearts as of `heartsAnchor` (before any refill since then). */
  hearts: number;
  /** Timestamp (ms) refills are counted from. */
  heartsAnchor: number;
  dailyGoal: DailyGoal;
  /** Streak as of `lastGoalDay`; use `streakOn` for the streak today. */
  currentStreak: number;
  bestStreak: number;
  /** Last local day on which the daily goal was met. */
  lastGoalDay: string | null;
}

export interface GamificationSummary {
  totalXp: number;
  todayXp: number;
  dailyGoal: DailyGoal;
  goalMet: boolean;
  streak: number;
  bestStreak: number;
  hearts: number;
  maxHearts: number;
  /** Milliseconds until the next heart, or null when hearts are full. */
  nextHeartInMs: number | null;
}

export const isDailyGoal = (v: unknown): v is DailyGoal => DAILY_GOALS.includes(v as DailyGoal);

export function initialState(now: Date): GamificationState {
  return {
    totalXp: 0,
    xpByDay: {},
    hearts: MAX_HEARTS,
    heartsAnchor: now.getTime(),
    dailyGoal: DEFAULT_DAILY_GOAL,
    currentStreak: 0,
    bestStreak: 0,
    lastGoalDay: null,
  };
}

// ---------- Days ----------

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The device-local calendar date as `YYYY-MM-DD`. */
export function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const isDayKey = (s: unknown): s is string => typeof s === 'string' && DAY_KEY.test(s);

/** Whole calendar days from `a` to `b` (negative when b is earlier). DST-safe. */
export function daysBetween(a: string, b: string): number {
  const utc = (k: string) => {
    const [, y, m, d] = DAY_KEY.exec(k)!;
    return Date.UTC(Number(y), Number(m) - 1, Number(d));
  };
  return Math.round((utc(b) - utc(a)) / 86_400_000);
}

// ---------- XP ----------

export const lessonXp = (firstCompletion: boolean): number =>
  firstCompletion ? XP_REWARDS.lessonFirst : XP_REWARDS.lessonReplay;

export const puzzleXp = (firstSolve: boolean, revealed = false): number =>
  revealed || !firstSolve ? XP_REWARDS.revealed : XP_REWARDS.puzzleFirst;

export const xpOn = (state: GamificationState, day: string): number => state.xpByDay[day] ?? 0;

/** Adds XP to the total and to today, then updates the streak if today's goal is now met. */
export function addXp(state: GamificationState, amount: number, now: Date): GamificationState {
  if (!(amount > 0)) return state;
  const today = dayKey(now);
  const next = {
    ...state,
    totalXp: state.totalXp + amount,
    xpByDay: { ...state.xpByDay, [today]: xpOn(state, today) + amount },
  };
  return checkGoal(next, today);
}

/** Changes the daily goal; meeting the new (lower) goal today counts for the streak. */
export function setDailyGoal(state: GamificationState, goal: DailyGoal, now: Date): GamificationState {
  if (!isDailyGoal(goal)) return state;
  return checkGoal({ ...state, dailyGoal: goal }, dayKey(now));
}

function checkGoal(state: GamificationState, today: string): GamificationState {
  if (xpOn(state, today) < state.dailyGoal) return state;
  if (state.lastGoalDay !== null) {
    const gap = daysBetween(state.lastGoalDay, today);
    // Already counted today, or the clock is behind the last counted day: leave the streak alone.
    if (gap <= 0) return state;
    const currentStreak = gap === 1 ? state.currentStreak + 1 : 1;
    return { ...state, currentStreak, bestStreak: Math.max(state.bestStreak, currentStreak), lastGoalDay: today };
  }
  return { ...state, currentStreak: 1, bestStreak: Math.max(state.bestStreak, 1), lastGoalDay: today };
}

// ---------- Streak ----------

/** The streak as it stands on `today`: 0 once a whole day was missed. */
export function streakOn(state: GamificationState, today: string): number {
  if (state.lastGoalDay === null) return 0;
  // gap 0: met today; gap 1: met yesterday, today still open; gap < 0: clock went backwards.
  return daysBetween(state.lastGoalDay, today) <= 1 ? state.currentStreak : 0;
}

// ---------- Hearts ----------

/** Applies refills up to `now`. A clock that went backwards grants nothing and restarts the refill from `now`. */
export function syncHearts(state: GamificationState, now: Date): GamificationState {
  const t = now.getTime();
  if (state.hearts >= MAX_HEARTS) return { ...state, hearts: MAX_HEARTS, heartsAnchor: t };
  if (t < state.heartsAnchor) return { ...state, heartsAnchor: t };
  const gained = Math.floor((t - state.heartsAnchor) / HEART_REFILL_MS);
  const hearts = Math.min(MAX_HEARTS, state.hearts + gained);
  return { ...state, hearts, heartsAnchor: hearts >= MAX_HEARTS ? t : state.heartsAnchor + gained * HEART_REFILL_MS };
}

/** Costs one heart (never below 0). The refill clock starts when the first heart is lost. */
export function loseHeart(state: GamificationState, now: Date): GamificationState {
  const synced = syncHearts(state, now);
  return { ...synced, hearts: Math.max(0, synced.hearts - 1) };
}

/** Whole minutes (rounded up, at least 1) for "next heart in N min". */
export const minutesUntil = (ms: number): number => Math.max(1, Math.ceil(ms / 60_000));

export const canStartLesson = (state: GamificationState, now: Date): boolean => syncHearts(state, now).hearts > 0;

// ---------- Whole state ----------

/** Applies heart refills and drops per-day XP older than XP_HISTORY_DAYS. */
export function refresh(state: GamificationState, now: Date): GamificationState {
  const synced = syncHearts(state, now);
  const today = dayKey(now);
  const xpByDay = Object.fromEntries(Object.entries(synced.xpByDay).filter(([day]) => daysBetween(day, today) < XP_HISTORY_DAYS));
  return { ...synced, xpByDay };
}

export function summarize(state: GamificationState, now: Date): GamificationSummary {
  const s = syncHearts(state, now);
  const today = dayKey(now);
  const todayXp = xpOn(s, today);
  return {
    totalXp: s.totalXp,
    todayXp,
    dailyGoal: s.dailyGoal,
    goalMet: todayXp >= s.dailyGoal,
    streak: streakOn(s, today),
    bestStreak: s.bestStreak,
    hearts: s.hearts,
    maxHearts: MAX_HEARTS,
    nextHeartInMs: s.hearts >= MAX_HEARTS ? null : s.heartsAnchor + HEART_REFILL_MS - now.getTime(),
  };
}

/** Validates stored data field by field; anything missing or corrupt falls back to the default. */
export function parseState(raw: unknown, now: Date): GamificationState {
  const d = initialState(now);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return d;
  const r = raw as Record<string, unknown>;
  const count = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback);

  const xpByDay: Record<string, number> = {};
  if (typeof r.xpByDay === 'object' && r.xpByDay !== null && !Array.isArray(r.xpByDay)) {
    for (const [day, xp] of Object.entries(r.xpByDay)) {
      const n = count(xp, -1);
      if (isDayKey(day) && n > 0) xpByDay[day] = n;
    }
  }
  const currentStreak = count(r.currentStreak, 0);
  return {
    totalXp: count(r.totalXp, 0),
    xpByDay,
    hearts: Math.min(MAX_HEARTS, count(r.hearts, MAX_HEARTS)),
    heartsAnchor: typeof r.heartsAnchor === 'number' && Number.isFinite(r.heartsAnchor) ? r.heartsAnchor : d.heartsAnchor,
    dailyGoal: isDailyGoal(r.dailyGoal) ? r.dailyGoal : DEFAULT_DAILY_GOAL,
    currentStreak,
    bestStreak: Math.max(currentStreak, count(r.bestStreak, 0)),
    lastGoalDay: isDayKey(r.lastGoalDay) ? r.lastGoalDay : null,
  };
}
