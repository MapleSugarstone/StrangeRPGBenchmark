import { rect, W, H, px as pxl, dither } from '../engine/screen';
import { text, textWidth, bigText, bigWidth } from '../engine/font';
import { input } from '../engine/input';
import { sfx, playMusic } from '../engine/audio';
import { UI, STONE, BRASS } from './palette';
import { list } from './ui';
import { hasSave } from './state';
import { game } from './registry';

const T = { cursor: 0, ready: 0 };
let onPick: (choice: 'new' | 'continue') => void = () => {};
export function setTitlePick(f: typeof onPick): void { onPick = f; }

export function enterTitle(): void {
  game.mode = 'title';
  T.cursor = hasSave() ? 0 : 1;
  T.ready = 20;
  playMusic('title');
}

// A rotating icosahedron: the Void-Realm is a polyhedron of consciousness.
const PHI = (1 + Math.sqrt(5)) / 2;
const VERTS: [number, number, number][] = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
];
const EDGES: [number, number][] = [];
for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) {
  const a = VERTS[i], b = VERTS[j];
  if (Math.abs((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2 - 4) < 0.01) EDGES.push([i, j]);
}

function line(x0: number, y0: number, x1: number, y1: number, c: string): void {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 400; n++) {
    pxl(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export function drawPoly(cx: number, cy: number, r: number, t: number, near: string, far: string): void {
  const a = t / 140, b2 = t / 220;
  const pts = VERTS.map(([x, y, z]) => {
    const x1 = x * Math.cos(a) - z * Math.sin(a), z1 = x * Math.sin(a) + z * Math.cos(a);
    const y1 = y * Math.cos(b2) - z1 * Math.sin(b2), z2 = y * Math.sin(b2) + z1 * Math.cos(b2);
    return { x: cx + x1 * r, y: cy + y1 * r, z: z2 };
  });
  for (const [i, j] of EDGES) line(pts[i].x, pts[i].y, pts[j].x, pts[j].y, pts[i].z + pts[j].z > 0 ? near : far);
}

export function titleUpdate(): void {
  if (T.ready > 0) { T.ready--; return; }
  const n = 2;
  if (input.hit('up') || input.hit('down')) { T.cursor = (T.cursor + 1) % n; sfx('move'); }
  if (input.hit('ok')) {
    if (T.cursor === 0 && !hasSave()) { sfx('buzz'); return; }
    sfx('confirm');
    onPick(T.cursor === 0 ? 'continue' : 'new');
  }
}

export function titleDraw(): void {
  const t = game.tick;
  rect(0, 0, W, H, UI.ink);
  for (let k = 0; k < 50; k++) {
    const x = (k * 97 + (t >> 3)) % W, y = (k * 61) % H;
    if ((k + (t >> 5)) % 4) pxl(x, y, k % 3 ? STONE.deep : '#2a2440');
  }
  drawPoly(112, 90, 22, t, BRASS.shine, '#4e4466');
  dither(0, 0, W, 30, UI.ink, 0.5);
  const t1 = 'THE VOID-PILGRIM';
  bigText(t1, Math.round((W - bigWidth(t1, 2)) / 2), 12, 2, BRASS.shine);
  const t2 = 'CHRONICLES';
  text(t2, Math.round((W - textWidth(t2)) / 2), 36, UI.paper);
  for (const [i, q] of ['There is a sort of: Hinge.', 'There is a sort of: Gap.'].entries()) text(q, Math.round((W - textWidth(q)) / 2), 140 + i * 10, UI.dim);
  list([{ label: 'Continue', ok: hasSave() }, { label: 'Begin' }], T.cursor, 88, 166, 60);
  const c = 'M mutes. Z confirms.';
  text(c, Math.round((W - textWidth(c)) / 2), 206, UI.faint);
}
