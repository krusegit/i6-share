import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { activate, CACHE, handleFetch, initializeServiceWorker, install, navigationKey, networkFirst, receiveShare, registerServiceWorker, sharedFiles, staleWhileRevalidate, type LifetimeEvent, type WorkerCache, type WorkerDependencies, type WorkerFetchEvent } from '../public/sw.js';

const put = vi.hoisted(() => vi.fn<(key: string, value: unknown) => Promise<void>>().mockResolvedValue(undefined));
vi.mock('../public/lib/store.js', () => ({ store: () => ({ put }) }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const fixture = () => {
  const cache: WorkerCache = {
    addAll: vi.fn<(requests: Request[]) => Promise<void>>().mockResolvedValue(undefined),
    add: vi.fn<(request: Request) => Promise<void>>().mockResolvedValue(undefined),
    put: vi.fn<(request: RequestInfo | URL, response: Response) => Promise<void>>().mockResolvedValue(undefined),
    match: vi.fn<(request: RequestInfo | URL, options?: CacheQueryOptions) => Promise<Response | undefined>>().mockResolvedValue(undefined),
  };
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('network'));
  const handlers = new Map<string, (event: LifetimeEvent & WorkerFetchEvent) => void>();
  const dependencies: WorkerDependencies = {
    scope: {
      registration: { scope: 'https://example.com/app/' }, location: { origin: 'https://example.com' },
      caches: { open: vi.fn().mockResolvedValue(cache), keys: vi.fn().mockResolvedValue([CACHE, 'i6-share-old', 'other']), delete: vi.fn().mockResolvedValue(true) },
      fetch: fetcher, clients: { claim: vi.fn().mockResolvedValue(undefined) }, skipWaiting: vi.fn().mockResolvedValue(undefined),
      addEventListener: (type, handler) => { handlers.set(type, handler); },
    },
    stage: vi.fn().mockResolvedValue(undefined), now: () => new Date('2026-01-01T12:34:56Z'), report: vi.fn(),
  };
  const event = (request = new Request('https://example.com/app/')): WorkerFetchEvent => ({ request, waitUntil: vi.fn(), respondWith: vi.fn() });
  return { dependencies, cache, fetcher, handlers, event };
};
const navigation = (url: string): Request => {
  const request = new Request(url);
  Object.defineProperty(request, 'mode', { value: 'navigate' });
  return request;
};
const basicResponse = (body: string, status = 200): Response => {
  const response = new Response(body, { status });
  Object.defineProperty(response, 'type', { value: 'basic' });
  return response;
};

describe('service worker cache lifetime', () => {
  it('installs the required shell, tolerates optional failures, activates and preserves unrelated caches', async () => {
    const { dependencies, cache } = fixture();
    vi.mocked(cache.add).mockRejectedValue(new Error('missing icon'));
    await Effect.runPromise(install(dependencies));
    expect(cache.addAll).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ url: 'https://example.com/app/app.js', cache: 'reload' })]));
    expect(dependencies.scope.skipWaiting).toHaveBeenCalledOnce();
    await Effect.runPromise(activate(dependencies));
    expect(dependencies.scope.caches.delete).toHaveBeenCalledExactlyOnceWith('i6-share-old');
    expect(dependencies.scope.clients.claim).toHaveBeenCalledOnce();
  });
  it('rejects mandatory shell failure', async () => {
    const { dependencies, cache } = fixture();
    vi.mocked(cache.addAll).mockRejectedValue(new Error('offline'));
    await expect(Effect.runPromise(install(dependencies))).rejects.toThrow('offline');
    expect(dependencies.scope.skipWaiting).not.toHaveBeenCalled();
  });
  it('registers handlers including browser dependencies', async () => {
    const { dependencies, handlers, event } = fixture();
    registerServiceWorker(dependencies);
    const e = event();
    handlers.get('install')?.(e);
    handlers.get('activate')?.(e);
    handlers.get('fetch')?.(e);
    await Promise.all(vi.mocked(e.waitUntil).mock.calls.map(([promise]) => promise));
    await Promise.all(vi.mocked(e.respondWith).mock.calls.map(([promise]) => promise));
    vi.stubGlobal('self', dependencies.scope);
    initializeServiceWorker();
    const form = new FormData();
    form.set('text', 'hello');
    const share = event(new Request('https://example.com/app/share-target', { method: 'POST', body: form }));
    handlers.get('fetch')?.(share);
    await Promise.all(vi.mocked(share.respondWith).mock.calls.map(([promise]) => promise));
    expect(put).toHaveBeenCalledWith('staged', expect.arrayContaining([expect.any(File)]));
    put.mockRejectedValueOnce(new Error('storage'));
    const failed = event(new Request('https://example.com/app/share-target', { method: 'POST', body: form }));
    const report = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    handlers.get('fetch')?.(failed);
    await Promise.all(vi.mocked(failed.respondWith).mock.calls.map(([promise]) => promise));
    expect(report).toHaveBeenCalled();
  });
});

describe('network strategies', () => {
  it('caches fresh build metadata and retains non-ok responses', async () => {
    const { dependencies, cache, fetcher } = fixture();
    const req = new Request('https://example.com/app/build-info.js');
    await expect(Effect.runPromise(networkFirst(dependencies, req)).then((r) => r.text())).resolves.toBe('network');
    expect(cache.put).toHaveBeenCalledOnce();
    fetcher.mockResolvedValue(new Response('missing', { status: 404 }));
    await expect(Effect.runPromise(networkFirst(dependencies, req)).then((r) => r.status)).resolves.toBe(404);
    expect(cache.put).toHaveBeenCalledOnce();
    fetcher.mockRejectedValue(new Error('offline'));
    vi.mocked(cache.match).mockResolvedValue(new Response('cached'));
    await expect(Effect.runPromise(networkFirst(dependencies, req)).then((r) => r.text())).resolves.toBe('cached');
    vi.mocked(cache.match).mockResolvedValue(undefined);
    await expect(Effect.runPromise(networkFirst(dependencies, req))).rejects.toThrow('offline');
  });
  it('serves stale content immediately while keeping revalidation alive, swallowing its failure', async () => {
    const { dependencies, cache, fetcher, event } = fixture();
    vi.mocked(cache.match).mockResolvedValue(new Response('cached'));
    const e = event();
    fetcher.mockRejectedValue(new Error('offline'));
    const response = await Effect.runPromise(staleWhileRevalidate(dependencies, e, e.request));
    expect(await response.text()).toBe('cached');
    await Promise.all(vi.mocked(e.waitUntil).mock.calls.map(([promise]) => promise));
  });
  it.each([{ basic: true, status: 200, cached: 1 }, { basic: true, status: 404, cached: 0 }, { basic: false, status: 200, cached: 0 }])('stores only successful same-origin basic responses $basic $status', async ({ basic, status, cached }) => {
    const { dependencies, cache, fetcher, event } = fixture();
    fetcher.mockResolvedValue(basic ? basicResponse('response', status) : new Response('response', { status }));
    const e = event();
    expect(await (await Effect.runPromise(staleWhileRevalidate(dependencies, e, e.request))).text()).toBe('response');
    expect(cache.put).toHaveBeenCalledTimes(cached);
  });
  it.each(['https://example.com/app/?share=1', 'https://example.com/app/index.html#pair=x'])('falls back to an offline shell for %s', async (url) => {
    const { dependencies, cache, fetcher, event } = fixture();
    fetcher.mockRejectedValue(new Error('offline'));
    vi.mocked(cache.match).mockResolvedValueOnce(undefined).mockResolvedValueOnce(new Response('shell'));
    const req = navigation(url);
    expect(await (await Effect.runPromise(staleWhileRevalidate(dependencies, event(req), req))).text()).toBe('shell');
    expect(navigationKey(req)).toBe(url.split(/[?#]/)[0]);
  });
  it('uses index.html fallback and fails when all fallback shells are absent', async () => {
    const { dependencies, cache, fetcher, event } = fixture();
    fetcher.mockRejectedValue(new Error('offline'));
    vi.mocked(cache.match).mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined).mockResolvedValueOnce(new Response('index'));
    const req = navigation('https://example.com/app/');
    expect(await (await Effect.runPromise(staleWhileRevalidate(dependencies, event(req), req))).text()).toBe('index');
    vi.mocked(cache.match).mockResolvedValue(undefined);
    await expect(Effect.runPromise(staleWhileRevalidate(dependencies, event(req), req))).rejects.toThrow('offline');
  });
  it.each(['https://example.com/app/other', 'https://example.com/app/other?x=1'])('does not apply shell fallback to arbitrary resources %s', async (url) => {
    const { dependencies, fetcher, event } = fixture();
    fetcher.mockRejectedValue(new Error('offline'));
    const req = url.includes('?') ? navigation(url) : new Request(url);
    await expect(Effect.runPromise(staleWhileRevalidate(dependencies, event(req), req))).rejects.toThrow('offline');
  });
});

describe('share target and routing', () => {
  it('stages file shares, preserving empty named files and rejecting empty nameless blobs', async () => {
    const form = new FormData();
    form.append('files', 'ignored');
    form.append('files', new File(['data'], ''));
    form.append('files', new File([], 'empty.txt'));
    form.append('files', new File([], ''));
    expect(sharedFiles(form, new Date()).map((file) => file.size)).toEqual([4, 0]);
    const { dependencies } = fixture();
    const res = await Effect.runPromise(receiveShare(dependencies, new Request('https://example.com/app/share-target', { method: 'POST', body: form })));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://example.com/app/?share=1');
    expect(dependencies.stage).toHaveBeenCalledOnce();
  });
  it('converts deduplicated shared text to a timestamped file', async () => {
    const form = new FormData();
    form.set('title', 'same'); form.set('text', 'same'); form.set('url', 'https://example.com');
    const files = sharedFiles(form, new Date('2026-01-01T12:34:56Z'));
    expect(files[0]?.name).toBe('shared-2026-01-01-12-34-56.txt');
    expect(await files[0]?.text()).toBe('same\nhttps://example.com\n');
    form.set('title', ' '); form.delete('text'); form.delete('url');
    expect(sharedFiles(form, new Date())).toEqual([]);
    const { dependencies } = fixture();
    await Effect.runPromise(receiveShare(dependencies, new Request('https://example.com/app/share-target', { method: 'POST', body: form })));
    expect(dependencies.stage).not.toHaveBeenCalled();
  });
  it('reports malformed shares and still redirects', async () => {
    const { dependencies } = fixture();
    const response = await Effect.runPromise(receiveShare(dependencies, new Request('https://example.com/app/share-target', { method: 'POST', body: 'not a form' })));
    expect(response.status).toBe(303); expect(dependencies.report).toHaveBeenCalledOnce();
  });
  it.each([
    new Request('http://127.0.0.1:47616/i6/hello'),
    new Request('https://example.com/app/nope', { method: 'POST' }),
    new Request('https://example.com/app/file', { headers: { range: 'bytes=0-10' } }),
    new Request('https://example.com/elsewhere'),
    new Request('https://example.com/app/hub.swbn'),
  ])('leaves non-cacheable requests untouched', (request) => {
    const { dependencies, event } = fixture(); const e = event(request); handleFetch(dependencies, e); expect(e.respondWith).not.toHaveBeenCalled();
  });
  it.each(['build-info.js', 'app.js'])('routes %s into a response', async (path) => {
    const { dependencies, event } = fixture(); const e = event(new Request(`https://example.com/app/${path}`)); handleFetch(dependencies, e);
    await Promise.all(vi.mocked(e.respondWith).mock.calls.map(([promise]) => promise)); expect(e.respondWith).toHaveBeenCalledOnce();
  });
});
