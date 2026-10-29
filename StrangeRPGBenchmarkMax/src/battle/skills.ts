// Every battle skill. Descriptions are plain sentences a young reader can follow.
import type { Status } from './types';

export type Shape = 'reach' | 'line' | 'spread' | 'pounce' | 'burst';

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  /**
   * lead: goes along the user's lead. upsun: goes along the lead the other way, toward the light.
   * touch: one tile next to the user. any: any of eight ways, never shown ahead.
   * place: a tile within range. ally: a friend within range. foe: a foe within range. self: the user.
   */
  kind: 'lead' | 'upsun' | 'touch' | 'any' | 'place' | 'ally' | 'foe' | 'self';
  shape?: Shape;
  power?: number;
  range?: number;
  /** Lead skills reach at least this far even when the lead is shorter. */
  minLen?: number;
  status?: { s: keyof Status; turns: number };
  /** Nodus can write this one down and use it. */
  entry?: boolean;
  heal?: number;
}

const S = (d: SkillDef) => d;

export const SKILLS: Record<string, SkillDef> = {
  touch: S({ id: 'touch', name: 'Touch', desc: 'Hit one tile next to you for 1. Weak, but it needs no lead.', icon: 'touch', kind: 'touch', power: 1 }),
  rule: S({ id: 'rule', name: 'Rule', desc: 'Hit every tile along your lead.', icon: 'line', kind: 'lead', shape: 'line', power: 3 }),
  double_rule: S({ id: 'double_rule', name: 'Double Rule', desc: 'Hit every tile along your lead, harder.', icon: 'line', kind: 'lead', shape: 'line', power: 5 }),
  margin: S({ id: 'margin', name: 'Margin', desc: 'Hit the end of your lead and both sides of it. Pins them for a round.', icon: 'spread', kind: 'lead', shape: 'spread', power: 2, status: { s: 'pinned', turns: 1 } }),
  note: S({ id: 'note', name: 'Note', desc: "Mark a foe's next attack. If it hits another foe, write it down to use.", icon: 'note', kind: 'foe', range: 9 }),
  raise: S({ id: 'raise', name: 'Raise lamp', desc: 'Set the lamp down within 3 tiles. Leads near it point away from it.', icon: 'lamp', kind: 'place', range: 3 }),
  hood: S({ id: 'hood', name: 'Hood lamp', desc: 'Cover the lamp. Leads go back to the sun.', icon: 'lamp', kind: 'self' }),
  warm: S({ id: 'warm', name: 'Warm', desc: 'Heal someone next to you by 4.', icon: 'heart', kind: 'ally', range: 1, heal: 4 }),
  flare: S({ id: 'flare', name: 'Flare', desc: 'Foes near the lamp lose their leads for a round.', icon: 'dazzled', kind: 'self' }),
  tug: S({ id: 'tug', name: 'Tug', desc: "Drag a foe's next attack one tile. Lot must stand in shade.", icon: 'tug', kind: 'foe', range: 4 }),
  drag: S({ id: 'drag', name: 'Drag', desc: "Drag a foe's next attack two tiles.", icon: 'tug', kind: 'foe', range: 4 }),
  stab: S({ id: 'stab', name: 'Stab', desc: "Hit a foe through its own lead. Stand in its lead or next to it.", icon: 'stab', kind: 'foe', range: 9, power: 3 }),
  slip: S({ id: 'slip', name: 'Slip', desc: 'Jump to any shade within 6 tiles.', icon: 'slip', kind: 'place', range: 6 }),
  shade: S({ id: 'shade', name: 'Shade', desc: 'Raise the foot over a 3 by 3 patch. Leads that fall in it stop there.', icon: 'shade', kind: 'place', range: 1 }),
  great_shade: S({ id: 'great_shade', name: 'Great Shade', desc: 'A 3 by 3 patch of shade that lasts two rounds.', icon: 'shade', kind: 'place', range: 1 }),
  stomp: S({ id: 'stomp', name: 'Stomp', desc: 'Hit one tile next to you, hard.', icon: 'touch', kind: 'touch', power: 3 }),
  glint: S({ id: 'glint', name: 'Glint', desc: 'Hit every tile along your lead. Minim is tall, so it reaches far.', icon: 'line', kind: 'lead', shape: 'line', power: 3 }),
  pane: S({ id: 'pane', name: 'Pane', desc: 'Set a pane within 2 tiles. An attack that touches it comes back out of it next round.', icon: 'pane', kind: 'place', range: 2 }),
  recall: S({ id: 'recall', name: 'Recall', desc: "Put a friend's HP back to what it was at the start of last round.", icon: 'heart', kind: 'ally', range: 3 }),
  mirror_rule: S({ id: 'mirror_rule', name: 'Mirror Rule', desc: 'Hit along your lead and leave a pane at its end.', icon: 'pane', kind: 'lead', shape: 'line', power: 3 }),
  nip: S({ id: 'nip', name: 'Nip', desc: 'Hit next to you, any way. Never shown ahead, never turned.', icon: 'unled', kind: 'any', shape: 'reach', power: 3, range: 1 }),
  sling: S({ id: 'sling', name: 'Sling', desc: 'Hit a line two tiles long, any way.', icon: 'unled', kind: 'any', shape: 'line', power: 2, range: 2 }),
  listen: S({ id: 'listen', name: 'Listen', desc: 'Hear foes within 3. Their plans show for two rounds.', icon: 'listen', kind: 'self' }),
  snuff: S({ id: 'snuff', name: 'Snuff', desc: 'Put out a light within 3 tiles for two rounds.', icon: 'lamp', kind: 'place', range: 3 }),
  quiet_step: S({ id: 'quiet_step', name: 'Quiet Bite', desc: 'Hit two tiles away, any way, hard.', icon: 'unled', kind: 'any', shape: 'reach', power: 4, range: 2 }),
  license: S({ id: 'license', name: 'License', desc: 'Heal the party by 2 and clear their statuses.', icon: 'heart', kind: 'self', heal: 2 }),
  bolt: S({ id: 'bolt', name: 'Bolt', desc: 'Hit every tile along the lead.', icon: 'line', kind: 'lead', shape: 'line', power: 2, entry: true }),
  // Foe skills. Those marked entry can be written in the Ledger.
  toss: S({ id: 'toss', name: 'Toss', desc: 'Throw a stone to the end of the lead.', icon: 'reach', kind: 'lead', shape: 'reach', power: 2, entry: true }),
  pounce: S({ id: 'pounce', name: 'Pounce', desc: 'Run down the lead and bite what is at the end.', icon: 'pounce', kind: 'lead', shape: 'pounce', power: 3, entry: true }),
  claw: S({ id: 'claw', name: 'Claw', desc: 'A hit on the tile next to it, any way.', icon: 'touch', kind: 'touch', power: 2 }),
  nibble: S({ id: 'nibble', name: 'Nibble', desc: 'A small bite next to it.', icon: 'touch', kind: 'touch', power: 1 }),
  pinch: S({ id: 'pinch', name: 'Pinch', desc: 'Pinch the end of the lead and both sides.', icon: 'spread', kind: 'lead', shape: 'spread', power: 2, entry: true }),
  rule9: S({ id: 'rule9', name: 'Rule Nine', desc: 'A line of lantern light along the lead.', icon: 'line', kind: 'lead', shape: 'line', power: 3 }),
  citation: S({ id: 'citation', name: 'Citation', desc: 'Pins what is at the end of the lead.', icon: 'pinned', kind: 'lead', shape: 'reach', power: 1, status: { s: 'pinned', turns: 1 }, entry: true }),
  snatch: S({ id: 'snatch', name: 'Snatch', desc: 'Grab next to it and take a few mites.', icon: 'mites', kind: 'touch', power: 2 }),
  daub: S({ id: 'daub', name: 'Daub', desc: 'Splash ink on the end of the lead.', icon: 'reach', kind: 'lead', shape: 'reach', power: 2, minLen: 1, entry: true }),
  douse: S({ id: 'douse', name: 'Douse', desc: 'Hood a lamp within 3 tiles.', icon: 'hooded', kind: 'self' }),
  brushstroke: S({ id: 'brushstroke', name: 'Brushstroke', desc: 'A line of paint along the lead.', icon: 'line', kind: 'lead', shape: 'line', power: 3, entry: true }),
  splatter: S({ id: 'splatter', name: 'Splatter', desc: 'Paint the end of the lead and every tile around it.', icon: 'burst', kind: 'lead', shape: 'burst', power: 2, entry: true }),
  glare: S({ id: 'glare', name: 'Glare', desc: 'Spit glare toward the light, the wrong way down the lead.', icon: 'line', kind: 'upsun', shape: 'line', power: 3, minLen: 2, entry: true }),
  bite: S({ id: 'bite', name: 'Bite', desc: 'Bite next to it.', icon: 'touch', kind: 'touch', power: 2 }),
  scorch: S({ id: 'scorch', name: 'Scorch', desc: 'Burn the end of the lead and every tile around it.', icon: 'burst', kind: 'lead', shape: 'burst', power: 2, minLen: 1, entry: true }),
  stride: S({ id: 'stride', name: 'Stride', desc: 'A long step that hits every tile along the lead.', icon: 'line', kind: 'lead', shape: 'line', power: 4 }),
  glare_beam: S({ id: 'glare_beam', name: 'Glare Beam', desc: 'A long beam toward the brightest light.', icon: 'line', kind: 'upsun', shape: 'line', power: 4, minLen: 4 }),
  seed: S({ id: 'seed', name: 'Seed', desc: 'Spit a seed to the end of the lead.', icon: 'reach', kind: 'lead', shape: 'reach', power: 2, minLen: 2, entry: true }),
  shard: S({ id: 'shard', name: 'Shard', desc: 'Throw a glass shard to the end of the lead.', icon: 'reach', kind: 'lead', shape: 'reach', power: 3, minLen: 1, entry: true }),
  panelash: S({ id: 'panelash', name: 'Panelash', desc: 'Lash the end of the lead and both sides with glass.', icon: 'spread', kind: 'lead', shape: 'spread', power: 3, minLen: 1, entry: true }),
  dice: S({ id: 'dice', name: 'Dice', desc: 'Hit next to it, any way, for 1 to 4.', icon: 'unled', kind: 'any', shape: 'reach', power: 2, range: 1 }),
  dive: S({ id: 'dive', name: 'Dive', desc: 'Drop on something two tiles away, any way.', icon: 'pounce', kind: 'any', shape: 'reach', power: 3, range: 2 }),
  first_light: S({ id: 'first_light', name: 'First Light', desc: 'A line of mirror light along the lead.', icon: 'line', kind: 'lead', shape: 'line', power: 4, minLen: 3, entry: true }),
  put_out: S({ id: 'put_out', name: 'Put Out', desc: 'Hoods the nearest lamp.', icon: 'hooded', kind: 'self' }),
  grab: S({ id: 'grab', name: 'Grab', desc: 'Grabs whoever moved last, if they are close.', icon: 'touch', kind: 'touch', power: 3 }),
  sip: S({ id: 'sip', name: 'Sip', desc: 'Drinks some light. The lamp shrinks.', icon: 'lamp', kind: 'self' }),
  chomp: S({ id: 'chomp', name: 'Chomp', desc: 'Eats a light within 3, or bites everything around it.', icon: 'burst', kind: 'self', power: 3 }),
  lunge: S({ id: 'lunge', name: 'Lunge', desc: 'Runs down the lead and hits hard at the end.', icon: 'pounce', kind: 'lead', shape: 'pounce', power: 4, minLen: 2, entry: true }),
  smear: S({ id: 'smear', name: 'Smear', desc: 'Smears paint on the tile next to it.', icon: 'touch', kind: 'touch', power: 2 }),
  flare_beam: S({ id: 'flare_beam', name: 'Flare', desc: 'Burns 3 and 6 tiles down the beam, all around them.', icon: 'burst', kind: 'lead', shape: 'burst', power: 3, minLen: 2 }),
  order: S({ id: 'order', name: 'Order', desc: 'Hoods a lamp-bearer for two rounds.', icon: 'hooded', kind: 'foe', range: 9, status: { s: 'hooded', turns: 2 } }),
  steal_lead: S({ id: 'steal_lead', name: 'Take Lead', desc: 'Hits the end of the lead and everything around it, and takes their leads.', icon: 'burst', kind: 'lead', shape: 'burst', power: 3, minLen: 2, status: { s: 'dazzled', turns: 1 } }),
  wait: S({ id: 'wait', name: 'Wait', desc: 'Do nothing this round.', icon: 'cross', kind: 'self' }),
};

/** A recorded attack used by Nodus. Same shape, Nodus's own strength. */
export function entrySkill(id: string): SkillDef | undefined {
  const s = SKILLS[id];
  return s && s.entry ? s : undefined;
}
