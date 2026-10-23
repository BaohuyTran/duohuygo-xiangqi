# Assessment specification

Backlog item S1.2 · Owner: curriculum designer · Companion: [02-curriculum.md](./02-curriculum.md) (units,
exercise types, ids, notation). Architecture: [04-architecture.md](./04-architecture.md) (S1.1). Migration:
`05-migration.md` (S1.3). Revision: attempt 3 (fixes the S1.2 review findings of attempts 1 and 2), plus the S1.4
reconciliation (fallback F5 for opening tasks, `xi` in F4, reachability table, voided runs, `forcing-attack` capture
rule; owners of open items in §13 point to [06-backlog.md](./06-backlog.md)).

Labels as in 02-curriculum.md §0: **Verified**, **Proposal**, **Unresolved**, **Needs architecture confirmation**.
Everything in §2–§11 not labelled otherwise is a **Proposal**. All numeric thresholds except the ≥ 90/100
jump-ahead bar (a requirement of `01-audit-and-design.md`) are design defaults to be calibrated in the pilot; none
is claimed to measure playing strength or a rating.

---

## 1. Current state (Verified)

| Fact | Evidence |
| --- | --- |
| The only progress state is "completed lesson" (a set of ids) | `src/storage/index.ts:61` (`progress.completedLessons.v1`) |
| A lesson completes when every exercise is eventually answered; wrong answers are retried; hints exist only in `combination` exercises; neither affects completion | `src/components/LessonPlayer.tsx` (retry `:226`, `:528`; hint `:537–540`) |
| First-try correct answers are counted but only displayed | `src/components/LessonPlayer.tsx:71`, `:152` |
| Jump-ahead: last two practice exercises of every skipped lesson, at most 8, 3 lives of its own (works at 0 hearts); passing marks skipped lessons complete with no XP | `src/lessons/progress.ts:39–60`; CLAUDE.md "Jump ahead" |
| XP: lesson first completion 10, replay 5, first puzzle solve 5 | `src/gamification/rules.ts:23–28` |
| Repetition, perpetual check/chase not handled by the engine; stalemate loses; flying General enforced | `src/engine/status.ts:12`; CLAUDE.md "Engine conventions" |
| Evaluation is material only with capture quiescence; "win material" = ≥ 2 points (`WIN_MATERIAL_THRESHOLD`) at depth 4 (`WIN_MATERIAL_DEPTH`) | `src/engine/solver.ts:9–17`, `:164–175`; `src/puzzles/logic.ts:19–21` |
| Helpers used below exist: `moveScore`, `searchScore`, `hasForcedWin`, `materialBalance` (engine), `captureGain` (lessons) | `src/engine/index.ts`; `src/lessons/answers.ts:111` |

Today the app can show *completion* only. Mastery and application need the evidence below.

---

## 2. Three progress states

| State | Scope | Granted by | Never granted by | Lost? |
| --- | --- | --- | --- | --- |
| **Completed** | Lesson (unit = all its lessons) | Finishing every exercise (hints and retries allowed); a passed jump-ahead ("by placement"); migration of old completion (S1.3) | — | Only by "Reset progress" |
| **Independently mastered** | Unit | A passed **unit check** (§4) — every unit has one, including b10, e09 and m07 (short forms) — or, for m09, a passed `xm`; or a jump-ahead in which the unit was **covered** (§7.4, "by placement") | XP, streaks, hearts, lesson completion, practice accuracy, puzzle solves, migrated completion, non-covered placement | Not revoked by time or later mistakes (§4.5) |
| **Applied in practical play** | Practical task (`-g` id); unit = all its tasks; level = its level exam | Passing a practical task's rubric (§5), including an **equivalent placement practical task** inside a jump-ahead (§7.4) | Any non-practical item (lesson, check or placement items), XP, streaks | No |

Rules:

1. The three states are stored and shown separately; any combination is possible (e.g. mastered by placement but
   not completed, mastered but not applied).
2. Units with no practical task show "applied: —" (not applicable), never "applied".
3. **Level mastered** = every unit of the level mastered (each reachable by working through: all units have a unit
   check, m09 via `xm`). **Level applied** = its level exam passed (`xb`, `xi`, `xa`, `xe`, `xm`). **Course
   graduated** = every level mastered and applied.
4. Old completion migrates to **completed only**; the UI never presents it as mastery.
5. Each grant records provenance (`check` / `placement` / `practical` / `exam` / `migration`), date, score and content
   version. Exception (reconciled in S1.4, 05-migration.md §8.4, MD2): `migration` completion is derived at read time
   from the old completion list and is never stored; it has no date, score or content version because the old data
   has none.
6. **Merge across devices** (reconciled in S1.4: identical to 04 §5.8 and 05-migration.md §8.6 item 4, which adds
   deterministic tie-breaks): completed and applied = union (applied: per task the higher score); mastery = per unit
   the record with the higher score, ties → later date. Monotone, so a failed later check can never remove mastery on
   another device.

---

## 3. Evidence and item scoring

### 3.1 Attempt record (Needs architecture confirmation: storage and size cap, 04 §5.8)

Every answered item records: item id and version, mode (`practice`, `check`, `placement`, `practical`, `exam`),
timestamp, colour, **first-answer credit**, hints used (count, ladder step), attempts before success, seed, and the
misconception tag of the first wrong answer. Persistence through `src/storage` (new repository); the attempt log may
stay local and capped; states sync (§2 rule 6).

### 3.2 Credit per item (first answer only)

| Item type | Full credit (1) | Partial | Zero |
| --- | --- | --- | --- |
| `select-squares` | Exact set | None in assessments | Any missing or extra square |
| `move` / `capture` | Engine confirms the goal | — | Otherwise |
| `combination` | Every own move engine-confirmed, first time | — | Any wrong move (item ends) |
| `choice` | Keyed option(s), exact for multi-select | — | Otherwise |
| `decision` | Class **target** or **sound** | **dubious** = 0.5 only if the item is flagged `partial` | **error**; **dubious** without the flag |
| `line` | All learner moves target/sound | Per-node credit (sum ÷ nodes) if flagged | First error-class move |
| `play` | Task score ÷ 100 (§5) | Continuous | Critical failure (§5.6) |
| `review` | R7 ÷ 100 | Continuous | — |

A move the runtime guard could not check within its budget is **voided** in assessments (no credit, no penalty,
replaced by another item of the same strand or removed from numerator and denominator), as 04 §5.4 proposes. A
`play` run in which a partner fell back to its d = 1 move on a slow device is voided as a whole (§5.6).

**Hints and retries.** Checks, placement tests and exams offer **no hints and no retries**. Practice allows both,
records them, shows "independent: 5 of 8", and never produces mastery or application.

### 3.3 Content versions

Credit is recorded against the item version answered. A new version does not invalidate granted states; it is simply
unexposed for that learner (§4.3).

---

## 4. Unit checks (independent mastery)

### 4.1 Default blueprint

| Parameter | Default |
| --- | --- |
| Length | 8 items, equal weight, score out of 100. **Short form** 6 items for b01, b10, e09, m07 |
| Coverage | Every lesson objective at least once; ≥ 6 items (short form ≥ 4) from this unit |
| Interleaving | From b03 on, 2 items from earlier units (preferably sharing a strand) |
| Colour | From b02 on, ≥ 1/3 as Black (i08: Red only; i09: Black only) |
| Quiet items | Units with primary PA, OD or DE: ≥ 1/4 with no immediate tactical win |
| Safety-critical items | Flagged `critical` (blunder check, escaping mate in one, not hanging a Chariot). From b08 on each check has ≥ 1, possibly interleaved |
| Mastery | Score **≥ 80/100** (8 items: at most one miss; short form: at most one miss = 83.3) **and** every `critical` item correct |
| Feedback | After each answer: right/wrong + position-specific explanation |

m09 has no check: its mastery is `xm` (§6).

### 4.2 Item design rules: no motif leaks

1. **Neutral prompts**: side to move and kind of answer only ("Black to move. Play the best move."; "Who is better,
   and why?"). Never the motif, the piece, the target, or whether a tactic exists. A forced-mate item says "Find the
   best move", not "Mate in 3": credit goes to any move keeping a forced mate within the item's depth, then the line
   continues against best defence.
2. **Neutral titles**: "Unit check", "Placement test", "Level exam".
3. **No scaffolds**: no highlight, no `from` restriction, no hint button; any "checking" pause uses neutral text.
4. **Unseen positions**: not in any practice item, `learn` card or other pool, including mirrors (files a↔i),
   colour swaps (ranks flipped and colours exchanged) and shifts of the same piece pattern, unless the learning point
   changes and a reviewer records why. The validator compares normalised forms (Needs architecture confirmation).
5. **Decoys and quiet positions**: pools include positions where the unit's motif looks available but fails, and
   positions with no tactic.
6. **Distractors**: plausible, similar length, each mapped to a misconception id; "nothing / none" only as a genuine
   option that is sometimes correct; seeded shuffle.
7. **Accept every valid answer** (02-curriculum.md §5.3); an item that cannot be judged fairly is redesigned or removed.
8. **Verdict + action pairing**: a `choice` verdict never stands alone for an outcome about acting.
9. **Metadata** (required): id, version, unit, lesson objective, strand, colour, `tactic`/`quiet`, `critical`,
   misconception ids, source, review status. **Draft or unreviewed items are never served** in checks, placement or
   exams.

### 4.3 Pools, forms and retakes

- Check pool ≥ two forms' worth (16 items; short form 12), separate from practice, placement and exam pools.
- Forms are assembled with a seed, honouring §4.1, avoiding items the learner has seen in a check ("exposed").
- **Retake** after a failed check: once the remediation set is done (§4.4). If no unexposed form can be built, at
  most half the form may be exposed items; if even that is impossible, the check is unavailable until new items
  exist, and the learner is told why.

### 4.4 Remediation (the default referenced by every unit)

- Each failed item maps to its lesson objective and the misconception tag of the wrong answer.
- Remediation set = per failed objective, that lesson's G1/G0 practice items not yet answered correctly first time,
  plus the `learn` card tied to the misconception. The learner sees which lessons to revisit, after the check.
- Remediation is practice (hints allowed, no mastery). It unlocks the retake.

### 4.5 Long breaks

Mastery is not revoked by time. After long inactivity (default 30 days) the app offers a warm-up of unexposed check
items from mastered units; results only drive suggestions. **Unresolved (UA1):** whether a failed warm-up shows
"needs review".

---

## 5. Practical play

### 5.1 Task definition (Needs architecture confirmation: whole section; 04 §5.6)

A practical task defines: start position (or the initial position), learner colour, partner profile (§5.2) and seed
policy, move cap *N* or "full game", end conditions (§5.5), rubric(s) with weights (§5.3), objective predicates,
pass mark, and a neutral prompt stating the goal, not the method ("Black to move. Hold the position for 15
moves."). Positions are authored and verified like other content (S1.3).

### 5.2 Training partners (policies of 04 §5.5–5.6; reconciles 04 R8)

All partners are constrained training opponents with depth and node limits (deterministic per seed; 04 budget
≤ ~300 ms desktop per Worker request, node cap ~20,000). The task screen discloses: "Your opponent is a training
partner with limited depth. It punishes loose pieces and short tactics but does not plan." (en + vi in
`messages.ts`).

| Policy (04) | Behaviour | Use in this course |
| --- | --- | --- |
| `scripted` | The authored replies: `line` deviations, **threat trees** (attacker's ideas and answers to the main defences) and **counterplay trees** (defender's resources), forced claims proven | `line` items; first part of every hold, convert and opening task |
| `best-defence` | Optimal within the forced-mate horizon | `combination` only |
| `forcing-attack(k)` | Plays a forced mate within k (k ≤ 2 at runtime, 3 in positions of ≤ ~12 pieces) when one exists; otherwise a **winning capture** when one exists — a capture *m* with `moveScore(P, m, d)` − `materialBalance(P, mover)` ≥ *T* = 2 (`WIN_MATERIAL_THRESHOLD`), searched at *d* = 2 plies + capture quiescence (*d* = 3 in positions of ≤ ~12 pieces), the highest-scoring one, ties broken by the seed; otherwise hands over | Second link of the hold/convert chains |
| `safe-sparring(2)` | Material search d = 2 + capture quiescence; never hangs material within 2 plies; random among moves within τ of its best (τ = 1.0 in Basic, 0.5 above). Depth 2 already sees a mate in one against itself, because quiescence scores a side with no legal moves as mated (Verified `src/engine/solver.ts:123–125`) | **Early Basic practice** (b01–b09 drills), `b08-g1`, `b09-g1`, the full-game fallbacks F2/F2b and the post-line continuation of opening tasks under F5 (below). Depth 3 only in positions of ≤ ~12 pieces (04 budget). This widens 04 §5.6 ("early Basic practice only"); recorded as a proposed decision in 06-backlog.md §7 |
| `pressing(2)` | Material + palace pressure, attacked undefended pieces and mobility (04 §5.5), d = 2 + capture quiescence; prefers safe moves that attack the learner's palace and loose pieces. Heuristic weights | Game, play-out and plan tasks; last link of the hold/convert chains |
| `restricted`, `greedy` | Drill partners | Practice only; **never** application evidence |

**Chains (04 §5.6, R8):** *hold / defence* = threat tree → `forcing-attack(2)` → `pressing(2)`; *convert* = counterplay
tree → `forcing-attack(2)` → `pressing(2)` (in positions of ≤ ~12 pieces `forcing-attack(3)` and depth 3 are allowed);
*game / play-out* = optional `scripted` opening → `pressing(2)`. Hold and convert tasks start from a position with a
**verified** threat or counter-threat (04 §5.5 item 1). The earlier names `spar`, `defend`, `counter` and the strict
`safe-sparring(4, 0)` are withdrawn: depth 4 does not fit the budget on a full board (04 R8).

| Task kind | Examples | Partner | Under fallback F (below) |
| --- | --- | --- | --- |
| Safety and development drills | `b08-g1`, `b09-g1` | `safe-sparring(2)` | unchanged |
| Opening (R6, R2) | `i08-g1`, `i09-g1`, `i11-g*`, `e08-g*`, `m06-g1`; opening tasks of `xi`, repertoire tasks of `xe`, the opening task of `xm`; `pi-g*` | `scripted` → `pressing(2)` | F5 |
| Plan (R3) | `i01-g1`, `a03-g1`, `a06-g1`, `e03-g1`, `m02-g1` | `pressing(2)` | F1 |
| Hold / defence (R5) | `i07-g1`, `a07-g1`, `a09-g2`, `e04-g1`, `e07-g1`, `m03-g1`, `m05-g2` | hold chain | F1 |
| Convert (R4) | `i10-g1`, `a09-g1`, `e06-g*`, `m05-g1`; conversion task of `xi` | convert chain | F1 |
| Full games | `b10-g1`, `b10-g2`, `xb` games, `pb-g*` | `scripted` opening → `pressing(2)` | F2 (F2b if F2 fails §5.7) |
| Reviews (R7) | `a10-g1`, `e09-g1`, `m08-g1` | none (post-game analysis) | unchanged |

**Dependency on validating `pressing`.** Every assessment use of `pressing` (all rows above except the drills, and the
`xb`, `xi`, `xa`, `xe`, `xm` tasks that use them; the drills and reviews do not use it) depends on its step-2 validation (04 §5.5 item 4); until then `pressing`
is a practice partner only. **Fallback F**, applied while `pressing` is not validated, if it fails validation, or for
any single task that fails the §5.7 guard:

- **F1 (hold, convert, plan tasks):** *tree-bounded* scoring. The task is played only while the opponent's moves come
  from the authored tree or `forcing-attack(2)` (verified threats); when only `pressing` would move, the task ends and
  the rubric scores the position reached. A task whose tree is too short to pass §5.7 stays practice only.
- **F2 (full games: `b10-g1`, `b10-g2`, `xb` games, `pb-g*`):** partner `safe-sparring(2)` with τ = 1.0; the result
  is not scored (against `safe-sparring` it shows only safety, 04 §5.6): game score = R1 × 0.6 + R2 × 0.2 + R0 × 0.2.
- **F2b (if the F2 games fail the §5.7 guard).** `safe-sparring` makes no threats, so a safe shuffler (N2) may pass an
  F2 game. Then each game starts with a `scripted` Basic opening tree (short lines with deviations as in b09l4, at
  least 4 learner moves) and is scored R1 × 0.4 + R2 × 0.2 + R0 × 0.1 + line share × 30, where *line share* (0 to 1) is
  the share of the learner's line nodes answered target/sound (as in R6). If F2b also fails §5.7, the two games are still
  played to their end and must finish without a critical failure (§5.6), but are not scored; the scored game evidence
  of `xb` is then two F5 Basic opening tasks (one per colour, built like `b09-g1` with a scripted first part, scored
  R6 × 0.5 + R1 × 0.5 like `i08-g1`).
- **F3 (`xb`):** in addition to the two games (F2 or F2b), two tree-bounded hold tasks from Basic-level positions
  (verified threat at the start; threat tree → `forcing-attack(2)`), each ≥ 75.
- **F4 (`xi`, `xa`, `xe`, `xm`, placement practical tasks above Basic):** each `pressing`-dependent task is replaced by
  a tree-bounded task (F1) with the same rubric, except opening and repertoire tasks, which follow F5. Under F, `xi` is
  two F5 opening-to-middlegame tasks (one per colour) plus its endgame conversion task tree-bounded (F1: counterplay
  tree → `forcing-attack(2)`, no `pressing`).
- **F5 (opening tasks: `i08-g1`, `i09-g1`, `i11-g1`, `i11-g2`, `e08-g1`, `e08-g2`, `m06-g1`, the opening tasks of
  `xi`, the repertoire tasks of `xe`, the opening task of `xm`, and `pi-g*`):**
  1. *Line part unchanged.* The `scripted` tree plays the opponent; R6's line term is the share of the learner's line
     nodes answered target/sound. A learner move off the tree that the default class (04 §5.4) does not class as
     error ends the line part, not the task; an error-class move counts as a missed node.
  2. *Continuation.* The opponent is `safe-sparring(2)` with τ = 0.5 for the task's remaining learner moves (the same
     cap as with `pressing`). Only R2 and R1 are scored on it: R6 = line share × 60 + R2 × 0.4, with R2 taken over
     the learner's first *n* moves of the **whole task** (line moves included), so a short line or an early off-tree
     move does not shrink R2's window.
  3. *R3 terms* (`i11-g1`, `i11-g2`) use only **own-side** predicates under F5 (placement and mobility of the learner's
     pieces; a chosen target attacked by at least two learner pieces), evaluated at the end of the task. Predicates
     that need the opponent's resistance are not used against `safe-sparring`.
  4. No result, R4 or R5 term is earned against `safe-sparring`. The §5.7 guard runs on the F5 version of each task; a
     task that fails it stays practice only and the pool supplies another.

  Rationale: the scripted line carries the opening evidence and does not depend on `pressing`; R2 + R1 against
  `safe-sparring(2)` is the evidence already accepted for `b09-g1`. τ = 0.5 above Basic makes the partner's replies
  less random than the Basic setting.
- **Provenance.** A grant earned under F records which fallback applied (`fallback: 'F1' … 'F5'`, 05-migration.md
  §8.3). It is not revoked when `pressing` is validated later, and the portfolio (§6.1) lists fallback-based evidence.

**Reachability under F.** Mastery never depends on `pressing`: it comes from unit checks (and `xm` for m09). Level
application needs, for each exam slot, at least one published task that passes the §5.7 guard in its F form.
Tree-bounded (F1), line-based (F5) and F2b tasks can be made to pass by authoring (longer trees, more narrow
positions), so this is a production obligation that each level's release item checks (06-backlog.md S3.4, S3.8, S3.12,
S3.16, S3.19). Under that obligation all five levels stay masterable and applied, and graduation stays reachable:

| Level | Mastery under F | Level application under F | Unit practical tasks under F |
| --- | --- | --- | --- |
| Basic | Checks b01–b10 (b01, b10 short form) | `xb`: two games (F2, or F2b, or unscored games + two F5 Basic opening tasks) + two F3 hold tasks + R7 review | `b08-g1`, `b09-g1` unchanged (`safe-sparring`); `b10-g1`, `b10-g2` scored like the `xb` games |
| Intermediate | Checks i01–i11 | `xi` (F4): two F5 opening-to-middlegame tasks + F1 conversion | `i01-g1` F1 (plan); `i07-g1` F1 (hold); `i08-g1`, `i09-g1`, `i11-g1`, `i11-g2` F5; `i10-g1` F1 (convert) |
| Advanced | Checks a01–a10 | `xa` (F4): F1 improving/attack-building, F1 positional defence, F1 endgame + R7 review | `a03-g1`, `a06-g1` F1; `a07-g1`, `a09-g2` F1; `a09-g1` F1; `a10-g1` review (no partner) |
| Expert | Checks e01–e09 (e09 short form) | `xe` (F4): two F5 repertoire tasks + F1 conversion + F1 holding + R7 review | `e03-g1` F1; `e04-g1`, `e07-g1` F1; `e06-g1`, `e06-g2` F1; `e08-g1`, `e08-g2` F5; `e09-g1` review |
| Master | Checks m01–m08 (m07 short form); m09 by `xm` | `xm` (F4): ≥ 5 tasks — opening F5; middlegame, defence and endgame F1; both colours — and their reviews | `m02-g1`, `m03-g1` F1; `m05-g1`, `m05-g2` F1; `m06-g1` F5; `m08-g1` review |

Placement practical tasks follow the same rules: `pb-g*` F2/F2b, `pi-g*` F5, `pa-g*` and `pe-g*` F1.

**Answer to 04 R3:** results against `safe-sparring(2)` count only for `b08-g1`, `b09-g1` (safety and development
process), the F2/F2b games and the F5 continuation (R2 and R1 only), never as a game result. Results against
`pressing(2)` count only after its validation, and only through rubrics whose process items it cannot inflate; a game result against it is at most 40 % of a Basic exam
game (§6).

All partners avoid creating a third repetition unless every alternative loses ≥ `WIN_MATERIAL_THRESHOLD` by their
search, and never make a move that loses under §5.5.

### 5.3 Signals and rubrics

**Safety horizon by level (answers 04 R7; Proposal, content reviewer to confirm).** *h* = plies searched after the
learner's move, opponent first, plus capture quiescence; *k* = forced-mate depth; *T* = 2 points everywhere.

| Level | Allowed-loss horizon *h* | Allowed-mate *k* | Missed gain counted | Missed mate counted |
| --- | --- | --- | --- | --- |
| Basic | 1 (hanging pieces, losing exchanges) | 1 | Only free captures (`captureGain` ≥ 2) | Mate in 1 |
| Intermediate | 2 (adds forks, pins, discovered attacks) | 2 | Gains within 2 plies of the learner's move, from i02 on | Mate in 1; mate in 2 from i05 on |
| Advanced | 2 at runtime; 3 at authoring and, once step 2 measures it within budget, in post-game analysis | 2 | Gains within 2 plies | Mate in 2 |
| Expert, Master | same as Advanced | 2 | Gains within 2 plies (3 once measured) | Mate in 2 |

The same (*h*, *k*, *T*) are the default safety guard of `decision` items at runtime; authoring-time checks may go
deeper (04 R7: d = 2 and k = 2 at runtime, 3–4 at authoring). Until step 2 measures *h* = 3 on phones, every runtime
and post-game signal uses *h* = 2 above Basic. Cost basis: 04 §5.4 measured ~77 ms (d = 2) and ~721 ms (d = 3) median for all 37 moves of a quiet
full-board position on desktop; the definitions below search all alternatives only when a move is already
suspicious, to stay within budget.

**Signals** (computed after the game in a Worker; per learner move *m* in position *P*):

- *S(m)* = `moveScore(P, m, h + 1)` (learner's view); *B* = `materialBalance(P, learner)`; *L(m)* = *B* − *S(m)*.
- **Allowed loss**: *L(m)* ≥ *T* **and** *L(m)* − min over legal *m′* of *L(m′)* ≥ *T* (the second search only runs when
  the first condition holds; an unavoidable loss is not penalised). **Serious** if that difference ≥ 4.
- **Allowed mate**: after *m* the opponent has a forced mate within *k* (`hasForcedWin`) and some legal alternative
  avoids it. Always serious.
- **Missed gain**: some *m′* has *S(m′)* − *B* ≥ *T* and *S(m′)* − *S(m)* ≥ *T*, within the level's missed-gain
  horizon and taught motifs.
- **Missed mate**: *P* had a forced mate within the level's depth and *m* does not keep one.
- **Unanswered threat** (used by m03 and in feedback): an allowed loss or allowed mate at *m* whose threat already
  existed in *P* (the opponent, moving again from *P*, would gain ≥ *T* or mate; computed only when *P* is a legal
  position with the learner not in check).
- **Threat at the end**: in the final position the opponent, if to move, has a forced mate within 2 or a gain ≥ *T*.
- **Development count**, **idle General moves**, **objective predicates**: as 04 §5.4 layer 2.

**Per-move penalty:** each learner move receives only its single largest penalty (no double counting of one move as,
e.g., both serious allowed loss and missed gain).

| Rubric | Used for | Criteria (sum 100) |
| --- | --- | --- |
| **R0 Material held** | Short tasks with R1 | Final balance ≥ start − 1: 100; ≥ start − 3: 50; else 0 |
| **R1 Safety** | Every `play` task | 100 − per move: serious allowed loss or allowed mate 50 · allowed loss 25 · missed mate 25 · missed gain 15; floor 0 |
| **R2 Development** | Opening tasks | Developed pieces by learner move *n* ≥ target: 50 (pro rata); no idle General/Advisor moves in the first *n*: 25; no piece moved > 3 times in the first *n* without capturing or answering a threat: 25 |
| **R3 Plan** | Improving, attack-building, plan tasks | Objective predicate reached by the cap: 50; reached with R1 ≥ 75: 30; own non-General mobility at end ≥ start: 20 |
| **R4 Conversion** | Winning from an advantage | Mate or stalemate win within the cap: 60 (else lead at the end ≥ lead at the start: 30); opponent never had a forced mate within 2: 20; R1 ≥ 75: 20 |
| **R5 Holding** | Defending | Gate: not mated. Final deficit ≤ start deficit + 1: 30; no threat at the end: 20; R1 × 0.2: 20; **holding objective predicate** (authored: counterplay created — a learner move after which the learner threatens a gain ≥ *T* or mate; or an attacker exchanged; or a reviewed defensive setup reached): 30. Without the predicate the maximum is 70, below the pass mark |
| **R6 Opening line** | `line` → `play` openings | Share of line nodes answered target/sound × 60 + R2 on the moves after the line × 0.4 |
| **R7 Self-review** | `review` tasks | Marks one of the top 3 turning points (largest allowed loss/missed gain): 40; better move target/sound (authored game) or improving *S* by ≥ *T* (own game): 40; reason category matches the detected one (allowed loss / missed gain / missed mate / allowed mate): 20. Positional reflection recorded, **not scored** |

A task's score is the weighted sum of its rubrics as listed in the unit (e.g. `b08-g1`: R1 70 % + R0 30 %;
`i08-g1`: R6 50 % + R1 50 %; `m03-g1`: R3 50 % + R5 50 %). If an own game has no turning point, R7 uses another
game.

### 5.4 What practical scoring cannot see

Material-only signals cannot recognise positional mistakes. These are assessed only through authored `decision`,
`choice` and `line` items and R2/R3/R5 predicates, and self-reported in reviews. The app never claims to have
assessed them in free play.

### 5.5 Ending games and tasks (answers 04 R2)

- **Mate / stalemate** end the task (stalemate: the stalemated side loses).
- **Repetition (training ruleset, aligned with 04 §5.7):** position key = board + side to move. At a third occurrence:
  (1) one side gave check on every move of the cycle and the other did not → the checking side loses; (2) both or
  neither checked → draw; (3) **perpetual chase is not adjudicated** (disclosed; it needs judging new attacks on
  unprotected pieces with many official exceptions). To stop rule (3) being exploited, **the learner may not play a
  move that creates a third occurrence** unless it is the only legal move or every other legal move fails the level's
  safety guard; the move is refused with an explanation. Partners avoid it as in §5.2. Hence a repetition can only
  end a task when it is forced.
- **Move cap** (tasks): ends the task with no result; rubrics score the position reached.
- **Full games** (b10, `xb`, placement `pb-g*`): the game stops at the **cap of 80 learner moves** or at the
  **no-capture limit (30 consecutive learner moves without a capture by either side)**, whichever comes first. At
  either stop the same rule applies: quiescence-resolved material lead ≥ 4 with no forced mate against the leader
  within 2 → training win for the leader; otherwise training draw. (Same rule at both stops because a lead of a Horse
  or more is just as decisive when no captures happen; a draw at the no-capture limit would reward the defending
  side for passivity.) Disclosed as training results, not official rules.
- **In holding tasks** a forced repetition draw counts as "not mated"; the rubric then scores the position reached.

### 5.6 Pass rules

- **Pass:** task score ≥ **75** and no critical failure.
- **Critical failures:** mated or stalemated; losing by repetition rule (1); in a conversion task, the opponent having
  a forced mate in the final position; a serious allowed loss in a task flagged `safety-gate`.
- A failed task can be retried at once with a new seed; only a passing run grants "applied"; run count is recorded.
- **Voided runs.** A run is voided — no grant, no penalty, not counted as a retry — when any partner move came from
  the device-dependent fallback (04 §5.5: the safety-net time fired and the policy played its d = 1 move) or any
  post-game signal of a learner move could not be computed within its budget ("not checked", 04 §5.4). So a slower
  device can never face a weaker partner, or skip a penalty, in counted evidence. The learner is offered a new run
  with a new seed; inside a placement test the voided practical task may be replayed once, and if it voids again the
  test ends with "could not be assessed on this device" and changes nothing (§7.4 "Fail" rules apply, without a
  retake limit). Voids are logged locally for content review.

### 5.7 Guarding against false success and false failure (authoring validation; Needs architecture confirmation)

Every task used as application evidence must pass these automated checks (content validator or a slower content
script), otherwise it is practice only:

1. **Achievable:** a reference run (authored line, or a deeper search playing the learner's side) passes for every
   validation seed.
2. **Naive learners fail.** N1 = random legal moves; N2 = **safe shuffler**, random among moves passing the level's
   safety guard (*h*, *k*). N1 must fail ≥ 90 % of seeded runs of every task; N2 must fail ≥ 80 % of seeded runs of
   every task, including R1-only, R2, R5 tasks and `xb` games (thresholds calibrated in the pilot).
3. **Pressure, so that N2 fails for the right reason (R1, R5, `xb`):** the reference run contains at least 3 **narrow
   positions** (≤ 3 legal moves, or ≤ 20 % of legal moves, pass the safety guard), and the opponent's moves include
   threats beyond the shuffler's horizon *h*: from the verified threat or counterplay tree, from `forcing-attack(2)`
   (an exhaustive mate search reaches further than the material horizon), or from a partner searching deeper than *h*
   (e.g. `safe-sparring(2)` against the Basic *h* = 1). For full games, where narrow positions cannot be authored, the
   N2 failure rate of item 2 over the validation seeds is the requirement. Relies on 04's chains and, for `pressing`,
   its validation (§5.2, fallback F).
4. **Objective content:** R5 needs its holding predicate (max 70 without it); R1 tasks are paired with R0 or another
   rubric, so pure caution does not pass a task whose objective is more than safety.
5. **Real resistance:** where a task claims counterplay, the partner creates at least one threat in the reference run.
6. **Alternatives tolerated:** a second reasonable plan (authored by the reviewer) also passes.

Failed-run reports (local only, no network) help reviewers find false failures.

---

## 6. Level exams (application at level scope)

Exam positions come from exam pools not used in practice, checks or placement.

| Exam | Tasks (lengths calibrated in the pilot) | Pass |
| --- | --- | --- |
| `xb` Basic | Two full games from the initial position (one per colour), `scripted` opening → `pressing(2)`, ended per §5.5. **Per-game score** (also the rubric of `b10-g1`/`b10-g2`): result (training win 40, training draw 20, loss 0) + R1 × 0.4 + R2 × 0.2; then R7 review of either game. Under fallback F: F2 games (F2b if they fail §5.7) + F3 hold tasks | Both games ≥ 75, no critical failure; review ≥ 60. Under F: also both hold tasks ≥ 75; if the F2b games are unscored, they must finish without a critical failure and both F5 Basic opening tasks must score ≥ 75 |
| `xi` Intermediate | Opening-to-middlegame task per colour (R6 + R1, `scripted` → `pressing(2)`); elementary endgame conversion (R4, convert chain). Under F: F4 (opening tasks F5, conversion F1) | All three ≥ 75 |
| `xa` Advanced | Improving/attack-building (R3 + R1, `pressing(2)`); positional defence (R5, hold chain); endgame (R4 or R5, convert/hold chain); R7 review of one. Under F: F4 (all F1) | All ≥ 75; review ≥ 60 |
| `xe` Expert | Repertoire task per colour (R6 + R1); conversion with counterplay (R4, convert chain); holding (R5, hold chain); R7 review. Under F: F4 (repertoire tasks F5, the others F1) | All ≥ 75; review ≥ 70 |
| `xm` Master (m09) | ≥ 5 unlabelled tasks across opening, middlegame, defence and endgame, both colours; R7 review of each, including the critical moment (m07). Under F: F4 (opening task F5, the others F1) | Every task ≥ 75 and every review ≥ 70 |

### 6.1 Portfolio (m09)

A generated summary, not a certificate: units completed / mastered (and how) / applied, per-strand check and exam
results, reviewed games, recurring engine-detectable mistake categories, and a remediation path for any strand below
80 % of its unit-check points. Reassessment = new seeds and unexposed positions. Wording never implies an official
title, grade or rating.

---

## 7. Jump-ahead (placement and test-out)

Replaces today's jump test. Items come from **placement pools** (`p<level>-NN`); practical tasks from **placement
practical pools** (`p<level>-g<k>`). Both are separate from practice, check and exam pools.

### 7.1 Kinds

| Kind | Trigger (today's entry points) | Scope |
| --- | --- | --- |
| **J1 Level placement** | Home "jump to <level>" banner | Every level below the target |
| **J2 Unit test-out** | Tapping a locked lesson / "Jump here" on a locked unit | Skipped units within one level |

### 7.2 Form

- **J1:** 20 items × 4 points = 80, plus one placement practical task worth 20 (task score ÷ 5). Exactly 4 items per
  strand RS, TC, OD, PA, DE; PP is covered by the practical task.
  - **TC, OD, PA, DE**: at least 2 of the 4 from the highest skipped level.
  - **RS** is taught only in Basic, so RS items always come from the Basic RS placement pool; for targets above
    Intermediate they are the pool's `full-board` RS items (blunder checks in positions typical of the highest
    skipped level). At least 2 of the 4 are safety-critical. For coverage (§7.4) each RS item counts toward the Basic
    unit it is tagged with (b01–b08); `full-board` safety items are tagged b08.
  - ≥ 1/3 as Black; ≥ 1/4 quiet. Items are spread to sample as many distinct skipped units as possible (one item per
    unit before any second).
  - Practical task by target: into Intermediate → `pb-g*` (full game as b10, colour seeded); into Advanced → `pi-g*`
    (as i11-g1/g2); into Expert → `pa-g*` (as a07-g1 or a09-g1); into Master → `pe-g*` (as e06-g1/g2).
- **J2:** *n* = 4 × skipped units, clamped to 10–20 items, equal weight totalling 100. If the skipped range includes a
  **PP-primary** unit (b10, a10, e09, m07, m08, m09; i11's PP is secondary), items total 80 and a placement practical
  task for that unit (game, review or critical-moment task) adds 20.
- **No J2 within Master.** Master units are unlabelled mixed practice whose only evidence is their own checks and
  `xm`; a test-out would bypass both. Learners reach Master by J1 (into Master, using the `pe` pools) or by working
  through Expert; within Master, lessons unlock in order. There is therefore no `pm` placement pool.
- No hints, retries or lives; each item answered once. Right/wrong after each item; explanations on the result screen.
- **Early stop** when passing has become impossible.

### 7.3 Pass rule (all must hold)

1. **Total ≥ 90/100**, computed exactly (fractions kept; no rounding before comparison). The screen shows the total
   rounded **down** (89.8 shows 89 and fails).
2. **Per-strand minimum:** each strand with ≥ 4 items scores ≥ 75 % of its points; a strand with < 4 items in the
   form must be fully correct.
3. **All safety-critical items correct.**
4. **Practical evidence** (when present): task score ≥ 75, no critical failure, one run (no retry inside the test).
5. **First attempt only**, no hints offered.

**J1 boundary examples (become table-driven tests):**

| Items correct | Misses | Practical | Exact total | Result |
| --- | --- | --- | --- | --- |
| 20/20 | — | 75 | 80 + 15 = 95 | Pass |
| 19/20 | 1 TC | 75 | 76 + 15 = 91 | Pass |
| 19/20 | 1 TC | 70 | 76 + 14 = 90 | **Fail** (practical < 75) |
| 18/20 | 1 TC, 1 PA | 100 | 92 | Pass |
| 18/20 | 1 TC, 1 PA | 90 | 72 + 18 = 90 | Pass (exactly 90) |
| 18/20 | 1 TC, 1 PA | 89 | 72 + 17.8 = 89.8 | **Fail** (shown as 89) |
| 18/20 | 2 TC | 100 | 92 | **Fail** (TC 50 %) |
| 18/20 | 1 PA, 1 RS critical | 100 | 92 | **Fail** (critical item) |
| 17/20 | 3 strands | 100 | 88 | **Fail** (total) |

### 7.4 Outcome

- **Pass:**
  - every skipped lesson becomes *completed (placement)*, so the path unlocks;
  - a skipped unit becomes *mastered (placement)* only if it was **covered**: the form contained ≥ 1 item from it and
    all its items were answered correctly. Other skipped units stay unmastered with their unit checks available; the
    result screen lists both groups (Basic placement samples all 10 units; higher targets sample a subset);
  - the passed placement practical task grants "applied" to the practical task it is declared equivalent to (e.g.
    `pb-g1` ≡ `b10-g1`), because it is a practical task, not a placement item. Level "applied" still needs the level
    exam;
  - no XP (as today), no hearts used.
- **Fail:** nothing changes; the result screen shows total, strands and explanations, and points to the first skipped
  unit carrying the weakest strand.
- **Retake:** a new form avoiding exposed items; one attempt per target per local day. **Unresolved (UA2):** relax the
  daily limit for single-unit J2.
- Units already mastered are excluded from the form, which shrinks within the clamps.

---

## 8. Reference ruleset (answers 04 R2)

### 8.1 Taught reference (Proposal)

The course teaches the **Asian Xiangqi Federation (AXF) rules** as its reference: win by checkmate or by stalemating
the opponent; the flying-General rule; perpetual check is forbidden (the checking side must deviate or loses);
perpetually chasing an unprotected piece is likewise forbidden; repetitions where neither side breaks a rule are
drawn; draws by agreement exist. This is a design summary, **not** a verified quotation: the content reviewer checks
every rules sentence in b05l3 and e07l3 against the rulebook before publication. **Unresolved (UA3):** edition to cite;
whether to note differences with the Chinese Xiangqi Association rules.

### 8.2 Implemented in the engine (Verified)

Legal moves, check, checkmate, stalemate-as-loss, flying General. **Not** implemented: repetition, perpetual
check/chase, move-count draws. The engine is not changed; adjudication is a separate module (04 §5.7).

### 8.3 App training ruleset (Proposal · Needs architecture confirmation)

Exactly §5.5: perpetual check adjudicated; perpetual chase **not** adjudicated (aligned with 04); the learner may not
create a third occurrence (so chase cannot be exploited); 30-move no-capture limit and 80-move cap with material
adjudication for full games. **Content rule:** no lesson, check or placement item depends on repetition adjudication,
except rules `choice` items (b05l3, e07l3). **Disclosed limitation:** where official rules would make a chasing side
change moves, the training ruleset instead forbids the learner any third repetition and lets the partner repeat only
when forced; results are labelled "training result".

---

## 9. XP, streaks and hearts are not competence

1. Mastery and application logic must not read XP, streaks, hearts, daily goals or puzzle solves; enforced by a purity
   test: the assessment/progress-state module may not import `src/gamification`.
2. XP stays completion-based (Verified `rules.ts:23–28`). **No XP for checks, placement or exams.**
3. Checks, placement tests and exams cost no hearts and are available at 0 hearts.
4. Mastery and application have their own markers, separate from XP and streak; no learner label from XP totals.
5. Puzzle-bank solves never count toward any state.

---

## 10. Tests required when implemented (input for S1.4 / step 2)

- Credit per item type; `dubious` partial only when flagged; first-answer-only; voided items (§3.2).
- Unit-check boundaries: 7/8 with all critical correct → mastered; 7/8 with the critical missed → not; 6/8 → not;
  short form 5/6 → mastered, 4/6 → not. b10, e09, m07 reachable by checks; m09 mastered only by `xm`; level mastery
  reachable by working through every level.
- J1 table of §7.3 (including 89.8 → fail, exact-90 → pass); J2 clamps, "< 4 items must be perfect", PP-primary list;
  early stop; coverage rule for placement mastery; equivalence rule for "applied".
- Form assembly: strand counts, RS sourcing, colour share, quiet share, interleaving, exposure avoidance, seeded
  determinism.
- Signals and rubrics R0–R7 on fixed recorded games: unavoidable loss not penalised; one penalty per move; R5 max 70
  without predicate; critical failures.
- §5.7 guards: N1/N2 failure rates and narrow-position count on every published practical task.
- Training ruleset: perpetual check loses; both/neither → draw; learner third-repetition refusal and its exceptions;
  no-capture limit and cap: same lead rule at both stops.
- Partners and fallback: task kind → partner table; while `pressing` is unvalidated, F1–F5 apply (tree-bounded tasks
  end when the tree and `forcing-attack(2)` run out; F2 game score has no result term; F2b adds the scripted line term;
  `xb` under F needs the F3 hold tasks; `xi` under F is two F5 tasks + an F1 conversion; F5 scores only line share,
  R2 over the whole task and R1, R3 with own-side predicates only); grants record the fallback used; the reachability
  table of §5.2 holds (every level masterable and applied, graduation reachable) on a fixture pool.
- `forcing-attack`: plays a forced mate within k when one exists, else the highest winning capture (gain ≥ 2 at d = 2
  + quiescence), else hands over; seeded tie-break.
- Voided runs: a device fallback move or a "not checked" signal voids the run (no grant, no penalty, no retry
  counted); a voided placement practical task is replayed once, then "could not be assessed".
- Merge: higher score wins, ties later date; monotone.
- Separation: assessment module does not import `src/gamification`; XP unchanged by checks.
- Migration: old completion → completed only (S1.3).

---

## 11. Limitations (honest statement)

- Automated scoring shows that a learner answered items and passed tasks under stated conditions; it does not prove
  learning or playing strength (step 4 needs studies with real learners).
- Thresholds (80, 75, partner margins, task lengths, guard rates) are uncalibrated defaults.
- Training partners are limited and material-only; a pass is evidence only to the extent §5.7 holds.
- Positional judgement is assessed only through authored, reviewed items.
- The training ruleset differs from official rules on perpetual chase and move limits (§8.3).

---

## 12. Proposed decisions (for the driver to record in DECISIONS.md)

1. Three separate states with provenance; every unit masterable by its check (m09 by `xm`); old completion →
   completed only.
2. Unit-check mastery ≥ 80/100 first attempt + all safety-critical items; jump-ahead ≥ 90/100 exact (display floored),
   per-strand ≥ 75 % (strands < 4 items perfect), all safety-critical items, practical evidence; placement mastery
   only for covered units.
3. Separate pools: practice, unit check, placement, placement practical, exam; drafts never served.
4. AXF rules taught as the reference; training ruleset §5.5 (perpetual check adjudicated, chase not, learner may not
   create a third repetition, 30-move no-capture limit, 80-move cap with material adjudication).
5. Partners: 04's policies and chains (§5.2): hold = threat tree → `forcing-attack(2)` → `pressing(2)`; convert =
   counterplay tree → `forcing-attack(2)` → `pressing(2)`; games = `scripted` opening → `pressing(2)`;
   `safe-sparring(2)` for early Basic practice, `b08-g1`, `b09-g1`, fallbacks F2/F2b and the F5 continuation only.
   Assessment use of `pressing` only after its step-2 validation; fallback F1–F5 otherwise, with the reachability
   table of §5.2. Withdraws `spar`/`defend`/`counter` and `safe-sparring(4, 0)` (answers 04 R8).
6. Safety horizon table (§5.3) as the default guard for rubrics and `decision` items; *h* = 2 at runtime above Basic
   until step 2 measures *h* = 3 (answers 04 R7).
7. Mastery merge: higher score, ties later date (same as 04 §5.8).
8. Notation and glossary owned by S1.2 (02-curriculum.md §4); orientation mechanics by S1.1.
9. No XP for assessments; no hearts; purity test against `src/gamification`.

## 13. Unresolved

Owners are backlog items of [06-backlog.md](./06-backlog.md) (S1.4). Items resolved by another document are kept for
traceability with a pointer.

| # | Question | Status · owner |
| --- | --- | --- |
| UA1 | "Needs review" after a failed warm-up (§4.5) | Open · S2.20 (LX review of the pilot; default until then: suggestions only, no badge) |
| UA2 | Daily retake limit for single-unit J2 (§7.4) | Open · S2.20 (LX; default: one attempt per target per local day, as §7.4) |
| UA3 | Rulebook edition; CXA differences (§8.1) | Open · S3.2 (content reviewer, before b05l3 is published; same as 07 S07-U3) |
| UA4 | Storage/sync format for attempts and states (§3.1) | **Resolved** by 05-migration.md §8.3 (`learning.records.v1`, local attempt log) and §8.6 (`data_v2`) |
| UA5 | Phone cost of *h* = 3 post-game signals and of `pressing(2)` (04 R6); whether `pressing` passes validation (04 §5.5 item 4), which decides between the main partners and fallback F | Open · cost: S2.6; validation: S2.18. Fallback F (§5.2) keeps every level reachable either way |
| UA6 | N1/N2 failure-rate thresholds and the narrow-position count (§5.7) | Open · S2.20 (calibrated on the pilot tasks with the S2.12 guard script) |
| UA7 | Whether the 80-move cap and 30-move no-capture limit make Basic full games too long on a phone | Open · S2.20 (LX, with S2.6 timings); full games are not in the pilot, so it is confirmed again in S3.3 |
