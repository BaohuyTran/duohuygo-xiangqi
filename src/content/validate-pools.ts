// Validator of the assessment pools (src/content/assessment/*.json; 03-assessment.md §4.2–§4.3, §6, §7). Used by tests
// (src/content/pools.test.ts) and scripts only, never by app code (it pulls in the exercise validator and analysis).
//
// Checks, per pool file:
// - shape: `id` = file name, `kind`, `unit` (check) or `level` (the others), `version` ≥ 1, a non-empty `items` list;
// - pool and item ids by kind (02-curriculum.md §3.3): check `<unit>-check` / `<unit>-cNN`; placement `p<x>` /
//   `p<x>-NN` (no Master pool: no J2 within Master, J1 into Master uses `pe`); placement practical `p<x>-g` /
//   `p<x>-gN` (play / review, `equivalentOf` a unit task `<unit>-gN`); exam `x<x>` / `x<x>-gN` (play) or `x<x>-rN`
//   (review) with a known `slot`;
// - every item: the exercise rules and ALL new-course metadata (validateItem: id, version, status, source, side,
//   strand, nature, critical, misconceptions) plus `unit` (of the pool's level; check items: the pool's unit) and
//   `objective` (a lesson id of that unit, which must exist when the unit is loaded) — 03 §4.2 rule 9;
// - ids unique across pools and units, never retired;
// - uniqueness corpus (03 §4.2 rule 4): no assessment position equals (up to file mirror and colour swap) a position
//   of any lesson item, learn card, unit pool item or other assessment item. Full games from the initial position
//   (`play` with task `game`) are exempt: they start there by design.
// Review status: `status` is validated here; that served items are `published` (or `reviewed` in the preview) with an
// approving review record is the release test (src/content/release.test.ts).

import { positionOf } from '../lessons/answers';
import { ALL_EXAM_SLOTS } from '../assessment/exams';
import { normalKey } from './normalize';
import { POOL_KINDS, type Exercise, type Unit } from './types';
import { RETIRED_IDS, validateItem, type ValidateOptions } from './validate';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const LEVEL_PREFIX: Record<string, string> = { basics: 'b', intermediate: 'i', advanced: 'a', expert: 'e', master: 'm' };

/** Expected pool id pattern and item id pattern of a pool. */
function idRules(pool: Obj): { pool: RegExp; item: RegExp; prefix: string } | string {
  if (pool.kind === 'check') {
    if (typeof pool.unit !== 'string' || !/^[biaem]\d\d$/.test(pool.unit)) return '"unit" must be a new-course unit id (check pool)';
    return { pool: new RegExp(`^${pool.unit}-check$`), item: new RegExp(`^${pool.unit}-c\\d\\d$`), prefix: pool.unit[0] };
  }
  const prefix = typeof pool.level === 'string' ? LEVEL_PREFIX[pool.level] : undefined;
  if (!prefix) return '"level" must be basics, intermediate, advanced, expert or master';
  if (pool.kind === 'placement' || pool.kind === 'placement-practical') {
    if (prefix === 'm') return 'there is no Master placement pool (no J2 within Master; J1 into Master uses the Expert pools)';
    return pool.kind === 'placement'
      ? { pool: new RegExp(`^p${prefix}$`), item: new RegExp(`^p${prefix}-\\d\\d$`), prefix }
      : { pool: new RegExp(`^p${prefix}-g$`), item: new RegExp(`^p${prefix}-g\\d+$`), prefix };
  }
  return { pool: new RegExp(`^x${prefix}$`), item: new RegExp(`^x${prefix}-[gr]\\d+$`), prefix };
}

/** The position of an item for the uniqueness corpus, or null (no position, or a full game from the start). */
function corpusKey(ex: unknown): string | null {
  if (!isObj(ex)) return null;
  if (ex.type === 'play' && ex.task === 'game') return null;
  try {
    return normalKey(positionOf(ex as unknown as Exercise));
  } catch {
    return null;
  }
}

export interface PoolValidationOptions extends ValidateOptions {
  /** Skip the per-item exercise validation (fast shape tests). */
  shapeOnly?: boolean;
}

/** Problems with the pools against the loaded units; empty means valid. `files`: file name → pool. */
export function validatePools(files: Readonly<Record<string, unknown>>, units: readonly Unit[], options: PoolValidationOptions = {}): string[] {
  const problems: string[] = [];
  const retired = new Set(options.retiredIds ?? RETIRED_IDS);
  const ids = new Map<string, string>();
  const corpus = new Map<string, string>();
  const lessonsOf = new Map(units.map((u) => [u.id, new Set(u.lessons.map((l) => l.id))]));
  for (const unit of units) {
    for (const lesson of unit.lessons) {
      lesson.exercises.forEach((ex, i) => {
        const ref = ex.id ?? `${lesson.id}#${i}`;
        ids.set(ref, ref);
        const key = corpusKey(ex);
        if (key && !corpus.has(key)) corpus.set(key, ref);
      });
    }
    (unit.pool ?? []).forEach((ex, i) => {
      const ref = ex.id ?? `${unit.id}/pool#${i}`;
      ids.set(ref, ref);
      const key = corpusKey(ex);
      if (key && !corpus.has(key)) corpus.set(key, ref);
    });
    ids.set(unit.id, unit.id);
    for (const l of unit.lessons) ids.set(l.id, l.id);
  }

  for (const name of Object.keys(files).sort()) {
    const raw = files[name];
    const where = `assessment/${name}.json`;
    const p = (msg: string) => problems.push(`${where}: ${msg}`);
    if (!isObj(raw)) {
      p('must be an object { id, kind, version, items }');
      continue;
    }
    const pool = raw as Obj;
    if (pool.id !== name) p(`"id" must be "${name}" (the file name)`);
    if (!POOL_KINDS.includes(pool.kind as never)) {
      p(`"kind" must be one of ${POOL_KINDS.join(', ')}`);
      continue;
    }
    if (!(Number.isInteger(pool.version) && (pool.version as number) >= 1)) p('"version" must be an integer ≥ 1');
    if (pool.primaryStrand !== undefined && !['RS', 'TC', 'OD', 'PA', 'DE', 'PP'].includes(pool.primaryStrand as string)) p('"primaryStrand" must be a strand');
    const rules = idRules(pool);
    if (typeof rules === 'string') {
      p(rules);
      continue;
    }
    if (typeof pool.id === 'string' && !rules.pool.test(pool.id)) p(`pool id "${pool.id}" must match ${rules.pool.source}`);
    if (!Array.isArray(pool.items) || pool.items.length === 0) {
      p('"items" must be a non-empty array');
      continue;
    }
    pool.items.forEach((ex: unknown, i) => {
      const w = (msg: string) => p(`items[${i}]: ${msg}`);
      if (!isObj(ex)) return w('must be an object');
      const id = ex.id;
      if (typeof id !== 'string' || !rules.item.test(id)) w(`id ${JSON.stringify(id)} must match ${rules.item.source}`);
      else {
        if (ids.has(id)) w(`duplicate id "${id}"`);
        if (retired.has(id)) w(`id "${id}" is retired (src/content/retired-ids.json) and must not be reused`);
        ids.set(id, id);
      }
      // 03 §4.2 rule 9: unit and lesson objective (the other metadata comes from validateItem).
      const unit = ex.unit;
      if (typeof unit !== 'string' || !/^[biaem]\d\d$/.test(unit)) w('"unit" must be the new-course unit the item is tagged with');
      else {
        if (pool.kind === 'check' && unit !== pool.unit) w(`"unit" must be "${String(pool.unit)}" (interleaved items live in their own unit's check pool)`);
        if (pool.kind !== 'check' && unit[0] !== rules.prefix) w(`"unit" ${unit} is not a unit of this pool's level`);
        if (typeof ex.objective !== 'string' || !new RegExp(`^${unit}l\\d$`).test(ex.objective)) w(`"objective" must be a lesson id of ${unit} ("${unit}l" + a digit)`);
        else if (lessonsOf.has(unit) && !lessonsOf.get(unit)!.has(ex.objective)) w(`"objective" ${ex.objective} is not a lesson of the loaded unit ${unit}`);
      }
      if (ex.fullBoard !== undefined && (typeof ex.fullBoard !== 'boolean' || ex.strand !== 'RS' || pool.kind !== 'placement' || unit !== 'b08')) {
        w('"fullBoard" is only for RS items of a placement pool, tagged b08');
      }
      if (pool.kind === 'placement' && ex.strand === 'RS' && rules.prefix !== 'b') w('RS placement items live in the Basic pool (pb)');
      if (pool.kind === 'placement-practical' || pool.kind === 'exam') {
        if (ex.type !== 'play' && ex.type !== 'review') w('a practical or exam pool holds "play" / "review" tasks only');
      } else if (ex.type === 'play' || ex.type === 'review') w('"play" / "review" tasks belong in a placement practical or exam pool');
      if (pool.kind === 'placement-practical' && (typeof ex.equivalentOf !== 'string' || !/^[biaem]\d\d-g\d+$/.test(ex.equivalentOf))) {
        w('"equivalentOf" must name the unit task it stands for (`b10-g1`)');
      }
      if (pool.kind !== 'placement-practical' && ex.equivalentOf !== undefined) w('"equivalentOf" is only for placement practical tasks');
      if (pool.kind === 'exam' && (typeof ex.slot !== 'string' || !ALL_EXAM_SLOTS.has(ex.slot))) w(`"slot" must be one of ${[...ALL_EXAM_SLOTS].join(', ')}`);
      if (pool.kind === 'exam' && typeof id === 'string' && ((ex.type === 'review') !== /-r\d+$/.test(id))) w('exam reviews are `x<x>-rN`, exam play tasks `x<x>-gN`');
      if (!options.shapeOnly) for (const problem of validateItem(ex, options)) w(problem);
      else if (ex.status === undefined) w('"status" is required');
      // 03 §4.2 rule 4: unseen positions.
      const key = corpusKey(ex);
      if (key) {
        const ref = `${name}/${typeof id === 'string' ? id : `items[${i}]`}`;
        if (corpus.has(key)) w(`position already used by ${corpus.get(key)} (up to file mirror and colour swap; 03 §4.2 rule 4)`);
        else corpus.set(key, ref);
      }
    });
  }
  return problems;
}
