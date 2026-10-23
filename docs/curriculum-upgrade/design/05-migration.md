# 05 — Existing-content reuse and progress migration

Backlog item S1.3 · Role: curriculum designer + QA (migration risks). Inputs: [01-audit.md](./01-audit.md) and
[04-architecture.md](./04-architecture.md) (approved), [02-curriculum.md](./02-curriculum.md) and
[03-assessment.md](./03-assessment.md) (attempt 3, HEAD `0125749`, unchanged at `83b2ade`; reconciled with this document in S1.4 —
see §11 for what this document depends on). Companion: [07-sourcing.md](./07-sourcing.md) (sourcing, licensing,
verification, review records). **S1.4 reconciliation:** release order fixed and §8.4.1 / T1 regenerated from it; unit
ordering and transitional locking (P3); P5; `fallback` on application grants; one move notation; §10 points to
[06-backlog.md](./06-backlog.md); §11 records status and owners.

Labels (as in 01-audit.md):

- **Verified**: read from the code or content at HEAD `0125749` (`file:line`), or produced by a command quoted here.
- **Proposal**: a design choice made here; nothing is implemented.
- **Unresolved**: needs a decision by S1.4, the owner, a reviewer or a measurement in step 2.

Exercise identifiers: `<lessonId>#<i>`, `i` = 0-based index into the lesson's `exercises` array, learn cards
included (01-audit.md convention). New ids are those of 02-curriculum.md §3.3 (`b05`, `b05l2`, `b05l2-04`, …).

---

## 1. Summary

- **Verified.** 13 units, 36 lessons, 195 exercises (49 learn cards + 146 practice) and 60 puzzles exist today
  (01-audit.md §1, re-counted by the script in §9). Progress is one list of lesson ids under
  `progress.completedLessons.v1`; it carries no date, score or provenance, and jump-test completions are stored
  exactly like earned ones (§8.1).
- **Proposal — reuse.** Every old lesson has one **successor** lesson in the new curriculum (none is retired
  outright); 9 old lessons are **keep**, 19 **revise**, 8 **move** (successor at another level); together they have
  25 distinct successors. Of the 195 exercises, 30 are keep, 145 revise, 12 move to a unit other than their lesson's
  successor, 8 retire (all learn cards); by slot: 41 learn cards, 99 `core` practice items, 47 `pool` items (§9
  script output). Reused items are **practice only** — never unit-check, placement or exam items (02 §9.4, 03 §4.2
  rule 4). Items that do not fit a lesson sequence go to a per-unit **extra-practice pool** (MU1, decided in S1.4). All 60
  puzzles stay in the puzzle bank unchanged.
- **Proposal — migration.** Old completion maps to **completed only**, on the successor lesson(s), with provenance
  `migration`. It is **derived at read time** from the untouched v1 list and a versioned `LEGACY_MAP`, never
  materialised into the new record. That makes the migration idempotent by construction, lets a wrong mapping be
  corrected by shipping a new map, and leaves nothing to undo on rollback. New evidence (completed by lesson or
  placement, mastered, applied) lives in a new key `learning.records.v1` and, when signed in, in a **new column**
  `data_v2`, so builds that know nothing about it cannot erase it. Gamification, puzzles and settings are untouched.

---

## 2. Reuse rules — Proposal

1. **Ids.** No old lesson id survives as a lesson id; every new lesson has a new id (02 §3.3). Old ids are reserved
   forever (07-sourcing.md §8) and keep living in the v1 progress list.
2. **Successor.** Each old lesson names exactly one or two *successor* lessons: new lessons that take over the old
   lesson's objective **and** receive at least one of its practice items in their lesson sequence (`core`). Only
   successors receive migrated completion (§8.5). Secondary placements (an item used as a contrast item or warm-up
   in another lesson, or put in a pool) never grant completion.
3. **Slots.** `learn` (a learn card of the target lesson), `core` (a practice item in the target lesson's sequence;
   S2/S3 authors decide its ladder step), `pool` (the unit's extra-practice pool, MU1), `—` (retired).
4. **Reused items are practice.** They may be G2/G1 items, contrast items or warm-ups. They are never G0 items of a
   unit check, placement test or exam: learners of the old course have seen them, and 03 §4.2 rule 4 also excludes
   mirrors and colour swaps of them.
5. **Traceability.** Every reused item gets a new id, `version: 1`, and a `legacyRef` field (e.g. `"u7l1#2"`); the
   validator checks that its position equals the legacy position, or that a recorded revision reason exists
   (07-sourcing.md §6). That keeps this map checkable after the old files are deleted.
6. **Re-verification.** A reused item is re-validated by the new validators (side to move, legality incl. piece
   counts and reachable points, claimed outcome, accepted alternatives). Mate-in-4 items keep their `firstMoves`
   lists and `npm run content:deep` runs after any change to them (CLAUDE.md "Lesson content").
7. **One home per position.** An existing position is used in exactly one place (lesson or pool), except that a
   learn card may show the position of the item that follows it (as today, §9 command 4: 7 such pairs). During phased
   publishing this means at most one **live** home in every release state (§8.4.1).

### 2.1 Dispositions

| Level | keep | revise | move | retire |
| --- | --- | --- | --- | --- |
| Lesson | All practice items go, positions and answers unchanged, to one successor at the **same level**; only text (feedback, names, notation) and metadata change | As keep, but at least one item changes position or answer, leaves for another lesson/pool, or a learn card is retired | The successor is at a **different level** (track) | No successor (none today; used for the 9 orphan ids of §6) |
| Exercise | Goes to its lesson's successor unit unchanged (metadata only) | Goes to its lesson's successor unit with changes (tags below) | Goes to a unit other than its lesson's successor unit | Not used; id and position reserved |

### 2.2 Change tags

| Tag | Meaning | Count basis |
| --- | --- | --- |
| `FB` | **Needs feedback rewrite.** 112 of 146 practice items share their explanation key with at least one other item (39 distinct keys) and 26 have none (§9 command 2); 02 §7 requires a position-specific explanation (what the move does here, the key reply, the tempting error) | per item |
| `LEAK` | **Prompt leaks the motif** ("Mate in 2. Look for a double check.", "Black threatens mate in 2"). Allowed for G2/G1 practice (02 §5.2); the item cannot become a G0 item without a neutral prompt, and never an assessment item (rule 4) | per item |
| `BLK` | **Black version wanted**: a good candidate for a colour-swapped twin (ranks flipped, colours exchanged). The twin is a **new item** (new id, `derivedFrom`, re-verified), counts toward the ≥ 1/3 Black share of 02 rule 2, and is also practice only | per item |
| `TXT` | Colour-specific or outdated wording ("Red sits at the bottom", "Red's side") must become neutral or name both sides | per item |
| `POS` | **Unreachable Soldier** (a Soldier that could never stand there in a game: before its river on an odd file, or behind its start rank; or two own Soldiers on one file before the river, added by D5). Accepted by the engine, but an illegal placement under 07-sourcing.md §4.1 (the puzzle verifier's reachable-point rule); 13 positions (§9 command 3). Reposition or remove the Soldier and re-verify | per item |
| `HINT` | Has per-move `hints`; map them onto the hint ladder (02 §5.2: idea → piece → move) and record their use (03 §3.1) | per item |
| `NAME` | Uses the name "Palcorner Horse"; rename to the glossary name (02 §4, Ngọa tào Horse) | per item |
| `MSG` | Claims competence ("Master level!", "Masters find it…"); rewrite: no learner label from completion (03 §9) | per item |
| `VAR` | Planned use needs the "varied defence" capability (02 e01, Needs architecture confirmation) | per item |
| `MOTIF` | The stored explanation or prompt misdescribes the motif (e.g. claims a quiet move where the main line has none); rewrite the text to what the line actually does | per item |

---

## 3. Lesson map (36 lessons) — Proposal

"Completion →" = the successor lesson(s) that receive migrated completion (§8.5). Target ids are from
02-curriculum.md §8 (attempt 3).

<!-- lesson-map:start -->
| Old lesson | Title (en) | Track | Disposition | Completion → | Other placements | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `u1l1` | The board | basics | revise | `b01l1` | `b01l2` (learn) | Full-board learn card moves to the setup lesson; b01l2–b01l4 are otherwise new |
| `u1l2` | The General | basics | keep | `b02l1` | — | FB; Black twins |
| `u1l3` | Advisor and Elephant | basics | revise | `b02l3` | — | POS on one learn card |
| `u2l1` | The Chariot | basics | revise | `b03l1` | `b06l2` | Protected-piece capture becomes a b06 contrast item |
| `u2l2` | The Horse | basics | revise | `b03l2` | `b03l3` | |
| `u3l1` | The Cannon | basics | revise | `b04l1` | `b05l2` | Mate item → b05; POS on a learn card |
| `u3l2` | The Soldier | basics | revise | `b04l2` | `b05l2` | Mate item → b05; POS on a capture |
| `u4l1` | Check | basics | revise | `b05l1` | `b02l2` (learn) | Facing-General learn cards → b02l2 (no completion: b02l2 practice is new) |
| `u4l2` | Checkmate | basics | revise | `b05l2` | `b05l3` (learn) | Stalemate card → b05l3; all four mates stay in b05l2 (deviation from 02 i10, §11.1 DV5) |
| `u7l1` | Double Cannon | intermediate | keep | `i05l1` | — | "When it fails" contrast items are new |
| `u7l2` | Smothered General | intermediate | keep | `i05l2` | — | |
| `u7l3` | Horse-behind-Cannon | intermediate | keep | `i05l3` | — | |
| `u8l1` | Palcorner Horse | intermediate | keep | `i06l1` | — | NAME (title and learn card) |
| `u8l2` | Two Chariots | intermediate | keep | `i06l2` | — | |
| `u8l3` | Chariot and Horse | intermediate | keep | `i06l3` | — | |
| `u8l4` | Your General attacks | intermediate | keep | `i06l4` | — | |
| `u9l1` | Forks | intermediate | revise | `i02l1` | `i02` pool | `#3`, `#5` are Cannon forks (the Cannon checks; every defence supplies the screen for the capture behind) — the only Cannon forks i02l1 gets; their explanations are rewritten (MOTIF); POS ×2 |
| `u9l2` | Double check | intermediate | keep | `i03l2` | — | |
| `u9l3` | Stop the threat | intermediate | revise | `i07l1` | `i07` pool | |
| `u10l1` | Sacrifice to mate | intermediate | revise | `i04l2` | `e02l1` | Split; e02l1 gets two guided warm-ups only (no completion: Expert independent items are new) |
| `u10l2` | Quiet moves | intermediate | move | `a06l3` | `a06` pool | Learn card states a06l3's objective ("not every winning move is a check") |
| `u10l3` | Mate in 3 | intermediate | move | `a02l3` | `a02` pool | |
| `u11l1` | Discovered check | advanced | move | `i03l1` | `i03` pool | POS ×1 |
| `u11l2` | Decoy | advanced | move | `i04l2` | `i04` pool | |
| `u11l3` | Stop the mate in 2 | advanced | move | `i07l1` | `a07` pool | Split; a07 gets two items as pool practice (a07l1's objective is positional prophylaxis) |
| `u12l1` | Check, check, mate | advanced | revise | `a02l3` | `a02` pool | Learn card retired (duplicate idea); POS ×2 |
| `u12l2` | Horse and Cannon finish | advanced | revise | `a02l3` | `a02` pool | Learn card retired; POS ×1 |
| `u12l3` | The quiet start | advanced | revise | `a06l3` | `a06` pool | Learn card retired (same idea as u10l2's); POS ×1 |
| `u13l1` | The only move | expert | revise | `e04l1` | — | POS on the learn card and first item; ≥ half Black needed in e04 (twins) |
| `u13l2` | Quiet moves, full board | expert | revise | `e01l3` | `e01l1`, `e01` pool | Its objective (quiet moves inside full-board mates in 3) is taken over by e01l3 "Long forcing lines"; two items serve e01l1 as practice without completion credit (its learners met only one defence, not several); VAR |
| `u13l3` | Discovered attack in 3 | expert | revise | `e01l3` | `e01` pool | Learn card retired (idea taught in i03) |
| `u14l1` | Mate in 4 | expert | revise | `e01l3` | `e01` pool | |
| `u14l2` | The quiet follow-up | expert | revise | `e01l3` | `e01` pool | Learn card retired; `#1`, `#2` contain no quiet move (MOTIF) |
| `u15l1` | Quiet mate in 4 | master | move | `e01l3` | `e01` pool | MSG; learn card retired; `#5` contains no quiet move (MOTIF) |
| `u15l2` | Full-board mate in 4 | master | move | `e01l3` | `e01` pool | Learn card retired |
| `u15l3` | Master challenge | master | move | `e04l1` | `e01` pool | Split; "final test" learn card retired (MSG); mates in 4 → pool only |
<!-- lesson-map:end -->

Consequences worth stating:

- **No Master lesson receives old content** (02 §10: "Master reusable 0"). A learner who completed all of u15 gets
  completed Expert lessons (`e01l3`, `e04l1`), not Master ones; nothing in Master is completed by migration.
- **New lessons stay open work.** Completed-by-migration can cover at most 25 of the 161 new lessons (the distinct successors); the
  rest — every new Black-side, quiet, opening, positional, endgame and practical lesson — is not completed.
- **Unlocking does not jump.** Within a level, a lesson is available only when every earlier lesson is completed
  (Verified `src/lessons/progress.ts:11-26`); a completed later lesson shows as completed but does not unlock the
  lessons before it. A learner with only `u7l*` done therefore starts the Intermediate level at `i01l1`, with
  `i05l1`–`i05l3` shown as completed.

### 3.1 What reuse provides per level (Proposal; counted from the §4 rows by target level; totals match the §9 output)

| Level | Reused `core` items | Reused `pool` items | Black items reused | Notes |
| --- | ---: | ---: | ---: | --- |
| Basic | 26 | 0 | 0 | Every basic practice item reused; Black share must come from twins (`BLK`) and new items |
| Intermediate | 50 | 8 | 0 | i05/i06 attack lessons nearly complete; their defend-as-Black lessons (i05l4, i06l5) are new |
| Advanced | 7 | 18 | 0 | Forcing-line and finishing practice only; a01, a03–a05, a07–a10 are new |
| Expert | 16 | 21 | 0 | e01 (calculation), e04l1 (only move), two guided warm-ups in e02l1; the rest of e02–e09 is new |
| Master | 0 | 0 | 0 | |

---

## 4. Exercise map (195 exercises) — Proposal

Columns: items · kind (`L` learn, `sel` select-squares, `cap` capture, `mv/any`, `mv/chk`, `m1` mate in one,
`def1/2/3` defend depth, `c2m/c3m/c4m` combination checkmate in 2/3/4, `c2w` combination win-material) ·
disposition (§2.1) · target and slot (§2 rule 3) · changes (§2.2). Every item also gets an id, `version`,
`legacyRef`, strand, colour, `tactic`/`quiet` and review metadata (07-sourcing.md §5); that is not repeated per row.

<!-- exercise-map:start -->
| Items | Kind | Disposition | Target · slot | Changes |
| --- | --- | --- | --- | --- |
| `u1l1#0` | L | revise | `b01l2` · learn | TXT ("Red sits at the bottom": show both armies; the board rotates when playing Black) |
| `u1l1#1` | L | revise | `b01l1` · learn | TXT (label both halves) |
| `u1l1#2` | L | keep | `b01l1` · learn | — |
| `u1l1#3` | sel | revise | `b01l1` · core | FB, BLK |
| `u1l2#0`, `u1l2#2`, `u1l2#4` | L | keep | `b02l1` · learn | — |
| `u1l2#1`, `u1l2#3`, `u1l2#5` | sel, cap, mv/any | revise | `b02l1` · core | FB, BLK |
| `u1l3#0`, `u1l3#2` | L | keep | `b02l3` · learn | — |
| `u1l3#4` | L | revise | `b02l3` · learn | POS (Red Soldier on d3) |
| `u1l3#1`, `u1l3#3`, `u1l3#5` | sel | revise | `b02l3` · core | FB, BLK |
| `u2l1#0` | L | keep | `b03l1` · learn | — |
| `u2l1#1`, `u2l1#2` | sel, cap | revise | `b03l1` · core | FB, BLK |
| `u2l1#3` | cap | move | `b06l2` · core | FB (exchange count shown step by step, 02 b06 Guided) |
| `u2l2#0`, `u2l2#2` | L | keep | `b03l2` · learn | — |
| `u2l2#1`, `u2l2#3` | sel | revise | `b03l2` · core | FB, BLK |
| `u2l2#4` | cap | revise | `b03l3` · core | FB |
| `u3l1#0`, `u3l1#1` | L | keep | `b04l1` · learn | — |
| `u3l1#2` | L | revise | `b04l1` · learn | POS (Black Soldier on b6) |
| `u3l1#3`, `u3l1#4` | cap | revise | `b04l1` · core | FB, BLK |
| `u3l1#5` | m1 | move | `b05l2` · core | FB, LEAK |
| `u3l2#0`, `u3l2#1` | L | keep | `b04l2` · learn | — |
| `u3l2#2` | sel | revise | `b04l2` · core | FB, BLK |
| `u3l2#3` | cap | revise | `b04l2` · core | FB, POS (Black Soldier on d6) |
| `u3l2#4` | m1 | move | `b05l2` · core | FB |
| `u4l1#0`, `u4l1#1` | L | move | `b02l2` · learn | — |
| `u4l1#2` | L | keep | `b05l1` · learn | — |
| `u4l1#3`, `u4l1#4`, `u4l1#5` | mv/chk, mv/any, cap | revise | `b05l1` · core | FB, BLK |
| `u4l2#0` | L | keep | `b05l2` · learn | — |
| `u4l2#1`, `u4l2#2`, `u4l2#3` | m1 | revise | `b05l2` · core | FB, LEAK, BLK |
| `u4l2#4` | L | revise | `b05l3` · learn | TXT (stalemate wording checked against the reference rulebook, 03 §8.1) |
| `u4l2#5` | m1 | revise | `b05l2` · core | FB, LEAK (prompt names the Soldier) |
| `u7l1#0` | L | keep | `i05l1` · learn | — |
| `u7l1#1`–`#5` | m1 ×3, c2m ×2 | revise | `i05l1` · core | FB, LEAK, BLK (#1–#3) |
| `u7l2#0` | L | keep | `i05l2` · learn | — |
| `u7l2#1`–`#5` | m1 ×3, c2m ×2 | revise | `i05l2` · core | FB, LEAK, BLK (#1–#3) |
| `u7l3#0` | L | keep | `i05l3` · learn | — |
| `u7l3#1`–`#5` | m1 ×3, c2m ×2 | revise | `i05l3` · core | FB, LEAK, BLK (#1–#3) |
| `u8l1#0` | L | revise | `i06l1` · learn | NAME |
| `u8l1#1`–`#5` | m1 ×4, c2m | revise | `i06l1` · core | FB, LEAK |
| `u8l2#0` | L | keep | `i06l2` · learn | — |
| `u8l2#1`–`#4` | c2m | revise | `i06l2` · core | FB, LEAK, BLK (#1, #2) |
| `u8l3#0` | L | keep | `i06l3` · learn | — |
| `u8l3#1`–`#4` | c2m | revise | `i06l3` · core | FB, LEAK, BLK (#1, #2) |
| `u8l4#0` | L | keep | `i06l4` · learn | — |
| `u8l4#1`–`#5` | m1 ×3, c2m ×2 | revise | `i06l4` · core | FB, LEAK, BLK (#1–#3) |
| `u9l1#0` | L | keep | `i02l1` · learn | — |
| `u9l1#1`, `u9l1#2`, `u9l1#4` | c2w | revise | `i02l1` · core | FB, LEAK, HINT, BLK |
| `u9l1#3` | c2w | revise | `i02l1` · core | FB, LEAK, HINT, POS (Red Soldier on d1, behind its start rank), MOTIF (Cannon fork: after `c8-c7` (check) every Black reply leaves `c7-h7`, the Cannon capturing the Chariot; explanation must say the Cannon checks and every defence supplies the screen) |
| `u9l1#5` | c2w | revise | `i02` · pool | FB, LEAK, HINT, POS (Red Soldier on h3), MOTIF (Cannon fork: after `g6-g8` (check) every reply leaves `g8-a8`, the Cannon capturing the Horse) |
| `u9l2#0` | L | keep | `i03l2` · learn | — |
| `u9l2#1`–`#3` | c2m | revise | `i03l2` · core | FB, LEAK, HINT |
| `u9l3#0` | L | keep | `i07l1` · learn | — |
| `u9l3#1`–`#3` | def1 | revise | `i07l1` · core | FB, LEAK, BLK |
| `u9l3#4`, `u9l3#5` | def1 | revise | `i07` · pool | FB, LEAK |
| `u10l1#0` | L | keep | `i04l2` · learn | — |
| `u10l1#1`, `u10l1#2` | c2m | revise | `i04l2` · core | FB, LEAK, HINT |
| `u10l1#3`, `u10l1#4` | c2m | move | `e02l1` · core | FB, LEAK, HINT (guided only: "sacrificed piece marked", 02 e02) |
| `u10l2#0` | L | revise | `a06l3` · learn | TXT (introduce the non-forced "quiet threat" the new lesson adds) |
| `u10l2#1`, `u10l2#2` | c2m | revise | `a06l3` · core | FB, LEAK, HINT |
| `u10l2#3`, `u10l2#4` | c2m | revise | `a06` · pool | FB, LEAK, HINT |
| `u10l3#0` | L | keep | `a02l3` · learn | — |
| `u10l3#1`, `u10l3#2` | c3m | revise | `a02l3` · core | FB, LEAK |
| `u10l3#3`, `u10l3#4` | c3m | revise | `a02` · pool | FB, LEAK |
| `u11l1#0` | L | keep | `i03l1` · learn | — |
| `u11l1#1`, `u11l1#2` | c2m | revise | `i03l1` · core | FB, LEAK, BLK |
| `u11l1#3`, `u11l1#5` | c2m | revise | `i03` · pool | FB, LEAK |
| `u11l1#4` | c2m | revise | `i03` · pool | FB, LEAK, POS (Red Soldier on f3) |
| `u11l2#0` | L | keep | `i04l2` · learn | — |
| `u11l2#1` | c3m | revise | `i04l2` · core | FB, LEAK |
| `u11l2#2`, `u11l2#3` | c3m | revise | `i04` · pool | FB, LEAK |
| `u11l3#0` | L | keep | `i07l1` · learn | — |
| `u11l3#1`, `u11l3#2` | def2 | revise | `i07l1` · core | FB, LEAK |
| `u11l3#3`, `u11l3#4` | def2 | move | `a07` · pool | FB, LEAK, BLK (a07 ≥ half Black) |
| `u12l1#0` | L | retire | — | Same idea as `u10l3#0`, which a02l3 keeps |
| `u12l1#2` | c3m | revise | `a02l3` · core | FB, LEAK |
| `u12l1#3`, `u12l1#4` | c3m | revise | `a02` · pool | FB, LEAK |
| `u12l1#1`, `u12l1#5` | c3m | revise | `a02` · pool | FB, LEAK, POS (Black Soldier on b6 / f6) |
| `u12l2#0` | L | retire | — | Generic ("Horse and Cannon deliver many final blows"); covered by a02l3's learn card |
| `u12l2#1` | c3m | revise | `a02l3` · core | FB, LEAK |
| `u12l2#2` | c3m | revise | `a02` · pool | FB, LEAK, POS (Red Soldier on f4) |
| `u12l2#3`–`#5` | c3m | revise | `a02` · pool | FB, LEAK |
| `u12l3#0` | L | retire | — | Same idea as `u10l2#0`, which a06l3 keeps |
| `u12l3#1` | c3m | revise | `a06l3` · core | FB, LEAK |
| `u12l3#3` | c3m | revise | `a06` · pool | FB, LEAK, POS (Red Soldier on f4) |
| `u12l3#2`, `u12l3#4`, `u12l3#5` | c3m | revise | `a06` · pool | FB, LEAK |
| `u13l1#0` | L | revise | `e04l1` · learn | POS (Red Soldier on b3) |
| `u13l1#1` | def2 | revise | `e04l1` · core | FB, LEAK, POS (Red Soldier on b3) |
| `u13l1#2`–`#5` | def2 | revise | `e04l1` · core | FB, LEAK, BLK |
| `u13l2#0` | L | revise | `e01l3` · learn | TXT (second learn card of e01l3: quiet moves inside long forcing lines) |
| `u13l2#1` | c3m | revise | `e01l3` · core | FB, LEAK |
| `u13l2#2` | c3m | revise | `e01l1` · core | FB, LEAK, VAR |
| `u13l2#3` | c3m | revise | `e01l1` · core | FB, LEAK, VAR, MOTIF (no quiet move: x+X) |
| `u13l2#4` | c3m | revise | `e01` · pool | FB, LEAK, POS (two Black Soldiers on file a before the river, a5 + a6) |
| `u13l2#5` | c3m | revise | `e01` · pool | FB, LEAK |
| `u13l3#0` | L | retire | — | Discovered attacks are taught in i03; e01l3 keeps `u14l1#0` |
| `u13l3#1` | c3m | revise | `e01l3` · core | FB, LEAK |
| `u13l3#2`, `u13l3#3` | c3m | revise | `e01` · pool | FB, LEAK |
| `u14l1#0` | L | keep | `e01l3` · learn | — |
| `u14l1#1` | c4m | revise | `e01l3` · core | FB, LEAK |
| `u14l1#2`–`#4` | c4m | revise | `e01` · pool | FB, LEAK |
| `u14l2#0` | L | retire | — | One learn card per lesson; e01l3 keeps `u14l1#0` |
| `u14l2#3` | c4m | revise | `e01l3` · core | FB, LEAK |
| `u14l2#1`, `u14l2#2` | c4m | revise | `e01` · pool | FB, LEAK, MOTIF (no quiet move: +Xx+, +xx+, although prompt and explanation claim one) |
| `u14l2#4` | c4m | revise | `e01` · pool | FB, LEAK |
| `u15l1#0` | L | retire | — | MSG ("Masters find it…") |
| `u15l1#1` | c4m | revise | `e01l3` · core | FB, LEAK, MSG |
| `u15l1#2`–`#4` | c4m | revise | `e01` · pool | FB, LEAK, MSG |
| `u15l1#5` | c4m | revise | `e01` · pool | FB, LEAK, MSG, MOTIF (no quiet move: xxx+) |
| `u15l2#0` | L | retire | — | Covered by e01l3's learn card |
| `u15l2#1` | c4m | revise | `e01l3` · core | FB, LEAK |
| `u15l2#2`–`#5` | c4m | revise | `e01` · pool | FB, LEAK |
| `u15l3#0` | L | retire | — | Frames a "final test" that no longer exists; MSG |
| `u15l3#1` | def3 | revise | `e04l1` · core | FB, LEAK, MSG, BLK |
| `u15l3#2`–`#4` | c4m | move | `e01` · pool | FB, LEAK, MSG |
<!-- exercise-map:end -->

Note on "move" at exercise level for u10–u15: an item of a lesson whose successor is at another level is "revise"
when it goes to that successor's unit (the level change is recorded once, on the lesson row) and "move" when it goes
to a unit other than the successor's.

### 4.1 Derived items (optional, Proposal)

Reused positions can seed **new** items, each with a new id, `derivedFrom`, full re-verification and review:
colour-swapped twins (`BLK`); "play the defender" items for a02l2 ("What will they play?") from a combination
position after the attacker's first move, where the learner plays Black's longest defence (judged by the existing
best-defence search, 04 §5.5 `best-defence`). Derived items follow rule 4: practice only.

---

## 5. Puzzle bank (60 puzzles) — Proposal

Every puzzle is **keep**: same id, same data, same `progress.solvedPuzzles.v1` key. The bank stays separate optional
practice and **never counts toward completed, mastered or applied** (02 §9.4, 03 §9 rule 5). "Link" = the unit
whose Home or remediation screen may point to that group as extra practice (no data change). The only text change is
the theme label `theme.flying-general` ("Flying general", `src/i18n/messages.ts:254`), to be aligned with the
glossary's "facing Generals" wording by the content reviewer (02 §4). Puzzle positions join the uniqueness corpus
that new assessment items are checked against (07-sourcing.md §4.4). No Black-to-move puzzle exists (01-audit A6);
any added later gets a new id.

<!-- puzzle-map:start -->
| Puzzles | Goal · theme | Disposition | Link |
| --- | --- | --- | --- |
| `m1-01`–`m1-04`, `m1-14`, `m1-15` | mate-in-1 · cannon | keep | `b05` |
| `m1-05`–`m1-09`, `m1-16`–`m1-19` | mate-in-1 · chariot | keep | `b05` |
| `m1-10`–`m1-13`, `m1-26` | mate-in-1 · horse | keep | `b05` |
| `m1-20` | mate-in-1 · double-check | keep | `i03` |
| `m1-21`–`m1-25`, `m1-27`–`m1-30` | mate-in-1 · flying-general | keep | `b02`, `i06` |
| `m2-01`, `m2-02`, `m2-08`, `m2-13` | mate-in-2 · cannon | keep | `i05` |
| `m2-03`, `m2-04`, `m2-09`, `m2-10`, `m2-14` | mate-in-2 · chariot | keep | `i06` |
| `m2-05`, `m2-06`, `m2-11`, `m2-17`, `m2-18` | mate-in-2 · flying-general | keep | `i06` |
| `m2-07`, `m2-19` | mate-in-2 · horse | keep | `i06` |
| `m2-12`, `m2-20` | mate-in-2 · soldier | keep | `i10` |
| `m2-15`, `m2-16` | mate-in-2 · double-check | keep | `i03` |
| `wm-01`–`wm-06`, `wm-08`, `wm-09` | win-material · cannon, chariot, horse, soldier | keep | `b07` |
| `wm-07`, `wm-10` | win-material · fork | keep | `i02` |
<!-- puzzle-map:end -->

---

## 6. Legacy lesson ids outside today's content — Verified history, Proposal handling

The first lesson system (commit `2cb1083`, 2026-10-15) had six basic units of three lessons each. The GitHub Pages
deploy workflow was added on 2026-10-17 (`1766559`); commit `a32c80e` (2026-10-21) shortened the basics to today's
nine lessons **reusing ids with different meanings** and without a migration (Verified: `git show <commit>:<file>`
for each lesson file; titles from that commit's `messages.ts`). Whether any learner used those builds is unknown.

- **Orphan ids** that a device or account from that window may still hold, and that today's app already ignores
  (Verified: `lessonStates` only looks up content ids, `src/lessons/progress.ts:11-26`; Home counts only content
  lessons, `src/components/Home.tsx:46`):

<!-- legacy-orphans:start -->
| Old id | Title then | Disposition | Completion → |
| --- | --- | --- | --- |
| `u2l3` | The Elephant's eye | retire | none |
| `u3l3` | The Horse's leg | retire | none |
| `u4l3` | Cannon attacks | retire | none |
| `u5l1` | Before the river | retire | none |
| `u5l2` | After the river | retire | none |
| `u5l3` | Soldiers attack | retire | none |
| `u6l1` | Facing Generals | retire | none |
| `u6l2` | Check | retire | none |
| `u6l3` | Checkmate | retire | none |
<!-- legacy-orphans:end -->

- **Ids whose meaning changed on 2026-10-21:** `u1l3` (Capturing and safety → Advisor and Elephant), `u2l1` (The
  Advisor → The Chariot), `u2l2` (The Elephant → The Horse), `u3l1` (The Chariot → The Cannon), `u3l2` (The Horse →
  The Soldier), `u4l1` (How the Cannon moves → Check), `u4l2` (The screen → Checkmate); `u1l1`, `u1l2` kept their
  titles.
- **Proposal:** treat stored ids by their **current** meaning and keep ignoring the orphans (listed in `LEGACY_MAP`
  with no target, so the completeness test covers them). Reasons: the ambiguity cannot be resolved from the data (no
  dates), the effect is limited to Basic completion (never mastery), and the app has ignored the orphans since
  2026-10-21. Lesson learned for this phase: **never reuse an id** (07-sourcing.md §8).

---

## 7. Gaps reuse does not fill (for S1.4 sizing)

Reuse supplies Red-to-move tactical practice only. Everything below must be authored new (02 §10): all Black-side
items except twins; all `choice`, `decision`, `line`, `play`, `review` items; every unit-check, placement and exam
pool; contrast ("when it fails") items; every lesson of b01l3–b01l4, b02l2 practice, b03l3 (except one capture),
b05l3, b06–b10, i01, i02l2–l3, i03l3, i04l1/l3/l4, i05l4, i06l5, i07l2–l4, i08–i11, a01, a02l1/l2/l4, a03–a05,
a06l1/l2/l4, a07–a10, e01l2/l4, e02l2/l3, e03, e04l2–l4, e05–e09, all of Master.

---

## 8. Progress migration

### 8.1 Current local storage — Verified

| Key (prefix `duohuygo:`, `src/storage/index.ts:22`) | Format | Written by | Read by |
| --- | --- | --- | --- |
| `progress.completedLessons.v1` (`storage/index.ts:61`) | JSON `string[]`; lenient parse: non-array → `[]`, non-strings dropped (`:74-82`); `add` dedups (`:85-89`) | Lesson completion `src/App.tsx:168`; **jump-test pass `App.tsx:143` — same `markCompleted`, no provenance**; sync `writeSnapshot` (`storage/index.ts:174`) | `lessonStates` (`progress.ts:11-26`), `furthestLesson`, `jumpBannerTrack`, XP `firstCompletion` (`App.tsx:153`) |
| `progress.solvedPuzzles.v1` (`:62`) | JSON `string[]` | Puzzle solve `App.tsx:191`; sync (`:175`) | `PuzzleList` counts only catalog ids (`src/components/PuzzleList.tsx:27`) |
| `settings.language.v1` / `settings.muted.v1` (`:63-64`) | raw string / `'1'`·`'0'` (`:126-129`) | settings | settings |
| `gamification.state.v1` (`:65`) | JSON, `parseState` falls back to defaults on corrupt data (`:134-145`) | gamification service | gamification service |
| auth session, prefix `duohuygo:auth:` (`src/sync/supabase.ts:33`) | supabase-js | supabase-js | supabase-js |

- "Reset progress" removes only `progress.completedLessons.v1` (`App.tsx:226-228` → `storage/index.ts:90, 102`).
- No date, score, attempt, hint, first-try or provenance data is stored anywhere (01-audit §3.3).
- The PWA uses `registerType: 'autoUpdate'` (`vite.config.ts:15`): after a deploy, a device can run the previous
  build until the new service worker takes over, so **old and new builds will use the same storage and account**.

### 8.2 Current account sync — Verified

- Table `public.progress (user_id uuid pk, data jsonb not null, updated_at)` (`supabase/migrations/20261016000000_progress.sql:5-9`);
  RLS select/insert/update own row (`:11-27`); grants are table-level (`:31-32`), so a new column is covered by
  the same grants and policies.
- `pull` selects only `data` (`src/sync/supabase.ts:74`); `push` upserts `{ user_id, data }` on conflict `user_id`
  (`:79`).
- `RemoteData` = `{ version: 1, completedLessons, solvedPuzzles, settings, gamification }` (`src/sync/merge.ts:29-38`);
  `parseRemote` never reads `version` and keeps only known fields (`:54-64`); `toRemote` writes only known fields
  (`:40-48`). **An old build drops any new field inside `data`** (01-audit A5).
- Completed lessons and solved puzzles merge by **union** (`merge.ts:66, 108-116`), so retired ids stay forever and
  Reset is undone by the next sync while signed in (`merge.ts:18-19`).
- A scheduled sync is **skipped** when `fingerprint(readSnapshot(...))` equals the last synced fingerprint
  (`src/sync/service.ts:180-189`); `readSnapshot` covers exactly the five snapshot fields (`storage/index.ts:153-170`).
  Any new progress data that is not part of the fingerprint would never trigger a sync on its own.

### 8.3 New local format — Proposal

Unchanged keys: all five keys of §8.1 keep their names and formats; nothing is renamed or deleted.

New keys:

```ts
// duohuygo:learning.records.v1 — synced (data_v2). Additive changes only within this key (§8.9).
interface LearningRecords {
  schema: 1;                                        // minor version of this key's format
  completed: Record<LessonId, CompletionGrant>;     // NEW-course lessons only; never legacy ids
  mastered: Record<UnitId, MasteryGrant>;           // set only by checks / placement (covered) / xm
  applied: Record<TaskId | ExamId, ApplicationGrant>;
  exposed: ItemId[];                                // assessment items seen in checks/placement/exams (03 §4.3)
  [unknownField: string]: unknown;                  // preserved on rewrite (written by a newer build)
}
interface CompletionGrant  { at: string /* ISO */; via: 'lesson' | 'placement'; contentVersion: number }
interface MasteryGrant     { at: string; via: 'check' | 'placement' | 'exam'; score: number /* 0–100 */;
                             strandScores?: Partial<Record<Strand, number>>; formId: string; assessmentVersion: number }
interface ApplicationGrant { at: string; via: 'practical' | 'placement' | 'exam'; score: number;
                             taskVersion: number; equivalentOf?: TaskId /* placement task ≡ unit task, 03 §7.4 */;
                             fallback?: 'F1' | 'F1c' | 'F2' | 'F2b' | 'F3' | 'F4' | 'F5' /* 03 §5.2, added in S1.4 */ }

// duohuygo:learning.attempts.v1 — local only, capped (e.g. newest 2,000 entries): the attempt record of 03 §3.1.
```

- **Attempt log local only:** this departs from 04 §5.8, which merges `attempts` by id (capped). Reasons: size of the
  account row, and 03 §3.1 allows it ("may stay local"). What other devices need from it — which assessment items the
  learner has seen — syncs as the small `exposed` set (MU6).

- Provenance values are those of 03 §2 rule 5 plus `lesson` (completion by working through). `migration` is **never
  stored**: it exists only in the derived view (§8.4).
- After the upgrade every learner has `mastered = {}` and `applied = {}`; the UI shows "not assessed yet", never
  "failed" and never mastery for migrated completion (03 §2 rule 4).
- Only `src/storage` touches these keys (new repository `createLearningRepository(store)`), like every other key.

### 8.4 Legacy mapping: derived, not materialised — Proposal

```ts
// src/progress/legacy.ts (pure; no React, no gamification import)
// Version 1 (state REL-P, backlog S2.10): only the 9 orphans of §6, each with []. Each release of §8.4.1 adds the
// entries of the legacy lessons it retires (their "Completion →" targets of §3) and bumps the version:
// e.g. REL-1 → 2 (u1l1: ['b01l1'], …), …, REL-4 (… u15l3: ['e04l1']); REL-5 adds nothing. Map corrections (§8.7) also bump it.
export const LEGACY_MAP_VERSION = 1;
export const LEGACY_MAP: Record<string, readonly LessonId[]> = {
  u2l3: [], u3l3: [], u4l3: [], u5l1: [], u5l2: [], u5l3: [], u6l1: [], u6l2: [], u6l3: [],
};
export function legacyCompletion(v1Ids: readonly string[]): Map<LessonId, { via: 'migration'; from: string[] }>;
export function completedView(records: LearningRecords, v1Ids: readonly string[]): Map<LessonId, CompletedState>;
// CompletedState = CompletionGrant | { via: 'migration'; from: string[]; at: null }
```

- `completedView` = stored grants ∪ `legacyCompletion(v1)`; where both exist the stored grant wins (it has a date
  and real evidence). `at: null` for migration: the v1 data has no dates, and none is invented.
- Nothing is written when the app loads. The v1 list is the single source for legacy completion; the derived view
  is recomputed from it on every read (cost: one pass over ≤ 45 ids).
- Why derived instead of 04 §5.8's materialising `migrate()`: (1) idempotent and order-independent by
  construction; (2) a mapping error can be fixed by shipping a corrected map — a materialised grant could never be
  removed again because completion merges by union; (3) old builds keep adding legacy ids to v1 during the
  mixed-version period (§8.1) and those are picked up with no "has this run?" flag; (4) rollback has nothing to undo.
- **Deviations recorded:** the derived grant has `at: null` and no score or content version, which departs from
  03 §2 rule 5 ("each grant records provenance, date, score and content version"): the v1 data has none of them.
  The derived view itself departs from 04 §5.8's materialising `migrate()` for the reasons above. Both are proposed
  decisions (§10).

### 8.4.1 Phased publishing — Proposal (release order fixed in S1.4)

02 §10 (reduction 3) allows publishing level by level while later levels keep the legacy content. Eight legacy
lessons have a successor at another level (`u10l2`, `u10l3` → Advanced; `u11l1`–`u11l3` → Intermediate; `u15l1`–`u15l3`
→ Expert), so the order of retirement must be defined.

Rules:

- **P1 — retirement follows the successor.** A legacy lesson stays live (old id, old file, writing to the v1 list as
  today) until the release that publishes the level of its successor (every legacy lesson has exactly one successor
  level, §3). In that release the legacy lesson is removed and its `LEGACY_MAP` entry is added (version bump). So the
  map in any release contains exactly the retired legacy lessons plus the orphans, and every target it names is
  published — T1 holds in every release state.
- **P2 — one live home.** A reused item is published in a new lesson or pool only in a release where its legacy
  lesson is retired. An item whose target level ships later than its legacy lesson's successor is **held** (served
  nowhere) in between. Rule 7 of §2 therefore reads "at most one live home in every release state".
- **P3 — remainders of a split legacy unit** keep their unit file and ids; the unit's `track` is changed to the
  successor's level, so the remaining legacy lessons appear at the level where their content will live. Ids do not
  change, so stored progress is unaffected; within that track the usual linear unlocking applies
  (`src/lessons/progress.ts:11-26`) and the first lesson of the track is open. **Unit order:** today units are ordered
  by file name only (`src/content/index.ts:6-8`), `Home.tsx:106` starts a track header whenever a unit's track differs
  from the previous unit's, and `trackLessons`/`jumpBannerTrack` take the track order from first appearance
  (`progress.ts:29-36`, `:69-75`). So, before any re-tracking or any new unit file ships, the loader orders units by
  **track rank** (`basics` < `intermediate` < `advanced` < `expert` < `master`) and then by file name (backlog item
  S2.2, with a test that every track's units are contiguous). `10-combinations.json` then stays next to
  `12-mate-in-3.json` in the Advanced block whatever the new files are called. **Transitional locking:** in REL-2 the
  Advanced track reads `u10l2`, `u10l3`, `u12l1`–`u12l3`; a learner who has not completed `u10l2`/`u10l3` (for example
  one who entered Advanced at `u11l1` before REL-2) finds the not-yet-completed `u12` lessons locked until they complete
  those two lessons or pass today's jump test. Completed `u12` lessons stay completed and replayable, and the state
  lasts one release (REL-3 retires both units). The remainder is kept **before** `u12` on purpose: ordering it after
  `u12` would instead lock learners who were working on `u10l2`/`u10l3` behind three harder lessons, and `u10l2`
  ("Quiet moves") prepares `u12l3` ("The quiet start").
- **P4 — a level with no content** (legacy lessons retired, new units not yet published) is not shown: Home lists
  only tracks present in the content and the jump banner only considers those (Verified `progress.ts:71`).
- **P5 — two regimes side by side (added in S1.4).** While a level is legacy, it keeps today's rules (its first lesson
  open, today's jump test, completion in the v1 list). A published new-course level uses the new rules (level entry
  gate and jump-ahead of 03 §7, records in `learning.records.v1`). New-course units of levels not yet published are
  visible only in the course preview (S2.2), never in the default learning path.

**Release order (decided in S1.4):** one level per release, upwards — REL-1 Basic, REL-2 Intermediate, REL-3 Advanced,
REL-4 Expert, REL-5 Master (prefix `REL-` so release states are not confused with rubrics R0–R7 or 04's R1–R8). Reasons: step 3 completes levels in this order (06-backlog.md §5), so a reviewed level does not wait
for the next one; every state then has each track either wholly legacy or wholly new (no track mixes legacy and new
units), which keeps unlocking and the release test simple. `REL-P` is the step-2 pilot state.

| State | New levels published | Legacy lessons retired (map entries added) | Legacy lessons still live | Held items |
| --- | --- | --- | --- | --- |
| REL-0 (today) | — | — | all 36 | — |
| REL-P (pilot, step 2) | — (pilot units in the course preview only) | — | all 36 | — |
| REL-1 | Basic | `u1`–`u4` (all 9) | `u7`–`u15` (27) | — |
| REL-2 | Intermediate | `u7`–`u9` (all), `u10l1`, `u11l1`–`u11l3` | `u10l2`, `u10l3` (unit `u10` re-tracked to `advanced`, P3), `u12`–`u15` | `u10l1#3`, `#4` (→ e02l1); `u11l3#3`, `#4` (→ a07 pool) |
| REL-3 | Advanced | `u10l2`, `u10l3`, `u12l1`–`u12l3` | `u13`–`u15` | `u10l1#3`, `#4` |
| REL-4 | Expert | `u13`–`u15` (all) | — | — (Master track empty until REL-5, P4) |
| REL-5 | Master | — | — | — |

Learners who completed `u11l*` see `i03l1`, `i04l2`, `i07l1` completed from REL-2; learners who completed `u10l2`/`u10l3`
keep those legacy lessons (now under Advanced) until REL-3, when `a06l3`/`a02l3` show as completed. Held items were
practice in their legacy lessons until those retired; they are unavailable until their target level ships (one
release for `u11l3#3`, `#4`; two for `u10l1#3`, `#4`).

### 8.5 Behaviour by case — Proposal (rules Verified where cited)

| Case | Behaviour |
| --- | --- |
| Old lesson completed, single successor (e.g. `u7l1`) | Successor shown completed, provenance `migration`; no mastery, no applied |
| Old lesson split (`u10l1`, `u11l3`, `u13l2`, `u15l3`; and every lesson with pool/secondary items) | Only the successor(s) in "Completion →" are completed; secondary lessons and pools are not |
| Two old lessons → one successor (e.g. `u13l2`, `u13l3`, `u14l1`, `u14l2`, `u15l1`, `u15l2` → `e01l3`) | Completed if **any** of them is completed; `from` lists all of them |
| Old lesson completed by passing a jump test | Identical to the above: v1 cannot tell them apart (Verified `App.tsx:143` vs `:168`), and the old jump test is not an assessment under 03 §7 (no score, retries, hints, motif prompts; 01-audit §3.4). Completed only. The old test samples at most 8 items across all skipped lessons (`src/lessons/progress.ts:55-60`), so a jump-completed lesson may have had **no** item answered; mapping it to completed is the one overstatement this migration accepts, limited to completion |
| Successor teaches more than the old lesson (e.g. `a06l3` adds non-forced quiet threats that `u10l2` never taught; `i04l2` adds deflection; `e01l3` adds mates in 3–4 the learner may not have met) | Still completed (completion means "worked through the content", 03 §2), never mastered; the unit check covers the new objectives. Replay is available |
| Orphan / unknown id in v1 (§6, typos, corrupt entries) | Ignored; kept in v1 untouched |
| Retired ids in the account | Stay forever (union, `merge.ts:66`); harmless inputs to the derived view. 01-audit U2: **do not prune** (an old build would re-add them) |
| New lesson whose content changed after a migrated completion | Still completed (completion is not invalidated by a new version, 03 §3.3); replay available |
| XP on first real completion of a migration-completed lesson | **Proposal:** first-completion XP (10) the first time the learner finishes the new lesson (its content is new); then replay XP. Alternative: treat migrated as completed (5). Decided in S1.4: 10 (MU4, PD-28). Gamification state itself is never changed by migration |
| Solved puzzles | Unchanged key, ids, merge and display; no state derived from them |
| Gamification (XP, hearts, goal, streak), settings | Unchanged keys, formats and merge rules (`merge.ts:69-116`); migration reads and writes none of them |
| "Reset progress" | **Proposal:** clears the v1 completed list (as today) **and** `learning.records.v1` (completed, mastered, applied, exposed) and the local attempt log; puzzles and gamification untouched, as today. Clearing v1 is required, otherwise the derived view would re-grant migrated completion. While signed in, union/monotone merges bring it back — the existing documented limitation (`merge.ts:18-19`) now also covers mastery and applied (MU3) |
| New device, signed in | Pulls `data` (v1) and `data_v2`; derived view from the merged v1 list — same result as on the first device |
| Never signed in | Everything local; identical logic without sync |

### 8.6 Sync — Proposal

1. **New column, not new fields in `data`.** SQL migration (new file, applied **before** the new build is
   deployed):
   ```sql
   alter table public.progress add column if not exists data_v2 jsonb;  -- nullable, no default
   ```
   No policy or grant change is needed (row-level policies; table-level grants, §8.2).
2. **New builds** pull `select('data, data_v2')` and push `{ user_id, data, data_v2 }`. `data` keeps the exact
   `RemoteData` v1 shape and `version: 1` (old builds share it). `data_v2` = the synced part of `LearningRecords`
   (not the attempt log).
3. **Old builds** pull only `data` and upsert only `{ user_id, data }` (Verified `supabase.ts:74, 79`). Expected
   with PostgREST's `ON CONFLICT DO UPDATE` on the given columns: `data_v2` stays as it is on update and is `null` on
   insert. **Unresolved (04 R5): must be confirmed against a real Supabase project** (test T15) before the first
   deploy that writes `data_v2`.
4. **Merge of `data_v2`** (pure, in `src/sync/merge.ts` or a sibling): `completed` = union by lesson id; same id on
   both sides → earlier `at`, then `via` order `lesson` < `placement`, then JSON string order (deterministic, so
   commutative). `mastered` = per unit the higher `score`, tie → later `at`, tie → string order (03 §2 rule 6;
   monotone). `applied` = per task the higher score, same ties. `exposed` = union. Unknown top-level fields: local
   value, else remote (preserved). Missing or corrupt remote → ignored field by field, never removes local data
   (same principle as `parseRemote`).
5. **Fingerprint and scheduling.** The sync snapshot and `fingerprint` must include the synced records. Two code
   paths use the fingerprint: the scheduled-sync skip (`service.ts:186`) and the push skip in `syncOnce`
   (`service.ts:149`, push only when the merged fingerprint differs from the remote one). If records are left out,
   a records-only change is never synced, and a records difference with an otherwise equal remote is never pushed.
   The account `store` wrapper already schedules a sync on any key write (`service.ts:191-203`).
6. **Missing column (SQL migration not run yet).** A sync pulls before it pushes (`service.ts:138`) and any thrown
   error ends the whole sync with `sync: 'error'` (`service.ts:171-172`), so both directions need a fallback:
   - **pull:** if `select('data, data_v2')` fails with an unknown-column error (expected PostgreSQL code `42703`;
     confirm in T15), re-run `select('data')`, mark `data_v2` unavailable for this session, skip the records merge
     (local records stay as they are);
   - **push:** while `data_v2` is unavailable, or if an upsert fails with an unknown-column error (expected
     PostgREST code `PGRST204`; confirm in T15), upsert `{ user_id, data }` only;
   - v1 data syncs normally; the account shows `sync: 'error'` so the problem stays visible; new-course records
     remain local until the column exists. The check is repeated on the next app start.
7. **Higher schema seen remotely** (`data_v2.schema` > supported): merge what is understood, preserve the rest,
   never lower `schema` (additive-only rule, §8.9).
8. **Mastery revocation:** none (03 §2: not revoked). A monotone merge cannot express it anyway; recorded, not a
   gap.

### 8.7 Rollback — Proposal

- **Code rollback** (redeploy an older build): the v1 keys and `data` are complete and current, because new builds
  keep writing every v1 field they still own ("dual-write": completions of still-live legacy lessons, solved
  puzzles, settings, gamification) and never delete v1 data. The old build ignores `learning.records.v1` locally
  (it reads only its own keys) and `data_v2` remotely (§8.6 item 3); the learner sees the old course with the old
  progress. New-course evidence is hidden, not lost. Rolling forward shows it again; the derived view also picks up
  any legacy completions made meanwhile.
- New-course lesson ids are **never** written into the v1 list and there is **no reverse map** (new → old): a
  reverse map would grant old completion for different content.
- **Data rollback:** never drop `data_v2` or the new local keys during a rollback.
- **Map correction:** ship a corrected `LEGACY_MAP` (version bump); the derived view changes everywhere at once.
  Corrections may only **add** targets. Removing a target would remove derived completion, which 03 §2 says is lost
  only by Reset; a target is removed only when the mapping is shown to be wrong, as a recorded decision, and the
  change is disclosed to learners as an exception.

### 8.8 Idempotency and determinism — Proposal

- `legacyCompletion` and `completedView` are pure functions of their inputs; loading writes nothing.
- The records merge is idempotent (`merge(merge(l, r), r) = merge(l, r)`) and commutative for `completed`,
  `mastered`, `applied` and `exposed` (deterministic tie-breaks), so two devices converge on those regardless of
  sync order. It is **not** commutative for unknown top-level fields (local value, else remote — the same exception
  as the per-device preferences of `merge.ts:15-16, 21-22`); those fields carry no progress state for this build.

### 8.9 Corrupt data and format evolution — Proposal

- v1 list corrupt → `[]` (Verified lenient parse) → no legacy completion; the raw value is not rewritten by the new
  code (only the existing `markCompleted` path writes it).
- `learning.records.v1` not parseable JSON → copy the raw string to `learning.records.v1.backup` (overwriting an
  older backup), then start from an empty record; never throw, never block the UI.
- Field level: a non-object section is treated as empty; an entry with an invalid `at`, a non-finite score, a score
  outside 0–100 or an unknown `via` is dropped individually; unknown lesson/unit/task ids are **kept** (they may
  come from newer content) but not shown.
- Within `learning.records.v1` and `data_v2` only **additive** changes are allowed (new optional fields, `schema`
  minor bump); readers preserve unknown fields. A breaking change uses a new key (`learning.records.v2`) and a new
  column, with its own migration — the same pattern as this one.

### 8.10 Tests needed — Proposal (for step 2; extends 03 §10 "Migration")

| # | Test | Kind |
| --- | --- | --- |
| T1 | **Per release state** REL-0, REL-P, REL-1–REL-5 of §8.4.1 (a table in the test: published levels, live legacy lessons, held items): `LEGACY_MAP` contains exactly the retired legacy lessons (with their §3 "Completion →" targets) and the 9 orphans; every target is published in that state; no live legacy lesson is in the map; every published reused item's `legacyRef` belongs to a retired legacy lesson (P1, P2); held items are served nowhere; no position has two live homes; every track's units are contiguous and each track is wholly legacy or wholly new (P3, P5); the current content matches exactly one state | unit (content) |
| T2 | Every target of an old lesson contains ≥ 1 `core` item whose `legacyRef` belongs to that old lesson; every reused item's position equals its `legacyRef` position or carries a revision reason | content validator |
| T3 | `legacyCompletion`: single, split and many-to-one cases; `from` lists; orphans and unknown ids ignored; duplicates; empty; corrupt v1 → none | unit |
| T4 | Migration never yields `mastered` or `applied`, for any input (exhaustive over the map + random id sets) | unit |
| T5 | `completedView` precedence: a stored grant beats the derived one; `at: null` only for migration | unit |
| T6 | Loading the app with v1 data writes nothing (store spy) | unit |
| T7 | Rollback simulation on one store: new build writes records; today's `readSnapshot`/`writeSnapshot`/`mergeSnapshots` run on the same store leave `learning.records.v1` byte-identical; rolling forward gives the same view | unit |
| T8 | Mixed builds on one account (fake backend with `data` + `data_v2`): an old-build push leaves `data_v2`; a new build merges both; a legacy completion made by the old build appears in the new view | unit |
| T9 | Records merge: union, higher score, tie later date, deterministic tie-breaks; idempotent, commutative, monotone (seeded random records) | unit |
| T10 | A records-only change schedules a sync, and a records difference is pushed even when the v1 part equals the remote (both fingerprint uses, `service.ts:149, 186`) | service test |
| T11 | Missing `data_v2` column: the pull falls back to `select('data')`, the push to `{ user_id, data }`; v1 data synced both ways; local records untouched; status `error` | service test (fake backend that rejects the column) |
| T12 | Corrupt local records → backup key written, empty record, app usable; corrupt remote `data_v2` ignored; higher remote `schema` preserved | unit |
| T13 | Reset clears v1 completed and records (incl. mastered/applied/exposed) and the attempt log; puzzles, settings and gamification unchanged | unit + App component |
| T14 | Gamification untouched: migration does not change the stored gamification state; the XP rule decided in MU4 | unit |
| T15 | Real Supabase project (or `supabase start`): an upsert with only `data` leaves `data_v2` unchanged on update and `null` on insert; RLS still limits both columns to the owner | manual/integration, before deploy |
| T16 | UI: Home shows migrated lessons as completed and never as mastered; units show "not assessed yet"; the progress count includes migrated completion | component |
| T17 | Purity: migration and assessment modules do not import `src/gamification` (03 §9 rule 1) | unit |
| T18 | New-course ids are never written to `progress.completedLessons.v1`: completing a new lesson, passing placement, a unit check or a practical task writes only `learning.records.v1` (store spy) | unit + App component |

### 8.11 Rollout order — Proposal

1. Run the SQL migration (§8.6 item 1) and T15 on the real project.
2. Ship the build with the new repository, derived view, records sync and tests (no new content needed).
3. Publish levels following §8.4.1: each release removes the legacy lessons whose successor level it publishes, adds
   their `LEGACY_MAP` entries, publishes the reused items whose legacy lesson is retired, and holds the others.
4. Keep the v1 keys, `data` and the map indefinitely.

---

## 9. Completeness check — Verified (script and output)

Run from the repository root; the script reads the content JSON, this document and 02-curriculum.md, and writes
nothing. Keep it outside the repository (e.g. `S=$(mktemp -d)`).

```js
// $S/check-map.mjs — usage: node $S/check-map.mjs "$PWD"
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const repo = process.argv[2];
const doc = readFileSync(join(repo, 'docs/curriculum-upgrade/design/05-migration.md'), 'utf8');
const cur = readFileSync(join(repo, 'docs/curriculum-upgrade/design/02-curriculum.md'), 'utf8');
const section = (name) => doc.split(`<!-- ${name}:start -->`)[1].split(`<!-- ${name}:end -->`)[0]
  .split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| ---')).slice(1)
  .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
const problems = [];
const once = (label, expected, got) => {
  const count = new Map(); for (const g of got) count.set(g, (count.get(g) ?? 0) + 1);
  for (const e of expected) if (count.get(e) !== 1) problems.push(`${label}: ${e} mapped ${count.get(e) ?? 0} times`);
  for (const g of count.keys()) if (!expected.includes(g)) problems.push(`${label}: ${g} is not in the content`);
};
// Content
const lessons = [], exercises = [], kinds = {};
for (const f of readdirSync(join(repo, 'src/content/lessons')).sort()) {
  const u = JSON.parse(readFileSync(join(repo, 'src/content/lessons', f), 'utf8'));
  for (const l of u.lessons) { lessons.push(l.id); l.exercises.forEach((e, i) => { exercises.push(`${l.id}#${i}`); kinds[`${l.id}#${i}`] = e.type; }); }
}
const puzzles = readdirSync(join(repo, 'src/content/puzzles')).flatMap((f) =>
  JSON.parse(readFileSync(join(repo, 'src/content/puzzles', f), 'utf8')).map((p) => p.id));
// New ids defined in 02-curriculum.md (lesson rows "| b05l2 | ..." and unit headings "#### b05 — ...")
const newLessons = new Set([...cur.matchAll(/^\| ([biaem]\d\dl\d) \|/gm)].map((m) => m[1]));
const newUnits = new Set([...cur.matchAll(/^#### ([biaem]\d\d) —/gm)].map((m) => m[1]));
// Lesson map
const lmap = section('lesson-map');
once('lesson', lessons, lmap.map((r) => r[0].replace(/`/g, '')));
const completion = new Map(lmap.map((r) => [r[0].replace(/`/g, ''), [...r[4].matchAll(/`([^`]+)`/g)].map((m) => m[1])]));
const dispL = {}; for (const r of lmap) dispL[r[3]] = (dispL[r[3]] ?? 0) + 1;
// Exercise map: `u7l1#1`–`#5` ranges and `u1l2#0` singles
const emap = section('exercise-map'); const refs = []; const core = new Map(); const dispE = {}; const slots = {};
for (const r of emap) {
  const items = [];
  for (const m of r[0].matchAll(/`(u\d+l\d+)#(\d+)`(?:–`#(\d+)`)?/g))
    for (let i = +m[2]; i <= +(m[3] ?? m[2]); i++) items.push(`${m[1]}#${i}`);
  const [, target, slot] = r[3].match(/^(?:`([^`]+)` · (learn|core|pool)|(—))$/) ?? [];
  if (!target && r[3] !== '—') problems.push(`bad target cell: ${r[3]}`);
  if (!['keep', 'revise', 'move', 'retire'].includes(r[2])) problems.push(`bad disposition: ${r[2]}`);
  if ((r[2] === 'retire') !== (r[3] === '—')) problems.push(`retire/target mismatch: ${r[0]}`);
  if (target) {
    const isLesson = /l\d$/.test(target);
    if (isLesson ? !newLessons.has(target) : !newUnits.has(target)) problems.push(`unknown target ${target}`);
    if ((slot === 'pool') === isLesson) problems.push(`slot ${slot} with target ${target}`);
  }
  for (const it of items) {
    refs.push(it); dispE[r[2]] = (dispE[r[2]] ?? 0) + 1; const s = slot ?? 'retired'; slots[s] = (slots[s] ?? 0) + 1;
    if ((kinds[it] === 'learn') !== (slot === 'learn' || r[2] === 'retire')) problems.push(`${it}: ${kinds[it]} in slot ${s}`);
    if (slot === 'core') { const l = it.split('#')[0]; core.set(l, new Set([...(core.get(l) ?? []), target])); }
  }
}
once('exercise', exercises, refs);
// Completion targets must receive a core item of that old lesson; every lesson needs a successor
for (const [l, targets] of completion) {
  if (!targets.length) problems.push(`${l}: no successor`);
  for (const t of targets) if (!core.get(l)?.has(t)) problems.push(`${l}: completion target ${t} gets no core item`);
}
// Puzzles: `m1-01`–`m1-04` ranges and singles
const pz = [];
for (const r of section('puzzle-map')) {
  for (const m of r[0].matchAll(/`(m1|m2|wm)-(\d\d)`(?:–`\1-(\d\d)`)?/g))
    for (let i = +m[2]; i <= +(m[3] ?? m[2]); i++) pz.push(`${m[1]}-${String(i).padStart(2, '0')}`);
  for (const m of r[3].matchAll(/`([^`]+)`/g)) if (!newUnits.has(m[1])) problems.push(`unknown puzzle link ${m[1]}`);
}
once('puzzle', puzzles, pz);
// Orphans: must not be current lesson ids
for (const r of section('legacy-orphans')) if (lessons.includes(r[0].replace(/`/g, ''))) problems.push(`orphan ${r[0]} is current`);
console.log({ lessons: lessons.length, exercises: exercises.length, puzzles: puzzles.length,
  newLessonsIn02: newLessons.size, newUnitsIn02: newUnits.size, lessonDispositions: dispL, exerciseDispositions: dispE, slots,
  successors: new Set([...completion.values()].flat()).size });
console.log(problems.length ? problems.join('\n') : 'OK: every lesson, exercise and puzzle is mapped exactly once');
```

Output on HEAD `83b2ade` with this document (S1.3 attempt 2); re-run in S1.4 attempt 2 on HEAD `ed4a490` plus the uncommitted S1.4
edits of 02 and this document, same output:

```
{
  lessons: 36,
  exercises: 195,
  puzzles: 60,
  newLessonsIn02: 161,
  newUnitsIn02: 49,
  lessonDispositions: { revise: 19, keep: 9, move: 8 },
  exerciseDispositions: { revise: 145, keep: 30, move: 12, retire: 8 },
  slots: { learn: 41, core: 99, pool: 47, retired: 8 },
  successors: 25
}
OK: every lesson, exercise and puzzle is mapped exactly once
```

Other commands quoted in this document (scratch scripts, read-only):

1. Counts: 01-audit.md §1.1 script.
2. Explanation sharing (`FB` basis):
   ```sh
   node -e 'const fs=require("fs");const d="src/content/lessons";let t=0,w=0,n=0;const u={};
   for(const f of fs.readdirSync(d).sort()){const x=JSON.parse(fs.readFileSync(d+"/"+f));for(const l of x.lessons)l.exercises.forEach((e,i)=>{if(e.type==="learn")return;t++;if(e.explanation){w++;(u[e.explanation]??=[]).push(l.id+"#"+i)}else n++;});}
   const s=Object.entries(u).filter(([k,v])=>v.length>1);console.log({practice:t,withExplanation:w,noExplanation:n,distinctKeys:Object.keys(u).length,sharedKeys:s.length,itemsOnSharedKeys:s.reduce((a,[k,v])=>a+v.length,0)})'
   ```
   Output: `{ practice: 146, withExplanation: 120, noExplanation: 26, distinctKeys: 39, sharedKeys: 31, itemsOnSharedKeys: 112 }`.
3. Reachable points (`POS` basis): the piece-count and reachable-point rules of `src/content/validate-puzzles.ts:34-62`
   (not exported, so copied into a scratch `tsx` script) applied to every lesson position via `positionOf`
   (`src/lessons/answers.ts`). Output: `positions checked: 195; failing piece-count/reachable-point rules: 12` —
   `u1l3#4`, `u3l1#2`, `u3l2#3`, `u9l1#3`, `u9l1#5`, `u11l1#4`, `u12l1#1`, `u12l1#5`, `u12l2#2`, `u12l3#3`, `u13l1#0`,
   `u13l1#1`, all an unreachable Soldier; no piece-count failure. Since S2.1/S2.3 this is reproducible in the repository
   with `legacyPlacementNotices` (`src/content/validate.ts`), and the D5 rule "at most one own Soldier per file before
   it crosses the river" adds a 13th: `u13l2#4` (two Black Soldiers on a5 and a6).
4. Duplicates up to file mirror and colour swap over the 195 lesson positions and 60 puzzles: 7 groups, each a learn
   card showing the position of the item after it (`u1l1#0=#1`, `u1l1#2=#3`, `u9l3#0=#1`, `u11l2#0=#1`,
   `u11l3#0=#1`, `u13l1#0=#1`, `u15l3#0=#1`); no lesson position equals a puzzle.
5. Main-line signatures (`MOTIF` basis for the quiet-move claims): a scratch `tsx` script plays each combination's
   stored `solution` with `makeMove` and prints, per learner move, `+` check, `X` capture with check, `x` capture,
   `.` quiet (`isInCheck` after the move). Relevant output: `u13l2#3 x+X`, `u14l2#1 +Xx+`, `u14l2#2 +xx+`,
   `u15l1#5 xxx+` (no quiet move although the lesson's prompt/explanation claim one); the core items chosen for
   e01l3 contain one: `u13l2#1 +.X`, `u14l2#3 +.++`, `u15l1#1 x.X+`.

---

## 10. Proposed decisions and backlog items (for the driver)

Proposed decisions (DECISIONS.md):

- **MD1** Successor rule (§2 rule 2) and the §3 map; reused items are practice only.
- **MD2** Legacy completion is derived at read time from the v1 list and a versioned `LEGACY_MAP`; never stored,
  never mastery or applied; old jump-test completions treated like any old completion. Records two deviations:
  from 04 §5.8 (which materialises a `migrate()` result) and from 03 §2 rule 5 (a migrated grant has `at: null`, no
  score, no content version — the v1 data has none).
- **MD3** New evidence in `learning.records.v1` (local) and a new `data_v2` column (account); `data` keeps the v1
  shape; v1 keys are kept and dual-written for still-live legacy lessons, never deleted; no reverse map.
- **MD4** Orphan ids and ids whose meaning changed on 2026-10-21 are read by their current meaning / ignored.
- **MD5** Additive-only changes within a key; breaking changes get a new key and column.
- **MD6** Phased publishing rules P1–P4 (§8.4.1): a legacy lesson retires with its successor's level; one live home
  per position; held items; `LEGACY_MAP` corrections add targets only.
- **MD7** The attempt log stays local (departs from 04 §5.8); the `exposed` id set syncs (MU6).

Backlog items (placed by S1.4 in [06-backlog.md](./06-backlog.md): storage S2.10, sync S2.11, content S2.1/S2.2 and
the level batches S3.1–S3.19, UI S2.13; listed here as written in S1.3):

- Storage: `createLearningRepository`, derived view, corrupt-data handling, Reset change (T3–T7, T12–T14, T17).
- Sync: SQL migration file, `data_v2` pull/push/merge, fingerprint, missing-column fallback (T8–T11); T15 on a real
  project before the first deploy that writes `data_v2`.
- Content: `legacyRef` field and validator check, per release state (T1, T2); the transitional exemption of legacy
  lessons from the release test (07-sourcing.md §6); POS fixes for the 13 positions, re-verifying each claim; FB rewrite of all 146 reused
  practice items (112 share an explanation, 26 have none, 8 have a unique one that still lacks the 02 §7 parts); NAME, MSG, TXT fixes; BLK twins as needed per level.
- UI: migrated-completion display and "not assessed yet" (T16); optional one-time notice explaining the new course
  (MU5).

---

## 11. Unresolved

Status after the S1.4 reconciliation; owners are backlog items of [06-backlog.md](./06-backlog.md) or "owner".

| # | Question | Options | Status · owner |
| --- | --- | --- | --- |
| MU1 | Where `pool` items live | (a) per-unit extra-practice pool used by "more practice" and remediation (recommended; 03 §4.4 remediation may draw from it); (b) convert to puzzles (needs mate-in-3/4 puzzle goals); (c) retire them | **Decided** (S1.4): (a); format in S2.1, "more practice" entry in S2.13; LX confirms the entry point in S2.20 |
| MU2 | Supabase upsert leaves `data_v2` untouched (T15) | — | Open · S2.11 (fake-backend tests, SQL file, T15 procedure); running T15 on a real project is an **owner action** before any deploy that writes `data_v2` (04 R5) |
| MU3 | Whether Reset clears mastery and applied (proposed: yes, explicit user act) | yes / keep mastery | **Decided** (S1.4): yes, as proposed (§8.5); implemented in S2.10 |
| MU4 | XP for the first real completion of a migration-completed lesson | 10 (proposed) / 5 | **Decided** (S1.4): 10, as proposed; wired in S2.13 |
| MU5 | One-time notice for returning learners ("your earlier lessons count as completed; take the unit check to show mastery") | show / not | Open · S3.4 (first release that retires legacy lessons; LX reviewer) |
| MU6 | Whether exposure (`exposed`) syncs (proposed: yes, small id set; needed so a retake on another device avoids seen items, 03 §4.3) | sync / local | **Decided** (S1.4): sync; implemented in S2.11 |

**Dependencies on the curriculum documents.** This map uses 02-curriculum.md attempt 3 (reconciled in S1.4): lesson ids and objectives of
§8, the "Reuses" lines, §9.4 and §10 ("Master reusable 0"); and 03-assessment.md attempt 3: §2 (states, provenance,
merge), §3.1 (attempt record), §3.3 (versions), §4.2 rule 4 (unseen positions), §4.3 (exposure), §9 (puzzles never
count). If a later revision renames, adds or removes a lesson that appears in the "Completion →" or target columns,
the §9 script reports it (unknown target) and the map must be updated.

### 11.1 Deviations from 02-curriculum.md — resolved in S1.4

All eight were accepted: S1.4 rewrote 02 §3.3, the affected "Reuses" lines and 02 §9.4 to match this map, which is
authoritative (02 §9.4). The table is kept as the record of why.

| # | 02 said (before S1.4) | This map does | Reason |
| --- | --- | --- | --- |
| DV1 | §3.3: old completion maps to "completed" on the new lesson(s) in the unit's "Reuses" line | Completion goes **only to successors** (§2 rule 2); lessons that receive secondary items, pools or learn cards get none | A "Reuses" line lists every lesson that borrows items; granting completion to all of them would mark lessons as worked through when the learner met one warm-up item of them. S1.4 reworded 02 §3.3 to "the successor lesson(s) of 05-migration.md §3" |
| DV2 | b06 Reuses: `capture` items of `u2l1`, `u2l2` | Only `u2l1#3` goes to b06 (b06l2); `u2l2#4` goes to b03l3 | `u2l2#4` ("Win the biggest piece … watch out for blocked legs") practises Horse legs, which is b03l3's objective ("What can they take?"); `u2l1#3` (a defended piece) is b06l2's |
| DV3 | b07 Reuses: `capture` items of `u2l*`, `u3l1`; win-material puzzles | b07 gets **no** lesson item; the 8 win-material puzzles are linked as optional practice (§5) | Each existing capture item has a better home in b03/b04/b06 (rule 7: one home). The items are judged by a 1-ply exchange estimate (01-audit §3.2), while b07 counts captures and recaptures over several moves; b07 needs new items |
| DV4 | b02 Reuses: `u1l2`, `u1l3` | Also `u4l1#0`, `#1` (facing Generals, pinned piece) as b02l2 learn cards | They teach exactly b02l2's objective "Facing Generals"; learn cards only, no completion |
| DV5 | i10 Reuses: few-piece items of `u4l2` | None: `u4l2#1` and `#5` stay in b05l2 | Reviewer finding: they fit i10 loosely (in `#1` the General only covers a file; in `#5` the Chariot does the work while the prompt names the Soldier) |
| DV6 | a02 / e01 Reuses list `u12l*` for both | `u12l*` → a02l3 / a06l3 (+ pools); e01 gets `u13`–`u15` | Calculation depth grows from a02 to e01; Expert pools are already large (21 items) |
| DV7 | e02 Reuses: `u10l1` | Two items of `u10l1` as e02l1 guided warm-ups, no completion | `u10l1`'s successor is i04l2 (its learn card states decoying the General); Expert items must be harder |
| DV8 | e01 Reuses: `u13l2` among calculation practice | `u13l2`'s successor is e01l3 ("Long forcing lines"); two items serve e01l1 without completion | Reviewer finding: e01l1 is about several defending branches, which u13l2's single-defence lines did not teach |
