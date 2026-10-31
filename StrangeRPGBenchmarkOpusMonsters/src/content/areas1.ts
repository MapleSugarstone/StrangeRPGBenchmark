// Optional areas, chapters 1 to 3: the Undermeadow, the Knucklebones, the Wrecks, the Shoreline.
import { PEOPLE } from '../engine/sprites';
import { act, choose, emote, face, faceToward, field, narr, notice, say, sound, wait, walkOff } from '../game/api';
import { sfx } from '../engine/audio';
import { rect } from '../engine/screen';
import { defProp } from '../game/props';
import { flag, setFlag } from '../game/state';
import { defMap, defScript, MAPS } from '../game/world';
import { GRAPH_PUZZLES, type Move } from '../tools/worldcheck';
import { addKinds, kinds, link, look, reward, rows, stash } from './areakit';
import { prize } from './puzzlekit';

// ---------------------------------------------------------------- new kinds in the old zones

addKinds('fellside', [['dandle', 2], ['mawkin', 1]]);
addKinds('route1', [['fleam', 2], ['vat', 2], ['wain', 1]]);
addKinds('route2', [['urchin', 2], ['fiddler', 2], ['fata', 1]]);
addKinds('route3', [['heron', 2], ['elver', 2], ['peat', 2]]);
addKinds('route4', [['strix', 2], ['hart', 2], ['skep', 2]]);
addKinds('route5', [['kiln', 2], ['belt', 2]]);
addKinds('route6', [['musk', 2], ['serac', 2]]);
addKinds('route7', [['cuirass', 2], ['pennon', 2]]);
addKinds('route8', [['siderite', 2], ['slag', 2]]);
addKinds('slack', [['rumple', 4], ['sag', 4], ['furrow', 4]]);

// ---------------------------------------------------------------- the Undermeadow

link('fellside', 36, 3, 'q', { to: 'undermeadow', tx: 8, ty: 2, dir: 2 }, () => !!flag('slipday'));
// The hole shows from Turning Day, but it leads down only once Ouro has a whorl. Before that, ch1's crazeHole turns Ouro back.
MAPS.fellside.warps.find(w => w.to === 'undermeadow')!.when = () => !!flag('slipday') && !!flag('starter');

MAPS.fellside.npcs.push(
  { id: 'pell', x: 31, y: 9, sprite: 'child', name: 'Pell', dir: 0, talk: 'pell', when: () => !!flag('slipday') },
  { id: 'pellhome', x: 32, y: 9, sprite: 'child', name: 'Pell\'s cast', dir: 0, img: () => PEOPLE.pellcast, when: () => !!flag('pellHome'),
    lines: ['(It stands next to Pell, just a bit too close. Both of its shoes are on.)'] },
);
(MAPS.fellside.spots ||= []).push({
  x: 26, y: 9, when: () => !flag('pellShoe'),
  script: async () => {
    if (!flag('pellAsked')) { await emote('ouro', 'question'); return; }
    setFlag('pellShoe');
    sound('ok');
    await notice('Ouro retrieves a child\'s left shoe, its interior pearly white.');
  },
});

defMap({
  id: 'undermeadow', name: 'The Undermeadow', region: 12, music: 'cave', dark: true,
  rows: rows(34, '#', [
    '##################################',
    '#######.q.######......#####',
    '####......,,..####..,,,....###',
    '###...,,,,,,...##...,,,,,,...##',
    '##...,,,xx,,,.......,,~~,,,...##',
    '##..,,,,,,,,,,...,,,,,~~~,,,,..#',
    '###..,,,,..,,,,,,,,,,,,~~,,,,,..#',
    '####......kk...,,,,,,,,,,,,,,,..#',
    '#####....kkkk.......###....,,,..#',
    '######..kk..kk.....#####....,,..#',
    '#####...k.uu.k.....######...,,..#',
    '####....k....k......####....,,..#',
    '###.....kkkkkk.......##.....,,...#',
    '###...............................',
    '####...,,,,,.....xx......~~.....#',
    '#####..,,,,,,,.........~~~~~....#',
    '######..,,,,,,,.......~~~~~~...##',
    '#######.....,,,,..........~~..###',
    '########.......,,,,.........####',
    '#########.............c.c..#####',
    '###########..........cccc.######',
    '##################################',
  ]),
  warps: [{ x: 8, y: 1, to: 'fellside', tx: 36, ty: 5, dir: 0 }, { x: 33, y: 13, to: 'cocklecove', tx: 34, ty: 7, dir: 0 }],
  zone: { kinds: kinds([['talpa', 3], ['cellar', 2], ['lumbric', 3], ['brogue', 2], ['pod', 2], ['hatch', 1], ['chirr', 2], ['welling', 1]]), lv: [2, 4], n: 9, area: 'dark' },
  npcs: [
    { id: 'moleman', x: 12, y: 5, sprite: 'tanner', name: 'Mole-catcher', dir: 2, trainer: { nacre: 1, name: 'Mole-catcher', team: [['talpa', 3], ['lumbric', 3]], intro: 'Moles dig, and I follow. Twenty years. I haven\'t met one yet. I think they know.', defeat: 'Down the hole I crawl. Moles first.', sight: 3 } },
    { id: 'cellargirl', x: 25, y: 12, sprite: 'child', name: 'Cellar girl', dir: 3, trainer: { name: 'Cellar girl', team: [['cellar', 4], ['pod', 4]], intro: 'Mum keeps the jam down here. Kept. The jam is gone now. I\'m guarding the spot where it was.', defeat: 'Please don\'t tell Mum about the jam. It wasn\'t really me. Mostly.', sight: 3 } },
    { id: 'bootless', x: 16, y: 15, sprite: 'villager2', name: 'Bootless', dir: 0, trainer: { name: 'Bootless', team: [['brogue', 4], ['chirr', 4], ['hatch', 4]], intro: 'I lost a boot down here on my Shedding Day. It shed too, I reckon. It walks about now.', defeat: 'If you see it, you\'ve found the right one. Tell it I\'m not mad.', sight: 3 } },
    { id: 'pellslip', x: 7, y: 16, sprite: 'child', name: 'Pell\'s cast', dir: 3, img: () => PEOPLE.pellcast, talk: 'pellSlip', when: () => !flag('pellHome') },
  ],
  spots: [
    look(14, 2, 'The ceiling\'s aged shell is pale and ribbed, with grass roots spreading flat across its surface.', 'The meadow shed here once. The new meadow grew over its cast.'),
    look(21, 8, 'A root as thick as an arm descends through the rock, bearing a nailed label.', 'The label reads TURNIP, underlined twice.'),
    look(2, 13, 'Scratches mark the wall, counting up to forty-one.', 'The forty-second mark runs off the edge of the rock.'),
    look(22, 19, 'Beneath the meadow lies a table set for two,', 'with salt in a dish and the good bowl placed at the empty seat.'),
    stash('um_bone', 10, 10, 'Tucked behind the roots, between two bones, are two triton horns packed in dry sand.', { pegs: ['bone', 2] }),
    stash('um_jar', 30, 17, 'A jar rests on an earthen shelf, holding a notion, fine and dry.', { notion: 'waxseal' }),
  ],
});

// Pell says "we" for Pell and the cast together, as if nothing has come apart yet.
defScript('pell', async () => {
  if (flag('pellHome')) { await say('Pell', 'We\'re standing so close now. Is this how it works afterward? Is it always this intimate?'); return; }
  if (!flag('pellAsked')) {
    await say('Pell', 'Did you see where we went? Our other half?');
    await say('Pell', 'We shed this morning! Then half of us went down the fracture with one shoe off. The left one.');
    return;
  }
  await say('Pell', 'Is the rest of us down there? Are we alright? Are we cold?');
});

defScript('pellSlip', async () => {
  // Pell's cast faces the wall with one shoe on, lifting its bare left foot and putting it down.
  face('pellslip', 3);
  if (!flag('pellAsked')) {
    await act('pellslip', 'hop');
    await act('pellslip', 'hop');
    setFlag('pellAsked');
    return;
  }
  if (!flag('pellShoe')) { await act('pellslip', 'hop'); return; }
  // Ouro holds out the shoe. The cast takes it without looking, puts it on, and walks past Ouro up the steps.
  await act('ouro', 'bow');
  sound('ok');
  await act('pellslip', 'nod');
  faceToward('pellslip', 'ouro');
  await wait(20);
  await walkOff('pellslip', 8, 1);
  setFlag('pellHome');
  await reward({ pegs: ['brass', 3], tan: 2 });
});

// ---------------------------------------------------------------- the Knucklebones

const KNUCKLES: [number, number][] = [[10, 16], [15, 16], [20, 16], [25, 16], [34, 9]];
const counted = () => KNUCKLES.filter((_, i) => flag('knuckle' + i)).length;

// The surge pool fills the palm from the near side to the shelf, round dry calluses and lines of bone. Each ebb lasts
// eight steps. The callus near the top leads nowhere: past the bones, the rest is more than one ebb away. The low
// callus is one ebb from the wrist, the high one by the shelf one ebb from it, and the shelf one ebb on. Fewest moves: 36.
const PALM = ['::::::u::::::', '::..::u::::::', '::::::u:..:::', '::::::u::::::', '::::::u::::::', ':::::::::::u:', ':::::..::::u:', ':::::::::::::', ':::::::::::::'];
const PALM_X = 12, PALM_Y = 6;
const SURGE_ROWS: [number, number, number][] = PALM.flatMap((r, j) => [...r].flatMap((c, i) => (c === ':' ? [[PALM_X + i, PALM_Y + j, 1] as [number, number, number]] : [])));
const surgeIn = () => field.map?.id === 'knucklebones' && Math.floor(field.mapSteps / 8) % 2 === 1;
const inSurge = (x: number, y: number) => SURGE_ROWS.some(([sx, sy, w]) => y === sy && x >= sx && x < sx + w);

// The step the surge comes in on, it carries anyone wading in the palm back to the wrist. A TIDE whorl worn swims it.
field.stepHooks.push(f => {
  if (f.map.id !== 'knucklebones' || f.mapSteps % 8 !== 0 || !surgeIn() || !inSurge(f.x, f.y)) return;
  if (f.wearing && f.leadTypes().includes('TIDE')) return;
  // The surge carries Ouro off the palm and leaves Ouro at the wrist. Bones stand in the palm, so it is a fade, not a walk.
  void f.runBusy(async () => {
    sfx('hitBig');
    f.flashT = 10;
    f.fade = 12;
    await wait(8);
    f.x = 10; f.y = 10; f.px = 80; f.py = 80; f.dir = 1;
    f.placeFollower();
  });
});

defProp('surgefoam', {
  w: 8, h: 1,
  paint(x, y) {
    // Eight notches on the palm's edge. Foam climbs one notch per step, white while the surge is in.
    const n = field.mapSteps % 8, inNow = surgeIn();
    for (let k = 0; k < 8; k++) {
      const on = k < n;
      rect(x + k * 8 + 2, y + 2, 4, 3, '#3a3040');
      if (on) rect(x + k * 8 + 3, y + 2, 2, 2, inNow ? '#ffffff' : '#9ad8e8');
    }
  },
});

defMap({
  id: 'knucklebones', name: 'The Knucklebones', region: 13, music: 'route',
  rows: [
    '###################==###################',
    '#...................=..................#',
    '#..,,,..............=............,,,...#',
    '#.,,,,,.........................,,,,,..#',
    '#,,,,,,,.......................,,,,,,,.#',
    '#.,,,,,.uu.uuuuuuuuuuuuuuuuuu...,,,,,..#',
    '#..,,,..u...::::::u::::::...u....,,,...#',
    '#.......u...::..::u::::::...u..........#',
    '#.......u...::::::u:..:::...u..........#',
    '#.......u...::::::u::::::...uuuuuuu....#',
    '#.......u...::::::u::::::...uuuuuuu....#',
    '#.......u...:::::::::::u:...u..........#',
    '#.......u...:::::..::::u:...u..........#',
    '#.......u...:::::::::::::...u.......:::#',
    '#.......u...:::::::::::::...u.......:::#',
    '#.......uuuuuuuuuuuuuuuuuuuuu...,,,.::s:',
    '#...,.....uu...uu...uu...uu....,,,,,:::#',
    '#..,,,....uu...uu...uu...uu...,,,,,,:::#',
    '#.,,,,,...uu...uu...uu...uu....,,,,,:::#',
    '#..,,,....uu...uu...uu...uu.....,,,....#',
    '#...,.....uu...uu...uu...uu............#',
    '#.........uu...uu...uu...uu............#',
    '#.........uu..OuuO..uu...uu............#',
    '#.............OOOO.....................#',
    '#~~~~~~~~~~~~~~~~~~~~~~~~~~...~~~~~~~~~#',
    '#~~~~~~~~~~~~~~~~~~~~~~~~~~...~~~~~~~~~#',
    '#~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#',
    '########################################',
  ],
  warps: [
    { x: 19, y: 0, to: 'rib', tx: 21, ty: 30, dir: 0 },
    { x: 20, y: 0, to: 'rib', tx: 21, ty: 30, dir: 0 },
    { x: 39, y: 15, to: 'route1', tx: 1, ty: 15, dir: 1 },
  ],
  // The surge fills the palm on every eighth step and empties it on the next eighth.
  mods: SURGE_ROWS.map(([x, y, w]) => ({ x, y, w, ch: '~', when: surgeIn })),
  props: [{ x: 12, y: 5, pic: 'surgefoam' }],
  zone: { kinds: kinds([['talus', 3], ['molar', 2], ['atlas', 2], ['nail', 2], ['socket', 2], ['furcula', 1]]), lv: [3, 5], n: 10, area: 'bones' },
  npcs: [
    { id: 'counter', x: 7, y: 2, sprite: 'elder', name: 'Counter', dir: 0, talk: 'counter' },
    { id: 'bonesetter', x: 12, y: 3, sprite: 'elder', name: 'Bonesetter', dir: 1, trainer: { nacre: 1, name: 'Bonesetter', team: [['talus', 4], ['atlas', 4]], intro: 'I mend bones. These are too big. I\'m trying. Slow year.', defeat: 'Ow. This one\'s dislocated too.', sight: 3 } },
    { id: 'ringpolish', x: 6, y: 22, sprite: 'villager', name: 'Ring polisher', dir: 1, trainer: { name: 'Ring polisher', team: [['socket', 5], ['furcula', 5]], intro: 'I\'m polishing the ring! It used to be gold, and it\'s getting there. See that patch? :-]', defeat: 'Watch your step on the way out. The shine is still wet.', sight: 3 } },
    { id: 'nailbiter', x: 31, y: 19, sprite: 'child', name: 'Nail biter', dir: 3, trainer: { name: 'Nail biter', team: [['nail', 5], ['molar', 4]], intro: 'I chewed my nails until one shed. Its shell clings to me.', defeat: 'Ugh. It\'s chewing again.', sight: 4 } },
  ],
  spots: [
    ...KNUCKLES.map(([x, y], i) => ({
      x, y,
      script: async () => {
        if (flag('knuckle' + i)) { await emote('ouro', 'silence'); return; }
        if (!flag('countAsked')) { await emote('ouro', 'question'); return; }
        setFlag('knuckle' + i);
        sound('ok');
        await notice(`Knuckles counted: ${counted()}.`);
      },
    })),
    look(14, 22, 'A ring rests across the fingertip, wide enough to walk through.', 'Text circles the interior. Each letter towers over Ouro.', 'It bears someone\'s name, though it\'s too large to read from here.'),
    stash('kb_ring', 17, 22, 'In the dust where the ring meets the bone, lies something dropped long ago.', { notion: 'heartstone' }),
    stash('kb_palm', 10, 7, 'Tucked into a line of the palm, sheltered from the wind, are three whelk horns.', { pegs: ['brass', 3] }),
    look(2, 9, 'The giant\'s rib stands in the town to the north.', 'The giant\'s hand lies here, palm up, with fingers submerged in the sea.', 'No one has found the rest.'),
    stash('kb_reef', 29, 25, 'On the finger reef, wedged in a crack, lie a cuttlebone and a nautilus horn.', { notions: [['cuttlebone', 1]], pegs: ['iron', 1] }),
  ],
});

MAPS.knucklebones.npcs.push({ id: 'kbsign', x: 9, y: 6, sprite: 'sign', name: undefined, lines: ['Scratched onto a knuckle: "The surge deposits debris on the far shelf.', 'Eight steps out, eight steps back in.'] });
MAPS.knucklebones.npcs.push(prize('kb_shelf', 26, 10, 'On the shelf beyond the palm, where the surge drops its cargo, sits a small pile of leftovers.', { items: [['beachglass', 3]], notions: [['tidejar', 2]], tan: 5 }));
{
  // The palm as the surge plays it: a state is a tile and the step of the surge's sixteen-step turn.
  type SurgeS = { x: number; y: number; t: number };
  const tile = (x: number, y: number) => (x === PALM_X - 1 || x === PALM_X + 13) && y >= PALM_Y && y < PALM_Y + 9 ? '.' : PALM[y - PALM_Y]?.[x - PALM_X] ?? 'u';
  const start: SurgeS = { x: PALM_X - 1, y: 10, t: 0 };
  const moves = (s: SurgeS): Move<SurgeS>[] => {
    const out: Move<SurgeS>[] = [], inNow = Math.floor(s.t / 8) % 2 === 1;
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const x = s.x + dx, y = s.y + dy, c = tile(x, y), t = (s.t + 1) % 16;
      if (c === 'u' || (c === ':' && inNow)) continue;
      out.push({ to: c === ':' && t === 8 ? { ...start, t } : { x, y, t }, cost: 1 });
    }
    return out;
  };
  GRAPH_PUZZLES.push({
    name: 'The surge', floor: 6, start, key: (s: SurgeS) => `${s.x},${s.y},${s.t}`, moves, goal: (s: SurgeS) => s.x === PALM_X + 13,
    exit: (s: SurgeS) => s.x === PALM_X - 1, without: [['without the calluses', (s: SurgeS) => moves(s).filter(m => tile(m.to.x, m.to.y) !== '.' || m.to.x === PALM_X - 1 || m.to.x === PALM_X + 13)]],
    show: (s: SurgeS) => `${s.x},${s.y} at step ${s.t}`, prize: { map: 'knucklebones', at: [26, 10], view: [11, 10], named: 'kbsign' },
  });
}

// Counter starts every line with a number.
defScript('counter', async () => {
  if (flag('countDone')) { await say('Counter', 'Five. I\'ve been tallying the ring for all these years. Five from this point forward. Likely five.'); return; }
  if (!flag('countAsked')) {
    await say('Counter', 'Six. That\'s how many knuckles I counted yesterday, or maybe the day before. Six, at least.');
    await say('Counter', 'Seven. Today\'s count. There\'s one more every day. That doesn\'t seem right, does it?');
    await say('Counter', 'One. That\'s how many of you there are. So go count them yourself.');
    await say('Counter', 'Touch each one, or it doesn\'t count.');
    setFlag('countAsked');
    return;
  }
  const n = counted();
  if (n < KNUCKLES.length) { await say('Counter', `${n}. That's your total. Keep going. The thumb counts. I think. Yes, the thumb counts.`); return; }
  await say('Counter', 'Five? Only five?');
  await say('Counter', 'Five. So I\'ve been counting the ring as a knuckle. Then counting it again. Every single day. Huh.');
  await act('counter', 'bow');
  sound('page');
  await act('counter', 'nod');
  setFlag('countDone');
  await reward({ notion: 'toothnecklace', tan: 4 });
});

// ---------------------------------------------------------------- the Wrecks


defMap({
  id: 'wrecks', name: 'The Wrecks', region: 14, music: 'drysea',
  rows: rows(38, '#', [
    '######################################',
    '#sssssssssxssssssssssssssssssxsssssss#',
    '#ss.eeeeeeee.sssssssssss.eeeeeeeeee.s#',
    '#s.eeeeeeeeee.sssxsssss.eeeeeeeeeeee.#',
    '#s.eeeeeeeeee.ssssssss..eeeeeeeeeeee.#',
    '#ss.eeeeeeee.sssssssss...eeeeeeeeee.s#',
    '#sss..p..p..ss,,,ssssss....p....p...s#',
    '#ssssssssssssssss==========ssssssssss#',
    '#ssxs,,,ssssss===ssss,,,ss==sssssxsss#',
    '#sssss.cccccc.sssssssssssssssssssssss#',
    '#ssss.cccccccc.sssss.eeeeeeee.sssssss#',
    '#ssss.cccccccc.ssss.eeeeeeeeee.ssssss#',
    '#sssss.cccccc.sssss.eeeeeeeeee.ssssss#',
    '#ssssss.....ssssssss.eeeeeeee..sssss#',
    '#ssssssssssssssssssss..p.p....sssssss#',
    '#sssxssss,,,,ssssss,,,,ssssssxssssss#',
    '#ssssssss====sssss,,,,,ssssss,,,,sss#',
    '#sssssssss==ssssssssssssssssssssssss#',
    '#ssssssssss=====sssssssssssssssssss#',
    '#sssssssssssssss====sssssssssssssss#',
    '###################=##################',
  ]),
  warps: [{ x: 19, y: 20, to: 'route2', tx: 20, ty: 1, dir: 2 }],
  zone: { kinds: kinds([['fluke', 2], ['prow', 2], ['bilge', 2], ['sail', 3], ['keel', 2], ['bombard', 1]]), lv: [5, 7], n: 11, area: 'wreckage' },
  npcs: [
    { id: 'master', x: 9, y: 13, sprite: 'keeper', name: 'The Master', dir: 0, talk: 'master' },
    { id: 'plankwalk', x: 20, y: 7, sprite: 'villager', name: 'Plank-walker', dir: 2, trainer: { nacre: 1, name: 'Plank-walker', team: [['sail', 6], ['fluke', 6]], intro: 'I pace the plank daily, rehearsing for the tide\'s return. I\'ve mastered the final steps.', defeat: 'I fly off the end. Wheee.', sight: 3 } },
    { id: 'bilgeboy', x: 31, y: 13, sprite: 'child', name: 'Bilge boy', dir: 3, trainer: { name: 'Bilge boy', team: [['bilge', 6], ['keel', 7]], intro: 'I pump the bilge! There\'s no water in it. Not a drop. You\'re welcome.', defeat: 'Still dry.', sight: 3 } },
    { id: 'gunner', x: 7, y: 6, sprite: 'keeper', name: 'Gunner', dir: 1, trainer: { name: 'Gunner', team: [['bombard', 7], ['prow', 7]], intro: 'Every cannon out here still has a ball inside. Nobody\'s brave enough to check. Me included.', defeat: 'Don\'t touch the touch-holes. I know what they\'re called. Just don\'t.', sight: 3 } },
  ],
  spots: [
    look(5, 5, 'A carved figurehead of a woman on the prow, gazing out to sea. The sea vanished forty years ago.', 'She is still looking.'),
    look(24, 4, 'A ship\'s log, left open on a hatch. The final entry reads:', 'WIND NONE. SEA NONE. CREW ASHORE. SHIP ALSO.'),
    look(8, 9, 'The hull is pearlescent and translucent, thin enough to let light pass through.', 'It is the ship\'s cast.', 'The interior walls bear the impression of every object that ever occupied the hold.'),
    stash('wr_hold', 24, 13, 'Deep in the hold, wedged where the ballast once sat, lies a nautilus horn.', { pegs: ['iron', 1] }),
    stash('wr_cabin', 12, 3, 'In a drawer that still glides smoothly, a notion and a few cowries.', { notion: 'salttear', rind: 120 }),
  ],
});

// The Master speaks only in ship's log entries.
defScript('master', async () => {
  if (flag('masterDone')) { await say('The Master', '(final entry. the ship was found. i am not returning. neither will it. evening.)'); return; }
  if (!flag('masterAsked')) {
    await say('The Master', 'Log. Day of the drought. A visitor arrived, of the smallest possible tonnage.');
    await say('The Master', 'Log. The ship shed its skin overnight. The cast remained within itself.');
    await say('The Master', 'The vessel walked off, unauthorized.');
    await say('The Master', 'Log. The ship was last seen heading west, carrying no sail at all. Visitor, investigate.');
    setFlag('masterAsked');
    return;
  }
  if (!flag('shipSeen')) { await say('The Master', '(log. visitor has returned. the ship has not. teatime.)'); return; }
  await say('The Master', 'Log. Visitor returns with intelligence!! Visitor, report.');
  const c = await choose(['It is at the wall.', 'It is gone.'], false, 'Where is the ship?');
  if (c === 0) {
    await say('The Master', '(log entry. the vessel rests against the gray wall. it faces the barrier. it waits for the water.');
    await say('The Master', 'it is dusk.)');
    await say('The Master', 'Log. That is the duty of a ship. To remain entirely seaworthy.');
  } else {
    await say('The Master', 'Log. The visitor lies with such kindness. Most kindly. So, the ship rests at the gray. They all do.');
  }
  setFlag('masterDone');
  await reward({ pegs: ['bone', 3], tan: 3 });
});

// ---------------------------------------------------------------- the Shoreline


defMap({
  id: 'shoreline', name: 'The Shoreline', region: 15, music: 'drysea',
  rows: rows(36, '#', [
    '####################################',
    '#YYYsss,,sssssssssssssss,,,ssssssss#',
    '#YYYYsssss~~sssssssssssxsssssssssss#',
    '#YYYYssss~~~~ssssssssssssssseesssss#',
    '#YYYsssssss~~sssssssssssssseeeessss#',
    '#YYYYsssspssssssssssssssssssseessss#',
    '#YYYYsseeesssssssss~~ssssssssssssss#',
    '#YYYsseeeeessssssss~~~sssssxssssss#',
    '#YYYYseeeeesssssssss~sssssssssssss#',
    '#YYYYsseeessssssssssssssssssssssss#',
    '#YYYsssssssssxsssssssssss~~~ssssss#',
    '#YYYYssssssssssssssssssss~~~~sssss#',
    '#YYYYsssssssss~~~ssssssssss~sssss#',
    '#YYYsssssssss~~~~~ssssssssssssssss==',
    '#YYYYssssssssss~~sssssssxsssssssss#',
    '#YYYYYsssssssssssssssssssssssssss#',
    '#YYYYsss,,,sssssssss,,,,ssssssssss#',
    '#YYYsss,,,,,ssssssss,,,,,sssssss#',
    '####################################',
  ]),
  warps: [{ x: 35, y: 13, to: 'mast', tx: 1, ty: 26, dir: 1 }],
  zone: { kinds: kinds([['breaker', 2], ['skua', 2], ['bloom', 2], ['drift', 3], ['spume', 2], ['ebb', 1]]), lv: [6, 8], n: 11, area: 'foam' },
  npcs: [
    { id: 'swimmer', x: 12, y: 15, sprite: 'villager', name: 'Swimmer', dir: 3, lines: ['Tomorrow, I will swim. The sea will return by tomorrow. Definitely.', 'I have said that for nine years. I am truly, truly skilled at "tomorrow.'] },
    { id: 'beachcomber', x: 22, y: 2, sprite: 'elder', name: 'Beachcomber', dir: 2, trainer: { nacre: 1, name: 'Beachcomber', team: [['drift', 7], ['skua', 7]], intro: 'I gather everything the sea discarded. It discarded a great deal. Then it departed. Typical.', defeat: 'Eh. I will pick you up another time.', sight: 3 } },
    { id: 'walltoucher', x: 6, y: 11, sprite: 'villager2', name: 'Wall-toucher', dir: 3, trainer: { name: 'Wall-toucher', team: [['bloom', 8], ['breaker', 7]], intro: 'Press your ear against the gray. You can hear the sea inside. Honestly.', defeat: 'Go on. Listen. It is still moving within there.', sight: 3 } },
    { id: 'foamboy', x: 28, y: 16, sprite: 'child', name: 'Foam boy', dir: 1, trainer: { name: 'Foam boy', team: [['spume', 8], ['ebb', 8]], intro: 'Foam remains where the waves once were. I sweep it into mounds! This is my largest mound.', defeat: 'You knocked my pile over :-(', sight: 4 } },
  ],
  spots: [
    { x: 8, y: 9, script: async () => {
      await emote('ouro', 'silence');
      if (flag('masterAsked') && !flag('shipSeen')) await notice('Ouro remembers the ship\'s position, for the Master.');
      setFlag('shipSeen');
    } },
    look(4, 11, 'The sea\'s cast. Gray and still, rising to the height of the weather.', 'A fish is trapped within it, its tail bent to one side.'),
    look(3, 1, 'Footprints lead from the dry sand into the gray, and do not return.'),
    look(23, 14, 'A bottle in the sand. The note inside reads: KEEP THE BEACH.'),
    stash('sh_fish', 3, 13, 'At the foot of the gray, an oyster the size of a plate, thick with nacre.', { tan: 3 }),
    stash('sh_pool', 13, 13, 'In the only tide pool holding water, a notion remains, perfectly dry.', { notion: 'coldiron' }),
  ],
});

void face;
