// @vitest-environment happy-dom
import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSetup, detectBrowser, initializeSetup, loadState, nextActive, normalizeOs, withDone } from '../public/setup/setup.js';

const setBrowser = (ua: string, data?: unknown): void => {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: ua });
  if (data === undefined) Reflect.deleteProperty(navigator, 'userAgentData');
  else Object.defineProperty(navigator, 'userAgentData', { configurable: true, value: data });
};
const required = (selector: string): HTMLElement => {
  const result = document.querySelector(selector);
  if (!(result instanceof HTMLElement)) throw new Error(`Missing test element: ${selector}`);
  return result;
};
const clickText = (text: string, root: ParentNode = document): void => {
  const found = [...root.querySelectorAll('button')].find((element) => element.textContent === text);
  if (found === undefined) throw new Error(`Missing button: ${text}`);
  found.click();
};
beforeEach(() => {
  document.body.replaceChildren(...['stepper', 'notice', 'reset', 'quick-install-body'].map((id) => Object.assign(document.createElement(id === 'reset' ? 'button' : 'div'), { id })));
  localStorage.clear();
  setBrowser('Chrome/156 Linux');
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('{}')));
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => undefined);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('setup state and browser decoding', () => {
  it('validates saved state and performs immutable transitions', () => {
    expect(loadState(localStorage)).toEqual({ active: 0, done: [] });
    localStorage.setItem('i6-setup-v1', '{bad');
    expect(loadState(localStorage)).toEqual({ active: 0, done: [] });
    localStorage.setItem('i6-setup-v1', '{"active":2,"done":[0,1]}');
    const state = loadState(localStorage);
    expect(nextActive(state, 2)).toEqual({ active: -1, done: [0, 1] });
    expect(nextActive(state, 3)).toEqual({ active: 3, done: [0, 1] });
    expect(withDone(state, 1).done).toBe(state.done);
    expect(withDone(state, 2).done).toEqual([0, 1, 2]);
    expect(loadState({ getItem: () => { throw new Error('blocked'); } })).toEqual({ active: 0, done: [] });
  });
  it.each([['', 'unknown'], ['linux', 'Linux'], ['Chrome OS', 'ChromeOS'], ['Android', 'Android'], ['windows', 'Windows'], ['macOS', 'macOS'], ['Haiku', 'Haiku']])('normalizes %s to %s', (platform, os) => { expect(normalizeOs(platform)).toBe(os); });
  it.each([
    ['Chrome/156 Linux', 'Google Chrome', 'Linux', 156], ['Chrome/153 Edg/153 Windows', 'Microsoft Edge', 'Windows', 153],
    ['Chrome/151 OPR/10 Mac OS X', 'Opera', 'macOS', 151], ['Chromium/150 CrOS', 'Chromium', 'ChromeOS', 150],
    ['Firefox/100 Android', 'Firefox', 'Android', 0], ['Safari/100 iPhone', 'Safari', 'iOS', 0], ['mystery', 'an unknown browser', 'unknown', 0],
  ])('decodes user agent %s', async (ua, browser, os, major) => {
    setBrowser(ua); expect(await Effect.runPromise(detectBrowser(navigator))).toEqual({ browser, os, major, chromiumBased: major !== 0 });
  });
  it('uses high-entropy brands and falls back to low-entropy metadata', async () => {
    setBrowser('unrecognized', { platform: 'Linux', brands: [{ brand: 'Chromium', version: '120' }], getHighEntropyValues: () => Promise.resolve({ fullVersionList: [{ brand: 'Chromium', version: '156.1' }, { brand: 'Google Chrome', version: '156' }] }) });
    expect(await Effect.runPromise(detectBrowser(navigator))).toEqual({ browser: 'Google Chrome', major: 156, os: 'Linux', chromiumBased: true });
    setBrowser('unrecognized', { platform: 'Linux', brands: [{ brand: 'Chromium', version: 'n/a' }, { brand: 'Brave', version: '1' }], getHighEntropyValues: () => Promise.reject(new Error('denied')) });
    expect(await Effect.runPromise(detectBrowser(navigator))).toMatchObject({ browser: 'Brave', major: 0 });
    setBrowser('Chrome/156 Linux', { platform: '', brands: [{ brand: 'Chromium', version: '140' }], getHighEntropyValues: () => Promise.resolve({ fullVersionList: [] }) });
    expect(await Effect.runPromise(detectBrowser(navigator))).toMatchObject({ browser: 'Chromium', major: 140, os: 'Linux' });
    setBrowser('Chrome/156 Linux', { brands: [], getHighEntropyValues: () => Promise.resolve(null) });
    expect(await Effect.runPromise(detectBrowser(navigator))).toMatchObject({ browser: 'Google Chrome', major: 156 });
    setBrowser('Chrome/156 Linux', { platform: false, brands: false, getHighEntropyValues: 'no' });
    expect(await Effect.runPromise(detectBrowser(navigator))).toMatchObject({ major: 156 });
    setBrowser('Chrome/156 Linux', null);
    expect(await Effect.runPromise(detectBrowser(navigator))).toMatchObject({ major: 156 });
    setBrowser('Chrome/156 Linux', { getHighEntropyValues: () => Promise.resolve({ other: true }) });
    expect(await Effect.runPromise(detectBrowser(navigator))).toMatchObject({ major: 156 });
  });
});

describe('onboarding stepper', () => {
  it('initializes all entry points, navigates every step, finishes, collapses, and resets', async () => {
    await initializeSetup();
    expect(required('#quick-install-body').textContent).toContain('curl -fsSL');
    expect(document.querySelectorAll('.step')).toHaveLength(7);
    for (let index = 0; index < 6; index += 1) clickText('Done, next', required(`#step-${String(index)}-body`));
    clickText('Finish', required('#step-6-body'));
    expect(required('.setup-finish').classList.contains('hidden')).toBe(false);
    required('#step-1-head').click();
    expect(required('#step-1-head').getAttribute('aria-expanded')).toBe('true');
    required('#step-1-head').click();
    expect(required('#step-1-head').getAttribute('aria-expanded')).toBe('false');
    required('#reset').click();
    expect(required('#step-0-head').getAttribute('aria-expanded')).toBe('true');
    expect(JSON.parse(localStorage.getItem('i6-setup-v1') ?? '')).toEqual({ active: 0, done: [] });
  });
  it('supports keyboard navigation, back buttons, bounds, and motion preferences', async () => {
    const setup = createSetup(); await setup.init();
    required('#step-1-head').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    expect(setup.getState().active).toBe(1);
    clickText('Back', required('#step-1-body'));
    required('#step-1-head').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true }));
    required('#step-1-head').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(setup.getState().active).toBe(1);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 100));
    setup.setActive(0);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 1000));
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
    setup.setActive(3);
    expect(scroll).toHaveBeenLastCalledWith({ behavior: 'auto', block: 'start' });
    setup.setActive(99); setup.renderBody(-1); setup.update(false);
    expect(setup.getState().active).toBe(99);
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('private'); } });
    setup.markDone(1); setup.markDone(1);
    expect(setup.getState().done).toEqual([1]);
  });
  it('repairs a saved out-of-range active step and handles optional/missing markup', async () => {
    localStorage.setItem('i6-setup-v1', '{"active":100,"done":[]}');
    const setup = createSetup(); await setup.init();
    expect(setup.getState().active).toBe(0);
    required('#quick-install-body').remove(); setup.renderQuickInstall();
    required('#stepper').remove();
    await expect(createSetup().init()).rejects.toThrow('Missing setup element');
  });
  it.each([
    ['Firefox/150 Linux', 'needs Google Chrome'], ['Chrome/153 Edg/153 Linux', 'may be missing'],
    ['Chrome/119 Linux', 'too old'], ['Chromium/156 Linux', 'Supported, but'],
    ['Chrome/156 Android', 'This guide is for your Linux computer'], ['Safari/150 iPad', 'This guide is for your Linux computer'],
    ['Chrome/156 Windows', 'not tested'], ['mystery', 'Unknown operating system'],
  ])('renders appropriate browser guidance for %s', async (ua, message) => {
    setBrowser(ua); const setup = createSetup(); await setup.init();
    expect(document.body.textContent).toContain(message);
    expect(setup.getBrowser().os).toBeDefined();
    setup.setActive(3);
    expect(required('#step-3-body').textContent).toContain('chrome://');
  });
});

describe('version and local connection checks', () => {
  it('renders validated release details, optional fields, and download errors', async () => {
    const setup = createSetup(); const output = document.createElement('div');
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ version: '1.2.3', size: 1024, builtAt: '2026-01-01', webBundleId: 'abc' })));
    await setup.loadVersion(output);
    expect(output.textContent).toContain('Version 1.2.3'); expect(output.textContent).toContain('1.0 KB'); expect(output.textContent).toContain('isolated-app://abc/');
    vi.mocked(fetch).mockResolvedValue(new Response('{}')); await setup.loadVersion(output); expect(output.textContent).toBe('Latest version');
    vi.mocked(fetch).mockResolvedValue(new Response('{"version":"","builtAt":"invalid","webBundleId":""}')); await setup.loadVersion(output); expect(output.textContent).toBe('Latest version');
    vi.mocked(fetch).mockResolvedValue(new Response('{"builtAt":""}')); await setup.loadVersion(output);
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 404 })); await setup.loadVersion(output); expect(output.textContent).toContain('unavailable');
    vi.mocked(fetch).mockResolvedValue(new Response('[]')); await setup.loadVersion(output); expect(output.textContent).toContain('unavailable');
  });
  it('recognizes unrelated services, malformed responses, and HTTP failures', async () => {
    const setup = createSetup(); await setup.init(); const button = document.createElement('button'); const out = document.createElement('div');
    for (const response of [new Response('bad json'), new Response('{"app":"other"}'), new Response('{"app":"i6-share-hub"}', { status: 503 })]) {
      vi.mocked(fetch).mockResolvedValue(response); await setup.testConnection(button, out);
      expect(out.textContent).toContain("isn't the i6-share Hub"); expect(button.disabled).toBe(false);
    }
  });
  it('shows connected IPv4/IPv6 addresses, marks the step done, and supports defaults', async () => {
    const setup = createSetup(); await setup.init(); const button = document.createElement('button'); const out = document.createElement('div');
    vi.mocked(fetch).mockResolvedValue(new Response('{"app":"i6-share-hub","name":"PC","addrs":["192.168.1.1","::1",""],"port":1234}'));
    await setup.testConnection(button, out);
    expect(out.textContent).toContain('Connected to "PC"'); expect(out.textContent).toContain('192.168.1.1:1234, [::1]:1234'); expect(setup.getState().done).toContain(5);
    for (const payload of [{ app: 'i6-share-hub' }, { app: 'i6-share-hub', name: '', addrs: [] }, { app: 'i6-share-hub', addrs: ['::1', '127.0.0.1'], port: 0 }, { app: 'i6-share-hub', addrs: ['127.0.0.1'] }]) {
      vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(payload))); await setup.testConnection(button, out); expect(out.textContent).toContain('Connected to "i6-share Hub"');
    }
    setup.setActive(5);
    vi.mocked(fetch).mockResolvedValue(new Response('{"app":"i6-share-hub"}'));
    clickText('Test connection', required('#step-5-body'));
    await vi.waitFor(() => { expect(required('#step-5-body').textContent).toContain('The hub reports no network address'); });
  });
  it.each([new DOMException('late', 'TimeoutError'), new Error('offline'), 'unknown failure'])('explains failed probes and re-enables the button', async (error) => {
    const setup = createSetup(); await setup.init(); const button = document.createElement('button'); const out = document.createElement('div');
    vi.mocked(fetch).mockRejectedValue(error); await setup.testConnection(button, out);
    expect(out.textContent).toContain(error instanceof Error && error.name === 'TimeoutError' ? "didn't answer in time" : "Couldn't reach the hub"); expect(button.disabled).toBe(false);
  });
});
