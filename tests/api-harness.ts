import { createHubApi } from '../hub/api.js';
import type { HubApi, HubApiOptions, HubRequest, HubResponse, HubSink, HubStore } from '../hub/api-types.js';
import { decodePairPayload, deviceKey, open, pairKey, requestAad, responseAad, seal, unb64url } from '../public/lib/proto.js';

export const memoryStore = (seed: Readonly<Record<string, unknown>> = {}): HubStore & { readonly values: Map<string, unknown>; readonly failures: Set<string> } => {
  const values = new Map(Object.entries(seed)); const failures = new Set<string>();
  const check = (op: string): void => { if (failures.has(op)) throw new Error(op); };
  return {
    values, failures,
    get: (key) => Promise.resolve().then(() => { check('get'); return values.get(key); }),
    put: (key, value) => Promise.resolve().then(() => { check('put'); values.set(key, value); }),
    delete: (key) => Promise.resolve().then(() => { check('delete'); values.delete(key); }),
    all: () => Promise.resolve().then(() => { check('all'); return [...values.values()]; }),
  };
};
export const createStorage = (kv: Readonly<Record<string, unknown>> = {}): {
  readonly kv: ReturnType<typeof memoryStore>;
  readonly devices: ReturnType<typeof memoryStore>;
  readonly queue: ReturnType<typeof memoryStore>;
} => ({ kv: memoryStore(kv), devices: memoryStore(), queue: memoryStore() });
export const createSink = (): HubSink & {
  readonly files: Map<string, Uint8Array<ArrayBuffer>>;
  readonly failures: Set<string>;
  readonly aborted: string[];
} => {
  const files = new Map<string, Uint8Array<ArrayBuffer>>(); const failures = new Set<string>(); const aborted: string[] = [];
  const check = (op: string): void => { if (failures.has(op)) throw new Error(op); };
  return {
    files, failures, aborted,
    exists: (name) => Promise.resolve().then(() => { check('exists'); return files.has(name) || failures.has('all-exist'); }),
    create: (name) => Promise.resolve().then(() => {
      check('create');
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      return {
        where: 'folder',
        write: (bytes: Uint8Array<ArrayBuffer>) => Promise.resolve().then(() => { check('write'); chunks.push(bytes); }),
        close: () => Promise.resolve().then(() => { check('close'); files.set(name, Uint8Array.from(chunks.flatMap((chunk) => [...chunk]))); }),
        abort: () => Promise.resolve().then(() => { aborted.push(name); check('abort'); }),
      };
    }),
  };
};
export interface Session {
  readonly api: HubApi;
  readonly deviceId: string;
  readonly secret: string;
  readonly key: CryptoKey;
  readonly pairBody: Uint8Array<ArrayBuffer>;
  readonly pairIv: Uint8Array<ArrayBuffer>;
  readonly pairCryptoKey: CryptoKey;
  readonly code: string;
  readonly request: (op: string, data?: Readonly<Record<string, unknown>>, binary?: Uint8Array<ArrayBuffer>, request?: Partial<HubRequest>) => Promise<HubResponse>;
  readonly call: (op: string, data?: Readonly<Record<string, unknown>>, binary?: Uint8Array<ArrayBuffer>) => Promise<{ readonly status: number; readonly json: Readonly<Record<string, unknown>>; readonly binary: Uint8Array<ArrayBuffer> }>;
}
const responseBytes = (response: HubResponse): Uint8Array<ArrayBuffer> => {
  if (typeof response.body === 'string') throw new Error(response.body);
  return response.body;
};
export const pairSession = async (api: HubApi, deviceId = '1234567890abcdef', code = api.newPairCode().payload): Promise<Session> => {
  const decoded = decodePairPayload(code); const pairCryptoKey = await pairKey(decoded.token, decoded.hubId);
  const packet = await seal(pairCryptoKey, requestAad('pair', 'pair'), { deviceId, name: 'Test Phone', os: 'Android' });
  const response = await api.handle({ method: 'POST', path: '/i6/pair', query: `h=${api.hubId}`, body: packet.body, remoteAddress: '192.168.1.2' });
  const paired = await open(pairCryptoKey, responseAad('pair', packet.iv), responseBytes(response));
  const secret = paired.json['secret']; if (typeof secret !== 'string') throw new Error('missing secret');
  const key = await deviceKey(unb64url(secret), deviceId);
  const request: Session['request'] = async (op, data = {}, binary, overrides = {}) => {
    const encrypted = await seal(key, requestAad(op, deviceId), data, binary);
    return api.handle({ method: 'POST', path: `/i6/${op}`, query: `d=${deviceId}`, body: encrypted.body, ...overrides });
  };
  const call: Session['call'] = async (op, data = {}, binary) => {
    const encrypted = await seal(key, requestAad(op, deviceId), data, binary);
    const result = await api.handle({ method: 'POST', path: `/i6/${op}`, query: `d=${deviceId}`, body: encrypted.body });
    if (typeof result.body === 'string') {
      const parsed: unknown = JSON.parse(result.body);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('invalid response');
      return { status: result.status, json: Object.fromEntries(Object.entries(parsed)), binary: new Uint8Array() };
    }
    const message = await open(key, responseAad(op, encrypted.iv), result.body);
    return { status: result.status, json: message.json, binary: message.binary };
  };
  return { api, deviceId, secret, key, code, pairBody: packet.body, pairIv: packet.iv, pairCryptoKey, request, call };
};
export const harness = async (options: Partial<HubApiOptions> = {}): Promise<{
  readonly api: HubApi;
  readonly storage: ReturnType<typeof createStorage>;
  readonly sink: ReturnType<typeof createSink>;
  readonly clock: { time: number };
}> => {
  const storage = createStorage(); const sink = createSink(); const clock = { time: 100_000 };
  const api = createHubApi({ storage, sink, now: () => clock.time, getAddrs: () => ['127.0.0.1'], sweepIntervalMs: 0, ...options });
  await api.init();
  return { api, storage, sink, clock };
};
