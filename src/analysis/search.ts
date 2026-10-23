// Bounded game-tree search for the analysis layer (design/04-architecture.md §4, §5.4–§5.5).
//
// Iterative-deepening negamax alpha-beta with capture quiescence, a Zobrist-keyed transposition
// table, MVV/LVA move ordering, a node limit and an abort flag. Built only on the engine's public
// API (pseudoLegalTargets + isGeneralAttacked on a scratch board), like src/engine/solver.ts.
//
// Exactness contract: the searched tree is the same tree as the engine's `searchScore` /
// `moveScore` (same quiescence rules, same mate scores −MATE_SCORE + ply, same 8-ply quiescence
// cap), only the leaf evaluation is pluggable. With `materialEval` a COMPLETE search therefore
// returns exactly `searchScore(pos, depth)` (and `searchMove` exactly `moveScore`). To keep that
// guarantee the transposition table only cuts off with entries of the SAME remaining depth (a
// fixed-depth value depends only on board, side to move and remaining depth; mate scores are
// stored relative to the node). Entries of other depths are used for move ordering only.
//
// Determinism: move generation is in square order, ordering uses a stable sort, the table is
// fresh for every call, and limits are counted in nodes, never in time. The same call gives the
// same result on every device.
import { MATE_SCORE, PIECE_VALUES, isGeneralAttacked, opposite, pseudoLegalTargets } from '../engine';
import type { Board, Color, Move, Piece, PieceType, Position } from '../engine';
import { materialEval, type Evaluator } from './eval';

export interface SearchLimits {
  /** Maximum depth in plies (main search, before quiescence). 0 = quiescence only. */
  readonly depth: number;
  /** Stop when this many nodes (main + quiescence) have been visited. Default: no limit. */
  readonly maxNodes?: number;
  /** Checked at every node; when it becomes true the search stops. An AbortSignal fits. */
  readonly abort?: { readonly aborted: boolean };
  /** Leaf evaluation from the side to move's view. Default: material only. */
  readonly evaluate?: Evaluator;
}

export interface SearchResult {
  /** Score for the side to move (searchMove: for the side playing the move) at `depth`. */
  readonly score: number;
  /** Principal variation of the main search (quiescence captures are not included). */
  readonly pv: readonly Move[];
  /** Deepest fully searched depth (searchMove: counted like moveScore, the move itself included). */
  readonly depth: number;
  /** Nodes visited, including an unfinished last iteration. */
  readonly nodes: number;
  /** True when the requested depth was searched completely (no node limit hit, not aborted). */
  readonly complete: boolean;
}

/** Same cap as the engine's material search (src/engine/solver.ts). */
export const QUIESCENCE_LIMIT = 8;

// ---------- Zobrist keys (fixed seed: identical on every run and device) ----------

const PIECE_TYPES: readonly PieceType[] = ['general', 'advisor', 'elephant', 'horse', 'chariot', 'cannon', 'soldier'];
const TYPE_INDEX = Object.fromEntries(PIECE_TYPES.map((t, i) => [t, i])) as Record<PieceType, number>;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

const rand = mulberry32(0x5eed_a11c);
/** Two 32-bit halves per (piece kind, square); kind = colour * 7 + type. */
const Z_HI = Uint32Array.from({ length: 14 * 90 }, () => rand());
const Z_LO = Uint32Array.from({ length: 14 * 90 }, () => rand());
const Z_TURN_HI = rand();
const Z_TURN_LO = rand();

const zIndex = (p: Piece, sq: number) => ((p.color === 'red' ? 0 : 7) + TYPE_INDEX[p.type]) * 90 + sq;

interface Hash {
  hi: number;
  lo: number;
}

function hashBoard(board: Board, turn: Color): Hash {
  let hi = 0;
  let lo = 0;
  for (let sq = 0; sq < board.length; sq++) {
    const p = board[sq];
    if (!p) continue;
    hi ^= Z_HI[zIndex(p, sq)];
    lo ^= Z_LO[zIndex(p, sq)];
  }
  if (turn === 'black') {
    hi ^= Z_TURN_HI;
    lo ^= Z_TURN_LO;
  }
  return { hi: hi >>> 0, lo: lo >>> 0 };
}

/** 53-bit position key (board + side to move), usable as a Map key. Exported for src/play (repetition). */
export function positionKey(pos: Position): number {
  const h = hashBoard(pos.board, pos.turn);
  return keyOf(h.hi, h.lo);
}

const keyOf = (hi: number, lo: number) => hi * 0x200000 + (lo & 0x1fffff);

// ---------- Search ----------

const EXACT = 0;
const LOWER = 1; // score is a lower bound (fail high)
const UPPER = 2; // score is an upper bound (fail low)

interface Entry {
  depth: number;
  score: number; // mate scores stored relative to the node
  flag: number;
  move: number; // from * 90 + to, or -1
  pv: Move[] | null; // exact entries only
}

class Stop {}
const STOP = new Stop();

const MATE_BOUND = MATE_SCORE / 2;
const toTable = (score: number, ply: number) => (score > MATE_BOUND ? score + ply : score < -MATE_BOUND ? score - ply : score);
const fromTable = (score: number, ply: number) => (score > MATE_BOUND ? score - ply : score < -MATE_BOUND ? score + ply : score);

class Searcher {
  nodes = 0;
  private readonly table = new Map<number, Entry>();
  private hi = 0;
  private lo = 0;
  private readonly board: Board;
  private readonly evaluate: Evaluator;
  private readonly maxNodes: number;
  private readonly abort?: { readonly aborted: boolean };

  constructor(board: Board, turn: Color, limits: SearchLimits) {
    this.board = board;
    this.evaluate = limits.evaluate ?? materialEval;
    this.maxNodes = limits.maxNodes ?? Infinity;
    this.abort = limits.abort;
    const h = hashBoard(board, turn);
    this.hi = h.hi;
    this.lo = h.lo;
  }

  private visit(): void {
    this.nodes++;
    if (this.nodes > this.maxNodes || this.abort?.aborted) throw STOP;
  }

  /** Legal moves of `turn` on the scratch board, in square order. */
  private legal(turn: Color): Move[] {
    const board = this.board;
    const moves: Move[] = [];
    for (let from = 0; from < board.length; from++) {
      const p = board[from];
      if (!p || p.color !== turn) continue;
      for (const to of pseudoLegalTargets(board, from)) {
        const captured = board[to];
        board[to] = p;
        board[from] = null;
        if (!isGeneralAttacked(board, turn)) moves.push({ from, to });
        board[from] = p;
        board[to] = captured;
      }
    }
    return moves;
  }

  /** MVV/LVA (same key as the engine), with the table move first. Stable sort: deterministic. */
  private order(moves: Move[], first: number): Move[] {
    const board = this.board;
    const key = (m: Move) => {
      if (m.from * 90 + m.to === first) return Infinity;
      const v = board[m.to];
      return v ? PIECE_VALUES[v.type] * 10 - PIECE_VALUES[board[m.from]!.type] / 10 : 0;
    };
    return moves.map((m) => [key(m), m] as const).sort((a, b) => b[0] - a[0]).map(([, m]) => m);
  }

  private make(m: Move): Piece | null {
    const board = this.board;
    const p = board[m.from]!;
    const captured = board[m.to];
    let hi = this.hi ^ Z_HI[zIndex(p, m.from)] ^ Z_HI[zIndex(p, m.to)] ^ Z_TURN_HI;
    let lo = this.lo ^ Z_LO[zIndex(p, m.from)] ^ Z_LO[zIndex(p, m.to)] ^ Z_TURN_LO;
    if (captured) {
      hi ^= Z_HI[zIndex(captured, m.to)];
      lo ^= Z_LO[zIndex(captured, m.to)];
    }
    this.hi = hi >>> 0;
    this.lo = lo >>> 0;
    board[m.to] = p;
    board[m.from] = null;
    return captured;
  }

  private unmake(m: Move, captured: Piece | null, hi: number, lo: number): void {
    this.board[m.from] = this.board[m.to];
    this.board[m.to] = captured;
    this.hi = hi;
    this.lo = lo;
  }

  quiesce(turn: Color, alpha: number, beta: number, ply: number, qdepth: number): number {
    this.visit();
    const board = this.board;
    const all = this.legal(turn);
    if (all.length === 0) return -MATE_SCORE + ply;
    const inCheck = isGeneralAttacked(board, turn);
    let best = -Infinity;
    if (!inCheck) {
      best = this.evaluate(board, turn);
      if (best >= beta || qdepth >= QUIESCENCE_LIMIT) return best;
      if (best > alpha) alpha = best;
    } else if (qdepth >= QUIESCENCE_LIMIT) {
      return this.evaluate(board, turn);
    }
    const moves = this.order(inCheck ? all : all.filter((m) => board[m.to] !== null), -1);
    const enemy = opposite(turn);
    for (const m of moves) {
      const { hi, lo } = this;
      const captured = this.make(m);
      const score = -this.quiesce(enemy, -beta, -alpha, ply + 1, qdepth + 1);
      this.unmake(m, captured, hi, lo);
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return best;
  }

  negamax(turn: Color, depth: number, alpha: number, beta: number, ply: number, pv: Move[]): number {
    if (depth <= 0) {
      pv.length = 0;
      return this.quiesce(turn, alpha, beta, ply, 0);
    }
    this.visit();
    const key = keyOf(this.hi, this.lo);
    const entry = this.table.get(key);
    if (entry && entry.depth === depth) {
      const s = fromTable(entry.score, ply);
      if (entry.flag === EXACT || (entry.flag === LOWER && s >= beta) || (entry.flag === UPPER && s <= alpha)) {
        pv.length = 0;
        if (entry.flag === EXACT && entry.pv) pv.push(...entry.pv);
        return s;
      }
    }
    const moves = this.legal(turn);
    if (moves.length === 0) {
      pv.length = 0;
      return -MATE_SCORE + ply;
    }
    const alpha0 = alpha;
    const enemy = opposite(turn);
    const child: Move[] = [];
    let best = -Infinity;
    let bestMove = -1;
    pv.length = 0;
    for (const m of this.order(moves, entry ? entry.move : -1)) {
      const { hi, lo } = this;
      const captured = this.make(m);
      const score = -this.negamax(enemy, depth - 1, -beta, -alpha, ply + 1, child);
      this.unmake(m, captured, hi, lo);
      if (score > best) {
        best = score;
        bestMove = m.from * 90 + m.to;
        if (score > alpha) {
          alpha = score;
          pv.length = 0;
          pv.push(m, ...child);
        }
      }
      if (alpha >= beta) break;
    }
    const flag = best <= alpha0 ? UPPER : best >= beta ? LOWER : EXACT;
    this.table.set(key, { depth, score: toTable(best, ply), flag, move: bestMove, pv: flag === EXACT ? pv.slice() : null });
    return best;
  }
}

interface RunResult {
  score: number;
  pv: Move[];
  depth: number;
  nodes: number;
  complete: boolean;
}

/** Iterative deepening from depth 1 (0 when maxDepth is 0) to maxDepth on a scratch board. */
function run(
  board: Board,
  turn: Color,
  limits: SearchLimits,
  maxDepth: number,
  ply: number,
  alpha = -Infinity,
  beta = Infinity,
): RunResult {
  const evaluate = limits.evaluate ?? materialEval;
  const staticScore = evaluate(board, turn); // before the scratch board is touched
  const s = new Searcher(board, turn, limits);
  let done: { score: number; pv: Move[]; depth: number } | null = null;
  try {
    if (maxDepth <= 0) {
      done = { score: s.quiesce(turn, alpha, beta, ply, 0), pv: [], depth: 0 };
    } else {
      for (let d = 1; d <= maxDepth; d++) {
        const pv: Move[] = [];
        const score = s.negamax(turn, d, alpha, beta, ply, pv);
        done = { score, pv, depth: d };
      }
    }
  } catch (e) {
    if (e !== STOP) throw e;
    return {
      score: done ? done.score : staticScore,
      pv: done ? done.pv : [],
      depth: done ? done.depth : 0,
      nodes: s.nodes,
      complete: false,
    };
  }
  return { ...done!, nodes: s.nodes, complete: true };
}

/**
 * Searches `pos` to `limits.depth` plies plus capture quiescence. With the default material
 * evaluation and a complete result, `score === searchScore(pos, depth)`.
 * When the node limit or the abort flag stops the search, the result of the deepest finished
 * iteration is returned with `complete: false` (depth 0 and the static evaluation if none finished).
 */
export function search(pos: Position, limits: SearchLimits): SearchResult {
  return run(pos.board.slice(), pos.turn, limits, Math.max(0, limits.depth), 0);
}

/**
 * Score of the (legal) `move` for the side playing it, searched like the engine's
 * `moveScore(pos, move, depth)`: the move, then `depth - 1` plies and quiescence. The pv starts
 * with `move`, and `depth` counts the move.
 */
export function searchMove(pos: Position, move: Move, limits: SearchLimits): SearchResult {
  const board = pos.board.slice();
  const p = board[move.from];
  board[move.to] = p;
  board[move.from] = null;
  const r = run(board, opposite(pos.turn), limits, Math.max(0, limits.depth - 1), 1);
  return { score: -r.score, pv: [move, ...r.pv], depth: r.depth + 1, nodes: r.nodes, complete: r.complete };
}

/**
 * Null-window test: is the side to move's score at `depth` at least `threshold`? Much cheaper than
 * an exact search when only a threshold matters (e.g. "can the opponent gain ≥ T?"). Answers the
 * same as `search(pos, …).score >= threshold`; `complete: false` means the limits stopped it and
 * `value` must not be used.
 */
export function searchAtLeast(
  pos: Position,
  threshold: number,
  limits: SearchLimits,
): { value: boolean; nodes: number; complete: boolean } {
  const r = run(pos.board.slice(), pos.turn, limits, Math.max(0, limits.depth), 0, threshold - 1e-9, threshold);
  return { value: r.score >= threshold, nodes: r.nodes, complete: r.complete };
}
