import { useI18n } from '../i18n/I18nProvider';
import { LANGUAGES } from '../i18n/messages';

export function LanguageToggle() {
  const { t, lang, setLang } = useI18n();
  return (
    <div role="group" aria-label={t('lang.label')} className="flex shrink-0 rounded-xl border-2 border-stone-200 bg-white p-0.5">
      {LANGUAGES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          aria-label={t(`lang.${l}`)}
          className={`h-11 min-w-11 rounded-lg px-2 text-sm font-bold uppercase ${lang === l ? 'bg-stone-800 text-white' : 'text-stone-500'}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
