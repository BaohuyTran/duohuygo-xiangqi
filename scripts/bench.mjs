// Phone-cost bench driver (S2.6; results in docs/curriculum-upgrade/measurements.md).
//
//   npm run bench                      build the bench page, run it in headless Chromium at 1×, 4×, 6×
//   npm run bench -- --rates 1,4       other throttling factors
//   npm run bench -- --quick           fewer runs, no depth-3 rows, shorter game (smoke run, ~1 min)
//   npm run bench -- --no-build        reuse ui-check-output/bench-dist (also skips the type-check)
//   npm run bench -- --serve           serve the page on the local network for a REAL phone (no Chromium):
//                                      open the printed http://<LAN IP>:4199/bench.html on the phone
//
// The page (scripts/bench/, own Vite config, never in the app build) runs every workload through the
// app's real analysis client and Worker and the real src/play partners; see scripts/bench/bench.ts.
//
// THROTTLED CHROMIUM IS A PROXY, NOT A PHONE (04 R6). CDP `Emulation.setCPUThrottlingRate` does not
// reach dedicated Workers in this Chromium ("Operation is only supported for pages, not workers"),
// so throttling is done the way DevTools does it for the main thread, but for the whole renderer
// process: a small child process duty-cycles every renderer with SIGSTOP/SIGCONT (runs period/rate ms
// of every --period ms, default 10). Linux/macOS only. Each run prints the factor it actually got
// (main-thread spin and a Worker search, against the 1× run).
//
// Outputs (git-ignored): ui-check-output/bench/bench-<rate>x.{txt,json} and summary.txt.
// Playwright is NOT a project dependency: like scripts/ui-check.mjs it uses a global `playwright`.
// Exits 1 when the page fails or the client checks fail (cold start, shared client, timeout →
// terminate → restart, Worker mode); timings never fail the run.
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { networkInterfaces } from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);
const RATES = arg('rates', '1,4,6').split(',').map(Number);
const QUICK = has('quick');
const PORT = Number(arg('port', '4199'));
const PERIOD = Number(arg('period', '10'));
const OUT = path.resolve(arg('out', path.join('ui-check-output', 'bench')));
const CONFIG = 'scripts/bench/vite.config.mjs';
const URL_PATH = `http://127.0.0.1:${PORT}/bench.html`;

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const id of ['playwright', '@playwright/test']) {
    try {
      return require(id);
    } catch {
      // try the next location
    }
  }
  return require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
}

if (!has('no-build')) {
  // The app's `tsc -b` does not include scripts/: type-check the bench page here.
  console.log('- type-checking the bench page (scripts/bench/tsconfig.json)');
  execSync('npx tsc -p scripts/bench/tsconfig.json', { stdio: 'inherit' });
  console.log('- building the bench page (scripts/bench/vite.config.mjs → ui-check-output/bench-dist)');
  execSync(`npx vite build --config ${CONFIG} --logLevel warn`, { stdio: 'inherit' });
}

// A tiny static server for the built page (in-process: no `vite preview` child that other tools'
// cleanup could stop mid-run). --serve binds every interface so a phone on the same network can load it.
const DIST = path.resolve('ui-check-output', 'bench-dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json' };
const server = createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname).replace(/^\/+/, '') || 'bench.html';
  const file = path.resolve(DIST, rel);
  if (!file.startsWith(DIST + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(PORT, has('serve') ? '0.0.0.0' : '127.0.0.1', resolve);
});
const stopServer = () => server.close();

if (has('serve')) {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
  console.log(`\nBench page for a real phone (same Wi-Fi as this computer):`);
  for (const ip of ips) console.log(`  http://${ip}:${PORT}/bench.html`);
  console.log('Press Ctrl-C to stop.');
  process.on('SIGINT', () => {
    stopServer();
    process.exit(0);
  });
  await new Promise(() => {}); // the server keeps running until Ctrl-C
}

/** Child process that duty-cycles the given pids: runs `period / rate` ms of every `period` ms. */
const CYCLER = `
const pids = process.argv[1].split(',').map(Number);
const rate = Number(process.argv[2]);
const period = Number(process.argv[3]);
const ia = new Int32Array(new SharedArrayBuffer(4));
const sleep = (ms) => Atomics.wait(ia, 0, 0, ms);
const sig = (s) => { for (const p of pids) { try { process.kill(p, s); } catch {} } };
const on = period / rate;
for (;;) {
  sig('SIGCONT'); sleep(on); sig('SIGSTOP'); sleep(period - on);
  try { process.kill(process.ppid, 0); } catch { sig('SIGCONT'); process.exit(0); }
}`;

function throttle(pids, rate) {
  if (rate <= 1 || pids.length === 0) return () => {};
  const child = spawn(process.execPath, ['-e', CYCLER, pids.join(','), String(rate), String(PERIOD)], { stdio: 'inherit' });
  return () => {
    child.kill('SIGKILL');
    for (const p of pids) {
      try {
        process.kill(p, 'SIGCONT');
      } catch {
        // gone
      }
    }
  };
}

const failures = [];
const fail = (m) => failures.push(m);
mkdirSync(OUT, { recursive: true });
const results = [];
let browser;
try {
  const { chromium } = loadPlaywright();
  browser = await chromium.launch();
  const cdp = await browser.newBrowserCDPSession();
  for (const rate of RATES) {
    const page = await browser.newPage();
    page.on('pageerror', (e) => fail(`${rate}×: uncaught exception: ${e.message}`));
    await page.goto(URL_PATH);
    await page.waitForFunction(() => typeof window.__benchRun === 'function', null, { timeout: 15_000 });
    const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
    const pids = processInfo.filter((p) => p.type === 'renderer').map((p) => p.id);
    console.log(`- ${rate}× (${rate === 1 ? 'no throttling' : `renderer pids ${pids.join(',')} duty-cycled`}) …`);
    const release = throttle(pids, rate);
    let out;
    try {
      out = await page.evaluate((quick) => window.__benchRun({ quick }), QUICK);
    } finally {
      release();
    }
    const { result, text } = out;
    const c = result.client;
    if (c.coldPing !== 'checked') fail(`${rate}×: cold-start ping ${c.coldPing}`);
    if (c.sharedClientPing !== 'checked') fail(`${rate}×: getAnalysisClient() ping ${c.sharedClientPing}`);
    if (c.timeoutDemo !== 'timeout') fail(`${rate}×: the 200 ms safety net did not fire (${c.timeoutDemo})`);
    if (c.restartsAfterTimeout < 1) fail(`${rate}×: no Worker restart after the timeout`);
    if (c.afterRestart !== 'checked') fail(`${rate}×: the restarted Worker did not answer (${c.afterRestart})`);
    if (c.mode !== 'worker' || c.fallback !== null) fail(`${rate}×: client left Worker mode (${c.mode}, ${c.fallback})`);
    results.push({ rate, result });
    const header = `PROXY RUN — headless Chromium, CPU throttled ${rate}× by renderer duty-cycling. NOT A PHONE.\n`;
    writeFileSync(path.join(OUT, `bench-${rate}x.txt`), header + text + '\n');
    writeFileSync(path.join(OUT, `bench-${rate}x.json`), JSON.stringify({ rate, proxy: true, ...result }, null, 1));
    console.log(header + text + '\n');
    await page.close();
  }
} catch (e) {
  fail(`bench crashed: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await browser?.close();
  stopServer();
}

// Summary: medians per rate side by side, plus the achieved throttling factors.
if (results.length) {
  const base = results.find((r) => r.rate === 1)?.result.calibration;
  const lines = ['PROXY — headless Chromium with CPU throttling, NOT a phone.', ''];
  for (const { rate, result } of results) {
    const cal = result.calibration;
    const fx = base ? ` (achieved: main ${(cal.mainThreadMs / base.mainThreadMs).toFixed(1)}×, Worker ${(cal.workerMs / base.workerMs).toFixed(1)}×)` : '';
    lines.push(`${rate}×${fx}: cold Worker start ${result.client.coldStartMs.toFixed(0)} ms, restart ping ${result.client.restartPingMs.toFixed(0)} ms, long tasks ${result.longTasks.count} (max ${result.longTasks.maxMs.toFixed(0)} ms), ${result.totalSeconds.toFixed(0)} s`);
  }
  const fmt = (ms) => (ms >= 10_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}`);
  lines.push('', `${'workload (median ms)'.padEnd(52)}${results.map((r) => `${r.rate}×`.padStart(9)).join('')}  notes (1× run)`);
  const first = results[0].result;
  for (const [i, row] of first.rows.entries()) {
    const cells = results.map((r) => fmt(r.result.rows[i].medianMs).padStart(9)).join('');
    const nc = Object.keys(row.notChecked).length ? ` not-checked ${JSON.stringify(row.notChecked)}` : '';
    lines.push(`${`${row.id} [${row.pieces}p]`.padEnd(52)}${cells}  req ${row.requests}, nodes ${row.nodes} → ${row.result}${nc}`);
  }
  for (const [i, d] of first.game.entries()) {
    const cells = results
      .map((r) => {
        const g = r.result.game[i];
        return `${fmt(g.medianMs)}/${fmt(g.meanMs)}/${fmt(g.maxMs)}/${fmt(g.totalMs)}`.padStart(22);
      })
      .join('');
    lines.push(`${d.id.slice(0, 50).padEnd(52)}${cells}  (median/mean/max per move, total; n=${d.n})`);
  }
  const summary = lines.join('\n');
  writeFileSync(path.join(OUT, 'summary.txt'), summary + '\n');
  console.log(summary);
}

if (failures.length) {
  console.error(`BENCH FAILED (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`\nBENCH DONE (proxy, not a phone). Results: ${OUT}`);
