import type { Unit } from './engine';
import { ENEMIES } from '../data/enemies';
import { MEMBERS, memberHues, skillsAt } from '../data/members';
import { fullStats, MemberState } from '../game/state';
import { huesOf } from '../core/palette';

export function partyUnit(m: MemberState, mech: string[]): Unit {
  const def = MEMBERS[m.id];
  const f = fullStats(m);
  const skills = ['attack', ...skillsAt(m.id, m.lvl).filter(s => !(m.lost ?? []).includes(s))];
  if (m.id === 'nil') for (const e of m.echo) if (!skills.includes(e)) skills.push(e);
  if (m.id === 'wick' && mech.includes('tricolor')) skills.push('ninth_ink', 'trichrome');
  if (mech.includes('link')) skills.push('link');
  return {
    uid: 0, side: 0, id: m.id, name: def.name, spec: { ...def.sprite }, lvl: m.lvl,
    maxHp: f.hp, hp: Math.min(m.hp, f.hp), maxInk: f.ink, ink: Math.min(m.ink, f.ink),
    str: f.str, def: f.def, mnd: f.mnd, spd: f.spd,
    baseHues: memberHues(m.id), skills,
    st: {}, stg: { str: 0, def: 0, mnd: 0, spd: 0 },
    shell: 0, maxShell: 0, broken: false, next: 0, guard: false,
    alive: m.hp > 0, gone: false, boss: false, mem: {},
    weaponHue: f.hue, traits: new Set(f.traits), tails: m.tails,
    loaded: m.id === 'tint' ? 'M' : 'N', mark: m.hp, turns: 0,
    xp: 0, gold: 0, drops: [], echo: [...m.echo],
  };
}

export function enemyUnit(id: string): Unit {
  const e = ENEMIES[id];
  if (!e) throw new Error('Unknown enemy ' + id);
  const hues = huesOf(e.pal);
  return {
    uid: 0, side: 1, id, name: e.name, spec: { ...e.sprite }, lvl: e.lvl,
    maxHp: e.hp, hp: e.hp, maxInk: 999, ink: 999,
    str: e.str, def: e.def, mnd: e.mnd, spd: e.spd,
    baseHues: hues, skills: e.skills.map(s => s[0]),
    st: {}, stg: { str: 0, def: 0, mnd: 0, spd: 0 },
    shell: e.shell, maxShell: e.shell, broken: false, next: 0, guard: false,
    alive: true, gone: false, boss: !!e.boss, ai: e.ai, mem: {},
    weaponHue: 'N', traits: new Set(), tails: 0, loaded: hues[0], mark: e.hp, turns: 0,
    xp: e.xp, gold: e.gold, drops: e.drops ?? [], echo: [],
  };
}

/** Copies battle results back into member state. */
export function writeBack(units: Unit[], members: Record<string, MemberState>) {
  for (const u of units) {
    if (u.side !== 0) continue;
    const m = members[u.id];
    if (!m) continue;
    m.hp = u.alive ? Math.max(1, u.hp) : 0;
    m.ink = Math.max(0, u.ink);
    m.tails = u.tails;
    if (u.id === 'nil') m.echo = [...u.echo];
  }
}
