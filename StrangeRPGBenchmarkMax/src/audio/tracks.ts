// Every track, gathered for the engine. The framework is in score-core.ts and the motifs in motifs.ts.
import type { TrackDef } from './score-core';
import { BACK_TRACKS } from './tracks-back';
import { BATTLE_TRACKS } from './tracks-battle';
import { END_TRACKS } from './tracks-end';
import { FACE_TRACKS } from './tracks-face';
import { MARKET_TRACKS } from './tracks-market';
import { OVERHEAD_TRACKS } from './tracks-overhead';
import { STILE_TRACKS } from './tracks-stile';

export const TRACKS: Record<string, TrackDef> = {
  ...STILE_TRACKS, ...MARKET_TRACKS, ...FACE_TRACKS, ...OVERHEAD_TRACKS, ...BACK_TRACKS, ...BATTLE_TRACKS, ...END_TRACKS,
};

/** The tracks the game may ask for by name. 'defeat' is internal: battleEvent('defeat') plays it. */
export const PUBLIC_TRACKS = [
  'title', 'home', 'stile', 'lead', 'wake', 'parhelia', 'gully', 'road', 'market', 'lot', 'underbridge', 'bright',
  'solehold', 'relay_tower', 'glass', 'minim', 'glass_quarry', 'overhead', 'overhead_sad', 'first_mirror', 'dusk', 'tik',
  'burrow', 'back_road', 'lampeater_den', 'stile_dark', 'office_tower', 'anthelion', 'battle', 'boss', 'boss_final',
  'victory', 'sticks', 'epilogue', 'credits',
] as const;
