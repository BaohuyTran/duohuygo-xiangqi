// TEST-ONLY near-duplicate check of assessment positions (03 §4.2 rule 4), stricter than the pool validator's corpus
// (normalize.ts: exact up to mirror / colour swap). Used by the per-unit content tests (pilot-b02.test.ts, …); never
// import it from app code.
import type { Position } from '../engine';

type Placed = { f: number; r: number; type: string; color: string };
const placed = (pos: Position): Placed[] => pos.board.flatMap((p, sq) => (p ? [{ f: sq % 9, r: Math.floor(sq / 9), type: p.type, color: p.color }] : []));
/**
 * 03 §4.2 rule 4, stricter than the validator's corpus: is `item` the position `other` up to file mirror, colour swap
 * (side to move ignored), a shift of the whole pattern (aligned on the Generals) and ONE non-General piece added, removed
 * or moved?
 */
export function nearDuplicate(item: Position, other: Position): boolean {
  const target = placed(item);
  const key = (p: Placed) => `${p.f},${p.r},${p.type},${p.color}`;
  const general = (list: Placed[], color: string) => list.find((p) => p.type === 'general' && p.color === color);
  for (const mirror of [false, true])
    for (const swap of [false, true]) {
      const moved = placed(other).map((p) => ({ f: mirror ? 8 - p.f : p.f, r: swap ? 9 - p.r : p.r, type: p.type, color: swap ? (p.color === 'red' ? 'black' : 'red') : p.color }));
      const [gr, gb, tr, tb] = [general(moved, 'red'), general(moved, 'black'), general(target, 'red'), general(target, 'black')];
      if (!gr || !gb || !tr || !tb) continue;
      const [df, dr] = [tr.f - gr.f, tr.r - gr.r];
      if (gb.f + df !== tb.f || gb.r + dr !== tb.r) continue;
      const a = new Set(moved.filter((p) => p.type !== 'general').map((p) => key({ ...p, f: p.f + df, r: p.r + dr })));
      const b = new Set(target.filter((p) => p.type !== 'general').map(key));
      const onlyA = [...a].filter((k) => !b.has(k));
      const onlyB = [...b].filter((k) => !a.has(k));
      const kind = (k: string) => k.split(',').slice(2).join();
      if (onlyA.length + onlyB.length <= 1) return true;
      if (onlyA.length === 1 && onlyB.length === 1 && kind(onlyA[0]) === kind(onlyB[0])) return true;
    }
  return false;
}
