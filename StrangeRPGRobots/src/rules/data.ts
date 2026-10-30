// Rules data: attributes, skills, classes, abilities, items, and enemy templates. Descriptions are plain
// English a child could follow.

export type Attr = 'body' | 'reflex' | 'wits' | 'nerve';
export type Skill = 'shoot' | 'strike' | 'hack' | 'tech' | 'sneak' | 'talk' | 'notice' | 'athletics';
export type ClassId = 'blade' | 'diver' | 'rigger' | 'mouth' | 'unit' | 'witch' | 'enemy';
export type DType = 'kinetic' | 'shock' | 'fire' | 'hack';
export type Cost = 'action' | 'bonus' | 'reaction' | 'free';
export type Feeling = 'anger' | 'fear' | 'calm' | 'joy' | 'grief' | 'longing';

export const SKILL_ATTR: Record<Skill, Attr> = {
  shoot: 'reflex', strike: 'body', hack: 'wits', tech: 'wits', sneak: 'reflex', talk: 'nerve', notice: 'wits', athletics: 'body',
};
export const SKILL_NAME: Record<Skill, string> = {
  shoot: 'Shoot', strike: 'Strike', hack: 'Hack', tech: 'Tech', sneak: 'Sneak', talk: 'Talk', notice: 'Notice', athletics: 'Athletics',
};
export const ATTR_NAME: Record<Attr, string> = { body: 'Body', reflex: 'Reflex', wits: 'Wits', nerve: 'Nerve' };
export const SKILLS: Skill[] = ['shoot', 'strike', 'hack', 'tech', 'sneak', 'talk', 'notice', 'athletics'];
export const ATTRS: Attr[] = ['body', 'reflex', 'wits', 'nerve'];

export interface StatusDef { id: string; name: string; desc: string; good?: boolean }
export const STATUSES: Record<string, StatusDef> = {
  stunned: { id: 'stunned', name: 'Stunned', desc: 'Loses its action this turn.' },
  prone: { id: 'prone', name: 'Prone', desc: 'Movement reduced by half. Melee attacks hit it more often.' },
  blinded: { id: 'blinded', name: 'Blinded', desc: 'Attacks miss more frequently.' },
  burning: { id: 'burning', name: 'Burning', desc: 'Takes 3 damage per turn.' },
  wet: { id: 'wet', name: 'Wet', desc: 'Shock is more painful. It cannot cause burns.' },
  shocked: { id: 'shocked', name: 'Shocked', desc: 'Cannot take reactions.' },
  marked: { id: 'marked', name: 'Marked', desc: 'Easier to hit.' },
  taunted: { id: 'taunted', name: 'Taunted', desc: 'Must attack the source of the taunt.' },
  distracted: { id: 'distracted', name: 'Distracted', desc: 'Attacks miss more frequently. Cannot react.' },
  immobile: { id: 'immobile', name: 'Stuck', desc: 'Unable to move.' },
  hushed: { id: 'hushed', name: 'Hushed', desc: 'Woken things slumber and skip their turns.' },
  hidden: { id: 'hidden', name: 'Hidden', desc: 'Invisible to enemies.', good: true },
  guarded: { id: 'guarded', name: 'Guarded', desc: 'An ally intercepts the next attack.', good: true },
  rallied: { id: 'rallied', name: 'Rallied', desc: 'The next attack is more accurate.', good: true },
  overclocked: { id: 'overclocked', name: 'Overclocked', desc: 'Grants an additional action.', good: true },
  bulwark: { id: 'bulwark', name: 'Bulwark', desc: 'Difficult to hit. Allies positioned behind it gain full cover.', good: true },
  overwatch: { id: 'overwatch', name: 'Overwatch', desc: 'Fires at the first enemy that moves within sight.', good: true },
  turncoat: { id: 'turncoat', name: 'Turned', desc: "Opposes the player's side for the duration." },
  crippled: { id: 'crippled', name: 'Crippled', desc: 'Incapable of movement.' },
  slowed: { id: 'slowed', name: 'Slowed', desc: 'Movement speed is reduced by half.' },
};

export interface AbilityDef {
  id: string;
  name: string;
  cls: ClassId | 'any' | 'port';
  cost: Cost;
  /** Range in tiles. 1 is melee. 0 is self. */
  range: number;
  target: 'enemy' | 'ally' | 'self' | 'tile' | 'prop' | 'unit' | 'downed';
  /** Area radius in tiles around the target point. */
  area?: number;
  /** Uses per short rest, long rest, or fight. */
  uses?: { per: 'short' | 'long' | 'fight'; n: number };
  ram?: number;
  /** HP the user pays (Tova's blood). */
  blood?: number;
  dmg?: [number, number];
  dtype?: DType;
  /** How it hits: 'attack' rolls against Defense, 'auto' always lands, 'resist' lets the target resist with an attribute. */
  hit?: 'attack' | 'auto' | 'resist';
  resist?: Attr;
  status?: { id: string; turns: number; chance?: number };
  /** Ignores line of sight blockers that are not walls (hacks travel through the network). */
  network?: boolean;
  /** Machines and chromed targets only. */
  chromeOnly?: boolean;
  icon: string;
  desc: string;
  /** Level at which the class gets it. */
  level?: number;
}

export const ABILITIES: AbilityDef[] = [
  // Everyone
  { id: 'attack', name: 'Attack', cls: 'any', cost: 'action', range: 0, target: 'enemy', hit: 'attack', icon: 'attack', desc: 'Strike with your weapon. Melee your target if you are adjacent, or shoot from a distance.' },
  { id: 'shove', name: 'Shove', cls: 'any', cost: 'bonus', range: 1, target: 'unit', icon: 'shove', desc: 'Push an adjacent target one tile away. Doing so into water, off a ledge, or into fireworks is particularly effective.' },
  { id: 'jump', name: 'Jump', cls: 'any', cost: 'bonus', range: 3, target: 'tile', icon: 'jump', desc: 'Leap to a tile up to 3 spaces away, crossing gaps or ascending one level. Costs 2 movement.' },
  { id: 'dash', name: 'Dash', cls: 'any', cost: 'action', range: 0, target: 'self', icon: 'dash', desc: 'Spend your action to move twice your normal distance.' },
  { id: 'help', name: 'Help', cls: 'any', cost: 'action', range: 1, target: 'downed', icon: 'help', desc: 'Stand a downed ally back up.' },
  { id: 'overwatch', name: 'Overwatch', cls: 'any', cost: 'action', range: 0, target: 'self', icon: 'watch', desc: 'Wait and shoot the first enemy that moves into your line of sight.' },
  { id: 'hide', name: 'Hide', cls: 'any', cost: 'bonus', range: 0, target: 'self', icon: 'hide', desc: 'Conceal yourself when no enemies are watching. Attacks launched from stealth deal extra damage.' },
  { id: 'item', name: 'Item', cls: 'any', cost: 'action', range: 0, target: 'self', icon: 'item', desc: 'Use a stim, throw a grenade, or shatter a vial.' },

  // Blade
  { id: 'lunge', name: 'Lunge', cls: 'blade', level: 1, cost: 'action', range: 4, target: 'enemy', hit: 'attack', icon: 'lunge', desc: 'Dash up to 4 tiles in a straight line and strike. You cannot be counter-attacked.' },
  { id: 'riposte', name: 'Riposte', cls: 'blade', level: 1, cost: 'reaction', range: 1, target: 'enemy', icon: 'riposte', desc: 'Counter-attack immediately after a melee miss.' },
  { id: 'adrenal', name: 'Adrenal', cls: 'blade', level: 2, cost: 'bonus', range: 0, target: 'self', uses: { per: 'short', n: 1 }, icon: 'adrenal', desc: 'Restore one-third of your maximum HP.' },
  { id: 'overclock', name: 'Overclock', cls: 'blade', level: 3, cost: 'free', range: 0, target: 'self', uses: { per: 'short', n: 1 }, icon: 'overclock', desc: 'Gain an additional action this turn.' },
  { id: 'cleave', name: 'Cleave', cls: 'blade', level: 5, cost: 'action', range: 1, target: 'self', hit: 'attack', icon: 'cleave', desc: 'Swing at all adjacent enemies.' },
  { id: 'execute', name: 'Execute', cls: 'blade', level: 7, cost: 'action', range: 1, target: 'enemy', hit: 'attack', icon: 'execute', desc: 'A melee attack that deals double damage to enemies below one-third health.' },
  { id: 'blur', name: 'Blur', cls: 'blade', level: 9, cost: 'action', range: 6, target: 'tile', uses: { per: 'long', n: 1 }, icon: 'blur', desc: 'Dash up to 6 tiles, striking every enemy in your path.' },

  // Diver
  { id: 'shortcircuit', name: 'Short Circuit', cls: 'diver', level: 1, cost: 'action', range: 8, target: 'enemy', hit: 'auto', ram: 2, dmg: [4, 7], dtype: 'shock', network: true, chromeOnly: true, icon: 'shock', desc: 'Shock a robot or anyone with chrome. It never misses and ignores cover. Costs 2 RAM.' },
  { id: 'blind', name: 'Blind', cls: 'diver', level: 1, cost: 'bonus', range: 8, target: 'enemy', hit: 'resist', resist: 'wits', ram: 2, status: { id: 'blinded', turns: 2 }, network: true, chromeOnly: true, icon: 'blind', desc: "Scramble a target's optical cybernetics, causing them to miss more often for 2 turns. Costs 2 RAM." },
  { id: 'ping', name: 'Ping', cls: 'diver', level: 2, cost: 'bonus', range: 0, target: 'self', ram: 1, icon: 'ping', desc: 'Detect and mark all nearby hidden enemies and network devices. Costs 1 RAM.' },
  { id: 'hijack', name: 'Hijack', cls: 'diver', level: 3, cost: 'action', range: 8, target: 'prop', ram: 4, network: true, icon: 'hijack', desc: 'Take control of a turret, camera, vehicle, or drone for 3 turns. Costs 4 RAM.' },
  { id: 'cripple', name: 'Cripple', cls: 'diver', level: 5, cost: 'action', range: 8, target: 'enemy', hit: 'resist', resist: 'body', ram: 3, status: { id: 'crippled', turns: 2 }, network: true, chromeOnly: true, icon: 'cripple', desc: "Paralyze a target's leg chrome, preventing movement for 2 turns. Costs 3 RAM." },
  { id: 'overheat', name: 'Overheat', cls: 'diver', level: 7, cost: 'action', range: 8, target: 'enemy', hit: 'auto', ram: 5, dmg: [3, 5], dtype: 'fire', status: { id: 'burning', turns: 3 }, network: true, chromeOnly: true, icon: 'fire', desc: "Ignite a target's chrome, dealing damage for 3 turns. Costs 5 RAM." },
  { id: 'cascade', name: 'Cascade', cls: 'diver', level: 9, cost: 'action', range: 8, target: 'enemy', hit: 'auto', ram: 8, dmg: [4, 7], dtype: 'shock', network: true, chromeOnly: true, icon: 'cascade', desc: 'A Short Circuit that jumps to up to 3 additional targets. Costs 8 RAM.' },

  // Rigger
  { id: 'tag', name: 'Tag', cls: 'rigger', level: 1, cost: 'bonus', range: 9, target: 'enemy', hit: 'auto', status: { id: 'marked', turns: 3 }, icon: 'tag', desc: 'Mark a target with your drone. Allies deal increased damage to it for 3 turns.' },
  { id: 'patch', name: 'Patch', cls: 'rigger', level: 1, cost: 'action', range: 6, target: 'ally', uses: { per: 'short', n: 2 }, icon: 'patch', desc: 'Your drone flies to an ally and heals them for 6 to 9 HP.' },
  { id: 'smoke', name: 'Smoke', cls: 'rigger', level: 2, cost: 'action', range: 6, target: 'tile', area: 1, uses: { per: 'short', n: 1 }, icon: 'smoke', desc: 'Your drone releases smoke that blocks vision for 2 turns.' },
  { id: 'turret', name: 'Turret', cls: 'rigger', level: 3, cost: 'action', range: 2, target: 'tile', uses: { per: 'short', n: 1 }, icon: 'turret', desc: 'Deploy a turret that targets the nearest enemy each turn.' },
  { id: 'overcharge', name: 'Overcharge', cls: 'rigger', level: 5, cost: 'bonus', range: 0, target: 'self', uses: { per: 'short', n: 1 }, icon: 'overcharge', desc: 'Your drone takes an extra action this turn.' },
  { id: 'shockfield', name: 'Shock Field', cls: 'rigger', level: 7, cost: 'action', range: 6, target: 'tile', area: 1, dmg: [4, 7], dtype: 'shock', hit: 'auto', uses: { per: 'short', n: 1 }, icon: 'shock', desc: 'Electrify the ground, keeping water conductive for 2 turns.' },
  { id: 'kamikaze', name: 'Kamikaze', cls: 'rigger', level: 9, cost: 'action', range: 8, target: 'tile', area: 2, dmg: [10, 16], dtype: 'fire', hit: 'auto', uses: { per: 'long', n: 1 }, icon: 'boom', desc: 'Pilot your drone into an enemy to detonate. It repairs itself after the battle.' },

  // Mouth
  { id: 'taunt', name: 'Taunt', cls: 'mouth', level: 1, cost: 'bonus', range: 6, target: 'enemy', hit: 'resist', resist: 'nerve', status: { id: 'taunted', turns: 1 }, icon: 'taunt', desc: 'Force an enemy to target you next turn, granting you increased evasion until then.' },
  { id: 'fasttalk', name: 'Fast Talk', cls: 'mouth', level: 1, cost: 'action', range: 6, target: 'enemy', hit: 'resist', resist: 'nerve', status: { id: 'stunned', turns: 1 }, icon: 'talk', desc: 'Speak so rapidly that the target forgets to act on their next turn. Ineffective against machines.' },
  { id: 'rally', name: 'Rally', cls: 'mouth', level: 2, cost: 'bonus', range: 6, target: 'ally', uses: { per: 'short', n: 2 }, icon: 'rally', desc: 'Encourage an ally to heal 4, 6 HP and improve the accuracy of their next attack.' },
  { id: 'turncoat', name: 'Turncoat', cls: 'mouth', level: 3, cost: 'action', range: 6, target: 'enemy', hit: 'resist', resist: 'nerve', status: { id: 'turncoat', turns: 2 }, uses: { per: 'long', n: 1 }, icon: 'turncoat', desc: 'Persuade an enemy to fight for you for 2 turns. Ineffective against machines.' },
  { id: 'cheapshot', name: 'Cheap Shot', cls: 'mouth', level: 5, cost: 'action', range: 0, target: 'enemy', hit: 'attack', icon: 'cheap', desc: 'Deal 50% more damage to targets that are stunned, taunted, or distracted.' },
  { id: 'demoralize', name: 'Demoralize', cls: 'mouth', level: 7, cost: 'action', range: 0, target: 'self', area: 3, hit: 'resist', resist: 'nerve', status: { id: 'distracted', turns: 2 }, uses: { per: 'short', n: 1 }, icon: 'demoralize', desc: 'Cause all enemies within 3 tiles to miss more frequently for 2 turns. Weak enemies may flee.' },
  { id: 'speech', name: 'Speech', cls: 'mouth', level: 9, cost: 'action', range: 0, target: 'self', uses: { per: 'long', n: 1 }, icon: 'speech', desc: 'Grant all allies an extra bonus action and heal them for 6 HP.' },

  // Unit (Courtesy)
  { id: 'guard', name: 'Guard', cls: 'unit', level: 1, cost: 'bonus', range: 1, target: 'ally', status: { id: 'guarded', turns: 1 }, icon: 'guard', desc: 'Stand next to an ally. The next attack targeting them hits you instead.' },
  { id: 'taser', name: 'Taser', cls: 'unit', level: 1, cost: 'action', range: 1, target: 'enemy', hit: 'attack', dmg: [3, 6], dtype: 'shock', status: { id: 'stunned', turns: 1, chance: 0.35 }, icon: 'shock', desc: 'Shock an adjacent enemy. This may stun them.' },
  { id: 'remaincalm', name: 'Remain Calm', cls: 'unit', level: 2, cost: 'action', range: 0, target: 'self', area: 3, hit: 'resist', resist: 'nerve', status: { id: 'taunted', turns: 1 }, uses: { per: 'short', n: 1 }, icon: 'taunt', desc: 'All enemies within 3 tiles must attack Courtesy next turn.' },
  { id: 'charge', name: 'Charge', cls: 'unit', level: 3, cost: 'action', range: 4, target: 'enemy', hit: 'attack', dmg: [4, 7], icon: 'charge', desc: 'Rush forward in a straight line, knocking an enemy back 2 tiles.' },
  { id: 'foam', name: 'Riot Foam', cls: 'unit', level: 5, cost: 'action', range: 5, target: 'tile', area: 1, hit: 'auto', status: { id: 'immobile', turns: 1 }, uses: { per: 'short', n: 1 }, icon: 'foam', desc: 'Spray foam. Anyone caught in it is immobilized next turn.' },
  { id: 'bulwark', name: 'Bulwark', cls: 'unit', level: 7, cost: 'action', range: 0, target: 'self', status: { id: 'bulwark', turns: 1 }, icon: 'bulwark', desc: 'Plant your shield. You become harder to hit, and allies behind you gain full cover.' },
  { id: 'lockdown', name: 'Lockdown', cls: 'unit', level: 9, cost: 'action', range: 0, target: 'self', area: 2, hit: 'auto', status: { id: 'stunned', turns: 1 }, uses: { per: 'long', n: 1 }, icon: 'lockdown', desc: 'Stun all enemies within a 2-tile radius.' },

  // Witch (Tova)
  { id: 'wake', name: 'Wake', cls: 'witch', level: 1, cost: 'action', range: 5, target: 'prop', blood: 3, icon: 'wake', desc: 'Bleed on an object within 5 tiles. It wakes for 3 turns, influenced by your mood.' },
  { id: 'steady', name: 'Steady', cls: 'witch', level: 1, cost: 'bonus', range: 0, target: 'self', icon: 'steady', desc: 'Breathe. Your mood settles.' },
  { id: 'splash', name: 'Splash', cls: 'witch', level: 2, cost: 'action', range: 5, target: 'tile', area: 1, blood: 5, icon: 'splash', desc: 'Throw blood over a 3x3 area. All objects in the zone wake for 2 turns.' },
  { id: 'rouse', name: 'Rouse Chrome', cls: 'witch', level: 3, cost: 'action', range: 5, target: 'enemy', blood: 4, hit: 'resist', resist: 'nerve', chromeOnly: true, icon: 'rouse', desc: "Wake an enemy's chrome. Its behavior depends on your mood." },
  { id: 'longwake', name: 'Long Wake', cls: 'witch', level: 5, cost: 'free', range: 0, target: 'self', icon: 'wake', desc: 'All your wakes last 2 turns longer.' },
  { id: 'redrain', name: 'Red Rain', cls: 'witch', level: 7, cost: 'action', range: 0, target: 'self', area: 4, blood: 8, uses: { per: 'long', n: 1 }, icon: 'splash', desc: 'All objects within 4 tiles wake up.' },
  { id: 'heartfelt', name: 'Heartfelt', cls: 'witch', level: 9, cost: 'bonus', range: 0, target: 'self', uses: { per: 'long', n: 1 }, icon: 'heart', desc: 'Your next wake lasts the entire fight and acts twice per turn.' },

  // The port
  { id: 'reflexstep', name: 'Reflex Step', cls: 'port', cost: 'reaction', range: 0, target: 'self', icon: 'port', desc: 'When an attack would hit you, your port steps you aside. The port gains Hold.' },
  { id: 'secondhands', name: 'Second Hands', cls: 'port', cost: 'free', range: 0, target: 'self', uses: { per: 'fight', n: 1 }, icon: 'port', desc: 'Your port takes control of your body, granting one additional action. The port gains Hold.' },
  { id: 'call', name: 'Call', cls: 'port', cost: 'bonus', range: 0, target: 'self', uses: { per: 'fight', n: 1 }, icon: 'port', desc: 'Your port calls out to creatures awakened by Line 1. Courtesy gains an extra action.' },

  // Enemy specials
  { id: 'hushthrow', name: 'Hush', cls: 'enemy', cost: 'action', range: 5, target: 'unit', icon: 'hush', desc: 'Throws Hush. Woken creatures fall asleep.' },
  { id: 'redvial', name: 'Red Vial', cls: 'enemy', cost: 'action', range: 5, target: 'prop', icon: 'wake', desc: 'Hurls a vial of angry blood at a target.' },
  { id: 'heal', name: 'Patch Up', cls: 'enemy', cost: 'action', range: 5, target: 'ally', icon: 'patch', desc: 'Restores health to an ally.' },
  { id: 'enemyhack', name: 'Spike', cls: 'enemy', cost: 'action', range: 8, target: 'enemy', hit: 'auto', dmg: [3, 6], dtype: 'shock', network: true, chromeOnly: true, icon: 'shock', desc: 'Sends a shock of chrome through the network.' },
  { id: 'bite', name: 'Bite', cls: 'enemy', cost: 'action', range: 1, target: 'enemy', hit: 'attack', dmg: [5, 9], icon: 'attack', desc: 'Deploys chrome jaws to strike.' },
  { id: 'grenade', name: 'Grenade', cls: 'enemy', cost: 'action', range: 6, target: 'tile', area: 1, dmg: [5, 8], hit: 'auto', uses: { per: 'fight', n: 1 }, icon: 'boom', desc: 'Tosses a grenade.' },
  { id: 'tea', name: 'Tea', cls: 'enemy', cost: 'action', range: 0, target: 'self', icon: 'patch', uses: { per: 'fight', n: 2 }, desc: 'Mother Sieve pours herself a cup and heals.' },
];

export const ABILITY = new Map<string, AbilityDef>(ABILITIES.map((a) => [a.id, a]));

export interface ClassDef {
  id: ClassId;
  name: string;
  desc: string;
  attr: Record<Attr, number>;
  skills: Partial<Record<Skill, number>>;
  /** Ability ids by level. */
  abilities: string[];
  perks: string[][];
  gear: { melee?: string; ranged?: string; armor?: string; chrome?: string[] };
}

export const CLASSES: Record<Exclude<ClassId, 'enemy'>, ClassDef> = {
  blade: {
    id: 'blade', name: 'Blade', desc: 'Street samurai. Chrome reflexes, a blade, and a gun. Hits hard up close and keeps standing.',
    attr: { body: 5, reflex: 4, wits: 2, nerve: 3 }, skills: { strike: 3, shoot: 2, athletics: 2 },
    abilities: ['lunge', 'riposte', 'adrenal', 'overclock', 'cleave', 'execute', 'blur'],
    perks: [['tough', 'quick', 'brawler'], ['steady_aim', 'iron_skin', 'momentum'], ['reaper', 'bodyguard', 'second_wind'], ['legend', 'unbroken', 'whirlwind']],
    gear: { melee: 'machete', ranged: 'pistol', armor: 'jacket', chrome: ['reflexwire'] },
  },
  diver: {
    id: 'diver', name: 'Diver', desc: 'A netrunner who can hack both people and machines from a distance. She is powerful remotely but fragile in close combat.',
    attr: { body: 2, reflex: 3, wits: 5, nerve: 4 }, skills: { hack: 3, tech: 2, notice: 2 },
    abilities: ['shortcircuit', 'blind', 'ping', 'hijack', 'cripple', 'overheat', 'cascade'],
    perks: [['big_ram', 'fast_ram', 'firewall'], ['backdoor', 'feedback', 'ghost'], ['daisy', 'overload', 'deep_dive'], ['root', 'no_trace', 'storm']],
    gear: { melee: 'knuckles', ranged: 'pistol', armor: 'raincoat', chrome: ['deck'] },
  },
  rigger: {
    id: 'rigger', name: 'Rigger', desc: 'A drone pilot whose flying drone acts on your turn to scout, mark targets, heal, and shoot.',
    attr: { body: 3, reflex: 4, wits: 4, nerve: 3 }, skills: { tech: 3, shoot: 2, notice: 2 },
    abilities: ['tag', 'patch', 'smoke', 'turret', 'overcharge', 'shockfield', 'kamikaze'],
    perks: [['armored_drone', 'quick_drone', 'medic'], ['spotter', 'twin_turret', 'scrapper'], ['hunter', 'field_medic', 'swarm'], ['ace', 'fortress', 'overdrive']],
    gear: { melee: 'pipe', ranged: 'smg', armor: 'jacket', chrome: ['controljack'] },
  },
  mouth: {
    id: 'mouth', name: 'Mouth', desc: 'A face who talks people out of fights and into making mistakes. Excels at social checks.',
    attr: { body: 3, reflex: 3, wits: 3, nerve: 5 }, skills: { talk: 3, notice: 2, sneak: 2 },
    abilities: ['taunt', 'fasttalk', 'rally', 'turncoat', 'cheapshot', 'demoralize', 'speech'],
    perks: [['silver', 'liar', 'charmer'], ['dirty', 'inspire', 'read_room'], ['kingmaker', 'menace', 'lucky'], ['legend_mouth', 'saint', 'crowd']],
    gear: { melee: 'knuckles', ranged: 'revolver', armor: 'coat', chrome: ['voicebox'] },
  },
  unit: {
    id: 'unit', name: 'Unit', desc: 'A riot robot that absorbs damage meant for others, shocks enemies, and pins them in place.',
    attr: { body: 6, reflex: 2, wits: 2, nerve: 4 }, skills: { strike: 3, athletics: 3, notice: 1 },
    abilities: ['guard', 'taser', 'remaincalm', 'charge', 'foam', 'bulwark', 'lockdown'],
    perks: [['plating', 'heavy', 'sentinel'], ['shock_fist', 'wall', 'spotlight'], ['juggernaut', 'shepherd', 'repair'], ['fortress_unit', 'guardian', 'calm_voice']],
    gear: { armor: 'plating' },
  },
  witch: {
    id: 'witch', name: 'Witch', desc: 'Awakens objects with her own blood, with their behavior dictated by her mood. Cannot carry chrome.',
    attr: { body: 3, reflex: 4, wits: 3, nerve: 4 }, skills: { sneak: 3, talk: 2, athletics: 2 },
    abilities: ['wake', 'steady', 'splash', 'rouse', 'longwake', 'redrain', 'heartfelt'],
    perks: [['thick_blood', 'quick_hands', 'temper'], ['deep_cut', 'hardy', 'wild'], ['old_feeling', 'kind', 'fury'], ['saint_blood', 'many', 'storm_blood']],
    gear: { melee: 'knife', ranged: 'slingshot', armor: 'poncho' },
  },
};

export const ABILITY_LEVELS = [1, 1, 2, 3, 5, 7, 9];
export const PERK_LEVELS = [4, 6, 8, 10];
export const ATTR_LEVELS = [4, 8];
export const XP_TO = [0, 0, 300, 800, 1600, 2800, 4400, 6400, 8800, 11600, 15000];

export interface PerkDef { id: string; name: string; desc: string }
export const PERKS: Record<string, PerkDef> = {
  tough: { id: 'tough', name: 'Tough', desc: 'Grants +8 HP.' },
  quick: { id: 'quick', name: 'Quick', desc: 'Grants +1 movement.' },
  brawler: { id: 'brawler', name: 'Brawler', desc: 'Melee attacks deal 2 additional damage.' },
  steady_aim: { id: 'steady_aim', name: 'Steady Aim', desc: 'Guns have a higher chance to hit.' },
  iron_skin: { id: 'iron_skin', name: 'Iron Skin', desc: 'Grants +1 Defense.' },
  momentum: { id: 'momentum', name: 'Momentum', desc: 'Securing a kill restores your bonus action.' },
  reaper: { id: 'reaper', name: 'Reaper', desc: 'You score critical hits twice as often.' },
  bodyguard: { id: 'bodyguard', name: 'Bodyguard', desc: 'Allies standing next to you are harder to hit.' },
  second_wind: { id: 'second_wind', name: 'Second Wind', desc: 'You can use Adrenal twice per short rest.' },
  legend: { id: 'legend', name: 'Legend', desc: 'You gain a +2 bonus to all attack rolls.' },
  unbroken: { id: 'unbroken', name: 'Unbroken', desc: 'Once per fight, if you would be knocked down, you are left at 1 HP instead.' },
  whirlwind: { id: 'whirlwind', name: 'Whirlwind', desc: 'Cleave knocks enemies back one tile.' },
  big_ram: { id: 'big_ram', name: 'Big RAM', desc: 'Gain +3 RAM.' },
  fast_ram: { id: 'fast_ram', name: 'Fast RAM', desc: 'Regenerate 1 RAM each turn.' },
  firewall: { id: 'firewall', name: 'Firewall', desc: 'Halve damage taken from enemy hacks.' },
  backdoor: { id: 'backdoor', name: 'Backdoor', desc: 'Short Circuit costs 1 RAM.' },
  feedback: { id: 'feedback', name: 'Feedback', desc: 'Blind deals 3 additional damage.' },
  ghost: { id: 'ghost', name: 'Ghost', desc: 'Hacking does not reveal you while hidden.' },
  daisy: { id: 'daisy', name: 'Daisy Chain', desc: 'Short Circuit arcs to one additional target adjacent to the first.' },
  overload: { id: 'overload', name: 'Overload', desc: 'Hacks deal 2 additional damage.' },
  deep_dive: { id: 'deep_dive', name: 'Deep Dive', desc: 'Hijack lasts for 2 extra turns.' },
  root: { id: 'root', name: 'Root', desc: 'Start every fight with full RAM plus 4.' },
  no_trace: { id: 'no_trace', name: 'No Trace', desc: 'Your hacks cannot be resisted.' },
  storm: { id: 'storm', name: 'Storm', desc: 'Cascade can hit up to 6 targets.' },
  armored_drone: { id: 'armored_drone', name: 'Armored Drone', desc: 'Your drone has twice its normal HP.' },
  quick_drone: { id: 'quick_drone', name: 'Quick Drone', desc: 'Your drone moves 3 additional feet.' },
  medic: { id: 'medic', name: 'Medic', desc: 'Patch heals 4 extra HP.' },
  spotter: { id: 'spotter', name: 'Spotter', desc: 'Tag also reveals hidden enemies.' },
  twin_turret: { id: 'twin_turret', name: 'Twin Turret', desc: 'The turret can be used twice per short rest.' },
  scrapper: { id: 'scrapper', name: 'Scrapper', desc: 'Your drone deals 2 additional damage with its shots.' },
  hunter: { id: 'hunter', name: 'Hunter', desc: 'Marked targets take 2 additional damage from all sources.' },
  field_medic: { id: 'field_medic', name: 'Field Medic', desc: 'Patch can revive downed allies.' },
  swarm: { id: 'swarm', name: 'Swarm', desc: 'Your drone attacks twice.' },
  ace: { id: 'ace', name: 'Ace', desc: 'Your drone never misses.' },
  fortress: { id: 'fortress', name: 'Fortress', desc: 'Turrets have triple health.' },
  overdrive: { id: 'overdrive', name: 'Overdrive', desc: 'Overcharge has no limit per rest.' },
  silver: { id: 'silver', name: 'Silver Tongue', desc: 'Add one additional die to every Talk check.' },
  liar: { id: 'liar', name: 'Liar', desc: 'Fast Talk lasts for 2 turns.' },
  charmer: { id: 'charmer', name: 'Charmer', desc: 'Shops offer lower prices to you.' },
  dirty: { id: 'dirty', name: 'Dirty Fighter', desc: 'Attacks against taunted enemies automatically hit.' },
  inspire: { id: 'inspire', name: 'Inspire', desc: 'You can use rally three times per short rest.' },
  read_room: { id: 'read_room', name: 'Read the Room', desc: 'Add one additional die to every Notice check.' },
  kingmaker: { id: 'kingmaker', name: 'Kingmaker', desc: 'Turncoat duration is increased by 2 turns.' },
  menace: { id: 'menace', name: 'Menace', desc: 'Taunt also hits all enemies adjacent to the target.' },
  lucky: { id: 'lucky', name: 'Lucky', desc: 'Grants +2 Edge.' },
  legend_mouth: { id: 'legend_mouth', name: 'Known Face', desc: 'Enemies who can hear you have a higher miss chance.' },
  saint: { id: 'saint', name: 'Patron', desc: 'Speech heals for 10 additional points.' },
  crowd: { id: 'crowd', name: 'Crowd Work', desc: 'Fast Talk also hits all enemies adjacent to the target.' },
  plating: { id: 'plating', name: 'Plating', desc: 'Kinetic hits deal 2 less damage.' },
  heavy: { id: 'heavy', name: 'Heavy', desc: 'Cannot be shoved. Charges knock back enemies 3 tiles.' },
  sentinel: { id: 'sentinel', name: 'Sentinel', desc: 'Grants a free hit on enemies who move next to an ally you are guarding.' },
  shock_fist: { id: 'shock_fist', name: 'Shock Fist', desc: 'Tasers stun more frequently.' },
  wall: { id: 'wall', name: 'Wall', desc: 'Your guard covers every ally adjacent to you.' },
  spotlight: { id: 'spotlight', name: 'Spotlight', desc: 'Enemies adjacent to Courtesy cannot hide.' },
  juggernaut: { id: 'juggernaut', name: 'Juggernaut', desc: '+15 HP.' },
  shepherd: { id: 'shepherd', name: 'Shepherd', desc: 'Remain Calm also heals allies within 3 tiles for 4.' },
  repair: { id: 'repair', name: 'Self Repair', desc: 'Heals 3 HP at the start of every turn.' },
  fortress_unit: { id: 'fortress_unit', name: 'Fortress', desc: 'Bulwark duration increased to 2 turns.' },
  guardian: { id: 'guardian', name: 'Guardian', desc: 'Guard costs no resources.' },
  calm_voice: { id: 'calm_voice', name: 'Calm Voice', desc: 'You can use Remain Calm twice per short rest.' },
  thick_blood: { id: 'thick_blood', name: 'Thick Blood', desc: 'Your spells cost 1 less HP to cast.' },
  quick_hands: { id: 'quick_hands', name: 'Quick Hands', desc: 'Once per turn, you can use a bonus action instead of an action to wake.' },
  temper: { id: 'temper', name: 'Temper', desc: 'Angry wakes deal an additional 2 damage.' },
  deep_cut: { id: 'deep_cut', name: 'Deep Cut', desc: 'Wakes last for 1 additional turn.' },
  hardy: { id: 'hardy', name: 'Hardy', desc: 'You gain +10 HP.' },
  wild: { id: 'wild', name: 'Wild', desc: 'Splash attacks cover a 5x5 area.' },
  old_feeling: { id: 'old_feeling', name: 'Old Feeling', desc: 'Your mood fluctuates less during combat.' },
  kind: { id: 'kind', name: 'Kind', desc: 'Calm wakes restore 3 HP to the nearest ally at the start of each turn.' },
  fury: { id: 'fury', name: 'Fury', desc: 'Angry wakes will never target allies.' },
  saint_blood: { id: 'saint_blood', name: 'Saint Blood', desc: 'Wakes persist for the duration of the fight.' },
  many: { id: 'many', name: 'Many Hands', desc: 'You can wake two objects simultaneously.' },
  storm_blood: { id: 'storm_blood', name: 'Storm Blood', desc: 'Red Rain can be used twice per long rest.' },
};

export type Slot = 'melee' | 'ranged' | 'armor' | 'chrome';

export interface ItemDef {
  id: string;
  name: string;
  kind: 'melee' | 'ranged' | 'armor' | 'chrome' | 'stim' | 'grenade' | 'vial' | 'food' | 'key' | 'junk' | 'shard';
  price: number;
  desc: string;
  dmg?: [number, number];
  dtype?: DType;
  acc?: number;
  range?: number;
  /** Shots per attack for automatic weapons. */
  shots?: number;
  reach?: number;
  def?: number;
  move?: number;
  heal?: [number, number];
  area?: number;
  feeling?: Feeling | 'hush';
  supplies?: number;
  /** Stat bonuses for chrome and gear. */
  bonus?: Partial<Record<Attr | Skill | 'ram' | 'init' | 'hp', number>>;
  status?: { id: string; turns: number; chance?: number };
  ignoreHalfCover?: boolean;
  knock?: number;
  /** Witches cannot carry chrome. */
  essence?: number;
  read?: string;
  stack?: boolean;
}

const I = (d: ItemDef) => d;
export const ITEMS: ItemDef[] = [
  I({ id: 'fists', name: 'Fists', kind: 'melee', price: 0, dmg: [1, 3], acc: 0, desc: 'Your bare hands.' }),
  I({ id: 'knuckles', name: 'Brass Knuckles', kind: 'melee', price: 40, dmg: [2, 4], acc: 1, desc: 'Heavy rings that deliver a light punch.' }),
  I({ id: 'knife', name: 'Folding Knife', kind: 'melee', price: 50, dmg: [2, 5], acc: 2, desc: 'Small, quick, and easy to conceal.' }),
  I({ id: 'pipe', name: 'Lead Pipe', kind: 'melee', price: 30, dmg: [3, 6], acc: 0, desc: 'A repurposed plumbing tool.' }),
  I({ id: 'machete', name: 'Canal Machete', kind: 'melee', price: 120, dmg: [4, 7], acc: 1, desc: 'Cuts rope, weeds, and worse.' }),
  I({ id: 'baton', name: 'Shock Baton', kind: 'melee', price: 260, dmg: [3, 5], dtype: 'shock', acc: 1, status: { id: 'stunned', turns: 1, chance: 0.2 }, desc: 'Standard issue. Stuns occasionally and shocks wet targets harder.' }),
  I({ id: 'wire', name: 'Monowire', kind: 'melee', price: 900, dmg: [5, 9], acc: 1, reach: 2, desc: 'An invisible thread that reaches 2 tiles.' }),
  I({ id: 'sledge', name: 'Pile Sledge', kind: 'melee', price: 420, dmg: [6, 10], acc: -1, knock: 1, desc: 'Knocks targets back one tile.' }),
  I({ id: 'blade', name: 'Tide Blade', kind: 'melee', price: 1800, dmg: [7, 11], acc: 2, desc: "A sword forged from a Bailer's scrap plate." }),
  I({ id: 'slingshot', name: 'Slingshot', kind: 'ranged', price: 20, dmg: [2, 4], acc: 1, range: 6, desc: 'Fires ball bearings. Silent.' }),
  I({ id: 'pistol', name: 'Pocket Nine', kind: 'ranged', price: 150, dmg: [3, 6], acc: 1, range: 7, desc: 'The pistol favored by everyone in the Deeps.' }),
  I({ id: 'revolver', name: 'Hullbreaker', kind: 'ranged', price: 380, dmg: [5, 8], acc: 0, range: 7, desc: 'A six-shot that hits like a door.' }),
  I({ id: 'smg', name: 'Rattler', kind: 'ranged', price: 340, dmg: [2, 4], shots: 2, acc: 0, range: 5, desc: 'Fires two shots per attack.' }),
  I({ id: 'shotgun', name: 'Bilge Pump', kind: 'ranged', price: 520, dmg: [6, 10], acc: 2, range: 3, desc: 'Devastating at close range, but ineffective across a canal.' }),
  I({ id: 'rifle', name: 'Longwater', kind: 'ranged', price: 780, dmg: [6, 10], acc: 1, range: 11, desc: 'Spans the width of an entire street.' }),
  I({ id: 'smart', name: 'Homing Pistol', kind: 'ranged', price: 1200, dmg: [4, 7], acc: 1, range: 8, ignoreHalfCover: true, desc: 'Bullets curve around low cover.' }),
  I({ id: 'stunner', name: 'Board Stunner', kind: 'ranged', price: 600, dmg: [3, 5], dtype: 'shock', acc: 1, range: 6, status: { id: 'stunned', turns: 1, chance: 0.2 }, desc: 'Fires shock darts that have a chance to stun.' }),
  I({ id: 'raincoat', name: 'Raincoat', kind: 'armor', price: 40, def: 1, desc: 'Keeps you dry. Mostly.' }),
  I({ id: 'coat', name: 'Long Coat', kind: 'armor', price: 160, def: 1, bonus: { talk: 1 }, desc: 'A well-tailored coat commands attention.' }),
  I({ id: 'jacket', name: 'Padded Jacket', kind: 'armor', price: 180, def: 2, desc: 'Foam panels stitched into nylon.' }),
  I({ id: 'poncho', name: 'Rain Poncho', kind: 'armor', price: 30, def: 1, bonus: { sneak: 1 }, desc: 'Dark and quiet.' }),
  I({ id: 'vest', name: 'Board Vest', kind: 'armor', price: 520, def: 3, desc: 'Red stripes, carefully picked off.' }),
  I({ id: 'flight', name: 'Flight Jacket', kind: 'armor', price: 400, def: 2, bonus: { init: 2 }, desc: "Sallis's. Features a torn patch on the shoulder." }),
  I({ id: 'riot', name: 'Riot Plate', kind: 'armor', price: 1100, def: 4, move: -1, desc: 'Heavy. Slows you down.' }),
  I({ id: 'weave', name: 'Ballistic Weave', kind: 'armor', price: 1700, def: 4, desc: 'Stops bullets while looking like a regular shirt.' }),
  I({ id: 'plating', name: 'Patrol Plating', kind: 'armor', price: 0, def: 3, desc: 'Your own personal armor shell.' }),
  I({ id: 'reflexwire', name: 'Reflex Wire', kind: 'chrome', price: 900, bonus: { init: 3 }, essence: 1, desc: 'Gain a +3 bonus to initiative.' }),
  I({ id: 'deck', name: 'Pocket Deck', kind: 'chrome', price: 700, bonus: { ram: 2, hack: 1 }, essence: 1, desc: 'Grants +2 RAM and 1 Hack.' }),
  I({ id: 'controljack', name: 'Control Jack', kind: 'chrome', price: 700, bonus: { tech: 1 }, essence: 1, desc: 'Allows you to drive a drone. Grants +1 Tech.' }),
  I({ id: 'voicebox', name: 'Voice Box', kind: 'chrome', price: 700, bonus: { talk: 1 }, essence: 1, desc: 'Tuning your voice to the listener. Grants +1 Talk.' }),
  I({ id: 'optic', name: 'Optic Mk I', kind: 'chrome', price: 800, bonus: { shoot: 1, notice: 1 }, essence: 1, desc: 'Grants +1 to Shoot and Notice.' }),
  I({ id: 'gripper', name: 'Gripper Arm', kind: 'chrome', price: 1000, bonus: { strike: 1, athletics: 1 }, essence: 1, desc: 'Grants +1 to Strike and Athletics. Increases shove range.' }),
  I({ id: 'dermal', name: 'Dermal Plate', kind: 'chrome', price: 1300, bonus: { hp: 6 }, essence: 1, desc: 'Grants +6 HP.' }),
  I({ id: 'legs', name: 'Spring Legs', kind: 'chrome', price: 1500, bonus: { athletics: 1 }, essence: 1, desc: 'Add 1 movement and 1 Athletics. Jump farther.' }),
  I({ id: 'ramcore', name: 'RAM Core', kind: 'chrome', price: 1600, bonus: { ram: 3 }, essence: 1, desc: 'Grants +3 RAM.' }),
  I({ id: 'stim', name: 'Stim', kind: 'stim', price: 40, heal: [10, 14], stack: true, desc: 'Heals 10, 14 HP. Requires a bonus action.' }),
  I({ id: 'bigstim', name: 'Big Stim', kind: 'stim', price: 100, heal: [22, 28], stack: true, desc: 'Heals 22, 28 hit points as a bonus action.' }),
  I({ id: 'frag', name: 'Frag Grenade', kind: 'grenade', price: 60, dmg: [6, 10], area: 1, stack: true, desc: 'Damages all units in a 3x3 area.' }),
  I({ id: 'shockgren', name: 'Shock Grenade', kind: 'grenade', price: 70, dmg: [4, 7], dtype: 'shock', area: 1, status: { id: 'stunned', turns: 1, chance: 0.3 }, stack: true, desc: 'Electrifies a 3x3 area and any water within it.' }),
  I({ id: 'smokegren', name: 'Smoke Grenade', kind: 'grenade', price: 40, area: 1, stack: true, desc: 'Creates smoke that blocks vision for 2 turns.' }),
  I({ id: 'firegren', name: 'Fire Bottle', kind: 'grenade', price: 50, dmg: [3, 5], dtype: 'fire', area: 1, status: { id: 'burning', turns: 2 }, stack: true, desc: 'Sets a 3x3 area on fire.' }),
  I({ id: 'line4', name: 'Line 4, cut', kind: 'vial', price: 120, feeling: 'anger', stack: true, desc: 'Angry blood. Revives an object for 3 turns, causing it to attack the nearest target.' }),
  I({ id: 'line9', name: 'Line 9, cut', kind: 'vial', price: 160, feeling: 'calm', stack: true, desc: 'Calm blood. Awakens an object for 3 turns. It obeys your commands.' }),
  I({ id: 'line6', name: 'Line 6, cut', kind: 'vial', price: 90, feeling: 'fear', stack: true, desc: 'Scared blood. Awakens an object for 3 turns. It runs and shoves.' }),
  I({ id: 'line2', name: 'Line 2, cut', kind: 'vial', price: 100, feeling: 'joy', stack: true, desc: 'Happy blood. Awakens an object for 3 turns. It dances and distracts.' }),
  I({ id: 'line11', name: 'Line 11, cut', kind: 'vial', price: 100, feeling: 'grief', stack: true, desc: 'Sad blood. Awakens an object for 3 turns. It leaks and slows.' }),
  I({ id: 'hush', name: 'Hush', kind: 'vial', price: 150, feeling: 'hush', stack: true, desc: 'Puts a woken object back to sleep.' }),
  I({ id: 'noodles', name: 'Noodles', kind: 'food', price: 12, supplies: 10, stack: true, desc: 'A paper box of hot noodles. Provides 10 supplies.' }),
  I({ id: 'krill', name: 'Krill Bar', kind: 'food', price: 6, supplies: 5, stack: true, desc: 'Sweetened and pressed. 5 supplies.' }),
  I({ id: 'loaf', name: 'Synth Loaf', kind: 'food', price: 18, supplies: 15, stack: true, desc: 'Vat-grown bread. 15 supplies.' }),
  I({ id: 'eel', name: 'Fried Eel', kind: 'food', price: 26, supplies: 20, stack: true, desc: "Canal eel. Please don't ask which canal. 20 supplies." }),
  I({ id: 'ration', name: 'Board Ration', kind: 'food', price: 30, supplies: 25, stack: true, desc: 'Red wrapper. 25 supplies.' }),
  I({ id: 'plumcake', name: 'Plum Cake', kind: 'food', price: 20, supplies: 15, stack: true, desc: 'From the bakery barge. 15 supplies.' }),
  I({ id: 'scrap', name: 'Scrap', kind: 'junk', price: 8, stack: true, desc: 'Sells for a small amount.' }),
  I({ id: 'chip', name: 'Old Chip', kind: 'junk', price: 30, stack: true, desc: 'Someone will buy it.' }),
];
export const ITEM = new Map<string, ItemDef>(ITEMS.map((i) => [i.id, i]));

export function addItems(list: ItemDef[]) { for (const i of list) { ITEMS.push(i); ITEM.set(i.id, i); } }

export interface EnemyDef {
  kind: string;
  name: string;
  look: string;
  level: number;
  hp: number;
  attr: Record<Attr, number>;
  skills: Partial<Record<Skill, number>>;
  melee?: string;
  ranged?: string;
  armor?: number;
  plating?: number;
  move?: number;
  abilities?: string[];
  /** Behavior: rush, cover, sniper, support, hacker, brute, boss, turret, drone, coward. */
  ai: string;
  machine?: boolean;
  chrome?: boolean;
  flying?: boolean;
  xp: number;
  loot?: [string, number, number][];
  gilt?: [number, number];
  desc: string;
  /** Hit points grow by this per level above its base level. */
  grow?: number;
  boss?: boolean;
  /** Sees the party through walls, darkness, and stealth within its sight range. */
  seesAll?: boolean;
}

export const ENEMIES: EnemyDef[] = [
  { kind: 'boardguard', name: 'Board Officer', look: 'boardguard', level: 1, hp: 14, attr: { body: 3, reflex: 3, wits: 2, nerve: 3 }, skills: { shoot: 1, strike: 1 }, ranged: 'pistol', melee: 'baton', armor: 1, ai: 'cover', chrome: true, xp: 40, gilt: [5, 20], loot: [['stim', 1, 0.3]], desc: 'Board Recovery. Red stripes, a pistol, and a pension.', grow: 5 },
  { kind: 'patrol', name: 'Patrol 6', look: 'patrol', level: 1, hp: 22, attr: { body: 4, reflex: 2, wits: 1, nerve: 5 }, skills: { strike: 1 }, melee: 'baton', plating: 3, ai: 'brute', machine: true, xp: 50, loot: [['scrap', 2, 0.8]], desc: 'A dormant Board riot robot. Bulletproof plating, but vulnerable to shock.', grow: 7, move: 4 },
  { kind: 'lockjaw', name: 'Lockjaw', look: 'lockjaw', level: 1, hp: 15, attr: { body: 3, reflex: 3, wits: 2, nerve: 2 }, skills: { strike: 2, shoot: 1 }, melee: 'machete', ranged: 'pistol', ai: 'rush', chrome: true, xp: 35, gilt: [8, 25], desc: 'A canal pirate with a chrome jaw and wet boots.', grow: 5 },
  { kind: 'jawbrute', name: 'Jaw Brute', look: 'jawbrute', level: 2, hp: 30, attr: { body: 6, reflex: 2, wits: 1, nerve: 3 }, skills: { strike: 3 }, abilities: ['bite'], ai: 'brute', chrome: true, xp: 70, gilt: [10, 30], desc: 'All jaw. Can bite through hull plating.', grow: 8 },
  { kind: 'cutter', name: 'Cutter', look: 'cutter', level: 2, hp: 16, attr: { body: 3, reflex: 3, wits: 3, nerve: 2 }, skills: { shoot: 2, strike: 2 }, melee: 'knife', ranged: 'smg', abilities: ['redvial'], ai: 'cover', chrome: true, xp: 50, gilt: [10, 30], loot: [['line4', 1, 0.25]], desc: 'Sells cut blood. Knows how to throw it, too.', grow: 5 },
  { kind: 'nurse', name: 'Cutter Nurse', look: 'nurse', level: 2, hp: 14, attr: { body: 2, reflex: 3, wits: 4, nerve: 3 }, skills: { shoot: 1 }, ranged: 'pistol', abilities: ['heal'], ai: 'support', chrome: true, xp: 50, loot: [['stim', 1, 0.6]], desc: 'Keeps the Cutters on their feet.', grow: 4 },
  { kind: 'drone', name: 'Board Drone', look: 'drone', level: 1, hp: 10, attr: { body: 2, reflex: 4, wits: 2, nerve: 5 }, skills: { shoot: 2 }, ranged: 'pistol', ai: 'drone', machine: true, flying: true, move: 6, xp: 30, loot: [['scrap', 1, 0.8]], desc: 'It flies, watches, and shoots.', grow: 3 },
  { kind: 'diver', name: 'Board Diver', look: 'diverfoe', level: 2, hp: 13, attr: { body: 2, reflex: 3, wits: 5, nerve: 3 }, skills: { hack: 3 }, ranged: 'pistol', abilities: ['enemyhack'], ai: 'hacker', chrome: true, xp: 60, loot: [['chip', 1, 0.5]], desc: 'Hacks your chrome from across the room.', grow: 4 },
  { kind: 'tapper', name: 'Tapper', look: 'tapper', level: 2, hp: 18, attr: { body: 3, reflex: 3, wits: 3, nerve: 4 }, skills: { shoot: 2 }, ranged: 'stunner', abilities: ['hushthrow'], ai: 'support', chrome: true, xp: 60, loot: [['hush', 1, 0.5]], desc: 'Handles Board Recovery and carries Hush for awakened threats.', grow: 5 },
  { kind: 'choir', name: 'Choir Monk', look: 'choir', level: 2, hp: 20, attr: { body: 4, reflex: 3, wits: 2, nerve: 5 }, skills: { strike: 3 }, melee: 'pipe', ai: 'rush', xp: 50, desc: 'Has no chrome at all, making it immune to hacks.', grow: 6 },
  { kind: 'runner', name: 'Runner', look: 'jory', level: 1, hp: 20, attr: { body: 3, reflex: 4, wits: 3, nerve: 3 }, skills: { shoot: 3, strike: 2 }, ranged: 'pistol', melee: 'knife', armor: 1, ai: 'cover', chrome: true, xp: 0, desc: 'A hired runner.', grow: 5 },
  { kind: 'ganger', name: 'Ganger', look: 'ganger', level: 1, hp: 14, attr: { body: 3, reflex: 3, wits: 2, nerve: 2 }, skills: { shoot: 2, strike: 1 }, ranged: 'pistol', melee: 'pipe', ai: 'rush', chrome: true, xp: 30, gilt: [5, 15], desc: 'A hired muscle.', grow: 5 },
  { kind: 'sniper', name: 'Board Marksman', look: 'boardguard', level: 3, hp: 18, attr: { body: 3, reflex: 5, wits: 3, nerve: 3 }, skills: { shoot: 3 }, ranged: 'rifle', armor: 1, ai: 'sniper', chrome: true, xp: 70, gilt: [10, 30], desc: 'Prefers fighting from the rooftops.', grow: 5 },
  { kind: 'turretfoe', name: 'Turret', look: 'turret', level: 1, hp: 20, attr: { body: 4, reflex: 2, wits: 1, nerve: 9 }, skills: { shoot: 2 }, ranged: 'pistol', plating: 4, ai: 'turret', machine: true, move: 0, xp: 30, desc: 'Stationary and hackable.', grow: 5 },
  { kind: 'sieve', name: 'Mother Sieve', look: 'sieve', level: 4, hp: 70, attr: { body: 3, reflex: 4, wits: 5, nerve: 6 }, skills: { shoot: 3, strike: 2 }, ranged: 'smart', melee: 'knife', abilities: ['redvial', 'tea'], ai: 'boss', chrome: true, xp: 400, gilt: [200, 300], loot: [['line4', 2, 1], ['bigstim', 1, 1]], desc: 'The leader of the Cutters. Serves tea.', boss: true },
  { kind: 'dowser', name: 'The Dowser', look: 'dowser', level: 7, hp: 110, attr: { body: 4, reflex: 6, wits: 6, nerve: 6 }, skills: { shoot: 4, notice: 4 }, ranged: 'rifle', abilities: ['hushthrow', 'grenade'], ai: 'boss', chrome: true, xp: 900, gilt: [300, 400], desc: 'Head of Board Recovery. She can see wakes through walls.', boss: true, seesAll: true },
  { kind: 'warden', name: 'The Warden', look: 'warden', level: 9, hp: 170, attr: { body: 8, reflex: 3, wits: 2, nerve: 9 }, skills: { strike: 4, shoot: 3 }, ranged: 'smg', abilities: ['bite', 'grenade'], plating: 5, ai: 'boss', machine: true, xp: 1400, desc: 'A war machine of the Board, awakened in anger.', boss: true },
  { kind: 'raidcaptain', name: 'Raid Captain', look: 'raidcap', level: 9, hp: 100, attr: { body: 5, reflex: 5, wits: 4, nerve: 6 }, skills: { shoot: 5, strike: 4, notice: 3 }, ranged: 'rifle', melee: 'baton', armor: 2, abilities: ['grenade'], ai: 'boss', chrome: true, xp: 700, gilt: [150, 250], loot: [['bigstim', 1, 1], ['shockgren', 1, 0.6]], desc: 'Leads the Board raid. Has done this before.', boss: true },
  { kind: 'hanne', name: 'Hanne Vroom', look: 'hanne', level: 5, hp: 46, attr: { body: 3, reflex: 5, wits: 4, nerve: 3 }, skills: { shoot: 3, sneak: 3 }, ranged: 'revolver', melee: 'knife', ai: 'cover', chrome: true, xp: 300, desc: 'She fled the barge.', boss: true },
  // The Flats (optional district): mud salvagers with no chrome, the Board's wreck-tagging drones, and the Waders.
  { kind: 'wrecker', name: 'Wrecker', look: 'wrecker', level: 2, hp: 18, attr: { body: 4, reflex: 3, wits: 2, nerve: 3 }, skills: { strike: 2, shoot: 1 }, melee: 'pipe', ranged: 'slingshot', ai: 'rush', xp: 40, gilt: [5, 20], loot: [['scrap', 1, 0.5]], desc: 'A salvager from inside the Wall. Lacking chrome, he is immune to hacking.', grow: 5 },
  { kind: 'salvdrone', name: 'Salvage Drone', look: 'drone', level: 2, hp: 16, attr: { body: 3, reflex: 3, wits: 2, nerve: 6 }, skills: { strike: 2, shoot: 1 }, melee: 'machete', ranged: 'pistol', plating: 1, ai: 'drone', machine: true, flying: true, move: 5, xp: 45, loot: [['scrap', 2, 0.8]], desc: 'A Board drone equipped with a cutting arm, used to tag wrecks.', grow: 4 },
  { kind: 'wader', name: 'Wader', look: 'wader', level: 3, hp: 22, attr: { body: 4, reflex: 4, wits: 3, nerve: 4 }, skills: { strike: 3, shoot: 2, athletics: 3 }, melee: 'gaffhook', ranged: 'slingshot', ai: 'rush', xp: 50, desc: 'A mud salvager from the Flats. He has no chrome and carries a long-reach gaff.', grow: 6 },
  // The Line tunnels (optional district): woken turnstiles, the Board's track robots, and the Stillman.
  { kind: 'faregate', name: 'Fare Gate', look: 'turret', level: 2, hp: 18, attr: { body: 4, reflex: 2, wits: 1, nerve: 9 }, skills: { shoot: 2, strike: 2 }, ranged: 'slingshot', melee: 'baton', plating: 2, ai: 'turret', machine: true, move: 0, xp: 40, loot: [['scrap', 1, 0.6]], desc: "A woken turnstile that fires old fare tokens at anyone who hasn't paid.", grow: 4 },
  { kind: 'trackbot', name: 'Track Robot', look: 'patrol', level: 2, hp: 22, attr: { body: 5, reflex: 2, wits: 1, nerve: 6 }, skills: { strike: 2 }, melee: 'pipe', plating: 2, ai: 'brute', machine: true, move: 4, xp: 45, loot: [['scrap', 2, 0.8]], desc: 'A Board track robot continues its patrol, clearing debris from the path.', grow: 5 },
  { kind: 'stillman', name: 'The Stillman', look: 'stillman', level: 4, hp: 64, attr: { body: 3, reflex: 4, wits: 6, nerve: 7 }, skills: { shoot: 3, strike: 2, notice: 3 }, ranged: 'stunner', melee: 'knife', abilities: ['hushthrow', 'grenade'], ai: 'boss', chrome: true, xp: 350, gilt: [80, 140], loot: [['hush', 2, 1]], desc: 'A Board chemist who never left the first works still runs the Hush.', boss: true },
];
export const ENEMY = new Map<string, EnemyDef>(ENEMIES.map((e) => [e.kind, e]));
