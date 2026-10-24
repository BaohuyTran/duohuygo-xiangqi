// TEST-ONLY fixtures for `line` trees and varied-defence combinations (S2.8). Imported by *.test.ts(x) files and
// scripts/verify-lines.ts (`--fixtures`), never by app code. The positions are original (random positions kept only
// when the solver proved the pattern); the texts reuse existing i18n keys (pilot content comes in S2.14+).
//
// FORCED (e01l1-02, Expert guard h 2 / k 2): Red mates in 2 against every defence. 1. Ce1-f1 (the only winning move);
// Black has exactly three replies, all authored: g5-e7 and d7-e8 (answered by Hh6-f7 mate) and f9-f8 (Hh6-f5 mate).
// QUIET (b09l3-07, Basic guard): the decision fixture's position as a line. Hb0-c2 (target) continues to two authored
// replies and an `end` leaf; Ri0-g0 (sound) has no continuation, so it leaves the tree and hands over to
// safe-sparring(1) for two learner moves, whose moves get the default class (objective: develop the b0 Horse).
import type { CombinationExercise, LineExercise, MoveTableEntry, Unit } from '../content/types';
import { decisionFixture, DECISION_PIECES } from './test-fixtures';

export const FORCED_PIECES = { e2: 'K', f9: 'k', h6: 'N', e1: 'C', d7: 'a', g5: 'b' } as const;

const ROOT: MoveTableEntry[] = [
  {move: 'e1-f1', class: 'target', source: 'authored', reason: 'u2l1.e1'},
  {move: 'e1-g1', class: 'dubious', source: 'computed'},
  {move: 'e1-h1', class: 'dubious', source: 'computed'},
  {move: 'e1-i1', class: 'dubious', source: 'computed'},
  {move: 'e1-d1', class: 'dubious', source: 'computed'},
  {move: 'e1-c1', class: 'dubious', source: 'computed'},
  {move: 'e1-b1', class: 'dubious', source: 'computed'},
  {move: 'e1-a1', class: 'dubious', source: 'computed'},
  {move: 'e1-e0', class: 'dubious', source: 'computed'},
  {move: 'e2-d2', class: 'dubious', source: 'computed'},
  {move: 'h6-i8', class: 'dubious', source: 'computed'},
  {move: 'h6-g8', class: 'dubious', source: 'computed'},
  {move: 'h6-i4', class: 'dubious', source: 'computed'},
  {move: 'h6-g4', class: 'dubious', source: 'computed'},
  {move: 'h6-f7', class: 'dubious', source: 'computed'},
  {move: 'h6-f5', class: 'dubious', source: 'computed'},
];
const GE7: MoveTableEntry[] = [
  {move: 'f1-g1', class: 'dubious', source: 'computed'},
  {move: 'f1-h1', class: 'dubious', source: 'computed'},
  {move: 'f1-i1', class: 'dubious', source: 'computed'},
  {move: 'f1-e1', class: 'dubious', source: 'computed'},
  {move: 'f1-d1', class: 'dubious', source: 'computed'},
  {move: 'f1-c1', class: 'dubious', source: 'computed'},
  {move: 'f1-b1', class: 'dubious', source: 'computed'},
  {move: 'f1-a1', class: 'dubious', source: 'computed'},
  {move: 'f1-f2', class: 'dubious', source: 'computed'},
  {move: 'f1-f3', class: 'dubious', source: 'computed'},
  {move: 'f1-f4', class: 'dubious', source: 'computed'},
  {move: 'f1-f5', class: 'dubious', source: 'computed'},
  {move: 'f1-f6', class: 'dubious', source: 'computed'},
  {move: 'f1-f7', class: 'dubious', source: 'computed'},
  {move: 'f1-f8', class: 'error', source: 'computed'},
  {move: 'f1-f0', class: 'dubious', source: 'computed'},
  {move: 'e2-d2', class: 'dubious', source: 'computed'},
  {move: 'e2-e1', class: 'dubious', source: 'computed'},
  {move: 'h6-i8', class: 'dubious', source: 'computed'},
  {move: 'h6-g8', class: 'dubious', source: 'computed'},
  {move: 'h6-i4', class: 'dubious', source: 'computed'},
  {move: 'h6-g4', class: 'dubious', source: 'computed'},
  {move: 'h6-f7', class: 'target', source: 'authored', reason: 'u2l1.e2'},
  {move: 'h6-f5', class: 'dubious', source: 'authored', reason: 'u2l1.e3'},
];
const DE8: MoveTableEntry[] = [
  {move: 'f1-g1', class: 'dubious', source: 'computed'},
  {move: 'f1-h1', class: 'dubious', source: 'computed'},
  {move: 'f1-i1', class: 'dubious', source: 'computed'},
  {move: 'f1-e1', class: 'dubious', source: 'computed'},
  {move: 'f1-d1', class: 'dubious', source: 'computed'},
  {move: 'f1-c1', class: 'dubious', source: 'computed'},
  {move: 'f1-b1', class: 'dubious', source: 'computed'},
  {move: 'f1-a1', class: 'dubious', source: 'computed'},
  {move: 'f1-f2', class: 'dubious', source: 'computed'},
  {move: 'f1-f3', class: 'dubious', source: 'computed'},
  {move: 'f1-f4', class: 'dubious', source: 'computed'},
  {move: 'f1-f5', class: 'dubious', source: 'computed'},
  {move: 'f1-f6', class: 'dubious', source: 'computed'},
  {move: 'f1-f7', class: 'error', source: 'computed'},
  {move: 'f1-f8', class: 'error', source: 'computed'},
  {move: 'f1-f0', class: 'dubious', source: 'computed'},
  {move: 'e2-d2', class: 'dubious', source: 'computed'},
  {move: 'e2-e1', class: 'dubious', source: 'computed'},
  {move: 'h6-i8', class: 'dubious', source: 'computed'},
  {move: 'h6-g8', class: 'dubious', source: 'computed'},
  {move: 'h6-i4', class: 'dubious', source: 'computed'},
  {move: 'h6-g4', class: 'dubious', source: 'computed'},
  {move: 'h6-f7', class: 'target', source: 'authored', reason: 'u2l1.e2'},
  {move: 'h6-f5', class: 'dubious', source: 'authored', reason: 'u2l1.e3'},
];
const FF8: MoveTableEntry[] = [
  {move: 'f1-g1', class: 'dubious', source: 'computed'},
  {move: 'f1-h1', class: 'dubious', source: 'computed'},
  {move: 'f1-i1', class: 'dubious', source: 'computed'},
  {move: 'f1-e1', class: 'dubious', source: 'computed'},
  {move: 'f1-d1', class: 'dubious', source: 'computed'},
  {move: 'f1-c1', class: 'dubious', source: 'computed'},
  {move: 'f1-b1', class: 'dubious', source: 'computed'},
  {move: 'f1-a1', class: 'dubious', source: 'computed'},
  {move: 'f1-f2', class: 'dubious', source: 'computed'},
  {move: 'f1-f3', class: 'dubious', source: 'computed'},
  {move: 'f1-f4', class: 'dubious', source: 'computed'},
  {move: 'f1-f5', class: 'dubious', source: 'computed'},
  {move: 'f1-f6', class: 'dubious', source: 'computed'},
  {move: 'f1-f7', class: 'dubious', source: 'computed'},
  {move: 'f1-f0', class: 'dubious', source: 'computed'},
  {move: 'e2-d2', class: 'dubious', source: 'computed'},
  {move: 'e2-e1', class: 'dubious', source: 'computed'},
  {move: 'h6-i8', class: 'dubious', source: 'computed'},
  {move: 'h6-g8', class: 'dubious', source: 'computed'},
  {move: 'h6-i4', class: 'dubious', source: 'computed'},
  {move: 'h6-g4', class: 'dubious', source: 'computed'},
  {move: 'h6-f7', class: 'error', source: 'authored', reason: 'u2l1.e4'},
  {move: 'h6-f5', class: 'target', source: 'authored', reason: 'u2l1.e2'},
];

const meta = (id: string, side: 'red' | 'black' = 'red') => ({
  id,
  version: 1,
  status: 'draft' as const,
  source: { kind: 'authored' as const },
  side,
  strand: 'TC' as const,
  nature: 'tactic' as const,
  critical: false,
  misconceptions: ['e01.m1', 'e01.m2'],
});

// structuredClone: every call returns fresh tables, so a test may mutate its copy.
export const forcedLineFixture = (): LineExercise =>
  structuredClone<LineExercise>({
  type: 'line',
  ...meta('e01l1-02'),
  assist: 'G0',
  pieces: { ...FORCED_PIECES },
  prompt: 'u3l1.e1',
  root: {
    kind: 'learner',
    table: ROOT,
    alternatives: false,
    claim: { kind: 'mate', moves: 2 },
    hints: { idea: 'u3l1.e4', move: 'e1-f1' },
    next: {
      'e1-f1': {
        kind: 'opponent',
        replies: [
          {
            move: 'g5-e7',
            text: 'u3l1.e5',
            next: { kind: 'learner', table: GE7, alternatives: false, claim: { kind: 'mate', moves: 1 }, next: { 'h6-f7': { kind: 'leaf', goal: { kind: 'checkmate' }, text: 'u3l1.e6' } } },
          },
          {
            move: 'd7-e8',
            text: 'u3l1.e2',
            next: { kind: 'learner', table: DE8, alternatives: false, claim: { kind: 'mate', moves: 1 }, next: { 'h6-f7': { kind: 'leaf', goal: { kind: 'checkmate' } } } },
          },
          {
            move: 'f9-f8',
            weight: 2,
            text: 'u3l1.e3',
            next: { kind: 'learner', table: FF8, alternatives: false, claim: { kind: 'mate', moves: 1 }, next: { 'h6-f5': { kind: 'leaf', goal: { kind: 'checkmate' } } } },
          },
        ],
      },
    },
  },
  feedback: {
    purpose: 'u2l1.e1',
    keyReply: 'u2l1.e2',
    commonError: 'u2l1.e3',
    temptingAlternative: { move: 'h6-f7', text: 'u2l1.e4' },
  },
  });

export const quietLineFixture = (): LineExercise => {
  const d = decisionFixture();
  return {
    type: 'line',
    ...meta('b09l3-07'),
    strand: 'OD',
    nature: 'quiet',
    misconceptions: d.misconceptions,
    assist: 'G1',
    pieces: { ...DECISION_PIECES },
    prompt: 'u3l1.e1',
    objective: d.objective,
    root: {
      kind: 'learner',
      table: d.table,
      hints: d.hints,
      next: {
        'b0-c2': {
          kind: 'opponent',
          replies: [
            { move: 'h7-h1', text: 'u3l1.e5', next: { kind: 'leaf', goal: { kind: 'end' }, text: 'u3l1.e6' } },
            { move: 'b5-b2', weight: 2, next: { kind: 'leaf', goal: { kind: 'end' } } },
          ],
        },
      },
    },
    handOver: { partner: [{ kind: 'safe-sparring', d: 1 }], moves: 2 },
    feedback: d.feedback,
  };
};

/** The FORCED position as a mate-in-2 combination with varied defence (all three replies are best defences). */
export const variedComboFixture = (variedDefence = true): CombinationExercise => ({
  type: 'combination',
  ...meta('e01l1-03'),
  pieces: { ...FORCED_PIECES },
  prompt: 'u3l1.e1',
  goal: 'checkmate',
  moves: 2,
  solution: [
    { from: 'e1', to: 'f1' },
    { from: 'f9', to: 'f8' },
    { from: 'h6', to: 'f5' },
  ],
  variedDefence,
});

/** A one-lesson new-course unit around the given items (`e01` Expert or `b09` Basic). */
export const lineUnit = (unit: 'e01' | 'b09', ...exercises: unknown[]): Unit[] =>
  [
    {
      id: unit,
      track: unit === 'e01' ? 'expert' : 'basics',
      title: 'u1.title',
      description: 'u1.desc',
      lessons: [{ id: unit === 'e01' ? 'e01l1' : 'b09l3', title: 'u1l1.title', exercises }],
    },
  ] as unknown as Unit[];
