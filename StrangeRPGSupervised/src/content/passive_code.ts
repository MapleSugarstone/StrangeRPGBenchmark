// Each species' passive: Qwen's name and words (Notes/qwen/passives.json) and the code that does what they say.
// A comment above a passive's code says how its words were read where the game has no such thing.
import type { Ctx, PassiveCode } from '../battle/hooks.js';
import type { RuinState } from '../battle/engine.js';
import { calculateDamage, pushBack } from '../battle/engine.js';
import { MOVES, MoveKind, AttackKind, type MoveData, type MoveInstance } from '../battle/moves.js';
import { SPECIES } from '../battle/species.js';
import { Type, getTypeMultiplier } from '../battle/types.js';
import { Status, applyStatus } from '../battle/statuses.js';
import { statOf } from '../battle/rules.js';
import { heal, hurt as harm, addStatus, clearStatus, giveBoost, chance, peek, every, once, standing, hasStatus, typeOf, isHarmful } from '../battle/passive_kit.js';

export const PASSIVE_TEXT: Record<string, { name: string; text: string }> = {
  glass_sentinel: { name: "Shatter Guard", text: "On take damage, 30% chance to Expose attacker." },
  rust_crawler: { name: "Oxidize", text: "Every 3rd hit deals +10% damage to Metal types." },
  ash_wisp: { name: "Drift", text: "Starts battle with Haste and Stasis." },
  kiln_imp: { name: "Soot", text: "Burns attacker for 2 HP on every hit taken." },
  stone_golem: { name: "Unmoving", text: "Cannot be Rooted or Stunned." },
  keeper_nyx_scout: { name: "Phantom", text: "First hit taken deals 0 damage." },
  keeper_nyx: { name: "Prism", text: "Resists all types equally by 20%." },
  keeper_bram: { name: "Sap", text: "Heals 5 HP when using a Wood move." },
  keeper_grom: { name: "Quake", text: "Earthquake hits twice." },
  keeper_kyr: { name: "Void", text: "Immune to Silence." },
  keeper_tor: { name: "Magma", text: "Starts battle with Burn." },
  keeper_vex: { name: "Rust", text: "Attacks lower DEF by 1 for 2 turns." },
  keeper_syl: { name: "Seal Keeper", text: "Gains +2 DEF for each Metal move used this battle." },
  keeper_dun: { name: "Void Maw", text: "First hit each battle ignores DEF." },
  keeper_grom_lieutenant: { name: "Stone Heart", text: "Immune to Stun. Gains 1 Boost when hit." },
  ash_spitter: { name: "Ashen Skin", text: "Every 3rd hit deals 1 damage to attacker." },
  dust_mite: { name: "Dust Walker", text: "Starts battle with Haste. Loses it when hit." },
  kiln_mite: { name: "Heat Born", text: "Burns attackers for 1 turn on contact." },
  glass_shard: { name: "Sharp Edge", text: "ATK +1. DEF -1." },
  silica_hag: { name: "Scream Crown", text: "Silences enemies for 1 turn when HP < 50%." },
  slag_vein: { name: "Toxic Melt", text: "Poisons attacker for 2 turns on hit." },
  ash_weaver: { name: "Char Rot", text: "Roots enemies for 1 turn on hit." },
  void_bulb: { name: "Light Eater", text: "Stasis targets for 1 turn on hit." },
  rust_fern: { name: "Brittle Edge", text: "Exposes targets for 1 turn on hit." },
  mire_echo: { name: "False Path", text: "Moves are 100% Stun on first use each battle." },
  silica_husk: { name: "Fracture", text: "Dying deals 50% max HP damage to all enemies." },
  oxide_mite: { name: "Rust Lock", text: "Attacks ignore 50% DEF for 2 turns after hit." },
  glass_wisp: { name: "Shatter Step", text: "First dodge each battle deals 10 damage to attacker." },
  metal_scraper: { name: "Screech", text: "Using a move Stuns attacker if they hit this turn." },
  resonant_shard: { name: "Bone Flute", text: "Ally's moves cost 0 Boost for 1 turn every 3rd." },
  silica_spider: { name: "Fear Weight", text: "Enemies with less HP act last in initiative." },
  magnetic_drifter: { name: "Heart Ring", text: "Heals 5 HP every turn. Takes 2 damage per turn." },
  glass_vine: { name: "Snap Root", text: "Roots last 1 extra turn. Stun if moved." },
  heat_moth: { name: "Cold Burn", text: "Attacks inflict Burn. Burn deals 20% max HP." },
  void_glass: { name: "Dark Lens", text: "RES +5. Ignores RES of enemies with Stasis." },
  clay_strider: { name: "Dry Crack", text: "DEF +3. Loses 1 DEF per turn until battle end." },
  kiln_rat: { name: "Ash Sprint", text: "First turn: +1 AGI, leaves Ash trail." },
  mud_golem: { name: "Squelch", text: "Starts battle Rooted. Heals 1 HP per turn." },
  fire_spitter: { name: "Ember Heart", text: "Burns enemies on hit. 2 turns duration." },
  slag_kneeler: { name: "Heavy Drag", text: "Slows enemies by 1 AGI on hit." },
  wet_echo: { name: "Mimic", text: "Copies last move used by opponent." },
  bone_clay: { name: "Fossil Snap", text: "20% chance to Stun on critical hit." },
  iron_rhizome: { name: "Rust Eater", text: "Heals 1 HP when enemy is Rust." },
  glass_mire: { name: "Storm Trap", text: "Reflects 1 dmg to attacker once per turn." },
  slag_vent: { name: "Weep", text: "Burns adjacent allies. 1 dmg per turn." },
  rock_spitter: { name: "Rock Body", text: "DEF +2 when HP is below 50%." },
  earth_mover: { name: "Earth Body", text: "Gains 1 DEF for every move used." },
  basalt_cyst: { name: "Light Eick", text: "First hit on it misses. Light refuses to touch it." },
  quartz_witch: { name: "Frayed Mind", text: "Every 3rd move stuns the target. Silence breaks it." },
  slag_biter: { name: "Hot Blood", text: "Deals +2 damage to Bleed or Burn targets." },
  vein_walker: { name: "Deep Root", text: "Starts battle with 100% HP if it has no Boost." },
  ember_core: { name: "Burn Out", text: "Burns attacker for 2 damage when hit by Metal." },
  shard_hollow: { name: "Empty Vessel", text: "Steals 1 Boost from target if it has none." },
  schist_flyer: { name: "Wind Rider", text: "Dodges the first move of every battle." },
  wind_wisp: { name: "Wind Form", text: "Cannot be targeted by Guard moves." },
  stone_flyer: { name: "Stone Wings", text: "ATK +2. DEF -2. Heavy but fast." },
  aether_spitter: { name: "Aether Body", text: "Resets cooldowns on Aether moves every turn." },
  schist_crag: { name: "immovable", text: "AGI is always 0. Cannot be moved or pushed." },
  aether_fracture: { name: "refractive", text: "Reflects 50% of damage back to attacker." },
  metal_shriek: { name: "Resonance", text: "Stuns foes on hit if they used a move last turn." },
  void_cleft: { name: "Pre-Shade", text: "First hit each battle ignores DEF." },
  stone_echo: { name: "Fear Echo", text: "Silences foe if they used a move last turn." },
  metal_rust: { name: "Time Dust", text: "Foe loses 1 Boost every 3 turns." },
  basalt_golem: { name: "Solidify", text: "Heals 5 HP when HP drops below 30%." },
  steam_wisp: { name: "Pressure", text: "Burns foe if they are Rooted or Stunned." },
  ember_flyer: { name: "Updraft", text: "AGI +2 if no moves used last turn." },
  forge_spitter: { name: "Slag Coat", text: "Thorns deals 3 damage to attackers." },
  basalt_vent: { name: "Magma Rise", text: "Gains 1 Boost when hit by a Stone move." },
  slag_drifter: { name: "Bellows", text: "Stuns foe if they used a Big move last turn." },
  obsidian_moth: { name: "Cold Ash", text: "Exposes foe for 2 turns on hit." },
  magma_slug: { name: "Boil Root", text: "Poisons foe on hit if they are on grass." },
  quartz_specter: { name: "Cold Eye", text: "First hit each turn ignores DEF." },
  iron_bulb: { name: "Rust Root", text: "On catch, user gains +1 max Boost." },
  oxide_hulk: { name: "Oxide Hulk", text: "Every 3rd attack applies Expose." },
  copper_wisp: { name: "Copper Wisp", text: "Link moves deal +2 damage." },
  iron_spitter: { name: "Iron Spitter", text: "Start battle with 3 Boost." },
  steel_flyer: { name: "Steel Flyer", text: "AGI cannot be reduced below 5." },
  slag_hinge: { name: "Slag Hinge", text: "Kills apply Silence to attacker." },
  vex_mirror: { name: "Vex Mirror", text: "When hit, swap stats with attacker." },
  oxide_tether: { name: "Oxide Tether", text: "Rooted enemies take 2 Burn/turn." },
  slag_echo: { name: "Slag Echo", text: "Stasis Field lasts 1 extra turn." },
  oxide_spire: { name: "Oxide Spire", text: "Attacks apply Burn instead of damage." },
  vex_shard: { name: "Vex Shard", text: "Glass Shatter hits twice." },
  anchor_barnacle: { name: "Iron Shell", text: "Starts battle with +1 DEF. If Stunned, takes double damage." },
  salt_spitter: { name: "Saline", text: "Attacks apply Bleed. If target has Bleed, they cannot use Guard." },
  hull_moth: { name: "Silent", text: "Cannot be targeted by enemy moves. Taking damage breaks this effect." },
  kelp_knuckle: { name: "Heavy", text: "ATK is 50% higher. AGI is 50% lower. Cannot be Hasted." },
  slag_singer: { name: "Cold", text: "Enemy moves deal no Burn. Allies taking damage get Burned instead." },
  brine_bulb: { name: "Soaking", text: "Starts battle with Regen. Loses Regen if it uses a Boost move." },
  iron_lung: { name: "Hot", text: "Starts battle with Burn. Deals double damage to targets with Haste." },
  void_shell: { name: "Quiet", text: "Immune to Silence. If Stunned, skips next turn and loses 10 HP." },
  slag_worm: { name: "Burrower", text: "First turn, takes no damage. Next turn, starts turn with +1 Boost." },
  scrap_bat: { name: "Scrap Eater", text: "Heals 5 HP when it deals damage. Cannot be healed by items." },
  waste_spitter: { name: "Waste Born", text: "Attacks apply Poison. If target dies to Poison, gain 1 Boost." },
  slag_tether: { name: "Chain Anchor", text: "Flees lose 10% max HP per step." },
  ash_vein: { name: "Color Suck", text: "Steals 1 color from adjacent Ruins." },
  oxide_fern: { name: "Snap Lock", text: "Roots enemies who move into it." },
  glass_echo: { name: "Replay", text: "Copies last move used against it." },
  void_rust: { name: "Iron Hunger", text: "Gains ATK for each Metal hit." },
  slag_choir: { name: "Ember Chant", text: "Burns attackers every 3 turns." },
  mirror_fly: { name: "Shine Back", text: "Reflects 50% of Magic damage." },
  vitreous_wisp: { name: "Glass Skin", text: "Shatters into shards on death." },
  shatter_spitter: { name: "Shard Spew", text: "Hits all foes on big move wind-up." },
  heat_blur: { name: "Soft Apology", text: "Heals 5 HP when attacking." },
  silica_hum: { name: "Window Break", text: "Stuns if hit by Stone move." },
  oxide_drip: { name: "Regret Rain", text: "Poisons ground for 2 turns." },
  kiln_cage: { name: "Thermal Debt", text: "Starts battle with 2 Boost. Loses 1 Boost each turn." },
  glass_mirror: { name: "Echo Self", text: "First hit taken deals no damage. Resets every battle." },
  mud_slug: { name: "Slime Trail", text: "Enemies starting turn in mud are Rooted for 1 turn." },
  clay_rat: { name: "Dry Crust", text: "Immune to Burn. Takes 20% more damage from Stone." },
  mire_worm: { name: "Void Rot", text: "Attacks have 30% chance to apply Rot for 2 turns." },
  clay_golem: { name: "Wet Weight", text: "DEF +2. Cannot benefit from Haste or Empower." },
  mire_hinge: { name: "Rust Scream", text: "When hit, deal 5 damage to attacker. Cooldown: 3." },
  void_vein: { name: "Future Wound", text: "Every 3rd attack hits twice. Second hit is Aether." },
  kiln_mouth: { name: "Boot Melt", text: "Enemies who use a move take 3 Burn damage immediately." },
  deep_clay: { name: "Deep Set", text: "Immune to Stun and Root. AGI -2." },
  clay_worm: { name: "Clay Burrow", text: "First turn: dodge all attacks. Cooldown: 4 turns." },
  slag_ankle: { name: "Lead Boots", text: "AGI +0. Take 1 less damage from Metal moves." },
  void_glaze: { name: "Cold Shine", text: "Reflects first Aether hit back at attacker." },
  kiln_sigh: { name: "Hot Breath", text: "Burns target for 3 dmg when hit by Wood." },
  rust_echo: { name: "Dull Sound", text: "Silences target for 1 turn on first hit." },
  mire_silica: { name: "Hard Mud", text: "Gains +2 DEF after using Mud Burrow." },
  kiln_fire: { name: "Kiln Born", text: "Heals 2 HP when using Flame Tongue." },
  silica_lung: { name: "breathes_glass", text: "Poisons attacker for 2 turns on contact." },
  rust_knuckle: { name: "peels_skin", text: "Bleeds target for 4 dmg on hit." },
  weep_weaver: { name: "sings_bone", text: "Stuns target for 1 turn on Vine Whip." },
  cinder_ankle: { name: "Ash Memory", text: "Ash footprints burn Stun to enemies who step on them." },
  ash_knee: { name: "Ghost Step", text: "After using a move, swap places with a reserve Ruin." },
  heart_weep: { name: "Void Walker", text: "First move each battle costs no Boost and deals double." },
  kiln_marrow: { name: "Sinter", text: "Attacks have 20% chance to Expose target for 1 turn." },
  void_rib: { name: "Hollow", text: "When Stunned, silence the attacker for 1 turn." },
  ash_lung: { name: "Suffocate", text: "Enemies starting their turn with Burn take 1 extra damage." },
  mire_bone: { name: "Rooted", text: "Cannot be moved. AGI +1 for every 10 DEF." },
  rust_vein: { name: "Decay", text: "Attacks deal 1 extra damage per status effect on target." },
  glass_throat: { name: "Bone Dust", text: "Attacks heal 1 HP per hit." },
  granite_warden: { name: "Static Guard", text: "Starts battle with Stasis. Ignores the first hit each turn." },
  tide_mite: { name: "Tide Pull", text: "On field, all allies gain Haste. In battle, first move costs no Boost." },
  clay_vein: { name: "Wet Pulse", text: "Starts battle with Regen. Gains Stasis for 1 turn every 3rd turn." },
  edge_stone: { name: "Kiln Crust", text: "Immune to Burn. Start with 1 Boost." },
  edge_golem: { name: "Edge Weight", text: "AGI -2. DEF +3 when HP is below 50%." },
  void_marrow: { name: "Hollow Drink", text: "Gain 1 Boost when an enemy's move misses due to reflection." },
  heart_stone: { name: "Core Stone", text: "Immune to Stun. DEF +2 when HP is below 50%." },
  heart_fire: { name: "Core Heat", text: "Starts battle with Haste. ATK +2 for the first 2 turns." },
  heart_golem: { name: "Heart Weight", text: "AGI -2. DEF +3 when HP is below 50%." },
  kiln_golem: { name: "Clay Crust", text: "Starts battle with 5 extra max HP." },
  // Dregs passives (tools/build_dregs.mjs)
  slag_mite: { name: "Molten Drip", text: "1/3 chance to burn target for 2 dmg after attack." },
  weep_wisp: { name: "Silence", text: "1/4 chance to silence target for 1 turn on hit." },
  rust_fungus: { name: "Oxidize", text: "Lowers target def by 2 for 2 turns on hit." },
  ash_shard: { name: "Drift", text: "1/3 chance to dodge physical attacks entirely." },
  dreg_mold: { name: "Spore", text: "Heals 3 hp at end of turn if no allies present." },
  weep_worm: { name: "Decay", text: "1/2 chance to lower target res by 3 on hit." },
  damp_whisper: { name: "Echo Trap", text: "1/3 chance: enemy's last move hits self instead." },
  blind_coral: { name: "Light Eater", text: "2/3 chance: takes 0 damage from light moves." },
  vibration_shroom: { name: "Tremor Sense", text: "1/2 chance: dodges first attack of turn." },
  slag_urn: { name: "Memory Leak", text: "1/3 chance: heals 5 HP when hit by attack." },
  glass_moth: { name: "Shard Refraction", text: "1/2 chance: reflects 50% of magic damage back." },
  trench_leviathan: { name: "Pressure Crush", text: "1/2 chance: deals double damage if Shard moves." },
  time_tick: { name: "Skip Turn", text: "20% chance to skip your turn but heal 5 HP instantly." },
  gravity_well: { name: "Pull", text: "10% chance each turn to pull all enemies 1 tile closer." },
  echo_shard: { name: "Repeat", text: "If hit, next turn uses the same move with 1.5x power." },
  void_leak: { name: "Drain", text: "15% chance per turn to reduce enemy Atk by 1." },
  ash_wisp_2: { name: "Burn", text: "10% chance to set target on fire for 2 turns (5 dmg/turn)." },
  corrupt_vessel: { name: "Hollow Core", text: "Starts with 1 HP. Heals 5 HP each turn." },
  slag_warden: { name: "Heat Soak", text: "Heals 3 HP when hit by Fire. Resists Fire damage." },
  ember_mite: { name: "Swarm", text: "20% chance to attack twice when attacking." },
  obsidian_shard: { name: "Shatter", text: "10% chance to deal double damage with any move." },
  cinder_wisp: { name: "Drift", text: "Moves 50% faster in battle. Ignores terrain damage." },
  pyre_beetle: { name: "Burn", text: "Inflicts Burn on hit. Burn deals 5 damage per turn." },
  fire_weep: { name: "Molten Core", text: "Heals 5 HP each turn. Deals extra damage to frozen foes." },
  prism_wisp: { name: "Refraction", text: "50% chance to split into two Prisms on hit." },
  silica_mite: { name: "Erosion", text: "Lowers target def by 2 each turn for 3 turns." },
  mirror_stalker: { name: "Echo", text: "Copies the last move used by Shard with 0.5 power." },
  fracture_crab: { name: "Shatter", text: "On death, deals 10 damage to all adjacent targets." },
  vein_glass: { name: "Sap Siphon", text: "Heals 2 HP each turn if Shard has no active buffs." },
  abyssal_mirror: { name: "Distortion", text: "50% chance to dodge attacks that deal less than 15 damage." },
  dreg_spore: { name: "Heavy Breath", text: "1/3 chance enemy loses 2 AGI when hit." },
  glass_mite: { name: "Sharp Trail", text: "1/2 chance enemy loses 1 HP per turn." },
  ash_crawler: { name: "Cold Ash", text: "1/3 chance enemy loses 2 ATK when hit." },
  void_moth: { name: "Light Eater", text: "1/4 chance enemy loses 2 MGK when hit." },
  rust_worm: { name: "Corrode Touch", text: "1/2 chance enemy loses 1 DEF when hit." },
  weep_matriarch: { name: "World Decay", text: "All enemies lose 1 HP per turn." },
  // End of Dregs passives
};

type Stat = 'atk' | 'def' | 'res' | 'mgk' | 'agi';

/** Whether either of a Ruin's two types is this one. */
const is = (r: RuinState, type: string) => ((SPECIES[r.speciesKey]?.types ?? []) as string[]).includes(type);
/** The type a hit lands as: the move's, or the attacker's own for the basic Attack. */
const hitType = (attacker: RuinState, move: MoveData, basic: boolean): string => (basic ? typeOf(attacker) : move.type);
/** Whether a hit strikes with MGK against RES: spells, channels, and a magic Ruin's basic Attack. */
const magic = (attacker: RuinState, move: MoveData, basic: boolean) =>
  basic ? SPECIES[attacker.speciesKey]?.attackKind === AttackKind.Magic : move.kind === MoveKind.Spell || move.kind === MoveKind.Channel;
/** A Dash touches what it hits. The basic Attack is a Dash. */
const contact = (move: MoveData) => move.kind === MoveKind.Dash;
/** The damage multiplier for ignoring a defense stat: the game ignores at most 60% of one. */
const IGNORE = 1 / (1 - 0.6);

/** A flat stat change for the rest of the battle that keeps the stat at 1 or more. */
function addStat(r: RuinState, stat: Stat, n: number): void {
  r.currentStats[stat] = Math.max(1, r.currentStats[stat] + n);
}

/** A speed multiplier that adds n flat AGI. */
const plusAgi = (r: RuinState, n: number) => (Math.max(1, statOf(r, 'agi')) + n) / Math.max(1, statOf(r, 'agi'));

/** Keeps a flat DEF bonus on while HP is below half and off otherwise. */
function defWhileLow(c: Ctx, n: number): void {
  const low = c.self.hp < c.self.maxHp / 2;
  if (low === !!c.mem.low) return;
  c.mem.low = low;
  addStat(c.self, 'def', low ? n : -n);
  if (low) c.say();
}

/** Stops a harmful status in the turn a move missed it or it dodged one. */
const dodging = (c: Ctx, s: string) => (c.mem.dodgeTurn === c.state.turn && isHarmful(s) ? false : undefined);

/** Puts a move into an extra slot of the holder's moves in place of the one put there before. */
function learn(c: Ctx, move: MoveData): void {
  if (c.self.moves.some((m) => m.data === move)) return;
  const slot: MoveInstance | undefined = c.mem.slot;
  if (slot) slot.data = move;
  else c.self.moves.push((c.mem.slot = { data: move, cooldownLeft: 0 }));
  c.say();
}

/** keeper_vex, rust_fungus: gives back the DEF of the drops that have run out (every drop when all is true). */
function giveDefBack(c: Ctx, all: boolean): void {
  const drops: { r: RuinState; n: number; until: number }[] = c.mem.drops ?? [];
  c.mem.drops = drops.filter((d) => {
    if (!all && d.until > c.state.turn) return true;
    d.r.currentStats.def += d.n;
    return false;
  });
}

/** silica_hag: Silences the foe each time its HP falls below half. */
function scream(c: Ctx): void {
  const low = c.self.hp < c.self.maxHp / 2;
  if (low && !c.mem.low) addStatus(c, c.foe, Status.Silence, 1);
  c.mem.low = low;
}

/** metal_scraper: Stuns the foe once in a turn in which it both used a move and was hit. */
function screech(c: Ctx): void {
  const t = c.state.turn;
  if (c.mem.moved !== t || c.mem.hitBy !== t || c.mem.done === t) return;
  c.mem.done = t;
  addStatus(c, c.foe, Status.Stun);
}

/** kiln_rat: the end of its first turn. */
function sprintEnds(c: Ctx, trail: boolean): void {
  if (!c.mem.sprint) return;
  c.mem.sprint = false;
  addStat(c.self, 'agi', -1);
  if (trail) addStatus(c, c.foe, Status.Burn);
}

/** slag_vent: 1 damage to each standing neighbor in team order. */
function weep(c: Ctx): void {
  const i = c.team.indexOf(c.self);
  for (const r of [c.team[i - 1], c.team[i + 1]]) if (r && !r.isFainted) harm(c, r, 1);
}

/** basalt_golem: mends 5 HP each time its HP falls below 30%. */
function solidify(c: Ctx): void {
  if (c.self.hp < c.self.maxHp * 0.3 && !c.mem.low) heal(c, c.self, 5);
  c.mem.low = c.self.hp < c.self.maxHp * 0.3;
}

/** clay_worm: its first turn on the field and every 4th turn after. */
const burrowed = (c: Ctx) => c.mem.first !== undefined && (c.state.turn - c.mem.first) % 4 === 0;

/** heart_fire: the end of its first 2 turns. */
function heatEnds(c: Ctx): void {
  if (c.mem.until === undefined || c.state.turn < c.mem.until) return;
  c.mem.until = undefined;
  addStat(c.self, 'atk', -2);
}

/** slag_singer: true while a Burn moves to its teammates so that two slag_singers cannot pass one back and forth. */
let redirecting = false;

/** ash_shard, vibration_shroom, abyssal_mirror: marks the turn it dodged a hit, for dodging(), and says so. */
function dodged(c: Ctx): void {
  c.mem.dodgeTurn = c.state.turn;
  c.say();
}

/** weep_worm, dreg_spore, ash_crawler, void_moth, rust_worm: on each of its hits, a chance that the foe it hit loses flat points of a stat. */
function sap(c: Ctx, stat: Stat, n: number, percent: number): void {
  if (c.foe.isFainted || !chance(c, stat, percent)) return;
  addStat(c.foe, stat, -n);
  c.say();
}

/** trench_leviathan, obsidian_shard: x2 for a move whose chance came true on its hit, the rest of its reach included. */
function double(c: Ctx, move: MoveData, can: boolean, percent: number): number {
  const s = c.mem.surge;
  if (s?.move === move && s.turn === c.state.turn) return s.x;
  return can && peek(c, 'double', percent) ? 2 : 1;
}

/** trench_leviathan, obsidian_shard: rolls on the hit the chance that double() looked at before it. */
function doubled(c: Ctx, move: MoveData, can: boolean, percent: number): void {
  const x = can && chance(c, 'double', percent) ? 2 : 1;
  c.mem.surge = { move, turn: c.state.turn, x };
  if (x === 2) c.say();
}

/** time_tick: takes off its own Stun if the Stun is still on at the turn's end. */
function skipEnds(c: Ctx): void {
  if (!c.mem.skip) return;
  c.self.statuses = c.self.statuses.filter((s) => s !== c.mem.skip);
  c.mem.skip = undefined;
}

/** gravity_well: moves each standing enemy one place toward the front of its team, and the fighting one goes to the back. */
function pull(c: Ctx): void {
  const lead = c.foes[0], lines: string[] = [];
  if (lead.isFainted || !pushBack(c.state, lead, lines)) return;
  c.foes.splice(c.foes.indexOf(lead), 1);
  c.foes.push(lead);
  lines.forEach((l) => c.say(l));
}

/** prism_wisp: splits its HP with a copy of itself that joins the end of its team. */
function split(c: Ctx): void {
  const me = c.self, half = Math.floor(me.hp / 2);
  if (half < 1) return;
  me.hp -= half;
  c.team.push({
    speciesKey: me.speciesKey, level: me.level, hp: half, maxHp: me.maxHp, currentStats: { ...me.currentStats }, statuses: [],
    moves: me.moves.map((m) => ({ data: m.data, cooldownLeft: 0 })), isLinkActive: false, isReserve: true, isFainted: false,
    mods: me.mods && { ...me.mods }, nick: me.nick, copy: true,
  });
  c.say();
}

/** silica_mite: takes 2 flat DEF from the foe it last hit, while turns of the erosion are left. */
function erode(c: Ctx): void {
  const e: { r: RuinState; left: number } | undefined = c.mem.erode;
  if (!e || e.r.isFainted || e.left <= 0) return;
  e.left -= 1;
  addStat(e.r, 'def', -2);
  c.say();
}

/** weep_matriarch: 1 HP from each standing enemy. */
function decay(c: Ctx): void {
  for (const r of standing(c.foes)) harm(c, r, 1);
}

export const PASSIVE_CODE: Record<string, PassiveCode> = {
  glass_sentinel: { hurt: (c) => { if (chance(c, 'expose', 30)) addStatus(c, c.foe, Status.Expose); } },

  rust_crawler: {
    damageOut: (c) => ((c.mem.hits ?? 0) % 3 === 2 && is(c.foe, 'Metal') ? 1.1 : 1),
    hit: (c) => { c.mem.hits = (c.mem.hits ?? 0) + 1; if (c.mem.hits % 3 === 0 && is(c.foe, 'Metal')) c.say(); },
  },

  ash_wisp: { enter: (c) => { if (once(c, 'start')) { addStatus(c, c.self, Status.Haste); addStatus(c, c.self, Status.Stasis); } } },

  kiln_imp: { hurt: (c) => { harm(c, c.foe, 2); } },

  stone_golem: { status: (c, s) => { if (s === Status.Root || s === Status.Stun) { c.say(); return false; } } },

  // A multiplier of 0 makes the hit 0 rather than the usual floor of 1.
  keeper_nyx_scout: {
    damageIn: (c) => (c.mem.used ? 1 : 0),
    hurt: (c) => { if (!c.mem.used) { c.mem.used = true; c.say(); } },
  },

  keeper_nyx: { damageIn: () => 0.8 },

  keeper_bram: { acted: (c, move, basic) => { if (!basic && move.type === 'Wood') heal(c, c.self, 5); } },

  // The second hit deals the first hit's damage again to the same foe.
  keeper_grom: { hit: (c, info) => { if (!info.basic && info.move === MOVES.earthquake) harm(c, c.foe, info.damage); } },

  keeper_kyr: { status: (c, s) => { if (s === Status.Silence) { c.say(); return false; } } },

  keeper_tor: { enter: (c) => { if (once(c, 'start')) addStatus(c, c.self, Status.Burn); } },

  // Each hit takes 1 flat DEF from the foe until the end of the next turn.
  keeper_vex: {
    hit: (c) => {
      if (c.foe.isFainted) return;
      c.foe.currentStats.def -= 1;
      (c.mem.drops ??= []).push({ r: c.foe, n: 1, until: c.state.turn + 1 });
      c.say();
    },
    turnEnd: (c) => giveDefBack(c, false),
    reserve: (c) => giveDefBack(c, false),
    fainted: (c) => giveDefBack(c, true),
  },

  keeper_syl: { acted: (c, move, basic) => { if (!basic && move.type === 'Metal') { addStat(c.self, 'def', 2); c.say(); } } },

  // DEF only matters to hits that strike with ATK. A first hit with MGK still uses the passive up.
  keeper_dun: {
    damageOut: (c, move, basic) => (!c.mem.hit && !magic(c.self, move, basic) ? IGNORE : 1),
    hit: (c, info) => { if (!c.mem.hit) { c.mem.hit = true; if (!magic(c.self, info.move, info.basic)) c.say(); } },
  },

  keeper_grom_lieutenant: {
    status: (c, s) => { if (s === Status.Stun) { c.say(); return false; } },
    hurt: (c) => { if (c.mine) { giveBoost(c, 1); c.say(); } },
  },

  ash_spitter: { hurt: (c) => { if (every(c, 'hurt', 3)) harm(c, c.foe, 1); } },

  dust_mite: {
    enter: (c) => { if (once(c, 'start')) addStatus(c, c.self, Status.Haste); },
    hurt: (c) => { if (clearStatus(c.self, Status.Haste)) c.say(); },
  },

  kiln_mite: { hurt: (c, info) => { if (contact(info.move)) addStatus(c, c.foe, Status.Burn, 1); } },

  glass_shard: { enter: (c) => { if (once(c, 'start')) { addStat(c.self, 'atk', 1); addStat(c.self, 'def', -1); } } },

  // Each time its HP falls below half, the foe is Silenced for 1 turn.
  silica_hag: { hurt: (c) => scream(c), turnEnd: (c) => scream(c) },

  slag_vein: { hurt: (c) => { addStatus(c, c.foe, Status.Poison, 2); } },

  ash_weaver: { hit: (c) => { addStatus(c, c.foe, Status.Root, 1); } },

  void_bulb: { hit: (c) => { addStatus(c, c.foe, Status.Stasis, 1); } },

  rust_fern: { hit: (c) => { addStatus(c, c.foe, Status.Expose, 1); } },

  // A wind-up move's Stun comes with the move when it lands.
  mire_echo: {
    acted: (c, move, basic) => { if (!basic && !move.windup && once(c, move.name)) addStatus(c, c.foe, Status.Stun); },
    hit: (c, info) => { if (info.landing && once(c, info.move.name)) addStatus(c, c.foe, Status.Stun); },
  },

  // Each standing enemy takes 50% of its own max HP, and reserves count.
  silica_husk: { fainted: (c) => { for (const r of standing(c.foes)) harm(c, r, r.maxHp * 0.5); } },

  // "After hit" is read as after it lands a hit. DEF only matters to hits that strike with ATK.
  oxide_mite: {
    damageOut: (c, move, basic) => {
      const t = c.state.turn, from = c.mem.from;
      return from !== undefined && t > from && t <= from + 2 && !magic(c.self, move, basic) ? 2 : 1;
    },
    hit: (c) => { c.mem.from = c.state.turn; },
  },

  // The game has no dodge. Guard is the closest, so the first hit it takes while Guarding counts.
  glass_wisp: { hurt: (c) => { if (c.mine && c.state.guard && c.team[0] === c.self && once(c, 'dodge')) harm(c, c.foe, 10); } },

  metal_scraper: {
    acted: (c, _move, basic) => { if (!basic) { c.mem.moved = c.state.turn; screech(c); } },
    hurt: (c) => { c.mem.hitBy = c.state.turn; screech(c); },
  },

  // Every 3rd battle turn, the moves its standing teammates use cost no Boost.
  resonant_shard: { allyCost: (c, _move, cost) => (c.state.turn % 3 === 0 ? 0 : cost) },

  // Two Ruin fight at a time, so an enemy with less HP than it acting last means it acts first.
  silica_spider: { speed: (c) => (c.foe.hp < c.self.hp ? 1000 : 1) },

  magnetic_drifter: { turnEnd: (c) => { heal(c, c.self, 5); harm(c, c.self, 2); } },

  // The Roots it lands last 1 turn longer, and a Rooted foe that takes an action ("moved") is Stunned.
  glass_vine: {
    acted: (c, move, basic) => {
      const root = c.foe.statuses.find((s) => s.status === Status.Root);
      if (!basic && move.status === Status.Root && root?.turnsLeft === applyStatus(null, Status.Root).turnsLeft) { root.turnsLeft += 1; c.say(); }
    },
    foeActed: (c) => { if (hasStatus(c.foe, Status.Root)) addStatus(c, c.foe, Status.Stun); },
  },

  // Burn takes 8% of max HP a turn, so the foe it faces takes 12% more at each turn's end while Burned.
  heat_moth: {
    hit: (c) => { addStatus(c, c.foe, Status.Burn); },
    turnEnd: (c) => { if (!c.foe.isFainted && hasStatus(c.foe, Status.Burn)) harm(c, c.foe, c.foe.maxHp * 0.12); },
  },

  void_glass: {
    enter: (c) => { if (once(c, 'start')) addStat(c.self, 'res', 5); },
    damageOut: (c, move, basic) => (hasStatus(c.foe, Status.Stasis) && magic(c.self, move, basic) ? IGNORE : 1),
  },

  clay_strider: {
    enter: (c) => { if (once(c, 'start')) { c.mem.in = true; addStat(c.self, 'def', 3); } },
    turnEnd: (c) => { addStat(c.self, 'def', -1); },
    reserve: (c) => { if (c.mem.in) addStat(c.self, 'def', -1); },
  },

  // The Ash trail is read as Burn on the foe it faces at the end of its first turn.
  kiln_rat: {
    enter: (c) => { if (once(c, 'start')) { c.mem.sprint = true; addStat(c.self, 'agi', 1); } },
    turnEnd: (c) => sprintEnds(c, true),
    reserve: (c) => sprintEnds(c, false),
  },

  mud_golem: {
    enter: (c) => { if (once(c, 'start')) addStatus(c, c.self, Status.Root); },
    turnEnd: (c) => { heal(c, c.self, 1); },
  },

  fire_spitter: { hit: (c) => { addStatus(c, c.foe, Status.Burn, 2); } },

  slag_kneeler: { hit: (c) => { if (!c.foe.isFainted) { addStat(c.foe, 'agi', -1); c.say(); } } },

  // It learns the opponent's last move into an extra slot in place of the move it learned before.
  wet_echo: { foeActed: (c, move, basic) => { if (!basic) learn(c, move); } },

  // The game has no critical hits. A hit strong against the foe's type counts as one.
  bone_clay: { hit: (c, info) => { if (info.mult > 1 && chance(c, 'stun', 20)) addStatus(c, c.foe, Status.Stun); } },

  // "Rust" is read as a Metal Ruin: it mends 1 HP at the end of each turn it faces one.
  iron_rhizome: { turnEnd: (c) => { if (!c.foe.isFainted && is(c.foe, 'Metal')) heal(c, c.self, 1); } },

  glass_mire: { hurt: (c) => { if (c.mem.turn !== c.state.turn) { c.mem.turn = c.state.turn; harm(c, c.foe, 1); } } },

  // Its adjacent allies are its neighbors in team order. They take the 1 damage at the end of every turn.
  slag_vent: { turnEnd: (c) => weep(c), reserve: (c) => weep(c) },

  rock_spitter: { turnStart: (c) => defWhileLow(c, 2), hurt: (c) => defWhileLow(c, 2), turnEnd: (c) => defWhileLow(c, 2) },

  earth_mover: { acted: (c, _move, basic) => { if (!basic) { addStat(c.self, 'def', 1); c.say(); } } },

  // A miss does no damage and brings no status. Light is the Aether type of the light moves and never harms it.
  basalt_cyst: {
    damageIn: (c, move, basic) => (!c.mem.missed || hitType(c.foe, move, basic) === 'Aether' ? 0 : 1),
    hurt: (c, info) => {
      if (c.mem.missed && hitType(c.foe, info.move, info.basic) !== 'Aether') return;
      c.mem.missed = true;
      c.mem.dodgeTurn = c.state.turn;
      c.say();
    },
    status: (c, s) => dodging(c, s),
  },

  // Silence breaks it by starting the count over.
  quartz_witch: {
    acted: (c, _move, basic) => { if (!basic && (c.mem.n = (c.mem.n ?? 0) + 1) % 3 === 0) addStatus(c, c.foe, Status.Stun); },
    status: (c, s) => { if (s === Status.Silence) c.mem.n = 0; },
  },

  slag_biter: { hit: (c) => { if (hasStatus(c.foe, Status.Bleed) || hasStatus(c.foe, Status.Burn)) harm(c, c.foe, 2); } },

  // Only the player's side holds Boost, so it always applies for an opponent.
  vein_walker: { enter: (c) => { if (once(c, 'start') && !(c.mine && c.state.boost > 0)) heal(c, c.self, c.self.maxHp); } },

  ember_core: { hurt: (c, info) => { if (hitType(c.foe, info.move, info.basic) === 'Metal') harm(c, c.foe, 2); } },

  // Only the player's side holds Boost. The player's takes 1 into an empty pool and an opponent's takes 1 from the player.
  shard_hollow: {
    hit: (c) => {
      if (c.mine && c.state.boost === 0) { giveBoost(c, 1); c.say(); }
      else if (!c.mine && c.state.boost > 0) { c.state.boost -= 1; c.say(); }
    },
  },

  // The first damaging move against it does no damage and brings no status.
  schist_flyer: {
    damageIn: (c, _move, basic) => (!basic && !c.mem.dodged ? 0 : 1),
    hurt: (c, info) => { if (!info.basic && !c.mem.dodged) { c.mem.dodged = true; c.mem.dodgeTurn = c.state.turn; c.say(); } },
    status: (c, s) => dodging(c, s),
  },

  // Guard is the player's action and targets nothing, so it is read as the player's Guard not softening its hits.
  wind_wisp: { damageOut: (c) => (!c.mine && c.state.guard && c.foe === c.state.playerTeam[0] ? 2 : 1) },

  // "Heavy but fast" names no number and changes nothing.
  stone_flyer: { enter: (c) => { if (once(c, 'start')) { addStat(c.self, 'atk', 2); addStat(c.self, 'def', -2); } } },

  aether_spitter: {
    turnEnd: (c) => {
      const cooling = c.self.moves.filter((m) => m.data?.type === 'Aether' && m.cooldownLeft > 0);
      cooling.forEach((m) => (m.cooldownLeft = 0));
      if (cooling.length) c.say();
    },
  },

  // Root is the game's way to keep a Ruin in place: it stops switching and running for the rest of the battle.
  schist_crag: {
    speed: () => 0,
    enter: (c) => { addStatus(c, c.self, Status.Root, 99); },
  },

  aether_fracture: { hurt: (c, info) => { if (info.damage > 0) harm(c, c.foe, info.damage * 0.5); } },

  metal_shriek: {
    foeActed: (c, _move, basic) => { if (!basic) c.mem.foeMoved = c.state.turn; },
    hit: (c) => { if (c.mem.foeMoved === c.state.turn - 1) addStatus(c, c.foe, Status.Stun); },
  },

  // DEF only matters to hits that strike with ATK. A first hit with MGK still uses the passive up.
  void_cleft: {
    damageOut: (c, move, basic) => (!c.mem.hit && !magic(c.self, move, basic) ? IGNORE : 1),
    hit: (c, info) => { if (!c.mem.hit) { c.mem.hit = true; if (!magic(c.self, info.move, info.basic)) c.say(); } },
  },

  stone_echo: {
    foeActed: (c, _move, basic) => { if (!basic) c.mem.foeMoved = c.state.turn; },
    turnStart: (c) => { if (c.mem.foeMoved === c.state.turn - 1) addStatus(c, c.foe, Status.Silence); },
  },

  // Only the player's side holds Boost, so it acts only for an opponent.
  metal_rust: { turnEnd: (c) => { if (!c.mine && c.state.turn % 3 === 0 && c.state.boost > 0) { c.state.boost -= 1; c.say(); } } },

  basalt_golem: { hurt: (c) => solidify(c), turnEnd: (c) => solidify(c) },

  steam_wisp: {
    turnStart: (c) => {
      if ((hasStatus(c.foe, Status.Root) || hasStatus(c.foe, Status.Stun)) && !hasStatus(c.foe, Status.Burn)) addStatus(c, c.foe, Status.Burn);
    },
  },

  ember_flyer: {
    speed: (c) => (c.mem.moved === c.state.turn - 1 ? 1 : plusAgi(c.self, 2)),
    acted: (c, _move, basic) => { if (!basic) c.mem.moved = c.state.turn; },
  },

  // None of its moves give Thorns, so the coat is read as a Thorns of its own that always deals 3.
  forge_spitter: { hurt: (c) => { harm(c, c.foe, 3); } },

  basalt_vent: { hurt: (c, info) => { if (!info.basic && info.move.type === 'Stone' && c.mine) { giveBoost(c, 1); c.say(); } } },

  // A Big move is a wind-up move.
  slag_drifter: {
    foeActed: (c, move, basic) => { if (!basic && move.windup > 0) c.mem.big = c.state.turn; },
    turnStart: (c) => { if (c.mem.big === c.state.turn - 1) addStatus(c, c.foe, Status.Stun); },
  },

  obsidian_moth: { hit: (c) => { addStatus(c, c.foe, Status.Expose, 2); } },

  // Wild Ruin are met in grass, and only trainer battles set smartFoe.
  magma_slug: { hit: (c) => { if (!c.state.smartFoe) addStatus(c, c.foe, Status.Poison); } },

  // DEF only matters to hits that strike with ATK. A turn's first hit with MGK still uses it up.
  quartz_specter: {
    damageOut: (c, move, basic) => (c.mem.turn !== c.state.turn && !magic(c.self, move, basic) ? IGNORE : 1),
    hit: (c, info) => { if (c.mem.turn !== c.state.turn) { c.mem.turn = c.state.turn; if (!magic(c.self, info.move, info.basic)) c.say(); } },
  },

  // Max Boost is fixed at 10, so each catch tried while it leads gives 1 Boost up to the max.
  iron_bulb: { catchLine: (c, line) => { if (c.mine) { giveBoost(c, 1); c.say(); } return line; } },

  oxide_hulk: { hit: (c) => { if (every(c, 'attack', 3)) addStatus(c, c.foe, Status.Expose); } },

  // It counts its own moves while it leads with an active Link. The partner's follow-up has no passive hook.
  copper_wisp: { hit: (c, info) => { if (!info.basic && c.self.isLinkActive) harm(c, c.foe, 2); } },

  iron_spitter: { enter: (c) => { if (once(c, 'start') && c.mine) { giveBoost(c, 3); c.say(); } } },

  steel_flyer: {
    speed: (c) => {
      const agi = statOf(c.self, 'agi') * (hasStatus(c.self, Status.Haste) ? 1.5 : 1) * (hasStatus(c.self, Status.Slow) ? 0.5 : 1);
      return agi < 5 ? 5 / Math.max(agi, 0.01) : 1;
    },
  },

  // The kill is read as its own knockout, and the Ruin that knocked it out is Silenced.
  slag_hinge: { fainted: (c) => { addStatus(c, c.foe, Status.Silence); } },

  vex_mirror: {
    hurt: (c) => {
      for (const s of ['atk', 'def', 'res', 'mgk', 'agi', 'cha'] as const) {
        [c.self.currentStats[s], c.foe.currentStats[s]] = [c.foe.currentStats[s], c.self.currentStats[s]];
      }
      c.say();
    },
  },

  oxide_tether: { turnEnd: (c) => { if (!c.foe.isFainted && hasStatus(c.foe, Status.Root)) harm(c, c.foe, 2); } },

  // Stasis Field winds up, so the Stasis it brings gets its extra turn at the end of the turn it lands.
  slag_echo: {
    acted: (c, move) => { if (move === MOVES.stasis_field) c.mem.field = true; },
    status: (c, s) => { if (s === Status.Stasis && c.mem.field) { c.mem.field = false; c.mem.stretch = true; } },
    turnEnd: (c) => {
      const held = c.self.statuses.find((x) => x.status === Status.Stasis);
      if (c.mem.stretch && held) { held.turnsLeft += 1; c.say(); }
      c.mem.stretch = false;
    },
  },

  oxide_spire: { damageOut: () => 0, hit: (c) => { addStatus(c, c.foe, Status.Burn); } },

  // The second hit deals the first hit's damage again to the same foe.
  vex_shard: { hit: (c, info) => { if (!info.basic && info.move === MOVES.glass_shatter) harm(c, c.foe, info.damage); } },

  anchor_barnacle: {
    enter: (c) => { if (once(c, 'start')) addStat(c.self, 'def', 1); },
    damageIn: (c) => (hasStatus(c.self, Status.Stun) ? 2 : 1),
  },

  // Guard is the player's action and cannot be taken from it, so against a Bleeding lead its hits ignore Guard.
  salt_spitter: {
    hit: (c) => { addStatus(c, c.foe, Status.Bleed); },
    damageOut: (c) => (!c.mine && c.state.guard && c.foe === c.state.playerTeam[0] && hasStatus(c.foe, Status.Bleed) ? 2 : 1),
  },

  // Enemy moves do no damage and bring no harmful status until it loses HP to anything else.
  hull_moth: {
    damageIn: (c, _move, basic) => (!c.mem.broken && !basic ? 0 : 1),
    status: (c, s) => (!c.mem.broken && isHarmful(s) ? false : undefined),
    turnStart: (c) => { c.mem.hp = c.self.hp; },
    hurt: (c, info) => { if (!c.mem.broken && info.damage > 0) { c.mem.broken = true; c.say(); } },
    turnEnd: (c) => { if (!c.mem.broken && c.self.hp < (c.mem.hp ?? c.self.hp)) { c.mem.broken = true; c.say(); } },
  },

  kelp_knuckle: {
    enter: (c) => {
      if (!once(c, 'start')) return;
      c.self.currentStats.atk = Math.round(c.self.currentStats.atk * 1.5);
      c.self.currentStats.agi = Math.max(1, Math.round(c.self.currentStats.agi * 0.5));
    },
    status: (c, s) => { if (s === Status.Haste) { c.say(); return false; } },
  },

  // A Burn that would land on it lands instead on each standing teammate that has lost HP.
  slag_singer: {
    status: (c, s) => {
      if (s !== Status.Burn) return;
      c.say();
      if (!redirecting) {
        redirecting = true;
        try { for (const r of standing(c.team)) if (r !== c.self && r.hp < r.maxHp) addStatus(c, r, Status.Burn); } finally { redirecting = false; }
      }
      return false;
    },
  },

  // A Boost move is one that costs Boost.
  brine_bulb: {
    enter: (c) => { if (once(c, 'start')) addStatus(c, c.self, Status.Regen); },
    acted: (c, move, basic) => { if (!basic && move.boostCost > 0 && clearStatus(c.self, Status.Regen)) c.say(); },
  },

  iron_lung: {
    enter: (c) => { if (once(c, 'start')) addStatus(c, c.self, Status.Burn); },
    damageOut: (c) => (hasStatus(c.foe, Status.Haste) ? 2 : 1),
  },

  // The Stun takes its next action as usual, and it loses 10 HP when the Stun lands.
  void_shell: {
    status: (c, s) => {
      if (s === Status.Silence) { c.say(); return false; }
      if (s === Status.Stun) harm(c, c.self, 10);
    },
  },

  // Its first turn is the turn it first comes onto the field.
  slag_worm: {
    enter: (c) => { if (once(c, 'start')) c.mem.first = c.state.turn; },
    damageIn: (c) => (c.state.turn === c.mem.first ? 0 : 1),
    turnStart: (c) => { if (c.state.turn === c.mem.first + 1 && c.mine) { giveBoost(c, 1); c.say(); } },
  },

  // Items mend the lead before its turn starts, so HP gained between turns is taken back.
  scrap_bat: {
    enter: (c) => { c.mem.hp = c.self.hp; },
    turnStart: (c) => { if (c.mem.hp !== undefined && c.self.hp > c.mem.hp) { c.self.hp = c.mem.hp; c.say(); } },
    hit: (c, info) => { if (info.damage > 0) heal(c, c.self, 5); },
    turnEnd: (c) => { c.mem.hp = c.self.hp; },
  },

  // A foe Poisoned at its turn's end that is down by the next turn's start died to Poison.
  waste_spitter: {
    hit: (c) => { addStatus(c, c.foe, Status.Poison); },
    turnEnd: (c) => { c.mem.prey = !c.foe.isFainted && hasStatus(c.foe, Status.Poison) ? c.foe : undefined; },
    turnStart: (c) => {
      if (!c.mem.prey?.isFainted) return;
      c.mem.prey = undefined;
      if (c.mine) { giveBoost(c, 1); c.say(); }
    },
  },

  // Fleeing is read as retreating to reserve: a foe that switches out while facing it loses 10% of its max HP.
  slag_tether: {
    enter: (c) => { c.mem.facing = c.foe; },
    turnEnd: (c) => {
      const gone: RuinState | undefined = c.mem.facing;
      if (gone && gone !== c.foe && !gone.isFainted) harm(c, gone, gone.maxHp * 0.1);
      c.mem.facing = c.foe;
    },
  },

  // Colors are read as the foe's helpful statuses: it takes one at the end of each turn.
  ash_vein: {
    turnEnd: (c) => {
      const s = c.foe.statuses.find((x) => x.turnsLeft > 0 && !isHarmful(x.status));
      if (!s || c.foe.isFainted) return;
      clearStatus(c.foe, s.status);
      addStatus(c, c.self, s.status, s.turnsLeft);
    },
  },

  // Moving into it is a Dash. The basic Attack is a Dash.
  oxide_fern: { hurt: (c, info) => { if (contact(info.move)) addStatus(c, c.foe, Status.Root); } },

  // It learns each move used against it (one that does damage or brings a harmful status) into an extra slot.
  glass_echo: {
    foeActed: (c, move, basic) => { if (!basic && (move.power > 0 || (!!move.status && isHarmful(move.status)))) learn(c, move); },
  },

  // Each of its own Metal hits gives 1 flat ATK, and the basic Attack counts.
  void_rust: { hit: (c, info) => { if (hitType(c.self, info.move, info.basic) === 'Metal') { addStat(c.self, 'atk', 1); c.say(); } } },

  // The last Ruin to hit it is Burned at the end of every 3rd battle turn.
  slag_choir: {
    hurt: (c) => { c.mem.attacker = c.foe; },
    turnEnd: (c) => {
      if (c.state.turn % 3 !== 0) return;
      const a: RuinState | undefined = c.mem.attacker;
      c.mem.attacker = undefined;
      if (a && !a.isFainted) addStatus(c, a, Status.Burn);
    },
  },

  mirror_fly: { hurt: (c, info) => { if (info.damage > 0 && magic(c.foe, info.move, info.basic)) harm(c, c.foe, info.damage * 0.5); } },

  // The shards are Shard Spray: each standing foe takes one from it as it falls.
  vitreous_wisp: {
    fainted: (c) => {
      for (const r of standing(c.foes)) { const n = calculateDamage(c.state, c.self, r, MOVES.shard_spray, false).damage; if (n) harm(c, r, n); }
    },
  },

  // Each standing foe takes its basic Attack as it winds up a big move.
  shatter_spitter: {
    acted: (c, move, basic) => {
      if (basic || !move.windup) return;
      for (const r of standing(c.foes)) { const n = calculateDamage(c.state, c.self, r, MOVES.glass_slam, true).damage; if (n) harm(c, r, n); }
    },
  },

  heat_blur: { acted: (c, move, basic) => { if (basic || move.power > 0) heal(c, c.self, 5); } },

  // The attacker is the one Stunned.
  silica_hum: { hurt: (c, info) => { if (!info.basic && info.move.type === 'Stone') addStatus(c, c.foe, Status.Stun); } },

  // The ground is where the foe stands: each time it comes in, the foe it faces is Poisoned for 2 turns.
  oxide_drip: { enter: (c) => { addStatus(c, c.foe, Status.Poison, 2); } },

  kiln_cage: {
    enter: (c) => { if (once(c, 'start') && c.mine) { giveBoost(c, 2); c.say(); } },
    turnEnd: (c) => { if (c.mine && c.state.boost > 0) { giveBoost(c, -1); c.say(); } },
  },

  // A multiplier of 0 makes the hit 0 rather than the usual floor of 1. Its memory lasts one battle.
  glass_mirror: {
    damageIn: (c) => (c.mem.used ? 1 : 0),
    hurt: (c) => { if (!c.mem.used) { c.mem.used = true; c.say(); } },
  },

  // Mud is its Mud moves: a foe it hits with one is Rooted for 1 turn as the next turn starts.
  mud_slug: {
    hit: (c, info) => { if (!info.basic && info.move.name.startsWith('Mud')) c.mem.mud = c.foe; },
    turnStart: (c) => { if (c.mem.mud === c.foe) addStatus(c, c.foe, Status.Root, 1); c.mem.mud = undefined; },
  },

  clay_rat: {
    status: (c, s) => { if (s === Status.Burn) { c.say(); return false; } },
    damageIn: (c, move, basic) => (hitType(c.foe, move, basic) === 'Stone' ? 1.2 : 1),
  },

  mire_worm: { hit: (c) => { if (chance(c, 'rot', 30)) addStatus(c, c.foe, Status.Rot, 2); } },

  // Haste and Empower still land on it and do nothing.
  clay_golem: {
    enter: (c) => { if (once(c, 'start')) addStat(c.self, 'def', 2); },
    speed: (c) => (hasStatus(c.self, Status.Haste) ? 1 / 1.5 : 1),
    damageOut: (c) => (hasStatus(c.self, Status.Empower) ? 1 / 1.2 : 1),
  },

  mire_hinge: { hurt: (c) => { if ((c.mem.next ?? 0) <= c.state.turn) { c.mem.next = c.state.turn + 3; harm(c, c.foe, 5); } } },

  // The second hit is the first one's damage with Aether's type edge in place of the first hit's.
  void_vein: {
    hit: (c, info) => {
      if (every(c, 'attack', 3) && info.damage > 0) harm(c, c.foe, info.damage / info.mult * getTypeMultiplier(Type.Aether, typeOf(c.foe) as Type));
    },
  },

  kiln_mouth: { foeActed: (c, _move, basic) => { if (!basic) harm(c, c.foe, 3); } },

  deep_clay: {
    status: (c, s) => { if (s === Status.Stun || s === Status.Root) { c.say(); return false; } },
    enter: (c) => { if (once(c, 'start')) addStat(c.self, 'agi', -2); },
  },

  // The dodge comes back every 4 turns after its first turn: no damage and no harmful status on those turns.
  clay_worm: {
    enter: (c) => { if (once(c, 'start')) c.mem.first = c.state.turn; },
    damageIn: (c) => (burrowed(c) ? 0 : 1),
    status: (c, s) => (burrowed(c) && isHarmful(s) ? false : undefined),
    hurt: (c) => { if (burrowed(c) && c.mem.said !== c.state.turn) { c.mem.said = c.state.turn; c.say(); } },
  },

  // "AGI +0" changes nothing. The 1 HP comes back after the hit.
  slag_ankle: {
    hurt: (c, info) => {
      if (info.basic || info.move.type !== 'Metal' || info.damage <= 0) return;
      c.self.hp = Math.min(c.self.maxHp, c.self.hp + 1);
      c.say();
    },
  },

  // The game's reflection (Thorns and reflect rules) leaves the hit in place and sends damage back.
  void_glaze: { hurt: (c, info) => { if (hitType(c.foe, info.move, info.basic) === 'Aether' && once(c, 'shine')) harm(c, c.foe, info.damage); } },

  kiln_sigh: { hurt: (c, info) => { if (hitType(c.foe, info.move, info.basic) === 'Wood') harm(c, c.foe, 3); } },

  rust_echo: { hit: (c) => { if (once(c, 'first')) addStatus(c, c.foe, Status.Silence, 1); } },

  mire_silica: { acted: (c, move) => { if (move === MOVES.mud_burrow) { addStat(c.self, 'def', 2); c.say(); } } },

  kiln_fire: { acted: (c, move) => { if (move === MOVES.flame_tongue) heal(c, c.self, 2); } },

  // Contact is a Dash. The basic Attack is a Dash.
  silica_lung: { hurt: (c, info) => { if (contact(info.move)) addStatus(c, c.foe, Status.Poison, 2); } },

  rust_knuckle: { hit: (c) => { harm(c, c.foe, 4); } },

  weep_weaver: { hit: (c, info) => { if (!info.basic && info.move === MOVES.vine_whip) addStatus(c, c.foe, Status.Stun, 1); } },

  // The footprints cover the field it fought on: an enemy that comes in after it is Stunned.
  cinder_ankle: {
    enter: (c) => { c.mem.facing = c.foe; },
    turnStart: (c) => {
      if (c.mem.facing && c.foe !== c.mem.facing) addStatus(c, c.foe, Status.Stun);
      c.mem.facing = c.foe;
    },
  },

  ash_knee: {
    acted: (c, _move, basic) => {
      if (basic || c.team[0] !== c.self) return;
      const lines: string[] = [];
      if (pushBack(c.state, c.self, lines)) lines.forEach((l) => c.say(l));
    },
  },

  // A wind-up first move deals double when it lands.
  heart_weep: {
    cost: (c, _move, cost) => (c.mem.moved ? cost : 0),
    damageOut: (c, move, basic) => (!basic && (!c.mem.moved || c.mem.pending === move) ? 2 : 1),
    acted: (c, move, basic) => { if (!basic && !c.mem.moved) { c.mem.moved = true; if (move.windup) c.mem.pending = move; c.say(); } },
    hit: (c, info) => { if (info.landing && info.move === c.mem.pending) c.mem.pending = undefined; },
  },

  kiln_marrow: { hit: (c) => { if (chance(c, 'expose', 20)) addStatus(c, c.foe, Status.Expose, 1); } },

  // The attacker is the Ruin it faces.
  void_rib: { status: (c, s) => { if (s === Status.Stun) addStatus(c, c.foe, Status.Silence, 1); } },

  ash_lung: { turnStart: (c) => { if (hasStatus(c.foe, Status.Burn)) harm(c, c.foe, 1); } },

  // Root is the game's way to keep a Ruin in place: it stops switching and running for the rest of the battle.
  mire_bone: {
    enter: (c) => { addStatus(c, c.self, Status.Root, 99); },
    speed: (c) => plusAgi(c.self, Math.floor(statOf(c.self, 'def') / 10)),
  },

  rust_vein: { hit: (c) => { const n = c.foe.statuses.filter((s) => s.turnsLeft > 0).length; if (n) harm(c, c.foe, n); } },

  glass_throat: { hit: (c) => { heal(c, c.self, 1); } },

  granite_warden: {
    enter: (c) => { if (once(c, 'start')) addStatus(c, c.self, Status.Stasis); },
    damageIn: (c) => (c.mem.turn === c.state.turn ? 1 : 0),
    hurt: (c) => { if (c.mem.turn !== c.state.turn) { c.mem.turn = c.state.turn; c.say(); } },
  },

  // "On field" is read as on the battlefield. Its standing team gains Haste each time it comes in, and the team includes itself.
  tide_mite: {
    enter: (c) => { for (const r of standing(c.team)) addStatus(c, r, Status.Haste); },
    cost: (c, _move, cost) => (c.mem.moved ? cost : 0),
    acted: (c, _move, basic) => { if (!basic) c.mem.moved = true; },
  },

  clay_vein: {
    enter: (c) => { if (once(c, 'start')) addStatus(c, c.self, Status.Regen); },
    turnStart: (c) => { if (c.state.turn % 3 === 0) addStatus(c, c.self, Status.Stasis, 1); },
  },

  edge_stone: {
    status: (c, s) => { if (s === Status.Burn) { c.say(); return false; } },
    enter: (c) => { if (once(c, 'start') && c.mine) { giveBoost(c, 1); c.say(); } },
  },

  edge_golem: {
    enter: (c) => { if (once(c, 'start')) addStat(c.self, 'agi', -2); },
    turnStart: (c) => defWhileLow(c, 3), hurt: (c) => defWhileLow(c, 3), turnEnd: (c) => defWhileLow(c, 3),
  },

  // Nothing misses in the game. Mirror Reflect's Ward is its reflection, so an enemy move that hits it while Warded counts.
  void_marrow: { hurt: (c, info) => { if (!info.basic && c.mine && hasStatus(c.self, Status.Ward)) { giveBoost(c, 1); c.say(); } } },

  heart_stone: {
    status: (c, s) => { if (s === Status.Stun) { c.say(); return false; } },
    turnStart: (c) => defWhileLow(c, 2), hurt: (c) => defWhileLow(c, 2), turnEnd: (c) => defWhileLow(c, 2),
  },

  // The first 2 turns are the turn it first comes in and the one after.
  heart_fire: {
    enter: (c) => {
      if (!once(c, 'start')) return;
      addStatus(c, c.self, Status.Haste);
      addStat(c.self, 'atk', 2);
      c.mem.until = c.state.turn + 1;
    },
    turnEnd: (c) => heatEnds(c),
    reserve: (c) => heatEnds(c),
  },

  heart_golem: {
    enter: (c) => { if (once(c, 'start')) addStat(c.self, 'agi', -2); },
    turnStart: (c) => defWhileLow(c, 3), hurt: (c) => defWhileLow(c, 3), turnEnd: (c) => defWhileLow(c, 3),
  },

  // The 5 extra max HP come with 5 HP.
  kiln_golem: { enter: (c) => { if (once(c, 'start')) { c.self.maxHp += 5; c.self.hp += 5; c.say(); } } },

  // Dregs species, areas 15 to 20.
  slag_mite: { hit: (c) => { if (chance(c, 'drip', 100 / 3)) harm(c, c.foe, 2); } },

  weep_wisp: { hit: (c) => { if (chance(c, 'silence', 25)) addStatus(c, c.foe, Status.Silence, 1); } },

  // Each hit takes 2 flat DEF from the foe until the end of the next turn.
  rust_fungus: {
    hit: (c) => {
      const n = Math.min(2, c.foe.currentStats.def - 1);
      if (c.foe.isFainted || n <= 0) return;
      c.foe.currentStats.def -= n;
      (c.mem.drops ??= []).push({ r: c.foe, n, until: c.state.turn + 1 });
      c.say();
    },
    turnEnd: (c) => giveDefBack(c, false),
    reserve: (c) => giveDefBack(c, false),
    fainted: (c) => giveDefBack(c, true),
  },

  // A dodge does no damage and brings no harmful status that turn. Physical attacks strike with ATK against DEF.
  ash_shard: {
    damageIn: (c, move, basic) => (c.team[0] === c.self && !magic(c.foe, move, basic) && peek(c, 'dodge', 100 / 3) ? 0 : 1),
    hurt: (c, info) => { if (!magic(c.foe, info.move, info.basic) && chance(c, 'dodge', 100 / 3)) dodged(c); },
    status: (c, s) => dodging(c, s),
  },

  // Allies are its standing teammates, reserves included, so it mends only while it stands alone.
  dreg_mold: { turnEnd: (c) => { if (standing(c.team).length === 1) heal(c, c.self, 3); } },

  weep_worm: { hit: (c) => sap(c, 'res', 3, 50) },

  // A move that deals damage can hit its user: the user takes that move's damage and harmful status in its place.
  damp_whisper: {
    damageIn: (c, _move, basic) => (!basic && c.team[0] === c.self && peek(c, 'trap', 100 / 3) ? 0 : 1),
    hurt: (c, info) => {
      if (info.basic || !chance(c, 'trap', 100 / 3)) return;
      c.mem.trap = info.move.status;
      const n = calculateDamage(c.state, c.foe, c.foe, info.move, false).damage;
      if (n) harm(c, c.foe, n); else c.say();
    },
    status: (c, s) => {
      if (s !== c.mem.trap || !isHarmful(s)) return;
      c.mem.trap = undefined;
      addStatus(c, c.foe, s);
      return false;
    },
    foeActed: (c) => { c.mem.trap = undefined; },
    turnEnd: (c) => { c.mem.trap = undefined; },
  },

  // Light moves are Aether moves, as Light is Aether for basalt_cyst.
  blind_coral: {
    damageIn: (c, move, basic) => (!basic && move.type === 'Aether' && c.team[0] === c.self && peek(c, 'light', 200 / 3) ? 0 : 1),
    hurt: (c, info) => { if (!info.basic && info.move.type === 'Aether' && chance(c, 'light', 200 / 3)) c.say(); },
  },

  // The first attack of a turn is the first hit it takes that turn. A dodge does no damage and brings no harmful status that turn.
  vibration_shroom: {
    damageIn: (c) => (c.team[0] === c.self && c.mem.turn !== c.state.turn && peek(c, 'dodge', 50) ? 0 : 1),
    hurt: (c) => { if (c.mem.turn !== c.state.turn) { c.mem.turn = c.state.turn; if (chance(c, 'dodge', 50)) dodged(c); } },
    status: (c, s) => dodging(c, s),
  },

  slag_urn: { hurt: (c) => { if (chance(c, 'leak', 100 / 3)) heal(c, c.self, 5); } },

  glass_moth: {
    hurt: (c, info) => { if (info.damage > 0 && magic(c.foe, info.move, info.basic) && chance(c, 'reflect', 50)) harm(c, c.foe, info.damage * 0.5); },
  },

  // Shard is the player: a player's holder doubles its own moves, and an opponent doubles while the Ruin it faces last used a move.
  trench_leviathan: {
    damageOut: (c, move, basic) => double(c, move, c.mine ? !basic : !!c.mem.moved, 50),
    hit: (c, info) => doubled(c, info.move, c.mine ? !info.basic : !!c.mem.moved, 50),
    foeActed: (c, _move, basic) => { c.mem.moved = !basic; c.mem.acted = c.state.turn; },
    turnEnd: (c) => { if (c.mem.acted !== c.state.turn) c.mem.moved = false; },
  },

  // Skipping its turn is a Stun of its own that takes its action, gone at the turn's end if it took none.
  time_tick: {
    turnStart: (c) => {
      if (!chance(c, 'skip', 20)) return;
      if (!hasStatus(c.self, Status.Stun)) c.self.statuses.push((c.mem.skip = { status: Status.Stun, turnsLeft: 1 }));
      if (!heal(c, c.self, 5)) c.say();
    },
    turnEnd: (c) => skipEnds(c),
    reserve: (c) => skipEnds(c),
  },

  // Tiles are places in team order, as adjacency is for slag_vent.
  gravity_well: { turnEnd: (c) => { if (chance(c, 'pull', 10)) pull(c); } },

  // At the start of its next turn it uses the move that hit it, as an extra hit at 1.5 times the move's power.
  echo_shard: {
    hurt: (c, info) => { c.mem.echo = { move: info.move, basic: info.basic, turn: c.state.turn }; },
    turnStart: (c) => {
      const e = c.mem.echo;
      c.mem.echo = undefined;
      if (!e || e.turn !== c.state.turn - 1 || c.foe.isFainted) return;
      const n = calculateDamage(c.state, c.self, c.foe, { ...e.move, power: e.move.power * 1.5 }, e.basic).damage;
      if (n) harm(c, c.foe, n);
    },
  },

  void_leak: { turnEnd: (c) => { if (!c.foe.isFainted && chance(c, 'drain', 15)) { addStat(c.foe, 'atk', -1); c.say(); } } },

  // The fire is a Burn for 2 turns that takes 5 HP a turn in place of Burn's usual share of max HP.
  ash_wisp_2: {
    hit: (c) => { if (chance(c, 'fire', 10) && addStatus(c, c.foe, Status.Burn, 2)) c.mem.fire = c.foe.statuses.find((s) => s.status === Status.Burn); },
    foeTick: (c, held, n) => (held === c.mem.fire ? 5 : n),
  },

  corrupt_vessel: {
    enter: (c) => { if (once(c, 'start') && c.self.hp > 1) { c.self.hp = 1; c.say(); } },
    turnEnd: (c) => { heal(c, c.self, 5); },
  },

  // Resisting is the type chart's 0.67 for a weak matchup.
  slag_warden: {
    hurt: (c, info) => { if (hitType(c.foe, info.move, info.basic) === 'Fire') heal(c, c.self, 3); },
    damageIn: (c, move, basic) => (hitType(c.foe, move, basic) === 'Fire' ? 0.67 : 1),
  },

  // The second attack deals the first one's damage again to the same foe.
  ember_mite: { hit: (c, info) => { if (chance(c, 'swarm', 20) && info.damage > 0) harm(c, c.foe, info.damage); } },

  obsidian_shard: {
    damageOut: (c, move, basic) => double(c, move, !basic, 10),
    hit: (c, info) => doubled(c, info.move, !info.basic, 10),
  },

  // Terrain is the battle's Field State, so the Field States that take HP take none from it.
  cinder_wisp: { speed: () => 1.5, fieldDamage: () => 0 },

  // A Burn on the foe it faces takes 5 HP a turn in place of Burn's usual share of max HP.
  pyre_beetle: {
    hit: (c) => { addStatus(c, c.foe, Status.Burn); },
    foeTick: (c, held, n) => (held.status === Status.Burn && c.team[0] === c.self ? 5 : n),
  },

  // Frozen foes are ones that cannot act (Stunned or Asleep), and the extra damage is a strong matchup's x1.5.
  fire_weep: {
    turnEnd: (c) => { heal(c, c.self, 5); },
    damageOut: (c) => (hasStatus(c.foe, Status.Stun) || hasStatus(c.foe, Status.Sleep) ? 1.5 : 1),
  },

  // On hit is when it is struck. It splits its HP with a copy of itself, which waits at the end of its team.
  prism_wisp: { hurt: (c) => { if (chance(c, 'split', 50)) split(c); } },

  // The foe it hits loses 2 flat DEF at the end of that turn and of each of the next 2, and a new hit starts the count over.
  silica_mite: { hit: (c) => { c.mem.erode = { r: c.foe, left: 3 }; }, turnEnd: (c) => erode(c), reserve: (c) => erode(c) },

  // Shard is the player, so it acts for an opponent: it learns each move the player's Ruin uses into an extra slot, at half power.
  mirror_stalker: {
    foeActed: (c, move, basic) => { if (!c.mine && !basic) learn(c, move); },
    damageOut: (c, move, basic) => (!basic && move === c.mem.slot?.data ? 0.5 : 1),
  },

  // Adjacent targets are the foe it faces and its neighbors in team order.
  fracture_crab: {
    fainted: (c) => {
      const i = c.team.indexOf(c.self);
      for (const r of [c.foes[0], c.team[i - 1], c.team[i + 1]]) if (r && !r.isFainted) harm(c, r, 10);
    },
  },

  // Shard is the player, and its buffs are the helpful statuses on the player's fighting Ruin.
  vein_glass: { turnEnd: (c) => { if (!c.state.playerTeam[0].statuses.some((s) => s.turnsLeft > 0 && !isHarmful(s.status))) heal(c, c.self, 2); } },

  // A dodge does no damage and brings no harmful status that turn. The damage an attack would deal is measured without the dodge.
  abyssal_mirror: {
    damageIn: (c, move, basic) => {
      if (c.mem.measuring || c.team[0] !== c.self) return 1;
      c.mem.measuring = true;
      try { c.mem.small = calculateDamage(c.state, c.foe, c.self, move, basic).damage < 15; } finally { c.mem.measuring = false; }
      return c.mem.small && peek(c, 'dodge', 50) ? 0 : 1;
    },
    hurt: (c) => { if (c.mem.small && chance(c, 'dodge', 50)) dodged(c); c.mem.small = false; },
    status: (c, s) => dodging(c, s),
  },

  dreg_spore: { hit: (c) => sap(c, 'agi', 2, 100 / 3) },

  glass_mite: { turnEnd: (c) => { if (chance(c, 'trail', 50)) harm(c, c.foe, 1); } },

  ash_crawler: { hit: (c) => sap(c, 'atk', 2, 100 / 3) },

  void_moth: { hit: (c) => sap(c, 'mgk', 2, 25) },

  rust_worm: { hit: (c) => sap(c, 'def', 1, 50) },

  weep_matriarch: { turnEnd: (c) => decay(c), reserve: (c) => decay(c) },
};
