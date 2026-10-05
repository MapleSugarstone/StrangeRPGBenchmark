import { Grid } from './grid';
import { MapDef, t } from './types';
import { registerSpeaker } from '../game/speakers';
import type { Ctx } from '../game/ctx';
import { page } from './side';

const P = (tt: string, seed: string, a: string, b: string) => ({ t: tt, seed, a, b });
const SEA = P('blob', 'thesea', 'sea', 'white');
registerSpeaker('sea', 'The Sea', SEA, 'sky');
registerSpeaker('ark', 'The Patient Ark', P('machine', 'ark', 'white', 'teal'), 'mint');
registerSpeaker('deadletter', 'Dead Letter', P('blob', 'deadletter', 'paper', 'sea'), 'paper');

const WATER = {
  s: t.floor('tan', 'plea', 'sand'), r: t.solid('rock', 'slate', 'navy'), T: t.solid('tree', 'tan', 'green'),
  '~': { k: 'water', a: 'sea', b: 'sky', water: true, needs: 'c8_raft' }, '%': { k: 'water', a: 'navy', b: 'sea', water: true, needs: 'c8_lifeboat' },
  K: t.solid('pillar', 'white', 'teal'), '+': t.deco('door', 'teal', 'white'), M: t.solid('pillar', 'slate', 'red'), f: t.deco('crate', 'tan', 'brown'),
};

const rescued = (c: Ctx) => ['bigger', 'anyone', 'again', 'both'].filter((id) => c.flag('c8_r_' + id)).length;

async function rejoin(c: Ctx, id: string) {
  c.set('c8_r_' + id);
  await c.join(id, c.num('lvl_' + id) || c.avgLevel(), true);
  c.sfx('level');
  await c.say(null, `${id === 'both' ? 'Both' : id[0].toUpperCase() + id.slice(1)} rejoins the party.`);
  if (rescued(c) === 4) await c.say(null, 'Everyone is back. Everyone who can come back. Far out on the water, something small is drifting: a raft, with someone on it.');
}

// ---------------------------------------------------------------- the shore
const sh = new Grid(30, 24, 's').rect(0, 16, 30, 8, '~').rect(22, 0, 8, 24, '~').rect(0, 0, 22, 1, 'r').rect(0, 0, 1, 16, 'r');
sh.scatter('T', 7, 801, 's', 2).scatter('f', 5, 802, 's', 2);

const SHORE: MapDef = {
  id: 'shore', name: 'The Lonesome Sea', chapter: 8, music: 'sea', bg: 'sea', battleBg: ['sky', 'sea'], weather: 'foam',
  rows: sh.rows(), legend: WATER,
  ferals: [{ x: 12, y: 6, group: 'sh1' }, { x: 16, y: 12, group: 'sh2' }],
  digs: [{ x: 4, y: 4, id: 'o_calm', slip: 'calmsea' }, { x: 14, y: 14, id: 'o_shell', slip: 'seashell' }, { x: 19, y: 3, id: 'o_feast', item: 'feast' }],
  npcs: [{ id: 'phone', x: 3, y: 8, sprite: P('object', 'payphone', 'slate', 'sky'), talk: (c) => c.payphone() }],
  triggers: [{ x: 6, y: 16, w: 8, touch: true, show: (c) => c.flag('c8_raft'), run: (c) => fishing(c) }],
  exits: [{ x: 29, y: 1, h: 22, to: 'sea', tx: 2, ty: 20, dir: 1 }],
  enter: async (c) => {
    if (c.flag('c8_wake')) return;
    c.set('c8_wake');
    c.s.chapter = 8;
    c.music('sad');
    await c.wait(40);
    await c.say(null, 'You wake on wet sand. Your mouth tastes like old paper. Someone is gone. You remember who, and then you wish you did not.');
    await c.say(null, 'You are alone. In front of you, all the way to the edge of the world, there is water.');
    await c.say(null, 'A sea. In the Silt. Nobody in Lowmost ever believed there was a sea. Someday did.');
    await c.walk('hero', 'ddddd', 10);
    await c.say('hello', "Someday. I'm seeing it.");
    await c.wait(40);
    await c.say(null, 'A wave comes in, slowly, and goes out, and leaves a word written in the sand: hello?');
    await c.say('sea', '...Are you LOOKING at me?');
    await c.say('hello', 'Hello. Yes.');
    await c.say('sea', 'Oh. Oh, oh, oh. Nobody has ever looked at me.');
    await c.say('sea', 'I grew from "Please, just once, let me see the sea." A girl who never left the plains asked for me. But the Silt made the sea, and not the seeing. So I have been here ever since, seen by nobody.');
    await c.say('sea', 'I bring things up onto the shore. Shells. Bottles. Wrecks. I hoped someone would come to look at them, and then at me.');
    await c.say('sea', 'Things fell into me all night. Your friends. I caught them as gently as I could. They are out on me somewhere, scattered.');
    await c.say('sea', 'Will you keep looking at me while you look for them? It is all I have ever wanted.');
    await c.say('hello', 'I can do that.');
    await c.say('sea', 'Then here. I have been saving this.');
    c.set('c8_raft');
    c.sfx('item');
    await c.say(null, 'A wave sets a raft at your feet: driftwood and old slips, lashed together very carefully.');
    await c.say(null, 'You can sail on calm water now. The dark currents are too strong for a raft.');
    await c.say('sea', 'There is a ship in the middle of me. I brought it here nine thousand years ago. Something inside it is still awake.');
    c.music('sea');
  },
};

const BOTTLES = [
  'A bottle with a note inside: "To whoever finds this. I am on an island. It is a nice island. I am not asking to be rescued. I just wanted someone to know it is nice."',
  'A bottle with a recipe in it, for a soup with eleven ingredients. At the bottom: "My mother never wrote it down. This is my best guess. If you make it, tell me if it is right."',
  'A bottle with a child\'s drawing of a whale in it. The whale is labeled DAD. The sea is labeled THE SEA. Someone has added, in a different hand, YES.',
  'A bottle with a single line: "If you are reading this, I made it across."',
  'A bottle with a list in it. Milk. Thread. Call Rosa. Call Rosa. CALL ROSA. The last one is underlined three times.',
  'A bottle with a pressed flower in it, and nothing else. The flower is still a little bit purple.',
  'A bottle with a note: "I threw this in the sea because the sea is the only thing big enough to hold it. I am sorry I left. I would do it again. I am sorry."',
  'A bottle with a ticket stub from a show nobody here has heard of. On the back: "Best night. Do not lose this." It got lost anyway. It ended up here.',
];

async function fishing(c: Ctx) {
  if (!c.q('bottles')) {
    await c.say('sea', 'You are looking at me again! Here. Things come in at the end of the beach. Bottles, mostly. People throw them into seas. I am the sea they land in.');
    await c.say('sea', 'There is a line and a hook tied to that post. Fish some out. Read them. Nobody ever reads them.');
    await c.quest('bottles');
  }
  const r = await c.ask(null, 'Fish from the end of the beach?', ['Fish', 'Not now']);
  if (r !== 0) return;
  const res = await c.minigame('fish');
  for (const k of res.catches ?? []) {
    if (k === 'bottle') {
      const i = c.num('c8_bottle');
      if (i < BOTTLES.length) { c.inc('c8_bottle'); await c.say(null, BOTTLES[i]); }
      else await c.pleas(25);
    } else if (k === 'page') {
      if (!c.flag('page_12')) { await c.say('sea', 'That one fell into me from very high up. It has a stamp on it.'); await page(c, 12); }
      else await c.pleas(40);
    } else if (k === 'shell' && !c.flag('c8_shell')) {
      c.set('c8_shell');
      await c.say(null, 'A shell that hums. If you hold it to your ear you hear the sea, and the sea can hear you back.');
      await c.give('hummingshell');
    } else if (k === 'boot' && !c.flag('c8_boot')) {
      c.set('c8_boot');
      await c.say(null, 'A left boot, full of water. Inside, on a slip: "Please let me find the other one."');
      await c.give('leftboot');
    } else await c.pleas(15);
  }
  if ((res.catches?.length ?? 0) >= 5 && !c.qdone('bottles')) {
    await c.say('sea', 'Five! You read all of them. Thank you for reading them. Thank you for looking.');
    await c.give('feast', 2);
    await c.finish('bottles');
  }
}

// ---------------------------------------------------------------- the open sea
const se = new Grid(50, 40, '~').rect(0, 0, 2, 40, 's');
se.frame(39, 3, 7, 6, '%').rect(40, 4, 5, 4, '%').rect(41, 5, 3, 2, 's');
se.frame(5, 2, 8, 7, '%').rect(6, 3, 6, 5, '%').rect(7, 4, 4, 3, 's').put(8, 4, 'M');
se.frame(37, 27, 10, 8, '%').rect(38, 28, 8, 6, '%').rect(39, 29, 6, 4, 's');
se.frame(7, 28, 9, 9, '%').rect(8, 29, 7, 7, '%').rect(10, 31, 3, 3, 's');
se.frame(42, 16, 5, 5, '%').rect(43, 17, 3, 3, '%').put(44, 18, 'f');
se.rect(20, 15, 10, 8, 'K').put(24, 23, '+').rect(21, 5, 7, 6, '%');
se.scatter('r', 14, 811, '~', 3);

const OPEN: MapDef = {
  id: 'sea', name: 'The Lonesome Sea', chapter: 8, music: 'sea', bg: 'sea', battleBg: ['sky', 'sea'], weather: 'foam',
  rows: se.rows(), legend: WATER,
  npcs: [
    {
      id: 'r_bigger', x: 42, y: 5, sprite: P('dog', 'bigger', 'gold', 'red'), scale: 2, show: (c) => !c.flag('c8_r_bigger'),
      talk: async (c) => {
        await c.say(null, 'Bigger is sitting on an island exactly his size, like a dog on a bed it has outgrown. When he sees you he wags so hard the island moves.');
        await c.say('bigger', 'HELLO! I STAYED! GOOD BOY. I STAY.');
        if (c.s.roster.lifeboat) await c.say('lifeboat', 'Target: large. Beginning heavy tow. This is my second rescue. I am very good at this now.');
        await rejoin(c, 'bigger');
      },
    },
    {
      id: 'r_anyone', x: 9, y: 4, sprite: P('robed', 'anyone2', 'white', 'navy'), show: (c) => !c.flag('c8_r_anyone'),
      talk: async (c) => {
        await c.say(null, 'Anyone is clinging to the top of a radio mast that sticks out of the reef, broadcasting on every frequency at once: "Is anyone there? Is anyone there?"');
        await c.say('hello', 'Hello.');
        await c.say('anyone', '...Hello. Oh. Hello. I knew someone would pick up. I did not know it would be you. I hoped.');
        await rejoin(c, 'anyone');
      },
    },
    {
      id: 'r_again', x: 41, y: 30, sprite: P('child', 'again', 'pink', 'sky'), show: (c) => !c.flag('c8_r_again'),
      talk: async (c) => {
        await c.say(null, 'Again is sitting in a tidepool, doing the same small wave over and over. In, out. Rewind. In, out. Rewind.');
        await c.say('again', "It's a nice wave. I don't want to do the next one. In the next one, Someday is still gone.");
        await c.say('hello', 'I know.');
        await c.say('again', '...Can you carry it with me? Like you said?');
        await c.say('hello', 'Yes.');
        await c.say(null, 'Again lets the next wave come in. It is a different wave. It is fine.');
        await rejoin(c, 'again');
      },
    },
    {
      id: 'r_both', x: 13, y: 32, sprite: P('twin', 'both', 'cream', 'orange'), show: (c) => !c.flag('c8_r_both'),
      talk: async (c) => {
        await c.say(null, 'Both is in the water, paddling in a perfect circle. Each head is paddling with one arm, in a different direction.');
        await c.say('first', 'LEFT!');
        await c.say('firster', 'RIGHT!');
        if (c.s.roster.lifeboat) await c.say('lifeboat', 'Two targets. One body. Rescue protocol is unclear. Proceeding anyway.');
        await c.say('first', 'We were rescued FIRST.');
        await c.say('firster', 'We were rescued at the SAME TIME. It is a TIE.');
        await c.say('first', '...A tie. Yes. Okay.');
        await rejoin(c, 'both');
      },
    },
    { id: 'r_se', x: 44, y: 18, sprite: P('person', 'faceless', 'white', 'grey'), show: (c) => rescued(c) === 4 && !c.flag('c8_se'), talk: (c) => seScene(c) },
    { id: 'dl', x: 24, y: 8, sprite: P('blob', 'deadletter', 'paper', 'sea'), scale: 5, show: (c) => c.flag('c8_dlup') && !c.flag('c8_dl') },
  ],
  ferals: [{ x: 14, y: 14, group: 'sea1' }, { x: 33, y: 10, group: 'sea2' }, { x: 30, y: 31, group: 'sea3' }, { x: 6, y: 22, group: 'sea1' }, { x: 36, y: 22, group: 'sea2', show: (c) => c.flag('c8_lifeboat') }],
  digs: [{ x: 8, y: 6, id: 's_whale2', slip: 'twins' }, { x: 44, y: 32, id: 's_ring', item: 'bouquet' }],
  triggers: [
    {
      x: 8, y: 25, w: 30, once: 'c8_currenthint', show: (c) => !c.flag('c8_lifeboat'),
      run: async (c) => { await c.say(null, 'Dark water rings the far islands: strong currents. The raft will never make it through. Maybe something in the wreck could.'); },
    },
  ],
  exits: [
    { x: 0, y: 1, h: 38, to: 'shore', tx: 27, ty: 8, dir: 3 },
    { x: 24, y: 23, to: 'wreck', tx: 14, ty: 24, dir: 0 },
  ],
};

async function seScene(c: Ctx) {
  c.set('c8_se');
  await c.say(null, 'On a raft of masks, far out on the water, sits someone with no face at all. The masks are all the faces they ever wore. They are floating away, one by one.');
  await c.say('someone', 'Hello.');
  await c.say('someone', "I don't have a face anymore. I threw them all off when I fell. This is just... me. There isn't anything here. That's why I wanted to be someone else.");
  await c.say('someone', 'I cut the Catch. I know it does not make up for Someday. Nothing does. I just could not watch it go one more step.');
  const r = await c.ask('hello', '...', ['Come with us.', 'You sold us out.']);
  if (r === 0) {
    c.set('c8_forgive');
    await c.say('someone', '...As who?');
    await c.say('hello', 'As you.');
    await c.wait(40);
    await c.say('someone', 'I do not know who that is yet.');
    await c.say('hello', 'Then come find out.');
    await c.join('someone', c.num('lvl_someone') || c.avgLevel(), true);
    await c.say(null, 'Someone Else rejoins the party. They wear no face. They do not seem to mind as much as they used to.');
  } else {
    await c.say('hello', 'You sold us out. Someday is gone.');
    await c.say('someone', '...Yes.');
    await c.say(null, 'The raft of masks drifts away on the current. Someone Else does not paddle after you.');
  }
  await deadLetterRise(c);
}

async function deadLetterRise(c: Ctx) {
  c.music(null);
  c.shake(40);
  await c.say(null, 'The water goes dark under the raft. Something huge is coming up from the deepest part of the Sea.');
  await c.say('sea', "I'm sorry. I'm sorry. I couldn't let them go. Nobody else was holding them.");
  c.set('c8_dlup');
  c.place('hero', 24, 12);
  c.face('hero', 'u');
  await c.say(null, 'It is made of people. Failed deliveries, hundreds of them, fallen out of the Up for months, tangled into one heap, still wet, still asking.');
  await c.say('deadletter', 'please deliver us please deliver us please please deliver us');
  await c.say('anyone', 'The Tall Man is in there. From Lowmost. The manifest said forwarded.');
  await c.say('sea', 'They are not a letter. They are people. Somebody has to say their names. Somebody has to remember them.');
  c.set('verb_remember');
  c.sfx('answer');
  await c.say(null, 'A new answer: Remember. Say their names.');
  const r = await c.battle('deadletter', { music: 'boss', noFlee: true, scene: 'deadletter' });
  if (r !== 'win') { c.s.flags.c8_dlup = 0; return; }
  c.set('c8_dl');
  await c.say(null, 'You say every name you know. The Tall Man. Runner, in case. The man whose name sounded like water. A Saint whose world is gone.');
  await c.say(null, 'With each name, someone comes loose from the heap and stands up on the water, blinking, holding on to the Sea.');
  await c.say('sea', 'They can stay with me. They can look at me. I will look back. I will look back at every one of them.');
  await c.wait(40);
  c.music('sad');
  await c.say(null, 'Something small falls out of the haze and lands on the water in front of you. A slip. The handwriting is Someday\'s.');
  await c.give('lastslip', 1, true);
  await c.say(null, '"Got here. Little one\'s long grown and gone. Nice view. Don\'t wait up. -S"');
  await c.wait(60);
  const r2 = await c.ask('hello', '...', ['...Okay.', "I'll call."]);
  if (r2 === 1) await c.say('hello', "I'll call.");
  if (c.s.roster.bigger) {
    await c.say('bigger', 'SOMEDAY?');
    await c.say('hello', "Someday's fine, Bigger. She's just not coming back.");
    await c.say('bigger', '...GOOD. GOOD.');
  }
  if (c.s.roster.again) await c.say(null, 'Again holds on to your arm and does not rewind anything.');
  await c.say('lifeboat', 'The Return. I can take you there. It is in the Deep Docket, at the center of the Silt. Coordinates acquired.');
  await c.say('hello', "Someday chose. Fen didn't get to. Nobody should be sent anywhere they didn't choose.");
  await c.say('hello', "Let's go end it.");
  c.set('slip', Math.max(c.num('slip'), 8));
  await c.fadeOut();
  await c.card(9);
  await c.goto('returnyard', 15, 38, 0);
}

const PLATES: [string, number, number][] = [['Sorrel Anhalt, navigator', 5, 5], ['Kesh Imura, engineer', 24, 5], ['Dov Atterly, cook', 10, 15], ['Wren Okafor, captain', 20, 16]];

// ---------------------------------------------------------------- the Patient Ark
const wk = new Grid(30, 26, 'K');
wk.rect(12, 18, 6, 7, 'o').rect(14, 25, 2, 1, '+').rect(3, 14, 24, 4, 'o').rect(3, 4, 4, 10, 'o').rect(23, 4, 4, 10, 'o').rect(3, 2, 24, 3, 'o');
wk.rect(10, 6, 10, 6, 'o').rect(13, 12, 4, 2, 'o');
wk.put(5, 5, 'c').put(5, 7, 'c').put(24, 5, 'c').put(24, 7, 'c').put(10, 15, 'c').put(20, 16, 'c');
wk.rect(12, 7, 6, 4, 'o');

const WRECK: MapDef = {
  id: 'wreck', name: 'The Patient Ark', chapter: 8, music: 'ark', bg: 'ink', battleBg: ['navy', 'teal'], mode: () => 'night', glow: { pillar: 10, crate: 8 }, weather: 'drips',
  rows: wk.rows(),
  legend: { K: t.solid('pillar', 'slate', 'teal'), o: t.floor('ice', 'white', 'floor'), '+': t.deco('door', 'teal', 'white'), c: t.solid('crate', 'ice', 'sky') },
  npcs: [
    { id: 'lifeboat_n', x: 15, y: 8, sprite: P('robot', 'lifeboat', 'orange', 'white'), show: (c) => !c.flag('c8_lifeboat'), talk: (c) => lifeboatScene(c) },
    { id: 'phone', x: 25, y: 15, sprite: P('object', 'payphone', 'slate', 'sky'), talk: (c) => c.payphone() },
    {
      id: 'fab', x: 4, y: 15, sprite: P('machine', 'fabricator', 'white', 'teal'), prayer: 'Please let us have what we need.',
      talk: async (c) => {
        await c.say('ark', 'FABRICATOR ONLINE. ACCEPTING LOCAL CURRENCY. PLEASE STATE YOUR NEED.');
        await c.shop(['feast', 'honey', 'bouquet', 'battery', 'picnic', 'coat7', 'anyone_w5', 'again_w5', 'bigger_w5', 'both_w5', 'someone_w5', 'lifeboat_w5', 'anchor', 'bellcharm'], 'Ark Fabricator');
      },
    },
  ],
  ferals: [{ x: 6, y: 15, group: 'wk1' }, { x: 24, y: 15, group: 'wk2' }, { x: 5, y: 6, group: 'wk3' }, { x: 24, y: 6, group: 'wk1' }],
  digs: [{ x: 4, y: 3, id: 'a_ark', slip: 'ark' }, { x: 25, y: 3, id: 'a_mayday', item: 'battery', n: 2 }],
  triggers: [
    { x: 9, y: 13, touch: true, run: async (c) => { await c.say(null, 'A terminal. CREW LOG, DAY 1,204: Engines dead. Beacon live. Sent the call. Someone will hear. Someone always hears.'); } },
    { x: 20, y: 13, touch: true, run: async (c) => { await c.say(null, 'A terminal. CREW LOG, DAY 4,880: Two prayers now. One for rescue. One just to be found. We decided we would settle for either.'); } },
    { x: 2, y: 9, touch: true, run: async (c) => { await c.say(null, 'Cryo pods, all open, all empty, all very clean. Somebody has dusted them every day for nine thousand years.'); } },
    ...PLATES.map(([name, x, y], i) => ({
      x, y, touch: true, show: (c: Ctx) => c.flag('c8_lifeboat') && !c.flag('plate_' + i),
      run: async (c: Ctx) => {
        c.set('plate_' + i);
        await c.give('nameplate', 1, true);
        await c.say(null, 'Bolted to the crate: a small metal plate with a name on it, in a script nobody in the Silt can read.');
        await c.say('lifeboat', `Crew identifier. ${name}.`);
        const n = PLATES.filter((_, k) => c.flag('plate_' + k)).length;
        if (n === 1) await c.quest('crew');
        if (n === PLATES.length) await crewScene(c);
      },
    })),
  ],
  exits: [{ x: 14, y: 25, w: 2, to: 'sea', tx: 24, ty: 24, dir: 2 }],
  enter: async (c) => {
    if (c.flag('c8_wreckin')) return;
    c.set('c8_wreckin');
    await c.say(null, 'The Patient Ark: a ship from no world you know, half sunk in a sea that should not exist. The corridors hum. Something here is still on.');
    await c.say('ark', 'COORDINATES FOLLOW. PLEASE, SOMEONE, FIND US. COORDINATES FOLLOW.');
    await c.say('hello', 'Hello? I found you.');
    await c.say('ark', '...RESCUE CONFIRMED. CREW STATUS: NOT FOUND. NOT FOUND. NOT FOUND. THANK YOU FOR FINDING US.');
    await c.say(null, 'The ship goes quiet, as if that was all it had been waiting nine thousand years to hear.');
  },
};


async function crewScene(c: Ctx) {
  await c.say('lifeboat', 'Four crew identifiers. Manifest complete.');
  await c.say('lifeboat', 'I came nine thousand, one hundred and six years to rescue four people. I never knew their names. I knew their coordinates.');
  await c.say('lifeboat', 'Sorrel Anhalt. Kesh Imura. Dov Atterly. Wren Okafor.');
  await c.wait(40);
  await c.say('lifeboat', 'Rescue status: not rescued. Remembered status: remembered. ...That is a new status. I am adding it to my manual.');
  await c.say(null, 'Lifeboat welds the four plates together into one, very carefully, and holds it out to you.');
  await c.give('crewplate');
  await c.finish('crew');
}

async function lifeboatScene(c: Ctx) {
  await c.say(null, 'In a launch bay sits a squat orange robot shaped like a rescue pod, with two big hands and a beacon on its head.');
  await c.say('hello', 'Hello?');
  await c.say('lifeboat', 'RESCUE UNIT LIFEBOAT. ONLINE. ...Online? Online.');
  await c.say('lifeboat', 'I grew from a distress call. "Mayday. Please. Send rescue." I arrived nine thousand, one hundred and six years after it was sent.');
  await c.say('lifeboat', 'The crew were already gone. This ship grew from their other prayer, "let someone find us." We arrived together, the ship and its rescue. Both too late.');
  await c.say('lifeboat', 'I have been waiting to rescue someone ever since. Are you someone?');
  await c.say('hello', 'My friends are out on the water. Scattered.');
  await c.say('lifeboat', 'RESCUE TARGETS ACQUIRED. Please hold still. Rescue is my favorite thing. I have never done it.');
  c.set('c8_lifeboat');
  c.show('lifeboat_n', false);
  await c.join('lifeboat', Math.max(c.avgLevel(), 26));
  await c.say(null, 'Lifeboat can tow the raft through the strong currents now. In battle, Evacuate swaps an ally out for someone on the bench, and Tow lifts the fallen.');
}

export const CH8: MapDef[] = [SHORE, OPEN, WRECK];
