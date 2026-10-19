import type { Track, Unit } from '../content/types';

export type LessonState = 'locked' | 'available' | 'completed';

/**
 * Lessons unlock in curriculum order within their track: a lesson is available once every earlier
 * lesson of the same track is completed. The first lesson of every track is open from the start, so
 * experienced players can begin the intermediate track without the basics. Completed lessons stay
 * replayable.
 */
export function lessonStates(units: readonly Unit[], completed: Iterable<string>): Map<string, LessonState> {
  const done = new Set(completed);
  const states = new Map<string, LessonState>();
  for (const lessons of trackLessons(units)) {
    let unlocked = true;
    for (const lesson of lessons) {
      if (done.has(lesson.id)) {
        states.set(lesson.id, 'completed');
      } else {
        states.set(lesson.id, unlocked ? 'available' : 'locked');
        unlocked = false;
      }
    }
  }
  return states;
}

/** Lessons grouped by track, each group in curriculum order. */
function trackLessons(units: readonly Unit[]): Unit['lessons'][] {
  const groups = new Map<Track, Unit['lessons']>();
  for (const unit of units) {
    const track = unit.track ?? 'basics';
    groups.set(track, [...(groups.get(track) ?? []), ...unit.lessons]);
  }
  return [...groups.values()];
}
