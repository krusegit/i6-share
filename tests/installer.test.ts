import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, expect, it } from 'vitest';

let temporary = '';
let environment: NodeJS.ProcessEnv = {};
let data = '';
const script = path.resolve('public/install.sh');
const run = (...args: readonly string[]) => spawnSync('bash', [script, ...args], { env: environment, encoding: 'utf8' });
const release = (version: string, architecture = 'linux-x64'): void => {
  const source = path.join(temporary, 'source'); fs.mkdirSync(path.join(source, 'wwwroot'), { recursive: true });
  fs.writeFileSync(path.join(source, 'i6-share-hub'), `#!/bin/sh\nprintf '%s\\n' '${version}'\n`);
  fs.writeFileSync(path.join(source, 'wwwroot/index.html'), 'dashboard');
  const filename = `i6-share-hub-${architecture}.tar.gz`;
  const output = path.join(temporary, 'web/downloads', filename);
  const archived = spawnSync('tar', ['-czf', output, '-C', source, 'i6-share-hub', 'wwwroot'], { encoding: 'utf8' });
  expect(archived.status).toBe(0);
  const bytes = fs.readFileSync(output);
  fs.writeFileSync(path.join(temporary, 'web/downloads/version.json'), JSON.stringify({ version, artifacts: { [architecture]: { file: filename, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), size: bytes.length } } }));
};
beforeEach(() => {
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'i6-installer-'));
  data = path.join(temporary, 'data/i6-share');
  const mocks = path.join(temporary, 'mocks'); fs.mkdirSync(mocks);
  fs.mkdirSync(path.join(temporary, 'web/downloads'), { recursive: true });
  fs.writeFileSync(path.join(mocks, 'uname'), '#!/bin/sh\nif [ "$1" = -s ]; then echo Linux; else echo x86_64; fi\n', { mode: 0o700 });
  fs.writeFileSync(path.join(mocks, 'id'), '#!/bin/sh\necho 1000\n', { mode: 0o700 });
  environment = { ...process.env, PATH: `${mocks}:${process.env['PATH'] ?? ''}`, XDG_DATA_HOME: path.join(temporary, 'data'), I6_BIN_DIR: path.join(temporary, 'bin'), I6_BASE_URL: pathToFileURL(path.join(temporary, 'web')).href };
});
afterEach(() => { fs.rmSync(temporary, { recursive: true, force: true }); });

it('installs without root or autostart, atomically updates, and rolls back while keeping data', () => {
  release('1.1.0'); const installed = run('--yes', '--no-firewall');
  expect(installed.status, installed.stderr).toBe(0);
  const first = fs.readlinkSync(path.join(data, 'current'));
  expect(first).toMatch(/^releases\/1\.1\.0-linux-x64-/);
  expect(fs.readFileSync(path.join(temporary, 'bin/i6-share-hub'), 'utf8')).toContain('--web-root');
  expect(fs.readFileSync(path.join(temporary, 'data/applications/i6-share-hub.desktop'), 'utf8')).toContain('--open');
  expect(fs.existsSync(path.join(temporary, 'data/autostart'))).toBe(false);
  fs.writeFileSync(path.join(data, 'paired-device-state'), 'preserve');
  expect(run().status).toBe(0);
  expect(fs.existsSync(path.join(data, 'previous'))).toBe(false);
  release('1.2.0'); expect(run().status).toBe(0);
  const second = fs.readlinkSync(path.join(data, 'current'));
  expect(second).not.toBe(first); expect(fs.readlinkSync(path.join(data, 'previous'))).toBe(first);
  expect(run('--rollback').status).toBe(0);
  expect(fs.readlinkSync(path.join(data, 'current'))).toBe(first);
  expect(fs.readlinkSync(path.join(data, 'previous'))).toBe(second);
  expect(fs.readFileSync(path.join(data, 'paired-device-state'), 'utf8')).toBe('preserve');
  expect(fs.readdirSync(data).filter((name) => name.startsWith('.install.'))).toEqual([]);
});
it('supports ARM64 and rejects unsupported architectures or operating systems', () => {
  const mock = path.join(temporary, 'mocks/uname');
  fs.writeFileSync(mock, '#!/bin/sh\nif [ "$1" = -s ]; then echo Linux; else echo aarch64; fi\n');
  release('1.1.0', 'linux-arm64'); expect(run().status).toBe(0);
  fs.writeFileSync(mock, '#!/bin/sh\nif [ "$1" = -s ]; then echo Linux; else echo riscv64; fi\n');
  expect(run().stderr).toContain('Supported architectures');
  fs.writeFileSync(mock, '#!/bin/sh\necho Darwin\n');
  expect(run().stderr).toContain('supports Linux');
});
it('rejects root, unknown options and rollback without a previous release', () => {
  expect(run('--help').status).toBe(0);
  expect(run('--unexpected').stderr).toContain('unknown option');
  expect(run('--rollback').stderr).toContain('No previous native installation');
  fs.writeFileSync(path.join(temporary, 'mocks/id'), '#!/bin/sh\necho 0\n');
  expect(run().stderr).toContain('normal user');
});
it('rejects corrupted metadata and archive bytes without replacing the current version', () => {
  release('1.1.0'); expect(run().status).toBe(0);
  const current = fs.readlinkSync(path.join(data, 'current'));
  release('1.2.0');
  const archive = path.join(temporary, 'web/downloads/i6-share-hub-linux-x64.tar.gz');
  fs.appendFileSync(archive, 'corrupt');
  expect(run().stderr).toContain('size does not match');
  expect(fs.readlinkSync(path.join(data, 'current'))).toBe(current);
  release('1.2.0'); const bytes = fs.readFileSync(archive); bytes[0] = 0; fs.writeFileSync(archive, bytes);
  expect(run().stderr).toContain('SHA-256 does not match');
  fs.writeFileSync(path.join(temporary, 'web/downloads/version.json'), '{}');
  expect(run().status).not.toBe(0);
  expect(fs.readlinkSync(path.join(data, 'current'))).toBe(current);
});
it('rejects archive links before extraction', () => {
  release('1.1.0');
  const source = path.join(temporary, 'source'); fs.symlinkSync('/tmp', path.join(source, 'wwwroot/escape'));
  release('1.1.0');
  const result = run(); expect(result.status).not.toBe(0); expect(result.stderr).toContain('Unsafe archive entry');
  expect(fs.existsSync(path.join(data, 'current'))).toBe(false);
});
