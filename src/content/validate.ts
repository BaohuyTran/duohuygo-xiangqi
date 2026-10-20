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
  winningMoves,
} from '../lessons/combination';
import { sameMove } from '../puzzles/logic';
import type { CombinationExercise, Exercise, Unit } from './types';

const REGIONS = ['red-palace', 'black-palace', 'red-side', 'black-side'];
const EXERCISE_TYPES = ['learn', 'move', 'select-squares', 'capture', 'combination'];
const GOALS = ['reach', 'any', 'check', 'checkmate', 'defend'];
const TRACKS = ['basics', 'intermediate'];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isSquareName = (v: unknown): v is string => typeof v === 'string' && /^[a-i][0-9]$/.test(v);

/** Returns a list of human-readable problems; empty means the content is valid. */
export function validateUnits(input: unknown): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const err = (where: string, msg: string) => errors.push(`${where}: ${msg}`);

  const checkId = (where: string, id: unknown) => {
    if (typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id)) return err(where, `invalid id ${JSON.stringify(id)}`);
    if (ids.has(id)) err(where, `duplicate id "${id}"`);
    ids.add(id);
  };
  const checkKey = (where: string, field: string, value: unknown, optional = false) => {
    if (value === undefined && optional) return;
    if (typeof value !== 'string') return err(where, `"${field}" must be an i18n key string`);
    if (!hasMessage(value)) err(where, `"${field}" key "${value}" is missing from src/i18n/messages.ts`);
  };

  if (!Array.isArray(input) || input.length === 0) return ['content: expected a non-empty array of units'];
  /** Track -> index of its last unit so far. */
  const seenTracks = new Map<unknown, number>();

  input.forEach((unit, ui) => {
    const uw = `unit[${ui}]`;
    if (!isObj(unit)) return err(uw, 'must be an object');
    checkId(uw, unit.id);
    checkKey(uw, 'title', unit.title);
    checkKey(uw, 'description', unit.description);
    if (unit.track !== undefined && (typeof unit.track !== 'string' || !TRACKS.includes(unit.track))) {
      err(uw, `"track" must be one of ${TRACKS.join(', ')}`);
    }
    const track = unit.track ?? 'basics';
    if (seenTracks.has(track) && seenTracks.get(track) !== ui - 1) err(uw, `units of track "${String(track)}" must be consecutive`);
    seenTracks.set(track, ui);
    if (!Array.isArray(unit.lessons) || unit.lessons.length === 0) return err(uw, '"lessons" must be a non-empty array');

    unit.lessons.forEach((lesson, li) => {
      const lw = `${String(unit.id)}/lesson[${li}]`;
      if (!isObj(lesson)) return err(lw, 'must be an object');
      checkId(lw, lesson.id);
      checkKey(lw, 'title', lesson.title);
      if (!Array.isArray(lesson.exercises) || lesson.exercises.length === 0) {
        return err(lw, '"exercises" must be a non-empty array');
      }
      lesson.exercises.forEach((ex, ei) => {
        const ew = `${String(lesson.id)}/exercise[${ei}]`;
        for (const problem of validateExercise(ex, checkKey.bind(null, ew))) err(ew, problem);
      });
    });
  });
  return errors;
}

function validateExercise(ex: unknown, checkKey: (field: string, value: unknown, optional?: boolean) => void): string[] {
  const problems: string[] = [];
  if (!isObj(ex)) return ['must be an object'];
  if (typeof ex.type !== 'string' || !EXERCISE_TYPES.includes(ex.type)) return [`unknown type ${JSON.stringify(ex.type)}`];

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
  const opponent = pos.turn === 'red' ? 'black' : 'red';
  if (isGeneralAttacked(pos.board, opponent)) problems.push(`illegal position: ${opponent} is in check but it is not their move`);
  if (ex.type !== 'learn' && pos.turn !== 'red') problems.push('exercises are played as Red: Red must be to move');
  if (ex.type !== 'learn' && legalMoves(pos).length === 0) problems.push('Red has no legal moves');
  if (problems.length) return problems;

  const redPieceAt = (field: string, name: unknown): boolean => {
    if (!isSquareName(name)) {
      problems.push(`"${field}" must be a square name like "e0"`);
      return false;
    }
    const p = pos.board[parseSquare(name)];
    if (!p || p.color !== 'red') {
      problems.push(`"${field}" ${name} must hold a Red piece`);
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
        if (pos.turn !== 'red') problems.push('"square" needs Red to move');
        else if (redPieceAt('square', ex.square) && legalMovesFrom(pos, parseSquare(ex.square as string)).length === 0 && !ex.allowNoMoves) {
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
      } else if (redPieceAt('square', ex.square) && expectedSelection(ex as never).length === 0) {
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
      if (ex.from !== undefined) redPieceAt('from', ex.from);
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
        // There must be a real threat: Black would mate in one if it were Black's move.
        if (!hasForcedWin({ ...pos, turn: 'black' }, 1)) problems.push('"defend": Black has no mate-in-one threat to stop');
        if (legalMoves(pos).every((m) => checkMove(ex as never, m) === 'correct')) problems.push('"defend": every move stops the threat');
      }
      if (goal.kind === 'checkmate') {
        // Avoid ambiguous "checkmate" puzzles where a quiet move would stalemate (also a win).
        const stalemating = legalMoves(pos).find((m) => gameStatus(makeMove(pos, m)).kind === 'stalemate');
        if (stalemating) {
          problems.push(`${squareName(stalemating.from)}-${squareName(stalemating.to)} stalemates; give Black a spare move`);
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
      problems.push(...validateCombination(ex, pos, checkKey));
      break;
  }
  return problems;
}

function validateCombination(ex: Obj, pos: Position, checkKey: (field: string, value: unknown, optional?: boolean) => void): string[] {
  if (ex.goal !== 'checkmate' && ex.goal !== 'win-material') return ['"goal" must be "checkmate" or "win-material"'];
  if (ex.moves !== 2 && ex.moves !== 3) return ['"moves" must be 2 or 3'];
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
  if (combo.goal === 'checkmate') {
    if (!hasForcedWin(pos, combo.moves)) return [`Red has no forced mate in ${combo.moves}`];
    if (hasForcedWin(pos, combo.moves - 1)) problems.push(`Red already mates in ${combo.moves - 1}; lower "moves"`);
  }
  if (winningMoves(combo, pos, 0).length === legalMoves(pos).length) problems.push('every first move wins, so nothing is tested');

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
