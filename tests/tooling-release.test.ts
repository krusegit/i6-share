import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { Effect } from 'effect';
import { afterEach, describe, expect, it } from 'vitest';
import { assembleRelease, compareVersions, readMetadataField } from '../tools/release.js';

const directories: string[] = [];
const temporary = (): string => { const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'i6-release-')); directories.push(directory); return directory; };
afterEach(() => { directories.splice(0).forEach((directory) => { fs.rmSync(directory, { recursive: true, force: true }); }); });

describe('release version decisions', () => {
  it.each([
    ['1', '1', 0], ['1.0', '1.0.0', 0], ['01.002', '1.2', 0],
    ['2', '1.99', 1], ['1.11', '1.2', 1], ['1', '1.0.1', -1],
    ['1.0.1', '1', 1], ['1.2', '1.11', -1], ['0', '1', -1],
    ['9007199254740993', '9007199254740992', 1],
  ])('compares %s with %s as %d', (left, right, expected) => {
    expect(compareVersions(left, right)).toBe(expected);
    expect(compareVersions(right, left)).toBe(expected === 0 ? 0 : -expected);
  });
  it.each(['', '1.', '.1', '-1', '1..2', '1.2beta', '1\n', ' 1', '1 ', '1/2'])('rejects malformed version %j on either side', (invalid) => {
    expect(() => compareVersions(invalid, '1')).toThrow('Invalid numeric version');
    expect(() => compareVersions('1', invalid)).toThrow('Invalid numeric version');
  });
});

describe('release metadata', () => {
  it('reads strings and numeric sizes, leaving absent/non-scalar values empty', async () => {
    const file = path.join(temporary(), 'version.json');
    fs.writeFileSync(file, JSON.stringify({ version: '1.2.3', size: 1234, zero: 0, empty: '', nil: null, nested: { version: '1' }, list: [], flag: false }));
    expect(await Effect.runPromise(readMetadataField(file, 'version'))).toBe('1.2.3');
    expect(await Effect.runPromise(readMetadataField(file, 'size'))).toBe('1234');
    expect(await Effect.runPromise(readMetadataField(file, 'zero'))).toBe('0');
    for (const key of ['empty', 'nil', 'nested', 'list', 'flag', 'absent']) expect(await Effect.runPromise(readMetadataField(file, key))).toBe('');
  });
  it('fails missing files, malformed JSON, and non-object metadata', async () => {
    const file = path.join(temporary(), 'version.json');
    await expect(Effect.runPromise(readMetadataField(file, 'version'))).rejects.toThrow();
    for (const contents of ['{', '[]', 'null', '42', '"value"']) {
      fs.writeFileSync(file, contents);
      await expect(Effect.runPromise(readMetadataField(file, 'version'))).rejects.toThrow();
    }
  });
});


describe('native download catalog', () => {
  const artifact = (directory: string, rid: string, overrides: Readonly<Record<string, unknown>> = {}): void => {
    const file = `i6-share-hub-${rid}.tar.gz`;
    const contents = Buffer.from(rid);
    fs.writeFileSync(path.join(directory, file), contents);
    fs.writeFileSync(path.join(directory, `${rid}.json`), JSON.stringify({ version: '1.1.0', file, size: contents.length, sha256: crypto.createHash('sha256').update(contents).digest('hex'), ...overrides }));
  };
  it('requires both verified artifacts and emits a stable installer manifest', async () => {
    const directory = temporary(); artifact(directory, 'linux-x64'); artifact(directory, 'linux-arm64');
    const manifest = await Effect.runPromise(assembleRelease(directory));
    expect(manifest.version).toBe('1.1.0');
    expect(manifest.artifacts['linux-x64'].file).toBe('i6-share-hub-linux-x64.tar.gz');
    expect(manifest.artifacts['linux-arm64'].size).toBe(11);
    expect(JSON.parse(fs.readFileSync(path.join(directory, 'version.json'), 'utf8'))).toEqual(manifest);
  });
  it('rejects missing metadata, unsafe filenames, mismatched hashes/sizes and release versions', async () => {
    const directory = temporary();
    await expect(Effect.runPromise(assembleRelease(directory))).rejects.toThrow();
    artifact(directory, 'linux-x64'); artifact(directory, 'linux-arm64', { file: '../escape.tar.gz' });
    await expect(Effect.runPromise(assembleRelease(directory))).rejects.toThrow('Unexpected download filename');
    artifact(directory, 'linux-arm64', { size: 1 });
    await expect(Effect.runPromise(assembleRelease(directory))).rejects.toThrow('integrity mismatch');
    artifact(directory, 'linux-arm64', { sha256: 'bad' });
    await expect(Effect.runPromise(assembleRelease(directory))).rejects.toThrow('integrity mismatch');
    artifact(directory, 'linux-arm64', { version: '2' });
    await expect(Effect.runPromise(assembleRelease(directory))).rejects.toThrow('different versions');
    artifact(directory, 'linux-x64', { version: 'bad' }); artifact(directory, 'linux-arm64', { version: 'bad' });
    await expect(Effect.runPromise(assembleRelease(directory))).rejects.toThrow('Invalid numeric version');
  });
});
