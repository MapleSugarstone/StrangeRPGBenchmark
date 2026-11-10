// Tile, peg, and pawn drawing. Visual laws are in Notes/bible.md: fixed things are solid with one shadow, undecided things interleave two images.
import { BLANK, FIXED, OPEN } from '../rules/types';
import type { CharId, Kind, State } from '../rules/types';
import { T } from '../rules/tuning';
import { C, bayer, dither, ellipse, frame, hash2, px, rect, setStencil, sprite } from '../gfx/screen';
import type { Inks } from '../gfx/screen';
import { FACE, ICON, KIND_ICON, PAWN } from './sprites';

export const TS = 24;
export const BX = 8, BY = 20;

export const KIND_INKS: Record<Kind, [number, number, number]> = {
  road: [C.road1, C.road2, C.road3],
  well: [C.well1, C.well2, C.well3],
  town: [C.town1, C.town2, C.town3],
  peak: [C.peak1, C.peak2, C.peak3],
};

export const PARTY_INK: Record<CharId, number> = { perch: C.perch, deed: C.ink, auger: C.auger, offset: C.offset, lot: C.lot, either: C.doubt2 };

export function tileX(c: number): number { return BX + (c % T.W) * TS; }
export function tileY(c: number): number { return BY + Math.floor(c / T.W) * TS; }

function crawlStencil(tick: number, phase: number): (x: number, y: number) => boolean {
  const k = Math.floor(tick / 30);
  return (x, y) => ((((x + k) >> 1) + (y >> 1)) & 1) === phase;
}

export function drawBlank(x0: number, y0: number, cell: number): void {
  rect(x0, y0, TS, TS, C.paper);
  for (let j = 0; j < TS; j += 6) for (let i = 0; i < TS; i += 6) px(x0 + i, y0 + j, C.paper3);
  const h = hash2(cell, 7);
  px(x0 + 3 + (h % 17), y0 + 4 + ((h >> 5) % 15), C.paper2);
  px(x0 + 5 + ((h >> 9) % 13), y0 + 2 + ((h >> 13) % 19), C.paper2);
}

/** Draws one reading's image. `flip` mirrors it so its shadow falls to the lower left. */
export function drawKind(x0: number, y0: number, kind: Kind, seed: number, mask: number, flip: boolean): void {
  const P = (dx: number, dy: number, c: number) => px(x0 + (flip ? TS - 1 - dx : dx), y0 + dy, c);
  const R = (dx: number, dy: number, w: number, h: number, c: number) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P(dx + i, dy + j, c); };
  const E = (cx: number, cy: number, rx: number, ry: number, c: number) => {
    for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) if ((i * i) / (rx * rx + 0.5) + (j * j) / (ry * ry + 0.5) <= 1) P(cx + i, cy + j, c);
  };
  const [k1, k2, k3] = KIND_INKS[kind];
  if (kind === 'road') {
    const m = mask || 5;
    const seg = (x: number, y: number, w: number, h: number, vertical: boolean) => {
      R(x, y, w, h, k1);
      if (vertical) { R(x, y, 1, h, k3); R(x + w - 1, y, 1, h, k3); for (let j = 1; j < h; j += 4) R(x + (w >> 1) - 1 + (w & 1), y + j, 1, 2, C.white); }
      else { R(x, y, w, 1, k3); R(x, y + h - 1, w, 1, k3); for (let i = 1; i < w; i += 4) R(x + i, y + (h >> 1) - 1 + (h & 1), 2, 1, C.white); }
    };
    if (m & 1) seg(9, 0, 6, 12, true);
    if (m & 4) seg(9, 12, 6, 12, true);
    if (m & 2) seg(12, 9, 12, 6, false);
    if (m & 8) seg(0, 9, 12, 6, false);
    R(8, 8, 8, 8, k3);
    R(9, 9, 6, 6, k1);
    R(11, 11, 2, 2, C.white);
  } else if (kind === 'well') {
    E(13, 14, 8, 6, C.paper3);
    E(11, 12, 8, 6, C.ink);
    E(11, 12, 7, 5, C.pencil);
    E(11, 12, 5, 3, k3);
    P(4, 12, C.ink); P(18, 12, C.ink); P(11, 7, C.ink); P(11, 17, C.ink); P(7, 8, C.ink); P(15, 16, C.ink);
    P(8, 11, k1); P(9, 10, k1); P(10, 10, k1);
    P(13, 13, k2); P(14, 12, k2);
  } else if (kind === 'town') {
    const spots: [number, number][] = [[3 + (seed % 2), 6], [13, 3 + ((seed >> 2) % 2)], [9 + ((seed >> 4) % 3), 13]];
    for (const [hx, hy] of spots) {
      R(hx + 2, hy + 3, 6, 6, C.paper3);
      R(hx, hy + 2, 6, 6, C.ink);
      R(hx + 1, hy + 3, 4, 4, C.white);
      R(hx + 1, hy, 4, 2, k2);
      R(hx, hy + 1, 6, 1, C.ink);
      P(hx + 1, hy - 1, C.ink); P(hx + 2, hy - 1, C.ink); P(hx + 3, hy - 1, C.ink); P(hx + 4, hy - 1, C.ink);
      P(hx, hy, C.ink); P(hx + 5, hy, C.ink);
      P(hx + 2, hy + 6, C.ink); P(hx + 3, hy + 6, C.ink); P(hx + 2, hy + 5, C.ink); P(hx + 3, hy + 5, C.ink);
      P(hx + 4, hy + 3, k3);
    }
  } else {
    for (let j = 0; j < 16; j++) { const half = Math.floor(j * 0.45) + 1; for (let i = -half; i <= half; i++) P(14 + i + Math.floor(j / 5), 6 + j, C.paper3); }
    for (let j = 0; j < 16; j++) {
      const half = Math.floor(j * 0.45) + 1;
      for (let i = -half; i <= half; i++) {
        let c = i < 0 ? k1 : k2;
        if (i === -half || i === half || j === 15) c = C.ink;
        else if (j < 4) c = C.white;
        else if (i > 0 && (i + j) % 3 === 0) c = k3;
        P(11 + i, 3 + j, c);
      }
    }
    P(11, 2, C.ink);
  }
}

function roadMask(s: State, c: number): number {
  const x = c % T.W, y = Math.floor(c / T.W);
  let m = 0;
  const open = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < T.W && yy < T.H && s.tiles[yy * T.W + xx].st === FIXED;
  if (open(x, y - 1)) m |= 1;
  if (open(x + 1, y)) m |= 2;
  if (open(x, y + 1)) m |= 4;
  if (open(x - 1, y)) m |= 8;
  return m;
}

export function drawTile(s: State, c: number, tick: number): void {
  const t = s.tiles[c];
  const x0 = tileX(c), y0 = tileY(c);
  const seed = hash2(c, s.season);
  if (t.st === BLANK) { drawBlank(x0, y0, c); return; }
  if (t.st === FIXED) {
    rect(x0, y0, TS, TS, C.paper2);
    dither(x0 + 1, y0 + 1, TS - 2, TS - 2, KIND_INKS[t.k!][0], 3);
    drawKind(x0, y0, t.k!, seed, roadMask(s, c), false);
    frame(x0, y0, TS, TS, t.official ? C.sepia : C.paper3);
  } else {
    rect(x0, y0, TS, TS, C.paper);
    const k = Math.floor(tick / 30);
    const ia = KIND_INKS[t.a], ib = KIND_INKS[t.b];
    for (let j = 1; j < TS - 1; j++) for (let i = 1; i < TS - 1; i++) {
      const side = i + j - (TS - 1);
      if (side < -2) { if (bayer(x0 + i, y0 + j, 7)) px(x0 + i, y0 + j, ia[0]); }
      else if (side > 2) { if (bayer(x0 + i, y0 + j, 7)) px(x0 + i, y0 + j, ib[0]); }
      else px(x0 + i, y0 + j, ((i + k) >> 1) & 1 ? ia[1] : ib[1]);
    }
    sprite(KIND_ICON[t.a], x0 + 3, y0 + 3, { '#': C.ink, o: ia[0], x: ia[1], w: C.white });
    sprite(KIND_ICON[t.b], x0 + 13, y0 + 13, { '#': C.ink, o: ib[0], x: ib[1], w: C.white });
    for (let i = 0; i < TS; i += 2) { px(x0 + i, y0, C.pencil); px(x0 + i, y0 + TS - 1, C.pencil); px(x0, y0 + i, C.pencil); px(x0 + TS - 1, y0 + i, C.pencil); }
  }
  if (t.site) {
    frame(x0 + 1, y0 + 1, TS - 2, TS - 2, C.gold);
    sprite(ICON.site, x0 + TS - 9, y0 + TS - 10, { '#': C.ink, o: C.gold });
  }
  if (t.den) drawFace(t.den, x0 + 8, y0 + 3, 1, tick, true, 0, C.doubt2, C.doubt1);
  if (t.st === FIXED && t.k === 'town' && t.offer && t.offer.length) { px(x0 + TS - 4, y0 + 3, C.ink); px(x0 + TS - 5, y0 + 3, C.town2); px(x0 + TS - 4, y0 + 4, C.town2); }
}

/** The violet fringe that undecided ground gives off into its neighbors. Draw after every tile. */
export function drawDoubtFringe(s: State, tick: number): void {
  const k = Math.floor(tick / 30);
  for (let c = 0; c < s.tiles.length; c++) {
    if (s.tiles[c].st !== OPEN) continue;
    const x0 = tileX(c), y0 = tileY(c);
    for (let j = -2; j < TS + 2; j++) {
      for (let i = -2; i < TS + 2; i++) {
        if (i >= 0 && j >= 0 && i < TS && j < TS) continue;
        const far = i === -2 || j === -2 || i === TS + 1 || j === TS + 1;
        if (bayer(x0 + i + k, y0 + j, far ? 3 : 7)) px(x0 + i, y0 + j, far ? C.doubt1 : C.doubt2);
      }
    }
  }
}

export function drawPeg(x0: number, y0: number, who: CharId, open: boolean, tick: number): void {
  const ink = PARTY_INK[who];
  void open; void tick;
  const fx = x0 + TS - 10;
  rect(fx, y0 + 2, 1, 9, C.ink);
  rect(fx + 1, y0 + 2, 5, 4, ink);
  frame(fx, y0 + 1, 7, 6, C.ink);
  if (who === 'deed') px(fx + 3, y0 + 3, C.gold);
  if (who === 'perch') px(fx + 3, y0 + 3, C.white);
  setStencil(null);
}

/** Draws a unit face. A unit with two readings and `open` true shows both, interleaved. */
export function drawFace(key: string, x: number, y: number, scale: number, tick: number, open: boolean, reading: number, a: number, b: number): void {
  const faces = FACE[key] ?? FACE.stray;
  const inks: Inks = { '#': C.ink, o: a, x: b, w: C.white };
  if (open && faces.length > 1) {
    const k = Math.floor(tick / 30);
    setStencil((px0, py0) => (((Math.floor((px0 - x) / scale) + Math.floor((py0 - y) / scale) + k) & 1) === 0));
    sprite(faces[0], x, y, inks, scale);
    setStencil((px0, py0) => (((Math.floor((px0 - x) / scale) + Math.floor((py0 - y) / scale) + k) & 1) === 1));
    sprite(faces[1], x, y, inks, scale);
    setStencil(null);
  } else {
    sprite(faces[reading === 2 && faces.length > 1 ? 1 : 0], x, y, inks, scale);
  }
}

export function pawnSize(who: string): [number, number] {
  if (who === 'lot') return [13, 12];
  if (who === 'either') return [11, 14];
  const sp = PAWN[who];
  return [sp[0].length, sp.length];
}

/** Draws a party's pawn with its feet at (x, y). `x` is the left edge. */
export function drawPawn(who: string, x: number, y: number, tick: number, doubt = 0, scale = 1): void {
  const [w, h] = pawnSize(who);
  const top = y - h * scale;
  if (scale === 1) {
    ellipse(x + (w >> 1) + 2, y, w >> 1, 1, C.paper3);
    if (who === 'either' || doubt >= 2) dither(x - 3, y - 1, w, 2, C.doubt1, who === 'either' ? 8 : Math.min(8, 2 + doubt));
  }
  if (who === 'lot') {
    if (scale === 1) rect(x - 1, top + 3, 15, 10, C.paper);
    const k = Math.floor(tick / 20);
    const spots = [[1, 6], [4, 4], [7, 5], [10, 6], [2, 9], [5, 8], [8, 9], [11, 9], [6, 6]];
    rect(x + 6 * scale, top, scale, 6 * scale, C.ink);
    rect(x + 7 * scale, top, 4 * scale, 3 * scale, C.lot);
    spots.forEach(([dx, dy], i) => {
      const bob = (k + i * 3) % 7 === 0 ? -1 : 0;
      rect(x + dx * scale, top + (dy + bob) * scale, scale, scale, C.ink);
      rect(x + dx * scale, top + (dy + 1 + bob) * scale, scale, 2 * scale, i % 3 === 0 ? C.town1 : C.lot);
    });
    return;
  }
  if (who === 'either') {
    if (scale === 1) { rect(x + 2, top - 1, 7, 16, C.paper); rect(x - 1, top + 5, 13, 10, C.paper); }
    const k = Math.floor(tick / 30);
    const st = (phase: number) => (px0: number, py0: number) => (((Math.floor((px0 - x) / scale) + Math.floor((py0 - top) / scale) + k) & 1) === phase);
    setStencil(st(0));
    rect(x + 4 * scale, top, 3 * scale, 14 * scale, C.doubt3);
    rect(x + 3 * scale, top + 1 * scale, 5 * scale, 4 * scale, C.doubt3);
    setStencil(st(1));
    rect(x, top + 7 * scale, 11 * scale, 7 * scale, C.doubt2);
    rect(x + 1 * scale, top + 6 * scale, 9 * scale, 1 * scale, C.doubt2);
    setStencil(null);
    rect(x + 4 * scale, top + 6 * scale, 3 * scale, 3 * scale, C.white);
    frame(x + 3 * scale, top + 5 * scale, 5 * scale, 5 * scale, C.ink);
    rect(x + 5 * scale, top + 7 * scale, scale, scale, C.ink);
    return;
  }
  const sp = PAWN[who];
  const ink = who === 'perch' ? C.perch : who === 'deed' ? C.sepia : who === 'auger' ? C.auger : who === 'offset' ? C.perch : C.bp1;
  if (scale === 1) { const halo = { '#': C.paper, o: C.paper, w: C.paper, x: C.paper, r: C.paper }; for (const [hx, hy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [2, 0]]) sprite(sp, x + hx, top + hy, halo, 1); }
  if (who === 'offset') sprite(sp, x + scale, top, { '#': C.offset, o: C.offset, w: C.offset, x: C.offset }, scale);
  sprite(sp, x, top, { '#': C.ink, o: who === 'level' ? C.hi : ink, w: C.white, x: who === 'deed' ? C.gold : who === 'level' ? C.bp2 : C.gold, r: C.town2 }, scale);
}
