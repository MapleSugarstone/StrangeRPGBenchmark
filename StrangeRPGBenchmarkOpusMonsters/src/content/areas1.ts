// Optional areas, chapters 1 to 3: the Undermeadow, the Knucklebones, the Wrecks, the Shoreline.
import { PEOPLE } from '../engine/sprites';
import { act, choose, emote, face, faceToward, field, narr, notice, say, sound, wait, walkOff } from '../game/api';
import { sfx } from '../engine/audio';
import { rect } from '../engine/screen';
import { defProp } from '../game/props';
import { flag, setFlag } from '../game/state';
import { defMap, defScript, MAPS } from '../game/world';
import { addKinds, kinds, link, look, reward, rows, stash } from './areakit';

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
    lines: ['(It stands next to Pell, a little too close. Both of its shoes are on.)'] },
);
(MAPS.fellside.spots ||= []).push({
  x: 26, y: 9, when: () => !flag('pellShoe'),
  script: async () => {
    if (!flag('pellAsked')) { await emote('ouro', 'question'); return; }
    setFlag('pellShoe');
    sound('ok');
    await notice('Ouro picks up a child\'s left shoe, pearly inside.');
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
  zone: { kinds: kinds([['talpa', 3], ['cellar', 2], ['lumbric', 3], ['brogue', 2], ['pod', 2], ['hatch', 1], ['chirr', 2], ['welling', 1]]), lv: [4, 8], n: 9, area: 'dark' },
  npcs: [
    { id: 'moleman', x: 12, y: 5, sprite: 'tanner', name: 'Mole-catcher', dir: 2, trainer: { name: 'Mole-catcher', team: [['talpa', 6], ['lumbric', 6]], intro: 'Moles dig, I follow. Twenty years. Haven\'t met one yet. I think they know.', defeat: 'Down the hole I go. Moles first.', sight: 3 } },
    { id: 'cellargirl', x: 25, y: 12, sprite: 'child', name: 'Cellar girl', dir: 3, trainer: { name: 'Cellar girl', team: [['cellar', 7], ['pod', 7]], intro: 'Mum keeps the jam down here. Kept. The jam\'s gone now. I\'m guarding where it was.', defeat: 'Don\'t tell Mum about the jam. Please. It wasn\'t me. Mostly.', sight: 3 } },
    { id: 'bootless', x: 16, y: 15, sprite: 'villager2', name: 'Bootless', dir: 0, trainer: { name: 'Bootless', team: [['brogue', 7], ['chirr', 7], ['hatch', 8]], intro: 'Lost a boot down here on my Turning Day. It turned too, I reckon. Walks about now.', defeat: 'If you see it, it\'s the right one. Tell it I\'m not mad.', sight: 3 } },
    { id: 'pellslip', x: 7, y: 16, sprite: 'child', name: 'Pell\'s cast', dir: 3, img: () => PEOPLE.pellcast, talk: 'pellSlip', when: () => !flag('pellHome') },
  ],
  spots: [
    look(14, 2, 'The ceiling is old shell, pale and ridged. Grass roots run flat along it.', 'The meadow turned here once. The new meadow grew over its cast.'),
    look(21, 8, 'A root as thick as an arm comes down through the rock. A label is nailed to it.', 'The label says TURNIP, underlined twice.'),
    look(2, 13, 'Scratches in the wall. Someone counted to forty-one.', 'The forty-second runs off the edge of the rock.'),
    look(22, 19, 'A table under the meadow, set for two. Salt in a dish. The good bowl is at the empty place.'),
    stash('um_bone', 10, 10, 'Behind the roots, between two bones, two triton horns packed in dry sand.', { pegs: ['bone', 2] }),
    stash('um_jar', 30, 17, 'A jar on a shelf of earth. Inside it, a notion, dry and fine.', { notion: 'waxseal' }),
  ],
});

// Pell says "we" for Pell and the cast together, as if nothing has come apart yet.
defScript('pell', async () => {
  if (flag('pellHome')) { await say('Pell', 'We stand really close now. Is that how it goes, after? Is it always this close?'); return; }
  if (!flag('pellAsked')) {
    await say('Pell', 'Did you see where we went? The other half of us?');
    await say('Pell', 'We turned this morning! Then half of us went down the craze with one shoe off. The left one.');
    return;
  }
  await say('Pell', 'Is the rest of us down there? Are we okay? Are we cold?');
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

// The surge pool fills the palm from the near side to the shelf, round a dry callus in the middle.
const SURGE_ROWS: [number, number, number][] = [];
for (let y = 6; y <= 14; y++) {
  if (y === 10 || y === 11) SURGE_ROWS.push([12, y, 6], [20, y, 5]);
  else SURGE_ROWS.push([12, y, 13]);
}
const surgeIn = () => field.map?.id === 'knucklebones' && Math.floor(field.mapSteps / 8) % 2 === 1;
const inSurge = (x: number, y: number) => SURGE_ROWS.some(([sx, sy, w]) => y === sy && x >= sx && x < sx + w);

// The step the surge comes in on, it carries anyone wading in the palm back to the wrist. A TIDE whorl worn swims it.
field.stepHooks.push(f => {
  if (f.map.id !== 'knucklebones' || f.mapSteps % 8 !== 0 || !surgeIn() || !inSurge(f.x, f.y)) return;
  if (f.wearing && f.leadTypes().includes('TIDE')) return;
  // The surge washes Ouro back across the palm to the near side.
  void f.runBusy(async () => {
    sfx('hitBig');
    f.flashT = 10;
    await f.walkPlayer((f.y < 10 ? 'd'.repeat(10 - f.y) : 'u'.repeat(f.y - 10)) + 'l'.repeat(Math.max(0, f.x - 10)));
    f.dir = 1;
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
    '#..,,,..u...:::::::::::::...u....,,,...#',
    '#.......u...:::::::::::::...u..........#',
    '#.......u...:::::::::::::...u..........#',
    '#.......u...:::::::::::::...uuuuuuu....#',
    '#.......u...::::::..:::::...uuuuuuu....#',
    '#.......u...::::::..:::::...u..........#',
    '#.......u...:::::::::::::...u..........#',
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
  zone: { kinds: kinds([['talus', 3], ['molar', 2], ['atlas', 2], ['nail', 2], ['socket', 2], ['furcula', 1]]), lv: [6, 10], n: 10, area: 'bones' },
  npcs: [
    { id: 'counter', x: 7, y: 2, sprite: 'elder', name: 'Counter', dir: 0, talk: 'counter' },
    { id: 'bonesetter', x: 12, y: 3, sprite: 'elder', name: 'Bonesetter', dir: 1, trainer: { name: 'Bonesetter', team: [['talus', 8], ['atlas', 8]], intro: 'I set bones for a living. These are too big to set. I\'m trying anyway. It\'s been a slow year.', defeat: 'Ow. That one\'s out of joint too.', sight: 3 } },
    { id: 'ringpolish', x: 6, y: 22, sprite: 'villager', name: 'Ring polisher', dir: 1, trainer: { name: 'Ring polisher', team: [['socket', 9], ['furcula', 9]], intro: 'I polish the ring! It was gold once. It\'s getting there. See that bit? :-]', defeat: 'Mind the shine on your way out. It\'s fresh.', sight: 3 } },
    { id: 'nailbiter', x: 31, y: 19, sprite: 'child', name: 'Nail biter', dir: 3, trainer: { name: 'Nail biter', team: [['nail', 9], ['molar', 8]], intro: 'I bit my nails so much one of them turned. Its shell follows me everywhere. It\'s kinda clingy.', defeat: 'Ugh. It\'s chewing again.', sight: 4 } },
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
    look(14, 22, 'A ring lies across the fingertip, wide enough to walk through.', 'Writing runs round the inside. Each letter is taller than Ouro.', 'It is somebody\'s name, too big to read from here.'),
    stash('kb_ring', 17, 22, 'In the dust where the ring meets the bone, something someone dropped long ago.', { notion: 'heartstone' }),
    stash('kb_palm', 10, 7, 'In a line of the palm, out of the wind, three whelk horns.', { pegs: ['brass', 3] }),
    look(2, 9, 'The giant\'s rib stands in the town to the north.', 'The giant\'s hand lies here, palm up, fingers in the sea.', 'Nobody has found the rest.'),
    stash('kb_shelf', 26, 10, 'On the shelf past the palm, where the surge leaves things, a little heap of what it left.', { items: [['beachglass', 3]], notions: [['tidejar', 2]], tan: 3 }),
    stash('kb_reef', 29, 25, 'On the finger reef, wedged in a crack, a cuttlebone and a nautilus horn.', { notions: [['cuttlebone', 1]], pegs: ['iron', 1] }),
  ],
});

// Counter starts every line with a number.
defScript('counter', async () => {
  if (flag('countDone')) { await say('Counter', 'Five. I was counting the ring all those years. Five from now on. Probably five.'); return; }
  if (!flag('countAsked')) {
    await say('Counter', 'Six. That\'s how many knuckles I counted yesterday. Or the day before. Six, anyway.');
    await say('Counter', 'Seven. That\'s today\'s. Every day there\'s one more. That can\'t be right, can it?');
    await say('Counter', 'One. That\'s how many of you there are. So you go count them. Touch each one, or it doesn\'t count.');
    setFlag('countAsked');
    return;
  }
  const n = counted();
  if (n < KNUCKLES.length) { await say('Counter', `${n}. That's what you've got. Keep going. The thumb counts. I think. Yes. The thumb counts.`); return; }
  await say('Counter', 'Five? Only five?');
  await say('Counter', 'Five. So I\'ve been counting the ring as a knuckle. And then counting it again. Every day. Huh.');
  await act('counter', 'bow');
  sound('page');
  await act('counter', 'nod');
  setFlag('countDone');
  await reward({ notion: 'toothnecklace', tan: 2 });
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
  zone: { kinds: kinds([['fluke', 2], ['prow', 2], ['bilge', 2], ['sail', 3], ['keel', 2], ['bombard', 1]]), lv: [10, 14], n: 11, area: 'wreckage' },
  npcs: [
    { id: 'master', x: 9, y: 13, sprite: 'keeper', name: 'The Master', dir: 0, talk: 'master' },
    { id: 'plankwalk', x: 20, y: 7, sprite: 'villager', name: 'Plank-walker', dir: 2, trainer: { name: 'Plank-walker', team: [['sail', 12], ['fluke', 12]], intro: 'Every morning I walk the plank. Practice, for when the sea comes back. I\'m great at the end bit.', defeat: 'Off the end I go. Wheee.', sight: 3 } },
    { id: 'bilgeboy', x: 31, y: 13, sprite: 'child', name: 'Bilge boy', dir: 3, trainer: { name: 'Bilge boy', team: [['bilge', 12], ['keel', 13]], intro: 'I pump the bilge! There\'s no water in it. Not a drop. You\'re welcome.', defeat: 'Still dry.', sight: 3 } },
    { id: 'gunner', x: 7, y: 6, sprite: 'keeper', name: 'Gunner', dir: 1, trainer: { name: 'Gunner', team: [['bombard', 13], ['prow', 13]], intro: 'Every cannon out here\'s still got a ball in it. Nobody\'s brave enough to check. Including me.', defeat: 'Don\'t touch the touch-holes. I know what they\'re called. Just don\'t.', sight: 3 } },
  ],
  spots: [
    look(5, 5, 'A carved woman on a prow, looking out to sea. The sea is forty years gone. She is still looking.'),
    look(24, 4, 'A ship\'s log, open on a hatch. The last line:', 'WIND NONE. SEA NONE. CREW ASHORE. SHIP ALSO.'),
    look(8, 9, 'This hull is pearly and thin enough to see light through. It is the ship\'s cast.', 'Inside is the shape of everything that was ever in the hold, pressed into the walls.'),
    stash('wr_hold', 24, 13, 'Down in a hold, wedged where the ballast was, a nautilus horn.', { pegs: ['iron', 1] }),
    stash('wr_cabin', 12, 3, 'In a cabin drawer that still slides, a notion and a few cowries.', { notion: 'salttear', rind: 120 }),
  ],
});

// The Master speaks only in ship's log entries.
defScript('master', async () => {
  if (flag('masterDone')) { await say('The Master', '(last entry. ship found. not coming back. neither am i. evening)'); return; }
  if (!flag('masterAsked')) {
    await say('The Master', 'Log. Day of the dry. A visitor, of most diminutive tonnage.');
    await say('The Master', 'Log. Ship turned in the night. Cast stayed aboard itself. Ship walked off, unauthorized.');
    await say('The Master', 'Log. Ship last sighted proceeding west, under no sail whatsoever. Visitor to look.');
    setFlag('masterAsked');
    return;
  }
  if (!flag('shipSeen')) { await say('The Master', '(log. visitor back. ship not. teatime)'); return; }
  await say('The Master', 'Log. Visitor returns bearing intelligence!! Visitor, report.');
  const c = await choose(['It is at the wall', 'It is gone'], false, 'Where is the ship?');
  if (c === 0) {
    await say('The Master', '(log. ship at the gray. facing it. waiting for the water. dusk)');
    await say('The Master', 'Log. That is what a ship does. Entirely seaworthy conduct.');
  } else {
    await say('The Master', 'Log. Visitor lies, kindly. Most kindly. Ship at the gray, then. They all are.');
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
  zone: { kinds: kinds([['breaker', 2], ['skua', 2], ['bloom', 2], ['drift', 3], ['spume', 2], ['ebb', 1]]), lv: [12, 16], n: 11, area: 'foam' },
  npcs: [
    { id: 'swimmer', x: 12, y: 15, sprite: 'villager', name: 'Swimmer', dir: 3, lines: ['Tomorrow I\'m swimming. The sea\'ll be back by tomorrow. Definitely.', 'I\'ve said that for nine years. I\'m really, really good at tomorrow.'] },
    { id: 'beachcomber', x: 22, y: 2, sprite: 'elder', name: 'Beachcomber', dir: 2, trainer: { name: 'Beachcomber', team: [['drift', 14], ['skua', 14]], intro: 'I pick up everything the sea dropped. It dropped a lot. Then it left. Typical.', defeat: 'Eh. I\'ll pick you up some other time.', sight: 3 } },
    { id: 'walltoucher', x: 6, y: 11, sprite: 'villager2', name: 'Wall-toucher', dir: 3, trainer: { name: 'Wall-toucher', team: [['bloom', 15], ['breaker', 14]], intro: 'Put your ear to the gray. You can hear the sea in there. Honest.', defeat: 'Go on. Listen. It\'s still going in there.', sight: 3 } },
    { id: 'foamboy', x: 28, y: 16, sprite: 'child', name: 'Foam boy', dir: 1, trainer: { name: 'Foam boy', team: [['spume', 15], ['ebb', 15]], intro: 'Foam stays where the waves were. I sweep it into piles! This is my biggest pile.', defeat: 'You knocked my pile over :-(', sight: 4 } },
  ],
  spots: [
    { x: 8, y: 9, script: async () => {
      await emote('ouro', 'silence');
      if (flag('masterAsked') && !flag('shipSeen')) await notice('Ouro remembers where the ship stands, for the Master.');
      setFlag('shipSeen');
    } },
    look(4, 11, 'The sea\'s cast. Gray, still, as tall as weather.', 'A fish is stopped inside it with its tail bent to one side.'),
    look(3, 1, 'Footprints go from the dry sand into the gray, and do not come out.'),
    look(23, 14, 'A bottle in the sand. The paper inside says: KEEP THE BEACH.'),
    stash('sh_fish', 3, 13, 'At the foot of the gray, an oyster as big as a plate, thick with nacre.', { tan: 3 }),
    stash('sh_pool', 13, 13, 'In the only tide pool with water in it, a notion, perfectly dry.', { notion: 'coldiron' }),
  ],
});

void face;
