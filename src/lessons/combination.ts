// Answer checking and engine replies for combination exercises (several Red moves against a best
// defence). Everything is decided by the engine; the stored line is only the main line and the
// source of hints. Mirrors src/puzzles/logic.ts, which does the same for puzzles.
import type { CombinationExercise } from '../content/types';
import { forcedWinMoves, legalMoves, makeMove, materialBalance, moveScore, searchScore, type Move, type Position } from '../engine';
import { sameMove, toMove, WIN_MATERIAL_THRESHOLD } from '../puzzles/logic';
import { legality, positionOf } from './answers';

export type CombinationVerdict = 'correct' | 'wrong' | 'illegal' | 'unsafe';

/** Search horizon for win-material combinations, in plies from the start: every Red move and Black reply. */
export const combinationDepth = (ex: CombinationExercise): number => ex.moves * 2;

/** Red moves still to make, including the one at line index `step` (even). */
export const redMovesLeft = (ex: CombinationExercise, step: number): number => ex.moves - step / 2;

/** Material Red has gained after `move` at line index `step`, judged by a search to the horizon. */
export function combinationGain(ex: CombinationExercise, pos: Position, move: Move, step: number): number {
  const start = positionOf(ex);
  return moveScore(pos, move, combinationDepth(ex) - step) - materialBalance(start.board, 'red');
}

/** Every Red move at line index `step` from `pos` that keeps the combination winning. */
export function winningMoves(ex: CombinationExercise, pos: Position, step: number): Move[] {
  if (ex.goal === 'checkmate') return forcedWinMoves(pos, redMovesLeft(ex, step));
  return legalMoves(pos).filter((m) => combinationGain(ex, pos, m, step) >= WIN_MATERIAL_THRESHOLD);
}

export function checkCombinationMove(ex: CombinationExercise, step: number, pos: Position, move: Move): CombinationVerdict {
  const illegal = legality(pos, move);
  if (illegal) return illegal === 'unsafe' ? 'unsafe' : 'illegal';
  return winningMoves(ex, pos, step).some((m) => sameMove(m, move)) ? 'correct' : 'wrong';
}

/** Black's best replies at line index `step` (odd): fewest winning answers, or the lowest Red score. */
export function bestCombinationReplies(ex: CombinationExercise, pos: Position, step: number): Move[] {
  const score = (r: Move): number => {
    const after = makeMove(pos, r);
    if (ex.goal === 'win-material') return searchScore(after, combinationDepth(ex) - step - 1);
    return forcedWinMoves(after, redMovesLeft(ex, step + 1)).length;
  };
  const scored = legalMoves(pos).map((r) => ({ r, s: score(r) }));
  const best = Math.min(...scored.map((x) => x.s));
  return scored.filter((x) => x.s === best).map((x) => x.r);
}

/** The Black move to auto-play at line index `step`: the stored one while on the main line. */
export function combinationReply(ex: CombinationExercise, step: number, pos: Position, onMainLine: boolean): Move {
  const stored = ex.solution[step] ? toMove(ex.solution[step]) : null;
  if (onMainLine && stored && legalMoves(pos).some((m) => sameMove(m, stored))) return stored;
  return bestCombinationReplies(ex, pos, step)[0];
}

/** True once Red has met the goal after its move at line index `step`. */
export function combinationDone(ex: CombinationExercise, after: Position, step: number): boolean {
  if (legalMoves(after).length === 0) return true;
  return step + 1 >= ex.moves * 2 - 1;
}
