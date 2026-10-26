// Shared by build-hub.mjs and dev-hub.mjs: which files make up the hub IWA
// and how they are served. Zero dependencies.
//
// Bundle layout (see docs/PROTOCOL.md):
//   hub/*            -> /*            (dotfiles skipped)
//   public/lib/*     -> /lib/*
//   public/style.css -> /style.css
//   public/icons/*   -> /icons/*
//   hub/manifest.webmanifest is additionally served at
//   /.well-known/manifest.webmanifest, the path Chrome reads an IWA's
//   manifest from (unless hub/.well-known/manifest.webmanifest exists).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const HUB_DIR = path.resolve(ROOT, process.env.I6_HUB_DIR || 'hub');
export const WELL_KNOWN_MANIFEST = '/.well-known/manifest.webmanifest';

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.swbn': 'application/octet-stream',
};
export const mimeType = (file) => MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';

// Isolated Web Apps must be cross-origin isolated. These are the exact values
// the official bundler plugins (webbundle-plugins/shared/iwa-headers.ts) put on
// every response. Chrome enforces its own strict CSP for IWAs on top.
export const IWA_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

/** Regular files below dir (recursive, sorted, skipping dotfiles; refuses symlinks). */
function walk(dir, rel = '') {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const abs = path.join(dir, name);
    const st = fs.lstatSync(abs);
    if (st.isSymbolicLink()) throw new Error(`Refusing to bundle symbolic link ${abs}`);
    if (st.isDirectory()) out.push(...walk(abs, `${rel}${name}/`));
    else if (st.isFile()) out.push({ urlPath: `/${rel}${name}`, file: abs });
  }
  return out;
}

/**
 * Returns [{urlPath, file}] for every resource of the hub app, sorted by path.
 * Later sources never override hub files with the same path.
 */
export function collectHubFiles() {
  if (!fs.existsSync(path.join(HUB_DIR, 'index.html'))) {
    throw new Error(`No index.html in hub dir ${HUB_DIR}`);
  }
  const map = new Map();
  const add = (entries) => { for (const e of entries) if (!map.has(e.urlPath)) map.set(e.urlPath, e); };
  add(walk(HUB_DIR));
  const wk = path.join(HUB_DIR, '.well-known', 'manifest.webmanifest');
  if (fs.existsSync(wk)) add([{ urlPath: WELL_KNOWN_MANIFEST, file: wk }]);
  else if (map.has('/manifest.webmanifest')) add([{ urlPath: WELL_KNOWN_MANIFEST, file: map.get('/manifest.webmanifest').file }]);
  add(walk(path.join(ROOT, 'public', 'lib'), 'lib/'));
  const css = path.join(ROOT, 'public', 'style.css');
  if (fs.existsSync(css)) add([{ urlPath: '/style.css', file: css }]);
  add(walk(path.join(ROOT, 'public', 'icons'), 'icons/'));
  return [...map.values()].sort((a, b) => a.urlPath.localeCompare(b.urlPath));
}

/** Parsed hub manifest (the one served at /.well-known/manifest.webmanifest). */
export function readHubManifest(files = collectHubFiles()) {
  const entry = files.find((f) => f.urlPath === WELL_KNOWN_MANIFEST);
  if (!entry) throw new Error(`Missing ${path.join(HUB_DIR, 'manifest.webmanifest')} – an IWA needs a web app manifest.`);
  try {
    return JSON.parse(fs.readFileSync(entry.file, 'utf8'));
  } catch (e) {
    throw new Error(`${entry.file} is not valid JSON: ${e.message}`);
  }
}
