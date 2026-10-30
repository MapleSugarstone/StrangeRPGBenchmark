// The fight loop: building units from the map, initiative, the player's turn controls, the combat interface,
// and the end of the fight.
import { CB, dist, unitAt, foesOf, los, hitInfo, weaponFor, isMelee, coverOf, freeTile, rangeOf, rnd, roll, idx } from './core';
import { type Unit, unitFromMember, unitFromEnemy, alive, has, hostile } from './unit';
import { aiTurn } from './ai';
import { startTurn, endTurn, tickSurfaces, useAbility, canUse, validTarget, areaOf, moveAlong, droneAct, runFrameQueue, float, ramCost, bloodCost, shoveChance, pause, MOOD_COLOR } from './actions';
import { ABILITY, ITEM, STATUSES, type AbilityDef } from '../rules/data';
import { WORLD, propAt } from '../world/world';
import { reachable, findPath, type Pt } from '../world/path';
import { F, DIRS } from '../world/field';
import { T } from '../world/tiles';
import { G } from '../game/state';
import { grantXp } from '../rules/stats';
import { LOOT } from '../content/loot';
import { ENEMY } from '../rules/data';
import { pressed, repeat, MOUSE, mouseActive, consume, isDown, type Button } from '../engine/input';
import { W, H } from '../engine/screen';
import { LAYOUT } from '../engine/layout';
import { C, LIGHT } from '../engine/palette';
import { rect, box, shadeRect, blitUI, upx, hline, dotFrame } from '../engine/gfx';
import { drawText, textWidth } from '../engine/font';
import { addLight } from '../engine/light';
import { abilityIcon } from '../art/abilityIcons';
import { toast, closeDialogue } from '../ui/dialogue';
import { sfx, combatEvent, playMusic } from '../audio/sfx';
import { wait } from '../game/sched';

interface Bar { id: string; label: string; icon: string; item?: string }

const PI = {
  cx: 0, cy: 0,
  mode: 'move' as 'move' | 'target' | 'items',
  ab: null as string | null,
  item: null as string | null,
  reach: new Map<number, number>(),
  path: null as Pt[] | null,
  resolve: null as null | (() => void),
  bar: [] as Bar[],
  itemSel: 0,
  showOrder: 0,
  banner: { text: '', t: 0, color: C.pale as number },
  hoverBar: -1,
  acting: false,
  tipT: 0,
};

export function combatActive(): boolean { return CB.active; }

/** Starts a fight with the given encounter groups on the current map. Resolves true on a win. */
export async function startCombat(encounters: string[], surprise: boolean, music = 'combat'): Promise<boolean> {
  const def = WORLD.def!;
  // The line said just before a scripted fight would otherwise stay on screen for the whole fight.
  closeDialogue();
  CB.active = true;
  F.inCombat = true;
  F.sneaking = false;
  CB.units = [];
  CB.surf = new Map();
  CB.floats = []; CB.sparks = []; CB.tracers = []; CB.flashes = [];
  CB.round = 1;
  CB.turn = 0;
  CB.surprise = surprise;
  CB.stats = { actions: 0, plain: 0, env: 0, swings: 0, lead: 0, closeCall: false, deadTurns: 0, turns: 0 };
  const groups = new Set(encounters);
  // Other groups close to the fight join it.
  for (const e of def.encounters ?? []) {
    if (groups.has(e.id)) continue;
    const mine = WORLD.actors.filter((a) => a.encounter === e.id && !a.gone);
    const near = mine.some((a) => WORLD.actors.some((b) => b.encounter && groups.has(b.encounter) && Math.abs(a.tx - b.tx) + Math.abs(a.ty - b.ty) <= (e.radius ?? 6)));
    if (near && e.start !== 'script') groups.add(e.id);
  }
  CB.encounters = [...groups];
  for (const a of WORLD.actors) {
    if (a.role === 'party' && a.visible) {
      const m = G.roster[a.id];
      if (!m) continue;
      const u = unitFromMember(m, a);
      if (m.hp <= 0) { u.downed = true; a.tint = C.slate; }
      CB.units.push(u);
    }
  }
  for (const a of WORLD.actors) {
    if ((a.role === 'enemy' || a.role === 'ally') && a.encounter && groups.has(a.encounter) && !a.gone) {
      const enc = def.encounters!.find((e) => e.id === a.encounter)!;
      const up = enc.units.find((x, i) => (x.id ?? `${enc.id}_${i}`) === a.id);
      const ally = a.role === 'ally';
      const list = ally ? enc.allies ?? [] : enc.units;
      const ua = list.find((x, i) => (x.id ?? (ally ? enc.id + '_ally' + i : enc.id + '_' + i)) === a.id) ?? up;
      const nu = unitFromEnemy(ua?.kind ?? 'ganger', a, ua?.level);
      if (ua?.name) nu.name = ua.name;
      if (ua?.dormant) nu.dormant = true;
      if (ally) { nu.side = 'party'; nu.xp = 0; nu.name = a.name; }
      CB.units.push(nu);
    }
  }
  for (const u of CB.units) u.status.clear();
  const rolls = new Map<Unit, number>();
  for (const u of CB.units) rolls.set(u, u.init + roll(1, 6) + (u.side === 'party' && surprise ? 10 : 0));
  CB.order = [...CB.units].sort((a, b) => rolls.get(b)! - rolls.get(a)!);
  const fm = def.encounters?.find((e) => groups.has(e.id) && e.music)?.music;
  playMusic(fm ?? music);
  combatEvent('start');
  PI.banner = { text: surprise ? 'AMBUSH' : 'COMBAT', t: 1.4, color: surprise ? C.vio3 : C.mag3 };
  PI.showOrder = 1.6;
  sfx('alarm');
  return runLoop();
}

async function runLoop(): Promise<boolean> {
  for (;;) {
    for (let i = 0; i < CB.order.length; i++) {
      const u = CB.order[i];
      if (!alive(u) || u.dead) continue;
      if (CB.surprise && CB.round === 1 && u.side === 'enemy') continue;
      CB.cur = u;
      CB.turn = i;
      CB.stats.turns++;
      focusOn(u);
      const ok = await startTurn(u);
      if (ok && alive(u)) {
        if (u.side === 'party' && u.member && !CB.sim && !CB.autoParty) {
          combatEvent('party_turn');
          await playerTurn(u);
          if (alive(u)) await droneAct(u);
        } else {
          if (u.side === 'enemy') combatEvent('enemy_turn');
          await pause(0.2);
          try {
            await Promise.race([aiTurn(u), CB.sim ? new Promise<void>(() => {}) : wait(12)]);
          } catch (e) { console.error('[combat] AI turn failed', u.name, e); }
        }
      }
      await endTurn(u);
      await settle();
      const over = outcome();
      if (over !== null) return finish(over);
    }
    CB.order = CB.order.filter((u) => !u.dead);
    tickSurfaces();
    riseTide();
    await blowWind();
    CB.round++;
    if (CB.sim && CB.round > 30) return finish(false);
    PI.showOrder = 1;
  }
}

/** Wind on the Wall: each round, units not braced against cover may be pushed a tile, over the edge if it is there. */
async function blowWind() {
  const def = WORLD.def!;
  for (const id of CB.encounters) {
    const w = def.encounters?.find((e) => e.id === id)?.wind;
    if (!w) continue;
    if (!CB.sim) { PI.banner = { text: 'WIND', t: 0.8, color: C.steel4 }; sfx('smoke'); }
    for (const u of CB.units) {
      if (!alive(u) || u.prop || u.ai === 'turret' || u.member?.perks.includes('heavy') || u.boss) continue;
      const braced = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const g = WORLD.coverGrid[(u.y + dy) * WORLD.map!.w + u.x + dx] ?? 0; const c = WORLD.map!.cells[(u.y + dy) * WORLD.map!.w + u.x + dx]; return g >= 1 || (c && c.tile.cover >= 1); });
      if (braced || rnd() > (w.chance ?? 0.35)) continue;
      const { push } = await import('./actions');
      float(u, 'GUST', C.steel4);
      await push(u, w.dx, w.dy, 1, null);
    }
  }
}

function riseTide() {
  const def = WORLD.def!;
  const m = WORLD.map!;
  for (const id of CB.encounters) {
    const t = def.encounters?.find((e) => e.id === id)?.tide;
    if (!t) continue;
    const per = t.perRound ?? 1;
    for (let k = 0; k < per; k++) {
      const row = t.bottom - (CB.round - 1) * per - k;
      if (row < t.top) continue;
      for (let x = 0; x < m.w; x++) {
        const c = m.cells[row * m.w + x];
        if (!c || !c.tile.walk) continue;
        CB.surf.set(row * m.w + x, { kind: 'water', turns: 999 });
        const u = unitAt(x, row);
        if (u) u.status.set('wet', 3);
      }
    }
    if (!CB.sim) { PI.banner = { text: 'THE WATER RISES', t: 1.2, color: C.cyan3 }; sfx('splash'); }
  }
}

async function settle() { if (CB.sim) return; await wait(0.05); while (WORLD.actors.some((a) => a.fade !== undefined && a.fade > 0 && a.fade < 1 && !a.gone)) await wait(0.05); }

function outcome(): boolean | null {
  const foes = CB.units.filter((u) => u.side === 'enemy' && alive(u) && !u.dormant && !has(u, 'turncoat'));
  const turned = CB.units.filter((u) => u.side === 'enemy' && alive(u) && has(u, 'turncoat'));
  const party = CB.units.filter((u) => u.side === 'party' && u.member && alive(u));
  if (!party.length) return false;
  if (!foes.length && !turned.length) return true;
  return null;
}

async function finish(win: boolean): Promise<boolean> {
  CB.cur = null;
  PI.mode = 'move';
  combatEvent(win ? 'victory' : 'defeat');
  if (win) {
    let xp = 0, gilt = 0;
    const got: string[] = [];
    for (const u of CB.units) {
      if (u.side !== 'enemy' || u.prop || (u.dormant && alive(u))) continue;
      xp += u.xp;
      const e = ENEMY.get(u.kind);
      if (e?.gilt) gilt += roll(e.gilt[0], e.gilt[1]);
      for (const [id, n, ch] of e?.loot ?? []) if (rnd() < ch) { G.items[id] = (G.items[id] ?? 0) + n; got.push(ITEM.get(id)?.name ?? id); }
    }
    for (const e of CB.encounters) G.defeated.push(`${WORLD.def!.id}:${e}`);
    PI.banner = { text: 'VICTORY', t: 1.6, color: C.amb3 };
    await pause(0.6);
    if (xp) toast(`+${xp} XP`, C.cyan3);
    if (gilt) { G.gilt += gilt; toast(`+${gilt} gilt`, C.amb3); }
    for (const g of got.slice(0, 3)) toast(g, C.pale);
    const ups = grantXp(xp);
    for (const up of ups) { toast(`${up.id === 'hero' ? G.heroName : G.roster[up.id].name} hit level ${up.level}`, C.amb3); sfx('levelup'); }
    for (const u of CB.units) {
      if (u.member) { u.member.hp = u.downed ? 1 : Math.max(1, u.hp); if (u.actor) u.actor.tint = undefined; }
      if (u.wake) { if (u.prop) u.prop.wake = null; }
    }
    for (const a of WORLD.actors) {
      if (a.role === 'enemy' && a.encounter && CB.encounters.includes(a.encounter)) a.gone = true;
      if (a.role === 'ally' && a.encounter && CB.encounters.includes(a.encounter)) { a.role = 'npc'; a.tint = undefined; a.encounter = undefined; a.fade = undefined; a.gone = false; }
    }
    WORLD.actors = WORLD.actors.filter((a) => !a.gone && a.id !== 'turret');
    for (const p of WORLD.props) if (p.wake && p.wake.by !== 'old' && p.wake.by !== 'line1') p.wake = null;
  }
  CB.active = false;
  F.inCombat = false;
  for (const a of WORLD.actors) { a.px = a.tx * T; a.py = a.ty * T; a.lift = 0; }
  WORLD.camTarget = null;
  return win;
}

function focusOn(u: Unit) {
  if (CB.sim) return;
  WORLD.camTarget = { x: u.x * T + 5, y: u.y * T + 5 };
}

// ---------- the player's turn ----------

function barFor(u: Unit): Bar[] {
  const out: Bar[] = [{ id: 'attack', label: 'Attack', icon: 'attack' }];
  for (const id of u.abilities) {
    const a = ABILITY.get(id);
    if (!a || a.cost === 'reaction' || id === 'longwake') continue;
    out.push({ id, label: a.name, icon: a.icon });
  }
  out.push({ id: 'item', label: 'Item', icon: 'item' });
  out.push({ id: 'shove', label: 'Shove', icon: 'shove' }, { id: 'jump', label: 'Jump', icon: 'jump' }, { id: 'dash', label: 'Dash', icon: 'dash' });
  out.push({ id: 'help', label: 'Help', icon: 'help' }, { id: 'overwatch', label: 'Overwatch', icon: 'watch' }, { id: 'hide', label: 'Hide', icon: 'hide' });
  return out;
}

function refreshReach(u: Unit) {
  PI.reach = reachable(u.x, u.y, u.moveLeft, (x, y) => !freeTile(x, y, u));
}

async function playerTurn(u: Unit): Promise<void> {
  PI.bar = barFor(u);
  PI.mode = 'move';
  PI.ab = null;
  PI.cx = u.x; PI.cy = u.y;
  refreshReach(u);
  WORLD.camTarget = null;
  return new Promise((res) => { PI.resolve = res; });
}

function endPlayerTurn() {
  const r = PI.resolve;
  PI.resolve = null;
  PI.mode = 'move';
  r?.();
}

function usableItems(): string[] {
  return Object.keys(G.items).filter((id) => {
    const it = ITEM.get(id);
    return it && G.items[id] > 0 && (it.kind === 'stim' || it.kind === 'grenade' || it.kind === 'vial');
  });
}

function itemAbility(id: string): AbilityDef {
  const it = ITEM.get(id)!;
  if (it.kind === 'stim') return { id: 'useitem', name: it.name, cls: 'any', cost: 'bonus', range: 1, target: 'ally', icon: 'patch', desc: it.desc };
  if (it.kind === 'grenade') return { id: 'useitem', name: it.name, cls: 'any', cost: 'action', range: 6, target: 'tile', area: it.area ?? 1, icon: 'boom', desc: it.desc };
  if (it.feeling === 'hush') return { id: 'useitem', name: it.name, cls: 'any', cost: 'action', range: 4, target: 'unit', icon: 'hush', desc: it.desc };
  return { id: 'useitem', name: it.name, cls: 'any', cost: 'action', range: 4, target: 'prop', icon: 'wake', desc: it.desc };
}

function itemTargetOk(u: Unit, id: string, x: number, y: number): boolean {
  const it = ITEM.get(id)!;
  const a = itemAbility(id);
  const d = dist(u, { x, y });
  if (d > a.range) return false;
  if (it.kind === 'stim') { const t = unitAt(x, y); return !!t && alive(t) && !hostile(u, t); }
  if (it.kind === 'grenade') return los(u, { x, y });
  if (it.feeling === 'hush') { const t = unitAt(x, y); return !!t && !!t.wake; }
  const p = propAt(x, y);
  return !!p && !p.broken && !p.wake && !!p.def.wake;
}

async function useItem(u: Unit, id: string, x: number, y: number) {
  const it = ITEM.get(id)!;
  G.items[id]--;
  if (G.items[id] <= 0) delete G.items[id];
  const { heal, explode, wakeProp, hush, setSurface } = await import('./actions');
  if (it.kind === 'stim') { u.bonus = false; const t = unitAt(x, y)!; heal(t, roll(it.heal![0], it.heal![1])); return; }
  if (u.action) u.action = false; else u.extraActions--;
  CB.stats.actions++;
  if (it.kind === 'grenade') {
    if (it.id === 'smokegren') { sfx('smoke'); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) setSurface(x + dx, y + dy, 'smoke', 2); return; }
    await explode(x, y, it.area ?? 1, it.dmg ?? [4, 6], it.dtype ?? 'kinetic', u, it.status);
    return;
  }
  if (it.feeling === 'hush') { const t = unitAt(x, y); if (t) await hush(t, u); return; }
  const p = propAt(x, y);
  if (p && it.feeling) await wakeProp(p, u, it.feeling as never, 3);
}

function cursorMove(dx: number, dy: number) {
  const m = WORLD.map!;
  PI.cx = Math.max(0, Math.min(m.w - 1, PI.cx + dx));
  PI.cy = Math.max(0, Math.min(m.h - 1, PI.cy + dy));
  sfx('cursor', { vol: 0.4 });
}

function selectBar(i: number) {
  const b = PI.bar[i];
  const u = CB.cur!;
  if (!b) return;
  if (b.id === 'item') {
    if (!u.action && u.extraActions <= 0 && !u.bonus) { sfx('error'); return; }
    PI.mode = 'items'; PI.itemSel = 0; sfx('menu'); return;
  }
  if (!canUse(u, b.id)) { sfx('error'); return; }
  const a = ABILITY.get(b.id)!;
  if (a.target === 'self' && b.id !== 'cleave' && !a.area) { void act(() => useAbility(u, b.id, u.x, u.y)); return; }
  PI.mode = 'target';
  PI.ab = b.id;
  PI.tipT = 2.5;
  sfx('confirm');
}

async function act(f: () => Promise<void>) {
  PI.acting = true;
  PI.mode = 'move';
  PI.ab = null;
  PI.item = null;
  await f();
  await settle();
  PI.acting = false;
  const u = CB.cur;
  if (!u) return;
  if (!alive(u) || outcome() !== null) { endPlayerTurn(); return; }
  refreshReach(u);
}

export function updateCombat(dt: number) {
  runFrameQueue();
  for (const f of CB.floats) { f.t -= dt; f.y -= dt * 14; }
  CB.floats = CB.floats.filter((f) => f.t > 0);
  for (const s of CB.sparks) { s.t -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 40 * dt; }
  CB.sparks = CB.sparks.filter((s) => s.t > 0);
  for (const t of CB.tracers) t.t -= dt;
  CB.tracers = CB.tracers.filter((t) => t.t > 0);
  for (const f of CB.flashes) f.t -= dt;
  CB.flashes = CB.flashes.filter((f) => f.t > 0);
  if (PI.banner.t > 0) PI.banner.t -= dt;
  if (PI.showOrder > 0) PI.showOrder -= dt;
  if (PI.tipT > 0) PI.tipT -= dt;
  if (WORLD.shake > 0) WORLD.shake -= dt;
  const u = CB.cur;
  if (!u || !PI.resolve || PI.acting) return;
  if (isDown('tab')) PI.showOrder = Math.max(PI.showOrder, 0.1);
  if (pressed('end')) { sfx('turn'); endPlayerTurn(); return; }
  const keys: Button[] = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n0'];
  if (PI.mode === 'items') { updateItems(u); return; }
  keys.forEach((k, i) => { if (pressed(k)) selectBar(i); });
  if (repeat('left')) cursorMove(-1, 0);
  if (repeat('right')) cursorMove(1, 0);
  if (repeat('up')) cursorMove(0, -1);
  if (repeat('down')) cursorMove(0, 1);
  PI.hoverBar = -1;
  if (mouseActive()) {
    if (MOUSE.y >= H - 13 && MOUSE.y < H - 2) {
      const i = Math.floor((MOUSE.x - 3) / 11);
      if (i >= 0 && i < PI.bar.length) PI.hoverBar = i;
      if (MOUSE.left && PI.hoverBar >= 0) { consume(); selectBar(PI.hoverBar); return; }
      if (MOUSE.left && MOUSE.x >= W - 22) { consume(); sfx('turn'); endPlayerTurn(); return; }
    } else if (MOUSE.moved || MOUSE.left) {
      PI.cx = Math.floor((MOUSE.x + WORLD.cam.x) / T);
      PI.cy = Math.floor((MOUSE.y + WORLD.cam.y) / T);
    }
  }
  const go = pressed('a') || (MOUSE.left && mouseActive() && MOUSE.y < H - 26);
  if (pressed('b')) {
    consume();
    if (PI.mode === 'target') { PI.mode = 'move'; PI.ab = null; PI.item = null; sfx('cancel'); }
    else { PI.cx = u.x; PI.cy = u.y; }
    return;
  }
  // Keep the camera near the cursor while using the keyboard.
  if (!mouseActive()) {
    const sx = PI.cx * T - WORLD.cam.x, sy = PI.cy * T - WORLD.cam.y;
    if (sx < 20 || sx > W - 30 || sy < 20 || sy > H - 50) WORLD.camTarget = { x: PI.cx * T + 5, y: PI.cy * T + 5 };
  }
  // Path preview.
  const k = idx(PI.cx, PI.cy);
  PI.path = PI.mode === 'move' && PI.reach.has(k) && (PI.cx !== u.x || PI.cy !== u.y) ? findPath(u.x, u.y, PI.cx, PI.cy, { blocked: (x, y) => !freeTile(x, y, u) }) : null;
  if (!go) return;
  consume();
  if (PI.mode === 'target') {
    if (PI.item) {
      if (itemTargetOk(u, PI.item, PI.cx, PI.cy)) { const id = PI.item; void act(() => useItem(u, id, PI.cx, PI.cy)); }
      else sfx('error');
      return;
    }
    const a = ABILITY.get(PI.ab!)!;
    if (validTarget(u, a, PI.cx, PI.cy)) { const id = PI.ab!, x = PI.cx, y = PI.cy; void act(() => useAbility(u, id, x, y)); }
    else sfx('error');
    return;
  }
  // Move mode: attack a foe, or walk to a tile.
  const t = unitAt(PI.cx, PI.cy);
  if (t && alive(t) && hostile(u, t)) {
    if (!u.action && u.extraActions <= 0) { sfx('error'); return; }
    const a = ABILITY.get('attack')!;
    if (validTarget(u, a, t.x, t.y)) { void act(() => useAbility(u, 'attack', t.x, t.y)); return; }
    const w = u.melee;
    if (isMelee(w)) {
      const p = findPath(u.x, u.y, t.x, t.y, { adjacent: true, blocked: (x, y) => !freeTile(x, y, u) });
      if (p && p.length <= u.moveLeft) { void act(async () => { await moveAlong(u, p); if (alive(u) && alive(t) && dist(u, t) === 1) await useAbility(u, 'attack', t.x, t.y); }); return; }
    }
    sfx('error');
    return;
  }
  if (PI.path && PI.path.length) { const p = PI.path; void act(() => moveAlong(u, p)); return; }
  const prop = propAt(PI.cx, PI.cy);
  if (prop && validTarget(u, ABILITY.get('attack')!, PI.cx, PI.cy)) { void act(() => useAbility(u, 'attack', PI.cx, PI.cy)); return; }
}

function updateItems(u: Unit) {
  const list = usableItems();
  if (!list.length) { PI.mode = 'move'; toast('No usable items', C.gray); return; }
  if (repeat('up')) PI.itemSel = (PI.itemSel + list.length - 1) % list.length;
  if (repeat('down')) PI.itemSel = (PI.itemSel + 1) % list.length;
  const top = H - 30 - list.length * 9;
  if (mouseActive() && MOUSE.moved) { const i = Math.floor((MOUSE.y - top) / 9); if (i >= 0 && i < list.length) PI.itemSel = i; }
  if (pressed('b')) { consume(); PI.mode = 'move'; sfx('cancel'); return; }
  if (pressed('a') || (MOUSE.left && MOUSE.y >= top && MOUSE.y < top + list.length * 9)) {
    consume();
    const id = list[PI.itemSel];
    const a = itemAbility(id);
    if ((a.cost === 'bonus' && !u.bonus) || (a.cost === 'action' && !u.action && u.extraActions <= 0)) { sfx('error'); return; }
    PI.item = id;
    PI.mode = 'target';
    PI.ab = null;
    sfx('confirm');
  }
}

// ---------- drawing ----------

/** Extra light from muzzle flashes and explosions, added during the world render. */
export function combatLights() {
  for (const f of CB.flashes) {
    const k = f.t / f.life;
    addLight(f.x - WORLD.cam.x, f.y - WORLD.cam.y, f.r, f.i * k, f.color, { z: 20 });
  }
  for (const s of CB.sparks) if (s.glow && s.color === C.red2) addLight(s.x - WORLD.cam.x, s.y - WORLD.cam.y, 8, 0.4, LIGHT.red, { z: 6 });
}

function tileTint(x: number, y: number, t: number, color: number) {
  shadeRect(x * T - WORLD.cam.x, y * T - WORLD.cam.y, T, T, t, color);
}

function drawFx() {
  const cx = WORLD.cam.x, cy = WORLD.cam.y;
  for (const t of CB.tracers) {
    const n = Math.max(Math.abs(t.x1 - t.x0), Math.abs(t.y1 - t.y0));
    for (let i = 0; i <= n; i += 2) upx(Math.round(t.x0 + (t.x1 - t.x0) * i / n - cx), Math.round(t.y0 + (t.y1 - t.y0) * i / n - cy), t.color);
  }
  for (const s of CB.sparks) upx(Math.round(s.x - cx), Math.round(s.y - cy), s.color);
  LAYOUT.float = true;
  for (const f of CB.floats) {
    const w = textWidth(f.text);
    const x = Math.round(f.x - cx - w / 2), y = Math.round(f.y - cy - 8);
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawText(f.text, x + ox, y + oy, C.black);
    drawText(f.text, x, y, f.color);
  }
  LAYOUT.float = false;
}

export function renderCombat() {
  if (!CB.active) { drawFx(); return; }
  const cx = WORLD.cam.x, cy = WORLD.cam.y;
  const u = CB.cur;
  const myTurn = !!(u && PI.resolve && !PI.acting);
  // Surfaces.
  const m = WORLD.map!;
  for (const [k, s] of CB.surf) {
    const x = k % m.w, y = Math.floor(k / m.w);
    const col = s.kind === 'fire' ? C.amb3 : s.kind === 'shock' ? C.cyan3 : s.kind === 'smoke' ? C.gray : s.kind === 'oil' ? C.mud0 : s.kind === 'foam' ? C.pale : s.kind === 'water' ? C.cyan1 : C.red1;
    tileTint(x, y, s.kind === 'smoke' ? 0.55 : 0.4, col);
  }
  if (myTurn && u) {
    if (PI.mode === 'move') for (const k of PI.reach.keys()) { const x = k % m.w, y = Math.floor(k / m.w); if (x !== u.x || y !== u.y) tileTint(x, y, 0.22, C.cyan1); }
    if (PI.mode === 'target') {
      const a = PI.item ? itemAbility(PI.item) : ABILITY.get(PI.ab!)!;
      const ok = (x: number, y: number) => (PI.item ? itemTargetOk(u, PI.item, x, y) : validTarget(u, a, x, y));
      const r = a.id === 'attack' ? 12 : a.range + 1;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = u.x + dx, y = u.y + dy; if (ok(x, y)) tileTint(x, y, 0.3, C.mag1); }
      if (ok(PI.cx, PI.cy) && (a.area || a.id === 'blur')) for (const [x, y] of areaOf(u, a, PI.cx, PI.cy)) tileTint(x, y, 0.4, C.amb2);
    }
    if (PI.path) for (const [x, y] of PI.path) { const px = x * T + 4 - cx, py = y * T + 4 - cy; rect(px, py, 2, 2, C.pale); }
    // Cursor.
    dotFrame(PI.cx * T - cx, PI.cy * T - cy, T, T, C.white, Math.floor(performance.now() / 250) % 2);
  }
  // Units: markers and thin health bars.
  for (const v of CB.units) {
    if (v.dead && !v.downed) continue;
    const px = (v.actor ? Math.round(v.actor.px) : v.x * T) - cx, py = (v.actor ? Math.round(v.actor.py) : v.y * T) - cy - (v.actor?.lift ?? 0);
    if (!alive(v) && !v.downed) continue;
    const col: number = v.side === 'party' ? (v.prop ? C.cyan3 : C.grn3) : v.side === 'wild' ? C.mag3 : C.red2;
    const w = Math.max(0, Math.round(8 * v.hp / v.maxHp));
    rect(px + 1, py - 3, 8, 1, C.black);
    rect(px + 1, py - 3, w, 1, v.wake ? C.red3 : col);
    if (v === u) { rect(px + 3, py - 7, 4, 1, C.amb3); rect(px + 4, py - 6, 2, 1, C.amb3); }
    if (has(v, 'overwatch')) upx(px + 9, py - 3, C.amb3);
  }
  drawFx();
  // Hit chance at the cursor.
  if (myTurn && u) renderTargetInfo(u);
  if (PI.showOrder > 0 || isDown('tab')) renderOrder();
  if (PI.banner.t > 0) {
    const w = textWidth(PI.banner.text) + 10;
    box((W - w) / 2, 20, w, 13, C.ink, PI.banner.color);
    drawText(PI.banner.text, (W - w) / 2 + 5, 23, PI.banner.color);
  }
  if (u && myTurn) renderBar(u);
  else if (u && u.side !== 'party' && !u.prop) {
    const t = u.name;
    const w = textWidth(t) + 8;
    box((W - w) / 2, H - 16, w, 12, C.ink, C.red1);
    drawText(t, (W - w) / 2 + 4, H - 14, C.pale);
  }
  if (PI.mode === 'items' && u) renderItems();
}

function renderTargetInfo(u: Unit) {
  const t = unitAt(PI.cx, PI.cy);
  const sx = PI.cx * T - WORLD.cam.x, sy = PI.cy * T - WORLD.cam.y;
  let text = '';
  let color: number = C.white;
  if (PI.mode === 'move' && t && alive(t) && hostile(u, t)) {
    const w = weaponFor(u, t);
    const reachable = isMelee(w) ? dist(u, t) <= (w?.reach ?? 1) : los(u, t);
    if (reachable || isMelee(u.melee)) text = `${hitInfo(u, t, reachable ? w : u.melee).chance}%`;
    if (!reachable && !isMelee(w)) { text = 'NO LINE'; color = C.gray; }
  } else if (PI.mode === 'target' && PI.ab && t) {
    const a = ABILITY.get(PI.ab)!;
    if (validTarget(u, a, PI.cx, PI.cy)) {
      if (a.hit === 'attack' || a.id === 'attack') text = `${hitInfo(u, t, weaponFor(u, t), a).chance}%`;
      else if (a.id === 'shove') text = `${shoveChance(u, t)}%`;
      else if (a.hit === 'auto') text = 'SURE';
    }
  } else if (PI.mode === 'move' && !t && PI.reach.has(idx(PI.cx, PI.cy))) {
    const foes = foesOf(u).filter((f) => !f.prop);
    let best = 0;
    for (const f of foes) if (los(f, { x: PI.cx, y: PI.cy })) best = Math.max(best, coverOf(f, { x: PI.cx, y: PI.cy }));
    if (foes.length) { text = best === 2 ? 'FULL COVER' : best === 1 ? 'HALF COVER' : ''; color = best === 2 ? C.grn3 : C.amb3; }
  }
  if (t && alive(t) && t !== u && PI.tipT <= 0 && PI.hoverBar < 0) {
    let line = t.name;
    if (t.wake) line = `${t.name}: ${t.wake.feeling}`;
    const st = [...t.status.keys()].map((s) => STATUSES[s]?.name ?? s).slice(0, 2).join(', ');
    const w = Math.min(W - 8, textWidth(line) + 6);
    box(4, 4, w, 12, C.ink, C.slate);
    drawText(line, 7, 6, C.pale, w - 6);
    drawText(`${t.hp}/${t.maxHp}`, 7, 18, C.pale);
    if (st) drawText(st, 7 + textWidth(`${t.hp}/${t.maxHp}`) + 5, 18, C.vio3);
  }
  if (text) {
    const w = textWidth(text) + 4;
    const bx = Math.max(1, Math.min(W - w - 1, sx + 5 - w / 2)), by = Math.max(1, Math.min(H - 11, sy - 12));
    rect(bx, by, w, 10, C.black);
    drawText(text, bx + 2, by + 1, color);
  }
}

function renderOrder() {
  const list = CB.order.filter((u) => alive(u) || u.downed).slice(0, 14);
  const n = list.length;
  let x = Math.round((W - n * 11) / 2);
  rect(x - 2, 1, n * 11 + 3, 13, C.black);
  for (const v of list) {
    const im = v.actor?.sheet.frames.down[0];
    if (im) blitUI(im, x, 2, false, v.downed ? C.slate : undefined);
    else if (v.prop) blitUI(v.prop.def.art, x, 2);
    rect(x, 12, 10, 1, v.side === 'party' ? C.grn2 : v.side === 'wild' ? C.mag2 : C.red2);
    if (v === CB.cur) hline(x, 13, 10, C.amb3);
    x += 11;
  }
}

function renderBar(u: Unit) {
  const top = H - 26;
  rect(0, top - 1, W, 27, C.black);
  rect(0, top, W, 26, C.ink);
  hline(0, top, W, C.slate);
  const sh = u.actor?.sheet.frames.down[0];
  if (sh) blitUI(sh, 3, top + 2);
  drawText(u.name, 15, top + 2, C.white);
  let x = 15 + textWidth(u.name) + 4;
  const hpw = 30;
  rect(x, top + 5, hpw, 3, C.night);
  rect(x, top + 5, Math.round(hpw * u.hp / u.maxHp), 3, u.hp < u.maxHp * 0.3 ? C.mag3 : C.grn3);
  x += hpw + 3;
  drawText(`${u.hp}`, x, top + 2, C.pale);
  x += textWidth(`${u.hp}`) + 5;
  // Action, bonus, movement.
  rect(x, top + 3, 5, 5, u.action || u.extraActions > 0 ? C.grn3 : C.night);
  rect(x + 7, top + 3, 5, 5, u.bonus ? C.amb3 : C.night);
  rect(x + 14, top + 3, 5, 5, u.reaction ? C.vio3 : C.night);
  x += 22;
  drawText(`M${u.moveLeft}`, x, top + 2, u.moveLeft ? C.cyan3 : C.slate);
  x += textWidth(`M${u.moveLeft}`) + 4;
  if (u.ramMax) { drawText(`RAM ${u.ram}`, x, top + 2, C.grn3); x += textWidth(`RAM ${u.ram}`) + 4; }
  if (u.member?.cls === 'witch' && u.mood) { drawText(u.mood, x, top + 2, MOOD_COLOR[u.mood]); x += textWidth(u.mood) + 4; }
  if (u.droneMax) drawText(`D${u.droneHp}`, x, top + 2, u.droneHp ? C.mag3 : C.slate);
  // Ability icons.
  PI.bar.forEach((b, i) => {
    const bx = 3 + i * 11, by = H - 12;
    let ok: boolean;
    if (b.id === 'item') ok = (u.action || u.extraActions > 0 || u.bonus) && usableItems().length > 0;
    else ok = canUse(u, b.id);
    blitUI(abilityIcon(b.icon, !ok), bx, by);
    const sel = (PI.mode === 'target' && PI.ab === b.id) || (PI.mode === 'items' && b.id === 'item');
    if (sel || PI.hoverBar === i) { rect(bx, by - 2, 10, 1, sel ? C.amb3 : C.pale); }
  });
  // End turn.
  box(W - 21, H - 13, 18, 11, C.night, C.slate);
  drawText('E', W - 15, H - 11, C.pale);
  // Description line.
  const hb = PI.hoverBar >= 0 ? PI.bar[PI.hoverBar] : PI.mode === 'target' && PI.ab && PI.tipT > 0 ? PI.bar.find((b) => b.id === PI.ab) : null;
  if (hb) {
    const a = ABILITY.get(hb.id);
    let line = hb.label;
    if (a) {
      const parts: string[] = [];
      if (a.cost === 'bonus') parts.push('bonus');
      if (a.ram) parts.push(`${ramCost(u, a)} RAM`);
      if (a.blood) parts.push(`${bloodCost(u, a)} HP`);
      if (a.uses) parts.push(`${a.uses.n}/${a.uses.per === 'fight' ? 'fight' : a.uses.per + ' rest'}`);
      if (parts.length) line += ` (${parts.join(', ')})`;
    }
    const desc = a?.desc ?? 'Use a stim, grenade, or vial.';
    renderTip(line, desc);
  } else if (PI.mode === 'target' && PI.item && PI.tipT > 0) {
    const it = ITEM.get(PI.item)!;
    renderTip(it.name, it.desc);
  }
}

function renderTip(title: string, desc: string) {
  const lines = wrapText(desc, W - 14);
  const h = 12 + lines.length * 9;
  const y = 3;
  box(4, y, W - 8, h, C.ink, C.slate);
  drawText(title, 7, y + 2, C.amb3, W - 14);
  lines.forEach((l, i) => drawText(l, 7, y + 11 + i * 9, C.pale));
}

import { wrap as wrapText } from '../engine/font';

function renderItems() {
  const list = usableItems();
  const top = H - 30 - list.length * 9;
  const w = 120;
  box(4, top - 3, w, list.length * 9 + 5, C.ink, C.slate);
  list.forEach((id, i) => {
    const it = ITEM.get(id)!;
    const y = top + i * 9;
    if (i === PI.itemSel) rect(5, y - 1, w - 2, 9, C.vio0);
    drawText(`${it.name} x${G.items[id]}`, 8, y, i === PI.itemSel ? C.white : C.pale, w - 8);
  });
}

export { DIRS, PI };
