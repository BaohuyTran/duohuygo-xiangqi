// S2.19 pilot walkthrough of the course preview (test-only; run through `npm run ui:check -- --preview`, which starts
// this file with tsx). Results and screenshots go to <out>/preview/ (default ui-check-output/preview/); the record of a
// run is docs/curriculum-upgrade/pilot/walkthrough.md.
//
//   npm run ui:check -- --preview [--viewports 320,360,414,landscape,desktop] [--flows course,check,j2,j1]
//                                 [--port 4199] [--fixture-port 4198] [--out ui-check-output] [--no-build] [--parallel N]
//
// Builds (unless --no-build) the course preview (`VITE_COURSE_PREVIEW=1`) into ui-check-output/preview-dist and the
// test-only fixture page (scripts/ui-fixtures/preview-fixture.*) into ui-check-output/preview-fixture-dist, serves them
// on --port / --fixture-port and drives four flows per viewport in headless Chromium, each in a fresh browser context
// (fresh learner):
//
// - course (real preview): Home → b09l3 (Black lesson, Red task b09-g1) → i08l3 (Red) → a03l1–a03l3 (both colours;
//   three G1 items answered wrong first, then retried; a03-g1 Black task) → the a03 unit check must be offered (finding
//   W1, fixed: interleaving from b08 / i01, units outside the path but earlier in course order) → the check cycle
//   below → a07l4 (Black) whose hold
//   task a07-g1 is first played with fault injection (every analysis answer `not-checked`: the run must end "Not
//   assessed"), then a new game played to the result.
// - check (fixture page `?stubs=b08,i01`: stub units b08 / i01 in the path so the a03 check can be built): a03l1–a03l3
//   as above → a03 unit check answered wrong (fail) → Home "not mastered yet" + remediation only → remediation practice
//   (must contain the three items answered wrong first) → retake offered → retake answered right → "Mastered (unit
//   check)".
// - j2: a fresh learner taps the locked a07l4 → J2 test-out of a03 from the `pa` slice → passed → a03 completed and
//   mastered (placement).
// - j1: the fixture page `?pools=j1` (the preview app plus a FIXTURE `pb` / `pb-g` pool, not learner content) → the placement
//   banner → J1 form of 20 items + the practical slot → result screen → b09 completed / mastered / applied (placement).
//
// Viewports: 320×740, 360×740, 414×896, landscape 740×360 (phone: touch, taps) and desktop 1280×800 (mouse, every
// step by KEYBOARD where the app offers a keyboard way: buttons by Enter, choice options by digit keys, moves through
// the "Enter the move with the keyboard" picker, board points (select-squares, move items) through the board's roving
// focus (arrow keys + Enter; W2 fix); steps with no keyboard way are recorded as findings and done with
// the mouse so the flow can go on, and fail the run as finding W2). Every screen is audited with the ui:check rules (no horizontal scroll, controls
// ≥ 44 px and not clipped, no fixed bar over the board's last row) and screenshotted; console errors, uncaught
// exceptions and page reloads fail the run.
import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { ChoiceExercise, DecisionExercise, Exercise, LineExercise, MoveExercise, PlayExercise, SelectSquaresExercise } from '../../src/content/types';
import { parseSquare } from '../../src/engine';
import {
  boardKeyFromLabels,
  choiceLabels,
  decisionMove,
  en,
  j1FixtureItems,
  keyed,
  lessonItems,
  lineMove,
  lineNodes,
  matchItem,
  moveAnswer,
  poolItems,
  previewUnits,
  referenceMove,
  selection,
  type KeyedItem,
  type Mode,
} from './answer-key';
import { pageHooks } from './page-hooks';

// ---------- Options ----------

const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const OUT = path.resolve(arg('out', 'ui-check-output'), 'preview');
const PORT = Number(arg('port', '4199'));
const FIXTURE_PORT = Number(arg('fixture-port', '4198'));
const BUILD = !args.includes('--no-build');
const PARALLEL = Math.max(1, Number(arg('parallel', '1')));
const SEED = 20261111;

interface Viewport {
  name: string;
  width: number;
  height: number;
  touch: boolean;
  keyboard: boolean;
}
const ALL_VIEWPORTS: Viewport[] = [
  { name: '320', width: 320, height: 740, touch: true, keyboard: false },
  { name: '360', width: 360, height: 740, touch: true, keyboard: false },
  { name: '414', width: 414, height: 896, touch: true, keyboard: false },
  { name: 'landscape', width: 740, height: 360, touch: true, keyboard: false },
  { name: 'desktop', width: 1280, height: 800, touch: false, keyboard: true },
];
const VIEWPORTS = arg('viewports', ALL_VIEWPORTS.map((v) => v.name).join(','))
  .split(',')
  .map((n) => ALL_VIEWPORTS.find((v) => v.name === n) ?? (() => { throw new Error(`unknown viewport ${n}`); })());
const FLOWS = arg('flows', 'course,check,j2,j1').split(',');

// ---------- Playwright ----------

type PW = typeof import('playwright');
type Page = import('playwright').Page;
type Locator = import('playwright').Locator;
type Browser = import('playwright').Browser;

function loadPlaywright(): PW {
  const require = createRequire(import.meta.url);
  for (const id of ['playwright', '@playwright/test']) {
    try {
      return require(id) as PW;
    } catch {
      // try the next location
    }
  }
  const globalRoot = execSync('npm root -g').toString().trim();
  return require(path.join(globalRoot, 'playwright')) as PW;
}

async function waitForServer(url: string, timeoutMs = 30_000) {
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Results ----------

interface StepResult {
  flow: string;
  viewport: string;
  input: 'touch' | 'keyboard';
  step: string;
  colour?: string;
  ok: boolean;
  detail?: string;
  shot?: string;
}
const results: StepResult[] = [];
const failures: string[] = [];
/** Steps the keyboard could not do (done with the mouse instead), by kind. */
const keyboardGaps = new Map<string, Set<string>>();

// ---------- One flow in one viewport ----------

class Flow {
  shots = 0;
  /** Main-frame navigations (the first load counts one). */
  private navigations = 0;
  readonly page: Page;
  readonly vp: Viewport;
  readonly flow: string;
  constructor(page: Page, vp: Viewport, flow: string) {
    this.page = page;
    this.vp = vp;
    this.flow = flow;
    page.on('pageerror', (e) => this.fail('uncaught exception', e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') this.fail('console error', m.text());
    });
    page.on('framenavigated', (f) => {
      if (f === page.mainFrame()) this.navigations += 1;
    });
  }

  get input(): 'touch' | 'keyboard' {
    return this.vp.keyboard ? 'keyboard' : 'touch';
  }

  record(step: string, ok: boolean, detail?: string, shot?: string, colour?: string) {
    results.push({ flow: this.flow, viewport: this.vp.name, input: this.input, step, ok, ...(detail ? { detail } : {}), ...(shot ? { shot } : {}), ...(colour ? { colour } : {}) });
    if (!ok) failures.push(`[${this.flow} @ ${this.vp.name}] ${step}${detail ? `: ${detail}` : ''}`);
    console.log(`${ok ? 'ok  ' : 'FAIL'} [${this.flow} @ ${this.vp.name}] ${step}${detail ? ` — ${detail}` : ''}`);
  }
  fail(step: string, detail: string) {
    this.record(step, false, detail);
  }
  /** The page must never reload while answering (pilot exit criterion 1). */
  assertNoReload(step: string) {
    if (this.navigations > 1) this.fail(step, `the page navigated ${this.navigations - 1} time(s) after the first load`);
    this.navigations = Math.min(this.navigations, 1);
  }

  /** ui:check rules + a screenshot. Returns the screenshot path (relative to the repo). */
  async audit(name: string): Promise<string> {
    const page = this.page;
    await page.waitForTimeout(350); // let animations settle
    const r = await page.evaluate(() => {
      const label = (el: Element) => el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 60) || el.tagName;
      const controls = [...document.querySelectorAll('button, a[href], [role="button"], summary, select')].filter((el) => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.height > 0;
      });
      const y = window.scrollY;
      window.scrollTo(0, document.documentElement.scrollHeight);
      const board = document.querySelector('[role="grid"]');
      const fixedBars = [...document.querySelectorAll('footer, nav')].filter((el) => getComputedStyle(el).position === 'fixed');
      const boardBottom = board?.getBoundingClientRect().bottom ?? 0;
      const covered = board
        ? fixedBars.filter((el) => el.getBoundingClientRect().top + 1 < boardBottom).map((el) => `${el.tagName} top ${Math.round(el.getBoundingClientRect().top)}px < board bottom ${Math.round(boardBottom)}px`)
        : [];
      // Controls inside the fixed bars must stay reachable: the bar itself fits the screen or scrolls.
      window.scrollTo(0, y);
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        small: controls
          .filter((el) => {
            const b = el.getBoundingClientRect();
            return b.width < 44 || b.height < 44;
          })
          .map(label),
        clipped: controls
          .filter((el) => {
            const b = el.getBoundingClientRect();
            return b.left < -0.5 || b.right > window.innerWidth + 0.5;
          })
          .map(label),
        covered,
      };
    });
    const problems: string[] = [];
    if (r.scrollWidth > r.innerWidth) problems.push(`horizontal scroll (${r.scrollWidth}px > ${r.innerWidth}px)`);
    if (r.small.length) problems.push(`touch targets under 44px: ${[...new Set(r.small)].join(' | ')}`);
    if (r.clipped.length) problems.push(`controls clipped at the screen edge: ${[...new Set(r.clipped)].join(' | ')}`);
    if (r.covered.length) problems.push(`fixed bar covers the board's last row: ${r.covered.join(' | ')}`);
    const file = path.join(OUT, this.vp.name, `${this.flow}-${String(++this.shots).padStart(3, '0')}-${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    const rel = path.relative(process.cwd(), file);
    if (problems.length) this.record(`audit ${name}`, false, problems.join('; '), rel);
    return rel;
  }

  // ----- Input -----

  /** Activates a control: tap (phone), or focus + Enter (desktop keyboard; falls back to a click if not focusable). */
  async press(locator: Locator, what: string) {
    await locator.waitFor({ state: 'visible', timeout: 20_000 });
    if (this.vp.keyboard) {
      const focusable = await locator.evaluate((el) => (el as HTMLElement).tabIndex >= 0 && !(el as HTMLButtonElement).disabled);
      if (focusable) {
        await locator.focus();
        await this.page.keyboard.press('Enter');
        return;
      }
      this.keyboardGap('control not focusable', what);
      await locator.click();
      return;
    }
    if (this.vp.touch) await locator.tap();
    else await locator.click();
  }
  button(name: RegExp | string): Locator {
    return this.page.getByRole('button', { name }).first();
  }
  keyboardGap(kind: string, what: string) {
    if (!keyboardGaps.has(kind)) keyboardGaps.set(kind, new Set());
    keyboardGaps.get(kind)!.add(what);
  }

  /**
   * A board point (by ICCS name). Keyboard: the board is one tab stop with a roving tabIndex (Board.tsx): focus the
   * tab stop, walk to the point with the arrow keys (screen directions, so turned for Black), check the focused point's
   * accessible name, then Enter. A board with no tab stop, or arrows that do not reach the point, is a keyboard gap.
   */
  async point(sq: string, what: string) {
    const cell = this.page.getByRole('gridcell', { name: new RegExp(`^${sq},`) }).first();
    if (this.vp.keyboard) {
      if (await this.pointByKeyboard(sq)) return;
      this.keyboardGap('board points not keyboard-operable', what);
      await cell.click();
      return;
    }
    if (this.vp.touch) await cell.tap();
    else await cell.click();
  }
  private async pointByKeyboard(sq: string): Promise<boolean> {
    const board = this.page.locator('svg[role="grid"]').filter({ has: this.page.locator('[role="gridcell"][tabindex="0"]') }).first();
    if ((await board.count()) === 0) return false;
    const stop = board.locator('[role="gridcell"][tabindex="0"]').first();
    await stop.focus();
    const flipped = (await board.getAttribute('data-orientation')) === 'black';
    const focused = async () => this.page.evaluate(() => (document.activeElement?.getAttribute('aria-label') ?? '').split(',')[0]);
    const target = parseSquare(sq);
    for (let guard = 0; guard < 20; guard++) {
      const name = await focused();
      if (name === sq) {
        await this.page.keyboard.press('Enter');
        return true;
      }
      if (!/^[a-i]\d$/.test(name)) return false;
      const at = parseSquare(name);
      const df = (target % 9) - (at % 9);
      const dr = Math.floor(target / 9) - Math.floor(at / 9);
      // Screen right = file up (Red at the bottom) / file down (Black); screen up = rank up (Red) / rank down (Black).
      const key = df !== 0 ? (df > 0 !== flipped ? 'ArrowRight' : 'ArrowLeft') : dr > 0 !== flipped ? 'ArrowUp' : 'ArrowDown';
      await this.page.keyboard.press(key);
    }
    return false;
  }

  /** Plays a move (`h2-e2`): the keyboard picker on desktop when the screen has one, else two taps. */
  async move(key: string, what: string) {
    const [from, to] = key.split('-');
    const picker = this.page.getByTestId('move-picker').first();
    if (this.vp.keyboard && (await picker.count()) > 0 && (await picker.isVisible())) {
      const open = await picker.evaluate((el) => (el as HTMLDetailsElement).open);
      if (!open) {
        await picker.locator('summary').focus();
        await this.page.keyboard.press('Enter');
      }
      const selects = picker.locator('select');
      await this.chooseByKeyboard(selects.nth(0), String(parseSquare(from)), what);
      await this.chooseByKeyboard(selects.nth(1), String(parseSquare(to)), what);
      await this.press(picker.getByRole('button', { name: en('picker.play') }), what);
      return;
    }
    // No picker (move items): the board's own keyboard (roving focus, arrows + Enter) enters the move.
    await this.point(from, what);
    await this.point(to, what);
  }

  /** Native select by arrow keys (Chromium changes a closed select's value on ArrowDown); verified. */
  private async chooseByKeyboard(select: Locator, value: string, what: string) {
    await select.focus();
    const target = await select.evaluate((el, v) => [...(el as HTMLSelectElement).options].findIndex((o) => o.value === v), value);
    if (target < 0) throw new Error(`option ${value} not offered (${what})`);
    let current = await select.evaluate((el) => (el as HTMLSelectElement).selectedIndex);
    for (let guard = 0; current !== target && guard < 120; guard++) {
      await this.page.keyboard.press(current < target ? 'ArrowDown' : 'ArrowUp');
      current = await select.evaluate((el) => (el as HTMLSelectElement).selectedIndex);
    }
    if (current !== target) {
      this.keyboardGap('select not operable by arrow keys', what);
      await select.selectOption(value);
    }
  }

  // ----- Reading the screen -----

  async boardKey(): Promise<string> {
    const labels = await this.page.$$eval('[role="gridcell"]', (els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
    return boardKeyFromLabels(labels);
  }
  async prompt(): Promise<string> {
    const p = this.page.getByTestId('prompt').first();
    return (await p.count()) > 0 ? ((await p.textContent()) ?? '').trim() : '';
  }
  /** The feedback title on screen (footer alert), or null. */
  async alert(): Promise<string | null> {
    const a = this.page.locator('footer [role="alert"]').first();
    if ((await a.count()) === 0 || !(await a.isVisible())) return null;
    return ((await a.locator('p').first().textContent()) ?? '').trim();
  }
  async waitAlert(timeoutMs = 60_000): Promise<string> {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const a = await this.alert();
      if (a) return a;
      await sleep(120);
    }
    throw new Error('no feedback appeared');
  }

  /** Waits until the screen shows one of the candidates (board + prompt), or a `stop` selector. */
  async waitItem(candidates: readonly KeyedItem[], stop?: string, timeoutMs = 30_000): Promise<KeyedItem | 'stop'> {
    const end = Date.now() + timeoutMs;
    let last = '';
    while (Date.now() < end) {
      if (stop && (await this.page.locator(stop).count()) > 0) return 'stop';
      const prompt = await this.prompt();
      if (prompt && (await this.alert()) === null) {
        const board = await this.boardKey();
        const found = matchItem(candidates, board, prompt);
        if (found.length >= 1) return found[0];
        last = `prompt "${prompt.slice(0, 60)}"`;
      }
      await sleep(150);
    }
    throw new Error(`no expected item on screen (${last || 'no prompt'})`);
  }

  // ----- Answering -----

  /** Answers the item on screen. `ctx`: in a lesson a wrong answer is retried; in an assessment it moves on. */
  async answer(item: KeyedItem, mode: Mode, ctx: 'lesson' | 'assessment'): Promise<void> {
    const ex = item.ex;
    const id = ex.id ?? item.where;
    const colour = ex.side ?? 'red';
    const shot = await this.audit(`${id}-${ex.type}`);
    this.record(`${id} (${ex.type}) shown`, true, undefined, shot, colour);
    switch (ex.type) {
      case 'learn':
        await this.press(this.button(en('lesson.continue')), `${id} learn`);
        return;
      case 'play':
        await this.playTask(ex, id, colour);
        return;
      case 'line':
        await this.playLine(ex, id, mode, ctx);
        return;
    }
    await this.give(ex, mode, id);
    const title = await this.waitAlert();
    const fbShot = await this.audit(`${id}-feedback-${mode}`);
    const right = title === en('feedback.correct') || title === en('decision.title.sound');
    this.record(`${id} answered ${mode}: "${title}"`, mode === 'right' ? right : !right, undefined, fbShot, colour);
    if (right) {
      await this.press(this.button(en('lesson.continue')), `${id} continue`);
      return;
    }
    if (ctx === 'assessment') {
      await this.press(this.button(en('lesson.continue')), `${id} continue after a wrong answer`);
      return;
    }
    // Lesson: retry, then answer right.
    await this.press(this.button(en('lesson.retry')), `${id} retry`);
    await sleep(200);
    await this.give(ex, 'right', id);
    const again = await this.waitAlert();
    const ok = again === en('feedback.correct') || again === en('decision.title.sound');
    this.record(`${id} retried right: "${again}"`, ok, undefined, undefined, colour);
    await this.press(this.button(ok ? en('lesson.continue') : en('lesson.retry')), `${id} continue`);
  }

  private async give(ex: Exercise, mode: Mode, id: string) {
    switch (ex.type) {
      case 'decision':
        await this.move(decisionMove(ex as DecisionExercise, mode), `${id} decision`);
        return;
      case 'move':
        await this.move(moveAnswer(ex as MoveExercise, mode), `${id} move`);
        return;
      case 'select-squares':
        for (const sq of selection(ex as SelectSquaresExercise, mode)) await this.point(sq, `${id} select-squares`);
        await this.press(this.button(new RegExp(`^${en('lesson.check')}`)), `${id} check`);
        return;
      case 'choice': {
        const labels = choiceLabels(ex as ChoiceExercise, mode);
        const options = this.page.getByTestId('choice-options').locator('[role="radio"], [role="checkbox"]');
        const texts = await options.allTextContents();
        for (const label of labels) {
          const i = texts.findIndex((t) => t.includes(label));
          if (i < 0) throw new Error(`${id}: option "${label}" not shown (${texts.join(' / ')})`);
          if (this.vp.keyboard) await this.page.keyboard.press(String(i + 1));
          else await this.press(options.nth(i), `${id} option`);
        }
        await this.press(this.button(new RegExp(`^${en('lesson.check')}`)), `${id} check`);
        return;
      }
      default:
        throw new Error(`${id}: cannot answer type ${ex.type}`);
    }
  }

  /** A line: follow the tree node by node (target moves that continue), the first move wrong when `mode` is wrong. */
  private async playLine(ex: LineExercise, id: string, mode: Mode, ctx: 'lesson' | 'assessment') {
    const nodes = lineNodes(ex);
    let wrongPending = mode === 'wrong';
    let lastBoard = '';
    const end = Date.now() + 120_000;
    let moves = 0;
    while (Date.now() < end) {
      const title = await this.alert();
      if (title) {
        const shot = await this.audit(`${id}-line-${moves}`);
        if (title === en('line.done')) {
          this.record(`${id} line complete after ${moves} learner move(s)`, true, undefined, shot, ex.side);
          await this.press(this.button(en('lesson.continue')), `${id} continue`);
          return;
        }
        if (title === en('feedback.incorrect') || title === en('decision.title.dubious')) {
          this.record(`${id} wrong first move: "${title}"`, true, undefined, shot, ex.side);
          if (ctx === 'assessment') {
            await this.press(this.button(en('lesson.continue')), `${id} continue`);
            return;
          }
          await this.press(this.button(en('lesson.retry')), `${id} retry`);
          lastBoard = '';
          await sleep(200);
          continue;
        }
        this.fail(`${id} line`, `unexpected feedback "${title}"`);
        await this.press(this.button(en('lesson.continue')), `${id} continue`);
        return;
      }
      const picker = this.page.getByTestId('move-picker').first();
      if ((await picker.count()) > 0 && (await picker.isVisible())) {
        const board = await this.boardKey();
        if (board !== lastBoard) {
          const node = nodes.get(board);
          if (!node) throw new Error(`${id}: the board matches no learner node of the tree (left the tree)`);
          const key = lineMove(node, wrongPending ? 'wrong' : 'right');
          wrongPending = false;
          lastBoard = board;
          await this.move(key, `${id} line`);
          moves += 1;
        }
      }
      await sleep(150);
    }
    throw new Error(`${id}: the line did not finish`);
  }

  /**
   * A practical task: the reference player's moves (from the game state the app saves), until the result panel.
   * `fault`: every analysis answer is `not-checked` for the whole run (the run must end "Not assessed").
   */
  async playTask(ex: PlayExercise, id: string, colour: string, opts: { fault?: boolean } = {}): Promise<string> {
    const page = this.page;
    if (opts.fault) await page.evaluate(() => ((window as unknown as { __uiFault: { active: boolean } }).__uiFault.active = true));
    const end = Date.now() + 360_000;
    let lastLen = -1;
    let learnerMoves = 0;
    let disclosureChecked = false;
    while (Date.now() < end) {
      const panelTitle = await this.alert();
      if (panelTitle) {
        if (panelTitle === en('play.refuse.thirdRepetition')) {
          this.record(`${id} learner's third repetition refused`, true);
          await this.press(this.button(en('play.refuse.ok')), `${id} refusal ok`);
          continue;
        }
        if (panelTitle === en('play.warn.ownPerpetualCheck')) {
          this.record(`${id} own perpetual check warning shown`, true);
          await this.press(this.button(en('play.warn.playAnyway')), `${id} play anyway`);
          continue;
        }
        const shot = await this.audit(`${id}-result${opts.fault ? '-fault' : ''}`);
        const lines = (await page.locator('[data-testid="feedback-panel"] [role="alert"]').first().innerText()).replace(/\s+/g, ' ').slice(0, 300);
        if (opts.fault) {
          const injected = await page.evaluate(() => (window as unknown as { __uiFault: { injected: number } }).__uiFault.injected);
          await page.evaluate(() => ((window as unknown as { __uiFault: { active: boolean } }).__uiFault.active = false));
          const ok = panelTitle === en('play.result.voidedTitle');
          this.record(`${id} run with fault injection (${injected} analysis answers made not-checked) → "${panelTitle}"`, ok, lines, shot, colour);
        } else {
          const known = [en('play.result.pass'), en('play.result.fail'), en('play.result.voidedTitle')].includes(panelTitle);
          this.record(`${id} task finished after ${learnerMoves} learner move(s) → "${panelTitle}"`, known && panelTitle !== en('play.result.voidedTitle'), lines, shot, colour);
        }
        return panelTitle;
      }
      const picker = page.getByTestId('move-picker').first();
      if ((await picker.count()) > 0 && (await picker.isVisible())) {
        if (!disclosureChecked) {
          disclosureChecked = true;
          const d = page.getByTestId('play-disclosure');
          if ((await d.count()) > 0) {
            await this.press(d.locator('summary'), `${id} partner disclosure`);
            await this.audit(`${id}-disclosure`);
            await this.press(d.locator('summary'), `${id} partner disclosure`);
          }
        }
        const stored = await page.evaluate((taskId) => {
          const raw = localStorage.getItem('duohuygo:play.inProgress.v1');
          return raw ? (JSON.parse(raw) as Record<string, unknown>)[taskId] : undefined;
        }, id);
        const len = (stored as { record?: { moves?: unknown[] } } | undefined)?.record?.moves?.length ?? -1;
        if (stored !== undefined && len !== lastLen) {
          const key = await referenceMove(ex, stored);
          if (!key) throw new Error(`${id}: the reference player has no move`);
          lastLen = len;
          if (learnerMoves === 0) await this.audit(`${id}-first-move`);
          await this.move(key, `${id} play`);
          learnerMoves += 1;
        }
      }
      await sleep(200);
    }
    throw new Error(`${id}: the task did not finish`);
  }

  // ----- Screens -----

  async home() {
    await this.page.waitForSelector('[data-lesson-id]', { timeout: 20_000 });
  }
  lessonButton(id: string): Locator {
    return this.page.locator(`[data-lesson-id="${id}"] button`).first();
  }
  async lessonState(id: string): Promise<string> {
    return (await this.lessonButton(id).getAttribute('aria-label')) ?? '';
  }
  async unitButton(unitId: string, name: string): Promise<boolean> {
    return (await this.page.getByTestId(`unit-status-${unitId}`).getByRole('button', { name, exact: true }).count()) > 0;
  }
  async unitText(unitId: string): Promise<string> {
    return ((await this.page.getByTestId(`unit-status-${unitId}`).innerText()) ?? '').replace(/\s+/g, ' ').trim();
  }

  /** Opens a lesson from Home and plays it to the completion screen. `plan`: items answered wrong first. */
  async lesson(lessonId: string, plan: Record<string, Mode> = {}, task: { fault?: string } = {}) {
    await this.home();
    await this.press(this.lessonButton(lessonId), `open ${lessonId}`);
    const items = lessonItems(lessonId);
    for (const [i, expected] of items.entries()) {
      const got = await this.waitItem(items.slice(i));
      if (got === 'stop' || got.ex !== expected.ex) {
        this.fail(`${lessonId} item ${i + 1}`, `expected ${expected.ex.id}, saw ${got === 'stop' ? 'nothing' : got.ex.id}`);
        throw new Error('lesson order');
      }
      if (expected.ex.type === 'play' && task.fault === expected.ex.id) {
        const ex = expected.ex as PlayExercise;
        const shot = await this.audit(`${ex.id}-play`);
        this.record(`${ex.id} (play) shown`, true, undefined, shot, ex.side);
        const voided = await this.playTask(ex, ex.id!, ex.side ?? 'red', { fault: true });
        if (voided === en('play.result.voidedTitle')) {
          await this.press(this.button(en('play.newGame')), `${ex.id} new game after a voided run`);
          await this.playTask(ex, ex.id!, ex.side ?? 'red');
          await this.press(this.button(en('lesson.continue')), `${ex.id} continue`);
        } else await this.press(this.button(en('lesson.continue')), `${ex.id} continue`);
        continue;
      }
      if (expected.ex.type === 'play') {
        await this.answer(expected, 'right', 'lesson');
        await this.press(this.button(en('lesson.continue')), `${expected.ex.id} continue`);
        continue;
      }
      await this.answer(expected, plan[expected.ex.id ?? ''] ?? 'right', 'lesson');
      this.assertNoReload(`${lessonId} ${expected.ex.id}`);
    }
    await this.page.getByRole('heading', { name: en('done.title') }).waitFor({ timeout: 30_000 });
    const shot = await this.audit(`${lessonId}-complete`);
    this.record(`${lessonId} completed`, true, undefined, shot);
    await this.press(this.button(en('lesson.continue')), `${lessonId} completion continue`);
    await this.home();
    const state = await this.lessonState(lessonId);
    this.record(`${lessonId} shown completed on Home`, state.includes(en('home.lessonState.completed')), state);
  }

  /** An assessment from its intro to the result screen; returns the result title. */
  async assessment(candidates: readonly KeyedItem[], mode: Mode, label: string): Promise<{ title: string; lines: string }> {
    const page = this.page;
    await page.getByTestId('assessment-intro').waitFor({ timeout: 20_000 });
    const intro = await this.audit(`${label}-intro`);
    this.record(`${label} intro`, true, ((await page.getByTestId('assessment-intro').innerText()) ?? '').replace(/\s+/g, ' ').slice(0, 200), intro);
    await this.press(this.button(en('assess.intro.start')), `${label} start`);
    const done = new Set<Exercise>();
    let n = 0;
    for (;;) {
      const got = await this.waitItem(
        candidates.filter((c) => !done.has(c.ex)),
        '[data-testid="assessment-result"]',
        120_000,
      );
      if (got === 'stop') break;
      done.add(got.ex);
      n += 1;
      if (got.ex.type === 'play') await this.answer(got, 'right', 'assessment').then(() => this.press(this.button(en('lesson.continue')), `${got.ex.id} continue`));
      else await this.answer(got, mode, 'assessment');
      this.assertNoReload(`${label} item ${n}`);
    }
    const title = ((await page.getByTestId('assessment-title').textContent()) ?? '').trim();
    const lines = ((await page.getByTestId('assessment-lines').innerText()) ?? '').replace(/\s+/g, ' ').trim();
    const shot = await this.audit(`${label}-result`);
    this.record(`${label}: ${n} item(s) answered ${mode} → "${title}"`, true, lines.slice(0, 400), shot);
    await this.press(this.button(en('jump.back')), `${label} back`);
    return { title, lines };
  }
}

// ---------- Flows ----------

async function a03Lessons(f: Flow) {
  await f.lesson('a03l1', { 'a03l1-02': 'wrong', 'a03l1-03': 'wrong' });
  await f.lesson('a03l2', { 'a03l2-02': 'wrong' });
  await f.lesson('a03l3');
}

/** a03 unit check answered wrong → "not mastered yet" → remediation practice → retake answered right → mastered. */
async function checkCycle(f: Flow) {
  const page = f.page;
  await f.press(page.getByTestId('unit-status-a03').getByRole('button', { name: en('unit.check.start'), exact: true }), 'a03 unit check');
  const check = [...poolItems('a03-check'), ...poolItems('b08-check'), ...poolItems('i01-check')];
  const failed = await f.assessment(check, 'wrong', 'a03-check-1');
  f.record('a03 check 1 failed', failed.title === en('assess.result.notMastered'), failed.title);
  await f.home();
  const afterFail = await f.unitText('a03');
  f.record(
    'Home: a03 "not mastered yet" + remediation offered, no retake yet',
    afterFail.includes(en('unit.status.notMastered')) && (await f.unitButton('a03', en('unit.check.remediation'))) && !(await f.unitButton('a03', en('unit.check.start'))),
    afterFail,
    await f.audit('home-a03-check-failed'),
  );

  // Remediation practice (no hearts): the G1/G0 items not right first time + the misconception cards.
  await f.press(page.getByTestId('unit-status-a03').getByRole('button', { name: en('unit.check.remediation'), exact: true }), 'a03 remediation');
  const a03Items = previewUnits.find((u) => u.id === 'a03')!.lessons.flatMap((l) => l.exercises.map((ex) => keyed(ex, l.id)));
  const seen: string[] = [];
  for (;;) {
    const got = await f.waitItem(
      a03Items.filter((c) => !seen.includes(c.ex.id ?? '')),
      `h2:text-is("${en('done.title')}")`,
    );
    if (got === 'stop') break;
    seen.push(got.ex.id ?? '');
    await f.answer(got, 'right', 'lesson');
  }
  const remShot = await f.audit('a03-remediation-complete');
  const expectedRem = ['a03l1-02', 'a03l1-03', 'a03l2-02'];
  f.record(`a03 remediation practised: ${seen.join(', ')}`, expectedRem.every((id) => seen.includes(id)), `expected at least ${expectedRem.join(', ')}`, remShot);
  await f.press(f.button(en('lesson.continue')), 'remediation completion');
  await f.home();
  const afterRem = await f.unitText('a03');
  f.record('Home: a03 retake offered after the remediation', await f.unitButton('a03', en('unit.check.start')), afterRem);

  // Retake answered right → mastered (unit check).
  await f.press(page.getByTestId('unit-status-a03').getByRole('button', { name: en('unit.check.start'), exact: true }), 'a03 unit check retake');
  const passed = await f.assessment(check, 'right', 'a03-check-2');
  f.record('a03 check 2 (retake) mastered', passed.title === en('assess.result.mastered'), passed.title);
  await f.home();
  const afterPass = await f.unitText('a03');
  f.record('Home: a03 "Mastered (unit check)"', afterPass.includes(en('unit.status.mastered.check')), afterPass, await f.audit('home-a03-mastered'));
}

async function courseFlow(f: Flow) {
  await f.home();
  f.record('Home (course preview)', true, undefined, await f.audit('home'));
  const units = previewUnits.map((u) => u.id).join(', ');
  f.record(`preview path units: ${units}`, units === 'b09, i08, a03, a07');

  await f.lesson('b09l3');
  await f.lesson('i08l3');
  await a03Lessons(f);
  const a03 = await f.unitText('a03');
  const shot = await f.audit('home-a03-lessons-done');
  // W1: the real preview cannot build the a03 check (its interleaved items belong to units outside the path).
  const available = (await f.page.getByTestId('unit-status-a03').getByRole('button', { name: en('unit.check.start'), exact: true }).count()) > 0;
  f.record('W1: a03 unit check offered in the real preview after the lessons', available, a03, shot);
  if (available) await checkCycle(f);

  // a07l4 with a voided run of a07-g1 (fault injection), then a new game.
  await f.lesson('a07l4', {}, { fault: 'a07-g1' });
  const a07 = await f.unitText('a07');
  f.record('Home: a07 status after a07l4', a07.includes(en('unit.status.completed', { done: 1, total: 1 })), a07, await f.audit('home-end'));
}

/** The check cycle on the fixture page with stub units b08 / i01 in the path (see scripts/ui-fixtures/preview-fixture.tsx). */
async function checkFlow(f: Flow) {
  await f.home();
  await a03Lessons(f);
  await checkCycle(f);
}

async function j2Flow(f: Flow) {
  const page = f.page;
  await f.home();
  const before = await f.lessonState('a07l4');
  f.record('a07l4 locked for a new learner', before.includes(en('home.lessonState.locked')), before);
  await f.press(f.lessonButton('a07l4'), 'jump to a07l4');
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  const text = ((await dialog.innerText()) ?? '').replace(/\s+/g, ' ');
  f.record('J2 dialog (a03 skipped)', text.includes('90'), text.slice(0, 300), await f.audit('j2-dialog'));
  await f.press(dialog.getByRole('button', { name: en('jump.start') }), 'J2 start');
  const r = await f.assessment(poolItems('pa'), 'right', 'j2-a03');
  f.record('J2 test-out of a03 passed', r.title === en('assess.placement.passed'), r.lines.slice(0, 300));
  await f.home();
  const a03 = await f.unitText('a03');
  const done = ['a03l1', 'a03l2', 'a03l3'];
  const states = await Promise.all(done.map((id) => f.lessonState(id)));
  f.record(
    'Home after J2: a03 lessons completed (placement) and a03 "Mastered (placement test)", a07l4 open',
    states.every((s) => s.includes(en('home.lessonState.completed'))) && a03.includes(en('unit.status.mastered.placement')) && !(await f.lessonState('a07l4')).includes(en('home.lessonState.locked')),
    `${a03} | ${states.join(' | ')}`,
    await f.audit('j2-home-after'),
  );
}

async function j1Flow(f: Flow) {
  const page = f.page;
  await f.home();
  const banner = page.getByTestId('placement-banner');
  await banner.waitFor({ timeout: 20_000 });
  f.record('J1 placement banner (fixture pool)', true, ((await banner.innerText()) ?? '').replace(/\s+/g, ' ').slice(0, 200), await f.audit('j1-banner'));
  await f.press(banner.getByRole('button', { name: en('placement.start') }), 'J1 start');
  const items = j1FixtureItems().map((ex) => keyed(ex, 'j1-fixture'));
  const r = await f.assessment(items, 'right', 'j1-fixture');
  f.record('J1 result screen (fixture): passed', r.title === en('assess.placement.passed'), r.lines.slice(0, 300));
  await f.home();
  const b09 = await f.unitText('b09');
  f.record(
    'Home after J1: b09l3 completed, b09 "Mastered (placement test)", applied',
    (await f.lessonState('b09l3')).includes(en('home.lessonState.completed')) && b09.includes(en('unit.status.mastered.placement')) && b09.includes(en('unit.status.applied.all')),
    b09,
    await f.audit('j1-home-after'),
  );
}

// ---------- Main ----------

async function runOne(browser: Browser, vp: Viewport, flowName: string, base: string, fixtureBase: string) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.touch ? 2 : 1,
    isMobile: vp.touch,
    hasTouch: vp.touch,
    serviceWorkers: 'block',
  });
  await ctx.addInitScript({ content: pageHooks(SEED) });
  const page = await ctx.newPage();
  const f = new Flow(page, vp, flowName);
  const t0 = Date.now();
  try {
    await page.goto(flowName === 'j1' ? `${fixtureBase}preview-fixture.html?pools=j1` : flowName === 'check' ? `${fixtureBase}preview-fixture.html?stubs=b08,i01` : base);
    if (flowName === 'course') await courseFlow(f);
    else if (flowName === 'check') await checkFlow(f);
    else if (flowName === 'j2') await j2Flow(f);
    else if (flowName === 'j1') await j1Flow(f);
    else throw new Error(`unknown flow ${flowName}`);
    f.assertNoReload(`${flowName} end`);
    f.record(`flow ${flowName} finished in ${Math.round((Date.now() - t0) / 1000)} s`, true);
  } catch (e) {
    const file = path.join(OUT, vp.name, `${flowName}-crash.png`);
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});
    f.record(`flow ${flowName} crashed`, false, e instanceof Error ? e.message : String(e), path.relative(process.cwd(), file));
  } finally {
    await ctx.close();
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const vp of VIEWPORTS) mkdirSync(path.join(OUT, vp.name), { recursive: true });
  if (BUILD) {
    console.log('building the course preview (VITE_COURSE_PREVIEW=1) and the J1 fixture page');
    execSync('npx vite build --outDir ui-check-output/preview-dist --emptyOutDir --logLevel error', { stdio: 'inherit', env: { ...process.env, VITE_COURSE_PREVIEW: '1' } });
    execSync('npx vite build --config scripts/ui-fixtures/preview-fixture.config.mjs --logLevel error', { stdio: 'inherit' });
  }
  const servers: ChildProcess[] = [
    spawn('npx', ['vite', 'preview', '--outDir', 'ui-check-output/preview-dist', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true }),
    spawn('npx', ['vite', 'preview', '--config', 'scripts/ui-fixtures/preview-fixture.config.mjs', '--port', String(FIXTURE_PORT), '--strictPort'], { stdio: 'ignore', detached: true }),
  ];
  const base = `http://localhost:${PORT}/`;
  const fixtureBase = `http://localhost:${FIXTURE_PORT}/`;
  let browser: Browser | undefined;
  try {
    await waitForServer(base);
    await waitForServer(`${fixtureBase}preview-fixture.html`);
    browser = await loadPlaywright().chromium.launch();
    const jobs = VIEWPORTS.flatMap((vp) => FLOWS.map((flow) => ({ vp, flow })));
    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        await runOne(browser!, job.vp, job.flow, base, fixtureBase);
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, jobs.length) }, worker));
  } catch (e) {
    failures.push(`walkthrough crashed: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    await browser?.close();
    for (const s of servers) {
      try {
        process.kill(-s.pid!, 'SIGTERM');
      } catch {
        // already gone
      }
    }
  }
  const gaps = Object.fromEntries([...keyboardGaps].map(([k, v]) => [k, [...v].sort()]));
  writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ seed: SEED, viewports: VIEWPORTS.map((v) => v.name), flows: FLOWS, results, keyboardGaps: gaps, failures }, null, 2));
  if (keyboardGaps.size > 0) {
    console.log('\nKeyboard gaps (done with the mouse instead):');
    for (const [k, v] of Object.entries(gaps)) console.log(`- ${k}: ${v.join(', ')}`);
    // Pilot exit criterion 1 asks for keyboard play: a step without a keyboard way fails the walkthrough (finding W2).
    for (const [k, v] of Object.entries(gaps)) failures.push(`W2 keyboard: ${k} (${v.join(', ')})`);
  }
  if (failures.length) {
    console.error(`\nUI WALKTHROUGH FAILED (${failures.length}):\n- ${failures.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`\nUI WALKTHROUGH PASSED (${VIEWPORTS.map((v) => v.name).join(', ')}; flows ${FLOWS.join(', ')}). Results: ${path.join(OUT, 'results.json')}`);
}

await main();
