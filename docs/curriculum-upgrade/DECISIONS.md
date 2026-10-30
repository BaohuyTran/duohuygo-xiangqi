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

## D5 — 2026-10-23 — Small schema choices from S2.1

- Extra-practice pool item ids are `<unitId>-pNN`; the tactic/quiet field is named `nature`.
- New-course `learn` cards need only id, version, status, source and side; strand, nature, critical and
  misconceptions are required on practice items (07 §5.1 read as "answered items").
- Black `win-material` combinations are refused by the validator until S2.3 makes the material judge colour-neutral.
- `u8l4` is a retired id too (07 §8's "u1l1–u15l3" shorthand missed it).
- **Add the placement rule "at most one own Soldier per file before it crosses the river"** (content-reviewer, S2.1):
  it catches `u13l2#4` (two unpromoted Black Soldiers on file a), making 13 legacy POS positions. Owner: S2.3
  (next item touching `legality.ts`/`validate.ts` placement) — update 05 §9 command 3, 07 §6 and the POS list.

## D6 — 2026-10-23 — Interpretations of 03 §5.3 in the analysis layer (S2.4)

- i01 keeps Basic's missed-gain rule (free captures only, with the S conditions); forks and pins start in i02.
- A forced-mate loss that every move allows is not penalised as an allowed loss ("an unavoidable loss is not
  penalised"); a mate loss with a non-mating alternative is a serious allowed loss (`mate: true`).
- "Threat at the end" (R5) counts a learner who is in check as facing a threat; a move that gives check is still not a
  quiet threat (02 a06).
- A piece en prise is reported but does not decide `safe`; the guard is defined by (h, k, T) only.
- "Open file" means no pieces in front (Xiangqi usage); the soldier-based notion is `soldierFileStatus`, not used as
  "open file".
- Evaluation weights (`DEFAULT_WEIGHTS`) and `palacePressure` (counts piece–point pairs, unlike the 04 Appendix A.4
  prototype) are unvalidated until S2.18; the prototype's "undefended" check never saw defenders, so `pressing`
  choices may differ from 04's measurements.

## D7 — 2026-10-23 — Owner: stop after step 2 and push it to `main`

- **Decision (owner, in chat):** "Stop when finish step 2 and push all in to main." This overrides D1 and PLAN.md's
  delivery boundary for the step 2 result only: when S2.gate passes, the phase branch is merged into `main` and pushed
  (which deploys to GitHub Pages), and the run stops there; steps 3–4 are not started in this run.
- **Pre-condition to confirm with the owner before the push:** the deployed build syncs `data_v2` when the Supabase
  variables are set (they are, on the `github-pages` environment). Without migration `20261023000000_progress_data_v2.sql`
  on the real project, signed-in learners see a sync error (v1 progress still syncs). CLAUDE.md's T15 rule says not
  to deploy a build that writes `data_v2` before the migration and T15 steps 3–5.
- **Owner answer (2026-10-23):** "Ignore those error, no real user in app for now. Just make sure everything in step 2
  is ready in main branch." The push to `main` at S2.gate does not wait for the `data_v2` migration / T15; until the
  migration runs, signed-in testers may see a sync error (v1 data still syncs). T15 stays an owner action before real
  users.

## D8 — 2026-10-24 — Training-ruleset interpretations in `src/play` (S2.9)

- The repetition cycle is the moves between the **last two** occurrences of the position key; a quiet move before the
  repeated sequence does not excuse a perpetual check.
- The learner may create a third occurrence when the opponent checked perpetually in that cycle
  (`opponent-perpetual-check`), so the victim of perpetual check can claim the win; this widens 03 §5.5 in line with
  its rule (1) and AXF (now written into 03 §8.3). Otherwise the refusal stays, also when an alternative could not be
  checked.
- Partners avoid any third occurrence unless every alternative loses ≥ 2 (measured against the best repeating move by
  the partner's own scores); they also avoid one that would make them win by the learner's perpetual check (favours the
  learner; a learner's perpetual check is punished only through the learner's own third occurrence).
- Any not-checked partner request except a cancel (incl. node-limit) triggers the flagged d = 1 move and voids the run.
- Material rule with the leader to move: the leader wins only if some leader move avoids a forced mate in 2.
- Best-defence ranks a game-ending move first, then an escape from mate within k, then the longest resistance.
- Learner-facing term for perpetual check: "chiếu mãi" (add to the glossary when the `play.*` texts are added, S2.12).

## D9 — 2026-10-24 — Runtime budgets from the S2.6 bench (proxy, phones unmeasured)

Source: `docs/curriculum-upgrade/measurements.md` §3 (headless Chromium throttled 1×/4×/6×; not a phone).
- Node caps stay 20,000 per search / 50,000 per request / `SYNC_BUDGET` 1,500; safety net stays 5 s (worst pressing(2)
  move 2.07 s at 6×).
- Post-game signals stay at h = 2 (mean 247 ms per learner move at 6×); h = 3 not adopted for the pilot (≈ 4× cost and
  1/15 moves not checked at default caps) — revisit at S2.20 with phone data.
- Compute does not limit task lengths; compute each move's signals during the game in the Worker.
- Resist mode k = d = 2 everywhere, k = 3 nowhere; forcing-attack(3) only at ≤ 12 pieces (timed on legacy endgames;
  S2.12 records per-task cost on pilot positions); no depth-3 partners on a full board.
- Owner action: real-device runs (≥ 1 Android, ≥ 1 iOS) per measurements.md §5; until then "phones unmeasured" (04 R6).

## D10 — 2026-10-24 — Owner: weekly token budget checkpoint (option 1)

- Context: ~65% of the owner's weekly token allowance used; the rest of step 2 was estimated at ~9–11M tokens.
- **Decision (owner):** finish S2.12 and S2.13 this week, then pause; continue S2.14–S2.20 and S2.gate next week without
  trimming scope. The merge to `main` (D7) happens only when step 2 is complete. From now on no separate tester agent
  (the driver runs lint, build, tests and ui:check), one code reviewer, and a content-reviewer only for chess content,
  chess logic or assessment correctness; review fixes are rechecked, not re-reviewed in full.

## D11 — 2026-10-30 — Practical-task interpretations (S2.12)

- Material for R0, the R4 lead and the R5 deficit is the static count of the final board; only the full-game stop
  rule uses the quiescence-resolved count (03 §5.5). Alternative (quiescence everywhere) left open for S2.18.
- R5 holding predicate: `when: 'end'` or `'any-move'` (after any single learner move, for counterplay).
- F5 keeps R1, R2, R3 and R6, rescaled to 100; opening tasks must keep R6 under F5 and no task may score R1 alone.
- `forcing-attack` stays at k = 2 in convert tasks (03 allows 3 at ≤ 12 pieces, does not require it).
- The pass is decided on the unrounded score; shown and stored scores are rounded down to one decimal.
- A line-share fact that cannot be checked before the window fills voids the run (`fact-not-checked`).
- 03 §5.7 failure rates are measured over runs that were not voided; voided runs are reported separately.
- A review mark that is not a turning point scores 0 for the better move; the reflection is not scored. Reviews
  must list every move among the top 3 by deduction, ties at the cut-off included.
- Reset progress also clears practical games in progress (`play.inProgress.v1`).
