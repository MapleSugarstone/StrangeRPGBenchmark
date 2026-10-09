// Optional areas, chapters 7 to the postgame: the Battlefield, the Moonbed, the Glass Desert, the Hands' Orchard, the Margin.
import { sfx } from '../engine/audio';
import { PEOPLE } from '../engine/sprites';
import { act, bell, choose, emote, face, faceToward, field, hint, narr, notice, say, shake, sound, wait, walkOff } from '../game/api';
import { G, flag, setFlag } from '../game/state';
import { defMap, defScript, MAPS, SCRIPTS } from '../game/world';
import { Canvas, kinds, link, look, reward, stash } from './areakit';

const DX = [0, 1, 0, -1], DY = [1, 0, -1, 0];
const pale = (id: string, c: [string, string]) => () => ({ px: (PEOPLE[id] || PEOPLE.villager).px, c });

// ---------------------------------------------------------------- the Battlefield: the soldier who marches in step

link('route7', 40, 0, '=', { to: 'battlefield', tx: 30, ty: 20, dir: 2 });

const bf = new Canvas(36, 22, '.').border('#').put(30, 21, '=');
bf.rect(2, 2, 8, 3, ',').rect(24, 2, 9, 3, ',').rect(2, 17, 10, 3, ',').rect(15, 17, 6, 3, ',').rect(26, 15, 7, 4, ',');
bf.rect(2, 15, 18, 1, 'l').put(9, 15, '.');
for (const [x, y] of [[4, 6], [8, 5], [15, 3], [19, 5], [33, 9], [2, 11], [16, 14], [21, 16], [33, 13]]) bf.put(x, y, 'p');
// Ouro's yard. Up and down are copied by the soldier, left and right are reversed.
const PY = { x: 6, y: 8 }, SY = { x: 23, y: 8 }, SOLDIER0 = { x: 26, y: 8 }, BED = { x: 28, y: 12 };
bf.frame(5, 7, 9, 7, 'f').rect(6, 8, 7, 5, '.').put(9, 13, '.');
for (const [x, y] of [[6, 0], [0, 2], [5, 3]]) bf.put(PY.x + x, PY.y + y, 'p');
bf.frame(22, 7, 9, 7, 'f').rect(23, 8, 7, 5, '.');
for (const [x, y] of [[2, 1], [3, 1], [4, 1], [5, 2], [6, 2], [5, 3], [0, 4]]) bf.put(SY.x + x, SY.y + y, 'p');
bf.put(BED.x, BED.y, 'b');

defMap({
  id: 'battlefield', name: 'The Old Field', region: 20, music: 'route',
  rows: bf.rows(),
  warps: [{ x: 30, y: 21, to: 'route7', tx: 40, ty: 1, dir: 0 }],
  zone: { kinds: kinds([['tang', 2], ['buckler', 2], ['destrier', 2], ['mangonel', 1], ['sallet', 2], ['fletch', 3]]), lv: [39, 43], n: 14, area: 'grass' },
  npcs: [
    { id: 'soldier', x: SOLDIER0.x, y: SOLDIER0.y, sprite: 'keeper', name: 'A soldier\'s cast', dir: 0, img: pale('keeper', ['#d8d4c8', '#a8a49a']), when: () => !flag('soldierDone'), talk: 'soldier' },
    { id: 'soldierbed', x: BED.x, y: BED.y, sprite: 'keeper', name: 'A soldier\'s cast', dir: 0, img: pale('keeper', ['#d8d4c8', '#a8a49a']), when: () => !!flag('soldierDone'), lines: ['(It lies on the bedroll with its arms at its sides. It is not marching.)'] },
    { id: 'lunch', x: 17, y: 10, sprite: 'villager2', name: 'Lunch-bringer', dir: 1, talk: 'lunch' },
    { id: 'fencer', x: 4, y: 3, sprite: 'keeper', name: 'Fencer', dir: 0, trainer: { name: 'Fencer', team: [['tang', 41], ['buckler', 41]], intro: 'The battle ended before my gran was born. Nobody told the swords. I\'m not gonna be the one.', defeat: 'Sheathed.', sight: 3 } },
    { id: 'archer', x: 28, y: 3, sprite: 'villager', name: 'Arrow-finder', dir: 3, trainer: { name: 'Arrow-finder', team: [['fletch', 41], ['sallet', 42]], intro: 'One arrow never came down. I wait under it. With a hat on. I\'m not daft.', defeat: 'Still up there. Probably.', sight: 4 } },
    { id: 'groom', x: 8, y: 18, sprite: 'tanner', name: 'Groom', dir: 1, trainer: { name: 'Groom', team: [['destrier', 42], ['mangonel', 42]], intro: 'I brush the war horses. They\'ve been whorls a hundred years and they still love a good brush.', defeat: 'Easy. Easy.', sight: 3 } },
  ],
  spots: [
    look(2, 11, 'A sword stands in the ground with a helmet hung on its hilt.', 'A snail has moved into the helmet. It wears it.'),
    look(15, 3, 'A banner on a blade. Its color is gone. It still faces the side it was for.'),
    stash('bf_pouch', 33, 13, 'Under a leaning blade, a buckled pouch, and in it a notion and some cowries.', { notion: 'edgecharm', rind: 500 }),
    stash('bf_trench', 9, 16, 'In the trench, under a plank, a tin of nacre nobody came back for.', { tan: 4 }),
  ],
});

const inYard = (x: number, y: number, yard: { x: number; y: number }) => x >= yard.x && x < yard.x + 7 && y >= yard.y && y < yard.y + 5;

field.stepHooks.push(f => {
  if (f.map.id !== 'battlefield' || flag('soldierDone')) return;
  const s = f.npcs.find(n => n.def.id === 'soldier');
  if (!s) return;
  if (!inYard(f.x, f.y, PY)) { s.x = SOLDIER0.x; s.y = SOLDIER0.y; return; }
  const d = f.lastStep;
  if (d < 0) return;
  const nx = s.x - DX[d], ny = s.y + DY[d];
  if (inYard(nx, ny, SY) && bf.at(nx, ny) !== 'p') { s.x = nx; s.y = ny; s.dir = d; }
  if (s.x === BED.x && s.y === BED.y) void f.runBusy(SCRIPTS.soldierRest);
});

defScript('soldier', async () => {
  await act('soldier', 'nod');
  await hint('The soldier copies each step Ouro takes in the other pen, the wrong way round.');
});

// The Lunch-bringer names a mealtime in every line.
defScript('lunch', async () => {
  if (flag('soldierDone')) { await say('Lunch-bringer', 'It\'s lying down now. I\'ll leave the noon bread by its head. It won\'t mind. It never eats it.'); return; }
  await say('Lunch-bringer', 'I bring it bread at noon. It marches round the bread. Every day. Round and round.');
  await say('Lunch-bringer', 'Its bedroll\'s right there in its pen. Not lain on it since breakfast, a hundred years back.');
  await say('Lunch-bringer', 'It copies whoever walks the other pen. Left for right. At supper it spooned air with me.');
  setFlag('lunchAsked');
});

defScript('soldierRest', async () => {
  setFlag('soldierDone');
  sfx('heal');
  // The soldier steps onto its bedroll, looks down at it, and lies down very straight.
  face('soldierbed', 0);
  await wait(30);
  await act('soldierbed', 'bow');
  await say('Lunch-bringer', 'Oh. There it goes. It can have its supper lying down, then :-]');
  await reward({ notion: 'spareskin', tan: 5 });
});

// ---------------------------------------------------------------- the Moonbed: the pools

const drain = [[3, 5, 10], [4, 4, 12], [5, 3, 14], [6, 3, 14], [7, 3, 14], [8, 3, 14], [9, 4, 12], [10, 5, 10]];
// The lake sits 7 tiles right and 6 down of where it was before the wood grew round it.
for (const [y, x, w] of drain) (MAPS.moonwater.mods ||= []).push({ x: x + 7, y: y + 6, w, ch: 'b', when: () => !!flag('fullDone') });
link('moonwater', 17, 13, 'q', { to: 'moonbed', tx: 15, ty: 19, dir: 2 }, () => !!flag('fullDone'));
MAPS.moonwater.npcs.push({ id: 'shorewoman', x: 10, y: 18, sprite: 'elder', name: 'Shore-woman', dir: 1, talk: 'shorewoman', when: () => !!flag('fullDone') });

const POOLS = [
  '.b.b.GP#.Pa',
  '.....aa..ba',
  '.bbb#.ba#..',
  'bba..a.bbaa',
  'a...ba#b.bb',
  '.Paba.bbaa.',
  '#.#babP..ba',
  'a..b#.a....',
  'b..aa.abbb.',
];
const POOL0 = { x: 10, y: 6 };
const mb = new Canvas(30, 22, 's').border('#').put(15, 20, 'q');
mb.rect(2, 15, 6, 5, ',').rect(22, 15, 6, 5, ',').rect(2, 2, 6, 4, ',').rect(23, 2, 5, 4, ',');
mb.frame(9, 5, 13, 11, '#').put(15, 15, 's').put(15, 5, 's');
mb.frame(12, 1, 7, 5, '#').rect(13, 2, 5, 3, 's').put(15, 5, 's');
const moonMods: NonNullable<Parameters<typeof defMap>[0]['mods']> = [];
POOLS.forEach((r, j) => [...r].forEach((c, i) => {
  const x = POOL0.x + i, y = POOL0.y + j;
  mb.put(x, y, c === '#' ? '#' : c === 'P' ? 'P' : 's');
  if (c === 'a') moonMods.push({ x, y, ch: '~', when: () => !flag('moonPhase') });
  if (c === 'b') moonMods.push({ x, y, ch: '~', when: () => !!flag('moonPhase') });
}));

defMap({
  id: 'moonbed', name: 'The Moonbed', region: 21, music: 'moonwater',
  rows: mb.rows(),
  mods: moonMods,
  warps: [{ x: 15, y: 20, to: 'moonwater', tx: 17, ty: 14, dir: 0 }],
  enter: 'moonbedEnter',
  zone: { kinds: kinds([['image', 2], ['skipper', 3], ['silt', 2], ['spawn', 2], ['lune', 1]]), lv: [42, 46], n: 12, area: 'silt' },
  npcs: [
    { id: 'reflection', x: 15, y: 3, sprite: 'elder', name: 'A reflection', dir: 0, img: pale('elder', ['#c8d0e8', '#9aa4c8']), when: () => !flag('reflectionHome'), talk: 'reflection' },
    { id: 'flakeboy', x: 4, y: 17, sprite: 'child', name: 'Flake boy', dir: 1, trainer: { name: 'Flake boy', team: [['lune', 44], ['skipper', 44]], intro: 'The moon dropped flakes when it climbed out. I\'m selling them back to it! Good price.', defeat: 'It never buys. Doesn\'t even haggle.', sight: 3 } },
    { id: 'siltwife', x: 25, y: 17, sprite: 'villager2', name: 'Silt-wife', dir: 3, trainer: { name: 'Silt-wife', team: [['silt', 44], ['spawn', 45]], intro: 'Under the water was cold. Under the silt\'s warm. So I live under the silt now. Obviously.', defeat: 'Back under.', sight: 3 } },
    { id: 'mirrorman', x: 25, y: 3, sprite: 'villager', name: 'Mirror-mender', dir: 3, trainer: { name: 'Mirror-mender', team: [['image', 45], ['lune', 45]], intro: 'Things the water showed are still lying about. I fix \'em. Put \'em back together.', defeat: 'Oops. That was the wrong face.', sight: 3 } },
  ],
  spots: [
    look(5, 3, 'The silt where the moon lay is pressed into a round hollow, smooth and pearly.'),
    look(26, 18, 'A flake off the moon\'s shell, flat and pearly. It is still a little cold.'),
    stash('mb_bowl', 15, 2, 'Behind the reflection, in the deepest silt, a nautilus horn and a cockle full of nacre.', { pegs: ['iron', 1], tan: 4 }),
  ],
});

field.stepHooks.push(f => {
  if (f.map.id !== 'moonbed' || f.tile(f.x, f.y) !== 'P') return;
  setFlag('moonPhase', flag('moonPhase') ? 0 : 1);
  sfx('wind');
});

defScript('moonbedEnter', async () => { setFlag('moonPhase', 0); });

// The Shore-woman speaks of her reflection as herself.
defScript('shorewoman', async () => {
  if (flag('reflectionHome')) { await say('Shore-woman', 'There I am! A bit muddy. I don\'t mind. Muddy suits me.'); return; }
  await say('Shore-woman', 'Every morning for sixty years I looked in the water. Hair, teeth, all that.');
  await say('Shore-woman', 'When the water went, I stayed in it. My reflection, I mean. I\'m down there on the bed.');
  await say('Shore-woman', 'The pools change when you step on the pale stones. Don\'t step on me, though.');
  setFlag('reflectionAsked');
});

defScript('reflection', async () => {
  // A pale woman lies on the silt, face up, looking at where the water used to be.
  await emote('reflection', 'silence');
  if (!flag('reflectionAsked')) return;
  // She sits up when Ouro says her name, and goes up the stair to the shore.
  await act('reflection', 'hop');
  faceToward('reflection', 'ouro');
  await wait(20);
  await walkOff('reflection', 15, 20);
  setFlag('reflectionHome');
  await reward({ notion: 'quickstone', tan: 3 });
});

// ---------------------------------------------------------------- the Glass Desert: the beam

link('route8', 43, 14, '=', { to: 'glassdesert', tx: 1, ty: 10, dir: 1 });

const BEAM = { x: 14, y: 6 }, PRISMS = [[18, 6], [24, 6], [18, 9], [24, 9]], DOOR = { x: 24, y: 13 };
const gd = new Canvas(34, 22, 's').border('#').put(0, 10, '=').put(30, 0, '=').put(30, 21, '=');
gd.rect(2, 2, 8, 4, ',').rect(2, 15, 9, 5, ',').rect(28, 2, 4, 6, ',').rect(28, 15, 4, 5, ',');
for (const [x, y, w] of [[3, 8, 6], [11, 17, 6], [28, 11, 4]]) gd.rect(x, y, w, 1, 'l');
for (const [x, y] of [[6, 12], [12, 2], [30, 9], [17, 18], [8, 19]]) gd.put(x, y, 'x');
gd.frame(13, 3, 15, 11, '#').rect(14, 4, 13, 9, 's').put(15, 13, 's');
gd.put(BEAM.x, BEAM.y, 'O');
for (const [x, y] of PRISMS) gd.put(x, y, 'R');
gd.put(DOOR.x, DOOR.y, 'j');
gd.frame(21, 13, 7, 5, '#').rect(22, 14, 5, 3, 's').put(DOOR.x, DOOR.y, 'j');

let beamKey = '', beamCache = new Set<number>(), beamLit = false;
/** Traces the starlight from the shard through the prisms. Returns the lit tiles. */
function beam(): Set<number> {
  const key = PRISMS.map((_, i) => flag('prism' + i)).join('');
  if (key === beamKey) return beamCache;
  beamKey = key;
  beamCache = new Set();
  beamLit = false;
  let x = BEAM.x, y = BEAM.y, dx = 1, dy = 0;
  for (let n = 0; n < 200; n++) {
    x += dx; y += dy;
    if (x === DOOR.x && y === DOOR.y) { beamLit = true; break; }
    const p = PRISMS.findIndex(([px, py]) => px === x && py === y);
    if (p >= 0) {
      if (flag('prism' + p)) [dx, dy] = [dy, dx];
      else [dx, dy] = [-dy, -dx];
      continue;
    }
    if (x < 14 || x > 26 || y < 4 || y > 12) break;
    beamCache.add(y * 34 + x);
  }
  return beamCache;
}
const gdMods: NonNullable<Parameters<typeof defMap>[0]['mods']> = [];
for (let y = 4; y <= 12; y++) for (let x = 14; x <= 26; x++) if (gd.at(x, y) === 's') gdMods.push({ x, y, ch: 'L', when: () => beam().has(y * 34 + x) });
PRISMS.forEach(([x, y], i) => gdMods.push({ x, y, ch: 'Q', when: () => !!flag('prism' + i) }));
gdMods.push({ x: DOOR.x, y: DOOR.y, ch: 's', when: () => { beam(); return beamLit; } });

defMap({
  id: 'glassdesert', name: 'The Glass Desert', region: 22, music: 'fall',
  rows: gd.rows(),
  mods: gdMods,
  warps: [
    { x: 0, y: 10, to: 'route8', tx: 42, ty: 14, dir: 3 },
    { x: 30, y: 0, to: 'hilt', tx: 28, ty: 28, dir: 2 },
    { x: 30, y: 21, to: 'fall', tx: 38, ty: 16, dir: 3 },
  ],
  zone: { kinds: kinds([['cullet', 2], ['telson', 2], ['cholla', 3], ['erg', 2], ['haze', 1], ['bonedry', 2]]), lv: [45, 49], n: 14, area: 'glass' },
  npcs: [
    { id: 'listener', x: 11, y: 11, sprite: 'elder', name: 'The Listener', dir: 1, talk: 'listener' },
    { id: 'glassblower', x: 5, y: 4, sprite: 'tanner', name: 'Glass-walker', dir: 0, trainer: { name: 'Glass-walker', team: [['cullet', 47], ['erg', 47]], intro: 'I walk the glass barefoot. It rings. I don\'t. I\'m very brave.', defeat: 'Ring, ring.', sight: 3 } },
    { id: 'scorpion', x: 30, y: 4, sprite: 'villager2', name: 'Shade-seeker', dir: 3, trainer: { name: 'Shade-seeker', team: [['telson', 47], ['cholla', 47]], intro: 'There\'s no shade out here. I keep looking. That\'s the job.', defeat: 'Oh, found some. It was you. Can you stand still?', sight: 3 } },
    { id: 'skullkid', x: 6, y: 17, sprite: 'child', name: 'Skull kid', dir: 1, trainer: { name: 'Skull kid', team: [['bonedry', 48], ['haze', 48]], intro: 'I found a skull! And it found me back!', defeat: 'Now it\'s sulking. Thanks.', sight: 4 } },
  ],
  spots: [
    { x: BEAM.x, y: BEAM.y, script: async () => { await act('ouro', 'back'); await emote('ouro', 'sweat'); } },
    ...PRISMS.map(([x, y], i) => ({ x, y, script: async () => {
      const c = await choose(['Turn it', 'Leave it'], true, 'A glass prism on a stand.');
      if (c !== 0) return;
      setFlag('prism' + i, flag('prism' + i) ? 0 : 1);
      sfx('switch');
      beam();
      if (beamLit && !flag('beamOpened')) {
        setFlag('beamOpened');
        await shake(15);
        bell(19);
        await emote('ouro', 'music');
      }
    } })),
    look(4, 13, 'Under the glass, footprints from before the sand melted. They are walking away from the star.'),
    stash('gd_bell', 24, 15, 'In the lit room, a glass bell with no clapper, and beside it a notion.', { notion: 'crownofhorn', tan: 4 }),
  ],
});

// The Listener names a sound in every line.
defScript('listener', async () => {
  if (flag('listenerDone')) { await say('The Listener', 'It\'s still ringing. I can hear it from here. Can you? You can\'t, can you.'); return; }
  if (flag('beamOpened')) {
    await say('The Listener', 'You lit the glass room! I heard it from right here.');
    await say('The Listener', 'Forty years I\'ve listened for that. It was a G. Lovely G.');
    setFlag('listenerDone');
    await reward({ tan: 3, rind: 600 });
    return;
  }
  await say('The Listener', 'There\'s a room under the glass. It used to ring when the star\'s light reached it.');
  await say('The Listener', 'Somebody moved the prisms and it\'s been quiet since. My eyes aren\'t good enough to fix them.');
});

// ---------------------------------------------------------------- the Hands' Orchard: the trained trees

link('climb', 15, 21, '=', { to: 'handsorchard', tx: 1, ty: 12, dir: 1 });

const TREES = [[11, 7], [15, 7], [19, 7], [11, 11], [15, 11], [19, 11], [11, 15], [15, 15], [19, 15]];
const START_WILD = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const wild = (i: number) => (START_WILD[i] ^ flag('ho' + i)) === 1;
const trained = () => TREES.every((_, i) => !wild(i));
const ho = new Canvas(30, 24, ',').border('#').put(0, 12, '=');
ho.frame(8, 1, 15, 4, '#').rect(9, 2, 13, 2, '.').put(15, 4, '#');
for (const [x, y] of TREES) ho.put(x, y, 'T');
ho.rect(9, 6, 13, 1, '.').rect(9, 9, 13, 1, '.').rect(9, 13, 13, 1, '.').rect(9, 17, 13, 1, '.');
for (const y of [5, 19]) ho.rect(3, y, 24, 1, 'i');
ho.put(15, 19, '=').put(15, 5, '.');

defMap({
  id: 'handsorchard', name: 'The Hands\' Orchard', region: 23, music: 'crown',
  rows: ho.rows(),
  mods: [
    ...TREES.map(([x, y], i) => ({ x, y, ch: 'k', when: () => wild(i) })),
    { x: 15, y: 4, ch: '=', when: trained },
  ],
  warps: [{ x: 0, y: 12, to: 'climb', tx: 14, ty: 21, dir: 3 }],
  zone: { kinds: kinds([['shears', 2], ['glove', 2], ['scion', 2], ['espalier', 2], ['rung', 2]]), lv: [52, 56], n: 12, area: 'orchard' },
  npcs: [
    { id: 'pruner', x: 13, y: 18, sprite: 'keeper', name: 'The Pruner', dir: 2, talk: 'pruner' },
    { id: 'grafter', x: 4, y: 9, sprite: 'grafter', name: 'Grafter', dir: 1, trainer: { name: 'Grafter', team: [['scion', 54], ['shears', 54]], intro: 'Grafton learned here. Then Grafton left. The trees are still kinda sore about it.', defeat: 'Well. Cut clean, at least.', sight: 3 } },
    { id: 'ladder', x: 25, y: 9, sprite: 'child', name: 'Ladder girl', dir: 3, trainer: { name: 'Ladder girl', team: [['rung', 54], ['espalier', 55]], intro: 'I carry the ladder for the Hands. Nobody\'s climbed it yet. I carry it anyway.', defeat: 'Fine. Up you go, then.', sight: 3 } },
    { id: 'glovesmith', x: 25, y: 21, sprite: 'villager2', name: 'Glovesmith', dir: 3, trainer: { name: 'Glovesmith', team: [['glove', 55], ['shears', 55]], intro: 'Every Hand wears a glove I made. Never shaken one. Not one hand. It\'s a bit sad.', defeat: 'Ooh. Firm grip.', sight: 3 } },
  ],
  spots: [
    ...TREES.map(([x, y], i) => ({ x, y, script: async () => {
      if (trained()) { await emote('ouro', 'silence'); return; }
      const c = await choose(['Prune it', 'Leave it'], true, wild(i) ? 'A tree gone wild, branches every way.' : 'A tree trained flat, branches in rows.');
      if (c !== 0) return;
      sfx('cut');
      for (const k of [i, i - 3, i + 3, i % 3 ? i - 1 : -1, i % 3 < 2 ? i + 1 : -1]) if (k >= 0 && k < 9) setFlag('ho' + k, flag('ho' + k) ? 0 : 1);
      if (trained()) { await shake(10); sound('fit'); await emote('ouro', 'music'); }
      else await emote('ouro', 'sweat');
    } })),
    look(15, 3, 'An inner garden. One tree in it, untrained, as big as a house, with five fingers for leaves.'),
    stash('ho_inner', 20, 2, 'Under the big tree, where the Hands sit to eat, a notion and a nautilus horn.', { notion: 'bodkin', pegs: ['iron', 1] }),
  ],
});

// The Pruner says what is tidy and how things are up here.
defScript('pruner', async () => {
  if (flag('prunerDone')) { await say('The Pruner', 'Tidy. That\'s how the Hands like it up here. Tidy tidy.'); return; }
  if (trained()) {
    await say('The Pruner', 'Tidy.');
    await say('The Pruner', 'I was a Hand before Purchase. I kept the trees. The Operculum kept me. Then it stopped.');
    setFlag('prunerDone');
    await reward({ tan: 5, rind: 800 });
    return;
  }
  await say('The Pruner', 'Three gone wild. Cut one back and its neighbors grow. That\'s how trees are up here.');
  await say('The Pruner', 'Get them all lying flat and the gate opens. That\'s how gates are up here.');
});

// ---------------------------------------------------------------- the Margin: the unmapped edge

link('slack', 39, 14, '.', { to: 'margin', tx: 1, ty: 14, dir: 1 });

const CORNERS = [[2, 2], [37, 2], [2, 27], [37, 27]];
const mg = new Canvas(40, 30, '.').border('v').put(0, 14, '.');
for (const [x, y, w, h] of [[6, 4, 5, 3], [16, 8, 4, 6], [27, 3, 6, 2], [9, 18, 7, 2], [24, 16, 3, 7], [31, 22, 5, 3], [14, 24, 4, 3]]) mg.rect(x, y, w, h, 'v');
for (const [x, y, w, h] of [[3, 9, 6, 4], [21, 4, 5, 3], [30, 9, 6, 5], [5, 22, 6, 4], [18, 20, 5, 3], [28, 25, 6, 3]]) mg.rect(x, y, w, h, ',');
for (const [x, y] of CORNERS) mg.put(x, y, 'u');

defMap({
  id: 'margin', name: 'The Margin', region: 24, music: 'slack', fog: true,
  rows: mg.rows(),
  warps: [{ x: 0, y: 14, to: 'slack', tx: 38, ty: 14, dir: 3 }],
  zone: { kinds: kinds([['nought', 2], ['terminus', 2], ['horizon', 1], ['murk', 3], ['undine', 1], ['lip', 2]]), lv: [60, 68], n: 16, area: 'blank' },
  npcs: [
    { id: 'cartographer', x: 3, y: 14, sprite: 'elder', name: 'Cartographer', dir: 1, talk: 'cartographer' },
    { id: 'blankman', x: 20, y: 15, sprite: 'villager', name: 'Blank', dir: 2, trainer: { name: 'Blank', team: [['nought', 64], ['murk', 64], ['terminus', 65]], intro: 'Nobody drew me in. So I stand where I like. Today it\'s here.', defeat: 'Draw that.', sight: 3 } },
    { id: 'edgewalker', x: 33, y: 7, sprite: 'tanner', name: 'Edge-walker', dir: 3, trainer: { name: 'Edge-walker', team: [['lip', 65], ['undine', 65], ['horizon', 66]], intro: 'I walk the edge every day. Edge moves an inch, I move an inch. Keeping up.', defeat: 'An inch further, then.', sight: 3 } },
  ],
  spots: CORNERS.map(([x, y], i) => ({ x, y, script: async () => {
    if (flag('corner' + i)) { await emote('ouro', 'silence'); return; }
    setFlag('corner' + i);
    sfx('spot');
    await emote('ouro', 'surprise');
    await notice(`Corners found: ${CORNERS.filter((_, k) => flag('corner' + k)).length} of 4.`);
  } })),
});

// The Cartographer talks about the world only as a map to be drawn.
defScript('cartographer', async () => {
  const n = CORNERS.filter((_, k) => flag('corner' + k)).length;
  if (flag('mapDone')) { await say('Cartographer', 'Four corners!! The edge of the map is the edge of the world. How very cooperative of it.'); return; }
  if (n < 4) {
    await say('Cartographer', 'Nobody has ever drawn the Margin. Most uncharted. You see only what you have walked.');
    await say('Cartographer', `Find the four corner posts and I shall draw the edge, perimetrically. You have ${n}.`);
    return;
  }
  await say('Cartographer', 'Four. Then it is a square, and the Volute is round. How cartographically peculiar.');
  sound('page');
  await act('cartographer', 'nod');
  await emote('cartographer', 'question');
  setFlag('mapDone');
  await reward({ pegs: ['iron', 2], tan: 6, notion: 'salttear' });
});

void G;
