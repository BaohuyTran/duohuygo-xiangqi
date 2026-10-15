// The all-puzzles verification: every shipped puzzle has a legal position, a goal reached by its
// stored line, and a UNIQUE first move (checked by the validator, which searches every first move
// and every defence). Mate in 1 is re-checked here with a naive search that uses only public
// engine calls, independent of the solver's board-mutation code.
import { describe, expect, it } from 'vitest';
import { gameStatus, legalMoves, makeMove } from '../engine';
import { puzzles } from '../puzzles/catalog';
import { startPosition, toMove } from '../puzzles/logic';
import { validatePuzzles } from './validate-puzzles';

const byGoal = (goal: string) => puzzles.filter((p) => p.goal === goal);

describe('shipped puzzles', () => {
  it('has the target number of puzzles per goal', () => {
    expect(byGoal('mate-in-1')).toHaveLength(30);
    expect(byGoal('mate-in-2')).toHaveLength(20);
    expect(byGoal('win-material')).toHaveLength(10);
  });

  // validatePuzzles also checks per-goal difficulty order, so validate each file's order as written.
  for (const goal of ['mate-in-1', 'mate-in-2', 'win-material']) {
    it(`${goal}: every puzzle passes the verifier (legal, solvable, unique)`, () => {
      const list = byGoal(goal).sort((a, b) => a.id.localeCompare(b.id));
      expect(validatePuzzles(list)).toEqual([]);
    });
  }

  it('mate in 1: a naive search finds exactly the stored mating move', () => {
    for (const p of byGoal('mate-in-1')) {
      const pos = startPosition(p);
      const winning = legalMoves(pos).filter((m) => {
        const kind = gameStatus(makeMove(pos, m)).kind;
        return kind === 'checkmate' || kind === 'stalemate';
      });
      expect(winning, p.id).toEqual([toMove(p.solution[0])]);
    }
  });
});
