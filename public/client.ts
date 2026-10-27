import { Effect, Ref, Schema } from 'effect';
import type { PairPayload } from './lib/proto.js';
import { runEffect } from './lib/runtime.js';
import type { ClientStore, Fetch, HubRecord, EngineRuntime, HubRuntime, ShareEngine, HubClient, ShareOptions, ClientEvents, Transfer, QueueRecord, IncomingTransfer, Hello, WireResponse, PairIdentity, PairInput, PairOptions, InitOptions, IncomingState } from './client-types.js';
export type { ShareEngine, HubClient, HubRecord, TransferSnapshot, IncomingTransfer, ClientEvents } from './client-types.js';
import {
  PORT, CHUNK_SIZE, SYNC_WAIT_MS, createBackoff, sleep, seal, open, pairKey, deviceKey,
  requestAad, responseAad, baseUrl, unb64url, randomId, ipToBytes, isPrivateIp,
  pairPayloadFromText, cleanFileName,
} from './lib/proto.js';

const UserAgentSchema = Schema.Struct({ platform: Schema.optional(Schema.String) });
const ModelSchema = Schema.Struct({ model: Schema.optional(Schema.String) });
const HelloSchema = Schema.Struct({ app: Schema.Literal('i6-share-hub'), id: Schema.String, name: Schema.String, addrs: Schema.Array(Schema.String) });
const MetaSchema = Schema.Struct({ name: Schema.String, size: Schema.Number, type: Schema.String, lastModified: Schema.Number });
const WireSchema = Schema.Struct({
  secret: Schema.optional(Schema.String), hubId: Schema.optional(Schema.String), name: Schema.optional(Schema.String),
  addrs: Schema.optional(Schema.Array(Schema.String)), outbox: Schema.optional(Schema.Array(Schema.Struct({ tid: Schema.String, files: Schema.Array(MetaSchema) }))),
  size: Schema.optional(Schema.Number), received: Schema.optional(Schema.Array(Schema.Number)), ok: Schema.optional(Schema.Boolean),
  bytes: Schema.optional(Schema.Number), error: Schema.optional(Schema.String),
});
const HubSchema = Schema.Struct({ hubId: Schema.String, name: Schema.String, port: Schema.Number, addrs: Schema.Array(Schema.String), lastAddr: Schema.String, secret: Schema.String, pairedAt: Schema.Number, lastSeen: Schema.Number });
const QueueSchema = Schema.Struct({ tid: Schema.String, hubId: Schema.String, files: Schema.Array(Schema.instanceOf(File)), names: Schema.optional(Schema.Array(Schema.String)), total: Schema.optional(Schema.Number), createdAt: Schema.optional(Schema.Number), failed: Schema.optional(Schema.Array(Schema.Number)), status: Schema.optional(Schema.String) });
const readError = async (response: Response): Promise<{ readonly error?: string | undefined }> => Schema.decodeUnknownSync(Schema.Struct({ error: Schema.optional(Schema.String) }))(await response.json().catch(() => ({})));

export const APP_VERSION = '1.0.4';

const HELLO_TIMEOUT = 4000;         // direct liveness check
const SWEEP_TIMEOUT = 1500;         // per address while sweeping a /24
const SWEEP_CONCURRENCY = 32;
const SWEEP_MIN_INTERVAL = 60000;   // don't sweep more often than this per hub
const REQ_TIMEOUT = 15000;
const DATA_TIMEOUT = 60000;         // put / pull
const FAST_FAIL_MS = 500;           // "instant" TypeError => probably blocked by the browser
const SAVE_LASTSEEN_MS = 60000;

// ---------------------------------------------------------------- errors

export interface ClientError extends Error { readonly code: string; readonly status: number; readonly fast: boolean }
const clientError = (name: string, message: string, cause?: unknown, code = '', status = 0, fast = false): ClientError =>
  Object.assign(new Error(message, { cause }), { name, code, status, fast });
export const NetError = (message: string, cause?: unknown, fast = false): ClientError => clientError('NetError', message, cause, '', 0, fast);
export const HttpError = (status: number, code = ''): ClientError => clientError('HttpError', `HTTP ${String(status)}${code ? ` ${code}` : ''}`, undefined, code, status);
export const UnpairedError = (code: string): ClientError => clientError('UnpairedError', `unpaired (${code || 'unknown-device'})`, undefined, code);
export const AbortedError = (): ClientError => clientError('AbortedError', 'aborted');
export const PairError = (code: string, message: string): ClientError => clientError('PairError', message, undefined, code);
export const isClientError = (error: unknown, name: string): error is ClientError => error instanceof Error && error.name === name && 'code' in error && typeof error.code === 'string' && 'status' in error && typeof error.status === 'number' && 'fast' in error && typeof error.fast === 'boolean';
export const isAbortedError = (error: unknown): boolean => isClientError(error, 'AbortedError');
const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);
const nonempty = (value: string | undefined): string | undefined => value === undefined || value.length === 0 ? undefined : value;
const isEntropyReader = (value: unknown): value is (hints: readonly string[]) => Promise<unknown> => typeof value === 'function';
const ignore = (): void => undefined;

// ---------------------------------------------------------------- helpers

const unique = (list: readonly (string | undefined | null)[]): string[] => [...new Set(list.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0))];
const sum = (list: readonly number[]): number => list.reduce((n, x) => n + x, 0);

function anySignal(...signals: readonly (AbortSignal | undefined)[]): AbortSignal {
  return AbortSignal.any(signals.filter((signal): signal is AbortSignal => signal !== undefined));
}

/** Chrome Local Network Access: tell fetch which address space we expect. */
function addressSpace(ip: string): 'loopback' | 'local' {
  const b = ipToBytes(ip);
  const loop = b !== null && (b.length === 4 ? b[0] === 127 : b.every((x, i) => x === (i === 15 ? 1 : 0)));
  return loop ? 'loopback' : 'local';
}

const defaultFetch: Fetch = (input, init) => globalThis.fetch(input, init);
const fetchEffect = (fetch: Fetch, input: string, init: Parameters<Fetch>[1]): Promise<Response> => runEffect(Effect.tryPromise({ try: () => fetch(input, init), catch: (error) => error }));

/** In-memory storage with the lib/store.js API (for tests / fallback). */
export function memoryStore(entries: Iterable<readonly [string, unknown], unknown, unknown> = []): ClientStore {
  const state = Effect.runSync(Ref.make<ReadonlyMap<string, unknown>>(new Map(entries)));
  return {
    get: (key) => runEffect(Effect.map(Ref.get(state), (map) => map.get(key))),
    put: (key, value) => runEffect(Ref.update(state, (map) => new Map([...map, [key, value]]))),
    delete: (key) => runEffect(Ref.update(state, (map) => new Map([...map].filter(([stored]) => stored !== key)))),
    all: () => runEffect(Effect.map(Ref.get(state), (map) => [...map.values()])),
  };
}

/** Friendly default device name + os from the user agent. */
export async function guessDevice() {
  const nav = globalThis.navigator;
  const uad: unknown = 'userAgentData' in nav ? nav.userAgentData : undefined;
  const agent = Schema.decodeUnknownOption(UserAgentSchema)(uad);
  const agentData = agent._tag === 'Some' ? agent.value : undefined;
  const ua = nav.userAgent;
  const p = `${agentData?.platform ?? ''} ${ua}`;
  const os = /android/i.test(p) ? 'android' : /cros|chrome ?os/i.test(p) ? 'chromeos'
    : /iphone|ipad|ios/i.test(p) ? 'ios' : /win/i.test(p) ? 'windows'
      : /mac/i.test(p) ? 'macos' : /linux/i.test(p) ? 'linux' : 'unknown';
  let model = '';
  try {
    if (uad !== null && typeof uad === 'object' && 'getHighEntropyValues' in uad && isEntropyReader(uad.getHighEntropyValues)) {
      const response: unknown = await uad.getHighEntropyValues(['model']);
      model = Schema.decodeUnknownSync(ModelSchema)(response).model ?? '';
    }
  } catch { /* not allowed */ }
  if (!model && os === 'android') {
    const m = /Android [\d.]+; ([^;)]+)\)/.exec(ua);
    if (m?.[1] !== undefined && m[1].trim() !== 'K') model = m[1].trim();   // reduced UA reports "K"
  }
  const fallback = { android: 'Android phone', chromeos: 'Chromebook', ios: 'iPhone', windows: 'Windows PC', macos: 'Mac', linux: 'Linux PC', unknown: 'Browser' };
  return { name: (model || fallback[os]).slice(0, 40), os };
}

// ---------------------------------------------------------------- discovery

/** GET /i6/hello on one address. Resolves with the hello JSON or throws NetError. */
export async function hello(addr: string, port = PORT, { timeout = HELLO_TIMEOUT, signal, fetch = defaultFetch }: { readonly timeout?: number; readonly signal?: AbortSignal | undefined; readonly fetch?: Fetch | undefined } = {}): Promise<Hello> {
  const t0 = Date.now();
  try {
    const res = await fetchEffect(fetch, `${baseUrl(addr, port)}/i6/hello`, {
      cache: 'no-store', credentials: 'omit', targetAddressSpace: addressSpace(addr),
      signal: anySignal(AbortSignal.timeout(timeout), signal),
    });
    if (!res.ok) throw HttpError(res.status);
    const j = Schema.decodeUnknownSync(HelloSchema)(await res.json());
    return j;
  } catch (err) {
    if (signal?.aborted === true) throw AbortedError();
    throw NetError(`hello ${addr}: ${errorMessage(err)}`, err, err instanceof TypeError && Date.now() - t0 < FAST_FAIL_MS);
  }
}

/** Every other host of the /24 of each private IPv4 in `addrs`, nearest first. */
export function sweepCandidates(addrs: readonly string[], maxNets = 4): string[] {
  const seen = new Set(addrs);
  const nets = new Set();
  const out: string[] = [];
  for (const a of addrs) {
    const b = ipToBytes(a);
    // Only real LANs: loopback and link-local (169.254/16) aren't worth a sweep.
    if (b?.length !== 4 || !isPrivateIp(a) || b[0] === 127 || (b[0] === 169 && b[1] === 254)) continue;
    const net = `${String(b[0])}.${String(b[1])}.${String(b[2])}`;
    if (nets.has(net) || nets.size >= maxNets) continue;
    nets.add(net);
    const host = new DataView(b.buffer, b.byteOffset, b.byteLength).getUint8(3);
    const hosts = Array.from({ length: 254 }, (_, i) => i + 1).sort((x, y) => Math.abs(x - host) - Math.abs(y - host));
    for (const x of hosts) {
      const ip = `${net}.${String(x)}`;
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
export async function locateHub({ hubId, port = PORT, addrs = [], lastAddr }: { readonly hubId?: string; readonly port?: number; readonly addrs?: readonly string[]; readonly lastAddr?: string }, { sweep = false, signal, fetch }: { readonly sweep?: boolean; readonly signal?: AbortSignal | undefined; readonly fetch?: Fetch | undefined } = {}): Promise<{ readonly addr: string; readonly hello: Hello } | { readonly addr: null; readonly blocked: boolean }> {
  const known = unique([lastAddr, ...addrs]);
  const tryAddr = async (addr: string, timeout: number, sig: AbortSignal) => {
    const j = await hello(addr, port, { timeout, signal: sig, fetch });
    if (hubId !== undefined && j.id !== hubId) throw NetError(`${addr} is a different hub`);
    return { addr, hello: j };
  };
  let fast = 0;
  if (known.length) {
    const ctl = new AbortController();
    try {
      const r = await Promise.any(known.map((a) => tryAddr(a, HELLO_TIMEOUT, anySignal(ctl.signal, signal))
        .catch((err: unknown) => { if (isClientError(err, 'NetError') && err.fast) fast++; throw err; })));
      ctl.abort();
      return r;
    } catch { if (signal?.aborted === true) throw AbortedError(); }
  }
  const blocked = known.length > 0 && fast === known.length;
  if (!sweep) return { addr: null, blocked };

  const candidates = sweepCandidates(known);
  const ctl = new AbortController();
  const sig = anySignal(ctl.signal, signal);
  const search = Effect.runSync(Ref.make<{ readonly addr: string; readonly hello: Hello } | null>(null));
  const found = () => Effect.runSync(Ref.get(search));
  const addresses = candidates.values();
  const worker = async () => {
    while (found() === null && !sig.aborted) {
      const next = addresses.next();
      if (next.done === true) return;
      try { const result = await tryAddr(next.value, SWEEP_TIMEOUT, sig); Effect.runSync(Ref.update(search, (current) => current ?? result)); ctl.abort(); } catch { /* keep looking */ }
    }
  };
  await Promise.all(Array.from({ length: Math.min(SWEEP_CONCURRENCY, candidates.length) }, worker));
  if (found() === null && signal?.aborted === true) throw AbortedError();
  return found() ?? { addr: null, blocked };
}

// ---------------------------------------------------------------- pairing

async function pairAt(addr: string, p: PairPayload, { deviceId, name, os, fetch = defaultFetch, signal }: PairIdentity): Promise<WireResponse & { readonly secret: string }> {
  const key = await pairKey(p.token, p.hubId);
  const { body, iv } = await seal(key, requestAad('pair', 'pair'), { deviceId, name, os });
  let res: Response; let buf: ArrayBuffer | null;
  try {
    res = await fetchEffect(fetch, `${baseUrl(addr, p.port)}/i6/pair?h=${p.hubId}`, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body,
      cache: 'no-store', credentials: 'omit', targetAddressSpace: addressSpace(addr),
      signal: anySignal(AbortSignal.timeout(REQ_TIMEOUT), signal),
    });
    buf = res.status === 200 ? await res.arrayBuffer() : null;
  } catch (err) {
    if (signal?.aborted === true) throw AbortedError();
    throw NetError(`pair ${addr}: ${errorMessage(err)}`, err);
  }
  if (!buf) {
    const err = await readError(res);
    throw HttpError(res.status, err.error ?? '');
  }
  let json: WireResponse | null;
  try { json = Schema.decodeUnknownSync(WireSchema)((await open(key, responseAad('pair', iv), buf)).json); } catch { json = null; }
  if (json?.secret === undefined || json.secret.length === 0 || (json.hubId !== undefined && json.hubId !== p.hubId)) throw PairError('bad-response', 'The computer sent an invalid pairing response.');
  return { ...json, secret: json.secret };
}

/**
 * Pairs with the hub described by a QR payload (string or decoded object).
 * Probes the hub's addresses first (so only ONE pair request consumes the
 * one-time token), retrying with backoff until `signal` aborts.
 * Resolves with the hub record to store in `hubs`.
 */
export async function pairWithHub(input: PairInput, { deviceId, name, os, fetch = defaultFetch, signal, onStatus }: PairIdentity): Promise<HubRecord> {
  const p = typeof input === 'string' ? pairPayloadFromText(input) : input;
  const backoff = createBackoff(500, 5000);
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted === true) throw AbortedError();
    onStatus?.('searching');
    const sweep = attempt === 2 || (attempt > 2 && attempt % 6 === 2);
    const loc = await locateHub({ hubId: p.hubId, port: p.port, addrs: p.addrs }, { sweep, signal, fetch });
    if (loc.addr !== null) {
      onStatus?.('pairing');
      try {
        const json = await pairAt(loc.addr, p, { deviceId, name, os, fetch, signal });
        const now = Date.now();
        return {
          hubId: p.hubId, name: nonempty(json.name) ?? nonempty(loc.hello.name) ?? nonempty(p.name) ?? 'Computer', port: p.port,
          addrs: unique([loc.addr, ...loc.hello.addrs, ...p.addrs]).slice(0, 8), lastAddr: loc.addr,
          secret: json.secret, pairedAt: now, lastSeen: now,
        };
      } catch (err) {
        if (isClientError(err, 'HttpError') && err.status < 500) {
          throw err.status === 401
            ? PairError('expired', 'This pairing code has expired or was already used. Show the QR code again on your computer.')
            : PairError('rejected', `The computer rejected the pairing (${err.code || String(err.status)}).`);
        }
        if (!(isClientError(err, 'NetError') || isClientError(err, 'HttpError'))) throw err;
      }
    } else if (loc.blocked) onStatus?.('blocked');
    try { await sleep(backoff.next(), signal); } catch { throw AbortedError(); }
  }
}

// ---------------------------------------------------------------- one paired hub

function createHubClient(engine: EngineRuntime, rec: HubRecord): HubRuntime {
  const state = Effect.runSync(Ref.make<Pick<HubRuntime, 'rec' | 'status' | 'addr' | 'fails' | 'lastSweep' | 'stopped' | '_key' | '_locating' | '_syncCtl' | '_pumping' | '_savedAt' | '_forgetting'>>({rec: rec, status: 'searching', addr: null, fails: 0, lastSweep: 0, stopped: false, _key: null, _locating: null, _syncCtl: null, _pumping: false, _savedAt: 0, _forgetting: false}));
  const self: HubRuntime = {
    update: (patch) => Effect.runSync(Ref.updateAndGet(state, (current) => ({ ...current, ...patch }))),
    engine, syncBackoff: createBackoff(500, 30000), xferBackoff: createBackoff(500, 30000), life: new AbortController(),
    get rec() { return Effect.runSync(Ref.get(state)).rec; },
    get status() { return Effect.runSync(Ref.get(state)).status; },
    get addr() { return Effect.runSync(Ref.get(state)).addr; },
    get fails() { return Effect.runSync(Ref.get(state)).fails; },
    get lastSweep() { return Effect.runSync(Ref.get(state)).lastSweep; },
    get stopped() { return Effect.runSync(Ref.get(state)).stopped; },
    get _key() { return Effect.runSync(Ref.get(state))._key; },
    get _locating() { return Effect.runSync(Ref.get(state))._locating; },
    get _syncCtl() { return Effect.runSync(Ref.get(state))._syncCtl; },
    get _pumping() { return Effect.runSync(Ref.get(state))._pumping; },
    get _savedAt() { return Effect.runSync(Ref.get(state))._savedAt; },
    get _forgetting() { return Effect.runSync(Ref.get(state))._forgetting; },



  get id() { return self.rec.hubId; },
  get name() { return self.rec.name; },
  get lastSeen() { return self.rec.lastSeen; },

  key() { const key = self._key ?? deviceKey(unb64url(self.rec.secret), self.engine.deviceId); self.update({ _key: key }); return key; },

  start() {
    void self._syncLoop().catch(ignore);
    self.pump();
  },

  stop() {
    self.update({ stopped: true });
    self.life.abort();
  },

  _setStatus(status) {
    if (self.status === status) return;
    self.update({ status: status });
    self.engine._emit('status', { hubId: self.id, status, lastSeen: self.rec.lastSeen });
  },

  _seen() {
    self.update({ fails: 0 });
    self.update({ rec: { ...self.rec, lastSeen: Date.now() } });
    self._setStatus('online');
    self.engine._network(false);
    if (Date.now() - self._savedAt > SAVE_LASTSEEN_MS) self._save();
  },

  _save() {
    if (self.stopped) return;
    self.update({ _savedAt: Date.now() });
    void self.engine.hubsStore.put(self.id, self.rec).catch(ignore);
  },

  /** Merge addresses / name learnt from hello or sync. */
  _learn(addrs, addr, name) {
    const next = unique([addr, ...(addrs ?? []), ...self.rec.addrs]).slice(0, 8);
    let changed = next.join() !== self.rec.addrs.join() || (addr !== null && addr !== self.rec.lastAddr);
    self.update({ rec: { ...self.rec, addrs: next } });
    if (addr !== null) self.update({ rec: { ...self.rec, lastAddr: addr } });
    if (name !== undefined && name.length > 0 && name !== self.rec.name) {
      self.update({ rec: { ...self.rec, name: name.slice(0, 60) } });
      changed = true;
      self.engine._emit('hubs', {});
    }
    if (changed) self._save();
  },

  /** Sleep that a kick() ends early; throws AbortedError if stopped / signal aborted. */
  async _nap(ms, signal) {
    try { await sleep(ms, anySignal(self.engine._wake.signal, self.life.signal, signal)); } catch { /* woken */ }
    if (self.stopped || signal?.aborted === true) throw AbortedError();
  },

  _waitWake() {
    return new Promise<void>((resolve) => {
      const s = anySignal(self.engine._wake.signal, self.life.signal);
      s.addEventListener('abort', () => { resolve(); }, { once: true });
    });
  },

  /** Single-flight hub location; resolves with a verified address or throws NetError. */
  locate() {
    const locating = self._locating ?? self._locate().finally(() => { self.update({ _locating: null }); });
    self.update({ _locating: locating });
    return locating;
  },

  async _locate() {
    self._setStatus('searching');
    const now = Date.now();
    const sweep = self.fails >= 2 && now - self.lastSweep > SWEEP_MIN_INTERVAL;
    if (sweep) self.update({ lastSweep: now });
    const r = await locateHub(self.rec, { sweep, fetch: self.engine._fetch, signal: self.life.signal });
    if (r.addr !== null) {
      self.update({ addr: r.addr });
      self._learn(r.hello.addrs, r.addr, r.hello.name);
      self._seen();
      return r.addr;
    }
    self.update({ fails: self.fails + 1 });
    self._setStatus('offline');
    if (r.blocked) self.engine._network(true);
    throw NetError(`${self.name} not reachable`);
  },

  /** One encrypted request to one address. */
  async request(op, json, binary, { addr = self.addr ?? self.rec.lastAddr, timeout = REQ_TIMEOUT, signal } = {}) {
    const e = self.engine;
    const key = await self.key();
    const { body, iv } = await seal(key, requestAad(op, e.deviceId), json, binary);
    let res: Response; let buf: ArrayBuffer | null;
    try {
      res = await fetchEffect(e._fetch, `${baseUrl(addr, self.rec.port)}/i6/${op}?d=${e.deviceId}`, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body,
        cache: 'no-store', credentials: 'omit', targetAddressSpace: addressSpace(addr),
        signal: anySignal(AbortSignal.timeout(timeout), signal, self.life.signal),
      });
      buf = res.status === 200 ? await res.arrayBuffer() : null;
    } catch (err) {
      if (signal?.aborted === true || self.stopped) throw AbortedError();
      throw NetError(`${op} ${addr}: ${errorMessage(err)}`, err);
    }
    if (buf) {
      try { const opened = await open(key, responseAad(op, iv), buf); return { ...opened, json: Schema.decodeUnknownSync(WireSchema)(opened.json) }; } catch (err) { throw NetError(`${op} ${addr}: undecryptable response`, err); }
    }
    const err = await readError(res);
    if (res.status === 401) await self._checkUnpaired(addr, err.error ?? '');
    throw HttpError(res.status, err.error ?? '');
  },

  /** A 401 only counts if the hub at that address really is ours (not some other hub after a DHCP shuffle). */
  async _checkUnpaired(addr, code) {
    let j: Hello;
    try { j = await hello(addr, self.rec.port, { fetch: self.engine._fetch, signal: self.life.signal }); } catch { throw NetError('auth failed, hub not verifiable'); }
    if (j.id !== self.id) { self.update({ addr: null }); throw NetError(`another hub answered at ${addr}`); }
    await self.engine._unpaired(self, code);
    throw UnpairedError(code);
  },

  /** request() on the current address, locating the hub first if needed. */
  async call(op, json, binary, opts = {}) {
    if (self.stopped) throw AbortedError();
    const addr = self.addr ?? await self.locate();
    try {
      const r = await self.request(op, json, binary, { ...opts, addr });
      self._seen();
      return r;
    } catch (err) {
      if (isClientError(err, 'HttpError')) self._seen();
      if (isClientError(err, 'NetError')) {
        if (self.addr === addr) self.update({ addr: null });
        self.update({ fails: self.fails + 1 });
      }
      throw err;
    }
  },

  /** call() retried forever on network errors / 5xx (backoff + jitter, kick resets). */
  async callRetry(op, json, binary, { backoff = self.xferBackoff, signal, timeout } = {}) {
    for (;;) {
      if (self.stopped || signal?.aborted === true) throw AbortedError();
      try {
        const r = await self.call(op, json, binary, { timeout, signal });
        backoff.reset();
        return r;
      } catch (err) {
        if (!(isClientError(err, 'NetError') || (isClientError(err, 'HttpError') && err.status >= 500))) throw err;
        await self._nap(backoff.next(), signal);
      }
    }
  },

  // ------------------------------------------------ sync (long poll) + incoming

  async _syncLoop() {
    const e = self.engine;
    try {
      while (!self.stopped) {
        if (!e.visible) { await self._waitWake(); continue; }
        const ctl = new AbortController();
        self.update({ _syncCtl: ctl });
        const t0 = Date.now();
        try {
          const { json } = await self.call('sync', { wait: SYNC_WAIT_MS, name: e.deviceName, os: e.os }, null,
            { timeout: SYNC_WAIT_MS + 10000, signal: ctl.signal });
          self.syncBackoff.reset();
          self._learn(json.addrs, self.addr, json.name);
          const outbox = json.outbox ?? [];
          const ok = await self._receive(outbox);
          if (!ok) await self._nap(self.syncBackoff.next());
          else if (!outbox.length && Date.now() - t0 < 1000) await self._nap(1000);  // never spin
        } catch (err) {
          if (self.life.signal.aborted || isClientError(err, 'UnpairedError')) return;
          if (isClientError(err, 'AbortedError') && ctl.signal.aborted) continue;   // kicked
          await self._nap(self.syncBackoff.next());
        }
      }
    } finally {
      self.update({ _syncCtl: null });
    }
  },

  async _receive(outbox) {
    let ok = true;
    for (const entry of outbox) {
      if (!entry.tid) continue;
      try { await self._pull(entry); } catch (err) {
        if (self.stopped || isClientError(err, 'UnpairedError')) throw err;
        ok = false;
      }
    }
    return ok;
  },

  async _pull({ tid, files }) {
    const e = self.engine;
    const initial: IncomingTransfer = { tid, hubId: self.id, names: files.map((f) => f.name), total: sum(files.map((f) => f.size)), received: 0, status: 'receiving' };
    const incoming = Effect.runSync(Ref.make<IncomingState>(initial));
    const snapshot = (): IncomingTransfer => Effect.runSync(Ref.get(incoming));
    if (!e._pulled.has(tid)) {
      e._busy(1);
      try {
        e._emit('incoming', snapshot());
        for (const [i, meta] of files.entries()) {
          let size = meta.size;
          let pos = 0;
          const parts: Blob[] = [];
          while (pos < size) {
            const length = Math.min(CHUNK_SIZE, size - pos);
            const { json, binary } = await self.callRetry('pull', { tid, i, offset: pos, length }, null,
              { timeout: DATA_TIMEOUT, backoff: self.syncBackoff });
            if (json.size !== undefined && Number.isFinite(json.size)) size = json.size;
            const chunk = binary.subarray(0, Math.max(0, Math.min(length, size - pos)));
            if (!chunk.byteLength) { if (pos >= size) break; throw HttpError(502, 'empty-chunk'); }
            parts.push(new Blob([chunk]));   // copy out of the decrypted buffer
            pos += chunk.byteLength;
            Effect.runSync(Ref.update(incoming, (current) => ({ ...current, received: current.received + chunk.byteLength })));
            e._emit('incoming', snapshot());
          }
          const file = new File(parts, cleanFileName(meta.name), { type: meta.type || '', lastModified: meta.lastModified || Date.now() });
          e._emit('file', { hubId: self.id, hubName: self.name, tid, index: i, file });
        }
      } finally { e._busy(-1); }
      await e._markPulled(tid);
    }
    await self.callRetry('pulled', { tid }, null, { backoff: self.syncBackoff });
    e._emit('incoming', { ...snapshot(), received: initial.total, status: 'done' });
  },

  // ------------------------------------------------ outgoing transfers

  /** Process this hub's queued transfers one at a time. */
  pump() {
    if (self._pumping || self.stopped) return;
    self.update({ _pumping: true });
    void (async () => {
      try {
        for (let t: Transfer | undefined; !self.stopped && (t = self.engine._nextTransfer(self.id));) await self._send(t);
      } finally {
        self.update({ _pumping: false });
      }
    })().catch(ignore);
  },

  async _send(t) {
    const e = self.engine;
    const sig = t.abort.signal;
    const { tid } = t;
    const meta = t.files.map((f) => ({ name: f.name || 'file', size: f.size, type: f.type || '', lastModified: f.lastModified || t.createdAt }));
    t.update({ status: 'sending' });
    e._busy(1);
    e._progress(t);
    try {
      for (;;) {
        try {
          const { json: offer } = await self.callRetry('offer', { tid, files: meta }, null, { signal: sig });
          const have = offer.received ?? [];
          t.update({ acked: meta.map((m, i) => (t.failed.includes(i) ? m.size : Math.min(Number(have[i]) || 0, m.size))) });
          t.update({ error: null });
          t.update({ lastAt: 0 });   // new rate baseline (resumed bytes aren't "speed")
          e._progress(t);
          for (const [i, file] of t.files.entries()) {
            if (!t.failed.includes(i)) await self._sendFile(t, i, sig, file);
          }
          const { json: end } = await self.callRetry('end', { tid }, null, { signal: sig });
          if (end.ok === false && !t.failed.length) throw HttpError(409, 'incomplete');
          await e._finish(t, t.failed.length ? 'partial' : 'done');
          return;
        } catch (err) {
          if (sig.aborted || self.stopped || isClientError(err, 'AbortedError') || isClientError(err, 'UnpairedError')) return;
          // 4xx (hub restarted and lost the tid, incomplete end, …): start over from offer.
          t.update({ error: errorMessage(err) });
          e._progress(t);
          await self._nap(self.xferBackoff.next(), sig).catch(ignore);
        }
      }
    } finally {
      e._busy(-1);
    }
  },

  async _sendFile(t, i, sig, f) {
    const size = f.size;
    const opts = { signal: sig, timeout: DATA_TIMEOUT };
    if (size === 0) {   // lets the hub create + finalise empty files
      await self.callRetry('put', { tid: t.tid, i, offset: 0 }, new Uint8Array(0), opts);
      return;
    }
    let pos = sum(t.acked.slice(i, i + 1));
    while (pos < size) {
      let buf: ArrayBuffer;
      try { buf = await f.slice(pos, Math.min(size, pos + CHUNK_SIZE)).arrayBuffer(); } catch (err) {
        await self.engine._failFile(t, i, err);   // NotReadableError / NotFoundError: source gone
        return;
      }
      const { json } = await self.callRetry('put', { tid: t.tid, i, offset: pos }, buf, opts);
      const bytes = Number(json.bytes);
      pos = Number.isFinite(bytes) ? Math.min(bytes, size) : pos + buf.byteLength;   // {error:'offset'} => jump
      t.update({ acked: t.acked.map((acked, index) => index === i ? pos : acked) });
      self.engine._progress(t);
    }
  },
  };
  return self;
}

// ---------------------------------------------------------------- engine

const ACTIVE = new Set(['queued', 'sending']);

export function createShareEngine({ kv, hubs, queue, fetch }: ShareOptions): ShareEngine {
  const listeners: { [K in keyof ClientEvents]: Map<(event: CustomEvent<ClientEvents[K]>) => void, { readonly once: boolean; readonly signal: AbortSignal | undefined; readonly abort: () => void }> } = {
    hubs: new Map(), status: new Map(), transfer: new Map(), incoming: new Map(), file: new Map(),
    unpaired: new Map(), network: new Map(), busy: new Map(), warning: new Map(),
  };
  const state = Effect.runSync(Ref.make<Pick<EngineRuntime, '_hubs' | '_transfers' | '_pulled' | '_wake' | '_busyCount' | '_blocked' | 'visible' | 'deviceId' | 'deviceName' | 'os'>>({_hubs: new Map(), _transfers: new Map(), _pulled: new Set(), _wake: new AbortController(), _busyCount: 0, _blocked: false, visible: true, deviceId: '', deviceName: '', os: ''}));
  const self: EngineRuntime = {
    update: (patch) => Effect.runSync(Ref.updateAndGet(state, (current) => ({ ...current, ...patch }))),
    get _hubs() { return Effect.runSync(Ref.get(state))._hubs; },
    get _transfers() { return Effect.runSync(Ref.get(state))._transfers; },
    get _pulled() { return Effect.runSync(Ref.get(state))._pulled; },
    get _wake() { return Effect.runSync(Ref.get(state))._wake; },
    get _busyCount() { return Effect.runSync(Ref.get(state))._busyCount; },
    get _blocked() { return Effect.runSync(Ref.get(state))._blocked; },
    get visible() { return Effect.runSync(Ref.get(state)).visible; },
    get deviceId() { return Effect.runSync(Ref.get(state)).deviceId; },
    get deviceName() { return Effect.runSync(Ref.get(state)).deviceName; },
    get os() { return Effect.runSync(Ref.get(state)).os; },
    kv, hubsStore: hubs, queueStore: queue, _fetch: fetch ?? defaultFetch,

    addEventListener(type, listener, options) {
      const config = typeof options === 'object' ? options : {};
      if (config.signal?.aborted === true || listeners[type].has(listener)) return;
      const abort = (): void => { self.removeEventListener(type, listener); };
      listeners[type].set(listener, { once: config.once === true, signal: config.signal, abort });
      config.signal?.addEventListener('abort', abort, { once: true });
    },
    removeEventListener(type, listener) {
      const entry = listeners[type].get(listener);
      listeners[type].delete(listener);
      entry?.signal?.removeEventListener('abort', entry.abort);
    },
    _emit(type, detail) {
      for (const [listener, entry] of [...listeners[type]]) {
        if (!listeners[type].has(listener)) continue;
        if (entry.once) self.removeEventListener(type, listener);
        Effect.runSync(Effect.ignore(Effect.try(() => { listener(new CustomEvent(type, { detail })); })));
      }
    },

  async init({ visible = true, name, os } = {}) {
    self.update({ visible: visible });
    const guess = await guessDevice();
    const storedId = await self.kv.get('deviceId');
    self.update({ deviceId: typeof storedId === 'string' ? storedId : '' });
    if (!self.deviceId) { self.update({ deviceId: randomId(8) }); await self.kv.put('deviceId', self.deviceId); }
    const storedName = await self.kv.get('deviceName');
    self.update({ deviceName: nonempty(typeof storedName === 'string' ? storedName : '') ?? nonempty(name) ?? guess.name });
    self.update({ os: nonempty(os) ?? guess.os });
    await self.kv.put('deviceName', self.deviceName);
    await self.kv.put('os', self.os);
    const pulled = Schema.decodeUnknownOption(Schema.Array(Schema.String))(await self.kv.get('pulledTids'));
    self.update({ _pulled: new Set(pulled._tag === 'Some' ? pulled.value : []) });
    for (const raw of await self.hubsStore.all()) {
      const decoded = Schema.decodeUnknownOption(HubSchema)(raw);
      if (decoded._tag === 'Some') { const rec = { ...decoded.value, addrs: [...decoded.value.addrs] }; self.update({ _hubs: new Map([...self._hubs, [rec.hubId, createHubClient(self, rec)]]) }); }
    }
    for (const raw of await self.queueStore.all()) {
      const decoded = Schema.decodeUnknownOption(QueueSchema)(raw);
      if (decoded._tag === 'Some' && ACTIVE.has(decoded.value.status ?? 'queued')) {
        const rec = decoded.value;
        self._track({ ...rec, files: [...rec.files], names: rec.names ? [...rec.names] : rec.files.map((file) => file.name), total: rec.total ?? sum(rec.files.map((file) => file.size)), createdAt: rec.createdAt ?? Date.now(), failed: [...(rec.failed ?? [])] }, Promise.resolve());
      }
    }
    for (const hub of self._hubs.values()) hub.start();
    self._emit('hubs', {});
    for (const t of self._transfers.values()) self._emit('transfer', self._snap(t));
    return self;
  },

  get hubs() { return [...self._hubs.values()]; },
  hub(hubId) { return self._hubs.get(hubId); },
  get transfers() { return [...self._transfers.values()].map((t) => self._snap(t)); },

  async setDeviceName(name) {
    const n = name.trim().slice(0, 40);
    if (!n || n === self.deviceName) return;
    self.update({ deviceName: n });
    await self.kv.put('deviceName', n);
    self.kick();   // re-sync now so the hub sees the new name
  },

  setVisible(visible) {
    self.update({ visible: visible });
    if (self.visible) self.kick();
  },

  kick() {
    const w = self._wake;
    self.update({ _wake: new AbortController() });
    w.abort();
    for (const hub of self._hubs.values()) {
      hub.syncBackoff.reset();
      hub.xferBackoff.reset();
      hub.update({ lastSweep: 0 });
      hub._syncCtl?.abort();
    }
  },

  stop() {
    for (const hub of self._hubs.values()) hub.stop();
    for (const t of self._transfers.values()) t.abort.abort();
  },

  async pair(input, { signal, onStatus } = {}) {
    const rec = await pairWithHub(input, {
      deviceId: self.deviceId, name: self.deviceName, os: self.os, fetch: self._fetch, signal,
      onStatus: (s) => { if (s === 'blocked') self._network(true); onStatus?.(s); },
    });
    self._network(false);
    self._hubs.get(rec.hubId)?.stop();
    await self.hubsStore.put(rec.hubId, rec);
    const hub = createHubClient(self, rec);
    hub.update({ addr: rec.lastAddr });
    self.update({ _hubs: new Map([...self._hubs, [rec.hubId, hub]]) });
    hub.start();
    hub._seen();
    self._emit('hubs', {});
    return hub;
  },

  send(hubId, files) {
    return runEffect(Effect.tryPromise({ try: async () => {
    const hub = self._hubs.get(hubId);
    if (!hub) throw new Error('Unknown computer');
    const list = [...files].map((f) => (f instanceof File ? f : new File([f], 'file', { type: f.type || '' })));
    if (!list.length) throw new Error('No files');
    const rec: QueueRecord = {
      tid: randomId(12), hubId, files: list, names: list.map((f) => f.name), total: sum(list.map((f) => f.size)),
      createdAt: Date.now(), failed: [],
    };
    // Persist so the transfer survives the app being killed; don't delay the start for it.
    const saved = self.queueStore.put(rec.tid, rec).catch((err: unknown) => { self._emit('warning', { message: `Could not save transfer: ${errorMessage(err)}` }); });
    const t = self._track(rec, saved);
    self._emit('transfer', self._snap(t));
    hub.pump();
    return await Promise.resolve(rec.tid);
    }, catch: (error) => error }));
  },

  async cancel(tid) {
    const t = self._transfers.get(tid);
    if (!t || !ACTIVE.has(t.status)) return;
    await self._drop(t);
    void self._hubs.get(t.hubId)?.call('cancel', { tid }, null, { timeout: 5000 }).catch(ignore);
  },

  async forget(hubId) {
    const hub = self._hubs.get(hubId);
    if (!hub) return;
    hub.update({ _forgetting: true });
    for (const t of [...self._transfers.values()]) if (t.hubId === hubId && ACTIVE.has(t.status)) await self._drop(t);
    try { await hub.request('unpair', {}, null, { timeout: 3000 }); } catch { /* best effort */ }
    hub.stop();
    self.update({ _hubs: new Map([...self._hubs].filter(([id]) => id !== hubId)) });
    await self.hubsStore.delete(hubId).catch(ignore);
    self._emit('hubs', {});
  },

  // ------------------------------------------------ internals

  _track(rec, saved) {
    const state = Effect.runSync(Ref.make<Pick<Transfer, 'files' | 'status' | 'failed' | 'acked' | 'rate' | 'error' | 'doneAt' | 'rec' | 'lastAt' | 'lastSent'>>({files: rec.files, status: 'queued', failed: [...rec.failed], acked: rec.files.map(() => 0), rate: 0, error: null, doneAt: 0, rec: rec, lastAt: 0, lastSent: 0}));
    const t: Transfer = {
    update: (patch) => Effect.runSync(Ref.updateAndGet(state, (current) => ({ ...current, ...patch }))),
      tid: rec.tid, hubId: rec.hubId, names: rec.names, total: rec.total, createdAt: rec.createdAt || Date.now(), abort: new AbortController(), saved,
      get files() { return Effect.runSync(Ref.get(state)).files; },
      get status() { return Effect.runSync(Ref.get(state)).status; },
      get failed() { return Effect.runSync(Ref.get(state)).failed; },
      get acked() { return Effect.runSync(Ref.get(state)).acked; },
      get rate() { return Effect.runSync(Ref.get(state)).rate; },
      get error() { return Effect.runSync(Ref.get(state)).error; },
      get doneAt() { return Effect.runSync(Ref.get(state)).doneAt; },
      get rec() { return Effect.runSync(Ref.get(state)).rec; },
      get lastAt() { return Effect.runSync(Ref.get(state)).lastAt; },
      get lastSent() { return Effect.runSync(Ref.get(state)).lastSent; },
    };
    self.update({ _transfers: new Map([...self._transfers, [t.tid, t]]) });
    return t;
  },

  _snap(t) {
    return Object.freeze({
      tid: t.tid, hubId: t.hubId, names: Object.freeze([...t.names]), total: t.total, sent: Math.min(t.total, sum(t.acked)),
      rate: t.rate, status: t.status, failed: Object.freeze([...t.failed]), error: t.error, createdAt: t.createdAt, doneAt: t.doneAt,
    });
  },

  _nextTransfer(hubId) {
    let best: Transfer | undefined;
    for (const t of self._transfers.values()) {
      if (t.hubId === hubId && ACTIVE.has(t.status) && (!best || t.createdAt < best.createdAt)) best = t;
    }
    return best;
  },

  _progress(t) {
    const sent = sum(t.acked);
    const now = Date.now();
    if (t.lastAt && sent > t.lastSent) {
      const inst = (sent - t.lastSent) / Math.max(0.001, (now - t.lastAt) / 1000);
      t.update({ rate: t.rate ? t.rate * 0.6 + inst * 0.4 : inst });
    }
    if (!t.lastAt || sent !== t.lastSent) { t.update({ lastAt: now }); t.update({ lastSent: sent }); }
    self._emit('transfer', self._snap(t));
  },

  async _failFile(t, i, err) {
    t.update({ failed: [...new Set([...t.failed, i])] });
    t.update({ acked: t.acked.map((acked, index) => index === i ? sum(t.files.slice(i, i + 1).map((file) => file.size)) : acked) });
    t.update({ error: `${t.names[i] ?? 'file'}: ${(err instanceof Error ? err.name : '') || 'read error'}` });
    t.update({ rec: { ...t.rec, failed: [...t.failed] } });
    await t.saved;
    await self.queueStore.put(t.tid, t.rec).catch(ignore);
    self._progress(t);
  },

  async _finish(t, status) {
    t.update({ status: status });
    t.update({ doneAt: Date.now() });
    t.update({ rate: 0 });
    t.update({ files: [] });
    t.update({ rec: { ...t.rec, files: [] } });
    await t.saved;
    await self.queueStore.delete(t.tid).catch(ignore);
    self._emit('transfer', self._snap(t));
  },

  /** Cancel locally: abort, forget the persisted record. Returns the files not yet failed. */
  async _drop(t) {
    const files = t.files.filter((_, i) => !t.failed.includes(i));
    t.update({ status: 'cancelled' });
    t.abort.abort();
    t.update({ doneAt: Date.now() });
    t.update({ files: [] });
    t.update({ rec: { ...t.rec, files: [] } });
    await t.saved;
    await self.queueStore.delete(t.tid).catch(ignore);
    self._emit('transfer', self._snap(t));
    return files;
  },

  async _unpaired(hub, reason) {
    if (hub.stopped || hub._forgetting) return;
    hub.stop();
    self.update({ _hubs: new Map([...self._hubs].filter(([id]) => id !== hub.id)) });
    await self.hubsStore.delete(hub.id).catch(ignore);
    const files: File[] = [];
    for (const t of [...self._transfers.values()]) {
      if (t.hubId === hub.id && ACTIVE.has(t.status)) files.push(...await self._drop(t));
    }
    self._emit('unpaired', { hubId: hub.id, name: hub.name, reason, files });
    self._emit('hubs', {});
  },

  async _markPulled(tid) {
    self.update({ _pulled: new Set([...self._pulled, tid]) });
    const list = [...self._pulled].slice(-100);
    self.update({ _pulled: new Set(list) });
    await self.kv.put('pulledTids', list).catch(ignore);
  },

  _busy(delta) {
    const was = self._busyCount > 0;
    self.update({ _busyCount: Math.max(0, self._busyCount + delta) });
    if (was !== self._busyCount > 0) self._emit('busy', { busy: self._busyCount > 0 });
  },

  _network(blocked) {
    if (self._blocked === blocked) return;
    self.update({ _blocked: blocked });
    self._emit('network', { blocked });
  },
  };
  const hubView = (hub: HubRuntime): HubClient => Object.freeze({
    get id() { return hub.id; }, get name() { return hub.name; }, get status() { return hub.status; },
    get addr() { return hub.addr; }, get lastSeen() { return hub.lastSeen; },
    get rec() { return Object.freeze({ ...hub.rec, addrs: Object.freeze([...hub.rec.addrs]) }); },
  });
  const view: ShareEngine = Object.freeze({
    get visible() { return self.visible; }, get deviceId() { return self.deviceId; }, get deviceName() { return self.deviceName; }, get os() { return self.os; },
    get hubs() { return Object.freeze(self.hubs.map(hubView)); }, get transfers() { return Object.freeze(self.transfers); },
    addEventListener: self.addEventListener, removeEventListener: self.removeEventListener,
    init: async (options?: InitOptions) => { await self.init(options); return view; },
    hub: (id: string) => { const hub = self.hub(id); return hub === undefined ? undefined : hubView(hub); },
    setDeviceName: self.setDeviceName, setVisible: self.setVisible, kick: self.kick, stop: self.stop,
    pair: async (input: PairInput, options?: PairOptions) => hubView(await self.pair(input, options)),
    send: self.send, cancel: self.cancel, forget: self.forget,
  });
  return view;
}
