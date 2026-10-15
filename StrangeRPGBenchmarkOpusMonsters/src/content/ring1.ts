// Region 1 of the ring: Cockle Cove, the Brook Wood, Turnstone's and Rib's new rooms, and puzzles 1 and 2.
import { sfx } from '../engine/audio';
import { SPECIES } from '../data/species';
import { rect } from '../engine/screen';
import { run } from '../game/modes';
import { NameEntry } from '../game/files';
import { act, choose, emote, evening, face, fadeWho, field, fightWild, flag, giveMon, mon, moveNpc, nearPlayer, narr, notice, offstage, say, setFlag, standAt, wait, walkAway, walkIn, walkTo } from '../game/api';
import { chapter, G, save, HERO } from '../game/state';
import { listMenu, monLine } from '../game/menus';
import { defProp } from '../game/props';
import { defMap, defScript, MAPS, SPAWNS } from '../game/world';
import { kinds, look, stash } from './areakit';
import { GRAPH_PUZZLES, PUZZLE_DATA, type Move } from '../tools/worldcheck';
import { CRUST_FINDS, gatekeeper, giveKeyItem, hasKey, LORE, room, roomDoor, standingWild } from './ring';

// ---------------------------------------------------------------- Cockle Cove

/** Where each of the Islander's things stood, as she remembers it, by lore item. */
const STAKES: Record<string, [number, number]> = {
  lore_door: [21, 12], lore_step: [21, 13], lore_gate: [21, 15], lore_window: [23, 12],
  lore_chair: [23, 11], lore_kettle: [22, 11], lore_vane: [21, 10], lore_tub: [21, 7],
};
const STAKE_LIST = Object.values(STAKES);
/** Which lore item stands on a stake, by stake index, as an index into LORE plus one. */
const onStake = (i: number) => flag('stake' + i);
const isBack = (id: string) => !!flag('back_' + id);
const allBack = () => LORE.every(isBack);
const houseRight = () => LORE.every(id => { const i = STAKE_LIST.findIndex(([x, y]) => x === STAKES[id][0] && y === STAKES[id][1]); return onStake(i) === LORE.indexOf(id) + 1; });

// The crab in the kettle sits on the rock shelf (x 3 to 12, y 11 to 15). Poked, it runs straight away from Ouro over the
// shelf floor until a rock or the wall stops it. A crab that runs into the whelk's pool in the west wall takes the whelk
// and leaves the kettle. When Ouro walks off the shelf, the crab walks back to where it sat.
// The insight: work back from the pool. The crab has to run up the west wall from row 13, and only the rock at the east
// end of row 12 stops it on row 13, so the rock in the bottom corner is used twice to set that up. Fewest pokes: 8.
const CRAB_HOME: [number, number] = [11, 12];
const WHELK_POOL: [number, number] = [2, 11];
const SHELF = { x: 3, y: 11, w: 10, h: 5 };
const XY4 = [[0, 1], [1, 0], [0, -1], [-1, 0]];

defMap({
  id: 'cocklecove', name: 'Cockle Cove', region: 33, music: 'cove',
  rows: [
    'TTTTTTTTTTTTTTTTTTTT=TTTTTTTT~~TTTTTTTTT',
    'T...,,,,,...........=...,,,..~~........T',
    'T.,,,,,,,,,.........=.,,,,,,,~~........T',
    'T=====================================.T',
    'T............................~~........T',
    'Tsssssssrrrrrssssssssssssssss~~ss######T',
    'Tssssssshhdhhssssssssssssssss~~ss#q####T',
    'Tssssssssssssssssssssssssssss~~ss#s#ss#T',
    'Tsssssssssssssssss_______ssss~~ss#%#ss#T',
    'Tsssssssssssssssss_______sss::::s#s~~~#T',
    'Ts############ssss_______sss::::s#s~~~#T',
    'Ts:..#....#..#ssss_______sss::::s#s~~~#T',
    'Ts#.......#..#ssss_______sss::::s#s~~~#T',
    'Ts#..........#sssssssssssss:::::s#s~~~#T',
    'ss#..#.......#sssssssssssss:::::s#s####T',
    'Ts#........#.#sssssssssssss::ss:sssssssT',
    'Ts#######ss###ssssssssssxss::ss:sssssssT',
    'Tsssssssssssxsss==sssssxsss:::::sssssssT',
    'Tssxssssssssssss==sssssssss:::::sssssssT',
    'Tssss~ssss~ssss~==ss~ssss~s:::::sss~sssT',
    'T~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~T',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  warps: [
    { x: 20, y: 0, to: 'fellside', tx: 24, ty: 32, dir: 2 },
    { x: 0, y: 14, to: 'route1', tx: 54, ty: 10, dir: 3 },
    { x: 10, y: 6, to: 'islanderhut', tx: 4, ty: 6, dir: 2 },
    { x: 34, y: 6, to: 'undermeadow', tx: 32, ty: 13, dir: 2 },
  ],
  zone: { kinds: kinds([['paring', 3], ['eddy', 2], ['fiddler', 3], ['urchin', 2]]), lv: [2, 3], n: 7, area: 'marram' },
  props: [{ x: 0, y: 0, pic: 'cocktracks' }, { x: 18, y: 7, pic: 'islandfloor' }],
  // Before Tack's battle, the way west onto the Midden Road turns Ouro back.
  triggers: [{ x: 1, y: 14, w: 1, h: 1, script: 'tackCallsCove', when: () => !flag('tack1') }],
  npcs: [
    { id: 'islander', x: 17, y: 13, sprite: 'oldwoman', name: 'Islander', dir: 1, talk: 'islander', when: () => !flag('holmChoice') },
    { id: 'kettlecrab', x: CRAB_HOME[0], y: CRAB_HOME[1], sprite: 'stone', mon: 'fiddler', name: 'Crab', dir: 3, talk: 'kettlecrab', when: () => !flag('crabMoved') },
    { id: 'holm', x: 26, y: 11, sprite: 'stone', mon: 'holm', name: 'Holm', dir: 3, talk: 'holm', when: () => !!flag('holmHere') && !flag('holmSounded') },
    { id: 'islanderhome', x: 21, y: 13, sprite: 'oldwoman', name: 'Islander', dir: 0, talk: 'islanderAfter', when: () => !!flag('holmSounded') },
    { id: 'islanderholm', x: 26, y: 11, sprite: 'oldwoman', name: 'Islander', dir: 0, ghost: true, talk: 'islanderAfter', when: () => !!flag('holmChoice') && !flag('holmSounded') },
  ],
  spots: [
    ...STAKE_LIST.map(([x, y], i) => ({ x, y, when: allBack, script: () => stakeTalk(i) })),
    stash('cc_bar', 29, 15, 'On the sand bar in the inlet, a nautilus horn rolled up in weed, and beach glass.', { pegs: ['iron', 1], items: [['beachglass', 2]] }),
    stash('cc_cave', 37, 7, 'On the shelf at the back of the sea cave, out of the water: nacre, and a tide jar.', { tan: 4, notions: [['tidejar', 1]] }),
    look(16, 24, 'The end of the jetty. The Lip stands across the water, pale, a long way off.', 'The jetty was built for a boat. The boat was an island. (it left)'),
    look(12, 7, 'The Islander\'s hut. Driftwood, rope, and one good window someone gave her.'),
  ],
  enter: 'coveEnter',
});
SPAWNS.cocklecove = [20, 1];

const LORE_NAME: Record<string, string> = {
  lore_kettle: 'the kettle', lore_door: 'the door', lore_window: 'the window', lore_chair: 'the chair',
  lore_vane: 'the vane', lore_tub: 'the tub', lore_step: 'the step', lore_gate: 'the gate',
};

/** The Islander begins each line on the thing she means, as if pointing at it first. */
const HINTS: Record<string, string[]> = {
  lore_kettle: ['Kettle went over right here, the last night. A crab moved into it.', 'Crab took it up on the rock shelf. Whelk in the shelf pool would suit it better, I\'d say.'],
  lore_door: ['Door fell in the bay the year before the sea went. Deepest bit of the bay, so.', 'Ship man up the Wrecks had a chart of the deep bits. Ask him nice.'],
  lore_window: ['Window\'s at the salt pans, past Mast. They keep the pans full.', 'Pans full, so I couldn\'t wade it. You\'ve got legs for it now, I see.'],
  lore_chair: ['Chair\'s in the kelp past Spire. Big ones sleep on that beach.', 'Big ones sleep on anything. Sleeping on my chair, I\'d bet. Wake one.'],
  lore_vane: ['Vane\'s on the crane shore past Bole. An old crane picked it out of the water.', 'Crane never put it down. Somebody wearing a gear sort might turn it.'],
  lore_tub: ['Tub froze in up north, the cold year. On a floe.', 'Floes go where they want. Step on one and you go where it wants too.'],
  lore_step: ['Step\'s a stone. Heavy. It\'s under the long stones south of Tusk.', 'Long stones need moving first. Takes a harness, that.'],
  lore_gate: ['Gate\'s at Fall. Everything rolls to the star down there.', 'My gate too, apparently. Rolled off and kept rolling.'],
};

/** What Ouro needs before each thing can be reached, in the order the Islander names them. */
const REACH: Record<string, () => boolean> = {
  lore_kettle: () => true,
  lore_door: () => chapter() >= 2,
  lore_window: () => hasKey('stilts'),
  lore_chair: () => hasKey('jingle'),
  lore_vane: () => !!flag('wearing'),
  lore_tub: () => chapter() >= 6,
  lore_step: () => hasKey('haul'),
  lore_gate: () => hasKey('haul') && chapter() >= 8,
};

defScript('islander', async () => {
  // Things Ouro carries go back on the sand first.
  const carried = LORE.filter(id => hasKey(id));
  for (const id of carried) {
    G.keys = G.keys.filter(k => k !== id);
    setFlag('back_' + id);
    sfx('level');
    await wait(20);
  }
  if (carried.length) await say('Islander', carried.length > 1 ? 'Those, there. Next to each other. Like old times, sort of.' : 'That, there. On the sand. Thanks, you.');
  if (!flag('islanderMet')) {
    setFlag('islanderMet');
    await say('Islander', 'House was here. Right here, on the back of an island, for fifty years.');
    await say('Islander', 'Island walked off with it one evening. I\'d gone up for flour.');
    await say('Islander', 'Things fell off it, one by one, all round the Lip. I watched. Couldn\'t reach any.');
  }
  if (allBack()) {
    if (houseRight()) { await say('Islander', 'House stands right, so. Now we wait for dusk.'); return; }
    if (!flag('floorTold')) {
      setFlag('floorTold');
      await say('Islander', 'Floor\'s laid. Stakes where things stood. Can\'t lift them myself any more.');
    }
    await say('Islander', 'Door faced the water. Step in front of the door. Gate at the end of the path, toward the water.');
    await say('Islander', 'Window in the wall left of the door, when you stand in the door looking out.');
    await say('Islander', 'Chair under the window. Kettle on the stove at your right hand, sat in the chair looking out.');
    await say('Islander', 'Vane on the ridge, over the door. Tub out back. That\'s the lot.');
    return;
  }
  const next = LORE.find(id => !isBack(id) && !hasKey(id) && REACH[id]()) || LORE.find(id => !isBack(id) && !hasKey(id));
  if (next) for (const l of HINTS[next]) await say('Islander', l);
});

/** Sets a thing from the sand on a stake, or picks one back up. */
async function stakeTalk(i: number): Promise<void> {
  const here = onStake(i);
  if (here) {
    const id = LORE[here - 1];
    if (await choose([`Pick up ${LORE_NAME[id]}`, 'Leave it'], true) !== 0) return;
    setFlag('stake' + i, 0);
    sfx('back');
    return;
  }
  const loose = LORE.filter((id, j) => isBack(id) && !STAKE_LIST.some((_, k) => onStake(k) === j + 1));
  if (!loose.length) return;
  const k = await listMenu('Set on this stake', loose.map(id => LORE_NAME[id]), { w: 110 });
  if (k < 0) return;
  setFlag('stake' + i, LORE.indexOf(loose[k]) + 1);
  sfx('ok');
  save();
  if (STAKE_LIST.every((_, s) => onStake(s)) && houseRight()) await houseStands();
  else if (STAKE_LIST.every((_, s) => onStake(s))) await say('Islander', 'Something\'s off, that. Not how it stood. Try again, you.');
}

async function houseStands(): Promise<void> {
  await say('Islander', 'There. That\'s it. That\'s my house, near enough.');
  // Dusk comes, and Holm walks in from the bottom of the map, up out of the water, to lie beside the house.
  evening(true);
  await wait(40);
  setFlag('holmHere');
  offstage('holm');
  sfx('wind');
  // Holm comes up out of the water from the bottom of the map, so it wades rather than finding a dry way.
  standAt('holm', 26, 27);
  await moveNpc('holm', 'uuuuuuuuuuuuuuuu');
  face('islander', 1);
  sfx('boom');
  field.shakeT = 10;
  await wait(30);
  save();
}

defScript('holm', async () => {
  if (!flag('holmChoice')) await say('Islander', 'Holm. That\'s what I called it. Never answered to it. Doesn\'t now.');
  const c = await choose(['Sound it', 'Leave it']);
  if (c === 0) {
    const r = await fightWild(mon('holm', nearPlayer(-1)), { bossHp: 4.4, ai: 'keeper', area: 'shallows', music: 'holm' });
    if (r.pegged.length) {
      await giveMon(r.pegged[0]);
      // She walks up the step into the house on the sand.
      if (!flag('holmChoice')) await walkTo('islander', 21, 13);
      setFlag('holmSounded');
      setFlag('holmChoice');
      face('islanderhome', 0);
    } else if (r.result === 'lose') { await field.lose(); return; }
  } else if (!flag('holmChoice')) {
    // She climbs back up onto Holm and sits where her door used to be.
    await walkTo('islander', 25, 11);
    await act('islander', 'hop');
    await fadeWho('islander', false, 20);
    setFlag('holmChoice');
  }
  save();
});

defScript('islanderAfter', async () => {
  if (flag('holmSounded')) await say('Islander', 'House on sand now. Doesn\'t go anywhere. Strange, that. Nice.');
  else await say('Islander', 'Holm\'s back, so. We\'ll see where it walks tomorrow. Probably here.');
});

const onShelfFloor = (rows: string[], x: number, y: number) => x >= SHELF.x && x < SHELF.x + SHELF.w && y >= SHELF.y && y < SHELF.y + SHELF.h && rows[y][x] === '.';

/** Where a crab poked going `d` from x, y stops, and whether it ran into the whelk's pool. */
function crabRun(rows: string[], x: number, y: number, d: number): [number, number, boolean] {
  for (;;) {
    const nx = x + XY4[d][0], ny = y + XY4[d][1];
    if (nx === WHELK_POOL[0] && ny === WHELK_POOL[1]) return [nx, ny, true];
    if (!onShelfFloor(rows, nx, ny)) return [x, y, false];
    x = nx; y = ny;
  }
}

defScript('kettlecrab', async () => {
  const n = field.npc('kettlecrab');
  if (!n) return;
  const d = field.dir;
  const [x, y, won] = crabRun(field.map.rows, n.x, n.y, d);
  const steps = Math.abs(x - n.x) + Math.abs(y - n.y);
  if (!steps) { sfx('bump'); await emote('kettlecrab', 'anger'); return; }
  sfx('move');
  await moveNpc('kettlecrab', 'drul'[d].repeat(steps));
  if (!won) return;
  // In the pool the crab backs out of the kettle and into the whelk, and goes off down the pool with it on.
  sfx('switch');
  field.shakeT = 4;
  await emote('kettlecrab', 'heart');
  await fadeWho('kettlecrab', false, 20);
  setFlag('crabMoved');
  await wait(30);
  await giveKeyItem('lore_kettle', 'Ouro gets the kettle.');
});

// Left alone, the crab walks back to where it sat.
field.stepHooks.push(f => {
  if (f.map.id !== 'cocklecove' || flag('crabMoved')) return;
  const n = f.npc('kettlecrab');
  if (!n || (n.x === CRAB_HOME[0] && n.y === CRAB_HOME[1])) return;
  if (f.x >= SHELF.x && f.x < SHELF.x + SHELF.w && f.y >= SHELF.y && f.y <= SHELF.y + SHELF.h) return;
  void f.runBusy(async () => { await walkTo('kettlecrab', CRAB_HOME[0], CRAB_HOME[1]); });
});

defScript('coveEnter', async () => {
  G.flags.visited_cove = 1;
  // The whelk lies in its pool on the shelf now. A save from before carries it, so it goes back.
  if (hasKey('whelk')) G.keys = G.keys.filter(k => k !== 'whelk');
});

// The crab for the puzzle checks: where it sits, and the lowest tile of the ground Ouro can walk to.
type CrabState = { x: number; y: number; o: number };
const COVE_W = 40;
function crabArea(rows: string[], cx: number, cy: number, fx: number, fy: number): Set<number> {
  const ground = (x: number, y: number) => x >= 1 && x <= 15 && y >= 10 && y <= 17 && !(x === cx && y === cy) && (rows[y][x] === '.' || rows[y][x] === 's');
  const seen = new Set([fy * COVE_W + fx]), q = [[fx, fy]];
  while (q.length) {
    const [x, y] = q.pop()!;
    for (const [dx, dy] of XY4) { const nx = x + dx, ny = y + dy, k = ny * COVE_W + nx; if (!seen.has(k) && ground(nx, ny)) { seen.add(k); q.push([nx, ny]); } }
  }
  return seen;
}
const crabFrom = (rows: string[]): CrabState => ({ x: CRAB_HOME[0], y: CRAB_HOME[1], o: Math.min(...crabArea(rows, CRAB_HOME[0], CRAB_HOME[1], 9, 17)) });
const crabWon = (s: CrabState) => s.x === WHELK_POOL[0] && s.y === WHELK_POOL[1];
function crabMoves(s: CrabState): Move<CrabState>[] {
  if (crabWon(s)) return [];
  const rows = MAPS.cocklecove.rows;
  const area = crabArea(rows, s.x, s.y, s.o % COVE_W, Math.floor(s.o / COVE_W));
  const out: Move<CrabState>[] = [];
  if ([...area].some(k => k >= 17 * COVE_W)) out.push({ to: crabFrom(rows), cost: 0, reset: true });
  for (let d = 0; d < 4; d++) {
    const ox = s.x - XY4[d][0], oy = s.y - XY4[d][1];
    if (!area.has(oy * COVE_W + ox)) continue;
    const [x, y, won] = crabRun(rows, s.x, s.y, d);
    if (won) out.push({ to: { x, y, o: 0 }, cost: 1 });
    else if (x !== s.x || y !== s.y) out.push({ to: { x, y, o: Math.min(...crabArea(rows, x, y, ox, oy)) }, cost: 1 });
  }
  return out;
}
GRAPH_PUZZLES.push({
  name: 'The crab', floor: 6,
  start: crabFrom(MAPS.cocklecove.rows),
  key: (s: CrabState) => `${s.x},${s.y},${s.o}`,
  moves: crabMoves,
  goal: crabWon,
  exit: (s: CrabState) => crabWon(s) || [...crabArea(MAPS.cocklecove.rows, s.x, s.y, s.o % COVE_W, Math.floor(s.o / COVE_W))].some(k => k >= 17 * COVE_W),
  show: (s: CrabState) => `crab ${s.x},${s.y} Ouro by ${s.o % COVE_W},${Math.floor(s.o / COVE_W)}`,
  prize: { map: 'cocklecove', at: CRAB_HOME, view: [9, 17] },
});

/** Crab tracks: the fresh line is dark and wet and wanders back on itself to the crab, the old lines are pale and dry. */
const FRESH: [number, number][] = [[20, 18], [19, 17], [18, 18], [15, 18], [14, 17], [13, 18], [12, 17], [11, 18], [10, 17], [10, 16], [9, 15], [10, 14], [11, 13]];
const OLD: [number, number][][] = [
  [[3, 9], [4, 8], [5, 9], [6, 8], [7, 9], [8, 8], [9, 9], [10, 8]],
  [[22, 14], [23, 15], [24, 14], [25, 15], [26, 14], [27, 13]],
  [[2, 19], [3, 18], [4, 19], [5, 18]],
];
defProp('cocktracks', {
  w: 40, h: 28,
  paint(x, y) {
    if (flag('crabMoved')) {
      // The kettle the crab left at the mouth of the pool, until Ouro has it.
      if (!hasKey('lore_kettle') && !flag('back_lore_kettle')) LORE_PIC.lore_kettle(x + (WHELK_POOL[0] + 1) * 8, y + WHELK_POOL[1] * 8);
      return;
    }
    // The big whelk shell lying in the pool in the shelf's west wall.
    const wx = x + WHELK_POOL[0] * 8, wy = y + WHELK_POOL[1] * 8;
    rect(wx + 2, wy + 2, 4, 4, '#f4e8d0'); rect(wx + 3, wy + 3, 2, 2, '#c8906a'); rect(wx + 5, wy + 5, 2, 1, '#f4e8d0'); rect(wx + 2, wy + 2, 1, 1, '#ffffff');
    const mark = (tx: number, ty: number, c: string) => { rect(x + tx * 8 + 1, y + ty * 8 + 3, 1, 1, c); rect(x + tx * 8 + 3, y + ty * 8 + 5, 1, 1, c); rect(x + tx * 8 + 5, y + ty * 8 + 3, 1, 1, c); rect(x + tx * 8 + 6, y + ty * 8 + 5, 1, 1, c); };
    for (const line of OLD) for (const [tx, ty] of line) mark(tx, ty, '#fff4d8');
    for (const [tx, ty] of FRESH) mark(tx, ty, '#6a4a2a');
  },
});

/** The driftwood floor: eight stakes, and each thing standing on its stake or waiting on the sand beside the floor. */
const LORE_PIC: Record<string, (x: number, y: number) => void> = {
  lore_kettle: (x, y) => { rect(x + 2, y + 3, 4, 3, '#8a9aa8'); rect(x + 6, y + 3, 1, 1, '#8a9aa8'); rect(x + 3, y + 2, 2, 1, '#c8d4dc'); },
  lore_door: (x, y) => { rect(x + 2, y + 1, 4, 6, '#a06c3c'); rect(x + 5, y + 4, 1, 1, '#ffd890'); },
  lore_window: (x, y) => { rect(x + 1, y + 1, 6, 5, '#6a4a2a'); rect(x + 2, y + 2, 2, 1, '#bfe8f8'); rect(x + 5, y + 2, 1, 1, '#bfe8f8'); rect(x + 2, y + 4, 4, 1, '#bfe8f8'); },
  lore_chair: (x, y) => { rect(x + 2, y + 1, 1, 6, '#8a5a30'); rect(x + 2, y + 4, 4, 1, '#8a5a30'); rect(x + 5, y + 4, 1, 3, '#8a5a30'); },
  lore_vane: (x, y) => { rect(x + 4, y + 1, 1, 6, '#7a7a80'); rect(x + 1, y + 2, 5, 2, '#c8c8d0'); rect(x + 1, y + 2, 1, 1, '#2a2a30'); },
  lore_tub: (x, y) => { rect(x + 1, y + 3, 6, 4, '#a8b8c8'); rect(x + 1, y + 3, 6, 1, '#e8f0f8'); rect(x + 3, y + 2, 2, 1, '#f4f4f4'); },
  lore_step: (x, y) => { rect(x + 1, y + 4, 6, 3, '#9a9890'); rect(x + 3, y + 4, 2, 1, '#6a6862'); },
  lore_gate: (x, y) => { rect(x + 1, y + 2, 1, 5, '#e8e0c8'); rect(x + 6, y + 2, 1, 5, '#e8e0c8'); rect(x + 1, y + 3, 6, 1, '#e8e0c8'); rect(x + 1, y + 5, 6, 1, '#e8e0c8'); },
};
defProp('islandfloor', {
  w: 8, h: 10,
  paint(x, y) {
    const placed = new Set<string>();
    STAKE_LIST.forEach(([sx, sy], i) => {
      const px = x + (sx - 18) * 8, py = y + (sy - 7) * 8;
      if (!allBack()) return;
      const id = onStake(i) ? LORE[onStake(i) - 1] : null;
      if (id) { placed.add(id); LORE_PIC[id](px, py); } else { rect(px + 3, py + 2, 2, 5, '#8a6a4a'); rect(px + 3, py + 2, 2, 1, '#c8a878'); }
    });
    // Things that are back but not on a stake wait in a row on the sand under the floor.
    let k = 0;
    for (const id of LORE) if (isBack(id) && !placed.has(id)) LORE_PIC[id](x + (k++) * 8 - 8, y + 7 * 8);
  },
});

// ---------------------------------------------------------------- the Brook Wood

/** Pebbles piled on each stepping stone in the deep part of the brook. Only one chain runs one to seven across. */
const STONES: Record<string, number> = {
  '27,9': 1, '28,9': 2, '29,9': 3, '30,9': 4, '30,10': 5, '31,10': 6, '31,11': 7,
  '27,8': 1, '27,7': 2, '27,6': 3, '30,8': 3, '30,7': 4, '29,7': 5, '29,6': 6, '31,7': 7, '29,11': 4,
};
PUZZLE_DATA.countingStones = STONES;
let countPrev = 0;

field.stepHooks.push(f => {
  if (f.map.id !== 'brookwood') return;
  const n = STONES[`${f.x},${f.y}`];
  if (!n) { countPrev = 0; return; }
  if (n === countPrev + 1) { countPrev = n; if (n === 7) setFlag('stonesCrossed'); return; }
  countPrev = 0;
  // The stone tips, and Ouro wades back to the near bank through the water.
  void f.runBusy(async () => {
    sfx('hitBig');
    f.shakeT = 8;
    f.flashT = 6;
    await wait(16);
    await f.walkPlayer((f.y < 9 ? 'd'.repeat(9 - f.y) : 'u'.repeat(f.y - 9)) + 'l'.repeat(Math.max(0, f.x - 25)));
    f.dir = 1;
  });
});

defProp('pebbles', {
  w: 8, h: 8,
  paint(x, y) {
    for (const [k, n] of Object.entries(STONES)) {
      const [tx, ty] = k.split(',').map(Number);
      const px = x + (tx - 27) * 8, py = y + (ty - 6) * 8;
      for (let i = 0; i < n; i++) rect(px + 1 + (i % 4) * 2, py + 2 + Math.floor(i / 4) * 2, 1, 1, i % 2 ? '#e8e0d0' : '#a89880');
    }
  },
});

defMap({
  id: 'brookwood', name: 'The Brook Wood', region: 34, music: 'brook',
  rows: [
    'TTTTTTTTTTTTT#j#TTTTTTTTTTTTTT~~TTTTTTTTTTTT',
    'TTTTTTTTrrrrr.=.TTTTTTTTTTTTTT~~TTTTTTTTTTTT',
    'TTTTTTTTrrrrr.=...,,TTTTTTTTTT~~TTTTTTTTTTTT',
    'TTTTTTTThhdhh.=..,,,,TTTTTTTTT~~TTTTTTTTTTTT',
    'TTTTTTT.......=.,,,,,,TTTTTTTT~~TTTTTTTTTTTT',
    'TTTTTTTT......=..,,,,TTTTTTTTT~~..rrrr.TTTTT',
    'TTTTTTTTT.....=...,,TTTTTTT~~~~~..hhqh.TTTTT',
    'TTTTTTTTTTTTT.=.TTTTTTTTTTT~~~~~.......TTTTT',
    'TTTTTTTTTTTTTT=TTTTTTTTT...~~~~~.......TTTTT',
    'TTTTTTTTTTTTTT===========..~~~~~.......TTTTT',
    'TTTTTTTTTT....=......TTT...~~~~~.......TTTTT',
    'TTTTTTTTT.....=.......TTTTT~~~~~.......TTTTT',
    'TTTTTTTT....,.=........TTTT~~~~~.......TTTTT',
    'TTT...T..,,,,,=,........TTTTTT~~TTTT=TTTTTTT',
    '==.......,,,,,=,........TTTTTT~~TTTT=TTTTTTT',
    'TTT.....,,,,,,=,,........TTTTT~~TTTT=TTTTTTT',
    'TTTTTTT..,,,,,=,...,,,..TTTTTT~~TTTT=TTTTTTT',
    'TTTTTTT..,,,,,=,.,,,,,,,TTTTTT~~TTTT=.TTTTTT',
    'TTkkkkkkk...,.=.,,,,,,,TTTTTTT~~TTT.....TTTT',
    'TTkkkkkkk.....=..,,,,,TTTTTTTT~~TT.......TTT',
    'TTkk...kk.....=....,,TTTTTTTTT~~TT....,..TTT',
    'TTkk.,.kk.TTTT=..TTTTTTTTTTTTT~~T...,,,,,.TT',
    'TTkk...kkTTTTT=TTTTTTTTTTTTTTT~~T...,,,,,.TT',
    'TTkkkkkkkTTTTT=TTTTTTTTTTTTTTT~~...,,,,,,,TT',
    'TTkkkkkkkTTT..================::....,,,,,..T',
    'TTTTTTT.......=...,,TT........::....,,,,,..T',
    'TTTTTT........=..,,,,TTTTTTTTT~~......,....T',
    'TTTTT....,,,....,,,,,,TTTTTTTT~~T.........TT',
    'TTTT..,,,,,,,,,..,,,,,.TTTTTTT~~T..,......TT',
    'TTTT....,,,,,,,,..,,,.TTTTTTTT~~T.,,,.....TT',
    'TTTT....,,,,,,,......TTTTTTTTT~~TT,,,,...TTT',
    '====.....,,,........TTTTTTTTTT~~TT,,,....TTT',
    'TTTTTTTTTTTT...TTTTTTTTTTTTTTT~~TTT,....TTTT',
    'TTTTTTTTTTTTT=TTTTTTTTTTTTTTTT~~TTTTT.TTTTTT',
    'TTTTTTTTTTTTT=TTTTTTTTTTTTTTTT~~TTTTTTTTTTTT',
    'TTTTTTTTTTTTT=TTTTTTTTTTTTTTTT~~TTTTTTTTTTTT',
  ],
  mods: [
    ...Object.keys(STONES).map(k => { const [x, y] = k.split(',').map(Number); return { x, y, ch: '&', when: () => true }; }),
    { x: 14, y: 0, ch: '=', when: () => !!flag('gate_s') },
  ],
  warps: [
    { x: 13, y: 35, to: 'fellside', tx: 13, ty: 1, dir: 0 },
    { x: 0, y: 14, to: 'rib', tx: 21, ty: 1, dir: 3 },
    { x: 0, y: 31, to: 'route1', tx: 12, ty: 1, dir: 3 },
  ],
  zone: { kinds: kinds([['hare', 3], ['stoat', 2], ['burr', 3], ['dandle', 2], ['mawkin', 1]]), lv: [2, 4], n: 10, area: 'ferns' },
  props: [{ x: 27, y: 6, pic: 'pebbles' }],
  // Before Tack's battle, both ways west turn Ouro back: the road to Rib and the path down to the Midden Road.
  triggers: [
    { x: 1, y: 14, w: 1, h: 1, script: 'tackCallsRib', when: () => !flag('tack1') },
    { x: 2, y: 31, w: 1, h: 1, script: 'tackCallsRoad', when: () => !flag('tack1') },
  ],
  npcs: [
    { id: 'gatekeeper_s', x: 15, y: 1, sprite: 'keeper', name: 'Gatekeeper', dir: 3, talk: 'gateS' },
    { id: 'tackboard', x: 25, y: 8, sprite: 'sign', name: null as any, lines: ['A board nailed to a tree. In Tack\'s writing: 1 then 2. Easy.'] },
    { id: 'brooksleeper', x: 36, y: 15, sprite: 'stone', mon: 'stump', name: 'Kankabu', sleeper: { kind: 'stump', lv: 9, flag: 'sl_brook' } },
    standingWild('brookhart', 5, 21, 'hart', 9),
    standingWild('brookmawkin', 38, 22, 'mawkin', 6),
    { id: 'brookboy', x: 18, y: 15, sprite: 'boy', name: 'Boy', wander: true, lines: ['Tack says he crossed the stones when he was six. I\'ve crossed them zero times. Tack counts it.'] },
  ],
  spots: [
    look(35, 6, 'Tack\'s old den. On the wall, a tally: one mark. Under it, in a small hand: "me".'),
    stash('bw_den', 36, 6, 'In the back of Tack\'s den, under his first tally, a cork on a string.', { notion: 'floatcork' }),
    stash('bw_east', 40, 27, 'Under a root on the east bank, a smelling salt in a twist of paper.', { notions: [['smellingsalt', 1]] }),
    look(14, 0, 'A gate in a wall of fitted stones. Past it the trees get older and the ground starts to climb.'),
  ],
});
SPAWNS.brookwood = [13, 34];

// The south gatekeeper works for Fid, and talks in lengths the way Fid does: every answer ends on a measure.
defScript('gateS', gatekeeper('s', 'Fid', {
  shut: 'Gate\'s shut. Shut by the Apex, nine spans of oak. No seal, no gate, no matter how far you came.',
  read: 'Black spiral. Apex seal, sure as a span is a span. Stand back three.',
  open: 'Open from this side now. The Gate Ring\'s past it, a long walk round, and every step a span.',
}));

// ---------------------------------------------------------------- Turnstone's new rooms

defMap({
  id: 'tackhouse', name: 'Tack\'s house', region: 11, indoor: true, music: 'home',
  rows: room(['________', '__cc____', '__cc____', '________', '________', '________']),
  warps: roomDoor('fellside', 17, 6),
  npcs: [{ id: 'tackmumin', x: 6, y: 3, sprite: 'villager', name: 'Tack\'s mum', dir: 3, lines: () => tackMum() }],
  spots: [
    look(2, 0, 'A wall of tally marks, four and a slash, counting down to Turning Day.', 'The last mark is pressed in so hard it went through the plaster.'),
    look(7, 0, 'More marks. These count up. They start the day after Turning Day and do not stop.'),
  ],
});

function tackMum(): string[] {
  const n = (G.flags.tackWins || 0) + Object.keys(G.beaten).length;
  if (!flag('slipday')) return ['He\'s been in the square since before light. Don\'t tell him I said he\'s nervous.'];
  if (chapter() <= 2) return [`He writes you down every night. ${n} so far, he says. I don't ask what of.`];
  if (chapter() <= 5) return ['Letter came. Two lines. One was a number. That\'s my boy, that is.'];
  return ['He counts the crazes now. Says they\'re ahead. I said what of. He said everything.'];
}

defMap({
  id: 'shellhouse', name: 'The shelf house', region: 11, indoor: true, music: 'home',
  rows: room(['p_p_p_p_', '________', '________', 'p______p', '________', '________']),
  warps: roomDoor('fellside', 15, 22),
  npcs: [{ id: 'basketin', x: 4, y: 3, sprite: 'basket', name: 'Woman with a basket', dir: 0, lines: ['Oh, the basket? Shells. I dust every one so they know somebody still lives here.', 'That one\'s my mother\'s. That one\'s my mother. She turned late, like you.'] }],
  spots: [look(1, 1, 'Shells on a shelf, dusted, each with a name on a scrap of paper. The names are of people.')],
});

defMap({
  id: 'oldshell', name: 'The old shell', region: 11, indoor: true, music: 'home',
  rows: room(['________', '________', '______%_', '________', '________', '________']),
  warps: roomDoor('fellside', 12, 28),
  npcs: [],
  spots: [look(3, 0, 'The inside of the old man\'s first house. It is very quiet, and smells of him, younger.')],
});
CRUST_FINDS['oldshell:7,3'] = { items: [['lure', 1]], rind: 200 };

// ---------------------------------------------------------------- Rib's new rooms

defMap({
  id: 'ribhouse', name: 'The porch house', region: 11, indoor: true, music: 'home',
  rows: room(['__cc____', '________', '________', '________', '________', '________']),
  warps: roomDoor('rib', 7, 5),
  npcs: [
    { id: 'porchman', x: 6, y: 2, sprite: 'villager2', name: 'Porch man', dir: 3, lines: ['Mum\'s cast sits up on the porch. Mum sits in the yard. Tea goes to both. Saves arguing.'] },
    { id: 'porchkid', x: 2, y: 4, sprite: 'child', name: 'Porch kid', dir: 1, lines: ['I\'m not allowed on the porch. The porch is full. Of grandma. Both of her.'] },
  ],
});

defMap({
  id: 'carverhouse', name: 'The carver\'s', region: 11, indoor: true, music: 'home',
  rows: room(['p_p_p_p_', '________', '_cccc___', '________', '________', '________']),
  warps: roomDoor('rib', 28, 5),
  npcs: [{ id: 'carver', x: 3, y: 2, sprite: 'tanner', name: 'Carver', talk: 'carver' }],
});

// The carver puts "on it" at the end of what he says, the way he talks about everything he cuts.
defScript('carver', async () => {
  await say('Carver', 'I carve names in shell. A cowrie a letter. A good name\'s cheap, on it.');
  const all = [...G.party, ...G.rack];
  if (!all.length) return;
  const i = await listMenu('Rename which?', all.map(monLine), { w: 140 });
  if (i < 0) return;
  const m = all[i];
  await say('Carver', `What name, on it? I'll carve it right on its back.`);
  const name = await run<string | null>(new NameEntry());
  if (!name) { await say('Carver', 'Keep the old one, then. It\'s wearing in nice, on it.'); return; }
  const cost = name.length;
  if (G.rind < cost) { await say('Carver', `${cost} cowries, that. You've ${G.rind}. Shorter name, on it?`); return; }
  G.rind -= cost;
  const old = m.name;
  m.name = name;
  sfx('ok');
  save();
  await act('carver', 'nod');
  await notice(`${old} is ${name} now, for ${cost} cowries.`);
});

// ---------------------------------------------------------------- the Islander's hut

defMap({
  id: 'islanderhut', name: 'The Islander\'s hut', region: 11, indoor: true, music: 'home',
  rows: room(['________', '_c______', '________', '________', '________', '________']),
  warps: roomDoor('cocklecove', 10, 7),
  npcs: [],
  spots: [
    look(2, 2, 'A table made from a door that is not her door. One bowl. One cup.'),
    look(6, 0, 'A window someone gave her. It looks the wrong way, at the hill, so she has hung a shell over it.'),
  ],
});

void HERO; void hasKey;
