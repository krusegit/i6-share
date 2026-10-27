/** Native hub onboarding. The phone stays a PWA; the computer runs a local executable. */
import { Effect, Ref, Schema } from 'effect';
import { h, button, codeBlock, render, formatBytes, type DomChild } from '../lib/dom.js';
import { PORT, APP_URL } from '../lib/proto.js';
import { HelloResponseSchema } from '../generated/contracts.js';

const STORE_KEY = 'i6-native-setup-v1';
const StateSchema = Schema.Struct({ active: Schema.Int, done: Schema.Array(Schema.Int) });
const ArtifactSchema = Schema.Struct({ file: Schema.String, sha256: Schema.String, size: Schema.Number });
const ReleaseSchema = Schema.Struct({ version: Schema.String, artifacts: Schema.Struct({ 'linux-x64': ArtifactSchema, 'linux-arm64': ArtifactSchema }) });
export type SetupState = typeof StateSchema.Type;
const initialState: SetupState = { active: 0, done: [] };
const attempt = <A>(operation: () => Promise<A>): Effect.Effect<A, unknown> => Effect.tryPromise({ try: operation, catch: (error) => error });
const p = (...children: readonly DomChild[]) => h('p', null, ...children);
const required = (selector: string): HTMLElement => {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing setup element: ${selector}`);
  return element;
};
export const loadState = (storage: Pick<Storage, 'getItem'>): SetupState => Effect.runSync(
  Effect.try(() => Schema.decodeUnknownSync(StateSchema)(JSON.parse(storage.getItem(STORE_KEY) ?? 'null')))
    .pipe(Effect.orElseSucceed(() => initialState)),
);
export const nextActive = (state: SetupState, index: number): SetupState => ({ ...state, active: state.active === index ? -1 : index });
export const withDone = (state: SetupState, index: number): SetupState => ({ ...state, done: state.done.includes(index) ? state.done : [...state.done, index] });

export const createSetup = () => {
  const state = Ref.makeUnsafe(loadState(localStorage));
  const lifetime = new AbortController();
  const read = (): SetupState => Effect.runSync(Ref.get(state));
  const save = (): void => { Effect.runSync(Effect.ignore(Effect.try(() => { localStorage.setItem(STORE_KEY, JSON.stringify(read())); }))); };
  const transition = (change: (current: SetupState) => SetupState): void => { Effect.runSync(Ref.update(state, change)); save(); };
  const installer = `curl -fsSL ${new URL('../install.sh', location.href).href} | bash`;
  const loadVersion = async (target: HTMLElement): Promise<void> => {
    const result = await Effect.runPromise(attempt(async () => {
      const response = await fetch('../downloads/version.json', { cache: 'no-store', signal: lifetime.signal });
      if (!response.ok) throw new Error('Release unavailable');
      const json: unknown = await response.json();
      return Schema.decodeUnknownSync(ReleaseSchema)(json);
    }).pipe(Effect.match({ onFailure: () => null, onSuccess: (release) => release })));
    if (lifetime.signal.aborted) return;
    target.textContent = result === null ? 'Release details unavailable. Try again when online.' : `Version ${result.version} · x64 ${formatBytes(result.artifacts['linux-x64'].size)} · ARM64 ${formatBytes(result.artifacts['linux-arm64'].size)}`;
  };
  const testConnection = async (control: HTMLButtonElement, target: HTMLElement): Promise<void> => {
    control.disabled = true;
    target.textContent = 'Checking this computer…';
    const response = await Effect.runPromise(attempt(async () => {
      const result = await fetch(`http://127.0.0.1:${String(PORT)}/i6/hello`, {
        signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(4000)]),
        cache: 'no-store',
        ...{ targetAddressSpace: 'loopback' },
      });
      if (!result.ok) throw new Error('Hub unavailable');
      const json: unknown = await result.json();
      const hello = Schema.decodeUnknownSync(HelloResponseSchema)(json);
      return hello;
    }).pipe(Effect.match({ onFailure: () => null, onSuccess: (hello) => hello })));
    if (lifetime.signal.aborted) return;
    control.disabled = false;
    target.textContent = response === null
      ? 'Could not reach the hub. Start i6-share-hub on this computer, then retry. Allow local network access if the browser asks.'
      : `Connected to ${response.name}. Open the local dashboard URL printed by the hub to pair your phone.`;
    if (response !== null) { transition((current) => withDone(current, 2)); update(); }
  };
  const steps: readonly { readonly title: string; readonly caption: string; readonly body: () => readonly DomChild[] }[] = [
    {
      title: 'Download the native hub', caption: 'Debian 13 / Ubuntu 24.04 or newer; x64 or ARM64',
      body: () => {
        const version = h('p', { class: 'caption muted', text: 'Checking the latest release…' });
        void loadVersion(version);
        return [p('The hub is a self-contained native executable for modern glibc Linux. Published builds target Debian 13 and Ubuntu 24.04 or newer. Use any browser for its local dashboard. Your phone still uses the installed PWA.'),
          h('div', { class: 'setup-download' },
            h('a', { class: 'btn btn--contained', href: '../downloads/i6-share-hub-linux-x64.tar.gz', text: 'Linux x64' }),
            h('a', { class: 'btn btn--outlined', href: '../downloads/i6-share-hub-linux-arm64.tar.gz', text: 'Linux ARM64' })),
          version, p('The installer below selects your architecture and verifies the archive SHA-256 against release metadata fetched over HTTPS.')];
      },
    },
    {
      title: 'Install or update', caption: 'A user-local installation; no administrator access',
      body: () => [codeBlock(installer), p('Run as your normal Linux user. The installer keeps versions under ~/.local/share/i6-share/releases and creates ~/.local/bin/i6-share-hub plus an app-menu shortcut.'),
        p('Run the same command again to update. Stop a running hub with Ctrl+C first; existing processes continue using the old version until restarted. Data and pairings are kept separately.'),
        p('To roll back the executable to the previous installed version:'), codeBlock(`${installer} -s -- --rollback`),
        p('The installer does not change your firewall, browser settings, or login services.')],
    },
    {
      title: 'Start the hub and test', caption: `Keep the dashboard open; TCP ${String(PORT)} receives files`,
      body: () => {
        const result = h('div', { class: 'setup-test-result', attrs: { 'aria-live': 'polite' } });
        const control = button('Test connection', () => testConnection(control, result), 'outlined', 'refresh');
        return [codeBlock('~/.local/bin/i6-share-hub --open'), p('The command opens a local dashboard in your browser. Use it to choose the receive folder and name this computer. Keep at least one dashboard tab open. Closing the last tab stops the backend automatically after a short reload grace period. Ctrl+C also stops it.'),
          p('Nothing starts at login. If your firewall blocks incoming traffic, allow TCP 47616 from your trusted local network using your firewall settings. Guest Wi-Fi isolation or a VPN can also block devices.'),
          h('div', { class: 'setup-test' }, control, result)];
      },
    },
    {
      title: 'Pair your phone', caption: 'Scan the QR code in the local dashboard',
      body: () => [p('On Android, open the phone app in Chrome and install it from the browser menu:'), codeBlock(APP_URL),
        p('Scan the pairing QR code shown by the local dashboard, or copy its pairing link to the phone. Pairing codes expire after ten minutes and can be used once.'),
        p('Allow local network access when Chrome asks. Share files to i6-share, or use Send files. The hub saves them into your chosen folder.'),
        p('Moving from the previous browser-hosted hub? Pair again once: its browser storage cannot be imported automatically into the native backend.')],
    },
  ];
  const renderQuickInstall = (): void => {
    const target = document.querySelector('#quick-install-body');
    if (target === null) return;
    render(target, codeBlock(installer), p('Installs into your user account. No desktop Chrome, .NET runtime, root access, or login service is required.'),
      p(h('a', { href: '../install.sh', text: 'Read the installer' }), ' · Start afterward with ~/.local/bin/i6-share-hub --open.'));
  };
  function update(): void {
    const target = required('#stepper');
    render(target, ...steps.map((step, index) => {
      const active = read().active === index;
      const done = read().done.includes(index);
      const header = button(`${done ? '✓ ' : ''}${step.title}`, () => { transition((current) => nextActive(current, index)); update(); }, 'text');
      header.id = `step-${String(index)}-head`;
      header.setAttribute('aria-expanded', String(active));
      const body = h('div', { id: `step-${String(index)}-body`, class: 'step__body', hidden: !active });
      if (active) render(body, ...step.body(), h('div', { class: 'step__actions' }, button(index === steps.length - 1 ? 'Finish' : 'Done, next', () => {
        transition((current) => ({ ...withDone(current, index), active: index === steps.length - 1 ? -1 : index + 1 })); update();
      }, 'contained')));
      return h('section', { class: `step${active ? ' step--active' : ''}${done ? ' step--done' : ''}` }, header, h('p', { class: 'caption muted', text: step.caption }), body);
    }), read().done.length === steps.length ? h('p', { class: 'setup-finish', text: 'Ready to share. Start the hub whenever you want to receive files.' }) : null);
  }
  const init = (): void => {
    if (read().active < -1 || read().active >= steps.length) transition(() => initialState);
    renderQuickInstall(); update();
    required('#reset').addEventListener('click', () => { transition(() => initialState); update(); }, { signal: lifetime.signal });
  };
  return { init, update, loadVersion, testConnection, renderQuickInstall, getState: read, dispose: (): void => { lifetime.abort(); } };
};
export const initializeSetup = (): Promise<void> => Effect.runPromise(Effect.sync(() => { createSetup().init(); }));
