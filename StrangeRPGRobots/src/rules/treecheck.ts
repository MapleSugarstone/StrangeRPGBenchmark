// Checks for the skill trees, run by npm test: tree data, an old-format save, the level cap, and the tree
// screen's layout with the interface audit.
import { ABILITY, ABILITIES, CLASSES, ENEMIES, ENEMY, PERKS, LEVEL_CAP, TREE_LEVELS, XP_TO, addEnemies, type PlayerClass } from './data';
import { CB, freeTile, los } from '../combat/core';
import { unitFromEnemy, unitFromMember, has } from '../combat/unit';
import { startTurn, endTurn, useAbility, damage, raiseWall, tickSurfaces, summonUnit } from '../combat/actions';
import { WORLD, loadWorld, type Actor } from '../world/world';
import type { MapDef } from '../world/map';
import { sheetFor } from '../art/cast';
import { PI, barFor, renderCombat } from '../combat/combat';
import { makeMember, pointsLeft, nodesOwned, nodeState, learnNode, abilitiesOf, needsAttention, migrateMember, grantXp, maxHp, ramOf, autoSpend } from './stats';
import { G, setSave, blankSave, type Save } from '../game/state';
import { hasIcon } from '../art/abilityIcons';
import { LAYOUT, endFrame } from '../engine/layout';
import { TreeScreen } from '../ui/tree';
import { PartyScreen } from '../ui/menus';

export function checkTrees(): string[] {
  const errs: string[] = [];
  const err = (s: string) => errs.push(`trees: ${s}`);
  const style = (where: string, t: string) => {
    if (/[–—;]/.test(t)) err(`${where}: dash or semicolon in "${t}"`);
    if (/\bcolour|armour|defence|behaviour\b/i.test(t)) err(`${where}: British spelling`);
  };
  const inTree = new Set<string>();
  for (const [cls, c] of Object.entries(CLASSES)) {
    if (c.tree.length !== 3) err(`${cls} has ${c.tree.length} branches`);
    if (c.auto.length !== 3 || new Set(c.auto).size !== 3) err(`${cls} auto order is not a branch order`);
    for (const id of c.abilities) if (!ABILITY.has(id)) err(`${cls} core ability ${id} missing`);
    let actives = 0;
    for (const b of c.tree) {
      if (b.nodes.length !== 6) err(`${cls} ${b.name} has ${b.nodes.length} nodes`);
      if (!b.nodes.some((id) => ABILITY.has(id))) err(`${cls} ${b.name} has no active ability`);
      for (const id of b.nodes) {
        if (!ABILITY.has(id) && !PERKS[id]) err(`${cls} ${b.name}: node ${id} is neither a perk nor an ability`);
        if (ABILITY.has(id) && PERKS[id]) err(`${cls}: node ${id} is both a perk and an ability`);
        if (inTree.has(id)) err(`node ${id} is in two trees`);
        inTree.add(id);
        if (ABILITY.has(id)) actives++;
      }
    }
    if (actives < 3) err(`${cls} has ${actives} new active abilities`);
  }
  for (const id of Object.keys(PERKS)) if (!inTree.has(id)) err(`perk ${id} is in no tree`);
  for (const a of ABILITIES) {
    style(`ability ${a.id}`, a.desc);
    style(`ability ${a.id}`, a.name);
    if (!hasIcon(a.icon)) err(`ability ${a.id} icon ${a.icon} missing`);
    if (a.summon && !a.summon.kind) err(`ability ${a.id} summons nothing`);
  }
  for (const p of Object.values(PERKS)) { style(`perk ${p.id}`, p.desc); style(`perk ${p.id}`, p.name); }
  for (const e of ENEMIES) for (const id of e.abilities ?? []) if (!ABILITY.has(id)) err(`enemy ${e.kind} uses unknown ability ${id}`);
  if (XP_TO.length !== LEVEL_CAP + 1) err(`XP_TO has ${XP_TO.length} entries for a cap of ${LEVEL_CAP}`);

  // An old-format save: perk picks from the four perk tiers and a pending perk, before trees existed.
  const old = JSON.parse(JSON.stringify({
    ...blankSave(),
    roster: {
      hero: { ...makeMember('hero', 'Vos', 'blade', 1), level: 10, xp: 15000, perks: ['tough', 'momentum', 'reaper', 'legend'], pendingPerks: 0, pendingAttr: 0 },
      quaye: { ...makeMember('quaye', 'Quaye', 'diver', 1), level: 7, xp: 6400, perks: ['big_ram', 'backdoor', 'read_room'], pendingPerks: 1, pendingAttr: 1 },
    },
    party: ['hero', 'quaye'],
  })) as Save;
  for (const m of Object.values(old.roster)) migrateMember(m);
  setSave(old);
  const hero = G.roster.hero, quaye = G.roster.quaye;
  if (pointsLeft(hero) !== 5) err(`old save: hero at level 10 with 4 perks should have 5 points, has ${pointsLeft(hero)}`);
  if (nodesOwned(quaye) !== 2) err(`old save: read_room is not a diver node, so Quaye owns 2 nodes, not ${nodesOwned(quaye)}`);
  if (pointsLeft(quaye) !== 4) err(`old save: Quaye at level 7 should have 4 points, has ${pointsLeft(quaye)}`);
  if (!needsAttention(quaye)) err('old save: Quaye has points and a raise but no marker');
  if (nodeState(hero, 1, 1) !== 'learned') err('old save: Reaper is not learned in Edge');
  if (nodeState(hero, 1, 0) !== 'learnable') err('old save: Brawler, below an owned node, is not learnable');
  if (!learnNode(hero, 1, 0) || pointsLeft(hero) !== 4) err('old save: learning Brawler did not spend a point');
  if (!learnNode(quaye, 2, 1) || !quaye.perks.includes('fast_ram')) err('old save: Quaye could not learn Fast RAM');
  if (learnNode(quaye, 2, 4)) err('old save: Quaye learned Root at level 7');
  if (maxHp(hero) <= maxHp({ ...hero, perks: [] })) err('old save: Tough adds no HP');

  // The cap, automatic spending, and the net kit.
  for (const cls of Object.keys(CLASSES) as PlayerClass[]) {
    const m = makeMember('t', 'T', cls, LEVEL_CAP);
    if (m.level !== LEVEL_CAP) err(`${cls}: makeMember stopped at level ${m.level}`);
    if (nodesOwned(m) !== LEVEL_CAP - 1 || pointsLeft(m) !== 0) err(`${cls}: auto spend left ${pointsLeft(m)} points at the cap`);
    const firstBranch = CLASSES[cls].tree[CLASSES[cls].auto[0]].nodes;
    if (!firstBranch.every((id) => m.perks.includes(id))) err(`${cls}: auto spend did not fill its first branch`);
    if (!abilitiesOf(m, true).includes('spike')) err(`${cls}: no Spike in the net`);
    if (ramOf(m, true) < 4) err(`${cls}: no RAM in the net`);
    const low = makeMember('t', 'T', cls, 5);
    if (nodesOwned(low) !== 4) err(`${cls}: level 5 owns ${nodesOwned(low)} nodes, not 4`);
    autoSpend(low);
  }
  setSave(blankSave());
  G.roster.hero = makeMember('hero', 'Vos', 'blade', 1);
  grantXp(XP_TO[LEVEL_CAP] + 5000);
  if (G.roster.hero.level !== LEVEL_CAP) err(`grantXp stopped at level ${G.roster.hero.level}`);
  if (G.roster.hero.pendingAttr !== 3) err(`a hero leveled to the cap has ${G.roster.hero.pendingAttr} attribute raises, not 3`);
  if (TREE_LEVELS[5] !== LEVEL_CAP) err('the last tier does not open at the cap');

  errs.push(...auditScreens());
  setSave(blankSave());
  return errs;
}

/** Plays the net rules on a small map: frost floor, walls, spared enemies, Spike, Deep Freeze, and called units. */
export async function checkMechanics(): Promise<string[]> {
  const errs: string[] = [];
  const err = (s: string) => errs.push(`mechanics: ${s}`);
  const def = { id: 'mech_check', name: 'Check', district: 'net', net: true, ambient: 0, ambientLevel: 0.5, rows: ['AAAAAAAA', 'AaAAAAAA', 'AAAAAAAA', 'AAAAAAAA'], markers: {}, exits: [] } as MapDef;
  loadWorld(def);
  setSave(blankSave());
  const sim = CB.sim;
  CB.sim = true; CB.units = []; CB.order = []; CB.surf = new Map(); CB.round = 1; CB.active = true;
  addEnemies([{ ...ENEMY.get('ganger')!, kind: 'check_spare', spare: true }]);
  const actor = (id: string, x: number, y: number): Actor => ({ id, name: id, sheet: sheetFor('crowd:1'), tx: x, ty: y, px: x * 10, py: y * 10, dir: 'down', anim: 0, moving: false, path: [], speed: 6, role: 'enemy', idle: 0, visible: true, lift: 0, alert: 0 });
  const foe = (kind: string, x: number, y: number) => { const u = unitFromEnemy(kind, actor(`${kind}_${x}_${y}`, x, y)); CB.units.push(u); CB.order.push(u); return u; };
  const anouk = makeMember('anouk', 'Anouk', 'keeper', 4);
  if (!anouk.perks.includes('deep_freeze')) anouk.perks.push('deep_freeze');
  const k = unitFromMember(anouk, actor('anouk', 0, 0));
  CB.units.push(k); CB.order.push(k);
  if (!k.chrome || k.ramMax < 4 || !k.abilities.includes('spike') || !k.abilities.includes('coldspike')) err('a keeper in the net has no chrome, RAM, Spike, or Cold Spike');
  const g = foe('ganger', 1, 1);
  if (!g.chrome) err('enemies in the net are not chromed');
  await startTurn(g);
  if (!has(g, 'frosted') || g.bonus || g.reaction || g.moveLeft !== Math.ceil(g.move / 2)) err('frost floor did not Frost a unit that started its turn on it');
  const g2 = foe('ganger', 5, 2);
  CB.cur = k;
  await useAbility(k, 'frost', g2.x, g2.y);
  if (has(g2, 'frosted') && (g2.status.get('frosted') ?? 0) !== 3) err(`Deep Freeze made Frosted last ${g2.status.get('frosted')} turns, not 3`);
  const hp = g2.hp;
  k.ram = k.ramMax;
  await useAbility(k, 'spike', g2.x, g2.y);
  if (g2.hp >= hp) err('Spike did no damage');
  raiseWall([[4, 0], [4, 1], [4, 2], [4, 3]], 2);
  if (freeTile(4, 1) || los({ x: 3, y: 1 }, { x: 6, y: 1 })) err('a frost wall does not block movement and sight');
  tickSurfaces(); tickSurfaces();
  if (!freeTile(4, 1)) err('a frost wall did not melt after its rounds');
  const s = foe('check_spare', 6, 3);
  await damage(s, 999, 'kinetic', k);
  if (!s.dead || s.actor?.lift !== -3) err('a spared enemy did not lie down at 0 HP');
  const called = summonUnit(k, 'ganger', 2, 3, 1);
  if (!called || called.side !== 'party') err('Call put no unit on the party side');
  else { await endTurn(called); if (!called.dead) err('a called unit did not leave when its turns ran out'); }
  // The action bar with a kit big enough to page, on both pages and with More hovered.
  const big = unitFromMember(makeMember('anouk', 'Anouk', 'keeper', LEVEL_CAP), actor('anouk_big', 2, 2));
  CB.units.push(big);
  CB.cur = big;
  const was = LAYOUT.on;
  LAYOUT.on = true;
  PI.resolve = () => {}; PI.mode = 'move'; PI.cx = 7; PI.cy = 3; PI.showOrder = 0; PI.banner.t = 0; PI.tipT = 0;
  for (const page of [0, 1]) for (const hoverMore of [false, true]) {
    PI.page = page;
    PI.bar = barFor(big);
    PI.hoverBar = hoverMore ? PI.bar.findIndex((b) => b.id === 'more') : -1;
    renderCombat();
    endFrame();
    for (const i of LAYOUT.last) err(`combat bar page ${page + 1}: ${i.kind} "${i.a}"${i.b ? ` with "${i.b}"` : ''}`);
  }
  if (!PI.bar.some((b) => b.id === 'more')) err('a kit of 15 actives has no More slot');
  PI.resolve = null; PI.page = 0; LAYOUT.on = was;
  CB.units = []; CB.order = []; CB.surf = new Map(); CB.cur = null; CB.active = false; CB.sim = sim;
  WORLD.actors = [];
  setSave(blankSave());
  return errs;
}

/** Renders the tree screen for every class and cursor position, and the party screen, with the interface audit on. */
function auditScreens(): string[] {
  const out = new Set<string>();
  const was = LAYOUT.on;
  LAYOUT.on = true;
  setSave(blankSave());
  for (const cls of Object.keys(CLASSES) as PlayerClass[]) {
    for (const level of [1, 7, LEVEL_CAP]) {
      const m = makeMember(cls === 'port' ? 'port' : 'hero', 'Vos', cls, level);
      m.perks = m.perks.slice(0, Math.floor(m.perks.length / 2));
      G.roster = { [m.id]: m };
      G.party = [m.id];
      const s = new TreeScreen(m);
      for (let b = 0; b < 3; b++) for (let t = 0; t < 6; t++) {
        s.b = b; s.t = t;
        s.render();
        endFrame();
        for (const i of LAYOUT.last) out.add(`tree screen ${cls} level ${level}: ${i.kind} "${i.a}"${i.b ? ` with "${i.b}"` : ''} at ${i.x},${i.y}`);
      }
      const p = new PartyScreen();
      p.render();
      endFrame();
      for (const i of LAYOUT.last) out.add(`party screen ${cls} level ${level}: ${i.kind} "${i.a}"${i.b ? ` with "${i.b}"` : ''} at ${i.x},${i.y}`);
    }
  }
  LAYOUT.on = was;
  return [...out].map((s) => `trees: ${s}`);
}
