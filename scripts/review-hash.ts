// Prints the review-record binding (id, version, contentHash) of every item of one or more units, for writing
// src/content/reviews/<unitId>.json (07-sourcing.md §5.2). The hash is the one the release test recomputes
// (src/content/reviews/hash.ts): normalised item JSON (without `status`) + the en and vi texts of its i18n keys.
//
// Run: npx tsx scripts/review-hash.ts <unitId | path/to/unit.json> [...]
//   A unit id is looked up in src/content/lessons/*.json and src/content/drafts/**/*.json.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { contentHash } from '../src/content/reviews/hash';
import { unitItems } from '../src/content/release';
import type { Unit } from '../src/content/types';

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

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: npx tsx scripts/review-hash.ts <unitId | unit.json> [...]');
  process.exit(1);
}
const out = args.flatMap((arg) =>
  unitItems(loadUnit(arg)).map(({ item, ref }) => ({ id: item.id ?? ref, version: item.version ?? null, contentHash: contentHash(item) })),
);
console.log(JSON.stringify(out, null, 2));
