import { afterEach, describe, expect, it, vi } from 'vitest';
import { AbortedError, createShareEngine, guessDevice, hello, HttpError, isAbortedError, isClientError, locateHub, memoryStore, NetError, PairError, pairWithHub, sweepCandidates, UnpairedError } from '../public/client.js';
import { b64url, deviceKey, encodePairPayload, open, pairKey, requestAad, responseAad, seal, type PairPayload } from '../public/lib/proto.js';
import * as protocol from '../public/lib/proto.js';
import type { ClientEvents, Fetch, HubRecord, PairIdentity, ShareEngine } from '../public/client-types.js';

const payload: PairPayload = { hubId: '0123456789abcdef', token: new Uint8Array(16), port: 47616, addrs: ['127.0.0.1'], name: 'QR computer' };
const identity: PairIdentity = { deviceId: 'fedcba9876543210', name: 'Phone', os: 'android' };
const helloResponse = (name = 'Hello computer', id = payload.hubId): Response => Response.json({ app: 'i6-share-hub', v: 1, port: payload.port, id, name, addrs: ['127.0.0.1'] });
const encryptedFetch = (json: Readonly<Record<string, unknown>>, helloName = 'Hello computer'): Fetch => async (input, init) => {
  if (new Request(input).url.endsWith('/i6/hello')) return helloResponse(helloName);
  const body = await new Request(input, init).arrayBuffer();
  const key = await pairKey(payload.token, payload.hubId);
  const decoded = await open(key, requestAad('pair', 'pair'), body);
  expect(decoded.json).toEqual({ deviceId: identity.deviceId, name: identity.name, os: identity.os });
  const result = await seal(key, responseAad('pair', decoded.iv), { hubId: payload.hubId, name: '', ...json });
  return new Response(result.body);
};
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('client errors and memory storage', () => {
  it('constructs typed errors and validates error boundaries', () => {
    const cause = new Error('cause');
    expect(NetError('network', cause, true)).toMatchObject({ name: 'NetError', cause, fast: true });
    expect(NetError('network')).toMatchObject({ status: 0, fast: false });
    expect(HttpError(500).message).toBe('HTTP 500');
    expect(HttpError(400, 'bad').message).toBe('HTTP 400 bad');
    expect(UnpairedError('').message).toBe('unpaired (unknown-device)');
    expect(UnpairedError('revoked').message).toBe('unpaired (revoked)');
    expect(PairError('expired', 'expired')).toMatchObject({ code: 'expired', name: 'PairError' });
    expect(isAbortedError(AbortedError())).toBe(true);
    for (const error of [null, new Error('wrong'), Object.assign(new Error(), { name: 'X' }), Object.assign(new Error(), { name: 'X', code: '' }), Object.assign(new Error(), { name: 'X', code: '', status: 0 }), Object.assign(new Error(), { name: 'X', code: 1, status: 0, fast: false }), Object.assign(new Error(), { name: 'X', code: '', status: '0', fast: false }), Object.assign(new Error(), { name: 'X', code: '', status: 0, fast: 'false' })]) expect(isClientError(error, 'X')).toBe(false);
    expect(isAbortedError(HttpError(500))).toBe(false);
  });
  it('stores, replaces, deletes, and enumerates unknown values without mutating inputs', async () => {
    const empty = memoryStore(); expect(await empty.all()).toEqual([]);
    const entries: readonly (readonly [string, unknown])[] = [['a', 1], ['b', { value: true }]];
    const storage = memoryStore(entries); await storage.put('a', 2); await storage.put('c', null);
    expect(await storage.get('a')).toBe(2); await storage.delete('a');
    expect(await storage.get('a')).toBeUndefined(); expect(await storage.all()).toEqual([{ value: true }, null]);
    expect(entries).toEqual([['a', 1], ['b', { value: true }]]);
  });
});

describe('device naming', () => {
  it.each([
    ['Android 14; Pixel 8)', 'Pixel 8', 'android'], ['Android 14; K)', 'Android phone', 'android'], ['Android', 'Android phone', 'android'],
    ['CrOS', 'Chromebook', 'chromeos'], ['iPhone', 'iPhone', 'ios'], ['Windows', 'Windows PC', 'windows'], ['Macintosh', 'Mac', 'macos'], ['Linux', 'Linux PC', 'linux'], ['', 'Browser', 'unknown'],
  ])('detects %s', async (userAgent, name, os) => { vi.stubGlobal('navigator', { userAgent }); expect(await guessDevice()).toEqual({ name, os }); });
  it('uses high entropy model data and tolerates missing or denied hints', async () => {
    vi.stubGlobal('navigator', { userAgent: '', userAgentData: { platform: 'Android', getHighEntropyValues: () => Promise.resolve({ model: 'x'.repeat(50) }) } });
    expect(await guessDevice()).toEqual({ name: 'x'.repeat(40), os: 'android' });
    vi.stubGlobal('navigator', { userAgent: 'Linux', userAgentData: { getHighEntropyValues: () => Promise.reject(new Error('denied')) } });
    expect(await guessDevice()).toEqual({ name: 'Linux PC', os: 'linux' });
    vi.stubGlobal('navigator', { userAgent: 'Linux', userAgentData: { getHighEntropyValues: () => Promise.resolve({}) } });
    expect(await guessDevice()).toEqual({ name: 'Linux PC', os: 'linux' });
    vi.stubGlobal('navigator', { userAgent: 'Linux', userAgentData: null }); expect((await guessDevice()).os).toBe('linux');
    vi.stubGlobal('navigator', { userAgent: '', userAgentData: { getHighEntropyValues: 3 } }); expect((await guessDevice()).os).toBe('unknown');
  });
});

describe('hub discovery', () => {
  it.each([['127.0.0.1', 'loopback'], ['::1', 'loopback'], ['192.168.1.1', 'local'], ['fc00::1', 'local'], ['bad', 'local']])('requests correct address space for %s', async (addr, targetAddressSpace) => {
    const fetcher = vi.fn<Fetch>().mockImplementation(() => Promise.resolve(helloResponse()));
    expect((await hello(addr, undefined, { fetch: fetcher })).id).toBe(payload.hubId);
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/i6/hello'), expect.objectContaining({ targetAddressSpace, credentials: 'omit', cache: 'no-store' }));
  });
  it('uses the platform fetch by default', async () => { vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(helloResponse())); expect((await hello('127.0.0.1')).id).toBe(payload.hubId); });
  it('turns HTTP/schema/fetch failures into typed errors and distinguishes aborts and instant blocks', async () => {
    const fetcher = vi.fn<Fetch>().mockResolvedValue(new Response('', { status: 503 }));
    await expect(hello('127.0.0.1', 47616, { fetch: fetcher })).rejects.toMatchObject({ name: 'NetError', fast: false });
    fetcher.mockResolvedValue(Response.json({ app: 'other' })); await expect(hello('127.0.0.1', 47616, { fetch: fetcher })).rejects.toMatchObject({ name: 'NetError' });
    fetcher.mockRejectedValue(new TypeError('blocked')); await expect(hello('127.0.0.1', 47616, { fetch: fetcher })).rejects.toMatchObject({ fast: true });
    vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(501);
    await expect(hello('127.0.0.1', 47616, { fetch: fetcher })).rejects.toMatchObject({ fast: false });
    fetcher.mockRejectedValue('offline'); await expect(hello('127.0.0.1', 47616, { fetch: fetcher })).rejects.toThrow('offline');
    await expect(hello('127.0.0.1', 47616, { fetch: fetcher, signal: AbortSignal.abort() })).rejects.toMatchObject({ name: 'AbortedError' });
  });
  it('builds nearest-first unique private subnet candidates with limits', () => {
    const list = sweepCandidates(['192.168.1.10', '192.168.1.11', '10.0.0.5', '172.16.0.2', '192.168.2.2', '192.168.3.2', '127.0.0.1', '169.254.1.1', '8.8.8.8', '::1', 'bad']);
    expect(list.slice(0, 3)).toEqual(['192.168.1.9', '192.168.1.8', '192.168.1.12']);
    expect(list).toHaveLength(4 * 254 - 5); expect(list).not.toContain('192.168.3.1');
    expect(sweepCandidates(['192.168.1.1'], 0)).toEqual([]); expect(new Set(list).size).toBe(list.length);
  });
  it('finds known addresses, ignores wrong IDs, reports blocks, and handles missing addresses', async () => {
    const fetcher = vi.fn<Fetch>().mockImplementation(() => Promise.resolve(helloResponse()));
    expect((await locateHub({ lastAddr: '127.0.0.1', addrs: ['127.0.0.1', ''] }, { fetch: fetcher })).addr).toBe('127.0.0.1');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await locateHub({ hubId: 'other', addrs: ['127.0.0.1'] }, { fetch: fetcher })).toEqual({ addr: null, blocked: false });
    fetcher.mockRejectedValue(new TypeError('blocked'));
    expect(await locateHub({ addrs: ['127.0.0.1'] }, { fetch: fetcher })).toEqual({ addr: null, blocked: true });
    expect(await locateHub({})).toEqual({ addr: null, blocked: false });
    await expect(locateHub({ addrs: ['127.0.0.1'] }, { fetch: fetcher, signal: AbortSignal.abort() })).rejects.toMatchObject({ name: 'AbortedError' });
  });
  it('sweeps the subnet, cancels competitors after discovery, and can exhaust a subnet', async () => {
    const fetcher: Fetch = (input) => new Request(input).url.startsWith('http://192.168.1.9:') ? Promise.resolve(helloResponse()) : Promise.reject(new Error('offline'));
    expect((await locateHub({ hubId: payload.hubId, addrs: ['192.168.1.10'] }, { fetch: fetcher, sweep: true })).addr).toBe('192.168.1.9');
    const failing = vi.fn<Fetch>().mockRejectedValue(new Error('offline'));
    expect(await locateHub({ addrs: ['192.168.1.10'] }, { fetch: failing, sweep: true })).toEqual({ addr: null, blocked: false });
    expect(failing).toHaveBeenCalledTimes(254);
    expect(await locateHub({}, { sweep: true })).toEqual({ addr: null, blocked: false });
    await expect(locateHub({}, { sweep: true, signal: AbortSignal.abort() })).rejects.toMatchObject({ name: 'AbortedError' });
  });
});

describe('pairing handshake and retry policy', () => {
  it.each([
    [{ secret: 'secret', hubId: payload.hubId, name: 'Wire computer' }, 'Hello computer', 'QR computer', 'Wire computer'],
    [{ secret: 'secret' }, 'Hello computer', 'QR computer', 'Hello computer'],
    [{ secret: 'secret', name: '' }, '', 'QR computer', 'QR computer'],
    [{ secret: 'secret' }, '', '', 'Computer'],
  ])('selects the best available hub name', async (json, helloName, qrName, expectedName) => {
    const status = vi.fn<(status: string) => void>();
    const result = await pairWithHub({ ...payload, name: qrName }, { ...identity, fetch: encryptedFetch(json, helloName), onStatus: status });
    expect(result).toMatchObject({ hubId: payload.hubId, name: expectedName, secret: 'secret', lastAddr: '127.0.0.1', addrs: ['127.0.0.1'] });
    expect(result.pairedAt).toBe(result.lastSeen); expect(status.mock.calls).toEqual([['searching'], ['pairing']]);
  });
  it('accepts QR strings and uses the default fetch', async () => {
    vi.stubGlobal('fetch', encryptedFetch({ secret: 'secret' }));
    expect((await pairWithHub(encodePairPayload(payload), identity)).hubId).toBe(payload.hubId);
  });
  it.each([{ secret: '' }, { name: 'missing secret' }, { secret: 'secret', hubId: 'wrong' }, { secret: 2 }])('rejects invalid authenticated responses', async (json) => {
    await expect(pairWithHub(payload, { ...identity, fetch: encryptedFetch(json) })).rejects.toMatchObject({ name: 'PairError', code: 'bad-response' });
  });
  it('rejects unauthenticated encrypted responses', async () => {
    const fetcher: Fetch = (input) => Promise.resolve(new Request(input).url.endsWith('/i6/hello') ? helloResponse() : new Response('garbage'));
    await expect(pairWithHub(payload, { ...identity, fetch: fetcher })).rejects.toMatchObject({ code: 'bad-response' });
  });
  it.each([[401, '{"error":"used"}', 'expired'], [400, '{"error":"bad"}', 'rejected'], [403, 'not json', 'rejected']])('translates status %s to pairing errors', async (status, body, code) => {
    const fetcher: Fetch = (input) => Promise.resolve(new Request(input).url.endsWith('/i6/hello') ? helloResponse() : new Response(body, { status }));
    await expect(pairWithHub(payload, { ...identity, fetch: fetcher })).rejects.toMatchObject({ name: 'PairError', code });
  });
  it('aborts before discovery and when pairing transport is interrupted', async () => {
    await expect(pairWithHub(payload, { ...identity, signal: AbortSignal.abort() })).rejects.toMatchObject({ name: 'AbortedError' });
    const controller = new AbortController();
    const fetcher: Fetch = (input) => { if (new Request(input).url.endsWith('/i6/hello')) return Promise.resolve(helloResponse()); controller.abort(); return Promise.reject(new Error('interrupted')); };
    await expect(pairWithHub(payload, { ...identity, fetch: fetcher, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortedError' });
  });
  it.each(['network', 'server'])('retries %s pairing failures after backoff', async (failure) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const good = encryptedFetch({ secret: 'secret' });
    const attempts = { value: 0 };
    const fetcher: Fetch = (input, init) => {
      if (new Request(input).url.endsWith('/i6/pair?h=0123456789abcdef') && attempts.value++ === 0) return failure === 'network' ? Promise.reject(new Error('offline')) : Promise.resolve(new Response('{}', { status: 503 }));
      return good(input, init);
    };
    const result = pairWithHub(payload, { ...identity, fetch: fetcher });
    await vi.waitFor(() => { expect(attempts.value).toBe(1); });
    await vi.advanceTimersByTimeAsync(5000);
    expect((await result).secret).toBe('secret'); expect(attempts.value).toBe(2);
  });
  it('reports browser blocks and aborts a pending retry', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const controller = new AbortController(); const status = vi.fn<(status: string) => void>();
    const result = pairWithHub(payload, { ...identity, fetch: () => Promise.reject(new TypeError('blocked')), signal: controller.signal, onStatus: status }).then(() => null, (error: unknown) => error);
    await vi.waitFor(() => { expect(status).toHaveBeenCalledWith('blocked'); }); controller.abort();
    expect(await result).toMatchObject({ name: 'AbortedError' });
  });
  it('continues discovery retries through periodic sweep rounds until success', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const attempts = { value: 0 }; const good = encryptedFetch({ secret: 'secret' });
    const fetcher: Fetch = (input, init) => { if (new Request(input).url.endsWith('/i6/hello') && ++attempts.value <= 8) return Promise.reject(new Error('offline')); return good(input, init); };
    const result = pairWithHub(payload, { ...identity, fetch: fetcher });
    await vi.advanceTimersByTimeAsync(40000);
    expect((await result).secret).toBe('secret'); expect(attempts.value).toBe(9);
  });
});

interface NetworkRequest { readonly op: string; readonly request: Request; readonly count: number }
type NetworkReply = Response | Readonly<Record<string, unknown>>;
const activeEngines: ShareEngine[] = [];
afterEach(() => { for (const engine of activeEngines) engine.stop(); activeEngines.splice(0); });
const holdRequest = (signal: AbortSignal): Promise<Response> => new Promise((_resolve, reject) => {
  if (signal.aborted) reject(new Error('aborted'));
  else signal.addEventListener('abort', () => { reject(new Error('aborted')); }, { once: true });
});
const networkFixture = async (respond: (request: NetworkRequest) => NetworkReply | Promise<NetworkReply>, customSecret?: string) => {
  const counts = new Map<string, number>();
  const key = await deviceKey(new Uint8Array(32), identity.deviceId);
  const record: HubRecord = { hubId: payload.hubId, name: 'Computer', port: payload.port, addrs: ['127.0.0.1'], lastAddr: '127.0.0.1', secret: customSecret ?? b64url(new Uint8Array(32)), pairedAt: 0, lastSeen: 0 };
  const fetcher: Fetch = async (input, init) => {
    const request = new Request(input, init); const op = new URL(request.url).pathname.slice('/i6/'.length);
    const count = (counts.get(op) ?? 0) + 1; counts.set(op, count);
    const reply = await respond({ op, request, count });
    if (reply instanceof Response) return reply;
    if (op === 'hello') return Response.json(reply);
    const envelope = await open(key, requestAad(op, identity.deviceId), await request.arrayBuffer());
    const encrypted = await seal(key, responseAad(op, envelope.iv), reply);
    return new Response(encrypted.body);
  };
  const engine = createShareEngine({ kv: memoryStore([['deviceId', identity.deviceId]]), hubs: memoryStore([[payload.hubId, record]]), queue: memoryStore(), fetch: fetcher });
  activeEngines.push(engine);
  await engine.init({ visible: false, name: identity.name, os: identity.os });
  return { engine, counts };
};
const normalReply = async ({ op, request }: NetworkRequest): Promise<NetworkReply> => {
  if (op === 'hello') return { app: 'i6-share-hub', v: 1, port: payload.port, id: payload.hubId, name: 'Computer', addrs: ['127.0.0.1'] };
  if (op === 'sync') return holdRequest(request.signal);
  if (op === 'offer') return { received: [] };
  if (op === 'put') {
    const key = await deviceKey(new Uint8Array(32), identity.deviceId);
    const decoded = await open(key, requestAad(op, identity.deviceId), await request.clone().arrayBuffer());
    return { bytes: Number(decoded.json['offset']) + decoded.binary.length };
  }
  return { ok: true };
};
const waitForEvent = <K extends keyof ClientEvents>(engine: ShareEngine, kind: K, matches: (detail: ClientEvents[K]) => boolean): Promise<ClientEvents[K]> => new Promise((resolve) => {
  const listener = (event: CustomEvent<ClientEvents[K]>): void => { if (matches(event.detail)) { engine.removeEventListener(kind, listener); resolve(event.detail); } };
  engine.addEventListener(kind, listener);
});

describe('share engine network lifecycle', () => {
  it.each(['wrong hub', 'unreachable hub'])('keeps trust when a 401 comes from an %s, then recovers', async (mode) => {
    vi.spyOn(protocol, 'sleep').mockResolvedValue();
    const { engine, counts } = await networkFixture((request) => {
      if (request.op === 'offer' && request.count === 1) return Response.json({}, { status: 401 });
      if (request.op === 'hello' && request.count === 2) return mode === 'wrong hub' ? helloResponse('Other', 'wrong') : Promise.reject(new Error('offline'));
      return normalReply(request);
    });
    const done = waitForEvent(engine, 'transfer', (transfer) => transfer.status === 'done');
    await engine.send(payload.hubId, [new File(['hello'], 'hello')]);
    expect((await done).sent).toBe(5); expect(engine.hubs).toHaveLength(1); expect(counts.get('offer')).toBe(2);
  });
  it('reports network blocks, retries after discovery failures, and clears the warning on recovery', async () => {
    vi.spyOn(protocol, 'sleep').mockResolvedValue();
    const { engine, counts } = await networkFixture((request) => request.op === 'hello' && request.count <= 3 ? Promise.reject(new TypeError('blocked')) : normalReply(request));
    const network: boolean[] = []; const status: string[] = [];
    engine.addEventListener('network', (event) => { network.push(event.detail.blocked); });
    engine.addEventListener('status', (event) => { status.push(event.detail.status); });
    const done = waitForEvent(engine, 'transfer', (transfer) => transfer.status === 'done');
    await engine.send(payload.hubId, [new File(['yes'], 'yes')]); await done;
    expect(network).toEqual([true, false]); expect(status).toContain('offline'); expect(status.at(-1)).toBe('online'); expect(counts.get('hello')).toBe(4);
  });
  it.each(['garbage', 'bad-schema', 'network'])('retries %s responses without losing queued bytes', async (mode) => {
    vi.spyOn(protocol, 'sleep').mockResolvedValue();
    const { engine, counts } = await networkFixture((request) => {
      if (request.op === 'offer' && request.count === 1) return mode === 'garbage' ? new Response('garbage') : mode === 'bad-schema' ? { received: false } : Promise.reject(new Error('offline'));
      return normalReply(request);
    });
    const done = waitForEvent(engine, 'transfer', (transfer) => transfer.status === 'done');
    await engine.send(payload.hubId, [new File(['data'], 'data')]);
    expect((await done).sent).toBe(4); expect(counts.get('offer')).toBe(2);
  });
  it('surfaces an invalid stored key while leaving the transfer cancellable', async () => {
    const { engine } = await networkFixture(normalReply, '!invalid!');
    const failed = waitForEvent(engine, 'transfer', (transfer) => transfer.error !== null);
    const tid = await engine.send(payload.hubId, [new File(['data'], 'data')]);
    expect((await failed).error).toBeTruthy();
    await engine.cancel(tid); expect(engine.transfers[0]?.status).toBe('cancelled');
  });
  it('aborts in-flight sync on kick, pauses while hidden, resumes and stops', async () => {
    const { engine, counts } = await networkFixture(normalReply);
    engine.setVisible(true);
    await vi.waitFor(() => { expect(counts.get('sync')).toBe(1); });
    engine.kick(); await vi.waitFor(() => { expect(counts.get('sync')).toBe(2); });
    engine.setVisible(false); engine.kick();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(counts.get('sync')).toBe(2);
    engine.setVisible(true); await vi.waitFor(() => { expect(counts.get('sync')).toBe(3); });
    engine.stop(); engine.kick();
  });
  it('cancels a transfer during retry sleep and stops a pending transport', async () => {
    const { engine, counts } = await networkFixture((request) => request.op === 'offer' ? Promise.reject(new Error('offline')) : normalReply(request));
    const tid = await engine.send(payload.hubId, [new File(['cancel'], 'cancel')]);
    await vi.waitFor(() => { expect(counts.get('offer')).toBe(1); }); await engine.cancel(tid);
    expect(engine.transfers[0]?.status).toBe('cancelled');
    const pending = await networkFixture((request) => request.op === 'offer' ? holdRequest(request.request.signal) : normalReply(request));
    const stoppedTid = await pending.engine.send(payload.hubId, [new File(['stop'], 'stop')]);
    await vi.waitFor(() => { expect(pending.counts.get('offer')).toBe(1); }); pending.engine.stop();
    await pending.engine.cancel(stoppedTid);
  });
});

describe('sync scheduling and recovery', () => {
  it.each(['network', 'http', 'offline'])('recovers sync after %s failure and throttles empty immediate replies', async (mode) => {
    const sleep = vi.spyOn(protocol, 'sleep').mockResolvedValue();
    const { engine, counts } = await networkFixture((request) => {
      if (request.op === 'hello' && request.count === 1 && mode === 'offline') return Promise.reject(new Error('offline'));
      if (request.op === 'sync' && request.count === 1 && mode !== 'offline') return mode === 'network' ? Promise.reject(new Error('offline')) : new Response('{}', { status: 503 });
      if (request.op === 'sync' && request.count === (mode === 'offline' ? 1 : 2)) return { name: 'Computer', addrs: [], outbox: [] };
      return normalReply(request);
    });
    engine.setVisible(true);
    await vi.waitFor(() => { expect(counts.get('sync')).toBe(mode === 'offline' ? 2 : 3); });
    expect(sleep).toHaveBeenCalledWith(1000, expect.any(AbortSignal)); engine.stop();
  });
  it('does not throttle empty long-poll responses that already waited', async () => {
    const clock = { now: Date.now() };
    vi.spyOn(Date, 'now').mockImplementation(() => clock.now);
    const sleep = vi.spyOn(protocol, 'sleep').mockResolvedValue();
    const { engine, counts } = await networkFixture((request) => {
      if (request.op === 'sync' && request.count === 1) { clock.now += 1500; return { name: 'Computer', addrs: [], outbox: [] }; }
      return normalReply(request);
    });
    engine.setVisible(true); await vi.waitFor(() => { expect(counts.get('sync')).toBe(2); });
    expect(sleep).not.toHaveBeenCalled(); engine.stop();
  });
  it('does not persist late network replies after the engine is stopped', async () => {
    const deferred = Promise.withResolvers<NetworkReply>();
    const { engine, counts } = await networkFixture((request) => request.op === 'sync' ? deferred.promise : normalReply(request));
    engine.setVisible(true); await vi.waitFor(() => { expect(counts.get('sync')).toBe(1); });
    engine.stop(); deferred.resolve({ name: 'Late reply', addrs: [], outbox: [] });
    await vi.waitFor(() => { expect(engine.hub(payload.hubId)?.name).toBe('Late reply'); });
  });
  it('uses the last known address to unpair before discovery starts', async () => {
    const { engine, counts } = await networkFixture(normalReply);
    await engine.forget(payload.hubId);
    expect(counts.get('unpair')).toBe(1);
    expect(counts.get('hello')).toBeUndefined();
    expect(engine.hubs).toEqual([]);
  });
});

describe('concurrent network operations', () => {
  it('accepts a late sync after a parallel transport failure cleared its active address', async () => {
    const sync = Promise.withResolvers<NetworkReply>();
    const { engine, counts } = await networkFixture((request) => {
      if (request.op === 'sync') return sync.promise;
      if (request.op === 'offer') return Promise.reject(new Error('offline'));
      return normalReply(request);
    });
    engine.setVisible(true); await vi.waitFor(() => { expect(counts.get('sync')).toBe(1); });
    const tid = await engine.send(payload.hubId, [new File(['data'], 'data')]);
    await vi.waitFor(() => { expect(engine.hub(payload.hubId)?.addr).toBeNull(); });
    sync.resolve({ name: 'Late name', addrs: [], outbox: [] });
    await vi.waitFor(() => { expect(engine.hub(payload.hubId)?.name).toBe('Late name'); });
    await engine.cancel(tid); engine.stop();
  });
  it('queues more work while uploading and keeps busy true across overlapping downloads', async () => {
    const download = Promise.withResolvers<NetworkReply>();
    const firstUpload = Promise.withResolvers<NetworkReply>();
    const { engine, counts } = await networkFixture((request) => {
      if (request.op === 'sync' && request.count === 1) return { name: 'Computer', addrs: [], outbox: [{ tid: 'incoming', files: [{ name: 'incoming', type: '', size: 1, lastModified: 0 }] }] };
      if (request.op === 'pull') return download.promise;
      if (request.op === 'offer' && request.count === 1) return firstUpload.promise;
      return normalReply(request);
    });
    const busy: boolean[] = []; engine.addEventListener('busy', (event) => { busy.push(event.detail.busy); });
    engine.setVisible(true); await vi.waitFor(() => { expect(counts.get('pull')).toBe(1); });
    const first = await engine.send(payload.hubId, [new File(['first'], 'first')]);
    await vi.waitFor(() => { expect(counts.get('offer')).toBe(1); });
    const second = await engine.send(payload.hubId, [new File(['second'], 'second')]);
    firstUpload.resolve({ received: [] });
    await vi.waitFor(() => { expect(engine.transfers.filter((transfer) => transfer.status === 'done')).toHaveLength(2); });
    expect(engine.transfers.map((transfer) => transfer.tid)).toEqual([first, second]); expect(busy).toEqual([true]);
    download.resolve({ size: 0 });
    await vi.waitFor(() => { expect(busy).toEqual([true, false]); }); engine.stop();
  });
});
