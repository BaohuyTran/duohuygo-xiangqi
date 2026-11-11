// Seeded self-play of the `pressing` partner (backlog S2.18, design/03-assessment.md §5.2, 04 §5.5 item 4).
//
// From every pilot task position (the task's start and the positions where its tree hands over to the partner chain:
// the position after an accepted learner move that has no authored continuation, or ends in a leaf) it plays:
//   P×S  `pressing(2)` on the task's PARTNER side against `safe-sparring(2, τ)` on the learner's side (τ of the level);
//   S×P  the same with the colours swapped (pressing on the learner's side);
//   P×P  `pressing(2)` against itself.
// Each game runs under the full-game rules of src/play/adjudicate.ts with a shorter cap (`--cap`, learner-side moves;
// the 30-move no-capture limit and the material rule apply at the stop). Every partner search goes through
// `directAnalyzer()` (the Worker's requests on this thread), default node limits (D9: 20,000 per search, 50,000 per
// request).
//
// Records per game: result and reason, plies, material swings (static count, Red's view), repetition / perpetual
// outcomes and third-occurrence moves, safety-net (not-checked) moves, nodes and ms per move. Per `pressing` move it also
// counts "drops": the quiescence-resolved material (search depth 0) from pressing's view after the opponent's reply is
// ≥ 2 below the value before pressing's move (the same measure for safe-sparring, for comparison).
//
// Writes:
//   - the summary table to stdout;
//   - `docs/curriculum-upgrade/pressing-sample.md`: a plausibility sample of `--sample` (default 60) pressing moves (FEN,
//     move in traditional notation en + vi, the runner-up, and the weighted feature terms that chose it) for an
//     independent content-reviewer (`--no-sample` skips it);
//   - `ui-check-output/self-play/self-play.json` (git-ignored; `--out` changes the folder): every game.
//
// Run: npx tsx scripts/self-play.ts [--seeds N] [--cap N] [--handovers N] [--sample N] [--no-sample]
//      [--tasks b09-g1,a07-g1] [--weights mobility=0.03,palacePressure=0.08,hanging=0.3,crossedSoldier=0.5] [--jobs N]
//      [--out <dir under ui-check-output>]
// Defaults: 2 seeds, cap 30, ≤ 3 hand-over positions per task, 4 jobs (child processes, games split by index; the
// result does not depend on the job count). Dev-time only; not part of `npm test`.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DEFAULT_WEIGHTS, evaluateTerms, featureEvaluator, search, searchMove, type EvalTerms, type EvalWeights } from '../src/analysis';
import { DEFAULT_MAX_NODES } from '../src/analysis/judge';
import { DEFAULT_REQUEST_BUDGET, type AnalysisOutcome, type AnalysisRequest } from '../src/analysis/requests';
import { tauOf } from '../src/assessment/practical';
import type { Exercise, LineLearnerNode, PlayExercise, Unit } from '../src/content/types';
import { legalMoves as legalMovesOf, makeMove, materialBalance, toFen, type Color, type Move, type Position } from '../src/engine';
import { positionOf } from '../src/lessons/answers';
import { moveKey, parseMoveKey } from '../src/lessons/decision';
import { formatMove } from '../src/notation/format';
import {
  adjudicate,
  createRecord,
  currentPosition,
  directAnalyzer,
  playPartnerMove,
  pressing,
  safeSparring,
  type Analyzer,
  type OpponentPolicy,
  type Outcome,
} from '../src/play';

const root = resolve(import.meta.dirname, '..');
const PILOT_TASKS = ['b09-g1', 'i08-g1', 'a03-g1', 'a07-g1'];

// ---------- options ----------

const argv = process.argv.slice(2);
const option = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const seeds = Number(option('--seeds') ?? 2);
const cap = Number(option('--cap') ?? 30);
const maxHandovers = Number(option('--handovers') ?? 3);
const sampleSize = Number(option('--sample') ?? 60);
const writeSample = !argv.includes('--no-sample');
const taskIds = option('--tasks')?.split(',') ?? PILOT_TASKS;
const weights: EvalWeights = (() => {
  const spec = option('--weights');
  if (!spec) return DEFAULT_WEIGHTS;
  const w: Record<string, number> = { ...DEFAULT_WEIGHTS };
  for (const part of spec.split(',')) {
    const [k, v] = part.split('=');
    if (!(k in w) || !Number.isFinite(Number(v))) throw new Error(`--weights: bad term "${part}"`);
    w[k] = Number(v);
  }
  return w as unknown as EvalWeights;
})();
const customWeights = option('--weights') !== undefined;
const jobs = Math.max(1, Number(option('--jobs') ?? 4));
/** Internal: `k/N` = play only the games whose index ≡ k (mod N) and write them to part-k.json (used by --jobs). */
const part = option('--part');

// ---------- pilot positions ----------

function loadUnits(): Unit[] {
  const dir = join(root, 'src/content/lessons');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Unit);
}

const items = (unit: Unit): Exercise[] => [...unit.lessons.flatMap((l) => l.exercises), ...(unit.pool ?? [])];

interface StartPoint {
  task: string;
  /** 'start' or the learner/opponent moves of the tree path to the hand-over, ICCS keys. */
  label: string;
  position: Position;
  learner: Color;
  tau: number;
}

const isAccepted = (cls: string) => cls === 'target' || cls === 'sound';

/** Positions after an accepted learner move with no authored continuation (or a leaf): the partner chain moves there. */
function handOvers(root: LineLearnerNode, start: Position): { path: string[]; position: Position }[] {
  const out: { path: string[]; position: Position }[] = [];
  const walk = (node: LineLearnerNode, pos: Position, path: string[]) => {
    for (const row of node.table) {
      if (!isAccepted(row.class)) continue;
      const move = parseMoveKey(row.move);
      if (!move) continue;
      const after = makeMove(pos, move);
      const next = node.next?.[row.move];
      if (!next || next.kind === 'leaf') {
        out.push({ path: [...path, row.move], position: after });
        continue;
      }
      if (next.kind !== 'opponent') continue;
      for (const reply of next.replies) {
        const rm = parseMoveKey(reply.move);
        if (!rm) continue;
        if (reply.next.kind === 'learner') walk(reply.next, makeMove(after, rm), [...path, row.move, reply.move]);
      }
    }
  };
  walk(root, start, []);
  return out;
}

/** Up to `n` items spread evenly over the list (first and last included), deterministic. */
function spread<T>(list: readonly T[], n: number): T[] {
  if (list.length <= n) return [...list];
  if (n <= 0) return [];
  if (n === 1) return [list[0]];
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(list[Math.round((i * (list.length - 1)) / (n - 1))]);
  return [...new Set(out)];
}

function startPoints(): StartPoint[] {
  const tasks = loadUnits()
    .flatMap(items)
    .filter((e): e is PlayExercise => e.type === 'play' && taskIds.includes(e.id ?? ''));
  const missing = taskIds.filter((id) => !tasks.some((t) => t.id === id));
  if (missing.length) throw new Error(`task(s) not found: ${missing.join(', ')}`);
  const points: StartPoint[] = [];
  for (const ex of taskIds.map((id) => tasks.find((t) => t.id === id)!)) {
    const start = positionOf(ex);
    const learner: Color = ex.side ?? 'red';
    const tau = tauOf(ex.id);
    points.push({ task: ex.id!, label: 'start', position: start, learner, tau });
    // Deduplicate by FEN; sort by path for a stable spread.
    const seen = new Set<string>();
    const hos = (ex.tree ? handOvers(ex.tree, start) : [])
      .filter((h) => {
        const fen = toFen(h.position);
        if (seen.has(fen)) return false;
        seen.add(fen);
        return true;
      })
      .sort((a, b) => a.path.length - b.path.length || a.path.join(' ').localeCompare(b.path.join(' ')));
    for (const h of spread(hos, maxHandovers)) points.push({ task: ex.id!, label: h.path.join(' '), position: h.position, learner, tau });
  }
  return points;
}

// ---------- instrumented analyzer ----------

interface MoveCost {
  nodes: number;
  maxRequestNodes: number;
  requests: number;
  ms: number;
}

function meteredAnalyzer(): { analyzer: Analyzer; take: () => Omit<MoveCost, 'ms'> } {
  const inner = directAnalyzer();
  let nodes = 0;
  let maxRequestNodes = 0;
  let requests = 0;
  return {
    analyzer: {
      async run<R extends AnalysisRequest>(request: R): Promise<AnalysisOutcome<R['kind']>> {
        const out = await inner.run(request);
        nodes += out.nodes;
        maxRequestNodes = Math.max(maxRequestNodes, out.nodes);
        requests++;
        return out;
      },
    },
    take() {
      const r = { nodes, maxRequestNodes, requests };
      nodes = 0;
      maxRequestNodes = 0;
      requests = 0;
      return r;
    },
  };
}

// ---------- games ----------

type Pairing = 'P×S' | 'S×P' | 'P×P';

interface PlyInfo {
  side: Color;
  policy: string;
  iccs: string;
  cost: MoveCost;
  safetyNet?: string;
  thirdOccurrence?: boolean;
}

interface Game {
  task: string;
  label: string;
  pairing: Pairing;
  seed: number;
  /** Side played by `pressing` in P×S / S×P (both in P×P). */
  pressingSides: Color[];
  outcome: Outcome | { reason: 'stuck'; result: 'none'; winner: null };
  plies: number;
  /** Static material, Red's view, at every position (start included). */
  material: number[];
  /** Per pressing / safe-sparring move: quiescence material drop ≥ 2 after the reply. */
  drops: { pressing: number; safe: number; pressingMoves: number; safeMoves: number };
  thirdOccurrences: number;
  safetyNets: number;
  safetyNetsPressing: number;
  plyInfo: PlyInfo[];
  startFen: string;
}

const qMaterial = (pos: Position): number => {
  const r = search(pos, { depth: 0, maxNodes: 200_000 });
  return pos.turn === 'red' ? r.score : -r.score;
};

async function playGame(point: StartPoint, pairing: Pairing, seed: number): Promise<Game> {
  const partner: Color = point.learner === 'red' ? 'black' : 'red';
  const press = pressing(2, customWeights ? { weights } : {});
  const safe = safeSparring(2, point.tau);
  const policyOf = (side: Color): OpponentPolicy => {
    if (pairing === 'P×P') return press;
    const pressingSide = pairing === 'P×S' ? partner : point.learner;
    return side === pressingSide ? press : safe;
  };
  const pressingSides: Color[] = pairing === 'P×P' ? ['red', 'black'] : [pairing === 'P×S' ? partner : point.learner];
  const { analyzer, take } = meteredAnalyzer();
  // The record's "learner" is the task's learner side, so the cap counts that side's moves.
  let record = createRecord(point.position, { learner: point.learner, seed });
  const ruleset = { kind: 'full-game' as const, cap };
  const plyInfo: PlyInfo[] = [];
  let outcome: Game['outcome'] | null = null;
  while (!outcome) {
    const side = currentPosition(record).turn;
    const t0 = performance.now();
    const { choice, record: next } = await playPartnerMove(policyOf(side), record, analyzer);
    const ms = performance.now() - t0;
    if (choice.kind !== 'move') {
      outcome = adjudicate(record, ruleset) ?? { reason: 'stuck', result: 'none', winner: null };
      break;
    }
    record = next;
    plyInfo.push({
      side,
      policy: choice.policy,
      iccs: moveKey(choice.move),
      cost: { ...take(), ms },
      ...(choice.safetyNet ? { safetyNet: choice.safetyNet } : {}),
      ...(choice.thirdOccurrence ? { thirdOccurrence: true } : {}),
    });
    outcome = adjudicate(record, ruleset);
  }
  // Material per position and drops.
  const positions: Position[] = [point.position];
  for (const m of record.moves) positions.push(makeMove(positions[positions.length - 1], m.move));
  const material = positions.map((p) => materialBalance(p.board, 'red'));
  const q = positions.map(qMaterial);
  const drops = { pressing: 0, safe: 0, pressingMoves: 0, safeMoves: 0 };
  for (let i = 0; i < plyInfo.length; i++) {
    const side = plyInfo[i].side;
    const isPressing = plyInfo[i].policy.startsWith('pressing');
    if (isPressing) drops.pressingMoves++;
    else drops.safeMoves++;
    if (i + 2 >= positions.length) continue; // no reply
    const sign = side === 'red' ? 1 : -1;
    const drop = sign * (q[i] - q[i + 2]);
    if (drop >= 2) {
      if (isPressing) drops.pressing++;
      else drops.safe++;
    }
  }
  return {
      task: point.task,
      label: point.label,
      pairing,
      seed,
      pressingSides,
      outcome,
      plies: record.moves.length,
      material,
      drops,
      thirdOccurrences: plyInfo.filter((p) => p.thirdOccurrence).length,
      safetyNets: plyInfo.filter((p) => p.safetyNet).length,
      safetyNetsPressing: plyInfo.filter((p) => p.safetyNet && p.policy.startsWith('pressing')).length,
      plyInfo,
      startFen: toFen(point.position),
  };
}

// ---------- plausibility sample ----------

interface SampleRow {
  task: string;
  label: string;
  pairing: Pairing;
  seed: number;
  ply: number;
  fen: string;
  side: Color;
  move: string;
  moveVi: string;
  iccs: string;
  score: number;
  runnerUp: { move: string; iccs: string; score: number } | null;
  materialBest: { move: string; iccs: string; score: number; chosenMaterialScore: number };
  pv: string;
  delta: EvalTerms;
}

const TERMS = ['material', 'mobility', 'palacePressure', 'hanging', 'crossedSoldiers'] as const;

function explain(game: Game, ply: number, pos: Position, move: Move): SampleRow {
  const evaluate = featureEvaluator(weights);
  const scored = legalScores(pos, evaluate).sort((a, b) => b.score - a.score);
  const chosen = scored.find((s) => s.move.from === move.from && s.move.to === move.to)!;
  const other = scored.find((s) => !(s.move.from === move.from && s.move.to === move.to)) ?? null;
  const material = legalScores(pos, undefined).sort((a, b) => b.score - a.score);
  const chosenMat = material.find((s) => s.move.from === move.from && s.move.to === move.to)!;
  const r = searchMove(pos, move, { depth: 2, evaluate, maxNodes: DEFAULT_MAX_NODES });
  let leaf = pos;
  const pvText: string[] = [];
  for (const m of r.pv) {
    pvText.push(formatMove(m, leaf));
    leaf = makeMove(leaf, m);
  }
  const before = evaluateTerms(pos.board, pos.turn, weights);
  const after = evaluateTerms(leaf.board, pos.turn, weights);
  const delta = Object.fromEntries([...TERMS, 'total'].map((k) => [k, round2(after[k as keyof EvalTerms] - before[k as keyof EvalTerms])])) as unknown as EvalTerms;
  return {
    task: game.task,
    label: game.label,
    pairing: game.pairing,
    seed: game.seed,
    ply,
    fen: toFen(pos),
    side: pos.turn,
    move: formatMove(move, pos),
    moveVi: formatMove(move, pos, 'traditional', 'vi'),
    iccs: moveKey(move),
    score: round2(chosen.score),
    runnerUp: other ? { move: formatMove(other.move, pos), iccs: moveKey(other.move), score: round2(other.score) } : null,
    materialBest: { move: formatMove(material[0].move, pos), iccs: moveKey(material[0].move), score: round2(material[0].score), chosenMaterialScore: round2(chosenMat.score) },
    pv: pvText.join(' '),
    delta,
  };
}

function legalScores(pos: Position, evaluate: ReturnType<typeof featureEvaluator> | undefined): { move: Move; score: number }[] {
  // Same search as the score-moves request (d = 2 + quiescence), on this thread.
  const out: { move: Move; score: number }[] = [];
  for (const move of legalMovesOf(pos)) {
    const r = searchMove(pos, move, { depth: 2, maxNodes: DEFAULT_MAX_NODES, ...(evaluate ? { evaluate } : {}) });
    out.push({ move, score: r.score });
  }
  return out;
}


const round2 = (x: number) => Math.round(x * 100) / 100;

function pickSample(games: readonly Game[], n: number): SampleRow[] {
  // Candidate pressing moves (no safety-net moves), at most 4 per game taken from the middle of evenly spaced slices of
  // the game (so openings, middlegames and late moves all appear), duplicates of the same position + move dropped
  // (P×P and P×S often share their first moves), then spread evenly over the games to n.
  const seen = new Set<string>();
  const chosen: { game: Game; ply: number }[] = [];
  for (const game of games) {
    const plies = game.plyInfo.flatMap((p, ply) => (p.policy.startsWith('pressing') && !p.safetyNet ? [ply] : []));
    const k = Math.min(4, plies.length);
    for (let i = 0; i < k; i++) {
      const ply = plies[Math.floor(((i + 0.5) * plies.length) / k)];
      let pos = positionOf({ fen: game.startFen });
      for (let j = 0; j < ply; j++) pos = makeMove(pos, parseMoveKey(game.plyInfo[j].iccs)!);
      const key = `${toFen(pos).split(' ').slice(0, 2).join(' ')}|${game.plyInfo[ply].iccs}`;
      if (seen.has(key)) continue;
      seen.add(key);
      chosen.push({ game, ply });
    }
  }
  const rows: SampleRow[] = [];
  for (const { game, ply } of spread(chosen, n)) {
    let pos = positionOf({ fen: game.startFen });
    for (let i = 0; i < ply; i++) pos = makeMove(pos, parseMoveKey(game.plyInfo[i].iccs)!);
    rows.push(explain(game, ply, pos, parseMoveKey(game.plyInfo[ply].iccs)!));
  }
  return rows;
}

function sampleMarkdown(rows: SampleRow[]): string {
  const fmt = (x: number) => (x > 0 ? `+${x}` : `${x}`);
  const lines = [
    '# `pressing(2)` plausibility sample (S2.18)',
    '',
    `Generated by \`npx tsx scripts/self-play.ts\` (seeds ${seeds}, cap ${cap}, weights ${JSON.stringify(weights)}). For an`,
    'independent `content-reviewer`: judge each move as **plausible** (a move a club player could make for the reason',
    'given), **odd** (legal and safe but purposeless or anti-positional) or **blunder** (loses material or allows a',
    'tactic a d = 2 partner should see). Record the verdict in the last column.',
    '',
    'Columns: *Position* = FEN before the move (side to move = pressing); *Move* = traditional notation (en / vi) and',
    'ICCS; *Score* = the feature score of the move at d = 2 + quiescence (pressing\'s view); *Runner-up* = the',
    'second-best move by the same score; *Material best* = the best move by material search alone (safe-sparring\'s',
    'view) and the chosen move\'s material score; *Why* = the weighted feature terms at the end of the principal',
    'variation (shown) minus those of the current position: mat = material, mob = mobility, pal = palace pressure,',
    'hang = attacked undefended pieces, sol = crossed soldiers. The search picks the move with the highest total.',
    '',
    `${rows.length} moves.`,
    '',
    '| # | Task / from | Position (FEN) | Move | Score | Runner-up | Material best | PV | Why (Δ terms) | Verdict |',
    '| ---: | --- | --- | --- | ---: | --- | --- | --- | --- | --- |',
  ];
  rows.forEach((r, i) => {
    const why = `mat ${fmt(r.delta.material)}, mob ${fmt(r.delta.mobility)}, pal ${fmt(r.delta.palacePressure)}, hang ${fmt(r.delta.hanging)}, sol ${fmt(r.delta.crossedSoldiers)}`;
    const from = `${r.task} ${r.label === 'start' ? 'start' : `after ${r.label}`}; ${r.pairing} s${r.seed} ply ${r.ply + 1}`;
    const ru = r.runnerUp ? `${r.runnerUp.move} (${r.runnerUp.score})` : '—';
    const mb = `${r.materialBest.move} (${r.materialBest.score}); chosen ${r.materialBest.chosenMaterialScore}`;
    lines.push(`| ${i + 1} | ${from} | \`${r.fen}\` | **${r.move}** / ${r.moveVi} (${r.iccs}) | ${r.score} | ${ru} | ${mb} | ${r.pv} | ${why} | |`);
  });
  lines.push('');
  return lines.join('\n');
}

// ---------- summary ----------

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pctl = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

function resultOf(g: Game): string {
  const o = g.outcome;
  if (o.result === 'none') return o.reason;
  if (o.result === 'draw') return `draw (${o.reason})`;
  const winnerIsPressing = g.pairing === 'P×P' ? null : g.pressingSides.includes(o.winner!);
  return `${winnerIsPressing === null ? o.winner : winnerIsPressing ? 'pressing' : 'safe'} wins (${o.reason})`;
}

function summarize(games: Game[]) {
  const rows: string[] = [];
  const pairings: Pairing[] = ['P×S', 'S×P', 'P×P'];
  rows.push('| Pairing | Games | Pressing W / D / L | Reasons | Plies mean (min–max) | Max swing mean | Final material Δ (pressing view) mean | Pressing drops / moves | Safe drops / moves | Third occ. | Perpetual | Rep. draws | Safety nets |');
  rows.push('| --- | ---: | --- | --- | --- | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: |');
  for (const pairing of pairings) {
    const gs = games.filter((g) => g.pairing === pairing);
    if (!gs.length) continue;
    let w = 0;
    let d = 0;
    let l = 0;
    const reasons = new Map<string, number>();
    for (const g of gs) {
      reasons.set(g.outcome.reason, (reasons.get(g.outcome.reason) ?? 0) + 1);
      if (g.outcome.result !== 'win') d++;
      else if (pairing === 'P×P') d += 0;
      else if (g.pressingSides.includes(g.outcome.winner!)) w++;
      else l++;
    }
    const pxpWins = pairing === 'P×P' ? gs.filter((g) => g.outcome.result === 'win').length : 0;
    const swings = gs.map((g) => Math.max(...g.material.map((m) => Math.abs(m - g.material[0]))));
    const finals = gs.map((g) => {
      if (pairing === 'P×P') return Math.abs(g.material[g.material.length - 1] - g.material[0]);
      const s = g.pressingSides[0] === 'red' ? 1 : -1;
      return s * (g.material[g.material.length - 1] - g.material[0]);
    });
    const plies = gs.map((g) => g.plies);
    const sum = (f: (g: Game) => number) => gs.reduce((a, g) => a + f(g), 0);
    rows.push(
      `| ${pairing} | ${gs.length} | ${pairing === 'P×P' ? `${pxpWins} decisive / ${gs.length - pxpWins} other` : `${w} / ${d} / ${l}`} | ${[...reasons].map(([k, v]) => `${k} ${v}`).join(', ')} | ${mean(plies).toFixed(1)} (${Math.min(...plies)}–${Math.max(...plies)}) | ${mean(swings).toFixed(1)} | ${pairing === 'P×P' ? `|Δ| ${mean(finals).toFixed(1)}` : mean(finals).toFixed(1)} | ${sum((g) => g.drops.pressing)} / ${sum((g) => g.drops.pressingMoves)} | ${sum((g) => g.drops.safe)} / ${sum((g) => g.drops.safeMoves)} | ${sum((g) => g.thirdOccurrences)} | ${gs.filter((g) => g.outcome.reason === 'perpetual-check').length} | ${gs.filter((g) => g.outcome.reason === 'repetition-draw').length} | ${sum((g) => g.safetyNets)} |`,
    );
  }
  // Cost per move against the D9 budgets.
  const cost = (pred: (p: PlyInfo) => boolean) => games.flatMap((g) => g.plyInfo.filter(pred).map((p) => p.cost));
  const costRows: string[] = [];
  costRows.push(`| Policy | Moves | Nodes / move median · p95 · max | Largest request (nodes) | Requests over budget (${DEFAULT_REQUEST_BUDGET}) | ms / move median · p95 · max (Node, this machine) |`);
  costRows.push('| --- | ---: | --- | ---: | ---: | --- |');
  for (const [name, pred] of [
    ['pressing(2)', (p: PlyInfo) => p.policy.startsWith('pressing')],
    ['safe-sparring(2)', (p: PlyInfo) => p.policy.startsWith('safe-sparring')],
  ] as const) {
    const cs = cost(pred);
    if (!cs.length) continue;
    const nodes = cs.map((c) => c.nodes);
    const ms = cs.map((c) => c.ms);
    costRows.push(
      `| ${name} | ${cs.length} | ${pctl(nodes, 0.5)} · ${pctl(nodes, 0.95)} · ${Math.max(...nodes)} | ${Math.max(...cs.map((c) => c.maxRequestNodes))} | ${cs.filter((c) => c.maxRequestNodes >= DEFAULT_REQUEST_BUDGET).length} | ${pctl(ms, 0.5).toFixed(0)} · ${pctl(ms, 0.95).toFixed(0)} · ${Math.max(...ms).toFixed(0)} |`,
    );
  }
  return { rows, costRows };
}

// ---------- main ----------

function gameLine(game: Game): string {
  return `  ${game.task} ${game.label === 'start' ? 'start' : `[${game.label}]`} ${game.pairing} s${game.seed}: ${resultOf(game)}, ${game.plies} plies, material ${game.material[0]} → ${game.material[game.material.length - 1]}, drops P ${game.drops.pressing} S ${game.drops.safe}, 3rd ${game.thirdOccurrences}, nets ${game.safetyNets} (pressing ${game.safetyNetsPressing})`;
}

const outDir = join(root, 'ui-check-output', option('--out') ?? 'self-play');

/** Every game to play, in a fixed order (index → game, for the parts). */
function schedule(points: readonly StartPoint[]): { point: StartPoint; pairing: Pairing; seed: number }[] {
  return points.flatMap((point) => (['P×S', 'S×P', 'P×P'] as const).flatMap((pairing) => Array.from({ length: seeds }, (_, i) => ({ point, pairing, seed: i + 1 }))));
}

async function runPart(k: number, n: number): Promise<void> {
  const games: Game[] = [];
  const list = schedule(startPoints());
  for (let i = k; i < list.length; i += n) {
    const { point, pairing, seed } = list[i];
    const game = await playGame(point, pairing, seed);
    console.log(gameLine(game));
    games.push(game);
  }
  writeFileSync(join(outDir, `part-${k}.json`), JSON.stringify(games));
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  if (part) {
    const [k, n] = part.split('/').map(Number);
    await runPart(k, n);
    return;
  }
  const t0 = performance.now();
  const points = startPoints();
  const list = schedule(points);
  console.log(`self-play: ${points.length} start positions, ${list.length} games, ${seeds} seed(s), cap ${cap}, ${jobs} job(s), weights ${JSON.stringify(weights)}`);
  // Parts in child processes (same tsx loader), then merged in schedule order.
  const args = argv.filter((a, i) => a !== '--jobs' && argv[i - 1] !== '--jobs');
  const n = Math.min(jobs, list.length);
  await Promise.all(
    Array.from({ length: n }, (_, k) =>
      new Promise<void>((done, fail) => {
        const child = spawn(process.execPath, [...process.execArgv, import.meta.filename, ...args, '--part', `${k}/${n}`], { stdio: 'inherit' });
        child.on('exit', (code) => (code === 0 ? done() : fail(new Error(`part ${k} exited with ${code}`))));
      }),
    ),
  );
  const parts = Array.from({ length: n }, (_, k) => JSON.parse(readFileSync(join(outDir, `part-${k}.json`), 'utf8')) as Game[]);
  const games: Game[] = [];
  for (let i = 0; i < list.length; i++) games.push(parts[i % n][Math.floor(i / n)]);
  const { rows, costRows } = summarize(games);
  console.log('\n' + rows.join('\n'));
  console.log('\n' + costRows.join('\n'));
  console.log('\nPer task (pressing W / D / L in P×S + S×P; drops pressing / safe; P×P decisive):');
  for (const task of taskIds) {
    const gs = games.filter((g) => g.task === task && g.pairing !== 'P×P');
    const w = gs.filter((g) => g.outcome.result === 'win' && g.pressingSides.includes(g.outcome.winner!)).length;
    const l = gs.filter((g) => g.outcome.result === 'win' && !g.pressingSides.includes(g.outcome.winner!)).length;
    const dp = gs.reduce((a, g) => a + g.drops.pressing, 0);
    const ds = gs.reduce((a, g) => a + g.drops.safe, 0);
    const pp = games.filter((g) => g.task === task && g.pairing === 'P×P');
    console.log(`  ${task}: ${w} / ${gs.length - w - l} / ${l}; drops ${dp} / ${ds}; P×P decisive ${pp.filter((g) => g.outcome.result === 'win').length}/${pp.length}`);
  }
  writeFileSync(join(outDir, 'self-play.json'), JSON.stringify({ seeds, cap, weights, games }, null, 1));
  console.log(`\nGames: ${join(outDir, 'self-play.json')}`);
  if (writeSample) {
    const rows = pickSample(games, sampleSize);
    const path = join(root, 'docs/curriculum-upgrade/pressing-sample.md');
    writeFileSync(path, sampleMarkdown(rows));
    console.log(`Sample (${rows.length} moves): ${path}`);
  }
  console.log(`Total ${((performance.now() - t0) / 1000).toFixed(0)} s`);
}

void main();
