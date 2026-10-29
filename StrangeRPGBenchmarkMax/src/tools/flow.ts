// Follows every scene from the maps that start it, through jumps and warps, and checks each marker and actor it names
// against the map it runs on at that point. Usage: node dist-tools/flow.js
import fs from 'node:fs';
import { SCENES, loadScripts, type Cmd } from '../game/script';
import { MAPS, type MapDef } from '../game/map';
import { loadMaps } from '../content/maps';
import { MEMBERS } from '../content/party';

loadScripts();
loadMaps();

const problems = new Set<string>();
const MEMBER_IDS = new Set([...Object.keys(MEMBERS), 'nodus', 'player']);
const ACTOR_CMDS = new Set(['walk', 'step', 'face', 'emote', 'exit']);

/** Scenes a map can start: triggers, talk tiles, people, props, blocked exits, and the arrival scene. */
function entries(m: MapDef): string[] {
  const out: string[] = [];
  const add = (s?: string) => {
    if (!s) return;
    const own = s.match(/^owner_(\d+):(.+)$/);
    if (own) { out.push(own[2], `stray_return_${own[1]}`); return; }
    const st = s.match(/^stray_(\d+)$/);
    if (st) { out.push(`stray_find_${st[1]}`, 'stray_nolot'); return; }
    out.push(s);
  };
  for (const t of m.triggers ?? []) add(t.scene);
  for (const t of m.talks ?? []) add(t.scene);
  for (const n of m.npcs ?? []) add(n.talk);
  for (const p of m.props ?? []) add(p.talk);
  for (const e of m.exits ?? []) add(e.blocked);
  add(m.enterScene);
  return out.filter((s) => SCENES.has(s));
}

const seen = new Set<string>();

function run(sceneId: string, mapId: string, entered: Set<string>, path: string[]) {
  const key = `${sceneId}@${mapId}`;
  if (seen.has(key) || path.length > 12) return;
  seen.add(key);
  const sc = SCENES.get(sceneId);
  if (!sc) return;
  let map = MAPS.get(mapId);
  let cur = mapId;
  const here = new Set(entered);
  const where = () => `${sc.file}:${sceneId} on ${cur}${path.length ? ` (via ${path.join(' > ')})` : ''}`;
  const markerOk = (name: string) => !!map && !!(map.markers ?? {})[name];
  const actorOk = (id: string) => MEMBER_IDS.has(id) || here.has(id) || !!map?.npcs?.some((n) => n.id === id);
  sc.cmds.forEach((c: Cmd) => {
    if (c.t !== 'cmd') return;
    const a = c.args;
    switch (c.name) {
      case 'warp': {
        const to = MAPS.get(a[0]);
        if (!to) { problems.add(`${where()}: warp to missing map ${a[0]}`); return; }
        const mk = (a[1] ?? '@start').replace('@', '');
        if (!(to.markers ?? {})[mk]) problems.add(`${where()}: warp marker @${mk} missing on ${a[0]}`);
        map = to; cur = a[0];
        here.clear();
        return;
      }
      case 'enter':
        here.add(a[0]);
        if (a[1]?.startsWith('@') && !markerOk(a[1].slice(1))) problems.add(`${where()}: enter ${a[0]} at @${a[1].slice(1)}, which is not on this map`);
        return;
      case 'camera': case 'lamp':
        if (!a[0] || a[0] === 'free' || a[0] === 'off') return;
        if (a[0].startsWith('@')) { if (!markerOk(a[0].slice(1))) problems.add(`${where()}: ${c.name} @${a[0].slice(1)} is not on this map`); }
        else if (!actorOk(a[0])) problems.add(`${where()}: ${c.name} on ${a[0]}, who is not on this map`);
        return;
      case 'if': case 'ifnot': case 'goto': {
        const target = c.name === 'goto' ? a[0] : a[2];
        if (target && !sc.labels.has(target) && SCENES.has(target)) run(target, cur, here, [...path, sceneId]);
        return;
      }
    }
    if (ACTOR_CMDS.has(c.name)) {
      if (!actorOk(a[0])) problems.add(`${where()}: ${c.name} ${a[0]}, who is not on this map`);
      for (const x of a.slice(1)) if (x.startsWith('@') && !markerOk(x.slice(1))) problems.add(`${where()}: ${c.name} ${a[0]} to @${x.slice(1)}, which is not on this map`);
      if (c.name === 'face' && a[1] && !['up', 'down', 'left', 'right', 'away'].includes(a[1]) && !actorOk(a[1]) && !markerOk(a[1])) problems.add(`${where()}: face ${a[0]} toward ${a[1]}, which is not on this map`);
      if (c.name === 'exit' && a[0] !== 'nodus') here.delete(a[0]);
    }
  });
}

const pairs: { scene: string; map: string }[] = [];
for (const [id, m] of MAPS) for (const s of entries(m)) { pairs.push({ scene: s, map: id }); run(s, id, new Set(), []); }
// The browser smoke test reads this list from the dev server.
fs.writeFileSync('dist/scene-entries.json', JSON.stringify(pairs));

// Scenes no map, scene, or code path starts are listed so a missing hookup is visible.
const reached = new Set([...seen].map((k) => k.split('@')[0]));
const CODE = /^(tut_|letter_|post_|note_|talk_(parhelia|lot|minim|tik|umbraculum)(_|$)|ch\d_open$|stray_|owner_|epilogue|credits|battle_lost|need_|locked_door|nothing_here|too_dark|pit_fall|pebble_pit|sign_generic|talk_sticks_)/;
const orphans = [...SCENES.keys()].filter((s) => !reached.has(s) && !CODE.test(s));

const list = [...problems].sort();
for (const p of list) console.log(p);
console.log(`\n${list.length} problems. ${orphans.length} scenes nothing seems to start:`);
console.log(orphans.join(', '));
