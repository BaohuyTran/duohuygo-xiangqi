import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import type { AccountService } from '../sync/service';

/** Live account state from the (React-free) account service. */
function useAccountState(account: AccountService) {
  return useSyncExternalStore(account.subscribe, account.getState);
}

/** Header button that opens the account panel. Only rendered when sync is configured. */
export function AccountButton({ account }: { account: AccountService }) {
  const { t } = useI18n();
  const state = useAccountState(account);
  const [open, setOpen] = useState(false);
  const signedIn = state.auth === 'signedIn';
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('account.open')}
        aria-haspopup="dialog"
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-500 hover:bg-stone-200"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
          <circle cx="12" cy="8" r="4" fill="currentColor" />
          <path d="M4 20.5c0-4.2 3.6-7 8-7s8 2.8 8 7z" fill="currentColor" />
        </svg>
        {signedIn && (
          <span
            data-testid="account-signed-in"
            className={`absolute right-1.5 bottom-1.5 h-3 w-3 rounded-full border-2 border-white ${state.sync === 'error' ? 'bg-amber-500' : 'bg-green-600'}`}
          />
        )}
      </button>
      {open && <AccountPanel account={account} onClose={() => setOpen(false)} />}
    </>
  );
}

export function AccountPanel({ account, onClose }: { account: AccountService; onClose: () => void }) {
  const { t } = useI18n();
  const state = useAccountState(account);
  const titleId = useId();
  const emailId = useId();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const button = 'min-h-12 w-full rounded-2xl px-4 font-extrabold';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="safe-px w-full max-w-md rounded-t-3xl bg-white pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-extrabold text-stone-800">
            {t('account.title')}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('account.close')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {state.auth === 'loading' && <p className="py-4 text-stone-600">{t('account.loading')}</p>}

        {state.auth === 'signedOut' && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSending(true);
              await account.sendMagicLink(email);
              setSending(false);
            }}
          >
            <p className="mb-4 text-sm text-stone-600">{t('account.intro')}</p>
            <label htmlFor={emailId} className="mb-1 block text-sm font-bold text-stone-700">
              {t('account.email')}
            </label>
            <input
              id={emailId}
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-3 min-h-12 w-full rounded-xl border-2 border-stone-300 px-3 text-base"
            />
            {state.sendFailed && (
              <p role="alert" className="mb-3 text-sm font-semibold text-red-700">
                {t('account.sendFailed')}
              </p>
            )}
            <button type="submit" disabled={sending} className={`${button} bg-green-600 text-white disabled:opacity-60`}>
              {sending ? t('account.sending') : t('account.sendLink')}
            </button>
          </form>
        )}

        {state.auth === 'linkSent' && (
          <div>
            <p role="status" className="mb-4 text-stone-700">
              {t('account.linkSent', { email: state.email ?? '' })}
            </p>
            <button type="button" onClick={() => account.cancelLink()} className={`${button} border-2 border-stone-300 text-stone-700`}>
              {t('account.useOtherEmail')}
            </button>
          </div>
        )}

        {state.auth === 'signedIn' && (
          <div>
            <p className="mb-1 font-bold break-all text-stone-800">{t('account.signedInAs', { email: state.email ?? '' })}</p>
            <p role="status" className={`mb-4 text-sm ${state.sync === 'error' ? 'text-amber-700' : 'text-stone-600'}`}>
              {t(`sync.${state.sync}`)}
            </p>
            <button type="button" onClick={() => void account.signOut()} className={`${button} border-2 border-stone-300 text-stone-700`}>
              {t('account.logout')}
            </button>
            <p className="mt-2 text-center text-xs text-stone-500">{t('account.logoutNote')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
