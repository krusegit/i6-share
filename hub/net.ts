import { Effect, Ref } from 'effect';
import { isPrivateIp, ipToBytes, bytesToIp } from '../public/lib/proto.js';
import { runEffect } from '../public/lib/runtime.js';
import type { Store } from '../public/lib/store.js';

export interface UdpOptions { readonly remoteAddress: string; readonly remotePort: number }
export interface UdpSocket {
  readonly opened: Promise<{ readonly localAddress?: string }>;
  readonly close: () => Promise<void>;
}
export type UdpFactory = (options: UdpOptions) => UdpSocket;
declare global { var UDPSocket: (new (options: UdpOptions) => UdpSocket) | undefined; }
const PROBES: readonly UdpOptions[] = [
  { remoteAddress: '8.8.8.8', remotePort: 53 },
  { remoteAddress: '2001:4860:4860::8888', remotePort: 53 },
];
const browserEvents: { readonly addEventListener?: EventTarget['addEventListener']; readonly removeEventListener?: EventTarget['removeEventListener'] } = globalThis;
const isUnknownArray = (value: unknown): value is readonly unknown[] => Array.isArray(value);
const LEARNED_TTL_MS = 60 * 60 * 1000;
export const MAX_ADDRS = 8;
export const normalizeIp = (input: unknown): string | null => {
  if (typeof input !== 'string') return null;
  const bytes = ipToBytes(input.trim());
  return bytes === null ? null : bytesToIp(bytes);
};
export const isUsableAddr = (ip: string): boolean => {
  const bytes = ipToBytes(ip.trim());
  if (bytes === null) return false;
  if (bytes.length === 4) return isPrivateIp(ip) && bytes[0] !== 127 && !(bytes[0] === 169 && bytes[1] === 254);
  return (new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint8(0) & 0xfe) === 0xfc;
};
const browserUdp = (): UdpFactory | undefined => {
  const Constructor = globalThis.UDPSocket;
  return Constructor === undefined ? undefined : (options) => new Constructor(options);
};
export interface DetectOptions { readonly UDPSocket?: UdpFactory | undefined; readonly timeoutMs?: number }
export const detectAddrs = (options: DetectOptions = {}): Promise<readonly string[]> => {
  const factory = options.UDPSocket ?? browserUdp();
  if (factory === undefined) return Promise.resolve([]);
  const probe = (address: UdpOptions): Effect.Effect<string | null> => Effect.acquireUseRelease(
    Effect.try(() => factory(address)),
    (socket) => Effect.tryPromise(() => socket.opened).pipe(
      Effect.map((info) => info.localAddress ?? null), Effect.timeout(options.timeoutMs ?? 3000),
    ),
    (socket) => Effect.tryPromise(() => socket.close()).pipe(Effect.catch(() => Effect.void)),
  ).pipe(Effect.catch(() => Effect.succeed(null)));
  return runEffect(Effect.all(PROBES.map(probe), { concurrency: 'unbounded' }).pipe(
    Effect.map((found) => [...new Set(found.map(normalizeIp).filter((address): address is string => address !== null && isUsableAddr(address)))]),
  ));
};
interface BookState {
  readonly manual: readonly string[];
  readonly detected: readonly string[];
  readonly learned: ReadonlyMap<string, number>;
  readonly lastDetect: number;
  readonly last: string;
}
export interface AddressBookOptions {
  readonly kv?: Pick<Store, 'get' | 'put'>;
  readonly UDPSocket?: UdpFactory | undefined;
  readonly intervalMs?: number;
  readonly now?: () => number;
}
export interface AddressBook {
  readonly addrs: readonly string[];
  readonly manual: readonly string[];
  readonly detected: readonly string[];
  readonly lastDetect: number;
  readonly init: () => Promise<AddressBook>;
  readonly dispose: () => void;
  readonly refresh: () => Promise<readonly string[]>;
  readonly setManual: (list: string | readonly string[]) => Promise<readonly string[]>;
  readonly observe: (localAddress: string) => void;
  readonly addEventListener: EventTarget['addEventListener'];
  readonly removeEventListener: EventTarget['removeEventListener'];
}
export const createAddressBook = (options: AddressBookOptions = {}): AddressBook => {
  const events = new EventTarget();
  const state = Ref.makeUnsafe<BookState>({ manual: [], detected: [], learned: new Map(), lastDetect: 0, last: '' });
  const timer = Ref.makeUnsafe<ReturnType<typeof setInterval> | undefined>(undefined);
  const now = options.now ?? Date.now;
  const snapshot = (): BookState => Effect.runSync(Ref.get(state));
  const update = (change: (previous: BookState) => BookState): void => { Effect.runSync(Ref.update(state, change)); };
  const addrs = (): readonly string[] => {
    const current = snapshot();
    const learned = [...current.learned].filter(([, at]) => now() - at < LEARNED_TTL_MS).map(([address]) => address);
    const all = [...new Set([...current.manual, ...current.detected, ...learned])];
    return [...all.filter((address) => !address.includes(':')), ...all.filter((address) => address.includes(':'))].slice(0, MAX_ADDRS);
  };
  const changed = (): void => {
    const addresses = addrs();
    const last = addresses.join(',');
    if (last === snapshot().last) return;
    update((previous) => ({ ...previous, last }));
    events.dispatchEvent(new CustomEvent('change', { detail: addresses }));
  };
  const refresh = (): Promise<readonly string[]> => runEffect(Effect.gen(function* () {
    const detected = yield* Effect.promise(() => detectAddrs({ UDPSocket: options.UDPSocket }));
    yield* Ref.update(state, (previous) => ({ ...previous, detected, lastDetect: now() }));
    yield* Effect.sync(changed);
    return detected;
  }));
  const online = (): void => { void refresh(); };
  const dispose = (): void => {
    clearInterval(Effect.runSync(Ref.get(timer)));
    Effect.runSync(Ref.set(timer, undefined));
    browserEvents.removeEventListener?.('online', online);
  };
  const book: AddressBook = {
    get addrs() { return addrs(); },
    get manual() { return snapshot().manual; },
    get detected() { return snapshot().detected; },
    get lastDetect() { return snapshot().lastDetect; },
    init: () => runEffect(Effect.gen(function* () {
      const manual = yield* Effect.tryPromise(async () => options.kv?.get('manualAddrs')).pipe(Effect.catch(() => Effect.succeed(undefined)));
      if (isUnknownArray(manual)) update((previous) => ({ ...previous, manual: manual.map(normalizeIp).filter((address): address is string => address !== null) }));
      yield* Effect.promise(refresh);
      dispose();
      const interval = setInterval(online, options.intervalMs ?? 60_000);
      if (typeof interval === 'object' && 'unref' in interval) interval.unref();
      yield* Ref.set(timer, interval);
      browserEvents.addEventListener?.('online', online);
      return book;
    })),
    dispose, refresh,
    setManual: (list) => runEffect(Effect.gen(function* () {
      const items = (typeof list === 'string' ? list.split(/[\s,;]+/) : list).map((item) => item.trim()).filter((item) => item.length > 0);
      const parsed = items.map((item) => ({ item, address: normalizeIp(item) }));
      const manual = [...new Set(parsed.flatMap(({ address }) => address === null ? [] : [address]))];
      yield* Ref.update(state, (previous) => ({ ...previous, manual }));
      yield* Effect.tryPromise(async () => options.kv?.put('manualAddrs', manual)).pipe(Effect.catch(() => Effect.void));
      yield* Effect.sync(changed);
      return parsed.filter(({ address }) => address === null).map(({ item }) => item);
    })),
    observe: (input) => {
      const address = normalizeIp(input);
      if (address === null || !isUsableAddr(address)) return;
      const isNew = !snapshot().learned.has(address);
      update((previous) => ({ ...previous, learned: new Map([...previous.learned, [address, now()]]) }));
      if (isNew) changed();
    },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  return book;
};
