// Prise: a deduction game played at the grotto. In a bed of clams, each holds 1, 2, or 3 pearls, or is cracked.
// Row and column hints give each line's total and its cracks. Flip every 2 and 3 to clear the board.
// The thumb feels one panel per board without flipping it.
import { sfx } from '../../engine/audio';
import { text, textCenter, textRight, textWidth } from '../../engine/font';
import { input } from '../../engine/input';
import { music } from '../../engine/music';
import { ctx, frame, mix, rect, INK } from '../../engine/screen';
import { close, run, type Mode } from '../modes';
import { G, save } from '../state';
import { BADC, DIM, GOOD, PAPER, SEL, WARN } from '../ui';

const N = 5;
const NICK = 0;
type Cell = { v: number; open: boolean; mark: number; felt: boolean; at: number };

/** Twos, threes, and nicks on a board of this level. */
function mix3(level: number): [number, number, number] {
  return [2 + Math.floor(level / 2), 1 + Math.floor((level - 1) / 2), Math.min(12, 5 + level)];
}

function deal(level: number, rnd: () => number): Cell[] {
  const [twos, threes, nicks] = mix3(level);
  const vals: number[] = [];
  for (let i = 0; i < twos; i++) vals.push(2);
  for (let i = 0; i < threes; i++) vals.push(3);
  for (let i = 0; i < nicks; i++) vals.push(NICK);
  while (vals.length < N * N) vals.push(1);
  for (let i = vals.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [vals[i], vals[j]] = [vals[j], vals[i]]; }
  return vals.map(v => ({ v, open: false, mark: 0, felt: false, at: -99 }));
}

const MARKS = ['', '1', '2', '3', 'x'];

// ---------------------------------------------------------------- art

/** The board: 22 pixel steps of 20 pixel hollows, with the row hints to its right and the column hints below. */
const S = 22, T = 20, OX = 10, OY = 19;
/** The right-hand column: what this board pays, the thumb, the shells left, and the day's takings. */
const INFO_X = 152;
/** A shell is 19 by 16 and sits low in its hollow. */
const SW = 19, SH = 16;
/** Frames for a shell to flip open, and for the board to shake on a crack. */
const FLIP = 8, SHAKE = 12;
const GOLD = '#c8a060', GOLD_DIM = '#7a6440', NIGHT = '#0e1520';

/** The scallop's outline as rows of '.', 'o' (rim), 'b' (body), 'g' (groove), and 'e' (the ears at the hinge). Light comes later. */
function scallop(): string[] {
  const hx = (SW - 1) / 2, hy = SH - 1.5, A = 1.2, ribs = 7;
  const inside = (x: number, y: number): number => {
    const dx = x - hx, dy = hy - y, r = Math.hypot(dx, dy), a = Math.atan2(dx, dy);
    if (y >= SH - 3 && Math.abs(dx) <= 4.5) return 2;
    if (Math.abs(a) > A || r < 1.5) return 0;
    const rim = 13.2 - 1.6 * Math.abs(a) + 0.7 * Math.abs(Math.cos(a * ribs * 1.5));
    return r <= rim ? 1 : 0;
  };
  const rows: string[] = [];
  for (let y = 0; y < SH; y++) {
    let row = '';
    for (let x = 0; x < SW; x++) {
      const k = inside(x, y);
      if (!k) { row += '.'; continue; }
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([u, v]) => !inside(x + u, y + v));
      if (edge) { row += 'o'; continue; }
      if (k === 2) { row += 'e'; continue; }
      const dx = x - hx, dy = hy - y, a = Math.atan2(dx, dy), f = ((a + 1.2) / 2.4 * ribs) % 1;
      row += f < 0.22 ? 'g' : 'b';
    }
    rows.push(row);
  }
  return rows;
}

/**
 * The closed shell, the opened shell's nacre, and a cracked shell, each in hard tones: 'l' lit and 'd' shaded body, 'r' a
 * lit rim, 'D' a shaded groove.
 */
const LOOKS: Record<string, Record<string, string>> = {
  shut: { o: '#3e2e22', r: '#c49e72', b: '#a8865f', g: '#7d6247', l: '#d8bb90', d: '#86684a', D: '#5e4834', e: '#8d6f50' },
  open: { o: '#8f8270', r: '#f6efe0', b: '#ece2cf', g: '#d6c9b1', l: '#fbf6ec', d: '#d2c5ad', D: '#b9ab92', e: '#c8b99c' },
  crack: { o: '#22121a', r: '#5e3a40', b: '#4a2a30', g: '#3a2126', l: '#5e3a40', d: '#3a2126', D: '#2a171c', e: '#3a2126' },
};

/** The moon, which lights every shell and sets where its shadow falls. */
const MOON_X = 166, MOON_Y = 24;
/** The light's direction toward the moon from a point, turned to one of a few cached headings: x right, y down, z up off the bed. */
function moonward(x: number, y: number): { k: number; lx: number; ly: number; lz: number } {
  const step = Math.PI / 16, a = Math.round(Math.atan2(MOON_Y - y, MOON_X - x) / step) * step;
  const lz = 0.75, flat = Math.sqrt(1 - lz * lz);
  return { k: Math.round(a / step), lx: Math.cos(a) * flat, ly: Math.sin(a) * flat, lz };
}

/** The shell's tones under light from one heading: each pixel is lit or shaded by how its domed surface faces the moon. */
function litRows(rows: string[], lx: number, ly: number, lz: number): string[] {
  const cx = (SW - 1) / 2, cy = SH / 2 - 1, rx = SW / 2, ry = SH / 2 + 1;
  return rows.map((row, y) => [...row].map((ch, x) => {
    if (ch === '.' || ch === 'e') return ch;
    const nx = (x - cx) / rx, ny = (y - cy) / ry, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const i = nx * lx + ny * ly + nz * lz;
    if (ch === 'o') return i > 0.55 ? 'r' : 'o';
    if (ch === 'g') return i < 0.45 ? 'D' : 'g';
    return i > 0.85 ? 'l' : i < 0.45 ? 'd' : 'b';
  }).join(''));
}

const art = new Map<string, HTMLCanvasElement>();
/** A cached canvas, painted once by `paint` the first time it is asked for. */
function cached(key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  let cv = art.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  paint(cv.getContext('2d')!);
  art.set(key, cv);
  return cv;
}
/** A cached canvas of rows drawn in a palette. */
function bitmap(key: string, rows: string[], pal: Record<string, string>): HTMLCanvasElement {
  return cached(key, rows[0].length, rows.length, g => rows.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } })));
}

let shape: string[] | null = null;
/** A clam's shadow: a short hard silhouette on the bed, on the side away from the moon. Every shadow goes down before any clam. */
function shellShadow(px: number, py: number, w = 1): void {
  shape ||= scallop();
  const L = moonward(px + T / 2, py + T / 2);
  const dw = Math.max(1, Math.round(SW * w)), x0 = Math.round(px + (T - dw) / 2);
  ctx.drawImage(bitmap('shadow', shape, { o: '#100e15', b: '#100e15', g: '#100e15', e: '#100e15' }), x0 + Math.round(-L.lx * 2.6), py + 3 + Math.round(-L.ly * 2.6), dw, SH);
}

/** Draws a shell look in a hollow whose top left is px, py, lit from the moon, squashed to `w` of its width while it flips. */
function shell(look: 'shut' | 'open' | 'crack', px: number, py: number, w = 1): void {
  shape ||= scallop();
  const L = moonward(px + T / 2, py + T / 2);
  const dw = Math.max(1, Math.round(SW * w));
  ctx.drawImage(bitmap(`${look}${L.k}`, litRows(shape, L.lx, L.ly, L.lz), LOOKS[look]), Math.round(px + (T - dw) / 2), py + 3, dw, SH);
}

/** Pearls: a dull one for 1, white ones for 2, and gold ones for 3, each lit on the side toward the moon. */
const PEARL = ['.ooo.', 'obbho', 'obbbo', 'osbbo', '.ooo.'];
const PEARLS: Record<number, Record<string, string>> = {
  1: { o: '#8a8375', b: '#bdb6a8', h: '#ddd6c8', s: '#a59e90' },
  2: { o: '#7e7a96', b: '#e8e6f8', h: '#ffffff', s: '#c4c0dc' },
  3: { o: '#8a6a1c', b: '#f2c95a', h: '#fff3c0', s: '#d4a838' },
};
const pearl = (v: number, x: number, y: number) => ctx.drawImage(bitmap(`pearl${v}`, PEARL, PEARLS[v]), x, y);
const PIPS: Record<number, [number, number][]> = { 1: [[8, 8]], 2: [[5, 8], [10, 8]], 3: [[8, 5], [5, 10], [10, 10]] };

/** A crack: a jagged line, 4 wide and 5 tall. */
function crackMark(x: number, y: number, c: string): void {
  for (const [i, j] of [[3, 0], [2, 1], [1, 2], [2, 2], [1, 3], [0, 4]]) rect(x + i, y + j, 1, 1, c);
}

const hash = (n: number) => { const s = Math.sin(n * 91.7) * 43758.5453; return s - Math.floor(s); };

/** An ordered 4 by 4 threshold, so every blend between two colors is a dither pattern and never a soft mix. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
/** The sky's bands, darkest at the top, and the moon's two halo rings. */
const SKY = [NIGHT, '#121b28', '#172231', '#1c283a'];
const HALO = ['#222e42', '#2c3a52'];

/**
 * The night over the tide pool: the sky in hard bands that meet in a short dithered seam, the moon in hard tones with a
 * dithered halo, and the pool along the bottom.
 */
function backdrop(): HTMLCanvasElement {
  return cached('night', 192, 192, g => {
    for (let y = 0; y < 192; y++) for (let x = 0; x < 192; x++) {
      const th = bayer(x, y);
      // A band holds its color until its last few rows, which dither into the next one.
      const f = Math.min(SKY.length - 1.001, y / 162 * (SKY.length - 1)), i = Math.floor(f), seam = (f - i - 0.8) / 0.2;
      let c = seam > th ? SKY[i + 1] : SKY[i];
      // The halo: a solid inner ring, then an outer ring that thins out through the dither.
      const d = Math.hypot(x - 166, y - 24), h = 2.6 * (1 - (d - 7) / 26);
      if (d > 6 && h > 0) c = h >= 2 ? HALO[1] : h >= 1 ? ((h - 1) > th ? HALO[1] : HALO[0]) : (h > th ? HALO[0] : c);
      if (y >= 162) c = y >= 164 || th < 0.5 ? '#0a1520' : c;
      g.fillStyle = c; g.fillRect(x, y, 1, 1);
    }
    // The moon in three hard tones: a lit crescent, its face, and a rim.
    for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
      const d = Math.hypot(x, y);
      if (d <= 6) { g.fillStyle = d > 5.2 ? '#a8a490' : x + y < -2 ? '#f4f0dc' : '#d8d2b8'; g.fillRect(166 + x, 24 + y, 1, 1); }
    }
    for (let i = 0; i < 26; i++) { g.fillStyle = i % 4 ? '#5a6478' : '#9aa4b8'; g.fillRect(Math.floor(hash(i) * 190), Math.floor(hash(i + 50) * 150), 1, 1); }
  });
}

/** The bed the clams sit in: a slab in a thin gold frame, each clam in its own hollow. */
function clamBed(): HTMLCanvasElement {
  const w = N * S + 4, h = N * S + 4;
  return cached('slab', w, h, g => {
    g.fillStyle = GOLD_DIM; g.fillRect(0, 0, w, h);
    g.fillStyle = GOLD; g.fillRect(1, 1, w - 2, 1); g.fillRect(1, 1, 1, h - 2);
    g.fillStyle = '#1d1b24'; g.fillRect(2, 2, w - 4, h - 4);
    for (let i = 0; i < 90; i++) { g.fillStyle = i % 3 ? '#26232e' : '#17151d'; g.fillRect(2 + Math.floor(hash(i * 3) * (w - 4)), 2 + Math.floor(hash(i * 7) * (h - 4)), 1, 1); }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const px = 3 + x * S, py = 3 + y * S;
      g.fillStyle = '#2a2833'; g.fillRect(px, py, T, T);
      g.fillStyle = '#15131b'; g.fillRect(px, py, T, 1); g.fillRect(px, py, 1, T);
      g.fillStyle = '#34313e'; g.fillRect(px + 1, py + T - 1, T - 1, 1); g.fillRect(px + T - 1, py + 1, 1, T - 1);
    }
  });
}

/** Plays boards until the player stops. Pays cowries for each cleared board, and now and then nacre on the hardest ones. */
export function scrape(): Promise<void> {
  let seed = (G.time * 2654435761 + 97) >>> 0;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  let level = G.flags.scrapeLevel || 1;
  let board = deal(level, rnd);
  let score = 1, flips = 0, cx = 2, cy = 2, thumb = true, t = 0, shook = -99;
  let phase: 'play' | 'menu' | 'lost' | 'won' = 'play';
  let menuI = 0, banner = '', earnedRind = 0, earnedTan = 0;
  const at = (x: number, y: number) => board[y * N + x];
  const needed = () => board.filter(c => c.v >= 2 && !c.open).length;
  music.play('minigame');

  const newBoard = () => { board = deal(level, rnd); score = 1; flips = 0; thumb = true; phase = 'play'; banner = ''; };
  // The rest of the board turns over in a quick ripple from the shell that ended it.
  const reveal = (fx: number, fy: number) => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const c = at(x, y); if (!c.open) { c.open = true; c.at = t + 3 * (Math.abs(x - fx) + Math.abs(y - fy)); } } };

  const m: Mode = {
    opaque: true,
    update() {
      t++;
      if (phase === 'lost' || phase === 'won') {
        if (input.hit('ok')) { newBoard(); sfx('ok'); }
        if (input.hit('back')) { sfx('back'); finish(); }
        return;
      }
      if (phase === 'menu') {
        const opts = menuOpts();
        if (input.hit('up')) menuI = (menuI + opts.length - 1) % opts.length;
        if (input.hit('down')) menuI = (menuI + 1) % opts.length;
        if (input.hit('back')) { phase = 'play'; sfx('back'); }
        if (input.hit('ok')) {
          const k = opts[menuI];
          phase = 'play';
          const c = at(cx, cy);
          if (k === 'Feel with thumb' && thumb && !c.open) { thumb = false; c.felt = true; sfx(c.v === NICK ? 'pegFail' : 'blip'); }
          else if (k.startsWith('Mark')) { c.mark = (c.mark + 1) % MARKS.length; sfx('move'); }
          else if (k === 'Stop for today') finish();
        }
        return;
      }
      if (input.hit('left')) { cx = (cx + N - 1) % N; sfx('move'); }
      if (input.hit('right')) { cx = (cx + 1) % N; sfx('move'); }
      if (input.hit('up')) { cy = (cy + N - 1) % N; sfx('move'); }
      if (input.hit('down')) { cy = (cy + 1) % N; sfx('move'); }
      if (input.hit('back')) { phase = 'menu'; menuI = 0; sfx('ok'); return; }
      if (input.hit('ok')) {
        const c = at(cx, cy);
        if (c.open) return;
        c.open = true;
        c.at = t;
        flips++;
        if (c.v === NICK) {
          sfx('hitBig');
          phase = 'lost';
          shook = t;
          banner = 'This one is cracked. The entire bed is corrupted.';
          reveal(cx, cy);
          level = Math.max(1, Math.min(level, flips - 1));
          G.flags.scrapeLevel = level;
          save();
          return;
        }
        score *= c.v;
        sfx(c.v >= 2 ? 'nerve' : 'blip');
        if (needed() === 0) {
          // Nacre is a rare find from level 5, 8% a clean board there and 4 points more each level up to 20% at 8, so boards cannot be farmed for it.
          const rind = score * 4 * level, tan = level >= 5 && rnd() < 0.04 * (level - 3) ? 1 : 0;
          G.rind += rind; G.tan += tan;
          earnedRind += rind; earnedTan += tan;
          banner = `Clean. ${rind} cowries${tan ? ` and ${tan} nacre` : ''}.`;
          sfx('level');
          phase = 'won';
          reveal(cx, cy);
          level = Math.min(8, level + 1);
          G.flags.scrapeLevel = level;
          G.flags.scrapeBest = Math.max(G.flags.scrapeBest || 0, level);
          save();
        }
      }
    },
    draw() {
      ctx.drawImage(backdrop(), 0, 0);
      // Small waves cross the pool at the bottom, and a few stars blink.
      for (let i = 0; i < 6; i++) { const wx = Math.floor((t * (0.3 + i * 0.07) + hash(i + 9) * 192) % 200) - 8; rect(wx, 165 + i * 2, 6 + (i % 3) * 3, 1, '#1e3446'); }
      for (let i = 0; i < 4; i++) if ((t + i * 37) % 90 < 6) rect(Math.floor(hash(i + 3) * 190), Math.floor(hash(i + 70) * 14), 1, 1, '#ffffff');
      const playing = phase === 'play' || phase === 'menu';

      text('Prise', 8, 6, GOLD);
      text(`Level ${level}`, 8 + textWidth('Prise') + 5, 6, DIM);

      // The bed shakes for a moment when a cracked clam splits.
      const shake = t - shook < SHAKE ? Math.round(Math.sin((t - shook) * 2.3) * 2 * (1 - (t - shook) / SHAKE)) : 0;
      const ox = OX + shake, oy = OY;
      ctx.drawImage(clamBed(), ox - 3, oy - 3);
      // Gold markers on the frame point along the cursor's row and column, toward the two hints that belong to it.
      if (playing) {
        const ry = oy + cy * S + T / 2, rx = ox + cx * S + T / 2;
        for (let k = 0; k < 3; k++) { rect(ox - 7 + k, ry - 2 + k, 1, 5 - 2 * k, SEL); rect(rx - 2 + k, oy - 7 + k, 5 - 2 * k, 1, SEL); }
      }
      // How far through its flip each shell is, and how wide it shows: shadows first, then shells over them.
      const turn = (c: Cell) => { const k = c.open ? (t - c.at) / FLIP : 1; return { k, w: !c.open ? 1 : k < 0.5 ? 1 - 2 * Math.max(0, k) : Math.min(1, 2 * k - 1) }; };
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) shellShadow(ox + x * S, oy + y * S, turn(at(x, y)).w);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const c = at(x, y), px = ox + x * S, py = oy + y * S;
        const { k } = turn(c);
        if (!c.open || k < 0.5) {
          // Still shut, or the first half of a flip: the shell narrows as it turns over.
          shell('shut', px, py, c.open ? 1 - 2 * Math.max(0, k) : 1);
          if (!c.open && c.felt) {
            // The thumb's reading sits in the hollow's top right: a smooth ring, or a rough notch.
            if (c.v === NICK) crackMark(px + 14, py + 1, BADC);
            else { rect(px + 15, py + 1, 2, 1, GOOD); rect(px + 15, py + 4, 2, 1, GOOD); rect(px + 14, py + 2, 1, 2, GOOD); rect(px + 17, py + 2, 1, 2, GOOD); }
          }
          if (!c.open && c.mark) text(MARKS[c.mark], px + 2, py + 1, '#e8e2d0', INK);
        } else {
          const w = Math.min(1, 2 * k - 1);
          if (c.v === NICK) {
            shell('crack', px, py, w);
            if (w >= 1) { crackMark(px + 7, py + 7, BADC); crackMark(px + 9, py + 10, '#ff8a7a'); }
          } else {
            shell('open', px, py, w);
            if (w >= 1) for (const [dx, dy] of PIPS[c.v]) pearl(c.v, px + dx, py + dy);
            // A cleared board sparkles over its good shells.
            if (phase === 'won' && c.v >= 2 && (t + x * 7 + y * 13) % 40 < 4) rect(px + 4 + ((x * 5 + y * 3) % 12), py + 5, 1, 1, '#ffffff');
          }
        }
        if (playing && x === cx && y === cy) {
          // The cursor: corner brackets that breathe on a slow beat.
          const c2 = (t >> 4) % 2 ? SEL : '#fff0b0', e = T - 1;
          for (const [qx, qy, dx, dy] of [[0, 0, 1, 1], [e, 0, -1, 1], [0, e, 1, -1], [e, e, -1, -1]] as const) {
            rect(px + qx + (dx < 0 ? -3 : 0), py + qy, 4, 1, c2);
            rect(px + qx, py + qy + (dy < 0 ? -3 : 0), 1, 4, c2);
          }
        }
      }

      // Hints float beside the bed: each line's total over its crack count. The cursor's lines read in gold.
      for (let i = 0; i < N; i++) {
        let rs = 0, rn = 0, cs = 0, cn = 0;
        for (let k = 0; k < N; k++) { const r = at(k, i), c = at(i, k); rs += r.v; rn += r.v === NICK ? 1 : 0; cs += c.v; cn += c.v === NICK ? 1 : 0; }
        const rowOn = playing && i === cy, colOn = playing && i === cx;
        const hx = OX + N * S + 4, hy = oy + i * S;
        textRight(String(rs), hx + 22, hy + 2, rowOn ? SEL : PAPER);
        crackMark(hx + 4, hy + 12, rn ? BADC : '#3e4252');
        textRight(String(rn), hx + 22, hy + 11, rn ? BADC : '#4a5062');
        const vx = OX + i * S, vy = oy + N * S + 4;
        textCenter(String(cs), vx + 10, vy, colOn ? SEL : PAPER);
        crackMark(vx + 4, vy + 11, cn ? BADC : '#3e4252');
        textRight(String(cn), vx + 17, vy + 9, cn ? BADC : '#4a5062');
      }

      // The info column: what this board pays so far, the thumb, the good shells still hidden, and the day's takings.
      rect(INFO_X - 4, 40, 1, 96, '#232a38');
      const label = (s: string, y: number) => text(s, INFO_X, y, DIM);
      label('Pays', 40);
      pearl(3, INFO_X, 50); text(`x${score}`, INFO_X + 8, 49, score > 1 ? GOOD : PAPER);
      label('Thumb', 64);
      text(thumb ? 'ready' : 'used', INFO_X, 73, thumb ? PAPER : DIM);
      label('To find', 88);
      pearl(2, INFO_X, 98); text(String(needed()), INFO_X + 8, 97, PAPER);
      if (earnedRind) { label('Today', 112); text(`${earnedRind}c`, INFO_X, 121, WARN); if (earnedTan) text(`${earnedTan}n`, INFO_X, 130, WARN); }

      // The result of a board, over the pool, and the keys along the bottom.
      if (banner) textCenter(banner, 96, 154, phase === 'won' ? GOOD : BADC, INK);
      rect(0, 176, 192, 16, '#090d14');
      rect(0, 176, 192, 1, '#232a38');
      const keys = banner ? [['Z', 'Next board'], ['X', 'Stop']] : [['Z', 'Prise'], ['X', 'Mark, thumb, stop']];
      let kx = 8;
      for (const [k, s] of keys) { text(k, kx, 181, GOLD); text(s, kx + 8, 181, PAPER); kx += 8 + textWidth(s) + 14; }

      if (phase === 'menu') {
        const opts = menuOpts(), mx = 98, my = 56, mh = 9 + opts.length * 10;
        frame(mx - 1, my - 1, 92, mh + 2, '#0a0c12', GOLD_DIM);
        frame(mx, my, 90, mh, '#15161f', GOLD);
        opts.forEach((o, i) => {
          if (i === menuI) rect(mx + 2, my + 3 + i * 10, 86, 10, mix(GOLD, '#15161f', 0.75));
          text(o, mx + 6, my + 4 + i * 10, i === menuI ? SEL : PAPER);
        });
      }
    },
  };
  // X opens on marking, the action used most, with the thumb second while it is still unused.
  const menuOpts = () => [`Mark: ${MARKS[(at(cx, cy).mark + 1) % MARKS.length] || 'clear'}`, ...(thumb && !at(cx, cy).open ? ['Feel with thumb'] : []), 'Stop for today'];
  const finish = () => close(m);
  return run(m);
}
