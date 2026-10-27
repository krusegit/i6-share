import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Effect } from 'effect';
import { ROOT, mimeType, toolError, errorMessage } from './hub-files.js';
import { buildInfo, buildInfoModule } from './build-info.js';

export interface StaticRequest { readonly method: string; readonly url: string }
export interface StaticReply { readonly status: number; readonly body: string | Uint8Array; readonly headers: Readonly<Record<string, string>> }
export const reply = (status: number, body: string | Uint8Array, headers: Readonly<Record<string, string>> = {}): StaticReply => ({
  status, body, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache', ...headers },
});
export const parsePath = (request: StaticRequest): string => decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
export const readStaticFile = (file: string, url: string): StaticReply => {
  const stat = fs.statSync(file, { throwIfNoEntry: false });
  return stat?.isFile() === true ? reply(200, fs.readFileSync(file), {
    'Content-Type': mimeType(file), 'Content-Length': stat.size.toString(), 'X-Content-Type-Options': 'nosniff',
  }) : reply(404, `404 Not found: ${url}\n`);
};
export const publicResponse = (request: StaticRequest, dir = path.join(ROOT, 'dist/public')): Effect.Effect<StaticReply, Error> => Effect.gen(function* () {
  if (request.method !== 'GET' && request.method !== 'HEAD') return reply(405, 'Method not allowed\n', { Allow: 'GET, HEAD' });
  const parsed = yield* Effect.try({ try: () => parsePath(request), catch: toolError }).pipe(Effect.catch(() => Effect.succeed(null)));
  if (parsed === null) return reply(400, 'Bad request\n');
  if (parsed === '/i6-share') return reply(301, '', { Location: '/i6-share/' });
  const url = parsed.startsWith('/i6-share/') ? parsed.slice('/i6-share'.length) : parsed;
  if (url === '/build-info.js') return reply(200, buildInfoModule(yield* buildInfo()), { 'Content-Type': mimeType('build-info.js') });
  return yield* Effect.try({ try: () => {
    if (url.split('/').includes('..')) return reply(403, 'Forbidden\n');
    const file = path.join(dir, path.normalize(url));
    if (fs.statSync(file, { throwIfNoEntry: false })?.isDirectory() === true) {
      if (!url.endsWith('/')) return reply(301, '', { Location: request.url.replace(/^([^?]*)/, '$1/') });
      return readStaticFile(path.join(file, 'index.html'), url);
    }
    return readStaticFile(file, url);
  }, catch: toolError });
});
export type ResponseResolver = (request: StaticRequest) => Effect.Effect<StaticReply, Error>;
export interface ServerOptions { readonly port?: number; readonly host?: string; readonly beforeRequest?: () => Promise<unknown> }
export const createStaticServer = (resolve: ResponseResolver, options: ServerOptions = {}): Effect.Effect<http.Server, Error> => Effect.try({
  try: () => http.createServer((request, response) => {
    const input = { method: request.method ?? 'GET', url: request.url ?? '/' };
    const operation = Effect.gen(function* () {
      if (options.beforeRequest !== undefined) yield* Effect.tryPromise({ try: options.beforeRequest, catch: toolError });
      return yield* resolve(input);
    }).pipe(Effect.catch((cause) => Effect.succeed(reply(500, `${errorMessage(cause)}\n`))));
    void Effect.runPromise(operation).then((result) => {
      response.writeHead(result.status, result.headers);
      response.end(input.method === 'HEAD' ? undefined : result.body);
    });
  }), catch: toolError,
});
export const listenServer = (server: http.Server, options: ServerOptions = {}): Effect.Effect<http.Server, Error> => Effect.tryPromise({
  try: () => new Promise<http.Server>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 8080, options.host ?? '127.0.0.1', () => { server.removeListener('error', reject); resolve(server); });
  }), catch: toolError,
});
export const startDevServer = (options: ServerOptions = {}): Effect.Effect<http.Server, Error> =>
  createStaticServer(publicResponse, options).pipe(Effect.flatMap((server) => listenServer(server, options)));
