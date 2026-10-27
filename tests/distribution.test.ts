import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Effect } from 'effect';
import { Bundle } from 'wbn';
import { SignedWebBundle } from 'wbn-sign';
import { expect, it } from 'vitest';
import { buildSite } from '../tools/build.js';
import { BUNDLE_NAME, buildHub } from '../tools/build-hub.js';
import { IWA_HEADERS } from '../tools/hub-files.js';
import { OPTIONAL, SHELL } from '../public/sw.js';

it('ships the actual phone offline shell and a signed hub with every referenced local asset', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'i6-distribution-'));
  try {
    const output = await Effect.runPromise(buildSite({ outDir: path.join(temporary, 'site') }));
    const publicDir = path.join(output, 'public'); const hubDir = path.join(output, 'hub');
    for (const resource of [...SHELL, ...OPTIONAL]) {
      const filename = resource === './' ? 'index.html' : resource;
      expect(fs.statSync(path.join(publicDir, filename)).isFile(), resource).toBe(true);
    }
    const release = path.join(temporary, 'release');
    const metadata = await Effect.runPromise(buildHub({ publicDir, hubDir, keyPath: path.join(temporary, 'identity.pem'), outDir: release }));
    const bytes = fs.readFileSync(path.join(release, BUNDLE_NAME));
    const signed = SignedWebBundle.fromBytes(bytes);
    expect(signed.getWebBundleId()).toBe(metadata.webBundleId);
    expect(signed.validateSignatures()).toEqual([expect.objectContaining({ status: 'success', isValid: true })]);
    expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(metadata.sha256);
    const bundle = new Bundle(bytes.subarray(bytes.length - Number(bytes.readBigUint64BE(bytes.length - 8))));
    const origin = `isolated-app://${metadata.webBundleId}`;
    expect(bundle.primaryURL).toBeNull();
    expect(bundle.getResponse(`${origin}/index.html`).status).toBe(301);
    const index = new TextDecoder().decode(bundle.getResponse(`${origin}/`).body);
    for (const match of index.matchAll(/(?:src|href)="(\/[^"]+)"/g)) {
      const resource = match[1];
      if (resource === undefined) throw new Error('missing captured asset');
      const response = bundle.getResponse(origin + resource);
      expect(response.status, resource).toBe(200);
      for (const [name, value] of Object.entries(IWA_HEADERS)) expect(response.headers[name.toLowerCase()], `${resource} ${name}`).toBe(value);
    }
    const script = new TextDecoder().decode(bundle.getResponse(`${origin}/hub.js`).body);
    expect(script).toContain('initializeHubUi().catch(console.error)');
    expect(script).toContain('import("./build-info.js")');
    expect(script).not.toMatch(/\beval\(|\bnew Function\(/);
    expect(script).not.toMatch(/\bimport\s*\(\s*["'](?:https?:|\.\.\/public\/)/);
    const info = new TextDecoder().decode(bundle.getResponse(`${origin}/build-info.js`).body);
    expect(info).toContain(`"version": "${metadata.version}"`);
    expect(bundle.urls.every((url) => !url.endsWith('.ts') && !url.endsWith('.map'))).toBe(true);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});
