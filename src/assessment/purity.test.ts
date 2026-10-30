import { describe, expect, it } from 'vitest';

// Scoring and the practical-task engine are pure TypeScript: no React, DOM, storage or gamification (03 §9: XP is not
// competence). The screens (src/components/PlayView.tsx, ReviewView.tsx) own the UI and the storage.
describe('assessment purity', () => {
  const sources = import.meta.glob(['./*.ts', '!./*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const imports = (src: string) => [...src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

  it('covers the assessment modules', () => {
    expect(Object.keys(sources)).toEqual(expect.arrayContaining(['./rubrics.ts', './practical.ts', './regime.ts']));
  });

  it('has no React, DOM or storage access', () => {
    const offenders = Object.entries(sources)
      .filter(([, src]) => /from\s+['"](react|react-dom)(\/[^'"]*)?['"]|localStorage|sessionStorage|document\.|window\./.test(src))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it('imports neither src/storage nor src/gamification nor components', () => {
    const bad: string[] = [];
    for (const [path, src] of Object.entries(sources)) {
      for (const spec of imports(src)) if (/storage|gamification|components|i18n/.test(spec)) bad.push(`${path}: ${spec}`);
    }
    expect(bad).toEqual([]);
  });

  it('rubrics.ts imports nothing from src/analysis at runtime (it is in the main chunk)', () => {
    const runtime = [...sources['./rubrics.ts'].matchAll(/^import (?!type)[^;]*from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    expect(runtime.filter((s) => s.includes('analysis'))).toEqual([]);
  });
});
