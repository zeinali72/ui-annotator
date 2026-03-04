/**
 * generate-icon.js
 * Generates icons/icon128.png using only Node.js built-ins (no native deps).
 * Draws a red rounded-square background with a white teardrop pin and red inner dot.
 *
 * Usage: node scripts/generate-icon.js
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH  = join(__dirname, '..', 'icons', 'icon128.png');

const SIZE = 128;

// RGBA pixel buffer
const pixels = new Uint8ClampedArray(SIZE * SIZE * 4);

// ─── Drawing helpers ──────────────────────────────────────────────────────────

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = a;
}

// ─── 1. Transparent fill ──────────────────────────────────────────────────────

pixels.fill(0);

// ─── 2. Red rounded-square background ────────────────────────────────────────
// #E53935 = rgb(229, 57, 53)

const [RR, RG, RB] = [229, 57, 53];
const CORNER = 22;

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    // Distance from nearest corner-circle centre
    const cx = Math.max(0, CORNER - x,         x - (SIZE - 1 - CORNER));
    const cy = Math.max(0, CORNER - y,         y - (SIZE - 1 - CORNER));
    if (cx * cx + cy * cy <= CORNER * CORNER) {
      setPixel(x, y, RR, RG, RB);
    }
  }
}

// ─── 3. White teardrop pin ────────────────────────────────────────────────────
// Head: circle centred at (64, 48) radius 30
// Body: tapers linearly from radius 30 at y=48 down to 0 at tip y=100

const hx = 64, hy = 48, hr = 30, tipY = 100;

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const dx = x - hx, dy = y - hy;
    const inHead = dx * dx + dy * dy <= hr * hr;

    let inBody = false;
    if (y > hy && y <= tipY) {
      const halfW = hr * (tipY - y) / (tipY - hy);
      inBody = Math.abs(x - hx) <= halfW;
    }

    if (inHead || inBody) setPixel(x, y, 255, 255, 255);
  }
}

// ─── 4. Red inner dot (pin "eye") ─────────────────────────────────────────────

const INNER_R = 11;
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const dx = x - hx, dy = y - hy;
    if (dx * dx + dy * dy <= INNER_R * INNER_R) {
      setPixel(x, y, RR, RG, RB);
    }
  }
}

// ─── PNG encoder (pure Node.js) ───────────────────────────────────────────────

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf  = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf  = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// IHDR: width, height, bit-depth=8, color-type=6 (RGBA), compression=0, filter=0, interlace=0
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

// IDAT: unfiltered scanlines (filter byte 0 per row), zlib-deflated
const raw = Buffer.alloc(SIZE * (1 + SIZE * 4));
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (1 + SIZE * 4);
  raw[rowStart] = 0; // filter: None
  for (let x = 0; x < SIZE; x++) {
    const pi = (y * SIZE + x) * 4;
    const ri = rowStart + 1 + x * 4;
    raw[ri]     = pixels[pi];
    raw[ri + 1] = pixels[pi + 1];
    raw[ri + 2] = pixels[pi + 2];
    raw[ri + 3] = pixels[pi + 3];
  }
}

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', deflateSync(raw)),
  pngChunk('IEND', Buffer.alloc(0)),
]);

// ─── Write ────────────────────────────────────────────────────────────────────

mkdirSync(join(__dirname, '..', 'icons'), { recursive: true });
writeFileSync(OUT_PATH, png);
console.log(`Icon written → ${OUT_PATH}  (${png.length} bytes)`);
