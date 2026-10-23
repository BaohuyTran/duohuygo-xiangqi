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
// Playing Black (S2.3): afterwards it builds the test-only fixture page scripts/ui-fixtures/black.html
// (its own Vite config; never part of the app build) into ui-check-output/fixture-dist/, serves it on
// --fixture-port (default 4198) and checks the same rules with Black at the bottom: the
// board is turned (e9 below e0, i9 left of a9), a tap on the Black Horse b9 then c7 plays the move, and
// the footer shows it in traditional notation (en "H2+3", vi "M2.3"). `--no-black` skips this part.
// The course preview (VITE_COURSE_PREVIEW=1) has no Black unit yet and the players do not pass an
// orientation yet, so the fixture page is the Black check until a reviewed Black unit exists.
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
const BLACK = !args.includes('--no-black');
const FIXTURE_PORT = Number(arg('fixture-port', '4198'));
const FIXTURE_CONFIG = 'scripts/ui-fixtures/vite.config.mjs';

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
let fixtureServer;
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

  if (BLACK) {
    execSync(`npx vite build --config ${FIXTURE_CONFIG} --logLevel warn`, { stdio: 'inherit' });
    fixtureServer = spawn('npx', ['vite', 'preview', '--config', FIXTURE_CONFIG, '--port', String(FIXTURE_PORT), '--strictPort'], {
      stdio: 'ignore',
      detached: true,
    });
    const fixtureUrl = `http://localhost:${FIXTURE_PORT}/black.html`;
    await waitForServer(fixtureUrl);
    const centre = async (name) => {
      const box = await page.getByRole('gridcell', { name: new RegExp(`^${name},`) }).boundingBox();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    for (const [lang, expected] of [
      ['en', 'H2+3'],
      ['vi', 'M2.3'],
    ]) {
      await page.goto(`${fixtureUrl}?lang=${lang}`);
      await page.waitForSelector('[role="grid"][data-orientation="black"]');
      const [e0, e9, a9, i9] = [await centre('e0'), await centre('e9'), await centre('a9'), await centre('i9')];
      if (!(e9.y > e0.y)) fail(`black fixture (${lang}): Black's General e9 is not below Red's e0`);
      if (!(i9.x < a9.x)) fail(`black fixture (${lang}): i9 is not left of a9 with Black at the bottom`);
      const bottomNumbers = await page.locator('[data-edge="bottom"]').getAttribute('data-side');
      if (bottomNumbers !== 'black') fail(`black fixture (${lang}): bottom file numbers are ${bottomNumbers}'s, not Black's`);
      if (lang === 'en') await audit('06-black-board');
      await page.getByRole('gridcell', { name: /^b9,/ }).tap();
      await page.getByRole('gridcell', { name: /^c7,.*(legal move|nước đi hợp lệ)/ }).tap();
      await page.waitForSelector('[role="alert"]');
      const notation = (await page.getByTestId('notation').textContent())?.trim();
      if (notation !== expected) fail(`black fixture (${lang}): move b9-c7 shown as "${notation}", expected "${expected}"`);
      await audit(`07-black-move-${lang}`);
    }
  }
} catch (e) {
  fail(`ui-check crashed: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await browser?.close();
  for (const proc of [server, fixtureServer]) {
    if (!proc) continue;
    try {
      process.kill(-proc.pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
}

if (failures.length) {
  console.error(`UI CHECK FAILED (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`UI CHECK PASSED at ${WIDTH}x${HEIGHT}px${BLACK ? ' (incl. the Black fixture)' : ''}. Screenshots: ${OUT}`);
