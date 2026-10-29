// Content checks: every reference resolves, every line fits, no banned words. Exits non-zero on errors.
import fs from 'node:fs';
import path from 'node:path';
import { SCENES, DUPLICATES, loadScripts, type Cmd } from '../game/script';
import { TRACK_NAMES, SFX_NAMES } from '../audio';
import { REGIONS } from '../content/regions';
import { MAPS } from '../game/map';
import { loadMaps } from '../content/maps';
import { GROUPS, FOES } from '../content/foes';
import { CHARS } from '../content/art/chars';
import { MONS } from '../content/art/mons';
import { TILES } from '../content/art/tiles';
import { PROPS } from '../content/art/props';
import { ITEMS, SHOPS } from '../content/items';
import { SKILLS } from '../battle/skills';
import { OPPONENTS, RULE_TEXT } from '../game/sticks';
import { textWidth, wrap } from '../engine/font';

loadScripts();
loadMaps();

const errors: string[] = [];
const warns: string[] = [];
const err = (s: string) => errors.push(s);
const warn = (s: string) => warns.push(s);

for (const d of DUPLICATES) err(`scene defined twice: ${d}`);

const sceneOk = (id: string) => SCENES.has(id) || /^stray_\d+$/.test(id) || /^owner_\d+:/.test(id) && SCENES.has(id.split(':')[1]);

// Every marker named anywhere in a map.
const allMarkers = new Set<string>();
for (const m of MAPS.values()) for (const k of Object.keys(m.markers ?? {})) allMarkers.add(k);

// Audio: every track and sound the maps and the code name must exist.
const steps = new Set<string>(Object.values(REGIONS).map((r) => r.step));
for (const m of MAPS.values()) {
  if (m.music && m.music !== 'none' && !TRACK_NAMES.includes(m.music)) err(`${m.id}: unknown music ${m.music}`);
  for (const e of Object.values(m.legend ?? {})) if (e && typeof e === 'object' && 'step' in e && e.step) steps.add(e.step as string);
}
for (const s of steps) if (s && !SFX_NAMES.includes('step_' + s)) err(`no footstep sound for ${s}`);
const codeFiles = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? codeFiles(path.join(dir, d.name)) : d.name.endsWith('.ts') ? [path.join(dir, d.name)] : []);
for (const f of [...codeFiles('src/game'), ...codeFiles('src/battle'), 'src/main.ts']) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bsfx\('([a-z0-9_]+)'(?!\s*\+)/g)) if (!SFX_NAMES.includes(m[1])) err(`${f}: unknown sound ${m[1]}`);
  for (const m of src.matchAll(/\bplayMusic\('([a-z0-9_]+)'/g)) if (m[1] !== 'none' && !TRACK_NAMES.includes(m[1])) err(`${f}: unknown music ${m[1]}`);
}

// Maps: scenes, exits, art, groups.
for (const m of MAPS.values()) {
  const w = Math.max(...m.rows.map((r) => r.length));
  for (const r of m.rows) if (r.length !== w) err(`${m.id}: ragged row`);
  for (const ch of new Set(m.rows.join(''))) if (!m.legend[ch]) err(`${m.id}: no legend for '${ch}'`);
  const scenes = [...(m.npcs ?? []).map((n) => n.talk), ...(m.props ?? []).map((p) => p.talk), ...(m.triggers ?? []).map((t) => t.scene), ...(m.talks ?? []).map((t) => t.scene), ...(m.exits ?? []).map((e) => e.blocked), m.enterScene];
  for (const s of scenes) if (s && !sceneOk(s)) err(`${m.id}: missing scene ${s}`);
  for (const e of m.exits ?? []) {
    const to = MAPS.get(e.to);
    if (!to) { err(`${m.id}: exit to missing map ${e.to}`); continue; }
    if (!(to.markers ?? {})[e.at]) err(`${m.id}: exit to ${e.to} at missing marker ${e.at}`);
  }
  for (const n of m.npcs ?? []) if (!CHARS[n.art]) warn(`${m.id}: npc ${n.id} art ${n.art} not drawn`);
  for (const p of m.props ?? []) if (!PROPS[p.art]) warn(`${m.id}: prop art ${p.art} not drawn`);
  for (const e of m.encounters ?? []) {
    if (!GROUPS[e.group]) err(`${m.id}: encounter ${e.id} group ${e.group} missing`);
    if (!MONS[e.art] && !CHARS[e.art]) warn(`${m.id}: encounter art ${e.art} not drawn`);
  }
  const tiles = new Set(Object.values(m.legend).map((t) => t.t));
  for (const t of tiles) if (t !== 'void' && !TILES[t]) warn(`${m.id}: tile ${t} not drawn`);
  for (const g of m.gates ?? []) if (!TILES[g.open]) warn(`${m.id}: gate tile ${g.open} not drawn`);
  // Markers must sit on open ground.
  for (const [k, [x, y]] of Object.entries(m.markers ?? {})) {
    const ch = m.rows[y]?.[x];
    if (ch === undefined) err(`${m.id}: marker ${k} off the map`);
    else if (m.legend[ch]?.solid && !(m.gates ?? []).some((g) => g.x === x && g.y === y)) warn(`${m.id}: marker ${k} on solid tile '${ch}'`);
  }
}

// Scenes: commands, references, and text.
const BANNED = [/\bwhisper/i, /\bshimmer/i, /tapestry/i, /testament/i, /\bjourney/i, /destiny/i, /\bancient/i, /something shifted/i, /a part of me/i, /\bI guess\b/, /^Look,/, /flickered/i, /\bleaned\b/i, /muttered/i, /\bgaze\b/i, /grinned/i, /gestured/i, /deep breath/i, /eyes never leaving/i, /casting long shadows/i, /heart pound/i, /the air thick/i, /containment/i, /addendum/i, /serves as/i, /\bboasts\b/i, /nestled/i, /\bleverage\b/i, /multifaceted/i, /quietly/i, /universally/i, /\bdelve/i, /\bElara\b/, /\bKael\b/, /[–—;]/];
const MAX = 100;
const KNOWN = new Set(['end', 'lock', 'unlock', 'walk', 'step', 'face', 'enter', 'exit', 'emote', 'camera', 'wait', 'music', 'sfx', 'shake', 'fade', 'lamp', 'turn', 'set', 'unset', 'if', 'ifnot', 'goto', 'give', 'take', 'mites', 'join', 'leave', 'heal', 'battle', 'warp', 'chapter', 'letter', 'letter_drawing', 'shop', 'sticks', 'post', 'anim', 'type_entry', 'credits', 'title']);
const checkText = (where: string, text: string) => {
  if (text.length > MAX) err(`${where}: line over ${MAX} characters (${text.length})`);
  for (const b of BANNED) if (b.test(text)) err(`${where}: banned pattern ${b} in "${text}"`);
};
for (const sc of SCENES.values()) {
  const labels = sc.labels;
  sc.cmds.forEach((c: Cmd, i) => {
    const where = `${sc.file}:${sc.id}#${i}`;
    if (c.t === 'say' || c.t === 'sys') checkText(where, c.text);
    if (c.t === 'raw') checkText(where, c.text);
    if (c.t === 'choice') { for (const o of c.options) { checkText(where, o.text); if (o.label && !labels.has(o.label)) err(`${where}: choice label ${o.label} missing`); } }
    if (c.t !== 'cmd') return;
    if (!KNOWN.has(c.name)) err(`${where}: unknown command ${c.name}`);
    if ((c.name === 'if' || c.name === 'ifnot') && !labels.has(c.args[2]) && !SCENES.has(c.args[2])) err(`${where}: jump target ${c.args[2]} missing`);
    if (c.name === 'goto' && !labels.has(c.args[0]) && !SCENES.has(c.args[0])) err(`${where}: goto target ${c.args[0]} missing`);
    if (c.name === 'battle' && !GROUPS[c.args[0]]) err(`${where}: battle group ${c.args[0]} missing`);
    if (c.name === 'music' && c.args[0] !== 'none' && !TRACK_NAMES.includes(c.args[0])) err(`${where}: unknown music ${c.args[0]}`);
    if (c.name === 'sfx' && !SFX_NAMES.includes(c.args[0])) err(`${where}: unknown sound ${c.args[0]}`);
    if (c.name === 'warp') { const m = MAPS.get(c.args[0]); if (!m) err(`${where}: warp to missing map ${c.args[0]}`); else if (!(m.markers ?? {})[c.args[1]?.replace('@', '') ?? 'start']) err(`${where}: warp marker ${c.args[1]} missing on ${c.args[0]}`); }
    if ((c.name === 'give' || c.name === 'take') && !ITEMS[c.args[0]]) err(`${where}: item ${c.args[0]} missing`);
    if (c.name === 'shop' && !SHOPS[c.args[0]]) err(`${where}: shop ${c.args[0]} missing`);
    if (c.name === 'sticks' && !OPPONENTS[c.args[0]]) err(`${where}: sticks opponent ${c.args[0]} missing`);
    if (c.name === 'letter' && !SCENES.has('letter_' + c.args[0])) err(`${where}: letter ${c.args[0]} missing`);
    for (const a of c.args) if (a.startsWith('@') && !allMarkers.has(a.slice(1))) err(`${where}: marker ${a} is on no map`);
  });
}

// Text fit: every line must fit the box it is drawn in. Widths come from the real font, so a failure here is text cut off or overlapping on screen.
{
  const SW = 192;
  const fit = (where: string, text: string, max: number) => { const w = textWidth(text); if (w > max) err(`${where}: "${text}" is ${w} px wide, the space holds ${max}`); };
  const lines = (where: string, text: string, width: number, max: number) => { const n = wrap(text, width).length; if (n > max) err(`${where}: "${text.slice(0, 50)}..." wraps to ${n} lines, the space holds ${max}`); };
  for (const sc of SCENES.values()) {
    sc.cmds.forEach((c: Cmd, i) => {
      const where = `${sc.file}:${sc.id}#${i}`;
      if (c.t === 'choice') { for (const o of c.options) fit(`${where} choice`, o.text, SW - 30); if (c.prompt) fit(`${where} choice prompt`, c.prompt, SW - 24); }
      if (c.t === 'cmd' && c.name === 'chapter') fit(`${where} chapter title`, c.args.slice(1).join(' '), SW - 8);
    });
    if (/^letter_\d+$/.test(sc.id)) {
      const n = sc.cmds.filter((c: Cmd) => c.t === 'raw').reduce((k, c) => k + wrap((c as { text: string }).text, 154).length, 0);
      const room = sc.id === 'letter_5' ? 10 : 13;
      if (n > room) err(`${sc.file}:${sc.id}: letter wraps to ${n} lines, the paper holds ${room}`);
    }
    if (/^note_/.test(sc.id)) lines(`${sc.file}:${sc.id} ledger note`, sc.cmds.filter((c: Cmd) => c.t === 'say' || c.t === 'sys' || c.t === 'raw').map((c) => (c as { text: string }).text).join(' '), 118, 5);
  }
  for (const s of Object.values(SKILLS)) {
    fit(`skill ${s.id} name in the battle menu`, s.name, 72);
    lines(`skill ${s.id} description in the battle menu`, s.desc, 98, 4);
    lines(`skill ${s.id} description in the Ledger`, s.desc, 118, 5);
  }
  for (const it of Object.values(ITEMS)) {
    if (it.use) { fit(`item ${it.id} name in the battle menu`, `${it.name} x99`, 72); lines(`item ${it.id} description in the battle menu`, it.desc, 98, 4); }
    lines(`item ${it.id} description in the shop`, it.desc, SW - 28, 2);
    fit(`item ${it.id} name in the shop`, it.name, SW - 30 - textWidth(String(it.price ?? 0)));
  }
  for (const [k, t] of Object.entries(RULE_TEXT)) lines(`sticks rule ${k}`, t, 150, 4);
  for (const f of Object.values(FOES)) {
    fit(`foe ${f.id} name in the battle panel`, f.name, SW - 14);
    if (f.addsText) fit(`foe ${f.id} reinforcement banner`, f.addsText, SW - 14);
  }
  for (const b of ['No lead here', 'Moved too far to strike', 'Hooded', 'No lamp up', 'Not in shade', 'Nothing to aim at', 'Painted. Nothing there.', 'It eats the light.', 'Mites taken']) fit('battle banner', b, SW - 14);
  fit('battle panel tags', 'dazzled  pinned  sees 2 ahead', SW - 14);
}

// Foes, skills, and groups.
for (const f of Object.values(FOES)) {
  for (const s of f.skills) if (!SKILLS[s]) err(`foe ${f.id}: skill ${s} missing`);
  if (!MONS[f.art] && !CHARS[f.art]) warn(`foe ${f.id}: art ${f.art} not drawn`);
}
for (const [id, g] of Object.entries(GROUPS)) for (const f of g.foes) if (!FOES[f]) err(`group ${id}: foe ${f} missing`);
for (const [id, list] of Object.entries(SHOPS)) for (const it of list) if (!ITEMS[it]) err(`shop ${id}: item ${it} missing`);

const uniqueWarns = [...new Set(warns)];
console.log(`${errors.length} errors, ${uniqueWarns.length} warnings`);
for (const e of errors) console.log('ERROR ' + e);
for (const w of uniqueWarns.slice(0, 60)) console.log('warn  ' + w);
if (uniqueWarns.length > 60) console.log(`... and ${uniqueWarns.length - 60} more warnings`);
process.exit(errors.length ? 1 : 0);
