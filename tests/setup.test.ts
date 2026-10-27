// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSetup, initializeSetup, loadState, nextActive, withDone } from '../public/setup/setup.js';

const hello = { app: 'i6-share-hub', v: 1, id: '0011223344556677', name: 'Native PC', port: 47616, addrs: ['192.168.1.2'] };
const release = { version: '1.1.0', artifacts: { 'linux-x64': { file: 'x64.tar.gz', sha256: 'a', size: 1024 }, 'linux-arm64': { file: 'arm64.tar.gz', sha256: 'b', size: 2048 } } };
const required = (selector: string): HTMLElement => {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing ${selector}`);
  return element;
};
const click = (text: string): void => {
  const control = [...document.querySelectorAll('button')].find((element) => element.textContent === text);
  if (control === undefined) throw new Error(`Missing button ${text}`);
  control.click();
};
beforeEach(() => {
  localStorage.clear();
  document.body.replaceChildren(...['stepper', 'reset', 'quick-install-body'].map((id) => Object.assign(document.createElement(id === 'reset' ? 'button' : 'div'), { id })));
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(release))));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('native setup', () => {
  it('validates storage and computes immutable progress', () => {
    expect(loadState(localStorage)).toEqual({ active: 0, done: [] });
    localStorage.setItem('i6-native-setup-v1', 'bad');
    expect(loadState(localStorage)).toEqual({ active: 0, done: [] });
    localStorage.setItem('i6-native-setup-v1', '{"active":1,"done":[0]}');
    const state = loadState(localStorage);
    expect(nextActive(state, 1)).toEqual({ active: -1, done: [0] });
    expect(nextActive(state, 2)).toEqual({ active: 2, done: [0] });
    expect(withDone(state, 0).done).toBe(state.done);
    expect(withDone(state, 1).done).toEqual([0, 1]);
    expect(loadState({ getItem: () => { throw new Error('blocked'); } })).toEqual({ active: 0, done: [] });
  });
  it('initializes native instructions and completes every step', async () => {
    await initializeSetup();
    expect(document.body.textContent).toContain('self-contained native executable');
    expect(document.body.textContent).not.toContain('chrome://');
    expect(required('#quick-install-body').textContent).toContain('curl -fsSL');
    expect(document.querySelectorAll('.step')).toHaveLength(4);
    click('Done, next');
    expect(document.body.textContent).toContain('--rollback');
    click('Done, next');
    expect(document.body.textContent).toContain('i6-share-hub --open');
    click('Done, next');
    expect(document.body.textContent).toContain('Pair again once');
    click('Finish');
    expect(required('.setup-finish').textContent).toContain('Ready to share');
    required('#step-0-head').click();
    expect(required('#step-0-head').getAttribute('aria-expanded')).toBe('true');
    required('#step-0-head').click();
    expect(required('#step-0-head').getAttribute('aria-expanded')).toBe('false');
    required('#reset').click();
    expect(required('#step-0-head').getAttribute('aria-expanded')).toBe('true');
  });
  it.each([-2, 4])('repairs invalid active index %s', (active) => {
    localStorage.setItem('i6-native-setup-v1', JSON.stringify({ active, done: [] }));
    const setup = createSetup(); setup.init();
    expect(setup.getState().active).toBe(0);
    setup.dispose();
  });
  it('allows a collapsed initial state, inaccessible storage, missing optional markup and rejects missing required markup', () => {
    localStorage.setItem('i6-native-setup-v1', '{"active":-1,"done":[]}');
    const setup = createSetup(); setup.init();
    expect(setup.getState().active).toBe(-1);
    required('#quick-install-body').remove(); setup.renderQuickInstall();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('readonly'); });
    required('#step-0-head').click();
    setup.dispose();
    required('#stepper').remove();
    expect(() => { createSetup().init(); }).toThrow('Missing setup element');
  });
  it('shows validated release metadata and both failure paths', async () => {
    const setup = createSetup(); const target = document.createElement('div');
    await setup.loadVersion(target);
    expect(target.textContent).toBe('Version 1.1.0 · x64 1.0 KB · ARM64 2.0 KB');
    for (const response of [new Response('', { status: 404 }), new Response('{}'), new Response('bad')]) {
      vi.mocked(fetch).mockResolvedValue(response); await setup.loadVersion(target);
      expect(target.textContent).toContain('unavailable');
    }
    setup.dispose();
  });
  it('ignores delayed release metadata after disposal', async () => {
    const pending = Promise.withResolvers<Response>();
    vi.mocked(fetch).mockReturnValue(pending.promise);
    const setup = createSetup(); const target = document.createElement('div');
    const loaded = setup.loadVersion(target); setup.dispose(); pending.resolve(new Response(JSON.stringify(release))); await loaded;
    expect(target.textContent).toBe('');
  });
  it('checks the native local hub and marks the process step complete', async () => {
    const setup = createSetup(); setup.init();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(hello)));
    const control = document.createElement('button'); const target = document.createElement('div');
    await setup.testConnection(control, target);
    expect(target.textContent).toContain('Connected to Native PC');
    expect(control.disabled).toBe(false); expect(setup.getState().done).toContain(2);
    required('#step-2-head').click();
    click('Test connection');
    await vi.waitFor(() => { expect(setup.getState().done).toContain(2); });
    setup.dispose();
  });
  it('rejects failed, malformed and unrelated local services', async () => {
    const setup = createSetup(); setup.init();
    const control = document.createElement('button'); const target = document.createElement('div');
    for (const response of [new Response('', { status: 503 }), new Response('{}'), new Response(JSON.stringify({ ...hello, app: 'other' }))]) {
      vi.mocked(fetch).mockResolvedValue(response); await setup.testConnection(control, target);
      expect(target.textContent).toContain('Could not reach'); expect(control.disabled).toBe(false);
    }
    setup.dispose();
  });
  it('ignores an outstanding local probe and removes the reset listener after disposal', async () => {
    const setup = createSetup(); setup.init(); required('#step-1-head').click();
    const pending = Promise.withResolvers<Response>(); vi.mocked(fetch).mockReturnValue(pending.promise);
    const control = document.createElement('button'); const target = document.createElement('div');
    const probing = setup.testConnection(control, target); setup.dispose();
    pending.resolve(new Response(JSON.stringify(hello))); await probing;
    expect(target.textContent).toBe('Checking this computer…');
    required('#reset').click(); expect(setup.getState().active).toBe(1);
  });
});
