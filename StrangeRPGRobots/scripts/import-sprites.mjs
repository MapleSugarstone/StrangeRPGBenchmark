// Turns a hand-drawn sheet into sprite grids for src/art/drawn.ts. The sheet holds one figure per row band,
// each drawn front, side, and back from left to right with empty columns between them. Each view is aligned
// by its feet (or centered when no feet show), set on the 8 by 9 grid with the feet on the last row, and its
// colors are snapped to the palette.
//   node scripts/import-sprites.mjs sheet.png id1 id2 ...
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
  const px = [];
  let p = 0;
  let prev = Buffer.alloc(w * bpp);
  for (let y = 0; y < h; y++) {
    const ft = raw[p++];
    const row = Buffer.from(raw.subarray(p, p + w * bpp));
    p += w * bpp;
    for (let x = 0; x < w * bpp; x++) {
      const a = x >= bpp ? row[x - bpp] : 0, bb = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = row[x];
      if (ft === 1) v += a; else if (ft === 2) v += bb; else if (ft === 3) v += (a + bb) >> 1;
      else if (ft === 4) { const pp = a + bb - c, pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? bb : c; }
      row[x] = v & 255;
    }
    const line = [];
    for (let x = 0; x < w; x++) line.push(bpp === 4 && row[x * bpp + 3] < 128 ? null : [row[x * bpp], row[x * bpp + 1], row[x * bpp + 2]]);
    px.push(line);
    prev = row;
  }
  return { w, h, px };
}

// The palette and its names, read from src/engine/palette.ts so they never drift.
const src = fs.readFileSync(new URL('../src/engine/palette.ts', import.meta.url), 'utf8');
const ramps = [...src.match(/export const RAMPS[\s\S]*?\n\];/)[0].matchAll(/0x[0-9a-f]{6}/g)].map((m) => parseInt(m[0], 16));
const names = {};
for (const m of src.match(/export const C = \{([\s\S]*?)\} as const/)[1].matchAll(/(\w+): (\d+)/g)) names[Number(m[2])] = m[1];
const redFirst = Number(src.match(/red0: (\d+)/)[1]), redLast = Number(src.match(/red3: (\d+)/)[1]);
function nearest([R, G, B]) {
  let best = 0, bestD = Infinity;
  ramps.forEach((c, i) => {
    const pr = (c >> 16) & 255, pg = (c >> 8) & 255, pb = c & 255;
    const rm = (R + pr) / 2, dr = R - pr, dg = G - pg, db = B - pb;
    const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

const [file, ...ids] = process.argv.slice(2);
const { w, h, px } = readPng(file);
const filled = (x, y) => !!px[y]?.[x];
const bands = [];
for (let y = 0; y < h; y++) {
  const any = px[y].some(Boolean);
  if (any && (!bands.length || bands[bands.length - 1].end !== y - 1)) bands.push({ start: y, end: y });
  else if (any) bands[bands.length - 1].end = y;
}
const out = {};
bands.forEach((band, bi) => {
  const cols = [];
  for (let x = 0; x < w; x++) {
    let any = false;
    for (let y = band.start; y <= band.end; y++) if (filled(x, y)) any = true;
    if (any && (!cols.length || cols[cols.length - 1].end < x - 1)) cols.push({ start: x, end: x });
    else if (any) cols[cols.length - 1].end = x;
  }
  // Views are separated by gaps wider than one column, so a bag or tail one column away stays with its figure.
  const views = [];
  for (const c of cols) {
    const last = views[views.length - 1];
    if (last && c.start - last.end <= 2) last.end = c.end; else views.push({ ...c });
  }
  if (views.length !== 3) { console.error(`figure ${bi + 1}: found ${views.length} views, expected 3`); return; }
  const legend = new Map();
  const charOf = (idx) => { if (!legend.has(idx)) legend.set(idx, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[legend.size]); return legend.get(idx); };
  const facings = {};
  ['down', 'right', 'up'].forEach((dir, vi) => {
    const v = views[vi];
    let bottom = band.end;
    while (bottom > band.start && ![...Array(v.end - v.start + 1)].some((_, k) => filled(v.start + k, bottom))) bottom--;
    const feet = [];
    // Feet are the black pixels on the bottom row. A bag or a robe hem there is not a foot.
    for (let x = v.start; x <= v.end; x++) if (filled(x, bottom) && nearest(px[bottom][x]) === 0) feet.push(x);
    const target = dir === 'right' ? 3 : 2;
    let off;
    if (feet.length >= 2) off = target - feet[0];
    else off = Math.round(3.5 - (v.start + v.end) / 2);
    const rows = [];
    for (let r = 0; r < 9; r++) {
      const y = bottom - 8 + r;
      let s = '';
      for (let c = 0; c < 8; c++) {
        const x = c - off;
        const col = y >= band.start && x >= v.start && x <= v.end ? px[y]?.[x] : null;
        s += col ? charOf(nearest(col)) : '.';
      }
      rows.push(s);
    }
    for (let x = v.start; x <= v.end; x++) if (x + off < 0 || x + off > 7) console.error(`figure ${bi + 1} ${dir}: column ${x} falls outside the 8-wide grid`);
    facings[dir] = rows;
  });
  const id = ids[bi] ?? `figure${bi + 1}`;
  out[id] = { legend: Object.fromEntries([...legend].map(([i, ch]) => [ch, names[i] ?? i])), ...facings };
});
for (const [id, s] of Object.entries(out)) {
  console.log(`  ${id}: {`);
  console.log(`    legend: { ${Object.entries(s.legend).map(([k, v]) => `${k}: C.${v}`).join(', ')} },`);
  for (const dir of ['down', 'right', 'up']) console.log(`    ${dir}: [${s[dir].map((r) => `'${r}'`).join(', ')}],`);
  console.log('  },');
}
