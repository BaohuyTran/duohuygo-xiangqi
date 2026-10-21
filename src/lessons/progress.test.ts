import { describe, expect, it } from 'vitest';
import type { Unit } from '../content/types';
import { JUMP_TEST_MAX, jumpTest, lessonStates, skippedLessons } from './progress';

const units = [
  { id: 'a', title: '', description: '', lessons: [{ id: 'a1', title: '', exercises: [] }, { id: 'a2', title: '', exercises: [] }] },
  { id: 'b', title: '', description: '', lessons: [{ id: 'b1', title: '', exercises: [] }] },
] as Unit[];

describe('lessonStates', () => {
  it('only the first lesson is available at the start', () => {
    expect(Object.fromEntries(lessonStates(units, []))).toEqual({ a1: 'available', a2: 'locked', b1: 'locked' });
  });

  it('unlocks the next lesson across unit boundaries', () => {
    expect(Object.fromEntries(lessonStates(units, ['a1', 'a2']))).toEqual({ a1: 'completed', a2: 'completed', b1: 'available' });
  });

  it('ignores unknown ids in storage', () => {
    expect(lessonStates(units, ['zzz', 'a1']).get('a2')).toBe('available');
  });
});

describe('lessonStates with tracks', () => {
  const tracked = [
    ...units,
    { id: 'c', title: '', description: '', track: 'intermediate', lessons: [{ id: 'c1', title: '', exercises: [] }, { id: 'c2', title: '', exercises: [] }] },
  ] as Unit[];

  it('opens the first lesson of every track from the start', () => {
    expect(Object.fromEntries(lessonStates(tracked, []))).toEqual({ a1: 'available', a2: 'locked', b1: 'locked', c1: 'available', c2: 'locked' });
  });

  it('unlocks each track on its own', () => {
    expect(Object.fromEntries(lessonStates(tracked, ['c1']))).toEqual({ a1: 'available', a2: 'locked', b1: 'locked', c1: 'completed', c2: 'available' });
  });
});

describe('jump-ahead test', () => {
  // Every lesson: a learn card, then three practice exercises named "<lesson>.<n>".
  const lessons = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `${prefix}${i + 1}`,
      title: '',
      exercises: [{ type: 'learn', text: 'x' }, ...[1, 2, 3].map((k) => ({ type: 'capture', prompt: `${prefix}${i + 1}.${k}` }))],
    }));
  const course = [
    { id: 'a', title: '', description: '', lessons: lessons('a', 3) },
    { id: 'b', title: '', description: '', lessons: lessons('b', 3) },
    { id: 'c', title: '', description: '', track: 'intermediate', lessons: lessons('c', 2) },
  ] as unknown as Unit[];
  const prompts = (id: string, completed: string[] = []) => jumpTest(course, id, completed)?.exercises.map((e) => (e as { prompt: string }).prompt);

  it('skips the not-yet-completed lessons before the target, within its track only', () => {
    expect(skippedLessons(course, 'b2', ['a2']).map((l) => l.id)).toEqual(['a1', 'a3', 'b1']);
    expect(skippedLessons(course, 'c2', []).map((l) => l.id)).toEqual(['c1']);
    expect(skippedLessons(course, 'a1', [])).toEqual([]);
  });

  it('tests the last two practice exercises of each skipped lesson, without learn cards', () => {
    expect(prompts('a3')).toEqual(['a1.2', 'a1.3', 'a2.2', 'a2.3']);
    expect(prompts('b2', ['a1', 'a2', 'a3'])).toEqual(['b1.2', 'b1.3']);
    expect(jumpTest(course, 'a1', [])).toBeNull();
    expect(jumpTest(course, 'c1', [])).toBeNull();
  });

  it(`keeps at most ${JUMP_TEST_MAX} exercises, spread evenly and in order`, () => {
    // 5 skipped lessons x 2 = 10 candidates -> 8, still covering every lesson.
    const picked = prompts('b3')!;
    expect(picked).toHaveLength(JUMP_TEST_MAX);
    expect(new Set(picked).size).toBe(JUMP_TEST_MAX);
    for (const lesson of ['a1', 'a2', 'a3', 'b1', 'b2']) expect(picked.some((p) => p.startsWith(`${lesson}.`)), lesson).toBe(true);
  });
});
