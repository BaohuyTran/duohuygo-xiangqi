// Test helper: an in-memory SyncBackend (no network). Records calls and can be told to fail.
//
// It models the `public.progress` row as two columns: `rows` (the v1 `data` JSON) and `rowsV2` (`data_v2`).
// A push without `dataV2` (what older builds do: upsert `{ user_id, data }`) leaves `data_v2` as it is on update
// and null on insert — the PostgREST behaviour that manual test T15 confirms on a real project. With
// `dataV2Column = false` it behaves like a project where the data_v2 migration has not been run yet, after the
// fallbacks of src/sync/supabase.ts: pulls report the column missing and pushes write `data` only.
import type { PulledRow, PushedRow, SyncBackend, SyncUser } from './service';

export interface FakeBackend extends SyncBackend {
  /** Stored v1 `data` by user id (a key exists = the row exists). */
  rows: Map<string, unknown>;
  /** Stored `data_v2` by user id (no key = null). */
  rowsV2: Map<string, unknown>;
  /** False: the `data_v2` column does not exist. */
  dataV2Column: boolean;
  user: SyncUser | null;
  calls: {
    pulls: number;
    pushes: number;
    /** Every push, in order (cloned). */
    pushed: PushedRow[];
    links: { email: string; redirectTo: string }[];
    signOuts: number;
  };
  /** When set, pull / push / sendMagicLink reject. */
  fail: { pull?: boolean; push?: boolean; link?: boolean; signOut?: boolean };
  /** Simulates the magic link being opened: signs in and notifies listeners. */
  signIn(user: SyncUser): void;
}

export function createFakeBackend(
  initial: { user?: SyncUser | null; rows?: Record<string, unknown>; rowsV2?: Record<string, unknown>; dataV2Column?: boolean } = {},
): FakeBackend {
  const listeners = new Set<(user: SyncUser | null) => void>();
  const backend: FakeBackend = {
    rows: new Map(Object.entries(initial.rows ?? {})),
    rowsV2: new Map(Object.entries(initial.rowsV2 ?? {})),
    dataV2Column: initial.dataV2Column ?? true,
    user: initial.user ?? null,
    calls: { pulls: 0, pushes: 0, pushed: [], links: [], signOuts: 0 },
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
    async pull(userId): Promise<PulledRow> {
      backend.calls.pulls++;
      if (backend.fail.pull) throw new Error('network');
      const exists = backend.rows.has(userId);
      return {
        data: exists ? structuredClone(backend.rows.get(userId)) : null,
        dataV2: exists && backend.dataV2Column && backend.rowsV2.has(userId) ? structuredClone(backend.rowsV2.get(userId)) : null,
        dataV2Available: backend.dataV2Column,
      };
    },
    async push(userId, row) {
      backend.calls.pushes++;
      if (backend.fail.push) throw new Error('network');
      backend.calls.pushed.push(structuredClone(row));
      backend.rows.set(userId, structuredClone(row.data));
      const writeV2 = backend.dataV2Column && row.dataV2 !== null;
      if (writeV2) backend.rowsV2.set(userId, structuredClone(row.dataV2));
      return { dataV2Written: writeV2 };
    },
  };
  return backend;
}
