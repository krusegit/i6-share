import { afterEach, describe, expect, test, vi } from 'vitest';
import { createShareEngine, memoryStore } from '../public/client.js';
import type { ClientEvents, ClientStore, Fetch, HubRecord, ShareEngine, TransferSnapshot } from '../public/client-types.js';
import * as protocol from '../public/lib/proto.js';
import type { JsonObject } from '../public/lib/proto.js';

const hubId = '0123456789abcdef';
const deviceId = 'fedcba9876543210';
const secret = protocol.b64url(new Uint8Array(32).fill(7));
const record: HubRecord = { hubId, name: 'Computer', port: 47616, addrs: ['127.0.0.1'], lastAddr: '127.0.0.1', secret, pairedAt: 10, lastSeen: 20 };
const active: ShareEngine[] = [];
afterEach(() => { for (const engine of active) engine.stop(); active.splice(0); vi.restoreAllMocks(); });

interface RequestData { readonly op: string; readonly json: JsonObject; readonly binary: Uint8Array<ArrayBuffer>; readonly signal: AbortSignal | null }
type Reply = { readonly json: JsonObject; readonly binary?: Uint8Array<ArrayBuffer> } | Response;
type Responder = (request: RequestData) => Reply | Promise<Reply>;
const pendingResponse = (signal: AbortSignal | null): Promise<Response> => new Promise((_resolve, reject) => {
  if (signal?.aborted === true) reject(new Error('aborted'));
  else signal?.addEventListener('abort', () => { reject(new Error('aborted')); }, { once: true });
});
const success: Responder = ({ op, json, binary }) => ({ json: op === 'offer' ? { received: [] } : op === 'put' ? { bytes: Number(json['offset']) + binary.length } : { ok: true } });
const fixture = async (respond: Responder = success, options: { readonly queue?: ClientStore; readonly kv?: ClientStore; readonly hubs?: ClientStore; readonly hello?: () => unknown; readonly visible?: boolean } = {}) => {
  const calls: RequestData[] = [];
  const key = await protocol.deviceKey(protocol.unb64url(secret), deviceId);
  const fetch: Fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.pathname === '/i6/hello') return Response.json(options.hello?.() ?? { app: 'i6-share-hub', id: hubId, name: 'Computer', addrs: ['127.0.0.1'] });
    const op = url.pathname.slice('/i6/'.length);
    const envelope = await protocol.open(key, protocol.requestAad(op, deviceId), await request.arrayBuffer());
    const data: RequestData = { op, json: envelope.json, binary: envelope.binary, signal: request.signal };
    calls.push(data);
    const reply = await respond(data);
    if (reply instanceof Response) return reply;
    return new Response((await protocol.seal(key, protocol.responseAad(op, envelope.iv), reply.json, reply.binary)).body);
  };
  const kv = options.kv ?? memoryStore([['deviceId', deviceId]]);
  const hubs = options.hubs ?? memoryStore([[hubId, record]]);
  const queue = options.queue ?? memoryStore();
  const engine = createShareEngine({ kv, hubs, queue, fetch });
  active.push(engine);
  await engine.init({ visible: options.visible ?? false });
  return { engine, calls, kv, hubs, queue };
};
const event = <K extends keyof ClientEvents>(engine: ShareEngine, type: K, predicate: (detail: ClientEvents[K]) => boolean): Promise<ClientEvents[K]> => new Promise((resolve) => {
  const listener = (received: CustomEvent<ClientEvents[K]>): void => {
    if (predicate(received.detail)) { engine.removeEventListener(type, listener); resolve(received.detail); }
  };
  engine.addEventListener(type, listener);
});
const finished = (engine: ShareEngine): Promise<TransferSnapshot> => event(engine, 'transfer', (detail) => detail.status === 'done' || detail.status === 'partial');

describe('functional share engine', () => {
  test('loads identity and exposes immutable views while preserving events and name changes', async () => {
    const { engine, kv } = await fixture();
    expect(engine.deviceId).toBe(deviceId);
    expect(engine.deviceName).toBeTruthy();
    expect(engine.os).toBeTruthy();
    expect(engine.visible).toBe(false);
    expect(engine.hub('missing')).toBeUndefined();
    expect(engine.hubs).toHaveLength(1);
    const hub = engine.hub(hubId);
    expect(hub?.id).toBe(hubId);
    expect(hub?.name).toBe('Computer');
    expect(hub?.lastSeen).toBe(20);
    expect(hub?.status).toBe('searching');
    expect(hub?.addr).toBeNull();
    expect(hub?.rec).toEqual(record);
    expect(Object.isFrozen(hub)).toBe(true);
    expect(Object.isFrozen(hub?.rec.addrs)).toBe(true);
    expect(Object.keys(engine)).not.toContain('_hubs');
    await engine.setDeviceName('');
    await engine.setDeviceName(engine.deviceName);
    await engine.setDeviceName(' Phone ');
    expect(await kv.get('deviceName')).toBe('Phone');
    await engine.cancel('missing');
    await engine.forget('missing');
    engine.setVisible(false);
    engine.kick();
  });

  test('creates identity, uses supplied defaults, validates stored state and restores queued files', async () => {
    const kv = memoryStore([['deviceId', null], ['deviceName', 44], ['pulledTids', ['old']]]);
    const invalidHubs = memoryStore([['invalid', { secret }]]);
    const queue = memoryStore([
      ['invalid', 42], ['done', { tid: 'done', hubId, files: [], status: 'done' }],
      ['queue', { tid: 'queue', hubId, files: [new File(['a'], 'a')], names: ['custom'], total: 1, createdAt: 10, failed: [0] }],
      ['minimal', { tid: 'minimal', hubId, files: [new File(['b'], 'b')], status: 'sending' }],
    ]);
    const engine = createShareEngine({ kv, hubs: invalidHubs, queue });
    active.push(engine);
    await engine.init({ visible: false, name: 'Custom', os: 'custom-os' });
    expect(engine.deviceId).toMatch(/^[a-f\d]{16}$/);
    expect(engine.deviceName).toBe('Custom');
    expect(engine.os).toBe('custom-os');
    expect(engine.hubs).toHaveLength(0);
    expect(engine.transfers.map((transfer) => transfer.tid)).toEqual(['queue', 'minimal']);
    expect(engine.transfers[1]?.total).toBe(1);
    await engine.cancel('queue');
    expect(engine.transfers[0]?.status).toBe('cancelled');
    await engine.cancel('queue');
  });

  test('rejects invalid sends and uploads bytes, blobs and empty files with progress', async () => {
    const { engine, queue, calls } = await fixture();
    await expect(engine.send('missing', [])).rejects.toThrow('Unknown computer');
    await expect(engine.send(hubId, [])).rejects.toThrow('No files');
    const done = finished(engine);
    const states: string[] = [];
    const listener = (received: CustomEvent<ClientEvents['transfer']>): void => { states.push(received.detail.status); };
    engine.addEventListener('transfer', listener);
    engine.addEventListener('transfer', () => { throw new Error('bad observer'); });
    const tid = await engine.send(hubId, [new File(['abc'], 'a.txt'), new Blob(['xyz']), new File([], 'empty')]);
    const transfer = await done;
    expect(transfer).toMatchObject({ tid, status: 'done', sent: 6, total: 6, failed: [] });
    expect(transfer.names).toEqual(['a.txt', 'file', 'empty']);
    expect(await queue.get(tid)).toBeUndefined();
    expect(calls.filter((request) => request.op === 'put').map((request) => request.binary.length)).toEqual([3, 3, 0]);
    expect(states).toContain('queued');
    expect(states).toContain('sending');
    expect(states).toContain('done');
    engine.removeEventListener('transfer', listener);
    expect(engine.hub(hubId)?.status).toBe('online');
    expect(engine.hub(hubId)?.addr).toBe('127.0.0.1');
  });

  test('resumes acknowledged bytes and retries 5xx and incomplete transfers', async () => {
    vi.spyOn(protocol, 'sleep').mockResolvedValue();
    let offers = 0;
    let puts = 0;
    let ends = 0;
    const { engine, calls } = await fixture((request) => {
      if (request.op === 'offer') { offers += 1; return { json: { received: offers === 1 ? [2] : [4] } }; }
      if (request.op === 'put') { puts += 1; if (puts === 1) return Response.json({ error: 'busy' }, { status: 503 }); return { json: {} }; }
      if (request.op === 'end') { ends += 1; return { json: { ok: ends > 1 } }; }
      return success(request);
    });
    const done = finished(engine);
    await engine.send(hubId, [new File(['abcd'], 'resume')]);
    expect((await done).status).toBe('done');
    expect(offers).toBe(2);
    expect(puts).toBe(2);
    expect(calls.find((request) => request.op === 'put')?.json['offset']).toBe(2);
  });

  test('failed source files produce partial delivery and persist failed indices', async () => {
    const file = new File(['missing'], 'missing');
    vi.spyOn(file, 'slice').mockImplementation(() => { throw new DOMException('gone', 'NotReadableError'); });
    const { engine } = await fixture((request) => request.op === 'end' ? { json: { ok: false } } : success(request));
    const done = finished(engine);
    await engine.send(hubId, [file, new File(['yes'], 'ok')]);
    expect(await done).toMatchObject({ status: 'partial', failed: [0], sent: 10 });
  });

  test('queue write failures warn without stopping transmission', async () => {
    const base = memoryStore();
    const queue: ClientStore = { ...base, put: () => Promise.reject(new Error('quota')), delete: () => Promise.reject(new Error('storage offline')) };
    const { engine } = await fixture(success, { queue });
    const warning = event(engine, 'warning', () => true);
    const done = finished(engine);
    await engine.send(hubId, [new File(['content'], 'file')]);
    expect((await warning).message).toContain('quota');
    expect((await done).status).toBe('done');
  });

  test('cancel aborts in-flight requests, removes storage and sends best effort cancel', async () => {
    const { engine, calls, queue } = await fixture((request) => request.op === 'put' ? pendingResponse(request.signal) : success(request));
    const tid = await engine.send(hubId, [new File(['pending'], 'pending')]);
    await vi.waitFor(() => { expect(calls.some((request) => request.op === 'put')).toBe(true); });
    await engine.cancel(tid);
    expect(engine.transfers[0]?.status).toBe('cancelled');
    expect(await queue.get(tid)).toBeUndefined();
    await vi.waitFor(() => { expect(calls.some((request) => request.op === 'cancel')).toBe(true); });
  });

  test('forget cancels pending transfers even if the remote unpair or local delete fails', async () => {
    const hubs: ClientStore = { ...memoryStore([[hubId, record]]), delete: () => Promise.reject(new Error('unavailable')) };
    const { engine, calls } = await fixture((request) => request.op === 'put' ? pendingResponse(request.signal) : request.op === 'unpair' ? Promise.reject(new Error('offline')) : success(request), { hubs });
    await engine.send(hubId, [new File(['pending'], 'pending')]);
    await vi.waitFor(() => { expect(calls.some((request) => request.op === 'put')).toBe(true); });
    await engine.forget(hubId);
    expect(engine.hubs).toHaveLength(0);
    expect(engine.transfers[0]?.status).toBe('cancelled');
  });

  test('verified revocation returns pending files and removes the paired hub', async () => {
    const { engine } = await fixture(() => Response.json({ error: 'unknown-device' }, { status: 401 }));
    const revoked = event(engine, 'unpaired', () => true);
    const file = new File(['return me'], 'returned');
    await engine.send(hubId, [file]);
    expect(await revoked).toMatchObject({ hubId, reason: 'unknown-device', files: [file] });
    expect(engine.hubs).toHaveLength(0);
    expect(engine.transfers[0]?.status).toBe('cancelled');
  });

  test('downloads file chunks, changed sizes and zero-length files, acknowledging once', async () => {
    let syncs = 0;
    const tid = 'incoming';
    const meta = [{ name: '../download', size: 10, type: 'text/plain', lastModified: 0 }, { name: '', size: 0, type: '', lastModified: 1 }];
    const { engine, kv, calls } = await fixture((request) => {
      if (request.op === 'sync') { syncs += 1; return syncs < 3 ? { json: { name: 'Renamed', addrs: ['192.168.1.5'], outbox: [{ tid, files: meta }] } } : pendingResponse(request.signal); }
      if (request.op === 'pull') return { json: { size: 3 }, binary: new TextEncoder().encode('abc') };
      return success(request);
    });
    const files: File[] = [];
    engine.addEventListener('file', (received) => { files.push(received.detail.file); });
    const done = event(engine, 'incoming', (received) => received.status === 'done');
    engine.setVisible(true);
    await done;
    await vi.waitFor(() => { expect(calls.filter((request) => request.op === 'pulled')).toHaveLength(2); });
    expect(files.map((file) => file.name)).toEqual(['_download', 'file']);
    expect(await files[0]?.text()).toBe('abc');
    expect(await kv.get('pulledTids')).toEqual([tid]);
    expect(engine.hub(hubId)?.name).toBe('Renamed');
  });

  test('incoming empty chunks retry without acknowledging a corrupt download', async () => {
    vi.spyOn(protocol, 'sleep').mockResolvedValue();
    let syncs = 0;
    const { engine, calls } = await fixture((request) => {
      if (request.op === 'sync') { syncs += 1; return syncs === 1 ? { json: { outbox: [{ tid: 'empty-chunk', files: [{ name: 'a', size: 1, type: '', lastModified: 0 }] }] } } : pendingResponse(request.signal); }
      return { json: {} };
    });
    engine.setVisible(true);
    await vi.waitFor(() => { expect(calls.some((request) => request.op === 'pull')).toBe(true); });
    expect(calls.some((request) => request.op === 'pulled')).toBe(false);
  });

  test('server shrinking a file to zero ends the download safely', async () => {
    const { engine } = await fixture((request) => request.op === 'sync' ? { json: { outbox: [{ tid: 'shrunk', files: [{ name: 'a', size: 1, type: '', lastModified: 0 }] }] } } : { json: { size: 0 } });
    const downloaded = event(engine, 'file', () => true);
    engine.setVisible(true);
    expect((await downloaded).file.size).toBe(0);
    engine.stop();
  });
});

describe('transfer recovery boundaries', () => {
  test('restores failed files and sends persisted jobs in chronological order', async () => {
    const queue = memoryStore([
      ['later', { tid: 'later', hubId, files: [new File(['later'], '', { lastModified: 0 })], createdAt: 200 }],
      ['early', { tid: 'early', hubId, files: [new File(['early'], 'early')], createdAt: 100, failed: [0], names: [] }],
      ['other', { tid: 'other', hubId: 'another', files: [], createdAt: 1 }],
    ]);
    const { engine, calls } = await fixture(success, { queue });
    await vi.waitFor(() => { expect(engine.transfers.filter((transfer) => transfer.status === 'done' || transfer.status === 'partial')).toHaveLength(2); });
    expect(calls.filter((request) => request.op === 'offer').map((request) => request.json['tid'])).toEqual(['early', 'later']);
    expect(engine.transfers.find((transfer) => transfer.tid === 'early')).toMatchObject({ status: 'partial', failed: [0], sent: 5 });
    expect(calls.find((request) => request.op === 'put')?.json['tid']).toBe('later');
  });

  test('source rejection with unknown error data uses a safe label and ignores failed persistence', async () => {
    const source = new File(['x'], 'source');
    const slice = new Blob(['x']);
    vi.spyOn(slice, 'arrayBuffer').mockRejectedValue('missing');
    vi.spyOn(source, 'slice').mockReturnValue(slice);
    const base = memoryStore([['restored', { tid: 'restored', hubId, files: [source], names: [], createdAt: 0 }]]);
    const queue: ClientStore = { ...base, put: () => Promise.reject(new Error('quota')) };
    const { engine } = await fixture(success, { queue });
    await vi.waitFor(() => { expect(engine.transfers[0]?.status).toBe('partial'); });
    expect(engine.transfers[0]?.failed).toEqual([0]);
  });

  test('handles a revoked identity during explicit forget without a duplicate unpaired event', async () => {
    const { engine } = await fixture(() => Response.json({}, { status: 401 }));
    const unpaired = vi.fn();
    engine.addEventListener('unpaired', unpaired);
    await engine.forget(hubId);
    expect(unpaired).not.toHaveBeenCalled();
    expect(engine.hubs).toHaveLength(0);
  });

  test('retains only the newest 100 incoming transfer identifiers and skips previously delivered entries', async () => {
    let syncs = 0;
    const kv = memoryStore([['deviceId', deviceId], ['pulledTids', Array.from({ length: 100 }, (_, index) => String(index))]]);
    const { engine, calls } = await fixture((request) => {
      if (request.op === 'sync') { syncs += 1; return syncs === 1 ? { json: { outbox: [{ tid: '', files: [] }, { tid: '99', files: [] }, { tid: '100', files: [] }] } } : pendingResponse(request.signal); }
      return { json: {} };
    }, { kv });
    const done = event(engine, 'incoming', (received) => received.tid === '100' && received.status === 'done');
    engine.setVisible(true);
    await done;
    const stored = await kv.get('pulledTids');
    expect(stored).toEqual(Array.from({ length: 100 }, (_, index) => String(index + 1)));
    expect(calls.filter((request) => request.op === 'pulled')).toHaveLength(2);
  });

  test('failure to persist receipt does not prevent remote acknowledgement', async () => {
    let syncs = 0;
    const base = memoryStore([['deviceId', deviceId]]);
    const kv: ClientStore = { ...base, put: (key, value) => key === 'pulledTids' ? Promise.reject(new Error('full')) : base.put(key, value) };
    const { engine, calls } = await fixture((request) => {
      if (request.op === 'sync') { syncs += 1; return syncs === 1 ? { json: { outbox: [{ tid: 'saved', files: [] }] } } : pendingResponse(request.signal); }
      return { json: {} };
    }, { kv });
    const done = event(engine, 'incoming', (received) => received.status === 'done');
    engine.setVisible(true);
    await done;
    expect(calls.some((request) => request.op === 'pulled')).toBe(true);
  });

  test('unpair during a download stops receiving and leaves other-hub jobs intact', async () => {
    const queue = memoryStore([['other', { tid: 'other', hubId: 'other', files: [] }]]);
    const { engine } = await fixture((request) => request.op === 'sync'
      ? { json: { outbox: [{ tid: 'receiving', files: [{ name: 'x', size: 1, type: '', lastModified: 1 }] }] } }
      : Response.json({}, { status: 401 }), { queue });
    const unpaired = event(engine, 'unpaired', () => true);
    engine.setVisible(true);
    expect((await unpaired).reason).toBe('');
    expect(engine.transfers[0]?.status).toBe('queued');
  });
});

test('stored names win over guesses and offers without resume data start at zero', async () => {
  const kv = memoryStore([['deviceId', deviceId], ['deviceName', 'Stored phone']]);
  const { engine } = await fixture((request) => request.op === 'offer' ? { json: {} } : success(request), { kv });
  expect(engine.deviceName).toBe('Stored phone');
  const done = finished(engine);
  await engine.send(hubId, [new File(['x'], 'x')]);
  expect((await done).sent).toBe(1);
});

test('pairing reports browser blocking, persists trust, replaces an existing hub and forwards status', async () => {
  vi.spyOn(protocol, 'sleep').mockResolvedValue();
  const token = new Uint8Array(16).fill(3);
  const key = await protocol.pairKey(token, hubId);
  let hellos = 0;
  const fetch: Fetch = async (input, init) => {
    const request = new Request(input, init);
    if (new URL(request.url).pathname === '/i6/hello') {
      hellos += 1;
      if (hellos === 1) throw new TypeError('blocked');
      return Response.json({ app: 'i6-share-hub', id: hubId, name: 'Computer', addrs: ['127.0.0.1'] });
    }
    const body = new Uint8Array(await request.arrayBuffer());
    const reply = await protocol.seal(key, protocol.responseAad('pair', body.slice(0, 12)), { secret, hubId, name: 'Paired Computer' });
    return new Response(reply.body);
  };
  const hubs = memoryStore();
  const engine = createShareEngine({ kv: memoryStore(), hubs, queue: memoryStore(), fetch });
  active.push(engine);
  await engine.init({ visible: false });
  const blocked: boolean[] = [];
  const statuses: string[] = [];
  engine.addEventListener('network', (received) => { blocked.push(received.detail.blocked); });
  const payload = { hubId, token, port: 47616, name: 'Code Computer', addrs: ['127.0.0.1'] };
  const paired = await engine.pair(payload, { onStatus: (status) => { statuses.push(status); } });
  expect(statuses).toEqual(['searching', 'blocked', 'searching', 'pairing']);
  expect(blocked).toEqual([true, false]);
  expect(paired.name).toBe('Paired Computer');
  expect(await hubs.get(hubId)).toMatchObject({ hubId, secret });
  await engine.pair(payload);
  expect(engine.hubs).toHaveLength(1);
});

test('event listeners preserve once, abort, duplicate and removal semantics', async () => {
  const engine = createShareEngine({ kv: memoryStore(), hubs: memoryStore(), queue: memoryStore() });
  active.push(engine);
  const once = vi.fn();
  const persistent = vi.fn();
  const aborted = vi.fn();
  const removed = vi.fn();
  const beforeAbort = vi.fn();
  const later = vi.fn();
  const abort = new AbortController();
  const priorAbort = AbortSignal.abort();
  engine.addEventListener('hubs', once, { once: true });
  engine.addEventListener('hubs', once);
  engine.addEventListener('hubs', persistent, false);
  engine.addEventListener('hubs', aborted, { signal: priorAbort });
  engine.addEventListener('hubs', removed, { signal: abort.signal });
  abort.abort();
  const after = new AbortController();
  engine.addEventListener('hubs', beforeAbort, { signal: after.signal });
  engine.addEventListener('hubs', () => { engine.removeEventListener('hubs', later); });
  engine.addEventListener('hubs', later);
  engine.removeEventListener('hubs', aborted);
  await engine.init({ visible: false });
  after.abort();
  await engine.init({ visible: false });
  expect(once).toHaveBeenCalledTimes(1);
  expect(persistent).toHaveBeenCalledTimes(2);
  expect(aborted).not.toHaveBeenCalled();
  expect(removed).not.toHaveBeenCalled();
  expect(beforeAbort).toHaveBeenCalledTimes(1);
  expect(later).not.toHaveBeenCalled();
});
