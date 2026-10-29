// Builds foe units from their sheets. Both battle setup and the rules (for reinforcements) use it.
import type { Unit } from './types';
import { FOES } from '../content/foes';

/** Every foe that moves can also hit the tile next to it, so foes threaten from any side. */
function withMelee(skills: string[], hp: number, still?: boolean): string[] {
  const out = skills.slice();
  if (still || !skills.length) return out;
  if (!out.some((s) => ['nibble', 'bite', 'claw', 'snatch', 'grab', 'smear', 'nip'].includes(s))) out.push(hp >= 8 ? 'claw' : 'nibble');
  return out;
}

export function foeUnit(id: string, uid: number, order: number, difficulty: number): Unit {
  const d = FOES[id];
  const hpMul = (difficulty === 1 ? 1.25 : difficulty === 2 ? 0.7 : 1) * (d.boss ? 1 : 0.85);
  const hp = Math.max(1, Math.round(d.hp * hpMul));
  return {
    uid, id, side: 'foe', name: d.name, x: 0, y: 0, hp, maxHp: hp, pow: d.pow + (difficulty === 1 && d.boss ? 1 : 0), guard: d.guard, move: d.move, height: d.height,
    skills: withMelee(d.skills, d.hp, d.still), status: {}, queue: [], fakes: [], acted: false, moved: false, startX: 0, startY: 0, alive: true, order, ai: d.ai ?? 'wild',
    xp: d.xp, mites: d.mites, hpHistory: [], lantern: d.lantern ? { r: d.lantern, lowness: 2, off: 0 } : undefined, unled: d.unled, boss: d.boss,
    mirage: d.mirage ? [1, 0] : undefined, shield: d.shield, heliotrope: d.heliotrope, slow: d.slow, lateCopy: d.lateRepeat, darkOnly: d.darkOnly, hat: d.hat, painter: d.painter,
  };
}
