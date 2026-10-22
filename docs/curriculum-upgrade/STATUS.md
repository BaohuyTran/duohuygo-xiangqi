# Curriculum upgrade — status

Procedure: [DRIVER.md](./DRIVER.md) · Work items: [BACKLOG.md](./BACKLOG.md) · Decisions: [DECISIONS.md](./DECISIONS.md)

## Current position

- **Step:** 1 — Audit and design
- **Active items:** S1.1, S1.2 (parallel, disjoint files)
- **Branch:** `claude/pensive-albattani-i4h0ji` (base `main` @ `f20ea5b`); not merged, not deployed.

## Agent ownership

| Item | Agent | Owned files |
| --- | --- | --- |
| S1.1 | implementer (architecture engineer) | `design/01-audit.md`, `design/04-architecture.md` |
| S1.2 | implementer (curriculum designer) | `design/02-curriculum.md`, `design/03-assessment.md` |
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

## Blockers and failed gates

- None blocking. Open for S1.4 reconciliation: perpetual-chase adjudication (03 vs 04), opponent profile names,
  mastery merge rule, notation ownership, content volume (reviewer estimate ~160 lessons, 1,000–1,600 practice
  items) vs batch sizing.

## Next actions

1. S1.1 and S1.2 attempt 2 running (implementer, in parallel); then re-test and re-review each.
2. S1.3, then S1.4, then the step 1 gate; then start step 2 from the backlog S1.4 writes.
