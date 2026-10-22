# Assessment specification

Backlog item S1.2 · Owner: curriculum designer · Companion: [02-curriculum.md](./02-curriculum.md) (units,
exercise types, ids). Architecture feasibility: [04-architecture.md](./04-architecture.md) (S1.1, written in
parallel). Migration of existing progress: `05-migration.md` (S1.3).

Labels as in 02-curriculum.md §0: **Verified**, **Proposal**, **Unresolved**, **Needs architecture confirmation**.
Everything not labelled otherwise in §2–§10 is a **Proposal**. All numeric thresholds below (except the ≥ 90/100
jump-ahead bar, which is a requirement of `01-audit-and-design.md`) are design defaults to be calibrated in the
pilot (step 2); none is claimed to measure playing strength or a rating.

---

## 1. Current state (Verified)

| Fact | Evidence |
| --- | --- |
| The only progress state is "completed lesson" (a set of ids) | `src/storage/index.ts:61` (`progress.completedLessons.v1`) |
| A lesson completes when every exercise is eventually answered; wrong answers are retried; hints exist only in `combination` exercises; neither affects completion | `src/components/LessonPlayer.tsx` (retry at `:226`, `:528`; hint at `:537–540`) |
| First-try correct answers are counted but only displayed on the completion screen | `src/components/LessonPlayer.tsx:71`, `:152` |
| Jump-ahead: the last two practice exercises of every skipped lesson, at most 8, 3 lives of its own (real hearts untouched, works at 0 hearts); passing marks skipped lessons complete with no XP | `src/lessons/progress.ts:39–60`; CLAUDE.md "Jump ahead" |
| The jump test therefore reuses practice items, has no score out of 100, no strand coverage and no practical play | same |
| XP: lesson first completion 10, replay 5, first puzzle solve 5 | `src/gamification/rules.ts:23–28` |
| Repetition, perpetual check and perpetual chase are not handled by the engine; stalemate is a loss for the stalemated side; flying General enforced | `src/engine/status.ts:12`; CLAUDE.md "Engine conventions" |
| Engine evaluation is material only, with a capture-quiescence search; "win material" means ≥ 2 points (`WIN_MATERIAL_THRESHOLD`) at depth 4 (`WIN_MATERIAL_DEPTH`) | `src/engine/solver.ts:9–17`, `:164–175`; `src/puzzles/logic.ts:19–21` |

Consequence: today the app can show *completion* only. Mastery and application need new evidence, described below.

---

## 2. Three progress states

| State | Scope | Granted by | Never granted by | Can it be lost? |
| --- | --- | --- | --- | --- |
| **Completed** | Lesson (and unit = all its lessons) | Finishing every exercise of the lesson, with any number of hints and retries; or a passed jump-ahead (marked "by placement"); or migration of old completion (S1.3) | — | No (except "Reset progress") |
| **Independently mastered** | Unit | A passed **unit check** (§4) on first attempts without hints; or a passed **jump-ahead** test that covered the unit (marked "by placement") | XP, streaks, hearts, lesson completion, practice accuracy, puzzle solves, old (migrated) completion | Not revoked by time or by later mistakes (§4.5); a later failed check is recorded but does not remove it |
| **Applied in practical play** | Practical task (`-g` id), unit (all its tasks), level (level exam) | Passing the practical task's rubric (§5) from a set position against a training partner | Any non-`play`/`review` item, XP, streaks, placement items | No |

Rules:

1. The three states are stored and shown separately. A unit can be completed but not mastered, mastered (by
   placement) but not completed, mastered but not applied, and so on.
2. Units with no practical task show "applied: —" (not applicable), never "applied".
3. **Level status:** a level is *mastered* when every unit in it is mastered; *applied* when its level exam
   (§6) is passed. The course is *graduated* when every level is mastered and applied and `xm` is passed.
4. Old completion migrates to **Completed only** (S1.3). The UI must not present migrated completions as mastery.
5. Each state records how it was obtained (`practice` / `check` / `placement` / `practical` / `migration`), the
   date and the content version, so a reviewer can tell evidence apart.

---

## 3. Evidence and item scoring

### 3.1 Attempt record (Needs architecture confirmation: storage format, size cap, sync)

Every answered item in any mode records: item id, item version, mode (`practice`, `check`, `placement`,
`practical`, `exam`), timestamp, colour played, **first answer credit**, hints used (count and ladder step),
attempts before success, seed (for `line` / `play` randomness), and misconception tag of the first wrong answer.
Persistence goes through `src/storage` (a new repository; no direct `localStorage`). The per-attempt log may stay
local and capped; mastered/applied states must sync (merge rule: union, keep the earliest grant date; S1.3).

### 3.2 Credit per item (first answer only)

| Item type | Full credit (1) | Partial | Zero |
| --- | --- | --- | --- |
| `select-squares` | Exact set | None in checks (practice may show "3 of 4 found") | Any missing or extra square |
| `move` / `capture` | Engine confirms the goal | — | Otherwise |
| `combination` | Every own move engine-confirmed, first time | — | Any wrong move (the item ends; a retry is practice, not credit) |
| `choice` | The keyed option(s); multi-select must match exactly | — | Otherwise |
| `decision` | Class **target** or **sound** (02-curriculum.md §4.3) | **dubious** = 0.5 only when the item is flagged `partial` (e.g. "find a safe useful move" items where the objective is safety) | **error**, or **dubious** without the flag |
| `line` | Every learner move in target/sound classes until the line ends | Item may define per-node credit (sum ÷ nodes) when flagged | First error-class move |
| `play` | Rubric (§5): task score ÷ 100 | Continuous | Critical failure (§5.5) |
| `review` | Rubric R7 (§5.3) | Continuous | — |

**Hints and retries.** Unit checks, placement tests and exams offer **no hints and no retries**: the first answer
is the only answer. In practice, hints and retries are allowed, recorded and shown ("independent: 5 of 8"), and
**never** produce mastery or application.

### 3.3 Content versions

Credit is recorded against the item version answered. A new version of an item does not invalidate a granted state;
it only means the new version is unexposed for that learner (§4.3).

---

## 4. Unit checks (independent mastery)

### 4.1 Default blueprint

| Parameter | Default |
| --- | --- |
| Length | 8 items (b01: 6), equal weight, score out of 100 |
| Coverage | Every lesson objective of the unit at least once; ≥ 6 items from this unit |
| Interleaving | From b03 on, 2 items from earlier units (preferably sharing a strand), so the unit's context does not give the answer away |
| Colour | From b02 on, at least one third as Black (unit headers may require more) |
| Quiet items | In units with a primary PA, OD or DE strand, at least a quarter of the items have no immediate tactical win |
| Safety-critical items | Items flagged `critical` (blunder checks, escaping mate in one, not hanging a Chariot). From b08 on, each check contains at least one, possibly interleaved |
| Mastery | Score **≥ 80/100** (with 8 items: at most one item missed) **and** every `critical` item correct |
| Feedback | After each answer: right/wrong and the position-specific explanation (unit checks are also learning moments) |

Unit headers in 02-curriculum.md state deviations (e.g. b10 has practical tasks instead of a check; m01 is fully
mixed).

### 4.2 Item design rules: no motif leaks

1. **Neutral prompts.** Assessment prompts name only the side to move and the kind of answer: "Black to move. Play
   the best move.", "Who is better, and why?", "Tap every Red piece that can be captured for free." They never name
   the motif, the piece to move, the target square or (for strategic items) whether a tactic exists. A forced-mate
   item says "Find the best move", not "Mate in 3": credit goes to any move that keeps a forced mate within the
   item's depth (engine-verified), then the line continues against best defence.
2. **Neutral titles.** "Unit check", "Placement test", "Level exam": no lesson or pattern names on screen.
3. **No scaffolds.** No highlights, no `from` restriction, no hint button, no "checking your move…" wording that
   reveals a deep tactic (the pause may exist, but with a neutral text).
4. **Unseen positions.** An assessment item's position must not appear in any practice item, `learn` card or other
   pool, including as a left-right mirror, a colour swap (ranks flipped and colours exchanged) or a shift of the same
   piece pattern, unless the learning point changes and a reviewer records why. The validator compares
   normalised forms (Needs architecture confirmation: normalisation and similarity rule).
5. **Decoys and quiet positions.** Pools include positions where the unit's motif *looks* available but fails, and
   positions with no tactic at all, so recognising "this unit's trick" is not enough.
6. **Distractors.** `choice` options are plausible, of similar length, each mapped to a misconception id; no "all /
   none of the above" except a genuine "nothing is hanging"-type option that is sometimes correct; order shuffled
   with a seed.
7. **Accept every valid answer.** Tactical items accept every engine-confirmed move; strategic items accept target
   and sound classes (02-curriculum.md §4.3). An item whose objective cannot be judged fairly is redesigned or
   removed, not kept with a single accepted move.
8. **Verdict + action pairing.** A `choice` verdict ("Red is better") is never the only item for an outcome that is
   about acting; it is paired with a `decision` or `line` item on the same or a parallel position.
9. **Metadata** (required): id, version, unit, lesson objective, strand, colour, `tactic` / `quiet`, `critical`,
   misconception ids, source, review status. **Draft or unreviewed items are never served** in checks, placement or
   exams.

### 4.3 Pools, forms and retakes

- Each unit has a check pool of at least **two forms' worth** of items (16 for an 8-item check) per strand mix,
  separate from practice and from placement pools.
- A form is assembled with a seed from the pool, honouring §4.1; items the learner has already answered in a check
  ("exposed") are avoided.
- **Retake** after a failed check: allowed once the learner has done the assigned remediation (§4.4). If an
  unexposed form cannot be built, at most half of the new form may be exposed items; if even that is impossible,
  the check is unavailable until new items exist and the learner is told why.
- Passing a check grants mastery once; later checks of the same unit are optional practice.

### 4.4 Remediation

- Each failed item maps to its lesson objective and to the misconception tag of the wrong answer.
- The remediation set = for each failed objective, the lesson's G1/G0 practice items not yet answered correctly
  first time, plus the `learn` card tied to the misconception. The learner sees which objectives failed (by lesson
  title, after the check, so no leak).
- Remediation is practice: it can be done with hints and gives no mastery. It unlocks the retake.

### 4.5 Long breaks

Mastery is not revoked by time (Proposal; avoids false loss after a break). After a long inactivity (default 30
days) the app offers a short warm-up made of unexposed check items from mastered units; results only drive
remediation suggestions. **Unresolved:** whether a failed warm-up should mark a unit "needs review" in the UI.

---

## 5. Practical play: tasks, training partners and rubrics

### 5.1 Task definition (Needs architecture confirmation: whole section)

A practical task (`play`, optionally preceded by a `line`, or a `review`) defines: start position (or start
position of the game), learner colour, training-partner profile (§5.2) and seed policy, move cap *N* (learner
moves), end conditions (mate, stalemate, repetition adjudication §8, cap), rubric(s) with weights (§5.3), objective
predicates where a rubric needs them, pass mark, and a short neutral prompt that states the goal without the
method ("Red to move. You are ahead; win the game within 20 moves." / "Black to move. Hold the position for 15
moves.").

Positions for practical tasks are authored and verified like any other content (S1.3): legal position, the goal
achievable by a reference line, the claims in the prompt verified for the exact position.

### 5.2 Training-partner profiles

The partner is a **constrained training opponent**, not a full-strength engine. Every profile states its intended
quality, and the task screen discloses: "Your opponent is a training partner with limited depth. It punishes loose
pieces and short tactics but does not plan." (text in `messages.ts`, en + vi).

| Profile | Intended quality | Behaviour (all use the in-repo engine; search runs off the UI thread) |
| --- | --- | --- |
| `script` | Follows an authored tree | Plays the authored replies (main or deviation by seed); outside the tree falls back to `spar` |
| `spar` | Basic sparring | Material search at depth 2 + quiescence; plays mate in one, avoids being mated in one, takes free material, does not hang material; picks randomly (seeded) among moves within 1 point of its best |
| `defend` | Best defence within a short horizon | Material search at `WIN_MATERIAL_DEPTH` (4) + short forced-mate search for both sides; best move, seeded tie-break. For tactics and endgame conversion/holding tasks |
| `counter` | Defence with counterplay | `defend`, but among moves within 0.5 of its best prefers checks, attacks on undefended pieces and moves that create a threat. For conversion, active-defence and switching tasks |

All profiles avoid moves that would lose under the repetition adjudication (§8), and avoid creating a third
repetition unless every alternative loses at least `WIN_MATERIAL_THRESHOLD` by their search.

**Disclosed limits:** material-only evaluation, short horizon; the partner has no positional understanding, may
play aimless quiet moves, and can miss deep combinations. Practical tasks are therefore designed so the rubric
measures the learner's process (safety, development, plan predicates, conversion) and not just the result against a
weak opponent.

### 5.3 Rubric templates

Signals are computed after the game (or between moves) by the in-repo search, off the UI thread (Needs
architecture confirmation: cost per learner move on a phone).

- **loss(m)** for a learner move *m*: the best move's score minus *m*'s score by the material search at depth 4
  (`moveScore`, Verified exists in `src/engine`). **Blunder**: loss ≥ 2 (`WIN_MATERIAL_THRESHOLD`). **Serious
  blunder**: loss ≥ 4 or *m* allows a forced mate within 2 moves.
- **missed mate**: a forced mate within *k* existed (`hasForcedWin`) and *m* does not keep one (*k* = 1 in Basic,
  2 from Intermediate).
- **threat at the end**: the opponent has a forced mate within 2, or a material gain ≥ 2, if it were to move.
- **development count**: back-rank Chariots, Horses and Cannons that have left their start points by learner move
  *n*; **idle General moves**: General/Advisor moves made while not in check and not answering a threat.
- **objective predicate**: authored per task (a piece reaches a target set of points, the enemy General's legal
  moves fall to ≤ *x*, a file is occupied, mobility of a named piece rises).

| Rubric | Used for | Criteria (points, sum 100) |
| --- | --- | --- |
| **R1 Safety** | Every `play` task from b08 on | 100 − 25 per blunder − 50 per serious blunder − 25 per missed mate (floor 0) |
| **R2 Development** | Opening tasks (b09-g1, i08/i09, m06) | Developed pieces by move *n* ≥ task target: 50 (pro rata); no idle General/Advisor moves in the first *n*: 25; no piece moved more than 3 times in the first *n* without capturing or answering a threat: 25 |
| **R3 Plan** | Improving and attack-building tasks (i01, a03, a06, e03, m02) | Objective predicate reached by the cap: 50; reached with no blunder: 30; total mobility of own non-General pieces at the end ≥ at the start: 20 |
| **R4 Conversion** | Winning from an advantage (i10, a09, e06, m05) | Mate or stalemate win within the cap: 60 (else: material lead at the end ≥ lead at the start: 30); opponent never had a forced mate within 2 during the task: 20; no blunder: 20 |
| **R5 Holding** | Defending (i07, a07, a09, e04, e07, m05) | Not mated within the cap (gate, see §5.5); final material deficit ≤ start deficit + 1: 40; no threat at the end: 30; blunders 0 → 30, 1 → 15, more → 0 |
| **R6 Opening line** | `line` → `play` opening tasks (i08, i09, e08) | Share of line nodes answered with target/sound moves × 60; R2 on the moves after the line × 0.4 |
| **R7 Self-review** | `review` tasks (b10l4, a10, e09, m08, exams) | Learner marks one of the top 3 turning points (largest loss ≥ 2): 40; their better move is target/sound (authored game) or improves *loss* by ≥ 2 (own game): 40; reason category matches what the engine can detect (missed threat / missed capture / missed mate / hung piece): 20. Positional reflection is free text or `choice`, recorded, **not scored** |

A task's score is the weighted sum of its rubrics (e.g. `i08-g1`: R6 50 % + R1 50 %). If a learner's own game
has no turning point with loss ≥ 2, R7 uses the level-exam game or an authored game instead.

### 5.4 What practical scoring cannot see

Material-only signals cannot recognise positional mistakes (a bad plan, a weakened palace without immediate
material loss). Those are taught and assessed through authored `decision` / `choice` / `line` items and the R2/R3
predicates, and are only self-reported in personal-game reviews. The app must not claim to have assessed them in
free play.

### 5.5 Pass rules

- **Pass:** task score ≥ **75** and no critical failure.
- **Critical failures** (fail regardless of score): being mated or stalemated (any task); in a holding task,
  losing by repetition adjudication; in a conversion task, the opponent reaching a forced mate in the final
  position; a serious blunder in a task flagged `safety-gate`.
- A failed task can be retried at once (new seed). Retrying is not penalised, but only a passing run grants
  "applied", and the record keeps the number of runs.

### 5.6 Guarding against false success and false failure (authoring validation; Needs architecture confirmation)

Each practical task ships with automated checks run in the content validator or a slower content script:

1. **Achievable:** a reference line (authored, or the `defend` profile playing the learner's side for tactical
   conversions) passes the task with every relevant seed.
2. **Not passable by chance:** a naive learner (seeded random *safe* moves: moves with loss < 2) fails the
   objective-carrying rubric (R3/R4/R6) in the large majority of seeded runs (threshold set in the pilot). A task a
   naive learner passes is redesigned.
3. **Real resistance:** where the task claims counterplay, the partner creates at least one threat in the reference
   run.
4. **Alternatives tolerated:** at least one alternative reasonable plan (authored by the reviewer) also passes; the
   rubric does not require an exact move list.

Reports of failed runs (local only, no network) help reviewers find false failures in later content versions.

---

## 6. Level exams (applied at level scope)

| Exam | Tasks (targets; lengths calibrated in the pilot) | Pass |
| --- | --- | --- |
| `xb` Basic | Two games from the start position, one per colour, vs `spar`, cap ~20 learner moves; rubrics R1 70 % + R2 30 %; then one R7 review of either game | Both games ≥ 75 with no critical failure; review ≥ 60 |
| `xi` Intermediate | Opening-to-middlegame task per colour (R6 + R1); one conversion from an elementary endgame (R4, `defend`) | All three ≥ 75 |
| `xa` Advanced | One improving/attack-building task (R3 + R1, `counter`); one positional-defence task (R5, `counter`); one endgame (R4 or R5, `defend`); R7 review of one of them | All ≥ 75; review ≥ 60 |
| `xe` Expert | Repertoire task per colour (R6 + R1); conversion with counterplay (R4, `counter`); holding (R5, `counter`); R7 review | All ≥ 75; review ≥ 70 |
| `xm` Master (m09) | At least five tasks across opening, middlegame, defence and endgame, both colours, unlabelled; R7 review of each | Every task ≥ 75 and every review ≥ 70; then the portfolio (§6.5) |

Exam tasks come from separate pools of positions not used in practice tasks.

### 6.5 Portfolio (m09)

A generated summary, not a certificate: units completed / mastered (and how) / applied, per-strand results of the
last checks and exams, the learner's reviewed games, recurring mistake categories (engine-detectable ones), and a
remediation path for any strand below 80 % of its unit checks. Reassessment = the same exam types with new seeds
and unexposed positions. Wording must not imply an official title, grade or rating (`01-audit-and-design.md`
"USER GOAL").

---

## 7. Jump-ahead (placement and test-out)

Replaces today's jump test (§1). Placement items come from **placement pools** (`p<level>-NN`), separate from
practice and unit-check pools.

### 7.1 Kinds

| Kind | Trigger (same UI entry points as today) | Scope |
| --- | --- | --- |
| **J1 Level placement** | Home "jump to <level>" banner | Every level below the target level |
| **J2 Unit test-out** | Tapping a locked lesson / "Jump here" on a locked unit | The units skipped within that level |

### 7.2 Form

- **J1:** 20 items × 4 points = 80, **plus** one practical task worth 20 (task score ÷ 5), drawn from the exam
  pool of the highest skipped level. Exactly **4 items per strand** for RS, TC, OD, PA, DE; PP is covered by the
  practical task. At least half of each strand's items come from the highest skipped level; RS items include at
  least **2 safety-critical** items. At least a third of the items are played as Black; at least a quarter are
  quiet.
- **J2:** *n* = 4 × skipped units, clamped to 10–20 items, equal weight totalling 100; if the skipped range includes
  a PP-primary unit (b10, i11, a10, e09), items total 80 and a practical task from that unit's pool adds 20.
  Strands follow the skipped units' tags.
- No hints, no retries, no lives: every item is answered once. Right/wrong is shown after each item; explanations
  come in the result screen (so the test is short and does not teach the next item).
- **Early stop:** the test ends as soon as passing is impossible (§7.3), with the result screen.

### 7.3 Pass rule (all must hold)

1. **Total ≥ 90/100.**
2. **Per-strand minimum:** each strand with ≥ 4 items scores ≥ 75 % of its points (at most one of four items
   missed); a strand with fewer than 4 items in the form must be fully correct.
3. **Safety-critical items:** all correct.
4. **Practical evidence** (when the form has a practical task): task score ≥ 75 with no critical failure, in one run
   (no retry inside the test).
5. **First attempt only**, no hints (none are offered).

**Boundary examples (J1; these become unit tests in step 2):**

| Items correct | Misses by strand | Practical | Total | Result |
| --- | --- | --- | --- | --- |
| 20 / 20 | — | 75 | 80 + 15 = 95 | Pass |
| 19 / 20 | 1 TC | 75 | 76 + 15 = 91 | Pass |
| 19 / 20 | 1 TC | 70 | 76 + 14 = 90 | **Fail** (practical below 75) |
| 18 / 20 | 1 TC, 1 PA | 100 | 72 + 20 = 92 | Pass |
| 18 / 20 | 1 TC, 1 PA | 90 | 72 + 18 = 90 | Pass (exactly 90) |
| 18 / 20 | 2 TC | 100 | 92 | **Fail** (TC 50 % < 75 %) |
| 18 / 20 | 1 PA, 1 RS critical | 100 | 92 | **Fail** (critical item) |
| 17 / 20 | 3 strands | 100 | 68 + 20 = 88 | **Fail** (total) |

### 7.4 Outcome

- **Pass:** skipped lessons become *completed (placement)* so the path unlocks; skipped units become *mastered
  (placement)*; the PP unit whose practical task was passed becomes *applied*; other units' practical tasks stay
  open ("applied: not yet"). **No XP** (as today) and no hearts used.
- **Fail:** nothing changes. The result screen shows the total, each strand's result and the explanations of
  missed items, and points to the first skipped unit carrying the weakest strand.
- **Retake:** a new form avoiding exposed items; at most one attempt per target per local day (Proposal; prevents
  form farming). **Unresolved:** whether the daily limit should be relaxed for J2 test-outs of a single unit.
- Learners who already mastered some skipped units are not re-tested on them: those units' items are excluded and
  the form shrinks within the clamps.

---

## 8. Ruleset and repetition adjudication

### 8.1 Reference ruleset (Proposal)

The course teaches the **Asian Xiangqi Federation (AXF) rules** as its reference: win by checkmate or by
stalemating the opponent (no legal move loses); the flying-General rule; perpetual check is forbidden (the checking
side must deviate or loses); perpetually chasing an unprotected piece is forbidden in the same way; repetitions in
which neither side breaks a rule are drawn; a draw may also be agreed. This summary is a design statement, **not**
a verified quotation: the content reviewer must check every rules sentence in b05l3 and e07l3 against the official
rulebook text before publication. **Unresolved:** which rulebook edition is cited, and whether the course notes
differences with the Chinese Xiangqi Association rules (relevant to Vietnamese and Chinese learners).

### 8.2 What the engine implements (Verified)

Legal moves, check, checkmate, stalemate-as-loss and the flying-General rule. **Not** implemented: repetition,
perpetual check, perpetual chase, move-count draws (`src/engine/status.ts:12`). The engine must not be changed
(project rule); adjudication is a separate module.

### 8.3 App adjudication for `play` tasks and exams (Proposal · Needs architecture confirmation)

- **A1 Position key** = board + side to move.
- **A2 Third occurrence** of a position ends the task. Over the cycle since its first occurrence:
  1. If every move of one side gave check and the other side's moves did not all give check → the checking side
     **loses** (perpetual check).
  2. Else, if both sides checked on every move → **draw**.
  3. Else, if every move of one side attacked the same undefended non-General piece and the other side's did not
     → that side **loses** (simplified perpetual-chase rule; flagged as simplified in the UI result).
  4. Else → **draw by repetition**.
- **A3 Move cap:** reaching the cap ends the task; there is no game result, only rubric scoring.
- **A4** No move-count draw rule (tasks are capped).
- **A5** Training partners never make a move that loses under A2 and avoid third repetitions (§5.2).
- **A6 Content rule:** no lesson, check or placement item depends on repetition adjudication, except `choice` items
  about the rules (b05l3, e07l3) and practical tasks explicitly flagged. In a holding task, a repetition draw counts
  as holding only under A2.2/A2.4; a draw the learner reaches by perpetual check or chase is a failure.

**Limitations to disclose:** the simplified chase rule ignores the official rules' detailed cases (protected
pieces, chases by several pieces, exemptions for some pieces, mixed check-and-chase cycles). Tasks are authored so
they do not depend on those cases; a reviewer flags any task where they could arise.

---

## 9. XP, streaks and hearts are not competence

1. Mastery and application logic must not read XP, streaks, hearts, daily goals or puzzle solves. Enforced by a
   test like the existing purity tests: the assessment/progress-state module may not import `src/gamification`.
2. XP rules stay as today (Verified `rules.ts:23–28`): completion-based effort rewards. This phase adds **no XP for
   checks, placement or exams** (Proposal), so passing an assessment is never "bought" or "farmed".
3. Unit checks, placement tests and exams cost no hearts and are available at 0 hearts (as the jump test is today).
4. The UI shows mastery and application with their own markers, separate from XP and streak, and never labels a
   learner by XP total.
5. Puzzle-bank solves stay optional practice and never count toward any state.

---

## 10. Tests required when this is implemented (input for S1.4 / step 2)

- Scoring per item type, including `dubious` partial credit only when flagged, and first-answer-only behaviour.
- Unit-check mastery boundaries: 7/8 with all critical correct → mastered; 7/8 with the critical one missed → not;
  6/8 → not.
- J1 boundary table of §7.3 as table-driven tests; J2 clamps and the "< 4 items must be perfect" rule; early stop.
- Form assembly: blueprint constraints (strand counts, colour share, quiet share, interleaving), exposure avoidance,
  seeded determinism.
- Rubrics R1–R7 on fixed recorded games (clock and randomness injected); critical failures.
- Repetition adjudication A2.1–A2.4 on constructed cycles; partner never loses by A2.
- Item-leak validator: practice/assessment overlap including mirrors and colour swaps.
- Separation: no import of `src/gamification` in the assessment module; XP unchanged by checks.
- Migration: old completion → completed only, never mastered (S1.3).

---

## 11. Limitations (honest statement)

- Automated scoring shows that a learner answered items and passed tasks under stated conditions. It does not
  prove real-world learning or playing strength; that needs studies with real learners (step 4).
- Thresholds (80 for checks, 75 for tasks, partner margins, *play* lengths) are uncalibrated defaults.
- The training partners are weak by design and material-only; passing a task against them is evidence of a skill
  only to the extent §5.6's checks hold.
- Positional judgement is assessed only through authored, reviewed items; free-play scoring cannot see it.
- Repetition adjudication is simplified (§8.3).

---

## 12. Proposed decisions (for the driver to record in DECISIONS.md)

1. Three separate states (completed / mastered / applied) with provenance; old completion → completed only.
2. Unit-check mastery at ≥ 80/100 first attempt plus all safety-critical items; jump-ahead at ≥ 90/100 with
   per-strand ≥ 75 % (strands < 4 items perfect), all safety-critical items, and practical evidence when a PP unit
   or a level is skipped.
3. Separate item pools: practice, unit check, placement, exam; draft items never served.
4. AXF rules as the taught reference (wording verified by the content reviewer); app-side repetition adjudication
   A1–A6, outside the engine.
5. Constrained training partners `script`, `spar`, `defend`, `counter` with disclosed limits.
6. No XP for assessments; assessments cost no hearts; assessment module may not import gamification.
7. Unit ids `b01…m09`, lesson ids `<unit>l<k>`, explicit exercise ids and versions (02-curriculum.md §3.3).

## 13. Unresolved

| # | Question | Needed from |
| --- | --- | --- |
| UA1 | Mark "needs review" after a failed warm-up following a long break (§4.5)? | LX reviewer, pilot |
| UA2 | Daily retake limit for single-unit J2 test-outs (§7.4) | LX reviewer |
| UA3 | Rulebook edition to cite; mention CXA differences (§8.1) | Content reviewer |
| UA4 | Storage/sync format of attempt log and states (§3.1) | S1.1, S1.3 |
| UA5 | Phone cost of the post-game signals and partner search (§5.2–5.3) | S1.1, pilot |
| UA6 | Naive-learner failure rate required by §5.6 | Pilot |
