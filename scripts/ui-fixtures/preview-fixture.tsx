// Test-only fixture page for `npm run ui:check -- --preview` (S2.19): the course-preview app (the real `units`, the
// real served pools) plus test fixtures chosen by the query string. None of it is learner content and none of it is
// in the app build (scripts/ui-fixtures/preview-fixture.config.mjs builds it on its own).
//
// - `?pools=j1`: a FIXTURE J1 placement pool for the basics level, so the J1 form, its practical slot and the result
//   screen can be walked through before any real `pb` / `pb-g` content exists: 20 single-select `choice` items from
//   src/assessment/test-fixtures.ts (a lone Chariot, legacy i18n texts; the correct option is always "u3l1.e2") and
//   the hold task of src/assessment/play-fixtures.ts as the practical task (`pb-g1`, standing for `b09-g1`).
//   scripts/ui-walkthrough/answer-key.ts `j1FixtureItems` builds the same items (keep the two in sync).
// - `?stubs=b08,i01`: one-card STUB units with those ids are put into the path before the pilot unit of their level
//   (b08 before b09, i01 before i08). The app takes a unit check's interleaved items only from check pools of units
//   earlier in the PATH (src/components/assessmentRuns.ts `checkRun`), and the pilot's interleaved items (b08-check,
//   i01-check) belong to units that are not in the preview path, so the real preview cannot build the a03 check
//   (walkthrough finding W1). With the stubs the check-cycle flow can still be walked through.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import { choiceItem } from '../../src/assessment/test-fixtures';
import { holdFixture } from '../../src/assessment/play-fixtures';
import { units } from '../../src/content';
import { allPools, servablePools } from '../../src/content/pools';
import { CURRENT_RELEASE, RELEASE_STATES } from '../../src/content/release';
import type { AssessmentItem, AssessmentPool, Strand, Unit } from '../../src/content/types';
import './fixture.css';

const query = new URLSearchParams(window.location.search);
const STRANDS: readonly Strand[] = ['RS', 'TC', 'OD', 'PA', 'DE'];

function j1Pools(): AssessmentPool[] {
  // 20 items: 4 per strand (J1_PER_STRAND), 2 critical RS items, 8 Black, 5 quiet; all of unit b09 (the only Basic unit).
  const items: AssessmentItem[] = Array.from({ length: 20 }, (_, i) =>
    choiceItem({
      id: `pb-${String(i + 1).padStart(2, '0')}`,
      unit: 'b09',
      objective: 'b09l3',
      strand: STRANDS[i % 5],
      side: i % 5 === 1 || i % 5 === 3 ? 'black' : 'red',
      nature: i % 4 === 0 ? 'quiet' : 'tactic',
      critical: i % 5 === 0 && i < 10,
      status: 'reviewed',
      point: i,
    }),
  );
  const practical = { ...holdFixture(), id: 'pb-g1', status: 'reviewed', unit: 'b09', objective: 'b09l3', equivalentOf: 'b09-g1' } as unknown as AssessmentItem;
  return [
    { id: 'pb', kind: 'placement', level: 'basics', version: 1, items },
    { id: 'pb-g', kind: 'placement-practical', level: 'basics', version: 1, items: [practical] },
  ];
}

const STUB_TEXT: Record<string, { title: string; description: string; level: Unit['track'] }> = {
  b08: { title: 'u2.title', description: 'u2.desc', level: 'basics' },
  i01: { title: 'u3.title', description: 'u3.desc', level: 'intermediate' },
};

function withStubs(path: readonly Unit[], ids: readonly string[]): Unit[] {
  const out = [...path];
  for (const id of ids) {
    const text = STUB_TEXT[id];
    if (!text) continue;
    const stub: Unit = {
      id,
      track: text.level,
      title: text.title,
      description: text.description,
      lessons: [{ id: `${id}l1`, title: 'u1l1.title', exercises: [{ type: 'learn', text: 'u1l1.e1', fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1' }] }],
    } as Unit;
    const at = out.findIndex((u) => u.track === text.level);
    out.splice(at < 0 ? out.length : at, 0, stub);
  }
  return out;
}

const pools = [...servablePools(allPools, { preview: true, state: RELEASE_STATES[CURRENT_RELEASE] }), ...(query.get('pools') === 'j1' ? j1Pools() : [])];
const course = withStubs(units, (query.get('stubs') ?? '').split(',').filter(Boolean));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App pools={pools} course={course} />
  </StrictMode>,
);
