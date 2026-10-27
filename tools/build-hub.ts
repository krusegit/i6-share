import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Effect, Schema } from 'effect';
import { buildInfo, type BuildInfo } from './build-info.js';
import { ROOT, toolError, walkFiles } from './hub-files.js';

export type RuntimeIdentifier = 'linux-x64' | 'linux-arm64' | 'osx-x64' | 'osx-arm64';
export type ProcessRunner = (command: string, args: readonly string[], cwd: string) => Promise<void>;
export const runProcess: ProcessRunner = (command, args, cwd) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd, stdio: 'inherit' });
  child.once('error', reject);
  child.once('exit', (code, signal) => {
    if (code === 0) resolve();
    else reject(new Error(`${command} exited with ${signal ?? String(code)}`));
  });
});
export const runtimeIdentifier = (platform: string = process.platform, arch: string = process.arch): RuntimeIdentifier => {
  if (platform === 'linux' && arch === 'x64') return 'linux-x64';
  if (platform === 'linux' && arch === 'arm64') return 'linux-arm64';
  if (platform === 'darwin' && arch === 'x64') return 'osx-x64';
  if (platform === 'darwin' && arch === 'arm64') return 'osx-arm64';
  throw new Error(`Unsupported Native AOT host ${platform}/${arch}`);
};
const Version = Schema.Struct({ version: Schema.String.check(Schema.isPattern(/^\d+(?:\.\d+)*(?![\s\S])/u)) });
export const readVersion = (root = ROOT): string => {
  const json: unknown = JSON.parse(fs.readFileSync(path.join(root, 'native/version.json'), 'utf8'));
  return Schema.decodeUnknownSync(Version)(json).version;
};
export interface NativeArtifact {
  readonly version: string; readonly rid: RuntimeIdentifier; readonly file: string;
  readonly sha256: string; readonly size: number; readonly commit: string; readonly builtAt: string | null;
}
export interface NativeBuildOptions {
  readonly root?: string; readonly rid?: RuntimeIdentifier; readonly hostRid?: RuntimeIdentifier;
  readonly outDir?: string; readonly webRoot?: string; readonly info?: BuildInfo;
}

/** Native AOT compilation takes place on the target OS and architecture, never a JIT fallback. */
export const buildHub = (options: NativeBuildOptions = {}, run: ProcessRunner = runProcess): Effect.Effect<NativeArtifact, Error> => Effect.gen(function* () {
  const root = options.root ?? ROOT;
  const hostRid = options.hostRid ?? runtimeIdentifier();
  const rid = options.rid ?? hostRid;
  if (rid !== hostRid) return yield* Effect.fail(new Error(`Native AOT must be built on the target runner (${rid} requested on ${hostRid})`));
  const version = yield* Effect.try({ try: () => readVersion(root), catch: toolError });
  const info = options.info ?? (yield* buildInfo(version));
  const outDir = options.outDir ?? path.join(root, 'dist/public/downloads');
  const publishDir = path.join(root, 'dist/native', rid);
  const webRoot = options.webRoot ?? path.join(root, 'dist/hub');
  yield* Effect.try({ try: () => {
    if (!fs.existsSync(path.join(webRoot, 'index.html'))) throw new Error(`Build the dashboard before publishing: ${webRoot}`);
    fs.rmSync(publishDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
  }, catch: toolError });
  yield* Effect.tryPromise({ try: () => run('dotnet', [
    'publish', path.join(root, 'native/I6Share.Hub/I6Share.Hub.csproj'), '-warnaserror', '-c', 'Release', '-r', rid,
    '--self-contained', 'true', '-p:PublishAot=true', `-p:Version=${version}`, '-o', publishDir,
  ], root), catch: toolError });
  yield* Effect.try({ try: () => {
    if (!fs.statSync(path.join(publishDir, 'i6-share-hub')).isFile()) throw new Error('Native publish did not produce i6-share-hub');
    for (const { file, urlPath } of walkFiles(webRoot).filter((entry) => !entry.urlPath.endsWith('.map'))) {
      const destination = path.join(publishDir, 'wwwroot', urlPath);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(file, destination);
    }
  }, catch: toolError });
  const file = `i6-share-hub-${rid}.tar.gz`;
  const archive = path.join(outDir, file);
  yield* Effect.tryPromise({ try: () => run('tar', ['-czf', archive, '-C', publishDir, 'i6-share-hub', 'wwwroot'], root), catch: toolError });
  return yield* Effect.try({ try: () => {
    const bytes = fs.readFileSync(archive);
    const artifact: NativeArtifact = { version, rid, file, size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), commit: info.commit, builtAt: info.builtAt };
    fs.writeFileSync(path.join(outDir, `${rid}.json`), `${JSON.stringify(artifact, null, 2)}\n`);
    fs.writeFileSync(`${archive}.sha256`, `${artifact.sha256}  ${file}\n`);
    return artifact;
  }, catch: toolError });
});

export const runHub = (root = ROOT, run: ProcessRunner = runProcess): Effect.Effect<void, Error> =>
  Effect.tryPromise({ try: () => run('dotnet', ['run', '--project', path.join(root, 'native/I6Share.Hub'), '--', '--web-root', path.join(root, 'dist/hub')], root), catch: toolError });
