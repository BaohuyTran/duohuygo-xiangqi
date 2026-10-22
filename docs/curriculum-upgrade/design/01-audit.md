# 01 — Current-state audit

Backlog item S1.1. Audit of the checkout at `e99e1f3` (branch `claude/pensive-albattani-i4h0ji`, base `main`
@ `f20ea5b`). Companion document: [04-architecture.md](./04-architecture.md) (engine, exercise model, feasibility).

Labels used in this document:

- **Verified**: measured or read from the code in this checkout; the command or `file:line` is given.
- **Proposal**: a design suggestion for later items; not implemented, not decided.
- **Unresolved**: a decision this document cannot make; listed for S1.3/S1.4 or the lead integrator.

Line numbers refer to commit `e99e1f3`.

**Exercise identifiers (used here and in 04-architecture.md):** `<lessonId>#<i>`, where `i` is the **0-based index
into the lesson's `exercises` array in the JSON, learn cards included**. Example: `u15l3#3` is the fourth entry of
lesson `u15l3` (index 0 is its learn card). When a position matters, its FEN is given as well.

---

## 1. Content counts — Verified

### 1.1 How the numbers were produced

A throwaway, dependency-free Node script outside the repository reads the lesson and puzzle JSON directly
(it does not go through the app, so a bug in `src/content/index.ts` could not hide content):

```sh
S=$(mktemp -d)
cat > "$S/count.mjs" <<'EOF'
// Usage: node count.mjs <repo>
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const repo = process.argv[2];
const ldir = join(repo, 'src/content/lessons');
const files = readdirSync(ldir).filter((f) => f.endsWith('.json')).sort();
const tally = (m, k, n = 1) => (m[k] = (m[k] ?? 0) + n);
const turnOf = (e) => (e.fen ? (/\s(b)\b/.test(e.fen) ? 'black' : 'red') : e.turn ?? 'red');
const kind = (e) => e.type === 'move' ? `move/${e.goal.kind}${e.goal.depth ? '-d' + e.goal.depth : ''}`
  : e.type === 'combination' ? `combination/${e.goal}/${e.moves}` : e.type;
const tot = { units: 0, lessons: 0, learn: 0, practice: 0, byKind: {}, byTrack: {}, turn: {}, learnTurn: {} };
for (const f of files) {
  const u = JSON.parse(readFileSync(join(ldir, f), 'utf8'));
  const track = u.track ?? 'basics';
  const t = (tot.byTrack[track] ??= { units: 0, lessons: 0, learn: 0, practice: 0, byKind: {} });
  t.units++; tot.units++;
  const perLesson = [];
  for (const l of u.lessons) {
    t.lessons++; tot.lessons++;
    let lp = 0, ll = 0;
    for (const e of l.exercises) {
      if (e.type === 'learn') { t.learn++; tot.learn++; ll++; tally(tot.learnTurn, turnOf(e)); continue; }
      t.practice++; tot.practice++; lp++;
      tally(t.byKind, kind(e)); tally(tot.byKind, kind(e)); tally(tot.turn, turnOf(e));
    }
    perLesson.push(`${l.id}:${ll}L/${lp}P`);
  }
  console.log(`${f} id=${u.id} track=${track} lessons=${u.lessons.length} ${perLesson.join(' ')}`);
}
console.log(JSON.stringify(tot, null, 1));
const pdir = join(repo, 'src/content/puzzles');
const pz = { total: 0, byGoal: {}, byTheme: {}, byDifficulty: {}, bySide: {}, withAlternatives: 0 };
for (const f of readdirSync(pdir).filter((f) => f.endsWith('.json'))) {
  for (const p of JSON.parse(readFileSync(join(pdir, f), 'utf8'))) {
    pz.total++; tally(pz.byGoal, p.goal); tally(pz.byTheme, p.theme);
    tally(pz.byDifficulty, `${p.goal}/d${p.difficulty}`); tally(pz.bySide, p.fen.split(' ')[1]);
    if (p.alternatives?.length) pz.withAlternatives++;
  }
}
console.log(JSON.stringify(pz, null, 1));
EOF
node "$S/count.mjs" "$PWD"     # run from the repository root
```

Definitions: a **learn card** is an exercise with `type: "learn"` (explanation only, nothing to answer). A
**practice exercise** is every other exercise (`select-squares`, `move`, `capture`, `combination`). The
**puzzle bank** (`src/content/puzzles/*.json`) is separate from lessons.

### 1.2 Totals

| Measure | Count |
| --- | ---: |
| Tracks (levels) | 5: `basics`, `intermediate`, `advanced`, `expert`, `master` |
| Units (lesson files) | 13 |
| Lessons | 36 |
| Learn cards | 49 |
| Practice exercises | 146 |
| Puzzles (separate bank) | 60 |

Unit ids are `u1`–`u4` and `u7`–`u15`: files `05-*` and `06-*` do not exist, so ids are not contiguous. Ids are
what progress stores, so the gap is harmless but must not be "filled" by reusing `u5`/`u6` for different content.

### 1.3 Per track

| Track | Units | Lessons | Learn | Practice | Practice by kind |
| --- | ---: | ---: | ---: | ---: | --- |
| basics | 4 (u1–u4) | 9 | 22 | 26 | select-squares 9, capture 8, move/checkmate 6, move/any 2, move/check 1 |
| intermediate | 4 (u7–u10) | 13 | 13 | 58 | combination/checkmate/2 28, move/checkmate 16, move/defend (depth 1) 5, combination/win-material/2 5, combination/checkmate/3 4 |
| advanced | 2 (u11–u12) | 6 | 6 | 27 | combination/checkmate/3 18, combination/checkmate/2 5, move/defend depth 2 4 |
| expert | 2 (u13–u14) | 5 | 5 | 21 | combination/checkmate/3 8, combination/checkmate/4 8, move/defend depth 2 5 |
| master | 1 (u15) | 3 | 3 | 14 | combination/checkmate/4 13, move/defend depth 3 1 |
| **total** | **13** | **36** | **49** | **146** | |

### 1.4 Practice exercises by type and goal (whole course)

| Type | Goal | Count |
| --- | --- | ---: |
| `select-squares` | legal destinations of a piece, or a region | 9 |
| `capture` | best capture by 1-ply exchange gain | 8 |
| `move` | `any` | 2 |
| `move` | `check` | 1 |
| `move` | `reach` | 0 |
| `move` | `checkmate` (mate in 1) | 22 |
| `move` | `defend` depth 1 (stop mate in 1) | 5 |
| `move` | `defend` depth 2 (stop mate in 2) | 9 |
| `move` | `defend` depth 3 (stop mate in 3) | 1 |
| `combination` | `checkmate`, 2 Red moves | 33 |
| `combination` | `checkmate`, 3 Red moves | 30 |
| `combination` | `checkmate`, 4 Red moves | 21 |
| `combination` | `win-material`, 2 Red moves | 5 |
| **total** | | **146** |

Grouped: forced-mate exercises 106 (22 mate-in-1 moves + 84 combinations), mate-defence 15, material-winning
13 (8 `capture` + 5 `win-material` combinations), piece-movement drills 9, other 3 (`any` ×2, `check` ×1).

### 1.5 Per lesson (learn cards L / practice P)

| Unit | Track | Lessons |
| --- | --- | --- |
| u1 The board and the palace | basics | u1l1 3L/1P · u1l2 3L/3P · u1l3 3L/3P |
| u2 Chariot and Horse | basics | u2l1 1L/3P · u2l2 2L/3P |
| u3 Cannon and Soldier | basics | u3l1 3L/3P · u3l2 2L/3P |
| u4 Check and checkmate | basics | u4l1 3L/3P · u4l2 2L/4P |
| u7 Cannon mating patterns | intermediate | u7l1 1L/5P · u7l2 1L/5P · u7l3 1L/5P |
| u8 Horse and Chariot mates | intermediate | u8l1 1L/5P · u8l2 1L/4P · u8l3 1L/4P · u8l4 1L/5P |
| u9 Tactics | intermediate | u9l1 1L/5P · u9l2 1L/3P · u9l3 1L/5P |
| u10 Combinations | intermediate | u10l1 1L/4P · u10l2 1L/4P · u10l3 1L/4P |
| u11 Hidden attacks | advanced | u11l1 1L/5P · u11l2 1L/3P · u11l3 1L/4P |
| u12 Mate in 3 | advanced | u12l1 1L/5P · u12l2 1L/5P · u12l3 1L/5P |
| u13 Expert technique | expert | u13l1 1L/5P · u13l2 1L/5P · u13l3 1L/3P |
| u14 Mate in 4 | expert | u14l1 1L/4P · u14l2 1L/4P |
| u15 Master play | master | u15l1 1L/5P · u15l2 1L/5P · u15l3 1L/4P |

Lesson titles (English, from `src/i18n/messages.ts`): u1l1 The board, u1l2 The General, u1l3 Advisor and
Elephant, u2l1 The Chariot, u2l2 The Horse, u3l1 The Cannon, u3l2 The Soldier, u4l1 Check, u4l2 Checkmate,
u7l1 Double Cannon, u7l2 Smothered General, u7l3 Horse-behind-Cannon, u8l1 Palcorner Horse, u8l2 Two Chariots,
u8l3 Chariot and Horse, u8l4 Your General attacks, u9l1 Forks, u9l2 Double check, u9l3 Stop the threat,
u10l1 Sacrifice to mate, u10l2 Quiet moves, u10l3 Mate in 3, u11l1 Discovered check, u11l2 Decoy, u11l3 Stop
the mate in 2, u12l1 Check, check, mate, u12l2 Horse and Cannon finish, u12l3 The quiet start, u13l1 The only
move, u13l2 Quiet moves, full board, u13l3 Discovered attack in 3, u14l1 Mate in 4, u14l2 The quiet follow-up,
u15l1 Quiet mate in 4, u15l2 Full-board mate in 4, u15l3 Master challenge.

### 1.6 Puzzle bank

| Measure | Count |
| --- | --- |
| Total | 60 |
| By kind | mate-in-1 30, mate-in-2 20, win-material 10 |
| By difficulty | mate-in-1: d1 13, d2 13, d3 4 · mate-in-2: d2 7, d3 5, d4 8 · win-material: d1 4, d2 3, d3 3 |
| By theme | chariot 17, flying-general 14, cannon 13, horse 8, double-check 3, soldier 3, fork 2 (`sacrifice` defined, unused) |
| Side to move | Red (`w`) 60, Black 0 |
| Puzzles listing `alternatives` | 0 |

### 1.7 Text

`src/i18n/messages.ts` holds 407 entries with a `vi` field (the file is the single source of UI and lesson text,
`src/i18n/messages.ts:1-3`). Topic keywords in the English lesson text (case-insensitive `grep -ci "en: '[^']*\(<word>\)"`):
`opening` 0, `develop` 0, `endgame` 0, `draw` 0, `repetition` 0, `perpetual` 0, `exchange` 0, `stalemate` 0
(the rule itself is taught without the word, `messages.ts:520`: "a side with no legal moves loses, even when it is
not in check"), facing/flying general 5. Keyword absence is weak evidence on its own; together with the exercise
types in §1.4 (no type can judge a non-forcing move) it supports the gap findings in §5.

---

## 2. Colour coverage — Verified

- **Every practice exercise is played as Red** (146/146, count above). The lesson validator enforces it:
  `src/content/validate.ts:119` ("exercises are played as Red: Red must be to move"); `move.from` and `square`
  must hold Red pieces (`redPieceAt`, `validate.ts:123-134`, used at `:148`, `:169`, `:183`); a learn card with a
  `square` needs Red to move (`validate.ts:147`); a stored solution moving a non-Red piece fails the legality check
  because Red is to move (`legality`, `src/lessons/answers.ts:84`). The format says so: `src/content/types.ts:5`
  and `types.ts:10`.
- **Learn cards:** 26 Red to move, 23 Black to move. The Black-to-move cards show finished positions (for
  example a checkmate already delivered) seen from Red's side; the learner never moves Black pieces.
- **Board orientation is fixed:** "Red is always at the bottom" (`src/components/Board.tsx:49-50`, the `point`
  function maps rank 0 to the bottom). There is no flip option and no visible coordinate labels; square names exist
  only in the accessible labels (`Board.tsx:115-124`).
- **Puzzles:** all 60 are Red to move (§1.6); `Puzzle.sideToMove` exists in the format
  (`src/content/puzzle-types.ts:42`) and `PuzzlePlayer` shows `puzzle.toMove.<side>`, but the puzzle verifier
  rejects anything else (`src/content/validate-puzzles.ts:80`: "sideToMove must be \"red\"") and CLAUDE.md states
  the board is always drawn with Red at the bottom.
- **What playing Black would have to change** (list for 04-architecture.md §5.1): `validate.ts:119`, `:123-134`,
  `:147`; `validate-puzzles.ts:80`; `combination.ts:15, 20`; `Board.tsx:49-50` (orientation) and the river labels
  `Board.tsx:100-103`; colour words in prompts/explanations in `src/i18n/messages.ts`.
- **Colour-specific code paths:** combinations measure material from Red's side
  (`src/lessons/combination.ts:20`, `materialBalance(start.board, 'red')`) and name the mover "Red"
  (`redMovesLeft`, `combination.ts:15`); exercise prompts and explanations are written as "Red …/Black …". The
  solver itself is colour-agnostic (it uses `pos.turn`, `src/engine/solver.ts:72-83`), as are `checkMove` and
  `captureGain` (`src/lessons/answers.ts:89-126`).
- **Defence from Black's perspective** (defending as the side that moves second, Black openings) is absent.
  "Defend" exercises are Red stopping a Black mate threat.

---

## 3. How the systems work today — Verified

### 3.1 Content loading and format

- Units are loaded from `src/content/lessons/*.json` in file-name order (`src/content/index.ts:4-8`); lessons are
  flattened in that order (`index.ts:11`).
- Format: `src/content/types.ts`. A position is either a FEN or a `pieces` map (`types.ts:12-14`). Exercise types:
  `learn` (`types.ts:20`), `select-squares` (`:32`), `move` with goals `reach`/`any`/`check`/`checkmate`/`defend`
  (`:38-62`), `capture` (`:68`), `combination` (`:82-98`). Each `move`/`capture` has exactly one stored
  `solution`; combinations store one main line (`solution`) plus optional `firstMoves` and `hints`.
- Validation: `src/content/validate.ts` (shape, i18n keys, legality, solvability; `validateUnits` at `:47`,
  combinations at `:245`). Lesson positions are checked for "opponent not in check" and "Red has a legal move"
  (`validate.ts:117-120`), **not** for piece counts or reachable points; the puzzle verifier does check those
  (`src/content/validate-puzzles.ts:34-62`). Run by `npx vitest run src/content`; `npm run content:deep` proves
  mate-in-4 `firstMoves` lists.

### 3.2 Answer checking (lessons and puzzles)

- `checkMove` (`src/lessons/answers.ts:89-107`): legality first (`legality`, `:82-87`, distinguishes `illegal`
  from `unsafe`), then the goal: `checkmate` = `gameStatus(after).kind === 'checkmate'`; `defend` =
  `!hasForcedWin(after, depth)`. Any move meeting the goal is accepted (not only the stored `solution`).
- `checkCapture` (`answers.ts:128-135`): correct when the capture's gain (victim value minus attacker value if it
  can be recaptured at once, `captureGain` `:112-119`) is positive and maximal. This is a 1-ply exchange
  estimate, not a full exchange evaluation.
- Combinations (`src/lessons/combination.ts`): a Red move is accepted when the engine confirms it still wins
  (`isWinningMove` `:28-31`, `searchWinningMove` `:34-41`); for mates in 4 the first move must be in the
  authored `firstMoves` list. Black's reply is the stored move while on the main line, otherwise a best defence
  (`bestCombinationReplies` `:60-76`, `combinationReply` `:78-82`).
- Puzzles (`src/puzzles/logic.ts`): the **first** move must be the stored move or a listed alternative
  (`checkPuzzleMove` `:52-60`); later moves are judged by the engine. Win-material threshold 2 points at a 4-ply
  horizon (`:19-21`).

### 3.3 Lesson progress and unlocking

- Lesson states `locked`/`available`/`completed` (`src/lessons/progress.ts:3`). Within a track, a lesson is
  available once every earlier lesson of the track is completed; **the first lesson of every track is open from
  the start** (`progress.ts:5-27`). Tracks group consecutive units (`trackLessons`, `progress.ts:29-36`).
- Completion = reaching the end of a lesson. Wrong answers do not prevent completion: each wrong answer costs a
  heart (outside tests) and the learner retries the same exercise (`LessonPlayer.tsx:220-234`); at 0 hearts the
  current lesson can still be finished (`LessonPlayer.tsx:84-90`). First-try correct answers are counted
  (`LessonPlayer.tsx:71, 79`) and shown on the completion screen (`:152`) but **not stored**.
- Storage: one id list `progress.completedLessons.v1` (`src/storage/index.ts:61`, repository `:100-103`).
  Solved puzzles: `progress.solvedPuzzles.v1` (`:62`, `:111-114`). No per-exercise, per-attempt, hint or
  mastery data is stored anywhere.
- Home focus: `furthestLesson` (`progress.ts:83-89`), used at app start (`src/App.tsx:99`).

### 3.4 Jump-ahead

- Entry points: tapping a locked lesson opens a dialog (`src/components/Home.tsx:141`, dialog `:152-158`,
  text `:257`), and "Jump here" on a locked unit (`Home.tsx:122-128`). The Home banner (`jumpBannerTrack`,
  `progress.ts:69-75`; `Home.tsx:50, 89-95`) points to the first lesson of a higher track, which is already open
  without any test.
- Test content (`jumpTest`, `progress.ts:55-61`): **the last two practice exercises of every skipped lesson**
  (the same items the lessons contain), spread evenly down to `JUMP_TEST_MAX` = 8 (`progress.ts:41`), learn cards
  excluded. Skipped = not-yet-completed lessons before the target in the same track (`skippedLessons`,
  `progress.ts:44-48`).
- Scoring: there is no score. The test has `JUMP_TEST_LIVES` = 3 lives (`progress.ts:39`; `LessonPlayer.tsx:74`);
  a wrong answer costs a life and the learner **retries the same item** until it is correct; the third wrong
  answer ends the test (`LessonPlayer.tsx:168-170`, button `:404-407`). Passing = getting through every item with
  at most 2 wrong attempts in total. Consequences:
  - with 8 items, 6/8 first-attempt correct (75 %) passes; with 2 items, 0/2 first-attempt correct can pass
    (two wrong attempts, then correct retries);
  - combination hints remain available inside a test and do not affect the result (the hint button in
    `CombinationView` does not depend on `test`, `LessonPlayer.tsx:583-593`);
  - prompts name the motif (the items are lesson exercises with lesson prompts such as mate-in-N).
- Effect of passing: every skipped lesson is marked completed, without XP (`src/App.tsx:140-147`). Failing changes
  nothing. Real hearts are not used (`LessonPlayer.tsx:86`).
- Track openings mean a learner can start any level (including Master) with no assessment at all.

### 3.5 Gamification

- Pure rules in `src/gamification/rules.ts` (documented at `:1-13`), service with injected clock
  `src/gamification/service.ts:35`. XP: lesson first completion 10, replay 5, first puzzle solve 5, reveal/re-solve
  0 (`rules.ts:23-28`, `lessonXp`/`puzzleXp` `:97-101`). Hearts: max 5, refill one per 30 min
  (`rules.ts:15-16`, `syncHearts` `:147`, `loseHeart` `:157`); 0 hearts blocks starting a lesson
  (`canStartLesson` `:165`; `App.tsx:215-221`). Daily goal 10/20/30/50 (`rules.ts:17-19`), streak (`streakOn`
  `:138`). State key `gamification.state.v1` (`src/storage/index.ts:65`, repository `:134-145`).
- Wiring: wrong lesson answer → `game.loseHeart()` (`App.tsx:160-163`); lesson completion →
  `game.completeLesson` (`App.tsx:165-170`); puzzle solve → `game.solvePuzzle` (`App.tsx:188-192`).
- XP and streak are not used for unlocking or competence anywhere (verified by reading `progress.ts` and
  `App.tsx`: unlocking uses only the completed-lesson ids).

### 3.6 Account sync

- Optional; created only when both Supabase env vars are set (`src/main.tsx:13-23`). The UI reads/writes through
  `account.store`, a wrapper that schedules a sync `SYNC_DEBOUNCE_MS` = 2000 ms after a changed write
  (`src/sync/service.ts:81`, scheduling `:180-189`, store wrapper `:191-204`). Syncs also run on sign-in/app start with a session
  (`setUser`, `service.ts:123-132`, `:212-213`) and when the device comes back online (`:205`).
- One sync (`syncOnce`, `service.ts:134-151`): pull the row, `parseRemote` (`src/sync/merge.ts:54-64`),
  `mergeSnapshots` (`merge.ts:108-116`), write locally, push if different. Merge rule documented at
  `merge.ts:1-22`: completed lessons and solved puzzles = **union**; XP per-day max; streak by later goal day;
  hearts = fewer after refill; preferences local-first.
- Snapshot = exactly five fields (`ProgressSnapshot`, `src/storage/index.ts:153-159`; `readSnapshot`/
  `writeSnapshot` `:161-180`). Remote JSON `RemoteData` has `version: 1` (`merge.ts:29-38`); `parseRemote` does
  not read `version`. `toRemote` writes only the known fields (`merge.ts:40-48`) and the backend upserts the whole
  `data` value (`src/sync/supabase.ts:78-80`; table `supabase/migrations/20261016000000_progress.sql`).
- **Migration risk (Verified from the code paths above):** any new field added to the remote JSON by a newer
  build is dropped and overwritten by an older build that syncs the same account (old `parseRemote` ignores it,
  old `toRemote` omits it, `upsert` replaces `data`). Union semantics also means retired lesson ids stay in
  everyone's progress forever and "reset" is undone by the next sync (`merge.ts:18-19`). Design responses are in
  [04-architecture.md §5.8](./04-architecture.md#58-three-level-progress-completed--mastered--applied).

---

## 4. Engine — summary (details in 04-architecture.md)

- Rules: full move generation incl. horse leg, elephant eye, river, palace, cannon screen, flying general
  (`src/engine/movegen.ts`); check/checkmate/stalemate (stalemate loses) (`src/engine/status.ts:14-19`). Perft
  from the start position matches 44 / 1,920 / 79,666 / 3,290,240 (re-measured in this audit, see
  04-architecture.md §2.2).
- **Not implemented:** repetition, perpetual check, perpetual chase, move-count draws, any draw at all
  (`status.ts:11-13`; `Position` has no move history, `src/engine/types.ts:26-33`; `halfmoveClock` is tracked by
  `makeMove`, `movegen.ts:226`, and never read by any rule).
- Solver: exhaustive forced-win search (`forcedWinMoves`/`hasForcedWin`, `solver.ts:49-83`) and a
  material-only alpha-beta with capture quiescence (`searchScore`/`moveScore`, `solver.ts:123-172`).
- No engine bug was found in this audit. One cross-check with an independent engine (Fairy-Stockfish) agreed with
  the stored mate-in-4 line of `u15l3#3` (FEN `2b2N3/1N2ak3/5a3/6R2/2bc5/5c3/9/8B/9/4K4 w - - 0 1`;
  04-architecture.md §2.4).

---

## 5. Historical findings (01-audit-and-design.md) — confirmed or corrected

| # | Historical finding | Result | Evidence |
| --- | --- | --- | --- |
| H1 | 13 units, 36 lessons, 146 practice exercises (excluding learn cards and the puzzle bank) | **Confirmed** | §1.2 |
| H2 | Intermediate–Master contain 120 practice exercises | **Confirmed**: 58 + 27 + 21 + 14 = 120 | §1.3 |
| H3 | …of which 100 mating exercises | **Confirmed**: intermediate 48 (16 mate-in-1 + 28 two-move + 4 three-move combinations), advanced 23, expert 16, master 13 | §1.3 |
| H4 | …15 mate-defence exercises | **Confirmed**: `defend` depth 1 ×5 (intermediate), depth 2 ×9 (advanced 4, expert 5), depth 3 ×1 (master) | §1.4 |
| H5 | …5 material-winning combinations | **Confirmed**: 5 `win-material` 2-move combinations, all in u9 (intermediate). Note: the basics track has 8 more material exercises (`capture`), outside the 120 | §1.3 |
| H6 | Gaps: opening development, positional assessment, planning, broader defence, endgame technique, sustained play | **Confirmed.** No exercise type can judge a non-forcing move (§3.2: every judge is legality, a mate/defence search or a material search); no lesson text mentions opening, development, endgame, exchange or draw (§1.7); defence is only "stop a forced mate" (15 items); no exercise lasts longer than 4 learner moves (combinations max `moves: 4`) | §1.4, §1.7, §3.2 |
| H7 | Existing exercises were designed for the learner to play Red | **Confirmed and enforced** by the validator; puzzles too; board never flips | §2 |
| H8 | Jump-ahead sampled exercises from existing lessons | **Confirmed**, with detail: last two practice items of each skipped lesson, max 8, no score, 3 lives with retries, hints allowed, prompts name the motif; passing completes the skipped lessons | §3.4 |

Additional findings not in the historical list (Verified):

- A1. Any track can be entered with no assessment (first lesson of every track is open), so "Master" is reachable
  without evidence of Basic–Expert competence (`progress.ts:5-8`).
- A2. Assessment evidence is not stored: first-try results are computed per session and discarded (§3.3).
- A3. 84 of 146 practice exercises (58 %) are forced-mate combinations; difficulty above Intermediate grows
  mainly by mate length (2 → 3 → 4 moves) and quieter first moves (§1.3), which the curriculum rules in
  `01-audit-and-design.md` ("not merely longer mating sequences") rule out as the main difficulty driver.
- A4. Lesson positions are not checked for piece counts / reachable points (§3.1); puzzles are. New content that
  claims "game-like" positions needs the stronger check.
- A5. Sync drops unknown fields (§3.6): new progress data needs a forward-compatible storage plan before any
  build with new progress data is deployed.
- A6. The puzzle bank has no Black-to-move puzzle and no listed alternative first move; the puzzle verifier
  requires a unique first move (CLAUDE.md "Puzzles"), which suits tactics but not strategic positions.

---

## 6. Reuse notes for S1.3 — Proposal

- All 146 practice exercises are engine-verified tactical items (validated on every `npm test`), so they are
  reusable as tactical practice and remediation material. They are **not** independent assessment items for the
  new jump-ahead (H8: learners have seen them, prompts name motifs).
- Basics u1–u4 cover rules topics 1–5 of the baseline outline (board, pieces, check/mate, stalemate-as-loss
  in `u4l2`), but not topics 6–10 (threatened/defended pieces beyond `capture`, exchanges, safety routine,
  development, guided games).
- Mating-pattern units u7, u8, u12, u14, u15 map to the outline's "characteristic mating patterns" and
  "branching calculation" topics; their share must shrink relative to the new strands rather than be deleted.
- Per-lesson keep/revise/move/retire decisions belong to S1.3 (`design/05-migration.md`).

## 7. Unresolved (for S1.3/S1.4)

- U1. Whether old completion of a lesson that is later split or retired maps to completion of the new lesson(s)
  (completion only, never mastery — required by 02-foundation-and-pilot.md).
- U2. Whether retired lesson ids stay in synced progress forever (union) or are pruned by a versioned migration
  that every client version runs (see A5).
