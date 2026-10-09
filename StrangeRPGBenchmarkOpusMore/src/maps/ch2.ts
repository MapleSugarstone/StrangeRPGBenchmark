import { Grid } from './grid';
import { MapDef, t } from './types';
import { registerSpeaker } from '../game/speakers';
import type { Ctx } from '../game/ctx';
import { page } from './side';

const P = (tt: string, seed: string, a: string, b: string) => ({ t: tt, seed, a, b });
const BIGGER = P('dog', 'bigger', 'gold', 'red');
const THREE = P('slip', 'three', 'paper', 'red');
registerSpeaker('three', 'Number Three', THREE, 'red');
registerSpeaker('claim', 'Claim', P('person', 'claim', 'cream', 'teal'));
registerSpeaker('seventeen', 'Seventeen', P('person', 'seventeen', 'tan', 'olive'));
registerSpeaker('bride', 'The Bride', P('robed', 'bride', 'white', 'cream'));
registerSpeaker('cart', 'Pocket Change', P('robed', 'pocket', 'gold', 'teal'));

// ---------------------------------------------------------------- the Waiting Room
const W = 40, H = 44;
const g = new Grid(W, H, '.').frame(0, 0, W, H, '#').rect(1, 1, W - 2, 1, '#');
g.rect(15, 3, 10, 1, '=');
g.rect(1, 10, W - 2, 1, 'r').put(20, 10, '.');
const chairRows = (x: number, y: number, w: number, n: number, gaps: number[]) => {
  for (let i = 0; i < n; i++) {
    g.rect(x, y + i * 2, w, 1, 'h');
    for (const gx of gaps) g.put(gx, y + i * 2, '.');
  }
};
chairRows(2, 12, 15, 4, [9]);
chairRows(23, 12, 15, 4, [30]);
chairRows(2, 22, 15, 4, [9]);
chairRows(23, 22, 9, 4, [27]);
chairRows(2, 32, 15, 2, [9]);
chairRows(23, 32, 15, 2, [30]);
// Three's fort of stacked chairs in the northwest.
g.rect(2, 4, 7, 1, 'h').rect(2, 8, 7, 1, 'h').rect(8, 4, 1, 5, 'h').put(8, 6, '.');
chairRows(24, 5, 13, 2, [30]);
// Lost and Found booth on the east wall.
g.rect(35, 22, 1, 7, '=').put(35, 25, '.').rect(37, 21, 2, 9, 's').rect(36, 21, 1, 1, '#').rect(36, 29, 1, 1, '#');
// Reception desk and the snack cart corner.
g.rect(11, 37, 6, 1, '=').rect(11, 36, 1, 1, 'p').rect(16, 36, 1, 1, 'p');
g.put(1, 29, 'v').put(1, 30, 'v');
// The elevator that came with no building.
g.put(W - 1, 13, 'E');
// South entrance.
g.rect(19, H - 1, 2, 1, '+');
g.scatter('p', 6, 77, '.', 2).put(35, 25, '.').put(34, 25, '.');

const serving = (c: Ctx) => c.num('serving') || 3;

const WAITING: MapDef = {
  id: 'waiting', name: 'The Waiting Room', chapter: 2, music: 'hold', bg: 'ink', battleBg: ['lilac', 'violet'], weather: 'dust',
  rows: g.rows(),
  legend: {
    '.': t.floor('lilac', 'violet', 'check'), '#': t.wall('cream', 'rose'), '=': t.solid('counter', 'cream', 'rose'),
    h: t.solid('chair', 'violet', 'plum'), r: t.solid('fence', 'lilac', 'red'), s: t.solid('shelf', 'tan', 'plea'),
    p: t.solid('plant', 'lilac', 'moss'), v: t.solid('vent', 'slate', 'gold'), E: t.solid('door', 'grey', 'slate'), '+': t.deco('door', 'cream', 'rose'),
  },
  draw: (gx, cx, cy, c) => {
    const x = 15 * 8 - cx, y = 0 - cy;
    gx.rect(x, y, 80, 14, 'ink');
    gx.border(x, y, 80, 14, 'red');
    const n = serving(c);
    gx.textC(`NOW SERVING: ${n.toLocaleString('en-US')}`, x + 40, y + 3, Math.floor(gx.t / 30) % 2 ? 'red' : 'pink');
  },
  npcs: [
    { id: 'phone', x: 17, y: 40, sprite: P('object', 'payphone', 'slate', 'sky'), talk: (c) => c.payphone() },
    { id: 'phone2', x: 36, y: 7, sprite: P('object', 'payphone', 'slate', 'sky'), talk: (c) => c.payphone() },
    {
      id: 'recept', x: 13, y: 36, sprite: P('person', 'recept', 'cream', 'rose'), prayer: 'Please, someone help me.',
      talk: async (c) => {
        if (!c.flag('c2_recept')) { await receptionist(c); return; }
        if (!c.flag('c2_bigger')) {
          await c.say('receptionist', "Number Three went to the north rows a long, long time ago. Then the big dog came and lay down across the turnstile, and nobody has been past the rope since.");
          await c.say('receptionist', 'If you want a dog to move, dear, find out what he is waiting for. Everyone in this room is waiting for something.');
          return;
        }
        await c.say('receptionist', 'The line is moving! Four thousand years and it is moving! Oh, I may have to learn to do something else.');
      },
    },
    {
      id: 'claim', x: 36, y: 25, sprite: P('person', 'claim', 'cream', 'teal'), prayer: 'Please let someone come and claim something.',
      talk: async (c) => {
        await c.say('claim', 'Lost and Found! Everything here was lost by someone Above and prayed back by someone else. Nobody ever claims anything.');
        if (!c.flag('c2_ball')) {
          await c.say('claim', "There's a left glove, a key to no door, a ring engraved 'always', and a red ball, chewed. A dog the size of a barn has been howling for that one for a hundred years.");
          await c.say('claim', 'I could not give it to him. He would have eaten the counter. But you could.');
          c.set('c2_ball');
          await c.give('ball');
          await c.say('claim', 'Oh. Oh, that felt wonderful. Somebody claimed something. Come back anytime.');
          return;
        }
        if (c.q('rightback') === 3) { await ringScene(c); return; }
        if (!c.flag('c2_claim2')) {
          c.set('c2_claim2');
          await c.say('claim', 'Back to claim more? Here: a postcard addressed to nobody. Write on it. Send it to someone.');
          await c.give('postcard');
          return;
        }
        if (c.qdone('rightback')) { await c.say('claim', 'Two claims in one day. I am going to have to sit down. I have been sitting down for four hundred years, but differently.'); return; }
        await c.say('claim', 'The ring that says always is still here. Nobody has claimed always yet.');
      },
    },
    {
      id: 'cart', x: 2, y: 30, sprite: P('robed', 'pocket', 'gold', 'teal'), prayer: 'Please, a little pocket change.',
      talk: async (c) => {
        await c.say('cart', "Pocket Change. Mister Change's cousin. Twice removed, once pressed. Snacks for the line!");
        await c.shop(['soup', 'stew', 'lozenge', 'tonic', 'card', 'pinwheel', 'hello_w3', 'someday_w3', 'bigger_w2', 'coat3', 'scarf'], 'Snack Cart');
      },
    },
    {
      id: 'seventeen', x: 16, y: 21, sprite: P('person', 'seventeen', 'tan', 'olive'), prayer: 'Please, I just want to be next.',
      talk: async (c) => {
        if (serving(c) > 17) { await c.say('seventeen', 'Seventeen! They called seventeen! I have no idea what I was waiting for. I am going to go find out.'); return; }
        await c.say('seventeen', "I'm Seventeen. I have been next-but-fourteen for four thousand years. I'm very good at it now.");
      },
    },
    {
      id: 'bride', x: 22, y: 33, sprite: P('robed', 'bride', 'white', 'cream'), prayer: 'Please let him show up.',
      show: (c) => c.q('rightback') < 3,
      talk: async (c) => {
        if (c.q('rightback') === 2) { await reunion(c); return; }
        await c.say('bride', "He'll be here. The flowers are paper now, but they kept their shape. He'll be here.");
        if (!c.q('rightback')) {
          await c.say('bride', 'He went to fetch the cake. He said, "I will be right back." So I am waiting right here, where he left me. If I move, how will he find me?');
          await c.quest('rightback');
        }
      },
    },
    { id: 'couple', x: 32, y: 31, sprite: P('robed', 'bride', 'white', 'cream'), show: (c) => c.q('rightback') >= 3, talk: async (c) => { await c.say('bride', c.qdone('rightback') ? 'We are going to sit here a while. Not waiting. Just sitting. It is different.' : 'There was a ring. He says he lost it on the way back with the cake. The cake is long gone too. We do not mind about the cake.'); } },
    {
      id: 'patient', x: 6, y: 31, sprite: P('person', 'patient', 'ice', 'sky'), prayer: 'Please let the doctor see me soon.',
      talk: async (c) => { await c.say(null, '"I have a cough," says the man in the paper gown. "I have had it for nine hundred years. It is not getting worse. It is just very well established."'); },
    },
    {
      id: 'robot', x: 31, y: 15, sprite: P('robot', 'updater', 'slate', 'lime'), prayer: 'Please let the update finish.',
      talk: async (c) => {
        if (c.qdone('update')) { await c.say(null, 'The robot\'s chest reads READY. "Ready for what," it says, cheerfully. "I will know it when I see it."'); return; }
        await c.say(null, 'The robot\'s chest reads UPDATING 99%. It has read 99% for eleven centuries. "Almost there," it says, every time.');
        await c.quest('update');
        const r = await c.ask(null, 'Sit with it a while?', ['Sit down', 'Not now']);
        if (r !== 0) return;
        await c.say('someday', 'Sprout. I said never sit down in here.');
        await c.say('hello', 'Just for a minute.');
        await c.fadeOut();
        await c.wait(90);
        await c.say(null, 'You sit. The hold music plays. The robot hums along, a little flat. Nobody says anything for a long time.');
        await c.wait(60);
        await c.say(null, 'UPDATING 99%.');
        await c.wait(90);
        await c.say(null, 'UPDATING 99%. "It is nice," the robot says, "to have somebody to be almost there with."');
        await c.wait(90);
        c.sfx('ring');
        await c.say(null, 'UPDATE COMPLETE.');
        await c.fadeIn();
        await c.say(null, '"Oh," says the robot. "Oh. I do not remember what the update was for. It was very important to somebody." It opens a small hatch in its chest. "You should have the old memory. I will not be needing it."');
        await c.give('ramchip');
        await c.finish('update');
      },
    },
    {
      id: 'knit1', x: 4, y: 27, sprite: P('person', 'knit1', 'grey', 'rose'), prayer: 'Please let the time pass quickly.',
      talk: (c) => chairsGame(c),
    },
    { id: 'knit2', x: 5, y: 27, sprite: P('person', 'knit2', 'grey', 'teal'), prayer: 'Please let the time pass quickly.', talk: async (c) => { await c.say(null, '"We are on our third mile," she says. "Of scarf."'); } },
    {
      id: 'ghost', x: 33, y: 31, sprite: P('ghost', 'rightback', 'white', 'lilac'), prayer: "I'll be right back.",
      talk: async (c) => {
        if (c.q('rightback') >= 3) { await c.say(null, '"Right back," says the ghost, and this time it sounds like a joke they are both in on.'); return; }
        await c.say(null, 'A ghost in an apron. "Someone said they would be right back," it says. "So I am waiting right here. Right where back is."');
        if (c.q('rightback') !== 1) return;
        await c.say(null, 'There is frosting on the apron. Very old frosting.');
        await c.say('hello', 'Were you getting a cake?');
        await c.say(null, '"For a wedding," says the ghost. "I said I would be right back. I came back and the room was full of chairs, and she was gone, so I am waiting right where I said. Right here. Right back."');
        await c.say('hello', "She's in the south rows. In white. She's waiting where you left her.");
        await c.say(null, 'The ghost goes so still it nearly disappears. "If I go to her," it says, "then I was not right back. I was late. Four hundred years late."');
        await c.quest('rightback', 2);
      },
    },
    {
      id: 'kid', x: 21, y: 15, sprite: P('child', 'balloonkid', 'tan', 'red'), prayer: 'Please let the balloon be okay up there.', wander: true,
      talk: async (c) => {
        await c.say(null, '"I let go of my balloon," the kid says. "Up there, I mean. Above. I prayed it would be okay. And then I was here." The kid looks up. "Is it okay?"');
        if (!c.q('balloon')) await c.quest('balloon');
      },
    },
    {
      id: 'bigger', x: 20, y: 9, sprite: BIGGER, scale: 3, show: (c) => !c.flag('c2_bigger'),
    },
    {
      id: 'three', x: 5, y: 6, sprite: THREE, prayer: 'Please let my number come up.', show: (c) => !c.flag('c2_served'),
      talk: async (c) => {
        if (c.flag('c2_three')) { await c.say('three', 'I am right behind you. Mostly behind you. Go on.'); return; }
        await threeScene(c);
      },
    },
    { id: 'clerk', x: 20, y: 2, sprite: P('robed', 'clerk', 'grey', 'olive'), prayer: 'Please let my shift end.' },
  ],
  ferals: [
    { x: 9, y: 20, group: 'wr1' }, { x: 28, y: 20, group: 'wr2' }, { x: 12, y: 30, group: 'wr3' }, { x: 26, y: 30, group: 'wr4' },
    { x: 6, y: 39, group: 'wr5' }, { x: 34, y: 35, group: 'wr6' }, { x: 20, y: 27, group: 'wr7' }, { x: 30, y: 8, group: 'wr6' }, { x: 12, y: 6, group: 'wr5' },
  ],
  digs: [
    { x: 9, y: 25, id: 'w_twins', slip: 'twins' },
    { x: 30, y: 13, id: 'w_exam', slip: 'exam' },
    { x: 3, y: 39, id: 'w_dentist', slip: 'dentist' },
    { x: 37, y: 40, id: 'w_stew', item: 'stew' },
    { x: 24, y: 21, id: 'w_balloon', slip: 'balloon' },
    { x: 34, y: 28, id: 'w_tobiah', slip: 'tobiah' },
    { x: 26, y: 4, id: 'w_name', slip: 'name' },
    { x: 12, y: 9, id: 'w_weather', slip: 'weather' },
    { x: 18, y: 41, id: 'w_loz', item: 'lozenge', n: 2 },
  ],
  triggers: [
    {
      x: 20, y: 11, show: (c) => !c.flag('c2_bigger'),
      run: async (c) => {
        if (!c.has('ball')) {
          c.set('c2_sawbig');
          await c.say(null, 'A dog the size of a house is lying across the turnstile. Bigger than a house, maybe. He lifts his head and growls, and every chair in the room rattles.');
          await c.say(null, 'He sniffs the air in short sad bursts, like he is looking for something he dropped.');
          await c.say('someday', 'Back up, sprout. Slowly. Whatever he lost, we do not have it.');
          await c.walk('hero', 'd', 8);
          return;
        }
        await c.say(null, 'The big dog smells the ball before he sees it. He stands up. He keeps standing up.');
        await c.say('bigger', 'BALL.');
        await c.say('someday', "He's going to play rough. Wear him down a little, then throw it. Listen to him first. It helps to know what they want.");
        const r = await c.battle('bigger', { music: 'boss' });
        if (r !== 'win') return;
        await afterBigger(c);
      },
    },
    {
      x: 20, y: 3, touch: true,
      run: async (c) => {
        if (!c.flag('c2_three')) {
          await c.say(null, 'The window is shut. A grey clerk sleeps behind it with a stamp in one hand.');
          await c.say(null, 'A card in the window says: NOW SERVING 3. PLEASE HAVE YOUR NUMBER READY.');
          return;
        }
        await windowScene(c);
      },
    },
    {
      x: W - 2, y: 13, touch: true,
      run: async (c) => {
        await c.say(null, 'An elevator door. Somebody prayed "please let the elevator come," and it came, and it brought no building with it.');
        if (!c.flag('c2_bigger')) { await c.say(null, 'A small voice from inside: "Going up?" The doors do not open. They never have.'); return; }
        await c.say(null, 'A small voice from inside: "Going... down?" It sounds surprised. The doors open.');
        const r = await c.ask(null, 'Get in?', ['Get in', 'No']);
        if (r === 0) await c.goto('basement', 5, 8, 0);
      },
    },
    {
      x: 1, y: 29, w: 1, h: 2, touch: true,
      run: async (c) => { await c.say(null, 'A vending machine. Every slot holds the same thing: a small folded slip that says "please". Out of order.'); },
    },
  ],
  exits: [{ x: 19, y: H - 1, w: 2, to: 'lowmost', tx: 15, ty: 1, dir: 2 }],
  enter: async (c) => {
    if (!c.flag('c2_enter')) {
      c.set('c2_enter');
      c.s.chapter = 2;
      await c.wait(20);
      await c.say(null, 'The Waiting Room. It is a hall the size of a country, full of chairs, and the chairs are full of people.');
      await c.say(null, 'Hold music plays from everywhere at once. It has played for four thousand years. It is the same song.');
      await c.say('someday', 'Do not sit down. I sat down in here once and lost forty years. Never sit down.');
      await c.say('hello', 'Hello?');
      await c.say(null, 'Hundreds of heads turn toward you, hopeful. Then they turn back.');
      await c.say(null, 'Far to the north, above a shut window, a red sign: NOW SERVING 3. The reception desk is just ahead.');
    }
  },
};

async function receptionist(c: Ctx) {
  c.set('c2_recept');
  await c.say('receptionist', 'Welcome to the Waiting Room. Please take a number.');
  await c.give('ticket');
  await c.say('receptionist', 'You are number eight million, four hundred and twelve. We are currently serving three.');
  await c.say('hello', 'How long does that take?');
  await c.say('receptionist', 'Oh, I would not think of it in time, dear. Time is for people with appointments.');
  await c.say('receptionist', 'I grew from "please, someone help me." So I help. Mostly I help people wait.');
  await c.say('receptionist', 'But you look like the sort who will not wait. So let me teach you the other thing. The thing I do when waiting is not enough.');
  await c.say('receptionist', 'Everything that waits wants something. Ferals too. Especially ferals. They grew from somebody\'s please, same as you.');
  await c.say('receptionist', 'Give a thing what it asked for and it can stop. It leaves in peace, and it leaves you its prayer to keep.');
  c.set('mech_answer');
  c.sfx('answer');
  await c.say(null, 'Hello learned Answer. Every feral grew from a prayer. Use the Listen skill on one to hear its prayer, then decide what would answer it.');
  await c.say(null, 'Choose Answer and pick one. Each answer says what kind of prayer it fits. The right one sends the feral away in peace, and you keep its prayer.');
  await c.say(null, 'A wrong answer offends the feral, and it hits harder for a while. The right answer at the wrong time does no harm. The feral tells you what has to happen first.');
  await c.say('receptionist', 'This one has been circling my desk for a century. Try.');
  const r = await c.battle('wr0', { intro: 'A Ticket shuffles up to the desk, hopeful.' });
  if (r === 'win' && c.s.kept.includes('ticket')) {
    await c.say('receptionist', 'See? Now its prayer is yours to keep. Wear a kept prayer as a charm and it lends you a little of what it is.');
  } else {
    await c.say('receptionist', 'Well. That is the other way. It works too. It just does not leave you anything.');
  }
  await c.say('receptionist', 'Now. Number Three went north a long time ago and never came to the window. That is why the line has not moved.');
  await c.say('receptionist', 'Find Three, and you will find out why everyone is still waiting.');
}

async function reunion(c: Ctx) {
  await c.say('hello', "He's here. In the east rows, in an apron. He came back with the cake. You had moved, so he waited where he said he would.");
  await c.say('bride', '...He came back?');
  await c.say('hello', 'He is afraid you will think he was late.');
  await c.say('bride', 'Four hundred years late. Oh, he was always late. He was late to his own proposal.');
  await c.fadeOut();
  c.show('bride', false);
  await c.quest('rightback', 3);
  await c.wait(40);
  await c.fadeIn();
  await c.say(null, 'Later, in the east rows, a ghost in an apron and a bride with paper flowers are sitting side by side. Neither of them is waiting.');
}

async function ringScene(c: Ctx) {
  await c.say('hello', 'The ring that says always. Someone is claiming it.');
  await c.say('claim', 'Always? Somebody is claiming ALWAYS?');
  await c.say(null, 'Claim takes the ring down from the top shelf with both hands, the way you would hold a bird.');
  await c.say('claim', 'A ghost brought it in four hundred years ago. Said he found it on the floor on his way back with a cake. He did not know it was his.');
  await c.say(null, 'You take the ring to the east rows. The bride turns it over, reads it, and laughs until she has to hold the ghost\'s sleeve.');
  await c.say('bride', 'Always. We do not need it. We have it. Keep it, Hello. Somebody should wear it who is still going somewhere.');
  await c.give('always');
  await c.say('claim', 'And this was in the box under the ring. Nobody has claimed it either. It looks like it belongs to someone with a ladder.');
  await page(c, 3);
  await c.finish('rightback');
}

async function chairsGame(c: Ctx) {
  await c.say(null, 'Two old women share one scarf. It runs off down the row and out of sight. "It passes the time," says one. "It passes the time," says the other, a moment later.');
  if (!c.q('chairs')) {
    await c.say(null, '"We play musical chairs when the song comes round," says the first. "It always comes round." "Six of us," says the second, "and five chairs, and the song stops when it likes."');
    await c.say(null, '"Win and we will give you the end of the scarf," says the first. "The third mile," says the second.');
    await c.quest('chairs');
  }
  const r = await c.ask(null, 'Play musical chairs?', ['Play', 'Not now']);
  if (r !== 0) return;
  const res = await c.minigame('chairs');
  if (res.score > 0) await c.pleas(res.score * 8);
  if (res.score >= 6 && !c.qdone('chairs')) {
    await c.say(null, '"The last chair," says the first knitter. "Nobody gets the last chair," says the second. They cut the scarf, which takes some time, and wrap the end around your neck.');
    await c.give('longscarf');
    await c.finish('chairs');
    await c.say(null, '"This was tucked in the stitches," says the first, holding up a folded page. "Since the first mile," says the second.');
    await page(c, 4);
  } else if (res.score < 6) await c.say(null, '"Again?" says the first. "It passes the time," says the second.');
}

async function afterBigger(c: Ctx) {
  c.set('c2_bigger');
  c.take('ball');
  await c.say(null, 'Bigger brings the ball back. Bigger drops the ball at your feet. Bigger looks at you with his whole enormous face.');
  await c.say('bigger', 'BALL! GOOD. GOOD PERSON.');
  await c.say('hello', 'Hello.');
  await c.say('bigger', 'HELLO. NEW PERSON. YOU THROW AGAIN?');
  await c.say('someday', 'He grew from a boy wishing his dog was bigger. So nothing could hurt the boy. Look at him. He took it seriously.');
  await c.say('bigger', 'SMALL ONE SCARED. BEHIND ME. I WATCH SMALL ONE. I WATCH SMALL ONE A LONG TIME.');
  await c.join('bigger', Math.max(c.avgLevel(), 7));
  c.show('bigger', false);
  await c.say(null, 'Bigger grows every turn in battle. Big dogs hit harder and take hits better, and get a little slower.');
}

async function threeScene(c: Ctx) {
  await c.say('three', 'Is... is the dog gone? He has been sitting on me for a hundred years. Not on me. Near me. He was being nice. He was very big about it.');
  await c.say('hello', 'Are you Number Three?');
  await c.say('three', '...Yes.');
  await c.say('hello', 'Everyone is waiting for you.');
  await c.say('three', 'I know. That is why I am hiding.');
  await c.say('three', 'If I go to the window, they will read my file. They will tell me if my asker is still there. Right now, he might be. As long as I do not go, he might be.');
  const r = await c.ask('hello', '...', ['He might be.', "Waiting won't change it."]);
  if (r === 0) await c.say('three', '...He might be. That is what I keep telling myself. That is four thousand years of might.');
  else await c.say('three', '...No. It will not, will it.');
  await c.say('three', 'Will you come with me? I do not want to hear it alone.');
  c.set('c2_three');
  await c.say(null, 'Number Three falls in behind you. The window is straight north.');
}

async function windowScene(c: Ctx) {
  c.set('c2_served');
  c.music(null);
  await c.say(null, 'You knock on the window. The clerk wakes up all at once, like a dropped tray.');
  await c.say('clerk', '...Number Three? NUMBER THREE? After four thousand years? Hold on. Hold on, I have to find the stamp.');
  await c.say('clerk', 'Three. Asked for by: a man on a list for a new heart. "Please let my number come up."');
  await c.say('clerk', 'Asker status... resolved elsewhere. His number came up the ordinary way. Three days after he asked.');
  await c.say('three', 'He... got it? Without me?');
  await c.say('clerk', 'Looks like. Lived another thirty years. Asked for a lot of other things after. Mostly about his grandkids.');
  await c.say('three', 'Then I was not needed.');
  await c.wait(40);
  await c.say('three', '...Good. Oh, that is good. That is the best thing I have ever heard.');
  await c.say('three', 'I think I will stay. Somebody should tell the people in the chairs it is all right to stop waiting.');
  await c.say('clerk', 'Now serving... four.');
  c.music('hold');
  for (const n of [4, 5, 6, 7, 9, 12, 17, 30, 81, 400, 2200, 31000, 400000, 2600000, 8000000]) {
    c.set('serving', n);
    c.sfx('blip');
    await c.wait(n < 20 ? 18 : 10);
  }
  await c.say(null, 'The line moves for the first time in four thousand years. The whole room stands up. Somebody starts clapping and cannot stop.');
  c.set('serving', 8000412);
  c.sfx('ring');
  await c.say('clerk', 'And since you got Three out of the corner, I am putting you through special. Number eight million, four hundred and twelve!');
  c.take('ticket');
  await c.say('clerk', 'That dog has a file too, you know. Want me to look it up? People usually want to know.');
  const r = await c.ask('hello', 'Look up Bigger\'s file?', ['Look it up', "Don't"]);
  if (r === 0) {
    await c.say('clerk', 'Bigger. Asked for by: Tobiah, of Ennet, aged seven. "I wish my dog was bigger, so he can protect me." Asker status: deceased. Three hundred years.');
    await c.say('bigger', 'BOY?');
    const r2 = await c.ask('hello', '...', ['Tell him the truth', 'Tell him "Someday."']);
    if (r2 === 0) {
      c.set('c2_told', 1);
      await c.say('hello', 'Your boy is gone, Bigger. A long time ago.');
      await c.wait(60);
      await c.say('bigger', '...BOY SAFE?');
      await c.say('hello', 'He was safe. Nothing ever got him. You made sure.');
      await c.say('bigger', 'GOOD. GOOD.');
      await c.say(null, 'Bigger lies down for a while, and nobody asks him to get up.');
      await c.say('someday', 'That was kind. Hard kind. The right kind.');
    } else {
      c.set('c2_told', 0);
      await c.say('hello', 'Someday, Bigger.');
      await c.say('bigger', 'SOMEDAY! SOMEDAY IS HERE!');
      await c.say(null, 'Bigger licks Someday from her boots to her hat.');
      await c.say('someday', '...Fine. Fine. I am Someday. He can have that.');
    }
  } else {
    await c.say('clerk', 'Suit yourself. Most people do.');
    await c.say('bigger', 'BALL?');
  }
  await c.say('clerk', 'Window is open. The Docket is through there. Mind the cables. They bite.');
  await c.say('someday', 'That is where they file the Returns, sprout. Every name they read in Lowmost started on a desk in there.');
  await c.say('hello', "I'm done waiting for whoever asked for me. If they want me, they can come and find me.");
  c.set('slip', Math.max(c.num('slip'), 2));
  await c.fadeOut();
  await c.card(3);
  await c.goto('docket', 3, 26, 1);
}

// ---------------------------------------------------------------- the basement under the elevator
const bs = new Grid(12, 10, '.').frame(0, 0, 12, 10, '#').rect(1, 1, 10, 1, 's').put(5, 9, '+').rect(8, 4, 2, 1, '=');

const BASEMENT: MapDef = {
  id: 'basement', name: 'Overstock', chapter: 2, music: 'secret', bg: 'ink', mode: () => 'eerie',
  rows: bs.rows(),
  legend: { '.': t.floor('grey', 'slate', 'check'), '#': t.wall('grey', 'slate'), s: t.solid('shelf', 'grey', 'plea'), '=': t.solid('counter', 'grey', 'slate'), '+': t.deco('door', 'grey', 'slate') },
  light: () => ({ ambient: 0.4, lights: [[8, 3, 34], [2, 5, 20]] }),
  npcs: [
    {
      id: 'overstock', x: 8, y: 3, sprite: P('robed', 'overstock', 'grey', 'gold'), prayer: 'Please let there be enough. Let there be more than enough. Let there be extra.',
      talk: async (c) => {
        await c.say(null, 'A shopkeeper in a grey smock, surrounded by boxes stacked to the ceiling. "Overstock," it says. "Everything anyone ever asked for too much of ends up down here."');
        await c.say(null, '"It is very good. It is very expensive. I do not get many customers. I do not want many. I would run out of shelf."');
        await c.shop(['coat4', 'thermos', 'luckypleat', 'notebook', 'whistle', 'bouquet', 'honey'], 'Overstock');
      },
    },
    {
      id: 'ringer', x: 2, y: 5, sprite: P('object', 'payphone', 'slate', 'grey'),
      talk: async (c) => {
        await c.say(null, 'An old payphone, ringing. It has been ringing since before you came in. You pick up.');
        await c.say(null, 'A flat voice, very far away: "Lineman Zero Four One One. Report to the Line. You are four hundred years late. Thank you for your patience."');
        await c.say(null, 'Click.');
        if (c.s.roster.someday) await c.say('someday', '...Hang it up, sprout. Wrong number.');
      },
    },
  ],
  exits: [{ x: 5, y: 9, to: 'waiting', tx: W - 2, ty: 13, dir: 3 }],
  enter: async (c) => {
    if (c.flag('c2_basement')) return;
    c.set('c2_basement');
    await c.say(null, 'The elevator goes down for longer than seems possible. The doors open on a low room full of boxes. A phone is ringing.');
  },
};

export const CH2: MapDef[] = [WAITING, BASEMENT];
