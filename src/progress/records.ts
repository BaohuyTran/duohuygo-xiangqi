// Three-level learning records (completed / mastered / applied) and the local attempt log.
// Pure TypeScript: no React, DOM, storage or gamification imports (enforced by a test). Persistence is
// `createLearningRepository` in src/storage; this file defines the format and the lenient parsers.
//
// Format (docs/curriculum-upgrade/design/05-migration.md §8.3, stored under `learning.records.v1`):
// - `schema`: minor version of the format. Only ADDITIVE changes are allowed under this key (new optional
//   fields, schema bump); a breaking change uses a new key. A higher stored schema is preserved, never lowered.
// - `completed`: new-course lesson id -> CompletionGrant. Never legacy ids: legacy completion is DERIVED at read
//   time from the v1 list (src/progress/legacy.ts) and never stored.
// - `mastered`: unit id -> MasteryGrant (unit checks, placement "covered", the `xm` exam). Never from migration.
// - `applied`: practical task / exam id -> ApplicationGrant.
// - `exposed`: assessment item ids seen in checks, placement and exams.
// - any other top-level field (written by a newer build) is preserved on rewrite.
//
// Corrupt data (05 §8.9): a section that is not an object is treated as empty; an entry with an invalid `at`, a
// non-finite score, a score outside 0–100, an unknown `via` (or `fallback`) or a missing version is dropped on its
// own; unknown lesson / unit / task ids are KEPT (they may come from newer content). The repository handles a
// value that is not a JSON object (backup key).

export type Strand = 'RS' | 'TC' | 'OD' | 'PA' | 'DE' | 'PP';
export const STRANDS: readonly Strand[] = ['RS', 'TC', 'OD', 'PA', 'DE', 'PP'];

export type FallbackRegime = 'F1' | 'F1c' | 'F2' | 'F2b' | 'F3' | 'F4' | 'F5';
export const FALLBACK_REGIMES: readonly FallbackRegime[] = ['F1', 'F1c', 'F2', 'F2b', 'F3', 'F4', 'F5'];

export const COMPLETION_VIA = ['lesson', 'placement'] as const;
export const MASTERY_VIA = ['check', 'placement', 'exam'] as const;
export const APPLICATION_VIA = ['practical', 'placement', 'exam'] as const;

/** Current minor version of the `learning.records.v1` format. */
export const RECORDS_SCHEMA = 1;

export interface CompletionGrant {
  /** ISO date-time. */
  at: string;
  via: (typeof COMPLETION_VIA)[number];
  contentVersion: number;
}

export interface MasteryGrant {
  at: string;
  via: (typeof MASTERY_VIA)[number];
  /** 0–100. */
  score: number;
  strandScores?: Partial<Record<Strand, number>>;
  formId: string;
  assessmentVersion: number;
}

export interface ApplicationGrant {
  at: string;
  via: (typeof APPLICATION_VIA)[number];
  /** 0–100. */
  score: number;
  taskVersion: number;
  /** A placement task counted as this unit task (03 §7.4). */
  equivalentOf?: string;
  /** Partner regime fallback the task was passed under (03 §5.2). */
  fallback?: FallbackRegime;
}

export interface LearningRecords {
  schema: number;
  completed: Record<string, CompletionGrant>;
  mastered: Record<string, MasteryGrant>;
  applied: Record<string, ApplicationGrant>;
  exposed: string[];
  /** Fields written by a newer build: preserved on rewrite. */
  [unknownField: string]: unknown;
}

export function emptyRecords(): LearningRecords {
  return { schema: RECORDS_SCHEMA, completed: {}, mastered: {}, applied: {}, exposed: [] };
}

// ---------- Attempt log (local only, capped; 03 §3.1) ----------

export const ATTEMPT_MODES = ['practice', 'check', 'placement', 'practical', 'exam'] as const;
/** The attempt log keeps the newest entries only. */
export const ATTEMPT_LOG_CAP = 2000;

export interface AttemptRecord {
  itemId: string;
  itemVersion: number;
  mode: (typeof ATTEMPT_MODES)[number];
  /** ISO date-time. */
  at: string;
  colour?: 'red' | 'black';
  /** First-answer credit, 0–1 (03 §3.2). */
  credit: number;
  hints?: number;
  /** Highest hint-ladder step reached. */
  hintStep?: string;
  attemptsBeforeSuccess?: number;
  seed?: number;
  /** Misconception tag of the first wrong answer (e.g. `b06.m2`). */
  misconception?: string;
  /**
   * The first answer could not be checked (analysis 'not-checked'): no credit and no penalty; scoring skips the
   * record (04-architecture.md §5.4, 03-assessment.md §3.2). Optional and additive: older entries have none.
   */
  voided?: boolean;
  [unknownField: string]: unknown;
}

// ---------- Validation helpers ----------

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === 'string' && v !== '';
const isVersion = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isScore = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
const isOneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);

/** A valid ISO-style date string (what `Date#toISOString` writes). */
export function isValidAt(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
}

/** The grant itself (unknown extra fields kept), or null when a known field is invalid. */
export function parseCompletionGrant(v: unknown): CompletionGrant | null {
  if (!isObject(v) || !isValidAt(v.at) || !isOneOf(COMPLETION_VIA, v.via) || !isVersion(v.contentVersion)) return null;
  return { ...v } as unknown as CompletionGrant;
}

export function parseMasteryGrant(v: unknown): MasteryGrant | null {
  if (!isObject(v) || !isValidAt(v.at) || !isOneOf(MASTERY_VIA, v.via) || !isScore(v.score)) return null;
  if (!isId(v.formId) || !isVersion(v.assessmentVersion)) return null;
  const grant = { ...v } as Record<string, unknown>;
  if (v.strandScores !== undefined) {
    // Optional detail: an invalid strand map (or entry) is dropped, the mastery grant is kept.
    const strands = isObject(v.strandScores)
      ? Object.fromEntries(Object.entries(v.strandScores).filter(([k, s]) => isOneOf(STRANDS, k) && isScore(s)))
      : {};
    if (Object.keys(strands).length > 0) grant.strandScores = strands;
    else delete grant.strandScores;
  }
  return grant as unknown as MasteryGrant;
}

export function parseApplicationGrant(v: unknown): ApplicationGrant | null {
  if (!isObject(v) || !isValidAt(v.at) || !isOneOf(APPLICATION_VIA, v.via) || !isScore(v.score)) return null;
  if (!isVersion(v.taskVersion)) return null;
  if (v.equivalentOf !== undefined && !isId(v.equivalentOf)) return null;
  if (v.fallback !== undefined && !isOneOf(FALLBACK_REGIMES, v.fallback)) return null;
  return { ...v } as unknown as ApplicationGrant;
}

function parseSection<T>(v: unknown, parse: (entry: unknown) => T | null): Record<string, T> {
  if (!isObject(v)) return {};
  const kept: [string, T][] = [];
  for (const [id, entry] of Object.entries(v)) {
    const grant = id === '' ? null : parse(entry);
    if (grant) kept.push([id, grant]);
  }
  // Object.fromEntries defines own properties, so an id such as `__proto__` cannot change the prototype.
  return Object.fromEntries(kept);
}

/**
 * Reads stored (or remote) records leniently, field by field. Never throws. Anything that is not an object
 * gives empty records; the caller decides whether to back up the raw value.
 */
export function parseRecords(raw: unknown): LearningRecords {
  if (!isObject(raw)) return emptyRecords();
  const { schema, completed, mastered, applied, exposed, ...unknown } = raw;
  return {
    ...unknown,
    schema: isVersion(schema) && schema > RECORDS_SCHEMA ? schema : RECORDS_SCHEMA,
    completed: parseSection(completed, parseCompletionGrant),
    mastered: parseSection(mastered, parseMasteryGrant),
    applied: parseSection(applied, parseApplicationGrant),
    exposed: Array.isArray(exposed) ? [...new Set(exposed.filter(isId))] : [],
  };
}

export function parseAttempt(v: unknown): AttemptRecord | null {
  if (!isObject(v) || !isId(v.itemId) || !isVersion(v.itemVersion) || !isOneOf(ATTEMPT_MODES, v.mode)) return null;
  if (!isValidAt(v.at) || typeof v.credit !== 'number' || !(v.credit >= 0 && v.credit <= 1)) return null;
  return { ...v } as unknown as AttemptRecord;
}

/** Valid entries only, newest `ATTEMPT_LOG_CAP` kept (the log is in append order: oldest first). */
export function parseAttempts(raw: unknown): AttemptRecord[] {
  if (!Array.isArray(raw)) return [];
  return capAttempts(raw.map(parseAttempt).filter((a): a is AttemptRecord => a !== null));
}

export function capAttempts(log: readonly AttemptRecord[], cap = ATTEMPT_LOG_CAP): AttemptRecord[] {
  return log.slice(Math.max(0, log.length - cap));
}

// ---------- Granting (shared by the local repository and the cross-device merge in src/sync/merge-records.ts) ----------

/** The grant to keep for a scored state: higher score, then later `at`, then JSON string order (deterministic). */
export function betterScored<T extends { score: number; at: string }>(a: T, b: T): T {
  if (a.score !== b.score) return a.score > b.score ? a : b;
  const ta = Date.parse(a.at);
  const tb = Date.parse(b.at);
  if (ta !== tb) return ta > tb ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

/**
 * The completion grant to keep when a lesson has two: the earlier `at`, then `via` order `lesson` < `placement`,
 * then JSON string order (deterministic, so commutative). The ONE rule for completions, used both locally
 * (`grantCompletion` in src/storage) and by the account merge (src/sync/merge-records.ts), 05 §8.6 item 4.
 */
export function betterCompletion(a: CompletionGrant, b: CompletionGrant): CompletionGrant {
  const ta = Date.parse(a.at);
  const tb = Date.parse(b.at);
  if (ta !== tb) return ta < tb ? a : b;
  if (a.via !== b.via) return COMPLETION_VIA.indexOf(a.via) <= COMPLETION_VIA.indexOf(b.via) ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

/**
 * Whether finishing this lesson is its first REAL completion (MU4 / PD-28: 10 XP). Only stored grants count:
 * a completion derived from the legacy list (src/progress/legacy.ts) does not. Wired into XP by S2.13.
 */
export function isFirstRealCompletion(records: LearningRecords, lessonId: string): boolean {
  return !Object.hasOwn(records.completed, lessonId);
}
