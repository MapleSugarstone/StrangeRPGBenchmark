// Region 3 of the ring: the Saltings and puzzle 5 (the salt pans), the Shouting Wood, and the ledger room.
import { sfx } from '../engine/audio';
import { rect } from '../engine/screen';
import { choose, emote, field, flag, narr, say, setFlag, tint, wait } from '../game/api';
import { defProp } from '../game/props';
import { chapter, G, save } from '../game/state';
import { defMap, defScript, MAPS, SPAWNS } from '../game/world';
import { PUZZLE_DATA } from '../tools/worldcheck';
import { kinds, look, reward, stash } from './areakit';
import { gatekeeper, giveKeyItem, hasKey, room, roomDoor } from './ring';

// ---------------------------------------------------------------- Holm, far out on the water

/** Holm walks round the Lipwater one region ahead of Ouro: a low pale hump far out, shown on the coast map for its chapter. */
defProp('holmfar', {
  w: 3, h: 1,
  paint(x, y, t) {
    const bob = Math.floor(t / 40) % 2;
    rect(x + 4, y + 3 + bob, 14, 3, '#e8e2d0'); rect(x + 6, y + 2 + bob, 9, 1, '#f4f0e4');
    rect(x + 9, y + bob, 3, 2, '#c8906a'); rect(x + 10, y - 1 + bob, 1, 1, '#c8906a');
    rect(x + 3, y + 6 + bob, 16, 1, '#9ac8d8');
  },
});
export const holmSeen = (ch: number) => () => chapter() === ch && !flag('holmHere');

// ---------------------------------------------------------------- puzzle 5: the salt pans

/**
 * Two columns of four pans: column A on the land side (x 16 to 18) and column B on the sea side (x 12 to 14), pan 0 the southernmost.
 * Boards between A pans open to the east bank, boards between B pans open to the west strip and the salt works, and boards between
 * an A pan and its B pan are reached only from inside a pan. A lifted board levels its two pans, and the odd measure stays in the pan
 * nearer the sea: the seaward pan, or the southern one. The pump on the bank puts every pan and board back.
 */
const PAN_START = [0, 2, 3, 0, 1, 3, 0, 3];
const panTop = (i: number) => 21 - 4 * (i % 4);
const panX = (i: number) => (i < 4 ? 16 : 12);
interface Board { id: string; x: number; y: number; a: number; b: number; sea: number }
const BOARDS: Board[] = [
  ...[0, 1, 2].map(c => ({ id: 'T' + c, x: 18, y: 20 - 4 * c, a: c, b: c + 1, sea: c })),
  ...[0, 1, 2].map(c => ({ id: 'U' + c, x: 12, y: 20 - 4 * c, a: 4 + c, b: 5 + c, sea: 4 + c })),
  ...[0, 1, 2, 3].map(c => ({ id: 'V' + c, x: 15, y: 22 - 4 * c, a: c, b: 4 + c, sea: 4 + c })),
];
const level = (i: number) => (flag('pan' + i) ? flag('pan' + i) - 1 : PAN_START[i]);
const lifted = (b: Board) => !!flag('board' + b.id);

const PAN_MODS = Array.from({ length: 8 }, (_, i) => [0, 1, 2].map(dy => ({ x: panX(i), y: panTop(i) + dy, w: 3, ch: '~', when: () => level(i) >= 2 }))).flat();
const BOARD_MODS = BOARDS.map(b => ({ x: b.x, y: b.y, ch: ':', when: () => lifted(b) }));

/** Lifts the board Ouro faces: its two pans level, and its channel opens. A pan that turns deep under Ouro sends Ouro up onto the board. */
defScript('sluiceBoard', async () => {
  const [fx, fy] = field.facing();
  const b = BOARDS.find(o => o.x === fx && o.y === fy);
  if (!b || lifted(b)) return;
  const t = level(b.a) + level(b.b), other = b.sea === b.a ? b.b : b.a;
  setFlag('pan' + b.sea, Math.ceil(t / 2) + 1);
  setFlag('pan' + other, Math.floor(t / 2) + 1);
  setFlag('board' + b.id);
  sfx('guard');
  field.shakeT = 4;
  await wait(20);
  sfx('wind');
  if (field.tile(field.x, field.y) === '~' && !(field.wearing && field.leadTypes().includes('TIDE'))) await field.walkPlayer('drul'[field.dir]);
  if (!canLeavePans()) {
    // Shut in by deep pans: a salt worker hooks Ouro out with a rake, under a fade, and the pans are pumped back.
    await tint('#0b0a10', 1, 20);
    for (let i = 0; i < 8; i++) setFlag('pan' + i, 0);
    for (const o of BOARDS) setFlag('board' + o.id, 0);
    await tint('#0b0a10', 0, 30);
    await emote('ouro', 'sweat');
    field.fade = 12;
    field.x = 20; field.y = 13; field.px = 160; field.py = 104; field.placeFollower();
  }
  save();
});

/** Whether Ouro can still walk out of the pan field to either bank. */
function canLeavePans(): boolean {
  const seen = new Set<string>([`${field.x},${field.y}`]);
  const q: [number, number][] = [[field.x, field.y]];
  while (q.length) {
    const [x, y] = q.pop()!;
    if (x >= 20 || x <= 11) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (seen.has(k) || !field.passable(nx, ny)) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return false;
}

defScript('saltPump', async () => {
  if (await choose(['Pump them full', 'Leave them'], true, 'The pump fills every pan to its start and drops every board.') !== 0) return;
  for (let i = 0; i < 8; i++) setFlag('pan' + i, 0);
  for (const b of BOARDS) setFlag('board' + b.id, 0);
  sfx('heal');
  field.flashT = 6;
  save();
});

/** A post in each pan, marked 0 to 3, with the water up to its measure. */
defProp('panposts', {
  w: 8, h: 16,
  paint(x, y) {
    for (let i = 0; i < 8; i++) {
      const px = x + (panX(i) + 1 - 12) * 8 + 3, py = y + (panTop(i) + 1 - 9) * 8 - 4;
      rect(px, py, 2, 10, '#6a4a2a'); rect(px, py, 2, 1, '#c8a878');
      for (let k = 0; k < 3; k++) rect(px + 2, py + 7 - k * 3, 2, 1, k < level(i) ? '#ffffff' : '#8a6a4a');
    }
  },
});

PUZZLE_DATA.extra.push(() => {
  // Ouro starts on the east bank and must reach the west strip. Breadth first over pan levels and lifted boards.
  const start = PAN_START.slice();
  const seen = new Set<string>();
  const q: [number[], number][] = [[start, 0]];
  while (q.length) {
    const [lv, up] = q.shift()!;
    const reach = new Set<number>();
    const stack: number[] = [];
    BOARDS.forEach((b, i) => { if (b.id[0] === 'T' && up & (1 << i)) for (const p of [b.a, b.b]) if (lv[p] <= 1 && !reach.has(p)) { reach.add(p); stack.push(p); } });
    while (stack.length) {
      const p = stack.pop()!;
      BOARDS.forEach((b, i) => { if (!(up & (1 << i))) return; const o = b.a === p ? b.b : b.b === p ? b.a : -1; if (o >= 0 && lv[o] <= 1 && !reach.has(o)) { reach.add(o); stack.push(o); } });
    }
    if (BOARDS.some((b, i) => b.id[0] === 'U' && up & (1 << i) && (reach.has(b.a) || reach.has(b.b)))) return null;
    BOARDS.forEach((b, i) => {
      if (up & (1 << i)) return;
      if (b.id[0] !== 'T' && !reach.has(b.a) && !reach.has(b.b)) return;
      const nl = lv.slice(), t = nl[b.a] + nl[b.b], o = b.sea === b.a ? b.b : b.a;
      nl[b.sea] = Math.ceil(t / 2); nl[o] = Math.floor(t / 2);
      const k = nl.join('') + (up | (1 << i));
      if (seen.has(k)) return;
      seen.add(k);
      q.push([nl, up | (1 << i)]);
    });
  }
  return 'puzzle 5: the salt pans cannot be crossed from their start';
});

defMap({
  id: 'saltings', name: 'The Saltings', region: 36, music: 'saltings',
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT=TTTTTTTTT',
    'T~~~~~TTTTT...................=........T',
    'T~~~~~TTTTT...........rrrrr...=........T',
    'T~~~~~TTTTT...........rrrrr...=........T',
    'T~~~~~TTTTT...........hhhhh,,.=........T',
    'T~~~~~TTTTT..........,,,,,,,,,=........T',
    'T~~~~~TTTTT...........,,,,,,,.=..,,,...T',
    'T~~~~~TTTTT.............,,,...=.,,,,,..T',
    'T~~~~~TTTTT#########..........=,,,,,,,.T',
    'T~~~~~rrrrr#:::#:::#..........=.,,,,,..T',
    'T~~~~~rrrrr#:::+:::#..........=..,,,...T',
    'T~~~~~hhqhh#:::#:::#..........=........T',
    'T~~~~~ssssss+#####+...........=........T',
    'T~~~~~sssss#:::#:::#.w........=...:::::T',
    'T~~~~~#O#ss#:::+:::#..........=...:::::T',
    'T~~~~~s@sss#:::#:::#..........=...::::s:',
    'T~~~~~ssssss+#####+...........=...:::::T',
    'T~=========#:::#:::#..........=...:::::T',
    'T~~~~~sssss#:::+:::#..........=........T',
    'T~~~~~sssss#:::#:::#..........=........T',
    'T~~~~~ssssss+#####+...........=........T',
    'T~~~~~sssss#:::#:::#..........=........T',
    'T~~~~~sssss#:::+:::#..........=.rrrrr..T',
    'T~~~~~sssss#:::#:::#..........=.rrrrr..T',
    'T~~~~~TTTTT#########.....,,,..=.hhhhh..T',
    'T~~~~~TTTTT............,,,,,,,=........T',
    'T~~~~~TTTTT...........,,,,,,,,=........T',
    'T~~~~~TTTTT............,,,,,,,=........T',
    'T~~~~~TTTTT..............,,,..=........T',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT=TTTTTTTTT',
  ],
  mods: [...PAN_MODS, ...BOARD_MODS],
  warps: [
    { x: 30, y: 0, to: 'spire', tx: 1, ty: 22, dir: 2 },
    { x: 30, y: 29, to: 'mast', tx: 1, ty: 3, dir: 0 },
    { x: 39, y: 15, to: 'route3', tx: 1, ty: 20, dir: 1 },
  ],
  tileTalk: { '+': 'sluiceBoard' },
  zone: { kinds: kinds([['brine', 3], ['eddy', 2], ['heron', 3], ['elver', 2], ['siren', 1]]), lv: [15, 19], n: 9, area: 'saltwort' },
  props: [{ x: 12, y: 9, pic: 'panposts' }, { x: 1, y: 5, pic: 'holmfar', when: holmSeen(3) }],
  npcs: [
    { id: 'saltworker1', x: 22, y: 9, sprite: 'tanner', name: 'Salt worker', dir: 3, lines: () => saltLines(0) },
    { id: 'saltworker2', x: 25, y: 20, sprite: 'villager', name: 'Salt worker', dir: 3, lines: () => saltLines(1) },
    { id: 'saltsign', x: 20, y: 7, sprite: 'sign', name: null as any, lines: ['THE PANS. Lift a board, the two sides level. Odd measure goes seaward. Seaward is west, then south.'] },
    { id: 'saltrainer', x: 33, y: 5, sprite: 'villager2', name: 'Raker', dir: 3, trainer: { name: 'Raker', team: [['brine', 18], ['heron', 18]], intro: 'Rake, rake, rake. I rake salt, sleep, rake salt. You\'re the first thing I\'ve raked that walks.', defeat: 'Back to the rake.', sight: 3 } },
  ],
  spots: [
    { x: 21, y: 13, script: 'saltPump' },
    { x: 8, y: 11, when: () => !hasKey('lore_window') && !flag('back_lore_window'), script: async () => { await giveKeyItem('lore_window', 'Ouro finds a small window in the salt works. One pane is cracked.'); } },
    { x: 7, y: 14, when: () => !field.objAt(7, 15) && !flag('found_salt_store'), script: async () => { setFlag('found_salt_store'); await reward({ items: [['saltcake', 3]], notions: [['seabiscuit', 1]] }); } },
    look(1, 17, 'The jetty ends over the Lipwater. The Lip is a pale line across it, a long way off.'),
  ],
});
SPAWNS.saltings = [30, 1];

// The salt workers finish each thought with "and that's salt", whatever it was about.
function saltLines(i: number): string[] {
  if (i === 0) return ['Lad called Tack came through with a whorl off our pans. Brine and boy, both salty. And that\'s salt.'];
  return flag('tack3') ? ['Heard it\'s called Brack now, the one off our pans. Good name. Tastes right. And that\'s salt.'] : ['Pan four\'s cast walked off last spring. Went north with a kid. And that\'s salt.'];
}

// ---------------------------------------------------------------- the Shouting Wood

defMap({
  id: 'shoutwood', name: 'The Shouting Wood', region: 37, music: 'shout',
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTT=TTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTT=TTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTT=TTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTT;TTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTT.TTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTT...TTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTT.....TTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTT...TTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTT.TTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTT...TTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTT...,,,...TTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTT...,,,,,...TTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTT..,,,,,,,..TTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTT....,,,,,....TTTTTTTTTTTTT',
    'TTTTTTT...TTTTT....,,,....TTTTTTTTTTTTTT',
    'TTTT...,,,...TT...........TTTTTTTTTTTTTT',
    'TT...,,,,,,,...T.........TTTTT...TTTTTTT',
    'TT..,,,,,,,,,..TTTT...TTTTTT......TTTTTT',
    'T....,,,,,,,....TTTT.TTTTTT.......TTT.T#',
    '==.....,,,....============........=====j',
    'TT............=TTTTTTTTTTTT.......TTTTT#',
    'TTTT.........T=TTTTTT...TTTT......TTTTTT',
    'TTTTTTT...TTTT=TTT.........TTT...TTTTTTT',
    'TTTTTTTTTTTTTT=T.............TTTTTTTTTTT',
    'TTTTTTTTTTTTTT=T.......,,,...TTTTTTTTTTT',
    'TTTTTTTTTTTTTT=......,,,,,,,..TTTTTTTTTT',
    'TTTTTTTTTTTTTT=T..~~~~~~~~~~~~TTTTTTTTTT',
    '~~TTTTTTTTTTTT=~~~~~~~~~~~~~~~~~~~TTTTTT',
    '~~~~~~~~~~~~~~=~~~.....,,,.TTT~~~~~~~~~~',
    'TT~~~~~~~~~~~...TTTTT...TTTTTTTTTT~~~~~~',
    'TTTTTTTTTTT.......TTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTT...TTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  mods: [{ x: 39, y: 20, ch: '=', when: () => !!flag('gate_w') }],
  warps: [{ x: 0, y: 20, to: 'spire', tx: 38, ty: 22, dir: 3 }],
  zone: { kinds: kinds([['mycel', 3], ['leech', 2], ['peat', 2], ['strix', 2], ['siren', 1]]), lv: [15, 19], n: 10, area: 'bracken' },
  npcs: [
    { id: 'shouter1', x: 9, y: 18, sprite: 'villager2', name: 'Shouter', dir: 0, lines: ['I COME OUT HERE TO SAY THINGS AT FULL SIZE. my wife says I\'m a bit much at home'] },
    { id: 'shouter2', x: 22, y: 13, sprite: 'oldwoman', name: 'Shouter', dir: 3, lines: ['FORTY YEARS OF HUSHING IN SPIRE. SO TODAY I\'M SHOUTING THE SHOPPING LIST. eggs'] },
    { id: 'shoutrainer', x: 23, y: 26, sprite: 'villager', name: 'Bellower', dir: 2, trainer: { name: 'Bellower', team: [['siren', 18], ['strix', 18], ['peat', 19]], intro: 'THREE WHORLS AND A VOICE. THIS IS THE ONLY PLACE I\'M ALLOWED BOTH. sorry', defeat: 'I LOST. that was nice actually', sight: 4 } },
    { id: 'swsleeper', x: 35, y: 20, sprite: 'stone', mon: 'peat', name: 'Deispes', sleeper: { kind: 'peat', lv: 26, flag: 'sl_shout' } },
    { id: 'gatekeeper_w', x: 37, y: 19, sprite: 'keeper', name: 'Gatekeeper', dir: 0, talk: 'gateW' },
  ],
  spots: [
    stash('sw_ford', 14, 31, 'Over the footbridge, under a stone in the stream, beach glass rolled smooth.', { items: [['beachglass', 2]], tan: 1 }),
  ],
});
SPAWNS.shoutwood = [1, 20];

// The west gatekeeper works for Lug, and drifts from one thought to the next the way Lug does.
defScript('gateW', gatekeeper('w', 'Lug', {
  shut: 'Shut. Shut like a cupboard, a cupboard of good plates, plates nobody uses. No seal, no way.',
  read: 'Apex seal. Black, like a well, a well at night, night over the Ring. Through you go.',
  open: 'Open from this side. Ring\'s past it, round the Apex, round and round like a plate on a table.',
}));

// ---------------------------------------------------------------- the ledger room

const LEDGER: Record<string, string> = {
  mast: '"the mast. a loudness under the whole volute. one bell, long. no one to blame"',
  bole: '"the bole. it rained down for the first time, and that was loud. two bells"',
  pylon: '"the pylon. a hum stopped. the silence was loud. three bells"',
  tusk: '"the tusk. somebody very old said yes. four bells, slowly"',
  hilt: '"the hilt. a sword came out of the ground. five bells, sharp"',
  fall: '"the fall. a star let go. all the bells, at once, and then none"',
};

defMap({
  id: 'ledgerroom', name: 'The ledger room', region: 11, indoor: true, music: 'spire',
  rows: room(['p_p_p_p_', '________', '__cc____', '________', '________', '________']),
  warps: roomDoor('spire', 30, 27),
  npcs: [{ id: 'ledgerclerk', x: 6, y: 3, sprite: 'villager2', name: 'Clerk', dir: 3, lines: ['The Verger\'s ledger of loudnesses. Every loud thing in Spire for three hundred years, and the hour.'] }],
  spots: [{ x: 3, y: 2, script: async () => {
    const got = G.pulled.filter(p => LEDGER[p]);
    if (!got.length) { await say('Ledger', 'a cart, dropped. one bell. a child, laughing. half a bell'); return; }
    for (const p of got) await say('Ledger', LEDGER[p].replace(/^"(.*)"$/, '$1'));
  } }, stash('lr_chip', 7, 1, 'Wedged under the last pew, a chip off a bell. It still hums.', { items: [['bellchip', 1]] })],
});
MAPS.underspire.spots = [...(MAPS.underspire.spots || []), stash('us_chip', 12, 15, 'At the foot of the pillar, two chips off the old bell, humming.', { items: [['bellchip', 2]] })];
