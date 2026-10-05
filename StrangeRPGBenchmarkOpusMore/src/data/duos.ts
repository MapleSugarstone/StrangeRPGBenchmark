import type { SkillDef } from '../battle/types';

interface Duo extends SkillDef { pair: [string, string]; }

const list: Duo[] = [
  { id: 'duo_hs', pair: ['hello', 'someday'], name: 'Long Haul', desc: 'Someday hooks it, Hello rings it. Edge.', cost: 4, tgt: 'foe', kind: 'phys', power: 2.4, elem: 'edge' },
  { id: 'duo_hb', pair: ['hello', 'bigger'], name: 'Fetch the Call', desc: 'Hello throws the receiver. Bigger brings it back through everything. Loud, every foe.', cost: 4, tgt: 'foes', kind: 'phys', power: 1.5, elem: 'loud' },
  { id: 'duo_sb', pair: ['someday', 'bigger'], name: 'Heel', desc: 'Someday whistles. Bigger lands on it. Blunt, big knock-back.', cost: 4, tgt: 'foe', kind: 'phys', power: 2.2, elem: 'blunt', push: 0.6 },
  { id: 'duo_ha', pair: ['hello', 'anyone'], name: 'Conference Call', desc: 'Everyone on the line at once. Heals the party a lot.', cost: 4, tgt: 'allies', heal: 1.3 },
  { id: 'duo_sa', pair: ['someday', 'anyone'], name: 'Wiretap', desc: 'Listens in, then cuts in. Spark, mutes.', cost: 4, tgt: 'foe', kind: 'wit', power: 1.7, elem: 'spark', status: { id: 'mute', turns: 3, chance: 0.9 } },
  { id: 'duo_ab', pair: ['anyone', 'bigger'], name: 'Busy Signal', desc: 'A bark down every line. Loud, slows every foe.', cost: 4, tgt: 'foes', kind: 'phys', power: 0.9, elem: 'loud', status: { id: 'slow', turns: 2, chance: 0.7 } },
  { id: 'duo_hg', pair: ['hello', 'again'], name: 'Callback', desc: 'The same call twice, the second one sooner. Chill, two hits.', cost: 4, tgt: 'foe', kind: 'wit', power: 1.25, elem: 'chill', hits: 2 },
  { id: 'duo_ag', pair: ['anyone', 'again'], name: 'Time Zone', desc: 'Moves the whole party an hour earlier. Everyone is quick.', cost: 4, tgt: 'allies', status: { id: 'haste', turns: 3 } },
  { id: 'duo_bg', pair: ['bigger', 'again'], name: 'Play Again', desc: 'Fetch, then fetch again. Blunt, two hits.', cost: 4, tgt: 'foe', kind: 'phys', power: 1.2, elem: 'blunt', hits: 2 },
  { id: 'duo_sg', pair: ['someday', 'again'], name: 'Old Times', desc: 'A story about the old days. The party mends.', cost: 4, tgt: 'allies', heal: 0.9, status: { id: 'regen', turns: 2 } },
  { id: 'duo_he', pair: ['hello', 'someone'], name: 'Prank Call', desc: 'A voice that is not quite anyone. Tangles every foe.', cost: 4, tgt: 'foes', status: { id: 'tangled', turns: 2, chance: 0.75 } },
  { id: 'duo_se', pair: ['someday', 'someone'], name: 'Two Faces', desc: 'Someday and someone who looks like Someday. Edge, two hits.', cost: 4, tgt: 'foe', kind: 'phys', power: 1.3, elem: 'edge', hits: 2 },
  { id: 'duo_be', pair: ['bigger', 'someone'], name: 'Fake Throw', desc: 'Someone Else pretends to throw. Bigger falls for it, right onto the foe. Blunt.', cost: 4, tgt: 'foe', kind: 'phys', power: 2.3, elem: 'blunt' },
  { id: 'duo_ae', pair: ['anyone', 'someone'], name: 'Wrong Number', desc: 'Anyone connects a foe to the wrong voice. Weakened and tangled.', cost: 4, tgt: 'foe', status: { id: 'weak', turns: 3 }, kind: 'wit', power: 1.2, elem: 'hush' },
  { id: 'duo_ge', pair: ['again', 'someone'], name: 'Who Was That', desc: 'Again keeps rewinding until nobody knows who was there. Hush, every foe.', cost: 4, tgt: 'foes', kind: 'wit', power: 1.0, elem: 'hush' },
  { id: 'duo_hboth', pair: ['hello', 'both'], name: 'Photo Op', desc: 'Everyone get in the picture. Edge, a sure crit.', cost: 4, tgt: 'foe', kind: 'phys', power: 2.0, elem: 'edge', crit: 1 },
  { id: 'duo_bboth', pair: ['bigger', 'both'], name: 'Dogpile', desc: 'Three heads, one pile. Blunt, every foe.', cost: 4, tgt: 'foes', kind: 'phys', power: 1.3, elem: 'blunt' },
  { id: 'duo_aboth', pair: ['anyone', 'both'], name: 'Tiebreaker', desc: 'Anyone rules it a tie. Both are quick and steady.', cost: 4, tgt: 'allies', status: { id: 'grdup', turns: 3 } },
  { id: 'duo_gboth', pair: ['again', 'both'], name: 'Best of Three', desc: 'Again lets them race it three times. Edge, three hits.', cost: 4, tgt: 'foe', kind: 'phys', power: 0.95, elem: 'edge', hits: 3 },
  { id: 'duo_eboth', pair: ['someone', 'both'], name: 'Third Head', desc: 'Someone Else wears a third head. Nobody can tell which to hit. Every foe tangled.', cost: 4, tgt: 'foes', status: { id: 'tangled', turns: 2, chance: 0.6 } },
  { id: 'duo_hl', pair: ['hello', 'lifeboat'], name: 'Mayday', desc: 'A call every rescuer hears. Heals and shields the party.', cost: 4, tgt: 'allies', heal: 1.2, status: { id: 'shield', turns: 2, pow: 30 } },
  { id: 'duo_bl', pair: ['bigger', 'lifeboat'], name: 'Tugboat', desc: 'Lifeboat tows Bigger at full speed into a foe. Blunt.', cost: 4, tgt: 'foe', kind: 'phys', power: 2.5, elem: 'blunt' },
  { id: 'duo_al', pair: ['anyone', 'lifeboat'], name: 'Distress Signal', desc: 'Every frequency at once. Spark, every foe.', cost: 4, tgt: 'foes', kind: 'wit', power: 1.3, elem: 'spark' },
  { id: 'duo_gl', pair: ['again', 'lifeboat'], name: 'Just in Time', desc: 'The rescue arrives before the trouble. The party dodges the next hit.', cost: 4, tgt: 'allies', status: { id: 'dejavu', turns: 3 } },
  { id: 'duo_el', pair: ['someone', 'lifeboat'], name: 'False Flag', desc: 'Someone Else waves the wrong flag. Weakens every foe.', cost: 4, tgt: 'foes', status: { id: 'weak', turns: 2, chance: 0.8 } },
  { id: 'duo_bothl', pair: ['both', 'lifeboat'], name: 'Launch', desc: 'Lifeboat fires Both at a foe. Both argue about who lands first. Edge.', cost: 4, tgt: 'foe', kind: 'phys', power: 2.4, elem: 'edge' },
];

const generic: SkillDef = { id: 'duo_generic', name: 'Together', desc: 'Two on one line, hitting as one.', cost: 3, tgt: 'foe', kind: 'phys', power: 1.9 };

export const DUOS: Record<string, SkillDef> = Object.fromEntries([...list, { ...generic }].map((d) => [d.id, d]));

export function duoFor(a: string, b: string): SkillDef {
  const d = list.find((x) => (x.pair[0] === a && x.pair[1] === b) || (x.pair[0] === b && x.pair[1] === a));
  return d ?? generic;
}
