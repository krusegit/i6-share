// "Is there a newer hub?" – compares the running version with the published
// version.json on GitHub Pages. DOM-free (testable in Node) and never throws:
// the hub is LAN-only, so being offline is normal and simply means "no info".

import { APP_URL } from './lib/proto.js';

export const VERSION_URL = APP_URL + 'hub/version.json';

const VERSION_RE = /^v?\d+(\.\d+)*$/i;
export const isVersion = (v) => typeof v === 'string' && VERSION_RE.test(v.trim());

const parts = (v) => String(v ?? '').trim().replace(/^v/i, '').split('.').map((p) => {
  const n = Number.parseInt(p, 10);
  return Number.isFinite(n) ? n : 0;
});

/** Compares dot-separated numeric versions: <0 if a < b, 0 if equal, >0 if a > b. Missing parts count as 0. */
export function compareVersions(a, b) {
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

/**
 * Fetches version.json and compares it with `current`.
 * Resolves {available, latest, info} or null on any error, timeout or bad data.
 */
export async function checkForUpdate({ current, url = VERSION_URL, fetch = globalThis.fetch, timeoutMs = 10000 } = {}) {
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); });
  const check = (async () => {
    const signal = globalThis.AbortSignal?.timeout?.(timeoutMs);
    const res = await fetch(url, { cache: 'no-store', credentials: 'omit', signal });
    if (!res?.ok) return null;
    const info = await res.json();
    const latest = typeof info?.version === 'string' ? info.version.trim() : null;
    if (!isVersion(latest)) return null;
    const available = isVersion(current) && compareVersions(latest, current) > 0;
    return { available, latest, info };
  })().catch(() => null);
  try {
    // The race also covers fetch implementations that ignore the abort signal.
    return await Promise.race([check, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
