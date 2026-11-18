// Content checks of unit b05 "Check, checkmate, stalemate and results" (S3.2.a: lessons b05l1–b05l3, check pool
// b05-check), loaded in release state REL-P (`verified`, so neither served nor in the preview until the independent
// review). The validator and the pool validator run on it with everything else; the `.error` leak check is global
// (pilot-feedback.test.ts). This file pins what the unit must show (02 b05, 03 §4.1–§4.3 and §8, 05 §4).
import { describe, expect, it } from 'vitest';
import { gameStatus, isInCheck, legalMoves, makeMove, pseudoLegalTargets, squareName, type Position } from '../engine';
import { assembleCheckForm } from '../assessment/checks';
import { positionOf } from '../lessons/answers';
import { isAccepted, moveKey } from '../lessons/decision';
import { syncSafety } from '../lessons/decision-table';
import { allUnits } from './index';
import { nearDuplicate } from './near-duplicate';
import { normalKey, swapColours } from './normalize';
import { poolFiles } from './pools';
import { unitItems } from './release';
import type { AssessmentItem, ChoiceExercise, DecisionExercise, Exercise, MoveExercise, Unit } from './types';

const b05 = allUnits.find((u) => u.id === 'b05') as Unit;
const legacyUnits = allUnits.filter((u) => /^u\d+$/.test(u.id));
const items = b05.lessons.flatMap((l) => l.exercises);
const practice = items.filter((e) => e.type !== 'learn');
const check = poolFiles['b05-check'].items as AssessmentItem[];
const all = [...items, ...check];
const byId = (id: string) => all.find((e) => e.id === id) as Exercise;
const legacy = (ref: string): Exercise => {
  const [lesson, index] = ref.split('#');
  return legacyUnits.flatMap((u) => u.lessons).find((l) => l.id === lesson)!.exercises[Number(index)];
};
const keysOf = (pos: Position) => legalMoves(pos).map(moveKey);
const statusAfter = (pos: Position, key: string) => gameStatus(makeMove(pos, legalMoves(pos).find((m) => moveKey(m) === key)!)).kind;
/** A move the piece could make by its movement rule (ignoring check) that is nevertheless illegal. */
const pseudoButIllegal = (pos: Position, key: string) => {
  const [from, to] = key.split('-').map((s) => pos.board.findIndex((_, i) => squareName(i) === s));
  return pseudoLegalTargets(pos.board, from).includes(to) && !keysOf(pos).includes(key);
};

describe('unit b05 (S3.2.a)', () => {
  it('follows 02 b05: three lessons, learn cards first, ladders (b05l1 holds the TR item; b05l2 keeps all six legacy mates)', () => {
    expect(b05.track).toBe('basics');
    expect(b05.lessons.map((l) => l.id)).toEqual(['b05l1', 'b05l2', 'b05l3']);
    const ladder = (lesson: number) => b05.lessons[lesson].exercises.filter((e) => e.type !== 'learn').map((e) => e.assist);
    expect(ladder(0)).toEqual(['G2', 'G2', 'G1', 'G1', 'G0', 'TR']);
    expect(ladder(1)).toEqual(['G2', 'G2', 'G2', 'G1', 'G1', 'G1', 'G0']);
    expect(ladder(2)).toEqual(['G2', 'G2', 'G1', 'G1', 'G0']);
    for (const lesson of b05.lessons) {
      const first = lesson.exercises.findIndex((e) => e.type !== 'learn');
      expect(first, lesson.id).toBeGreaterThan(0);
      expect(lesson.exercises.slice(first).every((e) => e.type !== 'learn'), lesson.id).toBe(true);
    }
    expect(practice.every((e) => (e.strand === 'RS' || e.strand === 'DE') && e.critical === false)).toBe(true);
    expect(unitItems(b05).every(({ item }) => item.status === 'verified')).toBe(true);
  });

  it('both colours: 6 of 18 practice items as Black, including the TR escape', () => {
    const black = practice.filter((e) => e.side === 'black').map((e) => e.id);
    expect(black).toEqual(['b05l1-07', 'b05l1-09', 'b05l2-09', 'b05l3-04', 'b05l3-05', 'b05l3-07']);
    expect(black.length * 3).toBeGreaterThanOrEqual(practice.length);
  });

  it('misconceptions b05.m1–m4 (the 02 list only): each has a tagged learn card and a tagged wrong answer', () => {
    const ids = ['b05.m1', 'b05.m2', 'b05.m3', 'b05.m4'];
    expect([...new Set(items.filter((e) => e.type === 'learn').flatMap((e) => e.misconceptions ?? []))].sort()).toEqual(ids);
    const answers = all.flatMap((e) => (e.type === 'choice' ? e.options.map((o) => o.misconception) : e.type === 'decision' ? e.table.map((r) => r.misconception) : []));
    expect([...new Set(answers.filter(Boolean))].sort()).toEqual(ids);
    expect([...new Set(all.flatMap((e) => e.misconceptions ?? []))].sort()).toEqual(ids);
  });

  it('reuse (05 §4, T2): u4l1#2–#5, u4l2 and the mate items u3l1#5 / u3l2#4 keep their positions; the BLK twin is derived', () => {
    const reused = items.filter((e) => e.source?.kind === 'legacy');
    expect(reused.map((e) => [e.id, e.source!.legacyRef])).toEqual([
      ['b05l1-01', 'u4l1#2'],
      ['b05l1-04', 'u4l1#3'],
      ['b05l1-05', 'u4l1#4'],
      ['b05l1-06', 'u4l1#5'],
      ['b05l2-01', 'u4l2#0'],
      ['b05l2-03', 'u4l2#2'],
      ['b05l2-04', 'u4l2#1'],
      ['b05l2-05', 'u3l2#4'],
      ['b05l2-06', 'u4l2#5'],
      ['b05l2-07', 'u4l2#3'],
      ['b05l2-08', 'u3l1#5'],
      ['b05l3-01', 'u4l2#4'],
    ]);
    for (const e of reused) expect(normalKey(positionOf(e)), e.id).toBe(normalKey(positionOf(legacy(e.source!.legacyRef!))));
    const twin = byId('b05l2-09');
    expect(twin.source).toEqual({ kind: 'derived', derivedFrom: 'u4l2#3', transform: ['colour-swap', 'edit-pieces'] });
    const swapped = swapColours(positionOf(legacy('u4l2#3')));
    expect(swapped.board.filter((p, s) => p?.type !== positionOf(twin).board[s]?.type || p?.color !== positionOf(twin).board[s]?.color)).toHaveLength(2);
    // u4l1#0 / #1 live in b02l2 (05 DV4), not here.
    expect(JSON.stringify(b05)).not.toMatch(/u4l1#[01]"/);
  });

  it('learn cards: escape dots, Horse-leg block, Cannon-check ways, mate, a useless check, stalemate', () => {
    const pos = (id: string) => positionOf(byId(id));
    expect(isInCheck(pos('b05l1-01'))).toBe(true);
    expect(keysOf(pos('b05l1-02'))).toContain('f6-f1'); // the Chariot can block the leg point
    expect(keysOf(pos('b05l1-03')).filter((k) => k.startsWith('e3')).length).toBeGreaterThan(0); // the screen can leave
    expect(keysOf(pos('b05l1-03'))).toEqual(expect.arrayContaining(['f0-e1', 'b2-e2'])); // a second screen
    expect(gameStatus(pos('b05l2-01')).kind).toBe('checkmate');
    expect(gameStatus(pos('b05l2-02')).kind).toBe('check');
    expect(keysOf(pos('b05l2-02'))).toEqual(['e9-f9']); // the General simply steps aside
    expect(gameStatus(pos('b05l3-01')).kind).toBe('stalemate');
  });

  it('checkmate items: the solution mates, and no move stalemates instead (a stalemate win would be rejected)', () => {
    const mates = all.filter((e): e is MoveExercise => e.type === 'move' && e.goal.kind === 'checkmate');
    expect(mates.map((e) => e.id)).toEqual(['b05l2-03', 'b05l2-04', 'b05l2-05', 'b05l2-06', 'b05l2-07', 'b05l2-08', 'b05l2-09', 'b05l3-07', 'b05-c06', 'b05-c07', 'b05-c08']);
    for (const e of mates) {
      const pos = positionOf(e);
      expect(statusAfter(pos, `${e.solution.from}-${e.solution.to}`), e.id).toBe('checkmate');
      expect(keysOf(pos).filter((k) => statusAfter(pos, k) === 'stalemate'), e.id).toEqual([]);
      if (e.feedback) expect(statusAfter(pos, e.feedback.temptingAlternative.move), e.id).not.toBe('checkmate');
    }
  });

  it('win-in-one tables accept exactly the mating and stalemating moves; the stalemate items have no mate', () => {
    const wins = all.filter((e): e is DecisionExercise => e.type === 'decision');
    expect(wins.map((e) => e.id)).toEqual(['b05l3-05', 'b05l3-08', 'b05-c10', 'b05-c11', 'b05-c12']);
    for (const d of wins) {
      const pos = positionOf(d);
      for (const k of keysOf(pos)) {
        const row = d.table.find((r) => r.move === k)!;
        const s = statusAfter(pos, k);
        expect(isAccepted(row.class), `${d.id} ${k}`).toBe(s === 'checkmate' || s === 'stalemate');
        if (row.class !== 'error') expect(row.source, `${d.id} ${k}`).toBe('authored');
      }
      expect(d.table.find((r) => r.move === d.feedback!.temptingAlternative.move)!.misconception, d.id).toBe('b05.m4');
    }
    for (const id of ['b05l3-05', 'b05l3-08', 'b05-c11', 'b05-c12']) {
      const pos = positionOf(byId(id));
      expect(keysOf(pos).map((k) => statusAfter(pos, k)), id).not.toContain('checkmate');
    }
  });

  it('escape items: the position is check; the safe solution passes the Basic guard and the tempting escape fails it', () => {
    const safe = syncSafety();
    for (const id of ['b05l1-08', 'b05l1-09', 'b05-c01', 'b05-c02']) {
      const e = byId(id) as MoveExercise;
      const pos = positionOf(e);
      expect(isInCheck(pos), id).toBe(true);
      const verdict = (k: string) => safe(pos, legalMoves(pos).find((m) => moveKey(m) === k)!, { itemId: id });
      expect(verdict(`${e.solution.from}-${e.solution.to}`), id).toMatchObject({ status: 'checked', safe: true });
      expect(verdict(e.feedback!.temptingAlternative.move), id).toMatchObject({ status: 'checked', safe: false });
    }
    // b05l1-08 and b05-c02 are Horse checks answered by blocking the leg point.
    for (const [id, leg] of [['b05l1-08', 'f1'], ['b05-c02', 'd8']] as const) expect((byId(id) as MoveExercise).solution.to, id).toBe(leg);
  });

  it('choice keys are what the engine says (legal escapes, illegal captures in check, only a leg block left)', () => {
    const p = (id: string) => positionOf(byId(id));
    // b05l1-07: the General steps aside and the Horse blocks; taking Red's Chariot ignores the check.
    expect(keysOf(p('b05l1-07'))).toEqual(expect.arrayContaining(['e9-f9', 'g7-e8']));
    expect(pseudoButIllegal(p('b05l1-07'), 'a9-a2')).toBe(true);
    // b05-c04: block with the Horse, step off the edge; taking Red's Horse is illegal.
    expect(keysOf(p('b05-c04'))).toEqual(expect.arrayContaining(['c7-b9', 'e9-e8']));
    expect(pseudoButIllegal(p('b05-c04'), 'h4-h0')).toBe(true);
    // b05-c05: the Chariot capture is illegal while in check.
    expect(pseudoButIllegal(p('b05-c05'), 'h4-h9')).toBe(true);
    // "Check, not mate": the only way out is a block on the Horse's leg point.
    expect(keysOf(p('b05l3-04'))).toEqual(['f4-f8']);
    expect(keysOf(p('b05-c09'))).toEqual(['c3-c7']);
    for (const id of ['b05l3-04', 'b05-c09', 'b05-c15']) expect(gameStatus(p(id)).kind, id).toBe('check');
    for (const id of ['b05l3-04', 'b05-c09', 'b05-c15']) expect((byId(id) as ChoiceExercise).options.filter((o) => o.correct).map((o) => o.id), id).toEqual(['a']);
  });
});

/** Learner-relative signature of a check item: kind of task + material (own / opponent piece types). */
function signature(e: AssessmentItem): string {
  const pos = positionOf(e);
  const own = pos.turn;
  const types = (mine: boolean) => pos.board.filter((p) => p && (p.color === own) === mine).map((p) => p!.type).sort().join(',');
  const task = e.type === 'move' ? `move:${e.goal.kind}` : e.type === 'select-squares' ? `select:${JSON.stringify(e.query ?? e.region ?? 'square')}` : e.type;
  return `${task} | ${types(true)} | ${types(false)}`;
}

describe('b05 check pool (03 §4.1–§4.3)', () => {
  it('16 items: 5 / 5 / 6 per lesson objective, all b05 G0, 7 as Black, neutral (no hints, no highlights)', () => {
    expect(check).toHaveLength(16);
    expect(poolFiles['b05-check']).toMatchObject({ id: 'b05-check', kind: 'check', unit: 'b05', primaryStrand: 'RS' });
    expect(['b05l1', 'b05l2', 'b05l3'].map((l) => check.filter((i) => i.objective === l).length)).toEqual([5, 5, 6]);
    expect(check.every((i) => i.unit === 'b05' && i.assist === 'G0' && i.status === 'verified')).toBe(true);
    expect(check.filter((i) => i.side === 'black')).toHaveLength(7);
    for (const i of check as (AssessmentItem & { hints?: unknown; highlight?: unknown; from?: unknown })[]) {
      expect(i.hints, i.id).toBeUndefined();
      expect(i.highlight, i.id).toBeUndefined();
      expect(i.from, i.id).toBeUndefined();
    }
  });

  it('unseen (03 §4.2 rule 4): no check item is near any lesson item of any unit, nor another b05 check item', () => {
    const others = [
      ...allUnits.flatMap((u) => u.lessons.flatMap((l) => l.exercises.map((e, i) => ({ ref: e.id ?? `${l.id}#${i}`, pos: positionOf(e) })))),
      ...check.map((e) => ({ ref: e.id!, pos: positionOf(e) })),
    ];
    const hits = check.flatMap((c) => others.filter((o) => o.ref !== c.id && nearDuplicate(positionOf(c), o.pos)).map((o) => `${c.id} ~ ${o.ref}`));
    expect(hits).toEqual([]);
  });

  // The b04 review found two check items that were colour-swapped mirrors of each other in pattern although the
  // near-duplicate test passed: no two b05 check items share the same task and the same learner-relative material.
  it('no two check items share a task and the same learner-relative material (pattern mirrors)', () => {
    const sigs = check.map((e) => [e.id, signature(e)] as const);
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const [id, sig] of sigs) {
      if (seen.has(sig)) clashes.push(`${seen.get(sig)} ~ ${id}: ${sig}`);
      else seen.set(sig, id!);
    }
    expect(clashes).toEqual([]);
  });

  it('builds three 8-item forms with 2 interleaved b01–b04 items each (≥ 3 Black, every objective, ≤ half exposed)', () => {
    const earlier = ['b01-check', 'b02-check', 'b03-check', 'b04-check'].flatMap((p) => poolFiles[p].items as AssessmentItem[]);
    const base = { unit: 'b05', objectives: b05.lessons.map((l) => l.id), primaryStrand: 'RS' as const, poolId: 'b05-check', assessmentVersion: 1, own: check, earlier };
    const exposed = new Set<string>();
    for (const [attempt, maxExposed] of [[1, 0], [2, 0], [3, 4]] as const) {
      const r = assembleCheckForm({ ...base, exposed, seed: attempt });
      expect(r.ok, `attempt ${attempt}`).toBe(true);
      if (!r.ok) continue;
      expect(r.form.items).toHaveLength(8);
      expect(r.form.items.filter((i) => i.unit === 'b05')).toHaveLength(6);
      expect(new Set(r.form.items.filter((i) => i.unit === 'b05').map((i) => i.objective)).size).toBe(3);
      expect(r.form.items.filter((i) => i.side === 'black').length).toBeGreaterThanOrEqual(3);
      expect(r.form.exposedCount).toBeLessThanOrEqual(maxExposed);
      for (const i of r.form.items) exposed.add(i.id!);
    }
  });
});
