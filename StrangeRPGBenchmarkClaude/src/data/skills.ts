import type { Hue } from '../core/palette';

export type Target = 'foe' | 'foes' | 'ally' | 'allies' | 'self' | 'ko' | 'rand';
export type Kind = 'phys' | 'mag' | 'heal' | 'buff' | 'debuff' | 'util';
export type Stat = 'str' | 'def' | 'mnd' | 'spd';

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
  kind: Kind;
  target: Target;
  /** 'wpn' uses the user's weapon or primed hue. 'loaded' uses the user's loaded brush hue. */
  hue?: Hue | 'wpn' | 'loaded' | 'best' | 'invert';
  power?: number;
  hits?: number;
  ink?: number;
  gold?: number;
  tails?: number;
  breakDmg?: number;
  status?: { id: string; chance: number; turns: number; v?: number };
  stage?: { stat: Stat; d: number };
  /** Action time weight. 100 is a normal action. */
  delay?: number;
  push?: number;
  fx?: string;
  /** Can be used from the field menu. */
  field?: boolean;
  /** Mechanic flag required before the skill appears. */
  mech?: string;
}

const S: SkillDef[] = [
  // Basic actions
  { id: 'attack', name: 'Attack', desc: 'A plain strike with your weapon.', kind: 'phys', target: 'foe', hue: 'wpn', power: 1 },

  // Wick
  { id: 'kindle', name: 'Kindle', desc: 'Amber flame on one foe.', kind: 'mag', target: 'foe', hue: 'Y', power: 1.5, ink: 3 },
  { id: 'lampsweep', name: 'Lampsweep', desc: 'Swing the lamp pole through every foe.', kind: 'phys', target: 'foes', hue: 'wpn', power: 0.7, ink: 4 },
  { id: 'wickflare', name: 'Wickflare', desc: 'Amber flame on every foe.', kind: 'mag', target: 'foes', hue: 'Y', power: 1.0, ink: 7 },
  { id: 'snuff', name: 'Snuff', desc: 'A heavy blow that cracks shells and may stun.', kind: 'phys', target: 'foe', hue: 'wpn', power: 1.5, ink: 5, breakDmg: 1, status: { id: 'stun', chance: 0.3, turns: 1 } },
  { id: 'beacon', name: 'Beacon', desc: 'Raise every ally\'s strength and mind.', kind: 'buff', target: 'allies', ink: 8, stage: { stat: 'str', d: 1 }, fx: 'beacon' },
  { id: 'lighthouse', name: 'Lighthouse', desc: 'A beam of amber on one foe.', kind: 'mag', target: 'foe', hue: 'Y', power: 2.6, ink: 11 },
  { id: 'ninth_ink', name: 'Ninth Ink', desc: 'Take a third hue for this battle. Your amber skills use it too.', kind: 'util', target: 'self', ink: 4, delay: 40, fx: 'tricolor', mech: 'tricolor' },
  { id: 'trichrome', name: 'Trichrome', desc: 'Strike one foe with whichever of your hues hurts most.', kind: 'mag', target: 'foe', hue: 'best', power: 2.8, ink: 12, breakDmg: 1, mech: 'tricolor' },

  // Nona
  { id: 'patch', name: 'Patch', desc: 'Mend one ally.', kind: 'heal', target: 'ally', power: 1.4, ink: 3, field: true },
  { id: 'diagnose', name: 'Diagnose', desc: 'Read a foe and lower its defense.', kind: 'debuff', target: 'foe', ink: 2, delay: 60, stage: { stat: 'def', d: -1 }, fx: 'scan' },
  { id: 'ninth_life', name: 'Ninth Life', desc: 'Spend a tail to revive a fallen ally.', kind: 'heal', target: 'ko', ink: 4, tails: 1, fx: 'revive', power: 0.5, field: true },
  { id: 'purr_loop', name: 'Purr Loop', desc: 'Every ally regenerates for three turns.', kind: 'buff', target: 'allies', ink: 6, status: { id: 'regen', chance: 1, turns: 3 } },
  { id: 'static_claw', name: 'Static Claw', desc: 'Cyan claws that may leave static.', kind: 'phys', target: 'foe', hue: 'C', power: 1.3, ink: 3, status: { id: 'static', chance: 0.4, turns: 3 } },
  { id: 'firmware', name: 'Firmware', desc: 'Mend every ally.', kind: 'heal', target: 'allies', power: 0.9, ink: 9, field: true },
  { id: 'cleanse', name: 'Cleanse', desc: 'Clear an ally\'s ailments and mend a little.', kind: 'heal', target: 'ally', power: 0.6, ink: 3, fx: 'cleanse', field: true },
  { id: 'overclock', name: 'Overclock', desc: 'Raise one ally\'s speed sharply.', kind: 'buff', target: 'ally', ink: 5, stage: { stat: 'spd', d: 2 } },

  // Tint
  { id: 'load', name: 'Load Brush', desc: 'Choose the hue on your brush. Quick.', kind: 'util', target: 'self', delay: 35, fx: 'load' },
  { id: 'daub', name: 'Daub', desc: 'Paint one foe with your loaded hue.', kind: 'mag', target: 'foe', hue: 'loaded', power: 1.45, ink: 3 },
  { id: 'splash', name: 'Splash', desc: 'Repaint a foe\'s first hue to your loaded hue.', kind: 'debuff', target: 'foe', ink: 3, delay: 70, fx: 'paint' },
  { id: 'primer', name: 'Primer', desc: 'Coat an ally\'s weapon in your loaded hue.', kind: 'buff', target: 'ally', ink: 4, delay: 70, fx: 'prime' },
  { id: 'wash', name: 'Wash', desc: 'Strip a foe\'s buffs and paint.', kind: 'debuff', target: 'foe', ink: 3, fx: 'wash' },
  { id: 'gallery', name: 'Gallery', desc: 'Paint every foe with your loaded hue.', kind: 'mag', target: 'foes', hue: 'loaded', power: 1.0, ink: 8 },
  { id: 'spectrum', name: 'Spectrum', desc: 'Six strokes of random hues at random foes.', kind: 'mag', target: 'rand', hue: 'loaded', power: 0.5, hits: 6, ink: 10, fx: 'spectrum' },

  // Brask
  { id: 'crush', name: 'Crush', desc: 'A blow that cracks two shell points.', kind: 'phys', target: 'foe', hue: 'wpn', power: 1.2, ink: 3, breakDmg: 2 },
  { id: 'moth_curtain', name: 'Moth Curtain', desc: 'Draw every foe\'s attacks and raise defense.', kind: 'buff', target: 'self', ink: 4, status: { id: 'taunt', chance: 1, turns: 3 }, stage: { stat: 'def', d: 1 } },
  { id: 'swarm', name: 'Swarm', desc: 'Amber moths strike three random foes.', kind: 'phys', target: 'rand', hue: 'Y', power: 0.55, hits: 3, ink: 4 },
  { id: 'carapace', name: 'Carapace', desc: 'Raise every ally\'s defense.', kind: 'buff', target: 'allies', ink: 6, stage: { stat: 'def', d: 1 } },
  { id: 'lance', name: 'Blue Lance', desc: 'A blue thrust through one foe.', kind: 'phys', target: 'foe', hue: 'B', power: 1.8, ink: 5, breakDmg: 1 },
  { id: 'molt', name: 'Molt', desc: 'Shed damage. Mend yourself and clear ailments.', kind: 'heal', target: 'self', power: 2.2, ink: 5, fx: 'cleanse' },

  // Tock
  { id: 'tick', name: 'Tick', desc: 'A quick jab. You act again sooner.', kind: 'phys', target: 'foe', hue: 'wpn', power: 0.85, delay: 55 },
  { id: 'delay', name: 'Delay', desc: 'Green hands push a foe later in the timeline.', kind: 'mag', target: 'foe', hue: 'G', power: 0.8, ink: 4, push: 60 },
  { id: 'hasten', name: 'Hasten', desc: 'An ally acts next.', kind: 'buff', target: 'ally', ink: 5, delay: 60, fx: 'hasten' },
  { id: 'rewind', name: 'Rewind', desc: 'Return an ally to the health they had at their last turn.', kind: 'heal', target: 'ally', ink: 5, fx: 'rewind', power: 0.4 },
  { id: 'stopwatch', name: 'Stopwatch', desc: 'Push every foe later in the timeline.', kind: 'debuff', target: 'foes', ink: 9, push: 40 },
  { id: 'paradox', name: 'Paradox', desc: 'Red time-burn on one foe. You act much later.', kind: 'mag', target: 'foe', hue: 'R', power: 2.4, ink: 6, delay: 170 },

  // VEND
  { id: 'coin_shot', name: 'Coin Shot', desc: 'Fire coins at one foe. Costs gold.', kind: 'phys', target: 'foe', hue: 'wpn', power: 2.0, gold: 1 },
  { id: 'dispense', name: 'Dispense', desc: 'Vend a tonic to one ally. Costs gold.', kind: 'heal', target: 'ally', power: 1.5, gold: 1 },
  { id: 'jackpot', name: 'Jackpot', desc: 'Spin three reels. Matching hues pay out damage.', kind: 'phys', target: 'foes', power: 1, gold: 2, fx: 'jackpot' },
  { id: 'buyout', name: 'Buyout', desc: 'Pay a foe to leave. You keep its reward.', kind: 'util', target: 'foe', gold: 4, fx: 'buyout' },
  { id: 'restock', name: 'Restock', desc: 'Refill every ally\'s ink a little. Costs gold.', kind: 'heal', target: 'allies', gold: 3, fx: 'restock' },
  { id: 'tariff', name: 'Tariff', desc: 'Coins rain on every foe. Costs gold.', kind: 'phys', target: 'foes', hue: 'wpn', power: 1.1, gold: 2 },

  // Mirrow
  { id: 'reflect', name: 'Reflect', desc: 'Repeat the last action anyone took, as your own.', kind: 'util', target: 'self', ink: 5, fx: 'reflect' },
  { id: 'glass_guard', name: 'Glass Guard', desc: 'The next spell that hits this ally bounces back at its caster. Lasts four turns.', kind: 'buff', target: 'ally', ink: 4, delay: 70, status: { id: 'mirror', chance: 1, turns: 4 } },
  { id: 'shard', name: 'Shard', desc: 'Blue glass on one foe.', kind: 'mag', target: 'foe', hue: 'B', power: 1.4, ink: 3 },
  { id: 'invert', name: 'Invert', desc: 'Hit every foe with the opposite of its own first hue.', kind: 'mag', target: 'foes', hue: 'invert', power: 1.0, ink: 10 },
  { id: 'silver_back', name: 'Silverback', desc: 'Show a foe itself. It may stop to stare.', kind: 'debuff', target: 'foe', ink: 3, status: { id: 'stun', chance: 0.6, turns: 1 } },

  // Nil
  { id: 'blank_stare', name: 'Blank Stare', desc: 'Grey a foe. Its hues stop mattering.', kind: 'debuff', target: 'foe', ink: 3, status: { id: 'grey', chance: 1, turns: 3 } },
  { id: 'void_touch', name: 'Void Touch', desc: 'Colorless force on one foe.', kind: 'mag', target: 'foe', power: 1.6, ink: 4 },
  { id: 'nullify', name: 'Nullify', desc: 'Undo a foe\'s buffs.', kind: 'debuff', target: 'foe', ink: 2, fx: 'wash' },
  { id: 'unprint', name: 'Unprint', desc: 'Grey every foe for two turns.', kind: 'debuff', target: 'foes', ink: 8, status: { id: 'grey', chance: 1, turns: 2 } },

  // Items and link
  { id: 'link', name: 'Link', desc: 'Two allies strike every foe together.', kind: 'phys', target: 'foes', power: 1.0, fx: 'link', mech: 'link' },

  // Enemy skills
  { id: 'bite', name: 'Bite', desc: '', kind: 'phys', target: 'foe', power: 1.0 },
  { id: 'claw', name: 'Claw', desc: '', kind: 'phys', target: 'foe', power: 1.15 },
  { id: 'tackle', name: 'Tackle', desc: '', kind: 'phys', target: 'foe', power: 1.3, delay: 120 },
  { id: 'lint_howl', name: 'Lint Howl', desc: '', kind: 'debuff', target: 'foes', stage: { stat: 'def', d: -1 } },
  { id: 'dust', name: 'Dust', desc: '', kind: 'debuff', target: 'foe', stage: { stat: 'str', d: -1 }, power: 0.5 },
  { id: 'zap', name: 'Zap', desc: '', kind: 'mag', target: 'foe', power: 0.9, status: { id: 'static', chance: 0.5, turns: 3 } },
  { id: 'drain', name: 'Drain Color', desc: '', kind: 'mag', target: 'foe', power: 1.0, fx: 'drain' },
  { id: 'pinch', name: 'Pinch', desc: '', kind: 'phys', target: 'foe', power: 0.8, hits: 2 },
  { id: 'harden', name: 'Harden', desc: '', kind: 'buff', target: 'self', stage: { stat: 'def', d: 1 } },
  { id: 'gather_dust', name: 'Gather Dust', desc: '', kind: 'util', target: 'self', fx: 'charge:dust_storm' },
  { id: 'dust_storm', name: 'Dust Storm', desc: '', kind: 'mag', target: 'foes', power: 1.6 },
  { id: 'wing_buffet', name: 'Wing Buffet', desc: '', kind: 'phys', target: 'foes', power: 0.75 },
  { id: 'moth_kiss', name: 'Grey Kiss', desc: '', kind: 'mag', target: 'foe', power: 1.0, status: { id: 'grey', chance: 1, turns: 2 } },

  { id: 'croak', name: 'Croak', desc: '', kind: 'mag', target: 'foes', hue: 'G', power: 0.6, status: { id: 'static', chance: 0.25, turns: 3 } },
  { id: 'crayon_jab', name: 'Crayon Jab', desc: '', kind: 'phys', target: 'foe', hue: 'R', power: 1.1 },
  { id: 'peck', name: 'Peck', desc: '', kind: 'phys', target: 'foe', hue: 'C', power: 1.1 },
  { id: 'broadcast', name: 'Broadcast', desc: '', kind: 'mag', target: 'foes', hue: 'C', power: 0.7 },
  { id: 'glitch', name: 'Glitch', desc: '', kind: 'mag', target: 'foe', hue: 'M', power: 1.15 },
  { id: 'ooze', name: 'Ooze', desc: '', kind: 'mag', target: 'foe', hue: 'B', power: 1.05, stage: { stat: 'spd', d: -1 } },
  { id: 'wisp_fire', name: 'Wispfire', desc: '', kind: 'mag', target: 'foe', hue: 'M', power: 1.2 },
  { id: 'ink_squirt', name: 'Ink Squirt', desc: '', kind: 'mag', target: 'foes', hue: 'loaded', power: 0.85 },
  { id: 'recolor_self', name: 'Shift Hue', desc: '', kind: 'util', target: 'self', fx: 'shift_hue', delay: 60 },
  { id: 'tentacle', name: 'Tentacle', desc: '', kind: 'phys', target: 'foe', hue: 'loaded', power: 1.25 },
  { id: 'steal_hue', name: 'Steal Hue', desc: '', kind: 'mag', target: 'foe', power: 0.9, status: { id: 'grey', chance: 1, turns: 2 } },

  { id: 'toll', name: 'Toll', desc: '', kind: 'mag', target: 'foes', hue: 'Y', power: 0.7, status: { id: 'stun', chance: 0.15, turns: 1 } },
  { id: 'hymn', name: 'Grey Hymn', desc: '', kind: 'mag', target: 'foes', power: 0.6, status: { id: 'grey', chance: 0.5, turns: 2 } },
  { id: 'hush', name: 'Hush', desc: '', kind: 'debuff', target: 'foe', status: { id: 'hush', chance: 1, turns: 2 } },
  { id: 'censer', name: 'Censer Smoke', desc: '', kind: 'mag', target: 'foes', hue: 'C', power: 0.65 },
  { id: 'page_cut', name: 'Page Cut', desc: '', kind: 'phys', target: 'foe', hue: 'R', power: 1.2 },
  { id: 'rib_slam', name: 'Rib Slam', desc: '', kind: 'phys', target: 'foe', hue: 'R', power: 1.4, delay: 130 },
  { id: 'pew_bite', name: 'Pew Bite', desc: '', kind: 'phys', target: 'foe', hue: 'G', power: 1.1 },
  { id: 'mend_choir', name: 'Choir Mend', desc: '', kind: 'heal', target: 'allies', power: 0.7 },
  { id: 'call_choir', name: 'Call Choir', desc: '', kind: 'util', target: 'self', fx: 'summon:choirboy' },
  { id: 'crescendo', name: 'Crescendo', desc: '', kind: 'util', target: 'self', fx: 'charge:fortissimo' },
  { id: 'fortissimo', name: 'Fortissimo', desc: '', kind: 'mag', target: 'foes', hue: 'B', power: 1.7 },

  { id: 'sting', name: 'Sting', desc: '', kind: 'phys', target: 'foe', hue: 'Y', power: 1.1, status: { id: 'static', chance: 0.3, turns: 3 } },
  { id: 'lay_egg', name: 'Lay Egg', desc: '', kind: 'util', target: 'self', fx: 'summon:hen_chick' },
  { id: 'hen_peck', name: 'Peck Twice', desc: '', kind: 'phys', target: 'foe', hue: 'R', power: 0.7, hits: 2 },
  { id: 'chime', name: 'Chime', desc: '', kind: 'mag', target: 'foe', hue: 'G', power: 1.2, push: 25 },
  { id: 'rush', name: 'Minute Rush', desc: '', kind: 'phys', target: 'foe', hue: 'M', power: 0.6, delay: 45 },
  { id: 'sand_slam', name: 'Sand Slam', desc: '', kind: 'phys', target: 'foe', hue: 'Y', power: 1.35 },
  { id: 'glass_skin', name: 'Glass Skin', desc: '', kind: 'buff', target: 'self', stage: { stat: 'def', d: 2 } },
  { id: 'devour_hour', name: 'Devour Hour', desc: '', kind: 'mag', target: 'foe', hue: 'M', power: 1.3, push: 40 },
  { id: 'loop_back', name: 'Loop Back', desc: '', kind: 'heal', target: 'self', fx: 'selfrewind' },
  { id: 'coil', name: 'Coil', desc: '', kind: 'util', target: 'self', fx: 'charge:epoch' },
  { id: 'epoch', name: 'Epoch', desc: '', kind: 'mag', target: 'foes', hue: 'G', power: 1.1 },

  { id: 'pilfer', name: 'Pilfer', desc: '', kind: 'phys', target: 'foe', hue: 'Y', power: 0.8, fx: 'steal_gold' },
  { id: 'repossess', name: 'Repossess', desc: '', kind: 'phys', target: 'foe', hue: 'R', power: 1.2, stage: { stat: 'str', d: -1 } },
  { id: 'haggle', name: 'Haggle', desc: '', kind: 'debuff', target: 'foes', stage: { stat: 'def', d: -1 } },
  { id: 'gnaw', name: 'Gnaw', desc: '', kind: 'phys', target: 'foe', hue: 'C', power: 1.15 },
  { id: 'price_hike', name: 'Price Hike', desc: '', kind: 'buff', target: 'self', stage: { stat: 'str', d: 1 } },
  { id: 'bribe', name: 'Bribe', desc: '', kind: 'util', target: 'self', fx: 'bribe' },
  { id: 'hire', name: 'Hire Muscle', desc: '', kind: 'util', target: 'self', fx: 'summon:hired_goon' },
  { id: 'gold_rain', name: 'Gold Rain', desc: '', kind: 'phys', target: 'foes', hue: 'Y', power: 1.0 },
  { id: 'audit', name: 'Audit', desc: '', kind: 'util', target: 'self', fx: 'charge:foreclose' },
  { id: 'foreclose', name: 'Foreclose', desc: '', kind: 'mag', target: 'foes', hue: 'M', power: 1.65 },

  { id: 'gust', name: 'Gust', desc: '', kind: 'mag', target: 'foes', hue: 'B', power: 0.7, push: 15 },
  { id: 'bolt', name: 'Bolt', desc: '', kind: 'mag', target: 'foe', hue: 'Y', power: 1.3 },
  { id: 'whale_song', name: 'Whale Song', desc: '', kind: 'heal', target: 'allies', power: 0.8 },
  { id: 'body_slam', name: 'Body Slam', desc: '', kind: 'phys', target: 'foe', power: 1.5, delay: 130 },
  { id: 'constrict', name: 'Constrict', desc: '', kind: 'phys', target: 'foe', hue: 'G', power: 1.1, stage: { stat: 'spd', d: -1 } },
  { id: 'cutlass', name: 'Cutlass', desc: '', kind: 'phys', target: 'foe', hue: 'R', power: 1.2 },
  { id: 'jelly_sting', name: 'Jelly Sting', desc: '', kind: 'mag', target: 'foe', hue: 'C', power: 1.1, status: { id: 'stun', chance: 0.2, turns: 1 } },
  { id: 'halo_ray', name: 'Halo Ray', desc: '', kind: 'mag', target: 'foe', hue: 'Y', power: 1.3 },
  { id: 'target_lock', name: 'Target Lock', desc: '', kind: 'util', target: 'self', fx: 'charge:judgement' },
  { id: 'judgement', name: 'Judgement Beam', desc: '', kind: 'mag', target: 'foe', hue: 'Y', power: 3.0 },
  { id: 'wing_blades', name: 'Wing Blades', desc: '', kind: 'phys', target: 'foes', power: 0.85 },

  { id: 'spin_web', name: 'Spin Web', desc: '', kind: 'debuff', target: 'foe', stage: { stat: 'spd', d: -2 } },
  { id: 'unprint_ray', name: 'Unprint Ray', desc: '', kind: 'mag', target: 'foe', power: 1.2, status: { id: 'grey', chance: 1, turns: 3 } },
  { id: 'thread_lash', name: 'Thread Lash', desc: '', kind: 'phys', target: 'foe', hue: 'C', power: 1.25 },
  { id: 'warden_cleave', name: 'Cleave', desc: '', kind: 'phys', target: 'foes', hue: 'B', power: 0.9 },
  { id: 'erase', name: 'Erase', desc: '', kind: 'mag', target: 'foe', power: 1.5 },
  { id: 'wind_up', name: 'Wind Up', desc: '', kind: 'util', target: 'self', fx: 'charge:spindle_crash' },
  { id: 'spindle_crash', name: 'Spindle Crash', desc: '', kind: 'phys', target: 'foes', power: 1.7 },
  { id: 'compress', name: 'Compress', desc: '', kind: 'mag', target: 'foes', power: 1.2, status: { id: 'grey', chance: 0.6, turns: 2 } },
  { id: 'sermon', name: 'Sermon of Grey', desc: '', kind: 'util', target: 'self', fx: 'charge:quantize' },
  { id: 'quantize', name: 'Quantize', desc: '', kind: 'mag', target: 'foes', power: 2.1 },
  { id: 'benediction', name: 'Benediction', desc: '', kind: 'heal', target: 'self', power: 1.6 },
  { id: 'palette_swap', name: 'Palette Swap', desc: '', kind: 'util', target: 'self', fx: 'shift_hue', delay: 60 },
  { id: 'fleece', name: 'Fleece', desc: '', kind: 'debuff', target: 'foe', stage: { stat: 'mnd', d: -1 }, power: 0.6 },
  { id: 'eraser_edge', name: 'Eraser Edge', desc: '', kind: 'phys', target: 'foe', power: 1.35, breakDmg: 0 },
  { id: 'wraith_wail', name: 'Wail', desc: '', kind: 'mag', target: 'foes', hue: 'loaded', power: 0.8 },
];

export const SKILLS: Record<string, SkillDef> = Object.fromEntries(S.map(s => [s.id, s]));

export function skill(id: string): SkillDef {
  const s = SKILLS[id];
  if (!s) throw new Error('Unknown skill ' + id);
  return s;
}

/** Telegraph lines shown when a boss starts charging. */
export const TELEGRAPH: Record<string, string> = {
  dust_storm: 'The Grey Moth beats its wings and the air fills with dust. Guard!',
  fortissimo: 'Cantor Hush draws a breath that goes on far too long.',
  epoch: 'The Chronophage coils around a whole hour.',
  foreclose: 'Baron Surplus opens a ledger with your name in it.',
  judgement: 'Seraph K-7 locks its halo on the party.',
  spindle_crash: 'The Spindle winds up, faster and faster.',
  quantize: 'The Grey Bishop begins a sermon about fewer colors.',
};

