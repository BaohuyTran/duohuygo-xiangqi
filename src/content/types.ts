/**
 * Lesson content format. Units live as static JSON in src/content/lessons/ (one file per unit,
 * loaded in file-name order). Every user-visible string is an i18n key into src/i18n/messages.ts.
 *
 * Squares use ICCS names ("e0" = Red general's start square). Lessons are always played as Red.
 */

/**
 * Either a full FEN or a square -> FEN-letter map such as { "e0": "K", "e9": "k" }.
 * Exercises are played as Red; only "learn" exercises may show Black to move (e.g. a finished checkmate).
 */
export type PositionSpec =
  | { fen: string; pieces?: never; turn?: never }
  | { pieces: Record<string, string>; turn?: 'red' | 'black'; fen?: never };

/** Board areas computed by the engine, so answers are not hard-coded. */
export type Region = 'red-palace' | 'black-palace' | 'red-side' | 'black-side';

/** Show a piece and its legal moves (from the engine), or highlight squares, with an explanation. */
export type LearnExercise = PositionSpec & {
  type: 'learn';
  text: string;
  /** Piece whose legal moves are highlighted. */
  square?: string;
  /** Extra squares to highlight, e.g. a region. */
  highlight?: string[] | Region;
  /** Set when `square` is intentionally a piece with no legal moves (e.g. a pinned piece). */
  allowNoMoves?: boolean;
};

/** Tap every square the piece on `square` can legally move to, or every point of `region`. */
export type SelectSquaresExercise = PositionSpec & {
  type: 'select-squares';
  prompt: string;
  explanation?: string;
} & ({ square: string; region?: never } | { region: Region; square?: never });

export type MoveGoal =
  /** Land on one of these squares. */
  | { kind: 'reach'; squares: string[] }
  /** Any legal move is correct; illegal attempts are rejected (e.g. "escape check"). */
  | { kind: 'any' }
  /** The move must give check. */
  | { kind: 'check' }
  /** The move must checkmate. */
  | { kind: 'checkmate' };

/** Make one move that satisfies `goal`. `solution` documents a correct answer and is verified in tests. */
export type MoveExercise = PositionSpec & {
  type: 'move';
  prompt: string;
  goal: MoveGoal;
  /** If set, only this piece may be moved. */
  from?: string;
  solution: { from: string; to: string };
  explanation?: string;
};

/**
 * Find the winning capture: the engine accepts any capture whose material gain (value taken minus
 * value lost to an immediate recapture) is positive and the best available. `solution` is verified.
 */
export type CaptureExercise = PositionSpec & {
  type: 'capture';
  prompt: string;
  solution: { from: string; to: string };
  explanation?: string;
};

export type Exercise = LearnExercise | SelectSquaresExercise | MoveExercise | CaptureExercise;
export type ExerciseType = Exercise['type'];

export interface Lesson {
  id: string;
  title: string;
  exercises: Exercise[];
}

export interface Unit {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
}
