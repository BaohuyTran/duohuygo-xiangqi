import { describe, expect, it } from 'vitest';
import { checkChoice, itemSeed, seededRandom, shuffleOptions } from './choice';
import { choiceFixture } from './test-fixtures';

describe('seeded shuffle', () => {
  const options = choiceFixture().options;

  it('is deterministic for a seed and keeps every option once', () => {
    for (let seed = 0; seed < 50; seed++) {
      const a = shuffleOptions(options, seed).map((o) => o.id);
      expect(shuffleOptions(options, seed).map((o) => o.id)).toEqual(a);
      expect([...a].sort()).toEqual(options.map((o) => o.id).sort());
    }
  });

  it('keeps fixed options at their authored place and varies the others', () => {
    const orders = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const ids = shuffleOptions(options, seed).map((o) => o.id);
      expect(ids[3]).toBe('none');
      orders.add(ids.join(''));
    }
    // All 3! orders of the movable options appear.
    expect(orders.size).toBe(6);
  });

  it('does not mutate the input', () => {
    const before = options.map((o) => o.id);
    shuffleOptions(options, 7);
    expect(options.map((o) => o.id)).toEqual(before);
  });

  it('derives distinct, stable item seeds from one session seed', () => {
    expect(itemSeed(1, 'b09l3-05')).toBe(itemSeed(1, 'b09l3-05'));
    expect(itemSeed(1, 'b09l3-05')).not.toBe(itemSeed(1, 'b09l3-06'));
    expect(itemSeed(1, 'b09l3-05')).not.toBe(itemSeed(2, 'b09l3-05'));
    const r = seededRandom(3);
    const values = Array.from({ length: 100 }, r);
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
  });
});

describe('checkChoice', () => {
  it('single-select: the keyed option only', () => {
    const ex = choiceFixture();
    expect(checkChoice(ex, ['a'])).toEqual({ correct: true, missed: [], wrong: [], misconception: undefined });
    expect(checkChoice(ex, ['b'])).toMatchObject({ correct: false, missed: ['a'], wrong: ['b'], misconception: 'b09.m2' });
    expect(checkChoice(ex, ['none'])).toMatchObject({ correct: false, misconception: 'b09.m1' });
  });

  it('multi-select: exact set; a missing or an extra option is wrong', () => {
    const ex = choiceFixture(true);
    expect(checkChoice(ex, ['c', 'a']).correct).toBe(true);
    expect(checkChoice(ex, ['a'])).toMatchObject({ correct: false, missed: ['c'], wrong: [] });
    expect(checkChoice(ex, ['a', 'c', 'b'])).toMatchObject({ correct: false, wrong: ['b'], misconception: 'b09.m2' });
  });
});
