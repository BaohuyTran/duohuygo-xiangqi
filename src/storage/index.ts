import { parseState, type GamificationRepository, type GamificationState } from '../gamification';
import {
  betterScored,
  capAttempts,
  parseApplicationGrant,
  parseAttempt,
  parseAttempts,
  parseCompletionGrant,
  parseMasteryGrant,
  parseRecords,
  emptyRecords,
  type ApplicationGrant,
  type AttemptRecord,
  type CompletionGrant,
  type LearningRecords,
  type MasteryGrant,
} from '../progress/records';

// Small persistence layer. Everything goes through a KeyValueStore so localStorage can be swapped
// for something else (IndexedDB, a server) later without touching the UI.

export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function createMemoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = new Map(Object.entries(initial));
  return {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => void data.set(key, value),
    remove: (key) => void data.delete(key),
  };
}

/** localStorage with an in-memory fallback (private mode, blocked storage, tests). */
export function createLocalStore(prefix = 'duohuygo:'): KeyValueStore {
  const memory = createMemoryStore();
  const storage = (() => {
    try {
      const s = globalThis.localStorage;
      const probe = `${prefix}probe`;
      s.setItem(probe, '1');
      s.removeItem(probe);
      return s;
    } catch {
      return null;
    }
  })();
  if (!storage) return memory;
  return {
    get: (key) => {
      try {
        return storage.getItem(prefix + key);
      } catch {
        return memory.get(key);
      }
    },
    set: (key, value) => {
      try {
        storage.setItem(prefix + key, value);
      } catch {
        memory.set(key, value);
      }
    },
    remove: (key) => {
      try {
        storage.removeItem(prefix + key);
      } catch {
        memory.remove(key);
      }
    },
  };
}

const COMPLETED_KEY = 'progress.completedLessons.v1';
const SOLVED_PUZZLES_KEY = 'progress.solvedPuzzles.v1';
const LANGUAGE_KEY = 'settings.language.v1';
const MUTED_KEY = 'settings.muted.v1';
const GAMIFICATION_KEY = 'gamification.state.v1';
export const LEARNING_RECORDS_KEY = 'learning.records.v1';
export const LEARNING_RECORDS_BACKUP_KEY = 'learning.records.v1.backup';
export const LEARNING_ATTEMPTS_KEY = 'learning.attempts.v1';

/** A persisted set of ids (completed lessons, solved puzzles, ...). */
interface IdSet {
  list(): string[];
  add(id: string): string[];
  clear(): void;
}

function createIdSet(store: KeyValueStore, key: string): IdSet {
  const list = (): string[] => {
    try {
      const parsed: unknown = JSON.parse(store.get(key) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  };
  return {
    list,
    add(id) {
      const next = [...new Set([...list(), id])];
      store.set(key, JSON.stringify(next));
      return next;
    },
    clear: () => store.remove(key),
  };
}

export interface ProgressRepository {
  completedLessons(): string[];
  markCompleted(lessonId: string): string[];
  reset(): void;
}

export function createProgressRepository(store: KeyValueStore): ProgressRepository {
  const ids = createIdSet(store, COMPLETED_KEY);
  return { completedLessons: ids.list, markCompleted: ids.add, reset: ids.clear };
}

export interface PuzzleProgressRepository {
  solvedPuzzles(): string[];
  markSolved(puzzleId: string): string[];
  reset(): void;
}

export function createPuzzleProgressRepository(store: KeyValueStore): PuzzleProgressRepository {
  const ids = createIdSet(store, SOLVED_PUZZLES_KEY);
  return { solvedPuzzles: ids.list, markSolved: ids.add, reset: ids.clear };
}

export interface SettingsRepository {
  language(): string | null;
  setLanguage(lang: string): void;
  /** Sound effects off. Defaults to false (sound on). */
  muted(): boolean;
  setMuted(muted: boolean): void;
}

export function createSettingsRepository(store: KeyValueStore): SettingsRepository {
  return {
    language: () => store.get(LANGUAGE_KEY),
    setLanguage: (lang) => store.set(LANGUAGE_KEY, lang),
    muted: () => store.get(MUTED_KEY) === '1',
    setMuted: (muted) => store.set(MUTED_KEY, muted ? '1' : '0'),
  };
}

/** XP, hearts, daily goal and streak (rules in src/gamification). Corrupt data falls back to defaults. */
export function createGamificationRepository(store: KeyValueStore): GamificationRepository {
  return {
    load(now) {
      try {
        return parseState(JSON.parse(store.get(GAMIFICATION_KEY) ?? 'null'), now);
      } catch {
        return parseState(null, now);
      }
    },
    save: (state) => store.set(GAMIFICATION_KEY, JSON.stringify(state)),
  };
}

// ---------- Three-level learning records (format and rules in src/progress/records.ts) ----------

/**
 * `learning.records.v1` (completed / mastered / applied / exposed; synced by S2.11) and `learning.attempts.v1`
 * (the attempt log: local only, newest ATTEMPT_LOG_CAP entries).
 *
 * - Reading never writes (no migration step, no backup on read, no default value stored).
 * - A stored value that is not a JSON object reads as empty records; the first write then copies the raw string
 *   to `learning.records.v1.backup` (overwriting an older backup) before replacing it, so it is never lost.
 * - Writes keep unknown top-level fields and a higher `schema` written by a newer build.
 * - Grants with an invalid field are ignored (nothing written). New-course ids are written here only, never to
 *   the v1 completed list (`progress.completedLessons.v1`); legacy completion is derived (src/progress/legacy.ts).
 */
export interface LearningRepository {
  records(): LearningRecords;
  /** Records a lesson completion; an existing grant is kept (the first completion counts). */
  grantCompletion(lessonId: string, grant: CompletionGrant): LearningRecords;
  /** Keeps the better grant per unit: higher score, then later date (mastery is never revoked). */
  grantMastery(unitId: string, grant: MasteryGrant): LearningRecords;
  /** Keeps the better grant per task / exam: higher score, then later date. */
  grantApplication(taskId: string, grant: ApplicationGrant): LearningRecords;
  /** Adds assessment item ids to the `exposed` set. */
  markExposed(itemIds: readonly string[]): LearningRecords;
  attempts(): AttemptRecord[];
  /** Appends to the attempt log (invalid entries ignored), keeping the newest ATTEMPT_LOG_CAP. */
  logAttempt(attempt: AttemptRecord): AttemptRecord[];
  /** "Reset progress": removes the records and the attempt log (the backup key is left alone). */
  reset(): void;
}

export function createLearningRepository(store: KeyValueStore): LearningRepository {
  const readRaw = (): { records: LearningRecords; corrupt: string | null } => {
    const raw = store.get(LEARNING_RECORDS_KEY);
    if (raw === null) return { records: emptyRecords(), corrupt: null };
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { records: emptyRecords(), corrupt: raw };
    }
    const isObject = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
    return { records: parseRecords(parsed), corrupt: isObject ? null : raw };
  };
  const records = () => readRaw().records;
  const update = (fn: (r: LearningRecords) => LearningRecords | null): LearningRecords => {
    const { records: current, corrupt } = readRaw();
    const next = fn(current);
    if (next === null) return current;
    if (corrupt !== null) store.set(LEARNING_RECORDS_BACKUP_KEY, corrupt);
    store.set(LEARNING_RECORDS_KEY, JSON.stringify(next));
    return next;
  };
  const attempts = (): AttemptRecord[] => {
    try {
      return parseAttempts(JSON.parse(store.get(LEARNING_ATTEMPTS_KEY) ?? '[]'));
    } catch {
      return [];
    }
  };
  return {
    records,
    grantCompletion(lessonId, grant) {
      const valid = parseCompletionGrant(grant);
      return update((r) =>
        !lessonId || !valid || Object.hasOwn(r.completed, lessonId)
          ? null
          : { ...r, completed: Object.fromEntries([...Object.entries(r.completed), [lessonId, valid]]) },
      );
    },
    grantMastery(unitId, grant) {
      const valid = parseMasteryGrant(grant);
      return update((r) => {
        if (!unitId || !valid) return null;
        const old = Object.hasOwn(r.mastered, unitId) ? r.mastered[unitId] : undefined;
        const best = old ? betterScored(old, valid) : valid;
        return best === old ? null : { ...r, mastered: Object.fromEntries([...Object.entries(r.mastered), [unitId, best]]) };
      });
    },
    grantApplication(taskId, grant) {
      const valid = parseApplicationGrant(grant);
      return update((r) => {
        if (!taskId || !valid) return null;
        const old = Object.hasOwn(r.applied, taskId) ? r.applied[taskId] : undefined;
        const best = old ? betterScored(old, valid) : valid;
        return best === old ? null : { ...r, applied: Object.fromEntries([...Object.entries(r.applied), [taskId, best]]) };
      });
    },
    markExposed(itemIds) {
      return update((r) => {
        const fresh = itemIds.filter((id) => typeof id === 'string' && id !== '' && !r.exposed.includes(id));
        return fresh.length === 0 ? null : { ...r, exposed: [...new Set([...r.exposed, ...fresh])] };
      });
    },
    attempts,
    logAttempt(attempt) {
      const valid = parseAttempt(attempt);
      if (!valid) return attempts();
      const next = capAttempts([...attempts(), valid]);
      store.set(LEARNING_ATTEMPTS_KEY, JSON.stringify(next));
      return next;
    },
    reset() {
      store.remove(LEARNING_RECORDS_KEY);
      store.remove(LEARNING_ATTEMPTS_KEY);
    },
  };
}

// ---------- Whole-progress snapshot (used by account sync in src/sync) ----------

/**
 * Everything that is synced to an account, read from / written to a KeyValueStore.
 * `null` means "nothing stored on this device yet" (so a merge can tell unset from a default).
 */
export interface ProgressSnapshot {
  completedLessons: string[];
  solvedPuzzles: string[];
  language: string | null;
  muted: boolean | null;
  gamification: GamificationState | null;
}

export function readSnapshot(store: KeyValueStore, now: Date): ProgressSnapshot {
  const muted = store.get(MUTED_KEY);
  return {
    completedLessons: createProgressRepository(store).completedLessons(),
    solvedPuzzles: createPuzzleProgressRepository(store).solvedPuzzles(),
    language: store.get(LANGUAGE_KEY),
    muted: muted === null ? null : muted === '1',
    gamification: store.get(GAMIFICATION_KEY) === null ? null : createGamificationRepository(store).load(now),
  };
}

/** Writes a snapshot. `null` fields are left untouched (never deletes data). */
export function writeSnapshot(store: KeyValueStore, snapshot: ProgressSnapshot): void {
  store.set(COMPLETED_KEY, JSON.stringify(snapshot.completedLessons));
  store.set(SOLVED_PUZZLES_KEY, JSON.stringify(snapshot.solvedPuzzles));
  const settings = createSettingsRepository(store);
  if (snapshot.language !== null) settings.setLanguage(snapshot.language);
  if (snapshot.muted !== null) settings.setMuted(snapshot.muted);
  if (snapshot.gamification !== null) createGamificationRepository(store).save(snapshot.gamification);
}
