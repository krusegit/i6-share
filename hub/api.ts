/** Hub protocol with immutable snapshots, Effect I/O, and injected browser boundaries. */
import { Effect, Option, Ref, Semaphore } from 'effect';
import {
  PORT, PROTOCOL_VERSION, CHUNK_SIZE, SYNC_WAIT_MS, PAIR_TOKEN_TTL_MS, APP_URL,
  randomBytes, randomId, b64url, unb64url, pairKey, deviceKey, seal, open,
  requestAad, responseAad, encodePairPayload, pairLink, cleanFileName,
} from '../public/lib/proto.js';
import { runEffect } from '../public/lib/runtime.js';
import type {
  Device, DeviceSummary, FileMetadata, HubApi, HubApiOptions, HubEvents, HubRequest, HubResponse,
  HubSinkHandle, OutboxSummary, TransferSummary,
} from './api-types.js';
export type * from './api-types.js';

export const ONLINE_MS = 40_000;
export const PARTIAL_TTL_MS = 60 * 60 * 1000;
const LOG_KEY = 'transferLog';
const HEX16 = /^[0-9a-f]{16}$/;
const TID_RE = /^[0-9a-f]{24}$/;
const OPS = ['sync', 'offer', 'put', 'end', 'cancel', 'pull', 'pulled', 'unpair'] as const;
type Operation = typeof OPS[number];
type Json = Readonly<Record<string, unknown>>;
interface ApiFailure { readonly _tag: 'ApiFailure'; readonly status: number; readonly code: string }
interface Reply { readonly json: Json; readonly binary?: Uint8Array<ArrayBuffer> }
interface Token { readonly token: Uint8Array<ArrayBuffer>; readonly expiresAt: number; readonly usedBy: string | null }
interface FileState extends FileMetadata {
  readonly saveName: string;
  readonly bytes: number;
  readonly done: boolean;
  readonly handle: HubSinkHandle | null;
  readonly where: string | null;
  readonly semaphore: Semaphore.Semaphore;
}
interface Transfer {
  readonly key: string;
  readonly tid: string;
  readonly deviceId: string;
  readonly deviceName: string;
  readonly createdAt: number;
  readonly lastActivity: number;
  readonly complete: boolean;
  readonly cancelled: boolean;
  readonly speed: number;
  readonly rateT: number;
  readonly rateB: number;
  readonly files: readonly FileState[];
  readonly ready: Promise<void>;
}
interface Outgoing {
  readonly tid: string;
  readonly deviceId: string;
  readonly files: readonly File[];
  readonly createdAt: number;
}
interface OutState { readonly sent: number; readonly speed: number; readonly rateT: number; readonly rateB: number }
interface Saved {
  readonly key: string;
  readonly at: number;
  readonly sizes: readonly number[];
  readonly names: readonly string[];
  readonly saved: readonly boolean[];
  readonly where: readonly (string | null)[];
}
interface State {
  readonly hubId: string;
  readonly name: string;
  readonly devices: ReadonlyMap<string, Device>;
  readonly tokens: readonly Token[];
  readonly transfers: ReadonlyMap<string, Transfer>;
  readonly outbox: ReadonlyMap<string, Outgoing>;
  readonly outState: ReadonlyMap<string, OutState>;
  readonly reserved: ReadonlySet<string>;
  readonly log: readonly Saved[];
  readonly seenPersisted: ReadonlyMap<string, number>;
  readonly waiters: ReadonlyMap<string, ReadonlySet<() => void>>;
  readonly timer: ReturnType<typeof setInterval> | undefined;
}
const put = <A>(map: ReadonlyMap<string, A>, key: string, value: A): ReadonlyMap<string, A> => new Map([...map, [key, value]]);
const remove = <A>(map: ReadonlyMap<string, A>, key: string): ReadonlyMap<string, A> => new Map([...map].filter(([k]) => k !== key));
const without = (set: ReadonlySet<string>, value: string): ReadonlySet<string> => new Set([...set].filter((entry) => entry !== value));
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !isArray(value);
const isArray = (value: unknown): value is readonly unknown[] => Array.isArray(value);
const isIndex = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const cleanText = (value: unknown, max: number): string => typeof value === 'string' ? value.replace(/./gsu, (char) => char < ' ' || char === String.fromCharCode(127) ? ' ' : char).trim().slice(0, max) : '';
const number = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const failure = (status: number, code: string): ApiFailure => ({ _tag: 'ApiFailure', status, code });
const bad = (): ApiFailure => failure(400, 'bad-request');
const isFailure = (value: unknown): value is ApiFailure => isObject(value) && value['_tag'] === 'ApiFailure' && typeof value['status'] === 'number' && typeof value['code'] === 'string';
const json = (status: number, body: unknown): HubResponse => ({ status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const fail = (status: number, code: string): HubResponse => json(status, { error: code });
const io = <A>(work: () => Promise<A>): Effect.Effect<A, unknown> => Effect.tryPromise({ try: work, catch: (error: unknown) => error });
const ignore = <A>(work: Effect.Effect<A, unknown>): Effect.Effect<void> => Effect.asVoid(Effect.catch(work, () => Effect.void));
const tidOf = (data: Json): Effect.Effect<string, ApiFailure> => typeof data['tid'] === 'string' && TID_RE.test(data['tid']) ? Effect.succeed(data['tid']) : Effect.fail(bad());
const fileMeta = (value: unknown): FileMetadata | null => {
  if (!isObject(value) || !isIndex(value['size'])) return null;
  if (value['name'] != null && typeof value['name'] !== 'string') return null;
  return { name: cleanText(value['name'], 1000) || 'file', size: value['size'], type: typeof value['type'] === 'string' ? value['type'].slice(0, 200) : '', lastModified: number(value['lastModified']) };
};
const readDevice = (value: unknown): Device | null => {
  if (!isObject(value) || typeof value['deviceId'] !== 'string' || !HEX16.test(value['deviceId']) || typeof value['secret'] !== 'string') return null;
  return { deviceId: value['deviceId'], secret: value['secret'], name: cleanText(value['name'], 60) || 'Phone', os: cleanText(value['os'], 40), pairedAt: number(value['pairedAt']), lastSeen: number(value['lastSeen']), lastAddr: cleanText(value['lastAddr'], 200) };
};
const readOutgoing = (value: unknown): Outgoing | null => {
  if (!isObject(value) || typeof value['tid'] !== 'string' || typeof value['deviceId'] !== 'string' || !isArray(value['files']) || value['files'].length === 0) return null;
  const files: readonly unknown[] = value['files'];
  if (!files.every((file): file is File => file instanceof File)) return null;
  return { tid: value['tid'], deviceId: value['deviceId'], files, createdAt: number(value['createdAt']) };
};
const readSaved = (value: unknown): Saved | null => {
  if (!isObject(value) || typeof value['key'] !== 'string') return null;
  const sizes: unknown = value['sizes']; const names: unknown = value['names']; const saved: unknown = value['saved']; const where: unknown = value['where'];
  if (!isArray(sizes) || !sizes.every(isIndex) || !isArray(names) || !names.every((name: unknown): name is string => typeof name === 'string') || !isArray(saved) || !saved.every((done: unknown): done is boolean => typeof done === 'boolean')) return null;
  const locations: readonly (string | null)[] = isArray(where) ? where.map((entry: unknown) => typeof entry === 'string' ? entry : null) : [];
  return { key: value['key'], at: number(value['at']), sizes, names, saved, where: locations };
};
const summaryDevice = (device: Device, online: boolean): DeviceSummary => ({ deviceId: device.deviceId, name: device.name, os: device.os, pairedAt: device.pairedAt, lastSeen: device.lastSeen, lastAddr: device.lastAddr, online });
const outMeta = (file: File): FileMetadata => ({ name: file.name || 'file', size: file.size, type: file.type, lastModified: file.lastModified });
const ROOT_PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>i6-share Hub</title><body style="font:16px system-ui,sans-serif;margin:2em"><h1>i6-share Hub</h1><p>This computer receives files with i6-share.</p><p>On your phone, open <a href="${APP_URL}">${APP_URL}</a>, install it and scan the pairing QR code shown in the hub window.</p>`;

export const createHubApi = ({ storage, sink, getAddrs = () => [], port = PORT, now = Date.now, partialTtlMs = PARTIAL_TTL_MS, sweepIntervalMs = 300_000 }: HubApiOptions): HubApi => {
  const ref = Effect.runSync(Ref.make<State>({ hubId: '', name: 'Linux PC', devices: new Map(), tokens: [], transfers: new Map(), outbox: new Map(), outState: new Map(), reserved: new Set(), log: [], seenPersisted: new Map(), waiters: new Map(), timer: undefined }));
  const state = (): State => Effect.runSync(Ref.get(ref));
  const edit = (update: (current: State) => State): void => { Effect.runSync(Ref.update(ref, update)); };
  const events = new EventTarget();
  interface Channel<A> { readonly emit: (detail: A) => void; readonly on: (listener: (detail: A) => void) => () => void }
  const channel = <A>(): Channel<A> => {
    const listeners = Effect.runSync(Ref.make<ReadonlySet<(detail: A) => void>>(new Set()));
    return {
      emit: (detail) => { Effect.runSync(Ref.get(listeners)).forEach((listener) => { Effect.runSync(Effect.try(() => { listener(detail); }).pipe(Effect.ignore)); }); },
      on: (listener) => {
        Effect.runSync(Ref.update(listeners, (current) => new Set([...current, listener])));
        return () => { Effect.runSync(Ref.update(listeners, (current) => new Set([...current].filter((entry) => entry !== listener)))); };
      },
    };
  };
  const channels: { readonly [K in keyof HubEvents]: Channel<HubEvents[K]> } = {
    'device-paired': channel(), 'device-seen': channel(), 'device-updated': channel(), 'device-unpaired': channel(), 'pair-code-used': channel(),
    'transfer-start': channel(), 'transfer-progress': channel(), 'transfer-complete': channel(), 'transfer-cancelled': channel(), 'file-saved': channel(),
    'outbox-added': channel(), 'outbox-progress': channel(), 'outbox-delivered': channel(), 'outbox-removed': channel(), 'sink-error': channel(), error: channel(),
  };
  const emit = <K extends keyof HubEvents>(type: K, detail: HubEvents[K]): void => {
    channels[type].emit(detail);
    events.dispatchEvent(new CustomEvent(type, { detail }));
  };
  const errorEvent = (error: unknown): Effect.Effect<void> => Effect.sync(() => { emit('error', { error }); });
  const persistDevice = (device: Device): Effect.Effect<void> => Effect.gen(function* () {
    edit((s) => ({ ...s, seenPersisted: put(s.seenPersisted, device.deviceId, now()) }));
    yield* io(() => storage.devices.put(device.deviceId, device)).pipe(Effect.catch(errorEvent));
  });
  const setDevice = (device: Device): void => { edit((s) => ({ ...s, devices: put(s.devices, device.deviceId, device) })); };
  const transferAt = (key: string): Transfer => Option.getOrThrow(Option.fromUndefinedOr(state().transfers.get(key)));
  const setTransfer = (transfer: Transfer): void => { edit((s) => ({ ...s, transfers: put(s.transfers, transfer.key, transfer) })); };
  const alterTransfer = (key: string, update: (transfer: Transfer) => Transfer): void => { edit((s) => {
    const transfer = Option.getOrThrow(Option.fromUndefinedOr(s.transfers.get(key)));
    return { ...s, transfers: put(s.transfers, key, update(transfer)) };
  }); };
  const alterFile = (key: string, index: number, update: (file: FileState) => FileState): void => { alterTransfer(key, (transfer) => ({ ...transfer, files: transfer.files.map((file, i) => i === index ? update(file) : file) })); };
  const addrs = (): readonly string[] => Effect.runSync(Effect.try(() => [...new Set(getAddrs())]).pipe(Effect.catch(() => Effect.succeed([]))));
  const hello = (): ReturnType<HubApi['hello']> => ({ app: 'i6-share-hub', v: PROTOCOL_VERSION, id: state().hubId, name: state().name, port, addrs: addrs() });
  const summary = (transfer: Transfer): TransferSummary => ({
    tid: transfer.tid, deviceId: transfer.deviceId, deviceName: state().devices.get(transfer.deviceId)?.name ?? transfer.deviceName,
    files: transfer.files.map((file) => ({ name: file.saveName, originalName: file.name, size: file.size, type: file.type, bytes: file.bytes, done: file.done, where: file.where })),
    count: transfer.files.length, done: transfer.files.filter((file) => file.done).length, bytes: transfer.files.reduce((sum, file) => sum + file.bytes, 0), total: transfer.files.reduce((sum, file) => sum + file.size, 0),
    complete: transfer.complete, speed: transfer.speed, createdAt: transfer.createdAt, lastActivity: transfer.lastActivity,
  });
  const outSummary = (item: Outgoing): OutboxSummary => {
    const progress = state().outState.get(item.tid);
    const total = item.files.reduce((sum, file) => sum + file.size, 0);
    return { tid: item.tid, deviceId: item.deviceId, createdAt: item.createdAt, files: item.files.map(outMeta), count: item.files.length, bytes: Math.min(total, progress?.sent ?? 0), total, speed: progress?.speed ?? 0, started: progress !== undefined };
  };
  const wake = (deviceId: string): void => { state().waiters.get(deviceId)?.forEach((done) => { done(); }); };
  const waitFor = (deviceId: string, ms: number): Effect.Effect<void> => Effect.callback<undefined>((resume) => {
    const done = (): void => { cleanup(); resume(Effect.succeed(undefined)); };
    const timer = setTimeout(done, ms);
    const cleanup = (): void => {
      clearTimeout(timer);
      edit((s) => {
        const remaining = new Set([...Option.getOrThrow(Option.fromUndefinedOr(s.waiters.get(deviceId)))].filter((waiter) => waiter !== done));
        return { ...s, waiters: remaining.size === 0 ? remove(s.waiters, deviceId) : put(s.waiters, deviceId, remaining) };
      });
    };
    edit((s) => ({ ...s, waiters: put(s.waiters, deviceId, new Set([...(s.waiters.get(deviceId) ?? []), done])) }));
    return Effect.sync(cleanup);
  });
  const uniqueName = (name: string): Effect.Effect<string> => Effect.gen(function* () {
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    const find = (index: number): Effect.Effect<string> => Effect.gen(function* () {
      const candidate = index === 0 ? name : `${base} (${String(index)})${ext}`;
      if (index >= 1000) return `${base} (${randomId(4)})${ext}`;
      if (state().reserved.has(candidate)) return yield* find(index + 1);
      const exists = yield* io(() => sink.exists(candidate)).pipe(Effect.catch(() => Effect.succeed(false)));
      if (exists || state().reserved.has(candidate)) return yield* find(index + 1);
      return candidate;
    });
    const nameToSave = yield* find(0);
    edit((s) => ({ ...s, reserved: new Set([...s.reserved, nameToSave]) }));
    return nameToSave;
  });
  const currentFile = (key: string, index: number): Effect.Effect<FileState, ApiFailure> => {
    const transfer = state().transfers.get(key);
    const file = transfer?.files[index];
    return !transfer || transfer.cancelled ? Effect.fail(failure(404, 'not-found')) : file ? Effect.succeed(file) : Effect.fail(bad());
  };
  const resetFile = (key: string, index: number, file: FileState, error: unknown): Effect.Effect<void> => Effect.gen(function* () {
    alterFile(key, index, (current) => ({ ...current, handle: null, bytes: 0, done: false }));
    if (file.handle) { const handle = file.handle; yield* ignore(io(() => handle.abort())); }
    emit('sink-error', { error, name: file.saveName });
  });
  const logSaved = (transfer: Transfer): Effect.Effect<void> => Effect.gen(function* () {
    const at = now();
    const record: Saved = { key: transfer.key, at, sizes: transfer.files.map((file) => file.size), names: transfer.files.map((file) => file.saveName), saved: transfer.files.map((file) => file.done), where: transfer.files.map((file) => file.where) };
    edit((s) => ({ ...s, log: [...s.log.filter((entry) => entry.key !== transfer.key && at - entry.at < 7 * 24 * 3600_000), record].slice(-300) }));
    yield* io(() => storage.kv.put(LOG_KEY, state().log)).pipe(Effect.catch(errorEvent));
  });
  const finalize = (key: string, index: number): Effect.Effect<void, unknown> => Effect.gen(function* () {
    const file = yield* currentFile(key, index);
    const close = Effect.gen(function* () {
      const handle = file.handle ?? (yield* io(() => sink.create(file.saveName, file)));
      alterFile(key, index, (current) => ({ ...current, handle, where: handle.where ?? null }));
      yield* io(() => handle.close());
      alterFile(key, index, (current) => ({ ...current, handle: null, done: true }));
      edit((s) => ({ ...s, reserved: without(s.reserved, file.saveName) }));
    });
    yield* close.pipe(Effect.catch((error) => Effect.gen(function* () { yield* resetFile(key, index, yield* currentFile(key, index), error); return yield* Effect.fail(failure(500, 'internal')); })));
    const transfer = transferAt(key);
    yield* logSaved(transfer);
    const saved = Option.getOrThrow(Option.fromUndefinedOr(transfer.files[index]));
      emit('file-saved', { tid: transfer.tid, deviceId: transfer.deviceId, deviceName: state().devices.get(transfer.deviceId)?.name ?? transfer.deviceName, name: file.saveName, originalName: file.name, size: file.size, type: file.type, where: saved.where, at: now() });
  });
  const checkComplete = (key: string): void => {
    const transfer = state().transfers.get(key);
    if (!transfer || transfer.complete || !transfer.files.every((file) => file.done)) return;
    const complete = { ...transfer, complete: true };
    setTransfer(complete);
    emit('transfer-complete', { transfer: summary(complete) });
  };
  const progress = (key: string): void => {
    const transfer = transferAt(key);
    const time = now(); const bytes = transfer.files.reduce((sum, file) => sum + file.bytes, 0); const dt = time - transfer.rateT;
    const instant = dt >= 500 ? Math.max(0, bytes - transfer.rateB) * 1000 / dt : 0;
    const next = dt >= 500 ? { ...transfer, speed: transfer.speed === 0 ? instant : transfer.speed * 0.6 + instant * 0.4, rateT: time, rateB: bytes } : transfer;
    setTransfer(next);
    emit('transfer-progress', { transfer: summary(next) });
  };
  const discard = (transfer: Transfer, reason: string): Effect.Effect<void> => Effect.gen(function* () {
    if (state().transfers.get(transfer.key)?.cancelled !== false) return;
    alterTransfer(transfer.key, (current) => ({ ...current, cancelled: true }));
    yield* ignore(io(() => transfer.ready));
    yield* Effect.forEach(transfer.files, (file, index) => file.semaphore.withPermits(1)(Effect.gen(function* () {
      const current = state().transfers.get(transfer.key)?.files[index];
      if (!current || current.done) return;
      if (current.handle) { const handle = current.handle; yield* ignore(io(() => handle.abort())); }
      edit((s) => ({ ...s, reserved: without(s.reserved, current.saveName) }));
    })), { discard: true });
    const last = transferAt(transfer.key);
    edit((s) => ({ ...s, transfers: remove(s.transfers, transfer.key) }));
    if (!last.complete) emit('transfer-cancelled', { transfer: summary(last), reason });
  });
  const forget = (deviceId: string, reason: string): Effect.Effect<boolean> => Effect.gen(function* () {
    const device = state().devices.get(deviceId);
    if (!device) return false;
    edit((s) => ({ ...s, devices: remove(s.devices, deviceId), seenPersisted: remove(s.seenPersisted, deviceId) }));
    yield* ignore(io(() => storage.devices.delete(deviceId)));
    yield* Effect.forEach([...state().transfers.values()].filter((transfer) => transfer.deviceId === deviceId), (transfer) => discard(transfer, 'unpaired'), { discard: true });
    yield* Effect.forEach([...state().outbox.values()].filter((item) => item.deviceId === deviceId), (item) => Effect.gen(function* () {
      edit((s) => ({ ...s, outbox: remove(s.outbox, item.tid), outState: remove(s.outState, item.tid) }));
      yield* ignore(io(() => storage.queue.delete(item.tid)));
    }), { discard: true });
    wake(deviceId);
    emit('device-unpaired', { deviceId, name: device.name, reason });
    return true;
  });
  const offer = (device: Device, data: Json): Effect.Effect<Reply, unknown> => Effect.gen(function* () {
    const tid = yield* tidOf(data);
    const rawFiles: unknown = data['files'];
    if (!isArray(rawFiles) || rawFiles.length === 0 || rawFiles.length > 10_000) return yield* Effect.fail(bad());
    const metas = rawFiles.map((file: unknown) => fileMeta(file));
    if (!metas.every((meta): meta is FileMetadata => meta !== null)) return yield* Effect.fail(bad());
    const key = `${device.deviceId}:${tid}`;
    const existing = state().transfers.get(key);
    if (existing) {
      yield* io(() => existing.ready);
      const current = transferAt(key);
      if (current.files.length !== metas.length || current.files.some((file, index) => file.size !== metas[index]?.size)) return yield* Effect.fail(bad());
      alterTransfer(key, (transfer) => ({ ...transfer, lastActivity: now() }));
      yield* Effect.forEach(current.files, (file, index) => !file.done && file.size === 0 ? file.semaphore.withPermits(1)(finalize(key, index)) : Effect.void, { discard: true });
      checkComplete(key);
      return { json: { received: current.files.map((file) => file.bytes) } };
    }
    const record = state().log.find((entry) => entry.key === key);
    const prior = record?.sizes.length === metas.length && record.sizes.every((size, index) => size === metas[index]?.size) ? record : undefined;
    const files = yield* Effect.forEach(metas, (meta, index) => Effect.map(Semaphore.make(1), (semaphore): FileState => ({ ...meta, saveName: prior?.names[index] ?? '', bytes: prior?.saved[index] === true ? meta.size : 0, done: prior?.saved[index] === true, handle: null, where: prior?.where[index] ?? null, semaphore })));
    const time = now();
    const transfer: Transfer = { key, tid, deviceId: device.deviceId, deviceName: device.name, createdAt: time, lastActivity: time, complete: files.every((file) => file.done), cancelled: false, speed: 0, rateT: time, rateB: files.reduce((sum, file) => sum + file.bytes, 0), files, ready: Promise.resolve() };
    setTransfer(transfer);
    if (transfer.complete) return { json: { received: files.map((file) => file.bytes) } };
    const ready = runEffect(Effect.forEach(files, (file, index) => Effect.gen(function* () {
      if (file.done) return;
      const name = yield* uniqueName(cleanFileName(file.name));
      alterFile(key, index, (current) => ({ ...current, saveName: name }));
    }), { discard: true }));
    alterTransfer(key, (current) => ({ ...current, ready }));
    yield* io(() => ready);
    const prepared = transferAt(key);
    emit('transfer-start', { transfer: summary(prepared) });
    yield* Effect.forEach(prepared.files, (file, index) => !file.done && file.size === 0 ? file.semaphore.withPermits(1)(finalize(key, index)) : Effect.void, { discard: true });
    checkComplete(key);
    return { json: { received: transferAt(key).files.map((file) => file.bytes) } };
  });
  const putFile = (device: Device, data: Json, binary: Uint8Array<ArrayBuffer>): Effect.Effect<Reply, unknown> => Effect.gen(function* () {
    const tid = yield* tidOf(data); const index = data['i']; const offset = data['offset'];
    if (!isIndex(index) || !isIndex(offset)) return yield* Effect.fail(bad());
    if (binary.length > CHUNK_SIZE) return yield* Effect.fail(failure(413, 'too-large'));
    const key = `${device.deviceId}:${tid}`; const transfer = state().transfers.get(key);
    if (!transfer) return yield* Effect.fail(failure(404, 'not-found'));
    yield* io(() => transfer.ready);
    const original = yield* currentFile(key, index);
    return yield* original.semaphore.withPermits(1)(Effect.gen(function* () {
      const file = yield* currentFile(key, index);
      if (offset !== file.bytes) return { json: { error: 'offset', bytes: file.bytes } };
      if (file.done) return { json: { bytes: file.bytes } };
      if (binary.length === 0) {
        if (file.size === 0) { yield* finalize(key, index); checkComplete(key); }
        return { json: { bytes: file.bytes } };
      }
      if (file.bytes + binary.length > file.size) return yield* Effect.fail(bad());
      alterTransfer(key, (current) => ({ ...current, lastActivity: now() }));
      const write = Effect.gen(function* () {
        const handle = file.handle ?? (yield* io(() => sink.create(file.saveName, file)));
        alterFile(key, index, (current) => ({ ...current, handle, where: handle.where ?? null }));
        yield* io(() => handle.write(binary));
      });
      yield* write.pipe(Effect.catch((error) => Effect.gen(function* () { yield* resetFile(key, index, yield* currentFile(key, index), error); return yield* Effect.fail(failure(500, 'internal')); })));
      alterFile(key, index, (current) => ({ ...current, bytes: current.bytes + binary.length }));
      if (file.bytes + binary.length === file.size) yield* finalize(key, index);
      progress(key); checkComplete(key);
      return { json: { bytes: (yield* currentFile(key, index)).bytes } };
    }));
  });
  const pull = (device: Device, data: Json): Effect.Effect<Reply, unknown> => Effect.gen(function* () {
    const tid = yield* tidOf(data); const index = data['i']; const offset = data['offset']; const length = data['length'];
    if (!isIndex(index) || !isIndex(offset) || !isIndex(length) || length > CHUNK_SIZE) return yield* Effect.fail(bad());
    const item = state().outbox.get(tid);
    if (item?.deviceId !== device.deviceId) return yield* Effect.fail(failure(404, 'not-found'));
    const file = item.files[index];
    if (!file || offset > file.size) return yield* Effect.fail(bad());
    const binary = new Uint8Array(yield* io(() => file.slice(offset, Math.min(file.size, offset + length)).arrayBuffer()));
    const before = item.files.slice(0, index).reduce((sum, entry) => sum + entry.size, 0); const time = now();
    const old = state().outState.get(tid) ?? { sent: 0, speed: 0, rateT: time, rateB: before + offset };
    const sent = before + offset + binary.length; const dt = time - old.rateT;
    const instant = dt >= 500 ? Math.max(0, sent - old.rateB) * 1000 / dt : 0;
    const next: OutState = dt >= 500 ? { sent, speed: old.speed === 0 ? instant : old.speed * 0.6 + instant * 0.4, rateT: time, rateB: sent } : { ...old, sent };
    edit((s) => ({ ...s, outState: put(s.outState, tid, next) }));
    emit('outbox-progress', { item: outSummary(item) });
    return { json: { size: file.size }, binary };
  });
  const operate = (op: Operation, device: Device, data: Json, binary: Uint8Array<ArrayBuffer>): Effect.Effect<Reply, unknown> => Effect.gen(function* () {
    switch (op) {
      case 'offer': return yield* offer(device, data);
      case 'put': return yield* putFile(device, data, binary);
      case 'pull': return yield* pull(device, data);
      case 'unpair': yield* forget(device.deviceId, 'unpaired'); return { json: { ok: true } };
      case 'sync': {
        const name = typeof data['name'] === 'string' ? cleanText(data['name'], 60) || device.name : device.name;
        const os = typeof data['os'] === 'string' ? cleanText(data['os'], 40) : device.os;
        if (name !== device.name || os !== device.os) {
          const next = { ...device, name, os }; setDevice(next); yield* persistDevice(next);
          emit('device-updated', { device: summaryDevice(next, true) });
        }
        const wait = Math.max(0, Math.min(SYNC_WAIT_MS, Math.floor(number(data['wait']))));
        if (wait > 0 && ![...state().outbox.values()].some((item) => item.deviceId === device.deviceId)) yield* waitFor(device.deviceId, wait);
        const current = state().devices.get(device.deviceId);
        if (!current) return yield* Effect.fail(failure(401, 'unknown-device'));
        setDevice({ ...current, lastSeen: now() });
        return { json: { name: state().name, addrs: addrs(), outbox: [...state().outbox.values()].filter((item) => item.deviceId === device.deviceId).map((item) => ({ tid: item.tid, files: item.files.map(outMeta) })) } };
      }
      case 'end': {
        const key = `${device.deviceId}:${yield* tidOf(data)}`; const transfer = state().transfers.get(key);
        if (transfer) { yield* io(() => transfer.ready); alterTransfer(key, (current) => ({ ...current, lastActivity: now() })); return { json: { ok: transferAt(key).files.every((file) => file.done) } }; }
        const record = state().log.find((entry) => entry.key === key);
        return record ? { json: { ok: record.saved.every(Boolean) } } : yield* Effect.fail(failure(404, 'not-found'));
      }
      case 'cancel': {
        const transfer = state().transfers.get(`${device.deviceId}:${yield* tidOf(data)}`);
        if (transfer) yield* discard(transfer, 'cancel');
        return { json: { ok: true } };
      }
      case 'pulled': {
        const tid = yield* tidOf(data); const item = state().outbox.get(tid);
        if (item?.deviceId === device.deviceId) {
          const old = state().outState.get(tid);
          if (old) edit((s) => ({ ...s, outState: put(s.outState, tid, { ...old, sent: item.files.reduce((sum, file) => sum + file.size, 0) }) }));
          const completed = outSummary(item);
          edit((s) => ({ ...s, outbox: remove(s.outbox, tid), outState: remove(s.outState, tid) }));
          yield* ignore(io(() => storage.queue.delete(tid)));
          emit('outbox-delivered', { item: completed });
        }
        return { json: { ok: true } };
      }
    }
  });
  const pair = (hubId: string | null, body: Uint8Array<ArrayBuffer>, request: HubRequest): Effect.Effect<HubResponse, unknown> => Effect.gen(function* () {
    if (hubId !== state().hubId) return fail(401, 'bad-auth');
    if (body.length > 64 * 1024) return fail(413, 'too-large');
    const candidates = [...state().tokens].reverse().filter((token) => token.expiresAt > now());
    const attempt = (index: number): Effect.Effect<HubResponse, unknown> => Effect.gen(function* () {
      const token = candidates[index];
      if (!token) return fail(401, 'bad-auth');
      const decrypted = yield* io(async () => { const key = await pairKey(token.token, state().hubId); return { key, message: await open(key, requestAad('pair', 'pair'), body) }; }).pipe(Effect.option);
      if (decrypted._tag === 'None') return yield* attempt(index + 1);
      const { key, message } = decrypted.value; const data = message.json;
      if (typeof data['deviceId'] !== 'string' || !HEX16.test(data['deviceId'])) return fail(400, 'bad-request');
      const deviceId = data['deviceId'];
      // Read current token use after decryption: concurrent requests cannot consume one QR twice.
      const usedBy = state().tokens.find((entry) => entry.token === token.token)?.usedBy;
      if (usedBy != null && usedBy !== deviceId) return fail(401, 'bad-auth');
      const existing = state().devices.get(deviceId);
      const device: Device = usedBy === deviceId && existing ? existing : { deviceId, name: cleanText(data['name'], 60) || 'Phone', os: cleanText(data['os'], 40), secret: b64url(randomBytes(32)), pairedAt: now(), lastSeen: now(), lastAddr: request.remoteAddress ?? '' };
      if (device !== existing) {
        edit((s) => ({ ...s, devices: put(s.devices, deviceId, device), tokens: s.tokens.map((entry) => entry.token === token.token ? { ...entry, usedBy: deviceId } : entry) }));
        yield* persistDevice(device);
        emit('device-paired', { device: summaryDevice(device, true) }); emit('pair-code-used', { deviceId, name: device.name });
      }
      const response = yield* io(() => seal(key, responseAad('pair', message.iv), { secret: device.secret, hubId: state().hubId, name: state().name }));
      return { status: 200, headers: { 'Content-Type': 'application/octet-stream' }, body: response.body };
    });
    return yield* attempt(0);
  });
  const handle = (request: HubRequest): Effect.Effect<HubResponse> => Effect.gen(function* () {
    if (request.method === 'GET' && (request.path === '/' || request.path === '/index.html')) return { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: ROOT_PAGE };
    if ((request.method === 'GET' || request.method === 'POST') && request.path === '/i6/hello') return json(200, hello());
    const op = /^\/i6\/([a-z]{1,16})$/u.exec(request.path)?.[1];
    if (op === undefined || request.method !== 'POST') return fail(404, 'not-found');
    const query = new URLSearchParams(request.query); const body = request.body ?? new Uint8Array();
    if (op === 'pair') return yield* pair(query.get('h'), body, request);
    const operation = OPS.find((entry) => entry === op);
    if (!operation) return fail(404, 'not-found');
    const deviceId = query.get('d') ?? '';
    if (!HEX16.test(deviceId)) return fail(400, 'bad-request');
    const device = state().devices.get(deviceId);
    if (!device) return fail(401, 'unknown-device');
    const decrypted = yield* io(async () => { const key = await deviceKey(unb64url(device.secret), deviceId); return { key, message: await open(key, requestAad(op, deviceId), body) }; }).pipe(Effect.option);
    if (decrypted._tag === 'None') return fail(401, 'bad-auth');
    const { key, message } = decrypted.value; const data = message.json;
    // A revoke/re-pair during crypto work must invalidate the old session.
    if (state().devices.get(deviceId)?.secret !== device.secret) return fail(401, 'unknown-device');
    const updated = { ...device, lastSeen: now(), lastAddr: request.remoteAddress ?? device.lastAddr };
    setDevice(updated);
    if (now() - (state().seenPersisted.get(deviceId) ?? 0) > 60_000) yield* persistDevice(updated);
    emit('device-seen', { device: summaryDevice(updated, true) });
    const reply = yield* operate(operation, updated, data, message.binary);
    const response = yield* io(() => seal(key, responseAad(op, message.iv), reply.json, reply.binary));
    return { status: 200, headers: { 'Content-Type': 'application/octet-stream' }, body: response.body };
  }).pipe(Effect.catch((error) => {
    if (isFailure(error)) return Effect.succeed(fail(error.status, error.code));
    return Effect.as(errorEvent(error), fail(500, 'internal'));
  }));
  const sweep = (): Effect.Effect<void> => Effect.gen(function* () {
    const time = now();
    edit((s) => ({ ...s, tokens: s.tokens.filter((token) => token.expiresAt > time) }));
    yield* Effect.forEach([...state().transfers.values()].filter((transfer) => !transfer.cancelled && time - transfer.lastActivity > partialTtlMs), (transfer) => transfer.complete ? Effect.sync(() => { edit((s) => ({ ...s, transfers: remove(s.transfers, transfer.key) })); }) : discard(transfer, 'expired'), { discard: true });
  });
  const api: HubApi = {
    get hubId() { return state().hubId; },
    get name() { return state().name; },
    init: () => runEffect(Effect.gen(function* () {
      const id = yield* io(() => storage.kv.get('hubId'));
      const hubId = typeof id === 'string' && HEX16.test(id) ? id : randomId(8);
      edit((s) => ({ ...s, hubId }));
      if (hubId !== id) yield* io(() => storage.kv.put('hubId', hubId));
      const name = yield* io(() => storage.kv.get('hubName'));
      edit((s) => ({ ...s, name: cleanText(name, 40) || 'Linux PC' }));
      const devices = yield* io(() => storage.devices.all());
      devices.forEach((entry) => { const device = readDevice(entry); if (device) setDevice(device); });
      yield* Effect.forEach(yield* io(() => storage.queue.all()), (entry) => Effect.gen(function* () {
        const item = readOutgoing(entry);
        if (item && state().devices.has(item.deviceId)) edit((s) => ({ ...s, outbox: put(s.outbox, item.tid, item) }));
        else if (isObject(entry) && typeof entry['tid'] === 'string') { const tid = entry['tid']; yield* ignore(io(() => storage.queue.delete(tid))); }
      }), { discard: true });
      const rawLog = yield* io(() => storage.kv.get(LOG_KEY));
      const log = isArray(rawLog) ? rawLog.map((entry: unknown) => readSaved(entry)).filter((entry): entry is Saved => entry !== null) : [];
      edit((s) => ({ ...s, log }));
      clearInterval(state().timer);
      if (sweepIntervalMs > 0) {
        const timer = setInterval(() => { Effect.runFork(sweep()); }, sweepIntervalMs);
        edit((s) => ({ ...s, timer }));
      }
      return api;
    })),
    dispose: () => { clearInterval(state().timer); state().waiters.forEach((waiters) => { waiters.forEach((done) => { done(); }); }); },
    setName: (name) => runEffect(Effect.gen(function* () {
      const next = cleanText(name, 40) || 'Linux PC'; edit((s) => ({ ...s, name: next })); yield* io(() => storage.kv.put('hubName', next)); return next;
    })),
    hello, addrs,
    newPairCode: () => {
      if (!state().hubId) throw new Error('init() first');
      const token = randomBytes(16); const expiresAt = now() + PAIR_TOKEN_TTL_MS;
      edit((s) => ({ ...s, tokens: [...s.tokens.filter((entry) => entry.expiresAt > now()), { token, expiresAt, usedBy: null }].slice(-5) }));
      const payload = encodePairPayload({ hubId: state().hubId, token, port, addrs: [...addrs()], name: state().name });
      return { payload, link: pairLink(payload), expiresAt };
    },
    listDevices: () => [...state().devices.values()].map((device) => summaryDevice(device, now() - device.lastSeen < ONLINE_MS)).sort((a, b) => a.pairedAt - b.pairedAt),
    isOnline: (deviceId) => { const device = state().devices.get(deviceId); return device !== undefined && now() - device.lastSeen < ONLINE_MS; },
    transfersFor: (deviceId) => [...state().transfers.values()].filter((transfer) => deviceId === undefined || transfer.deviceId === deviceId).map(summary),
    outboxFor: (deviceId) => [...state().outbox.values()].filter((item) => deviceId === undefined || item.deviceId === deviceId).map(outSummary),
    sendToDevice: (deviceId, files) => runEffect(Effect.gen(function* () {
      if (!state().devices.has(deviceId)) return yield* Effect.fail(new Error('Unknown device'));
      const list = [...files];
      if (list.length === 0) return yield* Effect.fail(new Error('No files'));
      const item: Outgoing = { tid: randomId(12), deviceId, files: list, createdAt: now() };
      yield* io(() => storage.queue.put(item.tid, item)).pipe(Effect.catch((error) => Effect.sync(() => { emit('error', { error, message: 'Could not persist the outgoing files; they will be sent while the hub stays open.' }); })));
      edit((s) => ({ ...s, outbox: put(s.outbox, item.tid, item) }));
      emit('outbox-added', { item: outSummary(item) }); wake(deviceId); return item.tid;
    })),
    cancelOutbox: (tid) => runEffect(Effect.gen(function* () {
      const item = state().outbox.get(tid); if (!item) return false;
      edit((s) => ({ ...s, outbox: remove(s.outbox, tid), outState: remove(s.outState, tid) }));
      yield* ignore(io(() => storage.queue.delete(tid))); emit('outbox-removed', { item: outSummary(item) }); return true;
    })),
    forgetDevice: (deviceId, reason = 'forgotten') => runEffect(forget(deviceId, reason)),
    handle: (request) => runEffect(handle(request)),
    sweep: () => runEffect(sweep()),
    on: (type, listener) => channels[type].on(listener),
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  return api;
};
