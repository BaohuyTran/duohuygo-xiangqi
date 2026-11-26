// Content checks of unit b10 "First complete games" (S3.3.c), loaded in release state REL-P (items `verified` until the
// independent content review, so not in the preview yet). The validator, T1 and the release test run on it with every
// other unit (content.test.ts, release.test.ts); this file pins what the unit itself must show. The §5.7 checks of the
// tasks are slower (~15 min): `npx tsx scripts/verify-practical.ts b10 --runs 20`.
import { describe, expect, it } from 'vitest';
import { hasForcedWin, legalMoves, makeMove, materialBalance, parseFen, squareName, START_FEN, toFen, type Move, type Position } from '../engine';
import { search } from '../analysis';
import { searchAtLeast } from '../analysis/search';
import { evaluatePredicate, type Predicate } from '../analysis/judge';
import { assembleCheckForm } from '../assessment/checks';
import { partnerPlan } from '../assessment/practical';
import { scoringWeights } from '../assessment/rubrics';
import { positionOf } from '../lessons/answers';
import { syncSafety } from '../lessons/decision-table';
import { isAccepted, parseMoveKey } from '../lessons/decision';
import { nearDuplicate } from './near-duplicate';
import { normalKey } from './normalize';
import { poolFiles } from './pools';
import { allUnits } from './index';
import type { AssessmentItem, ChoiceExercise, DecisionExercise, Exercise, LineExercise, LineLearnerNode, MoveTableEntry, PlayExercise, ReviewExercise, Unit } from './types';

const b10 = allUnits.find((u) => u.id === 'b10') as Unit;
const items = b10.lessons.flatMap((l) => l.exercises);
const pool = poolFiles['b10-check'].items as AssessmentItem[];
const anyItem = (id: string) => [...items, ...pool].find((e) => e.id === id) as Exercise;
const keyOf = (m: Move) => `${squareName(m.from)}-${squareName(m.to)}`;
const mv = (p: Position, key: string) => {
  const m = legalMoves(p).find((x) => keyOf(x) === key);
  if (!m) throw new Error(`illegal ${key}`);
  return m;
};
const playFrom = (p: Position, keys: readonly string[]) => keys.reduce((q, key) => makeMove(q, mv(q, key)), p);
const d4 = (p: Position, key: string) => {
  const r = search(makeMove(p, mv(p, key)), { depth: 4, maxNodes: 3e6 });
  expect(r.complete, key).toBe(true);
  return -r.score - materialBalance(p.board, p.turn);
};
/** Depth-6 null-window facts after `key` for the mover: loses ≥ 1, keeps the material (≥ 0), or a smaller loss. */
const d6 = (p: Position, key: string) => {
  const a = makeMove(p, mv(p, key));
  const bal = materialBalance(p.board, p.turn);
  const lose = searchAtLeast(a, -bal + 1, { depth: 6, maxNodes: 5e8 });
  expect(lose.complete, key).toBe(true);
  if (lose.value) return 'lose1';
  const small = searchAtLeast(a, -bal + 1e-6, { depth: 6, maxNodes: 5e8 });
  expect(small.complete, key).toBe(true);
  return small.value ? 'small' : 'keep';
};
const guardOk = (id: string, p: Position, key: string) => {
  const v = syncSafety()(p, mv(p, key), { itemId: id });
  return v.status === 'checked' && v.safe;
};
const meets = (pred: Predicate, p: Position, key: string) => evaluatePredicate(pred, { before: p, moves: [mv(p, key)] }) === true;
const SAFE = { kind: 'no-hanging' } as const;
const BACK = { kind: 'all', of: [{ kind: 'any', of: [{ kind: 'development', measure: 'horses-out', increaseBy: 1 }, { kind: 'development', measure: 'chariots-out', increaseBy: 1 }] }, { kind: 'no-hanging' }] } as const;
/** A move keeps a forced mate in n when every reply still loses to a mate in n − 1 (n = 1: the move mates). */
const keepsMate = (p: Position, key: string, n: number) => {
  const a = makeMove(p, mv(p, key));
  const replies = legalMoves(a);
  return replies.length === 0 || (n > 1 && replies.every((r) => hasForcedWin(makeMove(a, r), n - 1)));
};

/**
 * The b09 table rule (S3.3.b fix round 1) on b10's safety, turning-point and guided-game tables: accepted rows are
 * authored, pass the guard, keep the material at depth 4 and meet the predicate; an authored `error` that passes the
 * guard loses ≥ 1 at depth 6; a `trade` row loses less than 1 at depth 6; a `risky` row meets the predicate but loses
 * at depth 4 (not 1 at depth 6); the tempting move is never accepted.
 */
function checkTable(id: string, p: Position, rows: readonly MoveTableEntry[], pred: Predicate, tempt?: { move: string }) {
  expect(rows.map((r) => r.move).sort(), id).toEqual(legalMoves(p).map(keyOf).sort());
  expect(rows.some((r) => !isAccepted(r.class)), id).toBe(true);
  for (const row of rows) {
    const tag = `${id} ${row.move}`;
    if (isAccepted(row.class)) {
      expect(row.source, tag).toBe('authored');
      expect(guardOk(id, p, row.move), tag).toBe(true);
      expect(d4(p, row.move), tag).toBeGreaterThanOrEqual(0);
      expect(meets(pred, p, row.move), tag).toBe(true);
    } else if (row.class === 'error') {
      if (row.source === 'computed' || !guardOk(id, p, row.move)) expect(guardOk(id, p, row.move), tag).toBe(false);
      else expect(d6(p, row.move), tag).toBe('lose1');
    } else if (row.source === 'authored') {
      if (row.reason === 'b10.r.trade') expect(d6(p, row.move), tag).toBe('small');
      else if (row.reason === 'b10.r.risky') {
        expect(meets(pred, p, row.move), tag).toBe(true);
        expect(d4(p, row.move), tag).toBeLessThan(0);
        expect(d6(p, row.move), tag).not.toBe('lose1');
      } else if (row.reason === 'b10.r.edge') expect(p.board[mv(p, row.move).from]!.type, tag).toBe('horse');
      else if (row.reason === 'b10.r.general') expect(['general', 'advisor'], tag).toContain(p.board[mv(p, row.move).from]!.type);
      else if (row.reason === 'b10.r.hangs' || row.reason === 'b10.r.nodev') expect(meets(pred, p, row.move), tag).toBe(false);
    }
  }
  if (tempt) expect(isAccepted(rows.find((r) => r.move === tempt.move)!.class), id).toBe(false);
}

describe('unit b10 (S3.3.c)', () => {
  it('four lessons in 02 order with the four unit tasks, learn cards first, ladders, statuses and strands', () => {
    expect(b10.track).toBe('basics');
    expect(b10.lessons.map((l) => l.id)).toEqual(['b10l1', 'b10l2', 'b10l3', 'b10l4']);
    expect(b10.lessons.map((l) => l.exercises.map((e) => e.type).join(' '))).toEqual([
      'learn learn decision line decision decision decision play',
      'learn decision line decision decision decision play',
      'learn decision decision decision decision decision play',
      'learn decision choice choice choice decision review',
    ]);
    expect(items.filter((e) => e.type === 'play' || e.type === 'review').map((e) => `${e.id} ${e.side}`)).toEqual(['b10-g1 red', 'b10-g2 black', 'b10-g3 red', 'b10-g4 red']);
    for (const l of b10.lessons) {
      const practice = l.exercises.filter((e) => e.type !== 'learn' && e.type !== 'play' && e.type !== 'review');
      expect(practice.map((e) => e.assist), l.id).toEqual(['G2', 'G2', 'G1', 'G1', 'G0']);
    }
    expect([...items, ...pool].every((e) => e.status === 'verified' && e.source?.kind === 'authored')).toBe(true);
    // Both colours: b10l1 Red, b10l2 Black, b10l3 and b10l4 mixed.
    expect(b10.lessons[0].exercises.every((e) => e.side === 'red')).toBe(true);
    expect(b10.lessons[1].exercises.every((e) => e.side === 'black')).toBe(true);
    for (const l of b10.lessons.slice(2)) expect(new Set(l.exercises.map((e) => e.side)).size, l.id).toBe(2);
    // Move items carry the four feedback parts.
    for (const e of items.filter((x) => x.type === 'decision' || x.type === 'line')) {
      expect(e.feedback, e.id).toMatchObject({ purpose: expect.any(String), keyReply: expect.any(String), commonError: expect.any(String) });
      expect(e.feedback?.temptingAlternative.move, e.id).toMatch(/^[a-i]\d-[a-i]\d$/);
    }
  });

  it('misconceptions b10.m1–m3: one tagged learn card each and tagged wrong answers', () => {
    const cards = items.filter((e) => e.type === 'learn').flatMap((e) => (e.misconceptions ?? []).map((m) => `${m} ${e.id}`));
    expect(cards.sort()).toEqual(['b10.m1 b10l3-01', 'b10.m2 b10l1-02', 'b10.m3 b10l4-01']);
    const wrong = [...items, ...pool].flatMap((e) => (e.type === 'choice' ? e.options.filter((o) => !o.correct).map((o) => o.misconception) : e.type === 'decision' ? e.table.map((r) => r.misconception) : []));
    expect([...new Set(wrong.filter(Boolean))].sort()).toEqual(['b10.m1', 'b10.m2', 'b10.m3']);
  });

  it('the full games (b10-g1 Red, b10-g2 Black): game tasks from the start / after one Red opening, F2 under the fallback, the xb per-game score', () => {
    for (const id of ['b10-g1', 'b10-g2']) {
      const g = anyItem(id) as PlayExercise;
      expect(g.task, id).toBe('game');
      expect(g.cap, id).toBe(80);
      expect(g.development, id).toEqual({ n: 8, target: 4 });
      expect(g.f2b, id).toBeUndefined();
      expect(g.tree, id).toBeUndefined();
      // 03 §6 under fallback F2: R1 × 0.6 + R2 × 0.2 + R0 × 0.2, the result not scored.
      expect(scoringWeights(g.rubrics, 'F2').map((w) => `${w.term} ${w.weight}`).sort(), id).toEqual(['R0 20', 'R1 60', 'R2 20']);
      expect(partnerPlan(g, 'fallback').links, id).toEqual([{ kind: 'safe-sparring', d: 2, tau: 1.0 }]);
    }
    expect(toFen(positionOf(anyItem('b10-g1')))).toBe(toFen(parseFen(START_FEN)));
    expect(toFen(positionOf(anyItem('b10-g2')))).toBe(toFen(playFrom(parseFen(START_FEN), ['h2-e2', 'h9-g7', 'h0-g2'])));
  });

  it('guided games (G2): coach questions on the replies, then the partner plays on without prompts (handOver)', () => {
    for (const id of ['b10l1-04', 'b10l2-03']) {
      const l = anyItem(id) as LineExercise;
      expect(l.assist, id).toBe('G2');
      expect(l.handOver, id).toEqual({ partner: [{ kind: 'safe-sparring', d: 2, tau: 1 }], moves: 8 });
      expect(l.root.hints, id).toBeDefined();
      // Every authored reply carries the coach's question of its depth; every accepted move without `next` hands over.
      let leaves = 0;
      let handOvers = 0;
      const walk = (node: LineLearnerNode, p: Position, depth: number) => {
        checkTable(`${id}@${depth}`, p, node.table, BACK as unknown as Predicate, depth === 0 ? l.feedback!.temptingAlternative : undefined);
        for (const row of node.table.filter((r) => isAccepted(r.class))) {
          const child = node.next?.[row.move];
          if (!child) {
            handOvers++;
            expect(row.reason, `${id} ${row.move}`).toBe('b10.r.alone');
            continue;
          }
          const mid = makeMove(p, mv(p, row.move));
          if (child.kind === 'leaf') {
            leaves++;
            expect(child.text, id).toBe('b10.l.coachEnd');
            continue;
          }
          if (child.kind !== 'opponent') continue;
          for (const r of child.replies) {
            expect(r.text, `${id} ${row.move} ${r.move}`).toBe(`b10.coach.${depth + 1}`);
            expect(guardOk(id, mid, r.move), `${id} ${row.move} ${r.move}`).toBe(true);
            expect(r.next.kind, id).toBe('learner');
            walk(r.next as LineLearnerNode, makeMove(mid, mv(mid, r.move)), depth + 1);
          }
        }
      };
      walk(l.root, positionOf(l), 0);
      expect(handOvers, id).toBeGreaterThan(leaves);
    }
  }, 1_200_000);

  it('safety and turning-point decisions: every accepted move passes the guard, keeps the material at depth 4 and leaves nothing hanging; refusals lose', () => {
    const decisions = [...items, ...pool].filter((e): e is DecisionExercise => e.type === 'decision' && (e.prompt === 'b10.p.safe' || e.prompt === 'b10.p.turn'));
    expect(decisions.map((e) => e.id)).toEqual(['b10l1-03', 'b10l1-05', 'b10l1-06', 'b10l1-07', 'b10l2-02', 'b10l2-04', 'b10l2-05', 'b10l2-06', 'b10l4-02', 'b10l4-06', 'b10-c01', 'b10-c02', 'b10-c03', 'b10-c04', 'b10-c05', 'b10-c06']);
    for (const d of decisions) {
      const p = positionOf(d);
      if (typeof d.objective === 'object') expect(d.objective, d.id).toEqual(SAFE);
      checkTable(d.id!, p, d.table, SAFE as unknown as Predicate, d.feedback!.temptingAlternative);
      if (d.prompt === 'b10.p.safe') {
        // In-game safety: the opponent threatens something now, and the tempting attack fails the guard.
        expect(guardOk(d.id!, p, d.feedback!.temptingAlternative.move), d.id).toBe(false);
        expect(d.table.find((r) => r.move === d.feedback!.temptingAlternative.move)?.misconception, d.id).toBe('b10.m2');
        expect(d.table.filter((r) => isAccepted(r.class)).length, d.id).toBeLessThanOrEqual(Math.ceil(d.table.length * 0.4));
      }
    }
  }, 2_400_000);

  it('conversion decisions: the accepted moves are exactly the moves that keep the forced mate against every defence', () => {
    const mates = [...items, ...pool].filter((e): e is DecisionExercise => e.type === 'decision' && (e.prompt === 'b10.p.mate1' || e.prompt === 'b10.p.mate2'));
    expect(mates.map((e) => e.id)).toEqual(['b10l3-02', 'b10l3-03', 'b10l3-04', 'b10l3-05', 'b10l3-06', 'b10-c07', 'b10-c08', 'b10-c09']);
    for (const d of mates) {
      const p = positionOf(d);
      const n = d.prompt === 'b10.p.mate1' ? 1 : 2;
      expect(hasForcedWin(p, n), d.id).toBe(true);
      if (n === 2) expect(hasForcedWin(p, 1), d.id).toBe(false);
      // Simplified positions with a large lead (02 b10: convert a large lead).
      expect(p.board.filter(Boolean).length, d.id).toBeLessThanOrEqual(12);
      expect(materialBalance(p.board, p.turn), d.id).toBeGreaterThanOrEqual(5);
      for (const row of d.table) expect(isAccepted(row.class), `${d.id} ${row.move}`).toBe(keepsMate(p, row.move, n));
      const tempt = d.table.find((r) => r.move === d.feedback!.temptingAlternative.move)!;
      expect(tempt.misconception, d.id).toBe('b10.m1');
    }
  });

  it('review b10-g4 and the "which move keeps everything safe" choices come from games whose only flagged learner move is the mistake', () => {
    const r = anyItem('b10-g4') as ReviewExercise;
    expect(r.turningPoints.map((t) => t.category)).toEqual(['allowed-loss']);
    const tp = r.turningPoints[0];
    const before = playFrom(parseFen(START_FEN), r.moves.slice(0, tp.ply));
    checkTable('b10-g4', before, tp.table, SAFE as unknown as Predicate, { move: r.moves[tp.ply] });
    // The opponent takes at once: the game move lost material.
    const afterTake = playFrom(parseFen(START_FEN), r.moves.slice(0, tp.ply + 2));
    expect(materialBalance(afterTake.board, r.side!) - materialBalance(before.board, r.side!)).toBeLessThanOrEqual(-2);
    for (const id of ['b10l4-04', 'b10l4-05', 'b10-c10', 'b10-c11', 'b10-c12']) {
      const c = anyItem(id) as ChoiceExercise;
      const p = positionOf(c);
      for (const o of c.options) {
        const tag = `${id} ${o.id}`;
        if (o.correct) {
          expect(guardOk(id, p, o.move!), tag).toBe(true);
          expect(d4(p, o.move!), tag).toBeGreaterThanOrEqual(0);
          expect(meets(SAFE as unknown as Predicate, p, o.move!), tag).toBe(true);
        } else {
          expect(guardOk(id, p, o.move!), tag).toBe(false);
          expect(d4(p, o.move!), tag).toBeLessThanOrEqual(-2);
          expect(o.misconception, tag).toBe('b10.m2');
        }
      }
      expect(c.options.filter((o) => o.correct)).toHaveLength(1);
    }
  }, 600_000);

  it('the conversion task b10-g3: ≤ 12 pieces, measured, a large lead, a forced mate within the cap and a verified opponent threat', () => {
    const g = anyItem('b10-g3') as PlayExercise;
    const p = positionOf(g);
    expect(g.task).toBe('convert');
    expect(g.measured).toBe(true);
    expect(p.board.filter(Boolean).length).toBeLessThanOrEqual(12);
    expect(materialBalance(p.board, p.turn)).toBeGreaterThanOrEqual(5);
    expect(hasForcedWin(p, Math.min(g.cap, 3))).toBe(true);
    expect(g.rubrics).toEqual([{ rubric: 'R4', weight: 90 }, { rubric: 'R1', weight: 10 }]);
    if (g.reference) expect(parseMoveKey(g.reference[0][0])).not.toBeNull();
  });
});

describe('b10 check pool (03 §4.1–§4.3, short form)', () => {
  it('12 items: 3 per lesson objective, all G0, verified; safety items critical; no hints', () => {
    expect(pool).toHaveLength(12);
    expect(poolFiles['b10-check']).toMatchObject({ id: 'b10-check', kind: 'check', unit: 'b10', primaryStrand: 'PP' });
    expect(['b10l1', 'b10l2', 'b10l3', 'b10l4'].map((l) => pool.filter((i) => i.objective === l).length)).toEqual([3, 3, 3, 3]);
    expect(pool.every((i) => i.unit === 'b10' && i.assist === 'G0' && i.status === 'verified')).toBe(true);
    expect(pool.filter((i) => i.critical).map((i) => i.id)).toEqual(['b10-c01', 'b10-c02', 'b10-c03', 'b10-c04', 'b10-c05', 'b10-c06']);
    expect(pool.filter((i) => i.side === 'black').length).toBeGreaterThanOrEqual(4);
    for (const i of pool as (AssessmentItem & { hints?: unknown })[]) expect(i.hints, i.id).toBeUndefined();
  });

  it('unseen (03 §4.2 rule 4): no check item repeats a lesson or pool position, and no two b10 check items are near', () => {
    const lessonKeys = new Map(allUnits.flatMap((u) => u.lessons.flatMap((l) => l.exercises.map((e, i) => [normalKey(positionOf(e)), e.id ?? `${l.id}#${i}`] as const))));
    const poolKeys = new Map(Object.values(poolFiles).filter((p) => p.id !== 'b10-check').flatMap((p) => (p.items as AssessmentItem[]).map((e) => [normalKey(positionOf(e)), e.id!] as const)));
    for (const c of pool) {
      expect(lessonKeys.get(normalKey(positionOf(c))), c.id).toBeUndefined();
      expect(poolKeys.get(normalKey(positionOf(c))), c.id).toBeUndefined();
    }
    const hits = pool.flatMap((c) => pool.filter((o) => o.id !== c.id && nearDuplicate(positionOf(c), positionOf(o))).map((o) => `${c.id} ~ ${o.id}`));
    expect(hits).toEqual([]);
  });

  it('builds three 6-item short forms with 2 interleaved earlier items each (every objective, ≥ 2 Black, a critical item, ≤ half exposed)', () => {
    const earlier = ['b01-check', 'b02-check', 'b03-check', 'b04-check', 'b05-check', 'b06-check', 'b07-check', 'b08-check', 'b09-check'].flatMap((p) => poolFiles[p].items as AssessmentItem[]);
    const base = { unit: 'b10', objectives: b10.lessons.map((l) => l.id), primaryStrand: 'PP' as const, poolId: 'b10-check', assessmentVersion: 1, own: pool, earlier };
    const exposed = new Set<string>();
    for (const [attempt, maxExposed] of [[1, 0], [2, 0], [3, 0]] as const) {
      const r = assembleCheckForm({ ...base, exposed, seed: attempt });
      expect(r.ok, `attempt ${attempt}`).toBe(true);
      if (!r.ok) continue;
      expect(r.form.items).toHaveLength(6);
      expect(r.form.items.filter((i) => i.unit === 'b10')).toHaveLength(4);
      expect(new Set(r.form.items.filter((i) => i.unit === 'b10').map((i) => i.objective)).size).toBe(4);
      expect(r.form.items.filter((i) => i.side === 'black').length).toBeGreaterThanOrEqual(2);
      expect(r.form.items.some((i) => i.critical)).toBe(true);
      expect(r.form.exposedCount).toBeLessThanOrEqual(maxExposed);
      for (const i of r.form.items) exposed.add(i.id!);
    }
  });
});
