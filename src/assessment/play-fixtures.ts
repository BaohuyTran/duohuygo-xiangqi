// TEST-ONLY practical-task fixtures (S2.12). Imported by *.test.ts(x) files and scripts/verify-practical.ts
// (`--fixtures`), never by app code. Positions are original (the reduced opening is the start position with six
// soldiers removed; CONVERT is the repository's own generated puzzle m2-13); texts reuse existing i18n keys (pilot
// content comes in S2.14+). The move tables are computed when the module loads (proposeMoveTable + the authored
// rows below), exactly as scripts/move-table.ts proposes them; the validator recomputes them.
//
// HOLD (b10l9-01, Basic): Black's Horse d7 and Soldier c6 attack the Red chariot c5. Two defences are accepted —
// Rc5xc6 and Rc5-a5 — each ending in a scoring leaf (F1). R5 70 % (holding: no own piece hanging at the end) + R1 30 %.
// OPENING (b10l9-02, Basic, F5): six learner nodes of development on the reduced board, two accepted moves each
// (selective), L = 6. R6 60 % + R1 40 %.
// DRILL (b10l9-03): the reduced board against safe-sparring, 6 moves, R1 70 % + R0 30 %.
// GAME (b10l9-04): a full game from the reduced board (F2 under the fallback).
// REVIEW (b10l9-05): a short authored game in which Red's second move, h2-h5, gives the Cannon to the g7 Horse.
// CONVERT (i10l9-01, Intermediate, F1c): Red mates in 2; Black threatens to win the Cannon. R4 80 % + R1 20 %.
import { SAFETY_GUARDS, type Predicate } from '../analysis';
import type { LineLearnerNode, LineLeaf, LineOpponentNode, MoveTableEntry, PlayExercise, ReviewExercise, Unit } from '../content/types';
import { makeMove, parseFen, positionFromPieces, type Position } from '../engine';
import { moveKey, parseMoveKey } from '../lessons/decision';
import { proposeMoveTable } from '../lessons/decision-table';
import { resolveGuard } from '../lessons/guard';

const REASON = 'u2l1.e1';

/** A complete table: the proposer's rows, with `accept` authored as given and every review row authored. */
export function authorTable(pos: Position, itemId: string, objective: Predicate | undefined, accept: Record<string, 'target' | 'sound'>): MoveTableEntry[] {
  const guard = resolveGuard({ itemId });
  return proposeMoveTable(pos, guard, objective).map((r) => {
    const decided = accept[r.move];
    if (decided) return { move: r.move, class: decided, source: 'authored', reason: REASON };
    if (r.notes.review) return { move: r.move, class: r.class, source: 'authored', reason: REASON };
    return { move: r.move, class: r.class, source: 'computed' };
  });
}

const meta = (id: string, side: 'red' | 'black' = 'red') => ({
  id,
  version: 1,
  status: 'draft' as const,
  source: { kind: 'authored' as const },
  side,
  strand: 'PP' as const,
  nature: 'quiet' as const,
  critical: false,
  misconceptions: [] as string[],
});

const after = (pos: Position, ...keys: string[]) => keys.reduce((p, k) => makeMove(p, parseMoveKey(k)!), pos);

// ---------- HOLD ----------

export const HOLD_PIECES = { e0: 'K', d0: 'A', c5: 'R', f9: 'k', d7: 'n', c6: 'p' } as const;

export function holdFixture(): PlayExercise {
  const id = 'b10l9-01';
  const start = positionFromPieces({ ...HOLD_PIECES }, 'red');
  const leaf: LineLeaf = { kind: 'leaf', goal: { kind: 'end' } };
  const tree: LineLearnerNode = {
    kind: 'learner',
    table: authorTable(start, id, undefined, { 'c5-c6': 'target', 'c5-a5': 'target' }),
    next: { 'c5-c6': leaf, 'c5-a5': { ...leaf } },
  };
  return {
    type: 'play',
    ...meta(id),
    pieces: { ...HOLD_PIECES },
    prompt: 'u3l1.e1',
    task: 'hold',
    cap: 6,
    tree,
    rubrics: [
      { rubric: 'R5', weight: 70 },
      { rubric: 'R1', weight: 30 },
    ],
    holding: { predicate: { kind: 'no-hanging' } },
    reference: [['c5-c6'], ['c5-a5']],
  };
}

// ---------- The reduced opening (OPENING, DRILL, GAME, REVIEW) ----------

export const REDUCED_FEN = 'rnbakabnr/9/1c5c1/p3p3p/9/9/P3P3P/1C5C1/9/RNBAKABNR w - - 0 1';
const HORSES_OUT: Predicate = { kind: 'development', measure: 'horses-out', increaseBy: 1 };
/** Off the tree: developing a Horse or a Chariot is credited (default class `target`). */
export const OPENING_OBJECTIVE: Predicate = { kind: 'any', of: [HORSES_OUT, { kind: 'development', measure: 'chariots-out', increaseBy: 1 }] };

/** The main line: learner move, the two accepted moves, then the authored reply. */
const OPENING_LINE: { main: string; other: string; reply: string }[] = [
  { main: 'h0-g2', other: 'b0-c2', reply: 'h9-g7' },
  { main: 'b0-c2', other: 'b2-e2', reply: 'b9-c7' },
  { main: 'i0-i1', other: 'a0-a1', reply: 'i9-i8' },
  { main: 'a0-a1', other: 'i1-f1', reply: 'a9-a8' },
  { main: 'i1-f1', other: 'a1-d1', reply: 'i8-f8' },
  { main: 'a1-d1', other: 'e3-e4', reply: 'a8-d8' },
];

export function openingFixture(): PlayExercise {
  const id = 'b10l9-02';
  const start = parseFen(REDUCED_FEN);
  const build = (i: number, pos: Position): LineLearnerNode => {
    const step = OPENING_LINE[i];
    const table = authorTable(pos, id, HORSES_OUT, { [step.main]: 'target', [step.other]: 'sound' });
    const afterMain = after(pos, step.main);
    const next: LineOpponentNode | LineLeaf =
      i + 1 < OPENING_LINE.length
        ? { kind: 'opponent', replies: [{ move: step.reply, next: build(i + 1, after(afterMain, step.reply)) }] }
        : { kind: 'leaf', goal: { kind: 'end' } };
    return { kind: 'learner', table, objective: HORSES_OUT, next: { [step.main]: next } };
  };
  return {
    type: 'play',
    ...meta(id),
    fen: REDUCED_FEN,
    prompt: 'u3l1.e1',
    task: 'opening',
    cap: 8,
    tree: build(0, start),
    rubrics: [
      { rubric: 'R6', weight: 60 },
      { rubric: 'R1', weight: 40 },
    ],
    objective: OPENING_OBJECTIVE,
    development: { n: 6, target: 4 },
    lineShare: 6,
    reference: [OPENING_LINE.map((s) => s.main)],
  };
}

export function drillFixture(): PlayExercise {
  return {
    type: 'play',
    ...meta('b10l9-03'),
    fen: REDUCED_FEN,
    prompt: 'u3l1.e1',
    task: 'drill',
    cap: 6,
    rubrics: [
      { rubric: 'R1', weight: 70 },
      { rubric: 'R0', weight: 30 },
    ],
  };
}

export function gameFixture(): PlayExercise {
  return {
    type: 'play',
    ...meta('b10l9-04'),
    fen: REDUCED_FEN,
    prompt: 'u3l1.e1',
    task: 'game',
    cap: 80,
    rubrics: [
      { rubric: 'R1', weight: 50 },
      { rubric: 'R2', weight: 25 },
      { rubric: 'R0', weight: 25 },
    ],
    development: { n: 8, target: 4 },
  };
}

/** Red's second move h2-h5 puts the Cannon where the g7 Horse takes it (a serious allowed loss at the Basic guard). */
export const REVIEW_MOVES = ['h0-g2', 'h9-g7', 'h2-h5', 'g7-h5', 'b0-c2', 'b9-c7'];
export const REVIEW_PLY = 2;

export function reviewFixture(): ReviewExercise {
  const id = 'b10l9-05';
  const start = parseFen(REDUCED_FEN);
  const before = after(start, ...REVIEW_MOVES.slice(0, REVIEW_PLY));
  const guard = resolveGuard({ itemId: id });
  // Better moves: every move that passes the guard (authored target); the game's move is an error.
  const table = proposeMoveTable(before, guard).map((r): MoveTableEntry =>
    r.class === 'error' ? (r.notes.review ? { move: r.move, class: 'error', source: 'authored', reason: REASON } : { move: r.move, class: 'error', source: 'computed' }) : { move: r.move, class: 'target', source: 'authored', reason: REASON },
  );
  return {
    type: 'review',
    ...meta(id),
    fen: REDUCED_FEN,
    prompt: 'u3l1.e1',
    moves: [...REVIEW_MOVES],
    turningPoints: [{ ply: REVIEW_PLY, category: 'allowed-loss', table, text: 'u3l1.e2' }],
  };
}

// ---------- CONVERT ----------

export const CONVERT_FEN = '5C3/4ak1N1/4b4/9/6b2/7p1/9/9/9/4K4 w - - 0 1';

export function convertFixture(): PlayExercise {
  return {
    type: 'play',
    ...meta('i10l9-01'),
    fen: CONVERT_FEN,
    prompt: 'u3l1.e1',
    task: 'convert',
    cap: 4,
    rubrics: [
      { rubric: 'R4', weight: 80 },
      { rubric: 'R1', weight: 20 },
    ],
    resistance: true,
  };
}

/** A one-lesson unit per level around the given items. */
export const playUnits = (...exercises: unknown[]): Unit[] => {
  const basics = exercises.filter((e) => String((e as { id?: string }).id).startsWith('b10'));
  const inter = exercises.filter((e) => String((e as { id?: string }).id).startsWith('i10'));
  const units: unknown[] = [];
  if (basics.length) units.push({ id: 'b10', track: 'basics', title: 'u1.title', description: 'u1.desc', lessons: [{ id: 'b10l9', title: 'u1l1.title', exercises: basics }] });
  if (inter.length) units.push({ id: 'i10', track: 'intermediate', title: 'u1.title', description: 'u1.desc', lessons: [{ id: 'i10l9', title: 'u1l1.title', exercises: inter }] });
  return units as Unit[];
};

export const allPlayFixtures = (): (PlayExercise | ReviewExercise)[] => [holdFixture(), openingFixture(), drillFixture(), gameFixture(), reviewFixture(), convertFixture()];

/** Exported for tests: the guard the Basic fixtures use. */
export const BASIC_GUARD = SAFETY_GUARDS.basics;
export const fixtureKey = moveKey;
