import type { Board, Color, Piece, PieceType, Square } from './types';

export const FILES = 9;
export const RANKS = 10;
export const SQUARE_COUNT = FILES * RANKS;

const FILE_NAMES = 'abcdefghi';

export const toSquare = (file: number, rank: number): Square => rank * FILES + file;
export const fileOf = (sq: Square): number => sq % FILES;
export const rankOf = (sq: Square): number => Math.floor(sq / FILES);

export const onBoard = (file: number, rank: number): boolean =>
  file >= 0 && file < FILES && rank >= 0 && rank < RANKS;

export const opposite = (color: Color): Color => (color === 'red' ? 'black' : 'red');

/** Rank direction a soldier of this color moves forward. */
export const forward = (color: Color): number => (color === 'red' ? 1 : -1);

/** Palace: files d..f, ranks 0..2 for Red and 7..9 for Black. */
export const inPalace = (color: Color, file: number, rank: number): boolean =>
  file >= 3 && file <= 5 && (color === 'red' ? rank >= 0 && rank <= 2 : rank >= 7 && rank <= 9);

/** True when the rank is on this color's own side of the river. */
export const onOwnSide = (color: Color, rank: number): boolean =>
  color === 'red' ? rank <= 4 : rank >= 5;

/** Square name in ICCS style, e.g. "e0" for Red's general start square. */
export const squareName = (sq: Square): string => `${FILE_NAMES[fileOf(sq)]}${rankOf(sq)}`;

export function parseSquare(name: string): Square {
  const match = /^([a-i])([0-9])$/.exec(name);
  if (!match) throw new Error(`Invalid square name: ${name}`);
  return toSquare(FILE_NAMES.indexOf(match[1]), Number(match[2]));
}

// Shared piece instances so pieces can be compared by identity.
const PIECE_TYPES: PieceType[] = [
  'general',
  'advisor',
  'elephant',
  'horse',
  'chariot',
  'cannon',
  'soldier',
];
const PIECES: Record<Color, Record<PieceType, Piece>> = {
  red: Object.fromEntries(PIECE_TYPES.map((type) => [type, Object.freeze({ color: 'red', type })])) as Record<
    PieceType,
    Piece
  >,
  black: Object.fromEntries(
    PIECE_TYPES.map((type) => [type, Object.freeze({ color: 'black', type })]),
  ) as Record<PieceType, Piece>,
};

export const piece = (color: Color, type: PieceType): Piece => PIECES[color][type];

export const emptyBoard = (): Board => new Array<Piece | null>(SQUARE_COUNT).fill(null);

export function findGeneral(board: Board, color: Color): Square {
  // The general is always inside its palace, so only scan those 9 squares.
  const ranks = color === 'red' ? [0, 1, 2] : [7, 8, 9];
  for (const rank of ranks) {
    for (let file = 3; file <= 5; file++) {
      const sq = toSquare(file, rank);
      const p = board[sq];
      if (p && p.type === 'general' && p.color === color) return sq;
    }
  }
  return -1;
}
