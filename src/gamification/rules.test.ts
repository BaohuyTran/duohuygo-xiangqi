import { describe, expect, it } from 'vitest';
import {
  addXp,
  canStartLesson,
  dayKey,
  daysBetween,
  HEART_REFILL_MS,
  initialState,
  lessonXp,
  loseHeart,
  MAX_HEARTS,
  parseState,
  puzzleXp,
  refresh,
  setDailyGoal,
  streakOn,
  summarize,
  syncHearts,
  type GamificationState,
} from './rules';

// Local-time dates (the rules use the device's local calendar).
const at = (day: number, h = 12, m = 0) => new Date(2026, 0, day, h, m);
const MIN = 60 * 1000;

const lose = (s: GamificationState, n: number, now: Date) => {
  for (let i = 0; i < n; i++) s = loseHeart(s, now);
  return s;
};

describe('days', () => {
  it('uses the local calendar date', () => {
    expect(dayKey(new Date(2026, 0, 5, 0, 0))).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 0, 5, 23, 59, 59))).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  it('counts calendar days across months and years', () => {
    expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1);
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
    expect(daysBetween('2026-03-01', '2026-03-29')).toBe(28);
    expect(daysBetween('2026-01-02', '2026-01-01')).toBe(-1);
  });
});

describe('XP', () => {
  it('gives 10 for a first lesson completion, 5 for a replay, 5 for a first puzzle solve, 0 for a reveal', () => {
    expect(lessonXp(true)).toBe(10);
    expect(lessonXp(false)).toBe(5);
    expect(puzzleXp(true)).toBe(5);
    expect(puzzleXp(false)).toBe(0);
    expect(puzzleXp(true, true)).toBe(0);
  });

  it('stores the total and the XP per day', () => {
    let s = initialState(at(1));
    s = addXp(s, 10, at(1, 9));
    s = addXp(s, 5, at(1, 23, 59));
    s = addXp(s, 5, at(2, 0, 0));
    expect(s.totalXp).toBe(20);
    expect(s.xpByDay).toEqual({ '2026-01-01': 15, '2026-01-02': 5 });
    expect(addXp(s, 0, at(2))).toBe(s);
  });

  it('drops per-day XP older than 30 days but keeps the total', () => {
    let s = addXp(initialState(at(1)), 10, at(1));
    s = refresh(addXp(s, 5, at(30)), at(30));
    expect(s.xpByDay).toEqual({ '2026-01-01': 10, '2026-01-30': 5 });
    s = refresh(s, at(31));
    expect(s.xpByDay).toEqual({ '2026-01-30': 5 });
    expect(s.totalXp).toBe(15);
  });
});

describe('hearts', () => {
  it('starts full and costs one per wrong answer, never below 0', () => {
    let s = initialState(at(1));
    expect(summarize(s, at(1)).hearts).toBe(MAX_HEARTS);
    s = lose(s, 7, at(1));
    expect(s.hearts).toBe(0);
    expect(canStartLesson(s, at(1))).toBe(false);
  });

  it('refills one heart every 30 minutes after the first loss', () => {
    const t0 = at(1, 10);
    let s = lose(initialState(at(1, 8)), 2, t0);
    expect(summarize(s, t0)).toMatchObject({ hearts: 3, nextHeartInMs: HEART_REFILL_MS });
    expect(summarize(s, at(1, 10, 29)).hearts).toBe(3);
    expect(summarize(s, at(1, 10, 30))).toMatchObject({ hearts: 4, nextHeartInMs: HEART_REFILL_MS });
    expect(summarize(s, at(1, 10, 45))).toMatchObject({ hearts: 4, nextHeartInMs: 15 * MIN });
    // A loss during refill keeps the partial progress toward the next heart.
    s = loseHeart(s, at(1, 10, 45));
    expect(summarize(s, at(1, 10, 45))).toMatchObject({ hearts: 3, nextHeartInMs: 15 * MIN });
    expect(summarize(s, at(1, 11, 0)).hearts).toBe(4);
  });

  it('caps the refill at the maximum and restarts the timer from a full bar', () => {
    let s = lose(initialState(at(1)), 5, at(1, 8));
    expect(canStartLesson(s, at(1, 8, 29))).toBe(false);
    expect(canStartLesson(s, at(1, 8, 30))).toBe(true);
    expect(summarize(s, at(1, 20))).toMatchObject({ hearts: MAX_HEARTS, nextHeartInMs: null });
    s = syncHearts(s, at(1, 20));
    expect(s.hearts).toBe(MAX_HEARTS);
    s = loseHeart(s, at(1, 21));
    // Refill starts at the new loss, not at the old anchor.
    expect(summarize(s, at(1, 21, 29)).hearts).toBe(4);
    expect(summarize(s, at(1, 21, 30)).hearts).toBe(5);
  });

  it('never grants hearts when the clock goes backwards', () => {
    let s = lose(initialState(at(5)), 5, at(5, 12));
    // Clock set back a day: nothing gained, and the refill restarts from the new "now".
    expect(summarize(s, at(4, 12)).hearts).toBe(0);
    s = syncHearts(s, at(4, 12));
    expect(s).toMatchObject({ hearts: 0, heartsAnchor: at(4, 12).getTime() });
    expect(summarize(s, at(4, 12, 29)).hearts).toBe(0);
    expect(summarize(s, at(4, 12, 30)).hearts).toBe(1);
  });
});

describe('daily goal and streak', () => {
  it('defaults to 20 XP and is met when today’s XP reaches the goal', () => {
    let s = initialState(at(1));
    expect(summarize(s, at(1)).dailyGoal).toBe(20);
    s = addXp(s, 10, at(1));
    expect(summarize(s, at(1))).toMatchObject({ todayXp: 10, goalMet: false, streak: 0 });
    s = addXp(s, 10, at(1));
    expect(summarize(s, at(1))).toMatchObject({ todayXp: 20, goalMet: true, streak: 1, bestStreak: 1 });
    // More XP the same day does not count twice.
    s = addXp(s, 10, at(1));
    expect(summarize(s, at(1)).streak).toBe(1);
  });

  it('only accepts 10 / 20 / 30 / 50, and a lower goal can complete today', () => {
    let s = addXp(initialState(at(1)), 10, at(1));
    s = setDailyGoal(s, 30, at(1));
    expect(s.dailyGoal).toBe(30);
    expect(setDailyGoal(s, 25 as never, at(1))).toBe(s);
    s = setDailyGoal(s, 10, at(1));
    expect(summarize(s, at(1))).toMatchObject({ goalMet: true, streak: 1 });
  });

  it('counts consecutive days across midnight', () => {
    let s = setDailyGoal(initialState(at(1)), 10, at(1));
    s = addXp(s, 10, at(1, 23, 59));
    s = addXp(s, 10, at(2, 0, 1));
    expect(summarize(s, at(2, 0, 1)).streak).toBe(2);
    // Next day, goal not met yet: the streak still shows 2 until the day is over.
    expect(summarize(s, at(3, 23, 59)).streak).toBe(2);
    s = addXp(s, 10, at(3, 23, 59));
    expect(summarize(s, at(3, 23, 59))).toMatchObject({ streak: 3, bestStreak: 3 });
  });

  it('resets to 0 after a missed day and keeps the best streak', () => {
    let s = setDailyGoal(initialState(at(1)), 10, at(1));
    s = addXp(s, 10, at(1));
    s = addXp(s, 10, at(2));
    expect(summarize(s, at(4, 0, 0))).toMatchObject({ streak: 0, bestStreak: 2 });
    s = addXp(s, 10, at(4));
    expect(summarize(s, at(4))).toMatchObject({ streak: 1, bestStreak: 2 });
  });

  it('a day with XP below the goal does not continue the streak', () => {
    let s = setDailyGoal(initialState(at(1)), 20, at(1));
    s = addXp(s, 20, at(1));
    s = addXp(s, 10, at(2));
    expect(summarize(s, at(3)).streak).toBe(0);
  });

  it('does not break or extend the streak when the clock goes backwards', () => {
    let s = setDailyGoal(initialState(at(1)), 10, at(1));
    s = addXp(s, 10, at(9));
    s = addXp(s, 10, at(10));
    expect(streakOn(s, '2026-01-10')).toBe(2);
    // Clock back to day 3: streak shown unchanged; XP is recorded but does not touch the streak.
    expect(summarize(s, at(3)).streak).toBe(2);
    s = addXp(s, 10, at(3));
    expect(s).toMatchObject({ currentStreak: 2, lastGoalDay: '2026-01-10' });
    expect(s.xpByDay['2026-01-03']).toBe(10);
    // Back to the right date: continues normally.
    s = addXp(s, 10, at(11));
    expect(summarize(s, at(11)).streak).toBe(3);
  });
});

describe('parseState', () => {
  it('falls back to defaults for missing or corrupt data', () => {
    const now = at(1);
    const d = initialState(now);
    expect(parseState(null, now)).toEqual(d);
    expect(parseState('x', now)).toEqual(d);
    expect(parseState([1, 2], now)).toEqual(d);
    expect(
      parseState(
        { totalXp: -3, hearts: 99, heartsAnchor: 'soon', dailyGoal: 25, currentStreak: 'a', bestStreak: null, lastGoalDay: 'yesterday', xpByDay: { '2026-01-01': 5, bad: 3, '2026-01-02': 'x' } },
        now,
      ),
    ).toEqual({ ...d, hearts: MAX_HEARTS, xpByDay: { '2026-01-01': 5 } });
  });

  it('keeps valid data and the best streak is never below the current one', () => {
    const s = parseState(
      { totalXp: 42, hearts: 2, heartsAnchor: 1000, dailyGoal: 50, currentStreak: 4, bestStreak: 1, lastGoalDay: '2026-01-01', xpByDay: {} },
      at(1),
    );
    expect(s).toEqual({ totalXp: 42, hearts: 2, heartsAnchor: 1000, dailyGoal: 50, currentStreak: 4, bestStreak: 4, lastGoalDay: '2026-01-01', xpByDay: {} });
  });
});

describe('gamification purity', () => {
  it('has no React, DOM storage or other UI imports', () => {
    const sources = import.meta.glob(['./*.ts', '!./*.test.ts'], { query: '?raw', import: 'default', eager: true });
    const offenders = Object.entries(sources)
      .filter(([, src]) => /from\s+['"](react|react-dom)(\/[^'"]*)?['"]|localStorage|document\.|window\./.test(src as string))
      .map(([path]) => path);
    expect(Object.keys(sources).length).toBeGreaterThanOrEqual(3);
    expect(offenders).toEqual([]);
  });
});
