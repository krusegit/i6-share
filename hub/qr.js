// qr.js — dependency-free QR code encoder (byte mode, versions 1–40, ECC L/M/Q/H).
// Safe for strict CSP / Trusted Types: no DOM string sinks, no eval, no network.
//
//   qrMatrix(text, { ecc }) → { size, modules: Uint8Array(size*size, row-major, 1 = dark), version }
//   drawQr(canvas, text, { scale, margin, dark, light, ecc }) → same matrix, painted on a <canvas>

// ---------------------------------------------------------------------------
// Tables (ISO/IEC 18004, indexed by version; index 0 unused)
// ---------------------------------------------------------------------------

const ECC_ORDER = { L: 0, M: 1, Q: 2, H: 3 };
const ECC_FORMAT_BITS = [1, 0, 3, 2]; // L, M, Q, H as encoded in format info

// Error-correction codewords per block.
const ECC_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // L
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28], // M
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // Q
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // H
];

// Number of error-correction blocks.
const NUM_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25], // L
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49], // M
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68], // Q
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81], // H
];

// Total codewords (data + ECC) available in a version, after function patterns.
function rawCodewords(ver) {
  let bits = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2;
    bits -= (25 * n - 10) * n - 55;
    if (ver >= 7) bits -= 36;
  }
  return bits >> 3;
}

function dataCodewords(ver, e) {
  return rawCodewords(ver) - ECC_PER_BLOCK[e][ver] * NUM_BLOCKS[e][ver];
}

// Centre coordinates of alignment patterns (same list for rows and columns).
function alignmentPositions(ver) {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const step = Math.floor((ver * 8 + n * 3 + 5) / (n * 4 - 4)) * 2;
  const out = [6];
  for (let pos = ver * 4 + 17 - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}

// ---------------------------------------------------------------------------
// Reed–Solomon over GF(256), primitive polynomial 0x11d
// ---------------------------------------------------------------------------

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];

const gfMul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

// Generator polynomial (x - α^0)(x - α^1)…(x - α^(n-1)), leading 1 omitted.
function rsGenerator(n) {
  const g = new Uint8Array(n);
  g[n - 1] = 1;
  for (let i = 0, root = 1; i < n; i++) {
    for (let j = 0; j < n; j++) {
      g[j] = gfMul(g[j], root);
      if (j + 1 < n) g[j] ^= g[j + 1];
    }
    root = gfMul(root, 2);
  }
  return g;
}

// Remainder of data(x)·x^n divided by the generator = the ECC codewords.
function rsRemainder(data, gen) {
  const n = gen.length;
  const rem = new Uint8Array(n);
  for (const b of data) {
    const f = b ^ rem[0];
    rem.copyWithin(0, 1);
    rem[n - 1] = 0;
    for (let i = 0; i < n; i++) rem[i] ^= gfMul(gen[i], f);
  }
  return rem;
}

// ---------------------------------------------------------------------------
// Data encoding: byte-mode segment → padded data codewords
// ---------------------------------------------------------------------------

function encodeData(bytes, ver, e) {
  const capacity = dataCodewords(ver, e);
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4); // byte mode indicator
  put(bytes.length, ver < 10 ? 8 : 16); // character count
  for (const b of bytes) put(b, 8);
  put(0, Math.min(4, capacity * 8 - bits.length)); // terminator
  put(0, (8 - (bits.length % 8)) % 8); // pad to byte boundary
  const out = new Uint8Array(capacity);
  let i = 0;
  for (; i < bits.length / 8; i++) {
    let v = 0;
    for (let k = 0; k < 8; k++) v = (v << 1) | bits[i * 8 + k];
    out[i] = v;
  }
  for (let pad = 0xec; i < capacity; i++, pad ^= 0xec ^ 0x11) out[i] = pad; // 0xEC, 0x11, ...
  return out;
}

// Split into blocks, append ECC to each, then interleave column-wise.
function addEccAndInterleave(data, ver, e) {
  const numBlocks = NUM_BLOCKS[e][ver];
  const eccLen = ECC_PER_BLOCK[e][ver];
  const raw = rawCodewords(ver);
  const numShort = numBlocks - (raw % numBlocks);
  const shortLen = Math.floor(raw / numBlocks) - eccLen; // data length of a short block
  const gen = rsGenerator(eccLen);
  const dataBlocks = [];
  const eccBlocks = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const len = shortLen + (i < numShort ? 0 : 1);
    const block = data.subarray(k, k + len);
    k += len;
    dataBlocks.push(block);
    eccBlocks.push(rsRemainder(block, gen));
  }
  const out = [];
  for (let i = 0; i <= shortLen; i++) {
    for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
  }
  for (let i = 0; i < eccLen; i++) for (const b of eccBlocks) out.push(b[i]);
  return out;
}

// ---------------------------------------------------------------------------
// Matrix construction
// ---------------------------------------------------------------------------

function buildBase(ver) {
  const size = ver * 4 + 17;
  const mod = new Uint8Array(size * size);
  const fn = new Uint8Array(size * size); // 1 = function module (not data)
  const set = (x, y, dark) => { mod[y * size + x] = dark ? 1 : 0; fn[y * size + x] = 1; };

  // Timing patterns (row 6 and column 6).
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }

  // Finder patterns with separators, at three corners.
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, d !== 2 && d !== 4);
      }
    }
  }

  // Alignment patterns (skip the three that would overlap finders).
  const pos = alignmentPositions(ver);
  const n = pos.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  // Reserve format-info areas (filled per mask later) and the dark module.
  drawFormat(mod, fn, size, 0, 0);

  // Version info (18 bits, BCH(18,6) with generator 0x1f25), versions 7+.
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = (bits >>> i) & 1;
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      set(a, b, bit);
      set(b, a, bit);
    }
  }
  return { size, mod, fn };
}

// Format info: 2 ECC bits + 3 mask bits, BCH(15,5) with generator 0x537, XOR 0x5412.
function drawFormat(mod, fn, size, e, mask) {
  const data = (ECC_FORMAT_BITS[e] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const set = (x, y, i) => { mod[y * size + x] = (bits >>> i) & 1; fn[y * size + x] = 1; };
  // Copy 1: around the top-left finder.
  for (let i = 0; i <= 5; i++) set(8, i, i);
  set(8, 7, 6);
  set(8, 8, 7);
  set(7, 8, 8);
  for (let i = 9; i < 15; i++) set(14 - i, 8, i);
  // Copy 2: split between top-right and bottom-left finders.
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, i);
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, i);
  mod[(size - 8) * size + 8] = 1; // always-dark module
  fn[(size - 8) * size + 8] = 1;
}

// Place codeword bits in the two-column zigzag, skipping function modules.
function placeData(mod, fn, size, codewords) {
  const total = codewords.length * 8;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip vertical timing column
    const upward = ((right + 1) & 2) === 0;
    for (let v = 0; v < size; v++) {
      const y = upward ? size - 1 - v : v;
      for (let j = 0; j < 2; j++) {
        const idx = y * size + right - j;
        if (fn[idx]) continue;
        // Remainder bits beyond the codewords stay 0 (light).
        mod[idx] = i < total ? (codewords[i >>> 3] >>> (7 - (i & 7))) & 1 : 0;
        i++;
      }
    }
  }
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(mod, fn, size, m) {
  const f = MASKS[m];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      if (!fn[idx] && f(x, y)) mod[idx] ^= 1;
    }
  }
}

// ---------------------------------------------------------------------------
// Mask penalty (ISO/IEC 18004 §7.8.3): N1 runs, N2 2x2 blocks, N3 finder-like, N4 balance
// ---------------------------------------------------------------------------

const FINDER_LIKE = [1, 0, 1, 1, 1, 0, 1];

function penalty(mod, size) {
  let score = 0;
  let dark = 0;
  for (let pass = 0; pass < 2; pass++) {
    // pass 0 scans rows, pass 1 scans columns
    const at = pass === 0 ? (a, b) => mod[a * size + b] : (a, b) => mod[b * size + a];
    for (let a = 0; a < size; a++) {
      let run = 1;
      for (let b = 0; b < size; b++) {
        const c = at(a, b);
        if (pass === 0) dark += c;
        // N1: runs of 5+ same-coloured modules.
        if (b > 0) {
          if (c === at(a, b - 1)) run++;
          else run = 1;
          if (run === 5) score += 3;
          else if (run > 5) score += 1;
        }
        // N3: 1:1:3:1:1 pattern with 4 light modules on either side (outside = light).
        if (b + 7 <= size) {
          let match = true;
          for (let k = 0; k < 7 && match; k++) match = at(a, b + k) === FINDER_LIKE[k];
          if (match) {
            const light = (from, to) => {
              for (let k = from; k < to; k++) if (k >= 0 && k < size && at(a, k)) return false;
              return true;
            };
            if (light(b - 4, b)) score += 40;
            if (light(b + 7, b + 11)) score += 40;
          }
        }
      }
    }
  }
  // N2: 2x2 blocks of one colour.
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = mod[y * size + x];
      if (c === mod[y * size + x + 1] && c === mod[(y + 1) * size + x] && c === mod[(y + 1) * size + x + 1]) score += 3;
    }
  }
  // N4: deviation of dark proportion from 50%, 10 points per 5% step.
  const total = size * size;
  score += 10 * Math.floor(Math.abs(dark * 20 - total * 10) / total);
  return score;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function qrMatrix(text, { ecc = 'M' } = {}) {
  const e = ECC_ORDER[ecc];
  if (e === undefined) throw new Error(`qrMatrix: invalid ECC level "${ecc}" (use L, M, Q or H)`);
  const bytes = new TextEncoder().encode(String(text));

  // 1. Pick the smallest version whose data capacity fits the segment.
  let ver = 1;
  for (; ver <= 40; ver++) {
    const needBits = 4 + (ver < 10 ? 8 : 16) + bytes.length * 8;
    if (needBits <= dataCodewords(ver, e) * 8) break;
  }
  if (ver > 40) {
    throw new Error(`qrMatrix: text too long (${bytes.length} bytes; max ${dataCodewords(40, e) - 3} bytes at ECC level ${ecc})`);
  }

  // 2. Encode data, add Reed–Solomon ECC, interleave blocks.
  const codewords = addEccAndInterleave(encodeData(bytes, ver, e), ver, e);

  // 3. Draw function patterns and data bits.
  const { size, mod, fn } = buildBase(ver);
  placeData(mod, fn, size, codewords);

  // 4. Try all 8 masks and keep the one with the lowest penalty.
  let best = null;
  let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    const trial = mod.slice();
    applyMask(trial, fn, size, m);
    drawFormat(trial, fn, size, e, m);
    const s = penalty(trial, size);
    if (s < bestScore) { bestScore = s; best = trial; }
  }
  return { size, modules: best, version: ver };
}

export function drawQr(canvas, text, { scale = 8, margin = 4, dark = '#000', light = '#fff', ecc = 'M' } = {}) {
  const qr = qrMatrix(text, { ecc });
  const { size, modules } = qr;
  const px = (size + 2 * margin) * scale;
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = dark;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y * size + x]) ctx.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
    }
  }
  return qr;
}
