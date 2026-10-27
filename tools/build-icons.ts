import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { Effect } from 'effect';
import { ROOT, toolError } from './hub-files.js';

export const ICON_JOBS: readonly (readonly [string, string, number])[] = [
  ['icon.svg', 'icon-192.png', 192], ['icon.svg', 'icon-512.png', 512],
  ['maskable.svg', 'maskable-512.png', 512], ['maskable.svg', 'apple-touch-icon.png', 180],
  ['hub.svg', 'hub-192.png', 192], ['hub.svg', 'hub-512.png', 512],
];
export type IconRenderer = (command: string, args: readonly string[]) => void;
export const renderIcon: IconRenderer = (command, args) => { execFileSync(command, args); };
export const buildIcons = (dir = path.join(ROOT, 'public/icons'), render: IconRenderer = renderIcon): Effect.Effect<void, Error> => Effect.try({
  try: () => { ICON_JOBS.forEach(([source, output, size]) => {
    render('rsvg-convert', ['-w', String(size), '-h', String(size), '-o', path.join(dir, output), path.join(dir, source)]);
  }); }, catch: toolError,
});
