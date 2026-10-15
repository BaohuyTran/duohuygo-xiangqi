import { describe, expect, it } from 'vitest';
import type { Unit } from '../content/types';
import { lessonStates } from './progress';

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
