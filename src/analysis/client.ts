// Promise API over the analysis Worker (design/04-architecture.md §4 "client.ts", §5.4–§5.5, §7.5).
//
//   const outcome = await getAnalysisClient().run({ kind: 'safety-guard', position, move, guard });
//   if (outcome.status === 'checked') … else neutral feedback, no penalty, no credit (04 §5.4)
//
// - Requests run one at a time in ONE Worker, in call order. Their verdicts depend only on the
//   request and its node limits (requests.ts), never on device speed.
// - Wall-clock safety net (default DEFAULT_TIMEOUT_MS, per request `timeoutMs`): when it fires the
//   Worker is terminated (the only way to stop the engine's exhaustive mate search, which ignores
//   `abort`), the request resolves 'not-checked' / 'timeout', and a fresh Worker is started for the
//   next request. The timer starts when the request is sent, not while it waits in the queue.
// - No Worker (jsdom, Node, old browsers), or a Worker that fails before its first answer (e.g. the
//   chunk cannot load): the synchronous fallback runs `executeRequest` on the calling thread, in a
//   microtask, with the total budget capped at `syncBudget` (default SYNC_BUDGET, sized for ≤ ~50 ms
//   of main-thread work on a desktop) and a `syncTimeoutMs` deadline that stops the material
//   searches (not a running mate search). With the same effective budget both paths give the same
//   outcome (client.test.ts); a request that needs more than the small budget is 'not-checked' here.
// - Never rejects: errors, cancellation (`signal`) and `dispose()` resolve as 'not-checked'.
//
// No React and no DOM: `Worker` and timers only. Components get the shared client from
// `getAnalysisClient()` (or a client injected for tests).
import {
  executeRequest,
  type AnalysisKind,
  type AnalysisOutcome,
  type AnalysisRequest,
  type NotCheckedReason,
  type WorkerRequestMessage,
  type WorkerResponseMessage,
} from './requests';

/** Default wall-clock safety net per Worker request (04 §7.5 budget ≤ ~300 ms desktop; phones slower). Tuned by S2.6. */
export const DEFAULT_TIMEOUT_MS = 5_000;
/** Total node budget per request in the synchronous fallback (~50 ms desktop main-thread work). */
export const SYNC_BUDGET = 1_500;
/** Safety-net deadline of the synchronous fallback (stops the material searches only). */
export const SYNC_TIMEOUT_MS = 250;

/** The part of a Worker the client uses (a real `Worker`, or a fake in tests). */
export interface WorkerLike {
  onmessage: ((event: { readonly data: WorkerResponseMessage }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessageerror?: ((event: unknown) => void) | null;
  postMessage(message: WorkerRequestMessage): void;
  terminate(): void;
}

export interface AnalysisClientOptions {
  /**
   * Creates the Worker. Default: the module Worker built from worker.ts when `Worker` exists, else
   * none. `null` forces the synchronous fallback.
   */
  readonly createWorker?: (() => WorkerLike) | null;
  /** Default safety net per Worker request, in ms. */
  readonly timeoutMs?: number;
  /** Total node budget cap of the synchronous fallback. */
  readonly syncBudget?: number;
  /** Safety-net deadline of the synchronous fallback, in ms. */
  readonly syncTimeoutMs?: number;
  /** Clock for the synchronous deadline and the reported time (ms). Default `performance.now`. */
  readonly now?: () => number;
  /**
   * Called once per settled request (logging, content-review counts of 'not-checked', benchmarks).
   * `ms` = time from sending (Worker) or starting (sync) to the answer, on `now`.
   */
  readonly onOutcome?: (request: AnalysisRequest, outcome: AnalysisOutcome, ms: number) => void;
}

export interface RunOptions {
  /** Safety net for this request, in ms (Worker path). */
  readonly timeoutMs?: number;
  /** Cancels the request: 'not-checked' / 'cancelled'; a running Worker request terminates the Worker. */
  readonly signal?: AbortSignal;
}

export interface AnalysisClient {
  run<R extends AnalysisRequest>(request: R, options?: RunOptions): Promise<AnalysisOutcome<R['kind']>>;
  /** 'worker' until the Worker is unavailable or fails before its first answer, then 'sync'. */
  readonly mode: 'worker' | 'sync';
  /** Workers terminated so far (safety net, cancellation, errors). */
  readonly restarts: number;
  /** Terminates the Worker; pending requests resolve 'not-checked' / 'cancelled'. */
  dispose(): void;
}

/** The module Worker from worker.ts, or null where `Worker` does not exist. */
export function defaultWorkerFactory(): (() => WorkerLike) | null {
  if (typeof Worker === 'undefined') return null;
  return () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;
}

interface Job {
  readonly id: number;
  readonly request: AnalysisRequest;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
  readonly resolve: (outcome: AnalysisOutcome) => void;
  readonly onAbort: () => void;
  started: number;
  timer?: ReturnType<typeof setTimeout>;
  settled: boolean;
}

const notChecked = (kind: AnalysisKind, reason: NotCheckedReason, message?: string): AnalysisOutcome => ({
  status: 'not-checked',
  kind,
  reason,
  nodes: 0,
  ...(message === undefined ? {} : { message }),
});

export function createAnalysisClient(options: AnalysisClientOptions = {}): AnalysisClient {
  const factory = options.createWorker === undefined ? defaultWorkerFactory() : options.createWorker;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const syncBudget = options.syncBudget ?? SYNC_BUDGET;
  const syncTimeoutMs = options.syncTimeoutMs ?? SYNC_TIMEOUT_MS;
  const now = options.now ?? (() => performance.now());

  let mode: 'worker' | 'sync' = factory ? 'worker' : 'sync';
  let worker: WorkerLike | null = null;
  let answered = false; // the current Worker has answered at least once
  let current: Job | null = null;
  const queue: Job[] = [];
  let nextId = 1;
  let restarts = 0;
  let disposed = false;

  function settle(job: Job, outcome: AnalysisOutcome): void {
    if (job.settled) return;
    job.settled = true;
    if (job.timer !== undefined) clearTimeout(job.timer);
    job.signal?.removeEventListener('abort', job.onAbort);
    options.onOutcome?.(job.request, outcome, now() - job.started);
    job.resolve(outcome);
  }

  function kill(): void {
    if (!worker) return;
    const w = worker;
    worker = null;
    w.onmessage = null;
    w.onerror = null;
    if (w.onmessageerror !== undefined) w.onmessageerror = null;
    w.terminate();
    restarts++;
  }

  function runSync(job: Job): void {
    void Promise.resolve().then(() => {
      if (job.settled) return;
      if (disposed || job.signal?.aborted) return settle(job, notChecked(job.request.kind, 'cancelled'));
      job.started = now();
      const deadline = job.started + syncTimeoutMs;
      settle(job, executeRequest(job.request, { maxBudget: syncBudget, expired: () => now() > deadline }));
    });
  }

  /** The Worker cannot be used: run the current and all queued requests synchronously from now on. */
  function switchToSync(): void {
    mode = 'sync';
    kill();
    const pending = current ? [current, ...queue] : [...queue];
    current = null;
    queue.length = 0;
    for (const job of pending) {
      if (job.timer !== undefined) clearTimeout(job.timer);
      runSync(job);
    }
  }

  function onMessage(from: WorkerLike, data: WorkerResponseMessage): void {
    if (from !== worker) return;
    answered = true;
    const job = current;
    if (!job || data.id !== job.id) return;
    current = null;
    settle(job, data.outcome);
    pump();
  }

  function onWorkerFailure(from: WorkerLike, event: unknown): void {
    if (from !== worker) return;
    if (!answered) return switchToSync();
    const job = current;
    current = null;
    kill();
    const message = event && typeof event === 'object' && 'message' in event ? String(event.message) : 'worker error';
    if (job) settle(job, notChecked(job.request.kind, 'error', message));
    pump();
  }

  function ensureWorker(): WorkerLike {
    if (worker) return worker;
    const w = factory!();
    worker = w;
    answered = false;
    w.onmessage = (event) => onMessage(w, event.data);
    w.onerror = (event) => onWorkerFailure(w, event);
    w.onmessageerror = (event) => onWorkerFailure(w, event);
    return w;
  }

  function pump(): void {
    if (current || queue.length === 0 || mode !== 'worker') return;
    const job = queue.shift()!;
    current = job;
    let w: WorkerLike;
    try {
      w = ensureWorker();
    } catch {
      return switchToSync();
    }
    job.started = now();
    job.timer = setTimeout(() => {
      if (current !== job) return;
      current = null;
      kill();
      settle(job, notChecked(job.request.kind, 'timeout'));
      pump();
    }, job.timeoutMs);
    try {
      w.postMessage({ id: job.id, request: job.request });
    } catch (e) {
      // e.g. DataCloneError: the request is not plain data.
      current = null;
      settle(job, notChecked(job.request.kind, 'error', e instanceof Error ? e.message : String(e)));
      pump();
    }
  }

  function cancel(job: Job): void {
    if (job.settled) return;
    const i = queue.indexOf(job);
    if (i >= 0) queue.splice(i, 1);
    if (current === job) {
      current = null;
      kill();
      settle(job, notChecked(job.request.kind, 'cancelled'));
      pump();
      return;
    }
    if (i >= 0) settle(job, notChecked(job.request.kind, 'cancelled'));
    // Otherwise a synchronous request: its microtask sees the abort before it starts.
  }

  return {
    get mode() {
      return mode;
    },
    get restarts() {
      return restarts;
    },
    run<R extends AnalysisRequest>(request: R, runOptions: RunOptions = {}): Promise<AnalysisOutcome<R['kind']>> {
      return new Promise<AnalysisOutcome>((resolve) => {
        const job: Job = {
          id: nextId++,
          request,
          timeoutMs: runOptions.timeoutMs ?? timeoutMs,
          signal: runOptions.signal,
          resolve,
          onAbort: () => cancel(job),
          started: now(),
          settled: false,
        };
        if (disposed || runOptions.signal?.aborted) return settle(job, notChecked(request.kind, 'cancelled'));
        runOptions.signal?.addEventListener('abort', job.onAbort, { once: true });
        if (mode === 'sync') return runSync(job);
        queue.push(job);
        pump();
      }) as Promise<AnalysisOutcome<R['kind']>>;
    },
    dispose() {
      disposed = true;
      const pending = current ? [current, ...queue] : [...queue];
      current = null;
      queue.length = 0;
      kill();
      for (const job of pending) settle(job, notChecked(job.request.kind, 'cancelled'));
    },
  };
}

let shared: AnalysisClient | null = null;

/** The app-wide client (created on first use; the Worker itself starts with the first request). */
export function getAnalysisClient(): AnalysisClient {
  return (shared ??= createAnalysisClient());
}
