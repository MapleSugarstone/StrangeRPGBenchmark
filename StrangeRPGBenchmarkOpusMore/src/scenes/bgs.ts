// Battle backgrounds. Each area gets its own animated scene, drawn between the timeline and the party panel.
import { BAYER, Gfx, W } from '../core/gfx';
import { Rng } from '../core/rng';
import type { MapDef } from '../maps/types';

export const TOP = 11;
export const BOT = 92;

type Bg = (g: Gfx, t: number) => void;

// Stateless hash in [0, 1), so particles need no per-frame storage.
function hh(i: number, k = 0): number {
  let x = Math.imul(i * 374761393 + k * 668265263 + 1, 1274126177);
  x ^= x >>> 13;
  x = Math.imul(x, 1103515245);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function mod(a: number, n: number) { return ((a % n) + n) % n; }

// Vertical gradient through color stops, each step dithered in eighths.
function grad(g: Gfx, y0: number, y1: number, stops: string[]) {
  const h = y1 - y0, n = stops.length - 1;
  for (let y = y0; y < y1; y++) {
    const f = ((y - y0) / h) * n;
    const i = Math.min(n - 1, Math.floor(f));
    g.rect(0, y, W, 1, stops[i]);
    g.dither(0, y, W, 1, stops[i + 1], Math.round((f - i) * 8) / 8);
  }
}

// Draws a pixel only where the Bayer threshold passes, for soft edges without blending.
function dpx(g: Gfx, x: number, y: number, c: string, level: number) {
  x = Math.round(x); y = Math.round(y);
  if (BAYER[(y & 3) * 4 + (x & 3)] < level * 16) g.rect(x, y, 1, 1, c);
}

function line(g: Gfx, x0: number, y0: number, x1: number, y1: number, c: string) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 400; n++) {
    g.rect(x0, y0, 1, 1, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function disc(g: Gfx, cx: number, cy: number, r: number, c: string) {
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(r * r - dy * dy));
    g.rect(cx - w, cy + dy, w * 2 + 1, 1, c);
  }
}

function ellipse(g: Gfx, cx: number, cy: number, rx: number, ry: number, c: string, from = 0, to = Math.PI * 2) {
  const n = Math.ceil(Math.max(rx, ry) * 7);
  let lx = NaN, ly = NaN;
  for (let i = 0; i <= n; i++) {
    const a = from + ((to - from) * i) / n;
    const x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry);
    if (x !== lx || y !== ly) g.rect(x, y, 1, 1, c);
    lx = x; ly = y;
  }
}

// A rope hanging between two points.
function sag(g: Gfx, x0: number, y0: number, x1: number, y1: number, depth: number, c: string) {
  const n = Math.max(2, Math.abs(x1 - x0));
  let px = Math.round(x0), py = Math.round(y0);
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const x = Math.round(x0 + (x1 - x0) * u), y = Math.round(y0 + (y1 - y0) * u + Math.sin(Math.PI * u) * depth);
    line(g, px, py, x, y, c);
    px = x; py = y;
  }
}

// Perspective floor from the horizon down, with depth lines that scroll and rays to a vanishing point.
function floor(g: Gfx, y0: number, base: string, lineC: string, t: number, speed = 0, rays = 12, far?: string) {
  const h = BOT - y0;
  g.rect(0, y0, W, h, base);
  if (far) for (let y = y0; y < y0 + 6; y++) g.dither(0, y, W, 1, far, (6 - (y - y0)) / 7);
  const s = mod(t * speed, 1);
  for (let i = 0; i < 16; i++) {
    const d = i + s;
    const y = Math.round(y0 + (h * 2) / (d + 2));
    if (y <= y0 || y >= BOT) continue;
    g.dither(0, y, W, 1, lineC, Math.max(0.125, Math.min(1, 1.4 - d / 9)));
  }
  if (!rays) return;
  const vy = y0 - h * 0.6;
  for (let k = -rays; k <= rays; k++) {
    for (let y = y0; y < BOT; y++) {
      const f = (y - vy) / (BOT - vy);
      dpx(g, 96 + k * 22 * f, y, lineC, Math.min(1, (y - y0) / h * 1.6 + 0.1));
    }
  }
}

function stars(g: Gfx, seed: number, n: number, y0: number, y1: number, colors: string[], t: number) {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hh(i, seed) * W), y = y0 + Math.floor(hh(i, seed + 1) * (y1 - y0));
    const tw = Math.floor(t / 9 + hh(i, seed + 2) * 40) % 11;
    if (tw === 0) continue;
    g.rect(x, y, 1, 1, colors[i % colors.length]);
    if (tw === 5 && i % 4 === 0) { g.rect(x - 1, y, 3, 1, colors[i % colors.length]); g.rect(x, y - 1, 1, 3, colors[i % colors.length]); }
  }
}

// Falling or rising particles computed from time alone.
function fall(g: Gfx, seed: number, n: number, y0: number, y1: number, vy: number, vx: number, colors: string[], t: number, w = 1, h = 1, sway = 0) {
  const span = y1 - y0;
  for (let i = 0; i < n; i++) {
    const sp = 0.6 + hh(i, seed) * 0.8;
    const y = y0 + mod(hh(i, seed + 1) * span + t * vy * sp, span);
    const x = mod(hh(i, seed + 2) * W + t * vx * sp + Math.sin(t / 30 + i) * sway, W);
    g.rect(Math.round(x), Math.round(y), w, h, colors[i % colors.length]);
  }
}

function skyline(g: Gfx, seed: number, base: number, minH: number, maxH: number, c: string, win: string | null, t: number, wMin = 10, wMax = 22) {
  const r = new Rng(seed);
  let x = -r.int(8);
  while (x < W) {
    const w = wMin + r.int(wMax - wMin);
    const h = minH + r.int(maxH - minH);
    g.rect(x, base - h, w, h, c);
    if (r.chance(0.5)) g.rect(x + 2, base - h - 2, w - 4, 2, c);
    if (win) {
      for (let wy = base - h + 3; wy < base - 2; wy += 4) for (let wx = x + 2; wx < x + w - 2; wx += 3) {
        const k = wx * 31 + wy * 17;
        const on = hh(k, seed) < 0.3 && Math.floor(t / 90 + hh(k, seed + 1) * 9) % 9 !== 0;
        if (on) g.rect(wx, wy, 1, 1, win);
      }
    }
    x += w + r.int(4);
  }
}

// ---- scenes ----

const lowmost: Bg = (g, t) => {
  grad(g, TOP, 54, ['abyss', 'dusk', 'bruise', 'plum']);
  stars(g, 3, 24, TOP, 40, ['bone', 'plea'], t);
  skyline(g, 11, 52, 6, 16, 'dusk', null, t, 8, 16);
  skyline(g, 12, 54, 4, 12, 'abyss', 'plea', t, 10, 20);
  floor(g, 54, 'peat', 'siltdk', t, 0, 10, 'bruise');
  fall(g, 5, 6, TOP, 54, 0.12, 0.02, ['plea', 'paper'], t, 2, 1, 3);
  // A lamp post that flickers when something is about to happen.
  g.rect(166, 30, 1, 24, 'ink');
  g.rect(164, 28, 5, 2, 'ink');
  if (Math.floor(t / 7) % 23 !== 0) { g.rect(165, 30, 3, 1, 'gold'); g.dither(161, 31, 11, 4, 'gold', 0.18); }
};

const shallows: Bg = (g, t) => {
  grad(g, TOP, 48, ['steel', 'slate', 'siltdk', 'silt']);
  fall(g, 7, 22, TOP, 48, 0.1, 0.01, ['plea', 'paper', 'bone'], t, 2, 1, 4);
  // Silt flats with standing water that reflects the sky.
  grad(g, 48, BOT, ['silt', 'tan', 'siltdk']);
  const r = new Rng(31);
  for (let i = 0; i < 9; i++) {
    const y = 50 + Math.floor(Math.pow(r.next(), 1.6) * 40);
    const w = 8 + Math.floor((y - 48) * 0.9) + r.int(10);
    const x = r.int(W) - w / 2;
    g.rect(x, y, w, 1 + ((y - 48) >> 4), 'slate');
    if (Math.floor(t / 20 + i) % 4 === 0) g.rect(x + ((t >> 2) % Math.max(1, w)), y, 2, 1, 'paper');
  }
  for (let x = 0; x < W; x += 2) dpx(g, x, 48, 'paper', 0.5);
};

const shaft: Bg = (g, t) => {
  g.rect(0, TOP, W, BOT - TOP, 'abyss');
  const bands = ['peat', 'abyss', 'brown', 'peat', 'abyss', 'siltdk', 'peat'];
  for (let x = 0; x < W; x++) {
    let y = TOP;
    for (let b = 0; b < bands.length; b++) {
      const h = 6 + Math.round(Math.sin(x / (9 + b * 3) + b) * 2 + Math.sin(x / 23 + b * 2));
      g.rect(x, y, 1, h, bands[b]);
      y += h;
    }
  }
  // Veins of plea-stone that pulse as if whispering.
  for (let i = 0; i < 6; i++) {
    const y = 18 + Math.floor(hh(i, 4) * 30), x = Math.floor(hh(i, 5) * 170);
    const lv = 0.25 + 0.25 * Math.sin(t / 25 + i * 1.7);
    for (let k = 0; k < 14; k++) dpx(g, x + k, y + Math.round(Math.sin(k / 3 + i) * 1.5), 'plea', lv + 0.25);
  }
  floor(g, 58, 'abyss', 'peat', t, 0, 7);
  fall(g, 9, 4, TOP, 58, 0.9, 0, ['teal'], t, 1, 2);
};

const deep: Bg = (g, t) => {
  grad(g, TOP, 60, ['abyss', 'bruise', 'abyss']);
  // Roots hang from the ceiling.
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(hh(i, 21) * W), len = 6 + Math.floor(hh(i, 22) * 20);
    for (let y = 0; y < len; y++) g.rect(x + Math.round(Math.sin(y / 4 + i) * 1.5), TOP + y, 1, 1, 'plum');
  }
  // Eyes in the dark, each blinking on its own clock.
  for (let i = 0; i < 9; i++) {
    const x = 8 + Math.floor(hh(i, 23) * 176), y = 20 + Math.floor(hh(i, 24) * 30);
    const ph = Math.floor(t + hh(i, 25) * 400) % 400;
    if (ph < 300) continue;
    const open = ph < 306 || ph > 394 ? 'dusk' : 'gold';
    g.rect(x, y, 1, 1, open); g.rect(x + 3, y, 1, 1, open);
  }
  floor(g, 60, 'abyss', 'bruise', t, 0, 6);
};

const maw: Bg = (g, t) => {
  deep(g, t);
  // The Want's stomach: ribs closing over the top of the screen.
  const breathe = Math.round(Math.sin(t / 40) * 2);
  for (let i = 0; i < 7; i++) {
    const x = 14 + i * 28;
    ellipse(g, x, TOP - 4, 10, 18 + breathe, 'wine', 0, Math.PI);
  }
  g.dither(0, TOP, W, 6, 'maroon', 0.5);
};

const waiting: Bg = (g, t) => {
  grad(g, TOP, 50, ['abyss', 'bruise', 'plum', 'violet']);
  // An endless checkered floor of the same lilac tile.
  const y0 = 50, h = BOT - y0;
  g.rect(0, y0, W, h, 'violet');
  for (let y = y0; y < BOT; y++) {
    const f = (y - y0 + 1) / h;
    const zi = Math.floor(6 / f);
    const cw = 26 * f;
    if (cw < 2) { g.dither(0, y, W, 1, 'lilac', 0.5); continue; }
    const start = 96 - Math.ceil(96 / cw + 1) * cw;
    for (let x0 = start; x0 < W; x0 += cw) {
      const xi = Math.round((x0 - 96) / cw);
      if ((xi + zi) & 1) g.rect(Math.round(x0), y, Math.round(x0 + cw) - Math.round(x0), 1, 'lilac');
    }
  }
  // Rows of chairs to the horizon. Some are taken. One of the sitters keeps turning around.
  const rows = [[52, 2, 9], [55, 3, 13], [60, 5, 19]] as const;
  rows.forEach(([y, s, gap], ri) => {
    for (let x = mod(-ri * 5, gap) - gap; x < W; x += gap) {
      g.rect(x, y - s, 1, s + 1, 'abyss');
      g.rect(x, y - 1, s, 1, 'abyss');
      g.rect(x + s - 1, y - 1, 1, 2, 'abyss');
      const k = x * 7 + ri * 101;
      if (hh(k, 3) < 0.55) {
        const turn = ri === 2 && hh(k, 4) < 0.2 && Math.floor(t / 180) % 5 === 2;
        g.rect(x + 1, y - s - 1, Math.max(1, s - 2), s - 1, turn ? 'paper' : 'dusk');
      }
    }
  });
  // NOW SERVING sign. Now and then it shows your number.
  g.box(110, 13, 78, 13, 'violet', 'abyss');
  const flick = Math.floor(t / 4) % 300 < 3;
  g.text('NOW SERVING', 115, 16, 'lilac');
  g.textR(flick ? '?' : '3', 183, 16, flick ? 'pink' : 'gold');
};

const docket: Bg = (g, t) => {
  grad(g, TOP, 54, ['abyss', 'navy', 'steel']);
  // Cabinet towers with their drawers labelled.
  const r = new Rng(41);
  let x = -4;
  while (x < W) {
    const w = 12 + r.int(14), h = 14 + r.int(26);
    g.rect(x, 54 - h, w, h, 'slate');
    g.rect(x + w - 1, 54 - h, 1, h, 'steel');
    for (let y = 54 - h + 3; y < 54; y += 5) { g.rect(x + 1, y, w - 2, 1, 'steel'); g.rect(x + (w >> 1) - 1, y + 2, 2, 1, 'grey'); }
    x += w + 1 + r.int(3);
  }
  // Pneumatic tubes with capsules in them.
  for (const [ty, sp] of [[20, 1.6], [27, -2.3], [34, 1.1]] as const) {
    g.dither(0, ty, W, 3, 'ice', 0.25);
    g.rect(0, ty, W, 1, 'grey');
    g.rect(0, ty + 2, W, 1, 'grey');
    for (let k = 0; k < 2; k++) g.rect(Math.round(mod(t * sp + k * 97 + ty * 13, W + 10) - 5), ty + 1, 4, 1, 'gold');
  }
  floor(g, 54, 'steel', 'navy', t, 0, 9);
};

const cloister: Bg = (g, t) => {
  g.rect(0, TOP, W, BOT - TOP, 'peat');
  g.dither(0, TOP, W, BOT - TOP, 'brown', 0.25);
  // The switchboard: jacks, and a lamp above each that lights when a call comes in.
  for (let y = 16; y < 50; y += 7) for (let x = 6; x < W - 4; x += 7) {
    const i = x * 13 + y;
    g.rect(x, y + 2, 2, 2, 'ink');
    const on = hh(i, Math.floor(t / 24 + hh(i, 1) * 6)) < 0.12;
    g.rect(x, y, 2, 1, on ? (hh(i, 2) < 0.3 ? 'red' : 'gold') : 'brown');
  }
  // Patch cords hanging between jacks.
  const cords: [number, number, number, number, string][] = [[13, 20, 62, 34, 'red'], [41, 41, 104, 27, 'sky'], [90, 20, 160, 48, 'gold'], [125, 34, 181, 13, 'mint'], [20, 48, 76, 48, 'pink']];
  cords.forEach(([a, b, c, d, color], i) => sag(g, a + 1, b + 4, c + 1, d + 4, 9 + Math.sin(t / 50 + i) * 1.5, color));
  g.rect(0, 52, W, 2, 'ink');
  floor(g, 54, 'navy', 'dusk', t, 0, 8);
};

const vault: Bg = (g, t) => {
  g.rect(0, TOP, W, BOT - TOP, 'abyss');
  // A corridor of shelves to a lit far wall.
  const bx0 = 76, bx1 = 116, by0 = 30, by1 = 58;
  const glow = 0.5 + 0.2 * Math.sin(t / 60);
  g.rect(bx0, by0, bx1 - bx0, by1 - by0, 'navy');
  g.dither(bx0 + 6, by0 + 4, bx1 - bx0 - 12, by1 - by0 - 8, 'paper', glow * 0.5);
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < 76; i++) {
      const x = side ? W - 1 - i : i;
      const f = i / 76;
      const top = Math.round(TOP + (by0 - TOP) * f), bot = Math.round(BOT + (by1 - BOT) * f);
      g.rect(x, top, 1, bot - top, 'navy');
      for (let s = 1; s < 6; s++) {
        const y = Math.round(top + ((bot - top) * s) / 6);
        g.rect(x, y, 1, 1, 'slate');
        if (hh(Math.floor(i / 3) + s * 40, side) < 0.6) g.rect(x, y - Math.max(1, Math.round((bot - top) / 12)), 1, Math.max(1, Math.round((bot - top) / 12)), hh(i + s * 99, side + 5) < 0.2 ? 'plea' : 'bone');
      }
    }
  }
  // Floor between the shelves.
  for (let y = by1; y < BOT; y++) {
    const f = (y - by1) / (BOT - by1);
    const xl = Math.round(bx0 - 76 * f), xr = Math.round(bx1 + 76 * f);
    g.rect(xl, y, xr - xl, 1, 'steel');
    if ((y - by1) % Math.max(2, Math.round(2 + f * 8)) === 0) g.dither(xl, y, xr - xl, 1, 'slate', 0.5);
  }
  fall(g, 13, 10, TOP, BOT, -0.05, 0.03, ['bone'], t, 1, 1, 6);
};

const encore: Bg = (g, t) => {
  grad(g, TOP, 54, ['lilac', 'pink', 'cream']);
  // The sun stays at the same hour. Each time the day restarts it slips back one pixel.
  const sx = 150 - (Math.floor(t / 1200) % 3);
  disc(g, sx, 26, 7, 'cream');
  g.circle(sx, 26, 9, 'gold');
  skyline(g, 61, 54, 6, 16, 'rose', 'cream', t, 10, 18);
  // Festival bunting.
  for (const [y0, y1, d] of [[14, 22, 10], [26, 18, 8]] as const) {
    sag(g, -2, y0, W + 2, y1, d, 'paper');
    for (let i = 0; i < 16; i++) {
      const u = (i + 0.5) / 16;
      const x = Math.round(-2 + (W + 4) * u), y = Math.round(y0 + (y1 - y0) * u + Math.sin(Math.PI * u) * d) + 1;
      const c = ['pink', 'sky', 'gold', 'mint'][(i + (y0 >> 2)) % 4];
      const sw = Math.round(Math.sin(t / 20 + i) * 0.6);
      g.rect(x - 1, y, 3, 1, c); g.rect(x + sw, y + 1, 1, 2, c);
    }
  }
  floor(g, 54, 'tan', 'silt', t, 0, 10, 'rose');
  fall(g, 17, 14, TOP, BOT, 0.3, 0.05, ['pink', 'sky', 'gold', 'mint', 'lilac'], t, 1, 2, 4);
};

function gear(g: Gfx, cx: number, cy: number, r: number, teeth: number, rot: number, c: string, hub: string) {
  g.circle(cx, cy, r, c);
  g.circle(cx, cy, r - 1, c);
  for (let k = 0; k < teeth; k++) {
    const a = rot + (k * Math.PI * 2) / teeth;
    g.rect(Math.round(cx + Math.cos(a) * (r + 1)) - 1, Math.round(cy + Math.sin(a) * (r + 1)) - 1, 3, 3, c);
  }
  for (let k = 0; k < 4; k++) {
    const a = rot + (k * Math.PI) / 2;
    line(g, cx, cy, cx + Math.cos(a) * (r - 1), cy + Math.sin(a) * (r - 1), c);
  }
  disc(g, cx, cy, 2, hub);
}

const tower: Bg = (g, t) => {
  grad(g, TOP, 56, ['abyss', 'peat', 'brown']);
  gear(g, 34, 34, 20, 14, t / 90, 'siltdk', 'gold');
  gear(g, 64, 18, 10, 8, -t / 45 + 0.2, 'tan', 'gold');
  gear(g, 160, 40, 16, 11, -t / 72, 'abyss', 'tan');
  // The pendulum swings a little short on one side.
  const a = Math.sin(t / 38) * 0.5 + (Math.sin(t / 38) < 0 ? 0.04 : 0);
  const bx = 112 + Math.sin(a) * 36, by = TOP + Math.cos(a) * 36;
  line(g, 112, TOP, bx, by, 'tan');
  disc(g, Math.round(bx), Math.round(by), 4, 'gold');
  g.circle(Math.round(bx), Math.round(by), 4, 'peat');
  floor(g, 56, 'brown', 'peat', t, 0, 0);
  for (let k = -8; k <= 8; k++) for (let y = 56; y < BOT; y++) g.rect(Math.round(96 + k * 14 * ((y - 30) / (BOT - 30))), y, 1, 1, 'peat');
};

const bedtime: Bg = (g, t) => {
  grad(g, TOP, 60, ['abyss', 'navy', 'dusk']);
  stars(g, 71, 40, TOP, 58, ['white', 'ice', 'lilac'], t);
  // A clock face filling the sky, its hands running backward.
  disc(g, 96, 38, 24, 'navy');
  g.circle(96, 38, 24, 'lilac');
  g.circle(96, 38, 26, 'dusk');
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6;
    g.rect(Math.round(96 + Math.cos(a) * 21), Math.round(38 + Math.sin(a) * 21), 1, 1, 'paper');
  }
  const m = -t / 20, h = -t / 240;
  line(g, 96, 38, 96 + Math.cos(m) * 18, 38 + Math.sin(m) * 18, 'paper');
  line(g, 96, 38, 96 + Math.cos(h) * 11, 38 + Math.sin(h) * 11, 'gold');
  floor(g, 60, 'abyss', 'dusk', t, 0, 8);
};

const jackpot: Bg = (g, t) => {
  grad(g, TOP, 54, ['abyss', 'maroon', 'plum']);
  // Marquee bulbs chasing along the top.
  for (let x = 2; x < W; x += 4) g.rect(x, 13, 2, 2, Math.floor(x / 4 + t / 5) % 3 === 0 ? 'gold' : 'maroon');
  // Three reels that never line up.
  const syms = ['7', '$', '?', '%', '7'];
  for (let r = 0; r < 3; r++) {
    const x = 40 + r * 44, y = 20, w = 24, h = 26;
    g.rect(x - 2, y - 2, w + 4, h + 4, 'gold');
    g.rect(x, y, w, h, 'cream');
    const cyc = Math.floor(t / 240);
    const spinning = (t % 240) < 60 + r * 30;
    const off = spinning ? t * 3 : (Math.floor(hh(cyc, r) * 5) * 22 + (r === 2 && hh(cyc, 9) < 0.5 ? 11 : 0));
    g.ctx.save();
    g.ctx.beginPath();
    g.ctx.rect(x, y, w, h);
    g.ctx.clip();
    for (let k = -1; k < 3; k++) {
      const idx = mod(Math.floor(off / 22) + k, syms.length);
      g.textBig(syms[idx], x + w / 2, y + 6 + k * 22 - mod(off, 22), 2, idx === 0 || idx === 4 ? 'red' : 'plum');
    }
    g.ctx.restore();
    g.dither(x, y, w, 3, 'ink', 0.5);
    g.dither(x, y + h - 3, w, 3, 'ink', 0.5);
  }
  floor(g, 54, 'maroon', 'red', t, 0, 0, 'plum');
  for (let y = 58; y < BOT; y += 8) for (let x = ((y >> 3) & 1) * 8; x < W; x += 16) { g.rect(x + 3, y, 1, 1, 'gold'); g.rect(x + 2, y + 1, 3, 1, 'gold'); g.rect(x + 3, y + 2, 1, 1, 'gold'); }
};

const arena: Bg = (g, t) => {
  grad(g, TOP, 50, ['abyss', 'plum', 'maroon']);
  // Tiers of the crowd. They cheer when you lose.
  const tiers = [[24, 'abyss', 4], [34, 'bruise', 5], [44, 'wine', 6]] as const;
  tiers.forEach(([y, c, gap], ti) => {
    g.rect(0, y + 2, W, 10, c);
    for (let x = ti * 2; x < W; x += gap) {
      const jump = Math.floor(t / 10 + hh(x, ti) * 8) % 8 === 0 ? 1 : 0;
      g.rect(x, y - jump, 2, 2, c);
      g.rect(x - 1, y + 2 - jump, 4, 2, c);
    }
  });
  // Spotlights sweeping across the ring.
  for (let s = 0; s < 2; s++) {
    const cx = 96 + Math.sin(t / 70 + s * 2.4) * 70;
    for (let y = TOP; y < 70; y++) {
      const f = (y - TOP) / 59;
      const x0 = (s ? W : 0) + (cx - (s ? W : 0)) * f;
      const hw = 2 + f * 12;
      g.dither(x0 - hw, y, hw * 2, 1, 'cream', 0.25);
    }
  }
  floor(g, 56, 'rust', 'brown', t, 0, 0);
  for (const y of [52, 56]) g.rect(0, y, W, 1, 'paper');
  for (const x of [6, 185]) g.rect(x, 48, 2, 12, 'gold');
};

const house: Bg = (g, t) => {
  arena(g, t);
  g.dither(0, TOP, W, BOT - TOP, 'red', 0.125);
};

function conifer(g: Gfx, x: number, base: number, h: number, c: string) {
  for (let y = 0; y < h; y++) {
    const w = Math.round(1 + (y / h) * (h * 0.38)) + ((y % 4 === 3) ? -1 : 0);
    g.rect(x - w, base - h + y, w * 2 + 1, 1, c);
  }
  g.rect(x, base, 1, 2, c);
}

const treeline: Bg = (g, t) => {
  grad(g, TOP, 56, ['dusk', 'bruise', 'rose', 'tan']);
  const r = new Rng(91);
  for (let x = -4; x < W; x += 9 + r.int(5)) conifer(g, x, 50, 12 + r.int(10), 'algae');
  for (let x = -6; x < W; x += 14 + r.int(8)) conifer(g, x, 56, 18 + r.int(14), 'pine');
  floor(g, 56, 'pine', 'moss', t, 0, 0);
  fall(g, 93, 10, 20, 70, -0.05, 0.04, ['lime', 'mint'], t, 1, 1, 8);
};

const wood: Bg = (g, t) => {
  grad(g, TOP, 60, ['bone', 'paper', 'paper']);
  // Pale trunks run up past the top of the screen. Some have mouths, and the mouths stay shut.
  const r = new Rng(101);
  for (let i = 0; i < 12; i++) {
    const x = r.int(W), w = 3 + r.int(6), base = 52 + r.int(10);
    const c = w > 6 ? 'bone' : 'silt';
    g.rect(x, TOP, w, base - TOP, c);
    g.rect(x + w - 1, TOP, 1, base - TOP, 'siltdk');
    const my = 24 + r.int(20);
    const open = Math.floor((t + i * 173) / 7) % 160 === 0;
    g.rect(x + 1, my, w - 2, open ? 2 : 1, open ? 'ink' : 'siltdk');
  }
  // A sound wave stopped in the air.
  for (let x = 0; x < W; x++) dpx(g, x, 40 + Math.round(Math.sin(x / 6) * 3 * Math.sin(x / 40)), 'grey', 0.5);
  floor(g, 60, 'paper', 'bone', t, 0, 0);
};

const hush: Bg = (g, t) => {
  wood(g, t);
  g.dither(0, TOP, W, BOT - TOP, 'white', 0.25);
};

const foot: Bg = (g, t) => {
  grad(g, TOP, 58, ['ice', 'paper', 'bone']);
  // The Line: a cable rising out of the ground and out of sight.
  for (const [x0, x1] of [[60, 0], [132, W]] as const) line(g, x0 < 96 ? 92 : 100, 18, x1, 58, 'siltdk');
  g.rect(90, TOP, 12, 50, 'ink');
  g.rect(92, TOP, 2, 50, 'slate');
  for (let y = TOP + mod(-Math.floor(t / 30), 4); y < 61; y += 4) { g.rect(87, y, 3, 1, 'siltdk'); g.rect(102, y, 3, 1, 'siltdk'); }
  for (let i = 0; i < 6; i++) g.rect(90 + Math.floor(hh(i, 7) * 10), 14 + Math.floor(hh(i, 8) * 40), 2, 1, 'plea');
  floor(g, 58, 'bone', 'silt', t, 0, 0);
  for (let i = 0; i < 6; i++) sag(g, 96, 60, 96 + (i - 2.5) * 34, BOT, 3, 'silt');
};

const climb: Bg = (g, t) => {
  grad(g, TOP, BOT, ['navy', 'blue', 'sky', 'ice']);
  // Clouds sink past as you climb.
  for (let i = 0; i < 6; i++) {
    const y = mod(hh(i, 111) * 100 + t * (0.3 + hh(i, 112) * 0.3), 110) - 10;
    const x = hh(i, 113) * W - 20, w = 18 + Math.floor(hh(i, 114) * 26);
    g.rect(x, y, w, 3, 'white');
    g.rect(x + 4, y - 2, w - 10, 2, 'white');
    g.dither(x, y + 3, w, 2, 'ice', 0.5);
  }
  fall(g, 115, 8, TOP, BOT, 0.1, 2.2, ['white'], t, 5, 1);
  g.rect(14, TOP, 5, BOT - TOP, 'ink');
  g.rect(15, TOP, 1, BOT - TOP, 'slate');
  // A maintenance platform under the party.
  g.rect(0, 66, W, 4, 'steel');
  g.dither(0, 70, W, BOT - 70, 'steel', 0.5);
  for (let x = 0; x < W; x += 6) g.rect(x, 66, 1, 4, 'slate');
};

const catchBg: Bg = (g, t) => {
  grad(g, TOP, BOT, ['sky', 'ice', 'paper']);
  // The net across the sky, heavy with caught prayers.
  for (let i = 0; i < 6; i++) {
    const y = 14 + i * 9;
    sag(g, -4, y, W + 4, y, 4 + i + Math.sin(t / 60 + i) * 0.8, 'slate');
  }
  for (let i = -3; i < 14; i++) line(g, i * 18, TOP, i * 18 + 36, 66, 'slate');
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(hh(i, 121) * W), y = 16 + Math.floor(hh(i, 122) * 40);
    g.rect(x, y, 3, 2, 'plea'); g.rect(x + 1, y + 2, 2, 1, 'paper');
  }
  fall(g, 123, 3, 40, BOT, 0.4, 0, ['plea'], t, 2, 1, 3);
  floor(g, 64, 'ice', 'slate', t, 0, 9);
};

const sea: Bg = (g, t) => {
  grad(g, TOP, 46, ['sky', 'ice', 'cream']);
  disc(g, 142, 32, 6, 'white');
  // A far island nobody has named.
  g.rect(24, 43, 22, 3, 'algae'); g.rect(28, 41, 12, 2, 'algae');
  grad(g, 46, BOT, ['sky', 'sea', 'ocean']);
  // Wave crests in perspective.
  for (let row = 0; row < 14; row++) {
    const y = 47 + Math.round(Math.pow(row / 14, 1.7) * 44);
    const len = 1 + (row >> 2), gap = 6 + row * 2;
    for (let i = 0; i < W / gap + 1; i++) {
      const x = mod(i * gap + hh(i, row) * gap + t * (0.05 + row * 0.02), W + gap) - gap;
      if (Math.floor(t / 15 + hh(i, row + 50) * 6) % 6 !== 0) g.rect(x, y, len, 1, 'white');
    }
  }
  // Glitter under the sun.
  for (let y = 47; y < BOT; y += 2) if (hh(y, Math.floor(t / 6)) < 0.5) g.rect(142 + Math.round((hh(y, Math.floor(t / 6) + 1) - 0.5) * (4 + (y - 46) / 3)), y, 2, 1, 'cream');
};

const deadletter: Bg = (g, t) => {
  grad(g, TOP, 46, ['abyss', 'navy']);
  stars(g, 131, 30, TOP, 44, ['white', 'ice'], t);
  disc(g, 40, 26, 5, 'bone');
  disc(g, 42, 25, 4, 'navy');
  grad(g, 46, BOT, ['ocean', 'abyss']);
  // Letters that came back, floating.
  for (let i = 0; i < 18; i++) {
    const y = 48 + Math.floor(Math.pow(hh(i, 132), 1.4) * 40);
    const x = Math.floor(mod(hh(i, 133) * W + t * 0.04, W));
    const bob = Math.round(Math.sin(t / 30 + i) * 1);
    const s = y > 70 ? 2 : 1;
    g.rect(x, y + bob, 4 * s, 3 * s, 'paper');
    g.rect(x + s, y + bob + s, 2 * s, 1, 'siltdk');
  }
};

const wreck: Bg = (g, t) => {
  g.rect(0, TOP, W, BOT - TOP, 'abyss');
  // Ribs of the hull, growing smaller toward the bow.
  for (let i = 3; i >= 0; i--) {
    const rx = 40 + i * 22, ry = 30 + i * 8;
    ellipse(g, 96, 66, rx, ry, i % 2 ? 'algae' : 'teal', Math.PI, Math.PI * 2);
    ellipse(g, 96, 66, rx - 1, ry - 1, 'abyss', Math.PI, Math.PI * 2);
  }
  // Panels of lights still running a check nobody reads.
  for (let x = 30; x < 162; x += 3) {
    const k = Math.floor(t / 12 + hh(x, 141) * 20);
    const c = hh(x, k) < 0.15 ? 'gold' : hh(x, k + 1) < 0.3 ? 'mint' : 'pine';
    g.rect(x, 50, 2, 1, c);
  }
  const level = 66 + Math.round(Math.sin(t / 45) * 1.5);
  g.rect(0, level, W, BOT - level, 'ocean');
  g.dither(0, level, W, 2, 'sea', 0.5);
  for (let x = mod(-t / 3, 12); x < W; x += 12) g.rect(Math.round(x), level, 4, 1, 'ice');
  fall(g, 143, 5, TOP, level, 0.9, 0, ['teal'], t, 1, 2);
};

const yard: Bg = (g, t) => {
  grad(g, TOP, 56, ['abyss', 'steel', 'slate']);
  // Beams going up from the far end, one for each delivery.
  for (let i = 0; i < 5; i++) {
    const x = 120 + i * 14 + Math.round(Math.sin(t / 50 + i) * 1);
    const lv = 0.25 + 0.25 * Math.sin(t / 20 + i * 2);
    g.dither(x, TOP, 3, 45, 'paper', lv);
  }
  // Chains with hooks stamped RETURN TO SENDER.
  for (let i = 0; i < 7; i++) {
    const x = 10 + i * 27, len = 10 + Math.floor(hh(i, 151) * 14);
    for (let y = TOP; y < TOP + len; y += 2) g.rect(x, y, 1, 1, 'grey');
    g.rect(x, TOP + len, 3, 1, 'grey'); g.rect(x + 2, TOP + len - 2, 1, 2, 'grey');
  }
  // Belts of crates moving toward the beams.
  for (const [y, sp] of [[44, 0.5], [52, 0.35]] as const) {
    g.rect(0, y, W, 2, 'ink');
    for (let x = mod(t * sp, 24) - 24; x < W; x += 24) {
      g.rect(Math.round(x), y - 5, 8, 5, 'tan');
      g.rect(Math.round(x) + 2, y - 3, 4, 1, 'brown');
    }
  }
  floor(g, 56, 'steel', 'slate', t, 0.004, 9);
};

const engine: Bg = (g, t) => {
  grad(g, TOP, BOT, ['abyss', 'navy', 'abyss']);
  // The column of the Return, pulling everything up.
  const pulse = Math.sin(t / 15) * 2;
  for (let y = TOP; y < 66; y++) {
    const hw = 12 + pulse + Math.sin(y / 5 + t / 10);
    g.dither(96 - hw - 4, y, 4, 1, 'sky', 0.25);
    g.dither(96 - hw, y, hw * 2, 1, 'paper', 0.5);
    g.dither(96 + hw, y, 4, 1, 'sky', 0.25);
  }
  for (let k = 0; k < 4; k++) {
    const p = mod(t / 90 + k / 4, 1);
    ellipse(g, 96, 66, 16 + p * 80, 4 + p * 20, p < 0.5 ? 'sky' : 'slate');
  }
  fall(g, 161, 26, TOP, 66, -0.8, 0, ['paper', 'plea', 'white'], t, 1, 2);
  for (let i = 0; i < 26; i++) {
    const x = 96 - 10 + Math.floor(hh(i, 162) * 20);
    const y = TOP + mod(hh(i, 163) * 55 - t * 0.8 * (0.6 + hh(i, 164) * 0.8), 55);
    g.rect(x, Math.round(y), 2, 1, i % 3 ? 'paper' : 'plea');
  }
  floor(g, 66, 'abyss', 'navy', t, 0, 10);
};

const amen: Bg = (g, t) => {
  g.rect(0, TOP, W, BOT - TOP, 'paper');
  // Ruled letter paper with closings written down it, all of them his.
  const scroll = Math.floor(t / 20);
  for (let y = TOP + 9 - (scroll % 10); y < BOT; y += 10) g.rect(0, y, W, 1, 'bone');
  g.rect(14, TOP, 1, BOT - TOP, 'pink');
  const words = ['Sincerely', 'Regards', 'Yours', 'Amen', 'Respectfully', 'Kindly', 'With thanks', 'Faithfully', 'Amen'];
  for (let i = 0; i < 10; i++) {
    const line0 = i + Math.floor(scroll / 10);
    const y = TOP + 9 + i * 10 - (scroll % 10) - 8;
    if (y < TOP || y > BOT - 9 || hh(line0, 174) < 0.3) continue;
    const w = words[Math.floor(hh(line0, 171) * words.length)];
    g.text(w + ',', 20 + Math.floor(hh(line0, 172) * 120), y, hh(line0, 173) < 0.15 ? 'silt' : 'bone');
  }
};

const fallback = (stops: string[]): Bg => (g, t) => {
  grad(g, TOP, 56, ['abyss', ...stops]);
  stars(g, 181, 20, TOP, 50, ['paper'], t);
  floor(g, 56, stops[stops.length - 1], 'ink', t, 0, 9);
};

export const BGS: Record<string, Bg> = {
  lowmost, shallows, shaft, deep, maw, waiting, docket, cloister, vault, encore, tower, bedtime,
  jackpot, arena, house, treeline, wood, hush, foot, climb, catch: catchBg, sea, deadletter, wreck, yard, engine, amen,
};

const BY_MAP: Record<string, string> = {
  lowmost: 'lowmost', shallows: 'shallows', shaft1: 'shaft', shaft2: 'deep', waiting: 'waiting', docket: 'docket',
  cloister: 'cloister', vault: 'vault', encore: 'encore', tower: 'tower', jackpot: 'jackpot', arena: 'arena',
  wood_edge: 'treeline', wood: 'wood', wood_heart: 'foot', line1: 'climb', catch: 'catch', shore: 'sea', sea: 'sea',
  wreck: 'wreck', returnyard: 'yard', engine: 'engine',
};

const BY_CHAPTER = ['shallows', 'shallows', 'waiting', 'docket', 'encore', 'jackpot', 'wood', 'climb', 'sea', 'yard'];

export function battleBg(map: MapDef | undefined, scene?: string): Bg {
  const key = scene ?? map?.battleScene ?? (map ? BY_MAP[map.id] ?? BY_CHAPTER[map.chapter] : undefined);
  if (key && BGS[key]) return BGS[key];
  return fallback(map?.battleBg ?? ['dusk', 'navy']);
}
