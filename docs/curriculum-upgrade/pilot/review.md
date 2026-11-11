# Pilot review, calibration and design correction (S2.20 part B)

Date: 2026-11-11. Measurements taken on `95f157b` (S2.19); document revised on `67c13e5` (S2.20 part A, which changed only
texts, not positions, tables or trees). Partner regime: `fallback` (D16). Release state: REL-P.
Role: lead integrator + curriculum designer + learning-experience reviewer.

This file holds the **proposed** decisions of S2.20. The driver copies the final ones into DECISIONS.md; STATUS.md and
BACKLOG.md are not edited here. Part A of S2.20 is closing finding **W10** (practice `.error` texts that name the
accepted moves) in parallel: the texts, a new check `src/content/pilot-feedback.test.ts`, and a fresh content review.
W10 is not part of this file.

Evidence used: STATUS.md (S2.12–S2.19), DECISIONS.md D11–D16, measurements.md (§3, §6), pressing-sample.md,
pilot/walkthrough.md, the pilot content in `src/content/lessons/{b09,i08,a03,a07}-*.json` and
`src/content/assessment/*.json`, and the new measurements in §1 below.

## 1. New measurements (this item)

### 1.1 §5.7 checks, 20 seeds, active regime (`fallback`)

Command: `npx tsx scripts/verify-practical.ts <unit> --runs 20`. The four runs went in parallel on the 4-vCPU container.

| Task | Form | 1 reference | 2 N1 fails ≥ 90 % | 2 N2 fails ≥ 80 % | 3 narrow positions | 5 resistance | 6 second plan | Void rate (< L counted moves) | Wall time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `b09-g1` | F5, cap 8, L = 6 | 20/20 (100) | 20/20 = 100 % (0 void) | 19/19 = 100 % (1 void) | N/A, ruling A | — | 20/20 | 1/80 | 51 s |
| `i08-g1` | F5, cap 8, L = 6 | 20/20 (100) | 18/18 = 100 % (2 void) | 18/18 = 100 % (2 void) | N/A, ruling D | — | 20/20 | 4/80 | 191 s |
| `a03-g1` | F1, cap 4 | 20/20 (100) | 20/20 = 100 % | 20/20 = 100 % | N/A, ruling F | — | 20/20 | 0/80 | 38 s |
| `a07-g1` | F1, cap 4 | 20/20 (100) | 20/20 = 100 % | 19/20 = 95 % | 3 | PASS | 20/20 | 0/80 | 53 s |

These match the S2.14–S2.17 records in STATUS.md (b09 void 1/80, i08 void 4/80, a07 N2 95 %).

### 1.2 Void rate of the R6 tasks (03 §5.3 rule 3)

Only `b09-g1` and `i08-g1` score line share (R6). A run is voided when it ends with fewer than *L* counted moves.

- **50 seeds** (`--runs 50`): `b09-g1` 3/200 voided (N1 2/50, N2 1/50; reference 0/50, second plan 0/50; 126 s);
  `i08-g1` 15/200 voided (N1 10/50, N2 5/50; reference 0/50, second plan 0/50; 394 s). All other checks pass at 50
  seeds. N2's voids stay ≤ 1/5 (ruling D's condition): 5/50 = 10 %.
- **Partly competent learners** (scratch probe, not committed). Procedure, reproducible with a ~20-line tsx script:
  load the unit JSON, take its `play` item `ex` and `ref = ex.reference[0]`. For each *j* = 0…6 define the learner
  `(ctx) => ctx.learnerIndex < j ? referenceLearner(ref)(ctx) : safeShuffler(ctx)` (both exported by
  `src/assessment/practical.ts`). Run `simulateTask(ex, 'fallback', 1000 + s, learner, { analyzer: directAnalyzer() })`
  for s = 1…10 (`directAnalyzer` from `src/play`). Count runs whose `result.score.voids` includes `'line-share-window'`
  (window voids), runs with `result.score.voided`, and passes among the non-voided runs. Run the script with an async
  `main()` in a `.mts` file, since tsx's CJS output rejects top-level await. Voided runs: **0/70** for
  `b09-g1` and **0/70** for `i08-g1`. Runs counted as passed rise with *j*: b09 0, 0, 1, 0, 10, 10, 10 of 10; i08 0, 0,
  2, 4, 10, 10, 10 of 10. (*j* ≥ 4 passes because 4 credited moves out of *L* = 6 meet the 2/3 gate.)
- **Reading.** Voids occur only in runs that leave the tree at once and play randomly (N1, N2). They never occurred in
  140 runs that follow the tree for some moves and then deviate, nor in any reference or second-plan run. So voids do
  not repeat for learners who try the task. **No change to *L* or the trees.** *L* = 6 is already the minimum (rule
  3), so the only possible adjustment would be a longer tree, and the evidence does not call for one.
- **Watch:** `i08-g1` N1 voids 10/50 = 1/5, **exactly at the limit** of the void cap that S2.20 extends to N1 (§3); at
  20 seeds it is 2/20. It passes today, with no margin. A later change to the i08 tree must keep both N1 and N2 voids
  ≤ 1/5. If N1 goes over, the remedy is a longer tree (*L* cannot go below 6). The local void log (03 §5.6) is the field evidence once real learners exist (S4).

### 1.3 Check-pool and J2 capacity (scratch probe on `assembleCheckForm` / `assembleJ2`, real pilot pools)

- **a03 check, 16 own items** (`a03-check.json`) + the 4 interleaving items (`i01-check`, `b08-check`), every form
  marked exposed after it is played: attempt 1 builds (6 own, 0 exposed), attempt 2 builds (6 own, 0 exposed),
  attempt 3 builds (6 own items of the 8-item form, 4 of them exposed), attempt 4 is `cannot-build`.
- **The same with a 12-item own pool** (the 12 items of attempts 1–2, i.e. reduction (2)'s "1.5 forms"): attempt 3
  is `cannot-build`. Reason (`src/assessment/checks.ts`, `checkConstraints` / `assembleCheckForm`): a form needs
  exactly 6 own items (8-item form: 6 own + 2 interleaved) and at most ⌊8/2⌋ = 4 exposed items, so at least 2 own
  items must be unexposed.
- **Check attempts left after a failed J2 top-up (O1).** Same pool, with *t* own check items marked exposed before the
  first check (16 rotations of which items, seeds varied): *t* = 0 → 3 attempts; *t* = 4 → 2; *t* = 6 → 2; *t* = 9 → 1;
  *t* = 10 → 1; *t* = 14 → 1 (minimum = maximum over the 16 rotations). Arithmetic under 03 §4.3 with the implemented
  picker (unexposed items first): with *u* unexposed own items, ⌊*u*/6⌋ fresh forms can be built, plus one
  half-exposed form if the *r* = *u* − 6⌊*u*/6⌋ items left are ≥ 2 (2 unexposed + at most 4 exposed = 6 own).
  *u* = 16: 2 + 1 = 3; *u* = 12: 2 + 0 = 2; *u* = 10: 1 + 1 = 2; *u* = 7: 1 + 0 = 1; *u* = 2: 0 + 1 = 1.
- **J2 test-out of a03** (`pa.json`: 10 items, all tagged a03): the first form takes all 10 items. Once they are
  exposed, a retake is `cannot-build` (at most 5 of 10 may be exposed). The app then offers the old jump test
  instead (`jumpInfo` in `src/App.tsx`: J2 only when `placementOffer` is available, else `legacy`).

## 2. Decisions (proposed text for DECISIONS.md)

| Id | Decision | Pilot evidence |
| --- | --- | --- |
| **UA1** | **No "needs review" badge.** A failed warm-up gives suggestions only, as implemented. Closed for this phase; to be revisited only with real-learner data (S4). | The warm-up serves at most 5 items, one per mastered unit before any second (`warmUpItems`, checks.ts). That is about one item per unit, against 8 for a check, which is too little to relabel a unit. Mastery is not revoked by time (03 §4.5). The walkthrough could not reach the warm-up (it needs 30 days of inactivity), so there is no pilot learner evidence for a badge. |
| **UA2** | **Keep one J2 attempt per target per local day.** It is counted at Start, and "could not be assessed" releases it, as implemented. | The binding limit is pool size, not the daily limit (§1.3): the pilot's a03 J2 uses all 10 `pa` items, so even a next-day retake cannot be built. Relaxing the limit would only use up items faster. The pool-size consequence for production goes to the owner (O1). |
| **UA6** | **§5.7 thresholds kept, not loosened.** N1 fails ≥ 90 %, N2 fails ≥ 80 %, 3 narrow positions, line-share gate ≥ 2/3 with *L* ≥ 6. Rulings A, D and F (D13–D15, already approved) are written into 03 §5.7. **Two tightenings:** the release record uses ≥ 20 seeds, and the voided runs of **each** naive learner (N1 and N2) must be ≤ 1/5 of its runs for item 2 to count, for every task (until now only N2, under ruling D). `i08-g1` N1 sits exactly at the cap (10/50). | §1.1: every pilot task passes at 20 seeds, and the R6 tasks also at 50. In the main regime (measurements §6.2) the 80 % rule caught a real weakness: `a07-g1` N2 failed only 70 %. The R6 bound N2 ≤ 73/729 ≈ 10 % pass (L = 6) matches the measured 100 % failure. Highest N2 void share measured: `i08-g1` 10 % (§1.2). |
| **UA7** | **Keep the 80-move cap and the 30-move no-capture limit** for b10, `xb` and `pb-g*` full games. The game is saved after every move (`play.inProgress.v1`), so it can span sessions. Confirmed again in S3.3 with the first full-game task, which records the learner time of a scripted game at 360 px. | Compute is not the limit. Under D16 the full-game partner is `safe-sparring(2)` (F2): mean 0.19 s per move at the 6× proxy, about 15 s over 80 moves. Signals are computed during the game in the Worker (S2.12), so there is no post-game wait. Full games are not in the pilot, so the learner's time is unmeasured. Topic 10 must stay complete games (02 §9.1). |
| **U3** | **Unlocking stays linear within a level** (PD-36 confirmed). Closed for this phase. | The walkthrough skipped ahead through J2 (a07l4 locked → dialog → test → open) and J1 (fixture pool). The PD-35 level gate and the first-lesson-open rule worked in the preview. Nothing in the pilot needed a prerequisite graph. |
| **U5** | **No ICCS setting for learners.** Texts use traditional notation. ICCS appears only where input needs it: board accessible names and the keyboard `MovePicker`, which shows "square · traditional move". Closed. | Every pilot text is in traditional notation (`formatMove`; 21,124 comparisons in S2.3, 0 differences). The desktop keyboard walkthrough passed with the picker and the board tab stop (W2). No step needed ICCS in the text. |
| **U6** | **Task lengths calibrated for the fallback regime** (03 §5.7 "Calibrated task lengths"): F5 opening tasks cap 8 (*L* = 6); F1 plan and hold tasks cap 4–8, bounded by the tree, with ≥ 3 selective (plan) or ≥ 3 narrow (hold) learner nodes on the reference path; F2 games 80 / 30 (UA7); F1c set per task by its reference line (first in S3.7, `i10-g1`). The 02 §6 lengths (10–30) stay the targets for a validated main regime only. | Pilot caps: `b09-g1` and `i08-g1` 8, `a03-g1` and `a07-g1` 4. All pass §5.7 (§1.1). In the main regime the cap-4 `a03-g1` failed, because its lines were written for F1 (measurements §6.2). Compute does not limit length (D9). The consequence for "sustained play" goes to the owner (O2). |
| **U8 / §5.1 (1)** | **Reduction (1) adopted: lessons at the low end of the 02 §5.2 ranges.** That is 5 non-`learn` items per lesson in Basic, Intermediate and Advanced, and 4 in Expert and Master, with a practical task counted where it sits (as `a03l3`). The ladder minimums stay (Basic/Intermediate G2 ×2, G1 ×2, G0 ×1), as do every unit's TR task, Black coverage and quiet items (02 §10). A unit may go above the low end where a reviewer records why. | Pilot lessons: `b09l3` 7, `i08l3` 6, `a03l1`–`a03l3` 5 each, `a07l4` 6. The low-end lessons played end to end, and no review asked for more items. Review cost was the bottleneck: every pilot unit took 2–3 content-review attempts. Volume becomes the 02 §10 low end, ~760 practice items instead of up to ~1,140 (about −30 %). |
| **U8 / §5.1 (2)** | **Reduction (2) not adopted.** Check pools stay at 16 items (short form 12). | §1.3: a 12-item pool allows only two attempts. The third is "unavailable until new items exist", not "partly exposed" as 02 §10 assumed. Adopting (2) would need more than half exposed items in a form, a loosening of 03 §4.3. With 16 items, three attempts build. The pilot's fail → retake used 12 distinct own items (walkthrough). |
| **MU1 entry point** | **Confirmed:** "More practice" (`unit.morePractice`) on the unit panel of Home, shown only when the unit has a served `pool`. It runs as a lesson (`morePracticeLesson`: hearts as lessons, no XP, no mastery). Remediation uses the lessons' G1/G0 items, not the pool (as implemented). It is walked through in the first batch that ships a unit `pool`. | No pilot unit has a `pool`, so the walkthrough never showed the button; component tests cover it (S2.13). It sits after the check buttons, so it does not compete with the unit check. |

### 2.1 Learning-experience decisions from the S2.19 notes

| Note (walkthrough "Notes for S2.20") | Decision |
| --- | --- |
| Interleaving outside the path | **Accept.** In production the batches follow level order, so interleaving pools always come from units earlier in the path. The REL-P preview exposes two `b08` / `i01` items early. This is harmless: those pools hold 2 items each and will grow to 16 in S3.3 / S3.5. |
| Shared strand | **No change.** The assembler prefers same-strand items; the pilot's interleaving pools have 2 items each, so it falls back. Step 3 pools of 16 give it a real choice. |
| Dubious rows without a reason in check items | **Authoring rule for step 3:** every `dubious` row of a check, placement or exam item has an authored reason, so nothing generic is shown. Content rule for 02 §7; checked by the content reviewer. |
| Placement feedback after each item | **Accept the implemented behaviour.** Placement shows right/wrong plus the played row's reason and the refutation; the answer-revealing parts are hidden (W3). This replaces 03 §7.2's "explanations on the result screen": the row reason concerns the learner's own move and does not name the key, and items are not repeated within a form. 03 §7.2 updated. |
| Remediation learn cards | **Authoring rule for step 3:** each misconception listed in a unit has at least one `learn` card carrying its tag, so §4.4 remediation can add it (the a03 cards had no tags). |
| Board points ~35 px at 320 px | **Keep for this phase.** The board is not a control under the 44 px rule. The board keyboard (W2) and the move picker are the alternatives. Revisit in S4 (accessibility audit). |
| W6 (legacy level descriptions in the preview) | The track descriptions are written in S3.19 (02 §3.2). W8 (duplicate "Black to move") is a text fix for step 3 (prompts). |

## 3. Calibrated thresholds (written into 03 §5.7)

| Threshold | Before | After S2.20 | Change |
| --- | --- | --- | --- |
| N1 failure rate | ≥ 90 % | ≥ 90 % of non-voided runs, ≥ 20 seeds; N1 voids ≤ 1/5 of N1 runs | Unchanged rate; **tightened** (`i08-g1` is at the cap: 10/50) |
| N2 failure rate | ≥ 80 % | ≥ 80 % of non-voided runs, ≥ 20 seeds; N2 voids ≤ 1/5 of N2 runs | Unchanged rate; **tightened** (the void cap now applies to every task) |
| Narrow positions (item 3) | ≥ 3 in the reference run | ≥ 3; replaced only by ruling A or D (R6-gated tasks) or ruling F (R3/R4 tasks), each with its conditions | Unchanged count; rulings A/D/F were approved in D13–D15 and re-run here on every pilot task (§1.1) |
| Line-share gate | ≥ 2/3, *L* ≥ 6, selectivity 0 < credited ≤ 1/3 | Same | Unchanged |
| Task lengths | 02 §6 targets (main regime) | Calibrated F-regime lengths (U6) | New table; does not loosen a rate |

**No §5.7 rate and no part of the line-share gate is loosened.** Rulings A, D and F are exceptions to item 3. The
content-reviewer approved them in S2.14–S2.16 (D13–D15). Writing them into 03 adds no new exception. They are listed
here so that S2.gate can see them, and the 20-seed re-run of §1.1 is their re-run on every pilot task.

## 4. Design documents updated (what was implemented)

- **02-curriculum.md:** §5.2 lesson sizes (reduction (1)); §6 lengths under F; §7 two authoring rules (dubious
  reasons, learn-card tags); b09 / i08 / a03 / a07 entries as built; §10 reductions decided; §11 U3, U5, U6, U8
  closed; ruling G (realism) in §6.
- **03-assessment.md:** §4.1 feedback in assessments (W3); §4.3 check pools stay 16; §4.5 UA1; §5.2 regime
  `fallback` (D16), `b09-g1` as built (Red only, F5 tree + R6); §5.3 void-rate result; §5.7 calibrated thresholds,
  rulings A/D/F, task lengths; §7.2 placement feedback; §7.4 UA2; §11 limitations; §13 UA1, UA2, UA6, UA7.
- **04-architecture.md:** new §9 "As implemented in step 2": module layout as built, request kinds, client fallback,
  validator shards and memo, assessment mode, partner regime, pool decisions without predicates; §8 R6 / R7 status.
- **05-migration.md:** new §12 "As implemented in step 2" (records, REL-P, placement record files, J2 fallback
  observation); MU1 entry point confirmed in §11.
- **07-sourcing.md:** §2.1 ruling G (realism); §5.2 placement record files, approval rule, author/reviewer format as
  built; §6 statuses as built (`verified` until review, preview shows `reviewed`); §10 W10 lesson.
- **06-backlog.md:** §3.1 P1 `b09-g1` as built; §5.1 reductions decided and placement pools ≥ 6 per unit (O1); §5.2
  batches confirmed with per-unit sub-items by default, S3.3 note (F2 per D16), release rows and criteria with the new
  pool sizes, S3.3a pointer.
- **O1 (attempt 2):** 03 §7.2 J2 assembly with top-up, §7.4 retake and Fail text, §12 decision 3 departure; 02 §10
  placement pool sizes; 05 §12 J2 entry updated.

## 5. Step 3 batch sizes (06 §5.2)

**Confirmed: the 19 batch items keep their units, lessons and check-item counts** (752 check items: (2) is not
adopted). Changes:

1. **Per-unit sub-items by default** (`S3.n.a`, …). Each holds one unit's lessons, check pool, task and review record,
   with B1–B4 and B6 checked per sub-item and B5 (`coverage.md`) once per batch. Evidence: every pilot unit needed
   2–3 content-review attempts (S2.14 2, S2.15 3, S2.16 3, S2.17 3), and S2.16 (one unit + pools) was the largest
   pilot item.
2. **Practice items per lesson at the low end** (reduction (1)).
3. **Every sub-item runs the `.error` leak check** that part A adds (`pilot-feedback.test.ts`, extended to all
   new-course items), so W10 cannot recur.
4. **Runtime watch:** `npm test` took ~185–230 s at 1,265–1,300 tests with four pilot units. S3.1 records the time
   after its first unit; if `npx vitest run src/content` grows past ~5 min, the shards (`validate-shard-*.test.ts`,
   k mod 4) are split further before the next batch.

## 6. Owner decisions (decided 2026-11-11)

The owner was asked two questions that go beyond 06 §5.1 (O1, O2) and decided both on 2026-11-11. No reduction beyond
06 §5.1 is proposed. Deferring Master, or single-form placement pools, stays not recommended (06 §5.1).

### O1 — J2 capacity: decided "(b) + partial (a)"

**Problem.** J2 takes only placement items tagged with the skipped units, at least 10 (`assembleJ2`, `j2Length`). A
40-item level pool spread over 9–11 units has about 4 items per unit, so a J2 that skips one unit could not be built.
A retake needs at most half the form exposed (§1.3). The current fallback (`jumpInfo`, App.tsx) is the legacy jump test
made of practice items. That conflicts with 02-foundation-and-pilot.md ("Jump-ahead tests must … use independent
assessment items") once a level is published.

**Decision (owner).**
- Author **≥ 6 placement items per unit**: `pb` 60, `pi` 66, `pa` 60, `pe` 54, so 240 instead of 160 (+80 items).
- Fill the rest of a J2 form from the skipped units' **unexposed check-pool items** (the top-up).

Options not chosen: (a) alone, ≥ 15 items per unit (+~440 items); (c) no J2 when no form can be built; (d) a lower J2
minimum.

**J2 assembly (written into 03 §7.2).**
1. Unexposed placement items of the skipped units, one per unit before any second.
2. Then unexposed check-pool items of the skipped units (the top-up), only as many as the size needs.
3. If no fresh form exists: at most half the form may be exposed, and those must be exposed **placement** items.
   Check items are never served exposed in J2.
4. If even that fails, J2 is unavailable with an explanation (J1 or working through remain). In a published
   new-course level this never falls back to the old jump test. This last-resort rule is option (c)'s fallback. It
   follows from the independence requirement; the driver should confirm it with the decision.

With ≥ 6 items per unit, on a **first** attempt only a single-unit J2 needs a top-up, of 10 − 6 = 4 items. Two
skipped units need 10 of 12, and three or more have 4 × units placement items available. Retakes can top up more: a
two-unit retake has 2 unexposed placement items, 5 exposed placement slots and needs 3 check items.

**Consequences.**
- *Fewer unit-check attempts after a failed J2* (§1.3, 03 §4.3: a form takes 6 own items, at most 4 exposed). A failed
  single-unit J2 leaves its 4 topped-up check items exposed, so that unit's check pool of 16 has 12 unexposed own items:

  | Single-unit J2 attempts failed | Check items exposed by J2 | Unexposed own items | Unit-check attempts left |
  | --- | --- | --- | --- |
  | 0 | 0 | 16 | 3 (6 + 6 fresh, then 4 fresh + 2 exposed) |
  | 1 | 4 | 12 | **2** (6 + 6 fresh; then 0 unexposed, so no form) |
  | 2 | 4 + 5 = 9 | 7 | **1** (6 fresh; 1 left < 2) |
  | 3 | 9 + 5 = 14 | 2 | 1 (2 fresh + 4 exposed) |

  - The 2nd and 3rd J2 attempts take 5 check items each: the 6 exposed placement items can fill at most 5 of the 10
    slots (rule 3).
  - With a top-up of 6 (only 4 placement items per unit), one failed J2 would also leave 2 attempts. Measured with
    *t* = 6, it gives 2.
  - After "unit-check attempts left" are used, the check is unavailable until new items exist (03 §4.3).
  - The daily J2 limit (UA2) spaces these attempts at least a day apart.
- *Placement mastery partly rests on check-pool items.* A unit mastered by a single-unit J2 has 4 of its 10 items
  from the unit's check pool. Check items are independent, neutrally prompted and reviewed (03 §4.2), so the evidence
  stays independent. This is still a **departure from 03 §12 decision 3** ("separate pools"), for J2 only, and is
  written there.
- *A passed J2 needs no check for that unit* (the unit is covered and mastered by placement), so its 4 exposed items
  cost nothing. The cost falls on learners who fail a J2 and then work through the unit.
- *Interleaving.* Later units' checks interleave from earlier check pools. Exposed items reduce their fresh candidates,
  and those checks fall back to half-exposed forms sooner.
- *Volume.* +80 placement items (the 02 §10 and 06 §5.1 tables are updated); check pools are unchanged.

**Code change needed before REL-1.** This lives in `src/assessment/placement.ts` (`assembleJ2`),
`src/components/assessmentRuns.ts` (check pools passed to J2) and `src/App.tsx` (`jumpInfo`: no old jump test for
published new-course levels), with tests. None of these is an owned file of a step-3 batch, so a new item is proposed
for the driver to add:

> **S3.3a — J2 top-up and no legacy fallback in published levels.** Role: architecture engineer + content reviewer
> (assessment logic). Depends on S3.3. Must be done before S3.4.
> - Owned files: `src/assessment/placement.ts` + test, `src/components/assessmentRuns.ts` + test, `src/App.tsx`
>   (`jumpInfo`), `src/i18n/messages.ts` ("test-out unavailable" text), `CLAUDE.md`.
> - Acceptance criteria:
>   - J2 assembly per 03 §7.2: placement first, unexposed check top-up, exposed placement only, never exposed check
>     items.
>   - J2 unavailable, with text, when no form exists in a published level.
>   - Exposure of topped-up items logged.
>   - Tests reproduce the attempts table above.
>   - The pilot preview (REL-P) keeps working.

### O2 — Sustained play under fallback F: decided (a), accept and disclose

**Decision (owner).** Accept the short practical evidence above Basic under fallback F (D16):
- plan and hold tasks are tree-bounded (F1, pilot caps 4);
- opening tasks have 8 learner moves (F5);
- only F1c conversions and Basic full games run longer.

No `pressing` re-validation item is added now. The D16 checklist stays the route if one is wanted later; grants earned
under F stay valid (PD-40).

**Where it is disclosed.**
- In the course, today: the partner disclosures on the task screen (`disclosureKeys`), and task texts such as
  `i08-g1.p` (ruling D).
- In records: the `fallback` provenance on every grant, listed in the m09 portfolio (03 §6.1).
- In design: the limitation statement in 03 §11 and 03 §5.7 "Calibrated task lengths".
- In step 4: the learner-facing course descriptions and the readiness report (S4.6, which should state that practical
  evidence above Basic is tree-bounded and short while the partner regime is `fallback`), and the release notes
  (S4.7).

## 7. For the driver (not in the owned files)

- 06 §3.1 P1 (`b09-g1` as built) and the 06 §5.2 S3.3 note (F2 first per D16) are now corrected in 06, at the
  coordinator's request in attempt 2.
- Add S3.3a (O1, above) to BACKLOG; record O1 and O2 in DECISIONS with the owner date 2026-11-11.
- DECISIONS: record §2 and the O1/O2 outcomes; mark UA1, UA2, UA6, UA7, U3, U5, U6, U8 closed in the 06 §8 register
  (the register is outside 06 §5).
