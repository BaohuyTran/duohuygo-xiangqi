// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';
import { I18nProvider } from '../i18n/I18nProvider';
import { createMemoryStore, createProgressRepository } from '../storage';
import { createFakeBackend, type FakeBackend } from '../sync/fake-backend';
import { toRemote } from '../sync/merge';
import { createAccountService, type AccountService } from '../sync/service';
import { AccountButton } from './Account';

const USER = { id: 'user-1', email: 'me@example.com' };
let services: AccountService[] = [];

function makeAccount(backend: FakeBackend, local = createMemoryStore()) {
  const account = createAccountService({
    store: local,
    loadBackend: async () => backend,
    redirectTo: 'https://app.example/',
    debounceMs: 10,
    network: { isOnline: () => true, onOnline: () => () => {} },
  });
  services.push(account);
  return account;
}

afterEach(() => {
  cleanup();
  for (const s of services) s.dispose();
  services = [];
});

const renderButton = (account: AccountService, lang: 'en' | 'vi' = 'en') =>
  render(
    <I18nProvider initial={lang}>
      <AccountButton account={account} />
    </I18nProvider>,
  );

describe('account UI', () => {
  it('signed out: email field + send magic link, then "link sent"', async () => {
    const backend = createFakeBackend();
    const account = makeAccount(backend);
    await act(() => account.ready);
    renderButton(account);

    fireEvent.click(screen.getByRole('button', { name: 'Account and sync' }));
    expect(screen.getByRole('dialog', { name: 'Account and sync' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'me@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send magic link' }));

    expect((await screen.findByRole('status')).textContent).toMatch(/sent a sign-in link to me@example.com/);
    expect(backend.calls.links).toEqual([{ email: 'me@example.com', redirectTo: 'https://app.example/' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Use a different email' }));
    expect(screen.getByLabelText('Email')).toBeTruthy();
  });

  it('shows a send failure as a small message', async () => {
    const backend = createFakeBackend();
    backend.fail.link = true;
    const account = makeAccount(backend);
    await act(() => account.ready);
    renderButton(account);
    fireEvent.click(screen.getByRole('button', { name: 'Account and sync' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'me@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send magic link' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Couldn’t send the link/);
  });

  it('signed in: email, sync status and log out (in Vietnamese too)', async () => {
    const backend = createFakeBackend({ user: USER });
    const account = makeAccount(backend);
    await act(() => account.ready);
    renderButton(account, 'vi');
    fireEvent.click(screen.getByRole('button', { name: 'Tài khoản và đồng bộ' }));
    expect(screen.getByText('Đã đăng nhập: me@example.com')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Đã đồng bộ tiến độ'));

    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeTruthy());
  });

  it('shows a sync error without disturbing anything else', async () => {
    const backend = createFakeBackend({ user: USER });
    backend.fail.pull = true;
    const account = makeAccount(backend);
    await act(() => account.ready);
    renderButton(account);
    fireEvent.click(screen.getByRole('button', { name: 'Account and sync' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Couldn’t sync right now/));
  });

  it('closes with the close button and Escape', async () => {
    const account = makeAccount(createFakeBackend());
    await act(() => account.ready);
    renderButton(account);
    fireEvent.click(screen.getByRole('button', { name: 'Account and sync' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Account and sync' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('App with account sync', () => {
  it('has no account UI when sync is not configured', () => {
    render(<App store={createMemoryStore()} />);
    expect(screen.queryByRole('button', { name: 'Account and sync' })).toBeNull();
  });

  it('shows synced progress and language from the account without a reload', async () => {
    const backend = createFakeBackend({
      user: USER,
      rows: { [USER.id]: toRemote({ completedLessons: ['u1l1'], solvedPuzzles: [], language: 'vi', muted: null, gamification: null }) },
    });
    const account = makeAccount(backend);
    render(<App account={account} />);
    expect(screen.getByRole('button', { name: 'Account and sync' })).toBeTruthy();
    expect(await screen.findByText('Đã xong 1/22 bài')).toBeTruthy();
  });

  it('local progress made in the app is pushed to the account', async () => {
    const backend = createFakeBackend({ user: USER });
    const local = createMemoryStore();
    const account = makeAccount(backend, local);
    render(<App account={account} />);
    await act(() => account.ready);
    // The app writes through account.store (as the lesson player does on completion).
    act(() => void createProgressRepository(account.store).markCompleted('u1l1'));
    await waitFor(() => expect(backend.rows.get(USER.id)).toMatchObject({ completedLessons: ['u1l1'] }));
  });
});
