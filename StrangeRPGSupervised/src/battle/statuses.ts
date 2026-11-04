/**
 * Status effects that can afflict a Ruin during battle.
 * Each status has a duration (in turns) and a tick function.
 * Duration 0 means permanent or conditional (ended by specific event).
 */
export enum Status {
  Stun = 'Stun',       // Cannot act. Ends after 1 turn.
  Silence = 'Silence',  // Cannot use moves. Ends after 2 turns.
  Sleep = 'Sleep',      // Cannot act. Ends after 1-2 turns (randomized in sim, but deterministic here via fixed duration for now).
  Root = 'Root',        // Cannot switch or run. Ends after 3 turns.
  Taunt = 'Taunt',      // Must attack. Ends after 2 turns.
  Slow = 'Slow',        // AGI reduced by 50%. Ends after 3 turns.
  Haste = 'Haste',      // AGI increased by 50%. Ends after 3 turns.
  Burn = 'Burn',        // Takes damage at end of turn. Ends after 3 turns.
  Bleed = 'Bleed',      // Takes damage at end of turn. Ends after 3 turns.
  Poison = 'Poison',    // Takes damage at end of turn. Ends after 3 turns.
  Rot = 'Rot',          // DEF reduced by 20%. Ends after 3 turns.
  Expose = 'Expose',    // DEF reduced by 20%. Ends after 3 turns.
  Weaken = 'Weaken',    // ATK reduced by 20%. Ends after 3 turns.
  Fortify = 'Fortify',  // DEF increased by 20%. Ends after 3 turns.
  Empower = 'Empower',  // ATK increased by 20%. Ends after 3 turns.
  Stasis = 'Stasis',    // Immune to status. Ends after 3 turns.
  Unstoppable = 'Unstoppable', // Ignores interruption. Ends after 3 turns.
  Ward = 'Ward',        // Reduces damage by 20%. Ends after 3 turns.
  Thorns = 'Thorns',    // Reflects damage. Ends after 3 turns.
  Regen = 'Regen',      // Heals at end of turn. Ends after 3 turns.
}

/**
 * Default duration in turns for each status.
 * These are the initial durations when applied.
 */
const STATUS_DURATIONS: Record<Status, number> = {
  [Status.Stun]: 1,
  [Status.Silence]: 2,
  [Status.Sleep]: 2,
  [Status.Root]: 3,
  [Status.Taunt]: 2,
  [Status.Slow]: 3,
  [Status.Haste]: 3,
  [Status.Burn]: 3,
  [Status.Bleed]: 3,
  [Status.Poison]: 3,
  [Status.Rot]: 3,
  [Status.Expose]: 3,
  [Status.Weaken]: 3,
  [Status.Fortify]: 3,
  [Status.Empower]: 3,
  [Status.Stasis]: 3,
  [Status.Unstoppable]: 3,
  [Status.Ward]: 3,
  [Status.Thorns]: 3,
  [Status.Regen]: 3,
};

/**
 * Damage per turn for damage-over-time statuses.
 */
const STATUS_DAMAGE: Record<Status, number> = {
  [Status.Burn]: 5,
  [Status.Bleed]: 4,
  [Status.Poison]: 4,
  [Status.Rot]: 0,
  [Status.Expose]: 0,
  [Status.Weaken]: 0,
  [Status.Fortify]: 0,
  [Status.Empower]: 0,
  [Status.Stun]: 0,
  [Status.Silence]: 0,
  [Status.Sleep]: 0,
  [Status.Root]: 0,
  [Status.Taunt]: 0,
  [Status.Slow]: 0,
  [Status.Haste]: 0,
  [Status.Stasis]: 0,
  [Status.Unstoppable]: 0,
  [Status.Ward]: 0,
  [Status.Thorns]: 0,
  [Status.Regen]: 0,
};

/**
 * Represents a status instance on a Ruin.
 */
export interface StatusInstance {
  status: Status;
  turnsLeft: number;
}

/**
 * Applies a status to a Ruin, resetting its duration.
 */
export function applyStatus(currentStatus: StatusInstance | null, newStatus: Status): StatusInstance {
  return {
    status: newStatus,
    turnsLeft: STATUS_DURATIONS[newStatus],
  };
}

/**
 * Ticks down all statuses on a Ruin at the end of a turn.
 * Returns the new HP, whether the Ruin fainted, and a log of effects.
 */
export function tickStatuses(ruinHp: number, statuses: StatusInstance[], maxHp: number): { newHp: number, faint: boolean, log: string[] } {
  let newHp = ruinHp;
  const log: string[] = [];
  const nextStatuses: StatusInstance[] = [];

  for (const s of statuses) {
    if (s.turnsLeft <= 0) continue;

    // Apply damage for DoT statuses
    if (STATUS_DAMAGE[s.status] > 0) {
      const dmg = STATUS_DAMAGE[s.status];
      newHp -= dmg;
      log.push(`${s.status} deals ${dmg} damage.`);
    }

    // Apply healing for Regen
    if (s.status === Status.Regen) {
      // Regen heals for 10% of max HP
      const heal = Math.floor(maxHp * 0.1);
      newHp += heal;
      log.push(`Regen heals ${heal} HP.`);
    }

    // Decrease duration
    nextStatuses.push({
      status: s.status,
      turnsLeft: s.turnsLeft - 1,
    });
  }

  if (newHp <= 0) {
    return { newHp: 0, faint: true, log };
  }

  return { newHp, faint: false, log };
}
