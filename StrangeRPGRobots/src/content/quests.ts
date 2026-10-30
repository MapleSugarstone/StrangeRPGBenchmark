// Quest journal entries. Scripts advance a quest with `> quest id stage`. Each stage's text replaces the
// journal summary. Kinds: main, side, companion, gig.

export interface QuestDef {
  id: string;
  title: string;
  kind: 'main' | 'side' | 'companion' | 'gig';
  /** Journal text per stage number. Stage 'done' and 'fail' texts close the quest. */
  stages: Record<string, string>;
  /** Experience given when the quest is done. */
  xp?: number;
  /** Where the quest points: map id and marker, per stage, for the quest arrow. */
  where?: Record<string, [string, string]>;
  /** The last chapter the quest can be finished in. It fails when the story moves past that chapter. */
  expires?: number;
}

export const QUESTS: QuestDef[] = [];
export const QUEST = new Map<string, QuestDef>();

export function addQuests(list: QuestDef[]) {
  for (const q of list) { QUESTS.push(q); QUEST.set(q.id, q); }
}
