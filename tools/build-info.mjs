// Build metadata (version, commit, commit time, build time) as a browser ES module.
//
//   node tools/build-info.mjs <version>   → prints the module (used by the Pages workflow)
//   import { buildInfo, buildInfoModule } from './build-info.mjs'   (hub build + dev servers)
//
// The browser side imports it as `./build-info.js` and renders the corner badge.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function git(...args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

/** Version + HEAD commit (marked -dirty if app sources differ from it) + timestamps. */
export function buildInfo(version = null) {
  const commit = git('rev-parse', '--short=7', 'HEAD');
  const dirty = commit && git('status', '--porcelain', '--', 'hub', 'public', ':!public/hub') ? '-dirty' : '';
  return {
    version,
    commit: commit ? commit + dirty : 'dev',
    committedAt: git('log', '-1', '--format=%cI') || null,
    builtAt: new Date().toISOString(),
  };
}

export const buildInfoModule = (info) =>
  `// Generated at build time by tools/build-info.mjs – do not edit.\nexport const BUILD = ${JSON.stringify(info, null, 2)};\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(buildInfoModule(buildInfo(process.argv[2] || null)));
}
