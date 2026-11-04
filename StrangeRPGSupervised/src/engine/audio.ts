/**
 * Sound for Ruin: a thin layer over src/audio/toybox.ts (Qwen's loops on a home-keyboard sound), kept for the scenes' imports.
 * Music, sound effects, and dialogue blips share one AudioContext, one master gain, and one mute state.
 */
import { armAudio, inGesture, isMuted, toggleMuted, wakeAudio } from "../audio/ctx.js";
import { toybox as music } from "../audio/toybox.js";
import type { SfxId, TrackId } from "../audio/toybox.js";

export { music, isMuted };
export type { SfxId, TrackId };

export const SFX_NAMES: readonly SfxId[] = [
  "menu_move", "menu_confirm", "step", "hit", "heavy_hit", "status", "ko", "catch", "level_up", "door", "type_blip",
];

/** Listens for the first gesture, and starts audio at once when called from inside one. */
export function initAudio(): void {
  armAudio();
  const hasActivation = typeof navigator !== "undefined" && "userActivation" in navigator;
  if (inGesture() || (!hasActivation && typeof window !== "undefined")) wakeAudio();
}

export function playSfx(name: string): void {
  if ((SFX_NAMES as readonly string[]).includes(name)) music.sfx(name as SfxId);
}

// Each speaker's blip, in semitones from the narrator's.
const SPEAKER_PITCH: Record<string, number> = {
  Shard: 0, Brix: -2, Vell: 2, Osm: -5, Kest: -8, Luma: 4,
  "Keeper Grom": -12, "Keeper Vex": -1, "Keeper Nyx": 1, "Keeper Bram": -6,
  "Keeper Tor": -4, "Keeper Kyr": 3, "Keeper Dun": -13, "Keeper Syl": -3,
};

export function speakerPitch(speaker: string): number {
  return SPEAKER_PITCH[speaker] ?? 0;
}

export function playDialogueVoice(speaker: string): void {
  music.sfx("type_blip", speakerPitch(speaker));
}

export function toggleMute(): void {
  toggleMuted();
}

export function playTrack(track: TrackId, place = 0, variant = 0): void {
  music.play(track, { place, variant });
}

export function stopMusic(fadeSeconds = 1): void {
  music.stop(fadeSeconds);
}
