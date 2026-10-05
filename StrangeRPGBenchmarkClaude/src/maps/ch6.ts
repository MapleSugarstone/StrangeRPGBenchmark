import type { MapDef } from '../game/world';
import type { Ctx, Script } from '../game/script';
import type { ChapterDef } from './index';
import { NPC } from '../data/portraits';
import { nextChapter } from './common';
import { Grid } from './grid';

const f = (s: Ctx, k: string) => s.has(k);

function buildSea(): string[] {
  const g = new Grid(48, 44, 'K');
  g.scatter(0, 0, 48, 44, 'Z', 0.03, 81, 'K');
  g.rect(23, 8, 2, 27, '/');
  // Cloudharbor dock at the bottom.
  g.rect(14, 35, 20, 6, '-');
  g.rect(16, 41, 16, 2, '-');
  g.put(21, 35, 'R').put(26, 35, 'R');
  // Vine island, west.
  g.ellipse(9, 25, 6.5, 4.5, ',');
  g.scatter(3, 20, 13, 10, 'T', 0.15, 82, ',');
  // Campfire island, east.
  g.ellipse(38, 25, 5.5, 3.5, '.');
  g.scatter(33, 22, 11, 7, '"', 0.2, 83, '.');
  // Pirate nest, northwest.
  g.ellipse(11, 11, 6.5, 4.5, '-');
  g.rect(8, 8, 3, 1, '^').rect(8, 9, 3, 1, 'B');
  g.rect(13, 8, 3, 1, '^').rect(13, 9, 3, 1, 'B');
  // The Needle platform at the top and the storm ring around its approach.
  g.rect(15, 1, 18, 6, 'O');
  g.rect(15, 7, 18, 1, 'Z');
  g.rect(14, 1, 1, 7, 'Z').rect(33, 1, 1, 7, 'Z');
  g.put(30, 7, 'w');
  g.put(24, 1, 'n').put(24, 3, 'o').put(24, 5, 'b');
  // Markers.
  g.put(24, 38, 's').put(24, 36, 'r').put(19, 38, 'm').put(28, 38, 'a').put(17, 40, 'f').put(30, 40, 'l');
  g.put(38, 25, 'c').put(36, 24, 'q').put(41, 26, 'k');
  g.put(6, 24, 'v').put(12, 27, 'x');
  g.put(11, 12, 'p').put(9, 13, 'y');
  g.put(20, 4, 'j');
  return g.rows();
}

const intro: Script = async s => {
  await s.tell('The lift car climbs the Tether for an hour, then two. Below, the world shrinks into a square of colored tiles. Above, the clouds get thicker and stop moving.');
  await s.say('Tint', 'You can see Prismouth from here. It looks like a crumb.');
  await s.say('VEND', 'YOU CAN SEE THE UNDERMARKET. IT LOOKS LIKE A HOLE. IT IS A HOLE.');
  await s.say('Nona', 'I have seen the world from the Loom a thousand times. I have never seen it get bigger on the way down, or smaller on the way up. It is different from inside a window.');
  s.shake(40);
  s.sfx('crit');
  await s.flash('w');
  await s.tell('Something bangs against the roof. The cable brake screams. The car shudders to a stop against a wooden dock floating in the clouds.');
  await s.say('Lift Attendant', 'Everybody out! Everybody OUT. Somebody cut the upper cable. Grey robes, grey rope. Very tidy work.');
  await s.say('Brask', 'The Choir. They knew we were coming.');
};

const mirrowTalk: Script = async s => {
  if (f(s, 'mirrowJoined')) return;
  await s.tell('At the end of the dock, a small boat bobs on the clouds. Standing in it is an oval mirror on two thin legs. In the glass, instead of the party, there is a sky with no clouds in it.');
  await s.say('Tint', 'We need a boat.');
  await s.say('Mirrow', '...need a boat. I have a boat. I am Mirrow. I used to be a reflection. Then the person I was reflecting walked away, and I didn\'t.');
  await s.say('Wick', 'You can sail on clouds?');
  await s.say('Mirrow', '...sail on clouds. Everything can sail on clouds if it is light enough. I am very light. I am mostly the idea of a person.');
  await s.say('Mirrow', 'The currents go up in a spiral around the Tether, all the way to the Needle, where the Loom\'s gate is. I will take you. I want to see what the Loom looks like in me.');
  s.flag('mirrowJoined');
  s.flag('skiff');
  s.mech('mirror');
  await s.join('mirrow', Math.max(21, s.st.members.wick.lvl));
  await s.tell('^yMirrow^0\'s ^yReflect^0 repeats the last action anyone took, friend or foe, as Mirrow\'s own. Copying a boss\'s best attack back at it is the whole point.');
  await s.tell('You can now sail the ^ycloud sea^0. Walk off the dock onto the clouds.');
};

const campfire: Script = async s => {
  if (f(s, 'night')) { await s.tell('The fire has burned down to a glow. Past the storm ring, the north current is running.'); return; }
  s.music('sad');
  await s.tell('They make camp on the little island and build a fire out of a crate VEND insists he bought fairly. Night comes up the Tether like a tide.');
  await s.say('Tint', 'When this is over I\'m going to relight my lighthouse. I don\'t know how yet. I\'ll paint the Lens back together if I have to.');
  await s.say('Brask', 'We wanted to know where the color goes. Now we know. It goes up. We would like to go and ask for it back.');
  await s.say('VEND', 'I HAVE BOUGHT EVERYTHING I HAVE EVER HAD. ONCE, I WOULD LIKE TO BE GIVEN SOMETHING. FOR FREE. I DO NOT KNOW WHAT.');
  if (s.inParty('tock')) await s.say('Tock', 'I\'d like to be surprised. It hasn\'t happened in a very long time. I remember all of this. Well. Almost all of it.');
  await s.say('Nona', 'I want to fix the Loom. It is my job. It has been my job for nine hundred years. I would like to finish one job before...');
  await s.tell('Nona does not finish the sentence. Tock looks into the fire.');
  await s.say('Mirrow', '...before. What do you want, Wick?');
  await s.say('Wick', 'I used to want a hue. Now I just want to take Gran\'s color home.');
  await s.tell('Nobody says anything for a while. It is a comfortable nothing.');
  await s.say('Brask', 'We have fought beside each other long enough that our hands know each other. Next time, strike together.');
  s.mech('link');
  s.flag('night');
  s.heal();
  await s.tell('^yLink^0: the link gauge fills when you hit weaknesses and break shells. When it is full, choose ^yLink^0 in battle. Two allies strike every foe together.');
  await s.tell('Far to the north, past the storm ring, the clouds part. The current to the Needle is running.');
  s.music('sky');
};

const seraphFight: Script = async s => {
  if (f(s, 'seraphDead')) return;
  s.music('boss');
  await s.tell('The Needle is a platform of white metal at the top of the Tether. At its center is a gate shaped like the eye of a sewing needle, and in front of the gate hangs a machine with six wings and a ring of light for a head.');
  await s.say('Seraph K-7', 'HALT. THE LOOM IS CLOSED FOR RECLAMATION. ALL COLORS WILL BE COLLECTED. PLEASE HOLD STILL FOR COLLECTION.');
  await s.say('Mirrow', '...hold still. When its halo locks on, let it fire. Then show it its own beam. I have been waiting my whole life to reflect something this bright.');
  const r = await s.battle('boss6');
  if (r !== 'win') return;
  s.flag('seraphDead');
  s.shake(30);
  await s.tell('The Seraph folds its wings and drops off the edge of the Needle into the clouds. Behind it, the gate begins to close, very slowly, like an eye falling asleep.');
  await s.say('Nona', 'The gate is on a timer. If it shuts, it will not open again for a hundred years.');
  await s.tell('The skiff, battered by the fight, cracks down the middle and sinks into the clouds.');
  await s.say('Mirrow', '...a hundred years. I will hold it.');
  await s.tell('Mirrow walks to the gate and turns sideways, and the gate closes on the mirror\'s edge, and stops. The glass creaks.');
  await s.say('Tint', 'Mirrow, you\'ll crack!');
  await s.say('Mirrow', '...crack. I am a mirror. Cracking is what we do instead of being afraid. Go. I will be here when you come back out. I will be reflecting the door.');
  s.leave('mirrow');
  s.flag('skiff', false);
  await s.tell('One by one, they squeeze through the gap. Wick goes last, and looks back.');
  await s.say('Wick', 'Everyone keeps looking at me to decide what\'s next.');
  await s.say('Brask', 'Yes. You carry the lamp.');
  await s.say('Wick', '...Then we go in. All of us that\'s left.');
  await nextChapter(s, 7);
};

const sea: MapDef = {
  id: 'cloudsea', name: 'The Cloud Sea', music: 'sky', rows: buildSea(), under: '-', outside: 'K', bg: 'cloud',
  legend: {
    K: { kind: 'cloud', sea: true, solid: true, enc: true },
    Z: { kind: 'deep', solid: true },
  },
  theme: {
    cloud: ['k', 'b3', 'w'], deep: ['k', 'b1', 'g2'], thread: ['k', 'e1', 'y2'], planks: ['k', 'n1', 'n2'], rock: ['k', 'g1', 'g2'],
    tall: ['k', 'e1', 'e2'], tree: ['k', 'e1', 'e3'], ground: ['k', 'e1', 'e2'], flowers: ['k', 'e1', 'm3'], grate: ['k', 'g2', 'w'],
    roof: ['k', 'r1', 'r2'], brick: ['k', 'n1', 'n2'],
  },
  enc: { rate: 0.15, groups: [['kite2', 3], ['whale', 2], ['vine2', 2], ['jelly3', 2], ['pirate', 2]] },
  ents: [
    { id: 'wreck', at: 'r', kind: 'prop', spr: NPC.wreck, talk: async s => s.tell('The lift car, stuck against the dock. Its upper cable has been cut clean through.') },
    { id: 'mirrow', at: 'm', kind: 'npc', spr: NPC.mirrow, when: st => !st.flags.mirrowJoined, talk: mirrowTalk },
    { id: 'attendant', at: 'a', kind: 'npc', spr: NPC.attendant, talk: async s => {
      await s.say('Lift Attendant', 'Cloudharbor, halfway up. We sell rope, rope, and a different kind of rope. Also regular goods.');
      await s.shop('tether');
    } },
    { id: 'fisher', at: 'f', kind: 'npc', spr: NPC.fisher, talk: async s => s.say('Cloud Fisher', 'I fish for weather. Caught a small drizzle this morning. Threw it back. It had a family.') },
    { id: 'lamp', at: 'l', kind: 'lamp' },
    { id: 'campfire', at: 'c', kind: 'prop', spr: NPC.campfire, talk: campfire },
    { id: 'lamp2', at: 'k', kind: 'lamp' },
    { id: 'chestQ', at: 'q', kind: 'chest', item: 'honey', n: 2 },
    { id: 'chestV', at: 'v', kind: 'chest', item: 'spool_charm' },
    { id: 'chestX', at: 'x', kind: 'chest', item: 'ink_well', n: 2 },
    { id: 'captain', at: 'p', kind: 'npc', spr: NPC.pirateCaptain, when: st => !st.flags.pirates, talk: async s => {
      await s.say('Captain Gale', 'Ahoy, grounders! This is a pirate nest. We plunder clouds for their silver linings. Hand over your linings, or your lunches.');
      if (await s.ask('Fight the pirates?', ['Fight', 'Sail away']) !== 0) return;
      const r = await s.battle('crew');
      if (r !== 'win') return;
      s.flag('pirates');
      await s.say('Captain Gale', 'Fine! FINE. Take the loot. We were going to retire anyway. Somewhere with ground.');
      await s.give('red_pane');
      await s.gold(400);
    } },
    { id: 'chestY', at: 'y', kind: 'chest', item: 'relight', n: 2 },
    { id: 'storm', at: 'w', kind: 'prop', spr: NPC.storm, when: st => !st.flags.night, talk: async s => s.tell('A knot of storm cloud blocks the north current. The fisher said the currents change at night.') },
    { id: 'gate', at: 'n', kind: 'prop', spr: NPC.needleGate, talk: async s => s.tell('The gate of the Loom. It is shaped like the eye of a needle and is taller than the lighthouse at Prismouth.') },
    { id: 'seraph', at: 'o', kind: 'npc', spr: NPC.seraph, when: st => !st.flags.seraphDead, talk: seraphFight },
    { id: 'boss', at: 'b', kind: 'trigger', step: seraphFight, under: 'O' },
    { id: 'chestJ', at: 'j', kind: 'chest', item: 'chorus' },
  ],
};

export const maps: MapDef[] = [sea];

export const chapter: ChapterDef = {
  title: 'The Tether',
  stage: 'Approach to the inmost cave',
  blurb: 'A lift up a thread through the clouds. Then no lift.',
  recruit: 'mirrow',
  ready: true,
  startMap: 'cloudsea',
  startMarker: 's',
  intro,
  objective: st => {
    const fl = st.flags;
    if (!fl.mirrowJoined) return 'Find a way off the Cloudharbor dock.';
    if (!fl.night) return 'Sail the cloud sea. The current north is blocked by storm until night. Make camp on the east island.';
    if (!fl.seraphDead) return 'Follow the north current to the Needle and the Loom\'s gate.';
    return 'Enter the Loom.';
  },
  route: [
    { map: 'cloudsea', ent: 'mirrow' }, { map: 'cloudsea', ent: 'attendant' }, { map: 'cloudsea', ent: 'captain' },
    { map: 'cloudsea', ent: 'campfire' }, { map: 'cloudsea', ent: 'boss' },
  ],
};
