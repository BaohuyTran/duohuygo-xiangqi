import type { Puzzle, PuzzleGoal } from '../content/puzzle-types';

// Every puzzle file in src/content/puzzles (one per goal).
const files = import.meta.glob<Puzzle[]>('../content/puzzles/*.json', { eager: true, import: 'default' });

const GOAL_ORDER: PuzzleGoal[] = ['mate-in-1', 'mate-in-2', 'win-material'];

/** All puzzles in play order: easiest first, then by goal, then by id. */
export const puzzles: Puzzle[] = Object.values(files)
  .flat()
  .sort(
    (a, b) =>
      a.difficulty - b.difficulty || GOAL_ORDER.indexOf(a.goal) - GOAL_ORDER.indexOf(b.goal) || a.id.localeCompare(b.id),
  );

export const findPuzzle = (id: string): Puzzle | undefined => puzzles.find((p) => p.id === id);

/** 1-based number shown to the player. */
export const puzzleNumber = (id: string): number => puzzles.findIndex((p) => p.id === id) + 1;

/** The next puzzle in play order, preferring unsolved ones; null when everything after is solved. */
export function nextPuzzle(id: string, solved: ReadonlySet<string>): Puzzle | null {
  const i = puzzles.findIndex((p) => p.id === id);
  const after = [...puzzles.slice(i + 1), ...puzzles.slice(0, i)];
  return after.find((p) => !solved.has(p.id)) ?? null;
}
