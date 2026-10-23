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

## D3 — 2026-10-23 — Step 1 design adopted (PD-01 … PD-44)

- **Decision:** The proposed decisions in [design/06-backlog.md §7](./design/06-backlog.md) are adopted as the
  working design, **except** the five that need the owner (below). The table there is the single record of their
  wording and source; this entry adopts them without copying them.
- **Highlights:** three separate progress states with provenance (PD-01); jump-ahead ≥ 90/100 exact with per-strand
  minimums and first attempt only (PD-02); in-repo search in a Web Worker, no engine binary shipped (PD-10); strategic
  acceptance by reviewed move tables + objective predicates + safety guard, never by equality with an engine's first
  choice (PD-14); legacy completion derived at read time, never mastery or applied (PD-20); new evidence in a
  separate key and `data_v2` column (PD-21); release one level at a time, REL-1 … REL-5 (PD-24); `safe-sparring(2)`
  used beyond 04's "early Basic practice only" — 03 overrides 04 (PD-17); a level entry gate for new levels that
  reverses the phase-1 "every track open" rule (PD-35, flagged to the owner in S4.6).
- **Reason:** independent reviewer and content-reviewer approval of the full design set (STATUS.md, 2026-10-23).
- **Pending owner decisions (not blocking implementation):** PD-12 GPL engine in the app (only if the pilot shows the
  in-repo search is insufficient); PD-18 licence of code and content; PD-30 historical annotated games (course games
  only until then); PD-42 any scope reduction beyond 06 §5.1; PD-44 human review sample before any deploy.
  Owner **action** before any deploy that writes `data_v2`: test T15 on a real Supabase project (PD-21).

## D4 — 2026-10-23 — Backlog lives in the design document

- **Decision:** Step 2–4 item definitions stay in `design/06-backlog.md` §4–§6; `BACKLOG.md` tracks their status only.
- **Reason:** PLAN.md asks to avoid competing sources of truth; copying ~500 lines would create two.
