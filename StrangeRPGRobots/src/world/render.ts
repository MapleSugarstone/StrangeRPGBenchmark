// Draws the current map: floors, facades, roofs, ledges, props, actors, Bailers, signs, and steam, then
// lights the frame, composites it, and adds reflections and rain.
import { H, W, alb, clearLayers, emi, flo, nrm, roof } from '../engine/screen';
import { C, UP } from '../engine/palette';
import { blit, wpx, type Img } from '../engine/gfx';
import { addLight, addSkyLight, beginLight, castShadows, composite, rgbf, setDitherOrigin, setShade, ditherAt, type Figure, type RGBf } from '../engine/light';
import { drawTextWorld } from '../engine/font';
import { cellAt } from './map';
import { T, hash, puddleMask, windowColor, type TileDef } from './tiles';
import { WORLD, type Actor, type PropInst } from './world';
import { reflect, rain, steam } from './fx';
import { ICONS } from '../art/icons';
import { BAILER_FRAMES } from '../art/bailer';

/** Facade row of a wall tile: 0 bottom face, 1 upper face, -1 roof. */
export function faceRow(tx: number, ty: number): number {
  const m = WORLD.map!;
  const c = cellAt(m, tx, ty).tile;
  if (!c.wall) return -1;
  const s = cellAt(m, tx, ty + 1).tile;
  if (!s.wall) return 0;
  if ((c.faceRows ?? 1) >= 2 && s === c && !cellAt(m, tx, ty + 2).tile.wall) return 1;
  return -1;
}

function drawTile(tile: TileDef, tx: number, ty: number, sx: number, sy: number, t: number) {
  const m = WORLD.map!;
  if (tile.wall) {
    const row = faceRow(tx, ty);
    // A roof's outer edge is a parapet one pixel wide, two steps lighter, so roofs read apart from the street.
    const open = (dx: number, dy: number) => {
      const c = cellAt(m, tx + dx, ty + dy);
      return !c.tile.wall || faceRow(tx + dx, ty + dy) >= 0;
    };
    const eTop = row < 0 && open(0, -1), eLeft = row < 0 && open(-1, 0), eRight = row < 0 && open(1, 0), eBottom = row < 0 && open(0, 1);
    for (let ly = 0; ly < T; ly++) {
      const y = sy + ly;
      if (y < 0 || y >= H) continue;
      for (let lx = 0; lx < T; lx++) {
        const x = sx + lx;
        if (x < 0 || x >= W) continue;
        const i = y * W + x;
        if (row >= 0 && tile.face) {
          if (tile.faceGlow?.(lx, ly, tx, ty, row)) { alb[i] = windowColor(tx, ty, lx, row); emi[i] = 1; }
          else { alb[i] = tile.face(lx, ly, tx, ty, row); emi[i] = 0; }
          nrm[i * 2] = 0; nrm[i * 2 + 1] = 40;
        } else {
          const c = tile.tex(lx, ly, tx, ty, t);
          const edge = (eTop && ly === 0) || (eBottom && ly === T - 1) || (eLeft && lx === 0) || (eRight && lx === T - 1);
          alb[i] = edge ? UP[UP[c]] : c; emi[i] = 0;
          nrm[i * 2] = 0; nrm[i * 2 + 1] = 0;
          roof[i] = 1;
        }
        flo[i] = 0;
      }
    }
    return;
  }
  const isPuddle = tile.floor === 3;
  const below = tile.ch === ' ' && WORLD.def?.below;
  for (let ly = 0; ly < T; ly++) {
    const y = sy + ly;
    if (y < 0 || y >= H) continue;
    for (let lx = 0; lx < T; lx++) {
      const x = sx + lx;
      if (x < 0 || x >= W) continue;
      const i = y * W + x;
      nrm[i * 2] = 0; nrm[i * 2 + 1] = 0;
      if (below) {
        const gx = Math.floor((tx * T + lx + WORLD.cam.x * 0.4) / 2), gy = Math.floor((ty * T + ly + WORLD.cam.y * 0.4) / 2);
        const h = hash(gx, gy, 31);
        if (h < 0.018) { alb[i] = h < 0.006 ? C.amb3 : h < 0.011 ? C.cyan2 : h < 0.015 ? C.mag2 : C.vio2; emi[i] = 1; }
        else { alb[i] = C.black; emi[i] = 1; }
        flo[i] = 0;
        continue;
      }
      if (isPuddle && puddleMask(lx, ly, tx, ty)) { alb[i] = C.ink; emi[i] = 0; flo[i] = 3; continue; }
      alb[i] = tile.tex(lx, ly, tx, ty, t);
      emi[i] = 0;
      flo[i] = tile.floor === 3 ? 2 : tile.floor;
    }
  }
  // Ledges: a raised tile north of this one drops its face into the top rows of this tile.
  const here = cellAt(m, tx, ty).elev;
  const north = cellAt(m, tx, ty - 1);
  if (north.elev > here && !north.tile.wall) {
    const drop = Math.min(6, 3 * (north.elev - here));
    for (let ly = 0; ly < drop; ly++) for (let lx = 0; lx < T; lx++) {
      const x = sx + lx, y = sy + ly;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x;
      alb[i] = ly === 0 ? C.slate : (lx + ly) % 4 === 0 ? C.ink : C.night;
      emi[i] = 0; flo[i] = 0;
      nrm[i * 2] = 0; nrm[i * 2 + 1] = 60;
    }
  }
  for (const [dx, side] of [[-1, 0], [1, T - 1]] as const) {
    const n = cellAt(m, tx + dx, ty);
    if (n.elev !== here && !n.tile.wall && n.tile.ch !== ' ') {
      for (let ly = 0; ly < T; ly++) wpx(sx + side, sy + ly, n.elev > here ? C.black : C.slate, 0, 0);
    }
  }
}

/** The breathing offset of a tile on a woken hull, or 0. */
function hullOff(tx: number, ty: number, t: number): number {
  const h = WORLD.hull;
  if (!h) return 0;
  if (!h.all && (tx < h.x || ty < h.y || tx >= h.x + h.w || ty >= h.y + h.h)) return 0;
  return breathOffset(t, 3);
}

/** Board tape: two red strips crossed over a door. */
function tape(x: number, y: number, w: number, h: number) {
  for (let k = 0; k < Math.max(w, h); k++) {
    for (const [px, py] of [[x + Math.round(k * w / Math.max(w, h)), y + Math.round(k * h / Math.max(w, h))], [x + w - 1 - Math.round(k * w / Math.max(w, h)), y + Math.round(k * h / Math.max(w, h))]]) {
      for (const dy of [0, 1]) {
        const yy = py + dy;
        if (px < 0 || yy < 0 || px >= W || yy >= H) continue;
        const i = yy * W + px;
        alb[i] = (k >> 1) % 2 ? C.red2 : C.white; emi[i] = 2; flo[i] = 0; nrm[i * 2] = 0; nrm[i * 2 + 1] = 0;
      }
    }
  }
}

function breathOffset(t: number, seed: number): number {
  return ((t + seed * 0.37) % 2) < 0.55 ? -1 : 0;
}

interface Drawable { y: number; draw: () => void }

function frameOf(a: Actor): { im: Img; flip: boolean } {
  const s = a.sheet;
  const dir = a.dir === 'left' ? 'right' : a.dir;
  const set = s.frames[dir];
  let f = 0;
  if (a.moving) f = [1, 0, 2, 0][Math.floor(a.anim * 8) % 4];
  return { im: set[Math.min(f, set.length - 1)], flip: a.dir === 'left' && s.flipLeft };
}

export interface RenderOpts {
  flag: (f: string) => boolean;
  /** Draws into the world layer after actors, before light (combat tiles). */
  under?: () => void;
  /** Adds lights after the map's own. */
  lights?: () => void;
  /** Draws after the composite, before the interface. */
  over?: () => void;
  dt: number;
}

export function propLightOn(p: PropInst): boolean {
  return !p.broken && !WORLD.dark.has(p.id) && p.hushed <= 0;
}

export function renderWorld(o: RenderOpts) {
  const m = WORLD.map!;
  const def = WORLD.def!;
  const t = WORLD.t;
  const shake = WORLD.shake > 0 ? Math.round((Math.random() - 0.5) * 2 * Math.min(3, WORLD.shake * 6)) : 0;
  const camX = Math.round(WORLD.cam.x) + shake, camY = Math.round(WORLD.cam.y);
  setDitherOrigin(camX, camY);
  clearLayers();
  const tx0 = Math.floor(camX / T) - 1, ty0 = Math.floor(camY / T) - 1;
  const tx1 = Math.floor((camX + W) / T) + 1, ty1 = Math.floor((camY + H) / T) + 2;
  const windows: [number, number, number][] = [];
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const c = cellAt(m, tx, ty);
      drawTile(c.tile, tx, ty, tx * T - camX, ty * T - camY + hullOff(tx, ty, t), t);
      if (c.tile.faceGlow && faceRow(tx, ty) === 0) {
        for (const lx of [2, 7]) if (c.tile.faceGlow(lx, 3, tx, ty, 0)) windows.push([tx * T + lx - camX, ty * T + 10 - camY, windowColor(tx, ty, lx, 0)]);
      }
    }
  }

  const list: Drawable[] = [];
  const steamSrc: [number, number][] = [];
  for (const p of WORLD.props) {
    if (!visibleProp(p, o.flag)) continue;
    const d = p.def;
    const bx = p.x * T + (d.ox ?? 0) + p.ox - camX;
    let by = p.y * T + (d.oy ?? 0) + p.oy - camY + hullOff(p.x, p.y, t);
    if (bx > W + 30 || by > H + 30 || bx < -40 || by < -40) continue;
    if (d.steam && !p.broken) steamSrc.push([p.x * T + 5, p.y * T + 4]);
    if (d.kind === 'noodlecart') steamSrc.push([p.x * T + 9, p.y * T - 6]);
    if (p.wake && p.hushed <= 0) by += breathOffset(t, p.x * 7 + p.y);
    const art = p.broken ? null : d.art;
    if (!art) continue;
    const taped = (p.place.tapeIf && o.flag(p.place.tapeIf)) || (p.id === 'home_door' && o.flag('house_taped'));
    const drawP = () => {
      blitProp(p, art, bx, by);
      if (taped) tape(bx, by, art.w, art.h);
    };
    if (d.flat) drawP();
    else list.push({ y: (p.y + (d.h ?? 1)) * T - 1, draw: drawP });
  }
  const figs: Figure[] = [];
  for (const a of WORLD.actors) {
    if (!a.visible || a.gone) continue;
    const ax = Math.round(a.px) - camX, ay = Math.round(a.py) - camY - a.lift + hullOff(a.tx, a.ty, t);
    if (ax > W + 10 || ay > H + 10 || ax < -12 || ay < -16) continue;
    const { im, flip } = frameOf(a);
    const breath = a.breathe ? breathOffset(t, a.tx) : 0;
    const bx = ax - Math.floor((im.w - 10) / 2), by = ay - (im.h - 10);
    list.push({ y: a.py + 9, draw: () => blit(im, bx, by + breath, { flip, kind: 2, tint: a.tint, fade: a.fade, glowSlot: a.sheet.glow ? 4 : 0 }) });
    if (!a.fade && a.lift <= 2) figs.push({ img: im, x: bx, y: by + a.lift, flip });
  }
  for (const b of WORLD.bailers) {
    const bx = Math.round(b.x) - camX - 10, by = Math.round(b.y) - camY - 32 + (b.sink ?? 0);
    if (bx > W + 40 || by > H + 50 || bx < -50 || by < -60) continue;
    const fr = BAILER_FRAMES[b.stopped ? 0 : (Math.floor(b.step) % 2) + 1];
    list.push({ y: b.y + 9, draw: () => blit(fr, bx, by, { kind: 2, flip: b.dir < 0, tint: b.dark ? C.slate : undefined, cutBottom: Math.min(30, b.sink ?? 0) }) });
  }
  list.sort((a, b) => a.y - b.y);
  for (const d of list) d.draw();

  for (let i = 0; i < WORLD.signs.length; i++) {
    const s = WORLD.signs[i];
    if (s.broken || (s.place.showIf && !o.flag(s.place.showIf)) || (s.place.hideIf && o.flag(s.place.hideIf))) continue;
    const sx = Math.round(s.place.x * T) - camX, sy = Math.round(s.place.y * T) - camY;
    if (sx > W + 60 || sy > H + 60 || sx < -80 || sy < -60) continue;
    if (s.place.text) drawTextWorld(s.place.text, sx, sy, s.place.color, 1, s.place.vertical);
    if (s.place.icon) {
      const ic = ICONS[s.place.icon];
      if (ic) blit(ic, sx, sy, { kind: 1, tint: s.place.color });
    }
    if (s.place.holo) holo(sx, sy, (s.place.text ? (s.place.vertical ? 5 : s.place.text.length * 6) : 8), (s.place.text && s.place.vertical ? s.place.text.length * 7 : 8), t);
  }
  o.under?.();
  steam(o.dt, steamSrc, camX, camY);

  const amb = rgbf(def.ambient);
  const lvl = Math.max(def.ambientLevel, def.inside ? 0.3 : 0.27);
  const ambient: RGBf = [amb[0] * lvl, amb[1] * lvl, amb[2] * lvl];
  beginLight(ambient, (sx, sy) => {
    const wx = sx + camX, wy = sy + camY;
    const tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    const c = cellAt(m, tx, ty).tile;
    if (c.opaque && faceRow(tx, ty) < 0) return true;
    return false;
  });
  for (const l of WORLD.lights) {
    if (l.showIf && !o.flag(l.showIf)) continue;
    if (l.hideIf && o.flag(l.hideIf)) continue;
    const lx = l.x * T - camX, ly = l.y * T - camY;
    if (lx < -l.r || ly < -l.r || lx > W + l.r || ly > H + l.r) continue;
    addLight(lx, ly, l.r, l.i, l.color, { z: l.z, dir: l.dir, spread: l.spread });
  }
  for (const p of WORLD.props) {
    const L = p.def.light;
    if (!L || !propLightOn(p) || !visibleProp(p, o.flag)) continue;
    const lx = p.x * T + (p.def.ox ?? 0) + p.ox + L.dx - camX, ly = p.y * T + (p.def.oy ?? 0) + p.oy + L.dy - camY;
    if (lx < -L.r || ly < -L.r || lx > W + L.r || ly > H + L.r) continue;
    addLight(lx, ly, L.r, L.i, L.color, { z: L.z, dir: L.dir, spread: L.spread });
  }
  for (const s of WORLD.signs) {
    if (s.broken || !s.place.light || (s.place.showIf && !o.flag(s.place.showIf)) || (s.place.hideIf && o.flag(s.place.hideIf))) continue;
    const w = s.place.text ? (s.place.vertical ? 5 : s.place.text.length * 6) : 8;
    const h = s.place.text && s.place.vertical ? s.place.text.length * 7 : 7;
    const lx = s.place.x * T + w / 2 - camX, ly = s.place.y * T + h / 2 + 7 - camY;
    const r = s.place.r ?? 40;
    if (lx < -r || ly < -r || lx > W + r || ly > H + r) continue;
    addLight(lx, ly, r, 1.15, s.place.light, { z: 18 });
  }
  for (const b of WORLD.bailers) {
    if (b.dark) continue;
    const lx = b.x - camX + (b.dir < 0 ? 4 : 16), ly = b.y - camY - 20;
    addLight(lx, ly + 22, 46, 0.9, 0xffb040, { z: 40 });
  }
  for (const [wx, wy, c] of windows) addLight(wx, wy, 13, 0.5, WINDOW_LIGHT[c] ?? 0xffb040, { z: 8 });
  for (const f of WORLD.fill) {
    const lx = f.x * T - camX, ly = f.y * T - camY;
    if (lx < -40 || ly < -40 || lx > W + 40 || ly > H + 40) continue;
    addLight(lx, ly, 38, 0.34, f.c, { z: 30, through: true });
  }
  o.lights?.();
  addSkyLight(def.inside ? 0 : 0.5);
  castShadows(figs);
  setShade(def.shade ?? (def.district === 'brim' ? C.steel0 : def.district === 'stair' ? C.vio0 : C.vio0));
  composite();
  reflect(t);
  if (def.rain && !def.inside) rain(o.dt, def.rain, camX, camY);
  o.over?.();
}

const WINDOW_LIGHT: Record<number, number> = { [C.amb3]: 0xffb040, [C.cyan3]: 0x3ef0e8, [C.vio3]: 0x8a70ff, [C.mag3]: 0xff3aa8 };

/** A hologram: the sign's pixels thinned to a checker with a scanline gap that crawls upward. */
function holo(x: number, y: number, w: number, h: number, t: number) {
  const gap = Math.floor(t * 5) % 5;
  for (let yy = y - 1; yy < y + h + 1; yy++) {
    if (yy < 0 || yy >= H) continue;
    for (let xx = x - 1; xx < x + w + 1; xx++) {
      if (xx < 0 || xx >= W) continue;
      const i = yy * W + xx;
      if (emi[i] !== 1) continue;
      if (((xx + yy) & 1) || (yy - y + 5 - gap) % 5 === 0) { emi[i] = 0; alb[i] = C.ink; }
    }
  }
}

function visibleProp(p: PropInst, flag: (f: string) => boolean): boolean {
  if (p.place.showIf && !flag(p.place.showIf)) return false;
  if (p.place.hideIf && flag(p.place.hideIf)) return false;
  return true;
}

function blitProp(p: PropInst, art: Img, x: number, y: number) {
  const d = p.def;
  const glow = d.glow;
  const lit = propLightOn(p);
  const hushTint = p.hushed > 0 ? C.steel3 : undefined;
  const x0 = Math.round(x), y0 = Math.round(y);
  for (let yy = 0; yy < art.h; yy++) {
    const sy = y0 + yy;
    if (sy < 0 || sy >= H) continue;
    for (let xx = 0; xx < art.w; xx++) {
      const sx = x0 + xx;
      if (sx < 0 || sx >= W) continue;
      const si = yy * art.w + xx;
      const c = art.px[si];
      if (c === 255) continue;
      if (p.fade && ditherAt(sx, sy) < p.fade) continue;
      const i = sy * W + sx;
      const isGlow = !!glow && lit && glow.includes(art.slot[si]);
      alb[i] = hushTint ?? (isGlow ? c : (glow && !lit && glow.includes(art.slot[si]) ? C.ink : c));
      emi[i] = isGlow ? 1 : d.flat ? 0 : 2;
      if (d.flat) { flo[i] = 1; nrm[i * 2] = 0; nrm[i * 2 + 1] = 0; }
      else { flo[i] = 0; nrm[i * 2] = art.nrm[si * 2]; nrm[i * 2 + 1] = art.nrm[si * 2 + 1]; }
    }
  }
}
