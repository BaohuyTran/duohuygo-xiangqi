// Validator rules of `line` items and varied-defence combinations (S2.8; 04-architecture.md §5.2, 07-sourcing.md §4.1).
import { describe, expect, it } from 'vitest';
import type { CombinationExercise, LineExercise, LineLearnerNode, LineOpponentNode } from './types';
import { validateContent } from './validate';
import { gameStatus, isInCheck, makeMove } from '../engine';
import { positionOf } from '../lessons/answers';
import { parseMoveKey } from '../lessons/decision';
import { proposeMoveTable } from '../lessons/decision-table';
import { resolveGuard } from '../lessons/guard';
import { forcedLineFixture, lineUnit, quietLineFixture, variedComboFixture } from '../lessons/line-fixtures';

const errorsOf = (unit: 'e01' | 'b09', ex: unknown) => validateContent(lineUnit(unit, ex)).errors;
const forced = () => forcedLineFixture();
const firstOpp = (ex: LineExercise) => ex.root.next![Object.keys(ex.root.next!)[0]] as LineOpponentNode;

describe('line validation', () => {
  it('accepts both fixtures (forced claims, deviations, hand-over)', () => {
    expect(errorsOf('e01', forced())).toEqual([]);
    expect(errorsOf('b09', quietLineFixture())).toEqual([]);
  });

  it('every opponent branch reaches a leaf', () => {
    const ex = forced();
    delete (firstOpp(ex).replies[0] as Partial<{ next: unknown }>).next;
    expect(errorsOf('e01', ex).join('\n')).toMatch(/replies\[0\] needs "next".*every branch must reach a leaf/);
    const ex2 = forced();
    delete ex2.root.next;
    expect(errorsOf('e01', ex2).join('\n')).toMatch(/no accepted move continues the line/);
  });

  it('nodes are legal and of the right side', () => {
    const ex = forced();
    firstOpp(ex).replies[0].move = 'g5-g6';
    expect(errorsOf('e01', ex).join('\n')).toMatch(/replies\[0\]\.move "g5-g6" is not a legal move/);
    const ex2 = forced();
    (ex2.root.next as Record<string, unknown>)['e1-f1'] = (firstOpp(ex2).replies[0].next as LineLearnerNode);
    expect(errorsOf('e01', ex2).join('\n')).toMatch(/must lead to an opponent node or a leaf/);
  });

  it('learner nodes follow the decision table rules (complete table, drift)', () => {
    const ex = forced();
    const node = firstOpp(ex).replies[2].next as LineLearnerNode;
    node.table = node.table.slice(1);
    expect(errorsOf('e01', ex).join('\n')).toMatch(/root>e1-f1>f9-f8: table is incomplete/);
    const ex2 = forced();
    const row = ex2.root.table.find((r) => r.move === 'e1-g1')!;
    row.class = 'error';
    expect(errorsOf('e01', ex2).join('\n')).toMatch(/e1-g1: drift/);
  });

  it('forced claims are proven for every defence', () => {
    const ex = forced();
    ex.root.claim = { kind: 'mate', moves: 1 };
    expect(errorsOf('e01', ex).join('\n')).toMatch(/claim: the learner has no forced mate in 1/);
    // A claimed mate where an accepted move does not keep it against every defence.
    const ex2 = forced();
    const row = ex2.root.table.find((r) => r.move === 'e1-g1')!;
    Object.assign(row, { class: 'sound', source: 'authored', reason: 'u2l1.e1' });
    ex2.root.alternatives = true;
    expect(errorsOf('e01', ex2).join('\n')).toMatch(/e1-g1 is accepted but does not keep the forced mate in 2 against every defence/);
  });

  it('authored replies must pass the safety guard', () => {
    const ex = quietLineFixture();
    firstOpp(ex).replies.push({ move: 'b5-b4', next: { kind: 'leaf', goal: { kind: 'end' } } });
    expect(errorsOf('b09', ex).join('\n')).toMatch(/the authored reply b5-b4 fails the safety guard \(loses 4\.5 points/);
  });

  it('leaf goals must hold on the stored path', () => {
    const ex = quietLineFixture();
    (firstOpp(ex).replies[0].next as { goal: unknown }).goal = { kind: 'checkmate' };
    expect(errorsOf('b09', ex).join('\n')).toMatch(/leaf "checkmate": the opponent is not mated/);
  });

  it('no position may repeat on a stored line (07 §4.1)', () => {
    const ex = quietLineFixture();
    // Ri0-g0 Ke9-e8 Rg0-i0 Ke8-e9 returns to the start position.
    const back: LineLearnerNode = {
      kind: 'learner',
      table: [{ move: 'g0-i0', class: 'target', source: 'authored', reason: 'u2l1.e1' }],
      next: { 'g0-i0': { kind: 'opponent', replies: [{ move: 'e8-e9', next: { kind: 'leaf', goal: { kind: 'end' } } }] } },
    };
    ex.root.next!['i0-g0'] = { kind: 'opponent', replies: [{ move: 'e9-e8', next: back }] };
    expect(errorsOf('b09', ex).join('\n')).toMatch(/root>i0-g0>e9-e8>g0-i0>e8-e9: repeats a position of the stored line/);
  });

  it('checks the hand-over partners and goal', () => {
    const ex = quietLineFixture();
    ex.handOver = { partner: [{ kind: 'pressing', d: 4 } as never, { kind: 'greedy' } as never], moves: 0 };
    const text = errorsOf('b09', ex).join('\n');
    expect(text).toMatch(/handOver\.partner\[0\]\.d" must be an integer 1–3/);
    expect(text).toMatch(/handOver\.partner\[1\]\.kind" must be one of/);
    expect(text).toMatch(/handOver\.moves" must be an integer 1–20/);
  });

  it('a line needs "assist" and, at G1/G0/TR, a tempting alternative the root rejects', () => {
    const ex = forced();
    delete ex.assist;
    expect(errorsOf('e01', ex).join('\n')).toMatch(/"assist".*is required on a "line" item/);
    const ex2 = forced();
    ex2.feedback!.temptingAlternative.move = 'e1-f1';
    expect(errorsOf('e01', ex2).join('\n')).toMatch(/is accepted by the item/);
  });
});

describe('varied defence validation', () => {
  it('accepts the flag where the defender has several best replies, and rejects it where nothing varies', () => {
    expect(validateContent(lineUnit('e01', variedComboFixture())).errors).toEqual([]);
    const ex = { ...variedComboFixture(), variedDefence: 'yes' } as unknown as CombinationExercise;
    expect(validateContent(lineUnit('e01', ex)).errors.join('\n')).toMatch(/"variedDefence" must be true or false/);
  });
});

describe('forced claims class every winning move (attempt 2)', () => {
  // Two Chariots against a bare General: several moves mate at once (a8-a9, i8-i9, …).
  const fen = '4k4/R7R/9/9/9/9/9/9/9/3K5 w - - 0 1';
  const lineWith = (mates: 'dubious' | 'target'): LineExercise => {
    const pos = positionOf({ fen });
    const guard = resolveGuard({ itemId: 'e01l1-02' });
    const table = proposeMoveTable(pos, guard).map(({ move, class: cls }) => {
      const mating = gameStatus(makeMove(pos, parseMoveKey(move)!)).kind === 'checkmate';
      if (move === 'a8-a9') return { move, class: 'target' as const, source: 'authored' as const, reason: 'u2l1.e1' };
      if (mating) return { move, class: mates, source: 'authored' as const, reason: 'u2l1.e2' };
      const check = isInCheck(makeMove(pos, parseMoveKey(move)!));
      return check ? { move, class: 'dubious' as const, source: 'authored' as const, reason: 'u2l1.e3' } : { move, class: cls, source: 'computed' as const };
    });
    return {
      ...forced(),
      pieces: undefined as never,
      fen,
      feedback: undefined,
      assist: 'G2',
      root: { kind: 'learner', table, alternatives: false, claim: { kind: 'mate', moves: 1 }, next: { 'a8-a9': { kind: 'leaf', goal: { kind: 'checkmate' } } } },
    } as LineExercise;
  };

  it('refuses a mate claim whose table rejects another mating move, and alternatives: false with several', () => {
    const text = errorsOf('e01', lineWith('dubious')).join('\n');
    expect(text).toMatch(/i8-i9 does keep the forced mate in 1 against every defence but the table classes it "dubious"/);
    expect(text).toMatch(/"alternatives": false, but \d+ moves keep the forced mate in 1/);
  });

  it('a forced line\'s main reply must be a best defence (longest mate distance)', () => {
    // u13l2#3 (legacy, mate in 3): after Rd5-d7 two replies hold out to mate in 2, seven allow mate in 1.
    const pieces = { b5: 'P', c9: 'b', d1: 'K', d5: 'R', d7: 'a', d8: 'R', e1: 'A', e8: 'c', e9: 'k', f2: 'A', f9: 'r', g0: 'B', g7: 'P', g9: 'n', h8: 'P', i7: 'b' };
    const ex = {
      ...forced(),
      pieces,
      feedback: undefined,
      assist: 'G2',
      root: {
        kind: 'learner',
        table: [{ move: 'd5-d7', class: 'target', source: 'authored', reason: 'u2l1.e1' }],
        claim: { kind: 'mate', moves: 3 },
        next: { 'd5-d7': { kind: 'opponent', replies: [{ move: 'f9-f2', next: { kind: 'leaf', goal: { kind: 'end' } } }] } },
      },
    } as unknown as LineExercise;
    const text = errorsOf('e01', ex).join('\n');
    expect(text).toMatch(/replies\[0\] f9-f2 \(the main reply, played in tests\) is not a best defence/);
    (((ex.root.next!['d5-d7'] as LineOpponentNode).replies[0]) as { move: string }).move = 'e8-f8';
    expect(errorsOf('e01', ex).join('\n')).not.toMatch(/is not a best defence/);
  }, 120_000);
});
