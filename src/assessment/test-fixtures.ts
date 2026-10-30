// TEST-ONLY assessment pool fixtures (S2.13): no real check, placement or exam content exists yet (pilot slices come
// with S2.16). Imported by *.test.ts(x) files only, never by app code. Texts reuse existing i18n keys; positions are
// original (a lone Red Chariot on distinct points, so every item has its own normal form).
import type { AssessmentItem, AssessmentPool, ChoiceExercise, ContentStatus, Strand } from '../content/types';

/** 32 points (files a–d, ranks 1–8; Generals on d0 and f9) where a lone Red Chariot gives no check: one position each. */
export const CHARIOT_POINTS: readonly string[] = ['a', 'b', 'c', 'd'].flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`));

export interface ItemSpec {
  id: string;
  unit: string;
  objective?: string;
  strand?: Strand;
  side?: 'red' | 'black';
  nature?: 'tactic' | 'quiet';
  critical?: boolean;
  status?: ContentStatus;
  fullBoard?: boolean;
  /** Index into CHARIOT_POINTS (position). */
  point?: number;
}

let counter = 0;

/**
 * A single-select `choice` assessment item with every metadata field. Black items use the colour-swapped position
 * (Black Chariot, Black to move).
 */
export function choiceItem(spec: ItemSpec): AssessmentItem {
  const point = CHARIOT_POINTS[(spec.point ?? counter++) % CHARIOT_POINTS.length];
  const black = spec.side === 'black';
  const flip = (sq: string) => `${sq[0]}${9 - Number(sq[1])}`;
  const pieces = black ? { d9: 'k', f0: 'K', [flip(point)]: 'r' } : { d0: 'K', f9: 'k', [point]: 'R' };
  const item: ChoiceExercise & Record<string, unknown> = {
    type: 'choice',
    id: spec.id,
    version: 1,
    status: spec.status ?? 'published',
    source: { kind: 'authored' },
    side: black ? 'black' : 'red',
    ...(black ? { turn: 'black' } : {}),
    strand: spec.strand ?? 'TC',
    nature: spec.nature ?? 'tactic',
    critical: spec.critical ?? false,
    misconceptions: ['b09.m1'],
    assist: 'G0',
    pieces,
    prompt: 'u3l1.e5',
    options: [
      { id: 'a', text: 'u3l1.e2', correct: true, feedback: 'u2l1.e1' },
      { id: 'b', text: 'u3l1.e6', correct: false, feedback: 'u2l1.e2', misconception: 'b09.m1' },
      { id: 'c', text: 'u3l1.e4', correct: false, feedback: 'u2l1.e3', misconception: 'b09.m1' },
    ],
    unit: spec.unit,
    objective: spec.objective ?? `${spec.unit}l1`,
    ...(spec.fullBoard ? { fullBoard: true } : {}),
  };
  return item as unknown as AssessmentItem;
}

/**
 * A b09 check pool of 16 items (two forms' worth): lessons b09l1–b09l3, 6 Black, 5 quiet, 3 critical, strands OD and
 * RS. Plus `earlier`: 4 interleaving items of b08 (strands OD / RS).
 */
export function b09CheckPool(status: ContentStatus = 'published'): AssessmentPool {
  const items = Array.from({ length: 16 }, (_, i) =>
    choiceItem({
      id: `b09-c${String(i + 1).padStart(2, '0')}`,
      unit: 'b09',
      objective: `b09l${(i % 3) + 1}`,
      strand: i % 4 === 0 ? 'RS' : 'OD',
      side: i % 8 < 3 ? 'black' : 'red',
      nature: i % 3 === 0 ? 'quiet' : 'tactic',
      critical: i % 6 === 0,
      status,
      point: i,
    }),
  );
  return { id: 'b09-check', kind: 'check', unit: 'b09', primaryStrand: 'OD', version: 1, items };
}

export function b08CheckPool(status: ContentStatus = 'published'): AssessmentPool {
  const items = Array.from({ length: 4 }, (_, i) =>
    choiceItem({ id: `b08-c0${i + 1}`, unit: 'b08', objective: 'b08l1', strand: i % 2 ? 'RS' : 'OD', critical: i === 0, status, point: 16 + i }),
  );
  return { id: 'b08-check', kind: 'check', unit: 'b08', version: 1, items };
}
