// Content checks of the pilot lesson a07l4 "Under pressure as Black" and the hold task a07-g1 (S2.17, 02 a07), loaded in
// REL-P (preview only, all `verified` until the independent review). The validator runs on them with everything else
// (validate-shard-*.test.ts); this file pins what the pilot must show, in the style of pilot-a03.test.ts. The §5.7
// checks of a07-g1: `npx tsx scripts/verify-practical.ts a07 --runs 20`.
import { describe, expect, it } from 'vitest';
import { hasForcedWin, isInCheck, legalMoves, makeMove, materialBalance, type Move, type Position } from '../engine';
import { evaluatePredicate, guardForUnit, safetyGuard, searchAtLeast, threatOf, type Predicate } from '../analysis';
import { isAccepted, moveKey, parseMoveKey } from '../lessons/decision';
import { positionOf } from '../lessons/answers';
import { allUnits } from './index';
import { normalKey } from './normalize';
import { unitItems } from './release';
import type { DecisionExercise, Exercise, LineLearnerNode, MoveExercise, MoveTableEntry, PlayExercise, Unit } from './types';

const a07 = allUnits.find((u) => u.id === 'a07') as Unit;
const items = a07.lessons.flatMap((l) => l.exercises);
const practice = items.filter((e) => e.type !== 'learn');
const g1 = items.find((e) => e.id === 'a07-g1') as PlayExercise;
const guard = guardForUnit('a07');

const moveOf = (pos: Position, key: string) => {
  const want = parseMoveKey(key)!;
  return legalMoves(pos).find((x) => x.from === want.from && x.to === want.to)!;
};
/** Does `m` gain ≥ `t` (or more than `t` when `strict`) at `depth` (`moveScore(pos, m, depth)` − balance)? Null-window search. */
function gains(pos: Position, m: Move, depth: number, t: number, strict = false): boolean {
  const r = searchAtLeast(makeMove(pos, m), -materialBalance(pos.board, pos.turn) - t + (strict ? 0 : 1e-6), { depth: depth - 1, maxNodes: 1e9 });
  if (!r.complete) throw new Error('search stopped');
  return !r.value;
}
const safe = (pos: Position, m: Move) => gains(pos, m, 2, -1, true) && gains(pos, m, 4, -1, true);
const passes = (pos: Position, m: Move) => {
  const g = safetyGuard(pos, m, guard, { maxNodes: 1e9 });
  return g.status === 'checked' && g.safe;
};
type Table = { path: string; pos: Position; table: readonly MoveTableEntry[]; objective?: unknown };
function tablesOf(item: Exercise): Table[] {
  const out: Table[] = [];
  const walk = (n: LineLearnerNode, pos: Position, path: string) => {
    out.push({ path, pos, table: n.table, objective: n.objective });
    for (const [key, child] of Object.entries(n.next ?? {})) {
      if (child.kind !== 'opponent') continue;
      const mid = makeMove(pos, moveOf(pos, key));
      for (const r of child.replies) if (r.next.kind === 'learner') walk(r.next, makeMove(mid, moveOf(mid, r.move)), `${path} ${key} ${r.move}`);
    }
  };
  if (item.type === 'decision') out.push({ path: item.id!, pos: positionOf(item), table: item.table });
  else if (item.type === 'play' && item.tree) walk(item.tree as LineLearnerNode, positionOf(item), item.id!);
  return out;
}
const allTables = () => practice.flatMap(tablesOf);

describe('pilot lesson a07l4 and task a07-g1', () => {
  it('follows 02 a07: a07l4 as Black from full opening-derived positions, decision + move defend depth 2, a07-g1 hold; all verified', () => {
    expect(a07.track).toBe('advanced');
    expect(a07.lessons.map((l) => l.id)).toEqual(['a07l4']);
    expect(items.every((e) => e.side === 'black')).toBe(true);
    expect(practice.some((e) => e.type === 'decision')).toBe(true);
    expect(practice.some((e) => e.type === 'move' && e.goal.kind === 'defend' && e.goal.depth === 2)).toBe(true);
    expect(g1.task).toBe('hold');
    expect(unitItems(a07).every(({ item }) => item.status === 'reviewed')).toBe(true);
    // Full boards from seeded Central Cannon games (no edited positions): every position has ≥ 26 pieces.
    for (const e of items) {
      expect(e.source, e.id).toMatchObject({ kind: 'generated', generator: 'a07-central-cannon-play' });
      expect(positionOf(e).board.filter(Boolean).length, e.id).toBeGreaterThanOrEqual(26);
    }
    const tagged = new Set(JSON.stringify(a07).match(/a07\.m[12]/g));
    expect([...tagged].sort()).toEqual(['a07.m1', 'a07.m2']);
  });

  it('independence: every root is unseen elsewhere in the unit (no position repeated up to mirror / colour swap)', () => {
    const keys = items.map((e) => normalKey(positionOf(e)));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('decisions: 2–4 accepted moves, at most 1/3 of the guard-passing ones; the tempting move is rejected and passes the guard or is refuted', () => {
    for (const d of practice.filter((e): e is DecisionExercise => e.type === 'decision')) {
      const acc = d.table.filter((r) => isAccepted(r.class));
      expect(acc.length, d.id).toBeGreaterThanOrEqual(2);
      expect(acc.length, d.id).toBeLessThanOrEqual(4);
      expect(acc.length * 3, d.id).toBeLessThanOrEqual(d.table.filter((r) => r.class !== 'error').length);
      expect(isAccepted(d.table.find((r) => r.move === d.feedback!.temptingAlternative.move)!.class), d.id).toBe(false);
    }
  });

  it('every move gaining ≥ T (2) at depth 2 or 4 is accepted, in every table (decisions, a07-g1 nodes)', () => {
    const bad: string[] = [];
    for (const { path, pos, table } of allTables())
      for (const m of legalMoves(pos)) {
        const row = table.find((r) => r.move === moveKey(m));
        if (row && isAccepted(row.class)) continue;
        if (gains(pos, m, 2, 2) || gains(pos, m, 4, 2)) bad.push(`${path}: ${moveKey(m)} gains ≥ 2`);
      }
    expect(bad).toEqual([]);
  }, 600_000);

  it('every safe move (guard, depth 2 and 4 > −1) is accepted where the table has no objective, and every safe move meeting the objective where it has one; accepted moves are safe', () => {
    const bad: string[] = [];
    for (const { path, pos, table, objective } of allTables())
      for (const m of legalMoves(pos)) {
        const row = table.find((r) => r.move === moveKey(m))!;
        const ok = row.class !== 'error' && safe(pos, m);
        if (isAccepted(row.class)) {
          if (!ok && !(gains(pos, m, 2, 2) || gains(pos, m, 4, 2))) bad.push(`${path}: accepted ${moveKey(m)} is not safe`);
          continue;
        }
        if (!ok) continue;
        if (objective === undefined || evaluatePredicate(objective as Predicate, { before: pos, moves: [m], limits: { maxNodes: 1e9 } })) bad.push(`${path}: safe ${moveKey(m)} rejected`);
      }
    expect(bad).toEqual([]);
  }, 600_000);

  it('a07-g1 starts from a verified Red threat; every node is narrow (≤ 3 or ≤ 20 % of the legal moves pass the guard); counterplay nodes are selective (≤ 1/3)', () => {
    const start = positionOf(g1);
    const t = threatOf(start, 'red', guard, { maxNodes: 1e9 });
    expect(t.status === 'checked' && t.isThreat).toBe(true);
    for (const { path, pos, table, objective } of tablesOf(g1)) {
      const legal = legalMoves(pos);
      const passing = legal.filter((m) => passes(pos, m)).length;
      expect(passing <= 3 || passing <= 0.2 * legal.length, `${path}: ${passing} of ${legal.length} pass`).toBe(true);
      // The table's non-error rows are exactly the guard-passing moves (computed rows: guard → error), so the
      // selectivity check below may use them as its denominator.
      expect(passing, path).toBe(table.filter((r) => r.class !== 'error').length);
      if (objective !== undefined) expect(table.filter((r) => isAccepted(r.class)).length * 3, path).toBeLessThanOrEqual(passing);
    }
  }, 600_000);

  it('a07-g1 replies: safe for Red at depth 2 and 4, nothing left hanging, never undoing Red\'s last move, each a new threat or a check', () => {
    const visit = (n: LineLearnerNode, pos: Position, last: Move | null, path: string) => {
      for (const [key, child] of Object.entries(n.next ?? {})) {
        if (child.kind !== 'opponent') continue;
        const mid = makeMove(pos, moveOf(pos, key));
        for (const r of child.replies) {
          const m = moveOf(mid, r.move);
          const at = `${path} ${key} ${r.move}`;
          expect(safe(mid, m), at).toBe(true);
          const q = makeMove(mid, m);
          expect(legalMoves(q).filter((x) => q.board[x.to] && (gains(q, x, 2, 1) || gains(q, x, 4, 1))).map(moveKey), at).toEqual([]);
          if (last) expect(m.from === last.to && m.to === last.from, at).toBe(false);
          const th = threatOf(q, 'red', guard, { maxNodes: 1e9 });
          expect(isInCheck(q) || (th.status === 'checked' && th.isThreat), at).toBe(true);
          if (r.next.kind === 'learner') visit(r.next, q, m, at);
        }
      }
    };
    visit(g1.tree as LineLearnerNode, positionOf(g1), null, 'a07-g1');
  }, 600_000);

  it('a07-g1: R5 with the counterplay predicate + R1, the predicate necessary to pass, reference ≥ 3 tree moves, a different second plan', () => {
    expect(g1.holding).toEqual({ predicate: { kind: 'threat', created: true }, when: 'any-move' });
    const w = Object.fromEntries(g1.rubrics.map((r) => [r.rubric, r.weight]));
    // Without the predicate R5 is at most 70: the score is at most 0.7 · w(R5) + w(R1) < 75.
    expect(0.7 * w.R5 + (w.R1 ?? 0)).toBeLessThan(75);
    expect(g1.resistance).toBe(true);
    expect(g1.reference![0].length).toBeGreaterThanOrEqual(3);
    expect(g1.reference![1]).toBeDefined();
    expect(g1.reference![1]).not.toEqual(g1.reference![0]);
  });

  it('defend items: no mate in 1 from the start, a mate in 2, some legal Black move still allows it (the tempting one does)', () => {
    for (const e of practice.filter((x): x is MoveExercise => x.type === 'move')) {
      const pos = positionOf(e);
      expect(hasForcedWin({ ...pos, turn: 'red' }, 1), `${e.id}: mate in 1`).toBe(false);
      expect(hasForcedWin({ ...pos, turn: 'red' }, 2), `${e.id}: mate in 2`).toBe(true);
      expect(legalMoves(pos).some((m) => hasForcedWin(makeMove(pos, m), 2)), e.id).toBe(true);
      expect(hasForcedWin(makeMove(pos, moveOf(pos, e.feedback!.temptingAlternative.move)), 2), `${e.id}: tempting move`).toBe(true);
    }
  }, 120_000);
});
