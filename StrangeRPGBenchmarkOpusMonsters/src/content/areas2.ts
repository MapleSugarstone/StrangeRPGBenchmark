// Optional areas, chapters 3 to 6: the Underspire, the Rootfall, the Dropfield, the Iceshelf.
import { sfx } from '../engine/audio';
import { PEOPLE } from '../engine/sprites';
import { act, bell, choose, emote, face, faceToward, field, morphTo, narr, notice, pan, panBack, say, shake, sound, wait } from '../game/api';
import { G, flag, setFlag } from '../game/state';
import { defMap, defScript, MAPS } from '../game/world';
import { kinds, link, look, reward, rows, stash } from './areakit';

const has = (s: string) => G.scales.includes(s);
const pale = (id: string) => () => ({ px: (PEOPLE[id] || PEOPLE.child).px, c: ['#e4eef4', '#c8d8e4'] as [string, string] });

// ---------------------------------------------------------------- the Underspire: the bells

link('spirecrypt', 8, 1, 'q', { to: 'underspire', tx: 2, ty: 2, dir: 2 }, () => has('spire'));

// The order is on the bells themselves: Treble first, Tenor last, and the Second is not second.
const BELLS: { x: number; name: string; says: string }[] = [
  { x: 8, name: 'Second', says: 'I AM NOT SECOND.' },
  { x: 11, name: 'Tenor', says: 'I GO LAST, AND LOUDEST.' },
  { x: 16, name: 'Treble', says: 'I GO FIRST. I ALWAYS HAVE.' },
  { x: 19, name: 'Third', says: 'NAMES LIE IN THIS TOWER.' },
];
const ORDER = ['Treble', 'Third', 'Second', 'Tenor'];
let rung: string[] = [];

defMap({
  id: 'underspire', name: 'The Underspire', region: 16, music: 'gym', indoor: true,
  rows: rows(26, '#', [
    '##########################',
    '#_q___p______##______p___#',
    '#____________##__________#',
    '#_cc_cc_cc__####__cc_cc__#',
    '#____________##__________#',
    '#__p____bbb__##__bbb__p__#',
    '#_______bbb______bbb_____#',
    '#_cc_cc______pp_____cc_cc#',
    '#____________pp__________#',
    '###_____K__K_pp_K__K___###',
    '###___,,,_______,,,____###',
    '#_cc_cc_cc________cc_cc__#',
    '#___,,,,________,,,,_____#',
    '##########################',
    '#########_______##########',
    '#########___p___##########',
    '##########################',
  ]),
  mods: [{ x: 12, y: 13, w: 2, ch: '_', when: () => !!flag('bellsDone') }],
  warps: [{ x: 2, y: 1, to: 'spirecrypt', tx: 8, ty: 2, dir: 2 }],
  enter: 'underspireEnter',
  zone: { kinds: kinds([['tenor', 2], ['glaze', 2], ['pipe', 2], ['pew', 3], ['relic', 2], ['censer', 2]]), lv: [17, 21], n: 8, area: 'nave' },
  npcs: [
    { id: 'sexton', x: 5, y: 12, sprite: 'elder', name: 'Sexton', dir: 1, talk: 'sexton' },
    { id: 'bellstriker', x: 20, y: 6, sprite: 'ringer', name: 'Bell-striker', dir: 3, trainer: { name: 'Bell-striker', team: [['tenor', 18], ['pipe', 18]], intro: 'I hit the bells with a stick. The ropes are up the other side of the ground, so. Stick.', defeat: 'Ooh. That rang wrong.', sight: 3 } },
    { id: 'glazier', x: 4, y: 7, sprite: 'elder', name: 'Glazier', dir: 0, trainer: { name: 'Glazier', team: [['glaze', 19], ['censer', 19]], intro: 'I mend the windows. They\'re in the floor now, so I mend them on my knees. My knees hate it.', defeat: 'Mind the glass. Mind it!', sight: 3 } },
    { id: 'pewsitter', x: 15, y: 11, sprite: 'villager2', name: 'Pew-sitter', dir: 2, trainer: { name: 'Pew-sitter', team: [['pew', 19], ['relic', 20]], intro: 'I sat down here before the whole thing turned over. Haven\'t got up since. Didn\'t feel polite.', defeat: 'The pew\'s just above me now. Same pew. Same dent in it.', sight: 2 } },
  ],
  spots: [
    ...BELLS.map(b => ({ x: b.x, y: 9, script: async () => {
      if (flag('bellsDone')) { await emote('ouro', 'music'); return; }
      const c = await choose([`Read the ${b.name}`, `Strike the ${b.name}`], true);
      if (c === 0) { await say(`The ${b.name} bell`, b.says); return; }
      if (c !== 1) return;
      rung.push(b.name);
      sfx('peg');
      const k = rung.length - 1;
      if (rung[k] !== ORDER[k]) {
        rung = [];
        sfx('pegFail');
        bell(ORDER.indexOf(b.name) * 3 + 1); bell(ORDER.indexOf(b.name) * 3 + 7);
        await wait(20);
        await emote('ouro', 'sweat');
        return;
      }
      bell(12 - k * 4);
      if (rung.length < ORDER.length) { await emote('ouro', 'music'); return; }
      await wait(30);
      bell(0); bell(4); bell(7); bell(12);
      await shake(20);
      await morphTo('bellsDone', 12, 13);
    } })),
    look(12, 3, 'The font is on the ceiling, upside down. The water is still in it, and it is salt.'),
    look(9, 6, 'Colored glass set in the floor. Under it, more sky. A star falls past.'),
    stash('us_pew', 22, 11, 'Wedged under a pew, a notion somebody sat on for a long time.', { notion: 'bitterroot' }),
    stash('us_room', 12, 15, 'On a stand in the hidden room, a nautilus horn and a scallop lined with nacre.', { pegs: ['iron', 1], tan: 4 }),
  ],
});

defScript('underspireEnter', async () => { rung = []; });

// The Sexton dates every line by a year of his own life.
defScript('sexton', async () => {
  if (flag('bellsDone')) { await say('Sexton', 'They rang right in my ninth year, and again in my eightieth. First time, I went in. This time, you.'); return; }
  await say('Sexton', 'In my ninth year the bells rang right and the far floor opened. I was very small. It was very big.');
  await say('Sexton', 'In my twentieth year folk read what\'s on the bells and argued over it. A liar made them, I heard.');
  await say('Sexton', 'Nobody\'s got it since. I gave up trying in the spring of my sixtieth year. Lovely spring, that.');
});

// ---------------------------------------------------------------- the Rootfall: the saplings

MAPS.bole.warps.push({ x: 0, y: 23, to: 'rootfall', tx: 30, ty: 9, dir: 3 });

// Touching a sapling makes some of the roots curl back. Three gates in a row lead to the middle.
const sap = (k: string) => (flag('rf' + k) ? 1 : 0);
const gate1 = () => (sap('A') ^ sap('B')) === 1;
const gate2 = () => (sap('B') ^ sap('C') ^ sap('D')) === 1;
const gate3 = () => (sap('A') ^ sap('D')) === 1;

defMap({
  id: 'rootfall', name: 'The Rootfall', region: 17, music: 'route',
  rows: rows(32, '#', [
    '################################',
    '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
    '#,kkk,,TTTTTTTTTTTTTTTTTT,,kkk,#',
    '#,k,,,,T................T,,,,k,#',
    '#,k,kk,T.TTTTTTTTTTTTTT.T,kk,k,#',
    '#,,,k,,T.T............T.T,,k,,,#',
    '#kk,k,,T.T.TTTTTTTTTT.T.T,,k,kk#',
    '#,,,,,,T.T.T........T.T.T,,,,,,#',
    '#,kkkk,T.T.T........T.T.T,kkkk,#',
    '#,,,,,,T.T.T........T.T.T,,,,,,=',
    '#,kk,,,T.T.TTTTTTTTTT.T.T,,,kk,#',
    '#,kk,,,T.T............T.T,,,kk,#',
    '#,,,,,,T.TTTTTTTTTTTTTT.T,,,,,,#',
    '#,,k,,,T................T,,,k,,#',
    '#,,k,,,TTTTTTTTTTTTTTTTTT,,,k,,#',
    '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
    '#,,i,,kkk,,,,,,,,,,,,,kkk,,,i,,#',
    '#,,,,,,,,,,,,i,,,,,,,i,,,,,,,,,#',
    '#,kkk,,,TT,,,,,,,,,,,,,,TT,,kkk#',
    '#,,,,,,,TT,,,,,,..,,,,,,TT,,,,,#',
    '#,,,,,,,,,,,,,,,..,,,,,,,,,,,,,#',
    '################################',
  ]),
  mods: [
    { x: 16, y: 14, ch: ',', when: gate1 },
    { x: 22, y: 9, ch: '.', when: gate2 },
    { x: 11, y: 8, ch: '.', when: gate3 },
  ],
  warps: [{ x: 31, y: 9, to: 'bole', tx: 1, ty: 23, dir: 1 }],
  zone: { kinds: kinds([['taproot', 3], ['borer', 2], ['clod', 2], ['whip', 2], ['gnarl', 1], ['upfall', 2]]), lv: [22, 26], n: 13, area: 'roots' },
  npcs: [
    { id: 'upright', x: 5, y: 13, sprite: 'villager', name: 'The Upright Man', dir: 1, talk: 'upright' },
    { id: 'rootcutter', x: 4, y: 10, sprite: 'tanner', name: 'Root-cutter', dir: 0, trainer: { name: 'Root-cutter', team: [['taproot', 24], ['whip', 24]], intro: 'I cut the roots back, they grow back, I come back. We\'ve been doing this a while.', defeat: 'See you tomorrow, then. Them too.', sight: 3 } },
    { id: 'beetlegirl', x: 27, y: 12, sprite: 'child', name: 'Beetle girl', dir: 3, trainer: { name: 'Beetle girl', team: [['borer', 24], ['clod', 25]], intro: 'Beetles live in the roots and I live near the beetles! We\'re neighbors.', defeat: 'Now they\'re hiding. So I\'m hiding too.', sight: 3 } },
    { id: 'upfaller', x: 16, y: 20, sprite: 'villager2', name: 'Upfaller', dir: 2, trainer: { name: 'Upfaller', team: [['upfall', 25], ['gnarl', 25]], intro: 'Rain goes up by the Bole. On a good day I go up with it, a little bit. Like, a toe.', defeat: 'Not a good day, then.', sight: 3 } },
  ],
  spots: [
    ...(['A', 'B', 'C', 'D'] as const).map((k, i) => ({ x: [3, 13, 21, 28][i], y: [16, 17, 17, 16][i], script: async () => {
      setFlag('rf' + k, flag('rf' + k) ? 0 : 1);
      sfx('switch');
      field.shakeT = 6;
      await act('ouro', 'back');
    } })),
    look(16, 6, 'A face in the roots. Its eyes are two snail shells. It has watched the middle a long time.'),
    look(29, 3, 'A bowl hangs upside down on a root. Rain falls up into it and stays.'),
    stash('rf_heart', 19, 8, 'In the middle of the roots, on a bed of moss: a nautilus horn and a mussel lined with nacre.', { pegs: ['iron', 1], tan: 4 }),
    stash('rf_bark', 2, 13, 'Under loose bark, a notion.', { notion: 'thornvest' }),
  ],
});

// The Upright Man gives a height in every line.
defScript('upright', async () => {
  if (flag('uprightDone')) { await say('The Upright Man', 'One whole inch since you came!! And one inch is, six foot one, an enormous amount.'); return; }
  if (!flag('uprightAsked')) {
    await say('The Upright Man', 'Six foot one. That was me in the spring. A splendid spring, vertically speaking.');
    await say('The Upright Man', 'Not one inch more, now. The rain goes up here, you see. My feet get none of it. Parched.');
    setFlag('uprightAsked');
    return;
  }
  if (!flag('uprightBowl')) { await say('The Upright Man', 'Holding at, six foot one, and thirsty at the ankle.'); return; }
  // Ouro tips the bowl of upward rain over his feet, and for once it falls down.
  await act('ouro', 'bow');
  sound('heal');
  await act('upright', 'hop');
  await say('The Upright Man', 'Six foot one. Ah.');
  await say('The Upright Man', 'Six foot one and a bit!! A BIT!! Somebody measure me!!');
  setFlag('uprightDone');
  await reward({ tan: 3, notion: 'warmstone' });
});

// The bowl of upward rain: take it once the Upright Man has asked.
MAPS.rootfall.spots!.push({ x: 29, y: 3, when: () => !!flag('uprightAsked') && !flag('uprightBowl'), script: async () => {
  setFlag('uprightBowl');
  sound('ok');
  await notice('Ouro takes down the bowl of upward rain, carefully upside down.');
} });
MAPS.rootfall.spots!.reverse();

// ---------------------------------------------------------------- the Dropfield: the dishes

link('route5', 20, 0, '=', { to: 'skinfall', tx: 17, ty: 20, dir: 0 });

const DIRS = ['north', 'east', 'south', 'west'];
const DISHES = [{ x: 5, y: 9, want: 1 }, { x: 16, y: 3, want: 2 }, { x: 27, y: 9, want: 3 }];
const dishAt = (i: number) => (flag('dish' + i) + i) % 4;

defMap({
  id: 'skinfall', name: 'The Dropfield', region: 18, music: 'route',
  rows: rows(34, '#', [
    '##################################',
    '#,,,,..,,,,,,,,,..,,,,,,,,,,,,,,,#',
    '#,,xx,,,,,,,,,,,..,,,,,,,,,,xx,,,#',
    '#,xOOx,,,,,,,,,,m,,,,,,,,,,xOOx,,#',
    '#,xOOx,,,,,,,,,,,,,,,,,,,,,xOOx,,#',
    '#,,xx,,,..........,,,,,,,,,,xx,,,#',
    '#,,,,,,,.mm....mm.,,,,,,,,,,,,,,,#',
    '#,,,,,,,.m......m.,,,,,,,,,,,,,,,#',
    '#,,,,,,,..........,,,,,,,,,,,,,,,#',
    '#,,,,m,,....pp....,,,,,,,,,,m,,,,#',
    '#,,,,,,,....pp....,,,,,,,,,,,,,,,#',
    '#,,,,,,,..........,,,,,,,,,,,,,,,#',
    '#,,xx,,,.m......m.,,,,,xx,,,,,,,,#',
    '#,xOOx,,.mm....mm.,,,,xOOx,,,,,,,#',
    '#,xOOx,,..........,,,,xOOx,,,,,,,#',
    '#,,xx,,,,,,,,,,,,,,,,,,xx,,,,,,,,#',
    '#,,,,,,,,,xx,,,,,,,,,,,,,,,,,xx,,#',
    '#,,,,,,,,xOOx,,,,,,,,,,,,,,,xOOx,#',
    '#,,,,,,,,,xx,,,,,,,,,,,,,,,,,xx,,#',
    '#,,,,,,,,,,,,,,,..,,,,,,,,,,,,,,,#',
    '#...............==...............#',
    '#################==###############',
  ]),
  warps: [
    { x: 17, y: 21, to: 'route5', tx: 20, ty: 1, dir: 2 },
    { x: 18, y: 21, to: 'route5', tx: 20, ty: 1, dir: 2 },
  ],
  zone: { kinds: kinds([['aerial', 2], ['vane', 2], ['capsule', 2], ['booster', 2], ['dish', 2], ['debris', 3]]), lv: [27, 31], n: 14, area: 'wreckage' },
  npcs: [
    { id: 'catcher', x: 22, y: 8, sprite: 'villager2', name: 'The Catcher', dir: 2, talk: 'catcher' },
    { id: 'scrapper', x: 6, y: 15, sprite: 'tanner', name: 'Scrapper', dir: 1, trainer: { name: 'Scrapper', team: [['aerial', 29], ['debris', 29]], intro: 'It all came down at once, back in my gran\'s time. Still sorting it. I\'ve done one pile.', defeat: 'Right. Into the pile with you.', sight: 3 } },
    { id: 'hullsleeper', x: 26, y: 15, sprite: 'villager', name: 'Hull-sleeper', dir: 3, trainer: { name: 'Hull-sleeper', team: [['capsule', 29], ['vane', 30]], intro: 'I sleep in a hull that fell out of the sky. It\'s warm on one side. I roll over a lot.', defeat: 'Going back to bed. Warm side up.', sight: 3 } },
    { id: 'dishturner', x: 14, y: 18, sprite: 'child', name: 'Dish-turner', dir: 0, trainer: { name: 'Dish-turner', team: [['dish', 30], ['booster', 30]], intro: 'I turn the dishes round to hear stuff. Mostly it\'s wind. Once it was a cough.', defeat: 'Shh. Listen.', sight: 3 } },
  ],
  spots: [
    ...DISHES.map((d, i) => ({ x: d.x, y: d.y, script: async () => {
      if (flag('dishesDone')) { await emote('ouro', 'music'); return; }
      const c = await choose([`Turn it from ${DIRS[dishAt(i)]}`, 'Leave it'], true);
      if (c !== 0) return;
      setFlag('dish' + i, (flag('dish' + i) + 1) % 4);
      sfx('switch');
      field.shakeT = 4;
      await wait(16);
      if (DISHES.every((dd, k) => dishAt(k) === dd.want)) {
        // All three dishes face the tower. It hums back, a voice in it counts down in a tongue nobody here speaks, and a hatch opens.
        await shake(15);
        await pan(12, 9);
        await emote('ouro', 'music');
        for (let k = 0; k < 4; k++) { bell(9 - k * 2); await wait(18); }
        sound('switch');
        await morphTo('dishesDone', 12, 10);
        await panBack();
      }
    } })),
    look(3, 3, 'A crater, and in it the casing of a machine that went up high once. It came down empty.'),
    look(16, 9, 'A tower of the old Riders\' kind. Writing on it: a number, and a word nobody reads.', 'The word has a circle in it.'),
    { x: 12, y: 10, when: () => !!flag('dishesDone') && !flag('found_df_hatch'), script: async () => {
      setFlag('found_df_hatch');
      await reward({ notion: 'chrysalis', pegs: ['iron', 1] });
    } },
    { x: 10, y: 17, script: async () => {
      if (!flag('catcherAsked') || flag('catcherPlate')) { await emote('ouro', 'sweat'); return; }
      setFlag('catcherPlate');
      sound('ok');
      await notice('A warm plate. Baked into it: a pale round land with a spiral, and eight black dots on its edge.');
    } },
  ],
});

// The Catcher starts every line with "Up there" or "Down there".
defScript('catcher', async () => {
  if (flag('catcherDone')) { await say('The Catcher', 'Nothing today. Nothing up there for ages, really. There was once.'); return; }
  if (!flag('catcherAsked')) {
    await say('The Catcher', 'Something came down last night. Missed the tub. By a lot, honestly.');
    await say('The Catcher', 'I can\'t look away, in case. But it\'s down in a crater by the south rocks. Fetch it for me?');
    setFlag('catcherAsked');
    return;
  }
  if (!flag('catcherPlate')) { await say('The Catcher', 'Still nothing up here. It\'s the south rocks. A crater. Down there.'); return; }
  await act('ouro', 'bow');
  faceToward('catcher', 'ouro');
  await emote('catcher', 'surprise');
  await say('The Catcher', 'Oh. That\'s what we look like. From up there.');
  await emote('catcher', 'silence');
  face('catcher', 2);
  setFlag('catcherDone');
  await reward({ tan: 4, notion: 'longshin' });
});

// ---------------------------------------------------------------- the Iceshelf: the ice

link('route6', 43, 14, '=', { to: 'iceshelf', tx: 1, ty: 9, dir: 1 });

defMap({
  id: 'iceshelf', name: 'The Iceshelf', region: 19, music: 'tundra',
  rows: rows(34, '#', [
    '##################################',
    '#nnnnn,,,nnnnnnnnnnnnnnnn,,,nnnnn#',
    '#nnn,,,,,,nnnnnnnnnnnnnn,,,,,,nnn#',
    '#nn,,,nnnnnnnnnnnnnnnnnnnnn,,,nnn#',
    '#nn~~nnnnniiiiiiiiiiiiinnnnn~~nnn#',
    '#n~~~~nnnniIIIIIIIIIIIinnnn~~~~nn#',
    '#nn~~nnnnniIIIIIiIIiIIinnnnn~~nnn#',
    '#nnnnnnnnniIiIIiIiIIIIinnnnnnnnnn#',
    '#nnnnnnnnniIIIII~~IIIiinnnnnnnnnn#',
    '=nnnnnnnnniIIIII~~IiIIinnnnnnnnnn#',
    '#nn,,,nnnniIIIIiIIIIIIinnnn,,,,nn#',
    '#n,,,,,nnniIiiiIiIIIIIinnn,,,,,,n#',
    '#nn,,,nnnniiiIIIIiIIIiinnnn,,,,nn#',
    '#nnnnnnnnnnnnnnnnnnnnninnnnnnnnnn#',
    '#nnnnnnnnniiiiiiiiiiiiinnnnnnnnnn#',
    '#nn,,,,nnnnnnnnnn~~~nnnnnnnn,,,nn#',
    '#n,,,,,,nnnnnnnn~~~~~nnnnnn,,,,,n#',
    '#nn,,,,nnnnnnnnnn~~~nnnnnnnn,,,nn#',
    '#nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn#',
    '##################################',
  ]),
  warps: [{ x: 0, y: 9, to: 'route6', tx: 42, ty: 14, dir: 3 }],
  zone: { kinds: kinds([['selkie', 2], ['walrus', 2], ['berg', 2], ['narwhal', 2], ['rime', 3], ['auk', 1]]), lv: [33, 37], n: 13, area: 'drifts' },
  npcs: [
    { id: 'icefisher', x: 9, y: 11, sprite: 'elder', name: 'Ice-fisher', dir: 1, talk: 'icefisher' },
    { id: 'frozenslip', onSolid: true, x: 16, y: 8, sprite: 'child', name: 'A cast under the ice', dir: 0, img: pale('child'), ghost: true, talk: 'frozenSlip' },
    { id: 'icecutter', x: 5, y: 15, sprite: 'tanner', name: 'Ice-cutter', dir: 1, trainer: { name: 'Ice-cutter', team: [['walrus', 35], ['berg', 35]], intro: 'I cut blocks out of the lake. Lake doesn\'t notice. Or it\'s being nice about it.', defeat: 'Here, take a block home. Keep it somewhere cold. Not your pocket.', sight: 3 } },
    { id: 'sealwife', x: 28, y: 12, sprite: 'villager2', name: 'Seal-wife', dir: 3, trainer: { name: 'Seal-wife', team: [['selkie', 35], ['narwhal', 36]], intro: 'My other coat\'s in a chest at home. Don\'t tell my husband. He thinks it\'s blankets.', defeat: 'You won\'t tell. I can tell you won\'t.', sight: 3 } },
    { id: 'aukkeeper', x: 29, y: 2, sprite: 'elder', name: 'Auk-keeper', dir: 2, trainer: { name: 'Auk-keeper', team: [['auk', 36], ['rime', 36]], intro: 'The last of them came here to stand on the ice. So I came and stood with them.', defeat: 'Stand with us a bit. It\'s nice. Cold, but nice.', sight: 3 } },
  ],
  spots: [
    ...([[16, 8], [17, 8], [16, 9], [17, 9]] as const).map(([x, y]) => ({ x, y, script: 'frozenSlip' })),
    look(4, 6, 'A fishing hole. Far down in the clear water, a star is falling, very slowly.'),
    stash('is_hole', 29, 6, 'Frozen into the edge of a fishing hole, a notion and a string of cowries.', { notion: 'hideplate', rind: 300 }),
    stash('is_drift', 20, 16, 'Half buried in the snow by the far hole, a clam shell lined with nacre.', { tan: 3 }),
  ],
});

// The Ice-fisher measures in fingers and says no more than she has to.
defScript('icefisher', async () => {
  if (flag('iceDone')) { await say('Ice-fisher', 'No. ... That\'s what I wanted. Thanks for asking it for me.'); return; }
  if (!flag('iceAsked')) {
    await say('Ice-fisher', 'Four fingers thick today. Good ice.');
    await say('Ice-fisher', 'Six fingers, the day I turned. Wasn\'t thick enough. ... It went through.');
    await say('Ice-fisher', 'Still down there, in the middle. My first shell. Would you ask it if it\'s cold?');
    setFlag('iceAsked');
    return;
  }
  if (!flag('iceAnswer')) { await say('Ice-fisher', 'Four fingers. No grip in the middle, so you slide. ... Watch your stopping.'); return; }
  await say('Ice-fisher', '... Well?');
  await act('ouro', 'look');
  await say('Ice-fisher', 'No.');
  setFlag('iceDone');
  await reward({ tan: 4, pegs: ['bone', 4] });
});

defScript('frozenSlip', async () => {
  // A pearly child-shaped shell looks up from under the clear ice, hands flat against the underside.
  await emote('ouro', 'silence');
  if (!flag('iceAsked') || flag('iceAnswer')) return;
  // Ouro kneels and knocks on the ice to ask if it is cold, and the child's mouth makes one word through the ice.
  await act('ouro', 'bow');
  sound('bump');
  await wait(12);
  sound('bump');
  await wait(30);
  await say('The cast under the ice', 'No.');
  setFlag('iceAnswer');
});
