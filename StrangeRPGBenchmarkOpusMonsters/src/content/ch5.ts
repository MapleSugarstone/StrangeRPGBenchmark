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
  zone: { kinds: [['crane', 3], ['turbine', 3], ['furnace', 3], ['orrery', 2], ['perigee', 1], ['fulgur', 2], ['piston', 2]], lv: [13, 15], n: 17, area: 'scrap' },
  npcs: [
    { id: 'tinker', x: 8, y: 14, sprite: 'tanner', name: 'Tinker', dir: 0, trainer: { name: 'Tinker', team: [['piston', 14], ['orrery', 14]], intro: 'These machines were the Riders\'. They shed their shells ages ago. The casts are still on shift.', defeat: 'Huh. They\'re still running. I\'m not.', sight: 3 } },
    { id: 'coaler', x: 18, y: 16, sprite: 'villager2', name: 'Coaler', dir: 2, trainer: { nacre: 1, name: 'Coaler', team: [['furnace', 14], ['crane', 14]], intro: 'A furnace cast stays warm for a century. I sleep right against it. Best sleep of my life.', defeat: 'Wonderful. Another cold night ahead.', sight: 3 } },
    { id: 'peel5', x: 30, y: 14, sprite: 'peeler', name: 'Hermit', dir: 0, trainer: { name: 'Hermit', team: [['gore', 14], ['quarry', 14]], intro: 'Pylon\'s next. She says it\'ll be tough. She\'s usually right about tough.', defeat: 'It\'s hard.', sight: 3 } },
    { id: 'watcher', x: 38, y: 16, sprite: 'elder', name: 'Watcher', dir: 2, trainer: { name: 'Watcher', team: [['perigee', 14], ['fulgur', 14], ['turbine', 15]], intro: 'See that? Satellite\'s cast. Fell in winter. We call it shellfall. I coined the term.', defeat: 'The rest of it is still orbiting up there, stripped of its shell. Brr.', sight: 4 } },
    { id: 'gatekeeper_n', x: 25, y: 28, sprite: 'keeper', name: 'Gatekeeper', dir: 3, talk: 'gateN' },
  ],
  spots: [
    stash('mf_nw', 3, 3, 'Behind the inert machine lies a sealed tin of Rider rations and a single cog.', { items: [['ridertin', 1]], notion: 'ridercog' }),
    stash('mf_se', 44, 26, 'Behind the other broken machine, two Rider tins are stacked as if waiting to be used later.', { items: [['ridertin', 2]] }),
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
    { id: 'h1', x: 9, y: 17, sprite: 'hummer', name: 'Woman', lines: ['Mm. Keep humming. If you stop, you\'ll miss the shift. Mmmm. Like that. You\'re a little flat.'] },
    { id: 'h2', x: 28, y: 16, sprite: 'villager2', name: 'Man', lines: ['The Riders constructed it, mm, and we drove it into the earth. It didn\'t object. We asked.'] },
    { id: 'h3', x: 24, y: 30, sprite: 'child', name: 'Child', wander: true, lines: ['Mmmm. I hum while I\'m asleep, Mum says. She also says I kick.'] },
    { id: 'h4', x: 11, y: 25, sprite: 'oldwoman', name: 'Old woman', lines: ['Mm. The pitch has dropped twice this year. Once for the Mast, once for the Bole.', 'I felt both in my teeth.'] },
    { id: 'zestp', x: 22, y: 14, sprite: 'zest', name: 'Tellin', dir: 0, when: () => has('pylon') && !flag('zestPylon') },
    { id: 'pp1', x: 19, y: 13, sprite: 'peeler', name: 'Hermit', when: () => has('pylon') && !flag('bareBeaten'), lines: ['Hold the line. Hold it. Alright, you can breathe now.'] },
    { id: 'pp2', x: 25, y: 13, sprite: 'peeler', name: 'Hermit', when: () => has('pylon') && !flag('bareBeaten'), lines: ['This one\'s loose. Feel that? No, don\'t touch it.'] },
    { id: 'pg', x: 21, y: 13, sprite: 'peeler', name: 'Hermit', when: () => has('pylon') && !flag('bareBeaten') && !flag('pgGone') },
    { id: 'eguard', blocks: true, x: 42, y: 17, dir: 0, sprite: 'hummer', name: 'Hummer', when: () => !flag('ch5done'), lines: ['Nobody travels east while the Pylon is out of tune. Mmmmm. Hear that? It\'s wrong.'] },
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
    { id: 'ohm1', x: 10, y: 4, sprite: 'boy', name: 'Conjoiner\'s boy', dir: 3, trainer: { nacre: 1, name: 'Conjoiner\'s boy', sight: 5, intro: 'Ohm makes notions. I\'ve worked here two years and Ohm\'s never said a whole sentence. Not one.', defeat: '...Yeah, alright. Me neither, now.', team: () => [withNotion('piston', 14, 'edgecharm'), withNotion('crane', 14, 'thornvest')] } },
    { id: 'ohm2', x: 3, y: 7, sprite: 'tanner', name: 'Tinker', dir: 1, trainer: { name: 'Tinker', sight: 5, intro: 'Right Whorl gets a notion, and the whole Whorl changes. Ohm showed me that. Didn\'t say a word.', defeat: 'Ohm\'s going to be quiet about this. Like, exceptionally quiet.', team: () => [withNotion('furnace', 14, 'embercoat'), withNotion('turbine', 14, 'waxseal')] } },
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
    { id: 'pyp1', x: 3, y: 8, sprite: 'peeler', name: 'Hermit', when: () => !flag('bareBeaten') && !flag('pypOut'), lines: ['She says, "Breathe out." So I breathe out. It doesn\'t help me, but I do it anyway.'] },
    { id: 'pyp2', x: 10, y: 8, sprite: 'peeler', name: 'Hermit', when: () => !flag('bareBeaten') && !flag('pypOut'), lines: ['It hums incorrectly when she touches it. It gives me the chills.'] },
  ],
});

// ---------------------------------------------------------------- scripts

defScript('route5Enter', async () => {
  if (!flag('ch5start')) { setFlag('ch5start'); goal('Head east across the machine fields to reach Hum.'); }
});

defScript('humEnter', async () => {
  G.flags.visited_hum = 1;
  if (!flag('humSeen')) {
    setFlag('humSeen');
    // A town round an enormous black ribbed machine that hums one note, and everybody in town hums it too.
    await pan(22, 10);
    await emote('ouro', 'music');
    await panBack();
    goal('Ohm holds the Pylon. The workshop lies to its west.');
  }
});

defScript('humTannery', async () => { setFlag('fitter_hum'); await tannery('hum', STOCK_5); });
defScript('pylonStay', async () => { await act('ouro', 'shiver'); await emote('ouro', 'music'); });

defScript('ohm', async () => {
  if (has('pylon')) { await say('Ohm', flag('bareBeaten') ? 'That\'s right.' : 'Pylon. Hermits. Now. Four point zero zero one dwems.'); return; }
  await say('Ohm', 'Correct.');
  const c = await choose(['Is that you, Ohm?', 'I want the pearl.']);
  void c;
  await say('Ohm', 'It is.');
  await say('Ohm', 'Four. Notions. Each. Two point two six skellets.');
  const r = await fightTrainer({ name: 'Ohm', ai: 'keeper', intro: '', defeat: '',
    team: () => [withNotion('turbine', 13, 'longshin'), withNotion('piston', 13, 'edgecharm'), withNotion('furnace', 14, 'embercoat'), withNotion('perigee', 14, 'bodkin')] });
  if (r.result !== 'win') return;
  await say('Ohm', 'Yes.');
  giveScale('pylon');
  giveNotion('salttear');
  await act('ohm', 'bow');
  await notice('Ouro claims the Pylon pearl and a Salt Tear.');
  await say('Ohm', 'No.');
  await choose(['No, what?']);
  await say('Ohm', 'Pylon. Hermits. Now. Eleven point three gallimots.');
  goal('The Hermits are waiting at the Pylon.');
});

defScript('zestPylon', async () => {
  await Promise.all([act('pp1', 'shiver'), act('pp2', 'shiver'), act('pg', 'shiver')]);
  faceToward('zestp', 'ouro');
  await say('Tellin', 'Oh, hey. Look who it is. I\'m ahead of you. You\'re just showing up now.');
  await say('Tellin', 'Things are going the way of the Bole, so...');
  const r = await fightTrainer({ name: 'Tellin', team: [['crane', 16], ['yoke', 16], ['thumb', 16], ['gore', 17]], intro: '', defeat: '', ai: 'keeper' });
  if (r.result !== 'win') return;
  await say('Tellin', 'Okay, fine, I\'m behind. No big deal. Totally fine. I\'m slipping around the back. Stay out of my way.');
  // Tellin walks round the Pylon and out of sight.
  await walkOff('zestp', 36, 8);
  setFlag('zestPylon');
  // Bare's voice comes out through a gap in the Pylon's casing, too small for a person. She is inside, wearing a whorl.
  await pan(22, 12);
  await emote('ouro', 'question');
  await say('Bare', 'Arms in first. Then the head. That\'s it.');
  await say('Bare', 'Now exhale. And push through.');
  await say('Hermit', 'Uh, she was talking to herself. Don\'t mimic her.');
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
  await hint('(Press C to equip or remove your lead Whorl. Its type determines which terrain you can traverse.)');
  await hint('(STONE crosses fractures. A fracture is a crack. TIDE walks on water. ROOT moves through thickets.)');
  await hint('(GEAR passes through dead machines. BEAST climbs ledges. STAR illuminates dark areas.)');
  goal('Pass through the gap in the Pylon.');
});

defScript('barePylon', async () => {
  await say('Bare', 'Alright. Stop right there.');
  await say('Bare', 'Take that off. You\'ll need your arms free for this.');
  field.wearing = false;
  await say('Bare', 'Go on, deploy your first.');
  const r = await fightTrainer({ name: 'Bare', team: [['carrion', 16], ['undertow', 16], ['hemlock', 16], ['quarry', 17]], intro: '', defeat: '', ai: 'keeper' });
  if (r.result !== 'win') return;
  await say('Bare', 'That\'s enough. Lower your tools. Everything.');
  await say('Bare', 'Everyone out. Watch your heads as you go.');
  await Promise.all([walkOff('pyp1', 7, 13), (async () => { await wait(10); await walkOff('pyp2', 7, 13); })()]);
  setFlag('pypOut');
  await say('Bare', 'Hey. Turn around.');
  await say('Bare', 'Place your hand on the back of your neck.');
  face('ouro', (field.dir + 2) % 4);
  await wait(20);
  await act('ouro', 'shiver');
  await emote('ouro', 'surprise');
  await say('Bare', 'This is the Mast and the Bole.');
  await say('Bare', 'Tally the Seals. See what remains.');
  await say('Bare', 'Go on, then. Spare another one.');
  await walkOff('barep', 7, 13);
  setFlag('bareBeaten');
  await wait(20);
  await warp('hum', 22, 13, 0);
  // The note is steady again. The Shellwright brings Ouro a letter sealed with the Apex's black spiral.
  await emote('ouro', 'music');
  await walkUp('tanner');
  sound('page');
  giveKey('letter');
  await notice('Ouro receives a letter bearing a black spiral seal.');
  await say('Letter', 'The Volute must hold. You won\'t get thanked twice. Signed, Cinch.');
  await say('Shellwright', 'Hm. Never seen an Apex letter come through here. Hm. You keep it. Maybe frame it.');
  await walkTo('tanner', 15, 15);
  setFlag('ch5done');
  goal('Head east toward the tundra and Tusk. Turnstone is just a cart ride away.');
});
