# Phone-cost measurements and runtime budgets (S2.6)

Answers 04-architecture.md §2.5 / R6, 03-assessment.md UA5 (cost part), the input to 02 U6 and 03 UA7, and the
resist-mode / `forcing-attack(3)` questions of 06-backlog.md S2.6.

> **Phones are UNMEASURED.** Every number below comes from desktop headless Chromium, unthrottled or
> CPU-throttled. Throttled Chromium is a **proxy, not a phone** (04 R6). Until the owner runs the real-device
> steps in §5 on at least one Android and one iOS phone, every readiness report must say "phones unmeasured".

## 1. Method

- **Bench page:** `scripts/bench/` (`bench.html`, `bench.ts`, own `vite.config.mjs`; output in the git-ignored
  `ui-check-output/bench-dist/`, never in the app build). It uses the app's real client
  (`createAnalysisClient()` with the default Worker factory, i.e. `new Worker(new URL('./worker.ts', …), { type:
  'module' })`, plus one `getAnalysisClient()` ping) and the real `src/play` partners (`safeSparring`, `pressing`,
  `forcingAttack`, `bestDefence({ resist })`) choosing through the client. Node limits are the defaults
  (`DEFAULT_MAX_NODES` 20,000 per search, `DEFAULT_REQUEST_BUDGET` 50,000 per request) except the "A.1 raw" rows,
  which lift them to reproduce 04 §2.2's calls. The bench client's safety net is raised to `MAX_TIMEOUT_MS` (60 s)
  so raw costs are visible.
- **Timing:** one warm-up run, then the median of 5 runs (3 for depth-3 / depth-4 rows; 1 when the warm-up took
  over 5 s). Times are wall-clock on the page around the whole partner choice (requests + the main-thread policy
  logic). Game rows: per-move distribution over one seeded game.
- **Client checks in every run:** cold Worker start, `getAnalysisClient()` answer, a 200 ms safety net firing on a
  long search (`timeout` → Worker terminated → a new Worker answers), Worker mode kept, main-thread long tasks
  (PerformanceObserver, after the calibration spin).
- **Driver:** `npm run bench` (`scripts/bench.mjs`): builds the page, serves it from an in-process static server,
  runs headless Chromium at 1×, 4× and 6×. **Throttling method:** CDP `Emulation.setCPUThrottlingRate` does not
  reach dedicated Workers in this Chromium (verified: the main thread slowed 4–7×, the Worker not at all; on a
  worker target the command answers "Operation is only supported for pages, not workers"). The driver therefore
  duty-cycles the renderer process with SIGSTOP/SIGCONT (runs 1/rate of every 10 ms period), which slows the main
  thread and the Worker alike. Achieved factors are measured each run (main-thread spin, Worker `search(mid, 3)`).
  The 10 ms period quantises rows under ~20 ms at 4×/6× (they read 10–20 ms).
- **Machine and run:** every number in §2–§3 comes from ONE full `npm run bench` run, 2026-10-24 09:19–09:27 UTC
  (1× column 09:19, 4× 09:20–09:23, 6× 09:23–09:27). Intel Xeon @ 2.10 GHz, 4 vCPU, 15 GB RAM, Linux 6.18 (cloud
  container), HeadlessChrome 141.0.7390.37 (global Playwright). A parallel agent shared the machine (load average
  0.8–1.8), so this run is ~20–30 % slower at 1× than an earlier full run the same day and its short calibration is
  noisy (4×: main 4.4×, Worker 2.0×; 6×: main 8.9×, Worker 6.2×). The ratio of row medians is the better factor:
  over the 44 rows with ≥ 20 ms at 1×, the median ratio is **4.1× at 4×** and **5.9× at 6×**. Total time
  55 s / 181 s / 246 s.
- Full outputs of that run: `ui-check-output/bench/bench-{1,4,6}x.{txt,json}` and `summary.txt` (git-ignored;
  regenerate with `npm run bench`; numbers vary by roughly ±20 % between runs).

Positions: *start*; *mid* (04 §2.2, 37 moves); *opening-black* (Black to move after 1. C2=5); eight endgames from
the legacy content (8–16 pieces: `u15l3#3`, `u15l3#2`, `u14l1#1`, `u13l3#3`, `u12l2#3`, `u15l2#1`, the defend item
`u11l3#4`, and a constructed quiet 10-piece endgame) with the attacker to move (forcing-attack rows) and the
defender to move after the key move (resist rows); and, for resist mode's expensive case, six mate-in-4 positions
with **Black to move while it still has escapes** (`…/b`), where the k = 3 guard must prove "no mate within 3"
after most moves.

## 2. Results (median ms; PROXY — headless Chromium, not a phone; all columns from the run of §1)

| Workload | Pieces | 1× | 4× | 6× | Nodes / notes |
| --- | ---: | ---: | ---: | ---: | --- |
| **A.1 raw** `search(start, 2/3/4)` | 32 | 27 / 91 / 492 | 59 / 122 / 1,619 | 189 / 359 / 2,957 | 1,063 / 4,681 / 42,293 nodes (d = 4 exceeds the 20,000 per-search cap) |
| `search(mid, 2/3/4)` | 32 | 10 / 35 / 117 | 53 / 136 / 516 | 71 / 228 / 788 | 952 / 3,411 / 11,967 |
| `forced-wins(start / mid, 2)` | 32 | 2 / 1 | 10 / 9 | 11 / 10 | |
| `score-moves(mid, d)` material, all 37 moves, d = 2 / 3 | 32 | 27 / 365 | 106 / 1,738 | 156 / 2,527 | 2,394 / 36,209 |
| **Mate guard** `mate-distances(k = 2)`, all moves: mid / opening-black | 32 | 31 / 55 | 146 / 260 | 189 / 312 | 37 / 45 moves |
| `safety-guard` Advanced (h 2, k 2), one move | 32 | 19 | 82 | 116 | 1,272 |
| **`safe-sparring(2)`** mid / opening-black | 32 | 26 / 26 | 104 / 104 | 166 / 155 | 2,394 / 2,025 |
| **`pressing(2)`** mid / opening-black | 32 | 118 / 74 | 530 / 356 | 868 / 514 | 3,337 / 2,234 |
| **`forcing-attack(2)`** mid / opening-black (hand-over) | 32 | 3 / 2 | 11 / 11 | 21 / 20 | |
| `safe-sparring(3)` / `pressing(3)` mid | 32 | 420 / 1,523 | 1,550 / 5,847 | 2,267 / 7,667 | 36,209 / 41,922 |
| `forcing-attack(2)`, 8 endgames: max | 8–16 | 8 | 21 | 31 | |
| **`forcing-attack(3)`**, 8 legacy endgames: median of rows / max | 8–16 | 27 / 73 | 110 / 356 | 156 / 424 | max = `u12l2#3` (8 p) and `u15l3#2` (10 p) |
| **resist k = d = 2**, 8 endgames after the key move: max | 8–16 | 22 | 93 | 118 | |
| resist k = 3, d = 2, same: max | 8–16 | 203 | 834 | 808 | `u15l3#2`, quiet-10 |
| resist k = d = 3, same: max | 8–16 | 224 | 947 | 890 | |
| **resist k = d = 2, with escapes** (6 positions): max | 10–16 | 69 | 188 | 319 | ≤ 1,688 nodes |
| **resist k = d = 3, with escapes**: `u14l1#1/b` 10 p · `u15l1#1/b` 12 p · `u15l3#3/b` 12 p · `u15l3#2/b` 10 p · `u15l2#1/b` 16 p · `u15l2#4/b` 15 p | 10–16 | 351 · 458 · 1,091 · 1,281 · 1,339 · 1,897 | 1,561 · 2,134 · 4,550 · 5,204 · 6,091 · 8,492 | 2,250 · 3,185 · 7,101 · 5,356 · 8,046 · 11,700 | |
| `pressing(2)`, 8 endgames: max | 8–16 | 35 | 157 | 236 | |

Rows under ~20 ms at 4×/6× are quantised by the 10 ms throttling period.

Game (start position, Red `safe-sparring(2, 1.0)` vs Black `pressing(2)`, seed 2026, 30 plies = 15 moves each).
Per move **median / mean / max**, and the **measured total** over the 15 moves:

| Row | 1× | 4× | 6× | Notes |
| --- | --- | --- | --- | --- |
| `safe-sparring(2)` partner move | 29 / 33 / 73 ms; total 0.5 s | 127 / 155 / 312 ms; total 2.3 s | 188 / 193 / 426 ms; total 2.9 s | |
| `pressing(2)` partner move | 157 / 175 / 328 ms; total 2.6 s | 772 / 823 / 1,640 ms; total 12.3 s | 1,012 / 1,068 / 2,071 ms; total 16.0 s | no safety-net move |
| Post-game signals h = 2 (Advanced guard), per learner move | 33 / 38 / 94 ms; total 0.6 s | 156 / 197 / 598 ms; total 3.0 s | 188 / 247 / 732 ms; total 3.7 s | all checked |
| Post-game signals h = 3, per learner move | 129 / 151 / 443 ms; total 2.3 s | 596 / 659 / 1,757 ms; total 9.9 s | 739 / 909 / 2,687 ms; total 13.6 s | **1 of 15 not checked (node limit)** in every column |
| h = 2 + unanswered threat, per learner move | 35 / 46 / 135 ms; total 0.7 s | 124 / 170 / 452 ms; total 2.6 s | 218 / 249 / 678 ms; total 3.7 s | |

Node counts for the same 15 moves (device-independent, `executeRequest` in Node): h = 2 median 2,799 / max 8,651
nodes, all checked; h = 3 median 11,263 / max 38,133, and the one move not checked needs one search above the
20,000 per-search cap (all 15 checked with `maxNodes` 100,000).

Client: Worker start on a fresh client 12 / 21 / 27 ms (the first chunk load, served locally with the page already
loaded; a phone's first load from the service-worker cache is not measured); next answer after the safety net
19 / 51 / 53 ms; the safety net fired and the Worker restarted in all three columns; Worker mode kept. Main-thread
long tasks: 0 at 1× and 4×; **10 at 6× (max 184 ms)**, not attributed. The earlier full run had 0 at 6×, and the
duty-cycling stretches any main-thread task ~6–9×, so a task of ≥ ~6–8 ms desktop crosses 50 ms; the partners'
main-thread repetition filter costs ~0.5 ms desktop (measured in Node at ply 30). `npm run offline:check` keeps
checking ≤ 50 ms main-thread work per request (unthrottled); S2.12 should watch long tasks on the task screen.

## 3. Recommended decisions (proposed; the driver records them in DECISIONS.md)

The budget is 04 §7.5's "≤ ~300 ms desktop per Worker request" (here: the 1× column; 4×/6× show what a phone that
much slower would wait).

1. **Node caps:** keep `DEFAULT_MAX_NODES` = 20,000 per search and `DEFAULT_REQUEST_BUDGET` = 50,000 per request.
   Every d = 2 runtime workload used ≤ 3,400 nodes (partners) and ≤ 8,700 (h = 2 signals): ≥ 5× headroom, no
   node-limit 'not-checked' at d = 2 / h = 2 (node counts do not depend on the device). Keep `SYNC_BUDGET` = 1,500.
2. **Safety-net time:** keep `DEFAULT_TIMEOUT_MS` = 5 s for interactive requests. The slowest budgeted runtime
   request (`pressing(2)` in the game) took at most 2.1 s at 6× (mean 1.07 s), so the net (which voids an assessed
   run) keeps ~2.4× headroom on a phone 6× slower than this desktop; re-check with the real-device factor. Requests
   are now clamped to `MAX_TIMEOUT_MS` = 60 s (client.ts).
3. **h = 3 post-game signals (03 UA5, cost part): do not adopt for the pilot; every runtime and post-game signal
   stays at h = 2.** h = 3 costs ~4× h = 2 (mean 151 ms / max 443 ms per move desktop; mean 909 ms / max 2.7 s at 6×;
   measured 15-move totals 2.3 / 9.9 / 13.6 s at 1× / 4× / 6×) and, more importantly, leaves 1 of 15 moves not checked
   at the default caps; adopting it needs `maxNodes` ≈ 50,000 for post-game requests and a real-device
   re-measurement. Revisit in S2.20 with phone data.
4. **Task lengths per level (02 U6, UA7 input):** computation does not limit the 02 §6 targets. Per partner move at
   6×: `pressing(2)` mean 1.07 s (max 2.1 s), `safe-sparring(2)` mean 0.19 s (max 0.43 s). Post-game h = 2, from the
   **mean** at 6× (247 ms per learner move; the measured 15-move total was 3.7 s): 12 moves (Basic short) ≈ 3 s,
   20 (Intermediate) ≈ 5 s, 25 (Advanced) ≈ 6 s, 30 (Expert) ≈ 7.4 s, an 80-move full game ≈ 20 s at 6×
   (desktop: mean 38 ms → 80 moves ≈ 3 s). Recommendation: compute each learner move's signals in the Worker during
   the game (queued after the partner's request) so the post-game wait is ~0; the 80-move cap of UA7 is then a
   question of the learner's time (S2.20), not of computation.
5. **Resist mode (`best-defence` resist, F1c): k = d = 2 everywhere** (≤ 69 ms desktop, ≤ 319 ms at 6× on all 14
   endgame positions). **k = 3 (with d = 2 or 3) allowed nowhere** (default confirmed): with escapes it costs
   0.35–1.9 s desktop (2.3–11.7 s at 6×), over budget even in 10–12-piece positions; it is cheap only when the
   defender is already lost, which is not where resist mode matters. A task wanting 3 must show its reference-run
   positions under 300 ms desktop in this bench (S2.12 `verify-practical`).
6. **`forcing-attack(3)`:** allowed in positions of ≤ 12 pieces as 03 §5.2 says: ≤ 73 ms desktop / ≤ 424 ms at 6× on
   the 8 endgames (even the 16-piece one: 29 ms). These were **legacy endgames** (u11–u15 and one constructed);
   the pilot's own positions do not exist yet, so S2.12 records the cost per task on its reference-run positions and
   flags depth 3 "measured within budget" per task (BACKLOG carry-over).
7. **Depth 3 partners on a full board stay out** (`safe-sparring(3)` 420 ms, `pressing(3)` 1.5 s desktop).
8. **Mate guard and partners at d = 2 fit:** `mate-distances(k = 2)` all moves ≤ 55 ms, `safe-sparring(2)` ≤ 26 ms,
   `pressing(2)` ≤ 118 ms (single positions) / ≤ 328 ms (game max), `forcing-attack(2)` ≤ 8 ms desktop. The 04 §2.2
   desktop numbers (e.g. mate guard ~120 ms, `pressing(2)` ~77–174 ms) were pessimistic for this code.

## 4. S2.5 carry-overs done (src/analysis/client.ts)

- `timeoutMs` is clamped: NaN → default, < 0 → 0, Infinity / > 60 s → `MAX_TIMEOUT_MS` (browsers fire an Infinity
  timer at once, which disabled the net).
- A Worker failing (or failing to start) before ANY Worker of the client has answered switches the client to the
  synchronous fallback (`fallback: 'worker-failed'`); once a Worker has answered, a restarted Worker that fails or
  cannot be created only fails the running request with 'error'.
- After a Worker failure the synchronous path answers 'not-checked' / 'error' for requests whose exhaustive mate
  search has depth ≥ 2 (`mateDepth`: `forced-wins`, `mate-distances`, guards / signals / threats / predicates with
  k ≥ 2, `threat-at-end`); everything else still runs with the small budget. Where no Worker exists at all
  (`fallback: 'no-worker'`: jsdom, Node, `createWorker: null` in tests) every kind runs as before.
- The bench exercises the real `new Worker(new URL(…))` path in a browser, incl. timeout → terminate → restart.

## 5. Owner action: real-device runs (≥ 1 Android, ≥ 1 iOS)

1. On a computer on the same Wi-Fi as the phones, in the repository: `npm install` (once), then
   `npm run bench -- --serve`. It builds the page and prints `http://<LAN IP>:4199/bench.html` (allow port 4199 in
   the computer's firewall if the phone cannot load it). No Playwright is needed for this.
2. Phone preparation: charged above 50 % or on the charger, battery-saver / Low Power Mode **off**, other apps
   closed, screen set not to sleep (or keep touching it), phone at room temperature.
3. Open the URL in the phone's default browser (Android: Chrome; iOS: Safari). Leave "Quick" unticked, tap
   **Run bench**, keep the page in front until the status says **Done.** (expect 5–15 minutes).
4. Tap **Copy results** (on plain http the clipboard may be blocked; the table is then selected — use the system
   Copy) and send the text, together with the phone model, OS version and browser version.
5. Wait 2 minutes and run it once more (thermal throttling); send the second result too.
6. The results go into this file as a new "Real devices" section (factor vs the 1× proxy per row); then R6 and the
   decisions above are confirmed or revised, and the readiness report may stop saying "phones unmeasured".
