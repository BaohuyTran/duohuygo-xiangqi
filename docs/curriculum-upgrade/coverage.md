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

| Unit | Status | Lessons | Learn cards | Practice | select-squares | choice | move | decision | line | play / review | Black | Quiet | G2 | G1 | G0 | TR | Strands |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| b01 | verified | 4 | 12 | 21 | 8 | 7 | 2 | 4 | 0 | 0 | 9 (43 %) | 17 (81 %) | 8 | 8 | 4 | 1 | RS 21 |

### Per lesson

| Lesson | Learn | Practice | Types | Ladder (non-learn, in order) | Black | Quiet | Reuse (05 §4) |
| --- | ---: | ---: | --- | --- | ---: | ---: | --- |
| b01l1 | 3 | 5 | select-squares 4, choice 1 | G2 G2 G1 G1 G0 | 2 | 5 | `u1l1#1` (learn, revise: TXT), `u1l1#2` (learn, revise: new text), `u1l1#3` (core, revise: FB) + its BLK twin `b01l1-05` (derived) |
| b01l2 | 3 | 5 | select-squares 4, choice 1 | G2 G2 G1 G1 G0 | 2 | 5 | `u1l1#0` (learn, revise: TXT) |
| b01l3 | 3 | 5 | choice 5 | G2 G2 G1 G1 G0 | 2 | 1 | — |
| b01l4 | 3 | 6 | move 2, decision 4 | G2 G2 G1 G1 G0 TR | 3 | 6 | — |

b01l4 has 6 practice items (the low end of 02 §5.2 is 5): the unit's TR item sits there, after the ladder minimums
G2 2 · G1 2 · G0 1.

### Misconceptions

| Id | Misconception | Learn card | Tagged wrong answers |
| --- | --- | --- | --- |
| b01.m1 | Pieces stand inside the squares | b01l1-01 | b01l1-06 |
| b01.m2 | The river blocks every piece | b01l1-02 | b01l1-06, b01-c03 |
| b01.m3 | The goal is to capture the General (a check, or taking pieces, wins) | b01l3-01 | b01l3-04/05/07/08, b01-c09, b01-c11, b01-c12 |
| b01.m4 | Stalemate is a draw (no legal move is not a loss) | b01l3-03 | b01l3-06, b01-c10, b01-c12 |
| b01.m5 | Black's files are numbered like Red's | b01l4-01, b01l4-02 | b01l4-07, b01l4-09, b01-c14, b01-c16 |
| b01.m6 | Who moves first / turns alternate (Black may start, a side may move twice) — added in S3.1.a, not in 02 b01 | b01l2-01 | b01l2-07, b01-c07 |

### Check pools

| Pool | Status | Items | Form | By objective | select-squares | choice | decision | Black | Quiet | Critical |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| b01-check | verified | 16 | short, 6 | b01l1 4 · b01l2 4 · b01l3 4 · b01l4 4 | 6 | 6 | 4 | 7 | 14 | 0 |

### Practical tasks

None in b01 (02 b01: "Practical task —").
