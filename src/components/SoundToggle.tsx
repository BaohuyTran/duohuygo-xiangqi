import { useI18n } from '../i18n/I18nProvider';
import { useSound } from '../sound';

/** Speaker button that mutes / unmutes all sound effects (stored via src/storage by the app). */
export function SoundToggle() {
  const { t } = useI18n();
  const { muted, setMuted } = useSound();
  return (
    <button
      type="button"
      onClick={() => setMuted(!muted)}
      aria-label={t(muted ? 'sound.turnOn' : 'sound.turnOff')}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-500 hover:bg-stone-200"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
        {muted ? (
          <path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        ) : (
          <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}
