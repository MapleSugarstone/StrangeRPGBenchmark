import type { Game } from './game';
import type { FieldScene, Actor } from '../scenes/field';
import { ask, say } from '../scenes/dialogue';
import { ITEMS } from '../data/items';
import { MEMBERS } from '../data/members';
import { SLIPS } from '../data/slips';
import { addItem, healAll, newMember, saveGame, slipLevel, slipText, GameState } from './state';
import type { DigDef } from '../maps/types';
import { BattleScene, BattleOpts2 } from '../scenes/battle';
import { CardScene } from '../scenes/card';
import { ShopScene } from '../scenes/shop';
import { GameOverScene } from '../scenes/gameover';
import { textWidth } from '../core/font';
import { QUESTS, DONE } from '../data/quests';
import { makeMini, MiniKind, MiniResult } from '../scenes/minigames';
import { page, respec } from '../maps/side';
import { callSomeday } from '../maps/secret';

export class ScriptAbort extends Error {}

export class Ctx {
  constructor(public game: Game, public field: FieldScene) {}

  get s(): GameState { return this.game.state!; }

  say(who: string | null, text: string, top = false) { return say(this.game, who, text, top); }
  ask(who: string | null, text: string, choices: string[]) { return ask(this.game, who, text, choices); }
  async lines(pairs: [string | null, string][]) { for (const [w, t] of pairs) await this.say(w, t); }

  flag(k: string): boolean { return !!this.s.flags[k]; }
  set(k: string, v: number | string | boolean = 1) { this.s.flags[k] = v; this.field.refreshVisibility(); }
  num(k: string): number { return Number(this.s.flags[k] ?? 0); }
  inc(k: string, n = 1) { this.s.flags[k] = this.num(k) + n; this.field.refreshVisibility(); }

  // Side calls: 0 is not started, 1 and up is the current step, and DONE is finished.
  q(id: string): number { return Number(this.s.flags['q_' + id] ?? 0); }
  qdone(id: string): boolean { return this.q(id) >= DONE; }
  async quest(id: string, step = 1) {
    const fresh = this.q(id) === 0;
    if (this.q(id) >= step) return;
    this.s.flags['q_' + id] = step;
    this.field.refreshVisibility();
    if (fresh) {
      this.game.audio.sfx('dial');
      this.field.notice = { text: `New call: ${QUESTS[id]?.title ?? id}`, t: 150 };
    }
  }
  async finish(id: string) {
    if (this.qdone(id)) return;
    this.s.flags['q_' + id] = DONE;
    this.field.refreshVisibility();
    this.game.audio.sfx('answer');
    this.field.notice = { text: `Call closed: ${QUESTS[id]?.title ?? id}`, t: 150 };
  }

  has(item: string): boolean { return (this.s.inv[item] ?? 0) > 0; }
  async give(item: string, n = 1, quiet = false) {
    addItem(this.s, item, n);
    if (!quiet) {
      this.game.audio.sfx('item');
      await this.say(null, `Got ${ITEMS[item]?.name ?? item}${n > 1 ? ' x' + n : ''}.`);
    }
  }
  take(item: string, n = 1) { addItem(this.s, item, -n); }
  async pleas(n: number) {
    this.s.pleas += n;
    this.game.audio.sfx('item');
    await this.say(null, n >= 0 ? `Got ${n} pleas. They whisper in your pocket.` : `Paid ${-n} pleas.`);
  }

  async join(id: string, lvl?: number, quiet = false) {
    if (!this.s.roster[id]) {
      const carried = this.s.flags.ngplus ? this.num('lvl_' + id) || this.avgLevel() : 0;
      this.s.roster[id] = newMember(id, Math.max(lvl ?? this.avgLevel(), carried), this.s.chapter);
      const k = this.s.flags['calling_' + id];
      if (k) this.s.roster[id].calling = String(k);
    }
    if (!this.s.party.includes(id) && this.s.party.length < 4) this.s.party.push(id);
    if (!quiet) {
      this.game.audio.sfx('level');
      await this.say(null, `${MEMBERS[id].name} joins the party.`);
    }
  }
  leave(id: string) {
    this.s.party = this.s.party.filter((p) => p !== id);
    delete this.s.roster[id];
    if (!this.s.party.length) this.s.party = ['hello'];
    for (const m of Object.keys(this.s.roster)) if (this.s.party.length < 4 && !this.s.party.includes(m)) this.s.party.push(m);
  }
  bench(id: string) { this.s.party = this.s.party.filter((p) => p !== id); }
  avgLevel(): number {
    const ms = Object.values(this.s.roster);
    return Math.max(1, Math.round(ms.reduce((a, m) => a + m.lvl, 0) / Math.max(1, ms.length)));
  }
  heal() { healAll(this.s); }

  wait(frames: number): Promise<void> {
    return new Promise((res) => {
      let n = frames;
      const tick = () => { n--; if (n <= 0) { this.game.onFrameRemove(tick); res(); } };
      this.game.onFrameAdd(tick);
    });
  }

  async fadeOut() { this.field.fadeTarget = 1; while (this.field.fade < 1) await this.wait(1); }
  async fadeIn() { this.field.fadeTarget = 0; while (this.field.fade > 0) await this.wait(1); }

  async goto(map: string, x: number, y: number, dir = 2) {
    this.game.audio.sfx('door');
    await this.fadeOut();
    this.field.load(map, x, y, dir);
    this.field.fade = 1;
    await this.wait(2);
    this.field.fadeTarget = 0;
  }

  actor(id: string): Actor | undefined {
    if (id === 'hero') return this.field.hero;
    if (id === 'partner') return this.field.partner ?? undefined;
    return this.field.npcs.find((n) => n.id === id);
  }
  async walk(id: string, path: string, dur = 8) { const a = this.actor(id); if (a) await this.field.walk(a, path, dur); }
  face(id: string, dir: 'u' | 'r' | 'd' | 'l') { const a = this.actor(id); if (a) a.dir = { u: 0, r: 1, d: 2, l: 3 }[dir]; }
  show(id: string, on = true) { const a = this.actor(id); if (a) a.visible = on; }
  place(id: string, x: number, y: number) { const a = this.actor(id); if (a) { a.x = x; a.y = y; a.fx = x; a.fy = y; } }
  emote(id: string, ch = '!') { this.field.emote(id, ch); }
  shake(frames = 20) { this.field.shakeT = frames; this.game.audio.sfx('shake'); }
  flash(color = 'white', frames = 10) { this.field.flashColor = color; this.field.flashT = frames; }
  music(id: string | null) { this.game.audio.play(id); }
  sfx(id: string) { this.game.audio.sfx(id); }
  tint(color: string | null) { this.field.tint = color; }
  async title(text: string, frames = 120) { this.field.overlayText = { text, t: frames }; await this.wait(frames); }

  split(sprite: import('../core/sprites').SpriteSpec, x: number, y: number) {
    this.field.partner = this.field.mkActor('partner', x, y, 0, sprite);
    this.field.controlPartner = false;
    this.field.refreshVisibility();
  }
  merge() { this.field.partner = null; this.field.controlPartner = false; this.field.refreshVisibility(); }
  standing(x: number, y: number): boolean {
    const f = this.field;
    return (f.hero.x === x && f.hero.y === y) || (!!f.partner && f.partner.x === x && f.partner.y === y);
  }
  // Removes a member but remembers their level for when they come back.
  depart(id: string) {
    const m = this.s.roster[id];
    if (m) this.s.flags['lvl_' + id] = m.lvl;
    this.leave(id);
  }

  tabTitle(text: string, ms = 5000) {
    document.title = text;
    window.setTimeout(() => { if (document.title === text) document.title = 'Please Hold'; }, ms);
  }

  slip(full = false): string { return slipText(this.s.wish, slipLevel(this.s), full); }

  async battle(group: string, o: BattleOpts2 = {}): Promise<'win' | 'lose' | 'fled'> {
    for (;;) {
      const snap = JSON.stringify(this.s);
      const r = await new Promise<'win' | 'lose' | 'fled'>((res) => {
        this.game.push(new BattleScene(this.game, group, o, res, this.field.map));
      });
      this.game.audio.play(this.field.map.music ?? null);
      if (r !== 'lose' || o.canLose) return r;
      const choice = await new Promise<number>((res) => this.game.push(new GameOverScene(this.game, res)));
      if (choice === 0 || choice === 2) {
        const restored = JSON.parse(snap) as GameState;
        if (choice === 2) restored.flags.gentle = 1;
        this.game.state = restored;
        this.s.stats.losses++;
        continue;
      }
      this.game.loadFromSave();
      throw new ScriptAbort();
    }
  }

  // Plays a minigame and records the best score under best_<kind>.
  async minigame(kind: MiniKind): Promise<MiniResult> {
    const best = this.num('best_' + kind);
    const music = this.game.audio.current;
    const r = await new Promise<MiniResult>((res) => this.game.push(makeMini(this.game, kind, best, res)));
    if (r.score > best) this.s.flags['best_' + kind] = r.score;
    this.game.audio.play(music);
    return r;
  }

  async card(n: number) {
    this.s.chapter = n;
    await new Promise<void>((res) => this.game.push(new CardScene(this.game, n, res)));
  }

  async shop(stock: string[], name = 'Shop', prices?: Record<string, number>) {
    await new Promise<void>((res) => this.game.push(new ShopScene(this.game, stock, name, res, prices)));
  }

  async payphone() {
    this.game.audio.sfx('ring');
    const lines: Record<number, string> = {
      1: 'You pick up. A dial tone, steady as anything.',
      2: 'You pick up. Hold music, very faint, very far away.',
      3: 'You pick up. Somebody on the other end is breathing.',
      4: 'You pick up. A voice, almost: "...still there?"',
      5: `You pick up. Someone is reading something aloud, slowly: "${this.slip()}"`,
      6: 'You pick up. Nothing. Not even a tone. Just someone listening back.',
      7: 'You pick up. "Don\'t hang up," says nobody.',
      8: 'You pick up. You hear the sea. You hear yourself say hello.',
      9: 'You pick up. "I\'m still here," someone says. It might be you. It might be them.',
    };
    await this.say('payphone', this.flag('secret_412') && this.s.chapter >= 9 ? 'You pick up. The line is very clear, the way it is when someone on the other end is also holding the phone.' : lines[this.s.chapter] ?? lines[1]);
    const opts = ['Save and rest'];
    if (Object.values(this.s.roster).some((m) => m.calling)) opts.push('Change a Calling');
    if (this.flag('secret_412')) opts.push('Call Someday');
    opts.push('Hang up');
    const r = await this.ask('payphone', 'Leave a message? (Saves your game and rests the party.)', opts);
    if (opts[r] === 'Save and rest') {
      this.heal();
      this.s.saveMap = this.s.map;
      saveGame(this.s);
      this.game.audio.sfx('save');
      await this.say(null, 'Your message is saved. The party feels rested.');
    } else if (opts[r] === 'Change a Calling') await respec(this);
    else if (opts[r] === 'Call Someday') await callSomeday(this);
    this.game.audio.sfx('hangup');
  }

  async dig(d: DigDef) {
    this.game.audio.sfx('dig');
    this.s.flags['dig_' + d.id] = 1;
    if (d.slip) {
      const sl = SLIPS[d.slip];
      if (sl && !this.s.slips.includes(d.slip)) this.s.slips.push(d.slip);
      await this.say(null, `You dig up an old slip. It whispers:`);
      if (sl) await this.say(null, `"${sl.text}"`);
      if (sl) await this.say(null, `(Kept in the Book under Slips: ${sl.from}.)`);
    }
    if (d.item) await this.give(d.item, d.n ?? 1);
    if (d.pleas) await this.pleas(d.pleas);
    if (d.page) await page(this, d.page);
  }

  centered(text: string) { return textWidth(text); }
}
