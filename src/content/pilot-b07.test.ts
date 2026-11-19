// Content checks of unit b07 "Exchanges and relative material value" (S3.2.c: lessons b07l1–b07l3, check pool
// b07-check), loaded in release state REL-P (`verified` until the content review: not in the preview, not served by
// default). The validator and the pool validator run on it with everything else. This file pins what the unit must show
// (02 b07, 03 §4.1–§4.3, 05 DV3) and that every claim holds for EVERY accepted move (b05 / b06 review lessons): counts
// and "keeps all your material" are checked against the best line of 4 plies.
import { describe, expect, it } from 'vitest';
import { legalMoves, makeMove, materialBalance, parseFen, PIECE_VALUES, squareName, START_FEN, toFen, type Position } from '../engine';
import { search } from '../analysis';
import { assembleCheckForm } from '../assessment/checks';
import { captureGain, checkCapture, positionOf } from '../lessons/answers';
import { isAccepted, moveKey } from '../lessons/decision';
import { syncSafety } from '../lessons/decision-table';
import { allUnits } from './index';
import { nearDuplicate } from './near-duplicate';
import { poolFiles } from './pools';
import { unitItems } from './release';
import type { AssessmentItem, CaptureExercise, ChoiceExercise, DecisionExercise, Exercise, Unit } from './types';

const b07 = allUnits.find((u) => u.id === 'b07') as Unit;
const items = b07.lessons.flatMap((l) => l.exercises);
const practice = items.filter((e) => e.type !== 'learn');
const check = poolFiles['b07-check'].items as AssessmentItem[];
const all = [...items, ...check];
const byId = (id: string) => all.find((e) => e.id === id) as Exercise;
const pos = (id: string) => positionOf(byId(id));
const keysOf = (p: Position) => legalMoves(p).map(moveKey);
const moveOf = (p: Position, key: string) => {
  const m = legalMoves(p).find((x) => moveKey(x) === key);
  if (!m) throw new Error(`illegal ${key}`);
  return m;
};
const after = (p: Position, key: string) => makeMove(p, moveOf(p, key));
const gain = (p: Position, key: string) => captureGain(p, moveOf(p, key));
/** Material change for the mover after `key` and the best line of 4 plies (opponent first, captures resolved). */
const d4 = (p: Position, key: string) => {
  const r = search(after(p, key), { depth: 4, maxNodes: 3e6 });
  expect(r.complete, key).toBe(true);
  return -r.score - materialBalance(p.board, p.turn);
};
const safe = syncSafety();
const option = (id: string, o: string) => (byId(id) as ChoiceExercise).options.find((x) => x.id === o)!;
const correct = (id: string) => (byId(id) as ChoiceExercise).options.filter((o) => o.correct).map((o) => o.id);

describe('unit b07 (S3.2.c)', () => {
  it('follows 02 b07: three lessons, learn cards first, ladders G2 G2 G1 G1 G0 (b07l3 adds the TR item)', () => {
    expect(b07.track).toBe('basics');
    expect(b07.lessons.map((l) => l.id)).toEqual(['b07l1', 'b07l2', 'b07l3']);
    const ladder = (lesson: number) => b07.lessons[lesson].exercises.filter((e) => e.type !== 'learn').map((e) => e.assist);
    expect(ladder(0)).toEqual(['G2', 'G2', 'G1', 'G1', 'G0']);
    expect(ladder(1)).toEqual(['G2', 'G2', 'G1', 'G1', 'G0']);
    expect(ladder(2)).toEqual(['G2', 'G2', 'G1', 'G1', 'G0', 'TR']);
    for (const lesson of b07.lessons) {
      const first = lesson.exercises.findIndex((e) => e.type !== 'learn');
      expect(first, lesson.id).toBeGreaterThan(0);
      expect(lesson.exercises.slice(first).every((e) => e.type !== 'learn'), lesson.id).toBe(true);
    }
    expect(unitItems(b07).every(({ item }) => item.status === 'verified')).toBe(true);
    expect([...new Set(practice.map((e) => e.strand))].sort()).toEqual(['PA', 'RS', 'TC']);
    expect(practice.every((e) => e.critical === false)).toBe(true);
    // New content only (05 DV3): no legacy reuse.
    expect(all.every((e) => e.source?.kind === 'authored')).toBe(true);
  });

  it('both colours: 9 of 16 practice items as Black, including the TR item', () => {
    expect(practice.filter((e) => e.side === 'black').map((e) => e.id)).toEqual([
      'b07l1-05', 'b07l1-07', 'b07l1-08', 'b07l2-04', 'b07l2-06', 'b07l3-04', 'b07l3-06', 'b07l3-07', 'b07l3-08',
    ]);
  });

  it('misconceptions b07.m1–m3 (the 02 list): each has a tagged learn card and a tagged wrong answer', () => {
    const ids = ['b07.m1', 'b07.m2', 'b07.m3'];
    expect([...new Set(items.filter((e) => e.type === 'learn').flatMap((e) => e.misconceptions ?? []))].sort()).toEqual(ids);
    const answers = all.flatMap((e) =>
      e.type === 'choice' ? e.options.filter((o) => !o.correct).map((o) => o.misconception) : e.type === 'decision' ? e.table.map((r) => r.misconception) : [],
    );
    expect([...new Set(answers.filter(Boolean))].sort()).toEqual(ids);
    expect([...new Set(all.flatMap((e) => e.misconceptions ?? []))].sort()).toEqual(ids);
  });

  it('the values taught are the engine’s (solver.ts), including the crossed Soldier at 1 (disclosed limitation)', () => {
    expect(PIECE_VALUES).toMatchObject({ chariot: 9, cannon: 4.5, horse: 4, advisor: 2, elephant: 2, soldier: 1 });
    // b07l1-02 and b07-c04 show a Red Soldier across the river (rank ≥ 5) that the engine still counts as 1.
    for (const id of ['b07l1-02', 'b07-c04']) {
      const p = pos(id);
      expect(p.board.some((x, s) => x?.type === 'soldier' && x.color === 'red' && Math.floor(s / 9) >= 5), id).toBe(true);
    }
    expect(correct('b07l1-07')).toEqual(['a']);
    expect(correct('b07-c03')).toEqual(['a']);
    expect(correct('b07-c04')).toEqual(['a']);
  });
});

describe('b07 claims hold for every accepted move (depth 4)', () => {
  it('captures: every accepted capture wins at least the stated count; the tempting move wins less', () => {
    const caps = all.filter((e): e is CaptureExercise => e.type === 'capture');
    expect(caps.map((e) => e.id)).toEqual([
      'b07l1-04', 'b07l1-05', 'b07l1-06', 'b07l1-08', 'b07l2-03', 'b07l2-04', 'b07l2-07', 'b07-c01', 'b07-c02', 'b07-c05', 'b07-c06', 'b07-c07',
    ]);
    for (const e of caps) {
      const p = positionOf(e);
      const sol = `${e.solution.from}-${e.solution.to}`;
      const count = gain(p, sol);
      expect(count, e.id).toBeGreaterThan(0);
      const accepted = keysOf(p).filter((k) => checkCapture(e, moveOf(p, k)) === 'correct');
      expect(accepted, e.id).toContain(sol);
      for (const k of accepted) expect(d4(p, k), `${e.id} ${k}`).toBeGreaterThanOrEqual(count);
      if (e.feedback) {
        const t = e.feedback.temptingAlternative.move;
        expect(checkCapture(e, moveOf(p, t)), `${e.id} tempt`).not.toBe('correct');
        expect(d4(p, t), `${e.id} tempt`).toBeLessThan(count);
        if (p.board[moveOf(p, t).to] && gain(p, t) < 0) expect(d4(p, t), `${e.id} tempt`).toBeLessThan(0);
      }
    }
  }, 300_000);

  it('decisions: target rows pass the guard and keep the material, every other row loses; the best move is not a capture where taught', () => {
    const decisions = all.filter((e): e is DecisionExercise => e.type === 'decision');
    expect(decisions.map((e) => e.id)).toEqual(['b07l2-05', 'b07l3-05', 'b07l3-07', 'b07-c08', 'b07-c09', 'b07-c13', 'b07-c14', 'b07-c16']);
    for (const d of decisions) {
      const p = positionOf(d);
      expect(d.table.map((r) => r.move).sort(), d.id).toEqual(keysOf(p).sort());
      for (const row of d.table) {
        const v = d4(p, row.move);
        if (isAccepted(row.class)) {
          expect(v, `${d.id} ${row.move}`).toBeGreaterThanOrEqual(0);
          expect(safe(p, moveOf(p, row.move), { itemId: d.id }), `${d.id} ${row.move}`).toMatchObject({ status: 'checked', safe: true });
        } else {
          expect(row.class, `${d.id} ${row.move}`).toBe('error');
          expect(v, `${d.id} ${row.move}`).toBeLessThan(0);
        }
      }
      const tempt = d.table.find((r) => r.move === d.feedback!.temptingAlternative.move)!;
      expect(tempt.misconception, d.id).toBe('b07.m1');
    }
    // "The best move is not a capture": every capture loses, and the tempting capture looks free or winning at once.
    for (const id of ['b07l2-05', 'b07l3-07', 'b07-c08', 'b07-c09', 'b07-c14', 'b07-c16']) {
      const d = byId(id) as DecisionExercise;
      const p = positionOf(d);
      for (const row of d.table.filter((r) => p.board[moveOf(p, r.move).to])) expect(row.class, `${id} ${row.move}`).toBe('error');
      expect(p.board[moveOf(p, d.feedback!.temptingAlternative.move).to], id).not.toBeNull();
    }
    // Captures that look free (no recapture at once) but lose two moves later: the uncovered file.
    for (const id of ['b07l3-07', 'b07-c09', 'b07-c16']) {
      const p = pos(id);
      const t = (byId(id) as DecisionExercise).feedback!.temptingAlternative.move;
      expect(gain(p, t), id).toBe(1);
      expect(d4(p, t), id).toBe(-3);
    }
    // The double-attack items: the equal trade is accepted.
    expect((byId('b07l3-05') as DecisionExercise).table.find((r) => r.move === 'g1-f3')!.class).toBe('target');
    expect(gain(pos('b07l3-05'), 'g1-f3')).toBe(0);
    expect((byId('b07-c13') as DecisionExercise).table.find((r) => r.move === 'g5-d5')!.class).toBe('target');
    expect(gain(pos('b07-c13'), 'g5-d5')).toBe(0);
  }, 300_000);

  it('counting choices: the exchange count is what the engine says', () => {
    for (const [id, key] of [['b07l2-06', 'h8-h2'], ['b07-c10', 'b2-b7']] as const) {
      expect(gain(pos(id), key), id).toBe(-4.5);
      expect(d4(pos(id), key), id).toBe(-4.5);
      expect(correct(id), id).toEqual(['a']);
    }
  }, 120_000);

  it('trade choices: ahead / behind as stated, the trade is even, and the answers keep or lose material as the feedback says', () => {
    for (const id of ['b07l3-03', 'b07l3-06', 'b07-c11', 'b07-c15']) {
      const p = pos(id);
      expect(materialBalance(p.board, p.turn), id).toBeGreaterThan(0);
      const trade = option(id, 'a').move!;
      expect(gain(p, trade), id).toBe(0);
      expect(d4(p, trade), id).toBeGreaterThanOrEqual(0);
      expect(correct(id), id).toEqual(['a']);
    }
    // b07l3-03.b: retreating keeps the material too (the feedback says so); the trade is simply better.
    expect(d4(pos('b07l3-03'), option('b07l3-03', 'b').move!)).toBeGreaterThanOrEqual(0);
    // b07-c12: behind; the trade is even, and moving the Chariot away keeps the material.
    const c12 = pos('b07-c12');
    expect(materialBalance(c12.board, c12.turn)).toBeLessThan(0);
    expect(gain(c12, option('b07-c12', 'b').move!)).toBe(0);
    expect(keysOf(c12).some((k) => k.startsWith('d7-') && k !== 'd7-d4' && d4(c12, k) >= 0)).toBe(true);
    expect(correct('b07-c12')).toEqual(['a']);
    // b07l3-04: taking the forking Horse is the only answer that keeps everything; saving one piece loses the other.
    const l34 = pos('b07l3-04');
    expect(d4(l34, option('b07l3-04', 'a').move!)).toBeGreaterThanOrEqual(0);
    for (const o of ['b', 'c']) expect(d4(l34, option('b07l3-04', o).move!), o).toBeLessThan(0);
    expect(keysOf(l34).filter((k) => d4(l34, k) >= 0)).toEqual(['c8-d6']);
  }, 300_000);

  it('TR b07l3-08: full board as Black after Red’s Horse move; the Soldier looks free but is lost back two moves later', () => {
    const seq = ['a0-a1', 'd9-e8', 'a1-d1', 'g9-e7', 'e3-e4', 'e6-e5', 'g0-e2', 'c6-c5', 'b0-c2', 'b7-b3', 'h0-i2'];
    let p = parseFen(START_FEN);
    for (const k of seq) p = after(p, k);
    const tr = pos('b07l3-08');
    expect(toFen(tr)).toBe(toFen(p));
    expect(tr.turn).toBe('black');
    expect(tr.board.filter(Boolean)).toHaveLength(32);
    expect(gain(tr, 'b3-g3')).toBe(1); // nothing can take back at once
    expect(d4(tr, 'b3-g3')).toBe(-3);
    const r = search(after(tr, 'b3-g3'), { depth: 4, maxNodes: 3e6 });
    expect(r.pv.slice(0, 3).map((m) => `${squareName(m.from)}-${squareName(m.to)}`)).toEqual(['h2-h9', 'i9-h9', 'i2-g3']);
    expect(correct('b07l3-08')).toEqual(['a']);
  }, 120_000);
});

/** Learner-relative signature of a check item: kind of task + material (own / opponent piece types). */
function signature(e: AssessmentItem): string {
  const p = positionOf(e);
  const own = p.turn;
  const types = (mine: boolean) => p.board.filter((x) => x && (x.color === own) === mine).map((x) => x!.type).sort().join(',');
  const task = e.type === 'move' ? `move:${e.goal.kind}` : e.type === 'select-squares' ? `select:${JSON.stringify(e.query ?? e.region ?? 'square')}` : e.type;
  return `${task} | ${types(true)} | ${types(false)}`;
}

describe('b07 check pool (03 §4.1–§4.3)', () => {
  it('16 items: 5 / 5 / 6 per lesson objective, all b07 G0, 8 as Black, neutral (no hints, no highlights)', () => {
    expect(check).toHaveLength(16);
    expect(poolFiles['b07-check']).toMatchObject({ id: 'b07-check', kind: 'check', unit: 'b07', primaryStrand: 'TC' });
    expect(['b07l1', 'b07l2', 'b07l3'].map((l) => check.filter((i) => i.objective === l).length)).toEqual([5, 5, 6]);
    expect(check.every((i) => i.unit === 'b07' && i.assist === 'G0' && i.status === 'verified')).toBe(true);
    expect(check.filter((i) => i.side === 'black')).toHaveLength(8);
    for (const i of check as (AssessmentItem & { hints?: unknown; highlight?: unknown; from?: unknown })[]) {
      expect(i.hints, i.id).toBeUndefined();
      expect(i.highlight, i.id).toBeUndefined();
      expect(i.from, i.id).toBeUndefined();
    }
  });

  it('unseen (03 §4.2 rule 4): no check item is near any lesson item of any unit, nor another b07 check item', () => {
    const others = [
      ...allUnits.flatMap((u) => u.lessons.flatMap((l) => l.exercises.map((e, i) => ({ ref: e.id ?? `${l.id}#${i}`, pos: positionOf(e) })))),
      ...check.map((e) => ({ ref: e.id!, pos: positionOf(e) })),
    ];
    const hits = check.flatMap((c) => others.filter((o) => o.ref !== c.id && nearDuplicate(positionOf(c), o.pos)).map((o) => `${c.id} ~ ${o.ref}`));
    expect(hits).toEqual([]);
  });

  it('no two check items share a task and the same learner-relative material (pattern mirrors)', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const e of check) {
      const sig = signature(e);
      if (seen.has(sig)) clashes.push(`${seen.get(sig)} ~ ${e.id}: ${sig}`);
      else seen.set(sig, e.id!);
    }
    expect(clashes).toEqual([]);
  });

  it('builds three 8-item forms with 2 interleaved b01–b06 items each (≥ 3 Black, every objective, ≤ half exposed)', () => {
    const earlier = ['b01-check', 'b02-check', 'b03-check', 'b04-check', 'b05-check', 'b06-check'].flatMap((p) => poolFiles[p].items as AssessmentItem[]);
    const base = { unit: 'b07', objectives: b07.lessons.map((l) => l.id), primaryStrand: 'TC' as const, poolId: 'b07-check', assessmentVersion: 1, own: check, earlier };
    const exposed = new Set<string>();
    for (const [attempt, maxExposed] of [[1, 0], [2, 0], [3, 4]] as const) {
      const r = assembleCheckForm({ ...base, exposed, seed: attempt });
      expect(r.ok, `attempt ${attempt}`).toBe(true);
      if (!r.ok) continue;
      expect(r.form.items).toHaveLength(8);
      expect(r.form.items.filter((i) => i.unit === 'b07')).toHaveLength(6);
      expect(new Set(r.form.items.filter((i) => i.unit === 'b07').map((i) => i.objective)).size).toBe(3);
      expect(r.form.items.filter((i) => i.side === 'black').length).toBeGreaterThanOrEqual(3);
      expect(r.form.exposedCount).toBeLessThanOrEqual(maxExposed);
      for (const i of r.form.items) exposed.add(i.id!);
    }
  });
});
