// Traditional move notation for learners (docs/curriculum-upgrade/glossary.md, 02-curriculum.md §4).
// Content, tests and validators keep ICCS squares (`h2-e2`); prompts and explanations show the
// traditional form of the learner's language. Pure: no React, no DOM.
//
// A move is written piece + from-file + operator + value:
// - file numbers are counted 1–9 from the MOVER's own right (Red: file i = 1 … file a = 9;
//   Black: file a = 1 … file i = 9), so the same move of either colour reads the same;
// - operator: advance (toward the opponent), retreat, or traverse (same rank);
// - value: for a traverse, the target file number; for an advance or retreat, the number of ranks
//   moved by a straight-moving piece (General, Chariot, Cannon, Soldier) or the target file number
//   for a diagonal one (Advisor, Elephant, Horse).
//
//                 letters K A E R H C P            advance  retreat  traverse   front  rear
//   English (en)  "C2=5", "H8+7"                       +        -         =       "+C"   "-C"
//   Vietnamese    Tg S T X M P B: "P2-5", "M8.7"       .        /         -       "Pt"   "Ps"
//
// Several identical pieces of the mover on the from-file (except Advisors and Elephants, which keep
// the file number) replace the file number by a marker
// counted from the mover's front (the rank nearest the opponent): two pieces, front/rear as above;
// three, en "1P" "2P" "3P" (ordinal from the front), vi "Bt" "Bg" "Bs" (trước, giữa, sau); four or
// five (Soldiers only), the ordinal in both languages. When the mover has such a group on more than
// one file (Soldiers only), the from-file number follows the letter to tell them apart ("+P6+1").
import { fileOf, rankOf, squareName, type Color, type Move, type PieceType, type Position } from '../engine';
import type { Language } from '../i18n/messages';

/** `traditional`: per-language notation shown to learners. `iccs`: the internal `from-to` squares. */
export type Notation = 'traditional' | 'iccs';

export type MoveOperator = 'advance' | 'retreat' | 'traverse';

/** Piece letters per language (glossary.md). */
export const PIECE_LETTERS: Readonly<Record<Language, Readonly<Record<PieceType, string>>>> = {
  en: { general: 'K', advisor: 'A', elephant: 'E', chariot: 'R', horse: 'H', cannon: 'C', soldier: 'P' },
  vi: { general: 'Tg', advisor: 'S', elephant: 'T', chariot: 'X', horse: 'M', cannon: 'P', soldier: 'B' },
};

export const OPERATOR_SYMBOLS: Readonly<Record<Language, Readonly<Record<MoveOperator, string>>>> = {
  en: { advance: '+', retreat: '-', traverse: '=' },
  vi: { advance: '.', retreat: '/', traverse: '-' },
};

/** Front / rear markers for two identical pieces on one file; vi also has a middle one for three. */
const TANDEM: Readonly<Record<Language, { front: string; middle?: string; rear: string; after: boolean }>> = {
  en: { front: '+', rear: '-', after: false },
  vi: { front: 't', middle: 'g', rear: 's', after: true },
};

const DIAGONAL: ReadonlySet<PieceType> = new Set(['advisor', 'elephant', 'horse']);

/** Never marked front/rear (glossary.md §3.1): two of them on one file move in opposite directions. */
const UNMARKED: ReadonlySet<PieceType> = new Set(['advisor', 'elephant']);

/**
 * A side's own file number (1–9) of a file index (0 = file a): each side counts from its own right,
 * as on printed boards. Red's file 1 is file i, Black's file 1 is file a.
 */
export const sideFileNumber = (side: Color, file: number): number => (side === 'red' ? 9 - file : file + 1);

/** Ranks gained toward the opponent (negative = retreat), for the side `color`. */
const advanceOf = (color: Color, fromRank: number, toRank: number): number => (color === 'red' ? toRank - fromRank : fromRank - toRank);

/**
 * The move in the requested notation. `position` is the position BEFORE the move; the mover is the
 * piece standing on `move.from` (either colour). Throws when `move.from` is empty.
 */
export function formatMove(move: Move, position: Position, notation: Notation = 'traditional', lang: Language = 'en'): string {
  if (notation === 'iccs') return `${squareName(move.from)}-${squareName(move.to)}`;
  const piece = position.board[move.from];
  if (!piece) throw new Error(`formatMove: no piece on ${squareName(move.from)}`);
  const { color, type } = piece;
  const fromFile = fileOf(move.from);
  const toFile = fileOf(move.to);
  const gained = advanceOf(color, rankOf(move.from), rankOf(move.to));
  const operator: MoveOperator = gained > 0 ? 'advance' : gained < 0 ? 'retreat' : 'traverse';
  const value = operator === 'traverse' || DIAGONAL.has(type) ? sideFileNumber(color, toFile) : Math.abs(gained);

  const letter = PIECE_LETTERS[lang][type];
  const fileNumber = sideFileNumber(color, fromFile);
  const sameOnFile = (file: number): number[] =>
    position.board.flatMap((p, sq) => (p && p.color === color && p.type === type && fileOf(sq) === file ? [rankOf(sq)] : []));
  // Front first: the piece nearest the opponent.
  const group = sameOnFile(fromFile).sort((a, b) => advanceOf(color, a, b));
  let head: string;
  // Advisors and Elephants keep their file number even when two share a file: their moves are
  // diagonal, so advance vs retreat already tells which one moved (E7+5 from c0, E7-5 from c4).
  if (group.length < 2 || UNMARKED.has(type)) {
    head = `${letter}${fileNumber}`;
  } else {
    const index = group.indexOf(rankOf(move.from));
    const marks = TANDEM[lang];
    const marker =
      group.length === 2
        ? index === 0
          ? marks.front
          : marks.rear
        : group.length === 3 && marks.middle
          ? [marks.front, marks.middle, marks.rear][index]
          : String(index + 1);
    const ordinal = /^\d$/.test(marker);
    const base = marks.after && !ordinal ? `${letter}${marker}` : `${marker}${letter}`;
    const groupedFiles = Array.from({ length: 9 }, (_, f) => f).filter((f) => sameOnFile(f).length >= 2).length;
    head = groupedFiles > 1 ? `${base}${fileNumber}` : base;
  }
  return `${head}${OPERATOR_SYMBOLS[lang][operator]}${value}`;
}
