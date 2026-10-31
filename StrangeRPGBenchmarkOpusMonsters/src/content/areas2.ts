// Optional areas, chapters 3 to 6: the Underspire, the Rootfall, the Dropfield, the Iceshelf.
import { sfx } from '../engine/audio';
import { text } from '../engine/font';
import { INK, rect } from '../engine/screen';
import { PEOPLE } from '../engine/sprites';
import { act, bell, choose, emote, face, faceToward, field, morph, morphTo, narr, notice, pan, panBack, say, shake, sound, wait } from '../game/api';
import { G, flag, setFlag } from '../game/state';
import { defMap, defScript, MAPS } from '../game/world';
import { strandFx } from '../game/strandfx';
import { GRAPH_PUZZLES, WALK_PUZZLES, type Move } from '../tools/worldcheck';
import { kinds, link, look, reward, rows, stash } from './areakit';
import { payoff, prize } from './puzzlekit';

const has = (s: string) => G.scales.includes(s);
const pale = (id: string) => () => ({ px: (PEOPLE[id] || PEOPLE.child).px, c: ['#e4eef4', '#c8d8e4'] as [string, string] });

// ---------------------------------------------------------------- the Underspire: the bells

link('spirecrypt', 8, 1, 'q', { to: 'underspire', tx: 2, ty: 2, dir: 2 }, () => has('spire'));

// Three bells hang over the loft above the floor door. A struck bell rings a set number of steps later, for two steps,
// and the floor door opens while all three ring together. Each bell shows its count. The bells stop when Ouro leaves the
// loft. The slow Second is struck first, the Tenor when the Second shows ten, and the Treble when both show four, which
// sends Ouro back and forth across the loft. Fewest moves: 21.
const LOFT_BELLS = [
  { x: 10, name: 'Treble', delay: 4, tone: 12 },
  { x: 12, name: 'Second', delay: 12, tone: 7 },
  { x: 15, name: 'Tenor', delay: 10, tone: 0 },
];
const LOFT_RING = 2, LOFT_DOOR = [12, 13];
/** Each bell: 0 silent, 1 to its delay counting down, and above its delay ringing. */
const loftBells = LOFT_BELLS.map(() => 0);
const loftRinging = (st: number[], i: number) => st[i] > LOFT_BELLS[i].delay;
const loftChord = (st: number[]) => st.every((_, i) => loftRinging(st, i));
const loftTick = (st: number[]) => st.map((v, i) => {
  const d = LOFT_BELLS[i].delay;
  if (!v) return 0;
  if (v <= d) return v === 1 ? d + LOFT_RING : v - 1;
  return v === d + 1 ? 0 : v - 1;
});
const inLoft = (x: number, y: number) => (x >= 10 && x <= 15 && y >= 10 && y <= 12) || (x === 9 && y === 10) || (y === 13 && LOFT_DOOR.includes(x));

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
    '###______#K#KppK#______###',
    '###___,,,_______#,,____###',
    '#_cc_cc_cc______#_cc_cc__#',
    '#___,,,,_#______#,,,_____#',
    '##########################',
    '#########_______##########',
    '#########___p___##########',
    '##########################',
  ]),
  mods: [{ x: 12, y: 13, w: 2, ch: '_', when: () => !!flag('bellsDone') || loftChord(loftBells) || (field.y === 13 && LOFT_DOOR.includes(field.x)) }],
  warps: [{ x: 2, y: 1, to: 'spirecrypt', tx: 8, ty: 2, dir: 2 }],
  enter: 'underspireEnter',
  zone: { kinds: kinds([['tenor', 2], ['glaze', 2], ['pipe', 2], ['pew', 3], ['relic', 2], ['censer', 2]]), lv: [9, 11], n: 8, area: 'nave' },
  npcs: [
    { id: 'sexton', x: 5, y: 12, sprite: 'elder', name: 'Sexton', dir: 1, talk: 'sexton' },
    { id: 'bellstriker', x: 20, y: 6, sprite: 'ringer', name: 'Bell-striker', dir: 3, trainer: { nacre: 1, name: 'Bell-striker', team: [['tenor', 9], ['pipe', 9]], intro: 'I strike the bells with a stick. The ropes are on the far side of the ground, so... stick.', defeat: 'Ooh. That tone was off.', sight: 3 } },
    { id: 'glazier', x: 4, y: 7, sprite: 'elder', name: 'Glazier', dir: 0, trainer: { name: 'Glazier', team: [['glaze', 10], ['censer', 10]], intro: 'I fix windows. Now they\'re on the floor, so I crawl. My knees hate it.', defeat: 'Watch the glass. Watch it!', sight: 3 } },
    { id: 'pewsitter', x: 23, y: 11, sprite: 'villager2', name: 'Pew-sitter', dir: 2, trainer: { name: 'Pew-sitter', team: [['pew', 10], ['relic', 10]], intro: 'I sat before it flipped. Haven\'t risen. Didn\'t want to be rude.', defeat: 'The pew is directly above me now. Same pew. Same indentation.', sight: 2 } },
  ],
  spots: [
    ...LOFT_BELLS.map((b, i) => ({ x: b.x, y: 9, script: async () => {
      // A bell that is counting or ringing swings too hard to strike again.
      if (loftBells[i]) { sound('bump'); return; }
      loftBells[i] = b.delay;
      bell(b.tone);
      await act('ouro', 'nod');
    } })),
    look(12, 3, 'The font hangs from the ceiling, inverted. It still holds water, which is salt.'),
    look(9, 6, 'Stained glass embedded in the floor. Beyond it, more sky. A star streaks past.'),
    stash('us_pew', 22, 11, 'Wedged beneath a pew, a notion that has been sat upon for a long time.', { notion: 'bitterroot' }),
  ],
});
MAPS.underspire.npcs.push(prize('us_room', 12, 15, 'On a stand in the hidden room, a nautilus horn and a scallop shell lined with nacre.', { pegs: ['iron', 1], tan: 6 }));

field.stepHooks.push(f => {
  if (f.map.id !== 'underspire') return;
  if (f.y >= 14 && !flag('bellsDone')) setFlag('bellsDone');
  if (!inLoft(f.x, f.y)) { loftBells.fill(0); return; }
  const was = loftChord(loftBells);
  loftTick(loftBells).forEach((v, i) => { loftBells[i] = v; });
  LOFT_BELLS.forEach((b, i) => { if (loftRinging(loftBells, i)) bell(b.tone); });
  if (!LOFT_BELLS.some((_, i) => loftRinging(loftBells, i)) && loftBells.some(v => v)) sfx('blip');
  // The chord: the floor door opens with a star on it and a shake.
  if (loftChord(loftBells) && !was && !flag('bellsDone')) { f.shakeT = 10; strandFx.landings.push({ x: LOFT_DOOR[0], y: 13, t: 0 }); sfx('level'); }
  if (!f.overlay) f.overlay = loftOverlay;
});
/** The count on each bell: its delay while silent, the steps left while counting, and the steps left ringing in white. */
function loftOverlay(f: typeof field): void {
  if (f.map.id !== 'underspire' || flag('bellsDone')) return;
  LOFT_BELLS.forEach((b, i) => {
    const x = b.x * 8 - f.cam[0], y = 9 * 8 - f.cam[1], v = loftBells[i], ring = loftRinging(loftBells, i);
    rect(x + 1, y, 7, 7, INK);
    text(String(!v ? b.delay : ring ? v - b.delay : v), x + 2, y, ring ? '#ffffff' : v ? '#f0c040' : '#8a8aa8');
  });
}

defScript('underspireEnter', async () => { loftBells.fill(0); field.overlay = loftOverlay; });

{
  type LoftS = { x: number; y: number; b: number[] };
  const grid = MAPS.underspire.rows.map(r => r.split(''));
  const start: LoftS = { x: 9, y: 10, b: LOFT_BELLS.map(() => 0) };
  const moves = (s: LoftS): Move<LoftS>[] => {
    const out: Move<LoftS>[] = [];
    // Once Ouro is down in the hidden room the door stays open, so the way out is free.
    if (s.y >= 14) return [{ to: start, cost: 0, reset: true }];
    for (let d = 0; d < 4; d++) {
      const nx = s.x + [0, 1, 0, -1][d], ny = s.y + [1, 0, -1, 0][d];
      if (ny >= 14) { if (s.y === 13) out.push({ to: { x: nx, y: ny, b: s.b }, cost: 1 }); continue; }
      if (!inLoft(nx, ny)) { if (nx === 8 && ny === 10) out.push({ to: start, cost: 0, reset: true }); continue; }
      const door = ny === 13;
      if (door ? !(loftChord(s.b) || s.y === 13) : grid[ny][nx] !== '_') continue;
      out.push({ to: { x: nx, y: ny, b: loftTick(s.b) }, cost: 1 });
    }
    LOFT_BELLS.forEach((b, i) => {
      if (!s.b[i] && s.x === b.x && s.y === 10) out.push({ to: { x: s.x, y: s.y, b: s.b.map((v, k) => (k === i ? b.delay : v)) }, cost: 1 });
    });
    return out;
  };
  GRAPH_PUZZLES.push({
    name: 'Underspire loft', floor: 8, start, key: (s: LoftS) => `${s.x},${s.y},${s.b.join('.')}`, moves,
    goal: (s: LoftS) => s.y >= 14, exit: (s: LoftS) => s.x === 9 && s.y === 10,
    without: [['without striking', (s: LoftS) => moves(s).filter(m => m.to.x !== s.x || m.to.y !== s.y || m.reset)]],
    show: (s: LoftS) => `${s.x},${s.y} bells ${s.b.join(' ')}`, prize: { map: 'underspire', at: [12, 15], view: [9, 10] },
  });
}

// The Sexton dates every line by a year of his own life.
defScript('sexton', async () => {
  if (flag('bellsDone')) { await say('Sexton', 'They rang true in my ninth year, and again in my eightieth. The first time, I went in.');
  await say('Sexton', 'This time, you.'); return; }
  await say('Sexton', 'When I was nine, the three bells tolled together and the distant floor split open. I was small.');
  await say('Sexton', 'It was vast.');
  await say('Sexton', 'At twenty, people struck them individually, arguing over the count. Each one was late.');
  await say('Sexton', 'No one has found it since. I stopped searching in the spring of my sixtieth year.');
  await say('Sexton', 'What a lovely spring it was.');
});

// ---------------------------------------------------------------- the Rootfall: the saplings

MAPS.bole.warps.push({ x: 0, y: 23, to: 'rootfall', tx: 30, ty: 9, dir: 3 });

// The Bole hall's rule with three saplings: the roots' floor is slick ('I'), posts ('p') stop a slide, and touching a
// sapling ('i') grows its root along its groove or takes it back. All three roots are stops on the way: one holds Ouro
// beside a sapling's far side, one is the floor under it, and the third is grown and then taken back so the last slide
// along the row runs through. Stepping off the floor below it takes every root back. Fewest moves: 21.
const ROOTFALL_SAPLINGS = [
  { flag: 'rfRoot0', at: [16, 7] as [number, number], root: [[15, 7], [14, 7]] as [number, number][], groove: 'boleGrooveH' },
  { flag: 'rfRoot1', at: [16, 11] as [number, number], root: [[16, 10], [16, 9], [16, 8]] as [number, number][], groove: 'boleGrooveV' },
  { flag: 'rfRoot2', at: [18, 12] as [number, number], root: [[17, 12], [16, 12], [15, 12], [14, 12]] as [number, number][], groove: 'boleGrooveH' },
];
const ROOTFALL_FOOT: [number, number] = [17, 14];

defMap({
  id: 'rootfall', name: 'The Rootfall', region: 17, music: 'route',
  rows: rows(32, '#', [
    '################################',
    '#,,,,,,,T..............T,,,,,,,#',
    '#,kkk,,TT..............TT,,kkk,#',
    '#,k,,,,TTTTTTTTTTTITTTTTT,,,,k,#',
    '#,k,kk,TTIIpIIIIIIIIpIITT,kk,k,#',
    '#,,,k,,TTIIIIIIIIIIIIIITT,,k,,,#',
    '#kk,k,,TTIIIIIIIIIIIIIITT,,k,kk#',
    '#,,,,,,TTIIIIIIIiIIIIIITT,,,,,,#',
    '#,kkkk,TTIIIIIIIIIIpIIITT,kkkk,#',
    '#,,,,,,TTIIIIIIIIIIIIIITT,,,,,,=',
    '#,kk,,,TTIIIpIIIIIIpIIITT,,,kk,#',
    '#,kk,,,TTIIIIIIIiIIIIIITT,,,kk,#',
    '#,,,,,,TTIIIIIIIIIiIIIITT,,,,,,#',
    '#,,k,,,TTTTTTTTTTITTTTTTT,,,k,,#',
    '#,,k,,,T,,,,,,,,,,,,,,,,T,,,k,,#',
    '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
    '#,,,,,kkk,,,,,,,,,,,,,kkk,,,,,,#',
    '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
    '#,kkk,,,TT,,,,,,,,,,,,,,TT,,kkk#',
    '#,,,,,,,TT,,,,,,..,,,,,,TT,,,,,#',
    '#,,,,,,,,,,,,,,,..,,,,,,,,,,,,,#',
    '################################',
  ]),
  mods: ROOTFALL_SAPLINGS.flatMap(sp => sp.root.map(([x, y]) => ({ x, y, ch: 'j', when: () => !!flag(sp.flag) }))),
  props: ROOTFALL_SAPLINGS.flatMap(sp => sp.root.map(([x, y]) => ({ x, y, pic: sp.groove, when: () => !flag(sp.flag) }))),
  tileTalk: { i: 'rootfallSapling' },
  warps: [{ x: 31, y: 9, to: 'bole', tx: 1, ty: 23, dir: 1 }],
  zone: { kinds: kinds([['taproot', 3], ['borer', 2], ['clod', 2], ['whip', 2], ['gnarl', 1], ['upfall', 2]]), lv: [11, 13], n: 13, area: 'roots' },
  npcs: [
    { id: 'upright', x: 5, y: 13, sprite: 'villager', name: 'The Upright Man', dir: 1, talk: 'upright' },
    { id: 'rootcutter', x: 4, y: 10, sprite: 'tanner', name: 'Root-cutter', dir: 0, trainer: { nacre: 1, name: 'Root-cutter', team: [['taproot', 12], ['whip', 12]], intro: 'I trim the roots, they sprout again, and I return. We\'ve had this routine for quite some time.', defeat: 'Until tomorrow, then. And the roots as well.', sight: 3 } },
    { id: 'beetlegirl', x: 27, y: 12, sprite: 'child', name: 'Beetle girl', dir: 3, trainer: { name: 'Beetle girl', team: [['borer', 12], ['clod', 13]], intro: 'Beetles dwell in the roots, and I live close to them. We\'re practically neighbors.', defeat: 'They\'re hiding now, so I\'m hiding too.', sight: 3 } },
    { id: 'upfaller', x: 16, y: 20, sprite: 'villager2', name: 'Upfaller', dir: 2, trainer: { name: 'Upfaller', team: [['upfall', 13], ['gnarl', 13]], intro: 'Rain travels upward through the Bole. On a good day, I rise with it, just a little. Maybe a toe.', defeat: 'Then it\'s not a good day.', sight: 3 } },
  ],
  spots: [
    look(21, 1, 'A face emerges from the roots, its eyes formed by two snail shells.', 'It has watched the slick floor for a very long time.'),
    look(29, 3, 'A bowl hangs upside down from a root. Rain falls upward into it and remains there.'),
    stash('rf_bark', 2, 13, 'Beneath the loose bark, a notion.', { notion: 'thornvest' }),
  ],
});

MAPS.rootfall.npcs.push(prize('rf_heart', 12, 1, 'Above the slick roots, resting on a bed of moss: a nautilus horn and a mussel lined with nacre.', { pegs: ['iron', 1], tan: 6 }));
defScript('rootfallSapling', async () => {
  const [fx, fy] = field.facing();
  const sp = ROOTFALL_SAPLINGS.find(sp => sp.at[0] === fx && sp.at[1] === fy);
  if (!sp) return;
  const grown = !!flag(sp.flag);
  // A root never grows through the tile Ouro stands on.
  if (!grown && sp.root.some(([x, y]) => x === field.x && y === field.y)) { sound('bump'); await act('ouro', 'shiver'); return; }
  sfx('switch');
  await morph(on => { G.flags[sp.flag] = (on ? !grown : grown) ? 1 : 0; }, grown ? sp.root[sp.root.length - 1] : sp.at, 4, false);
});
field.stepHooks.push(f => {
  if (f.map.id !== 'rootfall' || f.x !== ROOTFALL_FOOT[0] || f.y !== ROOTFALL_FOOT[1]) return;
  for (const sp of ROOTFALL_SAPLINGS) G.flags[sp.flag] = 0;
});
WALK_PUZZLES.push({
  name: 'Rootfall', map: 'rootfall', start: ROOTFALL_FOOT, goal: (x, y) => y <= 2 && x > 8 && x < 23, floor: 8,
  switches: ROOTFALL_SAPLINGS.map(sp => ({ flag: sp.flag, at: [sp.at] })), resets: [ROOTFALL_FOOT], exits: [ROOTFALL_FOOT],
  needs: ['ice', 'switches'], prize: { at: [12, 1], view: ROOTFALL_FOOT },
});

// The Upright Man gives a height in every line.
defScript('upright', async () => {
  if (flag('uprightDone')) { await say('The Upright Man', 'One full inch since you arrived!! And one inch is, six foot one, a tremendous amount.'); return; }
  if (!flag('uprightAsked')) {
    await say('The Upright Man', 'Six foot one. That was my height in the spring. A splendid spring, vertically speaking.');
    await say('The Upright Man', 'Not an inch more, now. The rain goes up here, you see. My feet get none of it. Parched.');
    setFlag('uprightAsked');
    return;
  }
  if (!flag('uprightBowl')) { await say('The Upright Man', 'Holding steady at six foot one, and thirsty at the ankle.'); return; }
  // Ouro tips the bowl of upward rain over his feet, and for once it falls down.
  await act('ouro', 'bow');
  sound('heal');
  await act('upright', 'hop');
  await say('The Upright Man', 'Six foot one. Ah.');
  await say('The Upright Man', 'Six foot one and a bit!! A BIT!! Someone measure me!!');
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

// The yard by the tower: the tower's signal runs west from it in straight lines, and each dish turns it ('R' slants like
// a slash, 'Q' like a backslash, flipped while its flag is set). The live signal ('L') blocks the ground it crosses, and a
// dish never sends it through Ouro. While it reaches the receiver in the yard's north wall, the gate beside it opens.
// Only the dish under the receiver has to end up turned, but the signal walls off every way to it, so the other dishes
// are turned to clear a path and turned back behind Ouro, the last of them from beside the gate. Fewest moves: 9.
const DROP_POSTS: [number, number][] = [[17, 7], [20, 7], [17, 10], [23, 10], [23, 12]];
const DROP_COIL: [number, number] = [20, 6], DROP_GATE: [number, number] = [23, 6], DROP_MOUTH: [number, number] = [16, 17];

defMap({
  id: 'skinfall', name: 'The Dropfield', region: 18, music: 'route',
  rows: rows(34, '#', [
    '##################################',
    '#,,,,..,,,,,,,,,..,,,,,,,,,,,,,,,#',
    '#,,xx,,,,,,,,,,,..,,,,,,,,,,xx,,,#',
    '#,xOOx,,,################,,xOOx,,#',
    '#,xOOx,,,#..............#,,xOOx,,#',
    '#,,xx,,,.#..............#,,,xx,,,#',
    '#,,,,,,,.###########O##j#,,,,,,,,#',
    '#,,,,,,,.#.......R..Q...#,,,,,,,,#',
    '#,,,,,,,.#........#.....#,,,,,,,,#',
    '#,,,,m,,.#........#.....#,,,m,,,,#',
    '#,,,,,,,.#.......Q.....Q#,,,,,,,,#',
    '#,,,,,,,.#........#.....#,,,,,,,,#',
    '#,,xx,,,.#........#....Qp,,,,,,,,#',
    '#,xOOx,,.#........#.....#x,,,,,,,#',
    '#,xOOx,,.#........#.....#x,,,,,,,#',
    '#,,xx,,,,#........#.....#,,,,,,,,#',
    '#,,,,,,,,#..............#,,,,xx,,#',
    '#,,,,,,,,#######.########,,,xOOx,#',
    '#,,,,,,,,,xx,,,,,,,,,,,,,,,,,xx,,#',
    '#,,,,,,,,,,,,,,,..,,,,,,,,,,,,,,,#',
    '#...............==...............#',
    '#################==###############',
  ]),
  warps: [
    { x: 17, y: 21, to: 'route5', tx: 20, ty: 1, dir: 2 },
    { x: 18, y: 21, to: 'route5', tx: 20, ty: 1, dir: 2 },
  ],
  zone: { kinds: kinds([['aerial', 2], ['vane', 2], ['capsule', 2], ['booster', 2], ['dish', 2], ['debris', 3]]), lv: [14, 16], n: 14, area: 'wreckage' },
  npcs: [
    { id: 'catcher', x: 27, y: 6, sprite: 'villager2', name: 'The Catcher', dir: 2, talk: 'catcher' },
    { id: 'scrapper', x: 6, y: 15, sprite: 'tanner', name: 'Scrapper', dir: 1, trainer: { nacre: 1, name: 'Scrapper', team: [['aerial', 15], ['debris', 15]], intro: 'It all crashed down in my gran\'s day. Still sorting it. Done one pile.', defeat: 'Alright. Join the pile.', sight: 3 } },
    { id: 'hullsleeper', x: 26, y: 15, sprite: 'villager', name: 'Hull-sleeper', dir: 3, trainer: { name: 'Hull-sleeper', team: [['capsule', 15], ['vane', 15]], intro: 'I sleep in a hull section that fell from the sky. One side stays warm, so I roll over constantly.', defeat: 'Off to bed. Warm side up.', sight: 3 } },
    { id: 'dishturner', x: 14, y: 18, sprite: 'child', name: 'Dish-turner', dir: 0, trainer: { name: 'Dish-turner', team: [['dish', 15], ['booster', 15]], intro: 'I spin the dishes to listen. Mostly it\'s just the wind. Once, I heard a cough.', defeat: 'Shh. Listen.', sight: 3 } },
  ],
  spots: [
    look(3, 3, 'A crater holds the shell of a machine that once soared high. It came down empty.'),
    look(24, 12, 'A tower from the old Riders\' era. It bears a number and a word no one reads anymore.', 'The word features a circle.'),
    { x: 29, y: 17, script: async () => {
      if (!flag('catcherAsked') || flag('catcherPlate')) { await emote('ouro', 'sweat'); return; }
      setFlag('catcherPlate');
      sound('ok');
      await notice('A warm plate.');
      await notice('Imprinted upon it is a pale, round landmass with a spiral and eight black dots along its edge.');
    } },
  ],
});

const dropBase = (x: number, y: number) => MAPS.skinfall.rows[y]?.[x];
/** Whether a dish slants like a slash now: its starting slant, flipped while its flag is set. */
const dropSlash = (i: number) => (dropBase(...DROP_POSTS[i]) === 'R') !== !!flag('dropPost' + i);
let dropKey = '', dropLive = { tiles: new Set<number>(), lit: false };
/** The ground the signal crosses for the dishes as they stand, and whether it reaches the receiver. */
function dropSignal(): { tiles: Set<number>; lit: boolean } {
  const key = DROP_POSTS.map((_, i) => flag('dropPost' + i)).join('');
  if (key === dropKey) return dropLive;
  const tiles = new Set<number>();
  let x = 24, y = 12, dx = -1, dy = 0, lit = false;
  for (let n = 0; n < 200; n++) {
    x += dx; y += dy;
    if (x === DROP_COIL[0] && y === DROP_COIL[1]) { lit = true; break; }
    const p = DROP_POSTS.findIndex(([px, py]) => px === x && py === y);
    if (p >= 0) { [dx, dy] = dropSlash(p) ? [-dy, -dx] : [dy, dx]; continue; }
    if (x < 10 || x > 23 || y < 4 || y > 16 || dropBase(x, y) !== '.') break;
    tiles.add(y * 64 + x);
  }
  dropKey = key; dropLive = { tiles, lit };
  return dropLive;
}
MAPS.skinfall.mods = [
  ...(MAPS.skinfall.mods || []),
  ...MAPS.skinfall.rows.flatMap((r, y) => [...r].flatMap((c, x) => (c === '.' && x >= 10 && x <= 23 && y >= 4 && y <= 16 ? [{ x, y, ch: 'L', when: () => dropSignal().tiles.has(y * 64 + x) }] : []))),
  ...DROP_POSTS.map(([x, y], i) => ({ x, y, ch: dropBase(x, y) === 'R' ? 'Q' : 'R', when: () => !!flag('dropPost' + i) })),
  { x: DROP_GATE[0], y: DROP_GATE[1], ch: '.', when: () => !!flag('dishesDone') || dropSignal().lit },
];
field.passHooks.push((f, _x, _y, ch) => (f.map.id === 'skinfall' && ch === 'L' ? false : null));
MAPS.skinfall.tileTalk = { ...(MAPS.skinfall.tileTalk || {}), R: 'dropDish', Q: 'dropDish' };
defScript('dropDish', async () => {
  const [fx, fy] = field.facing();
  const i = DROP_POSTS.findIndex(([x, y]) => x === fx && y === fy);
  if (i < 0) return;
  const k = 'dropPost' + i, old = G.flags[k] || 0, was = dropSignal().lit;
  G.flags[k] = 1 - old;
  const through = dropSignal().tiles.has(field.y * 64 + field.x);
  G.flags[k] = old;
  // A dish never sends the signal through Ouro.
  if (through) { sound('bump'); await act('ouro', 'shiver'); return; }
  sfx('switch');
  await morph(on => { G.flags[k] = on ? 1 - old : old; }, [fx, fy], 2, false);
  if (!was && dropSignal().lit) { bell(9); bell(4); await payoff(DROP_GATE); }
});
field.stepHooks.push(f => {
  if (f.map.id !== 'skinfall') return;
  if (f.x === DROP_MOUTH[0] && f.y === DROP_MOUTH[1]) DROP_POSTS.forEach((_, i) => { G.flags['dropPost' + i] = 0; });
  if (f.y <= 5 && f.x >= 10 && f.x <= 23 && !flag('dishesDone')) setFlag('dishesDone');
});
MAPS.skinfall.npcs.push(prize('df_hatch', 12, 4, 'Behind the receiver, a signal hatch opened: a notion, a nautilus horn, nacre.', { notion: 'chrysalis', pegs: ['iron', 1], tan: 4 }));
WALK_PUZZLES.push({
  name: 'The Dropfield', map: 'skinfall', start: DROP_MOUTH, goal: (x, y) => y >= 4 && y <= 5 && x >= 10 && x <= 23, floor: 8,
  switches: DROP_POSTS.map((p, i) => ({ flag: 'dropPost' + i, at: [p] })), solid: 'L', resets: [DROP_MOUTH], exits: [DROP_MOUTH],
  needs: ['switches'], prize: { at: [12, 4], view: DROP_MOUTH },
});

// The Catcher starts every line with "Up there" or "Down there".
defScript('catcher', async () => {
  if (flag('catcherDone')) { await say('The Catcher', 'Nothing today. Honestly, nothing up there for ages. There used to be something.'); return; }
  if (!flag('catcherAsked')) {
    await say('The Catcher', 'Something fell last night. It missed the tub by a wide margin.');
    await say('The Catcher', 'I can\'t look away, just in case. But it landed in a crater near the south rocks.');
    await say('The Catcher', 'Could you fetch it for me?');
    setFlag('catcherAsked');
    return;
  }
  if (!flag('catcherPlate')) { await say('The Catcher', 'Still nothing up here. It\'s at the south rocks. In a crater. Down there.'); return; }
  await act('ouro', 'bow');
  faceToward('catcher', 'ouro');
  await emote('catcher', 'surprise');
  await say('The Catcher', 'Oh. So that\'s what we look like from up there.');
  await emote('catcher', 'silence');
  face('catcher', 2);
  setFlag('catcherDone');
  await reward({ tan: 4, notion: 'longshin' });
});

// ---------------------------------------------------------------- the Iceshelf: ice with gusts

link('route6', 43, 14, '=', { to: 'iceshelf', tx: 1, ty: 9, dir: 1 });

// The wind blows across the shelf in streaks ('N' 'E' 'S' 'W'), and a streak turns a slide its way. The lane in the
// south-east corner shows that alone: a slide east is turned north into a nook, and a ledge drops out of it.
// The cast's hole is ringed by ice blocks and open only to the north. Fewest moves: 11. See Notes/puzzle-design.md.
const CAST: [number, number][] = [[15, 8], [16, 8], [15, 9], [16, 9]];
defMap({
  id: 'iceshelf', name: 'The Iceshelf', region: 19, music: 'tundra',
  rows: rows(34, '#', [
    '##################################',
    '#nn,,,,nnnnnnnnnnnnnnnnnnn,,,,,nn#',
    '#nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn#',
    '#nn~nnnnnnnnnnnnnnnnnnnnnnnn~nnnn#',
    '#n~~~nnnniiiiiiiiiiiniiinnn~~~nnn#',
    '#~~~~nnnnnIIIiIIiIIIIIIinnn~~~~nn#',
    '#n~~~nnnniIIIIiiIIWIInWinnn~~~nnn#',
    '#nnnnnnnniIIIIIIInIIIIIinnnnnnnnn#',
    '#nnnnnnnniIINIi~~iIIIIiinnnnnnnnn#',
    '=nnnnnnnniIIIIi~~iiIIIIinn,,,,,nn#',
    '#nnnnnnnniIiiIiiiIiWIIIinn,,,,,nn#',
    '#n,,,,nnniIIIIIIIIIIIIIinn,,,,,nn#',
    '#n,,,,nnniIIIIIiIiIIIIIinnnnnnnnn#',
    '#nnnnnnnnniIIIIIIIIIIWIinnnnnnnnn#',
    '#nnnnnnnniiiiiiiiiiiiiiinnnnnnnnn#',
    '#,,,,,nnnnnnnnnnnnnnnnnnnnnnnni^i#',
    '#,,,,,nnnnnnnnnnnnnnnnnnniiiiiini#',
    '#,,,,,nnnnnnnnnnnnnnnnnnnIIIIIINi#',
    '#nnnnnnnnnnnnnnnnnnnnnnnniiiiiiii#',
    '##################################',
  ]),
  warps: [{ x: 0, y: 9, to: 'route6', tx: 42, ty: 14, dir: 3 }],
  zone: { kinds: kinds([['selkie', 2], ['walrus', 2], ['berg', 2], ['narwhal', 2], ['rime', 3], ['auk', 1]]), lv: [17, 19], n: 13, area: 'drifts' },
  npcs: [
    { id: 'icefisher', x: 7, y: 12, sprite: 'elder', name: 'Ice-fisher', dir: 1, talk: 'icefisher' },
    { id: 'frozenslip', onSolid: true, x: CAST[0][0], y: CAST[0][1], sprite: 'child', name: 'A cast under the ice', dir: 0, img: pale('child'), ghost: true, talk: 'frozenSlip' },
    { id: 'icecutter', x: 5, y: 15, sprite: 'tanner', name: 'Ice-cutter', dir: 1, trainer: { nacre: 1, name: 'Ice-cutter', team: [['walrus', 18], ['berg', 18]], intro: 'I carve blocks from the lake. The lake doesn\'t mind. Or perhaps it\'s just being gracious.', defeat: 'Take a block home with you. Store it somewhere cold. Just not in your pocket.', sight: 3 } },
    { id: 'sealwife', x: 28, y: 12, sprite: 'villager2', name: 'Seal-wife', dir: 3, trainer: { name: 'Seal-wife', team: [['selkie', 18], ['narwhal', 18]], intro: 'My spare coat\'s in a home chest. Keep it from my husband. He thinks they\'re blankets.', defeat: 'You won\'t say a word. I can see that in you.', sight: 3 } },
    { id: 'aukkeeper', x: 29, y: 2, sprite: 'elder', name: 'Auk-keeper', dir: 2, trainer: { name: 'Auk-keeper', team: [['auk', 18], ['rime', 18]], intro: 'The last of them came to the ice to stand. So I came, too, and stood beside them.', defeat: 'Stay with us for a while. It\'s pleasant. Cold, but pleasant.', sight: 3 } },
  ],
  spots: [
    ...CAST.map(([x, y]) => ({ x, y, script: 'frozenSlip' })),
    look(4, 6, 'A fishing hole. Far below in the clear water, a star falls, very slowly.'),
    stash('is_hole', 29, 6, 'Frozen into the edge of a fishing hole lie a notion and a string of cowries.', { notion: 'hideplate', rind: 300 }),
  ],
});
MAPS.iceshelf.npcs.push(prize('is_drift', 32, 16, 'Embedded in the bank of the nook is a clam shell lined with nacre.', { tan: 5 }));
WALK_PUZZLES.push({
  name: 'Iceshelf', map: 'iceshelf', start: [1, 9], floor: 10, wear: ['TIDE'], exits: [[1, 9]], needs: ['gusts', 'gustsIce'],
  goal: (x, y) => MAPS.iceshelf.rows[y][x] !== '~' && CAST.some(([a, b]) => Math.abs(a - x) + Math.abs(b - y) === 1),
  prize: { at: CAST[0], view: [1, 9] },
});

// The Ice-fisher measures in fingers and says no more than she has to.
defScript('icefisher', async () => {
  if (flag('iceDone')) { await say('Ice-fisher', 'No. ... That\'s exactly what I wanted. Thank you for voicing it for me.'); return; }
  if (!flag('iceAsked')) {
    await say('Ice-fisher', 'It\'s four fingers thick today. Good ice.');
    await say('Ice-fisher', 'On the day I shed, it was six fingers thick. It wasn\'t quite thick enough. ... It gave way.');
    await say('Ice-fisher', 'It\'s still down there, in the center. My first shell. Would you ask it if it\'s cold?');
    setFlag('iceAsked');
    return;
  }
  if (!flag('iceAnswer')) { await say('Ice-fisher', 'Four fingers thick. There\'s no grip in the middle, so you slide. ... Watch where you stop.'); return; }
  await say('Ice-fisher', '... Well?');
  await act('ouro', 'look');
  await say('Ice-fisher', 'No.');
  setFlag('iceDone');
  await reward({ tan: 4, pegs: ['bone', 4] });
});

defScript('frozenSlip', async () => {
  // A pearly child-shaped shell looks up from under the clear ice, hands flat against the underside.
  await emote('ouro', 'silence');
  // Ouro knocks from the ice. Swimming in the hole beside the cast does not count.
  if (!flag('iceAsked') || flag('iceAnswer') || field.tile(field.x, field.y) === '~') return;
  // Ouro kneels and knocks on the ice to ask if it is cold, and the child's mouth makes one word through the ice.
  await act('ouro', 'bow');
  sound('bump');
  await wait(12);
  sound('bump');
  await wait(30);
  await say('The cast under the ice', 'No.');
  setFlag('iceAnswer');
  await payoff(CAST[0]);
});
