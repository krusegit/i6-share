import { vi } from 'vitest';
import type { DeviceSummary, HubApi, HubEvents, OutboxSummary, TransferSummary } from '../hub/api-types.js';
import type { ServerController, ServerState } from '../hub/http.js';
import type { AddressBook } from '../hub/net.js';
import type { DirectoryHandle, FolderSink, FolderState } from '../hub/sink.js';
import type { Store } from '../public/lib/store.js';

const channel = <A>() => {
  const listeners = new Set<(value: A) => void>();
  return {
    on: (listener: (value: A) => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    emit: (value: A) => { for (const listener of listeners) listener(value); },
  };
};

export const device = (overrides: Partial<DeviceSummary> = {}): DeviceSummary => ({
  deviceId: '0123456789abcdef', name: 'Test Phone', os: 'Android', pairedAt: 1, lastSeen: Date.now(), lastAddr: '192.168.1.3', online: true, ...overrides,
});
export const transfer = (overrides: Partial<TransferSummary> = {}): TransferSummary => ({
  tid: '0123456789abcdef01234567', deviceId: '0123456789abcdef', deviceName: 'Test Phone',
  files: [{ name: 'photo.jpg', originalName: 'photo.jpg', size: 100, type: 'image/jpeg', bytes: 25, done: false, where: 'folder' }],
  count: 1, done: 0, bytes: 25, total: 100, complete: false, speed: 5, createdAt: Date.now(), lastActivity: Date.now(), ...overrides,
});
export const outgoing = (overrides: Partial<OutboxSummary> = {}): OutboxSummary => ({
  tid: 'fedcba9876543210fedcba98', deviceId: '0123456789abcdef', createdAt: Date.now(),
  files: [{ name: 'outgoing.txt', size: 100, type: 'text/plain', lastModified: 0 }],
  count: 1, bytes: 20, total: 100, speed: 10, started: false, ...overrides,
});
export const received = (overrides: Partial<HubEvents['file-saved']> = {}): HubEvents['file-saved'] => ({
  tid: '0123456789abcdef01234567', deviceId: '0123456789abcdef', deviceName: 'Test Phone', name: 'photo.jpg', originalName: 'photo.jpg', size: 100, type: 'image/jpeg', where: 'folder', at: Date.now(), ...overrides,
});

export const makeHubFixture = () => {
  const channels: { readonly [K in keyof HubEvents]: ReturnType<typeof channel<HubEvents[K]>> } = {
    'device-paired': channel(), 'device-seen': channel(), 'device-updated': channel(), 'device-unpaired': channel(),
    'pair-code-used': channel(), 'transfer-start': channel(), 'transfer-progress': channel(), 'transfer-complete': channel(),
    'transfer-cancelled': channel(), 'file-saved': channel(), 'outbox-added': channel(), 'outbox-progress': channel(),
    'outbox-delivered': channel(), 'outbox-removed': channel(), 'sink-error': channel(), error: channel(),
  };
  const apiEvents = new EventTarget();
  const serverEvents = new EventTarget();
  const sinkEvents = new EventTarget();
  const addressEvents = new EventTarget();
  const values = new Map<string, unknown>([['onboarded', true]]);
  const kv: Store = {
    get: vi.fn((key: string): Promise<unknown> => Promise.resolve(values.get(key))),
    put: vi.fn((key: string, value: unknown): Promise<void> => { values.set(key, value); return Promise.resolve(); }),
    delete: vi.fn((key: string): Promise<void> => { values.delete(key); return Promise.resolve(); }),
    all: vi.fn((): Promise<readonly unknown[]> => Promise.resolve([...values.values()])),
  };
  const state: {
    devices: readonly DeviceSummary[];
    transfers: readonly TransferSummary[];
    outgoing: readonly OutboxSummary[];
    server: ServerState;
    dir: DirectoryHandle | null;
    folderState: FolderState;
    supported: boolean;
    addresses: readonly string[];
    detected: readonly string[];
    manual: readonly string[];
    name: string;
  } = {
    devices: [device()], transfers: [], outgoing: [],
    server: { status: 'listening', host: '0.0.0.0', port: 47616, error: null, retryAt: null },
    dir: null, folderState: 'none', supported: true,
    addresses: ['192.168.1.2'], detected: ['192.168.1.2'], manual: [], name: 'Test Computer',
  };
  const directory: DirectoryHandle = {
    name: 'Pictures',
    queryPermission: vi.fn(() => Promise.resolve('granted' as const)),
    requestPermission: vi.fn(() => Promise.resolve('granted' as const)),
    getFileHandle: vi.fn(() => Promise.resolve({ getFile: () => Promise.resolve(new File([], 'photo.jpg')), createWritable: () => Promise.resolve({ write: () => Promise.resolve(), close: () => Promise.resolve(), abort: () => Promise.resolve() }) })),
    removeEntry: vi.fn(() => Promise.resolve()),
  };
  const api: HubApi = {
    hubId: 'fedcba9876543210', get name() { return state.name; },
    init: vi.fn(() => Promise.resolve(api)), dispose: vi.fn(),
    setName: vi.fn((name: string) => { state.name = name; return Promise.resolve(name); }),
    hello: vi.fn(() => ({ app: 'i6-share-hub', v: 1, id: 'fedcba9876543210', name: state.name, port: 47616, addrs: state.addresses })),
    addrs: vi.fn(() => state.addresses),
    newPairCode: vi.fn(() => ({ payload: 'pair-payload', link: 'https://example.test/#pair=pair-payload', expiresAt: Date.now() + 600_000 })),
    listDevices: vi.fn(() => state.devices),
    isOnline: vi.fn((id: string) => state.devices.some((entry) => entry.deviceId === id && entry.online)),
    transfersFor: vi.fn(() => state.transfers), outboxFor: vi.fn(() => state.outgoing),
    sendToDevice: vi.fn(() => Promise.resolve('transfer-id')), cancelOutbox: vi.fn(() => Promise.resolve(true)), forgetDevice: vi.fn(() => Promise.resolve(true)),
    handle: vi.fn(() => Promise.resolve({ status: 200, headers: {}, body: 'ok' })), sweep: vi.fn(() => Promise.resolve()),
    on: (type, listener) => channels[type].on(listener),
    addEventListener: apiEvents.addEventListener.bind(apiEvents), removeEventListener: apiEvents.removeEventListener.bind(apiEvents),
  };
  const server: ServerController = {
    get state() { return state.server; },
    connections: 0, ready: Promise.resolve(), close: vi.fn(), restart: vi.fn(),
    addEventListener: serverEvents.addEventListener.bind(serverEvents), removeEventListener: serverEvents.removeEventListener.bind(serverEvents), dispatchEvent: serverEvents.dispatchEvent.bind(serverEvents),
  };
  const sink: FolderSink = {
    get dir() { return state.dir; }, get state() { return state.folderState; }, get supported() { return state.supported; },
    get folderName() { return state.dir?.name ?? null; }, get usingFolder() { return state.dir !== null && state.folderState === 'granted'; },
    init: vi.fn(() => Promise.resolve(sink)), check: vi.fn(() => Promise.resolve(state.folderState)),
    pick: vi.fn(() => { state.dir = directory; state.folderState = 'granted'; return Promise.resolve(true); }),
    requestPermission: vi.fn(() => Promise.resolve(state.folderState)),
    useDownloads: vi.fn(() => { state.dir = null; state.folderState = 'none'; return Promise.resolve(); }),
    exists: vi.fn(() => Promise.resolve(false)),
    create: vi.fn((name: string) => Promise.resolve({ name, where: 'download' as const, write: () => Promise.resolve(), close: () => Promise.resolve(), abort: () => Promise.resolve() })),
    openFile: vi.fn((name: string) => Promise.resolve(new File([], name))),
    addEventListener: sinkEvents.addEventListener.bind(sinkEvents), removeEventListener: sinkEvents.removeEventListener.bind(sinkEvents),
  };
  const addrs: AddressBook = {
    get addrs() { return state.addresses; }, get manual() { return state.manual; }, get detected() { return state.detected; }, lastDetect: 0,
    init: vi.fn(() => Promise.resolve(addrs)), dispose: vi.fn(), refresh: vi.fn(() => Promise.resolve(state.detected)),
    setManual: vi.fn((): Promise<readonly string[]> => Promise.resolve([])), observe: vi.fn(),
    addEventListener: addressEvents.addEventListener.bind(addressEvents), removeEventListener: addressEvents.removeEventListener.bind(addressEvents),
  };
  const emit = <K extends keyof HubEvents>(type: K, detail: HubEvents[K]): void => {
    channels[type].emit(detail);
    apiEvents.dispatchEvent(new CustomEvent(type, { detail }));
  };
  return { api, server, sink, addrs, kv, values, state, directory, emit, serverEvents, sinkEvents, addressEvents };
};
