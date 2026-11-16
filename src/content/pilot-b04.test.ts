// Content checks of unit b04 "Cannon and Soldier" (S3.1.d: lessons b04l1–b04l3, check pool b04-check), loaded in release
// state REL-P (`reviewed` with an approving record: in the preview, not served by default). The validator and the
// pool validator run on it with everything else (validate-shard-*.test.ts, pools.test.ts); the `.error` leak check is
// global (pilot-feedback.test.ts). This file pins what the unit must show (02 b04, 03 §4.1–§4.3, 05 §4).
import { describe, expect, it } from 'vitest';
import { isInCheck, legalMoves, parseSquare, pseudoLegalTargets, squareName, type Position } from '../engine';
import { assembleCheckForm } from '../assessment/checks';
import { captureFacts, captureGain, expectedSelection, positionOf } from '../lessons/answers';
import { moveKey } from '../lessons/decision';
import { allUnits } from './index';
import { nearDuplicate } from './near-duplicate';
import { normalKey, swapColours } from './normalize';
import { poolFiles } from './pools';
import { unitItems } from './release';
import type { AssessmentItem, CaptureExercise, ChoiceExercise, Exercise, LearnExercise, SelectSquaresExercise, Unit } from './types';

const b04 = allUnits.find((u) => u.id === 'b04') as Unit;
const legacyUnits = allUnits.filter((u) => /^u\d+$/.test(u.id));
const items = b04.lessons.flatMap((l) => l.exercises);
const practice = items.filter((e) => e.type !== 'learn');
const check = poolFiles['b04-check'].items as AssessmentItem[];
const byId = (id: string) => [...items, ...check].find((e) => e.id === id) as Exercise;

const legacy = (ref: string): Exercise => {
  const [lesson, index] = ref.split('#');
  return legacyUnits.flatMap((u) => u.lessons).find((l) => l.id === lesson)!.exercises[Number(index)];
};
const movesFrom = (pos: Position, sq: string) => legalMoves(pos).filter((m) => squareName(m.from) === sq).map((m) => squareName(m.to)).sort();
const names = (squares: number[]) => squares.map(squareName).sort();
const at = (pos: Position, sq: string) => pos.board[parseSquare(sq)];
const differing = (a: Position, b: Position) => a.board.flatMap((p, s) => (p?.type !== b.board[s]?.type || p?.color !== b.board[s]?.color ? [squareName(s)] : []));

describe('unit b04 (S3.1.d)', () => {
  it('follows 02 b04: three lessons, learn cards first, 5 practice items (b04l3: 6, it holds the TR item), ladder G2 → G1 → G0 (→ TR)', () => {
    expect(b04.track).toBe('basics');
    expect(b04.lessons.map((l) => l.id)).toEqual(['b04l1', 'b04l2', 'b04l3']);
    const ladder = (lesson: number) => b04.lessons[lesson].exercises.filter((e) => e.type !== 'learn').map((e) => e.assist);
    expect(ladder(0)).toEqual(['G2', 'G2', 'G1', 'G1', 'G0']);
    expect(ladder(1)).toEqual(['G2', 'G2', 'G1', 'G1', 'G0']);
    expect(ladder(2)).toEqual(['G2', 'G2', 'G1', 'G1', 'G0', 'TR']);
    for (const lesson of b04.lessons) {
      const first = lesson.exercises.findIndex((e) => e.type !== 'learn');
      expect(first, lesson.id).toBeGreaterThan(0);
      expect(lesson.exercises.slice(first).every((e) => e.type !== 'learn'), lesson.id).toBe(true);
    }
    expect(practice.every((e) => e.strand === 'RS' && e.critical === false)).toBe(true);
    expect(unitItems(b04).every(({ item }) => item.status === 'reviewed')).toBe(true);
  });

  it('both colours: 7 of 16 practice items as Black, including the full-board TR item', () => {
    const black = practice.filter((e) => e.side === 'black').map((e) => e.id);
    expect(black).toEqual(['b04l1-05', 'b04l1-07', 'b04l2-05', 'b04l2-07', 'b04l3-03', 'b04l3-05', 'b04l3-07']);
    expect(black.length * 3).toBeGreaterThanOrEqual(practice.length);
  });

  it('misconceptions b04.m1–m4 (the 02 list only): each has a tagged learn card and a tagged wrong answer', () => {
    const ids = ['b04.m1', 'b04.m2', 'b04.m3', 'b04.m4'];
    expect([...new Set(items.filter((e) => e.type === 'learn').flatMap((e) => e.misconceptions ?? []))].sort()).toEqual(ids);
    const answers = [...items, ...check].flatMap((e) => (e.type === 'choice' ? e.options.map((o) => o.misconception) : []));
    expect([...new Set(answers.filter(Boolean))].sort()).toEqual(ids);
    expect([...new Set([...items, ...check].flatMap((e) => e.misconceptions ?? []))].sort()).toEqual(ids);
  });

  it('reuse (05 §4, T2): u3l1 / u3l2 positions kept, POS fixes and BLK twins derived; the mate items (u3l1#5, u3l2#4) go to b05', () => {
    const reused = items.filter((e) => e.source?.kind === 'legacy');
    expect(reused.map((e) => [e.id, e.source!.legacyRef])).toEqual([
      ['b04l1-01', 'u3l1#0'],
      ['b04l1-02', 'u3l1#1'],
      ['b04l1-04', 'u3l1#3'],
      ['b04l1-06', 'u3l1#4'],
      ['b04l2-01', 'u3l2#0'],
      ['b04l2-02', 'u3l2#1'],
      ['b04l2-04', 'u3l2#2'],
    ]);
    for (const e of reused) expect(normalKey(positionOf(e)), e.id).toBe(normalKey(positionOf(legacy(e.source!.legacyRef!))));
    const json = JSON.stringify(b04);
    expect(json).not.toContain('u3l1#5');
    expect(json).not.toContain('u3l2#4');
    // POS (05 §4): the unreachable Black Soldier (b6, d6) becomes a Black Horse; nothing else moves.
    for (const [id, ref, square] of [['b04l1-03', 'u3l1#2', 'b6'], ['b04l2-06', 'u3l2#3', 'd6']] as const) {
      const e = byId(id);
      expect(e.source, id).toEqual({ kind: 'derived', derivedFrom: ref, transform: ['edit-pieces'] });
      expect(differing(positionOf(e), positionOf(legacy(ref))), id).toEqual([square]);
      expect(at(positionOf(e), square), id).toMatchObject({ type: 'horse', color: 'black' });
    }
    // BLK twins: colour swap with Black's General moved one point.
    for (const [id, ref] of [['b04l1-05', 'u3l1#3'], ['b04l2-05', 'u3l2#2']] as const) {
      const e = byId(id);
      expect(e.source, id).toEqual({ kind: 'derived', derivedFrom: ref, transform: ['colour-swap', 'edit-pieces'] });
      expect(differing(swapColours(positionOf(legacy(ref))), positionOf(e)), id).toHaveLength(2);
    }
    // Successors (05 §3): b04l1 ← u3l1 and b04l2 ← u3l2 hold the old lessons' practice items.
    const core = (lesson: number, prefix: string) => b04.lessons[lesson].exercises.filter((e) => e.type !== 'learn' && (e.source?.legacyRef ?? e.source?.derivedFrom)?.startsWith(prefix)).length;
    expect([core(0, 'u3l1#'), core(1, 'u3l2#')]).toEqual([3, 3]);
  });

  it('learn cards show what their texts say: no capture without a screen, no jump to an empty point, Soldier steps, no promotion', () => {
    const dots = (id: string) => {
      const e = byId(id) as LearnExercise;
      return movesFrom(positionOf(e), e.square!);
    };
    expect(dots('b04l1-02')).not.toContain('b5'); // the Chariot right in its line: no screen
    expect(dots('b04l1-03')).toContain('b9'); // over the screen on b6
    expect(dots('b04l1-03').filter((s) => ['b6', 'b7', 'b8'].includes(s))).toEqual([]); // never beyond the screen to an empty point
    expect(dots('b04l2-01')).toEqual(['e4']);
    expect(dots('b04l2-02')).toEqual(['d5', 'e6', 'f5']);
    expect(dots('b04l2-03')).toEqual(['a9', 'c9']);
    expect(dots('b04l3-01')).toContain('e6');
  });

  it('choice keys are what the engine says (screens, empty points, Soldier steps)', () => {
    const l108 = positionOf(byId('b04l1-08'));
    expect(movesFrom(l108, 'e2').filter((s) => l108.board[parseSquare(s)])).toEqual(['e5']); // the only capture
    expect(movesFrom(l108, 'e2')).not.toContain('e4'); // no jump to the empty point behind the Soldier
    const c05 = positionOf(byId('b04-c05'));
    expect(movesFrom(c05, 'h2').filter((s) => s[0] === 'h')).toEqual(['h0', 'h1', 'h6']);
    const l207 = positionOf(byId('b04l2-07'));
    expect([movesFrom(l207, 'c6'), movesFrom(l207, 'g4'), movesFrom(l207, 'a0')]).toEqual([['c5'], ['f4', 'g3', 'h4'], ['b0']]);
    expect(movesFrom(positionOf(byId('b04-c09')), 'c0')).toEqual(['b0', 'd0']);
    for (const id of ['b04l2-07', 'b04-c05', 'b04-c09']) {
      const c = byId(id) as ChoiceExercise;
      expect(c.options.filter((o) => o.correct).map((o) => o.id), id).toEqual(['a', 'b']);
    }
  });

  it('no item depends on check or pins (b05): nobody is in check, and every legal attacker set equals the plain movement rule', () => {
    for (const e of [...items, ...check].filter((x) => x.type !== 'learn')) {
      const pos = positionOf(e);
      expect(isInCheck(pos), e.id).toBe(false);
      if (e.type !== 'select-squares' || !e.query) continue;
      for (let sq = 0; sq < 90; sq++) {
        const p = pos.board[sq];
        if (!p || p.type === 'general') continue;
        const pseudo = pos.board.flatMap((q, f) => (q && q.color !== p.color && pseudoLegalTargets(pos.board, f).includes(sq) ? [f] : []));
        expect(captureFacts(pos.board, sq).attackers.sort(), `${e.id} ${squareName(sq)}`).toEqual(pseudo.sort());
      }
    }
  });

  it('full-board answers mix piece types; the TR position holds all seven Black piece types', () => {
    const expected: Record<string, string[]> = {
      'b04l3-02': ['b0', 'b4', 'd4', 'e1'],
      'b04l3-04': ['b7', 'e6'],
      'b04l3-05': ['c4', 'h0'],
      'b04l3-07': ['b6', 'c7', 'g7'],
      'b04-c11': ['c4', 'e6'],
      'b04-c12': ['e3', 'g4'],
      'b04-c13': ['b5', 'e7', 'g6'],
      'b04-c14': ['e2', 'f4'],
      'b04-c16': ['a2'],
    };
    for (const [id, want] of Object.entries(expected)) expect(names(expectedSelection(byId(id) as SelectSquaresExercise)), id).toEqual(want);
    const tr = positionOf(byId('b04l3-07'));
    expect(new Set(tr.board.filter((p) => p?.color === 'black').map((p) => p!.type)).size).toBe(7);
    expect(new Set(expectedSelection(byId('b04l3-07') as SelectSquaresExercise).map((s) => tr.board[s]!.type))).toEqual(new Set(['horse', 'cannon']));
    // The two can-capture check items have different attacker sets (c13: Soldier, Elephant, Cannon on a rank; c14: Horse,
    // Cannon on a file).
    const types = (id: string) => {
      const pos = positionOf(byId(id));
      return new Set(expectedSelection(byId(id) as SelectSquaresExercise).map((s) => pos.board[s]!.type));
    };
    expect(types('b04-c13')).toEqual(new Set(['cannon', 'soldier', 'elephant']));
    expect(types('b04-c14')).toEqual(new Set(['cannon', 'horse']));
  });

  it('captures: the solution is the single best capture; the tempting move is a worse capture or a non-capture', () => {
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

describe('b04 check pool (03 §4.1–§4.3)', () => {
  it('16 items: 5 / 5 / 6 per lesson objective, all b04 G0, 7 as Black, neutral (no hints, no highlights)', () => {
    expect(check).toHaveLength(16);
    expect(poolFiles['b04-check']).toMatchObject({ id: 'b04-check', kind: 'check', unit: 'b04', primaryStrand: 'RS' });
    expect(['b04l1', 'b04l2', 'b04l3'].map((l) => check.filter((i) => i.objective === l).length)).toEqual([5, 5, 6]);
    expect(check.every((i) => i.unit === 'b04' && i.assist === 'G0' && i.status === 'reviewed')).toBe(true);
    expect(check.filter((i) => i.side === 'black')).toHaveLength(7);
    for (const i of check as (AssessmentItem & { hints?: unknown; highlight?: unknown })[]) {
      expect(i.hints, i.id).toBeUndefined();
      expect(i.highlight, i.id).toBeUndefined();
    }
  });

  it('unseen (03 §4.2 rule 4): no check item is near any lesson item of any unit, nor another b04 check item', () => {
    const others = [
      ...allUnits.flatMap((u) => u.lessons.flatMap((l) => l.exercises.map((e, i) => ({ ref: e.id ?? `${l.id}#${i}`, pos: positionOf(e) })))),
      ...check.map((e) => ({ ref: e.id!, pos: positionOf(e) })),
    ];
    const hits = check.flatMap((c) => others.filter((o) => o.ref !== c.id && nearDuplicate(positionOf(c), o.pos)).map((o) => `${c.id} ~ ${o.ref}`));
    expect(hits).toEqual([]);
  });

  it('builds three 8-item forms with 2 interleaved b01–b03 items each (≥ 3 Black, every objective, ≤ half exposed)', () => {
    const earlier = ['b01-check', 'b02-check', 'b03-check'].flatMap((p) => poolFiles[p].items as AssessmentItem[]);
    const base = { unit: 'b04', objectives: b04.lessons.map((l) => l.id), primaryStrand: 'RS' as const, poolId: 'b04-check', assessmentVersion: 1, own: check, earlier };
    const exposed = new Set<string>();
    for (const [attempt, maxExposed] of [[1, 0], [2, 0], [3, 4]] as const) {
      const r = assembleCheckForm({ ...base, exposed, seed: attempt });
      expect(r.ok, `attempt ${attempt}`).toBe(true);
      if (!r.ok) continue;
      expect(r.form.items).toHaveLength(8);
      expect(r.form.items.filter((i) => i.unit === 'b04')).toHaveLength(6);
      expect(new Set(r.form.items.filter((i) => i.unit === 'b04').map((i) => i.objective)).size).toBe(3);
      expect(r.form.items.filter((i) => i.side === 'black').length).toBeGreaterThanOrEqual(3);
      expect(r.form.exposedCount).toBeLessThanOrEqual(maxExposed);
      for (const i of r.form.items) exposed.add(i.id!);
    }
  });
});
