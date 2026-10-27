// Shared pieces for field puzzles (Notes/puzzle-design.md): a prize that stands in view, and the payoff when a puzzle is solved.
import { sfx } from '../engine/audio';
import type { SpriteData } from '../battle/model';
import { emote, field, morph, narr, wait } from '../game/api';
import { G, flag, setFlag } from '../game/state';
import { strandFx } from '../game/strandfx';
import { defScript, type NpcDef } from '../game/world';
import { reward, type Reward } from './areakit';

/** A shell tied up in a scrap of net, with a glint on it: what a puzzle's prize looks like on the floor. */
const PRIZE: SpriteData = { px: ['........', '....3...', '...323..', '..12221.', '.122222.', '.122322.', '..1111..', '........'], c: ['#e8d8b0', '#fff4c4'] };

/** A prize that stands in view and hops now and then. Pressing at it takes it, and it is gone after. It may sit on a bank or a shelf. */
export function prize(id: string, x: number, y: number, line: string, r: Reward, when?: () => boolean): NpcDef {
  defScript(id, async () => {
    setFlag('found_' + id);
    sfx('level');
    await narr(line);
    await reward(r);
  });
  return { id, x, y, sprite: 'stone', name: 'A find', dir: 0, img: () => PRIZE, talk: id, onSolid: true, idle: { every: 150, act: 'hop' }, when: () => !flag('found_' + id) && (!when || when()) };
}

/** Whether a tile is on the screen now. */
function inSight(x: number, y: number): boolean {
  const [cx, cy] = field.cam;
  return x * 8 >= cx && x * 8 + 8 <= cx + 192 && y * 8 >= cy && y * 8 + 8 <= cy + 192;
}

/**
 * The payoff of a solved puzzle at a tile: the camera goes there when it is off the screen, a star lands on it with a
 * chime, and the change that `key` makes fades in. With no key, only the star and the chime play.
 */
export async function payoff(at: [number, number], key?: string, value = 1): Promise<void> {
  const away = !inSight(at[0], at[1]);
  if (away) await field.pan(at[0], at[1]);
  strandFx.landings.push({ x: at[0], y: at[1], t: 0 });
  await wait(24);
  sfx('level');
  if (key) {
    const old = G.flags[key] || 0;
    await morph(on => { G.flags[key] = on ? value : old; }, at, 3, false);
  }
  await wait(30);
  if (away) await field.panBack();
}

/** Whether Ouro stands on one of a puzzle's reset tiles. An enter script also runs on loading a save, so it resets a puzzle only then. */
export function atReset(tiles: [number, number][]): boolean {
  return tiles.some(([x, y]) => field.x === x && field.y === y);
}

/** The first time Ouro reaches a keeper's floor, the keeper notices. Put on the hall's top floor as a trigger. */
export function hallTop(hall: string, keeper: string): () => Promise<void> {
  return async () => {
    setFlag('top_' + hall);
    strandFx.landings.push({ x: field.x, y: field.y, t: 0 });
    sfx('level');
    await emote(keeper, 'surprise');
  };
}
