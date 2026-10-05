import type { MapDef } from '../game/world';
import type { Ctx, Script } from '../game/script';
import type { ChapterDef } from './index';
import { NPC } from '../data/portraits';
import { nextChapter } from './common';
import { Grid } from './grid';

const f = (s: Ctx, k: string) => s.has(k);

// ---------- The Hourglass Waste ----------

function buildWaste(): string[] {
  const g = new Grid(44, 30, '@');
  g.scatter(0, 0, 44, 30, '!', 0.15, 41);
  g.scatter(0, 0, 44, 30, 'R', 0.05, 42);
  g.scatter(0, 0, 44, 30, 'G', 0.05, 43, '@!');
  g.rect(14, 0, 16, 7, '#');
  g.rect(15, 1, 14, 5, 'H');
  g.put(21, 6, 'm');
  g.rect(20, 7, 3, 2, '!');
  g.ellipse(8, 20, 6, 4.5, ';');
  g.ellipse(8, 21, 3, 2, '~');
  g.path([[43, 15], [21, 15], [21, 7]], '@');
  g.path([[21, 15], [0, 15]], '@');
  g.put(43, 15, 'e').put(0, 15, 'w');
  g.put(5, 17, 'l').put(12, 18, 's');
  g.put(36, 10, 'c').put(38, 11, 'k').put(26, 24, 'r').put(32, 19, 'h');
  g.put(2, 3, 'a').put(40, 27, 'b').put(27, 12, 'd');
  return g.rows();
}

const westLoop: Script = async s => {
  if (s.st.chapter >= 5) { await s.warp('tetherBase', 'e', 'left'); return; }
  if (f(s, 'loopBroken')) {
    await s.tell('The dunes open up. For the first time the horizon stays where it is. Far ahead, a thread as thin as a hair runs from the ground up into the sky.');
    await nextChapter(s, 5);
    return;
  }
  await s.fadeOut();
  await s.warp('hourglass', 'e', 'left');
  if (!f(s, 'loopSeen')) {
    s.flag('loopSeen');
    await s.tell('The party walks west for what feels like hours. The sun does not move. Then they climb a dune and see the Carillon road again, right where they started.');
    await s.say('Tint', 'Those are our footprints. Those are OUR footprints.');
    await s.say('Nona', 'The desert is looping. Something is eating the hours, so we keep walking the same one.');
    await s.say('Brask', 'The Monastery of the Second Hand stands in the middle of the Waste. The monks kept the time here. If the time is broken, they will know why.');
  } else {
    await s.tell('The same hour again. The same dune. The same footprints, now considerably more of them.');
  }
};

const bicker: Script = async s => {
  if (f(s, 'bicker')) return;
  s.flag('bicker');
  await s.tell('Past the Tether gate, Carillon\'s road gives way to a desert. The sand is made of tiny brass gears, and every grain ticks.');
  await s.say('Tint', 'It\'s hot. Why is the sand ticking? Why is anything ticking?');
  await s.say('Brask', 'We are armor. We do not feel the heat. The moths do. The moths are complaining.');
  await s.say('Tint', 'Your moths ate a hole in my robe last night.');
  await s.say('Brask', 'They are drawn to bright things. You are a bright thing. It was meant as a compliment.');
  await s.say('Tint', 'It was a BITE.');
  await s.say('Nona', 'Everyone be quiet. I am listening to the sand.');
  await s.tell('Wick walks a little ahead of the others and doesn\'t say anything. Wick hasn\'t said much since the belfry.');
};

const waste: MapDef = {
  id: 'hourglass', name: 'The Hourglass Waste', music: 'desert', rows: buildWaste(), under: '!', outside: '@', bg: 'rock',
  theme: {
    sand: ['k', 'y1', 'y3'], gear: ['k', 'n1', 'y2'], rock: ['k', 'n1', 'n2'], wall: ['k', 'n1', 'y2'], glass: ['k', 'n1', 'o2'],
    water: ['k', 'b1', 'c2'], grass: ['k', 'e1', 'e2'], ground: ['k', 'y1', 'n2'],
  },
  enc: { rate: 0.15, groups: [['scorp2', 3], ['hen', 3], ['clock2', 2], ['mite3', 2], ['golem', 2]] },
  ents: [
    { id: 'east', at: 'e', kind: 'warp', to: ['carillon', 'g', 'right'], under: '!' },
    { id: 'west', at: 'w', kind: 'trigger', step: westLoop, under: '!' },
    { id: 'gate', at: 'm', kind: 'warp', to: ['monastery', 'e', 'up'], under: 'D' },
    { id: 'lamp', at: 'l', kind: 'lamp' },
    { id: 'shop', at: 's', kind: 'npc', spr: NPC.sandMerchant, talk: async s => {
      await s.say('Sand Merchant', 'Water, tea, and tomorrow\'s newspaper. I have been selling tomorrow\'s newspaper for a month. It is always the same tomorrow.');
      await s.shop('hourglass');
    } },
    { id: 'caravan', at: 'c', kind: 'npc', spr: NPC.caravan, talk: async s => {
      if (f(s, 'loopBroken')) { await s.say('Caravan Master Ibb', 'Wednesday! It\'s WEDNESDAY! I\'m going to be so late. I\'ve never been so happy to be late.'); return; }
      await s.say('Caravan Master Ibb', 'It\'s Tuesday. It has been Tuesday for eleven days. I have delivered the same crate of spoons to the same nobody nine times.');
    } },
    { id: 'camel', at: 'k', kind: 'npc', spr: NPC.clockCamel, talk: async s => s.tell('A camel made of clock parts. It chimes softly every quarter hour and carries its water in a pendulum.') },
    { id: 'mirage', at: 'r', kind: 'npc', spr: NPC.mirage, talk: async s => {
      await s.say('The Mirage', 'Lemonade! Cold lemonade! ...You can see me? Oh no. Oh, this is embarrassing. I\'m a mirage. The lemonade is also a mirage.');
      await s.say('The Mirage', 'I\'m real, though. Very real, and very disappointed about the lemonade.');
    } },
    { id: 'monument', at: 'h', kind: 'prop', spr: NPC.hourglass, talk: async s => s.tell('A giant hourglass half buried in the sand. The sand inside is falling up.') },
    { id: 'chestA', at: 'a', kind: 'chest', item: 'clock_tea' },
    { id: 'chestB', at: 'b', kind: 'chest', gold: 220 },
    { id: 'chestD', at: 'd', kind: 'chest', item: 'ink_well' },
  ],
  enter: bicker,
};

// ---------- The Monastery of the Second Hand ----------

function buildMonastery(past: boolean): string[] {
  const g = new Grid(30, 24, '#');
  g.rect(9, 1, 13, 5, '_');
  for (let x = 10; x <= 19; x += 3) { g.put(x, 2, 'G').put(x + 1, 2, 'G').put(x, 4, 'G').put(x + 1, 4, 'G'); }
  g.put(15, 6, '_');
  g.rect(9, 7, 13, 5, '_');
  g.rect(1, 7, 7, 14, '_');
  g.rect(23, 7, 6, 14, '_');
  g.rect(15, 12, 1, 6, '_');
  g.rect(11, 18, 9, 5, '_');
  if (!past) {
    g.scatter(1, 1, 28, 22, '!', 0.18, 51, '_');
    g.put(15, 15, 'R').put(15, 14, 'R');
    g.put(8, 9, '_');
    g.put(22, 9, 'R');
    g.put(4, 14, 'R').put(5, 14, 'R').put(6, 14, 'R').put(3, 14, 'R').put(2, 14, 'R').put(1, 14, 'R').put(7, 14, 'R');
  } else {
    g.put(22, 9, '_');
    g.put(26, 8, '|').put(27, 9, '|');
  }
  g.put(15, 23, 'e');
  g.put(13, 20, 't').put(17, 20, 'v');
  g.put(3, 8, 'l').put(2, 19, 'a').put(27, 19, 'b').put(10, 1, 'c');
  g.put(27, 8, 's');
  g.put(4, 11, 'm').put(25, 15, 'n').put(12, 9, 'o').put(15, 2, 'k');
  return g.rows();
}

const tockMeet: Script = async s => {
  if (f(s, 'tockJoined')) {
    await s.say('Tock', 'Later! Oh, sorry. I mean: what is it?');
    return;
  }
  await s.tell('An old monk made of brass and green glass sits cross-legged in the dust, winding a pocket sundial. He looks up and smiles like he has been waiting a long time.');
  await s.say('Tock', 'Goodbye! Oh. No. Sorry. I always get that wrong at the start. Hello. I\'m Tock. I\'m very glad to see you all again for the first time.');
  await s.say('Tock', 'You\'re Wick. You\'re Tint. You\'re Brask, and the moths. And you are...');
  await s.tell('He looks at Nona for a long moment.');
  await s.say('Tock', '...Nona. Of course.');
  await s.say('Nona', 'Have we met?');
  await s.say('Tock', 'Not yet. We will have. I live backward, you see. For me, today is nearly the end. By the time you\'re done knowing me, I\'ll be a baby. It\'s less sad than it sounds. Babies are very relaxed.');
  await s.say('Tock', 'Something in the clock tower is eating hours. That\'s why the desert loops. I remember you stopping it. So you might as well get started.');
  await s.say('Tock', 'Take this. The monastery keeps two times, then and now. The sundial lets you step between them.');
  await s.give('sundial');
  await s.tell('^yPress C^0 to shift between the past and the present. Rubble in the present may be a clear hall in the past, and a wall in the past may have fallen by now.');
  await s.say('Tock', 'And in a fight, I can see the next few moments. So can you, now. Look at the top of the screen. That\'s the order things will happen in.');
  s.mech('tempo');
  s.flag('tockJoined');
  await s.join('tock', Math.max(13, s.st.members.wick.lvl));
  await s.tell('^yTempo^0: the timeline shows who acts next. Guard and quick skills bring your next turn sooner. Tock\'s ^yDelay^0 pushes a foe later, and ^yHasten^0 makes an ally act next.');
  if (s.st.party.includes('tock')) return;
  await s.tell('Tock waits in reserve. Swap him into the active party from the menu under Party.');
};

const monasteryDef = (): MapDef => ({
  id: 'monastery', name: 'Monastery of the Second Hand', music: 'desert', rows: buildMonastery(false), past: buildMonastery(true), under: '_', outside: '#', bg: 'gear',
  legend: { '_': { kind: 'floor', enc: true }, '!': { kind: 'sand', enc: true } },
  theme: { wall: ['k', 'n2', 'y3'], floor: ['k', 'n1', 'y1'], sand: ['k', 'y1', 'y3'], gear: ['k', 'n1', 'y2'], rock: ['k', 'n1', 'n2'], fence: ['k', 'n1', 'n3'] },
  enc: { rate: 0.15, groups: [['clock2', 3], ['mite3', 2], ['golem', 2], ['golem2', 2]] },
  ents: [
    { id: 'exit', at: 'e', kind: 'warp', to: ['hourglass', 'm', 'down'], under: '_' },
    { id: 'tock', at: 't', kind: 'npc', spr: NPC.tock, when: st => !st.flags.tockJoined, talk: tockMeet },
    { id: 'plaque', at: 'v', kind: 'sign', text: 'MONASTERY OF THE SECOND HAND. WE KEEP THE TIME SO THE TIME KEEPS YOU. Someone has scratched underneath: IT STOPPED KEEPING US.' },
    { id: 'lamp', at: 'l', kind: 'lamp' },
    { id: 'chestA', at: 'a', kind: 'chest', item: 'green_hour' },
    { id: 'chestB', at: 'b', kind: 'chest', item: 'metronome' },
    { id: 'chestC', at: 'c', kind: 'chest', item: 'ink_well', n: 2 },
    { id: 'stairs', at: 's', kind: 'trigger', under: 'S', step: async s => {
      if (s.st.past) { await s.tell('In the past these stairs have not been built yet.'); return; }
      await s.warp('clocktower', 'd', 'up');
    } },
    { id: 'clock', at: 'k', kind: 'prop', spr: NPC.clockFace, talk: async s => s.tell(s.st.past ? 'The monastery clock, ticking steadily. It is 3:15. It has always been 3:15, and that was fine.' : 'The monastery clock. Its hands spin backward, very fast.') },
    { id: 'monkA', at: 'm', kind: 'npc', spr: NPC.monkPast, when: st => st.past, talk: async s => s.say('Brother Minute', 'Visitors from later! How exciting. Is the future nice? Don\'t tell me. We\'re not allowed to know. It spoils the vow.') },
    { id: 'monkB', at: 'n', kind: 'npc', spr: NPC.monkPastB, when: st => st.past, talk: async s => {
      await s.say('Sister Second', 'There is a prophecy here about a monk who will arrive old and leave young. We don\'t understand it. We think it is about moisturizer.');
    } },
    { id: 'monkC', at: 'o', kind: 'npc', spr: NPC.monkPast, when: st => st.past, talk: async s => s.say('Brother Minute', 'Tock? No, there\'s no Tock here. We have a Tick, a Tuck, and a Brother Minute. I\'m Brother Minute.') },
  ],
});

// ---------- The clock tower ----------

function buildTower(): string[] {
  const g = new Grid(17, 12, '#');
  g.rect(1, 1, 15, 10, '_');
  for (let x = 3; x <= 13; x += 2) g.put(x, 2, 'G');
  g.put(8, 3, 'c').put(8, 6, 'b').put(8, 10, 'd').put(4, 9, 'l');
  g.put(2, 5, 'P').put(14, 5, 'P');
  return g.rows();
}

const chronoFight: Script = async s => {
  if (f(s, 'chronoDead')) return;
  s.music('boss');
  await s.tell('The clock tower\'s great face is cracked, and something long and green is coiled through the gears, chewing. With every bite, the hands jump backward.');
  await s.say('Chronophage', 'Mmm. Tuesday. Tuesday again. Delicious. Tuesdays are chewy.');
  await s.say('Tock', 'It rewinds itself when it\'s hurt. Push it later on the timeline and it rewinds less often. And when it coils up, Guard. That\'s the whole trick.');
  const r = await s.battle('boss4');
  if (r !== 'win') return;
  s.flag('chronoDead');
  s.flag('loopBroken');
  s.shake(30);
  await s.flash('w');
  await s.tell('The Chronophage unravels into a spray of loose minutes. Every clock in the tower starts ticking forward at once.');
  await s.say('Tock', 'There. The hours are free.');
  await s.tell('Tock is quiet for a while. Then he speaks without looking at anyone.');
  await s.say('Tock', 'I should tell you something, since I remember it. At the top, one of you doesn\'t come back.');
  await s.say('Tint', 'Who?');
  await s.say('Tock', 'I won\'t say. I remember it, and I won\'t say. Saying it doesn\'t help. I\'ve tried. Well. I will have tried.');
  await s.tell('Nona\'s tails curl in close, one by one, as though she is counting them.');
  await s.say('Wick', 'You live backward. Can\'t you undo it?');
  await s.say('Tock', 'Living backward isn\'t undoing. I still only get to go one way. It\'s just a different way.');
  await s.say('Tock', 'You can\'t undo things, Wick. You can only choose the next thing.');
  await s.say('Wick', 'I wanted to undo the night Gran went grey. I\'ve been trying to, this whole time.');
  await s.say('Wick', '...Then I\'ll choose the next thing carefully.');
  await s.say('Tock', 'You will. I remember. Hello, everyone. I mean goodbye. I mean: let\'s go.');
  await s.tell('The monastery shudders. In the present, its walls are finally allowed to be as old as they are.');
  await s.warp('hourglass', 'm', 'down');
};

const tower: MapDef = {
  id: 'clocktower', name: 'The Clock Tower', music: 'desert', rows: buildTower(), under: '_', outside: '#', bg: 'gear',
  theme: { wall: ['k', 'n2', 'y3'], floor: ['k', 'n1', 'y1'], gear: ['k', 'n1', 'y2'], pillar: ['k', 'n2', 'y2'] },
  ents: [
    { id: 'down', at: 'd', kind: 'warp', to: ['monastery', 's', 'down'], under: 'S' },
    { id: 'chrono', at: 'c', kind: 'npc', spr: NPC.chronophage, when: st => !st.flags.chronoDead, talk: chronoFight },
    { id: 'boss', at: 'b', kind: 'trigger', step: chronoFight },
    { id: 'lamp', at: 'l', kind: 'lamp' },
  ],
};

export const maps: MapDef[] = [waste, monasteryDef(), tower];

export const chapter: ChapterDef = {
  title: 'The Second Hand',
  stage: 'Tests, allies, enemies',
  blurb: 'Past Carillon lies a desert of ticking sand, and the same hour, over and over.',
  recruit: 'tock',
  ready: true,
  startMap: 'hourglass',
  startMarker: 'e',
  objective: st => {
    const fl = st.flags;
    if (!fl.loopSeen && !fl.tockJoined) return 'Cross the Hourglass Waste to the west.';
    if (!fl.tockJoined) return 'The desert loops. Find the Monastery of the Second Hand in the middle of the Waste.';
    if (!fl.chronoDead) return 'Use the sundial (press C) to move between past and present, and reach the clock tower stairs in the east wing.';
    return 'The loop is broken. Head west across the Waste.';
  },
  route: [
    { map: 'hourglass', ent: 'shop' }, { map: 'hourglass', ent: 'west' },
    { map: 'hourglass', warp: 'gate' }, { map: 'monastery', ent: 'tock' }, { map: 'monastery', ent: 'stairs' },
    { map: 'clocktower', ent: 'boss' },
    { map: 'hourglass', ent: 'caravan' }, { map: 'hourglass', ent: 'west' },
  ],
};
