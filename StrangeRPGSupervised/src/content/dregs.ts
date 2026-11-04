// The postgame's words that are not on a map: where it starts, and the last words of the game. Qwen's
// (Notes/qwen/dregs.json), written by tools/build_dregs.mjs.

/** Where the last gate leads once the ending has been seen. */
export const DREGS_ENTRY = { map: "the_dregs_undercroft_1" };

/** The closing screen after the Final Rift. */
export const POSTGAME_END = "The cracks close. The light returns. The world breathes again. We are whole.";

/** The Undercroft's board game: the guardian's rules line, and what they say when Shard wins or loses. */
export const BOARD = { rules: "Take 1, 2, or 3 stones. The one who takes the last stone loses.", win: "You see the pattern.", lose: "You are blind." };
