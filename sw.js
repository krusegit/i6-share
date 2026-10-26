// i6-share service worker (module). Registered by app.js with
//   navigator.serviceWorker.register('./sw.js', {type: 'module', scope: './'})
//
// * Precaches the app shell; same-origin GETs are served stale-while-revalidate.
// * Cross-origin requests (all hub traffic: http://<lan-ip>:47616) are never
//   touched – they go straight to the network.
// * Handles the Web Share Target POST to ./share-target: the shared files are
//   staged in IndexedDB (kv 'staged': File[]) and the app opens with ?share=1.

import { store } from './lib/store.js';

const VERSION = '1.0.0';   // keep in sync with APP_VERSION in client.js; bump to refresh caches
const CACHE = `i6-share-${VERSION}`;
const SHELL = [
  './', './index.html', './app.js', './app.css', './client.js', './style.css',
  './lib/proto.js', './lib/dom.js', './lib/store.js', './manifest.webmanifest',
];
const OPTIONAL = [
  './icons/icon.svg', './icons/favicon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './icons/maskable-512.png', './icons/apple-touch-icon.png',
];

const scoped = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL.map((p) => new Request(scoped(p), { cache: 'reload' })));
    await Promise.allSettled(OPTIONAL.map((p) => cache.add(new Request(scoped(p), { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('i6-share-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            // hub traffic etc.: network only
  if (req.method === 'POST' && url.href.split(/[?#]/)[0] === scoped('./share-target')) {
    event.respondWith(receiveShare(req));
    return;
  }
  if (req.method !== 'GET' || req.headers.has('range')) return;
  if (!url.href.startsWith(self.registration.scope)) return;
  if (url.pathname.endsWith('.swbn')) return;                  // big hub bundle download
  event.respondWith(staleWhileRevalidate(event, req));
});

async function staleWhileRevalidate(event, req) {
  const cache = await caches.open(CACHE);
  const nav = req.mode === 'navigate';
  // Navigations (./?share=1, ./#pair=…) all map to the same cached document.
  const key = nav ? new URL(req.url).href.split(/[?#]/)[0] : req;
  const cached = await cache.match(key, { ignoreSearch: nav });
  const network = fetch(req).then(async (res) => {
    if (res.ok && res.type === 'basic') await cache.put(key, res.clone());
    return res;
  });
  if (cached) {
    event.waitUntil(network.catch(() => {}));
    return cached;
  }
  try {
    return await network;
  } catch (err) {
    if (nav && (key === scoped('./') || key === scoped('./index.html'))) {
      const shell = await cache.match(scoped('./')) || await cache.match(scoped('./index.html'));
      if (shell) return shell;
    }
    throw err;
  }
}

async function receiveShare(req) {
  try {
    const form = await req.formData();
    let files = form.getAll('files').filter((f) => typeof f === 'object' && f && (f.size > 0 || f.name));
    if (!files.length) {
      const text = ['title', 'text', 'url'].map((k) => form.get(k)).filter((v) => typeof v === 'string' && v.trim());
      if (text.length) {
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        files = [new File([[...new Set(text)].join('\n') + '\n'], `shared-${stamp}.txt`, { type: 'text/plain' })];
      }
    }
    if (files.length) await store('kv').put('staged', files);
  } catch (err) {
    console.error('share target failed', err);
  }
  return Response.redirect(scoped('./?share=1'), 303);
}
