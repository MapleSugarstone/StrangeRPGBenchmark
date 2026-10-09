// Region 4 of the ring: the Kelp Beds and puzzle 6 (the sleepers in the kelp), and the rain house in Bole.
import { sfx } from '../engine/audio';
import { field, flag, moveNpc, say, setFlag, wait } from '../game/api';
import { shop } from '../game/menus';
import { defProp } from '../game/props';
import { save } from '../game/state';
import { defMap, defScript, SCRIPTS, SPAWNS, type NpcDef } from '../game/world';
import { PUZZLE_DATA } from '../tools/worldcheck';
import { kinds, look, reward } from './areakit';
import { giveKeyItem, hasKey, room, roomDoor } from './ring';
import { holmSeen } from './ring3';
import { rect } from '../engine/screen';

// ---------------------------------------------------------------- puzzle 6: the sleepers in the kelp

/** The kelp field's corner on the map, its lanes, and where the five sleepers lie at the start. */
const KX = 12, KY = 12;
const KGRID = ['kkkkkkkkkkk', 'kC..k.....k', 'kkk.k.kkk.k', 'k.........k', 'k.kk.k.kk.k', 'k.........k', 'kkkk.kkkkkk', 'kkkk.kkkkkk'];
const KSTART: [number, number][] = [[6, 4], [4, 6], [8, 5], [1, 3], [9, 2]];
const KENTRY: [number, number] = [4, 7], KGOAL: [number, number] = [2, 1];
const kOpen = (x: number, y: number) => KGRID[y]?.[x] === '.';

/** One ring of the jingle with Ouro at ox, oy: every sleeper within three tiles rolls one tile away along the axis they are further apart on, farthest first. */
function kRing(s: [number, number][], ox: number, oy: number): [number, number][] {
  const r = s.map(p => [p[0], p[1]] as [number, number]);
  const d = (p: [number, number]) => Math.abs(p[0] - ox) + Math.abs(p[1] - oy);
  const order = r.map((_, i) => i).sort((a, b) => d(r[b]) - d(r[a]) || a - b);
  for (const i of order) {
    const [x, y] = r[i], dx = x - ox, dy = y - oy;
    if (Math.abs(dx) + Math.abs(dy) > 3) continue;
    let nx = x, ny = y;
    if (Math.abs(dx) >= Math.abs(dy)) nx += Math.sign(dx) || 1; else ny += Math.sign(dy);
    if (!kOpen(nx, ny) || (nx === ox && ny === oy) || r.some(p => p[0] === nx && p[1] === ny)) continue;
    r[i] = [nx, ny];
  }
  return r;
}

const SLEEPER_KINDS = ['thicket', 'umbra', 'hemlock', 'skep', 'undertow'];
const kelpNpcs: NpcDef[] = KSTART.map(([x, y], i) => ({ id: 'kelp' + i, x: KX + x, y: KY + y, sprite: 'stone', mon: SLEEPER_KINDS[i], name: 'Sleeper', dir: i % 4, talk: 'kelpRing', movable: true }));

defScript('kelpRing', async () => {
  if (!hasKey('jingle')) { await say(null, 'Big old whorls asleep in the kelp lanes. Nothing short of a jingle would wake them.'); return; }
  const now = kelpNpcs.map(d => { const n = field.npc(d.id)!; return [n.x - KX, n.y - KY] as [number, number]; });
  const after = kRing(now, field.x - KX, field.y - KY);
  sfx('blip'); await wait(6); sfx('blip'); await wait(6); sfx('blip');
  await wait(12);
  const moves = after.map((p, i) => { const [x, y] = now[i]; return p[0] > x ? 'r' : p[0] < x ? 'l' : p[1] > y ? 'd' : p[1] < y ? 'u' : ''; });
  await Promise.all(moves.map((m, i) => m ? moveNpc('kelp' + i, m) : Promise.resolve()));
  if (moves.some(m => m)) sfx('switch');
});

// Pressing the button anywhere in the kelp field rings the jingle there.
field.tileHandlers.push((f, x, y, ch) => {
  if (f.map.id !== 'kelpbeds' || !hasKey('jingle')) return false;
  if (f.x < KX || f.x > KX + 10 || f.y < KY || f.y > KY + 8 || ch === 'p') return false;
  void f.runBusy(SCRIPTS.kelpRing);
  return true;
});

PUZZLE_DATA.extra.push(() => {
  // Breadth first over sleeper places. Ouro walks anywhere open in the lanes and rings from any tile Ouro can reach.
  const key = (s: [number, number][]) => s.map(p => p.join()).sort().join(';');
  const reach = (s: [number, number][]) => {
    const seen = new Set([KENTRY.join()]);
    const q = [KENTRY];
    while (q.length) {
      const [x, y] = q.pop()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
        if (!kOpen(nx, ny) || seen.has(k) || s.some(p => p[0] === nx && p[1] === ny)) continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    return seen;
  };
  const seen = new Set([key(KSTART)]);
  let frontier: [number, number][][] = [KSTART];
  for (let depth = 0; depth < 12 && frontier.length; depth++) {
    const next: [number, number][][] = [];
    for (const s of frontier) {
      const r = reach(s);
      if (r.has(KGOAL.join())) return depth >= 3 ? null : `puzzle 6: the chair is reached in ${depth} rings, too few`;
      for (const p of r) {
        const [ox, oy] = p.split(',').map(Number);
        const ns = kRing(s, ox, oy), k = key(ns);
        if (seen.has(k)) continue;
        seen.add(k); next.push(ns);
      }
    }
    frontier = next;
  }
  return 'puzzle 6: the sleepers in the kelp cannot be cleared from the chair\'s lane';
});

defProp('kelpchair', {
  w: 1, h: 1,
  paint(x, y) {
    rect(x + 2, y + 1, 1, 6, '#8a5a30'); rect(x + 2, y + 4, 4, 1, '#8a5a30'); rect(x + 5, y + 4, 1, 3, '#8a5a30'); rect(x + 2, y + 1, 1, 1, '#c8a878');
  },
});

defMap({
  id: 'kelpbeds', name: 'The Kelp Beds', region: 38, music: 'kelp',
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT=TTTTTTTTTTTTT',
    'T~~~~~~kkkssssssssssssssssssss=ssssssssssssT',
    'T~~~~~~::kskkkkkkkkkkkkkkkkkks=ssssssssssssT',
    'T~~~~~~:k:skkkkkkkkkkk,,,kkkks=ssssssssssssT',
    'T~~~~~~:::sskkkkkkkk,,,,,,,sss=ssssssssssssT',
    'T~~~~~~::kssskkkkkkkss,,,sssss=ssssssksssssT',
    'T~~~~~~:::ssssskkkssssssssssss=sssskkkkksssT',
    'T~~~~~~k::ssssssssssssssssssss=sssskkkkksssT',
    'T~~~~~~:::sssssssssssssssxssss=ssskkkkkkkssT',
    'T~~~~~~:::ssssssssssssssssxsss=sssskkkkksssT',
    'T~~~~~~:::ssssssssssssssssssss=sssskkkkksssT',
    'T~~~~~~:::ssssssssssssssssssss=ssssssks::::T',
    'T~~~~~~:::sskkkkkkkkkkksssssss=ssssssss::::T',
    'T~~~~~~:k:sskp..k.....ksssssss=sssss,,,:::s:',
    'T~~~~~~k:ksskkk.k.kkk.ksssssss=sss,,,,,::::T',
    'T~~~~~~:k:ssk.........ksssssss=ss,,,,,,::::T',
    'T~~~~~~::kssk.kk.k.kk.ksssssss=sss,,,,,,,ssT',
    'T~~~~~~k::ssk.........ksssssss=sssss,,,ssssT',
    'T~~~~~~:::sskkkk.kkkkkksssssss=ssssssssssssT',
    'T~~~~~~::ksskkkk.kkkkkksssssss=ssssssssssssT',
    'T~~~~~~:::ssssssssssssssssssss=sssssskkksssT',
    'T~~~~~~kkkssssssssssssssssssss=ssssskkkkkssT',
    'T~~~~~~k::sssssssssssssseeesss=sssskkkkkkksT',
    'T~~~~~~:k:ssskkksssssssseeesss=ssssskkkkkssT',
    'T~~~~~~:::skkkkkkksssssss@ssss=sssssskkksssT',
    'T~~~~~~k:kkkkkkkkkksssssssssss=ssssssssssssT',
    'T~~~~~~:::skkkkkkkssssssssssss=ssxsssssssssT',
    'T~~~~~~k:kssskkkssssssssssssss=ssssssssssssT',
    'T~~~~~~::kssssssssssssssssssss=ssssssssssssT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT=TTTTTTTTTTTTT',
  ],
  warps: [
    { x: 30, y: 29, to: 'spire', tx: 1, ty: 3, dir: 0 },
    { x: 30, y: 0, to: 'bole', tx: 1, ty: 30, dir: 2 },
    { x: 43, y: 13, to: 'route4', tx: 1, ty: 24, dir: 1 },
  ],
  zone: { kinds: kinds([['thicket', 3], ['undertow', 3], ['hemlock', 2], ['umbra', 1], ['skep', 2]]), lv: [20, 25], n: 10, area: 'kelp' },
  props: [{ x: 13, y: 13, pic: 'kelpchair', when: () => !hasKey('lore_chair') && !flag('back_lore_chair') }, { x: 2, y: 10, pic: 'holmfar', when: holmSeen(4) }],
  npcs: [
    ...kelpNpcs,
    { id: 'kelpcomber', x: 33, y: 17, sprite: 'villager', name: 'Kelp-cutter', dir: 3, lines: ['Big ones sleep in the kelp. They roll over when you jingle at them. Away from you, always. Rude.'] },
    { id: 'kelptrainer', x: 27, y: 14, sprite: 'villager2', name: 'Driftwood man', dir: 0, trainer: { name: 'Driftwood man', team: [['undertow', 23], ['skep', 23]], intro: 'Every stick on this beach has been somewhere. I ask them where. They mostly say the sea.', defeat: 'Fair. Off to ask a plank.', sight: 3 } },
  ],
  spots: [
    { x: 13, y: 13, when: () => !hasKey('lore_chair') && !flag('back_lore_chair'), script: async () => { await giveKeyItem('lore_chair', 'Ouro gets a small wooden chair. One leg is shorter.'); } },
    { x: 25, y: 24, when: () => !field.objAt(25, 24) && !flag('found_kelp_raft'), script: async () => { setFlag('found_kelp_raft'); await reward({ items: [['ridertin', 1]], notions: [['cuttlebone', 1]] }); } },
    look(7, 15, 'Kelp stands in the shallows like a wood. The Lip shows between the stalks, pale.'),
  ],
});
SPAWNS.kelpbeds = [30, 1];

// ---------------------------------------------------------------- the rain house

// The rain-seller ends every sale on which way the rain is going.
defMap({
  id: 'rainhouse', name: 'The rain house', region: 11, indoor: true, music: 'home',
  rows: room(['p_p_p_p_', '________', '__ccc___', '________', '________', '________']),
  warps: roomDoor('bole', 30, 7),
  npcs: [{ id: 'rainseller', x: 3, y: 2, sprite: 'oldwoman', name: 'Rain-seller', dir: 0, talk: 'rainseller' }],
  spots: [look(2, 0, 'Jars on a shelf. The rain in them falls up and taps the lids. Tap. Tap. Going up.')],
});

defScript('rainseller', async () => {
  if (flag('bolePulled')) { await say('Rain-seller', 'Rain falls down now. Like everywhere. These jars are the last of the up. Going nowhere.'); return; }
  await say('Rain-seller', 'Jars of upward rain. Caught by the trunk. A hundred and twenty a jar. Going up.');
  await shop(['rainjar']);
  save();
});

void sfx;
