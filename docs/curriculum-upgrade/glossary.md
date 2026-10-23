# Glossary and notation (English · Vietnamese)

Moved here from [design/02-curriculum.md §4](./design/02-curriculum.md) by backlog item S2.3 (02 U2). This file is
the source for the names and symbols learners read; `src/i18n/messages.ts` uses these names and
`src/notation/format.ts` (`formatMove`) implements the notation. **Status:** written in S2.3; the letters,
operators and markers were confirmed by the `content-reviewer` (02 U2, 04 R1). Items labelled *Proposal* are course
choices still open to the pilot review (S2.20). Change this file and `format.ts` together.

## 1. Board and file numbers

- Each side numbers the nine files **1–9 from its own right**, as on printed boards. Red: file `i` = 1 … file `a` = 9.
  Black: file `a` = 1 … file `i` = 9. Red's numbers run along Red's edge, Black's along Black's edge
  (`Board` prop `fileNumbers`). When the learner plays Black the board is turned 180° (`orientation="black"`), so
  Black's numbers are at the bottom and, for either colour, the learner's file 1 is on the bottom right.
- Ranks are not numbered for learners. ICCS squares (`a0` … `i9`, rank 0 = Red's back rank) stay internal: content
  JSON, tests, validators, accessible names of board points, and `from-to` moves in documents (`h2-e2`).

## 2. Pieces

| English name | Vietnamese name | Chinese (Red / Black) | English letter | Vietnamese letter |
| --- | --- | --- | --- | --- |
| General | Tướng | 帥 / 將 | K | Tg |
| Advisor | Sĩ | 仕 / 士 | A | S |
| Elephant | Tượng | 相 / 象 | E | T |
| Chariot | Xe | 俥 / 車 | R | X |
| Horse | Mã | 傌 / 馬 | H | M |
| Cannon | Pháo | 炮 / 砲 | C | P |
| Soldier | Tốt (also Binh for Red) | 兵 / 卒 | P | B |

- Tướng and Tượng both start with T, so the General is "Tg" and the Elephant "T". The Soldier is lettered B (from
  Binh) because T is taken; in text the piece is always *named* "Tốt". Confirmed by the content reviewer (S2.3).
- The English letters follow the WXF convention (K and P are kept, although the pieces are named General and Soldier).

## 3. Writing a move

A move is **piece letter + from-file + operator + value**, all from the **mover's** point of view.

| | Advance (toward the opponent) | Retreat | Traverse (same rank) |
| --- | --- | --- | --- |
| English operator | `+` | `-` | `=` |
| Vietnamese operator | `.` (tấn, also read tiến) | `/` (thoái) | `-` (bình) |

- **Value.** Traverse: the target file number. Advance or retreat of a straight-moving piece (General, Chariot,
  Cannon, Soldier): the number of ranks moved. Advance or retreat of a diagonal piece (Advisor, Elephant, Horse): the
  target file number.
- Examples (Verified by `src/notation/format.test.ts`):

| Move (internal) | Side | English | Vietnamese | Spoken (vi) |
| --- | --- | --- | --- | --- |
| `h2-e2` | Red | C2=5 | P2-5 | Pháo 2 bình 5 |
| `h0-g2` | Red | H2+3 | M2.3 | Mã 2 tấn 3 |
| `c0-e2` | Red | E7+5 | T7.5 | Tượng 7 tấn 5 |
| `g3-g4` | Red | P3+1 | B3.1 | Tốt 3 tấn 1 |
| `e0-e1` | Red | K5+1 | Tg5.1 | Tướng 5 tấn 1 |
| `b9-c7` | Black | H2+3 | M2.3 | Mã 2 tấn 3 |
| `h7-e7` | Black | C8=5 | P8-5 | Pháo 8 bình 5 |
| `c7-b9` | Black | H3-2 | M3/2 | Mã 3 thoái 2 |

- WXF sources commonly write the traverse as `.` (`C2.5`), and some English sources put `+`/`-` after the letter for
  doubled pieces (`C+.5`). The course keeps `=` for the traverse on purpose: in Vietnamese `.` means advance, so `.`
  would mean two different things in the two languages.
- Letters, operators and markers in §2–§3.1 were confirmed by the content reviewer in S2.3 (checked against an
  independent implementation); course-only choices are labelled *Proposal*.

### 3.1 Two or more identical pieces on one file

The marker replaces the file number; "front" is the piece nearer the opponent (for Black, the lower ICCS rank).

**Advisors and Elephants are never marked**: two of them on one file keep the file number, because one can only
advance and the other only retreat to a shared target, so the operator tells them apart (Red Elephants on `c0` and
`c4`: `c0-e2` = E7+5 / T7.5, `c4-e2` = E7-5 / T7/5; Red Advisors on `d0` and `d2`: `d0-e1` = A6+5 / S6.5; the same for
Black, e.g. Advisors `f9` + `f7`, Elephants `g9` + `g5`). Markers apply to Chariots, Horses, Cannons and Soldiers.

| Pieces on the file | English | Vietnamese |
| --- | --- | --- |
| 2 | `+` front, `-` rear, before the letter: `+R+2`, `-R=8` | `t` (trước) / `s` (sau) after the letter: `Xt.2`, `Xs-8` |
| 3 (Soldiers only) | ordinal from the front before the letter: `1P+1`, `2P=6`, `3P=4` | `t` / `g` (giữa) / `s`: `Bt.1`, `Bg-6`, `Bs-4` |
| 4–5 (Soldiers only) | ordinal from the front: `3P=6` | ordinal from the front: `3B-6` |

- **Course convention (Proposal):** if the mover has such a group of Soldiers on more than one file, the from-file
  number follows the letter and marker: `+P6+1`, `Bs4-3`.
- The rear marker is ASCII `-`, the same character as the retreat operator, kept on purpose: learners type and read
  one minus sign only, and the position in the move tells them apart (`-R-1` = rear Chariot retreats 1). 02 §4 wrote
  the rear marker as `−` (U+2212); the course does not use it.

## 4. Named patterns and openings

The Vietnamese names already in `src/i18n/messages.ts` are Verified there for Trùng pháo, Muộn cung and Mã hậu pháo.

| Vietnamese | Chinese | English used in the course | Meaning |
| --- | --- | --- | --- |
| Lộ mặt Tướng | 将帅对面 (对面笑, 白脸将) | Facing Generals | The two Generals may never face each other on an open file; a General "attacks" along its open file. Puzzle theme key `theme.flying-general` reads "Facing Generals" (05 §5); the key id is unchanged. |
| Pháo đầu | 中炮 | Central Cannon | Red Cannon to the central file (C2=5, `h2-e2`) |
| Bình phong mã | 屏风马 | Screen Horses | Black develops both Horses toward the centre (`h9-g7`, `b9-c7`) |
| Thuận pháo | 顺炮 | Same-direction Cannons | Black answers C2=5 with C8=5 (`h7-e7`) |
| Nghịch pháo | 列炮 | Opposite-direction Cannons | Black answers C2=5 with C2=5 (`b7-e7`) |
| Tiên nhân chỉ lộ | 仙人指路 | Soldier opening ("Immortal points the way") | Red's third- or seventh-file Soldier one step (e.g. `g3-g4`) |
| Phi tượng | 飞相 | Elephant opening | An Elephant to the central point (e.g. `c0-e2`) |
| Khởi mã | 起马 | Horse opening | A Horse first (e.g. `h0-g2`) |
| Ngọa tào mã | 卧槽马 | Trough Horse (Proposal; 卧槽 = the "trough" point beside the palace; **not** "palace corner") | A Horse on the point beside the enemy palace from which it checks the General; the UI title "Palcorner Horse" (`u8l1.title`) is renamed when `u8l1` is migrated |
| Trùng pháo | 重炮 | Double Cannon | Two Cannons on one line, the front one screening the back one |
| Muộn cung | 闷宫 | Smothered General | Cannon mate where the General's own pieces block it in |
| Mã hậu pháo | 马后炮 | Horse-behind-Cannon | The Horse stands on the line between the Cannon and the enemy General, serving as the Cannon's screen, and covers the General's flight points |
| Song xa | 双车 | Two Chariots | Mate by the two Chariots |

## 5. Colour-neutral wording

Generic feedback names neither colour: "your opponent" / "đối phương", "the opponent's General" / "Tướng đối
phương", "an enemy piece" / "quân của đối phương". Where a colour must be named, use `{side}` filled from
`color.red` / `color.black` (`side.toMove`: "{side} to move" / "{side} đi"). Legacy keys that still say "Black"
(`combination.opponent`, `combination.wrong.mate`, `puzzle.opponentMoving`, `puzzle.prompt.mate-in-2`) have
`.neutral` twins for players showing a Black exercise; lesson-specific text keeps its colours.
