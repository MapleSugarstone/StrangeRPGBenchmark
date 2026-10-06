import type { MapDef } from '../game/world';
import type { Ctx, Script } from '../game/script';
import type { ChapterDef } from './index';
import { NPC } from '../data/portraits';
import { nextChapter } from './common';
import { Grid } from './grid';

const f = (s: Ctx, k: string) => s.has(k);

// ---------- The Fizz ----------

function buildFizz(): string[] {
  const g = new Grid(46, 32, '~');
  g.rect(12, 1, 34, 30, '.');
  g.rect(6, 14, 6, 16, '.');
  g.rect(1, 1, 10, 10, '.');
  g.rect(1, 14, 4, 16, '.');
  g.scatter(12, 1, 34, 30, '&', 0.5, 7, '.');
  g.scatter(6, 14, 6, 16, ',', 0.45, 8, '.');
  g.scatter(1, 1, 10, 10, ',', 0.35, 9, '.');
  g.scatter(1, 14, 4, 16, ',', 0.3, 12, '.');
  g.ellipse(35, 24, 3.5, 2.5, '~');
  g.ellipse(20, 23, 2.5, 1.6, '~');
  g.ellipse(38, 6, 2.5, 1.5, '~');
  g.scatter(13, 1, 32, 1, 'T', 0.5, 10);
  g.scatter(13, 29, 32, 2, 'T', 0.5, 11);
  g.scatter(44, 1, 2, 30, 'T', 0.4, 13);
  // The customs gate and the channel that makes it the only way west.
  g.rect(5, 12, 1, 18, '~');
  for (let y = 20; y <= 24; y++) g.put(5, y, 'N');
  // The island lock and the water barrier with its single cyan crossing.
  g.rect(11, 1, 1, 11, '~');
  g.put(11, 5, 'Z');
  // Violet people leave the island by the south gate, which lands east of customs.
  g.put(7, 11, 'N').put(7, 12, '.').put(7, 13, '.');
  g.rect(12, 11, 14, 2, '~');
  g.put(13, 11, 'L');
  g.put(13, 12, '.');
  // The radio station.
  g.rect(18, 2, 11, 6, '.');
  g.rect(19, 3, 9, 3, '^');
  g.rect(19, 6, 9, 1, 'B');
  g.put(20, 6, 'W').put(26, 6, 'W').put(23, 6, 'd');
  g.rect(28, 1, 1, 5, 'A');
  // Boardwalk from the east edge to the station.
  g.path([[45, 16], [28, 16], [28, 8], [23, 8], [23, 7]], '-');
  g.path([[23, 8], [16, 8], [16, 5], [12, 5]], ':');
  // Cyan treasure nook in the southeast.
  g.rect(39, 25, 6, 5, 'T');
  g.rect(40, 26, 4, 3, '.');
  g.put(39, 27, 'E');
  g.put(38, 27, '.');
  // Pools.
  g.put(4, 4, 'U');
  g.put(17, 10, 'J');
  // Markers.
  g.put(45, 16, 'e');
  g.put(0, 22, 'w');
  g.path([[1, 22], [4, 22]], ':');
  g.put(42, 27, 'm');
  g.put(8, 8, 'k');
  g.put(20, 27, 'n');
  g.put(2, 16, 'o');
  g.put(43, 3, 'q');
  g.put(34, 9, 'h');
  g.put(32, 19, 'g');
  g.put(38, 13, 'f');
  g.put(15, 25, 'j');
  g.put(7, 19, 'c');
  g.put(43, 15, 's');
  g.put(41, 18, '1');
  g.put(9, 27, '2');
  g.put(3, 9, 'r');
  return g.rows();
}

const hueTutorial: Script = async s => {
  if (f(s, 'hueTut')) return;
  s.flag('hueTut');
  s.mech('hues');
  await s.tell('West of Edgewick the world gets loud. The grass is two greens. The mud is three browns. A frog goes by in five colors and seems embarrassed about it.');
  await s.say('Wick', 'Everything out here is so... finished.');
  await s.say('Nona', 'Out here, colors are not decoration. Listen. Every creature the Loom prints has two hues, and hues fight.');
  await s.say('Nona', 'A hue hits its opposite for half again as much. It hits its own hue for a quarter less. Red and cyan are opposites. So are amber and blue, and green and violet.');
  await s.say('Nona', 'And a creature\'s two colors are its hues. So look at what you are fighting. Its colors tell you what hurts it.');
  await s.say('Wick', 'My Kindle is amber. So it hits blue things hard.');
  await s.say('Nona', 'And blue things hit you hard, misprint. Amber is your only hue. Keep an eye on the blue ones.');
  await s.tell('^yHues^0 are now shown in the menu. While picking a target, the damage multiplier appears next to its name.');
};

const tintRecruit: Script = async s => {
  if (f(s, 'tintJoined')) {
    await s.say('Tint', 'What? I\'m right here. I\'m always right here, unless I\'m painting something.');
    return;
  }
  await s.say('Tint', 'I don\'t CARE if it\'s against station policy, Ribbit. Broadcast it. HUE THIEF LOOSE IN PRISMOUTH. LOCK UP YOUR REDS.');
  await s.say('DJ Ribbit', 'Babe, it\'s a music station. We play the silence between the static. It\'s very popular with the frogs.');
  await s.tell('The girl in the bubble helmet turns around. Her robe is violet, her hair is green, and paint is dripping off the brush she carries like a broom.');
  await s.say('Tint', 'Whoa. You\'re two colors. Did somebody leave you out in the sun?');
  await s.say('Nona', 'Wick is a Duotone. Printed that way.');
  await s.say('Tint', 'Huh. Neat. Low maintenance.');
  await s.tell('Wick waits for the pity. It doesn\'t come.');
  await s.say('Tint', 'I\'m Tint. I paint things. Lately I paint OVER things, because something is stealing the colors off Prismouth.');
  await s.say('Tint', 'The harbor went grey on Tuesday. My lighthouse lost its stripes on Wednesday. It\'s Thursday, and I\'d like to keep my face.');
  await s.say('Nona', 'We are going to Prismouth ourselves. We need to read the Lens.');
  await s.say('Tint', 'Then we\'re going the same way, and I hit things with paint. Come on.');
  s.flag('tintJoined');
  await s.join('tint', Math.max(5, s.st.members.wick.lvl));
  await s.tell('^yTint^0 carries one hue on her brush at a time. ^yLoad Brush^0 picks it. ^yDaub^0 hits with it. ^ySplash^0 repaints a foe\'s first hue to whatever is loaded, so the rest of the party can hit its new weakness.');
  await s.say('Tint', 'One problem. Prismouth customs only lets in tinted people. This week\'s tint is violet. There\'s a violet pool out on the little island, but the island has an amber lock on it.');
  await s.say('Tint', 'Step in a pool and you take its color. A gate only opens for its own color. And watch out for the cyan puddle on the south crossing. It\'ll wash you right out.');
};

const fizz: MapDef = {
  id: 'fizz', name: 'The Fizz', music: 'marsh', rows: buildFizz(), under: '.', outside: '~', bg: 'tree',
  legend: {
    U: { kind: 'ground', paint: 'M' },
    J: { kind: 'ground', paint: 'Y' },
    L: { kind: 'ground', paint: 'C' },
    N: { kind: 'gate', gate: 'M' },
    Z: { kind: 'gate', gate: 'Y' },
    E: { kind: 'gate', gate: 'C' },
  },
  theme: {
    ground: ['k', 'e1', 'n1'], static: ['k', 'c1', 'c3'], tall: ['k', 'e1', 'e2'], water: ['k', 'b1', 'b2'],
    tree: ['k', 'n1', 'e1'], planks: ['k', 'n1', 'n2'], path: ['k', 'n1', 'c1'], roof: ['k', 'b1', 'c2'],
    brick: ['k', 'n1', 'n2'], antenna: ['k', 'g1', 'y2'], window: ['k', 'n1', 'y3'],
  },
  enc: { rate: 0.12, groups: [['bog2', 3], ['fish2', 3], ['heron', 3], ['newt3', 2], ['slime3', 2], ['wisp2', 2]] },
  ents: [
    { id: 'east', at: 'e', kind: 'warp', to: ['edgewick', 'x', 'right'], under: '-' },
    { id: 'west', at: 'w', kind: 'warp', to: ['prismouth', 'e', 'left'], under: ':' },
    { id: 'door', at: 'd', kind: 'warp', to: ['radio', 'd', 'up'], under: 'D' },
    { id: 'lamp1', at: '1', kind: 'lamp' },
    { id: 'lamp2', at: '2', kind: 'lamp' },
    { id: 'sign', at: 's', kind: 'sign', text: 'THE FIZZ. Frog Radio Station, north. Prismouth, west, through customs. Please do not lick the static.' },
    { id: 'chestM', at: 'm', kind: 'chest', item: 'blue_wick' },
    { id: 'chestK', at: 'k', kind: 'chest', item: 'feed_horn' },
    { id: 'chestN', at: 'n', kind: 'chest', gold: 60 },
    { id: 'chestO', at: 'o', kind: 'chest', item: 'relight' },
    { id: 'chestQ', at: 'q', kind: 'chest', item: 'ink_vial', n: 2 },
    { id: 'chestR', at: 'r', kind: 'chest', item: 'prism', n: 2 },
    {
      id: 'dish', at: 'h', kind: 'npc', spr: NPC.dish, talk: async s => {
        if (f(s, 'dishDone')) { await s.say('Dishwater', 'I CAN HEAR THE SKY AGAIN. IT IS STILL SAYING RECLAIM. I LIKED IT BETTER DEAF.'); return; }
        if (s.hasItem('feed_horn')) {
          s.take('feed_horn');
          s.flag('dishDone');
          await s.tell('Wick fits the feed horn back onto the dish. It shudders, points itself at the sky, and listens.');
          await s.say('Dishwater', 'SIGNAL. SIGNAL! THANK YOU, SMALL AMBER PERSON. TAKE THIS. IT FELL OUT OF A PASSING SATELLITE. I ASSUME IT IS VALUABLE.');
          await s.give('ink_ring');
          await s.say('Dishwater', 'BEFORE I WENT DEAF, THE SKY WAS SAYING ONE WORD, OVER AND OVER. THE WORD WAS: RECLAIM.');
          await s.say('Nona', '...Reclaim. That is a Loom word. It is what we do with scrap.');
          return;
        }
        await s.say('Dishwater', 'I USED TO TALK TO THE SKY. NOW I HEAR ONLY FROGS. MY FEED HORN FELL OFF. I THINK A HERON TOOK IT TO THE ISLAND. HERONS LOVE CONES.');
      },
    },
    {
      id: 'grayling', at: 'g', kind: 'npc', spr: NPC.grayling, talk: async s => {
        if (f(s, 'metGrayling')) { await s.say('Brother Grayling', 'Carillon, child. When the bells ring grey, you will understand.'); return; }
        s.flag('metGrayling');
        await s.tell('A pale man in a grey robe hums a single note. Every frog within earshot goes quiet.');
        await s.say('Brother Grayling', 'Peace, travelers. I walk to Carillon, to sing with the Choir. Color is a noise, you know. We sing it quiet.');
        await s.say('Brother Grayling', 'And you. Two inks. You are almost quiet already. The Choir would love you.');
        await s.say('Tint', 'Wow. Okay. Walk faster, please.');
      },
    },
    { id: 'frog1', at: 'f', kind: 'npc', spr: NPC.frog, wander: true, talk: async s => s.say('Frog', 'Ribbit. That is not a word. It is my callsign.') },
    { id: 'frog2', at: 'j', kind: 'npc', spr: NPC.frogB, wander: true, talk: async s => s.say('Frog', 'The static here is very nutritious. I eat it and I broadcast it. The circle of life, but on AM.') },
    {
      id: 'customs', at: 'c', kind: 'npc', spr: NPC.customs, talk: async s => {
        const tinted = s.st.tint === 'M';
        if (s.has('gateOpen:fizz:M')) await s.say('Customs Frog', 'Oh, you again. You\'re on the list now. Go right through, paint or no paint.');
        else if (tinted) await s.say('Customs Frog', 'Violet! Correct tint. Welcome to Prismouth. Please enjoy our colors while we still have them.');
        else await s.say('Customs Frog', 'Prismouth Customs. Tinted persons only. This week\'s tint is violet. Last week it was enthusiasm, but we couldn\'t measure it.');
      },
    },
  ],
  enter: hueTutorial,
};

const radio: MapDef = {
  id: 'radio', name: 'Frog Radio', music: 'marsh', under: '-', outside: '#',
  rows: [
    '############',
    '#WW##MM##WW#',
    '#----MM----#',
    '#-t--r-----#',
    '#----------#',
    '#-CCsCC--l-#',
    '#----------#',
    '#####d######',
  ],
  legend: { C: { kind: 'fence', solid: true } },
  theme: { wall: ['k', 'c1', 'c2'], planks: ['k', 'n1', 'n2'], fence: ['k', 'n1', 'e2'], machine: ['k', 'g1', 'm2'], window: ['k', 'n1', 'y3'] },
  ents: [
    { id: 'door', at: 'd', kind: 'warp', to: ['fizz', 'd', 'down'], under: 'D' },
    { id: 'tint', at: 't', kind: 'npc', spr: { g: 'human', seed: 'tint', pal: ['k', 'm2', 'e3'], o: { head: 'bubble', torso: 'robe', legs: 'skirt', held: 'brush' } }, when: st => !st.flags.tintJoined, talk: tintRecruit },
    { id: 'ribbit', at: 'r', kind: 'npc', spr: NPC.ribbit, talk: async s => {
      if (!f(s, 'tintJoined')) { await s.say('DJ Ribbit', 'You\'re listening to Frog Radio. We\'re dealing with a situation. The situation is wearing a bubble helmet.'); return; }
      await s.say('DJ Ribbit', 'You\'re listening to Frog Radio, the only station in the Fizz that plays the silence between the static. Next up: forty minutes of that.');
    } },
    { id: 'shop', at: 's', kind: 'npc', spr: NPC.frog, under: 'C', talk: async s => {
      await s.say('Frog', 'Trading post. We take gold. We used to take flies, but the economy moved on.');
      await s.shop('fizz');
    } },
    { id: 'lamp', at: 'l', kind: 'lamp' },
  ],
};

// ---------- Prismouth ----------

function house(g: Grid, x: number, y: number, w: number, wall: string, door?: string) {
  g.rect(x, y, w, 2, '^');
  g.rect(x, y + 2, w, 1, wall);
  g.put(x + 1, y + 2, 'W');
  g.put(x + w - 2, y + 2, 'W');
  if (door) g.put(x + Math.floor(w / 2), y + 2, door);
}

function buildPrismouth(): string[] {
  const g = new Grid(36, 28, '~');
  g.rect(0, 6, 36, 19, '.');
  g.rect(14, 1, 8, 6, '.');
  g.rect(16, 1, 4, 4, 'P');
  g.put(17, 4, 'd');
  g.scatter(0, 6, 36, 19, '"', 0.05, 21, '.');
  g.path([[1, 18], [34, 18]], ':');
  g.path([[17, 5], [17, 18]], ':');
  g.ellipse(17, 12, 4, 2.5, ':');
  g.put(17, 12, '~');
  house(g, 3, 7, 6, 'V');
  house(g, 26, 7, 6, 'B');
  house(g, 3, 12, 5, 'B');
  house(g, 27, 12, 6, 'V');
  house(g, 9, 19, 6, 'B');
  house(g, 22, 19, 7, 'B');
  g.rect(0, 25, 36, 3, '~');
  for (const px of [6, 18, 30]) g.rect(px, 24, 2, 4, '-');
  g.scatter(0, 6, 36, 1, '%', 0.4, 22, '."');
  g.put(35, 18, 'e');
  g.put(0, 18, 'x');
  g.put(12, 23, 's');
  g.put(25, 23, 'i');
  g.put(19, 24, 'o');
  g.put(25, 10, 'u');
  g.put(10, 16, 'p');
  g.put(31, 25, 'c');
  g.put(21, 15, 't');
  g.put(14, 16, 'l');
  g.put(33, 21, 'h');
  g.put(2, 21, 'k');
  g.put(18, 6, 'y');
  return g.rows();
}

const innkeeper: Script = async s => {
  await s.say('Marl', 'The Primer. Best beds in Prismouth. Every sheet a different color, so you always know which sheet you are in. Twenty-five gold a night.');
  const i = await s.ask('Rest for 25 gold?', ['Rest', 'No thanks']);
  if (i !== 0) return;
  if (s.st.gold < 25) { await s.say('Marl', 'Short on gold? Sleep on the pier. It is also colorful. Mostly blue.'); return; }
  await s.gold(-25, true);
  await s.fadeOut();
  s.heal();
  s.save();
  await s.fadeIn();
  await s.tell('The party wakes up rested. Progress saved.');
};

const lighthouseDoor: Script = async s => {
  if (!f(s, 'sawThief')) {
    s.flag('sawThief');
    s.shake(20);
    await s.tell('Something huge is wrapped around the lighthouse. Eight arms, each a different stolen color, are pulling the stripes off the tower one by one.');
    await s.say('Harbormistress Coral', 'It\'s on the lighthouse! The thief is going for the Lens!');
    await s.say('Tint', 'That\'s MY lighthouse. Get off my lighthouse!');
    await s.say('Nona', 'If it drinks the Lens, Prismouth goes dark and we lose our only way to read the sky. Up the stairs. Quickly.');
  }
  await s.warp('lighthouse', 'e', 'up');
};

const westRoad: Script = async s => {
  if (s.st.chapter >= 3) { await s.warp('carillonRoad', 'e', 'left'); return; }
  if (!f(s, 'lampPainted')) {
    await s.say('Wick', 'Not yet. We came for the Lens.');
    await s.movePlayer('r');
    return;
  }
  await s.tell('The road west climbs out of Prismouth toward a far-off sound of bells.');
  await nextChapter(s, 3);
};

const tintLamp: Script = async s => {
  if (f(s, 'lampPainted')) {
    await s.say('Tint', 'The road west goes to Carillon. That\'s where the bells are, and bells are where the Choir is. Let\'s go ruin a hymn.');
    return;
  }
  s.flag('lampPainted');
  s.music('town');
  await s.say('Tint', 'Hold still. Not you. Your lamp.');
  await s.tell('Tint flicks her brush. A thin violet stripe appears on the glass of Wick\'s lamp.');
  await s.say('Wick', 'You painted it.');
  await s.say('Tint', 'I painted your lamp, not you. You\'re fine how you are. The lamp looked lonely.');
  await s.say('Wick', 'I always thought colors were something you had or you didn\'t.');
  await s.say('Tint', 'Colors are for sharing. That\'s why there are so many of them.');
  await s.say('Nona', 'The Lens shard points west and up. West is Carillon, where the Church of the Loom keeps the Tether gate. Up is the Loom.');
  await s.say('Tint', 'Then we go west. Somebody stole my stripes and now somebody\'s stealing the sky. I\'m not letting grey win twice.');
};

const prismouth: MapDef = {
  id: 'prismouth', name: 'Prismouth', music: 'town', rows: buildPrismouth(), under: '.', outside: '~', bg: 'bush',
  enter: async s => {
    if (s.has('gateOpen:fizz:M')) return;
    s.flag('gateOpen:fizz:M');
    await s.tell('The sea spray washes the violet off. Customs has your name now, so the gate will open for you either way.');
  },
  legend: { V: { kind: 'wall', solid: true } },
  theme: {
    ground: ['k', 'e1', 'e2'], flowers: ['k', 'e1', 'm3'], path: ['k', 'g2', 'w'], brick: ['k', 'm1', 'm2'], wall: ['k', 'g1', 'g2'],
    roof: ['k', 'c1', 'c2'], window: ['k', 'b1', 'y3'], pillar: ['k', 'w', 'r2'], water: ['k', 'b1', 'c2'], planks: ['k', 'n1', 'n2'], bush: ['k', 'e1', 'e3'],
  },
  ents: [
    { id: 'east', at: 'e', kind: 'warp', to: ['fizz', 'w', 'right'], under: ':' },
    { id: 'west', at: 'x', kind: 'trigger', step: westRoad, under: ':' },
    { id: 'door', at: 'd', kind: 'trigger', step: lighthouseDoor, under: 'D' },
    { id: 'shop', at: 's', kind: 'npc', spr: NPC.paintshop, talk: async s => {
      await s.say('Swatch', 'Prismouth Paints! Every color we have left, at prices that reflect how few that is.');
      await s.shop('prismouth');
    } },
    { id: 'inn', at: 'i', kind: 'npc', spr: NPC.innkeeper, talk: innkeeper },
    { id: 'coral', at: 'o', kind: 'npc', spr: NPC.coral, talk: async s => {
      if (f(s, 'octoDead')) await s.say('Harbormistress Coral', 'The harbor is blue again. I have never been so happy to see blue. Blue is the second color I have ever cried about.');
      else await s.say('Harbormistress Coral', 'The lighthouse is Tint\'s. The Lens is everyone\'s. The thief is nobody\'s, and I would like it to stay that way.');
    } },
    { id: 'ulla', at: 'u', kind: 'npc', spr: NPC.ulla, talk: async s => s.say('Ulla', f(s, 'octoDead') ? 'The wave came back! Well. It is still moving. I will get it one day.' : 'I have painted the same wave for eleven years. It keeps moving. Now it is grey and it STILL keeps moving.') },
    { id: 'pipGrey', at: 'p', kind: 'npc', spr: NPC.pipGrey, when: st => !st.flags.octoDead, talk: async s => s.say('Pip', 'The thief took my colors. Now I\'m the same as the pavement. Mum keeps stepping on me.') },
    { id: 'pip', at: 'p', kind: 'npc', spr: NPC.pip, when: st => !!st.flags.octoDead, talk: async s => {
      await s.say('Pip', 'I\'m orange! And green! Mum says I\'m too loud now. I say that\'s the point.');
      if (!f(s, 'pipGift')) { s.flag('pipGift'); await s.say('Pip', 'Here. I found this in the gutter when I was pavement. Pavement finds lots of stuff.'); await s.give('candle', 2); }
    } },
    { id: 'captain', at: 'c', kind: 'npc', spr: NPC.captain, talk: async s => s.say('Captain Nebb', 'My beard is a nebula. It came with the ship. The ship is gone. The beard stays. Stars get in my soup.') },
    { id: 'tint', at: 't', kind: 'npc', spr: { g: 'human', seed: 'tint', pal: ['k', 'm2', 'e3'], o: { head: 'bubble', torso: 'robe', legs: 'skirt', held: 'brush' } }, when: st => !!st.flags.octoDead, talk: tintLamp },
    { id: 'lamp', at: 'l', kind: 'lamp' },
    { id: 'boat', at: 'h', kind: 'prop', spr: NPC.boat, talk: async s => s.tell('A rowboat painted in seven colors. Someone has written HUE THIEF KEEP OUT on the side in an eighth.') },
    { id: 'chestK', at: 'k', kind: 'chest', item: 'paint_bomb' },
    { id: 'chestY', at: 'y', kind: 'chest', gold: 90 },
  ],
};

// ---------- Tint's lighthouse ----------

const LIGHTHOUSE = [
  '###########',
  '#_________#',
  '#____l____#',
  '#_________#',
  '#____b____#',
  '#####_#####',
  '#_________#',
  '#_#######_#',
  '#_#_____#_#',
  '#_#_c___#_#',
  '#_###_###_#',
  '#_________#',
  '#########_#',
  '#_______#_#',
  '#_#####_#_#',
  '#_#_____#_#',
  '#_#_#####_#',
  '#___#_____#',
  '#####_###_#',
  '#_______#_#',
  '#_#####___#',
  '#___1_____#',
  '#____e____#',
  '###########',
];

const octoFight: Script = async s => {
  if (f(s, 'octoDead')) return;
  s.music('boss');
  await s.tell('At the top of the tower the Lens turns slowly, throwing light in six directions. Wrapped around it is the Hue Thief.');
  await s.say('Octachrome', 'Mmmm. More. A lighthouse full of color, and here comes a snack with two colors. Only two? How sad. How easy.');
  await s.say('Tint', 'Watch its colors. It keeps changing them. Whatever it\'s wearing is what it\'s weak against the opposite of.');
  await s.say('Nona', 'In plain words: look at it before you hit it.');
  const r = await s.battle('boss2');
  if (r !== 'win') return;
  s.flag('octoDead');
  s.shake(30);
  s.sfx('break');
  await s.flash('w');
  await s.tell('Octachrome bursts. Eight stolen colors spray out over Prismouth like fireworks and settle back where they belong.');
  await s.tell('Then the Lens, strained too long, cracks straight through.');
  await s.tell('The broken Lens throws one last picture onto the wall. A city built inside the ribs of a dead giant. A choir in grey robes, singing color out of the air. On top of a bell tower, a figure in grey and white, looking up.');
  await s.say('Nona', 'The Church of the Loom. I know those bells. They ring on the Loom\'s own frequency.');
  await s.say('Wick', 'Then the grey is coming from the Church?');
  await s.say('Nona', 'From the Church, or through it.');
  await s.tell('The light goes out. The lighthouse is dark for the first time in a hundred years.');
  await s.say('Tint', '...That was my lighthouse.');
  await s.tell('Tint picks up a shard of the Lens. It glints and turns in her hand until it points west and up.');
  await s.say('Tint', 'It still points somewhere. Fine. Then I\'m going where it points.');
  await s.give('lens_shard');
  await s.warp('prismouth', 'd', 'down');
};

const lighthouse: MapDef = {
  id: 'lighthouse', name: 'Tint\'s Lighthouse', music: 'town', rows: LIGHTHOUSE, under: '_', outside: '#', bg: 'pillar',
  legend: { '_': { kind: 'floor', enc: true } },
  theme: { wall: ['k', 'r1', 'w'], floor: ['k', 'n1', 'r1'], pillar: ['k', 'w', 'r2'] },
  enc: { rate: 0.1, groups: [['wisp2', 3], ['wisp3', 2], ['newt3', 1]] },
  ents: [
    { id: 'exit', at: 'e', kind: 'warp', to: ['prismouth', 'd', 'down'], under: '_' },
    { id: 'lens', at: 'l', kind: 'npc', spr: NPC.lens, when: st => !st.flags.octoDead, talk: async s => s.tell('The Lens hums. It is too bright to look at directly.') },
    { id: 'lensCracked', at: 'l', kind: 'npc', spr: NPC.lensCracked, when: st => !!st.flags.octoDead, talk: async s => s.tell('The cracked Lens is dark. A piece is missing. Tint has it.') },
    { id: 'boss', at: 'b', kind: 'trigger', step: octoFight },
    { id: 'chest', at: 'c', kind: 'chest', item: 'violet_bristle' },
    { id: 'lamp', at: '1', kind: 'lamp' },
  ],
};

export const maps: MapDef[] = [fizz, radio, prismouth, lighthouse];

export const chapter: ChapterDef = {
  title: 'Hue and Cry',
  stage: 'Crossing the threshold',
  blurb: 'Past the last lamp, the world is loud with color, and every color is a weakness.',
  recruit: 'tint',
  ready: true,
  startMap: 'fizz',
  startMarker: 'e',
  objective: st => {
    const fl = st.flags;
    if (!fl.tintJoined) return 'Cross the Fizz. The radio station is north of the boardwalk.';
    if (st.tint !== 'M' && !fl.sawThief) return 'Prismouth customs wants a violet tint. The violet pool is on the island behind the amber gate. The amber pool is near the station.';
    if (!fl.octoDead) return 'Get through customs to Prismouth and climb Tint\'s lighthouse.';
    if (!fl.lampPainted) return 'Find Tint in the square.';
    return 'Take the west road out of Prismouth toward Carillon.';
  },
  route: [
    { map: 'fizz', warp: 'door' }, { map: 'radio', ent: 'tint' }, { map: 'radio', ent: 'shop' }, { map: 'radio', warp: 'door' },
    { map: 'fizz', ent: 'dish' }, { map: 'fizz', warp: 'west' },
    { map: 'prismouth', ent: 'shop' }, { map: 'prismouth', ent: 'door' },
    { map: 'lighthouse', ent: 'boss' },
    { map: 'prismouth', ent: 'pip' }, { map: 'prismouth', ent: 'tint' }, { map: 'prismouth', ent: 'west' },
  ],
};
