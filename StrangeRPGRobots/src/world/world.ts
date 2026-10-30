// The live state of the current map: its parsed grid, prop instances, actors, camera, and particles.
import { cellAt, type GameMap, type PropPlace, type SignPlace, type LightPlace, type Dir, type MapDef, parseMap } from './map';
import { PROPS, type PropDef } from './props';
import type { Sheet } from '../art/people';
import { T, hash } from './tiles';
import { C, LIGHT } from '../engine/palette';
import { G, flag as flagOf } from '../game/state';

export type Feeling = 'anger' | 'fear' | 'calm' | 'joy' | 'grief' | 'longing';

export interface PropInst {
  def: PropDef;
  place: PropPlace;
  x: number;
  y: number;
  hp: number;
  broken: boolean;
  open: boolean;
  /** Woken state: feeling, turns left (Infinity for story wakes), and who woke it. */
  wake: { feeling: Feeling; turns: number; by: string } | null;
  hushed: number;
  /** Dither fade while an anim removes it, 0 to 1. */
  fade?: number;
  /** Pixel offset while a woken prop moves between tiles. */
  ox: number;
  oy: number;
  id: string;
}

export interface SignInst { place: SignPlace; broken: boolean }

export interface Actor {
  id: string;
  name: string;
  sheet: Sheet;
  /** Tile position. */
  tx: number;
  ty: number;
  /** Pixel position of the sprite's top left. */
  px: number;
  py: number;
  dir: Dir;
  /** Walk animation clock. */
  anim: number;
  moving: boolean;
  path: [number, number][];
  speed: number;
  role: 'party' | 'npc' | 'enemy' | 'crowd' | 'ally';
  talk?: string;
  wander?: number;
  home?: [number, number];
  patrol?: [number, number][];
  patrolAt?: number;
  idle: number;
  visible: boolean;
  /** Woken machines breathe. */
  breathe?: boolean;
  tint?: number;
  fade?: number;
  /** Combat unit bound to this actor, if any. */
  unit?: unknown;
  encounter?: string;
  bark?: string[];
  barkLine?: { text: string; t: number; color?: number };
  /** Elevation offset in pixels while climbing or falling. */
  lift: number;
  /** Detection meter for hostiles, 0 to 1. */
  alert: number;
  /** Hidden from view in stealth until revealed (for ambushers). */
  hiddenUnit?: boolean;
  /** Down and out of the fight (dissipated). */
  gone?: boolean;
  crowd?: boolean;
  /** Seconds left on an emote bubble. */
  emote?: { kind: string; t: number };
  /** Sees through walls and stealth (the Dowser). */
  seesAll?: boolean;
  /** An item a sneaking hero can lift from this NPC. */
  pocket?: string;
  /** Knocked out by a takedown. */
  out?: boolean;
  /** Facing locked by a scene. */
  hold?: boolean;
}

export interface Steam { x: number; y: number; age: number; life: number; seed: number }
export interface Drop { x: number; y: number; land: number; splash: number; layer: number }
export interface Bailer { name: string; path: [number, number][]; seg: number; t: number; x: number; y: number; dir: number; speed: number; stopped: boolean; step: number; dark?: boolean; sink?: number }

export const WORLD = {
  map: null as GameMap | null,
  def: null as MapDef | null,
  props: [] as PropInst[],
  signs: [] as SignInst[],
  lights: [] as LightPlace[],
  actors: [] as Actor[],
  cam: { x: 0, y: 0 },
  camTarget: null as null | { x: number; y: number },
  t: 0,
  steam: [] as Steam[],
  drops: [] as Drop[],
  bailers: [] as Bailer[],
  /** Tiles occupied by blocking props, rebuilt when props move or break. */
  blockGrid: new Uint8Array(0),
  coverGrid: new Uint8Array(0),
  shake: 0,
  /** Lights shot out on this visit, by prop or sign index. */
  dark: new Set<string>(),
  /** Automatic dim fill lights for dark stretches. */
  fill: [] as { x: number; y: number; c: number }[],
  /** Part of the map that breathes like a woken thing (the barge). */
  hull: null as null | { all: boolean; x: number; y: number; w: number; h: number },
};

export function loadWorld(def: MapDef) {
  const m = parseMap(def);
  WORLD.map = m;
  WORLD.def = def;
  WORLD.props = m.props.map((p, i) => {
    const d = PROPS.get(p.kind);
    if (!d) throw new Error(`Unknown prop ${p.kind} on ${def.id}`);
    return { def: d, place: p, x: p.x, y: p.y, hp: d.hp ?? 0, broken: false, open: false, wake: p.woken && !p.hushed ? { feeling: 'joy' as Feeling, turns: Infinity, by: 'old' } : null, hushed: p.hushed ? Infinity : 0, ox: 0, oy: 0, id: p.id ?? `${p.kind}_${i}` };
  });
  WORLD.signs = [...(def.signs ?? []), ...autoSigns(def, m)].map((s) => ({ place: s, broken: false }));
  WORLD.lights = def.lights ?? [];
  WORLD.actors = [];
  WORLD.steam = [];
  WORLD.drops = [];
  WORLD.dark = new Set();
  WORLD.hull = null;
  const hv = G.flags[`hull_${def.id}`];
  if (hv) {
    if (hv === 1) WORLD.hull = { all: true, x: 0, y: 0, w: 0, h: 0 };
    else { const n = hv - 2; WORLD.hull = { all: false, x: n % 100, y: Math.floor(n / 100) % 100, w: Math.floor(n / 10000) % 100, h: Math.floor(n / 1000000) }; }
  }
  WORLD.bailers = (def.bailers ?? []).filter((b) => (!b.showIf || flagOf(b.showIf)) && (!b.hideIf || !flagOf(b.hideIf))).map((b) => ({ name: b.name, path: b.path, seg: 0, t: 0, x: b.path[0][0] * T, y: b.path[0][1] * T, dir: 1, speed: b.speed ?? 6, stopped: false, step: 0 }));
  rebuildGrids();
  WORLD.fill = fillLights(def);
}

/** Dim neon wash on walkable tiles far from any placed light, so no street goes fully black. */
function fillLights(def: MapDef): { x: number; y: number; c: number }[] {
  if (def.inside || def.noFill) return [];
  const m = WORLD.map!;
  const src: [number, number][] = [];
  for (const l of def.lights ?? []) src.push([l.x, l.y]);
  for (const s of def.signs ?? []) if (s.light) src.push([s.x + 2, s.y + 1]);
  for (const p of WORLD.props) if (p.def.light) src.push([p.x, p.y]);
  const cols = def.district === 'brim' ? [0xb0d0ff, 0x4a7ac8] : def.district === 'stair' ? [0x8a70ff, 0xe8b44a, 0x2aa59a] : [0x8a70ff, 0x3ef0e8, 0xff3aa8];
  const out: { x: number; y: number; c: number }[] = [];
  for (let y = 4; y < m.h; y += 8) for (let x = 4; x < m.w; x += 8) {
    let best: [number, number] | null = null;
    for (let dy = -2; dy <= 2 && !best; dy++) for (let dx = -2; dx <= 2 && !best; dx++) { const c = m.cells[(y + dy) * m.w + (x + dx)]; if (c && c.tile.walk) best = [x + dx, y + dy]; }
    if (!best) continue;
    const [bx, by] = best;
    if (src.some(([sx, sy]) => Math.abs(sx - bx) + Math.abs(sy - by) < 6)) continue;
    out.push({ x: bx + 0.5, y: by + 0.5, c: cols[(bx * 7 + by * 3) % cols.length] });
  }
  return out;
}

const WORDS = ['BAR', 'OPEN', 'EEL', 'FIX', 'SOUP', '24H', 'PAWN', 'TEA', 'CHROME', 'NOODLE', 'KARAOKE', 'RAMEN', 'CASH', 'LIVE', 'HOTEL', 'DRY', 'BATH', 'SCRAP', 'PORTS', 'LUCK'];
const ICON_NAMES = ['bowl', 'eye', 'cross', 'glass', 'chip', 'fish', 'pill', 'bolt', 'star', 'heart', 'key', 'wave', 'wrench'];
const SIGN_COLORS: Record<string, [number, number][]> = {
  deeps: [[C.mag3, LIGHT.magenta], [C.cyan3, LIGHT.cyan], [C.grn3, LIGHT.green], [C.amb3, LIGHT.amber], [C.vio3, LIGHT.violet]],
  stair: [[C.vio3, LIGHT.violet], [C.amb3, LIGHT.amber], [C.cyan3, LIGHT.cyan], [C.mag3, LIGHT.magenta]],
  brim: [[C.cyan4, LIGHT.cold], [C.pale, LIGHT.white], [C.amb3, LIGHT.amber]],
  flats: [[C.amb3, LIGHT.amber], [C.cyan3, LIGHT.cyan]],
};

/** Neon signs on ground-floor facades, placed by hash so a street always looks the same. */
function autoSigns(def: MapDef, m: GameMap): SignPlace[] {
  if (def.inside || def.noFill || def.district === 'inside') return [];
  const cols = SIGN_COLORS[def.district] ?? SIGN_COLORS.deeps;
  const out: SignPlace[] = [];
  const near = (x: number, y: number) => [...(def.signs ?? []), ...out].some((s) => Math.abs(s.x - x) < 6 && Math.abs(s.y - y) < 3);
  for (let ty = 1; ty < m.h - 1; ty++) {
    for (let tx = 1; tx < m.w - 1; tx++) {
      const c = m.cells[ty * m.w + tx].tile;
      if (!c.wall || c.ch === 'X' || c.ch === 'I') continue;
      if (m.cells[(ty + 1) * m.w + tx].tile.wall) continue;
      if (!m.cells[(ty + 1) * m.w + tx].tile.walk) continue;
      if (hash(tx, ty, 77) > 0.16) continue;
      const tall = (c.faceRows ?? 1) >= 2 && m.cells[(ty - 1) * m.w + tx].tile === c;
      const sy = tall ? ty - 1 + 0.2 : ty + 0.15;
      if (near(tx, sy)) continue;
      let run = 0;
      while (tx + run < m.w && m.cells[ty * m.w + tx + run].tile.wall && !m.cells[(ty + 1) * m.w + tx + run].tile.wall) run++;
      const [color, light] = cols[Math.floor(hash(tx, ty, 78) * cols.length)];
      const word = WORDS[Math.floor(hash(tx, ty, 79) * WORDS.length)];
      if (hash(tx, ty, 80) < 0.45 && run * 10 >= word.length * 6 + 2) out.push({ x: tx + 0.1, y: sy, text: word, color, light, r: 28, holo: hash(tx, ty, 81) < 0.15 });
      else out.push({ x: tx + 0.1, y: sy, icon: ICON_NAMES[Math.floor(hash(tx, ty, 82) * ICON_NAMES.length)], color, light, r: 24 });
    }
  }
  return out;
}

export function propVisible(p: PropInst, flag: (f: string) => boolean): boolean {
  if (p.place.showIf && !flag(p.place.showIf)) return false;
  if (p.place.hideIf && flag(p.place.hideIf)) return false;
  return true;
}

/** Marks tiles blocked by props and the cover they give. */
export function rebuildGrids() {
  const m = WORLD.map!;
  WORLD.blockGrid = new Uint8Array(m.w * m.h);
  WORLD.coverGrid = new Uint8Array(m.w * m.h);
  for (const p of WORLD.props) {
    if (p.broken && !p.def.explode) {
      continue;
    }
    if (p.broken) continue;
    const w = p.def.w ?? 1, h = p.def.h ?? 1;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const x = p.x + dx, y = p.y + dy;
      if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
      if (p.def.block) WORLD.blockGrid[y * m.w + x] = 1;
      WORLD.coverGrid[y * m.w + x] = Math.max(WORLD.coverGrid[y * m.w + x], p.def.cover);
    }
  }
}

export function propAt(x: number, y: number): PropInst | null {
  for (const p of WORLD.props) {
    if (p.broken) continue;
    const w = p.def.w ?? 1, h = p.def.h ?? 1;
    if (x >= p.x && x < p.x + w && y >= p.y && y < p.y + h) return p;
  }
  return null;
}

export function actorAt(x: number, y: number, except?: Actor): Actor | null {
  for (const a of WORLD.actors) if (a !== except && a.visible && !a.gone && a.tx === x && a.ty === y) return a;
  return null;
}

/** True when a tile can be walked: floor, no blocking prop. Actors are checked separately. */
export function walkable(x: number, y: number): boolean {
  const m = WORLD.map;
  if (!m) return false;
  if (!(x >= 0 && y >= 0 && x < m.w && y < m.h)) return false;
  if (!cellAt(m, x, y).tile.walk) return false;
  if (WORLD.blockGrid[y * m.w + x]) return false;
  return true;
}

export function elevAt(x: number, y: number): number {
  const m = WORLD.map;
  if (!m) return 0;
  return cellAt(m, x, y).elev;
}

/** Walks the Bailers along their paths. */
export function updateBailers(dt: number) {
  for (const b of WORLD.bailers) {
    if (b.stopped) continue;
    const c = b.path[(b.seg + 1) % b.path.length];
    const tx = c[0] * T, ty = c[1] * T;
    const dx = tx - b.x, dy = ty - b.y;
    const d = Math.hypot(dx, dy);
    b.step += dt * 1.1;
    if (d < 1) { b.seg = (b.seg + 1) % b.path.length; if (b.seg === 0 && b.path.length === 2) { b.x = b.path[0][0] * T; b.y = b.path[0][1] * T; } continue; }
    b.dir = dx < 0 ? -1 : dx > 0 ? 1 : b.dir;
    const st = Math.min(d, b.speed * dt);
    b.x += (dx / d) * st; b.y += (dy / d) * st;
  }
}
