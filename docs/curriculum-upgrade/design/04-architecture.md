# 04 — Exercise architecture and engine feasibility

Backlog item S1.1. Companion to [01-audit.md](./01-audit.md). It states what the engine and exercise model can do
today (measured), what the curriculum in `01-audit-and-design.md` / `02-foundation-and-pilot.md` needs, and how to
build it without changing `src/engine`.

Labels:

- **Verified**: measured on this checkout or read from the code (`file:line`, commit `e99e1f3`).
- **Proposal**: a design suggestion; nothing here is implemented or decided.
- **Unresolved**: needs a decision by another item (S1.2 ruleset/assessment, S1.3 migration, the owner) or a
  measurement that cannot be made in step 1.

---

## 1. Summary

- **Verified.** The rules engine is complete for move legality (perft-validated) and for checkmate/stalemate. It
  has no repetition, perpetual check/chase or move-count rules, and no move history. The solver offers an
  exhaustive forced-mate search (sound proof within N moves) and a material-only alpha-beta search
  (4 plies + captures) with no positional knowledge, no transposition table and no time control. Everything runs
  synchronously on the UI thread.
- **Verified (measured, desktop).** Interactive checks used by today's lessons take ≤ 250 ms; a material search
  of a full middlegame board takes ~1.4 s at 4 plies and ~6 s at 5 plies; proving a quiet mate in 4 takes up to
  ~5.5 s. A phone is slower by an unmeasured factor (§2.5).
- **Proposal.** Keep `src/engine` untouched. Add `src/analysis/` (bounded search, evaluation features, move
  judging) running in a Web Worker, `src/play/` (game history, repetition adjudication, training opponents) and
  `src/assessment/` (scoring). Judge strategic choices with an **authored, precomputed decision table plus
  objective predicates and a tactical safety guard**, never by equality with an engine's first choice.
- **Proposal.** Use an external engine (Fairy-Stockfish) only at authoring time, outside the repository and the
  shipped app, as an independent cross-check. Do not ship a GPL engine in the PWA unless the owner decides the
  licence question (§6.3) and the pilot shows the in-repo search is insufficient.

---

## 2. Engine and solver — Verified

### 2.1 Rules

| Area | Status | Where |
| --- | --- | --- |
| Piece movement incl. horse leg, elephant eye/river, palace, cannon screen | implemented | `src/engine/movegen.ts:32-128` |
| Check detection incl. flying general | implemented | `isGeneralAttacked`, `movegen.ts:130-178` |
| Legal moves (own general not left attacked) | implemented | `movegen.ts:180-216` |
| Checkmate; stalemate = loss for the side to move | implemented | `src/engine/status.ts:14-19` |
| FEN in/out; `pieces` maps | implemented | `src/engine/fen.ts:44-118` |
| Perft 44 / 1,920 / 79,666 / 3,290,240 | re-measured, matches | §2.2 |
| Move history in `Position` | **absent** (`board`, `turn`, `halfmoveClock`, `fullmoveNumber` only) | `src/engine/types.ts:26-33` |
| Threefold repetition, perpetual check, perpetual chase | **not implemented** | `status.ts:11-13` |
| Move-count draw (e.g. 60/120-ply no-capture rule) | **not implemented**; `halfmoveClock` is updated (`movegen.ts:226`) but never read | |
| Draw by agreement / insufficient material | **not implemented** | |
| Position legality beyond "side not to move is not in check" | lessons: no piece-count / reachable-point check (`src/content/validate.ts:117-120`); puzzles: checked (`src/content/validate-puzzles.ts:34-62`) | |

Legal-position validation is not historical reachability: a position can pass every check above and still be
unreachable from the start position (e.g. impossible pawn structures plus captured pieces). No code checks
reachability, and full reachability is not decidable cheaply. Content should say "legal position", never "game
position", unless it comes from a real game line played from the start.

### 2.2 Measured timings

Machine: Intel Xeon @ 2.10 GHz, 4 vCPU, Linux, Node v22.22.0 via `tsx` (same JS engine family as Chrome's V8).
Single run per row (enough for orders of magnitude, not for benchmarks). The script is in the appendix (§A.1);
run it with `npx tsx <script> "$PWD"` from the repository root.

Full board ("start" = the initial position; "mid" = after 1. C2=5 H8+7 2. H2+3 H2+3 3. R1=2 R9=8, FEN
`r1bakabr1/9/1cn3nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKABR1 w - - 6 4`, a developed, quiet position):

| Call | Time | Result |
| --- | ---: | --- |
| `perft(start, 3)` / `perft(start, 4)` | 125 ms / 2,038 ms | 79,666 / 3,290,240 |
| `legalMoves(mid)` | < 0.05 ms per call | 37 moves |
| `searchScore(start, 2 / 3 / 4 / 5)` | 24 / 131 / 1,415 / 3,749 ms | 0 |
| `searchScore(mid, 2 / 3 / 4 / 5)` | 19 / 64 / 1,424 / 5,924 ms | 0.5 / 0.5 / 1 / 1 |
| `hasForcedWin(start, 2)` / `hasForcedWin(mid, 2)` | 4.8 / 3.1 ms | false |

Lesson exercises (from the content):

| Call | Time | Notes |
| --- | ---: | --- |
| `checkMove` defend depth 2 (u13l1, solution / losing move) | 1.8–6.2 ms | |
| `checkMove` defend depth 3 (u15l3 #1, solution / losing move) | 220 / 131 ms | the UI shows "Checking your move…" first |
| `searchWinningMove` mate in 4, one first move (u15l3 #2/#3/#4) | 732 / 3,645 / 352 ms | only `content:deep` does this; the app uses `firstMoves` |
| `hasForcedWin(pos, 4)` (u15l3 #2/#3/#4) | 4,551 / 5,516 / 418 ms | |
| `forcedWinMoves(pos, 4)` full list (u15l3 #4) | 1,621 ms | 2 moves |
| `forcedWinMoves(pos, 3)` full list (u13l3 #2/#3) | 179 / 71 ms | |

What the lesson player actually computes while playing every combination's main line (script §A.2): judging each
Red move (`checkCombinationMove`) and computing Black's best defence (`bestCombinationReplies`):

| Combination | Judge median / max | Reply median / max |
| --- | --- | --- |
| checkmate, 2 moves (33) | 0.1 / 2.4 ms | 0.5 / 4.6 ms |
| win-material, 2 moves (5) | 0.3 / 6.4 ms | 2.5 / 7.5 ms |
| checkmate, 3 moves (30) | 0.1 / 213 ms | 1.9 / 249 ms |
| checkmate, 4 moves (21) | 0.0 / 13 ms | 2.5 / 40 ms |

Off the main line (learner plays an alternative winning move) the costs are of the same kind but were not
measured per exercise.

### 2.3 Search characteristics and limits

- `forcedWinMoves`/`hasForcedWin` (`src/engine/solver.ts:49-83`): full-width AND/OR search, no pruning beyond
  "stop at the first refutation/win", no move ordering, no transposition table. **Sound and complete** within N
  moves: a `true` is a proof against every defence, a `false` proves no forced win within N. Cost grows roughly by
  the branching factor (~30–45) per ply; mate in 4 = 7 plies is at the edge of interactive use.
- `searchScore`/`moveScore` (`solver.ts:123-172`): fixed-depth negamax alpha-beta, MVV/LVA ordering only, capture
  quiescence capped at 8 plies (`solver.ts:95`), all evasions when in check. Evaluation = material only with
  beginner values (chariot 9, cannon 4.5, horse 4, advisor/elephant 2, soldier 1; `solver.ts:9-17`). It does not
  know that a crossed soldier is stronger, that a cannon needs screens, that a horse with blocked legs is weak,
  or anything about king safety, development, mobility or structure. Two moves that keep material equal score the
  same.
- No iterative deepening, no time or node limit, no abort: a call runs to completion. Called from React event
  handlers and timers, it blocks the UI thread (the players defer judgement with a 30 ms `setTimeout` so the move
  can paint first, `src/components/LessonPlayer.tsx:259-268`, `:468-479`).
- The solver's scratch-board technique uses only the public engine API (`pseudoLegalTargets`,
  `isGeneralAttacked`, exported from `src/engine/index.ts`), so new search code can live **outside**
  `src/engine` with the same speed (no engine edit needed).

### 2.4 Independent cross-check (Fairy-Stockfish)

Fairy-Stockfish (`fairy-stockfish-nnue.wasm` 1.1.12 from npm, run under Node with a small driver, §A.3; no NNUE
network loaded, so its classical evaluation; 1 thread):

- **Rules agree on the checked line.** For `u15l3` exercise 4 (FEN
  `2b2N3/1N2ak3/5a3/6R2/2bc5/5c3/9/8B/9/4K4 w - - 0 1`), after our solution's first move it reports "mate in 3"
  for Red at once, and `go mate 4` from the start returns exactly our stored line
  (f9-h8 f4-g4 g6-g8 f8-f9 g8-g9 f9-f8 h8-g6). Not a systematic cross-check: one position.
- **A strong engine's first choice is not a proof.** On the same position, `go depth 22` (40 s) preferred another
  move with a +7.4 pawn score and did not see the quiet mate; only `go mate 4` found it, at depth 23 after 54 s.
  Our exhaustive solver proves it in 0.4–1.6 s. Lesson for the design: forced-outcome claims are proven by the
  exhaustive solver; external engine scores are evidence for evaluation, with stated limits, not verification.
- Coordinate systems differ: Fairy-Stockfish UCI uses files `a–i` and ranks **1–10** (`f10h9` = our `f9-h8`).
  Any integration needs a tested conversion.
- Timing (desktop, 1 thread, mid position): depth 12 in 1.4 s, depth 16 in 8.1 s; ~1.2 s start-up before the
  first search output in this Node set-up.

### 2.5 Phones — assumption, not measured

No phone was available in this step. **Assumption:** a mid-range phone runs this single-threaded JavaScript
several times slower than the desktop above, and throttles under sustained load. Consequences used in the
proposals: anything above ~100 ms desktop must not run on the UI thread; anything above ~1 s desktop must be
precomputed at authoring time or run in a Worker with a budget and a graceful fallback. **Unresolved:** measure the
same script (§A.1, packaged as a page) on at least one Android and one iOS device during the pilot (S2) and
record the factor.

---

## 3. Exercise model today — Verified

(Details and line references in [01-audit.md §3](./01-audit.md#3-how-the-systems-work-today--verified).)

- Five exercise types; all practice exercises are Red to move; the board is always drawn from Red's side.
- A `move` exercise is a **single decision** judged by a predicate (`reach`, `any`, `check`, `checkmate`,
  `defend`). Every move satisfying the predicate is accepted — already "multiple acceptable moves" for forcing
  goals — but no predicate exists for non-forcing goals.
- A `combination` is a **single forced line** with engine best defence; the learner may deviate if the engine
  confirms the deviation still wins. There is no authored branching (the opponent's reply is the stored move on
  the main line, otherwise the first best-defence move).
- Feedback: one `explanation` key shown after a correct answer (`LessonPlayer.tsx:321, 380, 621`); a wrong answer
  gets a generic message per verdict (`illegal`, `unsafe`, `not-checkmate`, `allows-mate`, …). No
  position-specific "why the tempting move fails", no "key opponent response".
- Hints: combinations only (one key per Red move, or "move this piece"); available even in jump tests; their use
  is not recorded.
- State: each exercise view is keyed by its index (`LessonPlayer.tsx:171-174`); retry resets the exercise's own
  state only. Nothing is persisted mid-lesson.

---

## 4. Proposed module layout — Proposal

`src/engine` stays as is (rule: never change its behaviour; its tests stay untouched). New code depends on the
engine's public API only.

```
src/analysis/            NEW · pure TS, no React/DOM (enforced by a test like src/engine's)
  search.ts              iterative-deepening alpha-beta on a scratch board; Zobrist keys + transposition table;
                         node budget and abort flag; returns { score, pv, depth, nodes, complete }
  eval.ts                material + feature terms (§5.4), each term separately reportable for feedback
  features.ts            attack maps, hanging/defended pieces, mobility per piece, horse legs, cannon screens,
                         open files, crossed soldiers, palace defenders, development count
  judge.ts               safety guard (forced mate / material loss within a horizon) and objective predicates
  worker.ts              Web Worker entry: { id, kind: 'judge' | 'reply' | 'analyse', payload } messages
  client.ts              promise API, per-request budget, timeout → worker.terminate() + restart,
                         synchronous small-budget fallback where Worker is unavailable (jsdom, old browsers)
src/play/                NEW · game record (moves + position keys), repetition and move-cap adjudication,
                         training-opponent policies with an injected seeded RNG
src/assessment/          NEW · scoring (first attempt vs hint vs retry, strand minimums, 90/100 threshold —
                         numbers come from design/03-assessment.md)
src/content/             new exercise types + validators; src/lessons keeps today's judges unchanged
scripts/verify-*.ts      authoring-time deep verification (exhaustive solver, long searches, optional
                         external-engine cross-check); results committed as evidence fields in the content
```

- Vite builds `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` as a separate JS chunk;
  the PWA precache pattern already includes `**/*.js` (`vite.config.ts:35`), so the worker works offline with no
  config change. (Verified: pattern; Proposal: the worker itself.)
- **Verdicts must not depend on device speed.** Judging uses **depth/node limits** (deterministic: the same
  answer on a phone and in CI) — a wall-clock limit is only a safety net. If the safety net fires, the verdict is
  "not checked", which never costs a heart or an assessment point (§5.4), and is logged for content review.
- Tests run the same modules synchronously in Node (no Worker), so every verdict used by content is unit-tested.

---

## 5. Required capabilities

Each subsection: what exists (Verified), what is needed, the proposal, and open decisions.

### 5.1 Playing Black (orientation, coordinates, prompts)

- **Today (Verified):** Red only, enforced by the validator (`validate.ts:119, 129, 147`); board fixed
  (`Board.tsx:49-50`); combination material measured for Red (`src/lessons/combination.ts:20`); prompts say
  "Red"/"Black"; no visible coordinates. The solver and `checkMove`/`checkCapture` are colour-agnostic.
- **Proposal:**
  - Content: optional `side: 'red' | 'black'` on every exercise (default `red`); the validator requires the side to
    move to equal `side` and all "own piece" checks use it. Existing content is unchanged (all default `red`).
  - Board: `orientation` prop; `point(file, rank)` maps to `(8 - file, rank)` when Black is at the bottom. Hit
    areas, marks, animations (`--dx/--dy` are computed from `at()`), and accessible labels follow automatically.
    The orientation follows the learner's side for the whole exercise, including opponent replies.
  - Coordinates: optional edge labels. **Unresolved (S1.2 / learning-experience):** which notation learners see —
    ICCS letters/digits (what the content uses), traditional file numbers 1–9 counted from each player's right
    (the convention of Chinese and Vietnamese notation, e.g. "Pháo 2 bình 5"), or both. The engine keeps ICCS
    internally either way; a pure `formatMove(move, position, notation, lang)` helper would render prompts.
  - Text: colour-neutral keys ("your General", "the opponent") or `{side}` placeholders in both `en` and `vi`.
  - `combination.ts` and the new judges take the mover from the position (`start.turn`), not `'red'`.
- **Tests needed:** the same exercise mirrored (colours swapped, board rotated 180°) gives mirrored verdicts;
  flipped board renders the right square under a tap (component test); ui:check at 320/360 px with Black at the
  bottom.

### 5.2 Branching continuations

- **Today (Verified):** one stored line; deviations are allowed only when the engine proves they still win;
  the opponent follows the stored line or the first best defence.
- **Proposal:** a `line` exercise holds an authored **move tree**:
  - learner nodes: a list of accepted moves, each with a grade (§5.3) and feedback keys, leading to the next
    opponent node; moves not listed are judged by the fallback in §5.3/§5.4;
  - opponent nodes: one or more authored replies (plausible deviations), each with an optional weight and a short
    explanation key ("Black deviates with …: now …");
  - leaves: a goal check (`checkmate`, material ≥ N, a position predicate, or "reached the plan position").
  - Opponent choice among authored replies: seeded and **coverage-driven** — across attempts the learner meets the
    deviations they have not seen yet (attempt counts per exercise are part of the stored attempt log, §5.8).
  - Off-tree opponent positions (learner played an accepted fallback move): the opponent switches to a policy
    from §5.5 and the exercise ends at the next leaf predicate or after a move cap.
- **Validation (authoring time, `scripts/verify-*` + `src/content` tests):** every node legal; every opponent
  branch reaches a leaf; claimed forced outcomes proven by the exhaustive solver for **every** defence (not only
  the authored ones); for non-forced lines, each authored reply is checked to not be a blunder for the side
  playing it (safety guard) so lessons do not teach against nonsense moves.

### 5.3 Multiple acceptable moves

- **Today (Verified):** forcing goals accept every move meeting the predicate; puzzles accept only the stored
  first move plus `alternatives`, which the verifier requires to be the complete winning set.
- **Proposal:** every decision point has an explicit **move table** covering all legal moves (30–45 in a
  middlegame), produced at authoring time and committed:
  - `best` / `good` → accepted (feedback distinguishes them, never "wrong");
  - `playable` → accepted with a comment ("possible, but it does not do X"), configurable per exercise as accepted
    or "try again, without penalty" for teaching steps;
  - `mistake` / `blunder` → rejected, each with a reason key (what the opponent does next);
  - unlisted moves fall into a default class computed by §5.4 (safety guard + objective).
  A generator script proposes the table (search scores, features, solver results); the author edits; the content
  reviewer approves. The validator checks the table is complete, every claim it makes (e.g. "loses the chariot")
  is reproduced by the engine, and that at least two moves are accepted where the objective allows alternatives
  (so a single stored variation is never silently forced).
- Precomputing is possible because the starting position of a decision is fixed: there are only tens of legal
  moves, so deep checks (seconds each) are affordable at authoring time and cost nothing at runtime.

### 5.4 Strategic (non-tactical) acceptance — what can honestly be judged

- **Principle (Proposal):** a strategic answer is accepted when it (1) **serves the declared learning objective**
  and (2) **is tactically safe within a stated horizon**. Exact equality with any engine's first choice is never
  required; an engine score is used only as a guard with a tolerance, and §2.4 shows why: even a strong engine's
  first choice at depth 22 was not the objectively best move.
- **Layer 1 — safety guard (computable, reliable within its horizon):** the move does not allow a forced mate
  within k moves (exhaustive, k = 2 costs ~3–5 ms on a full board, §2.2), does not lose ≥ T material within d
  plies compared with the best available alternative (material search; d = 3 costs ~60–130 ms desktop, d = 4
  ~1.4 s → authoring time or Worker), and does not leave a piece en prise to a winning capture (attack map, ~instant).
  Thresholds T and k/d are per exercise, defaults documented. Limit: tactics beyond the horizon are invisible.
- **Layer 2 — objective predicates (declarative, per exercise; computable):** examples that an in-repo evaluator
  can decide exactly from the resulting position:
  - mobility of a named piece ≥ N or increased by ≥ N (legal-move count; horse legs and elephant eyes included);
  - a piece reaches a set of squares / an open or half-open file / the opponent's side of the river;
  - development count (pieces off their starting points; chariots left the corners; horses not blocked);
  - palace safety: defenders present (advisors/elephants), no open file towards the general for an enemy chariot
    or cannon with a screen;
  - no own piece hanging; a named enemy piece attacked / restricted (its mobility reduced);
  - soldier structure facts (crossed soldiers, connected soldiers, a soldier's file blocked).
  These are facts, not judgements; the author chooses which facts express the objective.
- **Layer 3 — author table (§5.3):** the reviewed classification overrides layers 1–2 for listed moves, with a
  reason. This is where judgement lives, and it is reviewed by the content reviewer, not trusted to code.
- **What an in-repo evaluation could not judge (stated limits):** long-term plans and their timing; whether an
  opening deviation is theoretically sound; endgame theory (whether a material balance is a theoretical win or a
  draw: e.g. chariot vs. horse with defenders), compensation for sacrificed material, slow manoeuvres whose point
  is many moves deep, and anything tactical beyond the search horizon. A shallow search score difference of less
  than about a soldier is noise for teaching purposes. External engines reduce but do not remove these limits.
- **Disclosure (Proposal):** strategic feedback states its basis ("This move develops your horse and keeps your
  pieces safe for the next 2 moves"), never "the engine says this is best".
- **Graceful failure:** if a runtime check cannot finish within its budget, the move is treated as "not checked":
  accepted if the author table accepts it, otherwise neutral feedback ("this is not one of the plans this lesson
  covers") with no heart or score penalty, and the event is counted for content review.

### 5.5 Constrained training opponents

- **Today (Verified):** best defence only (forced lines), from stored moves or the exhaustive/material search.
- **Proposal:** an `OpponentPolicy` interface in `src/play/` with an injected RNG; each policy states its intended
  quality and the learner-facing disclosure:

  | Policy | Intended quality | Limits to disclose |
  | --- | --- | --- |
  | `scripted` | exactly the authored replies (deviations from §5.2) | knows nothing off the tree; hands over to another policy |
  | `best-defence` | optimal within the forced-mate horizon (today's behaviour) | only meaningful in forced lines |
  | `safe-sparring(d)` | avoids hanging pieces and simple tactics up to d plies (d = 2–3), picks randomly among moves within a tolerance of its best score | no plans, no positional understanding; can be outplayed strategically |
  | `restricted(spec)` | only some pieces move, or a fixed plan (e.g. "only develops", "only defends the palace") | deliberately unrealistic; a drill partner |
  | `greedy` | takes material whenever possible | for teaching safety and traps only |

  Strength is defined by depth/node limits (deterministic per seed), never by wall-clock time, so a phone and a
  desktop see the same opponent. Measured cost for `safe-sparring(3)` on a full board: ~60–130 ms per move desktop
  (§2.2), acceptable in a Worker.
- **Unresolved (S1.2):** which practical tasks use which policy, and whether any assessment uses `safe-sparring`
  (its weakness means beating it is weak evidence; see §5.6).

### 5.6 Practical-play tasks

- **Today (Verified):** none; the longest exercise is 4 learner moves.
- **Proposal:** a `play` exercise: start position (or the start of the game), learner side, opponent policy,
  goal and end condition:
  - `hold`: reach move N without being mated and without losing ≥ T material;
  - `convert`: from an advantage, win (mate) or reach a target material/position within N moves;
  - `play-out`: play until adjudication (mate, repetition rule, move cap) from a middlegame position;
  - `game`: a full game from the initial position against a policy, with a move cap.
  Needs: a game record in `src/play/` (moves, position keys, timestamps), the adjudicator (§5.7), mid-game
  persistence through `src/storage` (a reload or tab switch does not lose the game), a post-game review that runs
  the safety guard on each learner move in the Worker (with a budget per move) and lists blunders, and rubric
  scoring from `design/03-assessment.md`.
- **Evidence limits (Proposal, for 03-assessment):** results against `safe-sparring` show safety and basic
  conversion, not strength against humans; rubric items based on the post-game review (blunders per game,
  undefended pieces left, development by move N) are measurable; "had a plan" is not machine-measurable and needs
  self-analysis tasks (the learner annotates their own game, compared with the review).

### 5.7 Repetition adjudication

- **Today (Verified):** nothing; positions carry no history (`types.ts:26-33`).
- **Needed for any task longer than a few moves.** Without it a learner can repeat moves forever in `hold` or
  `play-out` tasks.
- **Proposal:** in `src/play/adjudicate.ts` (outside the engine):
  - position key = board + side to move (FEN without counters, or a Zobrist hash shared with `src/analysis`);
  - detect the third occurrence of a key; classify every move of the repeated cycle as *check* or *other*
    (check is exact: `isInCheck` after the move);
  - a **training ruleset** that the code can decide exactly: (1) one side checks on every move of the cycle and the
    other does not → the checking side loses (perpetual check is forbidden); (2) both sides check perpetually, or
    neither does → draw; (3) **perpetual chase is not adjudicated** (it needs judging whether each move creates a
    new attack on an unprotected piece, with many exceptions in the official rules); (4) tasks have explicit move
    caps instead of a general no-capture rule; full games use a no-capture move limit chosen by S1.2.
  - The adjudicator is pluggable (`adjudicate(record): Outcome | null`) so a fuller ruleset can replace it.
- **Disclosed limitation:** the training ruleset can call a perpetual chase a draw where official Asian/Chinese
  rules would make the chasing side change moves or lose. Tasks are designed so this does not decide the
  assessment (move caps, goals that a chase does not satisfy).
- **Unresolved (S1.2 owns the ruleset choice, `design/03-assessment.md`):** which official ruleset the course
  names as its reference, the no-capture limit for full games, and whether repetition draws count as a pass in
  `hold` tasks.

### 5.8 Three-level progress (completed / mastered / applied)

- **Today (Verified):** one level only (completed lesson ids, `src/storage/index.ts:61`), synced by union; no
  attempt data; sync drops unknown remote fields (01-audit.md §3.6).
- **Proposal — local data:** a new repository in `src/storage` with its own versioned key (e.g.
  `learning.records.v1`), containing:
  - `completed`: lesson ids (content completion; includes migrated v1 completion);
  - `mastery`: per unit/skill `{ status: 'mastered', at, score, strandScores, assessmentVersion }` — set only by an
    independent assessment (03-assessment.md), never by migration, XP, streaks or lesson completion;
  - `applied`: per unit/strand a list of practical-play evidence `{ taskId, at, rubric }`;
  - `attempts`: a bounded log per assessment item `{ itemId, firstAttemptCorrect, hintsUsed, retries, at }`, also
    used for branch coverage (§5.2).
  The v1 keys stay written and readable for rollback and for older builds (dual-write of `completedLessons`).
- **Migration (owned by S1.3):** a pure, versioned `migrate(v1 ids, mapping)` that only fills `completed` from the
  S1.3 mapping table; tests cover unknown ids, retired ids, repeated runs (idempotent) and rollback.
- **Proposal — sync:** keep `data` (v1 JSON) as is and add a **separate column** (e.g. `data_v2 jsonb`) by a new
  migration, so older builds — which upsert only `{ user_id, data }` (`src/sync/supabase.ts:79`) — cannot erase
  the new data. Merge for the new data: completion = union; mastery = per unit the record with the higher score
  (ties: later `at`), i.e. monotone; applied and attempts = union by id, capped. **Unresolved:** confirm against a
  real Supabase project that an upsert listing only `data` leaves `data_v2` unchanged (expected from PostgREST's
  `ON CONFLICT DO UPDATE` on the given columns; not verified here), and whether mastery can be revoked by a later
  failed reassessment (a monotone merge cannot express revocation; same limitation as "reset", `merge.ts:18-19`).

---

## 6. Integration options

### 6.1 Options compared

| | A. In-repo search in a Web Worker | B. Fairy-Stockfish WASM in the app | C. Pikafish | D. External engine at authoring time only |
| --- | --- | --- | --- | --- |
| Licence | the repo's own code (the repo has no LICENSE file today) | GPL-3.0 (npm `fairy-stockfish-nnue.wasm`, `ffish`, `ffish-es6`: verified via `npm view`) | GPL-3.0 (upstream project; not packaged on npm — `npm view pikafish` 404) | engine licence applies to the tool, which is not shipped |
| Size shipped | tens of KB of JS (estimate) | `stockfish.wasm` 1,636,293 B (491,755 B gzip) + `stockfish.js` 64 KB + worker 3 KB (measured from the npm tarball); NNUE network files extra, not measured | not measured; NNUE networks are separate downloads, not measured | 0 |
| Offline PWA | yes (precached JS) | needs `wasm` (and any network file) added to Workbox `globPatterns`; Workbox's default per-file precache limit is 2 MiB, so a large network needs a raised limit | as B | n/a |
| Hosting | none | uses pthreads / `SharedArrayBuffer` (strings in `stockfish.js`: "requested a shared WebAssembly.Memory") → requires cross-origin isolation (COOP/COEP headers). GitHub Pages cannot set headers; a service-worker workaround (e.g. coi-serviceworker) is needed and must be tested with the existing PWA service worker | as B, if a WASM build exists | none |
| Strength | weak: material + features, ~4–6 plies in a budget | strong (classical eval measured: depth 12 in 1.4 s desktop, 1 thread) | strongest xiangqi engine family (not measured) | as B/C |
| Rules | ours (perft-verified), no repetition | its own xiangqi rules incl. repetition handling (upstream claim, not verified here) | as B | cross-check only |
| Determinism / tests | deterministic with depth/node limits; runs in Vitest | multithreaded search is not deterministic; hard to unit-test | as B | evidence stored as data |
| Phone cost | bounded by our budgets | heavy CPU, memory; start-up ~1.2 s in Node (desktop) | heavier | none |

### 6.2 Notes

- B also offers `ffish` (rules/notation library, GPL-3.0, `ffish.wasm` 921,975 B): it has `result(claimDraw)`
  / `isGameOver(claimDraw)` (from `ffish.d.ts`), i.e. a second opinion on game termination, under the same licence
  question.
- A server-side engine is out of scope (static site, no backend in this phase; CLAUDE.md).
- Engine output is evidence, not verification (§2.4): the external engine both confirmed our mate line and, at a
  normal search depth, missed it.

### 6.3 Licensing — Unresolved (owner decision)

- The repository has no LICENSE file and `package.json` declares none, so the code is "all rights reserved" by
  default.
- Shipping a GPL-3.0 engine in `dist/` is distribution of GPL object code: at minimum the engine's licence text,
  copyright notices and an offer of the corresponding source (including build scripts) must accompany it. Whether
  the rest of the app must then be GPL depends on whether app + engine form one "work based on the program"; an
  engine in a separate Worker spoken to over the text UCI protocol is close to the "separate programs
  communicating" case in the FSF's GPL FAQ, but this is a legal judgement this document cannot make.
- Using an engine **only at authoring time** (installed outside the repo, like the global Playwright used by
  `ui:check`) does not distribute it; its analysis output is data, not GPL code. Do not vendor engine binaries or
  sources into this repository.

---

## 7. Recommendation — Proposal

1. **Runtime: option A.** Build `src/analysis` (bounded iterative-deepening search with a transposition table,
   feature-based evaluation, safety guard, objective predicates) in a Web Worker, plus `src/play` and
   `src/assessment`. It needs no licence change, no hosting change, works offline with the current PWA set-up, is
   deterministic and testable, and its weakness is acceptable because strategic verdicts come from reviewed,
   precomputed move tables (§5.3), not from runtime engine strength.
2. **Authoring: option D.** A `scripts/` tool that cross-checks forced claims with the exhaustive solver and,
   optionally, with an external engine installed outside the repo; disagreements block publication until a
   reviewer resolves them. Evidence (depths, engine/version, date) is stored with the content.
3. **Option B only if the pilot shows A is insufficient** for an approved practical-play task, and only after the
   owner settles §6.3 and a cross-origin-isolation test on GitHub Pages with the existing service worker passes.
   Pikafish (C) is not recommended for the PWA without a measured WASM build and network size.
4. **Order for step 2** (inputs for S1.4): Black orientation and colour-neutral judges → move tables and objective
   predicates (single decisions) → Worker client with budgets/fallback → branching `line` exercises → training
   opponents + adjudicator → `play` tasks → three-level progress storage + migration + sync column. The pilot needs
   all except possibly full games.
5. **Budgets to adopt (to be confirmed on phones in S2):** UI-thread work ≤ ~50 ms desktop; Worker requests
   ≤ ~300 ms desktop at the chosen depth/node limits; anything slower precomputed at authoring time.

## 8. Unresolved decisions (collected)

| # | Decision | Owner |
| --- | --- | --- |
| R1 | Coordinates/notation shown to learners (ICCS, traditional 1–9 per side, both) | S1.2 / learning experience |
| R2 | Reference ruleset, no-capture limit, perpetual-chase handling disclosure, repetition outcome in `hold` tasks | S1.2 (`03-assessment.md`) |
| R3 | Whether any assessment counts results against `safe-sparring` opponents | S1.2 |
| R4 | Licence of this repository; whether a GPL engine may ever ship in the app | owner |
| R5 | Supabase: separate `data_v2` column behaviour with old clients; mastery revocation | S1.3 + S2 test |
| R6 | Phone slowdown factor (measure §A.1 on real devices) | S2 pilot |
| R7 | Default safety-guard thresholds (k, d, T) per level | S1.2 + content reviewer |

---

## Appendix A — Measurement scripts

Run from the repository root; the scripts import the repo's TypeScript through `tsx` (a dev dependency) and write
nothing. Keep them outside the repo (e.g. `S=$(mktemp -d)`).

### A.1 Engine and solver timings (`$S/timing.mts`, run: `npx tsx $S/timing.mts "$PWD"`)

```ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const repo = process.argv[2];
const E = await import(join(repo, 'src/engine/index.ts'));
const A = await import(join(repo, 'src/lessons/answers.ts'));
const C = await import(join(repo, 'src/lessons/combination.ts'));
const time = (label: string, fn: () => unknown, reps = 1) => {
  const t0 = performance.now();
  let r: unknown;
  for (let i = 0; i < reps; i++) r = fn();
  const ms = (performance.now() - t0) / reps;
  const shown = Array.isArray(r) ? `${r.length} moves` : typeof r === 'number' ? Math.round(r * 10) / 10 : String(r);
  console.log(`${label.padEnd(70)} ${ms.toFixed(1).padStart(9)} ms  -> ${shown}`);
};
const start = E.parseFen(E.START_FEN);
for (const d of [1, 2, 3, 4]) time(`perft(start, ${d})`, () => E.perft(start, d));
for (const d of [1, 2, 3, 4, 5]) time(`searchScore(start, ${d})`, () => E.searchScore(start, d));
let mid = start;
for (const [f, t] of [['h2', 'e2'], ['h9', 'g7'], ['h0', 'g2'], ['b9', 'c7'], ['i0', 'h0'], ['i9', 'h9']])
  mid = E.makeMove(mid, { from: E.parseSquare(f), to: E.parseSquare(t) });
console.log('mid FEN:', E.toFen(mid));
for (const d of [2, 3, 4, 5]) time(`searchScore(mid, ${d})`, () => E.searchScore(mid, d));
time('legalMoves(mid) x1000 (avg per call)', () => E.legalMoves(mid), 1000);
time('hasForcedWin(start, 2)', () => E.hasForcedWin(start, 2));
time('hasForcedWin(mid, 2)', () => E.hasForcedWin(mid, 2));
const exs: { id: string; ex: any }[] = [];
for (const f of readdirSync(join(repo, 'src/content/lessons')).sort()) {
  const u = JSON.parse(readFileSync(join(repo, 'src/content/lessons', f), 'utf8'));
  for (const l of u.lessons) l.exercises.forEach((ex: any, i: number) => exs.push({ id: `${l.id}#${i}`, ex }));
}
const pick = (p: (e: any) => boolean, n: number) => exs.filter((x) => p(x.ex)).slice(-n);
const mv = (s: any) => ({ from: E.parseSquare(s.from), to: E.parseSquare(s.to) });
for (const { id, ex } of pick((e) => e.type === 'combination' && e.goal === 'checkmate' && e.moves === 4, 3)) {
  const pos = A.positionOf(ex);
  time(`${id} searchWinningMove (mate in 4)`, () => C.searchWinningMove(ex, pos, 0, mv(ex.solution[0])));
  time(`${id} hasForcedWin(pos, 4)`, () => E.hasForcedWin(pos, 4));
  time(`${id} hasForcedWin(pos, 3)`, () => E.hasForcedWin(pos, 3));
}
{ const [{ id, ex }] = pick((e) => e.type === 'combination' && e.goal === 'checkmate' && e.moves === 4, 1);
  time(`${id} forcedWinMoves(pos, 4)`, () => E.forcedWinMoves(A.positionOf(ex), 4)); }
for (const { id, ex } of pick((e) => e.type === 'combination' && e.goal === 'checkmate' && e.moves === 3, 2))
  time(`${id} forcedWinMoves(pos, 3)`, () => E.forcedWinMoves(A.positionOf(ex), 3));
for (const { id, ex } of pick((e) => e.type === 'move' && e.goal.kind === 'defend', 3)) {
  const pos = A.positionOf(ex);
  time(`${id} defend depth ${ex.goal.depth ?? 1} (solution)`, () => A.checkMove(ex, mv(ex.solution)));
  const wrong = E.legalMoves(pos).find((x: any) => A.checkMove(ex, x) === 'allows-mate');
  if (wrong) time(`${id} defend depth ${ex.goal.depth ?? 1} (losing move)`, () => A.checkMove(ex, wrong));
}
```

### A.2 Lesson-player main-line costs (`$S/uipath.mts`, run: `npx tsx $S/uipath.mts "$PWD"`)

```ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const repo = process.argv[2];
const E = await import(join(repo, 'src/engine/index.ts'));
const A = await import(join(repo, 'src/lessons/answers.ts'));
const C = await import(join(repo, 'src/lessons/combination.ts'));
const rows: Record<string, { judge: number[]; reply: number[] }> = {};
for (const f of readdirSync(join(repo, 'src/content/lessons')).sort()) {
  const u = JSON.parse(readFileSync(join(repo, 'src/content/lessons', f), 'utf8'));
  for (const l of u.lessons) for (const ex of l.exercises) {
    if (ex.type !== 'combination') continue;
    const r = (rows[`${ex.goal}/${ex.moves}`] ??= { judge: [], reply: [] });
    let pos = A.positionOf(ex);
    for (let step = 0; step < ex.solution.length; step++) {
      const m = { from: E.parseSquare(ex.solution[step].from), to: E.parseSquare(ex.solution[step].to) };
      const t0 = performance.now();
      if (step % 2 === 0) { C.checkCombinationMove(ex, step, pos, m); r.judge.push(performance.now() - t0); }
      else { C.bestCombinationReplies(ex, pos, step); r.reply.push(performance.now() - t0); }
      pos = E.makeMove(pos, m);
    }
  }
}
const stat = (a: number[]) => { const s = [...a].sort((x, y) => x - y);
  return `n=${s.length} median=${s[Math.floor(s.length / 2)].toFixed(1)} max=${s[s.length - 1].toFixed(1)} ms`; };
for (const [k, v] of Object.entries(rows)) console.log(k.padEnd(16), 'judge', stat(v.judge), '| reply', stat(v.reply));
```

### A.3 Fairy-Stockfish cross-check (outside the repo; downloads a GPL package into a temp dir)

```sh
S=$(mktemp -d); cd "$S" && npm pack fairy-stockfish-nnue.wasm@1.1.12 && mkdir fsf && tar -xzf fairy-stockfish-nnue.wasm-1.1.12.tgz -C fsf
cat > "$S/fsf.cjs" <<'EOF'
// node fsf.cjs <pkgdir> "<fen [moves ...]>" ; GO="depth 12" or GO="mate 4"
const fs = require('fs'); const path = require('path');
const [pkg, fen] = process.argv.slice(2);
const Stockfish = require(path.join(pkg, 'stockfish.js'));
(async () => {
  const sf = await Stockfish({ wasmBinary: fs.readFileSync(path.join(pkg, 'stockfish.wasm')), locateFile: (f) => path.join(pkg, f) });
  let t0;
  sf.addMessageListener((line) => {
    if (/^info depth \d+ .* pv /.test(line)) console.log(Date.now() - t0 + 'ms', line.slice(0, 160));
    if (line.startsWith('bestmove')) { console.log(line); sf.postMessage('quit'); setTimeout(() => process.exit(0), 50); }
  });
  sf.postMessage('setoption name UCI_Variant value xiangqi');
  sf.postMessage('setoption name Threads value 1');
  sf.postMessage(`position fen ${fen}`);
  t0 = Date.now();
  sf.postMessage(`go ${process.env.GO ?? 'depth 12'}`);
})();
EOF
GO="mate 4" node "$S/fsf.cjs" "$S/fsf/package" "2b2N3/1N2ak3/5a3/6R2/2bc5/5c3/9/8B/9/4K4 w - - 0 1"
GO="depth 12" node "$S/fsf.cjs" "$S/fsf/package" "2b2N3/1N2ak3/5a3/6R2/2bc5/5c3/9/8B/9/4K4 w - - 0 1 moves f10h9"
GO="depth 16" node "$S/fsf.cjs" "$S/fsf/package" "r1bakabr1/9/1cn3nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKABR1 w - - 6 4"
```

The package's own `uci.js` fails under Node 22 (its loader fetches the `.wasm` by path); passing `wasmBinary`
as above avoids that.
