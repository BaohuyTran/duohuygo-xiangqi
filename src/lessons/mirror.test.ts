// The judges take the mover from the position (S2.3): a colour-swapped copy of a legacy exercise,
// played as Black, gets the mirrored verdict for every move. The twin is built with `swapColours`
// (05-migration.md BLK: rank r -> 9 - r, colours and side to move exchanged).
import { describe, expect, it } from 'vitest';
import { fileOf, legalMoves, makeMove, parseSquare, pseudoLegalTargets, rankOf, squareName, toFen, toSquare, type Move, type Square } from '../engine';
import { findLesson } from '../content';
import { swapColours } from '../content/normalize';
import type { CaptureExercise, CombinationExercise, Exercise, MoveExercise } from '../content/types';
import { sameMove, toMove } from '../puzzles/logic';
import { checkCapture, checkMove, positionOf } from './answers';
import { bestCombinationReplies, checkCombinationMove, combinationDone, combinationGain, isWinningMove } from './combination';

const flipSq = (sq: Square): Square => toSquare(fileOf(sq), 9 - rankOf(sq));
const flipName = (name: string): string => squareName(flipSq(parseSquare(name)));
const flipMove = (m: Move): Move => ({ from: flipSq(m.from), to: flipSq(m.to) });
const flipStep = (s: { from: string; to: string }) => ({ from: flipName(s.from), to: flipName(s.to) });
const sortMoves = (ms: Move[]) => ms.map((m) => `${m.from}-${m.to}`).sort();

function exercise(ref: string): Exercise {
  const [lessonId, index] = ref.split('#');
  const ex = findLesson(lessonId)?.exercises[Number(index)];
  if (!ex) throw new Error(`no exercise ${ref}`);
  return ex;
}

/** The same exercise for Black: colour-swapped position (as a FEN), every square flipped. */
function blackTwin<T extends Exercise>(ex: T): T {
  const { pieces: _pieces, turn: _turn, ...rest } = ex as T & { pieces?: unknown; turn?: unknown };
  const twin: Record<string, unknown> = { ...rest, fen: toFen(swapColours(positionOf(ex))), side: 'black' };
  if ('from' in ex && typeof ex.from === 'string') twin.from = flipName(ex.from);
  if (ex.type === 'move') {
    twin.solution = flipStep(ex.solution);
    if (ex.goal.kind === 'reach') twin.goal = { ...ex.goal, squares: ex.goal.squares.map(flipName) };
  }
  if (ex.type === 'capture') twin.solution = flipStep(ex.solution);
  if (ex.type === 'combination') {
    twin.solution = ex.solution.map(flipStep);
    if (ex.firstMoves) twin.firstMoves = ex.firstMoves.map(flipStep);
  }
  return twin as T;
}

/** Every move of the learner's pieces to a pseudo-legal target, plus one impossible move per piece. */
function candidateMoves(ex: Exercise): Move[] {
  const pos = positionOf(ex);
  const moves: Move[] = [];
  pos.board.forEach((p, from) => {
    if (!p || p.color !== pos.turn) return;
    for (const to of pseudoLegalTargets(pos.board, from)) moves.push({ from, to });
    const far = toSquare((fileOf(from) + 4) % 9, (rankOf(from) + 5) % 10);
    if (far !== from) moves.push({ from, to: far });
  });
  return moves;
}

describe('colour-neutral judges: a Black twin of a legacy exercise gets mirrored verdicts', () => {
  it('builds Black-to-move twins', () => {
    const twin = blackTwin(exercise('u3l1#5'));
    expect(positionOf(twin).turn).toBe('black');
    expect(twin.side).toBe('black');
  });

  it.each(['u1l2#5', 'u3l1#5', 'u4l1#3', 'u4l1#4', 'u9l3#1', 'u11l3#1'])('move exercise %s', (ref) => {
    const ex = exercise(ref) as MoveExercise;
    const twin = blackTwin(ex);
    const verdicts = new Set<string>();
    for (const m of candidateMoves(ex)) {
      const verdict = checkMove(ex, m);
      verdicts.add(verdict);
      expect(checkMove(twin, flipMove(m)), `${ref} ${squareName(m.from)}-${squareName(m.to)}`).toBe(verdict);
    }
    expect(checkMove(twin, toMove(twin.solution))).toBe('correct');
    // The comparison covers right and wrong answers, not only one verdict.
    expect(verdicts.size).toBeGreaterThan(1);
  });

  it('move exercise with a "reach" goal and a required piece', () => {
    const ex: MoveExercise = {
      type: 'move',
      pieces: { e0: 'K', d9: 'k', a0: 'R', h7: 'r' },
      prompt: 'x',
      from: 'a0',
      goal: { kind: 'reach', squares: ['a7'] },
      solution: { from: 'a0', to: 'a7' },
    };
    const twin = blackTwin(ex);
    expect(twin.from).toBe('a9');
    for (const m of candidateMoves(ex)) expect(checkMove(twin, flipMove(m))).toBe(checkMove(ex, m));
    expect(checkMove(twin, toMove({ from: 'a9', to: 'a2' }))).toBe('correct');
    expect(checkMove(twin, toMove({ from: 'e9', to: 'e8' }))).toBe('wrong-piece');
  });

  it.each(['u1l2#3', 'u2l1#2', 'u3l1#3', 'u4l1#5'])('capture exercise %s', (ref) => {
    const ex = exercise(ref) as CaptureExercise;
    const twin = blackTwin(ex);
    for (const m of candidateMoves(ex)) {
      expect(checkCapture(twin, flipMove(m)), `${ref} ${squareName(m.from)}-${squareName(m.to)}`).toBe(checkCapture(ex, m));
    }
    expect(checkCapture(twin, toMove(twin.solution))).toBe('correct');
  });

  /** Plays the main line on both, comparing accepted moves, best replies and the end of the line. */
  function compareCombination(ref: string, allFirstMoves: boolean) {
    const ex = exercise(ref) as CombinationExercise;
    const twin = blackTwin(ex);
    let pos = positionOf(ex);
    let twinPos = positionOf(twin);
    if (allFirstMoves) {
      for (const m of legalMoves(pos)) {
        expect(checkCombinationMove(twin, 0, twinPos, flipMove(m)), `${ref} ${squareName(m.from)}-${squareName(m.to)}`).toBe(
          checkCombinationMove(ex, 0, pos, m),
        );
      }
    }
    ex.solution.forEach((step, i) => {
      const m = toMove(step);
      const tm = toMove(twin.solution[i]);
      expect(sameMove(tm, flipMove(m))).toBe(true);
      if (i % 2 === 0) {
        expect(checkCombinationMove(ex, i, pos, m)).toBe('correct');
        expect(checkCombinationMove(twin, i, twinPos, tm), `${ref} step ${i}`).toBe('correct');
        if (ex.goal === 'win-material') expect(combinationGain(twin, twinPos, tm, i)).toBe(combinationGain(ex, pos, m, i));
      } else {
        expect(sortMoves(bestCombinationReplies(twin, twinPos, i)), `${ref} step ${i}`).toEqual(sortMoves(bestCombinationReplies(ex, pos, i).map(flipMove)));
      }
      pos = makeMove(pos, m);
      twinPos = makeMove(twinPos, tm);
      if (i % 2 === 0) expect(combinationDone(twin, twinPos, i)).toBe(combinationDone(ex, pos, i));
    });
  }

  // Every win-material combination: the material judge measures the learner's side, not Red.
  it.each(['u9l1#1', 'u9l1#2', 'u9l1#3', 'u9l1#4', 'u9l1#5'])('win-material combination %s', (ref) => compareCombination(ref, true));
  it.each(['u7l1#4', 'u9l2#1'])('mate-in-2 combination %s', (ref) => compareCombination(ref, true));
  it('mate-in-3 combination u10l3#1 (main line)', () => compareCombination('u10l3#1', false));
  it('mate-in-4 combination u14l1#1 with firstMoves', () => {
    const ex = exercise('u14l1#1') as CombinationExercise;
    const twin = blackTwin(ex);
    const pos = positionOf(ex);
    const twinPos = positionOf(twin);
    for (const m of legalMoves(pos)) expect(isWinningMove(twin, twinPos, 0, flipMove(m))).toBe(isWinningMove(ex, pos, 0, m));
  });

});
