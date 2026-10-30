// Camp scenes. After each long rest the game plays the first ready scene in priority order that has not
// played yet. A scene is ready when its condition holds. Scenes marked `repeat` can play again later.

export interface CampScene { scene: string; when: string; priority: number; repeat?: boolean }
export const CAMP: CampScene[] = [];
export function addCamp(list: CampScene[]) { CAMP.push(...list); CAMP.sort((a, b) => b.priority - a.priority); }
