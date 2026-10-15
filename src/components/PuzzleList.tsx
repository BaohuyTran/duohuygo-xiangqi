import { useState } from 'react';
import { PUZZLE_THEMES, type Puzzle } from '../content/puzzle-types';
import { useI18n } from '../i18n/I18nProvider';
import { LanguageToggle } from './LanguageToggle';

type Grouping = 'difficulty' | 'theme';

export interface PuzzleListProps {
  puzzles: readonly Puzzle[];
  solved: ReadonlySet<string>;
  onOpen: (id: string) => void;
}

export function PuzzleList({ puzzles, solved, onOpen }: PuzzleListProps) {
  const { t } = useI18n();
  const [grouping, setGrouping] = useState<Grouping>('difficulty');
  const number = new Map(puzzles.map((p, i) => [p.id, i + 1]));

  const groups: { key: string; title: string; items: Puzzle[] }[] =
    grouping === 'difficulty'
      ? [1, 2, 3, 4, 5].map((d) => ({ key: `d${d}`, title: t('puzzles.level', { n: d }), items: puzzles.filter((p) => p.difficulty === d) }))
      : PUZZLE_THEMES.map((theme) => ({ key: theme, title: t(`theme.${theme}`), items: puzzles.filter((p) => p.theme === theme) }));
  const solvedCount = puzzles.filter((p) => solved.has(p.id)).length;

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-8">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-red-700">{t('puzzles.title')}</h1>
          <p className="text-sm text-stone-500">{t('puzzles.subtitle')}</p>
        </div>
        <LanguageToggle />
      </header>

      <p className="mb-1 text-sm font-semibold text-stone-600">{t('puzzles.solvedCount', { done: solvedCount, total: puzzles.length })}</p>
      <div className="mb-5 h-3 overflow-hidden rounded-full bg-stone-200">
        <div className="h-full rounded-full bg-amber-400" style={{ width: `${(solvedCount / Math.max(1, puzzles.length)) * 100}%` }} />
      </div>

      <div role="group" aria-label={t('puzzles.groupBy')} className="mb-6 grid grid-cols-2 rounded-xl border-2 border-stone-200 bg-white p-0.5">
        {(['difficulty', 'theme'] as Grouping[]).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGrouping(g)}
            aria-pressed={grouping === g}
            className={`h-11 rounded-lg text-sm font-bold ${grouping === g ? 'bg-stone-800 text-white' : 'text-stone-500'}`}
          >
            {t(g === 'difficulty' ? 'puzzles.byDifficulty' : 'puzzles.byTheme')}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        {groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <section key={g.key} aria-labelledby={`group-${g.key}`}>
              <h2 id={`group-${g.key}`} className="mb-2 flex items-center gap-2 text-lg font-extrabold text-stone-800">
                {g.title}
                {grouping === 'difficulty' && (
                  <span className="text-amber-500" aria-hidden>
                    {'★'.repeat(Number(g.key.slice(1)))}
                  </span>
                )}
                <span className="ml-auto text-sm font-semibold text-stone-500">
                  {g.items.filter((p) => solved.has(p.id)).length}/{g.items.length}
                </span>
              </h2>
              <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6">
                {g.items.map((p) => {
                  const done = solved.has(p.id);
                  const n = number.get(p.id)!;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => onOpen(p.id)}
                        aria-label={[t('puzzles.number', { n }), t(`goal.${p.goal}`), t(`theme.${p.theme}`), t(done ? 'puzzles.solved' : 'puzzles.unsolved')].join(', ')}
                        className={`relative flex aspect-square w-full min-h-14 flex-col items-center justify-center rounded-2xl border-2 font-extrabold active:translate-y-0.5 ${
                          done ? 'border-amber-500 bg-amber-400 text-white shadow-[0_4px_0_#d97706]' : 'border-stone-200 bg-white text-stone-700 shadow-[0_4px_0_#d6d3d1]'
                        }`}
                      >
                        <span className="text-lg leading-none">{n}</span>
                        <span className={`mt-1 text-[11px] leading-none ${done ? 'text-white/90' : 'text-stone-400'}`}>{t(`goal.short.${p.goal}`)}</span>
                        {done && (
                          <svg viewBox="0 0 24 24" className="absolute top-1 right-1 h-4 w-4" aria-hidden>
                            <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
      </div>
    </div>
  );
}
