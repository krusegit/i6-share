import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Effect } from 'effect';
import { afterEach, expect, test, vi } from 'vitest';
import { checkNativeLines, MAX_NATIVE_LINES, NATIVE_SOURCE_DIR, physicalLines } from '../tools/check-native-lines.js';

const directories: string[] = [];
const directory = (): string => {
  const result = fs.mkdtempSync(path.join(os.tmpdir(), 'i6-native-lines-'));
  directories.push(result);
  return result;
};
afterEach(() => {
  vi.restoreAllMocks();
  directories.splice(0).forEach((dir) => { fs.rmSync(dir, { recursive: true, force: true }); });
});

test('counts physical lines consistently without a phantom line after the final newline', () => {
  expect(MAX_NATIVE_LINES).toBe(300);
  for (const newline of ['\n', '\r\n', '\r']) {
    expect(physicalLines(`// comment${newline}${newline}code${newline}`)).toBe(3);
    expect(physicalLines(`// comment${newline}${newline}code`)).toBe(3);
  }
  expect(physicalLines('')).toBe(0);
  expect(physicalLines('\n')).toBe(1);
  expect(physicalLines('code')).toBe(1);
});

test('accepts 300 lines and rejects 301 in production and test sources, ignoring build output', async () => {
  const dir = directory();
  for (const folder of ['Hub', 'Hub.Tests', 'Hub/bin', 'Hub/obj']) fs.mkdirSync(path.join(dir, folder), { recursive: true });
  const exactly = '// line\n'.repeat(300);
  const over = `${exactly}\n`;
  fs.writeFileSync(path.join(dir, 'Hub/Source.cs'), exactly);
  fs.writeFileSync(path.join(dir, 'Hub.Tests/Test.cs'), exactly);
  for (const file of ['Hub/bin/Generated.cs', 'Hub/obj/Generated.cs', 'README.md']) fs.writeFileSync(path.join(dir, file), over);
  await Effect.runPromise(checkNativeLines(dir));
  fs.writeFileSync(path.join(dir, 'Hub/Source.cs'), over);
  fs.writeFileSync(path.join(dir, 'Hub.Tests/Test.cs'), over);
  await expect(Effect.runPromise(checkNativeLines(dir))).rejects.toThrow('Hub/Source.cs: 301');
  await expect(Effect.runPromise(checkNativeLines(dir))).rejects.toThrow('Hub.Tests/Test.cs: 301');
});

test('fails closed on absent sources and filesystem errors, including the default location', async () => {
  const dir = directory();
  await expect(Effect.runPromise(checkNativeLines(dir))).rejects.toThrow('No C# sources');
  await expect(Effect.runPromise(checkNativeLines(path.join(dir, 'missing')))).rejects.toThrow('ENOENT');
  const read = vi.spyOn(fs, 'readdirSync').mockImplementation(() => { throw new Error('unreadable'); });
  await expect(Effect.runPromise(checkNativeLines())).rejects.toThrow('unreadable');
  expect(read).toHaveBeenCalledWith(NATIVE_SOURCE_DIR, { withFileTypes: true });
});
