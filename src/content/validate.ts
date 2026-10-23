// Validates lesson content. Runs in the test suite (src/content/content.test.ts), so a malformed
// or unsolvable lesson fails `npm test`.
import {
  gameStatus,
  hasForcedWin,
  isGeneralAttacked,
  legalMoves,
  legalMovesFrom,
  makeMove,
  parseSquare,
  squareName,
  type Position,
} from '../engine';
import { hasMessage } from '../i18n/messages';
import {
  bestCaptureGain,
  checkCapture,
  checkMove,
  expectedSelection,
  positionOf,
} from '../lessons/answers';
import {
  bestCombinationReplies,
  checkCombinationMove,
  combinationDone,
  isWinningMove,
  searchWinningMove,
} from '../lessons/combination';
import { sameMove, toMove } from '../puzzles/logic';
import { placementProblems } from './legality';
import retiredIdsFile from './retired-ids.json';
import {
  CONTENT_STATUSES,
  SOURCE_KINDS,
  STRANDS,
  TRANSFORMS,
  type CombinationExercise,
  type Exercise,
  type Track,
  type Unit,
} from './types';

const REGIONS = ['red-palace', 'black-palace', 'red-side', 'black-side'];
const EXERCISE_TYPES = ['learn', 'move', 'select-squares', 'capture', 'combination'];
const GOALS = ['reach', 'any', 'check', 'checkmate', 'defend'];
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
      lesson.exercises.forEach((ex, ei) => checkItem(`${String(lesson.id)}/exercise[${ei}]`, ex, itemId, newCourse, false));
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
      if ((ex.square === undefined) === (ex.region === undefined)) {
        problems.push('needs exactly one of "square" or "region"');
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
      const verdict = checkMove(ex as never, solution);
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
        if (legalMoves(pos).every((m) => checkMove(ex as never, m) === 'correct')) problems.push('"defend": every move stops the threat');
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
      // The win-material judge measures material for Red (src/lessons/combination.ts) until S2.3 makes
      // the judges colour-neutral; refuse rather than validate a Black item with a Red yardstick.
      if (side === 'black' && ex.goal === 'win-material') {
        problems.push('"win-material" combinations cannot be played as Black yet (the judge measures Red material)');
        break;
      }
      problems.push(...validateCombination(ex, pos, checkKey, options));
      break;
  }
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
  for (let step = 0; step < line.length; step++) {
    const move = { from: parseSquare(line[step].from as string), to: parseSquare(line[step].to as string) };
    const name = `solution[${step}] ${line[step].from}-${line[step].to}`;
    if (!legalMoves(cur).some((m) => sameMove(m, move))) return [...problems, `${name} is not legal`];
    if (step % 2 === 0) {
      const verdict = checkCombinationMove(combo, step, cur, move);
      if (verdict !== 'correct') return [...problems, `${name} is not accepted (${verdict})`];
    } else if (!bestCombinationReplies(combo, cur, step).some((m) => sameMove(m, move))) {
      problems.push(`${name} is not a best defence`);
    }
    const after = makeMove(cur, move);
    if (step % 2 === 0 && combinationDone(combo, after, step) !== (step === line.length - 1)) {
      return [...problems, `${name}: the line must end exactly when the goal is reached`];
    }
    cur = after;
  }
  if (combo.goal === 'checkmate' && gameStatus(cur).kind !== 'checkmate') problems.push('the stored line does not end in checkmate');
  return problems;
}

/** Throws with every problem listed if the content is invalid; otherwise returns it typed. */
export function assertValidUnits(input: unknown): Unit[] {
  const errors = validateUnits(input);
  if (errors.length) throw new Error(`Invalid lesson content:\n${errors.join('\n')}`);
  return input as Unit[];
}
