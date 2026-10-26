#!/usr/bin/env node
// Builds the signed Web Bundle (.swbn) of the i6-share Hub Isolated Web App.
//
//   npm run build:hub
//
// Output (default public/hub/, override with I6_OUT_DIR):
//   i6-share-hub.swbn  the signed bundle users install
//   version.json       {version, size, webBundleId, builtAt, sha256} for the setup wizard
//   update.json        IWA update manifest ({versions:[{version, src}]})
//
// Env:
//   I6_SIGNING_KEY  path to the Ed25519 (or ECDSA P-256) PKCS8 PEM private key
//                   (default ~/.config/i6-share/hub-signing-key.pem; created if missing)
//   I6_HUB_DIR      hub source dir (default hub)
//   I6_OUT_DIR      output dir (default public/hub)
//
// The signing key IS the app's identity: the Web Bundle ID (isolated-app://<id>/)
// is derived from its public key. Losing it means the next build is a different
// app that users must install again (and re-pair, since storage is per origin).

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BundleBuilder } from 'wbn';
import { SignedWebBundle, NodeCryptoSigningStrategy, WebBundleId, parsePemKey } from 'wbn-sign';
import { ROOT, HUB_DIR, IWA_HEADERS, collectHubFiles, readHubManifest, mimeType } from './hub-files.mjs';

const BUNDLE_NAME = 'i6-share-hub.swbn';
const OUT_DIR = path.resolve(ROOT, process.env.I6_OUT_DIR || path.join('public', 'hub'));
const KEY_PATH = path.resolve(process.env.I6_SIGNING_KEY || path.join(os.homedir(), '.config', 'i6-share', 'hub-signing-key.pem'));

function fail(msg) {
  console.error(`\nbuild-hub: ${msg}\n`);
  process.exit(1);
}

function loadOrCreateKey() {
  if (!fs.existsSync(KEY_PATH)) {
    fs.mkdirSync(path.dirname(KEY_PATH), { recursive: true, mode: 0o700 });
    const { privateKey } = crypto.generateKeyPairSync('ed25519');
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    fs.writeFileSync(KEY_PATH, pem, { mode: 0o600, flag: 'wx' });
    const bar = '!'.repeat(78);
    console.warn(`\n${bar}\n  Generated a NEW hub signing key:\n    ${KEY_PATH}\n\n` +
      '  BACK THIS FILE UP (password manager, offline copy). The key determines the\n' +
      '  IWA identity (isolated-app://<Web Bundle ID>/). A different key = a different\n' +
      '  app: users would have to install it again and re-pair their phones.\n' +
      `  Never commit it. Use I6_SIGNING_KEY=/path/to/key.pem to build elsewhere.\n${bar}\n`);
  }
  const mode = fs.statSync(KEY_PATH).mode & 0o777;
  if (mode & 0o077) console.warn(`build-hub: warning: ${KEY_PATH} is readable by others (mode ${mode.toString(8)}); consider chmod 600.`);
  try {
    return parsePemKey(fs.readFileSync(KEY_PATH, 'utf8'));
  } catch (e) {
    fail(`Could not read signing key ${KEY_PATH}: ${e.message}\n(Encrypted keys are not supported; use an unencrypted PKCS8 PEM.)`);
  }
}

async function main() {
  let files, manifest;
  try {
    files = collectHubFiles();
    manifest = readHubManifest(files);
  } catch (e) {
    fail(e.message);
  }
  const version = manifest.version;
  if (typeof version !== 'string' || !version) {
    fail(`${path.join(HUB_DIR, 'manifest.webmanifest')} has no "version" field. Isolated Web Apps require one, e.g. "version": "1.0.0".`);
  }
  if (!/^\d+(\.\d+)*$/.test(version)) {
    fail(`manifest "version" must be dot-separated numbers like "1.2.3" (got "${version}").`);
  }

  const key = loadOrCreateKey();
  const webBundleId = new WebBundleId(key).serialize();
  const baseURL = `isolated-app://${webBundleId}/`;

  // Bundle format b2 (wbn's default) is what Chrome's IWA reader expects.
  // No primary URL: Chrome rejects IWA bundles that set one ("Primary URL must
  // not be present"); the start page comes from the manifest's start_url.
  const builder = new BundleBuilder('b2');
  const headersFor = (file) => ({ 'content-type': mimeType(file), ...lower(IWA_HEADERS) });
  for (const { urlPath, file } of files) {
    const body = fs.readFileSync(file);
    if (path.posix.basename(urlPath) === 'index.html') {
      // Same as the official bundler plugins: serve the page at the directory
      // URL and redirect …/index.html to it.
      const dirPath = urlPath.slice(0, -'index.html'.length);
      builder.addExchange(baseURL + urlPath.slice(1), 301, { location: './', ...lower(IWA_HEADERS) }, '');
      builder.addExchange(baseURL + dirPath.slice(1), 200, headersFor(file), body);
    } else {
      builder.addExchange(baseURL + urlPath.slice(1), 200, headersFor(file), body);
    }
  }
  const unsigned = builder.createBundle();

  const signed = await SignedWebBundle.fromWebBundle(unsigned, [new NodeCryptoSigningStrategy(key)]);
  if (signed.getWebBundleId() !== webBundleId) fail(`Web Bundle ID mismatch (${signed.getWebBundleId()} vs ${webBundleId}).`);
  const bad = signed.validateSignatures().filter((r) => r.status !== 'success' || !r.isValid);
  if (bad.length) fail(`Signature validation failed: ${JSON.stringify(bad)}`);
  const bytes = signed.getSignedWebBundleBytes();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const info = {
    version,
    size: bytes.byteLength,
    webBundleId,
    builtAt: new Date().toISOString(),
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  };
  writeAtomic(path.join(OUT_DIR, BUNDLE_NAME), bytes);
  writeAtomic(path.join(OUT_DIR, 'version.json'), JSON.stringify(info, null, 2) + '\n');
  // Update manifest (https://github.com/WICG/isolated-web-apps/blob/main/Updates.md);
  // `src` is resolved relative to this file's URL.
  writeAtomic(path.join(OUT_DIR, 'update.json'), JSON.stringify({ versions: [{ version, src: BUNDLE_NAME }] }, null, 2) + '\n');

  console.log(`Hub bundle built:
  files          ${files.length} (${files.map((f) => f.urlPath).join(' ')})
  version        ${version}
  Web Bundle ID  ${webBundleId}
  origin         ${baseURL}
  key            ${KEY_PATH}
  output         ${path.join(OUT_DIR, BUNDLE_NAME)} (${bytes.byteLength} bytes)`);
}

const lower = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));

function writeAtomic(file, data) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

main().catch((e) => fail(e.stack || String(e)));
