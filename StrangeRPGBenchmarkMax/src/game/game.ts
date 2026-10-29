// Which screen is active, shared by every module that can change it.
import type { BattleScreen } from '../battle/ui';

export type Mode = 'splash' | 'title' | 'field' | 'battle' | 'menu' | 'sticks' | 'credits' | 'shop' | 'post';

export interface Screen { update(dt: number): void; render(): void }

export const GAME = {
  mode: 'splash' as Mode,
  battle: null as BattleScreen | null,
  overlay: null as Screen | null,
  scenes: 0,
  /** Set by main: leaves the game for the title screen. */
  toTitle: null as (() => void) | null,
};
