// The fight screen. It is drawn as a blueprint: pale lines on blue (visual law 8).
import type { Action, Battle, GameEvent, State, Unit } from '../rules/types';
import { apply } from '../rules/engine';
import { unitFace, unitFaces, unitSkill } from '../rules/battle';
import { cellName, hasRelic, localDef } from '../rules/board';
import { T } from '../rules/tuning';
import { C, clear, dither, frame, line, rect, sprite, text, textRight, textWidth, W, H } from '../gfx/screen';
import { KIND_INKS, drawFace, drawPawn } from '../art/tiles';
import { ICON } from '../art/sprites';
import { G, logLine, nm } from './game';
import { confirm, frameNo, input, menu, sound, wait } from './core';
import type { Co, MenuItem } from './core';

interface View { b: Battle; shown: number[]; side: number; floats: { u: number; text: string; t: number; ink: number }[]; lines: string[]; flash: number[] }
let view: View | null = null;
let eventHook: ((e: GameEvent) => Co<void>) | null = null;

export function setBattleHook(f: ((e: GameEvent) => Co<void>) | null): void { eventHook = f; }
export function battleShown(): boolean { return view !== null; }

const FX_TEXT: Record<string, string> = {
  hit: 'A heavy blow.', hitall: 'Hits every enemy.', hit2: 'Hits two enemies.', heal: 'Heals the most hurt ally.', cover: 'Takes every single blow this round, at half.',
  stun: 'The target loses its next turn.', steal: 'A blow that takes ink.', buff: 'Raises an ally\'s attack.', pinfree: 'Pins a unit for no ink.', blurfree: 'Blurs an ally for no doubt.',
  drain: 'A blow that heals the striker.', weaken: 'A blow that lowers attack.', copy: 'A heavy blow.',
};

function slotPos(v: View, i: number): { x: number; y: number } {
  const u = v.b.units[i];
  const mates = v.b.units.filter((x) => x.side === u.side);
  const k = mates.indexOf(u);
  return { x: u.side === v.side ? 6 : 132, y: 26 + k * 40 };
}

function unitInks(s: State, u: Unit): [number, number] {
  if (u.comp >= 0) { const def = localDef(u.key); const ki = def ? KIND_INKS[def.kind] : KIND_INKS.town; return [ki[1], ki[0]]; }
  return [C.bp2, C.bp3];
}

export function drawBattle(): void {
  const v = view;
  const s = G.s;
  if (!v || !s) return;
  const b = v.b;
  clear(C.bp0);
  for (let x = 0; x < W; x += 16) for (let y = 0; y < H; y += 2) if ((y & 2) === 0) rect(x, y, 1, 1, C.bp1);
  for (let y = 0; y < H; y += 16) for (let x = 0; x < W; x += 2) if ((x & 2) === 0) rect(x, y, 1, 1, C.bp1);
  rect(0, 0, W, 18, C.bp1);
  const foe = b.units.find((u) => u.side !== v.side);
  text('Contest at ' + cellName(b.cell), 4, 5, C.bp3);
  textRight('Round ' + Math.min(b.round, T.fightRounds) + ' of ' + T.fightRounds + (b.boss === 'scale' ? '   Ratio ' + (b.ratio < 1 ? '1 to 2' : '2 to 1') : ''), W - 4, 5, C.bp3);
  void foe;
  const cur = !b.done && b.queue[b.qi] !== undefined ? b.queue[b.qi] : -1;
  b.units.forEach((u, i) => {
    const { x, y } = slotPos(v, i);
    const w = 118, h = 37;
    rect(x, y, w, h, C.bp0);
    frame(x, y, w, h, i === cur ? C.hi : C.bp2);
    if (v.flash[i] > 0) { dither(x + 1, y + 1, w - 2, h - 2, C.bp3, 6); v.flash[i]--; }
    const open = u.two && !u.fixed;
    if (u.leader) {
      rect(x + 3, y + 3, 26, 31, C.paper);
      drawPawn(s.players[u.owner].char, x + 7 + (s.players[u.owner].char === 'lot' ? -3 : 0), y + 31, frameNo, 0, 2);
    } else {
      rect(x + 3, y + 5, 26, 26, C.paper);
      const [a, c2] = unitInks(s, u);
      drawFace(u.key, x + 4, y + 6, 3, frameNo, open, u.r, a, c2);
    }
    if (u.down) { dither(x + 3, y + 3, 26, 31, C.bp0, 10); line(x + 4, y + 32, x + 28, y + 5, C.warn); }
    text(u.name, x + 33, y + 2, u.down ? C.bp2 : C.bp3);
    const f = unitFace(s, u);
    const tag = u.down ? 'down' : u.half && u.key !== 'page' ? 'struck reading' : !u.two ? 'fixed' : open ? 'undecided' : 'fixed: ' + f.gloss;
    text(tag, x + 33, y + 10, open ? C.doubt1 : C.bp2);
    const bw = 64;
    frame(x + 33, y + 20, bw + 2, 6, C.bp3);
    const hp = Math.max(0, Math.min(u.max, v.shown[i]));
    rect(x + 34, y + 21, Math.round((bw * hp) / u.max), 4, hp / u.max < 0.3 ? C.warn : C.bp3);
    textRight(Math.ceil(hp) + '', x + w - 3, y + 19, C.bp3);
    let sx = x + 33;
    const mark = (t: string, ink: number) => { text(t, sx, y + 27, ink); sx += textWidth(t) + 4; };
    mark('atk ' + (u.atk + u.buff + u.grow - u.weak), C.bp2);
    if (u.guard) mark(u.cover ? 'cover' : 'guard', C.bp3);
    if (u.stun) mark('held', C.hi);
    if (open) mark('half', C.doubt1);
  });
  for (const f of v.floats) {
    const { x, y } = slotPos(v, f.u);
    const tx = x + 60, ty = y + 10 - Math.floor(f.t / 3);
    rect(tx - 2, ty - 1, textWidth(f.text) + 4, 10, C.bp0);
    text(f.text, tx, ty, f.ink);
    f.t++;
  }
  v.floats = v.floats.filter((f) => f.t < 36);
  rect(0, 150, W, 1, C.bp2);
  v.lines.slice(-4).forEach((ln, i, arr) => text(ln.slice(0, 50), 6, 154 + i * 9, i === arr.length - 1 ? C.bp3 : C.bp2));
  const me = s.players[b.units.find((u) => u.side === v.side && u.owner >= 0)?.owner ?? 0];
  rect(0, 192, W, 1, C.bp2);
  let px0 = 150;
  sprite(ICON.ink, px0, 196, { '#': C.bp3, o: C.bp2, w: C.white }); px0 += 10; px0 += text(String(me.ink), px0, 196, C.bp3) + 8;
  sprite(ICON.doubt, px0, 196, { '#': C.doubt1, o: C.doubt2 }); px0 += 10; text(String(me.doubt), px0, 196, C.bp3);
  text('Undecided: deals half,', 150, 210, C.bp2);
  text('takes half.', 150, 219, C.bp2);
  text('Pin 1 ink. Blur 1 doubt.', 150, 232, C.bp2);
}

function* playEvents(): Co<void> {
  const s = G.s!;
  const v = view!;
  let i = 0;
  while (i < s.events.length) {
    const e = s.events[i];
    if (e.t === 'fightEnd' || e.t === 'spoils' || e.t === 'retreat' || e.t === 'uproot' || e.t === 'denDown' || e.t === 'siteWon' || e.t === 'struckComp' || e.t === 'levelDown') break;
    if (e.t !== 'hit' && e.t !== 'pin' && e.t !== 'blur' && e.t !== 'fightLog' && e.t !== 'fightStart') { i++; continue; }
    s.events.splice(i, 1);
    let pause = 0;
    if (e.t === 'hit') {
      v.shown[e.q!] = Math.max(0, v.shown[e.q!] - e.n!);
      v.floats.push({ u: e.q!, text: '-' + e.n, t: 0, ink: C.hi });
      v.flash[e.q!] = 5;
      sound.sfx('hit');
      pause = 16;
    } else if (e.t === 'pin') { v.floats.push({ u: e.q!, text: 'pinned', t: 0, ink: C.white }); sound.sfx('stamp'); pause = 20; }
    else if (e.t === 'blur') { v.floats.push({ u: e.q!, text: 'blurred', t: 0, ink: C.doubt1 }); sound.sfx('doubt'); pause = 20; }
    else if (e.t === 'fightLog') { v.lines.push(e.s!); logLine(e.s!, C.gray); pause = 6; }
    if (eventHook) yield* eventHook(e);
    if (pause) yield* wait(input.held('fast') ? 2 : pause, false);
  }
  v.b.units.forEach((u, k) => { if (v.shown[k] !== u.hp) v.shown[k] = u.hp; });
}

function* pickUnit(title: string, list: number[]): Co<number> {
  const v = view!;
  if (list.length === 1) return list[0];
  const items: MenuItem[] = list.map((i) => { const u = v.b.units[i]; return { label: u.name, right: u.hp + '/' + u.max, hint: (u.two && !u.fixed ? 'Undecided: takes half. ' : 'Fixed: takes full. ') + (u.leader ? 'Leader. The side falls with it.' : '') }; });
  const r = yield* menu(items, { title, x: 6, y: 196, w: 138 });
  return r < 0 ? -1 : list[r];
}

function* pickReading(i: number): Co<number> {
  const s = G.s!;
  const u = view!.b.units[i];
  const [a, bf] = unitFaces(s, u);
  if (!bf) return 1;
  const r = yield* menu(
    [{ label: 'As ' + a.gloss, hint: a.hp + ' health, ' + a.atk + ' attack. ' + a.skill.name + '.' }, { label: 'As ' + bf.gloss, hint: bf.hp + ' health, ' + bf.atk + ' attack. ' + bf.skill.name + '.' }],
    { title: 'Pin ' + u.name, x: 6, y: 196, w: 138 },
  );
  return r < 0 ? -1 : r + 1;
}

function* command(ui: number): Co<Action | null> {
  const s = G.s!;
  const v = view!;
  const b = v.b;
  const u = b.units[ui];
  const me = s.players[u.owner];
  const foes = b.units.map((x, i) => i).filter((i) => b.units[i].side !== u.side && !b.units[i].down);
  const mates = b.units.map((x, i) => i).filter((i) => b.units[i].side === u.side && !b.units[i].down);
  const sk = unitSkill(s, u);
  const pinnable = b.units.map((x, i) => i).filter((i) => !b.units[i].down && b.units[i].two && !b.units[i].fixed);
  const bubble = hasRelic(me, 'bubble', 1) && !b.bubbleUsed[u.side];
  const blurrable = b.units.map((x, i) => i).filter((i) => { const x = b.units[i]; return !x.down && x.two && x.fixed && !x.half && (x.side === u.side || bubble); });
  const items: MenuItem[] = [
    { label: 'Strike', hint: 'Deal ' + (u.atk + u.buff + u.grow - u.weak) + (u.two && !u.fixed ? ', halved while undecided.' : '.') },
    { label: sk.name, off: u.cd > 0, right: u.cd > 0 ? 'in ' + u.cd : '', hint: FX_TEXT[sk.fx] },
    { label: 'Pin', right: '1 ink', off: me.ink < 1 || !pinnable.length, hint: 'Fix any undecided unit. It deals full and takes full. Pins on companions last.' },
    { label: 'Blur', right: bubble ? 'Bubble' : '1 doubt', off: !blurrable.length || (!bubble && me.doubt < 1), hint: 'Return one of your fixed units to undecided.' },
    { label: 'Guard', hint: 'Take half until this unit acts again.' },
  ];
  if (u.leader) items.push({ label: 'Withdraw', hint: 'Lose the fight at half the price.' });
  const r = yield* menu(items, { title: u.name, x: 6, y: 196, w: 138, cancel: false });
  const mk = (a: 'strike' | 'skill' | 'pin' | 'blur' | 'guard' | 'withdraw', target: number, rd = 1): Action => ({ t: 'bat', a, target, r: rd });
  if (r === 0) { const t = yield* pickUnit('Strike whom', foes); return t < 0 ? null : mk('strike', t); }
  if (r === 1) {
    if (['hit', 'hit2', 'stun', 'steal', 'drain', 'weaken', 'copy'].includes(sk.fx)) { const t = yield* pickUnit(sk.name, foes); return t < 0 ? null : mk('skill', t); }
    if (sk.fx === 'pinfree') {
      if (!pinnable.length) return mk('skill', foes[0]);
      const t = yield* pickUnit('Pin whom', pinnable);
      if (t < 0) return null;
      const rd = yield* pickReading(t);
      return rd < 0 ? null : mk('skill', t, rd);
    }
    if (sk.fx === 'blurfree') { const own = blurrable.filter((i) => b.units[i].side === u.side); if (!own.length) return mk('skill', ui); const t = yield* pickUnit('Blur whom', own); return t < 0 ? null : mk('skill', t); }
    return mk('skill', mates[0]);
  }
  if (r === 2) {
    const t = yield* pickUnit('Pin whom', pinnable);
    if (t < 0) return null;
    const rd = yield* pickReading(t);
    return rd < 0 ? null : mk('pin', t, rd);
  }
  if (r === 3) { const t = yield* pickUnit('Blur whom', blurrable); return t < 0 ? null : mk('blur', t); }
  if (r === 4) return mk('guard', ui);
  if (r === 5) { const ok = yield* confirm('Withdraw from the fight?', 'Withdraw', 'Stay'); return ok ? mk('withdraw', ui) : null; }
  return null;
}

/** Runs the human's part of a fight until it ends. */
export function* battleFlow(): Co<void> {
  const s = G.s!;
  const b = s.battle!;
  const human = s.players[s.pending.p];
  const side = b.att === human.idx ? 0 : 1;
  const shown = b.units.map((u) => u.hp);
  for (const e of s.events) if (e.t === 'hit') shown[e.q!] += e.n!;
  b.units.forEach((u, i) => { shown[i] = Math.min(u.max, shown[i]); });
  view = { b, shown, side, floats: [], lines: [], flash: b.units.map(() => 0) };
  sound.sfx('fight');
  yield* wait(10, false);
  yield* playEvents();
  while (s.battle === b && s.pending.t === 'battle') {
    const ui = b.queue[b.qi];
    const act = yield* command(ui);
    if (!act) continue;
    apply(s, act);
    yield* playEvents();
  }
  yield* playEvents();
  const won = b.winner === side;
  view.lines.push(won ? 'The fight is yours.' : b.withdrew ? 'You withdraw.' : 'You are beaten back.');
  sound.sfx(won ? 'win' : 'lose');
  yield* wait(70, true);
  view = null;
  void H; void nm;
}
