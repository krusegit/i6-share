/** Shared, version-one wire protocol. Pure codecs are separate from Effect-managed I/O. */
import { Effect, Ref } from 'effect';
import { runEffect } from './runtime.js';

export const PROTOCOL_VERSION = 1;
export const PORT = 47616;
export const APP_URL = 'https://krusegit.github.io/i6-share/';
export const CHUNK_SIZE = 4 * 1024 * 1024;
export const MAX_BODY = CHUNK_SIZE + 64 * 1024;
export const SYNC_WAIT_MS = 25_000;
export const PAIR_TOKEN_TTL_MS = 10 * 60 * 1000;

export type Bytes = Uint8Array | ArrayBuffer;
export type JsonObject = Readonly<Record<string, unknown>>;
export interface Frame {
  readonly json: JsonObject;
  readonly binary: Uint8Array<ArrayBuffer>;
}
export interface Envelope extends Frame { readonly iv: Uint8Array<ArrayBuffer> }
export interface Sealed { readonly body: Uint8Array<ArrayBuffer>; readonly iv: Uint8Array<ArrayBuffer> }
export interface PairPayload {
  readonly hubId: string;
  readonly token: Uint8Array;
  readonly port: number;
  readonly addrs: readonly string[];
  readonly name: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();
const bytesOf = (bytes: Bytes): Uint8Array<ArrayBuffer> => new Uint8Array(bytes);
const concat = (parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  parts.reduce((offset, part) => { out.set(part, offset); return offset + part.length; }, 0);
  return out;
};

export const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const b64url = (bytes: Bytes): string =>
  btoa(Array.from(bytesOf(bytes), (byte) => String.fromCharCode(byte)).join(''))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const unb64url = (str: string): Uint8Array<ArrayBuffer> => {
  const value = str.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(value + '='.repeat((4 - value.length % 4) % 4)), (char) => char.charCodeAt(0));
};

export const randomBytesEffect = (size: number): Effect.Effect<Uint8Array<ArrayBuffer>> =>
  Effect.sync(() => crypto.getRandomValues(new Uint8Array(size)));
export const randomBytes = (size: number): Uint8Array<ArrayBuffer> => Effect.runSync(randomBytesEffect(size));
const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
export const randomId = (size = 8): string => bytesToHex(randomBytes(size));

/** uint32be(json length) || UTF-8 JSON object || binary payload. */
export const frame = (json: JsonObject | null | undefined, binary?: Bytes | null): Uint8Array<ArrayBuffer> => {
  const encoded = enc.encode(JSON.stringify(json ?? {}));
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, encoded.length);
  return concat([length, encoded, binary == null ? new Uint8Array(0) : bytesOf(binary)]);
};

export const unframe = (bytes: Bytes): Frame => {
  const value = bytesOf(bytes);
  if (value.length < 4) throw new Error('bad frame');
  const length = new DataView(value.buffer).getUint32(0);
  if (length > value.length - 4) throw new Error('bad frame');
  const json: unknown = JSON.parse(dec.decode(value.subarray(4, 4 + length)));
  if (!isJsonObject(json)) throw new Error('frame JSON must be an object');
  return { json, binary: value.subarray(4 + length) };
};

const attempt = <A>(operation: () => Promise<A>): Effect.Effect<A, unknown> =>
  Effect.tryPromise({ try: operation, catch: (error) => error });

const hkdfKey = (secret: Bytes, salt: string, info: string): Effect.Effect<CryptoKey, unknown> =>
  attempt(() => crypto.subtle.importKey('raw', bytesOf(secret), 'HKDF', false, ['deriveKey'])).pipe(
    Effect.flatMap((base) => attempt(() => crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(salt), info: enc.encode(info) },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']))),
  );
export const pairKeyEffect = (token: Bytes, hubId: string): Effect.Effect<CryptoKey, unknown> =>
  hkdfKey(token, 'i6-share-pair', hubId);
export const deviceKeyEffect = (secret: Bytes, deviceId: string): Effect.Effect<CryptoKey, unknown> =>
  hkdfKey(secret, 'i6-share-v1', deviceId);
export const pairKey = (token: Bytes, hubId: string): Promise<CryptoKey> => runEffect(pairKeyEffect(token, hubId));
export const deviceKey = (secret: Bytes, deviceId: string): Promise<CryptoKey> => runEffect(deviceKeyEffect(secret, deviceId));

export const sealEffect = (key: CryptoKey, aad: string, json: JsonObject, binary?: Bytes | null): Effect.Effect<Sealed, unknown> =>
  randomBytesEffect(12).pipe(Effect.flatMap((iv) =>
    attempt(() => crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, frame(json, binary)))
      .pipe(Effect.map((ciphertext) => ({ body: concat([iv, new Uint8Array(ciphertext)]), iv })))));
export const seal = (key: CryptoKey, aad: string, json: JsonObject, binary?: Bytes | null): Promise<Sealed> =>
  runEffect(sealEffect(key, aad, json, binary));
export const openEffect = (key: CryptoKey, aad: string, body: Bytes): Effect.Effect<Envelope, unknown> =>
  Effect.suspend(() => {
    const value = bytesOf(body);
    if (value.length < 28) return Effect.fail(new Error('short envelope'));
    const iv = value.slice(0, 12);
    return attempt(() => crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, value.subarray(12)))
      .pipe(Effect.flatMap((plaintext) => Effect.try({ try: () => ({ ...unframe(plaintext), iv }), catch: (error) => error })));
  });
export const open = (key: CryptoKey, aad: string, body: Bytes): Promise<Envelope> =>
  runEffect(openEffect(key, aad, body));
export const requestAad = (op: string, deviceId: string): string => `i6 req ${op} ${deviceId}`;
export const responseAad = (op: string, requestIv: Bytes): string => `i6 res ${op} ${b64url(requestIv)}`;

const hexToBytes = (hex: string): Uint8Array<ArrayBuffer> => {
  if (!/^[0-9a-f]{16}$/i.test(hex)) throw new Error('invalid hub id');
  return Uint8Array.from(Array.from({ length: 8 }, (_, index) => Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)));
};

/** Pairing payload is deliberately compact enough to fit into a QR code. */
export const encodePairPayload = ({ hubId, token, port, addrs, name }: PairPayload): string => {
  if (token.length !== 16) throw new Error('invalid pairing token');
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('invalid port');
  const ips = addrs.map(ipToBytes).filter((ip) => ip !== null).slice(0, 8);
  return b64url(concat([
    Uint8Array.of(1), hexToBytes(hubId), token, Uint8Array.of(port >> 8, port & 255, ips.length),
    ...ips.flatMap((ip) => [Uint8Array.of(ip.length === 4 ? 4 : 6), ip]), enc.encode(name.slice(0, 40)),
  ]));
};

export const decodePairPayload = (str: string): PairPayload => {
  const value = unb64url(str.trim());
  if (value[0] !== 1) throw new Error('unsupported pairing code');
  if (value.length < 28) throw new Error('truncated pairing code');
  const view = new DataView(value.buffer);
  const port = view.getUint16(25);
  const count = view.getUint8(27);
  const addressData = Array.from({ length: count }).reduce<Readonly<{ offset: number; addrs: readonly string[] }>>((state) => {
    if (state.offset >= value.length) throw new Error('truncated pairing code');
    const family = view.getUint8(state.offset);
    if (family !== 4 && family !== 6) throw new Error('unsupported address family');
    const end = state.offset + 1 + (family === 4 ? 4 : 16);
    if (end > value.length) throw new Error('truncated pairing code');
    return { offset: end, addrs: [...state.addrs, bytesToIp(value.subarray(state.offset + 1, end))] };
  }, { offset: 28, addrs: [] });
  return {
    hubId: bytesToHex(value.subarray(1, 9)), token: value.slice(9, 25), port,
    addrs: addressData.addrs, name: dec.decode(value.subarray(addressData.offset)),
  };
};
export const pairPayloadFromText = (text: string): PairPayload => decodePairPayload(/pair=([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? text);
export const pairLink = (payload: string): string => `${APP_URL}#pair=${payload}`;

/** Strict IP parsing also prevents malformed LAN addresses from silently wrapping. */
export const ipToBytes = (address: string): Uint8Array<ArrayBuffer> | null => {
  const ip = address.replace(/^\[|\]$/g, '').replace(/^::ffff:(?=\d+\.)/i, '').replace(/%.*$/, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const octets = ip.split('.').map(Number);
    return octets.every((octet) => octet <= 255) ? Uint8Array.from(octets) : null;
  }
  if (!ip.includes(':')) return null;
  const halves = ip.split('::');
  if (halves.length > 2) return null;
  const [head = '', tail] = halves;
  const left = head === '' ? [] : head.split(':');
  const right = tail === undefined || tail === '' ? [] : tail.split(':');
  const missing = 8 - left.length - right.length;
  if (tail !== undefined && missing < 1) return null;
  const groups = [...left, ...Array.from({ length: tail === undefined ? 0 : missing }, () => '0'), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[\da-f]{1,4}$/i.test(group))) return null;
  return Uint8Array.from(groups.flatMap((group) => {
    const value = Number.parseInt(group, 16);
    return [value >> 8, value & 255];
  }));
};
export const bytesToIp = (bytes: Uint8Array): string => {
  if (bytes.length === 4) return [...bytes].join('.');
  if (bytes.length !== 16) throw new Error('invalid IP byte length');
  const value = bytesOf(bytes);
  const view = new DataView(value.buffer);
  return Array.from({ length: 8 }, (_, index) => view.getUint16(index * 2).toString(16))
    .join(':').replace(/(^|:)0(:0)+(:|$)/, '::').replace(/:{3,}/g, '::');
};
export const isPrivateIp = (ip: string): boolean => {
  const bytes = ipToBytes(ip);
  if (bytes === null) return false;
  const view = new DataView(bytes.buffer);
  const first = view.getUint8(0);
  const second = view.getUint8(1);
  if (bytes.length === 4) return first === 10 || first === 127 ||
    (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168) ||
    (first === 169 && second === 254);
  return (first & 0xfe) === 0xfc || (first === 0xfe && (second & 0xc0) === 0x80) ||
    bytes.every((byte, index) => byte === (index === 15 ? 1 : 0));
};
export const baseUrl = (ip: string, port = PORT): string => `http://${ip.includes(':') ? `[${ip}]` : ip}:${String(port)}`;

export interface Backoff { readonly next: () => number; readonly reset: () => void }
/** Pure backoff calculation; random input is explicit so retries are deterministic in tests. */
export const backoffDelay = (attempt: number, min: number, max: number, random: number): number => {
  const base = Math.min(max, min * 2 ** attempt);
  return base / 2 + random * (base / 2);
};
/** Compatibility boundary with Effect Ref keeping retry state out of domain objects. */
export const createBackoff = (min = 500, max = 30_000, random: () => number = Math.random): Backoff => {
  const attempts = Effect.runSync(Ref.make(0));
  return {
    next: () => Effect.runSync(Ref.getAndUpdate(attempts, (attempt) => attempt + 1).pipe(
      Effect.map((attempt) => backoffDelay(attempt, min, max, random())))),
    reset: () => { Effect.runSync(Ref.set(attempts, 0)); },
  };
};
export const sleepEffect = (ms: number): Effect.Effect<void> => Effect.sleep(ms);
export const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  Effect.runPromise(sleepEffect(ms), signal === undefined ? {} : { signal });

export const cleanFileName = (name: string | null | undefined): string => {
  const cleaned = Array.from(name ?? '', (char) =>
    char === '/' || char === '\\' || char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? '_' : char)
    .join('').replace(/^\.+/, '').trim().slice(0, 200);
  return cleaned || 'file';
};
