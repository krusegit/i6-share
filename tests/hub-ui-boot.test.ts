// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { createHubApi } from '../hub/api.js';
import type { startServer } from '../hub/http.js';
import type { createAddressBook } from '../hub/net.js';
import type { createFolderSink } from '../hub/sink.js';
import type { store } from '../public/lib/store.js';
import { makeHubFixture } from './hub-ui-fixtures.js';

const mocks = vi.hoisted(() => ({
  api: vi.fn<typeof createHubApi>(), server: vi.fn<typeof startServer>(),
  addrs: vi.fn<typeof createAddressBook>(), sink: vi.fn<typeof createFolderSink>(),
  store: vi.fn<typeof store>(), persist: vi.fn(() => Promise.resolve(true)),
}));
vi.mock('../hub/api.js', () => ({ createHubApi: mocks.api, ONLINE_MS: 40_000 }));
vi.mock('../hub/http.js', () => ({ startServer: mocks.server }));
vi.mock('../hub/net.js', () => ({ createAddressBook: mocks.addrs }));
vi.mock('../hub/sink.js', () => ({ createFolderSink: mocks.sink }));
vi.mock('../public/lib/store.js', () => ({ store: mocks.store, persist: mocks.persist }));
vi.mock('../hub/update-check.js', () => ({ checkForUpdate: () => Promise.resolve(null), compareVersions: () => 0 }));
vi.mock('../hub/qr.js', () => ({ drawQr: () => undefined }));
vi.mock('../public/build-info.js', () => ({ BUILD: { version: null, commit: 'dev', committedAt: null, builtAt: null } }));

import { createHubUi } from '../hub/hub.js';

const setup = () => {
  const fixture = makeHubFixture();
  mocks.api.mockReturnValue(fixture.api);
  mocks.server.mockReturnValue(fixture.server);
  mocks.addrs.mockReturnValue(fixture.addrs);
  mocks.sink.mockReturnValue(fixture.sink);
  mocks.store.mockReturnValue(fixture.kv);
  const app = document.createElement('div');
  document.body.append(app);
  return { ...fixture, app };
};
const settle = async (): Promise<void> => {
  await vi.dynamicImportSettled();
  await vi.advanceTimersByTimeAsync(0);
};
const click = async (text: string): Promise<void> => {
  const button = [...document.querySelectorAll('button')].find((element) => element.textContent === text);
  if (button === undefined) throw new Error(`Missing button ${text}`);
  button.click();
  await settle();
};
const removers: (() => void)[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  document.body.replaceChildren();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  vi.stubGlobal('TCPServerSocket', () => undefined);
  const add = window.addEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
    add(type, listener, options);
    removers.push(() => { window.removeEventListener(type, listener, options); });
  });
});
afterEach(() => {
  for (const remove of removers.splice(0)) remove();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('hub startup lifecycle', () => {
  it('waits for the other window and reloads after acquiring its lock', async () => {
    const { app } = setup();
    const reload = vi.spyOn(location, 'reload').mockImplementation(() => undefined);
    const request = vi.fn((_: string, options: unknown, callback?: (lock: null) => Promise<void> | void) => {
      if (typeof options === 'function') return Promise.resolve(Reflect.apply(options, undefined, []));
      if (callback === undefined) throw new Error('Missing lock callback');
      return Promise.resolve(callback(null));
    });
    vi.stubGlobal('navigator', new Proxy(navigator, { get: (target, key): unknown => key === 'locks' ? { request } : Reflect.get(target, key) }));
    await createHubUi(app).initialize();
    expect(app.textContent).toContain('already running in another window');
    expect(request).toHaveBeenCalledTimes(2);
    expect(reload).toHaveBeenCalledOnce();
    expect(mocks.server).not.toHaveBeenCalled();
  });

  it('holds the acquired lock for the lifetime of the active hub', async () => {
    const { app, api } = setup();
    const holdLock = vi.fn(() => Promise.resolve());
    const request = vi.fn((_: string, _options: unknown, callback: (lock: object) => Promise<void>) => callback({ name: 'i6-share-hub' }));
    vi.stubGlobal('navigator', new Proxy(navigator, { get: (target, key): unknown => key === 'locks' ? { request } : Reflect.get(target, key) }));
    await createHubUi(app, { holdLock }).initialize();
    expect(api.init).toHaveBeenCalledOnce();
    expect(holdLock).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith('i6-share-hub', { ifAvailable: true }, expect.any(Function));
  });

  it('keeps the default lifetime effect pending until the window closes', async () => {
    const { app, api } = setup();
    const request = vi.fn((_: string, _options: unknown, callback: (lock: object) => Promise<void>) => callback({ name: 'i6-share-hub' }));
    vi.stubGlobal('navigator', new Proxy(navigator, { get: (target, key): unknown => key === 'locks' ? { request } : Reflect.get(target, key) }));
    const completed = vi.fn<() => void>();
    const ui = createHubUi(app);
    const initialized = ui.initialize().then(completed);
    await settle();
    expect(api.init).toHaveBeenCalledOnce();
    expect(completed).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('pagehide'));
    await initialized;
    expect(completed).toHaveBeenCalledOnce();
    expect(api.dispose).toHaveBeenCalledOnce();
  });

  it('onboards a new profile before starting the listener and tolerates unreadable history', async () => {
    const { app, values, kv, api } = setup();
    values.set('onboarded', false);
    vi.mocked(kv.get).mockImplementation((key) => key === 'received' ? Promise.reject(new Error('unreadable')) : Promise.resolve(values.get(key)));
    vi.stubGlobal('navigator', new Proxy(navigator, { has: (target, key) => key !== 'locks' && Reflect.has(target, key) }));
    const initialized = createHubUi(app).initialize();
    await settle();
    expect(api.init).not.toHaveBeenCalled();
    await click('Next');
    await click('Next');
    await click('Finish');
    await initialized;
    expect(values.get('onboarded')).toBe(true);
    expect(api.init).toHaveBeenCalledOnce();
    expect(app.textContent).toContain('Files you receive will show up here');
  });

  it('shows fatal initialization errors with the original error message', async () => {
    const { app, sink } = setup();
    vi.mocked(sink.init).mockRejectedValue(new Error('Storage unavailable'));
    vi.stubGlobal('navigator', new Proxy(navigator, { has: (target, key) => key !== 'locks' && Reflect.has(target, key) }));
    await createHubUi(app).initialize();
    expect(app.textContent).toContain('The hub failed to start: Storage unavailable');
  });

  it('falls back to local build metadata and a pairing link when optional modules fail', async () => {
    const f = setup();
    f.state.devices = [];
    vi.stubGlobal('navigator', new Proxy(navigator, { has: (target, key) => key !== 'locks' && Reflect.has(target, key) }));
    const loadBuild = vi.fn(() => Promise.reject(new Error('missing metadata')));
    const loadQr = vi.fn(() => Promise.reject(new Error('missing QR renderer')));
    await createHubUi(f.app, { loadBuild, loadQr }).initialize();
    await settle();
    expect(document.querySelector('.build-badge')?.textContent).toContain('dev');
    expect(f.app.querySelector('.qr')?.classList.contains('hidden')).toBe(true);
    expect(f.app.textContent).toContain('https://example.test/#pair=pair-payload');
    await click('New code');
    expect(loadQr).toHaveBeenCalledOnce();
  });
});


describe('hub startup cancellation', () => {
  const withoutLocks = (): void => {
    vi.stubGlobal('navigator', new Proxy(navigator, { has: (target, key) => key !== 'locks' && Reflect.has(target, key) }));
  };

  it('rolls back initialized services when the protocol API fails to initialize', async () => {
    const f = setup();
    withoutLocks();
    vi.mocked(f.api.init).mockRejectedValue(new Error('invalid identity'));
    await createHubUi(f.app).initialize();
    expect(f.addrs.dispose).toHaveBeenCalledOnce();
    expect(f.api.dispose).toHaveBeenCalledOnce();
    expect(mocks.server).not.toHaveBeenCalled();
    expect(f.app.textContent).toContain('invalid identity');
  });

  it('does not append a badge or start services when disposed during metadata loading', async () => {
    const f = setup();
    const metadata = Promise.withResolvers<{ readonly BUILD: { readonly version: null; readonly commit: string; readonly committedAt: null; readonly builtAt: null } }>();
    const ui = createHubUi(f.app, { loadBuild: () => metadata.promise });
    const initialized = ui.initialize();
    await ui.dispose();
    metadata.resolve({ BUILD: { version: null, commit: 'dev', committedAt: null, builtAt: null } });
    await initialized;
    expect(document.querySelector('.build-badge')).toBeNull();
    expect(f.sink.init).not.toHaveBeenCalled();
  });

  it('stops before onboarding when disposed during folder initialization', async () => {
    const f = setup();
    withoutLocks();
    const pending = Promise.withResolvers<typeof f.sink>();
    vi.mocked(f.sink.init).mockReturnValue(pending.promise);
    const ui = createHubUi(f.app);
    const initialized = ui.initialize();
    await settle();
    await ui.dispose();
    pending.resolve(f.sink);
    await initialized;
    expect(f.kv.get).not.toHaveBeenCalled();
    expect(f.addrs.init).not.toHaveBeenCalled();
  });

  it('stops before rendering onboarding when its storage lookup finishes after disposal', async () => {
    const f = setup();
    withoutLocks();
    const pending = Promise.withResolvers<unknown>();
    vi.mocked(f.kv.get).mockReturnValue(pending.promise);
    const ui = createHubUi(f.app);
    const initialized = ui.initialize();
    await settle();
    await ui.dispose();
    pending.resolve(false);
    await initialized;
    expect(f.app.textContent).toBe('');
    expect(f.addrs.init).not.toHaveBeenCalled();
  });

  it('resolves open onboarding on disposal and never starts the listener', async () => {
    const f = setup();
    withoutLocks();
    f.values.set('onboarded', false);
    const ui = createHubUi(f.app);
    const initialized = ui.initialize();
    await settle();
    expect(f.app.textContent).toContain('Step 1 of 3');
    await ui.dispose();
    await initialized;
    expect(f.addrs.init).not.toHaveBeenCalled();
    expect(mocks.server).not.toHaveBeenCalled();
  });

  it('releases address discovery again if its initialization completes after disposal', async () => {
    const f = setup();
    withoutLocks();
    const pending = Promise.withResolvers<typeof f.addrs>();
    vi.mocked(f.addrs.init).mockReturnValue(pending.promise);
    const ui = createHubUi(f.app);
    const initialized = ui.initialize();
    await settle();
    await ui.dispose();
    expect(f.addrs.dispose).toHaveBeenCalledOnce();
    pending.resolve(f.addrs);
    await initialized;
    expect(f.addrs.dispose).toHaveBeenCalledTimes(2);
    expect(f.api.init).not.toHaveBeenCalled();
  });

  it('releases protocol resources initialized after disposal and avoids starting TCP', async () => {
    const f = setup();
    withoutLocks();
    const pending = Promise.withResolvers<typeof f.api>();
    vi.mocked(f.api.init).mockReturnValue(pending.promise);
    const ui = createHubUi(f.app);
    const initialized = ui.initialize();
    await settle();
    await ui.dispose();
    pending.resolve(f.api);
    await initialized;
    expect(f.api.dispose).toHaveBeenCalledTimes(2);
    expect(mocks.server).not.toHaveBeenCalled();
  });

  it('does not mount UI after a pending history lookup resolves following teardown', async () => {
    const f = setup();
    withoutLocks();
    const pending = Promise.withResolvers<unknown>();
    vi.mocked(f.kv.get).mockImplementation((key) => key === 'received' ? pending.promise : Promise.resolve(f.values.get(key)));
    const ui = createHubUi(f.app);
    const initialized = ui.initialize();
    await settle();
    await ui.dispose();
    pending.resolve([]);
    await initialized;
    expect(f.server.close).toHaveBeenCalledOnce();
    expect(f.app.textContent).toBe('');
  });

  it('does not initialize after a delayed first lock grant to a disposed window', async () => {
    const f = setup();
    const granted = Promise.withResolvers<object>();
    const request = vi.fn((_: string, _options: unknown, callback: (lock: object) => Promise<void>) => granted.promise.then(callback));
    vi.stubGlobal('navigator', new Proxy(navigator, { get: (target, key): unknown => key === 'locks' ? { request } : Reflect.get(target, key) }));
    const ui = createHubUi(f.app);
    const initialized = ui.initialize();
    await settle();
    await ui.dispose();
    granted.resolve({ name: 'i6-share-hub' });
    await initialized;
    expect(f.sink.init).not.toHaveBeenCalled();
  });

  it('suppresses a late secondary lock callback after disposal', async () => {
    const f = setup();
    const granted = Promise.withResolvers<undefined>();
    const reload = vi.spyOn(location, 'reload').mockImplementation(() => undefined);
    const request = vi.fn((_: string, options: { readonly ifAvailable?: boolean; readonly signal?: AbortSignal }, callback: (lock: null) => Promise<void> | void) =>
      options.ifAvailable === true ? Promise.resolve(callback(null)) : granted.promise.then(() => callback(null)));
    vi.stubGlobal('navigator', new Proxy(navigator, { get: (target, key): unknown => key === 'locks' ? { request } : Reflect.get(target, key) }));
    const ui = createHubUi(f.app);
    await ui.initialize();
    await ui.dispose();
    expect(request.mock.lastCall?.[1].signal?.aborted).toBe(true);
    granted.resolve(undefined);
    await settle();
    expect(reload).not.toHaveBeenCalled();
  });

  it('handles cancellation of a queued secondary lock request', async () => {
    const f = setup();
    const request = vi.fn((_: string, options: { readonly ifAvailable?: boolean }, callback: (lock: null) => Promise<void> | void) =>
      options.ifAvailable === true ? Promise.resolve(callback(null)) : Promise.reject(new DOMException('cancelled', 'AbortError')));
    vi.stubGlobal('navigator', new Proxy(navigator, { get: (target, key): unknown => key === 'locks' ? { request } : Reflect.get(target, key) }));
    const ui = createHubUi(f.app);
    await ui.initialize();
    await settle();
    expect(f.app.textContent).toContain('already running in another window');
    await ui.dispose();
  });
});
