// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminStatusResponse } from '../public/generated/contracts.js';
import type { AdminClient } from '../hub/admin.js';
import { createHubUi, initializeHubUi } from '../hub/hub.js';
import type { DashboardController } from '../hub/hub.js';
import type { drawQr } from '../hub/qr.js';

const blank: AdminStatusResponse = { hubId: 'hub', name: 'My PC', receiveDirectory: '/downloads', port: 47616, addrs: ['192.168.1.2'], devices: [], transfers: [], outbox: [], history: [] };
const file = { name: 'photo.jpg', size: 100, type: 'image/jpeg', lastModified: 10 };
const populated: AdminStatusResponse = { ...blank,
  devices: [{ deviceId: 'phone', name: 'Phone', os: 'Android', pairedAt: 1, lastSeen: 1, lastAddr: '192.168.1.3', online: true }, { deviceId: 'other', name: 'Other', os: '', pairedAt: 1, lastSeen: 1, lastAddr: '', online: false }],
  transfers: [{ tid: 'incoming', deviceId: 'phone', deviceName: 'Phone', files: [{ ...file, originalName: 'photo.jpg', bytes: 50, done: false, where: null }], count: 1, done: 0, bytes: 50, total: 100, complete: false, speed: 0, createdAt: 1, lastActivity: 1 }, { tid: 'empty', deviceId: 'phone', deviceName: 'Phone', files: [], count: 0, done: 0, bytes: 0, total: 0, complete: true, speed: 0, createdAt: 1, lastActivity: 1 }],
  outbox: [{ tid: 'outgoing', deviceId: 'phone', files: [file], count: 1, createdAt: 1, bytes: 10, total: 100, speed: 0, started: true }, { tid: 'empty', deviceId: 'phone', files: [], count: 0, createdAt: 1, bytes: 0, total: 0, speed: 0, started: false }],
  history: [{ tid: 'received', deviceId: 'phone', deviceName: 'Phone', name: 'saved.jpg', originalName: 'saved.jpg', size: 100, type: '', where: '/downloads/saved.jpg', at: 1 }, { tid: 'received2', deviceId: 'phone', deviceName: 'Phone', name: 'other.jpg', originalName: 'other.jpg', size: 100, type: '', where: null, at: 1 }],
};
const controllers: DashboardController[] = [];
const fixture = (snapshot: AdminStatusResponse = blank, options: Parameters<typeof createHubUi>[2] = {}) => {
  const client = {
    status: vi.fn<AdminClient['status']>().mockResolvedValue(snapshot), pair: vi.fn<AdminClient['pair']>().mockResolvedValue({ payload: 'code', link: 'https://phone/#pair=code', expiresAt: 60_000 }),
    settings: vi.fn<AdminClient['settings']>().mockResolvedValue({ ok: true }), send: vi.fn<AdminClient['send']>().mockResolvedValue({ tid: 'outgoing' }),
    forget: vi.fn<AdminClient['forget']>().mockResolvedValue({ ok: true }), cancel: vi.fn<AdminClient['cancel']>().mockResolvedValue({ ok: true }), dispose: vi.fn<AdminClient['dispose']>(),
  };
  const app = document.createElement('div'); document.body.append(app);
  const draw = vi.fn<typeof drawQr>().mockReturnValue({ size: 21, version: 1, modules: new Uint8Array(441) });
  const ui = createHubUi(app, client, { now: () => 0, draw, refreshMs: 1000, ...options });
  controllers.push(ui);
  return { app, client, ui, draw };
};
const button = (text: string): HTMLButtonElement => {
  const found = [...document.querySelectorAll('button')].find((element) => element.textContent === text);
  if (found === undefined) throw new Error(`Missing button ${text}`);
  return found;
};
const input = (label: string): HTMLInputElement => {
  const found = [...document.querySelectorAll('label')].find((element) => element.textContent === label)?.querySelector('input');
  if (found === null || found === undefined) throw new Error(`Missing input ${label}`);
  return found;
};
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, id: string): HTMLElementTagNameMap[K] => {
  const found = [...document.getElementsByTagName(tag)].find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`Missing ${id}`);
  return found;
};
const settle = async (): Promise<void> => { await vi.advanceTimersByTimeAsync(0); };
const submit = async (text: string): Promise<void> => { button(text).closest('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await settle(); };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1000); document.body.replaceChildren(); sessionStorage.clear(); history.replaceState(null, '', '/'); });
afterEach(() => { controllers.splice(0).forEach((controller) => { controller.dispose(); }); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('renders connecting and empty states, then refreshes without losing settings edits', async () => {
  const { app, client, ui } = fixture();
  expect(app.textContent).toContain('Connecting');
  await ui.refresh();
  expect(app.textContent).toContain('Listening on port 47616');
  expect(app.textContent).toContain('No phone paired yet');
  expect(app.textContent).toContain('No incoming transfers');
  expect(app.textContent).toContain('No files waiting');
  expect(app.textContent).toContain('Received files will appear');
  expect(button('Send files').disabled).toBe(true);
  expect(input('Computer name').value).toBe('My PC');
  input('Computer name').value = 'Edited'; input('Computer name').dispatchEvent(new Event('input'));
  client.status.mockResolvedValue({ ...blank, name: 'Server name' });
  await vi.advanceTimersByTimeAsync(1000);
  expect(input('Computer name').value).toBe('Edited');
  input('Receive folder').value = '/new'; input('Receive folder').dispatchEvent(new Event('input'));
  await submit('Save settings');
  expect(client.settings).toHaveBeenCalledWith({ name: 'Edited', receiveDirectory: '/new' });
  expect(input('Computer name').value).toBe('Server name');
});

it('renders phones, progress and history, and sends native file paths', async () => {
  const { app, client, ui } = fixture(populated);
  await ui.refresh();
  expect(app.textContent).toContain('Last seen');
  expect(app.textContent).toContain('Complete');
  expect(app.textContent).toContain('/downloads/saved.jpg');
  expect(app.textContent).toContain('/downloads');
  expect(document.querySelectorAll('[role=progressbar]')).toHaveLength(4);
  const recipient = element('select', 'recipient'); recipient.value = 'other';
  await ui.refresh(); expect(recipient.value).toBe('other');
  element('textarea', 'paths').value = ' /first \n\n /second\r\n';
  await submit('Send files');
  expect(client.send).toHaveBeenCalledWith({ deviceId: 'other', paths: ['/first', '/second'] });
  expect(element('textarea', 'paths').value).toBe('');
  button('Forget Phone').click(); await settle(); expect(client.forget).toHaveBeenCalledWith('phone');
  button('Cancel photo.jpg').click(); await settle(); expect(client.cancel).toHaveBeenCalledWith('outgoing');
});

it('validates the local send form and reports operation failures', async () => {
  const { client, ui } = fixture(populated);
  await ui.refresh();
  await submit('Send files'); expect(document.body.textContent).toContain('Choose a phone');
  element('textarea', 'paths').value = '/file'; element('select', 'recipient').value = '';
  await submit('Send files'); expect(client.send).not.toHaveBeenCalled();
  element('select', 'recipient').value = 'phone';
  client.send.mockRejectedValue(new Error('not found'));
  await submit('Send files'); expect(document.body.textContent).toContain('not found');
  client.status.mockRejectedValue('offline'); await ui.refresh(); expect(document.body.textContent).toContain('offline');
});

it('shows pairing codes, fallback text and expiry without destroying copy selection', async () => {
  const { client, ui, draw } = fixture(); await ui.refresh();
  button('Show pairing code').click(); await settle();
  expect(draw).toHaveBeenCalledOnce();
  expect(document.body.textContent).toContain('Expires in 60 seconds');
  const link = document.querySelector('textarea[readonly]');
  await vi.advanceTimersByTimeAsync(1000);
  expect(document.querySelector('textarea[readonly]')).toBe(link);
  client.pair.mockResolvedValue({ payload: 'code', link: 'https://phone/#pair=expired', expiresAt: -1 });
  draw.mockImplementation(() => { throw new Error('canvas unavailable'); });
  button('Show pairing code').click(); await settle();
  expect(document.body.textContent).toContain('QR code unavailable');
  expect(document.body.textContent).toContain('Expired');
});

it('coalesces refresh and mutation work and cancels lifecycle effects', async () => {
  const { app, client, ui } = fixture(populated); await ui.refresh();
  const pending = Promise.withResolvers<AdminStatusResponse>();
  client.status.mockReturnValue(pending.promise);
  const first = ui.refresh(); await ui.refresh();
  const mutation = Promise.withResolvers<unknown>(); client.forget.mockReturnValue(mutation.promise);
  button('Forget Phone').click(); button('Forget Phone').click(); await vi.advanceTimersByTimeAsync(1000);
  expect(client.forget).toHaveBeenCalledTimes(1);
  ui.dispose(); ui.dispose();
  expect(client.dispose).toHaveBeenCalledOnce();
  const content = app.textContent;
  pending.resolve(blank); mutation.reject(new Error('late'));
  await first; await settle(); await ui.refresh();
  button('Forget Phone').click(); await settle();
  expect(app.textContent).toBe(content);
  expect(vi.getTimerCount()).toBe(0);
});

it('suppresses late pairing and refresh failure results after page closure', async () => {
  const { app, client, ui } = fixture(); await ui.refresh();
  const pair = Promise.withResolvers<{ payload: string; link: string; expiresAt: number }>();
  client.pair.mockReturnValue(pair.promise);
  button('Show pairing code').click(); await settle();
  const refresh = Promise.withResolvers<AdminStatusResponse>(); client.status.mockReturnValue(refresh.promise);
  const waiting = ui.refresh();
  window.dispatchEvent(new Event('pagehide'));
  const content = app.textContent;
  pair.resolve({ payload: 'late', link: 'late', expiresAt: 0 }); refresh.reject(new Error('late'));
  await waiting; await settle();
  expect(app.textContent).toBe(content);
});

it('uses default clock, interval and QR rendering capabilities', async () => {
  const app = document.createElement('div'); document.body.append(app);
  const client: AdminClient = { status: () => Promise.resolve(blank), pair: () => Promise.resolve({ payload: 'p', link: 'link', expiresAt: 50_000 }), settings: () => Promise.resolve({}), send: () => Promise.resolve({}), forget: () => Promise.resolve({}), cancel: () => Promise.resolve({}), dispose: () => undefined };
  const ui = createHubUi(app, client); controllers.push(ui);
  await ui.refresh(); button('Show pairing code').click(); await settle();
  expect(app.textContent).toContain('Expires in 49 seconds');
  await vi.advanceTimersByTimeAsync(2000);
  expect(app.textContent).toContain('Expires in 47 seconds');
});

describe('bootstrap', () => {
  it('requires an app root and explains how to authenticate', async () => {
    await expect(initializeHubUi()).rejects.toThrow('Missing hub application root');
    document.body.append(Object.assign(document.createElement('div'), { id: 'app' }));
    expect(await initializeHubUi()).toBeNull();
    expect(document.body.textContent).toContain('Open the local dashboard link');
  });
  it('consumes a fragment token and starts the generated-contract client', async () => {
    document.body.append(Object.assign(document.createElement('div'), { id: 'app' }));
    history.replaceState(null, '', `/#admin=${'a'.repeat(43)}`);
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(blank)); vi.stubGlobal('fetch', fetch);
    const socket = Object.assign(new EventTarget(), { close: vi.fn<(code?: number, reason?: string) => void>() });
    vi.stubGlobal('WebSocket', vi.fn(function () { return socket; }));
    const initialized = initializeHubUi();
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetch).not.toHaveBeenCalled();
    socket.dispatchEvent(new Event('open'));
    const ui = await initialized;
    if (ui === null) throw new Error('Expected dashboard');
    controllers.push(ui);
    expect(location.hash).toBe(''); expect(sessionStorage.getItem('i6-admin-token')).toBe('a'.repeat(43));
    expect(document.body.textContent).toContain('My PC');
    await vi.advanceTimersByTimeAsync(2000);
    socket.dispatchEvent(new Event('close'));
    expect(document.body.textContent).toContain('Hub stopped');
  });
  it('explains lifetime handshake failures without continuing admin requests', async () => {
    document.body.append(Object.assign(document.createElement('div'), { id: 'app' }));
    sessionStorage.setItem('i6-admin-token', 'a'.repeat(43));
    const fetch = vi.fn<typeof globalThis.fetch>(); vi.stubGlobal('fetch', fetch);
    const socket = Object.assign(new EventTarget(), { close: vi.fn<(code?: number, reason?: string) => void>() });
    vi.stubGlobal('WebSocket', vi.fn(function () { return socket; }));
    const initialized = initializeHubUi(); socket.dispatchEvent(new Event('error'));
    const ui = await initialized; if (ui !== null) controllers.push(ui);
    expect(document.body.textContent).toContain('Hub connection failed');
    expect(fetch).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
