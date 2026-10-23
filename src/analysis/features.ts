// Position features (design/04-architecture.md §4 and §5.4 layer 2): facts read from a board,
// never judgements. Pure functions over the engine's public API.
//
// "Control" is pseudo-legal and static: a piece controls a square when it could CAPTURE there if the
// square held an enemy piece (horse legs, elephant eyes, palace and river limits respected; pins
// ignored). For a cannon that means squares behind exactly one screen, not the squares it slides to.
// An own piece on a controlled square is "defended". Functions that say "legal" check that the move
// does not leave the mover's own general attacked.
import {
  PIECE_VALUES,
  fileOf,
  inPalace,
  isGeneralAttacked,
  makeMove,
  legalMoves,
  onOwnSide,
  opposite,
  parseSquare,
  pseudoLegalTargets,
  rankOf,
  toSquare,
} from '../engine';
import type { Board, Color, Move, Piece, PieceType, Position, Square } from '../engine';

export type ControlMap = Record<Color, Square[][]>;

const ORTHOGONAL: readonly (readonly [number, number])[] = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];

/** Squares a cannon on `sq` could capture on: behind exactly one screen, up to the next piece. */
export function cannonCaptureSquares(board: Board, sq: Square): Square[] {
  const out: Square[] = [];
  for (const [df, dr] of ORTHOGONAL) {
    let screens = 0;
    for (let f = fileOf(sq) + df, r = rankOf(sq) + dr; f >= 0 && f <= 8 && r >= 0 && r <= 9; f += df, r += dr) {
      const t = toSquare(f, r);
      if (screens === 1) out.push(t);
      if (board[t]) {
        screens++;
        if (screens === 2) break;
      }
    }
  }
  return out;
}

/**
 * For every square, the squares of the red and the black pieces that control it.
 * `map.red[sq]` lists red pieces that could capture on `sq` (or recapture there).
 */
export function controlMap(board: Board): ControlMap {
  const map: ControlMap = {
    red: Array.from({ length: board.length }, () => []),
    black: Array.from({ length: board.length }, () => []),
  };
  for (const color of ['red', 'black'] as const) {
    // Every other piece shown in the enemy colour: same occupancy, so the same geometry, but own
    // pieces now appear among the targets (= the squares this piece defends).
    const enemy = opposite(color);
    const scratch: Board = board.map((p) => (p ? { color: enemy, type: p.type } : null));
    for (let sq = 0; sq < board.length; sq++) {
      const p = board[sq];
      if (!p || p.color !== color) continue;
      if (p.type === 'cannon') {
        for (const t of cannonCaptureSquares(board, sq)) map[color][t].push(sq);
        continue;
      }
      scratch[sq] = p;
      for (const t of pseudoLegalTargets(scratch, sq)) map[color][t].push(sq);
      scratch[sq] = { color: enemy, type: p.type };
    }
  }
  return map;
}

/** True when moving the piece on `from` to `to` leaves its own general safe (turn ignored). */
export function isLegalFor(board: Board, from: Square, to: Square): boolean {
  const p = board[from];
  if (!p) return false;
  const scratch = board.slice();
  scratch[to] = p;
  scratch[from] = null;
  return !isGeneralAttacked(scratch, p.color);
}

/** Legal destinations of the piece on `sq`, whichever side is to move. */
export function legalTargetsOf(board: Board, sq: Square): Square[] {
  return pseudoLegalTargets(board, sq).filter((to) => isLegalFor(board, sq, to));
}

/** Mobility of one piece: its legal move count (horse legs and elephant eyes included). 0 if empty. */
export function pieceMobility(board: Board, sq: Square): number {
  return legalTargetsOf(board, sq).length;
}

/** Sum of the legal move counts of `color`'s pieces (the general excluded unless asked). */
export function mobility(board: Board, color: Color, includeGeneral = false): number {
  let n = 0;
  for (let sq = 0; sq < board.length; sq++) {
    const p = board[sq];
    if (p && p.color === color && (includeGeneral || p.type !== 'general')) n += pieceMobility(board, sq);
  }
  return n;
}

/** Squares of `byColor` pieces that can legally capture the piece on `sq` right now. */
export function legalAttackers(board: Board, sq: Square, byColor: Color): Square[] {
  const out: Square[] = [];
  for (let from = 0; from < board.length; from++) {
    const p = board[from];
    if (!p || p.color !== byColor) continue;
    if (pseudoLegalTargets(board, from).includes(sq) && isLegalFor(board, from, sq)) out.push(from);
  }
  return out;
}

export interface PieceSafety {
  readonly square: Square;
  readonly piece: Piece;
  /** Enemy pieces controlling the square. */
  readonly attackers: readonly Square[];
  /** Own pieces controlling the square. */
  readonly defenders: readonly Square[];
}

/** Attackers and defenders of every non-general piece of `color`. */
export function pieceSafety(board: Board, color: Color, map: ControlMap = controlMap(board)): PieceSafety[] {
  const out: PieceSafety[] = [];
  for (let sq = 0; sq < board.length; sq++) {
    const p = board[sq];
    if (!p || p.color !== color || p.type === 'general') continue;
    out.push({ square: sq, piece: p, attackers: map[opposite(color)][sq], defenders: map[color][sq] });
  }
  return out;
}

/** Pieces of `color` attacked by the enemy and not defended (generals excluded). */
export function hangingPieces(board: Board, color: Color, map: ControlMap = controlMap(board)): Square[] {
  return pieceSafety(board, color, map)
    .filter((s) => s.attackers.length > 0 && s.defenders.length === 0)
    .map((s) => s.square);
}

/** Pieces of `color` that are hanging or attacked by a cheaper enemy piece (generals excluded). */
export function enPrisePieces(board: Board, color: Color, map: ControlMap = controlMap(board)): Square[] {
  return pieceSafety(board, color, map)
    .filter((s) => {
      if (s.attackers.length === 0) return false;
      if (s.defenders.length === 0) return true;
      const cheapest = Math.min(...s.attackers.map((a) => PIECE_VALUES[board[a]!.type]));
      return cheapest < PIECE_VALUES[s.piece.type];
    })
    .map((s) => s.square);
}

/**
 * Value captured minus the capturer's value if the opponent can take back at once (1-ply static
 * exchange). Same definition as `captureGain` in src/lessons/answers.ts ("free capture" ≥ 2).
 */
export function captureGain(pos: Position, move: Move): number {
  const captured = pos.board[move.to];
  const mover = pos.board[move.from];
  if (!captured || !mover) return 0;
  const after = makeMove(pos, move);
  const recapture = legalMoves(after).some((m) => m.to === move.to);
  return PIECE_VALUES[captured.type] - (recapture ? PIECE_VALUES[mover.type] : 0);
}

// ---------- Piece geometry: horse legs, cannon screens, files, soldiers ----------

/** Leg offset and the two jumps it blocks. */
const HORSE_LEGS: readonly (readonly [number, number, readonly (readonly [number, number])[]])[] = [
  [0, 1, [[-1, 2], [1, 2]]],
  [0, -1, [[-1, -2], [1, -2]]],
  [1, 0, [[2, 1], [2, -1]]],
  [-1, 0, [[-2, 1], [-2, -1]]],
];

const inside = (f: number, r: number) => f >= 0 && f <= 8 && r >= 0 && r <= 9;

/**
 * Occupied leg squares of the horse on `sq` that block at least one jump landing on the board
 * (a leg next to the edge that only guards off-board jumps is not counted).
 */
export function blockedHorseLegs(board: Board, sq: Square): Square[] {
  const f = fileOf(sq);
  const r = rankOf(sq);
  const out: Square[] = [];
  for (const [df, dr, jumps] of HORSE_LEGS) {
    if (!inside(f + df, r + dr) || !board[toSquare(f + df, r + dr)]) continue;
    if (jumps.some(([jf, jr]) => inside(f + jf, r + jr))) out.push(toSquare(f + df, r + dr));
  }
  return out;
}

export interface CannonLine {
  /** Direction from the cannon: up = towards rank 9. */
  readonly direction: 'up' | 'down' | 'left' | 'right';
  /** First piece on the line (the screen), or null. */
  readonly screen: Square | null;
  /** First piece behind the screen (what the cannon hits), or null. */
  readonly target: Square | null;
}

/** Screen and target of the cannon on `sq` in each of the four directions. */
export function cannonLines(board: Board, sq: Square): CannonLine[] {
  const dirs = [
    ['up', 0, 1],
    ['down', 0, -1],
    ['left', -1, 0],
    ['right', 1, 0],
  ] as const;
  return dirs.map(([direction, df, dr]) => {
    let screen: Square | null = null;
    let target: Square | null = null;
    for (let f = fileOf(sq) + df, r = rankOf(sq) + dr; f >= 0 && f <= 8 && r >= 0 && r <= 9; f += df, r += dr) {
      const t = toSquare(f, r);
      if (!board[t]) continue;
      if (screen === null) screen = t;
      else {
        target = t;
        break;
      }
    }
    return { direction, screen, target };
  });
}

export type SoldierFileStatus = 'no-soldiers' | 'enemy-soldiers-only' | 'own-soldier';

/**
 * Soldiers on a file (0 = a … 8 = i) from `color`'s view. This is the chess pawn notion; it is NOT
 * the Xiangqi "open file" (a file free of pieces): use `piecesAhead` / the `open-file` predicate.
 */
export function soldierFileStatus(board: Board, file: number, color: Color): SoldierFileStatus {
  let own = false;
  let enemy = false;
  for (let r = 0; r < 10; r++) {
    const p = board[toSquare(file, r)];
    if (p?.type !== 'soldier') continue;
    if (p.color === color) own = true;
    else enemy = true;
  }
  return own ? 'own-soldier' : enemy ? 'enemy-soldiers-only' : 'no-soldiers';
}

/**
 * Pieces (either colour) on the file of the piece on `sq`, in front of it (towards the opponent's
 * back rank), nearest first. Zero pieces ahead = the piece stands on an open file in Xiangqi usage.
 */
export function piecesAhead(board: Board, sq: Square): Square[] {
  const p = board[sq];
  if (!p) return [];
  const dr = p.color === 'red' ? 1 : -1;
  const out: Square[] = [];
  for (let r = rankOf(sq) + dr; r >= 0 && r <= 9; r += dr) if (board[toSquare(fileOf(sq), r)]) out.push(toSquare(fileOf(sq), r));
  return out;
}

/** True when the piece on `sq` stands on the opponent's side of the river. */
export const hasCrossedRiver = (board: Board, sq: Square): boolean => {
  const p = board[sq];
  return !!p && !onOwnSide(p.color, rankOf(sq));
};

const piecesOf = (board: Board, color: Color, type: PieceType): Square[] => {
  const out: Square[] = [];
  for (let sq = 0; sq < board.length; sq++) if (board[sq]?.color === color && board[sq]?.type === type) out.push(sq);
  return out;
};

/** Soldiers of `color` across the river. */
export function crossedSoldiers(board: Board, color: Color): Square[] {
  return piecesOf(board, color, 'soldier').filter((sq) => hasCrossedRiver(board, sq));
}

/** Pairs of `color` soldiers side by side (same rank, adjacent files). */
export function connectedSoldierPairs(board: Board, color: Color): [Square, Square][] {
  const soldiers = new Set(piecesOf(board, color, 'soldier'));
  const out: [Square, Square][] = [];
  for (const sq of soldiers) if (fileOf(sq) < 8 && soldiers.has(sq + 1)) out.push([sq, sq + 1]);
  return out;
}

/** True when the square in front of the soldier on `sq` is occupied (or off the board). */
export function soldierBlocked(board: Board, sq: Square): boolean {
  const p = board[sq];
  if (p?.type !== 'soldier') return false;
  const r = rankOf(sq) + (p.color === 'red' ? 1 : -1);
  return r < 0 || r > 9 || board[toSquare(fileOf(sq), r)] !== null;
}

// ---------- Palace and development ----------

/** Advisors and elephants of `color` still on the board. */
export function palaceDefenders(board: Board, color: Color): number {
  return piecesOf(board, color, 'advisor').length + piecesOf(board, color, 'elephant').length;
}

export interface GeneralFileExposure {
  /** Pieces (either colour) in front of the general on its file, nearest first. */
  readonly blockers: readonly Square[];
  /** No piece in front: an enemy chariot landing on the file would give check. */
  readonly chariot: boolean;
  /**
   * Behind exactly one blocker there is an empty square (or an enemy cannon already stands there):
   * an enemy cannon there would give check with that blocker as its screen.
   */
  readonly cannon: boolean;
}

/** How open `color`'s general file is towards the enemy, for a chariot and for a cannon (04 §5.4). */
export function generalFileExposure(board: Board, color: Color): GeneralFileExposure {
  const g = piecesOf(board, color, 'general')[0];
  if (g === undefined) return { blockers: [], chariot: false, cannon: false };
  const blockers = piecesAhead(board, g);
  let cannon = false;
  if (blockers.length > 0) {
    const dr = color === 'red' ? 1 : -1;
    const end = blockers.length > 1 ? rankOf(blockers[1]) : color === 'red' ? 10 : -1;
    for (let r = rankOf(blockers[0]) + dr; r !== end; r += dr) if (!board[toSquare(fileOf(g), r)]) cannon = true;
    const second = blockers.length > 1 ? board[blockers[1]] : null;
    if (second && second.type === 'cannon' && second.color !== color) cannon = true;
  }
  return { blockers, chariot: blockers.length === 0, cannon };
}

/** True when nothing stands in front of `color`'s general on its file (the chariot case). */
export function generalFileOpen(board: Board, color: Color): boolean {
  return generalFileExposure(board, color).chariot;
}

/** Points of `color`'s palace controlled by enemy pieces (each point counted once). */
export function palacePointsAttacked(board: Board, color: Color, map: ControlMap = controlMap(board)): number {
  let n = 0;
  for (let sq = 0; sq < board.length; sq++) {
    if (inPalace(color, fileOf(sq), rankOf(sq)) && map[opposite(color)][sq].length > 0) n++;
  }
  return n;
}

type Developable = 'chariot' | 'horse' | 'cannon' | 'advisor' | 'elephant';
const START: Record<Color, Record<Developable, Square[]>> = {
  red: {
    chariot: ['a0', 'i0'].map(parseSquare),
    horse: ['b0', 'h0'].map(parseSquare),
    cannon: ['b2', 'h2'].map(parseSquare),
    advisor: ['d0', 'f0'].map(parseSquare),
    elephant: ['c0', 'g0'].map(parseSquare),
  },
  black: {
    chariot: ['a9', 'i9'].map(parseSquare),
    horse: ['b9', 'h9'].map(parseSquare),
    cannon: ['b7', 'h7'].map(parseSquare),
    advisor: ['d9', 'f9'].map(parseSquare),
    elephant: ['c9', 'g9'].map(parseSquare),
  },
};

export interface Development {
  /** Chariots, horses and cannons of `color` not on a starting point of their kind (advisors and elephants: `defendersMoved`). */
  readonly developed: number;
  /** Chariots that left the corners. */
  readonly chariotsOut: number;
  /** Horses off their starting points. */
  readonly horsesOut: number;
  /** Horses with at least one leg blocked that guards an on-board jump (blockedHorseLegs). */
  readonly blockedHorses: number;
  /** Horses with no blocked leg. */
  readonly freeHorses: number;
  /** Advisors and elephants off their starting points (not part of `developed`). */
  readonly defendersMoved: number;
}

/** Development count of `color` (04 §5.4: pieces off their starting points, chariots out, horses free). */
export function development(board: Board, color: Color): Development {
  const out = (type: Developable) =>
    piecesOf(board, color, type).filter((sq) => !START[color][type].includes(sq)).length;
  const chariotsOut = out('chariot');
  const horsesOut = out('horse');
  const horses = piecesOf(board, color, 'horse');
  const blockedHorses = horses.filter((sq) => blockedHorseLegs(board, sq).length > 0).length;
  return {
    developed: chariotsOut + horsesOut + out('cannon'),
    chariotsOut,
    horsesOut,
    blockedHorses,
    freeHorses: horses.length - blockedHorses,
    defendersMoved: out('advisor') + out('elephant'),
  };
}

/** Number of pieces (generals included). */
export const pieceCount = (board: Board): number => board.reduce((n, p) => (p ? n + 1 : n), 0);
