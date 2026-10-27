import { Effect, Ref } from 'effect';
import type { AdminStatusResponse, PairCodeResponse } from '../public/generated/contracts.js';
import { h, render, button, textField, progress, formatBytes, timeAgo, errorMessage } from '../public/lib/dom.js';
import type { Child } from '../public/lib/dom.js';
import { createAdminClient, takeAdminToken } from './admin.js';
import type { AdminClient } from './admin.js';
import { drawQr } from './qr.js';
import { openDashboardLifetime } from './lifetime.js';

export interface DashboardOptions {
  readonly refreshMs?: number;
  readonly now?: () => number;
  readonly draw?: typeof drawQr;
  readonly onDispose?: () => void;
  readonly canRefresh?: () => boolean;
}
export interface DashboardController {
  readonly refresh: () => Promise<void>;
  readonly dispose: () => void;
}
interface DashboardState {
  readonly snapshot: AdminStatusResponse | null;
  readonly pair: PairCodeResponse | null;
  readonly error: string | null;
  readonly busy: boolean;
  readonly refreshing: boolean;
  readonly disposed: boolean;
  readonly settingsDirty: boolean;
}
const card = (title: string, ...children: readonly Child[]): HTMLElement => h('section', { class: 'card' },
  h('div', { class: 'card__header' }, h('h2', { class: 'card__title', text: title })), ...children);
const empty = (message: string): HTMLElement => h('li', { class: 'empty body-2 muted', text: message });
const names = (files: readonly { readonly name: string }[]): string => files.map((file) => file.name).join(', ');

/** UI state is immutable; DOM and native HTTP capabilities remain at the edges. */
export const createHubUi = (app: HTMLElement, client: AdminClient, options: DashboardOptions = {}): DashboardController => {
  const state = Effect.runSync(Ref.make<DashboardState>({ snapshot: null, pair: null, error: null, busy: false, refreshing: false, disposed: false, settingsDirty: false }));
  const read = (): DashboardState => Effect.runSync(Ref.get(state));
  const update = (patch: Partial<DashboardState>): void => { Effect.runSync(Ref.update(state, (current) => ({ ...current, ...patch }))); };
  const now = options.now ?? Date.now;
  const draw = options.draw ?? drawQr;
  const status = h('p', { class: 'body-2 muted', text: 'Connecting to the native hub…', attrs: { role: 'status' } });
  const errors = h('div', { attrs: { role: 'alert' } });
  const pairing = h('div', { class: 'card__body' });
  const expiry = h('p', { class: 'caption' });
  const devices = h('ul', { class: 'list' });
  const incoming = h('ul', { class: 'list' });
  const outgoing = h('ul', { class: 'list' });
  const history = h('ul', { class: 'list' });
  const markDirty = (): void => { update({ settingsDirty: true }); };
  const name = textField('Computer name', { maxLength: 40, oninput: markDirty });
  const directory = textField('Receive folder', { oninput: markDirty, placeholder: '/home/you/Downloads/i6-share' });
  const recipient = h('select', { id: 'recipient', required: true, attrs: { 'aria-label': 'Send to phone' } });
  const paths = h('textarea', { id: 'paths', rows: 4, required: true, placeholder: '/home/you/Pictures/photo.jpg\n/home/you/Documents/note.txt', attrs: { 'aria-label': 'File paths, one per line' } });
  const save = h('button', { class: 'btn btn--contained', type: 'submit', text: 'Save settings' });
  const send = h('button', { class: 'btn btn--contained', type: 'submit', text: 'Send files' });
  const pair = button('Show pairing code', () => { void run(async () => { const code = await client.pair(); if (!read().disposed) update({ pair: code }); }); }, 'contained', 'qr');

  const renderView = (): void => {
    const current = read();
    const snapshot = current.snapshot;
    render(errors, current.error === null ? null : h('div', { class: 'banner banner--error' }, h('p', { text: current.error })));
    save.disabled = current.busy || snapshot === null;
    send.disabled = current.busy || snapshot === null || snapshot.devices.length === 0;
    pair.disabled = current.busy || snapshot === null;
    if (snapshot === null) return;
    status.textContent = `${snapshot.name} · Listening on port ${String(snapshot.port)} · ${snapshot.addrs.join(', ')}`;
    if (!current.settingsDirty) { name.input.value = snapshot.name; directory.input.value = snapshot.receiveDirectory; }
    const selected = recipient.value;
    render(recipient, snapshot.devices.map((device) => h('option', { value: device.deviceId, text: device.name })));
    if (snapshot.devices.some((device) => device.deviceId === selected)) recipient.value = selected;
    render(devices, snapshot.devices.length === 0 ? empty('No phone paired yet. Show a pairing code to get started.') : snapshot.devices.map((device) => h('li', { class: 'list-item' },
      h('div', { class: 'list-item__text' }, h('span', { class: 'list-item__primary', text: device.name }),
        h('span', { class: 'list-item__secondary', text: device.online ? 'Online' : `Last seen ${timeAgo(device.lastSeen)}` })),
      button(`Forget ${device.name}`, () => { void run(() => client.forget(device.deviceId)); }))));
    render(incoming, snapshot.transfers.length === 0 ? empty('No incoming transfers.') : snapshot.transfers.map((transfer) => h('li', { class: 'list-item' },
      h('div', { class: 'list-item__text' }, h('span', { class: 'list-item__primary', text: names(transfer.files) }),
        h('span', { class: 'list-item__secondary', text: `${transfer.deviceName} · ${formatBytes(transfer.bytes)} / ${formatBytes(transfer.total)}${transfer.complete ? ' · Complete' : ''}` }),
        progress(transfer.total === 0 ? 1 : transfer.bytes / transfer.total)))));
    render(outgoing, snapshot.outbox.length === 0 ? empty('No files waiting for a phone.') : snapshot.outbox.map((item) => h('li', { class: 'list-item' },
      h('div', { class: 'list-item__text' }, h('span', { class: 'list-item__primary', text: names(item.files) }),
        h('span', { class: 'list-item__secondary', text: `${formatBytes(item.bytes)} / ${formatBytes(item.total)}` }),
        progress(item.total === 0 ? 1 : item.bytes / item.total)), button(`Cancel ${names(item.files)}`, () => { void run(() => client.cancel(item.tid)); }))));
    render(history, snapshot.history.length === 0 ? empty('Received files will appear here.') : snapshot.history.map((file) => h('li', { class: 'list-item' },
      h('div', { class: 'list-item__text' }, h('span', { class: 'list-item__primary', text: file.name }),
        h('span', { class: 'list-item__secondary', text: `${formatBytes(file.size)} · from ${file.deviceName} · ${timeAgo(file.at)}` }),
        h('span', { class: 'caption muted', text: file.where ?? snapshot.receiveDirectory })))));
  };
  const updateExpiry = (): void => {
    const code = read().pair;
    if (code === null) return;
    const remaining = Math.ceil((code.expiresAt - now()) / 1000);
    expiry.textContent = remaining > 0 ? `Expires in ${String(remaining)} seconds` : 'Expired — show a new pairing code.';
  };
  const renderPair = (): void => {
    const code = read().pair;
    if (code === null) { render(pairing, h('p', { text: 'Scan this computer’s pairing code in the i6-share phone app. Codes expire after ten minutes and can be used once.' })); return; }
    updateExpiry();
    const canvas = h('canvas', { class: 'qr', attrs: { role: 'img', 'aria-label': 'Pairing QR code' } });
    let fallback: string | null = null;
    try { draw(canvas, code.link); } catch { fallback = 'QR code unavailable. Paste the pairing link into the phone app.'; }
    render(pairing, h('div', { class: 'hub-pair__grid' }, h('div', { class: 'hub-pair__qr' }, canvas,
      expiry),
    h('div', { class: 'hub-pair__steps' }, fallback === null ? null : h('p', { text: fallback }),
      h('p', { text: 'Open i6-share on your phone, choose Enter pairing code, and paste this link:' }),
      h('textarea', { readOnly: true, rows: 4, value: code.link, attrs: { 'aria-label': 'Pairing link' } }))));
  };
  const refresh = async (): Promise<void> => {
    if (read().disposed || read().refreshing) return;
    update({ refreshing: true });
    try {
      const snapshot = await client.status();
      if (!read().disposed) update({ snapshot, error: null });
    } catch (error) { if (!read().disposed) update({ error: errorMessage(error) }); }
    finally { update({ refreshing: false }); if (!read().disposed) renderView(); }
  };
  const run = async (work: () => Promise<unknown>): Promise<void> => {
    if (read().disposed || read().busy) return;
    update({ busy: true, error: null }); renderView();
    try { await work(); await refresh(); }
    catch (error) { if (!read().disposed) update({ error: errorMessage(error) }); }
    finally { update({ busy: false }); if (!read().disposed) { renderView(); renderPair(); } }
  };
  const settings = h('form', { class: 'card__body hub-prose', onsubmit: (event) => {
    event.preventDefault();
    void run(async () => { await client.settings({ name: name.input.value, receiveDirectory: directory.input.value }); update({ settingsDirty: false }); });
  } }, name.el, directory.el, save);
  const sendForm = h('form', { class: 'card__body hub-prose', onsubmit: (event) => {
    event.preventDefault();
    const files = paths.value.split(/\r?\n/u).map((path) => path.trim()).filter((path) => path.length > 0);
    if (recipient.value.length === 0 || files.length === 0) { update({ error: 'Choose a phone and enter at least one file path.' }); renderView(); return; }
    void run(async () => { await client.send({ deviceId: recipient.value, paths: files }); paths.value = ''; });
  } }, h('label', { htmlFor: 'recipient', text: 'Send to phone' }), recipient,
    h('label', { htmlFor: 'paths', text: 'File paths on this computer, one per line' }), paths,
    h('p', { class: 'caption muted', text: 'The native hub reads these paths and keeps a copy until the phone confirms delivery.' }), send);
  render(app, h('header', { class: 'app-bar' }, h('h1', { class: 'app-bar__title', text: 'i6-share Hub' })),
    h('main', { class: 'content hub-content hub-prose' }, status, errors,
      card('Pair a phone', pairing, h('div', { class: 'card__actions' }, pair)), card('Phones', devices),
      card('Send to a phone', sendForm), card('Incoming', incoming), card('Outgoing', outgoing), card('Received', history), card('Settings', settings)));
  renderPair(); renderView();
  const timer = setInterval(() => { if (!read().busy && (options.canRefresh?.() ?? true)) void refresh(); updateExpiry(); }, options.refreshMs ?? 2000);
  const dispose = (): void => {
    if (read().disposed) return;
    update({ disposed: true }); clearInterval(timer); client.dispose(); options.onDispose?.(); window.removeEventListener('pagehide', dispose);
  };
  window.addEventListener('pagehide', dispose);
  return { refresh, dispose };
};

export const initializeHubUi = async (): Promise<DashboardController | null> => {
  const app = document.getElementById('app');
  if (app === null) throw new Error('Missing hub application root');
  const token = takeAdminToken({ url: location.href, storage: sessionStorage, replace: (url) => { history.replaceState(null, '', url); } });
  if (token === null) {
    render(app, h('main', { class: 'content' }, card('Open the local dashboard link', h('div', { class: 'card__body' },
      h('p', { text: 'Start i6-share Hub and open the local dashboard URL it prints. The link grants access to this computer’s hub settings.' })))));
    return null;
  }
  const lifetime = openDashboardLifetime(token, location.href, () => {
    controller.dispose();
    render(app, h('main', { class: 'content' }, card('Hub stopped', h('p', { class: 'card__body', text: 'The native hub disconnected. Relaunch i6-share Hub to receive files again.' }))));
  });
  const controller = createHubUi(app, createAdminClient(token), { onDispose: lifetime.dispose, canRefresh: lifetime.connected });
  try { await lifetime.ready; await controller.refresh(); }
  catch (error) {
    controller.dispose();
    render(app, h('main', { class: 'content' }, card('Hub connection failed', h('p', { class: 'card__body', text: errorMessage(error) }))));
  }
  return controller;
};
