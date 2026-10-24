import { describe, expect, it } from 'vitest';
import { SAFETY_GUARDS, search } from '../analysis';
import type { AnalysisOutcome, AnalysisRequest } from '../analysis/requests';
import { START_FEN, gameStatus, hasForcedWin, legalMoves, makeMove, parseFen, positionFromPieces } from '../engine';
import type { Color, Position } from '../engine';
import {
  ADJUDICATION_LEAD,
  FULL_GAME_CAP,
  NO_CAPTURE_LIMIT,
  adjudicate,
  checkLearnerMove,
  createsThirdOccurrence,
  losesByRepetition,
  materialAdjudication,
  repetitionOutcome,
  type Ruleset,
} from './adjudicate';
import { directAnalyzer, type Analyzer } from './policies';
import {
  appendMove,
  createRecord,
  currentPosition,
  iccsToMove,
  learnerMoveCount,
  learnerMovesSinceCapture,
  type GameRecord,
  type RecordedMove,
} from './record';
import { createRng } from './rng';

const mv = iccsToMove;
const play = (record: GameRecord, ...moves: string[]) => moves.reduce((r, m) => appendMove(r, mv(m)), record);

/** Red's chariot checks along ranks 9 and 8; Black's lone General shuttles d9 ↔ d8 (its only move). */
const PERPETUAL = positionFromPieces({ f0: 'K', h7: 'R', d9: 'k' }, 'red');
const PERPETUAL_LINE = ['h7h9', 'd9d8', 'h9h8', 'd8d9', 'h8h9', 'd9d8', 'h9h8', 'd8d9', 'h8h9'];
/** Both chariots shuffle on their back ranks: nobody checks. */
const SHUFFLE = positionFromPieces({ d0: 'K', a0: 'R', e9: 'k', d9: 'a', f9: 'a', i9: 'r' }, 'red');
const SHUFFLE_LINE = ['a0a1', 'i9i8', 'a1a0', 'i8i9', 'a0a1', 'i9i8', 'a1a0', 'i8i9'];
/** Red's chariot chases Black's Horse c7 ↔ b5 along the c and b files (no checks): a perpetual chase. */
const CHASE = positionFromPieces({ d0: 'K', c1: 'R', f9: 'k', c7: 'n' }, 'black');
const CHASE_LINE = ['c7b5', 'c1b1', 'b5c7', 'b1c1', 'c7b5', 'c1b1', 'b5c7', 'b1c1'];

const TASK: Ruleset = { kind: 'task', cap: 100 };

/** A synthetic record (keys and check flags only) for the repetition classification table. */
function synthetic(startTurn: Color, keys: number[], checks: boolean[]): GameRecord {
  const fen = startTurn === 'red' ? START_FEN : START_FEN.replace(' w ', ' b ');
  const moves: RecordedMove[] = keys.map((key, i) => ({ move: { from: 0, to: 0 }, key, check: checks[i], capture: false }));
  return { version: 1, startFen: fen, startKey: 1, learner: 'red', seed: 0, moves };
}

describe('repetition (03 §5.5 training ruleset)', () => {
  it('perpetual check loses for the checking side at the third occurrence', () => {
    let r = createRecord(PERPETUAL, { learner: 'black', seed: 1 });
    for (const [i, m] of PERPETUAL_LINE.entries()) {
      r = play(r, m);
      if (i < PERPETUAL_LINE.length - 1) expect(adjudicate(r, TASK)).toBeNull();
    }
    expect(adjudicate(r, TASK)).toEqual({
      reason: 'perpetual-check',
      result: 'win',
      winner: 'black',
      training: true,
      checkers: ['red'],
    });
  });

  it('neither side checking → draw', () => {
    let r = createRecord(SHUFFLE, { learner: 'red', seed: 1 });
    r = play(r, ...SHUFFLE_LINE);
    expect(adjudicate(r, TASK)).toMatchObject({ reason: 'repetition-draw', result: 'draw', winner: null, checkers: [] });
  });

  it('a perpetual chase is not adjudicated: it is a plain repetition draw', () => {
    let r = createRecord(CHASE, { learner: 'red', seed: 1 });
    r = play(r, ...CHASE_LINE);
    expect(r.moves.some((m) => m.check)).toBe(false);
    expect(adjudicate(r, TASK)).toMatchObject({ reason: 'repetition-draw', result: 'draw', winner: null });
  });

  // Keys: 1 = start. Cycle = every move from the FIRST occurrence of the repeated key to the third.
  it.each([
    ['red checks every move, black never', 'red', [2, 3, 4, 1, 2, 3, 4, 1], [true, false, true, false, true, false, true, false], 'perpetual-check', 'black'],
    ['black checks every move, red never', 'red', [2, 3, 4, 1, 2, 3, 4, 1], [false, true, false, true, false, true, false, true], 'perpetual-check', 'red'],
    ['both check every move', 'red', [2, 3, 4, 1, 2, 3, 4, 1], [true, true, true, true, true, true, true, true], 'repetition-draw', null],
    ['neither checks', 'red', [2, 3, 4, 1, 2, 3, 4, 1], [false, false, false, false, false, false, false, false], 'repetition-draw', null],
    ['red checks all but one move of the cycle', 'red', [2, 3, 4, 1, 2, 3, 4, 1], [true, false, true, false, true, false, false, false], 'repetition-draw', null],
    // The cycle is the moves between the LAST TWO occurrences: a quiet move before them does not count.
    ['a quiet move before the repeated sequence does not count', 'red', [2, 3, 4, 1, 2, 3, 4, 1], [false, false, true, false, true, false, true, false], 'perpetual-check', 'black'],
    ['cycle starting at a later key, red checking', 'black', [5, 2, 3, 2, 3, 2], [true, false, false, false, false, true], 'perpetual-check', 'black'],
  ] as const)('%s', (_name, turn, keys, checks, reason, winner) => {
    const out = repetitionOutcome(synthetic(turn, [...keys], [...checks]));
    expect(out).toMatchObject({ reason, winner, training: true });
  });

  // Content-review finding: Red's quiet h8-h7 came before the checks began; Red checked on every
  // move of the repeated sequence, so it is perpetual check, not a draw. Both colours.
  it.each([
    ['Red checks', positionFromPieces({ f0: 'K', h8: 'R', d9: 'k' }, 'red'), ['h8h7', 'd9d8', 'h7h8', 'd8d9', 'h8h9', 'd9d8', 'h9h8', 'd8d9'], 'red', 'black'],
    ['Black checks', positionFromPieces({ f9: 'k', h1: 'r', d0: 'K' }, 'black'), ['h1h2', 'd0d1', 'h2h1', 'd1d0', 'h1h0', 'd0d1', 'h0h1', 'd1d0'], 'black', 'red'],
  ] as const)('perpetual check that starts after a quiet move loses (%s)', (_name, start, line, checker, winner) => {
    let r = createRecord(start, { learner: winner, seed: 1 });
    for (const [i, m] of line.entries()) {
      r = play(r, m);
      if (i < line.length - 1) expect(adjudicate(r, TASK)).toBeNull();
    }
    expect(adjudicate(r, TASK)).toEqual({ reason: 'perpetual-check', result: 'win', winner, training: true, checkers: [checker] });
  });

  it('only the third occurrence ends the game', () => {
    expect(repetitionOutcome(synthetic('red', [2, 3, 4, 1], [false, false, false, false]))).toBeNull();
    expect(repetitionOutcome(synthetic('red', [2, 3, 4, 1, 2, 3, 4], [false, false, false, false, false, false, false]))).toBeNull();
  });

  it('createsThirdOccurrence / losesByRepetition look one move ahead', () => {
    let r = createRecord(PERPETUAL, { learner: 'black', seed: 1 });
    r = play(r, ...PERPETUAL_LINE.slice(0, 8));
    expect(createsThirdOccurrence(r, mv('h8h9'))).toBe(true);
    expect(losesByRepetition(r, mv('h8h9'))).toBe(true);
    expect(createsThirdOccurrence(r, mv('h8h7'))).toBe(false);
    let s = createRecord(SHUFFLE, { learner: 'red', seed: 1 });
    s = play(s, ...SHUFFLE_LINE.slice(0, 7));
    expect(createsThirdOccurrence(s, mv('i8i9'))).toBe(true);
    expect(losesByRepetition(s, mv('i8i9'))).toBe(false);
  });
});

/** An analyzer whose safety-guard verdicts are fixed (other requests run for real). */
function guardAnalyzer(verdict: 'safe' | 'unsafe' | 'not-checked'): Analyzer {
  const real = directAnalyzer();
  return {
    run<R extends AnalysisRequest>(request: R): Promise<AnalysisOutcome<R['kind']>> {
      if (request.kind !== 'safety-guard') return real.run(request);
      const outcome =
        verdict === 'not-checked'
          ? { status: 'not-checked', kind: 'safety-guard', reason: 'node-limit', nodes: 0 }
          : {
              status: 'checked',
              kind: 'safety-guard',
              nodes: 0,
              value: { status: 'checked', safe: verdict === 'safe', allowedLoss: null, allowedMate: false, enPrise: [], nodes: 0 },
            };
      return Promise.resolve(outcome as AnalysisOutcome<R['kind']>);
    },
  };
}

describe("the learner's third-repetition refusal", () => {
  const guard = SAFETY_GUARDS.intermediate;
  const shuffle7 = () => play(createRecord(SHUFFLE, { learner: 'black', seed: 1 }), ...SHUFFLE_LINE.slice(0, 7));

  it('a move that creates no third occurrence is allowed without checks', async () => {
    const calls: string[] = [];
    const spy: Analyzer = { run: (req) => (calls.push(req.kind), directAnalyzer().run(req)) };
    expect(await checkLearnerMove(shuffle7(), mv('i8i7'), spy, guard)).toEqual({ allowed: true });
    expect(calls).toEqual([]);
  });

  it('is refused when another legal move passes the safety guard (real analysis)', async () => {
    const v = await checkLearnerMove(shuffle7(), mv('i8i9'), directAnalyzer(), guard);
    expect(v).toMatchObject({ allowed: false, reason: 'third-repetition', notChecked: false });
    expect(v.allowed === false && v.reason === 'third-repetition' && v.alternative).toBeTruthy();
  });

  // Content-review finding: a learner being perpetually checked may make the third occurrence: the
  // checker loses. Real boards, both colours (the reviewer's line and its colour-swapped twin).
  it.each([
    ['Black', positionFromPieces({ d0: 'K', h8: 'R', e9: 'k' }, 'red'), ['h8h9', 'e9e8', 'h9h8', 'e8e9', 'h8h9', 'e9e8', 'h9h8'], 'e8e9'],
    ['Red', positionFromPieces({ d9: 'k', h1: 'r', e0: 'K' }, 'black'), ['h1h0', 'e0e1', 'h0h1', 'e1e0', 'h1h0', 'e0e1', 'h0h1'], 'e1e0'],
  ] as const)('exception: the opponent checked perpetually (learner %s wins)', async (learner, start, line, claim) => {
    const learnerColor = learner === 'Black' ? 'black' : 'red';
    let r = createRecord(start, { learner: learnerColor, seed: 1 });
    for (const [i, m] of line.entries()) {
      // The learner's earlier moves create no third occurrence: allowed without checks.
      if (i % 2 === 1) expect(await checkLearnerMove(r, mv(m), directAnalyzer(), guard)).toEqual({ allowed: true });
      r = play(r, m);
    }
    for (const g of [SAFETY_GUARDS.basics, SAFETY_GUARDS.intermediate, SAFETY_GUARDS.master]) {
      expect(await checkLearnerMove(r, mv(claim), directAnalyzer(), g)).toEqual({ allowed: true, exception: 'opponent-perpetual-check' });
    }
    expect(adjudicate(play(r, claim), TASK)).toMatchObject({ reason: 'perpetual-check', winner: learnerColor });
  });

  it('a cancelled guard request returns cancelled at once', async () => {
    const calls: string[] = [];
    const cancelled: Analyzer = {
      run: <R extends AnalysisRequest>(req: R) => {
        calls.push(req.kind);
        return Promise.resolve({ status: 'not-checked', kind: req.kind, reason: 'cancelled', nodes: 0 } as AnalysisOutcome<R['kind']>);
      },
    };
    expect(await checkLearnerMove(shuffle7(), mv('i8i9'), cancelled, guard)).toEqual({ allowed: false, reason: 'cancelled' });
    expect(calls).toEqual(['safety-guard']);
  });

  it('exception: the only legal move', async () => {
    // Red alternates a quiet chariot move and a check (not perpetual). Black's General on d9, in check
    // from h9, can only go to d8: the third occurrence of the position after Black's first move, and
    // the first third occurrence of the game. The repetition is then a draw, not a Black win.
    const start = positionFromPieces({ f0: 'K', h9: 'R', e8: 'k' }, 'black');
    let r = createRecord(start, { learner: 'black', seed: 1 });
    for (const m of ['e8d8', 'h9h7', 'd8d9', 'h7h9', 'd9d8', 'h9h7', 'd8d9', 'h7h9']) {
      expect(adjudicate(r, TASK)).toBeNull();
      r = play(r, m);
    }
    expect(adjudicate(r, TASK)).toBeNull();
    expect(legalMoves(currentPosition(r))).toHaveLength(1);
    expect(await checkLearnerMove(r, mv('d9d8'), directAnalyzer(), guard)).toEqual({ allowed: true, exception: 'only-move' });
    expect(adjudicate(play(r, 'd9d8'), TASK)).toMatchObject({ reason: 'repetition-draw' });
  });

  it('exception: every other legal move fails the guard', async () => {
    expect(await checkLearnerMove(shuffle7(), mv('i8i9'), guardAnalyzer('unsafe'), guard)).toEqual({
      allowed: true,
      exception: 'all-alternatives-fail-guard',
    });
  });

  it('stays refused when no alternative could be checked (not proven to fail)', async () => {
    expect(await checkLearnerMove(shuffle7(), mv('i8i9'), guardAnalyzer('not-checked'), guard)).toEqual({
      allowed: false,
      reason: 'third-repetition',
      alternative: null,
      notChecked: true,
    });
  });
});

describe('mate, stalemate and task caps', () => {
  it('checkmate and stalemate end the game; the side to move loses', () => {
    const mate = play(createRecord(positionFromPieces({ e0: 'K', a1: 'R', d9: 'k', d8: 'p', f8: 'p' }, 'red'), { learner: 'red', seed: 1 }), 'a1a9');
    expect(adjudicate(mate, TASK)).toEqual({ reason: 'checkmate', result: 'win', winner: 'red', training: false });
    // Black General d9 boxed by the Red chariot on rank 8 and the flying General on file e: no legal move.
    const stale = createRecord(positionFromPieces({ e0: 'K', a7: 'R', d9: 'k' }, 'red'), { learner: 'black', seed: 1 });
    const r = play(stale, 'a7a8');
    expect(gameStatus(currentPosition(r)).kind).toBe('stalemate');
    expect(adjudicate(r, TASK)).toMatchObject({ reason: 'stalemate', winner: 'red' });
  });

  it('a task ends after the learner\'s cap-th move, with no result', () => {
    let r = createRecord(parseFen(START_FEN), { learner: 'red', seed: 1 });
    const cap: Ruleset = { kind: 'task', cap: 2 };
    r = play(r, 'h2e2', 'h9g7');
    expect(adjudicate(r, cap)).toBeNull();
    r = play(r, 'h0g2');
    expect(adjudicate(r, cap)).toEqual({ reason: 'task-cap', result: 'none', winner: null, training: false });
  });

  it('mate on the cap move is a mate, not a cap', () => {
    const r = play(createRecord(positionFromPieces({ e0: 'K', a1: 'R', d9: 'k', d8: 'p', f8: 'p' }, 'red'), { learner: 'red', seed: 1 }), 'a1a9');
    expect(adjudicate(r, { kind: 'task', cap: 1 })?.reason).toBe('checkmate');
  });
});

/**
 * A seeded legal game: no third occurrence, no mate or stalemate. `capture`: 'never', or force a capture
 * once `every` learner moves passed without one (when one exists), otherwise prefer quiet moves.
 */
function walk(start: Position, learner: Color, seed: number, learnerMoves: number, capture: 'never' | { every: number }): GameRecord {
  const rng = createRng(seed);
  let r = createRecord(start, { learner, seed });
  let pos = start;
  while (learnerMoveCount(r) < learnerMoves) {
    const all = legalMoves(pos).filter((m) => {
      if (createsThirdOccurrence(r, m, pos)) return false;
      const k = gameStatus(makeMove(pos, m)).kind;
      return k !== 'checkmate' && k !== 'stalemate';
    });
    const caps = all.filter((m) => pos.board[m.to]);
    const quiet = all.filter((m) => !pos.board[m.to]);
    const want = capture !== 'never' && learnerMovesSinceCapture(r) >= capture.every && caps.length > 0;
    const pool = want ? caps : quiet.length > 0 ? quiet : capture === 'never' ? [] : caps;
    if (pool.length === 0) throw new Error(`walk stuck after ${r.moves.length} plies`);
    const m = rng.pick(pool);
    r = appendMove(r, m, { position: pos });
    pos = makeMove(pos, m);
  }
  return r;
}

describe('full games: 80-move cap and 30-move no-capture limit, same material rule', () => {
  const FULL: Ruleset = { kind: 'full-game' };

  it('stops at the learner\'s 80th move (not before) with the material rule', () => {
    const r = walk(parseFen(START_FEN), 'red', 11, FULL_GAME_CAP, { every: 20 });
    expect(learnerMoveCount(r)).toBe(80);
    for (let n = 1; n < r.moves.length; n++) {
      expect(adjudicate({ ...r, moves: r.moves.slice(0, n) }, FULL)).toBeNull();
    }
    const out = adjudicate(r, FULL)!;
    expect(out).toMatchObject({ reason: 'move-cap', training: true });
    expect(out.material).toEqual(materialAdjudication(currentPosition(r)));
    expect(out.result).toBe(out.material!.winner ? 'win' : 'draw');
  });

  it('stops after 30 learner moves without a capture by either side', () => {
    // Black learner, Black to move first: the stop comes right after Black's 30th quiet move.
    const r = walk(parseFen(START_FEN.replace(' w ', ' b ')), 'black', 5, NO_CAPTURE_LIMIT, 'never');
    expect(learnerMovesSinceCapture(r)).toBe(30);
    expect(adjudicate({ ...r, moves: r.moves.slice(0, -1) }, FULL)).toBeNull();
    const out = adjudicate(r, FULL)!;
    expect(out).toMatchObject({ reason: 'no-capture', training: true });
    expect(out.material).toEqual(materialAdjudication(currentPosition(r)));
  });

  it('applies the same lead rule at both stops (a chariot ahead wins either way)', () => {
    // Red is a chariot up; the game is quiet for 30 learner moves.
    const start = positionFromPieces({ e0: 'K', d0: 'A', f0: 'A', a0: 'R', i0: 'R', b2: 'C', e9: 'k', d9: 'a', f9: 'a', a9: 'r', h7: 'c' }, 'red');
    const r = walk(start, 'red', 3, NO_CAPTURE_LIMIT, 'never');
    const noCapture = adjudicate(r, FULL)!;
    const moveCap = adjudicate(r, { kind: 'full-game', cap: NO_CAPTURE_LIMIT, noCaptureLimit: 1_000 })!;
    expect(noCapture.reason).toBe('no-capture');
    expect(moveCap.reason).toBe('move-cap');
    expect(noCapture.material).toEqual(moveCap.material);
    expect(noCapture).toMatchObject({ result: 'win', winner: 'red' });
    expect(moveCap).toMatchObject({ result: 'win', winner: 'red' });
  });

  it('a capture resets the no-capture count', () => {
    const r = walk(parseFen(START_FEN), 'red', 11, 40, { every: 20 });
    expect(learnerMovesSinceCapture(r)).toBeLessThan(30);
    expect(adjudicate(r, FULL)).toBeNull();
  });
});

describe('material rule (03 §5.5)', () => {
  it('lead ≥ 4 (quiescence-resolved) with no mate against the leader → training win', () => {
    const pos = positionFromPieces({ e0: 'K', a0: 'R', f9: 'k', e8: 'a' }, 'black');
    expect(materialAdjudication(pos)).toMatchObject({ winner: 'red', leader: 'red', mateAgainstLeader: false, complete: true });
  });

  it('lead below 4 → training draw', () => {
    // Cannon (4.5) against a soldier (1): lead 3.5.
    const pos = positionFromPieces({ e0: 'K', a0: 'C', f9: 'k', a6: 'p' }, 'red');
    expect(search(pos, { depth: 0 }).score).toBe(3.5);
    expect(materialAdjudication(pos)).toMatchObject({ winner: null, leader: null, redLead: 3.5 });
  });

  it('the lead is resolved by capture quiescence (a hanging chariot does not count)', () => {
    // Red is a chariot up on the board, but Black to move takes it for free.
    const pos = positionFromPieces({ e0: 'K', a5: 'R', i0: 'R', f9: 'k', e8: 'a', a9: 'r' }, 'black');
    const v = materialAdjudication(pos);
    expect(v.redLead).toBeLessThan(ADJUDICATION_LEAD);
    expect(v.winner).toBeNull();
  });

  it('a forced mate within 2 against the leader → training draw', () => {
    // Red leads by 8.5 (two chariots, a Horse and a Cannon against two chariots), but Black to move
    // mates with b5-b0 (rank 0 and rank 1 covered).
    const pos = positionFromPieces({ e0: 'K', g7: 'R', h8: 'R', g4: 'N', i2: 'C', f9: 'k', a1: 'r', b5: 'r' }, 'black');
    expect(hasForcedWin(pos, 1)).toBe(true);
    const v = materialAdjudication(pos);
    expect(v.leader).toBe('red');
    expect(v).toMatchObject({ winner: null, mateAgainstLeader: true });
    // The same board with the leader to move: Red can parry (no forced mate against it) → Red wins.
    const redToMove = { ...pos, turn: 'red' as const };
    expect(materialAdjudication(redToMove)).toMatchObject({ winner: 'red', mateAgainstLeader: false });
  });

  it('the leader to move with no move escaping a mate within 2 → training draw', () => {
    // Red leads by 8.5 and is to move, but every Red move allows Black a forced mate within 2.
    const pos = positionFromPieces({ f0: 'K', b6: 'R', a6: 'R', b8: 'N', d6: 'C', e8: 'k', h2: 'r', g4: 'r' }, 'red');
    expect(legalMoves(pos).every((m) => hasForcedWin(makeMove(pos, m), 2))).toBe(true);
    expect(materialAdjudication(pos)).toMatchObject({ leader: 'red', redLead: 8.5, winner: null, mateAgainstLeader: true });
  });
});
