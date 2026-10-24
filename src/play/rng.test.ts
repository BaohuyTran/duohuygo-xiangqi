import { describe, expect, it } from 'vitest';
import { createRng, deriveSeed, mulberry32 } from './rng';

describe('rng', () => {
  it('is deterministic per seed and in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(Array.from({ length: 1000 }, () => b())).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(new Set(xs).size).toBeGreaterThan(990);
  });

  it('different seeds give different streams', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('deriveSeed separates plies and links and is stable', () => {
    const seeds = new Set<number>();
    for (let ply = 0; ply < 200; ply++) for (let link = 0; link < 3; link++) seeds.add(deriveSeed(7, ply, link));
    expect(seeds.size).toBe(600);
    expect(deriveSeed(7, 3)).toBe(deriveSeed(7, 3));
    expect(deriveSeed(7, 3)).not.toBe(deriveSeed(8, 3));
    expect(deriveSeed(7, 3) >>> 0).toBe(deriveSeed(7, 3));
  });

  it('int and pick stay in range and reach every element', () => {
    const rng = createRng(5);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const n = rng.int(7);
      expect(Number.isInteger(n) && n >= 0 && n < 7).toBe(true);
      seen.add(rng.pick(['a', 'b', 'c']));
    }
    expect(seen).toEqual(new Set(['a', 'b', 'c']));
    expect(() => rng.pick([])).toThrow();
  });
});
