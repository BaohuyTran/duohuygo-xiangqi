import type { Unit } from '../content/types';

export type LessonState = 'locked' | 'available' | 'completed';

/**
 * Lessons unlock in curriculum order: a lesson is available once every lesson before it is
 * completed. Completed lessons stay replayable.
 */
export function lessonStates(units: readonly Unit[], completed: Iterable<string>): Map<string, LessonState> {
  const done = new Set(completed);
  const states = new Map<string, LessonState>();
  let unlocked = true;
  for (const lesson of units.flatMap((u) => u.lessons)) {
    if (done.has(lesson.id)) {
      states.set(lesson.id, 'completed');
    } else {
      states.set(lesson.id, unlocked ? 'available' : 'locked');
      unlocked = false;
    }
  }
  return states;
}
