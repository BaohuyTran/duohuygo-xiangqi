import { describe, expect, it } from 'vitest';
import { createGamificationRepository, createMemoryStore } from '../storage';
import { createGamification } from './service';

describe('createGamification', () => {
  it('awards XP, costs hearts and persists through the store with an injected clock', () => {
    const store = createMemoryStore();
    let now = new Date(2026, 4, 10, 9, 0);
    const game = createGamification(createGamificationRepository(store), () => now);

    expect(game.completeLesson(true)).toBe(10);
    expect(game.completeLesson(false)).toBe(5);
    expect(game.solvePuzzle(true)).toBe(5);
    expect(game.solvePuzzle(false)).toBe(0);
    expect(game.summary()).toMatchObject({ totalXp: 20, todayXp: 20, goalMet: true, streak: 1 });

    for (let i = 0; i < 5; i++) game.loseHeart();
    expect(game.canStartLesson()).toBe(false);
    now = new Date(2026, 4, 10, 9, 30);
    expect(game.canStartLesson()).toBe(true);

    game.setDailyGoal(50);
    // A second instance on the same store sees everything.
    const again = createGamification(createGamificationRepository(store), () => now);
    expect(again.summary()).toMatchObject({ totalXp: 20, dailyGoal: 50, hearts: 1, streak: 1 });
    expect(JSON.parse(store.get('gamification.state.v1')!)).toMatchObject({ totalXp: 20, dailyGoal: 50 });
  });

  it('starts from defaults when the stored state is corrupt', () => {
    const store = createMemoryStore({ 'gamification.state.v1': '{broken' });
    const game = createGamification(createGamificationRepository(store), () => new Date(2026, 0, 1));
    expect(game.summary()).toMatchObject({ totalXp: 0, hearts: 5, dailyGoal: 20, streak: 0, nextHeartInMs: null });
  });
});
