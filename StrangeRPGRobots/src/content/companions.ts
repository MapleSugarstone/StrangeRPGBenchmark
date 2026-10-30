// Companions: how each one is built when they join. They join at the hero's level.
import { makeMember } from '../rules/stats';
import type { Member } from '../game/state';
import { LOOKS } from '../art/cast';

export interface CompanionDef { id: string; name: string; cls: Member['cls']; look: string; gear?: Partial<Member['gear']>; attr?: Partial<Member['attr']>; mood?: Member['mood'] }

export const COMPANIONS: Record<string, CompanionDef> = {
  courtesy: { id: 'courtesy', name: 'Courtesy', cls: 'unit', look: 'courtesy', gear: { melee: 'baton', armor: 'plating' } },
  sallis: { id: 'sallis', name: 'Sallis', cls: 'rigger', look: 'sallis', gear: { melee: 'knife', ranged: 'smg', armor: 'flight', chrome: ['controljack'] } },
  quaye: { id: 'quaye', name: 'Quaye', cls: 'diver', look: 'quaye', gear: { melee: 'knuckles', ranged: 'pistol', armor: 'coat', chrome: ['deck', 'ramcore'] } },
  ambrose: { id: 'ambrose', name: 'Ambrose', cls: 'blade', look: 'ambrose', gear: { melee: 'sledge', ranged: 'revolver', armor: 'jacket', chrome: ['gripper', 'optic'] } },
  tova: { id: 'tova', name: 'Tova', cls: 'witch', look: 'tova', gear: { melee: 'knife', ranged: 'slingshot', armor: 'poncho', chrome: [] }, mood: 'calm' },
  ignace: { id: 'ignace', name: 'Ignace', cls: 'mouth', look: 'ignace', gear: { melee: 'knuckles', ranged: 'revolver', armor: 'coat', chrome: ['voicebox'] } },
};

export function buildCompanion(id: string, level: number): Member {
  const d = COMPANIONS[id];
  const m = makeMember(id, d.name, d.cls, level);
  if (d.gear) m.gear = { ...m.gear, ...d.gear, chrome: d.gear.chrome ?? m.gear.chrome };
  if (d.attr) Object.assign(m.attr, d.attr);
  if (d.mood) m.mood = d.mood;
  if (LOOKS[d.look]) m.look = LOOKS[d.look];
  return m;
}
