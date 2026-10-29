// Gnomon's audio API. The game calls only these functions. Everything imports safely in Node, where no AudioContext
// exists, and unknown track, sound, or event names log once and play nothing.
import { initAudio as coreInit, logOnce, setMuted as coreMuted, setVolumes as coreVolumes } from './core';
import { music } from './music';
import type { BattleEvent } from './music';
import type { Region } from './score-core';
import { REGIONS } from './score-core';
import { playSfx, SFX_LIST } from './sfx';
import { PUBLIC_TRACKS, TRACKS } from './tracks';
import { speak } from './voices';

export type { BattleEvent } from './music';
export type { Region } from './score-core';

/** Every track the game may ask for. 'none' melts to silence. */
export const TRACK_NAMES: readonly string[] = PUBLIC_TRACKS;
/** Every sound effect name. */
export const SFX_NAMES: readonly string[] = SFX_LIST;

const EVENTS = new Set<string>(['lamp_on', 'lamp_off', 'turned_hit', 'low_hp', 'calm', 'victory', 'defeat', 'boss_phase', 'note_recorded']);

/** Creates or resumes audio. Call it from the first user gesture. Calling it twice is safe. */
export function initAudio(): void {
  try { coreInit(); } catch { /* never throw */ }
}

/** Music, effects, and voice volumes, each 0..10. */
export function setVolumes(music: number, sfx: number, voice: number): void {
  try { coreVolumes(music, sfx, voice); } catch { /* never throw */ }
}

/** Melts into a track. 'none' melts to silence. Asking for the track already playing does nothing. */
export function playMusic(track: string): void {
  try {
    if (track !== 'none' && (!TRACKS[track] || track === 'defeat')) { logOnce(`track:${track}`, `[audio] unknown track "${track}"`); return; }
    music.play(track);
  } catch { /* never throw */ }
}

/** Plays a sound effect. `pitch` is a frequency ratio (1 is normal), `pan` runs -1..1, and `vol` scales the level. */
export function sfx(name: string, opts?: { pitch?: number; pan?: number; vol?: number }): void {
  try {
    if (!playSfx(name, opts ?? {})) logOnce(`sfx:${name}`, `[audio] unknown sound "${name}"`);
  } catch { /* never throw */ }
}

/** One voice blip per printed character. Spaces and punctuation make no sound, and narration is silent. */
export function voice(speaker: string, ch: string): void {
  try { speak(speaker, ch); } catch { /* never throw */ }
}

/** Tells the music what just happened in a battle. lamp_on and lamp_off also work in the field. */
export function battleEvent(kind: BattleEvent): void {
  try {
    if (!EVENTS.has(kind)) { logOnce(`event:${kind}`, `[audio] unknown battle event "${kind}"`); return; }
    music.event(kind);
  } catch { /* never throw */ }
}

/** 0 is calm, 1 is desperate. Layers arrive as it rises. */
export function setBattleIntensity(x: number): void {
  try { music.setIntensity(x); } catch { /* never throw */ }
}

/** Mutes or unmutes everything. */
export function setMuted(m: boolean): void {
  try { coreMuted(m); } catch { /* never throw */ }
}

/**
 * Optional. Battles take their color from the last place track. Call this to choose the region yourself, or pass
 * null to go back to the automatic choice.
 */
export function setRegion(region: Region | null): void {
  try {
    if (region !== null && !REGIONS.includes(region)) { logOnce(`region:${region}`, `[audio] unknown region "${region}"`); return; }
    music.setRegion(region);
  } catch { /* never throw */ }
}

/** Optional. Some tracks change with the story, for example Minim's line after she cracks in chapter 4. */
export function setChapter(n: number): void {
  try { music.setChapter(n); } catch { /* never throw */ }
}

/** True once a track that ends (the credits) has played its last scripted section. Always true without audio. */
export function musicFinished(): boolean {
  try { return music.finished(); } catch { return true; }
}

/** The track the game last asked for, or null for silence. */
export function currentTrack(): string | null {
  try { return music.current(); } catch { return null; }
}
