/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Optional: without it (and the anon key) account sync is hidden. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon (public) key. Optional. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
