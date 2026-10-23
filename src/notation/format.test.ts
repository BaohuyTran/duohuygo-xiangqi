import { describe, expect, it } from 'vitest';
import { parseFen, parseSquare, positionFromPieces, START_FEN, type Position } from '../engine';
import { mirrorFiles, swapColours } from '../content/normalize';
import { formatMove, sideFileNumber } from './format';

const mv = (s: string) => {
  const [from, to] = s.split('-');
  return { from: parseSquare(from), to: parseSquare(to) };
};
const start = parseFen(START_FEN);
const startBlack = { ...start, turn: 'black' as const };
const K = { e0: 'K', d9: 'k' };

describe('sideFileNumber', () => {
  it('counts 1–9 from each side’s own right', () => {
    expect([0, 4, 8].map((f) => sideFileNumber('red', f))).toEqual([9, 5, 1]);
    expect([0, 4, 8].map((f) => sideFileNumber('black', f))).toEqual([1, 5, 9]);
  });
});

describe('formatMove: traditional notation, both colours, en + vi', () => {
  // [position, move, en, vi]
  const table: [string, Position, string, string, string][] = [
    // Red, start position
    ['Central Cannon', start, 'h2-e2', 'C2=5', 'P2-5'],
    ['Red Horse out', start, 'h0-g2', 'H2+3', 'M2.3'],
    ['Red Elephant to the centre', start, 'c0-e2', 'E7+5', 'T7.5'],
    ['Red Soldier one step', start, 'g3-g4', 'P3+1', 'B3.1'],
    ['Red Chariot up', start, 'a0-a1', 'R9+1', 'X9.1'],
    ['Red Advisor', start, 'd0-e1', 'A6+5', 'S6.5'],
    ['Red General', start, 'e0-e1', 'K5+1', 'Tg5.1'],
    ['Red Cannon across the river', start, 'b2-b9', 'C8+7', 'P8.7'],
    // Black, start position: files counted from Black's right (file a = 1)
    ['Black Screen Horse', startBlack, 'b9-c7', 'H2+3', 'M2.3'],
    ['Black same-direction Cannon', startBlack, 'h7-e7', 'C8=5', 'P8-5'],
    ['Black opposite-direction Cannon', startBlack, 'b7-e7', 'C2=5', 'P2-5'],
    ['Black Soldier one step', startBlack, 'c6-c5', 'P3+1', 'B3.1'],
    ['Black Elephant', startBlack, 'g9-e7', 'E7+5', 'T7.5'],
  ];

  it.each(table)('%s: %s', (_name, pos, move, en, vi) => {
    expect(formatMove(mv(move), pos, 'traditional', 'en')).toBe(en);
    expect(formatMove(mv(move), pos, 'traditional', 'vi')).toBe(vi);
  });

  it('writes retreats for both colours', () => {
    const red = positionFromPieces({ ...K, c4: 'N', h4: 'R' }, 'red');
    expect(formatMove(mv('c4-b2'), red, 'traditional', 'en')).toBe('H7-8');
    expect(formatMove(mv('c4-b2'), red, 'traditional', 'vi')).toBe('M7/8');
    expect(formatMove(mv('h4-h1'), red, 'traditional', 'en')).toBe('R2-3');
    expect(formatMove(mv('h4-h1'), red, 'traditional', 'vi')).toBe('X2/3');
    const black = positionFromPieces({ ...K, c7: 'n', h5: 'r' }, 'black');
    expect(formatMove(mv('c7-b9'), black, 'traditional', 'en')).toBe('H3-2');
    expect(formatMove(mv('c7-b9'), black, 'traditional', 'vi')).toBe('M3/2');
    expect(formatMove(mv('h5-h8'), black, 'traditional', 'en')).toBe('R8-3');
  });

  it('marks front and rear when two identical pieces share a file', () => {
    const red = positionFromPieces({ ...K, a0: 'R', a3: 'R' }, 'red');
    expect(formatMove(mv('a3-a5'), red, 'traditional', 'en')).toBe('+R+2');
    expect(formatMove(mv('a3-a5'), red, 'traditional', 'vi')).toBe('Xt.2');
    expect(formatMove(mv('a0-b0'), red, 'traditional', 'en')).toBe('-R=8');
    expect(formatMove(mv('a0-b0'), red, 'traditional', 'vi')).toBe('Xs-8');
    // Black's front piece is the one with the LOWER rank (nearest Red).
    const black = positionFromPieces({ ...K, e7: 'c', e5: 'c' }, 'black');
    expect(formatMove(mv('e5-e3'), black, 'traditional', 'en')).toBe('+C+2');
    expect(formatMove(mv('e5-e3'), black, 'traditional', 'vi')).toBe('Pt.2');
    expect(formatMove(mv('e7-e8'), black, 'traditional', 'en')).toBe('-C-1');
    expect(formatMove(mv('e7-e8'), black, 'traditional', 'vi')).toBe('Ps/1');
    // Two pieces of one type on different files are not a pair.
    const apart = positionFromPieces({ ...K, a0: 'R', b3: 'R' }, 'red');
    expect(formatMove(mv('a0-a1'), apart, 'traditional', 'en')).toBe('R9+1');
  });

  it('keeps the file number for two Advisors or Elephants on one file (advance vs retreat tells them apart)', () => {
    const red = positionFromPieces({ e0: 'K', f9: 'k', c0: 'B', c4: 'B', d0: 'A', d2: 'A' }, 'red');
    expect(formatMove(mv('c0-e2'), red, 'traditional', 'en')).toBe('E7+5');
    expect(formatMove(mv('c0-e2'), red, 'traditional', 'vi')).toBe('T7.5');
    expect(formatMove(mv('c4-e2'), red, 'traditional', 'en')).toBe('E7-5');
    expect(formatMove(mv('c4-e2'), red, 'traditional', 'vi')).toBe('T7/5');
    expect(formatMove(mv('d0-e1'), red, 'traditional', 'en')).toBe('A6+5');
    expect(formatMove(mv('d0-e1'), red, 'traditional', 'vi')).toBe('S6.5');
    expect(formatMove(mv('d2-e1'), red, 'traditional', 'en')).toBe('A6-5');
    expect(formatMove(mv('d2-e1'), red, 'traditional', 'vi')).toBe('S6/5');
    const black = positionFromPieces({ d0: 'K', e9: 'k', f9: 'a', f7: 'a', g9: 'b', g5: 'b' }, 'black');
    expect(formatMove(mv('f9-e8'), black, 'traditional', 'en')).toBe('A6+5');
    expect(formatMove(mv('f9-e8'), black, 'traditional', 'vi')).toBe('S6.5');
    expect(formatMove(mv('f7-e8'), black, 'traditional', 'en')).toBe('A6-5');
    expect(formatMove(mv('f7-e8'), black, 'traditional', 'vi')).toBe('S6/5');
    expect(formatMove(mv('g9-e7'), black, 'traditional', 'en')).toBe('E7+5');
    expect(formatMove(mv('g9-e7'), black, 'traditional', 'vi')).toBe('T7.5');
    expect(formatMove(mv('g5-e7'), black, 'traditional', 'en')).toBe('E7-5');
    expect(formatMove(mv('g5-e7'), black, 'traditional', 'vi')).toBe('T7/5');
  });

  it('numbers three or more Soldiers on one file, and adds the file when two files have groups', () => {
    const three = positionFromPieces({ e0: 'K', d9: 'k', e5: 'P', e6: 'P', e7: 'P' }, 'red');
    expect(formatMove(mv('e7-e8'), three, 'traditional', 'en')).toBe('1P+1');
    expect(formatMove(mv('e6-d6'), three, 'traditional', 'en')).toBe('2P=6');
    expect(formatMove(mv('e5-f5'), three, 'traditional', 'en')).toBe('3P=4');
    expect(formatMove(mv('e7-e8'), three, 'traditional', 'vi')).toBe('Bt.1');
    expect(formatMove(mv('e6-d6'), three, 'traditional', 'vi')).toBe('Bg-6');
    expect(formatMove(mv('e5-f5'), three, 'traditional', 'vi')).toBe('Bs-4');
    const four = positionFromPieces({ e0: 'K', d9: 'k', e5: 'P', e6: 'P', e7: 'P', e8: 'P' }, 'red');
    expect(formatMove(mv('e6-d6'), four, 'traditional', 'en')).toBe('3P=6');
    expect(formatMove(mv('e6-d6'), four, 'traditional', 'vi')).toBe('3B-6');
    const twoFiles = positionFromPieces({ e0: 'K', e9: 'k', d5: 'P', d6: 'P', f5: 'P', f6: 'P' }, 'red');
    expect(formatMove(mv('d6-d7'), twoFiles, 'traditional', 'en')).toBe('+P6+1');
    expect(formatMove(mv('f5-g5'), twoFiles, 'traditional', 'vi')).toBe('Bs4-3');
  });

  it('reads the same for the twin turned 180° with colours swapped (each side counts from its own right)', () => {
    const red = positionFromPieces({ ...K, c4: 'N', h4: 'R', a0: 'R', a3: 'R' }, 'red');
    const black = mirrorFiles(swapColours(red));
    const files = 'abcdefghi';
    const flip = (s: string) => s.replace(/([a-i])(\d)/g, (_, f: string, r: string) => `${files[8 - files.indexOf(f)]}${9 - Number(r)}`);
    for (const move of ['c4-b2', 'c4-d6', 'h4-h1', 'h4-c4', 'a3-a5', 'a0-b0']) {
      for (const lang of ['en', 'vi'] as const) {
        expect(formatMove(mv(flip(move)), black, 'traditional', lang), move).toBe(formatMove(mv(move), red, 'traditional', lang));
      }
    }
  });

  it('writes ICCS squares for the internal notation, and refuses an empty from-square', () => {
    expect(formatMove(mv('h2-e2'), start, 'iccs', 'vi')).toBe('h2-e2');
    expect(() => formatMove(mv('e4-e5'), start)).toThrow(/no piece on e4/);
  });
});
