// Every track, gathered for the engine. The framework is in score-core.ts and the motifs in motifs.ts.
import type { TrackDef } from './score-core';
import { BATTLE_TRACKS } from './tracks-battle';
import { BRIM_TRACKS } from './tracks-brim';
import { DEEPS_TRACKS } from './tracks-deeps';
import { STAIR_TRACKS } from './tracks-stair';

export const TRACKS: Record<string, TrackDef> = {
  ...DEEPS_TRACKS, ...STAIR_TRACKS, ...BRIM_TRACKS, ...BATTLE_TRACKS,
};

/** Tracks the engine plays on its own: the victory sting and the defeat track. The game reaches them by events. */
export const INTERNAL_TRACKS: readonly string[] = ['victory', 'defeat'];
