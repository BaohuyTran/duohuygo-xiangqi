// Content checks of unit b02 "General, Advisors and Elephants" (S3.1.b: lessons b02l1–b02l3, check pool b02-check),
// loaded in release state REL-P (`reviewed` with an approving record, so shown in the course preview only). The
// validator and the pool validator run on it with everything else (validate-shard-*.test.ts, pools.test.ts); the
// `.error` leak check is global (pilot-feedback.test.ts). This file pins what the unit must show (02 b02, 03 §4.1–§4.2,
// 05 §4).
import { describe, expect, it } from 'vitest';
import { legalMoves, makeMove, materialBalance, moveScore, parseSquare, squareName, type Move, type Position } from '../engine';
import { searchAtLeast } from '../analysis';
import { assembleCheckForm } from '../assessment/checks';
import { positionOf } from '../lessons/answers';
import { isAccepted, moveKey } from '../lessons/decision';
import { allUnits } from './index';
import { normalKey, swapColours } from './normalize';
import { poolFiles } from './pools';
import { unitItems } from './release';
import type { AssessmentItem, ChoiceExercise, DecisionExercise, Exercise, LearnExercise, Unit } from './types';

const b02 = allUnits.find((u) => u.id === 'b02') as Unit;
const legacyUnits = allUnits.filter((u) => /^u\d+$/.test(u.id));
const items = b02.lessons.flatMap((l) => l.exercises);
const practice = items.filter((e) => e.type !== 'learn');
const check = poolFiles['b02-check'].items as AssessmentItem[];
const byId = (id: string) => [...items, ...check].find((e) => e.id === id) as Exercise;
const decisions = [...items, ...check].filter((e): e is DecisionExercise => e.type === 'decision');

const legacy = (ref: string): Exercise => {
  const [lesson, index] = ref.split('#');
  return legacyUnits.flatMap((u) => u.lessons).find((l) => l.id === lesson)!.exercises[Number(index)];
};
/** Is `from-to` a legal move in the item's position? */
const legal = (ex: Exercise, key: string) => legalMoves(positionOf(ex)).some((m) => moveKey(m) === key);
const movesFrom = (pos: Position, sq: string) => legalMoves(pos).filter((m) => squareName(m.from) === sq).map((m) => squareName(m.to));
/** Destinations of `color`'s General if it were that side's turn. */
function generalSteps(pos: Position, color: 'red' | 'black'): number {
  const p = { ...pos, turn: color } as Position;
  return legalMoves(p).filter((m) => p.board[m.from]?.type === 'general').length;
}
function gainsAtLeast(pos: Position, m: Move, depth: number, t: number): boolean {
  const r = searchAtLeast(makeMove(pos, m), -materialBalance(pos.board, pos.turn) - t + 1e-6, { depth: depth - 1, maxNodes: 1e9 });
  if (!r.complete) throw new Error('search stopped');
  return !r.value;
}

describe('unit b02 (S3.1.b)', () => {
  it('follows 02 b02: three lessons, learn cards first, 5 practice items (b02l3: 6, it holds the TR item), ladder G2 → G1 → G0 (→ TR)', () => {
    expect(b02.track).toBe('basics');
    expect(b02.lessons.map((l) => l.id)).toEqual(['b02l1', 'b02l2', 'b02l3']);
    const ladder = (lesson: number) => b02.lessons[lesson].exercises.filter((e) => e.type !== 'learn').map((e) => e.assist);
    expect(ladder(0)).toEqual(['G2', 'G2', 'G1', 'G1', 'G0']);
    expect(ladder(1)).toEqual(['G2', 'G2', 'G1', 'G1', 'G0']);
    expect(ladder(2)).toEqual(['G2', 'G2', 'G1', 'G1', 'G0', 'TR']);
    for (const lesson of b02.lessons) {
      const first = lesson.exercises.findIndex((e) => e.type !== 'learn');
      expect(first, lesson.id).toBeGreaterThan(0);
      expect(lesson.exercises.slice(first).every((e) => e.type !== 'learn'), lesson.id).toBe(true);
    }
    // RS throughout; escaping the Chariot's check (b02l1-05) is the DE item. No safety-critical items in b02.
    expect(practice.filter((e) => e.strand !== 'RS').map((e) => [e.id, e.strand])).toEqual([['b02l1-05', 'DE']]);
    expect(practice.every((e) => e.critical === false)).toBe(true);
    expect(unitItems(b02).every(({ item }) => item.status === 'reviewed')).toBe(true);
  });

  it('both colours: 7 of 16 practice items are played as Black, including the TR item', () => {
    const black = practice.filter((e) => e.side === 'black').map((e) => e.id);
    expect(black).toEqual(['b02l1-07', 'b02l1-08', 'b02l2-05', 'b02l2-08', 'b02l3-07', 'b02l3-08', 'b02l3-09']);
    expect(black.length * 3).toBeGreaterThanOrEqual(practice.length);
  });

  it('misconceptions b02.m1–m4 (the 02 list, nothing else): each has a tagged learn card and a tagged wrong answer', () => {
    const ids = ['b02.m1', 'b02.m2', 'b02.m3', 'b02.m4'];
    const cards = items.filter((e) => e.type === 'learn').flatMap((e) => e.misconceptions ?? []);
    expect([...new Set(cards)].sort()).toEqual(ids);
    const answers = [...items, ...check].flatMap((e) => (e.type === 'choice' ? e.options.map((o) => o.misconception) : e.type === 'decision' ? e.table.map((r) => r.misconception) : []));
    expect([...new Set(answers.filter(Boolean))].sort()).toEqual(ids);
    expect([...new Set([...items, ...check].flatMap((e) => e.misconceptions ?? []))].sort()).toEqual(ids);
  });

  it('reuse (05 §4, T2): u1l2, u1l3 and u4l1#0/#1 keep their positions; successors hold core items; POS fix and BLK twin are derived', () => {
    const reused = items.filter((e) => e.source?.kind === 'legacy');
    expect(reused.map((e) => [e.id, e.source!.legacyRef])).toEqual([
      ['b02l1-01', 'u1l2#0'],
      ['b02l1-02', 'u1l2#2'],
      ['b02l1-03', 'u1l2#4'],
      ['b02l1-04', 'u1l2#1'],
      ['b02l1-05', 'u1l2#5'],
      ['b02l1-06', 'u1l2#3'],
      ['b02l2-01', 'u4l1#0'],
      ['b02l2-02', 'u4l1#1'],
      ['b02l3-01', 'u1l3#0'],
      ['b02l3-02', 'u1l3#2'],
      ['b02l3-04', 'u1l3#1'],
      ['b02l3-05', 'u1l3#3'],
      ['b02l3-06', 'u1l3#5'],
    ]);
    for (const e of reused) expect(normalKey(positionOf(e)), e.id).toBe(normalKey(positionOf(legacy(e.source!.legacyRef!))));
    // Successors (05 §3): b02l1 ← u1l2 and b02l3 ← u1l3 each hold the old lesson's practice items; b02l2 gets learn cards only.
    const core = (lesson: number, prefix: string) => b02.lessons[lesson].exercises.filter((e) => e.type !== 'learn' && e.source?.legacyRef?.startsWith(prefix)).length;
    expect([core(0, 'u1l2#'), core(2, 'u1l3#'), core(1, 'u4l1#')]).toEqual([3, 3, 0]);
    // u1l3#4 (POS: a Red Soldier on d3 can never stand there): the blocker on the eye is now a Horse.
    const pos = byId('b02l3-03') as LearnExercise;
    expect(pos.source).toEqual({ kind: 'derived', derivedFrom: 'u1l3#4', transform: ['edit-pieces'] });
    const old = positionOf(legacy('u1l3#4'));
    const changed = old.board.flatMap((p, sq) => (p?.type !== positionOf(pos).board[sq]?.type ? [squareName(sq)] : []));
    expect(changed).toEqual(['d3']);
    expect(positionOf(pos).board[parseSquare('d3')]).toMatchObject({ type: 'horse', color: 'red' });
    // The Black twin of u1l3#5: colour swap, Black's General moved one point.
    const twin = byId('b02l3-07');
    expect(twin.source).toEqual({ kind: 'derived', derivedFrom: 'u1l3#5', transform: ['colour-swap', 'edit-pieces'] });
    const swapped = swapColours(positionOf(legacy('u1l3#5')));
    const diff = swapped.board.filter((p, sq) => p?.type !== positionOf(twin).board[sq]?.type || p?.color !== positionOf(twin).board[sq]?.color).length;
    expect(diff).toBe(2);
  });

  it('learn cards show what their texts say: the General’s points, the face-off, the pinned piece, Advisor, Elephant and the eye', () => {
    const dots = (id: string) => {
      const e = byId(id) as LearnExercise;
      return movesFrom(positionOf(e), e.square!).sort();
    };
    expect(dots('b02l1-01')).toEqual(['d1', 'e0', 'e2', 'f1']);
    expect(dots('b02l1-03')).not.toContain('d1'); // the Chariot's file
    expect(dots('b02l2-01')).not.toContain('e0'); // the marked point would face Black's General
    expect(dots('b02l2-02')).toEqual([]); // the pinned Horse
    expect(dots('b02l2-03')).toEqual(['d8', 'e7', 'e9']); // f8 (highlighted) faces Red's General
    expect(dots('b02l3-01')).toEqual(['d0', 'd2', 'f0', 'f2']);
    expect(dots('b02l3-02')).toEqual(['c0', 'c4', 'g0', 'g4']);
    expect(dots('b02l3-03')).toEqual(['c0', 'g0', 'g4']); // d3 blocks the eye towards c4
  });

  it('legality questions: each keyed answer is what the engine says', () => {
    // The General never steps diagonally to the palace centre.
    expect(legal(byId('b02l1-07'), 'd9-e8')).toBe(false);
    // The piece between the Generals cannot leave the file.
    expect(movesFrom(positionOf(byId('b02l2-06')), 'e5').every((s) => s[0] === 'e')).toBe(true);
    // b02-c08: the Soldier between the Generals may only step forward along its file, never sideways.
    expect(movesFrom(positionOf(byId('b02-c08')), 'f6')).toEqual(['f7']);
    // Elephants at the river: every legal move stays on their own side; the eye towards the far point is free.
    for (const [id, sq, across, eye] of [
      ['b02l3-08', 'g5', 'i3', 'h4'],
      ['b02-c15', 'g5', 'e3', 'f4'],
    ] as const) {
      const pos = positionOf(byId(id));
      expect(movesFrom(pos, sq).every((s) => Number(s[1]) >= 5), id).toBe(true);
      expect(pos.board[parseSquare(across)], id).toMatchObject({ type: 'soldier', color: 'red' });
      expect(pos.board[parseSquare(eye)], id).toBeNull();
    }
    // The Elephant with a piece on its eye cannot move that way.
    expect(legal(byId('b02-c16'), 'g0-e2')).toBe(false);
    expect(positionOf(byId('b02-c16')).board[parseSquare('f1')]).not.toBeNull();
    // TR: a (Advisor to the centre) and d (the other Elephant) legal; b (over the Cannon on the eye) and c (General diagonally) not.
    const tr = byId('b02l3-09') as ChoiceExercise;
    expect(tr.options.map((o) => [o.id, o.correct])).toEqual([['a', true], ['b', false], ['c', false], ['d', true]]);
    expect([legal(tr, 'd9-e8'), legal(tr, 'g9-i7'), legal(tr, 'e9-f8') || legal(tr, 'e9-d8'), legal(tr, 'c9-e7')]).toEqual([true, false, false, true]);
    expect(positionOf(tr).board[parseSquare('h8')]).toMatchObject({ type: 'cannon', color: 'black' });
  });

  it('restrict tasks: accepted = exactly the General moves that take a point from the enemy General; other rows authored', () => {
    expect(decisions.map((d) => d.id)).toEqual(['b02l2-07', 'b02l2-08', 'b02-c09', 'b02-c10']);
    for (const d of decisions) {
      const pos = positionOf(d);
      const enemy = d.side === 'red' ? 'black' : 'red';
      const before = generalSteps(pos, enemy);
      for (const m of legalMoves(pos)) {
        const row = d.table.find((r) => r.move === moveKey(m))!;
        const takes = pos.board[m.from]?.type === 'general' && generalSteps(makeMove(pos, m), enemy) < before;
        expect(isAccepted(row.class), `${d.id} ${row.move}`).toBe(takes);
        if (row.class !== 'error') expect(row, `${d.id} ${row.move}`).toMatchObject({ source: 'authored', reason: expect.any(String) });
      }
      expect(d.table.filter((r) => isAccepted(r.class)), d.id).toHaveLength(1);
      expect(d.feedback!.temptingAlternative.move.startsWith(d.table.find((r) => isAccepted(r.class))!.move.slice(0, 2)), d.id).toBe(true);
    }
  });

  it('accepted moves drop nothing (depth 2) and no rejected move wins ≥ T (2) at depth 2 or 4; captures take a free piece', () => {
    const bad: string[] = [];
    for (const d of decisions) {
      const pos = positionOf(d);
      for (const m of legalMoves(pos)) {
        const row = d.table.find((r) => r.move === moveKey(m))!;
        if (isAccepted(row.class)) {
          if (moveScore(pos, m, 2) - materialBalance(pos.board, pos.turn) <= -1) bad.push(`${d.id}: accepted ${row.move} drops material`);
        } else if (gainsAtLeast(pos, m, 2, 2) || gainsAtLeast(pos, m, 4, 2)) bad.push(`${d.id}: ${row.move} gains ≥ 2`);
      }
    }
    expect(bad).toEqual([]);
    for (const id of ['b02l1-06', 'b02-c05']) {
      const e = byId(id) as Exercise & { solution: { from: string; to: string } };
      const pos = positionOf(e);
      const m = legalMoves(pos).find((x) => moveKey(x) === `${e.solution.from}-${e.solution.to}`)!;
      const after = makeMove(pos, m);
      expect(legalMoves(after).some((x) => x.to === m.to), `${id}: can be recaptured`).toBe(false);
    }
  });
});

type Placed = { f: number; r: number; type: string; color: string };
const placed = (pos: Position): Placed[] => pos.board.flatMap((p, sq) => (p ? [{ f: sq % 9, r: Math.floor(sq / 9), type: p.type, color: p.color }] : []));
/**
 * 03 §4.2 rule 4, stricter than the validator's corpus: is `item` the position `other` up to file mirror, colour swap
 * (side to move ignored), a shift of the whole pattern (aligned on the Generals) and ONE non-General piece added, removed
 * or moved?
 */
function nearDuplicate(item: Position, other: Position): boolean {
  const target = placed(item);
  const key = (p: Placed) => `${p.f},${p.r},${p.type},${p.color}`;
  const general = (list: Placed[], color: string) => list.find((p) => p.type === 'general' && p.color === color);
  for (const mirror of [false, true])
    for (const swap of [false, true]) {
      const moved = placed(other).map((p) => ({ f: mirror ? 8 - p.f : p.f, r: swap ? 9 - p.r : p.r, type: p.type, color: swap ? (p.color === 'red' ? 'black' : 'red') : p.color }));
      const [gr, gb, tr, tb] = [general(moved, 'red'), general(moved, 'black'), general(target, 'red'), general(target, 'black')];
      if (!gr || !gb || !tr || !tb) continue;
      const [df, dr] = [tr.f - gr.f, tr.r - gr.r];
      if (gb.f + df !== tb.f || gb.r + dr !== tb.r) continue;
      const a = new Set(moved.filter((p) => p.type !== 'general').map((p) => key({ ...p, f: p.f + df, r: p.r + dr })));
      const b = new Set(target.filter((p) => p.type !== 'general').map(key));
      const onlyA = [...a].filter((k) => !b.has(k));
      const onlyB = [...b].filter((k) => !a.has(k));
      const kind = (k: string) => k.split(',').slice(2).join();
      if (onlyA.length + onlyB.length <= 1) return true;
      if (onlyA.length === 1 && onlyB.length === 1 && kind(onlyA[0]) === kind(onlyB[0])) return true;
    }
  return false;
}

describe('b02 check pool (03 §4.1–§4.3)', () => {
  it('unseen (03 §4.2 rule 4): no check item is near any lesson item of any unit, nor another b02 check item', () => {
    const others = [
      ...allUnits.flatMap((u) => u.lessons.flatMap((l) => l.exercises.map((e, i) => ({ ref: e.id ?? `${l.id}#${i}`, pos: positionOf(e) })))),
      ...check.map((e) => ({ ref: e.id!, pos: positionOf(e) })),
    ];
    const hits = check.flatMap((c) => others.filter((o) => o.ref !== c.id && nearDuplicate(positionOf(c), o.pos)).map((o) => `${c.id} ~ ${o.ref}`));
    expect(hits).toEqual([]);
    // The detector itself: a shifted, mirrored, colour-swapped copy with one extra piece is caught.
    const base = positionOf(byId('b02l3-04'));
    const copy = { ...swapColours(base) };
    copy.board = copy.board.map((p, sq) => (sq === parseSquare('a3') ? { type: 'soldier' as const, color: 'red' as const } : p));
    expect(nearDuplicate(copy, base)).toBe(true);
  });

  it('16 items: 5 / 5 / 6 per lesson objective, all b02 G0, 8 as Black, neutral (no hints, no highlights)', () => {
    expect(check).toHaveLength(16);
    expect(poolFiles['b02-check']).toMatchObject({ id: 'b02-check', kind: 'check', unit: 'b02', primaryStrand: 'RS' });
    expect(['b02l1', 'b02l2', 'b02l3'].map((l) => check.filter((i) => i.objective === l).length)).toEqual([5, 5, 6]);
    expect(check.every((i) => i.unit === 'b02' && i.assist === 'G0' && i.status === 'reviewed')).toBe(true);
    expect(check.filter((i) => i.side === 'black')).toHaveLength(8);
    for (const i of check as (AssessmentItem & { hints?: unknown; highlight?: unknown })[]) {
      expect(i.hints, i.id).toBeUndefined();
      expect(i.highlight, i.id).toBeUndefined();
    }
  });

  // Before b03 a check has no interleaved items, so a form takes 8 own items: the 16-item pool (B2) builds two disjoint
  // forms, and a third attempt is unavailable until new items exist (03 §4.3: at most half of a form exposed).
  it('builds the 8-item form twice, disjoint (≥ 3 Black each, every objective); a third form cannot be built', () => {
    const base = { unit: 'b02', objectives: b02.lessons.map((l) => l.id), primaryStrand: 'RS' as const, poolId: 'b02-check', assessmentVersion: 1, own: check, earlier: [] };
    const exposed = new Set<string>();
    for (const attempt of [1, 2]) {
      const r = assembleCheckForm({ ...base, exposed, seed: attempt });
      expect(r.ok, `attempt ${attempt}`).toBe(true);
      if (!r.ok) continue;
      expect(r.form.items).toHaveLength(8);
      expect(new Set(r.form.items.map((i) => i.objective)).size).toBe(3);
      expect(r.form.items.filter((i) => i.side === 'black').length).toBeGreaterThanOrEqual(3);
      expect(r.form.exposedCount).toBe(0);
      for (const i of r.form.items) exposed.add(i.id!);
    }
    expect(exposed.size).toBe(16);
    expect(assembleCheckForm({ ...base, exposed, seed: 3 })).toEqual({ ok: false, reason: 'cannot-build' });
  });
});
