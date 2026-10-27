import * as net from 'node:net';
import { request as httpRequest } from 'node:http';
import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Schema } from 'effect';
import { expect, test } from 'vitest';
import { createShareEngine, memoryStore } from '../public/client.js';
import type { ClientEvents, ShareEngine } from '../public/client-types.js';
import { decodePairPayload, encodePairPayload, pairLink } from '../public/lib/proto.js';
import { AdminStatusResponseSchema, HelloResponseSchema, OperationResponseSchema, PairCodeResponseSchema, QueueFilesResponseSchema } from '../public/generated/contracts.js';
import { startNativeHub } from './native-harness.js';

const createProxy = () => {
  const state = { targetPort: 0, bytes: 0, cutAt: Infinity, cuts: 0 };
  const live = new Set<Readonly<{ client: net.Socket; upstream: net.Socket }>>();
  const sever = (): void => {
    for (const pair of live) { pair.client.destroy(); pair.upstream.destroy(); }
    live.clear();
  };
  const server = net.createServer((client) => {
    const upstream = net.connect(state.targetPort, '127.0.0.1');
    const pair = { client, upstream };
    live.add(pair);
    const kill = (): void => { live.delete(pair); client.destroy(); upstream.destroy(); };
    client.on('data', (data: Buffer) => {
      state.bytes += data.length;
      if (state.bytes >= state.cutAt) {
        state.cutAt = Infinity;
        state.cuts += 1;
        sever();
      } else upstream.write(data);
    });
    upstream.on('data', (data: Buffer) => { client.write(data); });
    client.on('error', kill); upstream.on('error', kill);
    client.on('close', kill); upstream.on('close', kill);
  });
  return {
    get cuts() { return state.cuts; },
    listen: (): Promise<number> => new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address === null || typeof address === 'string') reject(new Error('Missing proxy TCP address'));
        else resolve(address.port);
      });
    }),
    cutAfter: (bytes: number): void => { state.cutAt = state.bytes + bytes; },
    retarget: (port: number): void => { state.targetPort = port; },
    sever,
    close: (): Promise<void> => { sever(); return new Promise((resolve) => { server.close(() => { resolve(); }); }); },
  };
};

const waitForEvent = <K extends keyof ClientEvents>(engine: ShareEngine, type: K, predicate: (detail: ClientEvents[K]) => boolean): Promise<ClientEvents[K]> =>
  new Promise((resolve, reject) => {
    const listener = (event: CustomEvent<ClientEvents[K]>): void => {
      if (predicate(event.detail)) { clearTimeout(timer); engine.removeEventListener(type, listener); resolve(event.detail); }
    };
    const timer = setTimeout(() => {
      engine.removeEventListener(type, listener);
      reject(new Error(`Timed out waiting for ${type}`));
    }, 90_000);
    timer.unref();
    engine.addEventListener(type, listener);
  });

test('the native backend preserves encrypted transfers through TCP cuts, restarts, durable outbox, and revocation', async () => {
  const current = { hub: await startNativeHub() };
  const proxy = createProxy();
  const clientStorage = { kv: memoryStore(), hubs: memoryStore(), queue: memoryStore() };
  const phone = { engine: createShareEngine(clientStorage) };
  proxy.retarget(current.hub.port);
  const state = () => current.hub.admin('state', Schema.decodeUnknownSync(AdminStatusResponseSchema));
  const restart = async (): Promise<void> => {
    proxy.sever();
    await current.hub.stop();
    current.hub = await startNativeHub({ root: current.hub.root });
    proxy.retarget(current.hub.port);
  };
  try {
    const port = await proxy.listen();
    await phone.engine.init({ visible: true, name: 'Test Phone', os: 'Android' });
    const code = await current.hub.admin('pair', Schema.decodeUnknownSync(PairCodeResponseSchema), {});
    const payload = decodePairPayload(code.payload);
    const link = pairLink(encodePairPayload({ ...payload, port, addrs: ['127.0.0.1'] }));
    const client = await phone.engine.pair(link);
    const initial = await state();
    expect(client.id).toBe(initial.hubId);
    expect(initial.devices.map((device) => device.deviceId)).toContain(phone.engine.deviceId);
    expect(payload.port).toBe(current.hub.port);

    const large = Buffer.alloc(9.5 * 1024 * 1024, 'encrypted upload payload');
    const small = Buffer.alloc(1234, 'small file');
    proxy.cutAfter(5 * 1024 * 1024);
    const uploaded = waitForEvent(phone.engine, 'transfer', (transfer) => transfer.status === 'done' || transfer.status === 'partial');
    await phone.engine.send(client.id, [new File([large], 'photo.jpg', { type: 'image/jpeg' }), new File([small], 'note.txt'), new File([], 'empty.bin')]);
    expect((await uploaded).status).toBe('done');
    expect(proxy.cuts).toBe(1);
    expect((await readFile(path.join(current.hub.receiveDirectory, 'photo.jpg'))).equals(large)).toBe(true);
    expect((await readFile(path.join(current.hub.receiveDirectory, 'note.txt'))).equals(small)).toBe(true);
    expect((await readFile(path.join(current.hub.receiveDirectory, 'empty.bin'))).length).toBe(0);

    const video = Buffer.alloc(10 * 1024 * 1024, 'resume after hub restart');
    const restarted = Promise.withResolvers<undefined>();
    const onProgress = (event: CustomEvent<ClientEvents['transfer']>): void => {
      if (event.detail.sent < 4 * 1024 * 1024) return;
      phone.engine.removeEventListener('transfer', onProgress);
      void restart().then(() => { restarted.resolve(undefined); }, restarted.reject);
    };
    phone.engine.addEventListener('transfer', onProgress);
    const resumed = waitForEvent(phone.engine, 'transfer', (transfer) => transfer.names.includes('video.mp4') && (transfer.status === 'done' || transfer.status === 'partial'));
    await phone.engine.send(client.id, [new File([video], 'video.mp4', { type: 'video/mp4' })]);
    await restarted.promise;
    expect((await resumed).status).toBe('done');
    const candidates = await Promise.all((await readdir(current.hub.receiveDirectory)).filter((name) => name.startsWith('video')).map((name) => readFile(path.join(current.hub.receiveDirectory, name))));
    expect(candidates.some((bytes) => bytes.equals(video))).toBe(true);
    expect((await state()).hubId).toBe(initial.hubId);
    expect((await state()).devices.map((device) => device.deviceId)).toContain(phone.engine.deviceId);

    // Queue while the phone is shut down, then restart the hub and remove the original.
    // The native backend must own a durable copy; the phone must retain its pairing.
    phone.engine.stop();
    const download = Buffer.alloc(6 * 1024 * 1024, 'hub to phone payload');
    const source = path.join(current.hub.root, 'from-pc.bin');
    await writeFile(source, download);
    const outgoing = await current.hub.admin('send', Schema.decodeUnknownSync(QueueFilesResponseSchema), { deviceId: phone.engine.deviceId, paths: [source] });
    expect((await state()).outbox.map((entry) => entry.tid)).toContain(outgoing.tid);
    await restart();
    await rm(source);
    phone.engine = createShareEngine(clientStorage);
    const received = waitForEvent(phone.engine, 'file', (detail) => detail.file.name === 'from-pc.bin');
    await phone.engine.init({ visible: true, name: 'Test Phone', os: 'Android' });
    expect(Buffer.from(await (await received).file.arrayBuffer()).equals(download)).toBe(true);
    await expect.poll(async () => (await state()).outbox.length).toBe(0);

    await phone.engine.forget(client.id);
    expect(phone.engine.hubs).toHaveLength(0);
    await expect.poll(async () => (await state()).devices.length).toBe(0);
  } finally {
    phone.engine.stop();
    await current.hub.remove();
    await proxy.close();
  }
}, 180_000);

test('native administration rejects unauthenticated and cross-origin requests while protocol discovery supports LAN preflights', async () => {
  const hub = await startNativeHub();
  try {
    const response = await hub.request('/i6/hello');
    const hello: unknown = await response.json();
    expect(Schema.decodeUnknownSync(HelloResponseSchema)(hello).port).toBe(hub.port);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const preflight = await hub.request('/i6/sync', { method: 'OPTIONS', headers: { Origin: 'https://krusegit.github.io', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Private-Network': 'true' } });
    expect(preflight.ok).toBe(true);
    expect(preflight.headers.get('Access-Control-Allow-Private-Network')).toBe('true');
    expect((await hub.request('/admin/state')).status).toBe(401);
    expect((await hub.request('/admin/state', { headers: { Authorization: 'Bearer wrong' } })).status).toBe(401);
    const hostile = await hub.request('/admin/pair', { method: 'POST', headers: { Authorization: `Bearer ${hub.adminToken}`, Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' });
    expect(hostile.status).toBe(403);
    expect(hostile.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const deniedHost = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(`${hub.origin}/admin/state`, { headers: { Authorization: `Bearer ${hub.adminToken}`, Host: 'evil.example' } }, (response) => {
        response.resume(); resolve(response.statusCode ?? 0);
      });
      request.on('error', reject); request.end();
    });
    expect(deniedHost).toBe(403);
    const update = await hub.admin('settings', Schema.decodeUnknownSync(OperationResponseSchema), { name: 'Native integration hub' });
    expect(update.ok).toBe(true);
    expect((await hub.admin('state', Schema.decodeUnknownSync(AdminStatusResponseSchema))).name).toBe('Native integration hub');
  } finally { await hub.remove(); }
}, 60_000);


test('the native backend lives while a dashboard is open, tolerates reload, and exits after the final window closes', async () => {
  const hub = await startNativeHub();
  const exit = { happened: false };
  void hub.exited.then(() => { exit.happened = true; });
  try {
    const second = await hub.openDashboard();
    await hub.dashboard.close();
    await delay(2200);
    expect(exit.happened).toBe(false);
    expect((await hub.request('/i6/hello')).ok).toBe(true);
    await second.close();
    await delay(150);
    const reloaded = await hub.openDashboard();
    await delay(2200);
    expect(exit.happened).toBe(false);
    await reloaded.close();
    await expect.poll(() => exit.happened, { timeout: 5000 }).toBe(true);
  } finally { await hub.remove(); }
}, 30_000);
