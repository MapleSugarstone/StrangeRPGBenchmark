// The geode under the crater fields: four maps of crystal that open once all twelve Setting puzzles are set.
// Setter's trays in the floor hold crystal arms. Ouro turns them, grabs, and lets go to bring a stone to a socket,
// as on the Setting board, and each socket opens the way down. Carcanet waits at the bottom, and it wakes only once every
// Setting sketch is set, the bought ones too.
import { rect, px } from '../engine/screen';
import {
  act, bell, choose, emote, faceToward, facePlayer, field, fightWild, flag, G, giveMon, hint, mon, morphTo, nearPlayer, pan, panBack,
  setFlag, shake, sound, wait, walkTo,
} from '../game/api';
import { drawStone } from '../game/minigames/setting';
import { POLISH, type Stone } from '../game/setting/core';
import { ALL_PUZZLES, baseSolved } from '../game/setting/puzzles';
import { save } from '../game/state';
import { defMap, defScript, MAPS } from '../game/world';
import { GRAPH_PUZZLES, type Move } from '../tools/worldcheck';
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
    const n = baseSolved(G.gem.solved);
    await chimes(n);
    await wait(16);
    await emote('ouro', n ? 'music' : 'question');
    if (!flag('geodeSeamTold')) { setFlag('geodeSeamTold'); await hint(`(The rim seam chimes once for each completed Setting puzzle: ${n} of 12.)`); }
  },
});
(MAPS.route8.triggers ||= []).push({ x: 35, y: 22, w: 5, h: 1, script: 'geodeOpens', when: () => baseSolved(G.gem.solved) >= 12 && !flag('geodeOpen') });
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

// Each tray is a small Setting board that Ouro works one arm at a time. An arm turns left or right, reaches out a cell
// and pulls back in, grabs the stone at its claw, and lets go. Bonded stones move as one piece. A move is refused when it
// would put a stone off the tray, on an arm's base, or on another stone, or point a claw off the tray. Stones nobody
// holds are worked by what lies under them: a setter bonds the stones on its two cells, and a polisher polishes the stone
// on it. The socket takes a resting piece that is exactly the shape it shows, and that opens the way down.
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
type Cell = [number, number];
interface Tray {
  id: string;
  map: string;
  /** The tray's floor as rows read from x0, y0: '.' is tray and anything else is not. */
  x0: number; y0: number; rows: string[];
  arms: { x: number; y: number; d0: number }[];
  /** Whether the arms reach out a second cell. */
  reach?: boolean;
  stones: [number, number, Stone][];
  bonds?: [number, number][];
  setters?: [Cell, Cell][];
  polishers?: Cell[];
  socket: { atoms: [number, number, Stone][]; bonds: [number, number][] };
  /** The wall tile that opens when the socket takes its piece. */
  door: Cell;
  /** Where Ouro stands to work the first arm, for the puzzle checks. */
  view: Cell;
}
interface ArmNow { d: number; len: number; hold: boolean }
interface TrayNow { arms: ArmNow[]; atoms: { x: number; y: number; s: Stone }[]; bonds: [number, number][] }
interface TrayMove { arm: number; label: string; next: TrayNow }

const CELLS = new Map<string, Set<number>>();
function cellSet(t: Tray): Set<number> {
  let s = CELLS.get(t.id);
  if (!s) {
    s = new Set();
    t.rows.forEach((r, j) => [...r].forEach((c, i) => { if (c === '.') s!.add((t.y0 + j) * 64 + t.x0 + i); }));
    CELLS.set(t.id, s);
  }
  return s;
}
const onTray = (t: Tray, x: number, y: number): boolean => cellSet(t).has(y * 64 + x) && !t.arms.some(a => a.x === x && a.y === y);
const clawAt = (t: Tray, i: number, a: ArmNow): Cell => [t.arms[i].x + DX[a.d] * a.len, t.arms[i].y + DY[a.d] * a.len];
const copyNow = (st: TrayNow): TrayNow => ({ arms: st.arms.map(a => ({ ...a })), atoms: st.atoms.map(a => ({ ...a })), bonds: st.bonds.map(b => [b[0], b[1]]) });
function trayStart(t: Tray): TrayNow {
  return { arms: t.arms.map(a => ({ d: a.d0, len: 1, hold: false })), atoms: t.stones.map(([x, y, s]) => ({ x, y, s })), bonds: (t.bonds || []).map(b => [b[0], b[1]]) };
}
const atomAt = (st: TrayNow, x: number, y: number): number => st.atoms.findIndex(a => a.x === x && a.y === y);
function pieceOf(st: TrayNow, k: number): Set<number> {
  const seen = new Set([k]), q = [k];
  while (q.length) { const c = q.pop()!; for (const [a, b] of st.bonds) { const o = a === c ? b : b === c ? a : -1; if (o >= 0 && !seen.has(o)) { seen.add(o); q.push(o); } } }
  return seen;
}
/** The atoms an arm holds: the piece under its claw. */
function heldBy(t: Tray, st: TrayNow, i: number): Set<number> {
  if (!st.arms[i].hold) return new Set();
  const [x, y] = clawAt(t, i, st.arms[i]), k = atomAt(st, x, y);
  return k < 0 ? new Set() : pieceOf(st, k);
}
function heldAll(t: Tray, st: TrayNow): Set<number> {
  const h = new Set<number>();
  st.arms.forEach((_, i) => { for (const k of heldBy(t, st, i)) h.add(k); });
  return h;
}
/** Setters bond and polishers polish the stones nobody holds. */
function settle(t: Tray, st: TrayNow): void {
  const held = heldAll(t, st);
  for (const [[ax, ay], [bx, by]] of t.setters || []) {
    const a = atomAt(st, ax, ay), b = atomAt(st, bx, by);
    if (a < 0 || b < 0 || held.has(a) || held.has(b)) continue;
    if (!st.bonds.some(([p, q]) => (p === a && q === b) || (p === b && q === a))) st.bonds.push([a, b]);
  }
  for (const [x, y] of t.polishers || []) { const k = atomAt(st, x, y); if (k >= 0 && !held.has(k) && POLISH[st.atoms[k].s]) st.atoms[k].s = POLISH[st.atoms[k].s]!; }
}
/** Whether a resting piece fills the socket exactly. */
function trayGoal(t: Tray, st: TrayNow): boolean {
  const held = heldAll(t, st), idx: number[] = [];
  for (const [x, y, s] of t.socket.atoms) { const k = atomAt(st, x, y); if (k < 0 || held.has(k) || st.atoms[k].s !== s) return false; idx.push(k); }
  const piece = pieceOf(st, idx[0]);
  if (piece.size !== idx.length || !idx.every(k => piece.has(k))) return false;
  const inside = st.bonds.filter(([a]) => piece.has(a));
  return inside.length === t.socket.bonds.length && t.socket.bonds.every(([a, b]) => inside.some(([p, q]) => (p === idx[a] && q === idx[b]) || (p === idx[b] && q === idx[a])));
}
/** Whether a resting piece lies over every socket cell without filling it, so the socket rings flat. */
function trayFlat(t: Tray, st: TrayNow): boolean {
  const held = heldAll(t, st);
  return !trayGoal(t, st) && t.socket.atoms.every(([x, y]) => { const k = atomAt(st, x, y); return k >= 0 && !held.has(k); });
}
function trayKey(st: TrayNow): string {
  const order = st.atoms.map((_, k) => k).sort((a, b) => (st.atoms[a].y * 64 + st.atoms[a].x) - (st.atoms[b].y * 64 + st.atoms[b].x));
  const pos = new Map(order.map((k, j) => [k, j]));
  return st.arms.map(a => `${a.d}${a.len}${a.hold ? 'h' : ''}`).join('') + '|' + order.map(k => `${st.atoms[k].x},${st.atoms[k].y},${st.atoms[k].s}`).join(';') + '|'
    + st.bonds.map(([a, b]) => [pos.get(a)!, pos.get(b)!].sort((p, q) => p - q).join('-')).sort().join(',');
}
/** Every move the arms can make from a state. A refused move is not in the list. */
function trayMoves(t: Tray, st: TrayNow): TrayMove[] {
  const out: TrayMove[] = [];
  st.arms.forEach((a, i) => {
    const [px0, py0] = [t.arms[i].x, t.arms[i].y];
    const held = heldBy(t, st, i);
    const tryMove = (label: string, arm: (n: ArmNow) => void, carry: (x: number, y: number) => Cell) => {
      const n = copyNow(st);
      arm(n.arms[i]);
      const [cx, cy] = clawAt(t, i, n.arms[i]);
      if (!onTray(t, cx, cy)) return;
      for (const k of held) [n.atoms[k].x, n.atoms[k].y] = carry(n.atoms[k].x, n.atoms[k].y);
      const seen = new Set<number>();
      for (const at of n.atoms) { const key = at.y * 64 + at.x; if (!onTray(t, at.x, at.y) || seen.has(key)) return; seen.add(key); }
      settle(t, n);
      out.push({ arm: i, label, next: n });
    };
    tryMove('Turn right', n => { n.d = (n.d + 1) % 4; }, (x, y) => [px0 - (y - py0), py0 + (x - px0)]);
    tryMove('Turn left', n => { n.d = (n.d + 3) % 4; }, (x, y) => [px0 + (y - py0), py0 - (x - px0)]);
    if (t.reach && a.len === 1) tryMove('Reach out', n => { n.len = 2; }, (x, y) => [x + DX[a.d], y + DY[a.d]]);
    if (t.reach && a.len === 2) tryMove('Pull in', n => { n.len = 1; }, (x, y) => [x - DX[a.d], y - DY[a.d]]);
    if (a.hold) { const n = copyNow(st); n.arms[i].hold = false; settle(t, n); out.push({ arm: i, label: 'Let go', next: n }); }
    else {
      const [cx, cy] = clawAt(t, i, a), k = atomAt(st, cx, cy);
      if (k >= 0 && !heldAll(t, st).has(k)) { const n = copyNow(st); n.arms[i].hold = true; out.push({ arm: i, label: 'Grab', next: n }); }
    }
  });
  return out;
}

// A tray's state lives in flags: each arm's direction, reach, and grip, each stone's cell and whether it is polished,
// and the bonds between stones. No flag means the tray as it starts.
function readTray(t: Tray): TrayNow {
  const st = trayStart(t);
  st.arms.forEach((a, i) => { const v = G.flags[t.id + 'a' + i]; if (v) { a.d = (v - 1) % 4; a.len = ((v - 1) >> 2 & 1) + 1; a.hold = !!((v - 1) >> 3 & 1); } });
  st.atoms.forEach((at, k) => {
    const v = G.flags[t.id + 's' + k];
    if (v) { at.x = (v - 1) % 64; at.y = Math.floor((v - 1) / 64); }
    if (G.flags[t.id + 'k' + k]) at.s = POLISH[at.s] || at.s;
  });
  const b = G.flags[t.id + 'b'];
  if (b) { st.bonds = []; for (let p = 0; p < st.atoms.length; p++) for (let q = p + 1; q < st.atoms.length; q++) if ((b - 1) >> (p * 4 + q) & 1) st.bonds.push([p, q]); }
  return st;
}
function writeTray(t: Tray, st: TrayNow): void {
  st.arms.forEach((a, i) => { G.flags[t.id + 'a' + i] = 1 + a.d + 4 * (a.len - 1) + (a.hold ? 8 : 0); });
  st.atoms.forEach((at, k) => { G.flags[t.id + 's' + k] = at.y * 64 + at.x + 1; G.flags[t.id + 'k' + k] = at.s !== t.stones[k][2] ? 1 : 0; });
  let m = 0;
  for (const [p, q] of st.bonds) m |= 1 << (Math.min(p, q) * 4 + Math.max(p, q));
  G.flags[t.id + 'b'] = m + 1;
}
/** Puts the tray back as it starts. The flag that says the tray is solved stays. */
function clearTray(t: Tray): void { for (const k of Object.keys(G.flags)) if (k.startsWith(t.id) && k !== t.id + 'Open') delete G.flags[k]; }
const solved = (t: Tray): boolean => !!flag(t.id + 'Open');

/** The move playing now, for the painter: which tray and arm, the state before and after, and the frame it started. */
let anim: { id: string; i: number; from: TrayNow; to: TrayNow; t0: number } | null = null;
const SWING = 10;

function dashed(x: number, y: number, c: string): void { for (let k = 0; k < 8; k += 2) { px(x + k, y, c); px(x + k, y + 7, c); px(x, y + k, c); px(x + 7, y + k, c); } }
function disc(cx: number, cy: number, r: number, c: string): void {
  for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy) + 0.5); rect(cx - w, cy + dy, w * 2 + 1, 1, c); }
}
/** The color a socket cell shows for the stone it wants. */
const WANT: Partial<Record<Stone, string>> = { pearl: '#f4ecdc', amber: '#f0a038', glass: '#88d8c8', star: '#f8e870' };

/** The trays' setters, polishers, sockets, stones, and arms, drawn after the light pass so the crystal keeps its colors. */
function trayOverlay(): void {
  const t = field.t;
  for (const tr of TRAYS) {
    if (tr.map !== field.map.id) continue;
    const cx = (gx: number) => gx * 8 - field.cam[0] + 4, cy = (gy: number) => gy * 8 - field.cam[1] + 4;
    if (cx(tr.x0) < -64 || cy(tr.y0) < -64 || cx(tr.x0) > 256 || cy(tr.y0) > 256) continue;
    const a0 = anim && anim.id === tr.id ? anim : null;
    const st = a0 ? a0.to : readTray(tr);
    // How far the move playing now has got, and where it carries a held stone at that point.
    const k = a0 ? Math.min(1, (t - a0.t0) / SWING) : 1;
    const moving = a0 ? heldBy(tr, a0.from, a0.i) : new Set<number>();
    const armPose = (i: number): [number, number] => {
      const b = st.arms[i];
      if (!a0 || a0.i !== i) return [b.d * Math.PI / 2, b.len];
      const f = a0.from.arms[i];
      let turn = b.d - f.d;
      if (turn > 2) turn -= 4; if (turn < -2) turn += 4;
      return [(f.d + turn * k) * Math.PI / 2, f.len + (b.len - f.len) * k];
    };
    const stoneAt = (s: number): [number, number] => {
      if (!a0 || !moving.has(s)) return [cx(st.atoms[s].x), cy(st.atoms[s].y)];
      const f = a0.from.atoms[s], arm = tr.arms[a0.i], fa = a0.from.arms[a0.i];
      const [ang, len] = armPose(a0.i);
      const rot = ang - fa.d * Math.PI / 2, rx = (f.x - arm.x) * 8, ry = (f.y - arm.y) * 8;
      const push = (len - fa.len) * 8;
      return [cx(arm.x) + rx * Math.cos(rot) - ry * Math.sin(rot) + Math.cos(ang) * push, cy(arm.y) + rx * Math.sin(rot) + ry * Math.cos(rot) + Math.sin(ang) * push];
    };
    for (const [x, y, s] of tr.socket.atoms) {
      dashed(cx(x) - 4, cy(y) - 4, solved(tr) && (t >> 3) % 2 ? '#fff4c4' : '#f0c860');
      rect(cx(x) - 1, cy(y) - 1, 2, 2, WANT[s] || '#ffffff');
    }
    for (const [[ax, ay], [bx, by]] of tr.setters || []) {
      // A brass clamp across the edge the two cells share.
      const mx = (cx(ax) + cx(bx)) / 2, my = (cy(ay) + cy(by)) / 2, along = ax === bx;
      rect(Math.round(mx) - (along ? 3 : 0), Math.round(my) - (along ? 0 : 3), along ? 7 : 1, along ? 1 : 7, '#d0a860');
      for (const [qx, qy] of [[ax, ay], [bx, by]]) { px(cx(qx) - 3, cy(qy) - 3, '#d0a860'); px(cx(qx) + 3, cy(qy) - 3, '#d0a860'); px(cx(qx) - 3, cy(qy) + 3, '#d0a860'); px(cx(qx) + 3, cy(qy) + 3, '#d0a860'); }
    }
    for (const [qx, qy] of tr.polishers || []) { disc(cx(qx), cy(qy), 3, '#3e7a98'); disc(cx(qx), cy(qy), 1, '#25475a'); px(cx(qx) - 2, cy(qy) - 3, '#c8f0ff'); }
    tr.arms.forEach((arm, i) => {
      const [ang, len] = armPose(i), bx = cx(arm.x), by = cy(arm.y), gx = bx + Math.cos(ang) * 8 * len, gy = by + Math.sin(ang) * 8 * len;
      const n = Math.round(8 * len);
      for (let s = 0; s <= n; s++) rect(Math.round(bx + (gx - bx) * s / n) - 1, Math.round(by + (gy - by) * s / n) - 1, 2, 2, '#f0c860');
      disc(bx, by, 3, '#8a6a34'); disc(bx, by, 2, '#e0b0ff'); px(bx, by, '#ffffff');
      const nx = -Math.sin(ang), ny = Math.cos(ang), open = st.arms[i].hold ? 2 : 4;
      for (const s of [-1, 1]) rect(Math.round(gx + nx * open * s), Math.round(gy + ny * open * s), 1, 1, '#f0c860');
    });
    for (const [p, q] of st.bonds) {
      const [ax, ay] = stoneAt(p), [bx, by] = stoneAt(q);
      for (let s = 0; s <= 4; s++) rect(Math.round(ax + (bx - ax) * s / 4) - 1, Math.round(ay + (by - ay) * s / 4), 2, 1, '#d0a860');
    }
    st.atoms.forEach((a, s) => { const [x, y] = stoneAt(s); drawStone(a.s, x, y, 3); });
  }
}

/** Plays one arm's move, keeps it, and plays whatever the setters, polishers, and socket do after it. */
async function playMove(tr: Tray, st: TrayNow, mv: TrayMove): Promise<void> {
  if (mv.label === 'Grab' || mv.label === 'Let go') sound(mv.label === 'Grab' ? 'ok' : 'blip');
  else {
    sound('switch');
    anim = { id: tr.id, i: mv.arm, from: st, to: mv.next, t0: field.t };
    await wait(SWING);
    anim = null;
  }
  writeTray(tr, mv.next);
  if (mv.next.atoms.some((a, k) => a.s !== st.atoms[k].s)) { await wait(8); bell(24); sound('heal'); }
  if (mv.next.bonds.length > st.bonds.length) { await wait(8); bell(19); sound('fit'); }
  if (trayGoal(tr, mv.next)) {
    await wait(8);
    await chimes(5, 6);
    await shake(16);
    await morphTo(tr.id + 'Open', tr.door[0], tr.door[1], 3);
    save();
    return;
  }
  if (mv.label === 'Let go' && trayFlat(tr, mv.next)) {
    await wait(8);
    sound('pegFail');
    await emote('ouro', 'question');
    if (!flag('roughTold')) { setFlag('roughTold'); await hint('(The socket rings flat. It wants the stones it shows, each on its own mark.)'); }
  }
}

async function armSpot(tr: Tray, i: number): Promise<void> {
  if (solved(tr)) { bell(19); await emote('ouro', 'music'); return; }
  for (;;) {
    const st = readTray(tr), a = st.arms[i];
    const labels = ['Turn left', 'Turn right'];
    if (tr.reach) labels.push(a.len === 1 ? 'Reach out' : 'Pull in');
    labels.push(a.hold ? 'Let go' : 'Grab');
    if (trayKey(st) !== trayKey(trayStart(tr))) labels.push('Start over');
    const c = await choose(labels, true, tr.arms.length > 1 ? `Arm ${i + 1}` : 'The arm');
    if (c < 0) return;
    if (labels[c] === 'Start over') { clearTray(tr); sound('back'); continue; }
    const mv = trayMoves(tr, st).find(m => m.arm === i && m.label === labels[c]);
    if (!mv) { sound('bump'); await emote('ouro', 'sweat'); continue; }
    await playMove(tr, st, mv);
    if (solved(tr)) return;
  }
}

/** The spot at each arm's base, the door that opens, and the enter script that draws the tray, for one map. */
function trayParts(tr: Tray) {
  return {
    enter: 'geodeEnter',
    spots: tr.arms.map((a, i) => ({ x: a.x, y: a.y, script: () => armSpot(tr, i) })),
    mods: [{ x: tr.door[0], y: tr.door[1], ch: '.', when: () => solved(tr) }],
  };
}

/** Lays a tray's floor into its map. */
function layTray(c: Canvas, tr: Tray): void { tr.rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '.') c.put(tr.x0 + i, tr.y0 + j, 'j'); })); }

// The mouth, one arm that reaches: two loose stones, a setter in line with the arm, and a socket one cell past it.
// The insight: the stone set on the far cell ends up on the outside, so the amber goes out first, and the finished pair
// is pushed one cell further by reaching out while holding it. Fewest moves: 13 (layouts from pz/traygen.mjs).
const TRAY_A: Tray = {
  id: 'gzA', map: 'geodemouth', x0: 12, y0: 12, rows: ['  .', '  .', '  .', '.....'],
  arms: [{ x: 14, y: 15, d0: 3 }], reach: true,
  stones: [[12, 15, 'amber'], [13, 15, 'pearl']],
  setters: [[[14, 13], [14, 14]]],
  socket: { atoms: [[14, 13, 'pearl'], [14, 12, 'amber']], bonds: [[0, 1]] },
  door: [22, 18], view: [14, 16],
};
// The vein, one arm with a polisher: rough resin, a pearl, and a setter under the arm. The polisher sits at the tray's
// end, where a set pair has no room. The insight: the resin has to be polished while it is loose, because once set it
// is held on the inside of the pair and the pair cannot reach the polisher. Fewest moves: 13.
const TRAY_C: Tray = {
  id: 'gzC', map: 'geodevein', x0: 9, y0: 13, rows: ['.....', ' .', ' .'],
  arms: [{ x: 10, y: 13, d0: 0 }], reach: true,
  stones: [[12, 13, 'resin'], [11, 13, 'pearl']],
  setters: [[[10, 14], [10, 15]]],
  polishers: [[9, 13]],
  socket: { atoms: [[10, 15, 'pearl'], [10, 14, 'amber']], bonds: [[0, 1]] },
  door: [17, 17], view: [10, 12],
};
// The druse hall, two arms that reach, on the two ends of a bent tray: a pearl and an amber already set as a pair, lying
// along the top, and a socket for the pair standing upright in the corner with the pearl on top. The insight: an arm
// swings a held pair about its own base, so the pair turns end over end only by changing hands, and it has to change
// hands three times before the second arm can pull it into the corner by its amber end. Fewest moves: 19.
const TRAY_B: Tray = {
  id: 'gzB', map: 'geodehall', x0: 13, y0: 10, rows: ['......', '...', '...', '...'],
  arms: [{ x: 15, y: 10, d0: 2 }, { x: 13, y: 12, d0: 1 }], reach: true,
  stones: [[17, 10, 'pearl'], [16, 10, 'amber']], bonds: [[0, 1]],
  socket: { atoms: [[14, 11, 'pearl'], [14, 12, 'amber']], bonds: [[0, 1]] },
  door: [16, 21], view: [15, 9],
};
const TRAYS: Tray[] = [TRAY_A, TRAY_B, TRAY_C];

const TRAY_MAPS = new Set(TRAYS.map(t => t.map));
// A map load clears the overlay, so each tray map sets it again on entering and on the first step after a save loads.
defScript('geodeEnter', async () => { field.overlay = trayOverlay; });
field.stepHooks.push(f => { if (TRAY_MAPS.has(f.map.id) && !f.overlay) f.overlay = trayOverlay; });

// The trays for the puzzle checks. Every arm move costs one, and Start over puts the tray back for nothing.
for (const [tr, name, without] of [
  [TRAY_A, 'The geode: one arm', ['without reaching out', (m: TrayMove) => m.label !== 'Reach out' && m.label !== 'Pull in']],
  [TRAY_B, 'The geode: two arms', ['with the second arm fixed', (m: TrayMove) => m.arm === 0]],
  [TRAY_C, 'The geode: polish first', ['without the polisher', (m: TrayMove) => !m.next.atoms.some(a => a.s === 'amber')]],
] as [Tray, string, [string, (m: TrayMove) => boolean]][]) {
  const start = trayStart(tr);
  const moves = (st: TrayNow, keep: (m: TrayMove) => boolean = () => true): Move<TrayNow>[] =>
    [...trayMoves(tr, st).filter(keep).map(m => ({ to: m.next, cost: 1 })), { to: start, cost: 0, reset: true }];
  GRAPH_PUZZLES.push({
    name, floor: 10, start, key: trayKey,
    moves: (st: TrayNow) => moves(st),
    goal: (st: TrayNow) => trayGoal(tr, st),
    exit: () => true,
    without: [[without[0], (st: TrayNow) => moves(st, without[1])]],
    show: trayKey,
    prize: { map: tr.map, at: tr.door, view: tr.view },
  });
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
layTray(gm, TRAY_A);
gm.put(22, 19, '.').put(22, 20, 'q');
const pa = trayParts(TRAY_A);
defMap({
  id: 'geodemouth', name: 'The Geode\'s Mouth', region: REGION, music: 'geode', rows: gm.rows(),
  warps: [
    { x: 14, y: 1, to: 'route8', tx: 37, ty: 22, dir: 0 },
    { x: 22, y: 20, to: 'geodehall', tx: 16, ty: 2, dir: 0 },
  ],
  zone: ZONE([24, 26]),
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
layTray(gh, TRAY_B);
gh.put(16, 22, 'q');
const pb = trayParts(TRAY_B);
defMap({
  id: 'geodehall', name: 'The Druse Hall', region: REGION, music: 'geode', rows: gh.rows(),
  warps: [
    { x: 16, y: 1, to: 'geodemouth', tx: 22, ty: 19, dir: 2 },
    { x: 16, y: 22, to: 'geodevein', tx: 12, ty: 2, dir: 0 },
  ],
  zone: ZONE([25, 27]),
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
layTray(gv, TRAY_C);
gv.put(18, 24, 'q');
const pc = trayParts(TRAY_C);
defMap({
  id: 'geodevein', name: 'The Vein', region: REGION, music: 'geode', rows: gv.rows(),
  warps: [
    { x: 12, y: 1, to: 'geodehall', tx: 16, ty: 20, dir: 2 },
    { x: 18, y: 24, to: 'geodeheart', tx: 13, ty: 17, dir: 2 },
  ],
  zone: ZONE([25, 27]),
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

/** Every sketch set, found and bought. Only then does Carcanet answer. */
const allSet = (): number => ALL_PUZZLES.filter(p => G.gem.solved.includes(p.id)).length;

defScript('carcanet', async () => {
  faceToward('carcanet', 'ouro');
  for (const s of SET_FOUR) { bell(s); await wait(10); }
  const n = allSet();
  if (n < ALL_PUZZLES.length) {
    // Its collar rings a note for each sketch Ouro has set, twelve at most, then goes still.
    await wait(12);
    await chimes(Math.min(n, 12), 4);
    await emote('carcanet', 'silence');
    await emote('ouro', 'question');
    await hint(`(Carcanet stays still. ${n} of its ${ALL_PUZZLES.length} settings chime. Place every sketch, including those you've bought.)`);
    return;
  }
  await act('carcanet', 'nod');
  const c = await choose(['Catch it', 'Let it be'], true);
  if (c !== 0) return;
  const r = await fightWild(mon('carcanet', nearPlayer(-9)), { bossHp: 2.8, ai: 'keeper', area: 'crystal' });
  if (r.pegged.length) {
    setFlag('carcanetDone');
    await giveMon(r.pegged[0]);
    await hint('(Carcanet arranges its Stones according to the sequence of its Tape.');
    await hint('Record the Tape in the Setting, beneath its name.)');
    save();
  } else if (r.result === 'lose') await field.lose();
});
