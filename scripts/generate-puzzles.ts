// Dev-time puzzle generator. Builds random but plausible positions, keeps those the solver proves
// have a unique solution, and writes src/content/puzzles/*.json. Every puzzle is original: nothing
// is copied from books, sites or databases. The output must also pass the same validator as the
// tests (src/content/validate-puzzles.ts), which is applied as the final gate.
//
// Run: npm run puzzles:generate   (deterministic for a given SEED; takes a few minutes)
import { writeFileSync } from 'node:fs';
import type { Puzzle, PuzzleGoal, PuzzleStep, PuzzleTheme } from '../src/content/puzzle-types';
import { validatePuzzle } from '../src/content/validate-puzzles';
import {
  findGeneral,
  forcedWinMoves,
  gameStatus,
  isGeneralAttacked,
  legalMoves,
  makeMove,
  materialBalance,
  moveScore,
  positionFromPieces,
  pseudoLegalTargets,
  squareName,
  toFen,
  type Board,
  type Move,
  type Position,
} from '../src/engine';
import { bestReplies, materialGain, WIN_MATERIAL_DEPTH, WIN_MATERIAL_THRESHOLD } from '../src/puzzles/logic';

const SEED = 20261015;
const TARGET: Record<PuzzleGoal, number> = { 'mate-in-1': 30, 'mate-in-2': 20, 'win-material': 10 };
const TIME_BUDGET_MS: Record<PuzzleGoal, number> = { 'mate-in-1': 60_000, 'mate-in-2': 240_000, 'win-material': 240_000 };
const OUT_DIR = new URL('../src/content/puzzles/', import.meta.url);

// ---------- Seeded randomness ----------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(SEED);
const int = (n: number) => Math.floor(rng() * n);
const pick = <T,>(xs: readonly T[]): T => xs[int(xs.length)];

// ---------- Plausible piece placement (squares named from Red's side) ----------
const sq = (file: number, rank: number) => `${'abcdefghi'[file]}${rank}`;
const mirror = (name: string) => `${name[0]}${9 - Number(name[1])}`;
const RED = {
  general: ['d0', 'e0', 'f0', 'd1', 'e1', 'f1', 'd2', 'e2', 'f2'],
  advisor: ['d0', 'f0', 'e1', 'd2', 'f2'],
  elephant: ['c0', 'g0', 'a2', 'e2', 'i2', 'c4', 'g4'],
  // Crossed soldiers (the useful attackers), plus a few that have not crossed yet.
  soldier: [
    ...Array.from({ length: 9 * 5 }, (_, i) => sq(i % 9, 5 + Math.floor(i / 9))),
    'a3', 'c3', 'e3', 'g3', 'i3', 'a4', 'c4', 'e4', 'g4', 'i4',
  ],
  any: Array.from({ length: 90 }, (_, i) => sq(i % 9, Math.floor(i / 9))),
};
const BLACK = {
  general: RED.general.map(mirror),
  advisor: RED.advisor.map(mirror),
  elephant: RED.elephant.map(mirror),
  soldier: RED.soldier.map(mirror),
};
/** Squares on Black's half or the river bank, where Red's attackers usually stand. */
const ATTACK_ZONE = RED.any.filter((n) => Number(n[1]) >= 4);

function place(pieces: Record<string, string>, letter: string, squares: readonly string[]): boolean {
  for (let tries = 0; tries < 20; tries++) {
    const s = pick(squares);
    if (!pieces[s]) {
      pieces[s] = letter;
      return true;
    }
  }
  return false;
}

function randomPosition(kind: 'mate' | 'material'): Position | null {
  const pieces: Record<string, string> = {};
  place(pieces, 'k', BLACK.general);
  place(pieces, 'K', RED.general);
  // Black's defenders.
  for (let i = int(3); i > 0; i--) place(pieces, 'a', BLACK.advisor);
  for (let i = int(3); i > 0; i--) place(pieces, 'b', BLACK.elephant);
  for (let i = int(kind === 'mate' ? 3 : 2); i > 0; i--) place(pieces, 'p', BLACK.soldier);
  // Black's own fighting pieces: a few in mate puzzles, the targets in material puzzles.
  const blackFighters = kind === 'mate' ? int(3) : 2 + int(2);
  for (let i = 0; i < blackFighters; i++) place(pieces, pick(['r', 'n', 'c', 'n', 'c']), RED.any);
  // Red's home defenders (also useful as cannon screens).
  for (let i = int(3); i > 0; i--) place(pieces, 'A', RED.advisor);
  for (let i = int(2); i > 0; i--) place(pieces, 'B', RED.elephant);
  // Red's attackers.
  const attackers = kind === 'mate' ? 1 + int(3) : 1 + int(2);
  for (let i = 0; i < attackers; i++) {
    const letter = pick(['R', 'N', 'C', 'P', 'R', 'N', 'C']);
    place(pieces, letter, letter === 'P' ? RED.soldier.slice(0, 45) : ATTACK_ZONE);
  }
  // Respect the piece limits (2 of each, 5 soldiers).
  const counts: Record<string, number> = {};
  for (const l of Object.values(pieces)) counts[l] = (counts[l] ?? 0) + 1;
  if (Object.entries(counts).some(([l, c]) => c > (l.toLowerCase() === 'p' ? 5 : l.toLowerCase() === 'k' ? 1 : 2))) return null;
  if (!Object.values(pieces).includes('k') || !Object.values(pieces).includes('K')) return null;

  let pos: Position;
  try {
    pos = positionFromPieces(pieces, 'red');
  } catch {
    return null;
  }
  // Legal with Red to move, Red not in check, and both sides have moves (no frozen positions).
  if (isGeneralAttacked(pos.board, 'black') || isGeneralAttacked(pos.board, 'red')) return null;
  if (legalMoves(pos).length < 6) return null;
  if (legalMoves({ ...pos, turn: 'black' }).length === 0) return null;
  return pos;
}

// ---------- Features: theme, difficulty, hints ----------
/** Red pieces giving check to Black's General (the flying general counts too). */
function checkers(board: Board): number {
  const king = findGeneral(board, 'black');
  let n = 0;
  for (let from = 0; from < 90; from++) {
    const p = board[from];
    if (p?.color === 'red' && p.type !== 'general' && pseudoLegalTargets(board, from).includes(king)) n++;
  }
  const red = findGeneral(board, 'red');
  if (red % 9 === king % 9) {
    let open = true;
    for (let s = red + 9; s < king; s += 9) if (board[s]) open = false;
    if (open) n++;
  }
  return n;
}

/** Does the mated General lose an escape square only because it would face Red's General? */
function usesFlyingGeneral(board: Board): boolean {
  const king = findGeneral(board, 'black');
  const redKing = findGeneral(board, 'red');
  for (const to of pseudoLegalTargets(board, king)) {
    const b = board.slice();
    b[to] = b[king];
    b[king] = null;
    if (!isGeneralAttacked(b, 'black')) continue;
    b[redKing] = null;
    if (!isGeneralAttacked(b, 'black')) return true;
  }
  return false;
}

const givesCheck = (pos: Position, m: Move) => isGeneralAttacked(makeMove(pos, m).board, 'black');
const hangs = (pos: Position, m: Move) => legalMoves(makeMove(pos, m)).some((r) => r.to === m.to);
const pieceType = (pos: Position, m: Move) => pos.board[m.from]!.type;

function mateTheme(start: Position, line: Move[], finalBoard: Board): PuzzleTheme {
  if (checkers(finalBoard) >= 2) return 'double-check';
  if (usesFlyingGeneral(finalBoard)) return 'flying-general';
  if (line.length > 1 && !givesCheck(start, line[0]) && hangs(start, line[0])) return 'sacrifice';
  const before = line.length > 1 ? makeMove(makeMove(start, line[0]), line[1]) : start;
  const t = pieceType(before, line[line.length - 1]);
  return t === 'chariot' || t === 'horse' || t === 'cannon' || t === 'soldier' ? t : 'chariot';
}

/** Hint for the mating move: the idea behind the final blow. */
function mateHint(theme: PuzzleTheme, before: Position, mate: Move): string {
  if (theme === 'double-check') return 'hint.double-check';
  if (theme === 'flying-general') return 'hint.flying-general';
  const type = pieceType(before, mate);
  if (type === 'cannon') return 'hint.cannon-screen';
  if (type === 'horse') return 'hint.horse';
  if (type === 'chariot') return 'hint.chariot';
  if (type === 'soldier') return 'hint.soldier';
  return 'hint.finish';
}

/** Hint for the first move of a two-move puzzle: what kind of move it is. */
function firstMoveHint(pos: Position, first: Move): string {
  if (hangs(pos, first)) return 'hint.sacrifice';
  return givesCheck(pos, first) ? 'hint.check' : 'hint.quiet';
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

interface Candidate {
  puzzle: Omit<Puzzle, 'id'>;
}

const step = (m: Move, hint?: string): PuzzleStep => ({ from: squareName(m.from), to: squareName(m.to), ...(hint ? { hint } : {}) });

function base(pos: Position, goal: PuzzleGoal) {
  return { fen: toFen(pos), sideToMove: 'red' as const, goal };
}

function analyseMate(pos: Position, rejections: Map<string, number>): Candidate | null {
  const in1 = forcedWinMoves(pos, 1);
  if (in1.length === 1) {
    const m = in1[0];
    const after = makeMove(pos, m);
    if (gameStatus(after).kind !== 'checkmate') return reject(rejections, 'wins by stalemate, not mate');
    const theme = mateTheme(pos, [m], after.board);
    const checks = legalMoves(pos).filter((x) => givesCheck(pos, x)).length;
    const difficulty = clamp(1 + (checks >= 4 ? 1 : 0) + (theme === 'double-check' || theme === 'flying-general' || !givesCheck(pos, m) ? 1 : 0), 1, 3);
    return { puzzle: { ...base(pos, 'mate-in-1'), difficulty, theme, solution: [step(m, mateHint(theme, pos, m))] } };
  }
  if (in1.length > 1) return reject(rejections, 'mate in 1 not unique');
  const in2 = forcedWinMoves(pos, 2);
  if (in2.length === 0) return null;
  if (in2.length > 1) return reject(rejections, 'mate in 2 not unique');
  const first = in2[0];
  const afterFirst = makeMove(pos, first);
  const draft: Puzzle = { id: 'draft', ...base(pos, 'mate-in-2'), difficulty: 3, theme: 'chariot', solution: [step(first)] };
  const replies = legalMoves(afterFirst);
  // Best defence; among equally good ones prefer captures, then the first found.
  const best = bestReplies({ ...draft, solution: [step(first), step(first), step(first)] }, afterFirst, 1);
  const reply = best.find((r) => afterFirst.board[r.to]) ?? best[0];
  const afterReply = makeMove(afterFirst, reply);
  const mate = forcedWinMoves(afterReply, 1).find((m) => gameStatus(makeMove(afterReply, m)).kind === 'checkmate');
  if (!mate) return reject(rejections, 'best defence only allows stalemate');
  const finalBoard = makeMove(afterReply, mate).board;
  const theme = mateTheme(pos, [first, reply, mate], finalBoard);
  const quiet = !givesCheck(pos, first);
  const difficulty = clamp(2 + (quiet ? 1 : 0) + (hangs(pos, first) ? 1 : 0) + (replies.length >= 4 ? 1 : 0), 2, 5);
  return {
    puzzle: {
      ...base(pos, 'mate-in-2'),
      difficulty,
      theme,
      solution: [step(first, firstMoveHint(pos, first)), step(reply), step(mate, mateHint(theme, afterReply, mate))],
    },
  };
}

function analyseMaterial(pos: Position, rejections: Map<string, number>): Candidate | null {
  if (forcedWinMoves(pos, 2).length > 0) return null;
  const draft: Puzzle = { id: 'draft', ...base(pos, 'win-material'), difficulty: 1, theme: 'chariot', solution: [] };
  const scored = legalMoves(pos).map((m) => ({ m, gain: materialGain(draft, pos, m, 0), score: moveScore(pos, m, WIN_MATERIAL_DEPTH) }));
  if (scored.some((s) => s.score > 50_000)) return null;
  const winning = scored.filter((s) => s.gain >= WIN_MATERIAL_THRESHOLD);
  if (winning.length === 0) return null;
  if (winning.length > 1) return reject(rejections, 'material win not unique');
  const first = winning[0].m;
  const start = materialBalance(pos.board, 'red');
  const afterFirst = makeMove(pos, first);
  const isCapture = pos.board[first.to] !== null;
  const forkTargets = pseudoLegalTargets(afterFirst.board, first.to).filter((s) => afterFirst.board[s]?.color === 'black').length;
  const theme: PuzzleTheme =
    !isCapture && forkTargets >= 2 ? 'fork' : (pieceType(pos, first) as PuzzleTheme) === 'general' ? 'chariot' : (pieceType(pos, first) as PuzzleTheme);
  if (!['chariot', 'horse', 'cannon', 'soldier', 'fork'].includes(theme)) return reject(rejections, 'unusual winning piece');

  // A capture that keeps its gain against every reply is a one-move puzzle.
  if (isCapture && materialBalance(afterFirst.board, 'red') - start >= WIN_MATERIAL_THRESHOLD && !hangs(pos, first)) {
    return { puzzle: { ...base(pos, 'win-material'), difficulty: 1, theme, solution: [step(first, 'hint.free-piece')] } };
  }
  if (isCapture) return reject(rejections, 'capture that only wins later');
  const fullDraft = { ...draft, solution: [step(first), step(first), step(first)] };
  const best = bestReplies(fullDraft, afterFirst, 1);
  const reply = best[0];
  const afterReply = makeMove(afterFirst, reply);
  const finish = legalMoves(afterReply)
    .filter((m) => afterReply.board[m.to])
    .map((m) => ({ m, gain: materialGain(fullDraft, afterReply, m, 2) }))
    .sort((a, b) => b.gain - a.gain)[0];
  if (!finish || finish.gain < WIN_MATERIAL_THRESHOLD) return reject(rejections, 'win needs more than two moves');
  const difficulty = clamp(2 + (givesCheck(pos, first) ? 0 : 1) + (hangs(pos, first) ? 1 : 0), 2, 4);
  return {
    puzzle: {
      ...base(pos, 'win-material'),
      difficulty,
      theme,
      solution: [step(first, theme === 'fork' ? 'hint.fork' : givesCheck(pos, first) ? 'hint.check' : 'hint.quiet'), step(reply), step(finish.m, 'hint.collect')],
    },
  };
}

function reject(rejections: Map<string, number>, reason: string): null {
  rejections.set(reason, (rejections.get(reason) ?? 0) + 1);
  return null;
}

// ---------- Selection: spread over difficulty and theme ----------
function select(candidates: Candidate[], goal: PuzzleGoal): Puzzle[] {
  const want = TARGET[goal];
  const byKey = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const key = `${c.puzzle.difficulty}|${c.puzzle.theme}`;
    byKey.set(key, [...(byKey.get(key) ?? []), c]);
  }
  // Round-robin over (difficulty, theme) buckets so no single pattern dominates.
  const chosen: Candidate[] = [];
  const buckets = [...byKey.values()];
  for (let round = 0; chosen.length < want && buckets.some((b) => b.length > round); round++) {
    for (const b of buckets) if (b[round] && chosen.length < want) chosen.push(b[round]);
  }
  const prefix = goal === 'mate-in-1' ? 'm1' : goal === 'mate-in-2' ? 'm2' : 'wm';
  return chosen
    .sort((a, b) => a.puzzle.difficulty - b.puzzle.difficulty || a.puzzle.theme.localeCompare(b.puzzle.theme))
    .map((c, i) => ({ id: `${prefix}-${String(i + 1).padStart(2, '0')}`, ...c.puzzle }));
}

// ---------- Main ----------
const report: string[] = [];
for (const goal of ['mate-in-1', 'mate-in-2', 'win-material'] as PuzzleGoal[]) {
  const rejections = new Map<string, number>();
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  const deadline = Date.now() + TIME_BUDGET_MS[goal] * Number(process.env.PUZZLE_TIME_SCALE ?? 1);
  let tried = 0;
  // Collect a pool several times larger than needed so selection can spread themes and levels.
  while (Date.now() < deadline && candidates.length < TARGET[goal] * 6) {
    const pos = randomPosition(goal === 'win-material' ? 'material' : 'mate');
    if (!pos) continue;
    tried++;
    const key = toFen(pos).split(' ')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    const c = goal === 'win-material' ? analyseMaterial(pos, rejections) : analyseMate(pos, rejections);
    if (!c || c.puzzle.goal !== goal) continue;
    // Final gate: the shipped validator.
    const problems = validatePuzzle({ id: 'candidate', ...c.puzzle });
    if (problems.length) {
      reject(rejections, `validator: ${problems[0].replace(/\[.*\]/, '[...]')}`);
      continue;
    }
    candidates.push(c);
  }
  const puzzles = select(candidates, goal);
  if (!process.env.PUZZLE_DRY_RUN) writeFileSync(new URL(`${goal}.json`, OUT_DIR), `${JSON.stringify(puzzles, null, 2)}\n`);
  report.push(
    `${goal}: ${puzzles.length} written from ${candidates.length} verified candidates (${tried} random positions tried)`,
    ...[...rejections].map(([r, n]) => `    rejected ${n}x: ${r}`),
    `    difficulty: ${JSON.stringify(countBy(puzzles, (p) => p.difficulty))} themes: ${JSON.stringify(countBy(puzzles, (p) => p.theme))}`,
  );
}
console.log(report.join('\n'));

function countBy<T>(xs: T[], f: (x: T) => string | number) {
  const out: Record<string, number> = {};
  for (const x of xs) out[f(x)] = (out[f(x)] ?? 0) + 1;
  return out;
}

