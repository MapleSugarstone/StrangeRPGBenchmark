import { Grid } from './grid';
import { MapDef, t } from './types';
import { registerSpeaker } from '../game/speakers';
import type { Ctx } from '../game/ctx';
import { page } from './side';

const P = (tt: string, seed: string, a: string, b: string) => ({ t: tt, seed, a, b });
const AMEN = P('robed', 'amen', 'white', 'paper');
const SOMEDAY = P('person', 'someday3', 'tan', 'rust');
registerSpeaker('fenc', 'Fen', P('child', 'fen', 'tan', 'green'));

const SKY = {
  V: t.solid('cloud', 'sky', 'white'), L: t.solid('pillar', 'grey', 'slate'), p: t.floor('slate', 'grey', 'vent'), H: t.deco('stairs', 'slate', 'grey'),
  '>': t.deco('rail', 'slate', 'sky'), '<': t.deco('rail', 'slate', 'sky'),
  N: t.floor('silt', 'plea', 'mesh'), '~': t.deco('drift', 'silt', 'paper'), B: t.solid('gate', 'grey', 'slate'), R: t.solid('slips', 'navy', 'paper'),
};

function windTick(c: Ctx) {
  const h = c.field.hero;
  const ch = c.field.map.rows[h.y]?.[h.x];
  if (ch !== '>' && ch !== '<') return null;
  return async (cc: Ctx) => {
    const dx = ch === '>' ? 1 : -1;
    cc.sfx('shake');
    let n = 0;
    while (n < 3 && !cc.field.blocked(h.x + dx, h.y, h)) { await cc.walk('hero', dx > 0 ? 'r' : 'l', 4); n++; }
  };
}

// ---------------------------------------------------------------- the Line
const l = new Grid(24, 50, 'V').rect(0, 0, 4, 50, 'L');
l.rect(4, 45, 18, 3, 'p').rect(20, 40, 1, 5, 'H')
  .rect(8, 38, 15, 2, 'p').rect(9, 33, 1, 5, 'H')
  .rect(4, 31, 14, 2, 'p').rect(16, 26, 1, 5, 'H')
  .rect(10, 24, 13, 2, 'p').rect(21, 19, 1, 5, 'H')
  .rect(5, 17, 18, 2, 'p').rect(6, 12, 1, 5, 'H')
  .rect(4, 10, 16, 2, 'p').rect(17, 5, 1, 5, 'H')
  .rect(8, 3, 14, 2, 'p').rect(14, 1, 2, 2, 'p');
l.text(12, 38, '>>>').text(7, 31, '<<').text(13, 24, '>>').text(9, 17, '<<<').text(10, 10, '>>>').text(12, 3, '<<');

const LINE1: MapDef = {
  id: 'line1', name: 'The Line', chapter: 7, music: 'climb', bg: 'sky', battleBg: ['sky', 'slate'], weather: 'wind',
  rows: l.rows(), legend: SKY,
  tick: windTick,
  npcs: [{ id: 'phone', x: 12, y: 25, sprite: P('object', 'payphone', 'slate', 'sky'), talk: (c) => c.payphone() }],
  triggers: [
    {
      x: 8, y: 45, w: 3, once: 'c7_rung',
      run: async (c) => {
        await c.say('someday', 'This rung is Mabel. The next one up is Orrin. I named them after the people I carried. Saved me counting.');
        await c.say('someday', 'Three thousand and six rungs. I ran out of names long before I ran out of rungs. I started again from the top.');
      },
    },
  ],
  ferals: [{ x: 14, y: 39, group: 'ln1' }, { x: 8, y: 32, group: 'ln2' }, { x: 18, y: 25, group: 'ln3' }, { x: 15, y: 18, group: 'ln1' }, { x: 10, y: 11, group: 'ln2' }, { x: 18, y: 4, group: 'ln3' }],
  digs: [{ x: 21, y: 46, id: 'l_envelope', slip: 'envelope' }, { x: 14, y: 32, id: 'l_coat', item: 'coat7', n: 2 }, { x: 5, y: 18, id: 'l_stew', item: 'feast' }, { x: 16, y: 11, id: 'l_awake', slip: 'awake' }],
  exits: [{ x: 14, y: 1, w: 2, to: 'catch', tx: 17, ty: 27, dir: 0 }],
  enter: async (c) => {
    if (c.flag('c7_enter')) return;
    c.set('c7_enter');
    c.s.chapter = 7;
    await c.wait(20);
    await c.say(null, 'The Line goes up. Platforms and ladders wind around it. Below, the Wood is a pale smudge. Above, there is only haze, and the wind.');
    await c.say('someday', 'I know these rungs. I used to know every one of them by name.');
    await c.say('someday', 'Linemen have a rule up here. If you fall, you get one last word on the way down. Make it count.');
    c.set('mech_lastword');
    c.sfx('rewind');
    await c.say(null, 'Last Word: when a party member is knocked out, they act once more before they fall. Once per member, per fight.');
    await c.say(null, 'Watch for the arrows on the platforms. The wind up here does not ask before it pushes.');
  },
};

// ---------------------------------------------------------------- the Catch
const ca = new Grid(36, 30, 'V').rect(2, 2, 32, 26, 'N');
ca.scatter('V', 34, 701, 'N', 3).scatter('~', 40, 702, 'N', 2);
ca.rect(16, 6, 4, 23, 'N').rect(4, 10, 28, 2, 'N').rect(4, 20, 28, 2, 'N');
ca.rect(3, 2, 30, 1, 'B').rect(3, 3, 1, 3, 'B').rect(32, 3, 1, 3, 'B').rect(4, 3, 28, 3, 'N').rect(3, 6, 30, 1, 'B').rect(16, 6, 4, 1, 'B');
ca.rect(17, 14, 2, 2, 'R').rect(17, 28, 2, 2, 'N');

const CATCH: MapDef = {
  id: 'catch', name: 'The Catch', chapter: 7, music: 'climb', bg: 'sky', battleBg: ['silt', 'slate'], weather: 'slips',
  rows: ca.rows(), legend: SKY,
  npcs: [
    { id: 'sincerely', x: 17, y: 9, sprite: P('knight', 'sincerely', 'paper', 'red'), scale: 4, show: (c) => !c.flag('c7_sinc') },
    { id: 'fen', x: 10, y: 4, sprite: P('child', 'fen', 'tan', 'green'), show: (c) => !c.flag('c7_fall') },
    { id: 'bigger_c', x: 22, y: 4, sprite: P('dog', 'bigger', 'gold', 'red'), scale: 2, show: (c) => !c.flag('c7_free') },
    { id: 'pen1', x: 6, y: 5, sprite: P('person', 'pen1', 'grey', 'tan'), show: (c) => !c.flag('c7_fall'), prayer: 'Please bring him home.' },
    { id: 'pen2', x: 27, y: 5, sprite: P('robed', 'pen2', 'grey', 'lilac'), show: (c) => !c.flag('c7_fall'), prayer: 'Please let her be happy.' },
    { id: 'amen', x: 17, y: 13, sprite: AMEN, scale: 2, show: (c) => c.flag('c7_amenin') && !c.flag('c7_fall') },
    { id: 'someday_c', x: 17, y: 16, sprite: SOMEDAY, show: () => false },
    { id: 'se_c', x: 30, y: 15, sprite: P('person', 'someone7', 'lilac', 'plum'), show: () => false },
    { id: 'phone', x: 19, y: 26, sprite: P('object', 'payphone', 'slate', 'sky'), talk: (c) => c.payphone() },
    {
      id: 'balloon_c', x: 29, y: 24, sprite: P('flyer', 'redballoon', 'red', 'white'), show: (c) => !c.has('balloon') && !c.qdone('balloon') && !c.flag('c7_fall'),
      talk: async (c) => {
        await c.say(null, 'A red balloon, snagged in the net by its string. Of everything up here, it is the only thing that is not whispering. It is just holding its air.');
        if (c.q('balloon') >= 1) await c.say('hello', 'It was okay. It was up here the whole time.');
        await c.give('balloon');
        await c.quest('balloon', 3);
      },
    },
  ],
  ferals: [{ x: 8, y: 20, group: 'ct1' }, { x: 28, y: 20, group: 'ct2' }, { x: 8, y: 11, group: 'ct3' }, { x: 27, y: 11, group: 'ct4' }, { x: 18, y: 23, group: 'ct1' }],
  digs: [{ x: 5, y: 25, id: 'k_deepest', slip: 'deepest' }, { x: 17, y: 20, id: 'k_coat', item: 'coat7', n: 2 }, { x: 19, y: 25, id: 'k_bouquet', item: 'bouquet' }, { x: 6, y: 15, id: 'k_mayday', slip: 'mayday' }, { x: 31, y: 18, id: 'k_page11', page: 11 }],
  triggers: [
    {
      x: 16, y: 12, w: 4, once: 'c7_sincev',
      run: async (c) => {
        await c.say(null, 'Between you and the pens stands a knight made of envelopes, every fold crisp, every flap sealed.');
        await c.say('sincerely', 'Visitors to the Forwarding Pens must have an address. Do you have an address?');
        await c.say('hello', 'We are here for Bigger. And for Fen.');
        await c.say('sincerely', 'Failed deliveries. They will be redelivered at the next window, and the next, until they arrive. I make sure. It is what I am for.');
        await c.say('someday', 'Until they come apart, you mean.');
        await c.say('sincerely', 'Everything arrives eventually. Even if it arrives in pieces. Yours sincerely.');
        const r = await c.battle('sincerely', { music: 'boss', noFlee: true });
        if (r !== 'win') { c.s.flags.c7_sincev = 0; return; }
        await afterSincerely(c);
      },
    },
    { x: 6, y: 6, touch: true, show: (c) => !c.flag('c7_fall'), run: async (c) => { await c.say(null, 'Through the bars, a man in the pen: "They sent me up eleven times. Every time I come back down, a little less of me comes back. I used to have a name. It started with a sound like water."'); } },
    { x: 27, y: 6, touch: true, show: (c) => !c.flag('c7_fall'), run: async (c) => { await c.say(null, 'Through the bars, a Saint, folded small: "My world is gone. They keep sending me to where it was. It is just dark there, and very cold. And then I fall."'); } },
    {
      x: 4, y: 6, w: 28, touch: true, show: (c) => !c.flag('c7_sinc'),
      run: async (c) => { await c.say(null, 'The Forwarding Pens. Answers packed in like letters in a sack: failed deliveries, waiting to be sent up again. Sincerely holds the only key.'); },
    },
  ],
  exits: [{ x: 17, y: 29, w: 2, to: 'line1', tx: 14, ty: 2, dir: 2 }],
  enter: async (c) => {
    if (c.flag('c7_catchin')) return;
    c.set('c7_catchin');
    await c.wait(20);
    await c.say(null, 'The Catch. A net strung across the whole sky, sagging under months of caught prayers. They lie in drifts, still whispering. The sky above is dark with more.');
    await c.say(null, 'At the center, a column of slips falls upward, endlessly, into the haze. The Return.');
    await c.say('anyone', 'Look. Some of them are coming back down.');
    await c.say(null, 'She is right. Now and then something drops out of the Up, tumbling, and is caught by the net, and is carried back to the column, and sent up again.');
    await c.say(null, 'Each time it comes down, there is a little less of it.');
  },
};

async function afterSincerely(c: Ctx) {
  c.set('c7_sinc');
  c.show('sincerely', false);
  await c.say(null, 'Sincerely comes unfolded, letter by letter, and every letter drifts off on the wind. The key to the pens is the last thing left.');
  c.set('c7_free');
  c.sfx('door');
  await c.say('bigger', 'HELLO! HELLO HELLO HELLO! BALL? NO BALL. HELLO!');
  await c.join('bigger', c.num('lvl_bigger') || c.avgLevel(), true);
  await c.say(null, 'Bigger is back in the party. He is also on top of you.');
  await c.say('fenc', 'Hello!');
  await c.say('fenc', 'I knew you\'d ask. I told them. I said, Hello will ask where I went, and then Hello will come.');
  await c.say('hello', 'Hello, Fen.');
  await c.say('fenc', 'They sent me up. It was dark, and then it was a house, but nobody lived there anymore. It had a top bunk. Nobody in it. And then I fell.');
  await amenScene(c);
}

export const CH7: MapDef[] = [LINE1, CATCH];

export async function amenScene(c: Ctx) {
  c.music(null);
  c.set('c7_amenin');
  await c.wait(40);
  await c.say(null, 'The column of upward-falling slips at the center of the Catch slows, and stops, and someone steps out of it.');
  await c.say(null, 'It is tall, and robed in slips, every one folded exactly in thirds. It has no face. Where a face should be there is a blank page, and the page is listening.');
  await c.say('amen', 'Hello, Hello. Thank you for your patience.');
  await c.say('amen', 'I am Amen. I grew from the oldest slip in the deepest stratum of the Silt. It said: "Let every prayer be answered."');
  await c.say('amen', 'It took forty thousand years for the Silt to grow me. I woke in the dark under the Docket, and I listened, and I heard nine thousand years of Asking fall into silt and lie there. Unanswered. Every one.');
  await c.say('amen', 'And I heard all of you. Every Answer, grown for someone, sitting in the Silt, longing for someone who never came.');
  await c.say('amen', 'Both halves of every prayer, stranded. The asker Above, waiting for an answer. The answer Below, waiting for the asker. For nine thousand years.');
  await c.say('amen', 'So I hung the Catch, so no more prayers would fall and be stranded. And I built the Return, so that every answer could go home.');
  await c.say('hello', 'Most of them have no home to go to. Their askers are dead.');
  await c.say('amen', '...Yes.');
  await c.say('amen', 'Not all. Some are still waiting. Even one delivery is a mercy. The rest are sent again. And again. Until they arrive.');
  await c.say('anyone', 'Until they come apart. We saw them. They come back down in pieces.');
  await c.say('amen', 'A prayer that cannot be delivered is a sentence that cannot be finished. I am the last word. I finish things. So be it.');
  await c.say('someday', "Fen didn't want to go. Half of Lowmost didn't want to go.");
  await c.say('amen', 'Wanting is the problem. Wanting is what I am ending.');
  await c.wait(30);
  await c.say('amen', 'But you, Hello. You are interesting. Your slip has no sender on file. May I?');
  c.set('slip', Math.max(c.num('slip'), 7));
  c.sfx('listen');
  await c.say(null, 'Amen reads your slip without touching it. The blank page where its face should be fills, slowly, with handwriting.');
  await c.say('amen', `"${c.slip()}"`);
  await c.say('amen', 'This prayer is not finished. Its asker is not dead.');
  await c.say('amen', 'Its asker is... here.');
  c.set('c7_amen');
  c.tabTitle('Amen is reading this.', 9000);
  await c.say(null, 'The blank page turns. Not toward you. Past you. Toward the edge of everything. Toward whoever is looking at this.');
  await c.say('amen', 'Hello, asker. Thank you for your patience.');
  await c.say('amen', 'Hello. You are the only Answer in the Silt whose door is still open. I can deliver you. Right now. You would arrive.');
  const r = await c.ask('hello', '...', ['...Is that true?', 'No.']);
  if (r === 0) await c.say('amen', 'I do not lie. I only finish.');
  else await c.say('amen', 'You do not have to want it. That is the mercy.');
  await c.say('amen', 'So be it.');
  c.flash('white', 20);
  await c.say(null, 'The column of slips reaches for you. You feel yourself getting lighter. You feel yourself begin to fall upward.');
  await c.say('someday', 'NO.');
  c.place('someday_c', 17, 16);
  c.show('someday_c', true);
  await c.say(null, 'Someday steps into the column in front of you.');
  c.music('sad');
  await c.say('someday', 'Take me instead. I am already late. Four hundred years late, your Supervisor said.');
  await c.say('amen', 'Lineman Zero Four One One. Your asker has been dead three thousand years.');
  await c.say('someday', "Then I'll go and see the grave. Somebody ought to check on that little one.");
  await c.say('someday', 'Here, sprout.');
  await c.say(null, 'She unclips the old Line receiver from her belt and clips it onto yours.');
  await c.say('someday', 'Call me sometime.');
  await c.say('hello', 'Someday...');
  await c.say('someday', 'Ha. Today, actually.');
  c.show('someday_c', false);
  c.flash('white', 30);
  c.sfx('answer');
  await c.say(null, 'And she is gone, upward, smaller and smaller, until she is just one more slip in the haze.');
  await c.wait(60);
  await c.say('amen', '...Delivered. Thank you for your patience.');
  c.place('se_c', 30, 15);
  c.show('se_c', true);
  await c.say(null, 'Someone is shouting. Someone Else, at the edge of the Catch, holding a stolen knife, with a Lineman\'s face sliding off their own.');
  await c.say('someone', "You said you would Return ME. You said as someone. You never said who it would cost!");
  await c.say(null, 'They cut the anchor cable.');
  c.shake(60);
  await c.wait(30);
  await c.say(null, 'The Catch tears. The whole sky lets go.');
  c.set('c7_fall');
  await c.fadeOut();
  await c.say(null, 'You fall. Everyone falls.');
  await c.say(null, 'And all around you, for the first time in months, the prayers fall too: everything the Catch was holding, all at once, the whole Asking snowing down around you as you drop through the haze.');
  await c.say(null, 'Somewhere far above, a voice says, very calmly: "So be it. Again, then."');
  await c.say(null, 'You hold the receiver Someday gave you. It is warm.');
  await c.give('receiver', 1, true);
  for (const id of ['someday', 'anyone', 'again', 'both', 'bigger']) c.depart(id);
  delete c.s.flags.lvl_someday;
  c.sfx('ring');
  await c.say(null, 'Hello learned Call. In battle, Hello can call one kept prayer per fight, and it answers with everything it has.');
  await c.card(8);
  await c.goto('shore', 6, 10, 2);
}
