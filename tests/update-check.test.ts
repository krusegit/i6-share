import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkForUpdate, compareVersions, isVersion, VERSION_URL } from '../hub/update-check.js';

const respond = (body: unknown, status = 200) => vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }));
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('update version checks', () => {
  it('validates and compares numeric versions including uneven and invalid parts', () => {
    expect(isVersion(undefined)).toBe(false);
    expect(isVersion('1.bad')).toBe(false);
    expect(isVersion(' v01.2.03 ')).toBe(true);
    expect(compareVersions('v1.9', '1.10')).toBe(-1);
    expect(compareVersions('2', '1.99')).toBe(1);
    expect(compareVersions('1', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.1', '1')).toBe(1);
    expect(compareVersions('bad', '')).toBe(0);
  });
  it('retains metadata and omits credentials/cache when fetching', async () => {
    const fetcher = respond({ version: ' 1.2.3 ', size: 123 });
    const result = await checkForUpdate({ current: '1.0', fetch: fetcher });
    expect(result).toEqual({ available: true, latest: '1.2.3', info: { version: ' 1.2.3 ', size: 123 } });
    expect(fetcher.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(fetcher).toHaveBeenCalledWith(VERSION_URL, expect.objectContaining({ credentials: 'omit', cache: 'no-store' }));
    expect(await checkForUpdate({ current: '2', url: '/custom', fetch: respond({ version: '1' }) })).toMatchObject({ available: false });
    expect(await checkForUpdate({ current: 'bad', fetch: respond({ version: '1' }) })).toMatchObject({ available: false });
  });
  it('uses the global fetch and handles absent options/current', async () => {
    vi.stubGlobal('fetch', respond({ version: '1' }));
    expect(await checkForUpdate()).toMatchObject({ available: false, latest: '1' });
  });
  it('returns no information on invalid responses and failures', async () => {
    for (const body of [null, {}, { version: 7 }, { version: 'latest' }]) {
      expect(await checkForUpdate({ fetch: respond(body) })).toBeNull();
    }
    expect(await checkForUpdate({ fetch: respond({}, 503) })).toBeNull();
    expect(await checkForUpdate({ fetch: vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')) })).toBeNull();
    expect(await checkForUpdate({ fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('{')) })).toBeNull();
  });
  it('times out even when the fetch implementation ignores cancellation', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(() => new Promise<Response>(() => undefined));
    const pending = checkForUpdate({ fetch: fetcher, timeoutMs: 25 });
    await vi.advanceTimersByTimeAsync(26);
    expect(await pending).toBeNull();
  });
});
