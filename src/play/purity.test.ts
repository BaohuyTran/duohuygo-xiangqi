import { describe, expect, it } from 'vitest';

// src/play runs in the app, in content scripts and possibly in a Worker: pure TypeScript over the
// engine and the analysis layer. Deterministic: no wall clock and no Math.random (rng.ts is seeded).
describe('play purity', () => {
  const sources = import.meta.glob(['./*.ts', '!./*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<
    string,
    string
  >;
  const imports = (src: string) => [...src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

  it('covers the play modules', () => {
    expect(Object.keys(sources).sort()).toEqual(['./adjudicate.ts', './index.ts', './policies.ts', './record.ts', './rng.ts']);
  });

  it('has no React, DOM, storage, clock or Math.random', () => {
    const offenders = Object.entries(sources)
      .filter(([, src]) =>
        /from\s+['"](react|react-dom)(\/[^'"]*)?['"]|localStorage|sessionStorage|document\.|window\.|Math\.random|Date\.now|new Date|performance\.now/.test(
          src,
        ),
      )
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it('imports only sibling play modules, the engine and analysis public APIs and the request protocol', () => {
    const allowed = new Set(['../engine', '../analysis', '../analysis/requests']);
    const bad: string[] = [];
    for (const [path, src] of Object.entries(sources)) {
      for (const spec of imports(src)) {
        if (!(allowed.has(spec) || /^\.\/[a-z-]+$/.test(spec))) bad.push(`${path}: ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
