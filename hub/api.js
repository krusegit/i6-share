// i6-share Hub protocol logic (server side of docs/PROTOCOL.md). DOM-free: storage and the
// file sink are injected, so this runs under Node for tests.
//
//   const api = new HubApi({ storage: {kv, devices, queue}, sink, getAddrs });
//   await api.init();
//   startServer({ port: PORT, handler: (req) => api.handle(req) });
//
// storage.*: { get(key), put(key, value), delete(key), all() } (same shape as lib/store.js)
// sink:      { exists(name) → Promise<bool>,
//              create(name, {type, size, lastModified}) → Promise<{name, where, write(u8), close(), abort()}> }
//
// Events (CustomEvent, data in .detail):
//   device-paired {device}            device-seen {device}           device-unpaired {deviceId, name, reason}
//   device-updated {device}           pair-code-used {deviceId, name}
//   transfer-start {transfer}         transfer-progress {transfer}   file-saved {tid, deviceId, deviceName, name, originalName, size, type, where, at}
//   transfer-complete {transfer}      transfer-cancelled {transfer, reason: 'cancel'|'expired'|'unpaired'}
//   outbox-added {item}               outbox-progress {item}         outbox-delivered {item}   outbox-removed {item}
//   sink-error {error, name}          error {error}
// `transfer` / `item` are the summaries returned by transfersFor() / outboxFor().

import {
  PORT, PROTOCOL_VERSION, CHUNK_SIZE, SYNC_WAIT_MS, PAIR_TOKEN_TTL_MS, APP_URL,
  randomBytes, randomId, b64url, unb64url, pairKey, deviceKey, seal, open,
  requestAad, responseAad, encodePairPayload, pairLink, cleanFileName,
} from './lib/proto.js';

export const ONLINE_MS = 40_000;
export const PARTIAL_TTL_MS = 60 * 60 * 1000;
const MAX_TOKENS = 5;
const MAX_FILES = 10_000;
const LOG_KEY = 'transferLog';          // kv: which files of recent incoming tids are saved
const LOG_MAX = 300;
const LOG_TTL_MS = 7 * 24 * 3600 * 1000;
const SEEN_PERSIST_MS = 60_000;

const HEX16 = /^[0-9a-f]{16}$/;
const TID_RE = /^[0-9a-f]{24}$/;
const OPS = new Set(['sync', 'offer', 'put', 'end', 'cancel', 'pull', 'pulled', 'unpair']);

class ApiError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
const bad = () => new ApiError(400, 'bad-request');

const json = (status, obj) => ({ status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });
const fail = (status, code) => json(status, { error: code });

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const isIndex = (v) => Number.isSafeInteger(v) && v >= 0;
const cleanText = (s, max) => String(s ?? '').replace(/[\0-\x1f\x7f]/g, ' ').trim().slice(0, max);
const tidOf = (j) => { if (typeof j.tid !== 'string' || !TID_RE.test(j.tid)) throw bad(); return j.tid; };

function fileMeta(f) {
  if (!isObj(f)) return null;
  const size = f.size;
  if (!Number.isSafeInteger(size) || size < 0) return null;
  if (f.name != null && typeof f.name !== 'string') return null;
  return {
    name: cleanText(f.name, 1000) || 'file',
    size,
    type: typeof f.type === 'string' ? f.type.slice(0, 200) : '',
    lastModified: Number.isFinite(f.lastModified) ? f.lastModified : 0,
  };
}

const ROOT_PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>i6-share Hub</title><body style="font:16px system-ui,sans-serif;margin:2em">
<h1>i6-share Hub</h1><p>This computer receives files with i6-share.</p>
<p>On your phone, open <a href="${APP_URL}">${APP_URL}</a>, install it and scan the pairing QR code shown in the hub window.</p>`;

export class HubApi extends EventTarget {
  constructor({ storage, sink, getAddrs = () => [], port = PORT, now = () => Date.now(), partialTtlMs = PARTIAL_TTL_MS, sweepIntervalMs = 5 * 60 * 1000 } = {}) {
    super();
    if (!storage?.kv || !storage?.devices || !storage?.queue) throw new TypeError('storage {kv, devices, queue} required');
    if (!sink) throw new TypeError('sink required');
    this.kv = storage.kv;
    this.store = storage.devices;
    this.queue = storage.queue;
    this.sink = sink;
    this.getAddrs = getAddrs;
    this.port = port;
    this.now = now;
    this.partialTtlMs = partialTtlMs;
    this.sweepIntervalMs = sweepIntervalMs;

    this.hubId = null;
    this.name = 'Linux PC';
    this.devices = new Map();   // deviceId → record {deviceId, name, os, secret(b64url), pairedAt, lastSeen, lastAddr}
    this.keys = new Map();      // deviceId → Promise<CryptoKey>
    this.tokens = [];           // {token, expiresAt, key, usedBy}
    this.transfers = new Map(); // `${deviceId}:${tid}` → incoming transfer
    this.outbox = new Map();    // tid → {tid, deviceId, files: File[], createdAt}
    this.outState = new Map();  // tid → {sent, speed, rateT, rateB}
    this.waiters = new Map();   // deviceId → Set<() => void>
    this.reserved = new Set();  // file names chosen but not yet finalised
    this.log = [];
    this.seenPersisted = new Map();
  }

  // ------------------------------------------------------------ lifecycle

  async init() {
    const id = await this.kv.get('hubId');
    if (typeof id === 'string' && HEX16.test(id)) this.hubId = id;
    else { this.hubId = randomId(8); await this.kv.put('hubId', this.hubId); }
    const name = await this.kv.get('hubName');
    if (typeof name === 'string' && name.trim()) this.name = cleanText(name, 40);
    for (const d of (await this.store.all()) || []) {
      if (isObj(d) && HEX16.test(d.deviceId) && typeof d.secret === 'string') this.devices.set(d.deviceId, d);
    }
    for (const q of (await this.queue.all()) || []) {
      if (!isObj(q) || typeof q.tid !== 'string') continue;
      if (this.devices.has(q.deviceId) && Array.isArray(q.files) && q.files.length) this.outbox.set(q.tid, q);
      else await this.queue.delete(q.tid).catch(() => {});
    }
    const log = await this.kv.get(LOG_KEY);
    this.log = Array.isArray(log) ? log.filter((r) => isObj(r) && typeof r.key === 'string' && Array.isArray(r.saved)) : [];
    if (this.sweepIntervalMs > 0) {
      this.sweepTimer = setInterval(() => this.sweep(), this.sweepIntervalMs);
      this.sweepTimer.unref?.();
    }
    return this;
  }

  dispose() {
    clearInterval(this.sweepTimer);
    for (const set of this.waiters.values()) for (const w of set) w();
  }

  async setName(name) {
    const n = cleanText(name, 40) || 'Linux PC';
    this.name = n;
    await this.kv.put('hubName', n);
    return n;
  }

  hello() {
    return { app: 'i6-share-hub', v: PROTOCOL_VERSION, id: this.hubId, name: this.name, port: this.port, addrs: this.addrs() };
  }

  addrs() {
    try { return [...new Set((this.getAddrs() || []).filter((a) => typeof a === 'string'))]; } catch { return []; }
  }

  // ------------------------------------------------------------ pairing codes

  /** A fresh one-time pairing code. Older codes stay valid until they expire (max MAX_TOKENS). */
  newPairCode() {
    if (!this.hubId) throw new Error('init() first');
    const now = this.now();
    const token = randomBytes(16);
    const expiresAt = now + PAIR_TOKEN_TTL_MS;
    this.tokens = this.tokens.filter((t) => t.expiresAt > now);
    this.tokens.push({ token, expiresAt, key: null, usedBy: null });
    if (this.tokens.length > MAX_TOKENS) this.tokens.splice(0, this.tokens.length - MAX_TOKENS);
    const payload = encodePairPayload({ hubId: this.hubId, token, port: this.port, addrs: this.addrs(), name: this.name });
    return { payload, link: pairLink(payload), expiresAt };
  }

  // ------------------------------------------------------------ queries for the UI

  listDevices() {
    const now = this.now();
    return [...this.devices.values()]
      .map((d) => ({ ...d, secret: undefined, online: now - (d.lastSeen || 0) < ONLINE_MS }))
      .sort((a, b) => (a.pairedAt || 0) - (b.pairedAt || 0));
  }

  isOnline(deviceId) {
    const d = this.devices.get(deviceId);
    return !!d && this.now() - (d.lastSeen || 0) < ONLINE_MS;
  }

  /** Incoming transfers in memory (partial and recently completed). */
  transfersFor(deviceId) {
    return [...this.transfers.values()].filter((t) => !deviceId || t.deviceId === deviceId).map((t) => this._summary(t));
  }

  /** Pending hub → phone items. */
  outboxFor(deviceId) {
    return [...this.outbox.values()].filter((q) => !deviceId || q.deviceId === deviceId).map((q) => this._outSummary(q));
  }

  _summary(t) {
    const total = t.files.reduce((n, f) => n + f.size, 0);
    const bytes = t.files.reduce((n, f) => n + f.bytes, 0);
    return {
      tid: t.tid, deviceId: t.deviceId, deviceName: this.devices.get(t.deviceId)?.name || t.deviceName,
      files: t.files.map((f) => ({ name: f.saveName, originalName: f.name, size: f.size, type: f.type, bytes: f.bytes, done: f.done, where: f.where })),
      count: t.files.length, done: t.files.filter((f) => f.done).length, bytes, total,
      complete: t.complete, speed: t.speed || 0, createdAt: t.createdAt, lastActivity: t.lastActivity,
    };
  }

  _outSummary(q) {
    const s = this.outState.get(q.tid) || {};
    const total = q.files.reduce((n, f) => n + (f.size || 0), 0);
    return {
      tid: q.tid, deviceId: q.deviceId, createdAt: q.createdAt,
      files: q.files.map((f) => this._outMeta(f)), count: q.files.length,
      bytes: Math.min(total, s.sent || 0), total, speed: s.speed || 0, started: !!s.rateT,
    };
  }

  _outMeta(f) {
    return { name: String(f.name || 'file'), size: f.size || 0, type: f.type || '', lastModified: f.lastModified || 0 };
  }

  // ------------------------------------------------------------ hub → phone

  /** Queues files for a paired device. Returns the tid. */
  async sendToDevice(deviceId, files) {
    if (!this.devices.has(deviceId)) throw new Error('Unknown device');
    const list = [...(files || [])].filter((f) => f && typeof f.size === 'number' && typeof f.slice === 'function');
    if (!list.length) throw new Error('No files');
    const item = { tid: randomId(12), deviceId, files: list, createdAt: this.now() };
    try { await this.queue.put(item.tid, item); } catch (e) {
      this._emit('error', { error: e, message: 'Could not persist the outgoing files; they will be sent while the hub stays open.' });
    }
    this.outbox.set(item.tid, item);
    this._emit('outbox-added', { item: this._outSummary(item) });
    this._wake(deviceId);
    return item.tid;
  }

  /** Removes a pending outgoing item (UI "cancel"). */
  async cancelOutbox(tid) {
    const q = this.outbox.get(tid);
    if (!q) return false;
    this.outbox.delete(tid);
    this.outState.delete(tid);
    await this.queue.delete(tid).catch(() => {});
    this._emit('outbox-removed', { item: this._outSummary(q) });
    return true;
  }

  // ------------------------------------------------------------ devices

  async forgetDevice(deviceId, reason = 'forgotten') {
    const d = this.devices.get(deviceId);
    if (!d) return false;
    this.devices.delete(deviceId);
    this.keys.delete(deviceId);
    this.seenPersisted.delete(deviceId);
    await this.store.delete(deviceId).catch(() => {});
    for (const t of [...this.transfers.values()]) if (t.deviceId === deviceId) await this._discard(t, 'unpaired');
    for (const q of [...this.outbox.values()]) {
      if (q.deviceId !== deviceId) continue;
      this.outbox.delete(q.tid);
      this.outState.delete(q.tid);
      await this.queue.delete(q.tid).catch(() => {});
    }
    this._wake(deviceId);
    this._emit('device-unpaired', { deviceId, name: d.name, reason });
    return true;
  }

  _key(d) {
    let k = this.keys.get(d.deviceId);
    if (!k) {
      k = deviceKey(unb64url(d.secret), d.deviceId);
      this.keys.set(d.deviceId, k);
      k.catch(() => this.keys.delete(d.deviceId));
    }
    return k;
  }

  _touch(d, req) {
    const now = this.now();
    d.lastSeen = now;
    if (req.remoteAddress) d.lastAddr = req.remoteAddress;
    if (now - (this.seenPersisted.get(d.deviceId) || 0) > SEEN_PERSIST_MS) this._persistDevice(d);
    this._emit('device-seen', { device: { ...d, secret: undefined, online: true } });
  }

  _persistDevice(d) {
    this.seenPersisted.set(d.deviceId, this.now());
    return this.store.put(d.deviceId, d).catch((e) => this._emit('error', { error: e }));
  }

  // ------------------------------------------------------------ HTTP entry point

  async handle(req) {
    try {
      const { method, path } = req;
      if (method === 'GET' && (path === '/' || path === '/index.html')) {
        return { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: ROOT_PAGE };
      }
      if ((method === 'GET' || method === 'POST') && path === '/i6/hello') return json(200, this.hello());
      const m = /^\/i6\/([a-z]{1,16})$/.exec(path || '');
      if (!m || method !== 'POST') return fail(404, 'not-found');
      const op = m[1];
      const query = req.query instanceof URLSearchParams ? req.query : new URLSearchParams(req.query || '');
      const body = req.body instanceof Uint8Array ? req.body : new Uint8Array(0);
      if (op === 'pair') return await this._pair(query.get('h'), body, req);
      if (!OPS.has(op)) return fail(404, 'not-found');

      const deviceId = query.get('d') || '';
      if (!HEX16.test(deviceId)) return fail(400, 'bad-request');
      const dev = this.devices.get(deviceId);
      if (!dev) return fail(401, 'unknown-device');
      let key, msg;
      try {
        key = await this._key(dev);
        msg = await open(key, requestAad(op, deviceId), body);
      } catch { return fail(401, 'bad-auth'); }
      if (!isObj(msg.json)) return fail(400, 'bad-request');
      if (!this.devices.has(deviceId)) return fail(401, 'unknown-device');
      this._touch(dev, req);

      let out;
      try {
        out = await this[`_${op}`](dev, msg.json, msg.binary, req);
      } catch (e) {
        if (e instanceof ApiError) return fail(e.status, e.code);
        throw e;
      }
      if (out.status) return out; // plain error response
      const res = await seal(key, responseAad(op, msg.iv), out.json, out.binary);
      return { status: 200, headers: { 'Content-Type': 'application/octet-stream' }, body: res.body };
    } catch (e) {
      this._emit('error', { error: e });
      return fail(500, 'internal');
    }
  }

  // ------------------------------------------------------------ ops

  async _pair(h, body, req) {
    if (h !== this.hubId) return fail(401, 'bad-auth');
    if (body.length > 64 * 1024) return fail(413, 'too-large');
    const now = this.now();
    for (const tok of [...this.tokens].reverse()) {
      if (tok.expiresAt <= now) continue;
      let msg;
      try {
        tok.key ??= pairKey(tok.token, this.hubId);
        msg = await open(await tok.key, requestAad('pair', 'pair'), body);
      } catch { continue; }
      const j = msg.json;
      if (!isObj(j) || typeof j.deviceId !== 'string' || !HEX16.test(j.deviceId)) return fail(400, 'bad-request');
      if (tok.usedBy && tok.usedBy !== j.deviceId) return fail(401, 'bad-auth');
      let dev = this.devices.get(j.deviceId);
      if (!(tok.usedBy === j.deviceId && dev)) {
        // first use of this token: new secret (re-pairing an existing device replaces it)
        tok.usedBy = j.deviceId;
        dev = {
          deviceId: j.deviceId,
          name: cleanText(j.name, 60) || 'Phone',
          os: cleanText(j.os, 40),
          secret: b64url(randomBytes(32)),
          pairedAt: now,
          lastSeen: now,
          lastAddr: req.remoteAddress || '',
        };
        this.devices.set(dev.deviceId, dev);
        this.keys.delete(dev.deviceId);
        await this._persistDevice(dev);
        this._emit('device-paired', { device: { ...dev, secret: undefined, online: true } });
        this._emit('pair-code-used', { deviceId: dev.deviceId, name: dev.name });
      }
      const res = await seal(await tok.key, responseAad('pair', msg.iv), { secret: dev.secret, hubId: this.hubId, name: this.name });
      return { status: 200, headers: { 'Content-Type': 'application/octet-stream' }, body: res.body };
    }
    return fail(401, 'bad-auth');
  }

  async _sync(dev, j) {
    let changed = false;
    if (typeof j.name === 'string') {
      const n = cleanText(j.name, 60);
      if (n && n !== dev.name) { dev.name = n; changed = true; }
    }
    if (typeof j.os === 'string') {
      const os = cleanText(j.os, 40);
      if (os !== dev.os) { dev.os = os; changed = true; }
    }
    if (changed) {
      this._persistDevice(dev);
      this._emit('device-updated', { device: { ...dev, secret: undefined, online: true } });
    }
    const wait = Number.isFinite(j.wait) ? Math.max(0, Math.min(SYNC_WAIT_MS, Math.floor(j.wait))) : 0;
    if (wait > 0 && !this._hasOutbox(dev.deviceId)) await this._waitFor(dev.deviceId, wait);
    if (!this.devices.has(dev.deviceId)) return fail(401, 'unknown-device');
    dev.lastSeen = this.now();
    return {
      json: {
        name: this.name,
        addrs: this.addrs(),
        outbox: [...this.outbox.values()].filter((q) => q.deviceId === dev.deviceId)
          .map((q) => ({ tid: q.tid, files: q.files.map((f) => this._outMeta(f)) })),
      },
    };
  }

  async _offer(dev, j) {
    const tid = tidOf(j);
    if (!Array.isArray(j.files) || !j.files.length || j.files.length > MAX_FILES) throw bad();
    const metas = j.files.map(fileMeta);
    if (metas.some((m) => !m)) throw bad();
    const key = `${dev.deviceId}:${tid}`;
    let t = this.transfers.get(key);
    if (t) {
      await t.ready;
      if (t.files.length !== metas.length || t.files.some((f, i) => f.size !== metas[i].size)) throw bad();
      t.lastActivity = this.now();
      return { json: { received: t.files.map((f) => f.bytes) } };
    }

    const now = this.now();
    const rec = this.log.find((r) => r.key === key);
    const prior = rec && rec.sizes?.length === metas.length && rec.sizes.every((s, i) => s === metas[i].size) ? rec : null;
    t = {
      key, tid, deviceId: dev.deviceId, deviceName: dev.name, createdAt: now, lastActivity: now,
      complete: false, cancelled: false, speed: 0, rateT: now, rateB: 0,
      files: metas.map((m, i) => {
        const saved = !!prior?.saved[i];
        return { ...m, saveName: saved ? prior.names[i] : null, bytes: saved ? m.size : 0, done: saved, handle: null, lock: Promise.resolve(), where: saved ? prior.where?.[i] : null };
      }),
    };
    t.rateB = t.files.reduce((n, f) => n + f.bytes, 0);
    this.transfers.set(key, t);
    if (t.files.every((f) => f.done)) {
      // everything was already saved before (hub restarted or transfer expired from memory)
      t.complete = true;
      t.ready = Promise.resolve();
      return { json: { received: t.files.map((f) => f.bytes) } };
    }
    t.ready = (async () => {
      for (const f of t.files) if (!f.done) f.saveName = await this._uniqueName(cleanFileName(f.name));
    })();
    try { await t.ready; } catch (e) {
      this.transfers.delete(key);
      for (const f of t.files) if (!f.done && f.saveName) this.reserved.delete(f.saveName);
      throw e;
    }
    this._emit('transfer-start', { transfer: this._summary(t) });
    for (const f of t.files) {
      if (!f.done && f.size === 0) await this._serial(f, () => this._finalize(t, f));
    }
    this._checkComplete(t);
    return { json: { received: t.files.map((f) => f.bytes) } };
  }

  async _put(dev, j, bin) {
    const tid = tidOf(j);
    if (!isIndex(j.i) || !isIndex(j.offset)) throw bad();
    if (bin.length > CHUNK_SIZE) throw new ApiError(413, 'too-large');
    const t = this.transfers.get(`${dev.deviceId}:${tid}`);
    if (!t || t.cancelled) throw new ApiError(404, 'not-found');
    await t.ready;
    const f = t.files[j.i];
    if (!f) throw bad();
    return this._serial(f, async () => {
      if (t.cancelled) throw new ApiError(404, 'not-found');
      if (j.offset !== f.bytes) return { json: { error: 'offset', bytes: f.bytes } };
      if (f.done || bin.length === 0) return { json: { bytes: f.bytes } };
      if (f.bytes + bin.length > f.size) throw bad();
      t.lastActivity = this.now();
      try {
        f.handle ??= await this.sink.create(f.saveName, { type: f.type, size: f.size, lastModified: f.lastModified });
        f.where = f.handle.where || null;
        await f.handle.write(bin);
      } catch (e) {
        await this._resetFile(f, e);
        throw new ApiError(500, 'internal');
      }
      f.bytes += bin.length;
      if (f.bytes === f.size) await this._finalize(t, f);
      this._progress(t);
      this._checkComplete(t);
      return { json: { bytes: f.bytes } };
    });
  }

  async _end(dev, j) {
    const tid = tidOf(j);
    const key = `${dev.deviceId}:${tid}`;
    const t = this.transfers.get(key);
    if (t) {
      await t.ready;
      t.lastActivity = this.now();
      return { json: { ok: t.files.every((f) => f.done) } };
    }
    const rec = this.log.find((r) => r.key === key);
    if (rec) return { json: { ok: rec.saved.every(Boolean) } };
    throw new ApiError(404, 'not-found');
  }

  async _cancel(dev, j) {
    const tid = tidOf(j);
    const key = `${dev.deviceId}:${tid}`;
    const t = this.transfers.get(key);
    if (t) await this._discard(t, 'cancel');
    return { json: { ok: true } };
  }

  async _pull(dev, j) {
    const tid = tidOf(j);
    if (!isIndex(j.i) || !isIndex(j.offset) || !isIndex(j.length) || j.length > CHUNK_SIZE) throw bad();
    const q = this.outbox.get(tid);
    if (!q || q.deviceId !== dev.deviceId) throw new ApiError(404, 'not-found');
    const file = q.files[j.i];
    if (!file) throw bad();
    if (j.offset > file.size) throw bad();
    const bytes = new Uint8Array(await file.slice(j.offset, Math.min(file.size, j.offset + j.length)).arrayBuffer());
    // overall progress = everything before file i + this chunk's end
    const before = q.files.slice(0, j.i).reduce((n, f) => n + (f.size || 0), 0);
    const now = this.now();
    let s = this.outState.get(tid);
    if (!s) { s = { sent: 0, speed: 0, rateT: now, rateB: before + j.offset }; this.outState.set(tid, s); }
    s.sent = before + j.offset + bytes.length;
    const dt = now - s.rateT;
    if (dt >= 500) {
      const inst = Math.max(0, s.sent - s.rateB) * 1000 / dt;
      s.speed = s.speed ? s.speed * 0.6 + inst * 0.4 : inst;
      s.rateT = now;
      s.rateB = s.sent;
    }
    this._emit('outbox-progress', { item: this._outSummary(q) });
    return { json: { size: file.size }, binary: bytes };
  }

  async _pulled(dev, j) {
    const tid = tidOf(j);
    const q = this.outbox.get(tid);
    if (q && q.deviceId === dev.deviceId) {
      const s = this.outState.get(tid);
      if (s) s.sent = q.files.reduce((n, f) => n + (f.size || 0), 0);
      const summary = this._outSummary(q);
      this.outbox.delete(tid);
      this.outState.delete(tid);
      await this.queue.delete(tid).catch(() => {});
      this._emit('outbox-delivered', { item: summary });
    }
    return { json: { ok: true } };
  }

  async _unpair(dev) {
    await this.forgetDevice(dev.deviceId, 'unpaired');
    return { json: { ok: true } };
  }

  // ------------------------------------------------------------ incoming file helpers

  /** Runs fn after every earlier operation on the same file (puts can arrive concurrently on retries). */
  _serial(f, fn) {
    const p = f.lock.then(fn);
    f.lock = p.catch(() => {});
    return p;
  }

  async _uniqueName(name) {
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    for (let n = 0; n < 1000; n++) {
      const c = n ? `${base} (${n})${ext}` : name;
      if (this.reserved.has(c)) continue;
      let exists = false;
      try { exists = await this.sink.exists(c); } catch { exists = false; }
      if (exists || this.reserved.has(c)) continue;
      this.reserved.add(c);
      return c;
    }
    const c = `${base} (${randomId(4)})${ext}`;
    this.reserved.add(c);
    return c;
  }

  async _resetFile(f, error) {
    const h = f.handle;
    f.handle = null;
    f.bytes = 0;
    f.done = false;
    if (h) { try { await h.abort(); } catch { /* ignore */ } }
    this._emit('sink-error', { error, name: f.saveName });
  }

  async _finalize(t, f) {
    try {
      f.handle ??= await this.sink.create(f.saveName, { type: f.type, size: f.size, lastModified: f.lastModified });
      f.where = f.handle.where || null;
      await f.handle.close();
    } catch (e) {
      await this._resetFile(f, e);
      throw new ApiError(500, 'internal');
    }
    f.handle = null;
    f.done = true;
    this.reserved.delete(f.saveName);
    this._logSaved(t);
    this._emit('file-saved', {
      tid: t.tid, deviceId: t.deviceId, deviceName: this.devices.get(t.deviceId)?.name || t.deviceName,
      name: f.saveName, originalName: f.name, size: f.size, type: f.type, where: f.where, at: this.now(),
    });
  }

  _checkComplete(t) {
    if (t.complete || !t.files.every((f) => f.done)) return;
    t.complete = true;
    this._emit('transfer-complete', { transfer: this._summary(t) });
  }

  _progress(t) {
    const now = this.now();
    const bytes = t.files.reduce((n, f) => n + f.bytes, 0);
    const dt = now - t.rateT;
    if (dt >= 500) {
      const inst = Math.max(0, bytes - t.rateB) * 1000 / dt;
      t.speed = t.speed ? t.speed * 0.6 + inst * 0.4 : inst;
      t.rateT = now;
      t.rateB = bytes;
    }
    this._emit('transfer-progress', { transfer: this._summary(t) });
  }

  async _discard(t, reason) {
    if (t.cancelled) return;
    t.cancelled = true;
    this.transfers.delete(t.key);
    for (const f of t.files) {
      await this._serial(f, async () => {
        if (f.done) return;
        const h = f.handle;
        f.handle = null;
        if (h) { try { await h.abort(); } catch { /* ignore */ } }
        if (f.saveName) this.reserved.delete(f.saveName);
      }).catch(() => {});
    }
    if (!t.complete) this._emit('transfer-cancelled', { transfer: this._summary(t), reason });
  }

  _logSaved(t) {
    const now = this.now();
    let rec = this.log.find((r) => r.key === t.key);
    if (!rec) { rec = { key: t.key, at: now }; this.log.push(rec); }
    rec.at = now;
    rec.sizes = t.files.map((f) => f.size);
    rec.names = t.files.map((f) => f.saveName);
    rec.saved = t.files.map((f) => f.done);
    rec.where = t.files.map((f) => f.where);
    this.log = this.log.filter((r) => now - r.at < LOG_TTL_MS).slice(-LOG_MAX);
    this.kv.put(LOG_KEY, this.log).catch((e) => this._emit('error', { error: e }));
  }

  /** Drops transfers idle for longer than partialTtlMs (aborting partial files) and stale tokens. */
  async sweep() {
    const now = this.now();
    this.tokens = this.tokens.filter((t) => t.expiresAt > now);
    for (const t of [...this.transfers.values()]) {
      if (now - t.lastActivity <= this.partialTtlMs) continue;
      if (t.complete) this.transfers.delete(t.key);
      else await this._discard(t, 'expired');
    }
  }

  // ------------------------------------------------------------ outbox wake-ups

  _hasOutbox(deviceId) {
    for (const q of this.outbox.values()) if (q.deviceId === deviceId) return true;
    return false;
  }

  _waitFor(deviceId, ms) {
    return new Promise((resolve) => {
      let set = this.waiters.get(deviceId);
      if (!set) { set = new Set(); this.waiters.set(deviceId, set); }
      const done = () => {
        clearTimeout(timer);
        set.delete(done);
        if (!set.size && this.waiters.get(deviceId) === set) this.waiters.delete(deviceId);
        resolve();
      };
      const timer = setTimeout(done, ms);
      set.add(done);
    });
  }

  _wake(deviceId) {
    for (const w of [...(this.waiters.get(deviceId) || [])]) w();
  }

  _emit(type, detail) {
    try { this.dispatchEvent(new CustomEvent(type, { detail })); } catch { /* listeners must not break the server */ }
  }
}
