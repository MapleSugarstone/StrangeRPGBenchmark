// Setting, the machine puzzle: Bezel in Rib gives the board, sketches around the Volute add puzzles, Shellwright counters sell
// harder ones, and Druse in Hum tells of the geode.
import { rect, px } from '../engine/screen';
import { act, emote, face, faceToward, field, flag, G, giveKey, hint, notice, say, setFlag, sound, tanneryStock, TOWNS, wait } from '../game/api';
import { KEY_NAMES, KEY_TEXT, KEY_USE, menuExtras } from '../game/menus';
import { settingMenu } from '../game/minigames/setting';
import { defProp } from '../game/props';
import { runAll } from '../game/setting/core';
import { ALL_PUZZLES, baseSolved, PUZZLE_BY_ID, SHOP_PUZZLES } from '../game/setting/puzzles';
import { EXTRA_WARES } from '../game/shopScreen';
import { save } from '../game/state';
import { defScript, MAPS } from '../game/world';
import { reward } from './areakit';

export async function openSetting(): Promise<void> {
  await settingMenu();
  field.playMapMusic();
}

KEY_NAMES.gemboard = 'Setting board';
KEY_TEXT.gemboard = 'A foldable gem setter\'s bench, complete with arms, stations, and a tray of stones.';
KEY_USE.gemboard = async () => { await openSetting(); return true; };
menuExtras.push({ label: 'Setting', when: () => G.keys.includes('gemboard'), run: openSetting });

/** Puzzles the sketches hold, where each one is pinned, and the tile Ouro faces to take it. */
const SKETCHES: { id: string; map: string; x: number; y: number }[] = [
  { id: 'g2', map: 'route2', x: 24, y: 22 },
  { id: 'g3', map: 'highwater', x: 21, y: 7 },
  { id: 'g4', map: 'saltings', x: 19, y: 11 },
  { id: 'g5', map: 'spire', x: 10, y: 17 },
  { id: 'g6', map: 'shoutwood', x: 15, y: 27 },
  { id: 'g7', map: 'route4', x: 30, y: 19 },
  { id: 'g8', map: 'route5', x: 28, y: 12 },
  { id: 'g9', map: 'gantry', x: 20, y: 16 },
  { id: 'g10', map: 'floes', x: 22, y: 3 },
  { id: 'g11', map: 'shingle', x: 28, y: 14 },
  { id: 'g12', map: 'longway', x: 30, y: 17 },
];

// A sketch pinned to a rock, a tree, or a wall: paper with a drawing of arms and stones, and a red pin.
defProp('gemSketch', {
  w: 1, h: 1,
  paint(x, y, t) {
    rect(x + 1, y + 1, 6, 6, '#f4ecd8'); rect(x + 1, y + 6, 6, 1, '#c8bca0'); rect(x + 6, y + 2, 1, 4, '#ddd2bc');
    px(x + 4, y + 1, '#d04a4a');
    rect(x + 2, y + 3, 3, 1, '#6a5a8a'); px(x + 2, y + 4, '#6a5a8a');
    px(x + 5, y + 4, '#f0a030'); px(x + 3, y + 5, '#70c8e8');
    if ((t >> 3) % 40 === 0) px(x + 6, y + 2, '#ffffff');
  },
});

async function findSketch(id: string): Promise<void> {
  if (G.gem.found.includes(id)) return;
  const pz = PUZZLE_BY_ID[id];
  sound('page');
  await act('ouro', 'lift');
  G.gem.found.push(id);
  save();
  await notice(`A Setting sketch: ${pz.name}.`);
  if (!G.keys.includes('gemboard')) {
    if (!flag('sketchTold')) { setFlag('sketchTold'); await hint('(A diagram of arms and stones. A gem setter in Rib would recognize its purpose.)'); }
  } else if (!flag('sketchBoardTold')) {
    setFlag('sketchBoardTold');
    await hint('(Place the sketch on the Setting board. Open the Setting menu to test it.)');
  }
}

for (const s of SKETCHES) {
  const m = MAPS[s.map];
  if (!m) continue;
  (m.props ||= []).push({ x: s.x, y: s.y, pic: 'gemSketch', when: () => !G.gem.found.includes(s.id) });
  (m.spots ||= []).push({ x: s.x, y: s.y, when: () => !G.gem.found.includes(s.id), script: () => findSketch(s.id) });
}

// ---------------------------------------------------------------- sketches for sale

/** The town whose Shellwright first sells each bought sketch, and its price. A counter also sells every sketch of the towns
 * before it on the road, and one in a town off that road sells them all. */
export const SKETCH_SALE: { id: string; town: string; price: number }[] = [
  { id: 's1', town: 'rib', price: 200 },
  { id: 's2', town: 'mast', price: 250 },
  { id: 's3', town: 'spire', price: 300 },
  { id: 's4', town: 'spire', price: 300 },
  { id: 's5', town: 'bole', price: 400 },
  { id: 's6', town: 'hum', price: 500 },
  { id: 's7', town: 'hum', price: 500 },
  { id: 's8', town: 'tusk', price: 600 },
  { id: 's9', town: 'hilt', price: 700 },
  { id: 's10', town: 'hilt', price: 700 },
  { id: 's11', town: 'fall', price: 900 },
  { id: 's12', town: 'fall', price: 1200 },
];
const ROAD = Object.keys(TOWNS);
const roadAt = (town: string): number => { const i = ROAD.indexOf(town); return i < 0 ? ROAD.length : i; };

for (const sale of SKETCH_SALE) {
  const pz = PUZZLE_BY_ID[sale.id];
  EXTRA_WARES['sketch:' + sale.id] = {
    name: pz.name, price: sale.price, kind: 'sketch', max: 1, toast: 'The sketch is yours.',
    text: `A Setting sketch. ${pz.idea}`,
    held: () => (G.gem.found.includes(sale.id) ? 1 : 0),
    give: () => { if (!G.gem.found.includes(sale.id)) G.gem.found.push(sale.id); },
  };
}
tanneryStock.push(town => (G.keys.includes('gemboard')
  ? SKETCH_SALE.filter(s => roadAt(s.town) <= roadAt(town) && !G.gem.found.includes(s.id)).map(s => 'sketch:' + s.id)
  : []));

// ---------------------------------------------------------------- Bezel, the gem setter in Rib

const BEZEL = 'Bezel';
const DRUSE = 'Druse';

MAPS.rib?.npcs.push({
  id: 'bezel', x: 39, y: 12, sprite: 'tanner', name: BEZEL, dir: 0, talk: 'bezel', idle: { every: 320, act: 'nod' },
  img: () => ({ px: ['..4444..', '.444444.', '14444441', '12121111', '12122111', '.133331.', '13333331', '.1....1.'], c: ['#d8a880', '#4a5a7a', '#e8e0d0'] }),
});
MAPS.hum?.npcs.push({
  id: 'druse', x: 39, y: 25, sprite: 'hummer', name: DRUSE, dir: 0, talk: 'druse', idle: { every: 280, act: 'bow' },
  img: () => ({ px: ['.4.44.4.', '.444444.', '14444441', '12122121', '12122121', '.133331.', '13333331', '.1....1.'], c: ['#8a5a3a', '#6a6a5a', '#b48cf0'] }),
});

const solved = () => baseSolved(G.gem.solved);
const shopSolved = () => SHOP_PUZZLES.filter(p => G.gem.solved.includes(p.id)).length;
let refCycles: Record<string, number> | null = null;
/** The cycles each puzzle's own reference machine takes, worked out once. */
function refOf(id: string): number {
  refCycles ||= Object.fromEntries(ALL_PUZZLES.map(p => [p.id, runAll(p, p.ref).cycles]));
  return refCycles[id];
}

/** Lines and a gift for the first talk after each count of puzzles set. */
const BEZEL_TIERS: { n: number; lines: string[]; gift: Parameters<typeof reward>[0] }[] = [
  { n: 1, gift: { rind: 150 }, lines: ['Just one set! A machine that functions once is luck. Yours ran four times. That is a trade.'] },
  { n: 3, gift: { rind: 300 }, lines: ['Three sketches set. Rib\'s setters usually took a season for three. Or maybe two.'] },
  { n: 6, gift: { rind: 500, tan: 2 }, lines: ['Six! Half the sketches, set with near perfection.', 'There\'s a geode-cracker in Hum named Druse who collects people like you.', 'Go on, let yourself be collected.'] },
  { n: 9, gift: { rind: 800, tan: 3 }, lines: ['Nine set. My bench is jealous of yours. It pinched my thumb this morning out of spite.'] },
  { n: 12, gift: { rind: 1500, notion: 'polishedring' }, lines: ['EVERY sketch set. I have nothing left to teach you, which feels incredibly strange!!', 'Take this ring. I set it at your age and it has never fit a single finger since.'] },
];

/** Lines and a gift for the first talk after each count of bought sketches set. */
const BEZEL_SHOP_TIERS: typeof BEZEL_TIERS = [
  { n: 1, gift: { rind: 100 }, lines: ['A counter sketch, set! Shellwrights sell the difficult ones to people they dislike.', 'I mean, those they look up to.'] },
  { n: 4, gift: { rind: 400, tan: 2 }, lines: ['Four counter sketches set. Those aren\'t drawings for children.', 'For apprentices, I mean, which is even worse.'] },
  { n: 8, gift: { rind: 800, tan: 3 }, lines: ['Eight! I tried the strand of four one winter. My bench and I didn\'t speak until spring.'] },
  { n: 12, gift: { rind: 1500, notion: 'tallystone' }, lines: ['All twelve counter sketches. And the tiara?! Mine has never once stood up on its own.', 'This stone kept track of my tiara runs. Take it. It has completely given up on me.'] },
];

defScript('bezel', async () => {
  faceToward('bezel', 'ouro');
  if (!G.keys.includes('gemboard')) {
    await emote('bezel', 'surprise');
    await say(BEZEL, 'A FINE afternoon for setting stones. I mean, splendid. "Fine" is two steps below "splendid".');
    await say(BEZEL, 'I\'m Bezel. I set stones for Rib and anyone else who pays promptly.');
    if (G.gem.found.length) {
      await emote('bezel', 'question');
      await say(BEZEL, 'Is that a sketch you\'re holding? Someone drew a machine and misplaced it. How delightfully careless.');
    }
    await say(BEZEL, 'A setter\'s bench has arms to hold stones and setters to secure them. Nobody\'s thumbs get pinched!!');
    await act('bezel', 'lift');
    giveKey('gemboard');
    if (!G.gem.found.includes('g1')) G.gem.found.unshift('g1');
    sound('level');
    await notice('You\'ve obtained the Setting board.');
    await say(BEZEL, 'I maintain three workbenches, though the third is largely unnecessary.');
    await say(BEZEL, 'Here\'s a first sketch to get you started.');
    await hint('(Setting is now available in the menu. Press X to select Setting.)');
    await say(BEZEL, 'Sketches drift through the Volute like leaves. Bring back any you find set, and I will be delighted.');
    save();
    return;
  }
  const n = solved();
  const tier = [...BEZEL_TIERS].reverse().find(t => n >= t.n);
  if (tier && tier.n > flag('bezelTier')) {
    setFlag('bezelTier', tier.n);
    await act('bezel', 'hop');
    for (const l of tier.lines) await say(BEZEL, l);
    await reward(tier.gift);
    return;
  }
  const ns = shopSolved();
  const shopTier = [...BEZEL_SHOP_TIERS].reverse().find(t => ns >= t.n);
  if (shopTier && shopTier.n > flag('bezelShopTier')) {
    setFlag('bezelShopTier', shopTier.n);
    await act('bezel', 'hop');
    for (const l of shopTier.lines) await say(BEZEL, l);
    await reward(shopTier.gift);
    return;
  }
  // A machine faster than the bench's own gets one remark.
  const quick = G.gem.solved.map(id => ({ id, by: refOf(id) - (G.gem.best[id]?.c ?? 1e9) })).filter(q => q.by > 0).sort((a, b) => b.by - a.by)[0];
  if (quick && !flag('bezelQuick')) {
    setFlag('bezelQuick');
    const pz = PUZZLE_BY_ID[quick.id];
    await emote('bezel', 'surprise');
    await say(BEZEL, `${G.gem.best[quick.id].c} cycles for ${pz.name}? My own machine runs on ${refOf(quick.id)}.`);
    await say(BEZEL, 'You\'ve outdone the setter. That was fast. Indecent, I mean, but in a good way.');
    return;
  }
  if (n >= 3 && !flag('bezelShopTold') && !SHOP_PUZZLES.some(p => G.gem.found.includes(p.id))) {
    setFlag('bezelShopTold');
    await say(BEZEL, 'The Shellwrights are now selling sketches over the counter. Tough ones. Vicious ones, I mean.');
    await say(BEZEL, 'Buy one and suffer magnificently.');
    return;
  }
  if (n === 0) await say(BEZEL, 'The first sketch requires one arm. Grab the pearl, swing it around, and drop it over the setting.');
  else if (n < 6) await say(BEZEL, `${n} of ${baseSolved(G.gem.found)} set. an unset sketch is like an uncut stone!!`);
  else if (n < 12) { await say(BEZEL, `${n} set. Druse in Hum speaks of a geode that needs all twelve.`); await say(BEZEL, 'I find geodes rather vulgar, personally.'); }
  else await say(BEZEL, `All twelve, and ${G.gem.runs} machines are now set and running. I keep count, I'm a setter.`);
});

// ---------------------------------------------------------------- Druse, the geode-cracker in Hum

defScript('druse', async () => {
  faceToward('druse', 'ouro');
  const n = solved();
  if (!flag('druseMet')) {
    setFlag('druseMet');
    await act('druse', 'bow');
    await wait(10);
    sound('cut');
    await say(DRUSE, 'There\'s a hollow in here, fist-sized and lined with violet. Watch closely.');
    await act('druse', 'hop');
    await emote('druse', 'music');
    await say(DRUSE, 'See that? Violet. I\'m Druse. I crack geodes open, and I never miss what\'s inside.');
    if (!G.keys.includes('gemboard')) {
      await say(DRUSE, 'Your pack doesn\'t have a setter\'s board. Bezel in Rib has extras. Ask around.');
      return;
    }
    await say(DRUSE, 'You\'ve got a setter\'s board in your pack, covered in sketches. Let me see what you\'ve worked on.');
  }
  if (!G.keys.includes('gemboard')) { await say(DRUSE, 'Still no board. Bezel, in Rib. They\'ve got spares.'); return; }
  if (n >= 12) {
    face('druse', 1);
    await emote('druse', 'silence');
    await say(DRUSE, 'All twelve are set. Out in the crater fields, a geode just cracked open. I could hear it from here.');
    await say(DRUSE, 'The east crater, north of Fall. Focus on its south rim. Bring something soft to cover your ears.');
    if (n + shopSolved() < ALL_PUZZLES.length) await say(DRUSE, 'Inside the Hollow, the Whorl is still ticking. It demands every sketch, including the Shellwrights\'.');
    faceToward('druse', 'ouro');
    setFlag('geodeTold');
    return;
  }
  if (n >= 6) {
    if (!flag('druseQuest')) {
      setFlag('druseQuest');
      await emote('druse', 'surprise');
      await say(DRUSE, `${n} set. there's a machine-shaped chamber inside your head now. perfect. I need that space.`);
      await say(DRUSE, 'North of Fall, in the crater fields, sits a geode as large as Rib. No one has opened it yet.');
      await say(DRUSE, 'The entrance is a seam in the east crater, a lock of twelve settings.');
      await say(DRUSE, 'Set all 12 sketches and it opens.');
      await act('druse', 'look');
      await say(DRUSE, 'Inside, there\'s a Whorl strung like a necklace. I\'ve never seen it, but I know it\'s there.');
      save();
      return;
    }
    await say(DRUSE, `${n} of 12. Inside the geode, the Whorl is counting in time with you.`);
    return;
  }
  // Below half, Druse just reacts to how much Ouro has played.
  const runs = G.gem.runs;
  if (runs === 0) await say(DRUSE, 'That board is pristine. Not a single scratch. Try running something. Break something.');
  else if (runs < 15) await say(DRUSE, `${runs} runs. Inside each one, there's a faint click that tells you whether it works or not.`);
  else if (runs < 40) await say(DRUSE, `${runs} runs. Inside that number, there are plenty of stones scattered on the floor.`);
  else await say(DRUSE, `${runs} runs! Inside you there's a setter. Bezel will be cross.`);
});
