import { describe, expect, it } from 'vitest';
import { allUnits } from '../content';
import { allPools, servablePools } from '../content/pools';
import { coursePath, CURRENT_RELEASE, RELEASE_STATES } from '../content/release';
import { createLearningRepository, createMemoryStore } from '../storage';
import { checkOffer, checkRun, unitBefore, type RunContext } from './assessmentRuns';

const state = RELEASE_STATES[CURRENT_RELEASE];

function previewContext(): RunContext {
  return {
    units: coursePath(allUnits, { preview: true, state }),
    pools: servablePools(allPools, { preview: true, state }),
    learning: createLearningRepository(createMemoryStore()),
    completed: () => [],
    markDone: () => {},
    now: () => new Date('2026-11-11T10:00:00'),
    seed: 20261111,
    regime: 'fallback',
  };
}

describe('unitBefore (course order: level rank, then unit number)', () => {
  it('orders new-course units by level, then number', () => {
    expect(unitBefore('b08', 'a03')).toBe(true);
    expect(unitBefore('i01', 'a03')).toBe(true);
    expect(unitBefore('a02', 'a03')).toBe(true);
    expect(unitBefore('a03', 'a03')).toBe(false);
    expect(unitBefore('a04', 'a03')).toBe(false);
    expect(unitBefore('e01', 'a03')).toBe(false);
    expect(unitBefore('b10', 'b09')).toBe(false);
  });
  it('never orders legacy ids', () => {
    expect(unitBefore('u7', 'a03')).toBe(false);
    expect(unitBefore('b08', 'u7')).toBe(false);
  });
});

describe('checkRun with the shipped preview pools (S2.19 W1)', () => {
  it('the preview path does not contain the interleaving units b08 / i01', () => {
    const ids = previewContext().units.map((u) => u.id);
    expect(ids).toContain('a03');
    expect(ids).not.toContain('b08');
    expect(ids).not.toContain('i01');
  });

  it('builds an a03 check form with 2 interleaved items from earlier units not in the path', () => {
    const ctx = previewContext();
    const run = checkRun(ctx, 'a03');
    expect(run).not.toBeNull();
    const items = run!.items as { id: string; unit?: string }[];
    expect(items).toHaveLength(8);
    const interleaved = items.filter((i) => i.unit !== 'a03');
    expect(interleaved).toHaveLength(2);
    for (const i of interleaved) expect(['b08', 'i01']).toContain(i.unit);
    expect(items.filter((i) => i.unit === 'a03')).toHaveLength(6);
  });

  it('Home offers the a03 check (not "unavailable") to a learner who completed the a03 lessons', () => {
    const ctx = previewContext();
    const a03 = ctx.units.find((u) => u.id === 'a03')!;
    const offer = checkOffer(ctx, a03, []);
    expect(offer.kind).not.toBe('unavailable');
    expect(offer.kind).not.toBe('none');
  });
});
