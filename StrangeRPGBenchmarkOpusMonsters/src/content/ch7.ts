import { defMap, defScript } from '../game/world';
import { G, flag, setFlag } from '../game/state';
import { act, bell, choose, emote, faceToward, fadeWho, field, fightTrainer, fightWild, giveMon, giveScale, goal, mon, moveNpc, narr, notice, offstage, pan, panBack, say, shake, sound, tannery, tint, wait, walkIn, walkOff } from '../game/api';
import { giveKeyItem } from './ring';
import { SPAWNS } from '../game/world';
import { music } from '../engine/music';
import { sfx } from '../engine/audio';
import { packGround, stayChoice, STOCK_6 } from './ch6';

const has = (s: string) => G.scales.includes(s);
const hiltDown = () => G.pulled.includes('hilt');
const ROW = (inner: string) => '#' + inner + '#';

defMap({
  id: 'route7', name: 'The Hilt road', region: 7, music: 'hiltroad',
  rows: [
    '########################################=#######',
    '#T..T....T......T..x..T....x.......x....=...T..#',
    '#.x.T.........T.........x.x.....T....T..=......#',
    '#.TT.........T.....rrrrrrrrr...x........=......#',
    '#........T.....x..Trrrrrrrrr........,,,.=.T....#',
    '#.xxx.,,,,,..x.....rrrrrrrrr.....,,,,,,.=.,,...#',
    '#T.,,,,,,,,,,,.x...hhhhdhhhh....,,,,,,,.=.,,,..#',
    '#.,,,,,,,,,,,,,.T................,,,,,,.=.,,...#',
    '#..,,,,,,,,,,,..T..x..T=............,,,.=.....T#',
    '#.....,,,,,.T..........=.....T.....T....=...Tx.#',
    '#.T.....Tx.x...........=..T..x....x.....=.....T#',
    '#....T..T.....T........=..........T.....=..T...#',
    '#.......T.T............=......T..T.T..x.=......#',
    '#......................=................=......#',
    '================================================',
    '#...............=..............................#',
    '#...........x...=.T.........x..T.T..T..........#',
    '#........T......=.................TTT....T....x#',
    '#..T...xT.xx.x..=............T..T......x....T..#',
    '#.....T..,,,....=......TTx....T....,,,...TT.T..#',
    '#..x.T,,,,,,,,,.=..x............,,,,,,,,,...T..#',
    '#...T,,,,,,,,,,.=.T......T.....,,,,,,,,,,,T....#',
    '#..x,,,,,,,,,,,.=.....T.......,,,,,,,,,,,,,.TT.#',
    '#.T..,,,,,,,,,,.=..............,,,,,,,,,,,x..T.#',
    '#T....,,,,,,,,,.=........T..TT..,,,,,,,,,......#',
    '#.T.....T,,,....=......T..T........,,,...T.....#',
    '#....x....T.....=.T.....x..........T...TT......#',
    '#..T.......x..T.=.x.....T..........TT.....x....#',
    '#...TT..........=....x....T.......xx....T......#',
    '################=###############################',
  ],
  warps: [
    { x: 0, y: 14, to: 'tusk', tx: 38, ty: 30, dir: 3 },
    { x: 47, y: 14, to: 'hilt', tx: 1, ty: 15, dir: 1 },
    { x: 23, y: 6, to: 'peelhouse', tx: 8, ty: 14, dir: 2 },
    { x: 16, y: 29, to: 'moonwater', tx: 18, ty: 1, dir: 2, when: () => !!flag('pithBeaten') },
  ],
  zone: { kinds: [['gore', 3], ['thumb', 2], ['quarry', 2], ['portent', 2], ['plinth', 2], ['grotto', 2]], lv: [19, 21], n: 16, area: 'rubble', fitted: 0.25 },
  npcs: [
    { id: 'guard7', x: 10, y: 13, sprite: 'keeper', name: 'Guard', dir: 0, trainer: { name: 'Guard', team: [['menhir', 20], ['gore', 20]], intro: 'The Hilt is under guard. I am the guard. I am the entire guard.', defeat: 'That is, I was the entire guard.', sight: 4 } },
    { id: 'pilgrim7', x: 30, y: 13, sprite: 'elder', name: 'Pilgrim', dir: 0, trainer: { name: 'Pilgrim', team: [['plinth', 20], ['portent', 20]], intro: 'There are conjoined whorls roaming free out here now. Two shells fused into one. Naturally!', defeat: 'Both halves are gone. A terrible day for halves.', sight: 4 } },
    { id: 'peel7', x: 24, y: 15, sprite: 'peeler', name: 'Hermit', dir: 2, trainer: { nacre: 1, name: 'Hermit', team: [['grotto', 20], ['quarry', 20]], intro: 'Moonwater is flowing tonight. Everyone is going. Bring a towel.', defeat: 'Very well. You are going too, then.', sight: 3 } },
    { id: 'smith', x: 36, y: 15, sprite: 'tanner', name: 'Smith', dir: 2, trainer: { name: 'Smith', team: [['thumb', 20], ['gore', 20], ['crane', 20]], intro: 'Folks ask if it\'s sharp. It\'s a Seal! Sharpness isn\'t the point. I\'m the smith. I\'d know.', defeat: 'Go look for yourself, then.', sight: 4 } },
    { id: 'mwguard', blocks: true, x: 16, y: 28, sprite: 'peeler', name: 'Hermit', when: () => !flag('pithBeaten'), lines: ['Moonwater is closed. Murex says so. If you want to argue, Murex is in the Hermitage.'] },
  ],
  enter: 'route7Enter',
});

defMap({
  id: 'peelhouse', name: 'The Hermitage', region: 11, indoor: true, music: 'peel',
  rows: [
    '##################',
    '#________________#',
    '#_OO_OO_OO_OO____#',
    '#________________#',
    '#_cccc____cccc___#',
    '#________________#',
    '#_pp___pp____pp__#',
    '#________________#',
    '#_cccc____cccc___#',
    '#________________#',
    '#_OO_OO____OO_OO_#',
    '#________________#',
    '#________________#',
    '#________________#',
    '#________________#',
    '########dd########',
  ],
  warps: [{ x: 8, y: 15, to: 'route7', tx: 23, ty: 7, dir: 0 }, { x: 9, y: 15, to: 'route7', tx: 23, ty: 7, dir: 0 }],
  npcs: [
    { id: 'pith', x: 8, y: 1, sprite: 'pith', name: 'Murex', talk: 'pith' },
    { id: 'wall', x: 15, y: 1, sprite: 'sign', name: null as any, lines: ['Painted on the wall: a spiral shell with a dark crack running down the front.', 'Below it, in smaller letters: WIPE FEET.'] },
    { id: 'ph1', x: 5, y: 7, sprite: 'peeler', name: 'Hermit', dir: 1, trainer: { name: 'Hermit', team: [['leech', 20], ['carrion', 20]], intro: 'We pry old shells off the rocks in here. The late ones watch. So they can see how it comes off.', defeat: 'See? That is how it comes off.', sight: 5 } },
    { id: 'ph2', x: 12, y: 11, sprite: 'peeler', name: 'Hermit', dir: 3, trainer: { nacre: 1, name: 'Hermit', team: [['portent', 20], ['mycel', 20], ['undertow', 20]], intro: 'Bare is down by the water. Murex is at the door.', defeat: 'Murex is still at the door. Murex is always at the door.', sight: 5 } },
  ],
});

defMap({
  id: 'moonwater', name: 'The Moonwater', region: 7, music: 'moonwater',
  rows: [
    'TTTTTTTTTTTTTTTTTT=TTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTT...TTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTT...TTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTT...TTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTT...TTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTT...TTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTT...TTTTTTTTTTTTTTTT',
    'TTTTTTTT..........=...............TT',
    'TTTTTTTT..........................TT',
    'TTTTTTTT....~~~~~~~~~~............TT',
    'TTTTTTTT...~~~~~~~~~~~~...........,T',
    'TTTTTTTT..~~~~~~~~~~~~~~......,...TT',
    'TTTTTTTT..~~~~~~~~~~~~~~.....,,,..TT',
    'T.........~~~~~~~~~~~~~~.....,,,..TT',
    'j========.~~~~~~~~~~~~~~....,,,,,.TT',
    'T..........~~~~~~~~~~~~.....,,,,,.TT',
    'TTTTTTTT....~~~~~~~~~~......,,,,,.TT',
    'TTTTTTTT.....................,,,..TT',
    'TTTTTTTT.....................,,,..TT',
    'TTTTTTTT......................,...TT',
    'TTT,,,TT..........................TT',
    'TT,,,,,TT....................TTTTTTT',
    'T,,,,,,,.....................,,,TTTT',
    'TT,,,,,TT....................,,,,TTT',
    'TTT,,,TTT....................,,,,,TT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTT,,,,,TTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTT,,,TTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  mods: [{ x: 0, y: 14, ch: '=', when: () => !!flag('gate_e') }],
  warps: [{ x: 18, y: 0, to: 'route7', tx: 16, ty: 28, dir: 0 }],
  npcs: [
    { id: 'barem', x: 17, y: 17, sprite: 'bare', name: 'Bare', dir: 2, when: () => !flag('fullDone') },
    { id: 'fullm', onSolid: true, x: 16, y: 12, sprite: 'stone', mon: 'full', name: 'Full', when: () => !!flag('fullRisen') && !flag('fullCaught') },
    { id: 'mp1', x: 10, y: 10, sprite: 'peeler', when: () => !flag('fullDone') },
    { id: 'mp2', x: 23, y: 10, sprite: 'peeler', when: () => !flag('fullDone') },
    { id: 'mp3', x: 9, y: 15, sprite: 'peeler', when: () => !flag('fullDone') },
    { id: 'mp4', x: 24, y: 15, sprite: 'peeler', when: () => !flag('fullDone') },
    { id: 'mh1', x: 12, y: 18, sprite: 'stone', mon: 'yoke', when: () => !flag('fullDone') },
    { id: 'mh2', x: 21, y: 18, sprite: 'stone', mon: 'crane', when: () => !flag('fullDone') },
    { id: 'gatekeeper_e', x: 2, y: 13, sprite: 'keeper', name: 'Gatekeeper', dir: 3, talk: 'gateE' },
  ],
  enter: 'moonwaterEnter',
});
SPAWNS.moonwater = [18, 1];

defMap({
  id: 'hilt', name: 'Hilt', region: 7, music: 'town', oldShells: true,
  rows: [
    '########################################',
    '#......................................#',
    '#.......rrrrrrrrr......................#',
    '#.......rrrrrrrrr......................#',
    '#.......rrrrrrrrr...........============',
    '#.......hhhhdhhhh...........=..........#',
    '#...........=...............=..........#',
    '#...........=...............=..rrrrrr..#',
    '#...........=...............=..rrrrrr..#',
    '#...........=.......B.......=..hhdhhh..#',
    '#...........=.....BBBBB.....=..........#',
    '#...........=.......b.......=..........#',
    '#...ccc.....=......bbb......=..........#',
    '#...........=...............=..........#',
    '#...........=...............=..........#',
    '========================================',
    '#...........=...............=..........#',
    '#...........=...............=..........#',
    '#.rrrrr.....=....rrrrrr.....=..........#',
    '#.rrrrr.....=....rrrrrr.....=..rrrrr...#',
    '#.hhdhh.....=....hhdhhh.....=..rrrrr...#',
    '#...........=...............=..hhhhh...#',
    '#...........=...............=..........#',
    '#...........=...............=..........#',
    '#.rrr.......=...rrrrr.......=..........#',
    '#.rrr.......=...rrrrr.......=..........#',
    '#.hhh......,=..,hhdhh,....,.=....,.....#',
    '#...,.......=.,,....,,......=.,...,....#',
    '#,..........=.....,..,......=..........#',
    '############=###############=###########',
  ],
  mods: [
    // After Full the blade shows under the crossguard. Pulled, the sword falls flat along the square and leaves a slot.
    { x: 20, y: 11, ch: 'B', when: () => !!flag('fullCaught') && !hiltDown() },
    { x: 20, y: 9, ch: '.', when: hiltDown }, { x: 18, y: 10, w: 5, ch: '.', when: hiltDown }, { x: 20, y: 11, ch: 'O', when: hiltDown },
    { x: 14, y: 13, w: 13, ch: 'B', when: hiltDown },
  ],
  warps: [
    { x: 0, y: 15, to: 'route7', tx: 46, ty: 14, dir: 3 },
    { x: 12, y: 5, to: 'hiltgym', tx: 6, ty: 10, dir: 2 },
    { x: 33, y: 9, to: 'smithy', tx: 4, ty: 6, dir: 2 },
    { x: 12, y: 29, to: 'route8', tx: 22, ty: 1, dir: 0, when: () => !!flag('chose_hilt') },
    { x: 28, y: 29, to: 'glassdesert', tx: 30, ty: 1, dir: 0, when: () => !!flag('chose_hilt') },
    { x: 39, y: 4, to: 'shingle', tx: 6, ty: 24, dir: 1 },
  ],
  tileTalk: { B: 'hiltStay', O: 'hiltHole', d: 'shutDoor' },
  npcs: [
    { id: 'tanner', x: 5, y: 11, sprite: 'tanner', name: 'Shellwright', talk: 'hiltTannery' },
    { id: 'g1', x: 16, y: 9, sprite: 'keeper', name: 'Guard', lines: () => flag('fullCaught') ? ['We\'ve stood watch over it for two hundred years, and tonight it\'s finally moving.', 'I\'ve never seen a protocol for that. I checked.'] : ['Our job is to guard the sword.', 'No living soul has laid eyes on the blade, which is exactly why we\'re so good at our jobs.'] },
    { id: 'g2', x: 8, y: 17, sprite: 'villager', name: 'Woman', lines: ['The blade is visible! No one alive has ever seen the blade, and now I have!'], when: () => !!flag('fullCaught') },
    { id: 'g3', x: 22, y: 23, sprite: 'child', name: 'Child', wander: true, lines: ['I actually touched it. It\'s not even sharp. I\'m never washing this hand again.'] },
    { id: 'g4', x: 3, y: 23, sprite: 'elder', name: 'Old man', lines: ['Wild conjoined whorls are on the road now. Two shells fused into one. Never seen it before.', 'Must be the moon.'] },
    { id: 'sguard', blocks: true, x: 13, y: 28, dir: 3, sprite: 'keeper', name: 'Guard', when: () => !flag('chose_hilt'), lines: ['The crater road heads south. Quillon insists no one passes until the sword is accounted for.', 'And so, no one passes.'] },
    // Quillon and a Hermit by the sword after Quillon's fight.
    { id: 'quillonOut', x: 16, y: 12, sprite: 'quillon', name: 'Quillon', when: () => !!flag('hiltScene') },
    { id: 'hp1', x: 23, y: 11, sprite: 'peeler', name: 'Hermit', dir: 3, when: () => !!flag('hiltScene') },
    { id: 'seguard', blocks: true, x: 29, y: 28, dir: 3, sprite: 'keeper', name: 'Guard', when: () => !flag('chose_hilt'), lines: ['The glass road is to the south-east. Same rule. Sword first, then glass. Quillon\'s very firm.'] },
  ],
  enter: 'hiltEnter',
});
SPAWNS.hilt = [20, 16];

defMap({
  id: 'hiltgym', name: 'The guardhouse', region: 7, indoor: true, music: 'gym',
  rows: [
    '##############',
    '#____________#',
    '#_p__p__p__p_#',
    '#____________#',
    '#____________#',
    '#_cccc__cccc_#',
    '#____________#',
    '#____________#',
    '#____________#',
    '#____________#',
    '#____________#',
    '######dd######',
  ],
  warps: [{ x: 6, y: 11, to: 'hilt', tx: 12, ty: 6, dir: 0 }, { x: 7, y: 11, to: 'hilt', tx: 12, ty: 6, dir: 0 }],
  npcs: [
    { id: 'quillon', x: 6, y: 1, sprite: 'quillon', name: 'Quillon', talk: 'quillon' },
    { id: 'drill1', x: 3, y: 7, sprite: 'keeper', name: 'Sword drill', dir: 1, trainer: { name: 'Sword drill', team: [['stoat', 20], ['carrion', 20]], intro: 'Finish them while they\'re down, or they\'ll return. They always return.', defeat: 'Came back.', sight: 5 } },
    { id: 'drill2', x: 10, y: 4, sprite: 'keeper', name: 'Sword drill', dir: 2, trainer: { name: 'Sword drill', team: [['hemlock', 20], ['gore', 21]], intro: 'Certain moves kill outright if the target is below a certain line. Count their HP. Always count.', defeat: 'Ah. I must have miscounted.', sight: 3 } },
  ],
});

// ---------------------------------------------------------------- scripts

defScript('route7Enter', async () => {
  if (!flag('ch7start')) { setFlag('ch7start'); goal('The Hermitage sits on the road to the Hilt. The Moonwater is located just south of that point.'); }
});

defScript('pith', async () => {
  if (flag('pithBeaten')) { await say('Murex', 'Have you ever... seen the moon rise out of a lake?'); return; }
  await say('Murex', 'Are you the... late one? From the Pylon?');
  await say('Murex', 'Did you... uh... count the Seals? Like she instructed?');
  await say('Murex', 'Do you know how many kids in Tusk have shed over the last ten years? Want to take a guess?');
  await say('Murex', 'Shall we fight? Or would you prefer to keep standing there for a while longer?');
  const r = await fightTrainer({ name: 'Murex', team: [['leech', 19], ['mycel', 19], ['portent', 19], ['grotto', 20]], intro: '', defeat: '', ai: 'keeper' });
  if (r.result !== 'win') return;
  setFlag('pithBeaten');
  await say('Murex', 'Have you ever watched the moon rise from a lake? Would you like to see it? Tonight?');
  await say('Murex', 'Then why not go and look?');
  await say('Hermit', 'Here. Take a harness. We have plenty.');
  await giveKeyItem('haul', 'Ouro receives the haul, along with a harness and a long rope.');
  goal('Head south from the Hilt road toward the Moonwater.');
});

defScript('moonwaterEnter', async () => {
  if (flag('fullCaught')) return;
  if (!flag('fullRisen')) {
    // A round black lake below the Hilt, the Hermits all round its edge with every harnessed whorl they have.
    await pan(16, 12);
    await say('Bare', 'Easy now. All of you.');
    await say('Bare', 'Lift it.');
    void Promise.all(['mp1', 'mp2', 'mp3', 'mp4', 'mh1', 'mh2'].map(id => act(id, 'shiver')));
    field.shakeT = 60;
    sfx('boom');
    await wait(50);
    // Full, the moon's first shell, rises out of the lake with the water held up round it in a wall.
    setFlag('fullRisen');
    await Promise.all([fadeWho('fullm', true, 50), act('fullm', 'lift'), tint('#e8f0ff', 0.3, 30)]);
    await tint('#e8f0ff', 0, 30);
    // Up the slope, the Hilt groans and lifts a span out of the ground.
    sound('boom');
    await shake(30);
    await Promise.all([emote('mp1', 'surprise'), emote('mp4', 'surprise')]);
    music.bend();
    await panBack();
    await say('Bare', 'Pull. Keep pulling. Don\'t look at it. Just pull.');
    await choose(['Catch it', 'Fight it.']);
  }
  if (G.pegs.twig + G.pegs.brass + G.pegs.bone + G.pegs.iron === 0) G.pegs.brass += 1;
  const r = await fightWild(mon('full', 22), { scripted: 'full', canRun: false, bossHp: 2, ai: 'keeper' });
  if (r.result !== 'win' && !r.pegged.length) {
    sound('hitBig');
    await tint('#3060a0', 0.5, 10);
    await tint('#3060a0', 0, 30);
    await act('ouro', 'shiver');
    return;
  }
  setFlag('fullCaught');
  const full = r.pegged[0] || mon('full', 22);
  await giveMon(full);
  sound('hitBig');
  field.shakeT = 20;
  await tint('#3060a0', 0.5, 10);
  await Promise.all([tint('#3060a0', 0, 30), ...['mp1', 'mp2', 'mp3', 'mp4', 'barem'].map(id => act(id, 'shiver'))]);
  await say('Bare', 'Hold it tight.');
  await choose(['You aren\'t taking it?']);
  await say('Bare', 'Head up to the Hilt.');
  await say('Bare', 'Walk.');
  const later = (n: number, id: string) => (async () => { await wait(n); await walkOff(id, 18, 0); })();
  await Promise.all([later(0, 'mp1'), later(6, 'mp2'), later(12, 'mp3'), later(18, 'mp4'), later(24, 'mh1'), later(30, 'mh2'), later(60, 'barem')]);
  setFlag('fullDone');
  goal('Head to Hilt, at the east end of the road.');
});

defScript('hiltEnter', async () => { G.flags.visited_hilt = 1; });
defScript('hiltTannery', async () => { setFlag('fitter_hilt'); await tannery('hilt', STOCK_6); });
defScript('hiltStay', async () => { if (hiltDown()) bell(14); await emote('ouro', hiltDown() ? 'music' : 'silence'); });
defScript('hiltHole', async () => { await emote('ouro', 'question'); });

defScript('quillon', async () => {
  if (has('hilt')) { await say('Quillon', 'Head south to Fall, and unfortunately, you\'ll hit the incline next.'); return; }
  if (!flag('fullCaught')) { await say('Quillon', 'You want my pearl? First, you\'ll have to come back from the Moonwater. Ideally, dripping wet.'); return; }
  await say('Quillon', 'If you\'re the one from the Moonwater, then you\'re carrying the moon in a horn!');
  await say('Quillon', 'If you would duel me, you must do so with it out. That is my condition.');
  await say('Quillon', 'If you lose, I take nothing. If you win, you get the pearl. And a biscuit.');
  const r = await fightTrainer({ name: 'Quillon', team: [['stoat', 20], ['carrion', 20], ['gore', 20], ['hemlock', 21]], intro: '', defeat: '', ai: 'keeper' });
  if (r.result !== 'win') return;
  await say('Quillon', 'If that concludes matters, then it\'s yours, won fairly!');
  giveScale('hilt');
  await notice('Ouro claims the Hilt pearl.');
  setFlag('hiltScene');
  field.warp('hilt', 17, 12, 1);
  offstage('quillonOut');
  // The sword stands loose in its hole with a span of blade showing, and a Hermit waits by it with a haul.
  await walkIn('quillonOut', 12, 5, 16, 12);
  faceToward('quillonOut', 'ouro');
  await act('hp1', 'nod');
  await stayChoice('hilt', async () => {
    await say('Quillon', 'If we fill the hole now, it\'ll hold. I\'ve got a spade. Actually, two spades.');
    await say('Hermit', 'Or we could just pull it out. It\'s halfway there already.');
  }, async () => {
    await packGround('quillonOut', 'g1');
    faceToward('quillonOut', 'ouro');
    await say('Quillon', 'If it lasts through the night, then it stays. Then, breakfast.');
  }, async () => {
    bell(14);
    await act('ouro', 'shiver');
    faceToward('quillonOut', 'ouro');
    await say('Quillon', 'If that\'s what you wanted, then here it is, along with the ringing.');
  });
  await Promise.all([walkOff('hp1', 31, 4), walkOff('quillonOut', 12, 5)]);
  setFlag('hiltScene', 0);
  goal('Travel south from Hilt, crossing the crater fields to reach Fall.');
});
