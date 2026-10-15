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
const LANGUAGE_KEY = 'settings.language.v1';

export interface ProgressRepository {
  completedLessons(): string[];
  markCompleted(lessonId: string): string[];
  reset(): void;
}

export function createProgressRepository(store: KeyValueStore): ProgressRepository {
  const read = (): string[] => {
    try {
      const parsed: unknown = JSON.parse(store.get(COMPLETED_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  };
  return {
    completedLessons: read,
    markCompleted(lessonId) {
      const next = [...new Set([...read(), lessonId])];
      store.set(COMPLETED_KEY, JSON.stringify(next));
      return next;
    },
    reset: () => store.remove(COMPLETED_KEY),
  };
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
