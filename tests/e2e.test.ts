import * as net from 'node:net';
import { expect, test } from 'vitest';
import { createHubApi } from '../hub/api.js';
import type { HubSink } from '../hub/api-types.js';
import { startServer } from '../hub/http.js';
import { createShareEngine, memoryStore } from '../public/client.js';
import type { ClientEvents, ShareEngine } from '../public/client-types.js';
import { TCPServerSocket } from '../tools/tcp-shim.js';

const createMemorySink = (): HubSink & { readonly files: ReadonlyMap<string, Buffer> } => {
  const files = new Map<string, Buffer>();
  return {
    files,
    exists: (name) => Promise.resolve(files.has(name)),
    create: (name) => {
      const chunks: Buffer[] = [];
      return Promise.resolve({
        where: 'folder',
        write: (bytes: Uint8Array<ArrayBuffer>) => { chunks.push(Buffer.from(bytes)); return Promise.resolve(); },
        close: () => { files.set(name, Buffer.concat(chunks)); return Promise.resolve(); },
        abort: () => { chunks.splice(0); return Promise.resolve(); },
      });
    },
  };
};

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

test('encrypted transfers survive a TCP cut and hub restart, deliver both ways, and revoke pairing', async () => {
  const storage = { kv: memoryStore(), devices: memoryStore(), queue: memoryStore() };
  const sink = createMemorySink();
  const proxy = createProxy();
  const port = await proxy.listen();
  const startHub = async () => {
    const api = createHubApi({ storage, sink, getAddrs: () => ['127.0.0.1'], port });
    await api.init();
    const server = startServer({ port: 0, hosts: ['127.0.0.1'], handler: api.handle, TCPServerSocket });
    await server.ready;
    return { api, server };
  };
  const current = { hub: await startHub() };
  proxy.retarget(current.hub.server.state.port);
  const engine = createShareEngine({ kv: memoryStore(), hubs: memoryStore(), queue: memoryStore() });
  await engine.init({ visible: true, name: 'Test Phone', os: 'Android' });
  try {
    const client = await engine.pair(current.hub.api.newPairCode().link);
    expect(client.id).toBe(current.hub.api.hubId);
    expect(current.hub.api.listDevices().map((device) => device.deviceId)).toContain(engine.deviceId);

    const large = Buffer.alloc(9.5 * 1024 * 1024, 'encrypted upload payload');
    const small = Buffer.alloc(1234, 'small file');
    proxy.cutAfter(5 * 1024 * 1024);
    const uploaded = waitForEvent(engine, 'transfer', (transfer) => transfer.status === 'done' || transfer.status === 'partial');
    await engine.send(client.id, [new File([large], 'photo.jpg', { type: 'image/jpeg' }), new File([small], 'note.txt'), new File([], 'empty.bin')]);
    expect((await uploaded).status).toBe('done');
    expect(proxy.cuts).toBe(1);
    expect(sink.files.get('photo.jpg')?.equals(large)).toBe(true);
    expect(sink.files.get('note.txt')?.equals(small)).toBe(true);
    expect(sink.files.get('empty.bin')?.length).toBe(0);

    const video = Buffer.alloc(10 * 1024 * 1024, 'resume after hub restart');
    const restarted = Promise.withResolvers<undefined>();
    const onProgress = (event: CustomEvent<ClientEvents['transfer']>): void => {
      if (event.detail.sent < 4 * 1024 * 1024) return;
      engine.removeEventListener('transfer', onProgress);
      current.hub.server.close();
      current.hub.api.dispose();
      void startHub().then((hub) => {
        current.hub = hub;
        proxy.retarget(hub.server.state.port);
        proxy.sever();
        restarted.resolve(undefined);
      }, restarted.reject);
    };
    engine.addEventListener('transfer', onProgress);
    const resumed = waitForEvent(engine, 'transfer', (transfer) => transfer.names.includes('video.mp4') && (transfer.status === 'done' || transfer.status === 'partial'));
    await engine.send(client.id, [new File([video], 'video.mp4', { type: 'video/mp4' })]);
    await restarted.promise;
    expect((await resumed).status).toBe('done');
    expect([...sink.files].some(([name, bytes]) => name.startsWith('video') && bytes.equals(video))).toBe(true);

    const download = Buffer.alloc(6 * 1024 * 1024, 'hub to phone payload');
    const received = waitForEvent(engine, 'file', (detail) => detail.file.name === 'from-pc.bin');
    await current.hub.api.sendToDevice(engine.deviceId, [new File([download], 'from-pc.bin')]);
    expect(Buffer.from(await (await received).file.arrayBuffer()).equals(download)).toBe(true);
    await expect.poll(() => current.hub.api.outboxFor(engine.deviceId).length).toBe(0);

    await engine.forget(client.id);
    expect(engine.hubs).toHaveLength(0);
    await expect.poll(() => current.hub.api.listDevices().length).toBe(0);
  } finally {
    engine.stop();
    current.hub.server.close();
    current.hub.api.dispose();
    await proxy.close();
  }
}, 180_000);
