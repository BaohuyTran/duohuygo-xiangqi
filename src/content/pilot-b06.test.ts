// Content checks of unit b06 "Threatened, undefended and defended pieces" (S3.2.b: lessons b06l1–b06l3, check pool
// b06-check), loaded in release state REL-P (`verified` until the content review: not in the preview, not served by
// default). The validator and the pool validator run on it with everything else; the `.error` leak check is global
// (pilot-feedback.test.ts). This file pins what the unit must show (02 b06, 03 §4.1–§4.3 and §8, 05 §4 / DV2).
import { describe, expect, it } from 'vitest';
import { legalMoves, makeMove, materialBalance, parseFen, pseudoLegalTargets, squareName, START_FEN, toFen, type Position } from '../engine';
import { search } from '../analysis';
import { assembleCheckForm } from '../assessment/checks';
import { captureGain, positionOf, querySquares } from '../lessons/answers';
import { moveKey } from '../lessons/decision';
import { syncSafety } from '../lessons/decision-table';
import { allUnits } from './index';
import { nearDuplicate } from './near-duplicate';
import { normalKey } from './normalize';
import { poolFiles } from './pools';
import { unitItems } from './release';
import type { AssessmentItem, CaptureExercise, ChoiceExercise, Exercise, MoveExercise, SquareQuery, Unit } from './types';

const b06 = allUnits.find((u) => u.id === 'b06') as Unit;
const legacyUnits = allUnits.filter((u) => /^u\d+$/.test(u.id));
const items = b06.lessons.flatMap((l) => l.exercises);
const practice = items.filter((e) => e.type !== 'learn');
const check = poolFiles['b06-check'].items as AssessmentItem[];
const all = [...items, ...check];
const byId = (id: string) => all.find((e) => e.id === id) as Exercise;
const pos = (id: string) => positionOf(byId(id));
const legacy = (ref: string): Exercise => {
  const [lesson, index] = ref.split('#');
  return legacyUnits.flatMap((u) => u.lessons).find((l) => l.id === lesson)!.exercises[Number(index)];
};
const sqIndex = (name: string) => [...Array(90).keys()].find((i) => squareName(i) === name)!;
const keysOf = (p: Position) => legalMoves(p).map(moveKey);
const moveOf = (p: Position, key: string) => {
  const m = legalMoves(p).find((x) => moveKey(x) === key);
  if (!m) throw new Error(`illegal ${key}`);
  return m;
};
const after = (p: Position, key: string) => makeMove(p, moveOf(p, key));
const query = (id: string, q: SquareQuery) => querySquares(pos(id), q).map(squareName).sort();
/** The piece could make the move by its movement rule (legs and screens respected) but the move is illegal (a pin). */
const pinned = (p: Position, key: string) => {
  const [from, to] = key.split('-').map(sqIndex);
  return pseudoLegalTargets(p.board, from).includes(to) && !keysOf(p).includes(key);
};
const safe = syncSafety();
const goalGuard = (id: string) => {
  const e = byId(id);
  return e.type === 'move' && e.goal.kind === 'safe' ? e.goal.guard : undefined;
};
/** The item's own guard verdict (level guard from the id, with the item's `goal.guard` override). */
const verdict = (id: string, p: Position, key: string) => safe(p, moveOf(p, key), { itemId: id, override: goalGuard(id) });
/** Material after `key` against the opponent's best line of 4 plies, relative to now (≥ 0: nothing lost). */
const depth4 = (p: Position, key: string) => {
  const r = search(after(p, key), { depth: 4, maxNodes: 3e6 });
  expect(r.complete, key).toBe(true);
  return -r.score - materialBalance(p.board, p.turn);
};
/** After `key`, the opponent's best 3-ply line wins no material (the "without losing anything" claim). */
const keepsEverything = (p: Position, key: string) => {
  const r = search(after(p, key), { depth: 3, maxNodes: 1e6 });
  return r.complete && -r.score >= materialBalance(p.board, p.turn);
};

describe('unit b06 (S3.2.b)', () => {
  it('follows 02 b06: three lessons, learn cards first, ladders G2 G2 G1 G1 G0 (b06l3 adds the TR item)', () => {
    expect(b06.track).toBe('basics');
    expect(b06.lessons.map((l) => l.id)).toEqual(['b06l1', 'b06l2', 'b06l3']);
    const ladder = (lesson: number) => b06.lessons[lesson].exercises.filter((e) => e.type !== 'learn').map((e) => e.assist);
    expect(ladder(0)).toEqual(['G2', 'G2', 'G1', 'G1', 'G0']);
    expect(ladder(1)).toEqual(['G2', 'G2', 'G1', 'G1', 'G0']);
    expect(ladder(2)).toEqual(['G2', 'G2', 'G1', 'G1', 'G0', 'TR']);
    for (const lesson of b06.lessons) {
      const first = lesson.exercises.findIndex((e) => e.type !== 'learn');
      expect(first, lesson.id).toBeGreaterThan(0);
      expect(lesson.exercises.slice(first).every((e) => e.type !== 'learn'), lesson.id).toBe(true);
    }
    expect(practice.every((e) => e.strand === 'RS' && e.critical === false)).toBe(true);
    expect(unitItems(b06).every(({ item }) => item.status === 'verified')).toBe(true);
    // Guided: attacked-pieces queries; independent: hanging queries, `choice` with a "none" option, `move` goal `safe`.
    expect(b06.lessons[0].exercises.filter((e) => e.type === 'select-squares').every((e) => e.type === 'select-squares' && e.query?.kind === 'attacked-pieces')).toBe(true);
    expect(b06.lessons[1].exercises.filter((e) => e.type === 'select-squares').every((e) => e.type === 'select-squares' && e.query?.kind === 'hanging')).toBe(true);
    expect(b06.lessons[2].exercises.filter((e) => e.type === 'move').every((e) => e.type === 'move' && e.goal.kind === 'safe')).toBe(true);
  });

  it('both colours: 8 of 16 practice items as Black, including the TR item', () => {
    const black = practice.filter((e) => e.side === 'black').map((e) => e.id);
    expect(black).toEqual(['b06l1-05', 'b06l1-07', 'b06l1-08', 'b06l2-05', 'b06l2-07', 'b06l3-04', 'b06l3-06', 'b06l3-08']);
  });

  it('misconceptions b06.m1–m4 (the 02 list): each has a tagged learn card and a tagged wrong answer', () => {
    const ids = ['b06.m1', 'b06.m2', 'b06.m3', 'b06.m4'];
    expect([...new Set(items.filter((e) => e.type === 'learn').flatMap((e) => e.misconceptions ?? []))].sort()).toEqual(ids);
    const answers = all.flatMap((e) => (e.type === 'choice' ? e.options.filter((o) => !o.correct).map((o) => o.misconception) : []));
    expect([...new Set(answers.filter(Boolean))].sort()).toEqual(ids);
    expect([...new Set(all.flatMap((e) => e.misconceptions ?? []))].sort()).toEqual(ids);
  });

  it('reuse (05 DV2, T2): only the capture u2l1#3, as the b06l2 contrast, with its position unchanged', () => {
    const reused = all.filter((e) => e.source?.kind === 'legacy' || e.source?.kind === 'derived');
    expect(reused.map((e) => [e.id, e.source!.legacyRef])).toEqual([['b06l2-06', 'u2l1#3']]);
    expect(normalKey(pos('b06l2-06'))).toBe(normalKey(positionOf(legacy('u2l1#3'))));
    const e = byId('b06l2-06') as CaptureExercise;
    const p = pos('b06l2-06');
    // The defended Horse loses the Chariot; the undefended Cannon is won.
    expect(captureGain(p, moveOf(p, `${e.solution.from}-${e.solution.to}`))).toBe(4.5);
    expect(captureGain(p, moveOf(p, e.feedback!.temptingAlternative.move))).toBeLessThan(0);
  });

  it('attacked / hanging answers are the legal facts: Cannon screens count, hobbled Horses and pinned pieces do not', () => {
    expect(query('b06l1-04', { kind: 'attacked-pieces', side: 'red' })).toEqual(['b2', 'e6']);
    expect(query('b06l1-05', { kind: 'attacked-pieces', side: 'black' })).toEqual(['d7', 'h8']);
    expect(query('b06l1-06', { kind: 'attacked-pieces', side: 'red' })).toEqual(['a6', 'f3']);
    expect(query('b06l1-08', { kind: 'attacked-pieces', side: 'black' })).toEqual(['b8', 'i6']);
    expect(query('b06l2-04', { kind: 'hanging', side: 'black' })).toEqual(['c6']);
    expect(query('b06l2-05', { kind: 'hanging', side: 'red' })).toEqual(['b2']);
    expect(query('b06-c01', { kind: 'attacked-pieces', side: 'red' })).toEqual(['e4', 'h1']);
    expect(query('b06-c02', { kind: 'attacked-pieces', side: 'black' })).toEqual(['a7', 'i8']);
    expect(query('b06-c03', { kind: 'can-capture', target: 'f5' })).toEqual(['f8', 'g7']);
    expect(query('b06-c05', { kind: 'can-capture', target: 'e5' })).toEqual(['a5', 'e1']);
    expect(query('b06-c06', { kind: 'hanging', side: 'black' })).toEqual(['c7']);
    expect(query('b06-c07', { kind: 'hanging', side: 'red' })).toEqual(['b2']);
    // Hobbled Horses (b06.m3): the leg point is occupied and the target is not among the Horse's moves.
    for (const [id, horse, leg, target] of [
      ['b06l1-03', 'g7', 'g6', 'f5'], ['b06l1-06', 'c7', 'c6', 'b5'], ['b06l1-07', 'g3', 'g4', 'h5'], ['b06l1-08', 'f5', 'f6', 'e7'],
      ['b06-c01', 'c6', 'c5', 'd4'], ['b06-c03', 'd6', 'e6', 'f5'], ['b06-c04', 'd4', 'd5', 'c6'], ['b06-c05', 'g4', 'f4', 'e5'],
      ['b06-c07', 'd3', 'c3', 'b2'], ['b06-c10', 'b4', 'b5', 'c6'],
    ] as const) {
      const p = pos(id);
      expect(p.board[sqIndex(horse)]?.type, id).toBe('horse');
      expect(p.board[sqIndex(leg)], id).not.toBeNull();
      expect(pseudoLegalTargets(p.board, sqIndex(horse)).map(squareName), id).not.toContain(target);
    }
    // Pinned pieces (b06.m4): the capture or recapture exists by the movement rule but is illegal.
    expect(pinned(pos('b06l2-08'), 'e2-c3')).toBe(true);
    expect(pinned(pos('b06-c02'), 'e2-f4')).toBe(true);
    expect(pinned(pos('b06-c04'), 'e2-g3')).toBe(true);
    expect(pinned(pos('b06-c05'), 'd3-e5')).toBe(true);
    expect(pinned(after(pos('b06l2-03'), 'f2-f7'), 'e8-f7')).toBe(true);
    expect(pinned(after(pos('b06-c06'), 'c2-c7'), 'e8-c7')).toBe(true);
    expect(pinned(after(pos('b06-c09'), 'd8-d2'), 'e1-d2')).toBe(true);
  });

  it('choice keys are what the engine says (counts, "none" options, captures through a defender)', () => {
    const correct = (id: string) => (byId(id) as ChoiceExercise).options.filter((o) => o.correct).map((o) => o.id);
    // b06l1-07: two attacked pieces (one through a Cannon screen); a hobbled Horse does not make it three.
    expect(query('b06l1-07', { kind: 'attacked-pieces', side: 'black' })).toHaveLength(2);
    expect(correct('b06l1-07')).toEqual(['a']);
    // b06-c04: only the Chariot behind the screen is attacked.
    expect(query('b06-c04', { kind: 'attacked-pieces', side: 'black' })).toEqual(['h8']);
    expect(pos('b06-c04').board[sqIndex('h8')]?.type).toBe('chariot');
    // "None" is right in b06l2-08 and b06-c10, wrong in b06-c09 (the only defender is pinned).
    expect(query('b06l2-08', { kind: 'hanging', side: 'black' })).toEqual([]);
    expect(query('b06-c10', { kind: 'hanging', side: 'black' })).toEqual([]);
    expect(correct('b06l2-08')).toEqual(['a']);
    expect(correct('b06-c10')).toEqual(['a']);
    expect(query('b06-c09', { kind: 'hanging', side: 'red' })).toEqual(['d2']);
    expect(correct('b06-c09')).toEqual(['a']);
    const gain = (id: string, key: string) => captureGain(pos(id), moveOf(pos(id), key));
    expect(gain('b06-c09', 'd8-d2')).toBe(4);
    expect(gain('b06-c09', 'e5-c5')).toBeLessThan(0);
    // b06l2-07 (b06.m1): the defended Chariot is still won by the cheaper Horse; the Soldier is defended over a screen.
    expect(gain('b06l2-07', 'b3-d2')).toBe(5);
    expect(gain('b06l2-07', 'b3-c5')).toBeLessThan(0);
    expect(correct('b06l2-07')).toEqual(['a']);
  });

  it('capture b06-c08 (b06.m1): the cheaper Horse wins the defended Chariot; the tempting capture loses the Chariot', () => {
    const e = byId('b06-c08') as CaptureExercise;
    const p = positionOf(e);
    expect(captureGain(p, moveOf(p, `${e.solution.from}-${e.solution.to}`))).toBe(5);
    expect(captureGain(p, moveOf(p, e.feedback!.temptingAlternative.move))).toBeLessThan(0);
  });

  it('saving moves: the solution passes the Basic guard and keeps everything for 3 plies; the tempting move fails', () => {
    const saves = all.filter((e): e is MoveExercise => e.type === 'move');
    expect(saves.map((e) => e.id)).toEqual(['b06l3-03', 'b06l3-04', 'b06l3-05', 'b06l3-07', 'b06l3-08', 'b06-c11', 'b06-c12', 'b06-c13', 'b06-c14', 'b06-c16']);
    for (const e of saves) {
      const p = positionOf(e);
      const key = `${e.solution.from}-${e.solution.to}`;
      expect(e.goal.kind, e.id).toBe('safe');
      expect(verdict(e.id!, p, key), e.id).toMatchObject({ status: 'checked', safe: true });
      // "Without losing anything" is true: after the solution the opponent's best 3-ply line wins no material.
      expect(keepsEverything(p, key), e.id).toBe(true);
      if (e.feedback) expect(verdict(e.id!, p, e.feedback.temptingAlternative.move), e.id).toMatchObject({ status: 'checked', safe: false });
    }
    // Multi-select saves: every correct option is a safe move that keeps everything, the "defend it" option fails.
    for (const id of ['b06l3-06', 'b06-c15']) {
      const c = byId(id) as ChoiceExercise;
      const p = positionOf(c);
      for (const o of c.options) {
        expect(verdict(id, p, o.move!), `${id} ${o.id}`).toMatchObject({ status: 'checked', safe: o.correct });
        if (o.correct) expect(keepsEverything(p, o.move!), `${id} ${o.id}`).toBe(true);
      }
      expect(c.options.find((o) => !o.correct)!.misconception, id).toBe('b06.m1');
    }
  });

  // Content review (S3.2.b attempt 2): a guard-passing move must not lose the piece a move later. Every move the item
  // accepts (b06-c12 and b06-c13 use a 2-ply guard) and every correct save option keeps the material for 4 plies.
  it('"without losing anything": every accepted move of every safe item (lesson + pool) keeps the material at depth 4', () => {
    const saves = all.filter((e): e is MoveExercise => e.type === 'move' && e.goal.kind === 'safe');
    expect(saves).toHaveLength(10);
    expect(saves.filter((e) => e.goal.kind === 'safe' && e.goal.guard).map((e) => e.id)).toEqual(['b06-c12', 'b06-c13']);
    for (const e of saves) {
      const p = positionOf(e);
      const accepted = keysOf(p).filter((k) => verdict(e.id!, p, k).safe);
      expect(accepted.length, e.id).toBeGreaterThan(0);
      for (const k of accepted) expect(depth4(p, k), `${e.id} ${k}`).toBeGreaterThanOrEqual(0);
    }
    for (const id of ['b06l3-06', 'b06-c15']) {
      const p = pos(id);
      for (const o of (byId(id) as ChoiceExercise).options.filter((x) => x.correct)) expect(depth4(p, o.move!), `${id} ${o.id}`).toBeGreaterThanOrEqual(0);
    }
    // The moves the review found: now rejected by the item's guard.
    const rejected = (id: string, keys: string[]) => keys.forEach((k) => expect(verdict(id, pos(id), k).safe, `${id} ${k}`).toBe(false));
    rejected('b06-c12', ['a9-d9']);
    rejected('b06-c13', ['c5-a6', 'c5-a4']);
  }, 120_000);

  it('TR b06l3-08: full board as Black right after Red’s Cannon move; exactly the three blocks are safe', () => {
    const seq = ['h2-h4', 'b7-d7', 'd0-e1', 'c6-c5', 'g3-g4', 'e6-e5', 'h4-i4'];
    let p = parseFen(START_FEN);
    for (const k of seq) p = after(p, k);
    const tr = pos('b06l3-08');
    expect(toFen(tr)).toBe(toFen(p));
    expect(tr.turn).toBe('black');
    expect(tr.board.filter(Boolean)).toHaveLength(32);
    // Red's last move created the attack: before it the Chariot was not attacked (only the defended Horse was).
    const before = (() => { let q = parseFen(START_FEN); for (const k of seq.slice(0, -1)) q = after(q, k); return q; })();
    expect(querySquares(before, { kind: 'attacked-pieces', side: 'black' }).map(squareName)).toEqual(['h9']);
    expect(querySquares(before, { kind: 'hanging', side: 'black' })).toEqual([]);
    expect(query('b06l3-08', { kind: 'attacked-pieces', side: 'black' })).toEqual(['i9']);
    const safeMoves = keysOf(tr).filter((k) => verdict('b06l3-08', tr, k).safe);
    expect(safeMoves.sort()).toEqual(['g9-i7', 'h7-i7', 'h9-i7']);
    for (const k of safeMoves) expect(keepsEverything(tr, k), k).toBe(true);
  });
});

/** Learner-relative signature of a check item: kind of task + material (own / opponent piece types). */
function signature(e: AssessmentItem): string {
  const p = positionOf(e);
  const own = p.turn;
  const types = (mine: boolean) => p.board.filter((x) => x && (x.color === own) === mine).map((x) => x!.type).sort().join(',');
  const task = e.type === 'move' ? `move:${e.goal.kind}` : e.type === 'select-squares' ? `select:${JSON.stringify(e.query ?? e.region ?? 'square')}` : e.type;
  return `${task} | ${types(true)} | ${types(false)}`;
}

describe('b06 check pool (03 §4.1–§4.3)', () => {
  it('16 items: 5 / 5 / 6 per lesson objective, all b06 G0, 8 as Black, neutral (no hints, no highlights)', () => {
    expect(check).toHaveLength(16);
    expect(poolFiles['b06-check']).toMatchObject({ id: 'b06-check', kind: 'check', unit: 'b06', primaryStrand: 'RS' });
    expect(['b06l1', 'b06l2', 'b06l3'].map((l) => check.filter((i) => i.objective === l).length)).toEqual([5, 5, 6]);
    expect(check.every((i) => i.unit === 'b06' && i.assist === 'G0' && i.status === 'verified')).toBe(true);
    expect(check.filter((i) => i.side === 'black')).toHaveLength(8);
    for (const i of check as (AssessmentItem & { hints?: unknown; highlight?: unknown; from?: unknown })[]) {
      expect(i.hints, i.id).toBeUndefined();
      expect(i.highlight, i.id).toBeUndefined();
      expect(i.from, i.id).toBeUndefined();
    }
  });

  it('unseen (03 §4.2 rule 4): no check item is near any lesson item of any unit, nor another b06 check item', () => {
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

  it('builds three 8-item forms with 2 interleaved b01–b05 items each (≥ 3 Black, every objective, ≤ half exposed)', () => {
    const earlier = ['b01-check', 'b02-check', 'b03-check', 'b04-check', 'b05-check'].flatMap((p) => poolFiles[p].items as AssessmentItem[]);
    const base = { unit: 'b06', objectives: b06.lessons.map((l) => l.id), primaryStrand: 'RS' as const, poolId: 'b06-check', assessmentVersion: 1, own: check, earlier };
    const exposed = new Set<string>();
    for (const [attempt, maxExposed] of [[1, 0], [2, 0], [3, 4]] as const) {
      const r = assembleCheckForm({ ...base, exposed, seed: attempt });
      expect(r.ok, `attempt ${attempt}`).toBe(true);
      if (!r.ok) continue;
      expect(r.form.items).toHaveLength(8);
      expect(r.form.items.filter((i) => i.unit === 'b06')).toHaveLength(6);
      expect(new Set(r.form.items.filter((i) => i.unit === 'b06').map((i) => i.objective)).size).toBe(3);
      expect(r.form.items.filter((i) => i.side === 'black').length).toBeGreaterThanOrEqual(3);
      expect(r.form.exposedCount).toBeLessThanOrEqual(maxExposed);
      for (const i of r.form.items) exposed.add(i.id!);
    }
  });
});
