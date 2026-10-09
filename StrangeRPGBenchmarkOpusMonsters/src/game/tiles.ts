// Field tiles: region palettes and the painter for every tile character.
// Each tile look is painted once into an atlas and copied from there every frame.
import { ctx, INK } from '../engine/screen';
import { field } from './field';

export type Style = 'fell' | 'rib' | 'mast' | 'spire' | 'bole' | 'hum' | 'tusk' | 'hilt' | 'fall' | 'crown' | 'slack' | 'den'
  | 'under' | 'knuckle' | 'wreck' | 'shore' | 'bell' | 'root' | 'skin' | 'ice' | 'blade' | 'moon' | 'glass' | 'orchard' | 'margin'
  | 'strand' | 'dollar' | 'cowrie' | 'auger' | 'nautilus' | 'tray' | 'conch' | 'whorl' | 'coast' | 'wood' | 'ringwood' | 'geode';

export interface Pal {
  /** Picks the shapes `drawTile` uses for this region. */
  style: Style;
  /** Ground, its shade, and its light. */
  g: string; g2: string; g3: string;
  path: string;
  /** Walls and house walls, and their dark lines. */
  w: string; w2: string;
  roof: string;
  /** The region's color. */
  a: string;
  /** The region's one surprising color. */
  x: string;
  /** Deep water and shallow water. */
  wt: string; wt2: string;
  tr: string; tr2: string;
  hi: string;
  /** Evening dither color. */
  dusk: string;
}

/** Colors in this order: ground, ground shade, ground light, path, wall, wall dark, roof, accent, surprise, deep water, shallow water, plant, plant dark, highlight, evening. */
function pal(style: Style, cols: string): Pal {
  const [g, g2, g3, path, w, w2, roof, a, x, wt, wt2, tr, tr2, hi, dusk] = cols.split(' ');
  return { style, g, g2, g3, path, w, w2, roof, a, x, wt, wt2, tr, tr2, hi, dusk };
}

export const REGIONS: Pal[] = [
  pal('fell', '#e2c27a #c29a50 #f4e0a4 #f8ecd2 #f2e4d4 #8a4a3a #e8604a #e8604a #2ec8b0 #1e5ab8 #3aa8d0 #6aae3a #2a6430 #fffaf0 #2a1650'),
  pal('rib', '#c4a0b8 #a07c98 #dcc0d4 #fff4ea #f6d2d8 #8a2c50 #e04a74 #ff7a92 #3050d8 #1e5ab8 #3a9ad8 #b0a454 #5a6a30 #ffffff #3a1048'),
  pal('mast', '#e8c47c #c4944e #f8e2aa #a06c3c #7a4a2a #36200f #24345a #4ab4cc #ff6448 #1e6ab0 #48c0d8 #b4a24c #6a6428 #fff8ec #24164a'),
  pal('spire', '#7cae94 #5a8a74 #a0d0b6 #cdd4e2 #4a5a80 #20263e #343c66 #34d6a4 #f0b030 #143e66 #2a7a9a #3a8a58 #1a4a36 #ecf6f2 #141038'),
  pal('bole', '#5ca440 #3e7c2e #88cc58 #a8743e #7c4426 #38180c #3a8a3a #e8b828 #ff6a50 #1e5a90 #38a0c0 #2a7a28 #123a14 #ecfac4 #10203a'),
  pal('hum', '#4c586a #3a4454 #6c788c #aab6c4 #9cacbe #364254 #566880 #ffb020 #3ce8c4 #1c3a7a #2e78b0 #6a8a5a #2e4a2e #f2f6fa #101a3a'),
  pal('tusk', '#e8f0fa #a6bede #ffffff #c2d0e4 #ecdcb4 #8a6a40 #e8f0fa #6ab4f4 #e02a50 #1a4aa0 #3a8ad8 #2a7a6a #123e3a #ffffff #1a2458'),
  pal('hilt', '#8c7058 #6a5240 #aa8a6a #bcaa90 #5a6478 #242834 #3c4256 #d8622a #f4d438 #142a6a #2a5aa8 #6a8a3a #2e4220 #dce0ec #1e1030'),
  pal('fall', '#7a58b4 #583890 #9c7cd6 #dcd0f4 #3a2a6c #180e34 #9a58e4 #fff4c4 #3cf0e0 #221e78 #3a3ab0 #6a48a4 #2c1c5c #fffbe8 #0e0828'),
  pal('crown', '#f4ecd8 #d8c8a0 #fffaf0 #e4d6b0 #ece2ca #1a1820 #1a1820 #e4b440 #2a48c8 #1e4ab8 #3a7ad8 #7a9a5a #3a4a2e #ffffff #1a1440'),
  pal('slack', '#9a98a0 #78767e #b8b6be #aaa8b0 #a8c4dc #4a6a8c #6a8aac #e4dccc #e478a8 #2a4a8a #4a7ab0 #7a7a6a #44443a #f0f4f6 #1a1a3a'),
  pal('den', '#7a5a44 #5a4030 #9a7458 #8a6a50 #4a3428 #22160e #4a3428 #e8a850 #3ab8a8 #1e4a8a #2a7ab0 #5a7a3a #2e3e20 #f4e0bc #1e1020'),
  pal('under', '#4a3a30 #33281f #66503e #7a5c40 #2c2220 #140e0c #3a2c22 #ecc470 #5cf4d4 #102a5a #1e5a8a #b08a5a #6a4c30 #fae8c0 #0a0810'),
  pal('knuckle', '#b4a45c #8c7a3c #d4c47c #f4ead6 #f6eee0 #a48a68 #f6eee0 #ff8498 #6a3ad0 #1e5ab8 #3a9ad8 #7a9e38 #3a5a22 #ffffff #2a1448'),
  pal('wreck', '#dcb06c #b28646 #f2d296 #aa7a46 #6a3e22 #2a160c #5a3a22 #44b4cc #ee3e28 #1e6ab0 #48c0d8 #aca23e #6a6a28 #fff4e0 #22164a'),
  pal('shore', '#d4c4a0 #aa9a78 #ecdec0 #e4d6b8 #7898ac #3a5670 #5a7690 #c4ecf4 #ff8a30 #1a5aa0 #3aa8d8 #7aa86a #3a5a3c #f4fbff #1a2048'),
  pal('bell', '#384260 #262c44 #4e5a7e #6a7898 #4c5a7e #141828 #2e3654 #34d6a4 #f4b42c #102240 #1e4a78 #3a7a5a #1a3a2a #e4eefa #08060e'),
  pal('root', '#5a4426 #3e2e18 #7a5e36 #9c7446 #a46838 #4a2812 #3a8a3a #6ac840 #f4d038 #1a5a80 #2e8ab0 #5aa840 #24481a #ecf8c0 #0c140c'),
  pal('skin', '#8a7ea0 #685c80 #aca2c0 #beb4cc #f2eaf4 #8a789c #dccce4 #94b4d4 #ff5a34 #2a3a80 #4a6ab0 #7a8060 #3a3e2e #ffffff #120c2a'),
  pal('ice', '#bde2f6 #84b6dc #ecfaff #f2f8fc #4a7ec0 #1a3a72 #e8f2fa #eedcb0 #7836d8 #142e88 #2a5ac0 #2a7a6a #123e3a #ffffff #101a48'),
  pal('blade', '#7c7250 #5a523a #9a8c62 #9c8a66 #a0a8b8 #30343e #4c5262 #d8622a #ff3434 #1e3a6a #2a5a90 #7a8a3a #3a4422 #e4e8f0 #1e1028'),
  pal('moon', '#8888b8 #686896 #aaaad4 #c8c8e4 #484880 #20204c #484880 #fff4d0 #74f4e4 #1e2a78 #3a4ab0 #7a9a9a #3a4a5a #fffbe8 #0c0c2a'),
  pal('glass', '#84d4c2 #54a896 #c0f4e6 #ecd498 #24807c #0e3a3a #24807c #fff4c4 #ff58b4 #1a5aa8 #3a90d0 #8aa060 #3a5030 #ffffff #101838'),
  pal('orchard', '#68b446 #488c30 #90d664 #f4e8cc #f6eedc #9a8460 #1a1820 #ecb428 #ec364c #1e6ab8 #3a9ad8 #2a8c2a #124a1a #ffffff #1a1440'),
  pal('margin', '#e6e2d8 #c6c2b6 #f6f4ee #d6d2c6 #9a98aa #4a4a5c #b0b0c4 #b4d0ec #2a4ce8 #6a8ac0 #9ab4d8 #b0b0a0 #707068 #ffffff #3a3a6a'),
  // Act 2, the Strand. Every one is night: deep blues and violets, sea glass, pearl, coral, and star gold.
  pal('strand', '#7e78a8 #5c5688 #a49ecb #545894 #2a2640 #120f1e #e4d8ec #ffd04a #3ee8c8 #10185a #2642a4 #262a3e #0d0d18 #f4f0ff #08061c'),
  pal('dollar', '#b29278 #8a6e5c #d2b694 #e4d0a8 #ece2d4 #8a7466 #f6eee2 #ff8c3a #7a8cff #1a2a6a #3a5ab0 #7a8a5a #3a4430 #fff6e6 #1c1028'),
  pal('cowrie', '#e6d2b0 #c0a07a #fff0d4 #f2e2c4 #8a4a2a #3a1a0e #e8c8a0 #c86a30 #8a5ae0 #2a2a7a #4a6ac0 #a08a5a #5a4a2a #ffffff #1e0e28'),
  pal('auger', '#9c8270 #76604e #c0a48c #cdb49a #5c3a4c #26141e #d8b48a #f0c060 #4ad8f0 #16246a #3456ac #8a8a60 #40402a #fff0dc #120a1e'),
  pal('nautilus', '#bcb4d4 #948cb4 #e0dcf2 #d2cae6 #f2eee6 #7a5a6e #e8743e #ff8a48 #40e8a8 #18347a #3a74c0 #5a9a8a #24443e #ffffff #181034'),
  pal('tray', '#c4c0b0 #9e9a8c #e2ded2 #b0ac9e #6e6a60 #34322c #d4c8b4 #f2d064 #9a58f0 #141c58 #2c449c #8e8c66 #4c4a36 #ffffff #100e28'),
  pal('conch', '#e494ac #c06a8a #ffc0d2 #f6b2c4 #8a2a56 #3a0c26 #ffd6c4 #ffe2a0 #36e0d0 #24287a #4858c8 #c8648a #6a2244 #fff4f6 #26082a'),
  pal('whorl', '#b0a6a4 #8a8084 #d4cac4 #c8beb6 #5e5260 #2a2230 #e4d8cc #ffd04a #ff6aa0 #10185a #2440a0 #6a7486 #363c4c #fff8f0 #0c0a22'),
  // The ring round the Lipwater: a coast palette or a wood palette for each new map, in its region's colors.
  /* 33 Cockle Cove */ pal('coast', '#ecd49a #ccae6c #fbeec4 #f6e6c0 #c8b8a4 #6a4a3a #e8604a #ff8a6a #2ec8b0 #1e5ab8 #4ab8d8 #8ab05a #4a6a30 #fffaf0 #2a1650'),
  /* 34 the Brook Wood */ pal('wood', '#6aa850 #4a8838 #90c870 #c8a870 #8a6a4a #3a2a1a #e8604a #f0c040 #2ec8b0 #1e5ab8 #3aa8d0 #3a8a3a #1a4a20 #f4fae0 #1a1840'),
  /* 35 the High-water Mark */ pal('wood', '#c8b07a #a48a54 #e0cc98 #d8c49a #8a6a4a #3e2a18 #24345a #4ab4cc #ff6448 #1e6ab0 #48c0d8 #4a7a4a #1e3e2a #fff8ec #24164a'),
  /* 36 the Saltings */ pal('coast', '#d8d8cc #b0b0a4 #f4f4ec #e8e4d8 #6a7a8a #2a3440 #3a5a7a #34d6a4 #f0b030 #1a4a80 #3a8ab0 #7aa890 #3a5a4a #ffffff #141038'),
  /* 37 the Shouting Wood */ pal('wood', '#5a9a7a #3e7a5e #80bc9c #b4c4b0 #4a5a6a #1e2a30 #343c66 #34d6a4 #f0b030 #143e66 #2a7a9a #2a7a5a #10402e #ecf6f2 #141038'),
  /* 38 the Kelp Beds */ pal('coast', '#c4b880 #a09458 #e0d8a4 #d8cca0 #6a5a3a #2a2010 #3a8a3a #e8b828 #ff6a50 #1e5a90 #38a0c0 #4a7a2a #1e3e10 #f4f8d4 #10203a'),
  /* 39 the Gantry Shore */ pal('coast', '#9aa0a8 #767c86 #bcc2ca #c8ccd2 #6c7888 #2a3240 #566880 #ffb020 #3ce8c4 #1c3a7a #2e78b0 #6a8a6a #2e4a3a #f2f6fa #101a3a'),
  /* 40 the Floes */ pal('coast', '#dce8f4 #a6bede #f4faff #c8d6ea #8aa8c8 #3a5a80 #e8f0fa #6ab4f4 #e02a50 #1a4aa0 #3a8ad8 #4a8a8a #1e4a4a #ffffff #1a2458'),
  /* 41 the Shingle */ pal('coast', '#a09a90 #7e786e #c0bab0 #b8b2a6 #6a7080 #2a2c34 #3c4256 #d8622a #f4d438 #142a6a #2a5aa8 #6a7a5a #2e3a24 #e8ecf0 #1e1030'),
  /* 42 the Long Way Round */ pal('coast', '#c8b0d8 #a48cb8 #e0d0ec #e4d8f0 #6a5a8a #2a1e44 #9a58e4 #fff4c4 #3cf0e0 #221e78 #3a5ab0 #7a6aa4 #3c2c5c #fffbe8 #0e0828'),
  /* 43 the Gate Ring */ pal('ringwood', '#3a6a4a #284e36 #5a8a66 #c8c0a0 #e8e0c8 #2a2420 #1a1820 #e4b440 #74f4e4 #1e4ab8 #4a9ad8 #2a5a3a #102a1a #fffaf0 #0c1430'),
  /* 44 the Geode */ pal('geode', '#463a5e #352a4a #5e5080 #8c7cb4 #6a5890 #221832 #9a70d8 #c890ff #5ae8d0 #1a1450 #3a3aa0 #b48cf0 #6a48a4 #f4eaff #0c0820'),
];

export const SOLID = new Set(['#', 'T', '~', 'z', 'h', 'r', 'f', 'k', 'm', 'l', 'B', 'w', 'c', 'p', 'u', 'v', 'e', 'i', 'Z', 'j', 'Y', 'O', 'K',
  'Q', 'R', 'V', 'F', 'D', 'X', 'A', 'M', 'U', 'H', 'C', 'J', ';', '<', '>', '^', ':', '%', '@', '+', 'o', '|', '`']);

/** Ledge tiles by the direction they drop toward: 0 south, 1 east, 2 north, 3 west, as the field numbers directions. */
export const LEDGE: Record<string, number> = { ';': 0, '>': 1, '^': 2, '<': 3 };

/** Ground a crease can run across. */
const GROUND = new Set(['.', ',', '=', 's', 'n', '_', 'x', 'g', 'b', 'G', 'I']);

/** The shapes each region uses. Every field names a painter below. */
interface Kit {
  base: string; marks: string; debris: string; grass: string; path: string; floor: string;
  wall: string; tree: string; roof: string; house: string; fence: string; bush: string;
  /** Palette letter for the Stay's one color. */
  stay: string;
  /** Palette letter for the cowrie doors. */
  door: string;
}

const kit = (base: string, marks: string, debris: string, grass: string, path: string, floor: string, wall: string, tree: string,
  roof: string, house: string, fence: string, bush: string, stay: string, door: string): Kit =>
  ({ base, marks, debris, grass, path, floor, wall, tree, roof, house, fence, bush, stay, door });

const KIT: Record<Style, Kit> = {
  fell: kit('meadow', 't...d...n..t...f', 'p', 'wheat', 'spiral', 'plank', 'stone', 'round', 'conch', 'pearl', 'coral', 'round', 'a', 'x'),
  rib: kit('nacre', 'd...e...c...d..a', 'e', 'coral', 'spiral', 'porcelain', 'ribs', 'coral', 'conch', 'nacre', 'bone', 'coral', 'a', 'a'),
  mast: kit('salt', 'd...S...k...c...', 'S', 'seagrass', 'board', 'deck', 'strata', 'drift', 'scallop', 'hull', 'coral', 'coral', 'a', 'a'),
  spire: kit('meadow', 't...d...b...a...', 'a', 'reed', 'spiral', 'flag', 'slate', 'spiral', 'turret', 'slate', 'iron', 'round', 'a', 'x'),
  bole: kit('mossgrid', 'r...d...u...t...', 'r', 'fern', 'rings', 'rings', 'bark', 'inverted', 'snail', 'bark', 'root', 'round', 'tr', 'x'),
  hum: kit('panel', 'o...d...A...F...', 'o', 'wire', 'grate', 'grate', 'steel', 'spiral', 'nautilus', 'steel', 'rail', 'round', 'a', 'a'),
  tusk: kit('snow', 'z...d...y...z...', 'y', 'frost', 'tracks', 'ivory', 'ivory', 'pine', 'scrim', 'ivory', 'tusk', 'round', 'w', 'a'),
  hilt: kit('loam', 'F...d...R...p...', 'R', 'dead', 'plate', 'plate', 'iron', 'dead', 'nautilus', 'iron', 'iron', 'round', 'a', 'x'),
  fall: kit('lean', 's...d...g...d...', 'g', 'crystal', 'star', 'star', 'violet', 'crystal', 'facet', 'violet', 'shard', 'crystal', 'a', 'x'),
  crown: kit('nacre', 'd...c...d...a...', 'c', 'clipped', 'spiral', 'check', 'china', 'spiral', 'conch', 'china', 'china', 'round', 'a', 'x'),
  slack: kit('wrinkle', 'w...d...e...p...', 'p', 'gray', 'rind', 'rind', 'rind', 'dead', 'rind', 'rider', 'post', 'round', 'a', 'x'),
  den: kit('meadow', 'd...............', 'p', 'wheat', 'spiral', 'plank', 'wood', 'round', 'conch', 'pearl', 'post', 'round', 'a', 'x'),
  under: kit('earth', 'r...p...x...d...', 'p', 'roothair', 'earth', 'earth', 'cave', 'rootcol', 'snail', 'bark', 'root', 'round', 'a', 'x'),
  knuckle: kit('meadow', 't...e...d...a...', 'e', 'wheat', 'spiral', 'porcelain', 'ribs', 'coral', 'conch', 'china', 'bone', 'round', 'a', 'a'),
  wreck: kit('ripple', 'k...S...p...c...', 'S', 'seagrass', 'board', 'deck', 'hull', 'drift', 'scallop', 'hull', 'coral', 'coral', 'a', 'a'),
  shore: kit('ripple', 'k...c...d...f...', 'c', 'seagrass', 'board', 'deck', 'still', 'drift', 'scallop', 'hull', 'coral', 'coral', 'a', 'a'),
  bell: kit('flag', 'd...a...b...d...', 'a', 'reed', 'spiral', 'flag', 'slate', 'spiral', 'turret', 'slate', 'iron', 'round', 'a', 'x'),
  root: kit('earth', 'r...u...d...r...', 'r', 'fern', 'earth', 'rings', 'roots', 'rootlog', 'snail', 'bark', 'root', 'round', 'a', 'x'),
  skin: kit('ash', 'l...d...o...p...', 'o', 'crystal', 'earth', 'grate', 'husk', 'dead', 'nautilus', 'steel', 'rail', 'round', 'a', 'x'),
  ice: kit('ice', 'i...d...z...d...', 'y', 'frost', 'tracks', 'ivory', 'icewall', 'pine', 'scrim', 'ivory', 'tusk', 'iceblock', 'w', 'a'),
  blade: kit('trample', 'P...F...t...d...', 'F', 'dead', 'plate', 'plate', 'iron', 'dead', 'nautilus', 'iron', 'iron', 'round', 'a', 'x'),
  moon: kit('silt', 'm...d...c...s...', 'm', 'reed', 'star', 'star', 'silt', 'crystal', 'facet', 'violet', 'shard', 'crystal', 'a', 'x'),
  glass: kit('glass', 's...d...l...d...', 'g', 'crystal', 'sand', 'star', 'glassridge', 'crystal', 'facet', 'violet', 'shard', 'crystal', 'a', 'x'),
  orchard: kit('lawn', 't...Q...d...t...', 'Q', 'clipped', 'gravel', 'check', 'china', 'fruit', 'conch', 'china', 'china', 'round', 'a', 'x'),
  margin: kit('blank', 'd.......x.......', 'p', 'outline', 'gravel', 'rind', 'outline', 'outline', 'rind', 'rider', 'post', 'outline', 'a', 'x'),
  strand: kit('nightsand', 'G...W...H...K...', 'K', 'weed', 'wet', 'plank', 'rock', 'wrack', 'whelk', 'shell', 'drift', 'round', 'a', 'x'),
  dollar: kit('testsand', 'd...G...W...d...', 'p', 'marram', 'petal', 'testfloor', 'test', 'pillar', 'petal', 'test', 'drift', 'round', 'a', 'a'),
  cowrie: kit('glaze', 'V.......N.......', 'V', 'crystal', 'mirror', 'mirror', 'glazewall', 'tooth', 'cowrie', 'test', 'china', 'round', 'a', 'x'),
  auger: kit('whorlfloor', 'd...r...G...d...', 'p', 'gray', 'ledge', 'ledge', 'augerwall', 'columella', 'turret', 'slate', 'iron', 'round', 'a', 'x'),
  nautilus: kit('iridescent', 'N...d...N...d...', 'N', 'fern', 'nacre', 'nacre', 'septum', 'pillar', 'nautilus', 'nacre', 'rail', 'round', 'a', 'x'),
  tray: kit('traysand', 'd...G...d...W...', 'p', 'marram', 'gravel', 'rind', 'dune', 'marram', 'whelk', 'shell', 'whitepost', 'round', 'a', 'x'),
  conch: kit('iridescent', 'N...d...N...V...', 'N', 'coral', 'nacre', 'nacre', 'conchwall', 'curl', 'conch', 'nacre', 'coral', 'coral', 'a', 'x'),
  whorl: kit('growth', 'B.......Z...d...', 'B', 'gray', 'spiral', 'ivory', 'ridge', 'barnacles', 'snail', 'ivory', 'post', 'round', 'a', 'x'),
  coast: kit('ripple', 'c...k...d...S...', 'c', 'marram', 'sand', 'deck', 'strata', 'drift', 'scallop', 'hull', 'drift', 'coral', 'a', 'a'),
  wood: kit('loam', 't...r...d...u...', 'r', 'fern', 'earth', 'plank', 'stone', 'round', 'conch', 'pearl', 'post', 'round', 'a', 'x'),
  // The Gate Ring's wood, with the Apex as a layered cliff in the middle.
  ringwood: kit('loam', 't...r...d...u...', 'r', 'fern', 'earth', 'plank', 'strata', 'round', 'conch', 'pearl', 'post', 'round', 'a', 'x'),
  // The geode under the crater fields: druse floor, banded agate walls, and amethyst clusters.
  geode: kit('druse', 's...d...g...d...', 'g', 'crystal', 'star', 'star', 'agate', 'cluster', 'facet', 'violet', 'shard', 'crystal', 'a', 'x'),
};

/** The painter names a region uses for its ground, grass, paths, and floors, for footsteps to read. */
export function groundKit(style: Style): { base: string; grass: string; path: string; floor: string } {
  const k = KIT[style];
  return { base: k.base, grass: k.grass, path: k.path, floor: k.floor };
}

// ---------------------------------------------------------------- the atlas

const CELLS_X = 256, CELLS_Y = 128;
let atlas: HTMLCanvasElement | null = null;
let A: CanvasRenderingContext2D;
let nextCell = 0;
const cells = new Map<string, number>();
/** Where the cell being painted sits in the atlas. */
let OX = 0, OY = 0;

function cell(key: string, paint: () => void): number {
  let c = cells.get(key);
  if (c !== undefined) return c;
  if (!atlas) {
    atlas = document.createElement('canvas');
    atlas.width = CELLS_X * 8; atlas.height = CELLS_Y * 8;
    A = atlas.getContext('2d')!;
  }
  if (nextCell >= CELLS_X * CELLS_Y) { cells.clear(); nextCell = 0; A.clearRect(0, 0, atlas.width, atlas.height); }
  c = nextCell++;
  OX = (c % CELLS_X) * 8; OY = Math.floor(c / CELLS_X) * 8;
  paint();
  cells.set(key, c);
  return c;
}

const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** A rectangle inside the current 8 by 8 cell. Anything outside the cell is cut off. */
function R(x: number, y: number, w: number, h: number, c: string): void {
  const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(8, x + w), y1 = Math.min(8, y + h);
  if (x1 <= x0 || y1 <= y0) return;
  A.fillStyle = c;
  A.fillRect(OX + x0, OY + y0, x1 - x0, y1 - y0);
}
function P(x: number, y: number, c: string): void { R(x, y, 1, 1, c); }
/** Ordered dither inside the cell. The pattern lines up across cells because cells sit on the world's 8 pixel grid. */
function D(x: number, y: number, w: number, h: number, c: string, lv: number): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (BAY[(j & 3) * 4 + (i & 3)] < lv * 16) P(i, j, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: string): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) P(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c);
}

/** One palette letter to a color. */
function cc(p: Pal, k: string): string | null {
  switch (k) {
    case 'k': return INK;
    case 'g': return p.g; case 'h': return p.g2; case 'l': return p.g3; case 'p': return p.path;
    case 'w': return p.w; case 'W': return p.w2; case 'r': return p.roof;
    case 'a': return p.a; case 'x': return p.x;
    case 'o': return p.wt; case 'O': return p.wt2;
    case 't': return p.tr; case 'T': return p.tr2;
    case 'i': return p.hi;
  }
  return null;
}
function col(p: Pal, k: string): string { return k === 'tr' ? p.tr : cc(p, k) || p.a; }

/** A small picture in palette letters. '.' leaves the cell as it is. */
function bm(p: Pal, rows: string[], dx = 0, dy = 0, flip = false): void {
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) {
      const c = cc(p, row[i]);
      if (c) P(dx + (flip ? row.length - 1 - i : i), dy + j, c);
    }
  }
}

type Rand = (n: number) => number;
function rng(seed: number): Rand {
  let s = (Math.imul(seed + 1, 2654435761) ^ 0x5bd1e995) >>> 0 || 1;
  return (n: number) => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s % n; };
}

/** Hash for per-tile variation that stays put frame to frame. */
function hh(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** A spiral line on a square grid, one pixel thick. */
function spiral(size: number, turn: number): Uint8Array {
  const m = new Uint8Array(size * size), c = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x + 0.5 - c, dy = y + 0.5 - c, r = Math.hypot(dx, dy);
    const th = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI);
    const f = (((r / turn - th) % 1) + 1) % 1;
    if (r < c && f < 1.05 / turn + 0.08) m[y * size + x] = 1;
  }
  return m;
}
const SP16 = spiral(16, 3.4);
const SP8 = spiral(8, 2.2);
const SP5 = spiral(5, 1.6);

function spiralAt(m: Uint8Array, size: number, x: number, y: number, c: string, ox = 0, oy = 0): void {
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) if (m[j * size + i]) P(x + i - ox, y + j - oy, c);
}

// ---------------------------------------------------------------- neighbors

const CLS: Record<string, string> = { d: 'h', Z: 'z', ':': '~', '&': '~', '*': '~', '+': '~' };
const cls = (ch: string) => CLS[ch] || ch;
/** Map edges count as more of the same for these, so border walls and woods stay solid. */
const EDGE_SAME = new Set(['#', 'T', '~', 'v', 'Y', 'k', 'M', 'R']);
const RUNS = new Set(['r', 'h', 'd']);

let memoMap: unknown = null;
let memoT = 0;
const memo = new Map<number, number>();

function nt(x: number, y: number): string {
  const rows = field.map.rows;
  if (y < 0 || y >= rows.length || x < 0 || x >= rows[0].length) return '';
  return field.tile(x, y);
}

/**
 * Packs what a tile needs to know about its neighbors.
 * Bits 0 to 3: the same kind above, right, below, left. Bits 4 to 7: column in a house. Bits 8 to 11: house width.
 * Bits 12 to 13: roof row. Bits 14 to 15: roof height. Bit 16: an empty house with no door. Bits 17 to 18: a per-house number.
 */
function info(ch: string, tx: number, ty: number, t: number): number {
  if (field.map !== memoMap || t < memoT || t - memoT > 30) { memo.clear(); memoMap = field.map; memoT = t; }
  const key = (ty * 4096 + tx) * 128 + ch.charCodeAt(0);
  const got = memo.get(key);
  if (got !== undefined) return got;
  const c = cls(ch), edge = EDGE_SAME.has(c);
  const same = ch === 'L'
    ? (x: number, y: number) => { const o = nt(x, y); return o === 'L' || o === 'R' || o === 'Q'; }
    : (x: number, y: number) => { const o = nt(x, y); return o === '' ? edge : cls(o) === c; };
  let v = (same(tx, ty - 1) ? 1 : 0) | (same(tx + 1, ty) ? 2 : 0) | (same(tx, ty + 1) ? 4 : 0) | (same(tx - 1, ty) ? 8 : 0);
  if (RUNS.has(ch)) {
    let x0 = tx, x1 = tx;
    while (x0 > 0 && cls(nt(x0 - 1, ty)) === c) x0--;
    while (cls(nt(x1 + 1, ty)) === c && x1 - x0 < 30) x1++;
    let wallY = ty, j = 0, m = 1;
    if (ch === 'r') {
      let top = ty;
      while (nt(tx, top - 1) === 'r' && ty - top < 3) top--;
      while (nt(tx, wallY) === 'r' && wallY - ty < 4) wallY++;
      j = ty - top; m = wallY - top;
    }
    let door = false, wall = false;
    for (let x = x0; x <= x1; x++) { const o = nt(x, wallY); if (o === 'd') door = true; if (o === 'h' || o === 'd') wall = true; }
    v |= Math.min(15, tx - x0) << 4 | Math.min(15, x1 - x0 + 1) << 8 | Math.min(3, j) << 12 | Math.min(3, m) << 14;
    // Some houses with no door are empty shells, outgrown and left beside the lived-in ones.
    if (wall && !door && (field.map.oldShells || (hh(x0, wallY) >> 4) % 3 === 0)) v |= 1 << 16;
    v |= (hh(x0, wallY) & 3) << 17;
  }
  memo.set(key, v);
  return v;
}

/** Crack edges shared by neighboring tiles, so crust and ice patterns join up. */
function netBits(tx: number, ty: number): number {
  const e = (x: number, y: number, k: number) => (hh(x * 3 + k, y * 5 + 11 * k) % 10) < 6;
  return (e(tx, ty - 1, 1) ? 1 : 0) | (e(tx, ty, 2) ? 2 : 0) | (e(tx, ty, 1) ? 4 : 0) | (e(tx - 1, ty, 2) ? 8 : 0);
}

// ---------------------------------------------------------------- ground

function network(net: number, c: string, sh: string): void {
  if (!net) return;
  const segs: number[][][] = [
    [[3, 4], [4, 2], [3, 0]], [[3, 4], [5, 5], [7, 4]], [[3, 4], [2, 6], [3, 7]], [[3, 4], [1, 3], [0, 4]],
  ];
  for (let k = 0; k < 4; k++) if (net & (1 << k)) {
    const s = segs[k];
    for (let i = 1; i < s.length; i++) { line(s[i - 1][0], s[i - 1][1] + 1, s[i][0], s[i][1] + 1, sh); }
  }
  for (let k = 0; k < 4; k++) if (net & (1 << k)) {
    const s = segs[k];
    for (let i = 1; i < s.length; i++) line(s[i - 1][0], s[i - 1][1], s[i][0], s[i][1], c);
  }
}

const WAVE16 = [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, -1, -1, -1, -1, -1];

function base(p: Pal, k: Kit, v: number, net: number, gx: number, gy: number): void {
  const r = rng(v * 31 + 7);
  R(0, 0, 8, 8, p.g);
  switch (k.base) {
    case 'meadow': P(r(8), r(8), p.g2); P(r(8), r(8), p.g3); P(r(8), r(8), p.g2); break;
    case 'ripple': case 'silt': {
      for (const y0 of [1 + gy * 2, 5 + gy * 2]) {
        if (y0 > 7) continue;
        const gap = (v >> 2) & 3;
        for (let x = 0; x < 8; x++) {
          if (gap === 1 && x > 4 && y0 > 4) continue;
          const y = y0 + WAVE16[(x + gx * 8) & 15];
          P(x, y, p.g2);
          if (k.base === 'ripple') P(x, y - 1, p.g3);
        }
      }
      break;
    }
    case 'salt': network(net, p.hi, p.g3); if (v & 1) P(r(8), r(8), p.g2); break;
    case 'nacre': {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const s = (x + gx * 8 + y + gy * 8 * 3) % 16;
        if (s < 3 && BAY[(y & 3) * 4 + (x & 3)] < 8) P(x, y, p.g3);
        else if (s === 3 && BAY[(y & 3) * 4 + (x & 3)] < 4) P(x, y, p.hi);
      }
      if (v % 5 === 0) P(r(8), r(8), p.a);
      break;
    }
    case 'mossgrid':
      for (const cy of [0, 4]) for (const cx of [0, 4]) {
        if ((v >> ((cx + cy) >> 1)) & 1 && v % 3 === 0) continue;
        R(cx + 1, cy + 1, 2, 2, p.g3);
        P(cx + 2, cy + 2, p.g2);
      }
      break;
    case 'panel':
      D(0, 0, 8, 8, p.g2, 0.1875);
      if (!gx && !gy) { P(2, 2, p.g3); P(2, 1, p.hi); }
      if (gx && gy) { R(5, 5, 2, 1, p.g3); }
      break;
    case 'snow':
      if (v & 1) { P(1 + (v % 4), 4, p.g2); P(2 + (v % 4), 3, p.g2); P(3 + (v % 4), 3, p.g2); P(4 + (v % 4), 4, p.g2); }
      if (v % 3 === 0) P(r(8), r(8), p.a);
      P(r(8), r(8), p.g2);
      break;
    case 'loam': D(0, 0, 8, 8, p.g2, 0.125); P(r(8), r(8), p.g3); if (v % 4 === 0) P(r(8), r(8), p.a); break;
    case 'lean': P(r(6), 2 + r(4), p.g2); { const x = r(5), y = r(5); line(x, y, x + 2, y + 2, p.g2); } P(r(8), r(8), p.g3); break;
    case 'wrinkle': { const y0 = 2 + (v % 4); for (let x = 0; x < 8; x++) P(x, y0 + WAVE16[(x * 2 + gx * 16) & 15], p.g2); P(r(8), r(8), p.g3); break; }
    case 'earth': R(r(7), r(8), 2, 1, p.g2); R(r(7), r(8), 2, 1, p.g2); P(r(8), r(8), p.g3); P(r(8), r(8), p.g3); break;
    case 'ash': D(0, 0, 8, 8, p.g2, 0.25); P(r(8), r(8), p.g3); break;
    case 'ice': if (v % 4 === 0) D(1, 1, 5, 4, p.g2, 0.5); network(net, p.hi, p.g2); break;
    case 'trample': R(r(6), r(8), 3, 1, p.g2); R(r(6), r(8), 2, 1, p.g2); P(r(8), r(8), p.g3); break;
    case 'glass': network(net, p.g3, p.g2); if (v % 7 === 0 && net) P(4, 3, p.x); else if (v % 3 === 0) P(3, 4, p.hi); break;
    case 'lawn': if (!gx) D(0, 0, 8, 8, p.g3, 0.25); P(r(8), r(8), p.g2); break;
    case 'blank': if (v % 5 === 0) P(r(8), r(8), p.g2); break;
    case 'nightsand':
      // Low ripples the last wave left, broken up so the beach never tiles.
      if (v & 1) {
        const y0 = 2 + ((v >> 1) & 3);
        for (let x = 0; x < 8; x++) {
          if (((x + gx * 8 + v) % 13) < 4) continue;
          const y = y0 + WAVE16[(x + gx * 8) & 15];
          P(x, y, p.g2); P(x, y - 1, p.g3);
        }
      }
      if (v % 7 === 3) P(r(8), r(8), p.g3);
      if (v % 11 === 0) P(r(8), r(8), p.x);
      break;
    case 'testsand':
      P(r(8), r(8), p.g2); P(r(8), r(8), p.g3);
      if (v % 3 === 0) R(r(6), r(8), 2, 1, p.g2);
      break;
    case 'glaze': {
      // Polish deep enough to mirror: one hard diagonal shine and the soft reflection of a spot.
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const s = ((x + gx * 8) + (y + gy * 8) * 2 + 64) % 24;
        if (s === 0) P(x, y, p.hi); else if (s < 3 && BAY[(y & 3) * 4 + (x & 3)] < 8) P(x, y, p.g3);
      }
      if (v % 5 === 0) D(1 + r(4), 1 + r(4), 3, 2, p.g2, 0.5);
      break;
    }
    case 'whorlfloor':
      // The inside of a spiral: ridges run on a slant and climb.
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const s = ((x + gx * 8) + (y + gy * 8) * 2) % 8;
        if (s === 0) P(x, y, p.g2); else if (s === 7) P(x, y, p.g3);
      }
      break;
    case 'iridescent':
      // Nacre with a sheen that turns from pale to the region's surprise color along each band.
      for (let x = 0; x < 8; x++) {
        const X = x + gx * 8;
        for (const b of [0, 8]) {
          const y = ((b + 16 - Math.round(X * 0.6) - gy * 8) % 16 + 16) % 16;
          if (y < 8) { P(x, y, p.g3); if (y + 1 < 8 && (X & 1)) P(x, y + 1, p.x); }
        }
      }
      if (v % 6 === 0) P(r(8), r(8), p.g2);
      break;
    case 'traysand':
      if (v % 2 === 0) P(r(8), r(8), p.g2);
      if (v % 3 === 0) P(r(8), r(8), p.g3);
      break;
    case 'growth':
      // Growth lines on the outside of a shell: each is where the lip once stood.
      for (let x = 0; x < 8; x++) {
        const y = ((x + gx * 8) >> 2) % 2 + 3 + WAVE16[(x * 2 + gy * 7) & 15];
        P(x, y, p.g2); P(x, y + 1, p.g3);
      }
      if (v % 4 === 0) { const y = r(3); for (let x = 0; x < 8; x++) if ((x + v) % 3) P(x, y, p.g2); }
      break;
    case 'druse':
      // A geode's lining: dark stone furred with tiny crystal points that catch the light.
      D(0, 0, 8, 8, p.g2, 0.1875);
      if (v % 3 === 0) bm(p, ['.i.', 'lgl'], r(6), r(6));
      else if (v % 3 === 1) { const x = r(7), y = r(7); P(x, y, p.g3); P(x + 1, y + 1, p.hi); }
      if (v % 7 === 0) P(r(8), r(8), p.x);
      break;
    case 'flag': {
      const split = gy ? 4 : 0;
      R(0, 0, 8, 1, p.g2); R(split, 0, 1, 8, p.g2);
      P(split + 1, 1, p.g3); P(split + 2, 1, p.g3);
      if (v % 4 === 0) P(r(8), 2 + r(5), p.a);
      break;
    }
  }
}

/** Visual law: taut ground shows a faint grid. The grid breaks up as Stays loosen. */
function grid(p: Pal, gx: number, gy: number, sl: number): void {
  if (sl >= 3) return;
  const c = p.g2, step = sl === 0 ? 2 : 4;
  if (sl < 2) { for (let i = 0; i < 8; i += step) { if (!gy) P(i, 0, c); if (!gx) P(0, i, c); } }
  else if (!gx && !gy) { R(0, 0, 2, 1, c); R(0, 0, 1, 2, c); }
}

function mark(m: string, p: Pal, x: number, y: number): void {
  switch (m) {
    case 't': P(x, y + 1, p.g2); P(x + 1, y, p.g2); P(x + 2, y + 1, p.g2); P(x + 3, y, p.g2); P(x + 1, y - 1, p.g3); break;
    case 'd': P(x, y, p.g2); P(x + 2, y + 1, p.g3); break;
    case 'p': R(x, y, 2, 1, p.g3); R(x, y + 1, 3, 1, p.g2); P(x + 2, y, p.g2); break;
    case 'c': bm(p, ['.aa.', 'aiaa', '.aW.'], x, y); break;
    case 'n': bm(p, ['.ww', 'wiW', 'wWW'], x, y); break;
    case 'S': bm(p, ['aiaia', 'aiaia', '.aaa.', '..W..'], x - 1, y - 1); break;
    case 'f': bm(p, ['..a..', 'aaiaa', '.aaa.', '.a.a.'], x - 1, y - 1); break;
    case 'a': spiralAt(SP5, 5, x - 1, y - 1, p.g2); break;
    case 'q': P(x, y, p.x); P(x + 1, y, p.x); P(x, y + 1, p.x); P(x + 1, y + 1, p.hi); break;
    case 'b': bm(p, ['.xxx.', 'xxixx', 'xWxxx', 'hhhhh'], x - 1, y - 1); break;
    case 'r': bm(p, ['ww.', '..w', '.w.'], x, y); break;
    case 'u': bm(p, ['xxx', 'xix', '.i.'], x, y); break;
    case 'o': P(x, y, p.hi); P(x + 3, y, p.hi); R(x + 1, y + 2, 2, 1, p.g2); break;
    case 'A': P(x, y, p.a); P(x, y + 1, p.g2); break;
    case 'F': P(x, y, p.w2); P(x + 2, y + 1, p.w2); P(x + 1, y + 2, p.w2); P(x + 3, y + 2, p.w); break;
    case 'y': bm(p, ['wwwww', 'wWWWw', 'wWWWw', 'wwwww'], x - 1, y - 1); break;
    case 'z': P(x, y + 1, p.g2); P(x + 1, y, p.g2); P(x + 2, y, p.g2); P(x + 3, y + 1, p.g2); P(x + 4, y + 1, p.g2); break;
    case 'R': bm(p, ['.hah.', 'haxah', '.aah.', '..h..'], x - 1, y - 1); break;
    case 'g': bm(p, ['i..', 'xi.', 'xxa'], x, y); break;
    case 's': bm(p, ['.a.', 'aia', '.a.'], x, y); break;
    case 'w': P(x, y, p.g2); P(x + 1, y + 1, p.g2); P(x + 2, y + 1, p.g2); P(x + 3, y, p.g2); break;
    case 'P': bm(p, ['xx.', 'xxx', '.t.', '.t.'], x, y - 1); break;
    case 'e': bm(p, ['i...i', 'iiiii', 'i...i'], x - 1, y); break;
    case 'm': bm(p, ['.aa', 'a..', 'a..', '.aa'], x, y - 1); break;
    case 'i': line(x - 1, y, x + 1, y + 1, p.g2); line(x + 1, y + 1, x + 4, y, p.g2); break;
    case 'l': R(x, y, 2, 1, p.g3); P(x, y + 1, p.g2); break;
    case 'Q': bm(p, ['.t', 'xx', 'xx'], x, y - 1); break;
    case 'x': P(x, y, p.x); break;
    case 'k': bm(p, ['i.i.i', 'iiiii', 'i.i.i'], x - 1, y); break;
    // Strand marks: a star grain, a worm cast, a razor hole, a knot of black weed, a spot, a nacre fleck, a barnacle.
    case 'G': P(x, y, p.a); P(x + 1, y + 1, p.g3); break;
    case 'W': bm(p, ['.hh', 'h.l', '.hh', 'l..'], x, y - 1); break;
    case 'H': P(x, y, p.w2); P(x, y + 1, p.w2); P(x + 1, y + 1, p.g3); break;
    case 'K': bm(p, ['.T..T', 'TtTtT', '.TlT.'], x - 1, y - 1); break;
    case 'V': bm(p, ['.h.', 'hhh', '.h.'], x, y); break;
    case 'Z': bm(p, ['w...w...', '.w.w.w.w', '..w...w.'], x - 2, y); break;
    case 'N': P(x, y, p.x); P(x + 1, y, p.g3); P(x, y + 1, p.g3); break;
    case 'B': bm(p, ['.tt.', 'tkkt', 'tttt'], x - 1, y - 1); P(x, y - 1, p.hi); break;
  }
}

function ground(p: Pal, k: Kit, v: number, net: number, gx: number, gy: number, sl: number, marks = true): void {
  base(p, k, v, net, gx, gy);
  if (!UNHELD.has(p.style)) grid(p, gx, gy, sl);
  if (marks) {
    const m = k.marks[v & 15];
    if (m && m !== '.') { const r = rng(v * 13 + 5); mark(m, p, 2 + r(4), 2 + r(4)); }
  }
}

function grass(p: Pal, k: Kit, v: number): void {
  const r = rng(v * 17 + 3);
  switch (k.grass) {
    case 'wheat': case 'reed': case 'fern': case 'frost': case 'dead': case 'wire': case 'seagrass': case 'gray': case 'roothair': {
      const stem = k.grass === 'dead' || k.grass === 'gray' ? p.g2 : k.grass === 'wire' ? p.g3 : k.grass === 'roothair' ? p.tr : p.tr;
      const dark = k.grass === 'dead' ? p.w2 : k.grass === 'wire' ? p.w2 : p.tr2;
      const head = k.grass === 'reed' ? p.x : k.grass === 'frost' ? p.hi : k.grass === 'wire' ? p.a : k.grass === 'seagrass' ? p.tr2 : p.g3;
      R(0, 7, 8, 1, dark);
      for (let i = 0; i < 4; i++) {
        const x = i * 2 + (r(2)), top = 1 + r(3);
        const lean = k.grass === 'seagrass' ? (i & 1 ? 1 : -1) : 0;
        for (let y = top; y < 7; y++) P(x + (lean && y < 4 ? lean : 0), y, y > 5 ? dark : stem);
        P(x, top - 1, head);
        if (k.grass === 'reed') P(x, top, head);
        if (k.grass === 'fern') { P(x - 1, top + 2, stem); P(x + 1, top + 3, stem); }
      }
      break;
    }
    case 'coral':
      R(0, 7, 8, 1, p.w2);
      for (const x0 of [1, 5]) {
        const h = 3 + r(2);
        R(x0, 7 - h, 1, h, p.a);
        P(x0 - 1, 5 - r(2), p.a); P(x0 - 1, 4 - r(2), p.a);
        P(x0 + 1, 4, p.a); P(x0 + 1, 3, p.hi);
        P(x0, 7 - h - 1, p.hi);
      }
      P(3, 5, p.x);
      break;
    case 'crystal':
      for (const x0 of [0, 3, 6]) {
        const h = 3 + r(3);
        R(x0, 8 - h, 2, h, p.g3);
        R(x0 + 1, 8 - h, 1, h, p.g2);
        P(x0, 8 - h - 1, p.hi);
      }
      if (v % 4 === 0) P(r(8), r(4), p.x);
      break;
    case 'clipped':
      for (const cy of [1, 5]) for (const cx of [1, 5]) { R(cx, cy, 3, 2, p.tr); P(cx, cy, p.g3); P(cx + 2, cy + 1, p.tr2); }
      break;
    case 'outline':
      for (const x0 of [1, 4, 6]) { P(x0, 4 + r(2), p.w2); P(x0, 6, p.w2); }
      break;
    case 'weed':
      // Black wrack: ribbons that kink, with bladders that catch the starlight.
      R(0, 7, 8, 1, p.tr2);
      for (let i = 0; i < 4; i++) {
        const x = i * 2 + r(2), top = 1 + r(3);
        for (let y = top; y < 7; y++) P(x + (WAVE16[(y * 4 + i * 5) & 15] > 0 ? 1 : 0), y, y > 5 ? p.tr2 : p.tr);
        P(x, top + 2, p.g3);
        if (i === 1 && v % 3 === 0) P(x + 1, top, p.x);
      }
      break;
    case 'marram':
      R(0, 7, 8, 1, p.g2);
      for (let i = 0; i < 4; i++) {
        const x = i * 2 + r(2), top = r(3);
        for (let y = top; y < 7; y++) P(x + (y < 3 ? 1 : 0), y, y > 5 ? p.tr2 : p.tr);
        P(x + 1, top - 1, p.g3);
      }
      break;
  }
}

function path(p: Pal, k: Kit, nb: number, v: number, gx: number, gy: number, sl: number): void {
  const r = rng(v * 23 + 1);
  R(0, 0, 8, 8, p.path);
  switch (k.path) {
    case 'spiral': {
      const lc = p.style === 'crown' ? p.x : p.style === 'rib' ? p.a : p.g2;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (SP16[(gy * 8 + y) * 16 + gx * 8 + x]) P(x, y, lc);
      if (gx && gy) P(0, 0, p.hi);
      if (!gx && !gy) { P(7, 7, p.a); }
      break;
    }
    case 'board': {
      const horiz = (nb & 10) && !(nb & 5);
      for (let i = 0; i < 8; i += 3) horiz ? R(i, 0, 1, 8, p.w2) : R(0, i, 8, 1, p.w2);
      for (let i = 1; i < 8; i += 3) horiz ? P(i, 1 + r(5), p.g3) : P(1 + r(5), i, p.g3);
      break;
    }
    case 'rings':
      for (const [cx, cy] of [[2, 2], [5, 5]]) { bm(p, ['.hh.', 'hlah', 'hall', '.hh.'], cx - 2 + (gx && cy === 2 ? 1 : 0), cy - 2); }
      break;
    case 'grate':
      for (let y = 1; y < 8; y += 2) for (let x = (y & 2) ? 0 : 2; x < 8; x += 4) R(x, y, 2, 1, p.w2);
      break;
    case 'tracks':
      if (v & 1) { R(1, 1, 2, 2, p.g2); R(4, 4, 2, 2, p.g2); } else { R(5, 0, 2, 2, p.g2); R(2, 4, 2, 2, p.g2); }
      P(r(8), r(8), p.hi);
      break;
    case 'plate':
      R(0, 7, 8, 1, p.g2); R(7, 0, 1, 8, p.g2);
      P(1, 1, p.g3); P(5, 1, p.g3); P(1, 5, p.g3); P(5, 5, p.g3);
      if (v % 3 === 0) bm(p, ['.a', 'ax'], 3, 3);
      break;
    case 'star':
      R(0, 0, 8, 1, p.g3); R(0, 0, 1, 8, p.g3);
      bm(p, ['.a.', 'aia', '.a.'], 3, 3);
      if (v % 4 === 0) P(6, 1, p.x);
      break;
    case 'rind': line(r(3), r(8), 4 + r(4), r(8), p.g2); break;
    case 'gravel': for (let i = 0; i < 6; i++) P(r(8), r(8), i & 1 ? p.g2 : p.hi); break;
    case 'sand': for (let i = 0; i < 4; i++) P(r(8), r(8), i & 1 ? p.g2 : p.hi); break;
    case 'earth': R(r(6), r(8), 3, 1, p.g2); P(r(8), r(8), p.g3); P(r(8), r(8), p.g2); break;
    case 'wet':
      // Wet sand holds the sky: a dithered sheen and the odd reflected star.
      for (let y = 1; y < 8; y += 3) D(0, y, 8, 1, p.g2, 0.5);
      if (v % 3 === 0) { const x = 1 + r(6), y = 1 + r(6); P(x, y, p.hi); P(x + 1, y, p.a); }
      break;
    case 'petal':
      // Light through a petal of the test, with its row of pores.
      D(0, 0, 8, 8, p.hi, 0.25);
      for (let y = gx; y < 8; y += 2) P(gy ? 6 : 1, y, p.g3);
      if (v % 4 === 0) P(3 + r(2), 3 + r(2), p.x);
      break;
    case 'mirror': floor(p, k, v, gx, gy); break;
    case 'ledge':
      for (let y = 2; y < 8; y += 3) { R(0, y, 8, 1, p.g2); R(0, y - 1, 8, 1, p.g3); }
      if (v % 3 === 0) P(r(8), r(2), p.hi);
      break;
    case 'nacre':
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const s = ((x + gx * 8) - (y + gy * 8) + 64) % 12;
        if (s === 0) P(x, y, p.hi); else if (s === 1 && BAY[(y & 3) * 4 + (x & 3)] < 8) P(x, y, p.x);
      }
      break;
  }
  // Edges where the path meets other ground.
  if (!(nb & 1)) R(0, 0, 8, 1, p.g2);
  if (!(nb & 4)) R(0, 7, 8, 1, p.g2);
  if (!(nb & 8)) R(0, 0, 1, 8, p.g2);
  if (!(nb & 2)) R(7, 0, 1, 8, p.g2);
  if (sl < 2 && !gy && (nb & 5) === 5 && k.path !== 'spiral') R(0, 0, 8, 1, p.g2);
}

function floor(p: Pal, k: Kit, v: number, gx: number, gy: number): void {
  const r = rng(v * 29 + 11);
  R(0, 0, 8, 8, p.path);
  switch (k.floor) {
    case 'plank': case 'deck': {
      for (let y = 0; y < 8; y += 2) R(0, y + 1, 8, 1, k.floor === 'deck' ? p.w2 : p.g2);
      const j = (gy * 3 + gx * 5 + (v & 3)) & 7;
      R(j, 0, 1, 1, p.g2); R((j + 4) & 7, 2, 1, 1, p.g2); R((j + 2) & 7, 4, 1, 1, p.g2); R((j + 6) & 7, 6, 1, 1, p.g2);
      if (k.floor === 'deck') { P(r(8), 0, p.hi); P(r(8), 4, p.hi); }
      break;
    }
    case 'porcelain': case 'ivory':
      R(0, 0, 8, 1, k.floor === 'ivory' ? p.w2 : p.a); R(0, 0, 1, 8, k.floor === 'ivory' ? p.w2 : p.a);
      if (v % 3 === 0) spiralAt(SP5, 5, 2, 2, k.floor === 'ivory' ? p.w2 : p.g2);
      else P(4, 4, p.hi);
      break;
    case 'flag': base(p, KIT.bell, v, 0, gx, gy); R(0, 0, 8, 8, p.path); R(0, 0, 8, 1, p.g2); R(gy ? 4 : 0, 0, 1, 8, p.g2); P((gy ? 5 : 1), 1, p.hi); if (v % 5 === 0) P(r(8), 3 + r(4), p.a); break;
    case 'rings': bm(p, ['.hhhh.', 'hllllh', 'hlhhlh', 'hlhalh', 'hllllh', '.hhhh.'], 1, 1); break;
    case 'grate': for (let y = 1; y < 8; y += 2) for (let x = 1; x < 8; x += 3) R(x, y, 2, 1, p.w2); R(0, 0, 8, 1, p.g3); break;
    case 'plate': R(0, 7, 8, 1, p.g2); R(7, 0, 1, 8, p.g2); P(1, 1, p.hi); P(5, 5, p.hi); if (v % 4 === 0) P(3, 3, p.a); break;
    case 'star': R(0, 0, 8, 1, p.g3); R(0, 0, 1, 8, p.g3); bm(p, ['.a.', 'aia', '.a.'], 3, 3); break;
    case 'check': if ((gx + gy) & 1) { R(0, 0, 8, 8, p.hi); spiralAt(SP5, 5, 2, 2, p.x); } else { R(0, 0, 8, 8, p.path); P(4, 4, p.a); } break;
    case 'rind': line(0, 3 + (v % 3), 7, 2 + (v % 4), p.g2); break;
    case 'earth': R(r(6), r(8), 3, 1, p.g2); P(r(8), r(8), p.g3); break;
    case 'testfloor':
      // Swept sand with the five-petal mark of the test pressed in every other tile.
      if ((gx ^ gy) === 0) bm(p, ['..h..', 'hh.hh', '..h..', '.h.h.'], 2, 2);
      else P(r(8), r(8), p.g3);
      break;
    case 'mirror': {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const s = ((x + gx * 8) + (y + gy * 8) * 2 + 64) % 24;
        if (s === 0) P(x, y, p.hi); else if (s < 3 && BAY[(y & 3) * 4 + (x & 3)] < 8) P(x, y, p.g3);
      }
      // The floor shows what stands on it a little late: a soft dithered double of a spot.
      if (v % 4 === 0) { D(2, 1, 3, 3, p.x, 0.5); P(3, 2, p.x); }
      R(0, 0, 8, 1, p.g3);
      break;
    }
    case 'ledge':
      for (let y = 2; y < 8; y += 3) { R(0, y, 8, 1, p.g2); R(0, y - 1, 8, 1, p.g3); }
      break;
    case 'nacre':
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const s = ((x + gx * 8) * 2 + (y + gy * 8) * 3) % 20;
        if (s < 2 && BAY[(y & 3) * 4 + (x & 3)] < 8) P(x, y, p.hi);
        else if (s === 2 && BAY[(y & 3) * 4 + (x & 3)] < 6) P(x, y, p.x);
      }
      R(0, 0, 8, 1, p.g3);
      break;
  }
}

// ---------------------------------------------------------------- walls

function wall(p: Pal, k: Kit, nb: number, v: number, gx: number, gy: number): void {
  const face = !(nb & 4), top = !(nb & 1);
  const r = rng(v * 37 + 2);
  if (!face) {
    // The top of a wall seen from above: lighter than the face, outlined where it ends.
    R(0, 0, 8, 8, k.wall === 'outline' ? p.hi : p.w);
    if (k.wall !== 'outline') {
      D(0, 0, 8, 8, p.w2, k.wall === 'cave' || k.wall === 'roots' ? 0.375 : 0.125);
      if (v % 3 === 0) { const x = r(7), y = r(7); R(x, y, 2, 1, p.hi); }
      if (k.wall === 'cave' && v % 4 === 0) P(r(8), r(8), p.x);
      if (k.wall === 'still') R(0, (v & 3) + 2, 8, 1, p.a);
      if ((k.wall === 'stone' || k.wall === 'slate' || k.wall === 'strata' || k.wall === 'ribs') && v % 7 === 0) spiralAt(SP5, 5, 1, 1, p.w2);
      wallTop(p, k, v, gx, gy);
    }
    if (!(nb & 8)) R(0, 0, 1, 8, p.w2);
    if (!(nb & 2)) R(7, 0, 1, 8, p.w2);
    if (top) R(0, 0, 8, 1, p.w2);
    return;
  }
  R(0, 0, 8, 8, p.w);
  switch (k.wall) {
    case 'stone': case 'slate': {
      const off = gy ? 0 : 3;
      R(0, 3, 8, 1, p.w2); R(0, 7, 8, 1, p.w2);
      P((off + 2) & 7, 0, p.w2); P((off + 2) & 7, 1, p.w2); P((off + 2) & 7, 2, p.w2);
      P((off + 6) & 7, 4, p.w2); P((off + 6) & 7, 5, p.w2); P((off + 6) & 7, 6, p.w2);
      P((off + 3) & 7, 0, p.hi); P((off + 7) & 7, 4, p.hi);
      if (k.wall === 'slate') { if (v % 3 === 0) { P((off + 2) & 7, 4, p.a); P((off + 2) & 7, 5, p.a); } }
      if (v % 6 === 0) spiralAt(SP5, 5, 1, 1, p.w2);
      break;
    }
    case 'ribs':
      D(0, 0, 8, 8, p.hi, 0.25);
      R(gx ? 5 : 1, 0, 2, 8, p.hi); R(gx ? 7 : 3, 0, 1, 8, p.g2);
      if (v % 4 === 0) spiralAt(SP5, 5, gx ? 0 : 4, 2, p.w2);
      break;
    case 'strata':
      R(0, 0, 8, 2, p.g3); R(0, 2, 8, 1, p.hi); R(0, 5, 8, 1, p.w2); R(0, 6, 8, 1, p.g2);
      if (v % 3 === 0) bm(p, ['.a.', 'aia'], 1 + r(4), 3);
      if (v % 5 === 0) spiralAt(SP5, 5, r(3), 2, p.w2);
      break;
    case 'bark':
      for (let x = (v & 1); x < 8; x += 3) for (let y = 0; y < 8; y++) P(x + ((y + x) % 4 === 0 ? 1 : 0), y, p.w2);
      if (v % 4 === 0) { R(3, 6, 3, 2, p.tr); P(4, 6, p.g3); }
      break;
    case 'steel':
      R(0, 0, 8, 1, p.hi); R(0, 7, 8, 1, p.w2); R(7, 0, 1, 8, p.w2);
      if (v % 3 !== 1) { P(2, 2, p.w2); P(5, 2, p.w2); R(2, 5, 4, 1, p.w2); P(2, 1, p.hi); P(5, 1, p.hi); }
      else { P(3, 3, p.a); P(4, 3, p.a); }
      break;
    case 'ivory':
      R(0, 7, 8, 1, p.w2); R(gy ? 3 : 7, 0, 1, 7, p.w2);
      if (v % 2 === 0) { for (let i = 0; i < 4; i++) R(1 + i, 2, 1, 3, p.w2); line(0, 5, 5, 1, p.w2); }
      else spiralAt(SP5, 5, 1, 1, p.w2);
      P(r(8), r(3), p.hi);
      break;
    case 'iron':
      R(0, 7, 8, 1, p.w2); R(0, 3, 8, 1, p.w2);
      P(1, 1, p.hi); P(6, 1, p.hi); P(1, 5, p.hi); P(6, 5, p.hi);
      if (v % 3 === 0) bm(p, ['.aa.', 'axaa', '.aa.', '..a.'], 2 + r(3), r(3));
      break;
    case 'violet':
      line(0, 7, 7 - (v & 3), 0, p.w2); line(3, 7, 7, 3, p.w2);
      if (v % 3 === 0) bm(p, ['i.', 'xi', 'xx'], 4, 2);
      P(r(8), r(8), p.roof);
      break;
    case 'china':
      R(0, 0, 8, 1, p.w2); R(0, 7, 8, 1, p.w2);
      R(0, 2, 8, 1, p.a);
      if ((gx + gy + v) & 1) spiralAt(SP5, 5, 1, 3, p.x); else { P(4, 4, p.x); P(3, 5, p.x); P(5, 5, p.x); }
      break;
    case 'rind':
      for (let y = 1; y < 8; y += 3) for (let x = 0; x < 8; x++) P(x, y + WAVE16[(x * 2 + y * 3) & 15], p.w2);
      break;
    case 'wood':
      for (let x = 0; x < 8; x += 4) R(x, 0, 1, 8, p.w2);
      R(0, 0, 8, 1, p.a); P(2, 3, p.g3); P(6, 5, p.g3);
      break;
    case 'cave':
      D(0, 0, 8, 8, p.w2, 0.375);
      for (let i = 0; i < 2; i++) { const x = r(8), h = 2 + r(5); R(x, 0, 1, h, p.tr2); if (v % 3 === 0) P(x, h, p.x); }
      break;
    case 'hull':
      for (let y = 1; y < 8; y += 2) R(0, y, 8, 1, p.w2);
      if (gy) { R(0, 4, 8, 4, p.x); R(0, 5, 8, 1, p.w2); }
      if (v % 4 === 0) { bm(p, ['.ii.', 'iOOi', 'iOOi', '.ii.'], 2, 0); }
      P(r(8), 6, p.hi);
      break;
    case 'still':
      R(0, 0, 8, 8, p.w);
      R(0, 2, 8, 1, p.roof); R(0, 6, 8, 1, p.roof); R(0, 4, 8, 1, p.a);
      if (v % 5 === 0) bm(p, ['.xx.x', 'xxxxx', '.xx.x'], 1, 1);
      break;
    case 'roots':
      R(0, 0, 8, 8, p.w2);
      for (let i = 0; i < 3; i++) { const y = 1 + i * 3; for (let x = 0; x < 8; x++) P(x, y + WAVE16[(x * 2 + i * 5 + v) & 15], p.w); }
      if (v % 4 === 0) P(r(8), r(8), p.a);
      break;
    case 'husk':
      D(0, 0, 8, 8, p.roof, 0.5);
      R(0, 3, 8, 2, p.x); P(r(8), 3, p.hi);
      P(1, 1, p.w2); P(6, 1, p.w2); P(1, 6, p.w2); P(6, 6, p.w2);
      break;
    case 'icewall':
      R(0, 7, 8, 1, p.w2); line(0, 2 + (v & 3), 7, 1 + (v % 3), p.a); line(2, 0, 4, 6, p.hi);
      D(4, 3, 4, 4, p.w2, 0.25);
      break;
    case 'silt':
      R(0, 0, 8, 2, p.g2); R(0, 3, 8, 1, p.roof); R(0, 5, 8, 1, p.w2);
      if (v % 4 === 0) bm(p, ['.aa', 'a..', '.aa'], 2, 2);
      break;
    case 'glassridge':
      line(0, 7, 4, 0, p.w2); line(5, 7, 8, 2, p.w2);
      P(2 + (v & 3), 2, p.hi); P(3 + (v & 3), 3, p.g3);
      if (v % 3 === 0) P(6, 5, p.x);
      break;
    case 'outline':
      R(0, 0, 8, 8, p.hi); R(0, 7, 8, 1, p.w2);
      if (!(nb & 8)) R(0, 0, 1, 8, p.w2);
      if (!(nb & 2)) R(7, 0, 1, 8, p.w2);
      if (v % 4 === 0) P(3, 3, p.x);
      return;
    case 'rock':
      // A shelf of night rock: one wavy stratum, barnacles, and sea glass caught in the cracks.
      for (let x = 0; x < 8; x++) { const y = 3 + WAVE16[(x * 2 + gx * 16) & 15]; P(x, y, p.w2); P(x, y - 1, p.g2); }
      if (v % 3 === 0) bm(p, ['.h.', 'hlh'], r(5), 4);
      if (v % 5 === 0) P(1 + r(6), 5 + r(2), p.x);
      R(0, 6, 8, 1, p.tr);
      break;
    case 'test':
      // The sand dollar's test: rows of pores in petal arcs, lit warm from the fire below.
      for (let y = 1 + gx; y < 7; y += 2) { P(2 + WAVE16[(y * 2 + gy * 8) & 15], y, p.w2); P(5 - WAVE16[(y * 2 + gy * 8) & 15], y, p.w2); }
      D(0, 4, 8, 3, p.a, 0.125);
      D(0, 6, 8, 1, p.a, 0.25);
      if (v % 4 === 0) P(3 + (v & 1), 3, p.x);
      break;
    case 'glazewall': {
      // Brown glaze with cream spots and a hard shine.
      const sx = r(5), sy = r(4);
      bm(p, ['.gg.', 'gggg', '.gg.'], sx, sy);
      if (v % 2 === 0) bm(p, ['.g', 'gg'], (sx + 4) & 7, (sy + 3) & 7);
      line(0, 6, 6, 0, p.a);
      P(1, 5, p.hi); P(2, 4, p.hi);
      break;
    }
    case 'augerwall': {
      // Whorl walls: the spiral bands run on a slant, and some walls have a vent with sky in it.
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const s = ((x + gx * 8) - (y + gy * 8) * 2 + 64) % 8;
        if (s === 0) P(x, y, p.w2); else if (s === 1) P(x, y, p.g2);
      }
      if (v % 6 === 0) bm(p, ['.kk.', 'kxxk', 'kxik', '.kk.'], 2, 1);
      break;
    }
    case 'septum':
      // A curved septum: nacre bands bow across it, and the sheen turns green at one edge.
      for (let x = 0; x < 8; x++) {
        const y = 2 + Math.round(1.5 * Math.sin((x + gx * 8) / 5));
        P(x, y, p.g3); P(x, y + 3, p.g2);
        if (BAY[((y + 1) & 3) * 4 + (x & 3)] < 8) P(x, y + 1, p.x);
      }
      if (v % 7 === 0) bm(p, ['.WW.', 'WkkW', '.WW.'], 2, 3);
      break;
    case 'dune':
      D(0, 0, 8, 8, p.g2, 0.25);
      for (let x = 0; x < 8; x++) P(x, 2 + WAVE16[(x * 2 + gx * 16) & 15], p.g);
      if (v % 3 === 0) { P(r(8), 4, p.tr); P(r(8), 5, p.tr); }
      break;
    case 'conchwall':
      // Deep pink that curls in: one spiral, a wet shine, and a lighter band where the curl turns.
      D(0, 0, 8, 8, p.tr2, 0.25);
      if (v % 3 === 0) spiralAt(SP5, 5, 1 + r(2), 1, p.g2);
      for (let x = 0; x < 8; x++) P(x, 5 + WAVE16[(x * 2 + gx * 16 + 4) & 15], p.tr);
      P(5, 1, p.hi); P(6, 2, p.g3);
      break;
    case 'agate':
      // A cut geode wall: agate bands ring a pale core in every block of four tiles, with a teal seam now and then.
      agateBands(p, gx, gy, false);
      if (v % 5 === 0) line(r(4), 7, 4 + r(4), 0, p.x);
      break;
    case 'ridge':
      // A growth ridge of the Volute's shell, seen from the side.
      R(0, 1, 8, 1, p.g3);
      for (let x = 0; x < 8; x++) { P(x, 3 + WAVE16[(x + gx * 8) & 15], p.w2); P(x, 5 + WAVE16[(x + gx * 8 + 5) & 15], p.g2); }
      if (v % 4 === 0) bm(p, ['.tt.', 'tkkt'], r(5), 4);
      break;
  }
  if (top) R(0, 0, 8, 1, k.wall === 'cave' || k.wall === 'roots' ? p.w : p.hi);
  // Shadow where the wall meets the ground.
  R(0, 7, 8, 1, p.w2);
}

/** Detail on the tops of the Strand's walls, seen from above. */
function wallTop(p: Pal, k: Kit, v: number, gx: number, gy: number): void {
  const r = rng(v * 41 + 3);
  switch (k.wall) {
    case 'rock': if (v % 3 === 0) bm(p, ['.t.', 'tit'], r(5), r(5)); if (v % 7 === 0) P(r(8), r(8), p.x); break;
    case 'test': for (let i = 0; i < 3; i++) P(1 + ((gx * 8 + i * 3 + gy * 2) % 7), 1 + i * 2, p.w2); break;
    case 'glazewall': bm(p, ['.gg', 'ggg'], r(5), r(6)); P(r(8), r(8), p.hi); break;
    case 'augerwall': for (let x = 0; x < 8; x++) if (((x + gx * 8) + gy * 8) % 6 === 0) line(x, 0, x + 3, 7, p.w2); break;
    case 'septum': for (let x = 0; x < 8; x++) P(x, 3 + Math.round(1.5 * Math.sin((x + gx * 8) / 5)), p.g3); break;
    case 'conchwall': if (v % 2 === 0) spiralAt(SP5, 5, r(4), r(4), p.tr2); P(r(8), r(8), p.g3); break;
    case 'ridge': for (let x = 0; x < 8; x++) P(x, 4 + WAVE16[(x + gx * 8) & 15], p.g2); break;
    case 'dune': for (let i = 0; i < 3; i++) P(r(8), r(8), p.tr); break;
    case 'agate': agateBands(p, gx, gy, true); break;
  }
}

/** Concentric agate bands centered on each block of four tiles. Seen from above they are dimmer and the core is dark. */
function agateBands(p: Pal, gx: number, gy: number, top: boolean): void {
  const band = top ? [p.w2, p.w, p.w2, p.w2, p.roof] : [p.a, p.roof, p.w, p.hi, p.w, p.w2, p.w];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const d = Math.hypot(gx * 8 + x - 7.5, (gy * 8 + y - 7.5) * 1.2);
    const b = band[Math.floor(d / 1.6) % band.length];
    if (b !== p.w) P(x, y, b);
  }
}

// ---------------------------------------------------------------- trees and bushes

function tree(p: Pal, k: Kit, nb: number, v: number, gx: number, gy: number, sl: number, net: number): void {
  ground(p, k, v, net, gx, gy, sl, false);
  const U = nb & 1, Rt = nb & 2, Dn = nb & 4, L = nb & 8;
  switch (k.tree) {
    case 'round': case 'fruit':
      bm(p, ['..TTTT..', '.TttttT.', 'TttlttTT', 'TttttttT', 'TtttttTT', '.TTttTT.', '...WW...', '..WWWW..'], 0, 0);
      if (k.tree === 'fruit') { P(2, 3, p.x); P(5, 2, p.x); P(4, 4, p.a); }
      else if (v % 3 === 0) P(5, 3, p.g3);
      break;
    case 'coral':
      bm(p, ['a.a..a.a', 'a.a.aa.a', '.aa..a.a', '..a.aaa.', 'x.aaa.a.', '.a.a..a.', '..aaaa..', '...WW...'], 0, 0, !!(v & 1));
      P(0, 0, p.hi); P(7, 0, p.hi);
      break;
    case 'drift':
      bm(p, ['i.....i.', '.i...i..', '..i.ii..', '...ii..i', '..iii.i.', '...ii...', '...ii...', '..hiih..'], 0, 0, !!(v & 1));
      break;
    case 'spiral':
      bm(p, ['...t....', '..tTt...', '..TttT..', '.tTTttt.', '.ttttTT.', 'TTttttTT', '.ttTTtt.', '...WW...'], 0, 0);
      P(3, 1, p.g3); P(4, 3, p.g3); P(3, 5, p.g3);
      break;
    case 'inverted':
      bm(p, ['w.w..w.w', '.w.ww.w.', '..wwww..', '...ww...', '...ww...', '.TTttTT.', 'TtttxttT', '.TTttTT.'], 0, 0, !!(v & 1));
      break;
    case 'pine':
      bm(p, ['...i....', '..iTi...', '..TTT...', '.iTTTi..', '.TTTTT..', 'iTTTTTi.', 'TTTTTTT.', '...W....'], 0, 0);
      break;
    case 'dead':
      bm(p, ['W.....W.', '.W..W.W.', '..W.W...', '...WW..W', '..WW.WW.', '...W....', '...W....', '..WWW...'], 0, 0, !!(v & 1));
      break;
    case 'crystal':
      bm(p, ['...i....', '..ili...', '..lgl.i.', '.lgxgli.', '.lggglg.', 'llgggggl', '.hhgghh.', '..hhhh..'], 0, 0, !!(v & 1));
      break;
    case 'rootcol':
      R(2, 0, 4, 8, p.tr2); R(3, 0, 1, 8, p.tr); P(1, 5, p.tr2); P(6, 3, p.tr2); P(6, 7, p.x); P(1, 7, p.x);
      break;
    case 'rootlog': {
      const horiz = (L || Rt) && !(U && Dn);
      R(0, 0, 8, 8, p.g2);
      if (horiz || !(U || Dn)) { R(0, 1, 8, 6, p.w); R(0, 1, 8, 1, p.g3); R(0, 6, 8, 1, p.w2); for (let x = v & 3; x < 8; x += 4) P(x, 3 + (x & 1), p.w2); if (!L) R(0, 1, 1, 6, p.w2); if (!Rt) R(7, 1, 1, 6, p.w2); }
      if (U || Dn) { R(1, 0, 6, 8, p.w); R(1, 0, 1, 8, p.g3); R(6, 0, 1, 8, p.w2); for (let y = v & 3; y < 8; y += 4) P(3 + (y & 1), y, p.w2); }
      if (v % 4 === 0) P(4, 2, p.a);
      return;
    }
    case 'outline':
      bm(p, ['..WWWW..', '.W....W.', 'W......W', 'W......W', '.W....W.', '..WWWW..', '...W....', '...W....'], 0, 0);
      return;
    case 'wrack':
      // A heap of black weed off the tide line, bladders lit by stars and one piece of sea glass.
      bm(p, ['..T..T..', '.TtTTtT.', 'TttltttT', 'TtTttTtT', 'TtttltTT', 'TTtTtttT', '.TTttTT.', '..TTTT..'], 0, 0, !!(v & 1));
      if (v % 3 === 0) P(2 + (v % 4), 4, p.x);
      break;
    case 'pillar':
      // A support column inside the shell, pored like the walls.
      R(2, 0, 4, 8, p.w); R(5, 0, 1, 8, p.w2); R(2, 0, 1, 8, p.hi);
      P(3, 2, p.w2); P(4, 4, p.w2); P(3, 6, p.w2);
      if (!U) { R(1, 0, 6, 1, p.w); R(1, 0, 6, 1, p.hi); }
      if (!Dn) { R(1, 7, 6, 1, p.w2); D(0, 7, 8, 1, p.a, 0.25); }
      return;
    case 'tooth':
      // One of the Cowrie's teeth: white, rounded, ridged, set in brown.
      bm(p, ['..iiii..', '.iiiill.', '.iilllW.', '.iiillW.', '.iilllW.', '.illllW.', 'WillllWW', 'WWWWWWWW'], 0, U ? -2 : 0);
      if (U) R(1, 0, 6, 1, p.hi);
      return;
    case 'columella': {
      // The twisted pillar the whorls turn round.
      R(2, 0, 4, 8, p.w); R(2, 0, 1, 8, p.g3);
      for (let y = 0; y < 8; y++) { P(2 + ((y + gy * 8) & 3), y, p.w2); if (((y + gy * 8) & 3) === 0) P(5, y, p.g3); }
      if (!Dn) R(1, 7, 6, 1, p.w2);
      return;
    }
    case 'marram':
      bm(p, ['...t.t..', '.t.tt.t.', '..tttt..', '.lltttl.', 'lllllll.', 'hllllllh', '.hhhhhh.'], 0, 1, !!(v & 1));
      break;
    case 'curl':
      // A knob of the Conch's inner wall, curled round on itself.
      bm(p, ['..wwww..', '.wwiwww.', 'wwiWWwww', 'wwWwwWww', 'wwWwWWwT', 'wwwWwwwT', '.wwwwwT.', '..TTTT..'], 0, 0, !!(v & 1));
      break;
    case 'barnacles':
      bm(p, ['.tt..tt.', 'tkkt.kkt', 'tttttttt', '..tt....', '.tkkt.tt', '.tttttkt', '..T..ttt', '........'], 0, 0, !!(v & 1));
      P(1, 0, p.hi); P(5, 0, p.hi); P(2, 4, p.hi);
      return;
    case 'cluster':
      // An amethyst cluster: points of crystal growing up out of the geode floor, lit along one face.
      bm(p, ['...i....', '..it..i.', '.i.tT.tl', '.ttTT.tT', 'tTitTTtT', 'tTTtTitT', '.WTTTTW.', '..WWWW..'], 0, 0, !!(v & 1));
      if (v % 3 === 0) P(3, 4, p.x);
      return;
  }
  // Woods that touch close the gaps between crowns.
  if (k.tree !== 'drift' && k.tree !== 'dead') {
    const fill = k.tree === 'coral' ? p.w2 : k.tree === 'crystal' || k.tree === 'marram' ? p.g2 : k.tree === 'curl' ? p.w : p.tr2;
    if (U) R(2, 0, 4, 1, fill);
    if (L) R(0, 2, 1, 4, fill);
    if (Rt) R(7, 2, 1, 4, fill);
    if (Dn && k.tree !== 'inverted') R(2, 6, 4, 2, fill);
  }
}

function bush(p: Pal, k: Kit, v: number): void {
  switch (k.bush) {
    case 'coral': bm(p, ['........', '.a..a.a.', '.a.aa.a.', 'aaa.aaa.', '.aaaaa..', '..aWa...', '.WWWWW..'], 0, 1, !!(v & 1)); P(1, 1, p.hi); break;
    case 'crystal': bm(p, ['....i...', '..i.l...', '.ilglli.', '.lgggl..', 'llgxggl.', '.hhhhhh.'], 0, 2); break;
    case 'iceblock': bm(p, ['.iiiiii.', 'ilhllllO', 'ilihhllO', 'illhhilO', 'illlhhlO', 'illllllO', '.OOOOOO.'], 0, 1); break;
    case 'outline': bm(p, ['..WWW...', '.W...W..', 'W.....W.', '.WWWWW..'], 0, 3); break;
    default: bm(p, ['..TTTT..', '.TttltT.', 'TttttttT', 'TttttTtT', '.TTTTTT.', '..T..T..'], 0, 2); if (v % 3 === 0) P(5, 3, p.x);
  }
}

// ---------------------------------------------------------------- houses

/** The roof is one picture across the whole house, painted a column at a time. */
function roof(p: Pal, k: Kit, inf: number, v: number, gx: number, gy: number, sl: number): void {
  const i = (inf >> 4) & 15, n = Math.max(1, (inf >> 8) & 15), j = (inf >> 12) & 3, m = Math.max(1, (inf >> 14) & 3);
  const empty = !!(inf & (1 << 16)), hv = (inf >> 17) & 3;
  ground(p, k, v, 0, gx, gy, sl, false);
  const W = n * 8, H = m * 8;
  const main = empty ? p.hi : p.roof, line2 = empty ? p.g2 : p.w2, sheen = empty ? p.g3 : p.hi, inner = empty ? p.g2 : p.a;
  const flip = !!(hv & 1);
  for (let py = 0; py < 8; py++) for (let px = 0; px < 8; px++) {
    let X = i * 8 + px;
    const Y = j * 8 + py;
    if (flip) X = W - 1 - X;
    const c = roofPx(k.roof, X, Y, W, H, i * 8 + px, main, line2, sheen, inner, p);
    if (c) P(px, py, c);
  }
  // A door halfway up the wall, with nothing to climb.
  if (!empty && hv === 2 && j === m - 1 && m > 1 && i === Math.floor(n / 2) + 1 && n > 3) bm(p, ['.WW.', 'WxxW', 'WkkW', 'WkkW', 'WWWW'], 2, 2);
}

/** One roof pixel. Returns null where the ground shows. X runs along the house and Y down the roof. */
function roofPx(kind: string, X: number, Y: number, W: number, H: number, col: number, main: string, ln: string, sh: string, inner: string, p: Pal): string | null {
  const bottom = Y === H - 1;
  switch (kind) {
    case 'conch': {
      // A conch on its side: the whorl at one end, knobs along the top, the open lip at the other end.
      const knob = X > 14 && X < W - 5 && X % 5 === 2;
      const top = Math.round(3.5 * (1 - Math.sin(Math.PI * (X + 0.5) / W))) + 1 - (knob ? 2 : 0);
      if (Y < top) return null;
      const s = Math.min(16, H);
      const sx = X, sy = Y - (H - s);
      if (sx < s && sy >= 0) {
        const d = Math.hypot(sx + 0.5 - s / 2, sy + 0.5 - s / 2);
        if (d < s / 2) {
          if (d > s / 2 - 1) return ln;
          return SP16[sy * 16 + sx] ? ln : (sx + sy) % 7 === 0 ? sh : main;
        }
      }
      if (knob && Y <= top + 1) return sh;
      if (Y === top) return ln;
      if (bottom) return ln;
      if (X >= W - 3) return X === W - 2 && Y > 3 && Y < H - 2 ? inner : sh;
      const band = (Y + Math.round(1.5 * Math.sin(X / 4))) % 5;
      if (band === 0) return ln;
      if (Y <= top + 3 && BAY[(Y & 3) * 4 + (X & 3)] < 6) return sh;
      return main;
    }
    case 'scallop': {
      const cx = W / 2, cy = H + 3;
      const dx = X + 0.5 - cx, dy = cy - (Y + 0.5);
      const ang = Math.atan2(dx, dy);
      const ribs = n2(W);
      const rr = Math.hypot(dx, dy);
      const t = (ang / Math.PI + 0.5) * ribs;
      const edge = Math.max(cx, H + 2) - 1.5 * Math.abs(Math.sin(t * Math.PI));
      if (rr > edge + 0.5) return null;
      if (rr > edge - 0.6) return ln;
      if (bottom) return ln;
      const f = t - Math.floor(t);
      if (f < 0.18) return ln;
      if (f < 0.4) return sh;
      return Math.floor(t) % 2 ? main : inner;
    }
    case 'turret': {
      const lx = col % 8;
      const hw = (Y / H) * 4.2 + 0.4;
      if (Math.abs(lx + 0.5 - 4) > hw) return null;
      if (bottom) return ln;
      if ((Y * 2 + lx) % 5 === 0) return ln;
      if (lx < 4 && (Y * 2 + lx) % 5 === 1) return sh;
      return Y < 2 ? p.a : main;
    }
    case 'snail': {
      const top = Math.round(3 * (1 - Math.sin(Math.PI * (X + 0.5) / W)));
      if (Y < top) return null;
      if (bottom) return ln;
      const sx = X - (W - 16), sy = Y - (H - 16);
      if (sx >= 0 && sy >= 0 && sx < 16 && sy < 16 && SP16[sy * 16 + sx]) return ln;
      if (Y <= top + 1) return BAY[(Y & 3) * 4 + (X & 3)] < 8 ? p.tr : main;
      if (Y === H - 2 && X % 5 === 2) return p.w;
      return main;
    }
    case 'nautilus': {
      const top = Math.round(4 * (1 - Math.sin(Math.PI * (X + 0.5) / W)));
      if (Y < top) return null;
      if (Y === top) return sh;
      if (bottom) return ln;
      const ang = Math.atan2(X - W * 0.7, H - Y);
      const ch = Math.floor((ang + Math.PI) * 4);
      const f = (ang + Math.PI) * 4 - ch;
      if (f < 0.12) return ln;
      if (Y < top + 4 && (X + ch) % 6 < 2) return inner;
      if (p.style === 'hum' && X === Math.floor(W / 2) && Y === top + 1) return p.a;
      return main;
    }
    case 'scrim': {
      const top = Math.round(4 * (1 - Math.sin(Math.PI * (X + 0.5) / W)));
      if (Y < top) return null;
      if (bottom) return X % 3 === 1 ? p.hi : ln;
      if (Y <= top + 2 + (X % 5 === 0 ? 1 : 0)) return p.hi;
      if (Y === top + 3) return p.g2;
      const sx = X - (W - 12), sy = Y - (H - 12);
      if (sx >= 0 && sy >= 0 && sx < 12 && sy < 12 && SP16[(sy + 2) * 16 + sx + 2]) return ln;
      return p.w;
    }
    case 'facet': {
      const top = Math.round(3 * (1 - Math.sin(Math.PI * (X + 0.5) / W)));
      if (Y < top) return null;
      if (bottom) return ln;
      const tri = ((X >> 2) + (Y >> 2)) & 1;
      if ((X + Y) % 4 === 0) return ln;
      if (X % 9 === 4 && Y === top + 2) return p.a;
      return tri ? main : p.w;
    }
    case 'whelk': {
      // A whelk lying on its side: the body whorl at one end, the spire tapering to a point at the other.
      const f = X / Math.max(1, W - 1), seg = Math.max(4, Math.round(W * 0.16));
      const s = f > 0.35 ? ((X - Math.round(W * 0.35)) % seg) / seg : 1;
      let top = f <= 0.35 ? Math.round(1.6 * (1 - Math.sin(Math.PI * (0.25 + f / 0.7)))) : Math.round((H - 2) * Math.pow((f - 0.35) / 0.65, 1.2) * 0.8) + 1;
      if (s < 0.25) top++;
      if (Y < top) return null;
      if (bottom) return ln;
      if (X < 3 && Y > top + 1 && Y < H - 1) return X === 0 ? ln : inner;
      if (s < 0.12) return ln;
      if (Y === top) return sh;
      if (Y === top + 1 && s > 0.5) return sh;
      if ((Y - top) % 3 === 2 && BAY[(Y & 3) * 4 + (X & 3)] < 8) return p.g3;
      return main;
    }
    case 'petal': {
      // The test's low dome with its five petals cut through, starlight showing in them.
      const top = Math.round(3 * (1 - Math.sin(Math.PI * (X + 0.5) / W)));
      if (Y < top) return null;
      if (bottom) return ln;
      if (Y === top) return sh;
      const px = (X % 10) - 4.5, depth = Y - top;
      const half = 2.2 - Math.abs(depth - 2.5) * 0.7;
      if (depth >= 1 && depth <= 5 && Math.abs(px) < half) return Math.abs(px) > half - 1 ? ln : p.x;
      if ((X + Y) % 5 === 0 && depth > 1) return p.g3;
      return main;
    }
    case 'cowrie': {
      const top = Math.round(4 * (1 - Math.sin(Math.PI * (X + 0.5) / W)));
      if (Y < top) return null;
      if (bottom) return ln;
      if (Y === top || (Y === top + 1 && X % 3 === 0)) return sh;
      if ((hh(X >> 1, Y >> 1) & 7) === 0) return p.g;
      return main;
    }
    case 'rind': default: {
      const top = Math.round(3 * (1 - Math.sin(Math.PI * (X + 0.5) / W)));
      if (Y < top) return null;
      if (bottom) return ln;
      if ((Y + WAVE16[(X * 2) & 15]) % 4 === 0) return ln;
      return main;
    }
  }
}
function n2(W: number): number { return Math.max(3, Math.round(W / 6)); }

function houseWall(p: Pal, k: Kit, inf: number, v: number, door: boolean): void {
  const i = (inf >> 4) & 15, n = Math.max(1, (inf >> 8) & 15), empty = !!(inf & (1 << 16)), hv = (inf >> 17) & 3;
  const left = i === 0, right = i === n - 1;
  const w = empty ? p.hi : p.w, ln = empty || k.house === 'shell' ? p.g2 : p.w2;
  R(0, 0, 8, 8, w);
  const win = !door && (i % 2 === 1) && !left && !right;
  switch (k.house) {
    case 'pearl': case 'nacre':
      for (let y = 0; y < 7; y++) for (let x = 0; x < 8; x++) if (((x + i * 8 + y * 2) % 12) < 2 && BAY[(y & 3) * 4 + (x & 3)] < 8) P(x, y, empty ? p.g3 : p.hi);
      R(0, 0, 8, 1, empty ? p.g3 : k.house === 'nacre' ? p.roof : p.a);
      if (k.house === 'nacre' && (left || right)) { R(left ? 0 : 6, 0, 2, 7, p.hi); P(left ? 1 : 6, 0, p.g2); }
      if (win) bm(p, empty ? ['.hh.', 'hggh', 'hggh', '.hh.'] : ['.ii.', 'iOxi', 'iOOi', '.ii.'], 2, 2);
      else if (!door && !empty && v % 3 === 0 && !left && !right) spiralAt(SP5, 5, 1, 1, p.w2);
      break;
    case 'hull':
      for (let y = 1; y < 7; y += 2) R(0, y, 8, 1, ln);
      if (win) bm(p, ['.xx.', 'xOOx', 'xOix', '.xx.'], 2, 1);
      if (!empty) { P(1 + (v % 5), 6, p.hi); P(3 + (v % 3), 6, p.g3); }
      break;
    case 'slate':
      R(0, 3, 8, 1, ln); P(3 + (i & 1) * 2, 0, ln); P(3 + (i & 1) * 2, 1, ln); P(3 + (i & 1) * 2, 2, ln);
      if (win) bm(p, ['..k..', '.kxk.', '.kxk.', '.kak.', '.kkk.'], 1, 1);
      if (!empty && v % 2 === 0) { P(0, 1, p.a); P(0, 2, p.a); P(7, 1, p.a); }
      break;
    case 'bark':
      for (let x = (v & 1); x < 8; x += 3) for (let y = 0; y < 7; y++) P(x + ((y + x) % 4 === 0 ? 1 : 0), y, ln);
      if (win) bm(p, ['.WW.', 'WkkW', 'WkxW', '.WW.'], 2, 2);
      if (!empty) { R(0, 6, 8, 1, p.tr); P(v % 8, 5, p.tr); }
      break;
    case 'steel':
      R(0, 0, 8, 1, p.hi); R(7, 0, 1, 7, ln);
      if (win) { R(2, 2, 4, 3, p.w2); R(3, 3, 2, 1, empty ? p.g2 : p.a); }
      else if (!door) { P(2, 2, ln); P(5, 2, ln); R(2, 5, 4, 1, ln); P(2, 1, p.hi); P(5, 1, p.hi); }
      break;
    case 'ivory':
      R(0, 3, 8, 1, ln); R(i & 1 ? 2 : 6, 0, 1, 3, ln); R(i & 1 ? 5 : 1, 4, 1, 3, ln);
      if (win) bm(p, ['.WW.', 'WaaW', 'WaiW', 'WWWW'], 2, 1);
      else if (!door && !empty) { for (let x = 1; x < 5; x++) R(x + 1, 4, 1, 2, ln); line(1, 6, 6, 4, ln); }
      break;
    case 'iron':
      R(0, 3, 8, 1, ln); P(1, 1, p.hi); P(6, 1, p.hi); P(1, 5, p.hi); P(6, 5, p.hi);
      if (win) R(2, 1, 4, 1, INK);
      if (!empty && v % 2 === 0 && !door) bm(p, ['.aa.', 'axaa', '.aa.'], 3, 3);
      break;
    case 'violet':
      if (win) bm(p, empty ? ['..h..', '.hhh.', '..h..'] : ['..a..', '.axa.', 'aaiaa', '.axa.', '..a..'], 1, 1);
      else if (!empty) P(v % 8, 1, p.roof);
      break;
    case 'china':
      R(0, 0, 8, 1, ln); R(0, 2, 8, 1, empty ? p.g3 : p.a);
      if (win) bm(p, ['.kk.', 'kxxk', 'kxik', '.kk.'], 2, 3);
      else if (!door && !empty) spiralAt(SP5, 5, 1, 3, p.x);
      break;
    case 'shell':
      // A house that is a shell: pale, ribbed along its growth lines, with a window full of firelight.
      R(0, 0, 8, 8, empty ? p.hi : p.roof);
      for (let x = 0; x < 8; x++) P(x, 3 + WAVE16[(x * 2 + i * 16) & 15], ln);
      if (win) bm(p, empty ? ['.hh.', 'hkkh', 'hkkh', '.hh.'] : ['.hh.', 'haah', 'haih', '.hh.'], 2, 2);
      break;
    case 'test':
      // Pale walls lit from inside: pores in arcs and a window full of firelight.
      for (let y = 1; y < 6; y += 2) P((i * 3 + y) % 8, y, ln);
      if (win) bm(p, empty ? ['.hh.', 'hkkh', 'hkkh', '.hh.'] : ['.WW.', 'WaaW', 'WaiW', '.WW.'], 2, 2);
      if (!empty) D(0, 5, 8, 2, p.a, 0.125);
      break;
    case 'rider': default:
      for (let x = 0; x < 8; x++) P(x, 2 + WAVE16[(x * 2 + i * 16) & 15], ln);
      if (win) bm(p, ['.WW.', 'WggW', 'WggW', '.WW.'], 2, 3);
  }
  if (left) R(0, 0, 1, 8, ln);
  if (right) R(7, 0, 1, 8, ln);
  R(0, 7, 8, 1, ln);
  // A crack down the middle of an empty shell house.
  if (empty && i === Math.floor(n / 2)) { R(3, 0, 1, 7, p.g); P(4, 3, p.g); }
  // Houses with too many doors: a second, smaller cowrie that does not open.
  if (!empty && !door && hv === 1 && !win && !left && !right && i % 3 === 2) bm(p, ['.SS.', 'SkkS', 'SkkS', 'SSSS'].map(r => r.replace(/S/g, k.door)), 2, 3);
  if (door) cowrie(p, k);
}

/** Cowrie doors: an upright cowrie with a toothed slit to walk through. */
function cowrie(p: Pal, k: Kit): void {
  bm(p, [
    '..SSSS..',
    '.SiSSSS.',
    '.SSkkSS.',
    'SSikkiSS',
    'SSSkkSSS',
    'SSikkiSS',
    '.SSkkSS.',
    'pWSkkSWp',
  ].map(r => r.replace(/S/g, k.door)), 0, 0);
}

// ---------------------------------------------------------------- everything else

function water(p: Pal, nb: number, ph: number, gx: number, gy: number): void {
  R(0, 0, 8, 8, p.wt);
  const wx = gx * 8, wy = gy * 8;
  // Wave lines of shallow color and a dithered layer between them, both drifting a whole pixel per step.
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const s = (y + wy) * 2 + WAVE16[(x + wx + ph) & 15] * 2;
    const m = ((s % 12) + 12) % 12;
    if (m === 0) P(x, y, p.wt2);
    else if (m < 4 && BAY[(y & 3) * 4 + (x & 3)] < 4) P(x, y, p.wt2);
  }
  // Glints that slide sideways.
  for (let x = 0; x < 8; x++) {
    const sx = (x + wx + ph * 2) & 31;
    if (sx < 2 && wy === 0) P(x, 3, p.hi);
    if (sx > 15 && sx < 17 && wy === 8) P(x, 5, p.hi);
  }
  // Shallows and foam where the water meets land.
  if (!(nb & 1)) { R(0, 1, 8, 2, p.wt2); D(0, 3, 8, 1, p.wt2, 0.5); R(0, 0, 8, 1, p.hi); D(0, 1, 8, 1, p.hi, (ph & 2) ? 0.5 : 0.25); }
  if (!(nb & 8)) { R(0, 0, 2, 8, p.wt2); D(2, 0, 1, 8, p.wt2, 0.5); R(0, 0, 1, 8, p.hi); }
  if (!(nb & 2)) { R(6, 0, 2, 8, p.wt2); D(5, 0, 1, 8, p.wt2, 0.5); R(7, 0, 1, 8, p.hi); }
  if (!(nb & 4)) { R(0, 6, 8, 2, p.wt2); R(0, 7, 8, 1, p.hi); D(0, 5, 8, 1, p.wt2, 0.5); }
}

function stay(p: Pal, k: Kit, nb: number, v: number, ph: number): void {
  R(0, 0, 8, 8, INK);
  const c = col(p, k.stay);
  switch (p.style) {
    case 'rib': case 'knuckle': P(3, 1, c); P(4, 3, c); P(3, 5, c); P(4, 7, c); break;
    case 'mast': case 'wreck': case 'shore': R(1, 2, 6, 1, c); R(1, 6, 6, 1, c); break;
    case 'spire': case 'bell': if (!(nb & 8)) R(0, 0, 1, 8, c); if (!(nb & 2)) R(7, 0, 1, 8, c); if (!(nb & 4)) P(3, 7, c); break;
    case 'bole': case 'root': case 'under': if (!(nb & 1)) { R(0, 0, 8, 1, c); P(2, 1, c); P(5, 1, c); } else P(v % 8, 3, c); break;
    case 'hum': case 'skin': R(1, 3, 6, 1, c === INK ? p.a : '#000000'); if (ph & 1) R(3, 3, 2, 2, c); P(0, 0, c); break;
    case 'tusk': case 'ice': line(1, 7, 6, 0, c); break;
    case 'hilt': case 'blade': if (!(nb & 1)) { R(0, 0, 8, 1, c); P(2, 1, c); P(2, 2, c); P(6, 1, c); } else if (v & 1) P(2, 2, c); break;
    case 'fall': case 'glass': case 'moon': if (v % 2 === 0) bm(p, ['.a.', 'aaa', '.a.'], 2 + (v % 3), 2 + (v % 4)); break;
    case 'crown': case 'orchard': R(0, 3, 8, 1, c); if (!(nb & 1)) R(0, 0, 8, 1, c); R(3, 0, 1, 8, c); break;
    default: P(3, 3, c); P(4, 4, c);
  }
}

function crease(p: Pal, k: Kit, nb: number, v: number, gx: number, gy: number, sl: number): void {
  ground(p, k, v, 0, gx, gy, sl, false);
  const U = nb & 1, Rt = nb & 2, Dn = nb & 4, L = nb & 8;
  const vert = (U || Dn) && !(L || Rt);
  const r = rng(v * 5 + 1);
  if (vert) {
    for (let y = 0; y < 8; y++) { const x0 = 2 + WAVE16[(y * 2 + gy * 16) & 15] + (r(3) === 0 ? 1 : 0); R(x0, y, 4 - (r(4) === 0 ? 1 : 0), 1, INK); P(x0 - 1, y, p.g3); }
  } else {
    for (let x = 0; x < 8; x++) {
      const y0 = 2 + WAVE16[(x * 2 + gx * 16) & 15];
      const th = 3 + (r(3) === 0 ? 1 : 0) - (!L && x < 2 ? 2 : 0) - (!Rt && x > 5 ? 2 : 0);
      R(x, y0, 1, Math.max(1, th), INK);
      P(x, y0 - 1, p.g3);
      P(x, y0 + Math.max(1, th), p.g2);
    }
  }
}

function machine(p: Pal, nb: number, v: number, ph: number): void {
  const body = p.style === 'hum' ? p.w : p.style === 'skin' ? p.w : p.w2;
  const dark = p.style === 'hum' || p.style === 'skin' ? p.w2 : INK;
  R(0, 0, 8, 8, dark);
  R(1, 1, 6, 6, body);
  if (nb & 2) R(7, 1, 1, 6, body);
  if (nb & 8) R(0, 1, 1, 6, body);
  if (nb & 4) R(1, 7, 6, 1, body);
  if (nb & 1) R(1, 0, 6, 1, body);
  P(2, 2, p.hi); P(5, 2, p.hi);
  R(2, 5, 4, 1, dark);
  R(3, 3, 2, 1, (ph + v) & 1 ? p.a : dark);
}

function bell(p: Pal, v: number, upside: boolean): void {
  const rows = ['..xxxx..', '.xxixxx.', '.xixxxx.', '.xxxxxx.', 'xxxxxxxx', 'WWWWWWWW', '...WW...', '...aa...'];
  if (upside) bm(p, rows.slice().reverse(), 0, 0);
  else { bm(p, rows.slice(0, 6), 0, 2); R(0, 7, 8, 1, p.g2); }
  if (v % 3 === 0) P(5, upside ? 4 : 4, p.a);
}

// ---------------------------------------------------------------- the Strand (regions 25 to 32)

const STRAND = new Set<Style>(['strand', 'dollar', 'cowrie', 'auger', 'nautilus', 'tray', 'conch', 'whorl']);
/** The Stays hold the Volute and nothing outside it, so Strand ground shows no grid and no crazes. The Outer Whorl is the Volute's own shell. */
const UNHELD = new Set<Style>(['strand', 'dollar', 'cowrie', 'auger', 'nautilus', 'tray', 'conch']);
/** Ground that darkens to wet sand beside tide water. */
const WETTABLE = new Set(['.', ',', 's', 'x', 'b', 'g', '=', 'G']);
/** The gray, a wall of water a wave left standing when it turned, is the same in every Strand region. */
const GRAY = ['#525c80', '#727e9e', '#98a4c2', '#d6def0'];
/** The blank: pale unfinished ground, its sketch lines, and the scorch round a hole a star burned. */
const BLANK = ['#ecebf4', '#d4d2e4', '#aeaac8', '#7a5a6a'];

/** Which sides of a tile touch tide water: bit 0 up, 1 right, 2 down, 3 left. */
function wetBits(tx: number, ty: number): number {
  return (nt(tx, ty - 1) === '~' ? 1 : 0) | (nt(tx + 1, ty) === '~' ? 2 : 0) | (nt(tx, ty + 1) === '~' ? 4 : 0) | (nt(tx - 1, ty) === '~' ? 8 : 0);
}

/** Sand darkens and shines where the tide touches it, so the high-water line meets dry sand cleanly. */
function wetEdge(p: Pal, wet: number): void {
  const c = p.style === 'strand' ? p.path : p.g2;
  if (wet & 1) { R(0, 0, 8, 2, c); D(0, 2, 8, 1, c, 0.5); P(2, 0, p.g3); P(6, 1, p.g3); }
  if (wet & 4) { R(0, 6, 8, 2, c); D(0, 5, 8, 1, c, 0.5); P(4, 7, p.g3); }
  if (wet & 8) { R(0, 0, 2, 8, c); D(2, 0, 1, 8, c, 0.5); P(0, 3, p.g3); }
  if (wet & 2) { R(6, 0, 2, 8, c); D(5, 0, 1, 8, c, 0.5); P(7, 5, p.g3); }
}

/** A moon shell lying on the sand, its spiral toward you and its mouth at the lower right. */
const SHELL = ['..iiii..', '.irrrrr.', 'irrhhhrr', 'irhrrrhr', 'irhrhkkr', 'irrhrkkr', '.rrrkkr.', '.hhhhhh.'];

/**
 * A shell the size of a house lying on the sand. An empty one lies still with sand drifted into its dark mouth.
 * One with a whorl in it rocks from side to side, and something in the mouth looks about.
 */
function bigShell(p: Pal, k: Kit, v: number, net: number, gx: number, gy: number, sl: number, live: boolean, ph: number): void {
  ground(p, k, v, net, gx, gy, sl, false);
  if (!live) {
    bm(p, SHELL, 0, 0);
    P(5, 6, p.g3); P(5, 7, p.g3); P(6, 7, p.g);
    return;
  }
  const dx = [0, 1, 0, -1][ph & 3];
  bm(p, SHELL.map((row, y) => (y === 7 ? row : row.replace(/k/g, 'x'))), dx, 0);
  P(5 + dx + (ph >> 1), 4, p.hi);
  P(5 + dx, 6, INK);
  if (dx) { P(dx > 0 ? 0 : 7, 6, p.g3); P(dx > 0 ? 0 : 7, 5, p.g3); }
}

function strandTile(ch: string, p: Pal, k: Kit, v: number, inf: number, gx: number, gy: number, sl: number, ph: number, net: number): boolean {
  const nb = inf & 15;
  const r = rng(v * 19 + 5);
  switch (ch) {
    case 'C': bigShell(p, k, v, net, gx, gy, sl, false, 0); return true;
    case 'J': bigShell(p, k, v, net, gx, gy, sl, true, ph); return true;
    case 's': ground(p, k, v, net, gx, gy, sl); return true;
    case 'b': {
      // The hollow a taken shell leaves: its outline pressed into the sand, lit along the lower rim.
      ground(p, k, v, net, gx, gy, sl, false);
      for (let y = 0; y < 7; y++) for (let x = 0; x < 8; x++) {
        const c = SHELL[y][x];
        if (c === '.') continue;
        const above = y === 0 || SHELL[y - 1][x] === '.', below = y === 6 || SHELL[y + 1][x] === '.';
        if (above || c === 'h') P(x, y, p.g2);
        else if (below) P(x, y, p.g3);
        else if (BAY[(y & 3) * 4 + (x & 3)] < 4) P(x, y, p.g2);
      }
      return true;
    }
    case 'Y': {
      // Gray: water standing still where a wave turned. Streaks of held motion, a curled crest, and a star caught in it.
      R(0, 0, 8, 8, GRAY[1]);
      const o = v & 3;
      for (const x of [o, o + 3, (o + 6) & 7]) D(x, 0, 1, 8, GRAY[2], 0.5);
      for (let x = 0; x < 8; x++) P(x, 5 + WAVE16[(x * 2 + gx * 16) & 15], GRAY[0]);
      if (!(nb & 1)) { R(0, 0, 8, 1, GRAY[3]); D(0, 1, 8, 1, GRAY[3], 0.5); P(1, 1, p.hi); P(5, 1, p.hi); P((v >> 2) & 7, 2, GRAY[3]); }
      if (!(nb & 4)) { R(0, 7, 8, 1, GRAY[0]); D(0, 6, 8, 1, GRAY[3], 0.25); }
      if (v % 5 === 0) { P(2 + (v % 4), 3, p.a); P(3 + (v % 4), 3, GRAY[3]); }
      if ((ph + v) % 8 === 0) P(v % 8, 2 + (v & 3), GRAY[3]);
      return true;
    }
    case 'M': {
      // The blank: ground nobody finished, sketched and stopped. Some of it is a hole a star burned.
      R(0, 0, 8, 8, BLANK[0]);
      if (v % 3 === 0) for (let i = v & 1; i < 8; i += 2) P(i, 2 + (v % 4), BLANK[2]);
      else if (v % 3 === 1) for (let j = v & 1; j < 8; j += 2) P(1 + (v % 5), j, BLANK[1]);
      if (v % 5 === 0) {
        const x = 1 + r(3), y = 1 + r(3);
        D(x - 1, y - 1, 5, 5, BLANK[3], 0.25);
        R(x, y + 1, 3, 1, p.a); R(x + 1, y, 1, 3, p.a);
        P(x + 1, y + 1, INK);
      }
      return true;
    }
    case '~': seaWater(p, nb, ph, gx, gy); return true;
    case 'B': {
      if (p.style !== 'whorl') return false;
      // A Stay's point through the Volute's shell: black, sharp, with one gold glint.
      ground(p, k, v, net, gx, gy, sl, false);
      bm(p, ['...kk...', '...kk...', '..kkkk..', '..kkak..', '.kkkkkk.', '.kkkkkk.', 'kkkkkkkk', '.hhhhhh.'], 0, 0);
      return true;
    }
    case 'O': {
      if (p.style !== 'whorl') return false;
      // The hole a pulled Stay left, its rim soft and pink.
      ground(p, k, v, net, gx, gy, sl, false);
      bm(p, ['..xxxx..', '.xkkkkx.', 'xkkkkkkx', 'xkkkkkkx', 'xkkkkkkx', '.xkkkkx.', '..xxxx..'], 0, 0);
      D(0, 7, 8, 1, p.x, 0.25);
      return true;
    }
  }
  return false;
}

/** The night sea: layered blues, foam in pearl, and stars reflected in it that turn gold and back but never go out. */
function seaWater(p: Pal, nb: number, ph: number, gx: number, gy: number): void {
  R(0, 0, 8, 8, p.wt);
  const wx = gx * 8, wy = gy * 8;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const s = (y + wy) * 2 + WAVE16[(x + wx + ph) & 15] * 2;
    const m = ((s % 16) + 16) % 16;
    if (m === 0) P(x, y, p.wt2);
    else if (m < 3 && BAY[(y & 3) * 4 + (x & 3)] < 5) P(x, y, p.wt2);
  }
  const star = [[5, 2], [2, 5], [6, 6], [1, 1]][gy * 2 + gx];
  const tw = (ph + gx * 5 + gy * 11) & 15;
  P(star[0], star[1], tw < 11 ? p.hi : p.a);
  if (tw < 2) { P(star[0] - 1, star[1], p.wt2); P(star[0] + 1, star[1], p.wt2); }
  const lace = (x: number) => (WAVE16[(x * 2 + wx + ph * 2) & 15] > 0 ? 1 : 0);
  if (!(nb & 1)) { for (let x = 0; x < 8; x++) { R(x, 0, 1, 1 + lace(x), p.hi); P(x, 1 + lace(x), p.wt2); } D(0, 2, 8, 2, p.hi, (ph & 2) ? 0.25 : 0.125); }
  if (!(nb & 4)) { R(0, 6, 8, 2, p.wt2); for (let x = 0; x < 8; x++) P(x, 7 - lace(x), p.hi); }
  if (!(nb & 8)) { R(0, 0, 2, 8, p.wt2); for (let y = 0; y < 8; y++) P(lace(y), y, p.hi); }
  if (!(nb & 2)) { R(6, 0, 2, 8, p.wt2); for (let y = 0; y < 8; y++) P(7 - lace(y), y, p.hi); }
}

function paintTile(ch: string, p: Pal, v: number, inf: number, gx: number, gy: number, sl: number, ph: number, net: number): void {
  const k = KIT[p.style];
  const nb = inf & 15;
  if (STRAND.has(p.style) && strandTile(ch, p, k, v, inf, gx, gy, sl, ph, net)) return;
  switch (ch) {
    case '.': case '`': ground(p, k, v, net, gx, gy, sl); break;
    case ',': ground(p, k, v, net, gx, gy, sl, false); grass(p, k, v); break;
    case 'x': {
      ground(p, k, v, net, gx, gy, sl, false);
      const r = rng(v * 3 + 9);
      mark(k.debris, p, 1 + r(2), 1 + r(2)); mark(k.debris, p, 4 + r(2), 4 + r(2));
      if (v & 1) mark('p', p, 1 + r(3), 5);
      break;
    }
    case 'g': ground(p, k, v, net, gx, gy, sl, false); for (const [x, y] of [[2, 4], [5, 2], [4, 6]]) { P(x, y, p.tr); P(x, y - 1, p.tr); P(x + 1, y - 1, p.g3); } break;
    case 's': {
      const sand = ['mast', 'wreck', 'shore', 'glass'].includes(p.style);
      if (sand) ground(p, k, v, net, gx, gy, sl);
      else { ground(p, KIT.shore, v, net, gx, gy, sl, false); }
      break;
    }
    case 'n': {
      if (p.style === 'tusk') ground(p, KIT.tusk, v, net, gx, gy, sl);
      else {
        R(0, 0, 8, 8, p.hi); grid(p, gx, gy, sl);
        if (v & 1) { const x = v % 4; P(x + 1, 4, p.g2); P(x + 2, 3, p.g2); P(x + 3, 3, p.g2); P(x + 4, 4, p.g2); }
        if (v % 5 === 0) P((v >> 2) % 8, 6, p.g3);
      }
      break;
    }
    case 'I': {
      if (p.style === 'rib' || p.style === 'knuckle') {
        // Polished bone: pale and continuous, with grain and a hard diagonal shine.
        R(0, 0, 8, 8, p.path);
        for (let x = 0; x < 8; x++) P(x, 2 + WAVE16[(x * 2 + gx * 16) & 15], p.g3);
        for (let x = 0; x < 8; x++) P(x, 6 + WAVE16[(x * 2 + gx * 16 + 6) & 15], p.g3);
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
          const s = ((x + gx * 8) - (y + gy * 8) + 64) % 16;
          if (s < 2) P(x, y, p.hi); else if (s === 2) P(x, y, p.w);
        }
        if (v % 4 === 0) P(5, 4, p.a);
        break;
      }
      // Slippery clear ice: glassy pale blue, a diagonal sheen, hard white glints, and dark cracks.
      R(0, 0, 8, 8, p.style === 'ice' || p.style === 'tusk' ? p.g2 : p.wt2);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const s = ((x + gx * 8) - (y + gy * 8) + 64) % 16;
        if (s < 2) P(x, y, p.hi); else if (s < 4 && BAY[(y & 3) * 4 + (x & 3)] < 8) P(x, y, p.hi);
      }
      R(0, 0, 8, 1, p.hi);
      network(net, p.wt, p.wt);
      if (v % 3 === 0) bm(p, ['.i.', 'iii', '.i.'], 4, 1);
      break;
    }
    case 'G': ground(p, KIT.glass, v, net, gx, gy, sl); break;
    case 'L': beam(p, k, inf, v, net, gx, gy, sl, ph); break;
    case 'P':
      ground(p, k, v, net, gx, gy, sl, false);
      if (p.style === 'geode') {
        // A shard of lit crystal standing in the floor: the geode's lamps.
        bm(p, ['...i....', '..iai...', '..iaa.i.', '.iaaa.ai', '.aaxa.aa', 'iaaaa.aa', '.hhhhhhh'], 0, 1, !!(v & 1));
        break;
      }
      bm(p, ['.hhhh..', 'hiiaah.', 'hiaaaah', 'haaaaah', '.haaah.', '..hhh..'], 0, 1);
      P(2, 2, p.hi); P(4, 3, p.g3); P(5, 4, p.g3);
      break;
    case '=': path(p, k, nb, v, gx, gy, sl); break;
    case '_': case '|': floor(p, k, v, gx, gy); break;
    case 'b': {
      ground(p, k, v, net, gx, gy, sl, false);
      D(0, 0, 8, 8, p.g2, 0.5);
      const r = rng(v);
      P(r(8), r(8), INK); P(r(8), r(8), INK); line(r(8), 0, r(8), 7, p.g2);
      break;
    }
    case '#': wall(p, k, inf, v, gx, gy); break;
    case 'T': tree(p, k, nb, v, gx, gy, sl, net); break;
    case 'i': ground(p, k, v, net, gx, gy, sl, false); bush(p, k, v); break;
    case '~': water(p, nb, ph, gx, gy); break;
    case 'z': case 'Z': crease(p, k, nb, v, gx, gy, sl); break;
    case 'r': roof(p, k, inf, v, gx, gy, sl); break;
    case 'h': houseWall(p, k, inf, v, false); break;
    case 'd': houseWall(p, k, inf, v, true); break;
    case 'f': fence(p, k, nb, v, gx, gy, sl, net); break;
    case 'k': {
      ground(p, k, v, net, gx, gy, sl, false);
      const r = rng(v * 7);
      const c1 = k.bush === 'coral' ? p.a : k.grass === 'crystal' ? p.g3 : p.tr, c2 = k.bush === 'coral' ? p.w2 : k.grass === 'crystal' ? p.g2 : p.tr2;
      R(0, 0, 8, 8, c2);
      for (let i = 0; i < 6; i++) { const x = r(8), y = r(6); R(x, y, 1, 3, c1); P(x, y, p.hi === c1 ? p.g3 : c1); }
      for (let i = 0; i < 3; i++) P(r(8), r(8), k.bush === 'coral' ? p.hi : p.g3);
      if (v % 4 === 0) P(r(8), r(8), p.x);
      break;
    }
    case 'm': machine(p, nb, v, ph); break;
    case 'l': {
      ground(p, k, v, net, gx, gy, sl, false);
      const lip = p.style === 'tusk' || p.style === 'ice' ? p.hi : p.g3;
      R(0, 4, 8, 1, lip); R(0, 5, 8, 3, p.style === 'tusk' || p.style === 'ice' ? p.g2 : p.w);
      R(0, 7, 8, 1, p.w2);
      P(v % 8, 6, p.w2); if (p.style === 'tusk' || p.style === 'ice') { P(1, 5, p.hi); P(5, 6, p.hi); }
      break;
    }
    case 'B': stay(p, k, nb, v, ph); break;
    case 'w':
      ground(p, k, v, net, gx, gy, sl, false);
      bm(p, ['.iaaai..', 'iaWWWai.', 'aWOooWa.', 'aWoiOWa.', 'aWOooWa.', '.aaaaa..', '..hhh...'], 0, 1);
      break;
    case 'c':
      R(0, 0, 8, 8, p.path);
      R(0, 1, 8, 5, p.w); R(0, 1, 8, 1, p.hi); R(0, 6, 8, 2, p.w2);
      if (v % 3 === 0) bm(p, ['.aa.', 'aiaa'], 1, 2); else if (v % 3 === 1) bm(p, ['.x.', 'xix'], 4, 2); else P(3, 3, p.a);
      break;
    case 'p':
      R(0, 0, 8, 8, p.path);
      R(1, 0, 6, 8, p.w2); R(2, 1, 4, 2, p.w); R(2, 4, 4, 2, p.w);
      P(2, 2, p.a); P(4, 1, p.x); P(3, 5, p.hi); P(5, 4, p.a);
      break;
    case 'u': {
      // Porcelain bones. A run of them reads as one long bone with a knuckle at each end.
      ground(p, k, v, net, gx, gy, sl, false);
      const U = nb & 1, Dn = nb & 4, L = nb & 8, Rt = nb & 2;
      const horiz = (L || Rt) && !(U || Dn);
      const sh = p.style === 'rib' || p.style === 'knuckle' ? p.a : p.g2;
      if (horiz) {
        R(0, 2, 8, 4, p.hi); R(0, 5, 8, 1, p.g2); P(v % 8, 3, p.g3);
        if (!L) { R(0, 1, 3, 6, p.hi); P(0, 1, p.g3); R(0, 6, 3, 1, p.g2); P(1, 3, sh); }
        if (!Rt) { R(5, 1, 3, 6, p.hi); R(5, 6, 3, 1, p.g2); P(6, 4, sh); }
      } else {
        R(2, 0, 4, 8, p.hi); R(5, 0, 1, 8, p.g2); P(3, v % 8, p.g3);
        if (!U) { R(1, 0, 6, 3, p.hi); R(6, 0, 1, 3, p.g2); P(2, 1, sh); }
        if (!Dn) { R(1, 5, 6, 3, p.hi); R(1, 7, 6, 1, p.g2); R(6, 5, 1, 3, p.g2); P(4, 6, sh); }
      }
      break;
    }
    case 'v':
      R(0, 0, 8, 8, p.g2);
      for (let y = 1; y < 8; y += 3) for (let x = 0; x < 8; x++) { const yy = y + WAVE16[(x * 2 + y * 5 + gx * 16) & 15]; P(x, yy, INK); P(x, yy - 1, p.g); }
      break;
    case 'e': hull(p, nb, v, gy); break;
    case 'q':
      R(0, 0, 8, 8, INK);
      for (let y = 0; y < 4; y++) R(y, 1 + y * 2, 8 - y * 2, 1, y & 1 ? p.g2 : p.path);
      P(6, 1, p.hi);
      break;
    case 'j':
      if (p.style === 'crown') { R(0, 0, 8, 8, INK); R(0, 3, 8, 1, p.a); R(3, 0, 1, 8, p.a); if (v & 1) P(5, 5, p.a); }
      else if (p.style === 'geode') {
        // A setter's tray sunk into the floor: dark felt in a brass rim, the same board the Setting puzzles use.
        R(0, 0, 8, 8, '#2a1e33'); P(0, 0, '#3d2f48');
        if (!(nb & 1)) R(0, 0, 8, 1, '#d0a860');
        if (!(nb & 4)) R(0, 7, 8, 1, '#6a4c24');
        if (!(nb & 8)) R(0, 0, 1, 8, '#d0a860');
        if (!(nb & 2)) R(7, 0, 1, 8, '#6a4c24');
      }
      else { R(0, 0, 8, 8, p.path); R(2, 0, 4, 8, p.w2); R(3, 0, 1, 8, p.a); P(4, 2, p.hi); }
      break;
    case 'Y': {
      R(0, 0, 8, 8, p.style === 'shore' ? p.w : '#7c98a8');
      const band = p.style === 'shore' ? p.roof : '#6a8494';
      R(0, 2, 8, 1, band); R(0, 5, 8, 1, band);
      if (!(nb & 1)) { R(0, 0, 8, 1, p.hi); D(0, 1, 8, 1, p.hi, 0.5); }
      if (v % 6 === 0) bm(p, ['.xx.x', 'xxixx', '.xx.x'], 1, 3);
      if ((ph + v) % 8 === 0) P(v % 8, 3, p.hi);
      break;
    }
    case 'O':
      R(0, 0, 8, 8, INK);
      if (!(nb & 1)) { R(0, 0, 8, 1, p.g2); D(0, 1, 8, 1, p.g2, 0.5); }
      if (!(nb & 4)) { R(0, 7, 8, 1, p.g3); }
      if (!(nb & 8)) R(0, 0, 1, 8, p.g2);
      if (!(nb & 2)) R(7, 0, 1, 8, p.g2);
      break;
    case 'K':
      R(0, 0, 8, 8, p.path);
      R(3, 0, 2, 8, p.w2); bm(p, ['.xxxx.', 'xxixxx', '.xxxx.'], 1, 4); P(3, 0, p.hi);
      break;
    case 'U': ground(p, k, v, net, gx, gy, sl, false); bell(p, v, p.style === 'bell'); break;
    case 'R': case 'Q': {
      // Stands that turn a beam. 'R' slants like a slash and 'Q' like a backslash.
      if (p.style === 'hum') {
        // In Ohm's hall they are switching posts: a slanted steel bar with a lit end.
        floor(p, k, v, gx, gy);
        bm(p, ['......ax', '.....iw.', '....iw..', '...iw...', '..iw....', '.iw.....', 'WWWWWWW.', '.WWWWWW.'], 0, 0, ch === 'Q');
        break;
      }
      ground(p, k, v, net, gx, gy, sl, false);
      bm(p, ['......ii', '.....iax', '....iax.', '...iax..', '..iax...', '.iax....', 'WWWWWWW.', '.hhhhhh.'], 0, 0, ch === 'Q');
      break;
    }
    case 'V':
      ground(p, k, v, net, gx, gy, sl, false);
      bm(p, ['...ii...', '...iw...', '...iw...', '...iw...', '.WaWWaW.', '...WW...', '...aa...', '..hhhh..'], 0, 0, !!(v & 1));
      break;
    case 'N': case 'E': case 'S': case 'W': wind(p, k, ch, v, gx, gy, ph); break;
    case 'F': {
      ground(p, k, v, net, gx, gy, sl, false);
      const horiz = (nb & 10) !== 0 && (nb & 5) === 0;
      if (horiz) { R(0, 2, 8, 4, p.w); R(0, 5, 8, 1, p.w2); R(0, 2, 8, 1, p.hi); if (!(nb & 8)) { R(0, 1, 2, 6, p.w); P(0, 1, p.hi); } if (!(nb & 2)) { R(6, 1, 2, 6, p.w); R(7, 1, 1, 6, p.w2); } }
      else { R(2, 0, 4, 8, p.w); R(5, 0, 1, 8, p.w2); R(2, 0, 1, 8, p.hi); if (!(nb & 1)) { R(1, 0, 6, 2, p.w); P(1, 0, p.hi); } if (!(nb & 4)) { R(1, 6, 6, 2, p.w); R(1, 7, 6, 1, p.w2); } }
      if (v % 3 === 0) P(3, 4, p.a);
      break;
    }
    case 'D': hull(p, nb, v, gy); R(0, 5, 8, 3, p.x); R(0, 5, 8, 1, p.w2); break;
    case 'X':
      R(0, 0, 8, 8, p.w); D(0, 0, 8, 8, p.roof, 0.5);
      R(0, 3, 8, 2, p.x); P(1, 1, p.w2); P(6, 1, p.w2); P(1, 6, p.w2); P(6, 6, p.w2);
      if (!(nb & 1)) R(0, 0, 8, 1, p.hi);
      if (!(nb & 4)) R(0, 7, 8, 1, p.w2);
      break;
    case 'A':
      R(0, 0, 8, 8, p.w); R(0, 7, 8, 1, p.w2);
      // A tree trained flat on the wall into the shape of a hand.
      bm(p, ['T.T.T.T.', 'T.T.T.T.', 'T.TxT.T.', 'TTTTTT..', '.TTTT.TT', '..TT.T..', '..TT....', '..TT....'], 0, 0, !!(v & 1));
      P(4, 1, p.a); P(1, 4, p.x);
      break;
    case 'M':
      R(0, 0, 8, 8, p.hi);
      D(0, 0, 8, 8, p.g3, 0.25);
      if (v % 7 === 0) P(v % 8, (v >> 3) % 8, p.x);
      break;
    case ';': case '<': case '>': case '^': ledge(p, k, ch, v, net, gx, gy, sl); break;
    case ':': shallows(p, nb, ph, gx, gy, v); break;
    case '%': crust(p, k, v, net, gx, gy, sl); break;
    case '@': case 'o': ground(p, k, v, net, gx, gy, sl, false); break;
    case '&': water(p, 15, ph, gx, gy); sunkStone(p, v); break;
    case '*': water(p, 15, ph, gx, gy); break;
    case '+': sluice(p, ph, gx, gy); break;
    case 'H':
      R(0, 0, 8, 8, p.w2);
      for (const x of [0, 2, 3, 5, 7]) { const h = 4 + ((v + x * 3) % 4); R(x, 0, 1, h, p.tr); P(x, h, p.x); }
      R(1, 0, 6, 1, p.tr2);
      break;
    default: ground(p, k, v, net, gx, gy, sl);
  }
}

/** A beam of starlight. Arms reach toward neighboring beam tiles and prisms, so a run reads as one line in any direction. */
function beam(p: Pal, k: Kit, inf: number, v: number, net: number, gx: number, gy: number, sl: number, ph: number): void {
  let arms = inf & 15;
  if (!arms) arms = 15;
  if (p.style === 'hum') {
    // In Ohm's hall the line is current: a zigzag that crawls a pixel per step, with sparks.
    floor(p, k, v, gx, gy);
    const ZZ = [0, -1, 0, 1];
    if (arms & 10) {
      const x0 = arms & 8 ? 0 : 3, x1 = arms & 2 ? 8 : 5;
      for (let x = x0; x < x1; x++) { const y = 3 + ZZ[(x + ph) & 3]; P(x, y, p.x); P(x, y + 1, (x + ph) & 1 ? p.hi : p.x); }
    }
    if (arms & 5) {
      const y0 = arms & 1 ? 0 : 3, y1 = arms & 4 ? 8 : 5;
      for (let y = y0; y < y1; y++) { const x = 3 + ZZ[(y + ph) & 3]; P(x, y, p.x); P(x + 1, y, (y + ph) & 1 ? p.hi : p.x); }
    }
    R(3, 3, 2, 2, p.hi);
    if ((v + ph) % 3 === 0) { P(1 + (v % 5), 1 + ((v >> 2) % 2) * 5, p.a); }
    return;
  }
  ground(p, k.base === 'glass' ? k : KIT.glass, v, net, gx, gy, sl, false);
  const glow = (x: number, y: number, w: number, h: number) => D(x, y, w, h, p.hi, 0.5);
  if (arms & 10) {
    const x0 = arms & 8 ? 0 : 3, x1 = arms & 2 ? 8 : 5;
    glow(x0, 2, x1 - x0, 1); glow(x0, 5, x1 - x0, 1);
    R(x0, 3, x1 - x0, 2, p.a); R(x0, 3, x1 - x0, 1, p.hi);
  }
  if (arms & 5) {
    const y0 = arms & 1 ? 0 : 3, y1 = arms & 4 ? 8 : 5;
    glow(2, y0, 1, y1 - y0); glow(5, y0, 1, y1 - y0);
    R(3, y0, 2, y1 - y0, p.a); R(3, y0, 1, y1 - y0, p.hi);
  }
  R(3, 3, 2, 2, p.hi);
}

/** Hull planks of a boat on its side. The red underside shows along the bottom and the corners round off. */
/**
 * Wind tiles push Vellum one way. A chevron and its streak point that way and slide along it a pixel per step,
 * and the pattern repeats every 8 pixels so a run of tiles reads as one moving current.
 */
function wind(p: Pal, k: Kit, ch: string, v: number, gx: number, gy: number, ph: number): void {
  floor(p, k, v, gx, gy);
  const put = (u: number, w: number, c: string) => {
    const uu = ((u % 8) + 8) % 8;
    if (ch === 'E') P(uu, w, c); else if (ch === 'W') P(7 - uu, w, c);
    else if (ch === 'S') P(w, uu, c); else P(w, 7 - uu, c);
  };
  for (let w = 0; w < 8; w++) if (w !== 3 && w !== 4 && (w + v) % 3 === 0) put(ph + w * 3, w, p.g3);
  const a = ph + 3;
  put(a - 3, 3, p.a); put(a - 2, 3, p.a); put(a - 1, 3, p.a);
  put(a - 3, 4, p.a); put(a - 2, 4, p.a); put(a - 1, 4, p.a);
  put(a, 1, p.hi); put(a + 1, 2, p.hi); put(a + 2, 3, p.hi); put(a + 2, 4, p.hi); put(a + 1, 5, p.hi); put(a, 6, p.hi);
  put(a, 2, p.hi); put(a + 1, 3, p.hi); put(a + 1, 4, p.hi); put(a, 5, p.hi);
}

function hull(p: Pal, nb: number, v: number, gy: number): void {
  const wood = p.style === 'mast' || p.style === 'wreck' ? p.w : p.style === 'shore' ? p.roof : p.w;
  const seam = p.style === 'shore' ? p.w2 : p.w2;
  R(0, 0, 8, 8, wood);
  for (let y = 1; y < 8; y += 2) R(0, y, 8, 1, seam);
  const U = nb & 1, Rt = nb & 2, Dn = nb & 4, L = nb & 8;
  if (!U) { R(0, 0, 8, 1, p.hi); R(0, 1, 8, 1, wood); }
  if (!Dn) { R(0, 5, 8, 3, p.x); R(0, 5, 8, 1, seam); R(0, 7, 8, 1, p.w2); }
  if (!L) R(0, 0, 1, 8, p.w2);
  if (!Rt) R(7, 0, 1, 8, p.w2);
  if (v % 5 === 0 && U && Dn) bm(p, ['.ii.', 'iOOi', 'iOai', '.ii.'], 2, 2);
  if (v % 3 === 0) P(v % 8, gy ? 3 : 5, p.hi);
  // Round the outer corners into the sand.
  const sand = p.g;
  if (!U && !L) { R(0, 0, 2, 1, sand); P(0, 1, sand); P(1, 1, p.w2); P(2, 0, p.w2); }
  if (!U && !Rt) { R(6, 0, 2, 1, sand); P(7, 1, sand); P(6, 1, p.w2); P(5, 0, p.w2); }
  if (!Dn && !L) { R(0, 7, 2, 1, sand); P(0, 6, sand); }
  if (!Dn && !Rt) { R(6, 7, 2, 1, sand); P(7, 6, sand); }
}

function fence(p: Pal, k: Kit, nb: number, v: number, gx: number, gy: number, sl: number, net: number): void {
  ground(p, k, v, net, gx, gy, sl, false);
  const Rt = nb & 2, L = nb & 8, U = nb & 1, Dn = nb & 4;
  switch (k.fence) {
    case 'coral':
      if (L || Rt || !(U || Dn)) R(L ? 0 : 3, 4, (L ? 3 : 0) + (Rt ? 5 : 2), 1, p.a);
      if (U || Dn) R(3, U ? 0 : 3, 1, Dn ? 8 - (U ? 0 : 3) : 5, p.a);
      bm(p, ['a.a.a', '.aaa.', '..a..', '.aaa.', '..a..'], 1, 2);
      P(1, 2, p.hi); P(5, 2, p.hi); R(2, 7, 3, 1, p.w2);
      break;
    case 'bone':
      if (L || Rt || !(U || Dn)) { R(L ? 0 : 3, 3, (L ? 3 : 0) + (Rt ? 5 : 2), 2, p.hi); R(L ? 0 : 3, 5, (L ? 3 : 0) + (Rt ? 5 : 2), 1, p.g2); }
      if (U || Dn) R(3, 0, 2, 8, p.hi);
      bm(p, ['.ii.', 'iiii', '.ii.', '.ii.', '.ii.', 'iiii', '.ii.'], 2, 1);
      R(5, 2, 1, 5, p.g2);
      break;
    case 'whitepost':
      // The Gleaner's posts: square, too white, and never joined by anything.
      R(2, 7, 5, 1, p.g2);
      R(3, 1, 2, 7, p.hi); R(5, 1, 1, 7, p.g3); P(3, 0, p.hi); P(4, 0, p.hi);
      return;
    case 'drift':
      if (L || Rt || !(U || Dn)) { R(0, 4, 8, 1, p.roof); R(0, 5, 8, 1, p.g2); if (!L) R(0, 4, 3, 2, p.g); if (!Rt) R(5, 4, 3, 2, p.g); }
      if (U || Dn) R(3, 0, 2, 8, p.roof);
      R(3, 1, 2, 7, p.roof); R(4, 2, 1, 5, p.g2); P(3, 1, p.hi); P(2, 2, p.roof);
      R(2, 7, 4, 1, p.g2);
      return;
    case 'iron': case 'rail': case 'shard': case 'china': case 'tusk': case 'post': case 'root': default: {
      const post = k.fence === 'tusk' ? p.w : k.fence === 'shard' ? p.g3 : k.fence === 'china' ? p.w : k.fence === 'root' ? p.w : p.w2;
      const rail = k.fence === 'china' ? p.x : k.fence === 'shard' ? p.x : k.fence === 'tusk' ? p.w2 : k.fence === 'rail' ? p.a : post;
      if (L || Rt || !(U || Dn)) { R(0, 3, 8, 1, rail); R(0, 5, 8, 1, rail); if (!L) R(0, 3, 3, 3, p.g); if (!Rt) R(5, 3, 3, 3, p.g); }
      if (U || Dn) R(3, 0, 2, 8, post);
      R(3, 1, 2, 7, post);
      if (k.fence === 'shard' || k.fence === 'tusk') { P(3, 0, p.hi); P(4, 1, p.hi); } else P(3, 1, p.hi);
      if (k.fence === 'iron') P(3, 0, p.a);
      R(2, 7, 4, 1, p.g2);
    }
  }
}

// ---------------------------------------------------------------- the ring's ground

/**
 * A bank that drops one way. A bright lip runs along the high side, a deep face with notches pointing down the drop shows
 * on the side it drops toward, and an ink edge at its foot keeps the drop readable under any light. Tufts lean over the lip.
 */
function ledge(p: Pal, k: Kit, ch: string, v: number, net: number, gx: number, gy: number, sl: number): void {
  ground(p, k, v, net, gx, gy, sl, false);
  const cold = p.style === 'tusk' || p.style === 'ice' || p.style === 'coast' && p.g === '#dce8f4';
  const face = cold ? p.g2 : p.w, dark = p.w2, lip = p.hi;
  const tuft = (x: number, y: number) => { P(x, y, p.tr); P(x + 1, y - 1, p.tr); P(x + 2, y, p.tr2); };
  // Notches sit at the same world columns or rows on every tile, so a long ledge reads as one bank.
  const n0 = (gx + gy) & 1 ? 1 : 5;
  switch (ch) {
    case ';':
      R(0, 2, 8, 1, lip); R(0, 3, 8, 3, face); R(0, 6, 8, 1, dark); R(0, 7, 8, 1, INK);
      P(n0, 4, dark); P(n0 + 1, 5, dark); P(n0 - 1, 5, dark);
      if (v & 1) tuft(1 + (v % 4), 2);
      break;
    case '^':
      R(0, 0, 8, 1, INK); R(0, 1, 8, 1, dark); R(0, 2, 8, 3, face); R(0, 5, 8, 1, lip);
      P(n0, 3, dark); P(n0 + 1, 2, dark); P(n0 - 1, 2, dark);
      if (v & 1) tuft(1 + (v % 4), 7);
      break;
    case '>':
      R(2, 0, 1, 8, lip); R(3, 0, 3, 8, face); R(6, 0, 1, 8, dark); R(7, 0, 1, 8, INK);
      P(4, n0, dark); P(5, n0 + 1, dark); P(5, n0 - 1, dark);
      if (v & 1) { P(1, 2 + (v % 4), p.tr); P(2, 1 + (v % 4), p.tr); }
      break;
    case '<':
      R(0, 0, 1, 8, INK); R(1, 0, 1, 8, dark); R(2, 0, 3, 8, face); R(5, 0, 1, 8, lip);
      P(3, n0, dark); P(2, n0 + 1, dark); P(2, n0 - 1, dark);
      if (v & 1) { P(6, 2 + (v % 4), p.tr); P(5, 1 + (v % 4), p.tr); }
      break;
  }
}

/** Clear shallow water over sand: the sand shows through in a dither, and light lines drift across it. Wading boots or a TIDE whorl worn cross it. */
function shallows(p: Pal, nb: number, ph: number, gx: number, gy: number, v: number): void {
  R(0, 0, 8, 8, p.wt2);
  D(0, 0, 8, 8, p.g, 0.375);
  const wx = gx * 8, wy = gy * 8;
  for (let x = 0; x < 8; x++) {
    if (((x + wx + ph) & 15) < 3) P(x, 2 + (wy ? 4 : 0) + WAVE16[(x + ph) & 15], p.hi);
  }
  if (v % 5 === 0) { P(v % 8, 3 + (v % 3), p.g2); P((v + 3) % 8, 5, p.g3); }
  // Wet sand where the shallows meet dry ground.
  if (!(nb & 1)) { R(0, 0, 8, 1, p.g3); D(0, 1, 8, 1, p.g, 0.5); }
  if (!(nb & 4)) { R(0, 7, 8, 1, p.g2); D(0, 6, 8, 1, p.g, 0.5); }
  if (!(nb & 8)) { R(0, 0, 1, 8, p.g3); D(1, 0, 1, 8, p.g, 0.5); }
  if (!(nb & 2)) { R(7, 0, 1, 8, p.g2); D(6, 0, 1, 8, p.g, 0.5); }
}

/** A rock or doorway crusted thick with old shells, the oldest grown into the newest. A prising iron takes it off. */
function crust(p: Pal, k: Kit, v: number, net: number, gx: number, gy: number, sl: number): void {
  ground(p, k, v, net, gx, gy, sl, false);
  bm(p, ['..WWWW..', '.WwwwwW.', 'WwiwwwwW', 'WwwwwwwW', 'WwwwwwWW', '.WWwwWW.', '..hhhh..'], 0, 1);
  const r = rng(v * 11 + 3);
  for (let i = 0; i < 4; i++) {
    const x = 1 + r(5), y = 2 + r(3), c = i === 0 ? p.a : i === 1 ? p.x : p.hi;
    P(x, y, c); P(x + 1, y, p.w2); P(x, y + 1, p.w2);
  }
  spiralAt(SP5, 5, 2, 2, p.hi);
}

/** A stone sunk in deep water, its flat top just above the surface. */
function sunkStone(p: Pal, v: number): void {
  bm(p, ['.WWWWW..', 'WwiwwwW.', 'WwwwwwWW', '.WWWWWW.'], v & 1, 2);
  R(1, 6, 6, 1, p.wt2);
}

/** A sluice board standing in a channel of water. Lifting it levels the water on each side. */
function sluice(p: Pal, ph: number, gx: number, gy: number): void {
  water(p, 15, ph, gx, gy);
  R(2, 0, 4, 8, p.path); R(2, 0, 1, 8, p.w2); R(5, 0, 1, 8, p.w2);
  R(2, 2, 4, 1, p.w2); R(2, 5, 4, 1, p.w2);
  R(3, 0, 2, 1, p.a); P(3, 1, p.hi);
}

// ---------------------------------------------------------------- the frame

/** Tiles whose look depends on neighbors. */
const NEEDS_NB = new Set(['#', 'T', '~', 'r', 'h', 'd', 'f', 'u', 'B', 'z', 'Z', 'O', 'Y', 'e', 'D', 'X', 'F', 'm', '=', 'L', ':']);
/** Tiles whose ground crack network joins with the next tile. */
const NETTED = new Set(['salt', 'ice', 'glass']);
const WAVEC = [0, 0, 1, 1, 1, 0, 0, -1, -1, -1];

/** The animation step of a tile that moves, or -1 for a still tile. */
function phaseOf(ch: string, p: Pal, t: number): number {
  switch (ch) {
    case '~': case ':': case '&': case '*': case '+': return Math.floor(t / 14) & 15;
    case 'm': case 'B': return (t >> 5) & 1;
    case 'Y': return (t >> 4) & 7;
    case 'N': case 'E': case 'S': case 'W': return (t >> 2) & 7;
    case 'L': return p.style === 'hum' ? (t >> 3) & 3 : -1;
    case 'J': return (t >> 4) & 3;
  }
  return -1;
}

/** Finds or paints the atlas cell for one tile at one animation step. */
function tileCell(ch: string, tx: number, ty: number, p: Pal, slack: number, t: number, ph: number): number {
  const v = ch === '~' ? 0 : hh(tx, ty) & 31;
  const gx = tx & 1, gy = ty & 1;
  const sl = Math.min(3, slack);
  let inf = NEEDS_NB.has(ch) ? info(ch, tx, ty, t) : 0;
  const wet = STRAND.has(p.style) && WETTABLE.has(ch) ? wetBits(tx, ty) : 0;
  inf |= wet << 20;
  const k = KIT[p.style];
  const net = NETTED.has(k.base) || ch === 'I' || ch === 'G' || ch === 's' ? netBits(tx, ty) : 0;
  const key = `${p.style}${ch}${v}.${inf}.${gx}${gy}.${sl}.${ph}.${net}`;
  return cell(key, () => { paintTile(ch, p, v, inf, gx, gy, sl, Math.max(0, ph), net); if (wet) wetEdge(p, wet); });
}

function blitCell(g: CanvasRenderingContext2D, c: number, x: number, y: number): void {
  g.drawImage(atlas!, (c % CELLS_X) * 8, Math.floor(c / CELLS_X) * 8, 8, 8, x, y, 8, 8);
}

// The still tiles of the current map live in one map-sized canvas. The first tile drawn in a frame copies the
// whole of it to the screen, and later calls only paint tiles that moved or changed.
let lay: HTMLCanvasElement | null = null;
let LG: CanvasRenderingContext2D;
let layMap: unknown = null, laySlack = -1, layPal: Pal | null = null, layW = 0;
let layChars: (string | undefined)[] = [];
let lastIdx = Infinity, lastT = -1;

function resetLayer(w: number, h: number, slack: number, p: Pal): void {
  if (!lay || lay.width !== w * 8 || lay.height !== h * 8) {
    lay = document.createElement('canvas');
    lay.width = w * 8; lay.height = h * 8;
    LG = lay.getContext('2d')!;
  } else LG.clearRect(0, 0, lay.width, lay.height);
  layMap = field.map; laySlack = slack; layPal = p; layW = w;
  layChars = new Array(w * h);
  lastIdx = Infinity;
}

export function drawTile(ch: string, x: number, y: number, tx: number, ty: number, p: Pal, slack: number, t: number): void {
  x = Math.round(x); y = Math.round(y);
  const rows = field.map.rows, mw = rows[0].length;
  if (field.map !== layMap || slack !== laySlack || p !== layPal || !lay) resetLayer(mw, rows.length, slack, p);
  const idx = ty * layW + tx;
  if (idx <= lastIdx || t !== lastT) ctx.drawImage(lay!, x - tx * 8, y - ty * 8);
  lastIdx = idx; lastT = t;
  const ph = phaseOf(ch, p, t);
  const prev = layChars[idx];
  if (prev !== ch) {
    // A tile that changed under a story flag makes its neighbors repaint too, since their edges may depend on it.
    if (prev) {
      memo.clear();
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const n = (ty + j) * layW + tx + i;
        if ((i || j) && n >= 0 && n < layChars.length && layChars[n]) layChars[n] = '';
      }
    }
    layChars[idx] = ch;
    const c = tileCell(ch, tx, ty, p, slack, t, ph < 0 ? -1 : 0);
    blitCell(LG, c, tx * 8, ty * 8);
    const crazed = slack > 0 && GROUND.has(ch) && !UNHELD.has(p.style);
    if (crazed) creases(LG, tx * 8, ty * 8, tx, ty, p, slack);
    if (ph < 0) {
      blitCell(ctx, c, x, y);
      if (crazed) creases(ctx, x, y, tx, ty, p, slack);
    }
  }
  if (ph >= 0) blitCell(ctx, tileCell(ch, tx, ty, p, slack, t, ph), x, y);
}

/**
 * Visual law: every loosened Stay adds a wavy black crease to every map.
 * Crease k runs on a slant across the world, repeats every few tiles down, and breaks into separate cracks along its length.
 */
function creases(g: CanvasRenderingContext2D, x: number, y: number, tx: number, ty: number, p: Pal, slack: number): void {
  const ctx = g;
  const wy0 = ty * 8;
  for (let k = 0; k < Math.min(slack, 8); k++) {
    const per = (9 + ((k * 5) % 6)) * 8, run = k & 1 ? 4 : -5, off = k * 37 + 11;
    for (let i = 0; i < 8; i++) {
      const wx = tx * 8 + i;
      const along = (wx + k * 13) % 48;
      if (along < 4 || along > 43) continue;
      const yk = off + Math.floor(wx / run) + WAVEC[(wx + k * 3) % 10];
      let ly = (((yk - wy0) % per) + per) % per;
      if (ly === per - 1) ly = -1;
      if (ly >= 8) continue;
      const rep = Math.floor((wy0 + ly - yk) / per), seg = Math.floor((wx + k * 13) / 48);
      if (hh(k * 31 + seg, rep * 17 + k) % 10 >= 6) continue;
      const thick = along > 10 && along < 37 ? 2 : 1;
      const y0 = Math.max(0, ly), y1 = Math.min(8, ly + thick);
      if (y1 > y0) { ctx.fillStyle = INK; ctx.fillRect(x + i, y + y0, 1, y1 - y0); }
      if (thick === 2 && ly >= 1 && (wx & 3) === 0) { ctx.fillStyle = p.g3; ctx.fillRect(x + i, y + ly - 1, 1, 1); }
    }
  }
}

export function isSolid(ch: string): boolean {
  return SOLID.has(ch);
}
