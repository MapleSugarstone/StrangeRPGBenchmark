// Plays the story forward by flags alone, from a new game to the credits, to find softlocks. Every scene a reachable map can start
// is run as soon as its condition holds, every branch of a choice counts, every fight is won, and every plate counts as solved
// (the plate solver checks those separately). Usage: node dist-tools/progress.js
import { SCENES, loadScripts, type Cmd } from '../game/script';
import { MAPS, condOk, type MapDef } from '../game/map';
import { loadMaps } from '../content/maps';

loadScripts();
loadMaps();

const flags = new Set<string>();
const has = (f: string) => flags.has(f);
const reached = new Set<string>(['home']);
const ran = new Set<string>();
const log: string[] = [];

/** Flags, maps, and the ending a scene can produce, following jumps into other scenes. */
function effects(id: string, seen = new Set<string>()): { set: string[]; warps: string[]; ends: boolean } {
  const out = { set: [] as string[], warps: [] as string[], ends: false };
  const sc = SCENES.get(id);
  if (!sc || seen.has(id)) return out;
  seen.add(id);
  for (const c of sc.cmds as Cmd[]) {
    if (c.t !== 'cmd') continue;
    if (c.name === 'set') out.set.push(c.args[0]);
    if (c.name === 'anim') out.set.push('anim_' + c.args[0]);
    if (c.name === 'warp') out.warps.push(c.args[0]);
    if (c.name === 'title') { out.ends = true; out.set.push('game_cleared'); }
    const target = c.name === 'goto' ? c.args[0] : c.name === 'if' || c.name === 'ifnot' ? c.args[2] : null;
    if (target && !sc.labels.has(target) && SCENES.has(target)) {
      const e = effects(target, seen);
      out.set.push(...e.set); out.warps.push(...e.warps); out.ends ||= e.ends;
    }
  }
  return out;
}

function entries(m: MapDef): { scene: string; why: string }[] {
  const out: { scene: string; why: string }[] = [];
  const add = (s: string | undefined, cond: string | undefined, why: string) => {
    if (!s || !condOk(cond, has)) return;
    const own = s.match(/^owner_\d+:(.+)$/);
    out.push({ scene: own ? own[1] : s, why });
  };
  for (const t of m.triggers ?? []) add(t.scene, t.cond, 'trigger');
  for (const t of m.talks ?? []) add(t.scene, t.cond, 'talk');
  for (const n of m.npcs ?? []) add(n.talk, n.cond, `person ${n.id}`);
  for (const p of m.props ?? []) add(p.talk, p.cond, `prop ${p.art}`);
  for (const e of m.exits ?? []) if (!condOk(e.cond, has)) add(e.blocked, undefined, 'blocked exit');
  add(m.enterScene, undefined, 'arrival');
  return out.filter((x) => SCENES.has(x.scene));
}

// A new game runs the opening on the home map.
for (const f of effects('ch1_open').set) flags.add(f);
let ended = false;
for (let round = 0; round < 400; round++) {
  let changed = false;
  for (const id of [...reached]) {
    const m = MAPS.get(id);
    if (!m) continue;
    for (const e of m.exits ?? []) if (condOk(e.cond, has) && !reached.has(e.to)) { reached.add(e.to); changed = true; log.push(`map ${e.to} opens from ${id}`); }
    for (const p of m.plates ?? []) if (!has(p.flag)) { flags.add(p.flag); changed = true; }
    for (const { scene, why } of entries(m)) {
      const key = `${scene}|${[...flags].length}`;
      if (ran.has(key)) continue;
      ran.add(key);
      const e = effects(scene);
      const fresh = e.set.filter((f) => !flags.has(f));
      for (const f of fresh) flags.add(f);
      for (const w of e.warps) if (!reached.has(w)) { reached.add(w); log.push(`map ${w} opens by warp in ${scene}`); }
      if (fresh.length) { changed = true; log.push(`${scene} (${why} on ${id}) sets ${fresh.join(', ')}`); }
      if (e.ends) ended = true;
    }
  }
  if (!changed) break;
}

const chapters = ['ch1_struck', 'ch2_done', 'ch3_done', 'ch4_done', 'ch5_done', 'ch6_done', 'game_cleared'];
for (const c of chapters) console.log(`${flags.has(c) ? 'reached' : 'NOT REACHED'}: ${c}`);
const unreached = [...MAPS.keys()].filter((m) => !reached.has(m));
console.log(`maps never reached: ${unreached.length ? unreached.join(', ') : 'none'}`);
console.log(`ending reached: ${ended ? 'yes' : 'NO'}`);
if (!ended || process.argv.includes('--log')) for (const l of log) console.log('  ' + l);
