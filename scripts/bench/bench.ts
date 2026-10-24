// Phone-cost bench (S2.6; design/04-architecture.md §2.5, §5.5, §7.5, R6, Appendix A.1/A.4; 03 §5.2–§5.3
// UA5). Dev-only page, built by scripts/bench/vite.config.mjs, driven by scripts/bench.mjs (headless
// Chromium with CPU throttling = a PROXY, not a phone) or opened by hand on a real phone.
//
// Everything runs through the app's real analysis client (`createAnalysisClient()` with the default
// Worker factory = `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`, and one
// `getAnalysisClient()` call) and the real training partners of src/play. Timings: one warm-up, then the
// median of N runs (a row whose warm-up took over SLOW_MS gets one measured run). The client's safety
// net is raised to MAX_TIMEOUT_MS (60 s) so raw costs are visible; rows that hit it read "timeout".
import { DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS, createAnalysisClient, getAnalysisClient } from '../../src/analysis/client';
import { DEFAULT_MAX_NODES, SAFETY_GUARDS, type SafetyGuard } from '../../src/analysis/judge';
import { DEFAULT_REQUEST_BUDGET, type AnalysisOutcome, type AnalysisRequest } from '../../src/analysis/requests';
import { START_FEN, legalMoves, makeMove, opposite, parseFen, parseSquare, type Position } from '../../src/engine';
import {
  bestDefence,
  choosePartnerMove,
  createRecord,
  forcingAttack,
  moveToIccs,
  playPartnerMove,
  positionsOf,
  pressing,
  safeSparring,
  type GameRecord,
  type OpponentPolicy,
  type PolicyChoice,
} from '../../src/play';

// ---------- Positions ----------

const START = parseFen(START_FEN);
/** 04 §2.2 "mid": after 1. C2=5 H8+7 2. H2+3 H2+3 3. R1=2 R9=8 (quiet, developed, 37 moves). */
const MID = parseFen('r1bakabr1/9/1cn3nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKABR1 w - - 6 4');
/** Black to move after 1. C2=5 (the P1 pilot situation). */
const OPENING_BLACK = parseFen('rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR b - - 1 1');

interface Endgame {
  readonly id: string;
  /** Attacker (Red) to move: forcing-attack rows. */
  readonly attack: Position;
  /** Defender to move (after Red's first solution move, or the defend item itself): resist-mode rows. */
  readonly defend: Position;
}

/** Endgame positions from the legacy content (mates in 3/4, a defend item) plus one quiet endgame. */
const ENDGAMES: readonly Endgame[] = [
  {
    id: 'u15l3#3',
    attack: parseFen('2b2N3/1N2ak3/5a3/6R2/2bc5/5c3/9/8B/9/4K4 w - - 0 1'),
    defend: parseFen('2b6/1N2ak1N1/5a3/6R2/2bc5/5c3/9/8B/9/4K4 b - - 1 1'),
  },
  {
    id: 'u15l3#2',
    attack: parseFen('3k5/1P7/3ab4/4R4/6p1R/9/C7r/5K3/9/9 w - - 0 1'),
    defend: parseFen('3k5/1P7/3ab4/4R4/6p2/9/C7R/5K3/9/9 b - - 0 1'),
  },
  {
    id: 'u14l1#1',
    attack: parseFen('R8/N8/4k4/N6r1/2b6/9/9/5K3/9/3Ap1B2 w - - 0 1'),
    defend: parseFen('4R4/N8/4k4/N6r1/2b6/9/9/5K3/9/3Ap1B2 b - - 1 1'),
  },
  {
    id: 'u13l3#3',
    attack: parseFen('N2k5/9/b2C5/9/2bP5/9/3C5/3n1K3/4A4/1n3A3 w - - 0 1'),
    defend: parseFen('N2k5/9/bC7/9/2bP5/9/3C5/3n1K3/4A4/1n3A3 b - - 1 1'),
  },
  {
    id: 'u12l2#3',
    attack: parseFen('9/3k5/9/1n7/3C2N2/7N1/4C4/3A5/9/5K3 w - - 0 1'),
    defend: parseFen('9/3k5/9/1n2N4/3C5/7N1/4C4/3A5/9/5K3 b - - 1 1'),
  },
  {
    id: 'u15l2#1',
    attack: parseFen('3a1a2N/c1P6/brNkb4/9/6C2/5c1p1/9/9/9/3AKA3 w - - 0 1'),
    defend: parseFen('3a1a2N/c1P6/br1kb4/9/3N2C2/5c1p1/9/9/9/3AKA3 b - - 1 1'),
  },
  {
    // u11l3#4: a defend item (Red to move parries a mate in 2); attack = Black to move in the same position.
    id: 'u11l3#4',
    attack: parseFen('4k4/3P5/9/1n7/6b2/6r2/1pP6/5K3/p8/1n3C3 b - - 0 1'),
    defend: parseFen('4k4/3P5/9/1n7/6b2/6r2/1pP6/5K3/p8/1n3C3 w - - 0 1'),
  },
  {
    // A quiet constructed endgame (Chariot + Elephant + Advisor + Soldier each side, no forced line).
    id: 'quiet-10',
    attack: parseFen('4k4/4a4/4b4/p8/9/2r6/8P/4B4/4A4/2R1K4 w - - 0 1'),
    defend: parseFen('4k4/4a4/4b4/p8/9/2r6/8P/4B4/4A4/2R1K4 b - - 0 1'),
  },
];

/**
 * Resist mode's expensive case: the defender to move while it still has escapes, so the k = 3 mate
 * guard must PROVE "no mate within 3" after most moves (exhaustive). The attack positions of mates in 4
 * with Black to move instead (Red not in check in any of them).
 */
const RESIST_ESCAPES: readonly { readonly id: string; readonly pos: Position }[] = [
  { id: 'u15l3#3/b', pos: parseFen('2b2N3/1N2ak3/5a3/6R2/2bc5/5c3/9/8B/9/4K4 b - - 0 1') },
  { id: 'u15l3#2/b', pos: parseFen('3k5/1P7/3ab4/4R4/6p1R/9/C7r/5K3/9/9 b - - 0 1') },
  { id: 'u14l1#1/b', pos: parseFen('R8/N8/4k4/N6r1/2b6/9/9/5K3/9/3Ap1B2 b - - 0 1') },
  { id: 'u15l1#1/b', pos: parseFen('3k1a3/9/3a5/1R3r3/1P2CR2p/9/9/4K4/9/2B2A3 b - - 0 1') },
  { id: 'u15l2#4/b', pos: parseFen('2b3b2/3N1k3/5a3/2R3P2/9/R5n2/5n3/p7B/3K5/3A1A3 b - - 0 1') },
  { id: 'u15l2#1/b', pos: parseFen('3a1a2N/c1P6/brNkb4/9/6C2/5c1p1/9/9/9/3AKA3 b - - 0 1') },
];

const pieces = (p: Position) => p.board.filter(Boolean).length;

// ---------- Instrumented client ----------

interface Acc {
  requests: number;
  workerMs: number;
  maxRequestMs: number;
  nodes: number;
  notChecked: Record<string, number>;
}
const newAcc = (): Acc => ({ requests: 0, workerMs: 0, maxRequestMs: 0, nodes: 0, notChecked: {} });
let acc: Acc = newAcc();

const client = createAnalysisClient({
  timeoutMs: MAX_TIMEOUT_MS,
  onOutcome: (_req: AnalysisRequest, o: AnalysisOutcome, ms: number) => {
    acc.requests++;
    acc.workerMs += ms;
    acc.maxRequestMs = Math.max(acc.maxRequestMs, ms);
    acc.nodes += o.nodes;
    if (o.status !== 'checked') acc.notChecked[o.reason] = (acc.notChecked[o.reason] ?? 0) + 1;
  },
});

const RAW = { maxNodes: 1e8, budget: 1e9 } as const;

async function ask(request: AnalysisRequest): Promise<string> {
  const o = await client.run(request);
  if (o.status !== 'checked') return `not-checked:${o.reason}`;
  const v = o.value as unknown;
  if (Array.isArray(v)) return `${v.length} items`;
  if (v && typeof v === 'object' && 'score' in v) return `score ${(v as { score: number }).score}`;
  return 'checked';
}

function describe(c: PolicyChoice): string {
  if (c.kind === 'move') return `${moveToIccs(c.move)}${c.safetyNet ? ` SAFETY-NET(${c.safetyNet})` : ''}`;
  if (c.kind === 'hand-over') return `hand-over${c.safetyNet ? ` SAFETY-NET(${c.safetyNet})` : ''}`;
  return c.kind;
}

function recordAt(pos: Position, seed = 1): GameRecord {
  return createRecord(pos, { learner: opposite(pos.turn), seed });
}

async function partner(policy: OpponentPolicy, pos: Position): Promise<string> {
  return describe(await choosePartnerMove(policy, recordAt(pos), client));
}

// ---------- Workloads ----------

interface Workload {
  readonly group: string;
  readonly id: string;
  readonly pieces: number;
  readonly runs: number;
  readonly run: () => Promise<string>;
}

export interface Row {
  group: string;
  id: string;
  pieces: number;
  n: number;
  medianMs: number;
  minMs: number;
  maxMs: number;
  warmupMs: number;
  workerMs: number;
  maxRequestMs: number;
  requests: number;
  nodes: number;
  notChecked: Record<string, number>;
  result: string;
}

export interface Dist {
  id: string;
  n: number;
  medianMs: number;
  meanMs: number;
  p90Ms: number;
  maxMs: number;
  totalMs: number;
  notChecked: Record<string, number>;
  safetyNet: number;
}

const SLOW_MS = 5_000;

function workloads(quick: boolean): Workload[] {
  const runs = quick ? 1 : 5;
  const few = quick ? 1 : 3;
  const w: Workload[] = [];
  const add = (group: string, id: string, pos: Position, r: number, run: () => Promise<string>) =>
    w.push({ group, id, pieces: pieces(pos), runs: r, run });

  // A.1 equivalents through the Worker (raw: node limits lifted, so the costs match 04 §2.2's calls).
  for (const d of [2, 3, 4]) add('A.1 raw', `search(start, ${d})`, START, d === 4 ? few : runs, () => ask({ kind: 'search', position: START, depth: d, limits: RAW }));
  for (const d of [2, 3, 4]) add('A.1 raw', `search(mid, ${d})`, MID, d === 4 ? few : runs, () => ask({ kind: 'search', position: MID, depth: d, limits: RAW }));
  add('A.1 raw', 'forced-wins(start, 2)', START, runs, () => ask({ kind: 'forced-wins', position: START, n: 2 }));
  add('A.1 raw', 'forced-wins(mid, 2)', MID, runs, () => ask({ kind: 'forced-wins', position: MID, n: 2 }));
  add('A.1 raw', 'score-moves(mid, 2) material, all moves', MID, runs, () => ask({ kind: 'score-moves', position: MID, depth: 2, limits: RAW }));
  if (!quick) add('A.1 raw', 'score-moves(mid, 3) material, all moves', MID, few, () => ask({ kind: 'score-moves', position: MID, depth: 3, limits: RAW }));

  // The mate guard (04 §2.2 / §7.5: hasForcedWin after every move, k = 2) and the decision guard.
  add('mate guard', 'mate-distances(mid, k=2), all moves', MID, runs, () => ask({ kind: 'mate-distances', position: MID, k: 2 }));
  add('mate guard', 'mate-distances(opening-black, k=2)', OPENING_BLACK, runs, () => ask({ kind: 'mate-distances', position: OPENING_BLACK, k: 2 }));
  add('mate guard', 'safety-guard advanced (h2,k2), one move (mid h0-h6)', MID, runs, () =>
    ask({ kind: 'safety-guard', position: MID, move: { from: parseSquare('h0'), to: parseSquare('h6') }, guard: SAFETY_GUARDS.advanced }),
  );

  // A.4 policies through src/play (default node limits: maxNodes 20,000 per search, budget 50,000).
  for (const [name, pos] of [
    ['mid', MID],
    ['opening-black', OPENING_BLACK],
  ] as const) {
    add('partners full board', `safe-sparring(2) ${name}`, pos, runs, () => partner(safeSparring(2, 1.0), pos));
    add('partners full board', `pressing(2) ${name}`, pos, runs, () => partner(pressing(2), pos));
    add('partners full board', `forcing-attack(2) ${name}`, pos, runs, () => partner(forcingAttack(2), pos));
  }
  if (!quick) {
    add('partners full board', 'safe-sparring(3) mid', MID, 1, () => partner(safeSparring(3, 1.0), MID));
    add('partners full board', 'pressing(3) mid', MID, 1, () => partner(pressing(3), MID));
  }

  // Endgames: forcing-attack(2/3), best-defence resist mode k = d = 2 and 3, pressing(2).
  const endgames = quick ? ENDGAMES.slice(0, 3) : ENDGAMES;
  for (const e of endgames) add('endgame forcing-attack', `forcing-attack(2) ${e.id}`, e.attack, runs, () => partner(forcingAttack(2), e.attack));
  if (!quick) for (const e of endgames) add('endgame forcing-attack', `forcing-attack(3) ${e.id}`, e.attack, few, () => partner(forcingAttack(3), e.attack));
  for (const e of endgames) add('endgame resist', `resist k=d=2 ${e.id}`, e.defend, runs, () => partner(bestDefence({ resist: true, k: 2, d: 2 }), e.defend));
  if (!quick) {
    for (const e of endgames) add('endgame resist', `resist k=3,d=2 ${e.id}`, e.defend, few, () => partner(bestDefence({ resist: true, k: 3, d: 2 }), e.defend));
    for (const e of endgames) add('endgame resist', `resist k=d=3 ${e.id}`, e.defend, few, () => partner(bestDefence({ resist: true, k: 3, d: 3 }), e.defend));
  }
  const hard = quick ? RESIST_ESCAPES.slice(0, 2) : RESIST_ESCAPES;
  for (const e of hard) add('resist with escapes', `resist k=d=2 ${e.id}`, e.pos, runs, () => partner(bestDefence({ resist: true, k: 2, d: 2 }), e.pos));
  if (!quick) for (const e of hard) add('resist with escapes', `resist k=d=3 ${e.id}`, e.pos, few, () => partner(bestDefence({ resist: true, k: 3, d: 3 }), e.pos));
  for (const e of endgames) add('endgame pressing', `pressing(2) ${e.id}`, e.defend, runs, () => partner(pressing(2), e.defend));
  return w;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)];
};

async function measure(w: Workload): Promise<Row> {
  acc = newAcc();
  let t0 = performance.now();
  let result = await w.run();
  const warmupMs = performance.now() - t0;
  const n = warmupMs > SLOW_MS ? 1 : w.runs;
  const times: number[] = [];
  const accs: Acc[] = [];
  for (let i = 0; i < n; i++) {
    acc = newAcc();
    t0 = performance.now();
    result = await w.run();
    times.push(performance.now() - t0);
    accs.push(acc);
  }
  const last = accs[accs.length - 1];
  return {
    group: w.group,
    id: w.id,
    pieces: w.pieces,
    n,
    medianMs: median(times),
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
    warmupMs,
    workerMs: median(accs.map((a) => a.workerMs)),
    maxRequestMs: Math.max(...accs.map((a) => a.maxRequestMs)),
    requests: last.requests,
    nodes: last.nodes,
    notChecked: last.notChecked,
    result,
  };
}

// ---------- A practical-play game and its post-game signals ----------

async function playGame(plies: number, onProgress: (s: string) => void) {
  // Red = safe-sparring(2, τ 1.0) (stands in for the learner), Black = pressing(2) (the partner).
  const red = safeSparring(2, 1.0);
  const black = pressing(2);
  let record = createRecord(START, { learner: 'red', seed: 2026 });
  const per: Record<string, number[]> = { red: [], black: [] };
  const flags = { safetyNet: 0, notChecked: {} as Record<string, number> };
  acc = newAcc();
  for (let ply = 0; ply < plies; ply++) {
    const side = ply % 2 === 0 ? 'red' : 'black';
    const t0 = performance.now();
    const { choice, record: next } = await playPartnerMove(side === 'red' ? red : black, record, client);
    per[side].push(performance.now() - t0);
    if (choice.kind !== 'move') break;
    if (choice.safetyNet) flags.safetyNet++;
    record = next;
    onProgress(`game ply ${ply + 1}/${plies}`);
  }
  flags.notChecked = acc.notChecked;
  return { record, per, flags };
}

async function signalsOf(record: GameRecord, guard: SafetyGuard, threats: boolean, onProgress: (s: string) => void): Promise<number[] & { notChecked?: Record<string, number> }> {
  const positions = positionsOf(record);
  const times: number[] = [];
  acc = newAcc();
  for (let i = 0; i < record.moves.length; i += 2) {
    const t0 = performance.now();
    await client.run({ kind: 'move-signals', position: positions[i], move: record.moves[i].move, guard, threats });
    times.push(performance.now() - t0);
    onProgress(`signals h=${guard.h}: move ${i / 2 + 1}`);
  }
  return Object.assign(times, { notChecked: acc.notChecked });
}

function dist(id: string, xs: number[], notChecked: Record<string, number> = {}, safetyNet = 0): Dist {
  return { id, n: xs.length, medianMs: median(xs), meanMs: xs.reduce((a, b) => a + b, 0) / xs.length, p90Ms: pct(xs, 0.9), maxMs: Math.max(...xs), totalMs: xs.reduce((a, b) => a + b, 0), notChecked, safetyNet };
}

// ---------- Run ----------

export interface BenchResult {
  meta: Record<string, unknown>;
  calibration: { mainThreadMs: number; workerMs: number };
  client: Record<string, unknown>;
  rows: Row[];
  game: Dist[];
  longTasks: { count: number; maxMs: number; totalMs: number };
  totalSeconds: number;
}

/** A fixed main-thread workload (legal-move generation) to verify the CPU throttling factor. */
function mainThreadSpin(): number {
  const t0 = performance.now();
  let n = 0;
  for (let i = 0; i < 3000; i++) {
    for (const m of legalMoves(MID)) n += makeMove(MID, m).halfmoveClock;
  }
  if (n < 0) console.log(n);
  return performance.now() - t0;
}

export async function runBench(options: { quick?: boolean; onProgress?: (s: string) => void } = {}): Promise<BenchResult> {
  const quick = options.quick === true;
  const progress = options.onProgress ?? (() => {});
  const started = performance.now();
  // Cold start: a fresh client's first request starts the Worker (chunk load + module evaluation).
  const cold = createAnalysisClient();
  let t0 = performance.now();
  const coldPing = await cold.run({ kind: 'ping' });
  const coldStartMs = performance.now() - t0;
  cold.dispose();
  // The app-wide client works the same way.
  const shared = await getAnalysisClient().run({ kind: 'ping' });
  await client.run({ kind: 'ping' });
  progress('calibrating');
  const calibration = await calibrate();
  // Main-thread long tasks from here on (the calibration spin above is one on purpose): the app-side
  // work of the partners (repetition filter, candidate lists) and the client.
  const longTasks: number[] = [];
  let observer: PerformanceObserver | null = null;
  try {
    observer = new PerformanceObserver((list) => list.getEntries().forEach((e) => longTasks.push(e.duration)));
    observer.observe({ type: 'longtask', buffered: false });
  } catch {
    observer = null; // longtask timing not supported (Safari): not reported
  }

  // Safety net: a request over its time limit is 'not-checked'/'timeout', the Worker is terminated
  // and a new one answers the next request.
  const restartsBefore = client.restarts;
  const slow = await client.run({ kind: 'search', position: MID, depth: 12, limits: RAW }, { timeoutMs: 200 });
  t0 = performance.now();
  const afterRestart = await client.run({ kind: 'ping' });
  const restartMs = performance.now() - t0;

  const rows: Row[] = [];
  const list = workloads(quick);
  for (const [i, w] of list.entries()) {
    progress(`${i + 1}/${list.length}: ${w.id}`);
    rows.push(await measure(w));
  }

  const plies = quick ? 12 : 30;
  const g = await playGame(plies, progress);
  const game: Dist[] = [
    dist(`game: safe-sparring(2) per move (Red, full board, ${g.per.red.length} moves)`, g.per.red, {}, 0),
    dist(`game: pressing(2) per move (Black, full board, ${g.per.black.length} moves)`, g.per.black, g.flags.notChecked, g.flags.safetyNet),
  ];
  const h2 = await signalsOf(g.record, SAFETY_GUARDS.advanced, false, progress);
  game.push(dist('post-game signals h=2 (advanced guard, per learner move)', h2, h2.notChecked));
  if (!quick) {
    const h3 = await signalsOf(g.record, { ...SAFETY_GUARDS.advanced, h: 3 }, false, progress);
    game.push(dist('post-game signals h=3 (per learner move)', h3, h3.notChecked));
    const h2t = await signalsOf(g.record, SAFETY_GUARDS.advanced, true, progress);
    game.push(dist('post-game signals h=2 + unanswered threat (per learner move)', h2t, h2t.notChecked));
  }
  observer?.disconnect();

  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    meta: {
      userAgent: nav.userAgent,
      hardwareConcurrency: nav.hardwareConcurrency,
      deviceMemory: nav.deviceMemory ?? null,
      quick,
      date: new Date().toISOString(),
      defaults: { DEFAULT_MAX_NODES, DEFAULT_REQUEST_BUDGET, DEFAULT_TIMEOUT_MS, benchTimeoutMs: MAX_TIMEOUT_MS },
      gameMoves: g.record.moves.map((m) => moveToIccs(m.move)).join(' '),
      longTaskTiming: observer !== null,
    },
    calibration,
    client: {
      mode: client.mode,
      fallback: client.fallback,
      coldStartMs,
      coldPing: coldPing.status,
      sharedClientPing: shared.status,
      timeoutDemo: slow.status === 'checked' ? 'checked (no timeout!)' : slow.reason,
      restartsAfterTimeout: client.restarts - restartsBefore,
      restartPingMs: restartMs,
      afterRestart: afterRestart.status,
    },
    rows,
    game,
    longTasks: { count: longTasks.length, maxMs: longTasks.length ? Math.max(...longTasks) : 0, totalMs: longTasks.reduce((a, b) => a + b, 0) },
    totalSeconds: (performance.now() - started) / 1000,
  };
}

// ---------- Text report (the page and scripts/bench.mjs) ----------

const f = (ms: number) => (ms >= 10_000 ? `${(ms / 1000).toFixed(1)} s` : `${ms.toFixed(ms < 10 ? 1 : 0)} ms`);
const nc = (o: Record<string, number>) => (Object.keys(o).length ? ` NOT-CHECKED ${JSON.stringify(o)}` : '');

export function formatResult(r: BenchResult): string {
  const lines: string[] = [];
  lines.push(`${r.meta.userAgent}`);
  lines.push(`cores ${r.meta.hardwareConcurrency}, memory ${r.meta.deviceMemory ?? '?'} GB, ${r.meta.date}, quick ${r.meta.quick}`);
  lines.push(`calibration: main-thread spin ${f(r.calibration.mainThreadMs)}, Worker search(mid,3) ${f(r.calibration.workerMs)}`);
  lines.push(`client: ${JSON.stringify(r.client)}`);
  lines.push(`main-thread long tasks: ${r.longTasks.count} (max ${f(r.longTasks.maxMs)})${r.meta.longTaskTiming ? '' : ' [not supported]'}`);
  let group = '';
  for (const row of r.rows) {
    if (row.group !== group) {
      group = row.group;
      lines.push('', `## ${group}`);
    }
    lines.push(
      `${row.id.padEnd(48)} ${String(row.pieces).padStart(2)}p  median ${f(row.medianMs).padStart(8)} (n=${row.n}, min ${f(row.minMs)}, max ${f(row.maxMs)}, warm-up ${f(row.warmupMs)})  req ${row.requests}, nodes ${row.nodes}, worker ${f(row.workerMs)}  → ${row.result}${nc(row.notChecked)}`,
    );
  }
  lines.push('', '## game and post-game signals');
  for (const d of r.game) {
    lines.push(`${d.id.padEnd(64)} median ${f(d.medianMs)}, mean ${f(d.meanMs)}, p90 ${f(d.p90Ms)}, max ${f(d.maxMs)}, total ${f(d.totalMs)} (n=${d.n})${nc(d.notChecked)}${d.safetyNet ? ` SAFETY-NET ${d.safetyNet}` : ''}`);
  }
  lines.push('', `total ${r.totalSeconds.toFixed(0)} s`);
  return lines.join('\n');
}

// ---------- Page wiring ----------

declare global {
  interface Window {
    __benchRun?: (options?: { quick?: boolean }) => Promise<{ result: BenchResult; text: string }>;
    __benchCalibrate?: () => Promise<{ mainThreadMs: number; workerMs: number }>;
  }
}

/** Main-thread spin and a Worker search(mid, 3): scripts/bench.mjs checks that throttling reaches both. */
export async function calibrate(): Promise<{ mainThreadMs: number; workerMs: number }> {
  mainThreadSpin();
  const mainThreadMs = median([mainThreadSpin(), mainThreadSpin(), mainThreadSpin()]);
  const cal: number[] = [];
  for (let i = 0; i < 4; i++) {
    const t0 = performance.now();
    await client.run({ kind: 'search', position: MID, depth: 3, limits: RAW });
    if (i > 0) cal.push(performance.now() - t0);
  }
  return { mainThreadMs, workerMs: median(cal) };
}

window.__benchCalibrate = calibrate;

const $ = (id: string) => document.getElementById(id)!;

window.__benchRun = async (options = {}) => {
  const result = await runBench({ ...options, onProgress: (s) => ($('status').textContent = `Running… ${s}`) });
  const text = formatResult(result);
  $('status').textContent = 'Done.';
  $('table').textContent = text;
  $('json').textContent = JSON.stringify(result, null, 1);
  ($('copy') as HTMLButtonElement).disabled = false;
  return { result, text };
};

$('run').addEventListener('click', async () => {
  ($('run') as HTMLButtonElement).disabled = true;
  try {
    await window.__benchRun!({ quick: ($('quick') as HTMLInputElement).checked });
  } catch (e) {
    $('status').textContent = `Failed: ${e instanceof Error ? e.message : String(e)}`;
  }
});

$('copy').addEventListener('click', async () => {
  const text = `${$('table').textContent}\n\nJSON:\n${$('json').textContent}`;
  try {
    await navigator.clipboard.writeText(text);
    $('status').textContent = 'Copied.';
  } catch {
    // Clipboard API needs a secure context (http://<LAN IP> is not): select the text instead.
    const range = document.createRange();
    range.selectNodeContents($('table'));
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
    $('status').textContent = 'Copy blocked here: the table is selected, use the system Copy.';
  }
});
