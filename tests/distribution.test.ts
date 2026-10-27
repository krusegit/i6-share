import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Effect } from 'effect';
import { expect, it } from 'vitest';
import { buildSite } from '../tools/build.js';
import { OPTIONAL, SHELL } from '../public/sw.js';

it('ships the phone offline shell and every local dashboard asset without IWA files', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'i6-distribution-'));
  try {
    const output = await Effect.runPromise(buildSite({ outDir: path.join(temporary, 'site') }));
    for (const resource of [...SHELL, ...OPTIONAL]) {
      const filename = resource === './' ? 'index.html' : resource;
      expect(fs.statSync(path.join(output, 'public', filename)).isFile(), resource).toBe(true);
    }
    const hubDir = path.join(output, 'hub');
    const index = fs.readFileSync(path.join(hubDir, 'index.html'), 'utf8');
    for (const match of index.matchAll(/(?:src|href)="((?:\/|\.\/)[^"]+)"/g)) {
      const resource = match[1];
      if (resource === undefined) throw new Error('missing captured asset');
      expect(fs.statSync(path.join(hubDir, resource)).isFile(), resource).toBe(true);
    }
    const script = fs.readFileSync(path.join(hubDir, 'hub.js'), 'utf8');
    expect(script).toContain('initializeHubUi().catch(console.error)');
    expect(script).not.toMatch(/\bTCPServerSocket\b|\bUDPSocket\b|\bisolated-app:/);
    expect(script).not.toMatch(/\beval\(|\bnew Function\(/);
    expect(fs.existsSync(path.join(hubDir, 'manifest.webmanifest'))).toBe(false);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});
