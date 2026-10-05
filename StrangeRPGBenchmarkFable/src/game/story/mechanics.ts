import type { MechId } from "../types";

export interface MechanicInfo { name: string; desc: string; short: string }

export const MECHANIC_INFO: Record<MechId, MechanicInfo> = {
  brace: {
    name: "Brace",
    short: "Guard, then hit twice as hard.",
    desc: "Guard now halves damage AND braces you. Your next attack or spell deals double. Guard is a setup rather than a pass.",
  },
  tempo: {
    name: "Tempo",
    short: "See and bend the turn order.",
    desc: "The strip above the party shows who acts next. Fast fighters act more often. Some skills push a foe later on the strip. Delay gives up a turn, restores a little Static, and brings your next turn sooner.",
  },
  links: {
    name: "Links",
    short: "Two elements on one foe react.",
    desc: "An elemental hit leaves a charge on the foe. A different element on a charged foe triggers a Link: Heat and Cold SHATTER, Heat and Volt OVERLOAD everyone, Rot and Volt BLIGHT, Cold and Rot STALL, Light pairs with anything.",
  },
  memories: {
    name: "Memories",
    short: "Wear what you kill.",
    desc: "Foes sometimes drop a Memory. Slot up to three on each party member from the menu. Memories are passives: regen, counters, immunities, odd rules. Quill's Recite grows with every Memory worn.",
  },
  rows: {
    name: "Rows",
    short: "Front and back.",
    desc: "Everyone stands in a front or back row. Melee from or into the back row does less. Ranged skills and spells ignore rows. Shoves and pulls move people. Change your row from the battle menu.",
  },
  debt: {
    name: "Debt",
    short: "Borrow now, pay in teeth.",
    desc: "Borrow restores Static at once and adds to your debt. Debt gains interest every party turn. Above forty teeth the Bank takes HP. Pay it down at any Bank or with a Loose Tooth. Uhtred's skills cost debt instead of Static.",
  },
  rewind: {
    name: "Rewind",
    short: "Undo one turn per battle.",
    desc: "Once per battle, Rewind returns the fight to the moment before your last action. The dice roll again. The Backward Hour runs on this, and so do its monsters.",
  },
  fusion: {
    name: "Fusion",
    short: "Two become one for three turns.",
    desc: "Fuse merges you with an ally. The fused fighter has both skill lists, bigger stats, and one combined HP pool. After three turns, or on death, you split and share what HP is left.",
  },
  words: {
    name: "Words",
    short: "Build spells from three words.",
    desc: "Cast lets you assemble a spell: a verb, a noun, and a shape. BURN FOES LOUDLY. MEND FRIENDS SLOWLY. You find words across the Crown. The Loom was built on them.",
  },
};
