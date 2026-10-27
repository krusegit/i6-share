import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { drawQr, qrMatrix, type QrCanvas } from '../hub/qr.js';

// Frozen outputs from the original encoder protect the wire-facing QR behavior
// through the TypeScript rewrite, including UTF-8 and versions with long blocks.
const fixtures = [
  { text: '', ecc: 'M', version: 1, hash: 'e640ed5ccfe75ddfd08d30612e5fab2d1303feb943ba7ed62a5d04a4f82ec00c' },
  { text: 'hello', ecc: 'M', version: 1, hash: '19cb2fb2c34525521105cbbf11589ad454b7aa7e34ca5c0cd725ccae41f364cc' },
  { text: 'https://krusegit.github.io/i6-share/#pair=abc', ecc: 'L', version: 3, hash: 'a1643f1529e71bdadd3b1fd897726b84ad07de4e1cf6f80a837eba39803f1674' },
  { text: 'Íslenska 日本語 😀', ecc: 'Q', version: 3, hash: 'e7980a5605b11b8cf09210ac48757b0fdee27a937160424e1796eb6f625cb120' },
  { text: 'x'.repeat(200), ecc: 'H', version: 15, hash: 'c5860b3dfcde14af86bbd2fb5bf2fd49623a796b2e81615ec9e55d92ac1e0612' },
  { text: 'z'.repeat(1000), ecc: 'M', version: 26, hash: '20a434d49fc5e893eba2e865a7af95c450522ee4fceb2afc84b092e435dc2253' },
  { text: 'A'.repeat(2953), ecc: 'L', version: 40, hash: '7064133a6f13f7c9f13a117fbdb18f58b8251af136f6adf6b718a9906dfdcad6' },
] as const;

describe('QR byte encoding', () => {
  it.each(fixtures)('preserves the original version $version ECC $ecc matrix', ({ text, ecc, version, hash }) => {
    const result = qrMatrix(text, { ecc });
    expect(result.version).toBe(version);
    expect(result.size).toBe(17 + 4 * version);
    expect(result.modules).toHaveLength(result.size ** 2);
    expect(result.modules.every((value) => value === 0 || value === 1)).toBe(true);
    expect(createHash('sha256').update(result.modules).digest('hex')).toBe(hash);
    // Fixed function patterns remain independent of the selected data mask.
    expect(result.modules[0]).toBe(1);
    expect(result.modules[result.size * (result.size - 8) + 8]).toBe(1);
  });

  it('uses medium correction by default and returns independent matrices', () => {
    const first = qrMatrix('hello');
    expect(first).toEqual(qrMatrix('hello', {}));
    expect(first).toEqual(qrMatrix('hello', { ecc: 'M' }));
    first.modules.fill(0);
    expect(qrMatrix('hello').modules.some((value) => value === 1)).toBe(true);
  });

  it('rejects invalid ECC levels and excessive byte lengths', () => {
    expect(() => qrMatrix('hello', { ecc: 'invalid' })).toThrow('invalid ECC level');
    expect(() => qrMatrix('A'.repeat(2954), { ecc: 'L' })).toThrow('text too long (2954 bytes; max 2953 bytes at ECC level L)');
    expect(() => qrMatrix('😀'.repeat(800))).toThrow('text too long (3200 bytes');
  });

  it('raises the version at the byte-mode capacity boundary', () => {
    expect(qrMatrix('a'.repeat(14)).version).toBe(1);
    expect(qrMatrix('a'.repeat(15)).version).toBe(2);
    expect(qrMatrix('a'.repeat(180)).version).toBeGreaterThanOrEqual(9);
  });
});

describe('canvas rendering', () => {
  const makeCanvas = () => {
    const context = { fillStyle: '', fillRect: vi.fn<(x: number, y: number, width: number, height: number) => void>() };
    const getContext = vi.fn<() => typeof context>().mockReturnValue(context);
    const canvas: QrCanvas = { width: 0, height: 0, getContext };
    return { context, canvas, getContext };
  };

  it('paints a four-module quiet zone and each dark module with default colors', () => {
    const { context, canvas, getContext } = makeCanvas();
    const result = drawQr(canvas, 'hello');
    expect(result).toEqual(qrMatrix('hello'));
    expect(canvas.width).toBe(232);
    expect(canvas.height).toBe(232);
    expect(getContext).toHaveBeenCalledWith('2d');
    expect(context.fillRect).toHaveBeenNthCalledWith(1, 0, 0, 232, 232);
    expect(context.fillRect).toHaveBeenNthCalledWith(2, 32, 32, 8, 8);
    expect(context.fillRect).toHaveBeenCalledTimes(1 + result.modules.reduce((total, value) => total + value, 0));
    expect(context.fillStyle).toBe('#000');
  });

  it('supports explicit dimensions, colors, and correction strength', () => {
    const { context, canvas } = makeCanvas();
    const result = drawQr(canvas, 'hello', { scale: 3, margin: 2, dark: 'navy', light: 'ivory', ecc: 'H' });
    expect(result).toEqual(qrMatrix('hello', { ecc: 'H' }));
    expect(canvas.width).toBe((result.size + 4) * 3);
    expect(context.fillStyle).toBe('navy');
    expect(context.fillRect).toHaveBeenNthCalledWith(2, 6, 6, 3, 3);
  });

  it('reports missing canvas rendering capability', () => {
    const canvas: QrCanvas = { width: 0, height: 0, getContext: () => null };
    expect(() => drawQr(canvas, 'hello')).toThrow('2D canvas context unavailable');
  });
});
