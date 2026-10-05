import type { Battle } from './engine';
import type { Action, Unit } from './types';

type AI = (b: Battle, u: Unit) => Action | null;

function once(b: Battle, u: Unit, key: string): boolean {
  const k = key + u.uid;
  if (b.extra[k]) return false;
  b.extra[k] = 1;
  return true;
}

export const BOSS_AI: Record<string, AI> = {
  want(b, u) {
    const t = u.turns ?? 0;
    if (u.hp < u.mhp * 0.5 && once(b, u, 'wantsum')) return { t: 'skill', skill: 'e_summon_slipmite', target: u.uid };
    if (t % 4 === 3) return b.windup(u, 'e_inhale', ['loud'], 2, 'The Want draws a long breath. Make some noise to choke it!');
    return null;
  },
  supervisor(b, u) {
    const t = u.turns ?? 0;
    if (u.hp < u.mhp * 0.6 && once(b, u, 'supsum')) return { t: 'skill', skill: 'e_summon_holdsaint', target: u.uid };
    if (t % 4 === 2) return b.windup(u, 'e_fileall', ['loud', 'edge'], 3, 'The Supervisor reaches for every switch at once. Interrupt it with loud or edge hits!');
    return null;
  },
  bedtime(b, u) {
    const t = u.turns ?? 0;
    if (u.hp < u.mhp * 0.5 && once(b, u, 'bedsum')) return { t: 'skill', skill: 'e_summon_fivemore', target: u.uid };
    if (t % 4 === 3) return b.windup(u, 'e_storytime', ['loud'], 2, 'Bedtime opens a very large book. Wake everyone up with loud hits before it starts reading!');
    return null;
  },
  house(b, u) {
    const t = u.turns ?? 0;
    if (t % 3 === 2) {
      const kinds: Record<string, number> = {};
      const users: Record<number, number> = {};
      for (const r of b.trace) {
        if (r.side !== 0) continue;
        const k = r.act === 'attack' || r.act === 'guard' || r.act === 'answer' ? r.act : 'skill';
        kinds[k] = (kinds[k] ?? 0) + 1;
        if (k === 'skill') users[r.uid] = (users[r.uid] ?? 0) + 1;
      }
      const top = Object.entries(kinds).sort((a, z) => z[1] - a[1])[0]?.[0];
      if (top === 'attack') return { t: 'skill', skill: 'e_tell_attack', target: u.uid };
      if (top === 'guard') return { t: 'skill', skill: 'e_tell_guard', target: u.uid };
      if (top === 'skill') {
        const uid = Number(Object.entries(users).sort((a, z) => z[1] - a[1])[0]?.[0] ?? 0);
        const target = b.party().find((p) => p.uid === uid) ?? b.party()[0];
        if (target) return { t: 'skill', skill: 'e_tell_skill', target: target.uid };
      }
    }
    if (t % 5 === 4) return b.windup(u, 'e_jackpot', ['spark', 'edge'], 3, 'The House pulls its own lever. Break it with spark or edge hits!');
    return null;
  },
  hush(b, u) {
    const t = u.turns ?? 0;
    if (u.hp < u.mhp * 0.5 && once(b, u, 'crack')) {
      b.mech.delete('hush');
      u.weak = ['loud', 'edge'];
      u.resist = ['hush'];
      return { t: 'skill', skill: 'e_crack', target: u.uid };
    }
    if (t % 3 === 2) return b.windup(u, 'e_silence', ['edge', 'blunt'], 3, 'The Hush spreads its wings over everything. Strike it with edge or blunt before it smothers you!');
    return null;
  },
  sincerely(b, u) {
    const t = u.turns ?? 0;
    if (t === 1) return { t: 'skill', skill: 'e_shield', target: u.uid };
    if (t % 5 === 3) return b.windup(u, 'e_sealed', ['edge'], 3, 'Sincerely folds itself around all of you. Cut the envelope open with edge hits!');
    if (t % 4 === 2) {
      const target = [...b.party()].filter((p) => !b.has(p, 'return')).sort((a, z) => z.hp - a.hp)[0];
      if (target) return { t: 'skill', skill: 'e_returnto', target: target.uid };
    }
    return null;
  },
  deadletter(b, u) {
    const t = u.turns ?? 0;
    if (t % 4 === 1 && b.foes().length < 3) return { t: 'skill', skill: 'e_summon_castaway', target: u.uid };
    if (t % 4 === 3) return b.windup(u, 'e_massreturn', ['spark', 'loud'], 3, 'Dead Letter rises up to send everyone back to sender at once. Break it with spark or loud hits!');
    if (t % 5 === 2) {
      const target = [...b.party()].filter((p) => !b.has(p, 'return')).sort((a, z) => z.hp - a.hp)[0];
      if (target) return { t: 'skill', skill: 'e_returnto', target: target.uid };
    }
    return null;
  },
  amen1(b, u) {
    const t = u.turns ?? 0;
    if (u.hp < u.mhp * 0.3) {
      const h = b.party().find((p) => p.id === 'hello');
      if (h) return { t: 'skill', skill: 'e_returnhello', target: h.uid };
    }
    if (u.hp < u.mhp * 0.65 && once(b, u, 'amenhold')) return { t: 'skill', skill: 'e_holdall', target: u.uid };
    if (u.hp < u.mhp * 0.65 && once(b, u, 'amensum')) return { t: 'skill', skill: 'e_summon_choir', target: u.uid };
    if (t % 4 === 3) return b.windup(u, 'e_lastword', ['loud'], 3, 'Amen begins to say the last word. Interrupt it with loud hits!');
    if (t % 3 === 1) {
      const target = [...b.party()].filter((p) => !b.has(p, 'return')).sort((a, z) => z.hp - a.hp)[0];
      if (target) return { t: 'skill', skill: 'e_returnto', target: target.uid };
    }
    return null;
  },
  amen2(b, u) {
    b.extra.finalPhase = 1;
    const t = u.turns ?? 0;
    if (t % 4 === 2) return b.windup(u, 'e_lastword', ['loud', 'spark'], 3, 'Amen gathers itself to say the last word, one more time. Interrupt it!');
    if (t % 3 === 0) {
      const target = [...b.party()].filter((p) => !b.has(p, 'return')).sort((a, z) => z.hp - a.hp)[0];
      if (target) return { t: 'skill', skill: 'e_returnto', target: target.uid };
    }
    return null;
  },
  bigger(b, u) {
    const t = u.turns ?? 0;
    if (t % 3 === 0) return b.windup(u, 'e_bigbark', ['blunt', 'hush'], 2, 'Bigger fills his lungs. Bonk him on the nose to stop it!');
    return null;
  },
};
