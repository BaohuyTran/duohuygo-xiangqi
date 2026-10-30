// Seeded form assembly shared by unit checks (checks.ts) and jump-ahead (placement.ts). Pure: no React, DOM, storage
// or gamification; no clock and no unseeded randomness (the seed decides everything).
//
// A form is `size` items picked from an ordered candidate list so that every `need` (at least `min` items matching)
// and every `cap` (at most `max` items matching) holds. The search branches on the tightest unmet need, trying its
// candidates in the given order, and fills the remaining slots in that order once every need is met: callers put the
// candidates they prefer first (unexposed items, a seeded shuffle, one item per unit before any second), so the form
// follows that preference. Availability counts prune every branch that can no longer meet a need, and a node budget
// bounds the work; no feasible form within it gives null. The result is in candidate order.

import { createRng } from '../play/rng';

export interface Need<T> {
  /** Reported when the form cannot be built (tests, "unavailable" reasons). */
  label: string;
  min: number;
  test: (item: T) => boolean;
}

export interface Cap<T> {
  label: string;
  max: number;
  test: (item: T) => boolean;
}

export interface FormSpec<T> {
  size: number;
  needs?: readonly Need<T>[];
  caps?: readonly Cap<T>[];
  /** Search nodes before giving up (default 200,000). */
  budget?: number;
}

export const DEFAULT_FORM_BUDGET = 200_000;

/** The first form (in candidate order) meeting the spec, or null. */
export function pickForm<T>(candidates: readonly T[], spec: FormSpec<T>): T[] | null {
  const { size } = spec;
  const needs = spec.needs ?? [];
  const caps = spec.caps ?? [];
  const n = candidates.length;
  if (size < 0 || size > n) return null;
  if (needs.some((nd) => nd.min > size)) return null;
  const needHits = candidates.map((c) => needs.map((nd) => nd.test(c)));
  const capHits = candidates.map((c) => caps.map((cp) => cp.test(c)));
  const have = needs.map(() => 0);
  const used = caps.map(() => 0);
  /** 0 = free, 1 = chosen, 2 = excluded in this branch. */
  const state = new Uint8Array(n);
  let count = 0;
  let budget = spec.budget ?? DEFAULT_FORM_BUDGET;

  const takeable = (j: number) => state[j] === 0 && caps.every((cp, k) => !capHits[j][k] || used[k] < cp.max);
  const set = (j: number, on: boolean) => {
    const d = on ? 1 : -1;
    state[j] = on ? 1 : 0;
    count += d;
    for (let k = 0; k < needs.length; k++) if (needHits[j][k]) have[k] += d;
    for (let k = 0; k < caps.length; k++) if (capHits[j][k]) used[k] += d;
  };

  /** Fills the remaining slots with the first takeable candidates (needs already met); undone on failure. */
  const fill = (): boolean => {
    const taken: number[] = [];
    for (let j = 0; j < n && count < size; j++) {
      if (takeable(j)) {
        set(j, true);
        taken.push(j);
      }
    }
    if (count === size) return true;
    for (const j of taken.reverse()) set(j, false);
    return false;
  };

  // Need-directed search: branch on the candidates of the tightest unmet need, in candidate order; a candidate tried
  // and abandoned is excluded from the rest of that branch (no duplicate sets), which also tightens the availability
  // counts. When every need is met, the rest is filled in candidate order.
  const walk = (): boolean => {
    if (--budget < 0) return false;
    const left = size - count;
    let tightest = -1;
    let slack = Infinity;
    for (let k = 0; k < needs.length; k++) {
      const missing = needs[k].min - have[k];
      if (missing <= 0) continue;
      if (missing > left) return false;
      let available = 0;
      for (let j = 0; j < n; j++) if (needHits[j][k] && takeable(j)) available++;
      if (available < missing) return false;
      if (available - missing < slack) {
        slack = available - missing;
        tightest = k;
      }
    }
    if (tightest < 0) return fill();
    const excluded: number[] = [];
    let found = false;
    for (let j = 0; j < n && !found; j++) {
      if (!needHits[j][tightest] || !takeable(j)) continue;
      set(j, true);
      if (walk()) found = true;
      else {
        set(j, false);
        state[j] = 2;
        excluded.push(j);
      }
    }
    for (const j of excluded) state[j] = 0;
    return found;
  };

  if (!walk()) return null;
  const out: T[] = [];
  for (let j = 0; j < n; j++) if (state[j] === 1) out.push(candidates[j]);
  return out;
}

/** Fisher–Yates shuffle with a seeded generator (src/play/rng): same seed, same order. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const rng = createRng(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Round-robin over groups, keeping each group's order: the first item of every group, then the second of every
 * group, … ("one item per unit before any second", 03 §7.2). Groups appear in order of first appearance.
 */
export function spreadBy<T>(items: readonly T[], group: (item: T) => string): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = group(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  const lists = [...groups.values()];
  const out: T[] = [];
  for (let round = 0; out.length < items.length; round++) for (const list of lists) if (round < list.length) out.push(list[round]);
  return out;
}

/** A 32-bit seed from a text (form ids, targets): FNV-1a, so a seed + a target give a stable stream. */
export function textSeed(seed: number, text: string): number {
  let h = (0x811c9dc5 ^ (seed >>> 0)) >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
