// i6-share Hub (Isolated Web App): UI + wiring of the HTTP server, protocol and file sink.

import { PORT, APP_URL } from './lib/proto.js';
import {
  h, render, icon, iconButton, button, progress, snackbar, dialog, textField, codeBlock,
  formatBytes, timeAgo, buildBadge,
} from './lib/dom.js';
import { store, persist } from './lib/store.js';
import { startServer } from './http.js';
import { HubApi, ONLINE_MS } from './api.js';
import { AddressBook } from './net.js';
import { FolderSink } from './sink.js';
import { checkForUpdate, compareVersions } from './update-check.js';

const SETUP_URL = APP_URL + 'setup/';
const INSTALL_CMD = `curl -fsSL ${APP_URL}install.sh | bash`;
const RECEIVED_KEY = 'received';
const RECEIVED_MAX = 100;
const UPDATE_CHECK_MS = 6 * 60 * 60 * 1000;
const DISMISSED_UPDATE_KEY = 'dismissedUpdate';
const app = document.getElementById('app');

// The QR module is written separately; load it lazily so a problem there never blocks the hub.
let qrModule;
const loadQr = () => (qrModule ??= import('./qr.js').catch((e) => { console.warn('QR module unavailable', e); return null; }));

const hostPort = (addr) => (addr ? `${addr.includes(':') ? `[${addr}]` : addr}:${PORT}` : `port ${PORT}`);

function appBar(...extra) {
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

function onboarding({ kv, sink }) {
  return new Promise((resolve) => {
    let step = 0;
    let name = 'Linux PC';
    const main = h('main', { class: 'content onboarding' });
    render(app, appBar(), main);

    const stepCard = (title, subtitle, body, actions) => h('section', { class: 'card card--accent' },
      h('div', { class: 'card__header' },
        h('p', { class: 'overline muted', text: `Step ${step + 1} of 3` }),
        h('h2', { class: 'card__title', text: title }),
        subtitle && h('p', { class: 'card__subtitle', text: subtitle })),
      h('div', { class: 'card__body hub-prose' }, body),
      h('div', { class: 'card__actions' }, actions));

    const show = () => {
      if (step === 0) {
        const f = textField('Computer name', { value: name, maxLength: 40, autocomplete: 'off' });
        const next = () => { name = f.input.value.trim() || 'Linux PC'; step = 1; show(); };
        f.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') next(); });
        render(main, stepCard('Welcome to i6-share Hub', 'Name this computer – your phone will show this name.',
          [f.el], [button('Next', next, 'contained')]));
        f.input.focus();
        f.input.select();
      } else if (step === 1) {
        const where = h('p', { class: 'row' }, icon('folder'),
          h('span', { text: sink.folderName ? `Saving to the “${sink.folderName}” folder` : 'Saving to your Downloads folder (browser downloads)' }));
        const choose = async () => {
          try { await sink.pick(); } catch (e) { snackbar(`Could not use that folder: ${e.message || e}`); }
          show();
        };
        render(main, stepCard('Where should received files go?',
          'Files from your phone are saved automatically – no prompts.',
          [where,
            !sink.supported && h('p', { text: 'Folder access isn’t available here, so files will be downloaded.' })],
          [button('Back', () => { step = 0; show(); }),
            sink.supported && button(sink.folderName ? 'Change folder' : 'Choose folder', choose, 'outlined', 'folder'),
            sink.folderName && button('Use Downloads', async () => { await sink.useDownloads(); show(); }),
            button('Next', () => { step = 2; show(); }, 'contained')]));
      } else {
        render(main, stepCard('Let your phone reach this computer',
          `Phones connect to this computer on TCP port ${PORT}. Debian 13 has no firewall rules by default – check with:`,
          [codeBlock('sudo nft list ruleset'),
            h('p', { text: 'Empty output means nothing blocks the port: skip this step. Otherwise allow the port once:' }),
            h('p', { class: 'subtitle-2', text: 'nftables (Debian’s default)' }),
            codeBlock(`sudo nft insert rule inet filter input tcp dport ${PORT} accept`),
            h('p', { class: 'subtitle-2', text: 'iptables' }),
            codeBlock(`sudo iptables -I INPUT -p tcp --dport ${PORT} -j ACCEPT && sudo ip6tables -I INPUT -p tcp --dport ${PORT} -j ACCEPT`),
            h('p', { text: `These last until reboot. To keep it, add “tcp dport ${PORT} accept” to the input chain in /etc/nftables.conf.` })],
          [button('Back', () => { step = 1; show(); }),
            button('Finish', async () => {
              // Ask for notifications but don't wait: an unanswered prompt must not block setup.
              if (globalThis.Notification?.permission === 'default') Notification.requestPermission().catch(() => {});
              await kv.put('hubName', name);
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
  persist();
  const storage = { kv: store('kv'), devices: store('devices'), queue: store('queue') };
  const kv = storage.kv;
  const sink = new FolderSink({ kv });
  await sink.init();
  if (!(await kv.get('onboarded'))) await onboarding({ kv, sink });

  const addrs = new AddressBook({ kv });
  await addrs.init();
  const api = new HubApi({ storage, sink, getAddrs: () => addrs.addrs });
  await api.init();
  const server = startServer({
    port: PORT,
    handler: (req) => { addrs.observe(req.localAddress); return api.handle(req); },
  });
  server.addEventListener('connection-error', (e) => console.debug('connection error', e.detail));
  api.addEventListener('error', (e) => console.warn('hub error', e.detail?.error || e.detail));

  const received = { list: [] };
  try { const r = await kv.get(RECEIVED_KEY); if (Array.isArray(r)) received.list = r; } catch { /* ignore */ }

  mountUi({ api, server, addrs, sink, kv, received });
}

function mountUi({ api, server, addrs, sink, kv, received }) {
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
      const secs = s.retryAt ? Math.max(0, Math.ceil((s.retryAt - Date.now()) / 1000)) : 0;
      statusDot.className = 'status-dot status-dot--off';
      statusText.textContent = `Not listening – retrying in ${secs} s`;
      bar.title = s.error || '';
    } else {
      statusDot.className = 'status-dot status-dot--busy';
      statusText.textContent = 'Starting…';
    }
  }

  // ---------------------------------------------------------------- banners
  let sinkError = null;
  function renderBanners() {
    const s = server.state;
    const items = [];
    if (s.status === 'error') {
      items.push(banner('error', [
        h('strong', { text: `Can’t listen on port ${PORT}. ` }),
        `${s.error || 'Unknown error'}. Another program (or a second hub window) may be using the port. Retrying automatically.`,
      ], button('Retry now', () => server.restart())));
    }
    if (sink.dir && sink.state !== 'granted') {
      items.push(banner('warning',
        `Allow access to the “${sink.folderName}” folder so received files are saved there. Until then they go to Downloads.`,
        button('Allow', async () => { await sink.requestPermission(); if (sink.state !== 'granted') snackbar('Access not granted – choose the folder again in Settings'); })));
    }
    if (!addrs.addrs.length) {
      items.push(banner('warning',
        'Couldn’t detect this computer’s local network address, so phones may not find it. Check the network connection or add the address in Settings.',
        button('Settings', () => openSettings())));
    }
    if (sinkError) {
      items.push(banner('error', `Couldn’t save “${sinkError.name}”: ${sinkError.message}. The phone will retry.`,
        button('Dismiss', () => { sinkError = null; renderBanners(); })));
    }
    if (update.latest && !(update.dismissed && compareVersions(update.latest, update.dismissed) <= 0)) {
      items.push(banner('update', [
        h('strong', { text: `i6-share Hub ${update.latest} is available` }),
        ` (you have ${update.current}).`,
      ], h('div', { class: 'hub-banner__actions' },
        button('Dismiss', () => dismissUpdate()),
        button('How to update', () => howToUpdate(), 'outlined'))));
    }
    render(banners, items);
  }
  const BANNER_ICONS = { error: 'error', warning: 'warning', update: 'info' };
  const banner = (kind, text, action) => h('div', { class: `banner banner--${kind}` },
    icon(BANNER_ICONS[kind] || 'info'),
    h('div', { class: 'grow' }, h('p', {}, text)),
    action);

  // ---------------------------------------------------------------- update check
  // Offline is normal on a LAN-only setup: failures are silent and never block anything.
  const update = { current: null, latest: null, dismissed: null };
  let checking = false;
  async function runUpdateCheck() {
    if (checking) return;
    checking = true;
    try {
      update.current ??= (await import('./build-info.js').catch(() => ({}))).BUILD?.version || null;
      if (!update.current) return;
      const result = await checkForUpdate({ current: update.current });
      console.debug('[i6] update check', result ? `latest ${result.latest}, running ${update.current}` : 'unavailable');
      if (!result) return;
      update.dismissed = (await kv.get(DISMISSED_UPDATE_KEY).catch(() => null)) || null;
      const latest = result.available ? result.latest : null;
      if (latest !== update.latest) { update.latest = latest; renderBanners(); }
    } finally {
      checking = false;
    }
  }
  async function dismissUpdate() {
    update.dismissed = update.latest;
    renderBanners();
    await kv.put(DISMISSED_UPDATE_KEY, update.latest).catch(() => {});
  }

  async function howToUpdate() {
    const pages = [
      { url: 'chrome://iwa-dev', note: 'Chrome 154 and newer', button: 'Update' },
      { url: 'chrome://web-app-internals', note: 'Chrome 153 and older', button: 'Perform update now' },
    ];
    const major = chromeMajor();
    if (major && major < 154) pages.reverse();
    const [page, other] = pages;
    await dialog({
      title: `Update to i6-share Hub ${update.latest}`,
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

  server.addEventListener('state', () => { updateStatus(); renderBanners(); });
  sink.addEventListener('change', () => renderBanners());
  api.addEventListener('sink-error', (e) => {
    sinkError = { name: e.detail.name, message: e.detail.error?.message || String(e.detail.error) };
    renderBanners();
  });

  // ---------------------------------------------------------------- pairing card
  const qrCanvas = h('canvas', { class: 'qr', attrs: { role: 'img', 'aria-label': 'Pairing QR code' } });
  const qrFallback = h('p', { class: 'caption muted hidden', text: 'QR code unavailable – use the link below.' });
  const linkBox = h('div');
  const expiry = h('span', { class: 'caption muted' });
  let code = null;
  let pairOpen = api.devices.size === 0;

  async function newCode() {
    try { code = api.newPairCode(); } catch (e) { console.warn(e); return; }
    render(linkBox, codeBlock(code.link));
    updateExpiry();
    const mod = await loadQr();
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
    if (!code || !pairOpen) return;
    const left = code.expiresAt - Date.now();
    if (left <= 0) { newCode(); return; }
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    expiry.textContent = `Code valid for ${m}:${String(s).padStart(2, '0')} · single use`;
  }

  function renderPair() {
    pairSection.classList.toggle('card--accent', pairOpen);
    if (!pairOpen) {
      code = null;
      render(pairSection, h('div', { class: 'hub-pair__collapsed' },
        h('div', { class: 'list-item__icon' }, icon('qr')),
        h('div', { class: 'grow' },
          h('p', { class: 'subtitle-1', text: 'Pair another phone' }),
          h('p', { class: 'body-2 muted', text: 'Show a QR code to scan with the i6-share app.' })),
        button('Show code', () => { pairOpen = true; renderPair(); }, 'outlined', 'qr')));
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
        api.devices.size > 0 && button('Hide', () => { pairOpen = false; renderPair(); }),
        button('New code', () => newCode(), 'text', 'refresh')));
    newCode();
  }

  api.addEventListener('pair-code-used', (e) => {
    snackbar(`Paired with ${e.detail.name}`);
    pairOpen = false;
    renderPair();
  });
  addrs.addEventListener('change', () => { updateStatus(); renderBanners(); if (pairOpen) newCode(); });

  // ---------------------------------------------------------------- phones
  const rows = new Map(); // deviceId → {li, status, activity}
  let fileInput = null;

  function pickAndSend(deviceId) {
    fileInput?.remove();
    fileInput = h('input', { type: 'file', multiple: true, class: 'hidden' });
    fileInput.addEventListener('change', () => {
      const files = [...fileInput.files];
      fileInput.remove();
      fileInput = null;
      if (files.length) sendFiles(deviceId, files);
    });
    document.body.append(fileInput);
    fileInput.click();
  }

  async function sendFiles(deviceId, files) {
    const dev = api.devices.get(deviceId);
    if (!dev || !files.length) return;
    try {
      await api.sendToDevice(deviceId, files);
      const n = files.length;
      snackbar(`${n === 1 ? `“${files[0].name}”` : `${n} files`} will be sent to ${dev.name}${api.isOnline(deviceId) ? '' : ' when it’s online'}`);
    } catch (e) {
      snackbar(`Couldn’t queue files: ${e.message || e}`);
    }
  }

  function droppedFiles(e) {
    const items = [...(e.dataTransfer?.items || [])];
    const dirs = items.filter((it) => it.kind === 'file' && it.webkitGetAsEntry?.()?.isDirectory).length;
    if (dirs) snackbar('Folders can’t be sent – drop the files inside instead');
    const files = [...(e.dataTransfer?.files || [])];
    return dirs ? files.filter((f, i) => !items[i]?.webkitGetAsEntry?.()?.isDirectory) : files;
  }

  async function forget(deviceId) {
    const dev = api.devices.get(deviceId);
    if (!dev) return;
    const ok = await dialog({
      title: `Forget ${dev.name}?`,
      content: h('p', { text: 'It will no longer be able to send or receive files until it scans a new pairing code. Files waiting to be sent to it are discarded.' }),
      actions: [{ label: 'Cancel', value: false }, { label: 'Forget', value: true, variant: 'contained' }],
    });
    if (ok) {
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
          iconButton('send', `Send files to ${d.name}`, () => pickAndSend(d.deviceId)),
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
        sendFiles(d.deviceId, droppedFiles(e));
      });
      rows.set(d.deviceId, { li, status, activity });
      updateRow(d.deviceId);
      return li;
    }));
  }

  function updateRow(deviceId) {
    const row = rows.get(deviceId);
    const d = api.devices.get(deviceId);
    if (!row || !d) return;
    const online = Date.now() - (d.lastSeen || 0) < ONLINE_MS;
    render(row.status,
      h('span', { class: `status-dot${online ? ' status-dot--on' : ''}` }),
      h('span', { class: 'ellipsis', text: [online ? 'Online' : d.lastSeen ? `Last seen ${timeAgo(d.lastSeen)}` : 'Not seen yet', d.os].filter(Boolean).join(' · ') }));

    const parts = [];
    for (const t of api.transfersFor(deviceId)) {
      if (t.complete) continue;
      const pct = t.total ? Math.floor((t.bytes / t.total) * 100) : 0;
      parts.push(h('div', { class: 'hub-activity' },
        h('span', { class: 'caption', text: [
          `Receiving ${t.count === 1 ? `“${t.files[0].name}”` : `${t.done}/${t.count} files`}`,
          `${formatBytes(t.bytes)} of ${formatBytes(t.total)}`, `${pct}%`,
          t.speed && Date.now() - t.lastActivity < 5000 ? `${formatBytes(t.speed)}/s` : (Date.now() - t.lastActivity > 15000 ? 'paused' : ''),
        ].filter(Boolean).join(' · ') }),
        progress(t.total ? t.bytes / t.total : null)));
    }
    for (const q of api.outboxFor(deviceId)) {
      const label = q.count === 1 ? `“${q.files[0].name}”` : `${q.count} files`;
      parts.push(h('div', { class: 'hub-activity' },
        h('div', { class: 'row' },
          h('span', { class: 'caption grow ellipsis', text: q.started
            ? [`Sending ${label}`, `${formatBytes(q.bytes)} of ${formatBytes(q.total)}`, q.total ? `${Math.floor((q.bytes / q.total) * 100)}%` : '', q.speed ? `${formatBytes(q.speed)}/s` : ''].filter(Boolean).join(' · ')
            : `Sending ${label} (${formatBytes(q.total)}) – ${online ? 'starting…' : 'waiting for the phone'}` }),
          h('button', { class: 'btn btn--text hub-small-btn', text: 'Cancel', onclick: () => api.cancelOutbox(q.tid) })),
        q.started ? progress(q.total ? q.bytes / q.total : 1) : progress(online ? null : 0)));
    }
    render(row.activity, parts);
  }

  // Coalesce frequent progress events into ≤ 4 row updates per second.
  const pending = new Set();
  let flushTimer = 0;
  const scheduleRow = (deviceId) => {
    pending.add(deviceId);
    flushTimer ||= setTimeout(() => { flushTimer = 0; for (const id of pending) updateRow(id); pending.clear(); }, 250);
  };

  for (const type of ['device-paired', 'device-unpaired', 'device-updated']) {
    api.addEventListener(type, () => { renderPhones(); if (type !== 'device-updated' && !pairOpen && !api.devices.size) { pairOpen = true; renderPair(); } });
  }
  for (const type of ['device-seen', 'transfer-start', 'transfer-progress', 'transfer-cancelled', 'transfer-complete', 'outbox-added', 'outbox-progress', 'outbox-delivered', 'outbox-removed']) {
    api.addEventListener(type, (e) => {
      const id = e.detail?.device?.deviceId || e.detail?.transfer?.deviceId || e.detail?.item?.deviceId;
      if (id) scheduleRow(id);
    });
  }
  api.addEventListener('outbox-delivered', (e) => {
    const { item } = e.detail;
    const name = api.devices.get(item.deviceId)?.name || 'phone';
    snackbar(`${item.count === 1 ? `“${item.files[0].name}”` : `${item.count} files`} delivered to ${name}`);
  });

  // Page-level drop: avoid the browser opening the file; with a single phone, send to it.
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = api.devices.size === 1 ? 'copy' : 'none'; } });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (api.devices.size === 1) sendFiles([...api.devices.keys()][0], droppedFiles(e));
    else if (api.devices.size > 1) snackbar('Drop the files on the phone you want to send them to');
  });

  // ---------------------------------------------------------------- received
  function renderReceived() {
    const list = received.list;
    if (!list.length) {
      render(receivedList, h('li', { class: 'empty' }, icon('download'), h('p', { text: 'Files you receive will show up here.' })));
      render(receivedActions);
      return;
    }
    render(receivedList, list.map((r) => h('li', { class: 'list-item' },
      h('div', { class: 'list-item__icon' }, icon(/^image\//.test(r.type) ? 'image' : 'file')),
      h('div', { class: 'list-item__text' },
        h('span', { class: 'list-item__primary', text: r.name, attrs: { title: r.name } }),
        h('span', { class: 'list-item__secondary', text: [formatBytes(r.size), r.from && `from ${r.from}`, timeAgo(r.at), r.where === 'download' && 'in Downloads'].filter(Boolean).join(' · ') })),
      r.where === 'folder' && sink.dir && h('div', { class: 'list-item__meta' },
        iconButton('open_in_new', `Open ${r.name}`, () => openReceived(r))))));
    render(receivedActions, button('Clear list', async () => {
      received.list = [];
      await kv.put(RECEIVED_KEY, []).catch(() => {});
      renderReceived();
    }));
  }

  async function openReceived(r) {
    try {
      if (sink.state !== 'granted') await sink.requestPermission();
      const file = await sink.openFile(r.name);
      const url = URL.createObjectURL(file);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    } catch (e) {
      snackbar(e?.name === 'NotFoundError' ? `“${r.name}” was moved or deleted` : `Couldn’t open “${r.name}”`);
    }
  }

  let saveTimer = 0;
  api.addEventListener('file-saved', (e) => {
    const d = e.detail;
    received.list.unshift({ name: d.name, size: d.size, type: d.type, from: d.deviceName, at: d.at, where: d.where, tid: d.tid });
    received.list.length = Math.min(received.list.length, RECEIVED_MAX);
    renderReceived();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => kv.put(RECEIVED_KEY, received.list).catch(() => {}), 300);
  });

  api.addEventListener('transfer-complete', (e) => {
    const t = e.detail.transfer;
    const what = t.count === 1 ? `“${t.files[0].name}”` : `${t.count} files`;
    const folder = t.files[0]?.where === 'folder' && sink.usingFolder;
    snackbar(`Received ${what} from ${t.deviceName}`, t.count === 1 && folder
      ? { action: 'Open', onAction: () => openReceived({ name: t.files[0].name }) } : {});
    if (document.visibilityState === 'hidden' && globalThis.Notification?.permission === 'granted') {
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
      folderLine.textContent = sink.dir ? `“${sink.folderName}”${sink.state === 'granted' ? '' : ' (access needed)'}` : 'Downloads (browser downloads)';
      render(folderBtns,
        sink.supported && button(sink.dir ? 'Change' : 'Choose folder', async () => {
          try { await sink.pick(); } catch (e) { snackbar(`Could not use that folder: ${e.message || e}`); }
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
        h('p', { class: 'caption', text: `Port ${PORT} (TCP, fixed) · Hub ID ${api.hubId}` }),
      ],
      actions: [{ label: 'Cancel', value: false }, { label: 'Save', value: true, variant: 'contained' }],
    });
    if (!ok) { renderBanners(); renderReceived(); return; }
    const newName = nameField.input.value.trim();
    if (newName && newName !== api.name) await api.setName(newName);
    const invalid = await addrs.setManual(manualField.input.value);
    if (invalid.length) snackbar(`Ignored invalid address: ${invalid.join(', ')}`);
    if (pairOpen) newCode();
    updateStatus();
    renderBanners();
    renderReceived();
  }

  // ---------------------------------------------------------------- timers
  setInterval(() => { updateStatus(); updateExpiry(); }, 1000);
  setInterval(() => { for (const id of rows.keys()) updateRow(id); }, 10_000);
  setInterval(renderReceived, 60_000);
  window.addEventListener('focus', () => { sink.check(); });
  setInterval(runUpdateCheck, UPDATE_CHECK_MS);
  window.addEventListener('online', () => runUpdateCheck());

  updateStatus();
  renderBanners();
  renderPair();
  renderPhones();
  renderReceived();
  runUpdateCheck();
}

/** Chrome's major version (null if unknown). */
function chromeMajor() {
  const brand = navigator.userAgentData?.brands?.find((b) => /^(Google Chrome|Chromium)$/.test(b.brand));
  const v = Number.parseInt(brand?.version ?? navigator.userAgent.match(/Chrom(?:e|ium)\/(\d+)/)?.[1], 10);
  return Number.isFinite(v) ? v : null;
}

// ------------------------------------------------------------------ boot

function fatal(e) {
  console.error(e);
  render(app, appBar(), h('main', { class: 'content' },
    h('div', { class: 'banner banner--error' }, icon('error'),
      h('div', { class: 'grow' },
        h('p', { text: `The hub failed to start: ${e?.message || e}` }),
        h('p', { text: 'Close and reopen the app. If this keeps happening, reinstall it from the setup guide.' })),
      button('Reload', () => location.reload()))));
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
  if (!navigator.locks) return main();
  await navigator.locks.request('i6-share-hub', { ifAvailable: true }, async (lock) => {
    if (!lock) {
      renderAlreadyOpen();
      navigator.locks.request('i6-share-hub', () => location.reload());
      return;
    }
    await main();
    await new Promise(() => {}); // hold the lock for as long as this window lives
  });
}

// Version badge in the bottom-right corner on every screen (lives outside #app).
import('./build-info.js')
  .catch(() => ({ BUILD: {} }))
  .then(({ BUILD }) => document.body.append(buildBadge(BUILD)));

if (typeof globalThis.TCPServerSocket === 'undefined') renderNotIwa();
else boot().catch(fatal);
