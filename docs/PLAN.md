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
- PR: https://github.com/BaohuyTran/duohuygo-xiangqi/pull/1, merged into `main` on 2026-10-16 (with the user's permission).
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

**Status:** done

**Goal:** Make the app feel finished on phones without adding gameplay: sound, animation, verified
offline support and layout fixes.

**Acceptance criteria**

- [x] **Sound effects** for correct, wrong, move, capture and lesson/puzzle complete. They are generated in code
      (Web Audio) or are original or CC0 assets with the licence recorded in the repo. A mute toggle is stored
      via `src/storage`, and sound respects the muted setting from the first interaction.
- [x] **Animations:** feedback panel slide-in, correct/wrong emphasis, capture/move animation, completion
      celebration. All respect `prefers-reduced-motion`.
- [x] **Offline PWA check:** an automated check (script or test) builds the app, loads it once,
      goes offline, reloads, and can open a lesson and a puzzle. The manifest and icons pass installability
      basics.
- [x] **Phone layout fixes:** no horizontal scroll or clipped controls at 320, 360 and 414px wide and in
      landscape; safe-area insets respected; fixed footers never cover the board's last row.
- [x] No new gameplay, content, exercise types or puzzle rules. No changes to `src/engine`.
- [x] Any new text is in en + vi; build, tests and lint pass; CLAUDE.md updated if needed.

**Notes**

- 2026-10-16: started on branch `task-5-polish`, stacked on `task-4-xp-hearts-streaks` (PR #1 not merged
  yet; the user asked to continue). Its PR targets that branch until #1 is merged.
- PR: https://github.com/BaohuyTran/duohuygo-xiangqi/pull/3, retargeted to `main` and merged on 2026-10-16 (with the user's permission).
- 2026-10-16: done in 1 of 3 attempts.
  - Tester: PASS.
    - Lint, build and 271 tests pass, and the engine is unchanged.
    - `ui:check` passes at 320x740, 360x740, 414x896, 740x360 and 640x320.
    - `offline:check` passes, and so does the tester's own offline check.
    - Sound gating was checked in a real browser: with mute stored, no audio plays from the first tap.
    - Animations are switched off under reduced motion.
  - Reviewer: APPROVE, with no blocking findings.
- Added: `src/sound/` (code-generated Web Audio effects; mute stored as `settings.muted.v1`), `SoundToggle`,
  `Celebration`, `useElementHeight` (footer measured, with a spacer so it can't cover the board), `.board-fit`,
  safe-area insets, `npm run offline:check`, and stricter `scripts/ui-check.mjs` (`--height`, clipped controls,
  footer covering the board's last row).
- Open follow-ups (non-blocking, from the reviewer and tester):
  - Make the older progress-bar and Home transitions `motion-safe:`.
  - The capture fade does not replay for two identical captures in a row on the same square (Board ghost key).
  - The first gesture being "Turn sound off" creates a silent AudioContext.
  - The capture sound and animation are only unit-tested, not checked in a browser.
  - The wrong-answer footer is cramped in very short landscape (640x320): the last row is reached by scrolling.
- Process note: roles ran with the general-purpose agent fallback (`docs/DRIVER.md`, PR #2); the base
  branch was `task-4-xp-hearts-streaks`.

---

## Task 6 — Supabase login and sync (optional)

**Status:** done · **optional** (requested explicitly by the user on 2026-10-16)

**Goal:** Optional account login and cross-device sync of progress using Supabase, implemented
behind the existing storage interfaces so the app still works fully offline and without an account.

**Acceptance criteria**

- [x] A Supabase-backed implementation of the storage repositories (or a syncing `KeyValueStore`) sits behind
      the existing interfaces. UI components do not import Supabase.
- [x] Login via email magic link (OAuth optional); logout; the app works unchanged when signed out.
- [x] Offline-first: local data is the source of truth until it syncs. There is a documented merge rule
      (e.g. union of completed/solved ids, max of XP and best streak), with unit tests for that merge rule.
- [x] SQL migrations with Row Level Security in `supabase/`. Keys come from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`;
      no secrets in the repo. Without these variables the feature is hidden and the build still succeeds.
- [x] The app stays a static build (free static hosting). No custom server.
- [x] New text in en + vi; tests mock Supabase (no network in CI); CLAUDE.md documents setup.
- [x] No changes to `src/engine`.

**Notes**

- 2026-10-16: started on branch `task-6-supabase-sync` (from `main` after PRs #1–#3 were merged).
- PR: https://github.com/BaohuyTran/duohuygo-xiangqi/pull/4, merged into `main` on 2026-10-16 (with the user's permission).
- 2026-10-16: done in 1 of 3 attempts.
  - Tester: PASS.
    - Lint, build and 337 tests pass, and the engine is unchanged.
    - The default build ships no Supabase code and shows no account UI; `ui:check` and `offline:check` pass on it.
    - The env build passes, with Supabase in a lazy chunk.
    - In Playwright with Supabase mocked: the magic-link request, the error state, a simulated signed-in sync and logout all work.
    - No secrets in the repo, and the RLS migration was read and checked.
  - Reviewer: APPROVE, with no blocking findings.
- Added:
  - `src/sync/`: merge rule, account/sync service, config, and the only Supabase import in `supabase.ts`, loaded via dynamic `import()`.
  - `Account.tsx` (button and panel), `readSnapshot`/`writeSnapshot` in `src/storage`.
  - `supabase/migrations/20261016000000_progress.sql`, `.env.example`, and a CLAUDE.md setup section.
- **Not verified against a real Supabase project.** None is connected here, so magic-link email delivery, the real auth
  redirect and the RLS policies under Postgres still need a manual check after you create the project.
- Open follow-ups (non-blocking, from the reviewer and tester):
  - "Reset progress" while signed in is undone by the next sync, because a union can't express deletion. Hide or disable it, or add a reset epoch.
  - In the env build the 216 kB Supabase chunk is precached for every visitor.
  - A streak can drop to 1 in an offline two-device edge case; `bestStreak` is kept.
  - Same-day XP on two unsynced devices merges as a max, not a sum.
  - The synced daily goal effectively stays per device; reword the docs.
  - On iOS the magic link opens in Safari, not the installed PWA; consider a 6-digit code.
  - No retry when the Supabase chunk fails to load until the app is reloaded.
  - Add service tests for sign-out during a pull.
  - Optional migration hardening: revoke-all before the grants, and a size limit on `data`.
- Process note: roles ran with the general-purpose agent fallback (`docs/DRIVER.md`).

---

## Task 7 — Intermediate course

**Status:** done · requested by the user on 2026-10-19 ("make the course harder, for intermediate level")

**Goal:** A second, harder track for players who already know the rules, open from the start.

**Acceptance criteria**

- [x] Units 7–10 (`track: "intermediate"`): cannon mates (Double Cannon, Smothered General, Horse-behind-Cannon),
      horse and chariot mates (Palcorner Horse, Two Chariots, Chariot and Horse, the General in attack),
      tactics (forks, double check, stopping a mate threat) and combinations (sacrifices, quiet moves, mate in 3).
- [x] New `combination` exercise: 2–3 Red moves against the engine's best defence, with hints, hearts and retry.
- [x] New `defend` move goal: stop Black's mate-in-one threat.
- [x] The intermediate track's first lesson is open from the start; Home has track headers and a jump link.
- [x] Every position is original and engine-verified by the validator; en + vi text; no changes to `src/engine`.

**Notes**

- 2026-10-19: branch `intermediate-course`. 13 new lessons, 71 exercises (37 combinations incl. 4 mate-in-3, 5 defend).
- Lint, build, all tests, `ui:check` at 360 and 320 px pass; the Double Cannon lesson was played through in
  Chromium (wrong move → heart lost, engine reply, mate recognised, completion screen).

---

## Task 8 — Shorter basics and jump-ahead tests

**Status:** done · requested by the user on 2026-10-21

**Goal:** Make the beginner track shorter and let learners skip ahead by passing a short test, like Duolingo.

**Acceptance criteria**

- [x] Basics compressed from 6 units / 18 lessons / 84 exercises to 4 units / 9 lessons / 48 exercises, keeping
      one example of every rule (no real users yet, so lesson ids were renumbered freely).
- [x] Tapping a locked lesson (or "Jump here" on a locked unit) offers a jump-ahead test built from the skipped
      lessons; 3 lives of its own, no real hearts used; passing completes the skipped lessons (no XP).
- [x] en + vi text, tests for the selection rule, the test mode and the full App flow; no changes to `src/engine`.

**Notes**

- 2026-10-21: branch `shorter-basics-skip`. Lint, build, 389 tests, `ui:check` at 360, 320 and 740×360 pass;
  the jump dialog, a failed test and the return to Home were checked in Chromium.
