# 06 — Implementation backlog, pilot recommendation and decisions

Backlog item S1.4 · Role: lead integrator (driver) with implementer (architecture engineer + curriculum designer).
Inputs: every other design document ([README.md](./README.md)). The driver copies §4–§6 into
[BACKLOG.md](../BACKLOG.md) (replacing the step 2–4 placeholders) and §7 into [DECISIONS.md](../DECISIONS.md).

Labels as in [README.md](./README.md#labels): everything in this document is a **Proposal** unless marked
**Verified** (a count or fact checked in the repository or the other documents) or **Owner decision**.

---

## 1. Summary

- **Step 2** (§4) builds the foundation in 13 capability items (S2.1–S2.13), then the pilot in 7 items (S2.14–S2.20)
  and a gate. Order follows 04 §7.4; storage (S2.10) and the analysis core (S2.4) have no dependencies and start in
  the first round.
- **Pilot** (§3): five pieces from four units and both colours — `b09l3` + `b09-g1` (Basic, Black), `i08l3` + `i08-g1`
  (Red opening with deviations), unit `a03` (improve instead of attack), `a07l4` + `a07-g1` (holding as Black), and the
  `a03` unit check plus a J2 test-out of `a03` (unlabelled, unfamiliar positions). It validates every new capability
  except full games, runs `pressing` validation, and measures phone cost with a throttled-browser proxy.
- **Step 3** (§5) produces all 49 units in 14 batches of 3–5 units in level order, plus one release item per level
  (S3.4, S3.8, S3.12, S3.16, S3.19) that publishes the level in the order fixed in 05-migration.md §8.4.1. No unit is
  deferred. Volume is large (§5.1: ~161 lessons, ~760–1,140 practice items of which 146 reused, ~750 check items,
  ~160 placement items, 31 practical tasks, 5 exam pools); two reductions are adopted, the others are listed for a
  decision.
- **Step 4** (§6) has seven validation items and a gate, taken from 04-final-validation.md.
- **Decisions** (§7): 44 proposed decisions consolidated from 03 §12, 04 §7/§8, 05 §10, 07 §11 and this item; five
  need the owner (licence, historical games, human review sample, a GPL engine in the app, and any scope reduction
  beyond §5.1).

---

## 2. Conventions for every item

### 2.1 Item format

Each item has: **Role focus** (the agent prompt's first line, DRIVER.md), **Depends on**, **Owned files** (concrete
paths; "new" = created by the item), **Shared files** (see §2.2) and **Acceptance criteria** (checkable). Every item
also meets the **standing criteria**:

- `npm run lint`, `npm run build`, `npm test` pass; no existing file in `src/engine/` changed (engine guard).
- Existing lessons, puzzles and their tests behave as before unless the item says otherwise (no regressions in the
  legacy path; `npm run ui:check` on the default build still passes).
- All learner-visible text in `src/i18n/messages.ts`, en + vi, matching placeholders.
- Phone first: 320/360/414 px and landscape, touch targets ≥ 44 px, keyboard operable where applicable.
- `CLAUDE.md` updated when folders, commands or conventions change.
- No new npm dependency (runtime or dev) without a DECISIONS.md entry proposed in the item's report.
- Items that author or change chess content, assessment or scoring logic get a `content-reviewer` verdict from an agent
  run other than the author's (DRIVER.md step 5).

### 2.2 Shared files and serialization

Shared files: `src/i18n/messages.ts`, `src/content/types.ts`, `src/content/validate.ts`, `src/storage/index.ts`,
`src/components/LessonPlayer.tsx`, `src/App.tsx`, `CLAUDE.md`, `docs/curriculum-upgrade/coverage.md` (created by S3.1).

- Each shared file has **one owner per round**. Items that list the same shared file run one after another, in backlog
  order; most such pairs are already ordered by their dependencies, the rest are named under "Serialize with".
- When items run in parallel and more than one needs a `CLAUDE.md` change, only the first-listed item edits it; the
  others put their text in their report and the driver applies it at commit (the driver owns integration).
- Suggested parallel rounds for step 2 (disjoint owned files): **A** S2.1 ∥ S2.4 ∥ S2.10 · **B** S2.2 ∥ S2.5 ∥ S2.11
  (then S2.3 after S2.2, because both edit `CLAUDE.md` and S2.3 needs S2.1) · **C** S2.7 ∥ S2.9 · **D** S2.8 ∥ S2.6 ·
  then S2.12, S2.13, S2.14 → S2.17 one after another (all edit `messages.ts`), S2.18, S2.19, S2.20. Step 3 batches run
  one after another (each owns `messages.ts`, `coverage.md` and its level's files).

### 2.3 Definition of "done" for content (used by S2.14–S2.17 and every step-3 batch)

An item, unit or pool is done only when every one of its items is:

1. **Complete:** the unit's lessons and objectives of 02-curriculum.md §8; per lesson a `learn` card or worked example
   with a **contrast** case; the level's ladder (02 §5.2) down to G0; at least one TR task per unit; practical tasks as
   listed; Black and quiet shares as required (02 §2 rules 2–3), reported per unit and enforced per level by the release
   item.
2. **Verified:** validators pass (legality incl. piece counts and reachable points for new positions; side to move;
   claimed outcomes proven for every defence; complete move tables; line trees; no repeated position on stored lines);
   uniqueness corpus check for every check, placement and exam item (03 §4.2 rule 4); `npm run content:deep` after any
   mate-in-4 change; §5.7 guard of 03 passed by every practical task in the active partner regime (S2.18).
3. **Reviewed:** a review record in `src/content/reviews/<unitId>.json` bound to id + version + hash, with a
   `content-reviewer` approval (chess, en, vi) from a run other than the author's (07 §5.2); feedback has the four
   parts of 02 §7 (purpose, key reply, common error, tempting alternative) for G1/G0 items; independent prompts are
   neutral (03 §4.2).
4. **Integrated:** reused legacy items carry `legacyRef` and the changes of 05-migration.md §4 (FB, LEAK, BLK, POS, …),
   T2 passes; items are `reviewed` and visible in the course preview; they become `published` only in their level's
   release item.
5. **Walked through:** preview build checked at 360 px and desktop with both colours where the unit has both; findings
   fixed.

Draft or unreviewed material is never counted as delivered (PLAN.md "Quality gates"); it stays in
`src/content/drafts/` or out of the loaded files.

---

## 3. Pilot recommendation

### 3.1 The five pieces

| # | Piece required by 02-foundation-and-pilot.md | Pilot content (02 ids) | Colour | What it validates |
| --- | --- | --- | --- | --- |
| P1 | Beginner safety/development lesson | `b09l3` "Meeting the central Cannon" (protect the central Soldier with a developing move) + `b09-g1` (`play` from the start position, R2 + R1, `safe-sparring(2)`) | Black (lesson), seeded colour (task) | Black orientation and per-side notation at Basic; `decision` with a develop predicate + Basic guard (*h* = 1) and complete move tables; `choice`; `play` vs `safe-sparring`; post-game signals; R2/R1; §5.7 guard with N1/N2 on a Basic task |
| P2 | Opening-plan lesson with plausible opponent deviations | `i08l3` "Against other replies" (Central Cannon vs Same-direction and Opposite-direction Cannons and other tries) + `i08-g1` (`line` → `play`, R6 + R1) | Red | `line` trees with authored, seeded, coverage-driven deviations; off-tree default class in the Worker; authored replies safety-guarded; `scripted` → `pressing(2)` hand-over, or F5 under the fallback; R6 |
| P3 | Positional lesson where improving a piece beats forcing an attack | Unit `a03` "Improving poorly placed pieces": `a03l1`–`a03l3` (core: `a03l3` "Improve instead of attack") + `a03-g1` (`play`, R3 + R1) | Both (≥ 1/3 Black) | Strategic acceptance: several accepted improving moves (target/sound), the tempting attack refuted by the guard or shown to achieve nothing (reviewed); `select-squares` "worst piece"; objective predicates (mobility, route); R3; F1 tree-bounded scoring |
| P4 | Defensive or endgame continuation | `a07l4` "Under pressure as Black" + `a07-g1` (`play`, hold chain, R5 + R1) | Black | Threat tree → `forcing-attack(2)` → `pressing(2)` (or F1), verified starting threat, holding predicate, repetition adjudication and the learner's third-repetition refusal, mid-game persistence, voided runs |
| P5 | Assessment with unfamiliar positions without motif labels | The `a03` unit check (pool of 16: two forms of 8, neutral prompts, ≥ 1/3 Black, ≥ 1/4 quiet, decoys where an attack looks available and fails; 2 interleaved items per form authored for `i01` and `b08`, one safety-critical) + a J2 test-out of `a03` in the preview (Advanced = `a03`, `a07`; ≥ 10 `pa-*` items tagged `a03`, 20 preferred) | Both | Unit-check assembly and mastery (≥ 80 + critical), remediation and retake; J2 assembly and exact scoring (≥ 90, strand minimums, critical items, first attempt only, no hints), placement mastery for covered units; uniqueness corpus; exposure tracking; "not assessed yet" vs mastered vs applied display |

Why these: they are the 02 candidates closest to each required piece (02 a03 is marked "pilot candidate"); they span
Basic, Intermediate and Advanced; P1 and P4 put the learner on Black, P2 on Red, P3 and P5 on both; P2 and P4 are the
two hardest opponent problems (deviations, and pressure on a defender). Full games (`b10`, `xb`) are left out, as 04 §7.4
allows, because the pilot already exercises `play`, adjudication and partners; they are validated in S3.3.

### 3.2 What the pilot also validates

- **Pressing validation (S2.18):** P2–P4 task positions are the test bed; its verdict sets the partner regime (main or
  fallback F). Either way every level stays masterable and applied (03 §5.2 reachability table).
- **Phone cost (S2.6):** the pilot's partners and signals are measured with a throttled-browser proxy; real devices are
  an owner action.
- **Migration:** the pilot runs in release state **REL-P** (05 §8.4.1): all 36 legacy lessons live, `LEGACY_MAP` holds only
  the 9 orphans, new records in `learning.records.v1`, `data_v2` sync with fallbacks. Tests T1 (states REL-0 and REL-P),
  T3–T14, T16–T18 run; T15 is documented for the owner.
- **Content workflow:** review records, hashes, independence, drafts outside the loaders, release test.
- **Calibration:** 03 thresholds (UA6), task lengths (U6), daily retake limit (UA2), warm-up (UA1), ICCS setting (U5),
  unlock rule (U3), lesson sizes and reductions (U8).

### 3.3 Pilot exit criteria (checked by S2.gate)

1. All five pieces playable end to end in the preview build: phone (320/360/414, landscape) and desktop, both colours,
   keyboard; answering never reloads the page or resets unrelated lesson state.
2. Every pilot item is `reviewed` with an independent `content-reviewer` approval; no placeholder positions; no
   success-only feedback.
3. Validators, `content:deep`, the §5.7 guard (every pilot task, active regime) and all tests pass; the legacy path
   is unchanged (default-build `ui:check`, existing tests).
4. `pressing` verdict recorded (validated or fallback F), with the reviewer's sample.
5. Phone-cost results recorded (proxy), with the owner request for real devices.
6. Migration and sync tests listed in §3.2 pass; both builds (with and without Supabase variables) pass.
7. S2.20 has recorded the calibration decisions and updated 02–05, 07 and this backlog to what was implemented
   (02-foundation-and-pilot.md "Definition of done").

---

## 4. Step 2 — Foundation and pilot

### S2.1 — Content schema v2 and validator foundations

- **Role focus:** architecture engineer (+ QA)
- **Depends on:** —
- **Owned files:** `src/content/types.ts`, `src/content/validate.ts`, `src/content/validate.test.ts`, new
  `src/content/legality.ts` (+ test), new `src/content/normalize.ts` (+ test), new `src/content/retired-ids.json`,
  `CLAUDE.md` ("Lesson content")
- **Shared files:** `types.ts`, `validate.ts`, `CLAUDE.md`
- **Acceptance criteria**
  - [ ] Optional exercise fields: `id`, `version`, `status` (`draft` · `verified` · `reviewed` · `published` ·
        `retired`), `source` (07 §2.1 kinds incl. `legacyRef`, `derivedFrom`, generator/seed), `side`
        (`red` | `black`, default `red`), `strand`, `tactic`/`quiet`, `critical`, misconception ids; every existing
        lesson JSON validates unchanged.
  - [ ] New-course units (ids per 02 §3.3) must carry all metadata; ids unique and absent from `retired-ids.json`
        (which lists `u1`–`u15`, `u1l1`–`u15l3` and the 9 orphans, 07 §8).
  - [ ] Side-aware validation: side to move equals `side`; own-piece checks use it; a Black fixture validates.
  - [ ] Piece-count and reachable-point rules in `legality.ts`, applied to new-course positions; the puzzle verifier
        uses the same module with unchanged results; the 12 legacy `POS` positions (05 §9 command 3) are reported, not
        failed, while their lessons are live.
  - [ ] `normalize.ts`: one normal form for file mirror and colour swap; reproduces the 7 groups of 05 §9 command 4.
  - [ ] Per-unit extra-practice `pool` format (MU1) validated like lesson items.

### S2.2 — Release path: review records, draft gate, release states, preview, unit ordering

- **Role focus:** architecture engineer + QA
- **Depends on:** S2.1
- **Owned files:** `src/content/index.ts`, new `src/content/release.ts` (release-state table REL-0, REL-P, REL-1–REL-5 of 05
  §8.4.1), new `src/content/release.test.ts`, new `src/content/reviews/` (records + test-only loader), new
  `src/content/drafts/.gitkeep`, new `scripts/review-hash.ts`, `src/vite-env.d.ts` (`VITE_COURSE_PREVIEW`),
  `src/App.tsx` (which path Home shows), `CLAUDE.md`
- **Shared files:** `App.tsx`, `CLAUDE.md` · **Serialize with:** S2.10 (`App.tsx`), S2.3 (`CLAUDE.md`)
- **Acceptance criteria**
  - [ ] Units ordered by track rank, then file name; a test proves every track's units are contiguous; today's Home
        order, headers and jump banner unchanged (05 §8.4.1 P3).
  - [ ] Review records as 07 §5.2; `contentHash` over the normalised item JSON + en + vi texts; author ≠ reviewer
        enforced; the release test fails for any served new-course item that is not `published` (or `reviewed` in the
        preview) or lacks a matching record; the legacy exemption is derived from `release.ts` (07 §6).
  - [ ] Nothing under `src/content/drafts/` is loaded (test on the globs).
  - [ ] Course preview: off by default and in production builds; `VITE_COURSE_PREVIEW=1` shows the new-course path
        (reviewed units of unpublished levels, by level) instead of the legacy path; first lesson of each level open in
        the preview.
  - [ ] T1 (05 §8.10) for states REL-0 and REL-P; the current content matches exactly one state.

### S2.3 — Playing Black: orientation, notation, colour-neutral judges

- **Role focus:** architecture engineer + learning-experience (bilingual)
- **Depends on:** S2.1
- **Owned files:** `src/components/Board.tsx`, `src/components/Board.test.tsx`, new `src/notation/format.ts`
  (+ test), `src/lessons/combination.ts`, `src/lessons/answers.ts`, `src/i18n/messages.ts`, `scripts/ui-check.mjs`,
  new `docs/curriculum-upgrade/glossary.md`, `CLAUDE.md`
- **Shared files:** `messages.ts`, `CLAUDE.md`
- **Acceptance criteria**
  - [ ] `orientation` prop: Black at the bottom draws (8 − file, rank); river labels swapped; per-side file numbers
        1–9 on each edge (02 §4); taps select the right square (component test); accessible names stay correct.
  - [ ] `formatMove(move, position, notation, lang)`: en and vi traditional notation incl. front/rear markers, both
        colours, table tests (e.g. `h2-e2` = "C2=5"); the content reviewer confirms Vietnamese symbols and letters and
        English names in `glossary.md` (02 U2, 04 R1); `theme.flying-general` aligned with the glossary (05 §5).
  - [ ] Judges take the mover from the position: a colour-swapped copy of a legacy `move`, `capture`, `defend` and
        `combination` exercise gets mirrored verdicts; all existing combination tests pass unchanged.
  - [ ] Colour-neutral text or `{side}` placeholders in en + vi.
  - [ ] `ui:check` covers a Black fixture at 320/360/414 and landscape (preview build).

### S2.4 — Analysis core (`src/analysis`)

- **Role focus:** architecture engineer
- **Depends on:** —
- **Owned files:** new `src/analysis/search.ts`, `eval.ts`, `features.ts`, `judge.ts`, `index.ts`, their tests, new
  `src/analysis/purity.test.ts`
- **Shared files:** — (`CLAUDE.md` text via the report in round A)
- **Acceptance criteria**
  - [ ] Iterative-deepening alpha-beta with transposition table, depth and node limits and an abort flag, returning
        `{ score, pv, depth, nodes, complete }`; deterministic; with material-only evaluation it equals
        `searchScore`/`moveScore` at the same depth on fixed positions (incl. the 04 §2.2 mid FEN).
  - [ ] Features of 04 §4 unit-tested on hand-checked positions; objective predicates = the 04 §5.4 layer-2 list
        (02 U4), declarative.
  - [ ] Safety guard and signals of 03 §5.3 (*h*, *k*, *T* per level; second search only when suspicious; unavoidable
        loss not penalised; one penalty per move), the "threat" of 02 a06 and the `forcing-attack` winning capture of
        03 §5.2, with tests.
  - [ ] Purity: no React/DOM, no `src/gamification` imports; only the engine's public API.

### S2.5 — Worker analysis client

- **Role focus:** architecture engineer
- **Depends on:** S2.4
- **Owned files:** new `src/analysis/worker.ts`, new `src/analysis/client.ts` (+ test), `scripts/offline-check.mjs`
- **Acceptance criteria**
  - [ ] Promise API, per-request depth/node limits, wall-clock safety net → verdict "not checked"; timeout terminates
        and restarts the Worker; synchronous small-budget fallback where no Worker exists (jsdom); Worker and sync
        paths give identical verdicts (test).
  - [ ] `npm run offline:check` passes with the Worker chunk (precached, offline).
  - [ ] Main-thread work per interaction ≤ ~50 ms desktop, measured on the pilot-like positions.

### S2.6 — Phone-cost measurement and runtime budgets

- **Role focus:** architecture engineer + QA
- **Depends on:** S2.5, S2.9
- **Owned files:** new `scripts/bench/` (bench page), new `scripts/bench.mjs`, `package.json` (script `bench`), new
  `docs/curriculum-upgrade/measurements.md`
- **Acceptance criteria**
  - [ ] The bench page runs the 04 §A.1/§A.4 workloads through the Worker (`pressing(2)`, `forcing-attack(2)`,
        `safe-sparring(2)`, the mate guard, *h* = 2 and *h* = 3 post-game signals).
  - [ ] Headless Chromium runs at CPU throttling 1×, 4× and 6× recorded as a **proxy**, clearly labelled as not a phone.
  - [ ] Real-device runs (≥ 1 Android, ≥ 1 iOS) requested from the owner with exact steps; until done the readiness
        report says phones are unmeasured (04 R6).
  - [ ] Decisions recorded: node caps, safety-net time, whether *h* = 3 post-game signals fit (03 UA5 cost part), task
        lengths that fit per level (02 U6, 03 UA7 input), and the cost of `best-defence` resist mode at *k* = *d* = 2
        and 3 on endgame positions, deciding where 3 is allowed (default: nowhere).

### S2.7 — Strategic decisions: move tables, `decision`, `choice`, feedback and hint ladder

- **Role focus:** architecture engineer + curriculum designer + learning-experience
- **Depends on:** S2.1, S2.3, S2.4
- **Owned files:** `src/content/types.ts`, `src/content/validate.ts`, new `src/lessons/decision.ts`, new
  `src/lessons/choice.ts`, `src/lessons/answers.ts`, new `scripts/move-table.ts`, `src/components/LessonPlayer.tsx`,
  new `src/components/DecisionView.tsx`, `ChoiceView.tsx`, `FeedbackPanel.tsx`, `src/i18n/messages.ts`, tests,
  `CLAUDE.md`
- **Shared files:** `types.ts`, `validate.ts`, `LessonPlayer.tsx`, `messages.ts`, `CLAUDE.md`
- **Acceptance criteria**
  - [ ] Complete move tables with classes target/sound/dubious/error (04 §5.3 mapping), each entry `computed` or
        `authored` with a reason; `scripts/move-table.ts` proposes tables; the validator recomputes `computed` entries
        and fails on drift, fails when a target/sound move fails the guard, and requires ≥ 2 accepted moves where the
        item allows alternatives.
  - [ ] `select-squares` extensions (attacked by side, attacked pieces, hanging pieces, pieces that can capture a
        point, single authored point) and `move` goal `safe`, computed by the engine/analysis, not stored.
  - [ ] `choice`: seeded shuffle, multi-select, per-option feedback and misconception ids.
  - [ ] Feedback fields required for G1/G0 items (purpose, key reply, common error, tempting alternative); hint ladder
        idea → piece → move; hint use and attempts emitted as attempt events (persisted by S2.10/S2.13).
  - [ ] Component tests: answering never reloads or resets unrelated lesson state; keyboard operation; all existing
        `LessonPlayer` tests pass unchanged.

### S2.8 — Branching: `line` trees and varied defence

- **Role focus:** architecture engineer
- **Depends on:** S2.5, S2.7
- **Owned files:** `src/content/types.ts`, `src/content/validate.ts`, new `src/lessons/line.ts`,
  `src/lessons/combination.ts`, new `src/components/LineView.tsx`, `src/components/LessonPlayer.tsx`, new
  `scripts/verify-lines.ts`, `src/i18n/messages.ts`, tests
- **Shared files:** `types.ts`, `validate.ts`, `LessonPlayer.tsx`, `messages.ts`
- **Acceptance criteria**
  - [ ] Tree format of 04 §5.2 (learner nodes with classed moves and feedback; opponent nodes with weighted replies and
        explanation keys; leaves with a goal); deviations chosen by seed and coverage (unseen first, from the local
        attempt log).
  - [ ] Off-tree learner moves classed in the Worker (default class, 04 §5.4); "not checked" gives neutral feedback, no
        penalty; hand-over to the named policy (or task end under F1).
  - [ ] Validator: nodes legal; every opponent branch reaches a leaf; forced claims proven for every defence; authored
        replies pass the safety guard; no repeated position on stored lines (07 §4.1).
  - [ ] Varied defence for `combination` (02 e01, VAR): opt-in per item, the opponent picks among all best-defence
        replies by seed and coverage; default behaviour of existing combinations unchanged.

### S2.9 — Training partners and game adjudication (`src/play`)

- **Role focus:** architecture engineer
- **Depends on:** S2.4, S2.5
- **Owned files:** new `src/play/policies.ts`, `record.ts`, `adjudicate.ts`, `rng.ts`, `index.ts`, their tests, new
  `src/play/purity.test.ts`
- **Acceptance criteria**
  - [ ] `OpponentPolicy` with injected seeded RNG: `scripted`, `best-defence`, `forcing-attack(k)` (03 §5.2 winning
        capture), `safe-sparring(d, τ)`, `pressing(d)` (04 prototype weights; tuned in S2.18), `restricted`, `greedy`, and
        `best-defence` in resist mode (03 §5.2, for F1c; *k* = *d* = 2 by default);
        each with its disclosure key; deterministic per seed; depth/node limits; a safety-net d = 1 move is flagged in
        the game record (it voids the run, 03 §5.6).
  - [ ] Partners avoid a third repetition unless every alternative loses ≥ *T*.
  - [ ] Adjudicator of 03 §5.5 with table tests: perpetual check loses; both/neither checking → draw; chase not
        adjudicated; the learner's third-repetition refusal and its exceptions; task caps; full games stop at 80 learner
        moves or 30 without a capture, same material rule at both stops.

### S2.10 — Three-level progress storage and derived legacy migration

- **Role focus:** architecture engineer + QA (migration risks)
- **Depends on:** —
- **Owned files:** `src/storage/index.ts`, `src/storage/storage.test.ts`, new `src/progress/legacy.ts`, new
  `src/progress/records.ts`, their tests, `src/App.tsx` (Reset only)
- **Shared files:** `storage/index.ts`, `App.tsx` · **Serialize with:** S2.12 (`storage/index.ts`), S2.2 and S2.13
  (`App.tsx`)
- **Acceptance criteria**
  - [ ] `createLearningRepository` for `learning.records.v1` (05 §8.3, incl. optional `fallback` on application
        grants) and `learning.attempts.v1` (local, capped at 2,000).
  - [ ] `LEGACY_MAP` (version 1: the 9 orphans with no target, state REL-P) and `completedView` (05 §8.4); loading writes
        nothing.
  - [ ] Corrupt-data handling of 05 §8.9 (backup key, field-level drops, unknown ids kept).
  - [ ] Reset clears v1 completion, records and the attempt log (MU3); puzzles, settings and gamification unchanged.
  - [ ] Tests T3–T7, T12–T14, T17, T18 of 05 §8.10.

### S2.11 — Account sync of the new records (`data_v2`)

- **Role focus:** architecture engineer + QA
- **Depends on:** S2.10
- **Owned files:** new `supabase/migrations/<timestamp>_progress_data_v2.sql`, `src/sync/supabase.ts`,
  `src/sync/service.ts`, new `src/sync/merge-records.ts`, `src/sync/fake-backend.ts`, their tests, `CLAUDE.md`
  ("Account login and sync")
- **Shared files:** `CLAUDE.md`
- **Acceptance criteria**
  - [ ] Pull `data, data_v2`, push `{ user_id, data, data_v2 }`; `data` keeps the v1 shape.
  - [ ] Merge of 05 §8.6 item 4 (union, higher score, deterministic ties; `exposed` synced, MU6); higher remote
        `schema` preserved.
  - [ ] Fingerprint includes the records (both uses, 05 §8.6 item 5); missing-column fallbacks (05 §8.6 item 6).
  - [ ] Tests T8–T11; both builds pass; T15 written as a manual procedure in `CLAUDE.md` and listed as an **owner
        action** before any deploy that writes `data_v2` (04 R5, 05 MU2).

### S2.12 — Practical tasks: `play`, `review`, rubrics, fallback F, practical guard

- **Role focus:** architecture engineer + curriculum designer (assessment)
- **Depends on:** S2.8, S2.9, S2.10
- **Owned files:** `src/content/types.ts`, `src/content/validate.ts`, new `src/assessment/rubrics.ts` (+ test), new
  `src/components/PlayView.tsx`, `ReviewView.tsx`, `src/components/LessonPlayer.tsx`, `src/storage/index.ts`
  (in-progress game repository), `src/i18n/messages.ts`, new `scripts/verify-practical.ts`, tests
- **Shared files:** `types.ts`, `validate.ts`, `LessonPlayer.tsx`, `storage/index.ts`, `messages.ts`
- **Acceptance criteria**
  - [ ] Task definition of 03 §5.1; partner chains and disclosure text of 03 §5.2; post-game signals in the Worker
        within budget.
  - [ ] Rubrics R0–R7 and pass rules of 03 §5.3–§5.6, tested on fixed recorded games (03 §10); voided runs.
  - [ ] Partner regime switch (`main` | `fallback`), default `fallback` until S2.18; F1 (with the scoring-leaf rule),
        F1c, F2, F2b, F3, F4 and F5 behave as 03 §5.2; grants record the fallback; the reachability table holds on a
        fixture pool.
  - [ ] Line share of 03 §5.3 (fixed *L* counted moves, table classes on the tree, default class off it, selectivity
        0 < credited fraction ≤ 1/3, voiding below *L*, gate ≥ 2/3) for R6 and F2b; a seeded N2 simulation on fixture
        trees fails ≥ 80 %; a check-evasion position is not counted; a learner who develops faster than the tree passes;
        `verify-practical.ts` reports the void rate (runs with < *L* counted moves) per task.
  - [ ] F1c resist mode runs at *k* = *d* = 2 unless the task is flagged as measured in S2.6; `verify-practical.ts`
        records its cost on every reference-run position; F1 leaves at non-selective nodes rejected.
  - [ ] A game in progress survives reload and tab switch (stored through `src/storage`).
  - [ ] `review`: mark the turning point, play a better move (as `decision`), choose the reason; R7.
  - [ ] `scripts/verify-practical.ts` runs the 03 §5.7 checks (reference run, N1, N2, narrow positions, real
        resistance, second plan) and prints per-task results.

### S2.13 — Assessment engine and progress-state UI

- **Role focus:** architecture engineer + learning-experience (assessment)
- **Depends on:** S2.2, S2.7, S2.10, S2.12
- **Owned files:** new `src/assessment/credit.ts`, `checks.ts`, `placement.ts`, `exams.ts`, `index.ts`, their tests,
  new `src/assessment/purity.test.ts`, `src/content/types.ts` (pool item types), new `src/content/pools.ts` (loader
  for `src/content/assessment/*.json`, + test), `src/content/release.test.ts` (pools in the release test),
  `src/lessons/progress.ts`, `src/lessons/progress.test.ts`, `src/components/Home.tsx`, new
  `src/components/AssessmentPlayer.tsx`, `src/App.tsx`, `src/i18n/messages.ts`
- **Shared files:** `types.ts`, `App.tsx`, `messages.ts` · **Serialize with:** S2.2 (`App.tsx`, `release.test.ts`)
- **Acceptance criteria**
  - [ ] Pool files `src/content/assessment/<pool>.json` (unit check, placement, placement practical, exam) loaded and
        validated: metadata of 03 §4.2 rule 9, uniqueness corpus, review status; drafts never served.
  - [ ] Credit per item type, first answer only, hints/retries recorded, voided items (03 §3).
  - [ ] Unit checks: seeded forms honouring 03 §4.1, exposure avoidance and retake rules (§4.3), remediation set
        (§4.4), mastery ≥ 80 with all critical items; tests of 03 §10.
  - [ ] Jump-ahead J1/J2 (03 §7): form assembly, exact scoring, the §7.3 table as tests (89.8 fails, exactly 90 passes),
        strand minimums, critical items, practical evidence, early stop, outcomes (completed by placement, covered
        mastery, equivalent "applied"), one attempt per target per day, no J2 within Master.
  - [ ] Level exams and level/course states (03 §2, §6); portfolio data model (03 §6.1).
  - [ ] No XP or hearts for assessments; available at 0 hearts; the assessment module does not import
        `src/gamification` (03 §9); first real completion of a migration-completed lesson gives 10 XP (MU4).
  - [ ] Level entry gate for published new-course levels (PD-35); legacy tracks keep today's rules and jump test
        (05 P5).
  - [ ] Home shows completed / mastered (and how) / applied separately, "not assessed yet" for migrated completion,
        a "more practice" entry for unit pools (MU1); T16; warm-up after 30 days of inactivity offers suggestions only
        (UA1 default).

### S2.14 — Pilot P1: `b09l3` + `b09-g1`

- **Role focus:** Xiangqi content author + bilingual content
- **Depends on:** S2.2, S2.3, S2.7, S2.8, S2.12
- **Owned files:** new `src/content/lessons/b09-opening-development.json` (pilot lesson only), new
  `src/content/reviews/b09.json`, `src/i18n/messages.ts`
- **Shared files:** `messages.ts` · **Serialize with:** S2.15–S2.17
- **Acceptance criteria**
  - [ ] `b09l3` as 02 b09 (as Black; guided `choice`, independent `decision` with develop predicate + guard, a short
        `line`), feedback four parts, misconceptions `b09.m1`–`m4` tagged where they apply.
  - [ ] `b09-g1` vs `safe-sparring(2)`, R2 + R1, passes the §5.7 guard (N1 ≥ 90 %, N2 ≥ 80 % fail); if not, the remedy
        of 03 §5.2 in order (add R0; then a scripted first part with the line-share gate), recorded.
  - [ ] §2.3 "done" criteria 1–4; preview only.

### S2.15 — Pilot P2: `i08l3` + `i08-g1`

- **Role focus:** Xiangqi content author + bilingual content
- **Depends on:** S2.14
- **Owned files:** new `src/content/lessons/i08-central-cannon.json` (pilot lesson only), new
  `src/content/reviews/i08.json`, `src/i18n/messages.ts`
- **Acceptance criteria**
  - [ ] `i08l3` as 02 i08 (Red; `line` with the Screen Horses main line and the Same-direction / Opposite-direction
        Cannon deviations; each move's purpose; deviations in at least half the `line` items); names and plans
        confirmed by the content reviewer.
  - [ ] `i08-g1` (`line` → `play`, R6 + R1, line-share gate, *L* ≥ 6 counted moves) passes the §5.7 guard in its F5 form, and in the main form if S2.18
        validates `pressing`.
  - [ ] §2.3 criteria 1–4.

### S2.16 — Pilot P3 + P5: unit `a03`, `a03-g1`, the `a03` check pool and a placement slice

- **Role focus:** Xiangqi content author + curriculum designer (assessment)
- **Depends on:** S2.13, S2.15
- **Owned files:** new `src/content/lessons/a03-improving-pieces.json`, new `src/content/assessment/a03-check.json`,
  new `src/content/assessment/pa.json` (slice), new `src/content/assessment/i01-check.json` and
  `src/content/assessment/b08-check.json` (interleaved items only), new `src/content/reviews/a03.json`,
  `src/i18n/messages.ts`
- **Acceptance criteria**
  - [ ] `a03l1`–`a03l3` as 02 a03 (Advanced ladder G3 → G1 → G0 → TR; ≥ 1/3 Black; ≥ 1/4 quiet), the tempting attack in
        `a03l3` refuted by the guard or shown by a reviewed explanation to achieve nothing; ≥ 2 accepted improving moves
        where the position allows.
  - [ ] `a03-g1` (R3 + R1) passes the §5.7 guard in its F1 form (and main form if validated).
  - [ ] Check pool of 16 (two forms of 8) and ≥ 10 `pa-*` items tagged `a03` (20 preferred), all neutral and unseen
        (uniqueness corpus), with decoys and quiet positions; interleaved `i01`/`b08` items tagged to those units.
  - [ ] §2.3 criteria 1–4.

### S2.17 — Pilot P4: `a07l4` + `a07-g1`

- **Role focus:** Xiangqi content author + bilingual content
- **Depends on:** S2.16
- **Owned files:** new `src/content/lessons/a07-positional-defence.json` (pilot lesson only), new
  `src/content/reviews/a07.json`, `src/i18n/messages.ts`
- **Acceptance criteria**
  - [ ] `a07l4` as 02 a07 (as Black, full opening-derived position, `decision` and `move` `defend` depth 2).
  - [ ] `a07-g1` (hold chain, R5 with counterplay predicate + R1) starts from a verified threat, has a reviewed threat
        tree, and passes the §5.7 guard (≥ 3 narrow positions in the reference run; real resistance) in its F1 form.
  - [ ] §2.3 criteria 1–4.

### S2.18 — `pressing` validation

- **Role focus:** architecture engineer + content reviewer (plausibility sample)
- **Depends on:** S2.6, S2.12, S2.15, S2.16, S2.17
- **Owned files:** `src/play/policies.ts` (weights only), `docs/curriculum-upgrade/measurements.md` (`pressing`
  section), new `scripts/self-play.ts`
- **Acceptance criteria**
  - [ ] Self-play of `pressing(2)` against `safe-sparring(2)` and against itself from every pilot task position, seeded,
        results recorded.
  - [ ] An independent `content-reviewer` judges a sample of ≥ 50 `pressing` moves for plausibility; weight changes and
        their reasons recorded.
  - [ ] Verdict recorded as a decision: **validated** (regime `main`; the pilot tasks pass §5.7 in their main form) or
        **not validated** (regime stays `fallback`; fallback F of 03 §5.2 applies). Either way the 03 §5.2 reachability table holds.

### S2.19 — Pilot integration and walkthrough

- **Role focus:** QA + learning-experience reviewer
- **Depends on:** S2.13, S2.14–S2.18
- **Owned files:** `scripts/ui-check.mjs`, `scripts/offline-check.mjs`, new `docs/curriculum-upgrade/pilot/walkthrough.md`
- **Acceptance criteria**
  - [ ] The preview build plays all five pieces end to end at 320/360/414, landscape and desktop, both colours,
        keyboard; flows covered: lesson → check (fail → remediation → retake) → task (incl. a voided run by fault
        injection) → J2 test-out of `a03`; a J1 placement run on a test fixture pool (not learner content) exercises
        the J1 form, the practical slot and the result screen in the preview.
  - [ ] Default build: legacy path unchanged; `ui:check`, `offline:check`, both Supabase builds pass; no console errors.
  - [ ] Findings listed with owners; blocking ones fixed or sent back to their item.

### S2.20 — Pilot review, calibration and design correction

- **Role focus:** lead integrator + curriculum designer + learning-experience reviewer
- **Depends on:** S2.19
- **Owned files:** `docs/curriculum-upgrade/design/02-curriculum.md`, `03-assessment.md`, `04-architecture.md`,
  `05-migration.md`, `07-sourcing.md`, `06-backlog.md`, new `docs/curriculum-upgrade/pilot/review.md`
- **Acceptance criteria**
  - [ ] Decisions recorded for UA1, UA2, UA6, UA7, U3, U5, U6, U8 and the MU1 entry point, with the pilot evidence;
        the void rate of each pilot R6 task (03 §5.3 rule 3) measured and, if voids repeat, its *L* or tree adjusted.
  - [ ] Calibrated thresholds (03 §5.7 rates, narrow-position count, task lengths) written into 03. Any loosening of
        a §5.7 rate or of the line-share gate is approved by `content-reviewer` and re-run on every pilot task before
        S2.gate.
  - [ ] Design documents updated to what was implemented (02-foundation-and-pilot.md "Definition of done").
  - [ ] Step 3 batch sizes confirmed or changed (§5.2); reductions (1) and (2) of §5.1 decided; anything beyond §5.1
        proposed to the owner with consequences.

### S2.gate — Step 2 gate

- **Depends on:** S2.1–S2.20
- **Acceptance criteria**
  - [ ] Pilot exit criteria §3.3 met; `reviewer` and `content-reviewer` APPROVE the step.
  - [ ] Lint, build, tests, `content:deep`, `ui:check` (default and preview), `offline:check` pass; engine untouched.
  - [ ] Material limitations documented honestly (partner regime, phones, T15).

---

## 5. Step 3 — Curriculum production

### 5.1 Volume (Verified from 02 §10 and 05 §3.1; ranges are design targets)

| Level | Units | Lessons | Practice items | Reused (target level) | Check pool | Practical tasks | Level pools |
| --- | ---: | ---: | --- | ---: | ---: | ---: | --- |
| Basic | 10 | 33 | 165–265 | 26 | 152 | 4 | `pb` 40 + 2 tasks; `xb` |
| Intermediate | 11 | 42 | 210–340 | 58 | 176 | 7 | `pi` 40 + 2; `xi` |
| Advanced | 10 | 37 | 185–260 | 25 | 160 | 6 | `pa` 40 + 2; `xa` |
| Expert | 9 | 31 | 125–185 | 37 | 140 | 8 | `pe` 40 + 2; `xe` |
| Master | 9 | 18 | 72–90 | 0 | 124 | 6 | `xm` |
| **Total** | **49** | **161** | **~760–1,140** | **146** | **~750** | **31** | ~160 items + 8 tasks; 5 exams |

Roughly 600–1,000 new practice items and ~750 new check items, plus placement and exam pools, each verified,
independently reviewed and written in two languages (a reviewer in S1.2 estimated even more, 1,000–1,600 practice
items). This is the dominant cost of the phase. Adopted reductions (02 §10): **(3)** publish level by level (05 §8.4.1)
and **(4)** generate candidate positions with seeded generators (original positions only), so authoring time goes into
classification, feedback and review. Not adopted yet, decided at S2.20 with pilot data (driver, within the 02 ranges):
**(1)** lesson sizes at the low end of the ranges (about −30 % practice items; fewer guided steps for weak learners);
**(2)** check pools of 1.5 forms for units with one primary strand (about −120 items; third attempts meet exposed
items, 03 §4.3). Options that would cut scope need an **owner decision** and are **not recommended**: deferring the
Master level (graduation would become unreachable and the course would end at Expert; the legacy u15 content is
retired into Expert in REL-4 either way) or single-form placement pools (retakes blocked until new items exist).

### 5.2 Batch plan

Batches follow level order (each unit's prerequisites and interleaved check items come from earlier units) and the
release order REL-1 Basic → REL-5 Master. A batch item may be split by the driver into per-unit sub-items (`S3.n.a`, …) with
the same criteria; the batch is done when all its units are. Pilot content (S2.14–S2.17) is completed inside its
batch, not redone.

Every batch has the same acceptance criteria, stated once here: **(B1)** every listed unit meets §2.3 criteria 1–5;
**(B2)** check pool of 2 forms per unit (16; short form 12) or the reduction decided at S2.20; **(B3)** the listed
practical tasks pass the §5.7 guard in the active partner regime; **(B4)** reused items per 05-migration.md §4 with
their change tags resolved, T2 passing; **(B5)** `docs/curriculum-upgrade/coverage.md` updated for the batch (items by
type, strand, colour, quiet, ladder step, per unit); **(B6)** units stay `reviewed` and visible only in the preview
until the level's release item.

| Item | Units | Lessons | Reuse (05 §3) | Check items (2 forms) | Practical tasks | Notes |
| --- | --- | ---: | --- | ---: | --- | --- |
| **S3.1** Basic A | b01, b02, b03, b04 | 13 | `u1l1`, `u1l2`, `u1l3`, `u2l1`, `u2l2`, `u3l1`, `u3l2` except `u2l1#3` and the mate items; `u4l1` learn cards in b02l2; BLK twins | 12 + 3 × 16 = 60 | — | Notation lesson b01l4 uses S2.3; creates `coverage.md` |
| **S3.2** Basic B | b05, b06, b07 | 9 | `u4l1`, `u4l2`, mate items of `u3l*`, `u2l1#3` | 48 | — | Rules lesson b05l3: AXF edition (03 UA3 / 07 S07-U3) checked by the content reviewer; creates `references.md` |
| **S3.3** Basic C | b08, b09, b10 | 11 (b09l3 from the pilot) | — | 16 + 16 + 12 = 44 | `b08-g1`, `b09-g1` (pilot), `b10-g1`, `b10-g2` | First full games: F2/F2b decision if `pressing` is not validated; 03 UA7 confirmed |
| **S3.4** Basic release (REL-1) | — | — | — | `pb` 40 + `pb-g1`, `pb-g2` | `xb` (+ F3 hold tasks under F) | See release criteria below; retire `u1`–`u4`; MU5 notice |
| **S3.5** Intermediate A | i01, i02, i03, i04 | 13 | `u9l1`, `u9l2`, `u11l1`, `u11l2`, `u10l1` | 64 | `i01-g1` | Cannon forks of `u9l1` (MOTIF) |
| **S3.6** Intermediate B | i05, i06, i07 | 13 | `u7`, `u8`, `u9l3`, `u11l3` | 48 | `i07-g1` | New defending-as-Black lessons i05l4, i06l5; `u8l1` NAME |
| **S3.7** Intermediate C | i08, i09, i10, i11 | 16 (i08l3 from the pilot) | — | 64 | `i08-g1` (pilot), `i09-g1`, `i10-g1`, `i11-g1`, `i11-g2` | i08 Red only, i09 Black only; endgame wins proved for exact positions |
| **S3.8** Intermediate release (REL-2) | — | — | — | `pi` 40 + 2 | `xi` | Retire `u7`–`u9`, `u10l1`, `u11`; re-track `u10` (P3); J1 into Intermediate |
| **S3.9** Advanced A | a01, a02, a03, a04 | 15 (a03 from the pilot) | `u10l3`, `u12l1`, `u12l2` | 64 (a03's 16 from the pilot) | `a03-g1` (pilot) | Assessment answer keys authored and reviewed (material-only engine) |
| **S3.10** Advanced B | a05, a06, a07 | 12 (a07l4 from the pilot) | `u10l2`, `u12l3`; `u11l3` pool items | 48 | `a06-g1`, `a07-g1` (pilot) | ≥ half Black in a07 |
| **S3.11** Advanced C | a08, a09, a10 | 10 | — | 48 | `a09-g1`, `a09-g2`, `a10-g1` | Course games for a10 (07 §3.2 option A); endgame claims exact-position or sourced |
| **S3.12** Advanced release (REL-3) | — | — | — | `pa` 40 + 2 (incl. the pilot slice) | `xa` | Retire `u10l2`, `u10l3`, `u12` |
| **S3.13** Expert A | e01, e02, e03 | 11 | `u13l2`, `u13l3`, `u14`, `u15l1`, `u15l2`, `u15l3` pool items, two `u10l1` warm-ups | 48 | `e03-g1` | Varied defence (VAR); MOTIF fixes |
| **S3.14** Expert B | e04, e05, e06 | 10 | `u13l1`, defend-3 item of `u15l3` | 48 | `e04-g1`, `e06-g1`, `e06-g2` | ≥ half Black in e04 |
| **S3.15** Expert C | e07, e08, e09 | 10 | — | 16 + 16 + 12 = 44 | `e07-g1`, `e08-g1`, `e08-g2`, `e09-g1` | Rules lesson e07l3 (reference rulebook); "draw" claims only as 02 e07 allows |
| **S3.16** Expert release (REL-4) | — | — | — | `pe` 40 + 2 | `xe` | Retire `u13`–`u15`; Master track hidden until REL-5 (P4) |
| **S3.17** Master A | m01, m02, m03, m04 | 8 | — | 64 | `m02-g1`, `m03-g1` | Unlabelled, mixed colours; decoys |
| **S3.18** Master B | m05, m06, m07, m08, m09 | 10 | — | 16 + 16 + 12 + 16 = 60 (m09 none) | `m05-g1`, `m05-g2`, `m06-g1`, `m08-g1`; `xm` pool | Course game for m08; portfolio (03 §6.1) |
| **S3.19** Master release (REL-5) and course integration | — | — | — | — | `xm` live | Whole course published; final `LEGACY_MAP`; T1 for REL-5 |

Check-item counts per batch sum to 152 + 176 + 160 + 140 + 124 = 752 (02 §10, "~750").

**Files, dependencies and serialization of every step-3 item.** All step-3 items run one after another: each owns the
shared files `src/i18n/messages.ts` and `docs/curriculum-upgrade/coverage.md` for its round (§2.2). Naming: a unit file
is `src/content/lessons/<unitId>-<slug>.json` (lessons, and the unit's extra-practice `pool`, MU1); a unit-check pool is
`src/content/assessment/<unitId>-check.json`; placement pools `src/content/assessment/p<level>.json` (items) and
`p<level>-tasks.json` (practical tasks); exam pools `src/content/assessment/x<level>.json`; review records
`src/content/reviews/<unitId>.json` (pools: `reviews/p<level>.json`, `reviews/x<level>.json`). Pilot files of S2.14–S2.17
are extended in place.

| Item | Depends on (content · serialization) | Owned files |
| --- | --- | --- |
| S3.1 | S2.gate | new unit, check-pool and review files of `b01`–`b04`; `messages.ts`; new `docs/curriculum-upgrade/coverage.md` |
| S3.2 | S3.1 | unit, check-pool and review files of `b05`–`b07`; `messages.ts`; `coverage.md`; new `docs/curriculum-upgrade/references.md` (07 §5.3) |
| S3.3 | S3.2 | unit, check-pool and review files of `b08`, `b09` (pilot file extended), `b10`; `src/content/assessment/b08-check.json` (pilot items extended); `messages.ts`; `coverage.md` |
| S3.4 | S3.3 | new `src/content/assessment/pb.json`, `pb-tasks.json`, `xb.json` and their review files; status → `published` in the Basic unit, pool and review files; delete `src/content/lessons/01-board-and-palace.json`, `02-chariot-and-horse.json`, `03-cannon-and-soldier.json`, `04-check-and-checkmate.json`; `src/content/release.ts` (state REL-1) and `src/content/release.test.ts`; `src/progress/legacy.ts` (`u1`–`u4` entries, version bump) and its test; `src/content/retired-ids.json` (only if new ids retire); `messages.ts` (retired keys removed, MU5 notice); `src/components/Home.tsx` (MU5 notice, if adopted); `coverage.md`; `CLAUDE.md` ("Lesson content") |
| S3.5 | S3.3 · after S3.4 | unit, check-pool and review files of `i01`–`i04`; `src/content/assessment/i01-check.json` (pilot items extended); `messages.ts`; `coverage.md` |
| S3.6 | S3.5 | unit, check-pool and review files of `i05`–`i07`; `messages.ts` (incl. the `u8l1` NAME rename); `coverage.md` |
| S3.7 | S3.6 | unit, check-pool and review files of `i08` (pilot file extended), `i09`–`i11`; `messages.ts`; `coverage.md` |
| S3.8 | S3.7, S3.4 | new `pi.json`, `pi-tasks.json`, `xi.json` and review files; Intermediate files → `published`; delete `07-cannon-mates.json`, `08-horse-and-chariot-mates.json`, `09-tactics.json`, `11-hidden-attacks.json`; `10-combinations.json` (remove `u10l1`, `track` → `advanced`, 05 P3); `release.ts` (REL-2), `release.test.ts`; `legacy.ts` (+ entries, version); `retired-ids.json` (if needed); `messages.ts`; `coverage.md`; `CLAUDE.md` |
| S3.9 | S3.7 · after S3.8 | unit, check-pool and review files of `a01`, `a02`, `a03` (pilot files extended), `a04`; `messages.ts`; `coverage.md` |
| S3.10 | S3.9 | unit, check-pool and review files of `a05`, `a06`, `a07` (pilot file extended); `messages.ts`; `coverage.md` |
| S3.11 | S3.10 | unit, check-pool and review files of `a08`–`a10`; course-game records for a10 (new `src/content/games/<gameId>.json`, 07 §3.2); `messages.ts`; `coverage.md` |
| S3.12 | S3.11, S3.8 | `pa.json` (pilot slice extended), new `pa-tasks.json`, `xa.json` and review files; Advanced files → `published`; delete `10-combinations.json`, `12-mate-in-3.json`; `release.ts` (REL-3), `release.test.ts`; `legacy.ts`; `retired-ids.json` (if needed); `messages.ts`; `coverage.md`; `CLAUDE.md` |
| S3.13 | S3.11 · after S3.12 | unit, check-pool and review files of `e01`–`e03`; `messages.ts`; `coverage.md` |
| S3.14 | S3.13 | unit, check-pool and review files of `e04`–`e06`; `messages.ts`; `coverage.md` |
| S3.15 | S3.14 | unit, check-pool and review files of `e07`–`e09`; course-game records for e09 (`src/content/games/`); `messages.ts`; `coverage.md` |
| S3.16 | S3.15, S3.12 | new `pe.json`, `pe-tasks.json`, `xe.json` and review files; Expert files → `published`; delete `13-expert-technique.json`, `14-mate-in-4.json`, `15-master.json`; `release.ts` (REL-4), `release.test.ts`; `legacy.ts`; `retired-ids.json` (if needed); `messages.ts`; `coverage.md`; `CLAUDE.md` |
| S3.17 | S3.15 · after S3.16 | unit, check-pool and review files of `m01`–`m04`; `messages.ts`; `coverage.md` |
| S3.18 | S3.17 | unit, check-pool and review files of `m05`–`m09`; new `xm.json` and review file; course-game record for m08 (`src/content/games/`); `messages.ts`; `coverage.md` |
| S3.19 | S3.18, S3.16 | Master files → `published`; `release.ts` (REL-5), `release.test.ts`; `legacy.ts` (final version); puzzle links of 05 §5 (`src/components/Home.tsx` or `PuzzleList.tsx`, whichever S2.13 chose for the "more practice" entry); `messages.ts` (track descriptions of 02 §3.2, no title or rating claims); `coverage.md`; `CLAUDE.md` |

**Release items (S3.4, S3.8, S3.12, S3.16, S3.19) — acceptance criteria:**

- [ ] Placement pool (`p<level>-NN`, 40 items, 4 strands × ≥ 8 incl. `full-board` RS items for Basic, 03 §7.2) and two
      placement practical tasks, reviewed and unseen; the level's exam tasks/pool reviewed and passing §5.7 in the
      active regime (S3.19: `xm` from S3.18).
- [ ] Level-wide checks: ≥ 1/3 Black items, ≥ 1/4 quiet items in PA/OD/DE units, every strand of 02 §9.2 present; the
      03 §5.2 reachability obligation met (each exam slot has a passing task in its active form).
- [ ] Release state per 05 §8.4.1: legacy lessons retired with their `LEGACY_MAP` entries (version bump), held items
      served nowhere, re-tracking (S3.8), the level `published`; T1 passes for the new state; puzzle links of 05 §5 for
      the level's units.
- [ ] J1 into this level (and J2 within it) works with the pools of the levels below; the level entry gate applies.
- [ ] Walkthrough as a new learner and as a migrated learner (fixture v1 data with completed legacy lessons): migrated
      lessons show completed, never mastered; nothing locks that was open, except the documented REL-2 case (05 P3).
- [ ] S3.4 only: the one-time notice for returning learners decided with the LX reviewer (MU5).

### S3.gate — Step 3 gate

- **Depends on:** S3.1–S3.19
- **Acceptance criteria**
  - [ ] All 49 units, 161 lessons (or the counts after any recorded S2.20 change) published, reviewed and integrated; no
        legacy lesson live; no draft served.
  - [ ] `reviewer` and `content-reviewer` APPROVE; lint, build, tests, `content:deep`, `ui:check` and `offline:check`
        pass; engine untouched.

---

## 6. Step 4 — Final validation (from 04-final-validation.md)

Defects found here go back to the item that owns the affected code or content (DRIVER.md: return to the earlier step,
fix, repeat the affected validation).

### S4.1 — Learning-journey audit and coverage matrix

- **Role focus:** curriculum designer + learning-experience reviewer
- **Depends on:** S3.gate
- **Owned files:** new `docs/curriculum-upgrade/final/coverage-matrix.md`, new `scripts/coverage-matrix.ts`
- **Acceptance criteria**
  - [ ] Generated matrix: every outcome of 02 §8 → teaching items, practice, assessment (check/placement/exam) and
        practical evidence, by strand and colour.
  - [ ] Each audit point of 04-final-validation.md "Audit the complete learning journey" answered with evidence (rules
        to complete games; openings → middlegame plans; recognition and creation of tactics; defence beyond stopping
        mate; endgame conversion and drawing tasks; both colours; unfamiliarity, branching, counterplay and sustained play
        at higher levels; no leaks; completion/mastery/application distinct; jump-ahead; migration; draft exclusion).

### S4.2 — Chess accuracy and content integrity sweep

- **Role focus:** Xiangqi content reviewer + QA
- **Depends on:** S3.gate
- **Owned files:** new `docs/curriculum-upgrade/final/content-audit.md`
- **Acceptance criteria**
  - [ ] All validators, `content:deep`, line and practical verifiers re-run; every review record's hash matches.
  - [ ] An independent re-review of a stratified sample (every unit, both colours, every exercise type) and an
        authoring-time external-engine cross-check of a sample of forced claims (07 §4, outside the repository).
  - [ ] Every claim beyond the search horizon or the implemented rules is downgraded, reworded or removed.

### S4.3 — Learner-behaviour scenarios

- **Role focus:** QA + curriculum designer (assessment)
- **Depends on:** S3.gate
- **Owned files:** new `src/assessment/scenarios.test.ts`, new `docs/curriculum-upgrade/final/scenarios.md`
- **Acceptance criteria**
  - [ ] Automated scenarios for the eight behaviours of 04-final-validation.md (memorised answers without a plan;
        tactics without defence; known line, opponent deviates; sound alternative to the engine's move; a different
        valid plan; wins material, fails to convert; hints/retries to completion; return after a long break), each with
        the expected outcome and whether the system distinguishes it; where a claim requires it and it does not, the
        defect is fixed.

### S4.4 — Scoring review

- **Role focus:** QA + content reviewer
- **Depends on:** S4.3
- **Owned files:** new `docs/curriculum-upgrade/final/scoring-review.md`
- **Acceptance criteria**
  - [ ] Checks for single-line answer bias, reliance on exact engine moves or scores, false success from weak partners,
        false failure for reasonable alternatives, claims beyond search or rules, inflation by XP, retries, hints or
        repeated items — each with evidence and fixes.

### S4.5 — Application, migration and release-path validation

- **Role focus:** QA (migration risks) + architecture engineer
- **Depends on:** S3.gate
- **Owned files:** new `docs/curriculum-upgrade/final/app-validation.md`, `scripts/ui-check.mjs` (if extended)
- **Acceptance criteria**
  - [ ] Migration across all release states REL-0 → REL-5 with fixture v1 data (T1–T14, T16–T18), rollback simulation and
        mixed builds; T15 status reported (owner action).
  - [ ] `ui:check` at 320/360/414/landscape/desktop, both colours; `offline:check`; both Supabase builds; draft
        exclusion and the release test.

### S4.6 — Learner-facing descriptions, readiness report and study plan

- **Role focus:** learning-experience reviewer + lead integrator
- **Depends on:** S4.1–S4.5
- **Owned files:** `src/i18n/messages.ts` (descriptions only), new `docs/curriculum-upgrade/final/readiness.md`,
  new `docs/curriculum-upgrade/final/study-plan.md`
- **Acceptance criteria**
  - [ ] Learner-facing descriptions match demonstrated capabilities; no official title, rating or learning-time claim.
  - [ ] Readiness report: verified strengths, defects, limitations (partner regime incl. the shallow counterplay of
        F1c conversion tasks, phones, rules not implemented,
        T15, licence), unresolved blockers; which learning-effectiveness claims need real learners.
  - [ ] Usability / pilot-study plan with metrics; no fabricated results.

### S4.7 — Release candidate and rollback notes

- **Role focus:** lead integrator
- **Depends on:** S4.6
- **Owned files:** new `docs/curriculum-upgrade/final/release-candidate.md`, `CLAUDE.md`
- **Acceptance criteria**
  - [ ] Release-candidate notes with rollback and migration steps (05 §8.7, §8.11) and the owner actions still required
        (T15, real-device runs, licence, human review sample, historical games if wanted).
  - [ ] `CLAUDE.md` describes the new course structure, commands and conventions.

### S4.gate — Step 4 gate

- **Depends on:** S4.1–S4.7
- **Acceptance criteria**
  - [ ] All 04-final-validation.md deliverables exist; `reviewer` and `content-reviewer` APPROVE; all checks pass;
        nothing deployed and nothing merged into `main` (the phase branch is pushed, DRIVER.md).

---

## 7. Proposed decisions (for DECISIONS.md)

"Owner" = an owner decision is needed (yes/no). Ids PD-nn are new; the source keeps its own numbering.

| Id | Decision | Source | Owner |
| --- | --- | --- | --- |
| PD-01 | Three separate states (completed / mastered / applied) with provenance; every unit masterable by its check (m09 by `xm`); old completion → completed only | 03 §12.1, §2 | no |
| PD-02 | Unit-check mastery ≥ 80/100 first attempt + all safety-critical items; jump-ahead ≥ 90/100 exact (display floored), per-strand ≥ 75 % (strands with < 4 items perfect), all critical items, practical evidence; placement mastery only for covered units | 03 §12.2, §4.1, §7.3 | no |
| PD-03 | Separate pools: practice, unit check, placement, placement practical, exam; drafts never served | 03 §12.3 | no |
| PD-04 | AXF rules taught as the reference; training ruleset of 03 §5.5 (perpetual check adjudicated, chase not, learner may not create a third repetition, 30-move no-capture limit, 80-move cap with material adjudication) | 03 §12.4, §8 | no |
| PD-05 | Partners and chains of 03 §5.2; assessment use of `pressing` only after validation (S2.18); fallback F otherwise (F1 with scoring leaves, F1c resist-mode conversion, F2/F2b, F3, F4 incl. `xi`, F5 for opening tasks) and the reachability table; R6 line share with fixed *L*, selectivity ≤ 1/3 and gate ≥ 2/3 (03 §5.3) | 03 §12.5, §5.2 (S1.4) | no |
| PD-06 | Safety-horizon table of 03 §5.3 as the default guard; *h* = 2 at runtime above Basic until S2.6 measures *h* = 3 | 03 §12.6 | no |
| PD-07 | Mastery merge: higher score, ties later date, deterministic tie-breaks (same in 03 §2, 04 §5.8, 05 §8.6) | 03 §12.7 | no |
| PD-08 | Notation and glossary owned by the curriculum (02 §4), orientation mechanics by the architecture; glossary file `docs/curriculum-upgrade/glossary.md` from S2.3 | 03 §12.8; 02 U2 | no |
| PD-09 | No XP and no hearts for assessments; purity test against `src/gamification` | 03 §12.9, §9 | no |
| PD-10 | Runtime engine: option A, in-repo search in a Web Worker; no engine binary shipped | 04 §7.1 | no |
| PD-11 | External engines only at authoring time, outside the repository, as evidence (not verification) | 04 §7.2; 07 SD3 | no |
| PD-12 | A GPL engine in the app (option B) only if the pilot shows option A insufficient, after the licence decision and a cross-origin-isolation test | 04 §7.3 | **yes** (conditional; not needed today) |
| PD-13 | Budgets: UI-thread ≤ ~50 ms, Worker request ≤ ~300 ms desktop at depth/node limits (node cap ~20,000); d = 3 only in positions of ≤ ~12 pieces; confirmed in S2.6 | 04 §7.5 | no |
| PD-14 | Strategic acceptance by complete reviewed move tables + objective predicates + safety guard, never by equality with an engine's first choice; content classes target/sound/dubious/error, mapped to 04's names | 04 §5.3–§5.4; 02 §5.3 (S1.4) | no |
| PD-15 | "Not checked" moves and device fallback moves void assessment items and runs (no credit, no penalty, no retry counted) | 04 §5.4–§5.5; 03 §3.2, §5.6 (S1.4) | no |
| PD-16 | `forcing-attack` winning capture: a capture with `moveScore` − balance ≥ 2 at d = 2 + quiescence (3 in ≤ ~12 pieces), highest first, seeded ties | 03 §5.2; 04 §5.5 (S1.4) | no |
| PD-17 | `safe-sparring(2)` is used beyond "early Basic practice only" (04 §5.6): also for `b08-g1`, `b09-g1`, F2/F2b games and the F5 continuation, never scoring a result — 03 overrides 04 here | 03 §5.2; 04 §5.6 (S1.4 carry-over) | no |
| PD-18 | Licence of code and content; contributor terms | 04 R4; 07 S07-U2 | **yes** |
| PD-19 | Successor rule and the 05 §3 map; reused items are practice only (MD1) | 05 §10 | no |
| PD-20 | Legacy completion derived at read time from v1 + versioned `LEGACY_MAP`, never stored, never mastery/applied; deviations from 04 §5.8 and 03 §2 rule 5 accepted (MD2) | 05 §10 | no |
| PD-21 | New evidence in `learning.records.v1` and a `data_v2` column; `data` keeps the v1 shape; v1 dual-written for live legacy lessons only; no reverse map (MD3). T15 on a real project before any deploy that writes `data_v2` | 05 §10; 04 R5 | no (T15 is an owner **action**) |
| PD-22 | Orphan ids and ids whose meaning changed on 2026-10-21 read by current meaning / ignored (MD4) | 05 §10 | no |
| PD-23 | Additive-only changes within a key; breaking changes get a new key and column (MD5) | 05 §10 | no |
| PD-24 | Phased publishing P1–P5; release order REL-1 Basic → REL-2 Intermediate → REL-3 Advanced → REL-4 Expert → REL-5 Master; `u10` re-tracked before `u12` with the documented REL-2 locking case (MD6, S1.4) | 05 §8.4.1 | no |
| PD-25 | Attempt log local only; the `exposed` id set syncs (MD7, MU6) | 05 §10, §11 | no |
| PD-26 | Legacy `pool` items live in per-unit extra-practice pools (MU1 option a) | 05 §11 | no |
| PD-27 | Reset clears v1 completion, records (incl. mastery and applied) and the attempt log (MU3) | 05 §8.5, §11 | no |
| PD-28 | First real completion of a migration-completed lesson earns 10 XP (MU4) | 05 §8.5, §11 | no |
| PD-29 | Original positions only (`generated`, `authored`, `derived`, `course-game`, `legacy`) (SD1) | 07 §11 | no |
| PD-30 | Annotated games: course games only until the owner decides on historical games (SD2) | 07 §11; S07-U1 | **yes** (only to allow historical games) |
| PD-31 | Review records in `src/content/reviews/`, bound to id + version + hash, author ≠ reviewer (SD4) | 07 §11 | no |
| PD-32 | Drafts outside the loaders; release test (SD5) | 07 §11 | no |
| PD-33 | Ids never reused; `retired-ids.json` (SD6) | 07 §11 | no |
| PD-34 | No citation, quotation, game or historical claim from model memory (SD7) | 07 §11 | no |
| PD-35 | Level entry gate for published new-course levels: Basic open; a higher level opens when the previous level is completed (incl. placement and migration), by passing J1, or when the learner already has a completed lesson in that level or above; legacy tracks keep today's rule while live. Reverses the phase-1 "first lesson of every track open" behaviour for new levels (01-audit A1; 03 §7.2) | S1.4; 03 §7; 05 P5 | no (flagged to the owner in S4.6) |
| PD-36 | Unlocking stays linear within a level; revisited at S2.20 | 02 U3 | no |
| PD-37 | No decision timer in this phase | 02 U7 | no |
| PD-38 | One notation: moves `from-to` in ICCS (`h2-e2`) in documents, scripts and validator output; main-line signatures `.` `+` `x` `X` | 02 §4 (S1.4) | no |
| PD-39 | Units ordered by track rank then file name; a course preview (`VITE_COURSE_PREVIEW`) shows reviewed units of unpublished levels, never in production builds | 05 P3; S2.2 (S1.4) | no |
| PD-40 | Grants earned under fallback F record which fallback applied; not revoked when `pressing` is validated later | 03 §5.2; 05 §8.3 (S1.4) | no |
| PD-41 | Pilot scope (five pieces, §3.1) and exit criteria (§3.3) | 06 §3 | no |
| PD-42 | Step-3 batch plan, "done" definition and adopted reductions (3) and (4); reductions (1) and (2) decided at S2.20; any scope reduction beyond them needs the owner | 06 §2.3, §5 | no (beyond §5.1: **yes**) |
| PD-43 | Shared files have one owner per round; items needing the same shared file are serialized | 06 §2.2; DRIVER.md | no |
| PD-44 | A human reviews a sample of every level's assessment items before any deploy (recommended) | 07 S07-U4 | **yes** |

---

## 8. Open items register (all documents)

**This is the canonical open-items register.** Only genuinely open items; each has an owner. The tables in the other
documents keep resolved rows (with a pointer) for traceability.

| Id(s) | Question | Owner |
| --- | --- | --- |
| 03 UA1 | "Needs review" badge after a failed warm-up | S2.20 |
| 03 UA2 | Daily retake limit for single-unit J2 | S2.20 |
| 03 UA3 = 07 S07-U3 | Rulebook edition to cite; CXA differences | S3.2 |
| 03 UA5 (cost) = 04 R6 = 02 U6 (budget) | Phone cost of partners and post-game signals | S2.6 (+ owner action: real devices) |
| 03 UA5 (validation) | Whether `pressing` passes validation | S2.18 |
| 03 UA6 | §5.7 guard rates and narrow-position count | S2.20 |
| 03 UA7, 02 U6 (lengths) | Task and game lengths on a phone | S2.20 (confirmed again in S3.3) |
| 02 U3 | Prerequisite graph instead of linear unlocking | S2.20 |
| 02 U5 | Setting to show ICCS coordinates | S2.20 |
| 02 U8 | Lesson sizes; reductions (1), (2) | S2.20 |
| 04 R5 (column) = 05 MU2 | Old builds leave `data_v2` untouched (T15) | S2.11 + owner action before deploy |
| 05 MU5 | One-time notice for returning learners | S3.4 |
| 04 R4 = 07 S07-U2 | Licence of code and content | Owner |
| 07 S07-U1 | Historical games | Owner |
| 07 S07-U4 | Human review sample before release | Owner (S4.7 asks again) |
