// Looks for named characters and enemies, and the drawn sheets for machines.
import { C } from '../engine/palette';
import { crowdLook, drawnSheet, personSheet, type Look, type Sheet } from './people';
import { DRAWN, drawnFigure } from './drawn';

export const LOOKS: Record<string, Look> = {
  sallis: { skin: C.skin1, hair: C.black, coat: C.mud1, accent: C.amb3, hairStyle: 'buzz', extras: ['collar'], pants: 'black' },
  quaye: { skin: C.skin1, hair: C.pale, coat: C.vio1, accent: C.cyan3, hairStyle: 'bun', extras: ['glasses'], build: 'small' },
  ambrose: { skin: C.skin0, hair: C.black, coat: C.slate, accent: C.cyan2, hairStyle: 'bald', extras: ['arm', 'beard', 'trim'], build: 'broad' },
  ambrose_ads: { skin: C.skin0, hair: C.black, coat: C.slate, accent: C.mag3, hairStyle: 'bald', extras: ['arm', 'beard', 'trim', 'eyepatch'], build: 'broad' },
  tova: { skin: C.skin2, hair: C.black, coat: C.cyan1, accent: C.grn3, hairStyle: 'braids', extras: ['hood'], build: 'slim' },
  ignace: { skin: C.skin4, hair: C.mud1, coat: C.pale, accent: C.amb3, hairStyle: 'short', extras: ['robe', 'collar'], build: 'slim' },
  opal: { skin: C.skin3, hair: C.mag2, coat: C.amb1, accent: C.cyan3, hairStyle: 'bob', extras: ['apron'] },
  seo: { skin: C.skin4, hair: C.black, coat: C.pale, accent: C.cyan3, hairStyle: 'buzz', extras: ['glasses', 'coatlong'] },
  sieve: { skin: C.skin4, hair: C.pale, coat: C.vio1, accent: C.red2, hairStyle: 'bun', extras: ['redmask'], build: 'small' },
  dowser: { skin: C.skin3, hair: C.white, coat: C.steel1, accent: C.cyan4, hairStyle: 'bob', extras: ['visor', 'coatlong'], build: 'slim' },
  marit: { skin: C.skin5, hair: C.pale, coat: C.pale, accent: C.cyan3, hairStyle: 'long', extras: ['robe'], build: 'slim' },
  teun: { skin: C.skin5, hair: C.white, coat: C.steel1, accent: C.red2, hairStyle: 'short', extras: ['collar'] },
  hanne: { skin: C.skin5, hair: C.amb3, coat: C.vio1, accent: C.cyan3, hairStyle: 'bun', extras: ['pack'] },
  jory: { skin: C.skin1, hair: C.black, coat: C.grn1, accent: C.amb3, hairStyle: 'short', extras: ['cap'] },
  kees: { skin: C.skin2, hair: C.black, coat: C.amb2, accent: C.pale, hairStyle: 'curls', build: 'small' },
  lam: { skin: C.skin3, hair: C.black, coat: C.amb2, accent: C.pale, hairStyle: 'bob', extras: ['apron'] },
  velt: { skin: C.skin4, hair: C.white, coat: C.pale, accent: C.amb3, hairStyle: 'buzz', extras: ['robe', 'collar'], build: 'broad' },
  rina: { skin: C.skin2, hair: C.cyan2, coat: C.cyan1, accent: C.gray, hairStyle: 'mohawk', extras: ['mask', 'arm'] },
  bram: { skin: C.skin3, hair: C.gray, coat: C.amb1, accent: C.amb3, hairStyle: 'short', extras: ['cap', 'beard'] },
  boardguard: { skin: C.skin3, hair: C.black, coat: C.red1, accent: C.pale, hairStyle: 'short', extras: ['cap'] },
  tapper: { skin: C.skin2, hair: C.black, coat: C.red1, accent: C.cyan3, hairStyle: 'short', extras: ['visor', 'pack'] },
  diverfoe: { skin: C.skin4, hair: C.vio2, coat: C.red1, accent: C.cyan3, hairStyle: 'sidecut', extras: ['visor'] },
  lockjaw: { skin: C.skin2, hair: C.cyan2, coat: C.cyan0, accent: C.gray, hairStyle: 'spikes', extras: ['mask'] },
  jawbrute: { skin: C.skin1, hair: C.black, coat: C.cyan0, accent: C.gray, hairStyle: 'bald', extras: ['mask', 'arm'], build: 'broad' },
  cutter: { skin: C.skin3, hair: C.black, coat: C.slate, accent: C.pale, hairStyle: 'short', extras: ['redmask', 'hood'] },
  nurse: { skin: C.skin4, hair: C.mud1, coat: C.pale, accent: C.pale, hairStyle: 'bun', extras: ['redmask'] },
  choir: { skin: C.skin2, hair: C.black, coat: C.slate, accent: C.pale, hairStyle: 'bald', extras: ['robe'] },
  choir2: { skin: C.skin5, hair: C.black, coat: C.slate, accent: C.pale, hairStyle: 'bald', extras: ['robe'] },
  ganger: { skin: C.skin2, hair: C.mag2, coat: C.mag0, accent: C.amb3, hairStyle: 'mohawk', extras: ['collar'] },
  moss: { skin: C.skin3, hair: C.grn2, coat: C.mud1, accent: C.amb3, hairStyle: 'curls', extras: ['apron'] },
  kid: { skin: C.skin1, hair: C.black, coat: C.amb2, accent: C.cyan3, hairStyle: 'curls', build: 'small' },
  kid2: { skin: C.skin4, hair: C.amb2, coat: C.grn2, accent: C.mag3, hairStyle: 'bob', build: 'small' },
  old: { skin: C.skin3, hair: C.pale, coat: C.mud0, accent: C.gray, hairStyle: 'buzz', extras: ['beard', 'scarf'] },
  deacon: { skin: C.skin3, hair: C.black, coat: C.pale, accent: C.amb3, hairStyle: 'short', extras: ['robe'] },
  censusman: { skin: C.skin5, hair: C.mud1, coat: C.red1, accent: C.white, hairStyle: 'short', extras: ['glasses'] },
  gus: { skin: C.skin2, hair: C.gray, coat: C.cyan0, accent: C.amb3, hairStyle: 'short', extras: ['cap', 'beard'] },
  pim: { skin: C.skin1, hair: C.black, coat: C.amb2, accent: C.cyan3, hairStyle: 'curls', build: 'small' },
  dita: { skin: C.skin4, hair: C.amb2, coat: C.grn2, accent: C.mag3, hairStyle: 'braids', build: 'small' },
  noor: { skin: C.skin2, hair: C.black, coat: C.mag1, accent: C.pale, hairStyle: 'bob', build: 'small' },
  ilse: { skin: C.skin2, hair: C.black, coat: C.vio1, accent: C.amb3, hairStyle: 'long', extras: ['scarf'] },
  tester: { skin: C.skin5, hair: C.mud1, coat: C.red1, accent: C.white, hairStyle: 'short', extras: ['glasses', 'cap'] },
  bep: { skin: C.skin3, hair: C.white, coat: C.mud1, accent: C.mag3, hairStyle: 'bun', extras: ['scarf'], build: 'small' },
  joost: { skin: C.skin1, hair: C.black, coat: C.night, accent: C.pale, hairStyle: 'sidecut', extras: ['redmask'] },
  fenna: { skin: C.skin0, hair: C.vio2, coat: C.slate, accent: C.amb3, hairStyle: 'buzz', extras: ['apron', 'glasses'], build: 'broad' },
  bas: { skin: C.skin4, hair: C.mud1, coat: C.grn1, accent: C.amb3, hairStyle: 'short', extras: ['pack'] },
  dek: { skin: C.skin2, hair: C.cyan2, coat: C.cyan0, accent: C.gray, hairStyle: 'spikes', extras: ['mask'] },
  wouters: { skin: C.skin4, hair: C.amb2, coat: C.red1, accent: C.pale, hairStyle: 'short', extras: ['cap', 'beard'] },
  captain: { skin: C.skin3, hair: C.gray, coat: C.red1, accent: C.white, hairStyle: 'buzz', extras: ['visor', 'collar'] },
  kroon: { skin: C.skin3, hair: C.black, coat: C.amb2, accent: C.mag3, hairStyle: 'sidecut', extras: ['coatlong', 'glasses'] },
  stoker: { skin: C.skin0, hair: C.black, coat: C.mag0, accent: C.amb4, hairStyle: 'bald', extras: ['arm', 'mask'], build: 'broad' },
  lotte: { skin: C.skin1, hair: C.mag2, coat: C.vio1, accent: C.amb3, hairStyle: 'bun', extras: ['apron'] },
  collector: { skin: C.skin4, hair: C.black, coat: C.slate, accent: C.pale, hairStyle: 'short', extras: ['redmask', 'coatlong'] },
  liv: { skin: C.skin2, hair: C.pale, coat: C.slate, accent: C.cyan2, hairStyle: 'buzz', extras: ['arm'], build: 'slim' },
  piet: { skin: C.skin3, hair: C.white, coat: C.mud0, accent: C.cyan2, hairStyle: 'bald', extras: ['umbrella', 'beard'] },
  piet2: { skin: C.skin3, hair: C.white, coat: C.mud0, accent: C.cyan2, hairStyle: 'bald', extras: ['beard'] },
  fem: { skin: C.skin1, hair: C.white, coat: C.mag1, accent: C.amb3, hairStyle: 'bun', extras: ['scarf'], build: 'small' },
  bosman: { skin: C.skin5, hair: C.amb2, coat: C.grn1, accent: C.amb3, hairStyle: 'short', extras: ['cap'], build: 'broad' },
  henk: { skin: C.skin2, hair: C.gray, coat: C.cyan1, accent: C.amb3, hairStyle: 'short', extras: ['scarf'] },
  veinman: { skin: C.skin1, hair: C.black, coat: C.mud1, accent: C.gray, hairStyle: 'curls', build: 'slim' },
  veinwoman: { skin: C.skin4, hair: C.mud1, coat: C.vio0, accent: C.gray, hairStyle: 'braids' },
  wil: { skin: C.skin5, hair: C.amb3, coat: C.cyan0, accent: C.pale, hairStyle: 'bun', extras: ['apron'], build: 'broad' },
  brink: { skin: C.skin2, hair: C.gray, coat: C.pale, accent: C.cyan3, hairStyle: 'bun', extras: ['apron'] },
  carer: { skin: C.skin4, hair: C.amb2, coat: C.amb2, accent: C.pale, hairStyle: 'bob', extras: ['apron'] },
  carer2: { skin: C.skin1, hair: C.black, coat: C.amb2, accent: C.pale, hairStyle: 'curls', extras: ['apron'] },
  skid1: { skin: C.skin3, hair: C.mud1, coat: C.amb2, accent: C.pale, hairStyle: 'bob', build: 'small' },
  skid2: { skin: C.skin5, hair: C.amb3, coat: C.amb2, accent: C.pale, hairStyle: 'short', build: 'small' },
  skid3: { skin: C.skin2, hair: C.black, coat: C.amb2, accent: C.pale, hairStyle: 'braids', build: 'small' },
  bo: { skin: C.skin0, hair: C.black, coat: C.amb2, accent: C.pale, hairStyle: 'curls', build: 'small' },
  // Chapter 3
  bouncer: { skin: C.skin0, hair: C.black, coat: C.vio0, accent: C.amb3, hairStyle: 'bald', extras: ['collar'], build: 'broad' },
  bouncer2: { skin: C.skin3, hair: C.vio2, coat: C.vio0, accent: C.cyan3, hairStyle: 'sidecut', build: 'broad' },
  pawn: { skin: C.skin4, hair: C.gray, coat: C.mud1, accent: C.amb3, hairStyle: 'buzz', extras: ['glasses', 'apron'] },
  mertens: { skin: C.skin5, hair: C.amb2, coat: C.pale, accent: C.amb4, hairStyle: 'short', extras: ['coatlong', 'glasses'] },
  jet: { skin: C.skin1, hair: C.vio3, coat: C.vio1, accent: C.cyan3, hairStyle: 'bob', extras: ['collar'] },
  doorn: { skin: C.skin2, hair: C.white, coat: C.mud0, accent: C.amb3, hairStyle: 'bun', extras: ['scarf'], build: 'small' },
  ruud: { skin: C.skin2, hair: C.black, coat: C.cyan0, accent: C.amb3, hairStyle: 'short', extras: ['arm', 'cap'], build: 'broad' },
  verhoef: { skin: C.skin4, hair: C.pale, coat: C.vio1, accent: C.amb4, hairStyle: 'bun', extras: ['glasses', 'scarf'], build: 'small' },
  jasper: { skin: C.skin1, hair: C.black, coat: C.cyan1, accent: C.amb4, hairStyle: 'spikes', build: 'small' },
  fien: { skin: C.skin5, hair: C.amb3, coat: C.vio2, accent: C.cyan3, hairStyle: 'braids', build: 'small' },
  verger: { skin: C.skin3, hair: C.black, coat: C.slate, accent: C.amb3, hairStyle: 'buzz', extras: ['robe'] },
  stam: { skin: C.skin4, hair: C.gray, coat: C.slate, accent: C.amb4, hairStyle: 'bald', extras: ['robe', 'beard'], build: 'broad' },
  clerk: { skin: C.skin5, hair: C.black, coat: C.red1, accent: C.white, hairStyle: 'bun', extras: ['glasses'] },
  baas: { skin: C.skin3, hair: C.mud1, coat: C.amb1, accent: C.mag3, hairStyle: 'short', extras: ['beard'], build: 'broad' },
  wendel: { skin: C.skin1, hair: C.gray, coat: C.vio1, accent: C.amb3, hairStyle: 'sidecut', extras: ['scarf'], build: 'slim' },
  // Chapter 5
  raidcap: { skin: C.skin1, hair: C.gray, coat: C.red1, accent: C.white, hairStyle: 'buzz', extras: ['visor', 'coatlong'], build: 'broad' },
  repo: { skin: C.skin3, hair: C.black, coat: C.cyan0, accent: C.cyan3, hairStyle: 'short', extras: ['visor', 'arm'], build: 'broad' },
  bwclerk: { skin: C.skin4, hair: C.amb2, coat: C.cyan1, accent: C.white, hairStyle: 'bob', extras: ['glasses', 'collar'] },
  oma: { skin: C.skin2, hair: C.white, coat: C.mag1, accent: C.pale, hairStyle: 'bun', extras: ['scarf'], build: 'small' },
  teo: { skin: C.skin2, hair: C.black, coat: C.grn1, accent: C.amb3, hairStyle: 'curls', build: 'small' },
  roos: { skin: C.skin0, hair: C.mud1, coat: C.mud1, accent: C.amb3, hairStyle: 'braids', extras: ['apron', 'scarf'] },
  // Chapter 6
  oud: { skin: C.skin3, hair: C.white, coat: C.steel2, accent: C.amb3, hairStyle: 'bun', extras: ['scarf'], build: 'small' },
  filer: { skin: C.skin5, hair: C.mud1, coat: C.steel1, accent: C.red2, hairStyle: 'bob', extras: ['glasses', 'collar'] },
  // Gigs
  kat: { skin: C.skin1, hair: C.vio3, coat: C.night, accent: C.amb4, hairStyle: 'bob', extras: ['collar', 'glasses'], build: 'slim' },
  saar: { skin: C.skin4, hair: C.pale, coat: C.mud1, accent: C.mag3, hairStyle: 'bun', extras: ['apron'], build: 'small' },
  rook: { skin: C.skin3, hair: C.black, coat: C.slate, accent: C.pale, hairStyle: 'spikes', extras: ['redmask'] },
  nienke: { skin: C.skin2, hair: C.amb3, coat: C.vio2, accent: C.cyan3, hairStyle: 'long' },
  mevius: { skin: C.skin5, hair: C.black, coat: C.vio0, accent: C.amb4, hairStyle: 'short', extras: ['coatlong'], build: 'broad' },
  dekker: { skin: C.skin3, hair: C.mud1, coat: C.cyan1, accent: C.amb3, hairStyle: 'bun', extras: ['scarf'] },
  hugo: { skin: C.skin4, hair: C.gray, coat: C.red1, accent: C.pale, hairStyle: 'short', extras: ['cap'] },
  repotech: { skin: C.skin2, hair: C.black, coat: C.cyan0, accent: C.cyan3, hairStyle: 'sidecut', extras: ['visor'] },
  vis: { skin: C.skin5, hair: C.white, coat: C.cyan1, accent: C.amb4, hairStyle: 'bun', extras: ['glasses', 'scarf'], build: 'small' },
  // The Flats: Waders wear oilskins and no chrome.
  wader: { skin: C.skin3, hair: C.mud1, coat: C.amb1, accent: C.cyan2, hairStyle: 'short', extras: ['hood', 'pack'] },
  wader2: { skin: C.skin1, hair: C.black, coat: C.mud0, accent: C.amb3, hairStyle: 'braids', extras: ['scarf'] },
  mudlark: { skin: C.skin4, hair: C.amb2, coat: C.mud1, accent: C.cyan3, hairStyle: 'curls', build: 'small' },
  dirkje: { skin: C.skin2, hair: C.pale, coat: C.amb1, accent: C.cyan3, hairStyle: 'sidecut', extras: ['hood', 'pack'], build: 'slim' },
  ankie: { skin: C.skin3, hair: C.white, coat: C.mud0, accent: C.amb3, hairStyle: 'bun', extras: ['scarf'], build: 'small' },
  zout: { skin: C.skin5, hair: C.gray, coat: C.pale, accent: C.cyan3, hairStyle: 'buzz', extras: ['glasses', 'apron'] },
  riek: { skin: C.skin0, hair: C.mag2, coat: C.amb1, accent: C.amb4, hairStyle: 'mohawk', extras: ['scarf'] },
  lieve: { skin: C.skin4, hair: C.mud1, coat: C.cyan0, accent: C.amb3, hairStyle: 'long', extras: ['scarf'] },
  jelle: { skin: C.skin4, hair: C.amb2, coat: C.amb1, accent: C.cyan2, hairStyle: 'short', extras: ['beard', 'hood'], build: 'broad' },
  ria: { skin: C.skin1, hair: C.black, coat: C.vio1, accent: C.cyan3, hairStyle: 'bob', build: 'slim' },
  kobus: { skin: C.skin3, hair: C.gray, coat: C.mud1, accent: C.amb3, hairStyle: 'bald', extras: ['beard', 'apron'], build: 'broad' },
  noud: { skin: C.skin2, hair: C.black, coat: C.amb1, accent: C.cyan3, hairStyle: 'spikes', build: 'small' },
  wrecker: { skin: C.skin3, hair: C.mud1, coat: C.slate, accent: C.amb3, hairStyle: 'short', extras: ['cap', 'pack'], build: 'broad' },
  buyer: { skin: C.skin5, hair: C.white, coat: C.cyan0, accent: C.cyan4, hairStyle: 'short', extras: ['coatlong', 'cap'] },
  // The Line tunnels: the Moles wear old metro uniform where they can get it, and night-eye chrome.
  spoor: { skin: C.skin4, hair: C.white, coat: C.cyan0, accent: C.amb3, hairStyle: 'bun', extras: ['cap', 'glasses'], shirt: C.pale, top: 'yoke', build: 'small' },
  sel: { skin: C.skin2, hair: C.amb2, coat: C.mud1, accent: C.amb4, hairStyle: 'braids', extras: ['apron'], shirt: C.amb3, top: 'stripe' },
  grietje: { skin: C.skin1, hair: C.vio2, coat: C.vio1, accent: C.cyan3, hairStyle: 'sidecut', extras: ['visor'], shirt: C.cyan2, top: 'open' },
  mole: { skin: C.skin3, hair: C.black, coat: C.cyan0, accent: C.cyan3, hairStyle: 'short', extras: ['visor', 'cap'], shirt: C.slate, top: 'plain' },
  mole2: { skin: C.skin5, hair: C.mud1, coat: C.slate, accent: C.cyan3, hairStyle: 'long', extras: ['visor', 'scarf'], shirt: C.amb2, top: 'sash' },
  molekid: { skin: C.skin2, hair: C.black, coat: C.cyan1, accent: C.amb3, hairStyle: 'curls', shirt: C.pale, top: 'stripe', build: 'small' },
  splint: { skin: C.skin4, hair: C.mud1, coat: C.slate, accent: C.pale, hairStyle: 'sidecut', extras: ['redmask', 'coatlong'], shirt: C.pale, top: 'open' },
  stillman: { skin: C.skin5, hair: C.pale, coat: C.pale, accent: C.steel4, hairStyle: 'bald', extras: ['glasses', 'apron'], shirt: C.steel2, top: 'yoke', build: 'slim' },
  // Background quests in the Deeps: the runners' race and the washout's old partner.
  wessel: { skin: C.skin1, hair: C.amb2, coat: C.cyan1, accent: C.amb3, hairStyle: 'spikes', shirt: C.pale, top: 'stripe', build: 'small' },
  mara: { skin: C.skin3, hair: C.black, coat: C.mag1, accent: C.cyan3, hairStyle: 'braids', extras: ['pack'], shirt: C.amb3, top: 'sash', build: 'slim' },
  mol: { skin: C.skin4, hair: C.mud1, coat: C.red1, accent: C.pale, hairStyle: 'short', extras: ['cap', 'visor'], shirt: C.pale, top: 'yoke', build: 'broad' },
  // Hubs
  auditor: { skin: C.skin4, hair: C.black, coat: C.cyan1, accent: C.pale, hairStyle: 'bun', extras: ['glasses', 'collar'], shirt: C.pale, top: 'plain' },
};

const ROBOT_PAL = [C.gray, C.slate, C.night, C.red2];
const ROBOT = {
  down: [
    ['..........', '..111111..', '.11111111.', '.13333331.', '.13433431.', '.11111111.', '.22222222.', '2211111122', '2.122221.2', '..00..00..'],
    ['..........', '..111111..', '.11111111.', '.13333331.', '.13433431.', '.11111111.', '.22222222.', '2211111122', '2.122221.2', '......00..'],
    ['..........', '..111111..', '.11111111.', '.13333331.', '.13433431.', '.11111111.', '.22222222.', '2211111122', '2.122221.2', '..00......'],
  ],
  up: [
    ['..........', '..111111..', '.11111111.', '.11111111.', '.11111111.', '.11111111.', '.22222222.', '2211111122', '2.111111.2', '..00..00..'],
    ['..........', '..111111..', '.11111111.', '.11111111.', '.11111111.', '.11111111.', '.22222222.', '2211111122', '2.111111.2', '......00..'],
    ['..........', '..111111..', '.11111111.', '.11111111.', '.11111111.', '.11111111.', '.22222222.', '2211111122', '2.111111.2', '..00......'],
  ],
  right: [
    ['..........', '..11111...', '.1111111..', '.1111333..', '.1111343..', '.1111111..', '..22222...', '.2211112..', '.2.11112..', '...0..0...'],
    ['..........', '..11111...', '.1111111..', '.1111333..', '.1111343..', '.1111111..', '..22222...', '.2211112..', '.2.11112..', '..0....0..'],
    ['..........', '..11111...', '.1111111..', '.1111333..', '.1111343..', '.1111111..', '..22222...', '.2211112..', '.2.11112..', '....00....'],
  ],
};

const DRONE = {
  down: [
    ['..........', '..........', '0.......0.', '11.....11.', '.1222221..', '..23432...', '...222....', '..........', '...0.0....', '..........'],
    ['..........', '0.......0.', '11.....11.', '.1222221..', '..23432...', '...222....', '..........', '..........', '...0.0....', '..........'],
    ['..........', '..........', '0.......0.', '11.....11.', '.1222221..', '..23432...', '...222....', '..........', '...0.0....', '..........'],
  ],
  up: [] as string[][],
  right: [] as string[][],
};
DRONE.up = DRONE.down;
DRONE.right = DRONE.down;

const TURRET = {
  down: [['..........', '..........', '...0000...', '..011110..', '.01144110.', '..011110..', '...0220...', '...0220...', '..022220..', '..000000..']],
  up: [] as string[][],
  right: [] as string[][],
};
TURRET.up = TURRET.down;
TURRET.right = TURRET.down;

const DOG = {
  down: [
    ['..........', '..........', '..........', '.1....1...', '.11111....', '.10110....', '..1111.1..', '..11111...', '..1..1....', '..0..0....'],
    ['..........', '..........', '..........', '.1....1...', '.11111....', '.10110....', '..1111.1..', '..11111...', '..1...1...', '..0...0...'],
    ['..........', '..........', '..........', '.1....1...', '.11111....', '.10110....', '..1111.1..', '..11111...', '...1.1....', '...0.0....'],
  ],
  up: [] as string[][],
  right: [
    ['..........', '..........', '..........', '......1.1.', '......111.', '1.....1101', '.111111...', '.111111...', '.1.1..1.1.', '.0.0..0.0.'],
    ['..........', '..........', '..........', '......1.1.', '......111.', '1.....1101', '.111111...', '.111111...', '..1.1.1.1.', '..0.0.0.0.'],
    ['..........', '..........', '..........', '......1.1.', '......111.', '1.....1101', '.111111...', '.111111...', '.1..1..1..', '.0..0..0..'],
  ],
};
DOG.up = DOG.down;

// The Warden: a Board war machine, two tiles wide, with a red lamp for a face. Drawn centered on its tile.
const WARDEN_F = [
  '.....222222.....',
  '....21111112....',
  '...2114444112...',
  '...2114004112...',
  '...2111111112...',
  '22223333333322222',
  '2111311111131112',
  '2111311441131112',
  '2111311111131112',
  '22.2333333332.22',
  '22..2111112..22.',
  '....2111112.....',
  '....22...22.....',
  '...222...222....',
  '...000...000....',
].map((r) => r.slice(0, 16).padEnd(16, '.'));
const WARDEN_S1 = WARDEN_F.slice(0, 13).concat(['...222....222...', '...000....000...']);
const WARDEN_S2 = WARDEN_F.slice(0, 13).concat(['....222..222....', '....000..000....']);
const WARDEN = { down: [WARDEN_F, WARDEN_S1, WARDEN_S2], up: [WARDEN_F, WARDEN_S1, WARDEN_S2], right: [WARDEN_F, WARDEN_S1, WARDEN_S2] };

const TRAM = [
  '....................',
  '..0000000000000000..',
  '.0222222222222222210',
  '022444424444244442210',
  '0224004240042400422 0',
  '022444424444244442210',
  '02222222222222222221',
  '01111111111111111110',
  '01133111111111133110',
  '01111111111111111110',
  '0000000000000000000.',
  '.00..00......00..00.',
  '....................',
].map((r) => r.replace(/ /g, '.').slice(0, 20).padEnd(20, '.'));
const TILLY = { down: [TRAM, TRAM, TRAM], up: [TRAM, TRAM, TRAM], right: [TRAM, TRAM, TRAM] };

const sheets = new Map<string, Sheet>();

export function sheetFor(look: string | Look): Sheet {
  if (typeof look !== 'string') return personSheet(look);
  const hit = sheets.get(look);
  if (hit) return hit;
  let s: Sheet;
  if (DRAWN[look]) { s = drawnFigure(DRAWN[look]); sheets.set(look, s); return s; }
  if (look === 'courtesy') s = drawnSheet(ROBOT, ROBOT_PAL);
  else if (look === 'courtesy_cyan') s = drawnSheet(ROBOT, [C.gray, C.slate, C.night, C.cyan3]);
  else if (look === 'patrol') s = drawnSheet(ROBOT, [C.pale, C.gray, C.slate, C.red2]);
  else if (look === 'patrol_hushed') s = drawnSheet(ROBOT, [C.steel3, C.steel2, C.steel1, C.steel4]);
  else if (look === 'drone') s = drawnSheet(DRONE, [C.slate, C.night, C.red1, C.red3]);
  else if (look === 'warden') s = drawnSheet(WARDEN, [C.steel2, C.steel1, C.steel0, C.red2]);
  else if (look === 'dog') s = drawnSheet(DOG, [C.mud2, C.mud1, C.pale, C.amb3]);
  else if (look === 'tilly') s = drawnSheet(TILLY, [C.amb1, C.amb2, C.pale, C.amb4]);
  else if (look === 'turret') s = drawnSheet(TURRET, [C.steel2, C.steel1, C.red2, C.red3]);
  else if (look.startsWith('crowd:')) s = personSheet(crowdLook(Number(look.slice(6))));
  else if (LOOKS[look]) s = personSheet(LOOKS[look]);
  else s = personSheet(crowdLook(hashStr(look)));
  sheets.set(look, s);
  return s;
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function clearSheetCache(id: string) { sheets.delete(id); }
