// Phone-width smoke check of the production build, used by the tester agent (see docs/DRIVER.md).
//
//   npm run build && npm run ui:check [-- --out <dir>] [-- --width 360]
//
// Serves dist/ with `vite preview`, opens it in headless Chromium at 360px (touch, mobile), walks
// Lessons -> first lesson -> back -> Puzzles -> first puzzle, and fails if any page has horizontal
// scroll, a button smaller than 44x44px, a console error or an uncaught exception. Screenshots go
// to --out (default: ui-check-output/, git-ignored).
//
// Playwright is NOT a project dependency: the script uses a globally installed `playwright`
// (as in the cloud dev container) or a local one if present.
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const OUT = path.resolve(arg('out', 'ui-check-output'));
const WIDTH = Number(arg('width', '360'));
const PORT = Number(arg('port', '4199'));
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

const failures = [];
const fail = (msg) => failures.push(msg);

mkdirSync(OUT, { recursive: true });
// Own process group, so the whole npx -> vite tree can be stopped at the end.
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
let browser;
try {
  await waitForServer(BASE);
  const { chromium } = loadPlaywright();
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fail(`uncaught exception: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && fail(`console error: ${m.text()}`));

  const audit = async (name) => {
    await page.waitForTimeout(400); // let animations settle
    const { scrollWidth, innerWidth, small } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      small: [...document.querySelectorAll('button, a[href], [role="button"]')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
        })
        .map((el) => el.getAttribute('aria-label') || el.textContent?.trim() || el.tagName),
    }));
    if (scrollWidth > innerWidth) fail(`${name}: horizontal scroll (${scrollWidth}px > ${innerWidth}px)`);
    if (small.length) fail(`${name}: touch targets under 44px: ${small.join(' | ')}`);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
    console.log(`checked ${name}`);
  };
  const tapButton = async (name) => page.getByRole('button', { name }).first().tap();

  await page.goto(BASE);
  await audit('01-lessons-home');

  await tapButton(/\((start|bắt đầu)\)$/i);
  await page.waitForSelector('[role="grid"]');
  await audit('02-lesson-player');
  await tapButton(/Quit lesson|Thoát bài học/);

  await tapButton(/^(Puzzles|Câu đố)$/);
  await audit('03-puzzle-list');
  await tapButton(/^(Puzzle|Câu đố) 1, /);
  await page.waitForSelector('[role="grid"]');
  await audit('04-puzzle-player');
} catch (e) {
  fail(`ui-check crashed: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await browser?.close();
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    // already gone
  }
}

if (failures.length) {
  console.error(`UI CHECK FAILED (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`UI CHECK PASSED at ${WIDTH}px. Screenshots: ${OUT}`);
