// Region 8 of the ring: Fall's basin and puzzle 11 (the lean), the house of the woman whose keys roll to the middle, and the Long Way Round.
import { sfx } from '../engine/audio';
import { rect } from '../engine/screen';
import { choose, field, flag, narr, notice, say, setFlag } from '../game/api';
import { defProp } from '../game/props';
import { chapter, save } from '../game/state';
import { isSolid } from '../game/tiles';
import { defMap, defScript, MAPS, SPAWNS } from '../game/world';
import { PUZZLE_DATA } from '../tools/worldcheck';
import { kinds, look, reward, stash } from './areakit';
import { giveKeyItem, hasKey, room, roomDoor } from './ring';

// ---------------------------------------------------------------- Fall's basin and puzzle 11

/** Where Ouro steps into Fall's basin. */
const LEAN_START: [number, number] = [3, 10];
const gateHere = () => !hasKey('lore_gate') && !flag('back_lore_gate');

defProp('leangate', {
  w: 1, h: 1,
  paint(x, y) {
    // A small garden gate leaning on the post where it stopped rolling.
    rect(x - 5, y + 1, 1, 7, '#e8e0c8'); rect(x, y + 1, 1, 7, '#e8e0c8');
    rect(x - 5, y + 2, 6, 1, '#e8e0c8'); rect(x - 5, y + 5, 6, 1, '#e8e0c8'); rect(x - 4, y + 3, 1, 2, '#b8b098');
  },
});

// Reaching the far side solves a basin and its stones stay where they are. Walking out of an unsolved basin puts every stone back.
field.stepHooks.push(f => {
  const b = f.map.basin;
  if (!b || flag(b.flag)) return;
  const inside = f.x >= b.x && f.y >= b.y && f.x < b.x + b.w && f.y < b.y + b.h;
  if (inside && b.done(f.x, f.y)) { setFlag(b.flag); f.settleBasin(); save(); return; }
  if (inside) return;
  if (!f.objs.some(o => o.temp && (o.sunk || o.key !== `${o.kind}:${f.map.id}:${o.x},${o.y}`))) return;
  sfx('wind');
  f.fade = 12;
  f.loadObjs();
});

MAPS.fall.props = [...(MAPS.fall.props || []), { x: 10, y: 7, pic: 'leangate', when: gateHere }];
MAPS.fall.spots = [...(MAPS.fall.spots || []),
  { x: 10, y: 7, when: gateHere, script: async () => { await giveKeyItem('lore_gate', 'Ouro gets the gate, leaning on the post where it stopped rolling.'); } },
  stash('fa_glass', 10, 9, 'In the corner past the holes, a lump of star glass.', { items: [['starglass', 1]] }),
  { x: 18, y: 17, when: () => !!flag('keysAsked') && !flag('fallKeys'), script: async () => { setFlag('fallKeys'); sfx('level'); await notice('Ouro finds a ring of keys against the star, warm through.'); } },
];
MAPS.fall.npcs.push({ id: 'leanman', x: 5, y: 12, sprite: 'elder', name: 'Basin-keeper', dir: 3, talk: 'leanman' });

// The basin-keeper numbers everything he says.
defScript('leanman', async () => {
  if (flag('leanSolved')) { await say('Basin-keeper', 'One: you crossed. Two: the stones stay put now. Three: nobody does that.'); return; }
  await say('Basin-keeper', 'One: round stones roll till they hit something. Two: never uphill. Three: a hole eats one.');
  await say('Basin-keeper', 'One: the gate\'s past the holes. Two: haul stones stop a roll. Three: walk out and it all rolls back.');
});

PUZZLE_DATA.extra.push(() => {
  // Round stones roll east, north, or south until stopped, never west. A hole swallows one and becomes ground. Haul stones are dragged.
  const m = MAPS.fall, b = m.basin!;
  const W = m.rows[0].length;
  const at = (i: number) => m.rows[Math.floor(i / W)]?.[i % W] ?? '#';
  const inB = (i: number) => { const x = i % W, y = Math.floor(i / W); return x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h; };
  const wall = (i: number) => !inB(i) || (isSolid(at(i)) && !'o@O'.includes(at(i)));
  const balls: number[] = [], stones: number[] = [], holes: number[] = [];
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
    const i = y * W + x, ch = at(i);
    if (ch === 'o') balls.push(i); if (ch === '@') stones.push(i); if (ch === 'O') holes.push(i);
  }
  const solve = (drag: boolean): number => {
    const key = (o: number, bl: number[], s: number[], h: number[]) => [o, [...bl].sort().join(), [...s].sort().join(), [...h].sort().join()].join('|');
    const o0 = LEAN_START[1] * W + LEAN_START[0];
    const seen = new Set([key(o0, balls, stones, holes)]);
    let frontier: [number, number[], number[], number[]][] = [[o0, balls, stones, holes]];
    const D = [1, -1, W, -W];
    for (let d = 0; frontier.length && d < 200; d++) {
      const next: typeof frontier = [];
      for (const [o, bl, s, h] of frontier) {
        if (b.done(o % W, Math.floor(o / W))) return d;
        for (const step of D) {
          const n = o + step;
          if (wall(n)) continue;
          const bi = bl.indexOf(n);
          if (bi >= 0) {
            if (step === -1) continue;
            let c = n, nb = bl.slice(), nh = h, gone = false;
            for (;;) {
              const t = c + step;
              if (wall(t) || bl.includes(t) || s.includes(t)) break;
              if (h.includes(t)) { nb.splice(bi, 1); nh = h.filter(x => x !== t); gone = true; break; }
              c = t;
            }
            if (!gone && c === n) continue;
            if (!gone) nb[bi] = c;
            const k = key(o, nb, s, nh);
            if (!seen.has(k)) { seen.add(k); next.push([o, nb, s, nh]); }
            continue;
          }
          if (s.includes(n) || h.includes(n)) continue;
          const k1 = key(n, bl, s, h);
          if (!seen.has(k1)) { seen.add(k1); next.push([n, bl, s, h]); }
          if (!drag) continue;
          const si = s.indexOf(o - step);
          if (si >= 0) {
            const ns = s.slice(); ns[si] = o;
            const k2 = key(n, bl, ns, h);
            if (!seen.has(k2)) { seen.add(k2); next.push([n, bl, ns, h]); }
          }
        }
      }
      if (seen.size > 200000) return -2;
      frontier = next;
    }
    return -1;
  };
  if (solve(true) < 0) return 'puzzle 11: the lean cannot be crossed';
  if (solve(false) >= 0) return 'puzzle 11: the lean can be crossed without the haul stones';
  return null;
});

MAPS.glassdesert.spots = [...(MAPS.glassdesert.spots || []), stash('gd_bead', 32, 19, 'By the south way, a bead of star glass fused to a loose lump of it.', { notion: 'glassbead', items: [['starglass', 1]] })];

// ---------------------------------------------------------------- the house of the woman whose keys roll to the middle

// The woman asks herself every question and answers it.
defMap({
  id: 'fallhouse', name: 'The house on the slope', region: 11, indoor: true, music: 'home',
  rows: room(['p_p_____', '________', '____cc__', '________', '________', '________']),
  warps: roomDoor('fall', 28, 6),
  npcs: [{ id: 'keywoman', x: 3, y: 2, sprite: 'starwalker', name: 'Woman', dir: 0, talk: 'keywoman' }],
  spots: [look(6, 0, 'A row of hooks for keys. Every one of them is empty.')],
});

defScript('keywoman', async () => {
  if (flag('keysBack')) { await say('Woman', 'Will they roll off again? They will. Will I send you? I might.'); return; }
  if (flag('fallKeys')) {
    await say('Woman', 'Are those mine? They are. Warm, too. Do I mind warm keys? Not today.');
    setFlag('keysBack');
    await reward({ rind: 500 });
    save();
    return;
  }
  if (flag('keysAsked')) { await say('Woman', 'Are they at the star still? They are. Round the bottom, on the warm side.'); return; }
  await say('Woman', 'Where are my keys? At the star. Where else would they be?');
  await say('Woman', 'Do I go and fetch them? Not on these knees. Not back up that slope.');
  setFlag('keysAsked');
});

// ---------------------------------------------------------------- the Long Way Round

defMap({
  id: 'longway', name: 'The Long Way Round', region: 42, music: 'longway',
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'T.......,,,,,...........~~~~~............,,,,,.........T',
    'T....,,,,,,,,,,,........~~~~~.........,,,,,,,,,,,......T',
    'T...,,,,,,,,,,,,,.......~~~~~........,,,,,,,,,,,,,.....T',
    'T....,,,,,,,,,,,........~~~~~.........,,,,,,,,,,,......T',
    'T.......,,,,,...........~sss~............,,,,,.........T',
    'Tsssssssssssssssssssssss~sss~sussssssssssssssssxsssxsssT',
    'Txssssssssssssssssssssss~sss~@usssssssssxssssssssssssssT',
    'Tsssssssssssssssssssssss~sss~sussssssssssssssssssssssssT',
    'Txssssxsssxssssxssssssss~sss~susssssssssssssssssssssssxT',
    'Tsssssssssssssssssssssss~sss~sussssssssssssssssssssssxsT',
    'Tssssxsxxsssssssxsssssss~sss~spssssssssssssssssssssssssT',
    '=f======================~sss~===========================',
    'Tsxsssssxsssssssxsssssss~sss~spssssssssssssssssssssssssT',
    'Tsssssssssssssssssssxsss~@us~sussssssssssssssssssssssxsT',
    'Tsssxssssxs,,,,,ssssxsss~sss~sussssssxss,,,,,sxssssssssT',
    'Tsssssss,,,,,,,,,,,sssss~~~~~sussxsss,,,,,,,,,,,sssssssT',
    'Tssssssxsss,,,,,sxssssss~~~~~susssssssss,,,,,ssssssssssT',
    'Tsssssssssssssssssssssss~~~~~ssssssssssssssssssssssssssT',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~T',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  // The field gate at the west end opens once Ouro lifts its bar, and Turnstone's side opens with it.
  mods: [{ x: 1, y: 12, ch: '=', when: () => !!flag('longwayOpen') }],
  // The ford: until Ouro reaches the west bank once, walking away from the brook mouth puts both haul stones back.
  basin: { x: 22, y: 1, w: 12, h: 18, flag: 'fordCrossed', done: x => x <= 23 },
  warps: [
    { x: 55, y: 12, to: 'fall', tx: 1, ty: 26, dir: 1 },
    { x: 0, y: 12, to: 'fellside', tx: 42, ty: 15, dir: 3, when: () => !!flag('longwayOpen') },
  ],
  zone: { kinds: kinds([['tor', 3], ['flare', 2], ['siderite', 2], ['slag', 2], ['drift', 3]]), lv: [40, 46], n: 12, area: 'shoreline' },
  props: [{ x: 30, y: 21, pic: 'holmfar', when: () => chapter() >= 8 && !flag('holmHere') }],
  npcs: [
    { id: 'fordsitter', x: 31, y: 10, sprite: 'elder', name: 'Ford-sitter', dir: 3, talk: 'fordsitter' },
    { id: 'dunewalker', x: 40, y: 4, sprite: 'villager2', name: 'Dune walker', dir: 0, trainer: { name: 'Dune walker', team: [['drift', 44], ['tor', 45]], intro: 'Sand goes west, I go west. Sand stops, I stop. We\'ve an understanding.', defeat: 'Sand\'s moving. I\'m moving.', sight: 3 } },
    { id: 'tiderunner', x: 12, y: 14, sprite: 'child', name: 'Tide-runner', dir: 2, trainer: { name: 'Tide-runner', team: [['slag', 44], ['siderite', 45]], intro: 'Everything washes up here! Even you! Hi!', defeat: 'You can wash back out now! Bye!', sight: 3 } },
  ],
  spots: [
    { x: 1, y: 12, when: () => !flag('longwayOpen'), script: async () => {
      const c = await choose(['Lift the bar', 'Leave it'], true, 'A field gate. The bar is on this side.');
      if (c !== 0) return;
      sfx('switch');
      setFlag('longwayOpen');
      save();
    } },
    { x: 30, y: 19, when: () => chapter() >= 8 && !flag('holmHere'), script: async () => { await narr('Far out, a pale hump in the water, heading west.'); } },
    stash('lw_glass', 50, 18, 'On the tideline, two pieces of sea glass worn round.', { items: [['beachglass', 2]] }),
  ],
});
SPAWNS.longway = [54, 12];

PUZZLE_DATA.extra.push(() => {
  // From the east bank, with the haul and no worn whorl, Ouro can tip stones into both channels and reach the west bank.
  const m = MAPS.longway, b = m.basin!;
  const tile = (x: number, y: number) => m.rows[y]?.[x] ?? 'T';
  const inB = (x: number, y: number) => x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h;
  const start: number[][] = [];
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (tile(x, y) === '@') start.push([x, y, 0]);
  type St = [number, number, number[][]];
  const key = ([x, y, s]: St) => x + ',' + y + '|' + s.map(p => p.join()).sort().join(';');
  const stoneAt = (s: number[][], x: number, y: number) => s.findIndex(p => p[0] === x && p[1] === y && !p[2]);
  const sunkAt = (s: number[][], x: number, y: number) => s.some(p => p[0] === x && p[1] === y && p[2]);
  const open = (s: number[][], x: number, y: number) => inB(x, y) && stoneAt(s, x, y) < 0 && (sunkAt(s, x, y) || (!isSolid(tile(x, y)) || tile(x, y) === '@'));
  const s0: St = [33, 12, start];
  const seen = new Set([key(s0)]);
  let frontier: St[] = [s0];
  for (let d = 0; frontier.length && d < 150; d++) {
    const next: St[] = [];
    const push = (st: St) => { const k = key(st); if (!seen.has(k)) { seen.add(k); next.push(st); } };
    for (const [x, y, s] of frontier) {
      if (b.done(x, y)) return null;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        const ahead = stoneAt(s, nx, ny);
        if (ahead >= 0) {
          if (tile(nx + dx, ny + dy) === '~' && !sunkAt(s, nx + dx, ny + dy)) push([x, y, s.map((p, i) => (i === ahead ? [nx + dx, ny + dy, 1] : p))]);
          continue;
        }
        if (!open(s, nx, ny)) continue;
        push([nx, ny, s]);
        const behind = stoneAt(s, x - dx, y - dy);
        if (behind >= 0 && !sunkAt(s, x, y) && !isSolid(tile(x, y))) push([nx, ny, s.map((p, i) => (i === behind ? [x, y, 0] : p))]);
      }
    }
    frontier = next;
  }
  return 'the Long Way Round: the ford cannot be crossed with the haul stones';
});

// The ford-sitter ends everything the same way.
defScript('fordsitter', async () => {
  if (flag('longwayOpen')) { await say('Ford-sitter', 'Gate\'s open at the west end. Turnstone\'s just there. Somebody ought to visit.'); return; }
  await say('Ford-sitter', 'Bridge went in the spring flood. Somebody ought to build it back. Somebody ought to.');
  await say('Ford-sitter', 'Big stones on the banks. Tip one in the water and it\'s a step. Somebody ought to.');
  await say('Ford-sitter', 'Get it wrong and walk off, the brook rolls them back. Somebody ought to stop it.');
});

// Turnstone's east field gate, barred from the far side until Ouro lifts the bar on the Long Way Round.
MAPS.fellside.mods = [...(MAPS.fellside.mods || []), { x: 42, y: 15, ch: '=', when: () => !!flag('longwayOpen') }];
MAPS.fellside.warps.push({ x: 43, y: 15, to: 'longway', tx: 2, ty: 12, dir: 1, when: () => !!flag('longwayOpen') });
MAPS.fellside.spots = [...(MAPS.fellside.spots || []), { ...look(42, 15, 'A field gate, barred from the other side.'), when: () => !flag('longwayOpen') }];
