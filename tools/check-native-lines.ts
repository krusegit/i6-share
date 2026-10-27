import fs from 'node:fs';
import path from 'node:path';
import { Effect } from 'effect';
import { ROOT, toolError } from './hub-files.js';

export const MAX_NATIVE_LINES = 300;
export const NATIVE_SOURCE_DIR = path.join(ROOT, 'native');

/** Count physical lines, including comments and blanks; a final newline ends its line. */
export const physicalLines = (source: string): number => source === '' ? 0
  : source.split(/\r\n|\r|\n/u).length - (/[\r\n]$/u.test(source) ? 1 : 0);

const sourceFiles = (directory: string): readonly string[] => fs.readdirSync(directory, { withFileTypes: true })
  .filter((entry) => entry.name !== 'bin' && entry.name !== 'obj')
  .flatMap((entry): readonly string[] => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return entry.name.endsWith('.cs') ? [file] : [];
  }).sort();

/** Apply the same limit to application, contract, generator, and test sources. */
export const checkNativeLines = (directory = NATIVE_SOURCE_DIR): Effect.Effect<void, Error> => Effect.try({
  try: () => {
    const files = sourceFiles(directory);
    if (files.length === 0) throw new Error(`No C# sources found in ${directory}`);
    const oversized = files.map((file) => ({ file, lines: physicalLines(fs.readFileSync(file, 'utf8')) }))
      .filter(({ lines }) => lines > MAX_NATIVE_LINES);
    if (oversized.length > 0) throw new Error(`C# files must have at most ${String(MAX_NATIVE_LINES)} physical lines (including comments and blanks):\n${
      oversized.map(({ file, lines }) => `${path.relative(directory, file)}: ${String(lines)}`).join('\n')}`);
  }, catch: toolError,
});
