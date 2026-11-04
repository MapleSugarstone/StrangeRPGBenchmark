// The Field States (design/systems.md, section 7): what each one says it does, the islands whose battles happen in it,
// and its opening line, all Qwen's (Notes/qwen/after-answers.json; Gale, High Tide, and Starfall from *-field-fix.md; Fog left island 1 in *-two-fixes.md). Their code is in field_code.ts.

export const FIELD_STATES: Record<string, { text: string; islands: number[]; opens: string }> = {
  "Fog": { text: "Silence blocks moves. Aether Ruins ignore Silence.", islands: [10], opens: "Fog thickens. Breath is stolen." },
  "Gale": { text: "Wind knocks back. The slower Ruin switches to Reserve.", islands: [2,5], opens: "Gale screams. Dust swirls." },
  "High Tide": { text: "Water drowns. The Ruin with lowest HP takes 10% damage.", islands: [3,12], opens: "Water rises. Cold and deep." },
  "Starfall": { text: "Stars fall. The Ruin with highest ATK takes 10% damage.", islands: [4,6,7,8,9,11,13,14,16], opens: "Stars fall. Sky burns." },
};
