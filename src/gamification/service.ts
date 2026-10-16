import {
  addXp,
  canStartLesson,
  lessonXp,
  loseHeart,
  puzzleXp,
  refresh,
  setDailyGoal,
  summarize,
  type DailyGoal,
  type GamificationState,
  type GamificationSummary,
} from './rules';

/** Where the state lives. Implemented by `createGamificationRepository` in src/storage. */
export interface GamificationRepository {
  load(now: Date): GamificationState;
  save(state: GamificationState): void;
}

export interface Gamification {
  summary(): GamificationSummary;
  /** Applies heart refills, saves, and returns the new summary. */
  refresh(): GamificationSummary;
  canStartLesson(): boolean;
  /** Awards and saves lesson XP; returns the XP earned. */
  completeLesson(firstCompletion: boolean): number;
  /** Awards and saves puzzle XP; returns the XP earned (0 when already solved). */
  solvePuzzle(firstSolve: boolean): number;
  loseHeart(): void;
  setDailyGoal(goal: DailyGoal): void;
}

/** Loads, applies a rule, and saves. React-free; the clock is injectable for tests. */
export function createGamification(repo: GamificationRepository, now: () => Date = () => new Date()): Gamification {
  const current = (at: Date) => refresh(repo.load(at), at);
  const update = (fn: (s: GamificationState, at: Date) => GamificationState) => {
    const at = now();
    repo.save(fn(current(at), at));
  };
  const summary = () => {
    const at = now();
    return summarize(current(at), at);
  };
  return {
    summary,
    refresh() {
      update((s) => s);
      return summary();
    },
    canStartLesson: () => {
      const at = now();
      return canStartLesson(current(at), at);
    },
    completeLesson(first) {
      const xp = lessonXp(first);
      update((s, at) => addXp(s, xp, at));
      return xp;
    },
    solvePuzzle(first) {
      const xp = puzzleXp(first);
      update((s, at) => addXp(s, xp, at));
      return xp;
    },
    loseHeart: () => update(loseHeart),
    setDailyGoal: (goal) => update((s, at) => setDailyGoal(s, goal, at)),
  };
}
