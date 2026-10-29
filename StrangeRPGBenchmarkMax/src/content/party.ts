// The party: base numbers, growth, and the skills each member brings.

export interface MemberDef {
  id: string;
  name: string;
  hp: number;
  hpGrow: number;
  pow: number;
  /** Levels at which Pow rises by one. */
  powAt: number[];
  guard: number;
  guardAt: number[];
  move: number;
  height: number;
  skills: string[];
  /** Skills learned at a level. */
  learn: Record<number, string>;
}

export const MEMBERS: Record<string, MemberDef> = {
  nodus: { id: 'nodus', name: 'Nodus', hp: 12, hpGrow: 2, pow: 1, powAt: [3, 6, 9, 12, 15], guard: 0, guardAt: [5, 11], move: 3, height: 1, skills: ['rule', 'note', 'touch'], learn: { 4: 'double_rule', 8: 'margin' } },
  parhelia: { id: 'parhelia', name: 'Parhelia', hp: 10, hpGrow: 2, pow: 1, powAt: [4, 8, 12], guard: 0, guardAt: [6, 12], move: 2, height: 1, skills: ['raise', 'hood', 'warm', 'touch'], learn: { 5: 'flare' } },
  lot: { id: 'lot', name: 'Lot', hp: 8, hpGrow: 2, pow: 2, powAt: [4, 7, 10, 13], guard: 0, guardAt: [9], move: 4, height: 0, skills: ['tug', 'stab', 'slip'], learn: { 6: 'drag' } },
  umbraculum: { id: 'umbraculum', name: 'Umbraculum', hp: 18, hpGrow: 3, pow: 2, powAt: [6, 10, 14], guard: 1, guardAt: [8, 13], move: 3, height: 1, skills: ['shade', 'stomp', 'hop'], learn: { 9: 'great_shade' } },
  minim: { id: 'minim', name: 'Minim', hp: 12, hpGrow: 2, pow: 1, powAt: [6, 9, 12, 15], guard: 1, guardAt: [10], move: 3, height: 2, skills: ['glint', 'pane', 'recall'], learn: { 11: 'mirror_rule' } },
  tik: { id: 'tik', name: 'Tik', hp: 13, hpGrow: 2, pow: 2, powAt: [12, 14, 16], guard: 0, guardAt: [14], move: 4, height: 0, skills: ['nip', 'sling', 'listen', 'snuff'], learn: { 14: 'quiet_step' } },
  anthelion: { id: 'anthelion', name: 'Anthelion', hp: 34, hpGrow: 0, pow: 4, powAt: [], guard: 2, guardAt: [], move: 2, height: 2, skills: ['license', 'bolt', 'raise'], learn: {} },
};

/** Total XP needed to reach a level. */
export function xpFor(level: number): number { return Math.round(8 * (level - 1) * (level + 2) / 2); }

export const MAX_LEVEL = 20;

export function statsAt(id: string, level: number) {
  const d = MEMBERS[id];
  return {
    maxHp: d.hp + d.hpGrow * (level - 1),
    pow: d.pow + d.powAt.filter((l) => level >= l).length,
    guard: d.guard + d.guardAt.filter((l) => level >= l).length,
    move: d.move,
    height: d.height,
  };
}

export function skillsAt(id: string, level: number): string[] {
  const d = MEMBERS[id];
  const out = [...d.skills];
  for (const [l, s] of Object.entries(d.learn)) if (level >= Number(l)) out.push(s);
  return out;
}
