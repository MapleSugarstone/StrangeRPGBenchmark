// The geode under the crater fields: four maps of crystal that open once all twelve Setting puzzles are set.
// Setter's trays in the floor hold crystal arms. Ouro turns them, grabs, and lets go to bring a stone to a socket,
// as on the Setting board, and each socket opens the way down. Carcanet waits at the bottom.
import { rect, px } from '../engine/screen';
import {
  act, bell, choose, emote, faceToward, facePlayer, field, fightWild, flag, G, giveMon, hint, mon, morphTo, pan, panBack,
  setFlag, shake, sound, wait, walkTo,
} from '../game/api';
import { drawStone } from '../game/minigames/setting';
import { save } from '../game/state';
import { defMap, defScript, MAPS } from '../game/world';
import { Canvas, kinds, link } from './areakit';

const REGION = 44;
const SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19];
const chimes = async (n: number, gap = 8): Promise<void> => { for (let i = 0; i < n; i++) { bell(12 + SCALE[i % 12]); await wait(gap); } };

// ---------------------------------------------------------------- the way in, on the crater fields

link('route8', 37, 21, 'q', { to: 'geodemouth', tx: 14, ty: 2, dir: 0 }, () => !!flag('geodeOpen'));
(MAPS.route8.spots ||= []).push({
  x: 37, y: 21, when: () => !flag('geodeOpen'),
  script: async () => {
    // The seam in the crater's rim chimes once for each puzzle Ouro has set.
    await act('ouro', 'bow');
    const n = G.gem.solved.length;
    await chimes(n);
    await wait(16);
    await emote('ouro', n ? 'music' : 'question');
    if (!flag('geodeSeamTold')) { setFlag('geodeSeamTold'); await hint(`(The seam in the rim chimes once for each Setting puzzle set: ${n} of 12.)`); }
  },
});
(MAPS.route8.triggers ||= []).push({ x: 35, y: 22, w: 5, h: 1, script: 'geodeOpens', when: () => G.gem.solved.length >= 12 && !flag('geodeOpen') });
defScript('geodeOpens', async () => {
  await walkTo('ouro', 37, 22);
  facePlayer(2);
  await act('ouro', 'bow');
  await chimes(12, 6);
  await shake(24);
  sound('boom');
  await morphTo('geodeOpen', 37, 21, 4);
  await emote('ouro', 'surprise');
  save();
});

// ---------------------------------------------------------------- crystal arms in setter's trays

const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
interface Arm { x: number; y: number; d0: number }
interface ArmPuzzle {
  id: string;
  map: string;
  /** The tray, all 'j' tiles. */
  tx: number; ty: number; tw: number; th: number;
  arms: Arm[];
  stone: [number, number];
  socket: [number, number];
  /** A polisher cell. With one, the stone starts rough and the socket takes it only polished. */
  polish?: [number, number];
  /** The wall tile that opens when the stone is set. */
  door: [number, number];
}

const PUZZLES: ArmPuzzle[] = [
  { id: 'gzA', map: 'geodemouth', tx: 13, ty: 15, tw: 3, th: 2, arms: [{ x: 14, y: 15, d0: 1 }], stone: [13, 15], socket: [15, 15], door: [22, 18] },
  { id: 'gzB', map: 'geodehall', tx: 14, ty: 12, tw: 5, th: 2, arms: [{ x: 15, y: 12, d0: 1 }, { x: 17, y: 12, d0: 1 }], stone: [14, 12], socket: [18, 12], door: [16, 21] },
  { id: 'gzC', map: 'geodevein', tx: 10, ty: 14, tw: 3, th: 2, arms: [{ x: 11, y: 14, d0: 0 }], stone: [10, 14], socket: [12, 14], polish: [11, 15], door: [17, 17] },
];

const dirOf = (pz: ArmPuzzle, i: number): number => { const v = G.flags[pz.id + 'A' + i]; return v ? v - 1 : pz.arms[i].d0; };
const stoneAt = (pz: ArmPuzzle): [number, number] => { const v = G.flags[pz.id + 'S']; return v ? [(v - 1) % 64, Math.floor((v - 1) / 64)] : pz.stone; };
const holder = (pz: ArmPuzzle): number => (G.flags[pz.id + 'H'] || 0) - 1;
const polished = (pz: ArmPuzzle): boolean => !pz.polish || !!G.flags[pz.id + 'P'];
const solved = (pz: ArmPuzzle): boolean => !!flag(pz.id + 'Open');
const inTray = (pz: ArmPuzzle, x: number, y: number): boolean =>
  x >= pz.tx && y >= pz.ty && x < pz.tx + pz.tw && y < pz.ty + pz.th && !pz.arms.some(a => a.x === x && a.y === y);
const clawOf = (pz: ArmPuzzle, i: number, d = dirOf(pz, i)): [number, number] => [pz.arms[i].x + DX[d], pz.arms[i].y + DY[d]];
const same = (a: [number, number], b: [number, number]) => a[0] === b[0] && a[1] === b[1];

/** The arm swinging now, for the painter: which, from and to what direction, and the frame it started. */
let swing: { id: string; i: number; from: number; to: number; t0: number } | null = null;
const SWING = 10;

function dashed(x: number, y: number, c: string): void { for (let k = 0; k < 8; k += 2) { px(x + k, y, c); px(x + k, y + 7, c); px(x, y + k, c); px(x + 7, y + k, c); } }
function disc(cx: number, cy: number, r: number, c: string): void {
  for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy) + 0.5); rect(cx - w, cy + dy, w * 2 + 1, 1, c); }
}

/** The arms, the stone, the socket, and any polisher, drawn after the light pass so the crystal keeps its own colors. */
function trayOverlay(): void {
  const t = field.t;
  for (const pz of PUZZLES) {
    if (pz.map !== field.map.id) continue;
    const x = pz.tx * 8 - field.cam[0], y = pz.ty * 8 - field.cam[1];
    if (x < -48 || y < -48 || x > 192 || y > 192) continue;
    {
      const cx = (gx: number) => x + (gx - pz.tx) * 8 + 4, cy = (gy: number) => y + (gy - pz.ty) * 8 + 4;
      const [sx, sy] = pz.socket;
      dashed(cx(sx) - 4, cy(sy) - 4, solved(pz) && (t >> 3) % 2 ? '#fff4c4' : '#f0c860');
      if (pz.polish) { const [qx, qy] = pz.polish; disc(cx(qx), cy(qy), 3, '#3e7a98'); disc(cx(qx), cy(qy), 1, '#25475a'); px(cx(qx) - 2, cy(qy) - 3, '#c8f0ff'); }
      let stone: [number, number] = [cx(stoneAt(pz)[0]), cy(stoneAt(pz)[1])];
      pz.arms.forEach((a, i) => {
        let ang = dirOf(pz, i) * Math.PI / 2;
        const sw = swing && swing.id === pz.id && swing.i === i ? swing : null;
        if (sw) {
          const k = Math.min(1, (t - sw.t0) / SWING);
          let turn = sw.to - sw.from;
          if (turn > 2) turn -= 4; if (turn < -2) turn += 4;
          ang = (sw.from + turn * k) * Math.PI / 2;
        }
        const bx = cx(a.x), by = cy(a.y), gx = bx + Math.cos(ang) * 8, gy = by + Math.sin(ang) * 8;
        for (let s = 0; s <= 8; s++) rect(Math.round(bx + (gx - bx) * s / 8) - 1, Math.round(by + (gy - by) * s / 8) - 1, 2, 2, '#f0c860');
        disc(bx, by, 3, '#8a6a34'); disc(bx, by, 2, '#e0b0ff'); px(bx, by, '#ffffff');
        if (holder(pz) === i) stone = [gx, gy];
        const nx = -Math.sin(ang), ny = Math.cos(ang), open = holder(pz) === i ? 2 : 4;
        for (const s of [-1, 1]) rect(Math.round(gx + nx * open * s), Math.round(gy + ny * open * s), 1, 1, '#f0c860');
      });
      drawStone(pz.polish ? (polished(pz) ? 'amber' : 'resin') : 'pearl', stone[0], stone[1], 3);
    }
  }
}

const TRAY_MAPS = new Set(PUZZLES.map(p => p.map));
// A map load clears the overlay, so each tray map sets it again on entering and on the first step after a save loads.
defScript('geodeEnter', async () => { field.overlay = trayOverlay; });
field.stepHooks.push(f => { if (TRAY_MAPS.has(f.map.id) && !f.overlay) f.overlay = trayOverlay; });

async function turnArm(pz: ArmPuzzle, i: number, by: number): Promise<void> {
  const from = dirOf(pz, i), to = (from + by + 4) % 4;
  const [nx, ny] = clawOf(pz, i, to);
  // The arm only swings over its own tray, so it never knocks the stone onto the floor.
  if (!inTray(pz, nx, ny)) { sound('bump'); return; }
  sound('switch');
  swing = { id: pz.id, i, from, to, t0: field.t };
  G.flags[pz.id + 'A' + i] = to + 1;
  await wait(SWING);
  swing = null;
  if (holder(pz) === i) G.flags[pz.id + 'S'] = ny * 64 + nx + 1;
}

async function letGo(pz: ArmPuzzle): Promise<void> {
  G.flags[pz.id + 'H'] = 0;
  sound('blip');
  const at = stoneAt(pz);
  if (pz.polish && same(at, pz.polish) && !polished(pz)) {
    G.flags[pz.id + 'P'] = 1;
    await wait(8);
    bell(24); sound('heal');
    return;
  }
  if (!same(at, pz.socket)) return;
  if (!polished(pz)) {
    await wait(8);
    sound('pegFail');
    await emote('ouro', 'question');
    if (!flag('roughTold')) { setFlag('roughTold'); await hint('(The socket rings flat. It wants a polished stone.)'); }
    return;
  }
  await wait(8);
  await chimes(5, 6);
  await shake(16);
  await morphTo(pz.id + 'Open', pz.door[0], pz.door[1], 3);
  save();
}

async function armSpot(pz: ArmPuzzle, i: number): Promise<void> {
  if (solved(pz)) { bell(19); await emote('ouro', 'music'); return; }
  for (;;) {
    const hold = holder(pz) === i;
    const c = await choose(['Turn left', 'Turn right', hold ? 'Let go' : 'Grab'], true, pz.arms.length > 1 ? `Arm ${i + 1}` : 'The arm');
    if (c < 0) return;
    if (c === 0) await turnArm(pz, i, -1);
    else if (c === 1) await turnArm(pz, i, 1);
    else if (hold) await letGo(pz);
    else if (holder(pz) < 0 && same(stoneAt(pz), clawOf(pz, i))) { G.flags[pz.id + 'H'] = i + 1; sound('ok'); }
    else { sound('bump'); await emote('ouro', 'sweat'); }
    if (solved(pz)) return;
  }
}

/** The spot at each pivot, the door that opens, and the enter script that draws the tray, for one map. */
function trayParts(pz: ArmPuzzle) {
  return {
    enter: 'geodeEnter',
    spots: pz.arms.map((a, i) => ({ x: a.x, y: a.y, script: () => armSpot(pz, i) })),
    mods: [{ x: pz.door[0], y: pz.door[1], ch: '.', when: () => solved(pz) }],
  };
}

// ---------------------------------------------------------------- the maps

const ZONE = (lv: [number, number]) => ({ kinds: kinds([['cullet', 3], ['fulgur', 2], ['quarry', 2], ['tor', 2], ['haze', 1], ['relic', 1]]), lv, n: 12, area: 'crystal' });

// The mouth: a stair down from the crater, a wide cave, and the first tray. Its door is in the wall below.
const gm = new Canvas(30, 22, '#');
gm.rect(12, 1, 5, 2, '.').put(14, 1, 'q');
gm.rect(3, 3, 24, 15, '.').rect(2, 6, 1, 6, '.').rect(27, 5, 1, 7, '.');
gm.rect(4, 4, 5, 3, ',').rect(20, 8, 5, 3, ',').rect(4, 12, 4, 2, ',').rect(9, 9, 3, 2, ',');
for (const [x, y] of [[8, 7], [9, 7], [18, 5], [24, 14], [3, 15], [26, 4], [26, 16], [11, 14], [17, 9]]) gm.put(x, y, 'T');
for (const [x, y] of [[6, 9], [19, 12], [11, 4], [25, 7], [18, 16], [4, 16]]) gm.put(x, y, 'P');
gm.rect(13, 15, 3, 2, 'j').put(12, 15, 'P').put(16, 16, 'P');
gm.put(22, 19, '.').put(22, 20, 'q');
const pa = trayParts(PUZZLES[0]);
defMap({
  id: 'geodemouth', name: 'The Geode\'s Mouth', region: REGION, music: 'geode', rows: gm.rows(),
  warps: [
    { x: 14, y: 1, to: 'route8', tx: 37, ty: 22, dir: 0 },
    { x: 22, y: 20, to: 'geodehall', tx: 16, ty: 2, dir: 0 },
  ],
  zone: ZONE([48, 52]),
  npcs: [],
  ...pa,
});

// The druse hall: one wide hollow lined with clusters, and a tray with two arms that pass the stone hand to hand.
const gh = new Canvas(34, 24, '#');
gh.rect(14, 1, 5, 2, '.').put(16, 1, 'q');
gh.rect(2, 3, 30, 18, '.').rect(1, 8, 1, 8, '.').rect(32, 6, 1, 9, '.');
gh.rect(3, 4, 6, 4, ',').rect(24, 4, 6, 3, ',').rect(3, 15, 7, 4, ',').rect(23, 16, 7, 3, ',');
for (const [x, y] of [[10, 5], [11, 5], [21, 4], [6, 10], [27, 10], [28, 10], [12, 17], [20, 18], [2, 19], [31, 19], [9, 12]]) gh.put(x, y, 'T');
for (const [x, y] of [[13, 7], [19, 7], [5, 13], [29, 13], [16, 18], [12, 15]]) gh.put(x, y, 'P');
gh.rect(14, 12, 5, 2, 'j').put(13, 13, 'P').put(19, 12, 'P');
gh.put(16, 22, 'q');
const pb = trayParts(PUZZLES[1]);
defMap({
  id: 'geodehall', name: 'The Druse Hall', region: REGION, music: 'geode', rows: gh.rows(),
  warps: [
    { x: 16, y: 1, to: 'geodemouth', tx: 22, ty: 19, dir: 2 },
    { x: 16, y: 22, to: 'geodevein', tx: 12, ty: 2, dir: 0 },
  ],
  zone: ZONE([49, 53]),
  npcs: [],
  ...pb,
});

// The vein: a narrow way down that bends twice, a tray with a polisher, and a last passage to the bottom.
const gv = new Canvas(24, 28, '#');
gv.put(12, 1, 'q');
gv.rect(10, 2, 5, 5, '.').rect(4, 6, 11, 3, '.').rect(4, 9, 4, 4, '.').rect(4, 12, 16, 5, '.');
gv.rect(16, 18, 5, 6, '.').put(17, 17, '#');
gv.rect(11, 3, 3, 2, ',').rect(4, 9, 3, 3, ',').rect(17, 19, 3, 3, ',');
for (const [x, y] of [[14, 6], [4, 6], [19, 12], [4, 16], [20, 23]]) gv.put(x, y, 'T');
for (const [x, y] of [[10, 3], [7, 7], [15, 12], [16, 22], [6, 14]]) gv.put(x, y, 'P');
gv.rect(10, 14, 3, 2, 'j').put(9, 15, 'P').put(13, 14, 'P');
gv.put(18, 24, 'q');
const pc = trayParts(PUZZLES[2]);
defMap({
  id: 'geodevein', name: 'The Vein', region: REGION, music: 'geode', rows: gv.rows(),
  warps: [
    { x: 12, y: 1, to: 'geodehall', tx: 16, ty: 20, dir: 2 },
    { x: 18, y: 24, to: 'geodeheart', tx: 13, ty: 17, dir: 2 },
  ],
  zone: ZONE([50, 54]),
  npcs: [],
  ...pc,
});

// The heart: a round hollow at the very bottom, ringed with clusters, where Carcanet sets its stones.
const gt = new Canvas(26, 20, '#');
gt.rect(4, 2, 18, 15, '.').rect(3, 5, 1, 9, '.').rect(22, 5, 1, 9, '.').rect(12, 17, 3, 1, '.').put(13, 18, 'q');
for (const [x, y] of [[4, 2], [5, 2], [20, 2], [21, 2], [4, 16], [21, 16], [3, 5], [22, 5], [3, 13], [22, 13], [8, 4], [17, 4]]) gt.put(x, y, 'T');
for (const [x, y] of [[10, 6], [16, 6], [9, 10], [17, 10], [11, 13], [15, 13]]) gt.put(x, y, 'P');
defMap({
  id: 'geodeheart', name: 'The Hollow', region: REGION, music: 'geode', rows: gt.rows(),
  warps: [{ x: 13, y: 18, to: 'geodevein', tx: 18, ty: 23, dir: 2 }],
  npcs: [
    { id: 'carcanet', x: 13, y: 7, sprite: 'stone', mon: 'carcanet', name: 'Carcanet', dir: 0, talk: 'carcanet', when: () => !flag('carcanetDone') },
  ],
  triggers: [{ x: 11, y: 15, w: 5, h: 1, script: 'heartSeen', when: () => !flag('heartSeen') && !flag('carcanetDone') }],
});

// ---------------------------------------------------------------- Carcanet

const SET_FOUR = [12, 16, 19, 24];

defScript('heartSeen', async () => {
  setFlag('heartSeen');
  await walkTo('ouro', 13, 12);
  await pan(13, 7);
  for (const s of SET_FOUR) { bell(s); await wait(14); }
  await act('carcanet', 'hop');
  await emote('carcanet', 'music');
  await panBack();
  await emote('ouro', 'surprise');
});

defScript('carcanet', async () => {
  faceToward('carcanet', 'ouro');
  for (const s of SET_FOUR) { bell(s); await wait(10); }
  await act('carcanet', 'nod');
  const c = await choose(['Sound it', 'Leave it'], true);
  if (c !== 0) return;
  const r = await fightWild(mon('carcanet', 58), { bossHp: 2.8, ai: 'keeper', area: 'crystal' });
  if (r.pegged.length) {
    setFlag('carcanetDone');
    await giveMon(r.pegged[0]);
    await hint('(Carcanet sets its Stones in the order of its Tape. Write the Tape in Setting, under its name.)');
    save();
  } else if (r.result === 'lose') await field.lose();
});
