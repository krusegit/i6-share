// i6-share phone/desktop PWA – UI only. All networking lives in client.js.

import {
  h, render, icon, iconButton, button, progress, snackbar, dialog, textField,
  formatBytes, timeAgo, downloadFile, wakeLock, buildBadge,
} from './lib/dom.js';
import { store, persist } from './lib/store.js';
import { pairPayloadFromText } from './lib/proto.js';
import { ShareEngine, APP_VERSION, AbortedError } from './client.js';

const kv = store('kv');
const engine = new ShareEngine({ kv, hubs: store('hubs'), queue: store('queue') });
const setWake = wakeLock();

const main = document.getElementById('main');
const conn = document.getElementById('conn');
const ACTIVE = new Set(['queued', 'sending']);
const DONE_SHOW_MS = 20000;

const state = {
  staged: [],              // File[] waiting for the user to tap a computer
  received: [],            // [{file, hubName, at}] newest first (this session)
  incoming: new Map(),     // tid -> 'incoming' event detail
  lastDone: new Map(),     // hubId -> finished transfer snapshot
  blocked: false,          // engine thinks LAN requests are blocked
  showLna: false,
  unpaired: null,          // name of a hub that dropped our pairing
  pairing: false,
  error: null,
};
let rows = new Map();      // hubId -> row refs (updated in place on progress)
let pickTarget = null;

// ---------------------------------------------------------------- helpers

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const total = (files) => files.reduce((n, f) => n + f.size, 0);
const isImage = (f) => /^image\//.test(f.type);

const urls = new Map();
function urlFor(file) {
  if (!urls.has(file)) urls.set(file, URL.createObjectURL(file));
  return urls.get(file);
}
function revoke(files) {
  for (const f of files) { const u = urls.get(f); if (u) { URL.revokeObjectURL(u); urls.delete(f); } }
}

function activeTransfers(hubId) {
  return engine.transfers.filter((t) => t.hubId === hubId && ACTIVE.has(t.status)).sort((a, b) => a.createdAt - b.createdAt);
}

// ---------------------------------------------------------------- staged files

async function setStaged(files) {
  state.staged = files;
  try { await (files.length ? kv.put('staged', files) : kv.delete('staged')); } catch { /* memory only */ }
  renderAll();
}

function clearStaged() {
  revoke(state.staged);
  setStaged([]);
}

async function sendTo(hubId, files) {
  const hub = engine.hub(hubId);
  try {
    await engine.send(hubId, files);
    snackbar(`Sending ${plural(files.length, 'file')} to ${hub?.name || 'computer'}`);
  } catch (err) {
    snackbar(`Could not send: ${err.message}`);
  }
}

function tapHub(hubId) {
  if (state.staged.length) {
    const files = state.staged;
    clearStaged();
    sendTo(hubId, files);
  } else {
    pick(hubId);
  }
}

const fileInput = h('input', { type: 'file', multiple: true, hidden: true, onchange: onPicked });

function pick(hubId) {
  pickTarget = hubId;
  fileInput.value = '';
  fileInput.click();
}

function onPicked() {
  const files = [...fileInput.files];
  fileInput.value = '';
  if (!files.length) return;
  const hubs = engine.hubs;
  if (pickTarget && engine.hub(pickTarget)) sendTo(pickTarget, files);
  else if (hubs.length === 1 && !state.staged.length) sendTo(hubs[0].id, files);
  else {
    setStaged([...state.staged, ...files]);
    if (hubs.length) snackbar('Tap a computer to send');
  }
  pickTarget = null;
}

// ---------------------------------------------------------------- pairing

async function doPair(text) {
  let payload;
  try { payload = pairPayloadFromText(text); } catch {
    snackbar('That is not a valid i6-share pairing code');
    return;
  }
  if (state.pairing) return;
  state.pairing = true;
  const ctl = new AbortController();
  const name = payload.name || 'your computer';
  const msg = h('p', { text: `Looking for ${name}…` });
  dialog({
    title: 'Pairing',
    content: [progress(null), msg, h('p', { class: 'body-2', text: 'Keep i6-share Hub open on the computer. Both devices must be on the same network.' })],
    actions: [{ label: 'Cancel', value: 'cancel' }],
    dismissible: false,
  }).then((v) => { if (v === 'cancel') ctl.abort(); });
  const dlg = msg.closest('dialog');
  try {
    const hub = await engine.pair(payload, {
      signal: ctl.signal,
      onStatus: (s) => {
        msg.textContent = s === 'pairing' ? `Pairing with ${name}…`
          : s === 'blocked' ? `Can't reach ${name}. If Chrome asked about "local network access", allow it. Still trying…`
            : `Looking for ${name}…`;
      },
    });
    dlg?.closeWith?.('done');
    state.unpaired = null;
    snackbar(`Paired with ${hub.name}`);
    if (state.staged.length) {
      const files = state.staged;
      clearStaged();
      await sendTo(hub.id, files);
    }
    renderAll();
  } catch (err) {
    dlg?.closeWith?.('done');
    if (err instanceof AbortedError) return;
    const again = await dialog({
      title: 'Pairing failed',
      content: h('p', { text: err.message }),
      actions: [{ label: 'Close', value: false }, { label: 'Scan again', value: true, variant: 'contained' }],
    });
    if (again) scanDialog();
  } finally {
    state.pairing = false;
  }
}

function handleHash() {
  if (!/pair=/.test(location.hash)) return;
  const text = location.hash;
  history.replaceState(null, '', location.pathname + location.search);
  doPair(text);
}

function isPairCode(text) {
  try { pairPayloadFromText(text); return true; } catch { return false; }
}

async function scanDialog() {
  const supported = 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia &&
    (await window.BarcodeDetector.getSupportedFormats?.().catch(() => ['qr_code']) ?? ['qr_code']).includes('qr_code');
  if (!supported) {
    const paste = await dialog({
      title: 'Scan QR code',
      content: h('p', { text: 'This browser can\'t scan QR codes inside the app. Scan the code shown by i6-share Hub with your camera app instead, or enter the pairing code.' }),
      actions: [{ label: 'Cancel', value: false }, { label: 'Enter code', value: true, variant: 'contained' }],
    });
    if (paste) pasteDialog();
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
  let stream = null;
  let closed = false;
  const stopCamera = () => { closed = true; stream?.getTracks().forEach((t) => t.stop()); stream = null; };
  result.finally(stopCamera);
  (async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (closed) { s.getTracks().forEach((t) => t.stop()); return; }
      stream = s;
      video.srcObject = s;
      await video.play().catch(() => {});
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      while (!closed) {
        try {
          const codes = video.readyState >= 2 ? await detector.detect(video) : [];
          const hit = codes.map((c) => c.rawValue).find(isPairCode);
          if (hit) { dlg?.closeWith?.({ code: hit }); return; }
          if (codes.length) note.textContent = 'That QR code is not an i6-share pairing code.';
        } catch { /* frame not ready */ }
        await new Promise((r) => setTimeout(r, 200));
      }
    } catch (err) {
      note.textContent = err?.name === 'NotAllowedError'
        ? 'Camera access was denied. Allow the camera for this app, or enter the code instead.'
        : `Camera unavailable (${err?.message || err}). Enter the code instead.`;
    }
  })();
  const v = await result;
  if (v === 'paste') pasteDialog();
  else if (v?.code) doPair(v.code);
}

async function pasteDialog() {
  const { el, input } = textField('Pairing code or link', { attrs: { autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' } });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();   // else Enter would also "click" the next dialog's focused button
    input.closest('dialog')?.closeWith?.(input.value.trim());
  });
  const v = await dialog({
    title: 'Enter pairing code',
    content: [h('p', { class: 'body-2', text: 'Paste the pairing link or code shown by i6-share Hub on your computer.' }), el],
    actions: [{ label: 'Cancel', value: null }, { label: 'Pair', value: () => input.value.trim(), variant: 'contained' }],
  });
  if (v) doPair(v);
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
        if (!ok) return;
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
  if (name != null) {
    await engine.setDeviceName(name);
    snackbar('Saved');
  }
}

// ---------------------------------------------------------------- local network access banner

let lnaStatus = null;
async function checkLna() {
  if (!lnaStatus && navigator.permissions) {
    for (const name of ['local-network-access', 'local-network']) {
      try {
        lnaStatus = await navigator.permissions.query({ name });
        lnaStatus.addEventListener('change', () => { checkLna(); engine.kick(); });
        break;
      } catch { /* unknown permission name */ }
    }
  }
  const s = lnaStatus?.state;
  const show = engine.hubs.length > 0 && (s === 'denied' || (state.blocked && s !== 'granted'));
  if (show !== state.showLna) { state.showLna = show; renderAll(); }
}

// ---------------------------------------------------------------- rendering

function lnaBanner() {
  return h('div', { class: 'banner banner--warning', attrs: { role: 'alert' } }, icon('wifi_off'),
    h('div', { class: 'grow' },
      h('p', { class: 'subtitle-2 banner__title', text: 'Allow local network access' }),
      h('p', { text: 'Chrome seems to block i6-share from reaching devices on your network. Open Chrome ⋮ → Settings → Site settings → Local network access (or tap the icon left of the address bar → Permissions) and allow it for krusegit.github.io. Then come back here.' }),
      h('div', { class: 'banner__actions' }, button('Retry now', () => engine.kick()))));
}

function unpairedBanner() {
  return h('div', { class: 'banner banner--error', attrs: { role: 'alert' } }, icon('error'),
    h('div', { class: 'grow' },
      h('p', { class: 'subtitle-2 banner__title', text: `Pairing with ${state.unpaired} was lost` }),
      h('p', { text: 'Scan the QR code on your computer again.' }),
      h('div', { class: 'banner__actions' },
        button('Scan QR code', scanDialog, 'text', 'qr_scan'),
        button('Dismiss', () => { state.unpaired = null; renderAll(); }))));
}

function thumb(file) {
  const ext = (file.name.match(/\.([^.]{1,5})$/)?.[1] || '').toUpperCase();
  const fileThumb = () => h('div', { class: 'thumb thumb--file', attrs: { title: file.name } }, icon('file'), ext && h('span', { class: 'thumb__ext', text: ext }));
  if (!isImage(file)) return fileThumb();
  // Formats the browser can't decode (e.g. HEIC) fall back to the file tile.
  const img = h('img', { class: 'thumb', src: urlFor(file), alt: '', loading: 'lazy', decoding: 'async',
    onerror: () => img.replaceWith(fileThumb()) });
  return img;
}

function stagedCard() {
  const files = state.staged;
  const shown = files.slice(0, 12);
  const noHubs = !engine.hubs.length;
  return h('section', { class: 'card staged', attrs: { 'aria-label': 'Files to send' } },
    h('div', { class: 'card__header staged__header' },
      h('div', { class: 'grow' },
        h('h2', { class: 'card__title', text: `${plural(files.length, 'file')} · ${formatBytes(total(files))}` }),
        h('p', { class: 'card__subtitle', text: noHubs ? 'Pair your computer to send' : 'Tap a computer to send' })),
      iconButton('close', 'Clear', clearStaged)),
    h('div', { class: 'thumbs' }, shown.map(thumb),
      files.length > shown.length && h('div', { class: 'thumb thumb--more', text: `+${files.length - shown.length}` })),
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

function hubLine(hub) {
  const ts = activeTransfers(hub.id);
  const t = ts[0];
  if (t) {
    const pct = t.total ? Math.floor((t.sent / t.total) * 100) : 0;
    const more = ts.length > 1 ? ` · +${ts.length - 1} queued` : '';
    let text;
    if (hub.status === 'online' && t.status === 'sending') text = `Sending ${pct} %${t.rate > 0 ? ` · ${formatBytes(t.rate)}/s` : ''}`;
    else if (hub.status === 'offline') text = `Offline – will retry · ${pct} %`;
    else text = `Connecting… · ${pct} %`;
    return { text: text + more, dot: hub.status === 'online' ? 'on' : hub.status === 'offline' ? 'off' : 'busy', value: t.total ? t.sent / t.total : null, cancel: t.tid };
  }
  const inc = [...state.incoming.values()].find((i) => i.hubId === hub.id);
  if (inc) {
    const pct = inc.total ? Math.floor((inc.received / inc.total) * 100) : 0;
    return { text: `Receiving ${pct} %`, dot: 'on', value: inc.total ? inc.received / inc.total : null };
  }
  const d = state.lastDone.get(hub.id);
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

function updateRow(refs, hub) {
  const line = hubLine(hub);
  refs.name.textContent = hub.name;
  refs.dot.className = `status-dot status-dot--${line.dot}`;
  refs.secondary.textContent = line.text;
  refs.secondary.classList.toggle('hub__done', !!line.done);
  if (line.value !== undefined) render(refs.bar, progress(line.value));
  else refs.bar.replaceChildren();
  refs.cancelTid = line.cancel || null;
  refs.cancel.classList.toggle('hidden', !line.cancel);
}

function hubRow(hub) {
  const refs = {
    name: h('span', { class: 'list-item__primary' }),
    dot: h('span', { class: 'status-dot' }),
    secondary: h('span', { class: 'list-item__secondary' }),
    bar: h('div', { class: 'hub__progress' }),
    cancelTid: null,
  };
  refs.cancel = iconButton('close', 'Cancel transfer', (e) => {
    e.stopPropagation();
    if (refs.cancelTid) engine.cancel(refs.cancelTid);
  });
  const go = () => tapHub(hub.id);
  refs.el = h('li', {
    class: 'list-item list-item--action hub',
    attrs: { role: 'button', tabindex: '0', 'aria-label': `Send to ${hub.name}` },
    onclick: go,
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } },
  },
  h('span', { class: 'list-item__icon list-item__icon--primary' }, icon('computer')),
  h('span', { class: 'list-item__text' }, refs.name, h('span', { class: 'row hub__status' }, refs.dot, refs.secondary), refs.bar),
  h('span', { class: 'list-item__meta' }, refs.cancel));
  updateRow(refs, hub);
  return refs;
}

function computersCard() {
  const hubs = engine.hubs.sort((a, b) => a.name.localeCompare(b.name));
  rows = new Map(hubs.map((hub) => [hub.id, hubRow(hub)]));
  return h('section', { class: 'card' },
    h('div', { class: 'list-subheader', text: 'Computers' }),
    h('ul', { class: 'list computers' }, [...rows.values()].map((r) => r.el)),
    !state.staged.length && h('p', { class: 'caption muted computers__hint', text: 'Tap a computer to choose files to send.' }),
    h('div', { class: 'card__actions' }, button('Pair another computer', scanDialog, 'text', 'add')));
}

function receivedCard() {
  const canShare = (file) => !!navigator.canShare?.({ files: [file] });
  return h('section', { class: 'card' },
    h('div', { class: 'list-subheader', text: 'Received' }),
    h('ul', { class: 'list' }, state.received.map(({ file, hubName, at }) => h('li', { class: 'list-item' },
      isImage(file)
        ? h('img', { class: 'list-item__thumb', src: urlFor(file), alt: '', loading: 'lazy', decoding: 'async' })
        : h('span', { class: 'list-item__icon' }, icon('file')),
      h('span', { class: 'list-item__text' },
        h('span', { class: 'list-item__primary', text: file.name }),
        h('span', { class: 'list-item__secondary', text: `${formatBytes(file.size)} · from ${hubName} · ${timeAgo(at)}` })),
      h('span', { class: 'list-item__meta' },
        canShare(file) && iconButton('share', 'Share', () => navigator.share({ files: [file], title: file.name }).catch(() => {})),
        iconButton('download', 'Save again', () => downloadFile(file)))))));
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
  render(main,
    state.error && h('div', { class: 'banner banner--error', attrs: { role: 'alert' } }, icon('error'), h('p', { class: 'grow', text: state.error })),
    state.showLna && lnaBanner(),
    state.unpaired && unpairedBanner(),
    state.staged.length > 0 && stagedCard(),
    state.staged.length > 0 && !hubs.length && pairCard(),
    hubs.length > 0 && computersCard(),
    state.received.length > 0 && receivedCard(),
    !hubs.length && !state.staged.length && emptyState());
  if (!hubs.length) rows = new Map();
  updateConn();
}

let rafPending = new Set();
let rafId = 0;
function scheduleRow(hubId) {
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
    : on ? ['on', hubs.length > 1 ? `${on}/${hubs.length} online` : 'Online']
      : hubs.some((x) => x.status === 'searching') ? ['busy', 'Searching…'] : ['off', 'Offline'];
  render(conn, h('span', { class: `status-dot status-dot--${cls}` }), h('span', { text }));
  conn.classList.remove('hidden');
}

// ---------------------------------------------------------------- engine events

engine.addEventListener('hubs', () => { renderAll(); checkLna(); });
engine.addEventListener('status', (e) => scheduleRow(e.detail.hubId));
engine.addEventListener('transfer', (e) => {
  const t = e.detail;
  if (!ACTIVE.has(t.status)) {
    state.lastDone.set(t.hubId, t);
    const hubName = engine.hub(t.hubId)?.name || 'computer';
    if (t.status === 'done') snackbar(`Sent ${plural(t.names.length, 'file')} to ${hubName}`);
    if (t.status === 'partial') snackbar(`${plural(t.failed.length, 'file')} could not be read and ${t.failed.length === 1 ? 'was' : 'were'} skipped`);
    setTimeout(() => scheduleRow(t.hubId), DONE_SHOW_MS + 500);
  }
  scheduleRow(t.hubId);
});
engine.addEventListener('incoming', (e) => {
  const inc = e.detail;
  if (inc.status === 'done') state.incoming.delete(inc.tid);
  else state.incoming.set(inc.tid, inc);
  scheduleRow(inc.hubId);
});
engine.addEventListener('file', (e) => {
  const { file, hubName } = e.detail;
  downloadFile(file);
  state.received.unshift({ file, hubName, at: Date.now() });
  revoke(state.received.splice(30).map((r) => r.file));
  snackbar(`Received ${file.name}`);
  renderAll();
});
engine.addEventListener('unpaired', (e) => {
  state.unpaired = e.detail.name;
  if (e.detail.files.length) setStaged([...state.staged, ...e.detail.files]);
  else renderAll();
});
engine.addEventListener('network', (e) => { state.blocked = e.detail.blocked; checkLna(); });
engine.addEventListener('busy', (e) => setWake(e.detail.busy));
engine.addEventListener('warning', (e) => console.warn(e.detail.message));

// ---------------------------------------------------------------- start

async function start() {
  render(document.getElementById('bar-actions'), iconButton('settings', 'Settings', settingsDialog));
  document.body.append(
    h('button', { class: 'fab fab--extended', attrs: { 'aria-label': 'Send files' }, onclick: () => pick(null) },
      icon('attach'), h('span', { text: 'Send files' })),
    fileInput);
  import('./build-info.js')
    .catch(() => ({ BUILD: {} }))
    .then(({ BUILD }) => document.body.append(buildBadge({ ...BUILD, version: BUILD.version ?? APP_VERSION })));

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { type: 'module', scope: './' }).catch((err) => console.warn('service worker', err));
  }
  persist();

  try {
    const staged = await kv.get('staged');
    if (Array.isArray(staged)) state.staged = staged;
  } catch { /* no IndexedDB */ }
  if (new URLSearchParams(location.search).has('share')) history.replaceState(null, '', location.pathname + location.hash);

  try {
    await engine.init({ visible: document.visibilityState === 'visible' });
  } catch (err) {
    state.error = `Storage is unavailable (${err.message}). Pairings can't be saved in this browser mode.`;
  }
  renderAll();
  checkLna();

  addEventListener('online', () => { engine.kick(); updateConn(); });
  addEventListener('offline', updateConn);
  document.addEventListener('visibilitychange', () => engine.setVisible(document.visibilityState === 'visible'));
  addEventListener('hashchange', handleHash);
  handleHash();
  // Refresh "seen 5 min ago" texts now and then.
  setInterval(() => { if (document.visibilityState === 'visible') for (const id of rows.keys()) scheduleRow(id); }, 30000);
}

start();
