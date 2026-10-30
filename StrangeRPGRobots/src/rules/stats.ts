// Derived numbers for party members: health, defense, movement, pools, abilities, and leveling.
import { ABILITY, ABILITY_LEVELS, ATTR_LEVELS, CLASSES, ITEM, PERK_LEVELS, SKILL_ATTR, SKILLS, XP_TO, type Attr, type Skill, type ItemDef } from './data';
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
  let hp = 8 + 4 * body + (m.level - 1) * (2 + body) + bonus(m, 'hp');
  if (m.perks.includes('tough')) hp += 8;
  if (m.perks.includes('juggernaut')) hp += 15;
  if (m.perks.includes('hardy')) hp += 10;
  if (m.cls === 'unit') hp += 6 + m.level * 2;
  return hp;
}

export function defenseOf(m: Member): number {
  const armor = m.gear.armor ? ITEM.get(m.gear.armor)?.def ?? 0 : 0;
  return attrOf(m, 'reflex') + armor + (m.perks.includes('iron_skin') ? 1 : 0);
}

export function moveOf(m: Member): number {
  let mv = 5 + (m.perks.includes('quick') ? 1 : 0);
  for (const it of gearItems(m)) mv += it.move ?? 0;
  if (m.gear.chrome.includes('legs')) mv += 1;
  if (m.cls === 'unit') mv -= 1;
  if (m.id === 'ambrose' && G.flags.ambrose_knee_arrears && !G.flags.ambrose_free) mv -= 1;
  return mv;
}

export function initBonus(m: Member): number { return 2 * attrOf(m, 'reflex') + bonus(m, 'init'); }

export function ramOf(m: Member): number {
  if (m.cls !== 'diver') return 0;
  return 4 + attrOf(m, 'wits') + bonus(m, 'ram') + (m.perks.includes('big_ram') ? 3 : 0);
}

export function edgeMax(m: Member): number { return 2 + Math.floor(attrOf(m, 'nerve') / 2) + (m.perks.includes('lucky') ? 2 : 0); }

/** Abilities the member has at its level, plus the port's once the story opens them. */
export function abilitiesOf(m: Member): string[] {
  const c = CLASSES[m.cls];
  const out: string[] = [];
  c.abilities.forEach((id, i) => { if (m.level >= ABILITY_LEVELS[i]) out.push(id); });
  if (m.id === 'hero' && G.flags.port_powers) out.push('reflexstep', 'secondhands', 'call');
  return out.filter((id) => ABILITY.has(id));
}

export function usesLeft(m: Member, id: string): number {
  const a = ABILITY.get(id);
  if (!a?.uses) return Infinity;
  let n = a.uses.n;
  if (id === 'adrenal' && m.perks.includes('second_wind')) n = 2;
  if (id === 'turret' && m.perks.includes('twin_turret')) n = 2;
  if (id === 'rally' && m.perks.includes('inspire')) n = 3;
  if (id === 'remaincalm' && m.perks.includes('calm_voice')) n = 2;
  if (id === 'redrain' && m.perks.includes('storm_blood')) n = 2;
  if (id === 'overcharge' && m.perks.includes('overdrive')) return Infinity;
  return Math.max(0, n - (m.spent[id] ?? 0));
}

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
  for (let l = 2; l <= level; l++) levelUp(m, true);
  m.hp = maxHp(m);
  m.edge = edgeMax(m);
  return m;
}

/** Raises a level. Automatic level-ups (companions joining late) pick perks and attributes for them. */
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
  if (PERK_LEVELS.includes(m.level)) {
    if (auto) {
      const tier = CLASSES[m.cls].perks[PERK_LEVELS.indexOf(m.level)];
      const pick = tier[(m.id.length + m.level) % tier.length];
      if (!m.perks.includes(pick)) m.perks.push(pick);
    } else m.pendingPerks++;
  }
  if (ATTR_LEVELS.includes(m.level)) {
    if (auto) {
      const best = (Object.entries(CLASSES[m.cls].attr) as [Attr, number][]).sort((a, b) => b[1] - a[1])[0][0];
      m.attr[best]++;
    } else m.pendingAttr++;
  }
}

/** Gives experience to the whole roster (benched members get it too, as in most party games). */
export function grantXp(n: number): { id: string; level: number }[] {
  const ups: { id: string; level: number }[] = [];
  for (const m of Object.values(G.roster)) {
    if (m.dead) continue;
    m.xp += n;
    while (m.level < 10 && m.xp >= XP_TO[m.level + 1]) {
      const before = maxHp(m);
      levelUp(m);
      m.hp += maxHp(m) - before;
      ups.push({ id: m.id, level: m.level });
    }
  }
  return ups;
}

export function partyMembers(): Member[] {
  return G.party.map((id) => G.roster[id]).filter((m): m is Member => !!m && !m.dead);
}
