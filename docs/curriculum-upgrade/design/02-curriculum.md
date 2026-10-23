# Curriculum specification

Backlog item S1.2 · Owner: curriculum designer · Companion: [03-assessment.md](./03-assessment.md) (how
everything here is assessed). Audit: [01-audit.md](./01-audit.md); architecture: [04-architecture.md](./04-architecture.md)
(S1.1). S1.4 reconciles the three. Revision: attempt 3 (fixes the S1.2 review findings of attempts 1 and 2), plus
the S1.4 reconciliation (successor-only migrated completion, Reuses lines aligned with 05-migration.md, partner chains
and fallback pointers aligned with 03-assessment.md §5.2, one move notation, owners of open items in §11).

## 0. How to read this document

Every statement carries one of these labels, either on its own line or on the section heading it belongs to:

- **Verified**: checked against the repository (file reference given) or with the engine (command given).
- **Proposal**: a design choice made here. Later steps implement it unless the S1 gate, a reviewer or the pilot
  changes it.
- **Unresolved**: needs more information, another role, or the pilot. Listed again in §11.
- **Needs architecture confirmation**: a proposal that depends on a capability the architecture review (S1.1 /
  S1.4) must confirm is feasible in a static PWA with the in-repo engine on a phone.

This document contains **no chess positions**. It describes what each position must show; positions are authored
and verified later under the sourcing and verification policy (S1.3, `design/07-sourcing.md`). It claims **no
ratings, no playing strength and no learning times**. "Master" is the name of the last course stage, not a title.

---

## 1. Starting point (Verified)

Checked on this branch with a short Node script over `src/content/lessons/*.json` (S1.1 owns the full audit).

| Fact | Evidence |
| --- | --- |
| 13 units, 36 lessons, 49 learn cards, 146 practice exercises (non-`learn`) | `src/content/lessons/*.json` |
| Practice by track: basics 26, intermediate 58, advanced 27, expert 21, master 14 | same |
| Intermediate–Master practice is almost all mating (`move` checkmate, `combination` checkmate), plus `move` defend (depth 1–3) and five `win-material` combinations (all in `u9l1`) | same |
| Practice exercises are played as Red; only `learn` cards may show Black to move | `src/content/types.ts:5`, `:10` |
| Exercise types: `learn`, `select-squares`, `move` (goals `reach`, `any`, `check`, `checkmate`, `defend`), `capture`, `combination` | `src/content/types.ts` |
| Lessons unlock in order within a track; the first lesson of every track is open | `src/lessons/progress.ts:11` |
| Jump-ahead test = last two non-`learn` exercises of each skipped lesson, at most 8, 3 lives; passing marks the skipped lessons complete | `src/lessons/progress.ts:39`, `:41`, `:55–56` |
| Lesson completion does not depend on first-try accuracy | `src/components/LessonPlayer.tsx:71`, `:152` |
| Progress is one set of completed lesson ids under `progress.completedLessons.v1` | `src/storage/index.ts:61` |
| Engine evaluation is material only (Chariot 9, Cannon 4.5, Horse 4, Advisor 2, Elephant 2, Soldier 1; a crossed Soldier counts the same as an uncrossed one) | `src/engine/solver.ts:9–17` |
| Repetition, perpetual check and perpetual chase are not handled by the engine | `src/engine/status.ts:12` |
| The app has no game clock (only animation/feedback timers) | `src/components/*.tsx` |
| These sequences are legal from `START_FEN`: `h2-e2 h9-g7 h0-g2 b9-c7 i0-h0 i9-h9`; `h2-e2 h7-e7`; `h2-e2 b7-e7`; `g3-g4`; `h0-g2`; `c0-e2` | `parseFen` / `isLegalMove` / `makeMove` from `src/engine` (read-only script, not committed). Legality only: names and plans are for the content reviewer |

The historical finding in `01-audit-and-design.md` (13 units, 36 lessons, 146 practice exercises; 120 of them
Intermediate–Master; learner always Red; jump-ahead samples practice exercises) matches these counts.

---

## 2. Design rules applied (Proposal)

1. **Why, when, when not.** Every lesson has a `learn` card or worked example explaining *why* the idea works,
   and at least one **contrast** item where the same-looking idea fails.
2. **Both colours, both sides of the idea.** From `b02` on, every unit has practice as Black, except units that
   declare a colour exception with a reason (only `i08`, Red-only by topic, balanced by the Black-only `i09`). Each
   level has at least one third of its practice and assessment items played as Black.
3. **Quiet positions are normal.** Units with a primary PA, OD or DE strand include items whose best answer is a
   quiet move and items where "there is no tactic" is right: at least a quarter of their independent and assessment
   items have no immediate tactical win.
4. **Plans before move orders.** `b09` principles (no named opening) → `i08` / `i09` one plan per colour with
   short explained lines and deviations → `e08` repertoire → `m06` unfamiliar moves.
5. **Difficulty through decisions, not only depth** (§6).
6. **Completion ≠ mastery ≠ application** (03-assessment.md §2). XP, hearts and streaks never feed mastery or
   application.
7. **Small reusable exercise set**: ten types (§5).
8. **Accept reasonable alternatives** (§5.3).
9. **Position-specific feedback** (§7).
10. **Bilingual**, with one glossary and one notation (§4).

---

## 3. Structure

### 3.1 Competency strands (Proposal)

| Code | Strand | Covers |
| --- | --- | --- |
| **RS** | Rules and board safety | Moves, notation, check, results, ruleset; attacked/defended pieces; the pre-move safety routine |
| **TC** | Tactical recognition and calculation | Motifs, forcing lines, candidate moves, branching calculation, intermediate moves, sacrifices |
| **OD** | Openings and piece development | Development principles, opening plans per colour, deviations, repertoire, unfamiliar openings |
| **PA** | Positional assessment, planning and attack | Activity, assessment, plans, files/ranks, Soldier structure, preparing attacks, initiative |
| **DE** | Defence and endgames | Tactical and positional defence, counterplay, holding worse positions, endgames |
| **PP** | Practical play and self-analysis | Sustained play, complete games, self-review, risk decisions, portfolios |

Each unit has one or two **primary** strands (bold in the unit header) and optional secondary strands. Assessment
items carry exactly one strand tag.

### 3.2 Levels (Proposal; level names = existing `Track` values, Verified in `src/content/types.ts`)

| Level (track) | Prefix | Units | Exit outcome (observable) |
| --- | --- | --- | --- |
| Basic (`basics`) | `b` | b01–b10 | Plays complete games from the start position, as either colour, against the basic training partner to an (adjudicated) result without frequently leaving material capturable for free; develops pieces by principle |
| Intermediate (`intermediate`) | `i` | i01–i11 | Finds and defends against the standard motifs and mating patterns; plays one opening plan as Red and one as Black into a middlegame; wins elementary endgames from set positions |
| Advanced (`advanced`) | `a` | a01–a10 | Assesses a position in words and acts on it; prefers improving moves when no tactic exists; prepares attacks; defends positionally; handles transitions and practical endgames |
| Expert (`expert`) | `e` | e01–e09 | Calculates branching lines; judges sacrifices; keeps and converts advantages; defends worse positions; holds a repertoire for both colours; reviews own games |
| Master (`master`) | `m` | m01–m09 | Decides in unfamiliar, unlabelled positions; compares plans; switches between attack and defence; passes a multi-game practical assessment and a portfolio review |

49 units, 161 lessons (§10). Lessons per unit vary (2–5) by content, not by quota.

### 3.3 Identifiers (Proposal)

| Thing | Format | Example | Notes |
| --- | --- | --- | --- |
| Unit | level prefix + 2 digits | `b05`, `m09` | No collision with `u1`–`u4`, `u7`–`u15`, `u<n>l<k>`, puzzles `m1-NN`/`m2-NN`/`wm-NN`, `jump-<lessonId>`. Verified: no i18n key in `src/i18n/messages.ts` starts with `[biaem][0-9][0-9]` |
| Lesson | unit + `l` + digit | `b05l2` | Same pattern as today, so i18n keys stay `<lessonId>.<suffix>` |
| Practice exercise | lesson + `-` + 2 digits | `b05l2-04` | New explicit `id` field (today exercises have none) |
| Unit-check item | unit + `-c` + 2 digits | `b05-c07` | Separate pool (03-assessment.md §4) |
| Placement item | `p` + level prefix + `-` + 2 digits | `pi-14` | Placement pools |
| Placement practical task | `p` + level prefix + `-g` + digit | `pb-g1` | Separate from exam pools (03-assessment.md §7) |
| Practical task | unit + `-g` + digit | `b10-g1` | `play` / `review` tasks used for "applied" evidence |
| Level exam | `x` + level prefix | `xb` | 03-assessment.md §6 |
| Misconception | unit + `.m` + digit | `b06.m2` | Tags wrong answers for remediation |

Ids are never reused for different content. Each item carries a `version` integer, incremented on substantive
change (03-assessment.md §3.3).

**Old ids (S1.3 owns the map).** A later migration maps each old completed lesson id to "completed" on its
**successor** lesson(s) of 05-migration.md §3 (the "Completion →" column), never to "mastered" or "applied". Lessons
that only borrow an item, a learn card or a pool position from an old lesson (the "Reuses" lines below) receive no
migrated completion (05-migration.md §2 rule 2, DV1; reconciled in S1.4). Every existing lesson has a successor.

---

## 4. Notation and glossary (Proposal; S1.2 owns them, S1.1 owns board-orientation mechanics)

This breaks the open loop between 04-architecture.md R1 and the earlier U5: **S1.2 decides what learners read**;
S1.1 decides how the board rotates and how a `formatMove` helper renders it.

- **Board labels:** each side's files numbered 1–9 from that side's own right, as on printed boards: Red's numbers
  along Red's edge, Black's along Black's edge; when the learner plays Black the board is rotated and Black's numbers
  are at the bottom.
- **Moves in prompts and explanations:** the traditional per-language notation. English: piece letter + file +
  operator + target, the style also used in 04-architecture.md ("C2=5", "H8+7"; `+` advance, `-` retreat, `=`
  traverse). Vietnamese: the Vietnamese traditional form ("P2-5", "M8.7"; `.` tấn, `/` thoái, `-` bình). The
  exact Vietnamese symbols are to be confirmed by the content reviewer before any text uses them (backlog item S2.3).
- **Piece letters.** English: K General, A Advisor, E Elephant, R Chariot, H Horse, C Cannon, P Soldier. Vietnamese:
  Tg Tướng, S Sĩ, T Tượng, X Xe, M Mã, P Pháo, B Tốt. Tướng and Tượng both start with T, so the General is written
  "Tg" and the Elephant "T"; the Soldier is lettered B (from Binh) because T is taken, while the piece is always
  *named* "Tốt" in text, as in `src/i18n/messages.ts` today. Vietnamese letters are **to confirm against a sourced
  reference** before use.
- **Two identical pieces on one file:** the front/rear piece is marked instead of the file number. English: `+`
  front, `−` rear before the piece letter (e.g. "+C=5"); Vietnamese: `t` (trước) / `s` (sau) after the piece letter
  (e.g. "Pt-5"). Both forms are **to confirm against a sourced reference**.
- **ICCS** stays internal: content JSON (`{ "from": "h2", "to": "e2" }`), tests, validators. Not shown to learners.
  In design documents, scripts and validator output a move is written `from-to` (`h2-e2`), and a stored line's
  shape is written as a **main-line signature**, one character per own move: `.` quiet, `+` check, `x` capture, `X`
  capture with check (05-migration.md §9 command 5; one notation, reconciled in S1.4).
- Notation is taught in `b01l4` and repeated wherever a prompt first uses it. **Unresolved (LX, owner S2.20):** a
  setting to show ICCS coordinates as well.
- **Glossary location (U2, decided in S1.4):** this section is the source until S2.3 moves it to
  `docs/curriculum-upgrade/glossary.md` with the content reviewer's confirmed English names and Vietnamese symbols;
  `src/i18n/messages.ts` uses those names.

**Glossary (names to be confirmed by the content reviewer; the Vietnamese pattern names already exist in
`src/i18n/messages.ts`, Verified for Trùng pháo, Muộn cung, Mã hậu pháo).** Pieces: Tướng/General, Sĩ/Advisor,
Tượng/Elephant, Xe/Chariot, Mã/Horse, Pháo/Cannon, Tốt/Soldier.

| Vietnamese | Chinese | English used in the course | Meaning (legality of example moves Verified, §1) |
| --- | --- | --- | --- |
| Pháo đầu | 中炮 | Central Cannon | Red Cannon to the central file (C2=5, `h2-e2`) |
| Bình phong mã | 屏风马 | Screen Horses | Black develops both Horses toward the centre (`h9-g7`, `b9-c7`) |
| Thuận pháo | 顺炮 | Same-direction Cannons | Black answers C2=5 with C8=5 (`h7-e7`) |
| Nghịch pháo | 列炮 | Opposite-direction Cannons | Black answers C2=5 with C2=5 (`b7-e7`) |
| Tiên nhân chỉ lộ | 仙人指路 | Soldier opening ("Immortal points the way") | Red's third- or seventh-file Soldier one step (e.g. `g3-g4`) |
| Phi tượng | 飞相 | Elephant opening | An Elephant to the central point (e.g. `c0-e2`) |
| Khởi mã | 起马 | Horse opening | A Horse first (e.g. `h0-g2`) |
| Ngọa tào mã | 卧槽马 | Ngọa tào Horse (English name to be confirmed; **not** "palace corner") | A Horse on the point beside the enemy palace from which it checks the General; the current UI title "Palcorner Horse" (`u8l1.title`) must be renamed when `u8l1` is migrated |
| Trùng pháo | 重炮 | Double Cannon | Two Cannons on one line, the front one screening the back one |
| Muộn cung | 闷宫 | Smothered General | Cannon mate where the General's own pieces block it in |
| Mã hậu pháo | 马后炮 | Horse-behind-Cannon | The Horse stands on the line between the Cannon and the enemy General, serving as the Cannon's screen, and covers the General's flight points |
| Song xa | 双车 | Two Chariots | Mate by the two Chariots |

---

## 5. Exercise types

### 5.1 Catalogue

| Type | Status | Behaviour | Answer judged by |
| --- | --- | --- | --- |
| `learn` | **Verified** existing | Board + explanation; optional piece moves or highlighted squares | Not scored |
| `select-squares` | **Verified** existing; **Proposal** to extend | Tap every matching square. Today: a piece's legal moves or a region. Extension: *attacked by side X*, *pieces of side X that are attacked*, *hanging pieces* (attacked and not defended), *pieces that can capture square Y*, *single authored square/piece* ("worst-placed piece") — computed from the rules engine in `src/lessons`, not stored | Exact set |
| `move` | **Verified** existing; **Proposal** to extend | One move toward a goal: `reach`, `any`, `check`, `checkmate`, `defend` (depth 1–3); new `safe` = passes the level's safety guard (03-assessment.md §5.3) | Engine |
| `capture` | **Verified** existing | Best capture by immediate exchange count | Engine |
| `combination` | **Verified** existing | 2–4 own moves against best defence, goal mate or material | Engine (forced) |
| `choice` | **Proposal** | Question about a position, 3–4 options: text, two compared arrows, or "nothing/none". Shuffled with a seed; each option has feedback and, for distractors, a misconception id | Authored key, reviewed |
| `decision` | **Proposal** · **Needs architecture confirmation** (move tables, predicates; 04 §5.3–5.4) | One move where several are reasonable. Classes: **target** (lesson idea), **sound** (good, not the idea), **dubious** (safe, misses objective), **error** (fails the safety guard: allows loss ≥ 2 or mate within the level horizon). Sources: author table, objective predicates, safety guard | §5.3 |
| `line` | **Proposal** · **Needs architecture confirmation** (tree format) | Move tree played from one side; learner nodes accept authored + predicate moves; opponent nodes play main or deviation (seeded in practice, fixed per assessment item). Ends with a summary or hands off to `play` | Tree + guard |
| `play` | **Proposal** · **Needs architecture confirmation** (Worker search, phone cost, adjudication) | Sustained play from a set position or the start position for up to *N* learner moves (or a full game to an adjudicated result) against a training partner (03-assessment.md §5.2) | Rubric |
| `review` | **Proposal** · **Needs architecture confirmation** (post-game analysis) | Look back at a finished game: mark the turning point, play a better move (as `decision`), choose the reason (`choice`) | Engine swing + key |

`choice` is never the only evidence for an outcome about acting; it is paired with `decision`, `line` or `play`.

### 5.2 Assistance levels and ladders (Proposal)

| Level | Name | What the learner gets |
| --- | --- | --- |
| G3 | Demonstrate | `learn` card or worked example; nothing to answer, or a trivial confirmation |
| G2 | Guided | Prompt names the idea; key piece or region highlighted; hints available |
| G1 | Prompted | Prompt names the idea; no highlight; hint ladder on request (1 idea → 2 piece → 3 move), recorded |
| G0 | Independent | Neutral prompt, unfamiliar position, no highlight. Practice may offer a hint (recorded); checks never do |
| TR | Transfer | Skill needed but not announced, new context: other colour, fuller board, inside `line`/`play`, mixed with earlier units |

**Ladder by level** (each lesson follows its level's ladder unless the unit says otherwise):

| Level | Ladder | Lesson size (non-`learn` items) |
| --- | --- | --- |
| Basic, Intermediate | G3 → G2 (2–3) → G1 (2–3) → G0 (1–2) → TR (0–1) | 5–8 |
| Advanced | G3 → G1 (2) → G0 (2–3) → TR (1) | 5–7 |
| Expert | G3 → G1 (1–2) → G0 (2–3) → TR (1) | 4–6 |
| Master | G3 worked example (annotated, with the contrast case) → G0 (3–4, unlabelled, mixed) → TR (1, usually `play`) | 4–5 |

Every unit has at least one TR task (listed in the unit). **Default unit shape:** lessons → unit check
(03-assessment.md §4) → practical task(s) where listed.

### 5.3 Accepting reasonable alternatives (Proposal)

- **Tactical claims** (`move`, `capture`, `combination`): any engine-confirmed move is correct (Verified today:
  `src/lessons/combination.ts` `isWinningMove`).
- **Strategic items** (`decision`, `line`): credit = **target** or **sound**. Authors list known target/sound
  moves; predicates widen "target" to every move achieving the objective; the safety guard marks unlisted
  losing moves **error** with the refutation shown; other unlisted moves are **dubious** ("does not lose anything,
  but does not …") and logged locally for reclassification. A dev-time script lists every guard-passing move of a
  `decision` position so the author classifies or consciously defaults each one (Needs architecture confirmation;
  04 §5.3 proposes complete authored tables, which this spec adopts; the content format uses this spec's four class
  names, mapped to 04's names in 04 §5.3, reconciled in S1.4). The validator fails if a target/sound move
  fails the guard, and requires at least two accepted moves where the objective allows alternatives.
- **Engine score is evidence, not the answer key.** The best material score is not automatically "target"; a
  slightly worse score is not automatically wrong. Feedback states its basis ("keeps your pieces safe for the next 2
  moves and develops the Horse"), never "the engine says".

---

## 6. Difficulty progression (Proposal)

| Lever | Basic | Intermediate | Advanced | Expert | Master |
| --- | --- | --- | --- | --- | --- |
| Hints | G2–G1 in most practice | G1 dominant, G0 at lesson end | G0 dominant | G0; G1 briefly | None after the worked example |
| Unfamiliarity | Few pieces, then full board for safety | Pattern positions, then fuller ones | Full positions from realistic play | Unlike any practice item | Mixed, unlabelled |
| Branching | Single reply | 1–2 authored replies | `line` deviations; best defence | Several defending branches; intermediate moves | Plan comparison |
| Counterplay | Threats to notice (safety routine) | Counter-threats in defence units | Partner plays for counterplay | Pressing partner (03 §5.2) | Attack/defence switches in one task |
| Evaluation | Material counting | Development and activity | Multi-factor assessment + action | Static vs dynamic, compensation | Diagnose without labels |
| Sustained play (learner moves; pilot calibrates) | Short tasks 6–12; full games to an adjudicated result (cap 80) | 10–20 | 12–25 | 15–30 | Multi-game exam |

Lengths are design targets; the architecture review confirms the partner's time per move on a phone (Needs
architecture confirmation). 04 §5.5 measured, on desktop for the 37 moves of a full-board position, ~77 ms for the
material search at d = 2 and ~721 ms at d = 3, against a budget of ≤ ~300 ms per request: partners therefore run at
d = 2 (+ capture quiescence) on full boards, and d = 3 only in positions of ≤ ~12 pieces (03-assessment.md §5.2).

---

## 7. Feedback requirements (all units, Proposal)

1. **Correct:** what the move achieves *here* and the opponent's most important reply. A generic "Well done!" may
   only accompany specific text.
2. **Wrong, engine-refutable:** show the refutation on the board, then one sentence on the error behind it.
3. **Wrong, strategic (`dubious`):** what the move does and what it neglects; at G0 point to the idea without
   giving the move.
4. **Tempting alternative:** every G1/G0 `decision`/`line` item names the most tempting wrong move and why it fails.
5. **Misconception tags:** each misconception below has an id; matching wrong answers are tagged and drive
   remediation (03-assessment.md §4.4). The feedback text listed with each misconception is the requirement the
   author implements for that position.
6. **Assessment items** give feedback only after the answer; prompts never name the motif (03-assessment.md §4.2).
7. **Both languages** carry the same content.

---

## 8. Units

Format per unit: header table → outcomes → lessons → **Guided / Independent / Transfer** (with exercise types) →
**Misconceptions → feedback** → **Assessment** → **Remediation**. "Unit check" = the default check of
03-assessment.md §4.1. **Remediation default** = 03-assessment.md §4.4 (failed objectives' G1/G0 practice and the
misconception's `learn` card, then a new check form); units list only additions. "Reuses" names existing lessons
whose verified positions may be reused as **practice** (S1.3 decides; never as check items; never importing
mastery). Everything in §8 is **Proposal** unless labelled.

### Basic level

#### b01 — Board, notation, setup and the goal
| Level · prerequisites | Basic · none | Strands | **RS** |
| --- | --- | --- | --- |
| Baseline topics | 1 | Colour · perspective | Both (setup for both sides) |
| Reuses | `u1l1` | Practical task | — |

**Outcomes.** Name any point by file and rank and read a move in the course notation (§4); locate river and
palaces; identify every start point for either colour; say who moves first; state how a game is won (checkmate or
stalemate of the opposing General; the General is never captured).

| Lesson | Title | Objective |
| --- | --- | --- |
| b01l1 | Points, files and ranks | Find points; river and palaces |
| b01l2 | Setting up both armies | Every start point, Red and Black; Red moves first, turns alternate |
| b01l3 | How a game ends | Checkmate and stalemate win; the General is not captured; draws exist (b05l3) |
| b01l4 | Reading moves | Each side's file numbers; read and play a written move for both colours |

- **Guided:** `select-squares` (region, start points) with highlights; `learn` on file numbering from each side.
- **Independent:** tap named points without highlights; `move` (`reach`) "play C2=5"-style written moves; `choice`
  "who moves now?".
- **Transfer:** the same tasks as Black on the rotated board (orientation: S1.1).
- **Misconceptions → feedback:** `b01.m1` pieces stand inside squares → highlight the intersections the pieces use.
  `b01.m2` the river blocks every piece → state that only Elephants are stopped and Soldiers change behaviour (b04).
  `b01.m3` the goal is to capture the General → show a checkmate and that the game ends before any capture.
  `b01.m4` stalemate is a draw (Western chess) → state the course ruleset: the stalemated side loses. `b01.m5` Black's
  files are numbered like Red's → show both edge labels and the same file named from each side.
- **Assessment:** unit check, short form (6 items: `choice`, `select-squares`, notation `move`).
- **Remediation:** default.

#### b02 — General, Advisors, Elephants and facing Generals
| Level · prerequisites | Basic · b01 | Strands | **RS**, DE |
| --- | --- | --- | --- |
| Baseline topics | 2 | Colour · perspective | Both · using and defending against the facing rule |
| Reuses | `u1l2`, `u1l3`; learn cards `u4l1#0`, `#1` in b02l2 (05 DV4) | Practical task | — |

**Outcomes.** List legal moves of General, Advisors and Elephants; explain why leaving the Generals facing on an
open file is illegal; use the facing rule to take points from the enemy General; explain the Elephant-eye block and
river limit.

| Lesson | Title | Objective |
| --- | --- | --- |
| b02l1 | The General in its palace | Legal General moves; palace limit |
| b02l2 | Facing Generals | Recognise illegal facing; restrict the enemy General with your own |
| b02l3 | Advisors and Elephants | Legal moves; blocked eye; river limit; defensive role |

- **Guided:** `select-squares` (legal moves) with highlights.
- **Independent:** `select-squares` without highlights; `move` (`reach`) to restrict the enemy General; `choice` "is
  this move legal, and why?".
- **Transfer:** as Black in a fuller position, legality questions mixed across the three pieces.
- **Misconceptions → feedback:** `b02.m1` the General moves diagonally → show the palace lines it may use. `b02.m2`
  Elephants cross the river → mark the river and the Elephant's seven points. `b02.m3` an Elephant jumps a blocked eye
  → mark the eye point and the piece on it. `b02.m4` facing only matters for the side to move → show that the move
  creating the face is the illegal one.
- **Assessment:** unit check (≥ 2 items as Black). **Remediation:** default.

#### b03 — Chariot and Horse
| Level · prerequisites | Basic · b02 | Strands | **RS**, TC |
| --- | --- | --- | --- |
| Baseline topics | 3 | Colour · perspective | Both |
| Reuses | `u2l1`, `u2l2` | Practical task | — |

**Outcomes.** List Chariot and Horse moves and captures, including blocked Horse legs; identify which enemy pieces
a given Chariot or Horse attacks.

| Lesson | Title | Objective |
| --- | --- | --- |
| b03l1 | The Chariot | Lines, captures, blocked lines |
| b03l2 | The Horse and its leg | Moves; the blocked leg; edge Horses |
| b03l3 | What can they take? | Tap every enemy piece a Chariot or Horse attacks, both colours |

- **Guided:** `select-squares` (legal moves) with the leg point highlighted.
- **Independent:** `select-squares` (attacked pieces), `capture`.
- **Transfer:** crowded full-board position as Black: "tap every piece Red's Horses attack".
- **Misconceptions → feedback:** `b03.m1` the Horse jumps like a chess knight → mark the leg point and the moves the
  block removes. `b03.m2` the block is on the landing point → animate the one-step-then-diagonal path. `b03.m3` the
  Chariot jumps a piece → highlight the first piece on the line as the end of its reach.
- **Assessment:** unit check. **Remediation:** default.

#### b04 — Cannon and Soldier
| Level · prerequisites | Basic · b03 | Strands | **RS**, TC |
| --- | --- | --- | --- |
| Baseline topics | 4 | Colour · perspective | Both |
| Reuses | `u3l1`, `u3l2` | Practical task | — |

**Outcomes.** List Cannon moves and captures (exactly one screen to capture, none to move); list Soldier moves
before and after the river; read every piece's moves on a full board.

| Lesson | Title | Objective |
| --- | --- | --- |
| b04l1 | The Cannon and its screen | Moving vs capturing; any piece of either colour is a screen |
| b04l2 | The Soldier before and after the river | Forward only; sideways after crossing; no promotion, no retreat |
| b04l3 | Every piece on a full board | Mixed piece reading, both colours |

- **Guided:** `select-squares` with the screen highlighted.
- **Independent:** `select-squares`, `capture` with Cannon captures.
- **Transfer:** b04l3 full-board `select-squares` as Black ("tap every Red piece that can capture your Horse"),
  mixing all seven piece types.
- **Misconceptions → feedback:** `b04.m1` the Cannon captures with no screen or with two → count the pieces between
  on the board. `b04.m2` the Cannon may jump to an empty point → show that moving needs a clear line. `b04.m3`
  Soldiers move sideways before the river or retreat → mark the river and the allowed steps. `b04.m4` Soldiers
  promote → state that a Soldier never promotes; on the last rank it can only move sideways.
- **Assessment:** unit check. **Remediation:** default.

#### b05 — Check, escaping check, checkmate, stalemate and results
| Level · prerequisites | Basic · b04 | Strands | **RS**, DE |
| --- | --- | --- | --- |
| Baseline topics | 5 | Colour · perspective | Both · giving and escaping check |
| Reuses | `u4l1`, `u4l2`; mate items of `u3l1`, `u3l2` | Practical task | — |

**Outcomes.** Tell check, checkmate and stalemate apart; escape check by every available method (move the General,
capture the checker, block — including a Horse-leg block — and, against a Cannon, adding a second screen or moving
away or capturing the screen; the engine decides legality per position); deliver mate in one; state the course
ruleset and what the app does not adjudicate (03-assessment.md §8).

| Lesson | Title | Objective |
| --- | --- | --- |
| b05l1 | Check and every way out | All escape methods |
| b05l2 | Checkmate | Recognise and deliver mate in one, both colours |
| b05l3 | Stalemate and other results | Stalemate loses; draws; perpetual check is forbidden; app limits |

- **Guided:** `move` (`check`, `any` to escape) with the checking piece highlighted.
- **Independent:** `move` (`checkmate`), `choice` ("check, mate, stalemate or none?"; "which escapes are legal?").
- **Transfer:** escaping check as Black where only one escape keeps material (preview of b06–b08).
- **Misconceptions → feedback:** `b05.m1` a Horse check cannot be blocked → show the leg point and the blocking move.
  `b05.m2` ignore check to capture something big → explain the move is illegal and show the checker. `b05.m3`
  stalemate is a draw → restate the ruleset with the position. `b05.m4` every check is good → show a check that lets
  the General escape to a better point and loses a tempo.
- **Assessment:** unit check, including "not mate" positions. **Remediation:** default.

#### b06 — Threatened, undefended and defended pieces
| Level · prerequisites | Basic · b05 | Strands | **RS**, TC, DE |
| --- | --- | --- | --- |
| Baseline topics | 6 | Colour · perspective | Both · own and enemy weaknesses |
| Reuses | `capture` item `u2l1#3` (defended piece, b06l2 contrast; 05 DV2) | Practical task | — |

**Outcomes.** Mark every attacked piece of a side; tell hanging pieces from defended ones by counting attackers and
defenders; save a threatened piece (move, defend, block, bigger threat); say "nothing is hanging" when true.

| Lesson | Title | Objective |
| --- | --- | --- |
| b06l1 | What is attacked? | Tap all attacked pieces of one side (incl. through a Cannon screen) |
| b06l2 | Defended or hanging? | Count attackers/defenders; a cheaper attacker still wins a defended piece |
| b06l3 | Saving a threatened piece | Four answers to a threat; choose one that keeps everything safe |

- **Guided:** `select-squares` (attacked pieces) with attack lines drawn.
- **Independent:** `select-squares` (hanging), `choice` with a correct-sometimes "none", `move` (`safe`).
- **Transfer:** full board, as Black, right after an animated opponent move.
- **Misconceptions → feedback:** `b06.m1` a defended piece is always safe → show the cheaper attacker's capture and
  the exchange count. `b06.m2` a Cannon behind a piece does not attack → draw the screen line. `b06.m3` a hobbled
  Horse still defends → mark the blocked leg. `b06.m4` a piece pinned to its General still defends → show the illegal
  recapture.
- **Assessment:** unit check. **Remediation:** default, by misconception tag first.

#### b07 — Exchanges and relative material value
| Level · prerequisites | Basic · b06 | Strands | **TC**, RS, PA |
| --- | --- | --- | --- |
| Baseline topics | 7 | Colour · perspective | Both |
| Reuses | — (new; 05 DV3); win-material puzzles linked as optional practice | Practical task | — |

**Outcomes.** Count an exchange with the conventional beginner values (the engine's, Verified `solver.ts:9–17`);
refuse a capture that loses to the recapture; explain with examples why values change with the position (crossed
Soldier, Cannon short of screens, trapped piece — a conventional heuristic whose wording the content reviewer
confirms); choose when trading helps.

| Lesson | Title | Objective |
| --- | --- | --- |
| b07l1 | What pieces are worth | Values as a guide, not a law |
| b07l2 | Counting an exchange | Captures and recaptures; refuse losing captures |
| b07l3 | Should I trade? | Trade when ahead or to remove an attacker; keep an active piece |

- **Guided:** `capture` with the exchange count shown step by step.
- **Independent:** `capture`, `decision` (the best move is not a capture), `choice` ("trade or not, and why").
- **Transfer:** full position as Black where a tempting capture loses to a recapture two moves later.
- **Misconceptions → feedback:** `b07.m1` every capture is good → play out the recapture and show the count. `b07.m2`
  equal trades never matter → show what the trade does to activity or safety. `b07.m3` values are fixed → show the
  position-specific reason; disclose the engine's equal value for crossed Soldiers as a limitation.
- **Assessment:** unit check. **Remediation:** default.

#### b08 — The pre-move safety routine
| Level · prerequisites | Basic · b07 | Strands | **RS**, **DE**, PP |
| --- | --- | --- | --- |
| Baseline topics | 8 | Colour · perspective | Both · own blunders and opponent threats |
| Reuses | — (new) | Practical task | `b08-g1` (`play`, short) |

**Routine (wording reviewed by the content reviewer):** before every move ask (1) *What does the opponent's last
move threaten?* (2) *What are my checks, captures and threats?* (3) *After my move, can the opponent check, capture
something undefended or win material?*

**Outcomes.** Name what an opponent move threatens (or "nothing"); reject a move that leaves material capturable or
allows mate in one; find a safe useful move when there is no tactic; keep playing safely for several moves.

| Lesson | Title | Objective |
| --- | --- | --- |
| b08l1 | What did that move threaten? | Read the opponent's last move |
| b08l2 | Blunder check | Judge an intended move safe or unsafe, and why |
| b08l3 | Safe and useful in a quiet position | Safe *and* improves something |

- **Guided:** `select-squares` (threatened pieces after a shown move) with the moved piece highlighted.
- **Independent:** `choice` (safe/unsafe + reason), `decision` (`safe` guard + predicate "improves a piece"); mostly
  positions with no tactic.
- **Transfer:** `b08-g1`: short `play` (6–12 learner moves) from a simplified position vs `safe-sparring(2)`, rubric R1 70 % + R0 30 %.
- **Misconceptions → feedback:** `b08.m1` only my plan matters → replay the opponent's last move and show its threat.
  `b08.m2` the opponent's move was random → show what it attacks. `b08.m3` checking captures but not checks → show the
  check that wins material. `b08.m4` "safe" means "do nothing" → show a safe move that also develops.
- **Assessment:** unit check with safety-critical items; `b08-g1` for "applied". **Remediation:** default, then
  b08l2 again.

#### b09 — Opening development principles
| Level · prerequisites | Basic · b08 | Strands | **OD**, PA, RS |
| --- | --- | --- | --- |
| Baseline topics | 9 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `b09-g1` (`play` from the start position, first moves) |

**Principles (content reviewer confirms wording and examples):** bring Chariots into play early; develop Horses
toward the centre with free legs; know what a central Cannon threatens and protect the central Soldier; do not move
General or Advisors without reason; move each piece with a purpose; do not grab material at the cost of
development and safety.

**Outcomes.** Say which side is better developed and why; choose a safe developing move; meet the central Cannon's
threat to the central Soldier as Black; play the first moves by principle as either colour without a memorised line.

| Lesson | Title | Objective |
| --- | --- | --- |
| b09l1 | Why develop? | Undeveloped pieces do not fight |
| b09l2 | Get the Chariots out | Activate or prepare a Chariot |
| b09l3 | Meeting the central Cannon | As Black, protect the central Soldier with a developing move |
| b09l4 | First moves by principle, both colours | Short `line`s with deviations |

- **Guided:** `choice` (compare development) with the undeveloped pieces marked.
- **Independent:** `decision` (predicate "develops a back-rank piece" + guard), `line` (both colours, deviations).
- **Transfer:** `b09-g1`, `play` from the start position for the first moves vs `safe-sparring(2)`, rubric R2 + R1
  (if it fails the 03 §5.7 guard: add R0, then a scripted first part with the line-share gate, 03 §5.2).
- **Misconceptions → feedback:** `b09.m1` openings are memorised sequences → explain the purpose of the move and an
  equally good alternative. `b09.m2` move one piece repeatedly to attack early → count developed pieces for both sides
  after the sequence. `b09.m3` the General should step out early → show the open line it creates. `b09.m4` grabbing a
  Soldier is always good → play out the development lead the opponent gains.
- **Assessment:** unit check (≥ 1/4 quiet); `b09-g1` for "applied". **Remediation:** default.

#### b10 — First complete games
| Level · prerequisites | Basic · b09 | Strands | **PP**, RS, OD, DE |
| --- | --- | --- | --- |
| Baseline topics | 10 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `b10-g1` (game as Red), `b10-g2` (game as Black); level exam `xb` |

**Outcomes.** Play a complete game from the start position to a result against the game partner (03-assessment.md §5.2:
`scripted` opening → `pressing(2)`, or `safe-sparring(2)` under fallback F2) as either colour,
applying the safety routine; convert a large material lead into mate in a simplified position; find the move where
material was lost in a finished game and suggest a better one. A "result" is mate, stalemate, or the training
adjudication of 03-assessment.md §5.5 (move cap 80 learner moves, no-capture limit, repetition rules): disclosed to
the learner as a training result, not an official one.

| Lesson | Title | Objective |
| --- | --- | --- |
| b10l1 | A guided game as Red | Coach prompts (safety questions) on every move, fading after the opening |
| b10l2 | A guided game as Black | Same, as Black |
| b10l3 | Finishing a won game | Convert a large lead into mate (simplified start position) |
| b10l4 | Looking back | First `review`: find the material-losing move, play a better one |

- **Guided:** `play` with G2 coach prompts that fade to none.
- **Independent:** `play` (b10l3, conversion, no prompts); `review` of the learner's own game.
- **Transfer:** `b10-g1` and `b10-g2`: full games, no prompts, scored with the `xb` per-game score (03-assessment.md
  §6: result 40 + R1 × 0.4 + R2 × 0.2; under fallback F2: R1 × 0.6 + R2 × 0.2 + R0 × 0.2), pass ≥ 75. Under F2 the
  game result is played out but **not scored** (against `safe-sparring` it shows only safety); F2b adds a scripted
  opening line term if F2 fails the 03 §5.7 guard.
- **Misconceptions → feedback:** `b10.m1` once ahead, the game wins itself → show the opponent's counter-chance in the
  learner's game. `b10.m2` attacking means ignoring threats → point to the move in the game where a threat was
  ignored. `b10.m3` a lost piece means the game is lost → show the drawing/holding chances that remained.
- **Assessment:** unit check, short form (6 items: in-game safety decisions, conversion decisions, one `review`
  item on an authored game) for mastery; `b10-g1`, `b10-g2` and `xb` for "applied".
- **Remediation:** default, plus the review of a failed game assigns b06–b08 items by its mistake categories.

### Intermediate level

#### i01 — Piece activity and coordination
| Level · prerequisites | Intermediate · b10 | Strands | **PA**, OD |
| --- | --- | --- | --- |
| Baseline topics | 11 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `i01-g1` (`play`, improve pieces) |

**Outcomes.** Identify the least active piece of a side; improve it safely; place two pieces so they support each
other; reject an activation that walks into a capture.

| Lesson | Title | Objective |
| --- | --- | --- |
| i01l1 | Active and passive pieces | Activity by mobility and targets, not distance |
| i01l2 | Pieces that work together | Pairs that support; pieces that block each other |
| i01l3 | Activate safely | Contrast: activation that loses material |

- **Guided:** `select-squares` (worst piece) with mobility counts shown.
- **Independent:** `decision` (predicate "chosen piece's mobility rises" + guard), contrast items, mostly quiet.
- **Transfer:** `i01-g1`, `play` vs `pressing(2)` (03-assessment.md §5.2, Plan row; F1 under fallback), rubric R3 (activity predicate) + R1.
- **Misconceptions → feedback:** `i01.m1` active = advanced as far as possible → compare mobility before/after and
  show the piece can be chased. `i01.m2` more attackers is always better → show two pieces blocking each other's lines.
- **Assessment:** unit check. **Remediation:** default.

#### i02 — Forks and pins
| Level · prerequisites | Intermediate · i01 | Strands | **TC**, DE |
| --- | --- | --- | --- |
| Baseline topics | 12 | Colour · perspective | Both · making and avoiding |
| Reuses | `u9l1` | Practical task | — |

**Outcomes.** Win material with a fork by any piece type; recognise pinned pieces (by a Chariot, by facing Generals,
and two pieces on a Cannon line, where moving either leaves one screen — legality engine-verified, wording
reviewed); avoid forks and break pins when defending.

| Lesson | Title | Objective |
| --- | --- | --- |
| i02l1 | Forks | Double attacks by Horse, Chariot, Cannon and Soldier |
| i02l2 | Pins | Pieces that cannot move or leave a line because of the General |
| i02l3 | Defending forks and pins | Avoid fork points; unpin; counter-attack the forker |

- **Guided:** `combination` (`win-material`) with the forking piece highlighted.
- **Independent:** `combination`, `move`; `decision` for defence; contrast where the forker is captured with check.
- **Transfer:** unannounced fork/pin items as Black inside fuller positions and in interleaved check items.
- **Misconceptions → feedback:** `i02.m1` every fork wins → play out the counter-check or capture of the forker.
  `i02.m2` a pinned piece cannot capture at all → show a pinned Chariot capturing along the pin line. `i02.m3` a Cannon
  cannot pin → show the two-piece case and the illegal move.
- **Assessment:** unit check. **Remediation:** default.

#### i03 — Discovered attacks and double check
| Level · prerequisites | Intermediate · i02 | Strands | **TC**, DE |
| --- | --- | --- | --- |
| Baseline topics | 13 | Colour · perspective | Both |
| Reuses | `u9l2`, `u11l1` | Practical task | — |

**Outcomes.** Use a discovered attack (moving a blocker, or creating/removing a Cannon screen); answer a double check
correctly (usually only a General move helps; the engine decides legality, and any exception used in an item is
reviewed); spot and defuse a battery before it fires.

| Lesson | Title | Objective |
| --- | --- | --- |
| i03l1 | Discovered attacks | Moving the front piece; Cannon screens created or removed |
| i03l2 | Double check | Giving it; answering it |
| i03l3 | Defusing a battery | Quiet defence before the discovery |

- **Guided:** `combination` with the battery line drawn.
- **Independent:** `combination`, `move`; `decision` (predicate "battery line blocked or front piece neutralised").
- **Transfer:** as Black, a position where the opponent's battery is the only danger and nothing announces it.
- **Misconceptions → feedback:** `i03.m1` one block or capture answers any double check → show the second checker
  still attacking. `i03.m2` only Chariots make discoveries → show a Cannon screen created by a move.
- **Assessment:** unit check. **Remediation:** default.

#### i04 — Removing defenders, deflection, decoys and overload
| Level · prerequisites | Intermediate · i03 | Strands | **TC** |
| --- | --- | --- | --- |
| Baseline topics | 14 | Colour · perspective | Both |
| Reuses | `u11l2`, `u10l1` | Practical task | — |

**Outcomes.** Remove or deflect a defender to win material or mate; decoy a piece onto a fatal point; exploit an
overloaded defender; reject a sacrifice that does not work.

| Lesson | Title | Objective |
| --- | --- | --- |
| i04l1 | Remove the defender | Capture/exchange the key defender |
| i04l2 | Deflection and decoy | Drive away; lure in |
| i04l3 | Overload | One defender, two jobs |
| i04l4 | When the sacrifice fails | The tempting sacrifice is refuted; play a quiet move |

- **Guided:** `combination` with the defender highlighted.
- **Independent:** `combination` (mate/material), `decision` (i04l4).
- **Transfer:** mixed set as Black where only some positions contain a working sacrifice.
- **Misconceptions → feedback:** `i04.m1` a sacrifice with check must be good → play the refutation. `i04.m2` the
  defender is the nearest piece → show which piece actually guards the target.
- **Assessment:** unit check (≥ 1 item where no sacrifice works). **Remediation:** default.

#### i05 — Cannon mating patterns and their defence
| Level · prerequisites | Intermediate · i04 | Strands | **TC**, DE |
| --- | --- | --- | --- |
| Baseline topics | 15 (split, §9.1) | Colour · perspective | Both · attack and defence |
| Reuses | `u7l1`, `u7l2`, `u7l3` | Practical task | — |

**Outcomes.** Deliver Trùng pháo (Double Cannon), Muộn cung (Smothered General) and Mã hậu pháo (Horse-behind-Cannon)
mates in 1–2 moves; from the defending side, see the pattern one move early and break it.

| Lesson | Title | Objective |
| --- | --- | --- |
| i05l1 | Double Cannon | Pattern, setup, when it fails |
| i05l2 | Smothered General | Trapped by its own pieces |
| i05l3 | Horse behind Cannon | Pattern and setup |
| i05l4 | Defending against Cannon mates | As Black: stop it one move early |

- **Guided:** reused `move`/`combination` items (Red) with pattern pieces highlighted.
- **Independent:** reused items without highlight; new `move` (`defend`) and `decision` as Black.
- **Transfer:** pattern embedded in a fuller position as Black (defend) and as Red (attack), unannounced.
- **Misconceptions → feedback:** `i05.m1` a Cannon checks with no screen → count pieces on the line. `i05.m2` any
  block stops a Cannon check → show the block creating the second Cannon's screen.
- **Assessment:** unit check (≥ 1/3 as defender). **Remediation:** default.

#### i06 — Horse and Chariot mating patterns and their defence
| Level · prerequisites | Intermediate · i05 | Strands | **TC**, DE |
| --- | --- | --- | --- |
| Baseline topics | 15 (split) | Colour · perspective | Both · attack and defence |
| Reuses | `u8l1`–`u8l4` | Practical task | — |

**Outcomes.** Deliver the Ngọa tào Horse, Two-Chariot, Chariot-and-Horse and General-assisted mates; from the
defending side stop the pattern one move early without losing material elsewhere.

| Lesson | Title | Objective |
| --- | --- | --- |
| i06l1 | The Ngọa tào Horse | Pattern and setup |
| i06l2 | Two Chariots | Pattern and setup |
| i06l3 | Chariot and Horse | Pattern and setup |
| i06l4 | The General joins the attack | Facing-Generals support |
| i06l5 | Stop it one move early | As Black: prophylaxis against these patterns |

- **Guided:** reused items (Red) with highlights.
- **Independent:** reused items without highlights; `move` (`defend`, depth 1–2) and `decision` as Black.
- **Transfer:** unannounced pattern positions mixed with i05 patterns, both colours.
- **Misconceptions → feedback:** `i06.m1` the attack needs a check every move → show the quiet move that makes mate
  unstoppable. `i06.m2` defending means moving the General → show the interposition or exchange that holds.
- **Assessment:** unit check (≥ 1/3 as defender). **Remediation:** default.

#### i07 — Tactical defence, exchanges and counter-threats
| Level · prerequisites | Intermediate · i06 | Strands | **DE**, TC |
| --- | --- | --- | --- |
| Baseline topics | 16 | Colour · perspective | Both |
| Reuses | `u9l3`, `u11l3` | Practical task | `i07-g1` (`play`, survive pressure) |

**Outcomes.** Stop one- and two-move threats; defend by exchanging the attacker; answer a threat with a bigger one
when it works; choose the defence that does not create a new weakness.

| Lesson | Title | Objective |
| --- | --- | --- |
| i07l1 | Stop the threat | `defend` |
| i07l2 | Defend by exchange | Trade the attacker |
| i07l3 | Counter-threats | Bigger threat as defence; contrast where it fails |
| i07l4 | Choosing the defence | Several defences work now; one holds later |

- **Guided:** `move` (`defend`) with the threat shown as an arrow.
- **Independent:** `decision`, `combination` from the defender's side (Black).
- **Transfer:** `i07-g1`, `play` as defender vs the hold chain (threat tree → `forcing-attack(2)` → `pressing(2)`, 03-assessment.md §5.2), rubric R5 + R1.
- **Misconceptions → feedback:** `i07.m1` any move stopping the immediate threat is fine → play on to the second
  threat. `i07.m2` counter-attack always beats defence → show the counter-threat that is too slow.
- **Assessment:** unit check; `i07-g1` for "applied". **Remediation:** default.

#### i08 — Central Cannon plans as Red
| Level · prerequisites | Intermediate · i07 (knowledge: b09, i01) | Strands | **OD**, PA |
| --- | --- | --- | --- |
| Baseline topics | 17 | Colour · perspective | **Red only** (colour exception, rule 2: the topic is Red's opening; i09 is its Black counterpart) |
| Reuses | — (new) | Practical task | `i08-g1` (`line` → `play`) |

**Content (names and plans confirmed by the content reviewer).** The Central Cannon (Pháo đầu, C2=5, `h2-e2`)
pressures Black's central Soldier and the central file; Red develops the Horses and a Chariot. Black's **main**
reply taught is the Screen Horses (Bình phong mã); **other replies** taught as deviations: Same-direction Cannons
(Thuận pháo, `h7-e7`) and Opposite-direction Cannons (Nghịch pháo, `b7-e7`) (legality Verified, §1). Lines stay short,
every move with its purpose.

**Outcomes.** As Red, explain what the Central Cannon threatens and costs; continue development with purpose against
each taught reply; recognise when capturing the central Soldier early is not worth it (position-specific,
reviewed); choose a middlegame aim at the end of the line.

| Lesson | Title | Objective |
| --- | --- | --- |
| i08l1 | Why the Central Cannon? | Purpose, threats, costs |
| i08l2 | Against the Screen Horses | Develop Horses and Chariots behind the Cannon |
| i08l3 | Against other replies | Same- and opposite-direction Cannons, other tries |
| i08l4 | Where the plan leads | Middlegame aims; quiet positions |

- **Guided:** `learn` + `line` with each move's purpose shown.
- **Independent:** `line` with seeded deviations; `decision`; `choice` (which aim fits this position).
- **Transfer:** `i08-g1`, `line` then `play` (`scripted` → `pressing(2)`; F5 under fallback, 03-assessment.md §5.2), rubrics R6 + R1.
- **Misconceptions → feedback:** `i08.m1` the opening is a fixed sequence → show a deviation and the same plan
  continuing. `i08.m2` always take the central Soldier at once → play out the reviewed line where Black gains time.
  `i08.m3` the Cannon alone makes an attack → count attackers vs defenders on the central file.
- **Assessment:** unit check (deviations in at least half the `line` items). **Remediation:** default.

#### i09 — Screen Horses defence plans as Black
| Level · prerequisites | Intermediate · i08 | Strands | **OD**, DE |
| --- | --- | --- | --- |
| Baseline topics | 18 | Colour · perspective | Black only (counterpart of i08) |
| Reuses | — (new) | Practical task | `i09-g1` (`line` → `play` as Black) |

**Outcomes.** As Black against the Central Cannon, explain why both Horses protect the centre and palace; develop
Chariots and Elephants with purpose; create counterplay (specific ideas confirmed by the content reviewer); keep
the plan when Red deviates.

| Lesson | Title | Objective |
| --- | --- | --- |
| i09l1 | Why the Screen Horses? | Purpose and structure |
| i09l2 | Developing the rest | Chariots, Elephants, Cannons |
| i09l3 | Black's counterplay | Active ideas, not only defence |
| i09l4 | When Red deviates | Early Chariot pressure and other tries |

- **Guided:** `learn` + `line` with purposes.
- **Independent:** `line` with Red deviations; `decision`.
- **Transfer:** `i09-g1` as Black (`scripted` → `pressing(2)`; F5 under fallback, 03-assessment.md §5.2), rubrics R6 + R1.
- **Misconceptions → feedback:** `i09.m1` Black only defends → show the counter-chance in the line. `i09.m2` the Horses
  must never move again → show a reviewed position where a Horse move is the plan.
- **Assessment:** unit check (all items as Black). **Remediation:** default.

#### i10 — Elementary endgames and General/Soldier activity
| Level · prerequisites | Intermediate · i09 (knowledge: i07) | Strands | **DE**, PA |
| --- | --- | --- | --- |
| Baseline topics | 19 | Colour · perspective | Both · winning and holding |
| Reuses | — (new; the few-piece mates of `u4l2` stay in b05l2, 05 DV5) | Practical task | `i10-g1` (`play`, convert) |

**Outcomes.** Use the General actively; win elementary endgames from set positions against best defence (each win
verified by the forced-win search for that exact position); restrict the enemy General with Soldiers and General.
General theory ("this material always wins/draws") only with a cited, reviewed source (S1.3).

| Lesson | Title | Objective |
| --- | --- | --- |
| i10l1 | The General as a fighter | Active General; facing rule in endgames |
| i10l2 | Soldiers and the bare General | Verified elementary wins |
| i10l3 | The Chariot finishes | Chariot (+ General) mates against few defenders |
| i10l4 | Restrict first | Quiet restricting moves before mating |

- **Guided:** `combination` (checkmate) with the General's flight points marked.
- **Independent:** `decision` (predicate: enemy General's legal moves fall; guard), `combination`.
- **Transfer:** `i10-g1`, `play` vs the convert chain (counterplay tree → `forcing-attack` → `pressing`; F1c under
  fallback, 03-assessment.md §5.2), rubric R4.
- **Misconceptions → feedback:** `i10.m1` the General must hide in endgames → show the point it controls. `i10.m2`
  checking is the fastest way to mate → show a check that releases the General and the quiet move that does not.
- **Assessment:** unit check; `i10-g1`. **Remediation:** default.

#### i11 — From opening to middlegame
| Level · prerequisites | Intermediate · i10 (knowledge: i08, i09) | Strands | **PA**, **OD**, PP |
| --- | --- | --- | --- |
| Baseline topics | 20 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `i11-g1` (Red), `i11-g2` (Black); level exam `xi` |

**Outcomes.** Tell when development is complete enough; pick a target from features of the position; play from the
end of an opening line into the middlegame as either colour with a consistent plan, safely.

| Lesson | Title | Objective |
| --- | --- | --- |
| i11l1 | Is development finished? | Checklist: Chariots active, Horses out, General safe |
| i11l2 | Choosing a target | Target from features |
| i11l3 | Into the middlegame as Red | `line` → `play` |
| i11l4 | Into the middlegame as Black | `line` → `play` |

- **Guided:** `choice` (checklist) with features marked.
- **Independent:** `decision` (target predicate), `line`.
- **Transfer:** `i11-g1`, `i11-g2` (`scripted` → `pressing(2)`; F5 under fallback, R3 then with own-side predicates
  only, 03-assessment.md §5.2), rubrics R6 + R3 + R1.
- **Misconceptions → feedback:** `i11.m1` attack as soon as possible → show the undeveloped piece that is missing
  from the attack. `i11.m2` a plan is a fixed list of moves → show the plan surviving a different opponent move.
- **Assessment:** unit check; `i11-g1`, `i11-g2`; Intermediate exam `xi`. **Remediation:** default.

### Advanced level

#### a01 — Position assessment
| Level · prerequisites | Advanced · i11 | Strands | **PA** |
| --- | --- | --- | --- |
| Baseline topics | 21 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | — |

**Checklist (reviewer confirms):** material; General safety (palace defenders, open lines toward the palace);
activity and coordination; Soldier structure; who has threats and initiative. **Limit:** the engine evaluates
material only (Verified), so every answer key is authored and reviewed; an engine score is never the key.

**Outcomes.** Say which side is better and the main reason in positions with equal material; recognise when a
material lead is outweighed by safety or activity (reviewed examples); assess the same position from both sides.

| Lesson | Title | Objective |
| --- | --- | --- |
| a01l1 | Material and safety | The two deciding factors at this stage |
| a01l2 | Activity and structure | The slower factors |
| a01l3 | Who is better, and why? | Combine factors; contrast positions |
| a01l4 | Same position, other side | Assess as Red and as Black |

- **Guided:** `choice` (verdict + reason) with the factor highlighted.
- **Independent:** `choice` paired with `decision` "act on your assessment".
- **Transfer:** assess, then play 6–8 moves of `play` from the same position (as Black), rubric R3 (the plan the
  learner chose is the predicate set offered in the `choice`).
- **Misconceptions → feedback:** `a01.m1` more material = better → show the safety factor that decides. `a01.m2` the
  side to move is always better → show a position where moving first does not help. `a01.m3` one factor decides
  everything → show a factor that changes the verdict.
- **Assessment:** unit check pairs each verdict with an action item. **Remediation:** default.

#### a02 — Candidate moves and opponent responses
| Level · prerequisites | Advanced · a01 | Strands | **TC**, PA |
| --- | --- | --- | --- |
| Baseline topics | 22 | Colour · perspective | Both |
| Reuses | `u10l3`, `u12l1`, `u12l2` (forcing-line practice) | Practical task | — |

**Outcomes.** List several candidates (forcing first); predict the opponent's best reply; reject a candidate that
fails to one reply.

| Lesson | Title | Objective |
| --- | --- | --- |
| a02l1 | Find the candidates | Pick 2–3 candidates from a set |
| a02l2 | What will they play? | Play the opponent's best reply ("move as the other side") |
| a02l3 | Forcing lines | Checks, captures, threats to the end |
| a02l4 | The candidate that fails | The natural move loses to one reply |

- **Guided:** `choice` (multi-select candidates) with forcing moves marked.
- **Independent:** `move` played as the opponent, `combination`, `decision`.
- **Transfer:** unannounced positions mixing forcing and quiet answers, as Black, where the natural candidate fails.
- **Misconceptions → feedback:** `a02.m1` the first good-looking move is enough → show the reply that refutes it.
  `a02.m2` the opponent will play the expected reply → show their stronger option.
- **Assessment:** unit check (candidate `choice` scored only with its paired move item). **Remediation:** default.

#### a03 — Improving poorly placed pieces
| Level · prerequisites | Advanced · a02 | Strands | **PA** |
| --- | --- | --- | --- |
| Baseline topics | 23 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `a03-g1` (`play`, re-route a piece) |

**Outcomes.** Find the worst-placed piece; plan a 2–3 move route; prefer that improvement to a premature attack the
guard refutes or the reviewed explanation shows to achieve nothing (pilot candidate).

| Lesson | Title | Objective |
| --- | --- | --- |
| a03l1 | The worst piece | Identify it and say why |
| a03l2 | Routes | Plan and play a re-route |
| a03l3 | Improve instead of attack | The attack fails, the improvement works |

- **Guided:** `select-squares` (worst piece) with mobility shown.
- **Independent:** `line` (re-route vs authored replies), `decision`.
- **Transfer:** `a03-g1`, `play` vs `pressing(2)` (03-assessment.md §5.2, Plan row; F1 under fallback), rubric R3 + R1.
- **Misconceptions → feedback:** `a03.m1` every move must threaten something → show the attack's refutation and the
  improvement's later benefit. `a03.m2` a piece is "placed" once it has moved → show its mobility is still low.
- **Assessment:** unit check; `a03-g1`. **Remediation:** default.

#### a04 — Open files, ranks and invasion points
| Level · prerequisites | Advanced · a03 | Strands | **PA**, TC |
| --- | --- | --- | --- |
| Baseline topics | 24 | Colour · perspective | Both · invading and denying |
| Reuses | — (new) | Practical task | — |

**Outcomes.** Occupy and contest open files and useful ranks with Chariots; identify invasion points near the enemy
palace; deny them as the defender.

| Lesson | Title | Objective |
| --- | --- | --- |
| a04l1 | Open files | Take and contest |
| a04l2 | Ranks | Lateral Chariot activity |
| a04l3 | Invasion points | Where pieces hurt the palace |
| a04l4 | Closing the door | Deny invasion |

- **Guided:** `decision` (predicate "file occupied") with open files marked.
- **Independent:** `decision`, `choice`, `line`.
- **Transfer:** `line` from an opening-derived position as Black where the right plan is to deny an invasion point.
- **Misconceptions → feedback:** `a04.m1` the first Chariot on a file owns it → show the opponent doubling. `a04.m2`
  invade as soon as possible → show the invader trapped or exchanged.
- **Assessment:** unit check. **Remediation:** default.

#### a05 — Soldier structures, breaks and weaknesses
| Level · prerequisites | Advanced · a04 | Strands | **PA**, DE |
| --- | --- | --- | --- |
| Baseline topics | 25 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | — |

**Outcomes.** Explain the role of central and linked Soldiers; time an advance that opens a line or frees a piece;
identify undefended Soldiers and the points they no longer cover; explain why a crossed Soldier is worth more than
the engine's value (disclosed limitation, Verified).

| Lesson | Title | Objective |
| --- | --- | --- |
| a05l1 | What Soldiers do | Block, support, control |
| a05l2 | Soldier breaks | Advances that open lines; when premature |
| a05l3 | Weaknesses | Undefended Soldiers and holes |
| a05l4 | The crossed Soldier | Value in middlegame and endgame |

- **Guided:** `choice` with Soldier-controlled points marked.
- **Independent:** `decision`, `line` (contrast: premature, irreversible advance).
- **Transfer:** `line` as Black where the opponent's Soldier advance must be answered by occupying the hole it left.
- **Misconceptions → feedback:** `a05.m1` advancing Soldiers is always progress → show the hole left behind.
  `a05.m2` Soldiers are not worth defending → show the line opened after a Soldier falls.
- **Assessment:** unit check. **Remediation:** default.

#### a06 — Preparing attacks before a combination exists
| Level · prerequisites | Advanced · a05 (knowledge: i06) | Strands | **PA**, TC |
| --- | --- | --- | --- |
| Baseline topics | 26 | Colour · perspective | Both |
| Reuses | `u10l2`, `u12l3` (finishing examples) | Practical task | `a06-g1` (`play`, build an attack) |

**Outcomes.** Bring more attackers than defenders; exploit weakened palace defences; play a quiet move that creates a
real threat (Needs architecture confirmation: "threat" = with the same side to move again, a forced win or gain ≥ 2
within the horizon, on a legal position); recognise when the attack is not ready.

| Lesson | Title | Objective |
| --- | --- | --- |
| a06l1 | More attackers than defenders | Count and add |
| a06l2 | Weakening the palace | Target the defenders |
| a06l3 | The quiet threat | Threaten without checking |
| a06l4 | Not yet | Premature attack; improve or defend first |

- **Guided:** `decision` with attackers/defenders counted on the board.
- **Independent:** `decision` (threat predicate), `combination` (finishing).
- **Transfer:** `a06-g1`, `play` vs `pressing(2)` (03-assessment.md §5.2, Plan row: the learner attacks, the partner defends; F1 under fallback), rubric R3 + R1.
- **Misconceptions → feedback:** `a06.m1` attacking means checking → show the check that drives the General to safety.
  `a06.m2` no combination means nothing to do → show the quiet move after which a combination appears.
- **Assessment:** unit check; `a06-g1`. **Remediation:** default.

#### a07 — Positional defence and counterplay
| Level · prerequisites | Advanced · a06 | Strands | **DE**, PA |
| --- | --- | --- | --- |
| Baseline topics | 27 | Colour · perspective | Both (≥ half as Black) |
| Reuses | two pool items of `u11l3` | Practical task | `a07-g1` (`play`, defend and counter) |

**Outcomes.** Stop an opponent's plan before it becomes tactical; exchange the best attacker; create counterplay
elsewhere; defend as Black under Central Cannon pressure.

| Lesson | Title | Objective |
| --- | --- | --- |
| a07l1 | Prophylaxis | What does the opponent want? Stop it |
| a07l2 | Trade the best attacker | Defensive exchanges |
| a07l3 | Counterplay | Threats on the other side |
| a07l4 | Under pressure as Black | Full opening-derived position |

- **Guided:** `decision` with the opponent's plan shown as arrows.
- **Independent:** `decision`, `move` (`defend`, depth 2).
- **Transfer:** `a07-g1`, `play` vs the hold chain (03-assessment.md §5.2), rubric R5 (with counterplay predicate) + R1.
- **Misconceptions → feedback:** `a07.m1` defence means passivity → show the passive move losing to the plan and the
  active one holding. `a07.m2` defend only when the threat is immediate → show the plan two moves later.
- **Assessment:** unit check; `a07-g1`. **Remediation:** default.

#### a08 — Exchanges and phase transitions
| Level · prerequisites | Advanced · a07 | Strands | **PA**, DE |
| --- | --- | --- | --- |
| Baseline topics | 28 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | — |

**Outcomes.** Choose exchanges that help (simplify when ahead, remove attackers when defending); compare the endgames
two choices lead to, where verified for the exact positions or sourced; keep pieces when winning chances need them.

| Lesson | Title | Objective |
| --- | --- | --- |
| a08l1 | Which trades help? | By material balance and initiative |
| a08l2 | Choosing the endgame | Compare resulting endgames |
| a08l3 | Keep the pieces | When trading kills winning chances |

- **Guided:** `choice` showing both resulting positions side by side.
- **Independent:** `decision`, `choice`.
- **Transfer:** a `play` continuation (8–10 moves, both colours alternating by item) where one exchange offer must be
  accepted and a later one refused; scored as a practice item, rubric R4.
- **Misconceptions → feedback:** `a08.m1` trade whenever possible when ahead → show the drawish endgame it leads to
  (only verified/sourced claims). `a08.m2` more material always wins the endgame → same evidence rule.
- **Assessment:** unit check. **Remediation:** default.

#### a09 — Practical Chariot, Horse and Cannon endgames
| Level · prerequisites | Advanced · a08 (knowledge: i10) | Strands | **DE** |
| --- | --- | --- | --- |
| Baseline topics | 29 | Colour · perspective | Both · winning and holding |
| Reuses | — (new) | Practical task | `a09-g1` (convert), `a09-g2` (hold) |

**Outcomes.** Convert Chariot, Horse and Cannon endgames from set positions against best defence (wins proved for the
exact position within the search limits of 04-architecture.md); use Advisors, Elephants or Soldiers as Cannon
screens; hold a worse endgame for the task's move cap.

**Author note (chess accuracy):** the own General can never be the screen for a Cannon check along a file — the two
Generals would face each other unless another piece stands between them, which would make two screens. Items must
not suggest otherwise.

| Lesson | Title | Objective |
| --- | --- | --- |
| a09l1 | Chariot endgames | Technique and typical setups |
| a09l2 | Horse endgames | Horse with Soldiers |
| a09l3 | Cannon endgames | Finding screens |
| a09l4 | Defending with less | Holding technique |

- **Guided:** `combination` with key points marked.
- **Independent:** `combination`, `decision`, `play` vs the convert/hold chains (depth 3 allowed: ≤ ~12 pieces).
- **Transfer:** `a09-g1` (R4), `a09-g2` (R5 with holding predicate) as Black.
- **Misconceptions → feedback:** `a09.m1` a Cannon is strong on an empty board → show the missing screens. `a09.m2`
  more material always wins → only verified/sourced examples. "Draw" is never claimed from search alone; holding
  tasks say "hold for N moves" (03-assessment.md §8).
- **Assessment:** unit check; `a09-g1`, `a09-g2`. **Remediation:** default.

#### a10 — Annotated games connecting all phases
| Level · prerequisites | Advanced · a09 | Strands | **PP**, PA, OD, DE |
| --- | --- | --- | --- |
| Baseline topics | 30 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `a10-g1` (`review` of own exam game); level exam `xa` |

**Outcomes.** Follow an annotated game and predict key moves at its turning points (opening plan → middlegame target
→ transition → endgame); explain each turning point; apply the same questions to own games.

| Lesson | Title | Objective |
| --- | --- | --- |
| a10l1 | Annotated game as Red | Predict-the-move at turning points |
| a10l2 | Annotated game as Black | Same, as Black |
| a10l3 | Your game, annotated | `review` of own game |

- **Guided:** `line` (predict-the-move, acceptance as `decision`) with the phase named before each turning point.
- **Independent:** the same on a second game without phase labels; `choice` for the reason.
- **Transfer:** `a10-g1`, `review` of the learner's own `xa` game (rubric R7).
- **Misconceptions → feedback:** `a10.m1` games are decided by one brilliant move → show the earlier quiet decisions
  that made it possible. `a10.m2` the opening and endgame are separate subjects → show how the opening plan decided
  which endgame arose.
- **Assessment:** unit check (unseen turning points from a different game); `a10-g1`; `xa`. **Remediation:** default.
- **Source of games:** course games only (07-sourcing.md §3.2, option A); historical games only after the owner
  decides 07 S07-U1 (§11 U1).

### Expert level

#### e01 — Branching calculation and intermediate moves
| Level · prerequisites | Expert · a10 | Strands | **TC** |
| --- | --- | --- | --- |
| Baseline topics | 31 | Colour · perspective | Both · attacker and defender |
| Reuses | `u13l2`, `u13l3`, `u14l*`, `u15l1`, `u15l2`, mate-in-4 items of `u15l3` (calculation practice and pool; `u12l*` go to a02/a06, 05 DV6, DV8) | Practical task | — |

**Outcomes.** Calculate lines where the defender has several replies; find and use intermediate moves for both
sides; refute an opponent's combination.

| Lesson | Title | Objective |
| --- | --- | --- |
| e01l1 | Every reply counts | Practice varies the defence so several branches are met |
| e01l2 | Intermediate moves | A forcing move before the expected recapture |
| e01l3 | Long forcing lines | Mate in 3–4 (reused) |
| e01l4 | Refute their combination | As defender, find the hole |

- **Guided:** `combination` with the branch point announced ("Black has two defences").
- **Independent:** `combination` with varied defence (Needs architecture confirmation), `decision`, `move` as defender.
- **Transfer:** as Black, the opponent starts a combination inside a quiet-looking position; find the intermediate move.
- **Misconceptions → feedback:** `e01.m1` the opponent must recapture → show the intermediate move. `e01.m2` calculation
  stops at the first check → show the branch after it.
- **Assessment:** unit check (independent pool only; no reused positions). **Remediation:** default.

#### e02 — Sound sacrifices and compensation
| Level · prerequisites | Expert · e01 | Strands | **TC**, PA |
| --- | --- | --- | --- |
| Baseline topics | 32 | Colour · perspective | Both |
| Reuses | two guided warm-up items of `u10l1` in e02l1, no migrated completion (05 DV7) | Practical task | — |

**Outcomes.** Play forced sacrifices (verified); judge non-forced sacrifices with reviewed examples only (the
material-only engine cannot prove compensation, Verified limit); accept and refute unsound sacrifices.

| Lesson | Title | Objective |
| --- | --- | --- |
| e02l1 | Sacrifices that force | Mate or material back by force |
| e02l2 | Paying for the initiative | Reviewed, non-forced examples; claims limited |
| e02l3 | Taking the bait safely | Refute unsound sacrifices |

- **Guided:** `combination` with the sacrificed piece marked.
- **Independent:** `combination`, `choice`, `decision`.
- **Transfer:** mixed set as Black: accept or decline offered material; only some offers are sound.
- **Misconceptions → feedback:** `e02.m1` every sacrifice near the General works → play the refutation. `e02.m2` never
  accept a sacrifice → show the sacrifice that simply loses.
- **Assessment:** unit check (≥ 1 unsound-sacrifice item). **Remediation:** default.

#### e03 — Initiative, tempo and switching targets
| Level · prerequisites | Expert · e02 | Strands | **PA**, TC |
| --- | --- | --- | --- |
| Baseline topics | 33 + 34 (merged, §9.1) | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `e03-g1` (`play`, keep the initiative) |

**Outcomes.** Gain time with threats; decide when to keep pressure or cash in; create a second target; switch wings.

| Lesson | Title | Objective |
| --- | --- | --- |
| e03l1 | Moves with tempo | Develop/improve with a threat |
| e03l2 | Keep it or cash it | When the initiative fades |
| e03l3 | Two targets | Overstretch the defence |
| e03l4 | Switch the attack | Change wing |

- **Guided:** `decision` with the threat each move creates shown.
- **Independent:** `decision`, `line`.
- **Transfer:** `e03-g1`, `play` vs `pressing(2)` (03-assessment.md §5.2, Plan row; F1 under fallback), rubric R3 + R4.
- **Misconceptions → feedback:** `e03.m1` checks keep the initiative best → show a check that lets the defence
  regroup. `e03.m2` an attack must succeed where it started → show the second target.
- **Assessment:** unit check; `e03-g1`. **Remediation:** default.

#### e04 — Active defence
| Level · prerequisites | Expert · e03 | Strands | **DE** |
| --- | --- | --- | --- |
| Baseline topics | 35 | Colour · perspective | Both (≥ half as Black) |
| Reuses | `u13l1`, defend-3 item of `u15l3` | Practical task | `e04-g1` (`play`, hold under attack) |

**Outcomes.** Find the only move; defend by counter-attack; return material to break an attack; hold under a prepared
attack for the move cap.

| Lesson | Title | Objective |
| --- | --- | --- |
| e04l1 | The only move | `defend` depth 2–3 (reused) |
| e04l2 | Counter-attack as defence | Threats that stop the attack |
| e04l3 | Give it back | Return material |
| e04l4 | Hold the fort | `play` as defender |

- **Guided:** `move` (`defend`) with the threat shown.
- **Independent:** `decision`, `move` (`defend`).
- **Transfer:** `e04-g1`, rubric R5 (counterplay predicate) + R1, hold chain (03-assessment.md §5.2).
- **Misconceptions → feedback:** `e04.m1` keep all material at any cost → show the attack continuing. `e04.m2` passive
  defence is safest → show the passive move losing.
- **Assessment:** unit check; `e04-g1`. **Remediation:** default.

#### e05 — Static versus dynamic advantages
| Level · prerequisites | Expert · e04 | Strands | **PA** |
| --- | --- | --- | --- |
| Baseline topics | 36 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | — |

**Outcomes.** Classify an advantage as static or dynamic; choose a plan that fits; turn a dynamic advantage into a
static one before it fades.

| Lesson | Title | Objective |
| --- | --- | --- |
| e05l1 | Two kinds of advantage | Classify with reasons |
| e05l2 | Play to your advantage | Match plan to advantage |
| e05l3 | Cash in | Dynamic into static |

- **Guided:** `choice` with the advantage's features listed.
- **Independent:** `choice` paired with `decision`, `line`. Keys authored and reviewed (material-only engine).
- **Transfer:** a `play` continuation (8–12 moves) where a dynamic edge fades unless cashed in; rubric R4 measures
  material at the end vs start.
- **Misconceptions → feedback:** `e05.m1` only material counts → show the attack that outweighs it. `e05.m2` activity
  lasts forever → show the opponent consolidating.
- **Assessment:** unit check. **Remediation:** default.

#### e06 — Converting advantages while restricting counterplay
| Level · prerequisites | Expert · e05 (knowledge: a09) | Strands | **DE**, **PA** |
| --- | --- | --- | --- |
| Baseline topics | 37 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `e06-g1` (Red), `e06-g2` (Black) |

**Outcomes.** When ahead, remove counterplay first and then advance; simplify into a verified won endgame; convert as
either colour against the convert chain (counterplay tree → `forcing-attack(2)` → `pressing(2)`, 03-assessment.md §5.2) within
the cap.

| Lesson | Title | Objective |
| --- | --- | --- |
| e06l1 | Safety first when ahead | Prophylaxis before progress |
| e06l2 | Simplify to win | Trades into verified won endgames |
| e06l3 | Converting as Black | Other colour |

- **Guided:** `decision` with the opponent's counter-chances shown.
- **Independent:** `decision`, `play` (short).
- **Transfer:** `e06-g1`, `e06-g2` vs the convert chain (03-assessment.md §5.2; F1c under fallback), rubric R4.
- **Misconceptions → feedback:** `e06.m1` when ahead, attack immediately → show the counter-attack it allows. `e06.m2`
  the opponent has nothing left → show their remaining threat.
- **Assessment:** unit check; `e06-g1`, `e06-g2`. **Remediation:** default.

#### e07 — Defending inferior positions and drawing resources
| Level · prerequisites | Expert · e06 | Strands | **DE** |
| --- | --- | --- | --- |
| Baseline topics | 38 | Colour · perspective | Both (≥ half as Black) |
| Reuses | — (new) | Practical task | `e07-g1` (`play`, hold) |

**Outcomes.** Keep a worse position together; use defensive setups verified for the exact position (hold for the cap)
or sourced as theoretical draws; explain which repetitions are legal draws and which are forbidden, and what the app
adjudicates (03-assessment.md §8).

| Lesson | Title | Objective |
| --- | --- | --- |
| e07l1 | Hold together | Practical defence when down material |
| e07l2 | Defensive setups | Only verified or sourced setups |
| e07l3 | Repetition: resource and limits | Ruleset lesson with app limits disclosed |

- **Guided:** `decision` with the defensive setup's points marked.
- **Independent:** `decision`, `choice` (rules), `play` (holding, short).
- **Transfer:** `e07-g1` as Black vs the hold chain (03-assessment.md §5.2), rubric R5 (holding predicate).
- **Misconceptions → feedback:** `e07.m1` when worse, only passivity holds → show the active defensive move that
  trades an attacker. `e07.m2` repeating moves always draws → state the perpetual check/chase rules and the app's
  training limit. `e07.m3` a position is lost once material is down → show the verified holding setup.
- **Scope note:** the engine cannot prove a draw (Verified). "Verified drawing resources" is narrowed to "holds for
  the stated cap against the strongest training partner, or a sourced theoretical draw" — recorded, not dropped.
- **Assessment:** unit check; `e07-g1`. **Remediation:** default.

#### e08 — A practical opening repertoire for both colours
| Level · prerequisites | Expert · e07 (knowledge: i11, e03) | Strands | **OD**, PA |
| --- | --- | --- | --- |
| Baseline topics | 39 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `e08-g1` (Red), `e08-g2` (Black) |

**Outcomes.** Play one repertoire as Red (Central Cannon plan against the main replies) and as Black (a plan against
the Central Cannon and against the Elephant, Soldier and Horse openings — names in §4, legality Verified); explain
each repertoire move's purpose and its middlegame; handle deviations by principle.

| Lesson | Title | Objective |
| --- | --- | --- |
| e08l1 | Repertoire as Red | Central Cannon vs main replies |
| e08l2 | As Black against the Central Cannon | Screen Horses and one alternative |
| e08l3 | Black against other first moves | Elephant, Soldier, Horse openings |
| e08l4 | Testing the repertoire | Random deviations, then `play` |

- **Guided:** `line` with purposes shown.
- **Independent:** `line` with seeded deviations not seen in guided items.
- **Transfer:** `e08-g1`, `e08-g2` (`scripted` → `pressing(2)`; F5 under fallback, 03-assessment.md §5.2), rubric R6 + R1.
- **Misconceptions → feedback:** `e08.m1` a repertoire is a list to memorise → show the plan that survives a deviation.
  `e08.m2` a deviation must be punished at once → show the sound developing reply.
- **Assessment:** unit check (deviations not met in practice). **Remediation:** default.

#### e09 — Independent analysis of personal games
| Level · prerequisites | Expert · e08 | Strands | **PP** |
| --- | --- | --- | --- |
| Baseline topics | 40 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `e09-g1` (`review`); level exam `xe` |

**Outcomes.** Find the turning points of own games (engine-detectable swings); propose a better move at each; classify
the mistake (missed threat, missed tactic, plan, technique); build a training plan from the categories the app detects.

| Lesson | Title | Objective |
| --- | --- | --- |
| e09l1 | Find the turning point | Locate swings |
| e09l2 | Name the mistake | Tactical categories scored; positional ones self-reported |
| e09l3 | A training plan | Choose units to revisit |

- **Guided:** `review` of an authored game with the swing moves marked.
- **Independent:** `review` of an authored game without marks; then of own games.
- **Transfer:** `e09-g1`, `review` of an own `play` game (rubric R7).
- **Misconceptions → feedback:** `e09.m1` the losing move is the last mistake → show the earlier swing. `e09.m2` the
  engine's best move is the only improvement → show a second accepted improvement. `e09.m3` mistakes are bad luck → link
  the category to the unit that trains it.
- **Assessment:** unit check, short form (6 `review`/`choice` items on unseen authored games) for mastery; `e09-g1`,
  `xe` for "applied". **Remediation:** default.

### Master level

All Master items follow the Master ladder (§5.2: worked example → unlabelled G0 → TR), mix colours and are prompted
neutrally (03-assessment.md §4.2). Each lesson lists **Items** (types), **Positions must show**, and **Success**.

#### m01 — Diagnosing unfamiliar positions without motif labels
| Level · prerequisites | Master · e09 | Strands | **PA**, **TC** |
| --- | --- | --- | --- |
| Baseline topics | 41 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | — |

**Outcomes.** In unlabelled positions decide what kind of position it is (tactical, quiet, defensive, endgame) and
act accordingly.

| Lesson | Title | Objective |
| --- | --- | --- |
| m01l1 | What kind of position? | Classify, then act |
| m01l2 | Mixed decisions | Act without labels |

- **m01l1 Items:** `choice` (kind of position) always paired with `decision`/`combination` on the same position.
  **Positions must show:** a full-board middlegame or endgame drawn from realistic structures; about a third tactical,
  a third quiet, a third defensive/endgame; never a practice position. **Success:** pair credited only if both parts
  are correct.
- **m01l2 Items:** `decision`, `combination`, `move` (`defend`), unlabelled, mixed. **Positions must show:** at least
  one "decoy" where a familiar motif seems available and fails. **Success:** target/sound class or engine-confirmed.
- **Guided:** worked example per kind. **Independent:** m01l1/m01l2 items. **Transfer:** interleaved items inside
  later Master checks.
- **Misconceptions → feedback:** `m01.m1` every position hides a tactic → show the decoy's refutation and the quiet
  move. `m01.m2` quiet positions need no calculation → show the opponent's tactic after a careless move.
- **Assessment:** unit check (fully mixed, ≥ 1/3 quiet). **Remediation:** default, routed to the unit owning the
  failed item's strand.

#### m02 — Comparing plausible plans
| Level · prerequisites | Master · m01 | Strands | **PA** |
| --- | --- | --- | --- |
| Baseline topics | 42 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `m02-g1` (`play` the chosen plan) |

**Outcomes.** Name two plausible plans, compare them by assessment factors, choose one and carry it out.

| Lesson | Title | Objective |
| --- | --- | --- |
| m02l1 | Two plans | Describe and compare |
| m02l2 | Test the plan | Play it |

- **m02l1 Items:** `choice` (which plan, with reason) paired with `decision` (first move of the plan). **Positions must
  show:** two genuinely playable plans (reviewed), one fitting the position better for a stated reason. **Success:**
  both parts correct; the "other" plan is never marked wrong in feedback, only less fitting, with the reason.
- **m02l2 Items:** `play` from the position with each plan's objective as a predicate (Needs architecture
  confirmation: replaying the same position with each plan). **Success:** rubric R3 ≥ 75 for the chosen plan.
- **Guided:** worked example comparing plans. **Independent:** m02l1 items. **Transfer:** `m02-g1` (R3 + R1).
- **Misconceptions → feedback:** `m02.m1` there is one correct plan → show both plans working with different
  results. `m02.m2` a plan is chosen by the first move that looks good → show the factor comparison.
- **Assessment:** unit check; `m02-g1`. **Remediation:** default (a01, a03 objectives).

#### m03 — Switching between attack and defence
| Level · prerequisites | Master · m02 | Strands | **PA**, **DE** |
| --- | --- | --- | --- |
| Baseline topics | 43 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `m03-g1` (`play`, hold chain → `pressing(2)`) |

**Outcomes.** Notice when the opponent's counter-attack outweighs one's own and switch to defence, and back.

| Lesson | Title | Objective |
| --- | --- | --- |
| m03l1 | Whose attack is faster? | Count moves to mate/material for both sides |
| m03l2 | Switching in play | Play through a counter-attack |

- **m03l1 Items:** `choice` (whose attack is faster) paired with `decision` (attack or defend now). **Positions must
  show:** mutual attacks where the faster side is verifiable by forced-win search for the exact position.
  **Success:** both parts correct.
- **m03l2 Items:** `play` where the partner counter-attacks mid-task. **Success:** R3 (own attack predicate) 50 % +
  R5 50 %, with no **unanswered threat** (03-assessment.md §5.3 signal).
- **Guided:** worked example. **Independent:** m03l1 items. **Transfer:** `m03-g1`.
- **Misconceptions → feedback:** `m03.m1` keep attacking whatever happens → show the opponent's faster mate.
  `m03.m2` once defending, stay passive → show the moment the attack can resume.
- **Assessment:** unit check; `m03-g1`. **Remediation:** default (a07, e04 objectives).

#### m04 — Irreversible decisions
| Level · prerequisites | Master · m03 | Strands | **PA** |
| --- | --- | --- | --- |
| Baseline topics | 44 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | — |

**Outcomes.** Recognise irreversible moves (Soldier advances, exchanges, sacrifices, palace weakening) and decide
whether to commit now or keep options.

| Lesson | Title | Objective |
| --- | --- | --- |
| m04l1 | No way back | Recognise irreversible moves |
| m04l2 | Commit or wait | Decide |

- **m04l1 Items:** `select-squares`/`choice` (which candidate moves are irreversible). **Positions must show:** a mix
  of reversible and irreversible candidates. **Success:** exact set.
- **m04l2 Items:** contrasting `decision` pairs (similar positions, one where committing works, one where it fails).
  **Success:** target/sound in both of the pair.
- **Guided:** worked example. **Independent:** m04 items. **Transfer:** a `play` continuation (8–10 moves) where an
  early commitment is offered; rubric R3.
- **Misconceptions → feedback:** `m04.m1` committing early is always strong → show the lost flexibility. `m04.m2`
  waiting is always safe → show the opportunity that disappears.
- **Assessment:** unit check. **Remediation:** default (a05, a08 objectives).

#### m05 — Complex practical endgames
| Level · prerequisites | Master · m04 | Strands | **DE** |
| --- | --- | --- | --- |
| Baseline topics | 45 | Colour · perspective | Both · converting and holding |
| Reuses | — (new) | Practical task | `m05-g1` (convert), `m05-g2` (hold) |

**Outcomes.** With several pieces left, choose and carry out a plan (trade into a verified won endgame, create a
crossed Soldier, restrict the General), or hold a worse one for the cap.

| Lesson | Title | Objective |
| --- | --- | --- |
| m05l1 | Plans in rich endgames | Choose and execute |
| m05l2 | Holding the worse side | Defend |

- **m05l1 Items:** `choice` (plan) + `play` vs the convert chain. **Positions must show:** at least two pieces per
  side besides Advisors/Elephants; the win verified for the exact position or the task scored by material
  thresholds only. **Success:** R4 ≥ 75.
- **m05l2 Items:** `play` as defender vs the hold chain (03-assessment.md §5.2). **Success:** R5 ≥ 75 with holding predicate.
- **Guided:** worked example. **Independent:** m05 items. **Transfer:** `m05-g1`, `m05-g2`.
- **Misconceptions → feedback:** `m05.m1` simplify everything when ahead → show a verified/sourced drawn reduction.
  `m05.m2` the defender can only wait → show the active defence that holds.
- **Assessment:** unit check; `m05-g1`, `m05-g2`. **Remediation:** default (i10, a09, e06, e07 objectives).

#### m06 — Handling unfamiliar opening moves
| Level · prerequisites | Master · m05 | Strands | **OD**, PA |
| --- | --- | --- | --- |
| Baseline topics | 46 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `m06-g1` (`play` from an unusual opening) |

**Outcomes.** Facing legal, plausible moves outside the repertoire, apply development, centre and General-safety
principles and the safety routine; judged by development (R2) and safety (R1), not by a book line.

| Lesson | Title | Objective |
| --- | --- | --- |
| m06l1 | Out of the book | Principles against unknown moves |
| m06l2 | Punish or ignore? | When an odd move has a weakness, and when it is just different |

- **m06l1 Items:** `line` where the opponent's move is not in the learner's repertoire; learner nodes accept by
  development predicate + guard. **Positions must show:** legal first moves that are uncommon but not blunders
  (reviewed). **Success:** all learner moves target/sound.
- **m06l2 Items:** `decision` pairs: an odd move with a concrete weakness (engine-verifiable gain) vs an odd move with
  none. **Success:** punish the first, develop calmly against the second.
- **Guided:** worked example. **Independent:** m06 items. **Transfer:** `m06-g1`, rubric R6 + R1 (03-assessment.md
  §5.2 Opening row; F5 under fallback), where the line nodes are classed by the development predicate and the guard,
  not by a book line; R6 includes R2 over the whole task and the line-share gate (03 §5.3).
- **Misconceptions → feedback:** `m06.m1` an unknown move must be bad → show it is sound and the calm reply.
  `m06.m2` without a book line I am lost → show the principle checklist applied.
- **Assessment:** unit check; `m06-g1`. **Remediation:** default (b09, e08 objectives).

#### m07 — Where to think and practical risk
| Level · prerequisites | Master · m06 | Strands | **PP** |
| --- | --- | --- | --- |
| Baseline topics | 47 (scoped, see note) | Colour · perspective | Both |
| Reuses | — (new) | Practical task | — |

**Outcomes.** Decide how much to calculate (critical vs routine moments); choose a safe or risky continuation by
situation (ahead, behind, under counterplay).

| Lesson | Title | Objective |
| --- | --- | --- |
| m07l1 | Where to spend your thinking | Spot the critical moment |
| m07l2 | Safe or risky? | Choose by situation |

- **m07l1 Items:** `review`-style: in an authored game fragment, mark the move where calculation mattered most.
  **Positions must show:** one critical moment (a tactic or irreversible decision) among routine moves. **Success:**
  marks the critical move.
- **m07l2 Items:** `choice` (safe or risky, with reason) paired with `decision`. **Positions must show:** two playable
  continuations, one safe, one sharper, with the material situation varied across items. **Success:** both parts.
- **Guided:** worked example. **Independent:** m07 items. **Transfer:** in `xm`, the R7 review asks for the critical
  moment of the learner's own game.
- **Misconceptions → feedback:** `m07.m1` calculate every move equally → show the routine move and the critical one.
  `m07.m2` always play safe → show the position where safety loses slowly.
- **Assessment:** unit check, short form (6 items). **Remediation:** default (a02, e01 objectives).
- **Scope note:** no game clock (Verified). Time management is taught as "where to think"; there is no decision
  timer in this phase (§11 U7, decided in S1.4).

#### m08 — Deep annotated-game analysis
| Level · prerequisites | Master · m07 | Strands | **PP**, PA |
| --- | --- | --- | --- |
| Baseline topics | 48 | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `m08-g1` (`review`) |

**Outcomes.** Analyse a complete game: alternatives at critical moments, both sides' plans, where the result was
decided.

| Lesson | Title | Objective |
| --- | --- | --- |
| m08l1 | One game, both sides | Predict both sides' moves at critical moments |
| m08l2 | Where was it decided? | Choose and justify |

- **m08l1 Items:** `line` predict-the-move for **both** sides. **Positions must show:** a complete annotated game
  (a course game, 07-sourcing.md §3.2; §11 U1). **Success:** target/sound at ≥ 75 % of nodes (per-node credit).
- **m08l2 Items:** `review` (mark the deciding moment) + `choice` (why). **Success:** R7 ≥ 70.
- **Guided:** worked example on one game. **Independent:** a second game. **Transfer:** `m08-g1` on an own `xm` game.
- **Misconceptions → feedback:** `m08.m1` the loser's last move decided the game → show the earlier decision.
  `m08.m2` only the winner had a plan → show the loser's plan and where it failed.
- **Assessment:** unit check; `m08-g1`. **Remediation:** default (a10, e09 objectives).

#### m09 — Graduation: multi-game assessment, portfolio and reassessment
| Level · prerequisites | Master · m08 | Strands | **PP**, all |
| --- | --- | --- | --- |
| Baseline topics | 49 + 50 (merged, §9.1) | Colour · perspective | Both |
| Reuses | — (new) | Practical task | `xm` |

**Outcomes.** Complete several practical tasks across phases and both colours (`xm`), review each, and receive a
portfolio: strands mastered, tasks applied, weaknesses found, remediation path, reassessment.

| Lesson | Title | Objective |
| --- | --- | --- |
| m09l1 | The graduation games | Multi-game practical assessment |
| m09l2 | Portfolio and next steps | Review, remediation, reassessment |

- **m09l1 Items:** the `xm` tasks (03-assessment.md §6). **Positions must show:** unseen positions from exam pools,
  covering opening, middlegame, defence and endgame, both colours. **Success:** `xm` pass rule.
- **m09l2 Items:** `review` of each `xm` game; generated portfolio. **Success:** R7 ≥ 70 per review.
- **Guided:** a practice `xm`-style task with coach prompts (not scored).
- **Independent:** the `xm` tasks, unlabelled, no prompts.
- **Transfer:** `xm` positions are unseen and span all phases and both colours; the m09l2 reviews apply the analysis
  to the learner's own games.
- **Misconceptions → feedback:** `m09.m1` graduating means mastering Xiangqi → portfolio states what was and was not
  assessed. `m09.m2` a failed exam task means starting over → portfolio routes to the specific units.
- **Assessment:** mastery and application of m09 both come from passing `xm` (03-assessment.md §2). **Remediation:**
  per failed `xm` task, the units owning its rubric strands; reassessment with new seeds.

---

## 9. Coverage

### 9.1 Baseline topics → units

| Topics | Unit | Change |
| --- | --- | --- |
| 1–10 | b01–b10 | One unit each; b01 adds notation (needed by every prompt) |
| 11–14 | i01–i04 | One unit each |
| 15 | i05 + i06 | **Split**: seven existing lessons' worth of patterns (`u7`, `u8`) plus new defending lessons; one unit would be too long for phone sessions and would bury defence |
| 16–20 | i07–i11 | One unit each |
| 21–30 | a01–a10 | One unit each |
| 31–32 | e01–e02 | One unit each |
| 33 + 34 | e03 | **Merge**: same skill (keeping the opponent busy), same exercise types and practical task |
| 35–40 | e04–e09 | One unit each; 38 narrowed (e07 scope note), not dropped |
| 41–48 | m01–m08 | One unit each; 47 scoped to "where to think" (no clock; m07 note) |
| 49 + 50 | m09 | **Merge**: both are assessment and portfolio activities, no new teaching |
| 10 (complete games) | b10 | Kept as complete games: played to mate, stalemate or a disclosed training adjudication (cap 80 learner moves, no-capture limit, repetition rules; 03-assessment.md §5.5) — not shortened to a capped fragment |

No topic dropped; no topic order changed. "Knowledge" prerequisites in unit headers are informational (remediation,
jump-test sampling); unlocking stays linear within a level (Verified today `src/lessons/progress.ts:11`; kept for this
phase, revisited at the pilot review S2.20, §11 U3).

### 9.2 Strand coverage by unit (primary in capitals)

| Level | RS | TC | OD | PA | DE | PP |
| --- | --- | --- | --- | --- | --- | --- |
| Basic | B01–B06, b07, B08, b09, b10 | b03, b04, b06, B07 | B09, b10 | b07, b09 | b02, b05, b06, B08, b10 | b08, B10 |
| Intermediate | — (R1 in every `play`) | I02–I06, i07 | I08, I09, I11, i01 | I01, I11, i08, i10 | I07, I10, i02, i03, i05, i06, i09 | i11; tasks of i07–i11; `xi` |
| Advanced | R1 only | A02, a04, a06 | a10 | A01, A03–A06, A08, a02, a07, a10 | A07, A09, a05, a08, a10 | A10 |
| Expert | R1 only | E01, E02, e03 | E08 | E03, E05, E06, e02, e08 | E04, E06, E07 | E09 |
| Master | R1 only | M01 | M06 | M01–M04, m06, m08 | M03, M05 | M07–M09 |

RS is taught in Basic and then assessed through R1 in every practical task and safety-critical items in later checks
and placement tests (03-assessment.md §4.1, §7.2).

### 9.3 Cross-cutting requirements

| Requirement | Where it is met |
| --- | --- |
| Both colours | Black practice from b02 on (exception i08, balanced by i09); ≥ 1/3 Black items per level; ≥ half Black in a07, e04, e07; practical tasks as both colours in b10, i11, e06, e08 |
| Attack and defence | Paired lessons i02l3, i03l3, i05l4, i06l5, a04l4, e01l4, e02l3; defence units i07, a07, e04, e07, m03, m05 |
| No immediate tactic | Core of b08, b09, i01, i08–i11, a01, a03–a05, a07, a08, e05, e06, m01–m04, m06; contrast lessons i04l4, a03l3, a06l4; ≥ 1/4 of independent/assessment items in PA/OD/DE units |
| Plans before memorisation | b09 → i08/i09 → e08 → m06 |
| Difficulty levers | §6; Master ladder §5.2 |
| Completion / mastery / application | 03-assessment.md §2 |
| Self-analysis | b10l4 → a10 → e09 → m07/m08 → m09 |

### 9.4 Existing lessons → homes (authoritative map: 05-migration.md §3–§4)

This table was the feasibility input for S1.3; it now repeats the successor units of 05-migration.md §3 (reconciled in
S1.4, 05 DV1–DV8). Where the two ever differ, 05-migration.md wins.

| Existing | Successor unit (secondary placements) |
| --- | --- |
| `u1l1` · `u1l2`, `u1l3` | b01 · b02 |
| `u2l1`, `u2l2` | b03 (`u2l1#3` → b06l2 contrast) |
| `u3l1`, `u3l2` | b04 (mate items → b05) |
| `u4l1`, `u4l2` | b05 (facing-General learn cards → b02l2) |
| `u7l1`–`u7l3` | i05 |
| `u8l1`–`u8l4` | i06 (`u8l1` title renamed, §4) |
| `u9l1` · `u9l2` · `u9l3` | i02 · i03 · i07 |
| `u10l1` · `u10l2` · `u10l3` | i04 (two warm-ups → e02l1) · a06 · a02 |
| `u11l1` · `u11l2` · `u11l3` | i03 · i04 · i07 (two pool items → a07) |
| `u12l1`, `u12l2` · `u12l3` | a02 · a06 |
| `u13l1` · `u13l2`, `u13l3` | e04 · e01 |
| `u14l1`, `u14l2` · `u15l1`, `u15l2` · `u15l3` | e01 · e01 · e04 (mates in 4 → e01 pool) |
| Puzzle bank (`m1-*`, `m2-*`, `wm-*`) | Separate optional practice; never counts toward mastery or application |

Reused exercises are practice only, never check or placement items.

---

## 10. Content volume estimate (Proposal; for S1.4 batch sizing)

Counts follow from §8 and 03-assessment.md; item counts per lesson use the §5.2 ladder sizes.

| Level | Units | Lessons | Practice items (range) | Of which reusable today | Check pool (2 forms) | Practical tasks (`-g`) | Exam / placement pools |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Basic | 10 | 33 | 165–265 | 26 | 8 × 16 + 2 × 12 = 152 | 4 | `xb`; `pb` 40 items + 2 tasks |
| Intermediate | 11 | 42 | 210–340 | 58 | 176 | 7 | `xi`; `pi` 40 + 2 |
| Advanced | 10 | 37 | 185–260 | 25 | 160 | 6 | `xa`; `pa` 40 + 2 |
| Expert | 9 | 31 | 125–185 | 37 | 8 × 16 + 12 = 140 | 8 | `xe`; `pe` 40 + 2 |
| Master | 9 | 18 | 72–90 | 0 | 7 × 16 + 12 = 124 (m09: none) | 6 + `xm` | `xm` pool (no `pm`: no test-out within Master, 03-assessment.md §7.2) |
| **Total** | **49** | **161** | **~760–1140** | **146** | **~750** | **31** | 4 placement pools (~160 items, 8 tasks) + 5 exam pools |

(The lesson count includes the new b01l4. "Of which reusable today" counts reused practice items by **target** level,
`core` + `pool`, as in 05-migration.md §3.1; reconciled in S1.4.) This is a large authoring volume: roughly 600–1000 new practice items and ~750 new
check items, each needing verification and review in two languages. Reductions that keep the outcomes (Proposal,
chosen in S1.4: 06-backlog.md §5.1 adopts (3) and (4) and leaves (1) and (2) to the pilot review S2.20):
(1) lesson sizes at the low end of the ranges (G2 items only where the pilot shows learners need them); (2) check pools
of 1.5 forms for units with one primary strand, accepting partial item reuse on a third attempt (03-assessment.md
§4.3); (3) publish level by level (order fixed in 05-migration.md §8.4.1: Basic, Intermediate, Advanced, Expert,
Master), keeping later levels as the existing content until their batch is reviewed; (4) generate candidate positions with the existing seeded
generator approach (`scripts/generate-puzzles.ts` style, original positions only) so authoring time goes into
classification and explanation. No reduction may remove a unit's transfer task, Black coverage or quiet items.

---

## 11. Unresolved decisions

Owners are backlog items of [06-backlog.md](./06-backlog.md) (S1.4) or "owner decision". Resolved items stay listed
with a pointer.

| # | Question | Options | Status · owner |
| --- | --- | --- | --- |
| U1 | Source of annotated games (a10, m08) and opening lines | Author/tester games; historical games with attribution under S1.3; both, reviewed | **Resolved** by 07-sourcing.md §3.2: course games only (option A); historical games (B/C) only after the owner decision 07 S07-U1 |
| U2 | Glossary location and final English names (§4) | Comment block in `messages.ts` or a design file | **Decided** (S1.4, §4): `docs/curriculum-upgrade/glossary.md`, created and confirmed by the content reviewer in S2.3 |
| U3 | Unlock by prerequisite graph instead of linear order within a level | Keep linear; graph | **Decided for now:** linear (§9.1). Revisit: S2.20 (pilot review) |
| U4 | Built-in `decision` predicate set | 04 §5.4 list vs per-item code | **Resolved** by 04 §5.4 layer 2: a fixed built-in predicate list, no per-item code; implemented in S2.7 |
| U5 | ~~Notation~~ — decided in §4 (S1.2). Remaining: a setting to also show ICCS | — | Open · S2.20 (LX) |
| U6 | `play` lengths and partner time budget on a phone | §6 targets | Open · budget: S2.6 (measurement); lengths: S2.20 |
| U7 | Optional decision timer (m07) | Omit; optional | **Decided** (S1.4): omitted in this phase; m07 teaches "where to think" without a timer |
| U8 | Lessons/items per unit after the pilot; which §10 reductions to apply | — | Open · S2.20 (proposal to the driver; reductions beyond 06-backlog.md §5.1 need an owner decision) |
