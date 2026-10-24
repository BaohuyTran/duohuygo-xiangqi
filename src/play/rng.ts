// Seeded randomness for the training partners (design/04-architecture.md §5.5: "deterministic per seed").
//
// No unseeded randomness and no clock anywhere in src/play (src/play/purity.test.ts). A partner's
// choice at ply p of a game with seed s uses the stream `deriveSeed(s, p)`, so it depends only on the seed and
// the game so far: a game resumed from its record replays the same partner moves, and a policy that
// hands over in a chain does not shift the random numbers of the next link (each link gets its own
// derived stream).

/** mulberry32: a small, fast 32-bit generator; returns numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** murmur3 finaliser: spreads the bits of a 32-bit value. */
function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** A 32-bit seed derived from `seed` and the integer `parts` (e.g. the ply, a chain link index). */
export function deriveSeed(seed: number, ...parts: readonly number[]): number {
  let h = fmix32((seed >>> 0) ^ 0x9e3779b9);
  for (const part of parts) h = fmix32((h ^ Math.imul(part >>> 0, 0x27d4eb2d)) + 0x165667b1);
  return h;
}

export interface Rng {
  /** Next number in [0, 1). */
  next(): number;
  /** Integer in [0, n). */
  int(n: number): number;
  /** One element of a non-empty list. */
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);
  const int = (n: number) => Math.min(n - 1, Math.floor(next() * n));
  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('pick: empty list');
      return items[int(items.length)];
    },
  };
}
