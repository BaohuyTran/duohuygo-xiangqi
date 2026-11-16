// Content checks of unit b03 "Chariot and Horse" (S3.1.c: lessons b03l1–b03l3, check pool b03-check), loaded in release
// state REL-P (`verified`, so neither served nor in the preview until the independent review). The validator and the
// pool validator run on it with everything else (validate-shard-*.test.ts, pools.test.ts); the `.error` leak check is
// global (pilot-feedback.test.ts). This file pins what the unit must show (02 b03, 03 §4.1–§4.3, 05 §4).
import { describe, expect, it } from 'vitest';
import { legalMoves, parseSquare, squareName, type Position } from '../engine';
import { assembleCheckForm } from '../assessment/checks';
import { captureFacts, captureGain, expectedSelection, positionOf } from '../lessons/answers';
import { moveKey } from '../lessons/decision';
import { allUnits } from './index';
import { nearDuplicate } from './near-duplicate';
import { normalKey, swapColours } from './normalize';
import { poolFiles } from './pools';
import { unitItems } from './release';
import type { AssessmentItem, CaptureExercise, ChoiceExercise, Exercise, LearnExercise, SelectSquaresExercise, Unit } from './types';

const b03 = allUnits.find((u) => u.id === 'b03') as Unit;
const legacyUnits = allUnits.filter((u) => /^u\d+$/.test(u.id));
const items = b03.lessons.flatMap((l) => l.exercises);
const practice = items.filter((e) => e.type !== 'learn');
const check = poolFiles['b03-check'].items as AssessmentItem[];
const byId = (id: string) => [...items, ...check].find((e) => e.id === id) as Exercise;

const legacy = (ref: string): Exercise => {
  const [lesson, index] = ref.split('#');
  return legacyUnits.flatMap((u) => u.lessons).find((l) => l.id === lesson)!.exercises[Number(index)];
};
const movesFrom = (pos: Position, sq: string) => legalMoves(pos).filter((m) => squareName(m.from) === sq).map((m) => squareName(m.to)).sort();
const legal = (ex: Exercise, key: string) => legalMoves(positionOf(ex)).some((m) => moveKey(m) === key);
const names = (squares: number[]) => squares.map(squareName).sort();

describe('unit b03 (S3.1.c)', () => {
  it('follows 02 b03: three lessons, learn cards first, 5 practice items (b03l3: 6, it holds the TR item), ladder G2 → G1 → G0 (→ TR)', () => {
    expect(b03.track).toBe('basics');
    expect(b03.lessons.map((l) => l.id)).toEqual(['b03l1', 'b03l2', 'b03l3']);
    const ladder = (lesson: number) => b03.lessons[lesson].exercises.filter((e) => e.type !== 'learn').map((e) => e.assist);
    expect(ladder(0)).toEqual(['G2', 'G2', 'G1', 'G1', 'G0']);
    expect(ladder(1)).toEqual(['G2', 'G2', 'G1', 'G1', 'G0']);
    expect(ladder(2)).toEqual(['G2', 'G2', 'G1', 'G1', 'G0', 'TR']);
    for (const lesson of b03.lessons) {
      const first = lesson.exercises.findIndex((e) => e.type !== 'learn');
      expect(first, lesson.id).toBeGreaterThan(0);
      expect(lesson.exercises.slice(first).every((e) => e.type !== 'learn'), lesson.id).toBe(true);
    }
    expect(practice.every((e) => e.strand === 'RS' && e.critical === false)).toBe(true);
    expect(unitItems(b03).every(({ item }) => item.status === 'verified')).toBe(true);
  });

  it('both colours: 6 of 16 practice items as Black, including the crowded full-board TR item', () => {
    const black = practice.filter((e) => e.side === 'black').map((e) => e.id);
    expect(black).toEqual(['b03l1-04', 'b03l1-06', 'b03l2-05', 'b03l2-07', 'b03l3-04', 'b03l3-07']);
    expect(black.length * 3).toBeGreaterThanOrEqual(practice.length);
  });

  it('misconceptions b03.m1–m3 (the 02 list only): each has a tagged learn card and a tagged wrong answer', () => {
    const ids = ['b03.m1', 'b03.m2', 'b03.m3'];
    expect([...new Set(items.filter((e) => e.type === 'learn').flatMap((e) => e.misconceptions ?? []))].sort()).toEqual(ids);
    const answers = [...items, ...check].flatMap((e) => (e.type === 'choice' ? e.options.map((o) => o.misconception) : []));
    expect([...new Set(answers.filter(Boolean))].sort()).toEqual(ids);
    expect([...new Set([...items, ...check].flatMap((e) => e.misconceptions ?? []))].sort()).toEqual(ids);
  });

  it('reuse (05 §4, T2): u2l1#0–#2 and u2l2 keep their positions; u2l1#3 is not used (it goes to b06); BLK twins are derived', () => {
    const reused = items.filter((e) => e.source?.kind === 'legacy');
    expect(reused.map((e) => [e.id, e.source!.legacyRef])).toEqual([
      ['b03l1-01', 'u2l1#0'],
      ['b03l1-03', 'u2l1#1'],
      ['b03l1-05', 'u2l1#2'],
      ['b03l2-01', 'u2l2#0'],
      ['b03l2-02', 'u2l2#2'],
      ['b03l2-04', 'u2l2#1'],
      ['b03l2-06', 'u2l2#3'],
      ['b03l3-02', 'u2l2#4'],
    ]);
    for (const e of reused) expect(normalKey(positionOf(e)), e.id).toBe(normalKey(positionOf(legacy(e.source!.legacyRef!))));
    expect(JSON.stringify(b03)).not.toContain('u2l1#3');
    // Successors (05 §3): b03l1 ← u2l1 and b03l2 ← u2l2 hold the old lessons' practice items; u2l2#4 serves b03l3.
    const core = (lesson: number, prefix: string) => b03.lessons[lesson].exercises.filter((e) => e.type !== 'learn' && e.source?.legacyRef?.startsWith(prefix)).length;
    expect([core(0, 'u2l1#'), core(1, 'u2l2#'), core(2, 'u2l2#')]).toEqual([2, 2, 1]);
    for (const [id, from] of [['b03l1-04', 'u2l1#1'], ['b03l2-05', 'u2l2#1']] as const) {
      const twin = byId(id);
      expect(twin.source, id).toEqual({ kind: 'derived', derivedFrom: from, transform: ['colour-swap', 'edit-pieces'] });
      const swapped = swapColours(positionOf(legacy(from)));
      const diff = swapped.board.filter((p, sq) => p?.type !== positionOf(twin).board[sq]?.type || p?.color !== positionOf(twin).board[sq]?.color).length;
      expect(diff, id).toBe(2); // Black's General moved one point
    }
  });

  it('learn cards show what their texts say: the Chariot’s line, the leg, the landing point, the attacked pieces', () => {
    const dots = (id: string) => {
      const e = byId(id) as LearnExercise;
      return movesFrom(positionOf(e), e.square!);
    };
    // The Chariot takes the first enemy piece on a line and stops before its own Elephant.
    expect(dots('b03l1-02')).toEqual(['a2', 'b2', 'c1', 'c3', 'c4', 'c5', 'c6', 'd2', 'e2', 'f2', 'g2']);
    expect(dots('b03l2-01')).toHaveLength(8);
    expect(dots('b03l2-02')).not.toEqual(expect.arrayContaining(['d6']));
    expect(dots('b03l2-02')).toHaveLength(6); // the leg e5 removes d6 and f6
    expect(dots('b03l2-03')).toContain('f6'); // the enemy Horse on a landing point can be taken
    expect(dots('b03l2-03')).not.toContain('d6'); // the own Cannon removes only that point
    expect(dots('b03l2-03')).toHaveLength(7);
    const card = byId('b03l3-01') as LearnExercise;
    const pos = positionOf(card);
    const attacked = pos.board.flatMap((p, sq) => (p && p.color === 'black' && p.type !== 'general' && captureFacts(pos.board, sq).attackers.length ? [squareName(sq)] : []));
    expect(attacked.sort()).toEqual([...(card.highlight as string[])].sort());
  });

  it('choice keys are what the engine says (blocked lines, legs, landing points, move counts)', () => {
    expect(legal(byId('b03l1-06'), 'e8-e3')).toBe(false);
    expect(movesFrom(positionOf(byId('b03l1-06')), 'e8')).not.toContain('e3');
    expect(legal(byId('b03-c05'), 'a0-a7')).toBe(false);
    // b03l2-07: the Red Soldier on the forward leg blocks two moves; the Red Horse can be taken.
    const l207 = positionOf(byId('b03l2-07'));
    expect(movesFrom(l207, 'e7')).toEqual(['c6', 'c8', 'f9', 'g6', 'g8']);
    expect(legal(byId('b03l2-07'), 'e7-d5') || legal(byId('b03l2-07'), 'e7-f5')).toBe(false);
    expect(l207.board[parseSquare('e6')]).toMatchObject({ type: 'soldier', color: 'red' });
    // b03-c09: exactly two moves, one of them the capture of the Red Horse; the own Cannon stands on a leg.
    const c09 = positionOf(byId('b03-c09'));
    expect(movesFrom(c09, 'b8')).toEqual(['a6', 'c6']);
    expect(c09.board[parseSquare('c6')]).toMatchObject({ type: 'horse', color: 'red' });
    expect(c09.board[parseSquare('c8')]).toMatchObject({ type: 'cannon', color: 'black' });
    for (const id of ['b03l2-07', 'b03-c09']) {
      const c = byId(id) as ChoiceExercise;
      expect(c.options.filter((o) => o.correct).map((o) => o.id), id).toEqual(['a', 'b']);
    }
  });

  it('“Chariot or Horse” prompts: every attacked piece is attacked by a Chariot or Horse only; each answer is non-empty and leaves something out', () => {
    for (const id of ['b03l3-03', 'b03l3-04']) {
      const ex = byId(id) as SelectSquaresExercise;
      const pos = positionOf(ex);
      for (const sq of expectedSelection(ex)) {
        const types = captureFacts(pos.board, sq).attackers.map((a) => pos.board[a]!.type);
        expect(types.every((t) => t === 'chariot' || t === 'horse'), `${id} ${squareName(sq)}`).toBe(true);
      }
    }
    for (const ex of [...items, ...check].filter((e): e is SelectSquaresExercise => e.type === 'select-squares' && !!e.query)) {
      const pos = positionOf(ex);
      const target = (ex.query as { side: 'red' | 'black' }).side;
      const all = pos.board.filter((p) => p && p.color === target && p.type !== 'general').length;
      const n = expectedSelection(ex).length;
      expect(n, ex.id).toBeGreaterThan(0);
      expect(n, ex.id).toBeLessThan(all);
    }
    expect(names(expectedSelection(byId('b03l3-07') as SelectSquaresExercise))).toEqual(['e6', 'g6', 'h7', 'i6']);
    expect(names(expectedSelection(byId('b03-c16') as SelectSquaresExercise))).toEqual(['e6', 'h3']);
  });

  it('captures: the solution is the single best capture; the tempting move is a worse capture (or a non-capture)', () => {
    for (const e of [...items, ...check].filter((x): x is CaptureExercise => x.type === 'capture')) {
      const pos = positionOf(e);
      const caps = legalMoves(pos).filter((m) => pos.board[m.to]);
      const best = Math.max(...caps.map((m) => captureGain(pos, m)));
      const sol = caps.find((m) => moveKey(m) === `${e.solution.from}-${e.solution.to}`)!;
      expect(captureGain(pos, sol), e.id).toBe(best);
      expect(caps.filter((m) => captureGain(pos, m) === best), e.id).toHaveLength(1);
      const tempt = legalMoves(pos).find((m) => moveKey(m) === e.feedback?.temptingAlternative.move);
      if (tempt && pos.board[tempt.to]) expect(captureGain(pos, tempt), e.id).toBeLessThan(best);
    }
  });
});

describe('b03 check pool (03 §4.1–§4.3)', () => {
  it('16 items: 5 / 5 / 6 per lesson objective, all b03 G0, 7 as Black, neutral (no hints, no highlights)', () => {
    expect(check).toHaveLength(16);
    expect(poolFiles['b03-check']).toMatchObject({ id: 'b03-check', kind: 'check', unit: 'b03', primaryStrand: 'RS' });
    expect(['b03l1', 'b03l2', 'b03l3'].map((l) => check.filter((i) => i.objective === l).length)).toEqual([5, 5, 6]);
    expect(check.every((i) => i.unit === 'b03' && i.assist === 'G0' && i.status === 'verified')).toBe(true);
    expect(check.filter((i) => i.side === 'black')).toHaveLength(7);
    for (const i of check as (AssessmentItem & { hints?: unknown; highlight?: unknown })[]) {
      expect(i.hints, i.id).toBeUndefined();
      expect(i.highlight, i.id).toBeUndefined();
    }
  });

  it('unseen (03 §4.2 rule 4): no check item is near any lesson item of any unit, nor another b03 check item', () => {
    const others = [
      ...allUnits.flatMap((u) => u.lessons.flatMap((l) => l.exercises.map((e, i) => ({ ref: e.id ?? `${l.id}#${i}`, pos: positionOf(e) })))),
      ...check.map((e) => ({ ref: e.id!, pos: positionOf(e) })),
    ];
    const hits = check.flatMap((c) => others.filter((o) => o.ref !== c.id && nearDuplicate(positionOf(c), o.pos)).map((o) => `${c.id} ~ ${o.ref}`));
    expect(hits).toEqual([]);
  });

  // From b03 on a form is 6 own items + 2 interleaved items from earlier units (03 §4.1, checks.ts): the 16 own items build
  // two disjoint forms (12 items) and a third with at most half exposed, interleaving from the b01 / b02 check pools.
  it('builds three 8-item forms with 2 interleaved b01 / b02 items each (≥ 3 Black, every objective, ≤ half exposed)', () => {
    const earlier = [...(poolFiles['b01-check'].items as AssessmentItem[]), ...(poolFiles['b02-check'].items as AssessmentItem[])];
    const base = { unit: 'b03', objectives: b03.lessons.map((l) => l.id), primaryStrand: 'RS' as const, poolId: 'b03-check', assessmentVersion: 1, own: check, earlier };
    const exposed = new Set<string>();
    for (const [attempt, maxExposed] of [[1, 0], [2, 0], [3, 4]] as const) {
      const r = assembleCheckForm({ ...base, exposed, seed: attempt });
      expect(r.ok, `attempt ${attempt}`).toBe(true);
      if (!r.ok) continue;
      expect(r.form.items).toHaveLength(8);
      expect(r.form.items.filter((i) => i.unit === 'b03')).toHaveLength(6);
      expect(r.form.items.filter((i) => i.unit === 'b01' || i.unit === 'b02')).toHaveLength(2);
      expect(new Set(r.form.items.filter((i) => i.unit === 'b03').map((i) => i.objective)).size).toBe(3);
      expect(r.form.items.filter((i) => i.side === 'black').length).toBeGreaterThanOrEqual(3);
      expect(r.form.exposedCount).toBeLessThanOrEqual(maxExposed);
      for (const i of r.form.items) exposed.add(i.id!);
    }
  });
});
