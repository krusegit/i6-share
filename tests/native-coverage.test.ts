import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Effect } from 'effect';
import { afterEach, expect, test, vi } from 'vitest';
import { checkNativeCoverage, cleanNativeCoverage, decodeNativeCoverage, REPORTS_DIR, summarizeNativeCoverage } from '../tools/check-native-coverage.js';
import type { NativeCoverage } from '../tools/check-native-coverage.js';

const directories: string[] = [];
const directory = (): string => { const result = fs.mkdtempSync(path.join(os.tmpdir(), 'i6-native-report-')); directories.push(result); return result; };
afterEach(() => { vi.restoreAllMocks(); directories.splice(0).forEach((dir) => { fs.rmSync(dir, { recursive: true, force: true }); }); });
const report = (lineHits = 1, branchHits = 1): NativeCoverage => ({
  'I6Share.Contracts.dll': { 'Contract.cs': { Contract: { Get: { Lines: { '1': lineHits }, Branches: [] } } } },
  'I6Share.TypeGen.dll': { 'Generator.cs': { Generator: { Generate: { Lines: { '2': 1 }, Branches: [{ Line: 2, Offset: 1, EndOffset: 2, Path: 0, Ordinal: 0, Hits: branchHits }] } } } },
  'i6-share-hub.dll': { 'Hub.cs': { Hub: { Handle: { Lines: { '3': 1 }, Branches: [] } } } },
});

test('validates report input and merges exact points across test assemblies', () => {
  expect(() => decodeNativeCoverage({ module: { file: { type: { method: { Lines: { '1': 'bad' }, Branches: [] } } } } })).toThrow();
  expect(decodeNativeCoverage(report())).toEqual(report());
  const result = summarizeNativeCoverage([report(0, 0), report()]);
  expect(result.lines).toEqual({ total: 3, covered: 3, percent: 100 });
  expect(result.branches).toEqual({ total: 1, covered: 1, percent: 100 });
  expect(result.files).toHaveLength(3);
  expect(result.missing).toEqual([]);
  expect(result.files.find((file) => file.file === 'Contract.cs')?.branches.percent).toBe(100);
});

test('rejects absent assemblies, empty reports, and identifies uncovered source', () => {
  expect(() => summarizeNativeCoverage([])).toThrow('Missing native coverage modules');
  expect(() => summarizeNativeCoverage([{ 'I6Share.Contracts.dll': {}, 'I6Share.TypeGen.dll': {}, 'i6-share-hub.dll': {} }])).toThrow('no executable source');
  const result = summarizeNativeCoverage([report(0, 0)]);
  expect(result.lines.covered).toBe(2);
  expect(result.branches.covered).toBe(0);
  expect(result.missing).toEqual(['Contract.cs:1', 'Generator.cs:2 branch 0 (Generate)']);
});

test('reads only coverage JSON, writes summaries, and fails the coverage gate', async () => {
  const dir = directory();
  fs.mkdirSync(path.join(dir, 'first'));
  fs.writeFileSync(path.join(dir, 'first/coverage.json'), JSON.stringify(report(0, 0)));
  fs.writeFileSync(path.join(dir, 'ignored.json'), '{}');
  await expect(Effect.runPromise(checkNativeCoverage(dir))).rejects.toThrow('must be 100%');
  expect(fs.existsSync(path.join(dir, 'summary.json'))).toBe(true);
  fs.mkdirSync(path.join(dir, 'second'));
  fs.writeFileSync(path.join(dir, 'second/coverage.json'), JSON.stringify(report()));
  expect((await Effect.runPromise(checkNativeCoverage(dir))).lines.percent).toBe(100);
  await Effect.runPromise(cleanNativeCoverage(dir));
  expect(fs.readdirSync(dir)).toEqual([]);
  await expect(Effect.runPromise(checkNativeCoverage(dir))).rejects.toThrow('Missing native coverage modules');
});

test('uses the designated default report directory and reports filesystem failures', async () => {
  const remove = vi.spyOn(fs, 'rmSync').mockImplementation(() => undefined);
  const mkdir = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
  await Effect.runPromise(cleanNativeCoverage());
  expect(remove).toHaveBeenCalledWith(REPORTS_DIR, { recursive: true, force: true });
  expect(mkdir).toHaveBeenCalledWith(REPORTS_DIR, { recursive: true });
  mkdir.mockImplementation(() => { throw new Error('unwritable'); });
  await expect(Effect.runPromise(cleanNativeCoverage())).rejects.toThrow('unwritable');
  vi.spyOn(fs, 'existsSync').mockReturnValue(false);
  await expect(Effect.runPromise(checkNativeCoverage())).rejects.toThrow('Missing native coverage modules');
});
