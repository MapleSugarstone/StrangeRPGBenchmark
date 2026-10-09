// Region 5 of the ring: the Gantry Shore and puzzle 7 (the gantries), the trader in Hum, and the north gatekeeper.
import { NOTIONS } from '../battle/registry';
import { NOTION_IDS } from '../data/notions';
import { sfx } from '../engine/audio';
import { rect } from '../engine/screen';
import { choose, field, flag, hint, narr, say, setFlag, wait } from '../game/api';
import { listMenu } from '../game/menus';
import { defProp } from '../game/props';
import { G, save } from '../game/state';
import { defMap, defScript, SPAWNS } from '../game/world';
import { PUZZLE_DATA } from '../tools/worldcheck';
import { kinds, look, stash } from './areakit';
import { gatekeeper, giveKeyItem, hasKey, room, roomDoor } from './ring';
import { holmSeen } from './ring3';

// ---------------------------------------------------------------- puzzle 7: the gantries

/**
 * Four Riders' cranes in a row along the shore. Each arm points a quarter turn: 0 at the sea (up the screen), 1 east, 2 down the shore, 3 west.
 * Turning a crane a quarter clockwise turns each neighbor a quarter the other way. The cage comes up when every arm points at the sea.
 */
const CRANE_X = [10, 18, 26, 34];
const CRANE_START = [1, 3, 2, 1];
const arm = (i: number) => (flag('crane' + i) ? flag('crane' + i) - 1 : CRANE_START[i]);
const caged = () => !!flag('gantryDone');

defScript('gantryCrane', async () => {
  const [fx] = field.facing();
  const i = CRANE_X.findIndex(x => fx === x || fx === x + 1);
  if (i < 0) return;
  if (caged()) return;
  if (!(field.wearing && field.leadTypes().includes('GEAR'))) { await hint('An old crane of the Riders. Wear a GEAR whorl to turn its gears.'); return; }
  const turn = (k: number, by: number) => { if (k >= 0 && k < 4) setFlag('crane' + k, ((arm(k) + by + 4) % 4) + 1); };
  turn(i, 1); turn(i - 1, -1); turn(i + 1, -1);
  sfx('guard');
  field.shakeT = 4;
  await wait(16);
  if ([0, 1, 2, 3].every(k => arm(k) === 0)) {
    setFlag('gantryDone');
    sfx('level');
    field.flashT = 8;
    await wait(30);
  }
  save();
});

/** The four arms out over the water, and the cage hanging from the last one, up on the shore once it comes in. */
defProp('gantryarms', {
  w: 30, h: 4,
  paint(x, y, t) {
    const D = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    CRANE_X.forEach((cx, i) => {
      // A pole up from the crane's base, and the arm from its top a quarter turn at a time.
      const bx = x + (cx - 10) * 8 + 8, top = y - 24;
      const [dx, dy] = D[arm(i)];
      rect(bx - 1, top, 2, 24, '#2a3240');
      for (let k = 0; k < 18; k++) rect(bx + dx * k - 1, top + dy * k, 3, 2, k % 4 === 0 ? '#ffb020' : '#6c7888');
      if (i === 3 && !caged()) { const ex = bx + dx * 17, ey = top + dy * 17; rect(ex, ey, 1, 10, '#2a3240'); rect(ex - 3, ey + 10 + (t >> 5) % 2, 7, 6, '#566880'); rect(ex - 2, ey + 11 + (t >> 5) % 2, 5, 4, '#c8ccd2'); }
    });
    if (caged()) { rect(x + 28 * 8, y + 2 * 8 + 1, 7, 6, '#566880'); rect(x + 28 * 8 + 1, y + 2 * 8 + 2, 5, 4, '#c8ccd2'); }
  },
});

PUZZLE_DATA.extra.push(() => {
  // Every start is solvable with four cranes. Check this one by breadth first search.
  const seen = new Set([CRANE_START.join('')]);
  let frontier = [CRANE_START];
  for (let d = 0; d < 16 && frontier.length; d++) {
    const next: number[][] = [];
    for (const s of frontier) {
      if (s.every(v => v === 0)) return d >= 3 ? null : `puzzle 7: solved in ${d} turns, too few`;
      for (let i = 0; i < 4; i++) {
        const n = s.slice();
        n[i] = (n[i] + 1) % 4;
        if (i > 0) n[i - 1] = (n[i - 1] + 3) % 4;
        if (i < 3) n[i + 1] = (n[i + 1] + 3) % 4;
        const k = n.join('');
        if (!seen.has(k)) { seen.add(k); next.push(n); }
      }
    }
    frontier = next;
  }
  return 'puzzle 7: the gantries cannot be turned to the sea from their start';
});

defMap({
  id: 'gantry', name: 'The Gantry Shore', region: 39, music: 'gantry',
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~T',
    'TsssssssssmmssssssmmssssssmmssssssmmsssssssssssT',
    'TsssssssssmmssssssmmssssssmmssssssmmsssssssssssT',
    'TssssssssssssssssssssssssssssssssssssssssssssssT',
    'T..............................................T',
    'T..............................................T',
    '================================================',
    'T..............................................T',
    'T...,,,,,,,,,.......T...............,,,,,,,....T',
    'T..,,,,,,,,,,,.........,,,.........,,,,,,,,,.T.T',
    'T.,,,,,,,,,,,,,.....,,,,,,,,,.....,,,,,,,,,,,..T',
    'T..,,,,,,,,,,,.....,,,,,,,,,,,.....,,,,,,,,,...T',
    'T...,,,,,,,,,...T...,,,,,,,,,..T....,,,,,,,....T',
    'T......,,,.............,,,............,,,......T',
    'T......T...............................TT......T',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  warps: [
    { x: 0, y: 14, to: 'bole', tx: 21, ty: 1, dir: 3 },
    { x: 47, y: 14, to: 'hum', tx: 1, ty: 8, dir: 1 },
  ],
  tileTalk: { m: 'gantryCrane' },
  zone: { kinds: kinds([['crane', 3], ['turbine', 2], ['piston', 3], ['aerial', 2], ['vane', 1]]), lv: [27, 31], n: 9, area: 'wire grass' },
  props: [{ x: 10, y: 9, pic: 'gantryarms' }, { x: 20, y: 3, pic: 'holmfar', when: holmSeen(5) }],
  npcs: [
    { id: 'craneman', x: 14, y: 12, sprite: 'tanner', name: 'Crane-minder', dir: 2, lines: ['Four cranes, all on shift since the Riders turned. Turn one, the next ones turn back. Union rules.'] },
    { id: 'gantrytrainer', x: 30, y: 15, sprite: 'villager2', name: 'Rigger', dir: 2, trainer: { name: 'Rigger', team: [['crane', 29], ['aerial', 29]], intro: 'I climb the cranes for the view. The view\'s the Lip. Same as yesterday. I keep checking.', defeat: 'Still the Lip. Good.', sight: 3 } },
  ],
  spots: [
    { x: 38, y: 11, when: () => caged() && !hasKey('lore_vane') && !flag('back_lore_vane'), script: async () => { await giveKeyItem('lore_vane', 'Ouro takes a tin fish on a pole out of the cage.'); } },
    stash('gs_tins', 44, 12, 'Under an upturned bucket by the last crane, a Rider tin.', { items: [['ridertin', 1]] }),
    look(22, 12, 'The Lipwater, flat and gray under the cranes. Far off, the Lip.'),
  ],
});
SPAWNS.gantry = [1, 14];

// ---------------------------------------------------------------- the trader

// The trader asks every price as a question, as if the deal were still being decided.
const TRADE_STOCK = ['ridercog', 'graftwax', 'bladeshard', 'tidemark', 'floatcork'];
defMap({
  id: 'humtrader', name: 'The trader\'s', region: 11, indoor: true, music: 'hum',
  rows: room(['p_p_p_p_', '________', '_cccc___', '________', '________', '________']),
  warps: roomDoor('hum', 34, 13),
  npcs: [{ id: 'trader', x: 3, y: 2, sprite: 'hummer', name: 'Trader', dir: 0, talk: 'humtrade' }],
});

defScript('humtrade', async () => {
  await say('Trader', 'Two notions for one, mm? Any two of yours for one of mine? Fair, mm?');
  const i = await listMenu('Trade for', TRADE_STOCK.map(id => NOTIONS[id]?.name || id), { w: 120 });
  if (i < 0) return;
  const want = TRADE_STOCK[i];
  const mine = () => NOTION_IDS.filter(id => (G.notions[id] || 0) > 0);
  const total = mine().reduce((n, id) => n + G.notions[id], 0);
  if (total < 2) { await say('Trader', 'Two, mm? You\'ve got fewer than two in your bag. Come back heavier?'); return; }
  for (let k = 0; k < 2; k++) {
    const have = mine();
    const j = await listMenu(`Give ${k ? 'a second' : 'one'}`, have.map(id => `${NOTIONS[id].name} x${G.notions[id]}`), { w: 140 });
    if (j < 0) { await say('Trader', 'Changed your mind, mm? Happens to the best of us, mm?'); return; }
    G.notions[have[j]]--;
  }
  G.notions[want] = (G.notions[want] || 0) + 1;
  sfx('ok');
  await say('Trader', `${NOTIONS[want].name}, then? Pleasure, mm?`);
  save();
});

// The north gatekeeper works for Hasp, and asks after Ouro's hands.
defScript('gateN', gatekeeper('n', 'Hasp', {
  shut: 'Shut?? Shut. Seal?? No seal in your hands??',
  read: 'Apex seal?? Apex seal. Steady?? Are they, your hands?? Through, then.',
  open: 'Open?? Open. The Ring\'s past it. Mind them going round, your hands??',
}));

void choose;
