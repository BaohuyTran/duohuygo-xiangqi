// Proposes the complete move table of a `decision` item (04-architecture.md §5.3, 02-curriculum.md §5.3).
// Every legal move gets a row with the class the analysis rule gives (src/lessons/decision.ts
// `computeMoveClass`: fails the level's safety guard -> error; meets the objective -> target; else dubious).
// Rows already `authored` in the item are kept as they are. The author then decides every row marked REVIEW
// (accepted moves, captures, checks) and every move worth a comment, sets `source: "authored"` + a `reason`
// key, and pastes the table into the item. The validator recomputes every `computed` row (drift check).
//
// Run:
//   npx tsx scripts/move-table.ts <unitId | path/to/unit.json> <itemId>
//   npx tsx scripts/move-table.ts --fen "<fen>" [--unit b09] [--objective '<predicate JSON>'] [--guard '{"h":2}']
// A unit id is looked up in src/content/lessons/*.json and src/content/drafts/**/*.json.
// Output: the table JSON on stdout (one row per line), a review summary on stderr.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { predicateErrors, type Predicate } from '../src/analysis';
import type { DecisionExercise, GuardOverride, MoveTableEntry, Unit } from '../src/content/types';
import { parseFen, type Position } from '../src/engine';
import { positionOf } from '../src/lessons/answers';
import { guardFor } from '../src/lessons/guard';
import { proposeMoveTable, type ProposedRow } from '../src/lessons/decision-table';

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

function loadUnit(arg: string): Unit {
  if (arg.endsWith('.json')) return JSON.parse(readFileSync(resolve(arg), 'utf8')) as Unit;
  for (const file of [...jsonFiles(join(root, 'src/content/lessons')), ...jsonFiles(join(root, 'src/content/drafts'))]) {
    const unit = JSON.parse(readFileSync(file, 'utf8')) as Unit;
    if (unit && unit.id === arg) return unit;
  }
  throw new Error(`unit "${arg}" not found in src/content/lessons or src/content/drafts`);
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

interface Job {
  pos: Position;
  itemId?: string;
  objective?: Predicate;
  guard?: GuardOverride;
  existing: MoveTableEntry[];
}

function jobFromArgs(args: string[]): Job {
  const fen = flag(args, '--fen');
  if (fen !== undefined) {
    const objective = flag(args, '--objective');
    const guard = flag(args, '--guard');
    return {
      pos: parseFen(fen),
      itemId: flag(args, '--unit'),
      objective: objective ? (JSON.parse(objective) as Predicate) : undefined,
      guard: guard ? (JSON.parse(guard) as GuardOverride) : undefined,
      existing: [],
    };
  }
  const [unitArg, itemId] = args;
  if (!unitArg || !itemId) throw new Error('usage');
  const unit = loadUnit(unitArg);
  const items = [...unit.lessons.flatMap((l) => l.exercises), ...(unit.pool ?? [])];
  const item = items.find((ex) => ex.id === itemId);
  if (!item) throw new Error(`item "${itemId}" not found in unit ${unit.id}`);
  if (item.type !== 'decision') throw new Error(`item "${itemId}" is a "${item.type}", not a "decision"`);
  const ex = item as DecisionExercise;
  return { pos: positionOf(ex), itemId, objective: ex.objective, guard: ex.guard, existing: Array.isArray(ex.table) ? ex.table : [] };
}

function main() {
  const args = process.argv.slice(2);
  let job: Job;
  try {
    job = jobFromArgs(args);
  } catch (e) {
    if ((e as Error).message !== 'usage') console.error((e as Error).message);
    console.error('Usage: npx tsx scripts/move-table.ts <unitId | unit.json> <itemId>');
    console.error('       npx tsx scripts/move-table.ts --fen "<fen>" [--unit b09] [--objective \'<json>\'] [--guard \'{"h":2}\']');
    process.exit(1);
  }
  if (job.objective !== undefined) {
    const errors = predicateErrors(job.objective, job.pos, 'objective');
    if (errors.length) {
      console.error(errors.join('\n'));
      process.exit(1);
    }
  }
  const guard = guardFor(job.itemId, job.guard);
  const proposed: ProposedRow[] = proposeMoveTable(job.pos, guard, job.objective);
  const byMove = new Map(job.existing.map((r) => [r.move, r]));

  const summary: string[] = [`guard h=${guard.h} k=${guard.k} T=${guard.T}; objective ${job.objective ? JSON.stringify(job.objective) : '(none: no computed target)'}`];
  const table: MoveTableEntry[] = proposed.map((row) => {
    const { notes, ...entry } = row;
    const old = byMove.get(row.move);
    const facts = [
      notes.capture && 'capture',
      notes.check && 'check',
      notes.allowsMate && 'allows mate',
      notes.loss !== null && `loses ${notes.loss}`,
      notes.enPrise.length > 0 && `en prise ${notes.enPrise.join(' ')}`,
      notes.objective === true && 'objective met',
      notes.missedGain && 'misses a gain',
      notes.missedMate && 'misses a mate',
      notes.notChecked && 'NOT CHECKED (node limit)',
    ].filter(Boolean);
    if (old?.source === 'authored') {
      const conflict = old.class !== 'error' && row.class === 'error' ? '  CONFLICT: authored as accepted/dubious but fails the guard' : '';
      summary.push(`${row.move.padEnd(6)} authored ${old.class.padEnd(8)} (rule: ${row.class}) ${facts.join(', ')}${conflict}`);
      return old;
    }
    summary.push(`${row.move.padEnd(6)} computed ${row.class.padEnd(8)} ${facts.join(', ')}${notes.review ? '  REVIEW: author it (source "authored" + reason; the validator requires it for accepted moves, captures and checks)' : ''}`);
    return old?.misconception ? { ...entry, misconception: old.misconception } : entry;
  });
  for (const old of job.existing) if (!proposed.some((r) => r.move === old.move)) summary.push(`${old.move}: not a legal move any more, dropped`);
  const accepted = table.filter((r) => r.class === 'target' || r.class === 'sound').length;
  summary.push(`${table.length} legal moves, ${accepted} accepted (the validator needs ≥ 2 unless "alternatives": false)`);

  console.error(summary.join('\n'));
  console.log(`[\n${table.map((r) => `  ${JSON.stringify(r)}`).join(',\n')}\n]`);
}

main();
