// End-to-end test: the real phone engine (public/client.js) against the real hub
// (hub/http.js + hub/api.js) running on Node through tools/tcp-shim.mjs.
//
// A flaky TCP proxy sits between them so we can cut connections mid-transfer,
// and the hub is restarted once to prove transfers resume.
//
//   node tools/test-e2e.mjs        (npm test)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Hub code imports ./lib/*, as inside the bundle: mirror that layout in a temp dir.
const BUNDLE = fs.mkdtempSync(path.join(os.tmpdir(), 'i6-e2e-'));
fs.mkdirSync(path.join(BUNDLE, 'lib'));
for (const f of fs.readdirSync(path.join(ROOT, 'hub'))) if (f.endsWith('.js')) fs.copyFileSync(path.join(ROOT, 'hub', f), path.join(BUNDLE, f));
for (const f of fs.readdirSync(path.join(ROOT, 'public/lib'))) fs.copyFileSync(path.join(ROOT, 'public/lib', f), path.join(BUNDLE, 'lib', f));

const { startServer } = await import(path.join(BUNDLE, 'http.js'));
const { HubApi } = await import(path.join(BUNDLE, 'api.js'));
const { TCPServerSocket } = await import(path.join(ROOT, 'tools/tcp-shim.mjs'));
const { ShareEngine, memoryStore } = await import(path.join(ROOT, 'public/client.js'));

let failures = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) failures++; };
const section = (s) => console.log(`\n# ${s}`);
const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout: ${what}`)), ms))]);

const rnd = (n) => { const u = new Uint8Array(n); for (let o = 0; o < n; o += 65536) crypto.getRandomValues(u.subarray(o, Math.min(n, o + 65536))); return u; };
const same = (a, b) => a.length === b.length && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

function memSink() {
  const files = new Map();
  return {
    files,
    exists: async (name) => files.has(name),
    create: async (name) => {
      const chunks = [];
      return {
        name, where: 'folder',
        write: async (b) => { chunks.push(Buffer.from(b)); },
        close: async () => { files.set(name, Buffer.concat(chunks)); },
        abort: async () => { chunks.length = 0; },
      };
    },
  };
}

// ------------------------------------------------------------ flaky proxy
// The phone talks to PROXY_PORT; we can sever every live connection at will.
function startProxy(targetPort) {
  const live = new Set();
  let bytes = 0;
  let cutAt = Infinity;
  const server = net.createServer((client) => {
    const upstream = net.connect(targetPort, '127.0.0.1');
    const pair = { client, upstream };
    live.add(pair);
    const kill = () => { live.delete(pair); client.destroy(); upstream.destroy(); };
    client.on('data', (d) => {
      bytes += d.length;
      if (bytes >= cutAt) { cutAt = Infinity; proxy.cuts++; for (const p of [...live]) { p.client.destroy(); p.upstream.destroy(); } return; }
      upstream.write(d);
    });
    upstream.on('data', (d) => client.write(d));
    client.on('error', kill); upstream.on('error', kill);
    client.on('close', kill); upstream.on('close', kill);
  });
  const proxy = {
    cuts: 0,
    listen: () => new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port))),
    cutAfter(n) { cutAt = bytes + n; },
    retarget(port) { targetPort = port; },
    close: () => { for (const p of live) { p.client.destroy(); p.upstream.destroy(); } server.close(); },
  };
  return proxy;
}

// ------------------------------------------------------------ hub
const storage = { kv: memoryStore(), devices: memoryStore(), queue: memoryStore() };
const sink = memSink();
let proxyPort;

async function startHub() {
  const api = new HubApi({ storage, sink, getAddrs: () => ['127.0.0.1'], port: proxyPort });
  await api.init();
  const server = startServer({ port: 0, handler: (r) => api.handle(r), TCPServerSocket });
  await server.ready;
  return { api, server, port: server.state.port };
}

const proxy = startProxy(0);
proxyPort = await proxy.listen();
let hub = await startHub();
proxy.retarget(hub.port);
console.log(`hub on ${hub.port}, proxy on ${proxyPort}`);

// ------------------------------------------------------------ phone
const engine = new ShareEngine({ kv: memoryStore(), hubs: memoryStore(), queue: memoryStore() });
await engine.init({ visible: true, name: 'Test Phone', os: 'Android' });
const waitFor = (type, pred, ms, what) => withTimeout(new Promise((resolve) => {
  const fn = (e) => { if (pred(e.detail)) { engine.removeEventListener(type, fn); resolve(e.detail); } };
  engine.addEventListener(type, fn);
}), ms, what);

try {
  section('pairing via QR link');
  const code = hub.api.newPairCode();
  const client = await withTimeout(engine.pair(code.link), 15000, 'pair');
  ok(client.id === hub.api.hubId, 'phone paired with the hub id from the QR');
  ok(hub.api.listDevices().some((d) => d.deviceId === engine.deviceId || d.id === engine.deviceId), 'hub lists the phone');

  section('send 3 files (9.5 MiB, small, empty) through a connection cut');
  const big = rnd(9.5 * 1024 * 1024), small = rnd(1234);
  const files = [new File([big], 'photo.jpg', { type: 'image/jpeg' }), new File([small], 'note.txt'), new File([], 'empty.bin')];
  proxy.cutAfter(5 * 1024 * 1024);
  const done1 = waitFor('transfer', (t) => t.status === 'done' || t.status === 'partial', 60000, 'transfer 1');
  await engine.send(client.id, files);
  const t1 = await done1;
  ok(t1.status === 'done', `transfer finished (${t1.status})`);
  ok(proxy.cuts === 1, 'connection was cut mid-transfer and the engine recovered');
  ok(same(sink.files.get('photo.jpg') ?? [], big), 'photo.jpg byte-identical');
  ok(same(sink.files.get('note.txt') ?? [], small), 'note.txt byte-identical');
  ok(sink.files.get('empty.bin')?.length === 0, 'empty.bin saved');

  section('hub restart mid-transfer (hub forgets partial state)');
  const big2 = rnd(10 * 1024 * 1024);
  let restarted = false;
  const onProgress = async (e) => {
    if (restarted || e.detail.sent < 4 * 1024 * 1024) return;
    restarted = true;
    hub.server.close();
    hub.api.dispose?.();
    hub = await startHub();
    proxy.retarget(hub.port);
    proxy.cutAfter(0); // drop the phone's open keep-alive connections to the old hub
  };
  engine.addEventListener('transfer', onProgress);
  const done2 = waitFor('transfer', (t) => t.names?.includes('video.mp4') && (t.status === 'done' || t.status === 'partial'), 90000, 'transfer 2');
  await engine.send(client.id, [new File([big2], 'video.mp4', { type: 'video/mp4' })]);
  const t2 = await done2;
  engine.removeEventListener('transfer', onProgress);
  ok(restarted, 'hub was restarted during the transfer');
  ok(t2.status === 'done', `transfer finished after restart (${t2.status})`);
  const saved = [...sink.files.entries()].find(([n, b]) => n.startsWith('video') && b.length === big2.length);
  ok(saved && same(saved[1], big2), `video saved byte-identical (${saved?.[0]})`);

  section('hub → phone delivery (auto-download)');
  const back = rnd(6 * 1024 * 1024);
  const gotFile = waitFor('file', (f) => f.file?.name === 'from-pc.bin', 60000, 'incoming file');
  const devId = hub.api.listDevices()[0]?.deviceId ?? hub.api.listDevices()[0]?.id ?? engine.deviceId;
  await hub.api.sendToDevice(devId, [new File([back], 'from-pc.bin')]);
  const got = await gotFile;
  ok(same(new Uint8Array(await got.file.arrayBuffer()), back), 'phone received from-pc.bin byte-identical');
  await new Promise((r) => setTimeout(r, 500));
  ok(hub.api.outboxFor(devId).length === 0, 'hub outbox emptied after delivery');

  section('forget');
  await engine.forget(client.id);
  ok(engine.hubs.length === 0, 'phone dropped the hub');
  await new Promise((r) => setTimeout(r, 300));
  ok(hub.api.listDevices().length === 0, 'hub dropped the phone (unpair)');
} catch (err) {
  failures++;
  console.error('FAIL', err);
} finally {
  engine.stop();
  hub.server.close();
  hub.api.dispose?.();
  proxy.close();
  fs.rmSync(BUNDLE, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} failure(s)` : '\nall passed');
process.exit(failures ? 1 : 0);
