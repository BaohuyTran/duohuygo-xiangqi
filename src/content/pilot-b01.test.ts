// Content checks of unit b01 "Board, notation and the goal" (S3.1.a: lessons b01l1–b01l4, check pool b01-check), loaded
// in release state REL-P (`reviewed` with an approving record, so shown in the course preview only). The validator
// and the pool validator run on it with everything else (validate-shard-*.test.ts, pools.test.ts); the `.error` leak
// check is global (pilot-feedback.test.ts). This file pins what the unit must show (02 b01, 03 §4.1–§4.2, 05 §4).
import { describe, expect, it } from 'vitest';
import { gameStatus, legalMoves, makeMove, materialBalance, moveScore, parseFen, START_FEN, type Move, type Piece, type Position } from '../engine';
import { searchAtLeast } from '../analysis';
import { assembleCheckForm } from '../assessment/checks';
import { messages } from '../i18n/messages';
import { positionOf, expectedSelection } from '../lessons/answers';
import { isAccepted, moveKey, parseMoveKey } from '../lessons/decision';
import { formatMove, sideFileNumber } from '../notation/format';
import { allUnits } from './index';
import { normalKey, swapColours } from './normalize';
import { poolFiles } from './pools';
import { unitItems } from './release';
import type { AssessmentItem, ChoiceExercise, DecisionExercise, Exercise, MoveExercise, SelectSquaresExercise, Unit } from './types';

const b01 = allUnits.find((u) => u.id === 'b01') as Unit;
const u1 = allUnits.find((u) => u.id === 'u1') as Unit;
const items = b01.lessons.flatMap((l) => l.exercises);
const practice = items.filter((e) => e.type !== 'learn');
const check = poolFiles['b01-check'].items as AssessmentItem[];
const byId = (id: string) => [...items, ...check].find((e) => e.id === id) as Exercise;
const texts = messages as Record<string, { en: string; vi: string }>;

const moveOf = (pos: Position, key: string): Move => {
  const want = parseMoveKey(key)!;
  const m = legalMoves(pos).find((x) => x.from === want.from && x.to === want.to);
  if (!m) throw new Error(`${key} is not legal`);
  return m;
};
const statusAfter = (ex: Exercise, key: string) => {
  const pos = positionOf(ex);
  return gameStatus(makeMove(pos, moveOf(pos, key))).kind;
};
const name = (pos: Position, key: string, lang: 'en' | 'vi') => formatMove(moveOf(pos, key), pos, 'traditional', lang);
/** Does `m` gain ≥ `t` at `depth` (the engine's `moveScore(pos, m, depth)` − balance ≥ t)? A null-window search, same answer. */
function gainsAtLeast(pos: Position, m: Move, depth: number, t: number): boolean {
  const r = searchAtLeast(makeMove(pos, m), -materialBalance(pos.board, pos.turn) - t + 1e-6, { depth: depth - 1, maxNodes: 1e9 });
  if (!r.complete) throw new Error('search stopped');
  return !r.value;
}
const decisions = [...items, ...check].filter((e): e is DecisionExercise => e.type === 'decision');

describe('unit b01 (S3.1.a)', () => {
  it('follows 02 b01: four lessons, a learn card first, 5 practice items (b01l4: 6, it holds the TR item), ladder G2 → G1 → G0 (→ TR)', () => {
    expect(b01.track).toBe('basics');
    expect(b01.lessons.map((l) => l.id)).toEqual(['b01l1', 'b01l2', 'b01l3', 'b01l4']);
    const ladder = (lesson: number) => b01.lessons[lesson].exercises.filter((e) => e.type !== 'learn').map((e) => e.assist);
    expect(ladder(0)).toEqual(['G2', 'G2', 'G1', 'G1', 'G0']);
    expect(ladder(1)).toEqual(['G2', 'G2', 'G1', 'G1', 'G0']);
    expect(ladder(2)).toEqual(['G2', 'G2', 'G1', 'G1', 'G0']);
    expect(ladder(3)).toEqual(['G2', 'G2', 'G1', 'G1', 'G0', 'TR']);
    for (const lesson of b01.lessons) {
      expect(lesson.exercises[0].type, lesson.id).toBe('learn');
      // Learn cards come first (G3), then the practice items in ladder order.
      const firstPractice = lesson.exercises.findIndex((e) => e.type !== 'learn');
      expect(lesson.exercises.slice(firstPractice).every((e) => e.type !== 'learn'), lesson.id).toBe(true);
    }
    expect(practice.every((e) => e.strand === 'RS' && e.critical === false)).toBe(true);
    // Reviewed: every item is `reviewed` with an approving record in reviews/b01.json (preview only).
    expect(unitItems(b01).every(({ item }) => item.status === 'reviewed')).toBe(true);
  });

  it('both colours: the setup, palace, game-end and notation tasks are also played as Black (9 of 21 practice items)', () => {
    const black = practice.filter((e) => e.side === 'black').map((e) => e.id);
    expect(black).toEqual(['b01l1-05', 'b01l1-08', 'b01l2-05', 'b01l2-08', 'b01l3-05', 'b01l3-08', 'b01l4-05', 'b01l4-07', 'b01l4-09']);
    expect(black.length * 3).toBeGreaterThanOrEqual(practice.length);
    // RS is not a quiet-share strand (02 §2 rule 3); the tactic items are the four game-end items with a mate or stalemate.
    expect(practice.filter((e) => e.nature === 'tactic').map((e) => e.id)).toEqual(['b01l3-04', 'b01l3-06', 'b01l3-07', 'b01l3-08']);
  });

  it('misconceptions b01.m1–m6: each has a tagged learn card (remediation, 02 §7 item 10) and a tagged wrong answer', () => {
    const ids = ['b01.m1', 'b01.m2', 'b01.m3', 'b01.m4', 'b01.m5', 'b01.m6'];
    const cards = items.filter((e) => e.type === 'learn').flatMap((e) => e.misconceptions ?? []);
    expect([...new Set(cards)].sort()).toEqual(ids);
    const answers = (e: Exercise) => (e.type === 'choice' ? e.options.map((o) => o.misconception) : e.type === 'decision' ? e.table.map((r) => r.misconception) : []);
    expect([...new Set([...items, ...check].flatMap(answers).filter(Boolean))].sort()).toEqual(ids);
  });

  it('reuse (05 §4, T2): u1l1#0–#3 keep their positions; b01l1 (the u1l1 successor) holds the core item u1l1#3; the BLK twin is derived', () => {
    const legacy = (ref: string) => u1.lessons.find((l) => l.id === ref.split('#')[0])!.exercises[Number(ref.split('#')[1])];
    const reused = items.filter((e) => e.source?.kind === 'legacy');
    expect(reused.map((e) => [e.id, e.source!.legacyRef])).toEqual([
      ['b01l1-01', 'u1l1#1'],
      ['b01l1-03', 'u1l1#2'],
      ['b01l1-04', 'u1l1#3'],
      ['b01l2-01', 'u1l1#0'],
    ]);
    for (const e of reused) expect(normalKey(positionOf(e)), e.id).toBe(normalKey(positionOf(legacy(e.source!.legacyRef!))));
    const core = b01.lessons[0].exercises.filter((e) => e.type !== 'learn' && e.source?.legacyRef?.startsWith('u1l1#'));
    expect(core.map((e) => e.id)).toEqual(['b01l1-04']);
    const twin = byId('b01l1-05') as SelectSquaresExercise;
    expect(twin.source).toEqual({ kind: 'derived', derivedFrom: 'u1l1#3', transform: ['colour-swap', 'edit-pieces'] });
    // The colour swap of the legacy palace task, with Black's General moved one point (so no duplicate position).
    const swapped = swapColours(positionOf(legacy('u1l1#3')));
    const same = (a: Piece | null, b: Piece | null) => a?.type === b?.type && a?.color === b?.color;
    const diff = swapped.board.filter((p, sq) => !same(p, positionOf(twin).board[sq])).length;
    expect(diff).toBe(2);
    expect(twin.region).toBe('black-palace');
  });

  it('point tasks name the intended points, for the side that plays them (file numbers counted from that side’s right)', () => {
    const sq = (id: string) => expectedSelection(byId(id) as SelectSquaresExercise).map((s) => [s % 9, Math.floor(s / 9)]);
    expect(sq('b01l1-07')).toEqual([[4, 8]]); // Red: centre of the opponent's palace
    expect(sq('b01l1-08')).toEqual([[4, 5]]); // Black: middle file, last rank before the river on Black's side
    expect(sq('b01-c01')).toEqual([[4, 1]]); // Red: centre of own palace
    // Black's front left palace corner: rank 7 (nearest the river) and Black's file 6 (Black counts from its right, file a).
    const [[file, rank]] = sq('b01-c04');
    expect([sideFileNumber('black', file), rank]).toEqual([6, 7]);
  });

  it('setup tasks: the point to tap holds, in the starting position, the piece that is missing or out of place', () => {
    const start = parseFen(START_FEN);
    const cases: [string, string][] = [
      ['b01l2-04', 'horse'],
      ['b01l2-05', 'cannon'],
      ['b01l2-08', 'horse'],
      ['b01-c05', 'chariot'],
      ['b01-c08', 'elephant'],
    ];
    for (const [id, type] of cases) {
      const ex = byId(id) as SelectSquaresExercise;
      const [target] = expectedSelection(ex);
      expect(positionOf(ex).board[target], id).toBeNull();
      expect(start.board[target], id).toMatchObject({ type, color: ex.side });
    }
    // "Tap the piece that is not on its starting point": exactly one own piece differs from the start, and it is the answer.
    for (const id of ['b01l2-06', 'b01-c06']) {
      const ex = byId(id) as SelectSquaresExercise;
      const pos = positionOf(ex);
      const moved = pos.board.flatMap((p, s) => (p && p.color === ex.side && (start.board[s]?.type !== p.type || start.board[s]?.color !== p.color) ? [s] : []));
      expect(moved, id).toEqual(expectedSelection(ex));
    }
  });

  it('game-end items: learn cards show mate / check / stalemate; described moves and move options do what the texts say', () => {
    expect(gameStatus(positionOf(byId('b01l3-01'))).kind).toBe('checkmate');
    expect(gameStatus(positionOf(byId('b01l3-02'))).kind).toBe('check');
    expect(gameStatus(positionOf(byId('b01l3-03'))).kind).toBe('stalemate');
    // Prompts that describe a move: the move exists and has the stated result.
    expect(statusAfter(byId('b01l3-04'), 'a1-a9')).toBe('checkmate');
    expect(statusAfter(byId('b01l3-06'), 'a5-e5')).toBe('stalemate');
    expect(statusAfter(byId('b01-c09'), 'h0-f0')).toBe('checkmate');
    expect(statusAfter(byId('b01-c10'), 'c8-d8')).toBe('stalemate');
    // "In check, the game goes on": in check with a legal move.
    for (const id of ['b01l3-05', 'b01-c11']) expect(gameStatus(positionOf(byId(id))).kind, id).toBe('check');
    // Move options: correct exactly when the move ends the game (mate or stalemate); wrong options check or capture.
    for (const id of ['b01l3-07', 'b01l3-08']) {
      const ex = byId(id) as ChoiceExercise;
      const pos = positionOf(ex);
      for (const o of ex.options) {
        const s = statusAfter(ex, o.move!);
        expect(s === 'checkmate' || s === 'stalemate', `${id} ${o.id}`).toBe(o.correct);
        if (!o.correct) expect(s === 'check' || pos.board[moveOf(pos, o.move!).to] !== null, `${id} ${o.id}`).toBe(true);
      }
      expect(ex.options.filter((o) => o.correct).map((o) => statusAfter(ex, o.move!)).sort(), id).toEqual(['checkmate', 'stalemate']);
    }
  });

  it('notation tasks: the prompt writes the accepted move (en and vi); the m5 tempting move is the same move read with the other side’s numbers', () => {
    const moves = [...items, ...check].filter((e): e is MoveExercise | DecisionExercise => e.type === 'move' || e.type === 'decision');
    expect(moves.map((e) => e.id)).toEqual(['b01l4-04', 'b01l4-05', 'b01l4-06', 'b01l4-07', 'b01l4-08', 'b01l4-09', 'b01-c13', 'b01-c14', 'b01-c15', 'b01-c16']);
    for (const e of moves) {
      const pos = positionOf(e);
      const key = e.type === 'move' ? `${e.solution.from}-${e.solution.to}` : e.table.find((r) => isAccepted(r.class))!.move;
      for (const lang of ['en', 'vi'] as const) expect(texts[e.prompt][lang], `${e.id} ${lang}`).toContain(name(pos, key, lang));
      if (e.type !== 'decision') continue;
      const tempt = e.feedback!.temptingAlternative.move;
      const row = e.table.find((r) => r.move === tempt)!;
      if (row.misconception === 'b01.m5') {
        // Black item: the tempting move mirrors the files of the target (Red's file n is Black's file 10 − n).
        const [t, x] = [moveOf(pos, key), moveOf(pos, tempt)];
        expect(e.side, e.id).toBe('black');
        expect([x.from % 9, x.to % 9], e.id).toEqual([8 - (t.from % 9), 8 - (t.to % 9)]);
        expect([Math.floor(x.from / 9), Math.floor(x.to / 9)], e.id).toEqual([Math.floor(t.from / 9), Math.floor(t.to / 9)]);
      }
    }
  });

  it('tables: exactly one accepted move (the written one), every other playable row authored with a reason (02 §7 item 9)', () => {
    expect(decisions).toHaveLength(8);
    for (const d of decisions) {
      expect(d.alternatives, d.id).toBe(false);
      expect(d.table.filter((r) => isAccepted(r.class)), d.id).toHaveLength(1);
      for (const r of d.table.filter((x) => x.class !== 'error')) expect(r, `${d.id} ${r.move}`).toMatchObject({ source: 'authored', reason: expect.any(String) });
    }
  });

  it('accepted moves drop nothing (depth 2) and no rejected move wins ≥ T (2) at depth 2 or 4', () => {
    const bad: string[] = [];
    for (const d of decisions) {
      const pos = positionOf(d);
      for (const m of legalMoves(pos)) {
        const row = d.table.find((r) => r.move === moveKey(m))!;
        if (isAccepted(row.class)) {
          if (moveScore(pos, m, 2) - materialBalance(pos.board, pos.turn) <= -1) bad.push(`${d.id}: accepted ${row.move} drops material`);
        } else if (gainsAtLeast(pos, m, 2, 2) || gainsAtLeast(pos, m, 4, 2)) bad.push(`${d.id}: ${row.move} (${row.class}) gains ≥ 2`);
      }
    }
    expect(bad).toEqual([]);
  }, 600_000);
});

describe('b01 check pool (03 §4.1–§4.3)', () => {
  it('16 items, 4 per lesson objective, all b01 / RS / G0, both colours, neutral (no hints, no highlights)', () => {
    expect(check).toHaveLength(16);
    expect(poolFiles['b01-check']).toMatchObject({ id: 'b01-check', kind: 'check', unit: 'b01', primaryStrand: 'RS' });
    for (const lesson of ['b01l1', 'b01l2', 'b01l3', 'b01l4']) expect(check.filter((i) => i.objective === lesson), lesson).toHaveLength(4);
    expect(check.every((i) => i.unit === 'b01' && i.strand === 'RS' && i.assist === 'G0' && i.status === 'reviewed')).toBe(true);
    expect(check.filter((i) => i.side === 'black').length * 3).toBeGreaterThanOrEqual(check.length);
    for (const i of check as (AssessmentItem & { hints?: unknown; highlight?: unknown })[]) {
      expect(i.hints, i.id).toBeUndefined();
      expect(i.highlight, i.id).toBeUndefined();
    }
  });

  it('builds the 6-item short form three times: two unexposed forms, then one at most half exposed', () => {
    const base = { unit: 'b01', objectives: b01.lessons.map((l) => l.id), primaryStrand: 'RS' as const, poolId: 'b01-check', assessmentVersion: 1, own: check, earlier: [] };
    const exposed = new Set<string>();
    for (const [attempt, maxExposed] of [[1, 0], [2, 0], [3, 3]] as const) {
      const r = assembleCheckForm({ ...base, exposed, seed: attempt });
      expect(r.ok, `attempt ${attempt}`).toBe(true);
      if (!r.ok) continue;
      expect(r.form.items).toHaveLength(6);
      expect(new Set(r.form.items.map((i) => i.objective)).size).toBe(4);
      expect(r.form.exposedCount).toBeLessThanOrEqual(maxExposed);
      for (const i of r.form.items) exposed.add(i.id!);
    }
  });
});
