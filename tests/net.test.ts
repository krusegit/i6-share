import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAddressBook, detectAddrs, isUsableAddr, MAX_ADDRS, normalizeIp } from '../hub/net.js';
import type { UdpFactory, UdpOptions } from '../hub/net.js';

const socketFactory = (address: string): UdpFactory => () => ({ opened: Promise.resolve({ localAddress: address }), close: () => Promise.resolve() });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('local address detection', () => {
  it('normalizes address literals and rejects unreachable address families', () => {
    expect(normalizeIp(null)).toBeNull();
    expect(normalizeIp('garbage')).toBeNull();
    expect(normalizeIp(' 192.168.1.5 ')).toBe('192.168.1.5');
    expect(normalizeIp('[fd00::1]')).toBe('fd00::1');
    for (const ip of ['10.1.2.3', '172.16.1.2', '192.168.1.1', 'fd00::1']) expect(isUsableAddr(ip)).toBe(true);
    for (const ip of ['bad', '8.8.8.8', '127.0.0.1', '169.254.1.1', '::1', 'fe80::1', '2001:db8::1']) expect(isUsableAddr(ip)).toBe(false);
  });
  it('returns no detected addresses when direct sockets are unavailable', async () => {
    vi.stubGlobal('UDPSocket', undefined);
    expect(await detectAddrs()).toEqual([]);
  });
  it('uses browser socket constructors and closes both probes', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const Constructor = vi.fn(function (options: UdpOptions) {
      return { opened: Promise.resolve({ localAddress: options.remoteAddress.includes(':') ? 'fd00::1' : '192.168.1.2' }), close };
    });
    vi.stubGlobal('UDPSocket', Constructor);
    expect(await detectAddrs()).toEqual(['192.168.1.2', 'fd00::1']);
    expect(Constructor).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledTimes(2);
  });
  it('deduplicates results and filters absent or unusable addresses', async () => {
    expect(await detectAddrs({ UDPSocket: socketFactory('10.0.0.1') })).toEqual(['10.0.0.1']);
    expect(await detectAddrs({ UDPSocket: socketFactory('127.0.0.1') })).toEqual([]);
    expect(await detectAddrs({ UDPSocket: () => ({ opened: Promise.resolve({}), close: () => Promise.resolve() }) })).toEqual([]);
  });
  it('handles construction, connection, and cleanup failures', async () => {
    expect(await detectAddrs({ UDPSocket: () => { throw new Error('unsupported'); } })).toEqual([]);
    const close = vi.fn().mockRejectedValue(new Error('already closed'));
    expect(await detectAddrs({ UDPSocket: () => ({ opened: Promise.reject(new Error('network down')), close }) })).toEqual([]);
    expect(close).toHaveBeenCalledTimes(2);
  });
  it('closes timed-out probes', async () => {
    vi.useFakeTimers();
    const close = vi.fn().mockResolvedValue(undefined);
    const opened = new Promise<{ readonly localAddress?: string }>(() => undefined);
    const pending = detectAddrs({ UDPSocket: () => ({ opened, close }), timeoutMs: 20 });
    await vi.advanceTimersByTimeAsync(21);
    expect(await pending).toEqual([]);
    expect(close).toHaveBeenCalledTimes(2);
  });
});
describe('advertised address book', () => {
  it('restores manual addresses, advertises IPv4 first, and suppresses unchanged events', async () => {
    const get = vi.fn().mockResolvedValue(['fd00::1', '192.168.1.1', 'bad', null]);
    const put = vi.fn().mockResolvedValue(undefined);
    const book = createAddressBook({ kv: { get, put }, UDPSocket: socketFactory('10.0.0.2') });
    const changed = vi.fn();
    book.addEventListener('change', changed);
    expect(await book.init()).toBe(book);
    expect(book.manual).toEqual(['fd00::1', '192.168.1.1']);
    expect(book.detected).toEqual(['10.0.0.2']);
    expect(book.addrs).toEqual(['192.168.1.1', '10.0.0.2', 'fd00::1']);
    expect(book.lastDetect).toBeGreaterThan(0);
    await book.refresh();
    expect(changed).toHaveBeenCalledOnce();
    book.removeEventListener('change', changed);
    book.dispose();
  });
  it('parses settings, returns invalid entries, and caps advertised addresses', async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const book = createAddressBook({ kv: { get: () => Promise.resolve(undefined), put } });
    expect(await book.setManual(' 10.0.0.1, bad;fd00::1 10.0.0.1 ')).toEqual(['bad']);
    expect(book.manual).toEqual(['10.0.0.1', 'fd00::1']);
    expect(put).toHaveBeenCalledWith('manualAddrs', ['10.0.0.1', 'fd00::1']);
    await book.setManual(Array.from({ length: 12 }, (_, index) => `10.0.0.${String(index + 1)}`));
    expect(book.addrs).toHaveLength(MAX_ADDRS);
    put.mockRejectedValue(new Error('storage full'));
    expect(await book.setManual(['invalid', '127.0.0.1'])).toEqual(['invalid']);
    expect(book.addrs).toEqual(['127.0.0.1']);
  });
  it('learns only usable connection addresses, refreshes timestamps, and expires them', () => {
    vi.useFakeTimers();
    const book = createAddressBook({ now: Date.now });
    const changed = vi.fn();
    book.addEventListener('change', changed);
    book.observe('invalid');
    book.observe('127.0.0.1');
    expect(book.addrs).toEqual([]);
    book.observe('192.168.1.4');
    book.observe('192.168.1.4');
    expect(changed).toHaveBeenCalledOnce();
    expect(book.addrs).toEqual(['192.168.1.4']);
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(book.addrs).toEqual([]);
  });
  it('refreshes on online events and the interval, and cleans up listeners', async () => {
    vi.useFakeTimers();
    const online = new EventTarget();
    vi.stubGlobal('addEventListener', online.addEventListener.bind(online));
    vi.stubGlobal('removeEventListener', online.removeEventListener.bind(online));
    const factory = vi.fn<UdpFactory>(socketFactory('10.0.0.1'));
    const book = createAddressBook({ UDPSocket: factory, intervalMs: 100 });
    await book.init();
    online.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(101);
    expect(factory).toHaveBeenCalledTimes(6);
    book.dispose();
    online.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(200);
    expect(factory).toHaveBeenCalledTimes(6);
  });
  it('handles missing storage, unreadable settings, and browser numeric timer handles', async () => {
    vi.stubGlobal('setInterval', vi.fn(() => 1));
    vi.stubGlobal('clearInterval', vi.fn());
    const book = createAddressBook();
    await book.init();
    expect(await book.setManual('')).toEqual([]);
    book.dispose();
    const broken = createAddressBook({ kv: { get: () => Promise.reject(new Error('unavailable')), put: () => Promise.resolve() } });
    await broken.init();
    expect(broken.manual).toEqual([]);
    broken.dispose();
  });
});
