import { describe, expect, it } from 'vitest';
import { START_FEN, materialBalance, parseFen, positionFromPieces } from '../engine';
import { DEFAULT_WEIGHTS, evaluateTerms, featureEvaluator, materialEval } from './eval';

const MID = 'r1bakabr1/9/1cn3nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKABR1 w - - 6 4';

describe('evaluation', () => {
  it('materialEval is the engine material balance', () => {
    const mid = parseFen(MID);
    const pos = positionFromPieces({ e0: 'K', d9: 'k', a0: 'R', b9: 'n', c5: 'P' }, 'red');
    for (const p of [mid, pos]) for (const side of ['red', 'black'] as const) expect(materialEval(p.board, side)).toBe(materialBalance(p.board, side));
  });

  it('every term is zero in the symmetric start position', () => {
    expect(evaluateTerms(parseFen(START_FEN).board, 'red')).toEqual({
      material: 0,
      mobility: 0,
      palacePressure: 0,
      hanging: 0,
      crossedSoldiers: 0,
      total: 0,
    });
  });

  it('terms are reported separately and are antisymmetric between the sides', () => {
    const board = parseFen(MID).board;
    const red = evaluateTerms(board, 'red');
    const black = evaluateTerms(board, 'black');
    for (const k of ['material', 'mobility', 'palacePressure', 'hanging', 'crossedSoldiers', 'total'] as const) {
      expect(red[k] + black[k]).toBeCloseTo(0, 10);
    }
    expect(red.total).toBeCloseTo(red.material + red.mobility + red.palacePressure + red.hanging + red.crossedSoldiers, 10);
    expect(featureEvaluator()(board, 'red')).toBe(red.total);
  });

  it('hanging piece term: an undefended horse attacked by a chariot (hand-checked)', () => {
    // Red chariot a5 attacks the black horse a8 along the a-file; nothing defends it, and the
    // horse (targets b6, c7, c9) does not attack the chariot.
    const board = positionFromPieces({ e0: 'K', d9: 'k', a5: 'R', a8: 'n' }, 'red').board;
    expect(evaluateTerms(board, 'red').hanging).toBeCloseTo(DEFAULT_WEIGHTS.hanging * 4, 10);
    expect(evaluateTerms(board, 'black').hanging).toBeCloseTo(-DEFAULT_WEIGHTS.hanging * 4, 10);
  });

  it('crossed soldier and palace pressure terms (hand-checked)', () => {
    const soldier = positionFromPieces({ e0: 'K', d9: 'k', a5: 'P' }, 'red').board;
    expect(evaluateTerms(soldier, 'red').crossedSoldiers).toBe(DEFAULT_WEIGHTS.crossedSoldier);
    // Red chariot e5: e7, e8, e9 are Black palace points it controls; Black has nothing on Red's palace.
    const chariot = positionFromPieces({ e0: 'K', d9: 'k', e5: 'R' }, 'red').board;
    expect(evaluateTerms(chariot, 'red').palacePressure).toBeCloseTo(3 * DEFAULT_WEIGHTS.palacePressure, 10);
  });

  it('mobility term counts pseudo-legal moves of non-general pieces (hand-checked)', () => {
    // Red chariot e4 on an empty board apart from the generals (d0, f9): 8 + 9 = 17 squares.
    const board = positionFromPieces({ d0: 'K', f9: 'k', e4: 'R' }, 'red').board;
    expect(evaluateTerms(board, 'red').mobility).toBeCloseTo(17 * DEFAULT_WEIGHTS.mobility, 10);
  });

  it('custom weights change only their own term', () => {
    const board = parseFen(MID).board;
    const base = evaluateTerms(board, 'red');
    const noMobility = evaluateTerms(board, 'red', { ...DEFAULT_WEIGHTS, mobility: 0 });
    expect(noMobility.mobility).toBe(0);
    expect(noMobility.palacePressure).toBe(base.palacePressure);
    expect(noMobility.hanging).toBe(base.hanging);
  });
});
