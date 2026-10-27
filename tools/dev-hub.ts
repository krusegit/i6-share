import path from 'node:path';
import type http from 'node:http';
import { Effect } from 'effect';
import { ROOT, IWA_HEADERS, collectHubFiles, readHubManifest, mimeType, toolError } from './hub-files.js';
import { buildInfo, buildInfoModule } from './build-info.js';
import { createStaticServer, listenServer, parsePath, readStaticFile, reply, type StaticRequest, type StaticReply, type ServerOptions } from './dev-server.js';

export const hubResponse = (request: StaticRequest, hubDir = path.join(ROOT, 'dist/hub'), publicDir = path.join(ROOT, 'dist/public')): Effect.Effect<StaticReply, Error> => Effect.gen(function* () {
  if (request.method !== 'GET' && request.method !== 'HEAD') return reply(405, 'Method not allowed\n', { Allow: 'GET, HEAD', ...IWA_HEADERS });
  const parsed = yield* Effect.try({ try: () => parsePath(request), catch: toolError }).pipe(Effect.catch(() => Effect.succeed(null)));
  if (parsed === null) return reply(400, 'Bad request\n', IWA_HEADERS);
  const files = yield* collectHubFiles(hubDir, publicDir);
  const url = parsed.endsWith('/') ? `${parsed}index.html` : parsed;
  const file = files.find((entry) => entry.urlPath === url);
  if (file === undefined && files.some((entry) => entry.urlPath === `${url}/index.html`)) return reply(301, '', { Location: `${url}/`, ...IWA_HEADERS });
  if (url === '/build-info.js') {
    const version = yield* readHubManifest(files).pipe(Effect.map((manifest) => manifest.version), Effect.catch(() => Effect.succeed(null)));
    return reply(200, buildInfoModule(yield* buildInfo(version)), { 'Content-Type': mimeType('build-info.js'), ...IWA_HEADERS });
  }
  const result = file === undefined ? reply(404, `404 Not found: ${url}\n`) : yield* Effect.try({ try: () => readStaticFile(file.file, url), catch: toolError });
  return { ...result, headers: { ...result.headers, ...IWA_HEADERS } };
});
export const startHubDevServer = (options: ServerOptions = {}): Effect.Effect<http.Server, Error> => {
  const configured = { ...options, port: options.port ?? 5193 };
  return createStaticServer(hubResponse, configured).pipe(Effect.flatMap((server) => listenServer(server, configured)));
};
