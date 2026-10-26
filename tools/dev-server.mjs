#!/usr/bin/env node
// Zero-dependency static server for public/ (the GitHub Pages site).
//
//   npm run dev                  -> http://localhost:8080/
//   PORT=9000 npm run dev
//   HOST=0.0.0.0 npm run dev     -> also reachable from the LAN
//
// Service workers / share target / Local Network Access need a secure
// context, which plain http://<lan-ip> is not. To test on an Android phone,
// use USB + `adb reverse tcp:8080 tcp:8080` (or chrome://inspect port
// forwarding) and open http://localhost:8080/ on the phone.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, mimeType } from './hub-files.mjs';

const DIR = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '127.0.0.1';

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache', ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed\n', { Allow: 'GET, HEAD' });
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    return send(res, 400, 'Bad request\n');
  }
  // Pages serves the site under /i6-share/; accept that prefix too.
  if (urlPath === '/i6-share') return send(res, 301, '', { Location: '/i6-share/' });
  if (urlPath.startsWith('/i6-share/')) urlPath = urlPath.slice('/i6-share'.length);

  let file = path.join(DIR, path.normalize(urlPath));
  if (file !== DIR && !file.startsWith(DIR + path.sep)) return send(res, 403, 'Forbidden\n');
  let st = fs.statSync(file, { throwIfNoEntry: false });
  if (st?.isDirectory()) {
    if (!urlPath.endsWith('/')) return send(res, 301, '', { Location: req.url.replace(/^([^?]*)/, '$1/') });
    file = path.join(file, 'index.html');
    st = fs.statSync(file, { throwIfNoEntry: false });
  }
  if (!st?.isFile()) {
    log(req, 404);
    return send(res, 404, `404 Not found: ${urlPath}\n`);
  }
  res.writeHead(200, {
    'Content-Type': mimeType(file),
    'Content-Length': st.size,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  log(req, 200);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
});

function log(req, status) {
  if (process.env.QUIET) return;
  console.log(`${new Date().toISOString().slice(11, 19)} ${status} ${req.method} ${req.url}`);
}

server.listen(PORT, HOST, () => {
  console.log(`Serving ${DIR}\n  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/\n  setup wizard: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/setup/`);
});
