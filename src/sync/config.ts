// Supabase settings come from the build environment (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
// Without both, account sync is off: no account UI and the Supabase code is never loaded.

export interface SyncConfig {
  url: string;
  anonKey: string;
}

export function readSyncConfig(env: { VITE_SUPABASE_URL?: unknown; VITE_SUPABASE_ANON_KEY?: unknown }): SyncConfig | null {
  const url = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : '';
  const anonKey = typeof env.VITE_SUPABASE_ANON_KEY === 'string' ? env.VITE_SUPABASE_ANON_KEY.trim() : '';
  return url && anonKey ? { url, anonKey } : null;
}

/** The app's own URL (origin + Vite base path, no query or hash): where the magic link returns to. */
export function appUrl(currentHref: string, base: string): string {
  return new URL(base, currentHref).href;
}
