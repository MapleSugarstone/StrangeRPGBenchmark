import type { StatusDef, StatusId } from "../types";

export const STATUSES: Record<StatusId, StatusDef> = {
  poison: { id: "poison", name: "Poison", short: "PSN", color: "purple", good: false, desc: "Loses HP every turn." },
  burn: { id: "burn", name: "Burn", short: "BRN", color: "orange", good: false, desc: "Loses HP every turn and defense is lowered." },
  shock: { id: "shock", name: "Shock", short: "SHK", color: "yellow", good: false, desc: "May lose the turn." },
  freeze: { id: "freeze", name: "Freeze", short: "FRZ", color: "teal", good: false, desc: "Acts later and takes more Heat damage." },
  blind: { id: "blind", name: "Blind", short: "BLD", color: "gray", good: false, desc: "Attacks often miss." },
  haste: { id: "haste", name: "Haste", short: "HST", color: "lime", good: true, desc: "Acts more often." },
  slow: { id: "slow", name: "Slow", short: "SLW", color: "blue", good: false, desc: "Acts less often." },
  shield: { id: "shield", name: "Shield", short: "SHD", color: "salt", good: true, desc: "Takes half damage." },
  regen: { id: "regen", name: "Regen", short: "RGN", color: "green", good: true, desc: "Recovers HP every turn." },
  taunt: { id: "taunt", name: "Taunt", short: "TNT", color: "red", good: true, desc: "Enemies aim at this one." },
  doom: { id: "doom", name: "Doom", short: "DOM", color: "dark", good: false, desc: "Dies when the count runs out." },
  atkup: { id: "atkup", name: "Attack up", short: "AT+", color: "red", good: true, desc: "Deals more damage." },
  atkdown: { id: "atkdown", name: "Attack down", short: "AT-", color: "red", good: false, desc: "Deals less damage." },
  defup: { id: "defup", name: "Defense up", short: "DF+", color: "blue", good: true, desc: "Takes less damage." },
  defdown: { id: "defdown", name: "Defense down", short: "DF-", color: "blue", good: false, desc: "Takes more damage." },
  magup: { id: "magup", name: "Magic up", short: "MG+", color: "pink", good: true, desc: "Spells hit harder." },
  magdown: { id: "magdown", name: "Magic down", short: "MG-", color: "pink", good: false, desc: "Spells are weaker." },
  lit: { id: "lit", name: "Lit", short: "LIT", color: "white", good: true, desc: "Glows. Light skills and moth hunger feed on it." },
  silence: { id: "silence", name: "Silence", short: "SIL", color: "gray", good: false, desc: "Cannot use skills." },
  brace: { id: "brace", name: "Brace", short: "BRC", color: "orange", good: true, desc: "Next attack deals double." },
};
