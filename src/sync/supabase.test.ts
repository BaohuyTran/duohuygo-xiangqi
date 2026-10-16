import { describe, expect, it, vi } from 'vitest';
import type { createClient } from '@supabase/supabase-js';
import { appUrl, readSyncConfig } from './config';
import { cleanAuthUrl, createSupabaseBackend, PROGRESS_TABLE } from './supabase';

describe('sync config', () => {
  it('needs both variables', () => {
    expect(readSyncConfig({})).toBeNull();
    expect(readSyncConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull();
    expect(readSyncConfig({ VITE_SUPABASE_URL: ' ', VITE_SUPABASE_ANON_KEY: 'k' })).toBeNull();
    expect(readSyncConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: ' k ' })).toEqual({
      url: 'https://x.supabase.co',
      anonKey: 'k',
    });
  });

  it('the magic link returns to origin + base path, without query or hash', () => {
    expect(appUrl('https://u.github.io/xq/index.html?x=1#y', './')).toBe('https://u.github.io/xq/');
    expect(appUrl('https://u.github.io/xq/', './')).toBe('https://u.github.io/xq/');
    expect(appUrl('http://localhost:5173/', '/')).toBe('http://localhost:5173/');
  });

  it('removes magic-link parameters from the address', () => {
    expect(cleanAuthUrl('https://a.b/xq/')).toBeNull();
    expect(cleanAuthUrl('https://a.b/xq/#access_token=t&refresh_token=r&type=magiclink')).toBe('https://a.b/xq/');
    expect(cleanAuthUrl('https://a.b/xq/?code=1&keep=2')).toBe('https://a.b/xq/?keep=2');
    expect(cleanAuthUrl('https://a.b/xq/#error=access_denied&error_code=otp_expired')).toBe('https://a.b/xq/');
  });
});

/** A fake Supabase client: records the calls, no network. */
function fakeClient() {
  const calls: unknown[][] = [];
  let authListener: ((event: string, session: unknown) => void) | null = null;
  const result = { data: null as unknown, error: null as unknown };
  const query = {
    select: (...a: unknown[]) => (calls.push(['select', ...a]), query),
    eq: (...a: unknown[]) => (calls.push(['eq', ...a]), query),
    maybeSingle: async () => (calls.push(['maybeSingle']), result),
    upsert: async (...a: unknown[]) => (calls.push(['upsert', ...a]), { error: result.error }),
  };
  const client = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'me@x.io' } } }, error: null }),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        authListener = cb;
        return { data: { subscription: { unsubscribe: () => (authListener = null) } } };
      },
      signInWithOtp: async (...a: unknown[]) => (calls.push(['signInWithOtp', ...a]), { error: result.error }),
      signOut: async (...a: unknown[]) => (calls.push(['signOut', ...a]), { error: null }),
    },
    from: (table: string) => (calls.push(['from', table]), query),
  };
  const create = vi.fn(() => client) as unknown as typeof createClient;
  return { create, calls, result, emit: (s: unknown) => authListener?.('SIGNED_IN', s) };
}

describe('Supabase backend (mocked client)', () => {
  const config = { url: 'https://x.supabase.co', anonKey: 'anon' };

  it('creates the client with the configured URL/key and storage through src/storage', () => {
    const fake = fakeClient();
    createSupabaseBackend(config, fake.create);
    const [url, key, options] = (fake.create as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(config.url);
    expect(key).toBe(config.anonKey);
    expect(options.auth).toMatchObject({ persistSession: true, detectSessionInUrl: true, flowType: 'implicit' });
    expect(typeof options.auth.storage.getItem).toBe('function');
  });

  it('maps the session to a user and forwards auth changes', async () => {
    const fake = fakeClient();
    const backend = createSupabaseBackend(config, fake.create);
    expect(await backend.getUser()).toEqual({ id: 'u1', email: 'me@x.io' });
    const seen: unknown[] = [];
    const off = backend.onAuthChange((u) => seen.push(u));
    fake.emit({ user: { id: 'u2' } });
    fake.emit(null);
    off();
    fake.emit({ user: { id: 'u3' } });
    expect(seen).toEqual([{ id: 'u2', email: null }, null]);
  });

  it('sends the magic link with the redirect URL and signs out on this device only', async () => {
    const fake = fakeClient();
    const backend = createSupabaseBackend(config, fake.create);
    await backend.sendMagicLink('me@x.io', 'https://app/xq/');
    await backend.signOut();
    expect(fake.calls).toContainEqual(['signInWithOtp', { email: 'me@x.io', options: { emailRedirectTo: 'https://app/xq/' } }]);
    expect(fake.calls).toContainEqual(['signOut', { scope: 'local' }]);
  });

  it('reads and upserts the one progress row of the user', async () => {
    const fake = fakeClient();
    const backend = createSupabaseBackend(config, fake.create);
    expect(await backend.pull('u1')).toBeNull();
    fake.result.data = { data: { version: 1 } };
    expect(await backend.pull('u1')).toEqual({ version: 1 });
    const data = { version: 1, completedLessons: [], solvedPuzzles: [], settings: { language: null, muted: null }, gamification: null };
    await backend.push('u1', data);
    expect(fake.calls).toContainEqual(['from', PROGRESS_TABLE]);
    expect(fake.calls).toContainEqual(['eq', 'user_id', 'u1']);
    expect(fake.calls).toContainEqual(['upsert', { user_id: 'u1', data }, { onConflict: 'user_id' }]);
  });

  it('turns Supabase errors into rejections (the service shows them as a sync status)', async () => {
    const fake = fakeClient();
    const backend = createSupabaseBackend(config, fake.create);
    fake.result.error = new Error('JWT expired');
    await expect(backend.pull('u1')).rejects.toThrow('JWT expired');
    await expect(backend.push('u1', { version: 1, completedLessons: [], solvedPuzzles: [], settings: { language: null, muted: null }, gamification: null })).rejects.toThrow();
    await expect(backend.sendMagicLink('a@b.co', 'x')).rejects.toThrow();
  });
});
