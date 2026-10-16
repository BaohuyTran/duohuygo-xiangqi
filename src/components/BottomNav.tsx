import { useI18n } from '../i18n/I18nProvider';

export type Tab = 'lessons' | 'puzzles';

const ICONS: Record<Tab, string> = {
  // An open book and a puzzle piece.
  lessons: 'M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z M12 6v13.5',
  puzzles:
    'M10 3a2 2 0 0 1 4 0v2h4a1 1 0 0 1 1 1v4h-2a2 2 0 0 0 0 4h2v4a1 1 0 0 1-1 1h-4v-2a2 2 0 0 0-4 0v2H6a1 1 0 0 1-1-1v-4h2a2 2 0 0 0 0-4H5V6a1 1 0 0 1 1-1h4z',
};

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const { t } = useI18n();
  return (
    <nav
      aria-label={t('nav.label')}
      className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-stone-200 bg-[#fdf6e3] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
    >
      <div className="mx-auto flex max-w-xl">
        {(['lessons', 'puzzles'] as Tab[]).map((id) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-bold tracking-wide uppercase ${
                active ? 'text-red-700' : 'text-stone-500'
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
                <path d={ICONS[id]} fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
              {t(`nav.${id}`)}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
