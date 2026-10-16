/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Every animation must respect prefers-reduced-motion.
// Read from disk: Vitest does not hand CSS sources to tests.
const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8');
const components = import.meta.glob(['./components/*.tsx', '!./components/*.test.tsx'], { query: '?raw', import: 'default', eager: true });

describe('reduced motion', () => {
  it('turns off every animated class from index.css', () => {
    const reduceAt = css.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(reduceAt).toBeGreaterThan(0);
    const before = css.slice(0, reduceAt);
    const reduced = css.slice(reduceAt);
    const animated = [...before.matchAll(/\.([\w-]+)\s*\{[^}]*\banimation:/g)].map((m) => m[1]);
    expect(animated).toEqual(
      expect.arrayContaining(['piece-slide', 'piece-captured', 'feedback-in', 'feedback-pop', 'feedback-shake', 'celebrate-pop', 'confetti-piece']),
    );
    for (const cls of animated) expect(reduced, cls).toContain(`.${cls}`);
  });

  it('uses Tailwind animate-* utilities only behind motion-safe:', () => {
    for (const [file, src] of Object.entries(components)) {
      const bare = (src as string).match(/(?<![\w:-])animate-[\w-]+/g) ?? [];
      expect(bare, file).toEqual([]);
    }
  });
});
