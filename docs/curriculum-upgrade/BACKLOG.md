# Curriculum upgrade — backlog

Work items for the phase, in dependency order. The driver ([DRIVER.md](./DRIVER.md)) picks the first `todo` item
whose dependencies are `done`. Status: `todo` · `in-progress` · `done`. Items of later steps are added by step 1
(S1.4 writes the prioritized implementation backlog that replaces the placeholders for steps 2–4).

Design documents live in `docs/curriculum-upgrade/design/`.

---

## Step 1 — Audit and design (no application behaviour changes)

### S1.1 — Current-state audit and exercise-architecture feasibility

- **Status:** done (attempt 2, 2026-10-22: tester findings fixed; reviewer and content-reviewer APPROVE)
- **Role focus:** architecture engineer (+ QA for counts)
- **Depends on:** —
- **Owned files:** `design/01-audit.md`, `design/04-architecture.md`
- **Acceptance criteria**
  - [x] `design/01-audit.md`: verified counts (units, lessons, practice exercises by type and goal, learn cards,
        puzzles by kind, tracks), with the command/script used to count; colour coverage; how jump-ahead,
        progress, gamification and sync work, with `file:line` references; the historical findings in
        `01-audit-and-design.md` confirmed or corrected.
  - [x] `design/04-architecture.md`: engine and solver capabilities and limits (rules not implemented, search
        depth/time on a phone), exercise model today, what is needed for: playing Black (orientation,
        coordinates), branching continuations, multiple acceptable moves, strategic (non-tactical) acceptance,
        constrained training opponents, practical-play tasks, repetition adjudication, three-level progress
        (completed / mastered / applied); integration options (in-repo search in a Web Worker vs an external
        engine such as a WASM build) with licensing, size, offline and performance notes; recommendation.
  - [x] Verified facts, design proposals and unresolved decisions are visibly separated.
  - [x] No application code changed.

### S1.2 — Curriculum and assessment specification

- **Status:** done — closed through S1.4 (2026-10-23): its remaining finding was fixed in S1.4 and approved there
- **Role focus:** curriculum designer (+ learning-experience)
- **Depends on:** — (reads the code itself; reconciled with S1.1 at S1.4)
- **Owned files:** `design/02-curriculum.md`, `design/03-assessment.md`
- **Acceptance criteria**
  - [x] Every unit: stable id, level, prerequisites, competency tags (six strands), observable outcomes, lesson
        titles + objectives, exercise types and scaffolding progression, guided / independent / transfer tasks,
        misconceptions + feedback requirements, assessment and remediation criteria.
  - [x] All six strands and the 50-topic baseline covered (any split/merge/reorder justified); both colours;
        attack and defence; positions with no immediate tactic; plans before opening memorization; difficulty
        grows through fewer hints, unfamiliarity, branching, counterplay and evaluation.
  - [x] Assessment spec: completed / independently mastered / applied in practical play; item design rules
        (no motif leaks); practical-play rubrics; jump-ahead scoring ≥ 90/100 with per-strand minimums, first
        attempt vs hints/retries; XP/streaks never count as competence; ruleset choice incl. repetition
        adjudication and implementation limits.
  - [x] No invented positions, ratings or learning-time guarantees.

### S1.3 — Reuse/migration map and content sourcing policy

- **Status:** done (attempt 2, 2026-10-23, `5041558`: tester PASS, reviewer and content-reviewer APPROVE)
- **Role focus:** curriculum designer + QA (migration risks)
- **Depends on:** S1.1, S1.2
- **Owned files:** `design/05-migration.md`, `design/07-sourcing.md`
- **Acceptance criteria**
  - [x] Every existing lesson id (and the puzzle bank) mapped to keep / revise / move / retire, with target unit.
  - [x] Versioned progress migration: storage keys, what old completion maps to (completion only, never
        mastery), sync/merge implications, rollback, tests needed.
  - [x] Sourcing, attribution/licensing and verification policy (original positions, engine-verified claims,
        review record tied to stable ids, draft status).

### S1.4 — Implementation backlog and pilot recommendation

- **Status:** done (attempt 3, `a60adfa`, 2026-10-23: reviewer and content-reviewer APPROVE)
- **Role focus:** lead integrator (driver) with implementer
- **Depends on:** S1.1, S1.2, S1.3
- **Owned files:** `design/06-backlog.md`, this file (driver), `design/README.md`
- **Carry-over from S1.1 reviews (must be resolved here):** device-dependent opponent fallback (d = 1 on slow
  devices) must void assessment / "applied" evidence like a "not checked" move; name the threshold and horizon of
  `forcing-attack`'s "winning capture"; re-check 04 §8 R8 against the revised 03; 01-audit hint remark "while on
  the main line".
- **Carry-over from S1.2 (attempts exhausted; blocking, must be fixed and re-reviewed here):** fallback F (03 §5.2)
  has no rule for R6 opening tasks or the `xi` exam (`i08-g1`, `i09-g1`, `i11-g*`, `e08-g*`, `m06-g1`, repertoire
  tasks in `xi`/`xe`), so Intermediate "applied" and graduation are unreachable while `pressing` is unvalidated:
  add `xi` to F4 and an opening-task fallback (R6 on the scripted line; how the post-line R2 term is scored),
  reword the "reachable under F" statements. Non-blocking: make 02's partner chains for `a06-g1`, `e03-g1`, `e06-g*`
  match the 03 §5.2 table; say what `xb` becomes if the F2 games fail the §5.7 guard; note 03's override of 04
  ("safe-sparring for early Basic practice only") in DECISIONS.md; one-line note that F2 does not score the
  Basic game result.
- **Carry-over from S1.3 reviews (non-blocking, resolve here):** fix the release order and regenerate 05 §8.4.1's
  release table / T1 states from it; P3 re-tracking of `u10` must keep `10-combinations.json` next to the other
  Advanced units in file order (`Home.tsx:106` headers) and say that linear unlocking may lock some `u12` lessons
  during the transition (or order the remainder after `u12`); reword 02 §3.3 per 05 DV1 (completion only to
  successors); one notation for quiet moves in validator output.
- **Acceptance criteria**
  - [x] Prioritized, dependency-ordered backlog for steps 2–4 with ownership and acceptance criteria, copied
        into this file as `S2.*`, `S3.*`, `S4.*` items.
  - [x] Pilot recommendation (the five pilot pieces from `02-foundation-and-pilot.md`) and what it validates.
  - [x] `design/README.md` indexes the documents; inconsistencies between S1.1–S1.3 resolved.

### S1.gate — Step 1 gate

- **Status:** done (2026-10-23: reviewer and content-reviewer APPROVE the full design set; lint, build, 471 tests pass; no application code changed since `e99e1f3`)
- **Depends on:** S1.1–S1.4
- **Acceptance criteria**
  - [x] All deliverables 1–7 of `01-audit-and-design.md` exist; `content-reviewer` and `reviewer` APPROVE the set.
  - [x] Lint, build, tests pass; no application behaviour changed.

---

## Steps 2–4 — status

Item definitions (role focus, owned and shared files, acceptance criteria) live in
[design/06-backlog.md](./design/06-backlog.md) §4–§6 and are the single source; this table tracks status only.
Standing criteria, shared-file serialization and the content "done" definition: 06 §2. Suggested parallel rounds
for step 2: 06 §2.2.

Carry-over from the S1.4 reviews (non-blocking, apply in the named items): 03 §10 summary bullet and PD-05 should read
"0 < credited fraction ≤ 1/3" (S2.12); S2.6 also times `forcing-attack(3)` on the pilot's endgame positions and
flags depth 3 "measured within budget" per task; S2.20 records each R6 task's void rate next to its N2 failure rate.

| Item | Title | Depends on | Status |
| --- | --- | --- | --- |
| S2.1 | Content schema v2 and validator foundations | — | done (attempt 1, 2026-10-23) |
| S2.2 | Release path: review records, draft gate, release states, preview, unit ordering | S2.1 | done (attempt 2, 2026-10-23) |
| S2.3 | Playing Black: orientation, notation, colour-neutral judges | S2.1 | done (attempt 2, 2026-10-23) |
| S2.4 | Analysis core (`src/analysis`) | — | done (attempt 2, 2026-10-23) |
| S2.5 | Worker analysis client | S2.4 | todo |
| S2.6 | Phone-cost measurement and runtime budgets | S2.5, S2.9 | todo |
| S2.7 | Strategic decisions: move tables, `decision`, `choice`, feedback and hint ladder | S2.1, S2.3, S2.4 | todo |
| S2.8 | Branching: `line` trees and varied defence | S2.5, S2.7 | todo |
| S2.9 | Training partners and game adjudication (`src/play`) | S2.4, S2.5 | todo |
| S2.10 | Three-level progress storage and derived legacy migration | — | done (attempt 1, 2026-10-23) |
| S2.11 | Account sync of the new records (`data_v2`) | S2.10 | done (attempt 1, 2026-10-23) |
| S2.12 | Practical tasks: `play`, `review`, rubrics, fallback F, practical guard | S2.8, S2.9, S2.10 | todo |
| S2.13 | Assessment engine and progress-state UI | S2.2, S2.7, S2.10, S2.12 | todo |
| S2.14 | Pilot P1: `b09l3` + `b09-g1` | S2.2, S2.3, S2.7, S2.8, S2.12 | todo |
| S2.15 | Pilot P2: `i08l3` + `i08-g1` | S2.14 | todo |
| S2.16 | Pilot P3 + P5: unit `a03`, `a03-g1`, the `a03` check pool and a placement slice | S2.13, S2.15 | todo |
| S2.17 | Pilot P4: `a07l4` + `a07-g1` | S2.16 | todo |
| S2.18 | `pressing` validation | S2.6, S2.12, S2.15, S2.16, S2.17 | todo |
| S2.19 | Pilot integration and walkthrough | S2.13, S2.14–S2.18 | todo |
| S2.20 | Pilot review, calibration and design correction | S2.19 | todo |
| S2.gate | Step 2 gate | S2.1–S2.20 | todo |
| S3.1 | Units b01–b04 | S2.gate | todo |
| S3.2 | Units b05–b07 | S3.1 | todo |
| S3.3 | Units b08, b09, b10 | S3.2 | todo |
| S3.4 | Release REL-1 | S3.3 | todo |
| S3.5 | Units i01–i04 | S3.3 · after S3.4 | todo |
| S3.6 | Units i05–i07 | S3.5 | todo |
| S3.7 | Units i08, i09–i11 | S3.6 | todo |
| S3.8 | Release REL-2 | S3.7, S3.4 | todo |
| S3.9 | Units a01, a02, a03, a04 | S3.7 · after S3.8 | todo |
| S3.10 | Units a05, a06, a07 | S3.9 | todo |
| S3.11 | Units a08–a10 | S3.10 | todo |
| S3.12 | Release REL-3 | S3.11, S3.8 | todo |
| S3.13 | Units e01–e03 | S3.11 · after S3.12 | todo |
| S3.14 | Units e04–e06 | S3.13 | todo |
| S3.15 | Units e07–e09 | S3.14 | todo |
| S3.16 | Release REL-4 | S3.15, S3.12 | todo |
| S3.17 | Units m01–m04 | S3.15 · after S3.16 | todo |
| S3.18 | Units m05–m09 | S3.17 | todo |
| S3.19 | Release REL-5 | S3.18, S3.16 | todo |
| S3.gate | Step 3 gate | S3.1–S3.19 | todo |
| S4.1 | Learning-journey audit and coverage matrix | S3.gate | todo |
| S4.2 | Chess accuracy and content integrity sweep | S3.gate | todo |
| S4.3 | Learner-behaviour scenarios | S3.gate | todo |
| S4.4 | Scoring review | S4.3 | todo |
| S4.5 | Application, migration and release-path validation | S3.gate | todo |
| S4.6 | Learner-facing descriptions, readiness report and study plan | S4.1–S4.5 | todo |
| S4.7 | Release candidate and rollback notes | S4.6 | todo |
| S4.gate | Step 4 gate | S4.1–S4.7 | todo |
