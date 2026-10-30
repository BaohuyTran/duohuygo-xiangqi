import type { Lesson, Track, Unit } from '../content/types';

export type LessonState = 'locked' | 'available' | 'completed';

/**
 * Lessons unlock in curriculum order within their track: a lesson is available once every earlier
 * lesson of the same track is completed. The first lesson of every track is open from the start, so
 * experienced players can begin the intermediate track without the basics. Completed lessons stay
 * replayable.
 *
 * Level entry gate (PD-35, 05-migration.md P5): for the tracks in `gated` (published new-course levels) the first
 * lesson is open only when the track is Basic, the previous track of the path is completed (any provenance:
 * lesson, placement — a passed J1 completes every skipped lesson — or migration), or the learner already has a
 * completed lesson in that track or a later one. Otherwise the whole track is locked (reached by J1). Tracks not in
 * `gated` (legacy tracks, the course preview) keep today's rule.
 */
export function lessonStates(units: readonly Unit[], completed: Iterable<string>, gated: ReadonlySet<Track> = new Set()): Map<string, LessonState> {
  const done = new Set(completed);
  const states = new Map<string, LessonState>();
  for (const lessons of trackLessons(units)) {
    let unlocked = gated.size === 0 || levelOpen(units, trackOfLesson(units, lessons[0].id), done, gated);
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

const trackOfLesson = (units: readonly Unit[], lessonId: string): Track =>
  units.find((u) => u.lessons.some((l) => l.id === lessonId))?.track ?? 'basics';

/**
 * PD-35: whether a track's first lesson may open. Always true for tracks outside `gated` and for Basic; otherwise
 * the previous track of the path is wholly completed, or a lesson of this or a later track is completed.
 */
export function levelOpen(units: readonly Unit[], track: Track, completed: Iterable<string>, gated: ReadonlySet<Track>): boolean {
  if (!gated.has(track) || track === 'basics') return true;
  const done = new Set(completed);
  const groups = [...trackGroups(units)];
  const i = groups.findIndex(([t]) => t === track);
  if (i <= 0) return true;
  if (groups.slice(i).some(([, lessons]) => lessons.some((l) => done.has(l.id)))) return true;
  return groups[i - 1][1].every((l) => done.has(l.id));
}

/** Lessons grouped by track (in path order), each group in curriculum order. */
function trackGroups(units: readonly Unit[]): Map<Track, Lesson[]> {
  const groups = new Map<Track, Lesson[]>();
  for (const unit of units) {
    const track = unit.track ?? 'basics';
    groups.set(track, [...(groups.get(track) ?? []), ...unit.lessons]);
  }
  return groups;
}

/** Lessons grouped by track, each group in curriculum order. */
function trackLessons(units: readonly Unit[]): Lesson[][] {
  return [...trackGroups(units).values()];
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

/**
 * The lesson Home opens on: in the highest track with a completed lesson, the first lesson not completed
 * yet (where the learner continues), or that track's last lesson when all are done. Null when nothing is
 * completed, so a new learner starts at the top. Derived from progress only, so it is the same on every
 * device the progress syncs to.
 */
export function furthestLesson(units: readonly Unit[], completed: Iterable<string>): string | null {
  const done = new Set(completed);
  const started = trackLessons(units).filter((lessons) => lessons.some((l) => done.has(l.id)));
  const track = started[started.length - 1];
  if (!track) return null;
  return (track.find((l) => !done.has(l.id)) ?? track[track.length - 1]).id;
}

/** J1 into `target` (03 §7.1): every not-yet-completed lesson of the tracks before it in the path, in order. */
export function levelSkippedLessons(units: readonly Unit[], target: Track, completed: Iterable<string>): Lesson[] {
  const done = new Set(completed);
  const groups = [...trackGroups(units)];
  const i = groups.findIndex(([t]) => t === target);
  if (i <= 0) return [];
  return groups.slice(0, i).flatMap(([, lessons]) => lessons.filter((l) => !done.has(l.id)));
}

/** The units (in path order) that hold some of `lessons`. */
export function unitsOfLessons(units: readonly Unit[], lessons: readonly Lesson[]): Unit[] {
  const ids = new Set(lessons.map((l) => l.id));
  return units.filter((u) => u.lessons.some((l) => ids.has(l.id)));
}
