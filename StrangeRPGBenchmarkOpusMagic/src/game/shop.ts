// Seals, the things blanks buy, and the shop screen Carry and Weigh share.
import { sfx } from '../engine/audio';
import { CW, text, wrap } from '../engine/font';
import { tapped } from '../engine/input';
import { H, W, rect } from '../engine/screen';
import { drawSprite } from '../engine/sprites';
import { Scene, app } from './app';
import { PageData, SaveData } from './state';
import { C, panel } from './ui';

export interface Seal { id: string; doc: string; color: number }

/** A seal sits on one page and changes how that page runs. */
export const SEALS: Record<string, Seal> = {
  thrift: { id: 'thrift', doc: 'The first verb of every cast costs 1 less ink.', color: 0x9fd88a },
  heavy: { id: 'heavy', doc: 'The first harm of every cast is 3 higher.', color: 0xff8a7a },
  room: { id: 'room', doc: 'The page holds 2 more lines.', color: 0x6fe3e0 },
};

export function sealOf(s: SaveData, p: PageData): Seal | null {
  return SEALS[s.pageSeals[p.id]] ?? null;
}

/** Seals of a kind not yet set on a page. */
export function freeSeals(s: SaveData, id: string): number {
  const used = Object.values(s.pageSeals).filter((x) => x === id).length;
  return (s.seals[id] ?? 0) - used;
}

interface Ware { id: string; name: string; doc: string; price: (s: SaveData) => number; max?: (s: SaveData) => boolean; buy: (s: SaveData) => void }

const have = (s: SaveData, k: string) => s.items[k] ?? 0;
const add = (s: SaveData, k: string) => { s.items[k] = have(s, k) + 1; };

const WARES: Ware[] = [
  { id: 'salve', name: 'salve', doc: 'Heals 12.', price: () => 5, buy: (s) => add(s, 'salve') },
  { id: 'inkpot', name: 'inkpot', doc: '6 ink.', price: () => 6, buy: (s) => add(s, 'inkpot') },
  { id: 'bell', name: 'bell', doc: 'Gets one who fell back up.', price: () => 12, buy: (s) => add(s, 'bell') },
  ...Object.values(SEALS).map((x): Ware => ({
    id: `seal_${x.id}`, name: `${x.id} seal`, doc: `${x.doc} Set it from your rote.`,
    price: (s) => 20 + 12 * (s.seals[x.id] ?? 0), max: (s) => (s.seals[x.id] ?? 0) >= 3,
    buy: (s) => { s.seals[x.id] = (s.seals[x.id] ?? 0) + 1; },
  })),
  { id: 'thick', name: 'thick page', doc: 'Wait holds 3 more health, for good.', price: (s) => 30 + 15 * have(s, 'thick'), max: (s) => have(s, 'thick') >= 5, buy: (s) => add(s, 'thick') },
  { id: 'deep', name: 'deep pot', doc: 'Wait holds 1 more ink, for good.', price: (s) => 35 + 20 * have(s, 'deep'), max: (s) => have(s, 'deep') >= 4, buy: (s) => add(s, 'deep') },
];

/** Places the cart goes, each with the map and tile it stops at. */
export const STOPS: { region: string; name: string; map: string; x: number; y: number }[] = [
  { region: 'busy', name: 'Busy', map: 'busy', x: 19, y: 14 },
  { region: 'river', name: 'the river', map: 'river', x: 5, y: 24 },
  { region: 'standing', name: 'Standing', map: 'standing', x: 23, y: 26 },
  { region: 'twice', name: 'Twice', map: 'twice', x: 28, y: 17 },
  { region: 'ears', name: 'the Ears', map: 'ears', x: 2, y: 14 },
  { region: 'tether', name: 'the Tether', map: 'rung1', x: 12, y: 16 },
];

/** Carry's cart, or Weigh's table. Who sells only changes the greeting. Carry also gives rides. */
export class Shop implements Scene {
  opaque = true;
  i = 0;
  tab: 'buy' | 'ride' = 'buy';
  msg = '';
  msgColor: number = C.dim;
  constructor(
    private keeper: string, private sprite: string, private greet: string, private done?: () => void,
    private ride?: (map: string, x: number, y: number) => void, private here = '',
  ) {}

  private stops() {
    const s = app.s;
    return STOPS.filter((st) => s.flags[`visited_${st.region}`] && st.region !== this.here);
  }

  update() {
    const s = app.s;
    if (tapped('back')) { app.pop(); sfx.back(); this.done?.(); return; }
    if (this.ride && (tapped('left') || tapped('right'))) { this.tab = this.tab === 'buy' ? 'ride' : 'buy'; this.i = 0; this.msg = ''; sfx.move(); }
    if (this.tab === 'ride') { this.updateRide(); return; }
    if (tapped('up')) { this.i = (this.i + WARES.length - 1) % WARES.length; sfx.move(); }
    if (tapped('down')) { this.i = (this.i + 1) % WARES.length; sfx.move(); }
    if (tapped('ok')) {
      const w = WARES[this.i];
      const price = w.price(s);
      if (w.max?.(s)) { this.say('That is all of those there are.', C.dim); sfx.error(); return; }
      if (s.blanks < price) { this.say(`${price} blanks. You have ${s.blanks}.`, C.bad); sfx.error(); return; }
      s.blanks -= price;
      w.buy(s);
      this.say(`${w.name}. ${s.blanks} blanks left.`, C.good);
      sfx.get();
    }
  }

  private updateRide() {
    const list = this.stops();
    if (!list.length) return;
    if (tapped('up')) { this.i = (this.i + list.length - 1) % list.length; sfx.move(); }
    if (tapped('down')) { this.i = (this.i + 1) % list.length; sfx.move(); }
    if (tapped('ok')) {
      if (app.s.chapter === 6) { this.say('The wheels are copied. They only go round here.', C.again); sfx.error(); return; }
      const st = list[this.i];
      app.pop();
      sfx.door();
      this.done?.();
      this.ride?.(st.map, st.x, st.y);
    }
  }

  private say(m: string, c: number) { this.msg = m; this.msgColor = c; }

  draw() {
    const s = app.s;
    rect(0, 0, W, H, 0x0b0a10);
    drawSprite(this.sprite, 6, 4);
    text(this.keeper, 18, 4, C.text);
    const bl = `${s.blanks} blanks`;
    text(bl, W - 4 - bl.length * CW, 4, C.gold);
    wrap(this.greet, 36).slice(0, 2).forEach((l, k) => text(l, 6, 16 + k * 8, C.dim));
    if (this.ride) text(this.tab === 'buy' ? '[buy] ride' : ' buy [ride]', 70, 4, C.hi);
    if (this.tab === 'ride') { this.drawRide(); return; }
    WARES.forEach((w, k) => {
      const y = 38 + k * 10;
      const sel = k === this.i;
      const out = w.max?.(s);
      if (sel) rect(4, y - 2, W - 8, 10, 0x2a2440);
      text(w.name, 8, y, out ? C.faint : sel ? C.hi : C.text);
      const own = w.id.startsWith('seal_') ? s.seals[w.id.slice(5)] ?? 0 : have(s, w.id);
      if (own) text(`x${own}`, 8 + (w.name.length + 1) * CW, y, C.faint);
      const pr = out ? '--' : `${w.price(s)}`;
      text(pr, W - 8 - pr.length * CW, y, out ? C.faint : s.blanks >= w.price(s) ? C.gold : C.dim);
    });
    const w = WARES[this.i];
    panel(4, H - 42, W - 8, 38, C.faint);
    wrap(w.doc, 35).slice(0, 2).forEach((l, k) => text(l, 8, H - 38 + k * 8, C.text));
    if (this.msg) text(this.msg.slice(0, 35), 8, H - 20, this.msgColor);
    text(this.ride ? 'Z buy  X leave  arrows: ride' : 'Z buy  X leave', 8, H - 11, C.faint);
  }

  private drawRide() {
    const list = this.stops();
    if (!list.length) text('Nowhere yet. Carry goes where you have been.', 8, 40, C.dim);
    list.forEach((st, k) => {
      const y = 38 + k * 10;
      if (k === this.i) rect(4, y - 2, W - 8, 10, 0x2a2440);
      text(st.name, 8, y, k === this.i ? C.hi : C.text);
    });
    panel(4, H - 42, W - 8, 38, C.faint);
    wrap('The cart gets there first. You get there second, which is soon after.', 35).slice(0, 2).forEach((l, k) => text(l, 8, H - 38 + k * 8, C.dim));
    if (this.msg) text(this.msg.slice(0, 35), 8, H - 20, this.msgColor);
    text('Z ride  X leave', 8, H - 11, C.faint);
  }
}
