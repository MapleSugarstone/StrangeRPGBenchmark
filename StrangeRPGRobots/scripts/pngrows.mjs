// Prints a small PNG as rows of characters, one per distinct color, with the color legend. For importing
// hand-edited sprites.
//   node scripts/pngrows.mjs sprite.png
import fs from 'node:fs';
import zlib from 'node:zlib';

function readPng(f) {
  const b = fs.readFileSync(f);
  let i = 8, w = 0, h = 0, ct = 6;
  const idat = [];
  while (i < b.length) {
    const len = b.readUInt32BE(i);
    const type = b.toString('ascii', i + 4, i + 8);
    const data = b.subarray(i + 8, i + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; }
    if (type === 'IDAT') idat.push(data);
    i += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(w * h * 4);
  let p = 0;
  let prev = Buffer.alloc(w * bpp);
  for (let y = 0; y < h; y++) {
    const ft = raw[p++];
    const row = Buffer.from(raw.subarray(p, p + w * bpp));
    p += w * bpp;
    for (let x = 0; x < w * bpp; x++) {
      const a = x >= bpp ? row[x - bpp] : 0, bb = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = row[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += bb;
      else if (ft === 3) v += (a + bb) >> 1;
      else if (ft === 4) { const pp = a + bb - c, pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? bb : c; }
      row[x] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      px[(y * w + x) * 4] = row[x * bpp]; px[(y * w + x) * 4 + 1] = row[x * bpp + 1]; px[(y * w + x) * 4 + 2] = row[x * bpp + 2];
      px[(y * w + x) * 4 + 3] = bpp === 4 ? row[x * bpp + 3] : 255;
    }
    prev = row;
  }
  return { w, h, px };
}

const { w, h, px } = readPng(process.argv[2]);
const keys = new Map();
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const rows = [];
for (let y = 0; y < h; y++) {
  let s = '';
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (px[i + 3] < 128) { s += '.'; continue; }
    const hex = ((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]).toString(16).padStart(6, '0');
    if (!keys.has(hex)) keys.set(hex, chars[keys.size]);
    s += keys.get(hex);
  }
  rows.push(s);
}
console.log(`${w}x${h}`);
for (const r of rows) console.log(r);
for (const [hex, ch] of keys) console.log(ch, '#' + hex);
