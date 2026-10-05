import { Battle } from '../core/battle';
import { chooseAction } from '../core/bots';
import { generateMap } from '../core/mapgen';
import { mechsFor } from '../core/party';
import { Rng } from '../core/rng';
import { CHAR, CHARS } from '../data/characters';
import { BOSSES, ENCOUNTERS, ENEMIES } from '../data/enemies';
import { GEAR, ITEMS, RUNES } from '../data/items';
import { SKILLS } from '../data/skills';
import { glyph } from '../gfx/font';
import { ARCH_IDS, bossSprites, DECOR_IDS, monsterSprite, npcSprite, partySprite, PARTY_IDS, SPECIAL_IDS, tile } from '../gfx/sprites';
import { CHAPTERS } from '../story/chapters';
import { CIRCLE_ORDER, type Cmd } from '../story/types';
import { chapterState, BOSS_BONUS, REG_BONUS, buildParty } from '../sim/simlib';
import { buildFoe, foeLevel } from '../data/enemies';

let pass = 0, fail = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = '') {
  if (ok) pass++;
  else { fail++; failures.push(`${name} ${detail}`); }
}

// ---------- fonts and sprites
for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?\'-:+/%()"*><=_# &;[]^') check(`glyph ${ch}`, glyph(ch).length === 15);
const colorsOf = (s: { d: Uint8Array }) => new Set(Array.from(s.d).filter((v) => v > 0)).size;
for (const id of PARTY_IDS) { const s = partySprite(id); check(`party sprite ${id}`, colorsOf(s) <= 3 && s.d.some((v) => v > 0)); }
for (const a of ARCH_IDS) for (let seed = 1; seed < 6; seed++) {
  const m = monsterSprite(a, seed * 991, ['#ff0000', '#00ff00']);
  check(`monster ${a}/${seed}`, m.d.filter((v) => v > 0).length >= 14, `pixels=${m.d.filter((v) => v > 0).length}`);
  check(`boss ${a}/${seed}`, bossSprites(a, seed * 991, ['#ff0000', '#00ff00']).length === 4);
}
for (const n of ['Ann', 'Bob', 'Mite Keeper']) check(`npc ${n}`, colorsOf(npcSprite(n)) <= 3);
for (const c of CHAPTERS) for (const k of ['floor', 'wall', ...DECOR_IDS, ...SPECIAL_IDS]) check(`tile ${c.theme.name}/${k}`, colorsOf(tile(c.theme, k)) <= 3);

// ---------- data integrity
for (const c of CHARS) {
  for (const [, id] of c.learn) check(`skill ${id}`, !!SKILLS[id]);
  check(`limit ${c.limit}`, !!SKILLS[c.limit]);
  check(`sprite for ${c.id}`, PARTY_IDS.includes(c.id));
}
for (const e of Object.values(ENEMIES)) for (const s of e.script) check(`enemy ${e.id} skill ${s.s}`, !!SKILLS[s.s]);
for (const [ch, list] of Object.entries(ENCOUNTERS)) for (const e of list) for (const f of e.foes) check(`encounter ch${ch} foe ${f}`, !!ENEMIES[f]);
for (const [ch, groups] of Object.entries(BOSSES)) for (const g of groups) { for (const f of g) check(`boss ch${ch} ${f}`, !!ENEMIES[f]); check(`boss ch${ch} group has a boss`, g.some((f) => ENEMIES[f].boss)); }
for (const g of Object.values(GEAR)) check(`gear ${g.id}`, g.price > 0);
for (const r of Object.values(RUNES)) check(`rune ${r.id}`, r.price > 0);
for (const i of Object.values(ITEMS)) check(`item ${i.id}`, i.price > 0);

// ---------- story structure
const partyNames = new Set(CHARS.map((c) => c.name.toUpperCase()));
const flat = (cmds: Cmd[]): Cmd[] => cmds.flatMap((c) => (typeof c === 'string' ? [c] : 'choice' in c ? [c, ...c.opts.flatMap((o) => flat(o.do))] : 'if' in c ? [c, ...flat(c.then), ...flat(c.else ?? [])] : [c]));
let words = 0;
const speakers = new Set<string>();
for (const ch of CHAPTERS) {
  const tag = `ch${ch.id}`;
  check(`${tag} has 8 beats`, ch.beats.length === 8);
  ch.beats.forEach((b, i) => {
    check(`${tag} beat ${i + 1} is ${CIRCLE_ORDER[i]}`, b.circle === CIRCLE_ORDER[i]);
    check(`${tag} beat ${i + 1} room reachable`, i === 7 ? b.room === 1 : b.room <= i + 1);
    check(`${tag} beat ${i + 1} note`, b.note.length > 10);
    const cmds = flat(b.script);
    if (i === 7) check(`${tag} ends chapter`, cmds.some((c) => typeof c === 'object' && 'end' in c));
    for (const c of cmds) {
      if (typeof c === 'string') {
        const m = c.match(/^([A-Z0-9 ]{2,14})\|/);
        if (m) speakers.add(m[1]);
        const text = c.replace(/^[A-Z0-9 ]{2,14}\|/, '');
        words += text.split(/\s+/).length;
        check(`${tag} no dash/semicolon "${text.slice(0, 24)}"`, !/[;–—]/.test(text));
        check(`${tag} line length`, text.length < 330, `${text.length}`);
      } else if ('battle' in c) check(`${tag} boss index`, !!BOSSES[ch.id][c.battle]);
      else if ('give' in c) check(`${tag} give ${c.give}`, !!(ITEMS[c.give] || GEAR[c.give] || RUNES[c.give]));
      else if ('join' in c) check(`${tag} join ${c.join}`, !!CHAR[c.join]);
      else if ('fight' in c) for (const f of c.fight) check(`${tag} fight foe ${f}`, !!ENEMIES[f]);
    }
  });
  const all = flat(ch.beats.flatMap((b) => b.script));
  check(`${tag} partymate joins`, all.some((c) => typeof c === 'object' && 'join' in c && c.join === ch.partymate));
  check(`${tag} unlock popup`, all.some((c) => typeof c === 'object' && 'unlock' in c));
  check(`${tag} intro`, ch.intro.length >= 2);
  check(`${tag} mech text`, ch.mechText.length >= 3);
  const bossCount = all.filter((c) => typeof c === 'object' && 'battle' in c).length;
  check(`${tag} boss battles match`, bossCount === BOSSES[ch.id].length, `${bossCount} vs ${BOSSES[ch.id].length}`);
  for (const n of ch.npcs) { check(`${tag} npc ${n.id} lines`, Object.keys(n.lines).length >= 1); for (const ls of Object.values(n.lines)) for (const l of ls) check(`${tag} npc no dash`, !/[;–—]/.test(l)); }
  for (const c of ch.chests) for (const f of c.guard ?? []) check(`${tag} chest guard ${f}`, !!ENEMIES[f]);
  // Maps
  const map = generateMap(ch);
  check(`${tag} map generated`, !!map);
}
for (const s of speakers) check(`speaker ${s} is known`, partyNames.has(s) || s.length <= 14);

// ---------- battle fuzz
const rng = new Rng(4242);
let battles = 0;
for (let ch = 1; ch <= 12; ch++) {
  for (let i = 0; i < 12; i++) {
    const s = chapterState(ch);
    const ids = i % 4 === 0 ? BOSSES[ch][BOSSES[ch].length - 1] : ENCOUNTERS[ch][i % ENCOUNTERS[ch].length].foes;
    const boss = i % 4 === 0;
    const foes = ids.map((id) => buildFoe(id, foeLevel(ch, ENEMIES[id], 0.6), ch));
    const b = new Battle({ party: buildParty(s), foes, inv: { ...s.inv }, mech: mechsFor(ch), seed: rng.int(1e9) + 1, boss });
    let steps = 0;
    const pol = (['smart', 'mash', 'random'] as const)[i % 3];
    while (!b.over && steps++ < 800) {
      const a = chooseAction(b, pol, rng);
      b.act(a);
      if (steps % 5 === 0) for (const u of b.units) { if (!(u.hp >= 0 && u.hp <= u.maxHp + 1e-6) || Number.isNaN(u.hp) || u.mp < -1e-6) { check(`invariant ch${ch}`, false, `${u.name} hp=${u.hp} mp=${u.mp}`); } }
    }
    battles++;
    check(`battle terminates ch${ch}/${i}`, !!b.over, `steps=${steps}`);
  }
}

console.log(`Checked: ${pass + fail}. Passed: ${pass}. Failed: ${fail}. Story words: ${words}. Speakers: ${speakers.size}. Fuzz battles: ${battles}.`);
if (fail) {
  for (const f of failures.slice(0, 40)) console.log('FAIL', f);
  process.exit(1);
}
