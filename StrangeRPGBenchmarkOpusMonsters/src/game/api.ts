// The toolbox story scripts use.
import type { Mon } from '../battle/model';
import { makeMon } from '../data/species';
import { bellTone, sfx, type Sfx } from '../engine/audio';
import { music } from '../engine/music';
import type { TrackId } from '../engine/score';
import { ctx, dither, rect } from '../engine/screen';
import { sceneNow } from './backdrops';
import { battle, type BattleOpts, type BattleOutcome } from './battleView';
import { choose, hint, notice, say } from './dialogue';
import { field, giveMon, type ActKind, type EmoteKind } from './field';
import { fitterMenu } from './fitter';
import { joinJingle } from './jingles';
import { listMenu, rack, shop, tanMenu } from './menus';
import { G, fittingUnlocked, loosened, notionsUnlocked, save } from './state';
import { SPAWNS, type TrainerDef } from './world';
import { FIELD_ITEMS } from './items';

export { say, choose, giveMon, field, G, hint, notice };

export const narr = (t: string) => say(null, t);
export async function lines(who: string | null, ls: string[]): Promise<void> { for (const l of ls) await say(who, l); }
export const flag = (k: string) => G.flags[k] || 0;
export const setFlag = (k: string, v = 1) => { G.flags[k] = v; };
export const wait = (n: number) => field.waitFrames(n);

export function goal(t: string): void { field.goalText = t; G.flags.goalSet = 1; (G as any).goal = t; }

export async function fightTrainer(tr: TrainerDef): Promise<BattleOutcome> {
  return field.fight(tr);
}

export async function fightWild(mon: Mon, opts: { canRun?: boolean; scripted?: string; area?: string; bossHp?: number; ai?: 'wild' | 'keeper' | 'champion'; tips?: BattleOpts['tips']; music?: TrackId } = {}): Promise<BattleOutcome> {
  const r = await battle({ enemy: [mon], name: 'Wild', ai: opts.ai || 'wild', wild: true, canRun: opts.canRun !== false, bg: field.bg(), area: opts.area || field.map.zone?.area, scripted: opts.scripted, music: opts.music ?? (opts.bossHp ? 'legend' : 'wild'), bossHp: opts.bossHp, tips: opts.tips });
  field.playMapMusic();
  return r;
}

export function givePegs(kind: 'twig' | 'brass' | 'bone' | 'iron', n: number): void { G.pegs[kind] += n; }
export function giveNotion(id: string, n = 1): void { G.notions[id] = (G.notions[id] || 0) + n; }
export function giveKey(k: string): void { if (!G.keys.includes(k)) G.keys.push(k); }
export function giveScale(s: string): void { if (!G.scales.includes(s)) G.scales.push(s); sfx('level'); }

export async function warp(map: string, x: number, y: number, dir = 0): Promise<void> {
  await field.changeMap(map, x, y, dir);
}

export async function shake(n = 30): Promise<void> { field.shakeT = n; await wait(n); }

/**
 * A Stay comes loose. The music drops a semitone for good and the ground creases. When that changes tiles on this map,
 * the camera goes to them and they change one after another outward from `at` (by default the first changed tile).
 */
export async function stayComesLoose(id: string, byVellum: boolean, at?: [number, number]): Promise<void> {
  if (G.pulled.includes(id)) return;
  sfx('boom');
  field.shakeT = 70;
  field.flashT = 20;
  await wait(40);
  await morph(on => {
    const i = G.pulled.indexOf(id);
    if (on && i < 0) G.pulled.push(id);
    if (!on && i >= 0) G.pulled.splice(i, 1);
  }, at, 2, true);
  if (byVellum) G.flags['pulledBy_' + id] = 1;
  music.setDrop(loosened());
  save();
}

/** Evening: an ordered-dither screen of violet over the field, and darker palettes in battle. */
export function evening(on: boolean): void {
  sceneNow.dusk = on ? 1 : 0;
}

export async function moveNpc(id: string, path: string): Promise<void> { await field.walkNpc(id, path); }
export async function movePlayer(path: string): Promise<void> { await field.walkPlayer(path); }
export function npcAt(id: string, x: number, y: number, dir = 0): void {
  const n = field.npc(id);
  if (n) { n.x = x; n.y = y; n.px = x * 8; n.py = y * 8; n.dir = dir; }
}
export function face(id: string, dir: number): void { field.face(id, dir); }
export function facePlayer(dir: number): void { field.dir = dir; }

// Scene tools. `who` is 'ouro', 'whorl' (the lead whorl walking behind Ouro), or a person's id on this map.

/** Walks someone to a tile round walls and people. Run several in Promise.all to walk them at once. */
export const walkTo = (who: string, x: number, y: number, frames?: number): Promise<void> => field.walkTo(who, x, y, frames);
/** Walks someone to Ouro's side and turns them to face Ouro. */
export async function walkUp(who: string): Promise<void> { await field.walkTo(who, field.x, field.y); field.faceToward(who, 'ouro'); }
/** Walks a person to a map edge or a door and takes them out of the scene. Set the flag that keeps them gone after. */
export async function walkOff(id: string, x: number, y: number): Promise<void> {
  await field.walkTo(id, x, y);
  const n = field.npc(id);
  if (n) n.hidden = true;
}
/**
 * Brings a person in at a map edge or a door and walks them to a tile, by default the tile the map places them on.
 * Set the flag that shows them just before this, so they appear at the door and never where they will end up.
 */
export async function walkIn(id: string, fromX: number, fromY: number, toX?: number, toY?: number, frames?: number): Promise<void> {
  const n = field.npc(id);
  if (!n) return;
  const tx = toX ?? n.def.x, ty = toY ?? n.def.y;
  n.x = fromX; n.y = fromY; n.px = fromX * 8; n.py = fromY * 8; n.lx = fromX; n.ly = fromY; n.hidden = false;
  await field.walkTo(id, tx, ty, frames);
}
/** Walks a person off the screen by the shortest way and hides them. Set the flag that keeps them gone after. */
export const walkAway = (id: string): Promise<void> => field.walkAway(id);
/** Shows a person at a way in that is not walkable ground, such as open water, for a step-by-step walk to bring them on. */
export function standAt(id: string, x: number, y: number): void {
  const n = field.npc(id);
  if (n) { n.x = x; n.y = y; n.px = x * 8; n.py = y * 8; n.lx = x; n.ly = y; n.hidden = false; }
}
/** Shows a bubble over someone: surprise, question, silence, music, sweat, anger, or heart. */
export const emote = (who: string, kind: EmoteKind): Promise<void> => field.emote(who, kind);
/** Plays a short action: hop, shiver, bow, nod, lift, look (left and right), or back (a step back). */
export const act = (who: string, kind: ActKind): Promise<void> => field.act(who, kind);
export const faceToward = (who: string, other: string): void => field.faceToward(who, other);
/** Fades a person in where they stand (a cast lifting off a back), or out and away. */
export const fadeWho = (id: string, show: boolean, frames?: number): Promise<void> => field.fadeWho(id, show, frames);
/** Moves the camera to center a tile. */
export const pan = (x: number, y: number): Promise<void> => field.pan(x, y);
/** Moves the camera back to Ouro. */
export const panBack = (): Promise<void> => field.panBack();
/** Places a prop, a tile character, 'mon:kind', or 'person:sprite' on the map with a fade. */
export const prop = (key: string, what: string, x: number, y: number, frames?: number): Promise<void> => field.prop(key, what, x, y, frames);
/** Fades a placed thing out. */
export const unprop = (key: string, frames?: number): Promise<void> => field.unprop(key, frames);
/** Tints the field toward a color over some frames. Level 0 clears it. */
export const tint = (c: string, level: number, frames?: number): Promise<void> => field.tint(c, level, frames);
/**
 * A cast lifts off someone in one piece: the person `id` fades in on `from`'s tile, rising, then steps to x, y.
 * Keep them offstage until this runs.
 */
export async function liftOff(id: string, from: string, x?: number, y?: number): Promise<void> {
  const n = field.npc(id), at = field.whoTile(from);
  if (!n || !at) return;
  n.x = at[0]; n.y = at[1]; n.px = at[0] * 8; n.py = at[1] * 8; n.lx = n.x; n.ly = n.y;
  await Promise.all([field.fadeWho(id, true, 30), field.act(id, 'lift')]);
  if (x !== undefined && y !== undefined) await field.walkTo(id, x, y);
}
/** A whorl or a cast walks up to Ouro and goes in with Ouro's four, fading as it joins. */
export async function joinOuro(id: string): Promise<void> {
  await walkUp(id);
  joinJingle();
  await field.fadeWho(id, false, 20);
}
/** Keeps people out of the scene until walkIn brings them on, so a flag that shows them does not make them appear. */
export function offstage(...ids: string[]): void { for (const id of ids) { const n = field.npc(id); if (n) n.hidden = true; } }

/**
 * Sets a flag that changes tiles on this map, fading the new tiles in one after another outward from x, y first:
 * a crack running, a Stay falling, a wall of salt rising. `frames` is the gap between tiles.
 */
export async function morphTo(key: string, x: number, y: number, frames = 3, value = 1): Promise<void> {
  const old = G.flags[key] || 0;
  await morph(on => { G.flags[key] = on ? value : old; }, [x, y], frames, false);
}

/**
 * Makes a change of state by `apply(true)` (and undoes it with `apply(false)` while it looks), fading in every tile on
 * this map that the change alters, nearest `at` first. With `look`, the camera goes to the tiles and comes back.
 */
export async function morph(apply: (on: boolean) => void, at: [number, number] | undefined, frames: number, look: boolean): Promise<void> {
  const m = field.map, W = m.rows[0].length, H = m.rows.length;
  const was: string[] = [];
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) was.push(field.tile(tx, ty));
  apply(true);
  const diff: [number, number, string][] = [];
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) { const ch = field.tile(tx, ty); if (ch !== was[ty * W + tx]) diff.push([tx, ty, ch]); }
  apply(false);
  if (!diff.length) { apply(true); await wait(10); return; }
  const [x, y] = at || [diff[0][0], diff[0][1]];
  diff.sort((a, b) => Math.abs(a[0] - x) + Math.abs(a[1] - y) - (Math.abs(b[0] - x) + Math.abs(b[1] - y)));
  // A scene that has already moved the camera keeps it where it put it.
  if (field.panAt) look = false;
  if (look) {
    const mx = Math.round(diff.reduce((n, d) => n + d[0], 0) / diff.length), my = Math.round(diff.reduce((n, d) => n + d[1], 0) / diff.length);
    await field.pan(mx, my);
  }
  for (const [i, [tx, ty, ch]] of diff.entries()) {
    void field.prop('morph' + i, ch, tx, ty, 8);
    if (i % 3 === 0) sfx('bump');
    if (frames > 0) await wait(frames);
  }
  await wait(10);
  apply(true);
  diff.forEach((_, i) => void field.unprop('morph' + i, 0));
  if (look) { await wait(30); await field.panBack(); }
}

/** Rings a bell far off, semitones above a low C. */
export const bell = (semi: number): void => bellTone(semi);
/** Plays a sound. */
export const sound = (name: Sfx): void => sfx(name);

export const TOWNS: Record<string, { name: string; map: string; x: number; y: number }> = {
  fellside: { name: 'Turnstone', map: 'fellside', x: 22, y: 16 },
  rib: { name: 'Rib', map: 'rib', x: 21, y: 17 },
  mast: { name: 'Mast', map: 'mast', x: 21, y: 18 },
  spire: { name: 'Spire', map: 'spire', x: 20, y: 20 },
  bole: { name: 'Bole', map: 'bole', x: 21, y: 17 },
  hum: { name: 'Hum', map: 'hum', x: 22, y: 20 },
  tusk: { name: 'Tusk', map: 'tusk', x: 20, y: 28 },
  hilt: { name: 'Hilt', map: 'hilt', x: 20, y: 16 },
  fall: { name: 'Fall', map: 'fall', x: 20, y: 20 },
};

for (const t of Object.values(TOWNS)) SPAWNS[t.map] = [t.x, t.y];

export async function cart(): Promise<void> {
  const can = Object.entries(TOWNS).filter(([k]) => G.flags['visited_' + k]);
  if (can.length < 2) { await say('Carter', 'Cart goes between towns you\'ve been to. You\'ve been to the one.'); return; }
  const i = await listMenu('Ride the cart, 10 cowries', can.map(([, t]) => t.name), { w: 120 });
  if (i < 0) return;
  if (G.rind < 10) { await say('Carter', 'Ten cowries. You\'ve not got ten.'); return; }
  G.rind -= 10;
  const t = can[i][1];
  await warp(t.map, t.x, t.y, 0);
}

/** Towns whose grotto sells the Lure Shell. */
const LURE_TOWNS = ['mast', 'hum', 'hilt'];
/** Spent notions every grotto stocks once notions are open. */
const SPENT_STOCK = ['seabiscuit', 'smellingsalt'];

/** The tannery counter in every town. */
/** Extra tannery options that content adds, such as minigames. */
export const tanneryExtras: { label: string; when: () => boolean; run: () => Promise<void> }[] = [];

export async function tannery(town: string, stock: string[]): Promise<void> {
  G.lastTannery = { map: field.map.id, x: field.x, y: field.y };
  G.flags['visited_' + town] = 1;
  save();
  for (;;) {
    const opts = ['Buy', 'The Midden'];
    if (G.tan > 0 || [...G.party, ...G.rack].some(m => m.tan && Object.keys(m.tan).length)) opts.push('Nacre');
    if (fittingUnlocked() && G.flags['fitter_' + town]) opts.push('Conjoiner');
    for (const x of tanneryExtras) if (x.when()) opts.push(x.label);
    opts.push('Cart', 'Leave');
    const i = await choose(opts, true, 'Shellwright: What do you want?');
    const k = opts[i];
    if (i < 0 || k === 'Leave') return;
    if (k === 'Buy') {
      const extra = [...FIELD_ITEMS.filter(id => id !== 'lure' || LURE_TOWNS.includes(town)), ...(notionsUnlocked() ? SPENT_STOCK : [])];
      await shop([...(notionsUnlocked() ? stock : stock.filter(s => ['twig', 'brass', 'bone'].includes(s))), ...extra.filter(s => !stock.includes(s))]);
    }
    if (k === 'The Midden') await rack();
    if (k === 'Nacre') await tanMenu();
    const extra = tanneryExtras.find(x => x.label === k);
    if (extra) await extra.run();
    if (k === 'Conjoiner') await fitterMenu();
    if (k === 'Cart') { await cart(); return; }
  }
}

export function mon(kind: string, level: number): Mon { return makeMon(kind, level); }
