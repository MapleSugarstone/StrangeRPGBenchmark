import { text, textWidth, charWidth, wrap, LINE } from '../engine/font';
import { input } from '../engine/input';
import { spr, type Art } from '../engine/sprites';
import { blip, sfx, type VoiceId } from '../engine/audio';
import { UI, TONE_COLOR } from './palette';
import { panel } from './ui';
import { S, fmax } from './state';
import { hashStr } from '../battle/rng';

export type Tone = 'Direct' | 'Metaphorical' | 'Fragmented' | 'Scientific' | 'Bureaucratic' | 'Existential';
export interface Opt { text: string; tone?: Tone; ok?: boolean }
export interface Portrait { art: Art; c1: string; c2: string }

const BOX_Y = 162, BOX_H = 60, TEXT_W = 206, ROWS = 5;
const GLYPHS = '#%&*+=<>[]^~|/\\';

interface Page { lines: string[] }

/** Text inside braces is untranslatable until the Pilgrim learns Thought. */
function translate(s: string): string {
  return s.replace(/\{([^}]*)\}/g, (_, inner: string) => {
    if ((S.senses.thought || 0) >= 1) return inner;
    let h = hashStr(inner);
    return [...inner].map(ch => { if (ch === ' ') return ' '; h = (h * 1103515245 + 12345) >>> 0; return GLYPHS[h % GLYPHS.length]; }).join('');
  });
}

class Dlg {
  active = false;
  speaker: string | null = null;
  voice: VoiceId = 'npc';
  seed = 0;
  portrait: Portrait | null = null;
  pages: Page[] = [];
  page = 0;
  shown = 0;
  tick = 0;
  options: Opt[] | null = null;
  cursor = 0;
  result = -1;
  pilgrim = false;
  top = false;
  /** Frames before a fresh choice list takes input, so the press that finished the question does not answer it. */
  cool = 0;
  /** Frames the closed box stays drawn, empty, so the next line in a conversation opens without the box blinking out. */
  hold = 0;

  say(speaker: string | null, body: string, voice: VoiceId = 'npc', portrait: Portrait | null = null, top = false): void {
    this.active = true;
    this.hold = 0;
    this.speaker = speaker;
    this.voice = voice;
    this.seed = hashStr(speaker || '');
    this.portrait = portrait;
    this.pilgrim = speaker === 'You';
    this.top = top;
    const lines = wrap(translate(body), TEXT_W);
    this.pages = [];
    for (let i = 0; i < lines.length; i += ROWS) this.pages.push({ lines: lines.slice(i, i + ROWS) });
    this.page = 0; this.shown = 0; this.options = null; this.result = -1;
  }

  choose(opts: Opt[], start = 0): void {
    this.options = opts;
    this.cursor = Math.max(0, Math.min(opts.length - 1, start));
    this.result = -1;
    this.active = true;
    if (!this.pages.length) this.pages = [{ lines: [] }];
    this.shown = 9999;
    this.page = this.pages.length - 1;
    this.cool = 10;
  }

  typedOut(): boolean { return this.page === this.pages.length - 1 && this.shown >= this.pageLen(); }

  private pageLen(): number { return this.pages[this.page]?.lines.join('').length || 0; }

  update(): void {
    if (!this.active) { if (this.hold > 0) this.hold--; return; }
    this.tick++;
    const len = this.pageLen();
    if (this.shown < len) {
      const speed = input.held('fast') ? 4 : this.pilgrim ? 1 + Math.min(2, S.state >> 1) : 2;
      const before = this.shown;
      this.shown = Math.min(len, this.shown + speed);
      const all = this.pages[this.page].lines.join('');
      for (let i = before; i < this.shown; i += 2) {
        const ch = all[i];
        if (ch && /[A-Za-z0-9]/.test(ch)) blip(this.voice, ch, this.seed, this.pilgrim ? (S.f / Math.max(1, fmax())) * 2 - 1 : 0);
      }
      if (input.hit('ok') || input.hit('back')) this.shown = len;
      return;
    }
    if (this.options && this.page === this.pages.length - 1) {
      if (this.cool > 0) { this.cool--; return; }
      if (input.hit('up')) { this.cursor = (this.cursor + this.options.length - 1) % this.options.length; sfx('move'); }
      if (input.hit('down')) { this.cursor = (this.cursor + 1) % this.options.length; sfx('move'); }
      if (input.hit('ok')) {
        if (this.options[this.cursor].ok === false) { sfx('buzz'); return; }
        sfx('confirm');
        this.result = this.cursor;
        this.active = false;
        this.hold = 6;
        this.options = null;
      }
      return;
    }
    if (input.hit('ok') || input.hit('back')) {
      if (this.page < this.pages.length - 1) { this.page++; this.shown = 0; }
      else { this.active = false; this.hold = 6; }
    }
  }

  draw(): void {
    const by = this.top ? 4 : BOX_Y;
    const hasText = this.pages.some(p => p.lines.length);
    if (!this.active) { if (this.hold > 0 && hasText) this.drawFrame(by); return; }
    if (hasText) {
      this.drawFrame(by);
      this.drawPage(by);
      const len = this.pageLen();
      if (this.shown >= len && !this.options && (this.tick >> 4) & 1) text('\u0002', 212, by + BOX_H - 9, UI.gold);
    }
    if (this.options && this.shown >= this.pageLen()) this.drawOptions(hasText ? by - 13 : 150);
  }

  /** The box and the speaker's name tab, without the words. */
  private drawFrame(by: number): void {
    panel(2, by, 220, BOX_H);
    if (!this.speaker) return;
    const nw = textWidth(this.speaker) + (this.portrait ? 18 : 8);
    const ty = this.top ? by + BOX_H - 2 : by - 11;
    panel(4, ty, nw, 13);
    let nx = 8;
    if (this.portrait) { spr(this.portrait.art.slice(0, 8), 7, ty + 2, this.portrait.c1, this.portrait.c2); nx = 18; }
    text(S.flags.names_storm ? this.speaker.replace(/[A-Za-z]/g, '?') : this.speaker, nx, ty + 3, UI.gold);
  }

  private drawPage(by: number): void {
    const pg = this.pages[this.page];
    if (!pg) return;
    let left = this.shown;
    const fade = this.pilgrim && S.f < fmax() * 0.2;
    const over = this.pilgrim && S.f > fmax() * 0.8;
    pg.lines.forEach((ln, row) => {
      let x = 8;
      const y = by + 5 + row * LINE;
      for (let i = 0; i < ln.length && left > 0; i++, left--) {
        const ch = ln[i];
        const h = (hashStr(ln) + i * 31) % 7;
        let col: string = UI.paper;
        let dy = 0;
        if (fade && h === 0) col = UI.faint;
        if (over && h < 2) dy = ((this.tick >> 2) + i) & 1;
        if (GLYPHS.includes(ch) && (S.senses.thought || 0) < 1) col = UI.violet;
        text(ch, x, y + dy, col);
        x += charWidth(ch);
      }
    });
  }

  private drawOptions(bottom: number): void {
    const opts = this.options!;
    const label = (o: Opt) => (o.tone ? `[${o.tone}] ` : '') + o.text;
    const w = Math.min(216, Math.max(...opts.map(o => textWidth(label(o)))) + 18);
    const h = opts.length * LINE + 8;
    const x = 222 - w, y = bottom - h;
    panel(x, y, w, h);
    opts.forEach((o, i) => {
      const yy = y + 4 + i * LINE;
      if (i === this.cursor) text('\u0001', x + 4, yy, UI.gold);
      let xx = x + 11;
      if (o.tone) xx = text(`[${o.tone}]`, xx, yy, o.ok === false ? UI.dim : TONE_COLOR[o.tone]) + 3;
      text(o.text, xx, yy, o.ok === false ? UI.dim : i === this.cursor ? UI.white : UI.paper);
    });
  }
}

export const dlg = new Dlg();
