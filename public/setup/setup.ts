// i6-share – Linux onboarding wizard. Guides the user through installing the
// hub Isolated Web App in Chrome/Chromium. Progress is kept in localStorage.

import { Effect, Option, Ref, Schema } from 'effect';
import { h, icon, button, codeBlock, render, formatBytes, $, type DomChild } from '../lib/dom.js';
import { PORT, APP_URL } from '../lib/proto.js';

const STORE_KEY = 'i6-setup-v1';
const MIN_CHROME = 120;      // first version with Isolated Web Apps behind flags
const IWA_DEV_PAGE = 154;    // chrome://iwa-dev replaced the web-app-internals UI
const BUNDLE_URL = '../hub/i6-share-hub.swbn';
const VERSION_URL = '../hub/version.json';


export interface BrowserInfo {
  readonly browser: string;
  readonly major: number;
  readonly os: string;
  readonly chromiumBased: boolean;
}
const BrandSchema = Schema.Struct({ brand: Schema.String, version: Schema.String });
const BrandsSchema = Schema.Array(BrandSchema);
const StateSchema = Schema.Struct({ active: Schema.Int, done: Schema.Array(Schema.Int) });
export type SetupState = typeof StateSchema.Type;
const emptyState: SetupState = { active: 0, done: [] };
const attempt = <A>(run: () => Promise<A>): Effect.Effect<A, unknown> => Effect.tryPromise({ try: run, catch: (error) => error });
export const normalizeOs = (platform: string): string => {
  if (platform.length === 0) return 'unknown';
  if (/linux/i.test(platform)) return 'Linux';
  if (/chrome ?os|cros/i.test(platform)) return 'ChromeOS';
  if (/android/i.test(platform)) return 'Android';
  if (/windows/i.test(platform)) return 'Windows';
  if (/mac/i.test(platform)) return 'macOS';
  return platform;
};
const osFromUserAgent = (ua: string): string => {
  const candidates: readonly (readonly [RegExp, string])[] = [[/Android/, 'Android'], [/CrOS/, 'ChromeOS'], [/Linux|X11/, 'Linux'], [/Windows/, 'Windows'], [/Mac OS X|Macintosh/, 'macOS'], [/iPhone|iPad/, 'iOS']];
  return candidates.find(([pattern]) => pattern.test(ua))?.[1] ?? 'unknown';
};
const isEntropyReader = (value: unknown): value is (hints: readonly string[]) => Promise<unknown> => typeof value === 'function';
export const detectBrowser = (source: Navigator): Effect.Effect<BrowserInfo> => Effect.gen(function* () {
  const raw: unknown = 'userAgentData' in source ? source.userAgentData : undefined;
  const ua = source.userAgent;
  const data = typeof raw === 'object' && raw !== null ? raw : {};
  const platform = 'platform' in data && typeof data.platform === 'string' ? normalizeOs(data.platform) : 'unknown';
  const low = 'brands' in data ? data.brands : [];
  const high = yield* attempt(async (): Promise<unknown> => {
    if ('getHighEntropyValues' in data && isEntropyReader(data.getHighEntropyValues)) {
      const result: unknown = await data.getHighEntropyValues(['fullVersionList']);
      return typeof result === 'object' && result !== null && 'fullVersionList' in result ? result.fullVersionList : low;
    }
    return low;
  }).pipe(Effect.orElseSucceed(() => low));
  const parsed = Schema.decodeUnknownOption(BrandsSchema)(high);
  const brands = parsed._tag === 'Some' && parsed.value.length > 0 ? parsed.value : Schema.decodeUnknownOption(BrandsSchema)(low).pipe(Option.getOrElse(() => []));
  const chromium = brands.find((brand) => brand.brand === 'Chromium');
  const chrome = brands.find((brand) => brand.brand === 'Google Chrome');
  const other = brands.find((brand) => !/Chromium|Google Chrome|Not.?A.?Brand/i.test(brand.brand));
  const match = /(?:Chrome|Chromium)\/(\d+)/.exec(ua);
  const major = chromium === undefined ? Number(match?.[1] ?? 0) : Number.parseInt(chromium.version, 10) || 0;
  const uaBrowser = ua.includes('Edg/') ? 'Microsoft Edge' : ua.includes('OPR/') ? 'Opera' : ua.includes('Chromium/') ? 'Chromium' : 'Google Chrome';
  const nonChromium = ua.includes('Firefox/') ? 'Firefox' : ua.includes('Safari/') ? 'Safari' : 'an unknown browser';
  return { browser: chromium === undefined ? match === null ? nonChromium : uaBrowser : chrome === undefined ? other?.brand ?? 'Chromium' : 'Google Chrome', major, os: platform === 'unknown' ? osFromUserAgent(ua) : platform, chromiumBased: chromium !== undefined || match !== null };
});
export const loadState = (storage: Pick<Storage, 'getItem'>): SetupState => Effect.runSync(Effect.try(() => Schema.decodeUnknownSync(StateSchema)(JSON.parse(storage.getItem(STORE_KEY) ?? 'null'))).pipe(Effect.orElseSucceed(() => emptyState)));
export const nextActive = (state: SetupState, index: number): SetupState => ({ ...state, active: state.active === index ? -1 : index });
export const withDone = (state: SetupState, index: number): SetupState => ({ ...state, done: state.done.includes(index) ? state.done : [...state.done, index] });

export const createSetup = () => {
const UPDATE_URL = new URL('../hub/update.json', location.href).href;
const stateRef = Effect.runSync(Ref.make(loadState(localStorage)));
const browserRef = Effect.runSync(Ref.make<BrowserInfo>({ browser: 'unknown', major: 0, os: 'unknown', chromiumBased: false }));
const getState = (): SetupState => Effect.runSync(Ref.get(stateRef));
const getBrowser = (): BrowserInfo => Effect.runSync(Ref.get(browserRef));
const saveState = (): void => { Effect.runSync(Effect.try(() => { localStorage.setItem(STORE_KEY, JSON.stringify(getState())); }).pipe(Effect.ignore)); };
const isChromeOrChromium = (): boolean => getBrowser().browser === 'Google Chrome' || getBrowser().browser === 'Chromium';
const useIwaDev = (): boolean => getBrowser().major === 0 || getBrowser().major >= IWA_DEV_PAGE;

// ---------------------------------------------------------------- small UI helpers

const p = (...c: readonly DomChild[]) => h('p', null, ...c);
const strong = (t: string) => h('strong', { text: t });
const ol = (...items: readonly DomChild[]) => h('ol', { class: 'setup-list' }, items.map((i) => h('li', null, i)));
const ul = (...items: readonly DomChild[]) => h('ul', { class: 'setup-list' }, items.map((i) => h('li', null, i)));

function checkRow(ok: boolean | null, title: string, detail: string) {
  const kind = ok === true ? 'ok' : ok === false ? 'bad' : 'warn';
  return h('div', { class: `setup-check setup-check--${kind}` },
    icon(kind === 'ok' ? 'check_circle' : kind === 'bad' ? 'error' : 'warning'),
    h('div', { class: 'grow' }, h('div', { class: 'setup-check__title', text: title }), detail && h('div', { class: 'caption', text: detail })));
}

function banner(kind: string, iconName: string, ...content: readonly DomChild[]) {
  return h('div', { class: `banner banner--${kind}` }, icon(iconName), h('div', { class: 'grow' }, ...content));
}

// ---------------------------------------------------------------- steps

const STEPS = [
  {
    title: 'Check your browser',
    caption: 'Google Chrome on Debian 13',
    body: () => {
      const rows: HTMLElement[] = [];
      if (!getBrowser().chromiumBased) {
        rows.push(checkRow(false, `You're using ${getBrowser().browser}`,
          'The hub needs Google Chrome or Chromium. Open this page in one of them.'));
      } else if (!isChromeOrChromium()) {
        rows.push(checkRow(null, `${getBrowser().browser} ${String(getBrowser().major)}`,
          'Isolated Web Apps are a Chrome feature and may be missing in other Chromium-based browsers. Google Chrome or Chromium is recommended.'));
      } else if (getBrowser().major < MIN_CHROME) {
        rows.push(checkRow(false, `${getBrowser().browser} ${String(getBrowser().major)} is too old`,
          `Isolated Web Apps need version ${String(MIN_CHROME)} or newer. Update your browser, then reload this page.`));
      } else {
        rows.push(checkRow(true, `${getBrowser().browser} ${String(getBrowser().major)}`,
          /chromium/i.test(getBrowser().browser) ? 'Supported, but Google Chrome is recommended (see below).' : 'Good.'));
      }
      if (getBrowser().os === 'Linux') rows.push(checkRow(true, 'Linux', 'Supported.'));
      else if (getBrowser().os === 'Android' || getBrowser().os === 'iOS') {
        rows.push(checkRow(false, getBrowser().os, 'This guide is for the computer. On your phone, open the i6-share app instead.'));
      } else {
        rows.push(checkRow(null, getBrowser().os === 'unknown' ? 'Unknown operating system' : getBrowser().os,
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
      void loadVersion(meta);
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
        p(strong(`Chrome ${String(IWA_DEV_PAGE)} and newer:`), ' open ', h('code', { text: 'chrome://iwa-dev' }),
          ', click ', strong('Install'), ', choose the ', strong('Update Manifest'), ' tab, paste the address above, click ',
          strong('Fetch'), ', then ', strong('Install'), '.'),
      ];
      const internals = [
        p(strong(`Chrome ${String(MIN_CHROME)}–${String(IWA_DEV_PAGE - 1)}:`), ' open ', h('code', { text: 'chrome://web-app-internals' }),
          ', find ', strong('Install IWA from Update Manifest'), ', paste the address above, click ', strong('Fetch'),
          ', then ', strong('Install'), '.'),
      ];
      const first = useIwaDev() ? iwaDev : internals;
      const second = useIwaDev() ? internals : iwaDev;
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
          p('This works too, but Chrome does not update an app installed from a file, and installing a newer file over it fails with “App is already installed”. The quick install above uses this method and updates the hub when you run it again.')),
      ];
    },
  },
  {
    title: 'Open the firewall',
    caption: `Allow TCP port ${String(PORT)} from your network`,
    body: () => [
      p('Your phone connects to the hub on port ', strong(String(PORT)), '. A fresh Debian 13 install has no firewall rules, so first check:'),
      codeBlock('sudo nft list ruleset'),
      p(strong('Empty output? Skip this step.'), ' Otherwise allow the port with whichever tool you use:'),
      p(strong('nftables'), ' (Debian 13 default, works with the stock /etc/nftables.conf):'),
      codeBlock(`sudo nft insert rule inet filter input tcp dport ${String(PORT)} accept`),
      p(strong('iptables:')),
      codeBlock(`sudo iptables -I INPUT -p tcp --dport ${String(PORT)} -j ACCEPT && sudo ip6tables -I INPUT -p tcp --dport ${String(PORT)} -j ACCEPT`),
      p('Both commands last until the next reboot. To make it permanent with nftables, add this line inside ',
        h('code', { text: 'chain input { … }' }), ' in ', h('code', { text: '/etc/nftables.conf' }), ' and run ',
        h('code', { text: 'sudo systemctl enable --now nftables' }), ':'),
      codeBlock(`tcp dport ${String(PORT)} accept`),
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

async function loadVersion(el: HTMLElement): Promise<void> {
  try {
    const res = await fetch(VERSION_URL, { cache: 'no-cache', signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(String(res.status));
    const raw: unknown = await res.json();
    const v = Schema.decodeUnknownSync(Schema.Struct({ version: Schema.optional(Schema.String), size: Schema.optional(Schema.Number), builtAt: Schema.optional(Schema.String), webBundleId: Schema.optional(Schema.String) }))(raw);
    const parts: string[] = [];
    if (v.version !== undefined && v.version.length > 0) parts.push(`Version ${v.version}`);
    if (v.size !== undefined && Number.isFinite(v.size)) parts.push(formatBytes(v.size));
    if (v.builtAt !== undefined && v.builtAt.length > 0 && !Number.isNaN(Date.parse(v.builtAt))) parts.push(`built ${new Date(v.builtAt).toLocaleDateString()}`);
    render(el, parts.join(' · ') || 'Latest version');
    if (v.webBundleId !== undefined && v.webBundleId.length > 0) {
      el.append(h('span', { class: 'setup-bundle-id mono', text: `isolated-app://${v.webBundleId}/`, attrs: { title: 'App identity (Web Bundle ID)' } }));
    }
  } catch {
    render(el, 'Version details unavailable. The download may not be published yet.');
  }
}

async function testConnection(btn: HTMLButtonElement, out: HTMLElement): Promise<void> {
  btn.disabled = true;
  render(out, h('div', { class: 'row muted' }, h('span', { class: 'status-dot status-dot--busy' }), 'Connecting to the hub…'));
  try {
    const options = {
      targetAddressSpace: 'loopback',
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    } satisfies RequestInit & { readonly targetAddressSpace: 'loopback' };
    const res = await fetch(`http://127.0.0.1:${String(PORT)}/i6/hello`, options);
    const info = await Effect.runPromise(attempt(async () => {
      const raw: unknown = await res.json();
      return Schema.decodeUnknownSync(Schema.Struct({ app: Schema.String, addrs: Schema.optional(Schema.Array(Schema.String)), name: Schema.optional(Schema.String), port: Schema.optional(Schema.Number) }))(raw);
    }).pipe(Effect.orElseSucceed(() => null)));
    if (!res.ok || info?.app !== 'i6-share-hub') {
      render(out, banner('warning', 'warning', p(`Something answered on port ${String(PORT)}, but it isn't the i6-share Hub. `,
        'Close the other program using this port and try again.')));
      return;
    }
    const addrs = (info.addrs ?? []).filter(Boolean);
    render(out, h('div', { class: 'banner setup-ok' }, icon('check_circle'),
      h('div', { class: 'grow' },
        h('div', { class: 'subtitle-2', text: `Connected to "${info.name === undefined || info.name.length === 0 ? 'i6-share Hub' : info.name}"` }),
        addrs.length
          ? h('div', null, 'Your phone will reach it at ',
            addrs.map((a, i) => [i ? ', ' : '', h('code', { text: a.includes(':') ? `[${a}]:${String(info.port === undefined || info.port === 0 ? PORT : info.port)}` : `${a}:${String(info.port === undefined || info.port === 0 ? PORT : info.port)}` })]), '.')
          : h('div', { text: 'The hub reports no network address yet. Is this PC connected to Wi-Fi or Ethernet?' }))));
    markDone(5);
  } catch (e) {
    const timeout = e instanceof Error && e.name === 'TimeoutError';
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

interface StepElement { readonly el: HTMLDivElement; readonly num: HTMLDivElement; readonly head: HTMLDivElement; readonly body: HTMLDivElement; readonly rendered: boolean }
const stepsRef = Effect.runSync(Ref.make<readonly StepElement[]>([]));
const stepEls = (): readonly StepElement[] => Effect.runSync(Ref.get(stepsRef));
const required = (selector: string): HTMLElement => {
  const element = $(selector);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing setup element: ${selector}`);
  return element;
};

function buildStepper() {
  const root = required('#stepper');
  render(root, STEPS.map((step, i) => {
    const num = h('div', { class: 'step__num', attrs: { 'aria-hidden': 'true' } });
    const head = h('div', {
      class: 'step__head',
      attrs: { role: 'button', tabindex: '0', id: `step-${String(i)}-head`, 'aria-controls': `step-${String(i)}-body` },
      onclick: () => { setActive(i); },
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(i); } },
    }, step.title, h('span', { class: 'caption', text: step.caption }));
    const body = h('div', { class: 'step__body', id: `step-${String(i)}-body`, attrs: { role: 'region', 'aria-labelledby': `step-${String(i)}-head` } });
    const el = h('div', { class: i === STEPS.length - 1 ? 'step step--last' : 'step' }, num, head, h('div', { class: 'step__line' }), body);
    Effect.runSync(Ref.update(stepsRef, (steps) => [...steps, { el, num, head, body, rendered: false }]));
    return el;
  }), finishEl);
  update(false);
}

const finishEl = h('div', { class: 'setup-finish hidden' },
  banner('info', 'check_circle', h('div', null,
    h('div', { class: 'subtitle-2', text: 'All set!' }),
    p('Share photos and files from your phone to i6-share, and they appear in the hub\'s folder on this PC.'))));

function renderBody(i: number) {
  const s = stepEls()[i];
  const step = STEPS[i];
  if (s === undefined || step === undefined) return;
  const last = i === STEPS.length - 1;
  render(s.body,
    step.body(),
    h('div', { class: 'step__actions' },
      button(last ? 'Finish' : 'Done, next', () => { markDone(i); setActive(last ? -1 : i + 1); }, 'contained'),
      i > 0 && button('Back', () => { setActive(i - 1); }, 'text')));
  Effect.runSync(Ref.update(stepsRef, (steps) => steps.map((item, index) => index === i ? { ...item, rendered: true } : item)));
}

function setActive(i: number) {
  Effect.runSync(Ref.update(stateRef, (state) => nextActive(state, i))); // clicking the open step's title collapses it
  saveState();
  update(true);
}

function markDone(i: number) {
  Effect.runSync(Ref.update(stateRef, (state) => withDone(state, i)));
  saveState();
  update(false);
}

function update(scroll: boolean) {
  stepEls().forEach((s, i) => {
    const active = i === getState().active;
    const done = getState().done.includes(i);
    s.el.classList.toggle('step--active', active);
    s.el.classList.toggle('step--done', done && !active);
    s.head.setAttribute('aria-expanded', String(active));
    render(s.num, done && !active ? icon('check') : String(i + 1));
    if (active && !s.rendered) renderBody(i);
  });
  finishEl.classList.toggle('hidden', getState().done.length < STEPS.length || getState().active !== -1);
  if (scroll && getState().active >= 0) {
    const head = stepEls()[getState().active]?.head;
    if (head === undefined) return;
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
  Effect.runSync(Ref.set(browserRef, await Effect.runPromise(detectBrowser(navigator))));
  if (getBrowser().os === 'Android' || getBrowser().os === 'iOS') {
    render(required('#notice'), banner('warning', 'phone',
      p('This guide is for your Linux computer. On this phone, ', h('a', { href: '../', text: 'open the i6-share app' }), ' instead.')));
  }
  if (getState().active >= STEPS.length) Effect.runSync(Ref.update(stateRef, (state) => ({ ...state, active: 0 })));
  buildStepper();
  required('#reset').addEventListener('click', () => {
    Effect.runSync(Ref.set(stateRef, emptyState));
    saveState();
    Effect.runSync(Ref.update(stepsRef, (steps) => steps.map((step) => ({ ...step, rendered: false }))));
    update(true);
  });
}

function renderQuickInstall() {
  const el = $('#quick-install-body');
  if (!el) return;
  const cmd = `curl -fsSL ${new URL('../install.sh', location.href).href} | bash`;
  render(el,
    p('Open a terminal on the Linux PC (in your desktop session, as your normal user) and run:'),
    codeBlock(cmd),
    p('It asks for your password for ', h('code', { text: 'sudo' }), ' (installing Chrome, firewall) and nothing else. ',
      'If Chrome is open it is closed for the install and started again afterwards; at the end the hub window opens. ',
      'On a brand-new Chrome profile, answer Chrome’s welcome dialog when it appears. Then continue with step 6 below.'),
    p(strong('To update the hub, run the same command again'), ' – your pairings and settings are kept.'),
    p('Nothing starts at login: when you want to receive files, open ', strong('i6-share Hub'), ' from your app menu; it only listens while its window is open.'),
    p(h('a', { href: '../install.sh', target: '_blank', rel: 'noopener', text: 'Read the script first' }),
      ' · options: ', h('code', { text: '--no-firewall  --yes' }),
      ' (use ', h('code', { text: '| bash -s -- --no-firewall' }), '; ', h('code', { text: '--yes' }), ' skips Chrome’s welcome dialog)'));
}

return { init, renderQuickInstall, getState, getBrowser, setActive, markDone, renderBody, update, loadVersion, testConnection };
};
export const startSetup = (): Effect.Effect<void, unknown> => Effect.gen(function* () {
  const setup = yield* Effect.sync(createSetup);
  yield* Effect.sync(() => { setup.renderQuickInstall(); });
  yield* attempt(() => setup.init());
});
export const initializeSetup = (): Promise<void> => Effect.runPromise(startSetup());
