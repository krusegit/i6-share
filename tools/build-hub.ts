import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BundleBuilder } from 'wbn';
import { SignedWebBundle, NodeCryptoSigningStrategy, WebBundleId, parsePemKey } from 'wbn-sign';
import { Effect } from 'effect';
import { ROOT, IWA_HEADERS, collectHubFiles, readHubManifest, mimeType, toolError, type HubFile } from './hub-files.js';
import { buildInfo, buildInfoModule, type BuildInfo } from './build-info.js';

export const BUNDLE_NAME = 'i6-share-hub.swbn';
export interface HubBuildOptions {
  readonly hubDir?: string; readonly publicDir?: string; readonly outDir?: string; readonly keyPath?: string;
  readonly info?: BuildInfo;
}
export interface BundleInfo extends BuildInfo { readonly version: string; readonly size: number; readonly webBundleId: string; readonly sha256: string }
export const lowerHeaders = (headers: Readonly<Record<string, string>>): Record<string, string> =>
  Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
export const writeAtomic = (file: string, data: string | Uint8Array): void => {
  const temporary = `${file}.tmp-${process.pid.toString()}`;
  fs.writeFileSync(temporary, data);
  fs.renameSync(temporary, file);
};
export const loadOrCreateKey = (keyPath: string, warn: (message: string) => void = console.warn): crypto.KeyObject => {
  if (!fs.existsSync(keyPath)) {
    fs.mkdirSync(path.dirname(keyPath), { recursive: true, mode: 0o700 });
    const { privateKey } = crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
    warn(`Generated NEW hub signing key: ${keyPath}. Back it up: this key determines the app identity.`);
  }
  const mode = fs.statSync(keyPath).mode & 0o777;
  if ((mode & 0o077) !== 0) warn(`Signing key ${keyPath} is readable by others (${mode.toString(8)}); use chmod 600.`);
  return parsePemKey(fs.readFileSync(keyPath, 'utf8'));
};
export const createUnsignedBundle = (files: readonly HubFile[], webBundleId: string, info: BuildInfo): Uint8Array => {
  const base = `isolated-app://${webBundleId}/`;
  const headers = lowerHeaders(IWA_HEADERS);
  const builder = new BundleBuilder('b2');
  files.filter(({ urlPath }) => urlPath !== '/build-info.js' && !urlPath.endsWith('.map')).forEach(({ urlPath, file }) => {
    const body = fs.readFileSync(file);
    const contentHeaders = { 'content-type': mimeType(file), ...headers };
    if (path.posix.basename(urlPath) === 'index.html') {
      builder.addExchange(base + urlPath.slice(1), 301, { location: './', ...headers }, '');
      builder.addExchange(base + urlPath.slice(1, -'index.html'.length), 200, contentHeaders, body);
    } else builder.addExchange(base + urlPath.slice(1), 200, contentHeaders, body);
  });
  builder.addExchange(`${base}build-info.js`, 200, { 'content-type': mimeType('build-info.js'), ...headers }, buildInfoModule(info));
  return builder.createBundle();
};
export interface SignedBundle {
  readonly getWebBundleId: () => string;
  readonly validateSignatures: () => readonly { readonly status: string; readonly isValid?: boolean }[];
  readonly getSignedWebBundleBytes: () => Uint8Array;
}
export type BundleSigner = (bytes: Uint8Array, key: crypto.KeyObject) => Promise<SignedBundle>;
export const signBundle: BundleSigner = (bytes, key) => SignedWebBundle.fromWebBundle(bytes, [new NodeCryptoSigningStrategy(key)]);
export const validateSignedBundle = (signed: SignedBundle, webBundleId: string): Uint8Array => {
  if (signed.getWebBundleId() !== webBundleId) throw new Error('Web Bundle ID mismatch');
  if (signed.validateSignatures().some((result) => result.status !== 'success' || result.isValid !== true)) throw new Error('Signature validation failed');
  return signed.getSignedWebBundleBytes();
};
export const buildHub = (options: HubBuildOptions = {}, signer: BundleSigner = signBundle): Effect.Effect<BundleInfo, Error> => Effect.gen(function* () {
  const outDir = options.outDir ?? process.env['I6_OUT_DIR'] ?? path.join(ROOT, 'dist/public/hub');
  const keyPath = options.keyPath ?? process.env['I6_SIGNING_KEY'] ?? path.join(os.homedir(), '.config/i6-share/hub-signing-key.pem');
  const files = yield* collectHubFiles(options.hubDir ?? process.env['I6_HUB_DIR'], options.publicDir);
  const manifest = yield* readHubManifest(files);
  if (!/^\d+(?:\.\d+)*$/.test(manifest.version)) return yield* Effect.fail(new Error('Manifest version must be dot-separated numbers'));
  const info = options.info ?? (yield* buildInfo(manifest.version));
  const key = yield* Effect.try({ try: () => loadOrCreateKey(keyPath), catch: toolError });
  const webBundleId = new WebBundleId(key).serialize();
  const unsigned = yield* Effect.try({ try: () => createUnsignedBundle(files, webBundleId, info), catch: toolError });
  const signed = yield* Effect.tryPromise({ try: () => signer(unsigned, key), catch: toolError });
  return yield* Effect.try({ try: () => {
    const bytes = validateSignedBundle(signed, webBundleId);
    const result: BundleInfo = { ...info, version: manifest.version, size: bytes.byteLength, webBundleId,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    };
    fs.mkdirSync(outDir, { recursive: true });
    writeAtomic(path.join(outDir, BUNDLE_NAME), bytes);
    writeAtomic(path.join(outDir, 'version.json'), `${JSON.stringify(result, null, 2)}\n`);
    writeAtomic(path.join(outDir, 'update.json'), `${JSON.stringify({ versions: [{ version: manifest.version, src: BUNDLE_NAME }] }, null, 2)}\n`);
    return result;
  }, catch: toolError });
});
