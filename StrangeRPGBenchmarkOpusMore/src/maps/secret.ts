// The room for undeliverable mail, its one occupant, and the call it makes possible.
import { Grid } from './grid';
import { MapDef, t } from './types';
import type { Ctx } from '../game/ctx';
import { saveMeta } from '../game/state';

const dm = new Grid(16, 14, '.').frame(0, 0, 16, 14, 'R');
dm.rect(1, 1, 14, 2, 'R').rect(1, 5, 2, 6, 'R').rect(13, 5, 2, 6, 'R').put(7, 13, '+').put(8, 13, '+');

export const DEADMAIL: MapDef = {
  id: 'deadmail', name: 'Undeliverable', chapter: 9, music: 'secret', bg: 'ink', battleScene: 'amen', mode: () => 'eerie', weather: 'letters',
  rows: dm.rows(),
  legend: { '.': t.floor('bone', 'silt', 'floor'), R: t.solid('slips', 'navy', 'paper'), '+': t.deco('door', 'slate', 'paper') },
  light: () => ({ ambient: 0.55, lights: [[7, 4, 30], [8, 4, 30]] }),
  npcs: [{ id: 'heap', x: 7, y: 4, sprite: { t: 'mouth', seed: 'ledger412', a: 'paper', b: 'slate' }, scale: 4, show: (c) => !c.flag('secret_412') }],
  triggers: [{ x: 3, y: 7, w: 10, once: 'c9_heapev', show: (c) => !c.flag('secret_412'), run: (c) => heap(c) }],
  exits: [{ x: 7, y: 13, w: 2, to: 'returnyard', tx: 28, ty: 36, dir: 3 }],
  enter: async (c) => {
    if (c.flag('c9_dmin')) return;
    c.set('c9_dmin');
    await c.say(null, 'A long low room, walled in letters. Every one is stamped UNDELIVERABLE, and every one is still sealed.');
    await c.say(null, 'Something at the far end is reading names under its breath.');
  },
};

async function heap(c: Ctx) {
  c.music(null);
  await c.say(null, 'It is a heap of torn ledger paper, taller than Bigger, and it is reading itself aloud. Mabel Two-Step. Orrin. The Quiet Hour. A Second Chance.');
  await c.say(null, 'When it gets to the end, it starts again at the top.');
  await c.say('anyone', 'These are the four hundred and twelve. The ones Someday carried.');
  if (c.s.roster.again) await c.say('again', 'It keeps doing the same part over. I know that one.');
  if (c.s.roster.bigger) await c.say('bigger', 'SMELLS LIKE SOMEDAY.');
  await c.say(null, 'The heap stops reading. A page lifts from the top of it and turns toward you, the way a face would.');
  await c.say(null, '"Did we arrive?" it asks. "She never read the last line. Did we arrive?"');
  await c.say('hello', 'I have her pages. All of them. Let me read you the margins.');
  await c.say(null, '"Read them," says the heap. "If you can get to the end."');
  const r = await c.battle('ledger412', { music: 'final', noFlee: true, scene: 'amen' });
  if (r !== 'win') { c.s.flags.c9_heapev = 0; return; }
  c.set('secret_412');
  c.show('heap', false);
  c.music('lullaby');
  await c.say(null, 'The last page settles. The room is very quiet. The letters on the walls are still sealed, but they look less like they are waiting.');
  await c.say(null, 'Under where the heap was, there is an old armband, the kind Linemen wore on the Line, with 0411 stitched into it.');
  await c.give('ledgerband');
  await c.say('anyone', 'Hello. The lines are strange here. There is one open that should not be. It goes up. All the way up.');
  await c.say(null, 'Any payphone can reach it now.');
}

const CALLS = [
  "Still here, sprout. Still nice. Somebody up here plays the same song on the radio every morning. I think it might be on purpose.",
  "You keep calling. Good. Nobody ever called me before you. It turns out I like it.",
  "Go on, sprout. Get some sleep. Whatever tomorrow is, it will be there in the morning.",
];

export async function callSomeday(c: Ctx) {
  c.music(null);
  c.sfx('dial');
  if (c.flag('called_someday')) {
    await c.say(null, 'You dial. It rings twice.');
    await c.say('someday', CALLS[c.num('someday_calls') % CALLS.length]);
    c.inc('someday_calls');
    c.music(c.field.map.music ?? null);
    return;
  }
  c.set('called_someday');
  await c.say(null, 'You dial a number nobody taught you. It rings for a long time. You let it.');
  await c.wait(60);
  await c.say(null, 'Click.');
  await c.say('someday', '...Sprout?');
  await c.say('hello', 'Hello.');
  await c.say('someday', 'Hello yourself. Six years and you still say it like you are picking up a call. You are the one calling, this time.');
  await c.say('hello', 'Where are you?');
  await c.say('someday', 'Up. It is quiet up here. Not empty. Quiet. Like the Shallows the hour before the Asking.');
  await c.say('someday', 'I found the little one. Long grown, long gone. Had a family. One of the grandkids still prays sometimes, for nobody in particular. I listen in.');
  await c.say('hello', 'I found your ledger. All twelve pages.');
  await c.wait(40);
  await c.say('someday', '...You read the margins.');
  await c.say('hello', 'I read them out loud. To the four hundred and twelve. All of them, to the end.');
  await c.wait(60);
  await c.say('someday', 'Thank you, sprout.');
  const r = await c.ask('hello', '...', ['Can you come back?', 'Are you okay?']);
  if (r === 0) await c.say('someday', 'No. That is all right. Not everything comes back down. Some things just get where they were going.');
  else await c.say('someday', 'I am better than okay. I am done. That is a different thing, and it is a good one.');
  await c.say('someday', 'Call me sometime.');
  await c.say('hello', 'I am calling.');
  await c.say('someday', 'Ha. So you are.');
  await c.say(null, 'The line stays open a little longer than it needs to. Then it clicks.');
  const meta = c.game.meta;
  if (!meta.endings.includes('someday')) { meta.endings.push('someday'); saveMeta(meta); }
  c.music(c.field.map.music ?? null);
}
