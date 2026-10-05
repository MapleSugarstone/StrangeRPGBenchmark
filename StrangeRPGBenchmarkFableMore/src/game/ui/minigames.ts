import type { Input } from "../../engine/input";
import { type Screen, W, H } from "../../engine/screen";
import type { Scene } from "../../engine/scene";
import { deferred } from "../../engine/scene";
import { getSprite } from "../../engine/sprites";
import { colorInt, mixInt, PALETTE_INT } from "../../engine/palette";
import { drawBox } from "../../engine/dialogue";
import type { Audio } from "../../engine/audio";
import { Rng } from "../../engine/rng";
import { knotCells, KNOT_ALPHABET } from "../knots";

export interface MinigameResult {
  score: number;
  won: boolean;
}

/**
 * Hooking. The slack can fish downward. A weighted knot goes down a crack into
 * the Under. When the line twitches, press. Press too early and the bob jerks
 * and scares it, too late and it is gone. Three casts.
 */
export class HookScene implements Scene {
  opaque = false;
  private done = deferred<MinigameResult>();
  readonly promise = this.done.promise;
  private rng: Rng;
  private cast = 0;
  private rounds: number;
  private t = 0;
  private depth = 0;
  private twitchAt = 0;
  private state: "sinking" | "waiting" | "twitch" | "result" | "done" = "sinking";
  private caught = 0;
  private message = "";
  private resultT = 0;
  private bites: { x: number; y: number; t: number }[] = [];
  private fishX = 0;

  constructor(private audio: Audio, opts: { rounds?: number; hard?: boolean } = {}) {
    this.rounds = opts.rounds ?? 3;
    this.rng = new Rng(`hook${Date.now()}`);
    this.begin(opts.hard ?? false);
  }

  private hard = false;
  private begin(hard: boolean): void {
    this.hard = hard;
    this.t = 0;
    this.depth = 0;
    this.state = "sinking";
    this.twitchAt = 1.6 + this.rng.next() * (hard ? 4 : 3);
    this.fishX = this.rng.range(30, W - 40);
  }

  update(dt: number, input: Input): void {
    this.t += dt;
    if (this.state === "sinking") {
      this.depth = Math.min(90, this.depth + dt * 50);
      if (this.depth >= 90) { this.state = "waiting"; this.t = 0; }
      if (input.pressed("cancel")) { input.consume("cancel"); this.finish(); }
      return;
    }
    if (this.state === "waiting") {
      if (this.t >= this.twitchAt) { this.state = "twitch"; this.t = 0; this.audio.sfx("tension"); }
      if (input.pressed("ok")) { input.consume("ok"); this.miss("Too soon. The bob jerks. Something below turns away."); }
      if (input.pressed("cancel")) { input.consume("cancel"); this.finish(); }
      return;
    }
    if (this.state === "twitch") {
      const window = this.hard ? 0.45 : 0.7;
      if (input.pressed("ok")) {
        input.consume("ok");
        this.caught++;
        this.audio.sfx("snap");
        this.message = this.rng.pick(["A hook. Old, cold, from the Hull.", "A boot. There is a foot in it. There is not.", "A slug the size of a fist.", "Scale, a sheet of it, still wet.", "A bone with a knot tied in it.", "A lure somebody else lost.", "Something that bites back. Fathom lets it."]);
        this.state = "result";
        this.resultT = 0;
        return;
      }
      if (this.t > window) this.miss("Gone. The line goes light.");
      return;
    }
    if (this.state === "result") {
      this.resultT += dt;
      if (this.resultT > 1.4 || input.pressed("ok")) {
        input.consume("ok");
        this.cast++;
        if (this.cast >= this.rounds) this.finish();
        else this.begin(this.hard);
      }
    }
  }

  private miss(text: string): void {
    this.audio.sfx("miss");
    this.message = text;
    this.state = "result";
    this.resultT = 0;
  }

  private finish(): void {
    if (this.state === "done") return;
    this.state = "done";
    this.done.resolve({ score: this.caught, won: this.caught >= Math.ceil(this.rounds / 2) });
  }

  draw(s: Screen): void {
    s.dimRect(0, 0, W, H, 0.6);
    drawBox(s, 10, 20, W - 20, H - 40);
    s.text(`Hooking. Cast ${Math.min(this.cast + 1, this.rounds)} of ${this.rounds}. Caught ${this.caught}.`, 16, 25, "gold");
    // The crack: ground at the top, black water below
    const gy = 40;
    s.dither(16, gy, W - 32, 6, "coal", "ink");
    s.rect(16, gy + 6, W - 32, 110, "black");
    for (let y = gy + 14; y < gy + 110; y += 9) for (let x = 16; x < W - 16; x++) if (((x + y) >> 2) % 6 === 0) s.px(x, y, mixInt(colorInt("sea"), PALETTE_INT.black, 0.5));
    // The line and the bob
    const bx = W / 2;
    const jerk = this.state === "twitch" ? Math.round(Math.sin(this.t * 60) * 2) : 0;
    s.vline(bx + jerk, gy, gy + 6 + Math.round(this.depth), colorInt("teal"));
    s.sprite(getSprite("item", "weight", "weight"), bx - 4 + jerk, gy + 6 + Math.round(this.depth), "bone", "teal");
    // A shape passes in the dark, now and then
    if (this.state === "waiting" || this.state === "twitch") {
      const fx = this.fishX + Math.round(Math.sin(this.t * 1.3) * 20);
      const fy = gy + 60 + Math.round(Math.cos(this.t * 0.9) * 12);
      s.sprite(getSprite("creature", "hookfish", "flyer"), fx, fy, mixInt(colorInt("sea"), PALETTE_INT.black, 0.6), mixInt(colorInt("teal"), PALETTE_INT.black, 0.6));
    }
    const help = this.state === "sinking" ? "The bob sinks..." : this.state === "waiting" ? "Wait for the twitch. Then confirm." : this.state === "twitch" ? "NOW." : this.message;
    s.text(help.slice(0, 50), 16, H - 36, this.state === "twitch" ? "gold" : "bone");
    s.text("Cancel reels in.", 16, H - 28, "ash");
  }
}

/**
 * Knot tying. A knot is a sequence of turns: over, under, through, pull.
 * Watch it tied, then tie it. Used to learn knots early and to open things.
 */
export interface KnotTieOpts {
  hard?: boolean;
  /** A fixed sequence of step indexes instead of a seeded one. */
  seq?: number[];
  /** Names of the four steps, in key order. */
  steps?: string[];
  /** The four input actions, in step order. */
  keys?: string[];
  /** Hide the sequence while it is being repeated. */
  hide?: boolean;
  title?: string;
  done?: string;
  slip?: string;
}

export class KnotTieScene implements Scene {
  opaque = false;
  private done = deferred<MinigameResult>();
  readonly promise = this.done.promise;
  private seq: number[];
  private shown = 0;
  private t = 0;
  private phase: "show" | "tie" | "end" = "show";
  private input: number[] = [];
  private mistakes = 0;
  private message = "";
  static STEPS = ["Over", "Under", "Through", "Pull"];
  private steps: string[];
  private keys: string[];
  private hide: boolean;
  private title: string;
  private doneText: string;
  private slipText: string;

  constructor(private audio: Audio, private knotName: string, opts: KnotTieOpts = {}) {
    const rng = new Rng(`tie:${knotName}`);
    const n = opts.hard ? 6 : 4;
    this.seq = opts.seq ?? Array.from({ length: n }, () => rng.int(4));
    this.steps = opts.steps ?? KnotTieScene.STEPS;
    this.keys = opts.keys ?? ["up", "down", "right", "left"];
    this.hide = opts.hide ?? false;
    this.title = opts.title ?? `Tying the ${knotName}`;
    this.doneText = opts.done ?? "Tied. It holds.";
    this.slipText = opts.slip ?? "It slips. Again, from the start.";
  }

  update(dt: number, inp: Input): void {
    this.t += dt;
    if (this.phase === "show") {
      const idx = Math.floor(this.t / 0.6);
      if (idx > this.shown && idx <= this.seq.length) { this.shown = idx; this.audio.pluck(260 + this.seq[idx - 1] * 60, 0.3, 0.3); }
      if (this.t > this.seq.length * 0.6 + 0.6) { this.phase = "tie"; this.t = 0; }
      return;
    }
    if (this.phase === "tie") {
      const map: [string, number][] = this.keys.map((k, i) => [k, i]);
      for (const [a, v] of map) {
        if (inp.pressed(a as never)) {
          inp.consume(a as never);
          this.audio.pluck(260 + v * 60, 0.3, 0.3);
          if (v === this.seq[this.input.length]) {
            this.input.push(v);
            if (this.input.length === this.seq.length) { this.phase = "end"; this.t = 0; this.message = this.doneText; this.audio.sfx("knot"); }
          } else {
            this.mistakes++;
            this.input = [];
            this.message = this.mistakes >= 3 ? "Enough for now." : this.slipText;
            this.audio.sfx("miss");
            if (this.mistakes >= 3) { this.phase = "end"; this.t = 0; }
          }
        }
      }
      if (inp.pressed("cancel")) { inp.consume("cancel"); this.done.resolve({ score: 0, won: false }); }
      return;
    }
    if (this.t > 1.2 || inp.pressed("ok")) { inp.consume("ok"); this.done.resolve({ score: Math.max(0, 3 - this.mistakes), won: this.mistakes < 3 }); }
  }

  draw(s: Screen): void {
    s.dimRect(0, 0, W, H, 0.6);
    const h = 110;
    drawBox(s, 10, (H - h) / 2, W - 20, h);
    const top = (H - h) / 2 + 5;
    s.text(this.title, 16, top, "gold");
    s.text(this.keys.map((k, i) => `${k[0].toUpperCase()}${k.slice(1)}: ${this.steps[i].toLowerCase()}`).join(". ") + ".", 16, top + 10, "ash");
    // The sequence as knot glyphs, revealed in the show phase. A hidden sequence must be remembered.
    const glyphs = this.seq.map((v) => ["<o", ">o", "<x", ">x"][v]);
    glyphs.forEach((g, i) => {
      const lit = this.phase === "show" ? i < this.shown : i < this.input.length;
      if (lit || !this.hide) s.sprite(knotCells(g), 20 + i * 14, top + 26, lit ? "bone" : "slate", lit ? "teal" : "slate");
      else s.text("○", 22 + i * 14, top + 27, "slate");
      if (this.phase === "show" && i < this.shown) s.text(this.steps[this.seq[i]].slice(0, 5), 16 + i * 14, top + 38, "bone");
    });
    // A line that gets knotted as you go
    const y = top + 60;
    s.hline(y, 20, W - 20, colorInt("teal"));
    const n = this.phase === "show" ? this.shown : this.input.length;
    for (let i = 0; i < n; i++) s.sprite(getSprite("item", "knot", "knot"), 30 + i * 22, y - 4, "bone", "teal");
    s.text(this.phase === "show" ? "Watch." : this.phase === "tie" ? `Tie it. ${this.input.length}/${this.seq.length}` : this.message, 16, top + 80, this.phase === "tie" ? "gold" : "bone");
    if (this.message && this.phase === "tie") s.text(this.message, 16, top + 90, "orange");
    void KNOT_ALPHABET;
  }
}

/**
 * The Swing. On the Steppe the held travel by letting the wind swing them.
 * Fathom cannot, but a courier can carry Fathom's parcel, and the player times
 * the pushes: confirm at the top of each swing to go further.
 */
export class SwingScene implements Scene {
  opaque = false;
  private done = deferred<MinigameResult>();
  readonly promise = this.done.promise;
  private t = 0;
  private angle = 0;
  private energy = 0.5;
  private distance = 0;
  private pushes = 0;
  private goal: number;
  private over = false;
  private flash = 0;
  private message = "";

  constructor(private audio: Audio, opts: { hard?: boolean } = {}) {
    this.goal = opts.hard ? 240 : 160;
  }

  update(dt: number, input: Input): void {
    if (this.over) { if (input.pressed("ok")) { input.consume("ok"); this.done.resolve({ score: Math.round(this.distance), won: this.distance >= this.goal }); } return; }
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    const period = 1.6;
    this.angle = Math.sin((this.t / period) * Math.PI * 2) * (0.4 + this.energy * 0.6);
    const atTop = Math.abs(Math.cos((this.t / period) * Math.PI * 2)) < 0.25;
    if (input.pressed("ok")) {
      input.consume("ok");
      this.pushes++;
      if (atTop) { this.energy = Math.min(1.5, this.energy + 0.25); this.distance += 20 + this.energy * 30; this.audio.sfx("wind"); this.flash = 0.3; this.message = "A good push."; }
      else { this.energy = Math.max(0.2, this.energy - 0.15); this.distance += 4; this.audio.sfx("miss"); this.message = "Off the beat. The swing shortens."; }
      if (this.pushes >= 8) { this.over = true; this.message = this.distance >= this.goal ? "Delivered, with room to spare." : "Short. The parcel lands in a hedge."; }
    }
    if (input.pressed("cancel")) { input.consume("cancel"); this.over = true; this.message = "Fathom lets go of the rope."; }
  }

  draw(s: Screen): void {
    s.dimRect(0, 0, W, H, 0.6);
    drawBox(s, 10, 20, W - 20, H - 40);
    s.text(`The Swing. Push ${Math.min(this.pushes + 1, 8)} of 8. ${Math.round(this.distance)} of ${this.goal} yards.`, 16, 25, "gold");
    // The ribs of the Hull, the pivot, the courier on the line
    for (let y = 36; y < 48; y += 4) s.hline(y, 16, W - 16, colorInt("coal"));
    const px = W / 2, py = 40, len = 70;
    const cx = Math.round(px + Math.sin(this.angle) * len), cy = Math.round(py + Math.cos(this.angle) * len);
    s.line(px, py, cx, cy, this.flash > 0 ? colorInt("white") : colorInt("bone"));
    s.sprite(getSprite("humanoid", "swinger", "tall"), cx - 4, cy, "amber", "ink", { flip: this.angle < 0 });
    // Ground and distance marker
    s.dither(16, 150, W - 32, 20, "sand", "olive");
    const marker = 16 + Math.round(((W - 32) * Math.min(1, this.distance / this.goal)));
    s.vline(marker, 146, 170, colorInt("gold"));
    s.text("Confirm at the top of the swing.", 16, H - 36, "bone");
    if (this.message) s.text(this.message, 16, H - 28, this.over ? "gold" : "ash");
  }
}

/**
 * Lure plucking. Dulcet's game: a note falls down each line, press the matching
 * direction when it reaches the bottom. Four lines, four directions.
 */
export class PluckScene implements Scene {
  opaque = false;
  private done = deferred<MinigameResult>();
  readonly promise = this.done.promise;
  private notes: { lane: number; y: number; hit: boolean }[] = [];
  private t = 0;
  private spawnT = 0;
  private spawned = 0;
  private total: number;
  private hits = 0;
  private misses = 0;
  private rng = new Rng(`pluck${Date.now()}`);
  private over = false;
  private flashLane = -1;
  private flashT = 0;

  constructor(private audio: Audio, opts: { rounds?: number; hard?: boolean } = {}) {
    this.total = opts.rounds ?? 16;
    this.speed = opts.hard ? 70 : 50;
  }
  private speed: number;

  update(dt: number, input: Input): void {
    if (this.over) { if (input.pressed("ok")) { input.consume("ok"); this.done.resolve({ score: this.hits, won: this.hits >= Math.ceil(this.total * 0.6) }); } return; }
    this.t += dt;
    this.spawnT += dt;
    if (this.flashT > 0) this.flashT -= dt;
    if (this.spawned < this.total && this.spawnT > 0.55) { this.spawnT = 0; this.spawned++; this.notes.push({ lane: this.rng.int(4), y: 40, hit: false }); }
    for (const n of this.notes) n.y += this.speed * dt;
    const dirs: ("left" | "up" | "down" | "right")[] = ["left", "up", "down", "right"];
    dirs.forEach((d, lane) => {
      if (!input.pressed(d)) return;
      input.consume(d);
      const target = this.notes.find((n) => n.lane === lane && !n.hit && Math.abs(n.y - 140) < 10);
      this.flashLane = lane;
      this.flashT = 0.15;
      this.audio.playNote(["A", "C", "E", "G"][lane] as never, 0, 0.4);
      if (target) { target.hit = true; this.hits++; } else { this.misses++; this.audio.sfx("miss"); }
    });
    for (const n of this.notes) if (!n.hit && n.y > 152) { n.hit = true; this.misses++; }
    this.notes = this.notes.filter((n) => n.y < 160);
    if (this.spawned >= this.total && this.notes.every((n) => n.hit)) this.over = true;
    if (input.pressed("cancel")) { input.consume("cancel"); this.over = true; }
  }

  draw(s: Screen): void {
    s.dimRect(0, 0, W, H, 0.6);
    drawBox(s, 10, 20, W - 20, H - 40);
    s.text(`Plucking. Hits ${this.hits}, misses ${this.misses}, of ${this.total}.`, 16, 25, "gold");
    const lanes = [52, 92, 132, 172];
    lanes.forEach((x, i) => {
      s.vline(x, 36, 150, this.flashLane === i && this.flashT > 0 ? colorInt("white") : colorInt("bone"));
      s.sprite(getSprite("humanoid", `pluck${i}`, ""), x - 4, 150, "bone", ["sea", "plum", "moss", "rust"][i] as never);
      s.text(["←", "↑", "↓", "→"][i], x - 1, 162, "ash");
    });
    s.hline(140, 40, W - 40, mixInt(colorInt("gold"), PALETTE_INT.black, 0.4));
    for (const n of this.notes) if (!n.hit) s.sprite(getSprite("shape", "note", "note"), lanes[n.lane] - 4, Math.round(n.y) - 4, "gold", "gold");
    s.text(this.over ? "Done. Confirm." : "Press the direction when the note reaches the line.", 16, H - 30, this.over ? "gold" : "bone");
  }
}
