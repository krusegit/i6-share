import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorMessage, mimeType, ROOT, toolError, walkFiles } from '../tools/hub-files.js';
import { buildInfo, buildInfoModule, readGit } from '../tools/build-info.js';
import { buildIcons, ICON_JOBS, renderIcon } from '../tools/build-icons.js';
import { BUILD } from '../public/build-info.js';

const directories: string[] = [];
const temporary = (): string => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'i6-tools-')); directories.push(dir); return dir; };
const write = (file: string, contents = ''): void => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, contents); };
afterEach(() => { directories.splice(0).forEach((dir) => { fs.rmSync(dir, { recursive: true, force: true }); }); });

describe('bundle file inventory', () => {
  it('maps MIME types and normalizes unknown failures', () => {
    expect(mimeType('ICON.PNG')).toBe('image/png'); expect(mimeType('x.unknown')).toBe('application/octet-stream');
    const error = new Error('failure'); expect(toolError(error)).toBe(error); expect(toolError('bad').message).toBe('bad');
    expect(errorMessage(error)).toBe('failure'); expect(errorMessage(42)).toBe('42'); expect(ROOT).toContain('i6-share');
    expect(BUILD.commit).toBe('dev');
  });
  it('recurses in sorted order, skips hidden entries, rejects symlinks, accepts absent directories', () => {
    const dir = temporary(); write(path.join(dir, 'z.txt')); write(path.join(dir, 'a/b.txt')); write(path.join(dir, '.hidden'));
    expect(walkFiles(dir).map((entry) => entry.urlPath)).toEqual(['/a/b.txt', '/z.txt']); expect(walkFiles(path.join(dir, 'absent'))).toEqual([]);
    fs.symlinkSync(path.join(dir, 'z.txt'), path.join(dir, 'link')); expect(() => walkFiles(dir)).toThrow('symbolic link');
  });

});

describe('build metadata and icons', () => {
  it('reports clean, dirty and non-git sources with explicit clock', () => {
    const clock = (): Date => new Date('2026-01-02T03:04:05.000Z');
    const git = (command: string): string => command === 'rev-parse' ? 'abc1234' : command === 'log' ? 'date' : '';
    const clean = Effect.runSync(buildInfo('1', git, clock)); expect(clean).toEqual({ version: '1', commit: 'abc1234', committedAt: 'date', builtAt: clock().toISOString() });
    expect(Effect.runSync(buildInfo(null, () => 'dirty', clock)).commit).toBe('dirty-dirty');
    expect(Effect.runSync(buildInfo(null, () => '', clock))).toMatchObject({ commit: 'dev', committedAt: null });
    expect(buildInfoModule(clean)).toContain('export const BUILD'); expect(Effect.runSync(buildInfo()).builtAt).toBeTypeOf('string');
    expect(readGit('rev-parse', '--show-toplevel')).toBe(ROOT); expect(readGit('i6-invalid-command')).toBe('');
  });
  it('renders each SVG at its specified size and exposes command failures', async () => {
    const render = vi.fn<(command: string, args: readonly string[]) => void>();
    await Effect.runPromise(buildIcons('/icons', render)); expect(render).toHaveBeenCalledTimes(ICON_JOBS.length);
    expect(render).toHaveBeenCalledWith('rsvg-convert', ['-w', '180', '-h', '180', '-o', '/icons/apple-touch-icon.png', '/icons/maskable.svg']);
    await Effect.runPromise(buildIcons(undefined, render));
    await expect(Effect.runPromise(buildIcons('/icons', () => { throw new Error('missing renderer'); }))).rejects.toThrow('missing renderer');
    expect(() => { renderIcon('i6-nonexistent-command', []); }).toThrow();
  });
});
