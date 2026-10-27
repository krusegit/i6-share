import * as net from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CORS_HEADERS, HEADER_LIMIT, headEnd, httpFailure, normalizeAddress, parseHead, serializeResponse, startServer, withTimeout } from '../hub/http.js';
import type { HttpRequest, HttpResponse, ServerController, TCPListenerFactory, TCPSocket } from '../hub/http.js';
import { TCPServerSocket } from '../tools/tcp-shim.js';

const controllers: ServerController[] = [];
afterEach(() => { controllers.splice(0).forEach((server) => { server.close(); }); vi.restoreAllMocks(); });
const start = async (handler: (request: HttpRequest) => Promise<HttpResponse> = () => Promise.resolve({ status: 200, body: 'ok' }), options: Partial<Parameters<typeof startServer>[0]> = {}): Promise<ServerController> => {
  const server = startServer({ port: 0, handler, TCPServerSocket, hosts: ['127.0.0.1'], ...options });
  controllers.push(server); await server.ready; return server;
};
const exchange = (server: ServerController, chunks: readonly string[]): Promise<string> => new Promise((resolve, reject) => {
  const socket = net.connect(server.state.port, '127.0.0.1');
  const received: Buffer[] = [];
  socket.on('data', (chunk: Buffer) => { received.push(chunk); });
  socket.once('close', () => { resolve(Buffer.concat(received).toString()); });
  socket.once('error', reject);
  socket.once('connect', () => { chunks.forEach((chunk, index) => { setTimeout(() => { socket.write(chunk); }, index * 5); }); });
});

describe('HTTP pure functions', () => {
  it('normalizes addresses and finds both permitted head delimiters', () => {
    expect(normalizeAddress('::ffff:127.0.0.1')).toBe('127.0.0.1'); expect(normalizeAddress(null)).toBe(''); expect(httpFailure(new Error('other'))).toEqual({ status: 400, code: 'bad-request' });
    expect(normalizeAddress('::1')).toBe('::1');
    expect(headEnd(new TextEncoder().encode('x\n\n'), 99)).toBe(3);
    expect(headEnd(new TextEncoder().encode('x\r\n\r\n'), 99)).toBe(5);
    expect(headEnd(new TextEncoder().encode('x\nx'), 99)).toBe(-1);
  });
  it('parses URLs, HTTP versions, duplicate safe headers, and OPTIONS star', () => {
    const request = parseHead('POST /a?q=one HTTP/1.1\r\nHost: local\r\nContent-Length: 2\r\nContent-Length: 2\r\nX-Test: a\r\nX-Test: b\r\n\r\n');
    expect(request).toMatchObject({ method: 'POST', path: '/a', http10: false, headers: { 'x-test': 'a, b', 'content-length': '2' } });
    expect(request.query.get('q')).toBe('one');
    expect(parseHead('OPTIONS * HTTP/1.0\n\n')).toMatchObject({ path: '/', http10: true });
    expect(parseHead('GET http://example.org/x HTTP/1.1\n')).toMatchObject({ path: '/x' });
    expect(parseHead('GET / HTTP/1.1\nconstructor: safe\n')).toMatchObject({ headers: { constructor: 'safe' } });
  });
  it.each(['', 'wat', 'GET / HTTP/2.0', 'GET / HTTP/1.1\n folded: no', 'GET / HTTP/1.1\nno-colon', 'GET / HTTP/1.1\n: no', 'GET / HTTP/1.1\nwrong name: x', 'GET / HTTP/1.1\nX: a\0b', 'GET / HTTP/1.1\nHost: a\nHost: b', 'GET / HTTP/1.1\nContent-Length: 1\nContent-Length: 2', 'GET relative HTTP/1.1', 'GET http://[bad HTTP/1.1'])('rejects malformed request %j', (input) => { expect(() => parseHead(input)).toThrow(); });
  it('serializes status/body variants and prevents response splitting', () => {
    const decode = (response: ReturnType<typeof serializeResponse>): string => new TextDecoder().decode(response.head) + new TextDecoder().decode(response.body);
    expect(decode(serializeResponse(undefined, false))).toContain('500 Internal Server Error');
    expect(decode(serializeResponse(null, false))).toContain('Content-Length: 0');
    expect(decode(serializeResponse({ status: 999 }, false))).toContain('500');
    expect(decode(serializeResponse({ status: 299, body: { ok: true } }, true, 1500))).toContain('Keep-Alive: timeout=2');
    expect(decode(serializeResponse({ status: 299, body: new Uint8Array([65]) }, false))).toContain('299 Status');
    expect(decode(serializeResponse({ status: 200, body: new Uint8Array([65]).buffer }, false))).toMatch(/\r\n\r\nA$/);
    expect(decode(serializeResponse({ status: 200, body: new DataView(new Uint8Array([65]).buffer) }, false))).toMatch(/\r\n\r\nA$/);
    expect(serializeResponse({ status: 204, body: 'ignored' }, false).body).toHaveLength(0);
    expect(serializeResponse({ status: 304, body: 'ignored' }, false).body).toHaveLength(0);
    const value = decode(serializeResponse({ status: 200, body: 'hi', headers: { 'X-Test': 'a\r\nb\0c', Connection: 'unsafe', 'bad name': 'x', 'X-Null': null } }, false));
    expect(value).toContain('X-Test: a  b c'); expect(value).not.toContain('unsafe'); expect(value).not.toContain('X-Null');
    expect(value).toContain(CORS_HEADERS['Access-Control-Allow-Origin']);
  });
  it('runs and cleans Effect-managed timeouts', async () => {
    expect(await withTimeout(Promise.resolve(2), 100, () => 1)).toBe(2);
    expect(await withTimeout(new Promise<number>(() => undefined), 1, () => 1)).toBe(1);
    await expect(withTimeout(new Promise<number>(() => undefined), 1, () => { throw new Error('expired'); })).rejects.toThrow();
  });
});

describe('TCP HTTP lifecycle', () => {
  it('serves segmented bodies and sequential pipelined requests with CORS', async () => {
    const seen: HttpRequest[] = [];
    const server = await start((request) => { seen.push(request); return Promise.resolve({ status: 200, body: request.body }); });
    const result = await exchange(server, ['\r\nPOST /a HTTP/1.1\r\nContent-Length: 5\r\n\r\nhe', 'llo\r\nGET /b HTTP/1.0\r\n\r\n']);
    expect(result.match(/HTTP\/1.1 200/g)).toHaveLength(2); expect(result).toContain('helloHTTP');
    expect(seen.map((request) => request.path)).toEqual(['/a', '/b']); expect(seen[0]?.remoteAddress).toBe('127.0.0.1');
    expect(server.connections).toBe(0);
  });
  it('honors HTTP/1.0 keep-alive, HTTP/1.1 close and OPTIONS preflight', async () => {
    const handler = vi.fn(() => Promise.resolve({ status: 200 })); const server = await start(handler);
    const result = await exchange(server, ['OPTIONS * HTTP/1.0\nConnection: keep-alive\n\nGET / HTTP/1.1\nConnection: close\n\n']);
    expect(result).toContain('204 No Content'); expect(result).toContain('200 OK'); expect(handler).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['POST / HTTP/1.1\r\n\r\n', '411'],
    ['PUT / HTTP/1.1\r\n\r\n', '411'],
    ['PATCH / HTTP/1.1\r\n\r\n', '411'],
    ['GET / HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n', '411'],
    ['POST / HTTP/1.1\r\nContent-Length: -1\r\n\r\n', '400'],
    ['POST / HTTP/1.1\r\nContent-Length: 50000000\r\n\r\n', '413'],
    ['GET / HTTP/2.0\r\n\r\n', '505'],
    ['bad\r\n\r\n', '400'],
    [`GET / HTTP/1.1\r\nX: ${'a'.repeat(HEADER_LIMIT)}\r\n\r\n`, '431'],
  ])('rejects malformed/framing input', async (request, status) => { expect(await exchange(await start(), [request])).toContain(`HTTP/1.1 ${status}`); });
  it('turns handler exceptions into 500 and reports errors', async () => {
    const server = await start(() => Promise.reject(new Error('failure')));
    const errors: unknown[] = []; server.addEventListener('connection-error', (event) => { errors.push(event); });
    expect(await exchange(server, ['GET / HTTP/1.1\r\nConnection: close\r\n\r\n'])).toContain('500'); expect(errors).toHaveLength(1);
  });
  it('writes large responses as separate header and body buffers', async () => {
    const body = 'x'.repeat(70_000); const server = await start(() => Promise.resolve({ status: 200, body }));
    expect(await exchange(server, ['GET / HTTP/1.0\r\n\r\n'])).toContain(body);
  });
  it('closes idle and incomplete-body clients', async () => {
    const server = await start(undefined, { idleTimeoutMs: 10 });
    expect(await exchange(server, ['GET / HT'])).toBe('');
    expect(await exchange(server, ['POST / HTTP/1.1\r\nContent-Length: 5\r\n\r\na'])).toBe('');
  });
  it('enforces connection limits', async () => {
    const server = await start(undefined, { maxConnections: 0 });
    expect(await exchange(server, ['GET / HTTP/1.0\r\n\r\n'])).toBe('');
  });
  it('falls back between listen addresses and supports restart/close', async () => {
    const server = await start(undefined, { hosts: ['not an IP address', '127.0.0.1'] });
    const states: string[] = []; server.addEventListener('state', () => { states.push(server.state.status); });
    server.restart();
    await vi.waitFor(() => { expect(states).toContain('error'); });
    server.restart();
    await vi.waitFor(() => { expect(states).toContain('listening'); });
    server.close(); server.restart(); expect(server.state.status).toBe('closed');
  });
  it('reports a failed listener and can stop during backoff', async () => {
    const factory: TCPListenerFactory = () => { throw new Error('cannot listen'); };
    const server = startServer({ port: 0, handler: () => Promise.resolve({ status: 200 }), TCPServerSocket: factory, hosts: ['a'], backoff: { next: () => 1000, reset: () => undefined } });
    controllers.push(server); await vi.waitFor(() => { expect(server.state.status).toBe('error'); });
    expect(server.state.error).toBe('cannot listen'); server.close();
  });
  it('closes a listener that finishes opening after shutdown', async () => {
    const pending = Promise.withResolvers<{ readonly readable: ReadableStream<TCPSocket>; readonly localAddress: string; readonly localPort: number }>();
    const close = vi.fn(() => Promise.resolve(undefined));
    const server = startServer({ port: 0, handler: () => Promise.resolve({ status: 200 }), TCPServerSocket: () => ({ opened: pending.promise, close }) });
    server.close(); pending.resolve({ readable: new ReadableStream(), localAddress: '::', localPort: 0 });
    await vi.waitFor(() => { expect(close).toHaveBeenCalled(); });
  });
});

describe('resource failure boundaries', () => {
  const listenerFor = (socket: TCPSocket): TCPListenerFactory => () => ({
    opened: Promise.resolve({ localAddress: '::', localPort: 1, readable: new ReadableStream({ start(controller) { controller.enqueue(socket); } }) }),
    close: () => Promise.resolve(),
  });
  it('requires browser sockets and adapts their constructor when present', async () => {
    vi.stubGlobal('TCPServerSocket', undefined);
    expect(() => startServer({ port: 0, handler: () => Promise.resolve({ status: 200 }) })).toThrow('not available');
    vi.stubGlobal('TCPServerSocket', vi.fn(function (host: string, options: { readonly localPort: number }) { return TCPServerSocket(host, options); }));
    const server = startServer({ port: 0, hosts: ['127.0.0.1'], handler: () => Promise.resolve({ status: 200 }) });
    controllers.push(server); await server.ready; expect(server.state.status).toBe('listening'); vi.unstubAllGlobals();
  });
  it('handles empty host lists and non-Error listener failures', async () => {
    for (const hosts of [[], ['bad']]) {
      const server = startServer({ port: 0, hosts, TCPServerSocket: () => { const failed = Promise.withResolvers<never>(); failed.reject('unavailable'); return { opened: failed.promise, close: () => Promise.resolve() }; }, handler: () => Promise.resolve({ status: 200 }), backoff: { next: () => 1000, reset: () => undefined } });
      controllers.push(server); await vi.waitFor(() => { expect(server.state.status).toBe('error'); });
      expect(server.state.error).toBe(hosts.length === 0 ? 'listen failed' : 'unavailable'); server.close();
    }
  });
  it('closes active sockets on shutdown', async () => {
    const server = await start();
    const connection = net.connect(server.state.port, '127.0.0.1');
    await vi.waitFor(() => { expect(server.connections).toBe(1); });
    server.close(); await new Promise<void>((resolve) => { connection.once('close', resolve); });
  });
  it('rejects oversized complete headers and receives exact body chunks', async () => {
    const server = await start();
    const head = 'GET / HTTP/1.1\nX: '.padEnd(HEADER_LIMIT + 3, 'a') + '\n\r\n';
    expect(await exchange(server, [head])).toContain('431');
    expect(await exchange(server, ['POST / HTTP/1.0\r\nContent-Length: 4\r\n\r\n', 'abcd'])).toContain('200');
  });
  it('times out opening sockets and releases connections without acquired streams', async () => {
    vi.useFakeTimers();
    const socket: TCPSocket = { opened: new Promise(() => undefined), close: () => Promise.resolve() };
    const server = startServer({ port: 1, handler: () => Promise.resolve({ status: 200 }), TCPServerSocket: listenerFor(socket) });
    controllers.push(server); await server.ready;
    await vi.advanceTimersByTimeAsync(10_001);
    expect(server.connections).toBe(0); server.close(); vi.useRealTimers();
  });
  it('times out stalled writes and bounded stream cleanup', async () => {
    vi.useFakeTimers();
    const socket: TCPSocket = { opened: Promise.resolve({
      readable: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('GET / HTTP/1.0\r\n\r\n')); } }),
      writable: new WritableStream({ write: () => new Promise(() => undefined) }),
    }), close: () => Promise.resolve() };
    const server = startServer({ port: 1, handler: () => Promise.resolve({ status: 200 }), TCPServerSocket: listenerFor(socket) });
    controllers.push(server); await server.ready;
    await vi.advanceTimersByTimeAsync(66_001);
    expect(server.connections).toBe(0); server.close(); vi.useRealTimers();
  });
  it('reports listener stream failure and retries', async () => {
    const factory: TCPListenerFactory = () => ({ opened: Promise.resolve({ localAddress: '::', localPort: 1,
      readable: new ReadableStream({ start(controller) { controller.error(new Error('accept failed')); } }),
    }), close: () => Promise.resolve() });
    const server = startServer({ port: 1, handler: () => Promise.resolve({ status: 200 }), TCPServerSocket: factory });
    controllers.push(server); await vi.waitFor(() => { expect(server.state.status).toBe('error'); }); server.close();
  });
});

it('stops quietly if an in-flight listener acquisition rejects after shutdown', async () => {
  const pending = Promise.withResolvers<never>();
  const close = vi.fn(() => Promise.resolve());
  const server = startServer({ port: 0, hosts: ['::'], TCPServerSocket: () => ({ opened: pending.promise, close }), handler: () => Promise.resolve({ status: 200 }) });
  server.close(); pending.reject(new Error('late failure'));
  await vi.waitFor(() => { expect(close).toHaveBeenCalled(); }); expect(server.state.status).toBe('closed');
});
