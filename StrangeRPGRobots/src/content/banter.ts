// Party banter: short exchanges that float over the speakers' heads while the player keeps walking.
// Each entry names a scene of plain speaker lines, where it can play, and who must be in the party.

export interface Banter {
  scene: string;
  /** Map ids where it can play. Omit for anywhere in the district. */
  maps?: string[];
  district?: 'deeps' | 'stair' | 'brim' | 'flats' | 'inside';
  /** A condition in the usual flag syntax. */
  when?: string;
  /** Companion ids that must be in the active party. */
  party: string[];
  /** Chance to play on a map arrival when it is eligible, 0 to 1. */
  chance?: number;
}

export const BANTER: Banter[] = [];
export function addBanter(list: Banter[]) { BANTER.push(...list); }
