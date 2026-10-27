import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAdminClient, takeAdminToken } from '../hub/admin.js';
import type { AdminStatusResponse } from '../public/generated/contracts.js';

const status: AdminStatusResponse = { hubId: 'hub', name: 'PC', receiveDirectory: '/downloads', port: 47616, addrs: [], devices: [], transfers: [], outbox: [], history: [] };
afterEach(() => { vi.unstubAllGlobals(); });

it('validates every generated admin response and uses authenticated same-origin requests', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>();
  fetch.mockResolvedValueOnce(Response.json(status));
  fetch.mockResolvedValueOnce(Response.json({ payload: 'code', link: 'https://phone/#pair=code', expiresAt: 100 }));
  fetch.mockResolvedValueOnce(Response.json({ ok: true }));
  fetch.mockResolvedValueOnce(Response.json({ tid: 'transfer' }));
  fetch.mockResolvedValueOnce(Response.json({ ok: true }));
  fetch.mockResolvedValueOnce(Response.json({ ok: false }));
  const client = createAdminClient('secret', fetch);
  expect(await client.status()).toEqual(status);
  expect(await client.pair()).toEqual({ payload: 'code', link: 'https://phone/#pair=code', expiresAt: 100 });
  expect(await client.settings({ name: 'New name' })).toEqual({ ok: true });
  expect(await client.send({ deviceId: 'phone', paths: ['/file'] })).toEqual({ tid: 'transfer' });
  expect(await client.forget('phone/one')).toEqual({ ok: true });
  expect(await client.cancel('transfer/one')).toEqual({ ok: false });
  expect(fetch.mock.calls.map(([path]) => path)).toEqual(['/admin/state', '/admin/pair', '/admin/settings', '/admin/send', '/admin/devices/phone%2Fone/forget', '/admin/outbox/transfer%2Fone/cancel']);
  expect(fetch.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', headers: { Authorization: 'Bearer secret', 'Content-Type': 'application/json' }, redirect: 'error', credentials: 'omit', cache: 'no-store' });
  expect(fetch.mock.calls[0]?.[1]).not.toHaveProperty('body');
  expect(fetch.mock.calls[2]?.[1]?.body).toBe('{"name":"New name"}');
  client.dispose();
  expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
});

it('reports expired sessions, server failures, malformed responses and network errors', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>();
  const client = createAdminClient('secret', fetch);
  fetch.mockResolvedValueOnce(Response.json({ error: 'unauthorized' }, { status: 401 }));
  await expect(client.status()).rejects.toThrow('session expired');
  fetch.mockResolvedValueOnce(Response.json({ error: 'invalid-path' }, { status: 400 }));
  await expect(client.status()).rejects.toThrow('invalid-path');
  fetch.mockResolvedValueOnce(Response.json({ message: 'no code' }, { status: 500 }));
  await expect(client.status()).rejects.toThrow('Hub request failed (500)');
  fetch.mockResolvedValueOnce(new Response('not json'));
  await expect(client.status()).rejects.toBeInstanceOf(Error);
  fetch.mockResolvedValueOnce(Response.json({ name: 'missing fields' }));
  await expect(client.status()).rejects.toBeInstanceOf(Error);
  fetch.mockRejectedValueOnce(new Error('offline'));
  await expect(client.status()).rejects.toThrow('offline');
  client.dispose();
});

it('uses the platform fetch capability by default', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(status));
  vi.stubGlobal('fetch', fetch);
  const client = createAdminClient('token');
  await client.status();
  expect(fetch).toHaveBeenCalledOnce();
  client.dispose();
});

describe('fragment capability handoff', () => {
  const token = 'a'.repeat(43);
  it('removes the fragment before storing and returns a tab-local token', () => {
    const events: string[] = [];
    const storage = { getItem: vi.fn<(key: string) => string | null>(), setItem: (key: string, value: string): void => { events.push(`${key}:${value}`); } };
    expect(takeAdminToken({ url: `http://localhost:47616/?view=hub#admin=${token}`, storage, replace: (url) => { events.push(url); } })).toBe(token);
    expect(events).toEqual(['http://localhost:47616/?view=hub', `i6-admin-token:${token}`]);
    expect(storage.getItem).not.toHaveBeenCalled();
  });
  it('rejects malformed tokens and strips them from browser history', () => {
    const storage = { getItem: () => token, setItem: vi.fn<(key: string, value: string) => void>() };
    const replace = vi.fn<(url: string) => void>();
    expect(takeAdminToken({ url: 'http://localhost/#admin=bad', storage, replace })).toBeNull();
    expect(replace).toHaveBeenCalledWith('http://localhost/');
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it('uses session storage and remains usable when persistence is unavailable', () => {
    const replace = vi.fn<(url: string) => void>();
    const storage = { getItem: () => token, setItem: (): never => { throw new Error('blocked'); } };
    expect(takeAdminToken({ url: 'http://localhost/', storage, replace })).toBe(token);
    expect(replace).not.toHaveBeenCalled();
    expect(takeAdminToken({ url: `http://localhost/#admin=${token}`, storage, replace })).toBe(token);
    expect(takeAdminToken({ url: 'http://localhost/', storage: { ...storage, getItem: () => null }, replace })).toBeNull();
    expect(takeAdminToken({ url: 'http://localhost/', storage: { ...storage, getItem: (): never => { throw new Error('blocked'); } }, replace })).toBeNull();
  });
});
