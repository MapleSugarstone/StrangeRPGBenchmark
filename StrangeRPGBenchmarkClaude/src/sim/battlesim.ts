import { Battle, Action, Unit } from '../battle/engine';
import { partyUnit, enemyUnit, writeBack } from '../battle/units';
import { enemyAction } from '../battle/ai';
import { playerAction, Policy } from '../battle/policy';
import { GROUPS } from '../data/enemies';
import { SKILLS } from '../data/skills';
import type { GameState } from '../game/state';

export interface Outcome {
  result: 'win' | 'lose' | 'flee' | 'timeout';
  turns: number;
  partyTurns: number;
  minFrac: number;
  hpLost: number;
  inkUsed: number;
  actions: string[];
  clashes: number;
  breaks: number;
  damaging: number;
  deaths: number;
  battle: Battle;
}

export function actionLabel(a: Action, u: Unit): string {
  if (a.t === 'skill') return `${u.id}:${a.skill}`;
  if (a.t === 'item') return `item:${a.item}`;
  return `${u.id}:${a.t}`;
}

export interface SimOpts {
  survive?: number;
  greyField?: boolean;
  /** Writes HP, ink, gold, and items back into the state. */
  commit?: boolean;
}

export function simBattle(st: GameState, group: string, policy: Policy, seed: number, o: SimOpts = {}): Outcome {
  const grp = GROUPS[group];
  if (!grp) throw new Error('Unknown group ' + group);
  const party = st.party.map(id => partyUnit(st.members[id], st.mech));
  const enemies = grp.enemies.map(id => enemyUnit(id));
  const b = new Battle({
    party, enemies, mech: new Set(st.mech), seed, canFlee: false,
    gold: st.gold, items: { ...st.items }, makeEnemy: enemyUnit, greyField: o.greyField,
  });
  const hp0 = party.reduce((s, u) => s + u.hp, 0);
  const ink0 = party.reduce((s, u) => s + u.ink, 0);
  const maxHp = party.reduce((s, u) => s + u.maxHp, 0);
  const actions: string[] = [];
  let partyTurns = 0;
  let damaging = 0;
  let guard = 0;
  while (!b.result && guard++ < 800) {
    if (o.survive && partyTurns >= o.survive) { b.result = 'win'; break; }
    const { u, skip } = b.beginTurn();
    if (skip) continue;
    if (u.side === 0) {
      const a = playerAction(b, u, policy);
      actions.push(actionLabel(a, u));
      if (a.t === 'skill' && ['phys', 'mag'].includes(SKILLS[a.skill]?.kind)) damaging++;
      partyTurns++;
      b.act(u, a);
    } else {
      b.act(u, enemyAction(b, u));
    }
  }
  const hp1 = b.party.reduce((s, u) => s + Math.max(0, u.hp), 0);
  const ink1 = b.party.reduce((s, u) => s + u.ink, 0);
  if (o.commit) {
    writeBack(b.units, st.members);
    st.gold = Math.max(0, b.gold);
    st.items = Object.fromEntries(Object.entries(b.items).filter(([, n]) => n > 0));
  }
  return {
    result: b.result ?? 'timeout',
    turns: b.turn,
    partyTurns,
    minFrac: b.stats.minPartyFrac,
    hpLost: Math.max(0, hp0 - hp1) / Math.max(1, maxHp),
    inkUsed: Math.max(0, ink0 - ink1) / Math.max(1, party.reduce((s, u) => s + u.maxInk, 0)),
    actions,
    clashes: b.stats.clashes,
    breaks: b.stats.breaks,
    damaging,
    deaths: b.party.filter(u => !u.alive).length,
    battle: b,
  };
}
