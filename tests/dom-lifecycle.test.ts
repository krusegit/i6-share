// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { wakeLock } from '../public/lib/dom.js';

const sentinel = () => {
  const release = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const lock: WakeLockSentinel = Object.assign(new EventTarget(), { released: false, type: 'screen' as const, onrelease: null, release });
  return { lock, release };
};
const flush = async (): Promise<void> => { await vi.advanceTimersByTimeAsync(1); };
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('coalesces pending wake-lock requests and releases a lock acquired after transfers stop', async () => {
  const pending = Promise.withResolvers<WakeLockSentinel>();
  const request = vi.fn<WakeLock['request']>().mockReturnValue(pending.promise);
  vi.stubGlobal('navigator', { wakeLock: { request } });
  const busy = wakeLock();
  busy(true); busy(true);
  document.dispatchEvent(new Event('visibilitychange'));
  expect(request).toHaveBeenCalledOnce();
  busy(false);
  const acquired = sentinel();
  pending.resolve(acquired.lock); await flush();
  expect(acquired.release).toHaveBeenCalledOnce();
  busy.dispose();
});

it('disposes visibility listeners and releases a pending acquisition after teardown', async () => {
  const pending = Promise.withResolvers<WakeLockSentinel>();
  const request = vi.fn<WakeLock['request']>().mockReturnValue(pending.promise);
  vi.stubGlobal('navigator', { wakeLock: { request } });
  const busy = wakeLock();
  busy(true);
  busy.dispose();
  const acquired = sentinel();
  pending.resolve(acquired.lock); await flush();
  expect(acquired.release).toHaveBeenCalledOnce();
  document.dispatchEvent(new Event('visibilitychange')); await flush();
  expect(request).toHaveBeenCalledOnce();
});

it('retains the current lock when a superseded sentinel dispatches a late release event', async () => {
  const first = sentinel(); const second = sentinel();
  const request = vi.fn<WakeLock['request']>().mockResolvedValueOnce(first.lock).mockResolvedValueOnce(second.lock);
  vi.stubGlobal('navigator', { wakeLock: { request } });
  const busy = wakeLock();
  busy(true); await flush();
  busy(false); busy(true); await flush();
  first.lock.dispatchEvent(new Event('release'));
  busy(false); await flush();
  expect(first.release).toHaveBeenCalledOnce();
  expect(second.release).toHaveBeenCalledOnce();
  busy.dispose();
});
