# Curriculum upgrade — decisions

Newest last. Each entry: date, decision, reason, alternatives considered. Proposals that are not yet decided
live in the design documents, marked "unresolved".

## D1 — 2026-10-22 — Work on the phase branch, not `main`

- **Decision:** All work of this phase goes to `claude/pensive-albattani-i4h0ji`; nothing is merged into `main`
  or deployed during the phase.
- **Reason:** `PLAN.md` "Delivery boundary" forbids merging into the default branch, publishing or deploying
  without separate authorization, and every push to `main` deploys to GitHub Pages. The first phase's
  "work directly on main" rule (`docs/DRIVER.md`) is therefore suspended for this phase only.
- **Alternatives:** per-item feature branches (more merge overhead, no benefit with one integrator).

## D2 — 2026-10-22 — Driver procedure cloned and adapted

- **Decision:** `docs/curriculum-upgrade/DRIVER.md` is the procedure for this phase: backlog items instead of
  PLAN tasks, continuous execution across steps, state in STATUS/DECISIONS/BACKLOG, an extra independent
  `content-reviewer` agent. The agent role files accept a `Base:` ref (`HEAD` in this phase) instead of `main`.
- **Reason:** the phase PLAN.md requires autonomous progression, persistent state and independent chess and
  pedagogy review, which the first-phase driver did not provide.
