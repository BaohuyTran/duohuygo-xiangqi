import { FILES, fileOf, findGeneral, forward, inPalace, onBoard, onOwnSide, opposite, rankOf, toSquare } from './board';
import type { Board, Color, Move, Position, Square } from './types';

const ORTHOGONAL: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const DIAGONAL: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
/** Horse jumps as [df, dr, legDf, legDr]: the leg is the orthogonally adjacent square it must pass. */
const HORSE_JUMPS: ReadonlyArray<readonly [number, number, number, number]> = [
  [1, 2, 0, 1],
  [-1, 2, 0, 1],
  [1, -2, 0, -1],
  [-1, -2, 0, -1],
  [2, 1, 1, 0],
  [2, -1, 1, 0],
  [-2, 1, -1, 0],
  [-2, -1, -1, 0],
];

/**
 * Pseudo-legal destinations for the piece on `from`: obeys movement rules and never captures an
 * own piece, but may leave the mover's general in check or facing the enemy general.
 */
export function pseudoLegalTargets(board: Board, from: Square): Square[] {
  const p = board[from];
  if (!p) return [];
  const { color } = p;
  const file = fileOf(from);
  const rank = rankOf(from);
  const targets: Square[] = [];

  const addIfNotOwn = (f: number, r: number) => {
    const to = toSquare(f, r);
    const occupant = board[to];
    if (!occupant || occupant.color !== color) targets.push(to);
  };

  switch (p.type) {
    case 'general':
      for (const [df, dr] of ORTHOGONAL) {
        const f = file + df;
        const r = rank + dr;
        if (inPalace(color, f, r)) addIfNotOwn(f, r);
      }
      break;

    case 'advisor':
      for (const [df, dr] of DIAGONAL) {
        const f = file + df;
        const r = rank + dr;
        if (inPalace(color, f, r)) addIfNotOwn(f, r);
      }
      break;

    case 'elephant':
      for (const [df, dr] of DIAGONAL) {
        const f = file + 2 * df;
        const r = rank + 2 * dr;
        if (!onBoard(f, r) || !onOwnSide(color, r)) continue;
        if (board[toSquare(file + df, rank + dr)]) continue; // eye is blocked
        addIfNotOwn(f, r);
      }
      break;

    case 'horse':
      for (const [df, dr, lf, lr] of HORSE_JUMPS) {
        const f = file + df;
        const r = rank + dr;
        if (!onBoard(f, r)) continue;
        if (board[toSquare(file + lf, rank + lr)]) continue; // leg is blocked
        addIfNotOwn(f, r);
      }
      break;

    case 'chariot':
      for (const [df, dr] of ORTHOGONAL) {
        for (let f = file + df, r = rank + dr; onBoard(f, r); f += df, r += dr) {
          const occupant = board[toSquare(f, r)];
          if (!occupant) {
            targets.push(toSquare(f, r));
            continue;
          }
          if (occupant.color !== color) targets.push(toSquare(f, r));
          break;
        }
      }
      break;

    case 'cannon':
      for (const [df, dr] of ORTHOGONAL) {
        let jumped = false;
        for (let f = file + df, r = rank + dr; onBoard(f, r); f += df, r += dr) {
          const occupant = board[toSquare(f, r)];
          if (!jumped) {
            if (!occupant) targets.push(toSquare(f, r));
            else jumped = true; // this piece is the screen
          } else if (occupant) {
            if (occupant.color !== color) targets.push(toSquare(f, r));
            break;
          }
        }
      }
      break;

    case 'soldier': {
      const r = rank + forward(color);
      if (onBoard(file, r)) addIfNotOwn(file, r);
      if (!onOwnSide(color, rank)) {
        if (file > 0) addIfNotOwn(file - 1, rank);
        if (file < FILES - 1) addIfNotOwn(file + 1, rank);
      }
      break;
    }
  }
  return targets;
}

/**
 * True when `color`'s general is attacked, including by the enemy general along an open file
 * (the flying-general rule). Works backwards from the general instead of generating enemy moves.
 */
export function isGeneralAttacked(board: Board, color: Color): boolean {
  const sq = findGeneral(board, color);
  if (sq < 0) return false;
  const enemy = opposite(color);
  const file = fileOf(sq);
  const rank = rankOf(sq);

  // Chariots, cannons and the facing general along the four lines.
  for (const [df, dr] of ORTHOGONAL) {
    let screens = 0;
    for (let f = file + df, r = rank + dr; onBoard(f, r); f += df, r += dr) {
      const p = board[toSquare(f, r)];
      if (!p) continue;
      if (screens === 0) {
        if (p.color === enemy && (p.type === 'chariot' || (p.type === 'general' && df === 0))) return true;
        screens = 1;
      } else {
        if (p.color === enemy && p.type === 'cannon') return true;
        break;
      }
    }
  }

  // Horses: a horse at sq - jump attacks sq unless its leg (next to the horse) is occupied.
  for (const [df, dr, lf, lr] of HORSE_JUMPS) {
    const hf = file - df;
    const hr = rank - dr;
    if (!onBoard(hf, hr)) continue;
    const p = board[toSquare(hf, hr)];
    if (p && p.color === enemy && p.type === 'horse' && !board[toSquare(hf + lf, hr + lr)]) return true;
  }

  // Soldiers: one step behind the general (from the enemy's direction) or beside it.
  const behind = rank - forward(enemy);
  if (onBoard(file, behind)) {
    const p = board[toSquare(file, behind)];
    if (p && p.color === enemy && p.type === 'soldier') return true;
  }
  for (const f of [file - 1, file + 1]) {
    if (!onBoard(f, rank)) continue;
    const p = board[toSquare(f, rank)];
    // A soldier can step sideways only once it has crossed the river.
    if (p && p.color === enemy && p.type === 'soldier' && !onOwnSide(enemy, rank)) return true;
  }

  // Advisors and elephants never leave their own half/palace, so they cannot reach the enemy general.
  return false;
}

/** Plays from -> to on `board` in place, tests whether the mover's general is safe, then restores. */
function leavesGeneralSafe(board: Board, from: Square, to: Square): boolean {
  const moving = board[from]!;
  const captured = board[to];
  board[to] = moving;
  board[from] = null;
  const safe = !isGeneralAttacked(board, moving.color);
  board[from] = moving;
  board[to] = captured;
  return safe;
}

/** All legal moves for the side to move. */
export function legalMoves(pos: Position): Move[] {
  const moves: Move[] = [];
  const board = pos.board.slice();
  for (let from = 0; from < board.length; from++) {
    const p = board[from];
    if (!p || p.color !== pos.turn) continue;
    for (const to of pseudoLegalTargets(board, from)) {
      if (leavesGeneralSafe(board, from, to)) moves.push({ from, to });
    }
  }
  return moves;
}

/** Legal destinations for the piece on `from`; empty if it is not that side's turn. */
export function legalMovesFrom(pos: Position, from: Square): Square[] {
  const p = pos.board[from];
  if (!p || p.color !== pos.turn) return [];
  const board = pos.board.slice();
  return pseudoLegalTargets(board, from).filter((to) => leavesGeneralSafe(board, from, to));
}

export function isLegalMove(pos: Position, move: Move): boolean {
  return legalMovesFrom(pos, move.from).includes(move.to);
}

/** Returns the position after `move`. Does not validate legality; use isLegalMove first. */
export function makeMove(pos: Position, move: Move): Position {
  const board = pos.board.slice();
  const captured = board[move.to];
  board[move.to] = board[move.from];
  board[move.from] = null;
  return {
    board,
    turn: opposite(pos.turn),
    halfmoveClock: captured ? 0 : pos.halfmoveClock + 1,
    fullmoveNumber: pos.turn === 'black' ? pos.fullmoveNumber + 1 : pos.fullmoveNumber,
  };
}
