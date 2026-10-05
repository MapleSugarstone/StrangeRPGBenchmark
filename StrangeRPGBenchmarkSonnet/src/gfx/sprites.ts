import { Rng, hashStr } from '../core/rng';
import { CHAR } from '../data/characters';
import { rgb, type Sprite } from './screen';

const BLACK = rgb('#000000');

export function spr(rows: string[], colors: [string, string], opaque = false): Sprite {
  const d = new Uint8Array(64);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const ch = rows[y]?.[x] ?? '.';
      d[y * 8 + x] = ch === 'k' ? 1 : ch === 'a' ? 2 : ch === 'b' ? 3 : opaque ? 1 : 0;
    }
  }
  return { d, pal: [BLACK, rgb(colors[0]), rgb(colors[1])] };
}

// ---------------------------------------------------------------- party members
const PARTY_ART: Record<string, string[]> = {
  wick: ['...kk.b.', '..kaak..', '.kkkkkk.', '..kbbk.k', '..kaak.k', '.kaaaakk', '..k..k.k', '..kk.kkk'],
  pocket: ['.kkkkkk.', '.kaaaak.', '.kbabak.', '.kbabak.', '.kaaaak.', '.kakkak.', '.kkkkkk.', '..k..k..'],
  thistle: ['k..kk..k', '.k.kk.k.', 'kaakkaak', 'kaabbaak', '.kabbak.', '..kbbk..', '..kbbk..', '...kk...'],
  ajar: ['..kkkk..', '.kaaaak.', '.kabbak.', '.kaaaak.', 'kkaaaakk', 'kabkkbak', '.kaabak.', '.kk..kk.'],
  ledger: ['.k....k.', '.kk..kk.', '..kaak..', '.kabbak.', '.kaaaak.', '..kbbk..', '.kaaaak.', '.kk..kk.'],
  route9: ['........', '.kkkkkk.', 'kabababk', 'kaaaaaak', 'kaaaaaak', 'kkkkkkkk', '.kb..bk.', '..k..k..'],
  zug: ['...kk...', '..kaak..', '.kkkkkk.', '..kbbk..', '..kaak..', '.kaaaak.', '.kaaaak.', 'kkkkkkkk'],
  kiln: ['..kkkk..', '.kbbbbk.', '.kbkkbk.', 'kkaaaakk', 'kaaaaaak', 'kakaakak', '.kaaaak.', '.kk..kk.'],
  ampere: ['k.k..k.k', '.kakkak.', '.kbbbbk.', '.kbkkbk.', '..kaak..', '.kakkak.', '..kaak..', '.kk..kk.'],
  fennel: ['..kkkk..', '.kaaaak.', 'kkkkkkkk', '..kbbk..', '..kbbk.k', '.kaaakbk', '..kaak.k', '..k..k..'],
  tick: ['.k....k.', '.kk..kk.', '.kaaaak.', '.kabbak.', '.kaaaak.', '..kbbk..', '.kaaaak.', '.kk..kk.'],
  ash: ['...k.k..', '..kakak.', '.kaaaak.', 'kabaabak', 'kaaaaaak', '.kaaaak.', '..kbbk..', '..k..k..'],
  dusk: ['..kkkk..', '.kaaaak.', '.kabbak.', '.kaaaak.', '.kaaaak.', 'kabaabak', '.kaaaak.', '.kk..kk.'],
};

// ---------------------------------------------------------------- humanoid NPCs
const HEADS: string[][] = [
  ['..kkkk..', '.kaaaak.', '.kabbak.'],
  ['.kkkkkk.', 'kaaaaaak', 'kabbbbak'],
  ['k.k..k.k', '.kaaaak.', '.kbbbbk.'],
  ['..kkkk..', '.kbbbbk.', '.kbbbbk.'],
];
const EYES = '.kbkkbk.';
const BODIES: string[][] = [
  ['..kaak..', '.kaaaak.', 'kabaabak', 'kaaaaaak', 'kkkkkkkk'],
  ['..kaak..', '.kaaaak.', '.kbaabk.', '..kaak..', '.kk..kk.'],
  ['.kaaaak.', 'kabaabak', 'kaaaaaak', '.kaaaak.', '.kk..kk.'],
];
const NPC_COLORS: [string, string][] = [
  ['#e8804a', '#ffe0b0'], ['#4a9ae8', '#ffe0b0'], ['#7acd5a', '#f0d8a0'], ['#c05ad8', '#f8e0c8'], ['#e8c84a', '#d8a878'],
  ['#e85a7a', '#ffd8c0'], ['#5ad8c8', '#e8d0b0'], ['#b0b0c8', '#f0e0d0'],
];

export function npcSprite(name: string): Sprite {
  const r = new Rng(hashStr(name));
  const head = HEADS[r.int(HEADS.length)].slice();
  head[2] = head[2].split('').map((c, i) => (EYES[i] === 'k' && c === 'b' ? 'k' : c)).join('');
  const body = BODIES[r.int(BODIES.length)];
  return spr([...head, ...body], r.pick(NPC_COLORS));
}

// ---------------------------------------------------------------- monsters
const ARCH: Record<string, string[]> = {
  blob: ['....', '..##', '.###', '####', '#e##', '####', '.###', '....'],
  bug: ['#...', '.#..', '..##', '.###', '#e##', '.###', '#.#.', '#...'],
  ghost: ['..##', '.###', '#e##', '####', '####', '####', '#.##', '#..#'],
  bat: ['#...', '##..', '###.', '#e##', '.###', '..##', '...#', '....'],
  tall: ['..##', '.###', '.#e#', '..##', '.###', '####', '.###', '.#.#'],
  eye: ['....', '..##', '.###', '##e#', '#eee', '##e#', '.###', '..##'],
  crab: ['#...', '##..', '....', '.###', '#e##', '####', '.###', '#.#.'],
  hound: ['#.#.', '###.', '.###', '.#e#', '.###', '####', '#.##', '#..#'],
  plant: ['#.#.', '.##.', '..##', '..#.', '.###', '####', '.###', '..##'],
  gear: ['..#.', '.###', '####', '##e#', '####', '.###', '..#.', '....'],
  skull: ['..##', '.###', '##e#', '##e#', '.###', '..#.', '..##', '....'],
  worm: ['....', '..##', '.#e#', '.###', '..##', '.##.', '##..', '.##.'],
};

function mirror(rows: string[]): string[][] {
  return rows.map((r) => (r + r.split('').reverse().join('')).split(''));
}

function mutate(g: string[][], r: Rng, n: number) {
  const h = g.length, w = g[0].length;
  for (let k = 0; k < n; k++) {
    const x = r.int(w / 2), y = 1 + r.int(h - 2);
    const inside = g[y][x] === '#';
    const nb = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < w && b < h);
    const hasEmpty = nb.some(([a, b]) => g[b][a] === '.');
    const hasBody = nb.some(([a, b]) => g[b][a] === '#');
    const mx = w - 1 - x;
    if (inside && hasEmpty) { g[y][x] = '.'; g[y][mx] = '.'; }
    else if (!inside && g[y][x] === '.' && hasBody) { g[y][x] = '#'; g[y][mx] = '#'; }
  }
}

function colorize(g: string[][], colors: [string, string], seed: number): Sprite[] {
  const h = g.length, w = g[0].length;
  const out: number[][] = Array.from({ length: h }, () => new Array(w).fill(0));
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && g[y][x] !== '.';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = g[y][x];
      if (c === '.') continue;
      if (c === 'e') { out[y][x] = 3; continue; }
      const edge = !solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1);
      const speck = (hashStr(`${seed}:${Math.min(x, w - 1 - x)}:${y}`) % 6) === 0;
      out[y][x] = edge && w <= 8 ? (speck ? 3 : 2) : edge ? 1 : speck ? 3 : 2;
    }
  }
  // Outline: for small sprites, add a dark outline on the bottom edge and keep fill readable.
  if (w <= 8) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (out[y][x] && !solid(x, y + 1) && out[y][x] !== 3) out[y][x] = 1;
  }
  const sprites: Sprite[] = [];
  for (let ty = 0; ty < h / 8; ty++) {
    for (let tx = 0; tx < w / 8; tx++) {
      const d = new Uint8Array(64);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) d[y * 8 + x] = out[ty * 8 + y][tx * 8 + x];
      sprites.push({ d, pal: [BLACK, rgb(colors[0]), rgb(colors[1])] });
    }
  }
  return sprites;
}

const monsterCache = new Map<string, Sprite>();
export function monsterSprite(arch: string, seed: number, colors: [string, string]): Sprite {
  const key = `${arch}:${seed}:${colors.join('')}`;
  let s = monsterCache.get(key);
  if (!s) {
    const g = mirror(ARCH[arch] ?? ARCH.blob);
    mutate(g, new Rng(seed), 3);
    s = colorize(g, colors, seed)[0];
    monsterCache.set(key, s);
  }
  return s;
}

const bossCache = new Map<string, Sprite[]>();
/** A 16x16 boss built from four 8x8 sprites, in reading order. */
export function bossSprites(arch: string, seed: number, colors: [string, string]): Sprite[] {
  const key = `${arch}:${seed}:${colors.join('')}`;
  let s = bossCache.get(key);
  if (!s) {
    const base = ARCH[arch] ?? ARCH.blob;
    const big: string[] = [];
    for (const row of base) {
      const wide = row.split('').map((c) => c + c).join('');
      big.push(wide, wide);
    }
    const g = mirror(big);
    const r = new Rng(seed);
    mutate(g, r, 10);
    // Crown of horns on the top edge.
    for (const x of [3, 12]) { g[0][x] = '#'; g[1][x] = '#'; }
    s = colorize(g, colors, seed);
    bossCache.set(key, s);
  }
  return s;
}

// ---------------------------------------------------------------- map tiles
export interface Theme {
  name: string;
  a: string;
  b: string;
  floor: number;
  wall: number;
  deco: string[];
}

const FLOORS: string[][] = [
  ['kkkkkkkk', 'kkkkakkk', 'kkkkkkkk', 'kakkkkkk', 'kkkkkkak', 'kkkkkkkk', 'kkakkkkk', 'kkkkkkkk'],
  ['kkkkkkkk', 'kakakaka'.replace(/a/g, 'k'), 'kkkkkkkk', 'kkakkkak', 'kkkkkkkk', 'kkkkkkkk', 'kakkkakk', 'kkkkkkkk'],
  ['akkkkkkk', 'kkkkkkkk', 'kkkkkakk', 'kkkkkkkk', 'kkkkkkkk', 'kakkkkkk', 'kkkkkkkk', 'kkkakkkk'],
  ['kkkkkkka', 'kkkkkkkk', 'kkkkkkkk', 'kkkkkkkk', 'kkkkkkkk', 'kkkkkkkk', 'kkkkkkkk', 'akkkkkkk'],
];
const WALLS: string[][] = [
  ['bbbbbbbb', 'akkkakkk', 'akkkakkk', 'aaaaaaaa', 'kkakkkak', 'kkakkkak', 'aaaaaaaa', 'akkkakkk'],
  ['bbbbbbbb', 'abababab', 'kkkkkkkk', 'bababa ba'.replace(/ /g, '').slice(0, 8), 'kkkkkkkk', 'abababab', 'kkkkkkkk', 'aaaaaaaa'],
  ['abkkkbak', 'abkkkbak', 'aakkkaak', 'aaaaaaaa', 'kbakkabk', 'kbakkabk', 'kaakkaak', 'aaaaaaaa'],
  ['bbbbbbbb', 'aaaaaaab', 'akkkkkab', 'akkkkkab', 'akkkkkab', 'akkkkkab', 'aaaaaaab', 'bbbbbbbb'],
];

export const DECOR: Record<string, string[]> = {
  tree: ['..bbbb..', '.bbabbb.', 'bbbbbabb', '.bbbbbb.', '...aa...', '...aa...', '...aa...', '..aaaa..'],
  crystal: ['...b....', '..bab...', '..bab.b.', '.babab..'.replace(/\./g, 'k').slice(0, 0) + '.bbabb..', '.bbabbb.', '.babbab.', '..bbab..', '...aa...'],
  pillar: ['.aaaaaa.', '..abba..', '..abba..', '..abba..', '..abba..', '..abba..', '..abba..', '.aaaaaa.'],
  machine: ['kaaaaaak', 'kabbbbak', 'kabkkbak', 'kabbbbak', 'kaaaaaak', 'kakabkak', 'kaaaaaak', 'k.k..k.k'],
  books: ['kkkkkkkk', 'kabkabkb', 'kabkabkb', 'kabkabkb', 'kaaaaaab', 'kkkkkkkk', 'kbabbabb', 'kbabbabb'],
  statue: ['...aa...', '..abba..', '..aaaa..', '.aabbaa.', '..abba..', '..abba..', '.aaaaaa.', '.aaaaaa.'],
  flower: ['kkkkkkkk', 'kkbkkkkk', 'kbabkkkb', 'kkbkkkbab', 'kkkkkkkb'.slice(0, 8), 'kkkakkkk', 'kkkakkak', 'kkkakkkk'],
  rock: ['kkkkkkkk', 'kkkaaakk', 'kkaabbak', 'kaabbbak', 'kaabbaak', 'kkaaaakk', 'kkkkkkkk', 'kkkkkkkk'],
  web: ['a.k.k.a.', '.a.k.a..', 'k.aaa.kk', 'kkabakkk', 'k.aaa.kk', '.a.k.a..', 'a.k.k.a.', 'kkkkkkkk'].map((r) => r.replace(/\./g, 'k')),
  pool: ['kkkkkkkk', 'kbbkkbbk', 'kkkbbkkk', 'kkbkkbbk', 'kbbkkkkk', 'kkkbbkbk', 'kbkkkbbk', 'kkkkkkkk'],
  gear: ['..a.a...', '.aaaaaa.', 'aabbbbaa', '.abkkba.', '.abkkba.', 'aabbbbaa', '.aaaaaa.', '..a.a...'],
  candle: ['kkkkkkkk', 'kkkbkkkk', 'kkkbkkkk', 'kkkakkkk', 'kkkakkkk', 'kkkakkkk', 'kkaaakkk', 'kkkkkkkk'],
  moon: ['kkbbbkkk', 'kbbkkkkk', 'bbkkkkkk', 'bbkkkkkk', 'bbkkkkkk', 'kbbkkkkk', 'kkbbbkkk', 'kkkkkkkk'],
  cog: ['kkkakkkk', 'kaaaakkk', 'aabbaakk', 'kabkbakk', 'aabbaakk', 'kaaaakkk', 'kkkakkkk', 'kkkkkkkk'],
};

const SPECIAL: Record<string, string[]> = {
  chest: ['kkkkkkkk', 'kaaaaaak', 'kabbbbak', 'kaaaaaak', 'kabkkbak', 'kabbbbak', 'kaaaaaak', 'kkkkkkkk'],
  chestOpen: ['kkkkkkkk', 'kbbbbbbk', 'kbkkkkbk', 'kaaaaaak', 'kakkkkak', 'kabbbbak', 'kaaaaaak', 'kkkkkkkk'],
  gate: ['abababab', 'akkkkkka', 'abababab', 'akkbbkka', 'akkbbkka', 'abababab', 'akkkkkka', 'abababab'],
  stairs: ['kkkkkkkk', 'kkkkkkaa', 'kkkkaabb', 'kkaabbbb', 'aabbbbbb', 'bbbbbbbb', 'kkkkkkkk', 'kkkkkkkk'],
  save: ['...bb...', '..baab..', '.baaaab.', 'baaaaaab', '.baaaab.', '..baab..', '...bb...', '..kkkk..'].map((r) => r.replace(/\./g, 'k')),
  inn: ['kkkkkkkk', 'kbbbbkkk', 'kbbbbkkk', 'kaaaaaak', 'kaaaaaak', 'kaaaaaak', 'kakkkkak', 'kkkkkkkk'],
  shop: ['aabbaabb', 'aabbaabb', 'kkkkkkkk', 'kabbbbak', 'kabkkbak', 'kabkkbak', 'kabkkbak', 'kkkkkkkk'],
  sign: ['kkkkkkkk', 'kaaaaaak', 'kabbbbak', 'kaaaaaak', 'kkkakkkk', 'kkkakkkk', 'kkkakkkk', 'kkkkkkkk'],
  mark: ['kkkbkkkk', 'kkkkkkbk', 'kbkkkkkk', 'kkkkbkkk', 'kkkkkkkk', 'kbkkkbkk', 'kkkkkkkk', 'kkbkkkkb'],
  exit: ['kkkkkkkk', 'kkbbbbkk', 'kbaaaabk', 'kbaaaabk', 'kbaaaabk', 'kbaaaabk', 'kbaaaabk', 'kkkkkkkk'],
};

const tileCache = new Map<string, Sprite>();
export function tile(theme: Theme, kind: string): Sprite {
  const key = `${theme.name}:${kind}`;
  let s = tileCache.get(key);
  if (!s) {
    let rows: string[];
    if (kind === 'floor') rows = FLOORS[theme.floor % FLOORS.length];
    else if (kind === 'wall') rows = WALLS[theme.wall % WALLS.length];
    else if (DECOR[kind]) rows = DECOR[kind];
    else rows = SPECIAL[kind] ?? FLOORS[0];
    s = spr(rows.map((r) => r.padEnd(8, 'k').slice(0, 8)), [theme.a, theme.b], true);
    tileCache.set(key, s);
  }
  return s;
}

export function partySprite(id: string): Sprite {
  const key = 'party:' + id;
  let s = tileCache.get(key);
  if (!s) { s = spr(PARTY_ART[id] ?? PARTY_ART.wick, CHAR[id]?.colors ?? ['#ffffff', '#888888']); tileCache.set(key, s); }
  return s;
}

// ---------------------------------------------------------------- icons
const ICON_ART: Record<string, string[]> = {
  potion: ['...kk...', '...kk...', '..kbbk..', '.kbaabk.', '.kaaaak.', '.kaaaak.', '..kkkk..', '........'],
  ink: ['...kk...', '..kbbk..', '.kkkkkk.', '.kaaaak.', '.kaaaak.', '.kaaaak.', '..kkkk..', '........'],
  feather: ['.....kbk', '....kbbk', '...kbbk.', '..kbbk..', '.kabk...', 'kaak....', 'kk......', '........'],
  bomb: ['.....b..', '....b...', '..kkkk..', '.kaaaak.', '.kabaak.', '.kaaaak.', '..kkkk..', '........'],
  sword: ['......kb', '.....kbk', '....kbk.', '.k.kbk..', '..kbk...', '..kak...', '.kaak...', 'kk......'],
  armor: ['.kk..kk.', 'kaakkaak', 'kaaaaaak', '.kabbak.', '.kaaaak.', '.kabbak.', '..kaak..', '...kk...'],
  charm: ['...kk...', '..k..k..', '..k..k..', '...kk...', '..kbbk..', '.kbaabk.', '.kbaabk.', '..kkkk..'],
  rune: ['..kkkk..', '.kabbak.', 'kabkkbak', 'kabbkbak', 'kabkbbak', 'kabkkbak', '.kabbak.', '..kkkk..'],
  coin: ['..kkkk..', '.kbbbbk.', 'kbabbabk', 'kbbabbbk', 'kbbabbbk', 'kbabbabk', '.kbbbbk.', '..kkkk..'],
  cursor: ['kk......', 'kbk.....', 'kbbk....', 'kbbbk...', 'kbbk....', 'kbk.....', 'kk......', '........'],
  heart: ['.kk.kk..', 'kbbkbbk.', 'kbbbbbk.', '.kbbbk..', '..kbk...', '...k....', '........', '........'],
  star: ['...kk...', '...kk...', 'kkkbbkkk', '.kbbbbk.', '..kbbk..', '.kbkkbk.', 'kk....kk', '........'],
};
const ICON_COLORS: Record<string, [string, string]> = {
  potion: ['#ff5a7a', '#ffc8d8'], ink: ['#58a8ff', '#c8e4ff'], feather: ['#ff8a3a', '#ffe0a0'], bomb: ['#8a8aa0', '#ffe34a'],
  sword: ['#c8a060', '#e8f0ff'], armor: ['#8a9ab8', '#d8e0f0'], charm: ['#ffc83a', '#ff5a7a'], rune: ['#b070ff', '#ffe34a'],
  coin: ['#ffc83a', '#fff0a0'], cursor: ['#ffffff', '#ffe34a'], heart: ['#ff5a7a', '#ffc8d8'], star: ['#ffe34a', '#ffffff'],
};
export function icon(name: string): Sprite {
  const key = 'icon:' + name;
  let s = tileCache.get(key);
  if (!s) { s = spr(ICON_ART[name] ?? ICON_ART.star, ICON_COLORS[name] ?? ['#fff', '#fff']); tileCache.set(key, s); }
  return s;
}

export const PARTY_IDS = Object.keys(PARTY_ART);
export const ARCH_IDS = Object.keys(ARCH);
export const DECOR_IDS = Object.keys(DECOR);
export const SPECIAL_IDS = Object.keys(SPECIAL);
