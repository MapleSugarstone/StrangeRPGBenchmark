// Resonance (design/systems.md, section 5): a charm for beating each Keeper, worn one at a time, acting for the whole
// team. Names, texts, and rules are Qwen's (Notes/qwen/systems-answers.json), in the words of Notes/qwen/rules-vocab.md.
import type { Rule } from '../battle/rules.js';

export const RESONANCE_MENU = "Wear";
export const RESONANCE_GOT = "You wear {resonance}. It hums.";

/** By Keeper: the Keeper's Ruin species is keeper_<name in lower case>. */
export const RESONANCE: Record<string, Rule & { name: string; text: string }> = {
  Nyx: {"name":"Nyx's Whisper","text":"Heal 10% HP on entry.","when":"enter","do":"heal","amount":10},
  Bram: {"name":"Bram's Grip","text":"Root foe 30% chance on hit.","when":"hit","do":"status_foe","status":"Root","amount":30},
  Grom: {"name":"Grom's Weight","text":"Lower foe AGI 10% on hurt.","when":"hurt","do":"lower","stat":"AGI","amount":10},
  Kyr: {"name":"Kyr's Sight","text":"Pierce 20% RES when bad matchup.","when":"always","if":"bad_matchup","do":"pierce","amount":20,"stat":"RES"},
  Tor: {"name":"Tor's Scorch","text":"Burn foe 25% chance on hit.","when":"hit","do":"status_foe","status":"Burn","amount":25},
  Vex: {"name":"Vex's Edge","text":"Power 15% hits when boost 5.","when":"always","if":"boost_5","do":"power","amount":15},
  Syl: {"name":"Syl's Veil","text":"Shield 10% damage always.","when":"always","do":"shield","amount":10},
  Dun: {"name":"Dun's Void","text":"Chip 5% max HP foe on ko.","when":"ko","do":"chip","amount":5},
};

/** The Magnet's lines when it grows (Qwen). */
export const MAGNET_LINES: Record<number, string> = { 3: "The pull grows strong.", 4: "Nothing escapes it." };
/** The Keepers whose defeat grows the Magnet, to strength 3 and then 4. */
export const MAGNET_KEEPERS: Record<string, number> = { Grom: 3, Dun: 4 };
