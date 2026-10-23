/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Optional: without it (and the anon key) account sync is hidden. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon (public) key. Optional. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** "1" = course preview build: Home shows the new-course path (src/content/index.ts). Never set for the deployed build. */
  readonly VITE_COURSE_PREVIEW?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
