import { Effect, Schema } from 'effect';
import { APP_URL } from '../public/lib/proto.js';
import { runEffect } from '../public/lib/runtime.js';

export const VERSION_URL = `${APP_URL}hub/version.json`;
const VERSION_RE = /^v?\d+(\.\d+)*$/i;
export const isVersion = (value: unknown): value is string => typeof value === 'string' && VERSION_RE.test(value.trim());
const parts = (version: string): readonly number[] => version.trim().replace(/^v/i, '').split('.').map((part) => {
  const number = Number.parseInt(part, 10);
  return Number.isFinite(number) ? number : 0;
});
export const compareVersions = (left: string, right: string): number => {
  const a = parts(left);
  const b = parts(right);
  const difference = Array.from({ length: Math.max(a.length, b.length) }, (_, index) => (a[index] ?? 0) - (b[index] ?? 0))
    .find((delta) => delta !== 0);
  return difference === undefined ? 0 : Math.sign(difference);
};
const VersionInfo = Schema.Struct({ version: Schema.String });
export interface UpdateResult {
  readonly available: boolean;
  readonly latest: string;
  readonly info: Readonly<Record<string, unknown>> & { readonly version: string };
}
export interface UpdateOptions {
  readonly current?: string;
  readonly url?: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly timeoutMs?: number;
}
export const checkForUpdate = (options: UpdateOptions = {}): Promise<UpdateResult | null> => runEffect(
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise((signal) => (options.fetch ?? globalThis.fetch)(options.url ?? VERSION_URL, {
      cache: 'no-store', credentials: 'omit', signal,
    }));
    if (!response.ok) return null;
    const raw: unknown = yield* Effect.tryPromise(() => response.json());
    const record = yield* Schema.decodeUnknownEffect(Schema.Record(Schema.String, Schema.Unknown))(raw);
    const versionInfo = yield* Schema.decodeUnknownEffect(VersionInfo)(raw);
    const info = { ...record, ...versionInfo };
    const latest = info.version.trim();
    if (!isVersion(latest)) return null;
    return { available: isVersion(options.current) && compareVersions(latest, options.current) > 0, latest, info };
  }).pipe(
    Effect.timeout(options.timeoutMs ?? 10_000),
    Effect.catch(() => Effect.succeed(null)),
  ),
);
