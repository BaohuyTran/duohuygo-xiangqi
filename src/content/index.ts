import type { Lesson, Unit } from './types';

// Every unit file in ./lessons, in file-name order (01-..., 02-...).
const files = import.meta.glob<Unit>('./lessons/*.json', { eager: true, import: 'default' });

export const units: Unit[] = Object.keys(files)
  .sort()
  .map((path) => files[path]);

/** All lessons in curriculum order. */
export const allLessons: Lesson[] = units.flatMap((u) => u.lessons);

export function findLesson(id: string): Lesson | undefined {
  return allLessons.find((l) => l.id === id);
}

export type { Exercise, Lesson, Unit } from './types';
