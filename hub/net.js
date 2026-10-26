// Finds this computer's LAN addresses with Direct Sockets: a *connected* UDP socket gets a
// local address chosen by the OS routing table, and connecting a UDP socket sends no packet.
// DOM-free apart from the optional `online` listener.

import { isPrivateIp, ipToBytes, bytesToIp } from './lib/proto.js';

const PROBES = [
  { remoteAddress: '8.8.8.8', remotePort: 53 },
  { remoteAddress: '2001:4860:4860::8888', remotePort: 53 },
];
const MANUAL_KEY = 'manualAddrs';
const LEARNED_TTL_MS = 60 * 60 * 1000;
export const MAX_ADDRS = 8; // the pairing payload carries at most 8

/** Canonical form of an IP literal, or null if it isn't one. */
export function normalizeIp(ip) {
  const b = ipToBytes(String(ip || '').trim());
  return b ? bytesToIp(b) : null;
}

/**
 * IPv4: private (RFC1918) and not loopback/link-local. IPv6: unique-local (fc00::/7) only.
 * Chrome treats global IPv6 addresses as public, so an HTTPS page could never reach them
 * over plain HTTP; link-local needs a zone id that browsers can't express.
 */
export function isUsableAddr(ip) {
  const n = normalizeIp(ip);
  if (!n) return false;
  const b = ipToBytes(n);
  if (b.length === 4) return isPrivateIp(n) && b[0] !== 127 && !(b[0] === 169 && b[1] === 254);
  return (b[0] & 0xfe) === 0xfc;
}

async function probe(UDPSocket, opts, timeoutMs) {
  let sock;
  let t;
  try {
    sock = new UDPSocket(opts);
    const info = await Promise.race([
      sock.opened,
      new Promise((_, reject) => { t = setTimeout(() => reject(new Error('timeout')), timeoutMs); }),
    ]);
    return info?.localAddress || null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
    if (sock) { try { await sock.close(); } catch { /* ignore */ } }
  }
}

/** Detected usable local addresses (IPv4 first). */
export async function detectAddrs({ UDPSocket = globalThis.UDPSocket, timeoutMs = 3000 } = {}) {
  if (typeof UDPSocket !== 'function') return [];
  const found = await Promise.all(PROBES.map((p) => probe(UDPSocket, p, timeoutMs)));
  return [...new Set(found.map(normalizeIp).filter((a) => a && isUsableAddr(a)))];
}

/**
 * Keeps the list of addresses advertised to phones: manual (from settings) first, then
 * detected, then ones learnt from incoming connections. Emits 'change' when it changes.
 */
export class AddressBook extends EventTarget {
  constructor({ kv, UDPSocket = globalThis.UDPSocket, intervalMs = 60_000 } = {}) {
    super();
    this.kv = kv;
    this.UDPSocket = UDPSocket;
    this.intervalMs = intervalMs;
    this.manual = [];
    this.detected = [];
    this.learned = new Map(); // addr → last seen
    this.lastDetect = 0;
    this._last = '';
  }

  async init() {
    try {
      const m = await this.kv?.get(MANUAL_KEY);
      if (Array.isArray(m)) this.manual = m.map(normalizeIp).filter(Boolean);
    } catch { /* ignore */ }
    await this.refresh();
    this.timer = setInterval(() => this.refresh(), this.intervalMs);
    this.timer.unref?.();
    globalThis.addEventListener?.('online', this._onOnline = () => this.refresh());
    return this;
  }

  dispose() {
    clearInterval(this.timer);
    if (this._onOnline) globalThis.removeEventListener?.('online', this._onOnline);
  }

  get addrs() {
    const now = Date.now();
    const learned = [...this.learned].filter(([, t]) => now - t < LEARNED_TTL_MS).map(([a]) => a);
    const all = [...new Set([...this.manual, ...this.detected, ...learned])];
    // IPv4 before IPv6 so the most useful addresses survive the cap
    return [...all.filter((a) => !a.includes(':')), ...all.filter((a) => a.includes(':'))].slice(0, MAX_ADDRS);
  }

  async refresh() {
    try { this.detected = await detectAddrs({ UDPSocket: this.UDPSocket }); } catch { this.detected = []; }
    this.lastDetect = Date.now();
    this._changed();
    return this.detected;
  }

  /** Accepts a list (or comma/space separated string) of IPs; returns the invalid entries. */
  async setManual(list) {
    const items = (Array.isArray(list) ? list : String(list || '').split(/[\s,;]+/)).map((s) => String(s).trim()).filter(Boolean);
    const valid = [];
    const invalid = [];
    for (const s of items) { const n = normalizeIp(s); (n ? valid : invalid).push(n || s); }
    this.manual = [...new Set(valid)];
    try { await this.kv?.put(MANUAL_KEY, this.manual); } catch { /* ignore */ }
    this._changed();
    return invalid;
  }

  /** Records the local address an incoming connection arrived on (it is reachable for sure). */
  observe(localAddress) {
    const n = normalizeIp(localAddress);
    if (!n || !isUsableAddr(n)) return;
    const isNew = !this.learned.has(n);
    this.learned.set(n, Date.now());
    if (isNew) this._changed();
  }

  _changed() {
    const key = this.addrs.join(',');
    if (key === this._last) return;
    this._last = key;
    this.dispatchEvent(new CustomEvent('change', { detail: this.addrs }));
  }
}
