// Account login + offline-first progress sync. React-free; the backend (Supabase in production,
// a fake in tests) is injected, so this file never imports Supabase.
//
// Local data stays the source of truth for the UI. While signed in and online, a sync pulls the
// account's copy, merges it with the local copy (src/sync/merge.ts), writes the result locally and
// pushes it. A sync runs after sign-in / app start with a session, a short while after any local
// change, and when the device comes back online. Every failure is caught and only reported as
// `sync: 'error'` in the account state: gameplay never sees it.

import { readSnapshot, writeSnapshot, type KeyValueStore } from '../storage';
import { fingerprint, mergeSnapshots, parseRemote, toRemote, type RemoteData } from './merge';

export interface SyncUser {
  id: string;
  email: string | null;
}

/** What the sync needs from an auth + database provider. Implemented in src/sync/supabase.ts. */
export interface SyncBackend {
  /** The current session's user (also completes a magic-link sign-in arriving in the URL). */
  getUser(): Promise<SyncUser | null>;
  /** Called on sign-in / sign-out. Returns an unsubscribe function. */
  onAuthChange(callback: (user: SyncUser | null) => void): () => void;
  sendMagicLink(email: string, redirectTo: string): Promise<void>;
  signOut(): Promise<void>;
  /** The account's stored JSON, or null when there is none yet. */
  pull(userId: string): Promise<unknown>;
  push(userId: string, data: RemoteData): Promise<void>;
}

export type AuthStatus = 'loading' | 'signedOut' | 'linkSent' | 'signedIn';
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface AccountState {
  auth: AuthStatus;
  /** Signed-in email, or the address the magic link was sent to. */
  email: string | null;
  sync: SyncStatus;
  /** The last magic-link request failed. */
  sendFailed: boolean;
}

export interface NetworkStatus {
  isOnline(): boolean;
  /** Calls back when the device comes back online. Returns an unsubscribe function. */
  onOnline(callback: () => void): () => void;
}

export interface AccountService {
  /** Wraps the local store: writes through it schedule a sync. Give this store to the app. */
  readonly store: KeyValueStore;
  getState(): AccountState;
  subscribe(listener: () => void): () => void;
  /** Called after a sync changed local data, so the UI can re-read its repositories. */
  onDataChanged(listener: () => void): () => void;
  /** Resolves once the backend is loaded and the initial session is known. */
  readonly ready: Promise<void>;
  sendMagicLink(email: string): Promise<boolean>;
  /** Back to the email form after "link sent". */
  cancelLink(): void;
  /** Signs out on this device. Local progress stays. */
  signOut(): Promise<void>;
  /** Runs a sync now (no-op when signed out). Never throws. */
  sync(): Promise<void>;
  dispose(): void;
}

export interface AccountOptions {
  /** The device's local store (source of truth). */
  store: KeyValueStore;
  /** Loads the backend lazily (dynamic import, so Supabase stays out of the main bundle). */
  loadBackend: () => Promise<SyncBackend>;
  /** Where the magic link sends the user back to: the app's own URL. */
  redirectTo: string;
  now?: () => Date;
  /** Delay between a local change and its sync. */
  debounceMs?: number;
  network?: NetworkStatus;
}

export const SYNC_DEBOUNCE_MS = 2000;

/** navigator.onLine + the window "online" event; always online where they do not exist. */
export function browserNetwork(): NetworkStatus {
  return {
    isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
    onOnline(callback) {
      if (typeof window === 'undefined') return () => {};
      window.addEventListener('online', callback);
      return () => window.removeEventListener('online', callback);
    },
  };
}

export const isEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export function createAccountService({
  store: local,
  loadBackend,
  redirectTo,
  now = () => new Date(),
  debounceMs = SYNC_DEBOUNCE_MS,
  network = browserNetwork(),
}: AccountOptions): AccountService {
  let state: AccountState = { auth: 'loading', email: null, sync: 'idle', sendFailed: false };
  let backend: SyncBackend | null = null;
  let user: SyncUser | null = null;
  let running: Promise<void> | null = null;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  /** Fingerprint of the local data after the last successful sync. */
  let lastSynced: string | null = null;
  const listeners = new Set<() => void>();
  const dataListeners = new Set<() => void>();
  const cleanups: (() => void)[] = [];

  const setState = (patch: Partial<AccountState>) => {
    state = { ...state, ...patch };
    for (const l of listeners) l();
  };

  const setUser = (next: SyncUser | null) => {
    const changed = next?.id !== user?.id;
    user = next;
    if (next) setState({ auth: 'signedIn', email: next.email, sendFailed: false, ...(changed ? { sync: 'idle' } : {}) });
    else if (state.auth === 'signedIn' || state.auth === 'loading') setState({ auth: 'signedOut', email: null, sync: 'idle' });
    if (changed) {
      lastSynced = null;
      if (next) void sync();
    }
  };

  async function syncOnce(): Promise<void> {
    const b = backend;
    const uid = user?.id;
    if (!b || !uid) return;
    const raw = await b.pull(uid);
    if (user?.id !== uid) return; // signed out (or switched) meanwhile
    const at = now();
    const mine = readSnapshot(local, at);
    const theirs = raw === null || raw === undefined ? null : parseRemote(raw, at);
    const merged = theirs ? mergeSnapshots(mine, theirs, at) : mine;
    if (JSON.stringify(merged) !== JSON.stringify(mine)) {
      // Written to the inner store directly, so it does not schedule another sync.
      writeSnapshot(local, merged);
      if (fingerprint(merged) !== fingerprint(mine)) for (const l of dataListeners) l();
    }
    if (!theirs || fingerprint(merged) !== fingerprint(theirs)) await b.push(uid, toRemote(merged));
    lastSynced = fingerprint(merged);
  }

  function sync(): Promise<void> {
    if (disposed || !backend || !user) return Promise.resolve();
    if (running) {
      again = true;
      return running;
    }
    if (!network.isOnline()) {
      setState({ sync: 'offline' });
      return Promise.resolve();
    }
    setState({ sync: 'syncing' });
    running = (async () => {
      try {
        do {
          again = false;
          await syncOnce();
        } while (again && user && !disposed);
        setState({ sync: user ? 'synced' : 'idle' });
      } catch {
        setState({ sync: user ? 'error' : 'idle' });
      } finally {
        running = null;
      }
    })();
    return running;
  }

  const scheduleSync = () => {
    if (disposed || !user) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      // Skip when nothing meaningful changed since the last sync (e.g. only the hearts clock moved).
      if (lastSynced !== null && fingerprint(readSnapshot(local, now())) === lastSynced) return;
      void sync();
    }, debounceMs);
  };

  const store: KeyValueStore = {
    get: (key) => local.get(key),
    set(key, value) {
      if (local.get(key) === value) return;
      local.set(key, value);
      scheduleSync();
    },
    remove(key) {
      if (local.get(key) === null) return;
      local.remove(key);
      scheduleSync();
    },
  };

  cleanups.push(network.onOnline(() => void sync()));

  const ready = (async () => {
    try {
      const b = await loadBackend();
      if (disposed) return;
      backend = b;
      cleanups.push(b.onAuthChange((u) => setUser(u)));
      setUser(await b.getUser());
    } catch {
      // Backend could not load (offline first visit) or the session check failed.
      if (state.auth === 'loading') setState({ auth: 'signedOut', sync: user ? 'error' : 'idle' });
    }
  })();

  return {
    store,
    ready,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onDataChanged(listener) {
      dataListeners.add(listener);
      return () => dataListeners.delete(listener);
    },
    async sendMagicLink(email) {
      const address = email.trim();
      if (!backend || !isEmail(address)) {
        setState({ sendFailed: true });
        return false;
      }
      try {
        await backend.sendMagicLink(address, redirectTo);
        setState({ auth: 'linkSent', email: address, sendFailed: false });
        return true;
      } catch {
        setState({ sendFailed: true });
        return false;
      }
    },
    cancelLink() {
      if (state.auth === 'linkSent') setState({ auth: 'signedOut', email: null, sendFailed: false });
    },
    async signOut() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      try {
        await backend?.signOut();
      } catch {
        // Signing out on this device works offline; a failed server call changes nothing locally.
      }
      setUser(null);
      setState({ auth: 'signedOut', email: null, sync: 'idle' });
    },
    sync,
    dispose() {
      disposed = true;
      if (timer !== null) clearTimeout(timer);
      for (const c of cleanups) c();
      listeners.clear();
      dataListeners.clear();
    },
  };
}
