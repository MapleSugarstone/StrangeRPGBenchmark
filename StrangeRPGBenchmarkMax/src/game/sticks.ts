// Sticks: a board game played across the world. A placed stick casts a lead away from the lamp, and any
// opposing stick inside the lead with a lower footing than the new stick's height flips to the placer.
import { blit, box, rect, blitUI, stampLead, img, type Img } from '../engine/gfx';
import { addLight, beginLight, composite } from '../engine/light';
import { drawText, textWidth, centerX, wrap, LINE_H } from '../engine/font';
import { C, SHADES } from '../engine/palette';
import { W, H, clearLayers } from '../engine/screen';
import { pressed, repeat } from '../engine/input';
import { GAME, type Screen } from './game';
import { G } from './state';
import { registerSticks } from './menus';
import { sfx, playMusic } from '../audio';
import { makeRng } from '../battle/rules';
import { icon } from './art';

export interface StickKind { id: string; name: string; h: number; f: number; pane?: boolean }
export const KINDS: Record<string, StickKind> = {
  s1: { id: 's1', name: 'Twig', h: 1, f: 1 }, s2: { id: 's2', name: 'Peg', h: 1, f: 2 }, s3: { id: 's3', name: 'Reed', h: 2, f: 1 },
  s4: { id: 's4', name: 'Post', h: 2, f: 2 }, s5: { id: 's5', name: 'Pole', h: 3, f: 1 }, s6: { id: 's6', name: 'Stump', h: 1, f: 3 },
  s7: { id: 's7', name: 'Mast', h: 3, f: 2 }, s8: { id: 's8', name: 'Pillar', h: 2, f: 3 }, s9: { id: 's9', name: 'Gnomon', h: 3, f: 3 },
  hollow: { id: 'hollow', name: 'Hollow', h: 0, f: 3 }, pane: { id: 'pane', name: 'Pane', h: 2, f: 2, pane: true }, candle: { id: 'candle', name: 'Candle', h: 1, f: 1 },
};

type Rule = 'basic' | 'still' | 'twolamp' | 'short' | 'mirror' | 'noon' | 'dark' | 'late';
export const RULE_TEXT: Record<Rule, string> = {
  basic: 'The lamp moves one step round the board after every stick.',
  still: 'The lamp never moves.',
  twolamp: 'Two lamps, opposite each other. Every stick casts two leads.',
  short: 'The lamp sits high. Every lead is one tile long.',
  mirror: 'Leads bounce off the edge of the board.',
  noon: 'No leads at all. A stick flips the sticks right next to it.',
  dark: 'One candle in the middle. Leads point away from it.',
  late: 'Flips happen one turn after the stick goes down.',
};

export interface Opponent { id: string; name: string; rule: Rule; deck: string[]; prize: string; depth: number }
export const OPPONENTS: Record<string, Opponent> = {
  pip: { id: 'pip', name: 'Pip and Wem', rule: 'basic', deck: ['s1', 's1', 's2', 's3', 's1'], prize: 's3', depth: 0 },
  parhelia: { id: 'parhelia', name: 'Parhelia', rule: 'still', deck: ['s3', 's4', 's2', 's5', 's1'], prize: 's6', depth: 1 },
  twolamp: { id: 'twolamp', name: 'Gilder', rule: 'twolamp', deck: ['s3', 's4', 's2', 's4', 's1'], prize: 's4', depth: 1 },
  short: { id: 'short', name: 'Pellucid', rule: 'short', deck: ['s6', 's4', 's2', 's8', 's3'], prize: 's8', depth: 1 },
  mirror: { id: 'mirror', name: 'Laval', rule: 'mirror', deck: ['pane', 's4', 's5', 's3', 's2'], prize: 'pane', depth: 1 },
  noon: { id: 'noon', name: 'Whim', rule: 'noon', deck: ['s5', 's7', 's6', 's4', 'hollow'], prize: 's7', depth: 1 },
  dark: { id: 'dark', name: 'Scuff', rule: 'dark', deck: ['candle', 's7', 's8', 's5', 's4'], prize: 'hollow', depth: 2 },
  anthelion: { id: 'anthelion', name: 'Anthelion', rule: 'late', deck: ['s9', 's7', 's8', 's7', 's5'], prize: 's9', depth: 2 },
};

// Eight lamp places round the board, clockwise from the top. Leads point away from the lamp.
const LAMP_DIR: [number, number][] = [[0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1]];

interface Cell { kind: string; owner: 0 | 1 }
interface State { board: (Cell | null)[]; lamp: number; hands: [string[], string[]]; turn: 0 | 1; rule: Rule; pending: { at: number[]; owner: 0 | 1; due: number }[]; placed: number }

const N = 5;

function dirsFor(s: State, at: number): [number, number][] {
  if (s.rule === 'noon') return [];
  if (s.rule === 'dark') {
    const x = at % N, y = Math.floor(at / N);
    const dx = Math.sign(x - 2), dy = Math.sign(y - 2);
    return dx === 0 && dy === 0 ? [] : [[dx, dy]];
  }
  const d = LAMP_DIR[s.lamp];
  if (s.rule === 'twolamp') return [d, LAMP_DIR[(s.lamp + 4) % 8]];
  return [d];
}

/** The cells a stick at `at` would cover with its lead. */
export function leadCells(s: State, at: number, kind: string): number[] {
  const k = KINDS[kind];
  const out: number[] = [];
  if (s.rule === 'noon') {
    const x = at % N, y = Math.floor(at / N);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < N && ny < N) out.push(ny * N + nx); }
    return out;
  }
  const len = s.rule === 'short' ? Math.min(1, k.h) : k.h;
  for (const d0 of dirsFor(s, at)) {
    let x = at % N, y = Math.floor(at / N);
    let [dx, dy] = d0;
    for (let i = 0; i < len; i++) {
      let nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= N || ny < 0 || ny >= N) {
        if (s.rule !== 'mirror' && !k.pane) break;
        if (nx < 0 || nx >= N) dx = -dx;
        if (ny < 0 || ny >= N) dy = -dy;
        nx = x + dx; ny = y + dy;
        if (nx < 0 || nx >= N || ny < 0 || ny >= N) break;
      }
      x = nx; y = ny;
      const c = y * N + x;
      if (s.rule === 'dark' && c === 12) break;
      out.push(c);
    }
  }
  return out;
}

function flipsFor(s: State, at: number, kind: string, owner: 0 | 1): number[] {
  const h = KINDS[kind].h;
  return leadCells(s, at, kind).filter((c) => { const t = s.board[c]; return t && t.owner !== owner && KINDS[t.kind].f < h; });
}

function place(s: State, at: number, handIdx: number): number[] {
  const owner = s.turn;
  const kind = s.hands[owner][handIdx];
  s.hands[owner].splice(handIdx, 1);
  s.board[at] = { kind, owner };
  const flips = flipsFor(s, at, kind, owner);
  if (s.rule === 'late') s.pending.push({ at: flips, owner, due: s.placed + 1 });
  else for (const c of flips) s.board[c]!.owner = owner;
  s.placed++;
  for (const p of s.pending.filter((p) => p.due <= s.placed - 1 && p !== s.pending[s.pending.length - 1])) for (const c of p.at) if (s.board[c]) s.board[c]!.owner = p.owner;
  s.pending = s.pending.filter((p) => !(p.due <= s.placed - 1) || p === s.pending[s.pending.length - 1]);
  if (s.rule === 'basic' || s.rule === 'twolamp' || s.rule === 'mirror' || s.rule === 'short' || s.rule === 'late') s.lamp = (s.lamp + 1) % 8;
  s.turn = owner === 0 ? 1 : 0;
  return flips;
}

function score(s: State): [number, number] {
  let a = 0, b = 0;
  for (const c of s.board) if (c) { if (c.owner === 0) a++; else b++; }
  return [a, b];
}

function clone(s: State): State { return { ...s, board: s.board.map((c) => (c ? { ...c } : null)), hands: [s.hands[0].slice(), s.hands[1].slice()], pending: s.pending.map((p) => ({ ...p, at: p.at.slice() })) }; }

function moves(s: State): [number, number][] {
  const out: [number, number][] = [];
  const seen = new Set<string>();
  s.hands[s.turn].forEach((k, hi) => {
    if (seen.has(k)) return;
    seen.add(k);
    for (let c = 0; c < N * N; c++) if (!s.board[c] && !(s.rule === 'dark' && c === 12)) out.push([c, hi]);
  });
  return out;
}

function evalFor(s: State, who: 0 | 1): number { const [a, b] = score(s); return who === 0 ? a - b : b - a; }

function search(s: State, depth: number, who: 0 | 1): number {
  if (depth === 0 || !s.hands[s.turn].length) return evalFor(s, who);
  let best = s.turn === who ? -99 : 99;
  for (const [c, hi] of moves(s)) {
    const n = clone(s);
    place(n, c, hi);
    const v = search(n, depth - 1, who);
    if (s.turn === who ? v > best : v < best) best = v;
  }
  return best;
}

function aiMove(s: State, depth: number, rng: () => number): [number, number] {
  let best: [number, number] = moves(s)[0];
  let bestV = -999;
  for (const m of moves(s)) {
    const n = clone(s);
    place(n, m[0], m[1]);
    const v = search(n, depth, s.turn) + rng() * 0.3;
    if (v > bestV) { bestV = v; best = m; }
  }
  return best;
}

function playerHand(): string[] {
  const owned = G.sticks.owned.slice().sort((a, b) => (KINDS[b].h + KINDS[b].f) - (KINDS[a].h + KINDS[a].f));
  return owned.slice(0, 5);
}

// ---- Drawing ----

const CELL = 16;
const BX = (W - N * CELL) / 2, BY = 44;
const stickImgs = new Map<string, Img>();
function stickImg(kind: string, owner: number): Img {
  const key = kind + owner;
  const hit = stickImgs.get(key);
  if (hit) return hit;
  const k = KINDS[kind];
  const tall = 4 + k.h * 3;
  const rows: string[] = [];
  const baseW = 1 + k.f * 2;
  for (let y = 0; y < tall; y++) {
    const isBase = y >= tall - 2;
    const w = isBase ? baseW : k.h === 0 ? 3 : 1;
    const pad = Math.floor((7 - w) / 2);
    let r = '';
    for (let x = 0; x < 7; x++) r += x >= pad && x < pad + w ? (y === 0 || isBase && y === tall - 1 ? '1' : kind === 'candle' && y < 2 ? '3' : '2') : '.';
    rows.push(r);
  }
  const pal = owner === 0 ? [C.black, C.gold2, C.gold3] : [C.black, C.teal1, C.teal3];
  const im = img(rows, pal);
  stickImgs.set(key, im);
  return im;
}

function lampPx(s: State): [number, number] {
  if (s.rule === 'dark') return [BX + 2 * CELL + 8, BY + 2 * CELL + 6];
  const d = LAMP_DIR[s.lamp];
  const cx = BX + N * CELL / 2, cy = BY + N * CELL / 2;
  return [Math.round(cx - d[0] * (N * CELL / 2 + 10)), Math.round(cy - d[1] * (N * CELL / 2 + 10))];
}

export function initSticks() { registerSticks((opp) => playSticks(OPPONENTS[opp] ?? OPPONENTS.pip, false)); }
export function versusSticks(): Promise<void> { return playSticks({ ...OPPONENTS.pip, name: 'Player two', rule: 'basic', deck: ['s3', 's4', 's2', 's5', 's1'] }, true); }

function playSticks(opp: Opponent, versus: boolean): Promise<void> {
  return new Promise((resolve) => {
    const rng = makeRng(Math.floor(Math.random() * 1e9));
    const hand0 = versus ? ['s3', 's4', 's2', 's5', 's1'] : playerHand();
    const s: State = { board: Array(N * N).fill(null), lamp: Math.floor(rng() * 8), hands: [hand0, opp.deck.slice()], turn: 0, rule: opp.rule, pending: [], placed: 0 };
    let phase: 'intro' | 'pick' | 'aim' | 'wait' | 'end' = 'intro';
    let pick = 0, cur = 12, t = 0, waitT = 0, flash: number[] = [], prizeMsg = '';
    const prevMode = GAME.mode;
    GAME.mode = 'sticks';
    playMusic('sticks');
    const finish = () => { GAME.overlay = null; GAME.mode = prevMode === 'sticks' ? 'field' : prevMode; resolve(); };
    const endGame = () => {
      phase = 'end';
      const [a, b] = score(s);
      if (!versus && a > b) {
        sfx('sticks_win');
        if (!G.sticks.beaten.includes(opp.id)) { G.sticks.beaten.push(opp.id); G.sticks.owned.push(opp.prize); G.mites += 10; prizeMsg = `Won a ${KINDS[opp.prize].name} stick and 10 mites.`; }
        else { G.mites += 3; prizeMsg = 'Won 3 mites.'; }
        G.flags[`sticks_${opp.id}_won`] = true;
      } else if (!versus) sfx(a === b ? 'menu_ok' : 'sticks_lose');
    };
    const sc: Screen = {
      update(dt) {
        t += dt;
        if (phase === 'intro') { if (pressed('a')) { phase = 'pick'; sfx('menu_ok'); } else if (pressed('b')) finish(); return; }
        if (phase === 'end') { if (pressed('a') || pressed('b')) finish(); return; }
        if (phase === 'wait') {
          waitT -= dt;
          if (waitT <= 0) {
            const [c, hi] = aiMove(s, opp.depth, rng);
            flash = place(s, c, hi);
            sfx('sticks_place');
            if (flash.length) sfx('sticks_flip');
            if (!s.hands[0].length && !s.hands[1].length) endGame(); else phase = 'pick';
          }
          return;
        }
        const hand = s.hands[s.turn];
        if (phase === 'pick') {
          if (repeat('left')) { pick = (pick + hand.length - 1) % hand.length; sfx('menu_move'); }
          if (repeat('right')) { pick = (pick + 1) % hand.length; sfx('menu_move'); }
          if (pressed('a')) { phase = 'aim'; sfx('menu_ok'); }
          if (pressed('b')) { finish(); }
          return;
        }
        if (phase === 'aim') {
          const x = cur % N, y = Math.floor(cur / N);
          if (repeat('left') && x > 0) cur--;
          if (repeat('right') && x < N - 1) cur++;
          if (repeat('up') && y > 0) cur -= N;
          if (repeat('down') && y < N - 1) cur += N;
          if (pressed('b')) { phase = 'pick'; sfx('menu_back'); return; }
          if (pressed('a')) {
            if (s.board[cur] || (s.rule === 'dark' && cur === 12)) { sfx('menu_bad'); return; }
            flash = place(s, cur, pick);
            pick = 0;
            sfx('sticks_place');
            if (flash.length) sfx('sticks_flip');
            if (!s.hands[0].length && !s.hands[1].length) { endGame(); return; }
            if (versus) phase = 'pick';
            else { phase = 'wait'; waitT = 0.7; }
          }
        }
      },
      render() {
        clearLayers();
        rect(0, 0, W, H, C.black);
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) rect(BX + x * CELL, BY + y * CELL, CELL, CELL, (x + y) % 2 ? C.umber1 : C.umber2);
        const [lx, ly] = lampPx(s);
        // Sticks and their leads, lit by the lamp so each lead lies over the tiles it takes.
        const dirsAt = (c: number) => dirsFor(s, c);
        for (let c = 0; c < N * N; c++) {
          const cell = s.board[c];
          if (!cell) continue;
          const im = stickImg(cell.kind, cell.owner);
          const x = BX + (c % N) * CELL + 4, y = BY + Math.floor(c / N) * CELL + CELL - im.h - 1;
          blit(im, x, y, { kind: 2 });
          for (const d of dirsAt(c)) stampLead(im, x, y, d[0], d[1], KINDS[cell.kind].h * CELL * 0.95, false, 255, 0.2);
        }
        beginLight([0.18, 0.14, 0.18], null, SHADES.plum);
        if (s.rule !== 'noon') addLight(lx, ly, 120, 1.7, 0xffd08a, { z: 10 });
        else addLight(W / 2, BY + 40, 140, 1.4, 0xffffff, { z: 60 });
        composite();
        rect(lx - 1, ly - 1, 3, 3, C.gold3);
        if (s.rule === 'twolamp') { const d = LAMP_DIR[(s.lamp + 4) % 8]; const cx = BX + N * CELL / 2, cy = BY + N * CELL / 2; rect(Math.round(cx - d[0] * (N * CELL / 2 + 10)) - 1, Math.round(cy - d[1] * (N * CELL / 2 + 10)) - 1, 3, 3, C.gold3); }
        // Preview where the chosen stick's lead would fall.
        if (phase === 'aim') {
          const kind = s.hands[s.turn][pick];
          const flips = new Set(flipsFor(s, cur, kind, s.turn));
          for (const c of leadCells(s, cur, kind)) {
            const x = BX + (c % N) * CELL, y = BY + Math.floor(c / N) * CELL;
            const col = flips.has(c) ? C.gold3 : C.pale;
            rect(x + 2, y + 2, 2, 1, col); rect(x + 12, y + 2, 2, 1, col); rect(x + 2, y + 13, 2, 1, col); rect(x + 12, y + 13, 2, 1, col);
          }
          const x = BX + (cur % N) * CELL, y = BY + Math.floor(cur / N) * CELL;
          rect(x, y, CELL, 1, C.white); rect(x, y + CELL - 1, CELL, 1, C.white); rect(x, y, 1, CELL, C.white); rect(x + CELL - 1, y, 1, CELL, C.white);
        }
        for (const c of flash) { if (t % 0.4 < 0.2) { const x = BX + (c % N) * CELL, y = BY + Math.floor(c / N) * CELL; rect(x + 7, y + 1, 2, 2, C.white); } }
        // Hands.
        const drawHand = (who: 0 | 1, y: number) => {
          s.hands[who].forEach((k, i) => {
            const x = 30 + i * 28;
            const im = stickImg(k, who);
            if (who === s.turn && (phase === 'pick' || phase === 'aim') && i === pick) rect(x - 3, y - 2, 20, 22, C.plum1);
            blitUI(im, x + 3, y + 16 - im.h);
            drawText(`${KINDS[k].h}${KINDS[k].f}`, x + 2, y + 16, who === 0 ? C.gold3 : C.teal3);
          });
        };
        drawHand(1, 6);
        drawHand(0, 136);
        const [a, b] = score(s);
        drawText(String(a), 6, 140, C.gold3);
        drawText(String(b), 6, 10, C.teal3);
        drawText(opp.name, W - 6 - textWidth(opp.name), 10, C.pale);
        if (phase === 'intro' || phase === 'end') {
          const lines = phase === 'intro' ? [opp.name, ...wrap(RULE_TEXT[s.rule], 150), 'Z: play  X: leave'] : [a > b ? (versus ? 'Gold wins.' : 'You win.') : a < b ? (versus ? 'Teal wins.' : 'You lose.') : 'A draw.', ...(prizeMsg ? wrap(prizeMsg, 150) : [])];
          const h = lines.length * (LINE_H + 1) + 8;
          box(16, 70, W - 32, h, C.ink, C.gold2);
          lines.forEach((l, i) => drawText(l, centerX(l, W / 2), 74 + i * (LINE_H + 1), i === 0 ? C.white : C.pale));
        } else {
          const hint = phase === 'pick' ? 'Left, right: stick  Z: choose' : phase === 'aim' ? 'Arrows: tile  Z: place' : '';
          drawText(hint, centerX(hint, W / 2), H - 12, C.slate);
          if (phase === 'pick' && versus) drawText(s.turn === 0 ? 'Gold to play' : 'Teal to play', 6, 124, C.pale);
        }
        void icon;
      },
    };
    GAME.overlay = sc;
  });
}
