// Tiny HTTP/1.1 server on top of Chrome's Direct Sockets API (TCPServerSocket).
// DOM-free so it also runs under Node with a TCPServerSocket shim (tools/tcp-shim.mjs).
//
//   const server = startServer({ port, handler });
//   server.addEventListener('state', (e) => e.detail /* {status, host, port, error, retryAt} */);
//   handler: async ({method, path, query, headers, body, remoteAddress, remotePort, localAddress})
//            → {status, headers?, body?: Uint8Array|string}
//
// Content-Length bodies only (no chunked uploads), keep-alive with sequential requests,
// generic OPTIONS preflight, CORS headers on every response. Any malformed input or socket
// error only ends that one connection; if the listener dies it is restarted with backoff.

import { MAX_BODY, Backoff } from './lib/proto.js';

export const CORS_HEADERS = Object.freeze({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store',
});

export const HEADER_LIMIT = 16 * 1024;
export const IDLE_TIMEOUT_MS = 75_000;
const WRITE_TIMEOUT_MS = 60_000;
const MAX_CONNECTIONS = 256;

const STATUS_TEXT = {
  200: 'OK', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
  404: 'Not Found', 405: 'Method Not Allowed', 408: 'Request Timeout', 411: 'Length Required',
  413: 'Payload Too Large', 431: 'Request Header Fields Too Large', 500: 'Internal Server Error',
  501: 'Not Implemented', 503: 'Service Unavailable', 505: 'HTTP Version Not Supported',
};

const enc = new TextEncoder();
const dec = new TextDecoder();
const noop = () => {};
const TOKEN_RE = /^[!#$%&'*+.^_`|~0-9a-z-]+$/;

/** Runs fn and swallows both sync throws and async rejections. */
function quiet(fn) {
  try { const r = fn(); if (r && typeof r.then === 'function') r.then(noop, noop); } catch { /* ignore */ }
}

/** Strips the IPv4-mapped IPv6 prefix that dual-stack sockets report. */
export function normalizeAddress(addr) {
  return typeof addr === 'string' ? addr.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, '') : '';
}

function concat(a, b) {
  if (!a.length) return b;
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** Index just past the blank line ending the head (CRLFCRLF, tolerating bare LFs), or -1. */
function headEnd(buf, limit) {
  const n = Math.min(buf.length, limit + 4);
  for (let i = 0; i < n; i++) {
    if (buf[i] !== 10) continue;
    if (buf[i + 1] === 10) return i + 2;
    if (buf[i + 1] === 13 && buf[i + 2] === 10) return i + 3;
  }
  return -1;
}

class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

/** Parses the request line + headers. Throws HttpError on anything malformed. */
export function parseHead(text) {
  const lines = text.split(/\r?\n/);
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  const m = /^([A-Z]{1,16}) (\S{1,8192}) HTTP\/1\.([01])$/.exec(lines[0] || '');
  if (!m) {
    if (/^[A-Z]+ \S+ HTTP\/\d/.test(lines[0] || '')) throw new HttpError(505, 'version');
    throw new HttpError(400, 'bad-request');
  }
  const [, method, target, minor] = m;
  const headers = Object.create(null);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^[ \t]/.test(line)) throw new HttpError(400, 'bad-request'); // obsolete line folding
    const c = line.indexOf(':');
    if (c <= 0) throw new HttpError(400, 'bad-request');
    const name = line.slice(0, c).toLowerCase();
    if (!TOKEN_RE.test(name)) throw new HttpError(400, 'bad-request');
    const value = line.slice(c + 1).trim();
    if (/[\0\r\n]/.test(value)) throw new HttpError(400, 'bad-request');
    if (name in headers) {
      if (name === 'host') throw new HttpError(400, 'bad-request');
      if (name === 'content-length') {
        if (headers[name] !== value) throw new HttpError(400, 'bad-request');
        continue;
      }
      headers[name] += ', ' + value;
    } else headers[name] = value;
  }
  let url;
  try {
    if (target === '*' && method === 'OPTIONS') url = new URL('http://h/');
    else if (target.startsWith('/')) url = new URL(target, 'http://h');
    else if (/^https?:\/\//i.test(target)) url = new URL(target);
    else throw new Error('target');
  } catch { throw new HttpError(400, 'bad-request'); }
  return { method, target, path: url.pathname, query: url.searchParams, headers, http10: minor === '0' };
}

function bodyBytes(body) {
  if (body == null) return new Uint8Array(0);
  if (typeof body === 'string') return enc.encode(body);
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  return enc.encode(JSON.stringify(body));
}

const clean = (v) => String(v).replace(/[\r\n\0]/g, ' ');

/** Serialises a response head (+ body for small bodies). Exported for tests. */
export function serializeResponse(res, keepAlive, idleTimeoutMs = IDLE_TIMEOUT_MS) {
  const status = Number.isInteger(res?.status) && res.status >= 100 && res.status <= 599 ? res.status : 500;
  const body = status === 204 || status === 304 ? new Uint8Array(0) : bodyBytes(res?.body);
  const hdrs = { ...CORS_HEADERS };
  for (const [k, v] of Object.entries(res?.headers || {})) {
    if (TOKEN_RE.test(k.toLowerCase()) && v != null && !/^(content-length|connection|keep-alive|transfer-encoding)$/i.test(k)) hdrs[k] = clean(v);
  }
  if (status !== 204 && status !== 304) hdrs['Content-Length'] = String(body.length);
  hdrs.Connection = keepAlive ? 'keep-alive' : 'close';
  if (keepAlive) hdrs['Keep-Alive'] = `timeout=${Math.round(idleTimeoutMs / 1000)}`;
  let head = `HTTP/1.1 ${status} ${STATUS_TEXT[status] || 'Status'}\r\n`;
  for (const [k, v] of Object.entries(hdrs)) head += `${k}: ${v}\r\n`;
  head += '\r\n';
  return { head: enc.encode(head), body };
}

function withTimeout(promise, ms, onTimeout) {
  let t;
  return Promise.race([
    promise,
    new Promise((resolve, reject) => { t = setTimeout(() => { try { resolve(onTimeout()); } catch (e) { reject(e); } }, ms); }),
  ]).finally(() => clearTimeout(t));
}

/**
 * Starts listening (and keeps listening: the listener is re-created with exponential backoff
 * whenever it fails or dies). Returns an EventTarget with:
 *   .state      {status: 'starting'|'listening'|'error'|'closed', host, port, error, retryAt}
 *   .ready      Promise resolved the first time the socket is listening
 *   .restart()  retry now (resets backoff)
 *   .close()    stop for good
 *   .connections  number of open connections (getter)
 * Events: 'state' (detail = state), 'connection-error' (detail = Error; informational only).
 */
export function startServer({
  port,
  handler,
  TCPServerSocket = globalThis.TCPServerSocket,
  hosts = ['::', '0.0.0.0'],
  idleTimeoutMs = IDLE_TIMEOUT_MS,
  maxConnections = MAX_CONNECTIONS,
  maxBody = MAX_BODY,
  backoff = new Backoff(1000, 30000),
} = {}) {
  if (typeof TCPServerSocket !== 'function') throw new TypeError('TCPServerSocket is not available');
  if (typeof handler !== 'function') throw new TypeError('handler must be a function');

  const ctl = new EventTarget();
  const conns = new Set();
  let stopped = false;
  let current = null;   // { close() } of the live listener
  let wake = null;      // resolves the backoff sleep early
  let resolveReady;
  ctl.ready = new Promise((r) => { resolveReady = r; });
  ctl.state = { status: 'starting', host: null, port, error: null, retryAt: null };

  const setState = (s) => {
    ctl.state = { ...ctl.state, ...s };
    ctl.dispatchEvent(new CustomEvent('state', { detail: ctl.state }));
  };
  const report = (e) => { try { ctl.dispatchEvent(new CustomEvent('connection-error', { detail: e })); } catch { /* ignore */ } };

  Object.defineProperty(ctl, 'connections', { get: () => conns.size });
  ctl.close = () => {
    stopped = true;
    current?.close();
    for (const c of conns) c.abort();
    wake?.();
    setState({ status: 'closed', retryAt: null });
  };
  ctl.restart = () => {
    if (stopped) return;
    backoff.reset();
    if (wake) wake();
    else current?.close(); // the accept loop will notice and re-listen immediately
  };

  async function listen() {
    let lastErr;
    for (const host of hosts) {
      let srv;
      try {
        srv = new TCPServerSocket(host, { localPort: port });
        const info = await srv.opened;
        return { srv, info, host };
      } catch (e) {
        lastErr = e;
        if (srv) quiet(() => srv.close());
      }
    }
    throw lastErr || new Error('listen failed');
  }

  async function loop() {
    while (!stopped) {
      let srv;
      try {
        const l = await listen();
        srv = l.srv;
        if (stopped) { quiet(() => srv.close()); break; }
        const reader = l.info.readable.getReader();
        current = { close: () => { quiet(() => reader.cancel()); quiet(() => srv.close()); } };
        backoff.reset();
        setState({ status: 'listening', host: l.host, port: l.info.localPort ?? port, error: null, retryAt: null });
        resolveReady();
        for (;;) {
          const { value: sock, done } = await reader.read();
          if (done) break;
          if (!sock) continue;
          if (conns.size >= maxConnections) { quiet(() => sock.close()); continue; }
          serveConnection(sock).catch(report);
        }
        quiet(() => reader.releaseLock());
        if (!stopped) throw new Error('listener closed');
      } catch (e) {
        current = null;
        if (srv) quiet(() => srv.close());
        if (stopped) break;
        const delay = backoff.next();
        setState({ status: 'error', error: String(e?.message || e), retryAt: Date.now() + delay });
        await new Promise((r) => { const t = setTimeout(r, delay); wake = () => { clearTimeout(t); r(); }; });
        wake = null;
        if (!stopped) setState({ status: 'starting', retryAt: null });
      }
    }
  }

  async function serveConnection(sock) {
    let reader, writer;
    const conn = { abort: () => { quiet(() => reader?.cancel()); quiet(() => writer?.abort()); } };
    conns.add(conn);
    try {
      const info = await withTimeout(sock.opened, 10_000, () => { throw new Error('open timeout'); });
      reader = info.readable.getReader();
      writer = info.writable.getWriter();
      const remoteAddress = normalizeAddress(info.remoteAddress);
      const localAddress = normalizeAddress(info.localAddress);
      const remotePort = info.remotePort;

      let buf = new Uint8Array(0);
      const read = async () => {
        const r = await withTimeout(reader.read(), idleTimeoutMs, () => ({ done: true, timeout: true }));
        if (r.done) return null;
        return r.value instanceof Uint8Array ? r.value : new Uint8Array(r.value);
      };
      const send = async (res, keepAlive) => {
        const { head, body } = serializeResponse(res, keepAlive, idleTimeoutMs);
        const write = (chunk) => withTimeout(writer.write(chunk), WRITE_TIMEOUT_MS, () => { throw new Error('write timeout'); });
        if (body.length <= 64 * 1024) await write(concat(head, body));
        else { await write(head); await write(body); }
      };
      const fail = (status, code) => send({ status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: code }) }, false);

      for (;;) {
        // ---- head
        while (buf.length && (buf[0] === 13 || buf[0] === 10)) buf = buf.subarray(1); // stray CRLF between requests
        let end;
        while ((end = headEnd(buf, HEADER_LIMIT)) < 0) {
          if (buf.length > HEADER_LIMIT) { await fail(431, 'too-large'); return; }
          const chunk = await read();
          if (!chunk) return; // closed or idle timeout
          buf = concat(buf, chunk);
          while (buf.length && (buf[0] === 13 || buf[0] === 10)) buf = buf.subarray(1);
        }
        if (end > HEADER_LIMIT + 4) { await fail(431, 'too-large'); return; }
        let req;
        try { req = parseHead(dec.decode(buf.subarray(0, end))); } catch (e) {
          await fail(e.status || 400, e.code || 'bad-request');
          return;
        }
        buf = buf.subarray(end);
        const h = req.headers;

        // ---- body framing
        if (h['transfer-encoding'] !== undefined) { await fail(411, 'length-required'); return; }
        let len = 0;
        if (h['content-length'] !== undefined) {
          if (!/^\d{1,15}$/.test(h['content-length'])) { await fail(400, 'bad-request'); return; }
          len = Number(h['content-length']);
        } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
          await fail(411, 'length-required');
          return;
        }
        if (len > maxBody) { await fail(413, 'too-large'); return; }

        // ---- body
        const body = new Uint8Array(len);
        let have = Math.min(len, buf.length);
        body.set(buf.subarray(0, have));
        buf = buf.subarray(have);
        while (have < len) {
          const chunk = await read();
          if (!chunk) return;
          const take = Math.min(chunk.length, len - have);
          body.set(take === chunk.length ? chunk : chunk.subarray(0, take), have);
          have += take;
          if (take < chunk.length) buf = chunk.subarray(take);
        }

        const connHdr = (h.connection || '').toLowerCase();
        const keepAlive = req.http10 ? /\bkeep-alive\b/.test(connHdr) : !/\bclose\b/.test(connHdr);

        // ---- dispatch
        let res;
        if (req.method === 'OPTIONS') res = { status: 204 };
        else {
          try {
            res = await handler({
              method: req.method, path: req.path, query: req.query, headers: h, body,
              remoteAddress, remotePort, localAddress,
            });
          } catch (e) {
            report(e);
            res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: '{"error":"internal"}' };
          }
          if (!res || typeof res !== 'object') res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: '{"error":"internal"}' };
        }
        await send(res, keepAlive);
        if (!keepAlive) return;
      }
    } finally {
      conns.delete(conn);
      if (writer) {
        await withTimeout(writer.close().catch(noop), 5000, noop).catch(noop);
        quiet(() => writer.abort());
        quiet(() => writer.releaseLock());
      }
      if (reader) {
        await withTimeout(reader.cancel().catch(noop), 1000, noop).catch(noop);
        quiet(() => reader.releaseLock());
      }
      quiet(() => sock.close());
    }
  }

  loop();
  return ctl;
}
