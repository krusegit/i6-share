import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Effect } from 'effect';
import { Bundle } from 'wbn';
import { WebBundleId } from 'wbn-sign';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSite, copyStatic } from '../tools/build.js';
import { BUNDLE_NAME, buildHub, createUnsignedBundle, loadOrCreateKey, lowerHeaders, validateSignedBundle, writeAtomic, type SignedBundle } from '../tools/build-hub.js';
import type { BuildInfo } from '../tools/build-info.js';

const directories: string[] = [];
const temporary = (): string => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'i6-build-')); directories.push(dir); return dir; };
const write = (file: string, contents = ''): void => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, contents); };
const info: BuildInfo = { version: '1', commit: 'test', committedAt: null, builtAt: '2026-01-01' };
afterEach(() => { directories.splice(0).forEach((dir) => { fs.rmSync(dir, { recursive: true, force: true }); }); vi.unstubAllEnvs(); });
const fixture = (root: string): void => {
  write(path.join(root, 'public/index.html'), '<script type="module" src="app.js"></script>');
  write(path.join(root, 'public/style.css'), 'body{}'); write(path.join(root, 'public/legacy.js'), 'bad'); write(path.join(root, 'public/hub/old.swbn'), 'old');
  write(path.join(root, 'hub/index.html'), '<script type="module" src="hub.js"></script>');
  write(path.join(root, 'hub/manifest.webmanifest'), '{"version":"1.0.0"}');
  write(path.join(root, 'public/build-info.ts'), 'export const BUILD = {};');
  write(path.join(root, 'public/app.ts'), "import { BUILD } from './build-info.js'; import './backupapp.js'; export const initializePhoneUi = async () => { console.log(BUILD); };");
  write(path.join(root, 'public/backupapp.ts'), 'export const value = 1;');
  write(path.join(root, 'public/sw.ts'), 'export const initializeServiceWorker = () => {};');
  write(path.join(root, 'public/setup/setup.ts'), 'export const initializeSetup = async () => {};');
  write(path.join(root, 'hub/hub.ts'), "export const initializeHubUi = async () => { console.log(await import('../public/build-info.js')); };");
  ['client', 'lib/proto', 'lib/dom', 'lib/store'].forEach((name) => { write(path.join(root, 'public', `${name}.ts`), 'export const value = 1;'); });
};

describe('offline browser build', () => {
  it('copies static assets and bundles every entry, metadata, startup and source maps', async () => {
    const root = temporary(); fixture(root);
    const out = await Effect.runPromise(buildSite({ root, info }));
    expect(fs.existsSync(path.join(out, 'public/legacy.js'))).toBe(false); expect(fs.existsSync(path.join(out, 'public/hub/old.swbn'))).toBe(false);
    expect(fs.readFileSync(path.join(out, 'public/app.js'), 'utf8')).toContain('initializePhoneUi().catch(console.error)');
    expect(fs.readFileSync(path.join(out, 'public/app.js'), 'utf8')).toContain('./build-info.js');
    expect(fs.readFileSync(path.join(out, 'public/sw.js'), 'utf8')).toContain('initializeServiceWorker()');
    expect(fs.readFileSync(path.join(out, 'hub/hub.js'), 'utf8')).toContain('initializeHubUi().catch(console.error)');
    expect(fs.readFileSync(path.join(out, 'hub/hub.js'), 'utf8')).toContain('import("./build-info.js")');
    expect(fs.readFileSync(path.join(out, 'hub/hub.js'), 'utf8')).not.toContain('../public/build-info.js');
    expect(fs.readFileSync(path.join(out, 'public/setup/setup.js'), 'utf8')).toContain('initializeSetup().catch(console.error)');
    expect(fs.existsSync(path.join(out, 'public/app.js.map'))).toBe(true);
    expect(fs.readFileSync(path.join(out, 'public/build-info.js'), 'utf8')).toContain('test');
    const other = path.join(root, 'other'); await Effect.runPromise(buildSite({ root, outDir: other }, () => Promise.resolve(undefined)));
    expect(fs.existsSync(path.join(other, 'public/index.html'))).toBe(true);
  });
  it('propagates bundling and filesystem failures without shipping source', async () => {
    const root = temporary(); fixture(root);
    await expect(Effect.runPromise(buildSite({ root }, () => Promise.reject(new Error('bundling failed'))))).rejects.toThrow('bundling failed');
    let call = 0;
    await expect(Effect.runPromise(buildSite({ root }, () => { call += 1; return call === 2 ? Promise.reject(new Error('hub failed')) : Promise.resolve(undefined); }))).rejects.toThrow('hub failed');
    write(path.join(root, 'file'));
    await expect(Effect.runPromise(buildSite({ root, outDir: path.join(root, 'file') }))).rejects.toThrow();
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw new Error('write failed'); });
    await expect(Effect.runPromise(buildSite({ root }, () => Promise.resolve(undefined)))).rejects.toThrow('write failed'); writeSpy.mockRestore();
    const mkdir = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => { throw new Error('default root'); });
    await expect(Effect.runPromise(buildSite())).rejects.toThrow('default root'); mkdir.mockRestore();
    copyStatic(path.join(root, 'missing'), path.join(root, 'unused'));
  });
});

describe('signed IWA builds', () => {
  it('creates private identity keys, reuses them, warns for loose modes and rejects corrupt keys', () => {
    const dir = temporary(); const keyPath = path.join(dir, 'keys/key.pem'); const warn = vi.fn<(message: string) => void>();
    const first = loadOrCreateKey(keyPath, warn); const second = loadOrCreateKey(keyPath, warn);
    expect(first.export({ format: 'pem', type: 'pkcs8' })).toEqual(second.export({ format: 'pem', type: 'pkcs8' })); expect(warn).toHaveBeenCalledOnce();
    fs.chmodSync(keyPath, 0o644); loadOrCreateKey(keyPath, warn); expect(warn).toHaveBeenCalledTimes(2);
    write(keyPath, 'invalid'); expect(() => loadOrCreateKey(keyPath, warn)).toThrow();
    writeAtomic(path.join(dir, 'atomic'), 'content'); expect(fs.readFileSync(path.join(dir, 'atomic'), 'utf8')).toBe('content');
    expect(lowerHeaders({ 'X-Test': 'ok' })).toEqual({ 'x-test': 'ok' });
  });
  it('builds and validates actual signed bytes, manifest aliases, redirects, hashes and update metadata', async () => {
    const root = temporary(); fixture(root); const out = await Effect.runPromise(buildSite({ root, info })); const keyPath = path.join(root, 'key.pem');
    const result = await Effect.runPromise(buildHub({ hubDir: path.join(out, 'hub'), publicDir: path.join(out, 'public'), outDir: path.join(root, 'release'), keyPath, info }));
    expect(result.version).toBe('1.0.0');
    const bytes = fs.readFileSync(path.join(root, 'release', BUNDLE_NAME)); expect(result.size).toBe(bytes.length);
    expect(result.sha256).toBe(crypto.createHash('sha256').update(bytes).digest('hex'));
    expect(fs.readFileSync(path.join(root, 'release/update.json'), 'utf8')).toContain(BUNDLE_NAME);
    const key = loadOrCreateKey(keyPath); const id = new WebBundleId(key).serialize();
    const unsigned = createUnsignedBundle([{ file: path.join(root, 'hub/index.html'), urlPath: '/index.html' }, { file: path.join(root, 'public/style.css'), urlPath: '/style.css' }], id, info);
    const bundle = new Bundle(unsigned); expect(bundle.getResponse(`isolated-app://${id}/index.html`).status).toBe(301);
    expect(bundle.getResponse(`isolated-app://${id}/`).status).toBe(200);
    vi.stubEnv('I6_HUB_DIR', path.join(out, 'hub')); vi.stubEnv('I6_SIGNING_KEY', keyPath); vi.stubEnv('I6_OUT_DIR', path.join(root, 'env-release'));
    const envResult = await Effect.runPromise(buildHub({ publicDir: path.join(out, 'public') })); expect(envResult.webBundleId).toBe(result.webBundleId);
  });
  it('rejects tampered signatures and identity mismatch', () => {
    const good: SignedBundle = { getWebBundleId: () => 'id', validateSignatures: () => [{ status: 'success', isValid: true }], getSignedWebBundleBytes: () => new Uint8Array([1]) };
    expect(validateSignedBundle(good, 'id')).toEqual(new Uint8Array([1])); expect(() => validateSignedBundle(good, 'different')).toThrow('mismatch');
    expect(() => validateSignedBundle({ ...good, validateSignatures: () => [{ status: 'failure' }] }, 'id')).toThrow('Signature');
    expect(() => validateSignedBundle({ ...good, validateSignatures: () => [{ status: 'success', isValid: false }] }, 'id')).toThrow('Signature');
  });
  it('fails invalid versions, signing errors, filesystem errors and missing builds', async () => {
    const root = temporary(); fixture(root); const out = await Effect.runPromise(buildSite({ root, info }));
    const options = { hubDir: path.join(out, 'hub'), publicDir: path.join(out, 'public'), outDir: path.join(root, 'release'), keyPath: path.join(root, 'key.pem') };
    await expect(Effect.runPromise(buildHub(options, () => Promise.reject(new Error('signing failed'))))).rejects.toThrow('signing failed');
    write(path.join(out, 'hub/manifest.webmanifest'), '{"version":"bad"}'); await expect(Effect.runPromise(buildHub(options))).rejects.toThrow('version');
    vi.stubEnv('I6_HUB_DIR', path.join(root, 'missing')); vi.stubEnv('I6_SIGNING_KEY', ''); vi.stubEnv('I6_OUT_DIR', '');
    await expect(Effect.runPromise(buildHub())).rejects.toThrow('No index');
    vi.unstubAllEnvs(); const exists = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    await expect(Effect.runPromise(buildHub())).rejects.toThrow('No index'); exists.mockRestore();
  });
});
