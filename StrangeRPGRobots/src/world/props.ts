// Props: the objects that stand on tiles. Each has art, a footprint, cover, and optional light, hit points,
// and a way to behave when woken. Art rows use '0' for black and '1' to '4' for the palette slots.
import { img, type Img } from '../engine/gfx';
import { C, LIGHT } from '../engine/palette';

export type WakeAct = 'throw' | 'ram' | 'shoot' | 'slam' | 'swallow' | 'swing' | 'blast' | 'flash' | 'lift' | 'none' | 'bump';

export interface PropDef {
  kind: string;
  ch?: string;
  name: string;
  art: Img;
  /** Extra frames for animated props. */
  frames?: Img[];
  /** Tiles occupied, from the placed tile toward the right and down. */
  w?: number;
  h?: number;
  /** Pixel offset of the art from the tile's top left. Tall props draw upward. */
  ox?: number;
  oy?: number;
  block: boolean;
  cover: 0 | 1 | 2;
  opaque?: boolean;
  hp?: number;
  /** Kinetic damage removed by plating. */
  plating?: number;
  wake?: WakeAct;
  /** Light at an offset from the art's top left, in pixels. */
  light?: { dx: number; dy: number; r: number; i: number; color: number; z?: number; dir?: number; spread?: number };
  /** Palette slots drawn as emissive. */
  glow?: number[];
  explode?: boolean;
  steam?: boolean;
  networked?: boolean;
  /** Interaction verb when the player presses Z next to it. */
  use?: 'loot' | 'read' | 'use' | 'door' | 'buy' | 'sit';
  /** Draw the prop flat on the floor (a grate, a rug) so it never covers actors. */
  flat?: boolean;
  /** The floor under the art is wet and reflects. */
  wet?: boolean;
}

const P: PropDef[] = [];
function def(d: PropDef) { P.push(d); return d; }

def({
  kind: 'vending', ch: 'V', name: 'vending machine', block: true, cover: 1, hp: 24, plating: 2, wake: 'throw', networked: true, use: 'buy',
  ox: 1, oy: -4, glow: [4],
  light: { dx: 4, dy: 6, r: 22, i: 0.75, color: LIGHT.cyan, z: 10 },
  art: img([
    '00000000',
    '02222220',
    '02444420',
    '02434420',
    '02444420',
    '02444320',
    '02444420',
    '02222220',
    '02133120',
    '02222220',
    '02000020',
    '02111120',
    '02222220',
    '00222200',
  ], [C.mag3, C.night, C.cyan4, C.cyan3]),
});

def({
  kind: 'vending2', ch: 'U', name: 'noodle vending machine', block: true, cover: 1, hp: 24, plating: 2, wake: 'throw', networked: true, use: 'buy',
  ox: 1, oy: -4, glow: [4],
  light: { dx: 4, dy: 6, r: 22, i: 0.75, color: LIGHT.magenta, z: 10 },
  art: img([
    '00000000',
    '01111110',
    '01444410',
    '01434410',
    '01444410',
    '01444410',
    '01111110',
    '01222210',
    '01111110',
    '01000010',
    '01000010',
    '01111110',
    '01111110',
    '00111100',
  ], [C.vio1, C.amb3, C.mag2, C.mag3]),
});

def({
  kind: 'dumpster', ch: 'D', name: 'dumpster', block: true, cover: 1, hp: 40, plating: 3, wake: 'swallow',
  ox: 0, oy: -2,
  art: img([
    '..........',
    '0222222220',
    '0333333330',
    '0111111110',
    '0111441110',
    '0111111110',
    '0111111110',
    '0111111110',
    '0111111110',
    '0011111100',
    '.0.....0..',
    '..........',
  ], [C.grn1, C.grn0, C.grn2, C.amb2]),
});

def({
  kind: 'crate', ch: 'c', name: 'crate', block: true, cover: 1, hp: 14, wake: 'bump',
  ox: 1, oy: 0,
  art: img([
    '........',
    '.000000.',
    '01222210',
    '01211210',
    '01122110',
    '01211210',
    '01222210',
    '01111110',
    '.000000.',
    '........',
  ], [C.mud1, C.mud0, C.mud2]),
});

def({
  kind: 'barrel', ch: 'b', name: 'barrel', block: true, cover: 1, hp: 12, wake: 'bump',
  ox: 2, oy: -1,
  art: img([
    '.0000.',
    '022220',
    '011110',
    '022220',
    '011110',
    '011110',
    '022220',
    '011110',
    '011110',
    '.0000.',
  ], [C.vio1, C.vio2]),
});

def({
  kind: 'fuel', ch: 'e', name: 'fuel drum', block: true, cover: 1, hp: 6, explode: true, wake: 'bump',
  ox: 2, oy: -1,
  art: img([
    '.0000.',
    '022220',
    '011110',
    '033330',
    '030030',
    '033330',
    '011110',
    '011110',
    '022220',
    '.0000.',
  ], [C.red1, C.red2, C.amb3]),
});

def({
  kind: 'lamp', ch: 'L', name: 'streetlamp', block: true, cover: 0, hp: 10, wake: 'swing',
  ox: 2, oy: -12, glow: [3],
  light: { dx: 3, dy: 2, r: 46, i: 1.2, color: LIGHT.sodium, z: 26 },
  art: img([
    '.0000.',
    '011110',
    '.3333.',
    '......',
    '..22..',
    '..22..',
    '..22..',
    '..22..',
    '..22..',
    '..22..',
    '..22..',
    '..22..',
    '..22..',
    '..22..',
    '..22..',
    '..22..',
    '..22..',
    '..22..',
    '.2222.',
    '.0000.',
  ], [C.slate, C.night, C.amb4]),
});

def({
  kind: 'lampcold', ch: 'l', name: 'streetlamp', block: true, cover: 0, hp: 10, wake: 'swing',
  ox: 2, oy: -12, glow: [3],
  light: { dx: 3, dy: 2, r: 42, i: 1.1, color: LIGHT.cold, z: 26 },
  art: img([
    '.0000.',
    '011110',
    '.3333.',
    '......',
    '..22..',
    '..22..',
    '..22..',
    '..22..',
    '..22..',
    '..22..',
    '..22..',
    '..22..',
    '..22..',
    '..22..',
    '..22..',
    '..22..',
    '..22..',
    '..22..',
    '.2222.',
    '.0000.',
  ], [C.slate, C.night, C.cyan4]),
});

def({
  kind: 'vent', ch: 'v', name: 'steam vent', block: false, cover: 0, steam: true, flat: true,
  art: img([
    '..........',
    '..........',
    '..000000..',
    '..011110..',
    '..000000..',
    '..011110..',
    '..000000..',
    '..011110..',
    '..000000..',
    '..........',
  ], [C.slate]),
});

def({
  kind: 'pillar', ch: 'P', name: 'pillar', block: true, cover: 2, opaque: true,
  ox: 1, oy: -10,
  art: img([
    '00000000',
    '01111110',
    '02222220',
    '02122120',
    '02222220',
    '02222220',
    '02122220',
    '02222220',
    '02222220',
    '02222120',
    '02222220',
    '02222220',
    '02122220',
    '02222220',
    '02222220',
    '02222220',
    '02222220',
    '01111110',
    '00000000',
    '........',
  ], [C.slate, C.night]),
});

def({
  kind: 'counter', ch: 'k', name: 'counter', block: true, cover: 1,
  ox: 0, oy: -3,
  art: img([
    '0000000000',
    '1111111111',
    '2222222222',
    '0000000000',
    '3333333333',
    '3303333033',
    '3333333333',
    '3333333333',
    '3333333333',
    '3333333333',
    '0000000000',
    '..........',
    '..........',
  ], [C.gray, C.slate, C.night]),
});

def({
  kind: 'terminal', ch: 'Q', name: 'terminal', block: true, cover: 1, hp: 8, networked: true, use: 'read', wake: 'flash',
  ox: 2, oy: -4, glow: [3],
  light: { dx: 3, dy: 3, r: 16, i: 0.7, color: LIGHT.cyan, z: 8 },
  art: img([
    '000000',
    '011110',
    '013310',
    '013310',
    '011110',
    '.0110.',
    '..11..',
    '..11..',
    '..11..',
    '..11..',
    '.1111.',
    '.0000.',
    '......',
    '......',
  ], [C.slate, C.ink, C.cyan3]),
});

def({
  kind: 'bin', ch: 'Y', name: 'trash can', block: true, cover: 1, hp: 8, wake: 'bump',
  ox: 2, oy: 1,
  art: img([
    '......',
    '.0000.',
    '011110',
    '022220',
    '021220',
    '022220',
    '021220',
    '022220',
    '.0000.',
    '......',
  ], [C.gray, C.slate]),
});

def({
  kind: 'junction', ch: 'J', name: 'junction box', block: true, cover: 1, hp: 10, networked: true, wake: 'flash',
  ox: 2, oy: -3, glow: [3],
  light: { dx: 3, dy: 3, r: 10, i: 0.6, color: LIGHT.green, z: 8 },
  art: img([
    '000000',
    '011110',
    '012210',
    '013010',
    '012210',
    '011110',
    '000000',
    '..22..',
    '..22..',
    '..22..',
    '.2222.',
    '.0000.',
    '......',
  ], [C.grn1, C.slate, C.grn4]),
});

def({
  kind: 'noodlecart', ch: 'N', name: 'noodle stall', block: true, cover: 1, w: 2, use: 'buy',
  ox: 0, oy: -9, glow: [4],
  light: { dx: 10, dy: 6, r: 30, i: 1.0, color: LIGHT.amber, z: 14 },
  art: img([
    '....................',
    '.000000000000000000.',
    '01212121212121212120',
    '02121212121212121210',
    '.000000000000000000.',
    '..0..............0..',
    '..0...4.....4....0..',
    '..0..444...444...0..',
    '..0...4.....4....0..',
    '..0..............0..',
    '00000000000000000000',
    '03333333333333333330',
    '03300033333300033330',
    '03333333333333333330',
    '03333333333333333330',
    '03333333333333333330',
    '03333333333333333330',
    '03333333333333333330',
    '.000000000000000000.',
    '..0..............0..',
  ], [C.mag2, C.cyan2, C.mud1, C.amb4]),
});

def({
  kind: 'car', ch: 'R', name: 'car', block: true, cover: 1, w: 2, hp: 50, plating: 4, wake: 'ram', networked: true,
  ox: 0, oy: -3, glow: [4],
  art: img([
    '....................',
    '.....0000000000.....',
    '....011111111110....',
    '...01222222222210...',
    '...01222222222210...',
    '.000111111111111000.',
    '03333333333333333330',
    '43333333333333333334',
    '43333333333333333334',
    '03333333333333333330',
    '.000000000000000000.',
    '..00............00..',
    '..00............00..',
  ], [C.slate, C.cyan1, C.vio1, C.amb4]),
});

def({
  kind: 'table', ch: 'j', name: 'table', block: true, cover: 1,
  ox: 0, oy: -2,
  art: img([
    '..........',
    '0000000000',
    '0111111110',
    '0111111110',
    '0222222220',
    '0000000000',
    '.0......0.',
    '.0......0.',
    '.0......0.',
    '.0......0.',
    '..........',
    '..........',
  ], [C.mud1, C.mud0]),
});

def({
  kind: 'chair', ch: 'h', name: 'chair', block: false, cover: 0, use: 'sit', flat: true,
  ox: 2, oy: 0,
  art: img([
    '......',
    '.0000.',
    '.0110.',
    '.0110.',
    '.0110.',
    '000000',
    '011110',
    '000000',
    '.0..0.',
    '.0..0.',
  ], [C.vio1]),
});

def({
  kind: 'bed', ch: 'Z', name: 'bed', block: true, cover: 1, h: 2,
  ox: 0, oy: 0,
  art: img([
    '0000000000',
    '0222222220',
    '0233332220',
    '0233332220',
    '0222222220',
    '0111111110',
    '0111111110',
    '0111111110',
    '0111111110',
    '0111111110',
    '0111111110',
    '0111111110',
    '0111111110',
    '0111111110',
    '0111111110',
    '0111111110',
    '0111111110',
    '0000000000',
    '.0......0.',
    '..........',
  ], [C.vio1, C.slate, C.pale]),
});

def({
  kind: 'shelf', ch: 'F', name: 'shelf', block: true, cover: 2, use: 'loot',
  ox: 0, oy: -8,
  art: img([
    '0000000000',
    '0111111110',
    '0123413210',
    '0111111110',
    '0000000000',
    '0111111110',
    '0142231410',
    '0111111110',
    '0000000000',
    '0111111110',
    '0133224310',
    '0111111110',
    '0000000000',
    '0111111110',
    '0111111110',
    '0111111110',
    '0000000000',
    '..........',
  ], [C.mud0, C.cyan2, C.mag2, C.amb2]),
});

def({
  kind: 'locker', ch: 'O', name: 'locker', block: true, cover: 2, use: 'loot',
  ox: 1, oy: -6,
  art: img([
    '00000000',
    '01111110',
    '01222210',
    '01222210',
    '01111110',
    '01111110',
    '01131110',
    '01111110',
    '01222210',
    '01222210',
    '01111110',
    '01111110',
    '01111110',
    '01111110',
    '00000000',
    '........',
  ], [C.steel1, C.steel0, C.amb3]),
});

def({
  kind: 'stash', ch: 'x', name: 'stash', block: true, cover: 1, use: 'loot',
  ox: 1, oy: 1,
  art: img([
    '........',
    '00000000',
    '01111110',
    '01222210',
    '01233210',
    '01111110',
    '01111110',
    '00000000',
    '........',
    '........',
  ], [C.night, C.slate, C.amb2]),
});

def({
  kind: 'sandbag', ch: 'g', name: 'sandbags', block: true, cover: 1,
  ox: 0, oy: 0,
  art: img([
    '..........',
    '..........',
    '..........',
    '.00000000.',
    '0111011110',
    '0111011110',
    '0000000000',
    '1101111011',
    '1101111011',
    '0000000000',
  ], [C.mud1]),
});

def({
  kind: 'post', ch: 'y', name: 'mooring post', block: true, cover: 1,
  ox: 3, oy: -2,
  art: img([
    '.00.',
    '0110',
    '0220',
    '0110',
    '0110',
    '0110',
    '0110',
    '0110',
    '0110',
    '0110',
    '0110',
    '.00.',
  ], [C.mud1, C.amb3]),
});

def({
  kind: 'pipes', ch: 'i', name: 'pipes', block: true, cover: 1,
  ox: 0, oy: -1,
  art: img([
    '..........',
    '0000000000',
    '1111111111',
    '2222222222',
    '0000000000',
    '0000000000',
    '1111111111',
    '2222222222',
    '0000000000',
    '..0....0..',
    '..0....0..',
  ], [C.cyan1, C.cyan0]),
});

def({
  kind: 'speaker', ch: 'W', name: 'speaker stack', block: true, cover: 2, hp: 20, wake: 'blast',
  ox: 1, oy: -6,
  art: img([
    '00000000',
    '01111110',
    '01022010',
    '01200210',
    '01022010',
    '01111110',
    '01111110',
    '01022010',
    '01200210',
    '01200210',
    '01022010',
    '01111110',
    '01111110',
    '01111110',
    '00000000',
    '........',
  ], [C.night, C.slate]),
});

def({
  kind: 'forklift', ch: 'f', name: 'forklift', block: true, cover: 1, hp: 40, plating: 3, wake: 'lift',
  ox: 0, oy: -6,
  art: img([
    '..........',
    '.0000000..',
    '.0.....0..',
    '.0.....0..',
    '.0.....0..',
    '.0000000..',
    '.0222220..',
    '00222220.3',
    '01111110.3',
    '01111110.3',
    '01111110.3',
    '01111110333',
    '00000000...',
    '.00..00....',
    '.00..00....',
    '...........',
  ], [C.amb2, C.amb3, C.slate]),
});

def({
  kind: 'turret', ch: 'u', name: 'turret', block: true, cover: 1, hp: 22, plating: 4, wake: 'shoot', networked: true,
  ox: 1, oy: -3, glow: [4],
  light: { dx: 4, dy: 3, r: 8, i: 0.6, color: LIGHT.red, z: 6 },
  art: img([
    '........',
    '..0000..',
    '.011110.',
    '0114411000',
    '011111122.',
    '.011110...',
    '..0220....',
    '..0220....',
    '.022220...',
    '.000000...',
    '..........',
    '..........',
    '..........',
  ], [C.steel2, C.steel1, C.red2, C.red3]),
});

def({
  kind: 'planter', ch: 'z', name: 'planter', block: true, cover: 1,
  ox: 1, oy: -3,
  art: img([
    '..3..3..',
    '.33.33..',
    '..3333.3',
    '.3.33.3.',
    '..3333..',
    '00000000',
    '01111110',
    '01222210',
    '01111110',
    '01111110',
    '00000000',
    '........',
    '........',
  ], [C.slate, C.night, C.grn1]),
});

def({
  kind: 'statue', name: 'statue', block: true, cover: 2, opaque: true,
  ox: 0, oy: -20, w: 1,
  art: img([
    '.......2..',
    '......212.',
    '......2...',
    '...111.2..',
    '..11111.2.',
    '..12121.2.',
    '..11111.2.',
    '...111.2..',
    '..1111122.',
    '.1111111..',
    '.1111111..',
    '..11111...',
    '..11111...',
    '..11111...',
    '..11111...',
    '..1...1...',
    '..1...1...',
    '0000000000',
    '0333333330',
    '0333333330',
    '0333333330',
    '0333333330',
    '0333333330',
    '0333333330',
    '0333333330',
    '0333333330',
    '0333333330',
    '0333333330',
    '0000000000',
    '..........',
  ], [C.amb2, C.red2, C.slate]),
});

def({
  kind: 'door', name: 'door', block: false, cover: 0, use: 'door', flat: true,
  art: img([
    '0000000000',
    '0111111110',
    '0122222210',
    '0122222210',
    '0122222210',
    '0122223210',
    '0122222210',
    '0122222210',
    '0122222210',
    '0000000000',
  ], [C.night, C.ink, C.amb3]),
});

def({
  kind: 'mat', name: 'mat', block: false, cover: 0, flat: true,
  art: img([
    '..........',
    '..........',
    '.00000000.',
    '.01111110.',
    '.01222210.',
    '.01222210.',
    '.01111110.',
    '.00000000.',
    '..........',
    '..........',
  ], [C.mag0, C.vio0]),
});

def({
  kind: 'flag', name: 'flag', block: false, cover: 0, flat: true, use: 'read',
  ox: 0, oy: -6,
  art: img([
    '0000000000',
    '0111111110',
    '0222222220',
    '0333333330',
    '0222222220',
    '0111111110',
    '0000000000',
    '..........',
  ], [C.cyan3, C.mag4, C.white]),
});

def({
  kind: 'jar', name: 'jar', block: false, cover: 0, use: 'read',
  ox: 3, oy: 2,
  art: img([
    '....',
    '0000',
    '1111',
    '1221',
    '1221',
    '1111',
    '....',
  ], [C.cyan4, C.amb3]),
});

def({
  kind: 'case', name: 'sealed case', block: false, cover: 0, use: 'use',
  ox: 1, oy: 2, glow: [3],
  art: img([
    '........',
    '.000000.',
    '01111110',
    '01233210',
    '01111110',
    '01111110',
    '.000000.',
    '........',
  ], [C.steel2, C.white, C.red2]),
});

def({
  kind: 'bollard', ch: 'T', name: 'bollard', block: true, cover: 1,
  ox: 3, oy: 1, glow: [2],
  art: img([
    '....',
    '.00.',
    '0220',
    '0110',
    '0110',
    '0110',
    '0110',
    '.00.',
  ], [C.slate, C.amb4]),
});

def({
  kind: 'tv', name: 'screen', block: true, cover: 1, glow: [3], hp: 6,
  ox: 1, oy: -2,
  light: { dx: 4, dy: 3, r: 14, i: 0.6, color: LIGHT.violet, z: 8 },
  art: img([
    '00000000',
    '01111110',
    '01333310',
    '01333310',
    '01333310',
    '01111110',
    '00000000',
    '...00...',
    '.000000.',
    '........',
  ], [C.night, C.slate, C.vio3]),
});

def({
  kind: 'washer', ch: 'M', name: 'washing machine', block: true, cover: 1, hp: 18, plating: 2, wake: 'bump',
  ox: 1, oy: -2,
  art: img([
    '00000000',
    '01111110',
    '01131110',
    '01111110',
    '01000010',
    '01022010',
    '01022010',
    '01000010',
    '01111110',
    '01111110',
    '00000000',
    '........',
  ], [C.pale, C.cyan1, C.amb3]),
});

def({
  kind: 'boat', name: 'boat', block: true, cover: 1, w: 2, h: 1,
  ox: 0, oy: 0,
  art: img([
    '....................',
    '..0000000000000000..',
    '.011111111111111110.',
    '01222222222222222210',
    '01233333333333333210',
    '01222222222222222210',
    '.011111111111111110.',
    '..0000000000000000..',
    '....................',
    '....................',
  ], [C.cyan1, C.mud1, C.mud0]),
});
def({
  kind: 'debris', name: 'debris', block: false, cover: 0, flat: true,
  art: img([
    '..........',
    '.1........',
    '..12...2..',
    '...1..21..',
    '.2...1....',
    '..1.....1.',
    '.....12...',
    '.21....1..',
    '...2..1...',
    '..........',
  ], [C.gray, C.slate]),
});

def({
  kind: 'poster', name: 'wanted poster', block: false, cover: 0, flat: true, use: 'read',
  ox: 1, oy: -8,
  art: img([
    '00000000',
    '04444440',
    '01111110',
    '01233210',
    '01222210',
    '01111110',
    '01434410',
    '00000000',
  ], [C.pale, C.skin2, C.night, C.red2]),
});

def({
  kind: 'bulbs', name: 'string lights', block: false, cover: 0, glow: [2],
  ox: 0, oy: -9,
  light: { dx: 5, dy: 4, r: 20, i: 0.6, color: LIGHT.amber, z: 22 },
  art: img([
    '1.........',
    '.11.....11',
    '...1.2.1..',
    '....111...',
    '.....2....',
  ], [C.night, C.amb4]),
});
def({
  kind: 'bulbs2', name: 'string lights', block: false, cover: 0, glow: [2],
  ox: 0, oy: -9,
  light: { dx: 5, dy: 4, r: 20, i: 0.6, color: LIGHT.magenta, z: 22 },
  art: img([
    '1.........',
    '.11.....11',
    '...1.2.1..',
    '....111...',
    '.....2....',
  ], [C.night, C.mag3]),
});
def({
  kind: 'bulbs3', name: 'string lights', block: false, cover: 0, glow: [2],
  ox: 0, oy: -9,
  light: { dx: 5, dy: 4, r: 20, i: 0.6, color: LIGHT.cyan, z: 22 },
  art: img([
    '1.........',
    '.11.....11',
    '...1.2.1..',
    '....111...',
    '.....2....',
  ], [C.night, C.cyan3]),
});

for (const d of P) if (!d.wet) d.wet = false;

export const PROPS = new Map<string, PropDef>(P.map((d) => [d.kind, d]));
export const PROP_BY_CH = new Map<string, string>(P.filter((d) => d.ch).map((d) => [d.ch!, d.kind]));
