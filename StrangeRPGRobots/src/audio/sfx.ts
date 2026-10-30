// Audio entry points used by the game. This file is the contract: the music and effects engine behind it may
// change, but these names and signatures stay.

export interface Voice { pitch: number; wave: number; rate: number }

export const SFX_NAMES = [
  'blip', 'confirm', 'cancel', 'cursor', 'dice', 'pass', 'fail', 'step', 'door', 'loot', 'buy', 'hit', 'miss', 'crit',
  'pistol', 'smg', 'shotgun', 'rifle', 'melee', 'shock', 'hack', 'explode', 'splash', 'wake', 'hush', 'heal', 'levelup',
  'approve', 'disapprove', 'alarm', 'jump', 'fall', 'shove', 'dissipate', 'drone', 'bailer', 'pa', 'toast', 'menu',
  'save', 'quest', 'edge', 'guard', 'foam', 'smoke', 'fire', 'turn', 'talk', 'port', 'error',
] as const;
export type SfxName = (typeof SFX_NAMES)[number];

export const TRACK_NAMES = [
  'none', 'title', 'home', 'deeps', 'market', 'pound', 'ferries', 'clinic', 'combat', 'boss', 'camp', 'stair', 'lanterns',
  'church', 'farm', 'spire', 'brim', 'crown', 'flood', 'tense', 'sad', 'ending', 'credits',
] as const;

export type CombatEvent = 'start' | 'party_turn' | 'enemy_turn' | 'low_hp' | 'kill' | 'victory' | 'defeat' | 'boss_phase' | 'end';

type Impl = {
  init: () => void;
  volumes: (m: number, s: number, v: number) => void;
  music: (t: string) => void;
  sfx: (n: string, o?: { pitch?: number; pan?: number; vol?: number }) => void;
  blip: (v?: Voice) => void;
  combat: (e: CombatEvent) => void;
};

let impl: Impl | null = null;
/** The engine registers itself here. Until then every call does nothing. */
export function registerAudio(i: Impl) { impl = i; }

export function initAudio() { try { impl?.init(); } catch { /* never throw */ } }
export function setVolumes(m: number, s: number, v: number) { try { impl?.volumes(m, s, v); } catch { /* never throw */ } }
export function playMusic(track: string) { try { impl?.music(track); } catch { /* never throw */ } }
export function sfx(name: SfxName | string, o?: { pitch?: number; pan?: number; vol?: number }) { try { impl?.sfx(name, o); } catch { /* never throw */ } }
export function blip(v?: Voice) { try { impl?.blip(v); } catch { /* never throw */ } }
export function combatEvent(e: CombatEvent) { try { impl?.combat(e); } catch { /* never throw */ } }
