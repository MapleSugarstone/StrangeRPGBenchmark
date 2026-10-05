import { Grid } from './grid';
import { MapDef, t } from './types';
import { registerSpeaker } from '../game/speakers';
import type { Ctx } from '../game/ctx';
import { page } from './side';

const P = (tt: string, seed: string, a: string, b: string) => ({ t: tt, seed, a, b });
const AGAIN = P('child', 'again', 'pink', 'sky');
const BEDTIME = P('head', 'bedtime', 'navy', 'cream');
registerSpeaker('mayor', 'Mayor Pomp', P('person', 'mayor', 'gold', 'red'));
registerSpeaker('poet', 'The Poet', P('person', 'poet', 'grey', 'violet'));
registerSpeaker('clockmaker', 'The Clockmaker', P('person', 'clockm', 'cream', 'brown'));
registerSpeaker('baker', 'The Baker', P('person', 'baker', 'white', 'pink'));
registerSpeaker('innkeep', 'Innkeeper', P('person', 'innkeep', 'tan', 'green'));
registerSpeaker('bedtime', 'Bedtime', BEDTIME, 'sky');

const PHASES = ['Morning', 'Noon', 'Dusk', 'Bedtime'];
const phase = (c: Ctx) => c.num('d_phase');
const isPhase = (n: number) => (c: Ctx) => phase(c) === n && !c.flag('c4_done');
const STEPS_PER_PHASE = 200;

// Clears today's flags and starts the same day over at the inn.
async function bedtimeReset(c: Ctx) {
  c.music(null);
  await c.say(null, 'The sky over Encore goes the soft blue of a nursery wall.');
  await c.say(null, 'Something very large comes down the road in a nightcap, humming. Everyone it passes yawns and goes inside.');
  await c.say('bedtime', 'Bedtime. Bedtime. Lovely day. Lovely, lovely day. Let us do it again.');
  await c.say(null, 'You are so tired. You are so, so tired.');
  await c.fadeOut();
  for (const k of Object.keys(c.s.flags)) if (k.startsWith('d_')) delete c.s.flags[k];
  c.take('towerkey', 9);
  c.heal();
  c.inc('k_loop');
  c.field.load('inn', 5, 4, 2);
  await c.wait(30);
  c.field.fadeTarget = 0;
  await c.fadeIn();
  await c.say(null, 'Morning. The baker is singing the same song as yesterday. The bunting is up. It is the Eve of the festival.');
  if (!c.flag('k_again')) await againScene(c);
}

async function againScene(c: Ctx) {
  c.set('k_again');
  await c.say('someday', '...Sprout. Did we already do today?');
  await c.say('anyone', 'We did. I remember it exactly. The baker sang that song at this time yesterday. In this key.');
  await c.say('bigger', 'AGAIN?');
  await c.say(null, 'A small voice from the doorway says: "Again."');
  c.show('again_npc', true);
  await c.say('again', 'You remember! You remember yesterday! Nobody ever remembers!');
  await c.say('hello', 'Hello.');
  await c.say('again', 'Hello! Hello hello hello. Say it again!');
  await c.say('hello', 'Hello.');
  await c.say('again', 'AGAIN.');
  await c.say('again', "I'm Again. I keep the day. It's the best day. It's the night before the festival, and everybody's happy, and nobody has to go anywhere.");
  await c.say('hello', 'Why can\'t we leave?');
  await c.say('again', "Because tomorrow never comes. The Day Spring is up in the clock tower. Every night Bedtime puts everyone to sleep, and I wind the Spring back, and then it's today again.");
  await c.say('someday', 'Why, kid?');
  await c.say('again', 'My slip says: "Please let tomorrow be today again." Somebody prayed it the night before they moved away. Away from their best friend, and the big tree, and everything.');
  await c.say('again', 'Today was the best one. So I keep it.');
  await c.say('anyone', 'How long have you kept it?');
  await c.say('again', 'Three hundred years. About. I stopped counting at a hundred thousand todays.');
  await c.say('again', '...It gets lonely when nobody remembers. Will you stay? Just one more today?');
  const r = await c.ask('hello', '...', ["We can't stay.", 'One more today.']);
  if (r === 0) await c.say('again', "Then I'll come with you. Until you stop wanting to leave. You'll stop. Everybody stops.");
  else await c.say('again', 'YAY. And then one more. And one more after that.');
  c.show('again_npc', false);
  await c.join('again', Math.max(c.avgLevel(), 13));
  c.set('mech_rewind');
  c.sfx('rewind');
  await c.say('again', 'Watch this. If something goes wrong in a fight, I can make it go again. Once a fight. Not more. Even I get dizzy.');
  await c.say(null, 'The party learned Rewind. In battle, choose Rewind to undo everything since your last turn. Again can do it once per fight, twice once Again is stronger.');
  await c.say(null, 'The day loops. What you learn, you keep. What you are holding when Bedtime comes, you lose.');
}

// ---------------------------------------------------------------- Encore
const e = new Grid(34, 30, '.').frame(0, 0, 34, 30, 'Y');
e.rect(16, 0, 2, 30, ',').rect(13, 11, 8, 8, ',').rect(16, 14, 2, 2, 'F');
e.house(3, 2, 7, 6, 6, { roof: 'R', wall: 'W', doorCh: 'D' });
e.rect(4, 0, 5, 2, 'Q').rect(5, 0, 3, 1, 'Q');
e.house(3, 14, 7, 6, 6, { roof: '^', wall: '#' });
e.house(24, 3, 7, 6, 27, { roof: '^', wall: '#', doorCh: 'd' });
e.house(24, 17, 6, 6, 26, { roof: '^', wall: '#', doorCh: 'd' });
e.house(11, 22, 4, 4, 12, { roof: '^', wall: '#', doorCh: 'd' });
e.house(20, 23, 4, 4, 21, { roof: '^', wall: '#', doorCh: 'd' });
e.rect(6, 8, 1, 1, ',').rect(6, 20, 1, 1, ',').rect(27, 9, 1, 1, ',').rect(26, 23, 1, 1, ',');
e.rect(30, 12, 3, 5, '.').frame(29, 11, 5, 7, 'Y').put(29, 14, '.').put(33, 14, 'Y');
e.scatter('b', 26, 401).scatter('p', 6, 402);

const ENCORE: MapDef = {
  id: 'encore', name: 'Encore', chapter: 4, music: 'encore', bg: 'moss', battleBg: ['pink', 'lilac'], weather: (c) => (phase(c) === 3 ? 'motes' : 'confetti'),
  rows: e.rows(),
  legend: {
    '.': t.floor('mint', 'green', 'grass'), ',': t.floor('cream', 'pink', 'check'), Y: t.solid('bush', 'mint', 'moss'), F: t.water('sky', 'white'),
    W: t.wall('cream', 'brown'), R: t.solid('roof', 'sky', 'navy'), Q: t.solid('gear', 'cream', 'brown'), D: t.solid('door', 'brown', 'gold'),
    '#': t.wall('cream', 'pink'), '^': t.solid('roof', 'pink', 'rose'), w: t.solid('window', 'sky', 'cream'), '+': t.deco('door', 'brown', 'cream'),
    d: t.solid('door', 'brown', 'cream'), b: t.deco('bunting', 'mint', 'red'), p: t.solid('plant', 'mint', 'rose'),
  },
  tint: (c) => (c.flag('c4_done') ? null : [null, 'cream', 'rose', 'navy'][phase(c)] ?? null),
  draw: (g, cx, cy, c) => {
    if (c.flag('c4_done')) return;
    const x = 6 * 8 - cx + 4, y = 0 - cy + 1;
    g.box(x - 22, y, 44, 12, 'gold');
    g.textC(PHASES[phase(c)].toUpperCase(), x, y + 2, 'gold');
  },
  tick: (c) => {
    if (c.flag('c4_done') || c.flag('c4_bed')) return null;
    c.inc('d_steps');
    if (c.num('d_steps') < STEPS_PER_PHASE) return null;
    c.s.flags.d_steps = 0;
    const next = phase(c) + 1;
    if (next >= 3) return bedtimeReset;
    c.set('d_phase', next);
    return async (cc) => {
      cc.sfx('ring');
      await cc.say(null, next === 1 ? 'The tower clock strikes noon. A parade starts up somewhere, with a tuba.' : 'The tower clock strikes dusk. The bunting turns the color of jam.');
    };
  },
  npcs: [
    { id: 'phone', x: 19, y: 11, sprite: P('object', 'payphone', 'slate', 'sky'), talk: (c) => c.payphone() },
    {
      id: 'mayor', x: 15, y: 10, sprite: P('person', 'mayor', 'gold', 'red'), show: isPhase(1), prayer: 'Please let everyone have a lovely time.',
      talk: async (c) => {
        if (c.flag('d_key')) { await c.say('mayor', 'Enjoy the parade! It is the best parade. It is the only parade.'); return; }
        if (c.flag('k_name')) {
          await c.say('hello', 'The Festival of Tomorrow.');
          await c.say('mayor', 'TOMORROW! Yes! Oh, that is it, that is the name! Three hundred years on the tip of my tongue!');
          await c.say('mayor', 'Here. The key to the tower. I have held it so long my hand forgot it was there.');
          c.set('d_key');
          await c.give('towerkey');
          if (c.s.roster.again) await c.say('again', '...You found it. Okay. Okay.');
          return;
        }
        await c.say('mayor', 'Welcome, welcome, to the Festival of... of... Ah. It is on the tip of my tongue. It has been on the tip of my tongue for three hundred years.');
        await c.say('mayor', 'Whoever reminds me gets the key to the tower! I carry it in the parade. Nobody has ever asked for it.');
      },
    },
    {
      id: 'poet', x: 28, y: 14, sprite: P('person', 'poet', 'grey', 'violet'), show: isPhase(2), prayer: 'Please let me finish the poem.',
      talk: async (c) => {
        if (c.q('thirdline') === 2 && c.flag('d_asked')) { await poemScene(c); return; }
        await c.say('poet', 'The festival? It was called Tomorrow. That was the whole joke. We built a festival for the one day that never arrives.');
        await c.say('poet', 'I have been writing a poem about it for three hundred years. It is four lines long. I am not happy with the third line.');
        if (!c.flag('k_name')) { c.set('k_name'); await c.say(null, 'You will remember this, even after Bedtime. The festival is called Tomorrow.'); }
        if (c.qdone('thirdline')) return;
        if (c.q('thirdline') === 2) { await c.say('poet', 'Asked her? When? Yesterday? Everything here happened yesterday. I need today.'); return; }
        await c.say('poet', 'The third line needs something true that happened today. Not yesterday. Nothing in Encore has happened today in three hundred years.');
        await c.quest('thirdline');
      },
    },
    {
      id: 'clockmaker', x: 27, y: 10, sprite: P('person', 'clockm', 'cream', 'brown'), show: (c) => c.flag('c4_done') || phase(c) === 0, prayer: 'Please let me fix it in time.',
      talk: async (c) => {
        if (!c.flag('c4_done')) {
          await c.say('clockmaker', 'The tower clock runs backward every night. I fix it every morning. It is the steadiest work I have ever had.');
          await c.say('clockmaker', 'The tower door opens for whoever winds the Day Spring, or for the festival key. The Mayor carries the key in the noon parade.');
          c.set('k_clock');
        }
        await c.shop(['again_w2', 'again_w3', 'anyone_w3', 'bigger_w3', 'someday_w4', 'hello_w4', 'coat4', 'luckypleat', 'pinwheel'], 'Clockmaker');
      },
    },
    {
      id: 'baker', x: 26, y: 24, sprite: P('person', 'baker', 'white', 'pink'), prayer: 'Please let it rise.',
      talk: async (c) => {
        if (c.flag('c4_done')) await c.say('baker', 'A new cake! I do not know how to make a new cake! Isn\'t it wonderful!');
        else await c.say('baker', 'Cake for tomorrow! I make the festival cake every day. It is always perfect. I have made it ninety thousand times.');
        await c.shop(['stew', 'feast', 'honey', 'picnic', 'tonic', 'card', 'icewater'], 'Bakery');
      },
    },
    {
      id: 'couple1', x: 20, y: 17, sprite: P('person', 'beau', 'tan', 'navy'), prayer: 'Please let her say yes.',
      talk: async (c) => {
        if (c.flag('c4_done')) { await c.say(null, '"I asked her," he says. "Tomorrow came and I asked her." He holds up a hand with a ring on it. Both of their hands have rings on them.'); return; }
        if (c.flag('d_asked')) { await c.say(null, '"She said yes," he says, to nobody, again. "Today. She said yes today."'); return; }
        await c.say(null, '"I am going to ask her tomorrow," he says, and holds a little box very tightly.');
        if (c.q('thirdline') < 1) return;
        const r = await c.ask('hello', '...', ['Ask her today.', 'Good luck tomorrow.']);
        if (r !== 0) return;
        await c.say('hello', 'Tomorrow does not come here. Ask her today.');
        await c.say(null, 'He looks at the box. He looks at her. He looks at the box again, as if it might have an opinion.');
        await c.say(null, '"Today," he says. He turns around. "Will you..."');
        await c.say(null, '"Yes," she says, before he finishes. "Yes. I said yes three hundred years ago. In my head. Every day."');
        c.sfx('answer');
        c.set('d_asked');
        await c.quest('thirdline', 2);
      },
    },
    {
      id: 'couple2', x: 21, y: 17, sprite: P('person', 'belle', 'tan', 'rose'), prayer: 'Please let him ask me.',
      talk: async (c) => { await c.say(null, c.flag('c4_done') ? '"He finally asked," she says. "I said yes three hundred years ago. In my head."' : '"He is going to ask me tomorrow," she whispers. "I just know it."'); },
    },
    { id: 'kid1', x: 9, y: 11, sprite: P('child', 'tag1', 'tan', 'lime'), wander: true, prayer: 'Please let me be it.', talk: async (c) => { await c.say(null, '"I\'m it! I\'m always it! I love being it!"'); } },
    { id: 'kid2', x: 11, y: 12, sprite: P('child', 'tag2', 'tan', 'orange'), wander: true, prayer: 'Please let me never be it.', talk: async (c) => { await c.say(null, '"Not it!" says the other kid. "Not it, not it, not it, for three hundred years, not it."'); } },
    { id: 'again_v', x: 15, y: 16, sprite: AGAIN, show: (c) => isPhase(2)(c) && !c.flag('k_again'), talk: async (c) => { await c.say(null, 'A small child sits on the edge of the fountain, watching the sky. "Do you think it will be nice tomorrow?" the child asks, and then laughs, like it was a joke.'); } },
    { id: 'tomorrow_big', x: 15, y: 17, sprite: P('beast', 'tomorrow', 'navy', 'gold'), scale: 2, show: (c) => c.flag('c4_done'), talk: async (c) => { await c.say(null, 'Tomorrow is lying in the plaza in the sun... in the warmth, anyway. Children are climbing on it. It looks very pleased to be here.'); } },
  ],
  ferals: [
    { x: 9, y: 9, group: 'en3', show: (c) => !c.flag('c4_done') }, { x: 22, y: 12, group: 'en1', show: (c) => !c.flag('c4_done') },
    { x: 12, y: 19, group: 'en2', show: (c) => !c.flag('c4_done') }, { x: 22, y: 27, group: 'en4', show: (c) => !c.flag('c4_done') },
    { x: 31, y: 14, group: 'en5', still: true, show: (c) => phase(c) === 2 && !c.flag('c4_done') },
    { x: 5, y: 27, group: 'en1', show: (c) => !c.flag('c4_done') },
  ],
  digs: [
    { x: 2, y: 10, id: 'e_tomorrow', slip: 'tomorrow' },
    { x: 31, y: 2, id: 'e_band', slip: 'band' },
    { x: 18, y: 26, id: 'e_ice', slip: 'ice' },
    { x: 8, y: 27, id: 'e_feast', item: 'feast' },
    { x: 31, y: 16, id: 'e_snow', slip: 'snow' },
  ],
  triggers: [
    {
      x: 6, y: 7, touch: true,
      run: async (c) => {
        if (c.flag('c4_done')) { await c.say(null, 'The clock tower. Its hands are moving forward now, a little unsure of themselves.'); return; }
        if (!c.has('towerkey')) { await c.say(null, 'The clock tower door is locked. The keyhole is shaped like a little sun with a ribbon on it.'); return; }
        await c.say(null, 'The festival key turns in the lock.');
        await c.goto('tower', 7, 32, 0);
      },
    },
    {
      x: 16, y: 14, w: 2, h: 2, touch: true,
      run: async (c) => {
        await c.say(null, 'The fountain. Coins at the bottom, all pressed prayers. All of them say the same thing: please, not yet.');
        if (c.s.roster.again) await echoGame(c);
      },
    },
  ],
  exits: [
    { x: 6, y: 19, to: 'inn', tx: 5, ty: 8, dir: 0 },
    {
      x: 16, y: 29, w: 2, to: 'encore', tx: 16, ty: 1, dir: 2,
      blocked: async (c) => {
        if (c.flag('c4_done')) { await c.fadeOut(); await c.card(5); await c.goto('jackpot', 20, 34, 0); return; }
        if (!c.flag('c4_loopmsg')) {
          c.set('c4_loopmsg');
          await c.say(null, 'The road out of Encore bends around a big tree, and bends again, and comes back in at the top of the village.');
        }
        await c.goto('encore', 16, 1, 2);
      },
    },
    { x: 16, y: 0, w: 2, to: 'encore', tx: 16, ty: 28, dir: 0 },
  ],
  enter: async (c) => {
    if (c.flag('c4_enter')) return;
    c.set('c4_enter');
    c.s.chapter = 4;
    c.music('encore');
    await c.wait(20);
    await c.say(null, 'The tube spits you out onto soft grass. Someone has hung bunting on everything. There is a smell of cake.');
    await c.say(null, 'A sign over the road: WELCOME TO ENCORE. HAPPY FESTIVAL EVE.');
    await c.say('someday', "Haven't seen a place this cheerful since... no. I have never seen a place this cheerful.");
    await c.say('anyone', 'The lines here are very quiet. Not dead. Just... going in a circle.');
    await c.say(null, 'The inn is on the west side of the plaza. The road out runs south.');
  },
};

async function poemScene(c: Ctx) {
  await c.say('hello', 'He asked her. Today. She said yes.');
  await c.say('poet', '...Today? Something happened today?');
  await c.say(null, 'The Poet writes very fast, crosses out one word, and writes it again the same way.');
  await c.say('poet', 'Listen.');
  await c.say('poet', '"We built a festival for the day that never comes. / We hung the bunting every evening and took it down at dawn. / Today a man asked the question he was saving. / So something happened here, at least the once."');
  await c.wait(30);
  await c.say('poet', 'Three hundred years, and the third line was just something that happened. Take my quill. I am done with it. I would like to go and be in the fourth line for a while.');
  await c.give('quill');
  await c.finish('thirdline');
}

async function echoGame(c: Ctx) {
  await c.say('again', 'Let\'s play Echo! I ring the bells, you ring them back. Same order. Unless I say backwards!');
  if (!c.q('echo')) {
    await c.say('again', 'If you get seven in a row I will give you my favorite thing. I have had it for three hundred years. Well. One day. Lots of times.');
    await c.quest('echo');
  }
  const r = await c.ask('again', 'Play?', ['Play', 'Not now']);
  if (r !== 0) return;
  const res = await c.minigame('echo');
  if (res.score > 0) await c.pleas(res.score * 5);
  if (res.score >= 7 && !c.qdone('echo')) {
    await c.say('again', 'SEVEN! You remembered seven! Here. It always rings the same note twice. That is the best kind of note.');
    await c.give('tuningfork');
    await c.finish('echo');
  }
  if (res.score >= 10 && !c.flag('page_8')) {
    await c.say('again', 'TEN?! Okay. Okay okay okay. I found this in the tower a hundred thousand todays ago. It never went away when the day reset. So it must be important.');
    await page(c, 8);
  }
}

// ---------------------------------------------------------------- the inn
const inn = new Grid(12, 10, 'o').frame(0, 0, 12, 10, '#').put(5, 9, '+').rect(1, 1, 2, 2, 'b').rect(9, 1, 2, 2, 'b').rect(1, 5, 2, 2, 'b').rect(4, 2, 4, 1, '=').put(10, 6, 'p');
const INN: MapDef = {
  id: 'inn', name: 'The Festival Inn', chapter: 4, music: 'encore',
  rows: inn.rows(),
  legend: { o: t.floor('tan', 'brown'), '#': t.wall('cream', 'pink'), '+': t.deco('door', 'brown', 'cream'), b: t.solid('carpet', 'cream', 'sky'), '=': t.solid('counter', 'pink', 'brown'), p: t.solid('plant', 'tan', 'moss') },
  npcs: [
    {
      id: 'innkeep', x: 6, y: 1, sprite: P('person', 'innkeep', 'tan', 'green'), prayer: 'Please let every room be full.',
      talk: async (c) => {
        if (c.flag('c4_done')) { await c.say('innkeep', 'Rooms are not free anymore! Ha! Just kidding. Rest up.'); c.heal(); return; }
        if (!c.flag('c4_inntalk')) { await innScene(c); return; }
        const r = await c.ask('innkeep', 'A room for the night? Rooms are free on Festival Eve.', ['Sleep until morning', 'Just rest a bit', 'No thanks']);
        if (r === 0) await bedtimeReset(c);
        else if (r === 1) { c.heal(); c.sfx('heal'); await c.say(null, 'The party rests. Everyone feels better.'); }
      },
    },
    { id: 'again_npc', x: 5, y: 7, sprite: AGAIN, show: () => false },
  ],
  exits: [{ x: 5, y: 9, to: 'encore', tx: 6, ty: 20, dir: 2 }],
};

async function innScene(c: Ctx) {
  c.set('c4_inntalk');
  await c.say('innkeep', 'Welcome to the Festival Inn! Rooms are free tonight, it is the Eve. Every night is the Eve. I mean, tonight is the Eve.');
  await c.fadeOut();
  c.music('sad');
  await c.fadeIn();
  await c.say(null, 'For the first time since Lowmost, nobody is chasing anybody. Bigger lies across three beds and falls asleep in the middle of a sentence.');
  await c.say('bigger', 'BALL... ZZZ.');
  await c.say('anyone', 'Saints do not sleep. We hold. I do not know what to do with my hands when nobody is calling.');
  await c.say('someday', 'Put them in your pockets. That is what pockets are for.');
  await c.say('anyone', 'I do not have pockets.');
  await c.say('someday', 'Then hold on to something. Here. Hold my pipe. Do not smoke it. It is full of somebody\'s grandmother\'s prayers.');
  await c.say('hello', 'Can I ask everyone something?');
  await c.say('hello', 'If the Return came for you. If they read your name. Would you go?');
  await c.say('someday', 'I would go look. Just to see. Then I would come back and tell you all about it, sprout. Nobody stops me coming back.');
  await c.say('anyone', 'I do not know where I would go. My world is gone. Maybe they would send me to the place where it used to be. Maybe that is a kind of home.');
  await c.say('bigger', '...BOY?');
  await c.say(null, 'Bigger says it in his sleep, and then he does not say anything else, and nobody answers him.');
  await c.say('hello', 'I would want to know who asked for me. I would want to see their face. Even if I did not stay.');
  await c.say('someday', 'Get some sleep, sprout. Whatever tomorrow is, it will be there in the morning.');
  const r = await c.ask(null, 'Sleep until morning?', ['Sleep', 'Not yet']);
  if (r === 0) await bedtimeReset(c);
  else c.music('encore');
}

// ---------------------------------------------------------------- the clock tower
const tw = new Grid(16, 34, '#');
tw.rect(1, 28, 14, 4, '.').rect(1, 22, 14, 4, '.').rect(1, 16, 14, 4, '.').rect(1, 10, 14, 4, '.').rect(1, 2, 14, 6, '.');
tw.rect(13, 26, 2, 2, '.').rect(1, 20, 2, 2, '.').rect(13, 14, 2, 2, '.').rect(1, 8, 2, 2, '.');
tw.rect(7, 32, 2, 2, '.').put(7, 33, '+').put(8, 33, '+');
tw.scatter('g', 10, 451, '.', 2);
tw.rect(1, 2, 14, 6, '.').put(7, 2, 'S');

const TOWER: MapDef = {
  id: 'tower', name: 'The Clock Tower', chapter: 4, music: 'dungeon', bg: 'ink', battleBg: ['navy', 'brown'], mode: () => 'dusk', weather: 'dust',
  rows: tw.rows(),
  legend: { '.': t.floor('tan', 'brown', 'floor'), '#': t.solid('gear', 'brown', 'tan'), g: t.solid('gear', 'tan', 'gold'), '+': t.deco('door', 'brown', 'gold'), S: t.solid('gear', 'gold', 'cream') },
  npcs: [
    { id: 'bedtime', x: 7, y: 4, sprite: BEDTIME, scale: 4, show: (c) => !c.flag('c4_bedtime') },
    { id: 'again_t', x: 7, y: 3, sprite: AGAIN, show: (c) => c.flag('c4_spring') },
    { id: 'phone', x: 2, y: 11, sprite: P('object', 'payphone', 'slate', 'sky'), talk: (c) => c.payphone() },
  ],
  ferals: [{ x: 5, y: 29, group: 'tw1' }, { x: 9, y: 23, group: 'tw2' }, { x: 5, y: 17, group: 'tw3' }, { x: 10, y: 11, group: 'tw1' }],
  digs: [{ x: 12, y: 18, id: 't_stew', item: 'honey' }, { x: 3, y: 24, id: 't_cat', slip: 'cat' }, { x: 4, y: 12, id: 't_page7', page: 7 }],
  triggers: [
    {
      x: 1, y: 7, w: 14, once: 'c4_bedev',
      run: async (c) => {
        c.set('c4_bed');
        c.music(null);
        await c.say(null, 'The top of the tower. Gears turn backward on every wall. In the middle, an enormous spring, coiled tight, ticking.');
        await c.say(null, 'In front of it sits something very large in a nightcap.');
        await c.say('bedtime', 'Oh. Oh no. You are up past bedtime.');
        if (c.s.roster.again) {
          await c.say('again', 'Bedtime! Don\'t! They\'re my friends!');
          await c.say('bedtime', 'Little one. You asked me to keep tomorrow out. Tomorrow is right outside the hedge. It has been knocking for three hundred years.');
          await c.say('again', '...I know.');
        }
        await c.say('bedtime', 'Lie down, now. And we will do today again.');
        await c.say('hello', 'No.');
        const r = await c.battle('bedtime', { music: 'boss', scene: 'bedtime' });
        if (r !== 'win') { c.s.flags.c4_bedev = 0; c.s.flags.c4_bed = 0; return; }
        await afterBedtime(c);
      },
    },
  ],
  exits: [{ x: 7, y: 33, w: 2, to: 'encore', tx: 6, ty: 8, dir: 2 }],
  enter: async (c) => {
    if (c.flag('c4_twenter')) return;
    c.set('c4_twenter');
    await c.say(null, 'Inside the clock tower everything is gears, all turning slowly backward. Time does not pass in here. It goes the other way.');
  },
};

async function afterBedtime(c: Ctx) {
  c.set('c4_bedtime');
  c.show('bedtime', false);
  await c.say(null, 'Bedtime sits down all at once, the way a tired parent sits.');
  c.set('c4_spring');
  c.show('again_t', true);
  await c.say('again', 'If I let go of the Spring, tomorrow comes. The festival happens. And then the day after. And everybody gets older, and some of them leave.');
  await c.say('again', 'And I have to find out what happens next. I never found out. My asker moved away and I never found out if they were okay.');
  await c.ask('hello', '...', ["You can't keep a moment.", 'But you can carry it.']);
  await c.say('hello', 'You can\'t keep a moment. But you can carry it with you.');
  await c.say('again', '...Will you carry it with me?');
  await c.say('hello', 'Yes.');
  await c.say('again', '...Okay.');
  c.shake(40);
  c.flash('white', 20);
  c.sfx('rewind');
  await c.say(null, 'Again lets go. The Day Spring unwinds all at once: three hundred years of today, let out in one long breath.');
  await c.fadeOut();
  c.set('c4_done');
  for (const k of Object.keys(c.s.flags)) if (k.startsWith('d_')) delete c.s.flags[k];
  c.take('towerkey', 9);
  c.field.load('encore', 16, 20, 0);
  c.music('town');
  await c.wait(20);
  await c.fadeIn();
  await c.say(null, 'Tomorrow comes in over the hedge like a tide. It is a little cloudy. It is the first new weather in three hundred years.');
  await c.say('mayor', 'The Festival of Tomorrow! It is TODAY! Everyone! It is today!');
  await c.say(null, 'Tomorrow itself, the big shape that knocked at the hedge every night, wanders into the plaza and lies down, very carefully, so as not to squash anyone.');
  await c.say('anyone', 'Hello. While we were in here, the outside kept going. I can hear the lines again, from the edges.');
  await c.say('anyone', 'Forty-one days have passed out there.');
  await c.say('someday', 'Forty-one days. How many more names did they read in forty-one days?');
  await c.say('again', 'Sorry. I am sorry. I did not know there was an outside. I forgot.');
  await c.say('hello', "It's okay. Tomorrow's here now. Let's go.");
  await c.say('again', 'Where are we going?');
  await c.say('anyone', 'Up. Eventually. The Catch is in the sky, and the only way up is the Line, and nobody may approach the Line without a Line Pass.');
  await c.say('someday', 'And the only place that hands out Line Passes is the worst town in the Silt. Jackpot.');
  await c.say(null, 'The road south leads out of Encore. For the first time in three hundred years, it goes somewhere.');
  c.set('slip', Math.max(c.num('slip'), 4));
}

export const CH4: MapDef[] = [ENCORE, INN, TOWER];

