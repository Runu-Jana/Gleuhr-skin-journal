#!/usr/bin/env node
/**
 * Generates valid PWA icon PNGs using only Node.js built-ins.
 * Produces a solid #c44033 (Gleuhr brand red) square for each size.
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generatePNG(width, height, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // RGB color type
  // bytes 10-12 are 0 (compression/filter/interlace)

  // Raw scanlines: 1 filter byte + width*3 RGB bytes per row
  const rowSize = 1 + width * 3;
  const raw = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    const base = y * rowSize;
    raw[base] = 0; // filter type None
    for (let x = 0; x < width; x++) {
      raw[base + 1 + x * 3]     = r;
      raw[base + 1 + x * 3 + 1] = g;
      raw[base + 1 + x * 3 + 2] = b;
    }
  }

  const idat = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// Gleuhr brand red: #c44033
const R = 0xc4, G = 0x40, B = 0x33;

const publicDir = path.resolve(__dirname, '..', 'client', 'public');

const sizes = [192, 512];
for (const size of sizes) {
  const outPath = path.join(publicDir, `icon-${size}x${size}.png`);
  const buf = generatePNG(size, size, R, G, B);
  fs.writeFileSync(outPath, buf);
  console.log(`✅ Generated ${outPath} (${buf.length} bytes)`);
}
