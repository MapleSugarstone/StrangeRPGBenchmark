// Battle messages written by Qwen (Notes/qwen/asks/20261103-112303-battle-lines.md, *-sends-out.md, *-passive-line.md).
export const LINES = {
  stunned: "{name} is stunned. It cannot act.",
  asleep: "{name} is asleep. It cannot act.",
  windup: "{name} winds up {move}!",
  land: "{name}'s {move} lands for {n} damage.",
  broken: "{name}'s {move} fizzles out.",
  strong: "It hits hard!",
  weak: "It barely scratches.",
  tick: "{name} takes {n} from {status}.",
  regen: "{name} heals {n} HP.",
  thorns: "{name} takes {n} from Thorns.",
  stasis: "{name}'s Stasis blocks {status}.",
  fades: "{status} fades from {name}.",
  unlink: "The Link breaks.",
  next: "Choose your next Ruin.",
  rises: "{foe} rises.",
  passive: "{name} activates {passive}.",
};

/** Each type's plain hit, the Attack command (Qwen, *-seals-basics.md and *-fire-basic.md). */
export const BASIC_NAMES: Record<string, string> = {
  Stone: "Glass Slam", Metal: "Rust Bite", Aether: "Void Pulse", Wood: "Splinter", Fire: "Hot Ash", Void: "Null Touch",
};

/** Starts a line that comes from a passive, a Resonance, or a Field State, so the battle box may pack several of them
 * into one screen. The battle scene strips it before drawing. */
export const PACK = "\u0007";

export function line(key: keyof typeof LINES, fill: Record<string, string | number> = {}): string {
  return LINES[key].replace(/\{(\w+)\}/g, (_, k) => String(fill[k] ?? ""));
}
