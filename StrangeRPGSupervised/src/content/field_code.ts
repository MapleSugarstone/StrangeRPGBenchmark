// What each Field State does, as code over the passive hooks: Qwen's words (field_states.ts), Claude's code.
// A Field State's hooks run for every Ruin in the battle, on both sides, so an effect that happens once a turn is
// written from the point of view of the one Ruin it lands on.
import type { PassiveCode } from '../battle/hooks.js';
import { addStatus, hurt, typeOf } from '../battle/passive_kit.js';
import { pushBack, speedOf } from '../battle/engine.js';

export const FIELD_CODE: Record<string, PassiveCode> = {
  // "Silence blocks moves. Aether Ruins ignore Silence." Every other Ruin is Silenced as it comes onto the field.
  Fog: {
    enter: (c) => { if (typeOf(c.self) !== 'Aether') addStatus(c, c.self, 'Silence'); },
    status: (c, status) => (status === 'Silence' && typeOf(c.self) === 'Aether' ? false : undefined),
  },
  // "Wind knocks back. The slower Ruin switches to Reserve." At each turn's end the slower fighting Ruin is sent back.
  Gale: {
    turnEnd: (c) => {
      if (c.foe.isFainted || c.self !== c.team[0]) return;
      if (speedOf(c.self, c.state) < speedOf(c.foe, c.state)) {
        const lines: string[] = [];
        if (pushBack(c.state, c.self, lines)) lines.forEach((l) => c.say(l));
      }
    },
  },
  // "Water drowns. The Ruin with lowest HP takes 10% damage." Each turn's end, of the two fighting.
  'High Tide': {
    turnEnd: (c) => { if (!c.foe.isFainted && c.self === c.team[0] && c.self.hp < c.foe.hp) hurt(c, c.self, c.self.maxHp * 0.1); },
  },
  // "Stars fall. The Ruin with highest ATK takes 10% damage." Each turn's end, of the two fighting.
  Starfall: {
    turnEnd: (c) => {
      if (!c.foe.isFainted && c.self === c.team[0] && c.self.currentStats.atk > c.foe.currentStats.atk) hurt(c, c.self, c.self.maxHp * 0.1);
    },
  },
};
