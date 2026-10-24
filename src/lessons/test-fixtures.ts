// Fixture content for the tests of `decision`, `choice`, `select-squares` queries and goal `safe` (S2.7).
// Test-only: imported by *.test.ts(x) files, never by app code. No real new-course unit exists yet (pilot
// content comes in S2.14+), so the texts reuse existing i18n keys; the positions are original.
import type { ChoiceExercise, DecisionExercise, MoveExercise, Unit } from '../content/types';

/**
 * Red to move. Black threatens Rh7-h0 mate along the back rank, which the Chariot on i0 guards. The lesson
 * idea (objective): develop the Horse (its mobility rises by ≥ 2), i.e. Hb0-c2. Ri0-g0 is authored `sound`;
 * every Chariot move that leaves rank 0 except i9 allows the mate (`error`); Ri0-i9 (a check) is the tempting
 * move: safe, but it does nothing (`dubious`).
 */
export const DECISION_PIECES = { e0: 'K', e1: 'A', b0: 'N', i0: 'R', e9: 'k', b5: 'c', h7: 'r' } as const;

export const decisionFixture = (): DecisionExercise => ({
  type: 'decision',
  id: 'b09l3-04',
  version: 1,
  status: 'draft',
  source: { kind: 'authored' },
  side: 'red',
  strand: 'OD',
  nature: 'quiet',
  critical: false,
  misconceptions: ['b09.m1', 'b09.m2'],
  assist: 'G1',
  pieces: { ...DECISION_PIECES },
  prompt: 'u3l1.e1',
  objective: { kind: 'mobility', piece: 'b0', increaseBy: 2 },
  table: [
    { move: 'b0-c2', class: 'target', source: 'authored', reason: 'u2l1.e1' },
    { move: 'b0-a2', class: 'dubious', source: 'computed', misconception: 'b09.m1' },
    { move: 'b0-d1', class: 'dubious', source: 'computed' },
    { move: 'e0-f0', class: 'dubious', source: 'computed' },
    { move: 'e0-d0', class: 'dubious', source: 'computed' },
    { move: 'i0-h0', class: 'error', source: 'computed' },
    { move: 'i0-g0', class: 'sound', source: 'authored', reason: 'u3l1.e2' },
    { move: 'i0-f0', class: 'dubious', source: 'computed' },
    { move: 'i0-i1', class: 'error', source: 'computed', misconception: 'b09.m2' },
    { move: 'i0-i2', class: 'error', source: 'computed' },
    { move: 'i0-i3', class: 'error', source: 'computed' },
    { move: 'i0-i4', class: 'error', source: 'computed' },
    { move: 'i0-i5', class: 'error', source: 'computed' },
    { move: 'i0-i6', class: 'error', source: 'computed' },
    { move: 'i0-i7', class: 'error', source: 'computed' },
    { move: 'i0-i8', class: 'error', source: 'computed' },
    { move: 'i0-i9', class: 'dubious', source: 'authored', reason: 'u3l1.e3', misconception: 'b09.m2' },
  ],
  hints: { idea: 'u3l1.e4', move: 'b0-c2' },
  feedback: {
    purpose: 'u2l1.e1',
    keyReply: 'u2l1.e2',
    commonError: 'u2l1.e3',
    temptingAlternative: { move: 'i0-i9', text: 'u2l1.e4' },
  },
});

/** Same position, goal `safe`: any move that does not allow the back-rank mate. */
export const safeMoveFixture = (): MoveExercise => ({
  type: 'move',
  pieces: { ...DECISION_PIECES },
  prompt: 'u3l1.e1',
  goal: { kind: 'safe' },
  solution: { from: 'b0', to: 'c2' },
});

export const choiceFixture = (multi = false): ChoiceExercise => ({
  type: 'choice',
  id: 'b09l3-05',
  version: 2,
  status: 'draft',
  source: { kind: 'authored' },
  side: 'red',
  strand: 'RS',
  nature: 'quiet',
  critical: false,
  misconceptions: ['b09.m1', 'b09.m2'],
  assist: 'G0',
  pieces: { ...DECISION_PIECES },
  prompt: 'u3l1.e5',
  multi,
  options: [
    { id: 'a', move: 'b0-c2', correct: true, feedback: 'u2l1.e1' },
    { id: 'b', move: 'i0-i5', correct: false, feedback: 'u2l1.e2', misconception: 'b09.m2' },
    { id: 'c', text: 'u3l1.e2', correct: multi, feedback: 'u2l1.e3', ...(multi ? {} : { misconception: 'b09.m1' }) },
    { id: 'none', text: 'u3l1.e6', correct: false, feedback: 'u2l1.e4', misconception: 'b09.m1', fixed: true },
  ],
});

/** A one-lesson new-course unit around the given items (b09 = Basic: guard h 1, k 1, T 2). */
export const newCourseUnit = (...exercises: unknown[]): Unit[] =>
  [{ id: 'b09', track: 'basics', title: 'u1.title', description: 'u1.desc', lessons: [{ id: 'b09l3', title: 'u1l1.title', exercises }] }] as unknown as Unit[];

/** Square seen from the other side (rank r -> 9 − r), as in src/content/normalize.ts `swapColours`. */
const flip = (sq: string) => `${sq[0]}${9 - Number(sq[1])}`;
const flipMove = (m: string) => m.split('-').map(flip).join('-');

/** The colour-swapped twin of `decisionFixture`: Black to move, Black at the bottom. */
export const blackDecisionFixture = (): DecisionExercise => {
  const red = decisionFixture();
  const swapCase = (l: string) => (l === l.toUpperCase() ? l.toLowerCase() : l.toUpperCase());
  return {
    ...(red as DecisionExercise & { pieces: Record<string, string> }),
    id: 'b09l3-06',
    side: 'black',
    pieces: Object.fromEntries(Object.entries(DECISION_PIECES).map(([sq, l]) => [flip(sq), swapCase(l)])),
    turn: 'black',
    objective: { kind: 'mobility', piece: flip('b0'), increaseBy: 2 },
    table: red.table.map((r) => ({ ...r, move: flipMove(r.move) })),
    hints: { idea: 'u3l1.e4', move: flipMove('b0-c2') },
    feedback: { ...red.feedback!, temptingAlternative: { move: flipMove('i0-i9'), text: 'u2l1.e4' } },
  };
};
