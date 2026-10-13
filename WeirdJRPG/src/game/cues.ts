// Tells the music what just happened in a battle, so the battle track can change with the fight.
import { battleCue, type BattleCue, type BattleCueOpts } from '../engine/audio';

export function cue(c: BattleCue, o?: BattleCueOpts): void {
  try { battleCue(c, o); } catch { /* music must never break a battle */ }
}
