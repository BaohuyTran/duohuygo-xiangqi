// Builds the test-only course-preview fixture page used by `npm run ui:check -- --preview` (S2.19). NOT part of the
// app: the app build (`npm run build`, vite.config.ts) never includes scripts/ui-fixtures. The page is the course
// preview (VITE_COURSE_PREVIEW forced to '1' here) plus test fixtures chosen by the query string; see
// preview-fixture.tsx. Output: ui-check-output/preview-fixture-dist/preview-fixture.html (git-ignored).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');

export default defineConfig({
  root: here,
  base: './',
  plugins: [react(), tailwindcss()],
  define: { 'import.meta.env.VITE_COURSE_PREVIEW': JSON.stringify('1') },
  build: {
    outDir: path.join(repo, 'ui-check-output/preview-fixture-dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
    rollupOptions: { input: path.join(here, 'preview-fixture.html') },
  },
});
