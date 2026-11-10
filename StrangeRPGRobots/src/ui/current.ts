// Current: riding a data current on the port. Lanes scroll toward the rider. Frost shards cost integrity, ICE
// pickets need a duck under them, eddies pull the rider sideways, and packets are worth picking up.
import { rect, frame, box, blitUI, img, upx, type Img } from '../engine/gfx';
import { drawText, textWidth } from '../engine/font';
import { C } from '../engine/palette';
import { W, H } from '../engine/screen';
import { pressed, MOUSE, mouseActive, consume } from '../engine/input';
import { sfx } from '../audio/sfx';
import { SURF, type SurfDef } from '../content/undertow_puzzles';
import { hacker, hintBar, resultBox, titleBar, type Minigame } from './minigame';
import { personSheet } from '../art/people';
import { G } from '../game/state';

type Kind = 'shard' | 'picket' | 'eddy' | 'packet' | 'gate';
interface Thing { kind: Kind; lane: number; span: number; y: number; dir: number; used?: boolean }

const LANE = 26, RIDER_Y = 148, TOP = 33;
const SHARD = img(['....1.....', '...121....', '...1231...', '..12331...', '..123331..', '.1233321..', '.12233221.', '..122221..', '...1111...', '..........'], [C.steel2, C.steel3, C.pale]);
const PACKET = img(['..00..', '.0220.', '022320', '023220', '.0220.', '..00..'], [C.cyan0, C.cyan3, C.white]);

export class Current implements Minigame {
  def: SurfDef;
  lanes: number;
  x0: number;
  lane: number;
  rx: number;
  hitsMax: number;
  hits: number;
  length: number;
  dist = 0;
  goal: number;
  speed: number;
  things: Thing[] = [];
  nextRow = 0;
  duck = 0;
  duckCool = 0;
  invuln = 0;
  flash = 0;
  t = 0;
  phase: 'intro' | 'play' | 'done' = 'intro';
  done = false;
  won = false;
  bonus: string[] = [];
  count = 0;
  diff: number;
  who: { name: string; pool: number };
  rider: Img[];

  constructor(id: string) {
    this.def = SURF.get(id) ?? { id, difficulty: 2 };
    this.diff = Math.max(1, Math.min(4, this.def.difficulty));
    this.who = hacker();
    this.lanes = Math.max(3, Math.min(5, this.def.lanes ?? (this.diff >= 3 ? 5 : 4)));
    this.x0 = Math.round((W - this.lanes * LANE) / 2);
    this.lane = Math.floor(this.lanes / 2);
    this.rx = this.laneX(this.lane);
    this.hitsMax = this.def.hits ?? 3 + (this.who.pool >= 8 ? 1 : 0);
    this.hits = this.hitsMax;
    this.length = this.def.length ?? [30, 38, 46, 54][this.diff - 1];
    this.speed = 55 + this.diff * 8;
    this.goal = this.length * (this.speed + 20);
    this.nextRow = 90;
    const sh = personSheet(G.look);
    this.rider = sh.frames.up;
  }

  laneX(l: number): number { return this.x0 + l * LANE + LANE / 2; }

  spawnRow() {
    const L = this.lanes;
    const late = this.dist / this.goal;
    const r = Math.random();
    const y = TOP - 14;
    const busy = new Set<number>();
    if (r < 0.18 + late * 0.1 && this.dist > 300) {
      const span = Math.random() < 0.4 ? L : 2 + Math.floor(Math.random() * (L - 1));
      const lane = Math.floor(Math.random() * (L - span + 1));
      this.things.push({ kind: 'picket', lane, span, y, dir: 0 });
      for (let i = lane; i < lane + span; i++) busy.add(i);
    } else if (r < 0.32 && this.diff >= 2) {
      const lane = Math.floor(Math.random() * L);
      const dir = lane === 0 ? 1 : lane === L - 1 ? -1 : Math.random() < 0.5 ? -1 : 1;
      this.things.push({ kind: 'eddy', lane, span: 1, y, dir });
      busy.add(lane);
    } else {
      const k = 1 + Math.floor(Math.random() * Math.min(L - 1, 1 + this.diff + Math.floor(late * 2)));
      const lanes = [...Array(L).keys()].sort(() => Math.random() - 0.5).slice(0, Math.min(k, L - 1));
      for (const l of lanes) { this.things.push({ kind: 'shard', lane: l, span: 1, y, dir: 0 }); busy.add(l); }
    }
    if (Math.random() < 0.45) {
      const free = [...Array(L).keys()].filter((l) => !busy.has(l));
      if (free.length) this.things.push({ kind: 'packet', lane: free[Math.floor(Math.random() * free.length)], span: 1, y: y - 22, dir: 0 });
    }
  }

  update(dt: number) {
    this.t += dt;
    if (this.phase === 'intro') {
      if (pressed('a') || MOUSE.left) { consume(); this.phase = 'play'; sfx('port'); }
      if (pressed('b')) { consume(); this.phase = 'done'; this.won = false; }
      return;
    }
    if (this.phase === 'done') {
      if (pressed('a') || pressed('b') || MOUSE.left) { consume(); this.done = true; }
      return;
    }
    const L = this.lanes;
    if (pressed('left') && this.lane > 0) { this.lane--; sfx('cursor', { vol: 0.3 }); }
    if (pressed('right') && this.lane < L - 1) { this.lane++; sfx('cursor', { vol: 0.3 }); }
    if (mouseActive() && MOUSE.moved) {
      const l = Math.floor((MOUSE.x - this.x0) / LANE);
      if (l >= 0 && l < L) this.lane = l;
    }
    this.duckCool -= dt;
    if ((pressed('a') || pressed('up') || MOUSE.left) && this.duck <= 0 && this.duckCool <= 0) { consume(); this.duck = 0.6; this.duckCool = 0.35; sfx('splash', { vol: 0.4 }); }
    this.duck = Math.max(0, this.duck - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.flash = Math.max(0, this.flash - dt);
    const tx = this.laneX(this.lane);
    this.rx += Math.sign(tx - this.rx) * Math.min(Math.abs(tx - this.rx), 220 * dt);

    const late = Math.min(1, this.dist / this.goal);
    const v = this.speed + late * (30 + this.diff * 6);
    this.dist += v * dt;
    for (const th of this.things) th.y += v * dt;
    this.nextRow -= v * dt;
    if (this.nextRow <= 0 && this.dist < this.goal - 120) {
      this.spawnRow();
      this.nextRow = Math.max(46, 92 - this.diff * 8 - late * 26);
    }
    if (this.dist >= this.goal - 120 && !this.things.some((t) => t.kind === 'gate')) this.things.push({ kind: 'gate', lane: 0, span: L, y: TOP - 14, dir: 0 });

    const lane = Math.round((this.rx - this.x0 - LANE / 2) / LANE);
    for (const th of this.things) {
      if (th.used) continue;
      const top = th.y, bot = th.y + (th.kind === 'picket' ? 4 : 10);
      if (bot < RIDER_Y + 2 || top > RIDER_Y + 9) continue;
      const inLane = lane >= th.lane && lane < th.lane + th.span;
      if (th.kind === 'gate') { th.used = true; this.finish(true); return; }
      if (!inLane) continue;
      if (th.kind === 'packet') { th.used = true; this.count++; sfx('loot', { vol: 0.5 }); continue; }
      if (th.kind === 'eddy') {
        th.used = true;
        const to = Math.max(0, Math.min(L - 1, this.lane + th.dir));
        if (to !== this.lane) { this.lane = to; sfx('splash', { vol: 0.5 }); }
        continue;
      }
      if (th.kind === 'picket' && this.duck > 0) continue;
      if (this.invuln > 0) continue;
      th.used = true;
      this.hits--;
      this.invuln = 0.9;
      this.flash = 0.25;
      sfx('hit');
      if (this.hits <= 0) { this.finish(false); return; }
    }
    this.things = this.things.filter((t) => t.y < H + 20);
  }

  finish(won: boolean) {
    this.phase = 'done';
    this.won = won;
    sfx(won ? 'quest' : 'fail');
  }

  render() {
    rect(0, 0, W, H, C.black);
    const x0 = this.x0, cw = this.lanes * LANE;
    const scroll = Math.floor(this.dist);
    for (let y = TOP; y < H - 16; y++) {
      const wy = y - scroll;
      for (let x = x0; x < x0 + cw; x++) {
        const k = ((x * 7 + Math.floor(wy / 3) * 13) % 23 + 23) % 23;
        if (((wy % 6) + 6) % 6 === 0 && k < 9) upx(x, y, C.cyan1);
        else if (k === 0) upx(x, y, C.cyan0);
      }
    }
    for (let l = 1; l < this.lanes; l++) for (let y = TOP; y < H - 16; y += 4) upx(x0 + l * LANE, y + (scroll % 4), C.cyan0);
    for (const side of [x0 - 5, x0 + cw + 1]) {
      rect(side, TOP, 4, H - 16 - TOP, C.steel3);
      rect(side + (side < x0 ? 3 : 0), TOP, 1, H - 16 - TOP, C.pale);
    }
    for (const th of this.things) {
      if (th.used && th.kind !== 'gate') continue;
      const cx = this.laneX(th.lane);
      const y = Math.round(th.y);
      if (y < TOP - 2 || y > H - 18) continue;
      if (th.kind === 'shard') blitUI(SHARD, cx - 5, y);
      else if (th.kind === 'packet') blitUI(PACKET, cx - 3, y + 2);
      else if (th.kind === 'picket') {
        const xa = x0 + th.lane * LANE + 1, w = th.span * LANE - 2;
        rect(xa, y, w, 3, C.pale);
        rect(xa, y + 3, w, 1, C.steel2);
        for (let px = xa + 2; px < xa + w; px += 6) rect(px, y - 2, 1, 2, C.white);
      } else if (th.kind === 'eddy') {
        for (let i = 0; i < 8; i++) {
          const a = this.t * 5 * th.dir + (i * Math.PI) / 4;
          const r = 2 + (i % 4);
          rect(Math.round(cx + Math.cos(a) * r), Math.round(y + 5 + Math.sin(a) * r * 0.6), 1, 1, i < 4 ? C.cyan3 : C.cyan2);
        }
      } else if (th.kind === 'gate') {
        rect(x0, y, cw, 2, C.cyan3);
        rect(x0, y + 2, cw, 1, C.cyan1);
        drawText('NODE', Math.round(x0 + cw / 2 - textWidth('NODE') / 2), y - 9, C.cyan4);
      }
    }
    const fr = this.rider[Math.floor(this.t * 6) % this.rider.length] ?? this.rider[0];
    const rx = Math.round(this.rx);
    const under = this.duck > 0;
    rect(rx - 6, RIDER_Y + 9, 12, 2, under ? C.cyan2 : C.cyan4);
    rect(rx - 4, RIDER_Y + 11, 8, 1, C.cyan2);
    for (let i = 0; i < 4; i++) rect(rx - 1 + ((i * 3) % 3) - 1, RIDER_Y + 13 + i * 3, 2, 1, i < 2 ? C.cyan2 : C.cyan1);
    if (!under) blitUI(fr, rx - Math.floor(fr.w / 2), RIDER_Y - fr.h + 9, false, this.flash > 0 ? C.mag3 : undefined);
    else for (let yy = 0; yy < 4; yy++) rect(rx - 4, RIDER_Y + 4 + yy, 8, 1, (yy & 1) ? C.cyan1 : C.cyan2);
    titleBar(this.def.title ?? 'Current', `${this.who.name}  Hack ${this.who.pool}`);
    const k = Math.min(1, this.dist / this.goal);
    frame(4, 16, W - 8, 4, C.cyan1);
    rect(5, 17, Math.round((W - 10) * k), 2, C.cyan3);
    for (let i = 0; i < this.hitsMax; i++) rect(6 + i * 6, 23, 4, 4, i < this.hits ? C.cyan4 : C.slate);
    const pk = `${this.count} packets`;
    drawText(pk, W - 6 - textWidth(pk), 22, C.cyan3);
    hintBar('Left, right: lane  Z: duck');
    if (this.phase === 'intro') {
      box(26, 70, W - 52, 52, C.ink, C.cyan3);
      drawText('Ride the current', 32, 74, C.cyan4);
      drawText('Dodge frost shards.', 32, 85, C.pale);
      drawText('Duck under white ICE.', 32, 94, C.pale);
      drawText('Z: ride  X: back', 32, 108, C.gray);
    }
    if (this.phase === 'done') resultBox(this.won ? 'Through' : 'Thrown off', this.won, [{ t: `${this.count} packets`, c: C.cyan3 }]);
  }
}
