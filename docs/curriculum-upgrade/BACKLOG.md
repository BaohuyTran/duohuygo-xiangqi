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

- **Status:** in-progress — 3 attempts used (2026-10-23). All unit-field, mastery, complete-game, guard and
  partner findings fixed; one finding left, carried into S1.4 (see there). Not approved until S1.4's review passes.
- **Role focus:** curriculum designer (+ learning-experience)
- **Depends on:** — (reads the code itself; reconciled with S1.1 at S1.4)
- **Owned files:** `design/02-curriculum.md`, `design/03-assessment.md`
- **Acceptance criteria**
  - [ ] Every unit: stable id, level, prerequisites, competency tags (six strands), observable outcomes, lesson
        titles + objectives, exercise types and scaffolding progression, guided / independent / transfer tasks,
        misconceptions + feedback requirements, assessment and remediation criteria.
  - [ ] All six strands and the 50-topic baseline covered (any split/merge/reorder justified); both colours;
        attack and defence; positions with no immediate tactic; plans before opening memorization; difficulty
        grows through fewer hints, unfamiliarity, branching, counterplay and evaluation.
  - [ ] Assessment spec: completed / independently mastered / applied in practical play; item design rules
        (no motif leaks); practical-play rubrics; jump-ahead scoring ≥ 90/100 with per-strand minimums, first
        attempt vs hints/retries; XP/streaks never count as competence; ruleset choice incl. repetition
        adjudication and implementation limits.
  - [ ] No invented positions, ratings or learning-time guarantees.

### S1.3 — Reuse/migration map and content sourcing policy

- **Status:** todo
- **Role focus:** curriculum designer + QA (migration risks)
- **Depends on:** S1.1, S1.2
- **Owned files:** `design/05-migration.md`, `design/07-sourcing.md`
- **Acceptance criteria**
  - [ ] Every existing lesson id (and the puzzle bank) mapped to keep / revise / move / retire, with target unit.
  - [ ] Versioned progress migration: storage keys, what old completion maps to (completion only, never
        mastery), sync/merge implications, rollback, tests needed.
  - [ ] Sourcing, attribution/licensing and verification policy (original positions, engine-verified claims,
        review record tied to stable ids, draft status).

### S1.4 — Implementation backlog and pilot recommendation

- **Status:** todo
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
- **Acceptance criteria**
  - [ ] Prioritized, dependency-ordered backlog for steps 2–4 with ownership and acceptance criteria, copied
        into this file as `S2.*`, `S3.*`, `S4.*` items.
  - [ ] Pilot recommendation (the five pilot pieces from `02-foundation-and-pilot.md`) and what it validates.
  - [ ] `design/README.md` indexes the documents; inconsistencies between S1.1–S1.3 resolved.

### S1.gate — Step 1 gate

- **Status:** todo
- **Depends on:** S1.1–S1.4
- **Acceptance criteria**
  - [ ] All deliverables 1–7 of `01-audit-and-design.md` exist; `content-reviewer` and `reviewer` APPROVE the set.
  - [ ] Lint, build, tests pass; no application behaviour changed.

---

## Step 2 — Foundation and pilot

Placeholder: replaced by S1.4.

## Step 3 — Curriculum production

Placeholder: replaced by S1.4.

## Step 4 — Final validation

Placeholder: replaced by S1.4.
