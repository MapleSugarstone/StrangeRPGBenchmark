// Sprites, tiles, backdrops, and effects. Flat colors, ink outlines, hard edges, dither instead of blends.
var SPR = {
  pilFront: [
    '................',
    '........kk......',
    '.......kYYk.....',
    '......kBYk......',
    '.....kBBYYk.....',
    '...kkkkkkkkkk...',
    '...kBBBBYYYYk...',
    '...kBwkBYkwYYk..',
    '...kBkkBYkkYYk..',
    '...keBBBYYYeYk..',
    '...kBBBkkYYYYk..',
    '...kBBBBYYYYk...',
    '...kkkkkkkkk....',
    '.....kbBYyk.....',
    '.....kbBYyk.....',
    '.....kk..kk.....',
  ],
  pilSide: [
    '................',
    '..........kk....',
    '.........kYYk...',
    '........kYYk....',
    '.......kYYYYk...',
    '....kkkkkkkkkk..',
    '.....kBYYYYYYk..',
    '.....kBYYYYkwYk.',
    '.....kBYYYYkkYk.',
    '.....kBYYYYYeYk.',
    '.....kBYYYYYYk..',
    '.....kBYYYYYk...',
    '......kkkkkkk...',
    '.......kbYyk....',
    '.......kbYyk....',
    '.......kk.kk....',
  ],
  pilBack: [
    '................',
    '........kk......',
    '.......kYYk.....',
    '......kYBk......',
    '.....kYYBBk.....',
    '...kkkkkkkkkk...',
    '...kYYYYBBBBk...',
    '...kYYYYBBBBBk..',
    '...kYYYYBBBBBk..',
    '...kYYYYBBBBBk..',
    '...kYYYYBBBBBk..',
    '...kYYYYBBBBk...',
    '...kkkkkkkkk....',
    '.....kyYBbk.....',
    '.....kyYBbk.....',
    '.....kk..kk.....',
  ],
  husk: [
    '......k....k....',
    '.......k..k.....',
    '...kkkkkkkkkk...',
    '...kRRRR1111k...',
    '...kRkkkkkk1k...',
    '...kRkwKKwk1k...',
    '...kRkKKKKk1k...',
    '...kRkwwwwk1k...',
    '...kRkkkkkk1k...',
    '...kRRRR1111k...',
    '...kkkkkkkkkk...',
    '.....krwwk......',
    '.....krYwk......',
    '.....krYwk......',
    '.....kkkkk......',
    '.....kk.kk......',
  ],
  husk2: [
    '.....k......k...',
    '......k....k....',
    '...kkkkkkkkkk...',
    '...kRRRR1111k...',
    '...kRkkkkkk1k...',
    '...kRkwKKwk1k...',
    '...kRkKKKKk1k...',
    '...kRkKwwKk1k...',
    '...kRkkkkkk1k...',
    '...kRRRR1111k...',
    '...kkkkkkkkkk...',
    '.....krwwk......',
    '.....krYwk......',
    '.....krYwk......',
    '.....kkkkk......',
    '....kk...kk.....',
  ],
  ram: [
    '................',
    '................',
    '................',
    '......kkkkk.....',
    '....kkOyOyOkk...',
    '...kOOyOyOyOOk..',
    '..kooOkyOyOyOOk.',
    '..kkwokyOyOyOOk.',
    '..kkkokyOyOyOOk.',
    '..keookyOyOyOOk.',
    '...kookyOyOyOk..',
    '....kkkkkkkkk...',
    '.....k.k..k.k...',
    '................',
    '................',
    '................',
  ],
  ram2: [
    '................',
    '................',
    '................',
    '......kkkkk.....',
    '....kkyOyOykk...',
    '...kyyOyOyOyyk..',
    '..kooOkOyOyOyyk.',
    '..kkwokOyOyOyyk.',
    '..kkkokOyOyOyyk.',
    '..keookOyOyOyyk.',
    '...kookOyOyOyk..',
    '....kkkkkkkkk...',
    '......k.kk.k....',
    '................',
    '................',
    '................',
  ],
  fork: [
    '................',
    '................',
    '........k.......',
    '.......kk.......',
    '.....kkkkkk.....',
    '....kBBBBBBk....',
    '...kBcBBBBBBk...',
    '...kBkwBBkwBk...',
    '...kBkkBBkkBk...',
    '...keBBBBBBek...',
    '...kBBBBBBBBk...',
    '...kBBBBBBBBk...',
    '....kBBBBBBk....',
    '.....kkkkkk.....',
    '.....k.kk.k.....',
    '................',
  ],
  brick: [
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '..kvvvvvvvvvvk..',
    '..kvvvvvvvvvvk..',
    '..kkkkkkkkkkkk..',
    '..koooooooooyk..',
    '..koooooooooyk..',
    '..kookkookkoyk..',
    '..koeoooooeoyk..',
    '..kooookkoooyk..',
    '..koooooooooyk..',
    '..kyyyyyyyyyyk..',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
  ],
  bitr: ['...k...', '..kRk..', '.kRwRk.', '.kRRRk.', 'kRRRRRk', 'kRRRrRk', 'kkkkkkk'],
  bity: ['..kkk..', '.kYwYk.', 'kYYYYYk', 'kYYYYYk', 'kYYYyYk', '.kYyYk.', '..kkk..'],
  bitb: ['kkkkkkk', 'kBwBBBk', 'kBBBBBk', 'kBBBBBk', 'kBBBBBk', 'kBBBbBk', 'kkkkkkk'],
  chip: [
    '..y.y.y.y..',
    '.kkkkkkkkk.',
    '.knnnnnnnk.',
    '.knPPnPPnk.',
    '.knPPPPPnk.',
    '.knnPPPnnk.',
    '.knnnPnnGk.',
    '.kkkkkkkkk.',
    '..y.y.y.y..',
  ],
  tilde: [
    '................',
    '...kkkkk........',
    '..kPPPPPk.......',
    '.kPwkPwkPk......',
    '.kPkkPkkPk..kk..',
    '.kePPPPPek.kTTk.',
    '.kPPPkPPPkkTkTTk',
    '..kPPPPPTTTk.kk.',
    '...kkkkkkkk.....',
    '................',
  ],
  miniRam: ['..kkkk...', '.kOyOyk..', 'kowyOyOk.', 'kkoyOyOk.', 'keoyOyOk.', '.kkkkkk..', '..k..k...'],
  miniFork: ['....k....', '...kk....', '.kkkkkk..', 'kBcBBBBk.', 'kBkBBkBk.', 'kBBBBBBk.', '.kkkkkk..'],
  miniBrick: ['kkkkkkkk.', 'kvvvvvvk.', 'kkkkkkkk.', 'kookkook.', 'koooooyk.', 'kyyyyyyk.', 'kkkkkkkk.'],
  pinger: [
    '................',
    '................',
    '.....kkkkkk.....',
    '....kTTTTTTk....',
    '...kTTkkkkTTk...',
    '...kTkwwkkkTk...',
    '...kTkwkkkkTk...',
    '...kTkkkkkkTk...',
    '...kTTkkkkTTk...',
    '...ktTTTTTTtk...',
    '....kttttttk....',
    '.....kkkkkk.....',
    '.....k.kk.k.....',
    '....k..kk..k....',
    '....k..kk..k....',
    '................',
  ],
  decoy: [
    '................',
    '......kkkk......',
    '.....kooook.....',
    '.....kooook.....',
    '.....kooook.....',
    '......kook......',
    '....kkkookkk....',
    '...koooooooook..',
    '...kooRRRRook...',
    '...kooRwwRook...',
    '...kooRRRRook...',
    '....kooooook....',
    '.....kooook.....',
    '......k22k......',
    '......k22k......',
    '....kkkkkkkk....',
  ],
  swapper: [
    '................',
    '................',
    '.....kkkkkk.....',
    '....kmmmmmmk....',
    '...kmmwmmmmmk...',
    '..kmmwwwwwwmmk..',
    '..kmmmwmmmmmmk..',
    '..kmmmmmmmmmmk..',
    '..kmmmmmmwmmmk..',
    '..kmmwwwwwwmmk..',
    '...kmmmmmwmmk...',
    '....kmmmmmmk....',
    '.....kkkkkk.....',
    '................',
    '................',
    '................',
  ],
  packet: ['.kkkk.', 'kwwwwk', 'kwccwk', 'kwccwk', 'kwwwwk', '.kkkk.'],
  hunter: [
    '......k....k....',
    '.......k..k.....',
    '...kkkkkkkkkk...',
    '...kOOOO1111k...',
    '...kOkkkkkk1k...',
    '...kOkRkkRk1k...',
    '...kOkkRRkk1k...',
    '...kOkwwwwk1k...',
    '...kOkkkkkk1k...',
    '...kOOOO1111k...',
    '...kkkkkkkkkk...',
    '.....kOwwk......',
    '.....kOYwk......',
    '.....kOYwk......',
    '....kkkkkkk.....',
    '...kwwk.kwwk....',
  ],
  clerk: [
    '......kkkk......',
    '.......kk.......',
    '...kkkkkkkkkk...',
    '...kTTTT1111k...',
    '...kTkkkkkk1k...',
    '...kTkwKKwk1k...',
    '...kTkKKKKk1k...',
    '...kTkKwwKk1k...',
    '...kTkkkkkk1k...',
    '...kTTTT1111k...',
    '...kkkkkkkkkk...',
    '.....ktwwk......',
    '.....ktYwk......',
    '.....ktYwk......',
    '.....kkkkk......',
    '.....kk.kk......',
  ],
  hoarder: [
    '................',
    '...kkkkkk.......',
    '...kRRR1k.......',
    '...kRwK1k.......',
    '...kRKw1k.......',
    '...kkkkkkkkkkkk.',
    '...k2k2k2k2k2k..',
    '...k..........k.',
    '...k2k2k2k2k2k..',
    '...k..........k.',
    '...kkkkkkkkkkk..',
    '....k.......k...',
    '...kKk.....kKk..',
    '...kkk.....kkk..',
    '................',
    '................',
  ],
  miniPinger: ['..kkkk...', '.kTTTTk..', 'kTkwkTkk.', 'kTkkkTkTk', '.kttttk..', '..k..k...', '.........'],
  miniMirror: ['kkkkkkkk.', 'kKKKKwck.', 'kKKKwcKk.', 'kKKwcKKk.', 'kKwcKKKk.', 'kkkkkkkk.', '.k....k..'],
  miniDecoy: ['...kk....', '..kook...', '.kooook..', 'koRwRook.', '.kooook..', '..k22k...', '.kkkkkk..'],
  miniSwapper: ['..kkkk...', '.kmmmmk..', 'kmwwwwmk.', 'kmmmmmmk.', 'kmwwwwmk.', '.kmmmmk..', '..kkkk...'],
  miniEcho: ['..k.k....', '.k1c1k...', 'k1c1c1k..', 'k1k1k1k..', 'k1111v1k.', '.k1v11k..', '..k..k...'],
  boss: [
    '................................',
    '..........k..........k..........',
    '...........k........k...........',
    '....kkkkkkkkkkkkkkkkkkkkkkkk....',
    '....kRRRRRRRRRRR11111111111k....',
    '....kRRkkkkkkkkkkkkkkkkkk11k....',
    '....kRRkKKKKKKKKKKKKKKKKk11k....',
    '....kRRkKKKKKKKKKKKKKKKKk11k....',
    '....kRRkKKwwwKKKKKKwwwKKk11k....',
    '....kRRkKKKKKKKKKKKKKKKKk11k....',
    '....kRRkKKwwKKKKKKKKwwKKk11k....',
    '....kRRkKKwwKKKKKKKKwwKKk11k....',
    '....kRRkKKKKKKKKKKKKKKKKk11k....',
    '....kRRkKKKwwwwwwwwwwKKKk11k....',
    '....kRRkKKKKwwYwwwwwKKKKk11k....',
    '....kRRkKKKKKKKKKKKKKKKKk11k....',
    '....kRRkkkkkkkkkkkkkkkkkk11k....',
    '....kRRRRRRRRRRR11111111111k....',
    '....kkkkkkkkkkkkkkkkkkkkkkkk....',
    '........kbbbbbbwwbbbbbbk........',
    '......kkbbbbbbbYYbbbbbbbkk......',
    '.....kbbkbbbbbbYYbbbbbbkbbk.....',
    '.....kbbkbbbbbbYYbbbbbbkbbk.....',
    '.....kbbkbbbbbYYYYbbbbbkbbk.....',
    '.....kkkkbbbbbbYYbbbbbbkkkk.....',
    '........kbbbbbbbbbbbbbbk........',
    '........kbbbbbbbbbbbbbbk........',
    '........kkkkkkkkkkkkkkkk........',
    '..........kbbk....kbbk..........',
    '..........kbbk....kbbk..........',
    '.........kkkkk....kkkkk.........',
    '................................',
  ],
  heart: ['.k.k.', 'kRkRk', 'kRRRk', '.kRk.', '..k..'],
  heartEmpty: ['.k.k.', 'k4k4k', 'k444k', '.k4k.', '..k..'],
  spark: ['..w..', '.wcw.', 'wcYcw', '.wcw.', '..w..'],
  bang: ['.kkkkk.', 'kwwkwwk', 'kwwkwwk', 'kwwkwwk', 'kwwwwwk', 'kwwkwwk', '.kkkkk.', '..kk...', '..k....'],
};

// Larger boss sprites are built from rectangles and circles into ordinary sprite rows.
function shapeSprite(w, h, draw) {
  var g2 = []; for (var j = 0; j < h; j++) { g2.push([]); for (var i = 0; i < w; i++) g2[j].push('.'); }
  function R(x, y, ww, hh, c) { for (var b = y; b < y + hh; b++) for (var a = x; a < x + ww; a++) if (a >= 0 && b >= 0 && a < w && b < h) g2[b][a] = c; }
  function box(x, y, ww, hh, fill) { R(x, y, ww, hh, 'k'); R(x + 1, y + 1, ww - 2, hh - 2, fill); }
  function disc(cx, cy, r, c) { for (var b = -r; b <= r; b++) for (var a = -r; a <= r; a++) if (a * a + b * b <= r * r + r) R(cx + a, cy + b, 1, 1, c); }
  draw(R, box, disc);
  return g2.map(function (r) { return r.join(''); });
}
// The Forklift faces right: a mast and forks in front, a cab with a screen face, a yellow body, and two wheels.
SPR.forklift = shapeSprite(32, 32, function (R, box, disc) {
  box(22, 3, 5, 25, '3'); R(24, 4, 1, 23, '2');
  box(26, 22, 6, 3, '2'); box(26, 16, 6, 3, '2');
  box(4, 3, 16, 11, '4'); box(6, 5, 12, 8, 'K');
  R(8, 7, 2, 2, 'w'); R(14, 7, 2, 2, 'w'); R(9, 10, 6, 1, 'w'); R(11, 11, 2, 1, 'Y');
  box(1, 13, 23, 11, 'Y'); R(2, 20, 21, 3, 'y');
  for (var i = 2; i < 23; i += 4) R(i, 14, 2, 2, 'k');
  disc(7, 25, 4, 'k'); disc(7, 25, 2, '3'); R(7, 25, 1, 1, 'k');
  disc(18, 25, 4, 'k'); disc(18, 25, 2, '3'); R(18, 25, 1, 1, 'k');
});
SPR.hardhat = shapeSprite(32, 6, function (R, box) {
  box(6, 0, 20, 5, 'Y'); R(3, 4, 26, 2, 'k'); R(4, 4, 24, 1, 'Y'); R(15, 1, 2, 3, 'y');
});
var BOSS_SWAP = {
  foreman: { swap: { b: 'O', R: 'O', Y: 'y' } },
  warden: { swap: { b: '4', R: '3', '1': '2', w: 'R' } },
};

var AREAS = [
  { name: 'The Lobby', floorA: '#e9a38c', floorB: '#f4dfc4', scuff: '#d88f7a', cliff: '#8a4a52', cliffDk: '#4a2238', wallTop: '#6b3f8f', wallIn: '#5f3680', wallHi: '#a07ac4', wallFront: '#2e1840', trim: '#ffd23f', crack: '#c9b0e6', band: ['#0b0716', '#160c2a', '#24103a', '#3a1448', '#5a1a52'], shape: '#2a1442' },
  { name: 'The Sales Floor', floorA: '#86d8bc', floorB: '#d8f6e8', scuff: '#6fc4a6', cliff: '#2f7a72', cliffDk: '#163a44', wallTop: '#d64aa8', wallIn: '#c23c96', wallHi: '#ffa0dc', wallFront: '#741a64', trim: '#ffd23f', crack: '#f7b8e2', band: ['#06101a', '#0b1a2a', '#10283a', '#14384a', '#1a4a56'], shape: '#0f2a3a' },
  { name: 'The Back Rooms', floorA: '#a79dd2', floorB: '#d6cff2', scuff: '#9488c4', cliff: '#4e4680', cliffDk: '#2a2450', wallTop: '#5a5e7e', wallIn: '#50546f', wallHi: '#9498b8', wallFront: '#2c2c44', trim: '#d18a12', crack: '#b4b7d0', band: ['#0a0812', '#121022', '#1c1834', '#2a2048', '#3c2656'], shape: '#1e1a34' },
  { name: 'The Display Hall', floorA: '#a9c4ee', floorB: '#e4eefc', scuff: '#93b0de', cliff: '#3a4a8a', cliffDk: '#1a2050', wallTop: '#2e3f78', wallIn: '#28376a', wallHi: '#6a88cc', wallFront: '#121a3a', trim: '#2ee6c5', crack: '#a8b8e4', band: ['#05060f', '#0a0e22', '#101838', '#16224c', '#1e2e5e'], shape: '#0e1630' },
  { name: 'Loss Prevention', floorA: '#e6cf86', floorB: '#f6ecc6', scuff: '#d4bc72', cliff: '#7a4a2a', cliffDk: '#3a2014', wallTop: '#7e2c30', wallIn: '#70262a', wallHi: '#c0606a', wallFront: '#3a0f14', trim: '#f4f0ff', crack: '#dca4a8', band: ['#0c0406', '#1a080c', '#2a0e12', '#3c1418', '#521a1e'], shape: '#26080c' },
  { name: 'Shipping', floorA: '#b8b09e', floorB: '#ddd6c6', scuff: '#a49c8a', cliff: '#4a4a30', cliffDk: '#24241a', wallTop: '#4c6c3a', wallIn: '#436034', wallHi: '#80a866', wallFront: '#22341a', trim: '#ffd23f', crack: '#b4c8a4', band: ['#050806', '#0a120c', '#101c12', '#18281a', '#223422'], shape: '#0e180e' },
  { name: 'Head Office',floorA: '#c87a8c', floorB: '#ecbcc4', scuff: '#b66a7a', cliff: '#5a2a3a', cliffDk: '#2c1420', wallTop: '#6c4a2c', wallIn: '#604226', wallHi: '#a87c4c', wallFront: '#2e1e10', trim: '#ffd23f', crack: '#d4b090', band: ['#0a0610', '#16091c', '#22102a', '#30163a', '#421c48'], shape: '#1c0c22' },
  { name: 'Overtime',floorA: '#9cc6be', floorB: '#d6ece6', scuff: '#88b4ac', cliff: '#2e4a5a', cliffDk: '#16222e', wallTop: '#3c3264', wallIn: '#352c5a', wallHi: '#7064ac', wallFront: '#1a1432', trim: '#ff8fc7', crack: '#b4acdc', band: ['#030308', '#080814', '#0e0e22', '#141632', '#1c1e44'], shape: '#0c0c1e' },
  { name: 'The Food Court', floorA: '#e8c8b0', floorB: '#f8eadc', scuff: '#d8b098', cliff: '#7a3a2a', cliffDk: '#3a1a12', wallTop: '#c8402c', wallIn: '#b03826', wallHi: '#f08a6c', wallFront: '#5a1810', trim: '#ffd23f', crack: '#f0b0a0', band: ['#0c0604', '#1a0c08', '#2a120c', '#3c1a10', '#522414'], shape: '#220c08' },
  { name: 'The Arcade', floorA: '#463c84', floorB: '#5a4ea0', scuff: '#5a4ea0', cliff: '#2a2050', cliffDk: '#140e2a', wallTop: '#1e1838', wallIn: '#2a2050', wallHi: '#ff8fc7', wallFront: '#0e0a1e', trim: '#2ee6c5', crack: '#8a7ac0', band: ['#04020a', '#0a0616', '#120a24', '#1c1034', '#281646'], shape: '#120c24' },
  { name: 'The Garden Center', floorA: '#b89868', floorB: '#e0c898', scuff: '#c8a878', cliff: '#6a4a2a', cliffDk: '#3a2614', wallTop: '#3a6a2a', wallIn: '#2e5a22', wallHi: '#7ab84a', wallFront: '#5a3a1a', trim: '#ff8fc7', crack: '#9ac87a', band: ['#030806', '#06100a', '#0a1a10', '#102818', '#183822'], shape: '#0a1a0e' },
  { name: 'The Server Room', floorA: '#8aa0b8', floorB: '#b8c8d8', scuff: '#7a90a8', cliff: '#2a3a52', cliffDk: '#141c2a', wallTop: '#1e2638', wallIn: '#161c2c', wallHi: '#4a6a9a', wallFront: '#0c1018', trim: '#2ee6c5', crack: '#6a8ab8', band: ['#020408', '#040a12', '#08121e', '#0e1a2c', '#14243c'], shape: '#08101c' },
  { name: 'The Parking Garage', floorA: '#6a6a72', floorB: '#84848e', scuff: '#5a5a62', cliff: '#3a3a42', cliffDk: '#1e1e26', wallTop: '#9a9aa2', wallIn: '#8a8a92', wallHi: '#c8c8d0', wallFront: '#4a4a52', trim: '#ffd23f', crack: '#b8b8c0', band: ['#05050a', '#0a0a12', '#10101c', '#181828', '#202034'], shape: '#0c0c16' },
  { name: 'The Cinema', floorA: '#6a1a2e', floorB: '#8a2a40', scuff: '#5a1424', cliff: '#3a0e18', cliffDk: '#1e060c', wallTop: '#a01e30', wallIn: '#7a1626', wallHi: '#e05a6a', wallFront: '#3a0810', trim: '#ffd23f', crack: '#c84a5a', band: ['#060204', '#0e0408', '#18060c', '#240a12', '#320e18'], shape: '#14040a' },
  { name: 'The Toy Store', floorA: '#f0d070', floorB: '#f8e8a8', scuff: '#e0c060', cliff: '#8a5a2a', cliffDk: '#4a2e14', wallTop: '#3a7ae0', wallIn: '#2a5ac0', wallHi: '#8ab8ff', wallFront: '#1a2a6a', trim: '#ff3b4e', crack: '#a8c8ff', band: ['#04040c', '#080a1a', '#0e122a', '#141a3c', '#1c2450'], shape: '#0a0e22' },
  { name: 'The Atrium', floorA: '#8e8aa8', floorB: '#c4c0d8', scuff: '#7c7898', cliff: '#2a2640', cliffDk: '#141224', wallTop: '#2a2a3a', wallIn: '#20202e', wallHi: '#5a5a78', wallFront: '#101018', trim: '#2ee6c5', crack: '#9a96b8', band: ['#020205', '#06060c', '#0c0a16', '#141022', '#1e1630'], shape: '#0c0a18' },
  { name: 'After Hours', floorA: '#f0b8a0', floorB: '#fce4cc', scuff: '#e0a48c', cliff: '#8a4a5a', cliffDk: '#4a2238', wallTop: '#e07a5a', wallIn: '#d06a4c', wallHi: '#ffb890', wallFront: '#6a2a3a', trim: '#ffd23f', crack: '#ffd0b8', band: ['#1a0c20', '#2e1430', '#4a1e3c', '#6e2a44', '#a0404a'], shape: '#3a1630' },
];
// Each area's floor pattern and wall style, so every wing of the ruins reads as its own place.
[['checker', 'panel'], ['tile', 'shelf'], ['plank', 'crate'], ['gloss', 'screen'], ['grid', 'locker'], ['concrete', 'container'], ['carpet', 'wood'], ['checker', 'window'], ['checker', 'stall'], ['arcade', 'cabinet'], ['paver', 'planter'], ['raised', 'rack'], ['asphalt', 'pillar'], ['velvet', 'curtain'], ['playmat', 'blocks'], ['gloss', 'snow'], ['checker', 'window']]
  .forEach(function (st, i) { if (AREAS[i]) { AREAS[i].floorStyle = st[0]; AREAS[i].wallStyle = st[1]; } });
var GROUP_COLOR = ['#2ee6c5', '#ff8fc7'], GROUP_DARK = ['#127a72', '#c2309e'];
var BIT_COLOR = { r: PAL.red, y: PAL.yellow, b: PAL.cobalt };

// A conveyor: a dark belt with chevrons that scroll the way it carries.
function drawConveyor(x, y, d, t) {
  var horiz = d === 1 || d === 3;
  rect(x, y, 16, 16, PAL.g3);
  if (horiz) { rect(x, y + 2, 16, 12, PAL.g4); rect(x, y, 16, 2, PAL.g2); rect(x, y + 14, 16, 2, PAL.g2); rect(x, y + 1, 16, 1, PAL.ink); rect(x, y + 14, 16, 1, PAL.ink); }
  else { rect(x + 2, y, 12, 16, PAL.g4); rect(x, y, 2, 16, PAL.g2); rect(x + 14, y, 2, 16, PAL.g2); rect(x + 1, y, 1, 16, PAL.ink); rect(x + 14, y, 1, 16, PAL.ink); }
  var off = Math.floor(t * 8) % 8, shape = [[0, 0], [1, 1], [2, 2], [3, 3], [2, 4], [1, 5], [0, 6]];
  for (var k = -1; k < 3; k++) {
    shape.forEach(function (q) {
      for (var w = 0; w < 2; w++) {
        var u = k * 8 + off + q[0] + w, v = 5 + q[1], cx, cy;
        if (u < 2 || u > 13) continue;
        if (d === 1) { cx = u; cy = v - 1; } else if (d === 3) { cx = 15 - u; cy = v - 1; } else if (d === 2) { cx = v - 1; cy = u; } else { cx = v - 1; cy = 15 - u; }
        rect(x + cx, y + cy, 1, 1, PAL.yellow);
      }
    });
  }
}
function drawPlate(x, y, grp, pressed) {
  rect(x + 3, y + 3, 10, 10, PAL.ink);
  rect(x + 4, y + 4, 8, 8, pressed ? GROUP_DARK[grp] : GROUP_COLOR[grp]);
  if (!pressed) rect(x + 4, y + 4, 8, 1, PAL.white);
}
// An automatic sliding door. Open, it leaves its frame posts. Closed, it stands like a wall block.
function drawDoorOpen(x, y, grp) {
  rect(x, y, 2, 16, GROUP_DARK[grp]); rect(x + 14, y, 2, 16, GROUP_DARK[grp]);
  rect(x, y, 1, 16, PAL.ink); rect(x + 15, y, 1, 16, PAL.ink);
}
function drawDoorClosed(x, y, grp) {
  var top = y - LIFT;
  rect(x, top, 16, 16 + LIFT, PAL.ink);
  rect(x + 1, top + 1, 6, 15, GROUP_COLOR[grp]); rect(x + 9, top + 1, 6, 15, GROUP_COLOR[grp]);
  rect(x + 1, top + 1, 6, 1, PAL.white); rect(x + 9, top + 1, 6, 1, PAL.white);
  rect(x + 1, y + 11, 14, LIFT - 1, GROUP_DARK[grp]);
  rect(x + 3, top + 6, 2, 3, PAL.ink); rect(x + 11, top + 6, 2, 3, PAL.ink);
}
// A display case: the floor shows through a dithered pane with a bright edge and two glints.
function drawGlass(x, y) {
  var top = y - 3;
  dither(x + 1, top + 1, 14, 14, null, '#bff2ff', 6);
  frame(x, top, 16, 16, PAL.sky);
  rect(x, y + 13, 16, 3, '#5aa8c8');
  rect(x, y + 13, 16, 1, PAL.ink);
  rect(x + 3, top + 3, 1, 4, PAL.white); rect(x + 4, top + 2, 1, 2, PAL.white); rect(x + 10, top + 9, 1, 3, PAL.white);
}
// A receipt printer: a pale machine with a stripe of its bit color and a paper slot.
function drawPrinter(x, y, color, t) {
  var top = y - LIFT;
  rect(x, top, 16, 16 + LIFT, PAL.ink);
  rect(x + 1, top + 1, 14, 14, PAL.g1);
  rect(x + 1, top + 1, 14, 1, PAL.white);
  rect(x + 3, top + 4, 10, 2, PAL.ink);
  rect(x + 3, top + 9, 10, 3, BIT_COLOR[color]);
  rect(x + 1, y + 11, 14, LIFT - 1, PAL.g3);
  spr(SPR['bit' + color], x + 5, top + 8 - 9);
  if (Math.floor(t * 1.2) & 1) rect(x + 13, y + 12, 1, 1, PAL.lime);
}
// A mirror pane on its stand. o is 0 for / and 1 for \.
function drawMirror(x, y, o, flash) {
  rect(x + 2, y + 1, 12, 12, PAL.ink);
  rect(x + 3, y + 2, 10, 10, flash ? PAL.white : '#1a2a5a');
  for (var i = 0; i < 10; i++) {
    var px = o === 0 ? x + 3 + i : x + 12 - i, py = y + 11 - i;
    rect(px, py, 1, 1, PAL.white);
    if (o === 0 && i < 9) rect(px + 1, py, 1, 1, PAL.sky);
    if (o === 1 && i < 9) rect(px - 1, py, 1, 1, PAL.sky);
  }
  rect(x + 3, y + 13, 2, 2, PAL.ink); rect(x + 11, y + 13, 2, 2, PAL.ink);
  rect(x + 2, y + 1, 12, 1, PAL.ochre);
}
// A recipe keycap on the floor: a bit, a daemon, or the fixed equals sign.
function drawKey(x, y, v) {
  var fixed = v === '=', top = y - 3;
  rect(x + 1, top, 14, 15, PAL.ink);
  rect(x + 2, top + 1, 12, 10, fixed ? PAL.g3 : PAL.g1);
  rect(x + 2, top + 1, 12, 1, fixed ? PAL.g2 : PAL.white);
  rect(x + 2, top + 11, 12, 3, fixed ? PAL.g4 : PAL.g3);
  if (fixed) { rect(x + 5, top + 4, 6, 1, PAL.ink); rect(x + 5, top + 7, 6, 1, PAL.ink); }
  else if (SPR['bit' + v]) spr(SPR['bit' + v], x + 5, top + 3);
  else if (MINI_OF[v]) spr(SPR[MINI_OF[v]], x + 4, top + 3);
}
var MINI_OF = { ram: 'miniRam', fork: 'miniFork', brick: 'miniBrick', pinger: 'miniPinger', mirror: 'miniMirror', decoy: 'miniDecoy', swapper: 'miniSwapper', echo: 'miniEcho', toy: 'miniToy' };
var ECHO_SWAP ={ swap: { B: '1', Y: 'v', b: '2', y: '2', e: '1', k: '3' } };

function hash2(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; }

// A split moon: a square cobalt half and a round ochre half.
function drawMoon(cx, cy, r) {
  for (var dy = -r; dy <= r; dy++) {
    var half = Math.floor(Math.sqrt(r * r - dy * dy));
    rect(cx - r, cy + dy, r, 1, PAL.cobaltDk);
    if (half > 0) rect(cx, cy + dy, half, 1, PAL.ochre);
  }
  rect(cx - r + 4, cy - 4, 3, 3, PAL.ink);
  rect(cx + 4, cy - 4, 3, 3, PAL.ink);
  rect(cx + 5, cy - 4, 1, 1, PAL.white);
}

var _stars = null;
function drawVoid(area, t) {
  var bands = area.band, n = bands.length, bh = Math.ceil(H / n);
  for (var i = 0; i < n; i++) {
    rect(0, i * bh, W, bh, bands[i]);
    if (i > 0) dither(0, i * bh - 2, W, 4, null, bands[i], 8);
  }
  drawMoon(30 + Math.round(Math.sin(t / 9) * 4), 30 + Math.round(Math.sin(t / 5) * 2), 13);
  var drift = (t * 2) % (W + 80);
  g.fillStyle = area.shape;
  for (var k = 0; k < 3; k++) {
    var sx = ((k * 97 + drift) % (W + 80)) - 40, sy = 40 + k * 52, s = 10 + k * 5;
    for (var r = 0; r < s; r++) g.fillRect(Math.round(sx - r), sy + r, r * 2 + 1, 1);
  }
  if (!_stars) {
    _stars = [];
    for (var j = 0; j < 40; j++) { var h = hash2(j, 99); _stars.push([h % W, (h >>> 8) % H, (h >>> 16) % 5]); }
  }
  var phase = Math.floor(t / 1.6);
  _stars.forEach(function (st, idx) {
    if ((idx + phase) % 9 === 0) return;
    rect(st[0], st[1], 1, 1, st[2] === 0 ? PAL.yellow : st[2] === 1 ? PAL.pink : PAL.g2);
  });
}

function drawFloor(x, y, area, tx, ty) {
  var h = hash2(tx, ty), A = area.floorA, B = area.floorB, i;
  switch (area.floorStyle) {
    case 'tile':
      rect(x, y, 16, 16, B);
      rect(x, y, 16, 1, A); rect(x, y + 8, 16, 1, A); rect(x, y, 1, 16, A); rect(x + 8, y, 1, 16, A);
      break;
    case 'plank':
      rect(x, y, 16, 16, B);
      for (i = 0; i < 4; i++) { rect(x, y + i * 4 + 3, 16, 1, A); rect(x + (h >>> (i * 3)) % 16, y + i * 4, 1, 3, A); }
      break;
    case 'gloss':
      rect(x, y, 16, 16, (tx + ty) & 1 ? A : B);
      if ((tx + ty) & 1) for (i = 0; i < 4; i++) rect(x + 9 + i, y + 2 + i, 1, 1, PAL.white);
      break;
    case 'grid':
      rect(x, y, 16, 16, B);
      frame(x, y, 16, 16, A);
      rect(x + 7, y + 7, 2, 2, A);
      break;
    case 'concrete':
      rect(x, y, 16, 16, B);
      for (i = 0; i < 5; i++) rect(x + (h >>> (i * 4)) % 15, y + (h >>> (i * 4 + 2)) % 15, 1, 1, A);
      if (tx % 5 === 0) rect(x + 6, y, 3, 16, '#d8c050');
      return;
    case 'carpet':
      rect(x, y, 16, 16, A);
      for (i = 0; i < 4; i++) { rect(x + 7 - i, y + 4 + i, 1, 1, B); rect(x + 8 + i, y + 4 + i, 1, 1, B); rect(x + 7 - i, y + 11 - i, 1, 1, B); rect(x + 8 + i, y + 11 - i, 1, 1, B); }
      return;
    case 'playmat':
      rect(x, y, 16, 16, (tx + ty) & 1 ? A : B);
      if (h % 3 === 0) rect(x + 4 + (h >>> 5) % 8, y + 4 + (h >>> 9) % 8, 2, 2, [PAL.red, PAL.cobalt, PAL.green][(h >>> 13) % 3]);
      return;
    case 'velvet':
      rect(x, y, 16, 16, A);
      if ((tx + ty) & 1) { rect(x + 7, y + 3, 2, 1, B); rect(x + 6, y + 4, 4, 1, B); rect(x + 7, y + 5, 2, 1, B); }
      else { rect(x + 2, y + 12, 1, 1, B); rect(x + 13, y + 11, 1, 1, B); }
      return;
    case 'asphalt':
      rect(x, y, 16, 16, A);
      if (tx % 3 === 0) rect(x + 1, y, 2, 16, PAL.yellow);
      for (i = 0; i < 3; i++) rect(x + 3 + (h >>> (i * 5)) % 11, y + 2 + (h >>> (i * 5 + 3)) % 12, 1, 1, B);
      return;
    case 'raised':
      rect(x, y, 16, 16, B);
      frame(x, y, 16, 16, A);
      if ((tx + ty) % 3 === 0) for (i = 0; i < 4; i++) for (var gj = 0; gj < 4; gj++) rect(x + 3 + i * 3, y + 3 + gj * 3, 1, 1, A);
      return;
    case 'paver':
      rect(x, y, 16, 16, B);
      rect(x, y + 7, 16, 1, A); rect(x, y + 15, 16, 1, A);
      rect(x + ((ty & 1) ? 3 : 11), y, 1, 7, A); rect(x + ((ty & 1) ? 11 : 3), y + 8, 1, 7, A);
      if (h % 4 === 0) rect(x + 2 + (h >>> 6) % 11, y + 2 + (h >>> 10) % 4, 2, 1, PAL.green);
      return;
    case 'arcade':
      rect(x, y, 16, 16, A);
      var zx = 1 + h % 9, zy = 2 + (h >>> 4) % 10;
      for (i = 0; i < 3; i++) rect(x + zx + i * 2, y + zy + (i & 1), 2, 1, B);
      var nc = [PAL.pink, PAL.teal, PAL.yellow, PAL.lime][(h >>> 8) % 4];
      rect(x + 2 + (h >>> 12) % 12, y + 2 + (h >>> 16) % 12, 1, 1, nc);
      if (h % 3 === 0) { var rx = 3 + (h >>> 20) % 9, ry = 3 + (h >>> 24) % 9; rect(rx + x, ry + y, 3, 1, nc); rect(rx + x, ry + y + 2, 3, 1, nc); rect(rx + x, ry + y + 1, 1, 1, nc); rect(rx + x + 2, ry + y + 1, 1, 1, nc); }
      return;
    default:
      rect(x, y, 16, 16, (tx + ty) & 1 ? A : B);
  }
  if (h % 3 === 0) rect(x + 2 + (h >>> 4) % 11, y + 2 + (h >>> 8) % 11, 2, 1, area.scuff);
  if (h % 5 === 0) rect(x + 2 + (h >>> 12) % 11, y + 3 + (h >>> 16) % 10, 1, 1, area.scuff);
}
function drawCliff(x, y, area) {
  rect(x, y, 16, 4, area.cliff);
  rect(x, y + 4, 16, 2, area.cliffDk);
}

// A raised block. `link` says which neighbors are blocks too, so joined blocks read as one mass.
var LIFT = 5;
function drawBlock(x, y, area, link, cracked) {
  var top = y - LIFT;
  rect(x, top, 16, 16, cracked ? area.crack : area.wallTop);
  if (!cracked) wallFace(x, top, area);
  if (!link.u) { rect(x, top, 16, 1, PAL.ink); rect(x, top + 1, 16, 1, area.wallHi); }
  if (!link.l) { rect(x, top, 1, 16, PAL.ink); rect(x + 1, top + 1, 1, 15, area.wallHi); }
  if (!link.r) rect(x + 15, top, 1, 16, PAL.ink);
  if (!link.d) {
    rect(x, y + 11, 16, LIFT, area.wallFront);
    rect(x, y + 11, 16, 1, PAL.ink);
    rect(x, y + 12, 16, 1, area.trim);
    for (var i = 3; i < 16; i += 4) rect(x + i, y + 13, 1, 3, PAL.ink);
    rect(x, y + 15, 16, 1, PAL.ink);
    if (!link.l) rect(x, y + 11, 1, LIFT, PAL.ink);
    if (!link.r) rect(x + 15, y + 11, 1, LIFT, PAL.ink);
  }
  if (cracked) {
    dither(x + 1, top + 1, 14, 14, null, area.wallTop, 5);
    [[7, 1], [6, 2], [6, 3], [8, 4], [8, 5], [7, 6], [5, 7], [5, 8], [6, 9], [8, 10], [9, 11], [9, 12], [8, 13], [8, 14]].forEach(function (p) { rect(x + p[0], top + p[1], 2, 1, PAL.ink); });
    rect(x + 2, top + 5, 3, 1, PAL.ink); rect(x + 10, top + 8, 4, 1, PAL.ink);
  }
}

// The top face of a wall block, in the area's own style.
function wallFace(x, top, area) {
  var In = area.wallIn, Hi = area.wallHi, i;
  switch (area.wallStyle) {
    case 'shelf':
      rect(x + 2, top + 3, 12, 10, In);
      for (i = 0; i < 4; i++) rect(x + 3 + i * 3, top + 4 + (i & 1), 2, 3, [PAL.red, PAL.yellow, PAL.sky, PAL.lime][i]);
      rect(x + 2, top + 8, 12, 1, Hi);
      for (i = 0; i < 4; i++) rect(x + 3 + i * 3, top + 10 - (i & 1), 2, 2, [PAL.pink, PAL.teal, PAL.orange, PAL.white][i]);
      break;
    case 'crate':
      rect(x + 2, top + 2, 12, 12, In);
      for (i = 0; i < 10; i++) { rect(x + 3 + i, top + 3 + i, 1, 1, Hi); rect(x + 12 - i, top + 3 + i, 1, 1, Hi); }
      frame(x + 2, top + 2, 12, 12, Hi);
      break;
    case 'screen':
      rect(x + 2, top + 3, 12, 9, PAL.ink);
      rect(x + 3, top + 4, 10, 7, (x >> 4) & 1 ? '#1e4a6a' : '#2a2a5a');
      rect(x + 4, top + 5, 3, 1, PAL.teal); rect(x + 4, top + 7, 6, 1, Hi);
      break;
    case 'locker':
      rect(x + 2, top + 2, 12, 12, In);
      for (i = 0; i < 3; i++) rect(x + 4 + i * 4, top + 3, 1, 10, Hi);
      rect(x + 3, top + 5, 10, 1, PAL.ink);
      break;
    case 'container':
      for (i = 0; i < 8; i++) rect(x + 1 + i * 2, top + 2, 1, 12, i & 1 ? In : Hi);
      break;
    case 'wood':
      rect(x + 2, top + 2, 12, 12, In);
      for (i = 0; i < 4; i++) rect(x + 2, top + 4 + i * 3, 12, 1, Hi);
      break;
    case 'stall':
      for (i = 0; i < 8; i++) rect(x + i * 2, top + 1, 2, 6, i & 1 ? PAL.white : In);
      rect(x, top + 7, 16, 1, PAL.ink);
      rect(x + 3, top + 9, 10, 5, PAL.ink); rect(x + 4, top + 10, 8, 3, '#2a2a2a');
      rect(x + 5, top + 11, 2, 1, PAL.yellow); rect(x + 8, top + 11, 3, 1, PAL.white);
      break;
    case 'blocks':
      var bc = [PAL.red, PAL.yellow, PAL.cobalt, PAL.green][((x >> 4) + (top >> 4)) & 3];
      rect(x + 2, top + 2, 12, 12, PAL.ink); rect(x + 3, top + 3, 10, 10, bc); rect(x + 3, top + 3, 10, 1, PAL.white);
      rect(x + 6, top + 5, 4, 6, PAL.white); rect(x + 7, top + 6, 2, 4, bc);
      break;
    case 'curtain':
      for (i = 0; i < 8; i++) rect(x + i * 2, top + 1, 2, 13, i & 1 ? In : area.wallTop);
      rect(x, top + 1, 16, 2, PAL.ochre); rect(x, top + 3, 16, 1, PAL.ink);
      break;
    case 'pillar':
      rect(x + 2, top + 2, 12, 12, In);
      for (i = 0; i < 6; i++) rect(x + 2 + i * 2, top + 10, 2, 3, i & 1 ? PAL.ink : PAL.yellow);
      rect(x + 3, top + 3, 4, 1, Hi);
      break;
    case 'rack':
      rect(x + 2, top + 1, 12, 13, In);
      for (i = 0; i < 4; i++) {
        rect(x + 3, top + 2 + i * 3, 10, 2, area.wallTop);
        rect(x + 4, top + 2 + i * 3, 1, 1, ((x >> 4) + i + (top >> 4)) % 3 ? PAL.lime : PAL.red);
        rect(x + 6, top + 2 + i * 3, 1, 1, PAL.teal);
      }
      break;
    case 'hedge':
      rect(x + 2, top + 2, 12, 12, In);
      for (i = 0; i < 5; i++) { var lx = 2 + ((x >> 4) * 3 + i * 5) % 11, ly = 2 + (i * 7 + (top >> 4)) % 11; rect(x + lx, top + ly, 3, 2, Hi); rect(x + lx + 1, top + ly + 2, 1, 1, area.wallTop); }
      if (((x >> 4) + (top >> 4)) % 3 === 0) { rect(x + 7, top + 6, 2, 2, area.trim); rect(x + 7, top + 6, 1, 1, PAL.white); }
      break;
    case 'planter':
      rect(x + 1, top + 1, 14, 9, In);
      for (i = 0; i < 4; i++) rect(x + 2 + i * 3, top + 2 + (i & 1) * 2, 3, 3, Hi);
      rect(x + 4, top + 3, 1, 1, PAL.pink); rect(x + 10, top + 5, 1, 1, PAL.yellow);
      rect(x + 1, top + 10, 14, 4, '#8a5a2a'); rect(x + 1, top + 10, 14, 1, '#b07a3a');
      break;
    case 'cabinet':
      rect(x + 2, top + 2, 12, 9, PAL.ink);
      rect(x + 3, top + 3, 10, 7, ((x >> 4) + (top >> 4)) % 3 === 0 ? '#2a1a5a' : '#1a2a4a');
      rect(x + 4, top + 4, 2, 2, [PAL.pink, PAL.teal, PAL.yellow][(x >> 4) % 3]);
      rect(x + 8, top + 7, 3, 1, PAL.lime);
      rect(x + 3, top + 12, 2, 1, PAL.red); rect(x + 7, top + 12, 1, 1, PAL.yellow); rect(x + 10, top + 12, 1, 1, PAL.sky);
      break;
    case 'snow': {
      rect(x + 3, top + 3, 10, 10, '#0a0a1e');
      var sn = Math.floor(Game.t * 8);
      for (i = 0; i < 6; i++) { var hs = ((x * 31 + top * 17 + i * 7919) ^ (sn * 104729)) >>> 0; rect(x + 4 + hs % 8, top + 4 + (hs >>> 4) % 8, 1, 1, hs % 3 ? PAL.g3 : PAL.g1); }
      rect(x + 3, top + 3, 10, 1, Hi);
      break;
    }
    case 'window':
      rect(x + 3, top + 3, 10, 10, '#0a0a1e');
      rect(x + 3, top + 7, 10, 1, Hi); rect(x + 7, top + 3, 1, 10, Hi);
      if ((x * 7 + top) % 3 === 0) rect(x + 5, top + 5, 1, 1, PAL.yellow);
      break;
    default:
      rect(x + 3, top + 3, 10, 10, In);
      rect(x + 3, top + 3, 10, 1, Hi);
  }
}

// Room props on the overworld: the area's signature piece, a plant, or a desk. Each stands on its tile.
function drawProp(x, y, c, area, t) {
  var top = y - 6;
  if (c === 'p') {
    rect(x + 4, y + 8, 8, 7, PAL.ink); rect(x + 5, y + 9, 6, 5, PAL.orange);
    rect(x + 3, top + 2, 10, 10, PAL.ink); rect(x + 4, top + 3, 8, 8, PAL.green); rect(x + 6, top + 4, 3, 2, PAL.lime);
    return;
  }
  if (c === 'c') {
    rect(x, y - 2, 16, 14, PAL.ink); rect(x + 1, y - 1, 14, 6, area.wallHi); rect(x + 1, y + 5, 14, 6, area.wallIn);
    return;
  }
  switch (area.wallStyle) {
    case 'shelf': drawBlock(x, y, area, { u: false, d: false, l: false, r: false }); break;
    case 'crate':
      rect(x + 1, y - 4, 14, 16, PAL.ink); rect(x + 2, y - 3, 12, 14, '#a8784a'); rect(x + 2, y + 3, 12, 1, '#6a4a2a'); rect(x + 7, y - 3, 1, 14, '#6a4a2a');
      break;
    case 'screen':
      rect(x + 7, y + 4, 2, 9, PAL.ink); rect(x + 4, y + 12, 8, 2, PAL.ink);
      rect(x + 1, top, 14, 11, PAL.ink); rect(x + 2, top + 1, 12, 9, (Math.floor(t * 0.7) & 1) ? '#2a6a8a' : '#2a4a7a');
      rect(x + 3, top + 2, 4, 1, PAL.white);
      break;
    case 'snow': {
      rect(x + 7, y + 4, 2, 9, PAL.ink); rect(x + 4, y + 12, 8, 2, PAL.ink);
      rect(x + 1, top, 14, 11, PAL.ink); rect(x + 2, top + 1, 12, 9, '#0a0a1e');
      var sf = Math.floor(t * 8);
      for (var si = 0; si < 9; si++) { var sh = ((si * 7919) ^ (sf * 104729) ^ (x * 31)) >>> 0; rect(x + 2 + sh % 12, top + 1 + (sh >>> 5) % 9, 1, 1, sh % 3 ? PAL.g3 : PAL.g1); }
      break;
    }
    case 'locker':
      rect(x + 7, y - 2, 2, 14, PAL.ink); rect(x + 4, y + 12, 8, 2, PAL.ink);
      rect(x + 3, top, 10, 6, PAL.ink); rect(x + 4, top + 1, 8, 4, PAL.g2); rect(x + 9, top + 2, 2, 2, (Math.floor(t * 1.3) & 1) ? PAL.red : PAL.redDk);
      break;
    case 'container':
      rect(x, y + 6, 16, 6, PAL.ink); rect(x + 1, y + 7, 14, 4, '#a8784a');
      rect(x + 2, y - 4, 12, 10, PAL.ink); rect(x + 3, y - 3, 10, 8, '#c8a070'); rect(x + 3, y + 1, 10, 1, '#8a6a40');
      break;
    case 'blocks':
      rect(x + 3, y - 4, 10, 12, PAL.ink); rect(x + 4, y - 3, 8, 10, '#b07a3a'); rect(x + 4, y - 3, 3, 3, '#b07a3a');
      rect(x + 2, y - 6, 4, 4, PAL.ink); rect(x + 10, y - 6, 4, 4, PAL.ink); rect(x + 3, y - 5, 2, 2, '#b07a3a'); rect(x + 11, y - 5, 2, 2, '#b07a3a');
      rect(x + 6, y - 1, 1, 1, PAL.ink); rect(x + 9, y - 1, 1, 1, PAL.ink); rect(x + 7, y + 1, 2, 1, PAL.ink);
      rect(x + 4, y + 7, 3, 3, PAL.ink); rect(x + 9, y + 7, 3, 3, PAL.ink);
      break;
    case 'curtain':
      rect(x + 1, y - 4, 14, 15, PAL.ink); rect(x + 2, y - 3, 12, 6, area.wallIn); rect(x + 2, y + 3, 12, 7, area.wallTop);
      rect(x + 2, y - 3, 12, 1, area.wallHi); rect(x + 4, y + 5, 3, 3, area.wallIn); rect(x + 9, y + 5, 3, 3, area.wallIn);
      break;
    case 'pillar':
      rect(x, y - 1, 16, 12, PAL.ink); rect(x + 1, y, 14, 7, PAL.cobalt); rect(x + 3, y - 4, 10, 5, PAL.ink); rect(x + 4, y - 3, 8, 3, PAL.sky);
      rect(x + 1, y + 7, 14, 3, PAL.cobaltDk); rect(x + 2, y + 9, 3, 3, PAL.ink); rect(x + 11, y + 9, 3, 3, PAL.ink);
      rect(x + 2, y + 2, 2, 1, PAL.yellow); rect(x + 12, y + 2, 2, 1, PAL.red);
      break;
    case 'rack':
      rect(x + 2, y - 9, 12, 23, PAL.ink); rect(x + 3, y - 8, 10, 21, area.wallIn);
      for (var ri = 0; ri < 6; ri++) { rect(x + 4, y - 7 + ri * 3, 8, 2, area.wallTop); rect(x + 5, y - 7 + ri * 3, 1, 1, (Math.floor(t * 2) + ri) % 3 ? PAL.lime : PAL.red); rect(x + 7, y - 7 + ri * 3, 1, 1, PAL.teal); }
      break;
    case 'planter':
      rect(x + 1, y + 2, 14, 11, PAL.ink); rect(x + 2, y + 3, 12, 9, '#8a5a2a'); rect(x + 2, y + 3, 12, 1, '#b07a3a');
      rect(x + 2, y - 6, 12, 9, PAL.ink); rect(x + 3, y - 5, 10, 8, area.wallIn);
      for (var pi2 = 0; pi2 < 3; pi2++) rect(x + 3 + pi2 * 4, y - 6 + (pi2 & 1) * 2, 3, 3, area.wallHi);
      rect(x + 5, y - 4, 1, 1, PAL.pink); rect(x + 10, y - 3, 1, 1, PAL.yellow);
      break;
    case 'cabinet':
      rect(x + 2, y - 9, 12, 23, PAL.ink);
      rect(x + 3, y - 8, 10, 21, area.wallIn);
      rect(x + 3, y - 8, 10, 3, PAL.pink); rect(x + 4, y - 7, 2, 1, PAL.white); rect(x + 8, y - 7, 2, 1, PAL.yellow);
      rect(x + 4, y - 4, 8, 6, '#1a2a4a');
      rect(x + 5 + (Math.floor(t * 2) % 4), y - 2, 2, 2, PAL.teal);
      rect(x + 2, y + 3, 12, 3, PAL.g3); rect(x + 4, y + 3, 2, 1, PAL.red); rect(x + 8, y + 4, 1, 1, PAL.yellow); rect(x + 10, y + 4, 1, 1, PAL.sky);
      rect(x + 6, y + 8, 4, 3, PAL.g4); rect(x + 7, y + 9, 1, 1, PAL.yellow);
      break;
    case 'stall':
      rect(x, y + 2, 16, 10, PAL.ink); rect(x + 1, y + 3, 14, 4, PAL.white); rect(x + 1, y + 7, 14, 4, area.wallIn);
      rect(x + 3, y, 4, 4, PAL.ink); rect(x + 4, y + 1, 2, 2, PAL.yellow); rect(x + 9, y, 4, 4, PAL.ink); rect(x + 10, y + 1, 2, 2, PAL.red);
      break;
    case 'wood':
      rect(x + 2, top, 12, 18, PAL.ink); rect(x + 3, top + 1, 10, 16, area.wallHi);
      for (var i = 0; i < 3; i++) { rect(x + 3, top + 6 + i * 5, 10, 1, PAL.ink); rect(x + 7, top + 3 + i * 5, 2, 1, PAL.ink); }
      break;
    default:
      rect(x + 4, top, 8, 18, PAL.ink); rect(x + 5, top + 1, 6, 6, PAL.sky); rect(x + 5, top + 8, 6, 9, PAL.g1); rect(x + 6, top + 2, 2, 2, PAL.white);
  }
}

// A grease spill. `open` flags the sides with no grease beyond (1 up, 2 right, 4 down, 8 left), so a run of tiles draws as one slick.
function drawGrease(x, y, t, open) {
  var k = '#5a3a14', m = '#86561a', h = '#d8a038';
  var u = open & 1, r = open & 2, d = open & 4, l = open & 8;
  for (var yy = 0; yy < 16; yy++) {
    var c = Math.max(u && yy < 2 ? 2 - yy : 0, d && yy > 13 ? yy - 13 : 0);
    rect(x + (l ? c : 0), y + yy, 16 - (l ? c : 0) - (r ? c : 0), 1, k);
    if ((u && yy < 2) || (d && yy > 13)) continue;
    var c2 = (u && yy === 2) || (d && yy === 13) ? 1 : 0;
    rect(x + (l ? 2 + c2 : 0), y + yy, 16 - (l ? 2 + c2 : 0) - (r ? 2 + c2 : 0), 1, m);
  }
  var f = (Math.floor(x / 16) + Math.floor(y / 16)) & 1;
  if (f) { rect(x + 4, y + 4, 4, 1, h); rect(x + 3, y + 5, 2, 1, h); }
  else { rect(x + 8, y + 10, 4, 1, h); rect(x + 11, y + 9, 1, 1, h); }
  var g = Math.floor(t * 2 + x / 16 + y / 32) % 14;
  if (g < 6) rect(x + 4 + g, y + (f ? 4 : 10), 1, 1, PAL.white);
}
// A microwave set into the floor: a window, a keypad, and a handle. The rim flashes while it cooks a stack.
function drawMicrowave(x, y, busy, t) {
  var on = busy && (Math.floor(t * 3) & 1);
  rect(x, y, 16, 16, on ? '#e8a040' : PAL.ink);
  rect(x + 1, y + 1, 14, 14, PAL.g3);
  rect(x + 2, y + 3, 9, 9, PAL.ink);
  rect(x + 3, y + 4, 7, 7, busy ? '#7a4a1a' : '#2a2a3a');
  rect(x + 4, y + 5, 2, 1, busy ? '#e8a040' : PAL.g2);
  rect(x + 12, y + 3, 2, 1, busy ? PAL.red : PAL.g4);
  for (var i = 0; i < 3; i++) { rect(x + 12, y + 5 + i * 2, 1, 1, PAL.ink); rect(x + 13, y + 5 + i * 2, 1, 1, PAL.g2); }
  rect(x + 2, y + 13, 12, 1, PAL.g2);
}
SPR.chefhat = shapeSprite(32, 9, function (R, box) {
  box(9, 0, 14, 7, 'w'); box(6, 1, 6, 5, 'w'); box(20, 1, 6, 5, 'w'); R(9, 6, 14, 3, 'k'); R(10, 6, 12, 2, 'w');
});
BOSS_SWAP.cook = { swap: { b: 'w', R: 'O', Y: 'R' } };

// A token: a pink coin with a slot, so it never reads as the round yellow bit.
SPR.bitt = ['.kkkkk.', 'kPwPPPk', 'kPPkPPk', 'kPPkPPk', 'kPPkPmk', 'kmPPPmk', '.kkkkk.'];
BIT_COLOR.t = PAL.pink;
var PORTAL_COLOR = [PAL.lime, PAL.orange], PORTAL_DARK = [PAL.green, '#a84a10'];
// Which pair a portal is in right now. ( is always in pair 0, so relinking recolors the others.
function portalPair(s, c) { return c === '(' || Rules.LINKS[s.link]['('] === c ? 0 : 1; }
// A portal pad: a ring in its pair's color around a dark hole, a spark running round it, and one or two pips naming the pair.
function drawPortal(x, y, pair, t) {
  var c = PORTAL_COLOR[pair], dk = PORTAL_DARK[pair];
  rect(x + 3, y + 1, 10, 14, PAL.ink); rect(x + 1, y + 3, 14, 10, PAL.ink); rect(x + 2, y + 2, 12, 12, PAL.ink);
  rect(x + 4, y + 2, 8, 12, c); rect(x + 2, y + 4, 12, 8, c); rect(x + 3, y + 3, 10, 10, c);
  rect(x + 5, y + 4, 6, 8, dk); rect(x + 4, y + 5, 8, 6, dk);
  rect(x + 6, y + 6, 4, 4, PAL.deep);
  var ring = [[7, 2], [10, 3], [12, 7], [10, 11], [7, 12], [4, 11], [2, 7], [4, 3]][Math.floor(t * 8) % 8];
  rect(x + ring[0], y + ring[1], 2, 1, PAL.white);
  if (pair === 0) rect(x + 7, y + 7, 2, 2, c);
  else { rect(x + 6, y + 7, 1, 2, c); rect(x + 9, y + 7, 1, 2, c); }
}
// A token gate: a turnstile block with bars and a coin slot that blinks pink.
function drawTokenGate(x, y, t) {
  var top = y - LIFT;
  rect(x, top, 16, 16 + LIFT, PAL.ink);
  rect(x + 1, top + 1, 14, 14, '#4a2a7a');
  rect(x + 1, top + 1, 14, 1, '#8a6ac8');
  rect(x + 1, y + 11, 14, LIFT - 1, '#2a1648');
  rect(x + 2, top + 10, 12, 2, PAL.g2); rect(x + 2, top + 10, 12, 1, PAL.white);
  rect(x + 5, top + 3, 6, 4, PAL.ink);
  rect(x + 7, top + 4, 2, 2, (Math.floor(t * 2) & 1) ? PAL.pink : PAL.magenta);
}
// The Garden Center (chapter 10).
// A seed patch: a mound of soil with pale seeds and one green sprout.
function drawSeed(x, y, t) {
  rect(x + 3, y + 6, 10, 6, '#5a3a1a'); rect(x + 4, y + 5, 8, 8, '#5a3a1a'); rect(x + 4, y + 6, 8, 5, '#7a5228');
  rect(x + 5, y + 8, 1, 1, '#f0e0a8'); rect(x + 8, y + 7, 1, 1, '#f0e0a8'); rect(x + 10, y + 9, 1, 1, '#f0e0a8');
  var w = Math.floor(t * 1.5) & 1;
  rect(x + 7, y + 3 + w, 1, 3 - w, PAL.green); rect(x + 6, y + 3 + w, 1, 1, PAL.lime); rect(x + 8, y + 2 + w, 1, 1, PAL.lime);
}
// A vine is a hedge block, drawn like a wall so a run of vines reads as one hedge.
var VINE_LOOK = { wallTop: '#2e7a2a', wallIn: '#246622', wallHi: '#7ad04a', wallFront: '#1a4a16', trim: '#ff8fc7', crack: '#7ad04a', wallStyle: 'hedge' };
// A lawn sprinkler on a stake: a round head whose nozzle points the way it sprays, with a drip that blinks.
function drawSprinkler(x, y, d, t) {
  rect(x + 7, y + 9, 2, 5, PAL.ink); rect(x + 4, y + 13, 8, 2, PAL.ink); rect(x + 5, y + 13, 6, 1, PAL.g3);
  rect(x + 4, y + 4, 8, 6, PAL.ink); rect(x + 3, y + 5, 10, 4, PAL.ink); rect(x + 4, y + 5, 8, 4, '#3a9a5a'); rect(x + 5, y + 4, 6, 1, '#3a9a5a');
  rect(x + 5, y + 5, 3, 1, '#9ae0a8');
  var nx = x + 7 + Rules.DX[d] * 6, ny = y + 6 + Rules.DY[d] * 5;
  rect(nx - 1, ny - 1, 3, 3, PAL.ink); rect(nx, ny, 1, 1, PAL.sky);
  if (Math.floor(t * 3) & 1) rect(nx + Rules.DX[d] * 2, ny + Rules.DY[d] * 2, 1, 1, PAL.white);
}
SPR.sunhat = shapeSprite(32, 9, function (R, box) {
  box(9, 0, 14, 6, 'y'); R(10, 1, 12, 1, 'v'); R(10, 4, 12, 1, 'R');
  R(2, 5, 28, 3, 'k'); R(3, 6, 26, 1, 'y'); R(4, 5, 24, 1, 'v');
  R(22, 2, 2, 2, 'P');
});
BOSS_SWAP.gardener = { swap: { b: 'n', R: 'G', Y: 'P' } };

// The Server Room (chapter 11).
var SWITCH_ON = PAL.lime, SWITCH_ON_DK = PAL.green, SWITCH_OFF = PAL.orange, SWITCH_OFF_DK = '#a84a10';
// A splitter: a raised block holding a prism that fans a beam out of both sides.
function drawSplitter(x, y, t) {
  var top = y - LIFT;
  rect(x, top, 16, 16 + LIFT, PAL.ink);
  rect(x + 1, top + 1, 14, 14, PAL.g4); rect(x + 1, top + 1, 14, 1, PAL.g2);
  rect(x + 1, y + 11, 14, LIFT - 1, PAL.g5);
  for (var i = 0; i < 5; i++) rect(x + 8 - i, top + 3 + i, 1 + i * 2, 1, i === 0 ? PAL.white : PAL.sky);
  rect(x + 3, top + 8, 10, 2, PAL.cobalt);
  if (Math.floor(t * 2) & 1) { rect(x + 1, top + 9, 2, 1, PAL.white); rect(x + 13, top + 9, 2, 1, PAL.white); }
}
// A toggle switch: a lever box whose lever and lamp show whether the switch is on.
function drawSwitch(x, y, on) {
  var top = y - LIFT;
  rect(x, top, 16, 16 + LIFT, PAL.ink);
  rect(x + 1, top + 1, 14, 14, PAL.g3); rect(x + 1, top + 1, 14, 1, PAL.g1);
  rect(x + 1, y + 11, 14, LIFT - 1, PAL.g5);
  rect(x + 4, top + 9, 8, 3, PAL.ink);
  if (on) { rect(x + 9, top + 4, 2, 6, PAL.g1); rect(x + 9, top + 3, 3, 2, SWITCH_ON); }
  else { rect(x + 5, top + 4, 2, 6, PAL.g1); rect(x + 4, top + 3, 3, 2, SWITCH_OFF); }
  rect(x + 3, top + 13, 2, 1, on ? SWITCH_ON : SWITCH_OFF_DK);
}
// A switch door. J doors are lime and j doors are orange, so the color says which way of the switch opens it.
function drawSwitchDoor(x, y, lime, open) {
  var c = lime ? SWITCH_ON : SWITCH_OFF, dk = lime ? SWITCH_ON_DK : SWITCH_OFF_DK;
  if (open) { rect(x, y, 2, 16, dk); rect(x + 14, y, 2, 16, dk); rect(x, y, 1, 16, PAL.ink); rect(x + 15, y, 1, 16, PAL.ink); return; }
  var top = y - LIFT;
  rect(x, top, 16, 16 + LIFT, PAL.ink);
  for (var i = 0; i < 4; i++) rect(x + 1 + i * 4, top + 1, 2, 15, c);
  rect(x + 1, top + 1, 14, 1, PAL.white);
  rect(x + 1, y + 11, 14, LIFT - 1, dk);
}
// The Mainframe: a server rack with a screen face and rows of blinking lights.
SPR.mainframe = shapeSprite(32, 32, function (R, box) {
  box(4, 0, 24, 31, '5');
  box(7, 3, 18, 10, 'K');
  R(10, 6, 3, 2, 'T'); R(19, 6, 3, 2, 'T'); R(12, 10, 8, 1, 'T');
  for (var j = 0; j < 4; j++) { box(6, 14 + j * 4, 20, 4, '4'); R(8, 15 + j * 4, 2, 2, j & 1 ? 'G' : 'R'); R(11, 15 + j * 4, 2, 2, 'G'); R(15, 16 + j * 4, 9, 1, '3'); }
  R(6, 31, 4, 1, 'k'); R(22, 31, 4, 1, 'k');
});

// The Parking Garage (chapter 12).
// A ramp: a low hump striped yellow and black, so it reads as something to drive up.
function drawRamp(x, y) {
  rect(x + 1, y + 5, 14, 9, PAL.ink); rect(x + 2, y + 4, 12, 1, PAL.ink);
  rect(x + 2, y + 5, 12, 7, PAL.g2); rect(x + 3, y + 5, 10, 1, PAL.g1);
  for (var i = 0; i < 4; i++) rect(x + 3 + i * 3, y + 7, 2, 4, i & 1 ? PAL.ink : PAL.yellow);
  rect(x + 2, y + 12, 12, 1, PAL.g4);
}
// A magnet: a red horseshoe on a stand. Switched on, its tips glow and field marks blink between them.
function drawMagnet(x, y, on, t) {
  rect(x + 7, y + 10, 2, 4, PAL.ink); rect(x + 4, y + 13, 8, 2, PAL.ink);
  rect(x + 3, y + 1, 10, 9, PAL.ink); rect(x + 6, y + 4, 4, 6, PAL.deep);
  rect(x + 4, y + 2, 8, 3, PAL.red); rect(x + 4, y + 2, 2, 7, PAL.red); rect(x + 10, y + 2, 2, 7, PAL.red);
  rect(x + 5, y + 2, 6, 1, PAL.blush);
  rect(x + 4, y + 8, 2, 2, on ? PAL.white : PAL.g3); rect(x + 10, y + 8, 2, 2, on ? PAL.white : PAL.g3);
  if (on && (Math.floor(t * 4) & 1)) { rect(x + 6, y + 11, 1, 1, PAL.sky); rect(x + 9, y + 11, 1, 1, PAL.sky); rect(x + 7, y + 12, 2, 1, PAL.sky); }
}
SPR.valetcap = shapeSprite(32, 7, function (R, box) {
  box(9, 0, 14, 5, 'R'); R(10, 1, 12, 1, 'e'); R(14, 2, 4, 2, 'Y');
  R(6, 4, 20, 2, 'k'); R(7, 4, 18, 1, 'r');
});
BOSS_SWAP.valet = { swap: { b: 'r', '1': 'Y', R: 'k' } };

// The Cinema (chapter 13).
// Cracked floor: the area's floor with a dark split and loose chips, so it reads as one step from falling in.
function drawCracked(x, y) {
  [[3, 3], [4, 4], [5, 4], [6, 5], [7, 6], [7, 7], [8, 8], [9, 8], [10, 9], [11, 10], [9, 11], [8, 12]].forEach(function (p) { rect(x + p[0], y + p[1], 1, 1, PAL.ink); });
  rect(x + 6, y + 6, 1, 1, PAL.deep); rect(x + 9, y + 9, 1, 1, PAL.deep);
  rect(x + 2, y + 11, 2, 1, PAL.g3); rect(x + 12, y + 4, 1, 1, PAL.g3);
}
// Light from a projector: a hard dither of pale yellow over each lit tile.
function drawLit(x, y, t) {
  dither(x, y, 16, 16, null, '#fff2b0', 5 + (Math.floor(t * 2) & 1));
}
// A film projector on a stand: two reels on top and a lens pointing the way it shines.
function drawProjector(x, y, d, t) {
  rect(x + 7, y + 10, 2, 4, PAL.ink); rect(x + 4, y + 13, 8, 2, PAL.ink);
  rect(x + 2, y + 5, 12, 6, PAL.ink); rect(x + 3, y + 6, 10, 4, PAL.g4); rect(x + 3, y + 6, 10, 1, PAL.g3);
  var spin = Math.floor(t * 4) & 1;
  rect(x + 2, y + 1, 5, 5, PAL.ink); rect(x + 3, y + 2, 3, 3, PAL.g2); rect(x + 4, y + 3, 1, 1, spin ? PAL.ink : PAL.g4);
  rect(x + 9, y + 1, 5, 5, PAL.ink); rect(x + 10, y + 2, 3, 3, PAL.g2); rect(x + 11, y + 3, 1, 1, spin ? PAL.g4 : PAL.ink);
  var lx = x + 7 + Rules.DX[d] * 6, ly = y + 7 + Rules.DY[d] * 3;
  rect(lx - 1, ly - 1, 3, 3, PAL.ink); rect(lx, ly, 1, 1, '#fff2b0');
}
SPR.ushercap = shapeSprite(32, 6, function (R, box) {
  box(9, 0, 14, 4, 'r'); R(10, 1, 12, 1, 'R'); R(14, 1, 4, 2, 'Y');
  R(8, 3, 16, 2, 'k'); R(9, 3, 14, 1, 'r');
});
BOSS_SWAP.usher = { swap: { b: 'r', R: 'Y', '1': 'v' } };

// The Toy Store (chapter 14).
// A wind-up toy: a red robot with a winding key on its back. It faces right, and flips to face left.
SPR.toy = shapeSprite(16, 16, function (R, box) {
  R(7, 1, 2, 1, 'k'); R(7, 2, 2, 1, 'Y');
  box(3, 3, 10, 8, 'R'); R(4, 4, 8, 1, 'e');
  R(5, 5, 2, 2, 'w'); R(9, 5, 2, 2, 'w'); R(6, 6, 1, 1, 'k'); R(10, 6, 1, 1, 'k');
  R(6, 8, 4, 1, 'k');
  R(1, 6, 2, 1, 'k'); R(0, 5, 1, 3, 'Y');
  box(4, 11, 3, 3, '3'); box(9, 11, 3, 3, '3');
});
SPR.miniToy = shapeSprite(9, 7, function (R, box) { box(1, 0, 7, 5, 'R'); R(2, 1, 1, 1, 'w'); R(5, 1, 1, 1, 'w'); R(0, 2, 1, 1, 'Y'); R(2, 5, 1, 2, 'k'); R(6, 5, 1, 2, 'k'); });
// A bumper: a short round post with a striped ring that throws things back.
function drawBumper(x, y, t) {
  var top = y - 3;
  rect(x + 3, top + 2, 10, 13, PAL.ink); rect(x + 2, top + 4, 12, 9, PAL.ink);
  rect(x + 4, top + 3, 8, 11, PAL.red); rect(x + 3, top + 5, 10, 7, PAL.red);
  rect(x + 4, top + 7, 8, 3, (Math.floor(t * 2) & 1) ? PAL.white : PAL.yellow);
  rect(x + 5, top + 4, 3, 1, PAL.blush);
}
// The Jack: a blue box with a clown's head on a spring.
SPR.jack = shapeSprite(32, 32, function (R, box, disc) {
  box(4, 17, 24, 14, 'B'); R(5, 18, 22, 2, 'c');
  R(8, 22, 4, 4, 'Y'); R(20, 22, 4, 4, 'R'); R(14, 23, 4, 4, 'G');
  for (var i = 0; i < 5; i++) R(12 + (i & 1) * 4, 12 + i, 4, 1, '2');
  disc(16, 7, 6, 'k'); disc(16, 7, 5, 'w');
  R(13, 5, 2, 2, 'k'); R(18, 5, 2, 2, 'k'); R(15, 8, 3, 2, 'R'); R(12, 10, 8, 1, 'k');
  R(10, 0, 12, 3, 'P'); R(15, 0, 2, 1, 'Y');
});

// The Static (the final boss): a television head over a long dark coat with torn hems. drawBoss paints the snow on its screen.
SPR.static = shapeSprite(32, 32, function (R, box) {
  R(10, 1, 1, 2, 'k'); R(21, 1, 1, 2, 'k'); R(9, 0, 1, 1, 'T'); R(22, 0, 1, 1, 'P');
  box(4, 3, 24, 16, '4'); R(5, 4, 22, 1, '3'); box(7, 5, 18, 12, 'K');
  R(26, 8, 1, 2, '2'); R(26, 12, 1, 2, '2');
  box(9, 18, 14, 4, '5'); R(14, 19, 4, 3, '4');
  box(6, 21, 20, 9, '5'); R(7, 22, 18, 1, '4'); R(15, 22, 2, 7, 'k');
  box(3, 21, 4, 8, '5'); box(25, 21, 4, 8, '5'); R(3, 28, 4, 2, '4'); R(25, 28, 4, 2, '4');
  R(7, 29, 2, 2, 'k'); R(11, 29, 3, 3, 'k'); R(18, 29, 3, 3, 'k'); R(23, 29, 2, 2, 'k');
  R(1, 24, 2, 1, 'T'); R(29, 26, 2, 1, 'P'); R(0, 12, 3, 1, 'T'); R(29, 7, 3, 1, 'P');
});
SPR.tie = ['kk', 'RR', 'Rr', 'RR', 'rR', '.R'];

// The High Score: an arcade cabinet with a marquee, a screen face, a control panel, and a coin door.
SPR.cabinet = shapeSprite(32, 32, function (R, box) {
  box(4, 0, 24, 7, 'P');
  for (var i = 0; i < 7; i++) R(6 + i * 3, 2, 2, 3, i & 1 ? 'Y' : 'w');
  box(5, 6, 22, 25, 'm');
  R(6, 7, 1, 23, 'P');
  box(7, 8, 18, 10, 'K');
  R(9, 9, 1, 1, 'G'); R(11, 9, 1, 1, 'G'); R(13, 9, 1, 1, 'G');
  R(10, 11, 3, 2, 'w'); R(19, 11, 3, 2, 'w');
  R(12, 14, 8, 1, 'w'); R(15, 15, 2, 1, 'Y');
  box(2, 18, 28, 4, '3'); R(3, 19, 26, 1, '2');
  R(7, 19, 3, 2, 'R'); R(8, 19, 1, 1, 'w');
  R(16, 20, 2, 1, 'Y'); R(19, 20, 2, 1, 'c'); R(22, 20, 2, 1, 'G');
  box(12, 23, 8, 6, '4'); R(14, 25, 1, 2, 'Y'); R(17, 25, 1, 2, 'Y');
  R(6, 31, 4, 1, 'k'); R(22, 31, 4, 1, 'k');
});

// A walkable floor decal: a rug in most rooms, a running belt in Shipping.
function drawDecal(x, y, area, tx, ty, t) {
  if (area.wallStyle === 'container') { drawConveyor(x, y, 1, t); return; }
  rect(x, y, 16, 16, PAL.redDk);
  rect(x + 1, y + 1, 14, 14, '#c0304a');
  if ((tx + ty) & 1) rect(x + 6, y + 6, 4, 4, PAL.yellow);
}

// A keycard door: closed it is a colored slab with a card slot, open it leaves colored posts.
function drawKeyDoor(x, y, color, open) {
  if (open) {
    rect(x, y, 2, 16, color); rect(x + 14, y, 2, 16, color);
    rect(x, y, 1, 16, PAL.ink); rect(x + 15, y, 1, 16, PAL.ink);
    return;
  }
  var top = y - LIFT;
  rect(x, top, 16, 16 + LIFT, PAL.ink);
  rect(x + 1, top + 1, 14, 14, color);
  rect(x + 1, top + 1, 14, 1, PAL.white);
  rect(x + 5, top + 5, 6, 8, PAL.ink); rect(x + 6, top + 6, 4, 6, PAL.g1); rect(x + 7, top + 7, 2, 1, PAL.ink);
  rect(x + 1, y + 11, 14, LIFT - 1, PAL.g4);
}

function drawHearts(x, y, hp, max) { for (var i = 0; i < max; i++) spr(i < hp ? SPR.heart : SPR.heartEmpty, x + i * 7, y); }
function drawPips(cx, y, hp, max) {
  if (max > 6) {
    var bx = Math.round(cx - 8);
    rect(bx, y, 17, 4, PAL.ink);
    rect(bx + 1, y + 1, Math.max(1, Math.round(15 * hp / max)), 2, PAL.red);
    rect(bx + 1, y + 1, 1, 2, PAL.white);
    return;
  }
  var w = max * 3 + 1, x = Math.round(cx - w / 2);
  rect(x, y, w, 4, PAL.ink);
  for (var i = 0; i < max; i++) rect(x + 1 + i * 3, y + 1, 2, 2, i < hp ? PAL.red : PAL.g4);
}
function drawArrow(cx, cy, d, color) {
  var pts = d === 0 ? [[0, -2], [-1, -1], [0, -1], [1, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]]
    : d === 2 ? [[0, 2], [-1, 1], [0, 1], [1, 1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]]
      : d === 1 ? [[2, 0], [1, -1], [1, 0], [1, 1], [0, -2], [0, -1], [0, 0], [0, 1], [0, 2]]
        : [[-2, 0], [-1, -1], [-1, 0], [-1, 1], [0, -2], [0, -1], [0, 0], [0, 1], [0, 2]];
  pts.forEach(function (p) { rect(cx + p[0], cy + p[1], 1, 1, color); });
}

// Beveled window panel in the early desktop style.
function panel(x, y, w, h, title, bar, body) {
  rect(x - 1, y - 1, w + 2, h + 2, PAL.ink);
  rect(x, y, w, h, body || PAL.g2);
  rect(x, y, w, 1, PAL.g1); rect(x, y, 1, h, PAL.g1);
  rect(x, y + h - 1, w, 1, PAL.g4); rect(x + w - 1, y, 1, h, PAL.g4);
  if (title !== undefined) {
    rect(x + 2, y + 2, w - 4, 10, bar || PAL.cobaltDk);
    text(title, x + 4, y + 3, PAL.white);
  }
}
function inset(x, y, w, h, body) {
  rect(x, y, w, h, body || PAL.g5);
  rect(x, y, w, 1, PAL.g4); rect(x, y, 1, h, PAL.g4);
  rect(x, y + h - 1, w, 1, PAL.g1); rect(x + w - 1, y, 1, h, PAL.g1);
}

// Effects: particles, debris, rings, flashes, icons, and screen shake.
var FX = {
  list: [],
  add: function (p) { this.list.push(p); return p; },
  burst: function (x, y, colors, n, speed) {
    for (var i = 0; i < (n || 10); i++) {
      var a = Math.random() * Math.PI * 2, v = (speed || 40) * (0.4 + Math.random() * 0.8);
      this.add({ k: 'p', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 15, g: 120, life: 0.35 + Math.random() * 0.35, c: colors[i % colors.length], s: 1 });
    }
  },
  debris: function (x, y, colors, n) {
    for (var i = 0; i < (n || 8); i++) {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, v = 30 + Math.random() * 50;
      this.add({ k: 'p', x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 220, life: 0.5 + Math.random() * 0.3, c: colors[i % colors.length], s: 2, floor: y + 8 });
    }
  },
  dust: function (x, y) {
    for (var i = 0; i < 3; i++) this.add({ k: 'p', x: x + (Math.random() - 0.5) * 8, y: y + Math.random() * 2, vx: (Math.random() - 0.5) * 16, vy: -6 - Math.random() * 8, g: 0, life: 0.3 + Math.random() * 0.2, c: PAL.g1, s: 1 });
  },
  sparkle: function (x, y, n) {
    for (var i = 0; i < (n || 5); i++) this.add({ k: 's', x: x + (Math.random() - 0.5) * 14, y: y + (Math.random() - 0.5) * 12, life: 0.3 + Math.random() * 0.4, d: Math.random() * 0.2 });
  },
  ring: function (x, y, r1, color, life) { this.add({ k: 'r', x: x, y: y, r1: r1, c: color, life: life || 0.35, max: life || 0.35 }); },
  flash: function (x, y, w, h, color, life) { this.add({ k: 'f', x: x, y: y, w: w, h: h, c: color, life: life || 0.25, max: life || 0.25 }); },
  beam: function (x0, y0, x1, y1, color) { this.add({ k: 'b', x0: x0, y0: y0, x1: x1, y1: y1, c: color, life: 0.22, max: 0.22 }); },
  icon: function (rows, x, y, life) { return this.add({ k: 'i', rows: rows, x: x, y: y, life: life || 0.7, max: life || 0.7 }); },
  shake: function (n) { Game.shake = Math.max(Game.shake, n); },
  update: function (dt) {
    this.list.forEach(function (p) {
      if (p.d > 0) { p.d -= dt; return; }
      p.life -= dt;
      if (p.k === 'p') {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
        if (p.floor && p.y > p.floor) { p.y = p.floor; p.vy *= -0.3; p.vx *= 0.6; }
      }
      if (p.k === 'i') p.y -= 10 * dt * (p.life > p.max - 0.15 ? 1 : 0);
    });
    this.list = this.list.filter(function (p) { return p.life > 0; });
  },
  draw: function () {
    this.list.forEach(function (p) {
      if (p.d > 0) return;
      if (p.k === 'p') rect(p.x, p.y, p.s, p.s, p.c);
      else if (p.k === 's') {
        var c = p.life > 0.15 ? PAL.white : PAL.yellow;
        rect(p.x, p.y - 1, 1, 3, c); rect(p.x - 1, p.y, 3, 1, c);
      } else if (p.k === 'r') {
        var f = 1 - p.life / p.max, r = Math.max(1, p.r1 * f), n = Math.max(8, Math.round(r * 5));
        g.fillStyle = p.c;
        for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2; g.fillRect(Math.round(p.x + Math.cos(a) * r), Math.round(p.y + Math.sin(a) * r), 1, 1); }
      } else if (p.k === 'f') dither(p.x, p.y, p.w, p.h, null, p.c, Math.ceil(16 * p.life / p.max));
      else if (p.k === 'b') {
        var grow = Math.min(1, (p.max - p.life) / 0.08), horiz = p.y0 === p.y1;
        var ex = p.x0 + (p.x1 - p.x0) * grow, ey = p.y0 + (p.y1 - p.y0) * grow;
        var a0 = horiz ? Math.min(p.x0, ex) : Math.min(p.y0, ey), b0 = horiz ? Math.max(p.x0, ex) : Math.max(p.y0, ey);
        var w = p.life > p.max * 0.5 ? 3 : 1;
        if (horiz) { rect(a0, p.y0 - (w >> 1), b0 - a0, w, p.c); rect(a0, p.y0, b0 - a0, 1, PAL.white); }
        else { rect(p.x0 - (w >> 1), a0, w, b0 - a0, p.c); rect(p.x0, a0, 1, b0 - a0, PAL.white); }
      } else if (p.k === 'i') {
        var at = p.follow ? p.follow() : null, ix = at ? at[0] : p.x, iy = at ? at[1] - (p.max - p.life > 0.15 ? 2 : 0) : p.y;
        spr(p.rows, ix - Math.floor(sprite(p.rows).width / 2), iy);
      }
      else if (p.k === 'fly' && p.c) {
        var q = 1 - p.life / p.max, e = q * q;
        spr(SPR['bit' + p.c], p.x0 + (p.x1 - p.x0) * e, p.y0 + (p.y1 - p.y0) * e - Math.sin(q * Math.PI) * 16);
      }
    });
  },
  clear: function () { this.list = []; Game.shake = 0; },
};
