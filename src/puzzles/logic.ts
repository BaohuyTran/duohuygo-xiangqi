// Runtime puzzle rules, shared by the player UI and the content validator. All decisions come
// from the engine and its solver; the stored solution is only used for the main line and hints.
import type { Puzzle } from '../content/puzzle-types';
import {
  forcedWinMoves,
  legalMoves,
  makeMove,
  materialBalance,
  moveScore,
  parseFen,
  parseSquare,
  searchScore,
  type Move,
  type Position,
} from '../engine';
import { legality } from '../lessons/answers';

/** A win-material puzzle must gain at least this much (2 = an advisor, elephant or two soldiers). */
export const WIN_MATERIAL_THRESHOLD = 2;
/** Search horizon for win-material puzzles, in plies from the starting position. */
export const WIN_MATERIAL_DEPTH = 4;

export const sameMove = (a: Move, b: Move): boolean => a.from === b.from && a.to === b.to;

export const toMove = (step: { from: string; to: string }): Move => ({ from: parseSquare(step.from), to: parseSquare(step.to) });

export const startPosition = (puzzle: Puzzle): Position => parseFen(puzzle.fen);

/** Player moves still to make, including the one at solution index `step`. */
export function attackerMovesLeft(puzzle: Puzzle, step: number): number {
  return Math.ceil((puzzle.solution.length - step) / 2);
}

/** Every first move that counts as correct. */
export function acceptedFirstMoves(puzzle: Puzzle): Move[] {
  return [puzzle.solution[0], ...(puzzle.alternatives ?? [])].map(toMove);
}

/** Material gain for the player after `move`, judged by a search to the puzzle's horizon. */
export function materialGain(puzzle: Puzzle, pos: Position, move: Move, plyIndex: number): number {
  const start = startPosition(puzzle);
  return moveScore(pos, move, WIN_MATERIAL_DEPTH - plyIndex) - materialBalance(start.board, start.turn);
}

export type PuzzleVerdict = 'correct' | 'wrong' | 'illegal' | 'unsafe';

/**
 * Judges the player's move at solution index `step` (always even) from position `pos`.
 * The first move must be the solution or a listed alternative; later moves are accepted whenever
 * the engine confirms they still achieve the goal (any mating move, any move keeping the win).
 */
export function checkPuzzleMove(puzzle: Puzzle, step: number, pos: Position, move: Move): PuzzleVerdict {
  if (legality(pos, move)) return legality(pos, move) === 'unsafe' ? 'unsafe' : 'illegal';
  if (step === 0) return acceptedFirstMoves(puzzle).some((m) => sameMove(m, move)) ? 'correct' : 'wrong';
  if (puzzle.goal === 'win-material') {
    return materialGain(puzzle, pos, move, step) >= WIN_MATERIAL_THRESHOLD ? 'correct' : 'wrong';
  }
  const left = attackerMovesLeft(puzzle, step);
  return forcedWinMoves(pos, left).some((m) => sameMove(m, move)) ? 'correct' : 'wrong';
}

/**
 * The defender's best replies in `pos` (defender to move), given `left` attacker moves remaining
 * after the reply. Mate puzzles: replies leaving the fewest winning answers. Win-material: replies
 * minimising the attacker's search score.
 */
export function bestReplies(puzzle: Puzzle, pos: Position, step: number): Move[] {
  const replies = legalMoves(pos);
  const score = (r: Move): number => {
    const after = makeMove(pos, r);
    if (puzzle.goal === 'win-material') return searchScore(after, WIN_MATERIAL_DEPTH - step - 1);
    return forcedWinMoves(after, attackerMovesLeft(puzzle, step + 1)).length;
  };
  const scored = replies.map((r) => ({ r, s: score(r) }));
  const best = Math.min(...scored.map((x) => x.s));
  return scored.filter((x) => x.s === best).map((x) => x.r);
}

/** The defender move to auto-play at solution index `step` (odd). */
export function defenderReply(puzzle: Puzzle, step: number, pos: Position, onMainLine: boolean): Move {
  const stored = toMove(puzzle.solution[step]);
  if (onMainLine && legalMoves(pos).some((m) => sameMove(m, stored))) return stored;
  return bestReplies(puzzle, pos, step)[0];
}
