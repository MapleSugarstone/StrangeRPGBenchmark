import { defMap, defScript } from '../game/world';
import { G, flag, setFlag } from '../game/state';
import { act, choose, emote, face, faceToward, field, fightTrainer, giveKey, giveNotion, giveScale, goal, hint, moveNpc, narr, notice, pan, panBack, say, sound, tannery, wait, walkOff, walkTo, walkUp, warp } from '../game/api';
import { stash } from './areakit';
import { SPAWNS } from '../game/world';
import { makeMon } from '../data/species';
import { STOCK_4 } from './ch4';

const has = (s: string) => G.scales.includes(s);
export const STOCK_5 = [...STOCK_4, 'bloodglass', 'thornvest', 'waxseal', 'edgecharm', 'salttear', 'bodkin', 'embercoat'];

function withNotion(kind: string, lv: number, notion: string) { const m = makeMon(kind, lv); m.notion = notion; return m; }

defMap({
  id: 'route5', name: 'The machine fields', region: 5, music: 'machine',
  rows: [
    '####################=###########################',
    '#TTTTT.T......T...T.=....T....T........T.......#',
    '#T...T.TT...........=................T.........#',
    '#T...m.T,,,.........=.......T.T....,,,.........#',
    '#T...T,,,,,,,,..mmm.=..T..T.....,,,,,,,,,..T.T.#',
    '#TTTTT,,,,,,,,,.mmm.=.......T..,,,,,,,,,,,.....#',
    '#..,,,,,,,,,,,,,....=...T.....,,,,,,,,,,,,,...T#',
    '#TT.,,,,,,,,,,,T.T..=.....T....,,,,,,,,,,,.....#',
    '#...T,,,,,,,,,T.....=......T..T.,,,,,,,,,......#',
    '#.......,,,.........=.........mmm..,,,........T#',
    '#..T.T......TT......=..T.T....mmm..............#',
    '#...............T...=...............T..TT...T..#',
    '#...T...T.......T...=.......T..........TT..T...#',
    '#T...T......T.....T.=...T......................#',
    '#...................=..........................#',
    '================================================',
    '#.......................=......................#',
    '#T......................=..........T....T...T..#',
    '#.T....T.......T........=............T........T#',
    '#..TT.mmm...............=..T..T.T.......mmm...T#',
    '#..T..mmm..,,,T......TT.=.......T.,,,...mmm....#',
    '#.T..T.,,,,,,,,,,,......=..T...,,,,,,,,,.....T.#',
    '#.....,,,,,,,,,,,,,...T.=.m...,,,,,,,,,,,......#',
    '#....,,,,,,,,,,,,,,,..T.=.m..,,,,,,,,,,,TTTTTTT#',
    '#..T..,,,,,,,,,,,,,.....=...T.,,,,,,,,,,m......#',
    '#....T.,,,,,,,,,,,T.....=.T....,,,,,,,,,m......#',
    '#.......T..,,,T..TT..T..=.T.......,,,...m......#',
    '#T.....TT..T............=............T..m......#',
    '#...T...................=.........T...T.m......#',
    '########################j#######################',
  ],
  mods: [{ x: 24, y: 29, ch: '=', when: () => !!flag('gate_n') }],
  warps: [
    { x: 0, y: 15, to: 'bole', tx: 42, ty: 3, dir: 3 },
    { x: 47, y: 15, to: 'hum', tx: 1, ty: 18, dir: 1 },
  ],
  zone: { kinds: [['crane', 3], ['turbine', 3], ['furnace', 3], ['orrery', 2], ['perigee', 1], ['fulgur', 2], ['piston', 2]], lv: [26, 30], n: 17, area: 'scrap' },
  npcs: [
    { id: 'tinker', x: 8, y: 14, sprite: 'tanner', name: 'Tinker', dir: 0, trainer: { name: 'Tinker', team: [['piston', 27], ['orrery', 27]], intro: 'These machines were the Riders\'. They turned ages ago. The casts are still on shift.', defeat: 'Huh. They\'re still working. I\'m not.', sight: 3 } },
    { id: 'coaler', x: 18, y: 16, sprite: 'villager2', name: 'Coaler', dir: 2, trainer: { name: 'Coaler', team: [['furnace', 28], ['crane', 27]], intro: 'A furnace cast stays warm for a hundred years. I sleep right up against one. Best sleep of my life.', defeat: 'Great. Cold sleep tonight.', sight: 3 } },
    { id: 'peel5', x: 30, y: 14, sprite: 'peeler', name: 'Hermit', dir: 0, trainer: { name: 'Hermit', team: [['gore', 28], ['quarry', 28]], intro: 'Pylon\'s next. She says that one\'ll be hard. She\'s usually right about hard.', defeat: 'It\'s hard.', sight: 3 } },
    { id: 'watcher', x: 38, y: 16, sprite: 'elder', name: 'Watcher', dir: 2, trainer: { name: 'Watcher', team: [['perigee', 28], ['fulgur', 28], ['turbine', 29]], intro: 'See that? Satellite\'s cast. Fell in the winter. We call it shellfall. I said it first.', defeat: 'The rest of it\'s still up there. Going round with no shell on. Brr.', sight: 4 } },
    { id: 'gatekeeper_n', x: 25, y: 28, sprite: 'keeper', name: 'Gatekeeper', dir: 3, talk: 'gateN' },
  ],
  spots: [
    stash('mf_nw', 3, 3, 'Behind the dead machine, a tin of Rider rations, still sealed, and a cog.', { items: [['ridertin', 1]], notion: 'ridercog' }),
    stash('mf_se', 44, 26, 'Behind the other dead machine, two Rider tins stacked as if for later.', { items: [['ridertin', 2]] }),
  ],
  enter: 'route5Enter',
});

defMap({
  id: 'hum', name: 'Hum', region: 5, music: 'hum', oldShells: true,
  rows: [
    '######################=#####################',
    '#~~~~~~~~~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~~~~#',
    '#.....................j....................#',
    '#..........................................#',
    '========............................========',
    '#......=..........BBBBBBBBB.........=......#',
    '#..rrrrrrr........BBBBBBBBB....rrrrrr......#',
    '#..rrrrrrr........BBBBBBBBB....rrrrrr......#',
    '#..hhhdhhh........BBBBdBBBB....hhhdhh......#',
    '#......=..............=.............=......#',
    '#....==================================....#',
    '#.....................=....................#',
    '#.............ccc.....=....................#',
    '#.....................=....................#',
    '============================================',
    '#.....................=....................#',
    '#.....................=....................#',
    '#..rrrrr..rrr.........=.......rrrrrr..rrr..#',
    '#..rrrrr..rrr.........=.......rrrrrr..rrr..#',
    '#..hhdhh..hhh.........=.......hhhdhh..hhh..#',
    '#.....................=....................#',
    '#.....................=....................#',
    '#...........rrrrr.....=...rrrrr............#',
    '#...........rrrrr.....=...rrrrr............#',
    '#...........hhdhh.....=...hhhhh............#',
    '#....,............,...=.,....,.,,,,........#',
    '#......,........,....,=............,.....,.#',
    '#.......,......,...,.,=....,..........,....#',
    '#.......,,,....,.,...,=...,............,.,.#',
    '######################=#####################',
  ],
  warps: [
    { x: 0, y: 18, to: 'route5', tx: 46, ty: 15, dir: 3 },
    { x: 0, y: 8, to: 'gantry', tx: 46, ty: 14, dir: 3 },
    { x: 6, y: 12, to: 'humgym', tx: 6, ty: 10, dir: 2 },
    { x: 34, y: 12, to: 'humtrader', tx: 4, ty: 6, dir: 2 },
    { x: 22, y: 12, to: 'pylon', tx: 7, ty: 12, dir: 2, when: () => !!flag('wearing') && !flag('bareBeaten') },
    { x: 43, y: 18, to: 'route6', tx: 1, ty: 28, dir: 1, when: () => !!flag('ch5done') },
    { x: 43, y: 8, to: 'floes', tx: 1, ty: 18, dir: 1, when: () => !!flag('ch5done') },
  ],
  tileTalk: { B: 'pylonStay', d: 'shutDoor' },
  npcs: [
    { id: 'tanner', x: 15, y: 15, sprite: 'tanner', name: 'Shellwright', talk: 'humTannery' },
    { id: 'h1', x: 9, y: 17, sprite: 'hummer', name: 'Woman', lines: ['Mm. Keep humming. Stop and you can\'t hear it change. Mmmm. Like that. You\'re a bit flat.'] },
    { id: 'h2', x: 28, y: 16, sprite: 'villager2', name: 'Man', lines: ['The Riders built it, mm, and we stuck it in the ground. It didn\'t mind. We asked.'] },
    { id: 'h3', x: 24, y: 30, sprite: 'child', name: 'Child', wander: true, lines: ['Mmmm. I hum in my sleep. Mum says. She also says I kick.'] },
    { id: 'h4', x: 11, y: 25, sprite: 'oldwoman', name: 'Old woman', lines: ['Mm. The note\'s dropped twice this year. Once for the Mast, once for the Bole. My teeth felt both.'] },
    { id: 'zestp', x: 22, y: 14, sprite: 'zest', name: 'Tellin', dir: 0, when: () => has('pylon') && !flag('zestPylon') },
    { id: 'pp1', x: 19, y: 13, sprite: 'peeler', name: 'Hermit', when: () => has('pylon') && !flag('bareBeaten'), lines: ['Hold the haul. Hold it. Okay, you can breathe.'] },
    { id: 'pp2', x: 25, y: 13, sprite: 'peeler', name: 'Hermit', when: () => has('pylon') && !flag('bareBeaten'), lines: ['This one\'s loose. Feel that? No, don\'t touch it.'] },
    { id: 'pg', x: 21, y: 13, sprite: 'peeler', name: 'Hermit', when: () => has('pylon') && !flag('bareBeaten') && !flag('pgGone') },
    { id: 'eguard', blocks: true, x: 42, y: 17, dir: 0, sprite: 'hummer', name: 'Hummer', when: () => !flag('ch5done'), lines: ['Nobody goes east while the Pylon\'s wrong. Mmmmm. Hear that? Wrong.'] },
  ],
  triggers: [{ x: 20, y: 15, w: 5, h: 2, script: 'zestPylon', when: () => has('pylon') && !flag('zestPylon') }],
  enter: 'humEnter',
});
SPAWNS.hum = [22, 20];

defMap({
  id: 'humgym', name: 'Ohm\'s workshop', region: 5, indoor: true, music: 'gym',
  rows: [
    '##############',
    '#____________#',
    '#_cc_cc_cc_cc#',
    '#____________#',
    '#____________#',
    '#_cc_cc_cc_cc#',
    '#____________#',
    '#____________#',
    '#____________#',
    '#____________#',
    '#____________#',
    '######dd######',
  ],
  warps: [{ x: 6, y: 11, to: 'hum', tx: 6, ty: 13, dir: 0 }, { x: 7, y: 11, to: 'hum', tx: 6, ty: 13, dir: 0 }],
  npcs: [
    { id: 'ohm', x: 6, y: 1, sprite: 'ohm', name: 'Ohm', talk: 'ohm' },
    { id: 'ohm1', x: 10, y: 4, sprite: 'boy', name: 'Conjoiner\'s boy', dir: 3, trainer: { name: 'Conjoiner\'s boy', sight: 5, intro: 'Ohm makes notions. I\'ve worked here two years and Ohm\'s never said a whole sentence. Not one.', defeat: '...Yeah okay. Me neither, now.', team: () => [withNotion('piston', 27, 'edgecharm'), withNotion('crane', 27, 'thornvest')] } },
    { id: 'ohm2', x: 3, y: 7, sprite: 'tanner', name: 'Tinker', dir: 1, trainer: { name: 'Tinker', sight: 5, intro: 'Put a notion on the right whorl and it\'s a whole other whorl. Ohm taught me that. Didn\'t say a word.', defeat: 'Ohm\'s gonna be quiet about this. Like, extra quiet.', team: () => [withNotion('furnace', 28, 'embercoat'), withNotion('turbine', 28, 'waxseal')] } },
  ],
});

defMap({
  id: 'pylon', name: 'Inside the Pylon', region: 5, indoor: true, music: 'bare', dark: false,
  rows: [
    '##############',
    '#mmmm____mmmm#',
    '#m__________m#',
    '#m___mmmm___m#',
    '#____m__m____#',
    '#m___mmmm___m#',
    '#m__________m#',
    '#mm___mm___mm#',
    '#____________#',
    '#_m________m_#',
    '#____________#',
    '#____________#',
    '#____________#',
    '######_d######',
  ],
  warps: [{ x: 7, y: 13, to: 'hum', tx: 22, ty: 13, dir: 0 }],
  npcs: [
    { id: 'barep', x: 7, y: 6, sprite: 'bare', name: 'Bare', dir: 0, talk: 'barePylon', when: () => !flag('bareBeaten') },
    { id: 'pyp1', x: 3, y: 8, sprite: 'peeler', name: 'Hermit', when: () => !flag('bareBeaten') && !flag('pypOut'), lines: ['Breathe out, she says. So I breathe out. Doesn\'t help me any, but I do it.'] },
    { id: 'pyp2', x: 10, y: 8, sprite: 'peeler', name: 'Hermit', when: () => !flag('bareBeaten') && !flag('pypOut'), lines: ['It hums wrong when she touches it. Gives me the shivers.'] },
  ],
});

// ---------------------------------------------------------------- scripts

defScript('route5Enter', async () => {
  if (!flag('ch5start')) { setFlag('ch5start'); goal('Go east across the machine fields to Hum.'); }
});

defScript('humEnter', async () => {
  G.flags.visited_hum = 1;
  if (!flag('humSeen')) {
    setFlag('humSeen');
    // A town round an enormous black ribbed machine that hums one note, and everybody in town hums it too.
    await pan(22, 10);
    await emote('ouro', 'music');
    await panBack();
    goal('Ohm keeps the Pylon. The workshop is west of it.');
  }
});

defScript('humTannery', async () => { setFlag('fitter_hum'); await tannery('hum', STOCK_5); });
defScript('pylonStay', async () => { await act('ouro', 'shiver'); await emote('ouro', 'music'); });

defScript('ohm', async () => {
  if (has('pylon')) { await say('Ohm', flag('bareBeaten') ? 'Yes.' : 'Pylon. Hermits. Now. Four point nought nought one dwems.'); return; }
  await say('Ohm', 'Yes.');
  const c = await choose(['Are you Ohm?', 'I want the pearl']);
  void c;
  await say('Ohm', 'Yes.');
  await say('Ohm', 'Four. Notions. Each. Two point two six skellets.');
  const r = await fightTrainer({ name: 'Ohm', ai: 'keeper', intro: '', defeat: '',
    team: () => [withNotion('turbine', 26, 'longshin'), withNotion('piston', 26, 'edgecharm'), withNotion('furnace', 27, 'embercoat'), withNotion('perigee', 27, 'bodkin')] });
  if (r.result !== 'win') return;
  await say('Ohm', 'Yes.');
  giveScale('pylon');
  giveNotion('salttear');
  await act('ohm', 'bow');
  await notice('Ouro gets the Pylon pearl and a Salt Tear.');
  await say('Ohm', 'No.');
  await choose(['No what?']);
  await say('Ohm', 'Pylon. Hermits. Now. Eleven point three gallimots.');
  goal('The Hermits are at the Pylon.');
});

defScript('zestPylon', async () => {
  await Promise.all([act('pp1', 'shiver'), act('pp2', 'shiver'), act('pg', 'shiver')]);
  faceToward('zestp', 'ouro');
  await say('Tellin', 'Oh hey hey, you again, okay, I\'m winning, you\'re just arriving, it\'s going the way of the Bole, so.');
  const r = await fightTrainer({ name: 'Tellin', team: [['crane', 25], ['yoke', 25], ['thumb', 25], ['gore', 26]], intro: '', defeat: '', ai: 'keeper' });
  if (r.result !== 'win') return;
  await say('Tellin', 'Okay so I\'m losing, that\'s fine, that\'s totally fine, I\'m going round the back, nobody follow me.');
  // Tellin walks round the Pylon and out of sight.
  await walkOff('zestp', 36, 8);
  setFlag('zestPylon');
  // Bare's voice comes out through a gap in the Pylon's casing, too small for a person. She is inside, wearing a whorl.
  await pan(22, 12);
  await emote('ouro', 'question');
  await say('Bare', 'Arms in first. Then the head. That\'s it.');
  await say('Bare', 'Now breathe out. And through you go.');
  await say('Hermit', 'Uh, she was saying that to herself. Don\'t copy her.');
  await panBack();
  await walkOff('pg', 6, 18);
  setFlag('pgGone');
  // Ouro climbs into the lead whorl of the four, arms first, then the head.
  faceToward('ouro', 'whorl');
  await act('whorl', 'hop');
  sound('shield');
  setFlag('wearing');
  field.wearing = true;
  await act('ouro', 'shiver');
  await hint('(Press C to wear your lead whorl or take it off. Its type decides what ground you can cross.)');
  await hint('(STONE crosses crazes. A craze is a crack. TIDE walks on water. ROOT goes through thickets.)');
  await hint('(GEAR passes dead machines. BEAST climbs ledges. STAR lights up dark places.)');
  goal('Go through the gap in the Pylon.');
});

defScript('barePylon', async () => {
  await say('Bare', 'Okay. Stop there.');
  await say('Bare', 'Take that off. You\'ll want your arms for this.');
  field.wearing = false;
  await say('Bare', 'Go on, send out your first.');
  const r = await fightTrainer({ name: 'Bare', team: [['carrion', 25], ['undertow', 25], ['hemlock', 25], ['quarry', 26]], intro: '', defeat: '', ai: 'keeper' });
  if (r.result !== 'win') return;
  await say('Bare', 'Enough. Tools down. All of it.');
  await say('Bare', 'All of you, out. Watch your heads on the way.');
  await Promise.all([walkOff('pyp1', 7, 13), (async () => { await wait(10); await walkOff('pyp2', 7, 13); })()]);
  setFlag('pypOut');
  await say('Bare', 'Hey. Turn around for me.');
  await say('Bare', 'Put your hand on the back of your neck.');
  face('ouro', (field.dir + 2) % 4);
  await wait(20);
  await act('ouro', 'shiver');
  await emote('ouro', 'surprise');
  await say('Bare', 'That\'s the Mast and the Bole.');
  await say('Bare', 'Count the Stays. Count what\'s left.');
  await say('Bare', 'Go on, then. Save another one.');
  await walkOff('barep', 7, 13);
  setFlag('bareBeaten');
  await wait(20);
  await warp('hum', 22, 13, 0);
  // The note is steady again. The Shellwright brings Ouro a letter sealed with the Apex's black spiral.
  await emote('ouro', 'music');
  await walkUp('tanner');
  sound('page');
  giveKey('letter');
  await notice('Ouro gets a letter with a black spiral seal.');
  await say('Letter', 'The Volute has to hold. You will not be thanked twice. Cinch.');
  await say('Shellwright', 'Mm. Never had a letter from the Apex come through here. Mm. You keep that. Frame it, maybe.');
  await walkTo('tanner', 15, 15);
  setFlag('ch5done');
  goal('Go east to the tundra and Tusk. Turnstone is a cart ride away.');
});
