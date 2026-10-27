import type { Backoff, PairPayload } from './lib/proto.js';

export interface ClientStore {
  readonly get: (key: string) => Promise<unknown>;
  readonly put: (key: string, value: unknown) => Promise<void>;
  readonly delete: (key: string) => Promise<void>;
  readonly all: () => Promise<readonly unknown[]>;
}
export type Fetch = (input: string | URL | Request, init?: RequestInit & { readonly targetAddressSpace?: 'loopback' | 'local' }) => Promise<Response>;
export interface HubRecord { hubId: string; name: string; port: number; addrs: string[]; lastAddr: string; secret: string; pairedAt: number; lastSeen: number }
export type HubStatus = 'searching' | 'online' | 'offline';
export type TransferStatus = 'queued' | 'sending' | 'done' | 'partial' | 'cancelled';
export interface TransferSnapshot {
  readonly tid: string; readonly hubId: string; readonly names: readonly string[]; readonly total: number;
  readonly sent: number; readonly rate: number; readonly status: TransferStatus; readonly failed: readonly number[];
  readonly error: string | null; readonly createdAt: number; readonly doneAt: number;
}
export interface IncomingTransfer { readonly tid: string; readonly hubId: string; readonly names: readonly string[]; readonly total: number; readonly received: number; readonly status: 'receiving' | 'done' }
export interface ClientEvents {
  hubs: Record<string, never>;
  status: { readonly hubId: string; readonly status: HubStatus; readonly lastSeen: number };
  transfer: TransferSnapshot;
  incoming: IncomingTransfer;
  file: { readonly hubId: string; readonly hubName: string; readonly tid: string; readonly index: number; readonly file: File };
  unpaired: { readonly hubId: string; readonly name: string; readonly reason: string; readonly files: File[] };
  network: { readonly blocked: boolean };
  busy: { readonly busy: boolean };
  warning: { readonly message: string };
}
export interface QueueRecord { tid: string; hubId: string; files: File[]; names: string[]; total: number; createdAt: number; failed: number[] }
export interface Transfer extends QueueRecord { readonly update: (patch: Partial<TransferState>) => TransferState; readonly status: TransferStatus; readonly acked: number[]; readonly rate: number; readonly error: string | null; readonly doneAt: number; readonly abort: AbortController; readonly saved: Promise<void>; readonly rec: QueueRecord; readonly lastAt: number; readonly lastSent: number }
export interface FileMeta { readonly name: string; readonly size: number; readonly type: string; readonly lastModified: number }
export interface OutboxEntry { readonly tid: string; readonly files: readonly FileMeta[] }
export interface Hello { readonly app: 'i6-share-hub'; readonly id: string; readonly name: string; readonly addrs: readonly string[] }
export interface WireResponse { readonly secret?: string | undefined; readonly hubId?: string | undefined; readonly name?: string | undefined; readonly addrs?: readonly string[] | undefined; readonly outbox?: readonly OutboxEntry[] | undefined; readonly size?: number | undefined; readonly received?: readonly number[] | undefined; readonly ok?: boolean | undefined; readonly bytes?: number | undefined; readonly error?: string | undefined }
export interface OpenedResponse { readonly json: WireResponse; readonly binary: Uint8Array<ArrayBuffer>; readonly iv: Uint8Array<ArrayBuffer> }
export interface RequestOptions { readonly addr?: string | undefined; readonly timeout?: number | undefined; readonly signal?: AbortSignal | undefined }
export interface RetryOptions extends RequestOptions { readonly backoff?: Backoff }
export type PairStatus = 'searching' | 'pairing' | 'blocked';
export interface PairOptions { readonly signal?: AbortSignal | undefined; readonly onStatus?: ((status: PairStatus) => void) | undefined }
export interface PairIdentity extends PairOptions { readonly deviceId: string; readonly name: string; readonly os: string; readonly fetch?: Fetch | undefined }
export interface ShareOptions { readonly kv: ClientStore; readonly hubs: ClientStore; readonly queue: ClientStore; readonly fetch?: Fetch }
export interface InitOptions { readonly visible?: boolean; readonly name?: string; readonly os?: string }
export type PairInput = string | PairPayload;
export interface EngineRuntime {
  readonly update: (patch: Partial<EngineState>) => EngineState;
  readonly kv: ClientStore; readonly hubsStore: ClientStore; readonly queueStore: ClientStore; readonly _fetch: Fetch;
  readonly _hubs: ReadonlyMap<string, HubRuntime>; readonly _transfers: ReadonlyMap<string, Transfer>; readonly _pulled: ReadonlySet<string>; readonly _wake: AbortController; readonly _busyCount: number; readonly _blocked: boolean;
  readonly visible: boolean; readonly deviceId: string; readonly deviceName: string; readonly os: string;
  readonly hubs: HubRuntime[]; readonly transfers: TransferSnapshot[];
  readonly addEventListener: <K extends keyof ClientEvents>(type: K, listener: (event: CustomEvent<ClientEvents[K]>) => void, options?: AddEventListenerOptions | boolean) => void;
  readonly removeEventListener: <K extends keyof ClientEvents>(type: K, listener: (event: CustomEvent<ClientEvents[K]>) => void) => void;
  readonly _emit: <K extends keyof ClientEvents>(type: K, detail: ClientEvents[K]) => void;
  readonly init: (options?: InitOptions) => Promise<EngineRuntime>;
  readonly hub: (hubId: string) => HubRuntime | undefined;
  readonly setDeviceName: (name: string) => Promise<void>;
  readonly setVisible: (visible: boolean) => void; readonly kick: () => void; readonly stop: () => void;
  readonly pair: (input: PairInput, options?: PairOptions) => Promise<HubRuntime>;
  readonly send: (hubId: string, files: Iterable<Blob, unknown, unknown>) => Promise<string>;
  readonly cancel: (tid: string) => Promise<void>; readonly forget: (hubId: string) => Promise<void>;
  readonly _track: (record: QueueRecord, saved: Promise<void>) => Transfer;
  readonly _snap: (transfer: Transfer) => TransferSnapshot;
  readonly _nextTransfer: (hubId: string) => Transfer | undefined;
  readonly _progress: (transfer: Transfer) => void;
  readonly _failFile: (transfer: Transfer, index: number, error: unknown) => Promise<void>;
  readonly _finish: (transfer: Transfer, status: TransferStatus) => Promise<void>;
  readonly _drop: (transfer: Transfer) => Promise<File[]>;
  readonly _unpaired: (hub: HubRuntime, reason: string) => Promise<void>;
  readonly _markPulled: (tid: string) => Promise<void>;
  readonly _busy: (delta: number) => void; readonly _network: (blocked: boolean) => void;
}
export interface HubRuntime {
  readonly update: (patch: Partial<HubState>) => HubState;
  readonly engine: EngineRuntime; readonly rec: HubRecord; readonly status: HubStatus; readonly addr: string | null; readonly fails: number; readonly lastSweep: number;
  readonly syncBackoff: Backoff; readonly xferBackoff: Backoff; readonly stopped: boolean; readonly life: AbortController;
  readonly _key: Promise<CryptoKey> | null; readonly _locating: Promise<string> | null; readonly _syncCtl: AbortController | null; readonly _pumping: boolean; readonly _savedAt: number; readonly _forgetting: boolean;
  readonly id: string; readonly name: string; readonly lastSeen: number;
  readonly key: () => Promise<CryptoKey>; readonly start: () => void; readonly stop: () => void;
  readonly _setStatus: (status: HubStatus) => void; readonly _seen: () => void; readonly _save: () => void;
  readonly _learn: (addrs: readonly string[] | undefined, addr: string | null, name: string | undefined) => void;
  readonly _nap: (ms: number, signal?: AbortSignal) => Promise<void>; readonly _waitWake: () => Promise<void>;
  readonly locate: () => Promise<string>; readonly _locate: () => Promise<string>;
  readonly request: (op: string, json: Readonly<Record<string, unknown>>, binary?: ArrayBuffer | Uint8Array<ArrayBuffer> | null, options?: RequestOptions) => Promise<OpenedResponse>;
  readonly _checkUnpaired: (addr: string, code: string) => Promise<never>;
  readonly call: HubRuntime['request']; readonly callRetry: (op: string, json: Readonly<Record<string, unknown>>, binary?: ArrayBuffer | Uint8Array<ArrayBuffer> | null, options?: RetryOptions) => Promise<OpenedResponse>;
  readonly _syncLoop: () => Promise<void>; readonly _receive: (outbox: readonly OutboxEntry[]) => Promise<boolean>;
  readonly _pull: (entry: OutboxEntry) => Promise<void>; readonly pump: () => void;
  readonly _send: (transfer: Transfer) => Promise<void>; readonly _sendFile: (transfer: Transfer, index: number, signal: AbortSignal, file: File) => Promise<void>;
}

/** Readonly application view; lifecycle and I/O are explicit operations. */
export interface HubClient {
  readonly id: string; readonly name: string; readonly status: HubStatus; readonly addr: string | null; readonly lastSeen: number;
  readonly rec: Readonly<Omit<HubRecord, 'addrs'>> & { readonly addrs: readonly string[] };
}
export interface ShareEngine {
  readonly visible: boolean; readonly deviceId: string; readonly deviceName: string; readonly os: string;
  readonly hubs: readonly HubClient[]; readonly transfers: readonly TransferSnapshot[];
  readonly addEventListener: EngineRuntime['addEventListener']; readonly removeEventListener: EngineRuntime['removeEventListener'];
  readonly init: (options?: InitOptions) => Promise<ShareEngine>; readonly hub: (id: string) => HubClient | undefined;
  readonly setDeviceName: EngineRuntime['setDeviceName']; readonly setVisible: EngineRuntime['setVisible'];
  readonly kick: EngineRuntime['kick']; readonly stop: EngineRuntime['stop'];
  readonly pair: (input: PairInput, options?: PairOptions) => Promise<HubClient>;
  readonly send: EngineRuntime['send']; readonly cancel: EngineRuntime['cancel']; readonly forget: EngineRuntime['forget'];
}

export type HubState = Pick<HubRuntime, 'rec' | 'status' | 'addr' | 'fails' | 'lastSweep' | 'stopped' | '_key' | '_locating' | '_syncCtl' | '_pumping' | '_savedAt' | '_forgetting'>;
export type EngineState = Pick<EngineRuntime, '_hubs' | '_transfers' | '_pulled' | '_wake' | '_busyCount' | '_blocked' | 'visible' | 'deviceId' | 'deviceName' | 'os'>;
export type TransferState = Pick<Transfer, 'files' | 'status' | 'failed' | 'acked' | 'rate' | 'error' | 'doneAt' | 'rec' | 'lastAt' | 'lastSent'>;
export type IncomingState = IncomingTransfer;
