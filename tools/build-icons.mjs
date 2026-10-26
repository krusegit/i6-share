#!/usr/bin/env node
// Renders the PNG icons in public/icons/ from their SVG sources with
// rsvg-convert (librsvg). Run after editing an SVG:  npm run build:icons

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

// [source svg, output png, size]
const jobs = [
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['maskable.svg', 'maskable-512.png', 512],
  ['maskable.svg', 'apple-touch-icon.png', 180], // iOS adds its own rounding
  ['hub.svg', 'hub-192.png', 192],
  ['hub.svg', 'hub-512.png', 512],
];

for (const [src, out, size] of jobs) {
  try {
    execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), '-o', path.join(dir, out), path.join(dir, src)]);
  } catch (e) {
    console.error(`rsvg-convert failed for ${out}: ${e.message}\nInstall librsvg (e.g. "brew install librsvg" or "apt install librsvg2-bin").`);
    process.exit(1);
  }
  console.log(`${out}  (${size}x${size} from ${src})`);
}
