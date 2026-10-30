// Glue between the story, the field, combat, and menus: the scene stage, map changes, rests, camp,
// interactions, approval, quests, and the overlays (fades, chapter cards, game over).
import { setStage, runScene, sceneRunning, partyCheck, type Stage } from './script';
import { G, flag, setFlag, setSave, blankSave } from './state';
import { banterOnArrive } from './banter';
import { noteArrival, eventOnArrive, resolve } from './replay';
import { BACKGROUND, type Destination } from '../content/replay';
import { F, enterMap, changeMapNow, findActor, placeActor, refreshNpcs, lookFor, DIRS, snapCamera, visibleIf, railBlock } from '../world/field';
import { WORLD, rebuildGrids, type Actor, type PropInst } from '../world/world';
import { MAPS, type Dir } from '../world/map';
import { findPath } from '../world/path';
import { T } from '../world/tiles';
import { wait, until, now } from './sched';
import { startCombat } from '../combat/combat';
import { CB } from '../combat/core';
import { MENU, pushScreen, ShopScreen, ReadScreen, closeMenu, PartyPick, TravelScreen } from '../ui/menus';
import { NameEntry } from '../ui/widgets';
import { toast, say } from '../ui/dialogue';
import { C } from '../engine/palette';
import { sheetFor } from '../art/cast';
import { personSheet } from '../art/people';
import { makeMember, maxHp, edgeMax, partyMembers } from '../rules/stats';
import { buildCompanion, COMPANIONS } from '../content/companions';
import { ITEM, ENEMY } from '../rules/data';
import { QUEST } from '../content/quests';
import { LOOT } from '../content/loot';
import { CAMP } from '../content/camp';
import { SPEAKERS } from '../content/speakers';
import { autosave, load } from './save';
import { playMusic, sfx } from '../audio/sfx';
import type { NewGame } from '../ui/title';
import { anim } from './anims';
import { Sluice } from '../ui/sluice';

export const OV = {
  fade: 0,
  card: null as null | { n: number; title: string; t: number },
  gameOver: false,
  name: null as NameEntry | null,
  sluice: null as Sluice | null,
  nameSet: null as null | ((s: string) => void),
  ending: false,
};

function fadeTo(target: number, seconds: number): Promise<void> {
  const start = OV.fade;
  const t0 = now();
  return until(() => {
    const k = Math.min(1, (now() - t0) / Math.max(0.01, seconds));
    OV.fade = start + (target - start) * k;
    return k >= 1;
  });
}

function actorOf(id: string): Actor | undefined { return findActor(id); }

function markerPos(name: string): [number, number] | null { return WORLD.def?.markers?.[name] ?? null; }

async function walkActor(a: Actor, x: number, y: number, run: boolean) {
  const path = findPath(a.tx, a.ty, x, y, { blocked: (px, py) => railBlock(a, px, py) || WORLD.actors.some((o) => o !== a && o.visible && !o.gone && o.tx === px && o.ty === py && o.role !== 'party' && o.role !== 'crowd') });
  if (!path) { placeActor(a, x, y); return; }
  a.path = path;
  a.speed = run ? 8 : a.role === 'party' ? 5 : 4;
  a.hold = true;
  await until(() => a.path.length === 0 && a.px === a.tx * T && a.py === a.ty * T);
  a.hold = false;
}

export const stage: Stage = {
  lock(on) { F.locked = on; },
  async walk(id, x, y, run) {
    const a = actorOf(id);
    if (!a) { console.warn(`[stage] walk: no actor ${id}`); return; }
    if (a === F.leader) {
      await walkActor(a, x, y, run);
      F.trail = [];
      for (const f of F.followers) F.trail.push([f.tx, f.ty]);
      return;
    }
    await walkActor(a, x, y, run);
  },
  async step(id, dir, n) {
    const a = actorOf(id);
    if (!a) return;
    const [dx, dy] = DIRS[dir as Dir] ?? [0, 0];
    await walkActor(a, a.tx + dx * n, a.ty + dy * n, false);
    a.dir = dir as Dir;
  },
  face(id, d) {
    const a = actorOf(id);
    if (!a) return;
    if (d in DIRS) { a.dir = d as Dir; return; }
    const o = actorOf(d);
    if (!o) return;
    const dx = o.tx - a.tx, dy = o.ty - a.ty;
    a.dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
  },
  enter(id, look, x, y, dir) {
    let a = actorOf(id);
    if (!a) {
      a = { id, name: id, sheet: G.roster[id] ? lookFor(id) : sheetFor(look), tx: x, ty: y, px: x * T, py: y * T, dir: (dir as Dir) ?? 'down', anim: 0, moving: false, path: [], speed: 4, role: 'npc', idle: 99, visible: true, lift: 0, alert: 0 };
      if (look === 'courtesy' || look === 'tilly') a.breathe = look === 'tilly' || flag('courtesy_woke');
      WORLD.actors.push(a);
    } else { placeActor(a, x, y); a.visible = true; }
    a.talk = WORLD.def?.npcs?.find((n) => n.id === id)?.talk ?? a.talk;
  },
  exit(id) {
    const a = actorOf(id);
    if (!a || a.role === 'party') return;
    WORLD.actors = WORLD.actors.filter((x) => x !== a);
  },
  emote(id, kind) { const a = actorOf(id); if (a) { a.emote = { kind, t: 1.6 }; sfx(kind === '!' ? 'alarm' : 'blip'); } },
  async camera(target, seconds) {
    if (target === 'free' || target === 'hero' || target === 'leader') { WORLD.camTarget = null; await wait(target === 'free' ? Math.min(0.6, seconds) : seconds); return; }
    let p: [number, number] | null = null;
    if (target.startsWith('@')) p = markerPos(target.slice(1));
    else { const a = actorOf(target); if (a) p = [a.tx, a.ty]; }
    if (!p) return;
    WORLD.camTarget = { x: p[0] * T + 5, y: p[1] * T + 5 };
    await wait(seconds);
  },
  marker: markerPos,
  async warp(map, marker, dir) { await changeMap(map, marker, dir as Dir | undefined); },
  async fade(dir, seconds) { await fadeTo(dir === 'out' ? 1 : 0, seconds); },
  shake(n) { WORLD.shake = 0.15 * n + 0.2; sfx('hit', { vol: 0.3 }); },
  music(t) { playMusic(t); },
  async chapter(n, title) {
    OV.card = { n, title, t: 0 };
    sfx('quest');
    await until(() => !OV.card);
  },
  async fight(id) {
    const def = WORLD.def!;
    const enc = def.encounters?.find((e) => e.id === id);
    if (!enc) { console.warn(`[stage] no encounter ${id}`); return true; }
    if (G.defeated.includes(`${def.id}:${id}`)) return true;
    const { spawnEncounters } = await import('../world/field');
    const was = enc.showIf, was2 = enc.hideIf;
    enc.showIf = undefined; enc.hideIf = undefined;
    spawnEncounters(def);
    enc.showIf = was; enc.hideIf = was2;
    autosave();
    return fightNow([id], false);
  },
  async hostile(npc, encId) {
    const a = actorOf(npc);
    if (a) { a.role = 'enemy'; a.encounter = encId ?? a.encounter; }
    if (encId) return stage.fight(encId);
    return true;
  },
  async shop(id) {
    let open = true;
    pushScreen(new ShopScreen(id, () => { open = false; }));
    await until(() => !open);
  },
  async rest() { await longRest(true); },
  async nameEntry(what) {
    const init = what === 'port' ? G.port.name : G.heroName;
    OV.name = new NameEntry(what === 'port' ? 'Name it' : 'Your name', init);
    OV.nameSet = (s) => { if (what === 'port') G.port.name = s; else G.heroName = s; };
    await until(() => !OV.name);
  },
  join(id) { joinParty(id); },
  leave(id) {
    G.party = G.party.filter((x) => x !== id);
    const a = WORLD.actors.find((x) => x.id === id && x.role === 'party');
    if (a) { a.role = 'npc'; F.followers = F.followers.filter((f) => f !== a); }
  },
  look(id, look) { const a = actorOf(id); if (a) a.sheet = look === 'self' ? lookFor(id) : sheetFor(look); },
  async anim(name, args) { await anim(name, args); },
  autosave() { autosave(); },
  async ending() { OV.ending = true; await until(() => !OV.ending); },
  async travel() { await travelMenu(); },
  heal() { for (const m of Object.values(G.roster)) { m.hp = maxHp(m); m.downed = false; } },
  refresh() { refreshNpcs(); },
  quest(id, st, note) { questStep(id, st, note); },
  approve(id, n) { approve(id, n); },
  async cards(op) {
    OV.sluice = new Sluice(op);
    playMusic('lanterns');
    await until(() => !!OV.sluice?.done);
    const won = OV.sluice?.won === true;
    OV.sluice = null;
    playMusic(WORLD.def?.music ?? 'deeps');
    return won;
  },
  give(item, n) {
    G.items[item] = (G.items[item] ?? 0) + n;
    const it = ITEM.get(item);
    toast(`${it?.name ?? item}${n > 1 ? ' x' + n : ''}`, C.pale);
    sfx('loot');
  },
};

setStage(stage);

export function joinParty(id: string) {
  if (!G.roster[id]) {
    const lvl = G.roster.hero?.level ?? 1;
    G.roster[id] = buildCompanion(id, lvl);
  }
  const m = G.roster[id];
  m.dead = false;
  if (!G.party.includes(id)) {
    if (G.party.length < 4) G.party.push(id);
    else { toast(`${m.name} is waiting at camp`, C.gray); return; }
  }
  const npc = WORLD.actors.find((a) => a.id === id);
  if (npc) {
    npc.role = 'party';
    npc.sheet = lookFor(id);
    npc.talk = undefined;
    if (!F.followers.includes(npc) && npc !== F.leader) F.followers.push(npc);
  } else {
    const L = F.leader!;
    const back = F.trail[F.followers.length] ?? [L.tx, L.ty];
    const a: Actor = { id, name: m.name, sheet: lookFor(id), tx: back[0], ty: back[1], px: back[0] * T, py: back[1] * T, dir: L.dir, anim: 0, moving: false, path: [], speed: 6, role: 'party', idle: 0, visible: true, lift: 0, alert: 0 };
    WORLD.actors.push(a);
    F.followers.push(a);
  }
  if (id === 'courtesy') { const a = WORLD.actors.find((x) => x.id === id); if (a) a.breathe = true; }
  toast(`${m.name} has joined`, SPEAKERS[COMPANIONS[id]?.name ?? '']?.color ?? C.cyan3);
  sfx('approve');
}

export function approve(id: string, n: number) {
  const m = G.roster[id];
  if (!m || n === 0) return;
  m.approval = Math.max(-50, Math.min(50, m.approval + n));
  const name = m.name;
  if (G.party.includes(id) || id === 'courtesy') {
    toast(`${name} ${n > 0 ? 'approves' : 'disapproves'}`, n > 0 ? C.grn3 : C.mag3);
    sfx(n > 0 ? 'approve' : 'disapprove');
  }
  if (m.approval <= -30 && !G.flags[`${id}_left`] && id !== 'courtesy') {
    setFlag(`${id}_left`);
    G.party = G.party.filter((x) => x !== id);
    m.dead = true;
    toast(`${name} has left`, C.mag3);
  }
}

export function questStep(id: string, st: string, note?: string) {
  const d = QUEST.get(id);
  if (!d) { console.warn(`[quest] unknown ${id}`); return; }
  const q = G.quests[id] ?? (G.quests[id] = { stage: 0, log: [] });
  const isNew = !G.quests[id] || q.stage === 0 && !q.log.length && !q.done;
  if (st === 'done') {
    if (q.done) return;
    q.done = true;
    toast(`Complete: ${d.title}`, C.amb3);
    sfx('quest');
    if (d.xp) { void import('../rules/stats').then(({ grantXp }) => { const ups = grantXp(d.xp!); toast(`+${d.xp} XP`, C.cyan3); for (const u of ups) toast(`${u.id === 'hero' ? G.heroName : G.roster[u.id].name} hit level ${u.level}`, C.amb3); }); }
  } else if (st === 'fail') { q.failed = true; toast(`Failed: ${d.title}`, C.mag3); }
  else {
    const n = Number(st);
    if (n < q.stage) return;
    const fresh = q.stage === 0;
    q.stage = n;
    q.seen = false;
    toast(fresh || isNew ? `New: ${d.title}` : `Journal: ${d.title}`, d.kind === 'main' ? C.amb3 : C.cyan3);
    sfx('quest');
  }
  if (note) q.log.push(note);
}

export async function fightNow(encounters: string[], surprise: boolean): Promise<boolean> {
  const won = await startCombat(encounters, surprise);
  playMusic(WORLD.def?.music ?? 'deeps');
  if (!won) { await gameOver(); return false; }
  for (const id of encounters) {
    const enc = WORLD.def!.encounters?.find((e) => e.id === id);
    if (enc?.win && !sceneRunning()) await runScene(enc.win);
    else if (enc?.win) await runScene(enc.win);
  }
  return true;
}

async function gameOver() {
  OV.gameOver = true;
  await until(() => !OV.gameOver);
}

/** Loads the autosave after a defeat, or the title if there is none. */
export function reloadAfterDefeat(): boolean {
  if (load('auto')) { resumeLoaded(); return true; }
  return false;
}

export async function changeMap(to: string, at: string, dir?: Dir) {
  if (!MAPS.has(to)) { console.warn(`[map] no map ${to}`); return; }
  sfx('door');
  await fadeTo(1, 0.25);
  changeMapNow(to, at);
  noteArrival(to);
  if (dir) { F.leader!.dir = dir; G.dir = dir; }
  const def = MAPS.get(to)!;
  G.district = def.district === 'deeps' ? 'The Deeps' : def.district === 'stair' ? 'The Stair' : def.district === 'brim' ? 'The Brim' : def.district === 'flats' ? 'The Flats' : G.district;
  if (def.music) playMusic(def.music);
  snapCamera();
  if (!CB.active && !sceneRunning()) autosave();
  await fadeTo(0, 0.3);
  void (async () => {
    if (travelArrival === to) { travelArrival = null; await until(() => !sceneRunning()); }
    if (def.enter && !sceneRunning()) await runScene(def.enter);
    const ev = sceneRunning() ? null : eventOnArrive(to);
    if (ev) await runScene(ev);
  })();
  banterOnArrive(to);
}

/** The map a travel pick is heading to, so its arrival waits for the travel scene to end. */
let travelArrival: string | null = null;

async function travelMenu() {
  let pick = null as Destination | null;
  let closed = false;
  pushScreen(new TravelScreen((d) => { pick = d; }, () => { closed = true; }));
  await until(() => closed);
  if (pick) { const to = resolve(pick); travelArrival = to.map; await changeMap(to.map, to.marker); }
}

export function resumeLoaded() {
  closeMenu();
  CB.active = false;
  F.inCombat = false;
  F.locked = false;
  enterMap(G.map, [G.x, G.y], G.dir);
  const def = MAPS.get(G.map);
  playMusic(def?.music ?? 'deeps');
  OV.fade = 0;
  if (def?.enter && !sceneRunning()) void runScene(def.enter);
}

export async function beginGame(n: NewGame) {
  const s = blankSave();
  s.heroName = n.name;
  s.cls = n.cls;
  s.look = n.look;
  s.difficulty = n.difficulty;
  setSave(s);
  const hero = makeMember('hero', n.name, n.cls, 1);
  hero.look = n.look;
  G.roster.hero = hero;
  G.party = ['hero'];
  G.items = { stim: 2, noodles: 2 };
  const bg = BACKGROUND.get(n.bg ?? 'runner') ?? BACKGROUND.get('runner')!;
  G.bg = bg.id;
  hero.skills[bg.skill] += 1;
  G.items[bg.item] = (G.items[bg.item] ?? 0) + 1;
  const start = MAPS.get('home') ? 'home' : [...MAPS.keys()][0];
  G.map = start;
  const p = MAPS.get(start)!.markers?.start ?? [2, 2];
  G.x = p[0]; G.y = p[1];
  OV.fade = 1;
  enterMap(G.map, p, 'down');
  noteArrival(G.map);
  playMusic(MAPS.get(start)?.music ?? 'home');
  void runScene('ch1_open').then(() => { if (OV.fade > 0) void fadeTo(0, 0.4); });
  if (!SCENE_EXISTS('ch1_open')) await fadeTo(0, 0.5);
}

import { SCENES } from './script';
function SCENE_EXISTS(id: string) { return SCENES.has(id); }

// ---------- interactions ----------

export function talkTo(a: Actor) {
  if (!a.talk) return;
  a.hold = true;
  void runScene(a.talk).then(() => { a.hold = false; });
}

export function useProp(p: PropInst) {
  if (p.place.scene) { void runScene(p.place.scene); return; }
  const key = `${G.map}:${p.id}`;
  if (p.place.loot || p.def.use === 'loot') {
    if (G.looted.includes(key)) { toast('Empty', C.gray); return; }
    G.looted.push(key);
    const t = LOOT.get(p.place.loot ?? 'junk');
    if (!t) { toast('Empty', C.gray); return; }
    let any = false;
    for (const [id, n, ch] of t.items) if (Math.random() < ch) { G.items[id] = (G.items[id] ?? 0) + n; toast(`${ITEM.get(id)?.name ?? id}${n > 1 ? ' x' + n : ''}`, C.pale); any = true; }
    if (t.gilt) { const g = t.gilt[0] + Math.floor(Math.random() * (t.gilt[1] - t.gilt[0] + 1)); G.gilt += g; toast(`+${g} gilt`, C.amb3); any = true; }
    if (!any) toast('Nothing useful', C.gray);
    sfx('loot');
    return;
  }
  if (p.def.use === 'buy') { pushScreen(new ShopScreen(p.def.kind === 'vending2' ? 'noodlevend' : 'vend', () => {})); return; }
  if (p.def.use === 'read') { toast(p.def.name, C.gray); return; }
}

// ---------- rest ----------

/** The map the party sleeps on: the barge in acts 1 and 3, the crypt in act 2. */
export function campMap(): string { return G.campMap ?? 'camp'; }

function supplies(): number { return Object.entries(G.items).reduce((s, [id, n]) => s + (ITEM.get(id)?.supplies ?? 0) * n, 0); }

function eat(n: number): boolean {
  if (supplies() < n) return false;
  const foods = Object.keys(G.items).filter((id) => ITEM.get(id)?.supplies).sort((a, b) => ITEM.get(a)!.supplies! - ITEM.get(b)!.supplies!);
  let left = n;
  while (left > 0) {
    const id = foods.find((f) => G.items[f] > 0);
    if (!id) break;
    G.items[id]--;
    if (G.items[id] <= 0) delete G.items[id];
    left -= ITEM.get(id)!.supplies!;
  }
  return true;
}

export function shortRest() {
  if (G.shortRests <= 0) return;
  G.shortRests--;
  for (const m of partyMembers()) {
    const mh = maxHp(m);
    m.hp = Math.min(mh, Math.max(1, m.hp) + Math.ceil((mh - Math.max(0, m.hp)) / 2));
    for (const k of Object.keys(m.spent)) if (isShort(k)) delete m.spent[k];
  }
  toast('Short rest', C.cyan3);
  sfx('heal');
}

import { ABILITY } from '../rules/data';
function isShort(id: string): boolean { return ABILITY.get(id)?.uses?.per === 'short'; }

/** A long rest: go to camp, eat, heal, and play a camp scene if one is ready. */
export async function longRest(fromScript = false) {
  if (!fromScript && !flag('camp_open')) { toast('Nowhere safe to sleep yet', C.gray); return; }
  if (!fromScript && WORLD.def?.inside && G.map !== campMap()) { toast('Rest outside or at camp', C.gray); return; }
  if (!eat(40)) {
    if (!fromScript) {
      toast('Not enough food. A poor night.', C.mag3);
      for (const m of Object.values(G.roster)) m.hp = Math.max(m.hp, Math.ceil(maxHp(m) / 2));
      G.shortRests = Math.max(G.shortRests, 1);
      return;
    }
  }
  const back = G.map !== campMap() && MAPS.has(campMap()) ? { map: G.map, x: G.x, y: G.y } : null;
  await fadeTo(1, 0.6);
  if (back) { G.campReturn = back; changeMapNow(campMap(), 'start'); playMusic('camp'); }
  for (const m of Object.values(G.roster)) { m.hp = maxHp(m); m.spent = {}; m.edge = edgeMax(m); m.downed = false; }
  G.shortRests = 2;
  setFlag('rested', (G.flags.rested ?? 0) + 1);
  snapCamera();
  await wait(0.4);
  await fadeTo(0, 0.8);
  const scene = CAMP.find((c) => (c.repeat || !G.flags[`camp:${c.scene}`]) && flag(c.when));
  if (scene) { setFlag(`camp:${scene.scene}`); await runScene(scene.scene); }
  autosave();
}

export async function leaveCamp() {
  const r = G.campReturn;
  if (!r) return;
  G.campReturn = undefined;
  await fadeTo(1, 0.4);
  enterMap(r.map, [r.x, r.y], G.dir);
  playMusic(MAPS.get(r.map)?.music ?? 'deeps');
  await fadeTo(0, 0.4);
}

MENU.hooks.rest = (kind) => { if (kind === 'short') shortRest(); else void longRest(false); };
MENU.hooks.loaded = () => resumeLoaded();

export function campPick() { pushScreen(new PartyPick()); }

/** Rebuilds the party actors after the roster changes at camp. */
export function refreshParty() {
  const L = F.leader;
  if (!L) return;
  enterMap(G.map, [L.tx, L.ty], L.dir);
}

export { visibleIf, rebuildGrids, personSheet, say };

// ---------- stealth: takedowns and pickpocketing ----------

function behind(a: Actor, L: Actor): boolean {
  const [fx, fy] = DIRS[a.dir];
  return (L.tx - a.tx) * fx + (L.ty - a.ty) * fy <= 0;
}

export async function sneakAct(a: Actor) {
  const L = F.leader!;
  F.locked = true;
  try {
    if (a.role === 'enemy') {
      const def = WORLD.def!;
      const enc = def.encounters?.find((e) => e.id === a.encounter);
      const idx = enc?.units.findIndex((u, i) => (u.id ?? `${enc.id}_${i}`) === a.id) ?? -1;
      const kind = enc && idx >= 0 ? enc.units[idx].kind : '';
      const ed = ENEMY.get(kind);
      if (!enc || !ed || ed.boss || ed.machine || !behind(a, L)) {
        if (enc) { a.emote = { kind: '!', t: 1 }; await fightNow([enc.id], !!ed && !ed.boss && behind(a, L)); }
        return;
      }
      const ok = await partyCheck('sneak', ed.level >= 4 ? 3 : 2);
      if (!ok) { a.emote = { kind: '!', t: 1 }; sfx('alarm'); await fightNow([enc.id], false); return; }
      sfx('melee');
      a.out = true; a.role = 'npc'; a.encounter = undefined; a.tint = C.slate; a.lift = -3; a.emote = { kind: 'zzz', t: 2 }; a.talk = undefined;
      const { grantXp } = await import('../rules/stats');
      grantXp(ed.xp);
      toast(`+${ed.xp} XP`, C.cyan3);
      const left = WORLD.actors.some((o) => o.encounter === enc.id && !o.gone && !o.out && o.role === 'enemy');
      if (!left) G.defeated.push(`${def.id}:${enc.id}`);
      return;
    }
    if (a.pocket) {
      if (!behind(a, L)) { toast('They would see you.', C.gray); return; }
      const ok = await partyCheck('sneak', 2);
      if (ok) { G.flags['stole_' + a.id] = 1; stage.give(a.pocket, 1); a.pocket = undefined; refreshNpcs(); return; }
      a.emote = { kind: '!', t: 1.4 };
      G.flags['caught_' + a.id] = 1;
      if (a.talk) await runScene(a.talk);
    }
  } finally { F.locked = false; }
}

F.hooks.sneak = (a) => { if (!sceneRunning() && !CB.active) void sneakAct(a); };
