import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSite, copyStatic } from '../tools/build.js';
import { buildHub, readVersion, runHub, runProcess, runtimeIdentifier, type ProcessRunner } from '../tools/build-hub.js';
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
  write(path.join(root, 'native/version.json'), '{"version":"1.1.0"}');
  write(path.join(root, 'public/icons/icon.svg'), '<svg/>');
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


describe('native AOT builds', () => {
  it('selects only supported native target platforms', () => {
    expect(runtimeIdentifier('linux', 'x64')).toBe('linux-x64'); expect(runtimeIdentifier('linux', 'arm64')).toBe('linux-arm64');
    expect(runtimeIdentifier('darwin', 'x64')).toBe('osx-x64'); expect(runtimeIdentifier('darwin', 'arm64')).toBe('osx-arm64');
    expect(runtimeIdentifier()).toMatch(/^(linux|osx)-(x64|arm64)$/);
    expect(() => runtimeIdentifier('win32', 'x64')).toThrow('Unsupported'); expect(() => runtimeIdentifier('linux', 'ia32')).toThrow('Unsupported');
    expect(readVersion()).toBe('1.1.0');
  });
  it('publishes AOT and ships only the executable and dashboard with checksum metadata', async () => {
    const root = temporary(); fixture(root); const out = await Effect.runPromise(buildSite({ root, info }));
    const calls: string[][] = [];
    const run: ProcessRunner = async (command, args, cwd) => {
      calls.push([command, ...args]);
      if (command === 'dotnet') write(path.join(root, 'dist/native/linux-x64/i6-share-hub'), 'native executable');
      else await runProcess(command, args, cwd);
    };
    const result = await Effect.runPromise(buildHub({ root, rid: 'linux-x64', hostRid: 'linux-x64', info }, run));
    expect(calls[0]).toContain('-p:PublishAot=true'); expect(calls[0]).toContain('-p:Version=1.1.0');
    expect(result.file).toBe('i6-share-hub-linux-x64.tar.gz');
    const archive = path.join(out, 'public/downloads', result.file); const bytes = fs.readFileSync(archive);
    expect(result.sha256).toBe(crypto.createHash('sha256').update(bytes).digest('hex')); expect(result.size).toBe(bytes.length);
    expect(fs.readFileSync(`${archive}.sha256`, 'utf8')).toBe(`${result.sha256}  ${result.file}\n`);
    expect(fs.readFileSync(path.join(out, 'public/downloads/linux-x64.json'), 'utf8')).toContain(result.sha256);
    expect(fs.existsSync(path.join(root, 'dist/native/linux-x64/wwwroot/hub.js.map'))).toBe(false);
    const extracted = path.join(root, 'extracted'); fs.mkdirSync(extracted);
    await runProcess('tar', ['-xzf', archive, '-C', extracted], root);
    expect(fs.readFileSync(path.join(extracted, 'i6-share-hub'), 'utf8')).toBe('native executable');
    expect(fs.existsSync(path.join(extracted, 'wwwroot/style.css'))).toBe(true);
    expect(fs.existsSync(path.join(extracted, 'wwwroot/icons/icon.svg'))).toBe(true);
    const other = path.join(root, 'custom-downloads');
    const second = await Effect.runPromise(buildHub({ root, rid: 'linux-x64', hostRid: 'linux-x64', outDir: other, webRoot: path.join(out, 'hub') }, run));
    expect(second.version).toBe('1.1.0');
  });
  it('rejects cross-platform compilation, invalid versions, missing assets and publishing/packaging failures', async () => {
    const root = temporary(); fixture(root); const out = await Effect.runPromise(buildSite({ root, info }));
    await expect(Effect.runPromise(buildHub({ root, rid: 'linux-x64', hostRid: 'osx-arm64' }))).rejects.toThrow('target runner');
    write(path.join(root, 'native/version.json'), '{"version":"bad"}');
    await expect(Effect.runPromise(buildHub({ root }))).rejects.toThrow();
    write(path.join(root, 'native/version.json'), JSON.stringify({ version: '1.1.0\n' }));
    await expect(Effect.runPromise(buildHub({ root }))).rejects.toThrow();
    write(path.join(root, 'native/version.json'), '{"version":"1.1.0"}');
    await expect(Effect.runPromise(buildHub({ root, webRoot: path.join(root, 'missing') }))).rejects.toThrow('Build the dashboard');
    await expect(Effect.runPromise(buildHub({ root }, () => Promise.reject(new Error('compiler failed'))))).rejects.toThrow('compiler failed');
    await expect(Effect.runPromise(buildHub({ root }, () => Promise.resolve()))).rejects.toThrow();
    const options = { root, rid: 'linux-x64', hostRid: 'linux-x64', webRoot: path.join(out, 'hub') } as const;
    await expect(Effect.runPromise(buildHub(options, () => { fs.mkdirSync(path.join(root, 'dist/native/linux-x64/i6-share-hub'), { recursive: true }); return Promise.resolve(); }))).rejects.toThrow('did not produce');
    await expect(Effect.runPromise(buildHub(options, (command) => {
      if (command === 'dotnet') { write(path.join(root, 'dist/native/linux-x64/i6-share-hub')); return Promise.resolve(); }
      return Promise.reject(new Error('archive failed'));
    }))).rejects.toThrow('archive failed');
    await expect(Effect.runPromise(buildHub(options, () => { write(path.join(root, 'dist/native/linux-x64/i6-share-hub')); return Promise.resolve(); }))).rejects.toThrow();
    const exists = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    await expect(Effect.runPromise(buildHub())).rejects.toThrow('Build the dashboard'); exists.mockRestore();
  });
  it('runs native development and propagates process exit, signals and spawn errors', async () => {
    const run = vi.fn<ProcessRunner>().mockResolvedValue(undefined);
    await Effect.runPromise(runHub('/repo', run)); expect(run).toHaveBeenCalledWith('dotnet', ['run', '--project', '/repo/native/I6Share.Hub', '--', '--web-root', '/repo/dist/hub'], '/repo');
    run.mockRejectedValueOnce(new Error('native failed')); await expect(Effect.runPromise(runHub(undefined, run))).rejects.toThrow('native failed');
    await runProcess(process.execPath, ['-e', 'process.exit(0)'], temporary());
    await expect(runProcess(process.execPath, ['-e', 'process.exit(7)'], temporary())).rejects.toThrow('7');
    await expect(runProcess(process.execPath, ['-e', 'process.kill(process.pid,"SIGTERM")'], temporary())).rejects.toThrow('SIGTERM');
    await expect(runProcess('i6-missing-command', [], temporary())).rejects.toThrow();
    await expect(Effect.runPromise(runHub('/i6-missing-working-directory'))).rejects.toThrow();
  });
});
