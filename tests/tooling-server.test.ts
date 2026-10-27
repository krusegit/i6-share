import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStaticServer, listenServer, publicResponse, readStaticFile, startDevServer, type StaticRequest } from '../tools/dev-server.js';
import { hubResponse, startHubDevServer } from '../tools/dev-hub.js';

const directories: string[] = [];
const servers: http.Server[] = [];
const temporary = (): string => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'i6-server-')); directories.push(dir); return dir; };
const write = (file: string, contents = ''): void => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, contents); };
const request = (url: string, method = 'GET'): StaticRequest => ({ url, method });
const baseUrl = (server: http.Server): string => {
  const address = server.address(); if (address === null || typeof address === 'string') throw new Error('Expected TCP address');
  return `http://127.0.0.1:${address.port.toString()}`;
};
const close = (server: http.Server): Promise<void> => new Promise((resolve, reject) => { server.close((error) => { if (error === undefined) resolve(); else reject(error); }); });
afterEach(async () => {
  await Promise.all(servers.splice(0).filter((server) => server.listening).map(close));
  directories.splice(0).forEach((dir) => { fs.rmSync(dir, { recursive: true, force: true }); });
});

describe('phone dev responses', () => {
  it('serves prefixed paths, directory redirects, metadata, MIME and errors', async () => {
    const dir = temporary(); write(path.join(dir, 'index.html'), 'home'); write(path.join(dir, 'setup/index.html'), 'setup'); write(path.join(dir, 'empty/.keep'));
    const resolve = (url: string, method = 'GET') => Effect.runPromise(publicResponse(request(url, method), dir));
    expect((await resolve('/')).body).toEqual(Buffer.from('home'));
    expect((await resolve('/i6-share/')).status).toBe(200);
    expect((await resolve('/i6-share')).headers['Location']).toBe('/i6-share/');
    expect((await resolve('/setup?x=1')).headers['Location']).toBe('/setup/?x=1');
    expect((await resolve('/setup/')).body).toEqual(Buffer.from('setup'));
    expect((await resolve('/index.html', 'HEAD')).headers['Content-Length']).toBe('4');
    expect((await resolve('/index.html', 'POST')).status).toBe(405);
    expect((await resolve('/%ZZ')).status).toBe(400);
    expect((await resolve('/%2f..%2fsecret')).status).toBe(403);
    expect((await resolve('/missing')).status).toBe(404); expect((await resolve('/empty/')).status).toBe(404);
    expect((await resolve('/build-info.js')).headers['Content-Type']).toBe('text/javascript; charset=utf-8');
    expect(readStaticFile(dir, '/')).toMatchObject({ status: 404 });
    const stat = vi.spyOn(fs, 'statSync').mockImplementation(() => { throw new Error('no access'); });
    await expect(resolve('/')).rejects.toThrow('no access'); stat.mockRestore();
    expect((await Effect.runPromise(publicResponse(request('/%ZZ')))).status).toBe(400);
  });
});

describe('hub dev responses', () => {
  it('adds isolation headers to files, errors, redirects and metadata', async () => {
    const root = temporary(); const dir = path.join(root, 'hub'); const pub = path.join(root, 'public');
    write(path.join(dir, 'index.html'), 'hub'); write(path.join(dir, 'nested/index.html'), 'nested'); write(path.join(dir, 'manifest.webmanifest'), '{"version":"7.2"}');
    const resolve = (url: string, method = 'GET') => Effect.runPromise(hubResponse(request(url, method), dir, pub));
    expect((await resolve('/')).body).toEqual(Buffer.from('hub')); expect((await resolve('/')).headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect((await resolve('/nested')).headers['Location']).toBe('/nested/'); expect((await resolve('/missing')).status).toBe(404);
    expect((await resolve('/build-info.js', 'HEAD')).body).toContain('7.2');
    expect((await resolve('/', 'DELETE')).status).toBe(405); expect((await resolve('/%ZZ')).status).toBe(400);
    write(path.join(dir, 'manifest.webmanifest'), 'bad'); expect((await resolve('/build-info.js')).body).toContain('"version": null');
    const read = vi.spyOn(fs, 'readFileSync').mockImplementation(() => { throw new Error('not readable'); });
    await expect(resolve('/index.html')).rejects.toThrow('not readable'); read.mockRestore();
    expect((await Effect.runPromise(hubResponse(request('/%ZZ')))).status).toBe(400);
  });
});

describe('HTTP dev adapters', () => {
  it('serves GET/HEAD and reports typed failures while preserving a live listener', async () => {
    const dir = temporary(); write(path.join(dir, 'index.html'), 'hello');
    const before = vi.fn<() => Promise<unknown>>().mockResolvedValue(undefined);
    const server = await Effect.runPromise(createStaticServer((input) => publicResponse(input, dir), { beforeRequest: before })); servers.push(server);
    await Effect.runPromise(listenServer(server, { port: 0 }));
    const response = await fetch(baseUrl(server)); expect(await response.text()).toBe('hello');
    const head = await fetch(baseUrl(server), { method: 'HEAD' }); expect(await head.text()).toBe(''); expect(head.headers.get('content-length')).toBe('5');
    before.mockRejectedValueOnce('failure'); const failed = await fetch(baseUrl(server)); expect(failed.status).toBe(500); expect(await failed.text()).toContain('failure');
    const duplicate = await Effect.runPromise(createStaticServer(() => Effect.fail(new Error('handler failed')))); servers.push(duplicate);
    const address = server.address(); if (address === null || typeof address === 'string') throw new Error('Expected TCP listener');
    await expect(Effect.runPromise(listenServer(duplicate, { port: address.port }))).rejects.toThrow();
    await Effect.runPromise(listenServer(duplicate, { port: 0 })); expect((await fetch(baseUrl(duplicate))).status).toBe(500);
  });
  it('handles absent Node request metadata and server creation failures', async () => {
    const server = await Effect.runPromise(createStaticServer(() => Effect.succeed({ status: 200, headers: {}, body: 'ok' })));
    const incoming = new http.IncomingMessage(new net.Socket()); incoming.method = undefined; incoming.url = undefined; const outgoing = new http.ServerResponse(incoming);
    vi.spyOn(outgoing, 'writeHead').mockReturnValue(outgoing); const end = vi.spyOn(outgoing, 'end').mockReturnValue(outgoing);
    server.emit('request', incoming, outgoing); await vi.waitFor(() => { expect(end).toHaveBeenCalledWith('ok'); });
    vi.spyOn(http, 'createServer').mockImplementation(() => { throw new Error('create failed'); });
    await expect(Effect.runPromise(createStaticServer(() => Effect.fail(new Error('unused'))))).rejects.toThrow('create failed');
  });
  it('starts each app with custom ports and supports default start options', async () => {
    const publicServer = await Effect.runPromise(startDevServer({ port: 0 })); servers.push(publicServer);
    const hubServer = await Effect.runPromise(startHubDevServer({ port: 0 })); servers.push(hubServer);
    expect((await fetch(`${baseUrl(publicServer)}/%ZZ`)).status).toBe(400); expect((await fetch(`${baseUrl(hubServer)}/%ZZ`)).status).toBe(400);
    const fake = http.createServer();
    const listen = vi.spyOn(fake, 'listen').mockImplementation((...args: readonly unknown[]) => {
      const callback = args.find((value): value is () => void => typeof value === 'function'); callback?.(); return fake;
    });
    vi.spyOn(http, 'createServer').mockReturnValue(fake);
    expect(await Effect.runPromise(startDevServer())).toBe(fake);
    expect(listen).toHaveBeenCalledWith(8080, '127.0.0.1', expect.any(Function));
    expect(await Effect.runPromise(startHubDevServer())).toBe(fake);
    expect(listen).toHaveBeenCalledWith(5193, '127.0.0.1', expect.any(Function));
    expect(await Effect.runPromise(listenServer(fake))).toBe(fake);
  });
});
