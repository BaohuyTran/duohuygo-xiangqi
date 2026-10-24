import { describe, expect, it } from 'vitest';
import { createAnalysisClient } from '../analysis/client';
import { executeRequest, type AnalysisOutcome, type AnalysisRequest } from '../analysis/requests';
import { featureEvaluator, materialEval, searchMove } from '../analysis';
import { START_FEN, legalMoves, makeMove, parseFen, positionFromPieces } from '../engine';
import type { Position } from '../engine';
import { createsThirdOccurrence } from './adjudicate';
import {
  DISCLOSURE_KEYS,
  bestDefence,
  chain,
  choosePartnerMove,
  directAnalyzer,
  forcingAttack,
  greedy,
  playPartnerMove,
  pressing,
  restricted,
  safeSparring,
  scripted,
  type Analyzer,
  type OpponentPolicy,
  type PolicyChoice,
  type PolicyContext,
} from './policies';
import { appendMove, createRecord, currentPosition, iccsToMove, isVoided, moveToIccs, type GameRecord } from './record';

const mv = iccsToMove;
const iccs = (c: PolicyChoice) => (c.kind === 'move' ? moveToIccs(c.move) : c.kind);
const analyzer = directAnalyzer();
const play = (record: GameRecord, ...moves: string[]) => moves.reduce((r, m) => appendMove(r, mv(m)), record);

/** The 04 §2.2 "mid" position, Red to move (full board, 37 moves). */
const MID = parseFen('r1bakabr1/9/1cn3nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKABR1 w - - 6 4');
/** Mate in 1 by a1-a9 only. */
const MATE1 = positionFromPieces({ e0: 'K', a1: 'R', d9: 'k', d8: 'p', f8: 'p' }, 'red');
/** Black to move; every move allows mate, d7-d8 lasts longest (mate in 2; all others mate in 1). Puzzle m1-21 with Black to move. */
const LONGEST = parseFen('1R7/9/3k5/9/9/7p1/9/9/4K4/2B6 b - - 0 1');
/** Black to move; only g2-f2 and a7-c9 avoid a forced mate within 2 (puzzle m1-09 with Black to move). */
const ESCAPES = parseFen('2R6/3k1N3/b3b4/4N4/9/9/9/4K1p2/9/9 b - - 0 1');
/** Red to move: the chariot on a5 can take a free Black chariot on a9; no mate. */
const FREE_CHARIOT = positionFromPieces({ e0: 'K', a5: 'R', f9: 'k', e8: 'a', a9: 'r' }, 'red');
/** Both chariots shuffle; nobody checks. */
const SHUFFLE = positionFromPieces({ d0: 'K', a0: 'R', e9: 'k', d9: 'a', f9: 'a', i9: 'r' }, 'red');
/** Red's chariot checks along ranks 9 and 8 while Black's General shuttles d9 ↔ d8. */
const PERPETUAL = positionFromPieces({ f0: 'K', h7: 'R', d9: 'k' }, 'red');

function record(pos: Position, seed = 1, learner: 'red' | 'black' = pos.turn === 'red' ? 'black' : 'red'): GameRecord {
  return createRecord(pos, { learner, seed });
}

function ctx(rec: GameRecord, extra: Partial<PolicyContext> = {}): PolicyContext {
  return { record: rec, position: currentPosition(rec), analyzer, seed: 12345, ...extra };
}

async function choiceOver(policy: OpponentPolicy, pos: Position, seeds: number): Promise<Set<string>> {
  const out = new Set<string>();
  for (let s = 0; s < seeds; s++) out.add(iccs(await choosePartnerMove(policy, record(pos, s), analyzer)));
  return out;
}

const scoreAll = (pos: Position, depth: number, features = false) =>
  new Map(legalMoves(pos).map((m) => [moveToIccs(m), searchMove(pos, m, { depth, evaluate: features ? featureEvaluator() : materialEval }).score]));

/** Wraps the direct analyzer; `fail(request)` returns a not-checked reason for the requests to fail. */
function failing(fail: (r: AnalysisRequest) => 'timeout' | 'node-limit' | 'cancelled' | 'error' | null, log?: AnalysisRequest[]): Analyzer {
  return {
    run<R extends AnalysisRequest>(request: R): Promise<AnalysisOutcome<R['kind']>> {
      log?.push(request);
      const reason = fail(request);
      if (reason) return Promise.resolve({ status: 'not-checked', kind: request.kind, reason, nodes: 0 } as AnalysisOutcome<R['kind']>);
      return analyzer.run(request);
    },
  };
}

describe('determinism and disclosure', () => {
  it('the same seed and game give the same move; other seeds can differ', async () => {
    const p = safeSparring(2, 1.0);
    const a = await choosePartnerMove(p, record(MID, 7), analyzer);
    const b = await choosePartnerMove(p, record(MID, 7), analyzer);
    expect(a).toEqual(b);
    expect((await choiceOver(p, MID, 6)).size).toBeGreaterThan(1);
  });

  it('every policy has its disclosure key; chains list all of their links', () => {
    const policies = [scripted({ replies: {} }), bestDefence(), bestDefence({ resist: true }), forcingAttack(2), safeSparring(), pressing(), greedy()];
    expect(policies.map((p) => p.disclosureKey)).toEqual([
      DISCLOSURE_KEYS.scripted,
      DISCLOSURE_KEYS['best-defence'],
      DISCLOSURE_KEYS['best-defence-resist'],
      DISCLOSURE_KEYS['forcing-attack'],
      DISCLOSURE_KEYS['safe-sparring'],
      DISCLOSURE_KEYS.pressing,
      DISCLOSURE_KEYS.greedy,
    ]);
    expect(restricted(safeSparring(), { pieceTypes: ['horse'] }).disclosureKey).toBe(DISCLOSURE_KEYS.restricted);
    const hold = chain(scripted({ replies: {} }), forcingAttack(2), pressing(2));
    expect(hold.disclosureKeys).toEqual([DISCLOSURE_KEYS.scripted, DISCLOSURE_KEYS['forcing-attack'], DISCLOSURE_KEYS.pressing]);
    expect(new Set(Object.values(DISCLOSURE_KEYS)).size).toBe(Object.keys(DISCLOSURE_KEYS).length);
  });

  it('enforces depth limits (k ≤ 3, d 1–3)', () => {
    expect(() => forcingAttack(4)).toThrow();
    expect(() => safeSparring(4)).toThrow();
    expect(() => pressing(0)).toThrow();
    expect(() => bestDefence({ k: 4 })).toThrow();
    expect(() => safeSparring(2, -1)).toThrow();
  });

  it('runs through the analysis client (sync fallback, same budget) with the same choice', async () => {
    const client = createAnalysisClient({ createWorker: null, syncBudget: 1_000_000, syncTimeoutMs: 60_000 });
    const viaClient = await choosePartnerMove(pressing(2), record(MID, 3), client);
    expect(viaClient).toEqual(await choosePartnerMove(pressing(2), record(MID, 3), analyzer));
    expect(viaClient.kind === 'move' && viaClient.safetyNet).toBeFalsy();
  });
});

describe('safe-sparring(d, τ) and pressing(d)', () => {
  it('safe-sparring picks among moves within τ of the best material score', async () => {
    const scores = scoreAll(MID, 2);
    const best = Math.max(...scores.values());
    for (const m of await choiceOver(safeSparring(2, 0.5), MID, 4)) expect(scores.get(m)!).toBeGreaterThanOrEqual(best - 0.5);
  });

  it('safe-sparring takes a free chariot (nothing else is within τ)', async () => {
    expect(await choiceOver(safeSparring(2, 1.0), FREE_CHARIOT, 5)).toEqual(new Set(['a5a9']));
  });

  it('pressing plays a move with the best feature score', async () => {
    const scores = scoreAll(MID, 2, true);
    const best = Math.max(...scores.values());
    const c = await choosePartnerMove(pressing(2), record(MID, 1), analyzer);
    expect(c).toMatchObject({ kind: 'move', policy: 'pressing(2)' });
    expect(scores.get(iccs(c))!).toBeCloseTo(best, 9);
  });
});

describe('forcing-attack(k) (03 §5.2)', () => {
  it('plays a forced mate when one exists', async () => {
    expect(await choosePartnerMove(forcingAttack(2), record(MATE1), analyzer)).toMatchObject({ kind: 'move', policy: 'forcing-attack(2)' });
    expect(iccs(await choosePartnerMove(forcingAttack(2), record(MATE1), analyzer))).toBe('a1a9');
  });

  it('otherwise the highest winning capture (gain ≥ 2)', async () => {
    expect(iccs(await choosePartnerMove(forcingAttack(2), record(FREE_CHARIOT), analyzer))).toBe('a5a9');
  });

  it('otherwise hands over (quiet full board)', async () => {
    expect(await choosePartnerMove(forcingAttack(2), record(parseFen(START_FEN)), analyzer)).toEqual({ kind: 'hand-over', policy: 'forcing-attack(2)' });
  });

  it('breaks ties between equal mates by the seed', async () => {
    // Two chariots: a1-a9 and i1-i9 both mate in 1.
    const twoMates = positionFromPieces({ e0: 'K', a1: 'R', i1: 'R', e9: 'k', d8: 'p', e8: 'p', f8: 'p' }, 'red');
    expect(await choiceOver(forcingAttack(1), twoMates, 16)).toEqual(new Set(['a1a9', 'i1i9']));
  });
});

describe('best-defence (and resist mode)', () => {
  it('delays the mate as long as possible when every move loses', async () => {
    expect(await choiceOver(bestDefence(), LONGEST, 6)).toEqual(new Set(['d7d8']));
    expect(await choiceOver(bestDefence({ resist: true }), LONGEST, 3)).toEqual(new Set(['d7d8']));
  });

  it('plays a move that ends the game first (mate in 1 outranks any escape)', async () => {
    expect(await choiceOver(bestDefence(), MATE1, 8)).toEqual(new Set(['a1a9']));
    expect(await choiceOver(bestDefence({ resist: true }), MATE1, 3)).toEqual(new Set(['a1a9']));
  });

  it('plays only moves that avoid every forced mate within k it can avoid', async () => {
    const plain = await choiceOver(bestDefence(), ESCAPES, 16);
    expect([...plain].every((m) => ['g2f2', 'a7c9'].includes(m))).toBe(true);
    expect(plain.size).toBe(2);
  });

  it('resist mode then takes the highest material score at d = 2 (k = d = 2 by default)', async () => {
    const p = bestDefence({ resist: true });
    expect(p.label).toBe('best-defence-resist(2,2)');
    const scores = scoreAll(ESCAPES, 2);
    const best = Math.max(scores.get('g2f2')!, scores.get('a7c9')!);
    for (const m of await choiceOver(p, ESCAPES, 8)) {
      expect(['g2f2', 'a7c9']).toContain(m);
      expect(scores.get(m)).toBe(best);
    }
  });
});

describe('scripted, restricted, greedy, chain', () => {
  const script = { replies: { '': ['h9g7', 'b9c7'], 'h2e2 h9g7': ['i9h9'] } };

  it('scripted plays the authored replies (seeded among several) and hands over off the script', async () => {
    const black = parseFen(START_FEN.replace(' w ', ' b '));
    expect(await choiceOver(scripted(script), black, 16)).toEqual(new Set(['h9g7', 'b9c7']));
    let r = record(parseFen(START_FEN), 1, 'red');
    r = play(r, 'h2e2', 'h9g7', 'h0g2');
    expect(await choosePartnerMove(scripted(script), r, analyzer)).toEqual({ kind: 'hand-over', policy: 'scripted' });
    r = play(record(parseFen(START_FEN), 1, 'red'), 'h2e2');
    expect(iccs(await choosePartnerMove(scripted({ replies: { h2e2: ['h7e7'] } }), r, analyzer))).toBe('h7e7');
  });

  it('restricted only moves the allowed pieces', async () => {
    const p = restricted(safeSparring(2, 5), { pieceTypes: ['horse'] });
    for (const m of await choiceOver(p, MID, 8)) expect(MID.board[mv(m).from]!.type).toBe('horse');
    expect(await choosePartnerMove(restricted(greedy(), { from: ['e5'] }), record(MID), analyzer)).toEqual({
      kind: 'hand-over',
      policy: 'restricted(greedy)',
    });
  });

  it('greedy takes the most valuable piece, else any move', async () => {
    // The chariot a5 can take a chariot (a9) or a soldier (c5): the chariot.
    const pos = positionFromPieces({ e0: 'K', a5: 'R', f9: 'k', e8: 'a', a9: 'r', c5: 'p' }, 'red');
    expect(await choiceOver(greedy(), pos, 4)).toEqual(new Set(['a5a9']));
    expect((await choiceOver(greedy(), parseFen(START_FEN), 8)).size).toBeGreaterThan(1);
  });

  it('a chain plays the first link that moves (hold chain: tree → forcing-attack → pressing)', async () => {
    const hold = chain(scripted(script), forcingAttack(2), safeSparring(2, 0));
    const black = parseFen(START_FEN.replace(' w ', ' b '));
    expect(await choosePartnerMove(hold, record(black), analyzer)).toMatchObject({ kind: 'move', policy: 'scripted' });
    expect(await choosePartnerMove(hold, record(FREE_CHARIOT), analyzer)).toMatchObject({ kind: 'move', policy: 'forcing-attack(2)' });
    expect(await choosePartnerMove(hold, record(MID), analyzer)).toMatchObject({ kind: 'move', policy: 'safe-sparring(2,0)' });
  });

  it('reports no-move when the side to move has no legal move', async () => {
    const mated = makeMove(MATE1, mv('a1a9'));
    for (const p of [pressing(), forcingAttack(), bestDefence(), greedy(), scripted(script), chain(greedy())]) {
      expect(await choosePartnerMove(p, record(mated), analyzer)).toEqual({ kind: 'no-move' });
    }
  });
});

describe('repetition (partners avoid a third occurrence unless every alternative loses ≥ T)', () => {
  const shuffle7 = () => play(record(SHUFFLE, 1, 'red'), 'a0a1', 'i9i8', 'a1a0', 'i8i9', 'a0a1', 'i9i8', 'a1a0');

  it('never repeats a third time when an alternative is about as good', async () => {
    const r = shuffle7();
    expect(createsThirdOccurrence(r, mv('i8i9'))).toBe(true);
    for (let s = 0; s < 12; s++) {
      for (const p of [safeSparring(2, 0), pressing(2), greedy(), bestDefence({ resist: true })]) {
        const c = await p.choose(ctx(r, { seed: s }));
        expect(c.kind).toBe('move');
        expect(iccs(c)).not.toBe('i8i9');
      }
    }
    // Only the repeating move and an equal one allowed: the equal one.
    const c = await safeSparring(2, 0).choose(ctx(r, { candidates: [mv('i8i9'), mv('i8i7')] }));
    expect(iccs(c)).toBe('i8i7');
  });

  it('repeats when every alternative loses ≥ T by its search', async () => {
    // The only alternative, i8-a8, lets Red's chariot on a0 take Black's chariot (−9).
    const r = shuffle7();
    const c = await safeSparring(2, 0).choose(ctx(r, { candidates: [mv('i8i9'), mv('i8a8')] }));
    expect(c).toMatchObject({ kind: 'move', thirdOccurrence: true });
    expect(iccs(c)).toBe('i8i9');
  });

  it('never makes a move that loses by perpetual check unless it is the only candidate', async () => {
    const r = play(record(PERPETUAL, 1, 'black'), 'h7h9', 'd9d8', 'h9h8', 'd8d9', 'h8h9', 'd9d8', 'h9h8', 'd8d9');
    // h8-h9+ would be the third occurrence with Red checking every move: Red would lose.
    const scores = scoreAll(currentPosition(r), 2);
    expect(scores.get('h8h9')).toBe(scores.get('h8h7'));
    for (let s = 0; s < 8; s++) {
      expect(iccs(await safeSparring(2, 0).choose(ctx(r, { seed: s, candidates: [mv('h8h9'), mv('h8h7')] })))).toBe('h8h7');
      expect(iccs(await forcingAttack(2).choose(ctx(r, { seed: s })))).not.toBe('h8h9');
    }
    expect(iccs(await safeSparring(2, 0).choose(ctx(r, { candidates: [mv('h8h9')] })))).toBe('h8h9');
  });

  it('scripted skips an authored reply that would repeat a third time', async () => {
    const r = shuffle7();
    const path = r.moves.map((m) => moveToIccs(m.move)).join(' ');
    expect(await scripted({ replies: { [path]: ['i8i9'] } }).choose(ctx(r))).toEqual({ kind: 'hand-over', policy: 'scripted' });
  });
});

describe('node limits and the safety net (03 §5.6 voided runs)', () => {
  it('a depth-2 request that is not checked falls back to the d = 1 move, flagged; the record is voided', async () => {
    const log: AnalysisRequest[] = [];
    const slow = failing((r) => (r.kind === 'score-moves' && r.depth === 2 ? 'timeout' : null), log);
    const { choice, record: next } = await playPartnerMove(pressing(2), record(MID, 4), slow);
    expect(choice).toMatchObject({ kind: 'move', policy: 'pressing(2)', safetyNet: 'timeout' });
    const d1 = scoreAll(MID, 1, true);
    expect(d1.get(iccs(choice))).toBeCloseTo(Math.max(...d1.values()), 9);
    expect(log.map((r) => (r.kind === 'score-moves' ? r.depth : r.kind))).toEqual([2, 1]);
    expect(isVoided(next)).toBe(true);
    expect(next.moves.at(-1)!.partner).toEqual({ policy: 'pressing(2)', safetyNet: 'timeout' });
  });

  it('a real node limit is not checked either and also triggers the flagged safety net', async () => {
    const c = await choosePartnerMove(safeSparring(2, 0), record(MID), analyzer, { limits: { budget: 50 } });
    expect(c).toMatchObject({ kind: 'move', safetyNet: 'node-limit' });
    const r = executeRequest({ kind: 'score-moves', position: MID, depth: 2, limits: { budget: 50 } });
    expect(r.status).toBe('not-checked');
  });

  it('when even the d = 1 request fails: a seeded random legal move, flagged', async () => {
    const dead = failing(() => 'error');
    const a = await choosePartnerMove(pressing(2), record(MID, 9), dead);
    expect(a).toMatchObject({ kind: 'move', safetyNet: 'error' });
    expect(a).toEqual(await choosePartnerMove(pressing(2), record(MID, 9), dead));
  });

  it('forcing-attack / best-defence fall back to k = 1, d = 1; a flagged hand-over still voids the chain move', async () => {
    const log: AnalysisRequest[] = [];
    const slow = failing((r) => (r.kind === 'forced-wins' && r.n === 2 ? 'timeout' : null), log);
    const c = await choosePartnerMove(chain(forcingAttack(2), safeSparring(2, 0)), record(MID), slow);
    expect(c).toMatchObject({ kind: 'move', policy: 'safe-sparring(2,0)', safetyNet: 'timeout' });
    expect(log.filter((r) => r.kind === 'winning-captures').map((r) => r.kind === 'winning-captures' && r.depth)).toEqual([1]);
    const md: AnalysisRequest[] = [];
    const slowMd = failing((r) => (r.kind === 'mate-distances' && r.k === 2 ? 'timeout' : null), md);
    expect(await choosePartnerMove(bestDefence({ resist: true }), record(LONGEST), slowMd)).toMatchObject({ kind: 'move', safetyNet: 'timeout' });
    expect(md.map((r) => (r.kind === 'mate-distances' ? `md${r.k}` : r.kind === 'score-moves' ? `sm${r.depth}` : r.kind))).toEqual(['md2', 'md1', 'sm1']);
  });

  it('a cancelled request returns cancelled (no move, nothing flagged)', async () => {
    expect(await choosePartnerMove(pressing(2), record(MID), failing(() => 'cancelled'))).toEqual({ kind: 'cancelled' });
  });
});

describe('a short game against a partner', () => {
  it('learner moves + partner replies build a consistent record', async () => {
    let r = record(parseFen(START_FEN), 21, 'red');
    const partner = chain(forcingAttack(2), safeSparring(2, 1.0));
    for (const learnerMove of ['h2e2', 'h0g2', 'i0h0']) {
      r = appendMove(r, mv(learnerMove));
      ({ record: r } = await playPartnerMove(partner, r, analyzer, { at: r.moves.length }));
    }
    expect(r.moves).toHaveLength(6);
    expect(r.moves.filter((m) => m.partner).length).toBe(3);
    expect(isVoided(r)).toBe(false);
    expect(r.moves.map((m) => m.partner !== undefined)).toEqual([false, true, false, true, false, true]);
    expect(r.moves.filter((m) => m.partner).map((m) => m.at)).toEqual([1, 3, 5]);
  });
});

describe("the 'mate-distances' analysis request (added for best-defence)", () => {
  it('gives the shortest forced mate of the opponent after each move, null when none within k', () => {
    const r = executeRequest({ kind: 'mate-distances', position: LONGEST, k: 2 });
    expect(r.status).toBe('checked');
    const byMove = new Map(r.status === 'checked' ? r.value.map((d) => [moveToIccs(d.move), d.mateIn]) : []);
    expect(byMove.get('d7d8')).toBe(2);
    expect([...byMove].filter(([m]) => m !== 'd7d8').every(([, n]) => n === 1)).toBe(true);
    const k1 = executeRequest({ kind: 'mate-distances', position: LONGEST, k: 1, moves: [mv('d7d8')] });
    expect(k1).toMatchObject({ status: 'checked', value: [{ mateIn: null }] });
  });

  it('rejects k outside 1–3 (not node-limited, so the depth is capped)', () => {
    expect(executeRequest({ kind: 'mate-distances', position: LONGEST, k: 4 })).toMatchObject({ status: 'not-checked', reason: 'error' });
  });
});
