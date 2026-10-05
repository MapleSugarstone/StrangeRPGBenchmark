import { Rng, hashStr } from './rng';
import { INK, col } from './palette';

// Pixel values: 0 transparent, 1 ink, 2 color A, 3 color B.
export type Px = Uint8Array;

export interface SpriteSpec {
  t: string;
  seed: number | string;
  a: string;
  b: string;
}

// Template codes: '.' empty, '?' maybe A, '*' maybe B, 'a' A, 'b' B, '%' A or B, 'k' ink, '!' ink or A.
// Four-character rows mirror to eight. Eight-character rows are used as written.
interface Template { rows: string[]; outline: boolean; }

const T: Record<string, Template> = {
  person: { outline: true, rows: ['..??', '..aa', '..ka', '..aa', '.%bb', '.?bb', '..b?', '..a.'] },
  child: { outline: true, rows: ['....', '..?a', '..ka', '..aa', '..bb', '.?bb', '..b.', '..a.'] },
  robed: { outline: true, rows: ['...b', '..bb', '..ka', '.?bb', '.%bb', '.bbb', '.bbb', '.bb.'] },
  knight: { outline: true, rows: ['..b?', '..bb', '..kb', '.bbb', '?%aa', '.?aa', '..a?', '..b.'] },
  hero: { outline: true, rows: ['..%?', '..aa', '..ka', '..aa', '.?bb', '.%bb', '..bb', '..k.'] },
  gate: { outline: false, rows: ['kkkkkkkk', 'kbkbbkbk', 'kbkbbkbk', 'kakaakak', 'kbkbbkbk', 'kbkbbkbk', 'kbkbbkbk', 'kkkkkkkk'] },
  twin: { outline: true, rows: ['.aa.', '.ka.', '.aab', '.bbb', '%bbb', '.bbb', '.b.b', '.k.k'] },
  robot: { outline: true, rows: ['...k', '.bbb', '.bkb', '.bbb', '..a.', '.?aa', '.?aa', '.k.k'] },
  blob: { outline: true, rows: ['....', '....', '..?a', '.?aa', '.ka%', '?aaa', '?aa%', '.aaa'] },
  ghost: { outline: true, rows: ['....', '..aa', '.?aa', '.kaa', '.aa%', '.aa%', '.aaa', '.?.a'] },
  flyer: { outline: true, rows: ['....', '?...', '%?.a', '%%ak', '?%aa', '.?aa', '...?', '....'] },
  bug: { outline: true, rows: ['....', '.?.?', '..ab', '.?kb', '?abb', '.?bb', '..ab', '.?..'] },
  mouth: { outline: true, rows: ['....', '.?aa', '?aaa', 'kkkk', 'b*b*', 'kkkk', '?aaa', '.?aa'] },
  head: { outline: true, rows: ['.??a', '.aaa', '?k%a', '.aaa', '.a%%', '.aak', '..aa', '...?'] },
  worm: { outline: true, rows: ['........', '..aa....', '.akaa...', '.aaaa...', '...aa.?.', '...aa%a.', '....aaa.', '........'] },
  beast: { outline: true, rows: ['........', '......a?', '.....aak', '%aaaaaa.', 'aaaabaa.', '.aaaaa..', '.a.?.a..', '.k...k..'] },
  dog: { outline: true, rows: ['........', '......aa', '?....akb', '.aaaaaa.', '.abbbaa.', '.aaaaa..', '.a.a.a..', '.k.k.k..'] },
  object: { outline: true, rows: ['....', '.bbb', '.bkb', '.bbb', '..a.', '..a.', '..a.', '.??a'] },
  sign: { outline: true, rows: ['....', 'bbbb', 'bkbb', 'bbbb', '...a', '...a', '...a', '..?a'] },
  machine: { outline: true, rows: ['.?..', '.bbb', '.bkk', '.b%%', '.bbb', '.bk%', '.bbb', '.k.k'] },
  plant: { outline: true, rows: ['..?.', '.?%?', '?%a%', '.%a?', '..a.', '..a.', '.?a.', '.bbb'] },
  serpent: { outline: true, rows: ['....', '..aa', '..ka', '...a', '..a.', '.a..', '.a%.', '..aa'] },
  shell: { outline: true, rows: ['....', '....', '..bb', '.b%b', '?bbb', 'akab', '.a.a', '....'] },
  slip: { outline: true, rows: ['....', '.aaa', '.a%a', '.aaa', '.a%a', '.aaa', '.aab', '....'] },
};

export const TEMPLATES = Object.keys(T);

function expand(row: string): string {
  if (row.length >= 8) return row.slice(0, 8);
  return row + row.split('').reverse().join('');
}

export function genSprite(spec: { t: string; seed: number | string }): Px {
  const tpl = T[spec.t] ?? T.blob;
  const rng = new Rng(typeof spec.seed === 'string' ? hashStr(spec.t + ':' + spec.seed) : spec.seed);
  const px = new Uint8Array(64);
  // Random choices are made on the left half and mirrored, so sprites stay symmetric.
  for (let y = 0; y < 8; y++) {
    const raw = tpl.rows[y];
    const sym = raw.length < 8;
    const row = expand(raw);
    const picks: number[] = [];
    for (let x = 0; x < 8; x++) {
      const mx = sym && x >= 4 ? 7 - x : x;
      if (sym && x >= 4) { px[y * 8 + x] = picks[mx]; continue; }
      const c = row[x];
      let v = 0;
      switch (c) {
        case '?': v = rng.chance(0.5) ? 2 : 0; break;
        case '*': v = rng.chance(0.5) ? 3 : 0; break;
        case 'a': v = 2; break;
        case 'b': v = 3; break;
        case '%': v = rng.chance(0.5) ? 2 : 3; break;
        case 'k': v = 1; break;
        case '!': v = rng.chance(0.5) ? 1 : 2; break;
        default: v = 0;
      }
      picks[x] = v;
      px[y * 8 + x] = v;
    }
  }
  if (tpl.outline) {
    const out = new Uint8Array(px);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      if (px[y * 8 + x] !== 0) continue;
      const n = (dx: number, dy: number) => {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx > 7 || yy > 7) return false;
        const v = px[yy * 8 + xx];
        return v === 2 || v === 3;
      };
      if (n(1, 0) || n(-1, 0) || n(0, 1) || n(0, -1)) out[y * 8 + x] = 1;
    }
    return out;
  }
  return px;
}

// Second animation frame: everything above the bottom row drops one pixel.
export function bobFrame(px: Px): Px {
  const out = new Uint8Array(64);
  for (let x = 0; x < 8; x++) out[7 * 8 + x] = px[7 * 8 + x];
  for (let y = 6; y >= 0; y--) for (let x = 0; x < 8; x++) {
    const v = px[y * 8 + x];
    if (v) out[(y + 1) * 8 + x] = v;
  }
  return out;
}

// ---- Metasprites ----
// Large figures are the 8x8 sprite smoothed up with Scale2x or Scale3x, then re-outlined at one pixel,
// so a 32x32 boss is sixteen 8x8 tiles drawn on the same pixel grid as everything else.

function scale2x(src: Px, n: number): Px {
  const out = new Uint8Array(n * n * 4);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= n || y >= n ? 0 : src[y * n + x]);
  const N = n * 2;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
    out[(y * 2) * N + x * 2] = C === A && C !== D && A !== B ? A : P;
    out[(y * 2) * N + x * 2 + 1] = A === B && A !== C && B !== D ? B : P;
    out[(y * 2 + 1) * N + x * 2] = D === C && D !== B && C !== A ? C : P;
    out[(y * 2 + 1) * N + x * 2 + 1] = B === D && B !== A && D !== C ? D : P;
  }
  return out;
}

function scale3x(src: Px, n: number): Px {
  const N = n * 3;
  const out = new Uint8Array(N * N);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= n || y >= n ? 0 : src[y * n + x]);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const A = at(x - 1, y - 1), B = at(x, y - 1), Cc = at(x + 1, y - 1), D = at(x - 1, y), E = at(x, y), F = at(x + 1, y);
    const G = at(x - 1, y + 1), Hh = at(x, y + 1), I = at(x + 1, y + 1);
    const e = [
      D === B && D !== Hh && B !== F ? D : E,
      (D === B && D !== Hh && B !== F && E !== Cc) || (B === F && B !== D && F !== Hh && E !== A) ? B : E,
      B === F && B !== D && F !== Hh ? F : E,
      (D === B && D !== Hh && B !== F && E !== G) || (D === Hh && D !== B && Hh !== F && E !== A) ? D : E,
      E,
      (B === F && B !== D && F !== Hh && E !== I) || (Hh === F && Hh !== D && F !== B && E !== Cc) ? F : E,
      D === Hh && D !== B && Hh !== F ? D : E,
      (D === Hh && D !== B && Hh !== F && E !== I) || (Hh === F && Hh !== D && F !== B && E !== G) ? Hh : E,
      Hh === F && Hh !== D && F !== B ? F : E,
    ];
    for (let k = 0; k < 9; k++) out[(y * 3 + Math.floor(k / 3)) * N + x * 3 + (k % 3)] = e[k];
  }
  return out;
}

// Thins a scaled-up outline back to one pixel and closes any gaps.
function reoutline(px: Px, n: number): Px {
  const out = new Uint8Array(px);
  const body = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n && (px[y * n + x] === 2 || px[y * n + x] === 3);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = px[y * n + x];
    const touch = body(x + 1, y) || body(x - 1, y) || body(x, y + 1) || body(x, y - 1);
    if (v === 1 && !touch) out[y * n + x] = 0;
    if (v === 0 && touch) out[y * n + x] = 1;
  }
  return out;
}

// Adds a little shading inside large figures: color A pixels along the lower right edge become a dither of B.
function shade(px: Px, n: number): Px {
  const out = new Uint8Array(px);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (px[y * n + x] !== 2) continue;
    const r = x + 1 < n ? px[y * n + x + 1] : 0, d = y + 1 < n ? px[(y + 1) * n + x] : 0;
    if ((r === 1 || d === 1) && (x + y) % 2 === 0) out[y * n + x] = 3;
  }
  return out;
}

function bobN(px: Px, n: number): Px {
  const out = new Uint8Array(n * n);
  for (let x = 0; x < n; x++) out[(n - 1) * n + x] = px[(n - 1) * n + x];
  for (let y = n - 2; y >= 0; y--) for (let x = 0; x < n; x++) {
    const v = px[y * n + x];
    if (v) out[(y + 1) * n + x] = v;
  }
  return out;
}

export function metaPx(spec: { t: string; seed: number | string }, size: number): Px {
  const base = genSprite(spec);
  if (size === 16) return shade(reoutline(scale2x(base, 8), 16), 16);
  if (size === 24) return shade(reoutline(scale3x(base, 8), 24), 24);
  if (size === 32) return shade(reoutline(scale2x(reoutline(scale2x(base, 8), 16), 16), 32), 32);
  if (size === 48) return shade(reoutline(scale3x(reoutline(scale2x(base, 8), 16), 16), 48), 48);
  return base;
}

const cache = new Map<string, HTMLCanvasElement>();

export function pxCanvas(px: Px, a: string, b: string, flip = false, n = 8): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = n; cv.height = n;
  const g = cv.getContext('2d')!;
  const cols = ['', INK, col(a), col(b)];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = px[y * n + x];
    if (!v) continue;
    g.fillStyle = cols[v];
    g.fillRect(flip ? n - 1 - x : x, y, 1, 1);
  }
  return cv;
}

// A solid silhouette in one color, for flashes, shadows, and ghost effects.
export function silhouette(spec: SpriteSpec, size: number, color: string, flip = false): HTMLCanvasElement {
  const key = `sil|${spec.t}|${spec.seed}|${size}|${col(color)}|${flip ? 1 : 0}`;
  let cv = cache.get(key);
  if (!cv) {
    const px = metaPx(spec, size).map((v) => (v ? 1 : 0)) as Px;
    cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const g = cv.getContext('2d')!;
    g.fillStyle = col(color);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (px[y * size + x]) g.fillRect(flip ? size - 1 - x : x, y, 1, 1);
    cache.set(key, cv);
  }
  return cv;
}

export function spriteCanvas(spec: SpriteSpec, frame = 0, flip = false, size = 8): HTMLCanvasElement {
  const key = `${spec.t}|${spec.seed}|${col(spec.a)}|${col(spec.b)}|${frame}|${flip ? 1 : 0}|${size}`;
  let cv = cache.get(key);
  if (!cv) {
    let px = size === 8 ? genSprite(spec) : metaPx(spec, size);
    if (frame === 1) px = size === 8 ? bobFrame(px) : bobN(px, size);
    cv = pxCanvas(px, spec.a, spec.b, flip, size);
    cache.set(key, cv);
  }
  return cv;
}

// ---- Tiles ----

export interface TileStyle { k: string; a: string; b: string; }

type TileGen = (rng: Rng, frame: number) => Px;

function fill(v: number): Px { return new Uint8Array(64).fill(v); }
function set(px: Px, x: number, y: number, v: number) { if (x >= 0 && y >= 0 && x < 8 && y < 8) px[y * 8 + x] = v; }
function rows(def: string[]): Px {
  const px = new Uint8Array(64);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const c = def[y]?.[x] ?? '.';
    px[y * 8 + x] = c === 'k' ? 1 : c === 'b' ? 3 : 2;
  }
  return px;
}

const TILE: Record<string, TileGen> = {
  floor(r) { const p = fill(2); for (let i = 0; i < 3; i++) set(p, r.int(8), r.int(8), 3); return p; },
  speck(r) { const p = fill(2); for (let i = 0; i < 4; i++) set(p, r.int(8), r.int(8), 3); if (r.chance(0.3)) set(p, r.int(8), r.int(8), 1); return p; },
  plain() { return fill(2); },
  dark() { return fill(1); },
  void(r) { const p = fill(1); if (r.chance(0.25)) set(p, r.int(8), r.int(8), 3); return p; },
  brick() { return rows(['bbbkbbbb', 'bbbkbbbb', 'bbbkbbbb', 'kkkkkkkk', 'bbbbbbbk', 'bbbbbbbk', 'bbbbbbbk', 'kkkkkkkk']); },
  stone(r) { const p = rows(['bbbbkbbb', 'bbbbkbbb', 'bbbbkbbb', 'kkkkkkkk', 'bbkbbbbb', 'bbkbbbbb', 'bbkbbbbb', 'kkkkkkkk']); if (r.chance(0.5)) set(p, 1 + r.int(6), r.int(3), 2); return p; },
  wall(r) { const p = rows(['bbbbbbbb', 'baaaaaab', 'baaaaaab', 'bbbbbbbb', 'kkkkkkkk', 'bbbbbbbb', 'bbbbbbbb', 'kkkkkkkk']); if (r.chance(0.3)) set(p, r.int(8), 5 + r.int(2), 2); return p; },
  rock(r) { const p = fill(3); for (let i = 0; i < 4; i++) set(p, r.int(8), r.int(8), 2); for (let i = 0; i < 2; i++) set(p, r.int(8), r.int(8), 1); return p; },
  strata(r) { const p = fill(3); const y1 = 1 + r.int(2), y2 = 4 + r.int(2); for (let x = 0; x < 8; x++) { set(p, x, y1, 2); set(p, x, y2, 1); if (r.chance(0.3)) set(p, x, y1 + 1, 2); } return p; },
  water(r, f) { const p = fill(2); const o = (f + r.int(2)) % 4; for (let x = 0; x < 8; x++) { if ((x + o) % 4 < 2) set(p, x, 2, 3); if ((x + o + 2) % 4 < 2) set(p, x, 6, 3); } return p; },
  grass(r) { const p = fill(2); for (let i = 0; i < 3; i++) { const x = r.int(7), y = 1 + r.int(6); set(p, x, y, 3); set(p, x + 1, y - 1, 3); } return p; },
  tree() { return rows(['..bbbb..', '.bbabbb.', 'bbabbbab', 'bbbbbabb', '.bbbbbb.', '..kaak..', '...aa...', '..kaak..'].map((s) => s)); },
  bush() { return rows(['........', '..bbbb..', '.bbabbb.', 'bbbbbabb', 'bbabbbbb', '.bbbbbb.', '..kkkk..', '........']); },
  mesh(r) { const p = fill(2); const o = r.int(2); for (let i = 0; i < 8; i++) { set(p, i, (i + o * 4) % 8, 3); set(p, 7 - i, (i + o * 4) % 8, 3); } return p; },
  gear(r, f) { const p = rows(['..bbbb..', '.bkbbkb.', 'bbbkkbbb', 'bkkaakkb', 'bkkaakkb', 'bbbkkbbb', '.bkbbkb.', '..bbbb..']); if ((f + r.int(2)) % 2) { set(p, 0, 3, 3); set(p, 7, 4, 3); } return p; },
  bunting(r) { const p = fill(2); const o = r.int(3); for (let x = 0; x < 8; x++) set(p, x, 1 + ((x + o) % 3 === 0 ? 1 : 0), 1); set(p, 1 + o, 3, 3); set(p, 5 - o, 3, 3); return p; },
  plant() { return rows(['...bb...', '..bbab..', '.babbbb.', '..bbbb..', '...bk...', '..kkkk..', '..kbbk..', '...kk...']); },
  chair() { return rows(['aaaaaaaa', 'abbbbbba', 'abkkkkba', 'abbbbbba', 'abbbbbba', 'akkkkkka', 'akaaaaka', 'akaaaaka']); },
  switch(r) { const p = fill(3); for (let y = 1; y < 8; y += 3) for (let x = 1; x < 8; x += 3) set(p, x, y, r.chance(0.2) ? 2 : 1); return p; },
  cable(r) { const p = fill(2); const x = 2 + r.int(4); for (let y = 0; y < 8; y++) { set(p, x, y, 1); set(p, x + 1, y, 3); } return p; },
  cableh() { const p = fill(2); for (let x = 0; x < 8; x++) { set(p, x, 3, 1); set(p, x, 4, 3); } return p; },
  door() { return rows(['kkkkkkkk', 'kbbbbbbk', 'kbaaaabk', 'kbaaaabk', 'kbaaakbk', 'kbaaaabk', 'kbaaaabk', 'kbaaaabk']); },
  stairs() { return rows(['kkkkkkkk', 'bbbbbbbb', 'kkkkkkkk', 'aaaaaaaa', 'kkkkkkkk', 'bbbbbbbb', 'kkkkkkkk', 'aaaaaaaa']); },
  roof() { return rows(['bbbbbbbb', 'kbbbkbbb', 'bbbbbbbb', 'bbkbbbkb', 'bbbbbbbb', 'kbbbkbbb', 'bbbbbbbb', 'kkkkkkkk']); },
  window() { return rows(['bbbbbbbb', 'bkkkkkkb', 'bkaakaab', 'bkaakaab', 'bkkkkkkb', 'bkaakaab', 'bkkkkkkb', 'bbbbbbbb']); },
  counter() { return rows(['kkkkkkkk', 'aaaaaaaa', 'bbbbbbbb', 'bbbbbbbb', 'bkbbbbkb', 'bbbbbbbb', 'bbbbbbbb', 'kkkkkkkk']); },
  carpet(r) { const p = fill(3); for (let x = 0; x < 8; x++) { set(p, x, 0, 2); set(p, x, 7, 2); } if (r.chance(0.5)) set(p, 3, 3, 2), set(p, 4, 4, 2); return p; },
  check(r) { const p = fill(2); const o = r.int(2); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (((x >> 2) + (y >> 2) + o) % 2) set(p, x, y, 3); return p; },
  drift(r) { const p = fill(2); for (let i = 0; i < 5; i++) { const x = r.int(7), y = r.int(7); set(p, x, y, 3); set(p, x + 1, y, 3); set(p, x, y + 1, 1); } return p; },
  net() { return rows(['bkbbbkbb', 'kbkbkbkb', 'bbbkbbbk', 'kbkbkbkb', 'bkbbbkbb', 'kbkbkbkb', 'bbbkbbbk', 'kbkbkbkb']).map((v) => (v === 3 ? 2 : v === 2 ? 3 : v)) as Px; },
  rail() { return rows(['aaaaaaaa', 'kkkkkkkk', 'b..b..b.', 'b..b..b.', 'b..b..b.', 'kkkkkkkk', 'aaaaaaaa', 'aaaaaaaa'].map((s) => s.replace(/\./g, 'a'))); },
  pipe() { return rows(['aakbbkaa', 'aakbbkaa', 'aakbbkaa', 'aakbbkaa', 'aakbbkaa', 'aakbbkaa', 'aakbbkaa', 'aakbbkaa']); },
  bridge() { return rows(['kkkkkkkk', 'bbbbbbbb', 'bkbbbbkb', 'bbbbbbbb', 'kkkkkkkk', 'bbbbbbbb', 'bbbkbbbb', 'kkkkkkkk']); },
  pillar() { return rows(['kbbbbbbk', 'kbabbbbk', 'kbabbbbk', 'kbabbbbk', 'kbabbbbk', 'kbabbbbk', 'kbabbbbk', 'kkkkkkkk']); },
  shelf() { return rows(['kkkkkkkk', 'kbabkaak', 'kbabkaak', 'kkkkkkkk', 'kaabkbak', 'kaabkbak', 'kkkkkkkk', 'aaaaaaaa']); },
  crate() { return rows(['kkkkkkkk', 'kbbbbbbk', 'kbkbbkbk', 'kbbkkbbk', 'kbbkkbbk', 'kbkbbkbk', 'kbbbbbbk', 'kkkkkkkk']); },
  fence() { return rows(['aaaaaaaa', 'abaaaaba', 'kbkkkkbk', 'abaaaaba', 'abaaaaba', 'kbkkkkbk', 'abaaaaba', 'aaaaaaaa']); },
  sand(r) { const p = fill(2); for (let i = 0; i < 2; i++) set(p, r.int(8), r.int(8), 3); return p; },
  ledge() { return rows(['aaaaaaaa', 'aaaaaaaa', 'aaaaaaaa', 'aaaaaaaa', 'bbbbbbbb', 'kkkkkkkk', 'bkbbbkbb', 'kkkkkkkk']); },
  cloud(r) { const p = fill(2); for (let i = 0; i < 2; i++) { const x = r.int(6), y = r.int(7); set(p, x, y, 3); set(p, x + 1, y, 3); set(p, x + 2, y, 3); } return p; },
  slips(r, f) { const p = fill(2); for (let i = 0; i < 3; i++) { const x = r.int(7), y = (r.int(8) + f) % 8; set(p, x, y, 3); set(p, x + 1, y, 3); } return p; },
  glyph(r) { const p = fill(2); const g = r.int(4); const pats = [[1, 1, 1, 6, 6, 6], [1, 6, 3, 3, 6, 1], [2, 5, 2, 5, 2, 5], [1, 2, 4, 5, 6, 3]]; for (let i = 0; i < 6; i++) set(p, 1 + i, pats[g][i], 3); return p; },
  vent(r, f) { const p = fill(2); for (let y = 1; y < 8; y += 2) for (let x = 1; x < 7; x++) set(p, x, y, (x + y + f) % 3 ? 1 : 3); return p; },
};

export const TILE_KINDS = Object.keys(TILE);

const tileCache = new Map<string, HTMLCanvasElement>();

export function tileCanvas(style: TileStyle, variant: number, frame = 0): HTMLCanvasElement {
  const key = `${style.k}|${col(style.a)}|${col(style.b)}|${variant}|${frame}`;
  let cv = tileCache.get(key);
  if (!cv) {
    const gen = TILE[style.k] ?? TILE.plain;
    const px = gen(new Rng(hashStr(style.k) + variant * 7919), frame);
    cv = pxCanvas(px, style.a, style.b);
    tileCache.set(key, cv);
  }
  return cv;
}

export const ANIMATED_TILES = new Set(['water', 'slips', 'vent', 'gear']);

// Old data uses a scale factor. It maps to the metasprite size in pixels.
export function sizeOf(scale = 1): number { return [8, 8, 16, 24, 32, 48][Math.max(0, Math.min(5, scale))]; }
