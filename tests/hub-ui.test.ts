// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { createHubApi } from '../hub/api.js';
import type { startServer } from '../hub/http.js';
import type { createAddressBook } from '../hub/net.js';
import type { createFolderSink } from '../hub/sink.js';
import type { checkForUpdate } from '../hub/update-check.js';
import type * as UpdateModule from '../hub/update-check.js';
import type * as QrModule from '../hub/qr.js';
import type { store } from '../public/lib/store.js';
import { makeHubFixture, device, outgoing, received, transfer } from './hub-ui-fixtures.js';

const mocks = vi.hoisted(() => ({
  apiFactory: vi.fn<typeof createHubApi>(), serverFactory: vi.fn<typeof startServer>(),
  addressFactory: vi.fn<typeof createAddressBook>(), sinkFactory: vi.fn<typeof createFolderSink>(),
  store: vi.fn<typeof store>(), persist: vi.fn(() => Promise.resolve(true)),
  checkUpdate: vi.fn<typeof checkForUpdate>(),
  drawQr: vi.fn(() => ({ size: 21, version: 1, modules: new Uint8Array(441) })),
  build: { version: '1.0.0', commit: '1234567', committedAt: null, builtAt: null },
}));
vi.mock('../hub/api.js', () => ({ createHubApi: mocks.apiFactory, ONLINE_MS: 40_000 }));
vi.mock('../hub/http.js', () => ({ startServer: mocks.serverFactory }));
vi.mock('../hub/net.js', () => ({ createAddressBook: mocks.addressFactory }));
vi.mock('../hub/sink.js', () => ({ createFolderSink: mocks.sinkFactory }));
vi.mock('../public/lib/store.js', () => ({ store: mocks.store, persist: mocks.persist }));
vi.mock('../hub/update-check.js', async (importOriginal) => ({ ...await importOriginal<typeof UpdateModule>(), checkForUpdate: mocks.checkUpdate }));
vi.mock('../hub/qr.js', () => ({ drawQr: mocks.drawQr }));
vi.mock('../public/build-info.js', () => ({ BUILD: mocks.build }));

import { createHubUi, initializeHubUi } from '../hub/hub.js';

const settle = async (): Promise<void> => {
  await vi.dynamicImportSettled();
  await vi.advanceTimersByTimeAsync(0);
};
const byText = (text: string, root: ParentNode = document): HTMLButtonElement => {
  const found = [...root.querySelectorAll('button')].find((button) => button.textContent === text || button.getAttribute('aria-label') === text);
  if (found === undefined) throw new Error(`Button not found: ${text}\n${document.body.textContent}`);
  return found;
};
const click = async (text: string, root: ParentNode = document): Promise<void> => { byText(text, root).click(); await settle(); };
const input = (label: string): HTMLInputElement => {
  const found = [...document.querySelectorAll('label')].find((element) => element.textContent === label)?.querySelector('input');
  if (!(found instanceof HTMLInputElement)) throw new Error(`Input not found: ${label}`);
  return found;
};
const drag = (target: EventTarget, type: string, files: readonly File[] = [], types: readonly string[] = ['Files']): DragEvent => {
  const dataTransfer = new DataTransfer();
  for (const file of files) {
    dataTransfer.items.add(file);
    const item = dataTransfer.items[dataTransfer.items.length - 1];
    if (item !== undefined) Object.defineProperty(item, 'webkitGetAsEntry', { value: () => null });
  }
  Object.defineProperty(dataTransfer, 'types', { value: types });
  const event = new DragEvent(type, { dataTransfer, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
  target.dispatchEvent(event);
  return event;
};
const fixture = (options?: Parameters<typeof createHubUi>[1]) => {
  const dependencies = makeHubFixture();
  mocks.apiFactory.mockReturnValue(dependencies.api);
  mocks.serverFactory.mockReturnValue(dependencies.server);
  mocks.addressFactory.mockReturnValue(dependencies.addrs);
  mocks.sinkFactory.mockReturnValue(dependencies.sink);
  mocks.store.mockReturnValue(dependencies.kv);
  const app = document.createElement('div');
  app.id = 'app';
  document.body.append(app);
  const ui = createHubUi(app, options);
  const history: Parameters<typeof ui.mountUi>[0]['received'] = { list: [] };
  const mount = (): ReturnType<typeof ui.mountUi> => ui.mountUi({ ...dependencies, received: history });
  return { ...dependencies, app, ui, history, mount };
};
const removers: (() => void)[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-27T12:00:00Z'));
  document.body.replaceChildren();
  mocks.checkUpdate.mockReset().mockResolvedValue(null);
  mocks.drawQr.mockReset().mockReturnValue({ size: 21, version: 1, modules: new Uint8Array(441) });
  mocks.build.version = '1.0.0';
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
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

describe('hub entry and onboarding', () => {
  it('renders installation guidance, duplicate-window explanation, and startup failures', async () => {
    const { ui, app } = fixture();
    ui.renderNotIwa();
    expect(app.textContent).toContain('Install the hub as an app');
    expect(app.querySelector('a')?.href).toBe('https://krusegit.github.io/i6-share/setup/');
    ui.renderAlreadyOpen();
    expect(app.textContent).toContain('already running in another window');
    const reload = vi.spyOn(location, 'reload').mockImplementation(() => undefined);
    ui.fatal(new Error('database offline'));
    expect(app.textContent).toContain('database offline');
    await click('Reload');
    expect(reload).toHaveBeenCalledOnce();
    ui.fatal('plain error');
    expect(app.textContent).toContain('plain error');
  });

  it('checks the required root and initializes non-IWA pages with build metadata', async () => {
    await expect(initializeHubUi()).rejects.toThrow('Missing hub application root');
    const { app } = fixture();
    await initializeHubUi();
    expect(app.textContent).toContain('Install the hub as an app');
    expect(document.querySelector('.build-badge')?.textContent).toContain('1.0.0');
  });

  it('walks through naming, folder choice, navigation, and notification permission', async () => {
    const { ui, kv, sink, state, app, values } = fixture();
    const permission = vi.fn(() => Promise.reject(new Error('denied')));
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: permission });
    const done = ui.onboarding({ kv, sink });
    input('Computer name').value = '  My PC  ';
    input('Computer name').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(app.textContent).toContain('Step 1 of 3');
    input('Computer name').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await click('Choose folder');
    expect(app.textContent).toContain('“Pictures” folder');
    await click('Change folder');
    await click('Use Downloads');
    expect(state.dir).toBeNull();
    vi.mocked(sink.pick).mockRejectedValueOnce(new Error('permission denied'));
    await click('Choose folder');
    expect(document.body.textContent).toContain('Could not use that folder: permission denied');
    await click('Back');
    await click('Next');
    await click('Next');
    expect(app.textContent).toContain('Let your phone reach this computer');
    await click('Back');
    await click('Next');
    await click('Finish');
    await done;
    expect(values.get('hubName')).toBe('My PC');
    expect(values.get('onboarded')).toBe(true);
    expect(permission).toHaveBeenCalledOnce();
  });

  it('supports empty names and platforms without folder or notification access', async () => {
    const { ui, kv, sink, state, values } = fixture();
    state.supported = false;
    const done = ui.onboarding({ kv, sink });
    input('Computer name').value = ' ';
    await click('Next');
    expect(document.body.textContent).toContain('Folder access isn’t available');
    await click('Next');
    await click('Finish');
    await done;
    expect(values.get('hubName')).toBe('Linux PC');
  });

  it('initializes injected services and connects HTTP requests and error events', async () => {
    const f = fixture();
    vi.stubGlobal('TCPServerSocket', () => undefined);
    vi.stubGlobal('navigator', new Proxy(navigator, { has: (target, key) => key !== 'locks' && Reflect.has(target, key) }));
    f.values.set('received', [{ name: 'old.txt', size: 3, type: 'text/plain', from: '', at: Date.now(), where: 'download', tid: 'old' }]);
    await f.ui.initialize();
    await settle();
    expect(f.sink.init).toHaveBeenCalledOnce();
    expect(f.addrs.init).toHaveBeenCalledOnce();
    expect(f.api.init).toHaveBeenCalledOnce();
    expect(f.app.textContent).toContain('old.txt');
    const options = mocks.serverFactory.mock.lastCall?.[0];
    expect(options).toBeDefined();
    if (options === undefined) throw new Error('Missing server options');
    const request = { method: 'GET', path: '/i6/hello', query: new URLSearchParams(), headers: {}, body: new Uint8Array(), remoteAddress: '192.168.1.3', remotePort: 4000, localAddress: '192.168.1.2' };
    await options.handler(request);
    expect(f.addrs.observe).toHaveBeenCalledWith('192.168.1.2');
    expect(f.api.handle).toHaveBeenCalledWith(request);
    expect(mocks.apiFactory.mock.lastCall?.[0].getAddrs?.()).toEqual(['192.168.1.2']);
    f.serverEvents.dispatchEvent(new CustomEvent('connection-error', { detail: 'gone' }));
    f.emit('error', { error: new Error('storage problem') });
    expect(console.warn).toHaveBeenCalled();
  });

  it('renders failed initialization and ignores corrupt received history', async () => {
    const f = fixture();
    vi.stubGlobal('TCPServerSocket', () => undefined);
    vi.stubGlobal('navigator', new Proxy(navigator, { has: (target, key) => key !== 'locks' && Reflect.has(target, key) }));
    f.values.set('received', { corrupted: true });
    await f.ui.initialize();
    await settle();
    expect(f.app.textContent).toContain('Files you receive will show up here.');
    vi.mocked(f.sink.init).mockRejectedValueOnce(new Error('storage unavailable'));
    await f.ui.initialize();
    expect(f.app.textContent).toContain('failed to start');
  });
});

describe('hub status, pairing, and updates', () => {
  it('renders listening, startup, retry, address, and folder warnings', async () => {
    const f = fixture();
    f.state.addresses = ['192.168.1.2', 'fd00::1'];
    f.mount(); await settle();
    expect(f.app.textContent).toContain('Listening on 192.168.1.2:47616');
    expect(f.app.querySelector('header')?.title).toContain('[fd00::1]:47616');
    f.state.addresses = [];
    f.addressEvents.dispatchEvent(new Event('change'));
    expect(f.app.textContent).toContain('Listening on port 47616');
    expect(f.app.textContent).toContain('Couldn’t detect');
    f.state.server = { ...f.state.server, status: 'starting' };
    f.serverEvents.dispatchEvent(new Event('state'));
    expect(f.app.textContent).toContain('Starting…');
    f.state.server = { ...f.state.server, status: 'error', error: 'Address in use', retryAt: Date.now() + 3000 };
    f.serverEvents.dispatchEvent(new Event('state'));
    expect(f.app.textContent).toContain('retrying in 3 s');
    await click('Retry now');
    expect(f.server.restart).toHaveBeenCalledOnce();
    f.state.server = { ...f.state.server, error: null, retryAt: null };
    f.serverEvents.dispatchEvent(new Event('state'));
    expect(f.app.textContent).toContain('Unknown error');
    expect(f.app.textContent).toContain('retrying in 0 s');
    f.state.dir = f.directory;
    f.state.folderState = 'prompt';
    f.sinkEvents.dispatchEvent(new Event('change'));
    await click('Allow');
    expect(document.body.textContent).toContain('Access not granted');
    vi.mocked(f.sink.requestPermission).mockImplementationOnce(() => { f.state.folderState = 'granted'; return Promise.resolve('granted'); });
    await click('Allow');
    f.emit('sink-error', { name: 'bad.txt', error: new Error('disk full') });
    expect(f.app.textContent).toContain('disk full');
    await click('Dismiss');
    f.emit('sink-error', { name: 'bad.txt', error: 'plain error' });
    expect(f.app.textContent).toContain('plain error');
    window.dispatchEvent(new Event('focus'));
    expect(f.sink.check).toHaveBeenCalledOnce();
  });

  it('shows, refreshes, expires, and hides one-use pairing codes', async () => {
    const f = fixture();
    f.mount(); await settle();
    expect(f.app.textContent).toContain('Pair another phone');
    await click('Show code');
    expect(mocks.drawQr).toHaveBeenCalled();
    expect(f.app.textContent).toContain('Code valid for 10:00');
    await click('New code');
    f.addressEvents.dispatchEvent(new Event('change')); await settle();
    expect(f.api.newPairCode).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(600_000); await settle();
    expect(f.api.newPairCode).toHaveBeenCalledTimes(4);
    await click('Hide');
    expect(f.app.textContent).toContain('Pair another phone');
    await click('Show code');
    f.emit('pair-code-used', { deviceId: device().deviceId, name: 'New Phone' });
    expect(document.body.textContent).toContain('Paired with New Phone');
    expect(f.app.textContent).toContain('Pair another phone');
    f.state.devices = [];
    f.emit('device-unpaired', { deviceId: device().deviceId, name: 'New Phone', reason: 'forgotten' });
    await settle();
    expect(f.app.textContent).toContain('Pair a phone');
    expect(f.app.textContent).toContain('No phones paired yet');
  });

  it('keeps pairing functional when code generation or canvas rendering fails', async () => {
    const f = fixture();
    f.state.devices = [];
    vi.mocked(f.api.newPairCode).mockImplementationOnce(() => { throw new Error('not initialized'); });
    f.mount(); await settle();
    expect(console.warn).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    mocks.drawQr.mockImplementationOnce(() => { throw new Error('canvas unavailable'); });
    await click('New code');
    expect(f.app.querySelector('canvas')?.classList.contains('hidden')).toBe(true);
    expect(f.app.textContent).toContain('QR code unavailable');
    await click('New code');
    expect(f.app.querySelector('canvas')?.classList.contains('hidden')).toBe(false);
  });

  it('checks, explains, dismisses, and remembers published updates', async () => {
    const f = fixture();
    mocks.checkUpdate.mockResolvedValue({ available: true, latest: '2.0.0', info: { version: '2.0.0' } });
    f.mount(); await settle();
    expect(f.app.textContent).toContain('Hub 2.0.0 is available');
    await click('How to update');
    expect(document.querySelector('dialog')?.textContent).toContain('chrome://iwa-dev');
    await click('Close');
    await click('Dismiss');
    expect(f.values.get('dismissedUpdate')).toBe('2.0.0');
    expect(f.app.textContent).not.toContain('Hub 2.0.0 is available');
    mocks.checkUpdate.mockResolvedValue({ available: true, latest: '3.0.0', info: { version: '3.0.0' } });
    window.dispatchEvent(new Event('online')); await settle();
    expect(f.app.textContent).toContain('Hub 3.0.0 is available');
    mocks.checkUpdate.mockResolvedValue({ available: false, latest: '1.0.0', info: { version: '1.0.0' } });
    window.dispatchEvent(new Event('online')); await settle();
    expect(f.app.textContent).not.toContain('is available');
  });

  it('uses the older Chromium update instructions and tolerates persistence failures', async () => {
    const f = fixture();
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Chromium/153.0');
    vi.mocked(f.kv.get).mockRejectedValue(new Error('storage unavailable'));
    vi.mocked(f.kv.put).mockRejectedValue(new Error('storage unavailable'));
    mocks.checkUpdate.mockResolvedValue({ available: true, latest: '2.0.0', info: { version: '2.0.0' } });
    f.mount(); await settle();
    await click('How to update');
    expect(document.querySelector('dialog ol')?.textContent).toContain('Perform update now');
    await click('Close');
    await click('Dismiss');
  });

  it('skips unknown build versions and coalesces overlapping update requests', async () => {
    const f = fixture();
    mocks.build.version = '';
    f.mount(); await settle();
    expect(mocks.checkUpdate).not.toHaveBeenCalled();
    mocks.build.version = '1.0.0';
    const deferred = Promise.withResolvers<Awaited<ReturnType<typeof checkForUpdate>>>();
    mocks.checkUpdate.mockReturnValueOnce(deferred.promise);
    window.dispatchEvent(new Event('online')); await vi.dynamicImportSettled();
    window.dispatchEvent(new Event('online')); await vi.dynamicImportSettled();
    expect(mocks.checkUpdate).toHaveBeenCalledOnce();
    deferred.resolve(null); await settle();
    window.dispatchEvent(new Event('online')); await settle();
    expect(mocks.checkUpdate).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);
    await settle();
    expect(mocks.checkUpdate).toHaveBeenCalledTimes(3);
  });
});

describe('phones and outgoing transfers', () => {
  it('renders online status, paused incoming work, outgoing work, and cancellation', async () => {
    const f = fixture();
    f.state.transfers = [transfer(), transfer({ count: 3, done: 1, speed: 0, lastActivity: Date.now() - 16_000 }), transfer({ total: 0, speed: 0 }), transfer({ complete: true })];
    f.state.outgoing = [outgoing(), outgoing({ started: true }), outgoing({ started: true, total: 0, speed: 0, count: 2 })];
    f.mount(); await settle();
    expect(f.app.textContent).toContain('Online · Android');
    expect(f.app.textContent).toContain('Receiving “photo.jpg”');
    expect(f.app.textContent).toContain('Receiving 1/3 files');
    expect(f.app.textContent).toContain('paused');
    expect(f.app.textContent).toContain('25%');
    expect(f.app.textContent).toContain('Sending 2 files');
    expect(f.app.querySelectorAll('.hub-activity')).toHaveLength(6);
    await click('Cancel');
    expect(f.api.cancelOutbox).toHaveBeenCalledWith('fedcba9876543210fedcba98');
    f.state.devices = [device({ lastSeen: Date.now() - 60_000, online: false })];
    f.emit('device-updated', { device: device() });
    expect(f.app.textContent).toContain('Last seen 1 min ago');
    expect(f.app.textContent).toContain('waiting for the phone');
    f.state.devices = [device({ lastSeen: 0, os: '' })];
    f.emit('device-updated', { device: device() });
    expect(f.app.textContent).toContain('Not seen yet');
    f.state.devices = [];
    f.emit('device-updated', { device: device() });
    expect(f.app.textContent).toContain('No phones paired yet');
  });

  it('coalesces progress events and handles rows removed before their update', async () => {
    const f = fixture(); f.mount(); await settle();
    const before = vi.mocked(f.api.transfersFor).mock.calls.length;
    f.emit('device-seen', { device: device() });
    f.emit('transfer-start', { transfer: transfer() });
    f.emit('transfer-progress', { transfer: transfer() });
    f.emit('transfer-cancelled', { transfer: transfer(), reason: 'cancel' });
    f.emit('outbox-added', { item: outgoing() });
    f.emit('outbox-progress', { item: outgoing() });
    f.emit('outbox-removed', { item: outgoing() });
    await vi.advanceTimersByTimeAsync(250);
    expect(vi.mocked(f.api.transfersFor).mock.calls.length).toBe(before + 1);
    f.emit('transfer-progress', { transfer: transfer({ deviceId: 'missing' }) });
    await vi.advanceTimersByTimeAsync(250);
    f.emit('transfer-progress', { transfer: transfer() });
    f.state.devices = [];
    await vi.advanceTimersByTimeAsync(250);
    expect(f.app.querySelector('.hub-phone')).not.toBeNull();
    f.emit('device-unpaired', { deviceId: device().deviceId, name: 'Phone', reason: 'unpaired' });
    expect(f.app.querySelector('.hub-phone')).toBeNull();
    f.state.devices = [device()];
    f.emit('device-paired', { device: device() });
    expect(f.app.querySelector('.hub-phone')).not.toBeNull();
  });

  it('opens a picker, cancels empty selections, and sends single or multiple files', async () => {
    const f = fixture(); f.mount(); await settle();
    await click('Send files to Test Phone');
    await click('Send files to Test Phone');
    const empty = document.querySelector('input[type=file]');
    if (!(empty instanceof HTMLInputElement)) throw new Error('Missing file picker');
    Object.defineProperty(empty, 'files', { configurable: true, value: null });
    empty.dispatchEvent(new Event('change'));
    await settle();
    expect(f.api.sendToDevice).not.toHaveBeenCalled();
    const select = async (files: readonly File[]): Promise<void> => {
      await click('Send files to Test Phone');
      const field = document.querySelector('input[type=file]');
      if (!(field instanceof HTMLInputElement)) throw new Error('Missing file picker');
      Object.defineProperty(field, 'files', { value: files });
      field.dispatchEvent(new Event('change')); await settle();
    };
    const file = new File(['hello'], 'hello.txt');
    await select([file]);
    expect(f.api.sendToDevice).toHaveBeenCalledWith(device().deviceId, [file]);
    expect(document.body.textContent).toContain('“hello.txt” will be sent to Test Phone');
    f.state.devices = [device({ online: false })];
    await select([file, file]);
    expect(document.body.textContent).toContain('2 files will be sent to Test Phone when it’s online');
    vi.mocked(f.api.sendToDevice).mockRejectedValueOnce(new Error('disk full'));
    await select([file]);
    expect(document.body.textContent).toContain('Couldn’t queue files: disk full');
    vi.mocked(f.api.sendToDevice).mockRejectedValueOnce('unavailable');
    await select([file]);
    expect(document.body.textContent).toContain('Couldn’t queue files: unavailable');
    f.state.devices = [];
    await select([file]);
    expect(f.api.sendToDevice).toHaveBeenCalledTimes(4);
  });

  it('confirms revocation and ignores phone rows which have since disappeared', async () => {
    const f = fixture(); f.mount(); await settle();
    await click('Forget Test Phone');
    expect(document.querySelector('dialog')?.textContent).toContain('Files waiting to be sent');
    await click('Cancel');
    expect(f.api.forgetDevice).not.toHaveBeenCalled();
    await click('Forget Test Phone');
    await click('Forget');
    expect(f.api.forgetDevice).toHaveBeenCalledWith(device().deviceId);
    expect(document.body.textContent).toContain('Test Phone forgotten');
    f.state.devices = [];
    await click('Forget Test Phone');
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('routes page drops, rejects directories, and manages drag highlighting', async () => {
    const f = fixture(); f.mount(); await settle();
    const row = f.app.querySelector('.hub-phone');
    if (row === null) throw new Error('Missing phone row');
    row.dispatchEvent(new DragEvent('dragenter'));
    row.dispatchEvent(new DragEvent('dragover'));
    window.dispatchEvent(new DragEvent('dragover'));
    drag(row, 'dragenter', [], []);
    expect(row.classList.contains('hub-drop')).toBe(false);
    drag(row, 'dragenter'); drag(row, 'dragenter');
    expect(row.classList.contains('hub-drop')).toBe(true);
    drag(row, 'dragleave');
    expect(row.classList.contains('hub-drop')).toBe(true);
    drag(row, 'dragleave'); drag(row, 'dragleave');
    expect(row.classList.contains('hub-drop')).toBe(false);
    expect(drag(row, 'dragover', [], []).defaultPrevented).toBe(false);
    expect(drag(row, 'dragover').dataTransfer?.dropEffect).toBe('copy');
    const file = new File(['a'], 'first.txt');
    drag(row, 'drop', [file]); await settle();
    expect(f.api.sendToDevice).toHaveBeenCalledWith(device().deviceId, [file]);
    row.dispatchEvent(new DragEvent('drop', { cancelable: true })); await settle();
    expect(f.api.sendToDevice).toHaveBeenCalledTimes(1);
    const dt = new DataTransfer();
    dt.items.add(new File([], 'folder'));
    dt.items.add(file);
    const directoryItem = dt.items[0];
    const plainItem = dt.items[1];
    if (directoryItem === undefined || plainItem === undefined) throw new Error('Missing drop items');
    Object.defineProperty(directoryItem, 'webkitGetAsEntry', { value: () => ({ isDirectory: true }) });
    Object.defineProperty(plainItem, 'webkitGetAsEntry', { value: () => null });
    const folderDrop = new DragEvent('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(folderDrop, 'dataTransfer', { value: dt });
    row.dispatchEvent(folderDrop);
    expect(document.body.textContent).toContain('Folders can’t be sent');
    await settle();
    expect(f.api.sendToDevice).toHaveBeenLastCalledWith(device().deviceId, [file]);
    expect(drag(window, 'dragover', [], []).defaultPrevented).toBe(false);
    expect(drag(window, 'dragover').dataTransfer?.dropEffect).toBe('copy');
    drag(window, 'drop', [file]); await settle();
    expect(f.api.sendToDevice).toHaveBeenCalledTimes(3);
    drag(window, 'drop', [], []); await settle();
    f.state.devices = [device(), device({ deviceId: 'other', name: 'Other' })];
    expect(drag(window, 'dragover').dataTransfer?.dropEffect).toBe('none');
    drag(window, 'drop', [file]); await settle();
    expect(document.body.textContent).toContain('Drop the files on the phone');
    f.state.devices = [];
    drag(window, 'drop', [file]); await settle();
    expect(f.api.sendToDevice).toHaveBeenCalledTimes(3);
  });

  it('reports completed outgoing deliveries and unknown recipients', async () => {
    const f = fixture(); f.mount(); await settle();
    f.emit('outbox-delivered', { item: outgoing() });
    expect(document.body.textContent).toContain('“outgoing.txt” delivered to Test Phone');
    f.emit('outbox-delivered', { item: outgoing({ count: 2, deviceId: 'unknown' }) });
    expect(document.body.textContent).toContain('2 files delivered to phone');
  });
});

describe('received history and folder interactions', () => {
  it('records, trims, persists, and clears received files', async () => {
    const f = fixture(); f.mount(); await settle();
    f.emit('file-saved', received());
    expect(f.app.textContent).toContain('photo.jpg');
    expect(f.app.textContent).toContain('from Test Phone');
    f.emit('file-saved', received({ name: 'empty.bin', type: '', deviceName: '', where: 'download' }));
    expect(f.app.textContent).toContain('in Downloads');
    for (let index = 0; index < 100; index++) f.emit('file-saved', received({ name: `file-${String(index)}.txt`, type: 'text/plain', where: null }));
    expect(f.app.querySelectorAll('.card:last-child .list-item')).toHaveLength(100);
    await vi.advanceTimersByTimeAsync(300);
    expect(f.values.get('received')).toHaveLength(100);
    vi.mocked(f.kv.put).mockRejectedValueOnce(new Error('storage unavailable'));
    f.emit('file-saved', received());
    await vi.advanceTimersByTimeAsync(300);
    vi.mocked(f.kv.put).mockRejectedValueOnce(new Error('storage unavailable'));
    await click('Clear list');
    expect(f.app.querySelectorAll('.card:last-child .list-item')).toHaveLength(0);
    expect(f.app.textContent).toContain('Files you receive will show up here.');
  });

  it('opens saved files, requests permissions, releases URLs, and reports missing files', async () => {
    const f = fixture();
    f.state.dir = f.directory; f.state.folderState = 'granted';
    f.mount(); await settle();
    f.emit('file-saved', received());
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await click('Open photo.jpg');
    expect(f.sink.openFile).toHaveBeenCalledWith('photo.jpg');
    expect(create).toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith('blob:test', '_blank');
    await vi.advanceTimersByTimeAsync(300_000);
    expect(revoke).toHaveBeenCalledWith('blob:test');
    f.state.folderState = 'prompt';
    await click('Open photo.jpg');
    expect(f.sink.requestPermission).toHaveBeenCalled();
    vi.mocked(f.sink.openFile).mockRejectedValueOnce(new DOMException('gone', 'NotFoundError'));
    await click('Open photo.jpg');
    expect(document.body.textContent).toContain('“photo.jpg” was moved or deleted');
    vi.mocked(f.sink.openFile).mockRejectedValueOnce('unavailable');
    await click('Open photo.jpg');
    expect(document.body.textContent).toContain('Couldn’t open “photo.jpg”');
  });

  it('offers an open action on successful folder transfers and reports multi-file receipts', async () => {
    const f = fixture(); f.state.dir = f.directory; f.state.folderState = 'granted';
    f.mount(); await settle();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(window, 'open').mockReturnValue(null);
    f.emit('transfer-complete', { transfer: transfer({ complete: true }) });
    expect(document.body.textContent).toContain('Received “photo.jpg” from Test Phone');
    await click('Open');
    expect(f.sink.openFile).toHaveBeenCalledWith('photo.jpg');
    f.emit('transfer-complete', { transfer: transfer({ count: 2, complete: true }) });
    expect(document.body.textContent).toContain('Received 2 files from Test Phone');
    f.state.folderState = 'none';
    f.emit('transfer-complete', { transfer: transfer({ complete: true, files: [] }) });
    expect(document.querySelector('.snackbar__action')).toBeNull();
  });

  it('notifies hidden windows and focuses the hub when the notification is clicked', async () => {
    const f = fixture(); f.mount(); await settle();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const notification: { onclick: (() => void) | null; close: ReturnType<typeof vi.fn> } = { onclick: null, close: vi.fn() };
    const create = vi.fn(function () { return notification; });
    const notificationConstructor = Object.assign(create, { permission: 'granted' });
    vi.stubGlobal('Notification', notificationConstructor);
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => undefined);
    f.emit('transfer-complete', { transfer: transfer({ complete: true }) });
    expect(create).toHaveBeenCalledWith('Files received', expect.objectContaining({ tag: transfer().tid }));
    notification.onclick?.();
    expect(focus).toHaveBeenCalledOnce();
    expect(notification.close).toHaveBeenCalledOnce();
    create.mockImplementationOnce(function () { throw new Error('notifications unsupported'); });
    f.emit('transfer-complete', { transfer: transfer({ complete: true }) });
    notificationConstructor.permission = 'denied';
    f.emit('transfer-complete', { transfer: transfer({ complete: true }) });
    Reflect.deleteProperty(globalThis, 'Notification');
    f.emit('transfer-complete', { transfer: transfer({ complete: true }) });
  });
});

describe('settings', () => {
  it('edits name and manual addresses, detects network addresses, and refreshes pairing', async () => {
    const f = fixture(); f.state.devices = [];
    f.mount(); await settle();
    await click('Settings');
    expect(document.querySelector('dialog')?.textContent).toContain('192.168.1.2');
    input('Computer name').value = ' New Name ';
    input('Extra addresses (comma separated)').value = '192.168.1.8, invalid';
    vi.mocked(f.addrs.setManual).mockResolvedValueOnce(['invalid']);
    await click('Detect');
    expect(f.addrs.refresh).toHaveBeenCalledOnce();
    expect(document.body.textContent).toContain('Detected: 192.168.1.2');
    await click('Save');
    expect(f.api.setName).toHaveBeenCalledWith('New Name');
    expect(f.addrs.setManual).toHaveBeenCalledWith('192.168.1.8, invalid');
    expect(document.body.textContent).toContain('Ignored invalid address: invalid');
    expect(f.api.newPairCode).toHaveBeenCalledTimes(2);
    await click('Settings');
    await click('Save');
    expect(f.api.setName).toHaveBeenCalledTimes(1);
    await click('Settings');
    input('Computer name').value = '  ';
    await click('Save');
    expect(f.api.setName).toHaveBeenCalledTimes(1);
  });

  it('cancels edits and manages folder choice, permission, and downloads', async () => {
    const f = fixture();
    f.state.addresses = []; f.state.detected = [];
    f.mount(); await settle();
    await click('Settings', f.app.querySelector('.hub-banners') ?? f.app);
    expect(document.querySelector('dialog')?.textContent).toContain('none detected');
    await click('Detect');
    expect(document.body.textContent).toContain('Detected: none');
    await click('Choose folder');
    expect(document.querySelector('dialog')?.textContent).toContain('“Pictures”');
    vi.mocked(f.sink.pick).mockRejectedValueOnce(new Error('permission denied'));
    await click('Change');
    expect(document.body.textContent).toContain('Could not use that folder: permission denied');
    f.state.folderState = 'prompt';
    await click('Change');
    f.state.folderState = 'prompt';
    vi.mocked(f.sink.pick).mockResolvedValueOnce(false);
    await click('Change');
    expect(document.querySelector('dialog')?.textContent).toContain('(access needed)');
    await click('Allow access');
    expect(f.sink.requestPermission).toHaveBeenCalledOnce();
    await click('Use Downloads');
    expect(document.querySelector('dialog')?.textContent).toContain('Downloads (browser downloads)');
    await click('Cancel');
    expect(f.api.setName).not.toHaveBeenCalled();
    f.state.supported = false;
    await click('Settings');
    expect(document.querySelector('dialog')?.textContent).not.toContain('Choose folder');
    await click('Save');
    expect(f.api.newPairCode).not.toHaveBeenCalled();
  });
});

describe('mounted hub disposal', () => {
  it('removes service and browser subscriptions, timers, and the current file picker', async () => {
    const f = fixture();
    const disposeMounted = f.mount(); await settle();
    await click('Send files to Test Phone');
    f.emit('device-seen', { device: device() });
    expect(document.querySelector('input[type=file]')).not.toBeNull();
    await disposeMounted();
    expect(document.querySelector('input[type=file]')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    const before = f.app.innerHTML;
    const reads = vi.mocked(f.api.transfersFor).mock.calls.length;
    f.state.server = { ...f.state.server, status: 'error', error: 'offline' };
    f.state.addresses = [];
    f.state.devices = [];
    f.serverEvents.dispatchEvent(new Event('state'));
    f.addressEvents.dispatchEvent(new Event('change'));
    f.sinkEvents.dispatchEvent(new Event('change'));
    f.emit('device-updated', { device: device() });
    f.emit('sink-error', { name: 'file', error: 'failure' });
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('online'));
    const dropped = drag(window, 'drop', [new File([], 'ignored.txt')]);
    expect(dropped.defaultPrevented).toBe(false);
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);
    expect(f.sink.check).not.toHaveBeenCalled();
    expect(f.api.sendToDevice).not.toHaveBeenCalled();
    expect(mocks.checkUpdate).toHaveBeenCalledOnce();
    expect(vi.mocked(f.api.transfersFor).mock.calls.length).toBe(reads);
    expect(f.app.innerHTML).toBe(before);
    await f.ui.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('flushes pending history on disposal and tolerates persistence failure', async () => {
    const f = fixture(); f.mount(); await settle();
    f.emit('file-saved', received());
    expect(f.values.has('received')).toBe(false);
    await f.ui.dispose();
    expect(f.values.get('received')).toEqual([expect.objectContaining({ name: 'photo.jpg' })]);
    expect(vi.getTimerCount()).toBe(0);
    const writes = vi.mocked(f.kv.put).mock.calls.length;
    await f.ui.dispose();
    expect(vi.mocked(f.kv.put).mock.calls.length).toBe(writes);
    const rejected = fixture(); rejected.mount(); await settle();
    rejected.emit('file-saved', received());
    vi.mocked(rejected.kv.put).mockRejectedValueOnce(new Error('storage unavailable'));
    await rejected.ui.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('revokes open file URLs immediately and cancels their delayed release', async () => {
    const f = fixture(); f.state.dir = f.directory; f.state.folderState = 'granted';
    f.mount(); await settle();
    f.emit('file-saved', received());
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:disposing');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(window, 'open').mockReturnValue(null);
    await click('Open photo.jpg');
    await f.ui.dispose();
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:disposing');
    await vi.advanceTimersByTimeAsync(300_000);
    expect(revoke).toHaveBeenCalledOnce();
  });

  it('ignores asynchronous QR, update, and file results arriving after disposal', async () => {
    const qr = Promise.withResolvers<typeof QrModule>();
    const update = Promise.withResolvers<Awaited<ReturnType<typeof checkForUpdate>>>();
    const file = Promise.withResolvers<File>();
    const f = fixture({ loadQr: () => qr.promise });
    f.state.devices = []; f.state.dir = f.directory; f.state.folderState = 'granted';
    mocks.checkUpdate.mockReturnValueOnce(update.promise);
    f.mount(); await settle();
    f.emit('file-saved', received());
    vi.mocked(f.sink.openFile).mockReturnValueOnce(file.promise);
    byText('Open photo.jpg').click();
    await f.ui.dispose();
    const before = f.app.innerHTML;
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:late');
    qr.resolve(await import('../hub/qr.js'));
    update.resolve({ available: true, latest: '9.0.0', info: { version: '9.0.0' } });
    file.resolve(new File([], 'photo.jpg'));
    await settle();
    expect(mocks.drawQr).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(f.app.innerHTML).toBe(before);
  });
});

describe('disposal across update await boundaries', () => {
  it('does not start a network check after delayed build metadata resolves', async () => {
    const build = Promise.withResolvers<{ readonly BUILD: typeof mocks.build }>();
    const f = fixture({ loadBuild: () => build.promise });
    f.mount(); await settle();
    await f.ui.dispose();
    build.resolve({ BUILD: mocks.build });
    await settle();
    expect(mocks.checkUpdate).not.toHaveBeenCalled();
  });

  it('does not render a banner after delayed dismissal storage resolves', async () => {
    const dismissed = Promise.withResolvers<unknown>();
    const f = fixture();
    vi.mocked(f.kv.get).mockReturnValueOnce(dismissed.promise);
    mocks.checkUpdate.mockResolvedValue({ available: true, latest: '9.0.0', info: { version: '9.0.0' } });
    f.mount(); await settle();
    expect(f.kv.get).toHaveBeenCalledWith('dismissedUpdate');
    await f.ui.dispose();
    const before = f.app.innerHTML;
    dismissed.resolve(null); await settle();
    expect(f.app.innerHTML).toBe(before);
  });
});
