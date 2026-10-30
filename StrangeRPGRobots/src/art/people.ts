// Character sprites. People are built from layered 8 by 9 parts: a body for each facing and walk frame, then
// a coat cut, hair, and extras on top. Slots: 1 skin, 2 hair, 3 coat, 4 accent, 5 shirt, 6 hair light, 0 black.
// No outlines. Proportions: hair and hat over a face that is only the eye rows, a 3-row torso with sleeves and
// hands outside it, and feet.
import { img, type Img } from '../engine/gfx';
import { C, UP } from '../engine/palette';
import type { Dir } from '../world/map';

export interface Look {
  skin: number;
  hair: number;
  coat: number;
  accent: number;
  hairStyle: string;
  build?: 'slim' | 'broad' | 'small';
  /** Extras drawn over the body: beanie, cap, hood, visor, mask, arm, collar, coatlong, horns, robe, apron, glasses, beard, port, gloves, eyeglow, goggles, scarfhead, zucchetto, bag. */
  extras?: string[];
  pants?: 'black' | 'hair' | 'coat';
  /** The shirt under the coat. Picked from the other colors when omitted. */
  shirt?: number;
  /** The cut of the coat. Picked from the look's colors when omitted. */
  top?: Top;
}

export type Top = 'open' | 'lapel' | 'collar' | 'bomber' | 'hoodie' | 'trench' | 'vest' | 'harness' | 'yoke' | 'sash' | 'stripe' | 'plain';

export interface Sheet {
  /** frames[dir][frame]: frame 0 stands, 1 and 2 step. */
  frames: Record<Dir, Img[]>;
  /** Faces the left by flipping the right frames. */
  flipLeft: boolean;
  /** Accent pixels (slot 4) glow, for neon trims and visors. */
  glow?: boolean;
}

type Grid = string[];
type Facing = 'down' | 'up' | 'right';

const HEAD_DOWN = ['........', '..1111..', '.111111.', '.101101.', '.101101.'];
const HEAD_UP = ['........', '..1111..', '.111111.', '.111111.', '.111111.'];
const HEAD_RIGHT = ['........', '..1111..', '.111111.', '.111101.', '.111101.'];

const BODY: Record<Facing, Grid[]> = {
  down: [
    [...HEAD_DOWN, '..3333..', '.333333.', '.133331.', '..p..p..'],
    [...HEAD_DOWN, '..3333..', '.333333.', '.133331.', '.....p..'],
    [...HEAD_DOWN, '..3333..', '.333333.', '.133331.', '..p.....'],
  ],
  up: [
    [...HEAD_UP, '..3333..', '.333333.', '.133331.', '..p..p..'],
    [...HEAD_UP, '..3333..', '.333333.', '.133331.', '.....p..'],
    [...HEAD_UP, '..3333..', '.333333.', '.133331.', '..p.....'],
  ],
  right: [
    [...HEAD_RIGHT, '...333..', '..3333..', '..3313..', '...p..p.'],
    [...HEAD_RIGHT, '...333..', '..3333..', '..3133..', '..p....p'],
    [...HEAD_RIGHT, '...333..', '..3333..', '..3331..', '....pp..'],
  ],
};

/**
 * Hair layers per facing. 'h' paints hair over anything. 'b' is back hair, which only shows where nothing else
 * is drawn, so it hangs behind the body. 'f' is a fringe in the hair's lighter step, painted after hats.
 */
const HAIR: Record<string, Record<Facing, Grid>> = {
  short: {
    down: ['..hhhh..', '.hhhhhh.', '.hhhhhh.', '.h....h.'],
    up: ['..hhhh..', '.hhhhhh.', '.hhhhhh.', '.hhhhhh.', '.hhhhhh.'],
    right: ['..hhhh..', '.hhhhhh.', '.hhhhh..', '.hh.....'],
  },
  long: {
    down: ['..hhhh..', '.hhhhhh.', '.hhhhhh.', '.h....h.', '.h....h.', '.b....b.', 'b......b'],
    up: ['..hhhh..', '.hhhhhh.', '.hhhhhh.', '.hhhhhh.', '.hhhhhh.', '.hhhhhh.', '..hhhh..'],
    right: ['..hhhh..', '.hhhhhh.', '.hhhhh..', 'hhh.....', 'hh......', 'bb......', 'b.......'],
  },
  mohawk: {
    down: ['...hh...', '...hh...', '..hhhh..'],
    up: ['...hh...', '...hh...', '...hh...', '...hh...'],
    right: ['..hhh...', '..hhhh..', '...hh...'],
  },
  buzz: {
    down: ['........', '..hhhh..', '.hhhhhh.'],
    up: ['........', '..hhhh..', '.hhhhhh.', '.hhhhhh.', '.hhhhhh.'],
    right: ['........', '..hhhh..', '.hhhhh..', '.h......'],
  },
  bald: { down: [], up: [], right: [] },
  bun: {
    down: ['...hh...', '.hhhhhh.', '.hhhhhh.', '.h....h.'],
    up: ['...hh...', '.hhhhhh.', '.hhhhhh.', '.hhhhhh.', '.hhhhhh.'],
    right: ['hh......', 'hhhhhh..', '.hhhhh..', '.hh.....'],
  },
  bob: {
    down: ['..hhhh..', '.hhhhhh.', 'hhhhhhhh', 'h......h', 'h......h'],
    up: ['..hhhh..', '.hhhhhh.', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh'],
    right: ['..hhhh..', '.hhhhhh.', 'hhhhhhh.', 'hhh.....', 'hhh.....'],
  },
  spikes: {
    down: ['h.h..h.h', '.hhhhhh.', '.hhhhhh.', '.h....h.'],
    up: ['h.h..h.h', '.hhhhhh.', '.hhhhhh.', '.hhhhhh.', '.hhhhhh.'],
    right: ['.h.h.h..', '.hhhhhh.', '.hhhhh..', '.hh.....'],
  },
  braids: {
    down: ['..hhhh..', '.hhhhhh.', '.hhhhhh.', '.h....h.', 'hh....hh', 'b......b', 'b......b', 'b......b'],
    up: ['..hhhh..', '.hhhhhh.', '.hhhhhh.', '.hhhhhh.', '.hhhhhh.', '..h..h..', '..h..h..', '..h..h..'],
    right: ['..hhhh..', '.hhhhhh.', '.hhhhh..', '.hh.....', 'bb......', 'b.......', 'b.......', 'b.......'],
  },
  curls: {
    down: ['.hhhhhh.', 'hhhhhhhh', 'hhhhhhhh', 'h......h', 'b......b'],
    up: ['.hhhhhh.', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', '.hhhhhh.'],
    right: ['.hhhhh..', 'hhhhhhh.', 'hhhhhh..', 'hhh.....', 'hh......'],
  },
  sidecut: {
    down: ['..hhhh..', '.hhhhh..', '.hhhh...', '.h......'],
    up: ['..hhhh..', '..hhhhh.', '...hhhh.', '......h.'],
    right: ['..hhhh..', '.hhhhhh.', '.hhh....', '.h......'],
  },
  tails: {
    down: ['..hhhh..', '.hhhhhh.', 'hhhhhhhh', 'h......h', 'b......b', 'b......b'],
    up: ['..hhhh..', '.hhhhhh.', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'h......h'],
    right: ['..hhhh..', '.hhhhhh.', 'hhhhhh..', 'hh......', 'b.......', 'b.......'],
  },
  swoop: {
    down: ['..hhhh..', '.hhhhhh.', '.hhhhhh.', '.hhh..h.', '.h......'],
    up: ['..hhhh..', '.hhhhhh.', '.hhhhhh.', '.hhhhhh.', '.hhhhhh.'],
    right: ['..hhhh..', '.hhhhhh.', '.hhhhhh.', '.hh.....'],
  },
  ponytail: {
    down: ['..hhhh..', '.hhhhhh.', '.hhhhhh.', '.h....h.'],
    up: ['..hhhh..', '.hhhhhh.', '.hhhhhh.', '.hhhhhh.', '.hhhhhh.', '...hh...', '...hh...', '...h....'],
    right: ['..hhhh..', 'hhhhhhh.', 'hhhhh...', 'bh......', 'b.......'],
  },
  /** The hero's hair: a bright fringe, strands over one eye, and long back hair that flares at the shoulders. */
  strands: {
    down: ['..hhhh..', '.hhhhhh.', '.hfhfhhh', '.h.h....', '.h......', '.b....b.', 'b......b'],
    up: ['..hhhh..', '.hhhhhh.', '.hhhhhhh', '.hhhhhh.', '.hhhhhh.', '.hhhhhh.', 'h.hhhh.h'],
    right: ['..hhhh..', '.hhhhhh.', '.hhhhfhh', 'hhhh....', '.hh.....', 'bbb.....', 'bb......'],
  },
};

/** Extras: 'a' accent, '3' coat, '2' hair color, '1' skin, '0' black. Rows start at row 0. */
const EXTRA: Record<string, Record<Facing, Grid>> = {
  beanie: {
    down: ['..00000.', '.000000.', '.0000000'],
    up: ['..00000.', '.000000.', '.0000000'],
    right: ['..00000.', '.000000.', '.0000000'],
  },
  visor: {
    down: ['', '', '', '.aaaaaa.', '.a0aa0a.'],
    up: ['', '', '', 'a......a'],
    right: ['', '', '', '...aaaa.', '...aa0a.'],
  },
  glasses: {
    down: ['', '', '', '.a0aa0a.'],
    up: [],
    right: ['', '', '', '....a0a.'],
  },
  mask: {
    down: ['', '', '', '', '', '..aaaa..'],
    up: [],
    right: ['', '', '', '', '', '...aa...'],
  },
  redmask: {
    down: ['', '', '', '', '', '..rrrr..'],
    up: [],
    right: ['', '', '', '', '', '...rr...'],
  },
  arm: {
    down: ['', '', '', '', '', '', '.a......', '.a......'],
    up: ['', '', '', '', '', '', '......a.', '......a.'],
    right: ['', '', '', '', '', '', '', '....a...'],
  },
  collar: {
    down: ['', '', '', '', '', '..a..a..'],
    up: ['', '', '', '', '', '..aaaa..'],
    right: ['', '', '', '', '', '...aa...'],
  },
  trim: {
    down: ['', '', '', '', '', '', '', '..aaaa..'],
    up: ['', '', '', '', '', '', '', '..aaaa..'],
    right: ['', '', '', '', '', '', '', '..a.....'],
  },
  hood: {
    down: ['..3333..', '.333333.', '.333333.', '.3....3.', '.3....3.'],
    up: ['..3333..', '.333333.', '.333333.', '.333333.', '.333333.'],
    right: ['..3333..', '.333333.', '.33333..', '.33.....', '.33.....'],
  },
  coatlong: {
    down: ['', '', '', '', '', '', '', '', '.3....3.'],
    up: ['', '', '', '', '', '', '', '', '.33..33.'],
    right: ['', '', '', '', '', '', '', '', '.33.....'],
  },
  cap: {
    down: ['..aaaa..', '.aaaaaa.', 'aaaaaaaa'],
    up: ['..aaaa..', '.aaaaaa.', '.aaaaaa.'],
    right: ['..aaaa..', '.aaaaaa.', '.aaaaaaa'],
  },
  horns: {
    down: ['.a....a.', '.a....a.'],
    up: ['.a....a.', '.a....a.'],
    right: ['..a.....', '..a.....'],
  },
  robe: {
    down: ['', '', '', '', '', '', '', '.133331.', '.333333.'],
    up: ['', '', '', '', '', '', '', '.333333.', '.333333.'],
    right: ['', '', '', '', '', '', '', '..3313..', '..3333..'],
  },
  apron: {
    down: ['', '', '', '', '', '', '..aaaa..', '..aaaa..'],
    up: [],
    right: ['', '', '', '', '', '', '....a...', '....a...'],
  },
  beard: {
    down: ['', '', '', '', '.2....2.', '..2222..'],
    up: [],
    right: ['', '', '', '', '', '..222...'],
  },
  eyepatch: {
    down: ['', '', 'aa......', '..a.....', '..a.....'],
    up: [],
    right: [],
  },
  scarf: {
    down: ['', '', '', '', '', '..aaaa..', '....a...'],
    up: ['', '', '', '', '', '..aaaa..'],
    right: ['', '', '', '', '', '..aaa...', '..a.....'],
  },
  pack: {
    down: [],
    up: ['', '', '', '', '', '..aaaa..', '..aaaa..'],
    right: ['', '', '', '', '', '.a......', '.a......'],
  },
  /** The woken neural port: a lit socket at the temple, behind the ear, and at the nape. */
  port: {
    down: ['', '', '......a.'],
    up: ['', '', '', '', '...a....'],
    right: ['', '', '', '..a.....'],
  },
  umbrella: { down: [], up: [], right: [] },
  /** One eye lit in the accent color, for leased chrome eyes. */
  eyeglow: {
    down: ['', '', '', '.....a..', '.....a..'],
    up: [],
    right: ['', '', '', '.....a..', '.....a..'],
  },
  /** Flight goggles pushed up on the forehead. */
  goggles: {
    down: ['', '', '.a0aa0a.'],
    up: ['', '', 'a......a'],
    right: ['', '', '....a0a.'],
  },
  scarfhead: {
    down: ['..aaaa..', '.aaaaaa.', '.aaaaaa.', '.a....a.'],
    up: ['..aaaa..', '.aaaaaa.', '.aaaaaa.', '.aaaaaa.', '.aaaaaa.'],
    right: ['..aaaa..', '.aaaaaa.', '.aaaaa..', 'aaa.....', 'aa......'],
  },
  /** A deacon's skullcap. */
  zucchetto: {
    down: ['..aaaa..', '..aaaa..'],
    up: ['..aaaa..', '..aaaa..'],
    right: ['..aaa...', '..aaaa..'],
  },
  bag: {
    down: ['', '', '', '', '', '', '', '.......a', '.......a'],
    up: ['', '', '', '', '', '', '', 'a.......', 'a.......'],
    right: ['', '', '', '', '', '', '', '.a......', '.a......'],
  },
};

/**
 * Coat cuts. '5' shirt and '4' accent only paint over coat pixels, so hands and faces stay. 'c' paints coat
 * anywhere, for collars and hoods that stand off the body.
 */
const TOPS: Record<Top, Record<Facing, Grid>> = {
  open: {
    down: ['', '', '', '', '', '...55...', '...55...'],
    up: [],
    right: ['', '', '', '', '', '.....5..', '.....5..'],
  },
  lapel: {
    down: ['', '', '', '', '', '..5555..', '...55...'],
    up: [],
    right: ['', '', '', '', '', '....55..', '.....5..'],
  },
  collar: {
    down: ['', '', '', '', 'c......c', 'cc.55.cc', '...55...'],
    up: ['', '', '', '', '.cccccc.', 'cccccccc'],
    right: ['', '', '', '', 'c.......', 'cc...5..'],
  },
  bomber: {
    down: ['', '', '', '', '', '...4....', '...4....', '55555555'],
    up: ['', '', '', '', '', '', '', '55555555'],
    right: ['', '', '', '', '', '.....4..', '.....4..', '55555555'],
  },
  hoodie: {
    down: ['', '', '', '', '', '.c5..5c.', '..5..5..'],
    up: ['', '', '', '', '.cccccc.', 'cccccccc'],
    right: ['', '', '', '', 'cc......', 'cc...5..'],
  },
  trench: {
    down: ['', '', '', '', '', '..5555..', '44444444', '', '.c....c.'],
    up: ['', '', '', '', '', '', '44444444', '', '.c....c.'],
    right: ['', '', '', '', '', '....55..', '44444444', '', '.c......'],
  },
  vest: {
    down: ['', '', '', '', '', '', '.5....5.'],
    up: ['', '', '', '', '', '', '.5....5.'],
    right: ['', '', '', '', '', '', '..5.....'],
  },
  harness: {
    down: ['', '', '', '', '', '..4..4..', '...44...', '..4..4..'],
    up: ['', '', '', '', '', '..4..4..', '...44...', '..4..4..'],
    right: ['', '', '', '', '', '...4....', '....4...', '...4....'],
  },
  yoke: {
    down: ['', '', '', '', '', '55555555'],
    up: ['', '', '', '', '', '55555555'],
    right: ['', '', '', '', '', '55555555'],
  },
  sash: {
    down: ['', '', '', '', '', '.....5..', '....5...', '...5....'],
    up: ['', '', '', '', '', '..5.....', '...5....', '....5...'],
    right: ['', '', '', '', '', '...5....', '....5...', '.....5..'],
  },
  stripe: {
    down: ['', '', '', '', '', '', '55555555'],
    up: ['', '', '', '', '', '', '55555555'],
    right: ['', '', '', '', '', '', '55555555'],
  },
  plain: { down: [], up: [], right: [] },
};
const TOP_ORDER: Top[] = ['open', 'lapel', 'collar', 'bomber', 'hoodie', 'trench', 'open', 'collar', 'vest', 'harness', 'lapel', 'bomber', 'yoke', 'sash', 'stripe', 'plain'];
export const SHIRTS = [C.black, C.pale, C.white, C.gray, C.amb2, C.cyan2, C.mag2, C.vio2, C.grn2, C.steel3, C.mud2];

/** A shirt color and coat cut for a look that names none, stable for the same look. */
function shirtOf(look: Look): { shirt: number; top: Top } {
  const k = (look.skin * 7 + look.hair * 13 + look.coat * 31 + look.accent * 17 + look.hairStyle.length * 5) >>> 0;
  let shirt = look.shirt;
  for (let i = 0; shirt === undefined && i < SHIRTS.length; i++) {
    const c = SHIRTS[(k + i) % SHIRTS.length];
    if (c !== look.coat && c !== look.hair && c !== C.black) shirt = c;
  }
  return { shirt: shirt ?? C.pale, top: look.top ?? TOP_ORDER[(k >> 3) % TOP_ORDER.length] };
}

function paintTop(base: Grid, layer: Grid): Grid {
  const out = base.map((r) => r.split(''));
  layer.forEach((row, y) => {
    for (let x = 0; x < row.length && y < out.length; x++) {
      const ch = row[x];
      if (ch === 'c') out[y][x] = '3';
      else if ((ch === '5' || ch === '4') && out[y][x] === '3') out[y][x] = ch;
    }
  });
  return out.map((r) => r.join(''));
}

function paintHair(base: Grid, layer: Grid, fringe: boolean): Grid {
  const out = base.map((r) => r.split(''));
  layer.forEach((row, y) => {
    for (let x = 0; x < row.length && y < out.length; x++) {
      const ch = row[x];
      if (fringe) { if (ch === 'f') out[y][x] = '6'; continue; }
      if (ch === 'h' || ch === 'f') out[y][x] = '2';
      else if (ch === 'b' && out[y][x] === '.') out[y][x] = '2';
    }
  });
  return out.map((r) => r.join(''));
}

function paint(base: Grid, layer: Grid, map: Record<string, string>): Grid {
  const out = base.map((r) => r.split(''));
  layer.forEach((row, y) => {
    if (!row) return;
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const v = map[ch];
      if (v === undefined) continue;
      if (y < out.length) out[y][x] = v;
    }
  });
  return out.map((r) => r.join(''));
}

/** Broad shoulders: the torso grows a pixel each side and the hands move out with it. */
function widen(g: Grid, dir: Facing): Grid {
  const o = [...g];
  if (dir === 'right') { o[5] = '..333...'; o[6] = '.33333..'; return o; }
  o[5] = '.333333.';
  o[6] = '33333333';
  o[7] = '13333331';
  return o;
}

/** Narrow shoulders. */
function slim(g: Grid, dir: Facing): Grid {
  if (dir === 'right') return g;
  const o = [...g];
  o[5] = '...33...';
  return o;
}

/** Children: the head drops a row and the torso loses one, so the feet stay on the ground. */
function shrink(g: Grid): Grid {
  return ['........', ...g.slice(0, 5), ...g.slice(6)];
}

/** Builds a sprite sheet for a person. */
export function personSheet(look: Look): Sheet {
  const { shirt, top } = shirtOf(look);
  // Black eyes vanish on the darkest skin tone, so faces start one step up the ramp.
  const pal = [look.skin === C.skin0 ? C.skin1 : look.skin, look.hair, look.coat, look.accent, shirt, UP[UP[look.hair]]];
  const frames = { down: [] as Img[], up: [] as Img[], right: [] as Img[], left: [] as Img[] };
  const pantsCh = look.pants === 'hair' ? '2' : look.pants === 'coat' ? '3' : '0';
  for (const dir of ['down', 'up', 'right'] as const) {
    for (let f = 0; f < 3; f++) {
      let g = BODY[dir][f].map((r) => r.replace(/p/g, pantsCh));
      if (look.build === 'broad') g = widen(g, dir);
      if (look.build === 'slim') g = slim(g, dir);
      g = paintTop(g, TOPS[top][dir]);
      const hair = (HAIR[look.hairStyle] ?? HAIR.short)[dir];
      g = paintHair(g, hair, false);
      for (const e of look.extras ?? []) {
        const layer = EXTRA[e]?.[dir];
        if (layer) g = paint(g, layer, { a: '4', '3': '3', '2': '2', '1': '1', '0': '0', '4': '4', '5': '5', r: 'r' });
      }
      g = paintHair(g, hair, true);
      // Long gloves, or leased chrome arms: hands and sleeves take the accent.
      if (look.extras?.includes('gloves')) {
        g = g.map((r, y) => (y === 7 ? r.replace(/1/g, '4') : y === 6 && dir !== 'right' ? r[0] + '4' + r.slice(2, 6) + '4' + r[7] : r));
      }
      if (look.build === 'small') g = shrink(g);
      const hasRed = g.some((r) => r.includes('r'));
      const rows = g.map((r) => r.replace(/r/g, '4'));
      const p = hasRed ? [pal[0], pal[1], pal[2], C.red2, pal[4], pal[5]] : pal;
      frames[dir].push(img(rows, p));
    }
  }
  return { frames: frames as Record<Dir, Img[]>, flipLeft: true, glow: NEON.has(look.accent) };
}

const NEON = new Set<number>([C.cyan3, C.cyan4, C.mag3, C.mag4, C.amb3, C.amb4, C.grn3, C.grn4, C.vio3, C.vio4, C.red2, C.red3]);

/** A sheet from hand-drawn frames: down, up, right, each with three frames (stand, step, step). */
export function drawnSheet(rows: Record<'down' | 'up' | 'right', Grid[]>, pal: number[]): Sheet {
  const frames = { down: [] as Img[], up: [] as Img[], right: [] as Img[], left: [] as Img[] };
  for (const dir of ['down', 'up', 'right'] as const) for (const g of rows[dir]) frames[dir].push(img(g, pal));
  return { frames: frames as Record<Dir, Img[]>, flipLeft: true, glow: NEON.has(pal[3]) };
}

export const SKINS = [
  [C.skin0, C.skin1], [C.skin1, C.skin2], [C.skin2, C.skin3], [C.skin3, C.skin4], [C.skin4, C.skin5], [C.skin5, C.skin5],
].map((p) => p[1]);
export const HAIRS = [C.black, C.ink, C.mud1, C.amb2, C.mag1, C.mag2, C.cyan1, C.cyan2, C.vio2, C.pale, C.grn2, C.white];
export const COATS = [C.vio1, C.cyan1, C.mag1, C.slate, C.mud1, C.grn1, C.night, C.amb1, C.steel1, C.vio2];
export const ACCENTS = [C.cyan3, C.mag3, C.amb3, C.grn3, C.vio3, C.pale, C.cyan4, C.mag4];
export const STYLES = Object.keys(HAIR);
export const TOP_NAMES = Object.keys(TOPS) as Top[];
export const HATS = ['none', 'beanie', 'cap', 'hood'];
export const CROWD_EXTRAS = ['visor', 'collar', 'trim', 'hood', 'coatlong', 'mask', 'arm', 'glasses', 'scarf', 'cap', 'pack', 'beard', 'beanie'];

/** The hero as the user drew it: a black beanie over magenta hair, a cyan coat open on a magenta shirt. */
export const HERO_LOOK: Look = { skin: C.skin4, hair: C.mag1, coat: C.cyan1, accent: C.mag3, shirt: C.mag2, top: 'open', hairStyle: 'strands', extras: ['beanie'] };

/** Hero designs for the sheet: the user's first, then the earlier candidates. */
export const HERO_PRESETS: { name: string; look: Look }[] = [
  { name: 'Lode', look: HERO_LOOK },
  { name: 'Diver', look: { skin: C.skin2, hair: C.mag2, coat: C.vio1, accent: C.cyan3, shirt: C.pale, top: 'collar', hairStyle: 'sidecut', extras: ['port'] } },
  { name: 'Courier', look: { skin: C.skin3, hair: C.amb2, coat: C.cyan1, accent: C.mag3, shirt: C.mag2, top: 'bomber', hairStyle: 'ponytail', extras: ['port'] } },
  { name: 'Runner', look: { skin: C.skin4, hair: C.ink, coat: C.night, accent: C.mag3, shirt: C.mag2, top: 'hoodie', hairStyle: 'swoop', extras: ['port'] } },
  { name: 'Canal kid', look: { skin: C.skin3, hair: C.ink, coat: C.mud1, accent: C.amb3, shirt: C.amb2, top: 'trench', hairStyle: 'curls', extras: ['port'], pants: 'coat' } },
  { name: 'Twin tails', look: { skin: C.skin5, hair: C.cyan2, coat: C.mag1, accent: C.amb3, shirt: C.white, top: 'lapel', hairStyle: 'tails', extras: ['port'] } },
];

/** A random look for a passerby, from a seed. */
export function crowdLook(seed: number): Look {
  let s = seed >>> 0;
  const r = () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return s / 4294967296; };
  const extras: string[] = [];
  const n = r() < 0.3 ? 0 : r() < 0.7 ? 1 : 2;
  for (let i = 0; i < n; i++) {
    const e = CROWD_EXTRAS[Math.floor(r() * CROWD_EXTRAS.length)];
    if (!extras.includes(e)) extras.push(e);
  }
  return {
    skin: SKINS[Math.floor(r() * SKINS.length)],
    hair: HAIRS[Math.floor(r() * HAIRS.length)],
    coat: COATS[Math.floor(r() * COATS.length)],
    accent: ACCENTS[Math.floor(r() * ACCENTS.length)],
    hairStyle: STYLES[Math.floor(r() * STYLES.length)],
    build: r() < 0.2 ? 'broad' : r() < 0.4 ? 'slim' : r() < 0.5 ? 'small' : undefined,
    extras,
    pants: r() < 0.7 ? 'black' : 'coat',
  };
}
