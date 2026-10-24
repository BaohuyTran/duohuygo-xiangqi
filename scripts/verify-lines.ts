// Authoring-time verification of `line` trees and varied-defence combinations (S2.8; 04-architecture.md §5.2,
// 07-sourcing.md §4.1). Runs the content validator on the units (legal nodes, complete tables, every branch reaches a
// leaf, forced claims proven for every defence, guard on authored replies, no repeated position) and prints, per item:
// - the tree facts S2.12 needs: learner nodes, selective nodes (0 < credited ÷ guard-passing ≤ 1/3, 03 §5.3) and the
//   stored depth (most learner nodes on one path);
// - a deeper check of every authored reply (horizon h + 1, at most 3, as authoring may go deeper than runtime, 03 §5.3):
//   reported as a WARNING for the content reviewer, not an error;
// - for `variedDefence` combinations: the best replies at each opponent step of the stored line (the branches met).
//
// Run: npx tsx scripts/verify-lines.ts [unitId | path/to/unit.json ...]   (default: every unit in lessons + drafts)
//      npx tsx scripts/verify-lines.ts --fixtures                          (the test fixtures of src/lessons/line-fixtures.ts)
// Exit code 1 when the validator reports an error in a checked unit.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { safetyGuard } from '../src/analysis';
import { validateContent } from '../src/content/validate';
import type { CombinationExercise, Exercise, LineExercise, LineLearnerNode, Unit } from '../src/content/types';
import { makeMove, type Position } from '../src/engine';
import { positionOf } from '../src/lessons/answers';
import { bestCombinationReplies } from '../src/lessons/combination';
import { moveKey, parseMoveKey } from '../src/lessons/decision';
import { TABLE_MAX_NODES } from '../src/lessons/decision-table';
import { resolveGuard } from '../src/lessons/guard';
import { isLearnerNode, isOpponentNode, learnerNodeStats, lineDepth, lineGuard } from '../src/lessons/line';
import { forcedLineFixture, lineUnit, quietLineFixture, variedComboFixture } from '../src/lessons/line-fixtures';

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

function loadUnits(args: string[]): Unit[] {
  if (args.includes('--fixtures')) return [...lineUnit('e01', forcedLineFixture(), variedComboFixture()), ...lineUnit('b09', quietLineFixture())];
  if (args.length === 0) return allUnits();
  return args.map((arg) => {
    if (arg.endsWith('.json')) return JSON.parse(readFileSync(resolve(arg), 'utf8')) as Unit;
    const unit = allUnits().find((u) => u.id === arg);
    if (!unit) throw new Error(`unit "${arg}" not found in src/content/lessons or src/content/drafts`);
    return unit;
  });
}

const items = (unit: Unit): Exercise[] => [...unit.lessons.flatMap((l) => l.exercises), ...(unit.pool ?? [])];

/** Every authored reply re-checked with a deeper loss horizon (h + 1 ≤ 3). */
function deepReplyWarnings(ex: LineExercise): string[] {
  const base = resolveGuard(lineGuard(ex));
  const deep = { ...base, h: Math.min(3, base.h + 1) };
  if (deep.h === base.h) return [];
  const warnings: string[] = [];
  const walk = (node: LineLearnerNode, pos: Position, path: string[]) => {
    for (const [key, next] of Object.entries(node.next ?? {})) {
      if (!isOpponentNode(next)) continue;
      const afterLearner = makeMove(pos, parseMoveKey(key)!);
      for (const reply of next.replies) {
        const m = parseMoveKey(reply.move)!;
        const v = safetyGuard(afterLearner, m, deep, { maxNodes: TABLE_MAX_NODES });
        const where = [...path, key, reply.move].join(' ');
        if (v.status !== 'checked') warnings.push(`${where}: not checked at h = ${deep.h}`);
        else if (!v.safe) warnings.push(`${where}: the reply fails the guard at h = ${deep.h} (${v.allowedMate || v.allowedLoss?.mate ? 'allows a mate' : `loses ${v.allowedLoss?.loss}`})`);
        if (isLearnerNode(reply.next)) walk(reply.next, makeMove(afterLearner, m), [...path, key, reply.move]);
      }
    }
  };
  walk(ex.root, positionOf(ex), []);
  return warnings;
}

function variedBranches(ex: CombinationExercise): string[] {
  const lines: string[] = [];
  let pos = positionOf(ex);
  ex.solution.forEach((s, step) => {
    const m = parseMoveKey(`${s.from}-${s.to}`)!;
    if (step % 2 === 1) lines.push(`step ${step}: best replies ${bestCombinationReplies(ex, pos, step).map(moveKey).join(', ')}`);
    pos = makeMove(pos, m);
  });
  return lines;
}

const units = loadUnits(process.argv.slice(2));
let failed = false;
let found = 0;
for (const unit of units) {
  const errors = validateContent([unit]).errors;
  for (const ex of items(unit)) {
    const id = ex.id ?? '(no id)';
    if (ex.type === 'line') {
      found++;
      const stats = learnerNodeStats(ex);
      console.log(`${unit.id} ${id} line: ${stats.length} learner nodes, ${stats.filter((s) => s.selective).length} selective, depth ${lineDepth(ex)}`);
      for (const s of stats) {
        console.log(`  node [${s.path.join(' ') || 'root'}]: ${s.credited}/${s.guardPassing} credited of the guard-passing moves (${s.moves} legal)${s.selective ? '' : ' — not selective (played, not counted)'}`);
      }
      for (const w of deepReplyWarnings(ex)) console.log(`  WARNING ${w}`);
    } else if (ex.type === 'combination' && ex.variedDefence) {
      found++;
      console.log(`${unit.id} ${id} varied defence:`);
      for (const l of variedBranches(ex)) console.log(`  ${l}`);
    }
  }
  // Only units with line / varied items are judged here (the content tests cover the rest).
  if (errors.length && items(unit).some((ex) => ex.type === 'line' || (ex.type === 'combination' && ex.variedDefence))) {
    failed = true;
    for (const e of errors) console.log(`  ERROR ${e}`);
  }
}
if (found === 0) console.log('No line items or varied-defence combinations in the checked units.');
process.exit(failed ? 1 : 0);
