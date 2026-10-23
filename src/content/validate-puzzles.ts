// Validates puzzle content. Runs in the tests (src/content/puzzles.test.ts) and as the final gate in
// scripts/generate-puzzles.ts. A puzzle passes only if its position is legal, its goal is reached
// by the stored line, and its first move is the UNIQUE way to reach the goal (plus listed alternatives).
import {
  forcedWinMoves,
  gameStatus,
  isGeneralAttacked,
  isWinScore,
  legalMoves,
  makeMove,
  moveScore,
  squareName,
  type Move,
  type Position,
} from '../engine';
import { hasMessage } from '../i18n/messages';
import {
  acceptedFirstMoves,
  bestReplies,
  checkPuzzleMove,
  materialGain,
  sameMove,
  startPosition,
  toMove,
  WIN_MATERIAL_DEPTH,
  WIN_MATERIAL_THRESHOLD,
} from '../puzzles/logic';
import { placementProblems } from './legality';
import { PUZZLE_GOALS, PUZZLE_THEMES, type Puzzle } from './puzzle-types';

const isSquareName = (v: unknown): v is string => typeof v === 'string' && /^[a-i][0-9]$/.test(v);
const fmt = (m: Move) => `${squareName(m.from)}-${squareName(m.to)}`;
const sameSet = (a: Move[], b: Move[]) => a.length === b.length && a.every((m) => b.some((n) => sameMove(m, n)));

/** Problems with one puzzle; empty means valid. */
export function validatePuzzle(input: unknown): string[] {
  const problems: string[] = [];
  if (typeof input !== 'object' || input === null) return ['must be an object'];
  const p = input as Record<string, unknown>;

  if (typeof p.id !== 'string' || !/^[a-z0-9-]+$/.test(p.id)) problems.push(`invalid id ${JSON.stringify(p.id)}`);
  if (!PUZZLE_GOALS.includes(p.goal as never)) problems.push(`unknown goal ${JSON.stringify(p.goal)}`);
  if (!PUZZLE_THEMES.includes(p.theme as never)) problems.push(`unknown theme ${JSON.stringify(p.theme)}`);
  if (!Number.isInteger(p.difficulty) || (p.difficulty as number) < 1 || (p.difficulty as number) > 5) {
    problems.push('difficulty must be an integer from 1 to 5');
  }
  if (p.sideToMove !== 'red') problems.push('sideToMove must be "red" (the player always plays Red for now)');
  const steps = p.solution;
  if (!Array.isArray(steps) || steps.length === 0) return [...problems, 'solution must be a non-empty array'];
  const expectedLengths = p.goal === 'mate-in-1' ? [1] : p.goal === 'mate-in-2' ? [3] : [1, 3];
  if (!expectedLengths.includes(steps.length)) problems.push(`solution for ${String(p.goal)} must have ${expectedLengths.join(' or ')} moves`);
  steps.forEach((s: unknown, i) => {
    const step = s as Record<string, unknown>;
    if (!isSquareName(step?.from) || !isSquareName(step?.to)) problems.push(`solution[${i}] must be { from, to } squares`);
    if (step?.hint !== undefined) {
      if (i % 2 === 1) problems.push(`solution[${i}] is a defender move and cannot have a hint`);
      else if (typeof step.hint !== 'string' || !hasMessage(step.hint)) problems.push(`solution[${i}].hint ${JSON.stringify(step.hint)} is not an i18n key`);
    }
  });
  if (p.alternatives !== undefined) {
    if (!Array.isArray(p.alternatives) || !p.alternatives.every((a: Record<string, unknown>) => isSquareName(a?.from) && isSquareName(a?.to))) {
      problems.push('alternatives must be a list of { from, to } squares');
    }
  }
  if (problems.length) return problems;
  const puzzle = input as Puzzle;

  // ----- Position legality -----
  let pos: Position;
  try {
    pos = startPosition(puzzle);
  } catch (e) {
    return [`invalid FEN: ${(e as Error).message}`];
  }
  if (pos.turn !== puzzle.sideToMove) problems.push(`sideToMove is ${puzzle.sideToMove} but the FEN says ${pos.turn}`);
  if (isGeneralAttacked(pos.board, 'black')) problems.push('illegal position: Black is in check (or the Generals face each other) with Red to move');
  problems.push(...placementProblems(pos.board));
  if (legalMoves(pos).length === 0) problems.push('the side to move has no legal moves');
  if (problems.length) return problems;

  // ----- The stored line is legal and judged correct -----
  let cur: Position | null = pos;
  for (let i = 0; i < puzzle.solution.length && cur; i++) {
    const move = toMove(puzzle.solution[i]);
    if (!legalMoves(cur).some((m) => sameMove(m, move))) {
      problems.push(`solution[${i}] ${fmt(move)} is not a legal move`);
      cur = null;
      break;
    }
    if (i % 2 === 0) {
      const verdict = checkPuzzleMove(puzzle, i, cur, move);
      if (verdict !== 'correct') problems.push(`solution[${i}] ${fmt(move)} is not accepted (${verdict})`);
    } else if (!bestReplies(puzzle, cur, i).some((m) => sameMove(m, move))) {
      problems.push(`solution[${i}] ${fmt(move)} is not one of the defender's best replies`);
    }
    cur = makeMove(cur, move);
  }
  for (const alt of puzzle.alternatives ?? []) {
    if (!legalMoves(pos).some((m) => sameMove(m, toMove(alt)))) problems.push(`alternative ${alt.from}-${alt.to} is not legal`);
  }

  // ----- Goal reached and unique (checked even when the stored line is broken) -----
  const accepted = acceptedFirstMoves(puzzle);
  const final = cur;
  switch (puzzle.goal) {
    case 'mate-in-1':
    case 'mate-in-2': {
      const n = puzzle.goal === 'mate-in-1' ? 1 : 2;
      if (final && gameStatus(final).kind !== 'checkmate') problems.push('the stored line does not end in checkmate');
      if (n === 2 && forcedWinMoves(pos, 1).length > 0) problems.push('there is already a mate in 1');
      // forcedWinMoves checks every defence: each listed move wins against any reply within n moves.
      const winning = forcedWinMoves(pos, n);
      if (!sameSet(winning, accepted)) {
        problems.push(`winning first moves are [${winning.map(fmt).join(', ')}], expected exactly [${accepted.map(fmt).join(', ')}]`);
      }
      break;
    }
    case 'win-material': {
      if (forcedWinMoves(pos, 2).length > 0) problems.push('a forced mate in 2 exists; use a mate puzzle instead');
      if (final) {
        const last = toMove(puzzle.solution[puzzle.solution.length - 1]);
        const beforeLast = puzzle.solution.length === 1 ? pos : makeMove(makeMove(pos, toMove(puzzle.solution[0])), toMove(puzzle.solution[1]));
        if (!beforeLast.board[last.to]) problems.push('the final player move must be a capture');
      }
      const gains = legalMoves(pos).map((m) => ({ m, score: moveScore(pos, m, WIN_MATERIAL_DEPTH), gain: materialGain(puzzle, pos, m, 0) }));
      if (gains.some((g) => isWinScore(g.score))) problems.push('the search finds a forced mate; use a mate puzzle instead');
      const winning = gains.filter((g) => g.gain >= WIN_MATERIAL_THRESHOLD).map((g) => g.m);
      if (!sameSet(winning, accepted)) {
        problems.push(`material-winning first moves are [${winning.map(fmt).join(', ')}], expected exactly [${accepted.map(fmt).join(', ')}]`);
      }
      break;
    }
  }
  return problems;
}

/** Problems across a whole puzzle file set: per-puzzle issues, duplicate ids/positions, ordering. */
export function validatePuzzles(puzzles: unknown[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const fens = new Set<string>();
  let lastDifficulty: Record<string, number> = {};
  for (const [i, raw] of puzzles.entries()) {
    const p = raw as Partial<Puzzle>;
    const where = typeof p?.id === 'string' ? p.id : `puzzle[${i}]`;
    for (const problem of validatePuzzle(raw)) errors.push(`${where}: ${problem}`);
    if (typeof p?.id === 'string') {
      if (ids.has(p.id)) errors.push(`${where}: duplicate id`);
      ids.add(p.id);
    }
    if (typeof p?.fen === 'string') {
      const placement = p.fen.split(' ')[0];
      if (fens.has(placement)) errors.push(`${where}: duplicate position`);
      fens.add(placement);
    }
    if (typeof p?.goal === 'string' && typeof p.difficulty === 'number') {
      if (p.difficulty < (lastDifficulty[p.goal] ?? 0)) errors.push(`${where}: puzzles of each goal must be ordered by difficulty`);
      lastDifficulty = { ...lastDifficulty, [p.goal]: p.difficulty };
    }
  }
  return errors;
}
