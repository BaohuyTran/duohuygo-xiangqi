import { describe, expect, it } from 'vitest';
import { START_FEN, legalMoves, makeMove, parseFen, parseSquare as sq, positionFromPieces, squareName, type Position } from '../engine';
import { captureGain as lessonCaptureGain } from '../lessons/answers';
import {
  blockedHorseLegs,
  cannonLines,
  captureGain,
  connectedSoldierPairs,
  controlMap,
  crossedSoldiers,
  development,
  enPrisePieces,
  generalFileExposure,
  generalFileOpen,
  piecesAhead,
  soldierFileStatus,
  hangingPieces,
  hasCrossedRiver,
  legalAttackers,
  mobility,
  palaceDefenders,
  palacePointsAttacked,
  pieceCount,
  pieceMobility,
  soldierBlocked,
} from './features';

const MID = 'r1bakabr1/9/1cn3nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKABR1 w - - 6 4';
const names = (squares: readonly number[]) => squares.map(squareName).sort();
const play = (pos: Position, ...moves: string[]) =>
  moves.reduce((p, m) => makeMove(p, { from: sq(m.slice(0, 2)), to: sq(m.slice(2)) }), pos);

describe('attack and defence', () => {
  // Black horse d7 attacked by the red chariot d4 (d5, d6 empty), defended by the advisor e8.
  const defended = positionFromPieces({ e0: 'K', d9: 'k', d4: 'R', d7: 'n', e8: 'a' }, 'red');
  const loose = positionFromPieces({ e0: 'K', d9: 'k', d4: 'R', d7: 'n' }, 'red');

  it('controlMap lists attackers and defenders, own pieces included', () => {
    const map = controlMap(defended.board);
    expect(names(map.red[sq('d7')])).toEqual(['d4']);
    expect(names(map.black[sq('d7')])).toEqual(['e8']);
    expect(names(map.red[sq('d5')])).toEqual(['d4']);
  });

  it('cannon control = capture squares behind exactly one screen (not its sliding squares)', () => {
    const slide = positionFromPieces({ e0: 'K', d9: 'k', a7: 'C' }, 'red');
    const m1 = controlMap(slide.board);
    expect(m1.red.flatMap((by, s) => (by.includes(sq('a7')) ? [squareName(s)] : []))).toEqual([]);
    const screened = positionFromPieces({ e0: 'K', d9: 'k', e3: 'C', e6: 'p', e2: 'P' }, 'red');
    const m2 = controlMap(screened.board);
    const ctl = names(m2.red.flatMap((by, s) => (by.includes(sq('e3')) ? [s] : [])));
    // Up: screen e6, then e7, e8, e9. Down: screen e2, then e1 and the own general e0 (defended).
    expect(ctl).toEqual(['e0', 'e1', 'e7', 'e8', 'e9']);
    // The black soldier e6 is not attacked by the cannon (no screen in between).
    expect(m2.red[sq('e6')]).toEqual([]);
  });

  it('hanging = attacked and undefended; en prise also counts a cheaper attacker', () => {
    expect(hangingPieces(defended.board, 'black')).toEqual([]);
    expect(names(hangingPieces(loose.board, 'black'))).toEqual(['d7']);
    expect(enPrisePieces(defended.board, 'black')).toEqual([]);
    // A red soldier on d6 (crossed) attacks the defended horse: soldier 1 < horse 4.
    const bySoldier = positionFromPieces({ e0: 'K', d9: 'k', d6: 'P', d7: 'n', e8: 'a' }, 'red');
    expect(hangingPieces(bySoldier.board, 'black')).toEqual([]);
    expect(names(enPrisePieces(bySoldier.board, 'black'))).toEqual(['d7']);
  });

  it('legalAttackers ignores a pinned attacker that controlMap counts', () => {
    // The red chariot e3 shields its general from the black chariot e8: it may not leave the file.
    const pinned = positionFromPieces({ e0: 'K', e3: 'R', e8: 'r', d9: 'k', c3: 'n' }, 'red');
    expect(names(controlMap(pinned.board).red[sq('c3')])).toEqual(['e3']);
    expect(legalAttackers(pinned.board, sq('c3'), 'red')).toEqual([]);
    expect(names(legalAttackers(pinned.board, sq('e8'), 'red'))).toEqual(['e3']);
  });

  it('captureGain matches the lesson helper on every capture of several positions', () => {
    const fens = [MID, '4C1b1c/5k3/9/9/6b2/6n2/9/3K5/6p2/9 w - - 0 1', 'C1ba5/4k4/3ab1c2/9/9/2B3R2/9/6r2/3K5/r2A3p1 w - - 0 1'];
    let captures = 0;
    for (const fen of fens) {
      const pos = parseFen(fen);
      for (const m of legalMoves(pos).filter((x) => pos.board[x.to])) {
        captures++;
        expect(captureGain(pos, m)).toBe(lessonCaptureGain(pos, m));
      }
    }
    expect(captures).toBeGreaterThan(3);
    // wm-01: the cannon takes the cannon i9 over the elephant screen; nothing recaptures.
    expect(captureGain(parseFen(fens[1]), { from: sq('e9'), to: sq('i9') })).toBe(4.5);
  });
});

describe('mobility', () => {
  const start = parseFen(START_FEN);

  it('per piece, with horse legs and elephant eyes (start position)', () => {
    expect(pieceMobility(start.board, sq('b0'))).toBe(2); // a2, c2; d1 blocked by the elephant c0
    expect(pieceMobility(start.board, sq('c0'))).toBe(2); // a2, e2
    expect(pieceMobility(start.board, sq('a0'))).toBe(2); // a1, a2
    // b3-b6, b9 over the screen b7, b1, a2, c2-g2
    expect(pieceMobility(start.board, sq('b2'))).toBe(12);
    expect(pieceMobility(start.board, sq('e5'))).toBe(0); // empty square
  });

  it('sums to the 44 legal moves of the start position (general excluded unless asked)', () => {
    expect(mobility(start.board, 'red', true)).toBe(44);
    expect(mobility(start.board, 'red')).toBe(43); // the general's only move is e1
    expect(mobility(start.board, 'black', true)).toBe(44);
  });

  it('counts only legal moves of a pinned piece', () => {
    const pinned = positionFromPieces({ e0: 'K', e3: 'R', e8: 'r', d9: 'k' }, 'red');
    expect(pieceMobility(pinned.board, sq('e3'))).toBe(7); // e1, e2, e4-e7 and e8; nothing off the file
  });
});

describe('piece geometry', () => {
  const start = parseFen(START_FEN);

  it('horse legs', () => {
    // Only legs that block an on-board jump: a0 next to b0 would only guard jumps off the board.
    expect(names(blockedHorseLegs(start.board, sq('b0')))).toEqual(['c0']);
    expect(names(blockedHorseLegs(start.board, sq('h0')))).toEqual(['g0']);
    const free = positionFromPieces({ e0: 'K', d9: 'k', e4: 'N' }, 'red');
    expect(blockedHorseLegs(free.board, sq('e4'))).toEqual([]);
  });

  it('cannon screens and targets', () => {
    const lines = Object.fromEntries(cannonLines(start.board, sq('b2')).map((l) => [l.direction, l]));
    expect(lines.up).toEqual({ direction: 'up', screen: sq('b7'), target: sq('b9') });
    expect(lines.down).toEqual({ direction: 'down', screen: sq('b0'), target: null });
    expect(lines.left).toEqual({ direction: 'left', screen: null, target: null });
    expect(lines.right).toEqual({ direction: 'right', screen: sq('h2'), target: null });
  });

  it('soldiers on a file (the chess pawn notion, not the Xiangqi open file)', () => {
    expect(soldierFileStatus(start.board, 0, 'red')).toBe('own-soldier');
    expect(soldierFileStatus(start.board, 1, 'red')).toBe('no-soldiers');
    const noA3 = play(start, 'a3a4', 'a6a5', 'a4a5'); // Red's a-soldier takes Black's
    expect(soldierFileStatus(noA3.board, 0, 'red')).toBe('own-soldier');
    expect(soldierFileStatus(noA3.board, 0, 'black')).toBe('enemy-soldiers-only');
  });

  it('pieces ahead on the file (Xiangqi open file = none)', () => {
    // At the start the b-file holds horses and cannons: the cannon b2 has b7 and b9 ahead.
    expect(names(piecesAhead(start.board, sq('b2')))).toEqual(['b7', 'b9']);
    expect(names(piecesAhead(start.board, sq('a0')))).toEqual(['a3', 'a6', 'a9']);
    const open = positionFromPieces({ e0: 'K', d9: 'k', b3: 'R', b1: 'N', b8: 'r' }, 'black');
    expect(piecesAhead(open.board, sq('b3')).map(squareName)).toEqual(['b8']);
    // Black looks down the board: the chariot b8 has b3 and b1 ahead, nearest first.
    expect(piecesAhead(open.board, sq('b8')).map(squareName)).toEqual(['b3', 'b1']);
  });

  it('crossed, connected and blocked soldiers', () => {
    const pos = positionFromPieces({ e0: 'K', d9: 'k', d5: 'P', e5: 'P', g3: 'P', d6: 'n' }, 'red');
    expect(names(crossedSoldiers(pos.board, 'red'))).toEqual(['d5', 'e5']);
    expect(hasCrossedRiver(pos.board, sq('g3'))).toBe(false);
    expect(connectedSoldierPairs(pos.board, 'red').map(names)).toEqual([['d5', 'e5']]);
    expect(soldierBlocked(pos.board, sq('d5'))).toBe(true);
    expect(soldierBlocked(pos.board, sq('e5'))).toBe(false);
    expect(soldierBlocked(pos.board, sq('d6'))).toBe(false); // not a soldier
  });
});

describe('palace and development', () => {
  const start = parseFen(START_FEN);
  const mid = parseFen(MID);

  it('general file exposure: chariot and cannon cases, both colours', () => {
    // Start: Red's e-file has e3 then e6 in front; the empty e4/e5 behind e3 is a cannon point.
    expect(generalFileExposure(start.board, 'red')).toEqual({ blockers: [sq('e3'), sq('e6'), sq('e9')], chariot: false, cannon: true });
    expect(generalFileExposure(start.board, 'black')).toMatchObject({ chariot: false, cannon: true });
    // One piece in front and empty beyond: closed for a chariot, open for a cannon.
    const one = positionFromPieces({ e0: 'K', e1: 'A', d9: 'k' }, 'red');
    expect(generalFileExposure(one.board, 'red')).toMatchObject({ chariot: false, cannon: true });
    // e1 then e2 right behind it: no empty square behind exactly one blocker, so no cannon point.
    const two = positionFromPieces({ e0: 'K', e1: 'A', e2: 'B', e3: 'P', d9: 'k' }, 'red');
    expect(generalFileExposure(two.board, 'red')).toMatchObject({ chariot: false, cannon: false });
    // Black: advisor e8 and elephant e7 adjacent in front of the general: closed for both.
    const black = positionFromPieces({ e9: 'k', e8: 'a', e7: 'b', d0: 'K' }, 'black');
    expect(generalFileExposure(black.board, 'black')).toMatchObject({ chariot: false, cannon: false });
    const blackOpen = positionFromPieces({ e9: 'k', d0: 'K' }, 'black');
    expect(generalFileExposure(blackOpen.board, 'black')).toMatchObject({ blockers: [], chariot: true, cannon: false });
    // Behind e7 a red cannon would need two screens: still closed.
    const checked = positionFromPieces({ e9: 'k', e8: 'a', e7: 'b', e5: 'C', d0: 'K' }, 'black');
    expect(generalFileExposure(checked.board, 'black')).toMatchObject({ chariot: false, cannon: false });
    // Only the advisor e8 in front, the red cannon e5 behind it (it gives check): open for a cannon.
    const cannonChecks = positionFromPieces({ e9: 'k', e8: 'a', e5: 'C', d0: 'K' }, 'black');
    expect(generalFileExposure(cannonChecks.board, 'black')).toMatchObject({ chariot: false, cannon: true });
  });

  it('palace defenders and the general file', () => {
    expect(palaceDefenders(start.board, 'red')).toBe(4);
    expect(generalFileOpen(start.board, 'red')).toBe(false); // the soldier e3
    const bare = positionFromPieces({ e0: 'K', f9: 'k', a0: 'A' }, 'red');
    expect(generalFileOpen(bare.board, 'red')).toBe(true);
    expect(palaceDefenders(bare.board, 'black')).toBe(0);
  });

  it('palace points attacked', () => {
    // The red chariot e5 controls e6-e9: three points of Black's palace (e7, e8, e9).
    const pos = positionFromPieces({ e0: 'K', d9: 'k', e5: 'R' }, 'red');
    expect(palacePointsAttacked(pos.board, 'black')).toBe(3);
    expect(palacePointsAttacked(start.board, 'black')).toBe(0);
    // A cannon on an empty rank controls nothing: it slides there but cannot capture there.
    const slide = positionFromPieces({ e0: 'K', d9: 'k', a7: 'C' }, 'red');
    expect(palacePointsAttacked(slide.board, 'black')).toBe(0);
    // A cannon with the screen e6 controls e7, e8 (empty) and e9 (behind exactly one screen).
    const screened = positionFromPieces({ e0: 'K', d9: 'k', e3: 'C', e6: 'p' }, 'red');
    expect(palacePointsAttacked(screened.board, 'black')).toBe(3);
  });

  it('development count', () => {
    expect(development(start.board, 'red')).toEqual({
      developed: 0,
      chariotsOut: 0,
      horsesOut: 0,
      blockedHorses: 2,
      freeHorses: 0,
      defendersMoved: 0,
    });
    expect(development(play(start, 'c0e2', 'g9e7', 'f0e1').board, 'red')).toMatchObject({ developed: 0, defendersMoved: 2 });
    // mid: Red chariot h0 (out of the corner), horse g2, cannon e2; Black chariot h9, horses c7 and g7.
    expect(development(mid.board, 'red')).toMatchObject({ developed: 3, chariotsOut: 1, horsesOut: 1 });
    expect(development(mid.board, 'black')).toMatchObject({ developed: 3, chariotsOut: 1, horsesOut: 2 });
    expect(pieceCount(start.board)).toBe(32);
  });
});
