import { Effect, Schema } from 'effect';
import {
  AdminStatusResponseSchema, PairCodeResponseSchema, OperationResponseSchema, QueueFilesResponseSchema,
  ErrorResponseSchema,
} from '../public/generated/contracts.js';
import type {
  AdminStatusResponse, PairCodeResponse, AdminSettingsRequest, QueueFilesRequest,
} from '../public/generated/contracts.js';
import { runEffect } from '../public/lib/runtime.js';

export interface AdminClient {
  readonly status: () => Promise<AdminStatusResponse>;
  readonly pair: () => Promise<PairCodeResponse>;
  readonly settings: (settings: AdminSettingsRequest) => Promise<unknown>;
  readonly send: (request: QueueFilesRequest) => Promise<unknown>;
  readonly forget: (deviceId: string) => Promise<unknown>;
  readonly cancel: (tid: string) => Promise<unknown>;
  readonly dispose: () => void;
}

/** This capability can only call relative, same-origin administration routes. */
export const createAdminClient = (token: string, fetch: typeof globalThis.fetch = globalThis.fetch): AdminClient => {
  const lifetime = new AbortController();
  const request = <A>(path: string, decode: (value: unknown) => A, body?: unknown): Promise<A> => runEffect(Effect.tryPromise({
    try: async () => {
      const response = await fetch(`/admin/${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(15_000)]),
        cache: 'no-store', credentials: 'omit', redirect: 'error',
      });
      const value: unknown = await response.json();
      if (!response.ok) {
        if (response.status === 401) throw new Error('This dashboard session expired. Open the local link printed by i6-share Hub.');
        const failure = Schema.decodeUnknownOption(ErrorResponseSchema)(value);
        throw new Error(failure._tag === 'Some' ? failure.value.error : `Hub request failed (${String(response.status)}).`);
      }
      return decode(value);
    }, catch: (error) => error,
  }));
  return {
    status: () => request('state', Schema.decodeUnknownSync(AdminStatusResponseSchema)),
    pair: () => request('pair', Schema.decodeUnknownSync(PairCodeResponseSchema), {}),
    settings: (settings) => request('settings', Schema.decodeUnknownSync(OperationResponseSchema), settings),
    send: (files) => request('send', Schema.decodeUnknownSync(QueueFilesResponseSchema), files),
    forget: (deviceId) => request(`devices/${encodeURIComponent(deviceId)}/forget`, Schema.decodeUnknownSync(OperationResponseSchema), {}),
    cancel: (tid) => request(`outbox/${encodeURIComponent(tid)}/cancel`, Schema.decodeUnknownSync(OperationResponseSchema), {}),
    dispose: () => { lifetime.abort(); },
  };
};

export interface TokenEnvironment {
  readonly url: string;
  readonly storage: Pick<Storage, 'getItem' | 'setItem'>;
  readonly replace: (url: string) => void;
}
export const takeAdminToken = ({ url, storage, replace }: TokenEnvironment): string | null => {
  const parsed = new URL(url);
  const supplied = new URLSearchParams(parsed.hash.slice(1)).get('admin');
  if (supplied !== null) {
    parsed.hash = '';
    replace(parsed.href);
    if (!/^[A-Za-z0-9_-]{16,256}$/u.test(supplied)) return null;
    try { storage.setItem('i6-admin-token', supplied); } catch { /* This tab can still use its in-memory capability. */ }
    return supplied;
  }
  try { return storage.getItem('i6-admin-token'); } catch { return null; }
};
