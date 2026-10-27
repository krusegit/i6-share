import { Effect, Exit, Ref, Schema, Scope } from 'effect';
import type * as QrModule from './qr.js';
import type * as BuildModule from '../public/build-info.js';
import type { HubEvents } from './api-types.js';
import type { Child } from '../public/lib/dom.js';
// i6-share Hub (Isolated Web App): UI + wiring of the HTTP server, protocol and file sink.

import { PORT, APP_URL } from '../public/lib/proto.js';
import {
  h, render, icon, iconButton, button, progress, snackbar, dialog, textField, codeBlock,
  formatBytes, timeAgo, buildBadge,
} from '../public/lib/dom.js';
import { store, persist } from '../public/lib/store.js';
import { startServer } from './http.js';
import { createHubApi, ONLINE_MS } from './api.js';
import { createAddressBook } from './net.js';
import { createFolderSink } from './sink.js';
import { checkForUpdate, compareVersions } from './update-check.js';

const SETUP_URL = APP_URL + 'setup/';
const INSTALL_CMD = `curl -fsSL ${APP_URL}install.sh | bash`;
const RECEIVED_KEY = 'received';
const RECEIVED_MAX = 100;
const UPDATE_CHECK_MS = 6 * 60 * 60 * 1000;
const DISMISSED_UPDATE_KEY = 'dismissedUpdate';
type HubApi = ReturnType<typeof createHubApi>;
type FolderSink = ReturnType<typeof createFolderSink>;
type AddressBook = ReturnType<typeof createAddressBook>;
type HubServer = ReturnType<typeof startServer>;
type Store = ReturnType<typeof store>;
const receivedSchema = Schema.Struct({ name: Schema.String, size: Schema.Number, type: Schema.String, from: Schema.String, at: Schema.Number, where: Schema.NullOr(Schema.String), tid: Schema.String });
type Received = typeof receivedSchema.Type;
interface MountOptions { readonly api: HubApi; readonly server: HubServer; readonly addrs: AddressBook; readonly sink: FolderSink; readonly kv: Store; readonly received: { list: Received[] } }
const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);
const createUiLifetime = () => {
  const scope = Scope.makeUnsafe();
  const active = Ref.makeUnsafe(true);
  const defer = (effect: Effect.Effect<unknown>): void => { Effect.runSync(Scope.addFinalizer(scope, effect)); };
  return {
    active: (): boolean => Effect.runSync(Ref.get(active)),
    defer,
    cleanup: (release: () => void): void => { defer(Effect.sync(release)); },
    dispose: (): Promise<void> => Effect.runPromise(Effect.gen(function* () {
      yield* Ref.set(active, false);
      yield* Scope.close(scope, Exit.succeed(undefined));
    })),
  };
};
export interface HubUiOptions {
  readonly loadQr?: () => Promise<typeof QrModule>;
  readonly loadBuild?: () => Promise<typeof BuildModule>;
  readonly holdLock?: () => Promise<void>;
}
export function createHubUi(app: HTMLElement, options: HubUiOptions = {}) {
const lifetime = createUiLifetime();
const held = Promise.withResolvers<undefined>();
lifetime.cleanup(() => { held.resolve(undefined); });
const dispose = lifetime.dispose;
const lockController = new AbortController();
lifetime.cleanup(() => { lockController.abort(); });



// The QR module is written separately; load it lazily so a problem there never blocks the hub.
let qrModule: Promise<typeof QrModule | null> | undefined;
const loadBuild = () => (options.loadBuild ?? (() => import('../public/build-info.js')))().catch(() => ({ BUILD: { version: null, commit: 'dev', committedAt: null, builtAt: null } }));
const loadQr = () => (qrModule ??= (options.loadQr ?? (() => import('./qr.js')))().catch((e: unknown) => { console.warn('QR module unavailable', e); return null; }));

const hostPort = (addr: string | undefined) => (addr !== undefined && addr !== '' ? `${addr.includes(':') ? `[${addr}]` : addr}:${String(PORT)}` : `port ${String(PORT)}`);

function appBar(...extra: Child[]) {
  return h('header', { class: 'app-bar' }, h('h1', { class: 'app-bar__title', text: 'i6-share Hub' }), extra);
}

// ------------------------------------------------------------------ not an IWA

function renderNotIwa() {
  render(app,
    appBar(),
    h('main', { class: 'content' },
      h('section', { class: 'card card--accent' },
        h('div', { class: 'card__header' },
          h('h2', { class: 'card__title', text: 'Install the hub as an app' }),
          h('p', { class: 'card__subtitle', text: 'This page only works as the installed “i6-share Hub” app.' })),
        h('div', { class: 'card__body hub-prose' },
          h('p', { text: 'The hub receives files from your phone over the local network. To do that it needs Chrome’s Direct Sockets API, which is only available to an installed Isolated Web App, not to a normal browser tab.' }),
          h('p', { text: 'The setup guide walks you through installing it on this Linux computer in a few minutes.' })),
        h('div', { class: 'card__actions' },
          h('a', { class: 'btn btn--contained', href: SETUP_URL, target: '_blank', rel: 'noopener' },
            icon('open_in_new'), h('span', { text: 'Open setup guide' }))))));
}

// ------------------------------------------------------------------ onboarding

function onboarding({ kv, sink }: { readonly kv: Store; readonly sink: FolderSink }) {
  return new Promise<void>((resolve) => {
    lifetime.cleanup(resolve);
    const onboardingState = Ref.makeUnsafe<{ readonly step: number; readonly name: string }>({ step: 0, name: 'Linux PC' });
    const readOnboarding = () => Effect.runSync(Ref.get(onboardingState));
    const navigate = (step: number): void => { Effect.runSync(Ref.update(onboardingState, (state) => ({ ...state, step }))); };
    const main = h('main', { class: 'content onboarding' });
    render(app, appBar(), main);

    const stepCard = (title: string, subtitle: string, body: Child, actions: Child) => h('section', { class: 'card card--accent' },
      h('div', { class: 'card__header' },
        h('p', { class: 'overline muted', text: `Step ${String(readOnboarding().step + 1)} of 3` }),
        h('h2', { class: 'card__title', text: title }),
        subtitle && h('p', { class: 'card__subtitle', text: subtitle })),
      h('div', { class: 'card__body hub-prose' }, body),
      h('div', { class: 'card__actions' }, actions));

    const show = () => {
      if (readOnboarding().step === 0) {
        const f = textField('Computer name', { value: readOnboarding().name, maxLength: 40, autocomplete: 'off' });
        const next = () => { Effect.runSync(Ref.set(onboardingState, { name: f.input.value.trim() || 'Linux PC', step: 1 })); show(); };
        f.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') next(); });
        render(main, stepCard('Welcome to i6-share Hub', 'Name this computer – your phone will show this name.',
          [f.el], [button('Next', next, 'contained')]));
        f.input.focus();
        f.input.select();
      } else if (readOnboarding().step === 1) {
        const where = h('p', { class: 'row' }, icon('folder'),
          h('span', { text: (sink.folderName ?? "") ? `Saving to the “${String(sink.folderName)}” folder` : 'Saving to your Downloads folder (browser downloads)' }));
        const choose = async () => {
          try { await sink.pick(); } catch (e) { snackbar(`Could not use that folder: ${errorMessage(e)}`); }
          show();
        };
        render(main, stepCard('Where should received files go?',
          'Files from your phone are saved automatically – no prompts.',
          [where,
            !sink.supported && h('p', { text: 'Folder access isn’t available here, so files will be downloaded.' })],
          [button('Back', () => { navigate(0); show(); }),
            sink.supported && button((sink.folderName ?? "") ? 'Change folder' : 'Choose folder', choose, 'outlined', 'folder'),
            (sink.folderName ?? "") && button('Use Downloads', async () => { await sink.useDownloads(); show(); }),
            button('Next', () => { navigate(2); show(); }, 'contained')]));
      } else {
        render(main, stepCard('Let your phone reach this computer',
          `Phones connect to this computer on TCP port ${String(PORT)}. Debian 13 has no firewall rules by default – check with:`,
          [codeBlock('sudo nft list ruleset'),
            h('p', { text: 'Empty output means nothing blocks the port: skip this step. Otherwise allow the port once:' }),
            h('p', { class: 'subtitle-2', text: 'nftables (Debian’s default)' }),
            codeBlock(`sudo nft insert rule inet filter input tcp dport ${String(PORT)} accept`),
            h('p', { class: 'subtitle-2', text: 'iptables' }),
            codeBlock(`sudo iptables -I INPUT -p tcp --dport ${String(PORT)} -j ACCEPT && sudo ip6tables -I INPUT -p tcp --dport ${String(PORT)} -j ACCEPT`),
            h('p', { text: `These last until reboot. To keep it, add “tcp dport ${String(PORT)} accept” to the input chain in /etc/nftables.conf.` })],
          [button('Back', () => { navigate(1); show(); }),
            button('Finish', async () => {
              // Ask for notifications but don't wait: an unanswered prompt must not block setup.
              if (typeof Notification !== 'undefined' && globalThis.Notification.permission === 'default') Notification.requestPermission().catch(() => undefined);
              await kv.put('hubName', readOnboarding().name);
              await kv.put('onboarded', true);
              resolve();
            }, 'contained')]));
      }
    };
    show();
  });
}

// ------------------------------------------------------------------ main

async function main() {
  void persist();
  const storage = { kv: store('kv'), devices: store('devices'), queue: store('queue') };
  const kv = storage.kv;
  const sink = createFolderSink({ kv });
  await sink.init();
  if (!lifetime.active()) return;
  const onboarded = await kv.get('onboarded');
  if (!lifetime.active()) return;
  if (onboarded !== true) await onboarding({ kv, sink });
  if (!lifetime.active()) return;

  const addrs = createAddressBook({ kv });
  lifetime.cleanup(addrs.dispose);
  await addrs.init();
  if (!lifetime.active()) { addrs.dispose(); return; }
  const api = createHubApi({ storage, sink, getAddrs: () => addrs.addrs });
  lifetime.cleanup(api.dispose);
  await api.init();
  if (!lifetime.active()) { api.dispose(); return; }
  const server = startServer({
    port: PORT,
    handler: (req) => { addrs.observe(req.localAddress); return api.handle(req); },
  });
  lifetime.cleanup(server.close);
  const connectionError = (event: Event): void => { console.debug('connection error', event); };
  server.addEventListener('connection-error', connectionError);
  lifetime.cleanup(() => { server.removeEventListener('connection-error', connectionError); });
  lifetime.cleanup(api.on('error', (detail) => { console.warn('hub error', detail.error); }));

  const received = await Effect.runPromise(Effect.tryPromise(() => kv.get(RECEIVED_KEY)).pipe(
    Effect.map((value) => {
      const parsed = Schema.decodeUnknownOption(Schema.Array(receivedSchema))(value);
      return { list: parsed._tag === 'Some' ? [...parsed.value] : [] };
    }),
    Effect.catch(() => Effect.succeed({ list: [] })),
  ));

  if (!lifetime.active()) return;
  mountUi({ api, server, addrs, sink, kv, received });
}

function mountUi({ api, server, addrs, sink, kv, received }: MountOptions) {
  const mounted = createUiLifetime();
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  lifetime.defer(Effect.promise(mounted.dispose));
  const onApi = <K extends keyof HubEvents>(type: K, listener: (detail: HubEvents[K]) => void): void => { mounted.cleanup(api.on(type, listener)); };
  const onTarget = (target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>, type: string, listener: () => void): void => {
    target.addEventListener(type, listener);
    mounted.cleanup(() => { target.removeEventListener(type, listener); });
  };
  const onWindow = <K extends keyof WindowEventMap>(type: K, listener: (event: WindowEventMap[K]) => void): void => {
    window.addEventListener(type, listener);
    mounted.cleanup(() => { window.removeEventListener(type, listener); });
  };
  const interval = (callback: () => void, milliseconds: number): void => {
    const timer = setInterval(callback, milliseconds);
    mounted.cleanup(() => { clearInterval(timer); });
  };
  const objectUrls = new Map<string, ReturnType<typeof setTimeout>>();

  const devices = () => new Map(api.listDevices().map((device) => [device.deviceId, device]));
  interface Model {
    readonly received: readonly Received[];
    readonly sinkError: { readonly name: string; readonly message: string } | null;
    readonly update: { readonly current: string | null; readonly latest: string | null; readonly dismissed: string | null };
    readonly checking: boolean;
    readonly code: ReturnType<HubApi['newPairCode']> | null;
    readonly pairOpen: boolean;
  }
  const stateRef = Ref.makeUnsafe<Model>({ received: [...received.list], sinkError: null, update: { current: null, latest: null, dismissed: null }, checking: false, code: null, pairOpen: devices().size === 0 });
  const snapshot = (): Model => Effect.runSync(Ref.get(stateRef));
  const change = (transition: (state: Model) => Model): void => { Effect.runSync(Ref.update(stateRef, transition)); };
  mounted.defer(Effect.suspend(() => saveTimer === undefined
    ? Effect.succeed(undefined)
    : Effect.tryPromise(() => kv.put(RECEIVED_KEY, snapshot().received)).pipe(Effect.catch(() => Effect.succeed(undefined)))));

  // ---------------------------------------------------------------- app bar + layout
  const statusDot = h('span', { class: 'status-dot status-dot--busy' });
  const statusText = h('span', { class: 'ellipsis', text: 'Starting…' });
  const bar = appBar(
    h('div', { class: 'status hub-status', attrs: { role: 'status' } }, statusDot, statusText),
    iconButton('settings', 'Settings', () => openSettings()));
  const banners = h('div', { class: 'hub-banners' });
  const pairSection = h('section', { class: 'card hub-pair' });
  const phonesList = h('ul', { class: 'list' });
  const receivedList = h('ul', { class: 'list' });
  const receivedActions = h('div', { class: 'card__actions' });
  render(app, bar, h('main', { class: 'content hub-content' },
    banners,
    pairSection,
    h('section', { class: 'card' },
      h('div', { class: 'card__header' }, h('h2', { class: 'card__title', text: 'Phones' })),
      phonesList),
    h('section', { class: 'card' },
      h('div', { class: 'card__header' }, h('h2', { class: 'card__title', text: 'Received' })),
      receivedList, receivedActions)));

  // ---------------------------------------------------------------- status
  function updateStatus() {
    const s = server.state;
    const primary = addrs.addrs[0];
    if (s.status === 'listening') {
      statusDot.className = 'status-dot status-dot--on';
      statusText.textContent = `Listening on ${hostPort(primary)}`;
      bar.title = addrs.addrs.length ? `Reachable at ${addrs.addrs.map(hostPort).join(', ')}` : '';
    } else if (s.status === 'error') {
      const secs = (s.retryAt != null) ? Math.max(0, Math.ceil((s.retryAt - Date.now()) / 1000)) : 0;
      statusDot.className = 'status-dot status-dot--off';
      statusText.textContent = `Not listening – retrying in ${String(secs)} s`;
      bar.title = (s.error ?? "") || '';
    } else {
      statusDot.className = 'status-dot status-dot--busy';
      statusText.textContent = 'Starting…';
    }
  }

  // ---------------------------------------------------------------- banners
  function renderBanners() {
    const { sinkError, update } = snapshot();
    const s = server.state;
    const items: Child[] = [];
    if (s.status === 'error') {
      items.push(banner('error', [
        h('strong', { text: `Can’t listen on port ${String(PORT)}. ` }),
        `${(s.error ?? "") || 'Unknown error'}. Another program (or a second hub window) may be using the port. Retrying automatically.`,
      ], button('Retry now', () => { server.restart(); })));
    }
    if (sink.dir && sink.state !== 'granted') {
      items.push(banner('warning',
        `Allow access to the “${String(sink.folderName)}” folder so received files are saved there. Until then they go to Downloads.`,
        button('Allow', async () => { await sink.requestPermission(); if (sink.state !== 'granted') snackbar('Access not granted – choose the folder again in Settings'); })));
    }
    if (!addrs.addrs.length) {
      items.push(banner('warning',
        'Couldn’t detect this computer’s local network address, so phones may not find it. Check the network connection or add the address in Settings.',
        button('Settings', () => openSettings())));
    }
    if (sinkError) {
      items.push(banner('error', `Couldn’t save “${sinkError.name}”: ${sinkError.message}. The phone will retry.`,
        button('Dismiss', () => { change((state) => ({ ...state, sinkError: null })); renderBanners(); })));
    }
    if (update.latest !== null && !(update.dismissed !== null && compareVersions(update.latest, update.dismissed) <= 0)) {
      items.push(banner('update', [
        h('strong', { text: `i6-share Hub ${update.latest} is available` }),
        ` (you have ${String(update.current)}).`,
      ], h('div', { class: 'hub-banner__actions' },
        button('Dismiss', () => dismissUpdate()),
        button('How to update', () => howToUpdate(), 'outlined'))));
    }
    render(banners, items);
  }
  const BANNER_ICONS = { error: 'error', warning: 'warning', update: 'info' };
  const banner = (kind: keyof typeof BANNER_ICONS, text: Child, action: Child) => h('div', { class: `banner banner--${kind}` },
    icon(BANNER_ICONS[kind]),
    h('div', { class: 'grow' }, h('p', {}, text)),
    action);

  // ---------------------------------------------------------------- update check
  // Offline is normal on a LAN-only setup: failures are silent and never block anything.
  async function runUpdateCheck() {
    if (snapshot().checking) return;
    change((state) => ({ ...state, checking: true }));
    try {
      const current = snapshot().update.current ?? (((await loadBuild()).BUILD.version ?? '') || null);
      if (!mounted.active()) return;
      change((state) => ({ ...state, update: { ...state.update, current } }));
      if (current === null) return;
      const result = await checkForUpdate({ current });
      if (!mounted.active()) return;
      console.debug('[i6] update check', result ? `latest ${result.latest}, running ${current}` : 'unavailable');
      if (!result) return;
      const dismissed: unknown = await kv.get(DISMISSED_UPDATE_KEY).catch(() => null);
      if (!mounted.active()) return;
      const latest = result.available ? result.latest : null;
      const changed = latest !== snapshot().update.latest;
      change((state) => ({ ...state, update: { ...state.update, dismissed: typeof dismissed === 'string' ? dismissed : null, latest } }));
      if (changed) renderBanners();
    } finally {
      change((state) => ({ ...state, checking: false }));
    }
  }
  async function dismissUpdate() {
    const latest = snapshot().update.latest;
    change((state) => ({ ...state, update: { ...state.update, dismissed: latest } }));
    renderBanners();
    await kv.put(DISMISSED_UPDATE_KEY, latest).catch(() => undefined);
  }

  async function howToUpdate() {
    const modern = { url: 'chrome://iwa-dev', note: 'Chrome 154 and newer', button: 'Update' };
    const older = { url: 'chrome://web-app-internals', note: 'Chrome 153 and older', button: 'Perform update now' };
    const major = chromeMajor();
    const useOlder = major !== null && major < 154;
    const page = useOlder ? older : modern;
    const other = useOlder ? modern : older;
    await dialog({
      title: `Update to i6-share Hub ${String(snapshot().update.latest)}`,
      content: [
        h('div', { class: 'hub-setting hub-update-cmd' },
          h('p', { class: 'subtitle-2', text: 'Run the installer again in a terminal:' }),
          codeBlock(INSTALL_CMD),
          h('p', { text: 'It closes Chrome, installs the new version, keeps your pairings and settings, and reopens the hub.' })),
        h('details', { class: 'hub-details' },
          h('summary', { text: 'Installed from the update link instead?' }),
          h('div', { class: 'hub-details__body' },
            h('p', { text: 'Chrome updates the hub automatically within a few hours. The update is applied once the hub window is closed. To update right away:' }),
            h('ol', { class: 'hub-steps' },
              h('li', {}, `Copy this address (${page.note}):`, codeBlock(page.url),
                h('span', { class: 'caption muted', text: `${other.note}: ${other.url}` })),
              h('li', { text: 'Close this hub window.' }),
              h('li', {}, 'Paste the address into Chrome’s address bar, find ', h('strong', { text: 'i6-share Hub' }),
                ' and click ', h('strong', { text: page.button }), '.'),
              h('li', { text: 'Reopen the hub.' })))),
      ],
      actions: [{ label: 'Close', value: true }],
    });
  }

  onTarget(server, 'state', () => { updateStatus(); renderBanners(); });
  onTarget(sink, 'change', () => { renderBanners(); });
  onApi('sink-error', (detail) => {
    change((state) => ({ ...state, sinkError: { name: detail.name, message: errorMessage(detail.error) } }));
    renderBanners();
  });

  // ---------------------------------------------------------------- pairing card
  const qrCanvas = h('canvas', { class: 'qr', attrs: { role: 'img', 'aria-label': 'Pairing QR code' } });
  const qrFallback = h('p', { class: 'caption muted hidden', text: 'QR code unavailable – use the link below.' });
  const linkBox = h('div');
  const expiry = h('span', { class: 'caption muted' });

  async function newCode() {
    const result = Effect.runSync(Effect.result(Effect.try(() => api.newPairCode())));
    if (result._tag === 'Failure') { console.warn(result.failure); return; }
    const code = result.success;
    change((state) => ({ ...state, code }));
    render(linkBox, codeBlock(code.link));
    updateExpiry();
    const mod = await loadQr();
    if (!mounted.active()) return;
    try {
      if (!mod?.drawQr) throw new Error('drawQr missing');
      mod.drawQr(qrCanvas, code.link, { scale: 8, margin: 4 });
      qrCanvas.classList.remove('hidden');
      qrFallback.classList.add('hidden');
    } catch (e) {
      if (mod) console.warn('QR render failed', e);
      qrCanvas.classList.add('hidden');
      qrFallback.classList.remove('hidden');
    }
  }

  function updateExpiry() {
    const { code, pairOpen } = snapshot();
    if (!code || !pairOpen) return;
    const left = code.expiresAt - Date.now();
    if (left <= 0) { void newCode(); return; }
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    expiry.textContent = `Code valid for ${String(m)}:${String(s).padStart(2, '0')} · single use`;
  }

  function renderPair() {
    const { pairOpen } = snapshot();
    pairSection.classList.toggle('card--accent', pairOpen);
    if (!pairOpen) {
      change((state) => ({ ...state, code: null }));
      render(pairSection, h('div', { class: 'hub-pair__collapsed' },
        h('div', { class: 'list-item__icon' }, icon('qr')),
        h('div', { class: 'grow' },
          h('p', { class: 'subtitle-1', text: 'Pair another phone' }),
          h('p', { class: 'body-2 muted', text: 'Show a QR code to scan with the i6-share app.' })),
        button('Show code', () => { change((state) => ({ ...state, pairOpen: true })); renderPair(); }, 'outlined', 'qr')));
      return;
    }
    render(pairSection,
      h('div', { class: 'card__header' },
        h('h2', { class: 'card__title', text: 'Pair a phone' }),
        h('p', { class: 'card__subtitle', text: 'One time only – afterwards files are accepted automatically.' })),
      h('div', { class: 'hub-pair__grid' },
        h('div', { class: 'hub-pair__qr' }, qrCanvas, qrFallback, expiry),
        h('div', { class: 'hub-pair__steps body-2' },
          h('ol', {},
            h('li', {}, 'On your phone open ', h('strong', { text: 'krusegit.github.io/i6-share' }), ' in Chrome and install it (“Add to Home screen”).'),
            h('li', { text: 'Scan this code with the app – or just with the camera app.' }),
            h('li', { text: 'Make sure the phone is on the same Wi-Fi as this computer.' })),
          h('p', { class: 'muted', text: 'No camera? Copy this link to the phone:' }),
          linkBox)),
      h('div', { class: 'card__actions' },
        devices().size > 0 && button('Hide', () => { change((state) => ({ ...state, pairOpen: false })); renderPair(); }),
        button('New code', () => newCode(), 'text', 'refresh')));
    void newCode();
  }

  onApi('pair-code-used', (detail) => {
    snackbar(`Paired with ${detail.name}`);
    change((state) => ({ ...state, pairOpen: false }));
    renderPair();
  });
  onTarget(addrs, 'change', () => { updateStatus(); renderBanners(); if (snapshot().pairOpen) void newCode(); });

  // ---------------------------------------------------------------- phones
  const rows = new Map<string, { readonly li: HTMLLIElement; readonly status: HTMLSpanElement; readonly activity: HTMLDivElement }>(); // deviceId → {li, status, activity}
  let fileInput: HTMLInputElement | null = null;

  function pickAndSend(deviceId: string) {
    fileInput?.remove();
    const input = h('input', { type: 'file', multiple: true, class: 'hidden' });
    fileInput = input;
    input.addEventListener('change', () => {
      const files = Array.from(input.files ?? []);
      input.remove();
      fileInput = null;
      if (files.length) void sendFiles(deviceId, files);
    });
    document.body.append(fileInput);
    fileInput.click();
  }

  async function sendFiles(deviceId: string, files: readonly File[]) {
    const dev = devices().get(deviceId);
    if (!dev || !files.length) return;
    try {
      await api.sendToDevice(deviceId, files);
      const n = files.length;
      snackbar(`${n === 1 ? `“${String(files[0]?.name)}”` : `${String(n)} files`} will be sent to ${dev.name}${api.isOnline(deviceId) ? '' : ' when it’s online'}`);
    } catch (e) {
      snackbar(`Couldn’t queue files: ${errorMessage(e)}`);
    }
  }

  function droppedFiles(e: DragEvent) {
    const items = [...(e.dataTransfer?.items ?? [])];
    const dirs = items.filter((it) => (it.kind === 'file' && it.webkitGetAsEntry()?.isDirectory) ?? false).length;
    if (dirs) snackbar('Folders can’t be sent – drop the files inside instead');
    const files = [...(e.dataTransfer?.files ?? [])];
    return dirs ? files.filter((_, i) => !((items[i]?.webkitGetAsEntry()?.isDirectory) ?? false)) : files;
  }

  async function forget(deviceId: string) {
    const dev = devices().get(deviceId);
    if (!dev) return;
    const ok = await dialog({
      title: `Forget ${dev.name}?`,
      content: h('p', { text: 'It will no longer be able to send or receive files until it scans a new pairing code. Files waiting to be sent to it are discarded.' }),
      actions: [{ label: 'Cancel', value: false }, { label: 'Forget', value: true, variant: 'contained' }],
    });
    if (ok === true) {
      await api.forgetDevice(deviceId);
      snackbar(`${dev.name} forgotten`);
    }
  }

  function renderPhones() {
    rows.clear();
    const devs = api.listDevices();
    if (!devs.length) {
      render(phonesList, h('li', { class: 'empty' },
        h('div', { class: 'radar' }, icon('phone')),
        h('p', { text: 'No phones paired yet. Scan the code above with your phone.' })));
      return;
    }
    render(phonesList, devs.map((d) => {
      const status = h('span', { class: 'list-item__secondary row hub-phone__status' });
      const activity = h('div', { class: 'hub-phone__activity' });
      const li = h('li', { class: 'list-item hub-phone', attrs: { 'data-device': d.deviceId } },
        h('div', { class: 'list-item__icon list-item__icon--primary' }, icon('phone')),
        h('div', { class: 'list-item__text' },
          h('span', { class: 'list-item__primary', text: d.name }),
          status, activity),
        h('div', { class: 'list-item__meta' },
          iconButton('send', `Send files to ${d.name}`, () => { pickAndSend(d.deviceId); }),
          iconButton('delete', `Forget ${d.name}`, () => forget(d.deviceId))));
      let depth = 0;
      li.addEventListener('dragenter', (e) => { if (hasFiles(e)) { depth++; li.classList.add('list-item--drop', 'hub-drop'); } });
      li.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; li.classList.remove('list-item--drop', 'hub-drop'); } });
      li.addEventListener('dragover', (e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        depth = 0;
        li.classList.remove('list-item--drop', 'hub-drop');
        void sendFiles(d.deviceId, droppedFiles(e));
      });
      rows.set(d.deviceId, { li, status, activity });
      updateRow(d.deviceId);
      return li;
    }));
  }

  function updateRow(deviceId: string) {
    const row = rows.get(deviceId);
    const d = devices().get(deviceId);
    if (!row || !d) return;
    const online = Date.now() - (d.lastSeen || 0) < ONLINE_MS;
    render(row.status,
      h('span', { class: `status-dot${online ? ' status-dot--on' : ''}` }),
      h('span', { class: 'ellipsis', text: [online ? 'Online' : d.lastSeen ? `Last seen ${timeAgo(d.lastSeen)}` : 'Not seen yet', d.os].filter(Boolean).join(' · ') }));

    const parts: Child[] = [];
    for (const t of api.transfersFor(deviceId)) {
      if (t.complete) continue;
      const pct = t.total ? Math.floor((t.bytes / t.total) * 100) : 0;
      parts.push(h('div', { class: 'hub-activity' },
        h('span', { class: 'caption', text: [
          `Receiving ${t.count === 1 ? `“${String(t.files[0]?.name)}”` : `${String(t.done)}/${String(t.count)} files`}`,
          `${formatBytes(t.bytes)} of ${formatBytes(t.total)}`, `${String(pct)}%`,
          t.speed && Date.now() - t.lastActivity < 5000 ? `${formatBytes(t.speed)}/s` : (Date.now() - t.lastActivity > 15000 ? 'paused' : ''),
        ].filter(Boolean).join(' · ') }),
        progress(t.total ? t.bytes / t.total : null)));
    }
    for (const q of api.outboxFor(deviceId)) {
      const label = q.count === 1 ? `“${String(q.files[0]?.name)}”` : `${String(q.count)} files`;
      parts.push(h('div', { class: 'hub-activity' },
        h('div', { class: 'row' },
          h('span', { class: 'caption grow ellipsis', text: q.started
            ? [`Sending ${label}`, `${formatBytes(q.bytes)} of ${formatBytes(q.total)}`, q.total ? `${String(Math.floor((q.bytes / q.total) * 100))}%` : '', q.speed ? `${formatBytes(q.speed)}/s` : ''].filter(Boolean).join(' · ')
            : `Sending ${label} (${formatBytes(q.total)}) – ${online ? 'starting…' : 'waiting for the phone'}` }),
          h('button', { class: 'btn btn--text hub-small-btn', text: 'Cancel', onclick: () => api.cancelOutbox(q.tid) })),
        q.started ? progress(q.total ? q.bytes / q.total : 1) : progress(online ? null : 0)));
    }
    render(row.activity, parts);
  }

  // Coalesce frequent progress events into ≤ 4 row updates per second.
  const pending = new Set<string>();
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleRow = (deviceId: string) => {
    pending.add(deviceId);
    flushTimer ??= setTimeout(() => { flushTimer = undefined; for (const id of pending) updateRow(id); pending.clear(); }, 250);
  };

  const deviceEvents: readonly (keyof HubEvents)[] = ['device-paired', 'device-unpaired', 'device-updated'];
  for (const type of deviceEvents) {
    onApi(type, () => { renderPhones(); if (type !== 'device-updated' && !snapshot().pairOpen && !devices().size) { change((state) => ({ ...state, pairOpen: true })); renderPair(); } });
  }
  const progressEvents: readonly ('device-seen' | 'transfer-start' | 'transfer-progress' | 'transfer-cancelled' | 'transfer-complete' | 'outbox-added' | 'outbox-progress' | 'outbox-delivered' | 'outbox-removed')[] = ['device-seen', 'transfer-start', 'transfer-progress', 'transfer-cancelled', 'transfer-complete', 'outbox-added', 'outbox-progress', 'outbox-delivered', 'outbox-removed'];
  for (const type of progressEvents) {
    onApi(type, (detail) => {
      const id = 'device' in detail ? detail.device.deviceId : 'transfer' in detail ? detail.transfer.deviceId : detail.item.deviceId;
      scheduleRow(id);
    });
  }
  onApi('outbox-delivered', ({ item }) => {
    const name = ((devices().get(item.deviceId)?.name) ?? "") || 'phone';
    snackbar(`${item.count === 1 ? `“${String(item.files[0]?.name)}”` : `${String(item.count)} files`} delivered to ${name}`);
  });

  // Page-level drop: avoid the browser opening the file; with a single phone, send to it.
  const hasFiles = (e: DragEvent): e is DragEvent & { readonly dataTransfer: DataTransfer } => e.dataTransfer != null && [...e.dataTransfer.types].includes('Files');
  onWindow('dragover', (e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = devices().size === 1 ? 'copy' : 'none'; } });
  onWindow('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    const deviceId = [...devices().keys()][0];
    if (devices().size === 1 && deviceId !== undefined) void sendFiles(deviceId, droppedFiles(e));
    else if (devices().size > 1) snackbar('Drop the files on the phone you want to send them to');
  });

  // ---------------------------------------------------------------- received
  function renderReceived() {
    const list = snapshot().received;
    if (!list.length) {
      render(receivedList, h('li', { class: 'empty' }, icon('download'), h('p', { text: 'Files you receive will show up here.' })));
      render(receivedActions);
      return;
    }
    render(receivedList, list.map((r) => h('li', { class: 'list-item' },
      h('div', { class: 'list-item__icon' }, icon(r.type.startsWith("image/") ? 'image' : 'file')),
      h('div', { class: 'list-item__text' },
        h('span', { class: 'list-item__primary', text: r.name, attrs: { title: r.name } }),
        h('span', { class: 'list-item__secondary', text: [formatBytes(r.size), r.from && `from ${r.from}`, timeAgo(r.at), r.where === 'download' && 'in Downloads'].filter(Boolean).join(' · ') })),
      r.where === 'folder' && sink.dir && h('div', { class: 'list-item__meta' },
        iconButton('open_in_new', `Open ${r.name}`, () => openReceived(r))))));
    render(receivedActions, button('Clear list', async () => {
      change((state) => ({ ...state, received: [] }));
      await kv.put(RECEIVED_KEY, []).catch(() => undefined);
      renderReceived();
    }));
  }

  async function openReceived(r: { readonly name: string }) {
    try {
      if (sink.state !== 'granted') await sink.requestPermission();
      const file = await sink.openFile(r.name);
      if (!mounted.active()) return;
      const url = URL.createObjectURL(file);
      window.open(url, '_blank');
      objectUrls.set(url, setTimeout(() => { URL.revokeObjectURL(url); objectUrls.delete(url); }, 5 * 60 * 1000));
    } catch (e) {
      snackbar(e instanceof Error && e.name === 'NotFoundError' ? `“${r.name}” was moved or deleted` : `Couldn’t open “${r.name}”`);
    }
  }

  onApi('file-saved', (d) => {
    change((state) => ({ ...state, received: [{ name: d.name, size: d.size, type: d.type, from: d.deviceName, at: d.at, where: d.where, tid: d.tid }, ...state.received].slice(0, RECEIVED_MAX) }));
    renderReceived();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = undefined; void kv.put(RECEIVED_KEY, snapshot().received).catch(() => undefined); }, 300);
  });

  onApi('transfer-complete', ({ transfer: t }) => {
    const what = t.count === 1 ? `“${String(t.files[0]?.name)}”` : `${String(t.count)} files`;
    const first = t.files[0];
    const folder = first?.where === 'folder' && sink.usingFolder;
    snackbar(`Received ${what} from ${t.deviceName}`, t.count === 1 && folder
      ? { action: 'Open', onAction: () => { void openReceived({ name: first.name }); } } : {});
    if (document.visibilityState === 'hidden' && typeof Notification !== 'undefined' && globalThis.Notification.permission === 'granted') {
      try {
        const n = new Notification('Files received', {
          body: `${what} from ${t.deviceName} (${formatBytes(t.total)})`,
          icon: '/icons/hub-192.png',
          tag: t.tid,
        });
        n.onclick = () => { window.focus(); n.close(); };
      } catch { /* ignore */ }
    }
  });

  // ---------------------------------------------------------------- settings
  async function openSettings() {
    const nameField = textField('Computer name', { value: api.name, maxLength: 40, autocomplete: 'off' });
    const folderLine = h('span', { class: 'grow ellipsis' });
    const folderBtns = h('div', { class: 'row hub-wrap' });
    const renderFolder = () => {
      folderLine.textContent = sink.dir ? `“${String(sink.folderName)}”${sink.state === 'granted' ? '' : ' (access needed)'}` : 'Downloads (browser downloads)';
      render(folderBtns,
        sink.supported && button(sink.dir ? 'Change' : 'Choose folder', async () => {
          try { await sink.pick(); } catch (e) { snackbar(`Could not use that folder: ${errorMessage(e)}`); }
          renderFolder();
        }, 'outlined', 'folder'),
        sink.dir && sink.state !== 'granted' && button('Allow access', async () => { await sink.requestPermission(); renderFolder(); }),
        sink.dir && button('Use Downloads', async () => { await sink.useDownloads(); renderFolder(); }));
    };
    renderFolder();
    const detected = addrs.detected.length ? addrs.detected : [];
    const manualField = textField('Extra addresses (comma separated)', { value: addrs.manual.join(', '), autocomplete: 'off', spellcheck: false });

    const ok = await dialog({
      title: 'Settings',
      content: [
        nameField.el,
        h('div', { class: 'hub-setting' },
          h('p', { class: 'subtitle-2', text: 'Save received files to' }),
          h('p', { class: 'row' }, icon('folder'), folderLine),
          folderBtns),
        h('div', { class: 'hub-setting' },
          h('p', { class: 'subtitle-2', text: 'Network addresses' }),
          h('div', { class: 'row hub-wrap' },
            detected.length
              ? detected.map((a) => h('span', { class: 'chip' }, icon('wifi'), a))
              : h('span', { class: 'chip' }, icon('wifi_off'), 'none detected'),
            h('button', { class: 'chip chip--action', onclick: async () => { await addrs.refresh(); snackbar(`Detected: ${addrs.detected.join(', ') || 'none'}`); } }, icon('refresh'), 'Detect')),
          h('p', { class: 'caption', text: 'If detection fails or picks the wrong network, add this computer’s IP address (see “ip -br addr”).' }),
          manualField.el),
        h('p', { class: 'caption', text: `Port ${String(PORT)} (TCP, fixed) · Hub ID ${api.hubId}` }),
      ],
      actions: [{ label: 'Cancel', value: false }, { label: 'Save', value: true, variant: 'contained' }],
    });
    if (ok !== true) { renderBanners(); renderReceived(); return; }
    const newName = nameField.input.value.trim();
    if (newName && newName !== api.name) await api.setName(newName);
    const invalid = await addrs.setManual(manualField.input.value);
    if (invalid.length) snackbar(`Ignored invalid address: ${invalid.join(', ')}`);
    if (snapshot().pairOpen) void newCode();
    updateStatus();
    renderBanners();
    renderReceived();
  }

  // ---------------------------------------------------------------- timers
  interval(() => { updateStatus(); updateExpiry(); }, 1000);
  interval(() => { for (const id of rows.keys()) updateRow(id); }, 10_000);
  interval(renderReceived, 60_000);
  onWindow('focus', () => { void sink.check(); });
  interval(() => { void runUpdateCheck(); }, UPDATE_CHECK_MS);
  onWindow('online', () => { void runUpdateCheck(); });

  updateStatus();
  renderBanners();
  renderPair();
  renderPhones();
  renderReceived();
  void runUpdateCheck();
  mounted.cleanup(() => {
    clearTimeout(flushTimer);
    clearTimeout(saveTimer);
    fileInput?.remove();
    for (const [url, timer] of objectUrls) { clearTimeout(timer); URL.revokeObjectURL(url); }
    objectUrls.clear();
  });
  return mounted.dispose;
}

/** Chrome's major version (null if unknown). */
function chromeMajor() {
  const v = Number.parseInt((/Chrom(?:e|ium)\/(\d+)/.exec(navigator.userAgent))?.[1] ?? '', 10);
  return Number.isFinite(v) ? v : null;
}

// ------------------------------------------------------------------ boot

function fatal(e: unknown) {
  console.error(e);
  render(app, appBar(), h('main', { class: 'content' },
    h('div', { class: 'banner banner--error' }, icon('error'),
      h('div', { class: 'grow' },
        h('p', { text: `The hub failed to start: ${errorMessage(e)}` }),
        h('p', { text: 'Close and reopen the app. If this keeps happening, reinstall it from the setup guide.' })),
      button('Reload', () => { location.reload(); }))));
}

// Only one window may run the server (and own the pairing codes). Extra windows
// wait for the lock and take over if the active window closes.
function renderAlreadyOpen() {
  render(app, appBar(), h('main', { class: 'content' },
    h('div', { class: 'banner' }, icon('info'),
      h('div', { class: 'grow' },
        h('p', { text: 'i6-share Hub is already running in another window.' }),
        h('p', { text: 'Use that window. This one takes over automatically if the other one is closed.' })))));
}

async function boot() {
  if (!('locks' in navigator)) return main();
  await navigator.locks.request('i6-share-hub', { ifAvailable: true }, async (lock) => {
    if (!lifetime.active()) return;
    if (!lock) {
      renderAlreadyOpen();
      void navigator.locks.request('i6-share-hub', { signal: lockController.signal }, () => { if (lifetime.active()) location.reload(); }).catch(() => undefined);
      return;
    }
    await main();
    await (options.holdLock ?? (() => held.promise))(); // hold the lock for as long as this window lives
  });
}

function initialize(): Promise<void> {
  const hide = (): void => { void dispose(); };
  window.addEventListener('pagehide', hide);
  lifetime.cleanup(() => { window.removeEventListener('pagehide', hide); });
  return Effect.runPromise(Effect.gen(function* () {
    const { BUILD } = yield* Effect.promise(loadBuild);
    if (!lifetime.active()) return;
    yield* Effect.sync(() => { document.body.append(buildBadge(BUILD)); });
    if (!('TCPServerSocket' in globalThis)) yield* Effect.sync(renderNotIwa);
    else yield* Effect.tryPromise({ try: boot, catch: (error) => error }).pipe(
      Effect.catch((error) => Effect.promise(dispose).pipe(Effect.andThen(Effect.sync(() => { fatal(error); })))),
    );
  }));
}
return { initialize, mountUi, onboarding, renderNotIwa, renderAlreadyOpen, fatal, dispose };
}

export const initializeHubUi = (): Promise<void> => {
  const app = document.getElementById('app');
  if (!app) return Promise.reject(new Error('Missing hub application root'));
  return createHubUi(app).initialize();
};
