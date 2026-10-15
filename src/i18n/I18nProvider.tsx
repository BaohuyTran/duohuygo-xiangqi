import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { LANGUAGES, translate, type Language } from './messages';

interface I18n {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18n | null>(null);

export const isLanguage = (v: unknown): v is Language => LANGUAGES.includes(v as Language);

export function I18nProvider({
  initial = 'en',
  onChange,
  children,
}: {
  initial?: Language;
  onChange?: (lang: Language) => void;
  children: ReactNode;
}) {
  const [lang, setLangState] = useState<Language>(initial);
  const setLang = useCallback(
    (next: Language) => {
      setLangState(next);
      onChange?.(next);
    },
    [onChange],
  );
  const value = useMemo<I18n>(
    () => ({ lang, setLang, t: (key, vars) => translate(lang, key, vars) }),
    [lang, setLang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
