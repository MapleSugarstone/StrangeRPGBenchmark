// Named map animations that scenes call with `> anim name args`.
import { CB } from '../combat/core';
import { WORLD, propAt, rebuildGrids, walkable } from '../world/world';
import { findActor, refreshNpcs, F, placeActor } from '../world/field';
import { PROPS } from '../world/props';
import { TILE_BY_CH } from '../world/tiles';
import { T } from '../world/tiles';
import { C, LIGHT } from '../engine/palette';
import { wait } from './sched';
import { sfx } from '../audio/sfx';
import { setFlag } from './state';

export const FXS = {
  spot: false,
  spotT: 0,
  flash: 0,
};

function burst(x: number, y: number, n: number, color: number, speed: number, glow = true) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random());
    CB.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.4, t: 0.5 + Math.random() * 0.6, color, glow });
  }
}

export async function anim(name: string, args: string[]) {
  const nx = Number(args[0]), ny = Number(args[1]);
  switch (name) {
    case 'spill': {
      let px = nx * T + 5, py = ny * T + 5;
      if (Number.isNaN(nx)) { const a = findActor(args[0]); if (a) { px = a.px + 5; py = a.py + 5; } }
      sfx('wake');
      WORLD.shake = 0.4;
      for (let k = 0; k < 4; k++) { burst(px, py, 26, C.red2, 70); burst(px, py, 8, C.red3, 40); await wait(0.08); }
      CB.flashes.push({ x: px, y: py, r: 70, i: 1.6, color: LIGHT.red, t: 0.6, life: 0.6 });
      await wait(0.5);
      return;
    }
    case 'spotlight': FXS.spot = args[0] !== 'off'; if (FXS.spot) sfx('drone'); return;
    case 'flash': FXS.flash = 0.18; sfx('explode', { vol: 0.5 }); await wait(0.2); return;
    case 'breathe': {
      const a = findActor(args[0]);
      if (a) { a.breathe = true; return; }
      const p = WORLD.props.find((q) => q.id === args[0]) ?? (Number.isNaN(nx) ? null : propAt(nx, ny));
      if (p) p.wake = { feeling: 'longing', turns: Infinity, by: 'line1' };
      return;
    }
    case 'still': {
      const a = findActor(args[0]);
      if (a) a.breathe = false;
      const p = WORLD.props.find((q) => q.id === args[0]);
      if (p) p.wake = null;
      return;
    }
    case 'tape': setFlag(args[0] ?? 'house_taped'); refreshNpcs(); return;
    case 'sparks': burst(nx * T + 5, ny * T + 5, 16, C.amb4, 50); sfx('shock'); return;
    case 'splash': burst(nx * T + 5, ny * T + 5, 20, C.cyan3, 50, false); sfx('splash'); return;
    case 'smoke': burst(nx * T + 5, ny * T + 5, 24, C.gray, 25, false); return;
    case 'shake': WORLD.shake = Number(args[0] ?? 0.5); return;
    case 'bailer': sfx('bailer'); WORLD.shake = 0.3; return;
    case 'down': {
      const a = findActor(args[0]);
      if (!a) return;
      sfx('fall');
      a.hold = true;
      a.path = [];
      for (let k = 0; k <= 3; k++) { a.lift = -k; await wait(0.05); }
      a.tint = C.slate;
      a.talk = undefined;
      return;
    }
    case 'hull': {
      const v = args[0] === 'on' ? 1 : args[0] === 'off' ? 0 : 2 + nx + ny * 100 + Number(args[2]) * 10000 + Number(args[3]) * 1000000;
      if (WORLD.def) setFlag(`hull_${WORLD.def.id}`, v);
      setHull(v);
      return;
    }
    case 'shift': {
      const p = WORLD.props.find((q) => q.id === args[0]);
      const tx = Number(args[1]), ty = Number(args[2]);
      if (!p) return;
      sfx('shove');
      const steps = Math.max(Math.abs(tx - p.x), Math.abs(ty - p.y)) * 6;
      const sx = p.x, sy = p.y;
      p.x = tx; p.y = ty;
      rebuildGrids();
      for (let k = steps; k >= 0; k--) { p.ox = Math.round((sx - tx) * T * k / Math.max(1, steps)); p.oy = Math.round((sy - ty) * T * k / Math.max(1, steps)); await wait(1 / 60); }
      p.ox = 0; p.oy = 0;
      return;
    }
    case 'hush': {
      const p = WORLD.props.find((q) => q.id === args[0]);
      if (p) { p.hushed = Infinity; p.wake = null; sfx('hush'); burst(p.x * T + 5, p.y * T + 2, 10, C.steel4, 20, false); }
      const a = findActor(args[0]);
      if (a) { a.tint = C.steel3; a.breathe = false; sfx('hush'); }
      return;
    }
    case 'rise': {
      const a = findActor(args[0]);
      if (!a) return;
      sfx('drone');
      for (let k = 0; k < 70; k++) { a.lift += 2 + Math.floor(k / 10); await wait(1 / 60); }
      WORLD.actors = WORLD.actors.filter((x) => x !== a);
      return;
    }
    case 'break': {
      const p = WORLD.props.find((q) => q.id === args[0]);
      if (!p) return;
      sfx('explode', { vol: 0.6 });
      burst(p.x * T + 5, p.y * T + 3, 18, C.gray, 45, false);
      WORLD.shake = 0.25;
      const debris = PROPS.get('debris');
      if (debris) { const keep = p.wake ?? { feeling: 'longing' as const, turns: Infinity, by: 'old' }; p.def = debris; p.wake = p.hushed > 0 ? null : keep; }
      else p.broken = true;
      rebuildGrids();
      return;
    }
    case 'ride': {
      if (args[0] === 'off') { await rideOff(); return; }
      const a = findActor(args[0]);
      if (!a) return;
      sfx('door');
      F.ride = a.id;
      for (const p of WORLD.actors) if (p.role === 'party') p.visible = false;
      return;
    }
    case 'open': {
      const f = args[0];
      const ps = WORLD.props.filter((p) => p.place.hideIf && p.place.hideIf.split('|').includes(f));
      sfx('door');
      for (let k = 1; k <= 16; k++) { for (const p of ps) { p.fade = k / 16; p.oy = -Math.floor(k / 3); } await wait(0.04); }
      setFlag(f);
      for (const p of ps) { p.fade = 0; p.oy = 0; }
      rebuildGrids();
      refreshNpcs();
      return;
    }
    case 'carry': {
      if (args[0] === 'off') {
        const c = F.carry;
        F.carry = null;
        const a = c ? findActor(c.carried) : null;
        const b = c ? findActor(c.carrier) : null;
        if (a && b) {
          for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) if (walkable(b.tx + dx, b.ty + dy)) { placeActor(a, b.tx + dx, b.ty + dy); break; }
          a.visible = true;
        }
        return;
      }
      const carried = findActor(args[1]);
      if (!carried || !findActor(args[0])) return;
      F.carry = { carrier: args[0], carried: args[1] };
      carried.visible = false;
      sfx('step');
      return;
    }
    case 'bailerfall': {
      const b = WORLD.bailers.find((x) => x.name.toLowerCase() === args[0].toLowerCase()) ?? WORLD.bailers[0];
      if (!b) return;
      b.stopped = true;
      const x0 = b.x;
      for (let k = 0; k < 24; k++) { b.x = x0 + Math.round(Math.sin(k * 0.7) * 2); await wait(0.06); }
      b.x = x0;
      b.dark = true;
      sfx('bailer');
      for (let k = 0; k < 30; k++) { b.sink = k; await wait(0.03); }
      burst(b.x, b.y, 40, C.cyan3, 70, false);
      sfx('splash');
      WORLD.shake = 0.8;
      await wait(0.6);
      WORLD.bailers = WORLD.bailers.filter((x) => x !== b);
      return;
    }
    case 'flood': {
      sfx('splash');
      WORLD.shake = 0.4;
      await floodMap(true);
      return;
    }
    case 'party': {
      const { pushScreen, PartyPick, MENU } = await import('../ui/menus');
      pushScreen(new PartyPick());
      const { until } = await import('./sched');
      await until(() => MENU.stack.length === 0);
      const { refreshParty } = await import('./runner');
      refreshParty();
      return;
    }
    case 'leavecamp': { const { leaveCamp } = await import('./runner'); await leaveCamp(); return; }
    default: console.warn(`[anim] unknown ${name}`);
  }
}

/** Water rises over the ground south of the map's open drop: the Deeps seen from above, flooding. */
export async function floodMap(animate: boolean) {
  const m = WORLD.map;
  if (!m) return;
  let first = -1;
  for (let y = 0; y < m.h && first < 0; y++) if (m.cells[y * m.w]?.tile.ch === ' ') first = y;
  if (first < 0) return;
  const water = TILE_BY_CH.get('w')!;
  for (let y = m.h - 1; y > first; y--) {
    let any = false;
    for (let x = 0; x < m.w; x++) {
      const c = m.cells[y * m.w + x];
      if (c && ['_', ',', '.', 'o', ':', 'm'].includes(c.tile.ch)) { m.cells[y * m.w + x] = { tile: water, elev: c.elev }; any = true; }
    }
    if (animate && any) await wait(0.12);
  }
}

/** Sets which part of the map breathes: 0 none, 1 all, otherwise an encoded tile rectangle. */
export function setHull(v: number) {
  if (!v) { WORLD.hull = null; return; }
  if (v === 1) { WORLD.hull = { all: true, x: 0, y: 0, w: 0, h: 0 }; return; }
  const n = v - 2;
  WORLD.hull = { all: false, x: n % 100, y: Math.floor(n / 100) % 100, w: Math.floor(n / 10000) % 100, h: Math.floor(n / 1000000) };
}

async function rideOff() {
  const id = F.ride;
  F.ride = null;
  const a = id ? findActor(id) : null;
  const party = WORLD.actors.filter((p) => p.role === 'party');
  if (!a) { for (const p of party) p.visible = true; return; }
  const spots: [number, number][] = [];
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1], [0, 2], [2, 0], [-2, 0], [0, -2]]) {
    const x = a.tx + dx, y = a.ty + dy;
    if (walkable(x, y) && !WORLD.actors.some((o) => o.visible && o.tx === x && o.ty === y)) spots.push([x, y]);
  }
  party.forEach((p, i) => {
    const s = spots[Math.min(i, spots.length - 1)] ?? [a.tx, a.ty + 1];
    placeActor(p, s[0], s[1]);
    p.visible = true;
  });
  F.trail = party.slice(1).map((p) => [p.tx, p.ty]);
  sfx('step');
}

/** Lights from running animations, added during the world render. */
export function animLights(add: (x: number, y: number, r: number, i: number, color: number, o?: { z?: number; dir?: number; spread?: number }) => void) {
  if (FXS.spot) {
    FXS.spotT += 1 / 60;
    const x = 100 + Math.sin(FXS.spotT * 0.7) * 70, y = 90 + Math.cos(FXS.spotT * 0.45) * 50;
    add(x, y, 34, 1.6, LIGHT.cold, { z: 60 });
  }
}
