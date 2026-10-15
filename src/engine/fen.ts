import { emptyBoard, FILES, findGeneral, inPalace, fileOf, rankOf, parseSquare, piece, RANKS, toSquare } from './board';
import type { Color, Piece, PieceType, Position } from './types';

export const START_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

const LETTER_TO_TYPE: Record<string, PieceType> = {
  k: 'general',
  a: 'advisor',
  b: 'elephant',
  e: 'elephant', // alias used by some tools
  n: 'horse',
  h: 'horse', // alias used by some tools
  r: 'chariot',
  c: 'cannon',
  p: 'soldier',
};

const TYPE_TO_LETTER: Record<PieceType, string> = {
  general: 'k',
  advisor: 'a',
  elephant: 'b',
  horse: 'n',
  chariot: 'r',
  cannon: 'c',
  soldier: 'p',
};

/** Piece from a FEN letter: uppercase is Red, lowercase is Black. */
export function pieceFromLetter(letter: string): Piece {
  const type = LETTER_TO_TYPE[letter.toLowerCase()];
  if (!type || letter.length !== 1) throw new Error(`Invalid piece letter: ${letter}`);
  return piece(letter === letter.toUpperCase() ? 'red' : 'black', type);
}

export function pieceToLetter(p: Piece): string {
  const letter = TYPE_TO_LETTER[p.type];
  return p.color === 'red' ? letter.toUpperCase() : letter;
}

/**
 * Parse a Xiangqi FEN. Ranks are listed from Black's back rank (rank 9) down to Red's (rank 0).
 * Side to move is "w" or "r" for Red and "b" for Black. Castling/en passant fields are ignored.
 */
export function parseFen(fen: string): Position {
  const fields = fen.trim().split(/\s+/);
  const [placement, side = 'w'] = fields;
  const rows = placement.split('/');
  if (rows.length !== RANKS) throw new Error(`FEN must have ${RANKS} ranks, got ${rows.length}`);

  const board = emptyBoard();
  rows.forEach((row, i) => {
    const rank = RANKS - 1 - i;
    let file = 0;
    for (const ch of row) {
      if (/[1-9]/.test(ch)) {
        file += Number(ch);
      } else {
        if (file >= FILES) throw new Error(`Rank ${rank} overflows in FEN: ${row}`);
        board[toSquare(file, rank)] = pieceFromLetter(ch);
        file++;
      }
    }
    if (file !== FILES) throw new Error(`Rank ${rank} must have ${FILES} files, got ${file}: ${row}`);
  });

  let turn: Color;
  if (side === 'w' || side === 'r') turn = 'red';
  else if (side === 'b') turn = 'black';
  else throw new Error(`Invalid side to move: ${side}`);

  for (const color of ['red', 'black'] as const) {
    const count = board.filter((p) => p?.type === 'general' && p.color === color).length;
    if (count !== 1) throw new Error(`Expected exactly one ${color} general, found ${count}`);
    const sq = findGeneral(board, color);
    if (sq < 0 || !inPalace(color, fileOf(sq), rankOf(sq))) {
      throw new Error(`The ${color} general must be inside its palace`);
    }
  }

  const halfmoveClock = fields[4] !== undefined ? Number(fields[4]) : 0;
  const fullmoveNumber = fields[5] !== undefined ? Number(fields[5]) : 1;
  if (!Number.isInteger(halfmoveClock) || halfmoveClock < 0) throw new Error(`Invalid halfmove clock: ${fields[4]}`);
  if (!Number.isInteger(fullmoveNumber) || fullmoveNumber < 1) throw new Error(`Invalid fullmove number: ${fields[5]}`);

  return { board, turn, halfmoveClock, fullmoveNumber };
}

export function toFen(pos: Position): string {
  const rows: string[] = [];
  for (let rank = RANKS - 1; rank >= 0; rank--) {
    let row = '';
    let empty = 0;
    for (let file = 0; file < FILES; file++) {
      const p = pos.board[toSquare(file, rank)];
      if (!p) {
        empty++;
        continue;
      }
      if (empty) row += empty;
      empty = 0;
      row += pieceToLetter(p);
    }
    if (empty) row += empty;
    rows.push(row);
  }
  const side = pos.turn === 'red' ? 'w' : 'b';
  return `${rows.join('/')} ${side} - - ${pos.halfmoveClock} ${pos.fullmoveNumber}`;
}

/**
 * Build a position from a square -> FEN letter map, e.g. { e0: 'K', e9: 'k', e4: 'R' }.
 * Goes through parseFen so the result is validated the same way.
 */
export function positionFromPieces(pieces: Record<string, string>, turn: Color = 'red'): Position {
  const board = emptyBoard();
  for (const [name, letter] of Object.entries(pieces)) board[parseSquare(name)] = pieceFromLetter(letter);
  return parseFen(toFen({ board, turn, halfmoveClock: 0, fullmoveNumber: 1 }));
}
