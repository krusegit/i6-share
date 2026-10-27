export interface HubStore {
  readonly get: (key: string) => Promise<unknown>;
  readonly put: (key: string, value: unknown) => Promise<unknown>;
  readonly delete: (key: string) => Promise<unknown>;
  readonly all: () => Promise<readonly unknown[]>;
}

export interface HubStorage {
  readonly kv: HubStore;
  readonly devices: HubStore;
  readonly queue: HubStore;
}

export interface FileMetadata {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  readonly lastModified: number;
}

export interface HubSinkHandle {
  readonly where?: string;
  readonly write: (bytes: Uint8Array<ArrayBuffer>) => Promise<unknown>;
  readonly close: () => Promise<unknown>;
  readonly abort: () => Promise<unknown>;
}

export interface HubSink {
  readonly exists: (name: string) => Promise<boolean>;
  readonly create: (name: string, metadata: Omit<FileMetadata, 'name'>) => Promise<HubSinkHandle>;
}

export interface HubRequest {
  readonly method: string;
  readonly path: string;
  readonly query?: URLSearchParams | string;
  readonly body?: Uint8Array<ArrayBuffer>;
  readonly remoteAddress?: string;
}

export interface HubResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | Uint8Array<ArrayBuffer>;
}

export interface Device {
  readonly deviceId: string;
  readonly name: string;
  readonly os: string;
  readonly secret: string;
  readonly pairedAt: number;
  readonly lastSeen: number;
  readonly lastAddr: string;
}
export type DeviceSummary = Omit<Device, 'secret'> & { readonly online: boolean };

export interface TransferFileSummary {
  readonly name: string;
  readonly originalName: string;
  readonly size: number;
  readonly type: string;
  readonly bytes: number;
  readonly done: boolean;
  readonly where: string | null;
}
export interface TransferSummary {
  readonly tid: string;
  readonly deviceId: string;
  readonly deviceName: string;
  readonly files: readonly TransferFileSummary[];
  readonly count: number;
  readonly done: number;
  readonly bytes: number;
  readonly total: number;
  readonly complete: boolean;
  readonly speed: number;
  readonly createdAt: number;
  readonly lastActivity: number;
}
export interface OutboxSummary {
  readonly tid: string;
  readonly deviceId: string;
  readonly createdAt: number;
  readonly files: readonly FileMetadata[];
  readonly count: number;
  readonly bytes: number;
  readonly total: number;
  readonly speed: number;
  readonly started: boolean;
}
export interface PairCode {
  readonly payload: string;
  readonly link: string;
  readonly expiresAt: number;
}
export interface HubHello {
  readonly app: string;
  readonly v: number;
  readonly id: string;
  readonly name: string;
  readonly port: number;
  readonly addrs: readonly string[];
}
export interface HubApiOptions {
  readonly storage: HubStorage;
  readonly sink: HubSink;
  readonly getAddrs?: () => readonly string[];
  readonly port?: number;
  readonly now?: () => number;
  readonly partialTtlMs?: number;
  readonly sweepIntervalMs?: number;
}
export interface HubEvents {
  readonly 'device-paired': { readonly device: DeviceSummary };
  readonly 'device-seen': { readonly device: DeviceSummary };
  readonly 'device-updated': { readonly device: DeviceSummary };
  readonly 'device-unpaired': { readonly deviceId: string; readonly name: string; readonly reason: string };
  readonly 'pair-code-used': { readonly deviceId: string; readonly name: string };
  readonly 'transfer-start': { readonly transfer: TransferSummary };
  readonly 'transfer-progress': { readonly transfer: TransferSummary };
  readonly 'transfer-complete': { readonly transfer: TransferSummary };
  readonly 'transfer-cancelled': { readonly transfer: TransferSummary; readonly reason: string };
  readonly 'file-saved': { readonly tid: string; readonly deviceId: string; readonly deviceName: string; readonly name: string; readonly originalName: string; readonly size: number; readonly type: string; readonly where: string | null; readonly at: number };
  readonly 'outbox-added': { readonly item: OutboxSummary };
  readonly 'outbox-progress': { readonly item: OutboxSummary };
  readonly 'outbox-delivered': { readonly item: OutboxSummary };
  readonly 'outbox-removed': { readonly item: OutboxSummary };
  readonly 'sink-error': { readonly error: unknown; readonly name: string };
  readonly error: { readonly error: unknown; readonly message?: string };
}
export interface HubApi {
  readonly hubId: string;
  readonly name: string;
  readonly init: () => Promise<HubApi>;
  readonly dispose: () => void;
  readonly setName: (name: string) => Promise<string>;
  readonly hello: () => HubHello;
  readonly addrs: () => readonly string[];
  readonly newPairCode: () => PairCode;
  readonly listDevices: () => readonly DeviceSummary[];
  readonly isOnline: (deviceId: string) => boolean;
  readonly transfersFor: (deviceId?: string) => readonly TransferSummary[];
  readonly outboxFor: (deviceId?: string) => readonly OutboxSummary[];
  readonly sendToDevice: (deviceId: string, files: Iterable<File, unknown, unknown>) => Promise<string>;
  readonly cancelOutbox: (tid: string) => Promise<boolean>;
  readonly forgetDevice: (deviceId: string, reason?: string) => Promise<boolean>;
  readonly handle: (request: HubRequest) => Promise<HubResponse>;
  readonly sweep: () => Promise<void>;
  readonly on: <K extends keyof HubEvents>(type: K, listener: (detail: HubEvents[K]) => void) => () => void;
  readonly addEventListener: EventTarget['addEventListener'];
  readonly removeEventListener: EventTarget['removeEventListener'];
}
