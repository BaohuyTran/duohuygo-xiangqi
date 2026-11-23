# Coverage matrix (step 3 content)

Created by S3.1 (06-backlog.md §5.2 B5) and updated by every step-3 batch: items per unit by type, strand, colour,
quiet share and ladder step (02-curriculum.md §5.2), plus the unit's check pool. Counts are taken from the unit files
(`src/content/lessons/<unit>-*.json`) and the check pools (`src/content/assessment/<unit>-check.json`); "practice" means
every non-`learn` item of the lessons (unit pools, MU1, are listed separately when a unit has one). Status column: the
lowest item status in the unit (`verified` = authored and engine-verified, not yet independently reviewed).

Level rules checked at the release item (S3.4 for Basic): ≥ 1/3 Black of practice and assessment items, ≥ 1/4 quiet in
PA/OD/DE units, every strand of 02 §9.2 present.

## Basic (`basics`)

### Practice items per unit

| Unit | Status | Lessons | Learn cards | Practice | select-squares | choice | move | capture | decision | line | play / review | Black | Quiet | G2 | G1 | G0 | TR | Strands |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| b01 | reviewed | 4 | 12 | 21 | 8 | 7 | 2 | 0 | 4 | 0 | 0 | 9 (43 %) | 17 (81 %) | 8 | 8 | 4 | 1 | RS 21 |
| b02 | reviewed | 3 | 9 | 16 | 8 | 4 | 1 | 1 | 2 | 0 | 0 | 7 (44 %) | 15 (94 %) | 6 | 6 | 3 | 1 | RS 15, DE 1 |
| b03 | reviewed | 3 | 6 | 16 | 10 | 2 | 0 | 4 | 0 | 0 | 0 | 6 (38 %) | 12 (75 %) | 6 | 6 | 3 | 1 | RS 16 |
| b04 | reviewed | 3 | 7 | 16 | 9 | 2 | 0 | 5 | 0 | 0 | 0 | 7 (44 %) | 11 (69 %) | 6 | 6 | 3 | 1 | RS 16 |
| b05 | reviewed | 3 | 8 | 18 | 0 | 3 | 12 | 1 | 2 | 0 | 0 | 6 (33 %) | 5 (28 %) | 7 | 7 | 3 | 1 | RS 13, DE 5 |
| b06 | reviewed | 3 | 8 | 16 | 6 | 4 | 5 | 1 | 0 | 0 | 0 | 8 (50 %) | 14 (88 %) | 6 | 6 | 3 | 1 | RS 16 |
| b07 | reviewed | 3 | 7 | 16 | 0 | 6 | 0 | 7 | 3 | 0 | 0 | 9 (56 %) | 9 (56 %) | 6 | 6 | 3 | 1 | TC 10, RS 3, PA 3 |
| b08 | reviewed | 3 | 6 | 16 | 2 | 8 | 0 | 0 | 5 | 0 | 1 | 7 (44 %) | 16 (100 %) | 6 | 6 | 3 | 0 (task `b08-g1`) | RS 10, DE 5, PP 1 |
| b09 | verified (b09l3, `b09-g1` reviewed, S2.14) | 4 | 8 | 22 | 0 | 8 | 0 | 0 | 8 | 4 | 1 | 13 (59 %) | 22 (100 %) | 8 | 8 | 5 | 0 (task `b09-g1`) | OD 22 |

### Per lesson

| Lesson | Learn | Practice | Types | Ladder (non-learn, in order) | Black | Quiet | Reuse (05 §4) |
| --- | ---: | ---: | --- | --- | ---: | ---: | --- |
| b01l1 | 3 | 5 | select-squares 4, choice 1 | G2 G2 G1 G1 G0 | 2 | 5 | `u1l1#1` (learn, revise: TXT), `u1l1#2` (learn, revise: new text), `u1l1#3` (core, revise: FB) + its BLK twin `b01l1-05` (derived) |
| b01l2 | 3 | 5 | select-squares 4, choice 1 | G2 G2 G1 G1 G0 | 2 | 5 | `u1l1#0` (learn, revise: TXT) |
| b01l3 | 3 | 5 | choice 5 | G2 G2 G1 G1 G0 | 2 | 1 | — |
| b01l4 | 3 | 6 | move 2, decision 4 | G2 G2 G1 G1 G0 TR | 3 | 6 | — |
| b02l1 | 3 | 5 | select-squares 2, move 1, capture 1, choice 1 | G2 G2 G1 G1 G0 | 2 | 4 | `u1l2#0`, `#2`, `#4` (learn, revise: new text), `u1l2#1`, `#5`, `#3` (core, revise: FB) |
| b02l2 | 3 | 5 | select-squares 2, choice 1, decision 2 | G2 G2 G1 G1 G0 | 2 | 5 | `u4l1#0`, `#1` (learn, move: new text, 05 DV4) |
| b02l3 | 3 | 6 | select-squares 4, choice 2 | G2 G2 G1 G1 G0 TR | 3 | 6 | `u1l3#0`, `#2` (learn, revise: new text), `u1l3#4` (learn, POS: Soldier on d3 → Horse, derived), `u1l3#1`, `#3`, `#5` (core, revise: FB) + BLK twin `b02l3-07` (derived from `#5`) |
| b03l1 | 2 | 5 | select-squares 2, capture 2, choice 1 | G2 G2 G1 G1 G0 | 2 | 3 | `u2l1#0` (learn, keep: new text key), `u2l1#1`, `#2` (core, revise: FB) + BLK twin `b03l1-04` (derived from `#1`) |
| b03l2 | 3 | 5 | select-squares 4, choice 1 | G2 G2 G1 G1 G0 | 2 | 5 | `u2l2#0`, `#2` (learn, keep: new text key), `u2l2#1`, `#3` (core, revise: FB) + BLK twin `b03l2-05` (derived from `#1`) |
| b03l3 | 1 | 6 | capture 2, select-squares 4 | G2 G2 G1 G1 G0 TR | 2 | 4 | `u2l2#4` (core, revise: FB) |
| b04l1 | 3 | 5 | capture 3, select-squares 1, choice 1 | G2 G2 G1 G1 G0 | 2 | 2 | `u3l1#0`, `#1` (learn, keep: new text key), `u3l1#2` (learn, POS: Black Soldier on b6 → Horse, derived), `u3l1#3`, `#4` (core, revise: FB) + BLK twin `b04l1-05` (derived from `#3`) |
| b04l2 | 3 | 5 | select-squares 3, capture 1, choice 1 | G2 G2 G1 G1 G0 | 2 | 4 | `u3l2#0`, `#1` (learn, keep: new text key), `u3l2#2` (core, revise: FB) + BLK twin `b04l2-05`, `u3l2#3` (core, POS: Black Soldier on d6 → Horse, derived) |
| b04l3 | 1 | 6 | select-squares 5, capture 1 | G2 G2 G1 G1 G0 TR | 3 | 5 | — |
| b05l1 | 3 | 6 | move 4, capture 1, choice 1 | G2 G2 G1 G1 G0 TR | 2 | 3 | `u4l1#2` (learn, keep: new text key), `u4l1#3`, `#4`, `#5` (core, revise: FB) |
| b05l2 | 2 | 7 | move 7 | G2 G2 G2 G1 G1 G1 G0 | 1 | 0 | `u4l2#0` (learn, keep), `u4l2#1`, `#2`, `#3`, `#5`, `u3l1#5`, `u3l2#4` (core, revise: FB; LEAK prompts kept only at G2, neutral at G1) + BLK twin `b05l2-09` (derived from `u4l2#3`) |
| b05l3 | 3 | 5 | choice 2, decision 2, move 1 | G2 G2 G1 G1 G0 | 3 | 2 | `u4l2#4` (learn, revise: TXT, stalemate wording) |
| b06l1 | 3 | 5 | select-squares 4, choice 1 | G2 G2 G1 G1 G0 | 3 | 5 | — |
| b06l2 | 3 | 5 | select-squares 2, choice 2, capture 1 | G2 G2 G1 G1 G0 | 2 | 3 | `u2l1#3` (core, revise: FB; the defended-piece contrast, 05 DV2) |
| b06l3 | 2 | 6 | move 5, choice 1 | G2 G2 G1 G1 G0 TR | 3 | 6 | — |
| b07l1 | 3 | 5 | capture 4, choice 1 | G2 G2 G1 G1 G0 | 3 | 1 | — (new, 05 DV3) |
| b07l2 | 2 | 5 | capture 3, decision 1, choice 1 | G2 G2 G1 G1 G0 | 2 | 2 | — |
| b07l3 | 2 | 6 | choice 4, decision 2 | G2 G2 G1 G1 G0 TR | 4 | 6 | — |
| b08l1 | 2 | 5 | select-squares 2, choice 3 | G2 G2 G1 G1 G0 | 2 | 5 | — (new) |
| b08l2 | 2 | 5 | choice 4, decision 1 | G2 G2 G1 G1 G0 | 2 | 5 | — |
| b08l3 | 2 | 6 | decision 4, choice 1, play 1 | G2 G2 G1 G1 G0 + `b08-g1` | 3 | 6 | — |
| b09l1 | 3 | 5 | choice 2, decision 3 | G2 G2 G1 G1 G0 | 3 | 5 | — (new) |
| b09l2 | 2 | 5 | choice 2, decision 3 | G2 G2 G1 G1 G0 | 2 | 5 | — |
| b09l3 | 2 | 7 | choice 2, decision 3, line 1, play 1 | G2 G2 G1 G1 G0 G0 + `b09-g1` | 6 | 7 | — (pilot S2.14, unchanged) |
| b09l4 | 1 | 5 | choice 2, line 3 | G2 G2 G1 G1 G0 | 2 | 5 | — |

BLK tags (05 §4) of `u1l2#1`, `#3`, `#5` and `u1l3#1`, `#3` are resolved by authored Black items with the same skill
(b02l1-07/-08 for the General, b02l2-05/-08 for facing, b02l3-08/-09 for the Advisor and Elephant) instead of
colour-swapped twins; `u1l3#5` has its twin (b02l3-07).

BLK tags of `u2l1#2` and `u2l2#3` have no derived twins: their skills are practised as Black by authored items
(b03l1-06 and b03l3-04 for the Chariot's line and captures, b03l2-07 for blocked legs); `u2l1#1` and `u2l2#1` have twins
(b03l1-04, b03l2-05).

BLK tag of `u3l1#4` (own piece as screen) has no derived twin: it is practised as Black by the authored b04l1-07 and
b04l3-03 (Black Cannon over a Red screen); `u3l1#3` and `u3l2#2` have twins (b04l1-05, b04l2-05). The mate items
`u3l1#5` and `u3l2#4` go to b05 (05 §4).

TR b04l3-07 reverses 02 b04's wording ("tap every Red piece that can capture your Horse"): Black to move just after Red's
Horse took the central Soldier, the learner taps every Black piece that can capture that Horse (all seven Black piece types
on the board; answer two Horses and a Cannon). Accepted by the S3.1.d content review: a Black-to-move position in which
Black has just captured would have Red ignoring a free piece.

b05l2 has 7 practice items: 05 §3–§4 keeps all six legacy mates in b05l2 (u4l2#1, #2, #3, #5, u3l1#5, u3l2#4; DV5), and
the Black G0 twin follows them. BLK tags of `u4l1#3`–`#5` and `u4l2#1`, `#2` have no derived twins: escaping check and
mating as Black are practised by authored items (b05l1-07, b05l1-09 TR, b05l3-07); `u4l2#3` has its twin (b05l2-09).
b05 is RS-primary (DE secondary), so the 1/4 quiet share does not apply.

b06 (S3.2.b) uses only the LEGAL capture facts (`attacked-pieces`, `hanging`, `can-capture`): a Cannon attacks over its
screen, a hobbled Horse and a piece pinned to its General neither attack nor defend (b06.m2–m4). The `choice` items with a
"none" option have it right in b06l2-08 and b06-c10 and wrong in b06-c09 (the only defender is pinned). Every `move`
goal `safe` item (and every correct option of the save-it choices b06l3-06, b06-c15) is pinned in pilot-b06.test.ts: it
passes the item's guard and the opponent's best 3-ply reply wins no material; after the content review every move such an
item accepts keeps the material at depth 4 (b06-c12 and b06-c13 use `goal.guard { h: 2 }`; b06l3-03 and b06-c16 were rebuilt). TR b06l3-08 is the full board as Black right
after Red's Cannon move to the edge file (the app has no move animation; the prompt names the move); exactly three
blocks are safe.

b07 (S3.2.c) counts with the engine's beginner values (`PIECE_VALUES`, solver.ts) and discloses that the engine keeps a
crossed Soldier at 1 (b07l1-02, b07-c04). `capture` items are judged by the 1-ply exchange estimate (`captureGain`), so
every b07 capture is built where that estimate and the 4-ply search agree; pilot-b07.test.ts checks that every accepted
capture wins at least the stated count at depth 4. The `decision` items are "keep all your material" tables: target =
passes the Basic guard and ≥ 0 at depth 4, every other row is an `error` that loses at depth 4 (rows the guard misses are
authored errors beyond its horizon); in six of them every capture loses (the best move is not a capture), three by a
capture that looks free (+1 at once) and loses 3 when it uncovers a file. TR b07l3-08 is a full-board `choice` as Black:
the Cannon's free-looking Soldier capture is lost back two moves later (Red's Cannon takes the Horse, and the Red Horse
whose leg point that Cannon blocked recaptures); it is a `choice` because a full-board decision table would need a 4-ply
search of every legal move. The trade advice (trade when ahead, avoid trades when behind, trade off an attacker) is the
conventional heuristic of 02 b07, for the content reviewer to confirm.

b08 (S3.3.a) states the routine of 02 b08 in b08l1-01 (wording for the content reviewer). Its decisions are
"safe" tables (b08l2-07, b08-c11, b08-c12: target = passes the Basic guard and ≥ 0 at depth 4) and "safe and useful"
tables (b08l3, b08-c13/c14/c16: target = also `development {increaseBy: 1}`); every refused authored row loses at depth 4
and no move of any b08 table gains ≥ 2 (quiet positions, pilot-a03's rule for b08-check). Their positions are self-play
positions (`safe-sparring(1, 1.0)` for both sides from the start; the seed is the item's `source.seed`). pilot-b08.test.ts
checks every accepted move and every authored refusal at depth 4, the m1 / m3 / m4 answers by what the best reply does
(takes / checks / nothing developed), and the "what does that move threaten" items by the side-not-to-move's 3-ply gain.
b08-check keeps the S2.16 items b08-c01, c02 unchanged (ids, content, review records) and adds c03–c16; the
pattern-mirror check covers only its composed positions (≤ 20 pieces), the self-play boards are kept apart by the
near-duplicate test. The a03 check's interleaving and pilot-a03.test.ts keep working (its a03-only rules now apply to
b08-c01, c02 only).

b09 (S3.3.b) completes the S2.14 pilot (b09l3 + `b09-g1` unchanged, still `reviewed`) with b09l1, b09l2, b09l4 and the
pool b09-check. The principles of 02 b09 are worded in the learn cards and reasons (for the content reviewer). Every
position is an opening position reached by a legal move sequence from the start (pinned in pilot-b09.test.ts). Tables:
target = passes the Basic guard, meets the item's predicate ("develops a back-rank piece": a Horse or a Chariot out, nothing
hanging; b09l2: a Chariot out) and keeps the material against the best 4-ply line; an edge Horse move is an authored
`dubious` (toward the centre is better); every refused authored row loses at depth 4 (positions where the natural
developing moves lost to a horizon artefact were not used). b09l4 has three short `line`s (Red, Black, Red; root, two
authored deviations after each accepted root move, a second learner node, leaves `end`); `npx tsx scripts/verify-lines.ts
b09` passes. The guided "compare development" choices cannot mark the undeveloped pieces (a `choice` has no highlight);
the options name the counts instead. Check-pool items carry no predicate (pool rule); the four central-Cannon items
(objective b09l3) are `critical`. Pattern mirrors are not checked in b09-check (all 16 positions have the full 32 pieces), and the one-piece
near-duplicate rule is applied inside the pool only (between items of the same side): an opening position is one moved piece from many lesson positions
of b01, b04, i08 and b09 itself, so against lessons and other pools the rule is the exact normal form (pool validator
corpus; earlier b09 candidates that repeated b01-check, b04l3-02 or i08l3-07 positions were replaced).
While b09l1, b09l2, b09l4 are `verified`, b09 is not in the course preview (the S2.19 walkthrough's b09l3 step comes
back after the review).

b01l4, b02l3, b03l3, b04l3, b05l1, b06l3, b07l3 and b08l3 have 6 practice items (the low end of 02 §5.2 is 5): the unit's TR item sits there, after the ladder
minimums G2 2 · G1 2 · G0 1.

### Misconceptions

| Id | Misconception | Learn card | Tagged wrong answers |
| --- | --- | --- | --- |
| b01.m1 | Pieces stand inside the squares | b01l1-01 | b01l1-06 |
| b01.m2 | The river blocks every piece | b01l1-02 | b01l1-06, b01-c03 |
| b01.m3 | The goal is to capture the General (a check, or taking pieces, wins) | b01l3-01 | b01l3-04/05/07/08, b01-c09, b01-c11, b01-c12 |
| b01.m4 | Stalemate is a draw (no legal move is not a loss) | b01l3-03 | b01l3-06, b01-c10, b01-c12 |
| b01.m5 | Black's files are numbered like Red's | b01l4-01, b01l4-02 | b01l4-07, b01l4-09, b01-c14, b01-c16 |
| b01.m6 | Who moves first / turns alternate (Black may start, a side may move twice) — added in S3.1.a, not in 02 b01 | b01l2-01 | b01l2-07, b01-c07 |

| b02.m1 | The General moves diagonally | b02l1-01 | b02l1-07, b02-c03, b02l3-09 |
| b02.m2 | Elephants cross the river | b02l3-02 | b02l3-08, b02-c15 |
| b02.m3 | An Elephant jumps a blocked eye | b02l3-03 | b02l3-09, b02-c16 |
| b02.m4 | Facing only matters for the side to move | b02l2-01 | b02l2-06, b02-c08 |
| b03.m1 | The Horse jumps like a chess knight | b03l2-02 | b03l2-07, b03-c09 |
| b03.m2 | The block is on the landing point | b03l2-03 | b03l2-07, b03-c09 |
| b03.m3 | The Chariot jumps a piece | b03l1-02 | b03l1-06, b03-c05 |
| b04.m1 | The Cannon captures with no screen or with two | b04l1-02 | b04l1-08, b04-c05 |
| b04.m2 | The Cannon may jump to an empty point | b04l1-03 | b04l1-08, b04-c05 |
| b04.m3 | Soldiers move sideways before the river or retreat | b04l2-01 | b04l2-07, b04-c09 |
| b04.m4 | Soldiers promote | b04l2-03 | b04l2-07, b04-c09 |
| b05.m1 | A Horse check cannot be blocked | b05l1-02 | b05l3-04, b05-c09 |
| b05.m2 | Ignore check to capture something big | b05l1-01 | b05l1-07, b05l3-04, b05-c04, b05-c05, b05-c09, b05-c15 |
| b05.m3 | Stalemate is a draw | b05l3-01 | b05l3-04, b05l3-06, b05-c13, b05-c15, b05-c16 |
| b05.m4 | Every check is good | b05l2-02 | b05l3-05, b05l3-06, b05l3-08, b05-c10, b05-c11, b05-c12, b05-c14, b05-c16 |
| b06.m1 | A defended piece is always safe | b06l2-02, b06l3-02 | b06l2-07, b06l3-06, b06-c15 (items tagged: b06l2-06, b06-c08, b06-c11) |
| b06.m2 | A Cannon behind a piece does not attack | b06l1-02 | b06l1-07, b06l2-07, b06l2-08, b06-c09, b06-c10 (items tagged: b06l3-05, b06l3-08) |
| b06.m3 | A hobbled Horse still defends (or attacks) | b06l1-03 | b06l1-07, b06-c04, b06-c10 |
| b06.m4 | A piece pinned to its General still defends (or attacks) | b06l2-03 | b06l2-08, b06-c04, b06-c09 |
| b07.m1 | Every capture is good | b07l2-01 | b07l2-06, b07l3-08, b07-c10, decision rows of b07l2-05, b07l3-05, b07l3-07, b07-c08, b07-c09, b07-c13, b07-c14, b07-c16 (items tagged: b07l1-08, b07l2-07, b07-c01) |
| b07.m2 | Equal trades never matter | b07l3-02 | b07l3-03, b07l3-04, b07l3-06, b07-c11, b07-c12, b07-c15 |
| b07.m3 | Values are fixed | b07l1-02, b07l1-03 | b07l1-07, b07l3-03, b07l3-06, b07-c03, b07-c04, b07-c11, b07-c12, b07-c15 |
| b08.m1 | Only my plan matters | b08l1-01 | b08l1-05, b08l2-03, b08l2-04, b08l2-05, b08l2-06, b08l3-05, b08-c05, b08-c08, b08-c09, b08-c10, b08-c15; tempting rows of b08l3-03, b08l3-07, b08-c12, b08-c13, b08-c14, b08-c16 |
| b08.m2 | The opponent's move was random | b08l1-02 | b08l1-05, b08l1-06, b08-c05, b08-c06 |
| b08.m3 | Checking captures but not checks | b08l2-01 | b08l1-06, b08l2-03, b08l2-04, b08-c06, b08-c08, b08-c09, b08-c10; tempting rows of b08l2-07, b08l3-04, b08l3-06, b08-c11 |
| b08.m4 | "Safe" means "do nothing" | b08l3-01 | b08l3-05, b08-c15 (and every computed `dubious` row of the b08l3 tables: safe, develops nothing) |
| b09.m1 | Openings are memorised sequences | b09l4-01 | b09l1-05, b09l2-04, b09-c04, b09-c12; tempting rows of b09l1-07, b09l2-05, b09l2-06, b09l2-07, b09-c02, b09-c05, b09-c08, b09-c10 (and b09l3, S2.14) |
| b09.m2 | Move one piece repeatedly / count moves, not pieces | b09l1-02 | b09l1-04, b09l1-05, b09l2-03, b09-c03, b09-c04 |
| b09.m3 | The General should step out early | b09l2-02 | b09l1-04, b09l2-03, b09l2-04, b09l4-02, b09l4-03, b09-c03, b09-c12, b09-c16; General / Advisor rows of every new table (and b09l3) |
| b09.m4 | Grabbing a Soldier is always good | b09l1-03 | b09-g1 (S2.14; no new wrong answer: a free Soldier grab is never refused by these tables) |

### Check pools

| Pool | Status | Items | Form | By objective | select-squares | choice | capture | decision | move | Black | Quiet | Critical |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| b01-check | reviewed | 16 | short, 6 | b01l1 4 · b01l2 4 · b01l3 4 · b01l4 4 | 6 | 6 | 0 | 4 | 0 | 7 | 14 | 0 |
| b02-check | reviewed | 16 | 8 (2 disjoint forms) | b02l1 5 · b02l2 5 · b02l3 6 | 10 | 3 | 1 | 2 | 0 | 8 | 15 | 0 |
| b03-check | reviewed | 16 | 6 own + 2 interleaved (3 attempts) | b03l1 5 · b03l2 5 · b03l3 6 | 10 | 2 | 4 | 0 | 0 | 7 | 12 | 0 |
| b04-check | reviewed | 16 | 6 own + 2 interleaved (3 attempts) | b04l1 5 · b04l2 5 · b04l3 6 | 10 | 2 | 4 | 0 | 0 | 7 | 12 | 0 |
| b05-check | reviewed | 16 | 6 own + 2 interleaved (3 attempts) | b05l1 5 · b05l2 5 · b05l3 6 | 0 | 7 | 1 | 3 | 5 | 7 | 9 | 0 |
| b06-check | reviewed | 16 | 6 own + 2 interleaved (3 attempts) | b06l1 5 · b06l2 5 · b06l3 6 | 6 | 4 | 1 | 0 | 5 | 8 | 14 | 0 |
| b07-check | reviewed | 16 | 6 own + 2 interleaved (3 attempts) | b07l1 5 · b07l2 5 · b07l3 6 | 0 | 6 | 5 | 5 | 0 | 8 | 11 | 0 |
| b08-check | reviewed | 16 | 6 own + 2 interleaved (3 attempts) | b08l1 5 · b08l2 5 · b08l3 6 | 2 | 7 | 0 | 7 | 0 | 8 | 16 | 5 |
| b09-check | verified | 16 | 6 own + 2 interleaved (3 attempts) | b09l1 4 · b09l2 4 · b09l3 4 · b09l4 4 | 0 | 4 | 0 | 12 | 0 | 9 | 16 | 4 |

b02-check to b08-check are also checked against near duplicates (`src/content/near-duplicate.ts`, test-only: file mirror, colour swap, a shift of
the whole pattern and one non-General piece added, removed or moved, against every loaded lesson item and the other pool
items). The S3.1.b review replaced b02-c03, c08, c12, c15 and, after the check, c05 (one extra piece over b02l2-03),
c13 and c14; no allowed-reuse exception is left in the pool. From b05 on, pilot tests also check that no two items of the pool share the same task and the same learner-relative material (a colour-swapped pattern mirror that the near-duplicate test misses, as found in the b04 review).

Before b03 a check has no interleaved items, so an 8-item form takes 8 own items and a 16-item pool builds two
attempts (b01's 6-item short form builds three); a third b02 attempt waits for new items (03 §4.3). From b03 on a form
is 6 own + 2 interleaved items, so b03's 16 items build three attempts (checked with the real assembler and the b01 /
b02 pools in pilot-b03.test.ts).

### Practical tasks

None in b01–b07 (02: "Practical task —").

`b08-g1` (S3.3.a): `play`, task `drill` (safe-sparring(2, 1.0) in both regimes), Black, cap 11, R1 70 + R0 30, pass mark 75,
from a self-play middlegame of 28 pieces (seed 22180; 14 a side, each a Horse or a Cannon and some Soldiers down — less
"simplified" than 02 b08 suggests; the screened self-play positions where the safe shuffler N2 fails ≥ 80 % were all
middlegames like this one; the S3.3.a content review accepted this deviation from 02: a full board is the realistic
setting for the safety routine and §5.7 passes). §5.7 at 20 seeds (`npx tsx scripts/verify-practical.ts b08 --runs 20`,
2026-11-19): reference run 20/20 (scores 82.5–100), N1 fails 20/20, N2 fails 20/20, voided 0, 3 narrow positions in the
reference run: all checks passed. Caps 6, 8, 9, 10 and 12 were measured too (reference 13, 16, 18, 18 and 19 of 20; N2 ≥ 95 % failing at
every cap); 11 is the only measured cap in 02's 6–12 range where every check passes.
