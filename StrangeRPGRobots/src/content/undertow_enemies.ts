// Undertow enemies and the gear they carry: Quiet Desk security, its white ICE, the drifts beyond the Pale, and
// citizens whose chrome a drowned port is riding.
import { ENEMIES, ENEMY, addItems, type EnemyDef } from '../rules/data';

addItems([
  { id: 'icespike', name: 'Ice Spike', kind: 'ranged', price: 0, dmg: [3, 5], dtype: 'hack', acc: 1, range: 6, desc: 'White ICE. It throws cold code.' },
  { id: 'icejaw', name: 'Ice Jaw', kind: 'melee', price: 0, dmg: [3, 6], dtype: 'hack', acc: 1, desc: 'White ICE with teeth.' },
  { id: 'driftlash', name: 'Drift Lash', kind: 'melee', price: 0, dmg: [4, 7], dtype: 'hack', acc: 0, desc: 'A woken program swinging what it has.' },
  { id: 'deskstunner', name: 'Desk Stunner', kind: 'ranged', price: 640, dmg: [3, 5], dtype: 'shock', acc: 1, range: 6, status: { id: 'stunned', turns: 1, chance: 0.2 }, desc: 'Quiet Desk issue. Fires shock darts that have a chance to stun.' },
  { id: 'frostbaton', name: 'Frost Baton', kind: 'melee', price: 480, dmg: [3, 6], dtype: 'shock', acc: 1, status: { id: 'frosted', turns: 1, chance: 0.3 }, desc: 'A baton with a Hush cell in the grip. It can leave the target Frosted.' },
]);

const U: EnemyDef[] = [
  // Net
  { kind: 'sentry', name: 'Sentry', look: 'sentry', level: 3, hp: 24, attr: { body: 3, reflex: 2, wits: 4, nerve: 8 }, skills: { shoot: 2, hack: 2 }, ranged: 'icespike', plating: 2, move: 0, abilities: ['frostbolt'], ai: 'turret', machine: true, xp: 45, desc: 'Quiet Desk white ICE. It stays put and frosts the nearest avatar.', grow: 5 },
  { kind: 'icehound', name: 'Ice Hound', look: 'icehound', level: 3, hp: 26, attr: { body: 4, reflex: 5, wits: 2, nerve: 6 }, skills: { strike: 3 }, melee: 'icejaw', move: 7, abilities: ['frostbite'], ai: 'rush', machine: true, xp: 50, desc: 'Fast white ICE that chases divers. Its bite leaves them Frosted.', grow: 5 },
  { kind: 'deskdiver', name: 'Desk Diver', look: 'deskdiver', level: 3, hp: 20, attr: { body: 2, reflex: 3, wits: 6, nerve: 4 }, skills: { hack: 4, shoot: 1 }, ranged: 'icespike', abilities: ['frostbolt', 'enemyhack'], ai: 'hacker', chrome: true, xp: 65, loot: [['chip', 1, 0.5]], desc: 'A Quiet Desk diver. She hacks from across the room and leaves avatars Frosted.', grow: 4 },
  { kind: 'drift_anger', name: 'Angry Drift', look: 'drift_anger', level: 3, hp: 30, attr: { body: 5, reflex: 3, wits: 2, nerve: 5 }, skills: { strike: 3 }, melee: 'driftlash', move: 5, ai: 'rush', machine: true, xp: 50, desc: 'A security daemon that woke in anger. It hits hard and chases.', grow: 6 },
  { kind: 'drift_grief', name: 'Grieving Drift', look: 'drift_grief', level: 3, hp: 32, attr: { body: 4, reflex: 2, wits: 3, nerve: 6 }, skills: { strike: 2 }, melee: 'driftlash', move: 3, abilities: ['leak'], ai: 'brute', machine: true, xp: 50, desc: 'An old ad that woke in grief. Everything next to it moves slowly.', grow: 6 },
  { kind: 'drift_joy', name: 'Joyful Drift', look: 'drift_joy', level: 3, hp: 24, attr: { body: 3, reflex: 4, wits: 3, nerve: 4 }, skills: { strike: 2 }, melee: 'driftlash', move: 5, abilities: ['jingle'], ai: 'support', machine: true, xp: 45, desc: 'A jingle that woke in joy. It distracts everyone who hears it.', grow: 5 },
  { kind: 'drift_fear', name: 'Frightened Drift', look: 'drift_fear', level: 3, hp: 22, attr: { body: 2, reflex: 6, wits: 3, nerve: 3 }, skills: { strike: 2 }, melee: 'driftlash', move: 6, abilities: ['alarm'], ai: 'coward', machine: true, xp: 45, desc: 'An alarm that woke in fear. It blinds whoever comes close, then runs.', grow: 4 },
  { kind: 'maas_net', name: 'Director Maas', look: 'maas', level: 8, hp: 120, attr: { body: 3, reflex: 5, wits: 7, nerve: 7 }, skills: { hack: 5, shoot: 3, notice: 4 }, ranged: 'icespike', abilities: ['frostwall', 'callsentry', 'hushport', 'frostbolt'], ai: 'boss', chrome: true, xp: 1000, desc: 'The head of the Quiet Desk, in the net. He raises frost walls, calls sentries, and goes after the port.', boss: true },
  { kind: 'quiet_heart', name: 'The Hush Engine', look: 'drift_quiet', level: 10, hp: 190, attr: { body: 6, reflex: 3, wits: 6, nerve: 9 }, skills: { strike: 4, hack: 4 }, melee: 'icejaw', ranged: 'icespike', plating: 3, move: 3, abilities: ['whiteout', 'frostbolt', 'callsentry'], ai: 'boss', machine: true, xp: 1600, desc: "The Pale's heart. Twenty-two years of Hush, built into a program that spreads stillness.", boss: true },
  // Meat
  { kind: 'deskagent', name: 'Desk Agent', look: 'deskagent', level: 3, hp: 24, attr: { body: 3, reflex: 4, wits: 3, nerve: 4 }, skills: { shoot: 3, strike: 2 }, ranged: 'deskstunner', melee: 'frostbaton', armor: 1, abilities: ['hushthrow'], ai: 'cover', chrome: true, xp: 60, gilt: [15, 35], loot: [['hush', 1, 0.4], ['stim', 1, 0.3]], desc: 'Quiet Desk security. A stunner, a frost baton, and Hush for anything woken.', grow: 5 },
  { kind: 'frostdrone', name: 'Frost Drone', look: 'drone', level: 3, hp: 16, attr: { body: 2, reflex: 4, wits: 2, nerve: 6 }, skills: { shoot: 2 }, ranged: 'icespike', ai: 'drone', machine: true, flying: true, move: 6, abilities: ['frostbolt'], xp: 40, loot: [['scrap', 1, 0.8]], desc: 'A Desk drone with a Hush mister. It flies and leaves targets Frosted.', grow: 4 },
  Object.assign({ kind: 'rider', name: 'Ridden Citizen', look: 'sleeper', level: 2, hp: 16, attr: { body: 3, reflex: 3, wits: 2, nerve: 2 }, skills: { strike: 2 }, melee: 'fists', ai: 'rush', chrome: true, xp: 30, desc: "A drowned port is riding this person's chrome. Knocking them down sets them free.", grow: 5 } as EnemyDef, { spare: true }),
];

for (const e of U) { ENEMIES.push(e); ENEMY.set(e.kind, e); }
