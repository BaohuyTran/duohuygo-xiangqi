import { parseState, type GamificationRepository } from '../gamification';

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
const GAMIFICATION_KEY = 'gamification.state.v1';

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
}

export function createSettingsRepository(store: KeyValueStore): SettingsRepository {
  return {
    language: () => store.get(LANGUAGE_KEY),
    setLanguage: (lang) => store.set(LANGUAGE_KEY, lang),
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
