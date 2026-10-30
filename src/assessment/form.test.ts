import { describe, expect, it } from 'vitest';
import type { AssessmentItem, Strand, Track } from '../content/types';
import { assembleJ1 } from './placement';
import { pickForm, seededShuffle, spreadBy, textSeed } from './form';
import { choiceItem } from './test-fixtures';

describe('pickForm', () => {
  const nums = Array.from({ length: 12 }, (_, i) => i);

  it('returns the first form in candidate order meeting every need and cap', () => {
    const form = pickForm(nums, { size: 4, needs: [{ label: 'odd', min: 2, test: (x) => x % 2 === 1 }], caps: [{ label: 'big', max: 1, test: (x) => x >= 6 }] });
    expect(form).toEqual([0, 1, 2, 3]);
    const f2 = pickForm(nums, { size: 4, needs: [{ label: 'big', min: 3, test: (x) => x >= 9 }] });
    expect(f2).toEqual([0, 9, 10, 11]);
  });

  it('gives null when the spec cannot be met (or the budget runs out)', () => {
    expect(pickForm(nums, { size: 3, needs: [{ label: 'neg', min: 1, test: (x) => x < 0 }] })).toBeNull();
    expect(pickForm(nums, { size: 13 })).toBeNull();
    expect(pickForm(nums, { size: 3, caps: [{ label: 'all', max: 2, test: () => true }] })).toBeNull();
  });
});

describe('seeded order helpers', () => {
  it('shuffles deterministically per seed; spreads one per group before any second', () => {
    expect(seededShuffle([1, 2, 3, 4, 5], 9)).toEqual(seededShuffle([1, 2, 3, 4, 5], 9));
    expect([...seededShuffle([1, 2, 3, 4, 5], 9)].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(spreadBy(['a1', 'a2', 'a3', 'b1', 'c1', 'c2'], (s) => s[0])).toEqual(['a1', 'b1', 'c1', 'a2', 'c2', 'a3']);
    expect(textSeed(1, 'J1:advanced')).toBe(textSeed(1, 'J1:advanced'));
    expect(textSeed(1, 'J1:advanced')).not.toBe(textSeed(1, 'J1:expert'));
  });
});

describe('form assembly cost', () => {
  it('builds a J1 into Master from full-size pools (40 items per level) quickly', () => {
    const prefixes: [Track, string][] = [
      ['basics', 'b'],
      ['intermediate', 'i'],
      ['advanced', 'a'],
      ['expert', 'e'],
    ];
    const placement: Partial<Record<Track, AssessmentItem[]>> = {};
    for (const [level, p] of prefixes) {
      placement[level] = Array.from({ length: 40 }, (_, k) => {
        const strand: Strand = level === 'basics' && k < 12 ? 'RS' : (['TC', 'OD', 'PA', 'DE'] as Strand[])[k % 4];
        return choiceItem({
          id: `p${p}-${k}`,
          unit: strand === 'RS' && k < 6 ? 'b08' : `${p}0${(k % 9) + 1}`,
          strand,
          side: k % 3 === 0 ? 'black' : 'red',
          nature: k % 4 === 1 ? 'quiet' : 'tactic',
          critical: strand === 'RS' && k % 2 === 0,
          fullBoard: strand === 'RS' && k < 6,
        });
      });
    }
    const practical = [{ ...choiceItem({ id: 'pe-g1', unit: 'e06' }), type: 'play', equivalentOf: 'e06-g1' } as unknown as AssessmentItem];
    const t0 = performance.now();
    for (let seed = 0; seed < 20; seed++) {
      const r = assembleJ1({ target: 'master', placement, practical, skippedUnits: [], mastered: new Set(), exposed: new Set(), seed });
      expect(r.ok, String(seed)).toBe(true);
    }
    expect(performance.now() - t0).toBeLessThan(5000);
  });
});
