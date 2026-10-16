// The ONLY file that imports Supabase. It is loaded with a dynamic import() from main.tsx, and only
// when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set, so it never lands in the main bundle.
//
// Data model (supabase/migrations/): one row per user in `public.progress`
// (user_id = auth.uid(), data = the RemoteData JSON from ./merge.ts), protected by Row Level Security.

import { createClient, type Session } from '@supabase/supabase-js';
import { createLocalStore } from '../storage';
import type { SyncConfig } from './config';
import type { RemoteData } from './merge';
import type { SyncBackend, SyncUser } from './service';

export const PROGRESS_TABLE = 'progress';

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
    async pull(userId) {
      const { data, error } = await client.from(PROGRESS_TABLE).select('data').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return (data as { data: unknown } | null)?.data ?? null;
    },
    async push(userId, data: RemoteData) {
      const { error } = await client.from(PROGRESS_TABLE).upsert({ user_id: userId, data }, { onConflict: 'user_id' });
      if (error) throw error;
    },
  };
}
