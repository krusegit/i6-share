// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initializePhoneUi, type PhoneEngine, type PhoneHub, type PhoneUiController } from '../public/app.js';
import type { ClientEvents, ClientStore, TransferSnapshot } from '../public/client-types.js';
import { closeDialog, requireElement } from '../public/lib/dom.js';
import { encodePairPayload, pairLink } from '../public/lib/proto.js';

type Handlers = { [K in keyof ClientEvents]?: (event: CustomEvent<ClientEvents[K]>) => void };
const makeHarness = () => {
  const handlers: Handlers = {};
  const hubs: PhoneHub[] = [];
  const transfers: TransferSnapshot[] = [];
  const kv: ClientStore = { get: vi.fn(() => Promise.resolve(undefined)), put: vi.fn(() => Promise.resolve()), delete: vi.fn(() => Promise.resolve()), all: vi.fn(() => Promise.resolve([])) };
  const engine: PhoneEngine = {
    hubs, transfers, deviceName: 'Phone', deviceId: '1234567890abcdef',
    hub: (id) => hubs.find((hub) => hub.id === id),
    addEventListener: <K extends keyof ClientEvents>(type: K, handler: (event: CustomEvent<ClientEvents[K]>) => void) => { Object.assign(handlers, { [type]: handler }); },
    removeEventListener: (type) => { Reflect.deleteProperty(handlers, type); },
    init: vi.fn(() => Promise.resolve()), pair: vi.fn(() => Promise.resolve(makeHub())),
    send: vi.fn(() => Promise.resolve('tid')), forget: vi.fn(() => Promise.resolve()), cancel: vi.fn(() => Promise.resolve()),
    setDeviceName: vi.fn(() => Promise.resolve()), kick: vi.fn(), setVisible: vi.fn(), stop: vi.fn(),
  };
  const emit = <K extends keyof ClientEvents>(type: K, detail: ClientEvents[K]): void => { handlers[type]?.(new CustomEvent(type, { detail })); };
  return { engine, kv, hubs, transfers, emit, handlers };
};
const makeHub = (id = '0011223344556677', name = 'Computer', status: PhoneHub['status'] = 'online'): PhoneHub => ({ id, name, status, lastSeen: 1, rec: { hubId: id, name, addrs: [], lastAddr: '', port: 47616, secret: '', pairedAt: 0, lastSeen: 0 } });
const makeTransfer = (overrides: Partial<TransferSnapshot> = {}): TransferSnapshot => ({ tid: 'tid', hubId: '0011223344556677', names: ['file.txt'], total: 10, sent: 5, rate: 1024, status: 'sending', failed: [], error: null, createdAt: 1, doneAt: Date.now(), ...overrides });
const pairing = (): string => pairLink(encodePairPayload({ hubId: '0011223344556677', token: new Uint8Array(16), port: 47616, addrs: ['127.0.0.1'], name: 'Computer' }));
const findButton = (label: string): HTMLButtonElement => {
  const element = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === label || button.getAttribute('aria-label') === label);
  if (element === undefined) throw new Error(`Missing button ${label}`);
  return element;
};
const click = (label: string): void => { findButton(label).click(); };
const flush = async (): Promise<void> => { await vi.advanceTimersByTimeAsync(30); };
let ui: PhoneUiController | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.replaceChildren();
  for (const id of ['main', 'conn', 'bar-actions']) { const element = document.createElement('div'); element.id = id; document.body.append(element); }
  history.replaceState(null, '', '/');
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:file');
  vi.spyOn(URL, 'revokeObjectURL').mockReturnValue();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: vi.fn(() => Promise.reject(new Error('unknown permission'))) } });
});
afterEach(() => { ui?.dispose(); ui = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });

it('starts unpaired, stages files, persists choices and clears image URLs', async () => {
  const harness = makeHarness();
  ui = await initializePhoneUi(harness);
  expect(document.body.textContent).toContain('No computer paired yet');
  expect(requireElement('conn').classList.contains('hidden')).toBe(true);
  const image = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
  await ui.stage([image, new File(['text'], 'readme.txt')]);
  expect(document.body.textContent).toContain('Pair your computer to send');
  expect(document.body.textContent).toContain('2 files');
  document.querySelector('img')?.dispatchEvent(new Event('error'));
  expect(document.body.textContent).toContain('JPG');
  click('Clear');
  await flush();
  expect(document.body.textContent).toContain('No computer paired yet');
  expect(vi.spyOn(URL, 'revokeObjectURL')).toHaveBeenCalledWith('blob:file');
  expect(harness.kv.delete).toHaveBeenCalledWith('staged');
  await ui.stage(Array.from({ length: 15 }, (_, index) => new File([], `file${String(index)}`)));
  expect(document.body.textContent).toContain('+3');
});

it('renders computers and handles staged sends, file picking and failures', async () => {
  const harness = makeHarness(); harness.hubs.push(makeHub());
  ui = await initializePhoneUi(harness);
  expect(document.body.textContent).toContain('Online');
  const file = new File(['hello'], 'hello.txt');
  await ui.stage([file]);
  document.querySelector<HTMLElement>('.hub')?.click();
  await flush();
  expect(harness.engine.send).toHaveBeenCalledWith('0011223344556677', [file]);
  vi.mocked(harness.engine.send).mockRejectedValueOnce(new Error('offline'));
  await ui.stage([file]);
  document.querySelector<HTMLElement>('.hub')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await flush();
  expect(requireElement('snackbar').textContent).toContain('Could not send: offline');
  document.querySelector<HTMLElement>('.hub')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
  const input = document.querySelector<HTMLInputElement>('input[type=file]');
  if (input === null) throw new Error('Missing file picker');
  const selected = new DataTransfer(); selected.items.add(file);
  input.files = selected.files;
  input.dispatchEvent(new Event('change'));
  await flush();
  expect(harness.engine.send).toHaveBeenCalledTimes(3);
  click('Send files');
  input.files = new DataTransfer().files; input.dispatchEvent(new Event('change'));
  harness.hubs.push(makeHub('ffeeddccbbaa0099', 'Second'));
  harness.emit('hubs', {});
  input.files = selected.files; input.dispatchEvent(new Event('change'));
  await flush();
  expect(requireElement('snackbar').textContent).toBe('Tap a computer to send');
  document.querySelector<HTMLElement>('.hub')?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  await flush();
});

it('updates transfer progress, incoming states, queued transfers and completion summaries', async () => {
  const harness = makeHarness(); harness.hubs.push(makeHub());
  ui = await initializePhoneUi(harness);
  harness.transfers.push(makeTransfer(), makeTransfer({ tid: 'second', createdAt: 2, status: 'queued' }));
  harness.emit('status', { hubId: '0011223344556677', status: 'online', lastSeen: 1 });
  await flush();
  expect(document.body.textContent).toContain('Sending 50 %');
  expect(document.body.textContent).toContain('+1 queued');
  click('Cancel transfer'); expect(harness.engine.cancel).toHaveBeenCalledWith('tid');
  harness.transfers.splice(0, harness.transfers.length, makeTransfer({ rate: 0, total: 0, status: 'queued' }));
  harness.emit('status', { hubId: '0011223344556677', status: 'online', lastSeen: 1 }); await flush();
  expect(document.body.textContent).toContain('Connecting…');
  harness.hubs.splice(0, 1, makeHub('0011223344556677', 'Computer', 'offline'));
  harness.emit('status', { hubId: '0011223344556677', status: 'offline', lastSeen: 1 }); await flush();
  expect(document.body.textContent).toContain('Offline – will retry');
  harness.transfers.splice(0);
  harness.emit('incoming', { tid: 'incoming', hubId: '0011223344556677', names: ['name'], total: 10, received: 5, status: 'receiving' }); await flush();
  expect(document.body.textContent).toContain('Receiving 50 %');
  harness.emit('incoming', { tid: 'incoming', hubId: '0011223344556677', names: ['name'], total: 0, received: 0, status: 'receiving' }); await flush();
  expect(document.body.textContent).toContain('Receiving 0 %');
  harness.emit('incoming', { tid: 'incoming', hubId: '0011223344556677', names: ['name'], total: 0, received: 0, status: 'done' });
  harness.emit('transfer', makeTransfer({ status: 'done' })); await flush();
  expect(document.body.textContent).toContain('Sent ✓');
  harness.emit('transfer', makeTransfer({ status: 'partial', failed: [0] })); await flush();
  expect(requireElement('snackbar').textContent).toContain('was skipped');
  harness.emit('transfer', makeTransfer({ status: 'partial', failed: [0, 1] })); await flush();
  expect(requireElement('snackbar').textContent).toContain('were skipped');
  harness.emit('transfer', makeTransfer({ status: 'cancelled' })); await flush();
  expect(document.body.textContent).toContain('Cancelled');
  harness.emit('transfer', makeTransfer()); await flush();
  await vi.advanceTimersByTimeAsync(21000);
  expect(document.body.textContent).toContain('Offline');
  harness.emit('status', { hubId: 'missing', status: 'offline', lastSeen: 1 }); await flush();
});

it('handles received files, share actions, unpairing and network banners', async () => {
  const harness = makeHarness(); harness.hubs.push(makeHub());
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
  Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn(() => Promise.reject(new Error('cancelled'))) });
  ui = await initializePhoneUi(harness);
  const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
  harness.emit('file', { file, hubName: 'Computer', hubId: '0011223344556677', tid: 'tid', index: 0 });
  click('Share'); click('Save again'); await flush();
  expect(document.body.textContent).toContain('Received');
  for (let index = 0; index < 31; index += 1) harness.emit('file', { file: new File(['x'], `file${String(index)}`), hubName: 'Computer', hubId: '0011223344556677', tid: 'tid', index });
  expect(vi.spyOn(URL, 'revokeObjectURL')).toHaveBeenCalled();
  harness.emit('unpaired', { hubId: '0011223344556677', name: 'Computer', reason: 'revoked', files: [] });
  expect(document.body.textContent).toContain('Pairing with Computer was lost');
  click('Dismiss');
  expect(document.body.textContent).not.toContain('Pairing with Computer was lost');
  harness.emit('unpaired', { hubId: '0011223344556677', name: 'Computer', reason: 'revoked', files: [file] }); await flush();
  harness.emit('network', { blocked: true }); await flush();
  expect(document.body.textContent).toContain('Allow local network access');
  click('Retry now'); expect(harness.engine.kick).toHaveBeenCalled();
  harness.emit('network', { blocked: false }); await flush();
  harness.emit('busy', { busy: true }); harness.emit('busy', { busy: false });
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  harness.emit('warning', { message: 'warning' }); expect(warn).toHaveBeenCalledWith('warning');
});

it('pairs valid codes, rejects invalid codes and sends staged files after pairing', async () => {
  const harness = makeHarness();
  ui = await initializePhoneUi(harness);
  await ui.pair('not a code');
  expect(requireElement('snackbar').textContent).toContain('not a valid');
  const file = new File(['hello'], 'hello.txt'); await ui.stage([file]);
  vi.mocked(harness.engine.pair).mockImplementationOnce((_payload, options) => {
    options?.onStatus?.('pairing'); options?.onStatus?.('blocked'); options?.onStatus?.('searching');
    return Promise.resolve(makeHub());
  });
  await ui.pair(pairing());
  expect(harness.engine.send).toHaveBeenCalledWith('0011223344556677', [file]);
  expect(document.querySelector('dialog')).toBeNull();
});

it('edits settings, forgets computers and retains cancelled choices', async () => {
  const harness = makeHarness(); harness.hubs.push(makeHub());
  ui = await initializePhoneUi(harness);
  const settings = ui.settings();
  click('Forget');
  const dialogs = document.querySelectorAll('dialog');
  closeDialog(dialogs.item(1), false);
  await flush();
  expect(harness.engine.forget).not.toHaveBeenCalled();
  click('Forget');
  closeDialog(document.querySelectorAll('dialog').item(1), true);
  await flush(); expect(harness.engine.forget).toHaveBeenCalledWith('0011223344556677');
  const input = document.querySelector<HTMLInputElement>('dialog input');
  if (input === null) throw new Error('Missing name');
  input.value = 'New phone'; click('Save'); await settings;
  expect(harness.engine.setDeviceName).toHaveBeenCalledWith('New phone');
  harness.hubs.splice(0);
  const cancelled = ui.settings(); expect(document.body.textContent).toContain('No computers paired yet.');
  click('Close'); await cancelled;
});

it('supports pasted pairing codes and scanner fallback', async () => {
  const harness = makeHarness(); ui = await initializePhoneUi(harness);
  const pasted = ui.enterCode();
  const input = document.querySelector<HTMLInputElement>('dialog input');
  if (input === null) throw new Error('Missing code input');
  input.value = pairing();
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await pasted; await flush();
  expect(harness.engine.pair).toHaveBeenCalledOnce();
  const cancelled = ui.enterCode(); click('Cancel'); await cancelled;
  const scanning = ui.scan(); click('Cancel'); await scanning;
  const manual = ui.scan(); click('Enter code'); await manual;
  expect(document.body.textContent).toContain('Enter pairing code');
  click('Cancel'); await flush();
});

it('recovers from storage errors and reacts to browser connectivity and hash events', async () => {
  const harness = makeHarness(); harness.hubs.push(makeHub('0011223344556677', 'Computer', 'searching'));
  vi.mocked(harness.kv.get).mockRejectedValueOnce(new Error('database unavailable'));
  vi.mocked(harness.engine.init).mockRejectedValueOnce(new Error('private mode'));
  history.replaceState(null, '', '/?share=1');
  ui = await initializePhoneUi(harness);
  expect(location.search).toBe(''); expect(document.body.textContent).toContain('Storage is unavailable (private mode)');
  expect(document.body.textContent).toContain('Searching…');
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  dispatchEvent(new Event('offline')); expect(requireElement('conn').textContent).toContain('No network');
  dispatchEvent(new Event('online')); expect(harness.engine.kick).toHaveBeenCalled();
  document.dispatchEvent(new Event('visibilitychange')); expect(harness.engine.setVisible).toHaveBeenCalledWith(true);
  location.hash = pairing().split('#')[1] ?? '';
  dispatchEvent(new Event('hashchange')); await flush();
  expect(harness.engine.pair).toHaveBeenCalled(); expect(location.hash).toBe('');
  await vi.advanceTimersByTimeAsync(30000);
});

it('uses browser adapters by default and tolerates failed build metadata', async () => {
  vi.useRealTimers();
  ui = await initializePhoneUi();
  vi.useFakeTimers();
  expect(document.body.textContent).toContain('No computer paired yet');
  ui.dispose();
  ui = await initializePhoneUi({ ...makeHarness(), loadBuild: () => Promise.reject(new Error('offline')) });
  await flush();
  expect(document.querySelector('.build-badge')?.textContent).toContain('v');
});

it('restores valid staged files and handles service worker registration errors', async () => {
  const harness = makeHarness();
  const file = new File(['restored'], 'restored.txt');
  vi.mocked(harness.kv.get).mockResolvedValueOnce([file, 'invalid']);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register: vi.fn(() => Promise.reject(new Error('denied'))) } });
  ui = await initializePhoneUi(harness); await flush();
  expect(document.body.textContent).toContain('restored.txt');
  expect(document.body.textContent).toContain('1 file');
  expect(warn).toHaveBeenCalledWith('service worker', expect.any(Error));
  Reflect.deleteProperty(navigator, 'serviceWorker');
  vi.mocked(harness.kv.put).mockRejectedValueOnce(new Error('quota exceeded'));
  await ui.stage([file]);
  expect(document.body.textContent).toContain('restored.txt');
});

it('tracks local-network permission changes and hidden-page refreshes', async () => {
  const harness = makeHarness(); harness.hubs.push(makeHub());
  const permission = Object.assign(new EventTarget(), { state: 'denied', name: 'local-network-access', onchange: null });
  const query = vi.fn(() => Promise.resolve(permission));
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query } });
  ui = await initializePhoneUi(harness); await flush();
  expect(document.body.textContent).toContain('Allow local network access');
  permission.state = 'granted'; permission.dispatchEvent(new Event('change')); await flush();
  expect(document.body.textContent).not.toContain('Allow local network access');
  expect(harness.engine.kick).toHaveBeenCalled();
  harness.emit('network', { blocked: true }); await flush();
  expect(document.body.textContent).not.toContain('Allow local network access');
  permission.state = 'prompt'; permission.dispatchEvent(new Event('change')); await flush();
  expect(document.body.textContent).toContain('Allow local network access');
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  document.dispatchEvent(new Event('visibilitychange'));
  expect(harness.engine.setVisible).toHaveBeenCalledWith(false);
  await vi.advanceTimersByTimeAsync(30000);
});

it('handles file selections with selected, missing and absent computer targets', async () => {
  const harness = makeHarness(); harness.hubs.push(makeHub());
  ui = await initializePhoneUi(harness);
  document.querySelector<HTMLElement>('.hub')?.click();
  const input = document.querySelector<HTMLInputElement>('input[type=file]');
  if (input === null) throw new Error('Missing file input');
  const files = new DataTransfer(); files.items.add(new File(['x'], 'selected.txt'));
  input.files = files.files; input.dispatchEvent(new Event('change')); await flush();
  expect(harness.engine.send).toHaveBeenCalledOnce();
  document.querySelector<HTMLElement>('.hub')?.click();
  harness.hubs.splice(0); harness.emit('hubs', {});
  input.files = files.files; input.dispatchEvent(new Event('change')); await flush();
  expect(document.body.textContent).toContain('selected.txt');
  Object.defineProperty(input, 'files', { configurable: true, value: null });
  input.dispatchEvent(new Event('change')); await flush();
  expect(harness.engine.send).toHaveBeenCalledOnce();
  const pasted = ui.enterCode();
  const code = document.querySelector<HTMLInputElement>('dialog input');
  if (code === null) throw new Error('Missing pairing input');
  code.value = pairing(); click('Pair'); await pasted; await flush();
  expect(harness.engine.pair).toHaveBeenCalledOnce();
});

it('renders rate-free transfers, searching transfers, finished rows and offline timestamps', async () => {
  const harness = makeHarness(); harness.hubs.push(makeHub());
  ui = await initializePhoneUi(harness);
  click('Cancel transfer');
  expect(harness.engine.cancel).not.toHaveBeenCalled();
  harness.transfers.push(makeTransfer({ rate: 0 }));
  harness.emit('status', { hubId: '0011223344556677', status: 'online', lastSeen: 0 }); await flush();
  expect(document.body.textContent).toContain('Sending 50 %');
  expect(document.body.textContent).not.toContain('/s');
  harness.hubs.splice(0, 1, makeHub('0011223344556677', 'Computer', 'searching'));
  harness.emit('status', { hubId: '0011223344556677', status: 'searching', lastSeen: 0 }); await flush();
  expect(document.querySelector('.hub .status-dot')?.className).toContain('busy');
  harness.hubs.splice(0, 1, makeHub()); harness.transfers.splice(0);
  harness.emit('transfer', makeTransfer({ status: 'done' })); await flush();
  expect(document.querySelector('.hub .status-dot')?.className).toContain('--on');
  harness.emit('transfer', makeTransfer({ status: 'done', hubId: 'missing' })); await flush();
  expect(requireElement('snackbar').textContent).toContain('to computer');
  harness.hubs.splice(0, 1, { ...makeHub('0011223344556677', 'Computer', 'offline'), lastSeen: 0 });
  await vi.advanceTimersByTimeAsync(21000);
  expect(document.querySelector('.hub .list-item__secondary')?.textContent).toBe('Offline – will retry');
});

it('disposes completion timers, permission observers and queued event callbacks', async () => {
  const harness = makeHarness(); harness.hubs.push(makeHub());
  const permission = Object.assign(new EventTarget(), { state: 'prompt', name: 'local-network-access', onchange: null });
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: () => Promise.resolve(permission) } });
  const listen = harness.engine.addEventListener;
  const engine: PhoneEngine = { ...harness.engine, addEventListener: (type, handler) => {
    listen(type, handler);
  } };
  ui = await initializePhoneUi({ ...harness, engine });
  await flush();
  harness.emit('transfer', makeTransfer({ status: 'done' }));
  const staleStatus = harness.handlers.status;
  ui.dispose();
  permission.dispatchEvent(new Event('change'));
  expect(harness.engine.kick).not.toHaveBeenCalled();
  staleStatus?.(new CustomEvent('status', { detail: { hubId: '0011223344556677', status: 'online', lastSeen: 0 } }));
  await vi.advanceTimersByTimeAsync(21000);
  expect(harness.engine.stop).toHaveBeenCalledOnce();
  ui = undefined;
});

it('revokes replaced image previews and ignores metadata arriving after disposal', async () => {
  const harness = makeHarness();
  const metadata = Promise.withResolvers<{ readonly version: string }>();
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');
  ui = await initializePhoneUi({ ...harness, loadBuild: () => metadata.promise });
  await ui.stage([new File(['a'], 'a.png', { type: 'image/png' })]);
  await ui.stage([new File(['b'], 'b.png', { type: 'image/png' })]);
  expect(create).toHaveBeenCalledTimes(2);
  ui.dispose();
  expect(vi.spyOn(URL, 'revokeObjectURL')).toHaveBeenCalledWith('blob:first');
  expect(vi.spyOn(URL, 'revokeObjectURL')).toHaveBeenCalledWith('blob:second');
  metadata.resolve({ version: 'late' }); await flush();
  expect(document.querySelector('.build-badge')).toBeNull();
  ui = undefined;
});
