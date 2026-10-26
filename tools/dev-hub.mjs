#!/usr/bin/env node
// Zero-dependency dev server for the hub IWA, serving exactly the files that
// go into the signed bundle (hub/ at the root + lib/, style.css, icons/,
// and the manifest at /.well-known/manifest.webmanifest).
//
//   npm run dev:hub              -> http://localhost:5193
//
// Install it once in Chrome with the IWA dev-mode flags enabled:
//   chrome://iwa-dev → Install → "Dev Mode Proxy" → http://localhost:5193
//   (Chrome < 154: chrome://web-app-internals → "Install IWA via Dev Mode Proxy")
// or start Chrome with
//   --enable-features=IsolatedWebApps,IsolatedWebAppDevMode --install-isolated-web-app-from-url=http://localhost:5193
// Then just reload the app window after editing files (no rebuild needed).
// The dev proxy only accepts a manifest at /.well-known/manifest.webmanifest
// with a name, an icon and a "version".

import http from 'node:http';
import fs from 'node:fs';
import { HUB_DIR, IWA_HEADERS, collectHubFiles, mimeType, readHubManifest } from './hub-files.mjs';
import { buildInfo, buildInfoModule } from './build-info.mjs';

const PORT = Number(process.env.PORT) || 5193;
const HOST = process.env.HOST || '127.0.0.1';

const server = http.createServer((req, res) => {
  const headers = { 'Cache-Control': 'no-cache', ...IWA_HEADERS };
  const reply = (status, body, extra = {}) => {
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers, ...extra });
    res.end(body);
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') return reply(405, 'Method not allowed\n', { Allow: 'GET, HEAD' });

  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    return reply(400, 'Bad request\n');
  }
  let files;
  try {
    files = collectHubFiles(); // re-read every time so new files show up
  } catch (e) {
    return reply(500, `${e.message}\n`);
  }
  const byPath = new Map(files.map((f) => [f.urlPath, f.file]));
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  else if (!byPath.has(urlPath) && byPath.has(`${urlPath}/index.html`)) return reply(301, '', { Location: `${urlPath}/` });

  if (urlPath === '/build-info.js') {
    let version = null;
    try { version = readHubManifest(files).version; } catch { /* badge shows '?' */ }
    const body = buildInfoModule(buildInfo(version));
    res.writeHead(200, { ...headers, 'Content-Type': 'text/javascript; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
    log(req, 200);
    return res.end(req.method === 'HEAD' ? undefined : body);
  }
  const file = byPath.get(urlPath);
  const st = file && fs.statSync(file, { throwIfNoEntry: false });
  if (!st?.isFile()) {
    log(req, 404);
    return reply(404, `404 Not found: ${urlPath}\n`);
  }
  res.writeHead(200, { ...headers, 'Content-Type': mimeType(file), 'Content-Length': st.size, 'X-Content-Type-Options': 'nosniff' });
  log(req, 200);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
});

function log(req, status) {
  if (process.env.QUIET) return;
  console.log(`${new Date().toISOString().slice(11, 19)} ${status} ${req.method} ${req.url}`);
}

server.listen(PORT, HOST, () => {
  console.log(`Hub dev server for ${HUB_DIR}\n  http://localhost:${PORT}\n` +
    '  Install in Chrome: chrome://iwa-dev → Install → Dev Mode Proxy → the URL above\n' +
    '  (needs chrome://flags/#enable-isolated-web-apps and #enable-isolated-web-app-dev-mode)');
});
