// Builds the phone-cost bench page (S2.6, docs/curriculum-upgrade/measurements.md). It is NOT part of
// the app: the app build (`npm run build`, vite.config.ts) never includes scripts/bench. The page imports
// the real analysis client (src/analysis/client.ts), so Vite bundles its Worker chunk from
// `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` exactly as in the app.
// Output: ui-check-output/bench-dist/ (git-ignored). Used by scripts/bench.mjs.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');

export default defineConfig({
  root: here,
  base: './',
  build: {
    outDir: path.join(repo, 'ui-check-output/bench-dist'),
    emptyOutDir: true,
    rollupOptions: { input: path.join(here, 'bench.html') },
  },
  preview: { port: 4199 },
});
