import crypto from 'node:crypto';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
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

const Download = Schema.Struct({ version: Schema.String, file: Schema.String, sha256: Schema.String, size: Schema.Number });
export interface DownloadArtifact { readonly file: string; readonly sha256: string; readonly size: number }
export interface DownloadManifest { readonly version: string; readonly artifacts: Readonly<Record<'linux-x64' | 'linux-arm64', DownloadArtifact>> }
/** Assemble the public download catalog only after both native artifacts pass integrity checks. */
export const assembleRelease = (directory: string): Effect.Effect<DownloadManifest, Error> => Effect.tryPromise({
  try: async () => {
    const readDownload = async (rid: 'linux-x64' | 'linux-arm64'): Promise<typeof Download.Type> => {
      const parsed: unknown = JSON.parse(await readFile(path.join(directory, `${rid}.json`), 'utf8'));
      const record = Schema.decodeUnknownSync(Download)(parsed);
      if (record.file !== `i6-share-hub-${rid}.tar.gz`) throw new Error(`Unexpected download filename for ${rid}`);
      const bytes = await readFile(path.join(directory, record.file));
      if (record.size !== bytes.length || record.sha256 !== crypto.createHash('sha256').update(bytes).digest('hex')) throw new Error(`Download integrity mismatch for ${rid}`);
      return record;
    };
    const [x64, arm64] = await Promise.all([readDownload('linux-x64'), readDownload('linux-arm64')]);
    if (x64.version !== arm64.version) throw new Error('Linux artifacts have different versions');
    compareVersions(x64.version, arm64.version);
    const artifact = (record: typeof Download.Type): DownloadArtifact => ({ file: record.file, sha256: record.sha256, size: record.size });
    const manifest: DownloadManifest = { version: x64.version, artifacts: { 'linux-x64': artifact(x64), 'linux-arm64': artifact(arm64) } };
    await writeFile(path.join(directory, 'version.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    return manifest;
  }, catch: toolError,
});
