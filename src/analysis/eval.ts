// Leaf evaluations for src/analysis/search.ts, always from the side to move's view.
//
// `materialEval` is the engine's beginner material count (makes search equal searchScore).
// `featureEvaluator` adds the feature terms of design/04-architecture.md §5.5 (`pressing`): mobility,
// pressure on the enemy palace, attacked undefended pieces and crossed soldiers. Each term is
// reported separately by `evaluateTerms` so feedback can name what changed. The weights are
// heuristic placeholders until the `pressing` validation (backlog S2.18) tunes them.
import { PIECE_VALUES, fileOf, inPalace, materialBalance, opposite, pseudoLegalTargets, rankOf } from '../engine';
import type { Board, Color } from '../engine';
import { controlMap, hasCrossedRiver } from './features';

/** Score of `board` for `side` (the side to move in the search). Higher is better for `side`. */
export type Evaluator = (board: Board, side: Color) => number;

/** Material only (chariot 9, cannon 4.5, horse 4, advisor/elephant 2, soldier 1). */
export const materialEval: Evaluator = (board, side) => materialBalance(board, side);

export interface EvalWeights {
  /** Per pseudo-legal move of a non-general piece (pins ignored). */
  readonly mobility: number;
  /** Per (piece, enemy palace point) control pair (features.controlMap: capture squares). */
  readonly palacePressure: number;
  /** Fraction of a piece's value for each attacked, undefended piece. */
  readonly hanging: number;
  /** Per soldier across the river. */
  readonly crossedSoldier: number;
}

/** Starting weights: the 04 §5.5 prototype values plus a crossed-soldier bonus. Not validated. */
export const DEFAULT_WEIGHTS: EvalWeights = { mobility: 0.03, palacePressure: 0.08, hanging: 0.3, crossedSoldier: 0.5 };

export interface EvalTerms {
  readonly material: number;
  readonly mobility: number;
  readonly palacePressure: number;
  readonly hanging: number;
  readonly crossedSoldiers: number;
  /** Sum of the terms above (each already weighted, `side` minus opponent). */
  readonly total: number;
}

/** Every term of the feature evaluation, `side` minus opponent, weighted. */
export function evaluateTerms(board: Board, side: Color, weights: EvalWeights = DEFAULT_WEIGHTS): EvalTerms {
  const map = controlMap(board);
  const sign = (c: Color) => (c === side ? 1 : -1);
  let mobility = 0;
  let pressure = 0;
  let hanging = 0;
  let crossed = 0;
  for (let sq = 0; sq < board.length; sq++) {
    const p = board[sq];
    if (!p) continue;
    const s = sign(p.color);
    if (p.type === 'soldier' && hasCrossedRiver(board, sq)) crossed += s;
    if (p.type === 'general') continue;
    mobility += s * pseudoLegalTargets(board, sq).length;
    const enemy = opposite(p.color);
    const attackers = map[enemy][sq];
    if (attackers.length > 0 && map[p.color][sq].length === 0) hanging -= s * PIECE_VALUES[p.type];
  }
  for (const color of ['red', 'black'] as const) {
    const enemy = opposite(color);
    for (let sq = 0; sq < board.length; sq++) {
      const controllers = map[color][sq];
      if (controllers.length === 0) continue;
      if (inPalace(enemy, fileOf(sq), rankOf(sq))) pressure += sign(color) * controllers.length;
    }
  }
  const terms = {
    material: materialBalance(board, side),
    mobility: weights.mobility * mobility,
    palacePressure: weights.palacePressure * pressure,
    hanging: weights.hanging * hanging,
    crossedSoldiers: weights.crossedSoldier * crossed,
  };
  return {
    ...terms,
    total: terms.material + terms.mobility + terms.palacePressure + terms.hanging + terms.crossedSoldiers,
  };
}

/** An Evaluator using material plus the feature terms (for `pressing`-style partners). */
export function featureEvaluator(weights: EvalWeights = DEFAULT_WEIGHTS): Evaluator {
  return (board, side) => evaluateTerms(board, side, weights).total;
}
