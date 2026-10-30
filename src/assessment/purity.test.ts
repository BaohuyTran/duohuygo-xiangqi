import { describe, expect, it } from 'vitest';

// Scoring, the practical-task engine and the assessment engine (credit, forms, checks, placement, exams) are pure
// TypeScript: no React, DOM, storage or gamification (03 §9: XP is not competence — mastery and application never read
// XP, streaks, hearts, daily goals or puzzle solves). The screens own the UI and the storage.
describe('assessment purity', () => {
  const sources = import.meta.glob(['./*.ts', '!./*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const imports = (src: string) => [...src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

  it('covers the assessment modules', () => {
    expect(Object.keys(sources)).toEqual(
      expect.arrayContaining(['./rubrics.ts', './practical.ts', './regime.ts', './credit.ts', './form.ts', './checks.ts', './placement.ts', './exams.ts', './index.ts']),
    );
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

  it('never reads puzzle progress, XP, hearts or streaks (03 §9 items 1 and 5)', () => {
    const bad: string[] = [];
    for (const [path, src] of Object.entries(sources)) {
      for (const spec of imports(src)) if (/puzzles|sound|sync/.test(spec)) bad.push(`${path}: ${spec}`);
      if (/\b(hearts|streak|dailyGoal|xp)\b/i.test(src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''))) bad.push(`${path}: mentions gamification state`);
    }
    expect(bad).toEqual([]);
  });

  it('the assessment engine (Home reads its states from the main chunk) imports nothing from src/analysis or practical.ts at runtime', () => {
    for (const file of ['./credit.ts', './form.ts', './checks.ts', './placement.ts', './exams.ts', './index.ts']) {
      const runtime = [...sources[file].matchAll(/^(?:import|export) (?!type)[^;]*from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
      expect(runtime.filter((s) => s.includes('analysis') || s.includes('practical')), file).toEqual([]);
    }
  });

  it('rubrics.ts imports nothing from src/analysis at runtime (it is in the main chunk)', () => {
    const runtime = [...sources['./rubrics.ts'].matchAll(/^import (?!type)[^;]*from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    expect(runtime.filter((s) => s.includes('analysis'))).toEqual([]);
  });
});
