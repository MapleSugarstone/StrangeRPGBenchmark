// Sprites the user drew by hand, imported with scripts/import-sprites.mjs. Each figure is front, side, and back
// on the 8 by 9 grid, with a legend from letters to palette colors. Walk frames are made from the stand pose.
import { C } from '../engine/palette';
import { img, type Img } from '../engine/gfx';
import type { Dir } from '../world/map';
import type { Sheet } from './people';

export interface Drawn { legend: Record<string, number>; down: string[]; right: string[]; up: string[] }

export const DRAWN: Record<string, Drawn> = {
  sallis: {
    legend: { A: C.black, B: C.skin1, C: C.amb3, D: C.amb2, E: C.steel1 },
    down: ['........', '..AAAA..', '.AAAAAA.', '.BABBAB.', '.BABBAB.', '..CDDC..', '.EEEEEE.', '.BEEEEB.', '..A..A..'],
    right: ['........', '..AAAA..', '.AAAAAB.', '.ABBBAB.', '.BBBBAB.', '...CCD..', '..EEEE..', '..EEBE..', '...A..A.'],
    up: ['........', '..AAAA..', '.AAAAAA.', '.AAAAAA.', '.AAAAAA.', '..CCCC..', '.EEEEEE.', '.BEEEEB.', '..A..A..'],
  },
  ignace: {
    legend: { A: C.amb3, B: C.mud1, C: C.skin4, D: C.black, E: C.night, F: C.white },
    down: ['..AAAA..', '.BAAAAB.', '.BBBBBB.', '.BBBCDB.', '.BDCCDC.', '..EFFE..', '.EEFFEE.', '.CEEEEC.', '.EEEEEE.'],
    right: ['..AAAB..', '.BAAAAB.', '.BBBBBB.', '.BBCCDC.', '.CCCCDC.', '...EFF..', '..EEEF..', '..EECE..', '..EEEED.'],
    up: ['..AAAA..', '.BAAAAB.', '.BBBBBB.', '.BBBBBB.', '.BBBBBB.', '..EEEE..', '.EEEEEE.', '.EEEEEE.', '.EEEEEE.'],
  },
  tova: {
    legend: { A: C.mag2, B: C.skin4, C: C.black, D: C.vio1, E: C.pale, F: C.grn3 },
    down: ['..AAAA..', '.AAAAAA.', '.AABAAA.', '.ACBBCA.', 'DACBBCAD', 'DDAEEADD', 'CFDEEDFC', '.FDDDDF.', '..C..C..'],
    right: ['..AAAA..', '.AAAAAA.', '.AAAAAB.', '.AABBCB.', '.ABBBCB.', 'DDADDE..', 'CADDDD..', '..DDFD..', '...C..C.'],
    up: ['..AAAA..', '.AAAAAA.', '.AAAAAA.', '.AAAAAA.', '.AAAAAA.', 'DAAAAAAD', '.FAAAAF.', '.FDDDDF.', '..C..C..'],
  },
  ambrose: {
    legend: { A: C.skin1, B: C.black, C: C.cyan3, D: C.slate, E: C.amb2 },
    down: ['........', '..AAAA..', '.AAAAAA.', '.ABAACA.', '.BBAACB.', '.DBBBBD.', 'DCDEEDCD', 'CDDDDDDC', '..B..B..'],
    right: ['........', '..AAAA..', '.AAAAAA.', '.AAAABA.', '.AAAABA.', '..BBBB..', '.DDDDE..', '..DDCD..', '...B..B.'],
    up: ['........', '..AAAA..', '.AAAAAA.', '.AAAAAA.', '.AAAAAA.', '.DDDDDD.', 'DCDDDDCD', 'CDDDDDDC', '..B..B..'],
  },
  quaye: {
    legend: { A: C.pale, B: C.cyan3, C: C.black, D: C.skin1, E: C.vio1 },
    down: ['........', '...AA...', '.AAAAAA.', '.AAAAAA.', '.BCBBCB.', '.DCDDCD.', '.AEEEEA.', '.DEEEEDB', '..C..C.B'],
    right: ['........', 'AA......', 'AAAAAA..', '.AAAAAD.', '.AADBCB.', '.DDDDCD.', '..AEEE..', '.BEEDE..', '.B.C..C.'],
    up: ['........', '...AA...', '.AAAAAA.', '.AAAAAA.', '.AAAAAA.', '.AAAAAA.', '.AEEEEA.', 'BDEEEED.', 'B.C..C..'],
  },
  // Anouk: frost-pale hair cut short, a white Desk coat with the Board's red stripe at the cuff, gloves to the elbow.
  anouk: {
    legend: { A: C.steel4, B: C.skin5, C: C.black, D: C.pale, E: C.steel2, F: C.red2 },
    down: ['........', '..AAAA..', '.AAAAAA.', '.ABBBBA.', '.BCBBCB.', '..DDDD..', '.FDDDDF.', '.EDDDDE.', '..C..C..'],
    right: ['........', '..AAAA..', '.AAAAAA.', '.AABBBB.', '.ABBBCB.', '...DDD..', '..DDDF..', '..DDED..', '...C..C.'],
    up: ['........', '..AAAA..', '.AAAAAA.', '.AAAAAA.', '.ABBBBA.', '..DDDD..', '.FDDDDF.', '.EDDDDE.', '..C..C..'],
  },
  // Net things. Their glow color survives the net look, so a drift shows its feeling.
  sentry: {
    legend: { A: C.pale, B: C.steel3, C: C.black, D: C.cyan4 },
    down: ['...A....', '..ABA...', '..ABBA..', '.ABDDBA.', '.ABDDBA.', '..ABBA..', '...BA...', '...B....', '........'],
    right: ['...A....', '..ABA...', '..ABBA..', '.ABBDDA.', '.ABBDDA.', '..ABBA..', '...BA...', '...B....', '........'],
    up: ['...A....', '..ABA...', '..ABBA..', '.ABBBBA.', '.ABBBBA.', '..ABBA..', '...BA...', '...B....', '........'],
  },
  icehound: {
    legend: { A: C.steel4, B: C.steel2, C: C.black, D: C.cyan4 },
    down: ['........', '..A..A..', '..AAAA..', '.ADAADA.', '..ACCA..', '.BBBBBB.', '.BBBBBB.', '.C.CC.C.', '........'],
    right: ['........', '.....A.A', '.....AAA', 'A....ADA', 'ABBBBBAC', '.BBBBBB.', '.B.B.B.B', '.C.C.C.C', '........'],
    up: ['........', '..A..A..', '..AAAA..', '..AAAA..', '..AAAA..', '.BBBBBB.', '.BBBBBB.', '.C.CC.C.', '........'],
  },
  drift_anger: {
    legend: { A: C.steel2, B: C.steel1, C: C.black, D: C.mag3 },
    down: ['...DD...', '..DAAD..', '.DABBAD.', '.ACBBCA.', '.ABBBBA.', '..ABBA..', '.D.AA.D.', '..D..D..', '........'],
    right: ['...DD...', '..DAAD..', '.DABBAD.', '.ABBBCA.', '.ABBBBA.', '..ABBA..', '.D.AA.D.', '..D..D..', '........'],
    up: ['...DD...', '..DAAD..', '.DABBAD.', '.ABBBBA.', '.ABBBBA.', '..ABBA..', '.D.AA.D.', '..D..D..', '........'],
  },
  drift_quiet: {
    legend: { A: C.pale, B: C.steel3, C: C.black, D: C.cyan4 },
    down: ['..AAAA..', '.ABBBBA.', '.ABCCBA.', '.ABDDBA.', 'AAABBAAA', 'A.ABBA.A', '..ABBA..', '..A..A..', '.AA..AA.'],
    right: ['..AAAA..', '.ABBBBA.', '.ABBCCA.', '.ABBDDA.', '.AABBAAA', '..ABBA.A', '..ABBA..', '..A..A..', '.AA..AA.'],
    up: ['..AAAA..', '.ABBBBA.', '.ABBBBA.', '.ABBBBA.', 'AAABBAAA', 'A.ABBA.A', '..ABBA..', '..A..A..', '.AA..AA.'],
  },
};

/** The other drifts are the angry one in another feeling's color. */
for (const [id, c] of [['drift_grief', C.cyan4], ['drift_joy', C.grn3], ['drift_fear', C.vio3]] as const) {
  DRAWN[id] = { ...DRAWN.drift_anger, legend: { ...DRAWN.drift_anger.legend, D: c } };
}

/** Ambrose with his leased eye in arrears, showing ads in magenta. */
DRAWN.ambrose_ads = {
  ...DRAWN.ambrose,
  legend: { ...DRAWN.ambrose.legend, X: C.mag3 },
  down: DRAWN.ambrose.down.map((r, y) => (y === 3 || y === 4 ? r.slice(0, 5) + 'X' + r.slice(6) : r)),
};

const GLOW = new Set<number>([C.cyan3, C.cyan4, C.mag3, C.mag4, C.grn3, C.grn4, C.vio3, C.vio4]);

/** Walk frames from a stand pose: front and back lift one foot then the other, the side spreads then closes. */
function walk(rows: string[], black: string, dir: 'down' | 'up' | 'right'): string[][] {
  const last = rows.length - 1;
  const feet = [...rows[last]].flatMap((ch, x) => (ch === black ? [x] : []));
  if (feet.length < 2) return [rows, rows, rows];
  const a = feet[0], b = feet[feet.length - 1];
  const withFeet = (xs: number[]) => {
    const r = [...rows[last]].map((ch) => (ch === black ? '.' : ch));
    for (const x of xs) if (x >= 0 && x < r.length) r[x] = black;
    return [...rows.slice(0, last), r.join('')];
  };
  if (dir !== 'right') return [rows, withFeet([b]), withFeet([a])];
  return [rows, withFeet([a - 1, b + 1]), withFeet([a + 1, b - 1])];
}

/** A sheet from a hand-drawn figure. Neon colors take the accent slot so they glow, black stays black. */
export function drawnFigure(d: Drawn): Sheet {
  const chars = Object.keys(d.legend);
  const black = chars.find((k) => d.legend[k] === C.black) ?? '';
  const slotOf: Record<string, string> = {};
  const pal: number[] = [C.black, C.black, C.black, C.black, C.black, C.black];
  const free = ['1', '2', '3', '5', '6'];
  let glow = false;
  for (const k of chars) {
    const c = d.legend[k];
    if (c === C.black) { slotOf[k] = '0'; continue; }
    if (!glow && GLOW.has(c)) { slotOf[k] = '4'; pal[3] = c; glow = true; continue; }
    const s = free.shift() ?? '1';
    slotOf[k] = s;
    pal[s === '5' ? 4 : s === '6' ? 5 : Number(s) - 1] = c;
  }
  const toSlots = (rows: string[]) => rows.map((r) => [...r].map((ch) => (ch === '.' ? '.' : slotOf[ch] ?? '.')).join(''));
  const frames = { down: [] as Img[], up: [] as Img[], right: [] as Img[], left: [] as Img[] };
  for (const dir of ['down', 'up', 'right'] as const) for (const f of walk(d[dir], black, dir)) frames[dir].push(img(toSlots(f), pal));
  return { frames: frames as Record<Dir, Img[]>, flipLeft: true, glow };
}
