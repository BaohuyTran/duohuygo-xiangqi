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

## Blockers and failed gates

- None.

## Next actions

1. Run S1.1 and S1.2 (implementer, in parallel), then tester, reviewer and content-reviewer on each.
2. S1.3, then S1.4, then the step 1 gate; then start step 2 from the backlog S1.4 writes.
