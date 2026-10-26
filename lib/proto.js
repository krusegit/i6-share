// i6-share wire protocol, shared by the phone PWA (client) and the Linux hub
// IWA (server). See docs/PROTOCOL.md for the full description.
//
// Everything except GET /i6/hello is a POST whose body is an encrypted
// envelope:  IV (12 bytes) || AES-256-GCM( frame )
// and a frame is:  uint32be jsonLength || UTF-8 JSON || binary payload

export const PROTOCOL_VERSION = 1;
export const PORT = 47616;
export const APP_URL = 'https://krusegit.github.io/i6-share/';
export const CHUNK_SIZE = 4 * 1024 * 1024;           // plaintext bytes per upload/pull
export const MAX_BODY = CHUNK_SIZE + 64 * 1024;       // hub rejects bigger request bodies
export const SYNC_WAIT_MS = 25000;                    // long-poll duration for /i6/sync
export const PAIR_TOKEN_TTL_MS = 10 * 60 * 1000;

const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------------------------------------------------------------- encoding

export function b64url(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unb64url(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

export const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));
export const randomId = (n = 8) => [...randomBytes(n)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** frame = uint32be(len(json)) || json || binary */
export function frame(json, binary) {
  const j = enc.encode(JSON.stringify(json ?? {}));
  const bin = binary ? new Uint8Array(binary.buffer ?? binary, binary.byteOffset ?? 0, binary.byteLength) : new Uint8Array(0);
  const out = new Uint8Array(4 + j.length + bin.length);
  new DataView(out.buffer).setUint32(0, j.length);
  out.set(j, 4);
  out.set(bin, 4 + j.length);
  return out;
}

export function unframe(bytes) {
  const u = new Uint8Array(bytes);
  const len = new DataView(u.buffer, u.byteOffset, u.byteLength).getUint32(0);
  if (len > u.length - 4) throw new Error('bad frame');
  return { json: JSON.parse(dec.decode(u.subarray(4, 4 + len))), binary: u.subarray(4 + len) };
}

// ---------------------------------------------------------------- keys

async function hkdfKey(secretBytes, salt, info) {
  const base = await crypto.subtle.importKey('raw', secretBytes, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(salt), info: enc.encode(info) },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Key used only for the /i6/pair exchange, from the one-time QR token. */
export const pairKey = (tokenBytes, hubId) => hkdfKey(tokenBytes, 'i6-share-pair', hubId);

/** Long-term key shared by one phone and one hub after pairing. */
export const deviceKey = (secretBytes, deviceId) => hkdfKey(secretBytes, 'i6-share-v1', deviceId);

// ---------------------------------------------------------------- envelopes

/** Encrypts a frame. Returns {body, iv}. aad is a string. */
export async function seal(key, aad, json, binary) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, frame(json, binary));
  const body = new Uint8Array(12 + ct.byteLength);
  body.set(iv, 0);
  body.set(new Uint8Array(ct), 12);
  return { body, iv };
}

/** Decrypts an envelope. Throws if tampered / wrong key. Returns {json, binary, iv}. */
export async function open(key, aad, body) {
  const u = new Uint8Array(body);
  if (u.length < 28) throw new Error('short envelope');
  const iv = u.slice(0, 12);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, u.subarray(12));
  return { ...unframe(pt), iv };
}

/** AAD for a request to /i6/<op> from device (or 'pair' for pairing). */
export const requestAad = (op, deviceId) => `i6 req ${op} ${deviceId}`;
/** AAD for the response, bound to the request's IV so responses can't be swapped. */
export const responseAad = (op, requestIv) => `i6 res ${op} ${b64url(requestIv)}`;

// ---------------------------------------------------------------- pairing payload
//
// Binary, base64url encoded into the QR link  APP_URL#pair=<payload>
//   u8   version (1)
//   8B   hubId
//   16B  one-time pairing token
//   u16  port
//   u8   address count, then per address: u8 family (4|6) + 4 or 16 bytes
//   rest UTF-8 hub name

export function encodePairPayload({ hubId, token, port, addrs, name }) {
  const parts = [Uint8Array.of(1), hexToBytes(hubId), token, Uint8Array.of(port >> 8, port & 255)];
  const ips = addrs.map(ipToBytes).filter(Boolean).slice(0, 8);
  parts.push(Uint8Array.of(ips.length));
  for (const ip of ips) parts.push(Uint8Array.of(ip.length === 4 ? 4 : 6), ip);
  parts.push(enc.encode(String(name || '').slice(0, 40)));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return b64url(out);
}

export function decodePairPayload(str) {
  const u = unb64url(str.trim());
  if (u[0] !== 1) throw new Error('unsupported pairing code');
  let o = 1;
  const hubId = bytesToHex(u.subarray(o, o += 8));
  const token = u.slice(o, o += 16);
  const port = (u[o] << 8) | u[o + 1]; o += 2;
  const n = u[o++];
  const addrs = [];
  for (let i = 0; i < n; i++) {
    const len = u[o++] === 4 ? 4 : 16;
    addrs.push(bytesToIp(u.subarray(o, o += len)));
  }
  if (o > u.length || token.length !== 16) throw new Error('truncated pairing code');
  return { hubId, token, port, addrs, name: dec.decode(u.subarray(o)) };
}

/** Extracts the payload from a full link, a "#pair=..." fragment, or a bare code. */
export function pairPayloadFromText(text) {
  const m = String(text).match(/pair=([A-Za-z0-9_-]+)/);
  return decodePairPayload(m ? m[1] : text);
}

export const pairLink = (payload) => `${APP_URL}#pair=${payload}`;

// ---------------------------------------------------------------- addresses

const hexToBytes = (hex) => Uint8Array.from(hex.match(/../g).map((h) => parseInt(h, 16)));
const bytesToHex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

export function ipToBytes(ip) {
  ip = ip.replace(/^\[|\]$/g, '').replace(/^::ffff:(?=\d+\.)/i, '').split('%')[0];
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return Uint8Array.from(ip.split('.').map(Number));
  if (!ip.includes(':')) return null;
  const [head, tail] = ip.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups = [...h, ...Array(tail !== undefined ? 8 - h.length - t.length : 0).fill('0'), ...t];
  if (groups.length !== 8) return null;
  const out = new Uint8Array(16);
  groups.forEach((g, i) => { const v = parseInt(g, 16); out[i * 2] = v >> 8; out[i * 2 + 1] = v & 255; });
  return out;
}

export function bytesToIp(b) {
  if (b.length === 4) return [...b].join('.');
  const g = [];
  for (let i = 0; i < 16; i += 2) g.push(((b[i] << 8) | b[i + 1]).toString(16));
  return g.join(':').replace(/(^|:)0(:0)+(:|$)/, '::').replace(/:{3,}/, '::');
}

/** True for RFC1918 / link-local / ULA / loopback addresses. */
export function isPrivateIp(ip) {
  const b = ipToBytes(ip);
  if (!b) return false;
  if (b.length === 4) {
    return b[0] === 10 || b[0] === 127 || (b[0] === 172 && b[1] >= 16 && b[1] <= 31) ||
      (b[0] === 192 && b[1] === 168) || (b[0] === 169 && b[1] === 254);
  }
  return (b[0] & 0xfe) === 0xfc || (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) || b.every((x, i) => x === (i === 15 ? 1 : 0));
}

/** http://host:port base URL, bracketing IPv6. */
export function baseUrl(ip, port = PORT) {
  return `http://${ip.includes(':') ? `[${ip}]` : ip}:${port}`;
}

// ---------------------------------------------------------------- retry

/** Exponential backoff with "equal jitter": base/2 + random(base/2). */
export class Backoff {
  constructor(min = 500, max = 30000) { this.min = min; this.max = max; this.attempt = 0; }
  next() {
    const base = Math.min(this.max, this.min * 2 ** this.attempt++);
    return base / 2 + Math.random() * (base / 2);
  }
  reset() { this.attempt = 0; }
}

export const sleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(signal.reason);
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason); }, { once: true });
});

/** Strips path separators and control characters from a received file name. */
export function cleanFileName(name) {
  const n = String(name || '').replace(/[\\/\0-\x1f\x7f]/g, '_').replace(/^\.+/, '').trim().slice(0, 200);
  return n || 'file';
}
