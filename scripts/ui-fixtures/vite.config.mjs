// Builds the test-only Black-orientation fixture page used by scripts/ui-check.mjs (S2.3). It is NOT
// part of the app: the app build (`npm run build`, vite.config.ts) never includes scripts/ui-fixtures.
// Output: ui-check-output/fixture-dist/black.html (git-ignored).
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
  build: {
    outDir: path.join(repo, 'ui-check-output/fixture-dist'),
    emptyOutDir: true,
    rollupOptions: { input: path.join(here, 'black.html') },
  },
  preview: { port: 4198 },
});
