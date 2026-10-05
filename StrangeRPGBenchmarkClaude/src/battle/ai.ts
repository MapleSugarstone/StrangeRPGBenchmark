import type { Action, Battle, Unit } from './engine';
import { SKILLS } from '../data/skills';
import { ENEMIES } from '../data/enemies';

type BossAI = (b: Battle, u: Unit) => Action | null;

const BOSS: Record<string, BossAI> = {
  grey_moth: (b, u) => {
    const t = u.turns;
    if (t % 4 === 3) return { t: 'skill', skill: 'gather_dust' };
    if (t % 4 === 1 && u.hp < u.maxHp * 0.6) return { t: 'skill', skill: 'moth_kiss' };
    return null;
  },
  octachrome: (b, u) => {
    if (u.turns % 3 === 1) return { t: 'skill', skill: 'recolor_self' };
    return null;
  },
  cantor: (b, u) => {
    if (u.turns % 5 === 4) return { t: 'skill', skill: 'crescendo' };
    const choir = b.alive(1).filter(x => x !== u);
    if (u.turns % 6 === 2 && choir.length < 2) return { t: 'skill', skill: 'call_choir' };
    return null;
  },
  chronophage: (b, u) => {
    if (u.turns % 3 === 0) u.mem.hpBack = u.hp;
    if (u.turns % 6 === 5) return { t: 'skill', skill: 'coil' };
    if (u.turns % 6 === 2 && u.hp < +(u.mem.hpBack ?? 0) - u.maxHp * 0.1) return { t: 'skill', skill: 'loop_back' };
    return null;
  },
  baron: (b, u) => {
    if (u.turns % 5 === 4) return { t: 'skill', skill: 'audit' };
    if (u.turns % 5 === 1 && b.alive(1).length < 3) return { t: 'skill', skill: 'hire' };
    if (u.turns % 5 === 2 && b.gold > 0) return { t: 'skill', skill: 'bribe' };
    return null;
  },
  seraph: (b, u) => {
    if (u.turns % 4 === 3) return { t: 'skill', skill: 'target_lock' };
    return null;
  },
  spindle: (b, u) => {
    if (u.turns % 4 === 3) return { t: 'skill', skill: 'wind_up' };
    return null;
  },
  bishop_ordeal: (b, u) => {
    if (u.turns % 2 === 0) return { t: 'skill', skill: 'compress' };
    return null;
  },
  bishop: (b, u) => {
    if (u.turns % 5 === 4) return { t: 'skill', skill: 'sermon' };
    if (u.turns % 3 === 1) return { t: 'skill', skill: 'compress' };
    return null;
  },
  bishop2: (b, u) => {
    if (u.turns % 3 === 1) return { t: 'skill', skill: 'palette_swap' };
    if (u.turns % 6 === 5) return { t: 'skill', skill: 'sermon' };
    if (u.hp < u.maxHp * 0.3 && !u.mem.healed) { u.mem.healed = 1; return { t: 'skill', skill: 'benediction' }; }
    return null;
  },
};

export function enemyAction(b: Battle, u: Unit): Action {
  if (u.mem.charged) {
    const s = String(u.mem.charged);
    delete u.mem.charged;
    delete u.st.charge;
    return { t: 'skill', skill: s };
  }
  if (u.ai && BOSS[u.ai]) {
    const a = BOSS[u.ai](b, u);
    if (a) return a;
  }
  const def = ENEMIES[u.id];
  const allies = b.alive(1);
  const options = def.skills.filter(([id]) => {
    const s = SKILLS[id];
    if (!s) return false;
    if (s.kind === 'heal' && s.target !== 'self' && !allies.some(a => a.hp < a.maxHp * 0.6)) return false;
    if (s.kind === 'heal' && s.target === 'self' && u.hp > u.maxHp * 0.6) return false;
    if (s.kind === 'buff' && s.stage && u.stg[s.stage.stat] >= 2) return false;
    if (s.fx?.startsWith('summon:') && allies.length >= 4) return false;
    return true;
  });
  const pick = options.length ? b.rng.weighted(options, o => o[1])[0] : 'bite';
  return { t: 'skill', skill: pick };
}
