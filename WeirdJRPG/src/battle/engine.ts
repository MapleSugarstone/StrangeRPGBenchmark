// The Concept Combat engine. Pure logic: the view and the simulator both drive it.
import {
  type ActionId, type AttackKind, type Category, type Dish, type EnemyDef, type EnemyMove, type HeldConcept, type Layer, type MoveKind,
  type PartyIn, type SenseId, type ShellDef, type Emotion, type Reaction, DISH_NAME, LAYERS, SENSE_ACTIVE, SENSE_ULT, SENSES, STATE_FMAX, STATE_POW, FAMILY, reaction,
} from './model';
import { ENEMIES, SHELLS } from './enemies';
import { Rng } from './rng';

export const CELLS = 7;

export type Who = 'pilgrim' | 'vorn' | 'lb';

export type Ev =
  | { t: 'say'; text: string; speaker?: string }
  | { t: 'hit'; uid: number; layer: Layer; amount: number; weak?: boolean; crit?: boolean }
  | { t: 'layer_off'; uid: number; layer: Layer; label: string }
  | { t: 'hurt'; who: Who; amount: number; kind: AttackKind }
  | { t: 'miss'; who: Who | number }
  | { t: 'heal'; who: Who; amount: number }
  | { t: 'fx'; fx: string; uid?: number; who?: Who }
  | { t: 'move'; who: Who | number; from: number; to: number; kind?: MoveKind | 'push' }
  | { t: 'gone'; uid: number; how: 'unravel' | 'unmade' | 'calm' | 'vanish' | 'oblivion' }
  | { t: 'phase'; uid: number; speaker: string; text: string }
  | { t: 'break'; text: string }
  | { t: 'gain'; amount: number }
  | { t: 'act'; who: Who | number; name: string };

export interface Intent { move: EnemyMove | null; to: number; target: Who | 'all' | 'foe' | null; skip?: boolean; charge?: boolean }

export interface Foe {
  uid: number;
  def: EnemyDef;
  name: string;
  category: Category;
  cell: number;
  size: number;
  hp: Record<Layer, number>;
  max: Record<Layer, number>;
  start: number;
  phase: number;
  shadow: boolean; confused: boolean; unbalanced: boolean; forgotten: boolean;
  marked: boolean; insight: boolean; blind: number; calm: number; curse: number; charmed: number; pinned: number; stunned: number;
  intent: Intent | null;
  shown: Intent | null;
  gone: boolean;
  voidVariant: boolean;
  /** A heavy move being wound up, with its locks and the ones already broken. */
  windup: { move: EnemyMove; locks: Layer[]; broken: Layer[] } | null;
  braced: boolean; fed: number; stolen: HeldConcept[]; reacted: number; role: 'guard' | 'mender' | null;
}

export interface Pilgrim {
  cell: number; f: number; fmax: number; state: number; pow: number;
  float: boolean; open: boolean; unseen: number; stunned: number; confused: number; silenced: number; paperwork: number;
  hand: HeldConcept[]; cd: Partial<Record<string, number>>; forgotten: Map<ActionId, number>;
  buff: { kind: string; rounds: number; seq?: number } | null;
  worn: ShellDef | null; armorShell: { shell: ShellDef | null; rounds: number } | null;
  usedUlt: boolean; free: boolean; double: boolean; holdingUsed: boolean;
  senses: Partial<Record<SenseId, number>>; slots: Set<string>; weave: boolean;
  fortress: number; feeling: number; cheer: number; toast: number;
}

export interface Ally { hp: number; max: number; down: boolean }
export interface Vorn extends Ally { atk: number; guarding: boolean; enduring: boolean; shadow: boolean; lastStand: boolean; usedStand: boolean; confused: number }
export interface Lb extends Ally { pantry: Record<Dish, number>; hidden: boolean }

export interface Battle {
  rng: Rng;
  foes: Foe[];
  p: Pilgrim;
  vorn: Vorn | null;
  lb: Lb | null;
  round: number;
  trueSight: boolean;
  last: { who: Who | number; action?: ActionId; move?: EnemyMove; target?: number } | null;
  echoAlly: { cell: number; rounds: number } | null;
  effigy: { rounds: number } | null;
  silenceFoes: number;
  outcome: null | 'win' | 'lose' | 'flee' | 'choice';
  collected: HeldConcept[];
  concepts: string[];
  up: number;
  boss: boolean;
  nextUid: number;
  tint: string;
  scripted: Set<string>;
  firsts: Set<string>;
  pFormLast: ActionId | null;
}

export interface BattleOpts { seed: number; tint?: string; scripted?: string[]; scale?: number }

function layersOf(def: EnemyDef): { hp: Record<Layer, number>; max: Record<Layer, number> } {
  const hp = { shell: 0, memory: 0, emotion: 0, name: 0 } as Record<Layer, number>;
  const k = def.boss || def.up ? 1 : 0.7;
  for (const l of LAYERS) hp[l] = Math.round((def.layers[l] || 0) * k);
  return { hp, max: { ...hp } };
}

export function total(f: Foe): number { return f.hp.shell + f.hp.memory + f.hp.emotion + f.hp.name; }
export function maxTotal(f: Foe): number { return f.max.shell + f.max.memory + f.max.emotion + f.max.name; }

function makeFoe(b: Battle, key: string, cell: number): Foe {
  const [id, role] = key.split('@');
  const def = ENEMIES[id];
  if (!def) throw new Error('unknown enemy ' + id);
  const { hp, max } = layersOf(def);
  const f: Foe = {
    uid: b.nextUid++, def, name: def.name, category: def.category, cell, size: def.size || 1, hp, max, start: 0, phase: 1,
    shadow: !def.layers.shell, confused: false, unbalanced: false, forgotten: false,
    marked: false, insight: false, blind: 0, calm: 0, curse: 0, charmed: 0, pinned: 0, stunned: 0,
    intent: null, shown: null, gone: false, voidVariant: false,
    windup: null, braced: false, fed: 0, stolen: [], reacted: 0, role: (role as Foe['role']) || def.role || null,
  };
  f.start = total(f);
  return f;
}

export function newBattle(groups: string[], party: PartyIn, opts: BattleOpts): Battle {
  const st = Math.max(0, Math.min(5, party.state));
  const fmax = STATE_FMAX[st] + Math.floor(party.up / 10);
  const slots = new Set(party.slots);
  const worn = party.worn ? SHELLS[party.worn] || null : null;
  const b: Battle = {
    rng: new Rng(opts.seed), foes: [], round: 1, trueSight: slots.has('Record'), last: null, echoAlly: null, effigy: null, silenceFoes: 0,
    outcome: null, collected: [], concepts: [], up: 0, boss: false, nextUid: 1, tint: opts.tint || 'brass', scripted: new Set(opts.scripted || []),
    firsts: new Set(party.taught || []), pFormLast: null,
    p: {
      cell: 1, f: Math.min(party.f, fmax), fmax, state: st, pow: STATE_POW[st] + Math.floor(party.up / 12),
      float: worn?.bonus === 'float', open: false, unseen: 0, stunned: 0, confused: 0, silenced: 0, paperwork: 0,
      hand: [], cd: {}, forgotten: new Map(), buff: null, worn, armorShell: null,
      usedUlt: false, free: false, double: false, holdingUsed: false, senses: { ...party.senses }, slots, weave: party.weaveKnown,
      fortress: 0, feeling: 0, cheer: 0, toast: 0,
    },
    vorn: party.vorn ? { hp: party.vorn.hp, max: party.vorn.max, down: party.vorn.hp <= 0, atk: party.vorn.atk, guarding: false, enduring: false, shadow: false, lastStand: party.vorn.lastStand, usedStand: false, confused: 0 } : null,
    lb: party.lb ? { hp: party.lb.hp, max: party.lb.max, down: party.lb.hp <= 0, pantry: { ...party.lb.pantry }, hidden: false } : null,
  };
  let left = 3;
  for (const id of groups) {
    const size = ENEMIES[id.split('@')[0]]?.size || 1;
    if (left + size > CELLS) left = CELLS - size;
    b.foes.push(makeFoe(b, id, left));
    left += size;
  }
  if (opts.scale) for (const f of b.foes) if (f.def.boss) { for (const l of LAYERS) { f.max[l] = Math.round(f.max[l] * opts.scale); f.hp[l] = f.max[l]; } f.start = total(f); }
  b.boss = b.foes.some(f => f.def.boss);
  chooseIntents(b);
  return b;
}

// ---------- Geometry ----------

export function foeAt(b: Battle, cell: number): Foe | null {
  for (const f of b.foes) if (!f.gone && cell >= f.cell && cell < f.cell + f.size) return f;
  return null;
}

function free(b: Battle, cell: number, ignore?: Foe): boolean {
  if (cell < 0 || cell >= CELLS) return false;
  const f = foeAt(b, cell);
  if (f && f !== ignore) return false;
  if (b.lb && cell === 0) return false;
  return true;
}

function foeFree(b: Battle, f: Foe, cell: number): boolean {
  for (let c = cell; c < cell + f.size; c++) {
    if (c < 0 || c >= CELLS) return false;
    const o = foeAt(b, c);
    if (o && o !== f) return false;
    if (c === b.p.cell) return false;
    if (b.lb && c === 0) return false;
  }
  return true;
}

/** Cells between the foe's body and a party cell (0 when touching). */
export function gap(f: Foe, cell: number): number {
  if (cell < f.cell) return f.cell - cell - 1;
  if (cell >= f.cell + f.size) return cell - (f.cell + f.size - 1) - 1;
  return -1;
}

export function adjacent(b: Battle, f: Foe): boolean { return !f.gone && gap(f, b.p.cell) === 0; }

export function liveFoes(b: Battle): Foe[] { return b.foes.filter(f => !f.gone); }

// ---------- Numbers ----------

function has(b: Battle, concept: string): boolean { return b.p.slots.has(concept); }

export function overloadLine(b: Battle): number { return b.p.fmax * (has(b, 'Order') ? 0.9 : 0.8); }
export function fadeLine(b: Battle): number { return b.p.fmax * (has(b, 'Purpose') ? 0.1 : 0.2); }
export function overloaded(b: Battle): boolean { return b.p.f > overloadLine(b); }
export function faded(b: Battle): boolean { return b.p.f < fadeLine(b); }

const BASE_COST: Partial<Record<ActionId, number>> = {
  strip: 2, extract_memory: 5, extract_emotion: 5, extract_name: 5, absorb: 6, weave: 12, unmake: 20,
  true_sight: 2, handshake: 3, savor: 2, scent: 2, insight: 2, hold: 0,
  unseeing: 25, embrace: 25, silence: 25, devour: 25, oblivion: 25, awakening: 25,
};
const COOLDOWN: Partial<Record<ActionId, number>> = { extract_memory: 1, extract_emotion: 1, extract_name: 1, absorb: 2, weave: 3, unmake: 3, echo: 2, savor: 1 };

export function cost(b: Battle, id: ActionId): number {
  if (b.p.free) return 0;
  let c = BASE_COST[id] ?? 0;
  if (id === 'echo') {
    const l = b.last;
    c = has(b, 'Song') ? 0 : l?.action ? cost(b, l.action) : 4;
  }
  if (id === 'weave' && has(b, 'Spectrum')) c = Math.round(c * 2 / 3);
  if (c > 0) c += b.p.paperwork;
  return c;
}

function cooldownOf(b: Battle, id: ActionId): number {
  let c = COOLDOWN[id] || 0;
  if (id.startsWith('extract') && has(b, 'Procedure')) c = 0;
  if (id === 'absorb' && has(b, 'Then')) c = Math.max(0, c - 1);
  return c;
}

function variance(b: Battle): number { return 0.9 + b.rng.next() * 0.2; }

function powMul(b: Battle): number {
  let m = 1;
  if (b.p.worn?.bonus === 'pow' || b.p.armorShell?.shell?.bonus === 'pow') m *= 1.1;
  if (b.p.buff?.kind === 'rage') m *= 1.5;
  if (b.p.buff?.kind === 'despair') m *= 2;
  if (b.p.cheer > 0) m *= 1.25;
  if (b.p.toast > 0) m *= 1.25;
  if (faded(b) && !has(b, 'Rage')) m *= 0.5;
  if (has(b, 'Despair') && b.p.f < b.p.fmax / 2) m *= 1.2;
  if (b.p.double) m *= 2;
  return m;
}

function weakLayer(c: Category): Layer | null {
  return c === 'shell' ? 'shell' : c === 'memory' ? 'memory' : c === 'emotion' ? 'emotion' : null;
}

// ---------- Essence reactions ----------

/** Lines that explain a rule the first time it matters, once per save. */
const LESSONS: Record<string, string[]> = {
  windup: ['(It winds up. The colored marks above it are locks.)', '(A hit of the same color breaks one. Break them all and the blow never lands.)'],
  brace: ['(Shell-Bound things brace after a Strip. Let Vorn hit it, or hit something else.)'],
  steal: ['(Memory-Struck things take the memories you carry. They give them back when they fall.)'],
  eat: ['(Emotion-Fed things eat the feelings you carry. Carry the opposite kind and it chokes.)'],
  families: ['(Joy, pride, and longing are bright. Sorrow, despair, misery, and dread are dark.)', '(Bright feeds bright. Dark feeds dark. Bright against dark overwhelms.)', '(Rage, fear, and confusion are wild. Wild unbalances whatever it touches.)'],
  concept: ['(Abstract things hit harder the more of you there is.)'],
  void: ['(The Void eats a weak shell before it eats you.)'],
  guard: ['(It stands in front of the others. Weave past it, or bring it down first.)'],
  mender: ['(It mends the others. Reach it first.)'],
  overtime: ['(The longer a fight lasts, the more of you there is. End it.)'],
  half: ['(Ordinary things come apart once half of them is gone. You choose which half.)'],
  reflect: ['(A large thing with no shell left turns a Strip back on you. Extract instead.)'],
};

function teach(b: Battle, key: string, ev: Ev[]): void {
  if (b.firsts.has(key)) return;
  b.firsts.add(key);
  for (const l of LESSONS[key] || []) say(ev, l);
}

/** A matching hit breaks one lock on a wind-up. Breaking every lock cancels the move. */
function breakLock(b: Battle, f: Foe, l: Layer, ev: Ev[]): void {
  const w = f.windup;
  if (!w || f.gone || w.broken.includes(l) || !w.locks.includes(l)) return;
  w.broken.push(l);
  ev.push({ t: 'fx', fx: 'lock', uid: f.uid });
  if (w.broken.length >= w.locks.length) {
    f.windup = null;
    if (f.intent) f.intent = { ...f.intent, move: null, skip: true };
    f.shown = f.intent;
    say(ev, `${f.name}'s ${w.move.name} comes apart.`);
  } else say(ev, `A lock on ${f.name}'s ${w.move.name} breaks.`);
}

function pickLocks(b: Battle, f: Foe, n: number): Layer[] {
  const present = LAYERS.filter(l => f.hp[l] > 0);
  const pool = present.length ? present : ['name' as Layer];
  const start = (f.uid + b.round) % pool.length;
  const out: Layer[] = [];
  for (let k = 0; k < Math.min(n, pool.length); k++) out.push(pool[(start + k) % pool.length]);
  return out;
}

function emotionOf(f: Foe): Emotion | null { return f.hp.emotion > 0 && f.def.emotion ? (f.def.emotion as Emotion) : null; }

function skipNext(f: Foe): void {
  if (f.intent) f.intent = { ...f.intent, move: null, skip: true };
  f.shown = f.intent;
}

/** An emotion meets an enemy. The families decide: feed, overwhelm, or unbalance. */
function react(b: Battle, f: Foe, mine: Emotion, ev: Ev[]): Reaction {
  const theirs = emotionOf(f);
  const r: Reaction = theirs ? reaction(mine, theirs) : 'unbalance';
  teach(b, 'families', ev);
  if (r === 'feed') {
    const l: Layer = f.max.emotion > 0 ? 'emotion' : (LAYERS.find(x => f.hp[x] > 0) || 'name');
    f.hp[l] = Math.min(f.max[l], f.hp[l] + Math.round(f.max[l] * (f.def.boss ? 0.06 : 0.2) + 5));
    f.fed = Math.min(3, f.fed + 1);
    say(ev, `${f.name} drinks the ${mine} in. It grows.`);
    ev.push({ t: 'fx', fx: 'feed', uid: f.uid });
  } else if (r === 'overwhelm') {
    say(ev, `${f.name} is overwhelmed by ${mine}.`);
    ev.push({ t: 'fx', fx: 'overwhelm', uid: f.uid });
    if (f.windup) { f.windup = null; say(ev, 'Its wind-up falls apart.'); }
    if (!f.def.boss) skipNext(f);
    const d = hitLayer(b, f, f.hp.emotion > 0 ? 'emotion' : (outermost(f) || 'name'), b.p.pow * (f.def.boss ? 1.6 : 1), ev);
    gain(b, d, ev);
  } else {
    f.unbalanced = true;
    say(ev, `${f.name} cannot hold the ${mine}. It is unbalanced.`);
    ev.push({ t: 'fx', fx: 'unbalance', uid: f.uid });
  }
  breakLock(b, f, 'emotion', ev);
  return r;
}

/** The first hit you land on an enemy while an absorbed emotion colors you carries that emotion into it. */
function colorHit(b: Battle, f: Foe, ev: Ev[]): void {
  const buff = b.p.buff;
  if (!buff || f.gone || !(buff.kind in FAMILY) || !buff.seq || f.reacted === buff.seq || !emotionOf(f)) return;
  f.reacted = buff.seq;
  react(b, f, buff.kind as Emotion, ev);
}

function returnStolen(b: Battle, f: Foe, ev: Ev[]): void {
  if (!f.stolen.length) return;
  for (const c of f.stolen) hand(b, c);
  say(ev, `${f.name} lets go of what it took from you.`);
  f.stolen = [];
}

function calmAway(b: Battle, f: Foe, ev: Ev[], text: string): void {
  say(ev, text);
  const m: HeldConcept = { layer: 'memory', label: f.def.memory || 'a small memory', from: f.def.id };
  hand(b, m); b.collected.push(m); b.up += 2;
  returnStolen(b, f, ev);
  f.gone = true;
  ev.push({ t: 'gone', uid: f.uid, how: 'calm' });
  if (liveFoes(b).length === 0) b.outcome = 'win';
}

/** A held essence pushed into an enemy. Each category takes it differently. */
function pushInto(b: Battle, c: HeldConcept, f: Foe, ev: Ev[]): void {
  ev.push({ t: 'fx', fx: 'absorb', uid: f.uid });
  if (c.layer === 'memory') {
    if (f.category === 'memory' && !f.def.boss && !f.def.up) calmAway(b, f, ev, `${f.name} remembers. It goes quiet and leaves.`);
    else if (f.category === 'memory') { f.confused = true; skipNext(f); say(ev, `${f.name} remembers something and stops.`); }
    else say(ev, `${f.name} does not know whose memory this is. It drops it.`);
    breakLock(b, f, 'memory', ev);
  } else if (c.layer === 'emotion') {
    react(b, f, (c.emotion || 'joy') as Emotion, ev);
  } else if (c.layer === 'shell') {
    if (f.category === 'void' || f.voidVariant) { say(ev, `${f.name} eats the shell instead of you.`); skipNext(f); }
    else if (f.category === 'shell') {
      const add = Math.round(Math.max(f.max.shell, 40) * 0.3);
      f.max.shell = Math.max(f.max.shell, add); f.hp.shell = Math.min(f.max.shell, f.hp.shell + add); f.shadow = false;
      say(ev, `${f.name} puts the shell on. It fits.`);
    } else { say(ev, `You house ${f.name} in ${c.label}. It cannot move.`); skipNext(f); }
    breakLock(b, f, 'shell', ev);
  }
}

/** A guard between you and the target takes a ranged action instead. */
function guardFor(b: Battle, f: Foe): Foe | null {
  const lo = Math.min(b.p.cell, f.cell), hi = Math.max(b.p.cell, f.cell);
  return liveFoes(b).find(g => g !== f && g.role === 'guard' && g.cell > lo && g.cell < hi) || null;
}
const RANGED = new Set<ActionId>(['savor', 'scent', 'insight', 'unmake', 'absorb', 'weave', 'embrace', 'oblivion', 'awakening']);

// ---------- Applying damage to foes ----------

function label(f: Foe, layer: Layer): string {
  const d = f.def;
  if (layer === 'shell') return (SHELLS[d.shellKind || '']?.name || 'a shell');
  if (layer === 'memory') return d.memory || 'a memory';
  if (layer === 'emotion') return d.emotion || 'a feeling';
  return d.trueName || d.name;
}

function present(f: Foe, l: Layer): boolean { return f.hp[l] > 0; }

/** Layers are removed outside in. Inner layers can be reached once the shell is gone. */
export function outermost(f: Foe): Layer | null {
  for (const l of LAYERS) if (present(f, l)) return l;
  return null;
}

function only(f: Foe, l: Layer): boolean { return LAYERS.every(x => x === l ? present(f, x) : !present(f, x)); }

export function reachable(f: Foe, l: Layer): boolean {
  if (!present(f, l)) return false;
  if (l === 'shell') return true;
  return !present(f, 'shell');
}

function say(ev: Ev[], text: string, speaker?: string): void { ev.push({ t: 'say', text, speaker }); }

function gain(b: Battle, dealt: number, ev: Ev[], rate = 0.07): void {
  let g = dealt * rate;
  if (has(b, 'Hunger')) g *= 1.2;
  if (b.p.worn?.bonus === 'gain') g *= 1.25;
  if (b.p.buff?.kind === 'sorrow') g *= 2;
  const amt = Math.round(g);
  if (amt <= 0) return;
  b.p.f = Math.min(b.p.fmax, b.p.f + amt);
  ev.push({ t: 'gain', amount: amt });
}

function hand(b: Battle, c: HeldConcept): void {
  const cap = has(b, 'Collection') ? 6 : 4;
  b.p.hand.push(c);
  while (b.p.hand.length > cap) b.p.hand.shift();
}

/** Deals damage to one layer. Returns what was dealt. */
function hitLayer(b: Battle, f: Foe, l: Layer, amount: number, ev: Ev[], opts: { weak?: boolean; crit?: boolean; how?: 'unmake' } = {}): number {
  if (f.gone || !present(f, l)) return 0;
  const dealt = Math.max(1, Math.min(f.hp[l], Math.round(amount)));
  f.hp[l] -= dealt;
  ev.push({ t: 'hit', uid: f.uid, layer: l, amount: dealt, weak: opts.weak, crit: opts.crit });
  if (f.hp[l] <= 0) {
    removeLayer(b, f, l, ev, opts.how);
    const had = LAYERS.filter(x => f.max[x] > 0).length, lost = LAYERS.filter(x => f.max[x] > 0 && f.hp[x] <= 0).length;
    if (!f.def.boss && !f.def.up && !f.gone && lost >= Math.max(2, Math.ceil(had / 2)) && total(f) > 0) { checkPhase(b, f, ev); defeat(b, f, opts.how === 'unmake' ? 'unmade' : 'unravel', ev); teach(b, 'half', ev); return dealt; }
  }
  checkPhase(b, f, ev);
  if (!f.gone && total(f) <= 0) defeat(b, f, opts.how === 'unmake' ? 'unmade' : 'unravel', ev);
  return dealt;
}

function removeLayer(b: Battle, f: Foe, l: Layer, ev: Ev[], how?: 'unmake'): void {
  f.hp[l] = 0;
  const lab = label(f, l);
  const c: HeldConcept = { layer: l, label: lab, from: f.def.id };
  if (l === 'emotion') c.emotion = f.def.emotion;
  if (!f.voidVariant) { hand(b, c); b.collected.push(c); b.up += 1; }
  ev.push({ t: 'layer_off', uid: f.uid, layer: l, label: lab });
  if (total(f) <= 0) return;
  if (l === 'shell') {
    f.shadow = true;
    say(ev, `${f.name} loses its shell. It is a shadow now.`);
  } else if (l === 'memory') {
    f.confused = true;
    say(ev, `${f.name} forgets something crucial. It is confused.`);
  } else if (l === 'emotion') {
    f.unbalanced = true;
    say(ev, `${f.name} goes calm, then unsteady.`);
  } else if (l === 'name' && how !== 'unmake') {
    if (f.def.boss) { say(ev, `${f.name} does not need its name to keep going.`); return; }
    f.forgotten = true;
    if (total(f) <= maxTotal(f) * 0.3 || b.rng.chance(0.5)) {
      say(ev, `Nobody remembers what ${f.name} was. It disappears.`);
      f.gone = true;
      ev.push({ t: 'gone', uid: f.uid, how: 'vanish' });
    } else {
      f.voidVariant = true;
      f.category = 'void';
      f.name = 'Something Else';
      say(ev, `Forgotten, ${f.def.name} becomes something else.`);
      ev.push({ t: 'fx', fx: 'void_touch', uid: f.uid });
    }
  }
}

function checkPhase(b: Battle, f: Foe, ev: Ev[]): void {
  const ph = f.def.phases;
  if (!ph || f.gone) return;
  const frac = total(f) / Math.max(1, maxTotal(f));
  while (f.phase - 1 < ph.length && frac <= ph[f.phase - 1].at) {
    const p = ph[f.phase - 1];
    f.phase++;
    if (p.text) ev.push({ t: 'phase', uid: f.uid, speaker: p.speaker || f.name, text: p.text });
  }
}

function defeat(b: Battle, f: Foe, how: 'unravel' | 'unmade', ev: Ev[]): void {
  if (f.gone) return;
  returnStolen(b, f, ev);
  f.gone = true;
  ev.push({ t: 'gone', uid: f.uid, how });
  if (how === 'unmade' && !f.voidVariant) {
    b.concepts.push(f.def.concept);
    say(ev, `${f.name} is unmade. You keep the concept of ${f.def.concept}.`);
    if (has(b, 'Appetite')) { b.p.f = Math.min(b.p.fmax, b.p.f + 10); ev.push({ t: 'gain', amount: 10 }); }
  } else {
    say(ev, `${f.name} unravels.`);
  }
  b.up += f.def.up || 0;
  if (liveFoes(b).length === 0) b.outcome = 'win';
}

/** Spends damage from the outside in. */
function spill(b: Battle, f: Foe, amount: number, ev: Ev[], how?: 'unmake'): number {
  let left = amount, dealt = 0;
  for (const l of LAYERS) {
    if (left <= 0 || f.gone) break;
    if (!present(f, l)) continue;
    const d = hitLayer(b, f, l, Math.min(left, f.hp[l]), ev, { how });
    dealt += d;
    left -= d;
  }
  return dealt;
}

// ---------- The Pilgrim's options ----------

export interface ActionInfo { id: ActionId; name: string; cost: number; ok: boolean; why?: string; target: 'adj' | 'any' | 'none' | 'concept' | 'two' }

export const ACTION_NAME: Record<ActionId, string> = {
  strip: 'Strip', extract_memory: 'Extract Memory', extract_emotion: 'Extract Emotion', extract_name: 'Extract Name', absorb: 'Absorb', weave: 'Weave', unmake: 'Unmake',
  true_sight: 'True Sight', handshake: 'Handshake', echo: 'Echo', savor: 'Savor', scent: 'Scent', insight: 'Insight',
  unseeing: 'Unseeing', embrace: 'Embrace', silence: 'Silence', devour: 'Devour', oblivion: 'Oblivion Scent', awakening: 'Awakening', hold: 'Hold Together',
};

export const ACTION_HELP: Record<ActionId, string> = {
  strip: 'Peel the outer layer off the enemy next to you. Shells come off twice as fast.',
  extract_memory: 'Pull its memory out. Needs its shell gone.',
  extract_emotion: 'Pull its feeling out. Needs its shell gone.',
  extract_name: 'Pull its name out. A forgotten thing may vanish or change.',
  absorb: 'Take a held concept into yourself, or push it into an enemy.',
  weave: 'Fuse two held concepts into one move.',
  unmake: 'Remove it from existence, outside in.',
  true_sight: 'See every layer and every lie for this fight.',
  handshake: 'Connect with the enemy in front. Some can be calmed.',
  echo: 'Repeat the last thing anyone did.',
  savor: 'Taste the outer layer of anything. You gain a lot.',
  scent: 'Mark a target. Your next hit on it lands twice as hard.',
  insight: 'See its weakness and its next moves.',
  unseeing: 'For two rounds nothing can perceive you.',
  embrace: 'Merge with an enemy. It turns on its own side.',
  silence: 'For two rounds enemies only use plain attacks.',
  devour: 'Bite every layer of every enemy and eat your hand.',
  oblivion: 'Make one ordinary enemy forgettable. It is gone.',
  awakening: 'Show it what it really is. Only its name is left.',
  hold: 'Steady yourself. Fragility moves 6 toward the middle.',
};

function senseOk(b: Battle, s: SenseId, ult: boolean): boolean { return (b.p.senses[s] || 0) >= (ult ? 2 : 1); }

export function stateHas(b: Battle, id: ActionId): boolean {
  const st = b.p.state;
  switch (id) {
    case 'strip': case 'hold': return true;
    case 'extract_memory': case 'absorb': return st >= 1;
    case 'extract_emotion': return st >= 2 || b.scripted.has('emotion');
    case 'extract_name': return st >= 3;
    case 'weave': return st >= 4 || b.p.weave;
    case 'unmake': return st >= 4 || liveFoes(b).some(f => f.def.boss && vulnerable(f));
  }
  for (const s of SENSES) {
    if (SENSE_ACTIVE[s] === id) return senseOk(b, s, false);
    if (SENSE_ULT[s] === id) return senseOk(b, s, true);
  }
  return false;
}

/** A boss whose Fragility is below a fifth can be unmade before the Pilgrim learns Unmake. */
export function vulnerable(f: Foe): boolean { return total(f) <= maxTotal(f) * 0.2; }

export function targetsFor(b: Battle, id: ActionId): Foe[] {
  const live = liveFoes(b);
  const adj = live.filter(f => adjacent(b, f));
  switch (id) {
    case 'strip': return adj;
    case 'extract_memory': return adj.filter(f => reachable(f, 'memory'));
    case 'extract_emotion': return adj.filter(f => reachable(f, 'emotion'));
    case 'extract_name': return adj.filter(f => reachable(f, 'name') || (present(f, 'name') && !present(f, 'shell')));
    case 'handshake': return adj;
    case 'unmake': return b.p.state >= 4 ? live : live.filter(f => f.def.boss && vulnerable(f));
    case 'oblivion': case 'embrace': return live.filter(f => !f.def.boss);
    case 'savor': case 'scent': case 'insight': case 'awakening': return live;
    default: return live;
  }
}

export function pilgrimActions(b: Battle): ActionInfo[] {
  const ids: ActionId[] = ['strip', 'extract_memory', 'extract_emotion', 'extract_name', 'absorb', 'weave', 'unmake', 'hold'];
  for (const s of SENSES) { ids.push(SENSE_ACTIVE[s]); }
  for (const s of SENSES) { ids.push(SENSE_ULT[s]); }
  const out: ActionInfo[] = [];
  for (const id of ids) {
    if (!stateHas(b, id)) continue;
    const info: ActionInfo = { id, name: ACTION_NAME[id], cost: cost(b, id), ok: true, target: 'none' };
    const ult = (Object.values(SENSE_ULT) as ActionId[]).includes(id);
    const sense = (Object.values(SENSE_ACTIVE) as ActionId[]).includes(id);
    if (['strip', 'extract_memory', 'extract_emotion', 'extract_name', 'handshake'].includes(id)) info.target = 'adj';
    else if (['unmake', 'savor', 'scent', 'insight', 'oblivion', 'embrace', 'awakening'].includes(id)) info.target = 'any';
    else if (id === 'absorb') info.target = 'concept';
    else if (id === 'weave') info.target = 'two';
    const cdLeft = b.p.cd[id] || 0;
    if (b.p.forgotten.has(id)) { info.ok = false; info.why = 'You have forgotten how.'; }
    else if (cdLeft > 0) { info.ok = false; info.why = `Ready in ${cdLeft} round${cdLeft > 1 ? 's' : ''}.`; }
    else if ((sense || ult) && b.p.silenced > 0) { info.ok = false; info.why = 'Your senses are silenced.'; }
    else if (ult && b.p.usedUlt) { info.ok = false; info.why = 'Once per battle.'; }
    else if (info.target === 'adj' || info.target === 'any') {
      if (targetsFor(b, id).length === 0) {
        info.ok = false;
        info.why = info.target === 'adj' ? (liveFoes(b).some(f => adjacent(b, f)) ? 'Nothing it can reach.' : 'Move next to an enemy first.') : 'No target.';
      }
    } else if (id === 'absorb' && b.p.hand.length === 0) { info.ok = false; info.why = 'You are holding nothing.'; }
    else if (id === 'weave' && b.p.hand.length < 2) { info.ok = false; info.why = 'Hold two concepts first.'; }
    else if (id === 'echo' && !b.last) { info.ok = false; info.why = 'Nothing to repeat yet.'; }
    out.push(info);
  }
  return out;
}

export interface MoveOpt { kind: MoveKind; to: number }

export function moveOptions(b: Battle): MoveOpt[] {
  const p = b.p, out: MoveOpt[] = [];
  const walkRange = has(b, 'Turning') ? 2 : 1;
  let stay: MoveOpt | null = null;
  for (const d of [1, -1]) {
    for (let k = 1; k <= walkRange; k++) {
      const c = p.cell + d * k;
      let ok = true;
      for (let j = 1; j <= k; j++) if (!free(b, p.cell + d * j)) ok = false;
      if (ok) out.push({ kind: 'walk', to: c });
    }
    const s = p.cell + d * 2;
    if (free(b, p.cell + d) && free(b, s)) out.push({ kind: 'slide', to: s });
    const fr = has(b, 'Drift') ? 2 : 1;
    let fc = p.cell;
    for (let k = 1; k <= fr; k++) { if (free(b, p.cell + d * k)) fc = p.cell + d * k; else break; }
    if (fc === p.cell) stay = { kind: 'float', to: fc }; else out.push({ kind: 'float', to: fc });
    const f = foeAt(b, p.cell + d);
    if (f) {
      const beyond = d > 0 ? f.cell + f.size : f.cell - 1;
      if (free(b, beyond)) out.push({ kind: 'weave', to: beyond });
    }
  }
  if (stay) out.push(stay);
  return out;
}

export function doMove(b: Battle, m: MoveOpt): Ev[] {
  const ev: Ev[] = [];
  const from = b.p.cell;
  b.p.cell = m.to;
  if (m.kind === 'float') b.p.float = true;
  if (m.kind === 'slide') b.p.open = !(b.p.worn?.bonus === 'speed');
  ev.push({ t: 'move', who: 'pilgrim', from, to: m.to, kind: m.kind });
  if (m.kind === 'weave') say(ev, 'You pass through it without harming it.');
  if (m.kind === 'float') say(ev, 'You float. The ground cannot reach you.');
  if (m.kind === 'slide' && b.p.open) say(ev, 'You slide in fast. You are open.');
  return ev;
}

// ---------- Doing the Pilgrim's action ----------

export interface Act { id: ActionId; target?: number; concept?: number; concepts?: [number, number]; push?: boolean }

function foeByUid(b: Battle, uid?: number): Foe | null { return b.foes.find(f => f.uid === uid && !f.gone) || null; }

function spend(b: Battle, c: number, ev: Ev[]): void {
  if (c <= 0) return;
  b.p.f -= c;
  if (b.p.f <= 0) checkFade(b, ev);
}

function critMul(b: Battle, f: Foe): number {
  if (!f.marked) return 1;
  f.marked = false;
  return has(b, 'Edge') ? 3 : 2;
}

function settle(b: Battle, ev: Ev[]): Ev[] {
  if (!b.outcome && liveFoes(b).length === 0) b.outcome = 'win';
  return ev;
}

export function doAction(b: Battle, a: Act): Ev[] {
  const ev: Ev[] = [];
  const p = b.p;
  const id = a.id;
  if (p.confused > 0 && id !== 'hold' && b.rng.chance(0.25)) {
    say(ev, 'You forget what you were doing.');
    p.free = false; p.double = false;
    return ev;
  }
  const c = cost(b, id);
  ev.push({ t: 'act', who: 'pilgrim', name: ACTION_NAME[id] });
  spend(b, c, ev);
  if (b.outcome) return ev;
  const cd = cooldownOf(b, id);
  if (cd > 0) p.cd[id] = cd + 1;
  if ((Object.values(SENSE_ULT) as ActionId[]).includes(id)) p.usedUlt = true;
  let f = foeByUid(b, a.target);
  if (f && RANGED.has(id) && !adjacent(b, f)) { const g = guardFor(b, f); if (g) { say(ev, `${g.name} steps in front of ${f.name}.`); teach(b, 'guard', ev); f = g; } }
  const mul = powMul(b);
  p.free = false; p.double = false;
  if (id !== 'echo') b.last = { who: 'pilgrim', action: id, target: a.target };
  b.pFormLast = id;
  runAction(b, a, f, mul, ev);
  return settle(b, ev);
}

function runAction(b: Battle, a: Act, f: Foe | null, mul: number, ev: Ev[]): void {
  const p = b.p;
  const id = a.id;
  switch (id) {
    case 'strip': {
      if (!f) return;
      ev.push({ t: 'fx', fx: 'strip', uid: f.uid });
      const l = outermost(f);
      if (!l) return;
      let dmg = p.pow * mul * variance(b);
      const weak = f.category === 'shell' && l === 'shell';
      if (weak) dmg *= 2;
      if (p.worn?.bonus === 'strip') dmg *= 1.3;
      if (has(b, 'Labor')) dmg *= 1.2;
      if (f.insight && weakLayer(f.category) === l) dmg *= 1.25;
      if (f.category === 'shell' && f.braced) { dmg *= 0.5; say(ev, `${f.name} braces against you.`); teach(b, 'brace', ev); }
      const cm = critMul(b, f);
      const d = hitLayer(b, f, l, dmg * cm, ev, { weak, crit: cm > 1 });
      gain(b, d, ev);
      if (f.category === 'shell') f.braced = true;
      if (f.def.up && !f.def.boss && l !== 'shell' && d > 0 && !f.gone) {
        const back = Math.max(1, Math.round(d * 0.08));
        b.p.f -= back;
        ev.push({ t: 'hurt', who: 'pilgrim', amount: back, kind: 'strip' });
        say(ev, `There is nothing left on ${f.name} to strip but you.`);
        teach(b, 'reflect', ev);
        checkFade(b, ev);
      }
      breakLock(b, f, 'shell', ev);
      colorHit(b, f, ev);
      return;
    }
    case 'extract_memory': case 'extract_emotion': case 'extract_name': {
      if (!f) return;
      const l: Layer = id === 'extract_memory' ? 'memory' : id === 'extract_emotion' ? 'emotion' : 'name';
      ev.push({ t: 'fx', fx: id, uid: f.uid });
      let dmg = p.pow * 1.25 * mul * variance(b);
      const weak = weakLayer(f.category) === l;
      if (weak) dmg *= 2;
      if (f.shadow) dmg *= 1.25;
      if (l === 'emotion' && has(b, 'Heat')) dmg *= 1.2;
      if (l === 'name' && has(b, 'Weather of Names')) dmg *= 1.3;
      if (f.insight && weak) dmg *= 1.25;
      const cm = critMul(b, f);
      const d = hitLayer(b, f, l, dmg * cm, ev, { weak, crit: cm > 1 });
      gain(b, d, ev);
      breakLock(b, f, l, ev);
      colorHit(b, f, ev);
      return;
    }
    case 'absorb': {
      const i = a.concept ?? 0;
      const c = p.hand.splice(i, 1)[0];
      if (!c) return;
      if (a.push && f && c.layer !== 'name') pushInto(b, c, f, ev);
      else { absorb(b, c, f, ev); if (c.layer === 'name' && f) breakLock(b, f, 'name', ev); }
      return;
    }
    case 'weave': {
      const [i, j] = a.concepts || [0, 1];
      const ci = p.hand[i], cj = p.hand[j];
      if (!ci || !cj) return;
      p.hand = p.hand.filter((_, k) => k !== i && k !== j);
      weave(b, ci, cj, f, mul, ev);
      b.up += 2;
      return;
    }
    case 'unmake': {
      if (!f) return;
      ev.push({ t: 'fx', fx: 'unmake', uid: f.uid });
      breakLock(b, f, 'name', ev);
      if (f.def.boss && vulnerable(f)) {
        for (const l of LAYERS) if (present(f, l)) hitLayer(b, f, l, f.hp[l], ev, { how: 'unmake' });
        return;
      }
      let dmg = p.pow * 2.6 * mul * variance(b);
      if (f.category === 'concept') dmg *= 2;
      if (has(b, 'Weight')) dmg *= 1.25;
      dmg *= critMul(b, f);
      const d = spill(b, f, dmg, ev, 'unmake');
      gain(b, d, ev, 0.03);
      return;
    }
    case 'hold': {
      const mid = p.fmax * 0.6;
      const step = Math.min(6, Math.abs(mid - p.f));
      p.f += p.f < mid ? step : -step;
      say(ev, p.f < mid ? 'You hold yourself together.' : 'You let a little of yourself go.');
      ev.push({ t: 'fx', fx: 'steady', who: 'pilgrim' });
      return;
    }
    case 'true_sight':
      b.trueSight = true;
      ev.push({ t: 'fx', fx: 'true_sight' });
      say(ev, 'You see it as it truly is. Every layer. Every lie.');
      return;
    case 'handshake': {
      if (!f) return;
      ev.push({ t: 'fx', fx: 'handshake', uid: f.uid });
      const calmable = f.def.peaceful || (f.category === 'memory' && has(b, 'Lostness'));
      if (calmable && !f.def.boss) {
        calmAway(b, f, ev, `You take its hand. ${f.name} goes quiet and leaves you a memory.`);
      } else {
        breakLock(b, f, 'emotion', ev);
        f.calm = 2;
        say(ev, `You feel its ${f.def.emotion || 'nothing'}. It hesitates.`);
      }
      return;
    }
    case 'echo': {
      const l = b.last;
      if (!l) return;
      ev.push({ t: 'fx', fx: 'echo' });
      if (l.who === 'pilgrim' && l.action && l.action !== 'echo') {
        say(ev, `You echo ${ACTION_NAME[l.action]}.`);
        let t = foeByUid(b, l.target) || f;
        if (t && !targetsFor(b, l.action).includes(t)) t = targetsFor(b, l.action)[0] || null;
        const cdKeep = { ...p.cd };
        runAction(b, { ...a, id: l.action, target: t?.uid }, t, mul, ev);
        p.cd = cdKeep;
      } else if (l.move) {
        const t = f || liveFoes(b)[0];
        if (!t) return;
        say(ev, `You echo ${l.move.name} back at it.`);
        const d = spill(b, t, p.pow * Math.max(0.6, l.move.power * 8) * mul, ev);
        gain(b, d, ev);
      }
      return;
    }
    case 'savor': {
      if (!f) return;
      const l = outermost(f);
      if (!l) return;
      ev.push({ t: 'fx', fx: 'savor', uid: f.uid });
      f.braced = false;
      breakLock(b, f, 'memory', ev);
      const d = hitLayer(b, f, l, p.pow * 0.5 * mul * variance(b) * critMul(b, f), ev);
      gain(b, d, ev, has(b, 'Mouth') ? 0.7 : 0.35);
      say(ev, flavor(f));
      return;
    }
    case 'scent':
      if (!f) return;
      f.marked = true;
      ev.push({ t: 'fx', fx: 'scent', uid: f.uid });
      say(ev, `It smells of ${f.def.memory || 'nothing you know'}.`);
      return;
    case 'insight': {
      if (!f) return;
      f.insight = true;
      ev.push({ t: 'fx', fx: 'insight', uid: f.uid });
      breakLock(b, f, 'name', ev);
      const w = weakLayer(f.category);
      say(ev, `${f.name} is ${catWord(f.category)}. ${w ? `Its ${w} is where it is weakest.` : f.category === 'concept' ? 'Only unmaking really reaches it.' : 'It eats void. Wear a shell.'}`);
      return;
    }
    case 'unseeing':
      p.unseen = 2; ev.push({ t: 'fx', fx: 'silence' }); say(ev, 'You become impossible to perceive.');
      for (const t of liveFoes(b)) if (t.windup) breakLock(b, t, t.windup.locks.find(x => !t.windup!.broken.includes(x))!, ev);
      return;
    case 'embrace':
      if (!f) return;
      f.charmed = 1; ev.push({ t: 'fx', fx: 'handshake', uid: f.uid }); say(ev, `You merge with ${f.name}. For a moment it is on your side.`); return;
    case 'silence':
      b.silenceFoes = 2; ev.push({ t: 'fx', fx: 'silence' }); say(ev, 'Absolute silence. Reality stutters.');
      for (const t of liveFoes(b)) if (t.windup) { say(ev, `${t.name}'s ${t.windup.move.name} goes quiet.`); t.windup = null; if (t.intent) t.intent = { ...t.intent, move: null, skip: true }; t.shown = t.intent; }
      return;
    case 'devour': {
      ev.push({ t: 'fx', fx: 'devour' });
      say(ev, 'You devour everything around you.');
      for (const t of liveFoes(b)) for (const l of LAYERS) if (present(t, l)) { hitLayer(b, t, l, p.pow * 0.9 * mul, ev); breakLock(b, t, l, ev); }
      const eat = p.hand.length * 5;
      p.hand = [];
      if (eat) { p.f = Math.min(p.fmax, p.f + eat); ev.push({ t: 'gain', amount: eat }); }
      return;
    }
    case 'oblivion':
      if (!f) return;
      ev.push({ t: 'fx', fx: 'scent', uid: f.uid });
      say(ev, `${f.name} becomes forgettable. You already cannot remember it.`);
      f.gone = true; ev.push({ t: 'gone', uid: f.uid, how: 'oblivion' });
      if (liveFoes(b).length === 0) b.outcome = 'win';
      return;
    case 'awakening': {
      if (!f) return;
      ev.push({ t: 'fx', fx: 'insight', uid: f.uid });
      say(ev, `${f.name} becomes aware of its true nature.`);
      for (const l of ['shell', 'memory', 'emotion'] as Layer[]) {
        if (!present(f, l)) continue;
        breakLock(b, f, l, ev);
        if (f.def.boss) hitLayer(b, f, l, f.max[l] * 0.3, ev); else hitLayer(b, f, l, f.hp[l], ev);
      }
      return;
    }
  }
}

function catWord(c: Category): string {
  return c === 'shell' ? 'Shell-Bound' : c === 'memory' ? 'Memory-Struck' : c === 'emotion' ? 'Emotion-Fed' : c === 'concept' ? 'Conceptual' : 'Void-Touched';
}

function flavor(f: Foe): string {
  const t: Record<Category, string> = {
    shell: 'It tastes of brass and old pennies.', memory: 'It tastes like a word on the tip of the tongue.',
    emotion: 'It tastes hot. Too hot.', concept: 'It tastes of the idea of taste.', void: 'It tastes of nothing. A lot of nothing.',
  };
  return t[f.category];
}

function absorb(b: Battle, c: HeldConcept, f: Foe | null, ev: Ev[]): void {
  const p = b.p;
  ev.push({ t: 'fx', fx: 'absorb', who: 'pilgrim' });
  if (c.layer === 'memory') {
    let amt = p.fmax * 0.25;
    if (has(b, 'Sadness')) amt *= 1.5;
    amt = Math.round(amt);
    p.f = Math.min(p.fmax, p.f + amt);
    ev.push({ t: 'heal', who: 'pilgrim', amount: amt });
    say(ev, `You absorb ${c.label}. It fills you.`);
  } else if (c.layer === 'emotion') {
    const kind = c.emotion || 'joy';
    p.buff = { kind, rounds: 3 + (has(b, 'Bloom') ? 2 : 0), seq: b.nextUid++ };
    say(ev, `You absorb ${kind}. It becomes a weapon.`);
    if (kind === 'longing') { p.cd = {}; say(ev, 'Everything is ready again.'); }
  } else if (c.layer === 'shell') {
    p.armorShell = { shell: SHELLS[(ENEMIES[c.from]?.shellKind) || ''] || null, rounds: has(b, 'Home') ? 8 : 4 };
    say(ev, `You wear ${c.label}. It houses you for a while.`);
  } else {
    const t = f || liveFoes(b)[0];
    const src = ENEMIES[c.from];
    if (t && src) {
      t.category = src.category;
      say(ev, `You call ${t.name} by the name ${c.label}. It becomes ${catWord(src.category)}.`);
      ev.push({ t: 'fx', fx: 'extract_name', uid: t.uid });
    }
  }
}

export const WEAVES: Record<string, { name: string; text: string }> = {
  'shell+shell': { name: 'Fortress', text: 'The party takes much less for two rounds.' },
  'memory+shell': { name: 'Keepsake', text: 'A shell houses a memory. It fights beside you for three rounds.' },
  'emotion+shell': { name: 'Armor of Feeling', text: 'You strike back when struck, for three rounds.' },
  'name+shell': { name: 'Effigy', text: 'A shell with a name. Enemies attack it for two rounds.' },
  'memory+memory': { name: 'Reminiscence', text: 'A large restoration for the whole party.' },
  'emotion+memory': { name: 'Nostalgia', text: 'Hurts every enemy and restores the party a little.' },
  'memory+name': { name: 'Recall', text: 'It remembers being someone else. Its shell falls off and it is confused.' },
  'emotion+emotion': { name: 'Outburst', text: 'Heavy damage to every enemy.' },
  'emotion+name': { name: 'Curse', text: "Eats at its name every round for four rounds." },
  'name+name': { name: 'Litany', text: 'A heavy blow straight to its name.' },
};

export function weaveKey(a: Layer, b2: Layer): string { return [a, b2].sort().join('+'); }

function weave(b: Battle, a: HeldConcept, c: HeldConcept, f: Foe | null, mul: number, ev: Ev[]): void {
  const key = weaveKey(a.layer, c.layer);
  const w = WEAVES[key];
  const p = b.p;
  ev.push({ t: 'fx', fx: 'weave' });
  say(ev, `You weave ${a.label} with ${c.label}: ${w.name}.`);
  const t = f || liveFoes(b)[0] || null;
  switch (key) {
    case 'shell+shell': p.fortress = 2; break;
    case 'memory+shell': b.echoAlly = { cell: p.cell, rounds: 3 }; break;
    case 'emotion+shell': p.feeling = 3; break;
    case 'name+shell': b.effigy = { rounds: 2 }; break;
    case 'memory+memory': {
      const amt = Math.round(p.fmax * 0.4);
      p.f = Math.min(p.fmax, p.f + amt); ev.push({ t: 'heal', who: 'pilgrim', amount: amt });
      healAllies(b, 0.5, ev);
      break;
    }
    case 'emotion+memory': {
      for (const o of liveFoes(b)) { const l = outermost(o); if (l) hitLayer(b, o, l, p.pow * 1.2 * mul, ev); }
      const amt = Math.round(p.fmax * 0.15);
      p.f = Math.min(p.fmax, p.f + amt); ev.push({ t: 'heal', who: 'pilgrim', amount: amt });
      healAllies(b, 0.15, ev);
      break;
    }
    case 'memory+name':
      if (t) { if (present(t, 'shell')) hitLayer(b, t, 'shell', t.hp.shell, ev); t.confused = true; if (t.intent) t.intent.skip = true; }
      break;
    case 'emotion+emotion':
      for (const o of liveFoes(b)) spill(b, o, p.pow * 2 * mul, ev);
      break;
    case 'emotion+name':
      if (t) t.curse = 4;
      break;
    case 'name+name':
      if (t) hitLayer(b, t, 'name', p.pow * 2.5 * mul, ev, { weak: true });
      break;
  }
}

function healAllies(b: Battle, frac: number, ev: Ev[]): void {
  for (const [who, a] of [['vorn', b.vorn], ['lb', b.lb]] as [Who, Ally | null][]) {
    if (!a) continue;
    const amt = Math.round(a.max * frac);
    a.hp = Math.min(a.max, a.hp + amt);
    a.down = a.hp <= 0;
    ev.push({ t: 'heal', who, amount: amt });
  }
}

// ---------- Vorn ----------

export type VornAct = 'cleave' | 'guard' | 'endure' | 'shove' | 'stand';
export const VORN_NAME: Record<VornAct, string> = { cleave: 'Cleave', guard: 'Guard', endure: 'Endure', shove: 'Shove', stand: 'Last Stand' };
export const VORN_HELP: Record<VornAct, string> = {
  cleave: 'Hit a shell in front of you. Shadows are ungraspable.',
  guard: 'Vorn takes the hits meant for you this round.',
  endure: 'No one strips Vorn this round. He recovers a little.',
  shove: 'Push the enemy in front back one cell.',
  stand: 'Everything Vorn has, once. It leaves him at 1.',
};

export function vornTargets(b: Battle, act: VornAct): Foe[] {
  const adj = liveFoes(b).filter(f => adjacent(b, f));
  if (act === 'cleave') return adj.filter(f => present(f, 'shell'));
  if (act === 'shove') return adj.filter(f => !f.def.boss);
  if (act === 'stand') return adj;
  return [];
}

export function vornActions(b: Battle): { id: VornAct; ok: boolean; why?: string }[] {
  const v = b.vorn;
  if (!v) return [];
  const out: { id: VornAct; ok: boolean; why?: string }[] = [];
  for (const id of ['cleave', 'guard', 'endure', 'shove', 'stand'] as VornAct[]) {
    if (id === 'stand' && !v.lastStand) continue;
    let ok = true, why: string | undefined;
    if ((id === 'cleave' || id === 'shove' || id === 'stand') && vornTargets(b, id).length === 0) {
      ok = false;
      why = id === 'cleave' && liveFoes(b).some(f => adjacent(b, f)) ? 'Nothing with a shell to hit.' : 'Nothing next to him.';
    }
    if (id === 'stand' && v.usedStand) { ok = false; why = 'Once per battle.'; }
    out.push({ id, ok, why });
  }
  return out;
}

export function doVorn(b: Battle, id: VornAct, target?: number): Ev[] {
  const ev: Ev[] = [];
  const v = b.vorn;
  if (!v || v.down) return ev;
  if (overloaded(b) && b.rng.chance(0.3)) {
    say(ev, 'Vorn freezes. He is afraid of what you are becoming.');
    return ev;
  }
  if (v.confused > 0 && b.rng.chance(0.3)) { say(ev, 'Vorn swings at something that is not there.'); return ev; }
  ev.push({ t: 'act', who: 'vorn', name: VORN_NAME[id] });
  const f = foeByUid(b, target);
  let atk = v.atk * variance(b) * (has(b, 'Soldier') ? 1.25 : 1) * (b.p.cheer > 0 ? 1.25 : 1) * (v.shadow ? 0.5 : 1);
  switch (id) {
    case 'cleave': {
      if (!f) return ev;
      const weak = f.category === 'shell';
      if (weak) atk *= 1.5;
      ev.push({ t: 'fx', fx: 'vorn_hit', uid: f.uid });
      hitLayer(b, f, 'shell', atk * critMul(b, f), ev, { weak });
      f.braced = false;
      breakLock(b, f, 'shell', ev);
      b.last = { who: 'vorn', target: f.uid };
      break;
    }
    case 'guard': v.guarding = true; say(ev, 'Vorn plants himself in front of you.'); break;
    case 'endure': {
      v.enduring = true;
      const amt = Math.round(v.max * 0.15);
      v.hp = Math.min(v.max, v.hp + amt);
      ev.push({ t: 'heal', who: 'vorn', amount: amt });
      say(ev, 'Vorn sets his jaw.');
      break;
    }
    case 'shove': {
      if (!f) return ev;
      const dir = f.cell > b.p.cell ? 1 : -1;
      const to = f.cell + dir;
      ev.push({ t: 'fx', fx: 'vorn_hit', uid: f.uid });
      if (present(f, 'shell')) hitLayer(b, f, 'shell', atk * 0.4, ev);
      f.braced = false;
      breakLock(b, f, 'shell', ev);
      if (!f.gone && foeFree(b, f, to)) { ev.push({ t: 'move', who: f.uid, from: f.cell, to, kind: 'push' }); f.cell = to; }
      else say(ev, 'It does not budge.');
      break;
    }
    case 'stand': {
      if (!f) return ev;
      v.usedStand = true;
      ev.push({ t: 'fx', fx: 'vorn_hit', uid: f.uid });
      say(ev, 'Chin up, hero. (mine too.)', 'Vorn');
      spill(b, f, atk * 4, ev);
      v.hp = 1;
      break;
    }
  }
  return settle(b, ev);
}

// ---------- Light-Bound #123 ----------

export type LbAct = 'cook' | 'cheer' | 'glow' | 'hide';
export const LB_NAME: Record<LbAct, string> = { cook: 'Cook', cheer: 'Cheer', glow: 'Glow', hide: 'Hide' };
export const LB_HELP: Record<LbAct, string> = {
  cook: 'Serve a dish from the pantry.',
  cheer: 'Everyone hits harder next round.',
  glow: 'Shine in its eyes. It misses half the time.',
  hide: 'Duck behind Vorn for a round.',
};
export const DISH_HELP: Record<Dish, string> = {
  ravioli: 'Moves your Fragility a long way toward the middle.',
  toast: 'Clears every bad state, and everyone hits harder.',
  quiche: 'Vorn and #123 recover half their health.',
  cake: 'Everything back to where it should be.',
};

export function doLb(b: Battle, id: LbAct, opt?: { dish?: Dish; target?: number }): Ev[] {
  const ev: Ev[] = [];
  const l = b.lb;
  if (!l || l.down) return ev;
  ev.push({ t: 'act', who: 'lb', name: id === 'cook' && opt?.dish ? DISH_NAME[opt.dish] : LB_NAME[id] });
  const p = b.p;
  switch (id) {
    case 'cook': {
      const d = opt?.dish;
      if (!d || (l.pantry[d] || 0) <= 0) return ev;
      l.pantry[d]--;
      ev.push({ t: 'fx', fx: 'cook' });
      const mid = p.fmax * 0.6;
      if (d === 'ravioli') {
        const step = Math.min(p.fmax * 0.3, Math.abs(mid - p.f));
        p.f += p.f < mid ? step : -step;
        p.f = Math.round(p.f);
        say(ev, 'Quasar ravioli! It tastes like the middle of things!', 'Light-Bound #123');
      } else if (d === 'toast') {
        p.forgotten.clear(); p.confused = 0; p.paperwork = 0; p.silenced = 0; p.toast = 2;
        if (b.vorn) { b.vorn.confused = 0; }
        say(ev, 'Thousand smile sugar toast! Everybody smile, a thousand times!', 'Light-Bound #123');
      } else if (d === 'quiche') {
        healAllies(b, 0.5, ev);
        say(ev, 'Quiche!', 'Light-Bound #123');
      } else {
        p.f = Math.round(mid);
        healAllies(b, 1, ev);
        say(ev, 'Sunset cake! It is the color of the sky here!', 'Light-Bound #123');
      }
      break;
    }
    case 'cheer': p.cheer = 2; say(ev, 'You can do it, Vagabond!', 'Light-Bound #123'); break;
    case 'glow': {
      const f = foeByUid(b, opt?.target) || liveFoes(b)[0];
      if (f) { f.blind = 2; ev.push({ t: 'fx', fx: 'true_sight', uid: f.uid }); say(ev, `#123 glows right in its eyes.`); breakLock(b, f, 'emotion', ev); }
      break;
    }
    case 'hide': l.hidden = true; say(ev, '#123 hides behind Vorn.'); break;
  }
  return settle(b, ev);
}

// ---------- Enemies ----------

function usableMoves(b: Battle, f: Foe): EnemyMove[] {
  let ms = f.def.moves.filter(m => !m.phases || m.phases.includes(Math.min(f.phase, 4)));
  if (f.voidVariant) ms = [{ name: 'Void-Touch', kind: 'void', power: 0.14, range: 'melee' }, { name: 'Nothing', kind: 'void', power: 0.1, range: 'any' }];
  if (f.role === 'mender' && liveFoes(b).some(o => o !== f && total(o) < maxTotal(o))) ms = [...ms, { name: 'Mend', kind: 'mind', power: 0, range: 'any', effect: 'heal_ally', weight: 2 }];
  if (b.silenceFoes > 0) {
    const plain = ms.filter(m => !m.effect && m.power > 0);
    if (plain.length) ms = [plain.reduce((a, c) => (c.power < a.power ? c : a))];
  }
  return ms.length ? ms : f.def.moves;
}

function weighted<T extends { weight?: number }>(b: Battle, a: T[]): T {
  const tot = a.reduce((s, m) => s + (m.weight || 1), 0);
  let r = b.rng.next() * tot;
  for (const m of a) { r -= m.weight || 1; if (r <= 0) return m; }
  return a[a.length - 1];
}

function partyCells(b: Battle): { who: Who; cell: number }[] {
  const out: { who: Who; cell: number }[] = [{ who: 'pilgrim', cell: b.p.cell }];
  if (b.vorn && !b.vorn.down) out.push({ who: 'vorn', cell: b.p.cell });
  if (b.lb && !b.lb.down) out.push({ who: 'lb', cell: 0 });
  return out;
}

function planMove(b: Battle, f: Foe): number {
  if (f.pinned > 0 || f.def.ai === 'still' || f.def.ai === 'boss') return f.cell;
  const sp = f.def.speed || 1;
  const pc = b.p.cell;
  const dir = f.cell > pc ? -1 : 1;
  let to = f.cell;
  const want = f.def.ai === 'caster' ? 2 : 0;
  for (let k = 0; k < sp; k++) {
    const g = gap({ ...f, cell: to } as Foe, pc);
    let step = 0;
    if (f.def.ai === 'skitter' && b.rng.chance(0.25)) step = b.rng.chance(0.5) ? 1 : -1;
    else if (g > want) step = dir;
    else if (g < want) step = -dir;
    if (step === 0) break;
    if (foeFree(b, f, to + step)) to += step; else break;
  }
  return to;
}

function canReach(b: Battle, f: Foe, m: EnemyMove, cell: number, who: Who): boolean {
  const tc = who === 'lb' ? 0 : b.p.cell;
  const g = gap({ ...f, cell } as Foe, tc);
  if (m.range === 'melee') return g === 0;
  if (m.range === 'wave') return g <= (m.reach || 2) - 1;
  return true;
}

export function chooseIntents(b: Battle): void {
  const seeLies = b.trueSight || b.p.worn?.bonus === 'lies' || b.p.armorShell?.shell?.bonus === 'lies' || (b.p.senses.sight || 0) >= 1;
  for (const f of liveFoes(b)) {
    if (f.windup) {
      const wm = f.windup.move;
      const can = partyCells(b).map(x => x.who).filter(w => canReach(b, f, wm, f.cell, w));
      const tgt: Who | 'all' | null = wm.all || wm.range === 'wave' ? 'all' : can.includes('pilgrim') ? 'pilgrim' : can[0] || 'pilgrim';
      f.intent = { move: wm, to: f.cell, target: tgt };
      f.shown = f.intent;
      continue;
    }
    let to = planMove(b, f);
    const ms = usableMoves(b, f);
    let m = weighted(b, ms);
    const targets = partyCells(b).map(x => x.who);
    let target: Who | 'all' | 'foe' | null = null;
    const reachable = (mm: EnemyMove) => targets.filter(w => canReach(b, f, mm, to, w));
    let r = reachable(m);
    if (r.length === 0) {
      const alt = ms.filter(mm => reachable(mm).length > 0);
      if (alt.length) { m = weighted(b, alt); r = reachable(m); }
    }
    if (m.power === 0 && m.effect) target = 'foe';
    else if (r.length === 0) target = null;
    else if (m.all || m.range === 'wave') target = 'all';
    else {
      const pick = b.rng.next();
      target = r.includes('pilgrim') && pick < 0.6 ? 'pilgrim' : r.includes('vorn') && pick < 0.9 ? 'vorn' : b.rng.pick(r);
    }
    if (m.heavy && target) { to = f.cell; f.intent = { move: m, to, target, charge: true }; f.shown = f.intent; continue; }
    f.intent = { move: target ? m : null, to, target };
    if (f.def.liar && !seeLies && ms.length > 1) {
      const fake = b.rng.pick(f.def.moves.filter(x => x !== m));
      f.shown = { move: fake, to, target: fake.all ? 'all' : target };
    } else f.shown = f.intent;
  }
}

function dodge(b: Battle, who: Who, m: EnemyMove, f: Foe): boolean {
  if (f.blind > 0 && b.rng.chance(0.5)) return true;
  if (who === 'pilgrim') {
    if (m.kind === 'ground' && b.p.float) return true;
    if (b.p.buff?.kind === 'fear' && b.rng.chance(0.3)) return true;
    if (faded(b) && m.kind !== 'void' && b.rng.chance(0.5)) return true;
    if (m.kind === 'void' && has(b, 'Absence') && b.rng.chance(0.25)) return true;
  }
  if (who === 'lb' && (m.kind === 'ground' || b.lb?.hidden)) return true;
  return false;
}

function armorOf(b: Battle): { armor: number; voidRes: number } {
  const s = b.p.armorShell?.shell || b.p.worn;
  let armor = s?.armor || 0, voidRes = s?.voidRes || 0;
  if (has(b, 'Burial')) voidRes += 0.2;
  if (has(b, 'Nothing')) voidRes += 0.3;
  return { armor, voidRes: Math.min(0.95, voidRes) };
}

function hurt(b: Battle, who: Who, m: EnemyMove, f: Foe, ev: Ev[], scale = 1): void {
  if (dodge(b, who, m, f)) { ev.push({ t: 'miss', who }); return; }
  let mul = scale * (f.confused ? 1.2 : 1) * (f.calm > 0 ? 0.5 : 1);
  if (b.p.fortress > 0) mul *= 0.4;
  if (who === 'pilgrim') {
    if ((f.category === 'void' || f.voidVariant) && !f.def.boss) {
      const sh = b.p.armorShell?.shell;
      if (sh) { b.p.armorShell = null; say(ev, `${f.name} eats ${sh.name} instead of you.`); teach(b, 'void', ev); ev.push({ t: 'miss', who }); return; }
      if (b.p.worn && armorOf(b).voidRes < 0.5) { say(ev, `${f.name} eats ${b.p.worn.name}. It is gone for this fight.`); teach(b, 'void', ev); b.p.worn = null; ev.push({ t: 'miss', who }); return; }
    }
    const { armor, voidRes } = armorOf(b);
    let d = m.power * b.p.fmax * mul;
    if (f.category === 'concept' && !f.def.boss) { d *= 0.5 + 0.8 * Math.max(0, b.p.f) / b.p.fmax; teach(b, 'concept', ev); }
    if (!f.def.boss && !f.def.up) d *= 3;
    if (m.kind === 'mind') d *= 1.4;
    if (m.kind === 'void') d *= 1 - voidRes; else d *= 1 - armor;
    if (b.p.open) d *= 1.5;
    if (b.p.buff?.kind === 'pride') d *= 0.7;
    if (has(b, 'Protection')) d *= 0.9;
    const amt = Math.max(1, Math.round(d));
    b.p.f -= amt;
    ev.push({ t: 'hurt', who, amount: amt, kind: m.kind });
    if (b.p.feeling > 0 && !f.gone) { const l = outermost(f); if (l) hitLayer(b, f, l, b.p.pow * 0.7, ev); }
    if (has(b, 'Misery') && !f.gone) { const l = outermost(f); if (l) hitLayer(b, f, l, b.p.pow * 0.2, ev); }
    if (b.p.buff?.kind === 'misery' && !f.gone) { const l = outermost(f); if (l) hitLayer(b, f, l, maxTotal(f) * 0.05, ev); }
    checkFade(b, ev);
    applyEffect(b, 'pilgrim', m, ev);
  } else {
    const a = who === 'vorn' ? b.vorn! : b.lb!;
    let d = m.power * a.max * mul;
    if (m.kind === 'mind' && who === 'vorn') d *= 0.7;
    if (m.kind === 'void') d *= 1.3;
    const amt = Math.max(1, Math.round(d));
    a.hp = Math.max(0, a.hp - amt);
    ev.push({ t: 'hurt', who, amount: amt, kind: m.kind });
    if (a.hp <= 0 && !a.down) {
      a.down = true;
      say(ev, who === 'vorn' ? 'Vorn goes down on one knee and stays there.' : 'Light-Bound #123 dims and drifts to the floor.');
    }
    applyEffect(b, who, m, ev);
  }
}

function applyEffect(b: Battle, who: Who, m: EnemyMove, ev: Ev[]): void {
  if (!m.effect) return;
  const p = b.p;
  if (who === 'vorn') {
    if (m.effect === 'confuse') b.vorn!.confused = 2;
    return;
  }
  if (who !== 'pilgrim') return;
  if (has(b, 'Untranslatable') && (m.effect === 'confuse' || m.effect === 'forget')) return;
  switch (m.effect) {
    case 'confuse': p.confused = 2; say(ev, 'Your thoughts slip sideways.'); break;
    case 'forget': {
      if (has(b, 'Forgetting')) break;
      const opts = pilgrimActions(b).filter(a => a.id !== 'hold' && !p.forgotten.has(a.id));
      if (opts.length) { const a = b.rng.pick(opts); p.forgotten.set(a.id, 3); say(ev, `You forget how to ${a.name}.`); }
      break;
    }
    case 'paperwork': p.paperwork = Math.min(4, p.paperwork + 1); say(ev, 'You are buried in paperwork. Everything costs more.'); break;
    case 'silence_senses': if (!has(b, 'Silence')) { p.silenced = 2; say(ev, 'Your senses go quiet.'); } break;
    case 'stun': p.stunned = 1; break;
    case 'push': { const to = Math.max(b.lb ? 1 : 0, p.cell - 1); if (free(b, to)) { ev.push({ t: 'move', who: 'pilgrim', from: p.cell, to, kind: 'push' }); p.cell = to; } break; }
    case 'drain': p.f -= 3; break;
  }
}

function checkFade(b: Battle, ev: Ev[]): void {
  if (b.p.f > 0 || b.outcome) return;
  if (has(b, 'Holding On') && !b.p.holdingUsed) {
    b.p.holdingUsed = true; b.p.f = 1;
    say(ev, 'You hold on.');
    return;
  }
  b.p.f = 0;
  ev.push({ t: 'fx', fx: 'fade', who: 'pilgrim' });
  say(ev, 'Fraying and knowing and slipping and- there is not enough of you left.');
  b.outcome = 'lose';
}

function stripParty(b: Battle, f: Foe, ev: Ev[]): void {
  const p = b.p;
  if (b.vorn && b.vorn.enduring) { say(ev, 'Vorn holds on to every piece of himself.'); return; }
  if (p.armorShell?.shell) { say(ev, `It strips ${p.armorShell.shell.name} off you.`); p.armorShell = null; ev.push({ t: 'fx', fx: 'strip', who: 'pilgrim' }); return; }
  if (p.worn) { say(ev, `It strips ${p.worn.name} off you for this fight.`); p.worn = null; ev.push({ t: 'fx', fx: 'strip', who: 'pilgrim' }); return; }
  if (b.vorn && !b.vorn.down && !b.vorn.shadow) { b.vorn.shadow = true; say(ev, "It strips Vorn's armor. He is a shadow of himself. His hits land half as hard."); ev.push({ t: 'fx', fx: 'strip', who: 'vorn' }); return; }
  say(ev, 'It reaches for your shell. You have none. It looks confused.');
  void f;
}

export function enemyPhase(b: Battle): Ev[] {
  const ev: Ev[] = [];
  for (const f of [...liveFoes(b)].sort((x, y) => x.cell - y.cell)) {
    if (b.outcome) break;
    if (f.gone) continue;
    const it = f.intent;
    if (!it) continue;
    if (f.stunned > 0) { f.stunned--; say(ev, `${f.name} cannot move.`); continue; }
    if (it.skip) { say(ev, `${f.name} hesitates.`); continue; }
    if (f.unbalanced && b.rng.chance(0.5)) { say(ev, `${f.name} wobbles and does nothing.`); continue; }
    if (f.category === 'emotion' && !f.voidVariant) {
      const i = b.p.hand.findIndex(c => c.layer === 'emotion');
      if (i >= 0) {
        const c = b.p.hand.splice(i, 1)[0];
        say(ev, `${f.name} eats the ${c.emotion || 'feeling'} you were holding.`);
        teach(b, 'eat', ev);
        const r = react(b, f, (c.emotion || 'joy') as Emotion, ev);
        if (r === 'overwhelm' && !f.def.boss) continue;
        if (f.gone || b.outcome) continue;
      }
    }
    if (f.category === 'memory' && !f.def.peaceful) {
      const i = b.p.hand.findIndex(c => c.layer === 'memory');
      if (i >= 0 && b.rng.chance(0.5)) { const c = b.p.hand.splice(i, 1)[0]; f.stolen.push(c); say(ev, `${f.name} takes ${c.label} from you. It holds it close.`); teach(b, 'steal', ev); }
    }
    if (it.to !== f.cell && foeFree(b, f, it.to)) { ev.push({ t: 'move', who: f.uid, from: f.cell, to: it.to }); f.cell = it.to; }
    const m = it.move;
    if (!m) continue;
    if (it.charge) {
      f.windup = { move: m, locks: pickLocks(b, f, m.heavy || 1), broken: [] };
      ev.push({ t: 'act', who: f.uid, name: m.name });
      say(ev, `${f.name} winds up ${m.name}.`);
      teach(b, 'windup', ev);
      continue;
    }
    ev.push({ t: 'act', who: f.uid, name: m.name });
    if (m.line) say(ev, m.line);
    b.last = { who: f.uid, move: m };
    if (f.charmed > 0) {
      f.charmed = 0;
      const other = liveFoes(b).filter(o => o !== f).sort((x, y) => Math.abs(x.cell - f.cell) - Math.abs(y.cell - f.cell))[0];
      if (other) { say(ev, `${f.name} turns on ${other.name}.`); spill(b, other, b.p.pow * 1.4, ev); }
      continue;
    }
    if (m.effect === 'heal_ally') {
      const t = liveFoes(b).filter(o => o !== f).sort((x, y) => total(x) / maxTotal(x) - total(y) / maxTotal(y))[0];
      const l = t && LAYERS.find(x => t.max[x] > 0 && t.hp[x] > 0 && t.hp[x] < t.max[x]);
      if (t && l) { t.hp[l] = Math.min(t.max[l], t.hp[l] + Math.round(maxTotal(t) * 0.15)); say(ev, `${f.name} mends ${t.name}.`); teach(b, 'mender', ev); }
      continue;
    }
    if (m.effect === 'heal_self') {
      const l = LAYERS.find(x => f.max[x] > 0 && f.hp[x] > 0) || 'name';
      const amt = Math.round(maxTotal(f) * 0.12);
      f.hp[l] = Math.min(f.max[l], f.hp[l] + amt);
      say(ev, `${f.name} files itself back together.`);
      continue;
    }
    if (m.effect === 'shell_self') {
      if (f.max.shell > 0) { f.hp.shell = Math.min(f.max.shell, f.hp.shell + Math.round(f.max.shell * 0.3)); f.shadow = false; say(ev, `${f.name} grows its shell back.`); }
      continue;
    }
    let mul = (f.unbalanced ? 1.5 : 1) * (1 + 0.3 * f.fed);
    f.fed = 0;
    if (f.windup && f.windup.move === m) {
      mul *= 1 + 0.35 * (f.windup.locks.length - f.windup.broken.length);
      say(ev, `${f.name} lets ${m.name} go.`);
      f.windup = null;
    }
    if (f.confused && b.rng.chance(0.3)) {
      const other = liveFoes(b).filter(o => o !== f);
      if (other.length) { const o = b.rng.pick(other); say(ev, `Confused, ${f.name} hits ${o.name}.`); spill(b, o, b.p.pow * 0.8, ev); continue; }
    }
    if (m.kind === 'strip') { stripParty(b, f, ev); if (m.power > 0 && b.p.unseen <= 0) hurt(b, 'pilgrim', m, f, ev, mul); continue; }
    if (b.effigy) { say(ev, 'It attacks the Effigy instead.'); continue; }
    if (b.echoAlly && b.rng.chance(0.25)) { say(ev, 'It hits your Keepsake. The Keepsake does not mind.'); continue; }
    const pc = partyCells(b);
    const hits: Who[] = [];
    if (it.target === 'all') {
      for (const x of pc) if (canReach(b, f, m, f.cell, x.who)) hits.push(x.who);
    } else if (it.target && it.target !== 'foe') {
      let w: Who = it.target as Who;
      if (!pc.some(x => x.who === w)) w = 'pilgrim';
      if (!canReach(b, f, m, f.cell, w)) {
        const alt = pc.find(x => canReach(b, f, m, f.cell, x.who));
        if (!alt) { say(ev, `${f.name}'s ${m.name} falls short.`); continue; }
        w = alt.who;
      }
      hits.push(w);
    }
    for (let w of hits) {
      if (b.outcome) break;
      if (w === 'pilgrim' && b.p.unseen > 0) { ev.push({ t: 'miss', who: 'pilgrim' }); continue; }
      if (w === 'pilgrim' && b.vorn && b.vorn.guarding && !b.vorn.down && it.target !== 'all') { w = 'vorn'; say(ev, 'Vorn takes it for you.'); hurt(b, w, m, f, ev, mul * 0.7); continue; }
      hurt(b, w, m, f, ev, mul);
    }
  }
  return settle(b, ev);
}

// ---------- Rounds ----------

const BREAKS: { text: string; run: (b: Battle, ev: Ev[]) => void }[] = [
  { text: 'MORE!! MORE OF ME THAN THERE IS ROOM FOR!!! ahahahahahaa!!!!', run: b => { b.p.free = true; b.p.double = true; } },
  { text: 'Physics breaks down. Everything changes its mind.', run: b => chooseIntents(b) },
  {
    text: 'You start to forget who you are.',
    run: (b, ev) => {
      if (has(b, 'Forgetting')) return;
      const opts = pilgrimActions(b).filter(a => a.id !== 'hold' && !b.p.forgotten.has(a.id));
      if (opts.length) { const a = b.rng.pick(opts); b.p.forgotten.set(a.id, 99); say(ev, `${a.name} is gone from you for this fight.`); }
    },
  },
  { text: 'Gravity fails. Everyone floats.', run: b => { b.p.float = true; } },
  {
    text: 'A storm of fragments. Everyone is cut.',
    run: (b, ev) => {
      if (!has(b, 'Weather')) { const amt = Math.round(b.p.fmax * 0.06); b.p.f -= amt; ev.push({ t: 'hurt', who: 'pilgrim', amount: amt, kind: 'air' }); }
      for (const f of liveFoes(b)) spill(b, f, maxTotal(f) * 0.05, ev);
    },
  },
  { text: 'Time stands still while I decipher.', run: b => { for (const f of liveFoes(b)) if (f.intent) f.intent.skip = true; } },
  { text: 'Reality bleeds out of you.', run: (b, ev) => { if (!has(b, 'Weather')) { const amt = Math.round(b.p.fmax * 0.08); b.p.f -= amt; ev.push({ t: 'hurt', who: 'pilgrim', amount: amt, kind: 'mind' }); } } },
];

export function endRound(b: Battle): Ev[] {
  const ev: Ev[] = [];
  if (b.outcome) return ev;
  const p = b.p;
  if (b.echoAlly) {
    const t = liveFoes(b).sort((x, y) => Math.abs(x.cell - p.cell) - Math.abs(y.cell - p.cell))[0];
    if (t) { say(ev, 'Your Keepsake strikes.'); spill(b, t, p.pow * 0.8, ev); }
    if (--b.echoAlly.rounds <= 0) b.echoAlly = null;
  }
  for (const f of liveFoes(b)) {
    if (f.curse > 0) { f.curse--; hitLayer(b, f, 'name', p.pow * 0.6, ev); }
    if (f.blind > 0) f.blind--;
    if (f.calm > 0) f.calm--;
    if (f.pinned > 0) f.pinned--;
  }
  if (p.buff) {
    if (p.buff.kind === 'joy') { p.f = Math.min(p.fmax, p.f + 4); ev.push({ t: 'gain', amount: 4 }); }
    if (p.buff.kind === 'despair') { p.f -= 3; ev.push({ t: 'hurt', who: 'pilgrim', amount: 3, kind: 'mind' }); checkFade(b, ev); }
    if (p.buff.kind === 'dread') for (const f of liveFoes(b)) f.pinned = 1;
    if (--p.buff.rounds <= 0) p.buff = null;
  }
  if (b.outcome) return ev;
  if (faded(b) && p.hand.length) { const c = p.hand.shift()!; say(ev, `You are fading. ${c.label} slips away from you.`); }
  if (p.f >= p.fmax) {
    say(ev, 'You unravel.');
    ev.push({ t: 'fx', fx: 'unravel', who: 'pilgrim' });
    p.stunned = 1;
    p.f = Math.round(p.fmax * 0.6);
  } else if (overloaded(b)) {
    const br = b.rng.pick(BREAKS);
    ev.push({ t: 'break', text: br.text });
    br.run(b, ev);
    checkFade(b, ev);
  }
  for (const k of Object.keys(p.cd)) { const v = (p.cd[k] || 0) - 1; if (v <= 0) delete p.cd[k]; else p.cd[k] = v; }
  for (const [k, v] of [...p.forgotten]) { if (v <= 1) p.forgotten.delete(k); else p.forgotten.set(k, v - 1); }
  p.float = false; p.open = false;
  if (p.unseen > 0) p.unseen--;
  if (p.confused > 0) p.confused--;
  if (p.silenced > 0) p.silenced--;
  if (p.fortress > 0) p.fortress--;
  if (p.feeling > 0) p.feeling--;
  if (p.cheer > 0) p.cheer--;
  if (p.toast > 0) p.toast--;
  if (p.armorShell && --p.armorShell.rounds <= 0) p.armorShell = null;
  if (b.effigy && --b.effigy.rounds <= 0) b.effigy = null;
  if (b.silenceFoes > 0) b.silenceFoes--;
  if (!b.boss && b.round >= 6 && !b.outcome) {
    const amt = Math.round(p.fmax * 0.06);
    p.f = Math.min(p.fmax, p.f + amt);
    say(ev, 'The world presses in. There is too much of you.');
    teach(b, 'overtime', ev);
    ev.push({ t: 'gain', amount: amt });
  }
  if (p.paperwork > 0 && b.round % 3 === 0) p.paperwork--;
  if (b.vorn) { b.vorn.guarding = false; b.vorn.enduring = false; if (b.vorn.confused > 0) b.vorn.confused--; }
  if (b.lb) b.lb.hidden = false;
  if (has(b, 'Hope') && b.vorn && !b.vorn.down) b.vorn.hp = Math.min(b.vorn.max, b.vorn.hp + Math.round(b.vorn.max * 0.1));
  b.round++;
  if (b.foes.some(f => f.def.id === 'guardian' && !f.gone && vulnerable(f))) b.outcome = 'choice';
  if (!b.outcome) chooseIntents(b);
  return settle(b, ev);
}

/** True when the Pilgrim loses this round's turn. */
export function pilgrimSkips(b: Battle): boolean {
  if (b.p.stunned > 0) { b.p.stunned--; return true; }
  return false;
}

/** What the battle hands back to the save. */
export function result(b: Battle): { f: number; vornHp: number; lbHp: number; pantry: Record<Dish, number> | null; collected: HeldConcept[]; concepts: string[]; up: number; taught: string[] } {
  return {
    taught: [...b.firsts],
    f: Math.max(1, Math.round(b.p.f)), vornHp: b.vorn ? b.vorn.hp : 0, lbHp: b.lb ? b.lb.hp : 0,
    pantry: b.lb ? b.lb.pantry : null, collected: b.collected, concepts: b.concepts, up: b.up,
  };
}
