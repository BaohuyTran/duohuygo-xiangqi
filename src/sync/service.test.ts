import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '../gamification';
import {
  createGamificationRepository,
  createLearningRepository,
  createMemoryStore,
  createProgressRepository,
  createPuzzleProgressRepository,
  createSettingsRepository,
  readSnapshot,
  writeSnapshot,
  type KeyValueStore,
} from '../storage';
import { completedView } from '../progress/legacy';
import { createFakeBackend, type FakeBackend } from './fake-backend';
import { mergeSnapshots, parseRemote, toRemote } from './merge';
import { emptyRecords, type CompletionGrant, type MasteryGrant } from '../progress/records';
import { createAccountService, isEmail, type AccountService, type NetworkStatus } from './service';

const NOW = new Date(2026, 9, 16, 12, 0, 0);
const USER = { id: 'user-1', email: 'me@example.com' };
const REDIRECT = 'https://app.example/xiangqi/';

function fakeNetwork(online = true) {
  const listeners = new Set<() => void>();
  const net: NetworkStatus & { online: boolean; goOnline(): void } = {
    online,
    isOnline: () => net.online,
    onOnline(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    goOnline() {
      net.online = true;
      for (const l of listeners) l();
    },
  };
  return net;
}

let services: AccountService[] = [];
function setup(backend: FakeBackend, opts: { network?: ReturnType<typeof fakeNetwork>; local?: Record<string, string> } = {}) {
  const local = createMemoryStore(opts.local);
  const network = opts.network ?? fakeNetwork();
  const account = createAccountService({
    store: local,
    loadBackend: async () => backend,
    redirectTo: REDIRECT,
    now: () => NOW,
    debounceMs: 1000,
    network,
  });
  services.push(account);
  return { local, account, network };
}

/** Lets pending promises (fake backend calls) settle. */
const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await vi.advanceTimersByTimeAsync(0);
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const s of services) s.dispose();
  services = [];
  vi.useRealTimers();
});

describe('account service: auth', () => {
  it('starts loading, then signed out without a session', async () => {
    const { account } = setup(createFakeBackend());
    expect(account.getState().auth).toBe('loading');
    await account.ready;
    expect(account.getState()).toMatchObject({ auth: 'signedOut', email: null, sync: 'idle' });
  });

  it('sends a magic link to the app URL and shows "link sent"', async () => {
    const backend = createFakeBackend();
    const { account } = setup(backend);
    await account.ready;
    expect(await account.sendMagicLink('  me@example.com ')).toBe(true);
    expect(backend.calls.links).toEqual([{ email: 'me@example.com', redirectTo: REDIRECT }]);
    expect(account.getState()).toMatchObject({ auth: 'linkSent', email: 'me@example.com' });
    account.cancelLink();
    expect(account.getState()).toMatchObject({ auth: 'signedOut', email: null });
  });

  it('reports an invalid address or a failed request without throwing', async () => {
    const backend = createFakeBackend();
    const { account } = setup(backend);
    await account.ready;
    expect(await account.sendMagicLink('not-an-email')).toBe(false);
    expect(account.getState()).toMatchObject({ auth: 'signedOut', sendFailed: true });
    backend.fail.link = true;
    expect(await account.sendMagicLink('me@example.com')).toBe(false);
    expect(backend.calls.links).toEqual([]);
  });

  it('signs in when the magic link is opened, and logs out keeping local data', async () => {
    const backend = createFakeBackend();
    const { account, local } = setup(backend);
    await account.ready;
    createProgressRepository(account.store).markCompleted('u1l1');
    backend.signIn(USER);
    await settle();
    expect(account.getState()).toMatchObject({ auth: 'signedIn', email: 'me@example.com', sync: 'synced' });
    await account.signOut();
    expect(account.getState()).toMatchObject({ auth: 'signedOut', email: null, sync: 'idle' });
    expect(createProgressRepository(local).completedLessons()).toEqual(['u1l1']);
  });

  it('still signs out locally when the server call fails', async () => {
    const backend = createFakeBackend({ user: USER });
    backend.fail.signOut = true;
    const { account } = setup(backend);
    await account.ready;
    await account.signOut();
    expect(account.getState().auth).toBe('signedOut');
  });

  it('falls back to signed out when the backend cannot load (e.g. offline first visit)', async () => {
    const account = createAccountService({
      store: createMemoryStore(),
      loadBackend: () => Promise.reject(new Error('chunk failed')),
      redirectTo: REDIRECT,
      network: fakeNetwork(),
    });
    services.push(account);
    await account.ready;
    expect(account.getState()).toMatchObject({ auth: 'signedOut', sync: 'idle' });
  });

  it('validates email addresses', () => {
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail('a@b')).toBe(false);
    expect(isEmail('a b@c.de')).toBe(false);
  });
});

describe('account service: sync', () => {
  it('pulls, merges, writes locally and pushes on start with a session', async () => {
    const remoteState = { ...initialState(NOW), totalXp: 25, xpByDay: { '2026-10-16': 25 } };
    const backend = createFakeBackend({
      user: USER,
      rows: {
        [USER.id]: toRemote({ completedLessons: ['u1l1', 'u1l2'], solvedPuzzles: ['p1'], language: 'vi', muted: null, gamification: remoteState }),
      },
    });
    const local: Record<string, string> = {
      'progress.completedLessons.v1': JSON.stringify(['u2l1']),
      'gamification.state.v1': JSON.stringify({ ...initialState(NOW), totalXp: 10, xpByDay: { '2026-10-15': 10 } }),
    };
    const { account, local: store } = setup(backend, { local });
    const changed = vi.fn();
    account.onDataChanged(changed);
    await account.ready;
    await settle();

    expect(account.getState().sync).toBe('synced');
    const merged = readSnapshot(store, NOW);
    expect(merged.completedLessons).toEqual(['u1l1', 'u1l2', 'u2l1']);
    expect(merged.solvedPuzzles).toEqual(['p1']);
    expect(merged.language).toBe('vi');
    expect(merged.gamification).toMatchObject({ totalXp: 35, xpByDay: { '2026-10-15': 10, '2026-10-16': 25 } });
    expect(changed).toHaveBeenCalledTimes(1);
    expect(backend.rows.get(USER.id)).toMatchObject({ version: 1, completedLessons: ['u1l1', 'u1l2', 'u2l1'] });
  });

  it('creates the account row on the first sync', async () => {
    const backend = createFakeBackend({ user: USER });
    const { account } = setup(backend, { local: { 'progress.solvedPuzzles.v1': '["p9"]' } });
    await account.ready;
    await settle();
    expect(backend.calls.pushes).toBe(1);
    expect(backend.rows.get(USER.id)).toMatchObject({ solvedPuzzles: ['p9'] });
  });

  it('does not push when the account already has the same data', async () => {
    const backend = createFakeBackend({
      user: USER,
      rows: { [USER.id]: toRemote({ completedLessons: ['u1l1'], solvedPuzzles: [], language: null, muted: null, gamification: null }) },
      rowsV2: { [USER.id]: emptyRecords() },
    });
    const { account } = setup(backend, { local: { 'progress.completedLessons.v1': '["u1l1"]' } });
    await account.ready;
    await settle();
    expect(backend.calls.pulls).toBe(1);
    expect(backend.calls.pushes).toBe(0);
  });

  it('syncs a local change after the debounce delay', async () => {
    const backend = createFakeBackend({ user: USER });
    const { account } = setup(backend);
    await account.ready;
    await settle();
    const pushes = backend.calls.pushes;

    createPuzzleProgressRepository(account.store).markSolved('p1');
    createPuzzleProgressRepository(account.store).markSolved('p2');
    await vi.advanceTimersByTimeAsync(500);
    expect(backend.calls.pushes).toBe(pushes);
    await vi.advanceTimersByTimeAsync(600);
    await settle();
    expect(backend.calls.pushes).toBe(pushes + 1);
    expect(backend.rows.get(USER.id)).toMatchObject({ solvedPuzzles: ['p1', 'p2'] });
  });

  it('does not sync when only the hearts refill clock moved', async () => {
    const backend = createFakeBackend({ user: USER });
    const { account } = setup(backend, { local: { 'gamification.state.v1': JSON.stringify(initialState(NOW)) } });
    await account.ready;
    await settle();
    const pulls = backend.calls.pulls;
    const repo = createGamificationRepository(account.store);
    repo.save({ ...repo.load(NOW), heartsAnchor: NOW.getTime() + 5 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(backend.calls.pulls).toBe(pulls);
  });

  it('does not schedule a sync for writes that change nothing, or while signed out', async () => {
    const backend = createFakeBackend();
    const { account } = setup(backend);
    await account.ready;
    createSettingsRepository(account.store).setLanguage('vi');
    await vi.advanceTimersByTimeAsync(5000);
    expect(backend.calls.pulls).toBe(0);
  });

  it('is silent on network errors: status "error", local data untouched, retried on the next change', async () => {
    const backend = createFakeBackend({ user: USER });
    backend.fail.pull = true;
    const { account, local } = setup(backend, { local: { 'progress.completedLessons.v1': '["u1l1"]' } });
    await account.ready;
    await settle();
    expect(account.getState().sync).toBe('error');
    expect(createProgressRepository(local).completedLessons()).toEqual(['u1l1']);

    backend.fail.pull = false;
    createProgressRepository(account.store).markCompleted('u1l2');
    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    expect(account.getState().sync).toBe('synced');
    expect(backend.rows.get(USER.id)).toMatchObject({ completedLessons: ['u1l1', 'u1l2'] });
  });

  it('push failures are silent too', async () => {
    const backend = createFakeBackend({ user: USER });
    backend.fail.push = true;
    const { account } = setup(backend);
    await account.ready;
    await expect(account.sync()).resolves.toBeUndefined();
    expect(account.getState().sync).toBe('error');
  });

  it('waits while offline and syncs when the device comes back online', async () => {
    const backend = createFakeBackend({ user: USER });
    const network = fakeNetwork(false);
    const { account } = setup(backend, { network, local: { 'progress.completedLessons.v1': '["u1l1"]' } });
    await account.ready;
    await settle();
    expect(account.getState().sync).toBe('offline');
    expect(backend.calls.pulls).toBe(0);

    network.goOnline();
    await settle();
    expect(account.getState().sync).toBe('synced');
    expect(backend.rows.get(USER.id)).toMatchObject({ completedLessons: ['u1l1'] });
  });

  it('a change made during a sync is synced right after it', async () => {
    const backend = createFakeBackend({ user: USER });
    const { account } = setup(backend);
    await account.ready;
    await settle();
    const first = account.sync();
    createProgressRepository(account.store).markCompleted('u9l9');
    const second = account.sync();
    await first;
    await second;
    await settle();
    expect(backend.rows.get(USER.id)).toMatchObject({ completedLessons: ['u9l9'] });
  });

  it('two devices converge on the union of their progress', async () => {
    const backend = createFakeBackend({ user: USER });
    const a = setup(backend, { local: { 'progress.completedLessons.v1': '["u1l1"]' } });
    await a.account.ready;
    await settle();
    const b = setup(backend, { local: { 'progress.completedLessons.v1': '["u1l2"]', 'progress.solvedPuzzles.v1': '["p5"]' } });
    await b.account.ready;
    await settle();
    await a.account.sync();
    for (const device of [a.local, b.local]) {
      expect(readSnapshot(device, NOW)).toMatchObject({ completedLessons: ['u1l1', 'u1l2'], solvedPuzzles: ['p5'] });
    }
  });
});

describe('account service: learning records in data_v2', () => {
  const AT = '2026-10-16T10:00:00.000Z';
  const LATER = '2026-10-17T10:00:00.000Z';
  const done: CompletionGrant = { at: AT, via: 'lesson', contentVersion: 1 };
  const mastery: MasteryGrant = { at: AT, via: 'check', score: 80, formId: 'A', assessmentVersion: 1 };
  const recordsKey = (records: unknown) => ({ 'learning.records.v1': JSON.stringify(records) });

  /**
   * An account sync exactly as builds before S2.11 do it: pull and merge `data` only, write locally,
   * upsert `{ user_id, data }` (the fake backend models PostgREST: data_v2 untouched on update, null on insert).
   */
  async function oldBuildSync(backend: FakeBackend, store: KeyValueStore) {
    const { data } = await backend.pull(USER.id);
    const mine = readSnapshot(store, NOW);
    const merged = data === null ? mine : mergeSnapshots(mine, parseRemote(data, NOW), NOW);
    writeSnapshot(store, merged);
    await backend.push(USER.id, { data: toRemote(merged), dataV2: null });
  }

  it('pulls data + data_v2, merges the records, writes them locally and pushes { data, data_v2 }', async () => {
    const backend = createFakeBackend({
      user: USER,
      rows: { [USER.id]: toRemote({ completedLessons: ['u1l1'], solvedPuzzles: [], language: null, muted: null, gamification: null }) },
      rowsV2: { [USER.id]: { ...emptyRecords(), completed: { b01l2: done }, exposed: ['b01-c02'] } },
    });
    const { account, local } = setup(backend, { local: recordsKey({ ...emptyRecords(), mastered: { b01: mastery }, exposed: ['b01-c01'] }) });
    const changed = vi.fn();
    account.onDataChanged(changed);
    await account.ready;
    await settle();
    expect(account.getState().sync).toBe('synced');
    const merged = { ...emptyRecords(), completed: { b01l2: done }, mastered: { b01: mastery }, exposed: ['b01-c01', 'b01-c02'] };
    expect(createLearningRepository(local).records()).toEqual(merged);
    expect(backend.rowsV2.get(USER.id)).toEqual(merged);
    expect(backend.calls.pushed.at(-1)).toEqual({ data: backend.rows.get(USER.id), dataV2: merged });
    expect(backend.rows.get(USER.id)).toEqual(toRemote({ completedLessons: ['u1l1'], solvedPuzzles: [], language: null, muted: null, gamification: null }));
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('data keeps the v1 shape: no records inside it', async () => {
    const backend = createFakeBackend({ user: USER });
    const { account } = setup(backend, { local: recordsKey({ ...emptyRecords(), completed: { b01l1: done } }) });
    await account.ready;
    await settle();
    expect(Object.keys(backend.rows.get(USER.id) as object).sort()).toEqual(['completedLessons', 'gamification', 'settings', 'solvedPuzzles', 'version']);
    expect(backend.rowsV2.get(USER.id)).toMatchObject({ completed: { b01l1: done } });
  });

  it('T8: mixed builds on one account — an old-build push leaves data_v2; the new build merges both', async () => {
    const backend = createFakeBackend({ user: USER });
    // New build on device A: one new-course completion and a mastery.
    const a = setup(backend, { local: { ...recordsKey({ ...emptyRecords(), completed: { b01l1: done }, mastered: { b01: mastery } }) } });
    await a.account.ready;
    await settle();
    const v2 = structuredClone(backend.rowsV2.get(USER.id));
    expect(v2).toMatchObject({ completed: { b01l1: done } });

    // Old build on device O completes a legacy lesson and syncs: only `data` is written.
    const old = createMemoryStore({ 'progress.completedLessons.v1': '["u7l1"]' });
    await oldBuildSync(backend, old);
    expect(backend.rowsV2.get(USER.id)).toEqual(v2);
    expect(backend.rows.get(USER.id)).toMatchObject({ completedLessons: ['u7l1'] });
    // The old build never touches the records key locally either.
    expect(old.get('learning.records.v1')).toBeNull();

    // New build syncs again: both parts merged, the records still there.
    await a.account.sync();
    expect(a.account.getState().sync).toBe('synced');
    const v1 = readSnapshot(a.local, NOW).completedLessons;
    expect(v1).toEqual(['u7l1']);
    const records = createLearningRepository(a.local).records();
    expect(records).toMatchObject({ completed: { b01l1: done }, mastered: { b01: mastery } });
    // The legacy completion made by the old build appears in the new view (here through a REL-2-style map entry).
    const view = completedView(records, v1, { u7l1: ['i01l1'] });
    expect(view.get('i01l1')).toEqual({ via: 'migration', from: ['u7l1'], at: null });
    expect(view.get('b01l1')).toEqual(done);
    expect(backend.rowsV2.get(USER.id)).toEqual(v2);
  });

  it('T8: a row first created by an old build has data_v2 null; the new build fills it in', async () => {
    const backend = createFakeBackend({ user: USER });
    await oldBuildSync(backend, createMemoryStore({ 'progress.completedLessons.v1': '["u1l1"]' }));
    expect(backend.rows.has(USER.id)).toBe(true);
    expect(backend.rowsV2.has(USER.id)).toBe(false);
    const { account } = setup(backend, { local: recordsKey({ ...emptyRecords(), completed: { b01l1: done } }) });
    await account.ready;
    await settle();
    expect(backend.rowsV2.get(USER.id)).toMatchObject({ completed: { b01l1: done } });
  });

  it('T10: a records-only change schedules a sync and is pushed', async () => {
    const backend = createFakeBackend({ user: USER });
    const { account } = setup(backend);
    await account.ready;
    await settle();
    const pulls = backend.calls.pulls;
    const pushes = backend.calls.pushes;
    createLearningRepository(account.store).grantMastery('b01', mastery);
    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    expect(backend.calls.pulls).toBe(pulls + 1);
    expect(backend.calls.pushes).toBe(pushes + 1);
    expect(backend.rowsV2.get(USER.id)).toMatchObject({ mastered: { b01: mastery } });
  });

  it('T10: the scheduled-sync skip sees records (a write that leaves them unchanged does not sync)', async () => {
    const backend = createFakeBackend({ user: USER });
    const { account } = setup(backend, { local: recordsKey({ ...emptyRecords(), mastered: { b01: mastery } }) });
    await account.ready;
    await settle();
    const pulls = backend.calls.pulls;
    // Same records, different key order in the stored JSON: nothing meaningful changed.
    account.store.set('learning.records.v1', JSON.stringify({ exposed: [], applied: {}, mastered: { b01: mastery }, completed: {}, schema: 1 }));
    await vi.advanceTimersByTimeAsync(2000);
    expect(backend.calls.pulls).toBe(pulls);
  });

  it('T10: a records difference is pushed even when the v1 part equals the remote', async () => {
    const v1 = toRemote({ completedLessons: ['u1l1'], solvedPuzzles: [], language: null, muted: null, gamification: null });
    const backend = createFakeBackend({ user: USER, rows: { [USER.id]: v1 }, rowsV2: { [USER.id]: emptyRecords() } });
    const { account } = setup(backend, {
      local: { 'progress.completedLessons.v1': '["u1l1"]', ...recordsKey({ ...emptyRecords(), completed: { b01l1: done } }) },
    });
    await account.ready;
    await settle();
    expect(backend.calls.pushes).toBe(1);
    expect(backend.rows.get(USER.id)).toEqual(v1);
    expect(backend.rowsV2.get(USER.id)).toMatchObject({ completed: { b01l1: done } });
    // And nothing is pushed once both sides are equal.
    await account.sync();
    expect(backend.calls.pushes).toBe(1);
  });

  it('T11: without the data_v2 column the v1 data still syncs both ways, local records stay, status error', async () => {
    const backend = createFakeBackend({
      user: USER,
      dataV2Column: false,
      rows: { [USER.id]: toRemote({ completedLessons: ['u1l1'], solvedPuzzles: [], language: null, muted: null, gamification: null }) },
    });
    const localRecords = { ...emptyRecords(), completed: { b01l1: done }, exposed: ['z', 'a'] };
    const { account, local } = setup(backend, { local: { 'progress.solvedPuzzles.v1': '["p1"]', ...recordsKey(localRecords) } });
    const before = local.get('learning.records.v1');
    await account.ready;
    await settle();
    expect(account.getState().sync).toBe('error');
    expect(readSnapshot(local, NOW)).toMatchObject({ completedLessons: ['u1l1'], solvedPuzzles: ['p1'] });
    expect(backend.rows.get(USER.id)).toMatchObject({ completedLessons: ['u1l1'], solvedPuzzles: ['p1'] });
    expect(backend.calls.pushed.every((row) => row.dataV2 === null)).toBe(true);
    expect(backend.rowsV2.size).toBe(0);
    expect(local.get('learning.records.v1')).toBe(before); // byte-identical

    // Once the column exists (with Supabase: from the next app start), the records sync.
    backend.dataV2Column = true;
    createProgressRepository(account.store).markCompleted('u1l2');
    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    expect(account.getState().sync).toBe('synced');
    expect(backend.rowsV2.get(USER.id)).toMatchObject({ completed: { b01l1: done } });
  });

  it('T12 (remote): a corrupt remote data_v2 is ignored and replaced by the local records', async () => {
    const backend = createFakeBackend({
      user: USER,
      rows: { [USER.id]: toRemote({ completedLessons: [], solvedPuzzles: [], language: null, muted: null, gamification: null }) },
      rowsV2: { [USER.id]: 'not records' },
    });
    const localRecords = { ...emptyRecords(), completed: { b01l1: done } };
    const { account, local } = setup(backend, { local: recordsKey(localRecords) });
    await account.ready;
    await settle();
    expect(account.getState().sync).toBe('synced');
    expect(createLearningRepository(local).records()).toEqual(localRecords);
    expect(backend.rowsV2.get(USER.id)).toEqual(localRecords);
  });

  it('T12 (remote): a higher remote schema and its unknown fields are kept, locally and in the account', async () => {
    const backend = createFakeBackend({
      user: USER,
      rows: { [USER.id]: toRemote({ completedLessons: [], solvedPuzzles: [], language: null, muted: null, gamification: null }) },
      rowsV2: { [USER.id]: { ...emptyRecords(), schema: 3, completed: { b01l1: { ...done, at: LATER } }, review: { due: ['b01l1'] } } },
    });
    const { account, local } = setup(backend, { local: recordsKey({ ...emptyRecords(), completed: { b01l1: done } }) });
    await account.ready;
    await settle();
    const expected = { ...emptyRecords(), schema: 3, completed: { b01l1: done }, review: { due: ['b01l1'] } };
    expect(createLearningRepository(local).records()).toEqual(expected);
    expect(backend.rowsV2.get(USER.id)).toEqual(expected);
  });

  it('a corrupt local records value is backed up before the merge is written', async () => {
    const backend = createFakeBackend({
      user: USER,
      rows: { [USER.id]: toRemote({ completedLessons: [], solvedPuzzles: [], language: null, muted: null, gamification: null }) },
      rowsV2: { [USER.id]: { ...emptyRecords(), completed: { b01l1: done } } },
    });
    const { account, local } = setup(backend, { local: { 'learning.records.v1': '{broken' } });
    await account.ready;
    await settle();
    expect(local.get('learning.records.v1.backup')).toBe('{broken');
    expect(createLearningRepository(local).records().completed).toEqual({ b01l1: done });
  });

  it('two new-build devices converge on the merged records', async () => {
    const backend = createFakeBackend({ user: USER });
    const a = setup(backend, { local: recordsKey({ ...emptyRecords(), mastered: { b01: mastery }, exposed: ['c1'] }) });
    await a.account.ready;
    await settle();
    const b = setup(backend, { local: recordsKey({ ...emptyRecords(), mastered: { b01: { ...mastery, score: 95, at: LATER } }, completed: { b01l1: done } }) });
    await b.account.ready;
    await settle();
    await a.account.sync();
    const ra = createLearningRepository(a.local).records();
    expect(ra).toEqual(createLearningRepository(b.local).records());
    expect(ra).toMatchObject({ completed: { b01l1: done }, mastered: { b01: { score: 95 } }, exposed: ['c1'] });
  });
});
