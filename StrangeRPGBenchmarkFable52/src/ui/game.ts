// Shared game state for the screens, and the drawing of the board and its panels.
import { FIXED, OPEN } from '../rules/types';
import type { CharId, Player, State } from '../rules/types';
import { CHARTER_NAME, CHAR_NAME, CLAIM_TEXT, KIND_NAME, LAW_TEXT } from '../rules/data';
import { T } from '../rules/tuning';
import { cellName, claimProgress, compFace, compName, counts, filedClaim, inTruce, localDef, pcell, standing } from '../rules/board';
import type { Campaign } from '../rules/campaign';
import { C, clear, dither, frame, line, px, rect, sprite, text, textRight, textWidth, W, H } from '../gfx/screen';
import { BX, BY, KIND_INKS, PARTY_INK, TS, drawDoubtFringe, drawFace, drawPawn, drawPeg, drawTile, pawnSize, tileX, tileY } from '../art/tiles';
import { ICON, KIND_ICON, RELIC_ICON } from '../art/sprites';
import { frameNo } from './core';

export interface Prop { key: string; x: number; y: number; tx: number; ty: number; hide: boolean; open: boolean }
export interface Fx { kind: string; x: number; y: number; t: number; life: number; text?: string; ink?: number; a?: number; b?: number }
export interface LogLine { text: string; ink: number }

export const G = {
  camp: null as Campaign | null,
  s: null as State | null,
  free: false,
  pawns: [] as { x: number; y: number }[],
  props: new Map<string, Prop>(),
  fx: [] as Fx[],
  log: [] as LogLine[],
  cells: null as number[] | null,
  cellCur: -1,
  viewer: 0,
  banner: '' as string,
  bannerT: 0,
  hideHud: false,
  signed: [] as string[],
  shadowOff: false,
  waiting: false,
  profiles: [] as (import('../rules/ai').Profile | null)[],
};

export function nm(p: Player | CharId): string { return CHAR_NAME[typeof p === 'string' ? p : p.char]; }
export function inkOf(c: CharId): number { return c === 'deed' ? C.ink : PARTY_INK[c]; }

export function logLine(text0: string, ink: number = C.ink): void {
  G.log.push({ text: text0, ink });
  if (G.log.length > 60) G.log.shift();
}

export function fmtCount(n: number): string {
  const whole = Math.floor(n);
  return n - whole >= 0.5 ? (whole ? String(whole) : '') + '½' : String(whole);
}

export function pawnTarget(s: State, i: number): { x: number; y: number } {
  const p = s.players[i];
  const c = pcell(p);
  const here = s.players.filter((q) => pcell(q) === c);
  const k = here.indexOf(p);
  const [w] = pawnSize(p.char);
  const spread = here.length > 1 ? (k - (here.length - 1) / 2) * 7 : 0;
  return { x: tileX(c) + 12 - (w >> 1) + Math.round(spread), y: tileY(c) + TS - 2 };
}

export function resetView(s: State): void {
  G.pawns = s.players.map((_, i) => pawnTarget(s, i));
  G.props.clear();
  G.fx = [];
  G.cells = null;
  G.signed = [];
  G.shadowOff = false;
}

export function addFx(f: Fx): void { G.fx.push(f); }

export function floatText(c: number, text0: string, ink: number): void {
  addFx({ kind: 'float', x: tileX(c) + 12, y: tileY(c) + 6, t: 0, life: 50, text: text0, ink });
}

function drawFx(): void {
  for (const f of G.fx) {
    const u = f.t / f.life;
    if (f.kind === 'float' && f.text) {
      const w = textWidth(f.text);
      const x = f.x - (w >> 1), y = f.y - Math.floor(u * 12);
      rect(x - 2, y - 1, w + 4, 10, C.paper);
      frame(x - 2, y - 1, w + 4, 10, f.ink ?? C.ink);
      text(f.text, x, y, f.ink ?? C.ink);
    } else if (f.kind === 'sight') {
      const xx = f.x + Math.floor(u * TS);
      line(xx, f.y, xx, f.y + TS - 1, C.white);
      line(xx + 1, f.y, xx + 1, f.y + TS - 1, C.ink);
    } else if (f.kind === 'struck') {
      const yy = f.y - Math.floor(u * 30);
      const lvl = Math.max(1, Math.floor(10 * (1 - u)));
      for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
        const row = KIND_ICON[f.text ?? 'road'][j];
        if (row[i] === '.') continue;
        if (((i + j + Math.floor(f.t / 4)) & 3) < (lvl > 6 ? 4 : lvl > 3 ? 2 : 1)) px(f.x + i, yy + j, row[i] === '#' ? C.ink : f.ink ?? C.pencil);
      }
    } else if (f.kind === 'ring') {
      const r = Math.floor(u * 14);
      for (let a = 0; a < 16; a++) px(f.x + Math.round(Math.cos(a * 0.3927) * r), f.y + Math.round(Math.sin(a * 0.3927) * r), f.ink ?? C.perch);
    } else if (f.kind === 'stamp') {
      const s = 10 - Math.floor(u * 4);
      frame(f.x - s, f.y - s, s * 2, s * 2, f.ink ?? C.town2);
    }
  }
}

export function stepView(): void {
  const s = G.s;
  if (s) {
    for (let i = 0; i < s.players.length; i++) {
      const t = pawnTarget(s, i);
      const p = G.pawns[i] ?? (G.pawns[i] = { ...t });
      p.x += Math.sign(t.x - p.x) * Math.min(3, Math.abs(t.x - p.x));
      p.y += Math.sign(t.y - p.y) * Math.min(3, Math.abs(t.y - p.y));
    }
  }
  for (const pr of G.props.values()) {
    pr.x += Math.sign(pr.tx - pr.x) * Math.min(2, Math.abs(pr.tx - pr.x));
    pr.y += Math.sign(pr.ty - pr.y) * Math.min(2, Math.abs(pr.ty - pr.y));
  }
  for (const f of G.fx) f.t++;
  G.fx = G.fx.filter((f) => f.t < f.life);
  if (G.bannerT > 0) G.bannerT--;
}

export function pawnsSettled(): boolean {
  const s = G.s;
  if (!s) return true;
  for (let i = 0; i < s.players.length; i++) {
    const t = pawnTarget(s, i);
    if (G.pawns[i].x !== t.x || G.pawns[i].y !== t.y) return false;
  }
  for (const pr of G.props.values()) if (pr.x !== pr.tx || pr.y !== pr.ty) return false;
  return true;
}

function drawProp(pr: Prop): void {
  if (pr.hide) return;
  const k = pr.key;
  if (k === 'deed' || k === 'either' || k === 'level' || k === 'auger' || k === 'offset' || k === 'lot' || k === 'perch') drawPawn(k, pr.x, pr.y, frameNo);
  else if (k === 'page_child') drawFace('page', pr.x, pr.y - 9, 1, frameNo, false, 1, C.town2, C.town1);
  else if (k === 'page_paper') drawFace('paper', pr.x, pr.y - 9, 1, frameNo, false, 1, C.town2, C.town1);
  else if (k === 'page') { drawFace('page', pr.x - 2, pr.y - 9, 1, frameNo, false, 1, C.town2, C.town1); if ((frameNo >> 5) & 1) drawFace('paper', pr.x + 3, pr.y - 9, 1, frameNo, false, 1, C.town2, C.town1); }
  else if (k === 'page_grown') drawFace('page', pr.x, pr.y - 17, 2, frameNo, false, 1, C.town3, C.town1);
  else if (k === 'page_blank') drawFace('paper', pr.x, pr.y - 9, 1, frameNo, false, 1, C.white, C.white);
  else drawFace(k, pr.x, pr.y - 9, 1, frameNo, pr.open, 1, C.peak2, C.peak1);
}

export function drawBoard(): void {
  const s = G.s;
  clear(C.paper);
  if (!s) return;
  const letters = 'ABCDEFG';
  for (let i = 0; i < T.W; i++) text(letters[i], BX + i * TS + 10, BY - 9, C.pencil);
  for (let j = 0; j < T.H; j++) text(String(j + 1), 2, BY + j * TS + 8, C.pencil);
  for (let c = 0; c < s.tiles.length; c++) drawTile(s, c, frameNo);
  drawDoubtFringe(s, frameNo);
  frame(BX - 1, BY - 1, T.W * TS + 2, T.H * TS + 2, C.sepia);
  for (let c = 0; c < s.tiles.length; c++) {
    const t = s.tiles[c];
    if (t.peg >= 0) drawPeg(tileX(c), tileY(c), s.players[t.peg].char, t.st === OPEN, frameNo);
  }
  if (G.cells) {
    for (const c of G.cells) {
      const on = c === G.cellCur;
      const x = tileX(c), y = tileY(c);
      if (on) { frame(x, y, TS, TS, C.perch); frame(x + 1, y + 1, TS - 2, TS - 2, C.white); }
      else if ((frameNo >> 3) & 1) dither(x, y, TS, TS, C.perch, 2);
      else frame(x, y, TS, TS, C.hi);
    }
  }
  if (s.level && s.level.alive) drawPawn('level', BX + s.level.x * TS + 4, BY + s.level.y * TS + TS - 3, frameNo);
  const order = s.players.map((_, i) => i).sort((a, b) => G.pawns[a].y - G.pawns[b].y);
  for (const pr of G.props.values()) drawProp(pr);
  for (const i of order) {
    const p = s.players[i];
    const shadow = p.char !== 'either' && !G.shadowOff ? p.doubt : 0;
    drawPawn(p.char, G.pawns[i].x, G.pawns[i].y, frameNo, p.char === 'perch' ? shadow : 0);
    if (s.pending.t === 'turn' && s.pending.p === i && !s.over && (frameNo >> 4) & 1) {
      const [w, h] = pawnSize(p.char);
      sprite(['.#.', '###', '.#.'], G.pawns[i].x + (w >> 1) - 1, G.pawns[i].y - h - 5, { '#': inkOf(p.char) });
    }
  }
  drawFx();
  if (!G.hideHud) { drawTop(s); drawCards(s); drawBottom(s); }
  if (G.bannerT > 0 && G.banner) {
    const w = textWidth(G.banner) + 16;
    const x = BX + ((T.W * TS - w) >> 1), y = BY + 70;
    rect(x + 2, y + 2, w, 15, C.paper3);
    rect(x, y, w, 15, C.ink);
    text(G.banner, x + 8, y + 4, C.white);
  }
}

function drawTop(s: State): void {
  rect(0, 0, W, 10, C.paper2);
  rect(0, 10, W, 1, C.sepia);
  text(G.free ? 'Free play' : 'Sheet ' + (39 + s.season), 3, 1, C.ink);
  text('Round ' + Math.min(s.round, s.rounds) + '/' + s.rounds, 60, 1, C.ink);
  let x = 116;
  x += text('Counts ', x, 1, C.sepia);
  if (s.charter !== 'acres') { const ki = KIND_INKS[s.charter]; sprite(KIND_ICON[s.charter], x, 1, { '#': C.ink, o: ki[0], x: ki[1], w: C.white }); x += 10; }
  text(CHARTER_NAME[s.charter], x, 1, C.ink);
  if (s.law !== 'none') textRight(LAW_TEXT[s.law].name, W - 3, 1, C.sepia);
}

function drawCards(s: State): void {
  const cnt = counts(s);
  const lead = standing(s).winner;
  const x = BX + T.W * TS + 3, w = W - x - 1;
  const h = 41;
  const v = s.players[G.viewer];
  s.players.forEach((p, i) => {
    const y = BY - 1 + i * 42;
    const turn = s.pending.p === i && !s.over;
    rect(x, y, w, h, turn ? C.white : C.paper);
    frame(x, y, w, h, turn ? inkOf(p.char) : C.paper3);
    if (turn) frame(x + 1, y + 1, w - 2, h - 2, inkOf(p.char));
    drawPawn(p.char, x + 4, y + 17, frameNo);
    text(nm(p), x + 19, y + 3, inkOf(p.char));
    if (s.holder === i) sprite(ICON.crown, x + 19 + textWidth(nm(p)) + 3, y + 3, { '#': C.ink, o: C.gold });
    const ct = p.filed ? 'claim' : p.backs >= 0 && p.backs !== i ? 'backs' : fmtCount(cnt[i]);
    const cw = textWidth(ct) + 6;
    if (lead === i) { rect(x + w - cw - 3, y + 2, cw, 11, C.ink); text(ct, x + w - cw, y + 4, C.white); }
    else { frame(x + w - cw - 3, y + 2, cw, 11, C.pencil); text(ct, x + w - cw, y + 4, C.ink); }
    let ix = x + 19;
    sprite(ICON.ink, ix, y + 14, { '#': C.ink, o: C.well2, w: C.white }); ix += 9; ix += text(String(p.ink), ix, y + 14, C.ink) + 4;
    if (s.flags.doubt) { sprite(ICON.doubt, ix, y + 14, { '#': C.doubt3, o: C.doubt2 }); ix += 9; ix += text(String(p.doubt), ix, y + 14, C.ink) + 4; }
    sprite(ICON.peg, ix, y + 14, { '#': C.ink, o: inkOf(p.char) }); ix += 7; text(String(p.pegs), ix, y + 14, C.ink);
    let mx = x + 4;
    const my = y + 27;
    if (i !== G.viewer && s.flags.trades) {
      const tr = s.trust[i][G.viewer];
      rect(mx, my + 3, 23, 1, C.pencil);
      rect(mx + 11, my + 1, 1, 5, C.ink);
      for (let k = 1; k <= Math.abs(tr); k++) rect(mx + 11 + Math.sign(tr) * k * 2 - (tr > 0 ? 0 : 0), my + 1, 1, 5, tr > 0 ? C.ok : C.warn);
      mx += 27;
      if (inTruce(s, i, G.viewer)) { sprite(ICON.truce, mx, my, { '#': C.ink, o: C.ok }); mx += 9; }
    }
    if (p.filed) {
      const id = filedClaim(p)!;
      const [have, need] = claimProgress(s, p, id);
      sprite(ICON.claim, mx, my, { '#': C.ink, o: C.gold, w: C.white }); mx += 9;
      mx += text(Math.min(have, need) + '/' + need, mx, my, have >= need ? C.warn : C.ink) + 3;
    }
    if (p.backs >= 0 && p.backs !== i) { sprite(ICON.back, mx, my, { '#': C.ink, o: inkOf(s.players[p.backs].char) }); mx += 9; }
    for (const c of p.ret.slice(0, 3)) {
      if (mx > x + w - 10) break;
      const def = localDef(c.id);
      const ki = def ? KIND_INKS[def.kind] : KIND_INKS.town;
      drawFace(c.id === 'page' ? 'page' : c.id, mx, my, 1, frameNo, c.fixed === 0 && !c.half, c.fixed || c.active, ki[1], ki[0]);
      if (c.down) line(mx, my + 7, mx + 7, my, C.warn);
      mx += 10;
    }
    void v;
  });
}

export function drawDraft(x: number, y: number, a: string, b: string, den: boolean, sel: boolean): void {
  rect(x, y, 30, 14, C.white);
  frame(x, y, 30, 14, sel ? C.perch : C.ink);
  const ka = KIND_INKS[a as 'road'], kb = KIND_INKS[b as 'road'];
  sprite(KIND_ICON[a], x + 3, y + 3, { '#': C.ink, o: ka[0], x: ka[1], w: C.white });
  for (let j = 2; j < 12; j += 2) px(x + 14, y + j, C.pencil);
  sprite(KIND_ICON[b], x + 18, y + 3, { '#': C.ink, o: kb[0], x: kb[1], w: C.white });
  if (den) sprite(ICON.den, x + 23, y - 3, { '#': C.ink, o: C.doubt2 });
}

function drawBottom(s: State): void {
  const y0 = BY + T.H * TS + 2;
  rect(0, y0, W, H - y0, C.paper2);
  rect(0, y0, W, 1, C.sepia);
  const p = s.players[G.viewer];
  const mine = s.pending.p === G.viewer && s.pending.t === 'turn' && p.human && !s.over;
  if (mine) {
    let x = 4;
    x += text('Steps', x, y0 + 4, C.sepia) + 4;
    for (let i = 0; i < Math.max(p.steps, T.steps); i++) {
      sprite(ICON.step, x, y0 + 4, { '#': i < p.steps ? C.ink : C.pencil, o: i < p.steps ? C.perch : C.paper3 });
      x += 9;
    }
    x = 96;
    for (const d of p.hand) { drawDraft(x, y0 + 3, d.a, d.b, !!d.den, false); x += 33; }
    let rx = 4;
    const ry = y0 + 21;
    for (const c of p.ret) {
      const def = localDef(c.id);
      const ki = def ? KIND_INKS[def.kind] : KIND_INKS.town;
      drawFace(c.id, rx, ry, 1, frameNo, c.fixed === 0 && !c.half, c.fixed || c.active, ki[1], ki[0]);
      const label = compName(c) + (c.half ? '' : c.fixed ? ' (' + compFace(c).gloss + ')' : '');
      rx += 10 + text(label, rx + 10, ry, c.down ? C.pencil : C.ink) + 6;
    }
    for (const r of p.relics) { sprite(RELIC_ICON[r.id], rx, ry, { '#': C.ink, o: C.gold, w: C.white }); rx += 11; }
    const here = s.tiles[pcell(p)];
    text('Here: ' + tileLabel(s, pcell(p)) + (here.peg >= 0 ? ', ' + nm(s.players[here.peg]) + "'s peg" : '') + (here.den ? ', a den' : '') + (here.site ? ', a site' : ''), 4, y0 + 32, C.ink);
    const last = G.log[G.log.length - 1];
    if (last) text(last.text.slice(0, 50), 4, y0 + 43, C.sepia);
    text('Z: actions   Arrows: move   Tab: info   E: end turn', 4, y0 + 54, C.pencil);
  } else {
    const lines = G.log.slice(-5);
    lines.forEach((l, i) => text(l.text.slice(0, 50), 4, y0 + 4 + i * 9, i === lines.length - 1 ? l.ink : C.gray));
  }
}

export function setBanner(text0: string, frames = 70): void { G.banner = text0; G.bannerT = frames; }

export function claimLabel(id: string): string { return CLAIM_TEXT[id]?.name ?? id; }
export function tileLabel(s: State, c: number): string {
  const t = s.tiles[c];
  if (t.st === FIXED) return cellName(c) + ' ' + KIND_NAME[t.k!];
  if (t.st === OPEN) return cellName(c) + ' ' + KIND_NAME[t.a] + ' or ' + KIND_NAME[t.b];
  return cellName(c) + ' blank';
}
