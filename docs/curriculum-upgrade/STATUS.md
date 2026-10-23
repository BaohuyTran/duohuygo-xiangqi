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

## Blockers and failed gates

- None blocking. Owner decisions needed before release (not before implementation): licence of code and content
  (07 S07-U2), historical annotated games allowed? (S07-U1), human review sample before release? (S07-U4), and a
  real-Supabase check that old builds leave `data_v2` untouched (05 MU2 / 04 R5, test T15) before any deploy that
  writes it. Open for S1.4 reconciliation: perpetual-chase adjudication (03 vs 04), opponent profile names,
  mastery merge rule, notation ownership, content volume (reviewer estimate ~160 lessons, 1,000–1,600 practice
  items) vs batch sizing.

## Next actions

1. Step 2 round A in parallel: S2.1 (content schema v2), S2.4 (analysis core), S2.10 (three-level progress storage).
2. Then rounds B–D and the pilot items in the order of 06 §2.2; S2.gate before any step-3 batch.
