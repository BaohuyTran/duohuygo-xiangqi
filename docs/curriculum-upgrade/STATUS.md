# Curriculum upgrade — status

Procedure: [DRIVER.md](./DRIVER.md) · Work items: [BACKLOG.md](./BACKLOG.md) · Decisions: [DECISIONS.md](./DECISIONS.md)

## Current position

- **Step:** 2 — Foundation and pilot (step 1 gate passed 2026-10-23)
- **Active items:** S2.1 ∥ S2.4 ∥ S2.10 (round A of 06 §2.2)
- **Branch:** `claude/pensive-albattani-i4h0ji` (base `main` @ `f20ea5b`); not merged, not deployed.

## Agent ownership

| Item | Agent | Owned files |
| --- | --- | --- |
| S1.1–S1.4 (done) | implementer; reviewed by tester, reviewer, content-reviewer | `design/*.md` |
| S2.1 | implementer (architecture engineer) | per 06 §4 S2.1 |
| S2.4 | implementer (architecture engineer) | per 06 §4 S2.4 |
| S2.10 | implementer (architecture engineer + QA) | per 06 §4 S2.10 |
| state docs, git | driver | `STATUS.md`, `DECISIONS.md`, `BACKLOG.md`, `DRIVER.md` |

## Completed work and evidence

- 2026-10-22 — Phase set-up: driver procedure, state documents, `content-reviewer` agent, `Base:` ref note in the
  agent files. Baseline on `f20ea5b`: `npm ci`, lint, build and `npm test` all pass.

- 2026-10-22 — S1.1 and S1.2 attempt 1 written; drafts committed as WIP (`701b212`) so they survive a container
  reset (not yet approved).
  - S1.1: reviewer APPROVE; tester FAIL (1 factual error: u15l3 exercise numbering and solver timing);
    content-reviewer CHANGES_REQUESTED (that error, unmeasured sparring-opponent cost, no opponent that puts a
    defending learner under pressure). Counts re-run independently by two agents: 13 units, 36 lessons, 49 learn
    cards, 146 practice exercises, 60 puzzles. Lint, build, 471 tests pass.
  - S1.2: reviewer and content-reviewer CHANGES_REQUESTED (missing unit fields for Master and some others; mastery
    unreachable for b10/e09/m09; "complete game" silently narrowed; holding rubric open to weak-opponent false
    success; R1 penalises tactics not yet taught). Opening lines checked legal and correctly named.

- 2026-10-22 — **S1.1 done** (attempt 2, `d4d66c1`): reviewer APPROVE, content-reviewer APPROVE (re-ran the policy
  cost script A.4: distinct-score counts identical, timings within ±20 %; u15l3#3 forced-win proof ≈ 4.4 s).

- 2026-10-23 — **S1.2 out of attempts** (attempt 3, `0125749`): reviewer and content-reviewer confirm every
  earlier finding fixed (49/49 units complete, mastery reachable, partners match 04, notation and glossary checked;
  Mã hậu pháo mate verified in the engine). One blocker left (no fallback for opening tasks / `xi` while `pressing`
  is unvalidated) — carried into S1.4, which owns cross-document reconciliation, and re-reviewed there.
- Process: an API usage limit interrupted the S1.2 content review and S1.3 on 2026-10-22; both resumed.

- 2026-10-23 — **S1.3 done** (attempt 2, `5041558`): tester PASS (completeness script re-run: 36 lessons, 195
  exercises, 60 puzzles mapped exactly once; 12 unreachable-Soldier positions, the 2026-10-21 lesson-id reuse and
  the sync fingerprint gap confirmed), reviewer APPROVE, content-reviewer APPROVE (u9l1 Cannon forks and u13l2
  successor fixed after engine checks).

- 2026-10-23 — **S1.4 done** (attempt 3, `a60adfa`): reviewer and content-reviewer APPROVE. It also closed S1.2's
  remaining finding (opening fallback F5, `xi` in F4, conversion fallback F1c with resist-mode `best-defence` at
  k = d = 2, line-share rule with fixed L ≥ 6, 0 < credited fraction ≤ 1/3, gate ≥ 2/3; N2 pass bound 73/729 at
  L = 6, recomputed by both reviewers).
- 2026-10-23 — **Step 1 gate passed.** All seven deliverables in `design/` (index: `design/README.md`); reviewer and
  content-reviewer APPROVE the set; lint, build and 471 tests pass on `a60adfa`; no application code changed since
  the phase began. Decisions adopted as D3; backlog for steps 2–4 in BACKLOG.md (definitions in 06 §4–§6).

- 2026-10-23 — **S2.10 done** (attempt 1): `createLearningRepository` (`learning.records.v1`, attempt log capped at
  2,000), `LEGACY_MAP` v1 (9 orphans) + `completedView` derived at read time, lazy backup of corrupt records on the
  first write, Reset clears v1 + records + attempts. Tester PASS (lint, build, 577 tests incl. parallel items,
  ui-check 360, Chromium: nothing written on load, lesson completion writes v1 only, Reset clears exactly the three
  keys); reviewer APPROVE. CLAUDE.md text applied with S2.1 (owner of CLAUDE.md this round). Follow-ups for S2.11/
  S2.13: merge duplicated `Strand` type; align local completion rule with the §8.6 merge; repeat App-level T6 once
  Home reads `completedView`; deep-freeze `LEGACY_MAP` arrays when targets are added.

- 2026-10-23 — **S2.1 done** (attempt 1): exercise metadata (`ExerciseMeta`), new-course id rules +
  `retired-ids.json` (u1–u15, all old lesson ids incl. `u8l4`), side-aware validation (Black fixtures validate),
  shared `legality.ts` (puzzle verifier unchanged on all 60 puzzles; 12 legacy POS positions reported as notices — 13 since D5/S2.3),
  `normalize.ts` (7 duplicate groups reproduced), unit `pool`. Tester PASS (577 tests, old vs new verifier identical);
  reviewer APPROVE; content-reviewer APPROVE (reachable points checked on 1,260 point×piece×colour cases; 169
  colour-swapped twins of shipped exercises validate as Black). Open: content-reviewer found a 13th impossible
  placement not covered by 07 §4.1 — two unpromoted Black Soldiers on file a in `u13l2#4` — rule
  "one own Soldier per file before the river" proposed (decision D5).

- 2026-10-23 — **S2.11 done** (attempt 1): records sync in a new `progress.data_v2` column (migration
  `20261023000000`), merge per 05 §8.6 item 4 (`src/sync/merge-records.ts`, canonical `betterCompletion` also used
  locally), records in both fingerprint uses, missing-column fallbacks on pull and push. Tester: code PASS (lint, both
  builds — plain build has no `data_v2`/Supabase code, 692 tests, T8–T11 + remote T12, mutation checks caught every
  injected regression, 10,000 seeded merge-property pairs with 0 failures); its one FAIL was the CLAUDE.md T15 text,
  which was the driver's to apply and is now in CLAUDE.md. Reviewer APPROVE. **Owner action T15** recorded below.

- 2026-10-23 — **S2.2 done** (attempt 2): units ordered by track rank then file name; release-state table
  REL-0/REL-P/REL-1–5 with T1 (today = REL-0 only; per-level status rule separates REL-4 from REL-5); review records
  bound to id + version + contentHash, latest content-reviewer verdict decides, author ≠ reviewer; drafts never
  loaded; course preview `VITE_COURSE_PREVIEW=1` (never in the deployed build); new-course completion goes to the
  learning records (lesson / placement), never the v1 list; slow content-verifier tests given explicit 120 s
  timeouts (they took 36–75 s under load; no assertion changed). Tester PASS (two full runs 776/776, Home identical to
  HEAD in en/vi, no review code in dist); reviewer APPROVE.
- 2026-10-23 — **S2.3 done** (attempt 2): Board `orientation` (Black at the bottom) and opt-in per-side file numbers;
  `src/notation/formatMove` (en + vi traditional notation; Advisors/Elephants never marked front/rear);
  `docs/curriculum-upgrade/glossary.md` (letters, operators, markers confirmed by the content-reviewer; "Trough Horse"
  proposed); combination material judge colour-neutral; Black twins of legacy exercises get mirrored verdicts;
  Black win-material guard removed; one-Soldier-per-file placement rule (13 POS). Tester PASS (ui:check incl. a Black
  fixture at 320/360/414/landscape); reviewer APPROVE; content-reviewer APPROVE (21,124 notation comparisons against
  an independent implementation, 0 differences). Follow-ups: players must pass `orientation`/`fileNumbers` and use
  the `.neutral` keys when Black exercises appear (S2.13/S2.14); `.board-fit` aspect with file numbers; colour-neutral
  validator messages; rename `u8l1` "Palcorner Horse" → "Trough Horse" at migration.

- 2026-10-23 — **S2.4 done** (attempt 2): `src/analysis` (search equal to the engine's material search, features,
  evaluation, 03 §5.3 safety signals, a06 threat, winning capture, declarative predicates). Tester PASS (233
  independent equality checks, 0 mismatches; deterministic; node limit/abort; MID depth 3 = 3,411 nodes; all 37 MID
  moves 'checked' under the cap); reviewer APPROVE; content-reviewer APPROVE after 5 chess-logic fixes (Basic missed
  gain, cannon control, check at the end, Xiangqi open file, cannon-screen general file) — brute-force 03 §5.3
  reference on 150 positions × both colours: 0 differences. Timing per move (~114 ms claimed, ~340 ms on a loaded
  machine) to be re-measured idle in S2.6. Interpretations recorded as D6.

- 2026-10-23 — **S2.5 done** (attempt 1): `src/analysis/{requests,worker,client}.ts` — typed request union, Worker
  with a wall-clock safety net (terminate + restart → 'not-checked'), per-search and per-request node budgets,
  synchronous small-budget fallback without a Worker; identical Worker/sync verdicts (tested, mutation-checked).
  Tester PASS (796 tests; offline:check: worker chunk precached, 82 moves judged offline, main-thread max 0.5 ms per
  request, 0 long tasks, restart offline; main chunk without analysis code); reviewer APPROVE. Temporary side-effect
  import in `src/main.tsx` keeps the worker chunk built until a screen imports the client. CLAUDE.md text applied
  with S2.7 (owner of CLAUDE.md this round). Carried to S2.6: clamp non-finite `timeoutMs`; do not run unbounded mate
  searches on the main thread after a Worker crash; exercise the real client in a browser bench.

- 2026-10-24 — **S2.9 done** (attempt 2): `src/play` — seeded training partners (scripted, best-defence incl. resist
  mode, forcing-attack, safe-sparring, pressing, restricted, greedy, chains) running their searches as analysis
  requests; game record with safety-net flag (voids the run); adjudicator of 03 §5.5 (perpetual check loses, both/
  neither → draw, chase not adjudicated, learner's third-repetition refusal with exceptions, task caps, 80-move /
  30-no-capture stops with one material rule). Tester PASS (determinism over 20 positions × 9 policies × 2 seeds, Worker
  vs direct identical, real-board repetition cases); reviewer APPROVE; content-reviewer APPROVE after two rule fixes
  (victim may claim perpetual check; cycle = last two occurrences). Disclosure/outcome/warning texts (en+vi, reviewed)
  go into messages.ts with S2.12. Interpretations: D8. CLAUDE.md `src/play` entry added with S2.7.

- 2026-10-24 — **S2.7 done** (attempt 3): `decision` (complete move tables target/sound/dubious/error; computed rows
  recomputed by the validator, accepted/capture/check rows must be authored; refutation claims only for real losses),
  `choice` (seeded shuffle, multi-select, per-option feedback, misconceptions), legal `select-squares` queries (pins and
  screens counted), goal `safe`, four-part feedback on move/capture/combination/decision items, idea→piece→move hint
  ladder, attempt events (first-answer credit, hints, `voided`), no free retries or hints for new-course items in jump
  tests; legacy lessons unchanged. Analysis client loaded lazily (main chunk +30 kB raw / +9 kB gzip vs before S2.5).
  Tester PASS (989 tests, offline:check, ui:check 320/360, a 360×740 harness of every new flow in en/vi); reviewer
  APPROVE; content-reviewer APPROVE (5 constructed positions + colour twins for queries; fixture tables reproduced).
  S2.7 alone verified in a clean worktree (lint, build, 982 tests). Follow-ups: board rows under the feedback footer on
  decision/choice screens at 360×740 (scroll needed) → S2.19; choice radiogroup arrow keys; placement scoring by
  first-answer credit (S2.13).

- 2026-10-24 — **S2.6 done** (attempt 2): dev-only bench (`npm run bench`, real Worker client + src/play partners,
  throttled headless Chromium as a proxy), `measurements.md`, budgets D9; client: timeout clamp, sync fallback only
  while no Worker has answered, no depth ≥ 2 mate search on the main thread after a Worker failure. Reviewer APPROVE
  (figures checked against raw outputs). Owner action: phone runs (measurements.md §5).

- 2026-10-24 — **S2.8 done** (attempt 2): `line` exercises (authored trees: learner nodes with complete tables,
  weighted opponent replies chosen by coverage then seed, leaves with goals; off-tree moves classed in the Worker,
  hand-over to a partner chain or F1 end); validator proves claims over all defences and requires every move that
  keeps a claim to be accepted; varied defence for combinations (opt-in, longest-resistance replies only, not on
  4-move combinations until measured). Reviewer APPROVE; content-reviewer APPROVE (no mixed mate distances left in
  93 legacy steps). For S2.13: wire `attempts`/`logAttempt` so coverage works in the app.

## Blockers and failed gates

- **Owner action (before any deploy that writes `data_v2`):** apply migration `20261023000000_progress_data_v2.sql`
  on the real Supabase project and pass T15 steps 3–5 (procedure in CLAUDE.md, "Account login and sync").
- None blocking. Owner decisions needed before release (not before implementation): licence of code and content
  (07 S07-U2), historical annotated games allowed? (S07-U1), human review sample before release? (S07-U4), and a
  real-Supabase check that old builds leave `data_v2` untouched (05 MU2 / 04 R5, test T15) before any deploy that
  writes it. Open for S1.4 reconciliation: perpetual-chase adjudication (03 vs 04), opponent profile names,
  mastery merge rule, notation ownership, content volume (reviewer estimate ~160 lessons, 1,000–1,600 practice
  items) vs batch sizing.

## Next actions

1. Step 2 round A in parallel: S2.1 (content schema v2), S2.4 (analysis core), S2.10 (three-level progress storage).
2. Then rounds B–D and the pilot items in the order of 06 §2.2; S2.gate before any step-3 batch.
