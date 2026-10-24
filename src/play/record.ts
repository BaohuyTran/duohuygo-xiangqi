// The game record of a practical-play task (design/04-architecture.md §5.6): start position, learner
// colour, seed, and every move with its position key, check and capture flags, the partner policy
// that chose it and whether the safety net produced it.
//
// Plain JSON (no class instances, no Map), so it can be persisted mid-game through src/storage and
// sent to a Worker. Records are immutable: `appendMove` returns a new record. The repetition key is
// `positionKey` of src/analysis/search.ts (Zobrist, board + side to move, no move counters).
//
// A partner move with `safetyNet` set came from the device-dependent fallback (the policy's d = 1
// move after its analysis request was not checked): the run is VOIDED (03 §5.6) — `isVoided`.
import { positionKey } from '../analysis';
import type { NotCheckedReason } from '../analysis/requests';
import { isInCheck, isLegalMove, makeMove, parseFen, parseSquare, squareName, toFen } from '../engine';
import type { Color, Move, Position } from '../engine';

export const RECORD_VERSION = 1;

export interface PartnerMeta {
  /** Label of the policy that chose the move, e.g. `pressing(2)` (the link of a chain that moved). */
  readonly policy: string;
  /**
   * Set when the move is the safety-net d = 1 move: the reason the policy's own analysis request was
   * not checked ('timeout', 'node-limit', 'error'). Any such move voids the run (03 §5.6).
   */
  readonly safetyNet?: Exclude<NotCheckedReason, 'cancelled'>;
}

export interface RecordedMove {
  readonly move: Move;
  /** positionKey of the position after the move. */
  readonly key: number;
  /** The move gives check (the side to move after it is in check). */
  readonly check: boolean;
  readonly capture: boolean;
  /** Partner moves only. */
  readonly partner?: PartnerMeta;
  /** Time of the move in ms, from the caller's injected clock (optional). */
  readonly at?: number;
}

export interface GameRecord {
  readonly version: typeof RECORD_VERSION;
  readonly startFen: string;
  readonly startKey: number;
  readonly learner: Color;
  /** Seed of the partner's choices (rng.ts deriveSeed(seed, ply)). */
  readonly seed: number;
  readonly moves: readonly RecordedMove[];
}

export function createRecord(start: Position, options: { readonly learner: Color; readonly seed: number }): GameRecord {
  return {
    version: RECORD_VERSION,
    startFen: toFen(start),
    startKey: positionKey(start),
    learner: options.learner,
    seed: options.seed >>> 0,
    moves: [],
  };
}

export function startPosition(record: GameRecord): Position {
  return parseFen(record.startFen);
}

/** Every position of the game: index 0 = start, index i + 1 = after move i. */
export function positionsOf(record: GameRecord): Position[] {
  const out: Position[] = [startPosition(record)];
  for (const m of record.moves) out.push(makeMove(out[out.length - 1], m.move));
  return out;
}

export function currentPosition(record: GameRecord): Position {
  const all = positionsOf(record);
  return all[all.length - 1];
}

/** The key of every position of the game, start first (same indices as positionsOf). */
export function keysOf(record: GameRecord): number[] {
  return [record.startKey, ...record.moves.map((m) => m.key)];
}

/** How often each position key occurred so far (the start position included). */
export function keyCounts(record: GameRecord): Map<number, number> {
  const counts = new Map<number, number>();
  for (const k of keysOf(record)) counts.set(k, (counts.get(k) ?? 0) + 1);
  return counts;
}

/** The colour that played move `index`. */
export function sideOfMove(record: GameRecord, index: number): Color {
  const startTurn: Color = record.startFen.trim().split(/\s+/)[1] === 'b' ? 'black' : 'red';
  return index % 2 === 0 ? startTurn : startTurn === 'red' ? 'black' : 'red';
}

export function isLearnerMove(record: GameRecord, index: number): boolean {
  return sideOfMove(record, index) === record.learner;
}

export function learnerMoveCount(record: GameRecord): number {
  let n = 0;
  for (let i = 0; i < record.moves.length; i++) if (isLearnerMove(record, i)) n++;
  return n;
}

/** Learner moves played since the last capture by either side (all learner moves if none). */
export function learnerMovesSinceCapture(record: GameRecord): number {
  let n = 0;
  for (let i = record.moves.length - 1; i >= 0 && !record.moves[i].capture; i--) if (isLearnerMove(record, i)) n++;
  return n;
}

export interface AppendOptions {
  readonly partner?: PartnerMeta;
  readonly at?: number;
  /** The current position, when the caller already has it (saves a replay). */
  readonly position?: Position;
}

/** The record with `move` played. Throws on an illegal move. */
export function appendMove(record: GameRecord, move: Move, options: AppendOptions = {}): GameRecord {
  const before = options.position ?? currentPosition(record);
  if (!isLegalMove(before, move)) throw new Error(`Illegal move ${moveToIccs(move)} in ${toFen(before)}`);
  const after = makeMove(before, move);
  const entry: RecordedMove = {
    move: { from: move.from, to: move.to },
    key: positionKey(after),
    check: isInCheck(after),
    capture: before.board[move.to] !== null,
    ...(options.partner ? { partner: options.partner } : {}),
    ...(options.at === undefined ? {} : { at: options.at }),
  };
  return { ...record, moves: [...record.moves, entry] };
}

/** The partner moves that came from the safety net. */
export function safetyNetMoves(record: GameRecord): RecordedMove[] {
  return record.moves.filter((m) => m.partner?.safetyNet !== undefined);
}

/** 03 §5.6: a run with any safety-net partner move is voided (no grant, no penalty, not a retry). */
export function isVoided(record: GameRecord): boolean {
  return safetyNetMoves(record).length > 0;
}

/** ICCS move text, e.g. `h2e2`. */
export function moveToIccs(move: Move): string {
  return squareName(move.from) + squareName(move.to);
}

/** Parses `h2e2` (also `h2-e2`). Throws on malformed text. */
export function iccsToMove(text: string): Move {
  const m = /^([a-i]\d)-?([a-i]\d)$/.exec(text.trim());
  if (!m) throw new Error(`Bad ICCS move: ${text}`);
  return { from: parseSquare(m[1]), to: parseSquare(m[2]) };
}
