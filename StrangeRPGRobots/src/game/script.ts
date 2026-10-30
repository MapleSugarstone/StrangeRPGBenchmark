// Scene scripts: parsing the .txt files and running scenes. The format is documented in src/script/README.md.
import { say, choose, rollCheck, closeDialogue, toast, type ChoiceOpt } from '../ui/dialogue';
import { G, flag, setFlag, clearFlag } from './state';
import { ITEM, SKILL_NAME, type Skill } from '../rules/data';
import { pool, partyMembers, grantXp, edgeMax } from '../rules/stats';
import { wait } from './sched';
import { C } from '../engine/palette';
import { sfx } from '../audio/sfx';
import { addRep, addRel, expireQuests } from './replay';
import { unlockLore } from './details';

export interface ChoiceSpec {
  text: string;
  to?: string;
  fail?: string;
  check?: { skill: Skill; need: number };
  party?: string;
  cls?: string;
  cond?: string;
  cost?: number;
}

export type SLine =
  | { k: 'say'; who: string; text: string; n: number }
  | { k: 'cmd'; name: string; args: string[]; bg: boolean; raw: string; n: number }
  | { k: 'choice'; prompt: string; opts: ChoiceSpec[]; n: number; key: string }
  | { k: 'label'; name: string; n: number };

export interface Scene { id: string; file: string; lines: SLine[]; labels: Map<string, number> }

export const SCENES = new Map<string, Scene>();

const SPEAKER = /^([A-Z][A-Za-z .']{0,24}): (.+)$/;
const SKILL_BY_NAME: Record<string, Skill> = Object.fromEntries(Object.entries(SKILL_NAME).map(([k, v]) => [v.toLowerCase(), k as Skill]));

function parseOption(s: string): ChoiceSpec {
  let rest = s.trim();
  const o: ChoiceSpec = { text: '' };
  for (;;) {
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^\[([A-Za-z]+) (\d+)\]\s*/))) {
      const sk = SKILL_BY_NAME[m[1].toLowerCase()];
      if (!sk) throw new Error(`Unknown skill ${m[1]}`);
      o.check = { skill: sk, need: Number(m[2]) };
    } else if ((m = rest.match(/^\{([a-z]+)\}\s*/))) o.party = m[1];
    else if ((m = rest.match(/^<([a-z]+)>\s*/))) o.cls = m[1];
    else if ((m = rest.match(/^\?(\S+)\s+/))) o.cond = m[1];
    else if ((m = rest.match(/^\$(\d+)\s+/))) o.cost = Number(m[1]);
    else break;
    rest = rest.slice(m[0].length);
  }
  const arrow = rest.lastIndexOf(' -> ');
  if (arrow >= 0) {
    const tgt = rest.slice(arrow + 4).trim();
    rest = rest.slice(0, arrow).trim();
    const [a, b] = tgt.split('|').map((x) => x.trim());
    o.to = a;
    if (b) o.fail = b;
  }
  o.text = rest;
  return o;
}

export function parseScripts(file: string, src: string) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  let cur: Scene | null = null;
  let choice: Extract<SLine, { k: 'choice' }> | null = null;
  lines.forEach((raw, i) => {
    const n = i + 1;
    const t = raw.trim();
    if (t.startsWith('== ')) {
      const id = t.slice(3).trim();
      if (SCENES.has(id)) throw new Error(`Duplicate scene ${id} in ${file}:${n}`);
      cur = { id, file, lines: [], labels: new Map() };
      SCENES.set(id, cur);
      choice = null;
      return;
    }
    if (!cur || !t || t.startsWith('#')) return;
    const sc: Scene = cur;
    if (t.startsWith('- ')) {
      if (!choice) throw new Error(`Option without a prompt in ${file}:${n}`);
      choice.opts.push(parseOption(t.slice(2)));
      return;
    }
    choice = null;
    if (t === '?' || t.startsWith('? ')) {
      choice = { k: 'choice', prompt: t.slice(1).trim(), opts: [], n, key: `${sc.id}:${n}` };
      sc.lines.push(choice);
      return;
    }
    if (t.startsWith('* ')) {
      const name = t.slice(2).trim();
      sc.labels.set(name, sc.lines.length);
      sc.lines.push({ k: 'label', name, n });
      return;
    }
    if (t.startsWith('> ')) {
      let body = t.slice(2).trim();
      const bg = body.endsWith(' &');
      if (bg) body = body.slice(0, -2).trim();
      const args = tokenize(body);
      sc.lines.push({ k: 'cmd', name: args[0], args: args.slice(1), bg, raw: body, n });
      return;
    }
    if (t.startsWith('(') && t.endsWith(')')) { sc.lines.push({ k: 'say', who: '', text: t.slice(1, -1), n }); return; }
    const m = t.match(SPEAKER);
    if (m) { sc.lines.push({ k: 'say', who: m[1], text: m[2], n }); return; }
    throw new Error(`Cannot read line ${file}:${n}: ${t}`);
  });
}

function tokenize(s: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.push(m[1] ?? m[2]);
  return out;
}

/** What the scene runner needs from the rest of the game. Field, combat, and menus fill it in. */
export interface Stage {
  lock(on: boolean): void;
  walk(actor: string, x: number, y: number, run: boolean): Promise<void>;
  step(actor: string, dir: string, n: number): Promise<void>;
  face(actor: string, dirOrOther: string): void;
  enter(actor: string, look: string, x: number, y: number, dir?: string): void;
  exit(actor: string): void;
  emote(actor: string, kind: string): void;
  camera(target: string, seconds: number): Promise<void>;
  marker(name: string): [number, number] | null;
  warp(map: string, marker: string, dir?: string): Promise<void>;
  fade(dir: 'in' | 'out', seconds: number): Promise<void>;
  shake(n: number): void;
  music(track: string): void;
  chapter(n: number, title: string): Promise<void>;
  fight(encounter: string): Promise<boolean>;
  hostile(npc: string, encounter?: string): Promise<boolean>;
  shop(id: string): Promise<void>;
  rest(): Promise<void>;
  nameEntry(what: string): Promise<void>;
  join(id: string): void;
  leave(id: string): void;
  look(actor: string, look: string): void;
  anim(name: string, args: string[]): Promise<void>;
  autosave(): void;
  ending(): Promise<void>;
  heal(): void;
  refresh(): void;
  quest(id: string, stage: string, note?: string): void;
  approve(id: string, n: number): void;
  give(item: string, n: number): void;
  cards(opponent: string): Promise<boolean>;
  /** Opens the travel list and moves the party to the pick. */
  travel(): Promise<void>;
}

let STAGE: Stage | null = null;
export function setStage(s: Stage) { STAGE = s; }

let running = 0;
export function sceneRunning(): boolean { return running > 0; }

class Jump { constructor(public scene: string, public label?: string) {} }

/** Runs a scene to the end. Scenes can jump to labels and to other scenes. */
export async function runScene(id: string, from?: string): Promise<void> {
  const st = STAGE!;
  running++;
  st.lock(true);
  try {
    let scene = SCENES.get(id);
    let pc = 0;
    if (!scene) { console.warn(`[script] no scene ${id}`); return; }
    if (from) pc = scene.labels.get(from) ?? 0;
    for (;;) {
      if (pc >= scene.lines.length) break;
      const L = scene.lines[pc++];
      try {
        const r = await exec(L, scene);
        if (r === 'end') break;
        if (typeof r === 'string') {
          if (scene.labels.has(r)) pc = scene.labels.get(r)!;
          else if (SCENES.has(r)) { scene = SCENES.get(r)!; pc = 0; }
          else { console.warn(`[script] ${scene.id}: no label or scene ${r}`); break; }
        }
      } catch (e) {
        if (e instanceof Jump) { scene = SCENES.get(e.scene)!; pc = e.label ? scene.labels.get(e.label) ?? 0 : 0; continue; }
        throw e;
      }
    }
  } finally {
    running--;
    if (running === 0) { closeDialogue(); st.lock(false); void st.camera('free', 0); }
  }
}

function num(s: string | undefined, d = 0): number { const v = Number(s); return Number.isFinite(v) ? v : d; }

function bestFor(sk: Skill): { name: string; id: string; p: number; helper?: string } {
  const ms = partyMembers();
  let best = ms[0];
  for (const m of ms) if (pool(m, sk) > pool(best, sk)) best = m;
  let p = pool(best, sk);
  let helper: string | undefined;
  for (const m of ms) if (m !== best && m.skills[sk] >= 2) { p += 1; helper = m.id === 'hero' ? G.heroName : m.name; break; }
  return { name: best.id === 'hero' ? G.heroName : best.name, id: best.id, p, helper };
}

/** Rolls a check for the party: the best member rolls, one other member with training helps. */
export async function partyCheck(sk: Skill, need: number): Promise<boolean> {
  const b = bestFor(sk);
  const m = G.roster[b.id];
  const label = `${b.name}: ${SKILL_NAME[sk]} ${b.p} dice`;
  const r = await rollCheck(label, b.p, need, m.edge, b.helper ? `${b.helper} helps: +1 die` : undefined);
  if (r.edgeUsed) m.edge = Math.max(0, m.edge - 1);
  if (r.ok) {
    const ups = grantXp(15 * need);
    for (const u of ups) toast(`${u.id === 'hero' ? G.heroName : G.roster[u.id].name} hit level ${u.level}`, C.amb3);
  }
  return r.ok;
}

export function optionAvailable(o: ChoiceSpec): boolean {
  if (o.party && !G.party.includes(o.party)) return false;
  if (o.cls && G.cls !== o.cls) return false;
  if (o.cond && !flag(o.cond)) return false;
  return true;
}

async function exec(L: SLine, scene: Scene): Promise<string | void> {
  const st = STAGE!;
  if (L.k === 'label') return;
  if (L.k === 'say') { await say(L.who, L.text); return; }
  if (L.k === 'choice') {
    const shown = L.opts.filter(optionAvailable);
    const opts: ChoiceOpt[] = shown.map((o) => {
      let tag: string | undefined;
      let tagColor: number | undefined;
      if (o.check) {
        const b = bestFor(o.check.skill);
        tag = `[${SKILL_NAME[o.check.skill]} ${o.check.need}]`;
        tagColor = b.p >= o.check.need * 3 ? C.grn3 : b.p >= o.check.need * 2 ? C.amb3 : C.mag3;
      } else if (o.party) { tag = `[${G.roster[o.party]?.name ?? o.party}]`; tagColor = C.cyan3; }
      else if (o.cls) { tag = `[${o.cls[0].toUpperCase()}${o.cls.slice(1)}]`; tagColor = C.vio3; }
      if (o.cost) { tag = `[${o.cost} gilt]`; tagColor = C.amb4; }
      return { text: o.text, tag, tagColor, enabled: !o.cost || G.gilt >= o.cost };
    });
    if (!opts.length) return;
    const key = L.key;
    const i = await choose(L.prompt, opts, G.menu[key] ?? 0);
    G.menu[key] = i;
    const o = shown[i];
    if (o.cost) { G.gilt -= o.cost; sfx('buy'); }
    if (o.check) {
      const ok = await partyCheck(o.check.skill, o.check.need);
      return ok ? o.to : (o.fail ?? o.to);
    }
    return o.to;
  }
  const a = L.args;
  const run = async (): Promise<string | void> => {
    switch (L.name) {
      case 'lock': st.lock(true); return;
      case 'unlock': st.lock(false); return;
      case 'end': return 'end';
      case 'goto': {
        if (scene.labels.has(a[0])) return a[0];
        if (SCENES.has(a[0])) throw new Jump(a[0], a[1]);
        console.warn(`[script] goto ${a[0]} not found`);
        return 'end';
      }
      case 'if': { const target = a[a.indexOf('->') + 1]; if (flag(a[0])) return target; return; }
      case 'ifnot': { const target = a[a.indexOf('->') + 1]; if (!flag(a[0])) return target; return; }
      case 'ifgilt': { const target = a[a.indexOf('->') + 1]; if (G.gilt >= num(a[0])) return target; return; }
      case 'ifapprove': { const target = a[a.indexOf('->') + 1]; if ((G.roster[a[0]]?.approval ?? -99) >= num(a[1])) return target; return; }
      case 'ifhold': { const target = a[a.indexOf('->') + 1]; if (G.port.hold >= num(a[0])) return target; return; }
      case 'ifself': { const target = a[a.indexOf('->') + 1]; if (G.port.self >= num(a[0])) return target; return; }
      case 'set': {
        setFlag(a[0], a[1] ? num(a[1], 1) : 1);
        const dead = a[0].match(/^(\w+)_dead$/);
        if (dead && G.roster[dead[1]]) { G.roster[dead[1]].dead = true; G.party = G.party.filter((x) => x !== dead[1]); }
        st.refresh();
        return;
      }
      case 'unset': clearFlag(a[0]); st.refresh(); return;
      case 'wait': await wait(num(a[0], 0.5)); return;
      case 'walk': case 'run': {
        const target = a[1].startsWith('@') ? st.marker(a[1].slice(1)) : [num(a[1]), num(a[2])] as [number, number];
        if (!target) { console.warn(`[script] ${scene.id}: no marker ${a[1]}`); return; }
        await st.walk(a[0], target[0], target[1], L.name === 'run');
        return;
      }
      case 'step': await st.step(a[0], a[1], num(a[2], 1)); return;
      case 'face': st.face(a[0], a[1]); return;
      case 'enter': {
        const p = a[2]?.startsWith('@') ? st.marker(a[2].slice(1)) : [num(a[2]), num(a[3])] as [number, number];
        if (!p) { console.warn(`[script] ${scene.id}: no marker ${a[2]}`); return; }
        st.enter(a[0], a[1], p[0], p[1], a[3]?.startsWith('@') ? undefined : a[a.length - 1]);
        return;
      }
      case 'exit': st.exit(a[0]); return;
      case 'emote': st.emote(a[0], a[1]); return;
      case 'camera': await st.camera(a[0], num(a[1], 0.8)); return;
      case 'warp': await st.warp(a[0], a[1]?.replace('@', '') ?? 'start', a[2]); return;
      case 'fade': await st.fade(a[0] === 'in' ? 'in' : 'out', num(a[1], 0.5)); return;
      case 'shake': st.shake(num(a[0], 1)); return;
      case 'music': st.music(a[0]); return;
      case 'sfx': sfx(a[0]); return;
      case 'chapter': G.chapter = num(a[0], G.chapter); expireQuests(G.chapter); await st.chapter(num(a[0]), a.slice(1).join(' ')); return;
      case 'give': st.give(a[0], num(a[1], 1)); return;
      case 'take': G.items[a[0]] = Math.max(0, (G.items[a[0]] ?? 0) - num(a[1], 1)); if (!G.items[a[0]]) delete G.items[a[0]]; return;
      case 'gilt': {
        const n = num(a[0]);
        G.gilt = Math.max(0, G.gilt + n);
        toast(`${n >= 0 ? '+' : ''}${n} gilt`, C.amb3);
        sfx(n >= 0 ? 'loot' : 'buy');
        return;
      }
      case 'xp': {
        const n = num(a[0]);
        toast(`+${n} XP`, C.cyan3);
        const ups = grantXp(n);
        for (const u of ups) { toast(`${u.id === 'hero' ? G.heroName : G.roster[u.id].name} hit level ${u.level}`, C.amb3); sfx('levelup'); }
        return;
      }
      case 'join': st.join(a[0]); return;
      case 'leave': st.leave(a[0]); return;
      case 'approve': {
        for (let i = 0; i + 1 < a.length; i += 2) st.approve(a[i], num(a[i + 1]));
        return;
      }
      case 'quest': st.quest(a[0], a[1], a[2]); return;
      case 'rep': addRep(a[0], num(a[1])); return;
      case 'lore': unlockLore(a[0]); return;
      case 'rel': addRel(a[0], a[1], num(a[2])); return;
      case 'travel': await st.travel(); return;
      case 'perk': { const m = G.roster[a[0]]; if (m && !m.perks.includes(a[1])) m.perks.push(a[1]); return; }
      case 'fight': { const won = await st.fight(a[0]); if (!won) return 'end'; return; }
      case 'hostile': { const won = await st.hostile(a[0], a[1]); if (!won) return 'end'; return; }
      case 'shop': await st.shop(a[0]); return;
      case 'rest': await st.rest(); return;
      case 'name': await st.nameEntry(a[0]); return;
      case 'hold': G.port.hold = Math.max(0, G.port.hold + num(a[0])); return;
      case 'self': G.port.self = Math.max(0, G.port.self + num(a[0])); if (num(a[0]) > 0) toast(`${G.port.name} keeps this.`, C.cyan4); return;
      case 'mood': { const m = G.roster[a[0]]; if (m) m.mood = a[1] as never; return; }
      case 'check': {
        const sk = SKILL_BY_NAME[a[0].toLowerCase()];
        const ok = await partyCheck(sk, num(a[1], 1));
        const i = a.indexOf('->');
        const [p, f] = a.slice(i + 1).join(' ').split('|').map((x) => x.trim());
        return ok ? p : f;
      }
      case 'heal': st.heal(); return;
      case 'edge': for (const m of partyMembers()) m.edge = edgeMax(m); return;
      case 'autosave': st.autosave(); return;
      case 'look': st.look(a[0], a[1]); return;
      case 'toast': toast(a.join(' '), C.pale); return;
      case 'anim': await st.anim(a[0], a.slice(1)); return;
      case 'ending': await st.ending(); return 'end';
      case 'party': await st.anim('party', []); return;
      case 'campmap': G.campMap = a[0]; return;
      case 'cards': {
        const won = await st.cards(a[0]);
        const i = a.indexOf('->');
        if (i < 0) return;
        const [w, l] = a.slice(i + 1).join(' ').split('|').map((x) => x.trim());
        return won ? w : l;
      }
      case 'card': { const { giveCard } = await import('../ui/sluice'); giveCard(a[0]); toast('A Sluice card', C.amb3); return; }
      case 'leavecamp': await st.anim('leavecamp', []); return;
      case 'item': { const it = ITEM.get(a[0]); if (it) toast(it.name, C.pale); return; }
      default: console.warn(`[script] ${scene.id}: unknown command ${L.name}`);
    }
  };
  if (L.bg) { void run(); return; }
  return run();
}

export function loadScripts(files: Record<string, string>) {
  SCENES.clear();
  for (const [name, src] of Object.entries(files)) parseScripts(name, src);
}
