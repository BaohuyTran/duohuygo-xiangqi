# Curriculum upgrade — design documents

Step 1 ("Audit and design", [../01-audit-and-design.md](../01-audit-and-design.md)) of the curriculum-upgrade phase.
Execution state lives outside this folder: [BACKLOG.md](../BACKLOG.md) (work items), [STATUS.md](../STATUS.md)
(position, evidence, blockers, next actions), [DECISIONS.md](../DECISIONS.md) (decisions taken), [DRIVER.md](../DRIVER.md)
(procedure), [PLAN.md](../PLAN.md) and the step specifications `../01-…` to `../04-…`.

## Documents

| # | Document | Deliverable of 01-audit-and-design.md | Status |
| --- | --- | --- | --- |
| 01 | [01-audit.md](./01-audit.md) — current-state audit: verified counts, colour coverage, how lessons, jump-ahead, progress, gamification and sync work today, historical findings checked | 1. Current-state audit | Approved (S1.1); reconciled in S1.4 (hint remark, §7 resolved) |
| 02 | [02-curriculum.md](./02-curriculum.md) — 49 units / 161 lessons: ids, levels, prerequisites, strands, outcomes, lessons, exercise types, ladders, misconceptions, feedback, assessment and remediation per unit; notation and glossary | 2. Curriculum specification | S1.2 attempts used; reconciled in S1.4; approval with the S1.4 review |
| 03 | [03-assessment.md](./03-assessment.md) — completed / mastered / applied, item scoring, unit checks, practical-play partners, rubrics and fallback F, level exams, jump-ahead (≥ 90/100 with strand minimums), ruleset | 3. Assessment specification | S1.2 attempts used; fallback F completed in S1.4 (F1 scoring leaves, F1c, F2b, F5, `xi` in F4, line-share gate, reachability table); approval with the S1.4 review |
| 04 | [04-architecture.md](./04-architecture.md) — engine and solver capabilities and measured costs, exercise model, required capabilities (Black, branching, move tables, strategic acceptance, partners, play tasks, repetition, progress), integration options and recommendation | 4. Exercise architecture and engine feasibility | Approved (S1.1); reconciled in S1.4 (pointers, §8 status) |
| 05 | [05-migration.md](./05-migration.md) — every old lesson, exercise and puzzle mapped (keep / revise / move / retire), derived legacy completion, new storage keys, `data_v2` sync, phased publishing and release order, rollback, tests T1–T18 | 5. Reuse and progress migration map | Approved (S1.3); reconciled in S1.4 (release order, §8.4.1, T1, §11) |
| 06 | [06-backlog.md](./06-backlog.md) — step 2–4 backlog (S2.n, S3.n, S4.n + gates), pilot recommendation, volume and batches, consolidated proposed decisions, open-items register | 6. Implementation backlog (+ pilot) | New in S1.4; under review |
| 07 | [07-sourcing.md](./07-sourcing.md) — allowed sources, attribution and licensing, engine use, verification by claim type, metadata and review records, draft status, versioning, id reuse | 7. Sourcing, licensing and verification policy | Approved (S1.3); reconciled in S1.4 (§11 owners) |

Reading order for a newcomer: 01 → 04 (what exists and what is feasible) → 02 → 03 (what to teach and how to assess)
→ 05 → 07 (how old content and progress carry over, how content is sourced) → 06 (what to build, in which order).

## Labels

| Label | Meaning | Used in |
| --- | --- | --- |
| **Verified** | Measured or read from this repository (`file:line` or the command is given), or checked with the engine | all |
| **Proposal** | A design choice; later steps implement it unless a gate, reviewer or the pilot changes it | all |
| **Unresolved** / **Open** | Needs a decision, a measurement or a review; every open item names its owner (a backlog item or the owner) | all; **06 §8 is the canonical register** — the per-document tables keep resolved rows for traceability |
| **Needs architecture confirmation** | A curriculum or assessment proposal that depends on a capability the architecture must confirm | 02, 03 |
| **Resolved** / **Decided** | An earlier open item settled by another document or by S1.4, kept for traceability with a pointer | status columns added in S1.4 |
| **Owner decision** / **owner action** | Only the repository owner can decide or perform it (licence, real-device runs, a real Supabase project) | 04 §8, 07 §11, 06 §7–§8 |

## Identifiers

| Thing | Format | Example | Defined in |
| --- | --- | --- | --- |
| Level (track) | `basics`, `intermediate`, `advanced`, `expert`, `master` | — | 02 §3.2 |
| Unit | level prefix `b` `i` `a` `e` `m` + 2 digits | `b05`, `m09` | 02 §3.3 |
| Lesson | unit + `l` + digit | `b05l2` | 02 §3.3 |
| Practice exercise | lesson + `-` + 2 digits | `b05l2-04` | 02 §3.3 |
| Unit-check item | unit + `-c` + 2 digits | `b05-c07` | 02 §3.3 |
| Placement item · placement practical task | `p` + level prefix + `-NN` · `-gN` | `pi-14` · `pb-g1` | 02 §3.3, 03 §7 |
| Practical task | unit + `-g` + digit | `b10-g1` | 02 §3.3 |
| Level exam | `x` + level prefix | `xb` … `xm` | 03 §6 |
| Misconception | unit + `.m` + digit | `b06.m2` | 02 §3.3 |
| Legacy lesson / exercise | `u<n>l<k>` · `<lessonId>#<i>` (0-based index into `exercises`, learn cards included) | `u15l3#3` | 01 header, 05 |
| Puzzle | `m1-NN`, `m2-NN`, `wm-NN` | `m2-07` | 01 §1.6 |
| Retired ids | never reused (`src/content/retired-ids.json` from S2.1) | `u5l1` | 07 §8 |
| Backlog item | `S<step>.<n>`, gates `S<step>.gate` | `S2.12` | 06 |
| Proposed decision | `PD-nn` (06 §7); source ids kept: 03 §12 items, 05 `MD*`, 07 `SD*` | `PD-24` | 06 §7 |
| Open item | 01 `U*`, 02 `U*`, 03 `UA*`, 04 `R*`, 05 `MU*` / `DV*`, 07 `S07-U*` | `UA5` | each doc; register in 06 §8 |
| Release state | `REL-0` (today), `REL-P` (pilot), `REL-1`–`REL-5` (one level each); distinct from rubrics `R0`–`R7` and 04's `R1`–`R8` | `REL-2` | 05 §8.4.1 |
| Partner regime fallback | `F1`, `F1c`, `F2`, `F2b`, `F3`, `F4`, `F5` | `F1c` | 03 §5.2 |
| Rubric | `R0`–`R7` | `R6` | 03 §5.3 |
| Assistance level | `G3`, `G2`, `G1`, `G0`, `TR` | — | 02 §5.2 |
| Strand | `RS`, `TC`, `OD`, `PA`, `DE`, `PP` | — | 02 §3.1 |

## Notation

- Learners read traditional notation per language and per-side file numbers (02 §4).
- Internally (content JSON, tests, validators) moves are ICCS squares; in documents, scripts and validator output a
  move is written `from-to` (`h2-e2`). A stored line's shape is a **main-line signature**, one character per own move:
  `.` quiet, `+` check, `x` capture, `X` capture with check (02 §4; 05 §9 command 5).
- External UCI engines number ranks 1–10 (`f10h9` = `f9-h8`, 04 §2.4); conversions are tested.
