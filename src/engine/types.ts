export type Color = 'red' | 'black';

export type PieceType =
  | 'general'
  | 'advisor'
  | 'elephant'
  | 'horse'
  | 'chariot'
  | 'cannon'
  | 'soldier';

export interface Piece {
  readonly color: Color;
  readonly type: PieceType;
}

/**
 * Board index 0..89. index = rank * 9 + file.
 * file 0..8 = a..i (left to right from Red's view),
 * rank 0..9 where rank 0 is Red's back rank and rank 9 is Black's.
 */
export type Square = number;

export type Board = (Piece | null)[];

export interface Position {
  readonly board: Board;
  readonly turn: Color;
  /** Plies since the last capture. */
  readonly halfmoveClock: number;
  /** Starts at 1, incremented after Black moves. */
  readonly fullmoveNumber: number;
}

export interface Move {
  readonly from: Square;
  readonly to: Square;
}

export type GameStatus =
  | { readonly kind: 'ongoing' }
  | { readonly kind: 'check' }
  /** In Xiangqi both checkmate and stalemate lose for the side to move. */
  | { readonly kind: 'checkmate'; readonly winner: Color }
  | { readonly kind: 'stalemate'; readonly winner: Color };
