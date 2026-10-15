import { describe, expect, it } from 'vitest';
import { gameStatus, isInCheck, legalMoves, parseFen, positionFromPieces, START_FEN, squareName } from './index';

describe('check', () => {
  it('starting position is not check', () => {
    expect(gameStatus(parseFen(START_FEN))).toEqual({ kind: 'ongoing' });
  });

  it.each([
    ['chariot', { d0: 'K', e9: 'k', e5: 'R' }],
    ['horse', { d0: 'K', e9: 'k', f7: 'N' }],
    ['cannon over a screen', { d0: 'K', e9: 'k', e5: 'C', e7: 'P' }],
    ['soldier from the front', { d0: 'K', e9: 'k', e8: 'P' }],
    ['soldier from the side', { d0: 'K', e9: 'k', d9: 'P' }],
  ])('detects check by a %s', (_name, pieces) => {
    const pos = positionFromPieces(pieces, 'black');
    expect(isInCheck(pos)).toBe(true);
    expect(gameStatus(pos).kind).toBe('check');
  });

  it.each([
    ['cannon without a screen', { d0: 'K', e9: 'k', e5: 'C' }],
    ['cannon with two screens', { d0: 'K', e9: 'k', e5: 'C', e6: 'P', e7: 'p' }],
    ['horse with a blocked leg', { d0: 'K', e9: 'k', f7: 'N', f8: 'p' }],
    ['soldier behind the general', { d0: 'K', e8: 'k', e9: 'P' }],
  ])('no check from a %s', (_name, pieces) => {
    expect(isInCheck(positionFromPieces(pieces, 'black'))).toBe(false);
  });

  it('only escape is the one not facing the other general', () => {
    // Chariot checks along the e-file; d9 would face the red general on the open d-file.
    const pos = positionFromPieces({ d0: 'K', e9: 'k', e5: 'R' }, 'black');
    expect(legalMoves(pos).map((m) => squareName(m.to))).toEqual(['f9']);
  });
});

describe('checkmate', () => {
  it('double chariot mate on the back ranks', () => {
    const pos = positionFromPieces({ d0: 'K', e9: 'k', a9: 'R', a8: 'R' }, 'black');
    expect(gameStatus(pos)).toEqual({ kind: 'checkmate', winner: 'red' });
  });

  it('double cannon mate where a block does not help', () => {
    // Moving an advisor to e8 just becomes the screen for the cannon on e7.
    const pos = positionFromPieces({ d0: 'K', e9: 'k', d9: 'a', f9: 'a', e5: 'C', e7: 'C' }, 'black');
    expect(gameStatus(pos)).toEqual({ kind: 'checkmate', winner: 'red' });
  });

  it('flying general helps deliver mate', () => {
    // Red general on d0 controls the d-file; chariot on f-file and soldier on e8 do the rest.
    const pos = positionFromPieces({ d0: 'K', e9: 'k', f1: 'R', e7: 'P', e8: 'P' }, 'black');
    expect(gameStatus(pos)).toEqual({ kind: 'checkmate', winner: 'red' });
  });

  it('black can checkmate red', () => {
    const pos = positionFromPieces({ e0: 'K', i0: 'r', i1: 'r', f9: 'k' }, 'red');
    expect(gameStatus(pos)).toEqual({ kind: 'checkmate', winner: 'black' });
  });

  it('is not mate when the check can be blocked', () => {
    // The black chariot can interpose on b9.
    const pos = positionFromPieces({ d0: 'K', e9: 'k', a9: 'R', a8: 'R', b7: 'r' }, 'black');
    expect(gameStatus(pos).kind).toBe('check');
  });
});

describe('stalemate (a loss in Xiangqi)', () => {
  it('side to move with no legal moves and not in check loses', () => {
    // d9 faces the red general, f9 is covered by the chariot on f1, e8 by the chariot on a8.
    const pos = positionFromPieces({ d0: 'K', e9: 'k', f1: 'R', a8: 'R' }, 'black');
    expect(isInCheck(pos)).toBe(false);
    expect(legalMoves(pos)).toEqual([]);
    expect(gameStatus(pos)).toEqual({ kind: 'stalemate', winner: 'red' });
  });

  it('is not stalemate when another piece can still move', () => {
    const pos = positionFromPieces({ d0: 'K', e9: 'k', f1: 'R', a8: 'R', a3: 'p' }, 'black');
    expect(gameStatus(pos)).toEqual({ kind: 'ongoing' });
  });

  it('pinned and blocked pieces do not count as moves', () => {
    // Black's only other piece is a horse pinned against its general by the flying-general rule.
    const pos = positionFromPieces({ e0: 'K', e9: 'k', e8: 'n', d1: 'R', f1: 'R' }, 'black');
    expect(gameStatus(pos)).toEqual({ kind: 'stalemate', winner: 'red' });
  });
});
