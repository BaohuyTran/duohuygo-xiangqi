import { describe, expect, it } from 'vitest';
import { b08CheckPool, b09CheckPool, choiceItem } from '../assessment/test-fixtures';
import { allUnits } from './index';
import { allPools, isServable, poolFiles, poolLevel, poolsOf, servablePools } from './pools';
import { RELEASE_STATES } from './release';
import type { AssessmentItem, AssessmentPool, Unit } from './types';
import { validatePools } from './validate-pools';

const b09Unit: Unit = {
  id: 'b09',
  track: 'basics',
  title: 'u1.title',
  description: 'u1.desc',
  lessons: ['b09l1', 'b09l2', 'b09l3'].map((id) => ({ id, title: 'u1l1.title', exercises: [] })),
};
const files = (...pools: AssessmentPool[]) => Object.fromEntries(pools.map((p) => [p.id, p]));
const withItems = (pool: AssessmentPool, items: AssessmentItem[]): AssessmentPool => ({ ...pool, items });

describe('assessment pool loader', () => {
  it('loads src/content/assessment/*.json (none yet: the app behaves exactly as before)', () => {
    expect(allPools).toEqual(Object.values(poolFiles));
    expect(servablePools(allPools, { preview: false, state: RELEASE_STATES['REL-0'] })).toEqual([]);
  });

  it('every loaded pool is valid against the loaded units', () => {
    expect(validatePools(poolFiles, allUnits)).toEqual([]);
  });

  it('serves only published items (reviewed in the preview), only for levels the path shows; drafts never', () => {
    const pool = b09CheckPool();
    pool.items[0] = { ...pool.items[0], status: 'draft' } as AssessmentItem;
    pool.items[1] = { ...pool.items[1], status: 'reviewed' } as AssessmentItem;
    pool.items[2] = { ...pool.items[2], status: 'verified' } as AssessmentItem;
    expect(servablePools([pool], { preview: false, state: RELEASE_STATES['REL-0'] })).toEqual([]);
    const rel1 = servablePools([pool], { preview: false, state: RELEASE_STATES['REL-1'] })[0];
    expect(rel1.items).toHaveLength(13);
    expect(rel1.items.every((i) => i.status === 'published')).toBe(true);
    const preview = servablePools([pool], { preview: true, state: RELEASE_STATES['REL-P'] })[0];
    expect(preview.items.map((i) => i.status)).not.toContain('draft');
    expect(preview.items.map((i) => i.status)).not.toContain('verified');
    expect(preview.items).toHaveLength(14);
    expect(isServable({ status: 'draft' }, true)).toBe(false);
    expect(poolLevel({ unit: 'a03' })).toBe('advanced');
    expect(poolsOf([pool, b08CheckPool()], 'check', { unit: 'b08' }).map((p) => p.id)).toEqual(['b08-check']);
  });
});

describe('pool validator (03 §4.2 rule 9, rule 4; 02 §3.3 ids)', () => {
  it('accepts well-formed check pools', () => {
    expect(validatePools(files(b09CheckPool(), b08CheckPool()), [b09Unit])).toEqual([]);
  });

  it('requires the assessment metadata: unit, objective (a lesson of the unit), status and the new-course fields', () => {
    const pool = b09CheckPool();
    const bad = pool.items.slice(0, 4).map((i) => ({ ...i })) as Record<string, unknown>[];
    delete bad[0].objective;
    bad[1].objective = 'b09l7';
    delete bad[2].strand;
    delete bad[3].status;
    const problems = validatePools(files(withItems(pool, bad as unknown as AssessmentItem[])), [b09Unit]);
    expect(problems.some((p) => p.includes('items[0]') && p.includes('"objective"'))).toBe(true);
    expect(problems.some((p) => p.includes('items[1]') && p.includes('b09l7 is not a lesson'))).toBe(true);
    expect(problems.some((p) => p.includes('items[2]') && p.includes('"strand"'))).toBe(true);
    expect(problems.some((p) => p.includes('items[3]') && p.includes('"status"'))).toBe(true);
  });

  it('checks pool and item ids per kind, units per pool, and ids unique and not retired', () => {
    const p = (pool: unknown) => validatePools({ other: pool }, [b09Unit]).join('\n');
    expect(p(b09CheckPool())).toContain('"id" must be "other"');
    expect(validatePools({ 'b09-check': { ...b09CheckPool(), kind: 'quiz' } }, [])).toEqual([expect.stringContaining('"kind" must be one of')]);
    const wrongId = withItems(b09CheckPool(), [choiceItem({ id: 'b09-p01', unit: 'b09', objective: 'b09l1', point: 30 })]);
    expect(validatePools(files(wrongId), [b09Unit]).join()).toContain('must match ^b09-c\\d\\d$');
    const otherUnit = withItems(b09CheckPool(), [choiceItem({ id: 'b09-c01', unit: 'b08', objective: 'b08l1', point: 30 })]);
    expect(validatePools(files(otherUnit), [b09Unit]).join()).toContain('interleaved items live in their own unit');
    const dup = validatePools(files(b09CheckPool(), withItems(b08CheckPool(), [{ ...b08CheckPool().items[0], id: 'b08-c01' }, { ...b08CheckPool().items[1], id: 'b08-c01' }] as AssessmentItem[])), [b09Unit]);
    expect(dup.join()).toContain('duplicate id "b08-c01"');
    expect(validatePools(files(b09CheckPool()), [b09Unit], { retiredIds: ['b09-c03'] }).join()).toContain('"b09-c03" is retired');
    const pm = { id: 'pm', kind: 'placement', level: 'master', version: 1, items: [choiceItem({ id: 'pm-01', unit: 'm01', point: 31 })] };
    expect(validatePools({ pm }, []).join()).toContain('no Master placement pool');
  });

  it('placement, practical and exam pools: RS only in pb, fullBoard only for RS b08 items, equivalentOf and slots', () => {
    const pi = { id: 'pi', kind: 'placement', level: 'intermediate', version: 1, items: [choiceItem({ id: 'pi-01', unit: 'i01', objective: 'i01l1', strand: 'RS', point: 28 })] };
    expect(validatePools({ pi }, []).join()).toContain('RS placement items live in the Basic pool');
    const pb = { id: 'pb', kind: 'placement', level: 'basics', version: 1, items: [choiceItem({ id: 'pb-01', unit: 'b05', objective: 'b05l1', strand: 'RS', fullBoard: true, point: 29 })] };
    expect(validatePools({ pb }, []).join()).toContain('"fullBoard" is only for RS items of a placement pool, tagged b08');
    const pbg = { id: 'pb-g', kind: 'placement-practical', level: 'basics', version: 1, items: [choiceItem({ id: 'pb-g1', unit: 'b10', objective: 'b10l1', point: 27 })] };
    const pbgProblems = validatePools({ 'pb-g': pbg }, [], { shapeOnly: true }).join('\n');
    expect(pbgProblems).toContain('"play" / "review" tasks only');
    expect(pbgProblems).toContain('"equivalentOf" must name the unit task');
    const xb = { id: 'xb', kind: 'exam', level: 'basics', version: 1, items: [{ ...choiceItem({ id: 'xb-g1', unit: 'b10', objective: 'b10l1', point: 26 }), type: 'play', slot: 'nope' }] };
    expect(validatePools({ xb }, [], { shapeOnly: true }).join()).toContain('"slot" must be one of');
  });

  it('uniqueness corpus: no position shared with a lesson item, a unit pool item or another pool (mirror, colour swap)', () => {
    const lessonItem = choiceItem({ id: 'b09l1-02', unit: 'b09', point: 3 });
    const unit = { ...b09Unit, lessons: [{ id: 'b09l1', title: 'u1l1.title', exercises: [lessonItem] }, ...b09Unit.lessons.slice(1)] } as Unit;
    expect(validatePools(files(b09CheckPool()), [unit]).join()).toContain('position already used by b09l1-02');
    // The colour-swapped twin of a check item in another pool.
    const twin = withItems(b08CheckPool(), [choiceItem({ id: 'b08-c01', unit: 'b08', objective: 'b08l1', side: 'black', point: 5 })]);
    expect(validatePools(files(b09CheckPool(), twin), [b09Unit]).join()).toContain('items[5]: position already used by b08-check/b08-c01');
  });
});
