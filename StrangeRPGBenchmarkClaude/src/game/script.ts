import type { GameState, Dir } from './state';
import { addItem, healAll, join, leave } from './state';
import { ITEMS } from '../data/items';
import { MEMBERS } from '../data/members';
import type { SpriteSpec } from '../core/sprites';
import type { Col } from '../core/palette';

export type BattleResult = 'win' | 'lose' | 'flee';
export type Script = (s: Ctx) => Promise<void>;

export interface BattleOpts {
  /** Losing continues the script instead of ending the game. */
  canLose?: boolean;
  /** Stops the battle after this many party turns and counts as a win. */
  survive?: number;
  music?: string;
}

/** Everything a map script can do. The real game and the headless sim each implement the UI half. */
export abstract class Ctx {
  constructor(public st: GameState) {}

  abstract say(who: string, text: string, spr?: SpriteSpec): Promise<void>;
  abstract ask(q: string, opts: string[]): Promise<number>;
  abstract battle(group: string, o?: BattleOpts): Promise<BattleResult>;
  abstract warp(map: string, marker: string, dir?: Dir): Promise<void>;
  abstract fadeOut(): Promise<void>;
  abstract fadeIn(): Promise<void>;
  abstract wait(frames: number): Promise<void>;
  abstract shop(id: string): Promise<void>;
  abstract card(chapter: number): Promise<void>;
  abstract moveEnt(id: string, path: string): Promise<void>;
  abstract movePlayer(path: string): Promise<void>;
  abstract face(dir: Dir): void;
  abstract sfx(n: string): void;
  abstract music(n: string): void;
  abstract shake(frames: number): void;
  abstract flash(c: Col): Promise<void>;
  abstract ending(kind: string): Promise<void>;
  abstract refresh(): void;
  abstract setEnt(id: string, patch: { hidden?: boolean; spr?: SpriteSpec }): void;
  abstract greyWorld(on: boolean): void;
  abstract save(): void;
  abstract title(): void;

  /** Narration without a speaker. */
  async tell(text: string): Promise<void> {
    await this.say('', text);
  }

  flag(k: string, v: number | string | boolean = true) {
    this.st.flags[k] = v;
    this.refresh();
  }
  has(k: string): boolean {
    return !!this.st.flags[k];
  }
  get(k: string): number {
    return +(this.st.flags[k] ?? 0);
  }
  inc(k: string, n = 1): number {
    const v = this.get(k) + n;
    this.st.flags[k] = v;
    return v;
  }

  async give(id: string, n = 1, quiet = false) {
    addItem(this.st, id, n);
    this.sfx('chest');
    if (!quiet) await this.tell(`Got ^y${ITEMS[id]?.name ?? id}^0${n > 1 ? ` x${n}` : ''}.`);
  }
  take(id: string, n = 1) {
    addItem(this.st, id, -n);
  }
  hasItem(id: string): boolean {
    return (this.st.items[id] ?? 0) > 0;
  }
  async gold(n: number, quiet = false) {
    this.st.gold += n;
    this.sfx('coin');
    if (!quiet) await this.tell(n >= 0 ? `Got ^y${n} gold^0.` : `Paid ^y${-n} gold^0.`);
  }
  /** Adds a member. New members take the last active slot so their mechanic gets used, and the member they replace waits in reserve. */
  async join(id: string, lvl?: number) {
    join(this.st, id, lvl);
    this.sfx('lvl');
    await this.tell(`^y${MEMBERS[id].name}^0 joins the party.`);
    const bumped = this.toParty(id);
    if (bumped) await this.tell(`${MEMBERS[bumped].name} waits in reserve. Change the order under Party in the menu.`);
    this.refresh();
  }

  /** Moves a member into the active party, returning whoever was moved to reserve. */
  toParty(id: string): string | null {
    const st = this.st;
    if (st.party.includes(id)) return null;
    st.reserve = st.reserve.filter(r => r !== id);
    if (st.party.length < 4) { st.party.push(id); return null; }
    const out = st.party[3];
    st.party[3] = id;
    st.reserve.unshift(out);
    return out;
  }
  leave(id: string) {
    leave(this.st, id);
    this.refresh();
  }
  heal() {
    healAll(this.st);
    this.sfx('heal');
  }
  mech(m: string) {
    if (!this.st.mech.includes(m)) this.st.mech.push(m);
  }
  chapter(n: number) {
    this.st.chapter = n;
  }
  inParty(id: string): boolean {
    return this.st.party.includes(id) || this.st.reserve.includes(id);
  }
}
