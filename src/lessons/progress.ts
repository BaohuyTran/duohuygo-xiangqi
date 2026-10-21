import type { Lesson, Track, Unit } from '../content/types';

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
function trackLessons(units: readonly Unit[]): Lesson[][] {
  const groups = new Map<Track, Lesson[]>();
  for (const unit of units) {
    const track = unit.track ?? 'basics';
    groups.set(track, [...(groups.get(track) ?? []), ...unit.lessons]);
  }
  return [...groups.values()];
}

/** Lives in a jump-ahead test: this many wrong answers end it. It never costs real hearts. */
export const JUMP_TEST_LIVES = 3;
/** Practice exercises in a jump-ahead test, at most. */
export const JUMP_TEST_MAX = 8;

/** The lessons a jump to `lessonId` skips: every not-yet-completed lesson before it in its track. */
export function skippedLessons(units: readonly Unit[], lessonId: string, completed: Iterable<string>): Lesson[] {
  const done = new Set(completed);
  const track = trackLessons(units).find((lessons) => lessons.some((l) => l.id === lessonId)) ?? [];
  return track.slice(0, track.findIndex((l) => l.id === lessonId)).filter((l) => !done.has(l.id));
}

/**
 * The test for jumping ahead to `lessonId` (Duolingo's "jump here"): the last two practice exercises
 * of every skipped lesson (lessons end with their hardest exercises), spread evenly down to
 * JUMP_TEST_MAX, in curriculum order. Learn cards are left out. Null when nothing would be skipped.
 */
export function jumpTest(units: readonly Unit[], lessonId: string, completed: Iterable<string>): Lesson | null {
  const pool = skippedLessons(units, lessonId, completed).flatMap((l) => l.exercises.filter((e) => e.type !== 'learn').slice(-2));
  if (pool.length === 0) return null;
  const count = Math.min(JUMP_TEST_MAX, pool.length);
  const exercises = Array.from({ length: count }, (_, i) => pool[Math.floor(((i + 0.5) * pool.length) / count)]);
  return { id: `jump-${lessonId}`, title: 'jump.title', exercises };
}

/**
 * The track the Home "jump to …" banner points to: the first track after the first one (basics) that the
 * learner has not started yet. A track counts as started once any of its lessons, or of a later track, is
 * completed, so the banner disappears as soon as the learner is working at that level or above, and
 * moves on to the next level when more tracks exist. Null when there is nothing left to point to.
 */
export function jumpBannerTrack(units: readonly Unit[], completed: Iterable<string>): Track | null {
  const done = new Set(completed);
  const tracks = [...new Set(units.map((u) => u.track ?? 'basics'))];
  const started = tracks.map((track) => units.some((u) => (u.track ?? 'basics') === track && u.lessons.some((l) => done.has(l.id))));
  const highestStarted = started.lastIndexOf(true);
  return tracks.find((_, i) => i > 0 && i > highestStarted) ?? null;
}
