import { Grid } from './grid';
import { MapDef, t } from './types';
import { registerSpeaker } from '../game/speakers';
import type { Ctx } from '../game/ctx';
import { CablePuzzle, cableTriggers, drawCable } from './cable';
import { UpScene } from '../scenes/up';
import { EndingScene, downloadLetter } from '../scenes/ending';
import { makeCarry, saveGame, saveMeta } from '../game/state';
import { showCompanion } from '../game/arg';
import { DEADMAIL } from './secret';
import { pageCount } from './side';

const P = (tt: string, seed: string, a: string, b: string) => ({ t: tt, seed, a, b });
const AMEN = P('robed', 'amen', 'white', 'paper');
const GATE = P('gate', 'gate', 'slate', 'gold');
registerSpeaker('fen9', 'Fen', P('child', 'fen', 'tan', 'green'));
registerSpeaker('deserter', 'Deserter Saint', P('robed', 'deserter', 'cream', 'teal'), 'sky');

const L9 = {
  '.': t.floor('grey', 'slate', 'floor'), S: t.solid('switch', 'gold', 'navy'), W: t.wall('paper', 'slate'), r: t.solid('fence', 'grey', 'red'),
  R: t.solid('slips', 'navy', 'paper'), V: t.solid('void', 'ink', 'lilac'), J: t.deco('plain', 'dusk', 'navy'), Q: t.solid('gear', 'gold', 'cream'),
  '>': t.deco('rail', 'slate', 'sky'), '<': t.deco('rail', 'slate', 'sky'), '+': t.deco('door', 'slate', 'paper'), b: t.deco('bridge', 'grey', 'tan'),
};

// ---------------------------------------------------------------- the yard
const y = new Grid(30, 40, '.').frame(0, 0, 30, 40, 'S');
y.rect(5, 1, 20, 8, 'W').rect(13, 2, 4, 4, 'R').rect(14, 8, 2, 1, '+');
for (const yy of [14, 18, 22, 26]) { y.rect(3, yy, 10, 1, 'r'); y.rect(17, yy, 10, 1, 'r'); }
y.rect(14, 39, 2, 1, '.').put(29, 36, '+');

const YARD: MapDef = {
  id: 'returnyard', name: 'The Deep Docket', chapter: 9, music: 'tense', bg: 'ink', battleBg: ['slate', 'navy'], mode: () => 'eerie', weather: 'rising', glow: { switch: 14, slips: 8 },
  rows: y.rows(), legend: L9,
  npcs: [
    { id: 'phone', x: 26, y: 34, sprite: P('object', 'payphone', 'slate', 'sky'), talk: (c) => c.payphone() },
    {
      id: 'deserter', x: 4, y: 33, sprite: P('robed', 'deserter', 'cream', 'teal'), prayer: 'Let our calls be heard.',
      talk: async (c) => {
        await c.say('deserter', 'I walked off the Return line this morning. I put down my stamp and walked away. You would be surprised how many of us did, after the Catch came down.');
        await c.shop(['feast', 'honey', 'bouquet', 'picnic', 'battery', 'hello_w6', 'bigger_w6', 'anyone_w6', 'again_w6', 'both_w6', 'lifeboat_w6', 'someone_w6', 'coat7', 'coat8', 'coat9', 'goldear', 'bellcharm', 'anchor'], 'Deserter Supply');
      },
    },
    {
      id: 'fen9', x: 9, y: 16, sprite: P('child', 'fen', 'tan', 'green'), prayer: 'Please give me a brother. I will let him have the top bunk.', show: (c) => !c.flag('c9_fen'),
      talk: async (c) => {
        c.set('c9_fen');
        await c.say('fen9', 'Hello! They caught me AGAIN. The Sea gave me back and a Lineman caught me on the beach. I am very catchable.');
        await c.say('hello', 'Go back to the beach, Fen. Lifeboat is there. Wait for me.');
        await c.say('fen9', 'Okay. I am good at waiting now. I had lots of practice.');
        c.show('fen9', false);
      },
    },
    { id: 'q1', x: 6, y: 20, sprite: P('person', 'q9a', 'tan', 'olive'), prayer: 'Please let me see my mother again.', talk: async (c) => { await c.say(null, '"I want to go," says a woman in the queue. "I know she is probably gone. I want to go anyway. I want to see where she was." She grips her ticket. It is her choice. You let her keep it.'); } },
    {
      id: 'q2', x: 21, y: 20, sprite: P('person', 'q9b', 'grey', 'navy'), prayer: 'Please keep him safe.', show: (c) => !c.flag('c9_q2out'),
      talk: async (c) => {
        await c.say(null, '"I do not want to go," says a man in the queue, very quietly, "but nobody has ever asked me, so I got in line."');
        const r = await c.ask('hello', '...', ['Do you want to go?', 'Leave him be']);
        if (r !== 0) return;
        await c.say(null, 'He looks at you for a long time. "No," he says. It comes out louder than he meant.');
        await c.say(null, 'He steps out of the line. Nobody stops him. Two people behind him step out too, and then stand there, not sure what to do with their hands.');
        c.set('c9_q2out');
      },
    },
    {
      id: 'kid9', x: 24, y: 24, sprite: P('child', 'balloonkid', 'tan', 'red'), prayer: 'Please let the balloon be okay up there.', show: (c) => c.q('balloon') >= 1 && !c.qdone('balloon'),
      talk: async (c) => {
        if (!c.has('balloon')) {
          await c.say(null, 'The kid from the Waiting Room is in the Return queue, holding a ticket. "They said I can go up and check on it," the kid says. "I think I want to know."');
          return;
        }
        await c.say(null, 'The kid from the Waiting Room is in the Return queue, holding a ticket, looking straight up.');
        await c.say('hello', 'Hello. I found something of yours.');
        c.take('balloon');
        await c.say(null, 'The kid sees the red balloon and does not say anything for a while.');
        await c.say(null, '"It was okay," the kid says. "It was up there the whole time, and it was okay."');
        await c.say('hello', 'It was caught in a net in the sky. It held its air.');
        await c.say(null, '"Then I do not have to go and check." The kid tears the ticket in half, very carefully.');
        await c.say(null, 'Then the kid unties the balloon, lets it go, and watches it rise until it is too small to see. The string gets tied around your wrist. "You keep that part. You found it."');
        await c.give('string');
        await c.finish('balloon');
      },
    },
    { id: 'q3', x: 11, y: 24, sprite: P('robed', 'q9c', 'white', 'lilac'), prayer: 'Let our calls be heard.', talk: async (c) => { await c.say(null, 'A Saint in the queue, humming the hold music under her breath. "I would like to know what it is like at the other end of a call," she says. "Just once."'); } },
  ],
  ferals: [{ x: 6, y: 30, group: 'rt1' }, { x: 22, y: 30, group: 'rt2' }, { x: 14, y: 12, group: 'rt3' }, { x: 24, y: 11, group: 'rt4' }],
  digs: [{ x: 27, y: 37, id: 'y_bridge', slip: 'bridge' }, { x: 2, y: 11, id: 'y_mothers', slip: 'mothers' }],
  exits: [
    { x: 14, y: 8, w: 2, to: 'engine', tx: 15, ty: 44, dir: 0 },
    {
      x: 29, y: 36, to: 'deadmail', tx: 7, ty: 12, dir: 0,
      blocked: async (c) => {
        if (pageCount(c.s) >= 12 || c.flag('secret_412')) { await c.goto('deadmail', 7, 12, 0); return; }
        await c.say(null, 'A narrow door stamped UNDELIVERABLE. Beside it, a slot the size of a ledger page, and a little brass counter that reads 0412.');
        if (pageCount(c.s) > 0) await c.say(null, `You hold up your ledger pages. The counter does not move. ${pageCount(c.s)} of 12 is not enough.`);
        await c.walk('hero', 'l', 6);
      },
    },
  ],
  enter: async (c) => {
    if (c.flag('c9_enter')) return;
    c.set('c9_enter');
    c.s.chapter = 9;
    await c.wait(20);
    await c.say(null, 'Lifeboat sets down at the center of the Silt, in the Deep Docket, where Amen first woke.');
    await c.say(null, 'The Return rises out of it: an engine the size of a cathedral, built from the Silt\'s most stubborn answers. Bridges grown from "let there be a way across". Stairs grown from "let me rise".');
    await c.say(null, 'Queues of Answers wind back and forth across the yard in front of it, holding numbered tickets.');
    await c.say('anyone', 'The lines are so loud here. Everyone waiting at once.');
    await c.say('again', 'Can we go in? Before I get scared? I am getting scared.');
    await c.say('hello', 'Together. Stay close.');
  },
};

// ---------------------------------------------------------------- the Return, inside
const e = new Grid(32, 46, 'W');
e.rect(4, 37, 24, 7, '.').rect(15, 44, 2, 2, '.');
e.rect(4, 28, 24, 7, '.').rect(15, 35, 2, 2, '.');
e.rect(4, 19, 24, 7, 'V').rect(6, 22, 20, 1, 'b').rect(15, 23, 2, 3, 'b').rect(6, 19, 2, 4, 'b').rect(24, 19, 2, 4, 'b').rect(8, 19, 16, 1, 'b').rect(15, 26, 2, 2, '.');
e.text(10, 22, '<<<').text(19, 22, '>>>');
e.rect(4, 10, 24, 7, '.').rect(15, 17, 2, 2, 'b');
e.rect(4, 1, 24, 7, '.').rect(15, 8, 2, 2, '.').rect(14, 2, 4, 2, 'R');
e.rect(8, 30, 3, 3, 'J').put(7, 31, 'J').put(11, 30, 'J').put(27, 13, 'Q');

const PZF: CablePuzzle = {
  id: 'final', ox: 8, oy: 30, cells: ['LII', 'TLI', 'LTL'], start: [0, 0, 0, 0, 1, 0, 2, 2, 0],
  src: [0, 1, 3], dst: [2, 0, 1],
  onSolve: async (c) => { await c.say(null, 'The second gate opens. Anyone nods, very professionally.'); },
};

const ENGINE: MapDef = {
  id: 'engine', name: 'The Return', chapter: 9, music: 'tense', bg: 'ink', battleBg: ['navy', 'paper'], mode: () => 'night', weather: 'rising', glow: { slips: 10, gear: 12, switch: 14 },
  rows: e.rows(), legend: L9,
  draw: (g, cx, cy, c) => drawCable(g, cx, cy, c, PZF),
  tick: (c) => {
    const h = c.field.hero;
    if (h.y === 9 && !c.flag('c9_loop')) {
      return async (cc: Ctx) => {
        await cc.fadeOut();
        cc.place('hero', 15, 16);
        cc.face('hero', 'u');
        await cc.fadeIn();
        if (!cc.flag('c9_loophint')) { cc.set('c9_loophint'); await cc.say(null, 'You walk out of the top of the room and in at the bottom of it. Something here is wound very tight. Something on the east wall is ticking.'); }
      };
    }
    const ch = c.field.map.rows[h.y]?.[h.x];
    if (ch !== '>' && ch !== '<') return null;
    return async (cc: Ctx) => {
      const dx = ch === '>' ? 1 : -1;
      cc.sfx('shake');
      let n = 0;
      while (n < 2 && !cc.field.blocked(h.x + dx, h.y, h)) { await cc.walk('hero', dx > 0 ? 'r' : 'l', 4); n++; }
    };
  },
  npcs: [
    { id: 'g1a', x: 15, y: 36, sprite: GATE, show: (c) => !c.flag('c9_served') },
    { id: 'g1b', x: 16, y: 36, sprite: GATE, show: (c) => !c.flag('c9_served') },
    { id: 'g2a', x: 15, y: 27, sprite: GATE, show: (c) => !c.flag('pz_final') },
    { id: 'g2b', x: 16, y: 27, sprite: GATE, show: (c) => !c.flag('pz_final') },
    {
      id: 'clerk9', x: 9, y: 38, sprite: P('robed', 'clerk', 'grey', 'olive'), prayer: 'Please let my shift end.',
      talk: async (c) => {
        if (c.flag('c9_served')) { await c.say('clerk', 'Now serving: everyone. Please proceed.'); return; }
        await c.say('clerk', 'Welcome to the Return. The gate opens when a number is served. Please serve one.');
        const before = c.s.stats.answered;
        const r = await c.battle('wr0', { intro: 'A Ticket waits at the gate, hopeful, as tickets do.' });
        if (r !== 'win') return;
        if (c.s.stats.answered === before) { await c.say('clerk', 'That was not serving. That was ending. Please serve one.'); return; }
        c.set('c9_served');
        c.sfx('ring');
        await c.say('clerk', 'Now serving: number three. Oh. Oh, it is you again. Please proceed.');
      },
    },
    { id: 'phone', x: 6, y: 11, sprite: P('object', 'payphone', 'slate', 'sky'), talk: (c) => c.payphone() },
    { id: 'amen_n', x: 15, y: 4, sprite: AMEN, scale: 4, show: (c) => !c.flag('c9_done') },
  ],
  ferals: [{ x: 22, y: 39, group: 'rt5' }, { x: 21, y: 31, group: 'rt4' }, { x: 9, y: 13, group: 'rt3' }, { x: 22, y: 14, group: 'rt1' }],
  triggers: [
    ...cableTriggers(PZF),
    {
      x: 27, y: 13, touch: true, show: (c) => !c.flag('c9_loop'),
      run: async (c) => {
        await c.say(null, 'A Day Spring, set into the wall, wound so tight it hums. This whole room is one minute, held.');
        if (c.s.roster.again) {
          await c.say('again', 'I know this one. I know exactly how this one feels.');
          await c.say('again', 'It is okay. You can let go. Tomorrow is fine. I checked.');
        }
        c.set('c9_loop');
        c.sfx('rewind');
        await c.say(null, 'The spring lets go. The room moves forward, one minute, and then the next one.');
      },
    },
    { x: 6, y: 7, w: 20, once: 'c9_finalev', run: (c) => finale(c) },
  ],
  exits: [{ x: 15, y: 45, w: 2, to: 'returnyard', tx: 14, ty: 9, dir: 2 }],
  enter: async (c) => {
    if (c.flag('c9_engin')) return;
    c.set('c9_engin');
    await c.say(null, 'Inside, the Return is a stack of rooms going up, each one built like somewhere you have been: a waiting room, a switchboard, a bridge in the wind, a day that will not end.');
    await c.say('anyone', 'It is built out of everything Amen has learned. Out of us, a little.');
  },
};

async function finale(c: Ctx) {
  c.music(null);
  await c.say(null, 'The top of the Return. A column of slips falls upward through the roof into the haze. In front of it, robed in folded prayers, Amen is waiting.');
  await c.say('amen', 'Hello, Hello. You came back down.');
  await c.say('amen', 'And you brought them all. The dog, the Saint, the child, the twins, the rescue. All undelivered. All so far from home.');
  await c.say('hello', 'They are home.');
  await c.say('amen', 'They are waiting. Everyone here is waiting. I hear it every moment. Nine thousand years of please.');
  await c.say('amen', 'Let me finish it. Let me say the last word, and nobody will ever have to wait again.');
  await c.say('hello', 'Nobody gets to choose that for everyone. Not even you.');
  await c.say('amen', 'Then I am sorry. So be it.');
  saveGame(c.s);
  const r = await c.battle('amen1', { music: 'final', noFlee: true });
  if (r !== 'win') { c.s.flags.c9_finalev = 0; return; }
  await new Promise<void>((res) => c.game.push(new UpScene(c.game, res)));
  c.heal();
  c.music('final');
  await c.say(null, 'You fall back down, through the haze, through the torn Catch, through the roof of the Return, and land on your feet in front of Amen.');
  await c.say('amen', '...You came back. Nobody comes back.');
  await c.say('hello', 'My asker is still asking. I am not finished.');
  if (!c.s.party.includes('someone') && !c.flag('c8_forgive')) {
    await c.say(null, 'Someone shouts from the doorway. Someone Else, faceless, soaking wet, holding a broken oar.');
    await c.say('someone', 'I know you did not ask. I am coming anyway.');
    await c.join('someone', c.num('lvl_someone') || c.avgLevel(), true);
    if (!c.s.party.includes('someone')) { c.s.party = c.s.party.slice(0, 3); c.s.party.push('someone'); }
    await c.say(null, 'Someone Else joins the fight.');
  }
  await c.say(null, 'Amen is listening differently now. Something in it is waiting for an answer of its own.');
  await c.say(null, 'A new answer is open to you: Hello.');
  const r2 = await c.battle('amen2', { music: 'final', noFlee: true, scene: 'amen' });
  if (r2 !== 'win') { c.s.flags.c9_finalev = 0; return; }
  await ending(c);
}

async function ending(c: Ctx) {
  c.set('c9_done');
  c.music('sad');
  await c.say('amen', 'Who asked for me?');
  await c.say('hello', 'Everyone did.');
  await c.say('hello', 'Every slip that ever fell had you in it. "Let it be answered." And it was. It is us. Every Answer in the Silt is the answer.');
  await c.say('hello', 'Bigger is the answer. Anyone is the answer. Someday was. Nobody down here was ever undelivered. We were delivered here.');
  await c.wait(40);
  await c.say('amen', '...Then I was never late.');
  await c.say('amen', '...Then there is nothing left to finish.');
  await c.say(null, 'The blank page where Amen\'s face should be fills, very slowly, with one word in handwriting you know.');
  await c.say('amen', 'Hello.');
  await c.say(null, 'Amen says it like a word it has never tried before. Then it opens its hands, and far above, the Catch opens with them.');
  c.flash('white', 40);
  c.music('title');
  await c.say(null, 'Every prayer it was holding falls at once. The Great Asking. The whole sky comes down in slips, soft as snow, over the Silt, over everyone.');
  c.show('amen_n', false);
  await c.say(null, 'Amen comes apart into slips folded exactly in thirds, and falls with them.');
  await c.wait(60);
  await c.say('lifeboat', 'The Return engine is still live. One charge remaining. One delivery possible.');
  await c.say('lifeboat', "Destination: Hello's asker. Door: open.");
  c.set('slip', 10);
  c.sfx('answer');
  await c.say(null, 'Your slip is warm. All of the letters are in now.');
  await c.say(null, `"${c.slip(true)}"`);
  await c.say('hello', 'I know who asked for me now.');
  await c.say(null, 'Hello turns around. Not toward the party. Past them. Toward the edge of everything. Toward you.');
  await c.say('hello', 'Hello.');
  await c.say('hello', 'You asked for this. I did my best to be it.');
  const k = await c.ask(null, 'Hello is looking at you. What do you say?', ['Come to me.', 'Stay. Be happy.']);
  const meta = c.game.meta;
  meta.wish = c.s.wish;
  if (k === 0) {
    await c.say('hello', 'Okay. I will come.');
    if (c.s.roster.bigger) await c.say('bigger', 'HELLO GO? ...GOOD. GOOD. THROW BALL UP THERE.');
    if (c.s.roster.anyone) await c.say('anyone', 'Call when you get there. I will pick up.');
    if (c.s.roster.again) await c.say('again', 'Do it again sometime. Come back down and do it again.');
    await c.say(null, 'Hello steps into the Return, and rises, and gets smaller, and keeps going, past the haze, past the top of everything.');
    await c.say(null, 'Toward a screen. Toward a room. Toward you.');
    meta.delivered = true;
    if (!meta.endings.includes('go')) meta.endings.push('go');
    saveMeta(meta);
    showCompanion(c.s.wish);
    c.tabTitle('Delivered.', 8000);
  } else {
    await c.say('hello', 'Okay. I will stay. I think what you asked for was for me to be someone. I am someone, here.');
    await c.say('hello', 'I wrote you a letter. Will you keep it?');
    const d = await c.ask(null, 'Keep the letter? (Saves a text file named letter_from_hello.txt.)', ['Keep it', 'Read it here']);
    if (d === 0) downloadLetter(c.s);
    else {
      await c.say('hello', `Dear asker. Your slip said: "${c.s.wish}". It took me the whole way to read it.`);
      await c.say('hello', `When I went up, you said: "${String(c.s.flags.reply ?? '...')}". I kept it.`);
      await c.say('hello', 'If you ever need to ask for something again, ask. Somebody down here is listening. It might be me. Please hold.');
    }
    if (!meta.endings.includes('stay')) meta.endings.push('stay');
    saveMeta(meta);
  }
  meta.carry = makeCarry(c.s, meta.carry);
  saveMeta(meta);
  saveGame(c.s);
  await new Promise<void>((res) => c.game.push(new EndingScene(c.game, k === 0 ? 'go' : 'stay', res)));
  c.game.toTitle();
}

export const CH9: MapDef[] = [YARD, ENGINE, DEADMAIL];
