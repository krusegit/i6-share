import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export interface HubFile { readonly urlPath: string; readonly file: string }
export const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};
export const mimeType = (file: string): string => MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
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
