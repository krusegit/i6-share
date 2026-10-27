import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APP_URL, CHUNK_SIZE, MAX_BODY, PAIR_TOKEN_TTL_MS, PORT, PROTOCOL_VERSION, SYNC_WAIT_MS,
  backoffDelay, b64url, baseUrl, bytesToIp, cleanFileName, createBackoff,
  decodePairPayload, deviceKey, deviceKeyEffect, encodePairPayload, frame, ipToBytes,
  isJsonObject, isPrivateIp, open, openEffect, pairKey, pairKeyEffect, pairLink,
  pairPayloadFromText, randomBytes, randomBytesEffect, randomId, requestAad, responseAad,
  seal, sealEffect, sleep, sleepEffect, unb64url, unframe,
  type PairPayload,
} from '../public/lib/proto.js';

const payload: PairPayload = {
  hubId: '0123456789abcdef', token: Uint8Array.from({ length: 16 }, (_, index) => index),
  port: PORT, addrs: ['192.168.1.10', 'fd00::1', 'garbage'], name: 'Linux PC',
};
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('wire format', () => {
  it('keeps protocol constants and binary base64url encoding stable', () => {
    expect([PROTOCOL_VERSION, PORT, CHUNK_SIZE, MAX_BODY, SYNC_WAIT_MS, PAIR_TOKEN_TTL_MS])
      .toEqual([1, 47616, 4_194_304, 4_259_840, 25_000, 600_000]);
    expect(b64url(Uint8Array.of(251, 255))).toBe('-_8');
    expect(unb64url('-_8')).toEqual(Uint8Array.of(251, 255));
    expect(b64url(new ArrayBuffer(0))).toBe('');
    expect(unb64url('')).toEqual(new Uint8Array());
    expect(() => unb64url('!')).toThrow();
  });
  it('encodes network byte-order length, JSON, and binary views without unrelated bytes', () => {
    expect(frame({ a: 1 }, Uint8Array.of(8, 9).subarray(1))).toEqual(Uint8Array.of(0, 0, 0, 7, 123, 34, 97, 34, 58, 49, 125, 9));
    expect(unframe(frame({ a: ['x', true, null] }, Uint8Array.of(1, 2).buffer)))
      .toEqual({ json: { a: ['x', true, null] }, binary: Uint8Array.of(1, 2) });
    expect(unframe(frame(null))).toEqual({ json: {}, binary: new Uint8Array() });
    expect(unframe(frame(undefined, null)).json).toEqual({});
    expect(unframe(frame({})).binary).toHaveLength(0);
  });
  it('rejects truncated frames and non-object or malformed JSON', () => {
    expect(() => unframe(Uint8Array.of(0, 0, 0))).toThrow('bad frame');
    expect(() => unframe(Uint8Array.of(0, 0, 0, 2, 123))).toThrow('bad frame');
    expect(() => unframe(Uint8Array.of(0, 0, 0, 1, 33))).toThrow();
    for (const text of ['null', '[]', '1', '"a"']) {
      const json = new TextEncoder().encode(text);
      expect(() => unframe(Uint8Array.of(0, 0, 0, json.length, ...json))).toThrow('frame JSON must be an object');
    }
    expect(isJsonObject({})).toBe(true);
    expect(isJsonObject(undefined)).toBe(false);
  });
});

describe('cryptography effects', () => {
  it('matches fixed envelopes produced by the pre-TypeScript protocol', async () => {
    // Captured from the original protocol with a fixed 00..0b IV.
    const pairVector = 'AAECAwQFBgcICQoLgAgrG5Zx-VkuP2tUJaVX8tt_NGPOYwizA6igexufdhT_0W2VChcYBuBOYzY_W5jviudbagV97VvbqTGjkCC1QNcwkP_3_CX9JC9zc0UmWagfDd_-CMg';
    const deviceVector = 'AAECAwQFBgcICQoLJDNzwMfI45S70Pi_iz1kAHET7xlxG6AjwhMXwI5SW9ZV6XRiV_Em3BG7hONJFzqx8LAvxQOkL7Ji4rquPqxwXX3057ylqX2nQLk';
    const iv = Uint8Array.from({ length: 12 }, (_, index) => index);
    vi.spyOn(crypto, 'getRandomValues').mockReturnValue(iv);
    const pairingKey = await pairKey(payload.token, payload.hubId);
    const pairJson = { deviceId: 'fedcba9876543210', name: 'Test Phone', os: 'Android' };
    expect((await open(pairingKey, requestAad('pair', 'pair'), unb64url(pairVector))).json).toEqual(pairJson);
    expect(b64url((await seal(pairingKey, requestAad('pair', 'pair'), pairJson)).body)).toBe(pairVector);
    const transferKey = await deviceKey(Uint8Array.from({ length: 32 }, (_, index) => index), payload.hubId);
    const transferJson = { tid: '0123456789abcdef01234567', i: 0, offset: 4 };
    const aad = requestAad('put', payload.hubId);
    expect(await open(transferKey, aad, unb64url(deviceVector)))
      .toEqual({ json: transferJson, binary: Uint8Array.of(1, 2, 3), iv });
    expect(b64url((await seal(transferKey, aad, transferJson, Uint8Array.of(1, 2, 3))).body)).toBe(deviceVector);
  });
  it('generates bytes and hexadecimal IDs only on execution', async () => {
    const random = vi.spyOn(crypto, 'getRandomValues');
    const effect = randomBytesEffect(10);
    expect(random).not.toHaveBeenCalled();
    expect(await Effect.runPromise(effect)).toHaveLength(10);
    expect(randomBytes(16)).toHaveLength(16);
    expect(randomId()).toMatch(/^[\da-f]{16}$/);
    expect(randomId(3)).toMatch(/^[\da-f]{6}$/);
  });
  it('derives interoperable, context-separated HKDF keys and authenticates binary envelopes', async () => {
    const secret = new Uint8Array(32).fill(42);
    const key = await pairKey(secret, payload.hubId);
    const equivalent = await Effect.runPromise(pairKeyEffect(secret, payload.hubId));
    const aad = requestAad('pair', 'pair');
    expect(aad).toBe('i6 req pair pair');
    const sealed = await seal(key, aad, { hello: 'world' }, Uint8Array.of(2, 4, 8));
    const decrypted = await open(equivalent, aad, sealed.body);
    expect(decrypted).toEqual({ json: { hello: 'world' }, binary: Uint8Array.of(2, 4, 8), iv: sealed.iv });
    expect(responseAad('pair', sealed.iv)).toBe(`i6 res pair ${b64url(sealed.iv)}`);
    const device = await deviceKey(secret, 'device');
    const deviceEquivalent = await Effect.runPromise(deviceKeyEffect(secret, 'device'));
    const response = await Effect.runPromise(sealEffect(device, 'response', { ok: true }));
    expect((await Effect.runPromise(openEffect(deviceEquivalent, 'response', response.body))).json).toEqual({ ok: true });
    await expect(open(key, 'response', response.body)).rejects.toBeInstanceOf(Error);
    await expect(open(device, 'wrong', response.body)).rejects.toBeInstanceOf(Error);
    const corrupt = new Uint8Array(response.body);
    corrupt[20] = 0;
    corrupt[21] = 0;
    await expect(open(device, 'response', corrupt)).rejects.toBeInstanceOf(Error);
    await expect(open(key, aad, new Uint8Array(27))).rejects.toThrow('short envelope');
  });
  it('retains crypto failures at the Promise boundary and rejects decrypted malformed frames', async () => {
    const failure = new Error('crypto unavailable');
    vi.spyOn(crypto.subtle, 'importKey').mockRejectedValueOnce(failure);
    await expect(pairKey(payload.token, payload.hubId)).rejects.toBe(failure);
    const key = await pairKey(payload.token, payload.hubId);
    vi.spyOn(crypto.subtle, 'decrypt').mockResolvedValueOnce(new ArrayBuffer(0));
    await expect(open(key, 'aad', new Uint8Array(28))).rejects.toThrow('bad frame');
  });
});

describe('pairing links', () => {
  it('roundtrips the existing layout, filters invalid addresses and caps QR metadata', () => {
    const encoded = encodePairPayload(payload);
    expect(encoded).toBe('AQEjRWeJq83vAAECAwQFBgcICQoLDA0OD7oAAgTAqAEKBv0AAAAAAAAAAAAAAAAAAAFMaW51eCBQQw');
    const decoded = decodePairPayload(` ${encoded} `);
    expect(decoded).toEqual({ ...payload, addrs: ['192.168.1.10', 'fd00::1'] });
    expect(pairLink(encoded)).toBe(`${APP_URL}#pair=${encoded}`);
    expect(pairPayloadFromText(pairLink(encoded))).toEqual(decoded);
    expect(pairPayloadFromText(encoded)).toEqual(decoded);
    expect(pairPayloadFromText(`#pair=${encoded}`)).toEqual(decoded);
    expect(decodePairPayload(encodePairPayload({ ...payload, addrs: Array.from({ length: 12 }, () => '10.0.0.1'), name: 'a'.repeat(50) })))
      .toMatchObject({ addrs: Array.from({ length: 8 }, () => '10.0.0.1'), name: 'a'.repeat(40) });
    expect(decodePairPayload(encodePairPayload({ ...payload, addrs: [], name: '' }))).toEqual({ ...payload, addrs: [], name: '' });
  });
  it('validates fields before encoding', () => {
    expect(() => encodePairPayload({ ...payload, token: new Uint8Array(15) })).toThrow('invalid pairing token');
    for (const port of [0, 65536, 1.5]) expect(() => encodePairPayload({ ...payload, port })).toThrow('invalid port');
    expect(() => encodePairPayload({ ...payload, hubId: 'bad' })).toThrow('invalid hub id');
  });
  it('rejects unsupported versions, missing address bytes, and unsupported families', () => {
    expect(() => decodePairPayload('')).toThrow('unsupported pairing code');
    expect(() => decodePairPayload(b64url(Uint8Array.of(2)))).toThrow('unsupported pairing code');
    expect(() => decodePairPayload(b64url(Uint8Array.of(1)))).toThrow('truncated pairing code');
    const data = unb64url(encodePairPayload(payload));
    expect(() => decodePairPayload(b64url(data.subarray(0, 28)))).toThrow('truncated pairing code');
    expect(() => decodePairPayload(b64url(data.subarray(0, 30)))).toThrow('truncated pairing code');
    const invalid = new Uint8Array(data);
    invalid[28] = 5;
    expect(() => decodePairPayload(b64url(invalid))).toThrow('unsupported address family');
  });
});

describe('LAN addresses', () => {
  it.each([
    ['192.168.0.1', [192, 168, 0, 1]], ['[::1]', [...new Uint8Array(15), 1]],
    ['::ffff:192.168.1.2', [192, 168, 1, 2]], ['1:2:3:4:5:6:7:8', [0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6, 0, 7, 0, 8]],
    ['fe80::%eth0', [254, 128, ...new Uint8Array(14)]], ['::', [...new Uint8Array(16)]],
  ])('parses %s', (ip, expected) => { expect(ipToBytes(ip)).toEqual(Uint8Array.from(expected)); });
  it.each(['invalid', '256.1.1.1', '1::2::3', '1:2:3:4:5:6:7:8::', '1:2', 'zz::1', '12345::1', '1:2:3:4:5:6:7:8:9'])('rejects %s', (ip) => {
    expect(ipToBytes(ip)).toBeNull();
  });
  it('renders and validates byte sequences', () => {
    expect(bytesToIp(Uint8Array.of(10, 0, 0, 1))).toBe('10.0.0.1');
    expect(bytesToIp(new Uint8Array(16))).toBe('::');
    expect(() => bytesToIp(new Uint8Array(2))).toThrow('invalid IP byte length');
    expect(baseUrl('192.168.0.1')).toBe('http://192.168.0.1:47616');
    expect(baseUrl('::1', 123)).toBe('http://[::1]:123');
  });
  it.each([
    ['garbage', false], ['10.0.0.1', true], ['127.0.0.1', true], ['172.16.0.1', true], ['172.31.0.1', true],
    ['172.15.0.1', false], ['172.32.0.1', false], ['192.168.0.1', true], ['192.169.0.1', false],
    ['169.254.0.1', true], ['169.253.0.1', false], ['8.8.8.8', false], ['fc00::1', true], ['fd00::1', true],
    ['fe80::1', true], ['fe00::1', false], ['::1', true], ['::2', false], ['::', false], ['2001:db8::1', false],
  ])('classifies %s as private=%s', (ip, expected) => { expect(isPrivateIp(ip)).toBe(expected); });
});

describe('retry and file names', () => {
  it('calculates capped equal jitter without state and resets Effect-backed retry state', () => {
    expect(backoffDelay(0, 500, 1000, 0)).toBe(250);
    expect(backoffDelay(5, 500, 1000, 1)).toBe(1000);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const defaults = createBackoff();
    expect(defaults.next()).toBe(375);
    expect(defaults.next()).toBe(750);
    defaults.reset();
    expect(defaults.next()).toBe(375);
    const custom = createBackoff(100, 100, () => 0);
    expect(custom.next()).toBe(50);
  });
  it('sleeps through Effect and supports externally interrupted Promise calls', async () => {
    await Effect.runPromise(sleepEffect(1));
    await sleep(1);
    const active = new AbortController();
    const pending = sleep(60_000, active.signal);
    active.abort();
    await expect(pending).rejects.toBeInstanceOf(Error);
    await expect(sleep(1, active.signal)).rejects.toBeInstanceOf(Error);
    await sleep(1, new AbortController().signal);
  });
  it('sanitizes names without paths, controls, leading dots or unbounded lengths', () => {
    expect(cleanFileName('../a\\b\u0000\u007f.txt')).toBe('_a_b__.txt');
    expect(cleanFileName(' ... ')).toBe('...');
    expect(cleanFileName('...')).toBe('file');
    expect(cleanFileName(null)).toBe('file');
    expect(cleanFileName(undefined)).toBe('file');
    expect(cleanFileName('')).toBe('file');
    expect(cleanFileName('a'.repeat(210))).toHaveLength(200);
  });
});
