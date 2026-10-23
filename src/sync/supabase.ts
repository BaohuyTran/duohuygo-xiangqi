// The ONLY file that imports Supabase. It is loaded with a dynamic import() from main.tsx, and only
// when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set, so it never lands in the main bundle.
//
// Data model (supabase/migrations/): one row per user in `public.progress`
// (user_id = auth.uid(), data = the RemoteData JSON from ./merge.ts, data_v2 = the learning records from
// ./merge-records.ts), protected by Row Level Security. Older builds read and upsert `data` only, which leaves
// `data_v2` as it is (to be confirmed on the real project: manual test T15 in CLAUDE.md).
//
// Missing `data_v2` column (migration 20261023000000_progress_data_v2.sql not run yet, 05 §8.6 item 6): the pull
// falls back to `select('data')` and the push to `{ user_id, data }`, and the column is treated as missing for
// the rest of this app session (checked again on the next start). The service reports it as `sync: 'error'`.

import { createClient, type Session } from '@supabase/supabase-js';
import { createLocalStore } from '../storage';
import type { SyncConfig } from './config';
import type { LearningRecords } from '../progress/records';
import type { RemoteData } from './merge';
import type { PulledRow, SyncBackend, SyncUser } from './service';

export const PROGRESS_TABLE = 'progress';

/**
 * Whether a Supabase error says the `data_v2` column does not exist: PostgreSQL `42703` (undefined column, from a
 * select) or PostgREST `PGRST204` (column not in the schema cache, from an upsert). Codes to confirm in T15; the
 * message check covers either code missing.
 */
export function isMissingColumnError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code === '42703' || code === 'PGRST204') return true;
  return typeof message === 'string' && message.includes('data_v2') && /does not exist|could not find/i.test(message);
}

const toUser = (session: Session | null): SyncUser | null =>
  session ? { id: session.user.id, email: session.user.email ?? null } : null;

/** Auth parameters a magic link (or a failed one) leaves in the address bar. */
const AUTH_PARAMS = ['access_token', 'refresh_token', 'expires_at', 'expires_in', 'token_type', 'type', 'code', 'error', 'error_code', 'error_description', 'provider_token', 'sb'];

/** Removes magic-link parameters from the URL (keeps the path, so the base path is preserved). */
export function cleanAuthUrl(href: string): string | null {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const hasAuth = AUTH_PARAMS.some((p) => url.searchParams.has(p) || hash.has(p));
  if (!hasAuth) return null;
  for (const p of AUTH_PARAMS) url.searchParams.delete(p);
  return url.origin + url.pathname + url.search;
}

export function createSupabaseBackend(config: SyncConfig, create: typeof createClient = createClient): SyncBackend {
  // The session goes through src/storage (localStorage with a memory fallback), like all persistence.
  const authStore = createLocalStore('duohuygo:auth:');
  const client = create(config.url, config.anonKey, {
    auth: {
      storage: {
        getItem: (key) => authStore.get(key),
        setItem: (key, value) => authStore.set(key, value),
        removeItem: (key) => authStore.remove(key),
      },
      persistSession: true,
      autoRefreshToken: true,
      // The magic link returns to the app with the session in the URL; supabase-js picks it up.
      detectSessionInUrl: true,
      // Implicit flow: the link also works when the email opens in a different browser than the app.
      flowType: 'implicit',
    },
  });

  /** Set when the `data_v2` column turned out to be missing; kept for this app session. */
  let noDataV2 = false;

  return {
    async getUser() {
      const { data, error } = await client.auth.getSession();
      if (typeof window !== 'undefined') {
        const clean = cleanAuthUrl(window.location.href);
        if (clean) window.history.replaceState(window.history.state, '', clean);
      }
      if (error) throw error;
      return toUser(data.session);
    },
    onAuthChange(callback) {
      const { data } = client.auth.onAuthStateChange((_event, session) => callback(toUser(session)));
      return () => data.subscription.unsubscribe();
    },
    async sendMagicLink(email, redirectTo) {
      const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
      if (error) throw error;
    },
    async signOut() {
      // 'local': only this device, and it works offline.
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
    },
    async pull(userId): Promise<PulledRow> {
      const select = (columns: string) => client.from(PROGRESS_TABLE).select(columns).eq('user_id', userId).maybeSingle();
      if (!noDataV2) {
        const { data, error } = await select('data, data_v2');
        if (!error) {
          const row = data as { data?: unknown; data_v2?: unknown } | null;
          return { data: row?.data ?? null, dataV2: row?.data_v2 ?? null, dataV2Available: true };
        }
        if (!isMissingColumnError(error)) throw error;
        noDataV2 = true;
      }
      const { data, error } = await select('data');
      if (error) throw error;
      return { data: (data as { data?: unknown } | null)?.data ?? null, dataV2: null, dataV2Available: false };
    },
    async push(userId, { data, dataV2 }: { data: RemoteData; dataV2: LearningRecords | null }) {
      const upsert = (row: Record<string, unknown>) => client.from(PROGRESS_TABLE).upsert(row, { onConflict: 'user_id' });
      if (dataV2 !== null && !noDataV2) {
        const { error } = await upsert({ user_id: userId, data, data_v2: dataV2 });
        if (!error) return { dataV2Written: true };
        if (!isMissingColumnError(error)) throw error;
        noDataV2 = true;
      }
      // Only `data`: an existing `data_v2` is left as it is.
      const { error } = await upsert({ user_id: userId, data });
      if (error) throw error;
      return { dataV2Written: false };
    },
  };
}
