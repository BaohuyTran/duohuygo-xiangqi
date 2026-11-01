// Content checks of the pilot unit b09 (S2.14: lesson b09l3 + practical task b09-g1), loaded in release state REL-P
// (preview only). The validator, T1 and the release test run on it with every other unit (content.test.ts,
// release.test.ts); this file pins what the pilot itself must show. The §5.7 checks of b09-g1 are slower (~1 min):
// `npx tsx scripts/verify-practical.ts b09 --runs 20`.
import { describe, expect, it } from 'vitest';
import { legalMoves, makeMove, materialBalance, moveScore, parseFen, type Position } from '../engine';
import { isAccepted, parseMoveKey } from '../lessons/decision';
import { learnerNodeStats } from '../lessons/line';
import { allUnits } from './index';
import { unitItems } from './release';
import type { DecisionExercise, Exercise, LineExercise, LineLearnerNode, LineOpponentNode, PlayExercise, Unit } from './types';
import { validateContent } from './validate';

const b09 = allUnits.find((u) => u.id === 'b09') as Unit;
const lesson = b09.lessons[0];
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
    // Every item is `reviewed` (approving record in reviews/b09.json); the Basic level is not published in REL-P.
    expect(unitItems(b09).every(({ item }) => item.status === 'reviewed')).toBe(true);
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
