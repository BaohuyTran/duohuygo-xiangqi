import { describe, expect, it } from 'vitest';
import { SAFETY_GUARDS } from '../analysis';
import { legalMoves, parseSquare, positionFromPieces, squareName } from '../engine';
import { positionOf } from './answers';
import { decisionCredit, decisionGuard, judgeDecision, moveKey, parseMoveKey } from './decision';
import { computeMoveClass, proposeMoveTable, refutationOf, syncJudge } from './decision-table';
import { resolveGuard } from './guard';
import { DECISION_PIECES, decisionFixture } from './test-fixtures';

const mv = (key: string) => parseMoveKey(key)!;

describe('move keys', () => {
  it('round-trips "h2-e2" and rejects malformed keys', () => {
    expect(parseMoveKey('h2-e2')).toEqual({ from: parseSquare('h2'), to: parseSquare('e2') });
    expect(moveKey(mv('h2-e2'))).toBe('h2-e2');
    for (const bad of ['h2e2', 'z2-e2', 'h2-e', 42, undefined]) expect(parseMoveKey(bad)).toBeNull();
  });
});

describe('computeMoveClass (04 §5.4 rule for computed rows)', () => {
  const ex = decisionFixture();
  const pos = positionOf(ex);
  const guard = resolveGuard(decisionGuard(ex));

  it('uses the level guard of the item id (b09 = Basic)', () => {
    expect(guard).toMatchObject({ h: 1, k: 1, T: 2 });
    expect(resolveGuard(decisionGuard({ id: 'a03l1-01' }))).toMatchObject({ h: 2, k: 2 });
    expect(resolveGuard(decisionGuard({ id: 'b09l3-04', guard: { T: 3 } }))).toMatchObject({ h: 1, k: 1, T: 3 });
  });

  it('error when the guard fails, target when the objective is met, otherwise dubious', () => {
    expect(computeMoveClass(pos, mv('i0-i5'), guard, ex.objective).class).toBe('error');
    expect(computeMoveClass(pos, mv('b0-c2'), guard, ex.objective).class).toBe('target');
    expect(computeMoveClass(pos, mv('b0-a2'), guard, ex.objective).class).toBe('dubious');
    // Without an objective nothing is computed as target.
    expect(computeMoveClass(pos, mv('b0-c2'), guard, undefined).class).toBe('dubious');
  });

  it('reports not-checked when the node limit stops the guard', () => {
    expect(computeMoveClass(pos, mv('b0-c2'), guard, ex.objective, { maxNodes: 1 }).class).toBe('not-checked');
  });

  it('proposes a complete table that matches every computed row of the fixture', () => {
    const proposed = proposeMoveTable(pos, guard, ex.objective);
    expect(proposed.map((r) => r.move).sort()).toEqual(legalMoves(pos).map(moveKey).sort());
    for (const row of ex.table.filter((r) => r.source === 'computed')) {
      expect(proposed.find((p) => p.move === row.move)?.class, row.move).toBe(row.class);
    }
    // Accepted moves and checks are flagged for the author.
    expect(proposed.find((p) => p.move === 'b0-c2')?.notes.review).toBe(true);
    expect(proposed.find((p) => p.move === 'i0-i9')?.notes).toMatchObject({ check: true, review: true });
    expect(proposed.find((p) => p.move === 'i0-i5')?.notes).toMatchObject({ allowsMate: true, review: false });
  });
});

describe('judgeDecision and credit', () => {
  const ex = decisionFixture();

  it('looks the move up in the table', () => {
    expect(judgeDecision(ex, mv('b0-c2'))).toEqual({ kind: 'class', entry: ex.table[0] });
    expect(judgeDecision(ex, mv('i0-g0'))).toMatchObject({ kind: 'class', entry: { class: 'sound', reason: 'u3l1.e2' } });
    expect(judgeDecision(ex, mv('i0-i1'))).toMatchObject({ kind: 'class', entry: { class: 'error', misconception: 'b09.m2' } });
  });

  it('gives illegal moves the usual verdicts', () => {
    expect(judgeDecision(ex, mv('b0-b5'))).toEqual({ kind: 'illegal', verdict: 'illegal' });
    expect(judgeDecision(ex, mv('h7-h0'))).toEqual({ kind: 'illegal', verdict: 'illegal' });
  });

  it('treats a row missing from a stale table as dubious, never wrong', () => {
    const stale = { ...ex, table: ex.table.filter((r) => r.move !== 'e0-d0') };
    expect(judgeDecision(stale, mv('e0-d0'))).toMatchObject({ kind: 'class', entry: { class: 'dubious', source: 'computed' } });
  });

  it('credits target/sound 1, dubious 0.5 only when partial, error 0 (03 §3.2)', () => {
    expect(decisionCredit({}, 'target')).toBe(1);
    expect(decisionCredit({}, 'sound')).toBe(1);
    expect(decisionCredit({}, 'dubious')).toBe(0);
    expect(decisionCredit({ partial: true }, 'dubious')).toBe(0.5);
    expect(decisionCredit({ partial: true }, 'error')).toBe(0);
  });
});

describe('refutation', () => {
  const pos = positionFromPieces({ ...DECISION_PIECES }, 'red');
  const guard = SAFETY_GUARDS.basics;

  it('shows the mating reply when the move allows a mate', () => {
    const r = refutationOf(pos, mv('i0-i5'), guard);
    expect(r.kind).toBe('mate');
    expect(r.reply && moveKey(r.reply)).toBe('h7-h0');
  });

  it('shows the best material reply otherwise', () => {
    // The Chariot steps onto the Black Chariot's file: h9 takes it.
    const p = positionFromPieces({ f0: 'K', a2: 'R', d9: 'k', h9: 'r' }, 'red');
    const r = refutationOf(p, mv('a2-h2'), guard);
    expect(r.kind).toBe('material');
    expect(r.reply && `${squareName(r.reply.from)}-${squareName(r.reply.to)}`).toBe('h9-h2');
  });

  it('makes no claim for a move that passes the guard (an authored error beyond the horizon)', () => {
    // e0-f0 and i0-f0 are safe: the best reply (e.g. Cb5-c5) wins nothing, so there is no refutation to show.
    expect(refutationOf(pos, mv('e0-f0'), guard)).toEqual({ reply: null, kind: null });
    expect(refutationOf(pos, mv('i0-f0'), guard)).toEqual({ reply: null, kind: null });
  });

  it('the client judge follows the same rule', async () => {
    const { createAnalysisClient } = await import('../analysis/client');
    const { DEFAULT_REQUEST_BUDGET } = await import('../analysis/requests');
    const { clientJudge } = await import('./decision');
    const judge = clientJudge(createAnalysisClient({ createWorker: null, syncBudget: DEFAULT_REQUEST_BUDGET, syncTimeoutMs: Infinity }));
    await expect(judge.refutation(pos, mv('e0-f0'), {})).resolves.toEqual({ reply: null, kind: null });
    const mate = await judge.refutation(pos, mv('i0-i5'), {});
    expect(mate.kind).toBe('mate');
    expect(mate.reply && moveKey(mate.reply)).toBe('h7-h0');
    const p = positionFromPieces({ f0: 'K', a2: 'R', d9: 'k', h9: 'r' }, 'red');
    const loss = await judge.refutation(p, mv('a2-h2'), {});
    expect(loss).toMatchObject({ kind: 'material' });
    expect(loss.reply && moveKey(loss.reply)).toBe('h9-h2');
    await expect(judge.safety(pos, mv('i0-i5'), {})).resolves.toBe('allows-mate');
  });

  it('syncJudge wraps the analysis in promises', async () => {
    await expect(syncJudge.refutation(pos, mv('i0-i5'), {})).resolves.toMatchObject({ kind: 'mate' });
    await expect(syncJudge.safety(pos, mv('b0-c2'), {})).resolves.toBe('correct');
    await expect(syncJudge.safety(pos, mv('i0-i5'), {})).resolves.toBe('allows-mate');
  });
});
