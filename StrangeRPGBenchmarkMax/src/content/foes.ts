// Foes and the groups they come in. Numbers stay small so a fight reads at a glance.

export interface FoeDef {
  id: string;
  name: string;
  art: string;
  hp: number;
  pow: number;
  guard: number;
  move: number;
  height: number;
  skills: string[];
  xp: number;
  mites: number;
  ai?: 'wild' | 'smart' | 'boss' | 'simple';
  lantern?: number;
  unled?: boolean;
  boss?: boolean;
  mirage?: boolean;
  shield?: number;
  heliotrope?: boolean;
  slow?: boolean;
  lateRepeat?: boolean;
  darkOnly?: boolean;
  hat?: boolean;
  painter?: number;
  decoys?: number;
  /** Damage dealt to this unit is passed to the unit with this id, doubled (the Heliotrope's roots). */
  rootOf?: string;
  still?: boolean;
  /** Foes that arrive once when this boss falls under half its HP, and the line shown when they do. */
  adds?: string[];
  addsText?: string;
}

const F = (d: FoeDef) => d;

export const FOES: Record<string, FoeDef> = {
  pebbler: F({ id: 'pebbler', name: 'Pebbler', art: 'pebbler', hp: 4, pow: 0, guard: 0, move: 2, height: 1, skills: ['toss'], xp: 4, mites: 2, ai: 'simple' }),
  leadhound: F({ id: 'leadhound', name: 'Shadowhound', art: 'leadhound', hp: 6, pow: 1, guard: 0, move: 3, height: 1, skills: ['pounce'], xp: 6, mites: 2, ai: 'simple' }),
  gnat: F({ id: 'gnat', name: 'Gnats', art: 'gnat', hp: 2, pow: 0, guard: 0, move: 3, height: 0, skills: ['nibble'], xp: 2, mites: 1, ai: 'simple' }),
  shalecrab: F({ id: 'shalecrab', name: 'Shale crab', art: 'shalecrab', hp: 6, pow: 1, guard: 1, move: 2, height: 1, skills: ['pinch'], xp: 7, mites: 3, ai: 'simple' }),
  lanternman: F({ id: 'lanternman', name: 'Lantern man', art: 't_office', hp: 6, pow: 0, guard: 0, move: 2, height: 1, skills: ['bolt'], xp: 8, mites: 4, ai: 'smart', lantern: 2 }),
  grisaille: F({ id: 'grisaille', name: 'Grisaille', art: 'grisaille', hp: 16, pow: 2, guard: 0, move: 2, height: 1, skills: ['rule9', 'citation'], xp: 30, mites: 20, ai: 'boss', lantern: 2, boss: true }),

  hatman: F({ id: 'hatman', name: 'Hat man', art: 't_long_hat', hp: 10, pow: 3, guard: 0, move: 3, height: 1, skills: ['pounce', 'snatch'], xp: 9, mites: 6, ai: 'smart', hat: true }),
  inkmite: F({ id: 'inkmite', name: 'Ink mite', art: 'inkmite', hp: 6, pow: 2, guard: 0, move: 2, height: 1, skills: ['daub'], xp: 7, mites: 3, ai: 'wild', painter: 1 }),
  cutpurse: F({ id: 'cutpurse', name: 'Cutpurse', art: 't_long_adult', hp: 9, pow: 2, guard: 0, move: 3, height: 1, skills: ['pounce', 'snatch'], xp: 8, mites: 8, ai: 'smart' }),
  lampthief: F({ id: 'lampthief', name: 'Lamp thief', art: 't_long_hat', hp: 9, pow: 2, guard: 0, move: 3, height: 1, skills: ['douse', 'bite'], xp: 9, mites: 6, ai: 'smart' }),
  painter: F({ id: 'painter', name: 'The Painter', art: 'painter', hp: 26, pow: 4, guard: 1, move: 2, height: 1, skills: ['brushstroke', 'splatter'], xp: 45, mites: 40, ai: 'boss', painter: 2, boss: true, adds: ['inkmite', 'inkmite'], addsText: 'Two mites crawl off the wet wall.' }),

  glareback: F({ id: 'glareback', name: 'Glareback', art: 'glareback', hp: 12, pow: 4, guard: 1, move: 2, height: 1, skills: ['glare'], xp: 12, mites: 6, ai: 'wild' }),
  suntick: F({ id: 'suntick', name: 'Sun tick', art: 'suntick', hp: 5, pow: 3, guard: 0, move: 3, height: 0, skills: ['bite'], xp: 5, mites: 2, ai: 'wild' }),
  linesman: F({ id: 'linesman', name: 'Linesman', art: 't_office', hp: 12, pow: 4, guard: 1, move: 2, height: 1, skills: ['bolt'], xp: 12, mites: 10, ai: 'smart', shield: 1 }),
  heatwisp: F({ id: 'heatwisp', name: 'Heat wisp', art: 'heatwisp', hp: 9, pow: 5, guard: 0, move: 2, height: 1, skills: ['scorch'], xp: 10, mites: 4, ai: 'wild' }),
  tallman: F({ id: 'tallman', name: 'The Tall Man', art: 'tallman', hp: 50, pow: 4, guard: 1, move: 2, height: 2, skills: ['stride'], xp: 60, mites: 60, ai: 'boss', boss: true }),
  heliotrope: F({ id: 'heliotrope', name: 'Heliotrope', art: 'heliotrope', hp: 42, pow: 5, guard: 1, move: 0, height: 2, skills: ['glare_beam', 'seed'], xp: 70, mites: 50, ai: 'boss', heliotrope: true, boss: true, still: true }),
  heliroot: F({ id: 'heliroot', name: 'Root', art: 'heliroot', hp: 10, pow: 0, guard: 0, move: 0, height: 0, skills: [], xp: 0, mites: 0, rootOf: 'heliotrope', still: true }),

  miragecat: F({ id: 'miragecat', name: 'Mirage cat', art: 'miragecat', hp: 14, pow: 6, guard: 0, move: 3, height: 1, skills: ['pounce'], xp: 14, mites: 6, ai: 'smart', mirage: true }),
  silverfish: F({ id: 'silverfish', name: 'Silverfish', art: 'silverfish', hp: 10, pow: 6, guard: 0, move: 2, height: 1, skills: ['shard'], xp: 13, mites: 5, ai: 'wild', lateRepeat: true }),
  panehound: F({ id: 'panehound', name: 'Pane hound', art: 'panehound', hp: 16, pow: 6, guard: 0, move: 3, height: 1, skills: ['pounce', 'bite'], xp: 15, mites: 6, ai: 'smart' }),
  fusehulk: F({ id: 'fusehulk', name: 'Fuse hulk', art: 'fusehulk', hp: 22, pow: 4, guard: 2, move: 1, height: 2, skills: ['panelash'], xp: 18, mites: 8, ai: 'wild', slow: true }),
  warden: F({ id: 'warden', name: 'Warden of Panes', art: 'warden', hp: 40, pow: 5, guard: 1, move: 2, height: 2, skills: ['panelash', 'shard'], xp: 90, mites: 70, ai: 'boss', boss: true, decoys: 2 }),

  gambler: F({ id: 'gambler', name: 'Gambler', art: 't_overhead', hp: 14, pow: 5, guard: 0, move: 3, height: 1, skills: ['dice'], xp: 15, mites: 14, ai: 'wild' }),
  noonbird: F({ id: 'noonbird', name: 'Noon bird', art: 'noonbird', hp: 12, pow: 5, guard: 0, move: 3, height: 0, skills: ['dive'], xp: 14, mites: 5, ai: 'wild' }),
  bearer: F({ id: 'bearer', name: 'Bearer', art: 't_office', hp: 18, pow: 5, guard: 1, move: 2, height: 1, skills: ['bolt'], xp: 18, mites: 12, ai: 'smart', lantern: 3 }),
  keeper: F({ id: 'keeper', name: 'Keeper of the First Mirror', art: 'keeper', hp: 40, pow: 5, guard: 1, move: 2, height: 1, skills: ['first_light', 'dive', 'put_out'], xp: 110, mites: 80, ai: 'boss', boss: true, adds: ['noonbird', 'noonbird'], addsText: 'Birds drop out of the glare.' }),

  feeler: F({ id: 'feeler', name: 'Feeler', art: 'feeler', hp: 18, pow: 4, guard: 0, move: 2, height: 1, skills: ['grab'], xp: 18, mites: 6, ai: 'smart' }),
  lightdrinker: F({ id: 'lightdrinker', name: 'Light drinker', art: 'lightdrinker', hp: 14, pow: 3, guard: 0, move: 2, height: 1, skills: ['sip', 'bite'], xp: 16, mites: 6, ai: 'smart' }),
  crawler: F({ id: 'crawler', name: 'Dark crawler', art: 'crawler', hp: 14, pow: 4, guard: 0, move: 3, height: 1, skills: ['bite'], xp: 16, mites: 5, ai: 'wild', darkOnly: true }),
  oldstray: F({ id: 'oldstray', name: 'The Old Stray', art: 'oldstray', hp: 70, pow: 3, guard: 1, move: 2, height: 2, skills: ['steal_lead', 'lunge'], xp: 120, mites: 0, ai: 'boss', boss: true }),
  lampeater: F({ id: 'lampeater', name: 'Lampeater', art: 'lampeater', hp: 64, pow: 4, guard: 1, move: 2, height: 2, skills: ['chomp', 'lunge'], xp: 150, mites: 0, ai: 'boss', boss: true }),

  bearer7: F({ id: 'bearer7', name: 'Bearer', art: 't_office', hp: 28, pow: 7, guard: 1, move: 2, height: 1, skills: ['bolt', 'citation'], xp: 22, mites: 14, ai: 'smart', lantern: 3 }),
  paintedlead: F({ id: 'paintedlead', name: 'Painted shadow', art: 'paintedlead', hp: 20, pow: 7, guard: 0, move: 3, height: 1, skills: ['smear', 'brushstroke'], xp: 18, mites: 4, ai: 'wild' }),
  greatlamp: F({ id: 'greatlamp', name: 'The Great Lamp', art: 'greatlamp', hp: 54, pow: 7, guard: 2, move: 0, height: 3, skills: ['flare_beam'], xp: 300, mites: 0, ai: 'boss', boss: true, still: true, adds: ['paintedlead', 'paintedlead'], addsText: 'More shadows peel off the walls.' }),
};

export interface GroupDef {
  foes: string[];
  /** Arena light override. */
  light?: 'dark' | 'beam';
  boss?: boolean;
  noFlee?: boolean;
}

export const GROUPS: Record<string, GroupDef> = {
  g_tut: { foes: ['pebbler'] },
  g_pebblers: { foes: ['pebbler', 'pebbler', 'pebbler'] },
  g_hound: { foes: ['leadhound', 'pebbler'] },
  g_hound_peb: { foes: ['leadhound', 'pebbler', 'pebbler'] },
  g_gnats: { foes: ['gnat', 'gnat', 'gnat', 'pebbler'] },
  g_crab: { foes: ['shalecrab', 'leadhound'] },
  g_crabs: { foes: ['shalecrab', 'shalecrab', 'pebbler'] },
  ch1_boss: { foes: ['grisaille', 'lanternman', 'lanternman'], boss: true, noFlee: true },

  g_road_hounds: { foes: ['leadhound', 'leadhound', 'leadhound'] },
  g_road_mix: { foes: ['leadhound', 'shalecrab', 'gnat', 'gnat'] },
  g_cutpurses: { foes: ['cutpurse', 'cutpurse', 'cutpurse'] },
  g_hatmen: { foes: ['hatman', 'hatman', 'cutpurse'] },
  g_inkmites: { foes: ['inkmite', 'inkmite', 'cutpurse', 'cutpurse'] },
  g_lampthief: { foes: ['lampthief', 'hatman', 'inkmite'] },
  ch2_boss: { foes: ['painter', 'inkmite', 'inkmite'], boss: true, noFlee: true },

  g_ticks: { foes: ['suntick', 'suntick', 'suntick', 'glareback'] },
  g_glarebacks: { foes: ['glareback', 'glareback', 'suntick'] },
  g_wisps: { foes: ['heatwisp', 'heatwisp', 'suntick', 'suntick'] },
  g_linesmen: { foes: ['linesman', 'linesman', 'heatwisp'] },
  g_tower_mix: { foes: ['linesman', 'glareback', 'heatwisp', 'suntick'] },
  g_tallman: { foes: ['tallman'], boss: true },
  ch3_boss: { foes: ['heliotrope', 'heliroot', 'heliroot', 'glareback', 'heatwisp', 'suntick', 'suntick'], boss: true, noFlee: true },

  g_cats: { foes: ['miragecat', 'miragecat', 'silverfish', 'panehound'] },
  g_fish: { foes: ['silverfish', 'silverfish', 'miragecat', 'silverfish'] },
  g_hounds_glass: { foes: ['panehound', 'panehound', 'silverfish', 'miragecat'] },
  g_hulk: { foes: ['fusehulk', 'panehound', 'silverfish', 'miragecat'] },
  ch4_boss: { foes: ['warden', 'silverfish', 'panehound'], boss: true, noFlee: true },

  g_gamblers: { foes: ['gambler', 'gambler', 'noonbird'] },
  g_birds: { foes: ['noonbird', 'noonbird', 'gambler'] },
  g_bearers: { foes: ['bearer', 'gambler', 'noonbird'] },
  ch5_boss: { foes: ['keeper', 'noonbird', 'gambler'], boss: true, noFlee: true },

  g_feelers: { foes: ['feeler', 'crawler', 'crawler'], light: 'dark' },
  g_drinkers: { foes: ['lightdrinker', 'crawler', 'crawler', 'feeler'], light: 'dark' },
  g_dark_mix: { foes: ['feeler', 'lightdrinker', 'crawler'], light: 'dark' },
  g_oldstray: { foes: ['oldstray'], light: 'dark', boss: true },
  ch6_boss: { foes: ['lampeater', 'crawler'], light: 'dark', boss: true, noFlee: true },

  g_bearers7: { foes: ['bearer7', 'paintedlead', 'bearer7', 'paintedlead', 'paintedlead'] },
  g_painted: { foes: ['paintedlead', 'paintedlead', 'bearer7', 'paintedlead', 'bearer7'] },
  ch7_boss: { foes: ['greatlamp', 'bearer7', 'paintedlead', 'bearer7'], light: 'beam', boss: true, noFlee: true },
};
