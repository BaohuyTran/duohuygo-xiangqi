import { describe, expect, it } from 'vitest';
import {
  isLegalMove,
  makeMove,
  parseFen,
  parseSquare,
  pieceToLetter,
  positionFromPieces,
  START_FEN,
  toFen,
} from './index';

const at = (fen: string, square: string) => {
  const p = parseFen(fen).board[parseSquare(square)];
  return p ? pieceToLetter(p) : null;
};

describe('FEN', () => {
  it('parses the standard starting position', () => {
    const pos = parseFen(START_FEN);
    expect(pos.turn).toBe('red');
    expect(pos.board.filter(Boolean)).toHaveLength(32);
    expect(at(START_FEN, 'e0')).toBe('K');
    expect(at(START_FEN, 'e9')).toBe('k');
    expect(at(START_FEN, 'a0')).toBe('R');
    expect(at(START_FEN, 'b0')).toBe('N');
    expect(at(START_FEN, 'c0')).toBe('B');
    expect(at(START_FEN, 'd0')).toBe('A');
    expect(at(START_FEN, 'b2')).toBe('C');
    expect(at(START_FEN, 'h7')).toBe('c');
    expect(at(START_FEN, 'a3')).toBe('P');
    expect(at(START_FEN, 'i6')).toBe('p');
    expect(at(START_FEN, 'e4')).toBeNull();
  });

  it('round-trips', () => {
    expect(toFen(parseFen(START_FEN))).toBe(START_FEN);
    const fen = '3k5/4a4/4ba3/9/2b6/4C4/9/4B4/4A4/3AK4 b - - 7 23';
    expect(toFen(parseFen(fen))).toBe(fen);
  });

  it('accepts h/e piece letters and "r" for Red to move', () => {
    const pos = parseFen('rheakaehr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RHEAKAEHR r');
    expect(toFen(pos)).toBe(START_FEN);
  });

  it('defaults missing counters', () => {
    const pos = parseFen('4k4/9/9/9/9/9/9/9/9/3K5 b');
    expect(pos).toMatchObject({ turn: 'black', halfmoveClock: 0, fullmoveNumber: 1 });
  });

  it.each([
    ['too few ranks', '4k4/9/9/9/9/9/9/9/3K5 w'],
    ['a rank that is too short', '4k4/8/9/9/9/9/9/9/9/3K5 w'],
    ['a rank that is too long', '4k4/9/9/9/9/9/9/9/9/3K5P w'],
    ['an unknown piece letter', '4k4/9/9/9/4Q4/9/9/9/9/3K5 w'],
    ['an invalid side to move', '4k4/9/9/9/9/9/9/9/9/3K5 x'],
    ['a missing general', '9/9/9/9/9/9/9/9/9/3K5 w'],
    ['two generals of one colour', '3kk4/9/9/9/9/9/9/9/9/3K5 w'],
    ['a general outside its palace', 'k8/9/9/9/9/9/9/9/9/3K5 w'],
  ])('rejects %s', (_name, fen) => {
    expect(() => parseFen(fen)).toThrow();
  });
});

describe('makeMove', () => {
  it('moves the piece, switches side and updates counters', () => {
    const start = parseFen(START_FEN);
    const move = { from: parseSquare('b2'), to: parseSquare('e2') }; // cannon to the centre
    expect(isLegalMove(start, move)).toBe(true);
    const after = makeMove(start, move);
    expect(toFen(after)).toBe('rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/4C2C1/9/RNBAKABNR b - - 1 1');
    // The input position is not mutated.
    expect(toFen(start)).toBe(START_FEN);
  });

  it('resets the halfmove clock on capture and increments the move number after Black', () => {
    const pos = { ...positionFromPieces({ d0: 'K', f9: 'k', a9: 'r', a0: 'R' }, 'black'), halfmoveClock: 5 };
    const after = makeMove(pos, { from: parseSquare('a9'), to: parseSquare('a0') });
    expect(after.halfmoveClock).toBe(0);
    expect(after.fullmoveNumber).toBe(2);
  });

  it('rejects illegal moves', () => {
    const start = parseFen(START_FEN);
    expect(isLegalMove(start, { from: parseSquare('e0'), to: parseSquare('e2') })).toBe(false);
    expect(isLegalMove(start, { from: parseSquare('a6'), to: parseSquare('a5') })).toBe(false); // Black's piece
  });
});

describe('engine purity', () => {
  it('has no React (or other UI) imports', () => {
    const sources = import.meta.glob('./**/*.ts', { query: '?raw', import: 'default', eager: true });
    const offenders = Object.entries(sources)
      .filter(([, src]) => /from\s+['"](react|react-dom)(\/[^'"]*)?['"]/.test(src as string))
      .map(([path]) => path);
    expect(Object.keys(sources).length).toBeGreaterThan(5);
    expect(offenders).toEqual([]);
  });
});
