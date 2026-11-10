// Content checks of the pilot unit a03 (S2.16: lessons a03l1–a03l3, task a03-g1) and its assessment pools (a03-check,
// the pa slice, interleaved i01 / b08 check items), loaded in REL-P (preview only, all `reviewed` with approving records). The validator and
// the pool validator run on them with everything else (validate-shard-*.test.ts, pools.test.ts); this file pins what
// the pilot must show (02 a03, 03 §4.1–§4.2). The §5.7 checks of a03-g1: `npx tsx scripts/verify-practical.ts a03 --runs 20`.
import { describe, expect, it } from 'vitest';
import { legalMoves, makeMove, materialBalance, moveScore, type Move, type Position } from '../engine';
import { evaluatePredicate, searchAtLeast, type Predicate } from '../analysis';
import { isAccepted, moveKey, parseMoveKey } from '../lessons/decision';
import { positionOf } from '../lessons/answers';
import { allUnits } from './index';
import { poolFiles } from './pools';
import { unitItems } from './release';
import type { AssessmentItem, DecisionExercise, Exercise, LineExercise, LineLearnerNode, MoveTableEntry, Unit } from './types';

const a03 = allUnits.find((u) => u.id === 'a03') as Unit;
const items = a03.lessons.flatMap((l) => l.exercises);
const practice = items.filter((e) => e.type !== 'learn');
const pool = (id: string) => poolFiles[id].items as AssessmentItem[];

const moveOf = (pos: Position, key: string) => {
  const want = parseMoveKey(key)!;
  return legalMoves(pos).find((x) => x.from === want.from && x.to === want.to)!;
};
const delta2 = (pos: Position, key: string) => moveScore(pos, moveOf(pos, key), 2) - materialBalance(pos.board, pos.turn);
/** Does `m` gain ≥ `t` at `depth` (the engine's `moveScore(pos, m, depth)` − balance ≥ t)? A null-window search, same answer. */
function gainsAtLeast(pos: Position, m: Move, depth: number, t: number): boolean {
  const r = searchAtLeast(makeMove(pos, m), -materialBalance(pos.board, pos.turn) - t + 1e-6, { depth: depth - 1, maxNodes: 1e9 });
  if (!r.complete) throw new Error('search stopped');
  return !r.value;
}
/** Does `m` gain more than `t` at `depth`? */
function gainsMoreThan(pos: Position, m: Move, depth: number, t: number): boolean {
  const r = searchAtLeast(makeMove(pos, m), -materialBalance(pos.board, pos.turn) - t, { depth: depth - 1, maxNodes: 1e9 });
  if (!r.complete) throw new Error('search stopped');
  return !r.value;
}
/** Every move table of an item with its position: decisions, line nodes, play-task tree nodes (scripted replies followed). */
type Table = { path: string; pos: Position; table: readonly MoveTableEntry[]; objective?: unknown };
function tablesOf(item: Exercise): Table[] {
  const out: Table[] = [];
  const pos0 = positionOf(item);
  const walk = (n: LineLearnerNode, pos: Position, path: string) => {
    out.push({ path, pos, table: n.table, objective: n.objective });
    for (const [key, child] of Object.entries(n.next ?? {})) {
      if (child.kind !== 'opponent') continue;
      const mid = makeMove(pos, moveOf(pos, key));
      for (const r of child.replies) if (r.next.kind === 'learner') walk(r.next, makeMove(mid, moveOf(mid, r.move)), `${path} ${key} ${r.move}`);
    }
  };
  if (item.type === 'decision') out.push({ path: item.id!, pos: pos0, table: item.table });
  else if (item.type === 'line') walk(item.root, pos0, item.id!);
  else if (item.type === 'play' && item.tree) walk(item.tree as LineLearnerNode, pos0, item.id!);
  return out;
}
/** Non-accepted moves that gain ≥ T (2) at depth 2 or 4. */
function rejectedWins(items: readonly Exercise[]): string[] {
  const bad: string[] = [];
  for (const it of items)
    for (const { path, pos, table } of tablesOf(it))
      for (const m of legalMoves(pos)) {
        const key = moveKey(m);
        const row = table.find((r) => r.move === key);
        if (row && isAccepted(row.class)) continue;
        if (gainsAtLeast(pos, m, 2, 2) || gainsAtLeast(pos, m, 4, 2)) bad.push(`${path}: ${key} (${row?.class ?? 'no row'}) gains ≥ 2`);
      }
  return bad;
}
function checkNode(node: LineLearnerNode, pos: Position, path: string) {
  for (const row of node.table.filter((r) => isAccepted(r.class))) expect(delta2(pos, row.move), `${path} ${row.move}`).toBeGreaterThan(-1);
  for (const [key, child] of Object.entries(node.next ?? {})) {
    if (child.kind !== 'opponent') continue;
    const mid = makeMove(pos, moveOf(pos, key));
    for (const reply of child.replies) {
      expect(delta2(mid, reply.move), `${path} ${key} ${reply.move}`).toBeGreaterThan(-1);
      expect(gainsMoreThan(mid, moveOf(mid, reply.move), 4, -1), `${path} ${key} ${reply.move} (depth 4)`).toBe(true);
      const next = makeMove(mid, moveOf(mid, reply.move));
      expect(legalMoves(next).filter((x) => next.board[x.to] && moveScore(next, x, 2) - materialBalance(next.board, next.turn) >= 1), `${path} ${key} ${reply.move}`).toEqual([]);
      if (reply.next.kind === 'learner') checkNode(reply.next, next, `${path} ${key} ${reply.move}`);
    }
  }
}

describe('pilot unit a03', () => {
  it('follows 02 a03: three lessons, ≥ 1/3 Black, ≥ 1/4 quiet, misconceptions a03.m1 / a03.m2 tagged, all reviewed', () => {
    expect(a03.track).toBe('advanced');
    expect(a03.lessons.map((l) => l.id)).toEqual(['a03l1', 'a03l2', 'a03l3']);
    expect(practice.filter((e) => e.side === 'black').length * 3).toBeGreaterThanOrEqual(practice.length);
    expect(practice.filter((e) => e.nature === 'quiet').length * 4).toBeGreaterThanOrEqual(practice.length);
    const tagged = new Set(JSON.stringify(a03).match(/a03\.m[12]/g));
    expect([...tagged].sort()).toEqual(['a03.m1', 'a03.m2']);
    expect(unitItems(a03).every(({ item }) => item.status === 'reviewed')).toBe(true);
    expect(items.some((e) => e.id === 'a03-g1' && e.type === 'play')).toBe(true);
  });

  it('selective decisions: 2–4 accepted moves (≤ 1/3 of the guard-passing ones)', () => {
    const all = [...items, ...pool('a03-check'), ...pool('pa'), ...pool('i01-check'), ...pool('b08-check')];
    for (const d of all.filter((e): e is DecisionExercise => e.type === 'decision')) {
      const acc = d.table.filter((r) => isAccepted(r.class));
      expect(acc.length, d.id).toBeGreaterThanOrEqual(2);
      expect(acc.length, d.id).toBeLessThanOrEqual(4);
      expect(acc.length * 3, d.id).toBeLessThanOrEqual(d.table.filter((r) => r.class !== 'error').length);
    }
    for (const d of a03.lessons[2].exercises.filter((e): e is DecisionExercise => e.type === 'decision')) {
      const t = d.feedback!.temptingAlternative.move;
      expect(d.table.find((r) => r.move === t), d.id).toMatchObject({ class: 'error', misconception: 'a03.m1' });
    }
  }, 120_000);

  it('every move gaining ≥ T (2) at depth 2 or 4 is accepted, in every table of the lessons (decisions, line nodes, a03-g1)', () => {
    expect(rejectedWins(items)).toEqual([]);
  }, 600_000);

  it('a03-g1: every node accepts every safe move (guard, depth 2 and 4) that meets its objective, at most 1/3 of the guard-passing moves', () => {
    const g1 = items.find((e) => e.id === 'a03-g1')!;
    for (const { path, pos, table: node, objective } of tablesOf(g1)) {
      for (const m of legalMoves(pos)) {
        const row = node.find((r) => r.move === moveKey(m))!;
        if (row.class === 'error' || !evaluatePredicate(objective as Predicate, { before: pos, moves: [m] })) continue;
        if (gainsMoreThan(pos, m, 2, -1) && gainsMoreThan(pos, m, 4, -1)) expect(isAccepted(row.class), `${path} ${moveKey(m)}`).toBe(true);
      }
      const accepted = node.filter((r) => isAccepted(r.class)).length;
      expect(accepted * 3, path).toBeLessThanOrEqual(node.filter((r) => r.class !== 'error').length);
    }
  }, 600_000);

  it('a03l2 routes: every line plays ≥ 2 learner moves of a re-route on its main path; a03-g1 ≥ 3 with a different second plan', () => {
    const depth = (n: LineLearnerNode): number => {
      const x = Object.values(n.next ?? {}).find((v) => v.kind === 'opponent');
      return 1 + (x && x.kind === 'opponent' && x.replies[0].next.kind === 'learner' ? depth(x.replies[0].next) : 0);
    };
    for (const l of a03.lessons[1].exercises.filter((e): e is LineExercise => e.type === 'line')) expect(depth(l.root), l.id).toBeGreaterThanOrEqual(2);
    const g1 = items.find((e) => e.id === 'a03-g1') as unknown as { tree: LineLearnerNode; reference: string[][]; misconceptions: string[] };
    expect(g1.reference[0].length).toBeGreaterThanOrEqual(3);
    expect(g1.reference[1]).not.toEqual(g1.reference[0]);
    expect(g1.misconceptions.length).toBeGreaterThan(0);
  });

  it('accepted moves drop nothing and the scripted replies are safe (depth 2 and 4) and leave nothing hanging (lines, a03-g1)', () => {
    for (const l of items.filter((e): e is LineExercise => e.type === 'line')) checkNode(l.root, positionOf(l), l.id!);
    const g1 = items.find((e) => e.id === 'a03-g1')!;
    checkNode((g1 as unknown as { tree: LineLearnerNode }).tree, positionOf(g1), 'a03-g1');
  }, 120_000);
});

describe('a03 assessment pools', () => {
  it('check pool: 16 a03 items (two forms of 8), every lesson objective covered, ≥ 1/3 Black, ≥ 1/4 quiet, critical items', () => {
    const c = pool('a03-check');
    expect(c).toHaveLength(16);
    expect(c.every((i) => i.unit === 'a03')).toBe(true);
    expect(new Set(c.map((i) => i.objective))).toEqual(new Set(['a03l1', 'a03l2', 'a03l3']));
    expect(c.filter((i) => i.side === 'black').length * 3).toBeGreaterThanOrEqual(c.length);
    expect(c.filter((i) => i.nature === 'quiet').length * 4).toBeGreaterThanOrEqual(c.length);
    expect(c.filter((i) => i.critical).length).toBeGreaterThanOrEqual(2);
  });

  it('pa slice: ≥ 10 Advanced placement items tagged a03; interleaved i01 / b08 items in their own unit pools', () => {
    expect(pool('pa').length).toBeGreaterThanOrEqual(10);
    expect(pool('pa').every((i) => i.unit === 'a03' && /^pa-\d\d$/.test(i.id!))).toBe(true);
    expect(pool('i01-check').every((i) => i.unit === 'i01')).toBe(true);
    expect(pool('b08-check').every((i) => i.unit === 'b08' && i.critical)).toBe(true);
  });

  it('every move gaining ≥ T (2) at depth 2 or 4 is accepted, in every pool table (a03-check, pa, i01-check, b08-check)', () => {
    expect(rejectedWins([...pool('a03-check'), ...pool('pa'), ...pool('i01-check'), ...pool('b08-check')])).toEqual([]);
  }, 600_000);

  it('neutral: no hints, no highlights, prompts that name only the side to move and the kind of answer (03 §4.2 rules 1, 3)', () => {
    for (const id of ['a03-check', 'pa', 'i01-check', 'b08-check']) {
      for (const i of pool(id) as (Exercise & { hints?: unknown; highlight?: unknown; prompt?: string })[]) {
        expect(i.hints, i.id).toBeUndefined();
        expect(i.highlight, i.id).toBeUndefined();
        expect(i.prompt, i.id).toMatch(/^a03\.n\./);
      }
    }
  });
});
