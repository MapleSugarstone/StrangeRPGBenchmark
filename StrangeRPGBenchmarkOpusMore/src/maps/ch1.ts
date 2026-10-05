import { Grid } from './grid';
import { MapDef, t } from './types';
import { registerSpeaker } from '../game/speakers';
import type { Ctx } from '../game/ctx';
import { page } from './side';

const P = (tt: string, seed: string, a: string, b: string) => ({ t: tt, seed, a, b });
const SOMEDAY = P('person', 'someday3', 'tan', 'rust');
const FEN = P('child', 'fen', 'tan', 'green');
const GALE = P('person', 'gale2', 'paper', 'sky');
const OLDASK = P('person', 'oldask', 'grey', 'plea');
const LINEMAN = P('robed', 'lineman', 'slate', 'grey');
const PHONE = P('object', 'payphone', 'slate', 'sky');
const WANT = P('worm', 'want', 'rose', 'plea');
registerSpeaker('want', 'The Want', WANT, 'rose');

const night = (c: Ctx) => c.flag('c1_dusk') && !c.flag('c1_want');

// ---------------------------------------------------------------- hut
const hut = new Grid(12, 9, 'o').frame(0, 0, 12, 9, '#').put(3, 0, 'w').put(8, 0, 'w')
  .rect(1, 1, 2, 2, 'b').put(9, 1, 's').put(10, 1, 's').put(10, 4, 'v').rect(5, 3, 2, 1, 'c').put(6, 8, '+');

const HUT: MapDef = {
  id: 'hut', name: "Someday's hut", chapter: 1, music: 'town', bg: 'ink', mode: (c) => (night(c) ? 'night' : null),
  rows: hut.rows(),
  legend: {
    o: t.floor('tan', 'brown'), '#': t.wall('plea', 'tan'), w: t.solid('window', 'sky', 'plea'), '+': t.deco('door', 'brown', 'tan'),
    b: t.solid('carpet', 'cream', 'rust'), s: t.solid('shelf', 'tan', 'plea'), v: t.solid('vent', 'slate', 'rust'), c: t.solid('crate', 'tan', 'brown'),
  },
  npcs: [
    {
      id: 'someday', x: 8, y: 5, sprite: SOMEDAY, dir: 3, show: (c) => !c.s.party.includes('someday') || c.flag('c1_lines'),
      prayer: "Someday I won't be here, so please send someone to look after my little one.",
      talk: async (c) => {
        if (c.flag('c1_mentor')) { await c.say('someday', "Road's north, sprout. I'll catch up. I always do."); return; }
        if (!c.flag('c1_net')) { await c.say('someday', "Net. Gale. Shallows. Go on. And mind the mites, they nibble."); return; }
        await c.say('someday', 'Back already? Go see the Asking. It might be the last quiet one for a while. Feels like that kind of night.');
      },
    },
  ],
  exits: [{ x: 6, y: 8, to: 'lowmost', tx: 7, ty: 9, dir: 2 }],
  triggers: [
    {
      x: 9, y: 1, w: 2, touch: true,
      run: async (c) => {
        if (c.flag('c5_house')) { await c.say(null, "Someday's shelf. The pipe is gone. So is the badge. There is a clean square in the dust where it lay for six years."); return; }
        await c.say(null, "Someday's shelf: a spare pipe, three jars of dried slips, and a tin badge lying face down.");
        await c.say(null, 'You turn the badge over. It is stamped 0411. You put it back face down, the way you found it.');
      },
    },
    { x: 10, y: 4, touch: true, run: async (c) => { await c.say(null, 'The stove vent. It ticks as it cools, three ticks and a pause, like a phone that will not quite ring.'); } },
  ],
  enter: async (c) => {
    if (!c.flag('c1_wake')) {
      c.set('c1_wake');
      await c.wait(30);
      await c.say('someday', "Up, sprout. Asking's tonight, and the nets won't mend themselves.");
      await c.say('hello', 'Hello.');
      await c.say('someday', "Hello yourself. Six years and you still say it like you're picking up a call.");
      if (c.flag('ngplus')) {
        await c.say('someday', '...Funny. Feels like we have done today before. You look like you know where you are going, sprout.');
        await c.say('hello', 'I think I have been here. I think it went differently.');
        await c.say('someday', 'Then do it better. Or do it the same and mean it more.');
      }
      await c.say('someday', "I mended Gale's net. Run it down to the Shallows. She'll want it before dusk.");
      await c.give('net');
      await c.say('someday', "And check your slip while you're out. Maybe tonight it says something.");
      await c.say(null, 'Your slip is blank. It always has been. If you hold it close, it sounds like someone breathing, very far away.');
      await c.say(null, 'Arrows move. Z talks and confirms. X opens the menu. C listens. Hold Shift to run. Tab shows your current goal.');
      return;
    }
    if (c.flag('c1_lines') && !c.flag('c1_mentor')) await mentorScene(c);
  },
};

async function mentorScene(c: Ctx) {
  c.set('c1_mentor');
  c.music('sad');
  c.place('hero', 6, 5);
  c.face('hero', 'r');
  c.place('someday', 8, 5);
  c.face('someday', 'l');
  await c.wait(30);
  await c.say(null, 'Someday lights her pipe. The smoke smells like old prayers: rain, bread, a name said twice.');
  await c.say('someday', 'Six years ago I was out on the Shallows alone. No wind. No Asking yet. And the silt sat up.');
  await c.say('someday', "Covered in slips, every one blank. It looked at me and said 'Hello?' Like it was picking up a call. Like someone had rung.");
  await c.say('someday', "Nobody is 'not anyone's', sprout. Somebody rang. You picked up.");
  await c.say('hello', 'Then who rang?');
  await c.say('someday', "Don't know. Maybe the slip tells you when it's ready. Maybe you have to go and ask.");
  await c.say('someday', 'Here.');
  await c.give('hello_w2');
  const m = c.s.roster.hello;
  if (m) { m.weapon = 'hello_w2'; c.take('hello_w2'); }
  await c.say(null, 'Hello equips the Rotary Handset. It is heavier than it looks, and warm.');
  await c.say('someday', 'It was mine. From before. When I worked the Line.');
  await c.say('hello', 'You worked the Line?');
  await c.say('someday', "Long time ago. Different me. Don't ask.");
  await c.say('someday', "The Docket files every slip that ever fell. If anyone knows where they took Fen, it's the Docket. The road goes north, through the Waiting Room.");
  await c.say('hello', 'Somebody should ask them where they are taking people.');
  await c.say('someday', 'Somebody should.');
  await c.say('hello', "...I guess I'll ask.");
  await c.say('someday', "That's my sprout. Grab your coat. I'm coming. You'd only get lost.");
  await c.join('someday', undefined, true);
  c.music('town');
}

// ---------------------------------------------------------------- lowmost
const lm = new Grid(32, 26, '.').frame(0, 0, 32, 26, 'T');
lm.scatter('~', 10, 11).scatter('T', 7, 12);
lm.rect(15, 0, 2, 26, ',').rect(8, 10, 19, 1, ',').rect(13, 11, 6, 4, ',').rect(4, 15, 22, 1, ',').rect(26, 19, 6, 1, ',');
lm.house(5, 4, 5, 5, 7).house(23, 4, 6, 5, 25).house(2, 11, 4, 4, 3, { doorCh: 'd' }).house(19, 21, 5, 4, 21, { doorCh: 'd' });
lm.rect(21, 16, 7, 3, '=').put(24, 18, 'd').rect(12, 2, 2, 2, 'H');
lm.frame(3, 18, 6, 5, 'f').rect(4, 19, 4, 3, 'g').put(5, 22, '.');
lm.put(7, 9, ',').put(25, 9, ',');

const LOWMOST: MapDef = {
  id: 'lowmost', name: 'Lowmost', chapter: 1, music: 'town', bg: 'moss', battleBg: ['siltdk', 'brown'], weather: 'dust',
  rows: lm.rows(),
  legend: {
    '.': t.floor('silt', 'siltdk', 'speck'), ',': t.floor('plea', 'silt', 'sand'), T: t.solid('tree', 'silt', 'moss'), '~': t.deco('drift', 'silt', 'paper'),
    '#': t.wall('plea', 'tan'), '^': t.solid('roof', 'rust', 'brown'), w: t.solid('window', 'sky', 'plea'), '+': t.deco('door', 'brown', 'tan'),
    d: t.solid('door', 'brown', 'tan'), H: t.solid('pillar', 'gold', 'plea'), '=': t.solid('brick', 'plea', 'siltdk'), f: t.solid('fence', 'silt', 'brown'),
    g: t.floor('silt', 'moss', 'grass'),
  },
  npcs: [
    { id: 'phone', x: 13, y: 11, sprite: PHONE, talk: (c) => c.payphone() },
    {
      id: 'oldask', x: 11, y: 4, sprite: OLDASK, prayer: 'Please, God, let me live forever.', show: (c) => !c.flag('c1_lines') || true,
      talk: async (c) => {
        if (night(c)) { await c.say('oldask', 'Nine thousand years it fell. Every night. You could set your teeth by it. I am not sure what to set my teeth by now.'); return; }
        if (c.flag('c1_lines')) { await c.say('oldask', "They didn't call my name. My asker's been dust for ten thousand years. Even the Return doesn't want an old rock like me."); return; }
        await c.say('oldask', "I asked to live forever. Nobody said I'd have to enjoy it.");
        await c.say('oldask', 'Every night, the Asking falls. Slips from Above. Most just lie there whispering. We sort them, press them, spend them.');
        await c.say('oldask', 'And the heavy ones sink in and grow. That is how you got here. That is how all of us got here.');
      },
    },
    {
      id: 'fen', x: 17, y: 13, sprite: FEN, prayer: 'Please give me a brother. I will let him have the top bunk.', show: (c) => !c.flag('c1_want'),
      talk: async (c) => {
        if (night(c)) { await c.say('fen', "Are you going down the Shaft? Bring back something good. Bring back the Asking!"); return; }
        await c.say('fen', "Hello! Is it tonight? It's tonight! I'm going to catch one with my bare hands.");
        await c.say('fen', "My slip says a boy prayed for a brother. That's me. I'm the brother. I've never met him, but I'm already good at it.");
        await c.say('fen', "You can be my practice brother. You're already tall.");
      },
    },
    {
      id: 'runner', x: 20, y: 12, sprite: P('person', 'runner', 'tan', 'red'), wander: true, prayer: 'Please, please let me win the race.', show: (c) => !c.flag('c1_want'),
      talk: async (c) => {
        if (c.qdone('race')) { await c.say('runner', 'Walking is incredible. Did you know you can look at things while you do it?'); return; }
        c.inc('lap');
        await c.say('runner', `Can't stop! Lap ${4012 + c.num('lap') * 3}! Somebody asked to win the race. Didn't say which race. Still going!`);
        if (night(c)) return;
        await raceStart(c);
      },
    },
    {
      id: 'tall', x: 10, y: 8, sprite: P('person', 'tall', 'tan', 'slate'), scale: 2, prayer: 'Please, just make me taller.', show: (c) => !c.flag('c1_want'),
      talk: async (c) => {
        await c.say('tall', "Sorry. Sorry, I'm in the way. Somebody wanted to be taller, and here I am, being it for them.");
        await c.say('tall', 'Do you think they ever got tall? I hope they did. I hope they did not need me.');
      },
    },
    {
      id: 'goodboy', x: 20, y: 8, sprite: P('dog', 'goodboy', 'brown', 'paper'), wander: true, prayer: 'Please let him be a good boy at the vet.', show: (c) => !c.flag('c1_want') || c.flag('c1_lines'),
      talk: async (c) => {
        if (c.qdone('goodboy')) { await c.say(null, 'Good Boy is lying on his back in the sun, which is not there, being good about it anyway.'); return; }
        if (c.has('dogtag')) {
          c.take('dogtag');
          await c.say(null, 'You hold out the tag. Good Boy reads it, or smells it, which for a dog is the same thing. GOOD BOY. IF FOUND, HE WAS GOOD AT THE VET.');
          await c.say(null, 'He sits down very straight. He holds out a paw. For the first time since he grew, he does not look worried about anything.');
          await c.say(null, 'When you stand up, there is a collar at your feet. He must have been carrying it in his mouth the whole time, waiting for someone to give it to.');
          await c.give('goodtag');
          await c.finish('goodboy');
          return;
        }
        await c.say(null, 'Good Boy wags. He is a very good boy. It says so on his slip.');
        await c.say(null, 'Then he stops wagging, looks south toward the Shallows road, and whines. Whatever he lost, he lost it down there.');
        await c.quest('goodboy');
      },
    },
    {
      id: 'sign', x: 17, y: 5, sprite: P('sign', 'friendlysign', 'tan', 'plea'), prayer: 'Please, just give me a sign.',
      talk: async (c) => {
        c.inc('signtalk');
        if (c.num('signtalk') === 6) { await c.say(null, 'The Sign turns, very slowly, until it is pointing at you. It holds there a moment. Then it swings back north, as if embarrassed.'); return; }
        await c.say(null, 'The Sign points north, firmly, toward the Waiting Room road. It has never been wrong. It has never been anywhere.');
      },
    },
    {
      id: 'kid2', x: 8, y: 16, sprite: P('child', 'pip', 'tan', 'pink'), wander: true, prayer: 'Please let me find my way home.', show: (c) => !c.flag('c1_want'),
      talk: async (c) => {
        if (night(c)) { await c.say(null, 'The girl is hiding behind the fence. "Something big is down there," she whispers. "It is chewing."'); return; }
        await c.say(null, '"I was a lost kid that somebody prayed would find their way home. So I found my way here. I think I did it wrong."');
      },
    },
    // Collectors' scene.
    { id: 'line1', x: 15, y: 12, sprite: LINEMAN, scale: 2, show: (c) => c.flag('c1_want') && !c.flag('c1_lines') },
    { id: 'line2', x: 17, y: 11, sprite: LINEMAN, scale: 2, show: (c) => c.flag('c1_want') && !c.flag('c1_lines') },
    { id: 'line3', x: 14, y: 11, sprite: LINEMAN, scale: 2, show: (c) => c.flag('c1_want') && !c.flag('c1_lines') },
    { id: 'fen2', x: 16, y: 14, sprite: FEN, show: (c) => c.flag('c1_want') && !c.flag('c1_lines') },
    { id: 'runner2', x: 18, y: 14, sprite: P('person', 'runner', 'tan', 'red'), show: (c) => c.flag('c1_want') && !c.flag('c1_lines') },
    { id: 'tall2', x: 13, y: 14, sprite: P('person', 'tall', 'tan', 'slate'), scale: 2, show: (c) => c.flag('c1_want') && !c.flag('c1_lines') },
    { id: 'someday_t', x: 15, y: 16, sprite: SOMEDAY, show: (c) => c.flag('c1_want') && !c.flag('c1_lines') },
  ],
  ferals: [
    { x: 22, y: 15, group: 'mites', show: night },
    { x: 18, y: 20, group: 'mite3', show: night },
    { x: 9, y: 13, group: 'mites', show: night },
  ],
  triggers: [
    {
      x: 12, y: 2, w: 2, h: 2, touch: true,
      run: async (c) => {
        if (night(c)) { await c.say(null, 'The Listening Horn hums. Far below, something is chewing.'); return; }
        await c.say(null, 'The Listening Horn. Dredgers built it to hear the Asking coming down. It has never once been early.');
        await c.say(null, 'Press C anywhere to Listen. You hear things other people miss: buried slips, and the prayers that people grew from.');
      },
    },
    {
      x: 21, y: 16, w: 7, h: 3, touch: true,
      run: async (c) => {
        if (c.flag('c1_dusk')) await c.say(null, 'The Granary door is chewed open. A winter of pressed slips, gone.');
        else await c.say(null, 'The Granary. A winter of slips, pressed and stacked. You can hear them murmuring through the wall.');
      },
    },
    ...raceTriggers(),
  ],
  exits: [
    { x: 7, y: 8, to: 'hut', tx: 6, ty: 7, dir: 0 },
    { x: 25, y: 8, to: 'press', tx: 4, ty: 6, dir: 0 },
    { x: 15, y: 25, w: 2, to: 'shallows', tx: 16, ty: 1, dir: 2 },
    {
      x: 15, y: 0, w: 2, to: 'waiting', tx: 20, ty: 38, dir: 0,
      blocked: async (c) => {
        if (!c.flag('c1_mentor')) {
          await c.say(null, 'The north road runs to the Waiting Room and the Docket beyond. Nobody from Lowmost has needed to go that far.');
          await c.walk('hero', 'd', 6);
          return;
        }
        c.set('slip', Math.max(c.num('slip'), 1));
        await c.fadeOut();
        await c.card(2);
        await c.goto('waiting', 20, 38, 0);
      },
    },
    {
      x: 31, y: 19, to: 'shaft1', tx: 2, ty: 2, dir: 2,
      blocked: async (c) => {
        if (!c.flag('c1_dusk')) {
          await c.say(null, 'The Old Shaft. Boarded up since before you grew. Nobody goes down there.');
          await c.walk('hero', 'l', 6);
          return;
        }
        if (c.flag('c1_want')) {
          await c.say(null, 'The Old Shaft is quiet now.');
          await c.walk('hero', 'l', 6);
          return;
        }
        await c.goto('shaft1', 2, 2, 2);
      },
    },
  ],
  enter: async (c) => {
    c.tint(night(c) ? 'navy' : null);
    if (night(c) && !c.flag('c1_raid')) {
      c.set('c1_raid');
      c.place('hero', 24, 20);
      c.face('hero', 'u');
      await c.wait(20);
      await c.say(null, 'Lowmost, after dark. The Granary door hangs open. Slipmites skitter between the houses with slips in their mouths.');
      await c.say('someday', 'They eat slips. No Asking, nothing to eat. So they come for ours.');
      await c.say('hello', 'And when ours run out?');
      await c.say('someday', "Then they come for us. We're made of slips, sprout. Every last one of us.");
      await c.say('someday', "They came up the Old Shaft. Something down there chewed the boards through. I'm going down. You're coming, because I'm old and you're not.");
      await c.join('someday', 2);
      await c.say(null, 'The Old Shaft is at the east edge of town. Walk into a feral to fight it. Someday knows her way around a hook.');
    }
    if (c.flag('c1_want') && !c.flag('c1_lines')) await collectors(c);
  },
};

async function collectors(c: Ctx) {
  c.set('c1_lines');
  c.tint(null);
  c.music('tense');
  c.place('hero', 15, 18);
  c.face('hero', 'u');
  c.bench('someday');
  await c.wait(30);
  await c.say(null, 'Morning. Lowmost is very quiet. Three tall figures stand in the square. Each carries a ladder and wears a headset over a face that is not there.');
  await c.say('someday', 'Linemen. Collectors. Stay back, sprout.');
  await c.say('lineman', 'Good morning. Thank you for your patience. The Asking is suspended. Every Answer will now be Returned to its asker.');
  await c.say('lineman', 'When your name is read, please step forward. You are going home.');
  await c.say('lineman', 'Runner. Asked for by: a girl who wanted to win the race. Status: Return.');
  await c.say('runner', '...Home? I get to stop? I think... I think I won.');
  await c.walk('runner2', 'uul', 10);
  c.show('runner2', false);
  await c.say('lineman', 'The Tall Man. Asked for by: a boy who wanted to be taller. Status: Return.');
  await c.say('tall', 'Do you think he will mind how tall I got?');
  await c.walk('tall2', 'uu', 10);
  c.show('tall2', false);
  await c.say('lineman', 'Fen. Asked for by: a boy who wanted a brother. Status: Return.');
  await c.say('fen', "No. No, I don't want to. I live here. Someday lives here. Hello lives here.");
  await c.say('lineman', 'That was not a question.');
  const r = await c.ask('hello', '...', ['Leave him alone!', 'Step in front of Fen']);
  await c.walk('hero', 'u', 8);
  await c.say('hello', r === 0 ? 'Leave him alone. He said no.' : '...');
  await c.say(null, 'The Lineman tilts its blank head and reads your slip without touching it.');
  await c.say('lineman', 'Hello. Asked for by: no sender on file. Status: not eligible.');
  await c.say('lineman', 'Please step aside. You are not anyone\'s.');
  c.shake(10);
  await c.say(null, 'It moves you aside the way you would move a chair. It does not even seem to notice that you are there.');
  await c.walk('fen2', 'u', 10);
  await c.say('fen', 'Hello? HELLO!');
  await c.fadeOut();
  for (const id of ['line1', 'line2', 'line3', 'fen2']) c.show(id, false);
  await c.wait(30);
  await c.fadeIn();
  await c.say('someday', "Not here. Not like this. They'd take you apart to read you.");
  await c.say('hello', "'You are not anyone's.' It didn't even look at me.");
  await c.ask('hello', '...', ["Then none of this is mine.", "Nobody asked for me. So why should I care?"]);
  await c.say('someday', 'Go home, sprout. Go home and sit down.');
  c.show('someday_t', false);
  await c.goto('hut', 6, 5, 0);
}

// ---------------------------------------------------------------- press (shop)
const pr = new Grid(10, 8, 'o').frame(0, 0, 10, 8, '#').rect(1, 3, 3, 1, '=').rect(5, 3, 4, 1, '=').text(1, 1, 'ssssssss').put(4, 7, '+');
const PRESS: MapDef = {
  id: 'press', name: 'The Pleas Press', chapter: 1, music: 'town',
  rows: pr.rows(),
  legend: { o: t.floor('tan', 'brown'), '#': t.wall('plea', 'tan'), '=': t.solid('counter', 'gold', 'brown'), s: t.solid('shelf', 'tan', 'plea'), '+': t.deco('door', 'brown', 'tan') },
  npcs: [{
    id: 'change', x: 4, y: 3, sprite: P('robed', 'change', 'gold', 'plea'), prayer: 'I need change. Please. Any change at all.',
    talk: async (c) => {
      await c.say('change', 'Mister Change, at your service. Every coin here is a pressed prayer. Mind the whispers, they get into your teeth.');
      const r = await c.ask('change', 'Buying, or working?', ['Buy', 'Sort the hopper', 'Leave']);
      if (r === 0) await c.shop(['soup', 'lozenge', 'tonic', 'card', 'firecracker', 'coat2', 'earmuffs', 'someday_w2', 'hello_w2'], 'The Pleas Press');
      else if (r === 1) await sortShift(c);
    },
  }],
  triggers: [
    { x: 1, y: 1, w: 8, touch: true, run: async (c) => { await c.say(null, 'Shelves of pressed pleas, stacked by weight. The heavy ones are on the bottom. The heavy ones always are.'); } },
  ],
  exits: [{ x: 4, y: 7, to: 'lowmost', tx: 25, ty: 9, dir: 2 }],
};

async function sortShift(c: Ctx) {
  if (!c.q('sort')) {
    await c.say('change', 'The hopper upstairs is full of last month\'s Asking. It all comes down the chute in the morning, and somebody has to catch it.');
    await c.say('change', 'Slips in the tray. Gold slips are the heavy ones, worth more. Plea-stone you let fall, or it cracks the tray and your fingers.');
    await c.say('change', 'Sort fifteen in one shift and I will give you something I have been saving. And I pay by the slip, every shift, forever.');
    await c.quest('sort');
  }
  const r = await c.minigame('sort');
  if (r.score > 0) await c.pleas(r.score);
  if (r.score >= 15 && !c.qdone('sort')) {
    await c.say('change', 'Fifteen! Your hands are faster than mine ever were. Here. My mother\'s thimble. She sorted for nine hundred years and never once cut a thumb.');
    await c.give('sortthimble');
    await c.finish('sort');
  }
  if (r.score >= 40 && !c.flag('page_2')) {
    await c.say('change', 'Forty. Nobody sorts forty. Hold on, something came down the chute with that last lot. It is not a slip. It is a page from a book.');
    await page(c, 2);
  }
}

// The race to the Horn, the pen gate, and back to the square. The time limit means you have to run.
const RACE_LIMIT = 6.5;
function raceTriggers() {
  const on = (c: Ctx) => c.num('race_t') > 0 && c.s.playtime - c.num('race_t') < 40;
  return [
    {
      x: 12, y: 4, w: 2, show: (c: Ctx) => on(c) && !c.flag('race_a'),
      run: async (c: Ctx) => { c.set('race_a'); c.sfx('blip'); c.field.notice = { text: 'The Horn! Now the pen gate.', t: 90 }; },
    },
    {
      x: 5, y: 22, show: (c: Ctx) => on(c) && c.flag('race_a') && !c.flag('race_b'),
      run: async (c: Ctx) => { c.set('race_b'); c.sfx('blip'); c.field.notice = { text: 'The gate! Back to the square.', t: 90 }; },
    },
    {
      x: 13, y: 11, w: 6, h: 4, show: (c: Ctx) => on(c) && c.flag('race_b'),
      run: async (c: Ctx) => {
        const time = Math.round((c.s.playtime - c.num('race_t')) * 10) / 10;
        for (const k of ['race_t', 'race_a', 'race_b']) delete c.s.flags[k];
        if (time > RACE_LIMIT) {
          await c.say('runner', `${time} seconds! I lapped you twice. Again? Hold Shift. Run like somebody asked you to.`);
          return;
        }
        await c.say('runner', `${time} seconds. You... you won. You beat me.`);
        await c.say('runner', 'Then I lost. I lost a race. ...Huh. Then the girl\'s race is still out there somewhere, waiting to be won.');
        await c.say('runner', 'Take my shoes. I am going to walk for a while. I have never walked.');
        await c.give('quickshoes');
        await c.finish('race');
      },
    },
  ];
}

async function raceStart(c: Ctx) {
  if (!c.q('race')) {
    await c.say('runner', 'You! You look fast. You look like somebody who asked to be fast. Race me.');
    await c.say('runner', 'To the Listening Horn, then the gate of the goat pen, then back to the square. Under six and a half seconds. I do it in four.');
    await c.quest('race');
  }
  const r = await c.ask('runner', 'Ready?', ['Go!', 'Not now']);
  if (r !== 0) return;
  for (const k of ['race_a', 'race_b']) delete c.s.flags[k];
  c.s.flags.race_t = c.s.playtime;
  c.sfx('ring');
  c.field.notice = { text: 'GO! To the Horn!', t: 90 };
}

// ---------------------------------------------------------------- shallows
const sh = new Grid(36, 28, '.').frame(0, 0, 36, 28, 'T');
sh.scatter('~', 45, 21).scatter('T', 6, 22);
sh.rect(0, 23, 36, 1, 'l').rect(0, 24, 36, 4, 'V');
sh.rect(16, 0, 2, 6, ',');
sh.house(5, 2, 6, 5, 8, { doorCh: 'd' });
sh.rect(13, 9, 5, 1, 'n').rect(21, 9, 5, 1, 'n').rect(8, 15, 5, 1, 'n').rect(24, 15, 5, 1, 'n').rect(15, 19, 6, 1, 'n');

const SHALLOWS: MapDef = {
  id: 'shallows', name: 'The Shallows', chapter: 1, music: 'field', bg: 'ink', battleBg: ['silt', 'siltdk'], mode: (c) => (night(c) ? 'night' : 'dusk'), weather: 'dust',
  rows: sh.rows(),
  legend: {
    '.': t.floor('silt', 'siltdk', 'speck'), ',': t.floor('plea', 'silt', 'sand'), T: t.solid('tree', 'silt', 'moss'), '~': t.deco('drift', 'silt', 'paper'),
    l: t.solid('ledge', 'silt', 'siltdk'), V: t.solid('void', 'ink', 'lilac'), n: t.solid('net', 'silt', 'slate'),
    '#': t.wall('plea', 'tan'), '^': t.solid('roof', 'slate', 'navy'), w: t.solid('window', 'sky', 'plea'), d: t.solid('door', 'brown', 'tan'),
  },
  npcs: [
    {
      id: 'gale', x: 8, y: 7, sprite: GALE, prayer: 'Please let the wind change.',
      talk: async (c) => {
        if (c.flag('c1_dusk')) { await c.say('gale', "Nothing. Not one slip. I've sorted every night since I grew. My hands don't know what to do with themselves."); return; }
        if (!c.flag('c1_net')) {
          if (!c.has('net')) { await c.say('gale', 'Hello, Hello. Did Someday finish my net?'); return; }
          c.take('net');
          c.set('c1_net');
          await c.say('gale', "Is that my net? Those are Someday's knots. I'd know them in the dark.");
          await c.say('gale', 'Asking comes at dusk. Until then the slipmites are all over the old drifts. They get into the fresh slips before we can sort them.');
          await c.say('gale', 'Clear a few for me? Walk into one to fight it. Or walk around, they are slow and you are not.');
          await c.say('gale', "Old dredger's trick: when you swing, wait for the ring to close and hit on the ring. When one swings at you, brace the moment you see the '!'.");
          await c.give('soup', 2);
          await c.say('gale', 'Come back when you are ready to wait for dusk.');
          return;
        }
        const r = await c.ask('gale', 'Ready to wait for dusk?', ["Let's wait", 'Not yet']);
        if (r === 0) await dusk(c);
      },
    },
    { id: 'g_someday', x: 10, y: 8, sprite: SOMEDAY, dir: 2, show: (c) => c.flag('c1_gather') && !c.flag('c1_dusk') },
    { id: 'g_fen', x: 11, y: 9, sprite: FEN, dir: 0, show: (c) => c.flag('c1_gather') && !c.flag('c1_dusk') },
    { id: 'g_oldask', x: 6, y: 8, sprite: OLDASK, dir: 1, show: (c) => c.flag('c1_gather') && !c.flag('c1_dusk') },
    { id: 'g_kid', x: 12, y: 8, sprite: P('child', 'pip', 'tan', 'pink'), show: (c) => c.flag('c1_gather') && !c.flag('c1_dusk') },
  ],
  ferals: [
    { x: 14, y: 12, group: 'mites' },
    { x: 26, y: 11, group: 'mites' },
    { x: 10, y: 18, group: 'sign' },
    { x: 28, y: 18, group: 'louder' },
    { x: 20, y: 21, group: 'mite3' },
    { x: 31, y: 5, group: 'signs' },
  ],
  digs: [
    { x: 4, y: 12, id: 's_ferry', slip: 'ferry' },
    { x: 30, y: 7, id: 's_cake', slip: 'cake' },
    { x: 19, y: 22, id: 's_spell', slip: 'spelling' },
    { x: 33, y: 20, id: 's_soup', item: 'soup', n: 2 },
    { x: 2, y: 20, id: 's_pleas', pleas: 15 },
    { x: 22, y: 4, id: 's_bunk', slip: 'bunk' },
    { x: 12, y: 20, id: 's_dogtag', item: 'dogtag' },
  ],
  triggers: [
    {
      x: 2, y: 22, w: 32, h: 1, once: 'c1_rim',
      run: async (c) => {
        await c.say(null, 'The Shallows end at the rim. Past the ledge there is nothing at all: no ground, no sky, just the Under going down forever.');
        await c.say(null, 'Nobody who went over came back. Nobody who went over sent a slip, either.');
      },
    },
  ],
  exits: [{ x: 16, y: 0, w: 2, to: 'lowmost', tx: 15, ty: 24, dir: 0 }],
  enter: async (c) => {
    c.tint(night(c) ? 'navy' : null);
    if (!c.flag('c1_shallows')) {
      c.set('c1_shallows');
      await c.say(null, 'The Shallows: where the Asking lands. The drifts here are fresh slips from last night, still whispering.');
      await c.say(null, 'Gale sorts them at her shed in the northwest.');
    }
  },
};

async function dusk(c: Ctx) {
  c.music(null);
  await c.fadeOut();
  c.set('c1_gather');
  c.tint('navy');
  c.place('hero', 9, 9);
  c.face('hero', 'u');
  await c.wait(20);
  await c.fadeIn();
  await c.say(null, 'Dusk comes to the Shallows. Half of Lowmost comes with it, nets in hand.');
  await c.say('fen', 'Is it now? Is it now?');
  await c.say('someday', 'Patience. It comes when it comes. It always comes.');
  await c.wait(60);
  await c.say(null, 'You wait. The sky stays the color of an unwritten page.');
  await c.say('gale', "It's late. It is never late.");
  await c.say('oldask', 'Nine thousand years it has fallen. Every night. I was here for most of them.');
  await c.wait(60);
  await c.say('fen', 'Hello... does your slip say anything tonight?');
  await c.say(null, 'You hold your slip to your ear. Someone, somewhere, is breathing. Then nothing.');
  await c.wait(40);
  await c.say(null, 'Nothing falls.');
  c.shake(40);
  await c.wait(30);
  await c.say(null, 'Something rumbles under the Shallows. Far off, toward the Old Shaft, something screams.');
  await c.say('someday', "That's the Shaft. Ferals. A lot of them.");
  await c.say('gale', 'The Granary!');
  c.set('c1_dusk');
  await c.goto('lowmost', 24, 20, 0);
}

// ---------------------------------------------------------------- old shaft
const s1 = new Grid(30, 22, '#');
s1.rect(1, 1, 6, 4, '.').path(6, 3, 14, 3, '.', 2).rect(13, 2, 6, 5, '.').path(16, 7, 16, 12, '.', 2).rect(10, 11, 10, 5, '.');
s1.path(10, 13, 3, 13, '.', 2).rect(2, 12, 4, 7, '.').path(19, 13, 26, 13, '.', 2).rect(23, 14, 5, 6, '.');
s1.scatter('%', 50, 31, '#', 0).scatter('r', 6, 32, '.').put(1, 1, '<').put(25, 18, '>').put(2, 18, 'x').scatter('~', 8, 33, '.');

const SHAFT_LEGEND = {
  '.': t.floor('tan', 'siltdk', 'speck'), '#': t.solid('rock', 'brown', 'dusk'), '%': t.solid('strata', 'plea', 'dusk'),
  '<': t.deco('stairs', 'siltdk', 'plea'), '>': t.deco('stairs', 'siltdk', 'plea'), r: t.deco('rail', 'siltdk', 'slate'), x: t.solid('crate', 'siltdk', 'brown'),
  '~': t.deco('drift', 'siltdk', 'plea'),
};

const SHAFT1: MapDef = {
  id: 'shaft1', name: 'The Old Shaft', chapter: 1, music: 'dungeon', dark: true, battleBg: ['ink', 'siltdk'], weather: 'drips', glow: { strata: 10 },
  rows: s1.rows(), legend: SHAFT_LEGEND,
  ferals: [{ x: 15, y: 4, group: 'shaft1' }, { x: 14, y: 13, group: 'shaft2' }, { x: 25, y: 16, group: 'shaft3' }, { x: 4, y: 15, group: 'shaft1' }, { x: 17, y: 9, group: 'mite3' }],
  digs: [
    { x: 17, y: 5, id: 's_dragon', slip: 'dragon' },
    { x: 11, y: 14, id: 's_soldier', slip: 'soldier' },
    { x: 26, y: 15, id: 's_loz', item: 'lozenge' },
    { x: 3, y: 12, id: 's_ants', slip: 'ants' },
  ],
  triggers: [
    {
      x: 2, y: 18, touch: true, once: 'c1_hook',
      run: async (c) => {
        await c.say(null, 'A long hook, half buried under a fall of old slips. Stamped into the shaft: RETURN TO SENDER.');
        await c.give('rtshook');
        await c.say('someday', "...That's a Lineman's hook. Collector's gear. I haven't seen one of those in a long, long time.");
        await c.say('hello', "What's a Lineman?");
        await c.say('someday', 'Trouble with a ladder. Come on.');
      },
    },
    {
      x: 15, y: 1, touch: true,
      run: async (c) => {
        await c.say(null, 'You put your ear to the strata. A thousand thin voices, pressed flat, all asking at once.');
        await c.say(null, 'One comes through clearer than the rest: "...let the harvest come in before the frost..." Then it sinks back into the others.');
      },
    },
  ],
  exits: [
    { x: 1, y: 1, to: 'lowmost', tx: 30, ty: 19, dir: 3 },
    { x: 25, y: 18, to: 'shaft2', tx: 3, ty: 2, dir: 2 },
  ],
  enter: async (c) => {
    if (!c.flag('c1_shaft')) {
      c.set('c1_shaft');
      await c.say('someday', 'Stay close. Down here the walls talk. Old slips, pressed thin as paper. Ten thousand years of asking.');
      await c.say('someday', 'Listen and you will hear them. You will hear where the soft spots are, too. Things get buried in soft spots.');
    }
  },
};

const s2 = new Grid(30, 24, '#');
s2.rect(2, 1, 5, 4, '.').path(4, 5, 4, 10, '.', 2).rect(2, 10, 9, 4, '.').path(10, 11, 18, 11, '.', 2).rect(17, 7, 6, 8, '.');
s2.path(20, 15, 20, 17, '.', 2).rect(8, 17, 18, 6, '.');
s2.scatter('%', 50, 41, '#', 0).put(2, 1, '<').scatter('~', 10, 42, '.');

const SHAFT2: MapDef = {
  id: 'shaft2', name: 'The Old Shaft, deep', chapter: 1, music: 'dungeon', dark: true, battleBg: ['ink', 'plum'], weather: 'motes', glow: { strata: 10 },
  rows: s2.rows(), legend: SHAFT_LEGEND,
  npcs: [
    { id: 'phone2', x: 21, y: 8, sprite: PHONE, talk: async (c) => {
      if (!c.flag('c1_phone2')) {
        c.set('c1_phone2');
        await c.say('hello', 'Who puts a payphone at the bottom of a mine?');
        await c.say('someday', "Somebody always does. Phones grow wherever somebody needed to call someone.");
      }
      await c.payphone();
    } },
    { id: 'want', x: 16, y: 20, sprite: WANT, scale: 3, show: (c) => !c.flag('c1_want') },
  ],
  ferals: [{ x: 5, y: 12, group: 'shaft4' }, { x: 19, y: 12, group: 'shaft5' }, { x: 4, y: 7, group: 'shaft3' }],
  digs: [
    { x: 9, y: 12, id: 's_whale', slip: 'whale' },
    { x: 22, y: 13, id: 's_card', item: 'card' },
    { x: 24, y: 21, id: 's_android', slip: 'android' },
    { x: 12, y: 21, id: 's_page1', page: 1 },
  ],
  triggers: [
    {
      x: 7, y: 10, touch: true,
      run: async (c) => {
        await c.say(null, 'The strata here are older. The slips are in no language you know, all hooks and circles.');
        await c.say(null, 'You Listen anyway. The words are strange but the shape is the same as every other prayer: please, please, please.');
      },
    },
    {
      x: 20, y: 17, w: 2, once: 'c1_wantev',
      run: async (c) => {
        c.music(null);
        await c.say(null, 'The tunnel opens into a chamber. The walls are chewed smooth. In the middle, something enormous is eating the floor.');
        await c.say('want', 'MORE.');
        await c.say('someday', "So that's what's been eating the vein. Look at the size of it.");
        await c.say(null, 'You Listen. Its slip is worn almost through: "I\'m so hungry. Please. Anything. Anything at all."');
        await c.say('hello', "It's just hungry.");
        await c.say('someday', "So's a fire. Hook up, sprout. And make some noise if it starts breathing in.");
        const r = await c.battle('want', { music: 'boss', scene: 'maw' });
        if (r !== 'win') return;
        await afterWant(c);
      },
    },
  ],
  exits: [{ x: 2, y: 1, to: 'shaft1', tx: 25, ty: 17, dir: 2 }],
};

async function afterWant(c: Ctx) {
  c.set('c1_want');
  c.show('want', false);
  await c.say(null, 'The Want shudders, coughs up a heap of half-eaten slips, and slides back down into the dark under the dark.');
  await c.say(null, 'On top of the heap is one slip that is not like the others. It is crisp and white and folded exactly in thirds.');
  await c.give('notice', 1, true);
  await c.say(null, 'THE ASKING IS SUSPENDED. ALL ANSWERS WILL BE RETURNED TO SENDER. THANK YOU FOR YOUR PATIENCE.');
  await c.say(null, 'It is signed with one word: AMEN.');
  await c.say('someday', '...Amen.');
  await c.say('hello', 'Who is Amen?');
  await c.say('someday', 'Nobody. A word at the end of things.');
  c.sfx('listen');
  c.set('slip', 1);
  await c.say(null, 'Your slip is warm. For the first time in six years it whispers, and a few letters come through:');
  await c.say(null, `"${c.slip()}"`);
  await c.say('hello', 'Someday. My slip. It said something.');
  await c.say('someday', 'Then somebody up there is still talking. Come on. If the Asking stopped on purpose, somebody knows why.');
  await c.goto('lowmost', 15, 18, 0);
}

export const CH1: MapDef[] = [HUT, LOWMOST, PRESS, SHALLOWS, SHAFT1, SHAFT2];
