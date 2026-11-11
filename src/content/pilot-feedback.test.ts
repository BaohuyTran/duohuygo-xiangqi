// 02 §7.3 for every pilot item (W10, S2.20): at G1 / G0 / TR the common-error text points to the idea without giving
// the move. No `.error` text may name an accepted move of its item, in English or Vietnamese: every accepted row of the
// first table (decision, line root, play-task tree root) and the solution of a `move` item, written with `formatMove`.
import { describe, expect, it } from 'vitest';
import { legalMoves, type Position } from '../engine';
import { messages } from '../i18n/messages';
import { isAccepted, parseMoveKey } from '../lessons/decision';
import { positionOf } from '../lessons/answers';
import { formatMove } from '../notation/format';
import { allUnits } from './index';
import { poolFiles } from './pools';
import { isNewCourseUnitId } from './release';
import type { Exercise, MoveTableEntry } from './types';

const texts = messages as Record<string, { en: string; vi: string }>;
const items: Exercise[] = [
  ...allUnits.filter((u) => isNewCourseUnitId(u.id)).flatMap((u) => [...u.lessons.flatMap((l) => l.exercises), ...(u.pool ?? [])]),
  ...Object.values(poolFiles).flatMap((p) => p.items as Exercise[]),
];
const level = (e: Exercise) => e.assist ?? (e.type === 'play' || e.type === 'review' ? 'TR' : undefined);

/** The accepted first answers of an item, in traditional notation (en and vi). */
function acceptedNames(e: Exercise): string[] {
  const pos: Position = positionOf(e);
  const keys: string[] = [];
  const table: readonly MoveTableEntry[] | undefined = e.type === 'decision' ? e.table : e.type === 'line' ? e.root.table : e.type === 'play' ? e.tree?.table : undefined;
  if (table) keys.push(...table.filter((r) => isAccepted(r.class)).map((r) => r.move));
  if (e.type === 'move') keys.push(`${e.solution.from}-${e.solution.to}`);
  return keys.flatMap((k) => {
    const want = parseMoveKey(k)!;
    const m = legalMoves(pos).find((x) => x.from === want.from && x.to === want.to)!;
    return [formatMove(m, pos, 'traditional', 'en'), formatMove(m, pos, 'traditional', 'vi')];
  });
}

describe('pilot feedback (02 §7.3, W10)', () => {
  it('no G1 / G0 / TR common-error text names an accepted move of its item (en or vi)', () => {
    const leaks: string[] = [];
    for (const e of items) {
      const key = e.feedback?.commonError;
      if (!key || !['G1', 'G0', 'TR'].includes(level(e) ?? '')) continue;
      const names = acceptedNames(e);
      for (const lang of ['en', 'vi'] as const) {
        const hit = names.filter((n) => texts[key][lang].includes(n));
        if (hit.length) leaks.push(`${e.id} ${key} (${lang}): ${[...new Set(hit)].join(', ')}`);
      }
    }
    expect(leaks).toEqual([]);
  });
});
