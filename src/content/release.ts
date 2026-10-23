// The release path of the new course (05-migration.md §8.4.1, 07-sourcing.md §6). Pure TypeScript: no React,
// DOM, storage or review-record imports (this module is bundled; the review records are not).
//
// - Unit order: track rank (basics < intermediate < advanced < expert < master), then file name (P3), so a
//   re-tracked legacy unit or a new unit file always lands inside its track's block.
// - Release states REL-0 (today), REL-P (pilot), REL-1–REL-5 (one level each): which levels are published, which
//   legacy lessons are retired (their LEGACY_MAP entries added), which legacy units are re-tracked and which
//   reused items are held. `CURRENT_RELEASE` names the state the shipped content is in; `releaseProblems` (test
//   T1 of 05 §8.10) checks content against a state, and the release test (src/content/reviews/gate.ts) derives the
//   legacy exemption from it.
// - The learning path: by default the legacy units plus the new-course units of published levels; in the course
//   preview (VITE_COURSE_PREVIEW=1) the new-course path only — published levels, plus the reviewed units of
//   unpublished levels — by level.

import type { Exercise, Lesson, Track, Unit } from './types';

/** Level order (02-curriculum.md §3.2). */
export const TRACK_ORDER: readonly Track[] = ['basics', 'intermediate', 'advanced', 'expert', 'master'];

/** Rank of a unit's track; a missing track is `basics` (legacy default). Unknown tracks sort last. */
export function trackRank(track: Track | undefined): number {
  const i = TRACK_ORDER.indexOf(track ?? 'basics');
  return i < 0 ? TRACK_ORDER.length : i;
}

export const trackOf = (unit: Pick<Unit, 'track'>): Track => unit.track ?? 'basics';

/** Units ordered by track rank, then by file name (path). Stable and independent of the input order. */
export function orderUnits(files: Readonly<Record<string, Unit>>): Unit[] {
  return Object.keys(files)
    .sort((a, b) => trackRank(files[a].track) - trackRank(files[b].track) || (a < b ? -1 : a > b ? 1 : 0))
    .map((path) => files[path]);
}

/** New-course ids (02-curriculum.md §3.3); the same pattern as `isNewCourseUnit` in validate.ts. */
export const isNewCourseUnitId = (id: unknown): boolean => typeof id === 'string' && /^[biaem]\d\d$/.test(id);
export const isNewCourseLessonId = (id: unknown): boolean => typeof id === 'string' && /^[biaem]\d\dl\d$/.test(id);
const LEVEL_OF_PREFIX: Record<string, Track> = { b: 'basics', i: 'intermediate', a: 'advanced', e: 'expert', m: 'master' };
/** The level of a new-course unit / lesson / item id (`b05l2-04` -> basics); undefined for other ids. */
export const levelOfId = (id: string): Track | undefined => (/^[biaem]\d\d/.test(id) ? LEVEL_OF_PREFIX[id[0]] : undefined);

// ---------- Legacy lessons (05-migration.md §3, §6) ----------

/** The 36 legacy lessons: today's track and the "Completion →" successor(s) of 05 §3. */
export const LEGACY_LESSONS: Readonly<Record<string, { track: Track; successors: readonly string[] }>> = {
  u1l1: { track: 'basics', successors: ['b01l1'] },
  u1l2: { track: 'basics', successors: ['b02l1'] },
  u1l3: { track: 'basics', successors: ['b02l3'] },
  u2l1: { track: 'basics', successors: ['b03l1'] },
  u2l2: { track: 'basics', successors: ['b03l2'] },
  u3l1: { track: 'basics', successors: ['b04l1'] },
  u3l2: { track: 'basics', successors: ['b04l2'] },
  u4l1: { track: 'basics', successors: ['b05l1'] },
  u4l2: { track: 'basics', successors: ['b05l2'] },
  u7l1: { track: 'intermediate', successors: ['i05l1'] },
  u7l2: { track: 'intermediate', successors: ['i05l2'] },
  u7l3: { track: 'intermediate', successors: ['i05l3'] },
  u8l1: { track: 'intermediate', successors: ['i06l1'] },
  u8l2: { track: 'intermediate', successors: ['i06l2'] },
  u8l3: { track: 'intermediate', successors: ['i06l3'] },
  u8l4: { track: 'intermediate', successors: ['i06l4'] },
  u9l1: { track: 'intermediate', successors: ['i02l1'] },
  u9l2: { track: 'intermediate', successors: ['i03l2'] },
  u9l3: { track: 'intermediate', successors: ['i07l1'] },
  u10l1: { track: 'intermediate', successors: ['i04l2'] },
  u10l2: { track: 'intermediate', successors: ['a06l3'] },
  u10l3: { track: 'intermediate', successors: ['a02l3'] },
  u11l1: { track: 'advanced', successors: ['i03l1'] },
  u11l2: { track: 'advanced', successors: ['i04l2'] },
  u11l3: { track: 'advanced', successors: ['i07l1'] },
  u12l1: { track: 'advanced', successors: ['a02l3'] },
  u12l2: { track: 'advanced', successors: ['a02l3'] },
  u12l3: { track: 'advanced', successors: ['a06l3'] },
  u13l1: { track: 'expert', successors: ['e04l1'] },
  u13l2: { track: 'expert', successors: ['e01l3'] },
  u13l3: { track: 'expert', successors: ['e01l3'] },
  u14l1: { track: 'expert', successors: ['e01l3'] },
  u14l2: { track: 'expert', successors: ['e01l3'] },
  u15l1: { track: 'master', successors: ['e01l3'] },
  u15l2: { track: 'master', successors: ['e01l3'] },
  u15l3: { track: 'master', successors: ['e04l1'] },
};

/** Lesson ids of the first lesson system that today's content no longer has (05 §6); never any target. */
export const ORPHAN_IDS: readonly string[] = ['u2l3', 'u3l3', 'u4l3', 'u5l1', 'u5l2', 'u5l3', 'u6l1', 'u6l2', 'u6l3'];

/** The legacy unit of a legacy lesson id (`u10l2` -> `u10`). */
export const legacyUnitOf = (lessonId: string): string => lessonId.replace(/l\d+$/, '');

// ---------- Release states (05-migration.md §8.4.1) ----------

export const RELEASE_STATE_IDS = ['REL-0', 'REL-P', 'REL-1', 'REL-2', 'REL-3', 'REL-4', 'REL-5'] as const;
export type ReleaseStateId = (typeof RELEASE_STATE_IDS)[number];

/** A reused legacy item served nowhere in a state: its legacy lesson is retired, its target level not published. */
export interface HeldItem {
  /** `<legacyLessonId>#<index>` (05 §4). */
  ref: string;
  /** Where it will live (05 §8.4.1 "Held items"). */
  target: string;
}

export interface ReleaseState {
  id: ReleaseStateId;
  /** Levels whose new-course units are in the default learning path. */
  published: readonly Track[];
  /** Legacy lessons removed from the content; LEGACY_MAP has exactly these (with their successors) + the orphans. */
  retired: readonly string[];
  /** Legacy units whose `track` the release changed (P3). */
  retracked: Readonly<Record<string, Track>>;
  held: readonly HeldItem[];
  /** LEGACY_MAP_VERSION in this state (src/progress/legacy.ts): 1 + one bump per release that retires lessons. */
  legacyMapVersion: number;
  /**
   * New-course units loaded at all: `none` (REL-0: no new-course unit file), `preview` (REL-P: at least one, none
   * published) or `published` (REL-1+: the published levels, plus any later level in the preview).
   */
  newCourse: 'none' | 'preview' | 'published';
}

const lessonsOf = (...unitIds: string[]): string[] =>
  Object.keys(LEGACY_LESSONS).filter((id) => unitIds.includes(legacyUnitOf(id)));

const RETIRED_1 = lessonsOf('u1', 'u2', 'u3', 'u4');
const RETIRED_2 = [...RETIRED_1, ...lessonsOf('u7', 'u8', 'u9'), 'u10l1', ...lessonsOf('u11')];
const RETIRED_3 = [...RETIRED_2, 'u10l2', 'u10l3', ...lessonsOf('u12')];
const RETIRED_4 = [...RETIRED_3, ...lessonsOf('u13', 'u14', 'u15')];
const HELD_U10L1: HeldItem[] = [
  { ref: 'u10l1#3', target: 'e02l1' },
  { ref: 'u10l1#4', target: 'e02l1' },
];

export const RELEASE_STATES: Readonly<Record<ReleaseStateId, ReleaseState>> = {
  'REL-0': { id: 'REL-0', published: [], retired: [], retracked: {}, held: [], legacyMapVersion: 1, newCourse: 'none' },
  'REL-P': { id: 'REL-P', published: [], retired: [], retracked: {}, held: [], legacyMapVersion: 1, newCourse: 'preview' },
  'REL-1': { id: 'REL-1', published: ['basics'], retired: RETIRED_1, retracked: {}, held: [], legacyMapVersion: 2, newCourse: 'published' },
  'REL-2': {
    id: 'REL-2',
    published: ['basics', 'intermediate'],
    retired: RETIRED_2,
    retracked: { u10: 'advanced' },
    held: [...HELD_U10L1, { ref: 'u11l3#3', target: 'a07' }, { ref: 'u11l3#4', target: 'a07' }],
    legacyMapVersion: 3,
    newCourse: 'published',
  },
  'REL-3': {
    id: 'REL-3',
    published: ['basics', 'intermediate', 'advanced'],
    retired: RETIRED_3,
    retracked: {},
    held: HELD_U10L1,
    legacyMapVersion: 4,
    newCourse: 'published',
  },
  'REL-4': {
    id: 'REL-4',
    published: ['basics', 'intermediate', 'advanced', 'expert'],
    retired: RETIRED_4,
    retracked: {},
    held: [],
    legacyMapVersion: 5,
    newCourse: 'published',
  },
  'REL-5': { id: 'REL-5', published: TRACK_ORDER, retired: RETIRED_4, retracked: {}, held: [], legacyMapVersion: 5, newCourse: 'published' },
};

/**
 * The release state of the shipped content. A release item (S3.4, S3.8, …) changes it together with the content,
 * LEGACY_MAP and LEGACY_MAP_VERSION; src/content/release.test.ts proves the content matches this state and no other.
 */
export const CURRENT_RELEASE: ReleaseStateId = 'REL-0';

/** Legacy lessons still live in a state: exempt from the release test (07-sourcing.md §6), checked by today's validators. */
export function liveLegacyLessons(state: ReleaseState): string[] {
  const retired = new Set(state.retired);
  return Object.keys(LEGACY_LESSONS).filter((id) => !retired.has(id));
}

/** LEGACY_MAP as it must be in a state (T1): the orphans with no target plus every retired lesson's successors. */
export function expectedLegacyMap(state: ReleaseState): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const id of ORPHAN_IDS) map[id] = [];
  for (const id of state.retired) map[id] = [...LEGACY_LESSONS[id].successors];
  return map;
}

/** The track a legacy unit has in a state (re-tracked or today's). */
export function legacyTrack(state: ReleaseState, unitId: string, lessonId: string): Track {
  return state.retracked[unitId] ?? LEGACY_LESSONS[lessonId]?.track ?? 'basics';
}

// ---------- Items and the learning path ----------

/** One served or loaded item: a lesson exercise or a unit pool item. */
export interface ItemRef {
  unit: Unit;
  lesson: Lesson | null;
  item: Exercise;
  /** `b05l2-04`-style id when present, else `<lessonId>#<index>` / `<unitId>/pool#<index>`. */
  ref: string;
}

export function unitItems(unit: Unit): ItemRef[] {
  const refs: ItemRef[] = [];
  for (const lesson of unit.lessons ?? []) {
    (lesson.exercises ?? []).forEach((item, i) => refs.push({ unit, lesson, item, ref: item.id ?? `${lesson.id}#${i}` }));
  }
  (unit.pool ?? []).forEach((item, i) => refs.push({ unit, lesson: null, item, ref: item.id ?? `${unit.id}/pool#${i}` }));
  return refs;
}

/** A unit the course preview may show: every lesson and pool item is `reviewed` or `published`. */
export function isReviewedUnit(unit: Unit): boolean {
  const items = unitItems(unit);
  return items.length > 0 && items.every(({ item }) => item.status === 'reviewed' || item.status === 'published');
}

export interface PathOptions {
  preview: boolean;
  state: ReleaseState;
}

/**
 * The units Home shows, in order. Default: the legacy units and the new-course units of published levels. Course
 * preview: the new-course path only, by level — published levels, and the reviewed units of unpublished levels
 * (legacy units are not shown). Content checks, not this function, guarantee that what it returns is releasable.
 */
export function coursePath(units: readonly Unit[], { preview, state }: PathOptions): Unit[] {
  const published = new Set(state.published);
  return units.filter((unit) => {
    if (!isNewCourseUnitId(unit.id)) return !preview;
    return published.has(trackOf(unit)) || (preview && isReviewedUnit(unit));
  });
}

/** Problems with the track order of a path: tracks out of rank order or split into several blocks. */
export function trackOrderProblems(units: readonly Unit[]): string[] {
  const problems: string[] = [];
  const seen = new Set<Track>();
  units.forEach((unit, i) => {
    const track = trackOf(unit);
    const prev = i > 0 ? trackOf(units[i - 1]) : null;
    if (prev === track) return;
    if (seen.has(track)) problems.push(`track "${track}" is not contiguous (unit ${unit.id})`);
    if (prev !== null && trackRank(prev) > trackRank(track)) problems.push(`track "${track}" (unit ${unit.id}) comes after "${prev}"`);
    seen.add(track);
  });
  return problems;
}

/**
 * Test T1 of 05-migration.md §8.10 for one state: an empty list means `units` (every loaded unit, in loader order)
 * and `legacyMap` are exactly what the state describes.
 */
export function releaseProblems(
  units: readonly Unit[],
  state: ReleaseState,
  legacy: { map: Readonly<Record<string, readonly string[]>>; version: number },
): string[] {
  const problems: string[] = [];
  const p = (msg: string) => problems.push(`${state.id}: ${msg}`);
  const published = new Set(state.published);
  const retired = new Set(state.retired);
  const live = new Set(liveLegacyLessons(state));
  const legacyUnits = units.filter((u) => !isNewCourseUnitId(u.id));
  const newUnits = units.filter((u) => isNewCourseUnitId(u.id));

  // LEGACY_MAP: exactly the retired lessons with their successors plus the orphans; every target published.
  const expected = expectedLegacyMap(state);
  const norm = (m: Readonly<Record<string, readonly string[]>>) =>
    JSON.stringify(Object.keys(m).sort().map((k) => [k, [...m[k]].sort()]));
  if (norm(legacy.map) !== norm(expected)) p(`LEGACY_MAP must be ${norm(expected)}, is ${norm(legacy.map)}`);
  if (legacy.version !== state.legacyMapVersion) p(`LEGACY_MAP_VERSION must be ${state.legacyMapVersion}, is ${legacy.version}`);
  for (const id of Object.keys(legacy.map)) if (live.has(id)) p(`live legacy lesson ${id} is in LEGACY_MAP`);

  // Legacy lessons: exactly the live ones are loaded, in their (possibly re-tracked) track.
  const loadedLegacy = new Set<string>();
  for (const unit of legacyUnits) {
    for (const lesson of unit.lessons) {
      loadedLegacy.add(lesson.id);
      if (!Object.hasOwn(LEGACY_LESSONS, lesson.id)) p(`unknown legacy lesson ${lesson.id}`);
      else if (!live.has(lesson.id)) p(`retired legacy lesson ${lesson.id} is still loaded`);
      else if (trackOf(unit) !== legacyTrack(state, unit.id, lesson.id)) {
        p(`legacy unit ${unit.id} must be in track "${legacyTrack(state, unit.id, lesson.id)}", is "${trackOf(unit)}"`);
      }
    }
  }
  for (const id of live) if (!loadedLegacy.has(id)) p(`live legacy lesson ${id} is missing`);

  // New-course units per state kind.
  if (state.newCourse === 'none' && newUnits.length > 0) p(`no new-course unit may be loaded (found ${newUnits.map((u) => u.id).join(', ')})`);
  if (state.newCourse === 'preview' && newUnits.length === 0) p('the pilot state needs at least one new-course unit');
  // Status per level: a published level serves only `published` items; a level the state does not publish may hold
  // only pre-release items (`reviewed` at most). This is also what tells REL-4 and REL-5 apart (same retired lessons).
  for (const unit of newUnits) {
    const levelPublished = published.has(trackOf(unit));
    for (const { item, ref } of unitItems(unit)) {
      if (levelPublished && item.status !== 'published') p(`${ref} is in published level "${trackOf(unit)}" but its status is ${String(item.status)}`);
      if (!levelPublished && item.status === 'published') p(`${ref} is published but its level "${trackOf(unit)}" is not published in this state`);
    }
  }
  const defaultPath = coursePath(units, { preview: false, state });
  const servedNew = defaultPath.filter((u) => isNewCourseUnitId(u.id));
  for (const track of state.published) {
    if (!servedNew.some((u) => trackOf(u) === track)) p(`published level "${track}" has no new-course unit`);
  }
  const servedLessons = new Set(servedNew.flatMap((u) => u.lessons.map((l) => l.id)));
  for (const [id, targets] of Object.entries(legacy.map)) {
    for (const target of targets) {
      const level = levelOfId(target);
      if (!level || !published.has(level)) p(`LEGACY_MAP target ${target} (from ${id}) is not in a published level`);
      else if (!servedLessons.has(target)) p(`LEGACY_MAP target ${target} (from ${id}) is not served`);
    }
  }

  // Default path: tracks contiguous and in rank order; each track wholly legacy or wholly new (P3, P5).
  problems.push(...trackOrderProblems(units).map((m) => `${state.id}: loaded units: ${m}`));
  problems.push(...trackOrderProblems(defaultPath).map((m) => `${state.id}: default path: ${m}`));
  for (const track of TRACK_ORDER) {
    const inTrack = defaultPath.filter((u) => trackOf(u) === track);
    const kinds = new Set(inTrack.map((u) => isNewCourseUnitId(u.id)));
    if (kinds.size > 1) p(`track "${track}" mixes legacy and new-course units`);
    if (kinds.has(true) !== published.has(track) && inTrack.length > 0) p(`track "${track}" is ${published.has(track) ? 'published but legacy' : 'new but not published'}`);
  }

  // Reused items (P1, P2): a served item's legacyRef belongs to a retired lesson, is not held, has one live home.
  const held = new Set(state.held.map((h) => h.ref));
  const homes = new Map<string, string>();
  for (const unit of servedNew) {
    for (const { item, ref } of unitItems(unit)) {
      const legacyRef = item.source?.legacyRef;
      if (!legacyRef || !/^u\d+l\d+#\d+$/.test(legacyRef)) continue;
      const lessonId = legacyRef.split('#')[0];
      if (!retired.has(lessonId)) p(`${ref} reuses ${legacyRef}, whose legacy lesson is not retired`);
      if (held.has(legacyRef)) p(`${ref} serves held item ${legacyRef}`);
      if (homes.has(legacyRef)) p(`${legacyRef} has two live homes: ${homes.get(legacyRef)} and ${ref}`);
      homes.set(legacyRef, ref);
    }
  }
  for (const h of state.held) {
    if (!retired.has(h.ref.split('#')[0])) p(`held item ${h.ref}: its legacy lesson is not retired`);
    const level = levelOfId(h.target);
    if (level && published.has(level)) p(`held item ${h.ref}: its target ${h.target} is published`);
  }
  return problems;
}

/** The states the content matches (T1: exactly one, and it must be CURRENT_RELEASE). */
export function matchingStates(
  units: readonly Unit[],
  legacy: { map: Readonly<Record<string, readonly string[]>>; version: number },
): ReleaseStateId[] {
  return RELEASE_STATE_IDS.filter((id) => releaseProblems(units, RELEASE_STATES[id], legacy).length === 0);
}
