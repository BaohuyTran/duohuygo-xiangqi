# duohuygo-xiangqi — Plan

The single source of truth for what to build next. The driver procedure in [DRIVER.md](./DRIVER.md)
picks the **first task whose status is `todo`** (optional tasks only when asked) and updates this
file as it works.

Status values: `todo` · `in-progress` · `done`. Only the driver changes a status. Every task
also has a **Notes** section, where the driver records branches, PR links, decisions and open
questions.

Project-wide rules (apply to every task):

- Static PWA, no backend (until the optional Task 6). Must work at **360px** width; touch targets ≥ 44px.
- All user-visible text goes through `src/i18n/messages.ts`, in **English and Vietnamese**.
- Persistence goes through `src/storage` (swappable `KeyValueStore` + repositories). No direct
  `localStorage` access elsewhere.
- **Never change `src/engine` behavior.** If an engine bug is found, stop and report it (see DRIVER.md).
- `npm run build`, `npm test` and `npm run lint` must pass. CI runs `npm ci`, build and test on every PR.

---

## Task 1 — Scaffold and rules engine

**Status:** done

**Goal:** Vite + React + TypeScript + Tailwind + Vitest PWA scaffold and a fully tested, pure
TypeScript Xiangqi rules engine in `src/engine/`.

**Acceptance criteria**

- [x] Installable PWA (manifest, icons, service worker), mobile-first board page.
- [x] FEN parse/serialize, legal moves for all pieces, flying general, check/checkmate/stalemate (stalemate loses).
- [x] Unit tests per piece; perft 44 / 1,920 / 79,666 / 3,290,240 from the start position.
- [x] CLAUDE.md with commands and structure.

**Notes**

- Merged to `main` (commit `1287826`). Engine cross-checked against Fairy-Stockfish on 57k positions.

---

## Task 2 — Lesson system

**Status:** done

**Goal:** Duolingo-style lessons: JSON content with a validator, four exercise types checked by the
engine, unit/lesson map, lesson player, progress in `src/storage`, English + Vietnamese.

**Acceptance criteria**

- [x] Lessons in `src/content/lessons/` with types and a validator that runs in tests.
- [x] 6 units, 3–5 lessons each, 4–6 exercises each; every exercise proven solvable by the engine.
- [x] Home map (locked / available / completed), lesson player with feedback, retry and completion screen.
- [x] Component tests for the lesson player.

**Notes**

- Merged to `main` (commit `2cb1083`). Vietnamese wording still needs review by a native speaker.

---

## Task 3 — Puzzles

**Status:** done

**Goal:** Original, engine-verified puzzles (mate in 1, mate in 2, win material) with a puzzle list
and player.

**Acceptance criteria**

- [x] Puzzles in `src/content/puzzles/` with types and a verifier that proves legality, goal and a unique first move.
- [x] 30 mate-in-1, 20 mate-in-2, 10 win-material, ordered by difficulty; generated, not copied.
- [x] Puzzle list (by difficulty/theme, solved state), player with hints, show solution, auto reply, next puzzle.
- [x] Lessons / Puzzles navigation; solved ids stored via `src/storage`.

**Notes**

- Merged to `main` (commit `ab8dd7c`), together with the workflow setup (`43b0d73`).
- All 60 puzzles cross-checked against Fairy-Stockfish move generation with no disagreements.

---

## Task 4 — XP, hearts, streaks and daily goal

**Status:** done

**Goal:** Add Duolingo-style motivation: experience points, hearts, a daily streak and a daily XP
goal, stored through the existing `src/storage` module and shown on the home screen and in the
lesson and puzzle players. English and Vietnamese.

**Acceptance criteria**

- [x] Rules live in a pure, React-free module (e.g. `src/gamification/`) with an **injectable clock**
      (`now: () => Date`) so day boundaries are testable. Days use the device's local calendar date.
- [x] **XP:** +10 for completing a lesson (first completion), +5 for replaying a completed lesson,
      +5 for solving a puzzle for the first time (difficulty bonus allowed, documented), 0 for a
      revealed solution. XP totals and per-day XP are stored.
- [x] **Hearts:** maximum 5; a wrong answer in a lesson costs 1 heart; puzzles do not cost hearts.
      Hearts refill by 1 every 30 minutes up to the maximum (computed from timestamps, not timers).
      With 0 hearts a new lesson cannot be started; the UI explains when the next heart arrives.
      Puzzles stay playable.
- [x] **Daily goal:** selectable 10 / 20 / 30 / 50 XP (default 20), with progress for today.
- [x] **Streak:** +1 for each consecutive local day on which the daily goal was met; a missed day
      resets it to 0. Current and best streak are stored.
- [x] Persistence only through `src/storage` (new repository plus the existing `KeyValueStore`), versioned keys,
      corrupt data falls back to defaults. No direct `localStorage` use.
- [x] **UI:**
  - Home and puzzle list show a stats bar (streak, today's XP / goal, hearts).
  - The lesson player shows hearts and losing one.
  - The completion and success screens show XP earned.
  - Daily goal can be changed from the home screen.
- [x] All new text in `src/i18n/messages.ts` (en + vi); touch targets ≥ 44px; works at 360px.
- [x] Tests: unit tests for XP, hearts refill, goal and streak rules (including midnight, missed day,
      refill cap, clock going backwards); component tests for hearts in the lesson player and the
      stats bar; existing tests still pass.
- [x] CLAUDE.md updated with any new folders or commands.
- [x] No changes to `src/engine`; no accounts, backend or deployment.

**Notes**

- 2026-10-16: started on branch `task-4-xp-hearts-streaks`.
- 2026-10-16: done in 1 of 3 attempts. Tester PASS (lint, build, 253 tests, engine guard clean, ui-check
  360px, Playwright checks in EN + VI). Reviewer APPROVE with no blocking findings.
- Rules: `src/gamification/` (pure, injectable clock), persisted via `createGamificationRepository`
  (`gamification.state.v1`); UI in `StatsBar.tsx`, Home, PuzzleList, LessonPlayer, PuzzlePlayer.
- Decisions:
  - At 0 hearts the current lesson can still be finished; only starting a lesson is blocked.
  - The goal is met when today's XP ≥ goal.
  - Puzzles give a flat +5 on the first solve (no difficulty bonus) and 0 on a re-solve.
  - Lesson XP is awarded on the completion screen's Continue.
  - Per-day XP history is kept for 30 days; the total is kept forever.
  - A clock set backwards never grants hearts or breaks or extends the streak.
- Open follow-ups (non-blocking, from the reviewer):
  - Setting the clock back, opening the app, then restoring it can grant hearts (the refill anchor is moved back).
  - A streak that lapsed can reappear if the clock is set back to the last goal day.
  - After raising the goal past today's XP, the bar shows "not met" although the streak day is kept.
  - "You lost a heart. 0 left." could become "That was your last heart."
- Process note: the `.claude/agents` definitions were not registered in the session that ran this (it
  was started outside the repo checkout), so each role ran as a general-purpose agent instructed to
  follow its `.claude/agents/<role>.md` file word for word. Tool limits were enforced by those instructions, not the harness.

---

## Task 5 — Polish

**Status:** todo

**Goal:** Make the app feel finished on phones without adding gameplay: sound, animation, verified
offline support and layout fixes.

**Acceptance criteria**

- [ ] **Sound effects** for correct, wrong, move, capture and lesson/puzzle complete. They are generated in code
      (Web Audio) or are original or CC0 assets with the licence recorded in the repo. A mute toggle is stored
      via `src/storage`, and sound respects the muted setting from the first interaction.
- [ ] **Animations:** feedback panel slide-in, correct/wrong emphasis, capture/move animation, completion
      celebration. All respect `prefers-reduced-motion`.
- [ ] **Offline PWA check:** an automated check (script or test) builds the app, loads it once,
      goes offline, reloads, and can open a lesson and a puzzle. The manifest and icons pass installability
      basics.
- [ ] **Phone layout fixes:** no horizontal scroll or clipped controls at 320, 360 and 414px wide and in
      landscape; safe-area insets respected; fixed footers never cover the board's last row.
- [ ] No new gameplay, content, exercise types or puzzle rules. No changes to `src/engine`.
- [ ] Any new text is in en + vi; build, tests and lint pass; CLAUDE.md updated if needed.

**Notes**

- _(driver fills in)_

---

## Task 6 — Supabase login and sync (optional)

**Status:** todo · **optional** (the driver skips it unless explicitly asked to do Task 6)

**Goal:** Optional account login and cross-device sync of progress using Supabase, implemented
behind the existing storage interfaces so the app still works fully offline and without an account.

**Acceptance criteria**

- [ ] A Supabase-backed implementation of the storage repositories (or a syncing `KeyValueStore`) sits behind
      the existing interfaces. UI components do not import Supabase.
- [ ] Login via email magic link (OAuth optional); logout; the app works unchanged when signed out.
- [ ] Offline-first: local data is the source of truth until it syncs. There is a documented merge rule
      (e.g. union of completed/solved ids, max of XP and best streak), with unit tests for that merge rule.
- [ ] SQL migrations with Row Level Security in `supabase/`. Keys come from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`;
      no secrets in the repo. Without these variables the feature is hidden and the build still succeeds.
- [ ] The app stays a static build (free static hosting). No custom server.
- [ ] New text in en + vi; tests mock Supabase (no network in CI); CLAUDE.md documents setup.
- [ ] No changes to `src/engine`.

**Notes**

- _(driver fills in)_
