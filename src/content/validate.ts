// Validates lesson content. Runs in the test suite (src/content/content.test.ts), so a malformed
// or unsolvable lesson fails `npm test`.
import {
  gameStatus,
  hasForcedWin,
  isGeneralAttacked,
  isInCheck,
  legalMoves,
  legalMovesFrom,
  makeMove,
  materialBalance,
  moveScore,
  parseSquare,
  searchScore,
  squareName,
  type Move,
  type Position,
} from '../engine';
import { evaluatePredicate, mobility, moveSignals, predicateErrors, safetyGuard, threatAtEnd, threatOf, type Predicate } from '../analysis';
import { developmentFacts } from '../assessment/practical';
import { PASS_MARK, R1_DEDUCTIONS, r0, r2, r3, r5, scoreTask, scoringWeights, type ScoreTerm } from '../assessment/rubrics';
import { createRecord, appendMove } from '../play/record';
import { hasMessage } from '../i18n/messages';
import {
  bestCaptureGain,
  checkCapture,
  checkMove,
  expectedSelection,
  positionOf,
} from '../lessons/answers';
import { decisionGuard, isAccepted, moveKey, parseMoveKey } from '../lessons/decision';
import { computeMoveClass, syncSafety, TABLE_MAX_NODES } from '../lessons/decision-table';
import { linePositionKey } from '../lessons/line';
import { resolveGuard } from '../lessons/guard';

import {
  bestCombinationReplies,
  checkCombinationMove,
  combinationDone,
  isWinningMove,
  searchWinningMove,
  variedDefenceReplies,
} from '../lessons/combination';
import { sameMove, toMove } from '../puzzles/logic';
import { placementProblems } from './legality';
import retiredIdsFile from './retired-ids.json';
import {
  ASSIST_LEVELS,
  CONTENT_STATUSES,
  MOVE_CLASSES,
  REVIEW_CATEGORIES,
  RUBRIC_IDS,
  SOURCE_KINDS,
  TASK_KINDS,
  STRANDS,
  TRANSFORMS,
  type CombinationExercise,
  type DecisionExercise,
  type Exercise,
  type LineExercise,
  type PlayExercise,
  type Track,
  type Unit,
} from './types';

/** Goal `safe` is judged synchronously here (validator = tests and scripts, never a screen). */
const SAFETY = syncSafety();

const REGIONS = ['red-palace', 'black-palace', 'red-side', 'black-side'];
const EXERCISE_TYPES = ['learn', 'move', 'select-squares', 'capture', 'combination', 'decision', 'choice', 'line', 'play', 'review'];
const GOALS = ['reach', 'any', 'check', 'checkmate', 'defend', 'safe'];
const QUERY_KINDS = ['attacked-by', 'attacked-pieces', 'hanging', 'can-capture', 'point'];
/** Item types that ask for a move: at G1/G0/TR they need the four feedback parts (02-curriculum.md §7). */
const MOVE_ITEM_TYPES = ['move', 'capture', 'combination', 'decision', 'line'];
const FEEDBACK_ASSIST = ['G1', 'G0', 'TR'];
const TRACKS = ['basics', 'intermediate', 'advanced', 'expert', 'master'];

/** New-course unit ids (02-curriculum.md §3.3): level prefix + 2 digits. */
const NEW_UNIT_ID = /^[biaem]\d\d$/;
const TRACK_OF_PREFIX: Record<string, Track> = { b: 'basics', i: 'intermediate', a: 'advanced', e: 'expert', m: 'master' };
const MISCONCEPTION_ID = /^[biaem]\d\d\.m\d$/;
/** An old exercise (`u7l1#2`, 0-based index) or a puzzle id (`m2-07`). */
const LEGACY_REF = /^(u\d+l\d+)#\d+$|^(m1|m2|wm)-\d\d$/;
const SOURCE_FIELDS = ['kind', 'generator', 'generatorVersion', 'seed', 'derivedFrom', 'transform', 'legacyRef', 'gameId', 'moveNumber', 'refs'];

/** Ids reserved forever (07-sourcing.md §8): no new-course unit, lesson or item may use them. */
export const RETIRED_IDS: ReadonlySet<string> = new Set(retiredIdsFile.ids);

/** True for units of the new course (ids per 02-curriculum.md §3.3); all others are legacy units. */
export const isNewCourseUnit = (unit: { id?: unknown }): boolean => typeof unit.id === 'string' && NEW_UNIT_ID.test(unit.id);

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isSquareName = (v: unknown): v is string => typeof v === 'string' && /^[a-i][0-9]$/.test(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const capital = (side: string) => side[0].toUpperCase() + side.slice(1);

/** `deep`: also prove that every stored `firstMoves` list is complete (slow; `npm run content:deep`). */
export interface ValidateOptions {
  deep?: boolean;
  /** Overrides src/content/retired-ids.json (tests). */
  retiredIds?: Iterable<string>;
}

/**
 * `errors` fail the content. `notices` are reported but do not fail: piece-count and reachable-point
 * problems of legacy positions (05-migration.md `POS`), allowed while their lessons are live.
 */
export interface ValidationReport {
  errors: string[];
  notices: string[];
}

/** Returns a list of human-readable problems; empty means the content is valid. */
export function validateUnits(input: unknown, options: ValidateOptions = {}): string[] {
  return validateContent(input, options).errors;
}

/**
 * Piece-count and reachable-point problems of legacy positions, as `<lessonId>#<i>: <problem>`
 * (`<unitId>/pool#<i>` for pool items). New-course positions are not listed: for them these are errors.
 */
export function legacyPlacementNotices(units: readonly Unit[]): string[] {
  const notices: string[] = [];
  const add = (ref: string, ex: Exercise) => {
    let pos: Position;
    try {
      if (!isObj(ex)) return;
      pos = positionOf(ex);
    } catch {
      return; // reported as an error by validateContent
    }
    for (const problem of placementProblems(pos.board)) notices.push(`${ref}: ${problem} (legacy position, allowed while its lesson is live)`);
  };
  const list = <T,>(v: T[] | undefined): T[] => (Array.isArray(v) ? v : []);
  for (const unit of list(units as Unit[])) {
    if (!isObj(unit) || isNewCourseUnit(unit)) continue;
    for (const lesson of list(unit.lessons)) if (isObj(lesson)) list(lesson.exercises).forEach((ex, i) => add(`${lesson.id}#${i}`, ex));
    list(unit.pool).forEach((ex, i) => add(`${unit.id}/pool#${i}`, ex));
  }
  return notices;
}

interface ExerciseContext {
  checkKey: (field: string, value: unknown, optional?: boolean) => void;
  options: ValidateOptions;
  /** New-course item: metadata required, placement rules are errors. */
  newCourse: boolean;
  inPool: boolean;
}

export function validateContent(input: unknown, options: ValidateOptions = {}): ValidationReport {
  const errors: string[] = [];
  const ids = new Set<string>();
  const retired = new Set(options.retiredIds ?? RETIRED_IDS);
  const err = (where: string, msg: string) => errors.push(`${where}: ${msg}`);

  const checkId = (where: string, id: unknown, newCourse = false) => {
    if (typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id)) return err(where, `invalid id ${JSON.stringify(id)}`);
    if (ids.has(id)) err(where, `duplicate id "${id}"`);
    if (newCourse && retired.has(id)) err(where, `id "${id}" is retired (src/content/retired-ids.json) and must not be reused`);
    ids.add(id);
  };
  const checkKey = (where: string, field: string, value: unknown, optional = false) => {
    if (value === undefined && optional) return;
    if (typeof value !== 'string') return err(where, `"${field}" must be an i18n key string`);
    if (!hasMessage(value)) err(where, `"${field}" key "${value}" is missing from src/i18n/messages.ts`);
  };

  if (!Array.isArray(input) || input.length === 0) return { errors: ['content: expected a non-empty array of units'], notices: [] };
  /** Track -> index of its last unit so far. */
  const seenTracks = new Map<unknown, number>();

  const checkItem = (where: string, ex: unknown, idPattern: RegExp, newCourse: boolean, inPool: boolean) => {
    const id = isObj(ex) ? ex.id : undefined;
    if (newCourse || id !== undefined) {
      if (id === undefined) err(where, '"id" is required in a new-course unit');
      else {
        checkId(where, id, newCourse);
        if (newCourse && typeof id === 'string' && !idPattern.test(id)) err(where, `id "${id}" must match ${idPattern.source}`);
      }
    }
    for (const problem of validateExercise(ex, { checkKey: checkKey.bind(null, where), options, newCourse, inPool })) err(where, problem);
    if (isObj(ex)) for (const problem of metaProblems(ex, retired, newCourse)) err(where, problem);
  };

  input.forEach((unit, ui) => {
    const uw = `unit[${ui}]`;
    if (!isObj(unit)) return err(uw, 'must be an object');
    const newCourse = isNewCourseUnit(unit);
    checkId(uw, unit.id, newCourse);
    checkKey(uw, 'title', unit.title);
    checkKey(uw, 'description', unit.description);
    if (unit.track !== undefined && (typeof unit.track !== 'string' || !TRACKS.includes(unit.track))) {
      err(uw, `"track" must be one of ${TRACKS.join(', ')}`);
    }
    if (newCourse && unit.track !== TRACK_OF_PREFIX[(unit.id as string)[0]]) {
      err(uw, `new-course unit "${String(unit.id)}" needs "track": "${TRACK_OF_PREFIX[(unit.id as string)[0]]}"`);
    }
    const track = unit.track ?? 'basics';
    if (seenTracks.has(track) && seenTracks.get(track) !== ui - 1) err(uw, `units of track "${String(track)}" must be consecutive`);
    seenTracks.set(track, ui);
    if (!Array.isArray(unit.lessons) || unit.lessons.length === 0) return err(uw, '"lessons" must be a non-empty array');

    unit.lessons.forEach((lesson, li) => {
      const lw = `${String(unit.id)}/lesson[${li}]`;
      if (!isObj(lesson)) return err(lw, 'must be an object');
      checkId(lw, lesson.id, newCourse);
      if (newCourse && typeof lesson.id === 'string' && !new RegExp(`^${String(unit.id)}l\\d$`).test(lesson.id)) {
        err(lw, `lesson id "${lesson.id}" must be "${String(unit.id)}l" + a digit`);
      }
      checkKey(lw, 'title', lesson.title);
      if (!Array.isArray(lesson.exercises) || lesson.exercises.length === 0) {
        return err(lw, '"exercises" must be a non-empty array');
      }
      const itemId = new RegExp(`^${String(lesson.id)}-\\d\\d$`);
      // A unit's practical tasks (`play` / `review`) keep their unit-level id `<unit>-g<k>` (03 §2, `unitTasks`).
      const taskId = new RegExp(`^(${String(lesson.id)}-\\d\\d|${String(unit.id)}-g\\d+)$`);
      lesson.exercises.forEach((ex, ei) => {
        const practical = isObj(ex) && (ex.type === 'play' || ex.type === 'review');
        checkItem(`${String(lesson.id)}/exercise[${ei}]`, ex, practical ? taskId : itemId, newCourse, false);
      });
    });

    if (unit.pool !== undefined) {
      if (!Array.isArray(unit.pool)) return err(uw, '"pool" must be an array of practice exercises');
      const poolId = new RegExp(`^${String(unit.id)}-p\\d\\d$`);
      unit.pool.forEach((ex, pi) => checkItem(`${String(unit.id)}/pool[${pi}]`, ex, poolId, newCourse, true));
    }
  });
  return { errors, notices: legacyPlacementNotices(input as Unit[]) };
}

/**
 * Problems with one standalone new-course practice item outside a unit (the assessment pools of
 * src/content/pools.ts): the same exercise rules and required metadata as a unit pool item (no `learn` cards).
 * Ids, uniqueness and the assessment-only fields are checked by the caller.
 */
export function validateItem(ex: unknown, options: ValidateOptions = {}): string[] {
  const retired = new Set(options.retiredIds ?? RETIRED_IDS);
  const problems: string[] = [];
  const checkKey = (field: string, value: unknown, optional = false) => {
    if (value === undefined && optional) return;
    if (typeof value !== 'string') return void problems.push(`"${field}" must be an i18n key string`);
    if (!hasMessage(value)) problems.push(`"${field}" key "${value}" is missing from src/i18n/messages.ts`);
  };
  problems.push(...validateExercise(ex, { checkKey, options, newCourse: true, inPool: true }));
  if (isObj(ex)) problems.push(...metaProblems(ex, retired, true));
  return problems;
}

/**
 * Problems with an exercise's metadata (07-sourcing.md §5.1). `required`: a new-course item, where
 * `version`, `status`, `source` and `side` are required on every item and `strand`, `nature`, `critical`
 * and `misconceptions` on every item except `learn` cards. Optional fields are type-checked when present.
 */
function metaProblems(ex: Obj, retired: ReadonlySet<string>, required = true): string[] {
  const problems: string[] = [];
  const need = (field: string, alsoLearn: boolean) => {
    const missing = ex[field] === undefined && required && (alsoLearn || ex.type !== 'learn');
    if (missing) problems.push(`"${field}" is required in a new-course unit`);
    return ex[field] !== undefined;
  };
  if (need('version', true) && !(Number.isInteger(ex.version) && (ex.version as number) >= 1)) problems.push('"version" must be an integer ≥ 1');
  if (need('status', true) && !CONTENT_STATUSES.includes(ex.status as never)) problems.push(`"status" must be one of ${CONTENT_STATUSES.join(', ')}`);
  if (need('source', true)) problems.push(...sourceProblems(ex.source, retired));
  need('side', true); // its value is checked by validateExercise
  if (ex.assist !== undefined && !ASSIST_LEVELS.includes(ex.assist as never)) problems.push(`"assist" must be one of ${ASSIST_LEVELS.join(', ')}`);
  if (ex.assist === undefined && (ex.type === 'decision' || ex.type === 'choice' || ex.type === 'line')) problems.push(`"assist" (${ASSIST_LEVELS.join(', ')}) is required on a "${String(ex.type)}" item`);
  if (need('strand', false) && !STRANDS.includes(ex.strand as never)) problems.push(`"strand" must be one of ${STRANDS.join(', ')}`);
  if (need('nature', false) && ex.nature !== 'tactic' && ex.nature !== 'quiet') problems.push('"nature" must be "tactic" or "quiet"');
  if (need('critical', false) && typeof ex.critical !== 'boolean') problems.push('"critical" must be true or false');
  if (need('misconceptions', false)) {
    const list = ex.misconceptions;
    if (!Array.isArray(list) || !list.every((m) => typeof m === 'string' && MISCONCEPTION_ID.test(m))) {
      problems.push('"misconceptions" must be a list of misconception ids like "b06.m2"');
    } else if (new Set(list).size !== list.length) problems.push('"misconceptions" lists an id twice');
  }
  return problems;
}

function sourceProblems(source: unknown, retired: ReadonlySet<string>): string[] {
  if (!isObj(source)) return ['"source" must be an object with a "kind"'];
  const problems: string[] = [];
  for (const key of Object.keys(source)) if (!SOURCE_FIELDS.includes(key)) problems.push(`"source.${key}" is not a known source field`);
  if (!SOURCE_KINDS.includes(source.kind as never)) return [...problems, `"source.kind" must be one of ${SOURCE_KINDS.join(', ')}`];
  const requireField = (field: string, why: string) => {
    if (source[field] === undefined) problems.push(`"source.${field}" is required for kind "${String(source.kind)}" (${why})`);
  };
  if (source.kind === 'generated') {
    requireField('generator', 'the generator script');
    requireField('seed', 'its seed');
  }
  if (source.kind === 'derived') {
    requireField('derivedFrom', 'the item it was derived from');
    requireField('transform', 'the transformation');
  }
  if (source.kind === 'course-game') {
    requireField('gameId', 'the game record');
    requireField('moveNumber', 'the move number');
  }
  if (source.kind === 'legacy') requireField('legacyRef', 'the old exercise or puzzle');

  if (source.generator !== undefined && !isNonEmptyString(source.generator)) problems.push('"source.generator" must be a non-empty string');
  if (source.generatorVersion !== undefined && !isNonEmptyString(source.generatorVersion)) problems.push('"source.generatorVersion" must be a non-empty string');
  if (source.seed !== undefined && !isNonEmptyString(source.seed) && !Number.isInteger(source.seed)) problems.push('"source.seed" must be a string or an integer');
  if (source.derivedFrom !== undefined && !isNonEmptyString(source.derivedFrom)) problems.push('"source.derivedFrom" must be an item id or legacy ref');
  if (source.transform !== undefined) {
    const t = source.transform;
    if (!Array.isArray(t) || t.length === 0 || !t.every((x) => TRANSFORMS.includes(x as never))) {
      problems.push(`"source.transform" must be a non-empty list of ${TRANSFORMS.join(', ')}`);
    }
  }
  if (source.legacyRef !== undefined) {
    const m = typeof source.legacyRef === 'string' ? LEGACY_REF.exec(source.legacyRef) : null;
    if (!m) problems.push('"source.legacyRef" must be an old exercise like "u7l1#2" or a puzzle id like "m2-07"');
    else if (m[1] && !retired.has(m[1])) problems.push(`"source.legacyRef" ${String(source.legacyRef)} is not an old lesson id`);
  }
  if (source.gameId !== undefined && !isNonEmptyString(source.gameId)) problems.push('"source.gameId" must be a non-empty string');
  if (source.moveNumber !== undefined && !(Number.isInteger(source.moveNumber) && (source.moveNumber as number) >= 1)) {
    problems.push('"source.moveNumber" must be an integer ≥ 1');
  }
  if (source.refs !== undefined) {
    const ok =
      Array.isArray(source.refs) &&
      source.refs.every(
        (r) =>
          isObj(r) &&
          isNonEmptyString(r.title) &&
          isNonEmptyString(r.locator) &&
          isNonEmptyString(r.checkedBy) &&
          typeof r.checkedAt === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(r.checkedAt),
      );
    if (!ok) problems.push('"source.refs" must be a list of { title, locator, checkedBy, checkedAt: "YYYY-MM-DD" } citations');
  }
  return problems;
}

function validateExercise(ex: unknown, ctx: ExerciseContext): string[] {
  const { checkKey, options } = ctx;
  const problems: string[] = [];
  if (!isObj(ex)) return ['must be an object'];
  if (typeof ex.type !== 'string' || !EXERCISE_TYPES.includes(ex.type)) return [`unknown type ${JSON.stringify(ex.type)}`];
  if (ctx.inPool && ex.type === 'learn') return ['a unit pool holds practice items only, not "learn" cards'];
  if (ex.side !== undefined && ex.side !== 'red' && ex.side !== 'black') return ['"side" must be "red" or "black"'];
  /** The side the learner plays (the "own" side). */
  const side = ex.side ?? 'red';
  const Side = capital(side);
  const opponent = side === 'red' ? 'black' : 'red';

  // Position: exactly one of fen / pieces, parseable, and legal.
  let pos: Position;
  try {
    if ((ex.fen === undefined) === (ex.pieces === undefined)) return ['needs exactly one of "fen" or "pieces"'];
    if (ex.pieces !== undefined) {
      if (!isObj(ex.pieces) || !Object.keys(ex.pieces).every(isSquareName)) return ['"pieces" must map square names to letters'];
      if (ex.turn !== undefined && ex.turn !== 'red' && ex.turn !== 'black') return ['"turn" must be "red" or "black"'];
    } else if (ex.turn !== undefined) {
      return ['"turn" is only allowed with "pieces"; put the side to move in the FEN'];
    }
    pos = positionOf(ex as unknown as Exercise);
  } catch (e) {
    return [`invalid position: ${(e as Error).message}`];
  }
  const waiting = pos.turn === 'red' ? 'black' : 'red';
  if (isGeneralAttacked(pos.board, waiting)) problems.push(`illegal position: ${waiting} is in check but it is not their move`);
  if (ex.type !== 'learn' && pos.turn !== side) problems.push(`${Side} must be to move: the exercise is played as ${Side} ("side": "${side}")`);
  if (ex.type !== 'learn' && legalMoves(pos).length === 0) problems.push(`${capital(pos.turn)} has no legal moves`);
  // Piece counts and reachable points: errors for new-course positions; legacy ones are only reported
  // (legacyPlacementNotices) while their lessons are live.
  if (ctx.newCourse) for (const problem of placementProblems(pos.board)) problems.push(`illegal placement: ${problem}`);
  if (problems.length) return problems;

  /** Does `name` hold a piece of the learner's side? */
  const ownPieceAt = (field: string, name: unknown): boolean => {
    if (!isSquareName(name)) {
      problems.push(`"${field}" must be a square name like "e0"`);
      return false;
    }
    const p = pos.board[parseSquare(name)];
    if (!p || p.color !== side) {
      problems.push(`"${field}" ${name} must hold a ${Side} piece`);
      return false;
    }
    return true;
  };
  const squarePair = (field: string, v: unknown): { from: number; to: number } | null => {
    if (!isObj(v) || !isSquareName(v.from) || !isSquareName(v.to)) {
      problems.push(`"${field}" must be { "from": square, "to": square }`);
      return null;
    }
    return { from: parseSquare(v.from), to: parseSquare(v.to) };
  };

  switch (ex.type) {
    case 'learn': {
      checkKey('text', ex.text);
      if (ex.square !== undefined) {
        if (pos.turn !== side) problems.push(`"square" needs ${Side} to move`);
        else if (ownPieceAt('square', ex.square) && legalMovesFrom(pos, parseSquare(ex.square as string)).length === 0 && !ex.allowNoMoves) {
          // A pinned piece with no moves is a valid lesson, but must be explicit.
          problems.push(`piece on ${ex.square} has no legal moves (set "allowNoMoves": true if intended)`);
        }
      }
      if (ex.highlight !== undefined) {
        const ok =
          (typeof ex.highlight === 'string' && REGIONS.includes(ex.highlight)) ||
          (Array.isArray(ex.highlight) && ex.highlight.length > 0 && ex.highlight.every(isSquareName));
        if (!ok) problems.push('"highlight" must be a region name or a non-empty list of squares');
      }
      break;
    }

    case 'select-squares': {
      checkKey('prompt', ex.prompt);
      checkKey('explanation', ex.explanation, true);
      if ([ex.square, ex.region, ex.query].filter((v) => v !== undefined).length !== 1) {
        problems.push('needs exactly one of "square", "region" or "query"');
      } else if (ex.query !== undefined) {
        problems.push(...queryProblems(ex.query, pos));
        if (problems.length === 0 && expectedSelection(ex as never).length === 0) problems.push('"query" matches no point, so there is nothing to select');
      } else if (ex.region !== undefined) {
        if (typeof ex.region !== 'string' || !REGIONS.includes(ex.region)) problems.push(`unknown region ${JSON.stringify(ex.region)}`);
      } else if (ownPieceAt('square', ex.square) && expectedSelection(ex as never).length === 0) {
        problems.push(`piece on ${ex.square} has no legal moves, so there is nothing to select`);
      }
      break;
    }

    case 'move': {
      checkKey('prompt', ex.prompt);
      checkKey('explanation', ex.explanation, true);
      const goal = ex.goal;
      if (!isObj(goal) || typeof goal.kind !== 'string' || !GOALS.includes(goal.kind)) {
        problems.push(`"goal.kind" must be one of ${GOALS.join(', ')}`);
        break;
      }
      if (ex.from !== undefined) ownPieceAt('from', ex.from);
      // Check the horizon before any search uses it (k = 5 would run for minutes).
      if (goal.kind === 'safe') {
        problems.push(...guardOverrideProblems(goal.guard, 'goal.guard'));
        if (problems.length) break;
      }
      if (goal.kind === 'reach') {
        if (!Array.isArray(goal.squares) || goal.squares.length === 0 || !goal.squares.every(isSquareName)) {
          problems.push('"goal.squares" must be a non-empty list of squares');
          break;
        }
        // Every target must be reachable in one legal move (by the given piece, if any).
        const movers = ex.from !== undefined && isSquareName(ex.from) ? [parseSquare(ex.from)] : null;
        for (const target of goal.squares) {
          const to = parseSquare(target);
          const reachable = legalMoves(pos).some((m) => m.to === to && (!movers || movers.includes(m.from)));
          if (!reachable) problems.push(`goal square ${target} cannot be reached in one legal move`);
        }
      }
      const solution = squarePair('solution', ex.solution);
      if (!solution) break;
      const verdict = checkMove(ex as never, solution, SAFETY);
      if (verdict !== 'correct') {
        problems.push(`solution ${squareName(solution.from)}-${squareName(solution.to)} is not accepted (${verdict})`);
      }
      if (goal.kind === 'defend') {
        const depth = goal.depth ?? 1;
        if (typeof depth !== 'number' || !Number.isInteger(depth) || depth < 1 || depth > 3) {
          problems.push('"goal.depth" must be 1, 2 or 3');
          break;
        }
        // There must be a real threat: the opponent would force mate in `depth` if it were their move.
        if (!hasForcedWin({ ...pos, turn: opponent }, depth)) problems.push(`"defend": ${capital(opponent)} has no mate-in-${depth} threat to stop`);
        if (legalMoves(pos).every((m) => checkMove(ex as never, m, SAFETY) === 'correct')) problems.push('"defend": every move stops the threat');
      }
      if (goal.kind === 'safe') {
        // Something must be tested: at least one legal move fails the guard.
        const verdicts = legalMoves(pos).map((m) => checkMove(ex as never, m, SAFETY));
        if (verdicts.includes('not-checked')) problems.push('"safe": the guard could not check every move within the node limit');
        else if (verdicts.every((v) => v === 'correct')) problems.push('"safe": every move is safe, so nothing is tested');
      }
      if (goal.kind === 'checkmate') {
        // Avoid ambiguous "checkmate" puzzles where a quiet move would stalemate (also a win).
        const stalemating = legalMoves(pos).find((m) => gameStatus(makeMove(pos, m)).kind === 'stalemate');
        if (stalemating) {
          problems.push(`${squareName(stalemating.from)}-${squareName(stalemating.to)} stalemates; give ${capital(opponent)} a spare move`);
        }
      }
      break;
    }

    case 'capture': {
      checkKey('prompt', ex.prompt);
      checkKey('explanation', ex.explanation, true);
      const solution = squarePair('solution', ex.solution);
      if (!solution) break;
      if (bestCaptureGain(pos) <= 0) problems.push('no capture wins material in this position');
      const verdict = checkCapture(ex as never, solution);
      if (verdict !== 'correct') {
        problems.push(`solution ${squareName(solution.from)}-${squareName(solution.to)} is not accepted (${verdict})`);
      }
      break;
    }

    case 'combination':
      checkKey('prompt', ex.prompt);
      checkKey('explanation', ex.explanation, true);
      problems.push(...validateCombination(ex, pos, checkKey, options));
      break;

    case 'decision':
      checkKey('prompt', ex.prompt);
      checkKey('explanation', ex.explanation, true);
      problems.push(...validateDecision(ex, pos, checkKey));
      break;

    case 'choice':
      checkKey('prompt', ex.prompt);
      checkKey('explanation', ex.explanation, true);
      problems.push(...validateChoice(ex, pos, checkKey));
      break;

    case 'line':
      checkKey('prompt', ex.prompt);
      checkKey('explanation', ex.explanation, true);
      problems.push(...validateLine(ex, pos, checkKey));
      break;

    case 'play':
      checkKey('prompt', ex.prompt);
      checkKey('explanation', ex.explanation, true);
      problems.push(...validatePlay(ex, pos, checkKey));
      break;

    case 'review':
      checkKey('prompt', ex.prompt);
      checkKey('explanation', ex.explanation, true);
      problems.push(...validateReview(ex, pos, checkKey));
      break;
  }
  if (problems.length === 0) problems.push(...feedbackProblems(ex, pos, checkKey));
  return problems;
}

/** Misconception ids used by table rows / options must look like `b06.m2` and be listed on the item. */
function misconceptionProblems(ex: Obj, field: string, id: unknown): string[] {
  if (id === undefined) return [];
  if (typeof id !== 'string' || !MISCONCEPTION_ID.test(id)) return [`"${field}" must be a misconception id like "b06.m2"`];
  if (Array.isArray(ex.misconceptions) && !ex.misconceptions.includes(id)) return [`"${field}" ${id} is not listed in "misconceptions"`];
  return [];
}

function guardOverrideProblems(guard: unknown, field: string): string[] {
  if (guard === undefined) return [];
  if (!isObj(guard)) return [`"${field}" must be an object { h?, k?, T? }`];
  const problems: string[] = [];
  for (const key of Object.keys(guard)) if (!['h', 'k', 'T'].includes(key)) problems.push(`"${field}.${key}" is not a guard field (h, k, T)`);
  const int = (key: string, min: number, max: number) => {
    const v = guard[key];
    if (v !== undefined && !(Number.isInteger(v) && (v as number) >= min && (v as number) <= max)) problems.push(`"${field}.${key}" must be an integer ${min}–${max}`);
  };
  int('h', 0, 3);
  int('k', 0, 2);
  int('T', 1, 20);
  return problems;
}

function queryProblems(query: unknown, pos: Position): string[] {
  if (!isObj(query) || typeof query.kind !== 'string' || !QUERY_KINDS.includes(query.kind)) {
    return [`"query.kind" must be one of ${QUERY_KINDS.join(', ')}`];
  }
  switch (query.kind) {
    case 'attacked-by':
    case 'attacked-pieces':
    case 'hanging':
      return query.side === 'red' || query.side === 'black' ? [] : ['"query.side" must be "red" or "black"'];
    case 'can-capture':
      if (!isSquareName(query.target)) return ['"query.target" must be a square name'];
      return pos.board[parseSquare(query.target)] ? [] : [`"query.target" ${query.target} must hold a piece`];
    default:
      return isSquareName(query.square) ? [] : ['"query.square" must be a square name'];
  }
}

/**
 * The four feedback parts (02-curriculum.md §7) of a move item at G1/G0/TR: keys exist, and the tempting
 * alternative is a legal move the item rejects.
 */
function feedbackProblems(ex: Obj, pos: Position, checkKey: (field: string, value: unknown, optional?: boolean) => void): string[] {
  const fb = ex.feedback;
  const required = MOVE_ITEM_TYPES.includes(ex.type as string) && FEEDBACK_ASSIST.includes(ex.assist as string);
  if (fb === undefined) return required ? [`"feedback" { purpose, keyReply, commonError, temptingAlternative } is required at ${String(ex.assist)}`] : [];
  if (!MOVE_ITEM_TYPES.includes(ex.type as string)) return [`"feedback" is only for move items (${MOVE_ITEM_TYPES.join(', ')})`];
  if (!isObj(fb)) return ['"feedback" must be an object'];
  for (const key of Object.keys(fb)) if (!['purpose', 'keyReply', 'commonError', 'temptingAlternative'].includes(key)) return [`"feedback.${key}" is not a feedback field`];
  checkKey('feedback.purpose', fb.purpose);
  checkKey('feedback.keyReply', fb.keyReply);
  checkKey('feedback.commonError', fb.commonError);
  const alt = fb.temptingAlternative;
  if (!isObj(alt)) return ['"feedback.temptingAlternative" must be { "move": "h2-e2", "text": key }'];
  checkKey('feedback.temptingAlternative.text', alt.text);
  const move = parseMoveKey(alt.move);
  if (!move) return ['"feedback.temptingAlternative.move" must be a move like "h2-e2"'];
  if (!legalMoves(pos).some((m) => m.from === move.from && m.to === move.to)) return [`"feedback.temptingAlternative.move" ${String(alt.move)} is not legal`];
  let rejected: boolean;
  switch (ex.type) {
    case 'move': {
      const verdict = checkMove(ex as never, move, SAFETY);
      if (verdict === 'not-checked') return [`"feedback.temptingAlternative.move" ${String(alt.move)} could not be checked within the node limit; name another move`];
      rejected = verdict !== 'correct';
      break;
    }
    case 'capture':
      rejected = checkCapture(ex as never, move) !== 'correct';
      break;
    case 'combination':
      rejected = checkCombinationMove(ex as unknown as CombinationExercise, 0, pos, move) !== 'correct';
      break;
    default: {
      // decision, or a line (its root node's table)
      const d = ex as unknown as DecisionExercise;
      const table = ex.type === 'line' ? (ex as unknown as LineExercise).root.table : d.table;
      const row = table.find((r) => r.move === alt.move);
      // A dubious move the item accepts (`dubious: "accept"`) solves it, so it is not a rejected move.
      rejected = row !== undefined && !isAccepted(row.class) && !(row.class === 'dubious' && d.dubious === 'accept');
    }
  }
  return rejected ? [] : [`"feedback.temptingAlternative.move" ${String(alt.move)} is accepted by the item; name a tempting WRONG move`];
}

/**
 * A `decision` (04-architecture.md §5.3): the table is complete (every legal move exactly once, nothing else),
 * every `computed` row equals the rule's class now (drift), every target/sound/dubious row passes the guard,
 * authored rows have a reason, and at least two moves are accepted unless `alternatives` is false.
 */
function validateDecision(ex: Obj, pos: Position, checkKey: (field: string, value: unknown, optional?: boolean) => void): string[] {
  const problems: string[] = [...guardOverrideProblems(ex.guard, 'guard')];
  if (ex.objective !== undefined) problems.push(...predicateErrors(ex.objective, pos, 'objective'));
  if (ex.alternatives !== undefined && typeof ex.alternatives !== 'boolean') problems.push('"alternatives" must be true or false');
  if (ex.partial !== undefined && typeof ex.partial !== 'boolean') problems.push('"partial" must be true or false');
  if (ex.dubious !== undefined && ex.dubious !== 'retry' && ex.dubious !== 'accept') problems.push('"dubious" must be "retry" or "accept"');
  if (!Array.isArray(ex.table) || ex.table.length === 0) return [...problems, '"table" must list every legal move: run `npx tsx scripts/move-table.ts`'];
  if (problems.length) return problems;

  const legal = new Map(legalMoves(pos).map((m) => [moveKey(m), m]));
  const seen = new Set<string>();
  const rows = ex.table as unknown[];
  rows.forEach((row, i) => {
    const where = `table[${i}]`;
    if (!isObj(row)) return problems.push(`${where} must be an object`);
    for (const key of Object.keys(row)) if (!['move', 'class', 'source', 'reason', 'misconception'].includes(key)) problems.push(`${where}.${key} is not a table field`);
    if (typeof row.move !== 'string' || !parseMoveKey(row.move)) return problems.push(`${where}.move must be a move like "h2-e2"`);
    if (seen.has(row.move)) problems.push(`${where}: ${row.move} is listed twice`);
    seen.add(row.move);
    if (!legal.has(row.move)) problems.push(`${where}: ${row.move} is not a legal move`);
    if (!MOVE_CLASSES.includes(row.class as never)) problems.push(`${where}.class must be one of ${MOVE_CLASSES.join(', ')}`);
    if (row.source !== 'computed' && row.source !== 'authored') problems.push(`${where}.source must be "computed" or "authored"`);
    if (row.source === 'authored' && row.reason === undefined) problems.push(`${where}: an authored row needs a "reason"`);
    // 04 §5.3: the author decides every accepted move and every tempting one (captures, checks).
    const m = legal.get(row.move);
    if (m && row.source !== 'authored') {
      if (isAccepted(row.class as never)) problems.push(`${where}: ${row.move} is accepted ("${String(row.class)}"): the author must decide it ("source": "authored" + a "reason")`);
      else if (pos.board[m.to]) problems.push(`${where}: ${row.move} is a capture (a tempting move): the author must decide it ("source": "authored" + a "reason")`);
      else if (isInCheck(makeMove(pos, m))) problems.push(`${where}: ${row.move} gives check (a tempting move): the author must decide it ("source": "authored" + a "reason")`);
    }
    checkKey(`${where}.reason`, row.reason, true);
    problems.push(...misconceptionProblems(ex, `${where}.misconception`, row.misconception).map((p) => `${where}: ${p}`));
  });
  for (const key of legal.keys()) if (!seen.has(key)) problems.push(`table is incomplete: ${key} is missing (run \`npx tsx scripts/move-table.ts\`)`);
  if (problems.length) return problems;

  const table = ex.table as DecisionExercise['table'];
  const guard = resolveGuard(decisionGuard(ex as unknown as DecisionExercise));
  for (const row of table) {
    const c = computeMoveClass(pos, legal.get(row.move)!, guard, ex.objective as Predicate | undefined);
    if (c.class === 'not-checked') {
      problems.push(`${row.move}: the guard or objective could not be checked within the node limit; simplify the position`);
      continue;
    }
    if (row.source === 'computed' && row.class !== c.class) {
      problems.push(`${row.move}: drift — the table says "${row.class}" (computed) but the analysis now gives "${c.class}"; re-run scripts/move-table.ts or author the row`);
    }
    if (row.class !== 'error' && c.class === 'error') {
      const why = c.guard.allowedMate || c.guard.allowedLoss?.mate ? 'allows a mate' : `loses ${c.guard.allowedLoss?.loss ?? '?'} points`;
      problems.push(`${row.move}: classed "${row.class}" but it fails the safety guard (${why} within the horizon)`);
    }
  }
  const accepted = table.filter((r) => isAccepted(r.class)).length;
  if (accepted === 0) problems.push('no move is accepted (target or sound)');
  else if (ex.alternatives === false && accepted !== 1) problems.push(`"alternatives": false needs exactly one accepted move, found ${accepted}`);
  else if (ex.alternatives !== false && accepted < 2) problems.push('at least two moves must be accepted (target or sound); set "alternatives": false if only one move serves the objective');
  if (accepted === table.length) problems.push('every move is accepted, so nothing is tested');

  if (ex.hints !== undefined) {
    const hints = ex.hints;
    if (!isObj(hints)) problems.push('"hints" must be { "idea": key, "move": "h2-e2" }');
    else {
      checkKey('hints.idea', hints.idea);
      const row = table.find((r) => r.move === hints.move);
      if (!row || row.class !== 'target') problems.push('"hints.move" must be a target move of the table');
    }
  }
  return problems;
}

/** Most nodes a line tree may hold (keeps the validator and the attempt log bounded). */
export const MAX_LINE_NODES = 200;
const PARTNER_KINDS = ['best-defence', 'forcing-attack', 'safe-sparring', 'pressing'];
const LEAF_GOALS = ['checkmate', 'material', 'predicate', 'end'];

/** A leaf goal's shape (and, for predicates, its predicate) — `allowEnd` false for `handOver.goal`. */
function lineGoalShapeProblems(goal: unknown, field: string, start: Position, allowEnd: boolean): string[] {
  if (!isObj(goal) || typeof goal.kind !== 'string' || !LEAF_GOALS.includes(goal.kind) || (!allowEnd && goal.kind === 'end')) {
    return [`"${field}.kind" must be one of ${LEAF_GOALS.filter((g) => allowEnd || g !== 'end').join(', ')}`];
  }
  for (const key of Object.keys(goal)) if (!['kind', 'gain', 'predicate'].includes(key)) return [`"${field}.${key}" is not a goal field`];
  if (goal.kind === 'material' && !(Number.isInteger(goal.gain) && (goal.gain as number) >= 1 && (goal.gain as number) <= 40)) return [`"${field}.gain" must be an integer 1–40`];
  if (goal.kind === 'predicate') return predicateErrors(goal.predicate, start, `${field}.predicate`);
  return [];
}

function partnerProblems(spec: unknown, field: string, pieces: number): string[] {
  if (!isObj(spec) || typeof spec.kind !== 'string' || !PARTNER_KINDS.includes(spec.kind)) return [`"${field}.kind" must be one of ${PARTNER_KINDS.join(', ')}`];
  const allowed: Record<string, string[]> = { 'best-defence': ['k', 'resist', 'd'], 'forcing-attack': ['k'], 'safe-sparring': ['d', 'tau'], pressing: ['d'] };
  const problems: string[] = [];
  for (const key of Object.keys(spec)) if (key !== 'kind' && !allowed[spec.kind].includes(key)) problems.push(`"${field}.${key}" is not a field of "${spec.kind}"`);
  // 03 §5.2 / 04 §5.5: depth or k = 3 fits the runtime budget only in positions of ≤ ~12 pieces.
  const depth = (key: string) => {
    const v = spec[key];
    if (v === undefined) return;
    if (!(Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 3)) problems.push(`"${field}.${key}" must be an integer 1–3`);
    else if (v === 3 && pieces > 12) problems.push(`"${field}.${key}": 3 only in positions of at most 12 pieces (runtime budget, 03 §5.2)`);
  };
  depth('k');
  depth('d');
  if (spec.resist !== undefined && typeof spec.resist !== 'boolean') problems.push(`"${field}.resist" must be true or false`);
  if (spec.tau !== undefined && !(typeof spec.tau === 'number' && spec.tau >= 0 && spec.tau <= 5)) problems.push(`"${field}.tau" must be a number 0–5`);
  return problems;
}

/**
 * A `line` (04-architecture.md §5.2; S2.8): every node legal and of the right side; every learner node a complete
 * move table under the `decision` rules (drift, guard, authored rows, accepted count) with at least one accepted
 * move that continues; every authored opponent reply legal, passing the safety guard from the opponent's side and
 * continuing to a node or leaf, so every branch reaches a leaf; leaf goals hold on the stored path; forced claims
 * proven for EVERY defence; no position repeated on a stored path (07-sourcing.md §4.1); `handOver` well formed.
 */
function validateLine(ex: Obj, start: Position, checkKey: (field: string, value: unknown, optional?: boolean) => void): string[] {
  const problems: string[] = [...guardOverrideProblems(ex.guard, 'guard')];
  if (ex.objective !== undefined) problems.push(...predicateErrors(ex.objective, start, 'objective'));
  if (ex.partial !== undefined && typeof ex.partial !== 'boolean') problems.push('"partial" must be true or false');
  if (ex.dubious !== undefined && ex.dubious !== 'retry' && ex.dubious !== 'accept') problems.push('"dubious" must be "retry" or "accept"');
  if (ex.handOver !== undefined) {
    const h = ex.handOver;
    if (!isObj(h)) problems.push('"handOver" must be { "partner": [...], "moves": n, "goal"? }');
    else {
      for (const key of Object.keys(h)) if (!['partner', 'moves', 'goal'].includes(key)) problems.push(`"handOver.${key}" is not a hand-over field`);
      const pieces = start.board.filter(Boolean).length;
      if (!Array.isArray(h.partner) || h.partner.length === 0) problems.push('"handOver.partner" must be a non-empty list of partners');
      else h.partner.forEach((p, i) => problems.push(...partnerProblems(p, `handOver.partner[${i}]`, pieces)));
      if (!(Number.isInteger(h.moves) && (h.moves as number) >= 1 && (h.moves as number) <= 20)) problems.push('"handOver.moves" must be an integer 1–20');
      if (h.goal !== undefined) problems.push(...lineGoalShapeProblems(h.goal, 'handOver.goal', start, false));
    }
  }
  if (!isObj(ex.root) || ex.root.kind !== 'learner') return [...problems, '"root" must be a learner node { "kind": "learner", "table": [...] }'];
  if (problems.length) return problems;

  const side = (ex.side ?? 'red') as 'red' | 'black';
  const guard = resolveGuard({ itemId: ex.id as string | undefined, override: ex.guard as never });
  const limits = { maxNodes: TABLE_MAX_NODES };
  let count = 0;

  /** `mateIn`: the mate claim (moves left for the learner) of the learner node above an opponent node. */
  const walk = (node: unknown, cur: Position, moves: Move[], seen: string[], where: string, mateIn?: number): void => {
    if (++count > MAX_LINE_NODES) {
      if (count === MAX_LINE_NODES + 1) problems.push(`the tree has more than ${MAX_LINE_NODES} nodes`);
      return;
    }
    const err = (msg: string) => problems.push(`${where}: ${msg}`);
    if (!isObj(node)) return void err('must be a node object with "kind": "learner" | "opponent" | "leaf"');
    /** Follows `move` to `child`, refusing a repeated position (07 §4.1). */
    const follow = (move: Move, child: unknown, label: string, claim?: number) => {
      const after = makeMove(cur, move);
      const key = linePositionKey(after);
      if (seen.includes(key)) return void problems.push(`${where}>${label}: repeats a position of the stored line (07-sourcing.md §4.1)`);
      walk(child, after, [...moves, move], [...seen, key], `${where}>${label}`, claim);
    };

    if (node.kind === 'leaf') {
      for (const key of Object.keys(node)) if (!['kind', 'goal', 'text'].includes(key)) err(`"${key}" is not a leaf field`);
      checkKey(`${where}.text`, node.text, true);
      const shape = lineGoalShapeProblems(node.goal, 'goal', start, true);
      if (shape.length) return void shape.forEach(err);
      const goal = node.goal as Obj;
      if (goal.kind === 'checkmate' && !(cur.turn !== side && legalMoves(cur).length === 0)) err('leaf "checkmate": the opponent is not mated (or stalemated) here');
      if (goal.kind === 'material' && materialBalance(cur.board, side) - materialBalance(start.board, side) < (goal.gain as number)) {
        err(`leaf "material": the learner is not ${String(goal.gain)} points up here`);
      }
      if (goal.kind === 'predicate') {
        const v = evaluatePredicate(goal.predicate as Predicate, { before: start, moves, side, limits });
        if (v === null) err('leaf "predicate" could not be checked within the node limit');
        else if (!v) err('leaf "predicate" does not hold at the leaf');
      }
      return;
    }

    if (node.kind === 'opponent') {
      for (const key of Object.keys(node)) if (!['kind', 'replies'].includes(key)) err(`"${key}" is not an opponent-node field`);
      if (cur.turn === side) return void err('an opponent node needs the opponent to move');
      if (!Array.isArray(node.replies) || node.replies.length === 0) return void err('"replies" must list at least one authored reply');
      const legal = new Map(legalMoves(cur).map((m) => [moveKey(m), m]));
      // A forced line: the main reply (played in tests) must be a best defence, i.e. of the longest mate distance.
      if (mateIn !== undefined && mateIn > 1 && isObj(node.replies[0]) && legal.has(node.replies[0].move as string)) {
        const distance = (m: Move) => {
          const after = makeMove(cur, m);
          for (let k = 1; k < mateIn; k++) if (hasForcedWin(after, k)) return k;
          return mateIn;
        };
        const longest = Math.max(...[...legal.values()].map(distance));
        const main = node.replies[0].move as string;
        if (distance(legal.get(main)!) < longest) err(`replies[0] ${main} (the main reply, played in tests) is not a best defence: another reply delays the mate longer`);
      }
      const used = new Set<string>();
      node.replies.forEach((reply, i) => {
        const rw = `replies[${i}]`;
        if (!isObj(reply)) return void err(`${rw} must be { "move", "weight"?, "text"?, "next" }`);
        for (const key of Object.keys(reply)) if (!['move', 'weight', 'text', 'next'].includes(key)) err(`${rw}.${key} is not a reply field`);
        const m = typeof reply.move === 'string' ? legal.get(reply.move) : undefined;
        if (!m) return void err(`${rw}.move ${JSON.stringify(reply.move)} is not a legal move`);
        if (used.has(reply.move as string)) err(`${rw}: ${String(reply.move)} is listed twice`);
        used.add(reply.move as string);
        if (reply.weight !== undefined && !(typeof reply.weight === 'number' && Number.isFinite(reply.weight) && reply.weight > 0)) err(`${rw}.weight must be a positive number`);
        checkKey(`${where}.${rw}.text`, reply.text, true);
        // 07 §4.1: authored replies are not blunders (the item's guard, from the opponent's side).
        const v = safetyGuard(cur, m, guard, limits);
        if (v.status !== 'checked') err(`${rw}: ${String(reply.move)} could not be checked by the safety guard within the node limit`);
        else if (!v.safe) {
          const why = v.allowedMate || v.allowedLoss?.mate ? 'allows a mate' : `loses ${v.allowedLoss?.loss ?? '?'} points`;
          err(`${rw}: the authored reply ${String(reply.move)} fails the safety guard (${why} within the horizon)`);
        }
        if (reply.next === undefined) return void err(`${rw} needs "next" (a learner node or a leaf): every branch must reach a leaf`);
        if (isObj(reply.next) && reply.next.kind === 'opponent') return void err(`${rw}.next must be a learner node or a leaf`);
        follow(m, reply.next, reply.move as string);
      });
      return;
    }

    if (node.kind !== 'learner') return void err('"kind" must be "learner", "opponent" or "leaf"');
    for (const key of Object.keys(node)) if (!['kind', 'table', 'objective', 'alternatives', 'claim', 'hints', 'next'].includes(key)) err(`"${key}" is not a learner-node field`);
    if (cur.turn !== side) return void err('a learner node needs the learner to move');
    const legal = new Map(legalMoves(cur).map((m) => [moveKey(m), m]));
    if (legal.size === 0) return void err('the learner has no legal move here: end the branch with a leaf');
    // The decision rules on this node's table (complete, drift, guard, authored rows, accepted count, hints).
    const asDecision: Obj = {
      id: ex.id,
      guard: ex.guard,
      misconceptions: ex.misconceptions,
      table: node.table,
      objective: node.objective ?? ex.objective,
      alternatives: node.alternatives,
      hints: node.hints,
    };
    for (const p of validateDecision(asDecision, cur, (f, v, o) => checkKey(`${where}.${f}`, v, o))) err(p);
    const table = Array.isArray(node.table) ? (node.table as Obj[]).filter(isObj) : [];
    const rowOf = (key: string) => table.find((r) => r.move === key);
    const accepted = table.filter((r) => typeof r.move === 'string' && legal.has(r.move) && isAccepted(r.class as never)).map((r) => legal.get(r.move as string)!);

    /** Every legal move that keeps the claim must be accepted, every accepted move must keep it (`alternatives`). */
    const claimProblems = (keeps: (m: Move) => boolean, what: string) => {
      const keepers = new Set([...legal.values()].filter(keeps).map(moveKey));
      for (const m of accepted) if (!keepers.has(moveKey(m))) err(`${moveKey(m)} is accepted but does not ${what}`);
      for (const key of keepers) {
        const row = rowOf(key);
        if (row && !isAccepted(row.class as never)) err(`${key} does ${what} but the table classes it "${String(row.class)}": every move that keeps the claim must be target or sound`);
      }
      if (node.alternatives === false && keepers.size > 1) err(`"alternatives": false, but ${keepers.size} moves ${what}`);
    };
    if (node.claim !== undefined) {
      const c = node.claim;
      if (!isObj(c) || (c.kind !== 'mate' && c.kind !== 'material')) err('"claim" must be { "kind": "mate", "moves" } or { "kind": "material", "gain", "depth" }');
      else if (c.kind === 'mate') {
        const n = c.moves as number;
        if (!(Number.isInteger(n) && n >= 1 && n <= 3)) err('"claim.moves" must be 1, 2 or 3');
        else if (!hasForcedWin(cur, n)) err(`claim: the learner has no forced mate in ${n}`);
        else {
          // Proven for every defence: a move keeps the claim when EVERY reply (not only the authored ones) still loses.
          // The table must accept exactly the moves that keep it (a forced line never rejects another winning move).
          const keeps = (m: Move) => {
            const after = makeMove(cur, m);
            const replies = legalMoves(after);
            return replies.length === 0 || (n > 1 && replies.every((r) => hasForcedWin(makeMove(after, r), n - 1)));
          };
          claimProblems(keeps, `keep the forced mate in ${n} against every defence`);
        }
      } else {
        const gain = c.gain as number;
        const depth = c.depth as number;
        if (!(Number.isInteger(gain) && gain >= 1 && gain <= 40)) err('"claim.gain" must be an integer 1–40');
        else if (!(Number.isInteger(depth) && depth >= 1 && depth <= 4)) err('"claim.depth" must be 1–4 plies');
        else {
          const base = materialBalance(cur.board, cur.turn);
          if (searchScore(cur, depth) - base < gain) err(`claim: the learner does not win ${gain} points within ${depth} plies`);
          else claimProblems((m) => moveScore(cur, m, depth) - base >= gain, `win ${gain} points within ${depth} plies`);
        }
      }
    }

    const next = node.next;
    if (next === undefined) return void err('no accepted move continues the line ("next"): every branch must reach a leaf');
    if (!isObj(next)) return void err('"next" must map moves ("h2-e2") to an opponent node or a leaf');
    let continues = false;
    for (const [key, child] of Object.entries(next)) {
      const m = legal.get(key);
      const row = rowOf(key);
      if (!m || !row) {
        err(`next: ${key} is not a legal move of the table`);
        continue;
      }
      if (row.class === 'error') {
        err(`next: ${key} is an "error" row; an error is never played on`);
        continue;
      }
      if (isAccepted(row.class as never)) continues = true;
      if (isObj(child) && child.kind === 'learner') {
        err(`next: ${key} must lead to an opponent node or a leaf`);
        continue;
      }
      const c = node.claim;
      follow(m, child, key, isObj(c) && c.kind === 'mate' && typeof c.moves === 'number' ? c.moves : undefined);
    }
    if (!continues) err('no accepted move continues the line ("next"): every branch must reach a leaf');
  };
  walk(ex.root, start, [], [linePositionKey(start)], 'root');
  return problems;
}

// ---------- Practical tasks and reviews (03-assessment.md §5; S2.12) ----------

const META_FIELDS = ['id', 'version', 'status', 'source', 'side', 'strand', 'nature', 'critical', 'misconceptions', 'assist', 'feedback'];
const PLAY_FIELDS = [
  'type', 'prompt', 'task', 'cap', 'tree', 'rubrics', 'objective', 'holding', 'development', 'lineShare', 'safetyGate', 'passMark',
  'guard', 'measured', 'f2b', 'resistance', 'reference', 'explanation',
];

/** Does a predicate use a kind that needs the opponent's resistance (`threat`)? F5 allows own-side predicates only. */
function usesThreat(p: unknown): boolean {
  if (!isObj(p)) return false;
  if (p.kind === 'threat') return true;
  if (Array.isArray(p.of)) return p.of.some(usesThreat);
  return isObj(p.of) ? usesThreat(p.of) : false;
}

/**
 * F1's scoring-leaf rule (03 §5.2): the task's rubrics evaluated on the position after an accepted tree move, as if the
 * task ended there with every earlier learner move target/sound (no R1 penalty), must reach the pass mark.
 */
function leafScore(ex: PlayExercise, start: Position, moves: readonly Move[]): number | null {
  const side = ex.side ?? 'red';
  const opponent = side === 'red' ? 'black' : 'red';
  const limits = { maxNodes: TABLE_MAX_NODES };
  const end = moves.reduce(makeMove, start);
  const guard = resolveGuard({ itemId: ex.id, override: ex.guard });
  const values: Partial<Record<ScoreTerm, number>> = { R1: 100, R0: r0(materialBalance(start.board, side), materialBalance(end.board, side)) };
  let record = createRecord(start, { learner: side, seed: 0 });
  for (const m of moves) record = appendMove(record, m);
  values.R2 = ex.development ? r2(developmentFacts(record, ex.development.n, ex.development.target)) : 0;
  const pred = (p: Predicate) => evaluatePredicate(p, { before: start, moves, side, limits });
  if (ex.objective) {
    const met = pred(ex.objective);
    if (met === null) return null;
    values.R3 = r3({ objectiveMet: met, r1: 100, mobilityStart: mobility(start.board, side), mobilityEnd: mobility(end.board, side) });
  } else values.R3 = 0;
  const t = threatAtEnd(end, opponent, guard, limits);
  if (t.status !== 'checked') return null;
  let holding = false;
  if (ex.holding) {
    if ((ex.holding.when ?? 'end') === 'end') holding = pred(ex.holding.predicate) === true;
    else {
      let cur = start;
      for (const m of moves) {
        if (cur.turn === side && evaluatePredicate(ex.holding.predicate, { before: cur, moves: [m], side, limits }) === true) holding = true;
        cur = makeMove(cur, m);
      }
    }
  }
  values.R5 = r5({ mated: false, startDeficit: -materialBalance(start.board, side), endDeficit: -materialBalance(end.board, side), threatAtEnd: t.isThreat, r1: 100, holding });
  return scoreTask({ weights: scoringWeights(ex.rubrics, 'F1'), values, critical: [], voids: [] }).score;
}

/**
 * A practical task (03 §5.1): kind, cap, rubrics (weights sum to 100) with the facts they need (R3 objective, R5 holding
 * predicate, R2 development, R6 line share window + tree), a verified threat at the start of hold / convert tasks, the
 * scripted tree under the `line` rules, and for F1 tasks (plan, hold) the scoring-leaf rule: every accepted tree move
 * continues or ends in a leaf, leaves only at selective nodes (credited ≤ 1/3 of the guard-passing moves), and the
 * position at each leaf reaches the pass mark.
 */
function validatePlay(ex: Obj, start: Position, checkKey: (field: string, value: unknown, optional?: boolean) => void): string[] {
  const problems: string[] = [...guardOverrideProblems(ex.guard, 'guard')];
  for (const key of Object.keys(ex)) if (!PLAY_FIELDS.includes(key) && !META_FIELDS.includes(key) && !['fen', 'pieces', 'turn'].includes(key)) problems.push(`"${key}" is not a play-task field`);
  if (typeof ex.task !== 'string' || !TASK_KINDS.includes(ex.task as never)) problems.push(`"task" must be one of ${TASK_KINDS.join(', ')}`);
  if (!(Number.isInteger(ex.cap) && (ex.cap as number) >= 1 && (ex.cap as number) <= 80)) problems.push('"cap" must be an integer 1–80 (learner moves)');
  const rubrics = Array.isArray(ex.rubrics) ? (ex.rubrics as unknown[]) : null;
  const used = new Set<string>();
  if (!rubrics || rubrics.length === 0) problems.push('"rubrics" must list at least one { "rubric": "R0"–"R6", "weight" }');
  else {
    let total = 0;
    rubrics.forEach((r, i) => {
      if (!isObj(r) || typeof r.rubric !== 'string' || !RUBRIC_IDS.includes(r.rubric as never) || r.rubric === 'R7') return void problems.push(`rubrics[${i}].rubric must be one of R0–R6 (R7 is the review task)`);
      if (!(typeof r.weight === 'number' && r.weight > 0 && r.weight <= 100)) problems.push(`rubrics[${i}].weight must be a number in (0, 100]`);
      else total += r.weight;
      if (used.has(r.rubric)) problems.push(`rubrics[${i}]: ${r.rubric} is listed twice`);
      used.add(r.rubric);
    });
    if (Math.abs(total - 100) > 1e-6) problems.push(`rubric weights must sum to 100 (got ${total})`);
  }
  if (used.has('R3') && ex.objective === undefined) problems.push('R3 needs an "objective" predicate');
  if (ex.objective !== undefined) problems.push(...predicateErrors(ex.objective, start, 'objective'));
  if (used.has('R5') && ex.holding === undefined) problems.push('R5 needs a "holding" predicate (without it R5 is at most 70, below the pass mark)');
  if (ex.holding !== undefined) {
    if (!isObj(ex.holding)) problems.push('"holding" must be { "predicate", "when"?: "end" | "any-move" }');
    else {
      problems.push(...predicateErrors(ex.holding.predicate, start, 'holding.predicate'));
      if (ex.holding.when !== undefined && ex.holding.when !== 'end' && ex.holding.when !== 'any-move') problems.push('"holding.when" must be "end" or "any-move"');
    }
  }
  if ((used.has('R2') || used.has('R6') || ex.task === 'game') && ex.development === undefined) problems.push('R2 / R6 (and full games, scored with R2 under F2) need "development" { "n", "target" }');
  if (ex.development !== undefined) {
    const d = ex.development;
    if (!isObj(d) || !(Number.isInteger(d.n) && (d.n as number) >= 1 && (d.n as number) <= 30) || !(Number.isInteger(d.target) && (d.target as number) >= 1 && (d.target as number) <= 12)) {
      problems.push('"development" must be { "n": 1–30 learner moves, "target": 1–12 developed pieces }');
    }
  }
  const needsShare = used.has('R6') || ex.f2b === true;
  if (needsShare && ex.lineShare === undefined) problems.push('R6 and F2b need "lineShare" (the window L, ≥ 6 counted moves)');
  if (ex.lineShare !== undefined && !(Number.isInteger(ex.lineShare) && (ex.lineShare as number) >= 6 && (ex.lineShare as number) <= 30)) problems.push('"lineShare" must be an integer 6–30');
  if (needsShare && ex.tree === undefined) problems.push('R6 and F2b need a scripted "tree"');
  if (ex.f2b !== undefined && (ex.f2b !== true || ex.task !== 'game')) problems.push('"f2b": true only on "game" tasks');
  if (ex.measured !== undefined && (typeof ex.measured !== 'boolean' || ex.task !== 'convert')) problems.push('"measured" (resist mode at k = d = 3) only on "convert" tasks');
  if (ex.measured === true && start.board.filter(Boolean).length > 12) problems.push('"measured": depth 3 only in positions of at most 12 pieces (runtime budget)');
  for (const flag of ['safetyGate', 'resistance'] as const) if (ex[flag] !== undefined && typeof ex[flag] !== 'boolean') problems.push(`"${flag}" must be true or false`);
  if (ex.passMark !== undefined && !(typeof ex.passMark === 'number' && ex.passMark > 0 && ex.passMark <= 100)) problems.push('"passMark" must be a number in (0, 100]');
  if (ex.reference !== undefined) {
    const ok = Array.isArray(ex.reference) && ex.reference.every((line) => Array.isArray(line) && line.every((k) => parseMoveKey(k) !== null));
    if (!ok) problems.push('"reference" must be a list of learner lines (lists of moves like "h2-e2")');
  }
  // §5.7 item 4: R1 is always paired with another rubric (pure caution never passes a task).
  if (used.size === 1 && used.has('R1')) problems.push('R1 must be paired with another rubric (03 §5.7 item 4)');
  // F5 scores only R6 (line share, R2), R1, R2, R3: an opening task must keep R6, and must not reduce to R1 alone.
  if (ex.task === 'opening' && rubrics && problems.length === 0) {
    const f5 = scoringWeights(ex.rubrics as never, 'F5').map((w) => w.term);
    if (!f5.includes('R6')) problems.push('opening tasks need R6 (their fallback F5 scores the line share)');
    else if (f5.every((t) => t === 'R1')) problems.push('opening tasks must not reduce to R1 alone under F5');
  }
  // F5: only own-side predicates in R3 (03 §5.2 F5 item 3).
  if (ex.task === 'opening' && used.has('R3') && usesThreat(ex.objective)) problems.push('opening tasks (F5) may use only own-side predicates in R3: no "threat"');
  if (problems.length) return problems;

  const side = (ex.side ?? 'red') as 'red' | 'black';
  const opponent = side === 'red' ? 'black' : 'red';
  const guard = resolveGuard({ itemId: ex.id as string | undefined, override: ex.guard as never });
  // 04 §5.5 item 1: hold and convert tasks start from a verified threat (counter-threat) of the opponent.
  if (ex.task === 'hold' || ex.task === 'convert') {
    const t = threatOf(start, opponent, guard, { maxNodes: TABLE_MAX_NODES });
    if (t.status !== 'checked') problems.push('the opponent\'s threat at the start could not be checked within the node limit');
    else if (!t.isThreat) problems.push(`"${String(ex.task)}" tasks start from a verified threat: ${capital(opponent)} (moving) has no forced mate within k nor a gain ≥ T here`);
  }
  if (ex.tree !== undefined) {
    const asLine: Obj = { type: 'line', id: ex.id, side: ex.side, guard: ex.guard, misconceptions: ex.misconceptions, objective: ex.objective, root: ex.tree };
    for (const p of validateLine(asLine, start, checkKey)) problems.push(`tree: ${p}`);
    if (problems.length) return problems;
    if (ex.task === 'plan' || ex.task === 'hold') {
      const task = ex as unknown as PlayExercise;
      const passMark = task.passMark ?? PASS_MARK;
      const walk = (node: Obj, cur: Position, moves: Move[], where: string) => {
        const table = (node.table as Obj[]) ?? [];
        const passing = table.filter((r) => r.class !== 'error').length;
        const credited = table.filter((r) => isAccepted(r.class as never));
        const selective = credited.length > 0 && credited.length * 3 <= passing;
        const next = (node.next ?? {}) as Record<string, Obj>;
        for (const row of credited) {
          const key = row.move as string;
          const child = next[key];
          const m = parseMoveKey(key)!;
          if (child === undefined) {
            problems.push(`tree ${where}: F1 needs a continuation or a scoring leaf for every accepted move; ${key} has none`);
            continue;
          }
          if (child.kind === 'leaf') {
            if (!selective) problems.push(`tree ${where}: a scoring leaf at a non-selective node (${credited.length} of ${passing} guard-passing moves credited > 1/3): give ${key} a continuation`);
            const score = leafScore(task, start, [...moves, m]);
            if (score === null) problems.push(`tree ${where}>${key}: the scoring leaf could not be evaluated within the node limit`);
            else if (score < passMark) problems.push(`tree ${where}>${key}: the scoring leaf scores ${score} < ${passMark} (03 §5.2 F1): continue the tree instead`);
            continue;
          }
          if (child.kind === 'opponent') {
            const after = makeMove(cur, m);
            for (const reply of (child.replies as Obj[]) ?? []) {
              const r = parseMoveKey(reply.move);
              const n = reply.next as Obj | undefined;
              if (!r || !isObj(n)) continue;
              const at = `${where}>${key}>${String(reply.move)}`;
              if (n.kind === 'leaf') {
                // A leaf after an authored reply also ends the task under F1: the same selectivity and pass-mark rule,
                // scored on the position after the reply (else a shuffler could end the task early there).
                if (!selective) problems.push(`tree ${at}: a scoring leaf reached through a non-selective node (${credited.length} of ${passing} guard-passing moves credited > 1/3): continue the tree instead`);
                const score = leafScore(task, start, [...moves, m, r]);
                if (score === null) problems.push(`tree ${at}: the scoring leaf could not be evaluated within the node limit`);
                else if (score < passMark) problems.push(`tree ${at}: the scoring leaf scores ${score} < ${passMark} (03 §5.2 F1): continue the tree instead`);
                continue;
              }
              if (n.kind === 'learner') walk(n, makeMove(after, r), [...moves, m, r], at);
            }
          }
        }
      };
      walk(ex.tree as Obj, start, [], 'root');
    }
  }
  return problems;
}

/** Signal size of a learner move for the review's turning points: its R1 deduction (0 = none). */
function reviewCategory(penalty: string | null): string | null {
  if (penalty === null) return null;
  return penalty === 'serious-allowed-loss' ? 'allowed-loss' : penalty;
}

/**
 * A `review` (03 §5.3 R7): a legal game; 1–3 turning points at learner moves, largest first, each a complete decision
 * table of the position before the move (the played move not accepted) and the category the level's signals detect;
 * no unlisted learner move has a larger R1 deduction than the smallest listed one (the top turning points).
 */
function validateReview(ex: Obj, start: Position, checkKey: (field: string, value: unknown, optional?: boolean) => void): string[] {
  const problems: string[] = [...guardOverrideProblems(ex.guard, 'guard')];
  for (const key of Object.keys(ex)) if (!['type', 'prompt', 'moves', 'turningPoints', 'guard', 'passMark', 'explanation'].includes(key) && !META_FIELDS.includes(key) && !['fen', 'pieces', 'turn'].includes(key)) problems.push(`"${key}" is not a review field`);
  if (!Array.isArray(ex.moves) || ex.moves.length < 2) return [...problems, '"moves" must list the game\'s moves ("h2-e2"), at least two'];
  const positions: Position[] = [start];
  for (const [i, key] of (ex.moves as unknown[]).entries()) {
    const m = parseMoveKey(key);
    const cur = positions[positions.length - 1];
    if (!m || !legalMoves(cur).some((x) => x.from === m.from && x.to === m.to)) return [...problems, `moves[${i}] ${JSON.stringify(key)} is not a legal move`];
    positions.push(makeMove(cur, m));
  }
  if (ex.passMark !== undefined && !(typeof ex.passMark === 'number' && ex.passMark > 0 && ex.passMark <= 100)) problems.push('"passMark" must be a number in (0, 100]');
  const tps = ex.turningPoints;
  if (!Array.isArray(tps) || tps.length < 1) return [...problems, '"turningPoints" must list the top turning points (1–3, more only for ties)'];
  if (problems.length) return problems;
  const side = ex.side ?? 'red';
  const guard = resolveGuard({ itemId: ex.id as string | undefined, override: ex.guard as never });
  const limits = { maxNodes: TABLE_MAX_NODES };
  const moves = (ex.moves as string[]).map((k) => parseMoveKey(k)!);
  // The learner's signals for every learner move (sizes = R1 deductions).
  const sizes = new Map<number, { size: number; category: string | null }>();
  for (let ply = 0; ply < moves.length; ply++) {
    if (positions[ply].turn !== side) continue;
    const sig = moveSignals(positions[ply], moves[ply], guard, { ...limits });
    if (sig.status !== 'checked') return [...problems, `moves[${ply}]: the signals could not be computed within the node limit`];
    sizes.set(ply, { size: sig.penalty ? R1_DEDUCTIONS[sig.penalty] : 0, category: reviewCategory(sig.penalty) });
  }
  const listed: number[] = [];
  (tps as unknown[]).forEach((tp, i) => {
    const where = `turningPoints[${i}]`;
    if (!isObj(tp)) return void problems.push(`${where} must be { "ply", "category", "table", "objective"?, "text"? }`);
    for (const key of Object.keys(tp)) if (!['ply', 'category', 'table', 'objective', 'text'].includes(key)) problems.push(`${where}.${key} is not a turning-point field`);
    const ply = tp.ply as number;
    if (!(Number.isInteger(ply) && ply >= 0 && ply < moves.length) || !sizes.has(ply)) return void problems.push(`${where}.ply must index a learner move of "moves"`);
    if (listed.includes(ply)) problems.push(`${where}: ply ${ply} is listed twice`);
    listed.push(ply);
    if (typeof tp.category !== 'string' || !REVIEW_CATEGORIES.includes(tp.category as never)) problems.push(`${where}.category must be one of ${REVIEW_CATEGORIES.join(', ')}`);
    else if (sizes.get(ply)!.category !== tp.category) problems.push(`${where}: the level's signals detect ${JSON.stringify(sizes.get(ply)!.category)} at ply ${ply}, not "${tp.category}"`);
    checkKey(`${where}.text`, tp.text, true);
    const asDecision: Obj = { id: ex.id, guard: ex.guard, misconceptions: ex.misconceptions, table: tp.table, objective: tp.objective };
    for (const p of validateDecision(asDecision, positions[ply], (f, v, o) => checkKey(`${where}.${f}`, v, o))) problems.push(`${where}: ${p}`);
    const played = Array.isArray(tp.table) ? (tp.table as Obj[]).find((r) => isObj(r) && r.move === moveKey(moves[ply])) : undefined;
    if (played && isAccepted(played.class as never)) problems.push(`${where}: the game's move ${moveKey(moves[ply])} must not be accepted (it is the mistake)`);
  });
  if (problems.length) return problems;
  const sizeOf = (ply: number) => sizes.get(ply)!.size;
  for (let i = 1; i < listed.length; i++) if (sizeOf(listed[i]) > sizeOf(listed[i - 1])) problems.push('turning points must be listed largest first');
  // The top min(3, moves with a signal) by deduction, every move tied at the cutoff included (the cap rises for ties).
  const signalled = [...sizes].filter(([, v]) => v.size > 0).sort((a, b) => b[1].size - a[1].size);
  if (signalled.length > 0) {
    const cutoff = signalled[Math.min(3, signalled.length) - 1][1].size;
    const required = signalled.filter(([, v]) => v.size >= cutoff).map(([ply]) => ply);
    for (const ply of required) if (!listed.includes(ply)) problems.push(`ply ${ply} (deduction ${sizeOf(ply)}) is one of the top turning points: list it (with its table)`);
    for (const ply of listed) if (!required.includes(ply)) problems.push(`ply ${ply} is not one of the top turning points`);
  }
  return problems;
}

/** A `choice`: 3–4 options, unique ids, a key (exactly one correct unless `multi`), per-option feedback. */
function validateChoice(ex: Obj, pos: Position, checkKey: (field: string, value: unknown, optional?: boolean) => void): string[] {
  const problems: string[] = [];
  if (ex.multi !== undefined && typeof ex.multi !== 'boolean') problems.push('"multi" must be true or false');
  const options = ex.options;
  if (!Array.isArray(options) || options.length < 3 || options.length > 4) return [...problems, '"options" must list 3 or 4 options'];
  const ids = new Set<string>();
  options.forEach((o, i) => {
    const where = `options[${i}]`;
    if (!isObj(o)) return problems.push(`${where} must be an object`);
    for (const key of Object.keys(o)) if (!['id', 'text', 'move', 'correct', 'feedback', 'misconception', 'fixed'].includes(key)) problems.push(`${where}.${key} is not an option field`);
    if (typeof o.id !== 'string' || !/^[a-z0-9-]+$/.test(o.id)) problems.push(`${where}.id must be a short id like "a" or "none"`);
    else if (ids.has(o.id)) problems.push(`${where}: id "${o.id}" is used twice`);
    else ids.add(o.id);
    if (o.text === undefined && o.move === undefined) problems.push(`${where} needs "text", "move" or both`);
    checkKey(`${where}.text`, o.text, true);
    if (o.move !== undefined) {
      const m = parseMoveKey(o.move);
      if (!m || !legalMoves(pos).some((l) => l.from === m.from && l.to === m.to)) problems.push(`${where}.move must be a legal move like "h2-e2"`);
    }
    if (typeof o.correct !== 'boolean') problems.push(`${where}.correct must be true or false`);
    checkKey(`${where}.feedback`, o.feedback);
    if (o.fixed !== undefined && typeof o.fixed !== 'boolean') problems.push(`${where}.fixed must be true or false`);
    if (o.correct === false && o.misconception === undefined) problems.push(`${where}: a distractor needs a "misconception" id`);
    if (o.correct === true && o.misconception !== undefined) problems.push(`${where}: a correct option has no misconception`);
    problems.push(...misconceptionProblems(ex, `${where}.misconception`, o.misconception));
  });
  const correct = options.filter((o) => isObj(o) && o.correct === true).length;
  if (ex.multi === true) {
    if (correct === 0 || correct === options.length) problems.push('a multi-select needs at least one correct and one wrong option');
  } else if (correct !== 1) problems.push(`a single-select needs exactly one correct option, found ${correct}`);
  return problems;
}

function validateCombination(
  ex: Obj,
  pos: Position,
  checkKey: (field: string, value: unknown, optional?: boolean) => void,
  options: ValidateOptions,
): string[] {
  if (ex.goal !== 'checkmate' && ex.goal !== 'win-material') return ['"goal" must be "checkmate" or "win-material"'];
  const maxMoves = ex.goal === 'checkmate' ? 4 : 3;
  if (typeof ex.moves !== 'number' || !Number.isInteger(ex.moves) || ex.moves < 2 || ex.moves > maxMoves) {
    return [`"moves" must be 2 to ${maxMoves}`];
  }
  const combo = ex as unknown as CombinationExercise;
  const line = ex.solution;
  if (!Array.isArray(line) || !line.every((s) => isObj(s) && isSquareName(s.from) && isSquareName(s.to))) {
    return ['"solution" must be a list of { "from": square, "to": square }'];
  }
  if (line.length % 2 !== 1 || line.length > combo.moves * 2 - 1) {
    return [`"solution" must alternate Red/Black, end with a Red move and have at most ${combo.moves * 2 - 1} moves`];
  }
  if (ex.hints !== undefined) {
    if (!Array.isArray(ex.hints) || ex.hints.length > combo.moves) return ['"hints" must be a list with at most one key per Red move'];
    ex.hints.forEach((h, i) => checkKey(`hints[${i}]`, h));
  }
  const problems: string[] = [];
  if (ex.variedDefence !== undefined && typeof ex.variedDefence !== 'boolean') return ['"variedDefence" must be true or false'];
  // The longest-resistance set needs mate searches up to depth moves − 2 on the main thread at runtime; mates in 4 (depth 3)
  // are not measured within the budget (S2.6), so varied defence is limited to 2–3 learner moves for now.
  if (ex.variedDefence === true && combo.moves >= 4) return ['"variedDefence" is limited to combinations of 2 or 3 learner moves (runtime budget)'];
  if (combo.moves >= 4 && ex.firstMoves === undefined) return ['"firstMoves" is required when "moves" is 4'];
  if (ex.firstMoves !== undefined) {
    const first = ex.firstMoves;
    if (!Array.isArray(first) || first.length === 0 || !first.every((s) => isObj(s) && isSquareName(s.from) && isSquareName(s.to))) {
      return ['"firstMoves" must be a non-empty list of { "from": square, "to": square }'];
    }
    for (const m of first as { from: string; to: string }[]) {
      const move = { from: parseSquare(m.from), to: parseSquare(m.to) };
      if (!legalMoves(pos).some((l) => sameMove(l, move))) return [`firstMoves ${m.from}-${m.to} is not legal`];
      // Proving a first move of a mate in 4 can take a minute on a full board: deep mode only. The quick
      // checks below still play the stored main line against the best defence.
      if (options.deep && !searchWinningMove(combo, pos, 0, move)) problems.push(`firstMoves ${m.from}-${m.to} does not win`);
    }
    if (!first.some((m) => isObj(m) && m.from === line[0]?.from && m.to === line[0]?.to)) {
      problems.push('"firstMoves" must include the first move of "solution"');
    }
    if (options.deep) {
      // Completeness: no other first move wins (slow for a mate in 4; run with `npm run content:deep`).
      const missing = legalMoves(pos).filter((m) => !first.some((f) => sameMove(toMove(f as never), m)) && searchWinningMove(combo, pos, 0, m));
      for (const m of missing) problems.push(`firstMoves is missing the winning move ${squareName(m.from)}-${squareName(m.to)}`);
    }
  }
  if (combo.goal === 'checkmate') {
    // With firstMoves the deep check proves the mate (each listed move wins); otherwise prove it here.
    if ((ex.firstMoves === undefined || options.deep) && !hasForcedWin(pos, combo.moves)) return [`Red has no forced mate in ${combo.moves}`];
    if (hasForcedWin(pos, combo.moves - 1)) problems.push(`Red already mates in ${combo.moves - 1}; lower "moves"`);
  }
  if (legalMoves(pos).every((m) => isWinningMove(combo, pos, 0, m))) problems.push('every first move wins, so nothing is tested');

  // Play the stored line: each Red move must be accepted, each Black reply a best defence.
  let cur = pos;
  /** Varied defence: some opponent step of the stored line has two or more best replies. */
  let branches = false;
  for (let step = 0; step < line.length; step++) {
    const move = { from: parseSquare(line[step].from as string), to: parseSquare(line[step].to as string) };
    const name = `solution[${step}] ${line[step].from}-${line[step].to}`;
    if (!legalMoves(cur).some((m) => sameMove(m, move))) return [...problems, `${name} is not legal`];
    if (step % 2 === 0) {
      const verdict = checkCombinationMove(combo, step, cur, move);
      if (verdict !== 'correct') return [...problems, `${name} is not accepted (${verdict})`];
    } else {
      if (!bestCombinationReplies(combo, cur, step).some((m) => sameMove(m, move))) problems.push(`${name} is not a best defence`);
      // Varied defence draws from the longest-resistance replies only (`variedDefenceReplies`).
      if (ex.variedDefence === true && variedDefenceReplies(combo, cur, step).length >= 2) branches = true;
    }
    const after = makeMove(cur, move);
    if (step % 2 === 0 && combinationDone(combo, after, step) !== (step === line.length - 1)) {
      return [...problems, `${name}: the line must end exactly when the goal is reached`];
    }
    cur = after;
  }
  if (combo.goal === 'checkmate' && gameStatus(cur).kind !== 'checkmate') problems.push('the stored line does not end in checkmate');
  if (ex.variedDefence === true && !branches) problems.push('"variedDefence": the defender has only one best reply at every step of the stored line, so nothing varies');
  return problems;
}

/** Throws with every problem listed if the content is invalid; otherwise returns it typed. */
export function assertValidUnits(input: unknown): Unit[] {
  const errors = validateUnits(input);
  if (errors.length) throw new Error(`Invalid lesson content:\n${errors.join('\n')}`);
  return input as Unit[];
}
