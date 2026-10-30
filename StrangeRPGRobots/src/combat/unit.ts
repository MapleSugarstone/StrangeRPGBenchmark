// Combat units: party members, enemies, allies, drones, turrets, and woken objects, all with one shape.
import { ENEMY, ITEM, type Attr, type Skill, type ItemDef, type Feeling, SKILLS } from '../rules/data';
import { attrOf, skillOf, maxHp, defenseOf, moveOf, initBonus, ramOf, abilitiesOf, edgeMax } from '../rules/stats';
import type { Member } from '../game/state';
import { G } from '../game/state';
import type { Actor, PropInst } from '../world/world';

export type Side = 'party' | 'enemy' | 'wild';

export interface Unit {
  id: string;
  name: string;
  side: Side;
  actor: Actor | null;
  prop: PropInst | null;
  member: Member | null;
  kind: string;
  level: number;
  hp: number;
  maxHp: number;
  def: number;
  move: number;
  init: number;
  attr: Record<Attr, number>;
  skills: Record<Skill, number>;
  melee: ItemDef | null;
  ranged: ItemDef | null;
  plating: number;
  machine: boolean;
  chrome: boolean;
  flying: boolean;
  abilities: string[];
  ai: string;
  boss: boolean;
  xp: number;
  status: Map<string, number>;
  moveLeft: number;
  action: boolean;
  bonus: boolean;
  reaction: boolean;
  extraActions: number;
  ram: number;
  ramMax: number;
  spentFight: Record<string, number>;
  downed: boolean;
  dead: boolean;
  /** Who woke this object, its feeling, and turns left. */
  wake?: { by: string; feeling: Feeling; turns: number; twice?: boolean };
  owner?: string;
  taunter?: string;
  guardedBy?: string;
  /** For Tova: her mood. */
  mood?: Feeling;
  /** Hit points of the rigger's drone, or 0 when lost. */
  droneHp: number;
  droneMax: number;
  /** Turns of being in the water after a shove into a canal. */
  swimming: number;
  unbrokenUsed?: boolean;
  /** Enemy-specific uses for this fight. */
  phase: number;
  /** The x and y the unit stands on, mirrored from its actor or prop. */
  x: number;
  y: number;
}

function blankSkills(): Record<Skill, number> { return Object.fromEntries(SKILLS.map((s) => [s, 0])) as Record<Skill, number>; }

export function unitFromMember(m: Member, actor: Actor): Unit {
  const attr = { body: attrOf(m, 'body'), reflex: attrOf(m, 'reflex'), wits: attrOf(m, 'wits'), nerve: attrOf(m, 'nerve') };
  const skills = blankSkills();
  for (const s of SKILLS) skills[s] = skillOf(m, s);
  const mh = maxHp(m);
  const u: Unit = {
    id: m.id, name: m.id === 'hero' ? G.heroName : m.name, side: 'party', actor, prop: null, member: m, kind: m.cls,
    level: m.level, hp: Math.max(1, Math.min(m.hp, mh)), maxHp: mh, def: defenseOf(m), move: moveOf(m), init: initBonus(m),
    attr, skills, melee: ITEM.get(m.gear.melee ?? 'fists') ?? ITEM.get('fists')!, ranged: m.gear.ranged ? ITEM.get(m.gear.ranged) ?? null : null,
    plating: m.cls === 'unit' ? 2 + (m.perks.includes('plating') ? 2 : 0) : 0, machine: m.cls === 'unit', chrome: m.cls !== 'witch', flying: false,
    abilities: abilitiesOf(m), ai: 'party', boss: false, xp: 0, status: new Map(),
    moveLeft: 0, action: true, bonus: true, reaction: true, extraActions: 0,
    ram: ramOf(m), ramMax: ramOf(m), spentFight: {}, downed: m.hp <= 0, dead: false, mood: m.mood,
    droneHp: m.cls === 'rigger' ? (m.perks.includes('armored_drone') ? 24 : 12) : 0, droneMax: m.cls === 'rigger' ? (m.perks.includes('armored_drone') ? 24 : 12) : 0,
    swimming: 0, phase: 0, x: actor.tx, y: actor.ty,
  };
  if (m.perks.includes('root')) u.ram = u.ramMax + 4;
  void edgeMax;
  return u;
}

/** The lowest level ordinary enemies fight at in each chapter, so old districts stay dangerous. */
export const CHAPTER_FLOOR = [0, 1, 4, 5, 7, 8, 9];

export function scaleEnemy(kind: string, level?: number): { hp: number; level: number } {
  const e = ENEMY.get(kind)!;
  const floor = e.boss ? 0 : CHAPTER_FLOOR[Math.min(6, G.chapter)] ?? 0;
  const lv = Math.max(e.level, level ?? e.level, floor);
  const hp = e.hp + (lv - e.level) * (e.grow ?? 5);
  const diff = G.difficulty;
  const mult = diff === 'story' ? 0.75 : diff === 'flatline' ? 1.25 : 1;
  return { hp: Math.round(hp * mult), level: lv };
}

export function unitFromEnemy(kind: string, actor: Actor, level?: number): Unit {
  const e = ENEMY.get(kind)!;
  const { hp, level: lv } = scaleEnemy(kind, level);
  const bonus = lv - e.level;
  const skills = blankSkills();
  for (const [s, v] of Object.entries(e.skills)) skills[s as Skill] = (v ?? 0) + Math.floor(bonus / 2);
  const attr = { ...e.attr };
  if (bonus >= 2) { attr.reflex += 1; attr.body += 1; }
  return {
    id: actor.id, name: e.name, side: 'enemy', actor, prop: null, member: null, kind, level: lv,
    hp, maxHp: hp, def: attr.reflex + (e.armor ?? 0), move: e.move ?? 5, init: 2 * attr.reflex,
    attr, skills, melee: e.melee ? ITEM.get(e.melee) ?? null : ITEM.get('fists')!, ranged: e.ranged ? ITEM.get(e.ranged) ?? null : null,
    plating: e.plating ?? 0, machine: !!e.machine, chrome: !!e.chrome || !!e.machine, flying: !!e.flying,
    abilities: e.abilities ?? [], ai: e.ai, boss: !!e.boss, xp: e.xp, status: new Map(),
    moveLeft: 0, action: true, bonus: true, reaction: true, extraActions: 0,
    ram: 0, ramMax: 0, spentFight: {}, downed: false, dead: false, droneHp: 0, droneMax: 0, swimming: 0, phase: 0,
    x: actor.tx, y: actor.ty,
  };
}

/** A woken object as a unit. It acts after its waker. */
export function unitFromProp(p: PropInst, by: Unit, feeling: Feeling, turns: number): Unit {
  const hp = Math.max(8, p.hp || p.def.hp || 12);
  const side: Side = feeling === 'anger' ? 'wild' : by.side;
  return {
    id: `prop:${p.id}`, name: `woken ${p.def.name}`, side, actor: null, prop: p, member: null, kind: 'prop', level: by.level,
    hp, maxHp: hp, def: 2, move: p.def.wake === 'ram' ? 5 : p.def.wake === 'bump' ? 3 : 2, init: 0,
    attr: { body: 4, reflex: 2, wits: 1, nerve: 5 }, skills: { ...blankSkills(), strike: 2, shoot: 2 },
    melee: null, ranged: null, plating: p.def.plating ?? 0, machine: true, chrome: !!p.def.networked, flying: false,
    abilities: [], ai: 'woken', boss: false, xp: 0, status: new Map(),
    moveLeft: 0, action: true, bonus: true, reaction: true, extraActions: 0,
    ram: 0, ramMax: 0, spentFight: {}, downed: false, dead: false, droneHp: 0, droneMax: 0, swimming: 0, phase: 0,
    wake: { by: by.id, feeling, turns }, owner: by.id,
    x: p.x, y: p.y,
  };
}

export function has(u: Unit, s: string): boolean { return (u.status.get(s) ?? 0) > 0; }
export function addStatus(u: Unit, s: string, turns: number) { u.status.set(s, Math.max(u.status.get(s) ?? 0, turns)); }
export function alive(u: Unit): boolean { return !u.downed && !u.dead; }
export function perk(u: Unit, p: string): boolean { return !!u.member?.perks.includes(p); }

export function hostile(a: Unit, b: Unit): boolean {
  if (a === b) return false;
  if (has(a, 'turncoat') || has(b, 'turncoat')) {
    const sa = has(a, 'turncoat') ? flip(a.side) : a.side;
    const sb = has(b, 'turncoat') ? flip(b.side) : b.side;
    return sa !== sb || sa === 'wild';
  }
  if (a.side === 'wild' || b.side === 'wild') return a.wake?.by !== b.id && b.wake?.by !== a.id;
  return a.side !== b.side;
}

function flip(s: Side): Side { return s === 'party' ? 'enemy' : s === 'enemy' ? 'party' : s; }
