import { describe, expect, it } from 'vitest';
import { makeMove, legalMoves, parseSquare } from '../engine';
import { directAnalyzer } from '../play';
import type { AttemptRecord } from '../progress/records';
import { positionOf } from './answers';
import { bestCombinationReplies, combinationReply, variedCombinationReply, variedDefenceReplies } from './combination';
import type { CombinationExercise } from '../content/types';
import { moveKey, parseMoveKey } from './decision';
import {
  analyzerLineJudge,
  chooseByCoverage,
  chooseReply,
  coverageCounts,
  judgeLineMove,
  learnerNodeStats,
  lineCredit,
  lineDepth,
  lineScript,
  staticGoalMet,
} from './line';
import { forcedLineFixture, quietLineFixture, variedComboFixture } from './line-fixtures';
import type { LineOpponentNode } from '../content/types';

const mv = (k: string) => parseMoveKey(k)!;
const rec = (itemId: string, path: string[]): AttemptRecord => ({ itemId, itemVersion: 1, mode: 'practice', at: '2026-10-24T00:00:00.000Z', credit: 1, path });

describe('learner nodes', () => {
  const ex = forcedLineFixture();
  const pos = positionOf(ex);

  it('looks moves up in the node table and returns the continuation', () => {
    const v = judgeLineMove(ex.root, pos, mv('e1-f1'));
    expect(v.kind === 'class' && v.entry.class).toBe('target');
    expect(v.kind === 'class' && v.next?.kind).toBe('opponent');
    const d = judgeLineMove(ex.root, pos, mv('e1-g1'));
    expect(d.kind === 'class' && d.entry.class).toBe('dubious');
    expect(d.kind === 'class' && d.next).toBeUndefined();
    expect(judgeLineMove(ex.root, pos, mv('e2-e3')).kind).toBe('illegal');
  });

  it('an error row never continues', () => {
    const q = quietLineFixture();
    const v = judgeLineMove(q.root, positionOf(q), mv('i0-i5'));
    expect(v).toEqual({ kind: 'class', entry: expect.objectContaining({ class: 'error' }) });
  });
});

describe('coverage and the seeded choice', () => {
  it('counts the continuations of a prefix per item from the attempt log', () => {
    const log = [rec('x', ['e1-f1', 'g5-e7', 'h6-f7']), rec('x', ['e1-f1', 'g5-e7']), rec('x', ['e1-f1', 'f9-f8']), rec('y', ['e1-f1', 'd7-e8']), { ...rec('x', []), path: 'bad' } as unknown as AttemptRecord];
    expect(coverageCounts(log, 'x', ['e1-f1'])).toEqual(new Map([['g5-e7', 2], ['f9-f8', 1]]));
    expect(coverageCounts(log, 'x', [])).toEqual(new Map([['e1-f1', 3]]));
    expect(coverageCounts(log, undefined, []).size).toBe(0);
  });

  it('meets unseen replies first, then is deterministic per seed and weighted', () => {
    const items = ['a', 'b', 'c'];
    expect(chooseByCoverage(items, (s) => s, new Map([['a', 1], ['b', 1]]), 7)).toBe('c');
    expect(chooseByCoverage(items, (s) => s, new Map([['a', 2], ['b', 1], ['c', 1]]), 7)).not.toBe('a');
    for (let seed = 0; seed < 20; seed++) expect(chooseByCoverage(items, (s) => s, new Map(), seed)).toBe(chooseByCoverage(items, (s) => s, new Map(), seed));
    // Weight 0 counts as 1; a heavy weight wins most seeds.
    let heavy = 0;
    for (let seed = 0; seed < 200; seed++) if (chooseByCoverage(items, (s) => s, new Map(), seed, (s) => (s === 'b' ? 50 : 0)) === 'b') heavy++;
    expect(heavy).toBeGreaterThan(170);
  });

  it('across attempts every authored deviation is met before any repeats; tests play the main reply', () => {
    const opp = forcedLineFixture().root.next!['e1-f1'] as LineOpponentNode;
    const log: AttemptRecord[] = [];
    const met: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = chooseReply(opp, { counts: coverageCounts(log, 'e01l1-02', ['e1-f1']), seed: 1234 + i, ply: 1 });
      met.push(r.move);
      log.push(rec('e01l1-02', ['e1-f1', r.move]));
    }
    expect(met.sort()).toEqual(['d7-e8', 'f9-f8', 'g5-e7']);
    expect(chooseReply(opp, { counts: new Map(), seed: 99, ply: 1, fixed: true }).move).toBe('g5-e7');
  });
});

describe('credit (03 §3.2 line row)', () => {
  it('1 when every first answer is accepted, 0 after an error, per-node only with partial', () => {
    expect(lineCredit({}, ['target', 'sound'])).toBe(1);
    expect(lineCredit({}, ['target', 'dubious'])).toBe(0);
    expect(lineCredit({ partial: true }, ['target', 'dubious'])).toBe(0.75);
    expect(lineCredit({ partial: true }, ['target', 'error'])).toBe(0);
    expect(lineCredit({ partial: true }, ['target', 'target'], true)).toBe(0);
  });
});

describe('goals, tree facts and the S2.12 bridge', () => {
  it('decides checkmate and material goals from the position', () => {
    const ex = forcedLineFixture();
    const start = positionOf(ex);
    const line = ['e1-f1', 'f9-f8', 'h6-f5'].map(mv);
    expect(staticGoalMet({ kind: 'checkmate' }, start, line, 'red')).toBe(true);
    expect(staticGoalMet({ kind: 'checkmate' }, start, line.slice(0, 1), 'red')).toBe(false);
    expect(staticGoalMet({ kind: 'material', gain: 1 }, start, line, 'red')).toBe(false);
    expect(staticGoalMet({ kind: 'end' }, start, [], 'red')).toBe(true);
    expect(staticGoalMet({ kind: 'predicate', predicate: { kind: 'reach', piece: 'e1', squares: ['f1'] } }, start, [], 'red')).toBeNull();
  });

  it('reports node selectivity, the stored depth and the scripted-partner script', () => {
    const stats = learnerNodeStats(forcedLineFixture());
    expect(stats.map((s) => s.path.join(' '))).toEqual(['', 'e1-f1 g5-e7', 'e1-f1 d7-e8', 'e1-f1 f9-f8']);
    expect(stats[0]).toMatchObject({ moves: 16, guardPassing: 16, credited: 1, selective: true });
    expect(lineDepth(forcedLineFixture())).toBe(2);
    expect(lineDepth(quietLineFixture())).toBe(1);
    expect(lineScript(forcedLineFixture()).replies).toEqual({ e1f1: ['g5e7', 'd7e8', 'f9f8'] });
  });
});

describe('analyzerLineJudge (direct analyzer, as in scripts)', () => {
  const judge = analyzerLineJudge(() => Promise.resolve(directAnalyzer()));
  const q = quietLineFixture();
  const pos = positionOf(q);

  it('classes off-tree moves by the default class of 04 §5.4', async () => {
    const spec = { itemId: q.id };
    expect(await judge.classify(pos, mv('i0-i5'), spec, q.objective)).toBe('error');
    expect(await judge.classify(pos, mv('b0-c2'), spec, q.objective)).toBe('target');
    expect(await judge.classify(pos, mv('b0-a2'), spec, q.objective)).toBe('dubious');
    expect(await judge.classify(pos, mv('b0-c2'), spec)).toBe('dubious');
  });

  it('a node limit gives not-checked, never a verdict', async () => {
    const tiny = analyzerLineJudge(() => Promise.resolve(directAnalyzer({ maxBudget: 1 })));
    expect(await tiny.classify(pos, mv('b0-c2'), { itemId: q.id }, q.objective)).toBe('not-checked');
  });

  it('hands over to the named partner, deterministic per seed', async () => {
    const moves = [mv('i0-g0')];
    const a = await judge.partnerMove({ start: pos, moves, learner: 'red', partner: [{ kind: 'safe-sparring', d: 1 }], seed: 5 });
    const b = await judge.partnerMove({ start: pos, moves, learner: 'red', partner: [{ kind: 'safe-sparring', d: 1 }], seed: 5 });
    expect(a).not.toBeNull();
    expect(a).toEqual(b);
    expect(legalMoves(makeMove(pos, moves[0])).map(moveKey)).toContain(moveKey(a!.move));
    expect(a!.policy).toContain('safe-sparring');
  });

  it('evaluates predicate goals through the analyzer', async () => {
    const goal = { kind: 'predicate' as const, predicate: { kind: 'reach' as const, piece: 'b0', squares: ['c2'] } };
    expect(await judge.goal(goal, pos, [mv('b0-c2')], 'red')).toBe(true);
    expect(await judge.goal(goal, pos, [mv('b0-a2')], 'red')).toBe(false);
  });
});

describe('varied defence (02 e01, VAR)', () => {
  const ex = variedComboFixture();
  const pos = makeMove(positionOf(ex), mv('e1-f1'));

  it('picks among all best replies, unseen first; the default reply is unchanged', () => {
    const best = bestCombinationReplies(ex, pos, 1).map(moveKey).sort();
    expect(best).toEqual(['d7-e8', 'f9-f8', 'g5-e7']);
    const seen = new Map([['f9-f8', 1], ['g5-e7', 1]]);
    expect(moveKey(variedCombinationReply(ex, 1, pos, { seed: 3, counts: seen }))).toBe('d7-e8');
    const replies = new Set<string>();
    for (let seed = 0; seed < 30; seed++) replies.add(moveKey(variedCombinationReply(ex, 1, pos, { seed, counts: new Map() })));
    expect([...replies].sort()).toEqual(best);
    // Without the flag the player still uses the stored main line.
    expect(combinationReply(variedComboFixture(false), 1, pos, true)).toEqual({ from: parseSquare('f9'), to: parseSquare('f8') });
  });
});

describe('varied defence never walks into a quicker mate (attempt 2)', () => {
  // u13l2#3 (legacy mate in 3) after 1. Rd5-d7: `bestCombinationReplies` (fewest winning answers) mixes 2 replies that
  // hold out to mate in 2 with 7 that allow mate in 1; varied defence chooses only among the longest-resistance ones.
  const ex = {
    type: 'combination',
    pieces: { b5: 'P', c9: 'b', d1: 'K', d5: 'R', d7: 'a', d8: 'R', e1: 'A', e8: 'c', e9: 'k', f2: 'A', f9: 'r', g0: 'B', g7: 'P', g9: 'n', h8: 'P', i7: 'b' },
    prompt: 'u3l1.e1',
    goal: 'checkmate',
    moves: 3,
    solution: [],
    variedDefence: true,
  } as unknown as CombinationExercise;
  const pos = makeMove(positionOf(ex), mv('d5-d7'));

  it('chooses only among the replies of the longest mate distance', () => {
    expect(bestCombinationReplies(ex, pos, 1).length).toBe(9);
    expect(variedDefenceReplies(ex, pos, 1).map(moveKey).sort()).toEqual(['e8-f8', 'e8-g8']);
    for (let seed = 0; seed < 20; seed++) expect(['e8-f8', 'e8-g8']).toContain(moveKey(variedCombinationReply(ex, 1, pos, { seed, counts: new Map() })));
  });
});
