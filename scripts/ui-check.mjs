// Phone-width smoke check of the production build, used by the tester agent (see docs/DRIVER.md).
//
//   npm run build && npm run ui:check [-- --out <dir>] [-- --width 360] [-- --height 740]
//
// Serves dist/ with `vite preview`, opens it in headless Chromium at 360x740 (touch, mobile; use
// e.g. --width 740 --height 360 for landscape), walks Lessons -> first lesson (incl. a wrong answer)
// -> back -> Puzzles -> first puzzle (incl. a move and its feedback), and fails if any page has
// horizontal scroll, a button smaller than 44x44px or clipped at the screen edge, a fixed footer that
// still covers the board's last row when scrolled to the bottom, a console error or an uncaught
// exception. Screenshots go to --out (default: ui-check-output/, git-ignored).
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
const HEIGHT = Number(arg('height', '740'));
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
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fail(`uncaught exception: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && fail(`console error: ${m.text()}`));

  const audit = async (name) => {
    await page.waitForTimeout(400); // let animations settle
    const { scrollWidth, innerWidth, small, clipped, covered } = await page.evaluate(() => {
      const label = (el) => el.getAttribute('aria-label') || el.textContent?.trim() || el.tagName;
      const controls = [...document.querySelectorAll('button, a[href], [role="button"]')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      // Scroll to the very bottom: from there the board's last row must be clear of every fixed bar.
      window.scrollTo(0, document.documentElement.scrollHeight);
      const board = document.querySelector('[role="grid"]');
      const fixedBars = [...document.querySelectorAll('footer, nav')].filter((el) => getComputedStyle(el).position === 'fixed');
      const boardBottom = board?.getBoundingClientRect().bottom;
      const covered = board
        ? fixedBars.filter((el) => el.getBoundingClientRect().top + 1 < boardBottom).map((el) => `${el.tagName} top ${Math.round(el.getBoundingClientRect().top)}px < board bottom ${Math.round(boardBottom)}px`)
        : [];
      window.scrollTo(0, 0);
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        small: controls.filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width < 44 || r.height < 44;
        }).map(label),
        clipped: controls.filter((el) => {
          const r = el.getBoundingClientRect();
          return r.left < -0.5 || r.right > window.innerWidth + 0.5;
        }).map(label),
        covered,
      };
    });
    if (scrollWidth > innerWidth) fail(`${name}: horizontal scroll (${scrollWidth}px > ${innerWidth}px)`);
    if (small.length) fail(`${name}: touch targets under 44px: ${small.join(' | ')}`);
    if (clipped.length) fail(`${name}: controls clipped at the screen edge: ${clipped.join(' | ')}`);
    if (covered.length) fail(`${name}: fixed bar covers the board's last row: ${covered.join(' | ')}`);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
    console.log(`checked ${name}`);
  };
  const tapButton = async (name) => page.getByRole('button', { name }).first().tap();

  await page.goto(BASE);
  await audit('01-lessons-home');

  await tapButton(/\((start|bắt đầu)\)$/i);
  await page.waitForSelector('[role="grid"]');
  await audit('02-lesson-player');
  // Lesson 1: three "learn" cards, then a select-squares exercise. A wrong pick shows the largest footer.
  for (let i = 0; i < 3; i++) await tapButton(/^(Continue|Tiếp tục)$/);
  await page.getByRole('gridcell', { name: /^a0,/ }).tap();
  await tapButton(/^(Check|Kiểm tra)/);
  await page.waitForSelector('[role="alert"]');
  await audit('02b-lesson-wrong-answer');
  await tapButton(/Quit lesson|Thoát bài học/);

  await tapButton(/^(Puzzles|Câu đố)$/);
  await audit('03-puzzle-list');
  await tapButton(/^(Puzzle|Câu đố) 1, /);
  await page.waitForSelector('[role="grid"]');
  await audit('04-puzzle-player');
  // Play any legal move (right or wrong) to get the feedback footer.
  const pieces = page.getByRole('gridcell', { name: /, (Red|Đỏ) / });
  for (let i = 0, n = await pieces.count(); i < n; i++) {
    await pieces.nth(i).tap();
    const target = page.getByRole('gridcell', { name: /(legal move|nước đi hợp lệ)/ }).first();
    if ((await target.count()) === 0) continue;
    await target.tap();
    break;
  }
  await page.waitForSelector('[role="alert"]');
  await audit('05-puzzle-feedback');
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
console.log(`UI CHECK PASSED at ${WIDTH}x${HEIGHT}px. Screenshots: ${OUT}`);
