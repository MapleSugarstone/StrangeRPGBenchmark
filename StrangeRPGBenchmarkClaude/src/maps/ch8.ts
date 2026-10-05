import type { MapDef, EntDef } from '../game/world';
import type { Ctx, Script } from '../game/script';
import type { ChapterDef } from './index';
import { NPC } from '../data/portraits';
import { MEMBERS } from '../data/members';
import { EDGEWICK, HOLLOW } from './ch1';
import { Grid } from './grid';
import { save } from '../game/state';

const f = (s: Ctx, k: string) => s.has(k);

const GREY_ROWS = EDGEWICK.map((r, y) => (y === 11 ? r.slice(0, 29) + ':=z  ' : r));

const statue = (id: string, at: string, spr: EntDef['spr'], line: string): EntDef => ({
  id, at, kind: 'npc', spr, talk: async s => s.tell(line),
});

const rejoin = (id: string, flag: string, lines: [string, string][]): Script => async s => {
  if (f(s, flag)) return;
  for (const [who, text] of lines) await s.say(who, text);
  s.flag(flag);
  const m = s.st.members[id];
  if (m) m.hp = Math.max(1, m.hp);
  if (!s.st.party.includes(id) && !s.st.reserve.includes(id)) {
    const before = s.st.party.length;
    s.st[before < 4 ? 'party' : 'reserve'].push(id);
  }
  s.sfx('lvl');
  await s.tell(`^y${MEMBERS[id].name}^0 is back.`);
  s.refresh();
};

const greyIntro: Script = async s => {
  if (f(s, 'greyIntro')) return;
  s.flag('greyIntro');
  s.flag('greyWorld');
  s.greyWorld(true);
  s.st.party = ['wick', 'nil'].filter(id => s.st.members[id]);
  s.st.reserve = [];
  for (const id of ['wick', 'nil']) if (s.st.members[id]) s.st.members[id].hp = Math.max(1, s.st.members[id].hp);
  await s.tell('Wick wakes up on the cold path outside the Lamp House.');
  await s.tell('Everything is grey. The grass is grey. The Great Lamp is grey and dark. The villagers stand where they were, grey and still, mid-step, mid-word.');
  await s.tell('Wick looks down at their own hands. Black and amber. Still amber.');
  await s.say('Nil', 'You are awake. I followed you down. I do not know why. I think that is what following is.');
  await s.say('Wick', 'Where is everyone? Tint? Brask?');
  await s.say('Nil', 'We fell in pieces. The others landed somewhere. I landed on you.');
  await s.tell('Above the village, where the sky should be, the Loom hangs lower than Wick has ever seen it. Its underside is open. A long grey spindle has come down out of it and plunged into the Edge, just past the last lamp.');
  await s.say('Wick', 'It\'s taking Edgewick first. It said so.');
  await s.say('Nil', 'Then we should find the others quickly. I am not very good at fighting alone. I have never done anything alone. I have only swept.');
};

const hatch: Script = async s => {
  const back = ['tint', 'brask'].filter(id => s.has(`back_${id}`)).length;
  if (back < 2) {
    await s.tell('A hatch in the side of the grey spindle, where it pierces the Edge. It hums.');
    await s.say('Wick', 'Not alone. Tint and Brask are out there somewhere. The wood, maybe. The Edge Lamps.');
    await s.movePlayer('l');
    return;
  }
  if (!f(s, 'hatchSpeech')) {
    s.flag('hatchSpeech');
    await s.say('Wick', 'Everyone. The Bishop said he\'d start at the edge. This is the edge. I\'ve lived here my whole life.');
    await s.say('Tint', 'Then you know it better than he does.');
  }
  await s.warp('spindleDown', 'e', 'up');
};

const edgeGrey: MapDef = {
  id: 'edgewickGrey', name: 'Edgewick', music: 'sad', rows: GREY_ROWS, under: ';', outside: 'T', grey: true,
  theme: {
    grass: ['k', 'e2', 'e3'], ground: ['k', 'e1', 'e2'], path: ['k', 'n2', 'n3'], tree: ['k', 'e1', 'e2'],
    edge: ['k', 'g1', 'o3'], void: ['k', 'g1', 'w'], roof: ['k', 'r1', 'o2'], brick: ['k', 'n1', 'n2'], bridge: ['k', 'g2', 'w'],
  },
  enc: { rate: 0.06, groups: [['sheep2', 3], ['knight', 1]] },
  ents: [
    { id: 'north', at: 'w', kind: 'warp', to: ['hollowGrey', 'z', 'up'], under: ':' },
    { id: 'west', at: 'x', kind: 'trigger', under: ':', step: async s => {
      if (!f(s, 'back_vend')) {
        await rejoin('vend', 'back_vend', [
          ['VEND', 'HELLO. I BOUGHT A RIDE DOWN. IT WAS A FALLING RIDE. IT WAS VERY CHEAP.'],
          ['VEND', 'I LANDED ON THE WEST ROAD. I HAVE BEEN WALKING SINCE. MY LEGS ARE NOT RATED FOR THIS.'],
        ])(s);
        return;
      }
      await s.say('Wick', 'Not now. The Spindle.');
      await s.movePlayer('r');
    } },
    { id: 'granDoor', at: 'g', kind: 'warp', to: ['granhouseGrey', 'd', 'up'], under: 'D' },
    { id: 'shopDoor', at: 's', kind: 'prop', under: 'D', solid: true, talk: async s => {
      await s.tell('Mott is grey behind the counter, but the shop door is open, and someone has left a note: TAKE WHAT YOU NEED. PAY WHEN THERE ARE COLORS AGAIN.');
      await s.shop('grey');
    } },
    { id: 'mayorDoor', at: 'm', kind: 'prop', under: 'D', solid: true, talk: async s => s.tell('The mayor\'s door. The sign still says OUT SUPERVISING.') },
    { id: 'lamp1', at: '1', kind: 'lamp' },
    { id: 'lamp3', at: '3', kind: 'lamp', talk: async s => {
      if (!f(s, 'back_brask')) {
        s.flag('lit:edgewickGrey:lamp3');
        s.sfx('save');
        await s.flash('y3');
        await s.tell('Wick lights the Edge Lamp. It is the only warm thing for a mile. And out of the grey, one by one, pale moths come to it.');
        await s.tell('Then more. Then a cloud of them, and inside the cloud, a suit of armor putting itself back together, a gauntlet at a time.');
        await rejoin('brask', 'back_brask', [
          ['Brask', 'Lamp-bearer. We were scattered across the whole Edge. The moths could not find each other in the grey.'],
          ['Brask', 'Then you lit a lamp. Of course you did.'],
        ])(s);
        return;
      }
      await s.tell('The Edge Lamp burns amber against the grey.');
    } },
    { id: 'hatch', at: 'z', kind: 'trigger', step: hatch, under: '=' },
    { id: 'greatLamp', at: 'l', kind: 'npc', spr: NPC.greatLampOut, talk: async s => s.tell('The Great Lamp is dark. The lampsap in it has gone grey and hard, like candle wax.') },
    statue('hollis', 'h', NPC.hollis, 'Hollis, grey, pointing at the wood. He was warning someone.'),
    statue('sprocket', 'k', NPC.sprocket, 'Sprocket, grey, one shoe missing. His hand is raised to wave.'),
    statue('pell', 'p', NPC.pellGrey, 'Pell, grey, holding a grey loaf of bread.'),
    statue('dilly', 'v', NPC.villagerGrey, 'Dilly, grey, with a grey bird on their head. The bird is also a statue now.'),
    statue('mayor', 'o', NPC.mayor, 'The mayor, grey, mid-speech. You can tell it was a long one.'),
    statue('sheep', 'q', NPC.sheep, 'The fog sheep has gone grey. It is hard to tell the difference.'),
    { id: 'scarecrow', at: 'r', kind: 'npc', spr: NPC.scarecrow, talk: async s => s.say('Scarecrow Unit 4', 'FORECAST: GREY. FORECAST: GREY. FORECAST: ONE SMALL AMBER LIGHT, MOVING. HOPE LEVEL: UNCALIBRATED.') },
    { id: 'pond', at: 'f', kind: 'npc', spr: NPC.pond, talk: async s => {
      if (f(s, 'back_mirrow')) { await s.tell('The pond is grey, but the reflection in it is in color.'); return; }
      await s.tell('Wick looks down into the grey pond, and the reflection looking back is in color. It is not Wick\'s reflection.');
      await rejoin('mirrow', 'back_mirrow', [
        ['Mirrow', '...looking back. I held the gate until it closed on me. Then I was a crack in a door, and then a reflection in the clouds, and then a reflection in this pond.'],
        ['Mirrow', 'Reflections go wherever there is something to reflect. You were here. So I was here.'],
      ])(s);
    } },
    { id: 'sign', at: 'n', kind: 'sign', text: 'WEST ROAD. Someone has written underneath, in fresh amber paint: WE CAME BACK.' },
  ],
  enter: greyIntro,
};

const granGrey: MapDef = {
  id: 'granhouseGrey', name: 'Lamp House', music: 'sad', under: '-', outside: '#', grey: true,
  rows: ['##########', '#WW####WW#', '#--------#', '#-b----u-#', '#--------#', '#--t--y--#', '#--------#', '####d#####'],
  theme: { wall: ['k', 'n2', 'n3'], planks: ['k', 'n1', 'n2'], window: ['k', 'n2', 'y3'] },
  ents: [
    { id: 'door', at: 'd', kind: 'warp', to: ['edgewickGrey', 'g', 'down'], under: 'D' },
    { id: 'bed', at: 'b', kind: 'prop', spr: NPC.bed, talk: async s => s.tell('Wick\'s bed. Grey now, but still shaped like Wick.') },
    { id: 'pot', at: 't', kind: 'prop', spr: NPC.pot, talk: async s => s.tell('Gran\'s tallow pot. Empty. Wick checks twice anyway.') },
    { id: 'gran', at: 'u', kind: 'npc', spr: NPC.granGrey, talk: async s => {
      if (s.hasItem('gran_jar')) await s.tell('Gran stands by the window, grey. Wick holds up the jar of umber next to her. It is exactly her color. Soon.');
      else await s.tell('Gran stands by the window, grey. Still warm.');
    } },
    { id: 'tock', at: 'y', kind: 'npc', spr: NPC.tockYoung, when: st => !st.flags.back_tock, talk: rejoin('tock', 'back_tock', [
      ['Tock', 'Hello! It\'s hello at this end, I\'m sure of it now. I\'ve been sitting with your grandmother. She\'s a good listener.'],
      ['Tock', 'I\'m much younger than when we met. Look, my gears are shiny. By the end of this I\'ll be brand new, and then I won\'t remember any of you, and that\'s all right. You\'ll remember me.'],
    ]) },
  ],
};

const tintFound: Script = rejoin('tint', 'back_tint', [
  ['Tint', 'WICK! Oh, thank the colors. I landed in a crater in the middle of the wood. Everything was grey. So I started painting.'],
  ['Tint', 'I\'ve done eleven trees. It\'s not going great. The grey keeps coming back. But the trees seem to like it while it lasts.'],
  ['Tint', 'This crater. Wick, this is where you found Nona, isn\'t it?'],
  ['Wick', '...Yeah. She was lying right there, being rude to three Blanks.'],
  ['Tint', 'Then I\'m glad I landed here. Come on. Let\'s go finish her job.'],
]);

const hollowGrey: MapDef = {
  id: 'hollowGrey', name: 'The Hollow Wood', music: 'sad', rows: HOLLOW, under: ',', outside: 'Y', dark: 3, grey: true,
  legend: { ':': { kind: 'path', enc: true } },
  theme: { tall: ['k', 'e1', 'g1'], path: ['k', 'n1', 'n2'], pine: ['k', 'e1', 'g1'], antenna: ['k', 'g1', 'r2'], rock: ['k', 'g1', 'g2'], ground: ['k', 'e1', 'g1'] },
  enc: { rate: 0.12, groups: [['sheep2', 3], ['wraith3', 2], ['knight', 2]] },
  ents: [
    { id: 'exit', at: 'z', kind: 'warp', to: ['edgewickGrey', 'w', 'down'], under: ':' },
    { id: 'lamp1', at: '1', kind: 'lamp' },
    { id: 'lamp2', at: '2', kind: 'lamp' },
    { id: 'lamp3', at: '3', kind: 'lamp' },
    { id: 'tree', at: 't', kind: 'npc', spr: NPC.antennaTree, talk: async s => s.tell('The Antenna Tree is grey and silent. No stations at all.') },
    { id: 'tint', at: 'n', kind: 'npc', spr: { g: 'human', seed: 'tint', pal: ['k', 'm2', 'e3'], o: { head: 'bubble', torso: 'robe', legs: 'skirt', held: 'brush' } }, when: st => !st.flags.back_tint, talk: tintFound },
    { id: 'stagMark', at: 's', kind: 'prop', solid: false, spr: NPC.shrine, talk: async s => s.tell('Someone has painted a small violet flower on a grey rock. It is the only color in the wood.') },
    { id: 'boss', at: 'b', kind: 'trigger', step: async () => {}, under: ',' },
    { id: 'chestF', at: 'f', kind: 'chest', item: 'honey', n: 2 },
    { id: 'chestC', at: 'c', kind: 'chest', item: 'iron_rind' },
    { id: 'chestD', at: 'd', kind: 'chest', item: 'ink_well', n: 2 },
    { id: 'chestE', at: 'e', kind: 'chest', item: 'relight', n: 2 },
  ],
};

// ---------- The descended Spindle ----------

function buildSpindle(): string[] {
  const g = new Grid(27, 44, '/');
  const room = (x: number, y: number, w: number, h: number, c = 'Q') => g.rect(x, y, w, h, c);
  room(8, 37, 11, 6);
  room(2, 29, 9, 7, 'V');
  room(16, 29, 9, 7);
  room(8, 21, 11, 7, 'V');
  room(2, 12, 9, 7);
  room(16, 12, 9, 7, 'V');
  room(9, 5, 9, 6);
  room(10, 1, 7, 3, 'O');
  g.path([[13, 37], [13, 33], [10, 33]], 'Q');
  g.path([[13, 35], [16, 35], [16, 33]], 'Q');
  g.path([[6, 29], [6, 25], [8, 25]], 'Q');
  g.path([[20, 29], [20, 25], [18, 25]], 'Q');
  g.path([[10, 21], [6, 21], [6, 18]], 'V');
  g.path([[17, 21], [20, 21], [20, 18]], 'Q');
  g.path([[6, 12], [6, 8], [9, 8]], 'Q');
  g.path([[20, 12], [20, 8], [17, 8]], 'V');
  g.path([[13, 5], [13, 3]], 'O');
  g.put(13, 42, 'e');
  g.put(13, 7, 'l').put(13, 2, 'b').put(13, 1, 'o');
  g.put(4, 31, 'a').put(22, 31, 'c').put(4, 14, 'd').put(22, 14, 'f').put(16, 24, 'h');
  g.put(11, 39, 'k');
  return g.rows();
}

const finalBattle: Script = async s => {
  if (f(s, 'bishopDown')) return;
  s.music('final');
  await s.tell('At the top of the Spindle, where it meets the open belly of the Loom, the Grey Bishop is waiting. Behind him, the whole sky is a machine.');
  await s.say('The Grey Bishop', 'The misprint. Carrying the last ink in the world, as if it were a candle.');
  await s.say('The Grey Bishop', 'Do you understand what I am? I am what keeps the world from unraveling all at once. I take what can be spared. I have been careful for a hundred years.');
  await s.say('Wick', 'You took Gran. You took Nona.');
  await s.say('The Grey Bishop', 'I took what could be spared.');
  await s.say('Wick', 'They couldn\'t be spared. Not by me.');
  await s.say('Tint', 'He\'s grey and white. No hues. Nothing we hit him with will clash, unless somebody gives him a color first.');
  await s.say('Tint', 'Good thing somebody\'s me.');
  const r = await s.battle('final');
  if (r !== 'win') return;
  s.flag('bishopDown');
  s.shake(60);
  await s.tell('The Bishop falls to one knee. Then he reaches up, and the Loom reaches down, and they meet.');
  await s.tell('Threads pour out of the sky and wrap around him, every color he ever took, until he is the size of a cathedral and wearing the whole machine like a robe.');
  await s.say('The Loom-Bound Bishop', 'ENOUGH TRIAGE. I WILL RECLAIM ALL OF IT, AND BEGIN THE WORLD AGAIN SMALLER.');
  await s.say('The Loom-Bound Bishop', 'AND YOU, MISPRINT. IF I CANNOT READ YOU, I WILL PRINT YOU OUT.');
  await s.flash('w');
  s.music('sad');
  await s.tell('Wick comes apart. Not their colors. Wick, all of Wick. There is a white page where Wick was standing.');
  await s.tell('...');
  await s.tell('It is quiet on the white page. There is no up. There is no Edgewick. There is, very faintly, the smell of lamp oil.');
  await s.say('Nona', 'You are not in the index, Wick.');
  await s.say('Wick', 'Nona?');
  await s.say('Nona', 'Not really. An echo in the ink I gave you. Listen. He cannot print you out. You were never printed in. You are a misprint. The Loom made you with what it had, and it had enough.');
  await s.say('Nona', 'You always light the lamp. So light it.');
  await s.tell('Wick lifts the lamp. The Ninth Ink, wound around their wrist, catches, and burns a color that is not on the wheel.');
  await s.flash('w');
  s.music('final');
  await s.tell('Wick steps back onto the Spindle, whole, holding a lamp that burns every color at once.');
  await s.say('The Loom-Bound Bishop', '...UNINDEXED.');
  await s.say('Wick', 'Unfinished. It turns out that\'s not the same as empty.');
  s.mech('tricolor');
  s.heal();
  await s.tell('^yThe Ninth Ink^0: Wick can now take a third hue in battle with ^yNinth Ink^0, and strike with the best of their hues with ^yTrichrome^0.');
  const r2 = await s.battle('final2');
  if (r2 !== 'win') return;
  s.flag('loomDown');
  await ending(s);
};

async function ending(s: Ctx) {
  s.music('title');
  await s.tell('The threads fall away from the Bishop, and underneath them there is only a tall grey figure, very tired, kneeling.');
  await s.say('The Grey Bishop', 'There is still no ink, misprint. The Loom is still empty. When I stop, the world unravels at the edges. I was not wrong about that.');
  await s.say('The Weaver', 'He is right. Wick. The Ninth Ink can print anything, once.');
  await s.say('The Weaver', 'It can print you a third hue, and you will be whole, the way you always wanted. Or it can print one new ink into my empty well, and the Loom can work again. Not as it was. But enough.');
  await s.tell('Everyone is looking at Wick. Tint. Brask and the moths. Nil, holding very still. The little glowing thread around Wick\'s wrist.');
  const i = await s.ask('What does Wick print?', ['A new ink for the Loom', 'A third hue for myself']);
  if (i === 0) {
    s.flag('endGive');
    await s.say('Wick', 'I thought being whole meant having three colors. I thought I was half a person.');
    await s.say('Wick', 'I\'m not. I got here with two. Give it to the Loom.');
    await s.tell('Wick unwinds the Ninth Ink from their wrist and lets it go. It rises into the empty well, and the well fills, and the whole Loom takes a breath.');
    await s.tell('Color comes down out of the sky like rain.');
    await s.say('The Grey Bishop', '...Oh.');
    await s.tell('A single drop lands on the Bishop. For the first time, he has a hue. It is a soft, ordinary green. He looks at his hands for a long time.');
    await s.say('The Grey Bishop', 'I do not know what to do now. There is nothing left to take.');
    await s.say('Nil', 'You could sweep. I can show you. It is good work. Nobody expects anything of you, and then sometimes you find a lost color and give it back.');
    s.greyWorld(false);
    s.flag('greyWorld', false);
    s.st.flags['lit:edgewickEnd:lamp1'] = true;
    s.st.flags['lit:edgewickEnd:lamp3'] = true;
    save(s.st);
    await s.fadeOut();
    await s.warp('edgewickEnd', 'y', 'down');
    await s.fadeIn();
  } else {
    s.flag('endKeep');
    await s.say('Wick', 'I\'ve wanted this since before I could talk. Just once, I want to be finished.');
    await s.tell('Wick winds the Ninth Ink tighter, and it sinks into them, and Wick has three colors: black, and amber, and a color that is not on the wheel.');
    await s.tell('It feels like being finished. It feels like it for almost a whole minute.');
    await s.say('The Grey Bishop', 'Then the triage continues. Thank you for your cooperation.');
    await s.tell('Nobody says anything. Tint looks at the ground. Brask\'s moths settle, one by one, and stop moving.');
    s.st.flags.wickHue = 'm3';
    save(s.st);
    await s.ending('keep');
    s.st.flags.cleared = true;
    save(s.st);
    await s.tell('^yThe End.^0 There was another choice.');
    s.title();
  }
}

const spindle: MapDef = {
  id: 'spindleDown', name: 'The Descended Spindle', music: 'loom', rows: buildSpindle(), under: 'Q', outside: '/', grey: true, bg: 'thread',
  legend: {
    Q: { kind: 'circuit', enc: true },
    V: { kind: 'grate', enc: true, greyzone: true },
  },
  theme: { circuit: ['k', 'g1', 'c1'], grate: ['k', 'g1', 'g2'], thread: ['k', 'g1', 'm1'] },
  enc: { rate: 0.14, groups: [['sheep2', 2], ['knight', 3], ['wraith3', 2], ['mixed8', 3]] },
  ents: [
    { id: 'exit', at: 'e', kind: 'warp', to: ['edgewickGrey', 'z', 'left'], under: 'Q' },
    { id: 'lamp', at: 'l', kind: 'lamp' },
    { id: 'lamp0', at: 'k', kind: 'lamp' },
    { id: 'boss', at: 'b', kind: 'trigger', step: finalBattle, under: 'O' },
    { id: 'bishop', at: 'o', kind: 'npc', spr: NPC.bishop, when: st => !st.flags.bishopDown, talk: finalBattle },
    { id: 'chestA', at: 'a', kind: 'chest', item: 'chorus', n: 2 },
    { id: 'chestC', at: 'c', kind: 'chest', item: 'honey', n: 3 },
    { id: 'chestD', at: 'd', kind: 'chest', item: 'hue_lens' },
    { id: 'chestF', at: 'f', kind: 'chest', item: 'ink_well', n: 3 },
    { id: 'sign', at: 'h', kind: 'sign', text: 'Carved into the Spindle wall, very small: BUILT TO LAST. Underneath, smaller still: IT DID NOT.' },
  ],
};

// ---------- Epilogue ----------

const lastLamp: Script = async s => {
  await s.tell('Wick walks out to the last Edge Lamp, past which there has always been nothing.');
  await s.tell('Wick lights it.');
  s.sfx('save');
  await s.flash('y3');
  await s.tell('And past the lamp, for the first time since the world was printed, the Loom prints something new: one tile of grass, then another, then a whole row, unrolling out into the Void like a carpet.');
  await s.say('Tint', 'The world\'s getting bigger.');
  await s.say('Wick', 'Somebody\'s going to need to light lamps out there.');
  s.st.flags.cleared = true;
  save(s.st);
  await s.ending('give');
  s.title();
};

const endRows = EDGEWICK.map((r, y) => (y === 12 ? r.slice(0, 14) + 'y' + r.slice(15) : r));

const epilogue: MapDef = {
  id: 'edgewickEnd', name: 'Edgewick', music: 'village', rows: endRows, under: ';', outside: 'T',
  theme: edgeGrey.theme,
  ents: [
    { id: 'north', at: 'w', kind: 'prop', under: ':', solid: true, talk: async s => s.tell('The Hollow Wood. The antenna trees are playing music again.') },
    { id: 'west', at: 'x', kind: 'prop', under: ':', solid: true, talk: async s => s.tell('The west road. Pilgrims are coming the other way now, to see the village at the edge of the world.') },
    { id: 'granDoor', at: 'g', kind: 'prop', under: 'D', solid: true, talk: async s => s.tell('The Lamp House. The door is open and it smells like bread.') },
    { id: 'shopDoor', at: 's', kind: 'prop', under: 'D', solid: true, talk: async s => s.tell('Edgewick Stores. Mott has put up a sign: EVERYTHING IS FREE TODAY. EXCEPT THE BREAD. PELL SAID.') },
    { id: 'mayorDoor', at: 'm', kind: 'prop', under: 'D', solid: true, talk: async s => s.tell('The mayor\'s door. The sign says IN, FOR ONCE.') },
    { id: 'lamp1', at: '1', kind: 'lamp', talk: async s => s.tell('The Edge Lamp burns amber.') },
    { id: 'lamp2', at: '2', kind: 'lamp', talk: lastLamp },
    { id: 'lamp3', at: '3', kind: 'lamp', talk: async s => s.tell('The Edge Lamp burns amber.') },
    { id: 'greatLamp', at: 'l', kind: 'npc', spr: NPC.greatLamp, talk: async s => s.tell('The Great Lamp burns amber and loud. Someone has painted a thin violet stripe around its glass.') },
    { id: 'gran', at: 'a', kind: 'npc', spr: NPC.gran, talk: async s => {
      if (s.hasItem('gran_jar')) {
        if (!f(s, 'jarOpened')) {
          s.flag('jarOpened');
          await s.tell('Wick opens the jar. The warm brown light pours out and finds its way home.');
        }
      }
      await s.say('Gran Umber', 'There you are, wick-in-the-wind. I was grey for a while, they tell me. I don\'t remember it. I remember you going.');
      await s.say('Gran Umber', 'You look the same. Black and amber. Good. I was worried you\'d come back all fancy.');
      await s.say('Wick', 'I almost did.');
      await s.say('Gran Umber', 'Well. You didn\'t. The last Edge Lamp needs lighting. Go on. I\'ll put the bread on.');
    } },
    { id: 'tint', at: 'k', kind: 'npc', spr: { g: 'human', seed: 'tint', pal: ['k', 'm2', 'e3'], o: { head: 'bubble', torso: 'robe', legs: 'skirt', held: 'brush' } }, talk: async s => s.say('Tint', 'I\'m going back to Prismouth. I\'m going to paint the Lens back together. Then I\'m coming back here, because somebody has to paint all that new grass.') },
    { id: 'brask', at: 'h', kind: 'npc', spr: NPC.brask, talk: async s => s.say('Brask', 'We asked where the color goes. Now we know where it comes from, too. The moths would like to stay near your lamps. If that is permitted.') },
    { id: 'vend', at: 'p', kind: 'npc', spr: NPC.vend, talk: async s => {
      await s.say('VEND', 'THE BAKER GAVE ME A LOAF OF BREAD. FOR FREE. I DID NOT PAY. I DID NOT KNOW WHAT TO DO.');
      await s.say('VEND', 'I HAVE PUT IT IN MY TOP SHELF. I WILL KEEP IT FOREVER.');
    } },
    { id: 'tock', at: 'v', kind: 'npc', spr: NPC.tockYoung, talk: async s => s.say('Tock', 'Hello! Oh, that\'s right, it\'s hello now. I don\'t remember any of you. You all seem very nice. The amber one keeps crying at me.') },
    { id: 'nil', at: 'o', kind: 'npc', spr: NPC.nil, talk: async s => s.say('Nil', 'The Bishop and I are going to sweep the Loom. He is not very good at it yet. I am patient. I have always been patient. Now I am also something else. I do not know the word.') },
    { id: 'mirrow', at: 'f', kind: 'npc', spr: NPC.mirrow, talk: async s => s.say('Mirrow', '...everyone smiling. I am reflecting it. It is the brightest thing I have ever held.') },
    { id: 'sprocket', at: 'n', kind: 'npc', spr: NPC.sprocket, talk: async s => s.say('Sprocket', 'Wick! I decided I\'m keeping all three of my colors. But I\'m going to be a lamplighter anyway. You don\'t need to be a Duotone for it, right?') },
    { id: 'scarecrow', at: 'r', kind: 'npc', spr: NPC.scarecrow, talk: async s => s.say('Scarecrow Unit 4', 'FORECAST: COLOR. ALL OF IT. SCATTERED EVERYWHERE. ALSO CROWS. THE CROWS REMAIN CONSTANT.') },
    { id: 'arrive', at: 'y', kind: 'trigger', under: ';', step: async () => {} },
    { id: 'nona', at: 'q', kind: 'npc', spr: NPC.nonaGrey, talk: async s => {
      await s.tell('A small statue of a cat with nine tails, carved from grey stone, sits beside the Great Lamp. Someone has put it where the light falls on it best.');
      await s.tell('Tint has painted the eyes cyan.');
    } },
  ],
};

export const maps: MapDef[] = [edgeGrey, granGrey, hollowGrey, spindle, epilogue];

export const chapter: ChapterDef = {
  title: 'The Third Ink',
  stage: 'The road back',
  blurb: 'Wick falls home. Home is grey. The Loom is coming down after them.',
  ready: true,
  startMap: 'edgewickGrey',
  startMarker: 'a',
  presetFlags: { greyWorld: true },
  objective: st => {
    const fl = st.flags;
    if (!fl.back_tint || !fl.back_brask) return 'Find your scattered friends. Try the Hollow Wood, and the Edge Lamps.';
    if (!fl.bishopDown) return 'Enter the Spindle through the hatch at the east Edge, and climb to the top.';
    if (fl.endGive) return 'Light the last Edge Lamp.';
    return 'Face the Loom-Bound Bishop.';
  },
  route: [
    { map: 'edgewickGrey', ent: 'lamp3' }, { map: 'edgewickGrey', ent: 'pond' }, { map: 'edgewickGrey', ent: 'shopDoor' },
    { map: 'edgewickGrey', warp: 'granDoor' }, { map: 'granhouseGrey', ent: 'tock' }, { map: 'granhouseGrey', warp: 'door' },
    { map: 'edgewickGrey', ent: 'west' },
    { map: 'edgewickGrey', warp: 'north' }, { map: 'hollowGrey', ent: 'tint' }, { map: 'hollowGrey', warp: 'exit' },
    { map: 'edgewickGrey', ent: 'hatch' },
    { map: 'spindleDown', ent: 'boss' },
    { map: 'edgewickEnd', ent: 'gran' }, { map: 'edgewickEnd', ent: 'lamp2' },
  ],
};
