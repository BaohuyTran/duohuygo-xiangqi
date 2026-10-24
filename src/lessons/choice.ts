// `choice` exercises (02-curriculum.md §5.1): a question about a position with 3–4 options, shown in a
// seeded order, single or multi-select, with feedback per option and misconception ids on distractors.
// Pure: no React, no DOM. The key is authored and reviewed (not computed).
import type { ChoiceExercise, ChoiceOption } from '../content/types';

/** Deterministic PRNG (mulberry32) for a 32-bit seed. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A 32-bit seed for one item from a session seed and the item's key (FNV-1a), so items differ and stay reproducible. */
export function itemSeed(sessionSeed: number, itemKey: string): number {
  let h = (0x811c9dc5 ^ (sessionSeed >>> 0)) >>> 0;
  for (let i = 0; i < itemKey.length; i++) {
    h ^= itemKey.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * The options in display order for `seed`: a Fisher–Yates shuffle of the options that are not `fixed`;
 * `fixed` options keep their authored index. Same seed, same order.
 */
export function shuffleOptions(options: readonly ChoiceOption[], seed: number): ChoiceOption[] {
  const random = seededRandom(seed);
  const movable = options.filter((o) => !o.fixed);
  for (let i = movable.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [movable[i], movable[j]] = [movable[j], movable[i]];
  }
  let next = 0;
  return options.map((o) => (o.fixed ? o : movable[next++]));
}

export interface ChoiceResult {
  correct: boolean;
  /** Correct options not picked. */
  missed: string[];
  /** Picked options that are not correct. */
  wrong: string[];
  /** Misconception of the first wrong pick (display order is irrelevant: authored order). */
  misconception?: string;
}

/** Exact-set judging (single-select is the one-element case). */
export function checkChoice(ex: Pick<ChoiceExercise, 'options'>, picked: Iterable<string>): ChoiceResult {
  const set = new Set(picked);
  const missed = ex.options.filter((o) => o.correct && !set.has(o.id)).map((o) => o.id);
  const wrongOptions = ex.options.filter((o) => !o.correct && set.has(o.id));
  return {
    correct: missed.length === 0 && wrongOptions.length === 0,
    missed,
    wrong: wrongOptions.map((o) => o.id),
    misconception: wrongOptions.find((o) => o.misconception)?.misconception,
  };
}
