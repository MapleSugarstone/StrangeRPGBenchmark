// Carcanet: a collar of set stones that walked off a neck. It sets one Stone a turn from a Tape the player writes on the
// Setting board, and its newest Stone decides what its moves do. The kit draws on a fixed queue of weapons, a fighter
// who readies its own moves again, and blows that land in pulses.
import { applyStatus, giveShield, label, msg } from '../battle/engine';
import type { Battle, Fighter } from '../battle/model';
import { defMark, defMove, defPassive } from '../battle/registry';

/** Stone codes: 1 pearl, 2 amber, 3 beach glass, 4 star glass. */
const LETTER: Record<string, number> = { p: 1, a: 2, g: 3, s: 4 };
const WORD = ['', 'a pearl', 'an amber', 'a beach glass', 'a star glass'];
const MARK_ID = ['', 'carc_pearl', 'carc_amber', 'carc_glass', 'carc_star'];
export const CARCANET_TAPE = 'apgs';

/** The Stones it holds, oldest first. */
export function collar(f: Fighter): number[] {
  const n = f.k.cn || 0, out: number[] = [];
  for (let i = 0; i < n; i++) out.push(f.k['c' + i] || 0);
  return out;
}

/** Its newest Stone, or 0 when it holds none. */
const lead = (f: Fighter): number => { const c = collar(f); return c.length ? c[c.length - 1] : 0; };

/** Rewrites the readout marks from the Stones held: one mark a kind with its count, the newest kind drawn leftmost. */
function sync(b: Battle, f: Fighter): void {
  const c = collar(f), by = f.side * 8 + f.idx;
  for (let k = 1; k <= 4; k++) delete f.m[MARK_ID[k]];
  delete f.m.carc_collar;
  if (!c.length) return;
  // The hidden collar mark carries the AI's price for the crest; its value encodes the Stones in order for the AI's cache.
  f.m.carc_collar = { n: c.length, v: c.reduce((a, s) => a * 5 + s, 0), t: -1, by, at: b.turnNo };
  const top = c[c.length - 1];
  for (const k of [1, 2, 3, 4].filter(k => k !== top).concat(top)) {
    const n = c.filter(s => s === k).length;
    if (n) f.m[MARK_ID[k]] = { n, v: 0, t: -1, by, at: b.turnNo };
  }
}

function write(b: Battle, f: Fighter, c: number[]): void {
  f.k.cn = c.length;
  c.forEach((s, i) => { f.k['c' + i] = s; });
  sync(b, f);
}

/** Sets the next Stone from its Tape. A fifth pushes off the oldest. */
export function setNext(b: Battle, f: Fighter): void {
  const tape = (f.mon.tape || CARCANET_TAPE).toLowerCase();
  const at = f.k.tp || 0;
  const s = LETTER[tape[at % tape.length]] || 2;
  f.k.tp = (at + 1) % tape.length;
  const c = collar(f);
  c.push(s);
  if (c.length > 4) c.shift();
  write(b, f, c);
  msg(b, `${label(b, f)} sets ${WORD[s]}.`);
}

const STONE_MARK = (k: number, name: string, color: string) =>
  defMark({ id: MARK_ID[k], name, color, clock: 'own', value: 0.03 });
STONE_MARK(1, 'pearl', '#f4ecd8');
STONE_MARK(2, 'amber', '#f0a030');
STONE_MARK(3, 'beach glass', '#70d0b8');
STONE_MARK(4, 'star glass', '#c4a4f4');
defMark({ id: 'carc_collar', name: '', clock: 'own', spend: 'carc_crest' });

/** The kit's numbers, in percent, kept together so the texts and the rules cannot drift apart. */
const N = { shield: 10, amber: 1.25, glass: 25, facet: 100, facetPer: 10, cleave: 35, crest: 45, start: 2 };

defPassive({ id: 'carc_tape', name: 'Tape', owner: 'carcanet',
  text: `Turn start: sets the next Stone from its Tape, a loop of 4 chosen on the Setting board. Stone: a mark. It holds 4, and a 5th pushes off the oldest. When it first comes out: sets ${N.start}.`,
  comeOut(b, f) { if (f.k.taped) return; f.k.taped = 1; for (let i = 0; i < N.start; i++) setNext(b, f); },
  turnStart(b, f) { setNext(b, f); } });
defPassive({ id: 'carc_clasp', name: 'Clasp', owner: 'carcanet',
  text: `Its newest Stone changes its moves. Pearl: a shield of ${N.shield}% of its max HP for 2 turns. Amber: ${N.amber}x damage. Beach glass: its next turn comes ${N.glass}% sooner. Star glass: Expose 1.`,
  outMul(b, f, tgt, d) { return d.move && lead(f) === 2 ? N.amber : 1; },
  afterMove(b, f, m, c) {
    const s = lead(f);
    if (s === 1) giveShield(b, f, f, f.maxHp * N.shield / 100, 2);
    if (s === 3) f.k.hastenAfter = (f.k.hastenAfter || 0) + N.glass;
    if (s === 4 && (m.reach === 'single' || m.reach === 'spread') && !c.tgt.ko && c.tgt.side !== f.side) applyStatus(b, f, c.tgt, 'expose', 1);
  } });

defMove({ id: 'carc_facet', name: 'Facet', type: 'STONE', owner: 'carcanet', reach: 'single', tags: ['spell'], cd: 1,
  text: `Hits for ${N.facet}% MGK + ${N.facetPer}% MGK per Stone it holds.`,
  run(c) { c.hit(c.tgt, { mgk: (N.facet + N.facetPer * collar(c.u).length) / 100 }); } });
defMove({ id: 'carc_rewind', name: 'Rewind', type: 'STAR', owner: 'carcanet', reach: 'self', cd: 4,
  text: 'Sets the next Stone from its Tape. Facet and Cleave are ready again.',
  run(c) {
    if (!c.preview) setNext(c.b, c.u);
    c.u.moves.forEach((id, i) => { if (id === 'carc_facet' || id === 'carc_cleave') c.u.cd[i] = 0; });
  } });
defMove({ id: 'carc_cleave', name: 'Cleave', type: 'STONE', owner: 'carcanet', reach: 'single', cd: 2,
  text: `Hits for ${N.cleave}% MGK once per Stone it holds. Its oldest Stone comes off.`,
  run(c) {
    const st = collar(c.u);
    for (let i = 0; i < st.length && !c.tgt.ko; i++) c.hit(c.tgt, { mgk: N.cleave / 100 });
    if (st.length && !c.preview) write(c.b, c.u, st.slice(1));
  } });
defMove({ id: 'carc_crest', name: 'Full Setting', type: 'STAR', owner: 'carcanet', reach: 'single', tags: ['spell'], cd: 6, nerve: 5,
  text: `Hits for ${N.crest}% MGK per Stone, every foe if 4 kinds. Spends its Stones.`,
  run(c) {
    const st = collar(c.u);
    if (!st.length) { c.msg('Its collar is empty.'); return; }
    const r = { mgk: N.crest / 100 * st.length };
    if (st.length === 4 && new Set(st).size === 4) c.spread(r); else c.hit(c.tgt, r);
    if (!c.preview) write(c.b, c.u, []);
  } });

export const CARCANET_LOADED = true;
