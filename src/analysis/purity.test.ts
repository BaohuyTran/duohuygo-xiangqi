import { describe, expect, it } from 'vitest';

// src/analysis runs in a Web Worker and in Node tests: pure TypeScript over the engine's public API.
describe('analysis purity', () => {
  const sources = import.meta.glob(['./*.ts', '!./*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<
    string,
    string
  >;
  const imports = (src: string) => [...src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

  it('covers the analysis modules', () => {
    expect(Object.keys(sources)).toEqual(expect.arrayContaining(['./search.ts', './eval.ts', './features.ts', './judge.ts', './index.ts']));
  });

  it('has no React, DOM or storage access', () => {
    const offenders = Object.entries(sources)
      .filter(([, src]) => /from\s+['"](react|react-dom)(\/[^'"]*)?['"]|localStorage|sessionStorage|document\.|window\./.test(src))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it('imports only sibling analysis modules and the engine public API (no src/gamification)', () => {
    const bad: string[] = [];
    for (const [path, src] of Object.entries(sources)) {
      for (const spec of imports(src)) {
        const ok = spec === '../engine' || /^\.\/[a-z-]+$/.test(spec);
        if (!ok || spec.includes('gamification')) bad.push(`${path}: ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
