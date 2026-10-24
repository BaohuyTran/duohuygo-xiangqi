// `decision` exercises at runtime (02-curriculum.md §5.1/§5.3, 04-architecture.md §5.3–§5.4): one move where
// several are reasonable, judged by a COMPLETE committed move table. Pure: no React, no DOM.
//
// Layers (04 §5.4):
// 1. safety guard (src/analysis `safetyGuard`, the item's level horizon): a move that fails it is `error`;
// 2. objective predicate (src/analysis `Predicate`, declarative JSON): a safe move that meets it is `target`;
// 3. author table: `authored` rows set target / sound / dubious / error with a reason and override 1–2,
//    except that an accepted (target/sound) or dubious row must still pass the guard.
// The rule for `computed` rows and the table proposer live in ./decision-table.ts (synchronous analysis, used
// by the validator, scripts/move-table.ts and tests only, never by a screen).
//
// Runtime: the verdict is a table lookup (instant, identical on every device). The only searches at runtime
// are the refutation shown after an `error` move and the `safe` goal of `move` exercises. Both go through
// `MoveJudge`; `clientJudge` sends them to the analysis Worker (src/analysis/client.ts, S2.5), whose answer
// may be 'not-checked' (never a penalty, 04 §5.4).
import type { AnalysisClient } from '../analysis/client';
import type { GuardSpec } from './guard';
import { makeMove, parseSquare, squareName, type Move, type Position } from '../engine';
import type { DecisionExercise, MoveClass, MoveTableEntry } from '../content/types';
import { legality, positionOf, safetyVerdict, type MoveVerdict } from './answers';

export const ACCEPTED_CLASSES: readonly MoveClass[] = ['target', 'sound'];
export const isAccepted = (c: MoveClass): boolean => ACCEPTED_CLASSES.includes(c);

/** "h2-e2" for a move. */
export const moveKey = (m: Move): string => `${squareName(m.from)}-${squareName(m.to)}`;

/** Parses "h2-e2" (null when malformed). */
export function parseMoveKey(key: unknown): Move | null {
  if (typeof key !== 'string') return null;
  const m = /^([a-i][0-9])-([a-i][0-9])$/.exec(key);
  return m ? { from: parseSquare(m[1]), to: parseSquare(m[2]) } : null;
}

/** Which safety guard a decision item uses (its level from the id, then its `guard` override). */
export const decisionGuard = (ex: Pick<DecisionExercise, 'id' | 'guard'>): GuardSpec => ({ itemId: ex.id, override: ex.guard });

export type DecisionVerdict =
  | { kind: 'illegal'; verdict: MoveVerdict }
  | { kind: 'class'; entry: MoveTableEntry };

/** Table lookup for a learner's move. Illegal moves get the usual 'illegal' / 'unsafe' verdicts. */
export function judgeDecision(ex: DecisionExercise, move: Move, pos: Position = positionOf(ex)): DecisionVerdict {
  const bad = legality(pos, move);
  if (bad) return { kind: 'illegal', verdict: bad };
  const key = moveKey(move);
  const entry = ex.table.find((e) => e.move === key);
  // The validator guarantees a complete table; a missing row (stale content) is treated as dubious, never wrong.
  return { kind: 'class', entry: entry ?? { move: key, class: 'dubious', source: 'computed' } };
}

/** First-answer credit of a decision (03-assessment.md §3.2): target/sound 1, dubious 0.5 with `partial`, else 0. */
export function decisionCredit(ex: Pick<DecisionExercise, 'partial'>, cls: MoveClass): number {
  if (isAccepted(cls)) return 1;
  return cls === 'dubious' && ex.partial ? 0.5 : 0;
}

/** The opponent's answer that shows why a move fails: a forced mate if there is one, else the best material reply. */
export interface Refutation {
  readonly reply: Move | null;
  readonly kind: 'mate' | 'material' | null;
}

/** Runtime analysis used by the player. Every method resolves (never rejects); a stopped search is 'not-checked' / null. */
export interface MoveJudge {
  /** Goal `safe`: the guard's verdict as a move verdict ('correct', 'allows-mate', 'loses-material', 'not-checked'). */
  safety(pos: Position, move: Move, guard: GuardSpec): Promise<MoveVerdict>;
  /** The refutation of `move` (shown after an `error` move). */
  refutation(pos: Position, move: Move, guard: GuardSpec): Promise<Refutation>;
}

/**
 * `MoveJudge` over an analysis client. `client` may be a loader: the app passes `loadAppAnalysisClient`, so the
 * client and its synchronous fallback (the whole search) stay out of the main chunk until the first request.
 */
export function clientJudge(client: AnalysisClient | (() => Promise<AnalysisClient>)): MoveJudge {
  const get = typeof client === 'function' ? client : () => Promise.resolve(client);
  return {
    async safety(position, move, spec) {
      const [c, guard] = await Promise.all([get(), loadGuard(spec)]);
      const o = await c.run({ kind: 'safety-guard', position, move, guard });
      return o.status === 'checked' ? safetyVerdict(o.value) : 'not-checked';
    },
    async refutation(position, move, spec) {
      // Same rule as `refutationOf` (./decision-table.ts): an engine claim only when the guard fails.
      const none: Refutation = { reply: null, kind: null };
      const [c, guard] = await Promise.all([get(), loadGuard(spec)]);
      const v = await c.run({ kind: 'safety-guard', position, move, guard });
      if (v.status !== 'checked' || v.value.safe) return none;
      const after = makeMove(position, move);
      if (v.value.allowedMate) {
        for (let n = 1; n <= Math.max(1, guard.k); n++) {
          const o = await c.run({ kind: 'forced-wins', position: after, n });
          if (o.status !== 'checked') break;
          if (o.value.length > 0) return { reply: o.value[0], kind: 'mate' };
        }
      }
      const s = await c.run({ kind: 'search', position: after, depth: Math.max(1, guard.h) });
      const reply = s.status === 'checked' ? (s.value.pv[0] ?? null) : null;
      if (!reply) return none;
      return { reply, kind: v.value.allowedMate || v.value.allowedLoss?.mate ? 'mate' : 'material' };
    },
  };
}

/** Resolves a guard spec; ./guard.ts (and src/analysis/judge.ts) load lazily, like the client. */
const loadGuard = (spec: GuardSpec) => import('./guard').then((m) => m.resolveGuard(spec));

/** The app-wide analysis client (src/analysis/client.ts), loaded on first use as its own chunk. */
export const loadAppAnalysisClient = (): Promise<AnalysisClient> => import('../analysis/client').then((m) => m.getAnalysisClient());
