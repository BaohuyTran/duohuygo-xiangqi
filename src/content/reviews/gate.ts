// Review records (07-sourcing.md §5.2) and the release test (07-sourcing.md §6). Used by tests only: the records are
// never imported by app code, so they are not bundled (src/content/release.test.ts enforces it).
//
// - A record file is `src/content/reviews/<unitId>.json` (`puzzles.json` for puzzles): `{ "unit": "<unitId>",
//   "records": [ReviewRecord, …] }`. A record applies to one `id` + `version` + `contentHash` (./hash.ts).
// - Independence: no review may be by the record's `author`. No personal data: `author` / `by` must not contain "@".
// - A record APPROVES its item when it has a `content-reviewer` review with verdict `approve` covering chess, en and vi.
// - Release test: every served new-course item must be `published` (or `reviewed`, in the course preview) and have an
//   approving record whose hash matches; every loaded item that CLAIMS `reviewed`/`published` needs one too. Legacy
//   lessons are exempt only while live in the release state (`liveLegacyLessons`, src/content/release.ts).

import { coursePath, isNewCourseUnitId, liveLegacyLessons, unitItems, type ReleaseState } from '../release';
import type { Exercise, Unit } from '../types';
import { contentHash, messageTexts, type TextLookup } from './hash';

export const REVIEW_SCOPES = ['chess', 'en', 'vi', 'assessment'] as const;
export const REQUIRED_SCOPES = ['chess', 'en', 'vi'] as const;

export interface ReviewCheck {
  name: string;
  tool: string;
  result: string;
  /** YYYY-MM-DD. */
  at: string;
}

export interface Review {
  role: string;
  by: string;
  at: string;
  verdict: 'approve' | 'changes-requested' | 'reject';
  scope: string[];
  notes?: string;
}

export interface ReviewRecord {
  id: string;
  version: number;
  contentHash: string;
  author: string;
  checks: ReviewCheck[];
  reviews: Review[];
}

export interface ReviewFile {
  unit: string;
  records: ReviewRecord[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isDate = (v: unknown): boolean => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v));
const isPerson = (v: unknown): boolean => isText(v) && !v.includes('@');

/**
 * Ids that belong to unit `unit` (02-curriculum.md §3.3): its lessons' items `b09l3-04`, pool items `b09-p03`, and
 * the unit-check items / practical tasks `b09-c07` / `b09-g1` of later items. `b090…` or `b09x` do not match.
 */
const unitItemId = (unit: string): RegExp => new RegExp(`^${unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(l\\d|-p|-c|-g)`);

/** Problems with one record file (`name` = file name without `.json`). Empty means well-formed. */
export function reviewFileProblems(name: string, file: unknown): string[] {
  const problems: string[] = [];
  const p = (msg: string) => problems.push(`reviews/${name}.json: ${msg}`);
  if (!isObj(file)) return [`reviews/${name}.json: must be an object { unit, records }`];
  if (file.unit !== name) p(`"unit" must be "${name}" (the file name)`);
  if (!Array.isArray(file.records)) return [...problems, `reviews/${name}.json: "records" must be an array`];
  const seen = new Set<string>();
  file.records.forEach((r: unknown, i) => {
    const w = `record[${i}]`;
    if (!isObj(r)) return p(`${w} must be an object`);
    if (!isText(r.id)) p(`${w}: "id" is required`);
    else if (name !== 'puzzles' && !unitItemId(name).test(r.id)) p(`${w}: id "${r.id}" does not belong to unit ${name}`);
    if (!(Number.isInteger(r.version) && (r.version as number) >= 1)) p(`${w}: "version" must be an integer ≥ 1`);
    if (typeof r.contentHash !== 'string' || !/^[0-9a-f]{64}$/.test(r.contentHash)) p(`${w}: "contentHash" must be 64 lower-case hex digits`);
    const key = `${String(r.id)}@${String(r.version)}`;
    if (seen.has(key)) p(`${w}: duplicate record for ${key}`);
    seen.add(key);
    if (!isPerson(r.author)) p(`${w}: "author" must be a role, session id or initials (no e-mail address)`);
    if (!Array.isArray(r.checks)) p(`${w}: "checks" must be an array`);
    else
      r.checks.forEach((c: unknown, j) => {
        if (!isObj(c) || !isText(c.name) || !isText(c.tool) || !isText(c.result) || !isDate(c.at)) p(`${w}.checks[${j}]: needs name, tool, result and a date "at"`);
      });
    if (!Array.isArray(r.reviews) || r.reviews.length === 0) return p(`${w}: "reviews" must be a non-empty array`);
    r.reviews.forEach((rv: unknown, j) => {
      const rw = `${w}.reviews[${j}]`;
      if (!isObj(rv)) return p(`${rw} must be an object`);
      if (!isText(rv.role)) p(`${rw}: "role" is required`);
      if (!isPerson(rv.by)) p(`${rw}: "by" must be a role, session id or initials (no e-mail address)`);
      else if (rv.by === r.author) p(`${rw}: reviewer "${rv.by}" is the author (an author's own review is not independent)`);
      if (!isDate(rv.at)) p(`${rw}: "at" must be a date`);
      if (!['approve', 'changes-requested', 'reject'].includes(rv.verdict as string)) p(`${rw}: "verdict" must be approve, changes-requested or reject`);
      if (!Array.isArray(rv.scope) || rv.scope.length === 0 || !rv.scope.every((s) => REVIEW_SCOPES.includes(s as never))) {
        p(`${rw}: "scope" must list some of ${REVIEW_SCOPES.join(', ')}`);
      }
    });
  });
  return problems;
}

/**
 * True when the record's LATEST content-reviewer review (by date `at`; same date: later in the list) is an approval
 * by someone other than the author covering chess, en and vi. A later `reject` or `changes-requested` revokes an
 * earlier approval.
 */
export function isApproved(record: ReviewRecord): boolean {
  const reviews = (Array.isArray(record.reviews) ? record.reviews : [])
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => isObj(r) && r.role === 'content-reviewer')
    .sort((x, y) => String(x.r.at).localeCompare(String(y.r.at)) || x.i - y.i);
  const latest = reviews.length > 0 ? reviews[reviews.length - 1].r : undefined;
  return (
    latest !== undefined &&
    latest.verdict === 'approve' &&
    Array.isArray(latest.scope) &&
    isPerson(latest.by) &&
    latest.by !== record.author &&
    REQUIRED_SCOPES.every((s) => latest.scope.includes(s))
  );
}

/** The approving record bound to the item's id + version + current hash, if any. */
export function matchingRecord(item: Exercise, records: readonly ReviewRecord[], lookup: TextLookup = messageTexts): ReviewRecord | undefined {
  const candidates = records.filter((r) => r.id === item.id && r.version === item.version);
  if (candidates.length === 0) return undefined;
  const hash = contentHash(item, lookup);
  return candidates.find((r) => r.contentHash === hash && Array.isArray(r.reviews) && isApproved(r));
}

export interface GateOptions {
  preview: boolean;
  lookup?: TextLookup;
}

/**
 * The release test of 07-sourcing.md §6 for one path (default or preview). Empty means every served item may be
 * shown: legacy items only while their lesson is live in `state`, new-course items only `published` (or `reviewed`
 * in the preview) with a matching approving record.
 */
export function releaseGateProblems(units: readonly Unit[], state: ReleaseState, records: readonly ReviewRecord[], options: GateOptions): string[] {
  const { preview, lookup = messageTexts } = options;
  const problems: string[] = [];
  const live = new Set(liveLegacyLessons(state));
  const path = coursePath(units, { preview, state });
  const where = preview ? 'preview' : 'default path';
  for (const unit of path) {
    const newCourse = isNewCourseUnitId(unit.id);
    for (const { lesson, item, ref } of unitItems(unit)) {
      if (!newCourse) {
        // Transitional exemption: derived from the release state, never free-form.
        if (!lesson || !live.has(lesson.id)) problems.push(`${where}: ${ref} is legacy content that is not live in ${state.id}`);
        continue;
      }
      const okStatus = item.status === 'published' || (preview && item.status === 'reviewed');
      if (!okStatus) problems.push(`${where}: ${ref} is served but its status is ${String(item.status)} (needs published${preview ? ' or reviewed' : ''})`);
      if (!matchingRecord(item, records, lookup)) problems.push(`${where}: ${ref} has no approving review record for version ${String(item.version)} and its current hash`);
    }
  }
  // Every loaded item that claims to be reviewed or published must be backed by a record, served or not.
  if (!preview) {
    for (const unit of units.filter((u) => isNewCourseUnitId(u.id))) {
      for (const { item, ref } of unitItems(unit)) {
        if ((item.status === 'reviewed' || item.status === 'published') && !matchingRecord(item, records, lookup)) {
          problems.push(`loaded: ${ref} is ${item.status} without an approving review record matching its hash`);
        }
      }
    }
  }
  return [...new Set(problems)];
}
