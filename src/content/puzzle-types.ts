/**
 * Puzzle content format. Puzzles live as static JSON in src/content/puzzles/, one file per goal,
 * each ordered by difficulty. Validated by src/content/validate-puzzles.ts (run in the tests).
 */

export type PuzzleGoal = 'mate-in-1' | 'mate-in-2' | 'win-material';

export const PUZZLE_GOALS: readonly PuzzleGoal[] = ['mate-in-1', 'mate-in-2', 'win-material'];

export type PuzzleTheme =
  | 'chariot'
  | 'horse'
  | 'cannon'
  | 'soldier'
  | 'double-check'
  | 'flying-general'
  | 'fork'
  | 'sacrifice';

export const PUZZLE_THEMES: readonly PuzzleTheme[] = [
  'chariot',
  'horse',
  'cannon',
  'soldier',
  'double-check',
  'flying-general',
  'fork',
  'sacrifice',
];

/** One ply of the solution. Player moves may carry a hint (an i18n key from src/i18n/messages.ts). */
export interface PuzzleStep {
  from: string;
  to: string;
  hint?: string;
}

export interface Puzzle {
  id: string;
  fen: string;
  /** Must match the FEN. Every current puzzle is Red to move. */
  sideToMove: 'red' | 'black';
  goal: PuzzleGoal;
  /** 1 (easiest) to 5. */
  difficulty: number;
  theme: PuzzleTheme;
  /**
   * The main line, alternating player and defender moves:
   * mate-in-1: [player] · mate-in-2: [player, best defence, mating move] ·
   * win-material: [winning capture] or [player, best defence, winning capture].
   */
  solution: PuzzleStep[];
  /** Other first moves that also achieve the goal and are accepted as correct (normally absent). */
  alternatives?: { from: string; to: string }[];
}
