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

import { Effect, Ref } from 'effect';
import { MAX_BODY, createBackoff } from '../public/lib/proto.js';


export interface TCPSocketInfo {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
  readonly remoteAddress?: string | undefined;
  readonly remotePort?: number | undefined;
  readonly localAddress?: string | undefined;
  readonly localPort?: number | undefined;
}
export interface TCPSocket { readonly opened: Promise<TCPSocketInfo>; readonly close: () => Promise<void>; readonly closed?: Promise<void> }
export interface TCPListenerInfo { readonly readable: ReadableStream<TCPSocket>; readonly localAddress: string; readonly localPort: number }
export interface TCPListener { readonly opened: Promise<TCPListenerInfo>; readonly close: () => Promise<void>; readonly closed?: Promise<void> }
export interface TCPListenOptions { readonly localPort: number; readonly backlog?: number; readonly ipv6Only?: boolean }
export type TCPListenerFactory = (host: string, options: TCPListenOptions) => TCPListener;
export interface ParsedHead {
  readonly method: string; readonly target: string; readonly path: string; readonly query: URLSearchParams;
  readonly headers: Readonly<Record<string, string>>; readonly http10: boolean;
}
export interface HttpRequest {
  readonly method: string; readonly path: string; readonly query: URLSearchParams;
  readonly headers: Readonly<Record<string, string>>; readonly body: Uint8Array<ArrayBuffer>;
  readonly remoteAddress: string; readonly remotePort: number | undefined; readonly localAddress: string;
}
export interface HttpResponse { readonly status: number; readonly headers?: Readonly<Record<string, unknown>>; readonly body?: unknown }
export interface ServerState {
  readonly status: 'starting' | 'listening' | 'error' | 'closed'; readonly host: string | null;
  readonly port: number; readonly error: string | null; readonly retryAt: number | null;
}
export interface ServerOptions {
  readonly port: number; readonly handler: (request: HttpRequest) => Promise<HttpResponse>;
  readonly TCPServerSocket?: TCPListenerFactory; readonly hosts?: readonly string[];
  readonly idleTimeoutMs?: number; readonly maxConnections?: number; readonly maxBody?: number;
  readonly backoff?: { readonly next: () => number; readonly reset: () => void };
}
export interface ServerController extends EventTarget {
  readonly state: ServerState; readonly ready: Promise<void>; readonly connections: number;
  readonly close: () => void; readonly restart: () => void;
}
declare global { var TCPServerSocket: (new (host: string, options: TCPListenOptions) => TCPListener) | undefined; }
const browserSocketFactory = (): TCPListenerFactory => {
  const Constructor = globalThis.TCPServerSocket;
  if (Constructor === undefined) throw new TypeError('TCPServerSocket is not available');
  return (host, options) => new Constructor(host, options);
};

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

const STATUS_TEXT: Readonly<Record<number, string>> = {
  200: 'OK', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
  404: 'Not Found', 405: 'Method Not Allowed', 408: 'Request Timeout', 411: 'Length Required',
  413: 'Payload Too Large', 431: 'Request Header Fields Too Large', 500: 'Internal Server Error',
  501: 'Not Implemented', 503: 'Service Unavailable', 505: 'HTTP Version Not Supported',
};

const enc = new TextEncoder();
const dec = new TextDecoder();
const noop = (): undefined => undefined;
const TOKEN_RE = /^[!#$%&'*+.^_`|~0-9a-z-]+$/;

/** Runs fn and swallows both sync throws and async rejections. */
function quiet(fn: () => unknown): void {
  Effect.runFork(Effect.ignore(Effect.tryPromise(async () => { await fn(); })));
}

/** Strips the IPv4-mapped IPv6 prefix that dual-stack sockets report. */
export function normalizeAddress(addr: unknown): string {
  return typeof addr === 'string' ? addr.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, '') : '';
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  if (!a.length) return new Uint8Array(b);
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** Index just past the blank line ending the head (CRLFCRLF, tolerating bare LFs), or -1. */
export function headEnd(buf: Uint8Array, limit: number): number {
  const n = Math.min(buf.length, limit + 4);
  for (let i = 0; i < n; i++) {
    if (buf[i] !== 10) continue;
    if (buf[i + 1] === 10) return i + 2;
    if (buf[i + 1] === 13 && buf[i + 2] === 10) return i + 3;
  }
  return -1;
}

const httpError = (status: number, code: string): Error & { readonly status: number; readonly code: string } => Object.assign(new Error(code), { status, code });
const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);
export const httpFailure = (error: unknown): { readonly status: number; readonly code: string } => {
  if (error instanceof Error && 'status' in error && typeof error.status === 'number' && 'code' in error && typeof error.code === 'string') return { status: error.status, code: error.code };
  return { status: 400, code: 'bad-request' };
};

/** Parses the request line + headers. Throws HttpError on anything malformed. */
export function parseHead(text: string): ParsedHead {
  const lines = text.split(/\r?\n/);
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  const m = /^([A-Z]{1,16}) (\S{1,8192}) HTTP\/1\.([01])$/.exec(lines[0] ?? '');
  if (!m) {
    if (/^[A-Z]+ \S+ HTTP\/\d/.test(lines[0] ?? '')) throw httpError(505, 'version');
    throw httpError(400, 'bad-request');
  }
  const first = m[0];
  const method = first.slice(0, first.indexOf(' '));
  const target = first.slice(first.indexOf(' ') + 1, first.lastIndexOf(' '));
  const minor = first.slice(-1);
  const headers: Record<string, string> = {};
  for (const line of lines.slice(1)) {
    if (/^[ \t]/.test(line)) throw httpError(400, 'bad-request'); // obsolete line folding
    const c = line.indexOf(':');
    if (c <= 0) throw httpError(400, 'bad-request');
    const name = line.slice(0, c).toLowerCase();
    if (!TOKEN_RE.test(name)) throw httpError(400, 'bad-request');
    const value = line.slice(c + 1).trim();
    if (/[\0\r\n]/.test(value)) throw httpError(400, 'bad-request');
    const previous = headers[name];
    if (Object.hasOwn(headers, name) && previous !== undefined) {
      if (name === 'host') throw httpError(400, 'bad-request');
      if (name === 'content-length') {
        if (headers[name] !== value) throw httpError(400, 'bad-request');
        continue;
      }
      headers[name] = `${previous}, ${value}`;
    } else headers[name] = value;
  }
  let url: URL;
  try {
    if (target === '*' && method === 'OPTIONS') url = new URL('http://h/');
    else if (target.startsWith('/')) url = new URL(target, 'http://h');
    else if (/^https?:\/\//i.test(target)) url = new URL(target);
    else throw new Error('target');
  } catch { throw httpError(400, 'bad-request'); }
  return { method, target, path: url.pathname, query: url.searchParams, headers, http10: minor === '0' };
}

function bodyBytes(body: unknown): Uint8Array {
  if (body == null) return new Uint8Array(0);
  if (typeof body === 'string') return enc.encode(body);
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  return enc.encode(JSON.stringify(body));
}

const clean = (v: unknown): string => String(v).replace(/[\r\n\0]/g, ' ');

/** Serialises a response head (+ body for small bodies). Exported for tests. */
export function serializeResponse(res: HttpResponse | null | undefined, keepAlive: boolean, idleTimeoutMs = IDLE_TIMEOUT_MS): { readonly head: Uint8Array<ArrayBuffer>; readonly body: Uint8Array } {
  const status = res !== null && res !== undefined && Number.isInteger(res.status) && res.status >= 100 && res.status <= 599 ? res.status : 500;
  const body = status === 204 || status === 304 ? new Uint8Array(0) : bodyBytes(res?.body);
  const hdrs: Record<string, string> = { ...CORS_HEADERS };
  for (const [k, v] of Object.entries(res?.headers ?? {})) {
    if (TOKEN_RE.test(k.toLowerCase()) && v != null && !/^(content-length|connection|keep-alive|transfer-encoding)$/i.test(k)) hdrs[k] = clean(v);
  }
  if (status !== 204 && status !== 304) hdrs['Content-Length'] = String(body.length);
  hdrs['Connection'] = keepAlive ? 'keep-alive' : 'close';
  if (keepAlive) hdrs['Keep-Alive'] = `timeout=${String(Math.round(idleTimeoutMs / 1000))}`;
  let head = `HTTP/1.1 ${String(status)} ${STATUS_TEXT[status] ?? 'Status'}\r\n`;
  for (const [k, v] of Object.entries(hdrs)) head += `${k}: ${v}\r\n`;
  head += '\r\n';
  return { head: enc.encode(head), body };
}

export function withTimeout<A>(promise: Promise<A>, ms: number, onTimeout: () => A | PromiseLike<A>): Promise<A> {
  return Effect.runPromise(Effect.tryPromise(() => promise).pipe(
    Effect.timeoutOrElse({ duration: ms, orElse: () => Effect.tryPromise(async () => onTimeout()) }),
  ));
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
  TCPServerSocket = browserSocketFactory(),
  hosts = ['::', '0.0.0.0'],
  idleTimeoutMs = IDLE_TIMEOUT_MS,
  maxConnections = MAX_CONNECTIONS,
  maxBody = MAX_BODY,
  backoff = createBackoff(1000, 30000),
}: ServerOptions): ServerController {

  const events = new EventTarget();
  const conns = new Set<{ readonly abort: () => void }>();
  const stopped = Effect.runSync(Ref.make(false));
  const isStopped = (): boolean => Effect.runSync(Ref.get(stopped));
  let current: { readonly close: () => void } | null = null;   // { close() } of the live listener
  let wake: (() => void) | null = null;      // resolves the backoff sleep early
  const ready = Promise.withResolvers<undefined>();
  let state: ServerState = { status: 'starting', host: null, port, error: null, retryAt: null };

  const setState = (s: Partial<ServerState>): void => {
    state = { ...state, ...s };
    events.dispatchEvent(new CustomEvent('state', { detail: state }));
  };
  const report = (e: unknown): void => { events.dispatchEvent(new CustomEvent('connection-error', { detail: e })); };

  const close = (): void => {
    Effect.runSync(Ref.set(stopped, true));
    current?.close();
    for (const c of conns) c.abort();
    wake?.();
    setState({ status: 'closed', retryAt: null });
  };
  const restart = (): void => {
    if (isStopped()) return;
    backoff.reset();
    if (wake) wake();
    else current?.close(); // the accept loop will notice and re-listen immediately
  };

  async function listen(): Promise<{ readonly srv: TCPListener; readonly info: TCPListenerInfo; readonly host: string }> {
    let lastErr: unknown;
    for (const host of hosts) {
      let srv: TCPListener | undefined;
      try {
        srv = TCPServerSocket(host, { localPort: port });
        const info = await srv.opened;
        return { srv, info, host };
      } catch (e) {
        lastErr = e;
        quiet(() => srv?.close());
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(lastErr === undefined ? 'listen failed' : errorMessage(lastErr));
  }

  async function loop(): Promise<void> {
    while (!isStopped()) {
      let srv: TCPListener | undefined;
      try {
        const l = await listen();
        srv = l.srv;
        if (isStopped()) { quiet(() => srv?.close()); break; }
        const reader = l.info.readable.getReader();
        current = { close: () => { quiet(() => reader.cancel()); quiet(() => srv?.close()); } };
        backoff.reset();
        setState({ status: 'listening', host: l.host, port: l.info.localPort, error: null, retryAt: null });
        ready.resolve(undefined);
        for (;;) {
          const { value: sock, done } = await reader.read();
          if (done) break;
          if (conns.size >= maxConnections) { quiet(() => sock.close()); continue; }
          quiet(() => serveConnection(sock).catch(report));
        }
        quiet(() => { reader.releaseLock(); });
        if (!isStopped()) throw new Error('listener closed');
      } catch (e) {
        current = null;
        quiet(() => srv?.close());
        if (isStopped()) break;
        const delay = backoff.next();
        setState({ status: 'error', error: errorMessage(e), retryAt: Date.now() + delay });
        await new Promise<void>((r) => { const t = setTimeout(r, delay); wake = () => { clearTimeout(t); r(); }; });
        wake = null;
        if (!isStopped()) setState({ status: 'starting', retryAt: null });
      }
    }
  }

  async function serveConnection(sock: TCPSocket): Promise<void> {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let writer: WritableStreamDefaultWriter<Uint8Array> | undefined;
    const conn = { abort: () => { quiet(() => reader?.cancel()); quiet(() => writer?.abort()); } };
    conns.add(conn);
    try {
      const info = await withTimeout(sock.opened, 10_000, () => { throw new Error('open timeout'); });
      const activeReader = info.readable.getReader();
      const activeWriter = info.writable.getWriter();
      reader = activeReader;
      writer = activeWriter;
      const remoteAddress = normalizeAddress(info.remoteAddress);
      const localAddress = normalizeAddress(info.localAddress);
      const remotePort = info.remotePort;

      let buf = new Uint8Array(0);
      const read = async (): Promise<Uint8Array | null> => {
        const r = await withTimeout<ReadableStreamReadResult<Uint8Array>>(activeReader.read(), idleTimeoutMs, () => ({ done: true, value: undefined }));
        if (r.done) return null;
        return r.value;
      };
      const send = async (res: HttpResponse, keepAlive: boolean): Promise<void> => {
        const { head, body } = serializeResponse(res, keepAlive, idleTimeoutMs);
        const write = (chunk: Uint8Array): Promise<void> => withTimeout(activeWriter.write(chunk), WRITE_TIMEOUT_MS, () => { throw new Error('write timeout'); });
        if (body.length <= 64 * 1024) await write(concat(head, body));
        else { await write(head); await write(body); }
      };
      const fail = (status: number, code: string): Promise<void> => send({ status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: code }) }, false);

      for (;;) {
        // ---- head
        while (buf.length && (buf[0] === 13 || buf[0] === 10)) buf = buf.subarray(1); // stray CRLF between requests
        let end: number;
        while ((end = headEnd(buf, HEADER_LIMIT)) < 0) {
          if (buf.length > HEADER_LIMIT) { await fail(431, 'too-large'); return; }
          const chunk = await read();
          if (!chunk) return; // closed or idle timeout
          buf = concat(buf, chunk);
          while (buf.length && (buf[0] === 13 || buf[0] === 10)) buf = buf.subarray(1);
        }
        if (end > HEADER_LIMIT + 4) { await fail(431, 'too-large'); return; }
        let req: ParsedHead;
        try { req = parseHead(dec.decode(buf.subarray(0, end))); } catch (e) {
          const failure = httpFailure(e);
          await fail(failure.status, failure.code);
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
          if (take < chunk.length) buf = new Uint8Array(chunk.subarray(take));
        }

        const connHdr = (h['connection'] ?? '').toLowerCase();
        const keepAlive = req.http10 ? /\bkeep-alive\b/.test(connHdr) : !/\bclose\b/.test(connHdr);

        // ---- dispatch
        let res: HttpResponse | undefined;
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
        }
        await send(res, keepAlive);
        if (!keepAlive) return;
      }
    } finally {
      conns.delete(conn);
      if (writer) {
        await withTimeout(writer.close().catch(noop), 5000, noop).catch(noop);
        quiet(() => writer?.abort());
        quiet(() => writer?.releaseLock());
      }
      if (reader) {
        await withTimeout(reader.cancel().catch(noop), 1000, noop).catch(noop);
        quiet(() => reader?.releaseLock());
      }
      quiet(() => sock.close());
    }
  }

  quiet(loop);
  return {
    get state(): ServerState { return state; },
    ready: ready.promise, close, restart,
    get connections(): number { return conns.size; },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
  };
}
