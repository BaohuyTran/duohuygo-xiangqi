# Pilot walkthrough (S2.19)

Date: 2026-11-11. Base: `206797d` (S2.18). Partner regime: `fallback` (D16). Release state: REL-P.

## How it was run

- **Preview walkthrough:** `npm run ui:check -- --preview --parallel 3`. It runs
  `scripts/ui-walkthrough/walkthrough.ts` through tsx. That script builds the course preview (`VITE_COURSE_PREVIEW=1`)
  into `ui-check-output/preview-dist` and the test-only fixture page `scripts/ui-fixtures/preview-fixture.*` into
  `ui-check-output/preview-fixture-dist`. Then it drives headless Chromium.
  - Each flow and viewport starts in a fresh browser context, so a fresh learner.
  - `Math.random` is seeded (seed 20261111), so check forms, placement forms and partner seeds are the same on every
    run.
  - Items are recognised from the board's accessible point names plus the prompt text. They are answered from the
    content: accepted or error rows of the move tables, correct or wrong choice options, the engine's expected
    selection, the verified `solution`, and the line trees node by node.
  - Practical tasks are played by the §5.7 reference player (`referenceLearner`). It reads the game state the app saves
    after every move.
  - Raw results are in `ui-check-output/preview/results.json`, one record per step with its screenshot path.
- **Fault injection (voided run):** a page init script wraps `window.Worker` (`scripts/ui-walkthrough/page-hooks.ts`).
  While the flag is on, every answer of the analysis Worker becomes `not-checked` / `node-limit` for the same request
  kind. The app has no test hook of its own.
- **Viewports and input:**

  | Viewport | Size | Input |
  | --- | --- | --- |
  | `320` | 320×740 | touch (taps) |
  | `360` | 360×740 | touch (taps) |
  | `414` | 414×896 | touch (taps) |
  | `landscape` | 740×360 | touch (taps) |
  | `desktop` | 1280×800 | **keyboard** |

  On desktop, buttons are pressed with focus + Enter, choice options with digit keys, and moves through the "Enter the
  move with the keyboard" picker (native selects moved by arrow keys). Board points (select-squares, move items) go
  through the board's tab stop: arrow keys to the point, its accessible name checked, then Enter (added with the W2
  fix). A step with no keyboard way is done with the mouse, logged, and fails the run (W2).
- **Checks on every screen** (every item at its start and after its answer, every result screen and every Home state):
  - the ui:check rules: no horizontal scroll, controls ≥ 44 px and not clipped, no fixed bar over the board's last row
    once scrolled;
  - a full-page screenshot;
  - no console error, no uncaught exception, no page reload while answering.
- **Screenshots:** `ui-check-output/preview/<viewport>/<flow>-<nnn>-<item or screen>.png`. For example:
  - `360/check-057-a03-check-1-result.png`
  - `desktop/course-…-a07-g1-result-fault.png`

  `ui-check-output/` is git-ignored. Re-run the command to regenerate it.

## Flows and results

Final run (after the S2.19 fixes of W1–W5 and W7, 2026-11-11): 20 flow runs (4 flows × 5 viewports), each played to
its end, 1,555 steps. The run passes (exit 0) with **0 failures and no keyboard gaps**. There were no audit failures, no
console errors, no uncaught exceptions and no reloads. The first run (before the fixes) failed 7 times on W1 (all 5
viewports) and W2 (2 keyboard-gap kinds); see the findings.

Colours: **B** = Black, **R** = Red. Each line below passed at **all five viewports** (320, 360, 414, landscape, desktop
keyboard). On desktop every step was done by keyboard, board points included (Tab stop + arrow keys + Enter, W2 fix).
The seeded `Math.random` gives the same forms at every viewport.

### `course` (real preview, 61 items per viewport, both colours)

| Step | Colour | Result |
| --- | --- | --- |
| Home: path b09, i08, a03, a07 (legacy hidden) | — | pass |
| `b09l3`: learn ×2, choice ×2 (multi-select), decision ×3, line `b09l3-08` | B | pass |
| `b09-g1` opening task (F5, 8 moves): disclosure opened, reference play → "Task passed!" 100 | R | pass |
| `i08l3`: learn ×2, lines ×4, decision ×1; `i08-g1` (F5, 8 moves) → passed 100 | R | pass |
| `a03l1`: `a03l1-02` select-squares and `a03l1-03` decision answered **wrong first** ("Not quite", heart lost), retried right | R+B | pass |
| `a03l2`: `a03l2-02` line, wrong first move then retry; three more lines, one decision | R+B | pass |
| `a03l3` + `a03-g1` plan task (F1, 3 moves) → passed 100 | R+B | pass |
| Home after the a03 lessons: "3 of 3 lessons completed", "Mastery: not assessed yet", **"Unit check" offered** (W1 fixed) | — | pass |
| a03 check cycle in the real preview, see the table below | R+B | pass |
| `a07l4`: decisions ×3, defend moves ×2 (depth 2; desktop by board keyboard) | B | pass |
| `a07-g1` hold task **with fault injection** (7 analysis answers made not-checked) → "Not assessed", "The task is over. This run could not be assessed…", "New game" offered | B | pass |
| `a07-g1` new game → "Task passed!" 100; lesson completed; Home "1 of 1 lessons completed", "Applied in play" | B | pass |

**a03 check cycle (real preview; interleaved items from `b08-check` / `i01-check`, units outside the path):**

| Step | Result |
| --- | --- |
| Unit check 1: intro "8 questions"; form **a03-c07, a03-c05, a03-c14, a03-c12, a03-c08, a03-c06 + i01-c01, i01-c02** | shown; wrong answers show only right/wrong, the row reason and the refutation (W3) |
| All 8 answered wrong → **"Not mastered yet"**, "Score: 0 / 100", "A safety question was missed", lessons to revisit: The worst piece, Routes, Improve instead of attack | pass |
| Home: "Mastery: not mastered yet", only "Practise before the retake" (no retake button) | pass |
| Remediation practice, no hearts: **a03l1-02, a03l1-03, a03l2-02** (the G1 items not right first time; no learn card, see the S2.20 notes) | pass |
| Home: "Unit check" offered again | pass |
| Retake: a **new** form **a03-c09, a03-c16, a03-c13, a03-c03, a03-c11, a03-c04 + b08-c02, b08-c01**, all right → **"Unit mastered"**, "Score: 100 / 100" | pass |
| Home: **"Mastered (unit check)"**, "3 of 3 lessons completed", "Applied in play" | pass |

### `check`: the check cycle on the stub fixture (fixture page `?stubs=b08,i01`, 37 items per viewport)

Written for the first run, while W1 blocked the real preview: the fixture page adds one-card stub units `b08` and `i01`
to the path, so the interleaving pools count as "earlier in the path". It is kept as a second route through the same
code. In the final run it gives the same forms, remediation set and states as the real-preview cycle above.

| Step | Colour | Result |
| --- | --- | --- |
| a03l1–a03l3 as in `course` (same three items wrong first) | R+B | pass |
| Unit check 1 (same form as above), all wrong → "Not mastered yet", score 0, "A safety question was missed" | R+B | pass |
| Home: "Mastery: not mastered yet", only "Practise before the retake" | — | pass |
| Remediation practice: a03l1-02, a03l1-03, a03l2-02, no hearts | R+B | pass |
| Retake (same new form as above), all right → "Unit mastered" 100; Home "Mastered (unit check)" | R+B | pass |

### `j2`: J2 test-out of `a03` (real preview, 10 items per viewport)

| Step | Colour | Result |
| --- | --- | --- |
| Fresh learner: a07l4 locked; tap → dialog "Pass a test of 10 questions … lessons skipped: 3 … 90 out of 100" | — | pass |
| Placement intro "10 questions" → 10 `pa` items (select-squares ×3 by board keyboard on desktop, decisions ×7) answered right | R+B | pass |
| Result "Placement passed": "Total: 100 / 100 (pass: 90)", "Positional play and attack: 100%", "Mastered by placement: Improving poorly placed pieces" | — | pass |
| Home: a03l1–a03l3 completed, "Mastered (placement test)", a07l4 open | — | pass |

### `j1`: J1 placement on a fixture pool (fixture page `?pools=j1`, 21 items per viewport)

The fixture items are not learner content. They are 20 `choice` items from `src/assessment/test-fixtures.ts` (unit b09,
4 per strand, 8 Black, 5 quiet, 2 critical RS). The practical slot is `pb-g1`, the hold fixture of
`src/assessment/play-fixtures.ts`, with `equivalentOf: b09-g1`.

| Step | Colour | Result |
| --- | --- | --- |
| Placement banner ("Take the placement test") → intro "20 questions, then one practical task" (W7 fixed) | — | pass |
| J1 form: 20 items, all strands, both colours, answered right (no option feedback shown, W3); the practical slot played (F1) → "Task passed!" 100 | R+B | pass |
| Result "Placement passed": total 100, five strand lines, "Game task: 100 / 100", "Mastered by placement: Opening development principles" | — | pass |
| Home: b09l3 completed, "Mastered (placement test)", "Applied in play" (`b09-g1` applied through `equivalentOf`) | — | pass |

### Default build (criterion 2)

| Check | Result |
| --- | --- |
| `npm run ui:check` at 360×740, 320×740, 414×896, 740×360 (incl. the Black fixture) | pass ×4 |
| New in `ui:check`: Home shows exactly the 36 legacy lessons (u1–u15) and no new-course lesson | pass |
| `npm run offline:check` (Worker precached, 82 moves judged offline, main-thread max 0.20 ms) | pass |
| `npm run build` and `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=dummy npm run build` | pass |
| `npm run lint`, `npm test` (83 files, 1,300 tests after the fixes) | pass |
| Console errors / uncaught exceptions (default ui:check and every preview flow) | none |

## Findings

Severity:

- **blocking**: breaks a pilot exit criterion (06 §3.3);
- **major**: harms learning or assessment validity, fix before S2.gate;
- **minor**: polish.

| Id | Severity | Description | Owner item | Status |
| --- | --- | --- | --- | --- |
| W1 | blocking | **The a03 unit check cannot be taken in the course preview** ("Unit check unavailable: not enough new questions yet"). `checkRun` (`src/components/assessmentRuns.ts`) takes interleaved items only from check pools of units *earlier in the path*. The pilot's interleaving pools `b08-check` / `i01-check` belong to units that are not in the preview path, so `earlier = []` and `assembleCheckForm` returns `cannot-build`: a03 needs 2 interleaved items. Reproduced in Node: `earlier = []` gives `cannot-build`; with i01 + b08 items it builds a valid form. No test covers `checkRun` with the real pools. Proposed fix: also accept check pools of units *not in the path* whose id comes before the unit in course order (level, then number), and add an App test with the real preview pools. The check cycle itself works (`check` flow on the stub fixture). | S2.13 (assessmentRuns.ts), content side S2.16 | fixed (attempt 1): `checkRun` also takes check pools of units not in the path that come earlier in course order (`unitBefore`: level rank, then unit number). Test `src/components/assessmentRuns.test.ts` (real shipped preview pools: a03 form of 6 own + 2 b08/i01 items; `checkOffer` not unavailable). Re-run: the `course` flow offers the check and runs the full check cycle at all 5 viewports |
| W2 | blocking | **Keyboard:** board points are not focusable, and `select-squares` and `move` items have no keyboard way. Affected: a03l1-02, a03-c01/c06/c09/c14, pa-01/06/09, a07l4-05/06. A keyboard user can therefore pass neither the a03 check nor the J2 test-out. Decision, line, play and choice screens work by keyboard (picker, digit keys, Enter). Proposed fix in `Board.tsx`: make the grid one tab stop with a roving `tabIndex` (arrow keys move the focus, Enter/Space = tap) when `onSquareClick` is set, or add the `MovePicker` to `move` items plus a point picker for `select-squares`. | S2.7 (players / keyboard picker) | fixed (attempt 1): `Board.tsx` is one tab stop with a roving `tabIndex` when `onSquareClick` is set (arrow keys in screen direction, turned for Black; Enter/Space tap; `:focus-visible` ring; names unchanged). Tests `Board.test.tsx` "Board keyboard (roving tabIndex, S2.19 W2)". The walkthrough drives board points by Tab stop + arrows + Enter; re-run: no keyboard gaps |
| W3 | major | In **assessments**, the wrong-answer panel shows the item's `commonError`, and the a03 / pa texts name the accepted moves. Example, a03-c07: "Look for the move that frees it: C3=2, C3=1, C3-1, C3+1". This reveals keys of pool items, and a neutral-prompt item shows its motif. In lessons it also gives away the retry of G1 items (a03l1-03). Either hide `commonError` in assessment mode, or rewrite the a03 / pa texts without the moves. | S2.13 (assessment mode) + S2.16 (texts) | fixed (app part only): in assessment mode the players hide purpose / key reply / common error / tempting text (decision, line, move, combination), each choice option's feedback, and the missed points of a selection; right/wrong, the played row's reason and the refutation stay. Tests in `DecisionView.test.tsx`, `LineView.test.tsx`, `ChoiceView.test.tsx`. The practice texts are W10 |
| W4 | minor | The result panel shows internal codes to learners: "Scored with the cautious rules (F5/F1) while the stronger training partner is still being checked". | S2.12 (play texts) | fixed (attempt 1): `play.result.fallback` has no `{f}` code (PlayView test checks no `F<n>` in the panel) |
| W5 | minor | A voided run's panel says both "your position is scored now" (F1 tree end) and "This run could not be assessed": contradictory. | S2.12 | fixed (attempt 1): a voided run shows `play.end.over` ("The task is over.") instead of "scored now", and no fallback line (PlayView voided-run test) |
| W6 | minor | Preview Home: the level descriptions are the legacy ones (Basics "The board, every piece, check and checkmate"; Advanced "Discovered attacks, decoys, mate in 3…") and do not describe the pilot units. Also "0 of 1 lessons completed" (plural). | S2.20 / Step 3 texts | open |
| W7 | minor | The J1 intro counts the practical task as a "question" ("21 questions"), while the J2 dialog says "tasks, the last one a game". | S2.13 | fixed (attempt 1): the intro counts practical tasks apart (`assess.intro.bodyOneTask`: "20 questions, then one practical task"; AssessmentPlayer test) |
| W8 | info | Decision screens show "Black to move" twice when the prompt already says it (a03-c07: prompt "Black to move. Play the best move." + status line). | S2.16 texts | open |
| W9 | info | S2.7 follow-up "board rows under the feedback footer at 360×740": no screen fails the "fixed bar covers the board's last row" rule at any viewport once scrolled. At 320 / 360 the result panel (max 60 dvh) covers the final position until the learner scrolls. | — | closed (no action) |
| W10 | major | **Practice feedback gives the move away.** The `.error` (commonError) texts list the accepted moves, against 02 §7.3 ("at G0 point to the idea without giving the move"). They spoil lesson retries and the §4.4 remediation practice; first-answer credit is unaffected (the text appears only after the first answer). Keys (scan of the accepted moves in traditional notation): lessons `a03l1-03.error`, `a03l1-04.error`, `a03l1-05.error`, `a03l1-06.error`, `a03l2-02.error`, `a03l2-03.error`, `a03l2-04.error`, `a03l2-05.error`, `a03l2-06.error`, `a03l3-02.error`, `a03l3-03.error`, `a03l3-04.error`, `a03l3-05.error`; a03-check `a03-c02/c03/c04/c05/c07/c08/c10/c11/c12/c13/c15/c16.error`; pa `pa-02/03/04/05/07/08/10.error`; `i01-c01.error`, `i01-c02.error`; `b08-c01.error`, `b08-c02.error`. (The `.purpose` / `.key` texts of the same items name them too, but appear only after a correct answer.) The texts are review-bound: editing them changes the contentHash and needs a new review. Must be fixed and re-reviewed before S2.gate. | S2.16 content → revision in S2.20 | open |

## Notes for S2.20 (from the S2.19 content review)

- **Interleaving outside the path:** the preview a03 check serves `b08-check` / `i01-check` items from units the preview
  path does not show. Those items are exposed (marked seen) before the learner meets their units; decide whether that is
  acceptable or whether interleaving should wait for units in the path.
- **Shared strand:** 03 §4.1 prefers interleaved items that share a strand with the unit; check how well the b08 / i01
  items match a03's strands (the assembler prefers them but falls back to any earlier item).
- **Dubious rows without an authored reason** show the generic "Safe, but not the idea" text in checks; consider authored
  reasons for the dubious rows of check items.
- **Placement feedback:** placement shows the played row's reason after each item; 03 §7.2 says right/wrong after each
  item and explanations on the result screen. Decide whether to move the reasons to the result screen.
- **Remediation learn cards:** the a03 learn cards carry no misconception tags, so §4.4 remediation adds no learn card
  (the set was only a03l1-02, a03l1-03, a03l2-02).
- **Board point size:** board points are about 35 px wide at 320 px (under the 44 px target; they are not counted as
  controls by ui:check). The keyboard path (W2) and the move picker are the alternatives; consider it in the S2.20 UI pass.

## Conclusion

No engine issue was found. The default build's legacy path is unchanged. In the final run all four pilot units play end
to end in the course preview at all five viewports, including the real a03 unit check cycle (fail → remediation →
retake → "Mastered (unit check)"), the J2 test-out, the J1 placement on the fixture pool and a voided practical run, and
every step works by keyboard on desktop. The blocking findings W1 and W2 are fixed, as are W3 (app part), W4, W5 and W7.
Open before S2.gate: **W10** (major; practice `.error` texts name the accepted moves, content revision and re-review in
S2.20), plus the minor/info items W6 and W8.
