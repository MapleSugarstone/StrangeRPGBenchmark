// Derived numbers for party members: health, defense, movement, pools, abilities, skill trees, and leveling.
import { ABILITY, ABILITY_LEVELS, ATTR_LEVELS, CLASSES, ITEM, LEVEL_CAP, PERKS, SKILL_ATTR, SKILLS, TREE_LEVELS, XP_TO, type Attr, type Skill, type ItemDef, type PerkMod, type AtkKind, type PlayerClass } from './data';
import { G, type Member } from '../game/state';

export function gearItems(m: Member): ItemDef[] {
  const out: ItemDef[] = [];
  for (const id of [m.gear.melee, m.gear.ranged, m.gear.armor, ...m.gear.chrome]) {
    const it = id ? ITEM.get(id) : undefined;
    if (it) out.push(it);
  }
  return out;
}

function bonus(m: Member, key: string): number {
  let b = 0;
  for (const it of gearItems(m)) b += (it.bonus as Record<string, number> | undefined)?.[key] ?? 0;
  return b;
}

// ---------- perk modifiers ----------

const modCache = new Map<string, PerkMod>();

function mergeMod(into: Record<string, unknown>, add: PerkMod) {
  for (const [k, v] of Object.entries(add)) {
    if (typeof v === 'number') into[k] = ((into[k] as number | undefined) ?? 0) + v;
    else if (v) {
      const o = (into[k] ??= {}) as Record<string, number>;
      for (const [kk, vv] of Object.entries(v as Record<string, number>)) o[kk] = (o[kk] ?? 0) + vv;
    }
  }
}

/** Every passive number the given perks add, merged. This is the one place perk modifiers are read. */
export function modsOf(perks: readonly string[]): PerkMod {
  const key = perks.join(',');
  const hit = modCache.get(key);
  if (hit) return hit;
  const m: PerkMod = {};
  for (const id of perks) { const p = PERKS[id]?.mod; if (p) mergeMod(m as Record<string, unknown>, p); }
  modCache.set(key, m);
  return m;
}
export function mods(m: Member): PerkMod { return modsOf(m.perks); }
export function modDmg(mod: PerkMod, kind: AtkKind): number { return (mod.dmg?.[kind] ?? 0) + (kind === 'all' ? 0 : mod.dmg?.all ?? 0); }
export function modHit(mod: PerkMod, kind: AtkKind): number { return (mod.hit?.[kind] ?? 0) + (kind === 'all' ? 0 : mod.hit?.all ?? 0); }

// ---------- derived numbers ----------

export function attrOf(m: Member, a: Attr): number { return m.attr[a] + bonus(m, a); }

export function skillOf(m: Member, s: Skill): number { return m.skills[s] + bonus(m, s); }

/** Dice pool for a check: attribute plus skill plus gear, plus perks. */
export function pool(m: Member, s: Skill): number {
  let p = attrOf(m, SKILL_ATTR[s]) + skillOf(m, s);
  if (s === 'talk' && m.perks.includes('silver')) p += 1;
  if (s === 'notice' && m.perks.includes('read_room')) p += 1;
  if (m.id === 'ambrose' && s === 'notice' && (G.flags.ambrose_eye_arrears ?? 0) > 0 && !G.flags.ambrose_free) p -= 1;
  return Math.max(1, p);
}

export function maxHp(m: Member): number {
  const body = attrOf(m, 'body');
  let hp = 8 + 4 * body + (m.level - 1) * (2 + body) + bonus(m, 'hp') + (mods(m).hp ?? 0);
  if (m.cls === 'unit') hp += 6 + m.level * 2;
  return hp;
}

export function defenseOf(m: Member): number {
  const armor = m.gear.armor ? ITEM.get(m.gear.armor)?.def ?? 0 : 0;
  return attrOf(m, 'reflex') + armor + (mods(m).def ?? 0);
}

export function moveOf(m: Member): number {
  let mv = 5 + (mods(m).move ?? 0);
  for (const it of gearItems(m)) mv += it.move ?? 0;
  if (m.gear.chrome.includes('legs')) mv += 1;
  if (m.cls === 'unit') mv -= 1;
  if (m.id === 'ambrose' && G.flags.ambrose_knee_arrears && !G.flags.ambrose_free) mv -= 1;
  return mv;
}

export function initBonus(m: Member): number { return 2 * attrOf(m, 'reflex') + bonus(m, 'init') + (mods(m).init ?? 0); }

/** Divers always have RAM. In a net map every member has it. */
export function ramOf(m: Member, net = false): number {
  if (m.cls !== 'diver' && !net) return 0;
  return 4 + attrOf(m, 'wits') + bonus(m, 'ram') + (mods(m).ram ?? 0);
}

export function edgeMax(m: Member): number { return 2 + Math.floor(attrOf(m, 'nerve') / 2) + (mods(m).edge ?? 0); }

/** The one ability each class gets in net maps, on top of Spike. */
export const NET_ABILITY: Partial<Record<PlayerClass, string>> = { blade: 'cut', diver: 'crash', rigger: 'bounce', mouth: 'spoof', unit: 'quarantine', witch: 'redping', keeper: 'coldspike' };

/** Abilities the member has: the class kit by level, actives learned in the tree, the port's powers, and the net ones. */
export function abilitiesOf(m: Member, net = false): string[] {
  const c = CLASSES[m.cls];
  const out: string[] = [];
  if (net) { out.push('spike'); const n = NET_ABILITY[m.cls]; if (n) out.push(n); }
  c.abilities.forEach((id, i) => { if (m.level >= ABILITY_LEVELS[i]) out.push(id); });
  for (const b of c.tree) for (const id of b.nodes) if (ABILITY.has(id) && m.perks.includes(id)) out.push(id);
  if (m.id === 'hero' && G.flags.port_powers) out.push('reflexstep', 'secondhands', 'call');
  return out.filter((id) => ABILITY.has(id));
}

/** Uses per rest or fight, with perk bonuses. */
export function maxUses(perks: readonly string[], id: string): number {
  const a = ABILITY.get(id);
  if (!a?.uses) return Infinity;
  return a.uses.n + (modsOf(perks).uses?.[id] ?? 0);
}

export function usesLeft(m: Member, id: string): number {
  const n = maxUses(m.perks, id);
  if (n === Infinity) return n;
  return Math.max(0, n - (m.spent[id] ?? 0));
}

// ---------- skill trees ----------

export type NodeState = 'learned' | 'learnable' | 'level' | 'order' | 'points';

export function isTreeNode(cls: PlayerClass, id: string): boolean { return CLASSES[cls].tree.some((b) => b.nodes.includes(id)); }

/** Tree nodes the member owns. Perks from story events that are not in the class tree do not count. */
export function nodesOwned(m: Member): number { return m.perks.filter((p) => isTreeNode(m.cls, p)).length; }

/** One point per level from 2 to the cap, less the nodes already owned. Old saves get their extra points this way. */
export function pointsLeft(m: Member): number { return Math.max(0, Math.min(m.level, LEVEL_CAP) - 1 - nodesOwned(m)); }

export function nodeState(m: Member, b: number, t: number): NodeState {
  const nodes = CLASSES[m.cls].tree[b].nodes;
  if (m.perks.includes(nodes[t])) return 'learned';
  if (m.level < TREE_LEVELS[t]) return 'level';
  for (let k = 0; k < t; k++) if (!m.perks.includes(nodes[k])) return 'order';
  return pointsLeft(m) > 0 ? 'learnable' : 'points';
}

export function learnNode(m: Member, b: number, t: number): boolean {
  if (nodeState(m, b, t) !== 'learnable') return false;
  const before = maxHp(m);
  m.perks.push(CLASSES[m.cls].tree[b].nodes[t]);
  if (m.hp > 0) m.hp += maxHp(m) - before;
  return true;
}

/** Spends every point for a member who levels without the player: fills the class's first branch, then the next. */
export function autoSpend(m: Member, order: number[] = CLASSES[m.cls].auto) {
  const c = CLASSES[m.cls];
  for (let guard = 0; guard < 20 && pointsLeft(m) > 0; guard++) {
    let done = false;
    for (const b of order) {
      const t = c.tree[b].nodes.findIndex((id) => !m.perks.includes(id));
      if (t >= 0 && learnNode(m, b, t)) { done = true; break; }
    }
    if (!done) return;
  }
}

/** The member has a tree point or an attribute raise waiting. */
export function needsAttention(m: Member): boolean { return !m.dead && (pointsLeft(m) > 0 || m.pendingAttr > 0); }

/** Brings a save's member up to the current rules. Points are derived, so old perk picks stay as tree nodes. */
export function migrateMember(m: Member) {
  m.perks ??= [];
  m.spent ??= {};
  m.pendingAttr ??= 0;
  m.pendingPerks = 0;
}

// ---------- leveling ----------

export function makeMember(id: string, name: string, cls: Member['cls'], level: number, o: Partial<Member> = {}): Member {
  const c = CLASSES[cls];
  const skills = Object.fromEntries(SKILLS.map((s) => [s, c.skills[s] ?? 0])) as Record<Skill, number>;
  const m: Member = {
    id, name, cls, level: 1, xp: 0,
    attr: { ...c.attr }, skills,
    hp: 1,
    gear: { melee: c.gear.melee, ranged: c.gear.ranged, armor: c.gear.armor, chrome: [...(c.gear.chrome ?? [])] },
    perks: [], spent: {}, edge: 0, approval: 0, pendingPerks: 0, pendingAttr: 0,
    ...o,
  };
  for (let l = 2; l <= Math.min(level, LEVEL_CAP); l++) levelUp(m, true);
  autoSpend(m);
  m.hp = maxHp(m);
  m.edge = edgeMax(m);
  return m;
}

/** Raises a level. Automatic level-ups (companions joining late) raise attributes for them. Tree points are derived from the level. */
export function levelUp(m: Member, auto = false) {
  m.level++;
  if (m.xp < XP_TO[m.level]) m.xp = XP_TO[m.level];
  const skillOrder = Object.entries(CLASSES[m.cls].skills).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).map(([s]) => s as Skill);
  if (m.level % 2 === 0) {
    const s = skillOrder[(m.level / 2 - 1) % skillOrder.length];
    if (s && m.skills[s] < 5) m.skills[s]++;
  } else {
    const s = skillOrder[((m.level - 1) / 2) % skillOrder.length];
    if (s && m.skills[s] < 5) m.skills[s]++;
  }
  if (ATTR_LEVELS.includes(m.level)) {
    if (auto) {
      const best = (Object.entries(CLASSES[m.cls].attr) as [Attr, number][]).sort((a, b) => b[1] - a[1])[0][0];
      m.attr[best]++;
    } else m.pendingAttr++;
  }
}

/** The port's level is the hero's. Raises it to match, leaving its points for the player. */
export function syncPort(): { id: string; level: number }[] {
  const p = G.roster.port, h = G.roster.hero;
  const ups: { id: string; level: number }[] = [];
  if (!p || !h || p.cls !== 'port') return ups;
  while (p.level < Math.min(h.level, LEVEL_CAP)) {
    const before = maxHp(p);
    levelUp(p);
    if (p.hp > 0) p.hp += maxHp(p) - before;
    ups.push({ id: p.id, level: p.level });
  }
  p.xp = Math.max(p.xp, XP_TO[p.level]);
  return ups;
}

/** Gives experience to the whole roster (benched members get it too, as in most party games). */
export function grantXp(n: number): { id: string; level: number }[] {
  const ups: { id: string; level: number }[] = [];
  for (const m of Object.values(G.roster)) {
    if (m.dead || m.cls === 'port') continue;
    m.xp += n;
    while (m.level < LEVEL_CAP && m.xp >= XP_TO[m.level + 1]) {
      const before = maxHp(m);
      levelUp(m);
      m.hp += maxHp(m) - before;
      ups.push({ id: m.id, level: m.level });
    }
  }
  return [...ups, ...syncPort()];
}

export function partyMembers(): Member[] {
  return G.party.map((id) => G.roster[id]).filter((m): m is Member => !!m && !m.dead);
}

export { TREE_LEVELS };
