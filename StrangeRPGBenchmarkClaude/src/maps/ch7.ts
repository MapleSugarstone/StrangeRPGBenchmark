import type { MapDef } from '../game/world';
import type { Ctx, Script } from '../game/script';
import type { ChapterDef } from './index';
import { NPC } from '../data/portraits';
import { nextChapter } from './common';
import { Grid } from './grid';

const f = (s: Ctx, k: string) => s.has(k);

// ---------- The Loom's gate hall ----------

function buildGate(): string[] {
  const g = new Grid(37, 24, 'M');
  g.rect(1, 1, 35, 22, 'Q');
  for (const x of [5, 11, 25, 31]) { g.rect(x, 2, 1, 7, '/'); g.rect(x, 14, 1, 8, '/'); }
  g.rect(15, 9, 7, 5, 'O');
  g.put(18, 22, 'e').put(18, 1, 'x');
  g.put(18, 11, 't').put(16, 20, 'l').put(8, 5, 'p').put(28, 5, 'q').put(3, 20, 'a').put(33, 20, 'b');
  return g.rows();
}

const gateIntro: Script = async s => {
  if (f(s, 'loomIntro')) return;
  s.flag('loomIntro');
  await s.tell('Inside, the Loom is a cathedral made of machinery. Threads of every color run up from the floor into a dark too high to see, humming as they move.');
  await s.tell('Except most of them are grey. Most of them have been grey for a long time.');
  await s.say('Nona', 'This is where I was made. There were ten thousand colors on these threads when I was new. I used to know all of their names.');
  await s.say('Tint', 'Where did they go?');
  await s.say('Nona', 'Down to you. Every stone, every frog, every one of you. And now, back up.');
};

const nonaTerminal: Script = async s => {
  if (f(s, 'terminalRead')) { await s.tell('The maintenance terminal shows one line: RESERVE INK: NINE SPOOLS. LOCATION: UNIT NONA.'); return; }
  s.flag('terminalRead');
  await s.tell('Nona puts a paw on an old maintenance terminal. It wakes, recognizes her, and scrolls.');
  await s.tell('INK RESERVE: EMPTY. EMERGENCY RECLAMATION: ACTIVE. TRIAGE UNIT: AWAKE. WEAVER: DORMANT.');
  await s.tell('The last line blinks: RESERVE INK: NINE SPOOLS. LOCATION: UNIT NONA.');
  await s.say('Wick', 'Nona. That\'s you. Your tails.');
  await s.say('Nona', 'Yes. Every maintenance unit carries a reserve. Mine are nearly the last ink in the Loom.');
  await s.say('Nona', 'Do not look at me like that, all of you. I have known for nine hundred years. Come. The Weaver is at the top of the Spindle Halls.');
};

const gate: MapDef = {
  id: 'loomGate', name: 'The Loom', music: 'loom', rows: buildGate(), under: 'Q', outside: 'M', bg: 'thread',
  legend: { Q: { kind: 'circuit', enc: true } },
  theme: { circuit: ['k', 'g1', 'c1'], machine: ['k', 'g1', 'g2'], thread: ['k', 'g2', 'm2'], grate: ['k', 'g1', 'g2'] },
  enc: { rate: 0.1, groups: [['spider2', 3], ['unp2', 2], ['serp', 2]] },
  ents: [
    { id: 'north', at: 'x', kind: 'warp', to: ['spindleHalls', 's', 'up'], under: 'Q' },
    { id: 'entry', at: 'e', kind: 'prop', spr: NPC.needleGate, talk: async s => s.tell('The gate. Through the gap, a strip of Mirrow\'s glass reflects the inside of the Loom back at itself.') },
    { id: 'terminal', at: 't', kind: 'prop', spr: NPC.terminal, talk: nonaTerminal },
    { id: 'lamp', at: 'l', kind: 'lamp' },
    { id: 'spool1', at: 'p', kind: 'prop', spr: NPC.spoolProp, talk: async s => s.tell('A spool as tall as a house, wound with a single violet thread. A tag reads: PRISMOUTH HARBOR, TUESDAY.') },
    { id: 'spool2', at: 'q', kind: 'prop', spr: NPC.spoolProp2, talk: async s => s.tell('A spool of amber and red. The tag reads: CARILLON, GREAT BELL.') },
    { id: 'chestA', at: 'a', kind: 'chest', item: 'honey', n: 2 },
    { id: 'chestB', at: 'b', kind: 'chest', item: 'none5' },
  ],
  enter: gateIntro,
};

// ---------- The Spindle Halls ----------

function buildHalls(): string[] {
  const g = new Grid(41, 34, '/');
  const room = (x: number, y: number, w: number, h: number, c = 'Q') => g.rect(x, y, w, h, c);
  room(15, 26, 11, 7);
  room(3, 17, 12, 7, 'V');
  room(26, 17, 12, 7, 'V');
  room(14, 12, 13, 8);
  room(3, 3, 12, 8);
  room(26, 3, 12, 8, 'V');
  room(17, 1, 7, 6);
  g.path([[20, 26], [20, 19]], 'Q');
  g.path([[15, 21], [14, 21], [9, 21], [9, 17]], 'Q');
  g.path([[26, 20], [31, 20], [31, 17]], 'Q');
  g.path([[9, 17], [9, 10]], 'Q');
  g.path([[31, 17], [31, 10]], 'V');
  g.path([[14, 7], [17, 7], [17, 5]], 'Q');
  g.path([[26, 7], [23, 7], [23, 5]], 'V');
  g.put(20, 32, 's').put(20, 1, 'n');
  g.put(20, 15, 'i').put(18, 14, 'j').put(23, 28, 'l').put(8, 5, 'v').put(6, 7, 'w').put(33, 21, 'a').put(5, 21, 'b').put(35, 5, 'c');
  g.put(17, 28, 'r');
  return g.rows();
}

const nilTalk: Script = async s => {
  if (f(s, 'nilJoined')) return;
  await s.tell('In the middle of the hall, something grey and patient is sweeping. It gathers the colored dust that drips off the threads into a small bin, one careful stroke at a time.');
  await s.say('Nil', 'Hello. Please step around the pile. It is Tuesday\'s red.');
  await s.say('Tint', 'Who are you?');
  await s.say('Nil', 'I am Nil. I sweep. Color falls off the threads and I sweep it into the bin, and the bin goes to the Bishop, and the Bishop feeds it to the Loom.');
  await s.tell('Nil turns its blank face toward Wick and holds very still.');
  await s.say('Nil', 'You are not in the index. I checked. I am in the index as zero. You are not in it at all. I have never met anything that was less there than me.');
  await s.say('Wick', 'Is that a compliment?');
  await s.say('Nil', 'I do not know. I have never been given one. I would like to see what you do next. Nothing I have swept has ever done anything.');
  await s.say('Nona', 'It knows the halls. And the Bishop will not look twice at a Blank.');
  s.flag('nilJoined');
  s.mech('echo');
  await s.join('nil', Math.max(24, s.st.members.wick.lvl));
  await s.tell('^yNil^0 has no hues, so hues never help or hurt it. When a foe\'s skill hits Nil, Nil ^yechoes^0 it and can use it from then on, paying ink.');
  await s.tell('Rooms with a grey floor are ^yquiet rooms^0. Hues do nothing in battles that start there.');
};

const vats: Script = async s => {
  if (!f(s, 'jarLost') || s.hasItem('gran_jar')) {
    await s.tell('Reclamation vats. Jars of stolen color stand in rows, waiting to be poured into the Loom. None of them are labeled Edgewick.');
    return;
  }
  await s.tell('Reclamation vats. Jars of stolen color stand in rows, waiting to be poured. One label reads UMBER, EDGEWICK. VINTAGE. DELIVERED BY THE CHOIR.');
  await s.say('Wick', 'Gran.');
  await s.give('gran_jar');
  await s.say('Brask', 'The Choir was punctual. So are we.');
};

const halls: MapDef = {
  id: 'spindleHalls', name: 'The Spindle Halls', music: 'loom', rows: buildHalls(), under: 'Q', outside: '/', bg: 'thread',
  legend: {
    Q: { kind: 'circuit', enc: true },
    V: { kind: 'grate', enc: true, greyzone: true },
  },
  theme: { circuit: ['k', 'g1', 'c1'], grate: ['k', 'g1', 'g2'], thread: ['k', 'g1', 'm1'] },
  enc: { rate: 0.13, groups: [['spider2', 3], ['unp2', 3], ['serp', 2], ['warden', 2], ['chorus', 2]] },
  ents: [
    { id: 'south', at: 's', kind: 'warp', to: ['loomGate', 'x', 'down'], under: 'Q' },
    { id: 'north', at: 'n', kind: 'warp', to: ['weaverChamber', 'e', 'up'], under: 'Q' },
    { id: 'nil', at: 'i', kind: 'npc', spr: NPC.nil, when: st => !st.flags.nilJoined, talk: nilTalk },
    { id: 'bin', at: 'j', kind: 'prop', spr: NPC.bin, talk: async s => s.tell('Nil\'s bin, full of colored dust. When Wick leans over it, it smells like every place at once.') },
    { id: 'lamp', at: 'l', kind: 'lamp' },
    { id: 'vats', at: 'v', kind: 'prop', spr: NPC.vat, talk: vats },
    { id: 'vats2', at: 'w', kind: 'prop', spr: NPC.vatJar, talk: vats },
    { id: 'chestA', at: 'a', kind: 'chest', item: 'grey_ward' },
    { id: 'chestB', at: 'b', kind: 'chest', item: 'ink_well', n: 3 },
    { id: 'chestC', at: 'c', kind: 'chest', item: 'green_mask' },
    { id: 'shop', at: 'r', kind: 'npc', spr: NPC.theologian, talk: async s => {
      await s.say('Spare Parts Bin', 'I AM A SPARE PARTS BIN. I HAVE BECOME SELF-AWARE. I WOULD LIKE TO TRADE.');
      await s.shop('loom');
    } },
  ],
};

// ---------- The Weaver's chamber ----------

function buildChamber(): string[] {
  const g = new Grid(21, 18, '/');
  g.rect(1, 1, 19, 16, 'O');
  g.rect(9, 11, 3, 6, 'Q');
  g.put(10, 2, 'w').put(10, 5, 'k').put(10, 8, 'b').put(10, 16, 'e').put(6, 12, 'p');
  g.put(4, 4, 'u').put(16, 4, 'v');
  return g.rows();
}

const spindleFight: Script = async s => {
  if (f(s, 'spindleDead')) return;
  s.music('boss');
  await s.tell('The chamber at the top of the Loom is round and very quiet. In its center, turning slowly, is the Spindle: the axle the whole machine hangs from. It notices them.');
  await s.say('Nona', 'The Spindle guards the Weaver. It will not let anyone wake her. Especially not me.');
  const r = await s.battle('boss7');
  if (r !== 'win') return;
  s.flag('spindleDead');
  await s.tell('The Spindle grinds to a stop. For the first time in a century, the Loom is completely still.');
};

const weaverScene: Script = async s => {
  if (!f(s, 'spindleDead')) { await s.tell('The Spindle is in the way.'); return; }
  if (f(s, 'ordealDone')) return;
  s.music('loom');
  await s.tell('Behind the stilled Spindle hangs an enormous glass eye, cloudy, the size of a house. Deep inside it, something opens.');
  await s.say('The Weaver', '...Nona? You came home. And you brought... oh. A misprint. I made a misprint once, at the very edge. I have always wondered.');
  await s.say('Wick', 'You made me?');
  await s.say('The Weaver', 'I made everyone. I was running low, even then. I had one ink left in the amber well and nothing in the second. I printed you anyway. It seemed better than printing nothing.');
  await s.tell('Wick does not know what to say to that. Wick says nothing.');
  await s.say('Nona', 'Weaver. The world is going grey. The Bishop is taking it back.');
  await s.say('The Weaver', 'Yes. I am sorry. The ink is gone, Nona. I have been printing on empty for a hundred years, and the world is unraveling at the edges. So I made a triage routine to keep the rest together.');
  await s.say('The Weaver', 'It takes back what the world can spare, and spends it on what it cannot. It gave itself a body. It gave itself a church. I think it gave itself a name.');
  await s.say('Brask', 'The Grey Bishop is your... housekeeping?');
  await s.say('The Weaver', 'He is me, being careful. I was never very good at being careful.');
  await s.tell('The chamber goes cold. The threads along the walls turn grey one by one.');
  await s.say('The Grey Bishop', 'You should not have woken it.');
  s.music('final');
  await s.tell('The Grey Bishop stands where the Spindle was, tall and white and grey, his blank face turned toward Nona.');
  await s.say('The Grey Bishop', 'Unit Nona. You are carrying nine spools of ink. Return them.');
  await s.say('Nona', 'No.');
  await s.say('The Grey Bishop', 'Then I will reclaim all of you, and take them from what is left.');
  await s.battle('ordeal', { canLose: true, survive: 5 });
  s.shake(60);
  await s.flash('w');
  await s.tell('The Bishop raises one hand, and the party comes apart.');
  await s.tell('Not in pain. In order. Tint\'s violet lifts off her like steam. Brask\'s moths go pale mid-flight. Nil, who has nothing to lose, loses its shape. Wick\'s hand goes transparent around the lamp.');
  await s.tell('Then nine lights go up, all at once.');
  await s.say('Nona', 'Nine tails. Nine spools. I was saving them for something important.');
  await s.tell('Nona spends them. Every tail unspools at once, and the ink pours out of her into the party, reprinting them line by line, color by color, faster than the Bishop can take them back.');
  await s.say('The Grey Bishop', 'Unit Nona. That was the last reserve.');
  await s.say('Nona', 'I know. I am a maintenance unit. This is maintenance.');
  await s.tell('When it is over, the party is whole. Nona is grey, and very small, and very still.');
  await s.say('Wick', 'Nona. Nona, you have to get up. You can\'t, you can\'t just...');
  await s.say('Nona', 'Wick. I kept one back. The ninth. It is not like the others.');
  await s.tell('A single thread of light that is not any color on the wheel slips out of her last tail and winds itself around Wick\'s wrist.');
  await s.say('Nona', 'The Ninth Ink. It is not on the wheel. It can print anything, once. You could print yourself a third hue with it. You could be whole.');
  await s.say('Nona', 'Or you could... well. You will think of something. You always light the lamp.');
  await s.tell('Nona does not say anything else.');
  s.leave('nona');
  s.toParty('brask');
  s.flag('nonaGone');
  s.flag('ordealDone');
  await s.give('ninth_spool');
  await s.say('Tock', '...I remembered this. I am sorry. I remembered it the whole way, and it didn\'t help at all.');
  await s.say('The Grey Bishop', 'The misprint again. Unindexed. Unfinished. Holding the last ink in the Loom.');
  await s.say('The Grey Bishop', 'It does not matter. The Loom will come down to the world now and take it all back directly. Starting at the edge. Starting with Edgewick.');
  s.shake(40);
  await s.tell('The floor opens. The reclamation chute swallows them, and they fall, and fall, out of the bottom of the Loom and down through the clouds.');
  await s.tell('Behind them, something grey and patient jumps in after them.');
  await nextChapter(s, 8);
};

const chamber: MapDef = {
  id: 'weaverChamber', name: 'The Weaver\'s Chamber', music: 'loom', rows: buildChamber(), under: 'O', outside: '/', bg: 'thread',
  theme: { grate: ['k', 'g1', 'c1'], circuit: ['k', 'g1', 'c2'], thread: ['k', 'g1', 'c1'] },
  ents: [
    { id: 'exit', at: 'e', kind: 'warp', to: ['spindleHalls', 'n', 'down'], under: 'Q' },
    { id: 'weaver', at: 'w', kind: 'npc', spr: NPC.weaver, talk: weaverScene },
    { id: 'spindle', at: 'k', kind: 'npc', spr: NPC.spindle, when: st => !st.flags.spindleDead, talk: spindleFight },
    { id: 'boss', at: 'b', kind: 'trigger', step: spindleFight, under: 'O' },
    { id: 'lamp', at: 'p', kind: 'lamp' },
    { id: 'spoolU', at: 'u', kind: 'prop', spr: NPC.spoolProp, talk: async s => s.tell('An empty spool. The tag says WELL ONE: AMBER. Underneath, in smaller letters: LAST USED AT THE EDGE.') },
    { id: 'spoolV', at: 'v', kind: 'prop', spr: NPC.spoolProp2, talk: async s => s.tell('An empty spool. The tag says WELL TWO. There is nothing else written on it.') },
  ],
};

export const maps: MapDef[] = [gate, halls, chamber];

export const chapter: ChapterDef = {
  title: 'The Loom',
  stage: 'The ordeal',
  blurb: 'The machine that printed the world is out of ink.',
  recruit: 'nil',
  ready: true,
  startMap: 'loomGate',
  startMarker: 'e',
  objective: st => {
    const fl = st.flags;
    if (!fl.nilJoined) return 'Climb through the Spindle Halls, north of the gate hall.';
    if (!fl.spindleDead) return 'Reach the Weaver\'s chamber at the top of the Spindle Halls.';
    return 'Speak to the Weaver.';
  },
  route: [
    { map: 'loomGate', ent: 'terminal' }, { map: 'loomGate', warp: 'north' },
    { map: 'spindleHalls', ent: 'nil' }, { map: 'spindleHalls', ent: 'vats' }, { map: 'spindleHalls', ent: 'shop' }, { map: 'spindleHalls', warp: 'north' },
    { map: 'weaverChamber', ent: 'boss' }, { map: 'weaverChamber', ent: 'weaver' },
  ],
};
