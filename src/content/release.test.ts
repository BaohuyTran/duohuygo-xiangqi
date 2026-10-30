/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lessonStates } from '../lessons/progress';
import { LEGACY_MAP, LEGACY_MAP_VERSION } from '../progress/legacy';
import { allUnits, units } from './index';
import {
  coursePath,
  CURRENT_RELEASE,
  expectedLegacyMap,
  isNewCourseUnitId,
  isReviewedUnit,
  LEGACY_LESSONS,
  legacyUnitOf,
  levelOfId,
  liveLegacyLessons,
  matchingStates,
  ORPHAN_IDS,
  orderUnits,
  RELEASE_STATE_IDS,
  RELEASE_STATES,
  releaseProblems,
  TRACK_ORDER,
  trackOf,
  trackOrderProblems,
  trackRank,
} from './release';
import { b09CheckPool } from '../assessment/test-fixtures';
import { allPools, isServable, poolLevel, servablePools } from './pools';
import { contentHash } from './reviews/hash';
import { isApproved, matchingRecord, releaseGateProblems, reviewFileProblems, type ReviewRecord } from './reviews/gate';
import { reviewFiles, reviewRecords } from './reviews/index';
import type { AssessmentItem, AssessmentPool, ContentStatus, Exercise, Track, Unit } from './types';
import { isNewCourseUnit } from './validate';

const legacy = { map: LEGACY_MAP, version: LEGACY_MAP_VERSION };
const ids = (list: readonly Unit[]) => list.map((u) => u.id);

// ---------- Fixtures: new-course units (there is no new-course content yet) ----------

function item(id: string, status: ContentStatus, extra: Partial<Exercise> = {}): Exercise {
  return {
    type: 'learn',
    id,
    version: 1,
    status,
    source: { kind: 'authored' },
    side: 'red',
    pieces: { e0: 'K', d9: 'k' },
    text: 'u1l1.e3',
    ...extra,
  } as Exercise;
}

function unit(id: string, lessons: string[], status: ContentStatus = 'reviewed', track: Track = levelOfId(id)!): Unit {
  return {
    id,
    title: 'u1.title',
    description: 'u1.desc',
    track,
    lessons: lessons.map((l) => ({ id: l, title: 'u1l1.title', exercises: [item(`${l}-01`, status), item(`${l}-02`, status)] })),
  };
}

function record(it: Exercise, author = 'author-run-1', by = 'reviewer-run-2'): ReviewRecord {
  return {
    id: it.id!,
    version: it.version!,
    contentHash: contentHash(it),
    author,
    checks: [{ name: 'validator', tool: 'src/content/validate.ts', result: 'pass', at: '2026-11-02' }],
    reviews: [{ role: 'content-reviewer', by, at: '2026-11-03', verdict: 'approve', scope: ['chess', 'en', 'vi'] }],
  };
}

const recordsFor = (list: readonly Unit[]) =>
  list.filter((u) => isNewCourseUnitId(u.id)).flatMap((u) => u.lessons.flatMap((l) => l.exercises.map((e) => record(e))));

/** Loader input for today's files plus extra fixture files. */
function files(extra: Record<string, Unit> = {}, drop: string[] = []): Record<string, Unit> {
  const out: Record<string, Unit> = {};
  allUnits.forEach((u, i) => {
    if (!drop.includes(u.id)) out[`./lessons/${String(i).padStart(2, '0')}-${u.id}.json`] = u;
  });
  return { ...out, ...extra };
}

/** REL-P: the pilot units (02 ids) in the preview only; one draft unit that the preview must not show. */
const pilot = {
  './lessons/b09-opening-safety.json': unit('b09', ['b09l1', 'b09l2', 'b09l3']),
  './lessons/a03-improving-pieces.json': unit('a03', ['a03l1', 'a03l2', 'a03l3']),
  './lessons/a07-defence.json': unit('a07', ['a07l4'], 'verified'),
  './lessons/i08-openings.json': unit('i08', ['i08l3']),
};
const pilotUnits = orderUnits(files(pilot));

/** REL-1: basics published (the nine successors of u1–u4), u1–u4 removed, LEGACY_MAP version 2. */
const basicsSuccessors = ['b01', 'b02', 'b03', 'b04', 'b05'].map((u) =>
  unit(
    u,
    Object.values(LEGACY_LESSONS)
      .flatMap((l) => l.successors)
      .filter((s, i, all) => s.startsWith(u) && all.indexOf(s) === i),
    'published',
  ),
);
const rel1Files = files(Object.fromEntries(basicsSuccessors.map((u) => [`./lessons/${u.id}.json`, u])), ['u1', 'u2', 'u3', 'u4']);
const rel1Units = orderUnits(rel1Files);
const rel1Legacy = { map: expectedLegacyMap(RELEASE_STATES['REL-1']), version: 2 };

/**
 * Content of a later state: every legacy lesson retired by it removed, one published unit per successor unit of the
 * published levels (holding every successor lesson), and `extra` units on top.
 */
function laterState(id: 'REL-4' | 'REL-5', extra: Record<string, Unit> = {}): { units: Unit[]; legacy: typeof legacy } {
  const state = RELEASE_STATES[id];
  const successors = [...new Set(state.retired.flatMap((l) => LEGACY_LESSONS[l].successors))];
  const byUnit = new Map<string, string[]>();
  for (const s of successors.sort()) byUnit.set(s.slice(0, 3), [...(byUnit.get(s.slice(0, 3)) ?? []), s]);
  const published = Object.fromEntries([...byUnit].map(([u, lessons]) => [`./lessons/${u}.json`, unit(u, lessons, 'published')]));
  const retiredUnits = [...new Set(state.retired.map(legacyUnitOf))];
  return {
    units: orderUnits(files({ ...published, ...extra }, retiredUnits)),
    legacy: { map: expectedLegacyMap(state), version: state.legacyMapVersion },
  };
}

// ---------- Unit order (05 §8.4.1 P3) ----------

describe('unit order', () => {
  it('orders units by track rank, then file name; today that is the file-name order', () => {
    expect(ids(allUnits)).toEqual(['u1', 'u2', 'u3', 'u4', 'u7', 'u8', 'u9', 'u10', 'u11', 'u12', 'u13', 'u14', 'u15']);
    expect(trackOrderProblems(allUnits)).toEqual([]);
    expect([...new Set(allUnits.map(trackOf))]).toEqual(TRACK_ORDER);
  });

  it('keeps every track contiguous whatever the file names (a re-tracked unit joins its new track)', () => {
    const at = (id: string, track: Track): Unit => ({ ...allUnits.find((u) => u.id === id)!, track });
    const ordered = orderUnits({
      './lessons/09-tactics.json': at('u9', 'intermediate'),
      './lessons/10-combinations.json': at('u10', 'advanced'),
      './lessons/11-hidden-attacks.json': at('u11', 'intermediate'),
      './lessons/12-mate-in-3.json': at('u12', 'advanced'),
      './lessons/01-board.json': at('u1', 'basics'),
      './lessons/z-b10.json': unit('b10', ['b10l1']),
    });
    expect(ids(ordered)).toEqual(['u1', 'b10', 'u9', 'u11', 'u10', 'u12']);
    expect(trackOrderProblems(ordered)).toEqual([]);
    expect(trackOrderProblems([ordered[0], ordered[2], ordered[1]])).not.toEqual([]);
    expect(trackRank(undefined)).toBe(0);
  });

  it('shows today exactly the loaded units, unchanged (default build)', () => {
    expect(units).toEqual(allUnits);
    expect(coursePath(allUnits, { preview: false, state: RELEASE_STATES['REL-0'] })).toEqual(allUnits);
  });

  it('recognises new-course units like the validator', () => {
    for (const id of ['b05', 'm09', 'u1', 'u10', 'b5', 'x01', 'b05l1', '']) expect(isNewCourseUnitId(id), id).toBe(isNewCourseUnit({ id }));
  });
});

// ---------- Release-state table (05 §8.4.1) ----------

describe('release states', () => {
  it('lists the 36 legacy lessons of today and the 9 orphans', () => {
    const loaded = allUnits.flatMap((u) => u.lessons.map((l) => l.id));
    expect(Object.keys(LEGACY_LESSONS).sort()).toEqual([...loaded].sort());
    expect(loaded).toHaveLength(36);
    for (const u of allUnits) for (const l of u.lessons) expect(LEGACY_LESSONS[l.id].track, l.id).toBe(trackOf(u));
    expect(ORPHAN_IDS).toHaveLength(9);
  });

  it('retires a legacy lesson exactly in the release that publishes its successor level (P1)', () => {
    for (const id of RELEASE_STATE_IDS) {
      const state = RELEASE_STATES[id];
      const derived = Object.keys(LEGACY_LESSONS).filter((l) =>
        LEGACY_LESSONS[l].successors.every((s) => state.published.includes(levelOfId(s)!)),
      );
      expect([...state.retired].sort(), id).toEqual(derived.sort());
      for (const targets of Object.values(expectedLegacyMap(state))) {
        for (const t of targets) expect(state.published, `${id} ${t}`).toContain(levelOfId(t));
      }
    }
  });

  it('matches the table of 05 §8.4.1: counts, re-tracking, held items, map versions', () => {
    const live = (id: (typeof RELEASE_STATE_IDS)[number]) => liveLegacyLessons(RELEASE_STATES[id]);
    expect(live('REL-0')).toHaveLength(36);
    expect(live('REL-P')).toHaveLength(36);
    expect(live('REL-1')).toHaveLength(27);
    expect(live('REL-2')).toEqual(['u10l2', 'u10l3', 'u12l1', 'u12l2', 'u12l3', 'u13l1', 'u13l2', 'u13l3', 'u14l1', 'u14l2', 'u15l1', 'u15l2', 'u15l3']);
    expect(live('REL-3').map(legacyUnitOf)).toEqual(['u13', 'u13', 'u13', 'u14', 'u14', 'u15', 'u15', 'u15']);
    expect(live('REL-4')).toEqual([]);
    expect(live('REL-5')).toEqual([]);
    expect(RELEASE_STATES['REL-2'].retracked).toEqual({ u10: 'advanced' });
    expect(RELEASE_STATES['REL-2'].held.map((h) => h.ref)).toEqual(['u10l1#3', 'u10l1#4', 'u11l3#3', 'u11l3#4']);
    expect(RELEASE_STATES['REL-3'].held.map((h) => h.ref)).toEqual(['u10l1#3', 'u10l1#4']);
    expect(RELEASE_STATE_IDS.map((id) => RELEASE_STATES[id].legacyMapVersion)).toEqual([1, 1, 2, 3, 4, 5, 5]);
    expect(RELEASE_STATE_IDS.map((id) => RELEASE_STATES[id].published.length)).toEqual([0, 0, 1, 2, 3, 4, 5]);
  });
});

// ---------- T1 (05 §8.10) ----------

describe('T1: content matches exactly one release state', () => {
  it('today: REL-0 and nothing else, and it is CURRENT_RELEASE', () => {
    expect(releaseProblems(allUnits, RELEASE_STATES['REL-0'], legacy)).toEqual([]);
    expect(matchingStates(allUnits, legacy)).toEqual([CURRENT_RELEASE]);
    expect(CURRENT_RELEASE).toBe('REL-0');
  });

  it('REL-P fixture: pilot units loaded, none published; legacy path unchanged', () => {
    expect(ids(pilotUnits)).toEqual(['u1', 'u2', 'u3', 'u4', 'b09', 'u7', 'u8', 'u9', 'u10', 'i08', 'u11', 'u12', 'a03', 'a07', 'u13', 'u14', 'u15']);
    expect(releaseProblems(pilotUnits, RELEASE_STATES['REL-P'], legacy)).toEqual([]);
    expect(matchingStates(pilotUnits, legacy)).toEqual(['REL-P']);
    expect(releaseProblems(pilotUnits, RELEASE_STATES['REL-0'], legacy).join('\n')).toMatch(/no new-course unit may be loaded/);
    expect(coursePath(pilotUnits, { preview: false, state: RELEASE_STATES['REL-P'] })).toEqual(allUnits);
  });

  it('REL-P fixture fails for a wrong LEGACY_MAP, a missing or re-tracked legacy lesson', () => {
    const state = RELEASE_STATES['REL-P'];
    expect(releaseProblems(pilotUnits, state, { map: { ...LEGACY_MAP, u7l1: ['i05l1'] }, version: 1 }).join('\n')).toMatch(
      /LEGACY_MAP must be[\s\S]*live legacy lesson u7l1 is in LEGACY_MAP[\s\S]*i05l1 \(from u7l1\) is not in a published level/,
    );
    expect(releaseProblems(pilotUnits, state, { map: LEGACY_MAP, version: 2 }).join('\n')).toMatch(/LEGACY_MAP_VERSION must be 1/);
    const withoutU9 = orderUnits(files(pilot, ['u9']));
    expect(releaseProblems(withoutU9, state, legacy).join('\n')).toMatch(/live legacy lesson u9l1 is missing/);
    const retracked = pilotUnits.map((u) => (u.id === 'u10' ? { ...u, track: 'advanced' as Track } : u));
    expect(releaseProblems(retracked, state, legacy).join('\n')).toMatch(/legacy unit u10 must be in track "intermediate"/);
    expect(matchingStates(withoutU9, legacy)).toEqual([]);
  });

  it('REL-1 fixture: basics published and u1–u4 retired matches REL-1 only', () => {
    expect(releaseProblems(rel1Units, RELEASE_STATES['REL-1'], rel1Legacy)).toEqual([]);
    expect(matchingStates(rel1Units, rel1Legacy)).toEqual(['REL-1']);
    expect(matchingStates(rel1Units, legacy)).toEqual([]);
  });

  it('REL-1 fixture: reused items need a retired legacy lesson, one live home, and no held item is served', () => {
    const b01 = rel1Units.find((u) => u.id === 'b01')!;
    const reuse = (refs: string[]): Unit[] =>
      rel1Units.map((u) =>
        u !== b01
          ? u
          : { ...u, lessons: [{ ...u.lessons[0], exercises: refs.map((ref, i) => item(`b01l1-0${i + 1}`, 'published', { source: { kind: 'legacy', legacyRef: ref } })) }] },
      );
    expect(releaseProblems(reuse(['u1l1#0', 'u1l2#1']), RELEASE_STATES['REL-1'], rel1Legacy)).toEqual([]);
    const errors = releaseProblems(reuse(['u7l1#2', 'u1l1#0', 'u1l1#0']), RELEASE_STATES['REL-1'], rel1Legacy).join('\n');
    expect(errors).toMatch(/b01l1-01 reuses u7l1#2, whose legacy lesson is not retired/);
    expect(errors).toMatch(/u1l1#0 has two live homes: b01l1-02 and b01l1-03/);
    const heldState = { ...RELEASE_STATES['REL-1'], held: [{ ref: 'u1l1#0', target: 'i01l1' }] };
    expect(releaseProblems(reuse(['u1l1#0']), heldState, rel1Legacy).join('\n')).toMatch(/serves held item u1l1#0/);
  });

  it('REL-4 and REL-5 are told apart by the status of the Master units', () => {
    const rel4 = laterState('REL-4', { './lessons/m01.json': unit('m01', ['m01l1'], 'reviewed') });
    expect(releaseProblems(rel4.units, RELEASE_STATES['REL-4'], rel4.legacy)).toEqual([]);
    expect(matchingStates(rel4.units, rel4.legacy)).toEqual(['REL-4']);
    expect(releaseProblems(rel4.units, RELEASE_STATES['REL-5'], rel4.legacy).join('\n')).toMatch(/m01l1-01 is in published level "master" but its status is reviewed/);
    const rel4Empty = laterState('REL-4');
    expect(matchingStates(rel4Empty.units, rel4Empty.legacy)).toEqual(['REL-4']);

    const rel5 = laterState('REL-5', { './lessons/m01.json': unit('m01', ['m01l1'], 'published') });
    expect(releaseProblems(rel5.units, RELEASE_STATES['REL-5'], rel5.legacy)).toEqual([]);
    expect(matchingStates(rel5.units, rel5.legacy)).toEqual(['REL-5']);
    expect(releaseProblems(rel5.units, RELEASE_STATES['REL-4'], rel5.legacy).join('\n')).toMatch(/m01l1-01 is published but its level "master" is not published/);
  });

  it('flags a published item in a level the state does not publish (pre-release items are reviewed at most)', () => {
    const early = orderUnits(files({ ...pilot, './lessons/a03-improving-pieces.json': unit('a03', ['a03l1'], 'published') }));
    expect(releaseProblems(early, RELEASE_STATES['REL-P'], legacy).join('\n')).toMatch(/a03l1-01 is published but its level "advanced" is not published/);
    expect(matchingStates(early, legacy)).toEqual([]);
  });

  it('a track never mixes legacy and new-course units, and a published level needs content', () => {
    const mixed = orderUnits({ ...rel1Files, './lessons/01-board.json': allUnits[0] });
    expect(releaseProblems(mixed, RELEASE_STATES['REL-1'], rel1Legacy).join('\n')).toMatch(/track "basics" mixes legacy and new-course units/);
    expect(releaseProblems(allUnits, RELEASE_STATES['REL-1'], rel1Legacy).join('\n')).toMatch(/published level "basics" has no new-course unit/);
  });
});

// ---------- Review records and the release test (07 §5.2, §6) ----------

describe('review records', () => {
  it('every record file in src/content/reviews is well-formed', () => {
    for (const { name, file } of reviewFiles) expect(reviewFileProblems(name, file), name).toEqual([]);
  });

  it('enforces author ≠ reviewer, no e-mail addresses and the file/unit binding', () => {
    const it1 = item('b09l1-01', 'reviewed');
    expect(reviewFileProblems('b09', { unit: 'b09', records: [record(it1)] })).toEqual([]);
    const self = record(it1, 'run-7', 'run-7');
    expect(isApproved(self)).toBe(false);
    expect(reviewFileProblems('b09', { unit: 'b09', records: [self] }).join('\n')).toMatch(/is the author/);
    expect(reviewFileProblems('b09', { unit: 'b09', records: [record(it1, 'me@example.com')] }).join('\n')).toMatch(/no e-mail/);
    expect(reviewFileProblems('a03', { unit: 'a03', records: [record(it1)] }).join('\n')).toMatch(/does not belong to unit a03/);
    expect(reviewFileProblems('b09', { unit: 'b09', records: [record(it1), record(it1)] }).join('\n')).toMatch(/duplicate record/);
    expect(reviewFileProblems('b09', { unit: 'b09', records: [{ ...record(it1), contentHash: 'abc' }] }).join('\n')).toMatch(/64 lower-case hex/);
    const partial = { ...record(it1), reviews: [{ ...record(it1).reviews[0], scope: ['chess', 'en'] }] };
    expect(isApproved(partial)).toBe(false);
    // Binding by id pattern, not prefix: b09.json holds b09l*, b09-p*, b09-c*, b09-g* only.
    const named = (id: string) => ({ ...record(it1), id });
    for (const id of ['b09l3-04', 'b09-p03', 'b09-c07', 'b09-g1']) expect(reviewFileProblems('b09', { unit: 'b09', records: [named(id)] }), id).toEqual([]);
    for (const id of ['b090l1-01', 'b09x', 'b09', 'b091-01', 'xb09l1-01']) {
      expect(reviewFileProblems('b09', { unit: 'b09', records: [named(id)] }).join('\n'), id).toMatch(/does not belong to unit b09/);
    }
  });

  it('the latest content-reviewer verdict decides: a later reject or changes-requested revokes an approval', () => {
    const base = record(item('b09l1-01', 'reviewed'));
    const approve = base.reviews[0];
    const later = (verdict: 'approve' | 'reject' | 'changes-requested', at: string) => ({ ...approve, by: 'reviewer-run-3', verdict, at });
    expect(isApproved(base)).toBe(true);
    expect(isApproved({ ...base, reviews: [approve, later('reject', '2026-11-04')] })).toBe(false);
    expect(isApproved({ ...base, reviews: [approve, later('changes-requested', '2026-11-04')] })).toBe(false);
    // Listed out of order: the date decides, not the position.
    expect(isApproved({ ...base, reviews: [later('changes-requested', '2026-11-04'), { ...approve, at: '2026-11-05' }] })).toBe(true);
    expect(isApproved({ ...base, reviews: [later('reject', '2026-11-02'), approve] })).toBe(true);
    // Same day: the later entry wins.
    expect(isApproved({ ...base, reviews: [approve, later('reject', approve.at)] })).toBe(false);
    // Other roles do not count as the content review.
    expect(isApproved({ ...base, reviews: [approve, { ...later('reject', '2026-11-09'), role: 'language-reviewer' }] })).toBe(true);
    // A revoked record no longer releases its item.
    const it1 = item('b09l1-01', 'reviewed');
    const revoked = { ...record(it1), reviews: [approve, later('reject', '2026-11-04')] };
    const b09 = unit('b09', ['b09l1']);
    const gateUnits = orderUnits(files({ './lessons/b09.json': { ...b09, lessons: [{ ...b09.lessons[0], exercises: [it1] }] } }));
    expect(releaseGateProblems(gateUnits, RELEASE_STATES['REL-P'], [revoked], { preview: true }).join('\n')).toMatch(/b09l1-01 has no approving/);
    expect(releaseGateProblems(gateUnits, RELEASE_STATES['REL-P'], [record(it1)], { preview: true })).toEqual([]);
  });
});

describe('release test (07 §6)', () => {
  it('passes for the shipped content, default path and preview', () => {
    const state = RELEASE_STATES[CURRENT_RELEASE];
    expect(releaseGateProblems(allUnits, state, reviewRecords, { preview: false })).toEqual([]);
    expect(releaseGateProblems(allUnits, state, reviewRecords, { preview: true })).toEqual([]);
  });

  it('REL-P fixture: reviewed pilot units with records pass in the preview; the draft unit is not shown', () => {
    const records = recordsFor(pilotUnits);
    const state = RELEASE_STATES['REL-P'];
    expect(ids(coursePath(pilotUnits, { preview: true, state }))).toEqual(['b09', 'i08', 'a03']);
    expect(releaseGateProblems(pilotUnits, state, records, { preview: true })).toEqual([]);
    expect(releaseGateProblems(pilotUnits, state, records, { preview: false })).toEqual([]);
  });

  it('fails for a missing record, a stale hash, a stale version or a self-review', () => {
    const state = RELEASE_STATES['REL-P'];
    const records = recordsFor(pilotUnits);
    const without = records.filter((r) => r.id !== 'b09l2-01');
    expect(releaseGateProblems(pilotUnits, state, without, { preview: true }).join('\n')).toMatch(/b09l2-01 has no approving review record/);
    // Changing the item (here its text key) invalidates the record.
    const edited = pilotUnits.map((u) =>
      u.id === 'b09' ? { ...u, lessons: [{ ...u.lessons[0], exercises: [{ ...u.lessons[0].exercises[0], text: 'u1l1.e1' } as Exercise, u.lessons[0].exercises[1]] }, ...u.lessons.slice(1)] } : u,
    );
    expect(releaseGateProblems(edited, state, records, { preview: true }).join('\n')).toMatch(/b09l1-01 has no approving review record/);
    const bumped = records.map((r) => (r.id === 'b09l1-02' ? { ...r, version: 2 } : r));
    expect(releaseGateProblems(pilotUnits, state, bumped, { preview: true }).join('\n')).toMatch(/b09l1-02 has no approving/);
    const self = records.map((r) => (r.id === 'a03l1-01' ? record(pilotUnits.find((u) => u.id === 'a03')!.lessons[0].exercises[0], 'x', 'x') : r));
    expect(releaseGateProblems(pilotUnits, state, self, { preview: true }).join('\n')).toMatch(/a03l1-01 has no approving/);
    // A reviewed item claims a review even when it is not served: the default path fails without its record too.
    expect(releaseGateProblems(pilotUnits, state, without, { preview: false }).join('\n')).toMatch(/loaded: b09l2-01 is reviewed without/);
  });

  it('REL-1 fixture: published items with records pass; reviewed is not enough outside the preview', () => {
    const state = RELEASE_STATES['REL-1'];
    expect(releaseGateProblems(rel1Units, state, recordsFor(rel1Units), { preview: false })).toEqual([]);
    const reviewedOnly = rel1Units.map((u) => (u.id === 'b02' ? unit('b02', u.lessons.map((l) => l.id), 'reviewed') : u));
    const records = recordsFor(reviewedOnly);
    expect(releaseGateProblems(reviewedOnly, state, records, { preview: false }).join('\n')).toMatch(/b02l1-01 is served but its status is reviewed/);
    expect(releaseGateProblems(reviewedOnly, state, records, { preview: true })).toEqual([]);
  });

  it('derives the legacy exemption from the release state: a retired legacy lesson still loaded fails', () => {
    const stale = orderUnits({ ...rel1Files, './lessons/01-board.json': allUnits[0] });
    const errors = releaseGateProblems(stale, RELEASE_STATES['REL-1'], recordsFor(stale), { preview: false }).join('\n');
    expect(errors).toMatch(/u1l1#0 is legacy content that is not live in REL-1/);
    expect(errors).not.toMatch(/u7l1/);
  });
});

// ---------- Assessment pools (03 §4.2 rule 9: draft or unreviewed items are never served) ----------

/**
 * The release test for assessment pools: every item the app may serve (src/content/pools.ts `servablePools`) has an
 * approving review record bound to its id + version + hash; every loaded item that CLAIMS `reviewed` / `published`
 * needs one too; a `published` item belongs to a published level (pre-release items are `reviewed` at most).
 */
function poolReleaseProblems(pools: readonly AssessmentPool[], state: (typeof RELEASE_STATES)[keyof typeof RELEASE_STATES], records: readonly ReviewRecord[], preview: boolean): string[] {
  const problems: string[] = [];
  const where = preview ? 'preview' : 'default path';
  for (const pool of servablePools(pools, { preview, state })) {
    for (const item of pool.items) if (!matchingRecord(item, records)) problems.push(`${where}: ${pool.id}/${item.id} is served without an approving review record`);
  }
  for (const pool of pools) {
    const level = poolLevel(pool);
    for (const item of pool.items) {
      if ((item.status === 'reviewed' || item.status === 'published') && !matchingRecord(item, records)) problems.push(`loaded: ${pool.id}/${item.id} is ${item.status} without an approving review record`);
      if (item.status === 'published' && (!level || !state.published.includes(level))) problems.push(`${pool.id}/${item.id} is published but its level "${String(level)}" is not published in ${state.id}`);
    }
  }
  return problems;
}

describe('assessment pools in the release test', () => {
  it('passes for the shipped pools (none yet), default path and preview', () => {
    const state = RELEASE_STATES[CURRENT_RELEASE];
    expect(poolReleaseProblems(allPools, state, reviewRecords, false)).toEqual([]);
    expect(poolReleaseProblems(allPools, state, reviewRecords, true)).toEqual([]);
  });

  it('REL-1 fixture: a published check pool with records passes; a missing record or a stale hash fails', () => {
    const state = RELEASE_STATES['REL-1'];
    const pool = b09CheckPool('published');
    const records = pool.items.map((i) => record(i));
    expect(poolReleaseProblems([pool], state, records, false)).toEqual([]);
    expect(poolReleaseProblems([pool], state, records.slice(1), false).join('\n')).toMatch(/b09-check\/b09-c01 is served without an approving review record/);
    const edited = { ...pool, items: [{ ...pool.items[0], prompt: 'u3l1.e1' } as AssessmentItem, ...pool.items.slice(1)] };
    expect(poolReleaseProblems([edited], state, records, false).join('\n')).toMatch(/b09-c01 is served without/);
  });

  it('drafts are never served and need no record; reviewed items are served only in the preview; published needs a published level', () => {
    const draft = b09CheckPool('draft');
    expect(servablePools([draft], { preview: true, state: RELEASE_STATES['REL-P'] })).toEqual([]);
    expect(poolReleaseProblems([draft], RELEASE_STATES['REL-P'], [], true)).toEqual([]);
    const reviewed = b09CheckPool('reviewed');
    expect(servablePools([reviewed], { preview: false, state: RELEASE_STATES['REL-P'] })).toEqual([]);
    expect(poolReleaseProblems([reviewed], RELEASE_STATES['REL-P'], reviewed.items.map((i) => record(i)), true)).toEqual([]);
    expect(poolReleaseProblems([reviewed], RELEASE_STATES['REL-P'], [], true).join('\n')).toMatch(/preview: b09-check\/b09-c01 is served without/);
    const early = b09CheckPool('published');
    expect(poolReleaseProblems([early], RELEASE_STATES['REL-P'], early.items.map((i) => record(i)), true).join('\n')).toMatch(/b09-c01 is published but its level "basics" is not published in REL-P/);
    expect(isServable({ status: 'verified' }, true)).toBe(false);
  });
});

// ---------- Drafts, bundling and the preview flag ----------

const sources = import.meta.glob(['../**/*.ts', '../**/*.tsx', '!../**/*.test.ts', '!../**/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** `../content/index.ts` (relative to src/content) -> `src/content/index.ts`. */
function srcPath(key: string): string {
  const parts = ['src', 'content'];
  for (const part of key.split('/')) {
    if (part === '..') parts.pop();
    else if (part !== '.') parts.push(part);
  }
  return parts.join('/');
}

function globToRegExp(pattern: string): RegExp {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      re += pattern[i + 2] === '/' ? '(?:.*/)?' : '.*';
      i += pattern[i + 2] === '/' ? 2 : 1;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

describe('drafts and review records are never loaded by the app', () => {
  // src/content/reviews/index.ts is the test-only record loader (checked below: no app module imports it).
  const globs = Object.entries(sources).flatMap(([key, source]) => {
    const file = srcPath(key);
    if (file.startsWith('src/content/reviews/')) return [];
    const dir = file.slice(0, file.lastIndexOf('/'));
    return [...source.matchAll(/import\.meta\.glob(?:<[^>]*>)?\(\s*(\[[^\]]*\]|'[^']*'|"[^"]*")/g)].flatMap((m) =>
      [...m[1].matchAll(/['"]([^'"]+)['"]/g)]
        .map((p) => p[1])
        .filter((p) => !p.startsWith('!'))
        .map((p) => ({ file, pattern: srcPath(`${dir.replace(/^src\/content\/?/, './').replace(/^src\//, '../')}/${p}`.replace(/^\.\/\//, './')) })),
    );
  });

  it('finds the app loaders (sanity check of this test)', () => {
    expect(globs.map((g) => g.pattern)).toEqual(expect.arrayContaining(['src/content/lessons/*.json', 'src/content/puzzles/*.json']));
  });

  it('no glob in app code matches a file under src/content/drafts or src/content/reviews', () => {
    const paths = ['src/content/drafts/b09.json', 'src/content/drafts/a/b03.json', 'src/content/reviews/b09.json', 'src/content/reviews/puzzles.json'];
    for (const { file, pattern } of globs) {
      for (const path of paths) expect(globToRegExp(pattern).test(path), `${file}: ${pattern} matches ${path}`).toBe(false);
    }
    expect(globToRegExp('src/content/**/*.json').test('src/content/drafts/b09.json')).toBe(true); // the check can fail
  });

  it('no app module imports from drafts or reviews', () => {
    for (const [key, source] of Object.entries(sources)) {
      const file = srcPath(key);
      if (file.startsWith('src/content/reviews/')) continue;
      expect(source, file).not.toMatch(/from\s+['"][^'"]*\/(drafts|reviews)(\/[^'"]*)?['"]/);
      expect(source, file).not.toMatch(/import\(\s*['"][^'"]*\/(drafts|reviews)\b/);
    }
  });

  it('keeps the drafts folder in the repository', () => {
    expect(existsSync(new URL('./drafts/.gitkeep', import.meta.url))).toBe(true);
  });
});

describe('course preview', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('is off by default', async () => {
    const content = await import('./index');
    expect(content.COURSE_PREVIEW).toBe(false);
    expect(content.units).toEqual(content.allUnits);
  });

  it('VITE_COURSE_PREVIEW=1 shows the new-course path instead of the legacy path (empty today)', async () => {
    vi.stubEnv('VITE_COURSE_PREVIEW', '1');
    vi.resetModules();
    const content = await import('./index');
    expect(content.COURSE_PREVIEW).toBe(true);
    expect(content.units).toEqual([]);
    expect(content.findLesson('u1l1')).toBeUndefined();
  });

  it('is never set for the deployed build', () => {
    for (const wf of ['deploy.yml', 'ci.yml']) {
      const path = new URL(`../../.github/workflows/${wf}`, import.meta.url);
      if (existsSync(path)) expect(readFileSync(path, 'utf8'), wf).not.toMatch(/VITE_COURSE_PREVIEW/);
    }
  });

  it('shows reviewed units of unpublished levels by level, legacy units hidden, first lesson of each level open', () => {
    const state = RELEASE_STATES['REL-P'];
    const path = coursePath(pilotUnits, { preview: true, state });
    expect(ids(path)).toEqual(['b09', 'i08', 'a03']);
    expect(path.every(isReviewedUnit)).toBe(true);
    const states = lessonStates(path, []);
    expect(['b09l1', 'i08l3', 'a03l1'].map((id) => states.get(id))).toEqual(['available', 'available', 'available']);
    expect(['b09l2', 'a03l2'].map((id) => states.get(id))).toEqual(['locked', 'locked']);
  });

  it('in a later state shows published levels and reviewed units of the others', () => {
    const units1 = orderUnits({ ...rel1Files, './lessons/a03.json': unit('a03', ['a03l1']), './lessons/e01.json': unit('e01', ['e01l1'], 'draft') });
    expect(ids(coursePath(units1, { preview: true, state: RELEASE_STATES['REL-1'] }))).toEqual(['b01', 'b02', 'b03', 'b04', 'b05', 'a03']);
    expect(ids(coursePath(units1, { preview: false, state: RELEASE_STATES['REL-1'] }))[0]).toBe('b01');
    expect(ids(coursePath(units1, { preview: false, state: RELEASE_STATES['REL-1'] }))).not.toContain('a03');
  });
});
