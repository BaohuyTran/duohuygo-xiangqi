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
