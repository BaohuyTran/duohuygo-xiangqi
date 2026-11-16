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
| b04 | verified | 3 | 7 | 16 | 9 | 2 | 0 | 5 | 0 | 0 | 0 | 7 (44 %) | 11 (69 %) | 6 | 6 | 3 | 1 | RS 16 |

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

b01l4, b02l3, b03l3 and b04l3 have 6 practice items (the low end of 02 §5.2 is 5): the unit's TR item sits there, after the ladder
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

### Check pools

| Pool | Status | Items | Form | By objective | select-squares | choice | capture | decision | Black | Quiet | Critical |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| b01-check | reviewed | 16 | short, 6 | b01l1 4 · b01l2 4 · b01l3 4 · b01l4 4 | 6 | 6 | 0 | 4 | 7 | 14 | 0 |
| b02-check | reviewed | 16 | 8 (2 disjoint forms) | b02l1 5 · b02l2 5 · b02l3 6 | 10 | 3 | 1 | 2 | 8 | 15 | 0 |
| b03-check | reviewed | 16 | 6 own + 2 interleaved (3 attempts) | b03l1 5 · b03l2 5 · b03l3 6 | 10 | 2 | 4 | 0 | 7 | 12 | 0 |
| b04-check | verified | 16 | 6 own + 2 interleaved (3 attempts) | b04l1 5 · b04l2 5 · b04l3 6 | 10 | 2 | 4 | 0 | 7 | 12 | 0 |

b02-check, b03-check and b04-check are also checked against near duplicates (`src/content/near-duplicate.ts`, test-only: file mirror, colour swap, a shift of
the whole pattern and one non-General piece added, removed or moved, against every loaded lesson item and the other pool
items). The S3.1.b review replaced b02-c03, c08, c12, c15 and, after the check, c05 (one extra piece over b02l2-03),
c13 and c14; no allowed-reuse exception is left in the pool.

Before b03 a check has no interleaved items, so an 8-item form takes 8 own items and a 16-item pool builds two
attempts (b01's 6-item short form builds three); a third b02 attempt waits for new items (03 §4.3). From b03 on a form
is 6 own + 2 interleaved items, so b03's 16 items build three attempts (checked with the real assembler and the b01 /
b02 pools in pilot-b03.test.ts).

### Practical tasks

None in b01–b04 (02: "Practical task —").
