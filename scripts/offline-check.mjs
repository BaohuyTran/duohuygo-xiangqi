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
// Fails on any uncaught exception. Screenshots go to --out (default: ui-check-output/offline).
//
// Playwright is NOT a project dependency: like scripts/ui-check.mjs, it uses a globally installed
// `playwright` (as in the cloud dev container) or a local one if present.
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
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
