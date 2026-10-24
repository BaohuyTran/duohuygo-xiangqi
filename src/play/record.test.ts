import { describe, expect, it } from 'vitest';
import { positionKey } from '../analysis';
import { START_FEN, makeMove, parseFen, positionFromPieces } from '../engine';
import {
  appendMove,
  createRecord,
  currentPosition,
  iccsToMove,
  isLearnerMove,
  isVoided,
  keyCounts,
  learnerMoveCount,
  learnerMovesSinceCapture,
  moveToIccs,
  positionsOf,
  safetyNetMoves,
  sideOfMove,
  type GameRecord,
} from './record';

const mv = iccsToMove;

function play(record: GameRecord, ...moves: string[]): GameRecord {
  return moves.reduce((r, m) => appendMove(r, mv(m)), record);
}

describe('game record', () => {
  it('starts empty with the start key, learner and seed', () => {
    const start = parseFen(START_FEN);
    const r = createRecord(start, { learner: 'black', seed: 99 });
    expect(r).toMatchObject({ version: 1, learner: 'black', seed: 99, moves: [] });
    expect(r.startKey).toBe(positionKey(start));
    expect(currentPosition(r)).toEqual(start);
  });

  it('records keys, check and capture flags; positions replay the moves', () => {
    // Red chariot takes a soldier with check? Build: chariot a0 → a9 captures, then a check.
    const start = positionFromPieces({ e0: 'K', a0: 'R', d9: 'k', a5: 'p' }, 'red');
    let r = createRecord(start, { learner: 'red', seed: 1 });
    r = play(r, 'a0a5'); // capture
    r = play(r, 'd9d8');
    r = play(r, 'a5a8'); // check along rank 8
    expect(r.moves.map((m) => [m.capture, m.check])).toEqual([
      [true, false],
      [false, false],
      [false, true],
    ]);
    const positions = positionsOf(r);
    expect(positions).toHaveLength(4);
    expect(positions[1]).toEqual(makeMove(start, mv('a0a5')));
    expect(r.moves.map((m) => m.key)).toEqual(positions.slice(1).map(positionKey));
  });

  it('throws on an illegal move and does not mutate the record', () => {
    const r = createRecord(parseFen(START_FEN), { learner: 'red', seed: 1 });
    expect(() => appendMove(r, mv('a0a5'))).toThrow(/Illegal/);
    expect(r.moves).toHaveLength(0);
  });

  it('counts learner moves, sides and moves since the last capture', () => {
    const start = parseFen(START_FEN.replace(' w ', ' b '));
    let r = createRecord(start, { learner: 'red', seed: 1 });
    r = play(r, 'h9g7', 'h2e2', 'a6a5', 'e2e6'); // Black first; Red's cannon takes the central soldier
    expect([0, 1, 2, 3].map((i) => sideOfMove(r, i))).toEqual(['black', 'red', 'black', 'red']);
    expect([0, 1].map((i) => isLearnerMove(r, i))).toEqual([false, true]);
    expect(learnerMoveCount(r)).toBe(2);
    expect(learnerMovesSinceCapture(r)).toBe(0);
    r = play(r, 'i6i5', 'a3a4');
    expect(learnerMovesSinceCapture(r)).toBe(1);
  });

  it('counts position keys for repetition', () => {
    let r = createRecord(positionFromPieces({ d0: 'K', a0: 'R', e9: 'k', d9: 'a', f9: 'a', i9: 'r' }, 'red'), { learner: 'red', seed: 1 });
    r = play(r, 'a0a1', 'i9i8', 'a1a0', 'i8i9');
    expect(keyCounts(r).get(r.startKey)).toBe(2);
  });

  it('is plain JSON (survives a round trip) and marks safety-net moves as voiding the run', () => {
    let r = createRecord(parseFen(START_FEN), { learner: 'red', seed: 3 });
    r = appendMove(r, mv('h2e2'), { at: 1000 });
    r = appendMove(r, mv('h9g7'), { partner: { policy: 'pressing(2)' } });
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
    expect(isVoided(r)).toBe(false);
    r = appendMove(r, mv('b0c2'));
    r = appendMove(r, mv('i9h9'), { partner: { policy: 'pressing(2)', safetyNet: 'timeout' } });
    expect(isVoided(r)).toBe(true);
    expect(safetyNetMoves(r).map((m) => moveToIccs(m.move))).toEqual(['i9h9']);
  });

  it('parses and prints ICCS moves', () => {
    expect(moveToIccs(mv('h2-e2'))).toBe('h2e2');
    expect(() => mv('z9a1')).toThrow();
  });
});
