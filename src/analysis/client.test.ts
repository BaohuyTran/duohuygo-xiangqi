import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { legalMoves, parseFen, parseSquare, positionFromPieces, type Move } from '../engine';
import {
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  SYNC_BUDGET,
  clampTimeout,
  createAnalysisClient,
  defaultWorkerFactory,
  getAnalysisClient,
  mateDepth,
  type WorkerLike,
} from './client';
import { SAFETY_GUARDS, moveSignals, safetyGuard, winningCaptures } from './judge';
import { DEFAULT_REQUEST_BUDGET, executeRequest, isChecked, type AnalysisRequest, type WorkerRequestMessage, type WorkerResponseMessage } from './requests';
import { search } from './search';

const mv = (s: string): Move => ({ from: parseSquare(s.slice(0, 2)), to: parseSquare(s.slice(2, 4)) });
const { basics, intermediate, advanced } = SAFETY_GUARDS;

// Pilot-like positions (06 §3.1): P1 a Basic opening as Black, P2 a Red opening, P3/P4 a quiet
// full-board middlegame and a small endgame under pressure.
/** P1-like: Black to move after 1. C2=5 (central Cannon). */
const OPENING_BLACK = parseFen('rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR b - - 1 1');
/** P2-like: the 04 §2.2 "mid" position, Red to move. */
const MID = parseFen('r1bakabr1/9/1cn3nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKABR1 w - - 6 4');
/** P3-like: u13l1 #1 (quiet defence, Black threatens mate in 2). */
const DEFENCE = positionFromPieces(
  { a7: 'b', b0: 'R', b1: 'N', b3: 'P', d0: 'A', d2: 'A', d6: 'r', e9: 'k', f2: 'K', f7: 'a', g3: 'N', g5: 'b', i6: 'n', i8: 'P' },
  'red',
);
/** P4-like: u15l3 #2 (12 pieces, Red to move, mate in 4 starting f9-h8). */
const ENDGAME = positionFromPieces(
  { b8: 'N', c5: 'b', c9: 'b', d5: 'c', e0: 'K', e8: 'a', f4: 'c', f7: 'a', f8: 'k', f9: 'N', g6: 'R', i2: 'B' },
  'red',
);
/** Mate in 1: a1-a9. */
const MATE1 = positionFromPieces({ e0: 'K', a1: 'R', d9: 'k', d8: 'p', f8: 'p' }, 'red');

const SAMPLE: AnalysisRequest[] = [
  { kind: 'ping' },
  { kind: 'move-signals', position: OPENING_BLACK, move: mv('b9c7'), guard: basics },
  { kind: 'move-signals', position: OPENING_BLACK, move: mv('e6e5'), guard: basics, threats: true },
  { kind: 'move-signals', position: MID, move: mv('e2e6'), guard: intermediate, threats: true },
  { kind: 'safety-guard', position: MID, move: mv('h0h6'), guard: advanced },
  { kind: 'safety-guard', position: DEFENCE, move: mv('g3e4'), guard: advanced },
  { kind: 'threat', position: DEFENCE, side: 'black', guard: { h: 2, k: 2, T: 2 } },
  { kind: 'threat-at-end', position: MID, opponent: 'black', guard: advanced },
  { kind: 'winning-captures', position: ENDGAME },
  { kind: 'search', position: MID, depth: 3 },
  { kind: 'search', position: OPENING_BLACK, depth: 2, eval: { kind: 'features' } },
  { kind: 'search-move', position: ENDGAME, move: mv('f9h8'), depth: 3 },
  { kind: 'score-moves', position: MID, depth: 2 },
  { kind: 'forced-wins', position: MATE1, n: 1 },
  { kind: 'forced-wins', position: ENDGAME, n: 2 },
  { kind: 'predicate', predicate: { kind: 'development', increaseBy: 1 }, before: OPENING_BLACK, moves: [mv('b9c7')] },
  { kind: 'predicate', predicate: { kind: 'threat', created: true }, before: MID, moves: [mv('h2h6')] },
  // Stopped by the per-request budget: deterministic 'not-checked'.
  { kind: 'search', position: MID, depth: 4, limits: { budget: 1_500 } },
  { kind: 'move-signals', position: MID, move: mv('e2e6'), guard: intermediate, limits: { maxNodes: 300 } },
];

// ---------- A fake Worker that runs the real worker.ts handler on structured clones ----------

interface Scope {
  onmessage: ((event: { data: WorkerRequestMessage }) => void) | null;
  postMessage: (message: WorkerResponseMessage) => void;
}
const scope: Scope = { onmessage: null, postMessage: () => {} };

beforeAll(async () => {
  vi.stubGlobal('self', scope);
  await import('./worker');
  vi.unstubAllGlobals();
});

interface FakeWorker extends WorkerLike {
  terminated: boolean;
  posted: number;
}

/** Answers asynchronously through worker.ts (requests and answers cloned like postMessage does). */
function fakeWorker(behaviour: 'answer' | 'hang' | 'fail' = 'answer'): FakeWorker {
  const w: FakeWorker = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    terminated: false,
    posted: 0,
    postMessage(message) {
      w.posted++;
      const data = structuredClone(message);
      setTimeout(() => {
        if (w.terminated) return;
        if (behaviour === 'fail') return w.onerror?.({ message: 'boom' });
        if (behaviour === 'hang') return;
        scope.postMessage = (out) => {
          const reply = structuredClone(out);
          setTimeout(() => !w.terminated && w.onmessage?.({ data: reply }), 0);
        };
        scope.onmessage!({ data });
      }, 0);
    },
    terminate() {
      w.terminated = true;
    },
  };
  return w;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('worker.ts', () => {
  it('registers a handler that answers { id, outcome } with executeRequest', () => {
    const answers: WorkerResponseMessage[] = [];
    scope.postMessage = (m) => answers.push(m);
    scope.onmessage!({ data: { id: 7, request: { kind: 'forced-wins', position: MATE1, n: 1 } } });
    expect(answers).toEqual([{ id: 7, outcome: executeRequest({ kind: 'forced-wins', position: MATE1, n: 1 }) }]);
    expect(answers[0].outcome).toMatchObject({ status: 'checked', value: [mv('a1a9')] });
  });
});

describe('executeRequest', () => {
  it('gives the same values as calling the judges directly', () => {
    const sig = executeRequest({ kind: 'move-signals', position: MID, move: mv('e2e6'), guard: intermediate });
    expect(sig).toEqual({ status: 'checked', kind: 'move-signals', value: moveSignals(MID, mv('e2e6'), intermediate), nodes: expect.any(Number) });
    const guard = executeRequest({ kind: 'safety-guard', position: DEFENCE, move: mv('g3e4'), guard: advanced });
    expect(guard).toMatchObject({ status: 'checked', value: safetyGuard(DEFENCE, mv('g3e4'), advanced) });
    expect(executeRequest({ kind: 'winning-captures', position: ENDGAME })).toMatchObject({ value: winningCaptures(ENDGAME) });
    expect(executeRequest({ kind: 'search', position: MID, depth: 3 })).toMatchObject({ status: 'checked', value: search(MID, { depth: 3 }) });
  });

  it('counts every search node of the request and stops at the total budget', () => {
    const full = executeRequest({ kind: 'move-signals', position: MID, move: mv('e2e6'), guard: intermediate });
    expect(full.status).toBe('checked');
    expect(full.nodes).toBe(full.value!.nodes); // all nodes are counted, across several searches
    expect(full.nodes).toBeGreaterThan(0);

    const limited = executeRequest({ kind: 'move-signals', position: MID, move: mv('e2e6'), guard: intermediate, limits: { budget: full.nodes - 1 } });
    expect(limited).toMatchObject({ status: 'not-checked', reason: 'node-limit' });
    const exact = executeRequest({ kind: 'move-signals', position: MID, move: mv('e2e6'), guard: intermediate, limits: { budget: full.nodes } });
    expect(exact).toEqual(full);
  });

  it('a partial search keeps its deepest finished iteration; a stopped score-moves keeps the scored moves', () => {
    const r = executeRequest({ kind: 'search', position: MID, depth: 4, limits: { budget: 1_500 } });
    expect(r).toMatchObject({ status: 'not-checked', reason: 'node-limit', value: { complete: false } });
    expect(r.value!.depth).toBeGreaterThanOrEqual(1);
    expect(r.nodes).toBe(1_501);
    const s = executeRequest({ kind: 'score-moves', position: MID, depth: 2, limits: { budget: 500 } });
    expect(s.status).toBe('not-checked');
    expect(s.value!.length).toBeLessThan(legalMoves(MID).length);
  });

  it('score-moves scores every legal move by default, in the engine order', () => {
    const r = executeRequest({ kind: 'score-moves', position: MID, depth: 2 });
    expect(r.status).toBe('checked');
    expect(r.value!.map((x) => x.move)).toEqual(legalMoves(MID));
  });

  it('a deadline stops the searches as a timeout; errors never throw', () => {
    let calls = 0;
    const r = executeRequest({ kind: 'search', position: MID, depth: 4 }, { expired: () => ++calls > 2 });
    expect(r).toMatchObject({ status: 'not-checked', reason: 'timeout' });
    expect(executeRequest({ kind: 'forced-wins', position: MID, n: 4 })).toMatchObject({ status: 'not-checked', reason: 'error' });
  });

  it('a predicate that could not be checked has no value', () => {
    const r = executeRequest({
      kind: 'predicate',
      predicate: { kind: 'threat', h: 3 },
      before: MID,
      moves: [mv('h2h6')],
      limits: { budget: 10 },
    });
    expect(r).toEqual({ status: 'not-checked', kind: 'predicate', reason: 'node-limit', nodes: 11 });
  });
});

describe('analysis client: Worker and sync paths', () => {
  it('without a Worker (Node, jsdom) the client runs synchronously', async () => {
    expect(typeof Worker).toBe('undefined');
    expect(defaultWorkerFactory()).toBeNull();
    const client = createAnalysisClient();
    expect(client.mode).toBe('sync');
    expect(getAnalysisClient().mode).toBe('sync');
    expect(getAnalysisClient()).toBe(getAnalysisClient());
    await expect(client.run({ kind: 'forced-wins', position: MATE1, n: 1 })).resolves.toMatchObject({ status: 'checked', value: [mv('a1a9')] });
  });

  it('give identical verdicts for the same budget (pilot-like positions, every request kind)', async () => {
    const viaWorker = createAnalysisClient({ createWorker: () => fakeWorker() });
    const viaSync = createAnalysisClient({ createWorker: null, syncBudget: DEFAULT_REQUEST_BUDGET, syncTimeoutMs: Infinity });
    expect(viaWorker.mode).toBe('worker');
    const a = await Promise.all(SAMPLE.map((r) => viaWorker.run(r)));
    const b = await Promise.all(SAMPLE.map((r) => viaSync.run(r)));
    expect(a).toEqual(b);
    expect(a.map((o) => o.status)).toEqual([...Array(SAMPLE.length - 2).fill('checked'), 'not-checked', 'not-checked']);
    expect(viaWorker.restarts).toBe(0);
  }, 120_000);

  it('give identical verdicts within the small sync budget, and the default fallback stays within it', async () => {
    const small = SAMPLE.map((r) => ({ ...r, limits: { ...r.limits, budget: Math.min(r.limits?.budget ?? Infinity, SYNC_BUDGET) } }));
    const viaWorker = createAnalysisClient({ createWorker: () => fakeWorker() });
    const viaSync = createAnalysisClient({ createWorker: null, syncTimeoutMs: Infinity });
    const a = await Promise.all(small.map((r) => viaWorker.run(r)));
    const b = await Promise.all(SAMPLE.map((r) => viaSync.run(r)));
    expect(a).toEqual(b);
    for (const o of b) expect(o.nodes).toBeLessThanOrEqual(SYNC_BUDGET + 1);
    // Basic judging of the P1-like opening fits the fallback budget.
    expect(b[1].status).toBe('checked');
    expect(b[2].status).toBe('checked');
  }, 120_000);

  it('runs requests one at a time, in call order', async () => {
    const workers: FakeWorker[] = [];
    const order: string[] = [];
    const client = createAnalysisClient({
      createWorker: () => {
        const w = fakeWorker();
        workers.push(w);
        return w;
      },
      onOutcome: (req) => order.push(req.kind),
    });
    const p = [
      client.run({ kind: 'search', position: MID, depth: 2 }),
      client.run({ kind: 'ping' }),
      client.run({ kind: 'forced-wins', position: MATE1, n: 1 }),
    ];
    expect(workers[0].posted).toBe(1);
    await Promise.all(p);
    expect(order).toEqual(['search', 'ping', 'forced-wins']);
    expect(workers).toHaveLength(1);
  });
});

describe('analysis client: safety net, failures, cancellation', () => {
  it('a timeout resolves "not checked", terminates the Worker and starts a new one', async () => {
    vi.useFakeTimers();
    const workers: FakeWorker[] = [];
    const outcomes: string[] = [];
    const client = createAnalysisClient({
      createWorker: () => {
        const w = fakeWorker(workers.length === 0 ? 'hang' : 'answer');
        workers.push(w);
        return w;
      },
      onOutcome: (_req, o) => outcomes.push(o.status === 'checked' ? 'checked' : o.reason),
    });
    const slow = client.run({ kind: 'forced-wins', position: MATE1, n: 1 }, { timeoutMs: 300 });
    const next = client.run({ kind: 'forced-wins', position: MATE1, n: 1 });
    await vi.advanceTimersByTimeAsync(299);
    expect(workers[0].terminated).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(slow).resolves.toEqual({ status: 'not-checked', kind: 'forced-wins', reason: 'timeout', nodes: 0 });
    expect(workers[0].terminated).toBe(true);
    expect(client.restarts).toBe(1);
    await vi.advanceTimersByTimeAsync(10);
    await expect(next).resolves.toMatchObject({ status: 'checked', value: [mv('a1a9')] });
    expect(workers).toHaveLength(2);
    expect(client.mode).toBe('worker');
    expect(outcomes).toEqual(['timeout', 'checked']);
  });

  it('uses DEFAULT_TIMEOUT_MS when no timeout is given', async () => {
    vi.useFakeTimers();
    const client = createAnalysisClient({ createWorker: () => fakeWorker('hang') });
    const p = client.run({ kind: 'ping' });
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS - 1);
    let done = false;
    void p.then(() => (done = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toMatchObject({ reason: 'timeout' });
  });

  it('a Worker that fails before its first answer falls back to the synchronous path', async () => {
    const client = createAnalysisClient({ createWorker: () => fakeWorker('fail') });
    const a = client.run({ kind: 'forced-wins', position: MATE1, n: 1 });
    const b = client.run({ kind: 'ping' });
    await expect(a).resolves.toMatchObject({ status: 'checked', value: [mv('a1a9')] });
    await expect(b).resolves.toMatchObject({ status: 'checked' });
    expect(client.mode).toBe('sync');
  });

  it('a Worker that cannot be created falls back to the synchronous path', async () => {
    const client = createAnalysisClient({
      createWorker: () => {
        throw new Error('no workers here');
      },
    });
    await expect(client.run({ kind: 'ping' })).resolves.toMatchObject({ status: 'checked' });
    expect(client.mode).toBe('sync');
  });

  it('a Worker that fails after answering gives "error" for that request and restarts', async () => {
    let n = 0;
    let first: FakeWorker | null = null;
    const client = createAnalysisClient({
      createWorker: () => {
        const w = fakeWorker('answer');
        if (n++ === 0) first = w;
        return w;
      },
    });
    await client.run({ kind: 'ping' });
    const p = client.run({ kind: 'search', position: MID, depth: 2 });
    first!.onerror!({ message: 'out of memory' });
    await expect(p).resolves.toEqual({ status: 'not-checked', kind: 'search', reason: 'error', nodes: 0, message: 'out of memory' });
    expect(client.restarts).toBe(1);
    await expect(client.run({ kind: 'ping' })).resolves.toMatchObject({ status: 'checked' });
    expect(client.mode).toBe('worker');
  });

  it('cancellation: queued, running and already-aborted requests; dispose', async () => {
    const workers: FakeWorker[] = [];
    const client = createAnalysisClient({
      createWorker: () => {
        const w = fakeWorker('hang');
        workers.push(w);
        return w;
      },
    });
    const running = new AbortController();
    const queued = new AbortController();
    const p1 = client.run({ kind: 'ping' }, { signal: running.signal });
    const p2 = client.run({ kind: 'ping' }, { signal: queued.signal });
    const p3 = client.run({ kind: 'ping' });
    queued.abort();
    await expect(p2).resolves.toMatchObject({ status: 'not-checked', reason: 'cancelled' });
    expect(workers[0].terminated).toBe(false);
    running.abort();
    await expect(p1).resolves.toMatchObject({ status: 'not-checked', reason: 'cancelled' });
    expect(workers[0].terminated).toBe(true);
    expect(workers).toHaveLength(2); // p3 went to a new Worker
    await expect(client.run({ kind: 'ping' }, { signal: AbortSignal.abort() })).resolves.toMatchObject({ reason: 'cancelled' });
    client.dispose();
    await expect(p3).resolves.toMatchObject({ reason: 'cancelled' });
    expect(workers[1].terminated).toBe(true);
    await expect(client.run({ kind: 'ping' })).resolves.toMatchObject({ reason: 'cancelled' });
  });

  it('a request that cannot be cloned resolves "error"', async () => {
    const client = createAnalysisClient({
      createWorker: () => {
        const w = fakeWorker();
        w.postMessage = () => {
          throw new Error('DataCloneError');
        };
        return w;
      },
    });
    await expect(client.run({ kind: 'ping' })).resolves.toMatchObject({ status: 'not-checked', reason: 'error', message: 'DataCloneError' });
  });

  it('the synchronous safety net stops the material searches ("timeout")', async () => {
    let t = 0;
    const client = createAnalysisClient({ createWorker: null, syncBudget: 1e9, syncTimeoutMs: 100, now: () => (t += 10) });
    const o = await client.run({ kind: 'search', position: MID, depth: 5 });
    expect(o).toMatchObject({ status: 'not-checked', reason: 'timeout' });
    const sync = createAnalysisClient({ createWorker: null });
    const ac = new AbortController();
    const p = sync.run({ kind: 'ping' }, { signal: ac.signal });
    ac.abort();
    await expect(p).resolves.toMatchObject({ reason: 'cancelled' });
  });

  it('isChecked narrows to a usable verdict', async () => {
    const o = await createAnalysisClient().run({ kind: 'safety-guard', position: MID, move: mv('h0h6'), guard: basics });
    expect(isChecked(o)).toBe(true);
    if (isChecked(o)) expect(typeof o.value.safe).toBe('boolean');
  });
});

describe('analysis client: S2.6 carry-overs (timeout clamp, no main-thread mate search after a Worker failure)', () => {
  it('clampTimeout: NaN → default, negative → 0, Infinity and oversized → MAX_TIMEOUT_MS', () => {
    expect(clampTimeout(undefined, 123)).toBe(123);
    expect(clampTimeout(Number.NaN, 123)).toBe(123);
    expect(clampTimeout(-5, 123)).toBe(0);
    expect(clampTimeout(Infinity, 123)).toBe(MAX_TIMEOUT_MS);
    expect(clampTimeout(2 ** 40, 123)).toBe(MAX_TIMEOUT_MS);
    expect(clampTimeout(-Infinity, 123)).toBe(0);
    expect(clampTimeout(750, 123)).toBe(750);
  });

  it('an Infinity / NaN timeout keeps a safety net (does not fire at once, fires at the clamp / default)', async () => {
    vi.useFakeTimers();
    const client = createAnalysisClient({ createWorker: () => fakeWorker('hang'), timeoutMs: Infinity });
    const states: string[] = [];
    const inf = client.run({ kind: 'ping' });
    void inf.then((o) => states.push(`inf:${o.status === 'checked' ? 'checked' : o.reason}`));
    await vi.advanceTimersByTimeAsync(10);
    expect(states).toEqual([]); // an unclamped Infinity timer would have fired immediately
    await vi.advanceTimersByTimeAsync(MAX_TIMEOUT_MS - 10);
    expect(states).toEqual(['inf:timeout']);

    const nan = client.run({ kind: 'ping' }, { timeoutMs: Number.NaN });
    void nan.then((o) => states.push(`nan:${o.status === 'checked' ? 'checked' : o.reason}`));
    await vi.advanceTimersByTimeAsync(MAX_TIMEOUT_MS - 1); // NaN → the client's default (clamped Infinity)
    expect(states).toEqual(['inf:timeout']);
    await vi.advanceTimersByTimeAsync(1);
    expect(states).toEqual(['inf:timeout', 'nan:timeout']);

    const big = createAnalysisClient({ createWorker: () => fakeWorker('hang') });
    const p = big.run({ kind: 'ping' }, { timeoutMs: 2 ** 40 });
    let done = false;
    void p.then(() => (done = true));
    await vi.advanceTimersByTimeAsync(MAX_TIMEOUT_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toMatchObject({ reason: 'timeout' });

    const nanDefault = createAnalysisClient({ createWorker: () => fakeWorker('hang'), timeoutMs: Number.NaN });
    const q = nanDefault.run({ kind: 'ping' });
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS);
    await expect(q).resolves.toMatchObject({ reason: 'timeout' });
  });

  it('mateDepth names the exhaustive mate depth of each request kind', () => {
    const P = MID;
    expect(mateDepth({ kind: 'ping' })).toBe(0);
    expect(mateDepth({ kind: 'search', position: P, depth: 3 })).toBe(0);
    expect(mateDepth({ kind: 'score-moves', position: P, depth: 2 })).toBe(0);
    expect(mateDepth({ kind: 'winning-captures', position: P })).toBe(0);
    expect(mateDepth({ kind: 'forced-wins', position: P, n: 3 })).toBe(3);
    expect(mateDepth({ kind: 'mate-distances', position: P, k: 2 })).toBe(2);
    expect(mateDepth({ kind: 'safety-guard', position: P, move: mv('h0h6'), guard: basics })).toBe(1);
    expect(mateDepth({ kind: 'safety-guard', position: P, move: mv('h0h6'), guard: advanced })).toBe(2);
    expect(mateDepth({ kind: 'move-signals', position: P, move: mv('h0h6'), guard: intermediate })).toBe(2);
    expect(mateDepth({ kind: 'move-signals', position: P, move: mv('h0h6'), guard: { ...basics, missedMate: 2 } })).toBe(2);
    expect(mateDepth({ kind: 'move-signals', position: P, move: mv('h0h6'), guard: { ...basics, missedMate: 2 }, missed: false })).toBe(1);
    expect(mateDepth({ kind: 'threat', position: P, side: 'red', guard: { h: 2, k: 1, T: 2 } })).toBe(1);
    expect(mateDepth({ kind: 'threat-at-end', position: P, opponent: 'black', guard: basics })).toBe(2);
    expect(mateDepth({ kind: 'predicate', predicate: { kind: 'development' }, before: P, moves: [] })).toBe(0);
    expect(mateDepth({ kind: 'predicate', predicate: { kind: 'not', of: { kind: 'threat' } }, before: P, moves: [] })).toBe(2);
    expect(
      mateDepth({ kind: 'predicate', predicate: { kind: 'all', of: [{ kind: 'no-hanging' }, { kind: 'threat', k: 1 }] }, before: P, moves: [] }),
    ).toBe(1);
  });

  it('after the first Worker fails, the main thread runs no mate search of depth ≥ 2 (but everything else)', async () => {
    const client = createAnalysisClient({ createWorker: () => fakeWorker('fail') });
    const m2 = client.run({ kind: 'forced-wins', position: ENDGAME, n: 2 });
    const md = client.run({ kind: 'mate-distances', position: MID, k: 2 });
    const guard2 = client.run({ kind: 'safety-guard', position: MID, move: mv('h0h6'), guard: advanced });
    const end = client.run({ kind: 'threat-at-end', position: MID, opponent: 'black', guard: basics });
    const m1 = client.run({ kind: 'forced-wins', position: MATE1, n: 1 });
    const guard1 = client.run({ kind: 'safety-guard', position: MID, move: mv('h0h6'), guard: basics });
    const s = client.run({ kind: 'search', position: MID, depth: 2 });
    for (const p of [m2, md, guard2, end]) {
      await expect(p).resolves.toMatchObject({ status: 'not-checked', reason: 'error', message: expect.stringMatching(/mate search/) });
    }
    await expect(m1).resolves.toMatchObject({ status: 'checked', value: [mv('a1a9')] });
    await expect(guard1).resolves.toMatchObject({ status: 'checked' });
    await expect(s).resolves.toMatchObject({ status: 'checked' });
    expect(client.mode).toBe('sync');
    expect(client.fallback).toBe('worker-failed');
  });

  it('without any Worker (createWorker: null, or creation throws) every kind still runs synchronously', async () => {
    const none = createAnalysisClient({ createWorker: null, syncBudget: DEFAULT_REQUEST_BUDGET, syncTimeoutMs: Infinity });
    expect(none.fallback).toBe('no-worker');
    await expect(none.run({ kind: 'forced-wins', position: MATE1, n: 2 })).resolves.toMatchObject({ status: 'checked' });
    await expect(none.run({ kind: 'safety-guard', position: MID, move: mv('h0h6'), guard: advanced })).resolves.toMatchObject({ status: 'checked' });
    const throws = createAnalysisClient({
      createWorker: () => {
        throw new Error('no workers here');
      },
    });
    await expect(throws.run({ kind: 'forced-wins', position: MATE1, n: 2 })).resolves.toMatchObject({ status: 'checked' });
    expect(throws.fallback).toBe('no-worker');
  });

  it('once a Worker has answered, a restarted Worker that fails before answering gives "error"; no main-thread fallback', async () => {
    vi.useFakeTimers();
    const workers: FakeWorker[] = [];
    const kinds = ['answer', 'fail', 'answer'] as const;
    const client = createAnalysisClient({
      createWorker: () => {
        const w = fakeWorker(kinds[Math.min(workers.length, 2)]);
        workers.push(w);
        return w;
      },
    });
    const first = client.run({ kind: 'ping' });
    await vi.advanceTimersByTimeAsync(5);
    await expect(first).resolves.toMatchObject({ status: 'checked' });
    // Make the answering Worker hang so the safety net fires and restarts it.
    workers[0].postMessage = () => {};
    const slow = client.run({ kind: 'forced-wins', position: ENDGAME, n: 3 }, { timeoutMs: 100 });
    const retried = client.run({ kind: 'forced-wins', position: ENDGAME, n: 2 });
    const third = client.run({ kind: 'forced-wins', position: MATE1, n: 1 });
    await vi.advanceTimersByTimeAsync(100);
    await expect(slow).resolves.toMatchObject({ status: 'not-checked', reason: 'timeout' });
    await vi.advanceTimersByTimeAsync(5);
    await expect(retried).resolves.toMatchObject({ status: 'not-checked', reason: 'error', message: 'boom' });
    expect(client.mode).toBe('worker');
    expect(client.fallback).toBeNull();
    await vi.advanceTimersByTimeAsync(5);
    await expect(third).resolves.toMatchObject({ status: 'checked', value: [mv('a1a9')] });
    expect(workers).toHaveLength(3);
  });

  it('when no Worker has ever answered, a failing restarted Worker switches to sync, still without deep mate searches', async () => {
    vi.useFakeTimers();
    const workers: FakeWorker[] = [];
    const client = createAnalysisClient({
      createWorker: () => {
        const w = fakeWorker(workers.length === 0 ? 'hang' : 'fail');
        workers.push(w);
        return w;
      },
    });
    const slow = client.run({ kind: 'forced-wins', position: ENDGAME, n: 3 }, { timeoutMs: 100 });
    const retried = client.run({ kind: 'forced-wins', position: ENDGAME, n: 2 });
    const third = client.run({ kind: 'forced-wins', position: MATE1, n: 1 });
    await vi.advanceTimersByTimeAsync(100);
    await expect(slow).resolves.toMatchObject({ status: 'not-checked', reason: 'timeout' });
    await vi.advanceTimersByTimeAsync(5);
    await expect(retried).resolves.toMatchObject({ status: 'not-checked', reason: 'error', message: expect.stringMatching(/mate search/) });
    await expect(third).resolves.toMatchObject({ status: 'checked', value: [mv('a1a9')] });
    expect(client.mode).toBe('sync');
    expect(client.fallback).toBe('worker-failed');
    expect(workers).toHaveLength(2);
  });

  it('a Worker that cannot be re-created after a restart fails the request; no main-thread fallback', async () => {
    let n = 0;
    const client = createAnalysisClient({
      createWorker: () => {
        if (n++ === 0) return fakeWorker('answer');
        throw new Error('cannot start');
      },
    });
    await expect(client.run({ kind: 'ping' })).resolves.toMatchObject({ status: 'checked' });
    const ac = new AbortController();
    const p = client.run({ kind: 'ping' }, { signal: ac.signal });
    ac.abort(); // terminates the running Worker
    await expect(p).resolves.toMatchObject({ reason: 'cancelled' });
    await expect(client.run({ kind: 'forced-wins', position: MATE1, n: 2 })).resolves.toMatchObject({
      status: 'not-checked',
      reason: 'error',
      message: 'cannot start',
    });
    expect(client.mode).toBe('worker');
  });
});
