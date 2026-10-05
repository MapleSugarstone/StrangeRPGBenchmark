import { Grid } from './grid';
import { MapDef, t } from './types';
import { registerSpeaker } from '../game/speakers';
import type { Ctx } from '../game/ctx';
import { page } from './side';

const P = (tt: string, seed: string, a: string, b: string) => ({ t: tt, seed, a, b });
const SOMEONE = P('person', 'someone7', 'lilac', 'plum');
const HOUSE = P('machine', 'house', 'gold', 'red');
registerSpeaker('announcer', 'The Announcer', P('person', 'announcer', 'gold', 'red'), 'gold');
registerSpeaker('broker', 'The Loss Broker', P('robed', 'broker', 'grey', 'plum'), 'lilac');
registerSpeaker('house', 'The House', HOUSE, 'gold');
registerSpeaker('greeter', 'Greeter', P('person', 'greeter', 'gold', 'pink'), 'gold');

const LEGEND = {
  ',': t.floor('gold', 'red', 'check'), '.': t.floor('plea', 'gold', 'sand'), '#': t.wall('gold', 'red'), '^': t.solid('roof', 'red', 'plum'),
  w: t.solid('window', 'pink', 'gold'), d: t.solid('door', 'plum', 'gold'), '+': t.deco('door', 'plum', 'gold'), F: t.water('gold', 'cream'),
  $: t.solid('machine', 'red', 'gold'), p: t.solid('plant', 'gold', 'green'), h: t.solid('chair', 'red', 'plum'), o: t.floor('cream', 'red', 'check'),
  E: t.deco('sand', 'plea', 'gold'),
};

// ---------------------------------------------------------------- Jackpot
const j = new Grid(40, 36, ',').frame(0, 0, 40, 36, '#');
j.house(13, 2, 14, 7, 19, { roof: '^', wall: '#' }).put(20, 8, '+');
j.house(2, 11, 9, 7, 6, { doorCh: 'd' });
j.house(29, 11, 9, 7, 33, { doorCh: 'd' });
j.house(2, 22, 7, 6, 5, { doorCh: 'd' }).house(31, 22, 7, 6, 34, { doorCh: 'd' });
j.rect(18, 14, 4, 4, 'F').rect(16, 12, 8, 1, '.').rect(16, 19, 8, 1, '.');
j.rect(11, 21, 7, 1, '$').rect(22, 21, 7, 1, '$');
j.rect(19, 35, 2, 1, '.').rect(39, 18, 1, 2, 'E');
j.scatter('p', 10, 501);

const JACKPOT: MapDef = {
  id: 'jackpot', name: 'Jackpot', chapter: 5, music: 'jackpot', bg: 'ink', battleBg: ['plum', 'red'], mode: () => 'night', glow: { window: 18, machine: 16 }, weather: 'glints',
  rows: j.rows(), legend: LEGEND,
  npcs: [
    { id: 'phone', x: 24, y: 25, sprite: P('object', 'payphone', 'slate', 'sky'), talk: (c) => c.payphone() },
    {
      id: 'giftshop', x: 25, y: 31, sprite: P('robed', 'giftshop', 'pink', 'gold'), prayer: 'Please let somebody buy something.',
      talk: async (c) => {
        await c.say(null, '"Gift shop!" says a cheerful person in a sequined robe. "We take pleas! Nobody else in Jackpot does. Everyone already won everything, so nobody buys anything. Please buy something."');
        await c.shop(['coat5', 'bigger_w4', 'anyone_w4', 'again_w3', 'again_w4', 'someone_w3', 'feast', 'honey', 'picnic', 'bouquet'], 'Gift Shop');
      },
    },
    {
      id: 'greeter', x: 18, y: 32, sprite: P('person', 'greeter', 'gold', 'pink'), prayer: 'Let everyone be a winner.',
      talk: async (c) => {
        await c.say('greeter', 'Welcome to Jackpot, where everyone is a winner! Everyone! Every single one!');
        await c.say('greeter', 'Pleas? Oh, honey. Everyone here won so many pleas we line the birdcages with them. Here, the only thing worth anything is a loss.');
      },
    },
    {
      id: 'millionaire', x: 9, y: 19, sprite: P('person', 'mill', 'gold', 'navy'), prayer: 'Let me win the lottery.',
      talk: async (c) => { await c.say(null, '"I won the lottery," says a man in a gold suit. "Then I won it again. I won it so many times they made me the lottery. Now I just win myself. Over and over. It is very lonely, being a prize."'); },
    },
    {
      id: 'bees', x: 26, y: 29, sprite: P('child', 'beekid', 'tan', 'gold'), prayer: 'Please let me win the spelling bee.',
      talk: async (c) => {
        if (c.qdone('bees')) { await c.say(null, '"I lost!" the kid says. "To a bee! She spelled ANTIDISESTABLISHMENTARIANISM and I said it had two Ts in the middle! It was the best day of my life!"'); return; }
        await c.say(null, '"I wished to win the spelling bee," the kid says. "Now I win every bee. There are bees everywhere. Please. Help. B-E-E-S."');
        if (!c.q('bees')) {
          await c.say(null, '"The queen lives in the alley past the gift shop. She wants somebody to beat her. Or she wants to beat somebody. I cannot tell. She only talks in letters."');
          await c.quest('bees');
        }
      },
    },
    {
      id: 'hive', x: 36, y: 33, sprite: P('object', 'hive', 'gold', 'brown'), show: (c) => c.q('bees') >= 1 && !c.qdone('bees'),
      talk: async (c) => {
        await c.say(null, 'A hive the size of a phone booth, humming in the alley. Every bee in it is spelling something different, out loud, letter by letter.');
        const r = await c.ask(null, 'Knock on the hive?', ['Knock', 'Leave it']);
        if (r !== 0) return;
        await c.say(null, 'The humming stops. Something with a crown climbs out of the top of the hive and looks down at you.');
        await c.say(null, '"S-P-E-L-L," it says. "Y-O-U-R. N-A-M-E."');
        await c.say('hello', 'H-E-L-L-O.');
        await c.say(null, '"C-O-R-R-E-C-T," says the Queen Bee, and attacks.');
        const res = await c.battle('queenbee', { music: 'boss' });
        if (res !== 'win') return;
        await c.say(null, 'The Queen settles on the top of the hive and folds her wings. "W-E-L-L. D-O-N-E," she says, which she has never said to anyone.');
        await c.say(null, 'She takes a gold star off her own crown and drops it into your hand.');
        await c.give('goldstar');
        await c.finish('bees');
      },
    },
    {
      id: 'nearly', x: 14, y: 27, sprite: P('person', 'nearly', 'cream', 'violet'), prayer: 'Let me lose, just once, so I know what it is.',
      talk: (c) => nearlyCards(c),
    },
    {
      id: 'someone_st', x: 22, y: 10, sprite: SOMEONE, show: (c) => !c.flag('c5_someone'), prayer: 'I wish I were someone else.',
      talk: async (c) => { await c.say(null, 'A street performer whose face changes every time you blink. A dog, a queen, a clerk, you. "Not now, darling," it says in your voice. "Go register. I will find you."'); },
    },
  ],
  ferals: [{ x: 6, y: 31, group: 'jp1' }, { x: 33, y: 31, group: 'jp2' }, { x: 12, y: 33, group: 'jp3' }, { x: 27, y: 33, group: 'jp4' }, { x: 36, y: 21, group: 'jp5' }, { x: 3, y: 20, group: 'jp1' }],
  digs: [
    { x: 37, y: 33, id: 'j_lottery', slip: 'lottery' },
    { x: 2, y: 33, id: 'j_mirror', slip: 'mirror' },
    { x: 24, y: 13, id: 'j_bouquet', item: 'bouquet' },
    { x: 11, y: 9, id: 'j_puppet', slip: 'puppet' },
  ],
  triggers: [
    {
      x: 6, y: 17, touch: true,
      run: async (c) => {
        await c.say(null, 'The Hotel Grand Prize. Everyone in Jackpot won a free stay, so it is always full and always free.');
        c.heal();
        c.sfx('heal');
        await c.say(null, 'The party rests in a gold room with nine beds and a fountain in the bathtub. Everyone feels better.');
      },
    },
    { x: 33, y: 17, touch: true, run: (c) => broker(c) },
    ...[11, 12, 13, 14, 15, 16, 17, 22, 23, 24, 25, 26, 27, 28].map((x) => ({ x, y: 21, touch: true, run: (c: Ctx) => slots(c) })),
    {
      x: 19, y: 8, w: 2,
      run: async (c) => { await c.goto('arena', 12, 19, 0); },
    },
  ],
  exits: [
    { x: 19, y: 35, w: 2, to: 'encore', tx: 16, ty: 1, dir: 2, blocked: async (c) => { await c.say(null, 'The road back to Encore. Nothing back there needs you now.'); await c.walk('hero', 'u', 6); } },
    {
      x: 39, y: 18, h: 2, to: 'wood_edge', tx: 2, ty: 14, dir: 1,
      blocked: async (c) => {
        if (!c.has('linepass')) {
          await c.say(null, 'The east road runs toward the Unspoken Wood and the Line. A sign: AUTHORIZED PERSONNEL ONLY. LINE PASS REQUIRED.');
          await c.walk('hero', 'l', 6);
          return;
        }
        await c.fadeOut();
        await c.card(6);
        await c.goto('wood_edge', 2, 14, 1);
      },
    },
  ],
  enter: async (c) => {
    if (c.flag('c5_enter')) return;
    c.set('c5_enter');
    c.s.chapter = 5;
    await c.wait(20);
    await c.say(null, 'Jackpot. The streets are paved with winning tickets. Every window flashes. Every fountain is full of coins nobody bends down to pick up.');
    await c.say('someday', 'Worst town in the Silt. Everyone here grew from somebody wishing to win. So they all did. Now none of it is worth anything.');
    await c.say('anyone', 'The Line Pass is the grand prize of their Losing Games. The arena is north.');
  },
};

const CARD = ['', '', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king', 'ace'];

async function nearlyCards(c: Ctx) {
  if (c.qdone('nearly')) { await c.say(null, '"I lost," Nearly tells everyone who passes. "I lost a hand of cards to a stranger. You would not understand." Nobody does. She is radiant.'); return; }
  await c.say(null, '"I nearly lost once," says a woman, and everyone around her goes quiet with respect. "A card game. I was down to my last chip. And then I won. Of course I won."');
  await c.say(null, '"But for one second. One second, I thought I might lose. I think about that second every day."');
  if (!c.q('nearly')) {
    await c.say(null, 'She looks at you more closely. "You are not from here. Things do not go your way. I can tell. It is all over you."');
    await c.say(null, '"Play me. High or low. Guess the next card right and I lose. Nobody in Jackpot can lose to me. You might."');
    await c.quest('nearly');
  }
  const r = await c.ask(null, 'Play a hand?', ['Deal', 'Not now']);
  if (r !== 0) return;
  for (let hand = 0; hand < 3; hand++) {
    const a = 2 + Math.floor(Math.random() * 13);
    let b = 2 + Math.floor(Math.random() * 13);
    if (b === a) b = a === 14 ? 13 : a + 1;
    c.sfx('blip');
    const g = await c.ask(null, `She turns over the ${CARD[a]}. Will the next card be higher or lower?`, ['Higher', 'Lower']);
    c.sfx('blip');
    await c.say(null, `The next card is the ${CARD[b]}.`);
    if ((g === 0) === (b > a)) { await nearlyLoses(c); return; }
    await c.say(null, hand < 2 ? '"I win," she says, without much joy. "Again?" She deals again before you answer.' : '"I win. Of course I win," she says. "Come back. Please come back."');
  }
}

async function nearlyLoses(c: Ctx) {
  await c.say(null, 'Nearly looks at the two cards for a long time.');
  await c.say(null, '"I lost," she says. Then louder, to the street: "I LOST."');
  await c.say(null, 'The whole street stops. Someone drops a drink. A man in a gold suit takes his hat off.');
  await c.say(null, '"So that is what it is," she says. "It is lighter than I thought. You put it down and you can pick something else up."');
  await c.say(null, '"Here. I won this coin a thousand times. Once, somewhere, it must have come up tails for somebody. Keep it. And this. I won it in a raffle. I did not want it. I never want anything I win."');
  await c.give('losingcoin');
  await page(c, 9);
  await c.finish('nearly');
}

async function exhibition(c: Ctx) {
  const n = c.num('c5_ex');
  if (!c.q('exhibition')) {
    await c.say('announcer', 'The champions return! After hours we run exhibition bouts for the real fans. Higher stakes. Bigger purses. Nobody ever loses, so we need you.');
    await c.quest('exhibition');
  }
  const groups = ['ex1', 'ex2', 'ex3'];
  const r = await c.ask('announcer', `Exhibition bout ${n + 1}! Stakes: all in. Purse: ${120 + n * 30} pleas.`, ['Fight', 'Not tonight']);
  if (r !== 0) return;
  c.heal();
  const res = await c.battle(groups[n % 3], { stakes: 2, noFlee: true, intro: 'The exhibition card takes the ring!' });
  if (res !== 'win') return;
  c.inc('c5_ex');
  await c.pleas(120 + n * 30);
  if (c.num('c5_ex') >= 3 && !c.qdone('exhibition')) {
    await c.say('announcer', 'Three exhibitions! The fans have lost their voices! Which means they lost something! Here, a winner\'s bouquet. Two. Do not tell anyone.');
    await c.give('bouquet', 2);
    await c.finish('exhibition');
  }
}

async function slots(c: Ctx) {
  const r = await c.ask(null, 'A slot machine. Pull the lever for 5 pleas?', ['Pull', 'Leave it']);
  if (r !== 0) return;
  if (c.s.pleas < 5) { await c.say(null, 'You do not have 5 pleas.'); return; }
  c.s.pleas -= 5;
  c.sfx('ring');
  const roll = Math.random();
  if (roll < 0.45 && c.num('c5_slotloss') < 3) {
    c.inc('c5_slotloss');
    await c.give('loss', 1, true);
    await c.say(null, 'Cherry, lemon, nothing. You LOST. The whole street gasps. Someone presses a Loss token into your hand with tears in their eyes.');
  } else if (roll < 0.8) {
    c.s.pleas += 8;
    await c.say(null, 'Three bells. You win 8 pleas. A passerby pats your shoulder. "Oh, no. I am so sorry. It will get better."');
  } else {
    await c.say(null, 'The machine eats the pleas and plays a little tune about it.');
  }
}

async function broker(c: Ctx) {
  await c.say('broker', 'The Loss Broker. I buy losses. Real ones. Here everyone has won everything, and nobody has ever lost a thing in their lives. Do you know what that does to a person?');
  for (;;) {
    const opts: { label: string; key: string; ok: boolean; run: () => Promise<void> }[] = [
      { label: 'Fen', key: 'l_fen', ok: c.has('manifest'), run: async () => {
        await c.say('hello', 'They took a boy from our town. He said no. They took him anyway. I stood there.');
        await c.say('broker', 'Taken in the street while you watched. Oh, that is a real one. That is worth something.');
      } },
      { label: "Bigger's boy", key: 'l_boy', ok: c.num('c2_told') === 1 && !!c.s.roster.bigger, run: async () => {
        await c.say('bigger', 'BOY GONE. LONG TIME. BOY SAFE, BUT GONE.');
        await c.say('broker', '...Give the dog two. No. Give the dog one, and a biscuit. I am not made of stone.');
      } },
      { label: 'The chorus', key: 'l_chorus', ok: !!c.s.roster.anyone, run: async () => {
        await c.say('anyone', 'I lost four thousand voices that sang in my head every moment I was alive. It is very quiet now.');
        await c.say('broker', 'Quiet. Yes. That is the most expensive thing there is.');
      } },
      { label: 'A hundred thousand todays', key: 'l_todays', ok: !!c.s.roster.again, run: async () => {
        await c.say('again', 'I had the best day ever a hundred thousand times. Then I let it go.');
        await c.say('broker', 'You lost the best day ever by choice. Child, that is the rarest kind there is.');
      } },
      { label: 'The Asking', key: 'l_asking', ok: true, run: async () => {
        await c.say('someday', 'Every night for nine thousand years the sky asked for something. Then one night it stopped.');
        await c.say('broker', 'Everyone lost that one. Still. It counts.');
      } },
    ].filter((o) => o.ok && !c.flag(o.key));
    const choices = [...opts.map((o) => `Tell: ${o.label}`), 'Spend losses', 'Leave'];
    const r = await c.ask('broker', opts.length ? 'Tell me about something you lost.' : 'You are all out of losses to tell. Spend some?', choices);
    if (r < opts.length) {
      await opts[r].run();
      c.set(opts[r].key);
      await c.give('loss', 1, true);
      await c.say(null, 'You got a Loss token.');
      continue;
    }
    if (r === opts.length) {
      await c.shop(['goldtooth', 'unluckypenny', 'brokenmirror', 'fourleaf', 'bouquet', 'someone_w3'], 'The Loss Broker', { goldtooth: 2, unluckypenny: 2, brokenmirror: 2, fourleaf: 1, bouquet: 1, someone_w3: 1 });
      continue;
    }
    return;
  }
}

// ---------------------------------------------------------------- the arena
const a = new Grid(26, 22, 'o').frame(0, 0, 26, 22, '#');
for (let y = 2; y <= 18; y += 2) { a.rect(1, y, 4, 1, 'h'); a.rect(21, y, 4, 1, 'h'); }
a.rect(6, 1, 14, 1, 'h').rect(9, 2, 8, 2, '#').rect(11, 20, 4, 1, 'o').rect(12, 21, 2, 1, '+');

const ARENA: MapDef = {
  id: 'arena', name: 'The Losing Games', chapter: 5, music: 'jackpot', bg: 'ink', battleBg: ['red', 'plum'], weather: 'confetti',
  rows: a.rows(), legend: LEGEND,
  npcs: [
    { id: 'house', x: 12, y: 5, sprite: HOUSE, scale: 4, show: (c) => !c.flag('c5_house') },
    { id: 'announcer', x: 8, y: 6, sprite: P('person', 'announcer', 'gold', 'red'), prayer: 'Let them watch. Let everyone be watching.', talk: (c) => announcer(c) },
    { id: 'someone_a', x: 16, y: 12, sprite: SOMEONE, show: (c) => c.flag('c5_reg') && !c.flag('c5_someone') },
    { id: 'crowd1', x: 2, y: 9, sprite: P('person', 'crowd1', 'gold', 'navy'), talk: async (c) => { await c.say(null, '"Lose! LOSE! Oh, they are going to win again. Boo. Boo, winners."'); } },
    { id: 'crowd2', x: 23, y: 13, sprite: P('person', 'crowd2', 'pink', 'gold'), talk: async (c) => { await c.say(null, '"I come every night hoping someone loses. Nobody ever does. It is still the best show in town."'); } },
  ],
  exits: [{ x: 12, y: 21, w: 2, to: 'jackpot', tx: 19, ty: 9, dir: 2 }],
  enter: async (c) => {
    if (c.flag('c5_arena')) return;
    c.set('c5_arena');
    await c.say(null, 'The Losing Games. Gold stands, red sand, and a crowd that has never once seen anyone lose.');
    await c.say(null, 'Above the ring, on a dais, sits a machine the size of a house, all lights and levers. Its sign says THE HOUSE.');
  },
};

async function announcer(c: Ctx) {
  if (!c.flag('c5_reg')) {
    await c.say('announcer', 'Welcome to the Losing Games! Three bouts! The champion takes home the grand prize: a genuine Line Pass!');
    await c.say('announcer', 'Teams must have a sponsor. Do you have a sponsor? Nobody ever has a sponsor. It is a very exclusive tournament.');
    c.set('c5_reg');
    c.show('someone_a', true);
    await c.say(null, 'Someone steps out of the crowd. For a second they look exactly like Someday, then exactly like Bigger, then like nobody at all.');
    await c.say('someone', "I'll sponsor them. Hi. I'm someone. Or I could be. Who would you like?");
    await c.say('anyone', 'Anyone is taken.');
    await c.say('someone', 'Is it? Then I will be Someone Else. I usually am.');
    await c.say('someone', 'I grew from "I wish I were someone else." No face of my own. I wear other people\'s. It is the closest I get to being anybody.');
    await c.say('someone', 'Give me a kept prayer and I will wear its face, and I can do what it did. Very handy in a fight. And I know this tournament. For a cut of the winnings.');
    await c.say('someday', 'What cut? The prize is one pass.');
    await c.say('someone', 'Then I will come along wherever the pass goes. That is my cut.');
    c.set('c5_someone');
    c.show('someone_a', false);
    await c.join('someone', Math.max(c.avgLevel(), 16));
    c.set('mech_mask');
    await c.say(null, 'Someone Else can change Face in battle to wear any kept prayer and use its move. The more prayers you keep, the more faces they have.');
    await c.say('announcer', 'A sponsor! Wonderful! Now. In the Losing Games every bout has stakes. Higher stakes, tougher fights, bigger rewards.');
    c.set('mech_stakes');
    await c.say(null, 'Stakes are unlocked. Raise them in the Options menu any time: foes get tougher, and rewards double or triple.');
    await c.say('announcer', 'Come back when you are ready for bout one!');
    return;
  }
  const bout = c.num('c5_bout');
  if (bout >= 3) { await c.say('announcer', 'The champions! Somebody nearly lost! What a night!'); await exhibition(c); return; }
  const names = ['Bout one: the Lucky Seven! Stakes: double!', 'Bout two: the House Staff! Stakes: double, again!', 'The final! Against THE HOUSE! The house always wins!'];
  const r = await c.ask('announcer', names[bout], ['Fight', 'Not yet']);
  if (r !== 0) return;
  c.heal();
  if (bout === 2) { await houseFight(c); return; }
  const res = await c.battle(bout === 0 ? 'bout1' : 'bout2', { stakes: 1, noFlee: true, intro: bout === 0 ? 'The Lucky Seven take the ring!' : 'The House Staff take the ring!' });
  if (res !== 'win') return;
  c.inc('c5_bout');
  await c.give('loss', 2, true);
  await c.say(null, 'The crowd throws Loss tokens into the ring, in pity, because you looked like you were struggling. You got 2 Losses.');
  if (bout === 0) await nightCall(c);
}

async function nightCall(c: Ctx) {
  await c.fadeOut();
  c.music('tense');
  await c.say(null, 'Later that night, while everyone sleeps at the Hotel Grand Prize, a payphone across town rings once and is picked up.');
  await c.say('someone', 'Yes. It is me. ...Yes. Three, and a dog, and a Saint, and now a child.');
  await c.say('someone', 'They are going for the Line. I will bring them right to it. ...No. They do not suspect.');
  await c.say('amen', 'Thank you for your patience.');
  await c.say('someone', 'And then you will Return me. To my asker. As someone. You promised.');
  await c.say('amen', 'So be it.');
  await c.say(null, 'The phone is put down very gently, like something that might break.');
  await c.fadeIn();
  c.music('jackpot');
}

async function houseFight(c: Ctx) {
  c.music(null);
  await c.say('house', 'WELCOME, PLAYERS. THE HOUSE ALWAYS WINS.');
  await c.say('house', 'THE HOUSE HAS BEEN WATCHING YOU PLAY. THE HOUSE KNOWS WHAT YOU DO WHEN YOU ARE SCARED.');
  await c.say('someone', 'It reads your habits. Whatever you do most, it gets ready for. Mix it up.');
  const r = await c.battle('house', { music: 'boss', noFlee: true, scene: 'house' });
  if (r !== 'win') return;
  c.set('c5_house');
  c.inc('c5_bout');
  await c.say(null, 'The House goes dark one light at a time, like a city going to sleep.');
  await c.say('announcer', 'THEY WON! Against the HOUSE! Nobody wins against the House! ...Wait. Then the House LOST. Somebody LOST! Somebody finally LOST!');
  await c.say(null, 'The crowd goes wild. They are not cheering for you. They are cheering for the House, the first loser in the history of Jackpot.');
  await c.say('house', '...THE HOUSE PAYS OUT. BUT THE HOUSE TAKES ITS CUT. ALWAYS.');
  await c.say('house', 'WAGER SOMETHING YOU CANNOT AFFORD TO LOSE.');
  await c.wait(40);
  await c.say(null, 'Before anyone can argue, Someday steps forward and puts something small on the ring floor. A tin badge.');
  await c.say('house', 'LINEMAN ZERO FOUR ONE ONE. COLLECTOR. ACTIVE FOUR HUNDRED YEARS AGO. FOUR HUNDRED AND TWELVE DELIVERIES.');
  await c.say('hello', '...Someday?');
  c.music('sad');
  await c.say('someday', 'I was a Lineman, sprout. Before Amen. Back when the Docket still tried to send things up the old way.');
  await c.say('someday', 'They gave us lists. We collected. I collected four hundred and twelve people, and walked them up the Line, and handed them through.');
  await c.say('someday', 'I never read the asker status line. Nobody told us to. Then one day I did.');
  await c.say('someday', '"Deceased." "Deceased." "World not found." Four hundred and twelve, and I could not tell you one who arrived anywhere.');
  await c.say('someday', 'So I put down my hook and I walked until I got to the edge of the world, and I stayed there and dredged slips. And one night the silt sat up and said hello.');
  await c.say('anyone', 'You deserted.');
  await c.say('someday', 'I quit. There is a difference. Not much of one.');
  const r2 = await c.ask('hello', '...', ['You should have told me.', "You're more than that."]);
  if (r2 === 0) {
    await c.say('hello', 'You should have told me.');
    await c.say('someday', 'I know. I know, sprout.');
    await c.say('hello', '...But you are more than that. More than the worst thing you did.');
  } else {
    await c.say('hello', 'You are more than the worst thing you did.');
  }
  await c.say('someday', '...Maybe. Ask me again when this is over.');
  await c.say(null, 'Bigger licks her from her boots to her hat. She lets him.');
  await c.say('house', 'THE CUT IS TAKEN. THE PRIZE IS PAID.');
  await c.give('linepass');
  await c.say('someone', 'There. Everyone wins. Even the House, a little. The Line is east, past the Unspoken Wood.');
  c.set('slip', Math.max(c.num('slip'), 5));
  c.music('jackpot');
  await c.say(null, 'The east road out of Jackpot is open to anyone carrying a Line Pass.');
}

export const CH5: MapDef[] = [JACKPOT, ARENA];
