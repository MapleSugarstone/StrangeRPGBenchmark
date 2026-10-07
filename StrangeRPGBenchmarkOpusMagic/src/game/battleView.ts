// The battle screen. It plays back the engine's events with timing, light, and sound, and collects the player's commands.
import { sfx } from '../engine/audio';
import { music } from '../engine/music';
import { spellMelodies } from './tunes';
import { grantCard } from './stet';
import { CW, LH, text, textCenter, textShadow, wrap } from '../engine/font';
import { down, pressed, tapped } from '../engine/input';
import { addLight, beginLight, composite, tint } from '../engine/light';
import { backdropFor, drawBackdrop } from '../engine/battlebg';
import { BATTLE_ART } from '../engine/sprites16';
import { H, W, clearAux, ditherRect, glow, rect } from '../engine/screen';
import { LIME, drawCopied, drawSprite, spritePal, spriteSize } from '../engine/sprites';
import { VERBS } from '../cant/vocab';
import { cost } from '../cant/analyze';
import { Scene, app } from './app';
import { BEvent, Battle, Body, Snapshot } from './battle';
import { FOES } from './enemies';
import { Editor, colorize } from './editor';
import { markCount } from './dialogue';
import { PAGE_COLORS, allyMax, battlePages, battleSetup, blankStats, collectPage, gainXp, loadGame, maxHp, maxInk } from './state';
import { C, Menu, bar, panel } from './ui';

type Result = 'win' | 'lose' | 'fled';

const GLYPH_T = 26;

interface Pop { s: string; x: number; y: number; life: number; color: number }
/** One letter of a written line, in flight from the writer to the one written into. */
interface Glyph { ch: string; x0: number; y0: number; x1: number; y1: number; t: number; color: number }

export class BattleView implements Scene {
  opaque = true;
  b: Battle;
  queue: BEvent[] = [];
  wait = 0;
  view = new Map<string, Snapshot>();
  shake = new Map<string, number>();
  glow = new Map<string, number>();
  gone = new Map<string, number>();
  pops: Pop[] = [];
  glyphs: Glyph[] = [];
  log: { s: string; c: number }[] = [];
  code: { who: string; page: string; line: number; text: string; mute: boolean; life: number } | null = null;
  ink = 0;
  inkMax = 0;
  mode: 'play' | 'command' | 'pages' | 'target' | 'read' | 'items' | 'result' | 'lost' = 'play';
  menu = new Menu([{ label: 'Cast' }, { label: 'Read' }, { label: 'Write' }, { label: 'Item' }, { label: 'Run' }], 5);
  pageMenu = new Menu([], 6);
  itemMenu = new Menu([], 5);
  targetIdx = 0;
  targetSide: 'foe' | 'party' = 'foe';
  pending: { kind: 'cast'; page: number } | { kind: 'item'; item: string } | { kind: 'read' } | null = null;
  readBody: Body | null = null;
  resultLines: string[] = [];
  hint: { who: string; text: string; life: number } | null = null;
  private saved: string;

  backdrop = 'busy';

  constructor(public enc: string, private done: (r: Result, v: BattleView) => void, public region = 'busy') {
    const s = app.s;
    this.saved = JSON.stringify(s);
    this.b = new Battle(battleSetup(s, enc, (Math.random() * 1e9) | 0));
    for (const k of this.b.foes.map((f) => f.key)) if (!s.seen.includes(k)) s.seen.push(k);
  }

  enter() {
    for (const body of this.b.all()) this.view.set(body.id, this.snapOf(body));
    this.ink = this.b.wait.ink;
    this.inkMax = this.b.wait.maxInk;
    this.queue.push(...this.b.start());
    this.backdrop = backdropFor(this.region, this.b.foes.map((f) => f.key), this.b.foes.some((f) => f.look === 'copied'), app.s.chapter >= 7);
    sfx.again();
    const keys = this.b.foes.map((f) => f.key);
    const boss = (['grind', 'hold', 'many', 'relay', 'arm', 'again', 'erratum', 'closer', 'corrector', 'over', 'gloss'] as const).find((k) => keys.includes(k));
    if (boss === 'again') music.setSpellMelodies(spellMelodies(app.s.pages.map((p) => p.src)));
    music.play(boss ? `boss_${boss}` : app.s.chapter >= 7 ? 'battle2' : this.b.foes.some((f) => f.look === 'copied') ? 'battle_copied' : 'battle', 0.4);
  }

  /** Raises the music as the foes lose health, and past half for Again's second phase. */
  private setIntensity() {
    const shown = this.b.foes.map((f) => this.view.get(f.id)).filter((v): v is Snapshot => !!v);
    const max = shown.reduce((n, v) => n + v.max, 0) || 1;
    const hp = shown.reduce((n, v) => n + (v.up ? v.hp : 0), 0);
    const again = this.b.foes.find((f) => f.key === 'again');
    music.setIntensity(Math.max(1 - hp / max, again && again.phase > 0 ? 0.6 : 0));
  }

  private snapOf(b: Body): Snapshot {
    return { hp: b.hp, max: b.max, ward: b.ward, wet: b.wet, burn: b.burn, marked: b.marked, copied: b.copied, up: b.up, armor: b.armor, halted: b.halted, hushed: b.hushed, pen: b.written.length };
  }

  // ---------------------------------------------------------------- update

  update() {
    if ((app.frame & 15) === 0) this.setIntensity();
    for (const [k, v] of this.shake) this.shake.set(k, Math.max(0, v - 1));
    for (const [k, v] of this.glow) this.glow.set(k, v * 0.96);
    for (const p of this.pops) { p.life--; p.y -= 0.3; }
    this.pops = this.pops.filter((p) => p.life > 0);
    for (const g of this.glyphs) g.t++;
    this.glyphs = this.glyphs.filter((g) => g.t < GLYPH_T);
    if (this.code) this.code.life--;
    if (this.hint && --this.hint.life <= 0) this.hint = null;
    switch (this.mode) {
      case 'play': this.play(); break;
      case 'command': this.commandMenu(); break;
      case 'pages': this.pagesMenu(); break;
      case 'target': this.targetMenu(); break;
      case 'read': if (tapped('ok') || tapped('back') || tapped('page')) { this.mode = 'command'; sfx.back(); } else this.readCycle(); break;
      case 'items': this.itemsMenu(); break;
      case 'result': if (tapped('ok')) this.finish(); break;
      case 'lost': this.lostMenu(); break;
    }
  }

  private play() {
    const fast = down('ok') || down('run');
    if (this.wait > 0) { this.wait -= fast ? 3 : 1; return; }
    if (this.queue.length) { this.apply(this.queue.shift()!); return; }
    if (this.b.phase === 'command') { this.mode = 'command'; return; }
    if (this.b.phase === 'over') this.showResult();
  }

  private apply(e: BEvent) {
    const name = (id: string) => this.b.byId(id)?.name ?? '?';
    switch (e.t) {
      case 'round': this.wait = 4; break;
      case 'turn': this.glow.set(e.who, 1); this.wait = 2; break;
      case 'line': {
        this.code = { who: e.who, page: e.page, line: e.line, text: e.text, mute: e.mute, life: 50 };
        this.glow.set(e.who, 1);
        const w = e.text.trim().split(/[\s(]/)[0];
        if (e.mute) sfx.mute(); else sfx.line(VERBS[w]?.pitch ?? 5);
        this.wait = 7;
        break;
      }
      case 'verb': {
        const v = VERBS[e.verb];
        if (e.target) {
          const [x, y] = this.posOf(e.target);
          this.pops.push({ s: e.verb, x: x + 4 - (e.verb.length * CW) / 2, y: y - 8, life: 24, color: v?.color ?? C.text });
          this.glow.set(e.target, 0.8);
        }
        this.wait = 4;
        break;
      }
      case 'harm': {
        this.view.set(e.who, e.snap);
        this.shake.set(e.who, 8);
        const [x, y] = this.posOf(e.who);
        this.pops.push({ s: e.amount ? `-${e.amount}` : '0', x: x + 2, y, life: 30, color: e.amount ? C.bad : C.dim });
        if (e.amount) sfx.hit();
        this.wait = 8;
        break;
      }
      case 'heal': {
        this.view.set(e.who, e.snap);
        const [x, y] = this.posOf(e.who);
        this.pops.push({ s: `+${e.amount}`, x: x + 2, y, life: 30, color: C.good });
        sfx.heal();
        this.wait = 8;
        break;
      }
      case 'state': this.view.set(e.who, e.snap); break;
      case 'ink': this.ink = e.ink; this.inkMax = e.max; break;
      case 'fall': {
        const v = this.view.get(e.who);
        if (v) this.view.set(e.who, { ...v, up: false, hp: 0 });
        this.gone.set(e.who, 30);
        sfx.fall();
        this.wait = 12;
        break;
      }
      case 'spawn': this.view.set(e.body.id, this.snapOf(e.body)); this.gone.delete(e.body.id); this.wait = 10; break;
      case 'say': this.addLog(`${name(e.who)} says "${e.text}"`, C.str); this.wait = 16; break;
      case 'written': {
        this.glow.set(e.who, 1.5);
        music.stinger('write');
        const [x0, y0] = this.centerOf(e.by), [x1, y1] = this.centerOf(e.who);
        const by = this.b.byId(e.by);
        const color = by?.side === 'foe' ? C.bad : C.again;
        [...e.text.replace(/\s+/g, '')].slice(0, 14).forEach((ch, i) => this.glyphs.push({ ch, x0, y0, x1, y1, t: -i * 2, color }));
        this.wait = 24;
        break;
      }
      case 'log': {
        const col = e.tone === 'bad' ? C.bad : e.tone === 'good' ? C.good : e.tone === 'again' ? C.again : e.tone === 'dim' ? C.dim : C.text;
        this.addLog(e.text, col);
        if (e.tone === 'again') sfx.again();
        this.wait = e.tone === 'dim' ? 6 : 12;
        break;
      }
      case 'reveal': break;
      case 'rote': this.glow.set(e.who, 3); sfx.again(); this.wait = 30; break;
      case 'end': break;
      case 'hint': this.hint = { who: e.speaker, text: e.text, life: 400 }; this.addLog(`${e.speaker.charAt(0)}${e.speaker.slice(1).toLowerCase()}: ${e.text}`, C.hi); this.wait = 30; break;
    }
  }

  private addLog(s: string, c: number) {
    for (const l of wrap(s, 37)) this.log.push({ s: l, c });
    if (this.log.length > 30) this.log.splice(0, this.log.length - 30);
  }

  // ---------------------------------------------------------------- commands

  private commandMenu() {
    if (tapped('page')) { this.startRead(); return; }
    const n = this.menu.items.length;
    if (pressed('left') || pressed('up')) { this.menu.i = (this.menu.i + n - 1) % n; sfx.move(); }
    if (pressed('right') || pressed('down')) { this.menu.i = (this.menu.i + 1) % n; sfx.move(); }
    if (!tapped('ok')) return;
    sfx.ok();
    const r = this.menu.i;
    switch (r) {
      case 0: this.openPages('cast'); break;
      case 1: this.startRead(); break;
      case 2: this.openPages('write'); break;
      case 3: this.openItems(); break;
      case 4: this.queue.push(...this.b.act({ kind: 'flee' })); this.mode = 'play'; break;
    }
  }

  private pageMode: 'cast' | 'write' = 'cast';

  private openPages(m: 'cast' | 'write') {
    this.pageMode = m;
    const pages = this.b.setup.pages;
    this.pageMenu = new Menu(pages.map((p, i) => ({
      label: p.name,
      disabled: m === 'cast' && !p.code,
      color: PAGE_COLORS[app.s.pages[i]?.color ?? 0],
      right: !p.code ? 'broken' : p.closed ? 'halt' : p.corrected ? 'wrong' : m === 'cast' ? inkOf(p.stmts) : '',
      rightColor: !p.code || p.closed || p.corrected ? C.bad : C.hi,
    })), 6);
    this.mode = 'pages';
  }

  private pagesMenu() {
    const r = this.pageMenu.update();
    if (r === -2) { this.mode = 'command'; return; }
    if (r < 0) return;
    if (this.pageMode === 'write') {
      const before = JSON.stringify(app.s.pages);
      app.push(new Editor(r, 'battle', () => {
        const changed = JSON.stringify(app.s.pages) !== before;
        if (changed) {
          this.b.setPages(battlePages(app.s));
          this.queue.push(...this.b.act({ kind: 'write' }));
          this.mode = 'play';
        } else this.mode = 'command';
      }));
      return;
    }
    this.pending = { kind: 'cast', page: r };
    const pg = this.b.setup.pages[r];
    const helps = pg && /^\s*(mend|ward)\b/m.test(pg.src) && !/\bfoe\b/.test(pg.src);
    this.targetSide = helps ? 'party' : 'foe';
    this.targetIdx = 0;
    if (this.targetSide === 'foe') {
      const prev = this.b.focus ? this.targets().indexOf(this.b.focus) : -1;
      if (prev >= 0) this.targetIdx = prev;
    }
    this.mode = 'target';
  }

  private targets(): Body[] {
    return (this.targetSide === 'foe' ? this.b.foes : this.b.party).filter((x) => x.up || (this.targetSide === 'party' && this.pending?.kind === 'item' && this.pending.item === 'bell'));
  }

  private targetMenu() {
    let list = this.targets();
    if (!list.length) { this.targetSide = this.targetSide === 'foe' ? 'party' : 'foe'; list = this.targets(); }
    if (pressed('left')) { this.targetIdx = (this.targetIdx + list.length - 1) % list.length; sfx.move(); }
    if (pressed('right')) { this.targetIdx = (this.targetIdx + 1) % list.length; sfx.move(); }
    if (pressed('up') || pressed('down')) { this.targetSide = this.targetSide === 'foe' ? 'party' : 'foe'; this.targetIdx = 0; sfx.move(); }
    list = this.targets();
    this.targetIdx = Math.min(this.targetIdx, Math.max(0, list.length - 1));
    if (tapped('back')) { sfx.back(); this.mode = this.pending?.kind === 'read' ? 'command' : this.pending?.kind === 'item' ? 'items' : 'pages'; return; }
    if (!tapped('ok') || !list.length) return;
    sfx.ok();
    const t = list[this.targetIdx];
    const p = this.pending!;
    if (p.kind === 'read') { this.readBody = t; this.mode = 'read'; return; }
    if (p.kind === 'cast') this.queue.push(...this.b.act({ kind: 'cast', page: p.page, target: t.id }));
    else this.queue.push(...this.b.act({ kind: 'item', item: p.item, target: t.id }));
    this.pending = null;
    this.mode = 'play';
  }

  private startRead() {
    this.pending = { kind: 'read' };
    this.targetSide = 'foe';
    this.targetIdx = 0;
    this.mode = 'target';
    sfx.ok();
  }

  private readCycle() {
    if (!this.readBody) return;
    const list = this.b.all().filter((x) => x.up && x.proc);
    const i = list.indexOf(this.readBody);
    if (pressed('right') && list.length) { this.readBody = list[(i + 1) % list.length]; sfx.move(); }
    if (pressed('left') && list.length) { this.readBody = list[(i + list.length - 1) % list.length]; sfx.move(); }
  }

  private openItems() {
    const items = app.s.items;
    const names: Record<string, string> = { inkpot: 'inkpot', salve: 'salve', bell: 'bell' };
    const list = Object.keys(names).filter((k) => (items[k] ?? 0) > 0);
    if (!list.length) { sfx.error(); this.addLog('No items.', C.dim); return; }
    this.itemMenu = new Menu(list.map((k) => ({ label: names[k], right: `x${items[k]}` })), 5);
    this.mode = 'items';
  }

  private itemsMenu() {
    const r = this.itemMenu.update();
    if (r === -2) { this.mode = 'command'; return; }
    if (r < 0) return;
    const item = this.itemMenu.items[r].label;
    if (item === 'inkpot') { this.queue.push(...this.b.act({ kind: 'item', item, target: this.b.wait.id })); this.mode = 'play'; return; }
    this.pending = { kind: 'item', item };
    this.targetSide = 'party';
    this.targetIdx = 0;
    this.mode = 'target';
  }

  // ---------------------------------------------------------------- results

  private showResult() {
    const s = app.s;
    const b = this.b;
    if (b.result === 'lose') { this.mode = 'lost'; music.play('gameover', 0.3); this.menu = new Menu(loadGame() ? [{ label: 'Try the fight again' }, { label: 'Go back to the last lectern' }] : [{ label: 'Try the fight again' }], 2); return; }
    s.hp = Math.max(1, b.wait.hp);
    s.ink = Math.min(maxInk(s), b.wait.ink);
    for (const a of b.party) if (!a.isWait) s.allyHp[a.key] = Math.max(1, a.hp);
    for (const [name, st] of Object.entries(b.stats)) {
      const pg = s.pages.find((p) => p.name === name);
      if (!pg) continue;
      pg.stats ??= blankStats();
      pg.stats.casts += st.casts; pg.stats.harm += st.harm; pg.stats.heal += st.heal;
      pg.stats.best = Math.max(pg.stats.best, st.best);
    }
    if (b.usedAgain) s.usedAgain = true;
    if (b.result === 'fled' || this.enc === 'again') { this.finish(); return; }
    music.stinger('win');
    const lines: string[] = [];
    const xp = b.xpEarned();
    const blanks = b.foes.filter((f) => !f.up).reduce((n, f) => n + 1 + Math.floor((f.def?.xp ?? 0) / 4), 0);
    s.blanks += blanks;
    lines.push(`${xp} xp, ${blanks} blank${blanks === 1 ? '' : 's'}`);
    const ups = gainXp(s, xp);
    if (ups) {
      lines.push(`Wait is level ${s.level}. +${ups} mark${ups > 1 ? 's' : ''}.`);
      music.stinger('level');
      s.hp = Math.min(maxHp(s), s.hp + 5 * ups);
      for (const k of s.party) s.allyHp[k] = Math.min(allyMax(s, k), (s.allyHp[k] ?? 0) + 4 * ups);
    }
    for (const f of b.foes) {
      if (f.up || f.freed || f.def?.freeScene) continue;
      const e = collectPage(s, f.key);
      if (e) { lines.push(`A page from ${e.from}: "${e.name}".`); grantCard(f.key); }
    }
    for (const f of b.foes) if (f.freed && f.def?.freeScene) s.flags[`freed_${f.key.slice(1)}`] = true;
    for (const f of b.foes) if (!f.freed && !f.up && f.def?.freeScene) s.flags[`beat_${f.key}`] = true;
    this.resultLines = lines;
    this.mode = 'result';
  }

  private lostMenu() {
    const r = this.menu.update(false);
    if (r === 0) {
      app.s = JSON.parse(this.saved);
      app.replace(new BattleView(this.enc, this.done));
    } else if (r === 1) {
      app.pop();
      this.done('lose', this);
    }
  }

  private finish() {
    app.pop();
    this.done(this.b.result === 'win' ? 'win' : 'fled', this);
  }

  // ---------------------------------------------------------------- drawing

  /** The battle sprite key for a body: its 16x16 or 32x32 art, or the field sprite if it has none. */
  art(b: Body): string { return BATTLE_ART[b.sprite] ?? b.sprite; }

  /** The middle of a body as drawn: the sprite for a foe, the portrait for the party. */
  centerOf(id: string): [number, number] {
    const [x, y] = this.posOf(id);
    const f = this.b.foes.find((b) => b.id === id);
    if (!f) return [x + 4, y + 10];
    const [w, h] = spriteSize(this.art(f));
    return [x + w / 2, y + h / 2];
  }

  posOf(id: string): [number, number] {
    const fi = this.b.foes.findIndex((f) => f.id === id);
    if (fi >= 0) {
      const n = this.b.foes.length;
      const f = this.b.foes[fi];
      const [w, h] = spriteSize(this.art(f));
      const x = Math.round(((fi + 1) * W) / (n + 1) - w / 2);
      const y = 56 - h + (n > 3 && fi % 2 ? 8 : 0);
      return [x, y];
    }
    const pi = this.b.party.findIndex((p) => p.id === id);
    return [10 + pi * 46, 118];
  }

  draw() {
    rect(0, 0, W, H, 0x050408);
    clearAux();
    drawBackdrop(this.backdrop, app.t, 0, 92, 0.8);
    glow(0, 0, W, 92);
    rect(0, 92, W, 1, 0x2a2440);
    for (const f of this.b.foes) this.drawFoe(f, false);
    beginLight([0.62, 0.6, 0.66], null);
    for (const f of this.b.foes) {
      const v = this.view.get(f.id);
      if (!v || !v.up) continue;
      const [x, y] = this.posOf(f.id);
      const [w, h] = spriteSize(this.art(f));
      const g = this.glow.get(f.id) ?? 0;
      const col = f.look === 'copied' ? LIME : tint(spritePal(this.art(f))[2], 0.3);
      addLight(x + w / 2, y + h / 2 - 2, 26 + w / 2 + 4 * Math.min(1, g), 0.45 + 0.25 * Math.min(1, g), col, { z: 12 });
    }
    const c = this.code;
    if (c && c.life > 0 && !c.mute) {
      const w0 = c.text.trim().split(/[\s(]/)[0];
      const col = tint(VERBS[w0]?.color ?? 0xd8d0ff, 0.2);
      const k = Math.min(1, c.life / 25) * 0.6;
      if (this.b.byId(c.who)?.side === 'party' || (c.who !== '' && this.b.byId(c.who)?.key === 'again' && c.page !== 'again')) addLight(96, 112, 150, 0.9 * k, col, { z: 6 });
      else { const [x, y] = this.posOf(c.who); addLight(x + 8, y + 8, 60, 0.7 * k, col, { z: 10 }); }
    }
    for (const g of this.glyphs) {
      const p = this.glyphAt(g);
      if (p && p[1] < 92) addLight(p[0], p[1], 14, 0.5, g.color, { z: 8 });
    }
    composite(92);
    for (const f of this.b.foes) this.drawFoe(f, true);
    for (const p of this.pops) textShadow(p.s, Math.round(p.x), Math.round(p.y), p.color);
    for (const g of this.glyphs) {
      const p = this.glyphAt(g);
      if (p) textShadow(g.ch, Math.round(p[0] - 2), Math.round(p[1] - 3), g.color);
    }
    this.drawCodeStrip();
    this.drawParty();
    this.drawLog();
    switch (this.mode) {
      case 'command': this.drawCommands(); break;
      case 'pages': this.drawPages(); break;
      case 'target': this.drawTarget(); break;
      case 'read': this.drawRead(); break;
      case 'items': panel(110, 104, 78, 44, C.hi); this.itemMenu.draw(114, 108, 70); break;
      case 'result': this.drawResult(); break;
      case 'lost': this.drawLost(); break;
      default: break;
    }
  }

  /** Where a glyph is now: along an arc that rises between the two bodies. Null before it leaves. */
  private glyphAt(g: Glyph): [number, number] | null {
    if (g.t < 0) return null;
    const k = g.t / GLYPH_T;
    const e = k * k * (3 - 2 * k);
    return [g.x0 + (g.x1 - g.x0) * e, g.y0 + (g.y1 - g.y0) * e - Math.sin(Math.PI * k) * 22];
  }

  private drawFoe(f: Body, labels: boolean) {
    const v = this.view.get(f.id);
    if (!v) return;
    const fading = this.gone.get(f.id);
    if (!v.up && (fading === undefined || fading <= 0)) return;
    let [x, y] = this.posOf(f.id);
    const key = this.art(f);
    const [w, h] = spriteSize(key);
    const sh = this.shake.get(f.id) ?? 0;
    if (sh) x += sh % 2 ? 2 : -2;
    if (!labels) {
      if (!v.up && fading !== undefined) this.gone.set(f.id, fading - 1);
      const frame = Math.floor((app.frame + f.id.length * 7) / 30) % 2;
      const dither = !v.up ? (app.frame & 1) : undefined;
      if (v.up) for (let i = 2; i < w - 2; i++) if ((i + y) & 1) rect(x + i, y + h, 1, 1, 0x000000);
      if (f.look === 'copied') drawCopied(key, x, y, { frame: app.beat(), dither }, app.beat() * 2);
      else drawSprite(key, x, y, { frame, dither, marks: key === 'wait16' ? 6 : 0 });
      return;
    }
    if (!v.up) return;
    void h;
    const ny = y + w + 2;
    const room = Math.max(w + 16, f.def?.boss ? 70 : Math.min(44, Math.floor(W / (this.b.foes.length + 1)) - 4));
    const nm = f.name.length * CW > room ? f.name.slice(0, Math.floor(room / CW)) : f.name;
    const nx = Math.round(x + w / 2 - (nm.length * CW) / 2);
    rect(nx - 1, ny - 1, nm.length * CW + 1, 13, 0x000000);
    text(nm, nx, ny, f.look === 'copied' ? C.again : C.text);
    bar(x, ny + 8, w, v.hp, v.max, v.hp * 3 < v.max ? C.bad : C.good);
    const st: [string, number][] = [];
    if (v.ward) st.push([`w${v.ward}`, 0x9ab8ff]);
    if (v.wet) st.push(['wet', 0x4fb8e0]);
    if (v.burn) st.push([`b${v.burn}`, 0xff7a3a]);
    if (v.marked) st.push(['m', 0xff5a8a]);
    if (v.hushed) st.push(['h', 0x9a9aba]);
    if (v.halted) st.push(['halt', C.bad]);
    if (v.pen) st.push([`+${v.pen}`, C.again]);
    let sx = x;
    for (const [s, c] of st) { text(s, sx, ny + 12, c); sx += s.length * CW + 3; }
    if (this.mode === 'target' && this.targetSide === 'foe' && this.targets()[this.targetIdx] === f && Math.floor(app.frame / 10) % 2) {
      text('\x03', x + w / 2 - 2, y - 8, C.hi);
    }
  }

  private drawCodeStrip() {
    const c = this.code;
    if (!c || c.life <= 0) return;
    const owner = this.b.byId(c.who);
    const isWait = owner?.isWait || (owner?.key === 'again' && c.page !== 'again');
    const y = 96;
    rect(0, y - 2, W, 11, 0x0e0c14);
    const label = `${c.page}:${c.line}`;
    text(label, 2, y, isWait ? C.hi : C.dim);
    const t = c.text.trim();
    const cols = colorize(t);
    const x0 = 2 + (label.length + 1) * CW;
    for (let k = 0; k < t.length && x0 + k * CW < W - 4; k++) text(t[k], x0 + k * CW, y, c.mute ? C.faint : cols[k]);
  }

  private drawLog() {
    const rows = this.log.slice(-4);
    rows.forEach((l, i) => text(l.s, 3, 160 + i * 8, l.c));
  }

  private drawParty() {
    rect(0, 116, W, 76, 0x0e0c14);
    rect(0, 116, W, 1, 0x2a2440);
    this.b.party.forEach((p, i) => {
      const v = this.view.get(p.id)!;
      const x = 4 + i * 47;
      const y = 120;
      const sh = this.shake.get(p.id) ?? 0;
      const g = this.glow.get(p.id) ?? 0;
      if (g > 0.3) rect(x - 2, y - 2, 44, 22, 0x1a1626);
      const pk = this.art(p);
      if (v.up) drawSprite(pk, x + (sh ? (sh % 2 ? 1 : -1) : 0), y, { marks: p.isWait ? markCount() : 0, frame: Math.floor(app.frame / 30) % 2, flat: true });
      else drawSprite(pk, x, y + 4, { look: 'gray', dither: 0, flat: true });
      text(p.name, x + 18, y, v.up ? C.text : C.faint);
      if (v.pen && v.up) text(`+${v.pen}`, x + 33, y + 8, C.bad);
      text(`${v.hp}`, x + 18, y + 8, v.hp * 3 < v.max ? C.bad : C.text);
      bar(x + 18, y + 16, 22, v.hp, v.max, C.good);
      if (p.isWait) {
        text(`ink ${this.ink}`, x, y + 20, C.hi);
        bar(x, y + 28, 40, this.ink, this.inkMax, C.hi);
      }
      const st: string[] = [];
      if (v.ward) st.push(`w${v.ward}`);
      if (v.copied) st.push('copied');
      if (v.halted) st.push('halt');
      if (v.wet) st.push('wet');
      if (v.burn) st.push(`b${v.burn}`);
      if (st.length) text(st.join(' ').slice(0, 9), x, y + (p.isWait ? 32 : 22), v.copied ? C.again : C.dim);
      if (this.mode === 'target' && this.targetSide === 'party' && this.targets()[this.targetIdx] === p && Math.floor(app.frame / 10) % 2) text('\x01', x - 4, y + 4, C.hi);
    });
    const hands = this.b.hands.filter((h) => h.alive);
    if (hands.length && this.mode !== 'result' && this.mode !== 'command') {
      text('hands', 4, 150, C.faint);
      hands.forEach((h, i) => text(`${h.label}${h.status === 'listening' ? '*' : h.status === 'suspended' ? '~' : ''}`, 36 + i * 50, 150, C.kw));
    }
    rect(0, 158, W, 1, 0x1a1626);
  }

  private drawCommands() {
    let x = 4;
    this.menu.items.forEach((it, i) => {
      const w = it.label.length * CW;
      if (i === this.menu.i) { rect(x - 2, 149, w + 4, 9, C.sel); text(it.label, x, 150, C.hi); }
      else text(it.label, x, 150, C.dim);
      x += w + 10;
    });
    text('R reads', 152, 150, C.faint);
  }

  private drawPages() {
    panel(84, 96, 104, 62, C.hi);
    text(this.pageMode === 'cast' ? 'cast which page' : 'write which page', 88, 99, C.dim);
    this.pageMenu.draw(88, 109, 96);
    if (this.pageMode === 'cast') {
      const pg = this.b.setup.pages[this.pageMenu.i];
      if (pg) {
        panel(4, 4, 120, Math.min(9, pg.src.split('\n').length) * 8 + 6, C.faint);
        pg.src.split('\n').slice(0, 9).forEach((l, i) => {
          const cols = colorize(l);
          for (let k = 0; k < Math.min(23, l.length); k++) text(l[k], 7 + k * CW, 7 + i * 8, cols[k]);
        });
      }
    }
  }

  private drawTarget() {
    const t = this.targets()[this.targetIdx];
    if (t) textShadow(`at ${t.name}`, 4, 4, C.hi);
    text(this.pending?.kind === 'read' ? 'read whom: arrows, Z' : 'arrows pick. up/down swaps side', 4, 150, C.faint);
  }

  private drawRead() {
    const b = this.readBody!;
    panel(4, 4, 184, 110, C.kw);
    text(`${b.name}'s rote`, 8, 7, C.kw);
    text(`hp ${b.hp}/${b.max} armor ${b.armor}${b.def?.power ? ` +${b.def.power}` : ''}`, 92, 7, C.dim);
    const lines = b.roteLines;
    const next = b.proc?.nextLine() ?? null;
    const extra = b.written.length;
    b.written.forEach((wl, i) => {
      const y = 18 + i * 8;
      text('+', 8, y, C.again);
      const cols = colorize(wl.text);
      for (let k = 0; k < Math.min(34, wl.text.length); k++) text(wl.text[k], 14 + k * CW, y, cols[k]);
      rect(13, y - 1, 1, 8, C.again);
    });
    lines.slice(0, 11 - extra).forEach((l, i) => {
      const n = i + 1;
      const y = 18 + (i + extra) * 8;
      const smudged = b.smudged.has(n);
      const erased = b.proc?.erased.has(`${b.key}:${n}`);
      if (next === n) text('\x01', 8, y, C.hi);
      const shown = smudged ? '~'.repeat(Math.max(4, l.trim().length)) : l;
      const cols = colorize(shown);
      for (let k = 0; k < Math.min(34, shown.length); k++) text(shown[k], 14 + k * CW, y, smudged ? C.faint : erased ? C.faint : cols[k]);
      if (erased) rect(14, y + 3, Math.min(34, l.length) * CW, 1, C.bad);
    });
    const def = b.def ? FOES[b.key] : null;
    if (def?.boss) text('a boss. it cannot be run from.', 8, 104, C.faint);
    text('left/right: next rote', 8, 182, C.faint);
  }

  private drawResult() {
    panel(14, 30, 164, 20 + this.resultLines.length * 8, C.good);
    textCenter('Won.', 96, 34, C.good);
    this.resultLines.forEach((l, i) => text(l.slice(0, 31), 20, 44 + i * 8, C.text));
  }

  private drawLost() {
    ditherRect(0, 0, W, H, 0, app.frame & 1);
    panel(20, 60, 152, 50, C.bad);
    textCenter('Wait goes still.', 96, 65, C.bad);
    this.menu.draw(26, 80, 140);
  }
}

export function lh() { return LH; }

function inkOf(stmts: Parameters<typeof cost>[0]): string {
  const c = cost(stmts);
  if (c.forever) return '?';
  return c.min === c.max ? `${c.min}` : `${c.min}-${c.max}`;
}
