// Renders every piece of art to labeled contact sheets in shots/art/, for checking by eye.
// Usage: node scripts/build.mjs --tools && node dist-tools/sheet.js [chars|mons|tiles|props|icons|all]
import fs from 'node:fs';
import { RGB } from '../engine/palette';
import { writePng } from './png';
import type { Rows, Pal } from '../content/art/types';

const SCALE = 4;
const which = process.argv[2] || 'all';
fs.mkdirSync('shots/art', { recursive: true });

type Item = { label: string; frames: { rows: Rows; pal: Pal; flip?: boolean }[] };

const BG: [number, number, number] = [0x6e, 0x66, 0x78];

function sheet(name: string, items: Item[]) {
  const cell = 18;
  const perRow = 6;
  const maxFrames = Math.max(1, ...items.map((i) => i.frames.length));
  const frameW = Math.max(16, ...items.flatMap((i) => i.frames.map((f) => Math.max(...f.rows.map((r) => r.length)))));
  const frameH = Math.max(8, ...items.flatMap((i) => i.frames.map((f) => f.rows.length)));
  const itemW = maxFrames * (frameW + 2) + 2;
  const itemH = frameH + 4;
  const cols = Math.min(perRow, Math.max(1, Math.floor(400 / itemW)));
  const rows = Math.ceil(items.length / cols);
  const w = cols * itemW, h = rows * itemH;
  const px = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { px[i * 4] = BG[0]; px[i * 4 + 1] = BG[1]; px[i * 4 + 2] = BG[2]; px[i * 4 + 3] = 255; }
  items.forEach((it, n) => {
    const ox = (n % cols) * itemW + 2, oy = Math.floor(n / cols) * itemH + 2;
    it.frames.forEach((f, fi) => {
      const fx = ox + fi * (frameW + 2);
      // Checker behind each frame so clear pixels read as clear.
      for (let y = 0; y < frameH; y++) for (let x = 0; x < frameW; x++) {
        const c = ((x >> 2) + (y >> 2)) & 1 ? 0x5a : 0x64;
        const di = ((oy + y) * w + fx + x) * 4;
        px[di] = c; px[di + 1] = c; px[di + 2] = c + 8;
      }
      f.rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const ch = row[f.flip ? row.length - 1 - x : x];
          const s = ch === '1' ? 0 : ch === '2' ? 1 : ch === '3' ? 2 : -1;
          if (s < 0) continue;
          const [r, g, b] = RGB[(f.pal as readonly number[])[s]];
          const di = ((oy + y) * w + fx + x) * 4;
          px[di] = r; px[di + 1] = g; px[di + 2] = b;
        }
      });
    });
    void cell;
  });
  writePng(`shots/art/${name}.png`, w, h, px, SCALE);
  fs.writeFileSync(`shots/art/${name}.txt`, items.map((it, n) => `${n}: ${it.label}`).join('\n'));
  console.log(`shots/art/${name}.png: ${items.length} items (labels in ${name}.txt, left to right, top to bottom)`);
}

async function main() {
  if (which === 'chars' || which === 'all') {
    const { CHARS } = await import('../content/art/chars');
    sheet('chars', Object.entries(CHARS).map(([k, a]) => ({ label: k, frames: [
      { rows: a.down[0], pal: a.pal }, { rows: a.down[1], pal: a.pal }, { rows: a.up[0], pal: a.pal }, { rows: a.up[1], pal: a.pal },
      { rows: a.side[0], pal: a.pal }, { rows: a.side[1], pal: a.pal }, { rows: a.side[0], pal: a.pal, flip: true },
    ] })));
  }
  if (which === 'mons' || which === 'all') {
    const { MONS } = await import('../content/art/mons');
    sheet('mons', Object.entries(MONS).map(([k, a]) => ({ label: k, frames: [...a.idle, ...(a.act ? [a.act] : [])].map((rows) => ({ rows, pal: a.pal })) })));
  }
  if (which === 'tiles' || which === 'all') {
    const { TILES } = await import('../content/art/tiles');
    sheet('tiles', Object.entries(TILES).map(([k, a]) => ({ label: k, frames: a.frames.map((rows) => ({ rows, pal: a.pal })) })));
  }
  if (which === 'props' || which === 'all') {
    const { PROPS } = await import('../content/art/props');
    sheet('props', Object.entries(PROPS).map(([k, a]) => ({ label: k, frames: (a.frames ?? [a.rows]).map((rows) => ({ rows, pal: a.pal })) })));
  }
  if (which === 'cast') {
    // The main cast in story order: a name in the game font, then walk frames facing down, right, and up, all at 4x.
    const { CHARS } = await import('../content/art/chars');
    const { drawText } = await import('../engine/font');
    const { buf, W: SW } = await import('../engine/screen');
    const { C } = await import('../engine/palette');
    const CAST: [string, string][] = [['nodus', 'Nodus'], ['parhelia', 'Parhelia'], ['lot', 'Lot'], ['umbraculum', 'Umbraculum'], ['minim', 'Minim'], ['minim_cracked', 'Minim, cracked'], ['tik', 'Tik'], ['anthelion', 'Anthelion'], ['grisaille', 'Grisaille'], ['tib', 'Tib']];
    const S = 4, cell = 8 * S, gap = 6, nameW = 150, rowH = cell + 8;
    const w = 8 + nameW + 6 * (cell + gap), h = 8 + CAST.length * rowH;
    const px = new Uint8Array(w * h * 4);
    const bg = RGB[C.ink];
    for (let i = 0; i < w * h; i++) px.set([bg[0], bg[1], bg[2], 255], i * 4);
    const put = (x: number, y: number, rgb: readonly number[]) => { if (x >= 0 && y >= 0 && x < w && y < h) px.set([rgb[0], rgb[1], rgb[2], 255], (y * w + x) * 4); };
    CAST.forEach(([id, label], r) => {
      const a = CHARS[id];
      const y0 = 8 + r * rowH;
      // The name, drawn by the game's own font into its screen buffer and copied here at 2x.
      buf.fill(0);
      drawText(label, 0, 0, C.gold3);
      for (let yy = 0; yy < 9; yy++) for (let xx = 0; xx < 72; xx++) {
        const v = buf[yy * SW + xx];
        if (!v) continue;
        const rgb = [v & 255, (v >> 8) & 255, (v >> 16) & 255];
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) put(8 + xx * 2 + dx, y0 + cell / 2 - 8 + yy * 2 + dy, rgb);
      }
      const frames: { rows: Rows; flip?: boolean }[] = [{ rows: a.down[0] }, { rows: a.down[1] }, { rows: a.side[0] }, { rows: a.side[1] }, { rows: a.up[0] }, { rows: a.up[1] }];
      frames.forEach((f, k) => {
        const fx = 8 + nameW + k * (cell + gap);
        f.rows.forEach((row, yy) => {
          for (let xx = 0; xx < row.length; xx++) {
            const s = row[xx] === '1' ? 0 : row[xx] === '2' ? 1 : row[xx] === '3' ? 2 : -1;
            if (s < 0) continue;
            const rgb = RGB[(a.pal as readonly number[])[s]];
            for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) put(fx + xx * S + dx, y0 + yy * S + dy, rgb);
          }
        });
      });
    });
    writePng('shots/art/cast.png', w, h, px, 1);
    console.log(`shots/art/cast.png: ${CAST.length} characters, ${w} by ${h}`);
  }
  if (which === 'hero') {
    // The hero's standing frame at 1x with clear pixels left clear, for the cartridge menu.
    const { CHARS } = await import('../content/art/chars');
    const a = CHARS.nodus;
    const rows = a.down[0];
    const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
    const px = new Uint8Array(w * h * 4);
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const s = row[x] === '1' ? 0 : row[x] === '2' ? 1 : row[x] === '3' ? 2 : -1;
        if (s < 0) continue;
        const [r, g, b] = RGB[(a.pal as readonly number[])[s]];
        px.set([r, g, b, 255], (y * w + x) * 4);
      }
    });
    fs.mkdirSync('shots/menu', { recursive: true });
    writePng('shots/menu/gnomon-hero.png', w, h, px, 1);
    console.log(`shots/menu/gnomon-hero.png: ${w} by ${h}`);
  }
  if (which === 'icons' || which === 'all') {
    const { ICONS } = await import('../content/art/icons');
    sheet('icons', Object.entries(ICONS).map(([k, a]) => ({ label: k, frames: [{ rows: a.rows, pal: a.pal }] })));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
