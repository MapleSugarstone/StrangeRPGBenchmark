// Setting, the machine puzzle: Bezel in Rib gives the board, sketches around the Volute add puzzles, and Druse in Hum tells of the geode.
import { rect, px } from '../engine/screen';
import { act, emote, face, faceToward, field, flag, G, giveKey, hint, notice, say, setFlag, sound, wait } from '../game/api';
import { KEY_NAMES, KEY_TEXT, KEY_USE, menuExtras } from '../game/menus';
import { settingMenu } from '../game/minigames/setting';
import { defProp } from '../game/props';
import { runAll } from '../game/setting/core';
import { PUZZLE_BY_ID, PUZZLES } from '../game/setting/puzzles';
import { save } from '../game/state';
import { defScript, MAPS } from '../game/world';
import { reward } from './areakit';

export async function openSetting(): Promise<void> {
  await settingMenu();
  field.playMapMusic();
}

KEY_NAMES.gemboard = 'Setting board';
KEY_TEXT.gemboard = 'A gem setter\'s bench that folds flat. Arms, stations, and a tray of stones.';
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
    if (!flag('sketchTold')) { setFlag('sketchTold'); await hint('(A drawing of arms and stones. A gem setter in Rib would know what it is for.)'); }
  } else if (!flag('sketchBoardTold')) {
    setFlag('sketchBoardTold');
    await hint('(The sketch goes on the Setting board. Open Setting from the menu to try it.)');
  }
}

for (const s of SKETCHES) {
  const m = MAPS[s.map];
  if (!m) continue;
  (m.props ||= []).push({ x: s.x, y: s.y, pic: 'gemSketch', when: () => !G.gem.found.includes(s.id) });
  (m.spots ||= []).push({ x: s.x, y: s.y, when: () => !G.gem.found.includes(s.id), script: () => findSketch(s.id) });
}

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

const solved = () => G.gem.solved.length;
let refCycles: Record<string, number> | null = null;
/** The cycles each puzzle's own reference machine takes, worked out once. */
function refOf(id: string): number {
  refCycles ||= Object.fromEntries(PUZZLES.map(p => [p.id, runAll(p, p.ref).cycles]));
  return refCycles[id];
}

/** Lines and a gift for the first talk after each count of puzzles set. */
const BEZEL_TIERS: { n: number; lines: string[]; gift: Parameters<typeof reward>[0] }[] = [
  { n: 1, gift: { rind: 150 }, lines: ['One set! A machine that works once is luck, but yours worked four times. That is a trade.'] },
  { n: 3, gift: { rind: 300 }, lines: ['Three sketches set. Rib\'s setters needed a season for three. Two seasons, I mean.'] },
  { n: 6, gift: { rind: 500, tan: 2 }, lines: ['Six! Half the sketches, set most immaculately.', 'There is a geode-cracker in Hum named Druse who collects people like you. Go and be collected.'] },
  { n: 9, gift: { rind: 800, tan: 3 }, lines: ['Nine set. My bench grows jealous of yours. It pinched my thumb this morning out of spite.'] },
  { n: 12, gift: { rind: 1500, notion: 'polishedring' }, lines: ['EVERY sketch set. I have nothing left to teach you, which is a most unaccustomable feeling!!', 'Take this ring. I set it at your age and it has never fit a single finger since.'] },
];

defScript('bezel', async () => {
  faceToward('bezel', 'ouro');
  if (!G.keys.includes('gemboard')) {
    await emote('bezel', 'surprise');
    await say(BEZEL, 'A FINE afternoon for setting stones. Splendid, I mean. Fine is two grades under splendid.');
    await say(BEZEL, 'I am Bezel, setter of stones to Rib and to anybody else who pays most punctually.');
    if (G.gem.found.length) {
      await emote('bezel', 'question');
      await say(BEZEL, 'Is that a sketch in your hand? Somebody drew a machine and lost it. How carelessly delicious.');
    }
    await say(BEZEL, 'A setter\'s bench has arms to carry stones and setters to bond them. Nobody\'s thumbs get pinched!!');
    await act('bezel', 'lift');
    giveKey('gemboard');
    if (!G.gem.found.includes('g1')) G.gem.found.unshift('g1');
    sound('level');
    await notice('Got the Setting board.');
    await say(BEZEL, 'I keep three benches and the third is most surplusable. Here is a first sketch to begin on as well.');
    await hint('(Setting is in the menu now. Press X and choose Setting.)');
    await say(BEZEL, 'Sketches blow about the Volute like leaves. Bring back any you find set, and I will be thrilled.');
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
  // A machine faster than the bench's own gets one remark.
  const quick = G.gem.solved.map(id => ({ id, by: refOf(id) - (G.gem.best[id]?.c ?? 1e9) })).filter(q => q.by > 0).sort((a, b) => b.by - a.by)[0];
  if (quick && !flag('bezelQuick')) {
    setFlag('bezelQuick');
    const pz = PUZZLE_BY_ID[quick.id];
    await emote('bezel', 'surprise');
    await say(BEZEL, `${G.gem.best[quick.id].c} cycles for ${pz.name}? My own machine takes ${refOf(quick.id)}.`);
    await say(BEZEL, 'You have out-set the setter. That is quick work. Indecent, I mean, but in the good way.');
    return;
  }
  if (n === 0) await say(BEZEL, 'The first sketch needs one arm. Grab the pearl, swing it round, and let go over the setting.');
  else if (n < 6) await say(BEZEL, `${n} set of ${G.gem.found.length} found. A sketch left unset is a stone left rough!!`);
  else if (n < 12) await say(BEZEL, `${n} set. Druse in Hum talks of a geode that wants all twelve. I find geodes vulgar, personally.`);
  else await say(BEZEL, `All twelve, and ${G.gem.runs} machines set running. I have counted, I am a setter.`);
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
    await say(DRUSE, 'Inside this one there\'s a hollow the size of a fist, lined with violet. Watch.');
    await act('druse', 'hop');
    await emote('druse', 'music');
    await say(DRUSE, 'There. Violet. I\'m Druse. I crack geodes and I\'m never wrong about the inside.');
    if (!G.keys.includes('gemboard')) {
      await say(DRUSE, 'Inside your pack there\'s no setter\'s board. Bezel in Rib has spares. Ask.');
      return;
    }
    await say(DRUSE, 'Inside your pack there\'s a setter\'s board with sketches on it. Show me what you\'ve set.');
  }
  if (!G.keys.includes('gemboard')) { await say(DRUSE, 'Still no board in there. Bezel, in Rib. Spares.'); return; }
  if (n >= 12) {
    face('druse', 1);
    await emote('druse', 'silence');
    await say(DRUSE, 'All twelve set. Inside the crater fields, the geode just opened. I heard it from here.');
    await say(DRUSE, 'The east crater, north of Fall. Its south rim. Bring something soft for your ears.');
    faceToward('druse', 'ouro');
    setFlag('geodeTold');
    return;
  }
  if (n >= 6) {
    if (!flag('druseQuest')) {
      setFlag('druseQuest');
      await emote('druse', 'surprise');
      await say(DRUSE, `${n} set. Inside your head there's a machine-shaped room now. Good. I need it.`);
      await say(DRUSE, 'Inside the crater fields north of Fall there\'s a geode as big as Rib. Nobody\'s opened it.');
      await say(DRUSE, 'Its door is a seam in the east crater, a lock of twelve settings. Set all 12 sketches and it opens.');
      await act('druse', 'look');
      await say(DRUSE, 'Inside it there\'s a whorl strung like a necklace. I\'ve never seen it. It\'s there, though.');
      save();
      return;
    }
    await say(DRUSE, `${n} of 12. Inside the geode the whorl is counting along with you.`);
    return;
  }
  // Below half, Druse just reacts to how much Ouro has played.
  const runs = G.gem.runs;
  if (runs === 0) await say(DRUSE, 'Inside that board there\'s not a scratch. Run something. Break something.');
  else if (runs < 15) await say(DRUSE, `${runs} runs. Inside each one there's a little click where it works or doesn't.`);
  else if (runs < 40) await say(DRUSE, `${runs} runs. Inside that number there are a lot of stones on the floor.`);
  else await say(DRUSE, `${runs} runs! Inside you there's a setter. Bezel will be cross.`);
});
