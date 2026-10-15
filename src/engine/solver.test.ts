import { describe, expect, it } from 'vitest';
import {
  forcedWinMoves,
  hasForcedWin,
  isGeneralAttacked,
  isWinScore,
  legalMoves,
  makeMove,
  materialBalance,
  moveScore,
  parseSquare as sq,
  positionFromPieces,
  searchScore,
  PIECE_VALUES,
  type Move,
  type Position,
} from './index';

// ---------- Naive reference implementations (public API only, no pruning, no board tricks) ----------
function naiveWinMoves(pos: Position, n: number): Move[] {
  return legalMoves(pos).filter((m) => naiveWinsAfter(makeMove(pos, m), n));
}
function naiveWinsAfter(pos: Position, n: number): boolean {
  const replies = legalMoves(pos);
  if (replies.length === 0) return true;
  if (n <= 1) return false;
  return replies.every((r) => naiveWinMoves(makeMove(pos, r), n - 1).length > 0);
}
function naiveQuiesce(pos: Position, ply: number, q: number): number {
  const moves = legalMoves(pos);
  if (moves.length === 0) return -100_000 + ply;
  const inCheck = isGeneralAttacked(pos.board, pos.turn);
  const stand = materialBalance(pos.board, pos.turn);
  if (q >= 8) return stand;
  let best = inCheck ? -Infinity : stand;
  for (const m of inCheck ? moves : moves.filter((x) => pos.board[x.to])) {
    best = Math.max(best, -naiveQuiesce(makeMove(pos, m), ply + 1, q + 1));
  }
  return best;
}
function naiveSearch(pos: Position, depth: number, ply = 0): number {
  if (depth <= 0) return naiveQuiesce(pos, ply, 0);
  const moves = legalMoves(pos);
  if (moves.length === 0) return -100_000 + ply;
  return Math.max(...moves.map((m) => -naiveSearch(makeMove(pos, m), depth - 1, ply + 1)));
}

// Deterministic sparse positions near Black's General, Red to move.
function samplePositions(count: number, seed: number): Position[] {
  let s = seed;
  const rand = (n: number) => ((s = (s * 1103515245 + 12345) % 2147483648), s % n);
  const out: Position[] = [];
  const name = (f: number, r: number) => `${'abcdefghi'[f]}${r}`;
  while (out.length < count) {
    const pieces: Record<string, string> = {};
    pieces[name(3 + rand(3), 7 + rand(3))] = 'k';
    pieces[name(3 + rand(3), rand(3))] = 'K';
    for (const letter of ['R', 'N', 'C', 'P', 'a', 'p', 'r', 'n'].filter(() => rand(2) === 0)) {
      const where = name(rand(9), letter === letter.toUpperCase() ? 4 + rand(6) : rand(10));
      if (!pieces[where]) pieces[where] = letter;
    }
    try {
      const pos = positionFromPieces(pieces, 'red');
      if (!isGeneralAttacked(pos.board, 'black') && legalMoves(pos).length > 0) out.push(pos);
    } catch {
      // invalid placement (e.g. advisor off its points is allowed by FEN, generals are not)
    }
  }
  return out;
}

const key = (ms: Move[]) => ms.map((m) => `${m.from}-${m.to}`).sort();

describe('forced wins', () => {
  it('finds the double-chariot mate in 1, and only that move', () => {
    const pos = positionFromPieces({ d0: 'K', e9: 'k', a8: 'R', h1: 'R', i6: 'p' }, 'red');
    expect(forcedWinMoves(pos, 1)).toEqual([{ from: sq('h1'), to: sq('h9') }]);
    expect(hasForcedWin(pos, 1)).toBe(true);
  });

  it('counts a stalemating move as a win (stalemate loses in Xiangqi)', () => {
    // The f1 chariot and the d0 General already guard f9 and d9; covering e8 freezes Black.
    const pos = positionFromPieces({ d0: 'K', e9: 'k', b7: 'R', f1: 'R' }, 'red');
    const wins = forcedWinMoves(pos, 1);
    const stalemate = { from: sq('b7'), to: sq('b8') };
    expect(wins).toContainEqual(stalemate);
    const after = makeMove(pos, stalemate);
    expect(legalMoves(after)).toEqual([]);
    expect(isGeneralAttacked(after.board, 'black')).toBe(false);
  });

  it('agrees with a naive search on mate in 1 and mate in 2 for sample positions', () => {
    let found2 = 0;
    for (const pos of samplePositions(40, 7)) {
      expect(key(forcedWinMoves(pos, 1))).toEqual(key(naiveWinMoves(pos, 1)));
      const two = forcedWinMoves(pos, 2);
      expect(key(two)).toEqual(key(naiveWinMoves(pos, 2)));
      if (two.length) found2++;
    }
    expect(found2).toBeGreaterThan(0); // the sample really exercises the 2-move search
  });
});

describe('material search', () => {
  it('scores captures by what survives the recapture', () => {
    // Red chariot can take a free horse on a5, or a soldier on i5 defended by the chariot on i9.
    const pos = positionFromPieces({ d0: 'K', e9: 'k', a0: 'R', a5: 'n', i0: 'R', i5: 'p', i9: 'r' }, 'red');
    const start = materialBalance(pos.board, 'red');
    expect(moveScore(pos, { from: sq('a0'), to: sq('a5') }, 2) - start).toBe(PIECE_VALUES.horse);
    expect(moveScore(pos, { from: sq('i0'), to: sq('i5') }, 2) - start).toBe(PIECE_VALUES.soldier - PIECE_VALUES.chariot);
  });

  it('recognises a forced mate as a winning score', () => {
    const pos = positionFromPieces({ d0: 'K', e9: 'k', a8: 'R', h1: 'R', i6: 'p' }, 'red');
    expect(isWinScore(searchScore(pos, 1))).toBe(true);
  });

  it('alpha-beta search matches a full-width search', () => {
    for (const pos of samplePositions(25, 99)) {
      expect(searchScore(pos, 2)).toBe(naiveSearch(pos, 2));
    }
  });
});
