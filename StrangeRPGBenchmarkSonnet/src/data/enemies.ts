import type { Unit } from '../core/battle';
import { CHAPTER_LEVEL, XP_NEED } from './characters';
import { TUNING } from './tuning';
import type { EncounterDef, EnemyDef, Field, Elem, Role, ScriptEntry, Stats } from './types';

export const ENEMIES: Record<string, EnemyDef> = {};

type Opt = Partial<Pick<EnemyDef, 'boss' | 'hpMul' | 'atkMul' | 'spdMul' | 'lvlOff' | 'immune' | 'blurb'>>;
function E(id: string, name: string, role: Role, arch: string, colors: [string, string], weak: Elem[], resist: Elem[], script: ScriptEntry[], o: Opt = {}, seed = 0) {
  ENEMIES[id] = { id, name, role, arch, colors, weak, resist, script, seed: seed || id.length * 7919 + name.charCodeAt(0) * 31, ...o };
}
const sc = (s: string, w = 1, x: Partial<ScriptEntry> = {}): ScriptEntry => ({ s, w, ...x });

// ---- Chapter 1: Belfry of Tuck
E('mite', 'Dust Mite', 'skirmisher', 'bug', ['#b8a890', '#5a4a3a'], ['ember'], [], [sc('e_hit', 3), sc('e_flurry')]);
E('gremlin', 'Gear Gremlin', 'brute', 'gear', ['#c8a060', '#6a4a20'], ['volt'], [], [sc('e_hit', 3), sc('e_heavy')]);
E('wisp', 'Crumb Wisp', 'caster', 'ghost', ['#f0e0a0', '#a08040'], ['frost'], [], [sc('e_fire', 3), sc('e_mend', 1, { when: 'selfHurt' })]);
E('beetle', 'Bell Beetle', 'tank', 'bug', ['#d0b040', '#604010'], ['frost'], [], [sc('e_hit', 3), sc('e_brace'), sc('e_stun')]);
E('warden', 'Dust Warden', 'brute', 'gear', ['#9ab0c0', '#3a4a5a'], ['volt'], [], [sc('e_hit', 3), sc('e_sweep', 2), sc('e_crush', 3, { every: 4 })], { boss: true, hpMul: 4.4, atkMul: 1.0 });

// ---- Chapter 2: Dead Letter Office
E('bat', 'Paper Bat', 'skirmisher', 'bat', ['#f0ead8', '#8a7a60'], ['ember'], [], [sc('e_flurry', 2), sc('e_bite')]);
E('stampcrab', 'Stamp Crab', 'tank', 'crab', ['#c84a4a', '#501818'], ['volt'], ['frost'], [sc('e_stun', 2), sc('e_heavy'), sc('e_brace')]);
E('blot', 'Ink Blot', 'caster', 'blob', ['#6a5acd', '#1a1040'], ['lumen'], ['umbra'], [sc('e_shade', 3), sc('e_sap')]);
E('letter', 'Angry Letter', 'support', 'book', ['#fff0c8', '#c84a4a'], ['ember'], [], [sc('e_jinx'), sc('e_hit', 2), sc('e_mendall', 1, { when: 'partyHurt' })]);
E('undelivered', 'The Undelivered', 'brute', 'book', ['#e8d8a8', '#8a3a3a'], ['ember'], ['frost'], [sc('e_hit', 3), sc('e_delay', 2), sc('e_sweep', 2), sc('e_crush', 3, { every: 4 })], { boss: true, hpMul: 7.5, atkMul: 1.0 });

// ---- Chapter 3: Comfort Hollow
E('puff', 'Pillow Puff', 'tank', 'blob', ['#ffd8e8', '#c86a9a'], ['ember'], ['bloom'], [sc('e_hit', 3), sc('e_lull', 2), sc('e_brace')]);
E('nap', 'Nap Sprite', 'caster', 'ghost', ['#c8d8ff', '#5a6ab8'], ['lumen'], ['umbra'], [sc('e_spores', 2), sc('e_lull', 2), sc('e_beam')]);
E('yarn', 'Yarn Hound', 'skirmisher', 'hound', ['#ff6a8a', '#8a2a4a'], ['ember'], [], [sc('e_flurry', 2), sc('e_bite', 2)]);
E('sock', 'Sock Golem', 'brute', 'tall', ['#a8d0a0', '#4a6a4a'], ['ember'], [], [sc('e_heavy', 2), sc('e_hit', 2), sc('e_sweep')]);
E('mothercomfort', 'Mother Comfort', 'tank', 'blob', ['#ffc8d8', '#9a4a6a'], ['ember'], ['bloom', 'umbra'], [sc('e_hit', 2), sc('e_spores', 2), sc('e_mendall', 2, { when: 'allyDown' }), sc('e_lull', 2), sc('e_bloomfall', 3, { every: 5 })], { boss: true, hpMul: 7.5, atkMul: 1.05 });

// ---- Chapter 4: The Firm
E('stapler', 'Stapler Drake', 'brute', 'hound', ['#d84a2a', '#4a1a10'], ['frost'], ['ember'], [sc('e_bite', 2), sc('e_heavy'), sc('e_flurry')]);
E('memo', 'Memo Imp', 'skirmisher', 'bat', ['#fffae0', '#6a8ac0'], ['lumen'], [], [sc('e_flurry', 2), sc('e_jinx')]);
E('toner', 'Toner Ghoul', 'caster', 'ghost', ['#404060', '#101020'], ['lumen'], ['umbra'], [sc('e_shade', 2), sc('e_sap'), sc('e_drain')]);
E('filing', 'Filing Mimic', 'tank', 'crab', ['#9aa8b8', '#3a4858'], ['volt'], [], [sc('e_stun', 2), sc('e_heavy'), sc('e_brace')]);
E('proctor', 'The Proctor', 'caster', 'eye', ['#f0f0ff', '#c02a2a'], ['bloom'], ['umbra'], [sc('e_sap', 2), sc('e_jinx', 2), sc('e_shade', 2), sc('e_delay'), sc('e_crush', 3, { every: 4 })], { boss: true, hpMul: 8.5, atkMul: 1.2 });

// ---- Chapter 5: Transit Yard
E('turnstile', 'Turnstile Bot', 'brute', 'gear', ['#8ac0d0', '#2a4a5a'], ['volt'], [], [sc('e_stun', 2), sc('e_heavy', 2), sc('e_hit')]);
E('commuter', 'Ghost Commuter', 'support', 'ghost', ['#b0c8c0', '#3a5a50'], ['lumen'], ['umbra'], [sc('e_drain', 2), sc('e_jinx'), sc('e_rally', 1, { when: 'allyDown' })]);
E('pigeon', 'Pigeon Flock', 'skirmisher', 'bat', ['#a0a8b8', '#404858'], ['ember'], [], [sc('e_flurry', 2), sc('e_sweep', 2)]);
E('signal', 'Signal Spirit', 'caster', 'eye', ['#ff4a4a', '#ffe84a'], ['umbra'], ['volt'], [sc('e_bolt', 3), sc('e_thunder', 1), sc('e_jinx')]);
E('tollgate', 'The Toll Gate', 'tank', 'gear', ['#ffd84a', '#6a4a10'], ['volt'], ['frost'], [sc('e_stun', 2), sc('e_heavy', 2), sc('e_sweep', 2), sc('e_discharge', 3, { every: 4 })], { boss: true, hpMul: 8.5, atkMul: 1.1 });

// ---- Chapter 6: The Long Table
E('pawn', 'Pawn Mob', 'skirmisher', 'tall', ['#f0f0e0', '#2a2a3a'], ['lumen'], [], [sc('e_flurry', 2), sc('e_hit', 2)]);
E('die', 'Loaded Die', 'brute', 'gear', ['#ffffff', '#c02020'], ['frost'], [], [sc('e_heavy', 2), sc('e_hit', 2), sc('e_stun')]);
E('shark', 'Card Shark', 'skirmisher', 'hound', ['#4ac0e0', '#1a3a5a'], ['bloom'], ['frost'], [sc('e_bite', 2), sc('e_flurry', 2), sc('e_sap')]);
E('bishop', 'Bishop Bat', 'caster', 'bat', ['#c8a0ff', '#4a2a7a'], ['ember'], ['umbra'], [sc('e_shade', 2), sc('e_fire', 2), sc('e_jinx')]);
E('stay', 'Stay the Gentle', 'caster', 'tall', ['#f8e8d0', '#b08a5a'], ['volt'], ['lumen', 'umbra'], [sc('e_beam', 2), sc('e_lull', 2), sc('e_mendall', 2, { when: 'partyHurt' }), sc('e_nova', 1), sc('e_radiance', 3, { every: 5 })], { boss: true, hpMul: 6.5, atkMul: 1.1, blurb: 'The Archivist\'s smiling vice-president.' });
E('house', 'The House', 'support', 'eye', ['#20a050', '#e0c020'], ['bloom'], ['volt'], [sc('e_flurry', 2), sc('e_jinx', 2), sc('e_bolt', 2), sc('e_mendall', 2, { when: 'allyDown' }), sc('e_discharge', 3, { every: 5 })], { boss: true, hpMul: 9.0, atkMul: 1.15 });

// ---- Chapter 7: Foundry Star
E('slagslime', 'Slag Slime', 'tank', 'blob', ['#ff7a2a', '#5a1a0a'], ['frost'], ['ember'], [sc('e_hit', 2), sc('e_fire', 2), sc('e_brace')]);
E('cinderbat', 'Cinder Bat', 'skirmisher', 'bat', ['#ff5a2a', '#3a1a1a'], ['volt'], ['ember'], [sc('e_flurry', 2), sc('e_fire', 2)]);
E('anvilcrab', 'Anvil Crab', 'tank', 'crab', ['#7a8090', '#2a2a3a'], ['bloom'], [], [sc('e_stun', 2), sc('e_heavy', 2), sc('e_brace')]);
E('bellows', 'Bellows Imp', 'caster', 'ghost', ['#ffb84a', '#7a3a1a'], ['frost'], ['ember'], [sc('e_firestorm', 2), sc('e_fire', 2), sc('e_rally')]);
E('furnacesaint', 'Furnace Saint', 'brute', 'tall', ['#ffa030', '#501808'], ['frost'], ['ember'], [sc('e_heavy', 2), sc('e_fire', 2), sc('e_firestorm', 2), sc('e_megaflare', 3, { every: 4 })], { boss: true, hpMul: 9.5, atkMul: 1.15 });

// ---- Chapter 8: The Overdue Library
E('bookworm', 'Bookworm', 'brute', 'worm', ['#c8e090', '#4a6a20'], ['ember'], [], [sc('e_bite', 2), sc('e_heavy'), sc('e_hit')]);
E('footnote', 'Footnote Wraith', 'caster', 'ghost', ['#d8d8f0', '#5a5a8a'], ['lumen'], ['umbra'], [sc('e_shade', 2), sc('e_drain'), sc('e_sap')]);
E('silencemoth', 'Silence Moth', 'skirmisher', 'bat', ['#e0d8c8', '#6a6a5a'], ['ember'], [], [sc('e_flurry', 2), sc('e_lull'), sc('e_bite')]);
E('collector', 'Fine Collector', 'support', 'tall', ['#a0703a', '#3a2010'], ['umbra'], [], [sc('e_delay', 2), sc('e_hit', 2), sc('e_jinx'), sc('e_mendall', 1, { when: 'allyDown' })]);
E('overdue', 'The Overdue', 'caster', 'tall', ['#d8c8a0', '#4a1a1a'], ['lumen'], ['umbra'], [sc('e_delay', 2), sc('e_shade', 2), sc('e_drain', 2), sc('e_sap'), sc('e_eclipse', 3, { every: 4 })], { boss: true, hpMul: 10, atkMul: 1.2 });

// ---- Chapter 9: The Null Garden
E('weedtoad', 'Weed Toad', 'brute', 'blob', ['#7ac850', '#2a4a1a'], ['ember'], ['bloom'], [sc('e_heavy', 2), sc('e_bite', 2), sc('e_spores')]);
E('bonsai', 'Bonsai Golem', 'tank', 'plant', ['#58b068', '#3a2a1a'], ['ember'], ['bloom'], [sc('e_hit', 2), sc('e_brace'), sc('e_thorn', 2)]);
E('pollen', 'Pollen Puff', 'caster', 'blob', ['#ffe860', '#a8a020'], ['frost'], ['bloom'], [sc('e_spores', 2), sc('e_thorn', 2), sc('e_lull')]);
E('thornstag', 'Thorn Stag', 'skirmisher', 'hound', ['#8ad070', '#3a5a2a'], ['frost'], ['bloom'], [sc('e_flurry', 2), sc('e_thorn'), sc('e_heavy')]);
E('evergreen', 'The Evergreen', 'tank', 'plant', ['#40d070', '#104020'], ['ember'], ['bloom', 'frost'], [sc('e_heavy', 2), sc('e_thorn', 2), sc('e_spores', 2), sc('e_mend', 2, { when: 'selfHurt' }), sc('e_bloomfall', 3, { every: 4 })], { boss: true, hpMul: 10, atkMul: 1.2 });

// ---- Chapter 10: Unraveling Seams
E('thread', 'Loose Thread', 'skirmisher', 'worm', ['#ff8ab8', '#8a3a5a'], ['ember'], [], [sc('e_flurry', 2), sc('e_bite'), sc('e_jinx')]);
E('button', 'Button Mimic', 'tank', 'crab', ['#58a0ff', '#1a3a7a'], ['volt'], [], [sc('e_heavy', 2), sc('e_stun', 2), sc('e_brace')]);
E('seamwraith', 'Seam Wraith', 'caster', 'ghost', ['#b8b8d8', '#4a4a6a'], ['lumen'], ['umbra'], [sc('e_dusk', 2), sc('e_shade', 2), sc('e_drain')]);
E('needle', 'Needle Wasp', 'skirmisher', 'bug', ['#ffd0a0', '#8a4a2a'], ['frost'], [], [sc('e_flurry', 3), sc('e_bite')]);
E('hourhound', 'Hound of Hours', 'skirmisher', 'hound', ['#e8e8ff', '#3a3a7a'], ['lumen'], ['umbra'], [sc('e_flurry', 2), sc('e_bite', 2), sc('e_delay', 2), sc('e_maelstrom', 3, { every: 4 })], { boss: true, hpMul: 10, atkMul: 1.25, spdMul: 1.15 });

// ---- Chapter 11: The Margin
E('blankpage', 'Blank Page', 'tank', 'book', ['#ffffff', '#b0b0b0'], ['ember'], ['lumen'], [sc('e_hit', 2), sc('e_brace'), sc('e_sap', 2)]);
E('redaction', 'Redaction', 'brute', 'skull', ['#202020', '#ffffff'], ['lumen'], ['umbra'], [sc('e_heavy', 2), sc('e_shade', 2), sc('e_hit')]);
E('erasure', 'Erasure Angel', 'caster', 'bat', ['#f8f8f8', '#8a8aff'], ['umbra'], ['lumen'], [sc('e_beam', 2), sc('e_nova', 2), sc('e_mendall', 1, { when: 'partyHurt' })]);
E('asterisk', 'Asterisk', 'skirmisher', 'eye', ['#ffff80', '#806000'], ['volt'], [], [sc('e_flurry', 2), sc('e_bolt', 2), sc('e_jinx')]);
E('archivist', 'The Archivist', 'caster', 'tall', ['#f0e8ff', '#3a2a6a'], ['ember'], ['umbra', 'lumen'], [
  sc('e_beam', 2, { hp: [0.66, 1] }), sc('e_sap', 1, { hp: [0.66, 1] }), sc('e_eclipse', 3, { hp: [0.66, 1], every: 4 }),
  sc('e_drain', 2, { hp: [0.33, 0.66] }), sc('e_dusk', 2, { hp: [0.33, 0.66] }), sc('e_delay', 2, { hp: [0.33, 0.66] }), sc('e_radiance', 3, { hp: [0.33, 0.66], every: 3 }),
  sc('e_nova', 2, { hp: [0, 0.33] }), sc('e_drain', 2, { hp: [0, 0.33] }), sc('e_eclipse', 3, { hp: [0, 0.33], every: 2 }),
], { boss: true, hpMul: 13, atkMul: 1.3 });

// ---- Chapter 12: Noon Returns
E('clockmoth', 'Stopped-Clock Moth', 'skirmisher', 'bat', ['#ffe8a0', '#8a6a20'], ['frost'], ['lumen'], [sc('e_flurry', 2), sc('e_beam'), sc('e_delay')]);
E('frozenfolk', 'Frozen Villager', 'tank', 'tall', ['#c0e8ff', '#3a6a8a'], ['ember'], ['frost'], [sc('e_hit', 2), sc('e_brace'), sc('e_ice', 2)]);
E('noonshade', 'Noon Shade', 'caster', 'ghost', ['#fff0c0', '#c08020'], ['umbra'], ['lumen'], [sc('e_beam', 2), sc('e_nova', 2), sc('e_fire')]);
E('stayecho', 'Echo of Stay', 'brute', 'tall', ['#e8d8c0', '#806040'], ['volt'], [], [sc('e_heavy', 2), sc('e_lull'), sc('e_hit', 2)]);
E('stoppedhour', 'The Stopped Hour', 'caster', 'eye', ['#fff8d8', '#d09020'], ['umbra'], ['lumen', 'ember'], [
  sc('e_beam', 2, { hp: [0.5, 1] }), sc('e_nova', 2, { hp: [0.5, 1] }), sc('e_delay', 2, { hp: [0.5, 1] }), sc('e_radiance', 3, { hp: [0.5, 1], every: 4 }),
  sc('e_fire', 2, { hp: [0, 0.5] }), sc('e_firestorm', 2, { hp: [0, 0.5] }), sc('e_drain', 2, { hp: [0, 0.5] }), sc('e_megaflare', 3, { hp: [0, 0.5], every: 3 }),
], { boss: true, hpMul: 13, atkMul: 1.3 });

export const ENCOUNTERS: Record<number, EncounterDef[]> = {
  1: [{ foes: ['mite', 'mite'], w: 3 }, { foes: ['gremlin', 'mite'], w: 3 }, { foes: ['wisp', 'mite'], w: 2 }, { foes: ['beetle'], w: 2 }],
  2: [{ foes: ['bat', 'bat', 'blot'], w: 3 }, { foes: ['stampcrab', 'bat'], w: 3 }, { foes: ['letter', 'letter'], w: 2 }, { foes: ['blot', 'stampcrab'], w: 2 }],
  3: [{ foes: ['puff', 'nap'], w: 3 }, { foes: ['yarn', 'yarn', 'sock'], w: 3 }, { foes: ['nap', 'nap', 'puff'], w: 2 }, { foes: ['sock', 'puff'], w: 2 }],
  4: [{ foes: ['stapler', 'memo'], w: 3 }, { foes: ['memo', 'memo', 'toner'], w: 3 }, { foes: ['filing', 'toner'], w: 2 }, { foes: ['stapler', 'filing'], w: 2 }],
  5: [{ foes: ['turnstile', 'pigeon'], w: 3 }, { foes: ['commuter', 'signal', 'pigeon'], w: 3 }, { foes: ['pigeon', 'pigeon', 'signal'], w: 2 }, { foes: ['turnstile', 'commuter'], w: 2 }],
  6: [{ foes: ['pawn', 'pawn', 'bishop'], w: 3 }, { foes: ['die', 'shark'], w: 3 }, { foes: ['shark', 'bishop', 'pawn'], w: 2 }, { foes: ['die', 'die', 'bishop'], w: 2 }],
  7: [{ foes: ['slagslime', 'cinderbat', 'bellows'], w: 3 }, { foes: ['anvilcrab', 'cinderbat'], w: 3 }, { foes: ['bellows', 'bellows', 'slagslime'], w: 2 }, { foes: ['anvilcrab', 'slagslime', 'cinderbat'], w: 2 }],
  8: [{ foes: ['bookworm', 'footnote', 'silencemoth'], w: 3 }, { foes: ['collector', 'bookworm'], w: 3 }, { foes: ['silencemoth', 'silencemoth', 'footnote'], w: 2 }, { foes: ['collector', 'footnote', 'footnote'], w: 2 }],
  9: [{ foes: ['weedtoad', 'pollen', 'thornstag'], w: 3 }, { foes: ['bonsai', 'pollen'], w: 3 }, { foes: ['thornstag', 'thornstag', 'bonsai'], w: 2 }, { foes: ['weedtoad', 'weedtoad', 'pollen'], w: 2 }],
  10: [{ foes: ['thread', 'needle', 'seamwraith'], w: 3 }, { foes: ['button', 'needle'], w: 3 }, { foes: ['seamwraith', 'seamwraith', 'thread'], w: 2 }, { foes: ['button', 'button', 'seamwraith'], w: 2 }],
  11: [{ foes: ['blankpage', 'redaction', 'asterisk'], w: 3 }, { foes: ['erasure', 'erasure', 'redaction'], w: 3 }, { foes: ['asterisk', 'asterisk', 'blankpage', 'erasure'], w: 2 }, { foes: ['redaction', 'redaction', 'erasure'], w: 2 }],
  12: [{ foes: ['clockmoth', 'noonshade', 'frozenfolk'], w: 3 }, { foes: ['stayecho', 'clockmoth', 'clockmoth'], w: 3 }, { foes: ['frozenfolk', 'frozenfolk', 'noonshade'], w: 2 }, { foes: ['stayecho', 'noonshade', 'noonshade'], w: 2 }],
};

/** Boss fights per chapter, in order. The last entry is the chapter climax. */
export const BOSSES: Record<number, string[][]> = {
  1: [['warden']], 2: [['undelivered']], 3: [['mothercomfort']], 4: [['proctor']], 5: [['tollgate']], 6: [['stay'], ['house']],
  7: [['furnacesaint']], 8: [['overdue']], 9: [['evergreen']], 10: [['hourhound']], 11: [['archivist']], 12: [['stayecho', 'stay', 'stayecho'], ['stoppedhour']],
};

export const FIELDS: Record<string, Field> = {
  none: { id: 'none', name: '', desc: '' },
  static: { id: 'static', name: 'Static Air', boost: 'volt', dampen: 'bloom', desc: 'Volt +30%, Bloom -25%' },
  emberrain: { id: 'emberrain', name: 'Ember Rain', boost: 'ember', dampen: 'frost', desc: 'Ember +30%, Frost -25%' },
  frozen: { id: 'frozen', name: 'Deep Freeze', boost: 'frost', dampen: 'ember', desc: 'Frost +30%, Ember -25%' },
  gloom: { id: 'gloom', name: 'Gloom', boost: 'umbra', dampen: 'lumen', desc: 'Umbra +30%, Lumen -25%' },
  bright: { id: 'bright', name: 'Bright Noon', boost: 'lumen', dampen: 'umbra', desc: 'Lumen +30%, Umbra -25%' },
  overgrown: { id: 'overgrown', name: 'Overgrowth', boost: 'bloom', dampen: 'volt', desc: 'Bloom +30%, Volt -25%' },
  slow: { id: 'slow', name: 'Thick Time', spdMul: 0.85, desc: 'Everyone is 15% slower' },
};

/** Field used by regular encounters per chapter (mechanic unlocks in chapter 7). */
export const CHAPTER_FIELDS: Record<number, string[]> = {
  7: ['emberrain', 'frozen', 'none'], 8: ['gloom', 'slow', 'none'], 9: ['overgrown', 'static', 'none'], 10: ['slow', 'static', 'none'],
  11: ['gloom', 'bright', 'none'], 12: ['bright', 'slow', 'emberrain'],
};
export const BOSS_FIELD: Record<number, string> = { 7: 'emberrain', 8: 'slow', 9: 'overgrown', 10: 'slow', 11: 'gloom', 12: 'bright' };

// ---- stat building
const ROLE: Record<Role, { hp: number; atk: number; mag: number; def: number; res: number; spd: number }> = {
  brute: { hp: 1.25, atk: 1.05, mag: 0.5, def: 1.0, res: 0.7, spd: 0.85 },
  caster: { hp: 0.8, atk: 0.5, mag: 1.05, def: 0.7, res: 1.1, spd: 1.0 },
  skirmisher: { hp: 0.75, atk: 0.95, mag: 0.6, def: 0.75, res: 0.75, spd: 1.3 },
  tank: { hp: 1.6, atk: 0.75, mag: 0.5, def: 1.4, res: 1.0, spd: 0.7 },
  support: { hp: 0.9, atk: 0.55, mag: 0.85, def: 0.9, res: 1.0, spd: 1.0 },
};

export const TUNE = { hp: 1.0, atk: 1.0, xpDiv: 6.8, goldBase: 6, goldPer: 3 };

export function foeStats(def: EnemyDef, lvl: number, chapter = 1): Stats {
  const tn = TUNING[chapter] ?? { hp: 1, atk: 1, bossHp: 1, bossAtk: 1 };
  const r = ROLE[def.role];
  const hpRef = (59 + 23.8 * lvl) * (0.25 + 0.1 * lvl);
  const atkRef = (4.6 + 1.85 * lvl) * Math.min(5, Math.max(1.7, 1.7 + 0.15 * (lvl - 1)));
  const defRef = 5.5 + 1.7 * (lvl - 1);
  const spdRef = 10 + 0.85 * (lvl - 1);
  const hm = (def.hpMul ?? 1) * TUNE.hp * (def.boss ? tn.bossHp : tn.hp);
  const am = (def.atkMul ?? 1) * TUNE.atk * (def.boss ? tn.bossAtk * 2.2 : tn.atk);
  return {
    hp: Math.round(hpRef * r.hp * hm),
    mp: 0,
    atk: atkRef * r.atk * am,
    mag: atkRef * r.mag * am,
    def: defRef * r.def,
    res: defRef * r.res,
    spd: spdRef * r.spd * (def.spdMul ?? 1),
  };
}

export function foeLevel(chapter: number, def: EnemyDef, pos = 0.5): number {
  const a = CHAPTER_LEVEL[chapter];
  const b = chapter < 12 ? CHAPTER_LEVEL[chapter + 1] : a + 4;
  return Math.max(1, Math.round(a + (b - a) * pos + (def.lvlOff ?? 0)));
}

export function foeXp(def: EnemyDef, lvl: number): number {
  const base = Math.max(3, Math.round(XP_NEED(lvl) / TUNE.xpDiv));
  return Math.round(base * (def.boss ? 4 : 1) * (def.role === 'tank' ? 1.15 : 1));
}
export function foeGold(def: EnemyDef, lvl: number): number {
  return Math.round((TUNE.goldBase + TUNE.goldPer * lvl) * (def.boss ? 5 : 1));
}

export function buildFoe(defId: string, lvl: number, chapter = 1): Unit {
  const def = ENEMIES[defId];
  const s = foeStats(def, lvl, chapter);
  const aff: Partial<Record<Elem, number>> = {};
  def.resist.forEach((e) => (aff[e] = 0.5));
  def.weak.forEach((e) => (aff[e] = 1.5));
  return {
    uid: 0, id: def.id, name: def.name, side: 'foe', lvl, maxHp: s.hp, hp: s.hp, maxMp: 0, mp: 0,
    st: { atk: s.atk, mag: s.mag, def: s.def, res: s.res, spd: s.spd }, aff, status: {}, t: 0, row: 0, stance: 'steady', nerve: 0, guard: false,
    skills: [], mods: {}, boss: !!def.boss, defId: def.id, script: def.script, turns: 0, gasp: false, gaspUsed: false, asc: 0, pact: false,
    immune: def.immune ?? [], role: def.role,
  };
}
