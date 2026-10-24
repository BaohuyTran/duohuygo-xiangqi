/**
 * Lesson content format. Units live as static JSON in src/content/lessons/ (one file per unit,
 * loaded in file-name order). Every user-visible string is an i18n key into src/i18n/messages.ts.
 *
 * Squares use ICCS names ("e0" = Red general's start square). Exercises are played by `side`
 * (default Red; the legacy course is Red only).
 *
 * Two kinds of unit share this format (src/content/validate.ts):
 * - legacy units (ids `u1`–`u15`, lessons `u<n>l<k>`): every metadata field below is optional;
 * - new-course units (ids per 02-curriculum.md §3.3: `b05`, lessons `b05l2`, items `b05l2-04`, pool items
 *   `b05-p03`): every exercise must carry `ExerciseMeta`, and no id may appear in src/content/retired-ids.json.
 */
import type { Predicate } from '../analysis/judge';

/** Content statuses (07-sourcing.md §6): draft -> verified -> reviewed -> published; retired = id reserved. */
export const CONTENT_STATUSES = ['draft', 'verified', 'reviewed', 'published', 'retired'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** Competency strands (02-curriculum.md §3.1). */
export const STRANDS = ['RS', 'TC', 'OD', 'PA', 'DE', 'PP'] as const;
export type Strand = (typeof STRANDS)[number];

/** Where a position comes from (07-sourcing.md §2.1). */
export const SOURCE_KINDS = ['generated', 'authored', 'derived', 'course-game', 'legacy'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/** Recorded transformations of a `derived` item (07-sourcing.md §2.1). */
export const TRANSFORMS = ['colour-swap', 'file-mirror', 'after-moves', 'edit-pieces'] as const;
export type Transform = (typeof TRANSFORMS)[number];

/** A checked reference (07-sourcing.md §2.2): added only after a reviewer opened the source. */
export interface Citation {
  title: string;
  author?: string;
  edition?: string;
  year?: number;
  /** "art. 23", "p. 41". */
  locator: string;
  checkedBy: string;
  /** ISO date, YYYY-MM-DD. */
  checkedAt: string;
}

/**
 * Provenance of an item. Required fields per kind: `generated` -> `generator` + `seed`;
 * `derived` -> `derivedFrom` (an item id or legacy ref) + `transform`; `course-game` -> `gameId` +
 * `moveNumber`; `legacy` -> `legacyRef` (`u7l1#2` = 0-based index into the old lesson's exercises, or a
 * puzzle id `m2-07`). `authored` needs nothing extra.
 */
export interface Source {
  kind: SourceKind;
  generator?: string;
  /** Generator version string (07-sourcing.md §7). */
  generatorVersion?: string;
  seed?: string | number;
  derivedFrom?: string;
  transform?: Transform[];
  legacyRef?: string;
  gameId?: string;
  moveNumber?: number;
  refs?: Citation[];
}

/**
 * Per-item metadata (07-sourcing.md §5.1, 03-assessment.md §4.2 rule 9). Optional on legacy exercises.
 * On new-course exercises `id`, `version`, `status`, `source` and `side` are required on every item;
 * `strand`, `nature`, `critical` and `misconceptions` on every item except `learn` cards.
 */
export interface ExerciseMeta {
  /** `<lessonId>-NN` in a lesson, `<unitId>-pNN` in a unit pool. Never reused. */
  id?: string;
  /** Integer ≥ 1, incremented on a substantive change (07-sourcing.md §7). */
  version?: number;
  status?: ContentStatus;
  source?: Source;
  /** The side the learner plays; it must be the side to move. Default `red`. */
  side?: 'red' | 'black';
  strand?: Strand;
  /** `tactic` (a forcing idea decides) or `quiet` (no tactic; improve, prepare, defend). */
  nature?: 'tactic' | 'quiet';
  /** Safety-critical item (03-assessment.md §3: a miss blocks mastery). */
  critical?: boolean;
  /** Misconception ids (`b06.m2`) that wrong answers of this item tag. May be empty. */
  misconceptions?: string[];
  /**
   * Assistance level (02-curriculum.md §5.2): G3 demonstrate, G2 guided, G1 prompted, G0 independent,
   * TR transfer. Required on `decision` and `choice` items. Items at G1, G0 or TR that ask for a move
   * (`move`, `capture`, `combination`, `decision`) need `feedback`.
   */
  assist?: AssistLevel;
  /** The four feedback parts of 02-curriculum.md §7 (required for G1/G0/TR move items, see `assist`). */
  feedback?: ItemFeedback;
}

export const ASSIST_LEVELS = ['G3', 'G2', 'G1', 'G0', 'TR'] as const;
export type AssistLevel = (typeof ASSIST_LEVELS)[number];

/**
 * Feedback of a move item (02-curriculum.md §7). Every field is an i18n key.
 * - `purpose`: what the right move achieves HERE (shown when correct);
 * - `keyReply`: the opponent's most important reply to it (shown when correct);
 * - `commonError`: the error behind the most common wrong answer (shown when wrong);
 * - `temptingAlternative`: the most tempting wrong move (ICCS `from-to`, must be a move the item rejects)
 *   and why it fails; its text replaces `commonError` when the learner plays exactly that move.
 */
export interface ItemFeedback {
  purpose: string;
  keyReply: string;
  commonError: string;
  temptingAlternative: { move: string; text: string };
}

/**
 * Either a full FEN or a square -> FEN-letter map such as { "e0": "K", "e9": "k" }.
 * The side to move must be the exercise's `side` (default Red); only "learn" exercises may show the other
 * side to move (e.g. a finished checkmate).
 */
export type PositionSpec =
  | { fen: string; pieces?: never; turn?: never }
  | { pieces: Record<string, string>; turn?: 'red' | 'black'; fen?: never };

/** Board areas computed by the engine, so answers are not hard-coded. */
export type Region = 'red-palace' | 'black-palace' | 'red-side' | 'black-side';

/** Show a piece and its legal moves (from the engine), or highlight squares, with an explanation. */
export type LearnExercise = PositionSpec & ExerciseMeta & {
  type: 'learn';
  text: string;
  /** Piece whose legal moves are highlighted. */
  square?: string;
  /** Extra squares to highlight, e.g. a region. */
  highlight?: string[] | Region;
  /** Set when `square` is intentionally a piece with no legal moves (e.g. a pinned piece). */
  allowNoMoves?: boolean;
};

/**
 * What a `select-squares` exercise asks for, computed from the position by src/lessons/answers.ts
 * (`querySquares`), never stored. Every fact is LEGAL (02 b06.m4): a pinned piece (or one standing between
 * the Generals) neither attacks nor defends, and cannon screens count as they are before and after a capture.
 * - `attacked-by`: every point (not holding a `side` piece) where `side` could legally capture an enemy piece;
 * - `attacked-pieces`: pieces of `side` (Generals excluded) the other side can legally capture;
 * - `hanging`: pieces of `side` (Generals excluded) with a legal capture that has no legal recapture;
 * - `can-capture`: the opponent's pieces that can legally capture the piece on `target` now;
 * - `point`: one authored point or piece (e.g. "the worst-placed piece"): a judgement, reviewed.
 */
export type SquareQuery =
  | { kind: 'attacked-by'; side: 'red' | 'black' }
  | { kind: 'attacked-pieces'; side: 'red' | 'black' }
  | { kind: 'hanging'; side: 'red' | 'black' }
  | { kind: 'can-capture'; target: string }
  | { kind: 'point'; square: string };

/**
 * Tap every square the piece on `square` can legally move to, every point of `region`, or every point
 * matching `query`. Exactly one of the three.
 */
export type SelectSquaresExercise = PositionSpec & ExerciseMeta & {
  type: 'select-squares';
  prompt: string;
  explanation?: string;
} & (
    | { square: string; region?: never; query?: never }
    | { region: Region; square?: never; query?: never }
    | { query: SquareQuery; square?: never; region?: never }
  );

export type MoveGoal =
  /** Land on one of these squares. */
  | { kind: 'reach'; squares: string[] }
  /** Any legal move is correct; illegal attempts are rejected (e.g. "escape check"). */
  | { kind: 'any' }
  /** The move must give check. */
  | { kind: 'check' }
  /** The move must checkmate. */
  | { kind: 'checkmate' }
  /**
   * Black threatens mate in `depth` moves (1 to 3, default 1): the move must leave Black without a forced
   * checkmate (or stalemate) within `depth` Black moves.
   */
  | { kind: 'defend'; depth?: number }
  /**
   * The move passes the safety guard of the item's level (03-assessment.md §5.3, src/analysis `safetyGuard`):
   * no allowed mate within k, no allowed loss ≥ T within h compared with the best alternative. The level
   * comes from the item id (`b05l2-04` -> Basic; `guardForUnit`), else Basic; `guard` overrides h/k/T.
   */
  | { kind: 'safe'; guard?: GuardOverride };

/** Per-item safety-horizon override (04-architecture.md §5.4, R7): h 0–3 plies, k 0–2 moves, T ≥ 1 point. */
export interface GuardOverride {
  h?: number;
  k?: number;
  T?: number;
}

/** Make one move that satisfies `goal`. `solution` documents a correct answer and is verified in tests. */
export type MoveExercise = PositionSpec & ExerciseMeta & {
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
export type CaptureExercise = PositionSpec & ExerciseMeta & {
  type: 'capture';
  prompt: string;
  solution: { from: string; to: string };
  explanation?: string;
};

/**
 * A short combination played against the engine: Red moves, the engine answers with a best
 * defence, and so on. `checkmate`: mate (or stalemate, also a win) within `moves` Red moves, and
 * not sooner. `win-material`: end at least WIN_MATERIAL_THRESHOLD points up by the search in
 * src/puzzles/logic.ts. Every Red move the engine confirms is accepted, not only the stored line.
 * `solution` is the main line, alternating Red and Black moves and ending with a Red move.
 */
export type CombinationExercise = PositionSpec & ExerciseMeta & {
  type: 'combination';
  prompt: string;
  goal: 'checkmate' | 'win-material';
  /** Number of Red moves: 2 to 4 (win-material: 2 or 3). */
  moves: number;
  solution: { from: string; to: string }[];
  /**
   * Every winning first move (required when `moves` ≥ 4). Listing all winning first moves of a mate in 4
   * takes the engine seconds, too slow for a tap on a phone, so they are computed once at authoring time;
   * `npm run content:deep` re-proves the list is complete. Later moves are always judged by the engine.
   */
  firstMoves?: { from: string; to: string }[];
  /** Optional i18n hint per Red move (index 0 = first Red move). */
  hints?: string[];
  explanation?: string;
};

/**
 * Move classes of a `decision` (02-curriculum.md §5.1/§5.3; 04-architecture.md §5.3 names in brackets):
 * - `target` [best/good]: serves the lesson's idea — accepted;
 * - `sound` [best/good]: good, but not the idea — accepted (authored only);
 * - `dubious` [playable]: safe, misses the objective — "try again, no penalty" or accepted with a comment
 *   (`dubious`); assessments give 0, or 0.5 with `partial`;
 * - `error` [mistake/blunder]: fails the safety guard (an allowed mate within k or a loss ≥ T within h) —
 *   rejected, the refutation is shown, a heart is lost.
 */
export const MOVE_CLASSES = ['target', 'sound', 'dubious', 'error'] as const;
export type MoveClass = (typeof MOVE_CLASSES)[number];

/**
 * One row of a complete move table: every legal move of the position has exactly one row.
 * `computed`: the class the analysis rule gives (src/lessons/decision.ts `computeMoveClass`: guard fails ->
 * error; objective met -> target; else dubious); the validator recomputes it and fails on drift.
 * `authored`: set or confirmed by the author; `reason` (an i18n key saying why) is then required. An authored
 * target/sound/dubious move must still pass the guard; an authored `error` may be a refutation beyond the horizon.
 */
export interface MoveTableEntry {
  /** ICCS `from-to`, e.g. "h2-e2". */
  move: string;
  class: MoveClass;
  source: 'computed' | 'authored';
  /** i18n key: feedback for this move. Required when `source` is `authored`. */
  reason?: string;
  /** Misconception id (`b06.m2`) a learner playing this move shows; must be listed in `misconceptions`. */
  misconception?: string;
}

/**
 * One move where several are reasonable (02-curriculum.md §5.1). The verdict is a lookup in the complete,
 * committed `table` (no runtime search; `scripts/move-table.ts` proposes the table, the author edits, the
 * validator recomputes the computed rows). `objective` is the declarative predicate (src/analysis
 * `Predicate`) that widens "target"; `guard` overrides the level's safety horizon.
 */
export type DecisionExercise = PositionSpec & ExerciseMeta & {
  type: 'decision';
  prompt: string;
  objective?: Predicate;
  guard?: GuardOverride;
  table: MoveTableEntry[];
  /**
   * Default true: the objective allows several moves, so at least two moves must be target/sound (a single
   * stored variation is never silently forced). false: exactly one accepted move.
   */
  alternatives?: boolean;
  /** `retry` (default): a dubious move is "try again", no heart. `accept`: accepted with a comment. */
  dubious?: 'retry' | 'accept';
  /** Assessments: a dubious move earns 0.5 instead of 0 (03-assessment.md §3.2). */
  partial?: boolean;
  /** Hint ladder (02 §5.2): 1 the idea (`idea` key), 2 the piece (`move`'s from point), 3 the move. `move` is a target. */
  hints?: { idea: string; move: string };
  explanation?: string;
};

/** One answer of a `choice`. `text` is an i18n key; `move` (ICCS `from-to`) shows a move on the board and in notation. */
export interface ChoiceOption {
  /** Stable id within the item (`a`, `b`, `none`): attempts and feedback refer to it, never to the shuffled position. */
  id: string;
  text?: string;
  move?: string;
  correct: boolean;
  /** i18n key shown after answering when this option was picked (or, for a correct one, missed). */
  feedback: string;
  /** Distractors: the misconception id this choice reveals (listed in the item's `misconceptions`). */
  misconception?: string;
  /** Keep this option at its authored place when shuffling (e.g. "none of these" last). */
  fixed?: boolean;
}

/**
 * A question about a position with 3–4 options, shuffled with a seed (src/lessons/choice.ts). `multi`: tick
 * every correct option (exact set). Never the only evidence for an outcome about acting (02 §5.1).
 */
export type ChoiceExercise = PositionSpec & ExerciseMeta & {
  type: 'choice';
  prompt: string;
  multi?: boolean;
  options: ChoiceOption[];
  explanation?: string;
};

export type Exercise =
  | LearnExercise
  | SelectSquaresExercise
  | MoveExercise
  | CaptureExercise
  | CombinationExercise
  | DecisionExercise
  | ChoiceExercise;
export type ExerciseType = Exercise['type'];

export interface Lesson {
  id: string;
  title: string;
  exercises: Exercise[];
}

/** A track is a separate path: its first lesson is open from the start, then lessons unlock in order. */
export type Track = 'basics' | 'intermediate' | 'advanced' | 'expert' | 'master';

export interface Unit {
  id: string;
  title: string;
  description: string;
  /** Defaults to 'basics' (required, and matching the id prefix, in new-course units). Units of one track must be consecutive. */
  track?: Track;
  lessons: Lesson[];
  /**
   * Extra-practice pool (05-migration.md MU1): practice items outside the lesson sequence, used by "more
   * practice" and remediation. Validated like lesson items; no `learn` cards.
   */
  pool?: Exercise[];
}
