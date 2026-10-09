// Setting: the machine puzzle's screen. Ouro places arms and stations on a gem setter's board and writes each arm's tape.
import { sfx } from '../../engine/audio';
import { text, textCenter, textRight, textWidth, wrap } from '../../engine/font';
import { input } from '../../engine/input';
import { music } from '../../engine/music';
import { dither, mix, px, rect } from '../../engine/screen';
import { hint } from '../dialogue';
import { listMenu } from '../menus';
import { close, run, type Mode } from '../modes';
import { G, flag, save, setFlag } from '../state';
import { box, DIM, GOOD, PAPER, SEL, BADC } from '../ui';
import {
  cellsOf, checkMachine, cost, period, start, step, STEP_NAME, STEPS, TAPE_LEN,
  type ArmPart, type Machine, type Part, type Piece, type Puzzle, type Shape, type Sim, type Step, type Stone,
} from '../setting/core';
import { PUZZLES } from '../setting/puzzles';
import * as snd from '../setting/sounds';
import type { Mon } from '../../battle/model';
import { CARCANET_TAPE } from '../../data/kits7';

const FELT = '#2a1e33', FELT2 = '#30233a', GRID = '#3d2f48', BG = '#17121c';
const BRASS = '#d0a860', BRASS_D = '#6a4c24';
/** A polishing lap's wheel, its shaded edge, its spin marks, and the fading end of each mark: mauves near the felt's. */
const LAP = '#43384d', LAP_DARK = '#30263a', LAP_MARK = '#7a6888', LAP_TRAIL = '#594a66';
/** A station tray's floor, its shaded near wall, and its lit far lip, all a step off the felt. */
const TRAY = '#241a2c', TRAY_WALL = '#170f1c', TRAY_LIP = '#4c3c5a';
const COPPER = '#c0806a', COPPER_D = '#6a3a30';
const ARM_C = ['#e8b860', '#70c8e8', '#e880b0'];
const STEP_C: Record<Step, string> = { G: '#7ad870', D: '#e8a050', L: '#70b8e8', R: '#70b8e8', O: '#c890f0', I: '#c890f0', '.': DIM };
const NAME: Record<Part['kind'], string> = { arm: 'Arm', polish: 'Polisher', set: 'Setter', split: 'Splitter' };
const KINDS: Part['kind'][] = ['arm', 'polish', 'set', 'split'];
const BUTTONS = ['Run', 'Step', 'Reset', 'Help', 'Leave'];

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

function disc(cx: number, cy: number, r: number, c: string): void {
  for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy) + 0.5); rect(cx - w, cy + dy, w * 2 + 1, 1, c); }
}
/** A disc filled with a 4 by 4 ordered dither of one color at `level` coverage. */
function ditherDisc(cx: number, cy: number, r: number, c: string, level: number): void {
  for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy) + 0.5); dither(cx - w, cy + dy, w * 2 + 1, 1, c, level); }
}
/** The same 4 by 4 ordered-dither thresholds as the field lighting, fixed to screen pixels. */
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function diamond(cx: number, cy: number, r: number, c: string): void {
  for (let dy = -r; dy <= r; dy++) { const w = r - Math.abs(dy); rect(cx - w, cy + dy, w * 2 + 1, 1, c); }
}
function line(x0: number, y0: number, x1: number, y1: number, c: string, w = 2): void {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let k = 0; k <= n; k++) { const t = k / n; rect(Math.round(x0 + (x1 - x0) * t - w / 2), Math.round(y0 + (y1 - y0) * t - w / 2), w, w, c); }
}

/** Six values of one hue for each cut stone, from the outline to the glint, and the color its fire pixel flashes. */
const RAMP: Partial<Record<Stone, { v: string[]; fire: string }>> = {
  amber: { v: ['#3e1e06', '#84400e', '#c26c1a', '#f0a030', '#ffd468', '#fff8dc'], fire: '#ff6a3a' },
  glass: { v: ['#123a36', '#20685f', '#38a08c', '#6ccab4', '#acf0da', '#f4fffa'], fire: '#e8ffb0' },
  star: { v: ['#24164c', '#4e3494', '#7c5ec8', '#b49cf0', '#e0d0ff', '#ffffff'], fire: '#ffa8e0' },
  pearl: { v: ['#5a5246', '#9a9080', '#c6bca8', '#e8e1d2', '#faf6ec', '#ffffff'], fire: '#f4c4d8' },
};
/** Facet values by direction from the center, east first and going clockwise, for light from the upper left (index 5).
 * The facet nearest the light is a step darker than its neighbors, so the stone reads as clear rather than as a lit solid. */
const FACET = [3, 2, 1, 2, 4, 3, 4, 3];
const frame = (): number => Math.floor(performance.now() / (1000 / 60));

/** Where the board's lamp hangs while the board draws. Stones elsewhere, such as the target panel, take light from the upper left. */
let lampAt: [number, number] | null = null;
/** The unit direction from (cx, cy) toward the light. */
function lightDir(cx: number, cy: number): [number, number] {
  if (!lampAt) return [-Math.SQRT1_2, -Math.SQRT1_2];
  const dx = lampAt[0] - cx, dy = lampAt[1] - cy, d = Math.max(1, Math.hypot(dx, dy));
  return [dx / d, dy / d];
}

/** A 4-point twinkle of up to `len` pixels a side. */
function twinkle(x: number, y: number, len: number, c: string, edge: string): void {
  px(x, y, c);
  for (let k = 1; k <= len; k++) {
    const cc = k === len ? edge : c;
    px(x - k, y, cc); px(x + k, y, cc); px(x, y - k, cc); px(x, y + k, cc);
  }
}

const glints = new Map<Stone, string>();
/** A stone's glint leaned toward the lamp's amber, so the highlight reads as the lamp's own light. */
function warmGlint(s: Stone, c: string): string {
  let v = glints.get(s);
  if (!v) { v = mix(c, '#ffdca0', 0.4); glints.set(s, v); }
  return v;
}

/** A cut stone: an outline, a crown of facets that each take one value of the hue, a lit table, a glint, and a fire pixel. */
function cutStone(s: Stone, cx: number, cy: number, r: number): void {
  const { v, fire } = RAMP[s]!;
  const ax = (d: number) => Math.abs(d);
  const inside = s === 'amber' ? (dx: number, dy: number) => ax(dx) <= r && ax(dy) <= r && ax(dx) + ax(dy) <= r * 1.45
    : s === 'glass' ? (dx: number, dy: number) => ax(dx) <= r && ax(dy) <= r - 1 && ax(dx) + ax(dy) <= r * 1.6 - 1
    : s === 'star' ? (dx: number, dy: number) => ax(dx) + ax(dy) <= r + 1
    : (dx: number, dy: number) => dx * dx + dy * dy <= r * r + r * 0.6;
  const ring = s === 'amber' ? (dx: number, dy: number) => Math.max(ax(dx), ax(dy), (ax(dx) + ax(dy)) / 1.45) / r
    : s === 'glass' ? (dx: number, dy: number) => Math.max(ax(dx) / r, ax(dy) / Math.max(1, r - 1))
    : s === 'star' ? (dx: number, dy: number) => (ax(dx) + ax(dy)) / (r + 1)
    : (dx: number, dy: number) => Math.sqrt(dx * dx + dy * dy) / r;
  const table = s === 'glass' ? 0.5 : s === 'star' ? 0.4 : 0.45;
  const t = frame(), phase = (cx * 37 + cy * 61) & 255;
  // The facet pattern turns to face the lamp, so the glint and the dark facet sit on the lamp's side of every stone.
  const [lx, ly] = lightDir(cx, cy), turn = (Math.round(Math.atan2(ly, lx) / (Math.PI / 4)) - 5 + 16) & 7;
  for (let dy = -r - 1; dy <= r + 1; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) {
    if (!inside(dx, dy)) continue;
    const toward = dx * lx + dy * ly;
    // The rim facing the lamp catches it, one value up from the outline.
    if (!inside(dx + 1, dy) || !inside(dx - 1, dy) || !inside(dx, dy + 1) || !inside(dx, dy - 1)) { px(cx + dx, cy + dy, toward > r * 0.55 ? v[1] : v[0]); continue; }
    const d = ring(dx, dy);
    let c: string;
    if (s === 'pearl') {
      // A pearl has no facets: a soft fall away from the light, and a band of color that drifts round its rim.
      const lit = -toward / r;
      c = v[lit < -0.55 ? 4 : lit < 0.15 ? 3 : lit < 0.7 ? 2 : 1];
      const a = Math.atan2(dy, dx), band = (t * 0.03 + phase) % (Math.PI * 2);
      if (d > 0.55 && Math.abs(((a - band + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.5) c = (t >> 6) & 1 ? fire : '#c4e4ec';
    } else if (d <= table) c = toward > 0 ? v[4] : v[3];
    else if (s === 'glass') {
      // A step cut: each side is one value, and every other step down the side is a shade deeper.
      const side = ax(dx) / r >= ax(dy) / Math.max(1, r - 1) ? (dx * lx > 0 ? 4 : 2) : (dy * ly > 0 ? 4 : 1);
      c = v[Math.max(1, side - (Math.round(d * r) % 2))];
    } else c = v[FACET[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) - turn + 16) & 7]];
    if (s !== 'pearl' && d > table && d <= 0.86) {
      // Light that enters on the lamp's side leaves through the far crown as a bright patch, the way a clear stone glows.
      const along = -toward / r, across = Math.abs(dx * ly - dy * lx) / r;
      if (along > 0.3 && across < 0.32) c = along > 0.5 && across < 0.14 ? v[5] : v[4];
    }
    px(cx + dx, cy + dy, c);
  }
  const g = Math.max(1, Math.floor(r * 0.35)) * Math.SQRT2;
  const gx = cx + Math.round(lx * g), gy = cy + Math.round(ly * g);
  if (s !== 'pearl' && r >= 3) px(cx - Math.round(lx * g), cy - Math.round(ly * g), ((t >> 4) + phase) % 3 === 0 ? fire : v[4]);
  px(gx, gy, warmGlint(s, v[5]));
  if (s === 'pearl' && r >= 3) px(gx + 1, gy, v[5]);
  // Every few seconds the glint flares into a twinkle. Each stone keeps its own time.
  const k = (t + phase * 3) % 220;
  if (k < 14 && s !== 'pearl') twinkle(gx, gy, k < 7 ? 1 + (k >> 2) : 1 + ((14 - k) >> 2) + (r >= 4 ? 1 : 0), v[5], v[4]);
}

/** Four values for each rough stone, from the outline to the lit side, and an accent for its texture. */
const ROUGH: Partial<Record<Stone, { v: string[]; accent: string[] }>> = {
  nacre: { v: ['#4a4438', '#8a8272', '#b4ac9a', '#d8d0c0'], accent: ['#c8e4dc', '#ecccd8'] },
  resin: { v: ['#2e1606', '#5e3414', '#86562a', '#a87a44'], accent: ['#c8782a', '#e09a40'] },
  pebble: { v: ['#1e2622', '#3e4a44', '#687870', '#8ca096'], accent: ['#2e3832', '#b0c2b6'] },
  chip: { v: ['#16122a', '#322a4a', '#584e74', '#7c72a0'], accent: ['#9888c8', '#d8ccff'] },
};

/** A rough stone: an uneven lump shaded in three flat values by its side to the lamp, with a texture of its own kind.
 * Nacre is a flat layered flake, resin a lump with a dull glow at its core, pebble a speckled oval, and chip an angular shard. */
function roughStone(s: Stone, cx: number, cy: number, r: number): void {
  const { v, accent } = ROUGH[s]!;
  const [lx, ly] = lightDir(cx, cy), t = frame(), phase = (cx * 37 + cy * 61) & 255;
  const inside = s === 'nacre' ? (dx: number, dy: number) => (dx / (r + 1)) ** 2 + (dy / Math.max(1, r - 1)) ** 2 <= 1.05 && !(dx >= r - 1 && dy <= -1)
    : s === 'resin' ? (dx: number, dy: number) => Math.hypot(dx, dy) <= r * (1 - 0.13 * Math.cos(3 * Math.atan2(dy, dx) + 1)) + 0.3
    : s === 'pebble' ? (dx: number, dy: number) => (dx / r) ** 2 + (dy / Math.max(1, r - 0.6)) ** 2 <= 1.08
    : (dx: number, dy: number) => [0.3, 1.5, 2.7, 3.9, 5.1].every((a, i) => dx * Math.cos(a) + dy * Math.sin(a) <= r * (i % 2 ? 0.8 : 0.95));
  for (let dy = -r - 1; dy <= r + 1; dy++) for (let dx = -r - 2; dx <= r + 2; dx++) {
    if (!inside(dx, dy)) continue;
    if (!inside(dx + 1, dy) || !inside(dx - 1, dy) || !inside(dx, dy + 1) || !inside(dx, dy - 1)) { px(cx + dx, cy + dy, v[0]); continue; }
    // A chip has two flat planes split by a ridge, so its shade follows the side of the ridge, not the curve.
    const toward = s === 'chip' ? Math.sign(dx - dy * 0.4) * (lx - ly * 0.4) * r * 0.6 + (dx * lx + dy * ly) * 0.3 : dx * lx + dy * ly;
    const lit = toward / r;
    let c = v[lit > 0.35 ? 3 : lit > -0.3 ? 2 : 1];
    const h = ((dx + 9) * 7 + (dy + 9) * 13 + phase) % 11;
    if (s === 'nacre' && (dy + Math.floor((dx + 9) / 3)) % 3 === 0 && lit < 0.6) c = v[1];
    if (s === 'nacre' && h === 0) c = accent[((t >> 5) + dx) & 1];
    if (s === 'resin' && dx * dx + dy * dy <= (r * 0.45) ** 2 && lit > -0.5) c = accent[(t + phase) % 150 < 75 ? 0 : 1];
    if (s === 'pebble' && h < 2) c = accent[h === 0 && lit > 0 ? 1 : 0];
    if (s === 'chip' && dx === Math.round(dy * 0.4) && Math.abs(dy) < r - 1) c = v[3];
    px(cx + dx, cy + dy, c);
  }
  // A dull highlight on the lamp's side, and on a chip now and then a single spark.
  const g = Math.max(1, Math.round(r * 0.45));
  px(cx + Math.round(lx * g), cy + Math.round(ly * g), s === 'resin' ? accent[1] : mix(v[3], '#ffffff', 0.35));
  if (s === 'chip' && (t + phase * 3) % 200 < 8) px(cx + Math.round(lx * g), cy + Math.round(ly * g), accent[1]);
}

const SHADOW = '#150f1a';

/** A stone's shadow: the stone's disc smeared from its foot out along the cast, which points away from the lamp. */
export function drawStoneShadow(cx: number, cy: number, r: number, sx: number, sy: number): void {
  const n = Math.max(1, Math.ceil(Math.hypot(sx, sy)));
  for (let k = 1; k <= n; k++) disc(Math.round(cx + sx * k / n), Math.round(cy + sy * k / n), r, SHADOW);
}

const gemFaint = new Map<Stone, string[]>();
/** The light a cut stone bends onto the felt: an arc of specks in its colors just past the far edge of its shadow,
 * drifting as the lamp flickers. */
export function drawGemLight(s: Stone, cx: number, cy: number, r: number, sx: number, sy: number): void {
  const rp = RAMP[s];
  if (!rp || s === 'pearl') return;
  cx = Math.round(cx); cy = Math.round(cy);
  const t = frame(), phase = (cx * 37 + cy * 61) & 255, ang0 = Math.atan2(sy, sx), reach = Math.hypot(sx, sy);
  let faint = gemFaint.get(s);
  if (!faint) { faint = [mix(rp.v[4], FELT, 0.45), mix(rp.fire, FELT, 0.4), mix(rp.v[3], FELT, 0.35), mix(rp.v[3], SHADOW, 0.6)]; gemFaint.set(s, faint); }
  // The shadow of a clear stone carries a little of its color where the light came through.
  const mid = r + reach * 0.5, ux = Math.cos(ang0), uy = Math.sin(ang0);
  for (const o of [-1, 0, 1]) px(Math.round(cx + ux * mid - uy * o), Math.round(cy + uy * mid + ux * o), faint[3]);
  for (let k = 0; k < 5; k++) {
    if (((t >> 3) + k * 5 + phase) % 9 === 0) continue;
    const ang = ang0 + (k - 2) * 0.28 + Math.sin((t + phase) * 0.015 + k) * 0.06;
    const dist = r + reach + 1 + ((k + (phase >> 2)) & 1);
    px(Math.round(cx + Math.cos(ang) * dist), Math.round(cy + Math.sin(ang) * dist), faint[k % 3]);
  }
  // Now and then one speck catches full color.
  if ((t + phase * 5) % 160 < 10) px(Math.round(cx + Math.cos(ang0) * (r + reach + 2)), Math.round(cy + Math.sin(ang0) * (r + reach + 2)), rp.v[4]);
}

/** Draws one stone centered on a pixel. Rough stones are dull and lumpy, polished ones are cut and lit. */
export function drawStone(s: Stone, cx: number, cy: number, r: number): void {
  cx = Math.round(cx); cy = Math.round(cy);
  if (RAMP[s]) cutStone(s, cx, cy, r);
  else roughStone(s, cx, cy, r);
}

/** Draws a shape small, for the target panel and the puzzle list. */
export function drawShape(sh: Shape, x: number, y: number, cs = 9): void {
  const at = sh.atoms.map(([dx, dy]) => [x + dx * cs + cs / 2, y + dy * cs + cs / 2]);
  for (const [a, b] of sh.bonds) line(at[a][0], at[a][1], at[b][0], at[b][1], BRASS, 2);
  sh.atoms.forEach(([, , s], i) => drawStone(s, at[i][0], at[i][1], Math.max(2, Math.floor(cs * 0.34))));
}

const shapeSize = (sh: Shape): [number, number] => [Math.max(...sh.atoms.map(a => a[0])) + 1, Math.max(...sh.atoms.map(a => a[1])) + 1];

/** Plays one puzzle. Resolves when Ouro leaves the board. */
export function playSetting(pz: Puzzle): Promise<void> {
  let mach: Machine = { parts: [] };
  const kept = G.gem.mach[pz.id];
  if (kept && !checkMachine(pz, kept)) mach = clone(kept);
  const cs = Math.min(16, Math.floor(126 / pz.w), Math.floor(94 / pz.h));
  const ox = 2 + Math.floor((128 - pz.w * cs) / 2), oy = 13 + Math.floor((94 - pz.h * cs) / 2);
  const tapeY = Math.max(115, oy + pz.h * cs + 5);
  const cellX = (fx: number) => ox + fx * cs + cs / 2, cellY = (fy: number) => oy + fy * cs + cs / 2;
  const gemR = Math.floor(cs * 0.34);

  type Zone = 'board' | 'tape' | 'bar';
  let zone: Zone = 'board', cx = 0, cy = 0, tr = 0, tc = 0, bi = 0;
  let sim: Sim | null = null, running = false, anim = 0, busy = false, clock = 0;
  let note = '';
  let moving: { idx: number; was: Part } | null = null;
  let result: { c: number; k: number; a: number; best: [boolean, boolean, boolean] } | null = null;
  let prevArms: { dir: number; len: number }[] = [];
  let prevPos = new Map<number, [number, number][]>();
  let did: Step[] = [];
  const SPEED = 12;

  const arms = () => mach.parts.filter((p): p is ArmPart => p.kind === 'arm');
  const used = (k: Part['kind']) => mach.parts.filter(p => p.kind === k).length;
  const armAt = (x: number, y: number) => mach.parts.findIndex(p => p.kind === 'arm' && p.x === x && p.y === y);
  const stationAt = (x: number, y: number) => mach.parts.findIndex(p => p.kind !== 'arm' && cellsOf(p).some(([a, b]) => a === x && b === y));
  const keep = () => { G.gem.mach[pz.id] = clone(mach); };
  const stopSim = () => { if (sim) { sim = null; running = false; note = ''; } };

  function beginSim(): boolean {
    if (!arms().length) { note = 'Place an arm first.'; sfx('pegFail'); return false; }
    const bad = checkMachine(pz, mach);
    if (bad) { note = bad; sfx('pegFail'); return false; }
    sim = start(pz, mach);
    G.gem.runs++;
    note = '';
    return true;
  }

  function doStep(): void {
    if (!sim || sim.err || sim.done) return;
    prevArms = sim.arms.map(a => ({ dir: a.dir, len: a.len }));
    prevPos = new Map(sim.pieces.map(p => [p.id, p.atoms.map(a => [a.x, a.y] as [number, number])]));
    const col = sim.cycle % period(mach);
    did = arms().map(a => (a.tape[col] || '.') as Step);
    const before = snd.snapshot(sim);
    step(pz, mach, sim);
    anim = SPEED;
    snd.stepSounds(before, sim, did, pz.need, running && input.held('fast'));
    if (sim.err) { running = false; note = sim.err; }
    else if (sim.done) finish();
  }

  function finish(): void {
    if (!sim) return;
    running = false;
    const c = sim.cycle, k = cost(mach), a = sim.seen.size;
    const old = G.gem.best[pz.id];
    const best: [boolean, boolean, boolean] = [!old || c < old.c, !old || k < old.k, !old || a < old.a];
    G.gem.best[pz.id] = old ? { c: Math.min(old.c, c), k: Math.min(old.k, k), a: Math.min(old.a, a) } : { c, k, a };
    if (!G.gem.solved.includes(pz.id)) G.gem.solved.push(pz.id);
    G.gem.wins++;
    keep();
    save();
    result = { c, k, a, best };
    snd.solvedSound();
  }

  function tryPlace(kind: Part['kind']): void {
    const base = kind === 'arm' ? { kind, x: cx, y: cy, dir: 0, tape: '' } as ArmPart : { kind, x: cx, y: cy, dir: 0 } as Part;
    for (let d = 0; d < 4; d++) {
      const p = { ...base, dir: (d + (kind === 'arm' ? 2 : 0)) % 4 } as Part;
      mach.parts.push(p);
      if (!checkMachine(pz, mach)) { snd.placeSound(kind); note = kind === 'arm' ? 'Write its tape below.' : ''; keep(); return; }
      mach.parts.pop();
    }
    note = kind === 'arm' ? 'An arm needs a cell of its own.' : 'No room for it here.';
    sfx('pegFail');
  }

  function turn(idx: number): void {
    const p = mach.parts[idx];
    if (p.kind === 'polish') return;
    const was = p.dir;
    for (let d = 1; d <= 4; d++) {
      p.dir = (was + d) % 4;
      if (!checkMachine(pz, mach)) { snd.turnPartSound(); keep(); return; }
    }
    p.dir = was;
  }

  function partMenu(): void {
    const ai = armAt(cx, cy), si = stationAt(cx, cy), idx = ai >= 0 ? ai : si;
    busy = true;
    if (idx >= 0) {
      const p = mach.parts[idx];
      const items = p.kind === 'polish' ? ['Move', 'Remove'] : ['Turn', 'Move', 'Remove'];
      void listMenu(NAME[p.kind], items, { x: 126, y: 14, w: 62 }).then(i => {
        busy = false;
        const k = items[i];
        if (k === 'Turn') turn(idx);
        if (k === 'Move') { moving = { idx, was: clone(p) }; cx = p.x; cy = p.y; note = 'Move it, then Z to set it down.'; }
        if (k === 'Remove') { mach.parts.splice(idx, 1); tr = Math.min(tr, Math.max(0, arms().length - 1)); keep(); }
      });
      return;
    }
    const kinds = KINDS.filter(k => pz.limit[k] > 0);
    void listMenu('Place', kinds.map(k => `${NAME[k]} ${pz.limit[k] - used(k)}`), { x: 118, y: 14, w: 70, disabled: i => used(kinds[i]) >= pz.limit[kinds[i]] }).then(i => {
      busy = false;
      if (i >= 0) tryPlace(kinds[i]);
    });
  }

  function setStep(s: Step | null): void {
    const a = arms()[tr];
    if (!a) return;
    const t = a.tape.padEnd(tc + 1, '.').split('');
    t[tc] = s || '.';
    a.tape = t.join('').replace(/\.+$/, '');
    keep();
  }

  function stepMenu(): void {
    busy = true;
    const items = STEPS.map(s => STEP_NAME[s]);
    void listMenu(`Arm ${tr + 1}, step ${tc + 1}`, items, { x: 112, y: 14, w: 76, start: Math.max(0, STEPS.indexOf((arms()[tr]?.tape[tc] || 'G') as Step)) }).then(i => {
      busy = false;
      if (i < 0) return;
      setStep(STEPS[i]);
      snd.writeSound(STEPS[i], tr);
      tc = Math.min(TAPE_LEN - 1, tc + 1);
    });
  }

  async function help(): Promise<void> {
    busy = true;
    await hint(pz.idea);
    await hint('Each arm follows its tape, one step every cycle. All the tapes loop together, at the length of the longest.');
    await hint('Grab takes the stone at the claw. Turning swings the arm and what it holds. Reach out and pull in change its length.');
    await hint('A polisher shines a rough stone that rests on it. A setter bonds two stones that rest on it. A splitter breaks their bond.');
    await hint('C turns the part under the cursor, or clears a tape step. Hold Shift to run faster.');
    busy = false;
  }

  function press(b: string): void {
    if (b === 'Run' || b === 'Stop') {
      if (running) { running = false; sfx('back'); return; }
      if (!sim || sim.err || sim.done) { sim = null; if (!beginSim()) return; }
      running = true; sfx('ok');
    }
    if (b === 'Step') {
      if (!sim || sim.err || sim.done) { sim = null; if (!beginSim()) return; }
      running = false; doStep();
    }
    if (b === 'Reset') { stopSim(); sfx('back'); }
    if (b === 'Help') void help();
    if (b === 'Leave') { keep(); save(); sfx('back'); close(m); }
  }

  function moveCursor(): void {
    if (moving) {
      const p = mach.parts[moving.idx];
      let nx = p.x, ny = p.y;
      if (input.hit('left')) nx--; if (input.hit('right')) nx++; if (input.hit('up')) ny--; if (input.hit('down')) ny++;
      nx = Math.max(0, Math.min(pz.w - 1, nx)); ny = Math.max(0, Math.min(pz.h - 1, ny));
      if (nx !== p.x || ny !== p.y) { p.x = nx; p.y = ny; cx = nx; cy = ny; snd.slideSound(nx, ny, pz.h); }
      return;
    }
    const n = arms().length;
    const was = `${zone}${cx}${cy}${tr}${tc}${bi}`, wasZone = zone, wasRow = tr;
    if (zone === 'board') {
      if (input.hit('left') && cx > 0) cx--;
      if (input.hit('right') && cx < pz.w - 1) cx++;
      if (input.hit('up') && cy > 0) cy--;
      if (input.hit('down')) { if (cy < pz.h - 1) cy++; else if (n) { zone = 'tape'; tr = 0; } else zone = 'bar'; }
    } else if (zone === 'tape') {
      if (input.hit('left') && tc > 0) tc--;
      if (input.hit('right') && tc < TAPE_LEN - 1) tc++;
      if (input.hit('up')) { if (tr > 0) tr--; else { zone = 'board'; cy = pz.h - 1; } }
      if (input.hit('down')) { if (tr < n - 1) tr++; else zone = 'bar'; }
    } else {
      if (input.hit('left') && bi > 0) bi--;
      if (input.hit('right') && bi < BUTTONS.length - 1) bi++;
      if (input.hit('up')) { if (n) { zone = 'tape'; tr = n - 1; } else { zone = 'board'; cy = pz.h - 1; } }
    }
    if (`${zone}${cx}${cy}${tr}${tc}${bi}` !== was) {
      if (zone === 'board') snd.boardTick(cx, cy, pz.h);
      else if (zone === 'tape') { if (wasZone !== 'tape' || wasRow !== tr) snd.rowSound(tr); else snd.tapeTick(tc); }
      else sfx('move');
      if (!sim?.err) note = '';
    }
  }

  const m: Mode = {
    opaque: true,
    update() {
      clock++;
      if (busy) return;
      if (result) { if (input.hit('ok') || input.hit('back')) { result = null; sfx('ok'); } return; }
      if (anim > 0) anim = Math.max(0, anim - (input.held('fast') ? 4 : 1));
      if (running && anim === 0) doStep();
      moveCursor();
      if (zone === 'tape' && tr >= arms().length) zone = arms().length ? 'tape' : 'bar';
      tr = Math.min(tr, Math.max(0, arms().length - 1));
      if (input.hit('back')) {
        if (moving) { mach.parts[moving.idx] = moving.was; cx = moving.was.x; cy = moving.was.y; moving = null; note = ''; sfx('back'); return; }
        if (running) { running = false; sfx('back'); return; }
        if (zone !== 'bar' || bi !== BUTTONS.length - 1) { zone = 'bar'; bi = BUTTONS.length - 1; sfx('back'); return; }
        press('Leave');
        return;
      }
      if (input.hit('wear') && !moving) {
        stopSim();
        if (zone === 'board') { const i = armAt(cx, cy) >= 0 ? armAt(cx, cy) : stationAt(cx, cy); if (i >= 0) turn(i); }
        if (zone === 'tape') { setStep(null); snd.clearSound(tr); }
        return;
      }
      if (!input.hit('ok')) return;
      if (moving) {
        const bad = checkMachine(pz, mach);
        if (bad) { note = bad; sfx('pegFail'); return; }
        snd.placeSound(mach.parts[moving.idx].kind);
        moving = null; note = ''; keep();
        return;
      }
      if (zone === 'bar') { press(BUTTONS[bi]); return; }
      stopSim();
      if (zone === 'board') partMenu();
      else stepMenu();
    },
    draw() {
      drawRoom();
      drawLamp();
      text(pz.name, 4, 2, SEL);
      if (sim) textRight(`Cycle ${sim.cycle}`, 188, 2, sim.err ? BADC : sim.done ? GOOD : PAPER);
      else textRight(`${G.gem.solved.length} of ${PUZZLES.length} set`, 188, 2, DIM);
      lampAt = [LAMP_X, LAMP_Y];
      drawBoard();
      lampAt = null;
      drawPanel();
      drawTapes();
      drawBar();
      const slot = zone === 'tape' && arms()[tr] ? (arms()[tr].tape[tc] || '.') as Step : null;
      const msg = note || (slot ? `Arm ${tr + 1}, step ${tc + 1}: ${STEP_NAME[slot]}. Z to change it, C to clear it.` : sim ? '' : pz.idea);
      wrap(msg, 184).slice(0, 3).forEach((l, i) => text(l, 4, 166 + i * 9, sim?.err ? BADC : PAPER));
      if (result) drawResult();
    },
  };

  function t(): number { return anim > 0 ? 1 - anim / SPEED : 1; }

  function atomPos(p: Piece, k: number): [number, number] {
    const at = p.atoms[k], tt = t();
    if (!sim || tt >= 1) return [at.x, at.y];
    const ai = sim.arms.findIndex(a => a.hold === p.id), pp = prevPos.get(p.id);
    if (ai < 0 || !pp || pp.length !== p.atoms.length) return [at.x, at.y];
    const a = sim.arms[ai], d = did[ai], [x0, y0] = pp[k];
    if (d === 'R' || d === 'L') {
      const th = (d === 'R' ? 1 : -1) * tt * Math.PI / 2, dx = x0 - a.x, dy = y0 - a.y;
      return [a.x + Math.cos(th) * dx - Math.sin(th) * dy, a.y + Math.sin(th) * dx + Math.cos(th) * dy];
    }
    return [x0 + (at.x - x0) * tt, y0 + (at.y - y0) * tt];
  }

  function armPose(i: number): { ang: number; len: number; hold: boolean } {
    const a = arms()[i];
    if (!sim) return { ang: a.dir * 90, len: 1, hold: false };
    const s = sim.arms[i], tt = t(), p = prevArms[i];
    if (tt >= 1 || !p) return { ang: s.dir * 90, len: s.len, hold: s.hold !== null };
    const turnBy = did[i] === 'R' ? 90 : did[i] === 'L' ? -90 : 0;
    return { ang: p.dir * 90 + turnBy * tt, len: p.len + (s.len - p.len) * tt, hold: s.hold !== null };
  }

  /** The lamp hangs over the board's upper right corner, clear of the title on the left and the count on the right. Its
   * flame is at (LAMP_X, LAMP_Y). */
  const LAMP_X = Math.max(4 + textWidth(pz.name) + 12, Math.min(118, ox + pz.w * cs - 6)), LAMP_Y = 6;
  /** Ring radii from the outside in. Past the outer ring the felt is in shade. */
  const LAMP_RINGS = [120, 80, 46];
  const flicker = (): number => Math.sin(clock * 0.07) + Math.sin(clock * 0.19) > 1.2 ? 1 : 0;
  const lampRings = (): number[] => {
    const f = flicker();
    return LAMP_RINGS.map((r, k) => r + (k === 2 ? f * 2 : f));
  };
  /** The lamp: a chain, a brass hood, a glass chimney lit by the flame, and a brass font. The flame tip jumps as it flickers. */
  function drawLamp(): void {
    const x = LAMP_X, y = LAMP_Y, f = flicker(), glow = f ? '#ffe4a0' : '#f6d48a';
    px(x, 0, BRASS_D); px(x, 1, BRASS);
    rect(x - 2, 2, 5, 1, BRASS); px(x - 1, 2, '#fff0c8');
    rect(x - 3, 3, 7, 1, BRASS_D);
    for (let k = 4; k <= 7; k++) { px(x - 2, k, BRASS_D); px(x + 2, k, BRASS_D); }
    rect(x - 1, 4, 3, 4, glow);
    px(x, 7, '#ff9a30'); px(x, 6, '#fff4c8'); px(x, 5 - f, '#fffbe8');
    rect(x - 3, 8, 7, 1, BRASS); px(x - 2, 8, '#fff0c8');
    rect(x - 2, 9, 5, 1, BRASS_D);
  }
  /** Where a thing at (x, y) throws its shadow: away from the lamp, and longer the farther it stands from it. */
  const castAt = (x: number, y: number): [number, number] => {
    const dx = x - LAMP_X, dy = y - LAMP_Y, d = Math.max(1, Math.hypot(dx, dy)), len = 1 + Math.min(3, d / 40);
    return [dx / d * len, dy / d * len];
  };
  /** A flat shadow under a box-shaped part such as a button or tape cell. */
  const boxShadow = (x: number, y: number, w: number, h: number): void => {
    const [sx, sy] = castAt(x + w / 2, y + h / 2);
    rect(x + Math.max(1, Math.round(sx)), y + Math.max(1, Math.round(sy)), w, h, SHADOW);
  };
  const shades = new Map<string, string>();
  const AIR = [mix(BG, '#e0a050', 0.12), mix(BG, '#e0a050', 0.24)];
  /** A surface color in light band k: 0 shade, 1 plain, then warmer to 4 under the lamp. The warm color is a rose rather than
   * an orange, so the purple felt stays purple as it brightens. */
  const shade = (c: string, k: number): string => {
    const key = c + k;
    let v = shades.get(key);
    if (!v) { v = k === 0 ? mix(c, SHADOW, 0.45) : k === 1 ? c : mix(c, '#b07890', [0, 0, 0.12, 0.22, 0.34][k]); shades.set(key, v); }
    return v;
  };
  function drawRoom(): void {
    // The lamp's light falls in hard rings that shift a pixel as it flickers, each edge a two-pixel ordered dither as in
    // the field lighting. Close round the lamp the air is amber.
    const rings = lampRings();
    rect(0, 0, 192, 192, BG);
    rings.forEach((r, k) => {
      const c = shade(BG, k + 2), rr = Math.round(r * 1.25);
      ditherDisc(LAMP_X, LAMP_Y, rr + 2, c, 0.25); ditherDisc(LAMP_X, LAMP_Y, rr + 1, c, 0.5); disc(LAMP_X, LAMP_Y, rr, c);
    });
    disc(LAMP_X, LAMP_Y, 14 + flicker(), AIR[0]);
    disc(LAMP_X, LAMP_Y, 8 + flicker(), AIR[1]);
    for (let k = 0; k < 30; k++) {
      const sp = 0.06 + (k % 5) * 0.02;
      const x = Math.round((k * 67 + Math.sin(clock * 0.012 + k) * 6 + 400) % 192);
      const y = Math.round(((k * 41) - clock * sp) % 192 + 192) % 192;
      const tw = (clock + k * 37) % 180;
      px(x, y, tw < 6 ? '#b8a8d8' : k % 3 ? '#2a2236' : '#3a3048');
    }
  }

  /** The brass rim round the board: lit on the top and left, shaded on the bottom and right, and a glint that runs round it. */
  function drawFrame(): void {
    const x0 = ox - 2, y0 = oy - 2, w = pz.w * cs + 4, h = pz.h * cs + 4;
    rect(x0 + 2, y0 + 3, w, h, SHADOW);
    rect(x0, y0, w, h, BRASS_D);
    rect(x0, y0, w - 1, 1, '#a8844a'); rect(x0, y0, 1, h - 1, '#a8844a');
    rect(x0 + 1, y0 + h - 1, w - 1, 1, '#3e2c14'); rect(x0 + w - 1, y0 + 1, 1, h - 1, '#3e2c14');
    for (const [cx2, cy2] of [[x0, y0], [x0 + w - 2, y0], [x0, y0 + h - 2], [x0 + w - 2, y0 + h - 2]]) rect(cx2, cy2, 2, 2, BRASS);
    const run = (clock * 2) % ((w + h) * 2 + 240);
    for (let k = 0; k < 6; k++) {
      const d = run - k;
      if (d < 0 || d >= w + h) continue;
      const c = k < 2 ? '#fff4d0' : BRASS;
      if (d < w) px(x0 + d, y0, c); else px(x0 + w - 1, y0 + d - w, c);
    }
  }

  const tones = new Map<string, string[]>();
  /** A felt square's edge and nap colors: a lit lip, a dark seam, a raised nap fleck, and a pressed one. */
  const feltTones = (base: string): string[] => {
    let v = tones.get(base);
    if (!v) { v = [mix(base, '#c8a8dc', 0.2), mix(base, SHADOW, 0.6), mix(base, '#c8a8dc', 0.09), mix(base, SHADOW, 0.3)]; tones.set(base, v); }
    return v;
  };
  /** Dresses one felt square as an inlaid pad: the edges that face the lamp catch it as a pale lip, the edges that face
   * away sink into a dark seam, and a few fixed flecks of nap break up the flat color. Every pixel keeps its light band. */
  function inlay(x0: number, y0: number, base: string, band: (x: number, y: number) => number): void {
    const [lip, seam, up, down] = feltTones(base);
    const [lx] = lightDir(x0 + cs / 2, y0 + cs / 2);
    const dot = (x: number, y: number, c: string) => px(x, y, shade(c, band(x, y)));
    for (let k = 1; k < cs - 1; k++) {
      dot(x0 + k, y0, lip);
      dot(x0 + k, y0 + cs - 1, seam);
      dot(x0, y0 + k, lx < -0.2 ? lip : seam);
      dot(x0 + cs - 1, y0 + k, lx > 0.2 ? lip : seam);
    }
    px(x0, y0, GRID); px(x0 + cs - 1, y0 + cs - 1, SHADOW);
    const fx = (x0 - ox) / cs, fy = (y0 - oy) / cs;
    for (let i = 0; i < 5; i++) {
      const nx = 2 + (fx * 5 + fy * 3 + i * 7) % (cs - 4), ny = 2 + (fx * 3 + fy * 7 + i * 5 + (i >> 1)) % (cs - 4);
      dot(x0 + nx, y0 + ny, i & 1 ? down : up);
    }
  }

  function dashed(x: number, y: number, w: number, h: number, c: string): void {
    for (let k = 0; k < w; k += 3) { px(x + k, y, c); px(x + k, y + h - 1, c); }
    for (let k = 0; k < h; k += 3) { px(x, y + k, c); px(x + w - 1, y + k, c); }
  }

  function drawBoard(): void {
    drawFrame();
    // A soft sheen crosses the felt corner to corner every few seconds.
    const sweep = Math.floor((clock % 300) / 5) - 4;
    const rings = lampRings();
    /** The light band at a pixel. The ordered-dither threshold moves each ring edge by up to a pixel either way, so every
     * edge is a two-pixel dither between hard bands. */
    const band = (x: number, y: number): number => {
      const d = Math.hypot(x - LAMP_X, y - LAMP_Y) + (BAYER4[(y & 3) * 4 + (x & 3)] - 7.5) / 8;
      return d > rings[0] ? 0 : d > rings[1] ? 2 : d > rings[2] ? 3 : 4;
    };
    for (let y = 0; y < pz.h; y++) for (let x = 0; x < pz.w; x++) {
      // Each cell row is drawn in runs, one run per light band it crosses, so the ring edges stay sharp.
      const near = Math.abs(x + y - sweep);
      const base = near < 2 ? mix((x + y) % 2 ? FELT : FELT2, '#5a4868', near ? 0.15 : 0.3) : (x + y) % 2 ? FELT : FELT2;
      const x0 = ox + x * cs, y0 = oy + y * cs;
      for (let r = 0; r < cs; r++) {
        let start = 0, k = band(x0, y0 + r);
        for (let c = 1; c <= cs; c++) {
          const kk = c < cs ? band(x0 + c, y0 + r) : -1;
          if (kk === k) continue;
          rect(x0 + start, y0 + r, c - start, 1, shade(base, k));
          start = c; k = kk;
        }
      }
      inlay(x0, y0, base, band);
    }
    // Stations are set into the felt and sit under everything else. Every pixel keeps its light band, and a stone resting
    // on one covers its middle, so the station shows mostly round its edges.
    const lit = (x: number, y: number, c: string) => px(x, y, shade(c, band(x, y)));
    for (const p of mach.parts) {
      if (p.kind === 'arm') continue;
      const cells = cellsOf(p);
      if (p.kind === 'polish') {
        // A flat lap sunk into the square: a brass rim lit on the side away from the lamp, since the near lip shades the
        // recess, a mauve wheel, and three spin marks near the rim that turn faster while the machine runs.
        const [x, y] = cells[0], ccx = cellX(x), ccy = cellY(y), R = Math.floor(cs / 2) - 2;
        const [lx, ly] = lightDir(ccx, ccy), sp = clock * (running ? 0.16 : 0.025);
        for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
          const dd = Math.hypot(dx, dy);
          if (dd > R + 0.4) continue;
          const toward = (dx * lx + dy * ly) / Math.max(1, dd);
          lit(ccx + dx, ccy + dy, dd > R - 0.6 ? (toward < -0.3 ? BRASS : BRASS_D) : dd > R - 1.6 && toward > 0.2 ? LAP_DARK : LAP);
        }
        for (let k = 0; k < 3; k++) {
          const a = sp + k * Math.PI * 2 / 3;
          for (const [o, c] of [[0, LAP_MARK], [-0.3, LAP_MARK], [-0.6, LAP_TRAIL]] as [number, string][]) {
            lit(Math.round(ccx + Math.cos(a + o) * (R - 2)), Math.round(ccy + Math.sin(a + o) * (R - 2)), c);
          }
        }
        lit(ccx, ccy, BRASS_D);
      } else {
        // A shallow tray across both squares: its near wall is in shade and its far lip catches the lamp. A setter has
        // brass corner brackets and a brass bar where the bond forms. A splitter has copper brackets and a copper cut line.
        const [[ax, ay], [bx, by]] = cells;
        const x0 = ox + Math.min(ax, bx) * cs + 2, y0 = oy + Math.min(ay, by) * cs + 2;
        const w = (Math.abs(bx - ax) + 1) * cs - 4, h = (Math.abs(by - ay) + 1) * cs - 4;
        const [lx] = lightDir(x0 + w / 2, y0 + h / 2);
        for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
          const edge = yy === 0 ? 'near' : yy === h - 1 ? 'far' : xx === 0 ? (lx < -0.2 ? 'near' : 'far') : xx === w - 1 ? (lx > 0.2 ? 'near' : 'far') : '';
          lit(x0 + xx, y0 + yy, edge === 'near' ? TRAY_WALL : edge === 'far' ? TRAY_LIP : TRAY);
        }
        const c = p.kind === 'set' ? BRASS : COPPER, cd = p.kind === 'set' ? BRASS_D : COPPER_D;
        for (const [x, y] of cells) {
          const x1 = ox + x * cs + 3, y1 = oy + y * cs + 3, e = cs - 7;
          for (const [qx, qy, hx, hy] of [[x1, y1, 1, 1], [x1 + e, y1, -1, 1], [x1, y1 + e, 1, -1], [x1 + e, y1 + e, -1, -1]]) {
            lit(qx, qy, c); lit(qx + hx, qy, cd); lit(qx, qy + hy, cd);
          }
        }
        const mx = Math.round((cellX(ax) + cellX(bx)) / 2), my = Math.round((cellY(ay) + cellY(by)) / 2);
        for (let k = -3; k <= 3; k++) {
          if (p.kind === 'set') { if (ax === bx) { lit(mx + k, my - 1, c); lit(mx + k, my, cd); } else { lit(mx - 1, my + k, c); lit(mx, my + k, cd); } }
          else if (ax === bx) lit(mx + k, my + (k & 1 ? 1 : 0), c);
          else lit(mx + (k & 1 ? 1 : 0), my + k, c);
        }
      }
    }
    for (const io of pz.inputs) for (const [dx, dy] of io.shape.atoms) dashed(ox + (io.x + dx) * cs, oy + (io.y + dy) * cs, cs, cs, '#6ac080');
    for (const io of pz.outputs) {
      const at = io.shape.atoms.map(([dx, dy]) => [cellX(io.x + dx), cellY(io.y + dy)]);
      for (const [a, b] of io.shape.bonds) line(at[a][0], at[a][1], at[b][0], at[b][1], '#5a4a30', 2);
      io.shape.atoms.forEach(([dx, dy, s], i) => {
        dashed(ox + (io.x + dx) * cs, oy + (io.y + dy) * cs, cs, cs, SEL);
        drawStone(s, at[i][0], at[i][1], Math.max(2, gemR - 2));
        dither(at[i][0] - gemR, at[i][1] - gemR, gemR * 2 + 1, gemR * 2 + 1, FELT, 0.5);
      });
    }
    // Arms: base and reach, then the stones, then the claws on top of what they hold.
    const poses = arms().map((_, i) => armPose(i));
    const pieces: Piece[] = sim ? sim.pieces : pz.inputs.map((io, k) => ({ id: -k - 1, atoms: io.shape.atoms.map(([dx, dy, s]) => ({ x: io.x + dx, y: io.y + dy, s })), bonds: io.shape.bonds }));
    const placed = pieces.map(p => p.atoms.map((_, k) => atomPos(p, k)).map(([x, y]) => [cellX(x), cellY(y)]));
    arms().forEach((a, i) => {
      const { ang, len, hold } = poses[i], r = ang * Math.PI / 180;
      const bx = cellX(a.x), by = cellY(a.y), gx = bx + Math.cos(r) * len * cs, gy = by + Math.sin(r) * len * cs;
      const [sx, sy] = castAt(bx, by), [tx, ty] = castAt(gx, gy);
      line(bx + sx, by + sy, gx + tx, gy + ty, SHADOW, 3);
      disc(Math.round(bx + sx), Math.round(by + sy), Math.floor(cs * 0.36), SHADOW);
      const d = hold ? gemR : gemR + 2, nx = -Math.sin(r), ny = Math.cos(r);
      for (const s of [-1, 1]) line(gx + tx + nx * d * s - Math.cos(r) * 2, gy + ty + ny * d * s - Math.sin(r) * 2, gx + tx + nx * d * s + Math.cos(r) * 2, gy + ty + ny * d * s + Math.sin(r) * 2, SHADOW, 2);
    });
    pieces.forEach((p, n) => {
      const at = placed[n];
      for (const [a, b] of p.bonds) {
        const [sa, ta] = castAt(at[a][0], at[a][1]), [sb, tb] = castAt(at[b][0], at[b][1]);
        line(at[a][0] + sa, at[a][1] + ta, at[b][0] + sb, at[b][1] + tb, SHADOW, 4);
      }
      p.atoms.forEach((_, k) => { const [sx, sy] = castAt(at[k][0], at[k][1]); drawStoneShadow(at[k][0], at[k][1], gemR, sx, sy); });
    });
    pieces.forEach((p, n) => p.atoms.forEach((a, k) => { const [sx, sy] = castAt(placed[n][k][0], placed[n][k][1]); drawGemLight(a.s, placed[n][k][0], placed[n][k][1], gemR, sx, sy); }));
    arms().forEach((a, i) => {
      const { ang, len } = poses[i], r = ang * Math.PI / 180;
      const bx = cellX(a.x), by = cellY(a.y), gx = bx + Math.cos(r) * len * cs, gy = by + Math.sin(r) * len * cs;
      line(bx, by, gx, gy, BRASS_D, 3); line(bx, by, gx, gy, BRASS, 1);
      disc(bx, by, Math.floor(cs * 0.36), BRASS_D); disc(bx, by, Math.floor(cs * 0.36) - 1, ARM_C[i]); disc(bx, by, 1, BRASS_D);
    });
    pieces.forEach((p, n) => {
      const at = placed[n];
      for (const [a, b] of p.bonds) { line(at[a][0], at[a][1], at[b][0], at[b][1], BRASS_D, 4); line(at[a][0], at[a][1], at[b][0], at[b][1], BRASS, 2); }
      p.atoms.forEach((a, k) => drawStone(a.s, at[k][0], at[k][1], gemR));
    });
    arms().forEach((a, i) => {
      const { ang, len, hold } = poses[i], r = ang * Math.PI / 180;
      const gx = cellX(a.x) + Math.cos(r) * len * cs, gy = cellY(a.y) + Math.sin(r) * len * cs;
      const d = hold ? gemR : gemR + 2, nx = -Math.sin(r), ny = Math.cos(r);
      for (const s of [-1, 1]) line(gx + nx * d * s - Math.cos(r) * 2, gy + ny * d * s - Math.sin(r) * 2, gx + nx * d * s + Math.cos(r) * 2, gy + ny * d * s + Math.sin(r) * 2, ARM_C[i], 2);
    });
    if (sim?.err && sim.errAt && clock % 30 < 20) dashed(ox + sim.errAt[0] * cs, oy + sim.errAt[1] * cs, cs, cs, BADC);
    if (zone === 'board' && (clock % 40 < 30 || moving)) {
      const x = ox + cx * cs, y = oy + cy * cs, c = moving ? GOOD : SEL;
      rect(x - 1, y - 1, cs + 2, 1, c); rect(x - 1, y + cs, cs + 2, 1, c); rect(x - 1, y - 1, 1, cs + 2, c); rect(x + cs, y - 1, 1, cs + 2, c);
    }
  }

  function drawPanel(): void {
    const x = 134;
    // Rows sit 9 apart, so a descender keeps a clear pixel. The panel ends above the tapes, which start at 115 at the latest.
    text('Make', x, 13, DIM);
    const sh = pz.outputs[0].shape, [w, h] = shapeSize(sh);
    drawShape(sh, x + 2, 22, 8);
    text(`x${pz.need}`, x + 5 + w * 8, 22 + h * 4 - 4, PAPER);
    let y = 24 + h * 8;
    if (sim) {
      pz.outputs.forEach((_, k) => { text(`Set ${sim!.got[k]}/${pz.need}`, x, y, sim!.done ? GOOD : PAPER); y += 9; });
      text(`Cost ${cost(mach)}`, x, y, DIM);
      return;
    }
    for (const k of KINDS) {
      if (!pz.limit[k]) continue;
      text(NAME[k], x, y, PAPER); textRight(`${pz.limit[k] - used(k)}`, 188, y, used(k) >= pz.limit[k] ? DIM : SEL); y += 9;
    }
    const b = G.gem.best[pz.id];
    y += 2;
    text('Best', x, y, DIM); y += 9;
    if (!b) { text('Not set', x, y, DIM); return; }
    for (const [lab, v] of [['Cycles', b.c], ['Cost', b.k], ['Area', b.a]] as [string, number][]) { text(lab, x, y, PAPER); textRight(String(v), 188, y, SEL); y += 9; }
  }

  function drawTapes(): void {
    const list = arms();
    if (!list.length) { text('Place an arm to write its tape.', 4, tapeY + 2, DIM); return; }
    const per = period(mach), col = sim && sim.cycle > 0 ? (sim.cycle - 1) % per : -1;
    list.forEach((a, i) => {
      const y = tapeY + i * 12;
      disc(9, y + 6, 4, SHADOW);
      disc(8, y + 5, 4, BRASS_D); disc(8, y + 5, 3, ARM_C[i]);
      for (let c = 0; c < TAPE_LEN; c++) {
        const x = 16 + c * 10, s = (a.tape[c] || '.') as Step, live = c < per;
        if (live) boxShadow(x, y, 9, 10);
        rect(x, y, 9, 10, c === col ? '#4a3c5a' : live ? '#241c2c' : '#1b1621');
        if (s === '.') px(x + 4, y + 5, live ? DIM : '#3a3442');
        else textCenter(s, x + 5, y + 1, live ? STEP_C[s] : DIM);
        if (zone === 'tape' && tr === i && tc === c) { rect(x - 1, y - 1, 11, 1, SEL); rect(x - 1, y + 10, 11, 1, SEL); rect(x - 1, y - 1, 1, 12, SEL); rect(x + 9, y - 1, 1, 12, SEL); }
      }
    });
  }

  function drawBar(): void {
    const y = 152;
    BUTTONS.forEach((b, i) => {
      const label = b === 'Run' && running ? 'Stop' : b, x = 3 + i * 38, on = zone === 'bar' && bi === i;
      boxShadow(x, y, 36, 11);
      rect(x, y, 36, 11, on ? '#4a3c5a' : '#241c2c');
      if (on) { rect(x, y, 36, 1, SEL); rect(x, y + 10, 36, 1, SEL); }
      textCenter(label, x + 18, y + 2, on ? SEL : PAPER);
    });
  }

  function drawResult(): void {
    if (!result) return;
    rect(39, 56, 120, 62, SHADOW);
    box(36, 52, 120, 62, SEL);
    // Twinkles come and go round the box's edge.
    for (let k = 0; k < 14; k++) {
      const ph = (clock + k * 23) % 60, at = (k * 0.618) % 1, edge = at * 364;
      const [x, y] = edge < 122 ? [35 + edge, 49] : edge < 182 ? [158, 52 + edge - 122] : edge < 304 ? [156 - (edge - 182), 117] : [33, 112 - (edge - 304)];
      if (ph < 16) twinkle(Math.round(x), Math.round(y), ph < 8 ? 1 + (ph >> 2) : 1 + ((16 - ph) >> 2), '#ffffff', ['#ffd468', '#acf0da', '#e0d0ff'][k % 3]);
    }
    textCenter('Set!', 96, 57, GOOD);
    const rows: [string, number, boolean][] = [['Cycles', result.c, result.best[0]], ['Cost', result.k, result.best[1]], ['Area', result.a, result.best[2]]];
    rows.forEach(([lab, v, nb], i) => {
      text(lab, 46, 70 + i * 10, PAPER);
      textRight(String(v), 120, 70 + i * 10, SEL);
      if (nb) text('best', 124, 70 + i * 10, GOOD);
    });
    textCenter('Z to go on', 96, 102, DIM);
  }

  music.play('gempuzzle');
  return run<void>(m);
}

/** The Setting board from the pause menu: pick a found puzzle and play it. */
export async function settingMenu(): Promise<void> {
  music.play('gempuzzle');
  if (!flag('gemTold')) {
    await hint('Setting: build a machine that carries stones to the setting on the right of the board.');
    await hint('Every puzzle comes from a sketch. Find more sketches around the world.');
    setFlag('gemTold');
  }
  let at = 0;
  for (;;) {
    const list = PUZZLES.filter(p => G.gem.found.includes(p.id));
    const items = list.map(p => p.name + (G.gem.solved.includes(p.id) ? ' *' : ''));
    const carc = [...G.party, ...G.rack].find(m => m.kind === 'carcanet');
    if (carc) items.push(`${carc.name}'s Tape`);
    const i = await listMenu(`Setting  ${G.gem.solved.length}/${PUZZLES.length}`, items, {
      w: 104, start: at,
      detail: k => {
        const p = list[k];
        if (!p) return;
        box(110, 4, 78, 80);
        drawShape(p.outputs[0].shape, 116, 10, 10);
        const b = G.gem.best[p.id];
        if (!b) { text('Not set yet', 114, 46, DIM); return; }
        text('Cycles', 114, 46, PAPER); textRight(String(b.c), 184, 46, SEL);
        text('Cost', 114, 56, PAPER); textRight(String(b.k), 184, 56, SEL);
        text('Area', 114, 66, PAPER); textRight(String(b.a), 184, 66, SEL);
      },
    });
    if (i < 0) break;
    at = i;
    if (carc && i === list.length) await tapeMenu(carc);
    else await playSetting(list[i]);
  }
  save();
}

const TAPE_STONE: Record<string, [Stone, string]> = { p: ['pearl', 'Pearl'], a: ['amber', 'Amber'], g: ['glass', 'Beach glass'], s: ['star', 'Star glass'] };

/** Carcanet's Tape: the four Stones it sets in battle, one a turn, in a loop. */
async function tapeMenu(m: Mon): Promise<void> {
  if (!flag('tapeTold')) {
    await hint(`${m.name} sets one Stone a turn in battle, in this order, round and round. Its newest Stone changes its moves.`);
    await hint('Four alike Stones keep one effect on. Four different Stones let its crest hit every foe.');
    setFlag('tapeTold');
  }
  const keys = Object.keys(TAPE_STONE);
  let at = 0;
  for (;;) {
    const tape = (m.tape || CARCANET_TAPE).split('');
    const i = await listMenu(`${m.name}'s Tape`, tape.map((c, k) => `${k + 1}  ${TAPE_STONE[c][1]}`), {
      w: 104, start: at,
      detail: () => {
        box(110, 4, 78, 40);
        tape.forEach((c, k) => drawStone(TAPE_STONE[c][0], 122 + k * 18, 24, 5));
      },
    });
    if (i < 0) return;
    at = i;
    const j = await listMenu(`Stone ${i + 1}`, keys.map(k => TAPE_STONE[k][1]), { x: 40, y: 40, w: 90, start: keys.indexOf(tape[i]) });
    if (j >= 0) { tape[i] = keys[j]; m.tape = tape.join(''); save(); }
  }
}
