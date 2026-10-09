// Set pieces bigger than a tile, drawn over the map at whole-pixel positions on the field's 1x grid.
// Each prop is a painter keyed by name. Maps place them with MapDef.props.
import { ctx, rect, INK } from '../engine/screen';
import { text } from '../engine/font';
import { G } from './state';
import { field } from './field';

export interface PropPainter {
  /** Size in tiles, for placement checks and for the validator. */
  w: number;
  h: number;
  /** Paints the prop with its top left at x, y in screen pixels. t is the frame counter. */
  paint(x: number, y: number, t: number): void;
}

export const PROPS: Record<string, PropPainter> = {};

export function defProp(name: string, p: PropPainter): void { PROPS[name] = p; }

/** Draws a prop by name. An unknown name draws a plain marked box, so a missing painter shows instead of hiding. */
export function drawProp(name: string, x: number, y: number, t: number): void {
  const p = PROPS[name];
  if (p) { p.paint(x, y, t); return; }
  rect(x, y, 16, 16, '#3a3442');
  rect(x + 1, y + 1, 14, 14, INK);
  text('?', x + 5, y + 4, '#e0b040');
}

// ---------------------------------------------------------------- painting helpers

/** The target and offset the helpers draw into: a cached still picture, or the screen for the moving parts. */
let T: CanvasRenderingContext2D = ctx;
let OX = 0, OY = 0;
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function R(x: number, y: number, w: number, h: number, c: string): void {
  T.fillStyle = c;
  T.fillRect(OX + Math.round(x), OY + Math.round(y), Math.round(w), Math.round(h));
}
function P(x: number, y: number, c: string): void { R(x, y, 1, 1, c); }
/** Ordered dither anchored to the prop's own corner, which always sits on the world's 8 pixel grid. */
function D(x: number, y: number, w: number, h: number, c: string, lv: number): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (BAY[(j & 3) * 4 + (i & 3)] < lv * 16) P(i, j, c);
}
const on = (x: number, y: number, lv: number) => BAY[(y & 3) * 4 + (x & 3)] < lv * 16;
/** Calls f for every pixel inside an ellipse, with how far out from the center it is (0 to 1). */
function ell(cx: number, cy: number, rx: number, ry: number, f: (x: number, y: number, d: number) => void): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    if (d <= 1) f(x, y, d);
  }
}
function fill(cx: number, cy: number, rx: number, ry: number, c: string): void { ell(cx, cy, rx, ry, (x, y) => P(x, y, c)); }
function pic(rows: string[], x: number, y: number, pal: Record<string, string>, flip = false): void {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = pal[row[i]];
      if (c) P(x + (flip ? row.length - 1 - i : i), y + j, c);
    }
  });
}
function line(x0: number, y0: number, x1: number, y1: number, c: string): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) P(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c);
}

const stills = new Map<string, HTMLCanvasElement>();
/** The still part of a prop, painted once into its own canvas. */
function still(key: string, w: number, h: number, paint: () => void): HTMLCanvasElement {
  let cv = stills.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const prev = T, px = OX, py = OY;
    T = cv.getContext('2d')!; OX = 0; OY = 0;
    paint();
    T = prev; OX = px; OY = py;
    stills.set(key, cv);
  }
  return cv;
}
/** Points the helpers at the screen, so the moving part of a prop draws over its still part. */
function live(x: number, y: number): void { T = ctx; OX = x; OY = y; }
function blit(cv: HTMLCanvasElement, x: number, y: number): void { ctx.drawImage(cv, Math.round(x), Math.round(y)); }

/** A number that stays the same for a prop at one place on the map, for props that come in several looks. */
function placeHash(x: number, y: number): number {
  const tx = Math.round((x + field.cam[0]) / 8), ty = Math.round((y + field.cam[1]) / 8);
  let h = (tx * 374761393 + ty * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// ---------------------------------------------------------------- colors

/** Night sand and sea, as in the Strand's tiles. */
const SAND = ['#a49ecb', '#7e78a8', '#5c5688', '#3e3a66'];
const WET = '#545894';
const GOLD = ['#fff6c8', '#ffd04a', '#c88a2a'];
const PEARL = '#f4f0ff';
/** The Gleaner is a cast: chalk pale, shaded toward violet. */
const CAST = ['#fbf8f4', '#e8e0e2', '#c8bccc', '#9a8cac', '#62567a'];
const NAIL = ['#f4c8cc', '#d88a9a'];
const DRIFT = ['#d4c8bc', '#a89a8e', '#76685e', '#4a3e38'];
const WHITE = ['#ffffff', '#e2e0f0', '#b4b0cc'];
const PINK = ['#fff0ec', '#ffd6c4', '#f6b2c4', '#e494ac', '#c06a8a', '#8a2a56', '#3a0c26'];

/** A shadow cast on sand under a prop: dithered dark, never translucent. */
function shadow(cx: number, cy: number, rx: number, ry: number): void {
  ell(cx, cy, rx, ry, (x, y, d) => { if (on(x, y, d < 0.6 ? 0.5 : 0.25)) P(x, y, SAND[3]); });
}

/** A white slot post, as the Gleaner leaves them: square, too clean, and joined by nothing. */
function post(x: number, y: number, h: number): void {
  D(x + 2, y + h - 1, 3, 2, SAND[3], 0.5);
  R(x, y, 2, h, WHITE[0]); R(x + 2, y, 1, h, WHITE[1]);
  P(x + 2, y, WHITE[0]); R(x, y + h - 1, 3, 1, WHITE[2]);
}

/** A strip of driftwood with capitals pressed into it that lean and grow toward the end. */
function label(x: number, y: number, w: number): void {
  R(x, y, w, 5, DRIFT[1]); R(x, y, w, 1, DRIFT[0]); R(x, y + 4, w, 1, DRIFT[2]);
  for (let i = 0, lx = x + 1; lx < x + w - 1; i++) {
    const hgt = Math.min(3, 1 + (i >> 1));
    line(lx, y + 4 - hgt, lx + (i > 2 ? 1 : 0), y + 3, DRIFT[3]);
    lx += i > 3 ? 3 : 2;
  }
}

// ---------------------------------------------------------------- the Volute and the beach

defProp('voluteShell', {
  w: 6, h: 4,
  paint(x, y) {
    const released = !!G.flags.endRelease;
    blit(still('volute' + (released ? 'R' : 'H'), 48, 32, () => {
      // A volute lying on its side in the sand: the canal at the left, the body whorl, a stepped spire to the point.
      const cy = 16;
      const half = (X: number) => {
        const u = (X - 2) / 44;
        if (u < 0 || u > 1) return 0;
        return u < 0.36 ? 13 * Math.pow(Math.sin((u / 0.36) * Math.PI / 2), 0.7) : 13 * Math.pow(1 - (u - 0.36) / 0.64, 0.9);
      };
      shadow(26, 27, 22, 4);
      const tops: number[] = [];
      for (let X = 0; X < 48; X++) {
        const h = half(X);
        if (h < 0.6) { tops.push(99); continue; }
        const u = (X - 2) / 44;
        // Past the body whorl the spire steps down in whorls, each with its own rounded shoulder.
        const s = u > 0.42 ? ((X - 21) % 7 + 7) % 7 : -1;
        const top = Math.round(cy - h + (s >= 0 ? Math.abs(s - 3) * 0.5 : 0)), bot = Math.round(cy + h * 0.72);
        tops.push(top);
        for (let Y = top; Y <= bot; Y++) {
          const f = (Y - top) / Math.max(1, bot - top);
          let c = f < 0.12 ? '#fff8ec' : f < 0.55 ? '#ece0cc' : f < 0.8 ? '#c8b8a0' : '#9a8878';
          if (f > 0.55 && f < 0.8 && on(X, Y, 0.5)) c = '#ece0cc';
          if (f >= 0.8 && on(X, Y, 0.5)) c = '#6a5a58';
          if (s === 0 && f < 0.85) c = '#6a5a58';
          else if (s === 1 && f < 0.6) c = '#fff8ec';
          P(X, Y, c);
        }
      }
      // Tent markings: brown zigzags across the body whorl, the volute's own pattern.
      for (let band = 0; band < 3; band++) for (let X = 4; X < 30; X++) {
        const Y = 9 + band * 5 + Math.abs(((X + band * 3) % 8) - 4);
        if (Y > tops[X] + 1 && Y < cy + half(X) * 0.6) P(X, Y, '#8a5a4a');
      }
      // The long mouth along the underside, dark inside and pink at the lip.
      for (let X = 6; X < 26; X++) {
        const yy = Math.round(cy + half(X) * 0.72) - 2 - (X < 10 ? 10 - X : 0) * 0.2;
        P(X, yy - 1, '#ffb4a0'); P(X, yy, '#2a1a2a'); P(X, yy + 1, '#4a2a3a');
      }
      // The hole the star made, small and dark on the shell's side, with a burned gold rim.
      fill(29, 12, 1.6, 1.6, INK); P(28, 10, GOLD[1]); P(30, 10, GOLD[2]); P(31, 12, GOLD[2]);
      // The points of the Stays come through the shell. After the release, eight soft pink holes instead.
      const pts = [8, 13, 18, 22, 27, 32, 37, 41];
      for (const px of pts) {
        const top = Math.round(cy - half(px));
        if (released) { P(px, top + 1, '#ff8ab4'); P(px + 1, top + 1, '#ff8ab4'); P(px, top + 2, '#3a0c26'); }
        else { R(px, top - 2, 1, 3, INK); P(px, top - 3, INK); P(px + 1, top, INK); }
      }
      // Sand drifted against it.
      for (let X = 0; X < 48; X++) {
        const sy = 27 + Math.round(1.5 * Math.sin(X / 4)) + (X < 6 || X > 42 ? 1 : 0);
        R(X, sy, 1, 32 - sy, SAND[1]);
        P(X, sy, SAND[0]);
        if (on(X, sy + 1, 0.5)) P(X, sy + 1, SAND[2]);
      }
    }), x, y);
  },
});

defProp('whitePost', {
  w: 1, h: 2,
  paint(x, y) { blit(still('whitePost', 8, 16, () => { post(3, 2, 13); }), x, y); },
});

defProp('labelPost', {
  w: 1, h: 2,
  paint(x, y) {
    blit(still('labelPost', 8, 16, () => {
      D(4, 14, 4, 2, SAND[3], 0.5);
      R(3, 8, 2, 8, DRIFT[2]); P(3, 8, DRIFT[1]);
      label(0, 3, 8);
      P(0, 3, DRIFT[2]); P(7, 7, DRIFT[3]);
    }), x, y);
  },
});

defProp('bottle', {
  w: 1, h: 1,
  paint(x, y, t) {
    blit(still('bottle', 8, 8, () => {
      D(1, 6, 6, 2, SAND[3], 0.5);
      pic(['......k.', '.....gk.', '....gg..', '..gggg..', '.gwwgg..', 'gwwgg...', 'ggggs...', '.ss.....'], 0, 0,
        { g: '#3ec8a0', w: '#f4ecd8', k: '#6a4a2a', s: SAND[2] });
      P(2, 3, '#b8fff0');
    }), x, y);
    live(x, y);
    // A glint that slides up the glass now and then.
    const k = (t >> 3) % 24;
    if (k < 3) P(1 + k, 5 - k, '#ffffff');
  },
});

defProp('doves', {
  w: 3, h: 3,
  paint(x, y) {
    blit(still('doves', 24, 24, () => {
      // Five doves of shell stand in a ring, facing in, the way they sit inside a sand dollar.
      ell(12, 12, 4, 3, (px, py, d) => { if (on(px, py, d < 0.7 ? 0.25 : 0.125)) P(px, py, GOLD[2]); });
      const dove = ['.ww....', 'iwwwh..', '.hwwww.', '..wwwww', '...h.h.'];
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + k * Math.PI * 2 / 5;
        const dx = Math.round(12 + Math.cos(a) * 8 - 3.5), dy = Math.round(12 + Math.sin(a) * 7 - 2.5);
        D(dx + 1, dy + 4, 6, 2, SAND[3], 0.5);
        pic(dove, dx, dy, { w: '#f6f0e4', i: '#ffffff', h: '#c8bca8' }, Math.cos(a) < 0);
      }
    }), x, y);
  },
});

defProp('postShell', {
  w: 2, h: 2,
  paint(x, y) {
    blit(still('postShell', 16, 16, () => {
      // A whelk stood on end with letters waiting in its mouth.
      shadow(9, 14, 7, 2);
      pic([
        '.......a........',
        '......aba.......',
        '......bab.......',
        '.....abbba......',
        '.....babab......',
        '....abbbbba.....',
        '....bbabbbba....',
        '...abbbbabbba...',
        '...bbbbbbbbbba..',
        '..abbbbbbccbbb..',
        '..bbbbbbccccbb..',
        '..bbbabbccccbb..',
        '..dbbbbbccccbd..',
        '...dbbbbbccd....',
        '....ddddddd.....',
      ], 0, 0, { a: PINK[0], b: PINK[1], c: '#3a2030', d: PINK[3] });
      // A letter waiting in the mouth, flap and all.
      R(8, 10, 8, 5, '#fffaf0'); R(8, 14, 8, 1, '#b8b0cc');
      line(8, 10, 11, 12, '#b8b0cc'); line(15, 10, 12, 12, '#b8b0cc');
      P(14, 13, '#e8604a');
    }), x, y);
  },
});

// ---------------------------------------------------------------- the Gleaner

defProp('gleanerFoot', {
  w: 4, h: 3,
  paint(x, y) {
    blit(still('gleanerFoot', 32, 24, () => {
      // Wet sand pushed up round the edge.
      ell(16, 13, 15, 11, (px, py, d) => { if (d > 0.82) P(px, py, on(px, py, 0.5) ? WET : SAND[2]); });
      const body = (px: number, py: number) => {
        const sole = Math.hypot((px + 0.5 - 16) / 8.5, (py + 0.5 - 14) / 8) <= 1 || Math.hypot((px + 0.5 - 16) / 6.5, (py + 0.5 - 19) / 4.5) <= 1;
        return sole;
      };
      for (let py = 0; py < 24; py++) for (let px = 0; px < 32; px++) {
        if (!body(px, py)) continue;
        const edge = !body(px - 1, py) || !body(px + 1, py) || !body(px, py + 1);
        const top = !body(px, py - 1);
        P(px, py, top ? CAST[0] : edge ? CAST[3] : px > 19 ? (on(px, py, 0.5) ? CAST[2] : CAST[1]) : CAST[1]);
      }
      // Five short round toes, the biggest on the inside.
      const toes: [number, number, number][] = [[21, 5, 3], [16, 4, 2.4], [12, 5, 2.1], [9, 7, 1.9], [7, 10, 1.7]];
      for (const [tx, ty, r] of toes) {
        ell(tx, ty, r, r * 0.9, (px, py, d) => P(px, py, d > 0.75 ? CAST[3] : py < ty - r * 0.3 ? CAST[0] : CAST[1]));
        P(Math.round(tx), Math.round(ty + r * 0.6), CAST[2]);
      }
      // A seam down the side, where the cast set.
      for (let py = 9; py < 22; py += 2) P(23 + (py > 15 ? -1 : 0), py, CAST[2]);
    }), x, y);
  },
});

defProp('gleanerHand', {
  w: 5, h: 4,
  paint(x, y) {
    blit(still('gleanerHand', 40, 32, () => {
      shadow(20, 28, 18, 4);
      // The back of a left hand with the fingers curled under, thumb tucked at the right.
      const inHand = (px: number, py: number) => {
        const back = Math.hypot((px + 0.5 - 18) / 13, (py + 0.5 - 18) / 10) <= 1 && py >= 9;
        const wrist = px >= 10 && px <= 26 && py >= 22;
        const thumb = Math.hypot((px + 0.5 - 32) / 5, (py + 0.5 - 17) / 7) <= 1;
        return back || wrist || thumb;
      };
      for (let py = 0; py < 32; py++) for (let px = 0; px < 40; px++) {
        if (!inHand(px, py)) continue;
        const edge = !inHand(px - 1, py) || !inHand(px + 1, py);
        P(px, py, edge ? CAST[3] : on(px, py, (py - 9) / 30) ? CAST[2] : CAST[1]);
      }
      // Four curled fingers: a knuckle each, then the bent first joint seen from above.
      for (let k = 0; k < 4; k++) {
        const fx = 8 + k * 6, big = k === 1;
        ell(fx, 9, big ? 3.6 : 3, 4, (px, py, d) => P(px, py, d > 0.8 ? CAST[3] : py < 7 ? CAST[0] : CAST[1]));
        ell(fx, 4, big ? 3 : 2.6, 3, (px, py, d) => P(px, py, d > 0.8 ? CAST[3] : CAST[1]));
        line(fx - 2, 6, fx + 2, 6, CAST[2]);
        // The knuckle the size of a cart, worn smooth on top.
        P(fx - 1, 7, '#ffffff'); if (big) { P(fx, 6, '#ffffff'); P(fx + 1, 7, '#ffffff'); }
      }
      line(31, 11, 34, 22, CAST[3]);
      P(30, 12, CAST[0]);
      for (let k = 0; k < 3; k++) line(11 + k * 6, 13, 12 + k * 6, 20, CAST[2]);
    }), x, y);
  },
});

defProp('gleanerFinger', {
  w: 2, h: 4,
  paint(x, y, t) {
    blit(still('gleanerFinger', 16, 32, () => {
      // One finger coming down from above. Its nail is bitten short, past the quick.
      const inF = (px: number, py: number) => (px >= 3 && px <= 12 && py < 25) || Math.hypot((px + 0.5 - 8) / 5, (py + 0.5 - 25) / 3.5) <= 1;
      for (let py = 0; py < 30; py++) for (let px = 0; px < 16; px++) {
        if (!inF(px, py)) continue;
        const l = !inF(px - 1, py), r = !inF(px + 1, py), b = !inF(px, py + 1);
        P(px, py, l ? CAST[2] : r || b ? CAST[4] : px > 9 ? (on(px, py, 0.5) ? CAST[2] : CAST[1]) : px === 4 ? CAST[0] : CAST[1]);
      }
      for (const ky of [7, 15]) { line(4, ky, 11, ky, CAST[3]); line(5, ky + 1, 10, ky + 1, CAST[2]); }
      R(5, 19, 6, 4, NAIL[0]);
      R(5, 19, 1, 4, CAST[0]);
      for (let px = 5; px < 11; px++) P(px, 23 - (px & 1), NAIL[1]);
      P(6, 22, NAIL[1]); P(9, 22, CAST[3]);
      line(5, 24, 10, 24, NAIL[1]);
    }), x, y);
    live(x, y);
    // Its shadow on the sand grows as it comes down.
    const s = 3 + ((t >> 4) % 3);
    ell(8, 30, s + 2, 1.5, (px, py) => { if (on(px, py, 0.5)) P(px, py, SAND[3]); });
  },
});

defProp('gleanerBack', {
  w: 8, h: 5,
  paint(x, y, t) {
    // It breathes in its sleep: the back rises a pixel and settles.
    const lift = Math.cos(t / 90) > 0.6 ? 1 : 0;
    blit(still('gleanerBack', 64, 40, () => {
      const inB = (px: number, py: number) => Math.hypot((px + 0.5 - 38) / 25, (py + 0.5 - 26) / 15) <= 1;
      for (let py = 0; py < 40; py++) for (let px = 0; px < 64; px++) {
        if (!inB(px, py) || py > 38) continue;
        const top = !inB(px, py - 1), edge = !inB(px - 1, py) || !inB(px + 1, py);
        const f = py / 40;
        let c = top ? CAST[0] : edge ? CAST[3] : f < 0.5 ? CAST[1] : CAST[2];
        // Pink light from the Conch on the lower curve.
        if (f > 0.75 && on(px, py, (f - 0.75) * 3)) c = PINK[3];
        P(px, py, c);
      }
      // The head tucked down at the front, with short hair and an ear.
      ell(11, 29, 10, 9, (px, py, d) => P(px, py, d > 0.88 ? CAST[3] : py < 25 ? (on(px, py, 0.5) ? CAST[3] : CAST[2]) : CAST[1]));
      ell(16, 31, 2, 3, (px, py, d) => P(px, py, d > 0.6 ? CAST[3] : CAST[1]));
      // The spine and the shoulder blades.
      for (let k = 0; k < 9; k++) {
        const a = Math.PI * (1.05 + k * 0.085);
        const sx = Math.round(36 + Math.cos(a) * -24), sy = Math.round(27 + Math.sin(a) * 14);
        R(sx, sy, 2, 1, CAST[0]); R(sx, sy + 1, 2, 1, CAST[2]);
      }
      ell(32, 22, 6, 3, (px, py, d) => { if (d > 0.8 && py > 21) P(px, py, CAST[2]); });
      ell(46, 24, 6, 3, (px, py, d) => { if (d > 0.8 && py > 23) P(px, py, CAST[2]); });
      // The aperture at the nape, a clear round place the size of a door.
      ell(18, 17, 4, 5, (px, py, d) => P(px, py, d > 0.78 ? CAST[4] : py < 15 ? '#1a1024' : INK));
      ell(18, 17, 5, 6, (px, py, d) => { if (d > 0.84) P(px, py, CAST[0]); });
    }), x, y - lift);
  },
});

defProp('gleanerChild', {
  w: 8, h: 6,
  paint(x, y, t) {
    blit(still('gleanerChild', 64, 48, () => {
      shadow(32, 45, 26, 3);
      const shade = (px: number, py: number, d: number) => (d > 0.86 ? CAST[3] : px > 36 && on(px, py, 0.5) ? CAST[2] : py < 6 ? CAST[0] : CAST[1]);
      // Knees drawn up, feet flat.
      ell(21, 36, 7, 6, (px, py, d) => P(px, py, shade(px, py, d)));
      ell(43, 36, 7, 6, (px, py, d) => P(px, py, shade(px, py, d)));
      ell(17, 44, 5, 2.5, (px, py, d) => P(px, py, d > 0.8 ? CAST[3] : CAST[1]));
      ell(47, 44, 5, 2.5, (px, py, d) => P(px, py, d > 0.8 ? CAST[3] : CAST[1]));
      // The body between them.
      ell(32, 33, 10, 9, (px, py, d) => P(px, py, shade(px, py, d)));
      // Its left arm rests on its knee, the hand open and empty.
      line(41, 25, 47, 30, CAST[4]); line(42, 26, 48, 31, CAST[0]); line(42, 27, 48, 32, CAST[1]); line(42, 28, 48, 33, CAST[4]);
      ell(50, 32, 3, 2.5, (px, py, d) => P(px, py, d > 0.8 ? CAST[4] : CAST[0]));
      for (let k = 0; k < 4; k++) P(48 + k, 34, CAST[4]);
      P(53, 31, CAST[4]);
      // Its right arm ends smooth at the wrist.
      line(23, 25, 17, 30, CAST[4]); line(22, 26, 16, 31, CAST[0]); line(22, 27, 16, 32, CAST[1]); line(22, 28, 16, 33, CAST[4]);
      ell(15, 32, 2, 2, (px, py, d) => P(px, py, d > 0.7 ? CAST[4] : CAST[0]));
      // A round face, big as a child's is.
      ell(32, 13, 13, 12, (px, py, d) => P(px, py, d > 0.9 ? CAST[3] : px > 38 && on(px, py, 0.5) ? CAST[2] : py < 5 ? CAST[0] : CAST[1]));
      for (let px = 22; px < 42; px++) if (on(px, 1, 0.5)) P(px, 2, CAST[2]);
      R(26, 13, 2, 3, CAST[4]); R(36, 13, 2, 3, CAST[4]);
      P(26, 13, INK); P(36, 13, INK);
      line(30, 19, 34, 19, CAST[3]);
      ell(25, 18, 2, 1, (px, py) => { if (on(px, py, 0.5)) P(px, py, NAIL[0]); });
      ell(39, 18, 2, 1, (px, py) => { if (on(px, py, 0.5)) P(px, py, NAIL[0]); });
    }), x, y);
    live(x, y);
    // It blinks, slowly.
    if ((t % 300) < 8) { R(26, 13, 2, 3, CAST[1]); R(36, 13, 2, 3, CAST[1]); line(26, 15, 27, 15, CAST[4]); line(36, 15, 37, 15, CAST[4]); }
  },
});

// ---------------------------------------------------------------- the Tray

/** Four kinds of collected world, each a whole shell as big as a hill: light, body, line, and shade. */
const TRAY_COLS = [
  ['#fff4ec', '#e8c0a8', '#b0705a', '#8a5a52'],
  ['#ffe8f0', '#f4a8c0', '#c86a8a', '#8a3a5a'],
  ['#f4f8ff', '#a8c4e8', '#5a78b0', '#3a4a7a'],
  ['#fffce0', '#e8d070', '#a88a30', '#6a5420'],
];

function trayWorld(k: number): void {
  const [li, bo, ln, sh] = TRAY_COLS[k];
  if (k === 0) {
    // A whelk lying with its spire to the upper left.
    for (let py = 2; py < 16; py++) for (let px = 4; px < 20; px++) {
      const u = (px - 4 + (16 - py)) / 26;
      const d = Math.abs((py - 9) - (px - 12) * -0.45) / (1.5 + u * 6);
      if (d > 1 || u < 0.08) continue;
      const sut = ((px + py * 2) % 5) === 0 && u < 0.6;
      P(px, py, d > 0.8 ? sh : sut ? ln : d < 0.3 && py < 10 ? li : bo);
    }
    fill(15, 12, 2, 2.5, '#2a1a2a');
  } else if (k === 1) {
    // A scallop, ribs fanned out from the hinge.
    ell(12, 15, 8, 11, (px, py, d) => {
      if (py > 14) return;
      const a = Math.atan2(px + 0.5 - 12, 15 - py);
      const rib = Math.floor((a + 1.6) * 3.2) & 1;
      P(px, py, d > 0.9 ? sh : rib ? bo : li);
    });
    R(8, 14, 9, 2, ln); R(9, 15, 7, 1, sh);
  } else if (k === 2) {
    // A moon shell with its spiral up.
    ell(12, 9, 7, 6.5, (px, py, d) => P(px, py, d > 0.86 ? sh : py < 5 ? li : bo));
    for (let a = 0; a < 9.4; a += 0.25) { const r = 0.6 + a * 0.55; P(Math.round(12 + Math.cos(a) * r), Math.round(9 + Math.sin(a) * r * 0.9), ln); }
    fill(16, 13, 2, 1.5, '#101830');
  } else {
    // An urchin's test, with its rows of pores running from the top.
    ell(12, 10, 7.5, 6, (px, py, d) => P(px, py, d > 0.88 ? sh : py < 6 ? li : bo));
    for (let r = 0; r < 5; r++) { const a = -Math.PI / 2 + r * Math.PI * 2 / 5; for (let s = 1; s < 6; s++) P(Math.round(12 + Math.cos(a) * s * 1.2), Math.round(10 + Math.sin(a) * s), ln); }
  }
}

function square(empty: boolean): void {
  // Sand raked flat inside, and the four posts at the corners.
  for (let py = 3; py < 21; py++) for (let px = 2; px < 22; px++) if ((py & 3) === 1 && on(px, py, 0.5)) P(px, py, SAND[2]);
  if (empty) for (let px = 4; px < 20; px++) P(px, 20, SAND[0]);
  post(1, 0, 6); post(20, 0, 6); post(1, 15, 6); post(20, 15, 6);
}

defProp('trayShell', {
  w: 3, h: 3,
  paint(x, y) {
    const k = placeHash(x, y) % TRAY_COLS.length;
    blit(still('trayShell' + k, 24, 24, () => {
      square(false);
      shadow(12, 16, 8, 2);
      trayWorld(k);
      label(7, 18, 10);
    }), x, y);
  },
});

defProp('emptySquare', {
  w: 3, h: 3,
  paint(x, y) {
    blit(still('emptySquare', 24, 24, () => {
      square(true);
      // The longest label in the Tray: KEEP THE VOLUTE.
      label(3, 17, 18);
      R(11, 22, 2, 2, DRIFT[2]);
    }), x, y);
  },
});

defProp('starGrain', {
  w: 1, h: 1,
  paint(x, y, t) {
    live(x, y);
    // The glow breathes on a slow cosine and never blinks out.
    const lv = 0.25 + 0.125 * Math.round(Math.cos(t / 40) + 1) / 2;
    ell(4, 4, 3.6, 3.2, (px, py, d) => { if (d > 0.4 && on(px, py, lv)) P(px, py, GOLD[1]); });
    R(3, 3, 2, 2, GOLD[1]); P(3, 3, GOLD[0]); P(4, 4, GOLD[2]);
  },
});

// ---------------------------------------------------------------- the world-shells

defProp('cowrieMouth', {
  w: 6, h: 3,
  paint(x, y) {
    blit(still('cowrieMouth', 48, 24, () => {
      // Glaze round the mouth, spotted and shining.
      ell(24, 12, 24, 12, (px, py, d) => P(px, py, d > 0.95 ? '#8a4a2a' : py < 6 && on(px, py, 0.5) ? '#fff0d4' : '#e6d2b0'));
      for (const [sx, sy] of [[8, 5], [16, 3], [33, 4], [40, 7], [12, 18], [36, 19], [26, 20]]) fill(sx, sy, 1.5, 1.2, '#c0a07a');
      // The slit, dark violet inside, and the teeth meshed shut across it.
      ell(24, 12, 21, 3, (px, py) => P(px, py, py < 11 ? '#2a1438' : '#4a2a6a'));
      for (let k = 0; k < 13; k++) {
        const tx = 6 + k * 3, top = k & 1;
        const tl = Math.round(3 - Math.abs(k - 6) * 0.25);
        R(tx, 12 - tl - (top ? 0 : 1), 2, tl, '#ffffff'); P(tx + 1, 12 - tl - (top ? 0 : 1), '#d8c8b0');
        R(tx + 1, 12, 2, tl, '#fff8ec'); P(tx + 1, 12 + tl - 1, '#c0a07a');
      }
      line(4, 8, 44, 8, '#c0a07a');
      for (let px = 6; px < 42; px += 4) P(px, 7, '#ffffff');
    }), x, y);
  },
});

defProp('augerPoint', {
  w: 2, h: 3,
  paint(x, y, t) {
    blit(still('augerPoint', 16, 24, () => {
      // The last whorls, too narrow for anyone grown, ridged in tight turns.
      for (let py = 6; py < 24; py++) {
        const hw = Math.max(0.5, (py - 6) * 0.36);
        for (let px = Math.round(8 - hw); px <= Math.round(8 + hw - 1); px++) {
          const ridge = ((px - py * 2) % 4 + 4) % 4;
          const edge = px === Math.round(8 - hw) || px === Math.round(8 + hw - 1);
          P(px, py, edge ? '#26141e' : ridge === 0 ? '#5c3a4c' : ridge === 1 ? '#fff0dc' : px < 8 ? '#d8b48a' : '#9c8270');
        }
      }
      P(8, 5, '#fff0dc');
    }), x, y);
    live(x, y);
    // The seam in the sky above the point: a line of light that a shimmer climbs.
    for (let py = 0; py < 5; py++) {
      const lit = ((t >> 3) - py) & 7;
      P(8 + (py & 1 ? 0 : 0), py, lit < 2 ? '#ffffff' : py % 2 ? GOLD[1] : '#b8b0e8');
      if (lit === 0) { P(7, py, '#b8b0e8'); P(9, py, '#b8b0e8'); }
    }
  },
});

defProp('nautilusSeptum', {
  w: 1, h: 3,
  paint(x, y) {
    blit(still('nautilusSeptum', 8, 24, () => {
      // A curved wall between chambers, nacre on its face, and the small round siphon hole low down.
      for (let py = 0; py < 24; py++) {
        const bow = Math.round(2 * Math.sin(Math.PI * py / 23));
        const x0 = 1 + bow;
        R(x0, py, 5, 1, '#f2eee6');
        P(x0, py, '#ffffff'); P(x0 + 4, py, '#7a5a6e');
        if (on(x0 + 2, py, 0.5) && py % 5 < 2) P(x0 + 2, py, '#40e8a8');
        if (py % 5 === 3) P(x0 + 1, py, '#e0dcf2');
      }
      fill(4.5, 18.5, 1.6, 1.6, INK); P(3, 17, '#7a5a6e');
      D(1, 23, 7, 1, '#948cb4', 0.5);
    }), x, y);
  },
});

defProp('conchThroat', {
  w: 5, h: 4,
  paint(x, y, t) {
    blit(still('conchThroat', 40, 32, () => {
      // The throat curls in and down: rings of pink, each smaller, darker, and turned a little further.
      for (let k = 0; k < 7; k++) {
        const s = 1 - k * 0.13, cx = 20 + k * 1.6, cy = 16 + k * 0.9;
        ell(cx, cy, 19 * s, 15 * s, (px, py, d) => P(px, py, d > 0.86 ? PINK[Math.min(6, k + 1)] : PINK[Math.min(6, k)]));
      }
      ell(30, 22, 3, 2.5, (px, py) => P(px, py, INK));
      for (let k = 0; k < 6; k++) P(6 + k * 3, 6 + (k & 1), '#ffffff');
    }), x, y);
    live(x, y);
    // The roar travels in: a band of light pink runs down the curls every few seconds.
    const k = (t >> 4) % 10;
    if (k < 6) {
      const s = 1 - k * 0.13, cx = 20 + k * 1.6, cy = 16 + k * 0.9;
      ell(cx, cy, 19 * s, 15 * s, (px, py, d) => { if (d > 0.8 && d < 0.93 && on(px, py, 0.5)) P(px, py, PINK[0]); });
    }
  },
});

// A flag on the back wall of Gran's kitchen: blue, pink, white, pink, blue, each two pixels tall, on a short rod.
defProp('homeFlag', {
  w: 1, h: 2,
  paint(x, y) {
    blit(still('homeFlag', 8, 13, () => {
      pic(['kkkkkkkk', '.b.....b'], 0, 0, { k: '#6a4a2a', b: '#3a2a1a' });
      const stripes = ['#5bcefa', '#5bcefa', '#f5a9b8', '#f5a9b8', '#ffffff', '#ffffff', '#f5a9b8', '#f5a9b8', '#5bcefa', '#5bcefa'];
      stripes.forEach((c, i) => R(1, 2 + i, 6, 1, c));
    }), x, y);
  },
});
