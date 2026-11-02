// Content checks of the pilot unit i08 (S2.15: lesson i08l3 "Against other replies" + practical task i08-g1), loaded in
// release state REL-P (preview only). The validator, T1 and the release test run on it with every other unit
// (content.test.ts, release.test.ts); this file pins what the pilot itself must show. The §5.7 checks of i08-g1 are
// slower (~2 min): `npx tsx scripts/verify-practical.ts i08 --runs 20`.
import { describe, expect, it } from 'vitest';
import { legalMoves, makeMove, materialBalance, moveScore, parseFen, type Position } from '../engine';
import { isAccepted, parseMoveKey } from '../lessons/decision';
import { learnerNodeStats } from '../lessons/line';
import { allUnits } from './index';
import { unitItems } from './release';
import type { DecisionExercise, Exercise, LineExercise, LineLearnerNode, LineNode, PlayExercise, Unit } from './types';

const i08 = allUnits.find((u) => u.id === 'i08') as Unit;
const lesson = i08.lessons[0];
const byId = (id: string) => lesson.exercises.find((e) => e.id === id) as Exercise;
const lines = lesson.exercises.filter((e): e is LineExercise => e.type === 'line');

const moveOf = (pos: Position, key: string) => {
  const want = parseMoveKey(key)!;
  const m = legalMoves(pos).find((x) => x.from === want.from && x.to === want.to);
  if (!m) throw new Error(`illegal ${key}`);
  return m;
};
const delta2 = (pos: Position, key: string) => moveScore(pos, moveOf(pos, key), 2) - materialBalance(pos.board, pos.turn);

/** Walks a tree: accepted learner moves lose < 1 (depth 2), replies lose < 1 and leave no capture winning ≥ 1. */
function checkTree(node: LineLearnerNode, pos: Position, path: string) {
  for (const row of node.table.filter((r) => isAccepted(r.class))) expect(delta2(pos, row.move), `${path} ${row.move}`).toBeGreaterThan(-1);
  for (const [key, child] of Object.entries(node.next ?? {})) {
    if (child.kind !== 'opponent') continue;
    const mid = makeMove(pos, moveOf(pos, key));
    for (const reply of child.replies) {
      expect(delta2(mid, reply.move), `${path} ${key} ${reply.move}`).toBeGreaterThan(-1);
      const next = makeMove(mid, moveOf(mid, reply.move));
      const gains = legalMoves(next).filter((x) => next.board[x.to] && moveScore(next, x, 2) - materialBalance(next.board, next.turn) >= 1);
      expect(gains, `${path} ${key} ${reply.move}: something hangs`).toEqual([]);
      if (reply.next.kind === 'learner') checkTree(reply.next, next, `${path} ${key} ${reply.move}`);
    }
  }
}
const hasDeviation = (n: LineNode): boolean =>
  n.kind === 'opponent' ? n.replies.length >= 2 || n.replies.some((r) => hasDeviation(r.next)) : n.kind === 'learner' ? Object.values(n.next ?? {}).some(hasDeviation) : false;

describe('pilot unit i08', () => {
  it('is lesson i08l3 as 02 i08: Red only, the Intermediate ladder, misconceptions i08.m1–m3 tagged, all reviewed', () => {
    expect(i08.track).toBe('intermediate');
    const items = lesson.exercises;
    expect(items.map((e) => e.type)).toEqual(['learn', 'learn', 'line', 'line', 'decision', 'line', 'line', 'play']);
    expect(items.every((e) => e.side === 'red')).toBe(true);
    expect(items.filter((e) => e.type !== 'learn').map((e) => e.assist)).toEqual(['G2', 'G2', 'G1', 'G1', 'G0', undefined]);
    const tagged = new Set(JSON.stringify(i08).match(/i08\.m[1-3]/g));
    expect([...tagged].sort()).toEqual(['i08.m1', 'i08.m2', 'i08.m3']);
    expect(unitItems(i08).every(({ item }) => item.status === 'reviewed')).toBe(true);
  });

  it('deviations in at least half the line items; every line node selective', () => {
    expect(lines.filter((l) => hasDeviation(l.root)).length * 2).toBeGreaterThanOrEqual(lines.length);
    for (const l of lines) for (const s of learnerNodeStats(l)) expect(s.selective, `${l.id} ${s.path.join(' ')}`).toBe(true);
  });

  it('accepted moves drop nothing and scripted replies leave nothing hanging (lines and the task tree, depth 2)', () => {
    for (const l of lines) checkTree(l.root, parseFen(l.fen!), l.id!);
    const task = byId('i08-g1') as PlayExercise;
    checkTree(task.tree!, parseFen(task.fen!), 'i08-g1');
  }, 120_000);

  it('contrasts: the natural R9+1 drops the Horse (error) and grabbing a guarded central Soldier is rejected', () => {
    const d = byId('i08l3-05') as DecisionExercise;
    expect(d.table.find((r) => r.move === 'a0-a1')).toMatchObject({ class: 'error', misconception: 'i08.m1' });
    expect(d.table.filter((r) => isAccepted(r.class)).map((r) => r.move).sort()).toEqual(['b0-c2', 'h0-h9']);
    const g0 = byId('i08l3-07') as LineExercise;
    expect(g0.root.table.find((r) => r.move === 'e2-e6')).toMatchObject({ misconception: 'i08.m3' });
    expect(isAccepted(g0.root.table.find((r) => r.move === 'e2-e6')!.class)).toBe(false);
    // …while after 1… E3+5 the central Soldier is unguarded and C5+4 is accepted (position-specific, 02 i08 outcome 3).
    const e3 = byId('i08l3-06') as LineExercise;
    expect(e3.root.table.find((r) => r.move === 'e2-e6')).toMatchObject({ class: 'target' });
  });

  it('i08l3-04 credits only the Horse moves that guard the central Soldier (its prompt says "guard it first")', () => {
    const od = byId('i08l3-04') as LineExercise;
    expect(od.root.table.filter((r) => isAccepted(r.class)).map((r) => r.move).sort()).toEqual(['b0-c2', 'h0-g2']);
  });

  it('standard plans are authored: C8=7 (Five-Seven Cannons) and R2+6 (river-crossing Chariot) are authored wherever the guard does not refute them', () => {
    const rows: { move: string; source: string }[] = [];
    const walk = (n: LineNode) => {
      if (n.kind === 'learner') {
        // Error rows (the guard refutes them) stay computed; every other row of these two plans is authored.
        rows.push(...n.table.filter((r) => (r.move === 'b2-c2' || r.move === 'h0-h6') && r.class !== 'error'));
        Object.values(n.next ?? {}).forEach(walk);
      } else if (n.kind === 'opponent') n.replies.forEach((r) => walk(r.next));
    };
    for (const l of lines) walk(l.root);
    walk((byId('i08-g1') as PlayExercise).tree!);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.source === 'authored')).toBe(true);
    const g0 = byId('i08l3-07') as LineExercise;
    expect(g0.root.table.find((r) => r.move === 'b2-c2')).toMatchObject({ class: 'sound', reason: 'i08.r.c87' });
  });

  it('i08-g1: line → play, R6 + R1, the three taught replies after C2=5, L = 6', () => {
    const task = byId('i08-g1') as PlayExercise;
    expect(task).toMatchObject({ task: 'opening', lineShare: 6, rubrics: [{ rubric: 'R6', weight: 50 }, { rubric: 'R1', weight: 50 }] });
    const first = task.tree!.next!['h2-e2'];
    expect(first.kind === 'opponent' && first.replies.map((r) => r.move)).toEqual(['h9-g7', 'h7-e7', 'b7-e7']);
    // Two genuinely different reference orders (§5.7 item 6), both continuing on the tree.
    expect(task.reference).toHaveLength(2);
    expect(task.reference![1]).not.toEqual(task.reference![0]);
    expect(task.reference![1].slice(0, 3)).toEqual(['h2-e2', 'b0-c2', 'h0-g2']);
    const stats = learnerNodeStats({ root: task.tree! });
    expect(stats.length).toBeGreaterThanOrEqual(6);
    for (const s of stats) expect(s.selective, s.path.join(' ')).toBe(true);
  });
});
