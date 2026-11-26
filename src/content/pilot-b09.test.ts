// Content checks of the pilot unit b09 (S2.14: lesson b09l3 + practical task b09-g1), loaded in release state REL-P
// (preview only). The validator, T1 and the release test run on it with every other unit (content.test.ts,
// release.test.ts); this file pins what the pilot itself must show. The §5.7 checks of b09-g1 are slower (~1 min):
// `npx tsx scripts/verify-practical.ts b09 --runs 20`.
import { describe, expect, it } from 'vitest';
import { legalMoves, makeMove, materialBalance, moveScore, parseFen, squareName, START_FEN, toFen, type Move, type Position } from '../engine';
import { search } from '../analysis';
import { searchAtLeast } from '../analysis/search';
import { development } from '../analysis/features';
import { evaluatePredicate, type Predicate } from '../analysis/judge';
import { assembleCheckForm } from '../assessment/checks';
import { captureFacts, positionOf } from '../lessons/answers';
import { syncSafety } from '../lessons/decision-table';
import { nearDuplicate } from './near-duplicate';
import { normalKey } from './normalize';
import { poolFiles } from './pools';
import { isAccepted, parseMoveKey } from '../lessons/decision';
import { learnerNodeStats } from '../lessons/line';
import { allUnits } from './index';
import { unitItems } from './release';
import type { AssessmentItem, ChoiceExercise, DecisionExercise, Exercise, LineExercise, LineLearnerNode, LineOpponentNode, MoveTableEntry, PlayExercise, Unit } from './types';
import { validateContent } from './validate';

const b09 = allUnits.find((u) => u.id === 'b09') as Unit;
const lesson = b09.lessons.find((l) => l.id === 'b09l3')!;
const byId = (id: string) => lesson.exercises.find((e) => e.id === id) as Exercise;

describe('pilot unit b09', () => {
  it('a lesson may hold the unit task id `<unit>-g<k>` only on a play / review item', () => {
    const learn = lesson.exercises[0];
    const unitWith = (ex: Exercise): Unit[] => [{ ...b09, lessons: [{ ...lesson, exercises: [ex] }] }];
    expect(validateContent(unitWith({ ...learn, id: 'b09-g2' } as Exercise)).errors.join('\n')).toMatch(/id "b09-g2" must match \^b09l3-\\d\\d\$/);
    expect(validateContent(unitWith({ ...learn, id: 'b09l3-09' } as Exercise)).errors).toEqual([]);
  });

  it('is lesson b09l3 as 02 b09: Black throughout, the ladder G3 → TR, all quiet, misconceptions b09.m1–m4 tagged', () => {
    expect(b09.track).toBe('basics');
    expect(lesson.id).toBe('b09l3');
    const items = lesson.exercises;
    expect(items.map((e) => e.type)).toEqual(['learn', 'learn', 'choice', 'choice', 'decision', 'decision', 'decision', 'line', 'play']);
    // The lesson items are played as Black; the practical task (from the start position) as Red.
    expect(items.slice(0, 8).every((e) => e.side === 'black')).toBe(true);
    expect(byId('b09-g1').side).toBe('red');
    expect(items.filter((e) => e.type !== 'learn').map((e) => e.assist)).toEqual(['G2', 'G2', 'G1', 'G1', 'G0', 'G0', undefined]);
    expect(items.filter((e) => e.type !== 'learn').every((e) => e.nature === 'quiet')).toBe(true);
    // Feedback in four parts on every G1/G0 move item.
    for (const e of items.filter((x) => x.type === 'decision' || x.type === 'line')) {
      expect(e.feedback, e.id).toMatchObject({ purpose: expect.any(String), keyReply: expect.any(String), commonError: expect.any(String) });
      expect(e.feedback?.temptingAlternative.move, e.id).toMatch(/^[a-i]\d-[a-i]\d$/);
    }
    const tagged = new Set(JSON.stringify(b09).match(/b09\.m[1-4]/g));
    expect([...tagged].sort()).toEqual(['b09.m1', 'b09.m2', 'b09.m3', 'b09.m4']);
    // The S2.14 items are `reviewed` (approving record in reviews/b09.json); the Basic level is not published in REL-P.
    expect(unitItems(b09).filter(({ item }) => item.id!.startsWith('b09l3') || item.id === 'b09-g1').every(({ item }) => item.status === 'reviewed')).toBe(true);
  });

  it('decisions: the guarding Horse moves are the targets; in b09l3-06 the g7 Horse’s leg is blocked (only H2+3 guards)', () => {
    for (const id of ['b09l3-05', 'b09l3-07']) {
      const d = byId(id) as DecisionExercise;
      expect(d.table.filter((r) => r.class === 'target').map((r) => r.move).sort(), id).toEqual(['b9-c7', 'h9-g7']);
    }
    const blocked = byId('b09l3-06') as DecisionExercise;
    expect(blocked.table.filter((r) => r.class === 'target').map((r) => r.move)).toEqual(['b9-c7']);
    expect(blocked.table.find((r) => r.move === 'h9-g7')).toMatchObject({ class: 'dubious', source: 'authored' });
    expect(blocked.feedback?.temptingAlternative.move).toBe('h9-g7');
    for (const id of ['b09l3-05', 'b09l3-06', 'b09l3-07']) {
      const d = byId(id) as DecisionExercise;
      expect(d.table.filter((r) => isAccepted(r.class)).every((r) => r.source === 'authored'), id).toBe(true);
      expect(d.objective, id).toEqual({ kind: 'all', of: [{ kind: 'development', increaseBy: 1 }, { kind: 'no-hanging' }] });
    }
    // The tempting Chariot move of the independent item loses the Horse beside it: an error, refuted on the board.
    const g0 = byId('b09l3-07') as DecisionExercise;
    expect(g0.table.find((r) => r.move === 'i9-i8')).toMatchObject({ class: 'error', misconception: 'b09.m1' });
  });

  it('the G0 line: after H8+7 the usual R9=8 drops the Chariot to the Cannon still at home (an error at both replies)', () => {
    const line = byId('b09l3-08') as LineExercise;
    const afterG7 = line.root.next!['h9-g7'] as LineOpponentNode;
    for (const reply of afterG7.replies) {
      const node = reply.next as LineLearnerNode;
      expect(node.table.find((r) => r.move === 'i9-h9'), reply.move).toMatchObject({ class: 'error' });
    }
  });

  it('the line has selective learner nodes and the practical task a selective scripted first part (03 §5.3 rule 3)', () => {
    for (const s of learnerNodeStats(byId('b09l3-08') as LineExercise)) expect(s.selective, s.path.join(' ')).toBe(true);
    const task = byId('b09-g1') as PlayExercise;
    expect(task).toMatchObject({ task: 'opening', lineShare: 6, development: { n: 6, target: 4 } });
    // 03 §5.2 remedy (2): scored as a Basic R6 task, R6 × 0.5 + R1 × 0.5, whose line-share gate fails the safe shuffler.
    expect(task.rubrics).toEqual([
      { rubric: 'R6', weight: 50 },
      { rubric: 'R1', weight: 50 },
    ]);
    const stats = learnerNodeStats({ root: task.tree! });
    expect(stats.length).toBeGreaterThanOrEqual(6);
    for (const s of stats) expect(s.selective, s.path.join(' ')).toBe(true);
  });

  it('b09-g1: credited Red moves drop no material and scripted replies leave nothing hanging (depth 2 + quiescence)', () => {
    const task = byId('b09-g1') as PlayExercise;
    const delta = (pos: Position, key: string) => {
      const want = parseMoveKey(key)!;
      const m = legalMoves(pos).find((x) => x.from === want.from && x.to === want.to)!;
      return { m, d: moveScore(pos, m, 2) - materialBalance(pos.board, pos.turn) };
    };
    const walk = (node: LineLearnerNode, pos: Position, path: string) => {
      for (const row of node.table.filter((r) => isAccepted(r.class))) expect(delta(pos, row.move).d, `${path} ${row.move}`).toBeGreaterThan(-1);
      for (const [key, child] of Object.entries(node.next ?? {})) {
        if (child.kind !== 'opponent') continue;
        const mid = makeMove(pos, delta(pos, key).m);
        for (const reply of child.replies) {
          const r = delta(mid, reply.move);
          expect(r.d, `${path} ${key} ${reply.move}`).toBeGreaterThan(-1);
          const next = makeMove(mid, r.m);
          const gains = legalMoves(next).filter((x) => next.board[x.to] && moveScore(next, x, 2) - materialBalance(next.board, next.turn) >= 1);
          expect(gains, `${path} ${key} ${reply.move}: something hangs`).toEqual([]);
          if (reply.next.kind === 'learner') walk(reply.next, next, `${path} ${key} ${reply.move}`);
        }
      }
    };
    walk(task.tree!, parseFen(task.fen!), '');
  }, 120_000);
});

// ---------- S3.3.b: the rest of unit b09 (b09l1, b09l2, b09l4) and the check pool b09-check ----------
// Every claim holds for EVERY accepted move: accepted rows pass the Basic guard and keep the material against the best
// line of 4 plies (and meet the item's predicate in the lessons); authored errors lose at depth 4. Positions come from
// legal move sequences from the start position (SEQ).

const SEQ: Record<string, string> = {
  'b09l1-01': 'h2-e2 a6-a5 h0-g2 i6-i5 i0-h0 e9-e8 b0-c2',
  'b09l1-02': 'h2-h4 b9-c7 h4-d4 h9-g7 d4-d6',
  'b09l1-03': 'b2-b6 a6-a5 b6-e6 b9-c7',
  'b09l1-04': 'c3-c4 h9-g7 g3-g4 b9-c7 e0-e1 i9-h9 a3-a4 a9-b9',
  'b09l1-05': 'h2-e2 a6-a5 h0-g2 c6-c5 i0-h0',
  'b09l1-06': 'h2-f2 h9-g7 h0-g2 i9-h9',
  'b09l1-07': 'h0-g2 h9-g7 b0-c2',
  'b09l1-08': 'h0-g2 c6-c5 b0-c2',
  'b09l2-01': 'h2-f2 h9-g7 h0-g2 i9-h9 i0-h0',
  'b09l2-02': 'c3-c4 h9-g7 e0-e1 i9-h9 e1-e2',
  'b09l2-03': 'h2-e2 b9-c7 h0-g2 a9-b9',
  'b09l2-04': 'c3-c4 h9-g7 h0-g2',
  'b09l2-05': 'h0-g2 h9-g7 b0-c2 b9-c7',
  'b09l2-06': 'e3-e4 h9-g7 h0-g2',
  'b09l2-07': 'c3-c4 b9-c7 b0-c2 h9-g7',
  'b09l4-01': 'h2-d2 h9-g7',
  'b09l4-02': 'h2-d2',
  'b09l4-03': 'b2-d2 b9-c7',
  'b09l4-04': 'b2-d2 h9-g7',
  'b09l4-05': 'h2-f2',
  'b09l4-06': 'c3-c4 b9-c7',
  'b09-c01': 'h2-f2 h9-g7 b0-c2 b9-c7',
  'b09-c02': 'h0-g2 h9-g7 b2-d2',
  'b09-c03': 'e0-e1 h9-g7 a3-a4 b9-c7 i3-i4 a9-b9',
  'b09-c04': 'b0-c2 a6-a5 h0-g2 i6-i5 a0-b0',
  'b09-c05': 'h0-g2 c6-c5 b0-c2 b9-c7',
  'b09-c06': 'b2-d2 h9-g7 b0-c2',
  'b09-c07': 'g3-g4 h9-g7 b0-c2 b9-c7',
  'b09-c08': 'a3-a4 h9-g7 h0-g2',
  'b09-c09': 'h2-e2 c6-c5 h0-g2',
  'b09-c10': 'h2-e2 b7-b5 h0-g2',
  'b09-c11': 'h2-e2 c6-c5 b0-c2',
  'b09-c12': 'h2-e2 a6-a5 h0-g2',
  'b09-c13': 'b2-e2 c6-c5 b0-c2 b9-c7',
  'b09-c14': 'c3-c4 h9-g7 b0-c2',
  'b09-c15': 'h2-d2 h9-g7 h0-g2 i9-h9',
  'b09-c16': 'e3-e4 b9-c7 b0-c2 h9-g7',
};
const BACK = { kind: 'all', of: [{ kind: 'any', of: [{ kind: 'development', measure: 'horses-out', increaseBy: 1 }, { kind: 'development', measure: 'chariots-out', increaseBy: 1 }] }, { kind: 'no-hanging' }] } as const;
const CHAR = { kind: 'all', of: [{ kind: 'development', measure: 'chariots-out', increaseBy: 1 }, { kind: 'no-hanging' }] } as const;
const newLessons = b09.lessons.filter((l) => l.id !== 'b09l3');
const newItems = newLessons.flatMap((l) => l.exercises);
const pool = poolFiles['b09-check'].items as AssessmentItem[];
const anyItem = (id: string) => [...newItems, ...pool].find((e) => e.id === id) as Exercise;
const keyOf = (m: Move) => `${squareName(m.from)}-${squareName(m.to)}`;
const mv = (p: Position, key: string) => {
  const m = legalMoves(p).find((x) => keyOf(x) === key);
  if (!m) throw new Error(`illegal ${key}`);
  return m;
};
const play = (seq: string) => seq.split(' ').reduce((p, key) => makeMove(p, mv(p, key)), parseFen(START_FEN));
const d4 = (p: Position, key: string) => {
  const r = search(makeMove(p, mv(p, key)), { depth: 4, maxNodes: 3e6 });
  expect(r.complete, key).toBe(true);
  return -r.score - materialBalance(p.board, p.turn);
};
const guardOk = (id: string, p: Position, key: string) => {
  const v = syncSafety()(p, mv(p, key), { itemId: id });
  return v.status === 'checked' && v.safe;
};
const meets = (pred: Predicate, p: Position, key: string) => evaluatePredicate(pred, { before: p, moves: [mv(p, key)] }) === true;
const dev = (p: Position, side: 'red' | 'black') => development(p.board, side).developed;
const centralSoldierHanging = (p: Position) => captureFacts(p.board, p.board.findIndex((x, s) => squareName(s) === 'e6' && x?.type === 'soldier' && x.color === 'black')).hanging;
const options = (id: string) => (anyItem(id) as ChoiceExercise).options;

/** Depth-6 null-window facts after `key` for the mover: loses ≥ 1, or keeps the material (≥ 0). */
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

/**
 * Checks one table (decision or line node), fix round 1: accepted rows pass the guard, keep the material at depth 4 and
 * meet the predicate; an authored `error` that passes the guard loses ≥ 1 at depth 6; authored `dubious` reasons say
 * what is true (a Cannon-for-Horse trade at depth 6, a developing move that loses at depth 4 but not 1 at depth 6, no
 * development, an edge Horse, a General / Advisor move).
 */
function checkTable(id: string, p: Position, rows: readonly MoveTableEntry[], pred: Predicate | undefined, tempt?: { move: string }) {
  const objective = pred ?? (BACK as unknown as Predicate);
  expect(rows.map((r) => r.move).sort(), id).toEqual(legalMoves(p).map(keyOf).sort());
  expect(rows.some((r) => !isAccepted(r.class)), id).toBe(true);
  for (const row of rows) {
    const tag = `${id} ${row.move}`;
    const piece = p.board[mv(p, row.move).from]!;
    if (isAccepted(row.class)) {
      expect(guardOk(id, p, row.move), tag).toBe(true);
      expect(d4(p, row.move), tag).toBeGreaterThanOrEqual(0);
      expect(meets(objective, p, row.move), tag).toBe(true);
    } else if (row.class === 'error') {
      if (row.source === 'computed' || !guardOk(id, p, row.move)) expect(guardOk(id, p, row.move), tag).toBe(false);
      else expect(d6(p, row.move), tag).toBe('lose1');
    } else if (row.source === 'authored') {
      if (row.reason === 'b09.r.trade') expect(d6(p, row.move), tag).toBe('small');
      else if (row.reason === 'b09.r.risky') {
        expect(meets(objective, p, row.move), tag).toBe(true);
        expect(d4(p, row.move), tag).toBeLessThan(0);
        expect(d6(p, row.move), tag).not.toBe('lose1');
      } else if (row.reason === 'b09.r.nodev') expect(meets(objective, p, row.move), tag).toBe(false);
      else if (row.reason === 'b09.r.edge') expect([piece.type, ['a', 'i'].includes(row.move[3])], tag).toEqual(['horse', true]);
      else if (row.reason === 'b09.r.general' || row.misconception === 'b09.m3') expect(['general', 'advisor'], tag).toContain(piece.type);
    }
  }
  if (tempt) {
    const row = rows.find((r) => r.move === tempt.move)!;
    expect(isAccepted(row.class), id).toBe(false);
    if (row.misconception === 'b09.m1') expect(row.class === 'error' && (!guardOk(id, p, row.move) || d6(p, row.move) === 'lose1'), id).toBe(true);
    else expect(['general', 'advisor'], id).toContain(p.board[mv(p, row.move).from]!.type);
  }
}

describe('unit b09 complete (S3.3.b)', () => {
  it('four lessons in 02 order, learn cards first, ladders G2 G2 G1 G1 G0, new items reviewed, the pilot unchanged', () => {
    expect(b09.lessons.map((l) => l.id)).toEqual(['b09l1', 'b09l2', 'b09l3', 'b09l4']);
    for (const l of newLessons) {
      const first = l.exercises.findIndex((e) => e.type !== 'learn');
      expect(first, l.id).toBeGreaterThan(0);
      expect(l.exercises.slice(first).every((e) => e.type !== 'learn'), l.id).toBe(true);
      expect(l.exercises.filter((e) => e.type !== 'learn').map((e) => e.assist), l.id).toEqual(['G2', 'G2', 'G1', 'G1', 'G0']);
    }
    expect(newItems.every((e) => e.status === 'reviewed' && e.source?.kind === 'authored')).toBe(true);
    expect(newItems.filter((e) => e.type !== 'learn').every((e) => e.strand === 'OD' && e.nature === 'quiet' && e.critical === false)).toBe(true);
    // Both colours: the new practice items alternate; b09l4 has lines for Red and Black.
    expect(newItems.filter((e) => e.type !== 'learn' && e.side === 'black').map((e) => e.id)).toEqual(['b09l1-05', 'b09l1-07', 'b09l1-08', 'b09l2-04', 'b09l2-06', 'b09l4-02', 'b09l4-05']);
    expect(newLessons[2].exercises.filter((e) => e.type === 'line').map((e) => e.side)).toEqual(['red', 'black', 'red']);
  });

  it('positions come from legal move sequences from the start position', () => {
    for (const e of [...newItems, ...pool]) expect(toFen(positionOf(e)), e.id).toBe(toFen(play(SEQ[e.id!])));
  });

  it('misconceptions b09.m1–m4: a tagged learn card each in the new lessons and tagged wrong answers', () => {
    const cards = newItems.filter((e) => e.type === 'learn').flatMap((e) => (e.misconceptions ?? []).map((m) => `${m} ${e.id}`));
    expect(cards.sort()).toEqual(['b09.m1 b09l4-01', 'b09.m2 b09l1-02', 'b09.m3 b09l2-02', 'b09.m4 b09l1-03']);
    const wrong = [...newItems, ...pool].flatMap((e) => (e.type === 'choice' ? e.options.filter((o) => !o.correct).map((o) => o.misconception) : e.type === 'decision' ? e.table.map((r) => r.misconception) : []));
    expect([...new Set(wrong.filter(Boolean))].sort()).toEqual(['b09.m1', 'b09.m2', 'b09.m3']);
  });

  it('learn cards and development comparisons count what they say (engine development count)', () => {
    const p = (id: string) => positionOf(anyItem(id));
    expect([dev(p('b09l1-01'), 'red'), dev(p('b09l1-01'), 'black')]).toEqual([4, 0]);
    expect([dev(p('b09l1-02'), 'red'), dev(p('b09l1-02'), 'black')]).toEqual([1, 2]);
    expect(captureFacts(p('b09l1-03').board, p('b09l1-03').board.findIndex((_, s) => squareName(s) === 'e6')).attackers.map(squareName)).toEqual(['c7']);
    expect([dev(p('b09l2-02'), 'red'), dev(p('b09l2-02'), 'black')]).toEqual([0, 2]);
    for (const [id, red, black] of [['b09l1-04', 0, 4], ['b09l1-05', 3, 0], ['b09-c03', 0, 3], ['b09-c04', 3, 0]] as const) {
      expect([dev(p(id), 'red'), dev(p(id), 'black')], id).toEqual([red, black]);
      expect(options(id).filter((o) => o.correct).map((o) => o.id), id).toEqual(['a']);
    }
  });

  it('decisions: every accepted move passes the guard, keeps the material at depth 4 and develops; refusals lose', () => {
    const decisions = [...newItems, ...pool].filter((e): e is DecisionExercise => e.type === 'decision');
    expect(decisions.map((e) => e.id)).toEqual(['b09l1-06', 'b09l1-07', 'b09l1-08', 'b09l2-05', 'b09l2-06', 'b09l2-07', 'b09-c01', 'b09-c02', 'b09-c05', 'b09-c06', 'b09-c07', 'b09-c08', 'b09-c09', 'b09-c10', 'b09-c11', 'b09-c13', 'b09-c14', 'b09-c15']);
    for (const d of decisions) {
      const p = positionOf(d);
      const pred = (d.prompt === 'b09.p.char' ? CHAR : BACK) as unknown as Predicate;
      if (typeof d.objective === 'object') expect(d.objective, d.id).toEqual(pred);
      checkTable(d.id!, p, d.table, pred, d.feedback!.temptingAlternative);
      // Against the central Cannon the accepted moves are Horse moves that keep the central Soldier defended.
      if (d.prompt === 'b09.p.cc') {
        for (const r of d.table.filter((x) => isAccepted(x.class))) {
          expect(p.board[mv(p, r.move).from]!.type, `${d.id} ${r.move}`).toBe('horse');
          expect(centralSoldierHanging(makeMove(p, mv(p, r.move))), `${d.id} ${r.move}`).toBe(false);
        }
        expect(centralSoldierHanging(p), d.id).toBe(true);
      }
    }
  }, 2_400_000);

  it('lines (both colours): every node’s accepted moves pass the guard, keep the material and develop; replies pass the guard', () => {
    const lines = newItems.filter((e): e is LineExercise => e.type === 'line');
    expect(lines.map((e) => e.id)).toEqual(['b09l4-04', 'b09l4-05', 'b09l4-06']);
    for (const l of lines) {
      const walk = (node: LineLearnerNode, p: Position, path: string) => {
        checkTable(`${l.id}${path}`, p, node.table, (node.objective ?? l.objective) as Predicate, path === '' ? l.feedback!.temptingAlternative : undefined);
        for (const [key, child] of Object.entries(node.next ?? {})) {
          if (child.kind !== 'opponent') continue;
          const mid = makeMove(p, mv(p, key));
          expect(child.replies.length, `${l.id}${path} ${key}`).toBeGreaterThanOrEqual(1);
          for (const r of child.replies) {
            expect(guardOk(l.id!, mid, r.move), `${l.id}${path} ${key} ${r.move}`).toBe(true);
            if (r.next.kind === 'learner') walk(r.next, makeMove(mid, mv(mid, r.move)), `${path} ${key} ${r.move}`);
          }
        }
      };
      walk(l.root, positionOf(l), '');
      // Deviations: at least one root move meets two different authored replies.
      expect(Object.values(l.root.next ?? {}).some((c) => c.kind === 'opponent' && c.replies.length >= 2), l.id).toBe(true);
    }
  }, 2_400_000);

  it('move choices: correct answers develop safely; General moves develop nothing; m1 answers lose material', () => {
    for (const id of ['b09l2-03', 'b09l2-04', 'b09l4-02', 'b09l4-03', 'b09-c12', 'b09-c16']) {
      const p = positionOf(anyItem(id));
      for (const o of options(id)) {
        const tag = `${id} ${o.id}`;
        if (o.correct) {
          expect(guardOk(id, p, o.move!), tag).toBe(true);
          expect(d4(p, o.move!), tag).toBeGreaterThanOrEqual(0);
          expect(meets(BACK as unknown as Predicate, p, o.move!), tag).toBe(true);
        } else if (o.misconception === 'b09.m3') {
          expect(p.board[mv(p, o.move!).from]!.type, tag).toBe('general');
          expect(dev(makeMove(p, mv(p, o.move!)), p.turn), tag).toBe(dev(p, p.turn));
        } else if (o.misconception === 'b09.m1') expect(d4(p, o.move!), tag).toBeLessThan(0);
        else {
          // b09l2-03 c: the Horse that already moved goes to the edge; nothing new comes into play.
          expect(tag).toBe('b09l2-03 c');
          expect(dev(makeMove(p, mv(p, o.move!)), p.turn)).toBe(dev(p, p.turn));
        }
      }
    }
    // b09-c12: the right answer keeps the central Soldier defended, both wrong ones leave it to the Cannon.
    const c12 = positionOf(anyItem('b09-c12'));
    expect(options('b09-c12').map((o) => centralSoldierHanging(makeMove(c12, mv(c12, o.move!))))).toEqual([false, true, true]);
    // b09l2-04 b: the Chariot steps onto the file of Red's Cannon, which takes it over Black's Cannon.
    const l24 = positionOf(anyItem('b09l2-04'));
    expect(guardOk('b09l2-04', l24, 'i9-h9')).toBe(false);
  }, 300_000);
});

describe('b09 check pool (03 §4.1–§4.3)', () => {
  it('16 items: 4 per lesson objective, all G0, reviewed, neutral (no hints, no highlights)', () => {
    expect(pool).toHaveLength(16);
    expect(poolFiles['b09-check']).toMatchObject({ id: 'b09-check', kind: 'check', unit: 'b09', primaryStrand: 'OD' });
    expect(['b09l1', 'b09l2', 'b09l3', 'b09l4'].map((l) => pool.filter((i) => i.objective === l).length)).toEqual([4, 4, 4, 4]);
    expect(pool.every((i) => i.unit === 'b09' && i.assist === 'G0' && i.status === 'reviewed')).toBe(true);
    expect(pool.filter((i) => i.side === 'black').length).toBe(9);
    // Safety-critical (03 §4.1, from b08 on): the central-Cannon items, where a wrong answer drops the central Soldier.
    expect(pool.filter((i) => i.critical).map((i) => i.id)).toEqual(['b09-c09', 'b09-c10', 'b09-c11', 'b09-c12']);
    for (const i of pool as (AssessmentItem & { hints?: unknown; highlight?: unknown })[]) {
      expect(i.hints, i.id).toBeUndefined();
      expect(i.highlight, i.id).toBeUndefined();
    }
  });

  // Opening positions a move or two from the start are one moved piece from many other opening positions, so the
  // "one piece moved" near-duplicate rule is applied inside the pool only; against every lesson item and every other
  // pool the rule is the exact normal form (file mirror + colour swap; the pool validator's uniqueness corpus). Inside
  // the pool it is applied between items played by the same side (a Red and a Black opening position that differ by one
  // piece up to colour swap are different tasks: different files, different first moves).
  it('unseen (03 §4.2 rule 4): no check item repeats a lesson or pool position, and no two b09 check items are near', () => {
    const lessonKeys = new Map(allUnits.flatMap((u) => u.lessons.flatMap((l) => l.exercises.map((e, i) => [normalKey(positionOf(e)), e.id ?? `${l.id}#${i}`] as const))));
    const poolKeys = new Map(Object.values(poolFiles).filter((p) => p.id !== 'b09-check').flatMap((p) => (p.items as AssessmentItem[]).map((e) => [normalKey(positionOf(e)), e.id!] as const)));
    for (const c of pool) {
      expect(lessonKeys.get(normalKey(positionOf(c))), c.id).toBeUndefined();
      expect(poolKeys.get(normalKey(positionOf(c))), c.id).toBeUndefined();
    }
    const others = pool.map((e) => ({ ref: e.id!, side: e.side, pos: positionOf(e) }));
    const hits = pool.flatMap((c) => others.filter((o) => o.ref !== c.id && o.side === c.side && nearDuplicate(positionOf(c), o.pos)).map((o) => `${c.id} ~ ${o.ref}`));
    expect(hits).toEqual([]);
  });

  // Pattern mirrors (same task + learner-relative material) are not meaningful here: every item is an opening position
  // with all 32 pieces, so all of them share the same material; the near-duplicate test keeps them apart.

  it('builds three 8-item forms with 2 interleaved b01–b08 items each (≥ 3 Black, every objective, ≤ half exposed)', () => {
    const earlier = ['b01-check', 'b02-check', 'b03-check', 'b04-check', 'b05-check', 'b06-check', 'b07-check', 'b08-check'].flatMap((p) => poolFiles[p].items as AssessmentItem[]);
    const base = { unit: 'b09', objectives: b09.lessons.map((l) => l.id), primaryStrand: 'OD' as const, poolId: 'b09-check', assessmentVersion: 1, own: pool, earlier };
    const exposed = new Set<string>();
    for (const [attempt, maxExposed] of [[1, 0], [2, 0], [3, 4]] as const) {
      const r = assembleCheckForm({ ...base, exposed, seed: attempt });
      expect(r.ok, `attempt ${attempt}`).toBe(true);
      if (!r.ok) continue;
      expect(r.form.items).toHaveLength(8);
      expect(r.form.items.filter((i) => i.unit === 'b09')).toHaveLength(6);
      expect(new Set(r.form.items.filter((i) => i.unit === 'b09').map((i) => i.objective)).size).toBe(4);
      expect(r.form.items.filter((i) => i.side === 'black').length).toBeGreaterThanOrEqual(3);
      expect(r.form.items.some((i) => i.critical)).toBe(true);
      expect(r.form.exposedCount).toBeLessThanOrEqual(maxExposed);
      for (const i of r.form.items) exposed.add(i.id!);
    }
  });
});
