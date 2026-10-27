import { readFile } from 'node:fs/promises';
import { Effect, Schema } from 'effect';
import { toolError } from './hub-files.js';

export type VersionComparison = -1 | 0 | 1;

const versionParts = (version: string): readonly bigint[] => {
  if (!/^\d+(?:\.\d+)*(?![\s\S])/u.test(version)) throw new Error(`Invalid numeric version: ${version}`);
  return version.split('.').map((part) => BigInt(part));
};

/** Compare numeric components exactly; trailing zero components do not change a version. */
export const compareVersions = (left: string, right: string): VersionComparison => {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  return Array.from({ length: Math.max(leftParts.length, rightParts.length) }, (_, index): VersionComparison => {
    const a = leftParts[index] ?? 0n;
    const b = rightParts[index] ?? 0n;
    return a === b ? 0 : a > b ? 1 : -1;
  }).find((comparison) => comparison !== 0) ?? 0;
};

const Metadata = Schema.Record(Schema.String, Schema.Unknown);

/** Missing or non-scalar fields print empty; malformed JSON and unreadable files fail. */
export const readMetadataField = (file: string, key: string): Effect.Effect<string, Error> =>
  Effect.tryPromise({ try: () => readFile(file, 'utf8'), catch: toolError }).pipe(
    Effect.flatMap((text) => Effect.try({
      try: () => {
        const parsed: unknown = JSON.parse(text);
        return Schema.decodeUnknownSync(Metadata)(parsed);
      }, catch: toolError,
    })),
    Effect.map((metadata) => {
      const value = metadata[key];
      return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
    }),
  );
