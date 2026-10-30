// Content checks: scripts parse, every jump target exists, maps reference real props, markers, scenes, and
// enemies, and player-facing lines keep the style rules. Run with `npm test`.
import { SCRIPT_FILES } from '../script/index';
import { SCENES, loadScripts, type SLine } from '../game/script';
import { ALL_MAPS } from '../content/maps/index';
import { parseMap } from '../world/map';
import { PROPS } from '../world/props';
import { ENEMY, ITEM } from '../rules/data';
import { QUEST } from '../content/quests';
import { SHOPS } from '../content/shops';
import { LOOT } from '../content/loot';
import { LOOKS } from '../art/cast';
import '../content/register';
import { BANTER } from '../content/banter';
import { FACTION, TRAVEL, EVENTS, BACKGROUND } from '../content/replay';
import { DETAILS, LORE } from '../content/details';

const errors: string[] = [];
const warns: string[] = [];
const err = (s: string) => errors.push(s);
const warn = (s: string) => warns.push(s);

try { loadScripts(SCRIPT_FILES); } catch (e) { err(String(e)); }

const BANNED = ['whisper', 'shimmer', 'tapestry', 'testament', 'journey', 'destiny', 'ancient', 'gaze', 'grin', 'mutter', 'something shifted', 'a part of me', 'i guess', 'look,', 'elara', 'kael'];
const LOOK_OK = (l: string) => !!LOOKS[l] || ['courtesy', 'courtesy_cyan', 'patrol', 'patrol_hushed', 'drone', 'turret', 'tilly', 'dog'].includes(l) || l.startsWith('crowd:');

const mapIds = new Set(ALL_MAPS.map((m) => m.id));
const COMPANION_IDS = new Set(['courtesy', 'sallis', 'quaye', 'ambrose', 'tova', 'ignace', 'hero']);
const markers = new Map<string, Set<string>>();
const encounters = new Map<string, Set<string>>();
const npcs = new Map<string, Set<string>>();
for (const def of ALL_MAPS) {
  markers.set(def.id, new Set(Object.keys(def.markers ?? {})));
  encounters.set(def.id, new Set((def.encounters ?? []).map((e) => e.id)));
  npcs.set(def.id, new Set((def.npcs ?? []).map((n) => n.id)));
}
const allMarkers = new Set<string>();
for (const s of markers.values()) for (const m of s) allMarkers.add(m);
const allEnc = new Set<string>();
for (const s of encounters.values()) for (const m of s) allEnc.add(m);

function checkText(where: string, t: string) {
  if (t.length > 100) err(`${where}: line over 100 characters (${t.length})`);
  if (/[–—]/.test(t)) err(`${where}: dash character`);
  if (t.includes(';')) err(`${where}: semicolon`);
  const low = t.toLowerCase();
  for (const b of BANNED) if (new RegExp(`\\b${b.replace(/[.,]/g, '\\$&')}`).test(low)) err(`${where}: banned word "${b}"`);
  if (/\bnot [a-z]+, (it'?s|but)\b/i.test(t)) warn(`${where}: possible negation pivot`);
}

let lines = 0;
for (const sc of SCENES.values()) {
  for (const L of sc.lines) {
    const where = `${sc.file}:${L.n} (${sc.id})`;
    if (L.k === 'say') { checkText(where, L.text); lines++; }
    if (L.k === 'choice') {
      if (L.prompt) checkText(where, L.prompt);
      for (const o of L.opts) {
        checkText(where, o.text);
        for (const t of [o.to, o.fail]) if (t && !sc.labels.has(t) && !SCENES.has(t)) err(`${where}: option target "${t}" not found`);
        if (o.check && !o.fail) err(`${where}: check option needs "-> pass | fail"`);
      }
    }
    if (L.k === 'cmd') checkCmd(L as Extract<SLine, { k: 'cmd' }>, where, sc.labels);
  }
}

function checkCmd(L: Extract<SLine, { k: 'cmd' }>, where: string, labels: Map<string, number>) {
  const a = L.args;
  const target = (t: string | undefined) => { if (t && !labels.has(t) && !SCENES.has(t)) err(`${where}: jump target "${t}" not found`); };
  switch (L.name) {
    case 'goto': target(a[0]); break;
    case 'if': case 'ifnot': case 'ifgilt': case 'ifapprove': case 'ifhold': case 'ifself': target(a[a.indexOf('->') + 1]); break;
    case 'check': { const i = a.indexOf('->'); for (const t of a.slice(i + 1).join(' ').split('|')) target(t.trim()); break; }
    case 'rep': if (!FACTION.has(a[0])) err(`${where}: unknown faction ${a[0]}`); break;
    case 'rel': for (const c of a.slice(0, 2)) if (!COMPANION_IDS.has(c)) err(`${where}: rel names unknown companion ${c}`); break;
    case 'warp': if (!mapIds.has(a[0])) err(`${where}: warp to unknown map ${a[0]}`); else if (a[1] && !markers.get(a[0])!.has(a[1].replace('@', ''))) err(`${where}: map ${a[0]} has no marker ${a[1]}`); break;
    case 'walk': case 'run': case 'enter': case 'camera': {
      const m = a.find((x) => x.startsWith('@'));
      if (m && !allMarkers.has(m.slice(1))) err(`${where}: marker ${m} is on no map`);
      if (L.name === 'enter' && !LOOK_OK(a[1])) err(`${where}: unknown look ${a[1]}`);
      break;
    }
    case 'give': case 'take': if (!ITEM.has(a[0])) err(`${where}: unknown item ${a[0]}`); break;
    case 'quest': if (!QUEST.has(a[0])) err(`${where}: unknown quest ${a[0]}`); else if (a[1] !== 'done' && a[1] !== 'fail' && !(a[1] in QUEST.get(a[0])!.stages)) err(`${where}: quest ${a[0]} has no stage ${a[1]}`); break;
    case 'fight': if (!allEnc.has(a[0])) err(`${where}: no encounter ${a[0]} on any map`); break;
    case 'shop': if (!SHOPS.has(a[0])) err(`${where}: unknown shop ${a[0]}`); break;
    case 'say': break;
    default: break;
  }
}

for (const def of ALL_MAPS) {
  const where = `map ${def.id}`;
  try {
    const m = parseMap(def);
    const w = def.rows[0].length;
    def.rows.forEach((r, i) => { if (r.length !== w) err(`${where}: row ${i} is ${r.length} wide, expected ${w}`); });
    for (const p of m.props) if (!PROPS.has(p.kind)) err(`${where}: unknown prop ${p.kind}`);
    for (const p of def.props ?? []) {
      if (p.scene && !SCENES.has(p.scene)) err(`${where}: prop scene ${p.scene} missing`);
      if (p.loot && !LOOT.has(p.loot)) err(`${where}: loot table ${p.loot} missing`);
    }
    for (const [k, [x, y]] of Object.entries(def.markers ?? {})) if (x < 0 || y < 0 || x >= w || y >= def.rows.length) err(`${where}: marker ${k} outside the map`);
    for (const e of def.exits ?? []) {
      if (!mapIds.has(e.to)) err(`${where}: exit to unknown map ${e.to}`);
      else if (!markers.get(e.to)!.has(e.at)) err(`${where}: exit target ${e.to} has no marker ${e.at}`);
    }
    for (const t of def.triggers ?? []) if (!SCENES.has(t.scene)) err(`${where}: trigger scene ${t.scene} missing`);
    for (const n of def.npcs ?? []) {
      if (n.talk && !SCENES.has(n.talk)) err(`${where}: npc ${n.id} talk scene ${n.talk} missing`);
      if (!LOOK_OK(n.look)) err(`${where}: npc ${n.id} unknown look ${n.look}`);
      if (typeof n.at === 'string' && !def.markers?.[n.at.slice(1)]) err(`${where}: npc ${n.id} at unknown marker ${n.at}`);
      for (const b of n.bark ?? []) checkText(`${where} bark ${n.id}`, b);
    }
    for (const e of def.encounters ?? []) {
      for (const u of e.units) if (!ENEMY.has(u.kind)) err(`${where}: encounter ${e.id} unknown enemy ${u.kind}`);
      for (const s of [e.win, e.alert]) if (s && !SCENES.has(s)) err(`${where}: encounter ${e.id} scene ${s} missing`);
    }
    if (def.enter && !SCENES.has(def.enter)) err(`${where}: enter scene ${def.enter} missing`);
  } catch (e) { err(`${where}: ${e}`); }
}

// Travel destinations and world events point at real maps, markers, and scenes.
for (const d of TRAVEL) {
  for (const t of [{ map: d.map, marker: d.marker }, ...(d.variants ?? [])]) {
    if (!mapIds.has(t.map)) err(`travel ${d.id}: unknown map ${t.map}`);
    else if (!markers.get(t.map)!.has(t.marker)) err(`travel ${d.id}: map ${t.map} has no marker ${t.marker}`);
  }
}
for (const e of EVENTS) {
  if (!SCENES.has(e.scene)) err(`event ${e.id}: scene ${e.scene} missing`);
  for (const m of e.maps ?? []) if (!mapIds.has(m)) err(`event ${e.id}: unknown map ${m}`);
}
for (const sc of SCENES.values()) for (const L of sc.lines) {
  const conds = L.k === 'cmd' ? L.args : L.k === 'choice' ? L.opts.map((o) => o.cond ?? '') : [];
  for (const c of conds) for (const part of c.split(/[|&!]/)) {
    if (part.startsWith('bg:') && !BACKGROUND.has(part.slice(3))) err(`${sc.file}:${L.n}: unknown background ${part.slice(3)}`);
    if (part.startsWith('rep:')) { const f = part.slice(4).split(/[<>=]/)[0]; if (!FACTION.has(f)) err(`${sc.file}:${L.n}: unknown faction ${f}`); }
  }
}

// Details point at real maps and tiles, real items, scenes, and lore, and their ids are unique.
const detailIds = new Set<string>();
for (const d of DETAILS) {
  const where = `detail ${d.id}`;
  if (detailIds.has(d.id)) err(`${where}: duplicate id`);
  detailIds.add(d.id);
  const def = ALL_MAPS.find((m) => m.id === d.map);
  if (!def) { err(`${where}: unknown map ${d.map}`); continue; }
  if (d.at[0] < 0 || d.at[1] < 0 || d.at[1] >= def.rows.length || d.at[0] >= def.rows[0].length) err(`${where}: tile ${d.at} is off the map`);
  else {
    // The player inspects the tile they face, so a walkable tile must touch it.
    const gm = parseMap(def);
    const walk = (x: number, y: number) => x >= 0 && y >= 0 && x < gm.w && y < gm.h && gm.cells[y * gm.w + x].tile.walk;
    const [x, y] = d.at;
    if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => walk(x + dx, y + dy))) err(`${where}: no walkable tile next to ${d.at}`);
  }
  for (const r of [d.reward, d.check?.reward]) if (r?.item && !ITEM.has(r.item)) err(`${where}: unknown item ${r.item}`);
  if (d.lore && !LORE.has(d.lore)) err(`${where}: unknown lore ${d.lore}`);
  if (d.scene && !SCENES.has(d.scene)) err(`${where}: scene ${d.scene} missing`);
  for (const t of d.text.split('|')) if (t.trim().length > 140) warns.push(`${where}: a line over 140 characters`);
}
for (const sc of SCENES.values()) for (const L of sc.lines) if (L.k === 'cmd' && L.name === 'lore' && !LORE.has(L.args[0])) err(`${sc.file}:${L.n}: unknown lore ${L.args[0]}`);

// Party banter: every scene exists, holds only speaker lines, and every speaker is PORT or in the listed party.
for (const b of BANTER) {
  const sc = SCENES.get(b.scene);
  const where = `banter ${b.scene}`;
  if (!sc) { err(`${where}: scene missing`); continue; }
  if (!sc.lines.length) err(`${where}: no lines`);
  for (const L of sc.lines) {
    const at = `${sc.file}:${L.n} (${b.scene})`;
    if (L.k !== 'say' || !L.who) { err(`${at}: banter holds only speaker lines`); continue; }
    if (L.who !== 'PORT' && !b.party.includes(L.who.toLowerCase())) err(`${at}: speaker ${L.who} is not in the banter party`);
    if (L.text.length > 46) err(`${at}: banter line over 46 characters (${L.text.length})`);
  }
  for (const m of b.maps ?? []) if (!mapIds.has(m) && !m.startsWith('flats')) err(`${where}: unknown map ${m}`);
}

console.log(`${SCENES.size} scenes, ${lines} spoken lines, ${ALL_MAPS.length} maps`);
for (const w of warns) console.log('warn: ' + w);
for (const e of errors) console.log('ERROR: ' + e);
console.log(errors.length ? `${errors.length} errors` : 'All checks pass.');
if (errors.length) process.exitCode = 1;
