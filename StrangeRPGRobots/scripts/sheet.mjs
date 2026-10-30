// Tiles PNG screenshots side by side into one image, so a set of shots can be checked at once.
//   node scripts/sheet.mjs out.png a.png b.png c.png
import fs from 'node:fs';
import zlib from 'node:zlib';

function readPng(f) {
  const b = fs.readFileSync(f);
  let i = 8, w = 0, h = 0;
  const idat = [];
  while (i < b.length) {
    const len = b.readUInt32BE(i);
    const type = b.toString('ascii', i + 4, i + 8);
    const data = b.subarray(i + 8, i + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); }
    if (type === 'IDAT') idat.push(data);
    i += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(w * h * 4);
  let p = 0;
  let prev = Buffer.alloc(w * 4);
  for (let y = 0; y < h; y++) {
    const ft = raw[p++];
    const row = Buffer.from(raw.subarray(p, p + w * 4));
    p += w * 4;
    for (let x = 0; x < w * 4; x++) {
      const a = x >= 4 ? row[x - 4] : 0, bb = prev[x], c = x >= 4 ? prev[x - 4] : 0;
      let v = row[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += bb;
      else if (ft === 3) v += (a + bb) >> 1;
      else if (ft === 4) { const pp = a + bb - c, pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? bb : c; }
      row[x] = v & 255;
    }
    row.copy(px, y * w * 4);
    prev = row;
  }
  return { w, h, px };
}

const table = [];
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
function crc(buf) { let x = 0xffffffff; for (const b of buf) x = table[(x ^ b) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; }
function chunk(t, d) {
  const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
  const td = Buffer.concat([Buffer.from(t), d]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([l, td, c]);
}
function writePng(f, w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(f, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

const [out, ...names] = process.argv.slice(2);
const imgs = names.map(readPng);
const W = imgs.reduce((s, i) => s + i.w + 4, -4), H = Math.max(...imgs.map((i) => i.h));
const px = Buffer.alloc(W * H * 4, 255);
let ox = 0;
for (const im of imgs) { for (let y = 0; y < im.h; y++) im.px.copy(px, (y * W + ox) * 4, y * im.w * 4, (y + 1) * im.w * 4); ox += im.w + 4; }
writePng(out, W, H, px);
console.log(`${out} ${W}x${H}`);
