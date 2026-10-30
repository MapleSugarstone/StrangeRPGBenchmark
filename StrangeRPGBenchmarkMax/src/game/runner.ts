// Runs scene scripts: dialogue, stage commands, choices, and battles.
import { SCENES, type Cmd } from './script';
import { say, closeBox, choose, showLetter, chapterCard, typeLine } from './dialogue';
import { sleep, until } from './sched';
import {
  F, actorById, enterMap, spawnPeople, refreshProps, walkPath, startMove, dirVec, vecDir, panCamera, releaseCamera, setLamp, TILE,
  removeEncounter, type Actor, resetArrival, snapCamera,
} from './field';
import { G, flag, setFlag, save, type Dir } from './state';
import { GAME } from './game';
import { FX, fadeTo, shake } from './fx';
import { playMusic, sfx, setChapter } from '../audio';
import { charImgs } from './art';
import { MEMBERS, statsAt, xpFor, MAX_LEVEL, skillsAt } from '../content/party';
import { ITEMS } from '../content/items';
import { GROUPS } from '../content/foes';
import { buildBattle, type ArenaSpec, type PartyEntry } from '../battle/setup';
import { BattleScreen } from '../battle/ui';
import { MAPS } from './map';
import { openShop, openPost, openSticks, openCredits } from './menus';

class Abort extends Error {}

/** Scenes that change the map or the party run one at a time. */
let running = 0;

export function sceneRunning(): boolean { return running > 0; }

/** Strays and their owners: `stray_N` props and `owner_N:fallback` talk scenes. */
function resolveScene(id: string): string | null {
  const own = id.match(/^owner_(\d+):(.+)$/);
  if (own) {
    const n = own[1];
    if (flag(`stray${n}_carried`) && !flag(`stray${n}_returned`)) {
      setFlag(`stray${n}_returned`);
      G.strays.returned.push(Number(n));
      G.strays.carried = G.strays.carried.filter((s) => s !== Number(n));
      G.mites += 15;
      G.items.tonic = (G.items.tonic ?? 0) + 1;
      return `stray_return_${n}`;
    }
    return own[2];
  }
  const st = id.match(/^stray_(\d+)$/);
  if (st && !SCENES.has(id)) {
    const n = st[1];
    // Lot carries strays, and so does Tik once Lot is Tik's lead again.
    if (!G.party.includes('lot') && !(flag('lot_rejoined') && G.party.includes('tik'))) return 'stray_nolot';
    setFlag(`stray${n}_carried`);
    G.strays.carried.push(Number(n));
    return `stray_find_${n}`;
  }
  return id;
}

export async function runScene(id0: string): Promise<void> {
  const id = resolveScene(id0);
  if (!id) return;
  const sc = SCENES.get(id);
  if (!sc) { console.warn('No scene', id); return; }
  running++;
  F.frozen = true;
  try {
    await exec(id, 0);
    if (/^stray_return_/.test(id)) { sfx('item_get'); await say(null, 'Got 15 mites and a tonic.'); closeBox(); }
  } catch (e) {
    if (!(e instanceof Abort)) console.error(e);
  } finally {
    running--;
    if (running === 0) {
      closeBox();
      F.frozen = false;
      releaseCamera();
      spawnPeople();
      refreshProps();
    }
  }
}

/** Whether the next command that shows anything is another line, so the box can stay up. */
function nextIsText(cmds: Cmd[], i: number): boolean {
  for (let j = i; j < cmds.length; j++) {
    const c = cmds[j];
    if (c.t === 'say' || c.t === 'sys' || c.t === 'choice') return true;
    if (c.t === 'label' || c.t === 'raw') continue;
    if (c.t === 'cmd' && ['set', 'unset', 'sfx', 'music', 'emote', 'face', 'give', 'take', 'mites', 'join', 'leave', 'lock', 'unlock'].includes(c.name)) continue;
    return false;
  }
  return false;
}

async function exec(id: string, start: number): Promise<void> {
  const sc = SCENES.get(id);
  if (!sc) return;
  let i = start;
  while (i < sc.cmds.length) {
    const c = sc.cmds[i];
    i++;
    if (c.t === 'say' || c.t === 'sys') {
      await say(c.t === 'say' ? c.speaker : null, c.text);
      if (!nextIsText(sc.cmds, i)) closeBox();
      continue;
    }
    if (c.t === 'choice') {
      const pick = await choose(c.prompt, c.options.map((o) => o.text));
      const opt = c.options[pick];
      closeBox();
      if (!/^\(.*\)$/.test(opt.text)) await say('Nodus', opt.text);
      if (!nextIsText(sc.cmds, i)) closeBox();
      if (opt.label) {
        const at = sc.labels.get(opt.label);
        if (at !== undefined) i = at + 1;
      }
      continue;
    }
    if (c.t !== 'cmd') continue;
    const r = await command(c.name, c.args, c.async, sc.labels);
    if (r === 'end') return;
    if (typeof r === 'number') i = r;
    else if (typeof r === 'string' && r.startsWith('scene:')) { await exec(r.slice(6), 0); return; }
  }
}

function marker(arg: string): [number, number] | null {
  if (!arg) return null;
  if (arg.startsWith('@')) {
    const m = F.map?.markers.get(arg.slice(1));
    if (!m) { console.warn('No marker', arg, 'on', G.map); return F.player ? [F.player.x, F.player.y] : null; }
    return m;
  }
  return null;
}

function where(args: string[], from = 1): [number, number] | null {
  const m = marker(args[from]);
  if (m) return m;
  const x = Number(args[from]), y = Number(args[from + 1]);
  if (Number.isFinite(x) && Number.isFinite(y)) return [x, y];
  return null;
}

function npcArtFor(id: string): Actor['imgs'] {
  const def = F.map?.def.npcs?.find((n) => n.id === id);
  if (def) return def.pal ? charImgs(def.art, def.pal) : charImgs(def.art);
  return charImgs(id);
}

async function walkActor(a: Actor, tx: number, ty: number) {
  if (a.x === tx && a.y === ty && !a.moving) return;
  const prevSolid = a.solid;
  a.solid = false;
  walkPath(a, tx, ty);
  await until(() => !a.moving && a.path.length === 0);
  a.solid = prevSolid;
}

async function command(name: string, args: string[], async: boolean, labels: Map<string, number>): Promise<void | 'end' | number | string> {
  switch (name) {
    case 'end': return 'end';
    case 'lock': case 'unlock': return;
    case 'walk': {
      const a = actorById(args[0]);
      const to = where(args);
      if (!a || !to) return;
      const p = walkActor(a, to[0], to[1]);
      if (!async) await p;
      return;
    }
    case 'step': {
      const a = actorById(args[0]);
      if (!a) return;
      const n = Number(args[2] ?? 1);
      for (let k = 0; k < n; k++) { startMove(a, args[1] as Dir, true); await until(() => !a.moving); }
      return;
    }
    case 'face': {
      const a = actorById(args[0]);
      if (!a) return;
      const t = args[1];
      if (['up', 'down', 'left', 'right'].includes(t)) a.dir = t as Dir;
      else if (t === 'away' && F.player) a.dir = vecDir(a.x - F.player.x, a.y - F.player.y);
      else {
        const o = actorById(t);
        const m = o ? null : F.map?.markers.get(t) ?? null;
        if (o) a.dir = vecDir(o.x - a.x, o.y - a.y);
        else if (m) a.dir = vecDir(m[0] - a.x, m[1] - a.y);
      }
      return;
    }
    case 'enter': {
      const id = args[0];
      const at = where(args) ?? [F.player?.x ?? 0, F.player?.y ?? 0];
      let a = actorById(id);
      if (!a) {
        a = { ...actorTemplate(id, at[0], at[1]) };
        F.actors.push(a);
      } else { a.x = at[0]; a.y = at[1]; a.px = at[0] * TILE; a.py = at[1] * TILE; a.lx = a.px; a.ly = a.py; a.visible = true; }
      return;
    }
    case 'exit': {
      const a = actorById(args[0]);
      if (a && a !== F.player) F.actors.splice(F.actors.indexOf(a), 1);
      return;
    }
    case 'emote': {
      const a = actorById(args[0]);
      if (a) { a.emote = { kind: args[1], t: 1.1 }; sfx('emote'); }
      if (!async) await sleep(0.5);
      return;
    }
    case 'camera': {
      if (args[0] === 'free') { releaseCamera(); return; }
      const dur = Number(args[1] ?? 1);
      let tx = 0, ty = 0;
      const m = marker(args[0]);
      if (m) { tx = m[0] * TILE + 4; ty = m[1] * TILE + 4; }
      else { const a = actorById(args[0]); if (!a) return; tx = a.px + 4; ty = a.py + 4; }
      panCamera(tx, ty, dur);
      if (!async) await sleep(dur);
      return;
    }
    case 'wait': await sleep(Number(args[0] ?? 0.5)); return;
    case 'music': playMusic(args[0]); return;
    case 'sfx': sfx(args[0]); return;
    case 'shake': shake(Number(args[0] ?? 1)); return;
    case 'fade': await fadeTo(args[0] === 'out' ? 1 : 0, 0.5); return;
    case 'lamp': {
      if (args[0] === 'off') { setLamp(null); return; }
      const m = marker(args[0]);
      if (m) setLamp(m[0], m[1]);
      else { const a = actorById(args[0]); if (a) setLamp(a.x, a.y); }
      return;
    }
    case 'turn': {
      const target = args[0];
      const v = dirVec(args[1] as Dir);
      const a = actorById(target);
      if (a) { a.leadDir = [v[0], v[1]]; await sleep(0.3); return; }
      if (target === 'gate_bar') { await sleep(0.3); return; }
      return;
    }
    case 'set': setFlag(args[0]); if (args[0].startsWith('ch') && /^ch(\d)_started$/.test(args[0])) G.chapter = Number(args[0][2]); return;
    case 'unset': setFlag(args[0], false); return;
    case 'if': case 'ifnot': {
      const want = name === 'if';
      if (flag(args[0]) === want) { const at = labels.get(args[2]); if (at !== undefined) return at + 1; return 'scene:' + args[2]; }
      return;
    }
    case 'goto': { const at = labels.get(args[0]); if (at !== undefined) return at + 1; return 'scene:' + args[0]; }
    case 'give': {
      const id = args[0], n = Number(args[1] ?? 1);
      G.items[id] = (G.items[id] ?? 0) + n;
      sfx('item_get');
      const it = ITEMS[id];
      if (it && it.kind !== 'key') await say(null, n > 1 ? `Got ${n} ${it.name.toLowerCase()}s.` : `Got ${it.name.toLowerCase()}.`);
      else if (it) await say(null, `Got ${it.name}.`);
      closeBox();
      return;
    }
    case 'take': { const id = args[0]; G.items[id] = Math.max(0, (G.items[id] ?? 0) - Number(args[1] ?? 1)); if (!G.items[id]) delete G.items[id]; return; }
    case 'mites': G.mites = Math.max(0, G.mites + Number(args[0])); return;
    case 'join': join(args[0]); return;
    case 'leave': leave(args[0]); return;
    case 'heal': healParty(); sfx('heal'); return;
    case 'battle': {
      const r = await startBattle(args[0], bossSpot(args[0]));
      if (r === 'lose') throw new Abort();
      return;
    }
    case 'warp': {
      const to = args[0], at = args[1]?.replace('@', '') ?? 'start';
      if (FX.fade < 1) await fadeTo(1, 0.4);
      enterMap(to, at);
      const def = MAPS.get(to);
      if (def) playMusic(def.music);
      await fadeTo(0, 0.4);
      return;
    }
    case 'chapter': {
      const n = Number(args[0]);
      G.chapter = n;
      setChapter(n);
      await chapterCard(n, args.slice(1).join(' '));
      return;
    }
    case 'letter': await showLetter('letter_' + args[0], true); return;
    case 'letter_drawing': await showLetter('letter_5', true); return;
    case 'shop': await openShop(args[0]); return;
    case 'sticks': await openSticks(args[0]); return;
    case 'post': await openPost(); return;
    case 'anim': F.anims.set(args[0], { t: 0 }); setFlag('anim_' + args[0]); refreshProps(); await sleep(0.4); return;
    case 'type_entry': { G.entryText = await typeLine('The big shadow. Owner:', 40); return; }
    case 'credits': await openCredits(); return;
    case 'title': setFlag('game_cleared'); save(); GAME.toTitle?.(); return 'end';
    default: console.warn('Unknown command', name, args);
  }
}

function actorTemplate(id: string, x: number, y: number): Actor {
  const imgs = npcArtFor(id);
  return {
    id, imgs, mon: null, x, y, px: x * TILE, py: y * TILE, lx: x * TILE, ly: y * TILE, dir: 'down', moving: false, fromX: x, fromY: y,
    t: 0, speed: 4, step: 0, animT: 0, solid: true, visible: true, path: [], emote: null, leadDir: null, fade: 0, height: 8, bob: 0,
  };
}

// ---- Party ----

export function join(id: string) {
  if (!G.party.includes(id)) G.party.push(id);
  if (!G.members[id]) {
    const lvl = Math.max(1, Math.round(avgLevel()));
    G.members[id] = { id, level: lvl, xp: xpFor(lvl), hp: 999, gear: null };
  }
  const m = G.members[id];
  m.hp = statsAt(id, m.level).maxHp;
  sfx('join');
  if (!F.map || !F.player) return;
  const here = F.actors.find((a) => a.id === id);
  if (here) {
    // Someone already standing on the map falls in line from where they are, instead of vanishing with their map entry.
    here.npc = undefined; here.talk = undefined; here.wander = undefined; here.enc = undefined;
    here.solid = false;
    here.flat = id === 'lot';
    here.imgs = charImgs(id === 'minim' && flag('ch4_freed') ? 'minim_cracked' : id);
    F.trail.push([here.x, here.y]);
    return;
  }
  const p = F.player;
  const a = actorTemplate(id, p.x, p.y);
  a.imgs = charImgs(id === 'minim' && flag('ch4_freed') ? 'minim_cracked' : id);
  a.solid = false;
  a.flat = id === 'lot';
  F.actors.push(a);
  F.trail.push([p.x, p.y]);
}

export function leave(id: string) {
  G.party = G.party.filter((m) => m !== id);
  const a = F.actors.find((x) => x.id === id);
  if (a) F.actors.splice(F.actors.indexOf(a), 1);
}

function avgLevel(): number {
  const ls = G.party.map((p) => G.members[p]?.level ?? 1);
  return ls.reduce((a, b) => a + b, 0) / Math.max(1, ls.length);
}

export function healParty() {
  for (const id of G.party) { const m = G.members[id]; if (m) m.hp = maxHpOf(id); }
}

export function maxHpOf(id: string): number {
  const m = G.members[id];
  const g = m?.gear ? ITEMS[m.gear]?.gear : undefined;
  return statsAt(id, m?.level ?? 1).maxHp + (g?.hp ?? 0);
}

// ---- Battles ----

function battleParty(): PartyEntry[] {
  const ids = G.party.slice(0, 3);
  const out: PartyEntry[] = ids.map((id) => {
    const m = G.members[id];
    const entries = id === 'nodus' ? G.equipped.slice(0, 4) : undefined;
    return { id, level: m?.level ?? 1, hp: m?.hp ?? 999, gear: m?.gear ?? null, entries };
  });
  if (G.party.includes('anthelion') && !ids.includes('anthelion')) {
    const m = G.members.anthelion;
    out.push({ id: 'anthelion', level: m?.level ?? 15, hp: 999, gear: null, guest: true });
  }
  // In the dark Nodus carries the lantern and can move it.
  return out;
}

/** Where a scripted fight's lead foe stands on the map: its person, a prop drawn for it, or a marker named for it. */
function bossSpot(group: string): [number, number] | null {
  const id = GROUPS[group]?.foes[0];
  if (!id || !F.map) return null;
  const a = F.actors.find((x) => x.id === id && x.visible);
  if (a) return [a.x, a.y];
  const pr = F.map.def.props?.find((p) => p.art.startsWith(id));
  if (pr) return [pr.x, pr.y];
  return F.map.markers.get(id) ?? F.map.markers.get('boss') ?? null;
}

function arenaFor(foeAt: [number, number] | null): { arena: ArenaSpec; ox: number; oy: number } {
  const rt = F.map!;
  const p = F.player!;
  let fx = foeAt ? foeAt[0] : p.x + 4, fy = foeAt ? foeAt[1] : p.y;
  // Foes start at least 4 tiles off, so the first round shows their plans before anyone is in reach.
  const dx = fx - p.x, dy = fy - p.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 4) {
    const ux = dx || dy ? Math.sign(dx) : 1, uy = Math.sign(dy);
    fx = Math.max(0, Math.min(rt.w - 1, p.x + ux * 4));
    fy = Math.max(0, Math.min(rt.h - 1, p.y + uy * 4));
    if (Math.max(Math.abs(fx - p.x), Math.abs(fy - p.y)) < 4) { fx = Math.max(0, Math.min(rt.w - 1, p.x - ux * 4)); fy = Math.max(0, Math.min(rt.h - 1, p.y - uy * 4)); }
  }
  const w = Math.min(18, rt.w), h = Math.min(13, rt.h);
  const mx = Math.round((p.x + fx) / 2), my = Math.round((p.y + fy) / 2);
  const ox = Math.max(0, Math.min(rt.w - w, mx - Math.floor(w / 2)));
  const oy = Math.max(0, Math.min(rt.h - h, my - Math.floor(h / 2)));
  const solid = new Uint8Array(w * h);
  const heat = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = rt.tiles[(oy + y) * rt.w + (ox + x)];
    // A tile with a height on open ground casts a lead but does not block.
    if (t.solid || t.water || t.pit) solid[y * w + x] = 1;
    if (t.heat) heat[y * w + x] = 1;
  }
  for (const pr of rt.def.props ?? []) if (pr.solid !== false) { const x = pr.x - ox, y = pr.y - oy; if (x >= 0 && y >= 0 && x < w && y < h) solid[y * w + x] = 1; }
  const reg = F.region;
  const bl = rt.def.battleLight;
  const sun = bl ? { dir: bl.dir8, lowness: bl.lowness } : reg.sun && reg.battleLowness > 0 ? { dir: reg.dir8, lowness: reg.battleLowness } : null;
  const clampP = (x: number, y: number) => ({ x: Math.max(0, Math.min(w - 1, x - ox)), y: Math.max(0, Math.min(h - 1, y - oy)) });
  return { arena: { w, h, solid, heat, sun, dark: reg.id === 'back', partyAt: clampP(p.x, p.y), foeAt: clampP(fx, fy) }, ox, oy };
}

let battleSeed = 1;

export async function startBattle(group: string, foeAt: [number, number] | null): Promise<'win' | 'lose' | 'run'> {
  const prevMode = GAME.mode;
  const prevMusic = F.map ? MAPS.get(G.map)?.music ?? 'none' : 'none';
  const { arena, ox, oy } = arenaFor(foeAt);
  const g = GROUPS[group];
  for (;;) {
    const members = battleParty();
    if (arena.dark && G.items.lantern && !flag('ch6_done')) {
      // Nodus can move the lantern in the dark.
    }
    const st = buildBattle(arena, members, group, battleSeed++, G.vars.difficulty as number ?? 0);
    const nodus = st.units.find((u) => u.id === 'nodus');
    const par = st.units.find((u) => u.id === 'parhelia');
    if (par && !flag('ch1_oil')) par.skills = par.skills.filter((s) => s !== 'raise' && s !== 'hood' && s !== 'flare');
    if (nodus && arena.dark && G.items.lantern && !flag('ch6_done')) nodus.skills.push('raise');
    if (nodus && flag('ch5_parhelia_taken') && !flag('ch7_parhelia_free') && F.region.id === 'overhead') nodus.skills.push('raise');
    const screen = new BattleScreen(st, ox, oy, !!g?.boss);
    GAME.battle = screen;
    GAME.mode = 'battle';
    await fadeTo(0, 0.2);
    const result = await screen.start();
    await fadeTo(1, 0.3);
    GAME.battle = null;
    GAME.mode = prevMode === 'battle' ? 'field' : prevMode;
    if (result === 'win') {
      award(st);
      playMusic(prevMusic);
      await fadeTo(0, 0.3);
      await showAwards();
      return 'win';
    }
    if (result === 'lose') {
      if (screen.loseChoice === 0) { await fadeTo(0, 0.1); continue; }
      healParty();
      enterMap(G.post.map, [G.post.x, G.post.y]);
      playMusic(MAPS.get(G.post.map)?.music ?? 'none');
      await fadeTo(0, 0.4);
      return 'lose';
    }
    playMusic(prevMusic);
    await fadeTo(0, 0.3);
    return result;
  }
}

let pendingAwards: string[] = [];

function award(st: import('../battle/types').BattleState) {
  const xp = st.units.filter((u) => u.side === 'foe' && u.decoyOf === undefined).reduce((n, u) => n + u.xp, 0);
  const mites = st.units.filter((u) => u.side === 'foe' && u.decoyOf === undefined).reduce((n, u) => n + u.mites, 0);
  G.mites += mites;
  for (const u of st.units) if (u.side === 'foe' && !G.seen.includes(u.id) && u.decoyOf === undefined) G.seen.push(u.id);
  pendingAwards = [];
  for (const u of st.units) {
    if (u.side !== 'party' || u.guest) continue;
    const m = G.members[u.id];
    if (!m) continue;
    m.hp = u.alive ? u.hp : 1;
    if (m.level >= MAX_LEVEL) continue;
    m.xp += xp;
    while (m.level < MAX_LEVEL && m.xp >= xpFor(m.level + 1)) {
      const before = statsAt(u.id, m.level);
      const beforeSkills = skillsAt(u.id, m.level);
      m.level++;
      const after = statsAt(u.id, m.level);
      m.hp += after.maxHp - before.maxHp;
      const gains: string[] = [`HP +${after.maxHp - before.maxHp}`];
      if (after.pow > before.pow) gains.push('Pow +1');
      if (after.guard > before.guard) gains.push('Guard +1');
      pendingAwards.push(`${u.id === 'nodus' ? G.name : MEMBERS[u.id].name} is level ${m.level}. ${gains.join(', ')}.`);
      for (const s of skillsAt(u.id, m.level)) if (!beforeSkills.includes(s)) pendingAwards.push(`New skill: ${s.replace('_', ' ')}.`);
      sfx('level_up');
    }
  }
  for (const s of st.learned) {
    if (!G.entries.includes(s)) G.entries.push(s);
    if (G.equipped.length < 4 && !G.equipped.includes(s)) G.equipped.push(s);
    if (!flag('tut_noted')) pendingAwards.push('__tut_noted');
  }
}

async function showAwards() {
  for (const a of pendingAwards) {
    if (a === '__tut_noted') { setFlag('tut_noted'); await runSceneInline('tut_noted'); continue; }
    await say(null, a);
  }
  if (pendingAwards.length) closeBox();
  pendingAwards = [];
}

async function runSceneInline(id: string) {
  const sc = SCENES.get(id);
  if (!sc) return;
  for (const c of sc.cmds) { if (c.t === 'say') await say(c.speaker, c.text); else if (c.t === 'sys') await say(null, c.text); }
  closeBox();
}

export async function encounterBattle(a: Actor) {
  if (!a.enc || running) return;
  running++;
  F.frozen = true;
  try {
    const r = await startBattle(a.enc.group, [a.x, a.y]);
    if (r === 'win') removeEncounter(a);
    F.grace = 2;
  } finally {
    running--;
    if (!running) { F.frozen = false; closeBox(); spawnPeople(); refreshProps(); }
  }
}

export async function changeMap(to: string, at: string) {
  if (running) return;
  running++;
  F.frozen = true;
  try {
    sfx('door', { vol: 0.6 });
    await fadeTo(1, 0.25);
    enterMap(to, at);
    const def = MAPS.get(to);
    if (def) playMusic(def.music);
    snapCamera();
    await fadeTo(0, 0.25);
    if (def?.enterScene) { running--; F.frozen = false; await runScene(def.enterScene); running++; }
  } finally {
    running--;
    if (!running) F.frozen = false;
  }
}
void resetArrival;

export function autosave() { save(); }
void autosave;
