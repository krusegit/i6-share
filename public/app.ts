// i6-share phone/desktop PWA – UI only. All networking lives in client.js.

import { Effect, Ref } from 'effect';
import type { HubClient, TransferSnapshot, IncomingTransfer, ShareEngine, ClientStore, ClientEvents } from './client-types.js';
import {
  type BuildInformation, closeDialog, requireElement, errorMessage, h, render, icon, iconButton, button, progress, snackbar, dialog, textField,
  formatBytes, timeAgo, downloadFile, wakeLock, buildBadge,
} from './lib/dom.js';
import { store, persist } from './lib/store.js';
import { pairPayloadFromText } from './lib/proto.js';
import { createShareEngine, APP_VERSION, isAbortedError } from './client.js';

interface BarcodeResult { readonly rawValue: string }
interface BarcodeScanner { readonly detect: (source: HTMLVideoElement) => Promise<readonly BarcodeResult[]> }
interface BarcodeConstructor { new (options: { readonly formats: readonly string[] }): BarcodeScanner; readonly getSupportedFormats?: () => Promise<readonly string[]> }
declare global {
  interface Window { BarcodeDetector?: BarcodeConstructor }
  interface Permissions { query(permission: { readonly name: 'local-network-access' | 'local-network' }): Promise<PermissionStatus> }
}
const queryLocalNetworkPermission = (name: 'local-network-access' | 'local-network'): Promise<PermissionStatus> => navigator.permissions.query({ name });
export type PhoneHub = Pick<HubClient, 'id' | 'name' | 'status' | 'lastSeen' | 'rec'>;
export interface PhoneEngine extends Pick<ShareEngine, 'addEventListener' | 'removeEventListener' | 'transfers' | 'deviceName' | 'deviceId' | 'send' | 'forget' | 'cancel' | 'setDeviceName' | 'kick' | 'setVisible' | 'stop'> {
  readonly init: (options: Parameters<ShareEngine['init']>[0]) => Promise<unknown>;
  readonly hubs: readonly PhoneHub[];
  readonly hub: (id: string) => PhoneHub | undefined;
  readonly pair: (input: Parameters<ShareEngine['pair']>[0], options?: Parameters<ShareEngine['pair']>[1]) => Promise<PhoneHub>;
}
export interface PhoneUiOptions { readonly engine?: PhoneEngine; readonly kv?: ClientStore; readonly loadBuild?: () => Promise<BuildInformation> }
export interface PhoneUiController {
  readonly stage: (files: File[]) => Promise<void>;
  readonly pair: (code: string) => Promise<void>;
  readonly scan: () => Promise<void>;
  readonly enterCode: () => Promise<void>;
  readonly settings: () => Promise<void>;
  readonly dispose: () => void;
}
export const initializePhoneUi = async (options: PhoneUiOptions = {}): Promise<PhoneUiController> => {
const kv = options.kv ?? store('kv');
const listeners: (() => void)[] = [];
const engine = options.engine ?? createShareEngine({ kv, hubs: store('hubs'), queue: store('queue') });
const listen = <K extends keyof ClientEvents>(type: K, listener: (event: CustomEvent<ClientEvents[K]>) => void): void => {
  engine.addEventListener(type, listener);
  listeners.push(() => { engine.removeEventListener(type, listener); });
};
const lifecycle = new AbortController();
const isDisposed = (): boolean => lifecycle.signal.aborted;
const completionTimers = new Set<ReturnType<typeof setTimeout>>();
const setWake = wakeLock();

const main = requireElement('main');
const conn = requireElement('conn');
const ACTIVE = new Set(['queued', 'sending']);
const DONE_SHOW_MS = 20000;

interface UiState { readonly staged: readonly File[]; readonly received: readonly { readonly file: File; readonly hubName: string; readonly at: number }[]; readonly incoming: ReadonlyMap<string, IncomingTransfer>; readonly lastDone: ReadonlyMap<string, TransferSnapshot>; readonly blocked: boolean; readonly showLna: boolean; readonly unpaired: string | null; readonly pairing: boolean; readonly error: string | null }
interface HubLine { readonly text: string; readonly dot: string; readonly value?: number | null; readonly cancel?: string; readonly done?: boolean }
interface RowRefs { readonly name: HTMLElement; readonly dot: HTMLElement; readonly secondary: HTMLElement; readonly bar: HTMLElement; cancelTid: string | null; readonly cancel: HTMLButtonElement; readonly el: HTMLLIElement }
const state = Effect.runSync(Ref.make<UiState>({
  staged: [],              // File[] waiting for the user to tap a computer
  received: [],            // [{file, hubName, at}] newest first (this session)
  incoming: new Map(),     // tid -> 'incoming' event detail
  lastDone: new Map(),     // hubId -> finished transfer snapshot
  blocked: false,          // engine thinks LAN requests are blocked
  showLna: false,
  unpaired: null,          // name of a hub that dropped our pairing
  pairing: false,
  error: null,
}));
const read = (): UiState => Effect.runSync(Ref.get(state));
const update = (changes: Partial<UiState>): void => { Effect.runSync(Ref.update(state, (current) => ({ ...current, ...changes }))); };
let rows = new Map<string, RowRefs>();      // hubId -> row refs (updated in place on progress)
let pickTarget: string | null = null;

// ---------------------------------------------------------------- helpers

const plural = (n: number, word: string) => `${String(n)} ${word}${n === 1 ? '' : 's'}`;
const total = (files: readonly File[]) => files.reduce((n, f) => n + f.size, 0);
const isImage = (f: File) => f.type.startsWith("image/");

const urls = new Map<File, string>();
function urlFor(file: File): string {
  const existing = urls.get(file);
  if (existing !== undefined) return existing;
  const url = URL.createObjectURL(file); urls.set(file, url); return url;
}
function revoke(files: readonly File[]) {
  for (const f of files) { const u = urls.get(f); if (u !== undefined) { URL.revokeObjectURL(u); urls.delete(f); } }
}

function activeTransfers(hubId: string) {
  return engine.transfers.filter((t) => t.hubId === hubId && ACTIVE.has(t.status)).sort((a, b) => a.createdAt - b.createdAt);
}

// ---------------------------------------------------------------- staged files

async function setStaged(files: File[]) {
  update({ staged: files });
  try { await (files.length ? kv.put('staged', files) : kv.delete('staged')); } catch { /* memory only */ }
  renderAll();
}

function clearStaged() {
  revoke(read().staged);
  void setStaged([]);
}

async function sendTo(hubId: string, files: readonly File[]) {
  const hub = engine.hub(hubId);
  try {
    await engine.send(hubId, files);
    snackbar(`Sending ${plural(files.length, 'file')} to ${hub?.name ?? 'computer'}`);
  } catch (err) {
    snackbar(`Could not send: ${errorMessage(err)}`);
  }
}

function tapHub(hubId: string) {
  if (read().staged.length) {
    const files = read().staged;
    clearStaged();
    void sendTo(hubId, files);
  } else {
    pick(hubId);
  }
}

const fileInput = h('input', { type: 'file', multiple: true, hidden: true, onchange: onPicked });

function pick(hubId: string | null) {
  pickTarget = hubId;
  fileInput.value = '';
  fileInput.click();
}

function onPicked() {
  const files = Array.from(fileInput.files ?? []);
  fileInput.value = '';
  if (!files.length) return;
  const hubs = engine.hubs;
  if (pickTarget !== null && engine.hub(pickTarget)) void sendTo(pickTarget, files);
  else if (hubs.length === 1 && !read().staged.length && hubs[0]) void sendTo(hubs[0].id, files);
  else {
    void setStaged([...read().staged, ...files]);
    if (hubs.length) snackbar('Tap a computer to send');
  }
  pickTarget = null;
}

// ---------------------------------------------------------------- pairing

async function doPair(text: string) {
  if (isDisposed()) return;
  let payload: ReturnType<typeof pairPayloadFromText>;
  try { payload = pairPayloadFromText(text); } catch {
    snackbar('That is not a valid i6-share pairing code');
    return;
  }
  if (read().pairing) return;
  update({ pairing: true });
  const ctl = new AbortController();
  const name = payload.name || 'your computer';
  const msg = h('p', { text: `Looking for ${name}…` });
  void dialog({
    title: 'Pairing',
    content: [progress(null), msg, h('p', { class: 'body-2', text: 'Keep i6-share Hub open on the computer. Both devices must be on the same network.' })],
    actions: [{ label: 'Cancel', value: 'cancel' }],
    dismissible: false,
  }).then((v) => { if (v === 'cancel') ctl.abort(); });
  const dlg = msg.closest('dialog');
  const abortPair = (): void => { ctl.abort(); closeDialog(dlg, 'cancel'); };
  lifecycle.signal.addEventListener('abort', abortPair, { once: true });
  try {
    const hub = await engine.pair(payload, {
      signal: ctl.signal,
      onStatus: (s) => {
        msg.textContent = s === 'pairing' ? `Pairing with ${name}…`
          : s === 'blocked' ? `Can't reach ${name}. If Chrome asked about "local network access", allow it. Still trying…`
            : `Looking for ${name}…`;
      },
    });
    closeDialog(dlg, 'done');
    if (isDisposed()) return;
    update({ unpaired: null });
    snackbar(`Paired with ${hub.name}`);
    if (read().staged.length) {
      const files = read().staged;
      clearStaged();
      await sendTo(hub.id, files);
    }
    renderAll();
  } catch (err) {
    closeDialog(dlg, 'done');
    if (isDisposed() || isAbortedError(err)) return;
    const again = await dialog({
      title: 'Pairing failed',
      content: h('p', { text: errorMessage(err) }),
      actions: [{ label: 'Close', value: false }, { label: 'Scan again', value: true, variant: 'contained' }],
    });
    if (again === true) void scanDialog();
  } finally {
    lifecycle.signal.removeEventListener('abort', abortPair);
    update({ pairing: false });
  }
}

function handleHash() {
  if (!location.hash.includes('pair=')) return;
  const text = location.hash;
  history.replaceState(null, '', location.pathname + location.search);
  void doPair(text);
}

function isPairCode(text: string) {
  try { pairPayloadFromText(text); return true; } catch { return false; }
}

async function scanDialog() {
  const Detector = window.BarcodeDetector;
  const supported = Detector !== undefined && 'mediaDevices' in navigator && (await Detector.getSupportedFormats?.().catch(() => ['qr_code']) ?? ['qr_code']).includes('qr_code');
  if (isDisposed()) return;
  if (!supported) {
    const paste = await dialog({
      title: 'Scan QR code',
      content: h('p', { text: 'This browser can\'t scan QR codes inside the app. Scan the code shown by i6-share Hub with your camera app instead, or enter the pairing code.' }),
      actions: [{ label: 'Cancel', value: false }, { label: 'Enter code', value: true, variant: 'contained' }],
    });
    if (paste === true) void pasteDialog();
    return;
  }
  const video = h('video', { class: 'scanner__video', muted: true, playsInline: true, autoplay: true, attrs: { playsinline: true } });
  const note = h('p', { class: 'body-2', text: 'Point the camera at the QR code shown by i6-share Hub on your computer.' });
  const box = h('div', { class: 'scanner' }, video, h('div', { class: 'scanner__frame' }));
  const result = dialog({
    title: 'Scan QR code',
    content: [box, note],
    actions: [{ label: 'Enter code', value: 'paste' }, { label: 'Cancel', value: null }],
  });
  const dlg = box.closest('dialog');
  let stream: MediaStream | null = null;
  const camera = { closed: false };
  const isClosed = (): boolean => camera.closed;
  const stopCamera = () => { camera.closed = true; stream?.getTracks().forEach((t) => { t.stop(); }); stream = null; };
  const abortScan = (): void => { stopCamera(); closeDialog(dlg); };
  lifecycle.signal.addEventListener('abort', abortScan, { once: true });
  void result.finally(() => { stopCamera(); lifecycle.signal.removeEventListener('abort', abortScan); });
  void (async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (camera.closed) { s.getTracks().forEach((t) => { t.stop(); }); return; }
      stream = s;
      video.srcObject = s;
      await video.play().catch(() => undefined);
      const detector = new Detector({ formats: ['qr_code'] });
      while (!isClosed()) {
        try {
          const codes = video.readyState >= 2 ? await detector.detect(video) : [];
          const hit = codes.map((c) => c.rawValue).find(isPairCode);
          if (hit !== undefined) { closeDialog(dlg, { code: hit }); return; }
          if (codes.length) note.textContent = 'That QR code is not an i6-share pairing code.';
        } catch { /* frame not ready */ }
        await new Promise((r) => setTimeout(r, 200));
      }
    } catch (err) {
      note.textContent = err instanceof Error && err.name === 'NotAllowedError'
        ? 'Camera access was denied. Allow the camera for this app, or enter the code instead.'
        : `Camera unavailable (${errorMessage(err)}). Enter the code instead.`;
    }
  })();
  const v = await result;
  if (isDisposed()) return;
  if (v === 'paste') void pasteDialog();
  else if (typeof v === 'object' && v !== null && 'code' in v && typeof v.code === 'string') void doPair(v.code);
}

async function pasteDialog() {
  const { el, input } = textField('Pairing code or link', { attrs: { autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' } });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();   // else Enter would also "click" the next dialog's focused button
    closeDialog(input, input.value.trim());
  });
  const v = await dialog({
    title: 'Enter pairing code',
    content: [h('p', { class: 'body-2', text: 'Paste the pairing link or code shown by i6-share Hub on your computer.' }), el],
    actions: [{ label: 'Cancel', value: null }, { label: 'Pair', value: () => input.value.trim(), variant: 'contained' }],
  });
  if (typeof v === 'string' && v) void doPair(v);
}

// ---------------------------------------------------------------- settings

async function settingsDialog() {
  const { el: nameField, input } = textField('This device\'s name', { value: engine.deviceName, maxLength: 40 });
  const list = h('ul', { class: 'list settings__hubs' });
  const fill = () => render(list, engine.hubs.length
    ? engine.hubs.map((hub) => h('li', { class: 'list-item' },
      h('span', { class: 'list-item__icon' }, icon('computer')),
      h('span', { class: 'list-item__text' },
        h('span', { class: 'list-item__primary', text: hub.name }),
        h('span', { class: 'list-item__secondary', text: `Paired ${new Date(hub.rec.pairedAt || Date.now()).toLocaleDateString()}` })),
      button('Forget', async () => {
        const ok = await dialog({
          title: `Forget ${hub.name}?`,
          content: h('p', { text: 'You will need to scan its QR code again to send files to it.' }),
          actions: [{ label: 'Cancel', value: false }, { label: 'Forget', value: true, variant: 'contained' }],
        });
        if (ok !== true) return;
        await engine.forget(hub.id);
        snackbar(`Forgot ${hub.name}`);
        fill();
      })))
    : h('li', { class: 'list-item muted', text: 'No computers paired yet.' }));
  fill();
  const name = await dialog({
    title: 'Settings',
    content: [
      nameField,
      h('div', { class: 'settings__section' }, h('div', { class: 'list-subheader', text: 'Paired computers' }), list),
      h('p', { class: 'body-2' }, h('a', { href: './setup/', text: 'Set up a Linux PC' })),
      h('p', { class: 'caption muted', text: `i6-share ${APP_VERSION} · device ${engine.deviceId}` }),
    ],
    actions: [{ label: 'Close', value: null }, { label: 'Save', value: () => input.value, variant: 'contained' }],
  });
  if (typeof name === 'string') {
    await engine.setDeviceName(name);
    snackbar('Saved');
  }
}

// ---------------------------------------------------------------- local network access banner

let lnaStatus: PermissionStatus | null = null;
async function checkLna() {
  if (lnaStatus === null && 'permissions' in navigator) {
    for (const name of ['local-network-access', 'local-network'] as const) {
      try {
        lnaStatus = await queryLocalNetworkPermission(name);
        lnaStatus.addEventListener('change', () => { void checkLna(); engine.kick(); }, { signal: lifecycle.signal });
        break;
      } catch { /* unknown permission name */ }
    }
  }
  const s = lnaStatus?.state;
  const show = engine.hubs.length > 0 && (s === 'denied' || (read().blocked && s !== 'granted'));
  if (show !== read().showLna) { update({ showLna: show }); renderAll(); }
}

// ---------------------------------------------------------------- rendering

function lnaBanner() {
  return h('div', { class: 'banner banner--warning', attrs: { role: 'alert' } }, icon('wifi_off'),
    h('div', { class: 'grow' },
      h('p', { class: 'subtitle-2 banner__title', text: 'Allow local network access' }),
      h('p', { text: 'Chrome seems to block i6-share from reaching devices on your network. Open Chrome ⋮ → Settings → Site settings → Local network access (or tap the icon left of the address bar → Permissions) and allow it for krusegit.github.io. Then come back here.' }),
      h('div', { class: 'banner__actions' }, button('Retry now', () => { engine.kick(); }))));
}

function unpairedBanner() {
  return h('div', { class: 'banner banner--error', attrs: { role: 'alert' } }, icon('error'),
    h('div', { class: 'grow' },
      h('p', { class: 'subtitle-2 banner__title', text: `Pairing with ${String(read().unpaired)} was lost` }),
      h('p', { text: 'Scan the QR code on your computer again.' }),
      h('div', { class: 'banner__actions' },
        button('Scan QR code', scanDialog, 'text', 'qr_scan'),
        button('Dismiss', () => { update({ unpaired: null }); renderAll(); }))));
}

function thumb(file: File) {
  const ext = ((/\.([^.]{1,5})$/.exec(file.name))?.[1] ?? '').toUpperCase();
  const fileThumb = () => h('div', { class: 'thumb thumb--file', attrs: { title: file.name } }, icon('file'), ext && h('span', { class: 'thumb__ext', text: ext }));
  if (!isImage(file)) return fileThumb();
  // Formats the browser can't decode (e.g. HEIC) fall back to the file tile.
  const img: HTMLImageElement = h('img', { class: 'thumb', src: urlFor(file), alt: '', loading: 'lazy', decoding: 'async',
    onerror: () => { img.replaceWith(fileThumb()); } });
  return img;
}

function stagedCard() {
  const files = read().staged;
  const shown = files.slice(0, 12);
  const noHubs = !engine.hubs.length;
  return h('section', { class: 'card staged', attrs: { 'aria-label': 'Files to send' } },
    h('div', { class: 'card__header staged__header' },
      h('div', { class: 'grow' },
        h('h2', { class: 'card__title', text: `${plural(files.length, 'file')} · ${formatBytes(total(files))}` }),
        h('p', { class: 'card__subtitle', text: noHubs ? 'Pair your computer to send' : 'Tap a computer to send' })),
      iconButton('close', 'Clear', clearStaged)),
    h('div', { class: 'thumbs' }, shown.map(thumb),
      files.length > shown.length && h('div', { class: 'thumb thumb--more', text: `+${String(files.length - shown.length)}` })),
    files.length <= 4 && h('div', { class: 'chips' }, files.map((f) => h('span', { class: 'chip ellipsis', attrs: { title: f.name } },
      icon(isImage(f) ? 'image' : 'file'), h('span', { class: 'ellipsis', text: f.name })))));
}

function pairCard() {
  return h('section', { class: 'card card--accent' },
    h('div', { class: 'card__header' },
      h('h2', { class: 'card__title', text: 'Pair your computer' }),
      h('p', { class: 'card__subtitle', text: 'One-time setup – then it just sends' })),
    h('div', { class: 'card__body' },
      h('p', { text: 'Open i6-share Hub on your Linux PC and scan the QR code it shows. Your files are sent right after pairing.' }),
      h('p', { class: 'pair-card__setup' }, 'No hub yet? ', h('a', { href: './setup/', text: 'Set up a Linux PC' }))),
    h('div', { class: 'card__actions' },
      button('Enter code', pasteDialog),
      button('Scan QR code', scanDialog, 'contained', 'qr_scan')));
}

function hubLine(hub: PhoneHub): HubLine {
  const ts = activeTransfers(hub.id);
  const t = ts[0];
  if (t) {
    const pct = t.total ? Math.floor((t.sent / t.total) * 100) : 0;
    const more = ts.length > 1 ? ` · +${String(ts.length - 1)} queued` : '';
    let text: string;
    if (hub.status === 'online' && t.status === 'sending') text = `Sending ${String(pct)} %${t.rate > 0 ? ` · ${formatBytes(t.rate)}/s` : ''}`;
    else if (hub.status === 'offline') text = `Offline – will retry · ${String(pct)} %`;
    else text = `Connecting… · ${String(pct)} %`;
    return { text: text + more, dot: hub.status === 'online' ? 'on' : hub.status === 'offline' ? 'off' : 'busy', value: t.total ? t.sent / t.total : null, cancel: t.tid };
  }
  const inc = [...read().incoming.values()].find((i) => i.hubId === hub.id);
  if (inc) {
    const pct = inc.total ? Math.floor((inc.received / inc.total) * 100) : 0;
    return { text: `Receiving ${String(pct)} %`, dot: 'on', value: inc.total ? inc.received / inc.total : null };
  }
  const d = read().lastDone.get(hub.id);
  if (d && Date.now() - d.doneAt < DONE_SHOW_MS) {
    const text = d.status === 'done' ? 'Sent ✓'
      : d.status === 'partial' ? `Sent – ${plural(d.failed.length, 'file')} could not be read`
        : 'Cancelled';
    return { text, dot: hub.status === 'online' ? 'on' : 'busy', done: d.status === 'done' };
  }
  if (hub.status === 'online') return { text: 'Online', dot: 'on' };
  if (hub.status === 'searching') return { text: 'Searching…', dot: 'busy' };
  return { text: `Offline – will retry${hub.lastSeen ? ` · seen ${timeAgo(hub.lastSeen)}` : ''}`, dot: 'off' };
}

function updateRow(refs: RowRefs, hub: PhoneHub) {
  const line = hubLine(hub);
  refs.name.textContent = hub.name;
  refs.dot.className = `status-dot status-dot--${line.dot}`;
  refs.secondary.textContent = line.text;
  refs.secondary.classList.toggle('hub__done', line.done === true);
  if (line.value !== undefined) render(refs.bar, progress(line.value));
  else refs.bar.replaceChildren();
  refs.cancelTid = line.cancel ?? null;
  refs.cancel.classList.toggle('hidden', line.cancel === undefined);
}

function hubRow(hub: PhoneHub): RowRefs {
  const fields: Omit<RowRefs, 'cancel' | 'el'> = {
    name: h('span', { class: 'list-item__primary' }),
    dot: h('span', { class: 'status-dot' }),
    secondary: h('span', { class: 'list-item__secondary' }),
    bar: h('div', { class: 'hub__progress' }),
    cancelTid: null,
  };
  const cancel = iconButton('close', 'Cancel transfer', (e) => {
    e.stopPropagation();
    if (refs.cancelTid !== null) void engine.cancel(refs.cancelTid);
  });
  const go = () => { tapHub(hub.id); };
  const el = h('li', {
    class: 'list-item list-item--action hub',
    attrs: { role: 'button', tabindex: '0', 'aria-label': `Send to ${hub.name}` },
    onclick: go,
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } },
  },
  h('span', { class: 'list-item__icon list-item__icon--primary' }, icon('computer')),
  h('span', { class: 'list-item__text' }, fields.name, h('span', { class: 'row hub__status' }, fields.dot, fields.secondary), fields.bar),
  h('span', { class: 'list-item__meta' }, cancel));
  const refs: RowRefs = { ...fields, cancel, el };
  updateRow(refs, hub);
  return refs;
}

function computersCard() {
  const hubs = [...engine.hubs].sort((a, b) => a.name.localeCompare(b.name));
  rows = new Map(hubs.map((hub) => [hub.id, hubRow(hub)]));
  return h('section', { class: 'card' },
    h('div', { class: 'list-subheader', text: 'Computers' }),
    h('ul', { class: 'list computers' }, [...rows.values()].map((r) => r.el)),
    !read().staged.length && h('p', { class: 'caption muted computers__hint', text: 'Tap a computer to choose files to send.' }),
    h('div', { class: 'card__actions' }, button('Pair another computer', scanDialog, 'text', 'add')));
}

function receivedCard() {
  const canShare = (file: File) => 'canShare' in navigator && navigator.canShare({ files: [file] });
  return h('section', { class: 'card' },
    h('div', { class: 'list-subheader', text: 'Received' }),
    h('ul', { class: 'list' }, read().received.map(({ file, hubName, at }) => h('li', { class: 'list-item' },
      isImage(file)
        ? h('img', { class: 'list-item__thumb', src: urlFor(file), alt: '', loading: 'lazy', decoding: 'async' })
        : h('span', { class: 'list-item__icon' }, icon('file')),
      h('span', { class: 'list-item__text' },
        h('span', { class: 'list-item__primary', text: file.name }),
        h('span', { class: 'list-item__secondary', text: `${formatBytes(file.size)} · from ${hubName} · ${timeAgo(at)}` })),
      h('span', { class: 'list-item__meta' },
        canShare(file) && iconButton('share', 'Share', () => navigator.share({ files: [file], title: file.name }).catch(() => undefined)),
        iconButton('download', 'Save again', () => { downloadFile(file); }))))));
}

function emptyState() {
  return h('section', { class: 'empty' },
    h('div', { class: 'radar' }, icon('computer')),
    h('h2', { class: 'headline-6 empty__title', text: 'No computer paired yet' }),
    h('p', { class: 'body-2', text: 'i6-share sends files straight to your Linux PC over your own Wi-Fi – no cloud, no account. Open i6-share Hub on the PC and scan the QR code it shows.' }),
    button('Scan QR code', scanDialog, 'contained', 'qr_scan'),
    button('Enter pairing code', pasteDialog),
    h('a', { class: 'body-2', href: './setup/', text: 'Set up a Linux PC' }));
}

function renderAll() {
  const hubs = engine.hubs;
  const current = read();
  render(main,
    current.error !== null && h('div', { class: 'banner banner--error', attrs: { role: 'alert' } }, icon('error'), h('p', { class: 'grow', text: current.error })),
    read().showLna && lnaBanner(),
    read().unpaired !== null && unpairedBanner(),
    read().staged.length > 0 && stagedCard(),
    read().staged.length > 0 && !hubs.length && pairCard(),
    hubs.length > 0 && computersCard(),
    read().received.length > 0 && receivedCard(),
    !hubs.length && !read().staged.length && emptyState());
  if (!hubs.length) rows = new Map();
  updateConn();
}

let rafPending = new Set<string>();
let rafId = 0;
function scheduleRow(hubId: string) {
  if (isDisposed()) return;
  rafPending.add(hubId);
  rafId ||= requestAnimationFrame(() => {
    rafId = 0;
    for (const id of rafPending) {
      const refs = rows.get(id);
      const hub = engine.hub(id);
      if (refs && hub) updateRow(refs, hub);
    }
    rafPending = new Set();
    updateConn();
  });
}

function updateConn() {
  const hubs = engine.hubs;
  if (!hubs.length) { conn.classList.add('hidden'); return; }
  const on = hubs.filter((x) => x.status === 'online').length;
  const [cls, text] = !navigator.onLine ? ['off', 'No network']
    : on ? ['on', hubs.length > 1 ? `${String(on)}/${String(hubs.length)} online` : 'Online']
      : hubs.some((x) => x.status === 'searching') ? ['busy', 'Searching…'] : ['off', 'Offline'];
  render(conn, h('span', { class: `status-dot status-dot--${cls}` }), h('span', { text }));
  conn.classList.remove('hidden');
}

// ---------------------------------------------------------------- engine events

listen('hubs', () => { renderAll(); void checkLna(); });
listen('status', (e) => { scheduleRow(e.detail.hubId); });
listen('transfer', (e) => {
  const t = e.detail;
  if (!ACTIVE.has(t.status)) {
    update({ lastDone: new Map([...read().lastDone, [t.hubId, t]]) });
    const hubName = engine.hub(t.hubId)?.name ?? 'computer';
    if (t.status === 'done') snackbar(`Sent ${plural(t.names.length, 'file')} to ${hubName}`);
    if (t.status === 'partial') snackbar(`${plural(t.failed.length, 'file')} could not be read and ${t.failed.length === 1 ? 'was' : 'were'} skipped`);
    const timer = setTimeout(() => { completionTimers.delete(timer); scheduleRow(t.hubId); }, DONE_SHOW_MS + 500);
    completionTimers.add(timer);
  }
  scheduleRow(t.hubId);
});
listen('incoming', (e) => {
  const inc = e.detail;
  update({ incoming: inc.status === 'done' ? new Map([...read().incoming].filter(([tid]) => tid !== inc.tid)) : new Map([...read().incoming, [inc.tid, inc]]) });
  scheduleRow(inc.hubId);
});
listen('file', (e) => {
  const { file, hubName } = e.detail;
  downloadFile(file);
  const received = [{ file, hubName, at: Date.now() }, ...read().received];
  update({ received: received.slice(0, 30) });
  revoke(received.slice(30).map((record) => record.file));
  snackbar(`Received ${file.name}`);
  renderAll();
});
listen('unpaired', (e) => {
  update({ unpaired: e.detail.name });
  if (e.detail.files.length) void setStaged([...read().staged, ...e.detail.files]);
  else renderAll();
});
listen('network', (e) => { update({ blocked: e.detail.blocked }); void checkLna(); });
listen('busy', (e) => { setWake(e.detail.busy); });
listen('warning', (e) => { console.warn(e.detail.message); });

// ---------------------------------------------------------------- start

async function start() {
  render(requireElement('bar-actions'), iconButton('settings', 'Settings', settingsDialog));
  document.body.append(
    h('button', { class: 'fab fab--extended', attrs: { 'aria-label': 'Send files' }, onclick: () => { pick(null); } },
      icon('attach'), h('span', { text: 'Send files' })),
    fileInput);
  const loadBuild = options.loadBuild ?? (() => import('./build-info.js').then(({ BUILD }) => BUILD));
  void loadBuild().catch(() => ({ version: APP_VERSION })).then((build) => { if (!isDisposed()) document.body.append(buildBadge({ ...build, version: build.version ?? APP_VERSION })); });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { type: 'module', scope: './' }).catch((err: unknown) => { console.warn('service worker', err); });
  }
  void persist();

  try {
    const staged: unknown = await kv.get('staged');
    if (Array.isArray(staged)) update({ staged: Array.from<unknown>(staged).filter((item: unknown): item is File => item instanceof File) });
  } catch { /* no IndexedDB */ }
  if (new URLSearchParams(location.search).has('share')) history.replaceState(null, '', location.pathname + location.hash);

  try {
    await engine.init({ visible: document.visibilityState === 'visible' });
  } catch (err) {
    update({ error: `Storage is unavailable (${errorMessage(err)}). Pairings can't be saved in this browser mode.` });
  }
  renderAll();
  void checkLna();

  addEventListener('online', () => { engine.kick(); updateConn(); }, { signal: lifecycle.signal });
  addEventListener('offline', updateConn, { signal: lifecycle.signal });
  document.addEventListener('visibilitychange', () => { engine.setVisible(document.visibilityState === 'visible'); }, { signal: lifecycle.signal });
  addEventListener('hashchange', handleHash, { signal: lifecycle.signal });
  handleHash();
  // Refresh "seen 5 min ago" texts now and then.
  const refreshTimer = setInterval(() => { if (document.visibilityState === 'visible') for (const id of rows.keys()) scheduleRow(id); }, 30000);
  listeners.push(() => { clearInterval(refreshTimer); });
}

await Effect.runPromise(Effect.tryPromise(start));
return { stage: setStaged, pair: doPair, scan: scanDialog, enterCode: pasteDialog, settings: settingsDialog, dispose: () => {
  lifecycle.abort();
  listeners.forEach((dispose) => { dispose(); });
  cancelAnimationFrame(rafId);
  revoke([...urls.keys()]);
  setWake.dispose();
  completionTimers.forEach((timer) => { clearTimeout(timer); });
  completionTimers.clear();
  engine.stop();
} };
};
