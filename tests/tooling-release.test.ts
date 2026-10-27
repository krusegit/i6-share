import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Effect } from 'effect';
import { afterEach, describe, expect, it } from 'vitest';
import { compareVersions, readMetadataField } from '../tools/release.js';

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
