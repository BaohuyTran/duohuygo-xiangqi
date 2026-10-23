import { describe, expect, it } from 'vitest';
import {
  START_FEN,
  hasForcedWin,
  legalMoves,
  makeMove,
  materialBalance,
  forcedWinMoves,
  isGeneralAttacked,
  moveScore,
  parseFen,
  parseSquare,
  positionFromPieces,
  searchScore,
  type Move,
  type Position,
} from '../engine';
import { captureGain as lessonCaptureGain } from '../lessons/answers';
import { WIN_MATERIAL_THRESHOLD } from '../puzzles/logic';
import {
  R1_PENALTIES,
  WINNING_CAPTURE_THRESHOLD,
  SAFETY_GUARDS,
  chooseWinningCapture,
  evaluatePredicate,
  guardForUnit,
  largestPenalty,
  moveSignals,
  predicateErrors,
  safetyGuard,
  threatAfterMove,
  threatAtEnd,
  threatOf,
  trackPiece,
  winningCaptures,
  type Predicate,
} from './judge';

const mv = (s: string): Move => ({ from: parseSquare(s.slice(0, 2)), to: parseSquare(s.slice(2, 4)) });
const { basics, advanced } = SAFETY_GUARDS;

// Hand-checked positions (Red to move unless stated).
// HANG: a1-i1 puts the chariot on the file of the black chariot i8 for nothing; a1-a2 is safe.
const HANG = positionFromPieces({ e0: 'K', a1: 'R', d9: 'k', i8: 'r' }, 'red');
// LOSE_ONE: the black chariot e2 attacks both red elephants (a2, i2) along rank 2; no red move saves
// both (each elephant can only go to c0/c4 or g0/g4), so every move loses 2 = T.
const LOSE_ONE = positionFromPieces({ d0: 'K', a2: 'B', i2: 'B', f9: 'k', e2: 'r' }, 'red');
// MATED_ANYWAY: Black (chariots f8, g0) mates in 1 after every one of Red's 4 moves.
const MATED_ANYWAY = parseFen('4k4/5r3/9/P8/9/9/9/3K5/9/5Ar2 w - - 0 1');
// MATE_THREAT: Black threatens mate in 1; d8-f8 / d8-d2 parry it, d8-h8 allows it.
const MATE_THREAT = parseFen('4k4/3R5/9/9/9/8r/9/9/5K3/1r7 w - - 0 1');
// wm-01: the cannon e9 takes the cannon i9 for free; any other move loses the cannon e9 (the black
// cannon i9 hits it over the elephant g9) unless the cannon steps off rank 9.
const WM01 = parseFen('4C1b1c/5k3/9/9/6b2/6n2/9/3K5/6p2/9 w - - 0 1');
// m2-01: mate in 2 starting a6-b8.
const M201 = parseFen('9/7P1/3k1a3/N8/C5b2/2B6/9/p8/p8/4KA3 w - - 0 1');
// THREAT: a1-a7 (or a1-c1) attacks the loose horse c7 without check; a1-a2 threatens nothing.
const THREAT = positionFromPieces({ d0: 'K', a1: 'R', e9: 'k', d9: 'a', f9: 'a', e7: 'b', c7: 'n' }, 'red');

describe('safety horizon per level (03 §5.3)', () => {
  it('h, k, T per level', () => {
    expect(SAFETY_GUARDS.basics).toMatchObject({ h: 1, k: 1, T: 2, missedGain: 'free-capture', missedMate: 1 });
    for (const level of ['intermediate', 'advanced', 'expert', 'master'] as const) {
      expect(SAFETY_GUARDS[level]).toMatchObject({ h: 2, k: 2, T: 2, missedGain: 'search' });
    }
    expect(SAFETY_GUARDS.advanced.missedMate).toBe(2);
  });

  it('guardForUnit applies the Intermediate refinements (gains from i02, mate in 2 from i05)', () => {
    expect(guardForUnit('b05l2')).toEqual(basics);
    expect(guardForUnit('i01')).toMatchObject({ missedGain: 'free-capture', missedMate: 1 });
    expect(guardForUnit('i02-c01')).toMatchObject({ missedGain: 'search', missedMate: 1 });
    expect(guardForUnit('i05')).toMatchObject({ missedGain: 'search', missedMate: 2 });
    expect(guardForUnit('m09')).toEqual(SAFETY_GUARDS.master);
    expect(() => guardForUnit('u15l3')).toThrow();
  });
});

describe('signals (03 §5.3)', () => {
  it('allowed loss: serious when the excess over the best move is ≥ 4; S(m) = moveScore(P, m, h + 1)', () => {
    const s = moveSignals(HANG, mv('a1i1'), basics);
    expect(s.status).toBe('checked');
    expect(s.score).toBe(moveScore(HANG, mv('a1i1'), 2));
    expect(s.best).toBe(searchScore(HANG, 2));
    expect(s.allowedLoss).toEqual({ loss: 9, excess: 9, serious: true, mate: false });
    expect(s.penalty).toBe('serious-allowed-loss');
  });

  it('the second (all-moves) search runs only when the move is suspicious', () => {
    const safe = moveSignals(HANG, mv('a1a2'), basics);
    expect(safe.allowedLoss).toBeNull();
    expect(safe.best).toBeNull();
    expect(safe.penalty).toBeNull();
  });

  it('an unavoidable loss is not penalised', () => {
    const B = materialBalance(LOSE_ONE.board, 'red');
    expect(searchScore(LOSE_ONE, 2) - B).toBe(-2); // every move loses an elephant
    for (const m of legalMoves(LOSE_ONE)) {
      const s = moveSignals(LOSE_ONE, m, basics);
      expect(s.best).not.toBeNull(); // L(m) ≥ T, so the second search ran
      expect(s.allowedLoss).toBeNull();
      expect(s.penalty).toBeNull();
    }
  });

  it('an unavoidable mate is neither an allowed mate nor an allowed loss', () => {
    const moves = legalMoves(MATED_ANYWAY);
    expect(moves.length).toBe(4);
    for (const m of moves) {
      expect(hasForcedWin(makeMove(MATED_ANYWAY, m), 1)).toBe(true);
      const s = moveSignals(MATED_ANYWAY, m, basics);
      expect(s).toMatchObject({ allowedMate: false, allowedLoss: null, penalty: null });
    }
  });

  it('allowed mate when an alternative avoids it; the threat already existed (unanswered)', () => {
    const bad = moveSignals(MATE_THREAT, mv('d8h8'), basics, { threats: true });
    expect(bad.allowedMate).toBe(true);
    expect(bad.unansweredThreat).toBe(true);
    // Also a serious loss by the search, but one move gets one penalty: the largest.
    expect(bad.allowedLoss?.serious).toBe(true);
    expect(bad.penalty).toBe('allowed-mate');
    for (const good of ['d8f8', 'd8d2']) {
      expect(moveSignals(MATE_THREAT, mv(good), basics, { threats: true })).toMatchObject({
        allowedMate: false,
        allowedLoss: null,
        unansweredThreat: false,
        penalty: null,
      });
    }
  });

  it('Basic missed gain = a free capture not taken; one penalty per move', () => {
    const take = moveSignals(WM01, mv('e9i9'), basics);
    expect(take).toMatchObject({ missedGain: false, allowedLoss: null, penalty: null });
    // Stepping off rank 9 keeps the cannon but misses the free cannon: missed gain only.
    const away = moveSignals(WM01, mv('e9e6'), basics);
    expect(away).toMatchObject({ missedGain: true, allowedLoss: null, penalty: 'missed-gain' });
    // Staying on rank 9 also loses the cannon: missed gain AND serious loss, penalised once (50).
    const stay = moveSignals(WM01, mv('e9d9'), basics);
    expect(stay.missedGain).toBe(true);
    expect(stay.allowedLoss).toEqual({ loss: 4.5, excess: 9, serious: true, mate: false });
    expect(stay.penalty).toBe('serious-allowed-loss');
    expect(R1_PENALTIES[stay.penalty!]).toBe(50);
  });

  it('missed mate within the level depth (mate in 2 counted from Advanced, not at Basic)', () => {
    expect(moveSignals(M201, mv('a6b8'), advanced)).toMatchObject({ missedMate: false, penalty: null });
    const quiet = mv('e0e1');
    const adv = moveSignals(M201, quiet, advanced);
    expect(adv.missedMate).toBe(true);
    expect(adv.missedGain).toBe(true); // the search sees the mate as a gain too
    expect(adv.penalty).toBe('missed-mate'); // 25 beats 15
    expect(moveSignals(M201, quiet, basics)).toMatchObject({ missedMate: false, penalty: null });
  });

  it('Basic missed gain applies the S conditions to the free captures (Black to move)', () => {
    // h0xc0 takes a free horse but lets Red mate in 1: refusing it (h0-e0) is not a missed gain.
    const poisoned = parseFen('9/9/N2k5/9/9/9/9/4K4/8R/2N4r1 b - - 0 1');
    expect(lessonCaptureGain(poisoned, mv('h0c0'))).toBeGreaterThanOrEqual(2);
    expect(moveSignals(poisoned, mv('h0e0'), basics)).toMatchObject({ score: -8, balance: -8, missedGain: false, penalty: null });
    expect(moveSignals(poisoned, mv('h0c0'), basics).penalty).toBe('allowed-mate');
    // a9xg9 also allows mate; a9-e9 wins 4 points without capturing: no missed gain either.
    const quietWin = parseFen('r5N2/3k5/9/9/9/7R1/9/9/4K4/1R7 b - - 0 1');
    expect(moveSignals(quietWin, mv('a9e9'), basics)).toMatchObject({ score: -9, balance: -13, missedGain: false, penalty: null });
    // A free capture that is really free still counts (wm-01, Red): see the test above.
  });

  it('a mate-sized loss is flagged', () => {
    const s = moveSignals(MATE_THREAT, mv('d8h8'), basics);
    expect(s.allowedLoss).toMatchObject({ serious: true, mate: true });
    expect(moveSignals(HANG, mv('a1i1'), basics).allowedLoss?.mate).toBe(false);
  });

  it('largestPenalty keeps the single largest', () => {
    expect(largestPenalty({ allowedLoss: null, allowedMate: false, missedGain: true, missedMate: true })).toBe('missed-mate');
    expect(largestPenalty({ allowedLoss: { loss: 2, excess: 2, serious: false, mate: false }, allowedMate: false, missedGain: true, missedMate: false })).toBe(
      'allowed-loss',
    );
    expect(largestPenalty({ allowedLoss: null, allowedMate: false, missedGain: false, missedMate: false })).toBeNull();
  });

  it('a node limit gives "not checked" and no penalty', () => {
    const s = moveSignals(HANG, mv('a1i1'), basics, { maxNodes: 3 });
    expect(s).toMatchObject({ status: 'not-checked', penalty: null, allowedLoss: null, score: null });
    expect(moveSignals(HANG, mv('a1i1'), basics, { abort: { aborted: true } }).status).toBe('not-checked');
  });

  it('safetyGuard: layer 1 verdict with the static en-prise fact', () => {
    const bad = safetyGuard(HANG, mv('a1i1'), basics);
    expect(bad).toMatchObject({ status: 'checked', safe: false, allowedMate: false });
    expect(bad.enPrise).toEqual([parseSquare('i1')]);
    expect(safetyGuard(HANG, mv('a1a2'), basics)).toMatchObject({ safe: true, enPrise: [] });
    expect(safetyGuard(MATE_THREAT, mv('d8h8'), basics).safe).toBe(false);
    expect(safetyGuard(HANG, mv('a1i1'), basics, { maxNodes: 2 })).toMatchObject({ status: 'not-checked', safe: false });
  });
});

describe('threat (02 a06)', () => {
  it('a quiet move that attacks a loose piece is a threat; a neutral move is not', () => {
    expect(threatAfterMove(THREAT, mv('a1a7'), advanced)).toMatchObject({ legal: true, mate: false, gain: 4, isThreat: true });
    expect(threatAfterMove(THREAT, mv('a1c1'), advanced).isThreat).toBe(true);
    expect(threatAfterMove(THREAT, mv('a1a2'), advanced)).toMatchObject({ legal: true, gain: 0, isThreat: false });
  });

  it('a check is never a threat: the position with the same side to move again is not legal', () => {
    const pos = positionFromPieces({ e0: 'K', a1: 'R', f9: 'k', c7: 'n' }, 'red');
    expect(threatAfterMove(pos, mv('a1f1'), advanced)).toMatchObject({ legal: false, isThreat: false });
  });

  it('threat at the end: a learner in check faces a threat (R5 is not granted)', () => {
    // Black (the learner) to move and in check from the chariot e5.
    const P = positionFromPieces({ d0: 'K', e9: 'k', e5: 'R', a8: 'R' }, 'black');
    expect(isGeneralAttacked(P.board, 'black')).toBe(true);
    expect(threatAtEnd(P, 'red', advanced)).toMatchObject({ legal: false, check: true, isThreat: true });
    // The a06 quiet-threat test keeps the plain rule: a check is not a quiet threat.
    expect(threatOf(P, 'red', advanced)).toMatchObject({ legal: false, check: true, isThreat: false });
  });

  it('a forced mate within k is a threat', () => {
    // Black, moving again in MATE_THREAT, mates in 1.
    expect(threatOf(MATE_THREAT, 'black', basics)).toMatchObject({ legal: true, mate: true, isThreat: true });
    expect(threatAtEnd(MATE_THREAT, 'black', basics).isThreat).toBe(true);
    expect(threatAtEnd(parseFen(START_FEN), 'black', basics).isThreat).toBe(false);
  });

  it('not checked under a tiny node limit', () => {
    expect(threatAfterMove(THREAT, mv('a1a7'), advanced, { maxNodes: 2 }).status).toBe('not-checked');
  });
});

describe('forcing-attack winning capture (03 §5.2)', () => {
  it('a free piece is a winning capture; depth 3 in positions of ≤ 12 pieces', () => {
    const r = winningCaptures(WM01);
    expect(r.depth).toBe(3);
    expect(r.captures).toEqual([{ move: mv('e9i9'), score: moveScore(WM01, mv('e9i9'), 3), gain: 4.5 }]);
    expect(chooseWinningCapture(WM01, () => 0.7)).toEqual(mv('e9i9'));
  });

  it('a defended piece is not; a full board uses depth 2', () => {
    const defended = positionFromPieces({ e0: 'K', d9: 'k', a1: 'R', a7: 'n', b7: 'r' }, 'red');
    expect(winningCaptures(defended).captures).toEqual([]);
    expect(chooseWinningCapture(defended, () => 0)).toBeNull();
    expect(winningCaptures(parseFen(START_FEN))).toMatchObject({ depth: 2, captures: [] });
  });

  it('uses the puzzles\' WIN_MATERIAL_THRESHOLD', () => {
    expect(WINNING_CAPTURE_THRESHOLD).toBe(WIN_MATERIAL_THRESHOLD);
  });

  it('a gain below T = 2 is not winning', () => {
    // Black keeps its advisors and an elephant so that the chariot finds no mate after taking the soldier.
    const soldier = positionFromPieces({ d0: 'K', e9: 'k', d9: 'a', f9: 'a', e7: 'b', a1: 'R', a6: 'p' }, 'red');
    expect(winningCaptures(soldier).captures).toEqual([]);
    expect(winningCaptures(soldier, { T: 1 }).captures.map((c) => c.move)).toEqual([mv('a1a6')]);
  });

  it('equal winning captures: the seeded random picks; same seed, same move', () => {
    const two = positionFromPieces({ d0: 'K', f9: 'k', e4: 'R', e6: 'n', a4: 'n' }, 'red');
    const r = winningCaptures(two);
    expect(r.captures.map((c) => c.gain)).toEqual([4, 4]);
    const low = chooseWinningCapture(two, () => 0);
    const high = chooseWinningCapture(two, () => 0.99);
    expect([low, high]).toEqual(expect.arrayContaining([mv('e4a4'), mv('e4e6')]));
    expect(low).not.toEqual(high);
    expect(chooseWinningCapture(two, () => 0)).toEqual(low);
  });

  it('not checked under a tiny node limit', () => {
    expect(winningCaptures(WM01, { maxNodes: 1 })).toMatchObject({ status: 'not-checked', captures: [] });
  });
});

describe('objective predicates (04 §5.4 layer 2)', () => {
  const start = parseFen(START_FEN);
  const at = (before: Position, pred: Predicate, ...moves: string[]) => evaluatePredicate(pred, { before, moves: moves.map(mv) });

  it('trackPiece follows a piece through moves and notices captures', () => {
    expect(trackPiece(parseSquare('h2'), [mv('h2e2'), mv('h9g7'), mv('e2e6')])).toBe(parseSquare('e6'));
    expect(trackPiece(parseSquare('e6'), [mv('a0a1'), mv('e9e6')])).toBeNull();
  });

  it('mobility of a named piece (min and increase)', () => {
    // Cannon h2: 12 moves at the start (mirror of b2).
    expect(at(start, { kind: 'mobility', piece: 'h2', min: 12 })).toBe(true);
    // Horse b0 → c2: from c2 it reaches only e1 and b0 (c3 soldier and b2 cannon block legs). 2 → 2.
    expect(at(start, { kind: 'mobility', piece: 'b0', min: 2 }, 'b0c2')).toBe(true);
    expect(at(start, { kind: 'mobility', piece: 'b0', increaseBy: 1 }, 'b0c2')).toBe(false);
    // The chariot a0 after a0-a1: b1-i1 (rank 1 is empty), a2 and back to a0 = 10; before 2.
    expect(at(start, { kind: 'mobility', piece: 'a0', increaseBy: 8, min: 10 }, 'a0a1')).toBe(true);
    expect(at(start, { kind: 'mobility', piece: 'a0', min: 11 }, 'a0a1')).toBe(false);
  });

  it('reach, file, crossed river', () => {
    expect(at(start, { kind: 'reach', piece: 'h2', squares: ['e2'] }, 'h2e2')).toBe(true);
    expect(at(start, { kind: 'reach', piece: 'b2', squares: ['e2'] }, 'h2e2')).toBe(false);
    // Xiangqi open file = no piece in front. At the start the b-file is NOT open (b7, b9).
    expect(at(start, { kind: 'open-file', piece: 'b2' })).toBe(false);
    const files = positionFromPieces({ e0: 'K', d9: 'k', a0: 'R', a3: 'P', b6: 'p', c0: 'B' }, 'red');
    expect(at(files, { kind: 'open-file', piece: 'a0' })).toBe(false); // own soldier a3
    expect(at(files, { kind: 'open-file', piece: 'a0' }, 'a0b0')).toBe(false); // black soldier b6
    expect(at(files, { kind: 'open-file', piece: 'a0', ownOnly: true }, 'a0b0')).toBe(true);
    expect(at(files, { kind: 'open-file', piece: 'a0', maxBlockers: 1 }, 'a0b0')).toBe(true);
    expect(at(files, { kind: 'open-file', piece: 'a0', ownOnly: true })).toBe(false);
    // Black looks down the board: the chariot on i9 with nothing below it on the i-file.
    const black = positionFromPieces({ e0: 'K', d9: 'k', i9: 'r', h0: 'R' }, 'black');
    expect(at(black, { kind: 'open-file', piece: 'i9' })).toBe(true);
    expect(at(black, { kind: 'open-file', piece: 'i9' }, 'i9h9')).toBe(false); // h0 below
    const soldier = positionFromPieces({ e0: 'K', d9: 'k', e4: 'P' }, 'red');
    expect(at(soldier, { kind: 'crossed-river', piece: 'e4' }, 'e4e5')).toBe(true);
    expect(at(soldier, { kind: 'crossed-river', piece: 'e4' })).toBe(false);
  });

  it('development, palace defenders, general file, hanging pieces', () => {
    const moves = ['h2e2', 'h9g7', 'h0g2'];
    expect(at(start, { kind: 'development', min: 2, increaseBy: 2 }, ...moves)).toBe(true);
    expect(at(start, { kind: 'development', measure: 'horses-out', min: 2 }, ...moves)).toBe(false);
    expect(at(start, { kind: 'development', measure: 'horses-out', min: 1 }, ...moves)).toBe(true);
    // Both red horses still have a blocked leg (b0: a0 and c0; g2: the soldier g3).
    expect(at(start, { kind: 'development', measure: 'free-horses', min: 1 }, ...moves)).toBe(false);
    expect(at(start, { kind: 'palace-defenders', min: 4 })).toBe(true);
    // Start: e3 shields the general from a chariot, but e4/e5 behind it are cannon points.
    expect(at(start, { kind: 'general-file', against: 'chariot' })).toBe(true);
    expect(at(start, { kind: 'general-file', against: 'cannon' })).toBe(false);
    expect(at(start, { kind: 'general-file', against: 'both' })).toBe(false);
    // Red: advisor e1 + elephant e2 adjacent in front = closed for both; Black with nothing in front.
    const red = positionFromPieces({ e0: 'K', e1: 'A', e2: 'B', d9: 'k' }, 'red');
    expect(at(red, { kind: 'general-file', against: 'both' })).toBe(true);
    expect(at(red, { kind: 'general-file', against: 'both' }, 'e2c4')).toBe(false); // one screen left
    expect(at(red, { kind: 'general-file', against: 'chariot' }, 'e2c4')).toBe(true);
    const black = positionFromPieces({ e9: 'k', d0: 'K', e8: 'a' }, 'black');
    expect(at(black, { kind: 'general-file', against: 'chariot' })).toBe(true);
    expect(at(black, { kind: 'general-file', against: 'cannon' })).toBe(false);
    expect(at(black, { kind: 'general-file', against: 'chariot' }, 'e8d7')).toBe(false);
    expect(at(black, { kind: 'general-file', against: 'cannon' }, 'e8d7')).toBe(true);
    expect(at(HANG, { kind: 'no-hanging' }, 'a1i1')).toBe(false);
    expect(at(HANG, { kind: 'no-hanging' }, 'a1a2')).toBe(true);
  });

  it('attacks and restricts a named enemy piece', () => {
    expect(at(THREAT, { kind: 'attacks', target: 'c7' }, 'a1a7')).toBe(true);
    expect(at(THREAT, { kind: 'attacks', target: 'c7' }, 'a1a2')).toBe(false);
    // The soldier c5-c6 blocks the horse c7's leg c6: b5 and d5 are gone (8 → 6 moves).
    const horse = positionFromPieces({ e0: 'K', f9: 'k', c5: 'P', c7: 'n' }, 'red');
    expect(at(horse, { kind: 'restricts', target: 'c7', reduceBy: 2, max: 6 }, 'c5c6')).toBe(true);
    expect(at(horse, { kind: 'restricts', target: 'c7', reduceBy: 3 }, 'c5c6')).toBe(false);
  });

  it('soldier structure', () => {
    const pos = positionFromPieces({ e0: 'K', d9: 'k', d5: 'P', f5: 'P', e7: 'n' }, 'red');
    expect(at(pos, { kind: 'crossed-soldiers', min: 2 })).toBe(true);
    expect(at(pos, { kind: 'connected-soldiers' })).toBe(false);
    expect(at(pos, { kind: 'connected-soldiers' }, 'f5e5')).toBe(true);
    expect(at(pos, { kind: 'soldier-blocked', piece: 'f5' }, 'f5e5', 'e7e6')).toBe(true);
    expect(at(pos, { kind: 'soldier-blocked', piece: 'd5', blocked: false }, 'f5e5', 'e7e6')).toBe(true);
  });

  it('captured: the named piece left the board', () => {
    expect(at(start, { kind: 'captured', piece: 'b9' }, 'b2b9')).toBe(true);
    expect(at(start, { kind: 'captured', piece: 'b2' }, 'b2b9')).toBe(false);
    expect(at(start, { kind: 'captured', piece: 'b2' }, 'b2b9', 'a9b9')).toBe(true);
  });

  it('threat predicate with created: true ignores a threat that already existed', () => {
    expect(at(THREAT, { kind: 'threat', created: true }, 'a1a7')).toBe(true);
    // In LOOSE the chariot already attacks the horse; moving along the same rank keeps the threat.
    const loose = positionFromPieces({ d0: 'K', a7: 'R', e9: 'k', d9: 'a', f9: 'a', e7: 'b', c7: 'n' }, 'red');
    expect(at(loose, { kind: 'threat' }, 'a7b7')).toBe(true);
    expect(at(loose, { kind: 'threat', created: true }, 'a7b7')).toBe(false);
  });

  it('threat predicate, combinators and the three-valued "not checked"', () => {
    expect(at(THREAT, { kind: 'threat' }, 'a1a7')).toBe(true);
    expect(at(THREAT, { kind: 'threat' }, 'a1a2')).toBe(false);
    const limited = (pred: Predicate) => evaluatePredicate(pred, { before: THREAT, moves: [mv('a1a7')], limits: { maxNodes: 2 } });
    const unknown: Predicate = { kind: 'threat' };
    const yes: Predicate = { kind: 'reach', piece: 'a1', squares: ['a7'] };
    const no: Predicate = { kind: 'reach', piece: 'a1', squares: ['a2'] };
    expect(limited(unknown)).toBeNull();
    expect(limited({ kind: 'all', of: [yes, unknown] })).toBeNull();
    expect(limited({ kind: 'all', of: [no, unknown] })).toBe(false);
    expect(limited({ kind: 'any', of: [yes, unknown] })).toBe(true);
    expect(limited({ kind: 'any', of: [no, unknown] })).toBeNull();
    expect(limited({ kind: 'not', of: unknown })).toBeNull();
    expect(limited({ kind: 'not', of: no })).toBe(true);
  });

  it('predicates are plain JSON and validated', () => {
    const pred: Predicate = {
      kind: 'all',
      of: [
        { kind: 'mobility', piece: 'b0', increaseBy: 1 },
        { kind: 'not', of: { kind: 'no-hanging' } },
        { kind: 'attacks', target: 'b9' },
      ],
    };
    expect(JSON.parse(JSON.stringify(pred))).toEqual(pred);
    expect(predicateErrors(pred, start)).toEqual([]);
    expect(predicateErrors({ kind: 'magic' })).toEqual(['predicate: unknown kind magic']);
    expect(predicateErrors({ kind: 'mobility', piece: 'z9' })).toEqual([
      'predicate.piece: must be a square name',
      'predicate: needs one of min, increaseBy',
    ]);
    expect(predicateErrors({ kind: 'attacks', target: 'a0' }, start)).toEqual(['predicate.target: a0 is not an enemy piece']);
    expect(predicateErrors({ kind: 'reach', piece: 'e5', squares: ['e6'] }, start)).toEqual(['predicate.piece: no piece on e5']);
    expect(predicateErrors({ kind: 'soldier-blocked', piece: 'a0' }, start)).toEqual(['predicate.piece: a0 is not a soldier']);
    expect(predicateErrors({ kind: 'any', of: [] })).toEqual(['predicate.of: must be a non-empty array']);
    expect(predicateErrors({ kind: 'palace-defenders' })).toEqual(['predicate.min: required']);
    expect(predicateErrors({ kind: 'threat', k: 4, h: 5 })).toEqual([
      'predicate.h: must be a number ≥ 0 and ≤ 3',
      'predicate.k: must be a number ≥ 0 and ≤ 3',
    ]);
    expect(predicateErrors({ kind: 'general-file', against: 'horse' })).toEqual(['predicate.against: must be chariot, cannon or both']);
    expect(predicateErrors({ kind: 'open-file', piece: 'a0', maxBlockers: 1, ownOnly: true }, start)).toEqual([]);
    expect(predicateErrors({ kind: 'captured', piece: 'e5' }, start)).toEqual(['predicate.piece: no piece on e5']);
  });
});

describe('full-board cost and the node cap', () => {
  it('mid position (04 §2.2), advanced guard: checked well inside the 20,000-node cap', () => {
    const mid = parseFen('r1bakabr1/9/1cn3nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKABR1 w - - 6 4');
    // a0-a1 is suspicious (Cxb0 wins the horse), so both searches run; b0-c2 is quiet.
    for (const m of [mv('a0a1'), mv('b0c2')]) {
      const s = moveSignals(mid, m, advanced, { threats: true });
      expect(s.status).toBe('checked');
      expect(s.nodes).toBeLessThan(10_000);
    }
  });
});

describe('spec reference: brute-force 03 §5.3 formulas vs moveSignals (seeded, both colours)', () => {
  // Small random positions (generals in their palaces, pieces anywhere, soldiers across the river),
  // every legal move judged by the engine's moveScore / hasForcedWin / forcedWinMoves directly.
  // Unavoidable-loss rule as implemented: both S(m) and the best are forced-mate losses → no loss.
  const MATE = 50_000;
  let seed = 4242;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
  const PAL_R = ['d0', 'e0', 'f0', 'd1', 'e1', 'f1', 'd2', 'e2', 'f2'];
  const PAL_B = PAL_R.map((x) => x[0] + String(9 - Number(x[1])));
  const anySq = () => 'abcdefghi'[Math.floor(rand() * 9)] + String(Math.floor(rand() * 10));

  function positions(n: number): Position[] {
    const out: Position[] = [];
    while (out.length < n) {
      const pcs: Record<string, string> = { [pick(PAL_R)]: 'K' };
      const bk = pick(PAL_B);
      pcs[bk] = 'k';
      for (const l of ['R', 'r', 'N', 'n', 'C', 'c', 'P', 'p']) {
        if (rand() < 0.4) continue;
        const s = l === 'P' ? 'abcdefghi'[Math.floor(rand() * 9)] + String(5 + Math.floor(rand() * 5)) : l === 'p' ? 'abcdefghi'[Math.floor(rand() * 9)] + String(Math.floor(rand() * 5)) : anySq();
        if (!pcs[s]) pcs[s] = l;
      }
      const P = positionFromPieces(pcs, rand() < 0.5 ? 'red' : 'black');
      const other = P.turn === 'red' ? 'black' : 'red';
      if (isGeneralAttacked(P.board, other) || legalMoves(P).length < 2) continue;
      out.push(P);
    }
    return out;
  }

  // The slowest analysis test (~2.5 s): the brute-force reference searches every move of 8 positions.
  it('allowed loss, allowed mate, missed gain, missed mate and the penalty agree', () => {
    let judged = 0;
    const colours = new Set<string>();
    const kinds: Record<string, number> = {};
    for (const [i, P] of positions(8).entries()) {
      const g = i % 2 === 0 ? basics : SAFETY_GUARDS.intermediate;
      colours.add(P.turn);
      const d = g.h + 1;
      const B = materialBalance(P.board, P.turn);
      const moves = legalMoves(P);
      const S = moves.map((m) => moveScore(P, m, d));
      const top = Math.max(...S);
      const mateWins = g.missedMate > 0 && hasForcedWin(P, g.missedMate) ? forcedWinMoves(P, g.missedMate) : null;
      const mates = moves.map((m) => hasForcedWin(makeMove(P, m), g.k));
      moves.forEach((m, j) => {
        const lossMate = S[j] < -MATE && top < -MATE;
        const al = B - S[j] >= g.T && top - S[j] >= g.T && !lossMate;
        const serious = al && top - S[j] >= 4;
        const am = mates[j] && mates.some((x, k) => k !== j && !x);
        const mg =
          g.missedGain === 'free-capture'
            ? moves.some((x, k) => k !== j && P.board[x.to] && lessonCaptureGain(P, x) >= g.T && S[k] - B >= g.T && S[k] - S[j] >= g.T)
            : top - B >= g.T && top - S[j] >= g.T;
        const mm = mateWins !== null && !mateWins.some((w) => w.from === m.from && w.to === m.to);
        const values = [am || serious ? 50 : 0, al ? 25 : 0, mm ? 25 : 0, mg ? 15 : 0];
        const sig = moveSignals(P, m, g, { maxNodes: 1e9 });
        expect(sig.status).toBe('checked');
        expect([!!sig.allowedLoss, sig.allowedLoss?.serious ?? false, sig.allowedMate, sig.missedGain, sig.missedMate]).toEqual([al, serious, am, mg, mm]);
        expect(sig.penalty ? R1_PENALTIES[sig.penalty] : 0).toBe(Math.max(...values));
        judged++;
        if (sig.penalty) kinds[sig.penalty] = (kinds[sig.penalty] ?? 0) + 1;
      });
    }
    expect(colours).toEqual(new Set(['red', 'black']));
    // The fixed seed exercises every penalty kind (about 110 moves judged).
    expect(Object.keys(kinds).sort()).toEqual(['allowed-loss', 'allowed-mate', 'missed-gain', 'missed-mate', 'serious-allowed-loss']);
    expect(judged).toBeGreaterThan(60);
  });
});
