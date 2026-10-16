// Test helper: an in-memory SyncBackend (no network). Records calls and can be told to fail.
import type { RemoteData } from './merge';
import type { SyncBackend, SyncUser } from './service';

export interface FakeBackend extends SyncBackend {
  /** Stored account rows by user id. */
  rows: Map<string, unknown>;
  user: SyncUser | null;
  calls: { pulls: number; pushes: number; links: { email: string; redirectTo: string }[]; signOuts: number };
  /** When set, pull / push / sendMagicLink reject. */
  fail: { pull?: boolean; push?: boolean; link?: boolean; signOut?: boolean };
  /** Simulates the magic link being opened: signs in and notifies listeners. */
  signIn(user: SyncUser): void;
}

export function createFakeBackend(initial: { user?: SyncUser | null; rows?: Record<string, unknown> } = {}): FakeBackend {
  const listeners = new Set<(user: SyncUser | null) => void>();
  const backend: FakeBackend = {
    rows: new Map(Object.entries(initial.rows ?? {})),
    user: initial.user ?? null,
    calls: { pulls: 0, pushes: 0, links: [], signOuts: 0 },
    fail: {},
    signIn(user) {
      backend.user = user;
      for (const l of listeners) l(user);
    },
    getUser: async () => backend.user,
    onAuthChange(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    async sendMagicLink(email, redirectTo) {
      if (backend.fail.link) throw new Error('network');
      backend.calls.links.push({ email, redirectTo });
    },
    async signOut() {
      backend.calls.signOuts++;
      if (backend.fail.signOut) throw new Error('network');
      backend.user = null;
      for (const l of listeners) l(null);
    },
    async pull(userId) {
      backend.calls.pulls++;
      if (backend.fail.pull) throw new Error('network');
      return backend.rows.has(userId) ? structuredClone(backend.rows.get(userId)) : null;
    },
    async push(userId, data: RemoteData) {
      backend.calls.pushes++;
      if (backend.fail.push) throw new Error('network');
      backend.rows.set(userId, structuredClone(data));
    },
  };
  return backend;
}
