// i6-share phone-side networking/transfer engine.
//
// NO DOM ACCESS in this file: it runs in the PWA page and in Node (>= 22:
// global fetch, WebCrypto, Blob/File, EventTarget/CustomEvent, AbortSignal.any)
// so it can be tested end to end against a hub. See docs/PROTOCOL.md.
//
// ---------------------------------------------------------------- API
//
//   const engine = new ShareEngine({ kv, hubs, queue, fetch? })
//       kv / hubs / queue: storage objects with async get(key), put(key, value),
//       delete(key), all() -> values[]   (lib/store.js `store(name)`, or
//       `memoryStore()` exported below for tests). `fetch` defaults to the
//       global fetch.
//
//   await engine.init({ visible = true, name?, os? })
//       Loads/creates identity (kv: deviceId, deviceName, os), paired hubs and
//       persisted outgoing transfers, then starts every hub (sync loop + resume
//       of queued transfers). `name`/`os` override the defaults when no name is
//       stored yet.
//
//   engine.deviceId / engine.deviceName / engine.os        (strings)
//   engine.hubs                -> HubClient[]   (.id .name .status .lastSeen .addr .rec)
//   engine.hub(hubId)          -> HubClient | undefined
//   engine.transfers           -> TransferSnapshot[] (outgoing; active + finished this session)
//   engine.visible             (boolean)
//   await engine.setDeviceName(name)
//   await engine.pair(textOrPayload, { signal?, onStatus? }) -> HubClient
//       textOrPayload: link / "#pair=…" / bare code (string) or a decoded payload object.
//       Retries until it reaches the hub or `signal` aborts. onStatus('searching'|'pairing'|'blocked').
//       Throws PairError (code 'expired' | 'rejected' | 'bad-response') or AbortedError.
//   await engine.send(hubId, files: (File|Blob)[]) -> tid
//   await engine.cancel(tid)
//   await engine.forget(hubId)          best-effort `unpair`, then drops the record + its transfers
//   engine.setVisible(bool)             pauses/resumes long-polling (true also kicks)
//   engine.kick()                       reset backoffs, retry now (call on 'online' / visible)
//   engine.stop()                       stops everything (tests)
//
// Events (CustomEvent, data in `event.detail`), all dispatched on the engine:
//   'hubs'      {}                                   hub list / names changed
//   'status'    {hubId, status, lastSeen}            status: 'searching' | 'online' | 'offline'
//   'transfer'  TransferSnapshot                     outgoing progress / state change
//                 {tid, hubId, names, total, sent, rate, status, failed:[i], error, createdAt, doneAt}
//                 status: 'queued' | 'sending' | 'done' | 'partial' (some files unreadable)
//                         | 'cancelled'
//   'incoming'  {tid, hubId, names, total, received, status: 'receiving'|'done'}
//   'file'      {hubId, hubName, tid, index, file: File}   a received file, fully assembled
//   'unpaired'  {hubId, name, reason, files: File[]}  hub forgot us (verified); the files of
//                                                   its pending transfers are handed back
//   'network'   {blocked: boolean}                   every address failed instantly with a
//                                                   TypeError (Local Network Access denied?)
//   'busy'      {busy: boolean}                      any upload/download running (wake lock)
//
// Lower-level exports: pairWithHub(), locateHub(), hello(), sweepCandidates(),
// HubClient, memoryStore(), guessDevice(), error classes, APP_VERSION.

import {
  PORT, CHUNK_SIZE, SYNC_WAIT_MS, Backoff, sleep, seal, open, pairKey, deviceKey,
  requestAad, responseAad, baseUrl, unb64url, randomId, ipToBytes, isPrivateIp,
  pairPayloadFromText, cleanFileName,
} from './lib/proto.js';

export const APP_VERSION = '1.0.2';

const HELLO_TIMEOUT = 4000;         // direct liveness check
const SWEEP_TIMEOUT = 1500;         // per address while sweeping a /24
const SWEEP_CONCURRENCY = 32;
const SWEEP_MIN_INTERVAL = 60000;   // don't sweep more often than this per hub
const REQ_TIMEOUT = 15000;
const DATA_TIMEOUT = 60000;         // put / pull
const FAST_FAIL_MS = 500;           // "instant" TypeError => probably blocked by the browser
const SAVE_LASTSEEN_MS = 60000;

// ---------------------------------------------------------------- errors

export class NetError extends Error {
  constructor(message, cause, fast = false) { super(message, { cause }); this.name = 'NetError'; this.fast = fast; }
}
export class HttpError extends Error {
  constructor(status, code) { super(`HTTP ${status}${code ? ` ${code}` : ''}`); this.name = 'HttpError'; this.status = status; this.code = code; }
}
export class UnpairedError extends Error {
  constructor(code) { super(`unpaired (${code || 'unknown-device'})`); this.name = 'UnpairedError'; this.code = code; }
}
export class AbortedError extends Error {
  constructor() { super('aborted'); this.name = 'AbortedError'; }
}
export class PairError extends Error {
  constructor(code, message) { super(message); this.name = 'PairError'; this.code = code; }
}

// ---------------------------------------------------------------- helpers

const unique = (list) => [...new Set(list.filter(Boolean))];
const sum = (list) => list.reduce((n, x) => n + (x || 0), 0);

function anySignal(...signals) {
  const s = signals.filter(Boolean);
  return s.length === 1 ? s[0] : AbortSignal.any(s);
}

/** Chrome Local Network Access: tell fetch which address space we expect. */
function addressSpace(ip) {
  const b = ipToBytes(ip);
  const loop = b && (b.length === 4 ? b[0] === 127 : b.every((x, i) => x === (i === 15 ? 1 : 0)));
  return loop ? 'loopback' : 'local';
}

const defaultFetch = (...args) => globalThis.fetch(...args);

/** In-memory storage with the lib/store.js API (for tests / fallback). */
export function memoryStore(entries) {
  const map = new Map(entries);
  return {
    map,
    get: async (key) => map.get(key),
    put: async (key, value) => { map.set(key, value); },
    delete: async (key) => { map.delete(key); },
    all: async () => [...map.values()],
  };
}

/** Friendly default device name + os from the user agent. */
export async function guessDevice() {
  const nav = globalThis.navigator || {};
  const uad = nav.userAgentData;
  const ua = nav.userAgent || '';
  const p = `${uad?.platform || ''} ${ua}`;
  const os = /android/i.test(p) ? 'android' : /cros|chrome ?os/i.test(p) ? 'chromeos'
    : /iphone|ipad|ios/i.test(p) ? 'ios' : /win/i.test(p) ? 'windows'
      : /mac/i.test(p) ? 'macos' : /linux/i.test(p) ? 'linux' : 'unknown';
  let model = '';
  try { model = (await uad?.getHighEntropyValues?.(['model']))?.model || ''; } catch { /* not allowed */ }
  if (!model && os === 'android') {
    const m = ua.match(/Android [\d.]+; ([^;)]+)\)/);
    if (m && m[1].trim() !== 'K') model = m[1].trim();   // reduced UA reports "K"
  }
  const fallback = { android: 'Android phone', chromeos: 'Chromebook', ios: 'iPhone', windows: 'Windows PC', macos: 'Mac', linux: 'Linux PC' };
  return { name: (model || fallback[os] || 'Browser').slice(0, 40), os };
}

// ---------------------------------------------------------------- discovery

/** GET /i6/hello on one address. Resolves with the hello JSON or throws NetError. */
export async function hello(addr, port = PORT, { timeout = HELLO_TIMEOUT, signal, fetch = defaultFetch } = {}) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${baseUrl(addr, port)}/i6/hello`, {
      cache: 'no-store', credentials: 'omit', targetAddressSpace: addressSpace(addr),
      signal: anySignal(AbortSignal.timeout(timeout), signal),
    });
    if (!res.ok) throw new HttpError(res.status);
    const j = await res.json();
    if (j?.app !== 'i6-share-hub') throw new Error('not an i6-share hub');
    return j;
  } catch (err) {
    if (signal?.aborted) throw new AbortedError();
    throw new NetError(`hello ${addr}: ${err.message}`, err, err instanceof TypeError && Date.now() - t0 < FAST_FAIL_MS);
  }
}

/** Every other host of the /24 of each private IPv4 in `addrs`, nearest first. */
export function sweepCandidates(addrs, maxNets = 4) {
  const seen = new Set(addrs);
  const nets = new Set();
  const out = [];
  for (const a of addrs) {
    const b = ipToBytes(a);
    // Only real LANs: loopback and link-local (169.254/16) aren't worth a sweep.
    if (!b || b.length !== 4 || !isPrivateIp(a) || b[0] === 127 || (b[0] === 169 && b[1] === 254)) continue;
    const net = `${b[0]}.${b[1]}.${b[2]}`;
    if (nets.has(net) || nets.size >= maxNets) continue;
    nets.add(net);
    const hosts = Array.from({ length: 254 }, (_, i) => i + 1).sort((x, y) => Math.abs(x - b[3]) - Math.abs(y - b[3]));
    for (const x of hosts) {
      const ip = `${net}.${x}`;
      if (!seen.has(ip)) { seen.add(ip); out.push(ip); }
    }
  }
  return out;
}

/**
 * Finds a hub: hello on all known addresses in parallel; if none answers and
 * `sweep` is set, scans the /24s (32 at a time). Matches `hubId` if given.
 * Resolves {addr, hello} or {addr: null, blocked} (blocked = every direct
 * attempt failed instantly with a TypeError).
 */
export async function locateHub({ hubId, port = PORT, addrs = [], lastAddr }, { sweep = false, signal, fetch } = {}) {
  const known = unique([lastAddr, ...addrs]);
  const tryAddr = async (addr, timeout, sig) => {
    const j = await hello(addr, port, { timeout, signal: sig, fetch });
    if (hubId && j.id !== hubId) throw new NetError(`${addr} is a different hub`);
    return { addr, hello: j };
  };
  let fast = 0;
  if (known.length) {
    const ctl = new AbortController();
    try {
      const r = await Promise.any(known.map((a) => tryAddr(a, HELLO_TIMEOUT, anySignal(ctl.signal, signal))
        .catch((err) => { if (err.fast) fast++; throw err; })));
      ctl.abort();
      return r;
    } catch { if (signal?.aborted) throw new AbortedError(); }
  }
  const blocked = known.length > 0 && fast === known.length;
  if (!sweep) return { addr: null, blocked };

  const candidates = sweepCandidates(known);
  const ctl = new AbortController();
  const sig = anySignal(ctl.signal, signal);
  let found = null;
  let next = 0;
  const worker = async () => {
    while (!found && !sig.aborted && next < candidates.length) {
      const addr = candidates[next++];
      try { found ??= await tryAddr(addr, SWEEP_TIMEOUT, sig); ctl.abort(); } catch { /* keep looking */ }
    }
  };
  await Promise.all(Array.from({ length: Math.min(SWEEP_CONCURRENCY, candidates.length) }, worker));
  if (!found && signal?.aborted) throw new AbortedError();
  return found || { addr: null, blocked };
}

// ---------------------------------------------------------------- pairing

async function pairAt(addr, p, { deviceId, name, os, fetch, signal }) {
  const key = await pairKey(p.token, p.hubId);
  const { body, iv } = await seal(key, requestAad('pair', 'pair'), { deviceId, name, os });
  let res; let buf;
  try {
    res = await fetch(`${baseUrl(addr, p.port)}/i6/pair?h=${p.hubId}`, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body,
      cache: 'no-store', credentials: 'omit', targetAddressSpace: addressSpace(addr),
      signal: anySignal(AbortSignal.timeout(REQ_TIMEOUT), signal),
    });
    buf = res.status === 200 ? await res.arrayBuffer() : null;
  } catch (err) {
    if (signal?.aborted) throw new AbortedError();
    throw new NetError(`pair ${addr}: ${err.message}`, err);
  }
  if (!buf) {
    const err = await res.json().catch(() => ({}));
    throw new HttpError(res.status, err.error);
  }
  let json;
  try { ({ json } = await open(key, responseAad('pair', iv), buf)); } catch { json = null; }
  if (!json?.secret || (json.hubId && json.hubId !== p.hubId)) throw new PairError('bad-response', 'The computer sent an invalid pairing response.');
  return json;
}

/**
 * Pairs with the hub described by a QR payload (string or decoded object).
 * Probes the hub's addresses first (so only ONE pair request consumes the
 * one-time token), retrying with backoff until `signal` aborts.
 * Resolves with the hub record to store in `hubs`.
 */
export async function pairWithHub(input, { deviceId, name, os, fetch = defaultFetch, signal, onStatus } = {}) {
  const p = typeof input === 'string' ? pairPayloadFromText(input) : input;
  const backoff = new Backoff(500, 5000);
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw new AbortedError();
    onStatus?.('searching');
    const sweep = attempt === 2 || (attempt > 2 && attempt % 6 === 2);
    const loc = await locateHub({ hubId: p.hubId, port: p.port, addrs: p.addrs }, { sweep, signal, fetch });
    if (loc.addr) {
      onStatus?.('pairing');
      try {
        const json = await pairAt(loc.addr, p, { deviceId, name, os, fetch, signal });
        const now = Date.now();
        return {
          hubId: p.hubId, name: json.name || loc.hello.name || p.name || 'Computer', port: p.port,
          addrs: unique([loc.addr, ...(loc.hello.addrs || []), ...p.addrs]).slice(0, 8), lastAddr: loc.addr,
          secret: json.secret, pairedAt: now, lastSeen: now,
        };
      } catch (err) {
        if (err instanceof HttpError && err.status < 500) {
          throw err.status === 401
            ? new PairError('expired', 'This pairing code has expired or was already used. Show the QR code again on your computer.')
            : new PairError('rejected', `The computer rejected the pairing (${err.code || err.status}).`);
        }
        if (!(err instanceof NetError || err instanceof HttpError)) throw err;
      }
    } else if (loc.blocked) onStatus?.('blocked');
    try { await sleep(backoff.next(), signal); } catch { throw new AbortedError(); }
  }
}

// ---------------------------------------------------------------- one paired hub

export class HubClient {
  constructor(engine, rec) {
    this.engine = engine;
    this.rec = rec;                     // {hubId, name, port, addrs, lastAddr, secret, pairedAt, lastSeen}
    this.status = 'searching';
    this.addr = null;                   // verified working address, null => locate first
    this.fails = 0;                     // consecutive network failures
    this.lastSweep = 0;
    this.syncBackoff = new Backoff(500, 30000);
    this.xferBackoff = new Backoff(500, 30000);
    this.stopped = false;
    this.life = new AbortController();
    this._key = null;
    this._locating = null;
    this._syncing = false;
    this._syncCtl = null;
    this._pumping = false;
    this._savedAt = 0;
  }

  get id() { return this.rec.hubId; }
  get name() { return this.rec.name; }
  get lastSeen() { return this.rec.lastSeen; }

  key() { return (this._key ??= deviceKey(unb64url(this.rec.secret), this.engine.deviceId)); }

  start() {
    this._syncLoop().catch(() => {});
    this.pump();
  }

  stop() {
    this.stopped = true;
    this.life.abort();
  }

  _setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    this.engine._emit('status', { hubId: this.id, status, lastSeen: this.rec.lastSeen });
  }

  _seen() {
    this.fails = 0;
    this.rec.lastSeen = Date.now();
    this._setStatus('online');
    this.engine._network(false);
    if (Date.now() - this._savedAt > SAVE_LASTSEEN_MS) this._save();
  }

  _save() {
    if (this.stopped) return;
    this._savedAt = Date.now();
    this.engine.hubsStore.put(this.id, this.rec).catch(() => {});
  }

  /** Merge addresses / name learnt from hello or sync. */
  _learn(addrs, addr, name) {
    const next = unique([addr, ...(Array.isArray(addrs) ? addrs : []), ...this.rec.addrs]).slice(0, 8);
    let changed = next.join() !== this.rec.addrs.join() || (addr && addr !== this.rec.lastAddr);
    this.rec.addrs = next;
    if (addr) this.rec.lastAddr = addr;
    if (name && name !== this.rec.name) {
      this.rec.name = String(name).slice(0, 60);
      changed = true;
      this.engine._emit('hubs', {});
    }
    if (changed) this._save();
  }

  /** Sleep that a kick() ends early; throws AbortedError if stopped / signal aborted. */
  async _nap(ms, signal) {
    try { await sleep(ms, anySignal(this.engine._wake.signal, this.life.signal, signal)); } catch { /* woken */ }
    if (this.stopped || signal?.aborted) throw new AbortedError();
  }

  _waitWake() {
    return new Promise((resolve) => {
      const s = anySignal(this.engine._wake.signal, this.life.signal);
      if (s.aborted) resolve();
      else s.addEventListener('abort', resolve, { once: true });
    });
  }

  /** Single-flight hub location; resolves with a verified address or throws NetError. */
  locate() {
    return (this._locating ??= this._locate().finally(() => { this._locating = null; }));
  }

  async _locate() {
    this._setStatus('searching');
    const now = Date.now();
    const sweep = this.fails >= 2 && now - this.lastSweep > SWEEP_MIN_INTERVAL;
    if (sweep) this.lastSweep = now;
    const r = await locateHub(this.rec, { sweep, fetch: this.engine._fetch, signal: this.life.signal });
    if (r.addr) {
      this.addr = r.addr;
      this._learn(r.hello.addrs, r.addr, r.hello.name);
      this._seen();
      return r.addr;
    }
    this.fails++;
    this._setStatus('offline');
    if (r.blocked) this.engine._network(true);
    throw new NetError(`${this.name} not reachable`);
  }

  /** One encrypted request to one address. */
  async request(op, json, binary, { addr = this.addr ?? this.rec.lastAddr, timeout = REQ_TIMEOUT, signal } = {}) {
    const e = this.engine;
    const key = await this.key();
    const { body, iv } = await seal(key, requestAad(op, e.deviceId), json, binary);
    let res; let buf;
    try {
      res = await e._fetch(`${baseUrl(addr, this.rec.port)}/i6/${op}?d=${e.deviceId}`, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body,
        cache: 'no-store', credentials: 'omit', targetAddressSpace: addressSpace(addr),
        signal: anySignal(AbortSignal.timeout(timeout), signal, this.life.signal),
      });
      buf = res.status === 200 ? await res.arrayBuffer() : null;
    } catch (err) {
      if (signal?.aborted || this.stopped) throw new AbortedError();
      throw new NetError(`${op} ${addr}: ${err.message}`, err);
    }
    if (buf) {
      try { return await open(key, responseAad(op, iv), buf); } catch (err) { throw new NetError(`${op} ${addr}: undecryptable response`, err); }
    }
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) await this._checkUnpaired(addr, err.error);
    throw new HttpError(res.status, err.error);
  }

  /** A 401 only counts if the hub at that address really is ours (not some other hub after a DHCP shuffle). */
  async _checkUnpaired(addr, code) {
    let j;
    try { j = await hello(addr, this.rec.port, { fetch: this.engine._fetch, signal: this.life.signal }); } catch { throw new NetError('auth failed, hub not verifiable'); }
    if (j.id !== this.id) { this.addr = null; throw new NetError(`another hub answered at ${addr}`); }
    await this.engine._unpaired(this, code);
    throw new UnpairedError(code);
  }

  /** request() on the current address, locating the hub first if needed. */
  async call(op, json, binary, opts = {}) {
    if (this.stopped) throw new AbortedError();
    const addr = this.addr ?? await this.locate();
    try {
      const r = await this.request(op, json, binary, { ...opts, addr });
      this._seen();
      return r;
    } catch (err) {
      if (err instanceof HttpError) this._seen();
      if (err instanceof NetError) {
        if (this.addr === addr) this.addr = null;
        this.fails++;
      }
      throw err;
    }
  }

  /** call() retried forever on network errors / 5xx (backoff + jitter, kick resets). */
  async callRetry(op, json, binary, { backoff = this.xferBackoff, signal, timeout } = {}) {
    for (;;) {
      if (this.stopped || signal?.aborted) throw new AbortedError();
      try {
        const r = await this.call(op, json, binary, { timeout, signal });
        backoff.reset();
        return r;
      } catch (err) {
        if (!(err instanceof NetError || (err instanceof HttpError && err.status >= 500))) throw err;
        await this._nap(backoff.next(), signal);
      }
    }
  }

  // ------------------------------------------------ sync (long poll) + incoming

  async _syncLoop() {
    if (this._syncing) return;
    this._syncing = true;
    const e = this.engine;
    try {
      while (!this.stopped) {
        if (!e.visible) { await this._waitWake(); continue; }
        const ctl = (this._syncCtl = new AbortController());
        const t0 = Date.now();
        try {
          const { json } = await this.call('sync', { wait: SYNC_WAIT_MS, name: e.deviceName, os: e.os }, null,
            { timeout: SYNC_WAIT_MS + 10000, signal: ctl.signal });
          this.syncBackoff.reset();
          this._learn(json.addrs, this.addr, json.name);
          const outbox = Array.isArray(json.outbox) ? json.outbox : [];
          const ok = await this._receive(outbox);
          if (!ok) await this._nap(this.syncBackoff.next());
          else if (!outbox.length && Date.now() - t0 < 1000) await this._nap(1000);  // never spin
        } catch (err) {
          if (this.stopped || err instanceof UnpairedError) return;
          if (err instanceof AbortedError && ctl.signal.aborted) continue;   // kicked
          await this._nap(this.syncBackoff.next());
        }
      }
    } finally {
      this._syncing = false;
      this._syncCtl = null;
    }
  }

  async _receive(outbox) {
    let ok = true;
    for (const entry of outbox) {
      if (!entry?.tid) continue;
      try { await this._pull(entry); } catch (err) {
        if (this.stopped || err instanceof UnpairedError) throw err;
        ok = false;
      }
    }
    return ok;
  }

  async _pull({ tid, files = [] }) {
    const e = this.engine;
    const inc = { tid, hubId: this.id, names: files.map((f) => f.name), total: sum(files.map((f) => f.size)), received: 0, status: 'receiving' };
    if (!e._pulled.has(tid)) {
      e._busy(+1);
      try {
        e._emit('incoming', { ...inc });
        for (let i = 0; i < files.length; i++) {
          const meta = files[i] || {};
          let size = Number(meta.size) || 0;
          let pos = 0;
          const parts = [];
          while (pos < size) {
            const length = Math.min(CHUNK_SIZE, size - pos);
            const { json, binary } = await this.callRetry('pull', { tid, i, offset: pos, length }, null,
              { timeout: DATA_TIMEOUT, backoff: this.syncBackoff });
            if (Number.isFinite(json.size)) size = json.size;
            const chunk = binary.subarray(0, Math.max(0, Math.min(length, size - pos)));
            if (!chunk.byteLength) { if (pos >= size) break; throw new HttpError(502, 'empty-chunk'); }
            parts.push(new Blob([chunk]));   // copy out of the decrypted buffer
            pos += chunk.byteLength;
            inc.received += chunk.byteLength;
            e._emit('incoming', { ...inc });
          }
          const file = new File(parts, cleanFileName(meta.name), { type: meta.type || '', lastModified: meta.lastModified || Date.now() });
          e._emit('file', { hubId: this.id, hubName: this.name, tid, index: i, file });
        }
      } finally { e._busy(-1); }
      await e._markPulled(tid);
    }
    await this.callRetry('pulled', { tid }, null, { backoff: this.syncBackoff });
    e._emit('incoming', { ...inc, received: inc.total, status: 'done' });
  }

  // ------------------------------------------------ outgoing transfers

  /** Process this hub's queued transfers one at a time. */
  pump() {
    if (this._pumping || this.stopped) return;
    this._pumping = true;
    (async () => {
      try {
        for (let t; !this.stopped && (t = this.engine._nextTransfer(this.id));) await this._send(t);
      } finally {
        this._pumping = false;
        if (!this.stopped && this.engine._nextTransfer(this.id)) this.pump();
      }
    })().catch(() => {});
  }

  async _send(t) {
    const e = this.engine;
    const sig = t.abort.signal;
    const { tid } = t;
    const meta = t.files.map((f) => ({ name: f.name || 'file', size: f.size, type: f.type || '', lastModified: f.lastModified || t.createdAt }));
    t.status = 'sending';
    e._busy(+1);
    e._progress(t);
    try {
      for (;;) {
        try {
          const { json: offer } = await this.callRetry('offer', { tid, files: meta }, null, { signal: sig });
          const have = Array.isArray(offer.received) ? offer.received : [];
          t.acked = meta.map((m, i) => (t.failed.has(i) ? m.size : Math.min(Number(have[i]) || 0, m.size)));
          t.error = null;
          t.lastAt = 0;   // new rate baseline (resumed bytes aren't "speed")
          e._progress(t);
          for (let i = 0; i < meta.length; i++) {
            if (!t.failed.has(i)) await this._sendFile(t, i, sig);
          }
          const { json: end } = await this.callRetry('end', { tid }, null, { signal: sig });
          if (end.ok === false && !t.failed.size) throw new HttpError(409, 'incomplete');
          await e._finish(t, t.failed.size ? 'partial' : 'done');
          return;
        } catch (err) {
          if (sig.aborted || this.stopped || err instanceof AbortedError || err instanceof UnpairedError) return;
          // 4xx (hub restarted and lost the tid, incomplete end, …): start over from offer.
          t.error = err.message;
          e._progress(t);
          await this._nap(this.xferBackoff.next(), sig).catch(() => {});
        }
      }
    } finally {
      e._busy(-1);
    }
  }

  async _sendFile(t, i, sig) {
    const f = t.files[i];
    const size = f.size;
    const opts = { signal: sig, timeout: DATA_TIMEOUT };
    if (size === 0) {   // lets the hub create + finalise empty files
      await this.callRetry('put', { tid: t.tid, i, offset: 0 }, new Uint8Array(0), opts);
      return;
    }
    let pos = t.acked[i];
    while (pos < size) {
      let buf;
      try { buf = await f.slice(pos, Math.min(size, pos + CHUNK_SIZE)).arrayBuffer(); } catch (err) {
        await this.engine._failFile(t, i, err);   // NotReadableError / NotFoundError: source gone
        return;
      }
      const { json } = await this.callRetry('put', { tid: t.tid, i, offset: pos }, buf, opts);
      const bytes = Number(json.bytes);
      pos = Number.isFinite(bytes) ? Math.min(bytes, size) : pos + buf.byteLength;   // {error:'offset'} => jump
      t.acked[i] = pos;
      this.engine._progress(t);
    }
  }
}

// ---------------------------------------------------------------- engine

const ACTIVE = new Set(['queued', 'sending']);

export class ShareEngine extends EventTarget {
  constructor({ kv, hubs, queue, fetch } = {}) {
    super();
    this.kv = kv;
    this.hubsStore = hubs;
    this.queueStore = queue;
    this._fetch = fetch ? (...a) => fetch(...a) : defaultFetch;
    this._hubs = new Map();
    this._transfers = new Map();
    this._pulled = new Set();
    this._wake = new AbortController();
    this._busyCount = 0;
    this._blocked = false;
    this.visible = true;
    this.deviceId = '';
    this.deviceName = '';
    this.os = '';
  }

  _emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  async init({ visible = true, name, os } = {}) {
    this.visible = visible;
    const guess = await guessDevice();
    this.deviceId = await this.kv.get('deviceId');
    if (!this.deviceId) { this.deviceId = randomId(8); await this.kv.put('deviceId', this.deviceId); }
    this.deviceName = (await this.kv.get('deviceName')) || name || guess.name;
    this.os = os || guess.os;
    await this.kv.put('deviceName', this.deviceName);
    await this.kv.put('os', this.os);
    this._pulled = new Set((await this.kv.get('pulledTids')) || []);
    for (const rec of await this.hubsStore.all()) if (rec?.hubId && rec.secret) this._hubs.set(rec.hubId, new HubClient(this, rec));
    for (const rec of await this.queueStore.all()) {
      if (!rec?.tid || !Array.isArray(rec.files) || !ACTIVE.has(rec.status || 'queued')) continue;
      this._track(rec, Promise.resolve());
    }
    for (const hub of this._hubs.values()) hub.start();
    this._emit('hubs', {});
    for (const t of this._transfers.values()) this._emit('transfer', this._snap(t));
    return this;
  }

  get hubs() { return [...this._hubs.values()]; }
  hub(hubId) { return this._hubs.get(hubId); }
  get transfers() { return [...this._transfers.values()].map((t) => this._snap(t)); }

  async setDeviceName(name) {
    const n = String(name || '').trim().slice(0, 40);
    if (!n || n === this.deviceName) return;
    this.deviceName = n;
    await this.kv.put('deviceName', n);
    this.kick();   // re-sync now so the hub sees the new name
  }

  setVisible(visible) {
    this.visible = !!visible;
    if (this.visible) this.kick();
  }

  kick() {
    const w = this._wake;
    this._wake = new AbortController();
    w.abort();
    for (const hub of this._hubs.values()) {
      hub.syncBackoff.reset();
      hub.xferBackoff.reset();
      hub.lastSweep = 0;
      hub._syncCtl?.abort();
    }
  }

  stop() {
    for (const hub of this._hubs.values()) hub.stop();
    for (const t of this._transfers.values()) t.abort.abort();
  }

  async pair(input, { signal, onStatus } = {}) {
    const rec = await pairWithHub(input, {
      deviceId: this.deviceId, name: this.deviceName, os: this.os, fetch: this._fetch, signal,
      onStatus: (s) => { if (s === 'blocked') this._network(true); onStatus?.(s); },
    });
    this._network(false);
    this._hubs.get(rec.hubId)?.stop();
    await this.hubsStore.put(rec.hubId, rec);
    const hub = new HubClient(this, rec);
    hub.addr = rec.lastAddr;
    this._hubs.set(rec.hubId, hub);
    hub.start();
    hub._seen();
    this._emit('hubs', {});
    return hub;
  }

  async send(hubId, files) {
    const hub = this._hubs.get(hubId);
    if (!hub) throw new Error('Unknown computer');
    const list = [...files].map((f) => (f instanceof File ? f : new File([f], 'file', { type: f.type || '' })));
    if (!list.length) throw new Error('No files');
    const rec = {
      tid: randomId(12), hubId, files: list, names: list.map((f) => f.name), total: sum(list.map((f) => f.size)),
      sent: 0, status: 'queued', createdAt: Date.now(), failed: [],
    };
    // Persist so the transfer survives the app being killed; don't delay the start for it.
    const saved = this.queueStore.put(rec.tid, rec).catch((err) => this._emit('warning', { message: `Could not save transfer: ${err.message}` }));
    const t = this._track(rec, saved);
    this._emit('transfer', this._snap(t));
    hub.pump();
    return rec.tid;
  }

  async cancel(tid) {
    const t = this._transfers.get(tid);
    if (!t || !ACTIVE.has(t.status)) return;
    await this._drop(t);
    this._hubs.get(t.hubId)?.call('cancel', { tid }, null, { timeout: 5000 }).catch(() => {});
  }

  async forget(hubId) {
    const hub = this._hubs.get(hubId);
    if (!hub) return;
    hub._forgetting = true;
    for (const t of [...this._transfers.values()]) if (t.hubId === hubId && ACTIVE.has(t.status)) await this._drop(t);
    try { await hub.request('unpair', {}, null, { timeout: 3000 }); } catch { /* best effort */ }
    hub.stop();
    this._hubs.delete(hubId);
    await this.hubsStore.delete(hubId).catch(() => {});
    this._emit('hubs', {});
  }

  // ------------------------------------------------ internals

  _track(rec, saved) {
    const t = {
      tid: rec.tid, hubId: rec.hubId, files: rec.files, names: rec.names || rec.files.map((f) => f.name),
      total: rec.total ?? sum(rec.files.map((f) => f.size)), createdAt: rec.createdAt || Date.now(),
      status: 'queued', failed: new Set(rec.failed || []), acked: rec.files.map(() => 0), rate: 0,
      error: null, doneAt: 0, abort: new AbortController(), saved, rec, lastAt: 0, lastSent: 0,
    };
    this._transfers.set(t.tid, t);
    return t;
  }

  _snap(t) {
    return {
      tid: t.tid, hubId: t.hubId, names: t.names, total: t.total, sent: Math.min(t.total, sum(t.acked)),
      rate: t.rate, status: t.status, failed: [...t.failed], error: t.error, createdAt: t.createdAt, doneAt: t.doneAt,
    };
  }

  _nextTransfer(hubId) {
    let best = null;
    for (const t of this._transfers.values()) {
      if (t.hubId === hubId && ACTIVE.has(t.status) && (!best || t.createdAt < best.createdAt)) best = t;
    }
    return best;
  }

  _progress(t) {
    const sent = sum(t.acked);
    const now = Date.now();
    if (t.lastAt && sent > t.lastSent) {
      const inst = (sent - t.lastSent) / Math.max(0.001, (now - t.lastAt) / 1000);
      t.rate = t.rate ? t.rate * 0.6 + inst * 0.4 : inst;
    }
    if (!t.lastAt || sent !== t.lastSent) { t.lastAt = now; t.lastSent = sent; }
    this._emit('transfer', this._snap(t));
  }

  async _failFile(t, i, err) {
    t.failed.add(i);
    t.acked[i] = t.files[i].size;
    t.error = `${t.names[i]}: ${err?.name || 'read error'}`;
    t.rec.failed = [...t.failed];
    await t.saved;
    await this.queueStore.put(t.tid, t.rec).catch(() => {});
    this._progress(t);
  }

  async _finish(t, status) {
    t.status = status;
    t.doneAt = Date.now();
    t.rate = 0;
    t.files = null;
    t.rec = null;
    await t.saved;
    await this.queueStore.delete(t.tid).catch(() => {});
    this._emit('transfer', this._snap(t));
  }

  /** Cancel locally: abort, forget the persisted record. Returns the files not yet failed. */
  async _drop(t) {
    const files = (t.files || []).filter((_, i) => !t.failed.has(i));
    t.status = 'cancelled';
    t.abort.abort();
    t.doneAt = Date.now();
    t.files = null;
    t.rec = null;
    await t.saved;
    await this.queueStore.delete(t.tid).catch(() => {});
    this._emit('transfer', this._snap(t));
    return files;
  }

  async _unpaired(hub, reason) {
    if (hub.stopped || hub._forgetting) return;
    hub.stop();
    this._hubs.delete(hub.id);
    await this.hubsStore.delete(hub.id).catch(() => {});
    const files = [];
    for (const t of [...this._transfers.values()]) {
      if (t.hubId === hub.id && ACTIVE.has(t.status)) files.push(...await this._drop(t));
    }
    this._emit('unpaired', { hubId: hub.id, name: hub.name, reason, files });
    this._emit('hubs', {});
  }

  async _markPulled(tid) {
    this._pulled.add(tid);
    const list = [...this._pulled].slice(-100);
    this._pulled = new Set(list);
    await this.kv.put('pulledTids', list).catch(() => {});
  }

  _busy(delta) {
    const was = this._busyCount > 0;
    this._busyCount = Math.max(0, this._busyCount + delta);
    if (was !== this._busyCount > 0) this._emit('busy', { busy: this._busyCount > 0 });
  }

  _network(blocked) {
    if (this._blocked === blocked) return;
    this._blocked = blocked;
    this._emit('network', { blocked });
  }
}
