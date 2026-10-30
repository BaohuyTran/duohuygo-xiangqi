import { describe, expect, it } from 'vitest';
import { validateUnits } from '../content/validate';
import type { LineLearnerNode, PlayExercise, ReviewExercise } from '../content/types';
import { positionFromPieces } from '../engine';
import { allPlayFixtures, authorTable, convertFixture, gameFixture, holdFixture, HOLD_PIECES, openingFixture, playUnits, reviewFixture } from './play-fixtures';

const errors = (...items: unknown[]) => validateUnits(playUnits(...items)).join('\n');

describe('validator: play tasks and reviews (S2.12)', () => {
  it('accepts every fixture', () => {
    for (const f of allPlayFixtures()) expect(errors(f)).toBe('');
  }, 120_000);

  it('checks rubric weights and the facts each rubric needs', () => {
    const hold = holdFixture();
    expect(errors({ ...hold, rubrics: [{ rubric: 'R5', weight: 60 }, { rubric: 'R1', weight: 30 }] })).toMatch(/sum to 100/);
    expect(errors({ ...hold, holding: undefined })).toMatch(/R5 needs a "holding" predicate/);
    expect(errors({ ...hold, rubrics: [{ rubric: 'R7', weight: 100 }] })).toMatch(/R7 is the review task/);
    const opening = openingFixture();
    expect(errors({ ...opening, lineShare: undefined })).toMatch(/need "lineShare"/);
    expect(errors({ ...opening, lineShare: 4 })).toMatch(/"lineShare" must be an integer 6–30/);
    expect(errors({ ...opening, rubrics: [{ rubric: 'R3', weight: 100 }], objective: { kind: 'threat', created: true } })).toMatch(/own-side predicates/);
    expect(errors({ ...hold, f2b: true })).toMatch(/only on "game" tasks/);
    expect(errors({ ...gameFixture(), development: undefined })).toMatch(/need "development"/);
    expect(errors({ ...hold, cap: 0 })).toMatch(/"cap" must be an integer 1–80/);
  });

  it('hold and convert tasks need a verified threat of the opponent at the start', () => {
    const quiet = { ...holdFixture(), tree: undefined, pieces: { e0: 'K', d0: 'A', a2: 'R', f9: 'k', d7: 'n' } };
    expect(errors(quiet)).toMatch(/start from a verified threat/);
    expect(errors(convertFixture())).toBe('');
  });

  it('"measured" (resist mode at 3) only on convert tasks of ≤ 12 pieces', () => {
    expect(errors({ ...holdFixture(), measured: true })).toMatch(/only on "convert"/);
    expect(errors({ ...convertFixture(), measured: true })).toBe('');
  });

  it('F1 scoring-leaf rule: every accepted tree move continues or ends in a leaf, leaves only at selective nodes, leaves reach the pass mark', () => {
    const hold = holdFixture();
    const start = positionFromPieces({ ...HOLD_PIECES }, 'red');
    // Every guard-passing move accepted with a leaf: the node is not selective.
    const table = authorTable(start, hold.id!, undefined, {});
    const passing = table.filter((r) => r.class !== 'error').map((r) => r.move);
    const all: LineLearnerNode = {
      kind: 'learner',
      table: table.map((r) => (r.class === 'error' ? r : { move: r.move, class: 'target', source: 'authored', reason: 'u2l1.e1' })),
      next: Object.fromEntries(passing.map((m) => [m, { kind: 'leaf', goal: { kind: 'end' } }])),
    };
    expect(errors({ ...hold, tree: all })).toMatch(/scoring leaf at a non-selective node/);
    // An accepted move without a continuation.
    const missing: LineLearnerNode = { ...hold.tree!, next: { 'c5-c6': { kind: 'leaf', goal: { kind: 'end' } } } };
    expect(errors({ ...hold, tree: missing })).toMatch(/F1 needs a continuation or a scoring leaf for every accepted move; c5-a5 has none/);
    // A leaf that does not reach the pass mark (no holding predicate met: "no own piece hanging" replaced by an impossible one).
    const strict: PlayExercise = { ...hold, rubrics: [{ rubric: 'R5', weight: 100 }], holding: { predicate: { kind: 'palace-defenders', min: 4 } } };
    expect(errors(strict)).toMatch(/the scoring leaf scores 70 < 75/);
  });

  it('F1: a leaf after an authored reply is scored on the position after the reply (pass mark, selectivity)', () => {
    const hold = holdFixture();
    const replyLeaf: LineLearnerNode = {
      ...hold.tree!,
      next: {
        'c5-c6': { kind: 'leaf', goal: { kind: 'end' } },
        'c5-a5': { kind: 'opponent', replies: [{ move: 'd7-c5', next: { kind: 'leaf', goal: { kind: 'end' } } }] },
      },
    };
    expect(errors({ ...hold, tree: replyLeaf })).toBe('');
    const strict: PlayExercise = { ...hold, tree: replyLeaf, rubrics: [{ rubric: 'R5', weight: 100 }], holding: { predicate: { kind: 'palace-defenders', min: 4 } } };
    expect(errors(strict)).toMatch(/root>c5-a5>d7-c5: the scoring leaf scores 70 < 75/);
  });

  it('R1 is never the only rubric; opening tasks keep R6 under F5', () => {
    expect(errors({ ...holdFixture(), rubrics: [{ rubric: 'R1', weight: 100 }], holding: undefined })).toMatch(/R1 must be paired/);
    expect(errors({ ...openingFixture(), rubrics: [{ rubric: 'R1', weight: 50 }, { rubric: 'R0', weight: 50 }] })).toMatch(/opening tasks need R6/);
  });

  it('reviews list every top turning point (ties at the cutoff included)', () => {
    const r = reviewFixture();
    // Red's third move a0-a1 is a second serious allowed loss (deduction 50, tied with h2-h5).
    const two: ReviewExercise = { ...r, moves: ['h0-g2', 'h9-g7', 'h2-h5', 'g7-h5', 'a0-a1', 'b9-c7'] };
    expect(errors(two)).toMatch(/ply 4 \(deduction 50\) is one of the top turning points: list it/);
  }, 60_000);

  it('reviews: legal game, learner-move turning points with the detected category, largest first, the game move not accepted', () => {
    const r = reviewFixture();
    expect(errors({ ...r, moves: [...r.moves.slice(0, 2), 'a0-a9'] })).toMatch(/moves\[2\] "a0-a9" is not a legal move/);
    expect(errors({ ...r, turningPoints: [{ ...r.turningPoints[0], category: 'missed-mate' }] })).toMatch(/detect "allowed-loss" at ply 2, not "missed-mate"/);
    expect(errors({ ...r, turningPoints: [{ ...r.turningPoints[0], ply: 1 }] })).toMatch(/must index a learner move/);
    const tp = r.turningPoints[0];
    const accepted: ReviewExercise = { ...r, turningPoints: [{ ...tp, table: tp.table.map((row) => (row.move === 'h2-h5' ? { ...row, class: 'target', source: 'authored', reason: 'u2l1.e1' } : row)) }] };
    expect(errors(accepted)).toMatch(/h2-h5 must not be accepted|fails the safety guard/);
    // A smaller learner move listed while the big mistake is not: not the top turning points.
    const quietPly: ReviewExercise = { ...r, turningPoints: [{ ...tp, ply: 0, category: 'allowed-loss' }] };
    expect(errors(quietPly)).toMatch(/detect null at ply 0|larger than a listed turning point/);
  }, 60_000);
});
