// Authoring-time §5.7 checks of practical tasks (design/03-assessment.md §5.7, §5.2, §5.3; S2.12). Per `play` task:
// 1. reference run: the authored line (then forcing-attack → pressing for the learner) passes for every seed;
// 2. naive learners: N1 (random legal moves) fails ≥ 90 % of the runs, N2 (the safe shuffler: random guard-passing
//    moves) fails ≥ 80 %; voided runs (line share window, safety net) are counted apart and reported as the void rate;
// 3. pressure: the reference run has ≥ 3 narrow positions (≤ 3 or ≤ 20 % of the legal moves pass the guard) — not
//    required for full games, where the N2 failure rate is the requirement;
// 5. real resistance (tasks flagged `resistance`): a partner move in the reference run creates a threat;
// 6. second plan: `reference[1]` also passes.
// It also prints the F1c resist-mode cost on every reference-run position (03 §5.2) and the void rate per task.
// Item 4 (objective content) is the validator's: R5 needs its holding predicate, R1 is never the only rubric, and an
// opening task keeps R6 under F5 (not R1 alone).
//
// Run: npx tsx scripts/verify-practical.ts [unitId | unit.json ...] [--fixtures] [--runs N] [--regime main|fallback] [--strict]
// Default: every unit in src/content/lessons + drafts, 10 seeds, the current regime. `--strict`: exit 1 when a task
// fails a check. Runs use `directAnalyzer()` (same requests as the Worker, on this thread).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { executeRequest } from '../src/analysis/requests';
import {
  PARTNER_REGIME,
  fallbackOf,
  guardOf,
  randomLearner,
  referenceLearner,
  safeShuffler,
  simulateTask,
  type PartnerRegime,
  type SimLearner,
  type SimRun,
} from '../src/assessment/practical';
import { allPlayFixtures, playUnits } from '../src/assessment/play-fixtures';
import { validateContent } from '../src/content/validate';
import type { Exercise, PlayExercise, Unit } from '../src/content/types';
import { legalMoves } from '../src/engine';
import { directAnalyzer, positionsOf } from '../src/play';

const root = resolve(import.meta.dirname, '..');

function jsonFiles(dir: string): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return jsonFiles(path);
    return name.endsWith('.json') ? [path] : [];
  });
}

const allUnits = (): Unit[] =>
  [...jsonFiles(join(root, 'src/content/lessons')), ...jsonFiles(join(root, 'src/content/drafts'))].map((f) => JSON.parse(readFileSync(f, 'utf8')) as Unit);

const argv = process.argv.slice(2);
const option = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const runs = Number(option('--runs') ?? 10);
const regime = (option('--regime') ?? PARTNER_REGIME) as PartnerRegime;
const strict = argv.includes('--strict');
const positional = argv.filter((a, i) => !a.startsWith('--') && !['--runs', '--regime'].includes(argv[i - 1] ?? ''));

function loadUnits(): Unit[] {
  if (argv.includes('--fixtures')) return playUnits(...allPlayFixtures());
  if (positional.length === 0) return allUnits();
  return positional.map((arg) => {
    if (arg.endsWith('.json')) return JSON.parse(readFileSync(resolve(arg), 'utf8')) as Unit;
    const unit = allUnits().find((u) => u.id === arg);
    if (!unit) throw new Error(`unit "${arg}" not found`);
    return unit;
  });
}

const items = (unit: Unit): Exercise[] => [...unit.lessons.flatMap((l) => l.exercises), ...(unit.pool ?? [])];
const deps = { analyzer: directAnalyzer() };
const pct = (n: number, d: number) => (d === 0 ? '—' : `${Math.round((100 * n) / d)} %`);

async function batch(ex: PlayExercise, learner: SimLearner): Promise<SimRun[]> {
  const out: SimRun[] = [];
  for (let seed = 1; seed <= runs; seed++) out.push(await simulateTask(ex, regime, seed, learner, deps, () => performance.now()));
  return out;
}

/** Narrow positions of a run (§5.7 item 3): learner positions where ≤ 3 or ≤ 20 % of the legal moves pass the guard. */
function narrowPositions(ex: PlayExercise, run: SimRun): number {
  const guard = guardOf(ex);
  const positions = positionsOf(run.state.record);
  let narrow = 0;
  for (let i = 0; i < run.state.record.moves.length; i++) {
    const pos = positions[i];
    if (pos.turn !== run.state.record.learner) continue;
    const moves = legalMoves(pos);
    let passing = 0;
    for (const move of moves) {
      const v = executeRequest({ kind: 'safety-guard', position: pos, move, guard });
      if (v.status === 'checked' && v.value.safe) passing++;
    }
    if (passing <= 3 || passing <= 0.2 * moves.length) narrow++;
  }
  return narrow;
}

/** §5.7 item 5: some partner move leaves the partner threatening (mate within k or a gain ≥ T, moving again). */
function partnerThreatened(ex: PlayExercise, run: SimRun): boolean {
  const guard = guardOf(ex);
  const positions = positionsOf(run.state.record);
  return run.state.record.moves.some((m, i) => {
    if (!m.partner) return false;
    const pos = positions[i + 1];
    const side = positions[i].turn;
    const t = executeRequest({ kind: 'threat', position: pos, side, guard: { h: guard.h, k: guard.k, T: guard.T } });
    return t.status === 'checked' && t.value.isThreat;
  });
}

async function main() {
  const units = loadUnits();
  const report = validateContent(units);
  if (report.errors.length) {
    console.error('Validator errors (fix these first):\n' + report.errors.map((e) => `  ${e}`).join('\n'));
    process.exit(1);
  }
  let failures = 0;
  for (const unit of units) {
    for (const ex of items(unit)) {
      if (ex.type !== 'play') continue;
      const fb = fallbackOf(ex, regime);
      console.log(`\n${ex.id} — ${ex.task}, regime ${regime}${fb ? ` (${fb})` : ''}, ${runs} seeds`);
      const t0 = performance.now();
      const ref = await batch(ex, referenceLearner(ex.reference?.[0]));
      const second = ex.reference?.[1] ? await batch(ex, referenceLearner(ex.reference[1])) : null;
      const n1 = await batch(ex, randomLearner);
      const n2 = await batch(ex, safeShuffler);
      const passes = (rs: SimRun[]) => rs.filter((r) => r.result.score.pass).length;
      const voided = (rs: SimRun[]) => rs.filter((r) => r.result.score.voided).length;
      const windowVoids = (rs: SimRun[]) => rs.filter((r) => r.result.score.voids.includes('line-share-window')).length;
      const failRate = (rs: SimRun[]) => {
        const counted = rs.filter((r) => !r.result.score.voided);
        return { failed: counted.filter((r) => !r.result.score.pass).length, of: counted.length };
      };
      const checks: [string, boolean, string][] = [];
      checks.push(['1 reference run passes every seed', passes(ref) === runs, `${passes(ref)}/${runs} (scores ${ref.map((r) => r.result.score.score).join(', ')})`]);
      const f1 = failRate(n1);
      checks.push(['2 N1 fails ≥ 90 %', f1.of > 0 && f1.failed >= 0.9 * f1.of, `${f1.failed}/${f1.of} = ${pct(f1.failed, f1.of)} · voided ${voided(n1)}`]);
      const f2 = failRate(n2);
      checks.push(['2 N2 fails ≥ 80 %', f2.of > 0 && f2.failed >= 0.8 * f2.of, `${f2.failed}/${f2.of} = ${pct(f2.failed, f2.of)} · voided ${voided(n2)}`]);
      if (ex.task !== 'game') {
        const narrow = narrowPositions(ex, ref[0]);
        checks.push(['3 ≥ 3 narrow positions in the reference run', narrow >= 3, `${narrow}`]);
      }
      if (ex.resistance) checks.push(['5 real resistance (a partner threat)', partnerThreatened(ex, ref[0]), '']);
      if (second) checks.push(['6 second plan passes every seed', passes(second) === runs, `${passes(second)}/${runs}`]);
      for (const [name, ok, detail] of checks) {
        console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `: ${detail}` : ''}`);
        if (!ok) failures++;
      }
      const all = [...ref, ...(second ?? []), ...n1, ...n2];
      console.log(`  void rate (runs with < L counted moves): ${windowVoids(all)}/${all.length} = ${pct(windowVoids(all), all.length)} · any void ${voided(all)}`);
      const resist = ref.flatMap((r) => r.partnerMs.filter((p) => p.policy.startsWith('best-defence-resist')));
      if (resist.length) {
        const ms = resist.map((p) => p.ms);
        console.log(`  resist-mode cost on reference-run positions: ${resist.length} moves, mean ${(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(0)} ms, max ${Math.max(...ms).toFixed(0)} ms`);
        for (const p of resist.filter((_, i) => i < 20)) console.log(`    ply ${p.ply}: ${p.ms.toFixed(0)} ms (${p.policy})`);
      }
      console.log(`  (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
    }
  }
  console.log(`\n${failures === 0 ? 'All §5.7 checks passed.' : `${failures} check(s) failed: such tasks stay practice only (03 §5.7).`}`);
  if (strict && failures > 0) process.exit(1);
}

void main();
