// Every track, by id.
import type { TrackId } from '../audio';
import type { TrackDef } from './lib';
import { gardens, library, plaza, title, tower } from './brass';
import { archive, current, lighthouse, reef, sea, ship } from './sea';
import { chasm, despair, escape, factory, storyteller, year } from './year';
import { choice, seer, spire, vault, voidTrack } from './stone';
import { battle, boss, guardian, keeper, lightbound, miniboss } from './combat';
import { credits, endAccept, endEscape, endRestore } from './endings';

export const TRACKS: Record<TrackId, TrackDef> = {
  title, plaza, tower, library, gardens,
  ship, sea, lighthouse, reef, current, archive,
  year, factory, storyteller, chasm, despair, escape,
  spire, vault, void: voidTrack, choice, seer,
  battle, miniboss, boss, keeper, lightbound, guardian,
  end_restore: endRestore, end_accept: endAccept, end_escape: endEscape, credits,
};

export const TRACK_IDS = Object.keys(TRACKS) as TrackId[];
