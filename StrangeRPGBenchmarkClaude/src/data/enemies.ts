import type { Pal3 } from '../core/palette';
import type { SpriteSpec } from '../core/sprites';

export interface EnemyDef {
  id: string;
  name: string;
  lvl: number;
  hp: number;
  str: number;
  def: number;
  mnd: number;
  spd: number;
  xp: number;
  gold: number;
  pal: Pal3;
  sprite: SpriteSpec;
  skills: [string, number][];
  shell: number;
  ai?: string;
  boss?: boolean;
  drops?: [string, number][];
  desc: string;
}

interface Mult { hp?: number; str?: number; def?: number; mnd?: number; spd?: number; xp?: number; gold?: number }

export const ENEMIES: Record<string, EnemyDef> = {};

function mk(
  id: string, name: string, lvl: number, sprite: { g?: string; shape?: string; kind?: string; n?: number },
  pal: Pal3, skills: [string, number][], m: Mult, shell: number, desc: string,
  extra: Partial<EnemyDef> = {},
) {
  const spec: SpriteSpec = sprite.kind
    ? { g: 'beast', pal, o: { kind: sprite.kind } }
    : sprite.g === 'human'
      ? { g: 'human', seed: id, pal }
      : { g: 'monster', seed: id, pal, o: { shape: sprite.shape ?? 'blob' }, n: sprite.n ?? 1 };
  ENEMIES[id] = {
    id, name, lvl, pal, sprite: spec, skills, shell, desc,
    hp: Math.round((12 + 5 * lvl) * (m.hp ?? 1)),
    str: Math.round((6 + 1.75 * lvl) * (m.str ?? 1)),
    def: Math.round((5 + 1.25 * lvl) * (m.def ?? 1)),
    mnd: Math.round((6 + 1.6 * lvl) * (m.mnd ?? 1)),
    spd: Math.round((8 + 0.8 * lvl) * (m.spd ?? 1)),
    xp: Math.round((4 + 2.6 * Math.pow(lvl, 1.3)) * (m.xp ?? 1)),
    gold: Math.round((3 + 1.7 * lvl) * (m.gold ?? 1)),
    ...extra,
  };
}

// Chapter 1: the Hollow Wood. Blanks are grey, so hues do nothing yet.
mk('lint_wolf', 'Lint Wolf', 1, { shape: 'crawler' }, ['k', 'g2', 'g3'], [['bite', 3], ['lint_howl', 1]], { hp: 0.9 }, 0,
  'A wolf of dryer lint. It howls for socks it never had.');
mk('hush_moth', 'Hush Moth', 2, { shape: 'flyer' }, ['k', 'g1', 'g3'], [['bite', 2], ['dust', 1]], { hp: 0.8, spd: 1.2 }, 0,
  'Eats sound first, then color.');
mk('static_newt', 'Static Newt', 2, { shape: 'worm' }, ['k', 'g2', 'w'], [['zap', 2], ['bite', 1]], { hp: 0.85, mnd: 1.1 }, 0,
  'Its skin plays the channel between channels.');
mk('blank_pup', 'Blank Pup', 3, { shape: 'blob' }, ['k', 'g1', 'g2'], [['bite', 2], ['drain', 1]], {}, 0,
  'A young Blank. It nuzzles colorful things until they stop being colorful.');
mk('antenna_crab', 'Antenna Crab', 3, { shape: 'bug' }, ['k', 'g2', 'g3'], [['pinch', 2], ['harden', 1]], { hp: 1.1, def: 1.4, spd: 0.8 }, 0,
  'Lives in the roots of antenna trees and picks up distant weather.');
mk('gloam_stag', 'Gloam Stag', 4, { shape: 'tall' }, ['k', 'g1', 'w'], [['tackle', 2], ['lint_howl', 1], ['bite', 1]], { hp: 2.4, str: 1.1, xp: 3, gold: 3 }, 0,
  'The oldest Blank in the wood. Its antlers pick up a station that went off the air.');
mk('grey_moth', 'Grey Moth', 5, { shape: 'flyer', n: 2 }, ['k', 'g2', 'w'], [['wing_buffet', 2], ['moth_kiss', 1], ['bite', 2]], { hp: 2.2, str: 2.3, mnd: 2.5, spd: 1.5, xp: 6, gold: 6 }, 0,
  'It drinks color through a proboscis longer than a road.', { ai: 'grey_moth', boss: true });

// Chapter 2: the Fizz. Everything has hues.
mk('beepbog', 'Beepbog', 5, { shape: 'blob' }, ['k', 'e2', 'y2'], [['croak', 1], ['bite', 2]], {}, 0,
  'A frog that croaks in dial tones.');
mk('crayonfish', 'Crayonfish', 6, { shape: 'star' }, ['k', 'r2', 'o3'], [['crayon_jab', 3], ['harden', 1]], { def: 1.2 }, 0,
  'Writes its name on rocks. Can only spell the first letter.');
mk('radio_heron', 'Radio Heron', 6, { shape: 'tall' }, ['k', 'c2', 'w'], [['peck', 2], ['broadcast', 1]], { spd: 1.2 }, 0,
  'Stands on one leg to get better reception.');
mk('glitch_newt', 'Glitch Newt', 7, { shape: 'worm' }, ['k', 'm2', 'e3'], [['glitch', 3], ['zap', 1]], { mnd: 1.0, hp: 0.9 }, 0,
  'Sometimes appears twice. Only one of it is real.');
mk('paint_slime', 'Paint Slime', 7, { shape: 'blob' }, ['k', 'b2', 'b3'], [['ooze', 2], ['bite', 1]], { hp: 1.2, spd: 0.8 }, 0,
  'A puddle of blue that got ideas.');
mk('static_wisp', 'Static Wisp', 8, { shape: 'ghost' }, ['k', 'c3', 'm2'], [['wisp_fire', 2], ['zap', 1]], { mnd: 1.2, hp: 0.85 }, 0,
  'A ghost made of a song nobody finished.');
mk('octachrome', 'Octachrome', 9, { shape: 'ghost', n: 2 }, ['k', 'r2', 'y2'], [['tentacle', 3], ['ink_squirt', 2]], { hp: 3.3, str: 3.1, mnd: 3.2, spd: 2.2, xp: 6, gold: 8 }, 0,
  'The Hue Thief. Eight arms, eight stolen colors, and it only ever wears two.', { ai: 'octachrome', boss: true });

// Chapter 3: Carillon. Shells appear.
mk('bell_ghoul', 'Bell Ghoul', 9, { shape: 'ghost' }, ['k', 'y1', 'y3'], [['toll', 1], ['bite', 2]], {}, 2,
  'Rings when it is hungry. It is always hungry.');
mk('hymnal_mimic', 'Hymnal Mimic', 10, { shape: 'totem' }, ['k', 'r1', 'w'], [['page_cut', 3], ['harden', 1]], { def: 1.2 }, 3,
  'A hymn book with teeth. It knows every verse and hums the wrong one.');
mk('censer_drone', 'Censer Drone', 10, { shape: 'eye' }, ['k', 'c1', 'o2'], [['censer', 2], ['zap', 1]], { hp: 0.9 }, 2,
  'Swings incense that smells like a server room.');
mk('pew_crawler', 'Pew Crawler', 11, { shape: 'crawler' }, ['k', 'n2', 'e1'], [['pew_bite', 3]], { hp: 1.1 }, 2,
  'A church bench that learned to walk and never learned to stop.');
mk('acolyte', 'Grey Acolyte', 11, { g: 'human' }, ['k', 'b3', 'w'], [['hymn', 2], ['mend_choir', 1], ['bite', 1]], { mnd: 1.1 }, 2,
  'Sings color out of the air and into a jar.');
mk('rib_sentinel', 'Rib Sentinel', 12, { shape: 'tall' }, ['k', 'g2', 'r2'], [['rib_slam', 2], ['harden', 1]], { hp: 1.5, def: 1.2 }, 4,
  'A rib of the dead giant, still guarding the heart it used to hold.');
mk('templar', 'Loom Templar', 13, { g: 'human' }, ['k', 'b1', 'y2'], [['rib_slam', 2], ['page_cut', 2], ['harden', 1]], { hp: 1.2, def: 1.1 }, 3,
  'A knight of the Church. Its armor is full. That is the difference between it and Brask.');
mk('choirboy', 'Choirboy', 11, { g: 'human' }, ['k', 'b2', 'w'], [['hymn', 2], ['mend_choir', 1]], { hp: 0.7 }, 2,
  'Hits the high notes. Also hits you.');
mk('cantor_hush', 'Cantor Hush', 13, { shape: 'totem', n: 2 }, ['k', 'w', 'b3'], [['hymn', 2], ['hush', 1], ['page_cut', 2]], { hp: 1.5, str: 3.5, mnd: 3.85, spd: 2.0, xp: 6, gold: 8 }, 6,
  'The soloist of the Grey Choir. His voice has no color and too much volume.', { ai: 'cantor', boss: true });

// Chapter 4: the Hourglass Waste.
mk('gearsand_scorpion', 'Gearsand Scorpion', 13, { shape: 'bug' }, ['k', 'y2', 'n3'], [['sting', 2], ['pinch', 1]], {}, 2,
  'Built from sand that is really very small gears.');
mk('paradox_hen', 'Paradox Hen', 14, { kind: 'bird' }, ['k', 'w', 'r2'], [['lay_egg', 1], ['hen_peck', 2]], { hp: 1.1 }, 2,
  'Its chicks hatch before it lays them. It is tired.');
mk('hen_chick', 'Early Chick', 12, { kind: 'bird' }, ['k', 'y3', 'r3'], [['peck', 1]], { hp: 0.5, xp: 0.3, gold: 0.3 }, 1,
  'Arrived yesterday. Will be laid tomorrow.');
mk('dune_clock', 'Dune Clock', 14, { shape: 'eye' }, ['k', 'e2', 'y3'], [['chime', 2], ['bite', 1]], { mnd: 1.1 }, 3,
  'Keeps perfect time for a town that has not been built yet.');
mk('minute_mite', 'Minute Mite', 15, { shape: 'bug' }, ['k', 'm1', 'e2'], [['rush', 1]], { hp: 0.7, spd: 1.7 }, 1,
  'Lives for exactly one minute, over and over.');
mk('hourglass_golem', 'Hourglass Golem', 16, { shape: 'totem' }, ['k', 'o2', 'c2'], [['sand_slam', 3], ['glass_skin', 1]], { hp: 1.6, def: 1.1, spd: 0.8 }, 4,
  'When it falls over, it gets younger.');
mk('chronophage', 'Chronophage', 17, { shape: 'worm', n: 2 }, ['k', 'e2', 'm2'], [['devour_hour', 3], ['bite', 1]], { hp: 3.6, str: 6.3, mnd: 6.3, spd: 2.0, xp: 6, gold: 8 }, 6,
  'A worm that eats hours. The monastery has been Tuesday for a century.', { ai: 'chronophage', boss: true });

// Chapter 5: the Undermarket.
mk('coinmite', 'Coinmite', 17, { shape: 'bug' }, ['k', 'y2', 'y3'], [['pilfer', 3]], { hp: 0.8, spd: 1.3, gold: 2 }, 2,
  'Collects loose change, and pockets, and hands.');
mk('repo_drone', 'Repo Drone', 18, { shape: 'eye' }, ['k', 'r2', 'g3'], [['repossess', 2], ['zap', 1]], {}, 3,
  'Here to collect. It has a form for everything.');
mk('haggle_imp', 'Haggle Imp', 18, { g: 'human' }, ['k', 'm2', 'o2'], [['haggle', 1], ['claw', 2]], { spd: 1.2 }, 2,
  'Will sell you your own shoes at a discount.');
mk('moon_rat', 'Moon Rat', 19, { shape: 'crawler' }, ['k', 'g2', 'c3'], [['gnaw', 3]], {}, 2,
  'Chewed a hole in the moon. It was already hollow. The rat is proud anyway.');
mk('tag_mimic', 'Tag Mimic', 20, { shape: 'totem' }, ['k', 'w', 'r2'], [['price_hike', 1], ['page_cut', 2]], { hp: 1.2 }, 3,
  'A price tag with a creature attached. Everything here is for sale, including it.');
mk('hired_goon', 'Hired Goon', 18, { g: 'human' }, ['k', 'n2', 'r2'], [['claw', 2], ['tackle', 1]], { hp: 0.9, xp: 0.5, gold: 0.3 }, 2,
  'Paid by the hour. Checks the clock between punches.');
mk('baron_surplus', 'Baron Surplus', 21, { shape: 'totem', n: 2 }, ['k', 'y2', 'm2'], [['gold_rain', 2], ['claw', 2]], { hp: 4.0, str: 3.5, mnd: 3.5, spd: 2.0, xp: 6, gold: 10 }, 7,
  'Owns the market, the moon, and a small percentage of your future.', { ai: 'baron', boss: true });

// Chapter 6: the Tether.
mk('stormkite', 'Stormkite', 21, { shape: 'flyer' }, ['k', 'b2', 'y3'], [['gust', 1], ['bolt', 2]], { spd: 1.2, hp: 0.9 }, 2,
  'A kite that cut its own string.');
mk('cloud_whale', 'Cloud Whale', 22, { kind: 'whale' }, ['k', 'w', 'c2'], [['whale_song', 1], ['body_slam', 2]], { hp: 2.0, spd: 0.7, xp: 1.6 }, 4,
  'Swims through weather. Its song is a low-pressure system.');
mk('vine_lurker', 'Vine Lurker', 22, { shape: 'worm' }, ['k', 'e1', 'r2'], [['constrict', 3]], {}, 3,
  'Grew up the Tether and forgot to stop being hungry.');
mk('sky_pirate', 'Sky Pirate', 23, { g: 'human' }, ['k', 'r2', 'b3'], [['cutlass', 3], ['harden', 1]], {}, 2,
  'Plunders clouds for their silver linings.');
mk('ion_jelly', 'Ion Jelly', 24, { shape: 'ghost' }, ['k', 'm3', 'c2'], [['jelly_sting', 3]], { mnd: 1.15, hp: 0.9 }, 2,
  'Drifts in the high air and stings satellites.');
mk('seraph_k7', 'Seraph K-7', 25, { shape: 'star', n: 3 }, ['k', 'w', 'y2'], [['halo_ray', 3], ['wing_blades', 2]], { hp: 4.8, str: 3.8, mnd: 3.9, spd: 2.0, xp: 6, gold: 10 }, 8,
  'The gate guardian. Its halo is a targeting ring.', { ai: 'seraph', boss: true });

// Chapter 7: the Loom.
mk('spool_spider', 'Spool Spider', 25, { shape: 'bug' }, ['k', 'g3', 'm2'], [['spin_web', 1], ['bite', 3]], {}, 3,
  'Rewinds loose thread. Sometimes the thread was a person.');
mk('unprinter', 'Unprinter', 26, { shape: 'eye' }, ['k', 'g1', 'w'], [['unprint_ray', 2], ['bite', 1]], { mnd: 1.1 }, 3,
  'An eye that looks at color until the color leaves.');
mk('thread_serpent', 'Thread Serpent', 27, { shape: 'worm' }, ['k', 'r2', 'c3'], [['thread_lash', 3]], {}, 3,
  'One very long stitch that came loose.');
mk('loom_warden', 'Loom Warden', 28, { shape: 'tall' }, ['k', 'b1', 'y2'], [['warden_cleave', 2], ['harden', 1]], { hp: 1.5 }, 5,
  'Built to protect the Loom from anything, including repairs.');
mk('grey_chorister', 'Grey Chorister', 27, { g: 'human' }, ['k', 'g2', 'w'], [['hymn', 2], ['mend_choir', 1]], {}, 2,
  'A choir member who reached the top and forgot the song.');
mk('the_spindle', 'The Spindle', 29, { shape: 'totem', n: 2 }, ['k', 'c2', 'r2'], [['thread_lash', 3], ['compress', 1]], { hp: 4.25, str: 2.8, mnd: 2.8, spd: 2.0, xp: 6, gold: 10 }, 7,
  'The axle of the Loom. It turns the world, and it would like to stop.', { ai: 'spindle', boss: true });
mk('grey_bishop_1', 'Grey Bishop', 34, { kind: 'bishop' }, ['k', 'g2', 'w'], [['compress', 2], ['erase', 2]], { hp: 30, str: 1.2, mnd: 1.2, xp: 0, gold: 0 }, 0,
  'The Loom\'s triage routine, wearing a church.', { ai: 'bishop_ordeal', boss: true });

// Chapter 8: the grey world.
mk('null_sheep', 'Null Sheep', 29, { kind: 'sheep' }, ['k', 'g3', 'w'], [['fleece', 1], ['tackle', 2]], { hp: 1.2 }, 2,
  'Counting them makes you forget what came before.');
mk('eraser_knight', 'Eraser Knight', 30, { g: 'human' }, ['k', 'g1', 'm3'], [['eraser_edge', 3], ['harden', 1]], { hp: 1.3, def: 1.1 }, 4,
  'Sworn to remove every mistake. It started with its own face.');
mk('palette_wraith', 'Palette Wraith', 31, { shape: 'ghost' }, ['k', 'r3', 'b3'], [['wraith_wail', 2], ['palette_swap', 1]], { mnd: 1.15 }, 3,
  'The ghost of every color the Bishop took. It is angry at everyone.');
mk('grey_bishop', 'Grey Bishop', 34, { shape: 'totem', n: 3 }, ['k', 'g2', 'w'], [['compress', 2], ['erase', 2]], { hp: 3.15, str: 2.2, mnd: 2.3, spd: 2.2, xp: 0, gold: 0 }, 8,
  'Grey and white. No hue can touch him until someone paints him.', { ai: 'bishop', boss: true });

mk('bishop_loom', 'The Loom-Bound Bishop', 36, { shape: 'star', n: 3 }, ['k', 'g2', 'w'], [['compress', 2], ['erase', 2], ['warden_cleave', 1]], { hp: 4.4, str: 2.65, mnd: 2.9, spd: 2.2, xp: 0, gold: 0 }, 8,
  'The Bishop, wearing the Loom like a robe. Its colors change as it pulls them from the world.', { ai: 'bishop2', boss: true });

export interface Group { enemies: string[]; flee?: boolean; music?: string }

export const GROUPS: Record<string, Group> = {
  // Chapter 1
  wolf1: { enemies: ['lint_wolf'] },
  wolf2: { enemies: ['lint_wolf', 'lint_wolf'] },
  moth2: { enemies: ['hush_moth', 'lint_wolf'] },
  newt2: { enemies: ['static_newt', 'hush_moth'] },
  pup1: { enemies: ['blank_pup', 'lint_wolf'] },
  crab1: { enemies: ['antenna_crab', 'static_newt'] },
  pup3: { enemies: ['blank_pup', 'hush_moth', 'blank_pup'] },
  stag: { enemies: ['gloam_stag'], flee: false },
  boss1: { enemies: ['grey_moth'], flee: false, music: 'boss' },
  // Chapter 2
  bog2: { enemies: ['beepbog', 'beepbog'] },
  fish2: { enemies: ['crayonfish', 'beepbog'] },
  heron: { enemies: ['radio_heron', 'crayonfish'] },
  newt3: { enemies: ['glitch_newt', 'paint_slime'] },
  slime3: { enemies: ['paint_slime', 'radio_heron', 'beepbog'] },
  wisp2: { enemies: ['static_wisp', 'glitch_newt'] },
  wisp3: { enemies: ['static_wisp', 'paint_slime', 'crayonfish'] },
  boss2: { enemies: ['octachrome'], flee: false, music: 'boss' },
  // Chapter 3
  ghoul2: { enemies: ['bell_ghoul', 'bell_ghoul'] },
  mimic2: { enemies: ['hymnal_mimic', 'censer_drone'] },
  pew3: { enemies: ['pew_crawler', 'bell_ghoul', 'censer_drone'] },
  aco2: { enemies: ['acolyte', 'acolyte'] },
  aco3: { enemies: ['acolyte', 'pew_crawler', 'hymnal_mimic'] },
  rib: { enemies: ['rib_sentinel', 'censer_drone'] },
  templars: { enemies: ['templar', 'acolyte', 'templar'], flee: false },
  boss3: { enemies: ['choirboy', 'cantor_hush', 'choirboy'], flee: false, music: 'boss' },
  // Chapter 4
  scorp2: { enemies: ['gearsand_scorpion', 'gearsand_scorpion'] },
  hen: { enemies: ['paradox_hen', 'gearsand_scorpion'] },
  clock2: { enemies: ['dune_clock', 'minute_mite'] },
  mite3: { enemies: ['minute_mite', 'minute_mite', 'dune_clock'] },
  golem: { enemies: ['hourglass_golem', 'minute_mite'] },
  golem2: { enemies: ['hourglass_golem', 'paradox_hen'] },
  boss4: { enemies: ['chronophage'], flee: false, music: 'boss' },
  // Chapter 5
  mite5: { enemies: ['coinmite', 'coinmite', 'coinmite'] },
  repo: { enemies: ['repo_drone', 'haggle_imp'] },
  rat2: { enemies: ['moon_rat', 'moon_rat'] },
  tag: { enemies: ['tag_mimic', 'coinmite'] },
  imp3: { enemies: ['haggle_imp', 'moon_rat', 'repo_drone'] },
  boss5: { enemies: ['baron_surplus'], flee: false, music: 'boss' },
  // Chapter 6
  kite2: { enemies: ['stormkite', 'stormkite'] },
  whale: { enemies: ['cloud_whale'] },
  vine2: { enemies: ['vine_lurker', 'stormkite'] },
  pirate: { enemies: ['sky_pirate', 'sky_pirate'] },
  jelly3: { enemies: ['ion_jelly', 'vine_lurker', 'ion_jelly'] },
  crew: { enemies: ['sky_pirate', 'cloud_whale', 'stormkite'] },
  boss6: { enemies: ['seraph_k7'], flee: false, music: 'boss' },
  // Chapter 7
  spider2: { enemies: ['spool_spider', 'spool_spider'] },
  unp2: { enemies: ['unprinter', 'thread_serpent'] },
  serp: { enemies: ['thread_serpent', 'spool_spider', 'unprinter'] },
  warden: { enemies: ['loom_warden', 'grey_chorister'] },
  chorus: { enemies: ['grey_chorister', 'grey_chorister', 'unprinter'] },
  boss7: { enemies: ['the_spindle'], flee: false, music: 'boss' },
  ordeal: { enemies: ['grey_bishop_1'], flee: false, music: 'final' },
  // Chapter 8
  sheep2: { enemies: ['null_sheep', 'null_sheep'] },
  knight: { enemies: ['eraser_knight', 'palette_wraith'] },
  wraith3: { enemies: ['palette_wraith', 'null_sheep', 'palette_wraith'] },
  mixed8: { enemies: ['eraser_knight', 'null_sheep', 'unprinter'] },
  final: { enemies: ['grey_bishop'], flee: false, music: 'final' },
  final2: { enemies: ['bishop_loom'], flee: false, music: 'final' },
};
