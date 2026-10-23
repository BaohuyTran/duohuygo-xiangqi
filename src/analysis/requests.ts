// The analysis request protocol (design/04-architecture.md §4 "worker.ts", §5.4–§5.5): one typed
// request union, one executor. The Worker (worker.ts) and the synchronous fallback of the client
// (client.ts) both run `executeRequest`, so both paths give the same verdict for the same request
// and the same node budget.
//
// Limits. Every request carries node limits, never a time limit, so the verdict is the same on a
// phone and in CI (04 §4):
// - `limits.maxNodes`: cap for EACH search inside the request (default DEFAULT_MAX_NODES, as in judge.ts);
// - `limits.budget`: cap for ALL searches of the request together (default DEFAULT_REQUEST_BUDGET).
//   It is counted through the searches' `abort` flag, which the search reads exactly once per visited
//   node, so the count is deterministic.
// A request stopped by either limit is 'not-checked' (reason 'node-limit'): no penalty, no credit (04 §5.4).
//
// NOT bounded by node limits: the engine's exhaustive `hasForcedWin` / `forcedWinMoves` (the mate
// guard of judge.ts with k ≤ 2, the `forced-wins` request). They ignore `abort`, so the only stop is
// the wall-clock safety net: the client terminates and restarts the Worker (reason 'timeout'). In the
// synchronous fallback a deadline can only stop the material searches, never a running mate search.
//
// Adding a request kind: add a variant to `AnalysisRequest`, its result type to `AnalysisResults`
// and a case in `run` below that says when the value counts as checked. The Worker and the client
// need no change (the protocol carries any request). Values must survive structured cloning
// (plain data: no functions, no class instances; an evaluator is named by `EvalSpec`).
import { forcedWinMoves, legalMoves } from '../engine';
import type { Color, Move, Position } from '../engine';
import { featureEvaluator, materialEval, type EvalWeights, type Evaluator } from './eval';
import {
  DEFAULT_MAX_NODES,
  evaluatePredicate,
  moveSignals,
  safetyGuard,
  threatAtEnd,
  threatOf,
  winningCaptures,
  type JudgeLimits,
  type MoveSignals,
  type Predicate,
  type SafetyGuard,
  type SafetyVerdict,
  type ThreatResult,
  type WinningCaptures,
} from './judge';
import { search, searchMove, type SearchResult } from './search';

/** Default total node budget of one request (all its searches together). Tuned by S2.6. */
export const DEFAULT_REQUEST_BUDGET = 50_000;

/** Largest `n` a `forced-wins` request may ask for at runtime (04 §5.5: 3 only in small positions). */
export const MAX_RUNTIME_MATE_DEPTH = 3;

export interface RequestLimits {
  /** Node cap of each search in the request (default DEFAULT_MAX_NODES). */
  readonly maxNodes?: number;
  /** Node cap of all searches of the request together (default DEFAULT_REQUEST_BUDGET). */
  readonly budget?: number;
}

/** A leaf evaluation by name (functions cannot be sent to a Worker). Default: material. */
export type EvalSpec = { readonly kind: 'material' } | { readonly kind: 'features'; readonly weights?: EvalWeights };

interface Base {
  readonly limits?: RequestLimits;
}

export type AnalysisRequest =
  /** Does nothing; loads and warms the Worker. */
  | (Base & { readonly kind: 'ping' })
  /** judge.moveSignals: the 03 §5.3 signals and the per-move penalty of the learner's move. */
  | (Base & {
      readonly kind: 'move-signals';
      readonly position: Position;
      readonly move: Move;
      readonly guard: SafetyGuard;
      readonly threats?: boolean;
      readonly missed?: boolean;
    })
  /** judge.safetyGuard: layer-1 guard of a `decision` move (04 §5.4). */
  | (Base & { readonly kind: 'safety-guard'; readonly position: Position; readonly move: Move; readonly guard: SafetyGuard })
  /** judge.threatOf: the 02 a06 threat of `side`. */
  | (Base & {
      readonly kind: 'threat';
      readonly position: Position;
      readonly side: Color;
      readonly guard: Pick<SafetyGuard, 'h' | 'k' | 'T'>;
    })
  /** judge.threatAtEnd: 03 §5.3 "threat at the end". */
  | (Base & { readonly kind: 'threat-at-end'; readonly position: Position; readonly opponent: Color; readonly guard: SafetyGuard })
  /** judge.winningCaptures: the `forcing-attack` winning captures (03 §5.2). */
  | (Base & { readonly kind: 'winning-captures'; readonly position: Position; readonly depth?: number; readonly T?: number })
  /** search.search: best score and principal variation. */
  | (Base & { readonly kind: 'search'; readonly position: Position; readonly depth: number; readonly eval?: EvalSpec })
  /** search.searchMove: score of one move (depth counts the move). */
  | (Base & { readonly kind: 'search-move'; readonly position: Position; readonly move: Move; readonly depth: number; readonly eval?: EvalSpec })
  /**
   * searchMove for each of `moves` (default: every legal move, in the engine's order): the root
   * scores a training partner (S2.9: safe-sparring, pressing) chooses from.
   */
  | (Base & {
      readonly kind: 'score-moves';
      readonly position: Position;
      readonly depth: number;
      readonly moves?: readonly Move[];
      readonly eval?: EvalSpec;
    })
  /** engine forcedWinMoves(position, n): exhaustive, NOT node-limited (n ≤ MAX_RUNTIME_MATE_DEPTH). */
  | (Base & { readonly kind: 'forced-wins'; readonly position: Position; readonly n: number })
  /** judge.evaluatePredicate: an objective predicate after `moves` from `before` (null = not checked). */
  | (Base & {
      readonly kind: 'predicate';
      readonly predicate: Predicate;
      readonly before: Position;
      readonly moves: readonly Move[];
      readonly side?: Color;
    });

export type AnalysisKind = AnalysisRequest['kind'];

export interface ScoredMove {
  readonly move: Move;
  /** searchMove score for the side to move in `position`. */
  readonly score: number;
}

/** The value each request kind answers with. */
export interface AnalysisResults {
  ping: null;
  'move-signals': MoveSignals;
  'safety-guard': SafetyVerdict;
  threat: ThreatResult;
  'threat-at-end': ThreatResult;
  'winning-captures': WinningCaptures;
  search: SearchResult;
  'search-move': SearchResult;
  /** In the order of the request's moves; when not checked, only the moves scored completely before the stop. */
  'score-moves': readonly ScoredMove[];
  'forced-wins': readonly Move[];
  predicate: boolean;
}

export type NotCheckedReason =
  /** A node limit (per search or per request) stopped a search. Deterministic. */
  | 'node-limit'
  /** The wall-clock safety net fired (Worker terminated, or the synchronous deadline passed). */
  | 'timeout'
  /** The caller cancelled the request. */
  | 'cancelled'
  /** The request threw, the Worker failed, or the request was invalid. */
  | 'error';

/** The verdict of one request. 'not-checked' never costs a heart or a point (04 §5.4). */
export type AnalysisOutcome<K extends AnalysisKind = AnalysisKind> =
  | { readonly status: 'checked'; readonly kind: K; readonly value: AnalysisResults[K]; readonly nodes: number }
  | {
      readonly status: 'not-checked';
      readonly kind: K;
      readonly reason: NotCheckedReason;
      /** The partial value, when the request stopped inside a search (e.g. the deepest finished iteration). */
      readonly value?: AnalysisResults[K];
      readonly nodes: number;
      readonly message?: string;
    };

/** Message main thread → Worker. */
export interface WorkerRequestMessage {
  readonly id: number;
  readonly request: AnalysisRequest;
}

/** Message Worker → main thread. */
export interface WorkerResponseMessage {
  readonly id: number;
  readonly outcome: AnalysisOutcome;
}

export interface ExecuteEnv {
  /** Upper bound on the request's total budget (the synchronous fallback's small budget). */
  readonly maxBudget?: number;
  /** Wall-clock safety net for the material searches: true = stop now ('timeout'). Checked every 256 nodes. */
  readonly expired?: () => boolean;
}

/**
 * The searches' `abort` flag, used as a node counter: the search reads `aborted` once per visited
 * node (search.ts `visit`), so `visited` counts every node of every search that got these limits.
 */
class RequestBudget {
  visited = 0;
  exhausted = false;
  timedOut = false;
  private readonly budget: number;
  private readonly expired?: () => boolean;

  constructor(budget: number, expired?: () => boolean) {
    this.budget = budget;
    this.expired = expired;
  }

  get aborted(): boolean {
    this.visited++;
    if (this.exhausted || this.timedOut) return true;
    if (this.visited > this.budget) {
      this.exhausted = true;
      return true;
    }
    if (this.expired && (this.visited & 255) === 0 && this.expired()) {
      this.timedOut = true;
      return true;
    }
    return false;
  }
}

function evaluator(spec: EvalSpec | undefined): Evaluator {
  return spec?.kind === 'features' ? featureEvaluator(spec.weights) : materialEval;
}

/** A judge value plus whether it counts as checked. */
type Ran<K extends AnalysisKind> = { value: AnalysisResults[K]; complete: boolean };

function run(request: AnalysisRequest, limits: JudgeLimits): Ran<AnalysisKind> {
  switch (request.kind) {
    case 'ping':
      return { value: null, complete: true };
    case 'move-signals': {
      const value = moveSignals(request.position, request.move, request.guard, {
        ...limits,
        threats: request.threats,
        missed: request.missed,
      });
      return { value, complete: value.status === 'checked' };
    }
    case 'safety-guard': {
      const value = safetyGuard(request.position, request.move, request.guard, limits);
      return { value, complete: value.status === 'checked' };
    }
    case 'threat': {
      const value = threatOf(request.position, request.side, request.guard, limits);
      return { value, complete: value.status === 'checked' };
    }
    case 'threat-at-end': {
      const value = threatAtEnd(request.position, request.opponent, request.guard, limits);
      return { value, complete: value.status === 'checked' };
    }
    case 'winning-captures': {
      const value = winningCaptures(request.position, { ...limits, depth: request.depth, T: request.T });
      return { value, complete: value.status === 'checked' };
    }
    case 'search': {
      const value = search(request.position, { ...limits, depth: request.depth, evaluate: evaluator(request.eval) });
      return { value, complete: value.complete };
    }
    case 'search-move': {
      const value = searchMove(request.position, request.move, { ...limits, depth: request.depth, evaluate: evaluator(request.eval) });
      return { value, complete: value.complete };
    }
    case 'score-moves': {
      const evaluate = evaluator(request.eval);
      const scored: ScoredMove[] = [];
      for (const move of request.moves ?? legalMoves(request.position)) {
        const r = searchMove(request.position, move, { ...limits, depth: request.depth, evaluate });
        if (!r.complete) return { value: scored, complete: false };
        scored.push({ move, score: r.score });
      }
      return { value: scored, complete: true };
    }
    case 'forced-wins': {
      if (!(request.n >= 1 && request.n <= MAX_RUNTIME_MATE_DEPTH)) {
        throw new Error(`forced-wins: n must be 1–${MAX_RUNTIME_MATE_DEPTH} at runtime (got ${request.n})`);
      }
      return { value: forcedWinMoves(request.position, request.n), complete: true };
    }
    case 'predicate': {
      const v = evaluatePredicate(request.predicate, {
        before: request.before,
        moves: request.moves,
        side: request.side,
        limits,
      });
      return v === null ? { value: false, complete: false } : { value: v, complete: true };
    }
  }
}

/**
 * Runs one request to its verdict. Never throws: an exception becomes 'not-checked' / 'error'.
 * Pure apart from `env.expired` (the synchronous safety net); with the same request and the same
 * `maxBudget` the outcome is the same everywhere.
 */
export function executeRequest<K extends AnalysisKind>(request: AnalysisRequest & { readonly kind: K }, env: ExecuteEnv = {}): AnalysisOutcome<K> {
  const kind = request.kind;
  const requested = request.limits?.budget ?? DEFAULT_REQUEST_BUDGET;
  const budget = new RequestBudget(Math.min(requested, env.maxBudget ?? Infinity), env.expired);
  const limits: JudgeLimits = { maxNodes: request.limits?.maxNodes ?? DEFAULT_MAX_NODES, abort: budget };
  try {
    const { value, complete } = run(request, limits) as Ran<K>;
    if (complete) return { status: 'checked', kind, value, nodes: budget.visited };
    // A predicate's `false` placeholder is not a partial answer.
    const partial = kind === 'predicate' ? {} : { value };
    return { status: 'not-checked', kind, reason: budget.timedOut ? 'timeout' : 'node-limit', ...partial, nodes: budget.visited };
  } catch (e) {
    return { status: 'not-checked', kind, reason: 'error', nodes: budget.visited, message: e instanceof Error ? e.message : String(e) };
  }
}

/** True when the outcome is a verdict the caller may use (score, penalty, credit). */
export const isChecked = <K extends AnalysisKind>(
  o: AnalysisOutcome<K>,
): o is Extract<AnalysisOutcome<K>, { readonly status: 'checked' }> => o.status === 'checked';
