// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initializePhoneUi } from '../public/app.js';
import type { PhoneEngine, PhoneHub, PhoneUiController } from '../public/app.js';
import { AbortedError } from '../public/client.js';
import { closeDialog, requireElement } from '../public/lib/dom.js';
import { encodePairPayload, pairLink } from '../public/lib/proto.js';

const hub: PhoneHub = { id: '0011223344556677', name: 'Computer', status: 'online', lastSeen: 1, rec: { hubId: '0011223344556677', name: 'Computer', addrs: [], lastAddr: '', port: 47616, secret: '', pairedAt: 0, lastSeen: 0 } };
const makeHarness = () => {
  const pair = vi.fn<PhoneEngine['pair']>().mockResolvedValue(hub);
  const engine: PhoneEngine = {
    hubs: [], transfers: [], deviceName: 'Phone', deviceId: '1234567890abcdef', hub: () => undefined,
    addEventListener: () => undefined, removeEventListener: () => undefined,
    init: () => Promise.resolve(), pair,
    send: () => Promise.resolve('tid'), forget: () => Promise.resolve(), cancel: () => Promise.resolve(),
    setDeviceName: () => Promise.resolve(), kick: () => undefined, setVisible: () => undefined, stop: () => undefined,
  };
  const kv = { get: () => Promise.resolve(undefined), put: () => Promise.resolve(), delete: () => Promise.resolve(), all: () => Promise.resolve([]) };
  return { engine, kv, pair };
};
const code = (name = 'Computer'): string => pairLink(encodePairPayload({ hubId: '0011223344556677', token: new Uint8Array(16), port: 47616, addrs: ['127.0.0.1'], name }));
const click = (label: string): void => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const found = buttons.find((button) => button.textContent === label || button.getAttribute('aria-label') === label);
  if (found === undefined) throw new Error(`Missing button: ${label}`);
  found.click();
};
const flush = async (): Promise<void> => { await vi.advanceTimersByTimeAsync(1); };
const camera = () => {
  const stop = vi.fn<() => void>();
  const track: MediaStreamTrack = {
    contentHint: '', enabled: true, id: 'track', kind: 'video', label: 'Camera', muted: false, readyState: 'live',
    onended: null, onmute: null, onunmute: null,
    applyConstraints: () => Promise.resolve(), clone: () => track,
    getCapabilities: () => ({}), getConstraints: () => ({}), getSettings: () => ({}), stop,
    addEventListener: () => undefined, removeEventListener: () => undefined, dispatchEvent: () => true,
  };
  const stream = new MediaStream();
  Object.defineProperty(stream, 'getTracks', { value: () => [track] });
  const getUserMedia = vi.fn<MediaDevices['getUserMedia']>().mockResolvedValue(stream);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  const detect = vi.fn<(source: HTMLVideoElement) => Promise<readonly { readonly rawValue: string }[]>>().mockResolvedValue([]);
  const Detector = vi.fn(function () { return { detect }; });
  Object.defineProperty(window, 'BarcodeDetector', { configurable: true, value: Detector });
  return { stream, getUserMedia, detect, Detector, stop };
};
let ui: PhoneUiController | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  document.body.replaceChildren();
  for (const id of ['main', 'conn', 'bar-actions']) { const element = document.createElement('div'); element.id = id; document.body.append(element); }
  history.replaceState(null, '', '/');
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(4);
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: () => Promise.reject(new Error('unknown permission')) } });
});
afterEach(() => {
  ui?.dispose(); ui = undefined;
  Reflect.deleteProperty(window, 'BarcodeDetector');
  Reflect.deleteProperty(navigator, 'mediaDevices');
  document.querySelectorAll('dialog').forEach((dialog) => { closeDialog(dialog, null); });
  vi.useRealTimers();
});

it('scans valid QR codes and stops the camera after pairing', async () => {
  const harness = makeHarness();
  const cam = camera();
  cam.detect.mockResolvedValue([{ rawValue: code() }]);
  ui = await initializePhoneUi(harness);
  const scanning = ui.scan();
  await flush(); await scanning; await flush();
  expect(harness.pair).toHaveBeenCalledOnce();
  expect(cam.stop).toHaveBeenCalledOnce();
  expect(cam.Detector).toHaveBeenCalledWith({ formats: ['qr_code'] });
  expect(cam.getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'environment' }, audio: false });
});

it('handles scanner format-query failures, undecodable frames, and unrelated QR codes', async () => {
  const harness = makeHarness();
  const cam = camera();
  Object.defineProperty(cam.Detector, 'getSupportedFormats', { value: () => Promise.reject(new Error('unsupported query')) });
  cam.detect.mockRejectedValueOnce(new Error('frame not ready')).mockResolvedValueOnce([{ rawValue: 'not a pairing code' }]).mockResolvedValueOnce([{ rawValue: code() }]);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('autoplay blocked'));
  ui = await initializePhoneUi(harness);
  const scanning = ui.scan();
  await vi.advanceTimersByTimeAsync(210);
  expect(document.body.textContent).toContain('That QR code is not an i6-share pairing code.');
  await vi.advanceTimersByTimeAsync(210);
  await scanning; await flush();
  expect(harness.pair).toHaveBeenCalledOnce();
  expect(cam.stop).toHaveBeenCalledOnce();
});

it('offers manual entry when QR format support is absent', async () => {
  const harness = makeHarness();
  const cam = camera();
  Object.defineProperty(cam.Detector, 'getSupportedFormats', { value: () => Promise.resolve(['ean_13']) });
  ui = await initializePhoneUi(harness);
  const scanning = ui.scan(); await flush();
  expect(document.body.textContent).toContain("This browser can't scan QR codes");
  click('Cancel'); await scanning;
  expect(cam.getUserMedia).not.toHaveBeenCalled();
});

it('offers manual entry when camera APIs are absent despite a detector', async () => {
  const harness = makeHarness(); camera();
  Reflect.deleteProperty(navigator, 'mediaDevices');
  ui = await initializePhoneUi(harness);
  const scanning = ui.scan(); await flush(); click('Cancel'); await scanning;
  expect(harness.pair).not.toHaveBeenCalled();
});

it('reports denied camera permission and ordinary camera failures', async () => {
  const harness = makeHarness(); const cam = camera();
  cam.getUserMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError')).mockRejectedValueOnce(new Error('no camera')).mockRejectedValueOnce('device missing');
  ui = await initializePhoneUi(harness);
  for (const message of ['Camera access was denied.', 'Camera unavailable (no camera)', 'Camera unavailable (device missing)']) {
    const scanning = ui.scan(); await flush();
    expect(document.body.textContent).toContain(message);
    click('Cancel'); await scanning;
  }
});

it('stops a camera that finishes opening after the dialog was cancelled', async () => {
  const harness = makeHarness(); const cam = camera();
  const pending = Promise.withResolvers<MediaStream>();
  cam.getUserMedia.mockReturnValue(pending.promise);
  ui = await initializePhoneUi(harness);
  const scanning = ui.scan(); await flush();
  click('Cancel'); await scanning;
  pending.resolve(cam.stream); await flush();
  expect(cam.stop).toHaveBeenCalledOnce();
  expect(cam.detect).not.toHaveBeenCalled();
});

it('waits for usable video frames and switches from scanning to pasted codes', async () => {
  const harness = makeHarness(); const cam = camera();
  vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(0);
  ui = await initializePhoneUi(harness);
  const scanning = ui.scan(); await flush();
  expect(cam.detect).not.toHaveBeenCalled();
  click('Enter code'); await scanning; await flush();
  expect(document.body.textContent).toContain('Enter pairing code');
  const input = document.querySelector<HTMLInputElement>('dialog input');
  if (input === null) throw new Error('Missing code input');
  input.value = code(); click('Pair');
  await vi.advanceTimersByTimeAsync(220);
  expect(harness.pair).toHaveBeenCalledOnce();
  expect(cam.stop).toHaveBeenCalledOnce();
});

it('ignores concurrent pairing attempts and aborts when the user cancels', async () => {
  const harness = makeHarness();
  const pending = Promise.withResolvers<PhoneHub>();
  harness.pair.mockReturnValue(pending.promise);
  ui = await initializePhoneUi(harness);
  const pairing = ui.pair(code(''));
  expect(document.body.textContent).toContain('Looking for your computer');
  await ui.pair(code());
  expect(harness.pair).toHaveBeenCalledOnce();
  click('Cancel'); await flush();
  expect(harness.pair.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  pending.reject(AbortedError()); await pairing;
  expect(document.body.textContent).not.toContain('Pairing failed');
});

it('shows pairing failures and lets the user close or scan again', async () => {
  const harness = makeHarness();
  harness.pair.mockRejectedValue(new Error('expired code'));
  ui = await initializePhoneUi(harness);
  const first = ui.pair(code()); await flush();
  expect(document.body.textContent).toContain('expired code');
  click('Close'); await first;
  const second = ui.pair(code()); await flush();
  click('Scan again'); await second; await flush();
  expect(document.body.textContent).toContain("This browser can't scan QR codes");
  click('Cancel'); await flush();
  expect(requireElement('main').textContent).toContain('No computer paired yet');
});

it('aborts an in-flight pairing when the phone UI is disposed', async () => {
  const harness = makeHarness();
  const pending = Promise.withResolvers<PhoneHub>();
  harness.pair.mockImplementation((_payload, options) => {
    options?.signal?.addEventListener('abort', () => { pending.reject(AbortedError()); }, { once: true });
    return pending.promise;
  });
  ui = await initializePhoneUi(harness);
  const pairing = ui.pair(code());
  ui.dispose();
  await pairing;
  expect(harness.pair.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  expect(document.querySelector('dialog')).toBeNull();
});

it('releases camera tracks and settles the scanner when the phone UI is disposed', async () => {
  const harness = makeHarness(); const cam = camera();
  ui = await initializePhoneUi(harness);
  const scanning = ui.scan(); await flush();
  ui.dispose();
  await scanning;
  await vi.advanceTimersByTimeAsync(210);
  expect(cam.stop).toHaveBeenCalledOnce();
  expect(cam.detect).toHaveBeenCalledOnce();
  expect(document.querySelector('dialog')).toBeNull();
});

it('ignores a pairing result that arrives after the UI was disposed', async () => {
  const harness = makeHarness();
  const pending = Promise.withResolvers<PhoneHub>();
  harness.pair.mockReturnValue(pending.promise);
  ui = await initializePhoneUi(harness);
  const pairing = ui.pair(code());
  ui.dispose();
  pending.resolve(hub); await pairing;
  await ui.pair(code());
  expect(harness.pair).toHaveBeenCalledOnce();
  expect(document.querySelector('dialog')).toBeNull();
  expect(document.body.textContent).not.toContain('Paired with Computer');
});

it('does not open the camera when disposed while scanner capabilities are loading', async () => {
  const harness = makeHarness(); const cam = camera();
  const formats = Promise.withResolvers<readonly string[]>();
  Object.defineProperty(cam.Detector, 'getSupportedFormats', { value: () => formats.promise });
  ui = await initializePhoneUi(harness);
  const scanning = ui.scan();
  ui.dispose();
  formats.resolve(['qr_code']);
  await scanning;
  expect(cam.getUserMedia).not.toHaveBeenCalled();
  expect(document.querySelector('dialog')).toBeNull();
});
