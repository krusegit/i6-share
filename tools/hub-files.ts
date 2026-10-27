import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Effect, Schema } from 'effect';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WELL_KNOWN_MANIFEST = '/.well-known/manifest.webmanifest';
export interface HubFile { readonly urlPath: string; readonly file: string }
export const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.swbn': 'application/octet-stream',
};
export const mimeType = (file: string): string => MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
export const IWA_HEADERS: Readonly<Record<string, string>> = {
  'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};
export const errorMessage = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause);
export const toolError = (cause: unknown): Error => cause instanceof Error ? cause : new Error(String(cause));

/** Snapshot files without following symlinks; only static/generated assets may be shipped. */
export const walkFiles = (dir: string, rel = ''): readonly HubFile[] => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).sort().filter((name) => !name.startsWith('.')).flatMap((name) => {
    const file = path.join(dir, name);
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) throw new Error(`Refusing to bundle symbolic link ${file}`);
    return stat.isDirectory() ? walkFiles(file, `${rel}${name}/`) : [{ urlPath: `/${rel}${name}`, file }];
  });
};

export const collectHubFiles = (hubDir = path.join(ROOT, 'dist/hub'), publicDir = path.join(ROOT, 'dist/public')): Effect.Effect<readonly HubFile[], Error> => Effect.try({
  try: () => {
    if (!fs.existsSync(path.join(hubDir, 'index.html'))) throw new Error(`No index.html in hub dir ${hubDir}`);
    const files = walkFiles(hubDir);
    const wellKnown = path.join(hubDir, '.well-known/manifest.webmanifest');
    const manifest = fs.existsSync(wellKnown) ? wellKnown : files.find((file) => file.urlPath === '/manifest.webmanifest')?.file;
    const css = path.join(publicDir, 'style.css');
    const entries = [...files,
      ...(manifest === undefined ? [] : [{ urlPath: WELL_KNOWN_MANIFEST, file: manifest }]),
      ...walkFiles(path.join(publicDir, 'lib'), 'lib/'),
      ...(fs.existsSync(css) ? [{ urlPath: '/style.css', file: css }] : []),
      ...walkFiles(path.join(publicDir, 'icons'), 'icons/'),
    ];
    return entries.filter((entry, index) => entries.findIndex((other) => other.urlPath === entry.urlPath) === index)
      .sort((a, b) => a.urlPath.localeCompare(b.urlPath));
  }, catch: toolError,
});
const Manifest = Schema.Struct({ version: Schema.String });
export const readHubManifest = (files: readonly HubFile[]): Effect.Effect<typeof Manifest.Type, Error> => Effect.try({
  try: () => {
    const entry = files.find((file) => file.urlPath === WELL_KNOWN_MANIFEST);
    if (entry === undefined) throw new Error(`Missing ${WELL_KNOWN_MANIFEST}`);
    const json: unknown = JSON.parse(fs.readFileSync(entry.file, 'utf8'));
    return Schema.decodeUnknownSync(Manifest)(json);
  }, catch: toolError,
});
