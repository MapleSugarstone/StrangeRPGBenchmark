// Carcanet: a collar of set stones that walked off a neck. It sets one Stone a turn from a Tape the player writes on the
// Setting board, and its newest Stone decides what its moves do. The kit draws on a fixed queue of weapons, a fighter
// who readies its own moves again, and blows that land in pulses.
import { applyStatus, emit, giveShield, heal, label, msg } from '../battle/engine';
import type { Battle, Fighter } from '../battle/model';
import { defMark, defMove, defPassive } from '../battle/registry';

/** Stone codes: 1 pearl, 2 amber, 3 beach glass, 4 star glass. */
const LETTER: Record<string, number> = { p: 1, a: 2, g: 3, s: 4 };
const WORD = ['', 'a pearl', 'an amber', 'a beach glass', 'a star glass'];
/** Each Stone's name, color, and what it does while it is the newest, for the telegraph over Carcanet's head. */
const STONE_NAME = ['', 'pearl', 'amber', 'beach glass', 'star glass'];
const STONE_COLOR = ['', '#f4ecd8', '#f0a030', '#70d0b8', '#c4a4f4'];
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
  if (!f.ko && f.hp < f.maxHp) heal(b, f, f, f.maxHp * N.setHeal / 100);
  // The Stone's own picture plays as it is set.
  emit(b, { e: 'use', side: f.side, idx: f.idx, move: 'carc_set', name: `Sets ${STONE_NAME[s]}`, opt: s - 1 });
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
const N = { shield: 18, amber: 1.4, glass: 45, facet: 200, facetPer: 23, cleave: 75, crest: 100, start: 3, setHeal: 4, rewind: 2 };

defPassive({ id: 'carc_tape', name: 'Tape', owner: 'carcanet',
  text: `Turn start: sets the next Stone (a mark) from its Tape, a loop of 4 from the Setting board. It holds 4, and a 5th pushes off the oldest. First time out: sets ${N.start}. Each Stone it sets heals it ${N.setHeal}% of its max HP.`,
  comeOut(b, f) { if (f.k.taped) return; f.k.taped = 1; for (let i = 0; i < N.start; i++) setNext(b, f); },
  turnStart(b, f) { setNext(b, f); },
  foretell(b, f) {
    const tape = (f.mon.tape || CARCANET_TAPE).toLowerCase(), at = f.k.tp || 0;
    const does = ['', `its moves give it a shield of ${N.shield}% of its max HP.`, `its moves deal ${N.amber}x damage.`, `its next turn comes ${N.glass}% sooner after each move.`, 'its hits add Expose 2.'];
    return [0, 1, 2, 3].map(i => { const s = LETTER[tape[(at + i) % tape.length]] || 2; return { name: STONE_NAME[s], color: STONE_COLOR[s], text: does[s] }; });
  } });
defPassive({ id: 'carc_clasp', name: 'Clasp', owner: 'carcanet',
  text: `Its newest Stone changes its moves. Pearl: shield ${N.shield}% max HP, 2 turns. Amber: ${N.amber}x damage. Beach glass: its next turn comes ${N.glass}% sooner. Star glass: Expose 2.`,
  outMul(b, f, tgt, d) { return d.move && lead(f) === 2 ? N.amber : 1; },
  afterMove(b, f, m, c) {
    const s = lead(f);
    if (s === 1) giveShield(b, f, f, f.maxHp * N.shield / 100, 2);
    if (s === 3) f.k.hastenAfter = (f.k.hastenAfter || 0) + N.glass;
    if (s === 4 && (m.reach === 'single' || m.reach === 'spread') && !c.tgt.ko && c.tgt.side !== f.side) applyStatus(b, f, c.tgt, 'expose', 2);
  } });

defMove({ id: 'carc_facet', name: 'Facet', type: 'STONE', owner: 'carcanet', reach: 'single', tags: ['spell'], cd: 1, fx: 'flare | shard*3 line fast | sparkle',
  fxOpts: ['flare | pearl*3 line fast | sparkle ring', 'flare | ember*3 line fast | burst cinders', 'flare | shard*3 line fast | splash', 'flare | star*3 line fast | sigil sparkle'],
  fxPick(b, f) { return lead(f) - 1; },
  text: `Hits for ${N.facet}% MGK + ${N.facetPer}% MGK per Stone it holds.`,
  run(c) { c.hit(c.tgt, { mgk: (N.facet + N.facetPer * collar(c.u).length) / 100 }); } });
defMove({ id: 'carc_rewind', name: 'Rewind', type: 'STAR', owner: 'carcanet', reach: 'self', cd: 3, fx: 'spin | rune*4 orbit | sigil self',
  text: `Sets the next ${N.rewind} Stones from its Tape. Facet and Cleave are ready again.`,
  run(c) {
    if (!c.preview) for (let i = 0; i < N.rewind; i++) setNext(c.b, c.u);
    c.u.moves.forEach((id, i) => { if (id === 'carc_facet' || id === 'carc_cleave') c.u.cd[i] = 0; });
  } });
defMove({ id: 'carc_cleave', name: 'Cleave', type: 'GEAR', owner: 'carcanet', reach: 'single', cd: 2, fx: 'lunge | slash shatter',
  fxOpts: ['lunge | slash ring', 'lunge | slash burst', 'lunge fast | slash splash', 'lunge | slash sigil'],
  fxPick(b, f) { return lead(f) - 1; },
  text: `Hits for ${N.cleave}% MGK once per Stone it holds. Its oldest Stone comes off.`,
  run(c) {
    const st = collar(c.u);
    for (let i = 0; i < st.length && !c.tgt.ko; i++) c.hit(c.tgt, { mgk: N.cleave / 100 });
    if (st.length && !c.preview) write(c.b, c.u, st.slice(1));
  } });
defMove({ id: 'carc_crest', name: 'Full Setting', type: 'STAR', owner: 'carcanet', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, fx: 'swell big | shard*8 converge | shatter sparkle big',
  fxOpts: [
    'swell big | pearl*8 converge | sparkle ring big', 'swell big | ember*8 converge | burst cinders big',
    'swell big | shard*8 converge | shatter splash big', 'swell big | star*8 converge | sigil sparkle big',
    'swell big | pearl*8 converge | sparkle ring all big', 'swell big | ember*8 converge | burst cinders all big',
    'swell big | shard*8 converge | shatter splash all big', 'swell big | star*8 converge | sigil sparkle all big',
  ],
  fxPick(b, f) { const st = collar(f); return st.length ? (st.length === 4 && new Set(st).size === 4 ? 4 : 0) + st[st.length - 1] - 1 : -1; },
  text: `Hits for ${N.crest}% MGK per Stone. Splash 35% with 4 kinds. Spends its Stones.`,
  run(c) {
    const st = collar(c.u);
    if (!st.length) { c.msg('Its collar is bare.'); return; }
    const r = { mgk: N.crest / 100 * st.length };
    if (st.length === 4 && new Set(st).size === 4) c.spread(r); else c.hit(c.tgt, r);
    if (!c.preview) write(c.b, c.u, []);
  } });
defMove({ id: 'carc_set', name: 'Set Stone', type: 'STONE', owner: 'carcanet', reach: 'self', cd: 1, extra: true, fx: 'lift | shard rise | sparkle self',
  fxOpts: ['lift | pearl rise | sparkle ring self', 'lift | ember rise | cinders self', 'lift | shard rise | fizz self', 'lift | star rise | sparkle self'],
  text: 'The picture of a Stone being set from the Tape.',
  run() { /* the Tape passive sets the Stones, and this move only gives each its picture */ } });

export const CARCANET_LOADED = true;
