# Curriculum specification

Backlog item S1.2 · Owner: curriculum designer · Companion: [03-assessment.md](./03-assessment.md) (how
everything here is assessed). The audit ([01-audit.md](./01-audit.md)) and the architecture review
([04-architecture.md](./04-architecture.md)) are written in parallel; S1.4 reconciles the three.

## 0. How to read this document

Every statement carries one of these labels, either on its own line or on the section heading it belongs to:

- **Verified**: checked against the repository at the time of writing (file reference given) or with the engine
  (command given). Re-check before relying on it if the code has changed.
- **Proposal**: a design choice made here. Later steps implement it unless the S1 gate, a reviewer or the pilot
  changes it.
- **Unresolved**: a decision that needs more information, another role, or the pilot. Listed again in §9.
- **Needs architecture confirmation**: a proposal that depends on a capability that the architecture review
  (S1.1 / S1.4) must confirm is feasible in a static PWA with the in-repo engine on a phone.

This document contains **no chess positions**. It describes what each position must show; positions are
authored and verified later under the sourcing and verification policy (S1.3, `design/07-sourcing.md`). It
claims **no ratings, no playing strength and no learning times**. "Master" is the name of the last course
stage, not a title or a rating.

---

## 1. Starting point (Verified)

The facts below were checked on this branch (HEAD at the time of writing) with a short Node script over
`src/content/lessons/*.json`. S1.1 (`design/01-audit.md`) owns the full audit; only what this spec builds on is
repeated here.

| Fact | Evidence |
| --- | --- |
| 13 units, 36 lessons, 49 learn cards, 146 practice exercises (non-`learn`) | `src/content/lessons/*.json` |
| Practice by track: basics 26, intermediate 58, advanced 27, expert 21, master 14 | same |
| Intermediate–Master practice is almost all mating (`move` checkmate, `combination` checkmate), plus `move` defend (depth 1–3) and five `win-material` combinations (all in `u9l1`) | same |
| Practice exercises are played as Red; only `learn` cards may show Black to move | `src/content/types.ts:5`, `:10` |
| Exercise types: `learn`, `select-squares`, `move` (goals `reach`, `any`, `check`, `checkmate`, `defend`), `capture`, `combination` | `src/content/types.ts` |
| Lessons unlock in order within a track; the first lesson of every track is open | `src/lessons/progress.ts:11` |
| Jump-ahead test = last two non-`learn` exercises of each skipped lesson, at most 8 (`JUMP_TEST_MAX`), 3 lives (`JUMP_TEST_LIVES`); passing marks the skipped lessons complete | `src/lessons/progress.ts:39`, `:41`, `:55–56` |
| Lesson completion does not depend on first-try accuracy: a wrong answer is retried; first-try count is only shown on the completion screen | `src/components/LessonPlayer.tsx:71`, `:152` |
| Progress is one set of completed lesson ids under `progress.completedLessons.v1` | `src/storage/index.ts:61` |
| Engine evaluation is material only (chariot 9, cannon 4.5, horse 4, advisor 2, elephant 2, soldier 1; a crossed soldier counts the same as an uncrossed one) | `src/engine/solver.ts:9–17` |
| Repetition, perpetual check and perpetual chase are not handled by the engine | `src/engine/status.ts:12`, CLAUDE.md "Engine conventions" |
| The opening sequences named in units `b09`, `i08`, `i09`, `e08` are legal from `START_FEN`: `h2e2 h9g7 h0g2 b9c7 i0h0 i9h9`; `h2e2 h7e7`; `h2e2 b7e7`; `g3g4`; `h0g2`; `c0e2` | checked with `parseFen` / `isLegalMove` / `makeMove` from `src/engine` (read-only script, not committed). Legality only: the *names* and *plans* attached to them are for the content reviewer to confirm |

The historical finding in `01-audit-and-design.md` (13 units, 36 lessons, 146 practice exercises; 120 of them
Intermediate–Master; learner always Red; jump-ahead samples practice exercises) is consistent with these counts.
S1.1 confirms the per-goal breakdown.

---

## 2. Design rules applied (Proposal)

1. **Why, when, when not.** Every lesson has at least one `learn` card or worked example that explains *why* the
   idea works, and at least one **contrast** item where the same-looking idea fails (the tempting move loses,
   the sacrifice is unsound, the exchange helps the opponent).
2. **Both colours, both sides of the idea.** From `b02` on, every unit has practice as Black. Each level has at
   least one third of its practice and assessment items played as Black (target, checked per level by the content
   validator once colour is a field). Attack units include a defending lesson or contrast items and vice versa.
3. **Quiet positions are normal.** Units tagged PA, OD or DE include items whose best answer is a quiet move
   (improve, defend, consolidate, develop, wait) and items where "there is no tactic" is the right conclusion.
   At least a quarter of their independent and assessment items have no immediate tactical win.
4. **Plans before move orders.** `b09` teaches principles with no named opening; `i08` / `i09` teach one opening
   *plan* per colour with short lines (each move explained by its purpose) and the common deviations; full
   repertoire work waits until `e08`; `m06` teaches handling moves no line covers.
5. **Difficulty through decisions, not only depth.** From level to level the main difficulty levers are:
   fewer hints, unfamiliar positions, opponent branching, counterplay, evaluation and sustained play (§5).
   Longer forced mates are kept as calculation practice, not as the measure of level.
6. **Completion ≠ mastery ≠ application.** Lessons can be completed with hints and retries. Mastery comes only
   from independent unit checks; application only from practical-play tasks (03-assessment.md §2). XP, hearts and
   streaks never feed either.
7. **Small reusable exercise set.** Ten exercise types (§4): the five that exist plus five new ones. A new
   unit should not need a new type.
8. **Accept reasonable alternatives.** Answers are judged by the objective (engine-verified where the claim is
   tactical, authored classification + engine safety guard where it is strategic), never by equality with one
   stored move (§4.3).
9. **Position-specific feedback.** Every answer, right or wrong, explains this position: the purpose of the move,
   the opponent's key reply, the common error and why the tempting alternative fails (§6).
10. **Bilingual.** All text in `src/i18n/messages.ts`, English and Vietnamese, with a shared glossary of piece,
    pattern and opening names (Unresolved: glossary owner; see §9).

---

## 3. Structure

### 3.1 Competency strands (Proposal)

| Code | Strand | Covers |
| --- | --- | --- |
| **RS** | Rules and board safety | Moves, check, results, ruleset; seeing attacked/defended pieces; the pre-move safety routine |
| **TC** | Tactical recognition and calculation | Motifs, forcing lines, candidate moves, branching calculation, intermediate moves, sacrifices |
| **OD** | Openings and piece development | Development principles, opening plans per colour, deviations, repertoire, unfamiliar openings |
| **PA** | Positional assessment, planning and attack | Activity, assessment, plans, files/ranks, soldier structure, preparing attacks, initiative, conversion choices |
| **DE** | Defence and endgames | Tactical and positional defence, counterplay, holding worse positions, elementary to complex endgames |
| **PP** | Practical play and self-analysis | Sustained play from set positions, complete games, self-review, risk decisions, portfolios |

Each unit has one or two **primary** strands (in bold in the unit headers) and optional secondary strands.
Assessment items carry exactly one strand tag (the one they score toward).

### 3.2 Levels (Proposal; level names = existing `Track` values, Verified in `src/content/types.ts`)

| Level (track) | Prefix | Units | Exit outcome (observable) |
| --- | --- | --- | --- |
| Basic (`basics`) | `b` | b01–b10 | Plays a complete game from the start position, as either colour, against the basic training partner without frequently leaving material capturable for free; develops pieces by principle |
| Intermediate (`intermediate`) | `i` | i01–i11 | Finds and defends against the standard motifs and mating patterns; plays one opening plan as Red and one as Black into a middlegame; wins elementary endgames from set positions |
| Advanced (`advanced`) | `a` | a01–a10 | Assesses a position in words (choice items) and acts on it; prefers improving moves when no tactic exists; prepares attacks; defends positionally; handles transitions and practical endgames |
| Expert (`expert`) | `e` | e01–e09 | Calculates branching lines with intermediate moves; judges sacrifices; keeps and converts advantages; defends worse positions; holds a repertoire for both colours; reviews own games |
| Master (`master`) | `m` | m01–m09 | Decides in unfamiliar, unlabelled positions; compares plans; switches between attack and defence; passes a multi-game practical assessment and a portfolio review |

49 units. Lessons per unit vary (2–5): units are sized by content, not to a quota.

### 3.3 Identifiers (Proposal)

| Thing | Format | Example | Notes |
| --- | --- | --- | --- |
| Unit | level prefix + 2 digits | `b05`, `i11`, `m09` | Prefixes `b i a e m` + digits do not collide with existing ids (`u1`–`u4`, `u7`–`u15`, lessons `u<n>l<k>`, puzzles `m1-NN`, `m2-NN`, `wm-NN`, `jump-<lessonId>`). Verified: no i18n key in `src/i18n/messages.ts` starts with `[biaem][0-9][0-9]` |
| Lesson | unit + `l` + digit | `b05l2` | Same pattern as today (`u2l1`), so i18n keys stay `<lessonId>.<suffix>` |
| Practice exercise | lesson + `-` + 2 digits | `b05l2-04` | New explicit `id` field; today exercises have no id (Verified: `types.ts`) |
| Unit-check item | unit + `-c` + 2 digits | `b05-c07` | Separate pool from practice (03-assessment.md §4) |
| Placement (jump) item | `p` + level prefix + `-` + 2 digits | `pi-14` | Placement pools per target level |
| Practical task | unit + `-g` + digit | `b10-g1` | `play` / `review` tasks used for "applied" evidence |
| Level practical exam | `x` + level prefix | `xb`, `xi` | 03-assessment.md §6 |

Ids are never reused for different content. Each content item also carries a `version` integer; a substantive
change to an item (position, accepted moves, objective) increments it, and evidence recorded against an older
version is kept but marked as such (03-assessment.md §3.3).

**Old ids (feasibility only; S1.3 owns the map).** Old lesson ids stay valid keys in storage. A later migration
maps each old completed lesson id to "completed" on the new lesson(s) listed in the "Reuses" line of each unit
below, never to "mastered" or "applied". Every existing lesson has at least one candidate home (§8), so the map is
feasible without dropping progress.

---

## 4. Exercise types

Each type is described once here; units only reference it.

### 4.1 Catalogue

| Type | Status | Behaviour | Answer judged by |
| --- | --- | --- | --- |
| `learn` | **Verified** existing | Board + explanation card; optional piece moves or highlighted squares | Not scored |
| `select-squares` | **Verified** existing; **Proposal** to extend | Tap every square that matches. Today: a piece's legal moves or a board region. Extension: *attacked by side X*, *pieces of side X that are attacked*, *pieces that are attacked and not defended* ("hanging"), *pieces that can capture square Y* — all computed from the rules engine in `src/lessons`, not stored | Exact set (computed) |
| `move` | **Verified** existing; **Proposal** to extend | Make one move toward a goal. Existing goals `reach`, `any`, `check`, `checkmate`, `defend` (depth 1–3). New goal `safe`: the move must not lose material by the shallow material search (threshold = `WIN_MATERIAL_THRESHOLD`, Verified `src/puzzles/logic.ts:19`) | Engine |
| `capture` | **Verified** existing | Find the best capture by immediate exchange count | Engine |
| `combination` | **Verified** existing | 2–4 own moves against the engine's best defence, goal mate or material | Engine (forced) |
| `choice` | **Proposal** | A question about a position, 3–4 options. Options are text ("Red is better because…"), board marks (two arrows to compare) or a tapped piece/square ("Which piece is worst placed?" is a `select-squares` variant with a single authored answer). Option order is shuffled with a seeded generator. Each option has its own feedback | Authored key, reviewed |
| `decision` | **Proposal** · **Needs architecture confirmation** (predicates, search cost) | One move in a position where several moves are reasonable. Every move falls into a class: **target** (the lesson's idea), **sound** (good, but not the lesson's idea), **dubious** (safe but misses the objective), **error** (engine-refuted: loses ≥ threshold material or allows a forced mate within the checked depth). Classes come from (a) an authored list of moves, (b) optional **objective predicates** checked by code (e.g. "a chariot reaches an open file", "the worst piece's legal-move count rises", "a back-rank piece develops", "the threatened piece is no longer hanging"), and (c) the engine **safety guard** for any unlisted move | §4.3 |
| `line` | **Proposal** · **Needs architecture confirmation** (tree format) | A move tree played from one side. At the learner's node: accepted moves (authored + predicate) each with an explanation; unknown safe moves get "playable, but here is the plan" feedback and the line continues from the closest authored node or ends. At the opponent's node: the main move or an authored **deviation**, chosen by seeded randomness in practice and set by the item in assessments, so every deviation is met. Leaves end with a summary or hand off to `play` | Authored tree + safety guard |
| `play` | **Proposal** · **Needs architecture confirmation** (opponent search in a Web Worker, time per move on a phone, adjudication) | Sustained play from a set position (or the start position) for up to *N* learner moves against a **training partner** profile (03-assessment.md §5.2). Ends on mate, stalemate, repetition adjudication or the move cap; scored by a rubric (03-assessment.md §5) | Rubric (outcome + checkable process items) |
| `review` | **Proposal** · **Needs architecture confirmation** (post-game analysis cost) | Look back at a finished game (own `play` game, own level exam, or an annotated game). Steps: find the turning point among the learner's moves, play a better move there (judged like `decision`), choose the reason (`choice`). Only material/mate swings the engine can show are scored; positional reflection is recorded but unscored (03-assessment.md §5.4) | Engine swing + authored key |

`choice` is the only way to assess *assessment in words* (who is better and why). It must never be the only
evidence for a unit whose outcome is a move or a plan: those units pair it with `decision`, `line` or `play`.

### 4.2 Assistance levels and the scaffolding ladder (Proposal)

| Level | Name | What the learner gets |
| --- | --- | --- |
| G3 | Demonstrate | `learn` card or an animated worked example; nothing to answer, or a trivial confirmation |
| G2 | Guided | Prompt names the idea ("Use the Horse fork"); the key piece or region is highlighted; hints available |
| G1 | Prompted | Prompt names the idea; no highlight; hint ladder on request (1 idea → 2 piece → 3 move, Proposal); every hint is recorded |
| G0 | Independent | Neutral prompt ("Black to move."), unfamiliar position, no highlight. Practice may still offer hints (recorded); unit checks never do |
| TR | Transfer | The skill is needed but not announced, in a new context: the other colour, a fuller board, inside a `line` or `play` task, or mixed with earlier units |

**Default lesson shape** (Proposal): 1–2 `learn` cards (why + when it fails) → 2–3 G2 items → 2–3 G1 items →
1–2 G0 items → optional TR item; a lesson has 6–10 non-`learn` items at most, so it fits a phone session. Units
deviate only where stated.

**Default unit shape** (Proposal): lessons in order → unit check (independent items from a separate pool,
03-assessment.md §4) → optional practical task (`-g` id) where the unit lists one.

### 4.3 Accepting reasonable alternatives (Proposal)

- **Tactical claims** (`move`, `capture`, `combination`): any move the engine confirms reaches the goal is
  correct (already the case; Verified in `src/lessons/combination.ts` `isWinningMove`).
- **Strategic items** (`decision`, `line`): credit = class **target** or **sound**. The author lists the target
  and sound moves they know of; predicates widen "target" to every move that achieves the objective; the safety
  guard turns every unlisted move that loses material or allows mate into **error** with the refutation shown on
  the board. Unlisted moves that pass the guard and match no predicate are **dubious** with neutral feedback
  ("This does not lose anything, but it does not …"), and are logged locally so reviewers can reclassify them in
  the next content version. Whether "dubious" gets partial credit is set per item in 03-assessment.md §3.2.
- **Authoring check** (Needs architecture confirmation): a dev-time script lists every legal move of a `decision`
  position that passes the safety guard, so the author must explicitly classify or consciously leave each one to
  the default. The content validator fails if a listed target/sound move fails the guard.
- **Engine score is evidence, not proof of the objective.** A move with the best material score is not
  automatically "target"; a move that is a little worse by material search is not automatically wrong. The class
  is a reviewed pedagogical judgement bounded by the engine guard.

---

## 5. Difficulty progression (Proposal)

| Lever | Basic | Intermediate | Advanced | Expert | Master |
| --- | --- | --- | --- | --- | --- |
| Hints | G2–G1 in most practice | G1 dominant, G0 at lesson end | G0 dominant | G0; hints only in `learn`-adjacent items | None outside `learn` |
| Unfamiliarity | Few pieces, then full-board positions for safety | Pattern positions, then the same pattern in fuller positions | Full positions from realistic play, both colours | Positions not resembling any practice item | Mixed, unlabelled, both colours |
| Branching | Single reply | Opponent picks among 1–2 authored replies | `line` deviations; `combination` best defence | Calculation with several defending branches; intermediate moves | Plan comparison where both plans are playable |
| Counterplay | Opponent threats to notice (safety routine) | Opponent counter-threats in defence units | Opponent plays for counterplay in `play` | Counterpuncher partner (03 §5.2) | Attack/defence switches inside one task |
| Evaluation | Material counting | Development and activity | Multi-factor assessment in words + action | Static vs dynamic, compensation | Diagnose without labels, compare plans |
| Sustained decisions (`play` length, learner moves; to calibrate in the pilot) | 6–20 | 10–20 | 12–25 | 15–30 | Multi-game assessment |

The `play` lengths are design targets for task authors, not promises; the architecture review must confirm the
training partner can answer within an acceptable time on a phone for those lengths (Needs architecture
confirmation).

---

## 6. Feedback requirements (all units, Proposal)

1. **Correct answer:** name what the move achieves *in this position* and the opponent's most important reply.
   No generic "Well done!" alone (the generic line may accompany specific text).
2. **Wrong answer, engine-refutable:** show the refutation on the board (opponent's reply, then the material or
   mate it leads to), then one sentence on the common error it reflects.
3. **Wrong answer, strategic (`dubious`):** say what the move does and what it neglects; point to the target idea
   without giving the move at G0.
4. **Tempting alternative:** every G1/G0 `decision` and `line` item names the most tempting wrong move and why it
   fails (authored, reviewed).
5. **Misconception tags:** each unit's misconceptions (below) get an id (`<unit>.m<k>`, e.g. `b06.m2`). Wrong
   answers that match one are tagged, so remediation can target it (03-assessment.md §4.4).
6. **Independent and assessment items** give feedback only after the answer; the prompt never names the motif
   (03-assessment.md §4.2).
7. **Both languages** carry the same content; Vietnamese is not a shortened translation.

---

## 7. Units

Format per unit: header table → observable outcomes → lessons (id, title, objective) → practice ladder
(guided / independent / transfer, with exercise types) → misconceptions and feedback → assessment and
remediation. "Unit check" means the default unit check of 03-assessment.md §4 unless stated otherwise. "Reuses"
names existing lessons whose verified positions may be reused or adapted (S1.3 decides; reuse never imports
completion as mastery). Everything in §7 is **Proposal** unless labelled.

### Basic level

#### b01 — Board, setup, turns and the goal
| Level · prerequisites | Basic · none | Strands | **RS** |
| --- | --- | --- | --- |
| Baseline topics | 1 | Colour · perspective | Both (setup for both sides) |
| Reuses | `u1l1` | Practical task | — |

**Outcomes.** The learner can: name any point by file and rank; locate the river and both palaces; place every
piece on its start point for either colour; say who moves first; state how a game is won under the chosen
ruleset (checkmate or stalemate of the opposing General; the General is never captured).

| Lesson | Title | Objective |
| --- | --- | --- |
| b01l1 | Points, files and ranks | Name and find points; river and palaces |
| b01l2 | Setting up both armies | Identify every start point, Red and Black; Red moves first, turns alternate |
| b01l3 | How a game ends | Checkmate and stalemate win; the General is not captured; draws exist (detail in b05l3) |

**Practice.** Guided: `select-squares` (region) with highlights; `choice` on start points. Independent: tap
named points without highlights; `choice` "who moves now?". Transfer: the same tasks on the board seen from
Black's side (orientation, Needs architecture confirmation).
**Misconceptions → feedback.** b01.m1 pieces stand inside squares → show the intersection points. b01.m2 the river
blocks every piece → preview: only Elephants (and Soldiers' moves change) are affected. b01.m3 the goal is to
capture the General → explain checkmate. b01.m4 stalemate is a draw (from Western chess) → state the ruleset.
**Assessment and remediation.** Unit check, short form (6 items, `choice` + `select-squares`). Remediation: replay
the lesson of each failed item's objective.

#### b02 — General, Advisors, Elephants and facing Generals
| Level · prerequisites | Basic · b01 | Strands | **RS**, DE |
| --- | --- | --- | --- |
| Baseline topics | 2 | Colour · perspective | Both · using and defending against the facing-Generals rule |
| Reuses | `u1l2`, `u1l3` | Practical task | — |

**Outcomes.** The learner can list the legal moves of the General, Advisors and Elephants in a given position;
explain why a move that leaves the two Generals facing on an open file is illegal; use the facing rule to take
points away from the enemy General; explain the Elephant eye block and the river limit.

| Lesson | Title | Objective |
| --- | --- | --- |
| b02l1 | The General in its palace | Legal General moves; the palace limit |
| b02l2 | Facing Generals | Recognise illegal facing; use an own General to restrict the enemy General |
| b02l3 | Advisors and Elephants | Legal moves; blocked Elephant eye; river limit; their defensive role |

**Practice.** Guided `select-squares` (legal moves) with highlights → independent `select-squares` without →
`move` (`reach`) to restrict the enemy General → `choice` "is this move legal, and why?". Transfer: as Black in a
fuller position. **Misconceptions.** b02.m1 the General moves diagonally; b02.m2 Elephants cross the river; b02.m3
an Elephant jumps a blocked eye; b02.m4 facing only matters for the side that moves. Feedback shows the rule on
this board (the blocking point, the palace edge). **Assessment.** Unit check (≥ 2 items as Black). Remediation
by lesson.

#### b03 — Chariot and Horse
| Level · prerequisites | Basic · b02 | Strands | **RS**, TC |
| --- | --- | --- | --- |
| Baseline topics | 3 | Colour · perspective | Both |
| Reuses | `u2l1`, `u2l2` | Practical task | — |

**Outcomes.** The learner can list Chariot and Horse moves and captures, including blocked Horse legs
("hobbled" Horse); identify which enemy pieces a given Chariot or Horse attacks.

| Lesson | Title | Objective |
| --- | --- | --- |
| b03l1 | The Chariot | Moves and captures along files and ranks; blocked lines |
| b03l2 | The Horse and its leg | Moves; the blocked leg; why a Horse on the edge is weak |
| b03l3 | What can they take? | Tap every enemy piece a Chariot or Horse attacks, both colours |

**Practice.** `select-squares` (legal moves → attacked pieces, extension), `capture`. Transfer: crowded
full-board position as Black. **Misconceptions.** b03.m1 the Horse jumps like a chess knight; b03.m2 the leg block
is on the landing point; b03.m3 the Chariot jumps over a piece. **Assessment.** Unit check. Remediation by lesson.

#### b04 — Cannon and Soldier
| Level · prerequisites | Basic · b03 | Strands | **RS**, TC |
| --- | --- | --- | --- |
| Baseline topics | 4 | Colour · perspective | Both |
| Reuses | `u3l1`, `u3l2` | Practical task | — |

**Outcomes.** The learner can list Cannon moves and captures (exactly one screen to capture, none to move);
list Soldier moves before and after crossing the river; read every piece's moves on a full board.

| Lesson | Title | Objective |
| --- | --- | --- |
| b04l1 | The Cannon and its screen | Moving vs capturing; any piece of either colour is a screen |
| b04l2 | The Soldier before and after the river | Forward only; sideways after crossing; no promotion; no retreat |
| b04l3 | Every piece on a full board | Mixed piece reading, both colours |

**Practice.** `select-squares`, `capture`. **Misconceptions.** b04.m1 the Cannon captures with no screen or with two;
b04.m2 the Cannon may jump to an empty point; b04.m3 Soldiers move sideways before the river or retreat; b04.m4
Soldiers promote (from Western chess). **Assessment.** Unit check. Remediation by lesson.

#### b05 — Check, escaping check, checkmate, stalemate and results
| Level · prerequisites | Basic · b04 | Strands | **RS**, DE |
| --- | --- | --- | --- |
| Baseline topics | 5 | Colour · perspective | Both · giving and escaping check |
| Reuses | `u4l1`, `u4l2`; checkmate items of `u3l1`, `u3l2` | Practical task | — |

**Outcomes.** The learner can tell check, checkmate and stalemate apart in a given position; escape check by every
available method (move the General, capture the checker, block — including blocking a Horse leg — and, against a
Cannon, adding a second screen or moving away or capturing the screen; the engine decides which are legal in each
position); deliver mate in one; state the results and the ruleset
summary used by the app (03-assessment.md §8), including what the app does not adjudicate.

| Lesson | Title | Objective |
| --- | --- | --- |
| b05l1 | Check and every way out | All escape methods, including the Horse-leg block and Cannon screens |
| b05l2 | Checkmate | Recognise mate; deliver mate in one with each piece type, both colours |
| b05l3 | Stalemate and other results | Stalemate loses for the stalemated side; draws; perpetual check is forbidden (ruleset summary) |

**Practice.** `move` (`any` to escape check, `checkmate`), `choice` ("check, mate, stalemate or none?"; "which
escapes are legal?"). Contrast: positions that look like mate but have an escape. Transfer: escaping check as Black
where only one escape keeps material (preview of b06–b08). **Misconceptions.** b05.m1 a Horse check cannot be blocked;
b05.m2 you may ignore check to capture something big; b05.m3 stalemate is a draw; b05.m4 every check is good.
**Assessment.** Unit check; includes "not mate" positions. Remediation by lesson.

#### b06 — Threatened, undefended and defended pieces
| Level · prerequisites | Basic · b05 | Strands | **RS**, TC, DE |
| --- | --- | --- | --- |
| Baseline topics | 6 | Colour · perspective | Both · spotting own and enemy weaknesses |
| Reuses | `capture` items of `u2l1`, `u2l2` (as contrast) | Practical task | — |

**Outcomes.** The learner can mark every attacked piece of a side; tell hanging (attacked and undefended) pieces
from defended ones, counting attackers and defenders; save a threatened piece by moving it, defending it, blocking
the attack or making a bigger threat; say "nothing is hanging" when that is true.

| Lesson | Title | Objective |
| --- | --- | --- |
| b06l1 | What is attacked? | Tap all attacked pieces of one side (incl. Cannon attacks through a screen) |
| b06l2 | Defended or hanging? | Count attackers and defenders; a cheap attacker can still win a defended piece |
| b06l3 | Saving a threatened piece | Four ways to answer a threat; choose one that keeps everything safe |

**Practice.** `select-squares` (attacked / hanging, extension), `choice` with a "none" option, `move` (`safe`).
Quiet positions are common here (often nothing hangs). Transfer: full-board, as Black, after an opponent move.
**Misconceptions.** b06.m1 a defended piece is always safe (ignores a lower-value attacker); b06.m2 a Cannon "behind"
a piece does not attack; b06.m3 a hobbled Horse still defends; b06.m4 a piece pinned to its General still defends.
**Assessment.** Unit check. Remediation by lesson and misconception tag.

#### b07 — Exchanges and relative material value
| Level · prerequisites | Basic · b06 | Strands | **TC**, RS, PA |
| --- | --- | --- | --- |
| Baseline topics | 7 | Colour · perspective | Both |
| Reuses | `u2l1`, `u2l2`, `u3l1` `capture` items; win-material puzzles as optional practice | Practical task | — |

**Outcomes.** The learner can use the conventional beginner values (the engine's values, Verified
`solver.ts:9–17`) to count an exchange sequence; refuse a capture that loses material to the recapture; explain,
with examples, why values change with the position (a crossed Soldier, a Cannon short of screens, a trapped
piece) — the general claim is a conventional teaching heuristic that the content reviewer confirms in wording;
choose when trading helps (ahead in material, removing a strong attacker) and when it does not.

| Lesson | Title | Objective |
| --- | --- | --- |
| b07l1 | What pieces are worth | Values as a guide, not a law; when they change |
| b07l2 | Counting an exchange | Count captures and recaptures; refuse losing captures |
| b07l3 | Should I trade? | Trading when ahead or to remove an attacker; keeping an active piece |

**Practice.** `capture`, `decision` (best move is *not* a capture), `choice` ("trade or not, and why"). Transfer:
both colours in a full position. **Misconceptions.** b07.m1 every capture is good; b07.m2 equal trades never matter;
b07.m3 values are fixed (including the engine's equal value for crossed and uncrossed Soldiers, a disclosed
engine limitation). **Assessment.** Unit check. Remediation by lesson.

#### b08 — The pre-move safety routine
| Level · prerequisites | Basic · b07 | Strands | **RS**, **DE**, PP |
| --- | --- | --- | --- |
| Baseline topics | 8 | Colour · perspective | Both · own blunders and the opponent's threats |
| Reuses | — (new) | Practical task | `b08-g1` (`play`, short) |

**Routine taught (Proposal; wording reviewed by the content reviewer):** before every move ask (1) *What does the
opponent's last move threaten?* (checks, captures, attacks); (2) *What are my checks, captures and threats?*;
(3) *After my move, can the opponent check, capture something undefended or win material?*

**Outcomes.** After an opponent move, the learner names what it threatens (or "nothing"); rejects an intended move
that leaves material capturable or allows mate in one; finds a safe useful move in a position with no tactic; keeps
playing safely for several moves.

| Lesson | Title | Objective |
| --- | --- | --- |
| b08l1 | What did that move threaten? | Read the opponent's last move (shown animated) |
| b08l2 | Blunder check | Judge an intended move as safe or unsafe, and why |
| b08l3 | Safe and useful in a quiet position | Choose a move that is safe *and* improves something |

**Practice.** `select-squares` (threatened pieces after a shown move), `choice` (safe / unsafe + reason),
`decision` (`safe` guard + predicate "improves a piece"). Mostly positions with no immediate tactic. Transfer:
`b08-g1`, a short `play` task from a simplified position against the basic partner, rubric R1 Safety
(03-assessment.md §5.3). **Misconceptions.** b08.m1 only my own plan matters; b08.m2 the opponent's move was
random; b08.m3 checking captures but not checks; b08.m4 "safe" means "do nothing". **Assessment.** Unit check with
safety-critical items (03-assessment.md §4.1); `b08-g1` for "applied". Remediation: misconception-tagged items,
then b08l2.

#### b09 — Opening development principles
| Level · prerequisites | Basic · b08 | Strands | **OD**, PA, RS |
| --- | --- | --- | --- |
| Baseline topics | 9 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `b09-g1` (`play` from the start position, first moves only) |

**Principles taught (Proposal; content reviewer confirms the wording and the examples):** bring the Chariots
into play early; develop Horses toward the centre and keep their legs free; know what a central Cannon threatens
and protect the central Soldier; do not move the General or Advisors without a reason; move each piece with a
purpose and avoid moving one piece many times; do not grab material at the cost of falling behind in development
and safety.

**Outcomes.** The learner can compare two positions and say which side is better developed and why; choose a
developing move that is also safe; meet the central Cannon's threat to the central Soldier as Black; play the
first moves of a game by principle as either colour without a memorised line.

| Lesson | Title | Objective |
| --- | --- | --- |
| b09l1 | Why develop? | Undeveloped pieces do not fight; compare development |
| b09l2 | Get the Chariots out | Choose moves that activate or prepare a Chariot |
| b09l3 | Meeting the central Cannon | As Black, protect the central Soldier with a developing move |
| b09l4 | First moves by principle, both colours | Short `line`s from the start position with deviations |

**Practice.** `choice` (compare development), `decision` (predicate "develops a back-rank piece" + safety guard),
`line` (short, both colours, deviations). No named openings yet. Contrast: a material grab that costs development or
safety. Transfer: `b09-g1` (`play` from the start position for the first moves, rubric R2 Development).
**Misconceptions.** b09.m1 openings are memorised sequences; b09.m2 move the same piece repeatedly to attack early;
b09.m3 the General should "step out" early; b09.m4 grabbing a Soldier is always good. **Assessment.** Unit check
(≥ 1/4 no-tactic items); `b09-g1` for "applied".

#### b10 — First complete guided games
| Level · prerequisites | Basic · b09 | Strands | **PP**, RS, OD, DE |
| --- | --- | --- | --- |
| Baseline topics | 10 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `b10-g1`, `b10-g2`; level exam `xb` |

**Outcomes.** The learner can play a complete game from the start position against the basic training partner as
either colour, applying the safety routine; convert a large material lead into mate in a simplified position;
find in a finished game the move where they lost material and suggest a better one.

| Lesson | Title | Objective |
| --- | --- | --- |
| b10l1 | A guided game as Red | Coach prompts (safety routine questions) on every move, then fading |
| b10l2 | A guided game as Black | Same, as Black |
| b10l3 | Finishing a won game | Convert a large material lead into mate (simplified start position) |
| b10l4 | Looking back | First `review`: find the material-losing move, play a better one |

**Practice.** `play` with coaching (G2 prompts that fade to none), `review`. **Misconceptions.** b10.m1 once ahead,
the game wins itself; b10.m2 attacking means ignoring threats; b10.m3 a lost piece means the game is lost.
**Assessment.** Unit check is replaced by the practical tasks `b10-g1` (as Red) and `b10-g2` (as Black), and the
Basic level exam `xb` (03-assessment.md §6). Remediation: the review of the failed game assigns b06–b08 items.

### Intermediate level

#### i01 — Piece activity and coordination
| Level · prerequisites | Intermediate · b10 | Strands | **PA**, OD |
| --- | --- | --- | --- |
| Baseline topics | 11 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `i01-g1` (`play`, improve pieces) |

**Outcomes.** The learner can identify the least active piece (fewest useful moves, blocked, out of play) of a
side; improve it with a safe move; place two pieces so they support each other (e.g. Chariot behind Horse, Cannon
with a ready screen); reject an activation that walks into a capture.

| Lesson | Title | Objective |
| --- | --- | --- |
| i01l1 | Active and passive pieces | Judge activity by mobility and targets, not by distance travelled |
| i01l2 | Pieces that work together | Coordination of pairs; avoid pieces that block each other |
| i01l3 | Activate safely | Contrast: activation that loses material |

**Practice.** `choice` / `select-squares` (worst piece), `decision` (predicate "mobility of the chosen piece rises"),
contrast items. Most positions have no tactic. Transfer: `i01-g1` (`play`, rubric R3 Plan with an activity
predicate). **Misconceptions.** i01.m1 active = advanced as far as possible; i01.m2 more attackers is always better even
when they block each other. **Assessment.** Unit check. Remediation by lesson.

#### i02 — Forks and pins
| Level · prerequisites | Intermediate · i01 | Strands | **TC**, DE |
| --- | --- | --- | --- |
| Baseline topics | 12 | Colour · perspective | Both · making and avoiding forks/pins |
| Reuses | `u9l1` (win-material forks) | Practical task | — |

**Outcomes.** The learner can win material with a fork by any piece type; recognise a pinned piece (to the General
by a Chariot, by facing Generals, and the two-piece case on a Cannon line, where moving either piece leaves one
screen) — legality is engine-verified, the explanations reviewed; avoid forks and break pins when defending.

| Lesson | Title | Objective |
| --- | --- | --- |
| i02l1 | Forks | Double attacks by Horse, Chariot, Cannon and Soldier |
| i02l2 | Pins | Pieces that cannot move (or cannot leave a line) because of the General |
| i02l3 | Defending forks and pins | Stay off fork points; unpin; counter-attack the forker |

**Practice.** G2 → G0 `combination` (`win-material`) and `move`; `decision` for defence; contrast: a fork that fails
because the forker is captured with check. Transfer: unannounced fork/pin items in full positions as Black.
**Misconceptions.** i02.m1 every fork wins material; i02.m2 a pinned piece cannot capture at all; i02.m3 a Cannon
cannot pin. **Assessment.** Unit check. Remediation by lesson.

#### i03 — Discovered attacks and double check
| Level · prerequisites | Intermediate · i02 | Strands | **TC**, DE |
| --- | --- | --- | --- |
| Baseline topics | 13 | Colour · perspective | Both |
| Reuses | `u9l2`, `u11l1` | Practical task | — |

**Outcomes.** The learner can use a discovered attack (moving a blocker, or for a Cannon creating or removing a
screen) to win material or mate; answer a double check correctly (usually only a General move helps; the engine
decides legality in each position, and any exception used in an item is reviewed); spot and defuse an enemy battery before it fires.

| Lesson | Title | Objective |
| --- | --- | --- |
| i03l1 | Discovered attacks | Moving the front piece; Cannon screens created or removed |
| i03l2 | Double check | Giving it; answering it |
| i03l3 | Defusing a battery | Quiet defence before the discovery |

**Practice.** `combination`, `move`, `decision` (prophylactic defence, predicate "battery line blocked or front
piece no longer able to discover with gain"). **Misconceptions.** i03.m1 one block or capture answers any double check; i03.m2 only Chariots
make discoveries. **Assessment.** Unit check. Remediation by lesson.

#### i04 — Removing defenders, deflection, decoys and overload
| Level · prerequisites | Intermediate · i03 | Strands | **TC** |
| --- | --- | --- | --- |
| Baseline topics | 14 | Colour · perspective | Both |
| Reuses | `u11l2` (decoy), `u10l1` (sacrifice to mate) | Practical task | — |

**Outcomes.** The learner can remove or deflect a defender to win material or mate; decoy a piece (often the
General) onto a bad point; exploit a piece with two defensive jobs; reject a sacrifice that does not work.

| Lesson | Title | Objective |
| --- | --- | --- |
| i04l1 | Remove the defender | Capture or exchange the piece that holds things together |
| i04l2 | Deflection and decoy | Drive a defender away; lure a piece onto a fatal point |
| i04l3 | Overload | One defender, two jobs |
| i04l4 | When the sacrifice fails | Contrast: the tempting sacrifice is refuted; play a quiet move |

**Practice.** `combination` (checkmate / win-material), `decision` for i04l4. **Misconceptions.** i04.m1 a sacrifice
that gives check must be good; i04.m2 the defender is the closest piece. **Assessment.** Unit check (≥ 1 item where
no sacrifice works). Remediation by lesson.

#### i05 — Cannon mating patterns and their defence
| Level · prerequisites | Intermediate · i04 | Strands | **TC**, DE |
| --- | --- | --- | --- |
| Baseline topics | 15 (split, see §8) | Colour · perspective | Both · attack and defence |
| Reuses | `u7l1`, `u7l2`, `u7l3` | Practical task | — |

**Outcomes.** The learner can deliver the Double Cannon, smothered-General (palace blocked by own pieces) and
Horse-behind-Cannon mates in 1–2 moves; recognise the pattern one move early from the defending side and break it
(remove the screen line, free a palace point, counter-check).

| Lesson | Title | Objective |
| --- | --- | --- |
| i05l1 | Double Cannon | Pattern, setup, when it fails |
| i05l2 | The blocked palace | General trapped by its own pieces |
| i05l3 | Horse behind Cannon | Pattern and setup |
| i05l4 | Defending against Cannon mates | As Black: see it coming and stop it |

**Practice.** Existing `move` / `combination` items reused for i05l1–3 (as Red); new `move` (`defend`) and `decision`
items as Black for i05l4. **Misconceptions.** i05.m1 a Cannon checks with no screen; i05.m2 blocking with any piece
always stops a Cannon check (it may create the screen for the second Cannon). **Assessment.** Unit check (≥ 1/3 as
defender). Remediation by lesson.

#### i06 — Horse and Chariot mating patterns and their defence
| Level · prerequisites | Intermediate · i05 | Strands | **TC**, DE |
| --- | --- | --- | --- |
| Baseline topics | 15 (split) | Colour · perspective | Both · attack and defence |
| Reuses | `u8l1`, `u8l2`, `u8l3`, `u8l4` | Practical task | — |

**Outcomes.** The learner can deliver the palace-corner Horse, two-Chariot, Chariot-and-Horse and General-assisted
mates; from the defending side, see the pattern one move early and stop it, choosing a defence that does not lose
material elsewhere.

| Lesson | Title | Objective |
| --- | --- | --- |
| i06l1 | Palace-corner Horse | Pattern and setup |
| i06l2 | Two Chariots | Pattern and setup |
| i06l3 | Chariot and Horse | Pattern and setup |
| i06l4 | The General joins the attack | Facing-Generals support |
| i06l5 | Stop it one move early | As Black: prophylaxis against these patterns |

**Practice.** Reused `move` / `combination` (Red); new `move` (`defend`, depth 1–2) and `decision` as Black.
**Misconceptions.** i06.m1 the attack always needs a check every move; i06.m2 defending means moving the General.
**Assessment.** Unit check (≥ 1/3 as defender). Remediation by lesson.

#### i07 — Tactical defence, exchanges and counter-threats
| Level · prerequisites | Intermediate · i06 | Strands | **DE**, TC |
| --- | --- | --- | --- |
| Baseline topics | 16 | Colour · perspective | Both |
| Reuses | `u9l3`, `u11l3` | Practical task | `i07-g1` (`play`, survive pressure) |

**Outcomes.** The learner can stop a one- or two-move threat; defend by exchanging the key attacker; answer a threat
with a stronger counter-threat when (and only when) it works; choose among several defences the one that does not
create a new weakness.

| Lesson | Title | Objective |
| --- | --- | --- |
| i07l1 | Stop the threat | Find a move that stops the threat (`defend`) |
| i07l2 | Defend by exchange | Trade the attacker |
| i07l3 | Counter-threats | A bigger threat as defence; contrast where it fails |
| i07l4 | Choosing the defence | Several defences work now; only one holds later |

**Practice.** `move` (`defend`), `decision`, `combination` from the defender's side (Black). Transfer: `i07-g1`
(`play`, rubric R5 Holding). **Misconceptions.** i07.m1 any move that stops the immediate threat is fine; i07.m2
counter-attack is always better than defence. **Assessment.** Unit check; `i07-g1` for "applied".

#### i08 — Central Cannon plans as Red
| Level · prerequisites | Intermediate · i07 (knowledge: b09, i01) | Strands | **OD**, PA |
| --- | --- | --- | --- |
| Baseline topics | 17 | Colour · perspective | Red |
| Reuses | — (new) | Practical task | `i08-g1` (`line` → `play`) |

**Content (Proposal; names and plans confirmed by the content reviewer).** The central Cannon (`h2e2`; Vietnamese
*Pháo đầu*) puts pressure on Black's central Soldier and the central file; Red continues by developing the Horses and
bringing a Chariot out. Black's common replies taught as deviations: Screen Horse (both Horses developed toward the
centre, e.g. `h9g7` … `b9c7`), Same-direction Cannons (`h7e7`) and Opposite-direction Cannons (`b7e7`); move legality
Verified (§1). Lines stay short (a few moves per side), every move with its purpose.

**Outcomes.** As Red, the learner can explain what the central Cannon threatens and what it costs; continue
development with purpose against each taught reply; recognise when an early capture of the central Soldier is not
worth it (position-specific, reviewed); choose a middlegame aim at the end of the line.

| Lesson | Title | Objective |
| --- | --- | --- |
| i08l1 | Why the central Cannon? | Purpose, threats, costs |
| i08l2 | Developing behind the Cannon | Horses and Chariots against the Screen Horse |
| i08l3 | When Black plays something else | The plan against the Cannon replies and other deviations |
| i08l4 | Where the plan leads | Middlegame aims; positions with no tactic |

**Practice.** `learn`, `line` with deviations (seeded so each deviation appears), `decision`, `choice`. Transfer:
`i08-g1` (`line` then `play`, rubrics R6 Opening + R1 Safety). **Misconceptions.** i08.m1 the opening is a fixed
sequence; i08.m2 always take the central Soldier at once; i08.m3 the Cannon alone makes an attack. **Assessment.**
Unit check (opponent deviations in at least half the `line` items).

#### i09 — Screen Horse defence plans as Black
| Level · prerequisites | Intermediate · i08 | Strands | **OD**, DE |
| --- | --- | --- | --- |
| Baseline topics | 18 | Colour · perspective | Black |
| Reuses | — (new) | Practical task | `i09-g1` (`line` → `play` as Black) |

**Outcomes.** As Black against the central Cannon, the learner can explain why both Horses protect the centre and
the palace; develop Chariots and Elephants with purpose; create counterplay (e.g. a Soldier advance that frees a
Horse, a Cannon placement) — specific ideas confirmed by the content reviewer; keep the plan when Red deviates.

| Lesson | Title | Objective |
| --- | --- | --- |
| i09l1 | Why the Screen Horse? | Purpose and structure |
| i09l2 | Developing the rest | Chariots, Elephants, Cannons |
| i09l3 | Black's counterplay | Active ideas, not only defence |
| i09l4 | When Red deviates | Early Chariot pressure and other Red tries |

**Practice.** As i08, played as Black. Transfer: `i09-g1`. **Misconceptions.** i09.m1 Black only defends;
i09.m2 the Horses must never move again. **Assessment.** Unit check (all items as Black).

#### i10 — Elementary endgames and General/Soldier activity
| Level · prerequisites | Intermediate · i09 (knowledge: i07) | Strands | **DE**, PA |
| --- | --- | --- | --- |
| Baseline topics | 19 | Colour · perspective | Both · winning and holding |
| Reuses | `u4l2` items with few pieces | Practical task | `i10-g1` (`play`, convert) |

**Outcomes.** The learner can use the General actively (taking a file, supporting with the facing rule); win
elementary endgames from set positions against best defence (each position's win verified by the forced-win search
for that exact position); use Soldiers and the General to restrict the enemy General. General endgame theory
("this material always wins/draws") is taught only with a cited, reviewed source (S1.3); otherwise claims are
limited to the exact verified position.

| Lesson | Title | Objective |
| --- | --- | --- |
| i10l1 | The General as a fighter | Active General; the facing rule in endgames |
| i10l2 | Soldiers and the bare General | Verified elementary wins |
| i10l3 | The Chariot finishes | Chariot (+ General) mates against few defenders |
| i10l4 | Restrict first | Quiet restricting moves before mating |

**Practice.** `combination` (checkmate, verified), `decision` (restriction predicate: enemy General's legal-move
count falls, safety guard), `play` vs the defender profile. Transfer: `i10-g1` (rubric R4 Conversion).
**Misconceptions.** i10.m1 the General must hide in endgames; i10.m2 checking is always the fastest way to mate.
**Assessment.** Unit check; `i10-g1` for "applied".

#### i11 — From opening to middlegame
| Level · prerequisites | Intermediate · i10 (knowledge: i08, i09) | Strands | **PA**, **OD**, PP |
| --- | --- | --- | --- |
| Baseline topics | 20 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `i11-g1` (Red), `i11-g2` (Black); level exam `xi` |

**Outcomes.** The learner can tell when development is complete enough to start a plan; pick a target (central
file, weak flank, an invasion point) from an assessment of the position; play from the end of an opening line into
the middlegame as either colour for several moves with a consistent plan and safely.

| Lesson | Title | Objective |
| --- | --- | --- |
| i11l1 | Is development finished? | Checklist: Chariots active, Horses out, General safe |
| i11l2 | Choosing a target | Target from features of the position |
| i11l3 | Into the middlegame as Red | `line` → `play` |
| i11l4 | Into the middlegame as Black | `line` → `play` |

**Practice.** `choice`, `decision`, `line`, `play`. **Misconceptions.** i11.m1 attack as soon as possible;
i11.m2 a plan is a fixed list of moves. **Assessment.** Unit check; `i11-g1`, `i11-g2`; Intermediate exam `xi`.

### Advanced level

#### a01 — Position assessment
| Level · prerequisites | Advanced · i11 | Strands | **PA** |
| --- | --- | --- | --- |
| Baseline topics | 21 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | — |

**Assessment checklist taught (Proposal; reviewer confirms):** material; General safety (palace defenders, open
lines toward the palace); piece activity and coordination; Soldier structure (crossed, linked, weak); who has the
threats and the initiative. **Important limit:** the engine evaluates material only (Verified, §1), so every
assessment answer here is authored and reviewed; an engine score is never the answer key.

**Outcomes.** The learner can say which side is better and give the main reason, in positions where material is
equal; recognise when a material lead is outweighed by General safety or activity (reviewed examples); assess the
same position from both sides.

| Lesson | Title | Objective |
| --- | --- | --- |
| a01l1 | Material and safety | The two factors that decide most positions at this stage |
| a01l2 | Activity and structure | The slower factors |
| a01l3 | Who is better, and why? | Combine the factors; contrast positions |
| a01l4 | Same position, other side | Assess as Black and as Red |

**Practice.** `choice` (verdict + reason, both required), then `decision` "act on your assessment". **Misconceptions.**
a01.m1 more material = better; a01.m2 the side to move is always better; a01.m3 one factor decides everything.
**Assessment.** Unit check pairs each verdict item with an action item, so guessing a verdict is not enough.

#### a02 — Candidate moves and opponent responses
| Level · prerequisites | Advanced · a01 | Strands | **TC**, PA |
| --- | --- | --- | --- |
| Baseline topics | 22 | Colour · perspective | Both |
| Reuses | `u10l3`, `u12l1`, `u12l2` (mate in 3 as forcing-line practice) | Practical task | — |

**Outcomes.** The learner can list several candidate moves (forcing first: checks, captures, threats, then
improving moves); predict the opponent's best reply; reject a candidate that fails to one reply.

| Lesson | Title | Objective |
| --- | --- | --- |
| a02l1 | Find the candidates | Pick 2–3 candidates from a set |
| a02l2 | What will they play? | Play the opponent's best reply ("move as the other side") |
| a02l3 | Forcing lines | Checks, captures, threats calculated to the end |
| a02l4 | The candidate that fails | Contrast: the natural move loses to one reply |

**Practice.** `choice` (multi-select candidates; scored only when paired with the move item), `move` played *as
the opponent*, `combination`, `decision`. **Misconceptions.** a02.m1 the first good-looking move is enough; a02.m2
the opponent will play the reply I expect. **Assessment.** Unit check.

#### a03 — Improving poorly placed pieces
| Level · prerequisites | Advanced · a02 | Strands | **PA** |
| --- | --- | --- | --- |
| Baseline topics | 23 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `a03-g1` (`play`, re-route a piece) |

**Outcomes.** The learner can find the worst-placed piece; plan a route of 2–3 moves to a better point; prefer that
improvement to a premature attack that the engine guard shows to be refuted or that the reviewed explanation shows
to achieve nothing (pilot candidate, see S1.4).

| Lesson | Title | Objective |
| --- | --- | --- |
| a03l1 | The worst piece | Identify it and say why |
| a03l2 | Routes | Plan and play a re-route against a passive opponent |
| a03l3 | Improve instead of attack | Contrast: the attack fails, the improvement works |

**Practice.** `select-squares` (worst piece), `line` (re-route, opponent replies authored), `decision`, `play`.
Transfer: `a03-g1` (rubric R3). **Misconceptions.** a03.m1 every move must threaten something; a03.m2 a piece is
"placed" once it has moved. **Assessment.** Unit check; `a03-g1` for "applied".

#### a04 — Open files, ranks and invasion points
| Level · prerequisites | Advanced · a03 | Strands | **PA**, TC |
| --- | --- | --- | --- |
| Baseline topics | 24 | Colour · perspective | Both · invading and denying |
| Reuses | — (new) | Practical task | — |

**Outcomes.** The learner can occupy and contest open files and useful ranks with Chariots; identify invasion points
near the enemy palace for Horses and Chariots; deny invasion points as the defender.

| Lesson | Title | Objective |
| --- | --- | --- |
| a04l1 | Open files | Take and contest them |
| a04l2 | Ranks | Lateral Chariot activity across the board |
| a04l3 | Invasion points | Where pieces hurt the palace |
| a04l4 | Closing the door | Deny invasion as the defender |

**Practice.** `decision` (predicates: file occupied, invasion point controlled), `choice`, `line`. **Misconceptions.**
a04.m1 the first Chariot on a file owns it; a04.m2 invade as soon as possible. **Assessment.** Unit check.

#### a05 — Soldier structures, breaks and weaknesses
| Level · prerequisites | Advanced · a04 | Strands | **PA**, DE |
| --- | --- | --- | --- |
| Baseline topics | 25 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | — |

**Outcomes.** The learner can explain the role of the central and linked Soldiers; time a Soldier advance that opens
a line or frees a piece; identify undefended Soldiers and points they no longer cover; explain why a crossed Soldier is
worth more than the engine's value suggests (disclosed engine limitation, Verified).

| Lesson | Title | Objective |
| --- | --- | --- |
| a05l1 | What Soldiers do | Blocking, supporting, controlling points |
| a05l2 | Soldier breaks | Advances that open lines; when they are premature |
| a05l3 | Weaknesses | Undefended Soldiers and the holes behind them |
| a05l4 | The crossed Soldier | Value in middlegame and endgame |

**Practice.** `choice`, `decision`, `line`. Contrast: a premature advance (irreversible). **Misconceptions.** a05.m1
advancing Soldiers is always progress; a05.m2 Soldiers are not worth defending. **Assessment.** Unit check.

#### a06 — Preparing attacks before a combination exists
| Level · prerequisites | Advanced · a05 (knowledge: i06) | Strands | **PA**, TC |
| --- | --- | --- | --- |
| Baseline topics | 26 | Colour · perspective | Both |
| Reuses | `u10l2` (quiet moves), `u12l3` (quiet start) as finishing examples | Practical task | `a06-g1` (`play`, build an attack) |

**Outcomes.** The learner can bring more attackers than defenders to the palace before attacking; provoke or exploit
weakened palace defences; play a quiet move that creates a real threat (Needs architecture confirmation:
"creates a threat" = if the same side moved again it would have a forced win or material gain within the checked
depth, computed on a legal position); recognise when the attack is not ready and keep improving.

| Lesson | Title | Objective |
| --- | --- | --- |
| a06l1 | More attackers than defenders | Count and add attackers |
| a06l2 | Weakening the palace | Target the defenders |
| a06l3 | The quiet threat | A move that threatens without checking |
| a06l4 | Not yet | Contrast: the attack is premature; improve or defend first |

**Practice.** `decision` (threat predicate), `combination` (finishing), `play`. Transfer: `a06-g1` (rubric R3 + R1).
**Misconceptions.** a06.m1 attacking means checking; a06.m2 if there is no combination, there is nothing to do.
**Assessment.** Unit check; `a06-g1` for "applied".

#### a07 — Positional defence and counterplay
| Level · prerequisites | Advanced · a06 | Strands | **DE**, PA |
| --- | --- | --- | --- |
| Baseline topics | 27 | Colour · perspective | Both (≥ half as Black) |
| Reuses | `u11l3` (stop mate in 2) | Practical task | `a07-g1` (`play`, defend and counter) |

**Outcomes.** The learner can stop an opponent's plan before it becomes tactical (prophylaxis); exchange the best
attacker; create counterplay elsewhere instead of only waiting; defend as Black under central-Cannon pressure.

| Lesson | Title | Objective |
| --- | --- | --- |
| a07l1 | Prophylaxis | What does the opponent want? Stop it |
| a07l2 | Trade the best attacker | Defensive exchanges |
| a07l3 | Counterplay | Threats on the other side |
| a07l4 | Under pressure as Black | Transfer to a full opening-derived position |

**Practice.** `decision`, `move` (`defend`, depth 2), `play` vs the counterpuncher profile. Transfer: `a07-g1`
(rubrics R5 + R1). **Misconceptions.** a07.m1 defence means passivity; a07.m2 defend only when the threat is
immediate. **Assessment.** Unit check; `a07-g1` for "applied".

#### a08 — Exchanges and phase transitions
| Level · prerequisites | Advanced · a07 | Strands | **PA**, DE |
| --- | --- | --- | --- |
| Baseline topics | 28 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | — |

**Outcomes.** The learner can choose exchanges that help (simplify when ahead, remove attackers when defending)
and avoid those that help the opponent; compare the endgames that two exchange choices lead to, where the
comparison is verified for the exact positions or reviewed with a source; keep pieces when winning chances need them.

| Lesson | Title | Objective |
| --- | --- | --- |
| a08l1 | Which trades help? | By material balance and by who attacks |
| a08l2 | Choosing the endgame | Compare resulting endgames |
| a08l3 | Keep the pieces | When trading kills the winning chances |

**Practice.** `decision`, `choice`. **Misconceptions.** a08.m1 trade whenever possible when ahead; a08.m2 all endgames
with more material win. **Assessment.** Unit check.

#### a09 — Practical Chariot, Horse and Cannon endgames
| Level · prerequisites | Advanced · a08 (knowledge: i10) | Strands | **DE** |
| --- | --- | --- | --- |
| Baseline topics | 29 | Colour · perspective | Both · winning and holding |
| Reuses | — (new) | Practical task | `a09-g1` (convert), `a09-g2` (hold) |

**Outcomes.** The learner can convert Chariot, Horse and Cannon endgames from set positions against best defence
(wins proved by the forced-win search for the exact position, within the search limits documented in S1.1); use a
Cannon's screen (own General or Advisor) in the endgame; hold a worse endgame for the task's move cap.

| Lesson | Title | Objective |
| --- | --- | --- |
| a09l1 | Chariot endgames | Technique and typical setups |
| a09l2 | Horse endgames | Horse with Soldiers |
| a09l3 | Cannon endgames | Finding screens |
| a09l4 | Defending with less | Holding technique |

**Practice.** `combination`, `play` (defender profile), `decision`. "Draw" is never claimed from search alone; holding
tasks say "hold for N moves" (03-assessment.md §8). **Misconceptions.** a09.m1 a Cannon is strong with nothing on the
board; a09.m2 more material always wins. **Assessment.** Unit check; `a09-g1`, `a09-g2`.

#### a10 — Annotated games connecting all phases
| Level · prerequisites | Advanced · a09 | Strands | **PP**, PA, OD, DE |
| --- | --- | --- | --- |
| Baseline topics | 30 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `a10-g1` (`review` of own exam game); level exam `xa` |

**Outcomes.** The learner can follow a complete annotated game and predict key moves at its turning points (opening
plan → middlegame target → transition → endgame); explain each turning point; apply the same questions to their own
game.

| Lesson | Title | Objective |
| --- | --- | --- |
| a10l1 | Annotated game as Red | Predict-the-move at turning points |
| a10l2 | Annotated game as Black | Same, as Black |
| a10l3 | Your game, annotated | `review` of the learner's own game |

**Practice.** `line` (predict-the-move with annotations; acceptance as `decision`), `choice`, `review`. **Source of
games: Unresolved** (§9). **Assessment.** Unit check (unseen turning points from a different game); `a10-g1`;
Advanced exam `xa`.

### Expert level

#### e01 — Branching calculation and intermediate moves
| Level · prerequisites | Expert · a10 | Strands | **TC** |
| --- | --- | --- | --- |
| Baseline topics | 31 | Colour · perspective | Both · attacker and defender |
| Reuses | `u12l*`, `u13l2`, `u13l3`, `u14l1`, `u14l2`, `u15l1`, `u15l2` (mate in 3/4 as calculation practice) | Practical task | — |

**Outcomes.** The learner can calculate lines where the defender has several replies and handle each; find and use
intermediate moves (for both sides); find the refutation of an opponent's combination.

| Lesson | Title | Objective |
| --- | --- | --- |
| e01l1 | Every reply counts | Practice mode varies the defence so several branches are met |
| e01l2 | Intermediate moves | Insert a forcing move before the expected recapture |
| e01l3 | Long forcing lines | Mate in 3–4 (reused) |
| e01l4 | Refute their combination | As defender, find the hole in the opponent's line |

**Practice.** `combination` (with varied defence in practice, Needs architecture confirmation), `decision`,
`move` as the defender. **Misconceptions.** e01.m1 the opponent must recapture; e01.m2 calculation stops at the first
check. **Assessment.** Unit check (no item from the reused pools; independent pool only).

#### e02 — Sound sacrifices and compensation
| Level · prerequisites | Expert · e01 | Strands | **TC**, PA |
| --- | --- | --- | --- |
| Baseline topics | 32 | Colour · perspective | Both |
| Reuses | `u10l1` | Practical task | — |

**Outcomes.** The learner can play forced sacrifices (verified); judge a non-forced sacrifice by what it gains
(open General, lasting initiative) using only reviewed examples, since the material-only engine cannot prove
compensation (Verified limit); accept and refute unsound sacrifices as the defender.

| Lesson | Title | Objective |
| --- | --- | --- |
| e02l1 | Sacrifices that force | Mate or material back by force |
| e02l2 | Paying for the initiative | Reviewed, non-forced examples; claims limited |
| e02l3 | Taking the bait safely | Refute unsound sacrifices |

**Practice.** `combination`, `choice`, `decision`. **Misconceptions.** e02.m1 every sacrifice near the General works;
e02.m2 never accept a sacrifice. **Assessment.** Unit check (≥ 1 unsound-sacrifice item).

#### e03 — Initiative, tempo and switching targets
| Level · prerequisites | Expert · e02 | Strands | **PA**, TC |
| --- | --- | --- | --- |
| Baseline topics | 33 + 34 (merged, see §8) | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `e03-g1` (`play`, keep the initiative) |

**Outcomes.** The learner can gain time with threats; decide when to keep up the pressure and when to cash in;
create a second target so one defender cannot hold both; switch the attack to the other wing.

| Lesson | Title | Objective |
| --- | --- | --- |
| e03l1 | Moves with tempo | Develop or improve with a threat |
| e03l2 | Keep it or cash it | When the initiative fades |
| e03l3 | Two targets | Overstretch the defence |
| e03l4 | Switch the attack | Change wing when one side is closed |

**Practice.** `decision`, `line`, `play` (counterpuncher profile). Transfer: `e03-g1` (rubric R3 + R4).
**Misconceptions.** e03.m1 checks are the best way to keep the initiative; e03.m2 an attack must succeed where it
started. **Assessment.** Unit check; `e03-g1`.

#### e04 — Active defence
| Level · prerequisites | Expert · e03 | Strands | **DE** |
| --- | --- | --- | --- |
| Baseline topics | 35 | Colour · perspective | Both (≥ half as Black) |
| Reuses | `u13l1` (only move), `u15l3` defend-3 item | Practical task | `e04-g1` (`play`, hold under attack) |

**Outcomes.** The learner can find the only move; defend by counter-attack; return material to break an attack;
hold a position under a prepared attack for the task's move cap.

| Lesson | Title | Objective |
| --- | --- | --- |
| e04l1 | The only move | `defend` depth 2–3 (reused) |
| e04l2 | Counter-attack as defence | Threats that stop the attack |
| e04l3 | Give it back | Return material to end the attack |
| e04l4 | Hold the fort | `play` as defender |

**Practice.** `move` (`defend`), `decision`, `play`. Transfer: `e04-g1` (rubric R5). **Misconceptions.** e04.m1 keep all
material at any cost; e04.m2 passive defence is safest. **Assessment.** Unit check; `e04-g1`.

#### e05 — Static versus dynamic advantages
| Level · prerequisites | Expert · e04 | Strands | **PA** |
| --- | --- | --- | --- |
| Baseline topics | 36 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | — |

**Outcomes.** The learner can classify an advantage as static (material, structure) or dynamic (activity,
initiative, General exposure); choose the plan that fits it (play fast with a dynamic edge, consolidate with a static
one); turn a dynamic advantage into a static one before it fades.

| Lesson | Title | Objective |
| --- | --- | --- |
| e05l1 | Two kinds of advantage | Classify, with reasons |
| e05l2 | Play to your advantage | Matching plan to advantage |
| e05l3 | Cash in | Converting dynamic into static |

**Practice.** `choice`, `decision`, `line`. All answer keys authored and reviewed (engine is material-only).
**Misconceptions.** e05.m1 only material counts; e05.m2 activity lasts forever. **Assessment.** Unit check.

#### e06 — Converting advantages while restricting counterplay
| Level · prerequisites | Expert · e05 (knowledge: a09) | Strands | **DE**, **PA** |
| --- | --- | --- | --- |
| Baseline topics | 37 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `e06-g1` (Red), `e06-g2` (Black) |

**Outcomes.** The learner can, when ahead, first remove the opponent's counterplay (prophylaxis, safe General) and
then advance; simplify into a won endgame (verified for the exact position); convert as either colour against the
counterpuncher profile within the move cap.

| Lesson | Title | Objective |
| --- | --- | --- |
| e06l1 | Safety first when ahead | Prophylaxis before progress |
| e06l2 | Simplify to win | Trades into verified won endgames |
| e06l3 | Converting as Black | Transfer to the other colour |

**Practice.** `decision`, `play`. Transfer: `e06-g1`, `e06-g2` (rubric R4). **Misconceptions.** e06.m1 when ahead,
attack immediately; e06.m2 the opponent has nothing left. **Assessment.** Unit check; `e06-g1`, `e06-g2`.

#### e07 — Defending inferior positions and drawing resources
| Level · prerequisites | Expert · e06 | Strands | **DE** |
| --- | --- | --- | --- |
| Baseline topics | 38 | Colour · perspective | Both (≥ half as Black) |
| Reuses | — (new) | Practical task | `e07-g1` (`play`, hold) |

**Outcomes.** The learner can keep a worse position together (General safety, trading attackers, active pieces);
use defensive setups that are verified for the exact position (holding for the task's move cap, or a cited and
reviewed source for a theoretical draw); explain which repetitions are legal draws and which are forbidden under the
ruleset (perpetual check, perpetual chase), and what the app adjudicates (03-assessment.md §8).

| Lesson | Title | Objective |
| --- | --- | --- |
| e07l1 | Hold together | Practical defence when down material |
| e07l2 | Defensive setups | Only verified or sourced setups |
| e07l3 | Repetition: resource and limits | Ruleset lesson, with the app's limits disclosed |

**Practice.** `decision`, `choice`, `play` (holding). **Scope note:** the engine cannot prove a draw (Verified: no
repetition handling; the solver proves forced wins within a depth only). "Verified drawing resources" in the
baseline is therefore narrowed to "positions where the defender holds for the stated move cap against the strongest
training profile, or a sourced theoretical draw" — recorded here, not silently dropped. **Assessment.** Unit check;
`e07-g1`.

#### e08 — A practical opening repertoire for both colours
| Level · prerequisites | Expert · e07 (knowledge: i11, e03) | Strands | **OD**, PA |
| --- | --- | --- | --- |
| Baseline topics | 39 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `e08-g1` (Red), `e08-g2` (Black) |

**Outcomes.** The learner can play one repertoire as Red (central Cannon plan against the main replies) and as
Black (a plan against the central Cannon and against first moves such as the Elephant, Soldier and Horse openings —
`c0e2`, `g3g4`, `h0g2` legality Verified; names confirmed by the reviewer); explain the purpose of each repertoire
move and the middlegame it leads to; handle deviations by principle.

| Lesson | Title | Objective |
| --- | --- | --- |
| e08l1 | Repertoire as Red | Central Cannon against the main replies |
| e08l2 | Repertoire as Black against the central Cannon | Screen Horse and one alternative |
| e08l3 | Black against other first moves | Elephant, Soldier and Horse openings |
| e08l4 | Testing the repertoire | Random deviations, then `play` |

**Practice.** `line` (deviations seeded), `play`. Transfer: `e08-g1`, `e08-g2` (rubric R6 + R1). **Misconceptions.**
e08.m1 a repertoire is a list to memorise; e08.m2 a deviation is a mistake to punish at once. **Assessment.** Unit
check (lines with deviations not met in practice).

#### e09 — Independent analysis of personal games
| Level · prerequisites | Expert · e08 | Strands | **PP** |
| --- | --- | --- | --- |
| Baseline topics | 40 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `e09-g1` (`review`); level exam `xe` |

**Outcomes.** The learner can find the turning points of their own game (engine-detected material/mate swings);
propose a better move at each (judged like `decision`); classify the mistake (missed threat, missed tactic, plan,
endgame technique); build a short training plan from the categories the app can detect.

| Lesson | Title | Objective |
| --- | --- | --- |
| e09l1 | Find the turning point | Locate swings in own games |
| e09l2 | Name the mistake | Classify (tactical categories scored; positional ones self-reported) |
| e09l3 | A training plan | Pick units to revisit from the review |

**Practice.** `review`, `choice`. **Assessment.** `e09-g1` (rubric R7); Expert exam `xe`.

### Master level

All Master items are unlabelled and mixed across strands and colours; prompts are neutral (03-assessment.md §4.2).

#### m01 — Diagnosing unfamiliar positions without motif labels
| Level · prerequisites | Master · e09 | Strands | **PA**, **TC** |
| --- | --- | --- | --- |
| Baseline topics | 41 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | — |

**Outcomes.** In unlabelled positions the learner can decide what kind of position it is (tactical, quiet, defensive,
endgame) and act: find the tactic if there is one, otherwise the best plan or the necessary defence.

| Lesson | Title | Objective |
| --- | --- | --- |
| m01l1 | What kind of position? | Classify, then act |
| m01l2 | Mixed decisions | Unlabelled `decision` items across strands (≥ 1/3 no tactic) |

**Assessment.** Unit check is itself mixed and unlabelled.

#### m02 — Comparing plausible plans
| Level · prerequisites | Master · m01 | Strands | **PA** |
| --- | --- | --- | --- |
| Baseline topics | 42 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `m02-g1` (`play` the chosen plan) |

**Outcomes.** The learner can name two plausible plans, compare them by assessment factors, choose one and carry it
out for several moves.

| Lesson | Title | Objective |
| --- | --- | --- |
| m02l1 | Two plans | Describe and compare (reviewed keys) |
| m02l2 | Test the plan | Play the chosen plan (Needs architecture confirmation: replay one position with each plan) |

**Assessment.** Unit check; `m02-g1`.

#### m03 — Switching between attack and defence
| Level · prerequisites | Master · m02 | Strands | **PA**, **DE** |
| --- | --- | --- | --- |
| Baseline topics | 43 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `m03-g1` (`play`, counterpuncher) |

**Outcomes.** The learner can notice when the opponent's counter-attack outweighs their own attack and switch to
defence (and back); detected in `play` by the rubric's "unanswered threat" items.

| Lesson | Title | Objective |
| --- | --- | --- |
| m03l1 | Whose attack is faster? | Count tempi to mate/material for both sides |
| m03l2 | Switching in play | `play` with an opponent counter-attack |

**Assessment.** Unit check; `m03-g1`.

#### m04 — Irreversible decisions
| Level · prerequisites | Master · m03 | Strands | **PA** |
| --- | --- | --- | --- |
| Baseline topics | 44 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | — |

**Outcomes.** The learner can recognise irreversible moves (Soldier advances, exchanges, sacrifices, weakening the
palace) and decide whether to commit now or keep options.

| Lesson | Title | Objective |
| --- | --- | --- |
| m04l1 | No way back | Recognise irreversible moves |
| m04l2 | Commit or wait | `decision` with contrasting pairs |

**Assessment.** Unit check.

#### m05 — Complex practical endgames
| Level · prerequisites | Master · m04 | Strands | **DE** |
| --- | --- | --- | --- |
| Baseline topics | 45 | Colour · perspective | Both · converting and holding |
| Reuses | — (new) | Practical task | `m05-g1` (convert), `m05-g2` (hold) |

**Outcomes.** With several pieces left, the learner can choose a plan (trade into a verified won endgame, create a
passed/crossed Soldier, restrict the General) and carry it out, or hold a worse one for the move cap.

| Lesson | Title | Objective |
| --- | --- | --- |
| m05l1 | Plans in rich endgames | Choose and execute |
| m05l2 | Holding the worse side | `play` as defender |

**Assessment.** Unit check; `m05-g1`, `m05-g2`.

#### m06 — Handling unfamiliar opening moves
| Level · prerequisites | Master · m05 | Strands | **OD**, PA |
| --- | --- | --- | --- |
| Baseline topics | 46 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `m06-g1` (`play` from an unusual opening) |

**Outcomes.** Facing legal, plausible moves outside the learner's repertoire, the learner can apply principles
(development, centre, General safety) and the safety routine, judged by rubrics R2 + R1, not by a book line.

| Lesson | Title | Objective |
| --- | --- | --- |
| m06l1 | Out of the book | Principles against unknown moves |
| m06l2 | Punish or ignore? | When an odd move has a weakness, and when it is just different |

**Assessment.** Unit check; `m06-g1`.

#### m07 — Time management and practical risk
| Level · prerequisites | Master · m06 | Strands | **PP** |
| --- | --- | --- | --- |
| Baseline topics | 47 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | — |

**Outcomes.** The learner can decide how much to calculate (forcing positions vs quiet ones); choose a safe or a
risky continuation according to the situation (ahead, behind, against counterplay).

| Lesson | Title | Objective |
| --- | --- | --- |
| m07l1 | Where to spend your thinking | Spot the critical moment |
| m07l2 | Safe or risky? | `choice` + `decision` by situation |

**Scope note:** the app has no game clock (Verified: `src/components` has only animation/feedback timers, no game clock). Time management is taught as
"choosing where to think"; an optional decision timer is **Needs architecture confirmation** and never required
for accessibility.

#### m08 — Deep annotated-game analysis
| Level · prerequisites | Master · m07 | Strands | **PP**, PA |
| --- | --- | --- | --- |
| Baseline topics | 48 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `m08-g1` (`review`) |

**Outcomes.** The learner can analyse a complete game: alternatives at critical moments, the plans of both sides,
where the result was decided.

| Lesson | Title | Objective |
| --- | --- | --- |
| m08l1 | One game, both sides | Predict both sides' moves at critical moments |
| m08l2 | Where was it decided? | Choose and justify |

**Source of games: Unresolved** (§9). **Assessment.** Unit check; `m08-g1`.

#### m09 — Graduation: multi-game assessment, portfolio and reassessment
| Level · prerequisites | Master · m08 | Strands | **PP**, all |
| --- | --- | --- | --- |
| Baseline topics | 49 + 50 (merged, see §8) | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `xm` (multi-game exam) |

**Outcomes.** The learner completes several practical games/tasks across phases and both colours (03-assessment.md
§6, `xm`), reviews each, and receives a portfolio summary: strands mastered, applied tasks passed, weaknesses
found, and a remediation path for any strand below threshold, with reassessment.

| Lesson | Title | Objective |
| --- | --- | --- |
| m09l1 | The graduation games | Multi-game practical assessment |
| m09l2 | Portfolio and next steps | Review, remediation, reassessment |

No new teaching; all items are assessment (03-assessment.md §6.5).

---

## 8. Coverage

### 8.1 Baseline topics → units (Verified against the list in `01-audit-and-design.md`)

| Topics | Unit | Change |
| --- | --- | --- |
| 1–10 | b01–b10 | One unit each, renamed only |
| 11–14 | i01–i04 | One unit each |
| 15 | i05 + i06 | **Split**: the topic holds 7 existing lessons' worth of patterns (`u7`, `u8`) plus new defending lessons; one unit would be too long for a phone session and would bury defence |
| 16–20 | i07–i11 | One unit each |
| 21–30 | a01–a10 | One unit each |
| 31–32 | e01–e02 | One unit each |
| 33 + 34 | e03 | **Merge**: tempo and switching targets are the same skill (keeping the opponent busy) with the same exercise types and practical task; separate units would duplicate the `play` task |
| 35–40 | e04–e09 | One unit each; 38 narrowed (see e07 scope note), not dropped |
| 41–48 | m01–m08 | One unit each; 47 scoped to "choosing where to think" (no clock; see m07) |
| 49 + 50 | m09 | **Merge**: both are assessment and portfolio activities, no new teaching |

No topic is dropped; no topic order changed. Prerequisites listed as "knowledge" in a unit header are informational
(remediation and jump-test sampling); unlocking stays linear within a level as today (Verified,
`src/lessons/progress.ts:11`), Unresolved whether to unlock by the prerequisite graph instead.

### 8.2 Strand coverage by unit (primary in caps)

| Level | RS | TC | OD | PA | DE | PP |
| --- | --- | --- | --- | --- | --- | --- |
| Basic | B01–B08 | b03, b04, b06, B07 | B09, b10 | b07, b09 | b02, b05, b06, B08, b10 | b08, B10 |
| Intermediate | — (safety rubric in every `play`) | I02–I06, i07 | I08, I09, I11, i01 | I01, I11, i08, i10 | I07, I10, i02, i03, i05, i06, i09 | i11 |
| Advanced | rubric only | A02, a04, a06 | a10 | A01, A03–A06, A08, a02, a07 | A07, A09, a05, a08, a10 | A10 |
| Expert | rubric only | E01, E02, e03 | E08 | E03, E05, E06, e02, e08 | E04, E06, E07 | E09 |
| Master | rubric only | M01 | M06 | M01–M04, m06, m08 | M03, M05 | M07–M09 |

RS is taught in Basic and then assessed continuously through the R1 Safety rubric of every practical task and
through safety-critical items in later unit checks (03-assessment.md §4.1).

### 8.3 Cross-cutting requirements

| Requirement | Where it is met |
| --- | --- |
| Both colours | Black practice from b02 on; ≥ 1/3 Black items per level; Black-only i09; ≥ half Black in a07, e04, e07; practical tasks as both colours in b10, i11, e06, e08 |
| Attack and defence | Paired lessons: i02l3, i03l3, i05l4, i06l5, a04l4, e01l4, e02l3; defence units i07, a07, e04, e07, m03, m05 |
| Positions with no immediate tactic | Core of b08, b09, i01, i08–i11, a01, a03–a05, a07, a08, e05, e06, m01–m04, m06; contrast lessons i04l4, a03l3, a06l4; ≥ 1/4 of independent/assessment items in PA/OD/DE units |
| Plans before memorisation | b09 (principles, no names) → i08/i09 (one plan per colour, short lines, deviations) → e08 (repertoire) → m06 (unfamiliar moves) |
| Difficulty levers | §5 table; Master items unlabelled and mixed |
| Completion / mastery / application | 03-assessment.md §2 |
| Self-analysis | b10l4 → a10 → e09 → m08 → m09 |

### 8.4 Existing lessons → candidate homes (feasibility for S1.3)

| Existing | Candidate new home |
| --- | --- |
| `u1l1` | b01 · `u1l2` → b02 · `u1l3` → b02 |
| `u2l1`, `u2l2` | b03 (and b06/b07 contrast captures) |
| `u3l1`, `u3l2` | b04 (checkmate items → b05) |
| `u4l1`, `u4l2` | b05 (few-piece mates also i10) |
| `u7l1`–`u7l3` | i05 |
| `u8l1`–`u8l4` | i06 |
| `u9l1` | i02 · `u9l2` → i03 · `u9l3` → i07 |
| `u10l1` | i04 / e02 · `u10l2` → a06 · `u10l3` → a02 |
| `u11l1` | i03 · `u11l2` → i04 · `u11l3` → i07 / a07 |
| `u12l1`–`u12l3` | a02 / a06 / e01 |
| `u13l1` | e04 · `u13l2`, `u13l3` → e01 |
| `u14l1`, `u14l2` | e01 |
| `u15l1`, `u15l2` | e01 · `u15l3` → e04 / e01 |
| Puzzle bank (`m1-*`, `m2-*`, `wm-*`) | Stays a separate optional practice area; never counts toward mastery or application (03-assessment.md §7) |

Reused exercises are **practice** material. They are not used as unit-check or placement items, because learners may
have seen them (03-assessment.md §4.2).

---

## 9. Unresolved decisions

| # | Question | Options | Needed from |
| --- | --- | --- | --- |
| U1 | Source of annotated games (a10, m08) and opening lines | (a) games played and annotated by the authors/testers; (b) historical games with attribution under the S1.3 policy; (c) both, reviewed | S1.3 sourcing policy, content reviewer |
| U2 | Vietnamese and English glossary owner (piece, pattern, opening names) | Single glossary section in `messages.ts` comments or a design file | S1.4 |
| U3 | Unlock by prerequisite graph instead of linear order within a level | Keep linear (today); graph | S1.4, pilot |
| U4 | `decision` predicates: which predicates are built-in | Minimal set listed in §4.1 vs per-item code | S1.1 architecture |
| U5 | Board orientation when playing Black (flip, coordinate labels) | — | S1.1 architecture |
| U6 | `play` lengths and training-partner time budget on a phone | §5 targets | S1.1, pilot |
| U7 | Optional decision timer (m07) | Omit; optional per item | S1.1, LX reviewer |
| U8 | Number of lessons per unit after the pilot | As specified; adjusted by pilot findings | Pilot (step 2) |
