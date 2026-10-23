import { coursePath, CURRENT_RELEASE, orderUnits, RELEASE_STATES } from './release';
import type { Lesson, Unit } from './types';

// Every unit file in ./lessons (never ./drafts: unreviewed material is not loaded, 07-sourcing.md §6), ordered by
// track rank (basics < intermediate < advanced < expert < master), then file name (05-migration.md §8.4.1 P3).
const files = import.meta.glob<Unit>('./lessons/*.json', { eager: true, import: 'default' });

/** Every loaded unit, in course order. Content tests validate all of them. */
export const allUnits: Unit[] = orderUnits(files);

/**
 * Course preview (VITE_COURSE_PREVIEW=1 at build time; off by default and in the deployed build): Home shows the
 * new-course path (published levels plus the reviewed units of unpublished levels) instead of the legacy path.
 */
export const COURSE_PREVIEW = import.meta.env.VITE_COURSE_PREVIEW === '1';

/** The units Home shows: the default learning path of the current release state, or the course preview. */
export const units: Unit[] = coursePath(allUnits, { preview: COURSE_PREVIEW, state: RELEASE_STATES[CURRENT_RELEASE] });

/** All loaded lessons in course order (also those outside the current path). */
export const allLessons: Lesson[] = allUnits.flatMap((u) => u.lessons);

/** A lesson of the path Home shows. */
export function findLesson(id: string): Lesson | undefined {
  return units.flatMap((u) => u.lessons).find((l) => l.id === id);
}

export type { Exercise, Lesson, Unit } from './types';
