import { Grid } from './grid';
import { MapDef, t } from './types';
import { registerSpeaker } from '../game/speakers';
import type { Ctx } from '../game/ctx';
import { CablePuzzle, cableTriggers, drawCable } from './cable';
import { page } from './side';

const P = (tt: string, seed: string, a: string, b: string) => ({ t: tt, seed, a, b });
const SAINT = P('robed', 'saintnpc', 'white', 'navy');
const GATE = P('gate', 'gate', 'slate', 'gold');
registerSpeaker('saint', 'Saint', SAINT, 'sky');
registerSpeaker('supervisor', 'The Supervisor', P('machine', 'supervisor', 'navy', 'gold'), 'gold');
registerSpeaker('supply', 'Supply Saint', P('robed', 'supply', 'cream', 'teal'), 'sky');

const LEGEND = {
  '.': t.floor('slate', 'navy', 'floor'), ',': t.deco('cable', 'slate', 'orange'), S: t.solid('switch', 'gold', 'navy'),
  o: t.solid('pipe', 'grey', 'gold'), r: t.solid('fence', 'slate', 'red'), '=': t.solid('counter', 'sky', 'navy'),
  G: t.solid('door', 'grey', 'navy'), P: t.solid('window', 'red', 'navy'), J: t.deco('plain', 'dusk', 'navy'),
  K: t.solid('shelf', 'paper', 'navy'), '+': t.deco('door', 'slate', 'sky'),
};

// ---------------------------------------------------------------- the Docket plaza
const d = new Grid(36, 32, '.').frame(0, 0, 36, 32, 'S');
d.scatter(',', 50, 301);
d.rect(1, 10, 34, 1, 'o').rect(17, 10, 2, 1, '.');
d.rect(9, 18, 14, 1, 'r').rect(9, 21, 14, 1, 'r');
d.rect(27, 24, 5, 1, '=');
d.put(0, 25, 'G').put(0, 26, 'G').put(0, 27, 'G');
d.rect(17, 0, 2, 1, '+');
d.text(6, 0, 'PPP').text(26, 0, 'PPP').text(35, 14, 'P').text(0, 14, 'P');
d.rect(4, 3, 3, 3, 'S').rect(29, 3, 3, 3, 'S').rect(4, 13, 2, 3, 'S').rect(30, 13, 2, 3, 'S');

const poster = (x: number, y: number, text: string) => ({ x, y, touch: true, run: async (c: Ctx) => { await c.say(null, text); } });

const DOCKET: MapDef = {
  id: 'docket', name: 'The Docket', chapter: 3, music: 'docket', bg: 'ink', battleBg: ['navy', 'slate'], mode: () => 'night', glow: { switch: 14, window: 12 },
  rows: d.rows(), legend: LEGEND,
  npcs: [
    { id: 'phone', x: 5, y: 22, sprite: P('object', 'payphone', 'slate', 'sky'), talk: (c) => c.payphone() },
    {
      id: 'supply', x: 29, y: 23, sprite: P('robed', 'supply', 'cream', 'teal'), prayer: 'Please let us have enough.',
      talk: async (c) => {
        await c.say('supply', 'Supplies for the patient. Please have your pleas ready. Your custom is important to us.');
        await c.shop(['stew', 'lozenge', 'honey', 'tonic', 'card', 'battery', 'hello_w3', 'someday_w3', 'bigger_w3', 'anyone_w2', 'coat3', 'coat4', 'boots', 'thimble'], 'Docket Supply');
      },
    },
    { id: 'q1', x: 11, y: 19, sprite: P('dog', 'oldpuppy', 'tan', 'brown'), prayer: 'Please, can I have a puppy?', talk: async (c) => { await c.say(null, '"I am going home!" says a dog with a grey muzzle. "My asker wanted a puppy. I am a puppy! I am a very old puppy!"'); } },
    { id: 'q2', x: 14, y: 20, sprite: P('person', 'edithq', 'cream', 'rose'), prayer: 'Please send Edith a friend.', talk: async (c) => { await c.say(null, '"My slip says Edith," she says. "I have never been Edith\'s. I am going to be Edith\'s." She holds her ticket with both hands.'); } },
    {
      id: 'q3', x: 17, y: 19, sprite: P('person', 'quietq', 'grey', 'slate'), prayer: 'Please let someone stay.', show: (c) => !c.qdone('postcard'),
      talk: async (c) => {
        await c.say(null, '"What if they do not want me now?" he says quietly. "I am not what they asked for anymore. I am three hundred years of something else."');
        if (!c.q('postcard')) await c.quest('postcard');
        if (!c.has('postcard')) return;
        const r = await c.ask('hello', '...', ['Write and ask them', 'Wish him luck']);
        if (r !== 0) return;
        c.take('postcard');
        await c.say('hello', 'You could write first. Ask them.');
        await c.say(null, 'You give him the postcard from the Lost and Found. He holds it like it might go off. Then he borrows a stamp pen from a Saint and writes for a long time.');
        await c.say(null, '"Dear whoever asked," he reads out. "I am not what you asked for anymore. I learned to whittle. I can name every star you cannot see from here. I think you would like me. I would like to find out. Write back."');
        await c.say(null, 'He drops it in a tube. It goes up with a sound like a held breath. Then he steps out of the queue to wait for an answer somewhere with a chair.');
        await c.say(null, '"Thank you," he says, and gives you the pleas he was saving for the trip. "I will not need fare. I am staying until they write."');
        await c.pleas(90);
        await c.finish('postcard');
      },
    },
    { id: 'q4', x: 20, y: 20, sprite: P('child', 'twinsq', 'tan', 'sky'), prayer: 'Please let me have a twin.', talk: async (c) => { await c.say(null, '"I am somebody\'s twin," says the child. "I hope they kept my half of the room."'); } },
    { id: 'qsaint', x: 22, y: 19, sprite: SAINT, prayer: 'Let our calls be heard.', talk: async (c) => { await c.say('saint', 'Next. Thank you for your patience. Next. Thank you for your patience. Next.'); } },
    { id: 'tuner', x: 26, y: 15, sprite: P('robed', 'tuner', 'white', 'violet'), prayer: 'Let our calls be heard.', talk: async (c) => { await c.say('saint', 'The Asking stopped. The lines are so quiet. We have started singing to fill them. It is not the same. Please hold.'); } },
    {
      id: 'unsent', x: 9, y: 6, sprite: P('slip', 'unsent', 'cream', 'blue'), prayer: 'Dear Mom. I am sorry about the',
      show: (c) => !c.qdone('unsent'),
      talk: async (c) => {
        if (c.has('strip')) {
          c.take('strip');
          await c.say(null, 'You hold the torn strip up to the letter. It fits the ragged edge exactly. The letter takes a breath it has been holding for a very long time.');
          await c.say(null, '"Dear Mom. I am sorry about the vase. It was me, not the cat. I love you. Please write back."');
          await c.say(null, 'The letter stands very still, the way a person does after saying the hard part.');
          await c.say('hello', 'Someone read you. I read you.');
          c.sfx('answer');
          await c.say(null, 'The letter folds itself, corner to corner, into a paper bird, and hops once onto your hand. It seems to want to come along.');
          await c.give('paperbird');
          await c.finish('unsent');
          return;
        }
        await c.say(null, 'A letter, walking. "Dear Mom," it says. "I am sorry about the." It stops there. It has always stopped there. "I am sorry about the," it says again, carefully.');
        if (!c.q('unsent')) {
          await c.say('someday', 'Somebody tore the end off. Torn ends go to the dead-letter tray in the Vault, up north. Everything in this city gets filed somewhere.');
          await c.quest('unsent');
        }
      },
    },
  ],
  ferals: [{ x: 14, y: 6, group: 'dk1' }, { x: 25, y: 7, group: 'dk2' }, { x: 8, y: 27, group: 'dk3' }, { x: 24, y: 28, group: 'dk4' }, { x: 31, y: 18, group: 'dk2' }],
  digs: [
    { x: 3, y: 9, id: 'd_robotcat', slip: 'robotcat' },
    { x: 33, y: 29, id: 'd_translator', slip: 'translator' },
    { x: 20, y: 4, id: 'd_honey', item: 'honey' },
    { x: 7, y: 16, id: 'd_library', slip: 'library' },
  ],
  triggers: [
    poster(7, 0, 'A poster: THE RETURN. EVERYONE GOES HOME. A drawing of a smiling slip with little legs, walking up a ladder into the sky.'),
    poster(27, 0, 'A poster: HAVE YOU BEEN MANIFESTED? ASK A SAINT. Someone has written underneath, very small: what if I do not want to go.'),
    poster(35, 14, 'A notice: THE ASKING IS SUSPENDED. THANK YOU FOR YOUR PATIENCE. Signed with a single word: AMEN.'),
    poster(0, 14, 'A notice: LINEMEN REPORT TO THE TETHER FOR CATCH DUTY. It is dated forty days ago.'),
  ],
  exits: [{ x: 17, y: 0, w: 2, to: 'cloister', tx: 19, ty: 28, dir: 0 }],
  enter: async (c) => {
    if (c.flag('c3_enter')) return;
    c.set('c3_enter');
    c.s.chapter = 3;
    c.place('hero', 3, 26);
    await c.wait(20);
    await c.say(null, 'The window opens onto the Docket\'s intake gate. It is a gate sized for people.');
    await c.say('bigger', 'I FIT.');
    await c.say(null, 'Bigger does not fit.');
    c.shake(30);
    await c.wait(30);
    await c.say(null, 'The gate folds like a paper cup. Somewhere a bell starts ringing. No. A phone. Every phone.');
    await c.say('saint', 'BREACH AT INTAKE. PLEASE HOLD. PLEASE HOLD. YOUR BREACH IS IMPORTANT TO US.');
    await c.say('someday', 'Well. So much for quiet.');
    await c.say(null, 'The Docket: a city of switchboards stacked up into the haze. Cables hang between the towers like vines. Saints in veils move along them, plugging and unplugging, singing numbers.');
    await c.say('someday', 'Every manifest is kept in the Vault, through the Cloister to the north. Fen\'s name is on one of them.');
  },
};

// ---------------------------------------------------------------- the Cloister
const cl = new Grid(40, 30, '.').frame(0, 0, 40, 30, 'S');
cl.scatter(',', 40, 311);
cl.rect(1, 15, 38, 1, 'S').rect(19, 15, 2, 1, '.');
for (const x of [5, 11, 31, 35]) cl.rect(x, 3, 2, 9, 'S');
for (const x of [24, 30]) cl.rect(x, 18, 2, 8, 'S');
cl.rect(1, 17, 9, 1, 'S').rect(9, 17, 1, 12, 'S').put(9, 22, '+').put(2, 18, 'S');
cl.rect(14, 17, 3, 3, 'J').put(13, 18, 'J').put(17, 17, 'J');
cl.rect(24, 4, 4, 4, 'J').put(23, 5, 'J').put(28, 6, 'J');
cl.rect(19, 29, 2, 1, '+');
cl.rect(19, 0, 2, 2, '.');

const PZ1: CablePuzzle = {
  id: 'inner', ox: 14, oy: 17, cells: ['LII', 'LLT', 'LIL'], start: [0, 0, 0, 0, 2, 1, 1, 0, 3],
  src: [0, 1, 3], dst: [2, 0, 1],
  onSolve: async (c) => { await c.say(null, 'Power hums through the cable. The gate to the upper hall rolls open.'); },
  locked: async (c) => {
    if (c.s.roster.anyone) return false;
    await c.say(null, 'The junction will not turn. Every line here is patched through somewhere else. To the west, in a side chapel, one switchboard is silent.');
    return true;
  },
};
const PZ2: CablePuzzle = {
  id: 'vault', ox: 24, oy: 4, cells: ['LTLI', 'ILTL', 'TLII', 'LTIL'], start: [1, 2, 3, 0, 0, 1, 2, 3, 1, 2, 0, 0, 3, 0, 1, 2],
  src: [0, 1, 3], dst: [3, 2, 1],
  onSolve: async (c) => { await c.say(null, 'The Vault door unlocks with a sound like a held breath let go.'); },
};

const CLOISTER: MapDef = {
  id: 'cloister', name: 'The Switchboard Cloister', chapter: 3, music: 'docket', bg: 'ink', battleBg: ['navy', 'dusk'], mode: () => 'night', glow: { switch: 16, window: 12 },
  rows: cl.rows(), legend: LEGEND,
  draw: (g, cx, cy, c) => { drawCable(g, cx, cy, c, PZ1); drawCable(g, cx, cy, c, PZ2); },
  npcs: [
    { id: 'gate1', x: 19, y: 15, sprite: GATE, show: (c) => !c.flag('pz_inner') },
    { id: 'gate2', x: 20, y: 15, sprite: GATE, show: (c) => !c.flag('pz_inner') },
    { id: 'gate3', x: 19, y: 1, sprite: GATE, show: (c) => !c.flag('pz_vault') },
    { id: 'gate4', x: 20, y: 1, sprite: GATE, show: (c) => !c.flag('pz_vault') },
    { id: 'phone', x: 37, y: 9, sprite: P('object', 'payphone', 'slate', 'sky'), talk: (c) => c.payphone() },
    { id: 'anyone', x: 3, y: 20, sprite: P('robed', 'anyone2', 'white', 'navy'), show: (c) => c.flag('c3_anyone_seen') && !c.flag('c3_anyone') },
    { id: 'choir', x: 32, y: 26, sprite: SAINT, prayer: 'Let our calls be heard.', talk: (c) => boardShift(c) },
  ],
  ferals: [{ x: 15, y: 23, group: 'dk3' }, { x: 28, y: 21, group: 'dk5' }, { x: 3, y: 27, group: 'dk4' }, { x: 9, y: 7, group: 'dk6' }, { x: 30, y: 10, group: 'dk7' }, { x: 16, y: 6, group: 'dk5' }],
  digs: [
    { x: 2, y: 2, id: 'c_queen', slip: 'queen' },
    { x: 37, y: 24, id: 'c_card', item: 'card' },
    { x: 13, y: 10, id: 'c_gardener', slip: 'gardener' },
    { x: 22, y: 26, id: 'c_stairs', slip: 'stairs' },
  ],
  triggers: [
    ...cableTriggers(PZ1),
    ...cableTriggers(PZ2),
    {
      x: 2, y: 18, touch: true,
      run: async (c) => {
        if (c.flag('c3_anyone') && c.s.roster.anyone) { await c.say(null, 'The dead switchboard. Its doors hang open. Nobody is inside now.'); return; }
        await anyoneScene(c);
      },
    },
    {
      x: 19, y: 16, w: 2, once: 'c3_gatehint',
      run: async (c) => {
        if (!c.s.roster.anyone) {
          c.s.flags.c3_gatehint = 0;
          await c.say(null, 'A barred gate. The lock is a socket with no power in it. Something in the west chapel is silent. Maybe it knows how the power runs.');
          return;
        }
        await c.say(null, 'A barred gate. The lock is a socket with no power in it. To the west, a block of cable junctions sits on the floor, dark.');
        await c.say(null, 'Face a junction and press Z to turn it. Run power from the gold socket to the red one.');
      },
    },
  ],
  exits: [
    { x: 19, y: 29, w: 2, to: 'docket', tx: 17, ty: 1, dir: 2 },
    { x: 19, y: 0, w: 2, to: 'vault', tx: 11, ty: 18, dir: 0, show: (c) => c.flag('pz_vault') },
  ],
  enter: async (c) => {
    if (c.flag('c3_cl')) return;
    c.set('c3_cl');
    await c.say(null, 'The Switchboard Cloister. Rows of boards hum in the gloom. In a side chapel to the west, one board is completely silent.');
  },
};

async function boardShift(c: Ctx) {
  await c.say('saint', 'We are rehearsing the Return hymn. It goes: please hold, please hold, please hold. It is mostly the one line.');
  if (!c.q('board')) {
    await c.say('saint', 'But the boards still light up, out of habit, and someone has to patch them while we sing. You have quick hands. You have the look of a caller.');
    await c.say('saint', 'Patch twenty in a shift and I will give you my spare headset. Drop the red lines. Those are wrong numbers, and wrong numbers are contagious.');
    await c.quest('board');
  }
  const r = await c.ask('saint', 'Cover the board?', ['Sit down at the board', 'Not now']);
  if (r !== 0) return;
  const res = await c.minigame('switch');
  if (res.score > 0) await c.pleas(res.score * 3);
  if (res.score >= 20 && !c.qdone('board')) {
    await c.say('saint', 'Twenty! You did not even hum. Here. It still smells like the chorus.');
    await c.give('saintset');
    await c.finish('board');
  }
  if (res.score >= 35 && !c.flag('page_6')) {
    await c.say('saint', 'Thirty-five. I have not seen hands like that since the Linemen. One of them left this tucked behind the board, a very long time ago.');
    await page(c, 6);
  }
}

async function anyoneScene(c: Ctx) {
  c.set('c3_anyone');
  await c.say(null, 'A switchboard, dead and dusty. One jack hangs loose on its cord. Without quite meaning to, Hello plugs it in.');
  await c.say('hello', 'Hello?');
  await c.wait(50);
  await c.say(null, 'A click. Then, very close: "...Is anyone there?"');
  await c.say('hello', 'Hello? Yes. Hello.');
  await c.say(null, '"Yes. Sorry. Yes. Anyone is here. Please hold."');
  c.sfx('door');
  c.set('c3_anyone_seen');
  c.show('anyone', true);
  await c.say(null, 'The switchboard swings open like a cupboard. Folded inside among the wires is a Saint.');
  await c.say('anyone', 'Forgive me. Nobody has called this line in three hundred years. They moved my exchange to the Return switch and did not tell me.');
  await c.say('anyone', 'I grew from "Is anyone there? Please. Anyone." So I answer. Every call. It is what I am for.');
  await c.say('someday', 'A Saint. Hide or fight, sprout?');
  await c.say('anyone', 'Neither, please. I have been listening to the Return lines. Do you know what they are saying?');
  await c.say('anyone', 'They are manifesting the Saints. All of us. Every Saint is an Answer, and every Answer goes home.');
  await c.say('anyone', 'We grew from a world that wanted to be heard. That world has been dust for a very long time. Where do you send a Saint when everyone who asked for her is gone?');
  await c.say('hello', "We're going to the Vault to find out where they send people.");
  await c.say('anyone', 'Then I would like to hold the door for you. Professionally.');
  c.show('anyone', false);
  await c.join('anyone', Math.max(c.avgLevel(), 10));
  await c.say('anyone', 'One thing first. You are each on your own line. Let me patch you through to each other. Then you can hear each other think. It helps, in a fight.');
  c.set('mech_line');
  c.sfx('link');
  await c.say(null, 'The party learned Party Line. When two allies act back to back on the turn order, choose Line to act together. Each pair has its own move.');
  await c.say(null, 'Anyone\'s Please Hold pushes a foe back on the turn order, and Patch Through lets an ally go next. Use them to line people up.');
  if (c.s.party.length >= 4 && !c.s.party.includes('anyone')) await c.say(null, 'The party is full, so Anyone waits on the bench. Swap people in from the Party menu. Bench members still earn most of the experience.');
  await c.say('anyone', 'The doors here run on routed power. Plug the lines right and they open. I would do it myself, but my hands are full of me.');
}

// ---------------------------------------------------------------- the Vault
const v = new Grid(24, 20, '.').frame(0, 0, 24, 20, 'S');
for (let y = 3; y <= 15; y += 3) { v.rect(2, y, 6, 1, 'K'); v.rect(16, y, 6, 1, 'K'); }
v.rect(11, 19, 2, 1, '+').rect(21, 1, 2, 1, 'o');

const VAULT: MapDef = {
  id: 'vault', name: 'The Manifest Vault', chapter: 3, music: 'docket', bg: 'ink', battleBg: ['navy', 'plum'], mode: () => 'night', glow: { switch: 16, counter: 12 }, weather: 'dust',
  rows: v.rows(), legend: LEGEND,
  npcs: [
    { id: 'sup', x: 11, y: 3, sprite: P('machine', 'supervisor', 'navy', 'gold'), scale: 4, show: (c) => !c.flag('c3_sup') },
  ],
  triggers: [
    {
      x: 9, y: 11, w: 6, once: 'c3_supev',
      run: async (c) => {
        c.music(null);
        await c.say(null, 'The Vault. Shelves of manifests run up into the haze, every one a list of names.');
        await c.say(null, 'At the center sits a Saint the size of a building, at a switchboard with a hundred arms, filing.');
        await c.say('supervisor', 'INTRUSION. PLEASE HOLD.');
        await c.wait(30);
        await c.say('supervisor', '...Lineman Zero Four One One.');
        await c.say('someday', '...');
        await c.say('supervisor', 'You are late. Four hundred years late. Your route is still open. Your quota is still open. Return to your route.');
        await c.say('someday', 'Close it.');
        await c.say('anyone', 'Supervisor, please. The manifest. Just let us read one name.');
        await c.say('supervisor', 'EVERYTHING WILL BE WHERE IT BELONGS.');
        const r = await c.battle('supervisor', { music: 'boss' });
        if (r !== 'win') return;
        await afterSupervisor(c);
      },
    },
    poster(4, 3, 'A manifest: page after page of names, each with a stamp. RETURNED. RETURNED. DELIVERY FAILED. RETURNED.'),
    poster(18, 6, 'A manifest for Lowmost. You find Runner: DELIVERED. You find the Tall Man: DELIVERY FAILED. FORWARDED.'),
    {
      x: 1, y: 17, touch: true,
      run: async (c) => {
        if (c.q('unsent') === 1 && !c.has('strip')) {
          await c.say(null, 'A tray marked DEAD LETTERS, heaped with torn ends of things: half a recipe, the bottom of a will, a strip with "...vase. It was me, not the cat" on it.');
          await c.give('strip');
          await c.quest('unsent', 2);
          return;
        }
        await c.say(null, 'A tray marked DEAD LETTERS, heaped with the torn ends of things nobody finished reading.');
      },
    },
  ],
  digs: [{ x: 21, y: 17, id: 'v_page5', page: 5 }],
  exits: [{ x: 11, y: 19, w: 2, to: 'cloister', tx: 19, ty: 2, dir: 2 }],
};

async function afterSupervisor(c: Ctx) {
  c.set('c3_sup');
  c.show('sup', false);
  await c.say(null, "The Supervisor's hundred arms go still. One by one they lay down what they were holding.");
  await c.say(null, 'On the switchboard, a manifest sits open, as if it had been waiting for you.');
  await c.say(null, 'FEN. ASKED FOR BY: A BOY WHO WANTED A BROTHER. DELIVERY: FAILED. ASKER NOT FOUND. DISPOSITION: FORWARDED TO THE CATCH.');
  await c.give('manifest', 1, true);
  await c.say('hello', 'Failed? What is the Catch?');
  await c.say('anyone', 'It is up. It is Amen\'s net. It hangs across the whole sky. It is why the Asking stopped. Every prayer that falls, the Catch catches.');
  await c.say('anyone', 'And the failed deliveries go there too. To wait.');
  await c.say('hello', 'Wait for what?');
  await c.say('anyone', 'The manifest does not say. Manifests never say what happens after.');
  c.shake(20);
  await c.say(null, 'Every switchboard in the Vault clicks at once. Anyone flinches like she has been struck.');
  await c.say('anyone', '...They hung up on me. All of them. I cannot hear the chorus.');
  await c.say('anyone', 'I have heard it every moment since I grew. Four thousand voices saying "please hold". It is so quiet.');
  await c.say('someday', 'Welcome to the quiet, Saint. It is not so bad. You get used to it.');
  await c.say('hello', 'Someday. It called you a Lineman.');
  await c.say('someday', 'Later, sprout. Alarms first.');
  c.sfx('ring');
  await c.say('anyone', 'There is an express tube behind the shelves. It goes... somewhere. Every tube goes somewhere.');
  await c.say('bigger', 'TUBE!');
  await c.fadeOut();
  c.music('sad');
  await c.say(null, 'The tube is dark and fast and smells like old paper. Nobody talks for a long time.');
  await c.say('anyone', 'I have never made a call of my own. Every call I ever answered was someone else\'s.');
  await c.say('anyone', 'May I make one now? To you, Hello. I would like to hear what your line sounds like.');
  await c.say(null, 'Anyone touches your slip with one cable-thin finger. She listens for a long time.');
  await c.say('anyone', '...There is someone on your line.');
  c.tabTitle('Someone is on the line.', 6000);
  await c.say('anyone', 'Very far away. Not dead. Not Above, either, not exactly. Somewhere past Above. They are listening right now.');
  await c.say('anyone', 'Hello. Your asker is listening right now.');
  await c.say('hello', '...Hello?');
  c.set('slip', Math.max(c.num('slip'), 3));
  await c.card(4);
  await c.goto('encore', 16, 26, 0);
}

export const CH3: MapDef[] = [DOCKET, CLOISTER, VAULT];
