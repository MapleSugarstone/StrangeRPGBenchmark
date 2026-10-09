import { Grid } from './grid';
import { MapDef, t } from './types';
import { registerSpeaker } from '../game/speakers';
import type { Ctx } from '../game/ctx';
import { page } from './side';

const P = (tt: string, seed: string, a: string, b: string) => ({ t: tt, seed, a, b });
const BOTH = P('twin', 'both', 'cream', 'orange');
const GATE = P('gate', 'thorngate', 'rose', 'paper');
const LINEMAN = P('robed', 'lineman', 'slate', 'grey');
const SOMEONE = P('person', 'someone7', 'lilac', 'plum');
registerSpeaker('first', 'First', BOTH, 'orange');
registerSpeaker('firster', 'Firster', BOTH, 'orange');
registerSpeaker('merchant', 'Last Stop', P('robed', 'laststop', 'tan', 'teal'));
registerSpeaker('hushspk', 'The Hush', P('flyer', 'hushowl', 'dusk', 'lilac'), 'lilac');

const WOODS = {
  '.': t.floor('paper', 'silt', 'speck'), Z: t.solid('tree', 'paper', 'slate'), X: t.solid('bush', 'paper', 'rose'), m: t.deco('cloud', 'paper', 'white'),
  Q: t.deco('plain', 'paper', 'silt'), g: t.floor('mint', 'moss', 'grass'), Y: t.solid('bush', 'mint', 'moss'), c: t.solid('crate', 'mint', 'brown'),
  L: t.solid('pillar', 'grey', 'slate'), H: t.deco('stairs', 'grey', 'slate'),
};

// ---------------------------------------------------------------- the treeline
const e = new Grid(26, 24, 'g').frame(0, 0, 26, 24, 'Y');
e.rect(19, 1, 6, 22, 'Z').rect(19, 11, 7, 2, '.').rect(0, 13, 1, 2, 'g').put(10, 11, 'c').scatter('Y', 8, 611, 'g', 2);

const EDGE: MapDef = {
  id: 'wood_edge', name: 'The Treeline', chapter: 6, music: 'field', bg: 'moss', battleBg: ['mint', 'moss'], mode: () => 'dusk', weather: 'motes',
  rows: e.rows(), legend: WOODS,
  npcs: [
    { id: 'phone', x: 5, y: 6, sprite: P('object', 'payphone', 'slate', 'sky'), talk: (c) => c.payphone() },
    {
      id: 'merchant', x: 13, y: 7, sprite: P('robed', 'laststop', 'tan', 'teal'), prayer: 'Please let there be one more customer.',
      talk: async (c) => {
        await c.say('merchant', 'Last Stop. Last shop before the Wood, last shop before the Line, last shop before a lot of things. Nobody talks in there, so buy what you need out here.');
        await c.shop(['feast', 'honey', 'bouquet', 'tonic', 'firecracker', 'hello_w5', 'someday_w5', 'anyone_w4', 'again_w4', 'both_w4', 'coat6', 'quietstone', 'padding'], 'Last Stop');
      },
    },
  ],
  triggers: [{ x: 16, y: 1, h: 22, once: 'c6_camp', run: (c) => campScene(c) }],
  exits: [
    { x: 0, y: 13, h: 2, to: 'jackpot', tx: 38, ty: 18, dir: 3 },
    { x: 25, y: 11, h: 2, to: 'wood', tx: 1, ty: 17, dir: 1 },
  ],
  enter: async (c) => {
    if (c.flag('c6_enter')) return;
    c.set('c6_enter');
    c.s.chapter = 6;
    await c.say(null, 'East of Jackpot the road runs out at a treeline. The trees are as pale as paper. Their leaves are letters nobody sent.');
  },
};

async function campScene(c: Ctx) {
  await c.say(null, 'There is no wind at the treeline. No birds. The leaves do not even rustle.');
  await c.say('someday', 'Past here, nobody can talk. The Wood grew from every prayer that was never said out loud. It eats sound.');
  await c.say('anyone', 'I can keep the line open between us. In a fight, you will still hear each other think. You just will not be able to speak. No spoken skills.');
  await c.say('again', 'So we should say everything now? Before we go in?');
  await c.say('someday', 'That is not a bad idea, kid.');
  await c.say(null, 'So everyone sits in the grass at the edge of the quiet, and one at a time, each says one true thing out loud.');
  await c.say('bigger', 'BALL.');
  await c.say(null, 'Everyone agrees that this is true.');
  await c.say('anyone', 'I am glad you called. Even by accident.');
  await c.say('again', "I'm scared of tomorrow. But I like it. Both at once.");
  await c.say('someone', "...I'm not who you think I am.");
  await c.wait(40);
  await c.say(null, 'There is a pause. Then Someday laughs, and then everyone laughs.');
  await c.say('someday', 'Nobody is, Someone Else. That is your whole name.');
  await c.say('someone', 'Ha. Yes. That is my whole name.');
  await c.say('someday', "I'm proud of you, sprout. That's mine. Don't make it weird.");
  const r = await c.ask('hello', '...', ['Thank you for finding me.', "I don't know who asked for me. But I know who I'd ask for."]);
  if (r === 0) await c.say('hello', 'Thank you for finding me. In the Shallows. And every day after that.');
  else {
    await c.say('hello', "I don't know who asked for me. But I know who I'd ask for.");
    await c.say(null, 'Nobody says anything for a while. Again leans on your arm.');
  }
  await c.say(null, 'Then you all get up, and walk into the quiet.');
}

const WORDS: [string, number, number][] = [['SORRY', 3, 22], ['STAY', 24, 14], ['PROUD', 37, 25], ['GOODBYE', 17, 34]];

async function unsaidScene(c: Ctx) {
  await c.say('hello', 'We found these in the Wood. I think they are yours.');
  await c.say(null, 'The pale figure takes the four scraps and turns them over one at a time. Sorry. Stay. Proud. Goodbye.');
  await c.say(null, '"A man with a ladder came for my friend," it says. Its voice is rusty. "My friend went gladly. I stood at the treeline and did not say anything. I had four words and I did not say one."');
  await c.say(null, '"Sorry. Stay. Proud." It stops on the last one. "Goodbye."');
  await c.say(null, 'It says it toward the Line, which goes up out of sight above the trees, as if somebody up there might still be listening. Then it is quiet, and it is not the Wood\'s kind of quiet.');
  if (c.s.roster.someday) await c.say('someday', '...I knew a lot of men with ladders, sprout.');
  await c.say(null, '"He dropped this," says the figure, and holds out a page with a Lineman\'s stamp on it. "I kept it for him. You keep it now. And the words. They are said now. They are just words."');
  await page(c, 10);
  c.take('word', 4);
  await c.give('spokenword');
  await c.finish('unsaid');
  c.show('sitter', false);
}

// ---------------------------------------------------------------- the Unspoken Wood
const w = new Grid(40, 36, '.').frame(0, 0, 40, 36, 'Z');
w.rect(4, 15, 5, 4, 'Z').rect(12, 14, 4, 6, 'Z').rect(30, 15, 6, 4, 'Z').rect(5, 24, 6, 5, 'Z').rect(14, 30, 8, 3, 'Z')
  .rect(28, 24, 5, 6, 'Z').rect(34, 28, 4, 5, 'Z').rect(2, 31, 4, 3, 'Z');
w.frame(19, 20, 9, 9, 'Z').put(23, 20, '.').put(19, 24, '.').put(27, 24, '.');
w.scatter('m', 40, 621, '.', 1);
w.rect(0, 17, 1, 2, '.');
w.rect(1, 12, 38, 1, 'X').rect(1, 3, 38, 9, 'X').rect(10, 3, 1, 10, '.').rect(29, 3, 1, 10, '.');
w.rect(1, 1, 38, 2, '.').rect(19, 0, 2, 1, '.');
w.put(10, 10, 'Q').put(29, 5, 'Q');

const PLATES: [number, number][] = [[10, 10], [29, 5]];

// A raised stone slab. Pressed, it sinks into a dark socket wide enough to show around the feet.
function drawPlate(g: import('../core/gfx').Gfx, px: number, py: number, down: boolean) {
  if (down) {
    g.rect(px - 1, py, 10, 9, 'ink');
    g.rect(px + 1, py + 3, 6, 4, 'grey');
    g.rect(px + 3, py + 4, 2, 2, 'ink');
  } else {
    g.rect(px, py - 1, 8, 9, 'ink');
    g.rect(px + 1, py, 6, 5, 'white');
    g.rect(px + 1, py + 5, 6, 2, 'grey');
    g.rect(px + 3, py + 1, 2, 2, 'ink');
  }
}

const WOOD: MapDef = {
  id: 'wood', name: 'The Unspoken Wood', chapter: 6, music: undefined, bg: 'paper', battleBg: ['paper', 'silt'], hush: 'c6_hush', mode: (c) => (c.flag('c6_hush') ? null : 'blank'), weather: 'ash',
  rows: w.rows(), legend: WOODS,
  npcs: [
    { id: 'phone', x: 2, y: 21, sprite: P('object', 'payphone', 'slate', 'sky'), talk: (c) => c.payphone() },
    { id: 'gl', x: 10, y: 7, sprite: GATE, show: (c) => !c.standing(29, 5) },
    { id: 'gr', x: 29, y: 9, sprite: GATE, show: (c) => !c.standing(10, 10) },
    { id: 'both', x: 23, y: 24, sprite: BOTH, show: (c) => !c.flag('c6_both'), talk: (c) => bothScene(c) },
    {
      id: 'sitter', x: 33, y: 21, sprite: P('ghost', 'listener', 'white', 'grey'), prayer: 'Please let somebody notice me without my having to ask.',
      talk: async (c) => {
        if (c.q('unsaid') === 2 && c.flag('c6_hush')) { await unsaidScene(c); return; }
        if (c.qdone('unsaid')) { await c.say(null, 'The pale figure is gone. Where it sat, the grass is pressed flat, and there is a small warm patch, as if someone had only just stood up.'); return; }
        await c.say(null, c.flag('c6_hush') ? 'A pale figure sits against a tree. It opens its mouth, and then closes it. Sound is back, but it has nothing to say with it yet.' : '(A pale figure sits against a tree. When you sit down next to it, it smiles, without looking at you. That is all it wanted.)');
      },
    },
    ...WORDS.map(([w, x, y], i) => ({
      id: 'word' + i, x, y, sprite: P('slip', 'word' + i, 'paper', 'silt'), show: (c: Ctx) => !c.flag('word_' + i),
      talk: async (c: Ctx) => {
        c.set('word_' + i);
        await c.give('word', 1, true);
        await c.say(null, `(A scrap of paper, folded once. One word on it, in pencil, never said out loud: ${w}.)`);
        const n = WORDS.filter((_, k) => c.flag('word_' + k)).length;
        if (n === 1) await c.quest('unsaid');
        if (n === WORDS.length) { await c.say(null, '(That is four. Somewhere in the Wood, someone is still holding the rest of the sentence.)'); await c.quest('unsaid', 2); }
      },
    })),
  ],
  ferals: [{ x: 8, y: 21, group: 'wd1' }, { x: 17, y: 22, group: 'wd2' }, { x: 25, y: 17, group: 'wd3' }, { x: 36, y: 22, group: 'wd4' }, { x: 24, y: 33, group: 'wd5' }, { x: 11, y: 33, group: 'wd6' }, { x: 33, y: 24, group: 'wd1' }],
  digs: [
    { x: 6, y: 20, id: 'u_sorry', slip: 'sorry' },
    { x: 22, y: 15, id: 'u_quiet', slip: 'quiet' },
    { x: 37, y: 34, id: 'u_feast', item: 'feast' },
    { x: 9, y: 30, id: 'u_firstlast', slip: 'firstlast' },
    { x: 3, y: 2, id: 'u_honey', item: 'honey', n: 2 },
  ],
  draw: (g, cx, cy, c) => { for (const [x, y] of PLATES) drawPlate(g, x * 8 - cx, y * 8 - cy, c.standing(x, y)); },
  triggers: [
    { x: 10, y: 10, run: async (c) => { c.sfx('door'); } },
    { x: 29, y: 5, run: async (c) => { c.sfx('door'); } },
  ],
  exits: [
    { x: 0, y: 17, h: 2, to: 'wood_edge', tx: 24, ty: 11, dir: 3, blocked: async (c) => { if (c.field.partner) { await c.say(null, '(Not without Both.)'); await c.walk('hero', 'r', 6); return; } await c.goto('wood_edge', 24, 11, 3); } },
    {
      x: 19, y: 0, w: 2, to: 'wood_heart', tx: 14, ty: 28, dir: 0,
      blocked: async (c) => {
        const p = c.field.partner;
        if (p && p.y > 2) { await c.say(null, '(You wait at the edge of the clearing. Both is not through yet.)'); await c.walk('hero', 'd', 6); return; }
        c.merge();
        await c.goto('wood_heart', 14, 28, 0);
      },
    },
  ],
  enter: async (c) => {
    c.music(null);
    // Both's separate position is not saved, so a reload or a return trip puts Both back.
    if (c.flag('c6_both') && !c.flag('c6_hush') && !c.field.partner) {
      const hero = c.field.hero;
      // Past Hello's gate there is no way back down, so Both starts past its own gate too.
      if (hero.y <= 2) c.split(BOTH, hero.x + 1, hero.y);
      else if (hero.y < 9) c.split(BOTH, 29, 4);
      else c.split(BOTH, 29, 13);
    }
    if (c.flag('c6_woodin')) return;
    c.set('c6_woodin');
    await c.wait(30);
    await c.say(null, 'Sound stops at the treeline. Not quiet. Stopped. Your own footsteps do not make any.');
    await c.say('someday', '(Someday taps her ear and shakes her head.)');
    await c.say('bigger', '(Bigger opens his mouth to bark. Nothing comes out. He looks deeply betrayed.)');
    await c.say(null, 'In here, spoken skills will not work in battle. Party Line still does.');
  },
};

async function bothScene(c: Ctx) {
  await c.say(null, '(In a clearing stands a suit of armor with two heads. Both heads are open-mouthed, mid-shout, and perfectly silent.)');
  await c.say('first', '(The left head points at itself: me first.)');
  await c.say('firster', '(The right head points at itself harder: no, ME first.)');
  await c.say(null, '(They have been doing this, silently, for a very long time. Neither one has ever won.)');
  await c.say(null, '(The left head notices you. It points at you, then at itself, then at the other head. It wants you to decide.)');
  let r = await c.ask(null, '(Who is first?)', ['Point at the left head', 'Point at the right head', 'Point at both']);
  if (r !== 2) {
    await c.say(null, r === 0 ? '(The right head droops so far its helmet clanks against the shoulder.)' : '(The left head droops so far its helmet clanks against the shoulder.)');
    await c.say(null, '(It looks so sad that you cannot leave it like that.)');
    r = 2;
  }
  await c.say(null, '(You point at both. Both heads stare at you. Then they both nod, so hard the helmet rattles. A tie. Neither of them had ever thought of a tie.)');
  await c.say(null, '(The armor kneels. It points north, at the Line rising over the trees, and then at itself, and then at you. It is coming.)');
  c.set('c6_both');
  c.show('both', false);
  await c.join('both', Math.max(c.avgLevel(), 19));
  await c.say(null, "Both's heads are First and Firster. Each head takes its own action on Both's turn. Point both heads at the same foe and they hit harder together.");
  await c.say(null, '(North, a wall of thorns splits the path in two. Both points: they will take the right corridor. You take the left.)');
  await c.fadeOut();
  c.place('hero', 10, 13);
  c.face('hero', 'u');
  c.split(BOTH, 29, 13);
  await c.wait(10);
  await c.fadeIn();
  await c.say(null, 'The party splits up. Press Tab to switch between Hello and Both. With two players, player two steers Both with the arrow keys.');
}

// ---------------------------------------------------------------- the heart of the Wood
const h = new Grid(30, 30, '.').frame(0, 0, 30, 30, 'Z');
h.rect(2, 20, 5, 7, 'Z').rect(23, 20, 5, 7, 'Z').rect(2, 2, 5, 6, 'Z').rect(23, 2, 5, 6, 'Z').rect(14, 29, 2, 1, '.');
h.rect(13, 1, 4, 4, 'L').rect(14, 5, 2, 1, 'H').scatter('m', 25, 631, '.', 1);

const HEART: MapDef = {
  id: 'wood_heart', name: 'The Foot of the Line', chapter: 6, music: undefined, bg: 'paper', battleBg: ['paper', 'lilac'], hush: 'c6_hush', mode: (c) => (c.flag('c6_hush') ? null : 'blank'), weather: 'ash',
  rows: h.rows(), legend: WOODS,
  npcs: [
    { id: 'phone', x: 9, y: 26, sprite: P('object', 'payphone', 'slate', 'sky'), talk: (c) => c.payphone() },
    { id: 'hush', x: 14, y: 12, sprite: P('flyer', 'hushowl', 'dusk', 'lilac'), scale: 4, show: (c) => !c.flag('c6_hush') },
    { id: 'l1', x: 11, y: 6, sprite: LINEMAN, scale: 2, show: (c) => c.flag('c6_hush') && !c.flag('c6_gone') },
    { id: 'l2', x: 18, y: 6, sprite: LINEMAN, scale: 2, show: (c) => c.flag('c6_hush') && !c.flag('c6_gone') },
    { id: 'l3', x: 13, y: 7, sprite: LINEMAN, scale: 2, show: (c) => c.flag('c6_hush') && !c.flag('c6_gone') },
    { id: 'l4', x: 16, y: 7, sprite: LINEMAN, scale: 2, show: (c) => c.flag('c6_hush') && !c.flag('c6_gone') },
    { id: 'se_npc', x: 14, y: 15, sprite: SOMEONE, show: () => false },
    { id: 'bigger_npc', x: 15, y: 15, sprite: P('dog', 'bigger', 'gold', 'red'), scale: 2, show: () => false },
  ],
  triggers: [
    {
      x: 8, y: 18, w: 14, once: 'c6_hushev',
      run: async (c) => {
        await c.say(null, 'The trees open on a clearing so quiet it hurts. In the middle sits something like an owl made of the space between sounds.');
        await c.say('hushspk', '(It turns its head all the way around to look at you. It does not blink. It is not angry. It is just very, very tired of noise.)');
        await c.say(null, "(Someday raises her hook. Anyone puts a finger to her veil. Again takes Hello's hand.)");
        const r = await c.battle('hush', { music: 'quiet', scene: 'hush' });
        if (r !== 'win') { c.s.flags.c6_hushev = 0; return; }
        await afterHush(c);
      },
    },
    { x: 8, y: 9, w: 14, once: 'c6_betray', show: (c) => c.flag('c6_hush'), run: (c) => betrayal(c) },
  ],
  exits: [
    { x: 14, y: 29, w: 2, to: 'wood', tx: 19, ty: 1, dir: 2, blocked: async (c) => { if (c.flag('c6_gone')) { await c.say(null, 'There is no going back now.'); await c.walk('hero', 'u', 6); return; } await c.goto('wood', 19, 1, 2); } },
    {
      x: 14, y: 5, w: 2, to: 'line1', tx: 6, ty: 46, dir: 0, show: (c) => c.flag('c6_gone'),
      blocked: async (c) => { await c.fadeOut(); await c.card(7); await c.goto('line1', 6, 46, 0); },
    },
  ],
  enter: async (c) => { if (!c.flag('c6_hush')) c.music(null); },
};

async function afterHush(c: Ctx) {
  c.set('c6_hush');
  c.show('hush', false);
  await c.say(null, 'The Hush folds itself down to the size of a sparrow, and then to the size of a pause, and then it is gone.');
  c.music('field');
  c.sfx('ring');
  await c.say(null, 'And then, all at once: sound.');
  await c.say('firster', 'I WAS FIRST TO THE CLEARING.');
  await c.say('first', 'You were NOT. I was first. I was first by a FOOT.');
  await c.say('firster', 'You do not HAVE a foot. We SHARE the feet.');
  await c.say('again', "They're LOUD!");
  await c.say('bigger', 'LOUD! GOOD! WOOF! WOOF!');
  await c.say('anyone', 'The chorus is still gone. But this is not so bad.');
  await c.say('someday', "Line's dead ahead. Look at it.");
  await c.say(null, 'Past the clearing the Line rises out of the ground: a cable as thick as a tower, going straight up into the haze until it is too thin to see.');
  if (c.q('unsaid') === 2) await c.say('anyone', 'Hello. Those scraps of paper. Now that there is sound again, someone back in the Wood might want them.');
}

async function betrayal(c: Ctx) {
  c.music('tense');
  await c.say(null, 'At the foot of the Line, someone is waiting. Linemen, with ladders and nets, standing very still.');
  await c.say('someday', 'Back. Back, everyone.');
  await c.say('lineman', 'Thank you for your patience. Your guide has done very well.');
  c.place('se_npc', 14, 10);
  c.show('se_npc', true);
  await c.walk('se_npc', 'u', 10);
  await c.say(null, "Someone Else walks past you toward the Linemen. Their face flickers and settles into a smooth blank, like the Linemen's own.");
  await c.say('hello', 'Someone Else?');
  await c.say('someone', "I'm sorry. I really am. You were the nicest faces I ever wore.");
  await c.say('someone', 'Amen promised. Bring you to the Line, and he Returns me to my asker. As someone. As a real someone. Do you know what that is worth, to someone like me?');
  await c.say('lineman', 'Answers in this party. Hello: not eligible. Someday: Lineman Zero Four One One, deserter, to be processed. Everyone else: Return.');
  await c.say('lineman', 'Thank you for your patience.');
  const r = await c.battle('linemen', { music: 'boss', noFlee: true, intro: 'The Linemen unfold their ladders.' });
  if (r !== 'win') { c.s.flags.c6_betray = 0; return; }
  c.shake(30);
  await c.say(null, 'While you fight, nets come down from somewhere above. By the time you look up, Bigger is already fifty feet in the air, tangled, rising.');
  await c.say('bigger', 'HELLO! HELLO! BALL! HELLOOOO!');
  await c.say(null, 'A winch on the Line hauls him up into the haze. Someone Else is on the platform beside him, and does not look down.');
  c.show('se_npc', false);
  c.set('c6_gone');
  c.depart('bigger');
  c.depart('someone');
  await c.say('someday', 'They took him up. To the Catch.');
  await c.say('hello', 'Then we go up.');
  await c.say('anyone', 'Someone Else had the Line Pass. It is gone.');
  c.take('linepass');
  await c.say('someday', 'Doesn\'t matter. There are maintenance ladders all the way up. Linemen climbed them before there were lifts. I climbed them for four hundred years.');
  await c.say('someday', "Nobody's asking permission anymore.");
  await c.say('hello', "Nobody's asking permission anymore.");
  c.set('slip', Math.max(c.num('slip'), 6));
  await c.say(null, 'A ladder runs up the side of the Line, rung after rung, into the haze.');
}

export const CH6: MapDef[] = [EDGE, WOOD, HEART];
