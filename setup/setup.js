// i6-share – Linux onboarding wizard. Guides the user through installing the
// hub Isolated Web App in Chrome/Chromium. Progress is kept in localStorage.

import { h, icon, button, codeBlock, render, formatBytes, $ } from '../lib/dom.js';
import { PORT, APP_URL } from '../lib/proto.js';

const STORE_KEY = 'i6-setup-v1';
const MIN_CHROME = 120;      // first version with Isolated Web Apps behind flags
const IWA_DEV_PAGE = 154;    // chrome://iwa-dev replaced the web-app-internals UI
const BUNDLE_URL = '../hub/i6-share-hub.swbn';
const VERSION_URL = '../hub/version.json';
const UPDATE_URL = new URL('../hub/update.json', location.href).href;

// ---------------------------------------------------------------- state

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && Number.isInteger(s.active) && Array.isArray(s.done)) return s;
  } catch { /* ignore */ }
  return { active: 0, done: [] };
}
let state = loadState();
function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

// ---------------------------------------------------------------- browser detection

async function detectBrowser() {
  const info = { browser: 'unknown', major: 0, os: 'unknown', chromiumBased: false };
  const uad = navigator.userAgentData;
  if (uad?.brands) {
    let brands = uad.brands;
    try {
      const hi = await uad.getHighEntropyValues(['fullVersionList']);
      if (hi.fullVersionList?.length) brands = hi.fullVersionList;
    } catch { /* low-entropy brands are fine */ }
    const find = (name) => brands.find((b) => b.brand === name);
    const chromium = find('Chromium');
    const chrome = find('Google Chrome');
    const other = brands.find((b) => !/Chromium|Google Chrome|Not.?A.?Brand/i.test(b.brand));
    if (chromium) {
      info.chromiumBased = true;
      info.major = parseInt(chromium.version, 10) || 0;
      info.browser = chrome ? 'Google Chrome' : other ? other.brand : 'Chromium';
    }
    info.os = normalizeOs(uad.platform);
  }
  if (!info.chromiumBased || info.os === 'unknown') {
    const ua = navigator.userAgent;
    const m = ua.match(/(?:Chrome|Chromium)\/(\d+)/);
    if (!info.chromiumBased && m) {
      info.chromiumBased = true;
      info.major = parseInt(m[1], 10);
      info.browser = /Edg\//.test(ua) ? 'Microsoft Edge' : /OPR\//.test(ua) ? 'Opera'
        : /Chromium\//.test(ua) ? 'Chromium' : 'Google Chrome';
    } else if (!info.chromiumBased) {
      info.browser = /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'an unknown browser';
    }
    if (info.os === 'unknown') {
      info.os = /Android/.test(ua) ? 'Android' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux|X11/.test(ua) ? 'Linux'
        : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /iPhone|iPad/.test(ua) ? 'iOS' : 'unknown';
    }
  }
  return info;
}

function normalizeOs(p) {
  if (!p) return 'unknown';
  if (/linux/i.test(p)) return 'Linux';
  if (/chrome ?os|cros/i.test(p)) return 'ChromeOS';
  if (/android/i.test(p)) return 'Android';
  if (/windows/i.test(p)) return 'Windows';
  if (/mac/i.test(p)) return 'macOS';
  return p;
}

let browser = { browser: 'unknown', major: 0, os: 'unknown', chromiumBased: false };
const isChromeOrChromium = () => browser.browser === 'Google Chrome' || browser.browser === 'Chromium';
const useIwaDev = () => !browser.major || browser.major >= IWA_DEV_PAGE;

// ---------------------------------------------------------------- small UI helpers

const p = (...c) => h('p', null, ...c);
const strong = (t) => h('strong', { text: t });
const ol = (...items) => h('ol', { class: 'setup-list' }, items.map((i) => h('li', null, i)));
const ul = (...items) => h('ul', { class: 'setup-list' }, items.map((i) => h('li', null, i)));

function checkRow(ok, title, detail) {
  const kind = ok === true ? 'ok' : ok === false ? 'bad' : 'warn';
  return h('div', { class: `setup-check setup-check--${kind}` },
    icon(kind === 'ok' ? 'check_circle' : kind === 'bad' ? 'error' : 'warning'),
    h('div', { class: 'grow' }, h('div', { class: 'setup-check__title', text: title }), detail && h('div', { class: 'caption', text: detail })));
}

function banner(kind, iconName, ...content) {
  return h('div', { class: `banner banner--${kind}` }, icon(iconName), h('div', { class: 'grow' }, ...content));
}

// ---------------------------------------------------------------- steps

const STEPS = [
  {
    title: 'Check your browser',
    caption: 'Google Chrome on Debian 13',
    body: () => {
      const rows = [];
      if (!browser.chromiumBased) {
        rows.push(checkRow(false, `You're using ${browser.browser}`,
          'The hub needs Google Chrome or Chromium. Open this page in one of them.'));
      } else if (!isChromeOrChromium()) {
        rows.push(checkRow(null, `${browser.browser} ${browser.major}`,
          'Isolated Web Apps are a Chrome feature and may be missing in other Chromium-based browsers. Google Chrome or Chromium is recommended.'));
      } else if (browser.major < MIN_CHROME) {
        rows.push(checkRow(false, `${browser.browser} ${browser.major} is too old`,
          `Isolated Web Apps need version ${MIN_CHROME} or newer. Update your browser, then reload this page.`));
      } else {
        rows.push(checkRow(true, `${browser.browser} ${browser.major}`,
          'Good. Google Chrome and Chromium both work.'));
      }
      if (browser.os === 'Linux') rows.push(checkRow(true, 'Linux', 'Supported.'));
      else if (browser.os === 'Android' || browser.os === 'iOS') {
        rows.push(checkRow(false, browser.os, 'This guide is for the computer. On your phone, open the i6-share app instead.'));
      } else {
        rows.push(checkRow(null, browser.os === 'unknown' ? 'Unknown operating system' : browser.os,
          'i6-share is made for Linux. Other systems should work the same way but are not tested.'));
      }
      return [
        ...rows,
        p('Use ', strong('Google Chrome'), '. In our tests on Debian 13, Debian’s own ', h('code', { text: 'chromium' }),
          ' package (156) could not install signed Isolated Web Apps, while Google Chrome could. Install Google Chrome with:'),
        codeBlock('wget -O /tmp/google-chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && sudo apt install -y /tmp/google-chrome.deb'),
        p('Use the browser profile you normally use. The hub is installed into that Chrome profile.'),
      ];
    },
  },
  {
    title: 'Enable Isolated Web Apps',
    caption: 'Two Chrome flags, then relaunch',
    body: () => [
      p('Web pages can\'t open ', h('code', { text: 'chrome://' }), ' links, so copy each address into a new tab:'),
      codeBlock('chrome://flags/#enable-isolated-web-apps'),
      codeBlock('chrome://flags/#enable-isolated-web-app-dev-mode'),
      ol(
        ['Set both ', strong('Isolated Web Apps'), ' and ', strong('Isolated Web App Developer Mode'), ' to ', strong('Enabled'), '.'],
        ['Click ', strong('Relaunch'), ' at the bottom of the page. Your tabs come back, including this one.'],
      ),
      banner('info', 'info', h('span', null,
        'Developer Mode is needed because the hub is installed from a file rather than an app store. ',
        'For now, this is the only way to install Isolated Web Apps on Linux.')),
    ],
  },
  {
    title: 'Download the hub',
    caption: 'i6-share-hub.swbn, a signed web bundle',
    body: () => {
      const meta = h('div', { class: 'caption muted', text: 'Checking the latest version…' });
      loadVersion(meta);
      return [
        p('This file contains the whole hub app, signed so Chrome can verify it.'),
        h('div', { class: 'setup-download' },
          h('a', { class: 'btn btn--contained', href: BUNDLE_URL, attrs: { download: 'i6-share-hub.swbn' } },
            icon('download'), h('span', { text: 'Download hub' })),
          meta),
        p('Only needed for the command-line install in the next step – the recommended install fetches it by itself. If you download it, save it in your ', strong('Downloads'), ' folder.'),
      ];
    },
  },
  {
    title: 'Install it',
    caption: 'From the update manifest, so Chrome keeps it up to date',
    body: () => {
      const iwaDev = [
        p(strong(`Chrome ${IWA_DEV_PAGE} and newer:`), ' open ', h('code', { text: 'chrome://iwa-dev' }),
          ', click ', strong('Install'), ', choose the ', strong('Update Manifest'), ' tab, paste the address above, click ',
          strong('Fetch'), ', then ', strong('Install'), '.'),
      ];
      const internals = [
        p(strong(`Chrome ${MIN_CHROME}–${IWA_DEV_PAGE - 1}:`), ' open ', h('code', { text: 'chrome://web-app-internals' }),
          ', find ', strong('Install IWA from Update Manifest'), ', paste the address above, click ', strong('Fetch'),
          ', then ', strong('Install'), '.'),
      ];
      const [first, second] = useIwaDev() ? [iwaDev, internals] : [internals, iwaDev];
      return [
        p(strong('Recommended.'), ' Copy this address – it tells Chrome where the hub and its future versions live:'),
        codeBlock(UPDATE_URL),
        codeBlock(useIwaDev() ? 'chrome://iwa-dev' : 'chrome://web-app-internals'),
        ...first,
        p('"i6-share Hub" then appears in your app launcher. Chrome checks for new versions by itself; to update right away use ',
          strong('Perform update now'), ' (or ', strong('Update'), ') on the same page while the hub window is closed. ',
          'Your pairings and settings are kept.'),
        h('details', { class: 'setup-details' },
          h('summary', { text: useIwaDev() ? 'Older Chrome versions' : 'Newer Chrome versions' }), ...second),
        h('details', { class: 'setup-details' },
          h('summary', { text: 'Install the downloaded file from the command line instead' }),
          p('Quit Chrome completely (close every window), then run:'),
          codeBlock('google-chrome --enable-features=IsolatedWebApps,IsolatedWebAppDevMode --install-isolated-web-app-from-file="$HOME/Downloads/i6-share-hub.swbn"'),
          p('This works too, but an app installed from a file is not updated automatically, and installing a newer file over it fails with “App is already installed”.')),
      ];
    },
  },
  {
    title: 'Open the firewall',
    caption: `Allow TCP port ${PORT} from your network`,
    body: () => [
      p('Your phone connects to the hub on port ', strong(String(PORT)), '. A fresh Debian 13 install has no firewall rules, so first check:'),
      codeBlock('sudo nft list ruleset'),
      p(strong('Empty output? Skip this step.'), ' Otherwise allow the port with whichever tool you use:'),
      p(strong('nftables'), ' (Debian 13 default, works with the stock /etc/nftables.conf):'),
      codeBlock(`sudo nft insert rule inet filter input tcp dport ${PORT} accept`),
      p(strong('iptables:')),
      codeBlock(`sudo iptables -I INPUT -p tcp --dport ${PORT} -j ACCEPT && sudo ip6tables -I INPUT -p tcp --dport ${PORT} -j ACCEPT`),
      p('Both commands last until the next reboot. To make it permanent with nftables, add this line inside ',
        h('code', { text: 'chain input { … }' }), ' in ', h('code', { text: '/etc/nftables.conf' }), ' and run ',
        h('code', { text: 'sudo systemctl enable --now nftables' }), ':'),
      codeBlock(`tcp dport ${PORT} accept`),
    ],
  },
  {
    title: 'Start the hub & test',
    caption: 'Launch it, pick a folder, check the connection',
    body: () => {
      const result = h('div', { class: 'setup-test-result', attrs: { 'aria-live': 'polite' } });
      const btn = button('Test connection', () => testConnection(btn, result), 'outlined', 'refresh');
      return [
        ol(
          ['Open ', strong('i6-share Hub'), ' from your app launcher, or from ', h('code', { text: 'chrome://apps' }), '.'],
          ['Choose the folder where received files should be saved, for example ', h('code', { text: '~/Downloads/i6-share' }), '.'],
          ['Keep the hub window open, or minimise it. It can only receive files while it runs.'],
        ),
        codeBlock('chrome://apps'),
        p('Then check that this browser can reach it:'),
        h('div', { class: 'setup-test' }, btn, result),
      ];
    },
  },
  {
    title: 'Pair your phone',
    caption: 'Install the phone app and scan the QR code',
    body: () => [
      ol(
        ['On your Android phone, open this address in ', strong('Chrome'), ':', codeBlock(APP_URL)],
        ['Tap ', strong('⋮'), ' → ', strong('Install app'), ' (or ', strong('Add to home screen'), ').'],
        ['Scan the QR code shown in the hub, either with the camera app or with the scanner inside i6-share.'],
        ['When Chrome asks to let i6-share ', strong('access devices on your local network'), ', tap ', strong('Allow'), '.'],
      ),
      banner('info', 'share', h('span', null,
        'That\'s it. From now on, in Gallery or Files tap ', strong('Share → i6-share'),
        ' and the files go straight to the hub\'s folder on this PC. No more questions.')),
    ],
  },
];

async function loadVersion(el) {
  try {
    const res = await fetch(VERSION_URL, { cache: 'no-cache', signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(String(res.status));
    const v = await res.json();
    const parts = [];
    if (v.version) parts.push(`Version ${v.version}`);
    if (Number.isFinite(v.size)) parts.push(formatBytes(v.size));
    if (v.builtAt && !Number.isNaN(Date.parse(v.builtAt))) parts.push(`built ${new Date(v.builtAt).toLocaleDateString()}`);
    render(el, parts.join(' · ') || 'Latest version');
    if (v.webBundleId) {
      el.append(h('span', { class: 'setup-bundle-id mono', text: `isolated-app://${v.webBundleId}/`, attrs: { title: 'App identity (Web Bundle ID)' } }));
    }
  } catch {
    render(el, 'Version details unavailable. The download may not be published yet.');
  }
}

async function testConnection(btn, out) {
  btn.disabled = true;
  render(out, h('div', { class: 'row muted' }, h('span', { class: 'status-dot status-dot--busy' }), 'Connecting to the hub…'));
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/i6/hello`, {
      targetAddressSpace: 'loopback',
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    let info = null;
    try { info = await res.json(); } catch { /* not JSON */ }
    if (!res.ok || info?.app !== 'i6-share-hub') {
      render(out, banner('warning', 'warning', p(`Something answered on port ${PORT}, but it isn't the i6-share Hub. `,
        'Close the other program using this port and try again.')));
      return;
    }
    const addrs = (info.addrs || []).filter(Boolean);
    render(out, h('div', { class: 'banner setup-ok' }, icon('check_circle'),
      h('div', { class: 'grow' },
        h('div', { class: 'subtitle-2', text: `Connected to "${info.name || 'i6-share Hub'}"` }),
        addrs.length
          ? h('div', null, 'Your phone will reach it at ',
            addrs.map((a, i) => [i ? ', ' : '', h('code', { text: a.includes(':') ? `[${a}]:${info.port || PORT}` : `${a}:${info.port || PORT}` })]), '.')
          : h('div', { text: 'The hub reports no network address yet. Is this PC connected to Wi-Fi or Ethernet?' }))));
    markDone(5);
  } catch (e) {
    const timeout = e?.name === 'TimeoutError';
    render(out, banner('error', 'error',
      h('div', { class: 'subtitle-2', text: timeout ? 'The hub didn\'t answer in time' : 'Couldn\'t reach the hub' }),
      ul(
        ['Is the ', strong('i6-share Hub'), ' window open? Start it from the app launcher.'],
        ['Did Chrome ask to allow access to ', strong('devices on your local network'), '? Choose ', strong('Allow'), ' and test again.'],
        ['Blocked it by mistake? Click the icon left of the address bar → ', strong('Site settings'), ' → ', strong('Local network access'), ' → ', strong('Allow'), '.'],
      )));
  } finally {
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------- stepper rendering

const stepEls = [];

function buildStepper() {
  const root = $('#stepper');
  render(root, STEPS.map((step, i) => {
    const num = h('div', { class: 'step__num', attrs: { 'aria-hidden': 'true' } });
    const head = h('div', {
      class: 'step__head',
      attrs: { role: 'button', tabindex: '0', id: `step-${i}-head`, 'aria-controls': `step-${i}-body` },
      onclick: () => setActive(i),
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(i); } },
    }, step.title, h('span', { class: 'caption', text: step.caption }));
    const body = h('div', { class: 'step__body', id: `step-${i}-body`, attrs: { role: 'region', 'aria-labelledby': `step-${i}-head` } });
    const el = h('div', { class: i === STEPS.length - 1 ? 'step step--last' : 'step' }, num, head, h('div', { class: 'step__line' }), body);
    stepEls.push({ el, num, head, body, rendered: false });
    return el;
  }), finishEl);
  update(false);
}

const finishEl = h('div', { class: 'setup-finish hidden' },
  banner('info', 'check_circle', h('div', null,
    h('div', { class: 'subtitle-2', text: 'All set!' }),
    p('Share photos and files from your phone to i6-share, and they appear in the hub\'s folder on this PC.'))));

function renderBody(i) {
  const s = stepEls[i];
  const last = i === STEPS.length - 1;
  render(s.body,
    STEPS[i].body(),
    h('div', { class: 'step__actions' },
      button(last ? 'Finish' : 'Done, next', () => { markDone(i); setActive(last ? -1 : i + 1); }, 'contained'),
      i > 0 && button('Back', () => setActive(i - 1), 'text')));
  s.rendered = true;
}

function setActive(i) {
  state.active = state.active === i ? -1 : i; // clicking the open step's title collapses it
  saveState();
  update(true);
}

function markDone(i) {
  if (!state.done.includes(i)) state.done.push(i);
  saveState();
  update(false);
}

function update(scroll) {
  stepEls.forEach((s, i) => {
    const active = i === state.active;
    const done = state.done.includes(i);
    s.el.classList.toggle('step--active', active);
    s.el.classList.toggle('step--done', done && !active);
    s.head.setAttribute('aria-expanded', String(active));
    render(s.num, done && !active ? icon('check') : String(i + 1));
    if (active && !s.rendered) renderBody(i);
  });
  finishEl.classList.toggle('hidden', state.done.length < STEPS.length || state.active !== -1);
  if (scroll && state.active >= 0) {
    const head = stepEls[state.active].head;
    requestAnimationFrame(() => {
      const r = head.getBoundingClientRect();
      if (r.top < 64 || r.top > innerHeight * 0.6) {
        head.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      }
    });
  }
}

// ---------------------------------------------------------------- init

async function init() {
  browser = await detectBrowser();
  if (browser.os === 'Android' || browser.os === 'iOS') {
    render($('#notice'), banner('warning', 'phone',
      p('This guide is for your Linux computer. On this phone, ', h('a', { href: '../', text: 'open the i6-share app' }), ' instead.')));
  }
  if (state.active >= STEPS.length) state.active = 0;
  buildStepper();
  $('#reset').addEventListener('click', () => {
    state = { active: 0, done: [] };
    saveState();
    stepEls.forEach((s) => { s.rendered = false; });
    update(true);
  });
}

init();
