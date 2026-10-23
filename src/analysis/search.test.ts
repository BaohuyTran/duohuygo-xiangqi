import { describe, expect, it } from 'vitest';
import {
  MATE_SCORE,
  START_FEN,
  isLegalMove,
  legalMoves,
  makeMove,
  moveScore,
  parseFen,
  parseSquare,
  positionFromPieces,
  searchScore,
  type Position,
} from '../engine';
import { featureEvaluator } from './eval';
import { positionKey, search, searchAtLeast, searchMove } from './search';

// 04 §2.2 "mid": after 1. C2=5 H8+7 2. H2+3 H2+3 3. R1=2 R9=8, a developed, quiet position.
const MID = 'r1bakabr1/9/1cn3nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKABR1 w - - 6 4';
// Tactical positions from the content: two mates in 2, two win-material puzzles, u15l3#3 (mate in 4).
const TACTICAL = [
  '9/7P1/3k1a3/N8/C5b2/2B6/9/p8/p8/4KA3 w - - 0 1',
  '4k4/4a4/4ba2N/4C4/2N6/9/4p4/9/8n/4K3p w - - 0 1',
  '4C1b1c/5k3/9/9/6b2/6n2/9/3K5/6p2/9 w - - 0 1',
  'C1ba5/4k4/3ab1c2/9/9/2B3R2/9/6r2/3K5/r2A3p1 w - - 0 1',
  '2b2N3/1N2ak3/5a3/6R2/2bc5/5c3/9/8B/9/4K4 w - - 0 1',
];

/** Seeded positions reached by random legal moves from the start (deterministic). */
function randomPositions(count: number, plies: number, seed: number): Position[] {
  let s = seed;
  const rand = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  const out: Position[] = [];
  while (out.length < count) {
    let pos = parseFen(START_FEN);
    for (let i = 0; i < plies; i++) {
      const moves = legalMoves(pos);
      if (moves.length === 0) break;
      pos = makeMove(pos, moves[Math.floor(rand() * moves.length)]);
    }
    if (legalMoves(pos).length > 0) out.push(pos);
  }
  return out;
}

const same = (a: number, b: number) => expect(a === b, `${a} vs ${b}`).toBe(true);

describe('search equals the engine material search (material evaluation)', () => {
  it('mid position, depths 0-3', () => {
    const mid = parseFen(MID);
    for (const d of [0, 1, 2, 3]) {
      const r = search(mid, { depth: d });
      expect(r.complete).toBe(true);
      expect(r.depth).toBe(d);
      same(r.score, searchScore(mid, d));
    }
  });

  it('start position, depths 0-2', () => {
    const start = parseFen(START_FEN);
    for (const d of [0, 1, 2]) same(search(start, { depth: d }).score, searchScore(start, d));
  });

  it('tactical positions incl. mate scores, depths 1-3', () => {
    for (const fen of TACTICAL) {
      const pos = parseFen(fen);
      for (const d of [1, 2, 3]) same(search(pos, { depth: d }).score, searchScore(pos, d));
    }
    // A mate in 2 is seen at depth 3 with the engine's mate score −MATE_SCORE + ply convention.
    expect(search(parseFen(TACTICAL[0]), { depth: 3 }).score).toBe(MATE_SCORE - 3);
  });

  it('searchMove equals moveScore for every move (mid at depth 2, tactical at depths 1-3)', () => {
    const mid = parseFen(MID);
    for (const m of legalMoves(mid)) same(searchMove(mid, m, { depth: 2 }).score, moveScore(mid, m, 2));
    for (const fen of TACTICAL.slice(0, 4)) {
      const pos = parseFen(fen);
      for (const m of legalMoves(pos)) for (const d of [1, 2, 3]) same(searchMove(pos, m, { depth: d }).score, moveScore(pos, m, d));
    }
  });

  it('seeded random middlegame positions, depth 2 (both sides to move)', () => {
    for (const pos of randomPositions(12, 21, 7)) same(search(pos, { depth: 2 }).score, searchScore(pos, 2));
  });

  it('side to move without legal moves scores −MATE_SCORE', () => {
    // Black general e9: the chariot on a8 covers rank 8, the one on b9 checks along rank 9.
    const mated = positionFromPieces({ e9: 'k', a8: 'R', b9: 'R', e0: 'K' }, 'black');
    expect(legalMoves(mated)).toEqual([]);
    const r = search(mated, { depth: 3 });
    expect(r.score).toBe(-MATE_SCORE);
    expect(r.pv).toEqual([]);
    expect(r.complete).toBe(true);
  });
});

describe('search result', () => {
  it('pv is a legal line starting with a best move', () => {
    for (const fen of [MID, ...TACTICAL]) {
      const pos = parseFen(fen);
      const r = search(pos, { depth: 3 });
      expect(r.pv.length).toBeGreaterThan(0);
      let p = pos;
      for (const m of r.pv) {
        expect(isLegalMove(p, m)).toBe(true);
        p = makeMove(p, m);
      }
      same(moveScore(pos, r.pv[0], 3), r.score);
    }
  });

  it('is deterministic (score, pv and node count)', () => {
    const pos = parseFen(MID);
    expect(search(pos, { depth: 3 })).toEqual(search(pos, { depth: 3 }));
    const feat = featureEvaluator();
    expect(search(pos, { depth: 2, evaluate: feat })).toEqual(search(pos, { depth: 2, evaluate: feat }));
  });

  it('the node limit stops the search and returns the deepest finished iteration', () => {
    const pos = parseFen(MID);
    const full = search(pos, { depth: 3 });
    const d2 = search(pos, { depth: 2 });
    const limited = search(pos, { depth: 3, maxNodes: d2.nodes + 50 });
    expect(limited.complete).toBe(false);
    expect(limited.depth).toBe(2);
    same(limited.score, d2.score);
    expect(limited.pv).toEqual(d2.pv);
    expect(limited.nodes).toBeLessThanOrEqual(d2.nodes + 51);
    expect(limited.nodes).toBeLessThan(full.nodes);
    // Same limit, same answer.
    expect(search(pos, { depth: 3, maxNodes: d2.nodes + 50 })).toEqual(limited);
  });

  it('a tiny node limit gives depth 0 and the static evaluation', () => {
    const r = search(parseFen(MID), { depth: 3, maxNodes: 1 });
    expect(r).toMatchObject({ depth: 0, complete: false, pv: [] });
    same(r.score, 0);
  });

  it('the abort flag stops the search', () => {
    const pos = parseFen(MID);
    expect(search(pos, { depth: 3, abort: { aborted: true } })).toMatchObject({ complete: false, depth: 0 });
    // Abort after some nodes: an object whose flag flips while searching.
    let reads = 0;
    const flag = {
      get aborted() {
        return ++reads > 500;
      },
    };
    const r = search(pos, { depth: 3, abort: flag });
    expect(r.complete).toBe(false);
    expect(r.nodes).toBeLessThanOrEqual(501);
  });

  it('searchMove counts the move in depth and starts the pv with it', () => {
    const pos = parseFen(MID);
    const m = { from: parseSquare('h0'), to: parseSquare('h6') };
    const r = searchMove(pos, m, { depth: 2 });
    expect(r.depth).toBe(2);
    expect(r.pv[0]).toEqual(m);
    expect(r.complete).toBe(true);
  });

  it('searchAtLeast agrees with the exact score', () => {
    const pos = parseFen(TACTICAL[3]);
    const exact = search(pos, { depth: 2 }).score;
    expect(searchAtLeast(pos, exact, { depth: 2 }).value).toBe(true);
    expect(searchAtLeast(pos, exact + 0.5, { depth: 2 }).value).toBe(false);
    expect(searchAtLeast(pos, exact - 0.5, { depth: 2 }).value).toBe(true);
  });

  it('featureEvaluator separates quiet moves that material search ties', () => {
    const mid = parseFen(MID);
    const material = new Set(legalMoves(mid).map((m) => searchMove(mid, m, { depth: 1 }).score));
    const feat = featureEvaluator();
    const features = new Set(legalMoves(mid).map((m) => searchMove(mid, m, { depth: 1, evaluate: feat }).score));
    expect(features.size).toBeGreaterThan(material.size * 3);
  });

  it('positionKey depends on board and side to move only', () => {
    const a = parseFen(MID);
    const b = parseFen(MID.replace(' w ', ' b '));
    expect(positionKey(a)).toBe(positionKey(parseFen(MID.replace('6 4', '0 1'))));
    expect(positionKey(a)).not.toBe(positionKey(b));
    expect(Number.isSafeInteger(positionKey(a))).toBe(true);
  });
});
