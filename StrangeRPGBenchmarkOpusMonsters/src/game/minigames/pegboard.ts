// Shellboard: a card duel on a three by three board, played with the kinds you have sounded.
// Each card has four edge numbers. Placing a card next to a rival's card takes it when the touching edge is higher.
// A card whose type beats the other card's type adds 1 to its edge in that comparison.
import { sfx } from '../../engine/audio';
import { text, textCenter, textRight } from '../../engine/font';
import { input } from '../../engine/input';
import { music } from '../../engine/music';
import { rect, INK } from '../../engine/screen';
import { drawSprite } from '../../engine/sprites';
import { SPECIES, WILD_KINDS } from '../../data/species';
import { TYPE_COLOR, typeMult, type Type } from '../../data/types';
import { close, run, type Mode } from '../modes';
import { G, save } from '../state';
import { box, DIM, GOOD, MINE, PAPER, SEL, THEIRS, WARN } from '../ui';

export interface Card { kind: string; e: [number, number, number, number]; type: Type }
type Slot = { card: Card; owner: 0 | 1 } | null;

function hash(s: string): number { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

/** A kind's card: edges in the order up, right, down, left. Rarer kinds have higher totals. */
export function cardOf(kind: string): Card {
  const sp = SPECIES[kind];
  const total = sp.legendary ? 28 : 14 + 2 * Math.min(7, sp.pegs || 1);
  const e: [number, number, number, number] = [1, 1, 1, 1];
  let h = hash(kind), left = total - 4;
  while (left > 0) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const i = h % 4;
    if (e[i] < 9) { e[i]++; left--; }
  }
  return { kind, e, type: sp.types[0] as Type };
}

const OPP: Record<number, number> = { 0: 2, 1: 3, 2: 0, 3: 1 };
const NEIGH: [number, number, number][] = [[0, -1, 0], [1, 0, 1], [0, 1, 2], [-1, 0, 3]];

/** Rows of the board that are wet this match, under the Strand rule. Row 2 is nearest the sea. */
let WET: number[] = [];
const wet = (row: number) => (WET.includes(row) ? 1 : 0);

function edge(c: Card, side: number, vs: Card, row: number): number {
  return c.e[side] - wet(row) + (typeMult(c.type, [vs.type]) > 1 ? 1 : 0);
}

/** Places a card and returns how many it took. */
function place(board: Slot[], i: number, card: Card, owner: 0 | 1, apply: boolean): number {
  const x = i % 3, y = Math.floor(i / 3);
  let taken = 0;
  const flips: number[] = [];
  for (const [dx, dy, side] of NEIGH) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx > 2 || ny > 2) continue;
    const n = board[ny * 3 + nx];
    if (!n || n.owner === owner) continue;
    if (edge(card, side, n.card, y) > n.card.e[OPP[side]] - wet(ny)) { taken++; flips.push(ny * 3 + nx); }
  }
  if (apply) {
    board[i] = { card, owner };
    for (const f of flips) board[f] = { card: board[f]!.card, owner };
  }
  return taken;
}

/** The rival's move: take the most, and with `look` also fear the best reply. */
function aiMove(board: Slot[], hand: Card[], other: Card[], look: boolean): [number, number] {
  let best: [number, number] = [0, board.findIndex(s => !s)], bv = -Infinity;
  hand.forEach((c, h) => board.forEach((s, i) => {
    if (s) return;
    const b2 = board.slice();
    let v = place(b2, i, c, 1, true) * 10;
    // Prefer edges that face open cells being high.
    const x = i % 3, y = Math.floor(i / 3);
    for (const [dx, dy, side] of NEIGH) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx <= 2 && ny <= 2 && !b2[ny * 3 + nx]) v += c.e[side] * 0.3; }
    if (look) {
      let worst = 0;
      for (const oc of other) for (let j = 0; j < 9; j++) if (!b2[j]) worst = Math.max(worst, place(b2.slice(), j, oc, 0, true));
      v -= worst * 8;
    }
    if (v > bv) { bv = v; best = [h, i]; }
  }));
  return best;
}

export interface Rival {
  id: string; name: string; deck: string[]; look: boolean; tier: number;
  /** Plays by the Strand rule: the row nearest the sea is wet, and at high tide the middle row too. */
  strand?: boolean;
}

/** The kinds Ouro has sounded, best cards first. */
export function ownedCards(): Card[] {
  const kinds = WILD_KINDS.filter(k => G.register[k] === 2);
  return kinds.map(cardOf).sort((a, z) => z.e.reduce((p, q) => p + q, 0) - a.e.reduce((p, q) => p + q, 0));
}

const HOUSE = ['cairn', 'hare', 'puffball', 'burr', 'paring'];

/** Plays one match. Resolves to 1 for a win, 0 for a draw, -1 for a loss, or null when Ouro backs out. */
export function pegboard(rival: Rival, hand0: Card[]): Promise<1 | 0 | -1 | null> {
  const mine = hand0.slice(0, 5);
  for (const k of HOUSE) if (mine.length < 5 && !mine.some(c => c.kind === k)) mine.push(cardOf(k));
  const theirs = rival.deck.filter(k => SPECIES[k]).map(cardOf).slice(0, 5);
  const board: Slot[] = Array(9).fill(null);
  WET = rival.strand ? (G.flags.tide ? [1, 2] : [2]) : [];
  let turn: 0 | 1 = (G.flags.pegMatches || 0) % 2 === 0 ? 0 : 1;
  let pick = 0, cell = 4, phase: 'hand' | 'cell' | 'wait' | 'end' = turn === 0 ? 'hand' : 'wait';
  let wait = 40, note = turn === 0 ? 'You go first.' : `${rival.name} goes first.`;
  let result: 1 | 0 | -1 = 0;
  music.play('minigame');

  const score = (o: 0 | 1) => board.filter(s => s?.owner === o).length + (o === 0 ? mine.length : theirs.length);
  const over = () => board.every(s => s);
  const endIfOver = () => {
    if (!over()) return false;
    const a = score(0), b = score(1);
    result = a > b ? 1 : a < b ? -1 : 0;
    note = result === 1 ? `You win, ${a} to ${b}.` : result === -1 ? `${rival.name} wins, ${b} to ${a}.` : `A draw, ${a} each.`;
    sfx(result === 1 ? 'level' : result === -1 ? 'ko' : 'switch');
    phase = 'end';
    G.flags.pegMatches = (G.flags.pegMatches || 0) + 1;
    save();
    return true;
  };

  const m: Mode = {
    opaque: true,
    update() {
      if (phase === 'end') { if (input.hit('ok') || input.hit('back')) close(m, result); return; }
      if (phase === 'wait') {
        if (--wait > 0) return;
        const [h, i] = aiMove(board, theirs, mine, rival.look);
        const taken = place(board, i, theirs[h], 1, true);
        theirs.splice(h, 1);
        sfx(taken ? 'hit' : 'blip');
        note = taken ? `${rival.name} takes ${taken}.` : `${rival.name} plays.`;
        if (!endIfOver()) phase = 'hand';
        pick = Math.min(pick, mine.length - 1);
        return;
      }
      if (phase === 'hand') {
        if (input.hit('left')) { pick = (pick + mine.length - 1) % mine.length; sfx('move'); }
        if (input.hit('right')) { pick = (pick + 1) % mine.length; sfx('move'); }
        if (input.hit('ok')) { phase = 'cell'; cell = board.findIndex(s => !s); sfx('ok'); }
        if (input.hit('back') && board.every(s => !s)) { sfx('back'); close(m, null); }
        return;
      }
      if (phase === 'cell') {
        const x = cell % 3, y = Math.floor(cell / 3);
        if (input.hit('left') && x > 0) { cell--; sfx('move'); }
        if (input.hit('right') && x < 2) { cell++; sfx('move'); }
        if (input.hit('up') && y > 0) { cell -= 3; sfx('move'); }
        if (input.hit('down') && y < 2) { cell += 3; sfx('move'); }
        if (input.hit('back')) { phase = 'hand'; sfx('back'); }
        if (input.hit('ok') && !board[cell]) {
          const taken = place(board, cell, mine[pick], 0, true);
          mine.splice(pick, 1);
          sfx(taken ? 'hit' : 'blip');
          note = taken ? `You take ${taken}.` : '';
          if (!endIfOver()) { phase = 'wait'; wait = 30; }
        }
      }
    },
    draw() {
      rect(0, 0, 192, 192, '#17151d');
      text(`Shellboard with ${rival.name}`, 4, 3, SEL);
      textRight(`${score(0)} - ${score(1)}`, 188, 3, PAPER);
      for (let i = 0; i < theirs.length; i++) rect(164, 16 + i * 12, 18, 10, THEIRS);
      const ox = 36, oy = 14, s = 40;
      board.forEach((sl, i) => {
        const x = ox + (i % 3) * s, y = oy + Math.floor(i / 3) * s;
        rect(x, y, s - 2, s - 2, wet(Math.floor(i / 3)) ? '#1e3448' : '#2a2632');
        if (sl) drawCard(sl.card, x, y, sl.owner === 0 ? MINE : THEIRS);
        if (phase === 'cell' && i === cell) { rect(x - 1, y - 1, s, 1, SEL); rect(x - 1, y + s - 2, s, 1, SEL); rect(x - 1, y - 1, 1, s, SEL); rect(x + s - 2, y - 1, 1, s, SEL); }
      });
      mine.forEach((c, i) => {
        const x = 3 + i * 37, y = 150 + (phase === 'hand' && i === pick ? -4 : 0);
        drawCard(c, x, y, MINE);
        if (phase !== 'wait' && phase !== 'end' && i === pick) text('\u0001', x + 15, y - 9, SEL);
      });
      if (note) { rect(0, 134, 192, 11, INK); textCenter(note, 96, 136, phase === 'end' ? (result === 1 ? GOOD : result === -1 ? THEIRS : WARN) : PAPER); }
      if (phase === 'end') { box(30, 60, 132, 30, SEL); textCenter(note, 96, 66, PAPER); textCenter('Z to finish', 96, 77, DIM); }
    },
  };
  return run(m);
}

function drawCard(c: Card, x: number, y: number, owner: string): void {
  rect(x, y, 38, 38, owner);
  rect(x + 1, y + 1, 36, 36, '#e8e2d0');
  rect(x + 1, y + 1, 36, 2, TYPE_COLOR[c.type]);
  const sp = SPECIES[c.kind];
  drawSprite({ px: sp.sprite, c: sp.c }, x + 11, y + 11, 2);
  textCenter(String(c.e[0]), x + 19, y + 3, INK);
  textRight(String(c.e[1]), x + 36, y + 15, INK);
  textCenter(String(c.e[2]), x + 19, y + 29, INK);
  text(String(c.e[3]), x + 2, y + 15, INK);
}
