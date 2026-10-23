import { describe, expect, it } from 'vitest';

// src/notation is pure TypeScript over the engine's public API (and the i18n Language type only).
describe('notation purity', () => {
  const sources = import.meta.glob(['./*.ts', '!./*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const imports = (src: string) => [...src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

  it('covers the notation modules', () => {
    expect(Object.keys(sources)).toContain('./format.ts');
  });

  it('has no React, DOM or storage access', () => {
    const offenders = Object.entries(sources)
      .filter(([, src]) => /from\s+['"](react|react-dom)(\/[^'"]*)?['"]|localStorage|sessionStorage|document\.|window\./.test(src))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it('imports only the engine public API, siblings and the i18n messages module', () => {
    const bad = Object.entries(sources).flatMap(([path, src]) =>
      imports(src)
        .filter((spec) => spec !== '../engine' && spec !== '../i18n/messages' && !/^\.\/[a-z-]+$/.test(spec))
        .map((spec) => `${path}: ${spec}`),
    );
    expect(bad).toEqual([]);
  });
});
