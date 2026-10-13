// Helpers that cutscene scripts call with yield*. Each yields until its effect is finished.
import { sfx, playMusic, stopMusic, type SfxId, type TrackId, type VoiceId, type AreaTint } from '../engine/audio';
import { dlg, type Opt } from './dialogue';
import { voiceOf, portraitOf } from './speakers';
import { F, ent, stepEnt, stepPilgrim, loadMap, placeEnt, drifterBeaten, drifterRest, DX, DY, frames, setFollowers, blocked } from './field';
import { startBattle, battleActive } from './battleView';
import { S, fmax, flag, setFlag, collect, steady, writeSave, lbFull, vornFull } from './state';
import { game } from './registry';
import { toast } from './ui';
import { UI } from './palette';
import { result, type Battle } from '../battle/engine';
import type { HeldConcept, SenseId, Layer } from '../battle/model';
import { SENSE_NAME, STATES } from '../battle/model';
import { SHELLS, CONCEPTS, GROUPS, ENEMIES } from '../battle/enemies';
import { hashStr } from '../battle/rng';
import type { Script } from './types';
import { AVATAR, LB, VORN, SEER, NPC } from './art';

export { flag, setFlag };


export function* say(speaker: string | null, body: string, voice?: VoiceId, top = false): Script {
  dlg.say(speaker, body, voice || voiceOf(speaker), portraitOf(speaker), top);
  while (dlg.active) yield;
}

/** Several lines from one speaker. */
export function* lines(speaker: string | null, ...bodies: string[]): Script {
  for (const b of bodies) yield* say(speaker, b);
}

export function* choose(opts: Opt[], prompt?: { speaker: string | null; text: string }): Script {
  if (prompt) {
    dlg.say(prompt.speaker, prompt.text, voiceOf(prompt.speaker), portraitOf(prompt.speaker));
    while (dlg.active && !dlg.typedOut()) yield;
  } else dlg.pages = [];
  dlg.choose(opts);
  while (dlg.active) yield;
  return dlg.result;
}

export function* wait(n: number): Script { for (let i = 0; i < n; i++) yield; }

/** Walks an entity or the Pilgrim along a path like 'uurrd'. Digits repeat the next letter. */
export function* walk(id: string, path: string, dur = 8): Script {
  const dirs: Record<string, number> = { d: 0, l: 1, r: 2, u: 3 };
  let n = 0;
  for (const ch of path) {
    if (ch >= '0' && ch <= '9') { n = n * 10 + +ch; continue; }
    const d = dirs[ch];
    for (let k = 0; k < Math.max(1, n); k++) {
      if (id === 'pilgrim') {
        let tries = 0;
        while (!stepPilgrim(d, dur, tries > 30)) { tries++; yield; }
        while (F.p.move) yield;
      } else {
        const e = ent(id);
        if (!e) return;
        let tries = 0;
        while (!stepEnt(e, d, dur)) { if (++tries > 30) { e.move = { tx: e.x + DX[d], ty: e.y + DY[d], t: 0, dur }; break; } yield; }
        while (e.move) yield;
      }
    }
    n = 0;
  }
}

export function* walkTo(id: string, x: number, y: number, dur = 8): Script {
  const o = id === 'pilgrim' ? F.p : ent(id);
  if (!o) return;
  yield* walk(id, pathTo(o.x, o.y, x, y, id === 'pilgrim' ? null : ent(id)), dur);
}

/** Breadth-first path that walks around solid tiles and people. */
function pathTo(sx: number, sy: number, gx: number, gy: number, self: ReturnType<typeof ent>): string {
  const key = (x: number, y: number) => x + ',' + y;
  const prev = new Map<string, [string, string]>();
  prev.set(key(sx, sy), ['', '']);
  const q: [number, number][] = [[sx, sy]];
  const L = ['d', 'l', 'r', 'u'];
  while (q.length) {
    const [cx, cy] = q.shift()!;
    if (cx === gx && cy === gy) break;
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d], ny = cy + DY[d];
      const k = key(nx, ny);
      if (prev.has(k) || Math.abs(nx - sx) + Math.abs(ny - sy) > 80) continue;
      if (!(nx === gx && ny === gy) && blocked(nx, ny, self)) continue;
      prev.set(k, [key(cx, cy), L[d]]);
      q.push([nx, ny]);
    }
  }
  let k = key(gx, gy);
  if (!prev.has(k)) return '';
  let out = '';
  while (k !== key(sx, sy)) { const [p, m] = prev.get(k)!; out = m + out; k = p; }
  return out;
}

export function face(id: string, dir: number): void {
  if (id === 'pilgrim') F.p.dir = dir;
  else { const e = ent(id); if (e) e.dir = dir; }
}

export function place(id: string, x: number, y: number): void {
  const e = ent(id);
  if (e) placeEnt(e, x, y);
}

export function setArt(id: string, art: string): void {
  const e = ent(id);
  if (e) { e.def = { ...e.def, art }; e.frames = frames(art); }
}

export function* fadeOut(speed = 0.08): Script { while (game.fade < 1) { game.fade = Math.min(1, game.fade + speed); yield; } }
export function* fadeIn(speed = 0.08): Script { while (game.fade > 0) { game.fade = Math.max(0, game.fade - speed); yield; } }

export function* warp(map: string, x: number, y: number, dir = 0): Script {
  sfx('portal');
  yield* fadeOut();
  loadMap(map, x, y, dir);
  setFollowers();
  yield* fadeIn();
}

export function music(id: TrackId, tint?: AreaTint): void { playMusic(id, { tint }); }
export function silence(): void { stopMusic(1); }
export function play(id: SfxId): void { sfx(id); }
export function shake(n = 12): void { game.shake = n; }
export function flash(color = '#ffffff', n = 6): void { game.flash = n; game.flashColor = color; }
export { toast };

// ---------- Gains ----------

const MILESTONES: Record<Layer, { at: number[]; lines: [string, string][]; reward: (i: number) => string | null }> = {
  shell: {
    at: [1, 50, 100],
    lines: [
      ['The Collector', "A SHELL. empty. still warm. It was somebody's (it was somebody)."],
      ['The Collector', 'FIFTY!! fifty coats and not one sleeve with an arm in it. A BARGAIN, YES? A BARGAIN OF SLEEVES.'],
      ['The Collector', 'A HUNDRED. A hundred shells and they all fit you. Why do they all fit you??'],
    ],
    reward: i => (i === 0 ? 'You can wear a shell from the Collector.' : i === 1 ? growMax(5) : learn('touch', 2, 'The shells were other pilgrims. All of them. You can Embrace now.')),
  },
  memory: {
    at: [1, 25, 50],
    lines: [
      ['The Collector', 'YOU HOLD IT. a memory, warm as a mug. It is not yours (it is a little bit yours).'],
      ['The Collector', 'TWENTY-FIVE. They whisper over each other. LIKE RAIN ON A TIN ROOF. LIKE A HALLWAY FULL OF COATS. LIKE SOMEBODY CALLING YOU FROM THE NEXT STREET OVER.'],
      ['The Collector', 'FIFTY. Turn them over. On the back of every one there is your handwriting (you have no hands).'],
    ],
    reward: i => (i === 0 ? null : i === 1 ? growMax(5) : learn('thought', 2, 'Every memory was yours, from before. You can Awaken things now.')),
  },
  emotion: {
    at: [1, 50, 100],
    lines: [
      ['The Collector', 'OW. HOT. a feeling, raw, still kicking. hold it by the edges.'],
      ['The Collector', 'FIFTY AND THEY ALL WANT SOMETHING AND THEY ALL WANT IT NOW AND THEY ALL WANT IT FROM YOU'],
      ['The Collector', 'A HUNDRED!! how does it feel? it feels like everybody you ever stood next to, all at once.'],
    ],
    reward: i => (i === 0 ? null : i === 1 ? growMax(5) : learn('taste', 2, 'The feelings were from people you knew. You can Devour now.')),
  },
  name: {
    at: [1, 25, 50],
    lines: [
      ['The Collector', 'A NAME. it came off with a little pop. Say it. No, dont, it might hear.'],
      ['The Collector', 'TWENTY-FIVE NAMES AND NOT ONE OF THEM ANSWERS TO YOU. or do they. or do they.'],
      ['The Collector', 'FIFTY. You answered to every one of them, once. You just forgot to stop.'],
    ],
    reward: i => (i === 0 ? null : i === 1 ? growMax(5) : learn('smell', 2, 'Every name was one you used to answer to. You can make things forgettable now.')),
  },
};

function growMax(n: number): string {
  S.up += n * 10;
  return `Your Fragility can hold ${n} more.`;
}

function learn(s: SenseId, level: number, msg: string): string {
  S.senses[s] = Math.max(S.senses[s] || 0, level);
  return msg;
}

/** Plays milestone lines for the four collection quests. */
export function* milestones(before: Record<Layer, number>): Script {
  for (const l of ['shell', 'memory', 'emotion', 'name'] as Layer[]) {
    const m = MILESTONES[l];
    for (let i = 0; i < m.at.length; i++) {
      if (before[l] < m.at[i] && S.totals[l] >= m.at[i]) {
        sfx('state_up');
        yield* say(m.lines[i][0], m.lines[i][1]);
        const r = m.reward(i);
        if (r) yield* say(null, r);
      }
    }
  }
}

export function* giveConcept(c: HeldConcept, text?: string): Script {
  const before = { ...S.totals };
  collect([c]);
  sfx(c.layer === 'shell' ? 'shell_get' : c.layer === 'memory' ? 'memory_get' : c.layer === 'emotion' ? 'emotion_get' : 'name_get');
  toast(`${c.layer === 'memory' ? 'Memory' : c.layer[0].toUpperCase() + c.layer.slice(1)}: ${c.label}`, UI.gold);
  if (text) yield* say(null, text);
  yield* milestones(before);
}

export function giveShellKind(kind: string): void {
  S.shells[kind] = (S.shells[kind] || 0) + 1;
  S.totals.shell++;
  toast(`Shell: ${SHELLS[kind]?.name || kind}`, UI.gold);
  sfx('shell_get');
}

export function giveConceptIdea(name: string): void {
  if (!S.concepts.includes(name)) S.concepts.push(name);
  toast(`Concept: ${name}`, UI.white);
  sfx('concept_get');
}

export function* learnSense(s: SenseId, level = 1, text?: string): Script {
  S.senses[s] = Math.max(S.senses[s] || 0, level);
  sfx('state_up');
  flash('#ffffff', 4);
  yield* say(null, text || (level >= 2 ? `${SENSE_NAME[s]} opens all the way.` : `You can use ${SENSE_NAME[s]} now. Press C.`));
}

export function* becomeState(n: number): Script {
  if (S.state >= n) return;
  S.state = n;
  S.f = Math.min(S.f + 10, fmax());
  sfx('state_up');
  flash('#ffffff', 8);
  yield* say(null, `You are ${STATES[n]}.`);
}

export function joinVorn(): void { S.vorn = vornFull(); setFollowers(); }
export function joinLb(): void { S.lb = lbFull(); setFollowers(); }
export function leaveLb(): void { S.lb = null; setFollowers(); }

export function steadyHere(): void {
  steady();
  S.steady = { map: S.map, x: S.x, y: S.y };
  writeSave();
}

// ---------- Battles ----------

export let lastBattle: Battle | null = null;

function partyIn() {
  return {
    f: S.f, state: S.state, up: S.up, senses: S.senses, worn: S.worn, slots: S.slots,
    vorn: S.vorn, lb: S.lb, avatar: S.avatar, weaveKnown: !!flag('weave_glimpse'),
    taught: Object.keys(S.flags).filter(k => k.startsWith('taught_')).map(k => k.slice(7)),
  };
}

function tintNow(): string { return F.map?.tint || (F.map?.area === 'brass' ? 'brass' : F.map?.area || 'brass'); }

/** Runs a battle. Returns 'win', 'lose', or 'choice'. */
export function* battle(group: string, opts: { scripted?: string[]; tint?: string; lossOk?: boolean; scale?: number } = {}): Script {
  const ids = GROUPS[group] || [group];
  let out: Battle | null = null;
  game.mode = 'battle';
  sfx('quake');
  const defs = ids.map(id => ENEMIES[id.split('@')[0]]).filter(Boolean);
  if (!defs.some(d => d.boss)) playMusic(defs.some(d => d.up) ? 'miniboss' : 'battle', { tint: (opts.tint || tintNow()) as AreaTint });
  startBattle(ids, partyIn(), { seed: hashStr(group + S.time + S.up), tint: opts.tint || tintNow(), scripted: opts.scripted, scale: opts.scale }, b => { out = b; });
  while (battleActive() || !out) yield;
  game.mode = 'field';
  const b = out as Battle;
  lastBattle = b;
  for (const k of result(b).taught) S.flags['taught_' + k] = 1;
  if (F.map) playMusic(F.map.music, { tint: F.map.tint });
  return yield* settle(b, !!opts.lossOk);
}


function* settle(b: Battle, lossOk: boolean): Script {
  const r = result(b);
  if (b.outcome === 'choice') return 'choice';
  if (b.outcome !== 'win') {
    if (lossOk) { S.f = Math.max(1, Math.round(fmax() * 0.3)); return 'lose'; }
    yield* fadeAway();
    return 'lose';
  }
  const before = { ...S.totals };
  S.f = Math.min(r.f, fmax());
  S.up += r.up;
  if (S.vorn) S.vorn.hp = Math.min(S.vorn.max, Math.max(1, r.vornHp) + Math.round(S.vorn.max * 0.3));
  if (S.lb) { S.lb.hp = Math.min(S.lb.max, Math.max(1, r.lbHp) + Math.round(S.lb.max * 0.3)); if (r.pantry) S.lb.pantry = r.pantry; }
  collect(r.collected);
  for (const c of r.concepts) if (!S.concepts.includes(c) && CONCEPTS[c]) { S.concepts.push(c); toast(`Concept: ${c}`, UI.white); }
  yield* milestones(before);
  return 'win';
}

export function* fadeAway(): Script {
  yield* fadeOut(0.04);
  const st = S.steady;
  loadMap(st.map, st.x, st.y, 0);
  setFollowers();
  steady();
  yield* fadeIn(0.04);
  yield* say(null, 'You come back together at the last place you steadied.');
}

/** A drifter in the field touched the Pilgrim. */
export function* drifterFight(group: string, id: string): Script {
  const r = yield* battle(group);
  if (r === 'win') drifterBeaten(id);
  drifterRest();
}

export function partyLabel(): string { return [S.vorn ? 'Vorn' : '', S.lb ? '#123' : ''].filter(Boolean).join(', '); }

export { setFollowers, ent, F, steady, writeSave, S };
void hashStr;
