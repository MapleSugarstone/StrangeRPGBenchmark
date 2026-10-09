// Region 2 of the ring: the High-water Mark, Mast's new rooms, the Wrecks' new corners, the stilts, and puzzle 4 (the chart).
import { sfx } from '../engine/audio';
import { text } from '../engine/font';
import { input } from '../engine/input';
import { clear, rect } from '../engine/screen';
import { field, flag, hint, narr, say, setFlag } from '../game/api';
import { close, run, type Mode } from '../game/modes';
import { KEY_USE } from '../game/menus';
import { G, save } from '../game/state';
import { defMap, defScript, MAPS, SCRIPTS, SPAWNS } from '../game/world';
import { kinds, look, reward, stash } from './areakit';
import { CHART_HOLLOW, giveKeyItem, hasKey, room, roomDoor } from './ring';

const fell = () => !!flag('mastFell');

// ---------------------------------------------------------------- the High-water Mark

defMap({
  id: 'highwater', name: 'The High-water Mark', region: 35, music: 'highwater',
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTT.....TTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTT...TTTTTTTTTT..,..TTTTTTTTTT.O...TTTTTTTT',
    'TTTT...,,,...TTTTTTT.....TTTTTTT....@....,,TTTTT',
    'TTT..,,,,,,,..TTTTTT.....TTTTTT...........,,TTTT',
    'TTTT...,,,...TTTTTTTTT.TTTTTTTTT...........TTTTT',
    'TTTTTTT...TTTTTTTTTTTT.TTTTTTTTTT.......TTTTTTTT',
    'T..............................................T',
    'T..............................................T',
    '================================================',
    'T..............................................T',
    'T..............................................T',
    'Txxxxx.xxxxxxxx.xxxxxxxx.xxxxxxxx.xxxxxx.xxxxxxT',
    'T...T....................,,,...............T...T',
    'TT...T..,,,,,.........,,,,,,,,,........,,,..T..T',
    'T....,,,,,,,,,,,.....,,,,,,,,,,,....,,,,,,,,,..T',
    'T...,,,,,,,,,,,,,.....,,,,,,,,,....,,,,,,,,,,,.T',
    'T....,,,,,,,,,,,.........,,,T...T...,,,,,,,,,..T',
    'T.......,,,,,..........................,,,.T...T',
    'TT........................T....................T',
    'TTTTTTTTTTTTTT;TTTTTTTTTTTTTTT;TTTTTTTTTTTTT;TTT',
    'TTTTTTTTTTTTTT.TTTTTTTTTTTTTTT.TTTTTTTTTTTTT.TTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  warps: [
    { x: 47, y: 10, to: 'rib', tx: 1, ty: 4, dir: 1 },
    { x: 0, y: 10, to: 'mast', tx: 42, ty: 3, dir: 3 },
    { x: 14, y: 22, to: 'route2', tx: 14, ty: 1, dir: 0 },
    { x: 30, y: 22, to: 'route2', tx: 30, ty: 1, dir: 0 },
    { x: 44, y: 22, to: 'route2', tx: 44, ty: 1, dir: 0 },
  ],
  zone: { kinds: kinds([['scree', 3], ['bore', 3], ['carrion', 2], ['fiddler', 2], ['fata', 1]]), lv: [9, 13], n: 10, area: 'weed' },
  npcs: [
    { id: 'hwsleeper', x: 22, y: 7, sprite: 'stone', mon: 'bore', name: 'Vuoksho', sleeper: { kind: 'bore', lv: 24, flag: 'sl_highwater' } },
    { id: 'tideline', x: 12, y: 9, sprite: 'elder', name: 'Tide-liner', dir: 0, lines: ['Highest tide ever came up to this line. I put a stick in it. Stick\'s still here. Tide isn\'t, is it.'] },
    { id: 'hwtrainer', x: 28, y: 11, sprite: 'villager2', name: 'Beachcomber', dir: 2, trainer: { name: 'Beachcomber', team: [['fiddler', 12], ['carrion', 12]], intro: 'Everything the sea ever threw up is along this line. I\'ve combed it. Twice. Want to see?', defeat: 'Third comb tomorrow, then.', sight: 3 } },
  ],
  spots: [
    stash('hw_cove', 22, 3, 'In the side cove, in a nest of old weed, a tide jar someone corked and forgot.', { notions: [['tidejar', 1]] }),
    { x: 36, y: 3, when: () => !field.objAt(36, 4) && !flag('found_hw_cave'), script: async () => {
      setFlag('found_hw_cave');
      sfx('level');
      await reward({ notion: 'glassbead', items: [['starglass', 1]] });
    } },
    look(30, 20, 'The slope drops away to the Dry Sea. It is a long jump down and no way back up.'),
  ],
});

// ---------------------------------------------------------------- Mast's new rooms

// The stilt-maker gives every measure in hands, as if the stilts were horses.
defMap({
  id: 'stilthouse', name: 'The stilt-maker\'s', region: 11, indoor: true, music: 'home',
  rows: room(['p_p_p_p_', '________', '________', '_cc_____', '________', '________']),
  warps: roomDoor('mast', 4, 7),
  npcs: [{ id: 'stiltmaker', x: 2, y: 3, sprite: 'stilts', name: 'Stilt-maker', dir: 0, talk: 'stiltmaker' }],
  spots: [look(2, 0, 'Stilts lean on the wall, short ones to very tall. A label on the tallest: FOR THE BIG TIDE.')],
});

defScript('stiltmaker', async () => {
  if (hasKey('stilts')) { await say('Stilt-maker', 'Shallows come up to here on you. Three hands. Deep water, no stilt\'s tall enough. Not even mine.'); return; }
  if (!fell()) {
    await say('Stilt-maker', 'Made stilts forty years. Twelve hands tall, these. For the day the sea comes back.');
    await say('Stilt-maker', 'Sea\'s not back. Mast\'s up. When the Mast goes, I\'ll know something\'s moving. Two hands, or ten.');
    return;
  }
  await say('Stilt-maker', 'Mast\'s down. Felt it in the floor, fourteen hands of shiver.');
  await say('Stilt-maker', 'Something\'s moving, then. Take these. Short pair, three hands. You\'ll wade, not drown.');
  await giveKeyItem('stilts', 'Ouro gets the wading stilts.');
  await say('Stilt-maker', 'Streams, fords, pools, inlets. Anywhere it\'s shallow. Deep water wants a sea whorl on you.');
});

defMap({
  id: 'boathouse', name: 'The boat-house', region: 11, indoor: true, music: 'home',
  rows: room(['________', 'ee__ee__', 'ee__ee__', '________', '________', '________']),
  warps: roomDoor('mast', 38, 7),
  npcs: [{ id: 'boatman', x: 7, y: 4, sprite: 'elder', name: 'Old man', dir: 3, lines: ['My boat turned last year. Now I\'ve two boats and no sea.', 'That one\'s the boat. That one\'s its cast. I row them both on Sundays. On the floor.'] }],
});

// ---------------------------------------------------------------- the Wrecks: the way up to the bay, the flooded hold, the cargo hatch

{
  const w = MAPS.wrecks;
  const rows = w.rows.map(r => r.split(''));
  rows[0][19] = '='; rows[20][19] = '#';
  for (let y = 15; y <= 18; y++) for (let x = 30; x <= 34; x++) rows[y][x] = ':';
  rows[17][32] = 's';
  rows[17][13] = '@';
  w.rows = rows.map(r => r.join(''));
  w.warps = [{ x: 19, y: 0, to: 'route2', tx: 4, ty: 32, dir: 0 }];
  (w.spots ||= []).push(
    stash('wr_flood', 32, 17, 'In the flooded hold, on a dry crate, a little iron bar with a tide line etched on it.', { notion: 'tidemark' }),
    { x: 13, y: 17, when: () => !field.objAt(13, 17) && !flag('found_wr_hatch'), script: async () => {
      setFlag('found_wr_hatch');
      await reward({ rind: 600, items: [['lure', 1]] });
    } },
  );
}
SPAWNS.wrecks = [19, 1];

// The Master hands over his chart of the bay the first time he asks Ouro to look for the ship.
{
  const before = SCRIPTS.master;
  defScript('master', async () => {
    await before();
    if (flag('masterAsked') && !hasKey('chart') && !flag('doorDug')) {
      await say('The Master', '(log. chart of the bay issued to visitor. depths before the dry. for looking. noon)');
      await giveKeyItem('chart', 'Ouro gets the Master\'s chart.');
      await hint('(Pick the chart in the Bag to look at it.)');
    }
  });
}

// ---------------------------------------------------------------- puzzle 4: the chart

/** Depth in fathoms at a tile of the bay before the dry: deeper toward the open water in the south, deepest at the hollow. */
function depthAt(x: number, y: number): number {
  const d = 3 + Math.floor(y / 3) + ((x * 7 + y * 3) % 3);
  const near = Math.abs(x - CHART_HOLLOW[0]) + Math.abs(y - CHART_HOLLOW[1]);
  return near === 0 ? 19 : Math.min(15, d);
}

/** The chart drawn as a picture: reef bars, the boat, anchors, and depth soundings, with the deepest one circled. */
class ChartView implements Mode {
  opaque = true;
  update(): void { if (input.hit('ok') || input.hit('back')) close(this); }
  draw(): void {
    const m = MAPS.route2, S = 3, ox = 12, oy = 44;
    clear('#2a1e14');
    rect(ox - 6, oy - 30, 180, 145, '#e8d8b0');
    rect(ox - 6, oy - 30, 180, 1, '#a08a60');
    text('The bay, before the dry', ox, oy - 26, '#4a3420');
    text('by the Master. fathoms', ox, oy - 17, '#8a6a40');
    for (let y = 1; y < m.rows.length - 4; y++) for (let x = 0; x < m.rows[0].length; x++) {
      const ch = m.rows[y][x], px = ox + x * S, py = oy + y * S;
      if (ch === '#') rect(px, py, S, S, '#7a4a2a');
      else if (ch === 'e') rect(px, py + 1, S, 2, '#2a1e14');
      else if (ch === 'x') { rect(px + 1, py, 1, 3, '#4a3420'); rect(px, py + 2, 3, 1, '#4a3420'); }
      else if (ch === ',' && (x + y) % 3 === 0) rect(px + 1, py + 1, 1, 1, '#9aa070');
    }
    // A sounding every few tiles, small, and the deepest circled.
    for (let y = 4; y < 28; y += 6) for (let x = 3; x < 54; x += 8) {
      const v = depthAt(x, y);
      text(String(v), ox + x * S - 2, oy + y * S - 3, '#6a5030');
    }
    const [hx, hy] = CHART_HOLLOW, v = depthAt(hx, hy), cx = ox + hx * S, cy = oy + hy * S;
    text(String(v), cx - 4, cy - 3, '#8a1a10');
    for (let a = 0; a < 24; a++) { const t = (a / 24) * Math.PI * 2; rect(Math.round(cx + Math.cos(t) * 8), Math.round(cy + Math.sin(t) * 6), 1, 1, '#8a1a10'); }
    text('Z or X to fold it', ox + 50, oy + 104, '#8a6a40');
  }
}

KEY_USE.chart = async () => { await run(new ChartView()); return false; };

defScript('digDoor', async () => {
  sfx('cut'); field.shakeT = 6;
  await field.waitFrames(14);
  sfx('cut'); field.shakeT = 6;
  await field.waitFrames(14);
  setFlag('doorDug');
  await giveKeyItem('lore_door', 'Ouro digs up a small door with a scallop for a knocker.');
  save();
});
