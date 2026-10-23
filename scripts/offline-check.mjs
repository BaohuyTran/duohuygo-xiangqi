// Offline / installability check of the production build (PWA).
//
//   npm run offline:check [-- --no-build] [-- --out <dir>] [-- --port 4198]
//
// 1. Builds the app (`npm run build`) unless --no-build.
// 2. Serves dist/ with `vite preview` and checks installability basics: a linked web app manifest
//    with name, short_name, start_url, display, theme/background colours and 192px + 512px PNG icons
//    (plus a maskable one) whose real pixel sizes match, an apple-touch-icon and a theme-color meta.
// 3. Loads the app once in headless Chromium, waits until the service worker controls the page,
//    then goes offline (browser offline mode AND the preview server stopped), reloads, and opens
//    a lesson and a puzzle. A second page opened while offline must load too.
// 4. Analysis Worker (src/analysis/worker.ts, S2.5): its chunk must be in dist/assets and in the
//    service worker's precache list; on the offline page a Worker is started from it, answers known
//    requests correctly (mate in 1, a search score, the safety guard, move signals for every move of
//    two pilot-like positions), is terminated mid-search and restarted (still offline). Fails when
//    the main-thread part of one request (postMessage + reading the answer) takes over 50 ms or a
//    long task (> 50 ms) occurs on the main thread meanwhile; prints the Worker times per kind.
// Fails on any uncaught exception. Screenshots go to --out (default: ui-check-output/offline).
//
// Playwright is NOT a project dependency: like scripts/ui-check.mjs, it uses a globally installed
// `playwright` (as in the cloud dev container) or a local one if present.
import { execSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const OUT = path.resolve(arg('out', path.join('ui-check-output', 'offline')));
const PORT = Number(arg('port', '4198'));
const BASE = `http://localhost:${PORT}/`;

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const id of ['playwright', '@playwright/test']) {
    try {
      return require(id);
    } catch {
      // try the next location
    }
  }
  const globalRoot = execSync('npm root -g').toString().trim();
  return require(path.join(globalRoot, 'playwright'));
}

async function waitForServer(url, timeoutMs = 30_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`preview server did not start on ${url}`);
}

/** Width and height from a PNG's IHDR chunk, or null if it is not a PNG. */
function pngSize(buf) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 24 || sig.some((b, i) => buf[i] !== b)) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const failures = [];
const fail = (msg) => failures.push(msg);
const step = (msg) => console.log(`- ${msg}`);

if (!args.includes('--no-build')) {
  step('building (npm run build)');
  execSync('npm run build', { stdio: 'inherit' });
}

mkdirSync(OUT, { recursive: true });

// The analysis Worker chunk is built and precached (globPatterns in vite.config.ts).
const workerChunks = readdirSync(path.join('dist', 'assets')).filter((f) => /^worker-.*\.js$/.test(f));
if (workerChunks.length !== 1) fail(`expected one analysis Worker chunk in dist/assets, found ${workerChunks.length}`);
const workerFile = workerChunks.length ? `assets/${workerChunks[0]}` : null;
if (workerFile && !readFileSync(path.join('dist', 'sw.js'), 'utf8').includes(workerFile)) {
  fail(`${workerFile} is not in the service worker precache list (dist/sw.js)`);
} else if (workerFile) {
  step(`analysis Worker chunk precached: ${workerFile}`);
}
// Own process group, so the whole npx -> vite tree can be stopped (also mid-check, to go offline).
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const stopServer = () => {
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    // already gone
  }
};

async function checkManifest(page) {
  const head = await page.evaluate(() => ({
    manifest: document.querySelector('link[rel="manifest"]')?.href ?? null,
    appleIcon: document.querySelector('link[rel="apple-touch-icon"]')?.href ?? null,
    themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null,
    viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '',
  }));
  if (!head.manifest) return fail('no <link rel="manifest"> in index.html');
  if (!head.themeColor) fail('no <meta name="theme-color">');
  if (!head.viewport.includes('width=device-width')) fail('viewport meta lacks width=device-width');
  if (!head.appleIcon) fail('no apple-touch-icon link');

  const res = await fetch(head.manifest);
  if (!res.ok) return fail(`manifest ${head.manifest} -> HTTP ${res.status}`);
  const m = await res.json();
  for (const key of ['name', 'short_name', 'start_url', 'display', 'theme_color', 'background_color']) {
    if (!m[key]) fail(`manifest: missing ${key}`);
  }
  if (!['standalone', 'fullscreen', 'minimal-ui'].includes(m.display)) fail(`manifest: display "${m.display}" is not installable`);

  const icons = Array.isArray(m.icons) ? m.icons : [];
  const sizesFound = new Set();
  for (const icon of icons) {
    const url = new URL(icon.src, head.manifest).href;
    const r = await fetch(url);
    if (!r.ok) {
      fail(`icon ${icon.src} -> HTTP ${r.status}`);
      continue;
    }
    const size = pngSize(Buffer.from(await r.arrayBuffer()));
    if (!size) {
      fail(`icon ${icon.src} is not a PNG`);
      continue;
    }
    if (icon.sizes !== `${size.width}x${size.height}`) fail(`icon ${icon.src}: declared ${icon.sizes}, real ${size.width}x${size.height}`);
    if ((icon.purpose ?? 'any').split(' ').includes('any')) sizesFound.add(icon.sizes);
  }
  if (!sizesFound.has('192x192')) fail('manifest: no 192x192 icon (purpose any)');
  if (!sizesFound.has('512x512')) fail('manifest: no 512x512 icon (purpose any)');
  if (!icons.some((i) => (i.purpose ?? '').split(' ').includes('maskable'))) fail('manifest: no maskable icon');
  if (head.appleIcon) {
    const r = await fetch(head.appleIcon);
    if (!r.ok || !pngSize(Buffer.from(await r.arrayBuffer()))) fail('apple-touch-icon missing or not a PNG');
  }
  step(`manifest OK: "${m.name}", ${icons.length} icons`);
}

/** Opens the first lesson and the first puzzle; throws when something does not load. */
async function openLessonAndPuzzle(page, tag) {
  const tapButton = async (name) => page.getByRole('button', { name }).first().tap();
  await page.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 10_000 });
  await tapButton(/\((start|bắt đầu|completed|đã hoàn thành)\)$/i);
  await page.waitForSelector('[role="grid"]', { timeout: 10_000 });
  await page.screenshot({ path: path.join(OUT, `${tag}-lesson.png`) });
  step(`${tag}: lesson opened`);
  await tapButton(/Quit lesson|Thoát bài học/);
  await tapButton(/^(Puzzles|Câu đố)$/);
  await tapButton(/^(Puzzle|Câu đố) 1, /);
  await page.waitForSelector('[role="grid"]', { timeout: 10_000 });
  await page.screenshot({ path: path.join(OUT, `${tag}-puzzle.png`) });
  step(`${tag}: puzzle opened`);
}

const MAIN_THREAD_LIMIT_MS = 50;

/**
 * Runs the analysis Worker from the cache on an offline page (raw protocol of src/analysis/requests.ts:
 * { id, request } -> { id, outcome }). Returns failures and a summary.
 */
async function checkAnalysisWorker(page, file) {
  const r = await page.evaluate(
    async ({ url, limitMs }) => {
      const failures = [];
      const TYPES = { k: 'general', a: 'advisor', b: 'elephant', n: 'horse', r: 'chariot', c: 'cannon', p: 'soldier' };
      const fen = (text) => {
        const [rows, turn] = text.split(' ');
        const board = Array(90).fill(null);
        rows.split('/').forEach((row, i) => {
          let file = 0;
          for (const ch of row) {
            if (/\d/.test(ch)) file += Number(ch);
            else board[(9 - i) * 9 + file++] = { color: ch === ch.toUpperCase() ? 'red' : 'black', type: TYPES[ch.toLowerCase()] };
          }
        });
        return { board, turn: turn === 'b' ? 'black' : 'red', halfmoveClock: 0, fullmoveNumber: 1 };
      };
      const sq = (name) => Number(name[1]) * 9 + 'abcdefghi'.indexOf(name[0]);
      const mv = (s) => ({ from: sq(s.slice(0, 2)), to: sq(s.slice(2, 4)) });
      const guard = (h, k, missedGain, missedMate) => ({ h, k, T: 2, missedGain, missedMate });
      const BASICS = guard(1, 1, 'free-capture', 1);
      const INTERMEDIATE = guard(2, 2, 'search', 1);
      const ADVANCED = guard(2, 2, 'search', 2);
      // Pilot-like positions (as in src/analysis/client.test.ts).
      const OPENING_BLACK = fen('rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR b');
      const MID = fen('r1bakabr1/9/1cn3nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKABR1 w');
      const DEFENCE = fen('4k4/8P/b4a3/3r4n/6b2/9/1P4N2/3A1K3/1N7/1R1A5 w');
      const MATE1 = fen('3k5/3p1p3/9/9/9/9/9/9/R8/4K4 w');

      const longTasks = [];
      const observer = new PerformanceObserver((list) => list.getEntries().forEach((e) => longTasks.push(e.duration)));
      try {
        observer.observe({ type: 'longtask' });
      } catch {
        // longtask timing not supported: only the per-request measurement applies
      }

      let worker = new Worker(url, { type: 'module' });
      let nextId = 0;
      const stats = {};
      let maxMain = 0;
      const ask = (request) =>
        new Promise((resolve, reject) => {
          const id = ++nextId;
          const timer = setTimeout(() => reject(new Error(`no answer to ${request.kind} within 30 s`)), 30_000);
          let postMs = 0;
          const t0 = performance.now();
          worker.onerror = (e) => {
            clearTimeout(timer);
            reject(new Error(`worker error: ${e.message || 'script failed to load'}`));
          };
          worker.onmessage = (e) => {
            const h0 = performance.now();
            const data = e.data; // the structured clone is read here
            const outcome = data.outcome;
            const h1 = performance.now();
            if (data.id !== id) return;
            clearTimeout(timer);
            const main = postMs + (h1 - h0);
            maxMain = Math.max(maxMain, main);
            if (main > limitMs) failures.push(`${request.kind}: main-thread work ${main.toFixed(1)} ms > ${limitMs} ms`);
            (stats[request.kind] ??= []).push(h0 - t0);
            resolve(outcome);
          };
          const p0 = performance.now();
          worker.postMessage({ id, request });
          postMs = performance.now() - p0;
        });
      const expect = (label, ok, got) => {
        if (!ok) failures.push(`${label}: unexpected answer ${JSON.stringify(got).slice(0, 300)}`);
      };

      try {
        const ping = await ask({ kind: 'ping' });
        expect('ping', ping.status === 'checked', ping);
        const m1 = await ask({ kind: 'forced-wins', position: MATE1, n: 1 });
        expect('mate in 1', m1.status === 'checked' && JSON.stringify(m1.value) === JSON.stringify([mv('a1a9')]), m1);
        const s2 = await ask({ kind: 'search', position: MID, depth: 2 });
        expect('search(mid, 2) = 0.5', s2.status === 'checked' && s2.value.score === 0.5 && s2.value.complete, s2);
        const safe = await ask({ kind: 'safety-guard', position: DEFENCE, move: mv('g3e4'), guard: ADVANCED });
        expect('safety guard g3-e4', safe.status === 'checked' && safe.value.safe === true, safe);
        const blunder = await ask({ kind: 'move-signals', position: MID, move: mv('e2e6'), guard: INTERMEDIATE });
        expect('C5+4 loses the cannon', blunder.status === 'checked' && blunder.value.penalty === 'serious-allowed-loss', blunder);
        const budget = await ask({ kind: 'search', position: MID, depth: 4, limits: { budget: 1500 } });
        expect('node budget', budget.status === 'not-checked' && budget.reason === 'node-limit' && budget.nodes === 1501, budget);

        // One interaction = one learner move judged: every move of two pilot-like positions.
        let judged = 0;
        for (const [position, g] of [
          [OPENING_BLACK, BASICS],
          [MID, INTERMEDIATE],
        ]) {
          const all = await ask({ kind: 'score-moves', position, depth: 2 });
          expect('score-moves', all.status === 'checked' && all.value.length > 30, all);
          for (const { move } of all.value ?? []) {
            const o = await ask({ kind: 'move-signals', position, move, guard: g, threats: true });
            expect('move-signals', o.status === 'checked', o);
            judged++;
          }
        }

        // Safety net: terminate a long search, start a new Worker (from the cache, offline).
        worker.postMessage({ id: ++nextId, request: { kind: 'search', position: MID, depth: 8, limits: { maxNodes: 1e9, budget: 1e9 } } });
        await new Promise((res) => setTimeout(res, 300));
        worker.terminate();
        worker = new Worker(url, { type: 'module' });
        const again = await ask({ kind: 'forced-wins', position: MATE1, n: 1 });
        expect('restarted Worker', again.status === 'checked', again);
        await new Promise((res) => setTimeout(res, 100)); // let pending long-task entries arrive
        return { failures, stats, maxMain, judged, longTasks };
      } catch (e) {
        failures.push(String(e instanceof Error ? e.message : e));
        return { failures, stats, maxMain, judged: 0, longTasks };
      } finally {
        observer.disconnect();
        worker.terminate();
      }
    },
    { url: new URL(file, BASE).href, limitMs: MAIN_THREAD_LIMIT_MS },
  );
  for (const f of r.failures) fail(`analysis Worker: ${f}`);
  for (const d of r.longTasks) fail(`analysis Worker: main-thread long task of ${d.toFixed(0)} ms while judging`);
  const ms = (list) => {
    const sorted = [...list].sort((a, b) => a - b);
    return `median ${sorted[Math.floor(sorted.length / 2)].toFixed(1)} / max ${sorted[sorted.length - 1].toFixed(1)} ms (${list.length})`;
  };
  step(`analysis Worker offline: ${r.judged} moves judged; main-thread max ${r.maxMain.toFixed(2)} ms per request; long tasks: ${r.longTasks.length}`);
  for (const [kind, list] of Object.entries(r.stats)) step(`  Worker round trip ${kind}: ${ms(list)}`);
}

let browser;
try {
  await waitForServer(BASE);
  const { chromium } = loadPlaywright();
  browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'allow',
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fail(`uncaught exception: ${e.message}`));

  // 1. First visit online: the service worker installs and precaches the app shell.
  await page.goto(BASE);
  await checkManifest(page);
  const scope = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.scope;
  });
  step(`service worker active (scope ${scope})`);
  // 2. Reload so the page is controlled by the service worker (autoUpdate uses clientsClaim too).
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15_000 });
  step('page controlled by the service worker');

  // 3. Offline: browser offline mode, and the server is gone too.
  await ctx.setOffline(true);
  stopServer();
  await new Promise((r) => setTimeout(r, 500));
  const network = await page.evaluate(() =>
    fetch(`./not-cached-${Date.now()}.txt`, { cache: 'no-store' }).then(
      (r) => `HTTP ${r.status}`,
      () => 'failed',
    ),
  );
  if (network !== 'failed') throw new Error(`network still reachable while offline (${network})`);
  step(`offline confirmed (uncached request: ${network})`);

  await page.reload();
  await openLessonAndPuzzle(page, 'offline-reload');

  // A brand-new page while offline (like reopening the installed app) loads from the cache too.
  const fresh = await ctx.newPage();
  fresh.on('pageerror', (e) => fail(`uncaught exception (new page): ${e.message}`));
  await fresh.goto(BASE);
  await openLessonAndPuzzle(fresh, 'offline-new-page');

  if (workerFile) await checkAnalysisWorker(fresh, workerFile);
} catch (e) {
  fail(`offline-check crashed: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await browser?.close();
  stopServer();
}

if (failures.length) {
  console.error(`OFFLINE CHECK FAILED (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`OFFLINE CHECK PASSED. Screenshots: ${OUT}`);
