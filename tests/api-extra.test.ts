import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHubApi } from '../hub/api.js';
import type { HubApi, HubApiOptions, HubEvents, HubResponse, HubSink, HubStorage, HubStore } from '../hub/api-types.js';
import {
  CHUNK_SIZE, PAIR_TOKEN_TTL_MS, b64url, decodePairPayload, deviceKey, open, pairKey, requestAad,
  responseAad, seal, type Bytes, type JsonObject,
} from '../public/lib/proto.js';

const DEVICE = '0123456789abcdef';
const OTHER = 'fedcba9876543210';
const TID = '0123456789abcdef01234567';
const SECRET = Uint8Array.from({ length: 32 }, (_, index) => index);
const registered = { deviceId: DEVICE, secret: b64url(SECRET), name: 'Phone', os: 'android', pairedAt: 100, lastSeen: 100, lastAddr: '192.168.1.2' };
const store = (entries: readonly (readonly [string, unknown])[] = []): HubStore => {
  const values = new Map(entries);
  return {
    get: (key) => Promise.resolve(values.get(key)),
    put: (key, value) => { values.set(key, value); return Promise.resolve(); },
    delete: (key) => { values.delete(key); return Promise.resolve(); },
    all: () => Promise.resolve([...values.values()]),
  };
};
const storage = (): HubStorage => ({ kv: store(), devices: store([[DEVICE, registered]]), queue: store() });
const sink = (): HubSink => ({ exists: () => Promise.resolve(false), create: () => Promise.resolve({
  where: 'folder', write: () => Promise.resolve(), close: () => Promise.resolve(), abort: () => Promise.resolve(),
}) });
const apis: HubApi[] = [];
const setup = async (options: Partial<HubApiOptions> = {}) => {
  const saved = options.storage ?? storage();
  const api = createHubApi({ storage: saved, sink: sink(), sweepIntervalMs: 0, ...options });
  apis.push(api);
  await api.init();
  const key = await deviceKey(SECRET, DEVICE);
  const call = async (op: string, json: JsonObject = {}, binary?: Bytes): Promise<HubResponse> => {
    const request = await seal(key, requestAad(op, DEVICE), json, binary);
    return api.handle({ method: 'POST', path: `/i6/${op}`, query: `d=${DEVICE}`, body: request.body });
  };
  const exchange = async (op: string, json: JsonObject = {}, binary?: Bytes): Promise<JsonObject> => {
    const request = await seal(key, requestAad(op, DEVICE), json, binary);
    const response = await api.handle({ method: 'POST', path: `/i6/${op}`, query: `d=${DEVICE}`, body: request.body });
    expect(response.status).toBe(200);
    if (typeof response.body === 'string') throw new Error(`Expected encrypted response: ${response.body}`);
    return (await open(key, responseAad(op, request.iv), response.body)).json;
  };
  return { api, saved, key, call, exchange };
};
afterEach(() => { apis.forEach((api) => { api.dispose(); }); apis.length = 0; vi.restoreAllMocks(); });

const error = (status: number, code: string) => ({ status, body: JSON.stringify({ error: code }) });

describe('hub untrusted request validation', () => {
  it('rejects unrecognized routes, methods, malformed device ids and unknown devices', async () => {
    const { api } = await setup();
    for (const request of [
      { method: 'POST', path: '/i6/unknown' }, { method: 'GET', path: '/i6/offer' },
      { method: 'POST', path: '/unrecognized' }, { method: 'POST', path: '/i6/UPPER' },
    ]) expect(await api.handle(request)).toMatchObject(error(404, 'not-found'));
    for (const query of [undefined, '', 'd=bad', 'd=0123456789ABCDEf']) {
      expect(await api.handle({ method: 'POST', path: '/i6/sync', ...(query === undefined ? {} : { query }) })).toMatchObject(error(400, 'bad-request'));
    }
    expect(await api.handle({ method: 'POST', path: '/i6/sync', query: `d=${OTHER}` })).toMatchObject(error(401, 'unknown-device'));
    expect(await api.handle({ method: 'POST', path: '/i6/sync', query: `d=${DEVICE}` })).toMatchObject(error(401, 'bad-auth'));
    for (const path of ['/', '/index.html']) expect(await api.handle({ method: 'GET', path })).toMatchObject({ status: 200 });
    for (const method of ['GET', 'POST']) expect(await api.handle({ method, path: '/i6/hello' })).toMatchObject({ status: 200 });
  });
  it('rejects tampering, incorrect AAD and old device secrets', async () => {
    const { api, key, saved } = await setup();
    const envelope = await seal(key, requestAad('offer', DEVICE), { wait: 0 });
    expect(await api.handle({ method: 'POST', path: '/i6/sync', query: `d=${DEVICE}`, body: envelope.body })).toMatchObject(error(401, 'bad-auth'));
    const corrupted = envelope.body.slice();
    corrupted.set(new Uint8Array(16), corrupted.length - 16);
    expect(await api.handle({ method: 'POST', path: '/i6/offer', query: `d=${DEVICE}`, body: corrupted })).toMatchObject(error(401, 'bad-auth'));
    await saved.devices.put(DEVICE, { ...registered, secret: 'not base64!' });
    const restarted = await setup({ storage: saved });
    expect(await restarted.api.handle({ method: 'POST', path: '/i6/offer', query: `d=${DEVICE}`, body: envelope.body })).toMatchObject(error(401, 'bad-auth'));
  });
  it('validates offer transfer ids and every file metadata field before opening a sink', async () => {
    const target = sink(); const create = vi.spyOn(target, 'create');
    const { call } = await setup({ sink: target });
    const invalid: readonly JsonObject[] = [
      {}, { tid: 12 }, { tid: 'bad' }, { tid: TID }, { tid: TID, files: null },
      { tid: TID, files: [] }, { tid: TID, files: Array.from({ length: 10001 }, () => ({ name: 'a', size: 1 })) },
      { tid: TID, files: [null] }, { tid: TID, files: [{ name: 'a', size: -1 }] },
      { tid: TID, files: [{ name: 'a', size: 1.5 }] }, { tid: TID, files: [{ name: 3, size: 1 }] },
      { tid: TID, files: [{ name: 'a', size: Number.MAX_SAFE_INTEGER + 1 }] },
    ];
    for (const value of invalid) expect(await call('offer', value)).toMatchObject(error(400, 'bad-request'));
    expect(create).not.toHaveBeenCalled();
    expect(await call('offer', { tid: TID, files: [{ size: 0, type: 1, lastModified: 'bad' }] })).toMatchObject({ status: 200 });
    expect(create).toHaveBeenCalledWith('file', expect.objectContaining({ type: '', lastModified: 0 }));
  });
  it('validates upload indices, offsets, transfer existence and chunk size', async () => {
    const { call, exchange } = await setup();
    expect(await call('put', { tid: TID, i: 0, offset: 0 }, Uint8Array.of(1))).toMatchObject(error(404, 'not-found'));
    await exchange('offer', { tid: TID, files: [{ name: 'data', size: 2 }] });
    for (const fields of [{ i: -1, offset: 0 }, { i: 0, offset: -1 }, { i: 0.5, offset: 0 }, { i: 0, offset: 0.5 }, { i: 9, offset: 0 }]) {
      expect(await call('put', { tid: TID, ...fields }, Uint8Array.of(1))).toMatchObject(error(400, 'bad-request'));
    }
    expect(await call('put', { tid: TID, i: 0, offset: 0 }, new Uint8Array(CHUNK_SIZE + 1))).toMatchObject(error(413, 'too-large'));
    expect(await call('put', { tid: TID, i: 0, offset: 0 }, new Uint8Array(3))).toMatchObject(error(400, 'bad-request'));
    expect(await exchange('put', { tid: TID, i: 0, offset: 1 }, Uint8Array.of(1))).toEqual({ error: 'offset', bytes: 0 });
    expect(await exchange('put', { tid: TID, i: 0, offset: 0 })).toEqual({ bytes: 0 });
    expect(await exchange('end', { tid: TID })).toEqual({ ok: false });
    expect(await exchange('put', { tid: TID, i: 0, offset: 0 }, Uint8Array.of(1, 2))).toEqual({ bytes: 2 });
    expect(await exchange('put', { tid: TID, i: 0, offset: 2 }, Uint8Array.of(3))).toEqual({ bytes: 2 });
    expect(await call('offer', { tid: TID, files: [{ name: 'data', size: 3 }] })).toMatchObject(error(400, 'bad-request'));
    expect(await call('offer', { tid: TID, files: [{ name: 'data', size: 2 }, { size: 1 }] })).toMatchObject(error(400, 'bad-request'));
  });
  it('validates pull metadata and prevents cross-device outbox access', async () => {
    const { api, call, exchange, saved } = await setup();
    const tid = await api.sendToDevice(DEVICE, [new File(['data'], 'data')]);
    for (const fields of [{ i: -1, offset: 0, length: 1 }, { i: 0, offset: -1, length: 1 }, { i: 0, offset: 0, length: -1 }, { i: 0, offset: 0, length: CHUNK_SIZE + 1 }, { i: 9, offset: 0, length: 1 }, { i: 0, offset: 5, length: 1 }]) {
      expect(await call('pull', { tid, ...fields })).toMatchObject(error(400, 'bad-request'));
    }
    expect(await call('pull', { tid: TID, i: 0, offset: 0, length: 1 })).toMatchObject(error(404, 'not-found'));
    await saved.queue.put(TID, { tid: TID, deviceId: OTHER, files: [new File(['x'], 'x')], createdAt: 1 });
    await saved.devices.put(OTHER, { ...registered, deviceId: OTHER });
    const restarted = await setup({ storage: saved });
    expect(await restarted.call('pull', { tid: TID, i: 0, offset: 0, length: 1 })).toMatchObject(error(404, 'not-found'));
    expect(await restarted.exchange('pulled', { tid: TID })).toEqual({ ok: true });
    expect(restarted.api.outboxFor(OTHER)).toHaveLength(1);
    expect(await exchange('pulled', { tid: TID })).toEqual({ ok: true });
    expect(await exchange('cancel', { tid: TID })).toEqual({ ok: true });
  });
});

describe('pairing authentication and concurrency', () => {
  it('requires a live token, matching hub identity and valid device identity', async () => {
    const { api } = await setup();
    const payload = decodePairPayload(api.newPairCode().payload);
    const key = await pairKey(payload.token, api.hubId);
    const envelope = await seal(key, requestAad('pair', 'pair'), { deviceId: DEVICE });
    expect(await api.handle({ method: 'POST', path: '/i6/pair', body: envelope.body })).toMatchObject(error(401, 'bad-auth'));
    expect(await api.handle({ method: 'POST', path: '/i6/pair', query: 'h=wrong', body: envelope.body })).toMatchObject(error(401, 'bad-auth'));
    expect(await api.handle({ method: 'POST', path: '/i6/pair', query: `h=${api.hubId}`, body: new Uint8Array(65537) })).toMatchObject(error(413, 'too-large'));
    for (const deviceId of [null, 7, '', 'bad']) {
      const malformed = await seal(key, requestAad('pair', 'pair'), { deviceId });
      expect(await api.handle({ method: 'POST', path: '/i6/pair', query: `h=${api.hubId}`, body: malformed.body })).toMatchObject(error(400, 'bad-request'));
    }
    const bad = await seal(await pairKey(new Uint8Array(16).fill(55), api.hubId), requestAad('pair', 'pair'), { deviceId: DEVICE });
    expect(await api.handle({ method: 'POST', path: '/i6/pair', query: `h=${api.hubId}`, body: bad.body })).toMatchObject(error(401, 'bad-auth'));
  });
  it('lets one device consume a QR token, rejects a concurrent second device and keeps retries idempotent', async () => {
    const { api } = await setup();
    const payload = decodePairPayload(api.newPairCode().payload);
    const key = await pairKey(payload.token, api.hubId);
    const pair = async (deviceId: string) => {
      const request = await seal(key, requestAad('pair', 'pair'), { deviceId });
      const response = await api.handle({ method: 'POST', path: '/i6/pair', query: `h=${api.hubId}`, body: request.body });
      const json = typeof response.body === 'string' ? null : (await open(key, responseAad('pair', request.iv), response.body)).json;
      return { status: response.status, json, deviceId };
    };
    const results = await Promise.all([pair(DEVICE), pair(OTHER)]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 401]);
    const winner = results.find((result) => result.status === 200);
    if (winner === undefined) throw new Error('Expected one successful pairing');
    expect(await pair(winner.deviceId)).toEqual(winner);
    expect(winner.json?.['secret']).not.toBe(registered.secret);
    expect(api.listDevices().every((device) => !('secret' in device))).toBe(true);
  });
  it('expires QR tokens and evicts all but the latest five codes', async () => {
    let now = 100;
    const { api } = await setup({ now: () => now });
    const first = decodePairPayload(api.newPairCode().payload);
    const firstBody = await seal(await pairKey(first.token, api.hubId), requestAad('pair', 'pair'), { deviceId: DEVICE });
    for (let index = 0; index < 5; index++) api.newPairCode();
    expect(await api.handle({ method: 'POST', path: '/i6/pair', query: `h=${api.hubId}`, body: firstBody.body })).toMatchObject(error(401, 'bad-auth'));
    const current = decodePairPayload(api.newPairCode().payload);
    const currentBody = await seal(await pairKey(current.token, api.hubId), requestAad('pair', 'pair'), { deviceId: DEVICE });
    now += PAIR_TOKEN_TTL_MS;
    expect(await api.handle({ method: 'POST', path: '/i6/pair', query: `h=${api.hubId}`, body: currentBody.body })).toMatchObject(error(401, 'bad-auth'));
    await api.sweep();
    api.newPairCode();
  });
  it('binds each encrypted response to its originating request IV', async () => {
    const { api, key } = await setup();
    const first = await seal(key, requestAad('sync', DEVICE), { wait: 0 });
    const second = await seal(key, requestAad('sync', DEVICE), { wait: 0 });
    const reply = await api.handle({ method: 'POST', path: '/i6/sync', query: `d=${DEVICE}`, body: first.body });
    if (typeof reply.body === 'string') throw new Error(reply.body);
    expect((await open(key, responseAad('sync', first.iv), reply.body)).json).toHaveProperty('outbox');
    await expect(open(key, responseAad('sync', second.iv), reply.body)).rejects.toBeInstanceOf(Error);
  });
});

describe('hub retry and asynchronous trust boundaries', () => {
  it('rejects a session revoked while WebCrypto is decrypting its request', async () => {
    const { api, call } = await setup();
    const decrypt = crypto.subtle.decrypt.bind(crypto.subtle);
    const entered = Promise.withResolvers<undefined>();
    const release = Promise.withResolvers<undefined>();
    vi.spyOn(crypto.subtle, 'decrypt').mockImplementationOnce(async (...args) => {
      const plaintext = await decrypt(...args);
      entered.resolve(undefined);
      await release.promise;
      return plaintext;
    });
    const pending = call('sync', { wait: 0 });
    await entered.promise;
    expect(await api.forgetDevice(DEVICE)).toBe(true);
    release.resolve(undefined);
    expect(await pending).toMatchObject(error(401, 'unknown-device'));
    expect(api.listDevices()).toHaveLength(0);
  });
  it('restores completed files after an actual hub restart while resetting partial data', async () => {
    const shared = storage();
    const first = await setup({ storage: shared });
    const files = [{ name: 'saved.txt', size: 2, type: 'text/plain', lastModified: 1 }, { name: 'partial.txt', size: 2 }];
    expect(await first.exchange('offer', { tid: TID, files })).toEqual({ received: [0, 0] });
    await first.exchange('put', { tid: TID, i: 0, offset: 0 }, Uint8Array.of(1, 2));
    await first.exchange('put', { tid: TID, i: 1, offset: 0 }, Uint8Array.of(3));
    first.api.dispose();
    const resumedSink = sink(); const create = vi.spyOn(resumedSink, 'create');
    const second = await setup({ storage: shared, sink: resumedSink });
    expect(await second.exchange('offer', { tid: TID, files })).toEqual({ received: [2, 0] });
    expect(create).not.toHaveBeenCalled();
    expect(await second.exchange('put', { tid: TID, i: 1, offset: 0 }, Uint8Array.of(3, 4))).toEqual({ bytes: 2 });
    expect(await second.exchange('end', { tid: TID })).toEqual({ ok: true });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith('partial.txt', expect.objectContaining({ size: 2 }));
    second.api.dispose();
    const third = await setup({ storage: shared });
    expect(await third.exchange('end', { tid: TID })).toEqual({ ok: true });
    expect(await third.exchange('offer', { tid: TID, files })).toEqual({ received: [2, 2] });
  });
  it('recovers an empty file after transient finalization failure on a repeated offer', async () => {
    const close = vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error('disk unavailable')).mockResolvedValue(undefined);
    const abort = vi.fn(() => Promise.resolve());
    const target: HubSink = { exists: () => Promise.resolve(false), create: () => Promise.resolve({ write: () => Promise.resolve(), close, abort }) };
    const { api, call, exchange } = await setup({ sink: target });
    const files = [{ name: 'empty', size: 0 }];
    expect(await call('offer', { tid: TID, files })).toMatchObject(error(500, 'internal'));
    expect(abort).toHaveBeenCalledTimes(1);
    expect(await exchange('offer', { tid: TID, files })).toEqual({ received: [0] });
    expect(await exchange('end', { tid: TID })).toEqual({ ok: true });
    expect(api.transfersFor()[0]?.files[0]?.where).toBeNull();
    expect(close).toHaveBeenCalledTimes(2);
  });
  it('recovers an empty file on a zero-byte put after transient finalization failure', async () => {
    const close = vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error('disk unavailable')).mockResolvedValue(undefined);
    const target: HubSink = { exists: () => Promise.resolve(false), create: () => Promise.resolve({ write: () => Promise.resolve(), close, abort: () => Promise.resolve() }) };
    const { exchange, call } = await setup({ sink: target });
    expect(await call('offer', { tid: TID, files: [{ name: 'empty', size: 0 }] })).toMatchObject(error(500, 'internal'));
    expect(await exchange('put', { tid: TID, i: 0, offset: 0 })).toEqual({ bytes: 0 });
    expect(await exchange('end', { tid: TID })).toEqual({ ok: true });
  });
  it('handles sinks with no location metadata and maps unexpected read failures to internal errors', async () => {
    const target: HubSink = { exists: () => Promise.resolve(false), create: () => Promise.resolve({ write: () => Promise.resolve(), close: () => Promise.resolve(), abort: () => Promise.resolve() }) };
    const { api, call, exchange } = await setup({ sink: target });
    await exchange('offer', { tid: TID, files: [{ name: 'a', size: 1 }] });
    await exchange('put', { tid: TID, i: 0, offset: 0 }, Uint8Array.of(1));
    expect(api.transfersFor()[0]?.files[0]?.where).toBeNull();
    const tid = await api.sendToDevice(DEVICE, [new File(['payload'], 'data')]);
    const errorListener = vi.fn<(event: HubEvents['error']) => void>();
    api.on('error', errorListener);
    vi.spyOn(Blob.prototype, 'arrayBuffer').mockRejectedValueOnce(new Error('read failed'));
    expect(await call('pull', { tid, i: 0, offset: 0, length: 1 })).toMatchObject(error(500, 'internal'));
    expect(errorListener.mock.calls[0]?.[0].error).toMatchObject({ message: 'read failed' });
  });
  it('wakes every pending long-poll waiter when an outbox entry arrives', async () => {
    const { api, exchange } = await setup();
    const seen = vi.fn(); api.on('device-seen', seen);
    const requests = [exchange('sync', { wait: 1000 }), exchange('sync', { wait: 1000 })];
    await vi.waitFor(() => { expect(seen).toHaveBeenCalledTimes(2); });
    const tid = await api.sendToDevice(DEVICE, [new File(['content'], 'new.txt')]);
    for (const response of await Promise.all(requests)) expect(response['outbox']).toEqual([expect.objectContaining({ tid })]);
  });
});

describe('concurrent uploads and transfer history', () => {
  it('rejects queued writes after cancellation and aborts the outstanding sink', async () => {
    const writing = Promise.withResolvers<undefined>();
    const release = Promise.withResolvers<undefined>();
    const abort = vi.fn(() => Promise.resolve());
    const target: HubSink = {
      exists: () => Promise.resolve(false),
      create: () => Promise.resolve({
        write: () => { writing.resolve(undefined); return release.promise; },
        close: () => Promise.resolve(), abort,
      }),
    };
    const { api, exchange, call } = await setup({ sink: target });
    await exchange('offer', { tid: TID, files: [{ name: 'partial', size: 2 }] });
    const seen = vi.fn(); api.on('device-seen', seen);
    const first = call('put', { tid: TID, i: 0, offset: 0 }, Uint8Array.of(1));
    await writing.promise;
    const second = call('put', { tid: TID, i: 0, offset: 1 }, Uint8Array.of(2));
    await vi.waitFor(() => { expect(seen).toHaveBeenCalledTimes(2); });
    const cancelling = call('cancel', { tid: TID });
    await vi.waitFor(() => { expect(seen).toHaveBeenCalledTimes(3); });
    release.resolve(undefined);
    expect(await first).toMatchObject(error(404, 'not-found'));
    expect(await second).toMatchObject(error(404, 'not-found'));
    expect(await cancelling).toMatchObject({ status: 200 });
    expect(abort).toHaveBeenCalledTimes(1);
    expect(api.transfersFor()).toHaveLength(0);
  });
  it('retains unrelated recent transfer records and prunes records older than seven days', async () => {
    let now = 1000;
    const { exchange, saved } = await setup({ now: () => now });
    for (const tid of [TID, '111111111111111111111111']) {
      await exchange('offer', { tid, files: [{ name: 'empty', size: 0 }] });
      now += 100;
    }
    expect(await saved.kv.get('transferLog')).toHaveLength(2);
    now += 7 * 24 * 3600_000;
    await exchange('offer', { tid: '222222222222222222222222', files: [{ name: 'new', size: 0 }] });
    const log: unknown = await saved.kv.get('transferLog');
    expect(log).toHaveLength(1);
    expect(log).toEqual([expect.objectContaining({ key: `${DEVICE}:222222222222222222222222` })]);
  });
});
