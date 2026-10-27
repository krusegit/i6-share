import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHubApi, ONLINE_MS, PARTIAL_TTL_MS } from '../hub/api.js';
import type { HubApi, HubEvents } from '../hub/api-types.js';
import { CHUNK_SIZE, decodePairPayload, open, pairKey, requestAad, responseAad, seal } from '../public/lib/proto.js';
import { createSink, createStorage, harness, pairSession } from './api-harness.js';

const tid = 'a'.repeat(24);
const tid2 = 'b'.repeat(24);
const file = (name = 'photo.jpg', size = 3): Readonly<Record<string, unknown>> => ({ name, size, type: 'image/jpeg', lastModified: 7 });
const instances: HubApi[] = [];
const setup = async (): ReturnType<typeof harness> => { const value = await harness(); instances.push(value.api); return value; };
afterEach(() => { instances.splice(0).forEach((api) => { api.dispose(); }); vi.useRealTimers(); });

const events = <K extends keyof HubEvents>(api: HubApi, type: K): HubEvents[K][] => {
  const log: HubEvents[K][] = []; api.on(type, (detail) => { log.push(detail); }); return log;
};

describe('Hub API lifecycle and routing', () => {
  it('initializes identity, sanitizes names, lists addresses, and serves root and hello', async () => {
    const { api, storage } = await setup();
    expect(api.hubId).toMatch(/^[0-9a-f]{16}$/u); expect(api.name).toBe('Linux PC');
    expect(api.hello()).toMatchObject({ id: api.hubId, v: 1, port: 47616, addrs: ['127.0.0.1'] });
    expect(await api.setName('  Desktop\u0001 PC  ')).toBe('Desktop  PC'); expect(storage.kv.values.get('hubName')).toBe('Desktop  PC');
    expect(await api.setName('  ')).toBe('Linux PC');
    for (const path of ['/', '/index.html']) expect(await api.handle({ method: 'GET', path })).toMatchObject({ status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    for (const method of ['GET', 'POST']) expect(await api.handle({ method, path: '/i6/hello' })).toMatchObject({ status: 200 });
    for (const [method, path] of [['GET', '/i6/sync'], ['POST', '/bad'], ['POST', '/i6/unknown']]) {
      if (method === undefined || path === undefined) throw new Error('missing fixture');
      expect((await api.handle({ method, path })).status).toBe(404);
    }
    expect((await api.handle({ method: 'POST', path: '/i6/sync' })).status).toBe(400);
    expect((await api.handle({ method: 'POST', path: '/i6/sync', query: 'd=1234567890abcdef' })).status).toBe(401);
    expect(api.isOnline('missing')).toBe(false); expect(await api.forgetDevice('missing')).toBe(false); expect(await api.cancelOutbox(tid)).toBe(false);
    await expect(api.sendToDevice('missing', [])).rejects.toThrow('Unknown device');
  });
  it('loads and validates persisted records, survives stale queue deletion failures', async () => {
    const storage = createStorage({ hubId: 'a'.repeat(16), hubName: 'Saved PC', transferLog: [{ key: 'valid', at: 1, sizes: [0], names: ['empty'], saved: [true] }, { key: 'also', sizes: [0], names: ['empty'], saved: [false], where: ['folder', false] }, {}, { key: 'bad', sizes: [-1] }] });
    storage.devices.values.set('valid', { deviceId: 'b'.repeat(16), secret: 'AA', name: 'Phone', pairedAt: 2 });
    storage.devices.values.set('empty-name', { deviceId: 'c'.repeat(16), secret: 'AA' });
    storage.devices.values.set('bad', { deviceId: 'bad' });
    storage.devices.values.set('null', null);
    storage.queue.values.set('good', { tid, deviceId: 'b'.repeat(16), files: [new File(['x'], 'x')], createdAt: 3 });
    storage.queue.values.set('orphan', { tid: tid2, deviceId: 'd'.repeat(16), files: [new File(['x'], 'x')] });
    storage.queue.values.set('bad-file', { tid: 'c'.repeat(24), deviceId: 'b'.repeat(16), files: [{}] });
    storage.queue.values.set('bad', null);
    storage.queue.failures.add('delete');
    const { api } = await harness({ storage, getAddrs: () => { throw new Error('network'); } }); instances.push(api);
    expect(api.hubId).toBe('a'.repeat(16)); expect(api.name).toBe('Saved PC'); expect(api.addrs()).toEqual([]);
    expect(api.listDevices()).toHaveLength(2); expect(api.outboxFor()).toHaveLength(1); expect(api.outboxFor('not-this')).toEqual([]);
  });
  it('requires initialization before generating pairing codes and runs scheduled sweeps', async () => {
    vi.useFakeTimers();
    const api = createHubApi({ storage: createStorage(), sink: createSink(), sweepIntervalMs: 5 }); instances.push(api);
    expect(() => api.newPairCode()).toThrow('init() first'); await api.init(); await vi.advanceTimersByTimeAsync(10); await api.init(); api.dispose();
  });
});

describe('pairing and authentication', () => {
  it('pairs once, retries same device idempotently, rejects others, and updates profiles', async () => {
    const { api, clock, storage } = await setup();
    const paired = events(api, 'device-paired'); const updates = events(api, 'device-updated');
    const session = await pairSession(api); expect(paired).toHaveLength(1); expect(api.isOnline(session.deviceId)).toBe(true);
    const repeated = await pairSession(api, session.deviceId, session.code); expect(repeated.secret).toBe(session.secret); expect(paired).toHaveLength(1);
    await expect(pairSession(api, 'fedcba0987654321', session.code)).rejects.toThrow('bad-auth');
    await expect(api.sendToDevice(session.deviceId, [])).rejects.toThrow('No files');
    const synced = await session.call('sync', { name: 'New Name', os: 'Linux', wait: -1 }); expect(synced.status).toBe(200); expect(updates).toHaveLength(1);
    await session.call('sync', { name: '', os: 'Linux', wait: 'wrong' }); expect(updates).toHaveLength(1);
    clock.time += ONLINE_MS; expect(api.isOnline(session.deviceId)).toBe(false); expect(api.listDevices()[0]?.online).toBe(false);
    clock.time += 60_001; storage.devices.failures.add('put'); const errors = events(api, 'error');
    await session.request('sync', {}, undefined, { remoteAddress: '192.168.1.9' }); expect(errors).toHaveLength(1); expect(api.listDevices()[0]?.lastAddr).toBe('192.168.1.9');
    const again = await pairSession(api); expect(again.secret).not.toBe(session.secret); expect((await session.call('sync')).status).toBe(401);
    expect((await again.call('unpair')).status).toBe(200); expect(api.listDevices()).toEqual([]);
  });
  it('rejects invalid codes, expired/replaced tokens, bad auth and invalid device IDs', async () => {
    const { api, clock } = await setup();
    const first = api.newPairCode();
    for (let i = 0; i < 5; i += 1) api.newPairCode();
    await expect(pairSession(api, '1234567890abcdef', first.payload)).rejects.toThrow('bad-auth');
    const code = api.newPairCode(); const decoded = decodePairPayload(code.payload); const key = await pairKey(decoded.token, decoded.hubId);
    const badDevice = await seal(key, requestAad('pair', 'pair'), { deviceId: 'no' });
    expect((await api.handle({ method: 'POST', path: '/i6/pair', query: `h=${api.hubId}`, body: badDevice.body })).status).toBe(400);
    expect((await api.handle({ method: 'POST', path: '/i6/pair', query: `h=${api.hubId}`, body: new Uint8Array(65_537) })).status).toBe(413);
    expect((await api.handle({ method: 'POST', path: '/i6/pair', query: 'h=wrong' })).status).toBe(401);
    expect((await api.handle({ method: 'POST', path: '/i6/pair', query: new URLSearchParams(`h=${api.hubId}`) })).status).toBe(401);
    clock.time = code.expiresAt; await expect(pairSession(api, '1234567890abcdef', code.payload)).rejects.toThrow('bad-auth');
    await api.sweep();
  });
  it('exposes typed subscriptions and EventTarget interop without leaking secrets', async () => {
    const { api } = await setup(); const listener = vi.fn(); const stop = api.on('device-paired', listener);
    const legacy = vi.fn(); api.addEventListener('device-paired', legacy);
    await pairSession(api); expect(listener).toHaveBeenCalledOnce(); expect(legacy).toHaveBeenCalledOnce(); expect(api.listDevices()[0]).not.toHaveProperty('secret');
    stop(); api.removeEventListener('device-paired', legacy); await pairSession(api); expect(listener).toHaveBeenCalledOnce(); expect(legacy).toHaveBeenCalledOnce();
    api.on('device-paired', () => { throw new Error('listener'); }); await pairSession(api);
  });
});

describe('incoming transfers', () => {
  it('saves, resumes, deduplicates, finalizes, records and expires files', async () => {
    const { api, sink, clock, storage } = await setup(); const session = await pairSession(api);
    const done = events(api, 'transfer-complete'); const saved = events(api, 'file-saved');
    const offered = await session.call('offer', { tid, files: [file(), file('empty', 0)] }); expect(offered.json['received']).toEqual([0, 0]);
    expect(api.transfersFor(session.deviceId)[0]?.done).toBe(1); expect(api.transfersFor('other')).toEqual([]);
    expect((await session.call('end', { tid })).json['ok']).toBe(false);
    expect((await session.call('put', { tid, i: 0, offset: 2 }, Uint8Array.of(1))).json).toEqual({ error: 'offset', bytes: 0 });
    expect((await session.call('put', { tid, i: 0, offset: 0 })).json['bytes']).toBe(0);
    clock.time += 600; await session.call('put', { tid, i: 0, offset: 0 }, Uint8Array.of(1));
    expect((await session.call('offer', { tid, files: [file(), file('empty', 0)] })).json['received']).toEqual([1, 0]);
    clock.time += 600; await session.call('put', { tid, i: 0, offset: 1 }, Uint8Array.of(2));
    clock.time += 600; await session.call('put', { tid, i: 0, offset: 2 }, Uint8Array.of(3));
    expect(sink.files.get('photo.jpg')).toEqual(Uint8Array.of(1, 2, 3)); expect(saved).toHaveLength(2); expect(done).toHaveLength(1);
    expect(api.transfersFor()[0]?.speed).toBeGreaterThan(0);
    expect((await session.call('put', { tid, i: 0, offset: 3 }, Uint8Array.of(9))).json['bytes']).toBe(3);
    expect((await session.call('end', { tid })).json['ok']).toBe(true);
    clock.time += PARTIAL_TTL_MS + 1; await api.sweep(); expect(api.transfersFor()).toEqual([]);
    expect((await session.call('end', { tid })).json['ok']).toBe(true);
    expect((await session.call('offer', { tid, files: [file(), file('empty', 0)] })).json['received']).toEqual([3, 0]);
    expect(api.transfersFor()[0]?.complete).toBe(true); expect(storage.kv.values.get('transferLog')).toBeDefined();
    await session.call('cancel', { tid }); expect(api.transfersFor()).toEqual([]);
    expect((await session.call('end', { tid: tid2 })).status).toBe(404);
  });
  it('validates every incoming operation field and file metadata', async () => {
    const { api } = await setup(); const session = await pairSession(api);
    for (const data of [{}, { tid: 'bad' }, { tid, files: [] }, { tid, files: 'no' }, { tid, files: Array.from({ length: 10_001 }, () => ({})) }, { tid, files: [null] }, { tid, files: [{ size: -1 }] }, { tid, files: [{ size: 1, name: 4 }] }]) expect((await session.call('offer', data)).status).toBe(400);
    expect((await session.call('offer', { tid, files: [{ size: 2 }] })).status).toBe(200);
    expect((await session.call('offer', { tid, files: [file('x', 3)] })).status).toBe(400);
    expect((await session.call('offer', { tid, files: [file('x', 2), file('y', 1)] })).status).toBe(400);
    for (const data of [{ tid }, { tid, i: -1, offset: 0 }, { tid, i: 0, offset: -1 }, { tid, i: 99, offset: 0 }]) expect((await session.call('put', data)).status).toBe(400);
    expect((await session.call('put', { tid, i: 0, offset: 0 }, new Uint8Array(CHUNK_SIZE + 1))).status).toBe(413);
    expect((await session.call('put', { tid: tid2, i: 0, offset: 0 })).status).toBe(404);
    expect((await session.call('put', { tid, i: 0, offset: 0 }, new Uint8Array(3))).status).toBe(400);
    await session.call('cancel', { tid }); expect((await session.call('cancel', { tid })).json['ok']).toBe(true);
  });
  it('keeps filenames unique across pending/completed files and handles exhausted suffixes', async () => {
    const { api, sink } = await setup(); const session = await pairSession(api);
    sink.files.set('photo.jpg', new Uint8Array());
    await session.call('offer', { tid, files: [file(), file(), file('notes', 1), file('notes', 1)] });
    expect(api.transfersFor()[0]?.files.map((entry) => entry.name)).toEqual(['photo (1).jpg', 'photo (2).jpg', 'notes', 'notes (1)']);
    sink.failures.add('all-exist'); await session.call('offer', { tid: tid2, files: [file()] }); expect(api.transfersFor()[1]?.files[0]?.name).toMatch(/^photo \([a-f0-9]{8}\)\.jpg$/u);
    await session.call('cancel', { tid }); await session.call('cancel', { tid: tid2 });
  });
  it('resets failed writes and close operations then retries successfully', async () => {
    const { api, sink, storage } = await setup(); const session = await pairSession(api); const errors = events(api, 'sink-error');
    sink.failures.add('exists'); await session.call('offer', { tid, files: [file()] });
    sink.failures.add('create'); expect((await session.call('put', { tid, i: 0, offset: 0 }, Uint8Array.of(1))).status).toBe(500); sink.failures.delete('create');
    sink.failures.add('write'); sink.failures.add('abort'); expect((await session.call('put', { tid, i: 0, offset: 0 }, Uint8Array.of(1))).status).toBe(500); sink.failures.delete('write'); sink.failures.delete('abort');
    sink.failures.add('close'); expect((await session.call('put', { tid, i: 0, offset: 0 }, Uint8Array.of(1, 2, 3))).status).toBe(500); sink.failures.delete('close');
    storage.kv.failures.add('put'); expect((await session.call('put', { tid, i: 0, offset: 0 }, Uint8Array.of(1, 2, 3))).status).toBe(200);
    expect(errors).toHaveLength(3); expect(sink.files.get('photo.jpg')).toEqual(Uint8Array.of(1, 2, 3));
  });
  it('discards partial files on cancel/expiry/revocation and retains completed ones', async () => {
    const { api, sink, clock, storage } = await setup(); const session = await pairSession(api); const cancelled = events(api, 'transfer-cancelled');
    await session.call('offer', { tid, files: [file(), file('empty', 0)] }); await session.call('put', { tid, i: 0, offset: 0 }, Uint8Array.of(1));
    sink.failures.add('abort'); await session.call('cancel', { tid }); expect(cancelled[0]?.reason).toBe('cancel');
    await session.call('offer', { tid: tid2, files: [file()] }); clock.time += PARTIAL_TTL_MS; await api.sweep(); expect(api.transfersFor()).toHaveLength(1); clock.time += 1; await api.sweep(); expect(cancelled[1]?.reason).toBe('expired');
    await session.call('offer', { tid, files: [file()] }); await api.sendToDevice(session.deviceId, [new File(['x'], 'out')]); storage.devices.failures.add('delete'); storage.queue.failures.add('delete');
    await api.forgetDevice(session.deviceId); expect(cancelled[2]?.reason).toBe('unpaired'); expect(api.outboxFor()).toEqual([]); expect(api.transfersFor()).toEqual([]);
  });
});

describe('outgoing and long-poll delivery', () => {
  it('persists outgoing files, reports progress, validates offsets, and acknowledges delivery', async () => {
    const { api, clock, storage } = await setup(); const session = await pairSession(api);
    const delivered = events(api, 'outbox-delivered'); const outgoing = await api.sendToDevice(session.deviceId, [new File(['abcd'], 'pc.txt'), new File(['xy'], '')]);
    expect(api.outboxFor(session.deviceId)[0]).toMatchObject({ started: false, total: 6 });
    expect((await session.call('sync', { wait: 20 })).json['outbox']).toHaveLength(1);
    for (const data of [{}, { tid: outgoing }, { tid: outgoing, i: 0, offset: -1, length: 1 }, { tid: outgoing, i: 0, offset: 0, length: CHUNK_SIZE + 1 }, { tid: outgoing, i: 9, offset: 0, length: 1 }, { tid: outgoing, i: 0, offset: 9, length: 1 }]) expect((await session.call('pull', data)).status).toBe(400);
    expect((await session.call('pull', { tid, i: 0, offset: 0, length: 1 })).status).toBe(404);
    expect((await session.call('pull', { tid: outgoing, i: 0, offset: 0, length: 1 })).binary).toEqual(Uint8Array.of(97));
    clock.time += 600; await session.call('pull', { tid: outgoing, i: 0, offset: 1, length: 1 }); clock.time += 600; await session.call('pull', { tid: outgoing, i: 1, offset: 0, length: 2 });
    expect(api.outboxFor()[0]?.speed).toBeGreaterThan(0); expect(api.outboxFor()[0]?.started).toBe(true);
    storage.queue.failures.add('delete'); expect((await session.call('pulled', { tid: outgoing })).json['ok']).toBe(true); expect(delivered[0]?.item.bytes).toBe(6); expect(api.outboxFor()).toEqual([]);
    await session.call('pulled', { tid: outgoing });
    const unstarted = await api.sendToDevice(session.deviceId, [new File([], 'empty')]); await session.call('pulled', { tid: unstarted });
    storage.queue.failures.add('put'); const errors = events(api, 'error'); const cancel = await api.sendToDevice(session.deviceId, [new File(['x'], 'x')]); expect(errors).toHaveLength(1); expect(await api.cancelOutbox(cancel)).toBe(true);
  });
  it('wakes long polls for new work, unpair, timeout and disposal', async () => {
    const { api } = await setup(); const session = await pairSession(api);
    const poll = session.call('sync', { wait: 1000 }); await new Promise((resolve) => setTimeout(resolve, 20)); await api.sendToDevice(session.deviceId, [new File(['x'], 'x')]); expect((await poll).status).toBe(200);
    for (const item of api.outboxFor()) await api.cancelOutbox(item.tid);
    expect((await session.call('sync', { wait: 1 })).status).toBe(200);
    const disposal = session.call('sync', { wait: 1000 }); await new Promise((resolve) => setTimeout(resolve, 20)); api.dispose(); expect((await disposal).status).toBe(200);
    const revoked = session.call('sync', { wait: 1000 }); await new Promise((resolve) => setTimeout(resolve, 20)); await api.forgetDevice(session.deviceId); expect((await revoked).status).toBe(401);
  });
  it('handles concurrent puts in order and pairing responses remain request-bound', async () => {
    const { api } = await setup(); const session = await pairSession(api); await session.call('offer', { tid, files: [file()] });
    const responses = await Promise.all([session.call('put', { tid, i: 0, offset: 0 }, Uint8Array.of(1)), session.call('put', { tid, i: 0, offset: 0 }, Uint8Array.of(1))]);
    expect(responses.every((response) => response.status === 200)).toBe(true); expect(api.transfersFor()[0]?.bytes).toBe(1);
    const pairResponse = await api.handle({ method: 'POST', path: '/i6/pair', query: `h=${api.hubId}`, body: session.pairBody });
    if (typeof pairResponse.body === 'string') throw new Error('expected binary');
    expect((await open(session.pairCryptoKey, responseAad('pair', session.pairIv), pairResponse.body)).json['secret']).toBe(session.secret);
  });
});


describe('hub races across storage and sink boundaries', () => {
  it('makes concurrent expiry and cancellation idempotent', async () => {
    const aborting = Promise.withResolvers<undefined>();
    const release = Promise.withResolvers<undefined>();
    const sink = createSink();
    const { api, clock } = await harness({ sink: {
      ...sink,
      create: async (name, metadata) => {
        const handle = await sink.create(name, metadata);
        return { ...handle, abort: async () => {
          if (name === 'first') { aborting.resolve(undefined); await release.promise; }
          await handle.abort();
        } };
      },
    } });
    instances.push(api); const session = await pairSession(api);
    await session.call('offer', { tid, files: [file('first')] });
    await session.call('offer', { tid: tid2, files: [file('second')] });
    await session.call('put', { tid, i: 0, offset: 0 }, Uint8Array.of(1));
    clock.time += PARTIAL_TTL_MS + 1;
    const cancellations = events(api, 'transfer-cancelled');
    const sweep = api.sweep(); await aborting.promise;
    expect((await session.call('cancel', { tid })).status).toBe(200);
    await api.sweep();
    expect((await session.call('cancel', { tid: tid2 })).status).toBe(200);
    release.resolve(undefined); await sweep;
    expect(api.transfersFor()).toEqual([]);
    expect(cancellations).toHaveLength(2);
  });
  it('reports committed files even if the device is revoked while closing the sink', async () => {
    const closing = Promise.withResolvers<undefined>(); const release = Promise.withResolvers<undefined>();
    const sink = createSink();
    const { api } = await harness({ sink: { ...sink, create: async (name, metadata) => {
      const handle = await sink.create(name, metadata);
      return { ...handle, close: async () => { closing.resolve(undefined); await release.promise; await handle.close(); } };
    } } });
    instances.push(api); const session = await pairSession(api); const saved = events(api, 'file-saved');
    await session.call('offer', { tid, files: [file()] });
    const upload = session.call('put', { tid, i: 0, offset: 0 }, Uint8Array.of(1, 2, 3));
    await closing.promise; const forgotten = api.forgetDevice(session.deviceId);
    release.resolve(undefined); await Promise.all([upload, forgotten]);
    expect(saved[0]?.deviceName).toBe('Test Phone'); expect(sink.files.get('photo.jpg')).toEqual(Uint8Array.of(1, 2, 3));
    expect(api.transfersFor()).toEqual([]);
  });
});
