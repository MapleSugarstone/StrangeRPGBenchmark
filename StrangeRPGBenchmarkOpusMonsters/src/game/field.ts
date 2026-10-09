import type { Mon, SpriteData } from '../battle/model';
import { makeMon, SPECIES } from '../data/species';
import { text, textCenter, textWidth } from '../engine/font';
import { input } from '../engine/input';
import { clear, dither, faded, layer, rect, INK, ctx } from '../engine/screen';
import { drawSprite, PEOPLE, vellumSprite } from '../engine/sprites';
import { sfx } from '../engine/audio';
import { music } from '../engine/music';
import { battle, type BattleOutcome } from './battleView';
import { choose, hint, notice, say } from './dialogue';
import { offerName } from './files';
import { close, run, type Mode } from './modes';
import { G, HERO, STRAND_START, addMon, loosened, save, scaleNow, seen, wearingUnlocked } from './state';
import { drawTile, isSolid, LEDGE, REGIONS, type Pal } from './tiles';
import { backdropKey, sceneNow } from './backdrops';
import { drawFieldFx, type Figure } from './fieldfx';
import { ringLit } from './strandfx';
import { drawProp, PROPS } from './props';
import { MAPS, SCRIPTS, SPAWNS, type MapDef, type NpcDef, type TrainerDef } from './world';
import { box, PAPER, SEL } from './ui';
import { wildFit } from './wildfit';
import { drawAura, rollStarborn } from '../data/starborn';
import { bend, drawOver, drawPrints, drawUnder, idleLook, puff, ripple, walked, withEyes } from './feel';

const DX = [0, 1, 0, -1];
const DY = [1, 0, -1, 0];

export type EmoteKind = 'surprise' | 'question' | 'silence' | 'music' | 'sweat' | 'anger' | 'heart' | 'sleep';
/** Actions with an offset play for a set time. 'look' turns left then right, and 'back' steps back a tile still facing forward. */
export type ActKind = 'hop' | 'shiver' | 'bow' | 'nod' | 'lift' | 'look' | 'back';
const ACT_FRAMES: Record<ActKind, number> = { hop: 16, shiver: 30, bow: 30, nod: 24, lift: 36, look: 42, back: 12 };
const EMOTE_FRAMES = 64;
interface SceneProp { key: string; what: string; x: number; y: number; a: number; to: number; step: number }

const toward = (a: number, b: number, s: number) => (a < b ? Math.min(b, a + s) : Math.max(b, a - s));

/** 5 by 5 icons for the bubbles, with their colors. */
const EMOTE_ICONS: Record<EmoteKind, [string, string[]]> = {
  surprise: ['#c83030', ['..X..', '..X..', '..X..', '.....', '..X..']],
  question: ['#3048b0', ['.XXX.', '...X.', '..X..', '.....', '..X..']],
  silence: [INK, ['.....', '.....', 'X.X.X', '.....', '.....']],
  music: ['#7838b0', ['..XX.', '..X.X', '..X..', 'XXX..', 'XX...']],
  sweat: ['#3080d0', ['..X..', '.XX..', '.XXX.', 'XXXX.', '.XX..']],
  anger: ['#c83030', ['.X.X.', 'XX.XX', '.....', 'XX.XX', '.X.X.']],
  heart: ['#d84878', ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..']],
  sleep: ['#5a6ab0', ['XXX..', '..X..', '.X.XX', 'XXX.X', '...XX']],
};

/** A speech bubble 9 pixels square with its tail at the bottom middle, holding an icon. */
function drawEmote(kind: EmoteKind, x: number, y: number): void {
  rect(x + 1, y, 7, 9, INK); rect(x, y + 1, 9, 7, INK);
  rect(x + 1, y + 1, 7, 7, '#f8f4e8');
  rect(x + 4, y + 9, 1, 1, INK);
  const [c, rows] = EMOTE_ICONS[kind];
  rows.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === 'X') rect(x + 2 + i, y + 2 + j, 1, 1, c); });
}

/** A thing a scene placed: a tile, a whorl's or a person's sprite, or a prop, faded by its alpha. */
function drawSceneProp(sp: SceneProp, x: number, y: number, p: Pal, slack: number, t: number): void {
  if (sp.a <= 0) return;
  const w = sp.what;
  if (w.length === 1) { faded(8, 8, x, y, sp.a, () => drawTile(w, 0, 0, sp.x, sp.y, p, slack, t)); return; }
  if (w.startsWith('mon:')) {
    const s = SPECIES[w.slice(4)];
    if (s) faded(8, 8, x, y, sp.a, () => drawSprite({ px: s.sprite, c: s.c } as SpriteData, 0, 0));
    return;
  }
  if (w.startsWith('person:')) { const s = PEOPLE[w.slice(7)]; if (s) faded(8, 8, x, y, sp.a, () => drawSprite(s, 0, 0)); return; }
  const pp = PROPS[w];
  faded(((pp?.w || 2) + 2) * 8, ((pp?.h || 2) + 2) * 8, x - 8, y - 8, sp.a, () => drawProp(w, 8, 8, t));
}

interface Wanderer { id: number; mon: Mon; x: number; y: number; px: number; py: number; t: number; dir: number }
/**
 * A thing on the map that moves: a haul stone (saved where Ouro left it), a floe (back at its start on every visit), or a round stone that rolls.
 * A sunk round stone fills the hole it fell in. `temp` things sit in an unsolved basin and are not saved.
 */
export interface FieldObj { kind: 'stone' | 'floe' | 'ball'; x: number; y: number; px: number; py: number; key: string; sunk?: boolean; temp?: boolean }
/** Ground a dragged haul stone can come to rest on. */
const STONE_GROUND = new Set(['.', '=', 's', '_', 'x', 'n', 'b', 'G', 'g']);
/** `lx`, `ly` is the tile a person last stood on, so a step shows when they leave it. */
interface NpcState { def: NpcDef; x: number; y: number; px: number; py: number; dir: number; hidden: boolean; bang: number; t: number; lx: number; ly: number; ri?: number }

let seed = 1;
function rnd(): number { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }

export class Field implements Mode {
  opaque = true;
  map!: MapDef;
  px = 0; py = 0;
  x = 0; y = 0;
  dir = 0;
  moving = 0;
  busy = 0;
  wanderers: Wanderer[] = [];
  npcs: NpcState[] = [];
  t = 0;
  fade = 0;
  /** Darkness laid over the screen while a map change fades out, in twelfths. */
  dimOut = 0;
  banner = 0;
  wearing = false;
  shakeT = 0;
  flashT = 0;
  goalText = '';
  goalT = 0;
  menuOpener: (() => Promise<void>) | null = null;
  overlay: ((f: Field) => void) | null = null;
  removed = new Set<number>();
  cam: [number, number] = [0, 0];
  uphill = false;
  stepCount = 0;
  /** Steps taken since this map loaded. */
  mapSteps = 0;
  /** Called after every completed step that does not warp or slide. Puzzles use it to react to movement. */
  stepHooks: ((f: Field) => void)[] = [];
  /** The direction of the last completed step, for puzzles that move things in step with Vellum. */
  lastStep = -1;
  /** Tiles seen on a fogged map, as y * width + x. */
  seenTiles = new Set<number>();
  /** The lead whorl walking one tile behind Ouro: its tile, its pixel position, its facing, and Ouro's last tile. */
  fol = { x: 0, y: 0, px: 0, py: 0, dir: 0, lastX: 0, lastY: 0, hop: false };
  /** Frames since Ouro last moved or the player last pressed anything, for Ouro's idle eyes. */
  idle = 0;
  /** Haul stones and floes on this map. */
  objs: FieldObj[] = [];
  /** The haul stone Ouro has hold of, or null. */
  held: FieldObj | null = null;
  /** The way Ouro is moving, which differs from the way Ouro faces while backing away with a stone. */
  stepDir = 0;
  /** True while Ouro hops down a ledge. */
  hopping = false;
  /** Runs when Ouro faces a tile and presses the button, before people and spots: crusts, haul stones, and the like. Returns true when it handled the press. */
  tileHandlers: ((f: Field, x: number, y: number, ch: string) => boolean)[] = [];
  /** Extra say on whether Ouro may walk onto a tile: shallows, for one. Returns true or false to decide, or null to leave it to the tile. */
  passHooks: ((f: Field, x: number, y: number, ch: string) => boolean | null)[] = [];
  /** Runs on every map load, after the map's people are placed. */
  loadHooks: ((f: Field) => void)[] = [];
  /** The person Ouro last pressed the button at, for talk scripts shared by many people. */
  talkNpc: NpcDef | null = null;
  /** A fixed camera for whole-map pictures, or null to follow Ouro. */
  camAt: [number, number] | null = null;
  /** The map a Lure Shell was used on, until a whorl comes out there. */
  lureMap: string | null = null;

  // Scene state. A map load clears all of it.
  /** Bubbles over people: who ('ouro', 'whorl', or a person's id), the kind, and frames shown. */
  emotes: { who: string; kind: EmoteKind; t: number }[] = [];
  /** Starborn whorls on screen this frame, given their halo and twinkle after the light pass so it does not dim them. */
  starFigs: { s: SpriteData; x: number; y: number; flip: boolean; seed: number }[] = [];
  /** Short sprite actions playing, by who. */
  acts = new Map<string, { kind: ActKind; t: number; dur: number }>();
  /** People fading in or out, by id. Alpha 1 is drawn plainly. */
  fades = new Map<string, { a: number; to: number; step: number }>();
  /** The camera while a scene pans, in pixels, and where it is going ('back' follows Ouro again). */
  panAt: [number, number] | null = null;
  panGoal: [number, number] | 'back' | null = null;
  /** Things a scene placed on the map, faded in and out. */
  sceneProps: SceneProp[] = [];
  /** A dithered color over the whole field, moving toward tintTo by tintStep a frame. */
  tintC = INK; tintA = 0; tintTo = 0; tintStep = 0;
  /** Scene walks that found no way through, for the scene checks. */
  lostWalks: string[] = [];

  placeFollower(): void {
    this.fol = { x: this.x, y: this.y, px: this.x * 8, py: this.y * 8, dir: this.dir, lastX: this.x, lastY: this.y, hop: false };
  }

  /** Moves the follower onto the tile Ouro just left. A ledge hop it follows a step later, and any other jump longer than one tile puts it under Ouro. */
  tickFollower(): void {
    const f = this.fol;
    if (this.x !== f.lastX || this.y !== f.lastY) {
      const gap = Math.abs(this.x - f.lastX) + Math.abs(this.y - f.lastY);
      const hop = gap === 2 && this.hopping && (this.x === f.lastX || this.y === f.lastY);
      if (gap > 1 && !hop) { this.placeFollower(); return; }
      const dx = f.lastX - f.x, dy = f.lastY - f.y;
      if (dx || dy) f.dir = dy > 0 ? 0 : dx > 0 ? 1 : dy < 0 ? 2 : 3;
      if ((dx || dy) && G.party[0] && !this.wearing) walked('follower', f.x, f.y, f.dir, { mon: G.party[0], vol: 0.45, sound: true });
      f.x = f.lastX; f.y = f.lastY;
      f.lastX = this.x; f.lastY = this.y;
    }
    const sp = Math.abs(f.px - f.x * 8) + Math.abs(f.py - f.y * 8) > 8 || input.held('fast') ? 2 : 1;
    f.px += Math.max(-sp, Math.min(sp, f.x * 8 - f.px));
    f.py += Math.max(-sp, Math.min(sp, f.y * 8 - f.py));
  }

  reveal(): void {
    if (!this.map.fog) return;
    const W = this.map.rows[0].length;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (Math.abs(dx) + Math.abs(dy) <= 4) this.seenTiles.add((this.y + dy) * W + this.x + dx);
  }

  load(id: string, x: number, y: number, dir = this.dir): void {
    const m = MAPS[id];
    if (!m) throw new Error(`no map ${id}`);
    this.map = m;
    this.x = x; this.y = y; this.dir = dir;
    this.px = x * 8; this.py = y * 8;
    this.placeFollower();
    G.map = id; G.x = x; G.y = y; G.dir = dir;
    this.npcs = m.npcs.map(d => ({ def: d, x: d.x, y: d.y, px: d.x * 8, py: d.y * 8, dir: d.dir ?? 0, hidden: false, bang: 0, t: 0, lx: d.x, ly: d.y }));
    this.loadObjs();
    this.mapSteps = 0;
    for (const h of this.loadHooks) h(this);
    this.spawnWanderers();
    this.banner = m.indoor ? 0 : 90;
    this.overlay = null;
    this.emotes = []; this.acts.clear(); this.fades.clear(); this.sceneProps = [];
    this.panAt = null; this.panGoal = null; this.tintA = 0; this.tintTo = 0;
    this.seenTiles.clear();
    this.reveal();
    scaleNow.strand = !!m.strand;
    if (m.strand) for (const w of [...G.party, ...G.rack]) if (!w.strand && !w.strandBorn) w.strand = { level: STRAND_START, xp: 0 };
    sceneNow.key = backdropKey(m.id, m.region, !!m.indoor);
    sceneNow.dusk = 0;
    if (m.music) music.play(m.music);
    // The Strand's music carries the tide as a layer, and play() starts every track at intensity 0.
    if (m.strand) music.setIntensity(G.flags.tide ? 1 : 0.2);
    if (this.wearing && !this.canWearHere()) this.wearing = false;
  }

  canWearHere(): boolean { return true; }

  /** Plays this map's music. On the Strand it also sets the tide's layer, since play() starts every track at 0. */
  playMapMusic(): void {
    if (!this.map.music) return;
    music.play(this.map.music);
    if (this.map.strand) music.setIntensity(G.flags.tide ? 1 : 0.2);
  }

  tile(x: number, y: number): string {
    if (this.objs.length) {
      const o = this.objs.find(o => o.x === x && o.y === y && !o.sunk) || this.objs.find(o => o.x === x && o.y === y);
      if (o) return o.kind === 'floe' ? '*' : o.kind === 'ball' ? (o.sunk ? '.' : 'o') : o.sunk ? '&' : '@';
    }
    if (this.map.mods) for (const md of this.map.mods) if (y === md.y && x >= md.x && x < md.x + (md.w || 1) && md.when()) return md.ch;
    const r = this.map.rows[y];
    if (!r || x < 0 || x >= r.length) return 'v';
    const ch = r[x];
    if (ch >= '1' && ch <= '8') return loosened() >= Number(ch) ? 'z' : '.';
    if (ch === '@' || ch === 'o') return '.';
    if (ch === '*') return '~';
    if (ch === '%' && G.flags[crustKey(this.map.id, x, y)]) return '.';
    return ch;
  }

  /** Finds every haul stone, floe, and round stone in the map's rows. A stone stands where Ouro last left it. */
  loadObjs(): void {
    this.objs = [];
    this.held = null;
    const b = this.map.basin;
    this.map.rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) {
        const ch = r[x];
        if (ch !== '@' && ch !== '*' && ch !== 'o') continue;
        const kind = ch === '@' ? 'stone' : ch === 'o' ? 'ball' : 'floe';
        const key = `${kind}:${this.map.id}:${x},${y}`;
        const temp = !!b && !G.flags[b.flag] && x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h;
        const o: FieldObj = { kind, x, y, px: x * 8, py: y * 8, key, temp };
        const at = kind !== 'floe' && !temp ? G.flags[key] : 0;
        if (at) { o.x = (at - 1) % 1000; o.y = Math.floor((at - 1) / 1000); o.px = o.x * 8; o.py = o.y * 8; o.sunk = !!G.flags[key + 's']; }
        this.objs.push(o);
      }
    });
  }

  objAt(x: number, y: number): FieldObj | undefined { return this.objs.find(o => o.x === x && o.y === y && !(o.kind === 'ball' && o.sunk)); }

  /** Moves a haul stone or round stone and remembers where it stands, unless it sits in an unsolved basin. */
  placeStone(o: FieldObj, x: number, y: number, sunk = false): void {
    o.x = x; o.y = y; o.sunk = sunk;
    if (o.temp) return;
    G.flags[o.key] = y * 1000 + x + 1;
    if (sunk) G.flags[o.key + 's'] = 1;
  }

  /** Saves every stone in the basin where it lies now, once the basin's puzzle is solved. */
  settleBasin(): void {
    for (const o of this.objs) if (o.temp) { o.temp = false; this.placeStone(o, o.x, o.y, o.sunk); }
  }

  /** Ouro walks into a round stone going `d`. It rolls until something stops it, or drops into a hole and fills it. It never rolls up the lean. */
  roll(o: FieldObj, d: number): boolean {
    const sl = this.map.slope;
    if (sl && Math.abs(o.x + DX[d] - sl[0]) > Math.abs(o.x - sl[0])) return false;
    let x = o.x, y = o.y, into = false;
    for (;;) {
      const nx = x + DX[d], ny = y + DY[d];
      if (this.tile(nx, ny) === 'O') { x = nx; y = ny; into = true; break; }
      if (!this.passable(nx, ny) || this.wanderers.some(w => w.x === nx && w.y === ny) || (nx === this.x && ny === this.y)) break;
      x = nx; y = ny;
    }
    if (x === o.x && y === o.y) return false;
    const steps = Math.abs(x - o.x) + Math.abs(y - o.y);
    this.placeStone(o, x, y);
    void this.runBusy(async () => {
      for (let i = 0; i < steps * 4; i += 4) { sfx('move'); await this.waitFrames(4); }
      if (into) { this.placeStone(o, x, y, true); sfx('hitBig'); this.shakeT = 6; }
    });
    return true;
  }

  leadTypes(): string[] { return G.party[0]?.types || []; }

  passable(x: number, y: number): boolean {
    const ch = this.tile(x, y);
    for (const h of this.passHooks) {
      const r = h(this, x, y, ch);
      if (r === false) return false;
      if (r === true) return !this.npcs.some(n => !n.hidden && this.npcVisible(n) && !n.def.ghost && n.x === x && n.y === y);
    }
    if (this.wearing) {
      const ts = this.leadTypes();
      if ((ch === 'z' || ch === 'Z') && ts.includes('STONE')) return true;
      if (ch === '~' && ts.includes('TIDE')) return true;
      if (ch === 'k' && ts.includes('ROOT')) return true;
      if (ch === 'm' && ts.includes('GEAR')) return true;
      if (ch === 'l' && ts.includes('BEAST')) return true;
      if (ch === 'Y' && ts.includes('SALT')) return true;
      if (ch === 'M' && ts.includes('VOID')) return true;
      if (ch === ':' && ts.includes('TIDE')) return true;
    }
    if (isSolid(ch) && !(ch === ':' && G.keys.includes('stilts'))) return false;
    for (const n of this.npcs) if (!n.hidden && this.npcVisible(n) && !n.def.ghost && n.x === x && n.y === y) return false;
    return true;
  }

  npcVisible(n: NpcState): boolean { return (!n.def.when || n.def.when()) && !(n.def.sleeper && G.flags[n.def.sleeper.flag]); }

  spawnWanderers(): void {
    this.wanderers = [];
    const z0 = this.map.zone;
    const z = z0?.tideKinds ? { ...z0, kinds: G.flags.tide ? z0.tideKinds.high : z0.tideKinds.low } : z0;
    if (!z || !z.kinds.length) return;
    seed = (G.time * 7919 + this.map.id.length * 104729 + Math.floor(performance.now())) % 2147483646 + 1;
    const cells: [number, number][] = [];
    this.map.rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === ',') cells.push([x, y]); });
    const total = z.kinds.reduce((n, k) => n + k[1], 0);
    for (let i = 0; i < z.n && cells.length; i++) {
      const [cx, cy] = cells[Math.floor(rnd() * cells.length)];
      if (Math.abs(cx - this.x) + Math.abs(cy - this.y) < 4) continue;
      if (this.wanderers.some(w => w.x === cx && w.y === cy)) continue;
      let r = rnd() * total, kind = z.kinds[0][0];
      for (const [k, wgt] of z.kinds) { r -= wgt; if (r <= 0) { kind = k; break; } }
      const lv = z.lv[0] + Math.floor(rnd() * (z.lv[1] - z.lv[0] + 1));
      const mon = rollStarborn(z.fitted && rnd() < z.fitted ? wildFit(rnd, z, lv) : makeMon(kind, lv), rnd);
      this.wanderers.push({ id: i + 1, mon, x: cx, y: cy, px: cx * 8, py: cy * 8, t: 30 + Math.floor(rnd() * 60), dir: 0 });
    }
  }

  // ------------------------------------------------------------ update

  tick(): void {
    this.t++;
    if (this.fade > 0) this.fade--;
    if (this.banner > 0) this.banner--;
    if (this.shakeT > 0) this.shakeT--;
    if (this.flashT > 0) this.flashT--;
    if (this.goalT > 0) this.goalT--;
    for (const n of this.npcs) {
      if (n.bang > 0) n.bang--;
      // A person hurried along by a scene catches up two pixels a frame.
      const sp = Math.abs(n.px - n.x * 8) + Math.abs(n.py - n.y * 8) > 8 ? 2 : 1;
      n.px += Math.max(-sp, Math.min(sp, n.x * 8 - n.px));
      n.py += Math.max(-sp, Math.min(sp, n.y * 8 - n.py));
      if (n.x !== n.lx || n.y !== n.ly) {
        // A person who walks leaves prints and makes quiet steps. A whorl standing in for a person leaves its own.
        if (Math.abs(n.x - n.lx) + Math.abs(n.y - n.ly) === 1 && this.npcVisible(n) && !n.hidden && !n.def.ghost) {
          walked('npc:' + n.def.id, n.lx, n.ly, n.dir, { mon: n.def.mon ? SPECIES[n.def.mon] : null, vol: 0.35, sound: true });
        }
        n.lx = n.x; n.ly = n.y;
      }
    }
    if (this.moving > 0 && this.busy) {
      this.moving--;
      this.px += DX[this.stepDir];
      this.py += DY[this.stepDir];
    }
    for (const e of this.emotes) e.t++;
    if (this.emotes.length) this.emotes = this.emotes.filter(e => e.t < EMOTE_FRAMES);
    for (const [k, a] of this.acts) if (++a.t >= a.dur) this.acts.delete(k);
    for (const [k, f] of this.fades) { f.a = toward(f.a, f.to, f.step); if (f.a === f.to && f.to >= 1) this.fades.delete(k); }
    for (const p of this.sceneProps) p.a = toward(p.a, p.to, p.step);
    if (this.sceneProps.length) this.sceneProps = this.sceneProps.filter(p => p.a > 0 || p.to > 0);
    this.tintA = toward(this.tintA, this.tintTo, this.tintStep);
    if (this.panAt && this.panGoal) {
      const g = this.panGoal === 'back' ? this.followCam() : this.panGoal;
      const dx = g[0] - this.panAt[0], dy = g[1] - this.panAt[1];
      const sp = Math.max(1, Math.min(3, Math.ceil(Math.hypot(dx, dy) / 24)));
      this.panAt = [this.panAt[0] + Math.max(-sp, Math.min(sp, dx)), this.panAt[1] + Math.max(-sp, Math.min(sp, dy))];
      if (!dx && !dy && this.panGoal === 'back') { this.panAt = null; this.panGoal = null; }
    }
    const osp = input.held('fast') ? 2 : 1;
    for (const o of this.objs) {
      const sp = o.kind === 'ball' ? 2 : osp;
      o.px += Math.max(-sp, Math.min(sp, o.x * 8 - o.px));
      o.py += Math.max(-sp, Math.min(sp, o.y * 8 - o.py));
    }
    this.tickFollower();
    if (this.moving > 0 || this.busy) this.idle = 0; else this.idle++;
    if (this.wearing && this.moving === 0 && this.t % 110 === 0 && this.tile(this.x, this.y) === '~') ripple(this.x * 8 + 4, this.y * 8 + 7, this.t);
  }

  /** Ouro walked off tile x, y heading `dir`. */
  leave(x: number, y: number, dir: number): void {
    const worn = this.wearing ? G.party[0] : null;
    walked('ouro', x, y, dir, { mon: worn, vol: 1, sound: true, wading: this.tile(x, y) === ':' || (this.wearing && this.tile(x, y) === '~') });
  }

  update(): void {
    for (const n of this.npcs) {
      if (this.busy || n.hidden || !this.npcVisible(n)) continue;
      if (n.def.wander && --n.t <= 0) {
        n.t = 90 + Math.floor(rnd() * 120);
        const d = Math.floor(rnd() * 4);
        const nx = n.x + DX[d], ny = n.y + DY[d];
        if (Math.abs(nx - n.def.x) <= 2 && Math.abs(ny - n.def.y) <= 2 && this.passable(nx, ny) && !(nx === this.x && ny === this.y)) { n.x = nx; n.y = ny; n.dir = d; }
      }
      if (n.def.route) this.walkRoute(n);
      const idle = n.def.idle;
      // Each one keeps its own beat, so a street of people does not move at once. Ambient bubbles make no sound.
      if (idle && (this.t + n.def.x * 37 + n.def.y * 61) % idle.every === 0) {
        if (idle.act && !this.acts.has(n.def.id)) this.acts.set(n.def.id, { kind: idle.act, t: 0, dur: ACT_FRAMES[idle.act] });
        if (idle.emote && !this.emotes.some(e => e.who === n.def.id)) this.emotes.push({ who: n.def.id, kind: idle.emote, t: 0 });
      }
      if (n.def.pair && n.px === n.x * 8 && n.py === n.y * 8) this.faceToward(n.def.id, Math.abs(this.x - n.x) + Math.abs(this.y - n.y) <= 2 ? 'ouro' : n.def.pair);
    }
    this.updateWanderers();
    if (this.moving > 0 && !this.busy) {
      if (this.uphill && this.t % 2 === 0) return;
      this.moving--;
      this.px += DX[this.stepDir];
      this.py += DY[this.stepDir];
      if (input.held('fast') && this.moving > 0) { this.moving--; this.px += DX[this.stepDir]; this.py += DY[this.stepDir]; }
      if (this.moving <= 0) this.arrive();
      return;
    }
    if (this.busy) return;
    if (input.hit('back') && this.menuOpener) { sfx('ok'); this.runBusy(this.menuOpener); return; }
    if (input.hit('goal')) { this.goalT = 180; return; }
    if (input.hit('wear')) { this.toggleWear(); return; }
    if (input.hit('ok')) { this.interact(); return; }
    for (const [b, d] of [['down', 0], ['right', 1], ['up', 2], ['left', 3]] as const) {
      if (input.held(b)) {
        if (this.held && this.dragStep(d)) return;
        this.dir = d; this.stepDir = d;
        const nx = this.x + DX[d], ny = this.y + DY[d];
        const w = this.wanderers.find(w => w.x === nx && w.y === ny);
        if (w) { this.leave(this.x, this.y, d); this.x = nx; this.y = ny; this.moving = 8; this.stepCount++; return; }
        const ball = this.objs.find(o => o.kind === 'ball' && !o.sunk && o.x === nx && o.y === ny);
        if (ball) { if (!this.roll(ball, d) && this.t % 16 === 0) { sfx('bump'); puff(this.x, this.y, d, this.t); } return; }
        const drop = LEDGE[this.tile(nx, ny)];
        if (drop !== undefined) {
          // A ledge is a drop on one side and a wall on the other three. Wearing a BEAST whorl also climbs it from below.
          const lx = nx + DX[d], ly = ny + DY[d];
          const climb = (drop + 2) % 4 === d && this.wearing && this.leadTypes().includes('BEAST');
          if ((drop === d || climb) && this.passable(lx, ly) && !this.wanderers.some(o => o.x === lx && o.y === ly)) {
            this.leave(this.x, this.y, d);
            this.x = lx; this.y = ly; this.moving = 16; this.hopping = true; this.uphill = false; this.stepCount++; this.lastStep = d;
            sfx('move');
          } else if (this.t % 16 === 0) { sfx('bump'); puff(this.x, this.y, d, this.t); }
          return;
        }
        if (this.passable(nx, ny)) {
          const sl = this.map.slope;
          this.uphill = !!sl && Math.abs(nx - sl[0]) + Math.abs(ny - sl[1]) > Math.abs(this.x - sl[0]) + Math.abs(this.y - sl[1]);
          this.leave(this.x, this.y, d);
          this.x = nx; this.y = ny; this.moving = 8; this.stepCount++; this.lastStep = d;
        }
        else if (this.t % 16 === 0) { sfx('bump'); puff(this.x, this.y, d, this.t); }
        return;
      }
    }
  }

  updateWanderers(): void {
    if (this.busy) return;
    for (const w of this.wanderers) {
      if (w.px < w.x * 8) w.px++; else if (w.px > w.x * 8) w.px--;
      if (w.py < w.y * 8) w.py++; else if (w.py > w.y * 8) w.py--;
      if (--w.t > 0) continue;
      w.t = 40 + Math.floor(rnd() * 80);
      let d = Math.floor(rnd() * 4);
      // Under a Salt Line, a whorl near Ouro steps the way that takes it furthest from Ouro.
      if (G.flags.saltLine > 0 && Math.abs(w.x - this.x) + Math.abs(w.y - this.y) <= 5) {
        const far = (k: number) => Math.abs(w.x + DX[k] - this.x) + Math.abs(w.y + DY[k] - this.y);
        d = [0, 1, 2, 3].filter(k => this.map.rows[w.y + DY[k]]?.[w.x + DX[k]] === ',').sort((a, b) => far(b) - far(a))[0] ?? d;
      }
      const nx = w.x + DX[d], ny = w.y + DY[d];
      if (this.map.rows[ny]?.[nx] !== ',') continue;
      if (G.flags.saltLine > 0 && nx === this.x && ny === this.y) continue;
      if (this.wanderers.some(o => o !== w && o.x === nx && o.y === ny)) continue;
      if (this.npcs.some(n => n.x === nx && n.y === ny && this.npcVisible(n))) continue;
      bend(w.x, w.y, d, this.t);
      w.x = nx; w.y = ny; w.dir = d;
      if (nx === this.x && ny === this.y && this.moving === 0) { this.encounter(w); return; }
    }
  }

  /** While Ouro holds a haul stone, backing away drags it into the tile Ouro leaves, stepping toward it tips it into deep water beyond it, and any other way lets go. Returns true when the press was used. */
  dragStep(d: number): boolean {
    const o = this.held!;
    const sx = o.x - this.x, sy = o.y - this.y;
    if (DX[d] === -sx && DY[d] === -sy) {
      const nx = this.x + DX[d], ny = this.y + DY[d];
      const can = this.passable(nx, ny) && LEDGE[this.tile(nx, ny)] === undefined && !this.wanderers.some(w => w.x === nx && w.y === ny)
        && STONE_GROUND.has(this.tile(this.x, this.y)) && !this.map.warps.some(w => w.x === this.x && w.y === this.y);
      if (!can) { if (this.t % 16 === 0) { sfx('bump'); puff(this.x, this.y, d, this.t); } return true; }
      this.stepDir = d;
      this.leave(this.x, this.y, d);
      this.placeStone(o, this.x, this.y);
      this.x = nx; this.y = ny; this.moving = 8; this.uphill = false; this.stepCount++; this.lastStep = d;
      if (this.t % 2 === 0) sfx('guard');
      return true;
    }
    if (DX[d] === sx && DY[d] === sy) {
      const bx = o.x + sx, by = o.y + sy;
      if (this.tile(bx, by) === '~') { this.placeStone(o, bx, by, true); this.held = null; sfx('hitBig'); this.shakeT = 6; save(); return true; }
      if (this.t % 16 === 0) sfx('bump');
      return true;
    }
    this.held = null;
    sfx('back');
    return false;
  }

  arrive(): void {
    this.hopping = false;
    this.mapSteps++;
    if (G.flags.saltLine > 0) G.flags.saltLine--;
    G.x = this.x; G.y = this.y; G.dir = this.dir;
    this.reveal();
    const wp = this.map.warps.find(w => w.x === this.x && w.y === this.y && (!w.when || w.when()));
    if (wp) {
      const locked = this.map.warps.find(w => w === wp)?.locked;
      if (locked && !G.flags[locked]) { /* handled by scripts */ }
      else { void this.changeMap(wp.to, wp.tx, wp.ty, wp.dir ?? this.dir); return; }
    }
    const w = this.wanderers.find(w => w.x === this.x && w.y === this.y);
    if (w) { this.encounter(w); return; }
    // Ice: Vellum keeps sliding the same way until something stops the slide.
    if (this.tile(this.x, this.y) === 'I') {
      const nx = this.x + DX[this.stepDir], ny = this.y + DY[this.stepDir];
      if (this.passable(nx, ny) && !this.wanderers.some(o => o.x === nx && o.y === ny)) {
        this.x = nx; this.y = ny; this.moving = 8; this.uphill = false;
        return;
      }
    }
    // A floe carries Ouro on across open water the way Ouro stepped onto it, until it bumps anything that is not open water.
    if (this.tile(this.x, this.y) === '*') {
      const o = this.objAt(this.x, this.y)!;
      const nx = this.x + DX[this.stepDir], ny = this.y + DY[this.stepDir];
      if (this.tile(nx, ny) === '~' && !this.npcs.some(n => n.x === nx && n.y === ny && this.npcVisible(n))) {
        o.x = nx; o.y = ny; this.x = nx; this.y = ny; this.moving = 8; this.uphill = false;
        if (this.t % 3 === 0) sfx('wind');
        return;
      }
    }
    // Wind: N, E, S, and W tiles push Vellum one tile their way, and the next tile may push again.
    const gust = 'SENW'.indexOf(this.tile(this.x, this.y));
    if (gust >= 0) {
      const nx = this.x + DX[gust], ny = this.y + DY[gust];
      if (this.passable(nx, ny) && !this.wanderers.some(o => o.x === nx && o.y === ny)) {
        this.dir = gust; this.stepDir = gust; this.x = nx; this.y = ny; this.moving = 8; this.uphill = false;
        return;
      }
    }
    for (const h of this.stepHooks) h(this);
    for (const tr of this.map.triggers || []) {
      if (this.x >= tr.x && this.x < tr.x + tr.w && this.y >= tr.y && this.y < tr.y + tr.h && (!tr.when || tr.when())) {
        const s = SCRIPTS[tr.script];
        if (s) { this.runBusy(s); return; }
      }
    }
    this.checkSight();
  }

  warp(to: string, x: number, y: number, dir = this.dir): void {
    this.fade = 12;
    sfx('switch');
    this.load(to, x, y, dir);
    save();
    const e = this.map.enter && SCRIPTS[this.map.enter];
    if (e) this.runBusy(e);
  }

  /**
   * A map change for walking through a door or off an edge, and for being sent back after a loss. The old map fades out,
   * the new one loads and draws its first frames under full dark, where the work of a first frame can't show as a stall,
   * and then it fades in.
   */
  async changeMap(to: string, x: number, y: number, dir = this.dir, enter = true): Promise<void> {
    this.busy++;
    try {
      sfx('switch');
      for (let k = 1; k <= 6; k++) { this.dimOut = k * 2; await this.waitFrames(1); }
      this.load(to, x, y, dir);
      save();
      await this.waitFrames(3);
      this.dimOut = 0;
      this.fade = 12;
    } finally {
      this.dimOut = 0;
      this.busy--;
    }
    const e = enter && this.map.enter && SCRIPTS[this.map.enter];
    if (e) await this.runBusy(e);
  }

  async runBusy(fn: () => Promise<void>): Promise<void> {
    this.busy++;
    try { await fn(); } catch (e) { console.error(e); }
    this.busy--;
    input.clear();
  }

  toggleWear(): void {
    if (!wearingUnlocked()) return;
    if (!G.party[0]) return;
    this.wearing = !this.wearing;
    sfx(this.wearing ? 'shield' : 'back');
  }

  facing(): [number, number] { return [this.x + DX[this.dir], this.y + DY[this.dir]]; }

  interact(): void {
    const [fx, fy] = this.facing();
    let n = this.npcs.find(n => this.npcVisible(n) && !n.hidden && n.x === fx && n.y === fy);
    if (!n && this.tile(fx, fy) === 'c') n = this.npcs.find(n => this.npcVisible(n) && n.x === fx + DX[this.dir] && n.y === fy + DY[this.dir]);
    if (!n) {
      const spot = this.map.spots?.find(s => s.x === fx && s.y === fy && (!s.when || s.when()));
      if (spot) { this.runBusy(typeof spot.script === 'string' ? SCRIPTS[spot.script] : spot.script); return; }
      const ch = this.tile(fx, fy);
      for (const h of this.tileHandlers) if (h(this, fx, fy, ch)) return;
      const tt = this.map.tileTalk?.[ch];
      if (tt && SCRIPTS[tt]) this.runBusy(SCRIPTS[tt]);
      return;
    }
    this.talkNpc = n.def;
    if (n.def.sleeper && SCRIPTS.sleeper) { this.runBusy(SCRIPTS.sleeper); return; }
    n.dir = (this.dir + 2) % 4;
    const d = n.def;
    if (d.trainer && !G.beaten[this.trainerKey(n)]) { this.runBusy(() => this.fightTrainer(n!)); return; }
    if (d.rematch && G.flags.rematches && G.scales.includes(d.rematch.scale)) { this.runBusy(() => this.offerRematch(n!)); return; }
    if (d.talk && SCRIPTS[d.talk]) { this.runBusy(SCRIPTS[d.talk]); return; }
    const lines = typeof d.lines === 'function' ? d.lines() : d.lines;
    if (d.trainer && G.beaten[this.trainerKey(n)]) {
      this.runBusy(async () => { await say(d.trainer!.speaker || d.name || null, d.trainer!.defeat); });
      return;
    }
    // A whorl on the map doesn't talk. Its lines describe it, so they show as narration under its name, with no voice.
    const whorl = !!d.mon || !!d.sleeper || d.sprite === 'stone';
    if (lines && lines.length) this.runBusy(async () => { for (const l of lines) await say(whorl ? null : d.name || null, l, undefined, whorl ? d.name : undefined); });
  }

  trainerKey(n: NpcState): string { return `${this.map.id}:${n.def.id}`; }

  async offerRematch(n: NpcState): Promise<void> {
    const rm = n.def.rematch!;
    const c = await choose(['Fight again at 25', 'Talk'], true, `${rm.name} will fight again. Both teams at level 25.`);
    if (c === 1) { const s = n.def.talk && SCRIPTS[n.def.talk]; if (s) await s(); return; }
    if (c !== 0) return;
    const r = await battle({ enemy: rm.team(), name: rm.name, ai: 'keeper', wild: false, bg: this.bg(), sync: true, music: 'keeper', noXp: true });
    this.playMapMusic();
    if (r.result === 'win') {
      G.rind += 500;
      G.flags['rematchWin_' + rm.scale] = (G.flags['rematchWin_' + rm.scale] || 0) + 1;
      await say(rm.name, 'Again, then. Some other day.');
      await notice(`${HERO} gets 500 cowries.`);
    }
  }

  checkSight(): void {
    // Trainers only challenge someone who has a whorl to fight with.
    if (!G.party.length) return;
    for (const n of this.npcs) {
      const tr = n.def.trainer;
      if (!tr || G.beaten[this.trainerKey(n)] || !this.npcVisible(n)) continue;
      const range = tr.sight ?? 4;
      for (let k = 1; k <= range; k++) {
        const sx = n.x + DX[n.dir] * k, sy = n.y + DY[n.dir] * k;
        if (sx === this.x && sy === this.y) { this.runBusy(() => this.spotted(n)); return; }
        if (isSolid(this.tile(sx, sy))) break;
      }
    }
  }

  async spotted(n: NpcState): Promise<void> {
    n.bang = 40;
    sfx('spot');
    await this.waitFrames(36);
    while (Math.abs(n.x - this.x) + Math.abs(n.y - this.y) > 1) {
      n.x += DX[n.dir]; n.y += DY[n.dir];
      await this.waitFrames(8);
    }
    this.dir = (n.dir + 2) % 4;
    await this.fightTrainer(n);
  }

  async fightTrainer(n: NpcState): Promise<void> {
    const tr = n.def.trainer!;
    await say(tr.speaker || n.def.name || null, tr.intro);
    const r = await this.fight(tr);
    if (r.result === 'win') {
      G.beaten[this.trainerKey(n)] = 1;
      await say(tr.speaker || n.def.name || null, tr.defeat);
      save();
    }
  }

  teamOf(tr: TrainerDef): Mon[] {
    return typeof tr.team === 'function' ? tr.team() : tr.team.map(([k, lv]) => makeMon(k, lv));
  }

  async fight(tr: TrainerDef): Promise<BattleOutcome> {
    const r = await battle({ enemy: this.teamOf(tr), name: tr.name, ai: tr.ai || 'trainer', wild: false, bg: this.bg(), sync: tr.sync, music: tr.music || trainerMusic(tr) });
    this.playMapMusic();
    if (r.result === 'lose') await this.lose();
    return r;
  }

  bg(): [string, string] {
    const p = REGIONS[this.map.region] || REGIONS[0];
    return [p.w2, p.g2];
  }

  async encounter(w: Wanderer): Promise<void> {
    this.wanderers = this.wanderers.filter(o => o !== w);
    this.busy++;
    // A Lure Shell used on this map makes the next whorl to come out the zone's rarest kind.
    const z = this.map.zone;
    if (this.lureMap === this.map.id && z && z.kinds.length) {
      this.lureMap = null;
      const rare = z.kinds.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
      w.mon = makeMon(rare, w.mon.level * 2);
    }
    seen(w.mon.kind);
    if (!G.party.length) {
      // With no whorl of its own, Ouro is only sniffed at. The wild whorl stays and wanders on.
      this.wanderers.push(w);
      await this.emote('ouro', 'surprise');
      this.busy--;
      input.clear();
      return;
    }
    if (scaleNow.strand && !G.flags.strandTold) {
      G.flags.strandTold = 1;
      await hint('(Out here your whorls fight at their Strand level. It starts at 3.)');
      await hint('(It rises only on the Strand. Moves, habits, notions, and nacre all come with them.)');
    }
    const r = await battle({ enemy: [w.mon], name: 'Wild', ai: 'wild', wild: true, canRun: true, bg: this.bg(), area: this.map.zone?.area, music: scaleNow.strand ? 'wildStrand' : 'wild' });
    this.playMapMusic();
    for (const m of r.pegged) {
      m.notion = null;
      const where = addMon(m);
      await notice(where === 'party' ? `${m.name} joins your team.` : `${m.name} goes to the Midden.`);
      await offerName(m);
    }
    if (r.result === 'lose') await this.lose();
    save();
    this.busy--;
    input.clear();
  }

  async lose(): Promise<void> {
    const lost = Math.floor(G.rind * 0.2);
    G.rind -= lost;
    await notice(`${HERO} drops ${lost} cowries and walks back.`);
    const t = G.lastTannery;
    const [x, y] = safeSpot(t.map, t.x, t.y);
    await this.changeMap(t.map, x, y, 0, false);
  }

  /** Waits n steps. The count runs in tick, which every mode in the stack gets, so several scripts can wait at once and a text box does not stop people walking. */
  waitFrames(n: number): Promise<void> {
    let k = n;
    const m: Mode = { update() {}, tick() { if (--k <= 0) close(m); }, draw() {} };
    return run(m);
  }

  npc(id: string): NpcState | undefined { return this.npcs.find(n => n.def.id === id); }

  async walkNpc(id: string, path: string): Promise<void> {
    const n = this.npc(id);
    if (!n) return;
    for (const c of path) {
      const d = 'drul'.indexOf(c);
      if (d < 0) continue;
      n.dir = d; n.x += DX[d]; n.y += DY[d];
      await this.waitFrames(9);
    }
  }

  async walkPlayer(path: string): Promise<void> {
    for (const c of path) {
      const d = 'drul'.indexOf(c);
      if (d < 0) continue;
      this.leave(this.x, this.y, d);
      this.dir = d; this.stepDir = d; this.x += DX[d]; this.y += DY[d]; this.moving = 8;
      await this.waitFrames(9);
    }
    G.x = this.x; G.y = this.y;
  }

  // ------------------------------------------------------------ scene tools

  /** Resolves when `cond` holds, checked once a frame, or after `max` frames. */
  waitUntil(cond: () => boolean, max = 600): Promise<void> {
    let k = max;
    const m: Mode = { update() {}, tick() { if (cond() || --k <= 0) close(m); }, draw() {} };
    return run(m);
  }

  /** The tile someone stands on: 'ouro', 'whorl' (the lead whorl behind Ouro), or a person's id. */
  whoTile(who: string): [number, number] | null {
    if (who === 'ouro') return [this.x, this.y];
    if (who === 'whorl') return [this.fol.x, this.fol.y];
    const n = this.npc(who);
    return n ? [n.x, n.y] : null;
  }

  /** Whether someone could step onto a tile now: open ground with nobody standing on it. */
  freeFor(who: string, x: number, y: number, people = true): boolean {
    const ch = this.tile(x, y);
    if (isSolid(ch) || LEDGE[ch] !== undefined) return false;
    if (!people) return true;
    if (who !== 'ouro' && x === this.x && y === this.y) return false;
    return !this.npcs.some(n => n.def.id !== who && !n.hidden && this.npcVisible(n) && !n.def.ghost && n.x === x && n.y === y);
  }

  /** The directions of the shortest walk from one tile to another, round solid tiles and, if `people`, round people. Doors are only walked onto at the end. */
  findPath(who: string, sx: number, sy: number, tx: number, ty: number, people = true): number[] | null {
    const W = this.map.rows[0].length, H = this.map.rows.length;
    const prev = new Map<number, number>([[sy * W + sx, -1]]);
    const q: [number, number][] = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift()!;
      if (x === tx && y === ty) break;
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], ny = y + DY[d], k = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(k)) continue;
        const end = nx === tx && ny === ty;
        if (!end && !this.freeFor(who, nx, ny, people)) continue;
        if (end && !this.freeFor(who, nx, ny, false)) continue;
        if (!end && this.map.warps.some(w => w.x === nx && w.y === ny)) continue;
        prev.set(k, d);
        q.push([nx, ny]);
      }
    }
    if (!prev.has(ty * W + tx)) return null;
    const dirs: number[] = [];
    for (let x = tx, y = ty; x !== sx || y !== sy;) { const d = prev.get(y * W + x)!; dirs.unshift(d); x -= DX[d]; y -= DY[d]; }
    return dirs;
  }

  /** Moves someone one tile in direction d, facing `face` (the same way unless they step back). */
  stepWho(who: string, d: number, face = d): void {
    if (who === 'ouro') {
      this.leave(this.x, this.y, d);
      this.dir = face; this.stepDir = d; this.x += DX[d]; this.y += DY[d]; this.moving = 8;
      G.x = this.x; G.y = this.y;
      return;
    }
    if (who === 'whorl') { const f = this.fol; f.x += DX[d]; f.y += DY[d]; f.dir = face; f.lastX = this.x; f.lastY = this.y; return; }
    const n = this.npc(who);
    if (n) { n.dir = face; n.x += DX[d]; n.y += DY[d]; }
  }

  /**
   * Walks someone to a tile by the shortest way round walls and people, a tile every `frames` frames. Several can walk at once.
   * When the tile is taken, as by Ouro, they stop beside it and face it.
   */
  async walkTo(who: string, tx: number, ty: number, frames = 9): Promise<void> {
    let held = 0;
    for (let tries = 0; tries < 400; tries++) {
      const at = this.whoTile(who);
      if (!at || (at[0] === tx && at[1] === ty)) return;
      const path = this.findPath(who, at[0], at[1], tx, ty) || this.findPath(who, at[0], at[1], tx, ty, false);
      if (!path) { this.lostWalks.push(`${this.map.id}: ${who} from ${at} to ${tx},${ty}`); return; }
      const d = path[0], nx = at[0] + DX[d], ny = at[1] + DY[d];
      if (!this.freeFor(who, nx, ny)) {
        if (nx === tx && ny === ty) { this.face(who, d); return; }
        // Ouro steps aside for someone whose only way on is through Ouro's tile.
        if (who !== 'ouro' && nx === this.x && ny === this.y && ++held >= 3) {
          const next = path[1] === undefined ? -1 : path[1];
          const side = [0, 1, 2, 3].find(k => k !== (d + 2) % 4 && k !== next && this.freeFor('ouro', this.x + DX[k], this.y + DY[k]) && !this.map.warps.some(w => w.x === this.x + DX[k] && w.y === this.y + DY[k]));
          if (side !== undefined) { this.stepWho('ouro', side, this.dir); held = 0; }
        }
        await this.waitFrames(6);
        continue;
      }
      held = 0;
      this.stepWho(who, d);
      await this.waitFrames(frames);
    }
    this.lostWalks.push(`${this.map.id}: ${who} gave up on the way to ${tx},${ty}`);
  }

  /**
   * Walks a person away until they are off the screen, by the fewest steps that get there, then hides them.
   * With no way off the screen within `maxSteps`, they go as far from Ouro as they can and are hidden there.
   */
  async walkAway(id: string, maxSteps = 24): Promise<void> {
    const n = this.npc(id);
    if (!n) return;
    const W = this.map.rows[0].length;
    const [cx, cy] = this.cam;
    const off = (x: number, y: number) => x * 8 + 8 <= cx || x * 8 >= cx + 192 || y * 8 + 8 <= cy || y * 8 >= cy + 192;
    const steps = new Map<number, number>([[n.y * W + n.x, 0]]);
    const q: [number, number][] = [[n.x, n.y]];
    let best: [number, number] = [n.x, n.y], far = -1;
    while (q.length) {
      const [x, y] = q.shift()!;
      const s = steps.get(y * W + x)!;
      if (off(x, y)) { best = [x, y]; break; }
      const d = Math.abs(x - this.x) + Math.abs(y - this.y);
      if (d > far) { far = d; best = [x, y]; }
      if (s >= maxSteps) continue;
      for (let k = 0; k < 4; k++) {
        const nx = x + DX[k], ny = y + DY[k];
        if (steps.has(ny * W + nx) || !this.freeFor(id, nx, ny) || this.map.warps.some(w => w.x === nx && w.y === ny)) continue;
        steps.set(ny * W + nx, s + 1);
        q.push([nx, ny]);
      }
    }
    await this.walkTo(id, best[0], best[1]);
    n.hidden = true;
  }

  /** One step of a person's route once the last one has finished. A step into Ouro, another person, a wild whorl, or a wall waits instead. */
  walkRoute(n: NpcState): void {
    if (n.px !== n.x * 8 || n.py !== n.y * 8 || --n.t > 0) return;
    const r = n.def.route!, i = n.ri ?? 0, c = r[i % r.length];
    if (c === '.') { n.ri = i + 1; n.t = 45; return; }
    const k = 'drul'.indexOf(c);
    if (k < 0) { n.ri = i + 1; return; }
    const nx = n.x + DX[k], ny = n.y + DY[k];
    n.dir = k;
    const taken = (nx === this.x && ny === this.y) || this.wanderers.some(w => w.x === nx && w.y === ny)
      || this.npcs.some(o => o !== n && !o.hidden && this.npcVisible(o) && !o.def.ghost && o.x === nx && o.y === ny);
    if (taken || isSolid(this.tile(nx, ny))) { n.t = 15; return; }
    n.x = nx; n.y = ny; n.ri = i + 1; n.t = n.def.pace ?? 8;
  }

  /** Turns someone to face a direction (0 down, 1 right, 2 up, 3 left). */
  face(who: string, d: number): void {
    if (who === 'ouro') { this.dir = d; return; }
    if (who === 'whorl') { this.fol.dir = d; return; }
    const n = this.npc(who);
    if (n) n.dir = d;
  }

  /** Turns someone toward another person's tile. */
  faceToward(who: string, other: string): void {
    const a = this.whoTile(who), b = this.whoTile(other);
    if (!a || !b) return;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    if (!dx && !dy) return;
    this.face(who, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 0 : 2));
  }

  /** Plays a short sprite action. Resolves when it ends. */
  async act(who: string, kind: ActKind): Promise<void> {
    if (kind === 'look') {
      const d0 = this.dirOf(who);
      this.face(who, 3); await this.waitFrames(18);
      this.face(who, 1); await this.waitFrames(18);
      this.face(who, d0); await this.waitFrames(6);
      return;
    }
    if (kind === 'back') {
      const at = this.whoTile(who);
      const d = this.dirOf(who), b = (d + 2) % 4;
      if (at && this.freeFor(who, at[0] + DX[b], at[1] + DY[b])) { this.stepWho(who, b, d); await this.waitFrames(12); }
      return;
    }
    const dur = ACT_FRAMES[kind];
    this.acts.set(who, { kind, t: 0, dur });
    await this.waitFrames(dur + 2);
  }

  dirOf(who: string): number {
    if (who === 'ouro') return this.dir;
    if (who === 'whorl') return this.fol.dir;
    return this.npc(who)?.dir ?? 0;
  }

  /** The pixel offset of a playing action. */
  actOffset(who: string): [number, number] {
    const a = this.acts.get(who);
    if (!a) return [0, 0];
    const k = a.t / a.dur;
    if (a.kind === 'hop') return [0, -Math.round(Math.sin(Math.PI * k) * 4)];
    if (a.kind === 'shiver') return [a.t % 4 < 2 ? -1 : 1, 0];
    if (a.kind === 'bow') return [0, k > 0.25 && k < 0.75 ? 2 : k > 0.1 && k < 0.9 ? 1 : 0];
    if (a.kind === 'nod') return [0, a.t % 12 < 5 ? 1 : 0];
    if (a.kind === 'lift') return [0, -Math.round(Math.sin(Math.PI * k) * 6)];
    return [0, 0];
  }

  /** Shows a bubble over someone for about a second. Resolves a little before it goes. */
  async emote(who: string, kind: EmoteKind): Promise<void> {
    this.emotes = this.emotes.filter(e => e.who !== who);
    this.emotes.push({ who, kind, t: 0 });
    sfx(kind === 'surprise' ? 'spot' : 'move');
    await this.waitFrames(EMOTE_FRAMES - 16);
  }

  /** Fades a person in or out over `frames` frames. Fading out hides them at the end. */
  async fadeWho(id: string, show: boolean, frames = 24): Promise<void> {
    const n = this.npc(id);
    if (!n) return;
    if (show) n.hidden = false;
    this.fades.set(id, { a: show ? 0 : 1, to: show ? 1 : 0, step: 1 / Math.max(1, frames) });
    await this.waitFrames(frames + 1);
    if (!show) { n.hidden = true; this.fades.delete(id); }
  }

  /** The camera that follows Ouro. */
  followCam(): [number, number] {
    const W = this.map.rows[0].length, H = this.map.rows.length;
    let cx = this.px + 4 - 96, cy = this.py + 4 - 92;
    cx = Math.max(-8, Math.min(W * 8 - 192 + 8, cx));
    cy = Math.max(-8, Math.min(H * 8 - 192 + 8, cy));
    if (W * 8 <= 192) cx = (W * 8 - 192) / 2;
    if (H * 8 <= 192) cy = (H * 8 - 192) / 2;
    return [cx, cy];
  }

  /** The camera that centers a tile, kept inside the map. */
  camFor(x: number, y: number): [number, number] {
    const W = this.map.rows[0].length, H = this.map.rows.length;
    let cx = x * 8 + 4 - 96, cy = y * 8 + 4 - 92;
    cx = Math.max(-8, Math.min(W * 8 - 192 + 8, cx));
    cy = Math.max(-8, Math.min(H * 8 - 192 + 8, cy));
    if (W * 8 <= 192) cx = (W * 8 - 192) / 2;
    if (H * 8 <= 192) cy = (H * 8 - 192) / 2;
    return [Math.round(cx), Math.round(cy)];
  }

  /** Moves the camera to center a tile. Resolves when it gets there. */
  async pan(x: number, y: number): Promise<void> {
    const g = this.camFor(x, y);
    this.panAt ||= [this.cam[0], this.cam[1]];
    this.panGoal = g;
    await this.waitUntil(() => !!this.panAt && this.panAt[0] === g[0] && this.panAt[1] === g[1]);
  }

  /** Moves the camera back to Ouro and lets it follow again. */
  async panBack(): Promise<void> {
    if (!this.panAt) return;
    this.panGoal = 'back';
    await this.waitUntil(() => !this.panAt);
  }

  /**
   * Places something on the map with a fade: a prop painter's name, one tile character, 'mon:kind' for a whorl's
   * sprite, or 'person:sprite' for a person's. Placing an existing key moves it. Resolves when the fade ends.
   */
  async prop(key: string, what: string, x: number, y: number, frames = 16): Promise<void> {
    const old = this.sceneProps.find(p => p.key === key);
    const step = 1 / Math.max(1, frames);
    if (old) { old.what = what; old.x = x; old.y = y; old.to = 1; old.step = step; }
    else this.sceneProps.push({ key, what, x, y, a: frames > 0 ? 0 : 1, to: 1, step });
    if (frames > 0) await this.waitFrames(frames + 1);
  }

  /** Fades a placed thing out and removes it. */
  async unprop(key: string, frames = 16): Promise<void> {
    const p = this.sceneProps.find(p => p.key === key);
    if (!p) return;
    p.to = 0; p.step = 1 / Math.max(1, frames);
    if (frames <= 0) p.a = 0;
    else await this.waitFrames(frames + 1);
  }

  /** Changes the screen's tint toward `level` of color c over `frames` frames. Level 0 clears it. */
  async tint(c: string, level: number, frames = 60): Promise<void> {
    if (this.tintA <= 0) this.tintC = c;
    else if (c !== this.tintC && level > 0) this.tintC = c;
    this.tintTo = Math.max(0, Math.min(1, level));
    this.tintStep = Math.abs(this.tintTo - this.tintA) / Math.max(1, frames);
    if (frames <= 0) this.tintA = this.tintTo;
    else await this.waitFrames(frames + 1);
  }

  /** The pixel position of someone's sprite, with any action playing, or null when they are not shown. */
  whoPx(who: string): [number, number] | null {
    const [ox, oy] = this.actOffset(who);
    if (who === 'ouro') return [this.px + ox, this.py + oy];
    if (who === 'whorl') return G.party[0] && !this.wearing ? [this.fol.px + ox, this.fol.py + oy] : null;
    const n = this.npc(who);
    return n && !n.hidden && this.npcVisible(n) ? [n.px + ox, n.py + oy] : null;
  }

  // ------------------------------------------------------------ draw

  playerSprite(): SpriteData {
    if (this.wearing && G.party[0]) return G.party[0].sprite;
    const look = idleLook(this.idle, this.t);
    if (G.flags.endRelease) return withEyes(vellumSprite(0), look);
    return withEyes(vellumSprite(loosened() + (G.flags.seamExtra || 0) - (G.flags.seamClosed ? 99 : 0)), look);
  }

  draw(): void {
    let [cx, cy] = this.followCam();
    if (this.camAt) [cx, cy] = this.camAt;
    else if (this.panAt) [cx, cy] = this.panAt;
    this.cam = [cx, cy];
    if (this.shakeT > 0) cx += (this.shakeT % 4 < 2 ? -2 : 2);
    // The world draws into its own layer, because the light pass reads every pixel back and that is cheap only off screen.
    layer('field', 192, 192, 0, 0, 1, () => this.drawWorld(cx, cy), true);
    this.drawOverlays(cx, cy);
  }

  /** Whether a box in world pixels is on screen, with a margin for things that stick out of their tile. */
  private onScreen(x: number, y: number, w: number, h: number, cx: number, cy: number, m = 16): boolean {
    return x + w > cx - m && x < cx + 192 + m && y + h > cy - m && y < cy + 192 + m;
  }

  private drawWorld(cx: number, cy: number): void {
    const p = REGIONS[this.map.region] || REGIONS[0];
    clear(INK);
    const W = this.map.rows[0].length, H = this.map.rows.length;
    const slack = loosened();
    const x0 = Math.floor(cx / 8), y0 = Math.floor(cy / 8);
    for (let ty = y0; ty <= y0 + 25; ty++) for (let tx = x0; tx <= x0 + 25; tx++) {
      if (ty < 0 || tx < 0 || ty >= H || tx >= W) continue;
      if (this.map.fog && !this.seenTiles.has(ty * W + tx)) continue;
      if (this.map.fogRings && !ringLit(tx, ty, this.x, this.y)) continue;
      drawTile(this.tile(tx, ty), tx * 8 - cx, ty * 8 - cy, tx, ty, p, slack, this.t);
    }
    if (!this.map.fogRings) { drawPrints([cx, cy], p, this.t); drawUnder([cx, cy], p, this.t); }
    for (const pr of this.map.props || []) if (this.onScreen(pr.x * 8, pr.y * 8, 8, 8, cx, cy, 40) && (!pr.when || pr.when())) drawProp(pr.pic, pr.x * 8 - cx, pr.y * 8 - cy, this.t);
    for (const sp of this.sceneProps) if (this.onScreen(sp.x * 8, sp.y * 8, 8, 8, cx, cy, 40)) drawSceneProp(sp, sp.x * 8 - cx, sp.y * 8 - cy, p, slack, this.t);
    for (const o of this.objs) if ((!o.sunk || o.kind === 'ball') && this.onScreen(o.px, o.py, 8, 8, cx, cy)) drawObj(o, Math.round(o.px - cx), Math.round(o.py - cy), o === this.held);
    // Every sprite is kept as a figure, so the light pass can shade it by direction and cast its shadow.
    const figures: Figure[] = [];
    const fig = (s: SpriteData, x: number, y: number, flip: boolean, bob = 0, glow = false) => {
      const fx = Math.round(x), fy = Math.round(y) - bob;
      drawSprite(s, fx, fy, 1, flip);
      figures.push({ s, x: fx, y: fy, flip, bob, glow });
    };
    // Only figures on screen are drawn, and only they go to the light pass for shading and shadows.
    this.starFigs.length = 0;
    const starFig = (m: Mon, x: number, y: number, flip: boolean, bob: number) => { if (m.starborn) this.starFigs.push({ s: m.sprite, x: Math.round(x), y: Math.round(y) - bob, flip, seed: m.uid % 97 }); };
    for (const w of this.wanderers) if (this.onScreen(w.px, w.py, 8, 8, cx, cy)) {
      const flip = facesLeft(w, w.dir), bob = Math.floor((this.t + w.id * 13) / 20) % 2;
      fig(w.mon.sprite, w.px - cx, w.py - cy, flip, bob);
      starFig(w.mon, w.px - cx, w.py - cy, flip, bob);
    }
    const ents: { y: number; draw: () => void }[] = [];
    for (const n of this.npcs) {
      if (!this.onScreen(n.px, n.py, 8, 8, cx, cy) || !this.npcVisible(n) || n.hidden) continue;
      ents.push({ y: n.py, draw: () => {
        const spr = n.def.img ? n.def.img() : n.def.mon ? { px: SPECIES[n.def.mon].sprite, c: SPECIES[n.def.mon].c } as SpriteData : PEOPLE[n.def.sprite] || PEOPLE.villager;
        const [ox, oy] = this.actOffset(n.def.id);
        const fd = this.fades.get(n.def.id);
        if (fd && fd.a < 1) faded(8, 8, n.px - cx + ox, n.py - cy + oy, fd.a, () => drawSprite(spr, 0, 0, 1, facesLeft(n, n.dir)));
        else fig(spr, n.px - cx + ox, n.py - cy + oy, facesLeft(n, n.dir), walkBob(n.px, n.py, n.x, n.y, false));
        if (n.bang > 0) text('!', n.px - cx + 3, n.py - cy - 9, SEL, INK);
      } });
    }
    const fol = this.fol, lead = G.party[0];
    const starLead = this.leadTypes().includes('STAR');
    const folShown = lead && !this.wearing && (!this.map.fog || this.seenTiles.has(fol.y * W + fol.x)) && (!this.map.fogRings || ringLit(fol.x, fol.y, this.x, this.y));
    if (folShown) ents.push({ y: fol.py, draw: () => {
      // More than a tile from its target means it is hopping down a ledge after Ouro, so it takes the same arc.
      const left = Math.abs(fol.px - fol.x * 8) + Math.abs(fol.py - fol.y * 8);
      const bob = left > 8 || (left > 0 && fol.hop) ? Math.round(Math.sin(Math.PI * left / 16) * 6) : walkBob(fol.px, fol.py, fol.x, fol.y, input.held('fast'));
      if (left > 8) fol.hop = true; else if (!left) fol.hop = false;
      const [ox, oy] = this.actOffset('whorl');
      const flip = facesLeft(FOLLOWER, fol.dir);
      fig(lead.sprite, fol.px - cx + ox, fol.py - cy + oy, flip, bob, starLead);
      starFig(lead, fol.px - cx + ox, fol.py - cy + oy, flip, bob);
    } });
    ents.push({ y: this.py, draw: () => {
      const bob = this.hopping ? Math.round(Math.sin(Math.PI * this.moving / 16) * 6) : walkBob(this.px, this.py, this.x, this.y, input.held('fast'));
      const [ox, oy] = this.actOffset('ouro');
      const flip = facesLeft(PLAYER, this.dir);
      fig(this.playerSprite(), this.px - cx + ox, this.py - cy + oy, flip, bob, this.wearing && starLead);
      if (this.wearing && lead) starFig(lead, this.px - cx + ox, this.py - cy + oy, flip, bob);
    } });
    ents.sort((a, b) => a.y - b.y).forEach(e => e.draw());
    drawOver([cx, cy], p, this.t);
    const star: [number, number] | null = !starLead ? null : this.wearing ? [this.px - cx + 4, this.py - cy + 4] : folShown ? [fol.px - cx + 4, fol.py - cy + 4] : null;
    drawFieldFx({ map: this.map, t: this.t, cam: [cx, cy], px: this.px - cx + 4, py: this.py - cy + 4, dark: !!this.map.dark && !(this.wearing && starLead), loose: slack, dusk: sceneNow.dusk, star, figures });
  }

  private drawOverlays(cx: number, cy: number): void {
    for (const f of this.starFigs) { drawAura(ctx, f.s, f.x, f.y, this.t, f.seed, true, f.flip); drawAura(ctx, f.s, f.x, f.y, this.t, f.seed, false, f.flip); }
    if (this.tintA > 0) dither(0, 0, 192, 192, this.tintC, this.tintA);
    for (const e of this.emotes) {
      const at = this.whoPx(e.who);
      if (at) drawEmote(e.kind, Math.round(at[0] - cx) - 1, Math.round(at[1] - cy) - 11 + (e.t < 4 ? 4 - e.t : 0));
    }
    if (this.overlay) this.overlay(this);
    if (this.fade > 0) dither(0, 0, 192, 192, INK, this.fade / 12);
    if (this.dimOut > 0) dither(0, 0, 192, 192, INK, this.dimOut / 12);
    if (this.flashT > 0) dither(0, 0, 192, 192, '#f8f4e8', this.flashT / 20);
    if (this.banner > 0 && this.banner < 88) {
      const w = textWidth(this.map.name) + 12;
      box(96 - w / 2, 4, w, 13);
      textCenter(this.map.name, 96, 7, PAPER);
    }
    if (this.wearing) text('wearing ' + (G.party[0]?.name || ''), 3, 183, SEL, INK);
    if (this.goalT > 0 && this.goalText) {
      box(4, 20, 184, 22);
      text('Goal', 8, 23, SEL);
      text(this.goalText, 8, 32, PAPER);
    }
  }
}

/** A haul stone, gray everywhere, with the harness rope round it while Ouro holds it. A floe is a slab of white ice. */
/** Which way each walker last faced sideways. Walking up or down keeps it, so a figure facing left stays facing left. */
const sideFacing = new WeakMap<object, boolean>();
const PLAYER = {}, FOLLOWER = {};
function facesLeft(who: object, dir: number): boolean {
  if (dir === 3) sideFacing.set(who, true);
  else if (dir === 1) sideFacing.set(who, false);
  return sideFacing.get(who) ?? false;
}

/**
 * How far a walker rises, in pixels, from where it is (px, py) and the tile it walks to (x, y). Everyone gets the same
 * one-pixel lift in the middle of every other step, and none while running, which would turn it into a flicker.
 */
function walkBob(px: number, py: number, x: number, y: number, running: boolean): number {
  const left = Math.abs(px - x * 8) + Math.abs(py - y * 8);
  if (!left || left > 8) return 0;
  // Running bobs on every step, for a quicker bounce. Walking bobs on every other step.
  if (running) return left >= 3 && left <= 6 ? 1 : 0;
  if ((x + y) & 1) return 0;
  return left >= 2 && left <= 5 ? 1 : 0;
}

function drawObj(o: FieldObj, x: number, y: number, held: boolean): void {
  if (o.kind === 'ball') {
    // A round stone of star glass. Sunk in a hole, only its top shows, flush with the ground.
    if (o.sunk) { rect(x + 1, y + 2, 6, 4, '#3a2a6c'); rect(x + 2, y + 2, 4, 3, '#8a78c4'); rect(x + 2, y + 2, 2, 1, '#dcd0f4'); return; }
    rect(x + 2, y, 4, 1, '#221e48'); rect(x + 1, y + 1, 6, 1, '#221e48'); rect(x, y + 2, 8, 4, '#221e48'); rect(x + 1, y + 6, 6, 1, '#221e48');
    rect(x + 2, y + 1, 4, 5, '#7a68b8'); rect(x + 1, y + 2, 6, 3, '#7a68b8'); rect(x + 2, y + 5, 4, 1, '#5a4898');
    rect(x + 2, y + 2, 2, 1, '#f4ecff'); rect(x + 5, y + 4, 1, 1, '#3cf0e0');
    rect(x + 2, y + 7, 4, 1, '#120c2c');
    return;
  }
  if (o.kind === 'floe') {
    rect(x, y + 1, 8, 6, '#eaf4fc'); rect(x, y + 1, 8, 1, '#ffffff'); rect(x, y + 6, 8, 1, '#a8c8e4');
    rect(x, y + 7, 8, 1, '#5a88b8'); rect(x + 2, y + 3, 3, 1, '#c4dcf0'); rect(x + 5, y + 4, 1, 1, '#c4dcf0');
    return;
  }
  rect(x + 2, y, 4, 1, '#3a3a40'); rect(x + 1, y + 1, 6, 1, '#3a3a40'); rect(x, y + 2, 8, 4, '#3a3a40'); rect(x + 1, y + 6, 6, 1, '#3a3a40');
  rect(x + 2, y + 1, 4, 1, '#b8b6ae'); rect(x + 1, y + 2, 6, 3, '#9a9890'); rect(x + 2, y + 5, 4, 1, '#7a7872');
  rect(x + 2, y + 2, 2, 1, '#dcdad2'); rect(x + 5, y + 4, 1, 1, '#7a7872');
  rect(x + 1, y + 7, 6, 1, '#2a2a30');
  if (held) { rect(x, y + 3, 8, 1, '#e8b040'); rect(x + 3, y + 2, 2, 3, '#e8b040'); }
}

/** The tile a map shows at x, y from its rows and story mods, without the things that move. */
function staticTile(m: MapDef, x: number, y: number): string {
  for (const md of m.mods || []) if (y === md.y && x >= md.x && x < md.x + (md.w || 1) && md.when()) return md.ch;
  const r = m.rows[y];
  if (!r || x < 0 || x >= r.length) return 'v';
  const ch = r[x];
  return ch >= '1' && ch <= '8' ? '.' : ch === '@' || ch === 'o' ? '.' : ch === '*' ? '~' : ch;
}

/** Where Ouro can stand on a map: the tile asked for, or the map's spawn when that tile is solid or off the map, as it can be in a save from before a map was redrawn. */
export function safeSpot(id: string, x: number, y: number): [number, number] {
  const m = MAPS[id];
  if (!m) return [x, y];
  if (!isSolid(staticTile(m, x, y)) && reachesWay(m, x, y)) return [x, y];
  if (SPAWNS[id]) return SPAWNS[id];
  for (const src of Object.values(MAPS)) for (const w of src.warps) if (w.to === id && !isSolid(staticTile(m, w.tx, w.ty))) return [w.tx, w.ty];
  return [x, y];
}

/**
 * Whether Ouro, standing at x, y, can walk to any way off the map, with people who show counted as solid.
 * A save from before a map was redrawn can stand in a pocket that is open ground but closed in, and this catches it.
 */
function reachesWay(m: MapDef, x0: number, y0: number): boolean {
  const W = m.rows[0].length, H = m.rows.length;
  const ways = new Set(m.warps.filter(w => !w.when || w.when()).map(w => w.y * W + w.x));
  if (!ways.size) return true;
  const people = new Set(m.npcs.filter(n => (!n.when || n.when()) && !n.ghost && !(n.sleeper && G.flags[n.sleeper.flag])).map(n => n.y * W + n.x));
  const open = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H || people.has(y * W + x)) return false;
    const ch = staticTile(m, x, y);
    if (ch === ':') return G.keys.includes('stilts');
    if (ch === '%') return G.keys.includes('prisingiron') || !!G.flags[crustKey(m.id, x, y)];
    if (ch === '@') return G.keys.includes('haul');
    const b = m.basin;
    if (ch === 'O' && b && G.flags[b.flag] && x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h) return true;
    return !isSolid(ch);
  };
  const seen = new Set<number>([y0 * W + x0]);
  const queue: [number, number][] = [[x0, y0]];
  while (queue.length) {
    const [x, y] = queue.pop()!;
    if (ways.has(y * W + x)) return true;
    for (let d = 0; d < 4; d++) {
      let nx = x + DX[d], ny = y + DY[d];
      const drop = LEDGE[staticTile(m, nx, ny)];
      if (drop !== undefined) { if (drop !== d) continue; nx += DX[d]; ny += DY[d]; }
      if (!open(nx, ny) && !ways.has(ny * W + nx)) continue;
      while (staticTile(m, nx, ny) === 'I' && open(nx + DX[d], ny + DY[d])) { nx += DX[d]; ny += DY[d]; }
      const k = ny * W + nx;
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return false;
}

/** The key a crust's prised state is saved under. */
export function crustKey(map: string, x: number, y: number): string { return `crust:${map}:${x},${y}`; }

export const field = new Field();
export async function giveMon(m: Mon): Promise<void> {
  const where = addMon(m);
  await notice(where === 'party' ? `${m.name} joins your team.` : `${m.name} goes to the Midden.`);
  await offerName(m);
}

/** The battle track for a trainer: the Peel, the Hands, and Cinch have their own. */
function trainerMusic(tr: TrainerDef): string {
  if (scaleNow.strand) return tr.ai === 'keeper' || tr.ai === 'champion' ? 'keeperStrand' : 'wildStrand';
  if (tr.name === 'Cinch') return 'battleCinch';
  if (['Fid', 'Lug', 'Hasp', 'Purchase'].includes(tr.name)) return 'battleHand';
  if (['Peeler', 'Hermit', 'Bare', 'Pith', 'Murex'].includes(tr.name)) return 'battlePeel';
  return tr.ai === 'keeper' || tr.ai === 'champion' ? 'keeper' : 'battle';
}