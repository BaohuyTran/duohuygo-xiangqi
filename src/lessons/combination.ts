// Answer checking and engine replies for combination exercises (several moves by the learner's side
// against a best defence). Everything is decided by the engine; the stored line is only the main line
// and the source of hints. Mirrors src/puzzles/logic.ts, which does the same for puzzles.
//
// Colour-neutral: the learner's side is the side to move in the start position (`start.turn`, which
// the validator requires to equal the exercise's `side`). "Learner" moves are at even line indexes,
// opponent replies at odd ones; legacy content is all Red, so there the learner is Red.
import type { CombinationExercise } from '../content/types';
import { forcedWinMoves, hasForcedWin, legalMoves, makeMove, materialBalance, moveScore, searchScore, type Move, type Position } from '../engine';
import { sameMove, toMove, WIN_MATERIAL_THRESHOLD } from '../puzzles/logic';
import { legality, positionOf } from './answers';

export type CombinationVerdict = 'correct' | 'wrong' | 'illegal' | 'unsafe';

/** Search horizon for win-material combinations, in plies from the start: every learner move and reply. */
export const combinationDepth = (ex: CombinationExercise): number => ex.moves * 2;

/** Learner moves still to make, including the one at line index `step` (even). */
export const learnerMovesLeft = (ex: CombinationExercise, step: number): number => ex.moves - step / 2;

/** Old name of `learnerMovesLeft` (the learner was always Red), kept for existing callers. */
export const redMovesLeft = learnerMovesLeft;

/**
 * Material the learner's side has gained after `move` at line index `step`, judged by a search to the
 * horizon. `moveScore` scores for the side playing `move` (the learner, as `step` is even), so the
 * baseline is the start material from that same side: the side to move at the start.
 */
export function combinationGain(ex: CombinationExercise, pos: Position, move: Move, step: number): number {
  const start = positionOf(ex);
  return moveScore(pos, move, combinationDepth(ex) - step) - materialBalance(start.board, start.turn);
}

/**
 * Does the legal learner `move` at line index `step` keep the combination winning? Only this move's
 * subtree is searched (a mate in 4 would take seconds to list every winning move), so the player
 * gets an answer quickly even in long combinations.
 */
export function isWinningMove(ex: CombinationExercise, pos: Position, step: number, move: Move): boolean {
  if (step === 0 && ex.firstMoves) return ex.firstMoves.some((m) => sameMove(toMove(m), move));
  return searchWinningMove(ex, pos, step, move);
}

/** isWinningMove decided by the engine alone, ignoring a stored `firstMoves` list. */
export function searchWinningMove(ex: CombinationExercise, pos: Position, step: number, move: Move): boolean {
  if (ex.goal === 'win-material') return combinationGain(ex, pos, move, step) >= WIN_MATERIAL_THRESHOLD;
  const after = makeMove(pos, move);
  const replies = legalMoves(after);
  if (replies.length === 0) return true; // checkmate (or stalemate, also a win)
  const left = learnerMovesLeft(ex, step) - 1;
  return left >= 1 && replies.every((r) => hasForcedWin(makeMove(after, r), left));
}

/** Every learner move at line index `step` from `pos` that keeps the combination winning. */
export function winningMoves(ex: CombinationExercise, pos: Position, step: number): Move[] {
  return legalMoves(pos).filter((m) => isWinningMove(ex, pos, step, m));
}

export function checkCombinationMove(ex: CombinationExercise, step: number, pos: Position, move: Move): CombinationVerdict {
  const illegal = legality(pos, move);
  if (illegal) return illegal === 'unsafe' ? 'unsafe' : 'illegal';
  return isWinningMove(ex, pos, step, move) ? 'correct' : 'wrong';
}

/**
 * The opponent's best replies at line index `step` (odd). Win-material: the lowest search score for the
 * learner. Mate with 1–2 learner moves left after the reply: the replies leaving the learner the fewest
 * winning answers. With 3 or more
 * left (long combinations), counting answers would take seconds, so the rule is "longest resistance":
 * the replies after which the learner has no shorter mate; when every reply allows one, all of them.
 */
export function bestCombinationReplies(ex: CombinationExercise, pos: Position, step: number): Move[] {
  const replies = legalMoves(pos);
  const left = learnerMovesLeft(ex, step + 1);
  if (ex.goal === 'checkmate' && left >= 3) {
    const resisting = replies.filter((r) => !hasForcedWin(makeMove(pos, r), left - 1));
    return resisting.length > 0 ? resisting : replies;
  }
  const score = (r: Move): number => {
    const after = makeMove(pos, r);
    if (ex.goal === 'win-material') return searchScore(after, combinationDepth(ex) - step - 1);
    return forcedWinMoves(after, left).length;
  };
  const scored = replies.map((r) => ({ r, s: score(r) }));
  const best = Math.min(...scored.map((x) => x.s));
  return scored.filter((x) => x.s === best).map((x) => x.r);
}

/** The opponent move to auto-play at line index `step`: the stored one while on the main line. */
export function combinationReply(ex: CombinationExercise, step: number, pos: Position, onMainLine: boolean): Move {
  const stored = ex.solution[step] ? toMove(ex.solution[step]) : null;
  if (onMainLine && stored && legalMoves(pos).some((m) => sameMove(m, stored))) return stored;
  return bestCombinationReplies(ex, pos, step)[0];
}

/** True once the learner has met the goal after its move at line index `step`. */
export function combinationDone(ex: CombinationExercise, after: Position, step: number): boolean {
  if (legalMoves(after).length === 0) return true;
  return step + 1 >= ex.moves * 2 - 1;
}
