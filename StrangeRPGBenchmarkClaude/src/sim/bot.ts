import { Ctx, BattleOpts, BattleResult } from '../game/script';
import type { GameState, Dir, MemberState } from '../game/state';
import { grantXp, addItem, fullStats, healAll, save } from '../game/state';
import { World, DIRS, Ent, TINT_MAPS } from '../game/world';
import { MAPS, CHAPTERS, RouteStep } from '../maps';
import { Rng } from '../core/rng';
import { simBattle, Outcome } from './battlesim';
import { SHOPS } from '../data/shops';
import { ITEMS, WEAPON_POWER } from '../data/items';
import { MEMBERS } from '../data/members';
import { SKILLS } from '../data/skills';
import { GROUPS } from '../data/enemies';
import type { Hue } from '../core/palette';
import type { SpriteSpec } from '../core/sprites';

export class BotStuck extends Error {}

export interface BattleRecord {
  ch: number;
  group: string;
  scripted: boolean;
  boss: boolean;
  result: string;
  partyTurns: number;
  minFrac: number;
  hpLost: number;
  lvl: number;
  retries: number;
  clashes: number;
  breaks: number;
  damaging: number;
  actions: string[];
}

export interface ChapterLog {
  ch: number;
  startLvl: number;
  endLvl: number;
  bossLvl: number;
  battles: number;
  losses: number;
  grind: number;
  steps: number;
  lines: number;
  words: number;
  goldEarned: number;
  goldSpent: number;
  chests: number;
  choices: number;
  shopVisits: number;
  rests: number;
  errors: string[];
  snapshots: Record<string, string>;
}

function words(t: string): number {
  return t.replace(/\^./g, '').split(/\s+/).filter(Boolean).length;
}

export class Bot extends Ctx {
  world!: World;
  rng: Rng;
  battles: BattleRecord[] = [];
  chapters: Record<number, ChapterLog> = {};
  encSteps = 0;
  depth = 0;
  choicePlan: ((q: string, opts: string[]) => number) | null = null;

  constructor(st: GameState, public seed: number) {
    super(st);
    this.rng = new Rng(seed);
    this.world = new World(MAPS[st.map], st);
  }

  get log(): ChapterLog {
    const n = this.st.chapter;
    if (!this.chapters[n]) {
      const lvl = this.st.members[this.st.party[0]]?.lvl ?? 1;
      this.chapters[n] = { ch: n, startLvl: lvl, endLvl: lvl, bossLvl: 0, battles: 0, losses: 0, grind: 0, steps: 0, lines: 0, words: 0, goldEarned: 0, goldSpent: 0, chests: 0, choices: 0, shopVisits: 0, rests: 0, errors: [], snapshots: {} };
    }
    return this.chapters[n];
  }

  lvl(): number {
    const ids = this.st.party;
    return Math.round(ids.reduce((s, id) => s + this.st.members[id].lvl, 0) / ids.length);
  }

  // ---------- UI half of Ctx ----------

  async say(_who: string, text: string) {
    this.log.lines++;
    this.log.words += words(text);
  }

  async ask(q: string, opts: string[]): Promise<number> {
    this.log.choices++;
    this.log.words += words(q);
    return this.choicePlan ? this.choicePlan(q, opts) : 0;
  }

  async battle(group: string, o: BattleOpts = {}): Promise<BattleResult> {
    return this.fight(group, true, o);
  }

  async fight(group: string, scripted: boolean, o: BattleOpts = {}): Promise<BattleResult> {
    const boss = GROUPS[group]?.enemies.some(e => e.startsWith('grey_') || GROUPS[group].flee === false) ?? false;
    const snap = JSON.stringify(this.st);
    if (scripted) this.log.snapshots[group] = snap;
    let retries = 0;
    for (;;) {
      const tile = this.world.tile(this.st.x, this.st.y, this.st);
      const out = simBattle(this.st, group, 'smart', this.rng.int(1, 1e9), { survive: o.survive, greyField: !!tile.greyzone, commit: true });
      this.log.battles++;
      this.record(group, scripted, boss, out, retries);
      if (out.result === 'win') {
        const rw = out.battle.rewards();
        const goldMul = out.battle.party.some(p => p.traits.has('gold')) ? 1.25 : 1;
        const gold = Math.round(rw.gold * goldMul);
        this.st.gold += gold;
        this.log.goldEarned += gold;
        for (const d of rw.drops) addItem(this.st, d);
        for (const id of [...this.st.party, ...this.st.reserve]) if (this.st.members[id].hp <= 0) this.st.members[id].hp = 1;
        grantXp(this.st, rw.xp);
        if (boss) this.log.bossLvl = this.lvl();
        this.fieldCare();
        if (!scripted && this.partyFrac() < 0.35) await this.restAtLamp();
        return 'win';
      }
      if (o.canLose) { this.fieldCare(); return 'lose'; }
      this.log.losses++;
      Object.assign(this.st, JSON.parse(snap));
      retries++;
      if (retries >= 2) await this.grind(retries);
      if (retries > 12) throw new BotStuck(`Cannot win ${group} at level ${this.lvl()}`);
    }
  }

  private record(group: string, scripted: boolean, boss: boolean, out: Outcome, retries: number) {
    this.battles.push({
      ch: this.st.chapter, group, scripted, boss, result: out.result, partyTurns: out.partyTurns,
      minFrac: +out.minFrac.toFixed(3), hpLost: +out.hpLost.toFixed(3), lvl: this.lvl(), retries,
      clashes: out.clashes, breaks: out.breaks, damaging: out.damaging, actions: out.actions,
    });
  }

  partyFrac(): number {
    let hp = 0, max = 0;
    for (const id of this.st.party) { const m = this.st.members[id]; hp += Math.max(0, m.hp); max += fullStats(m).hp; }
    return hp / Math.max(1, max);
  }

  private resting = false;

  /** Walks back to the nearest lit lamp on this map and rests, as a player low on health would. */
  async restAtLamp() {
    if (this.resting) return;
    this.resting = true;
    try {
      const w = this.world;
      const lamps = w.ents.filter(e => e.def.kind === 'lamp' && !e.hidden && this.st.flags[`lit:${w.def.id}:${e.def.id}`]);
      for (const lamp of lamps.sort((a, b) => Math.abs(a.x - this.st.x) + Math.abs(a.y - this.st.y) - (Math.abs(b.x - this.st.x) + Math.abs(b.y - this.st.y)))) {
        const moves = this.path((x, y) => Math.abs(x - lamp.x) + Math.abs(y - lamp.y) === 1, this.avoidSet());
        if (!moves) continue;
        await this.walk(moves);
        if (this.st.map !== w.def.id) return;
        if (Math.abs(this.st.x - lamp.x) + Math.abs(this.st.y - lamp.y) === 1) { healAll(this.st); this.log.rests++; }
        return;
      }
    } finally {
      this.resting = false;
    }
  }

  /** Fights random encounters on the current map until a level-up. */
  async grind(tries: number) {
    const enc = this.world.def.enc ?? this.lastEnc;
    healAll(this.st);
    if (!enc) return;
    const start = this.lvl();
    for (let i = 0; i < 20 && this.lvl() <= start; i++) {
      const g = this.rng.weighted(enc.groups, x => x[1])[0];
      this.log.grind++;
      await this.fight(g, false);
      healAll(this.st);
    }
    void tries;
  }

  lastEnc: { rate: number; groups: [string, number][] } | undefined;

  async warp(map: string, marker: string, dir?: Dir) {
    const def = MAPS[map];
    if (!def) throw new BotStuck('Unknown map ' + map);
    if (this.world.def.enc) this.lastEnc = this.world.def.enc;
    this.world = new World(def, this.st);
    const [x, y] = this.world.marker(marker);
    this.st.map = map;
    if (!TINT_MAPS.has(map)) this.st.tint = '';
    this.st.x = x;
    this.st.y = y;
    if (dir) this.st.facing = dir;
    this.encSteps = 0;
    if (def.enter) await def.enter(this);
  }

  async fadeOut() {}
  async fadeIn() {}
  async wait() {}
  async card() {}
  async flash() {}
  async ending() {}
  sfx() {}
  music() {}
  shake() {}
  face(d: Dir) { this.st.facing = d; }
  refresh() { this.world.refresh(this.st); }
  greyWorld() {}
  save() { save(this.st); }
  title() { this.finished = true; }
  finished = false;

  setEnt(id: string, patch: { hidden?: boolean; spr?: SpriteSpec }) {
    if (patch.hidden !== undefined) this.st.flags[`hide:${this.world.def.id}:${id}`] = patch.hidden ? true : 'show';
    this.world.refresh(this.st);
  }

  async moveEnt(id: string, path: string) {
    const e = this.world.ent(id);
    if (!e) return;
    for (const c of path) {
      const [dx, dy] = DIRS[c === 'u' ? 'up' : c === 'd' ? 'down' : c === 'l' ? 'left' : 'right'];
      e.x += dx;
      e.y += dy;
    }
  }

  async movePlayer(path: string) {
    for (const c of path) {
      const [dx, dy] = DIRS[c === 'u' ? 'up' : c === 'd' ? 'down' : c === 'l' ? 'left' : 'right'];
      this.st.x += dx;
      this.st.y += dy;
    }
  }

  async shop(id: string) {
    this.log.shopVisits++;
    const stock = id === 'vend' ? [] : SHOPS[id]?.items ?? [];
    const st = this.st;
    const all = [...st.party, ...st.reserve];
    for (const mid of all) {
      const m = st.members[mid];
      const type = MEMBERS[mid].weapon;
      const cur = ITEMS[m.weapon]?.equip;
      const curPow = (cur?.str ?? 0) + (cur?.mnd ?? 0);
      let best: string | null = null;
      let bestPow = curPow;
      for (const it of stock) {
        const e = ITEMS[it]?.equip;
        if (!e || e.slot !== 'weapon' || e.type !== type || e.hue) continue;
        const pow = (e.str ?? 0) + (e.mnd ?? 0);
        if (pow > bestPow && ITEMS[it].price <= st.gold) { best = it; bestPow = pow; }
      }
      if (best) {
        st.gold -= ITEMS[best].price;
        this.log.goldSpent += ITEMS[best].price;
        if (m.weapon) st.gold += Math.floor((ITEMS[m.weapon]?.price ?? 0) / 2);
        m.weapon = best;
      }
    }
    const buy = (id2: string, want: number) => {
      if (!stock.includes(id2)) return;
      while ((st.items[id2] ?? 0) < want && st.gold >= ITEMS[id2].price) {
        st.gold -= ITEMS[id2].price;
        this.log.goldSpent += ITEMS[id2].price;
        addItem(st, id2);
      }
    };
    const heals = ['honey', 'candle', 'tallow'].filter(h => stock.includes(h));
    if (heals[0]) buy(heals[0], 5);
    buy('relight', 2);
    buy(stock.includes('ink_well') ? 'ink_well' : 'ink_vial', 3);
    buy('pin', 1);
    for (const it of stock) {
      const e = ITEMS[it]?.equip;
      if (!e || e.slot !== 'charm' || ITEMS[it].price > st.gold * 0.35) continue;
      const who = all.find(x => !st.members[x].charm);
      if (!who) break;
      st.gold -= ITEMS[it].price;
      this.log.goldSpent += ITEMS[it].price;
      st.members[who].charm = it;
    }
  }

  /** What a careful player does between fights: revive, heal with skills, then items. */
  fieldCare() {
    const st = this.st;
    const all = [...st.party, ...st.reserve].map(id => st.members[id]);
    for (const m of all) {
      if (m.hp > 0) continue;
      const nona = st.members.nona;
      if (nona && nona.hp > 0 && nona.tails > 0 && nona.ink >= 4 && (st.party.includes('nona') || st.reserve.includes('nona'))) {
        nona.tails--; nona.ink -= 4; m.hp = Math.round(fullStats(m).hp * 0.5);
      } else if ((st.items.relight ?? 0) > 0) {
        addItem(st, 'relight', -1); m.hp = Math.round(fullStats(m).hp * 0.4);
      }
    }
    for (let guard = 0; guard < 30; guard++) {
      const hurt = all.filter(m => m.hp > 0 && m.hp < fullStats(m).hp * 0.65).sort((a, b) => a.hp / fullStats(a).hp - b.hp / fullStats(b).hp);
      if (!hurt.length) break;
      const t = hurt[0];
      const caster = all.find(m => m.hp > 0 && ['patch', 'firmware'].some(s => this.knows(m, s) && m.ink >= (SKILLS[s].ink ?? 0) + 2));
      if (caster) {
        const s = this.knows(caster, 'firmware') && hurt.length >= 2 && caster.ink >= 11 ? 'firmware' : 'patch';
        const amt = Math.round(fullStats(caster).mnd * (SKILLS[s].power ?? 1) + 2);
        caster.ink -= SKILLS[s].ink ?? 0;
        const targets = s === 'firmware' ? all.filter(m => m.hp > 0) : [t];
        for (const x of targets) x.hp = Math.min(fullStats(x).hp, x.hp + amt);
        continue;
      }
      if (t.hp < fullStats(t).hp * 0.4) {
        const item = ['tallow', 'candle', 'honey'].find(i => (st.items[i] ?? 0) > 0);
        if (item) { addItem(st, item, -1); t.hp = Math.min(fullStats(t).hp, t.hp + (ITEMS[item].use?.heal ?? 0)); continue; }
      }
      break;
    }
    for (const m of all) {
      const f = fullStats(m);
      if (m.hp > 0 && m.ink < f.ink * 0.2) {
        const item = ['ink_vial', 'ink_well'].find(i => (st.items[i] ?? 0) > 0);
        if (item) { addItem(st, item, -1); m.ink = Math.min(f.ink, m.ink + (ITEMS[item].use?.ink ?? 0)); }
      }
    }
    for (const [id, n] of Object.entries(st.items)) {
      const e = ITEMS[id]?.equip;
      if (!e || n <= 0 || e.slot !== 'charm') continue;
      const who = [...st.party, ...st.reserve].find(x => !st.members[x].charm);
      if (who) { st.members[who].charm = id; addItem(st, id, -1); }
    }
  }

  private knows(m: MemberState, skill: string): boolean {
    return MEMBERS[m.id].learn.some(([l, s]) => s === skill && l <= m.lvl);
  }

  // ---------- Navigation ----------

  private key(x: number, y: number, tint: string, past: boolean) {
    return `${x},${y},${tint},${past ? 1 : 0}`;
  }

  /** Simulates stepping in a direction from a hypothetical state, following belts and paint. */
  private stepFrom(x: number, y: number, tint: Hue | '', past: boolean, d: Dir, avoid: Set<string>): { x: number; y: number; tint: Hue | '' } | null {
    const w = this.world;
    const fake = { ...this.st, tint, past } as GameState;
    const [dx, dy] = DIRS[d];
    let nx = x + dx, ny = y + dy;
    if (!w.passable(nx, ny, fake)) return null;
    if (avoid.has(`${nx},${ny}`)) return null;
    let t = tint;
    for (let i = 0; i < 60; i++) {
      const tile = w.tile(nx, ny, { ...fake, tint: t } as GameState);
      if (tile.paint) t = tile.paint;
      if (!tile.belt) break;
      const [bx, by] = DIRS[tile.belt];
      if (!w.passable(nx + bx, ny + by, { ...fake, tint: t } as GameState) || avoid.has(`${nx + bx},${ny + by}`)) break;
      nx += bx; ny += by;
    }
    return { x: nx, y: ny, tint: t };
  }

  /** Breadth-first search to any goal tile. Returns a list of moves, where 'c' means a time shift. */
  path(goal: (x: number, y: number) => boolean, avoid: Set<string>): string[] | null {
    const st = this.st;
    const canShift = !!this.world.def.past && !!st.items.sundial;
    const start = { x: st.x, y: st.y, tint: st.tint, past: st.past };
    const q = [start];
    const prev = new Map<string, { k: string; m: string } | null>();
    const k0 = this.key(start.x, start.y, start.tint, start.past);
    prev.set(k0, null);
    while (q.length) {
      const c = q.shift()!;
      const ck = this.key(c.x, c.y, c.tint, c.past);
      if (goal(c.x, c.y)) {
        const moves: string[] = [];
        let k: string | null = ck;
        while (k && prev.get(k)) { const p: { k: string; m: string } = prev.get(k)!; moves.unshift(p.m); k = p.k; }
        return moves;
      }
      const nexts: { s: typeof c; m: string }[] = [];
      for (const d of ['up', 'down', 'left', 'right'] as Dir[]) {
        const r = this.stepFrom(c.x, c.y, c.tint, c.past, d, avoid);
        if (r) nexts.push({ s: { x: r.x, y: r.y, tint: r.tint, past: c.past }, m: d });
      }
      if (canShift) {
        const fake = { ...st, tint: c.tint, past: !c.past } as GameState;
        const t = this.world.tile(c.x, c.y, fake);
        if (!t.solid || this.world.passable(c.x, c.y, fake)) nexts.push({ s: { ...c, past: !c.past }, m: 'c' });
      }
      for (const n of nexts) {
        const nk = this.key(n.s.x, n.s.y, n.s.tint, n.s.past);
        if (prev.has(nk)) continue;
        prev.set(nk, { k: ck, m: n.m });
        q.push(n.s);
      }
    }
    return null;
  }

  private avoidSet(except?: Ent): Set<string> {
    const s = new Set<string>();
    for (const e of this.world.ents) {
      if (e.hidden || e === except) continue;
      if (e.def.kind === 'warp' || e.def.kind === 'trigger') s.add(`${e.x},${e.y}`);
    }
    return s;
  }

  /** Executes moves one tile at a time, with encounters and step triggers. Returns false if a script moved us elsewhere. */
  async walk(moves: string[]): Promise<boolean> {
    const map = this.st.map;
    for (const m of moves) {
      if (this.st.map !== map) return false;
      if (m === 'c') { this.st.past = !this.st.past; this.world.refresh(this.st); continue; }
      const d = m as Dir;
      const [dx, dy] = DIRS[d];
      this.st.facing = d;
      if (!this.world.passable(this.st.x + dx, this.st.y + dy, this.st)) return false;
      this.st.x += dx;
      this.st.y += dy;
      await this.arrive();
    }
    return this.st.map === map;
  }

  private async arrive() {
    const st = this.st;
    st.steps++;
    this.log.steps++;
    for (let i = 0; i < 60; i++) {
      const t = this.world.tile(st.x, st.y, st);
      if (t.paint) st.tint = t.paint;
      const e = this.world.entAt(st.x, st.y);
      if (e && (e.def.kind === 'warp' || e.def.kind === 'trigger')) {
        if (e.def.kind === 'warp' && e.def.to) { await this.warp(e.def.to[0], e.def.to[1], e.def.to[2]); return; }
        if (e.def.step) { await e.def.step(this); return; }
      }
      if (!t.belt) break;
      const [bx, by] = DIRS[t.belt];
      if (!this.world.passable(st.x + bx, st.y + by, st)) break;
      st.x += bx; st.y += by;
    }
    const t = this.world.tile(st.x, st.y, st);
    const enc = this.world.def.enc;
    const safe = this.world.def.dark !== undefined && this.world.ents.some(e => e.def.kind === 'lamp' && !e.hidden && st.flags[`lit:${this.world.def.id}:${e.def.id}`] && Math.hypot(e.x - st.x, e.y - st.y) < 3);
    if (t.enc && enc && !st.flags.noEnc && !safe) {
      this.encSteps++;
      const ramp = Math.max(0, Math.min(1, (this.encSteps - 5) / 8));
      if (this.rng.chance(enc.rate * ramp)) {
        this.encSteps = 0;
        const g = this.rng.weighted(enc.groups, x => x[1])[0];
        await this.fight(g, false);
      }
    }
  }

  /** Walks next to (or onto) an entity and interacts with it. */
  async visit(ent: Ent): Promise<boolean> {
    const onto = ent.def.kind === 'warp' || ent.def.kind === 'trigger';
    for (let attempt = 0; attempt < 6; attempt++) {
      if (this.st.map !== this.world.def.id) return false;
      const avoid = this.avoidSet(ent);
      const goal = onto
        ? (x: number, y: number) => x === ent.x && y === ent.y
        : (x: number, y: number) => Math.abs(x - ent.x) + Math.abs(y - ent.y) === 1;
      const moves = this.path(goal, avoid);
      if (!moves) return false;
      const ok = await this.walk(moves);
      if (onto) return true;
      if (!ok) { if (this.world.ents.indexOf(ent) < 0) return false; continue; }
      if (Math.abs(this.st.x - ent.x) + Math.abs(this.st.y - ent.y) !== 1) continue;
      await this.interact(ent);
      return true;
    }
    return false;
  }

  async interact(e: Ent) {
    const st = this.st;
    const def = e.def;
    if (def.talk) { await def.talk(this); return; }
    const key = `${this.world.def.id}:${def.id}`;
    if (def.kind === 'chest') {
      if (st.flags[`open:${key}`]) return;
      st.flags[`open:${key}`] = true;
      this.log.chests++;
      if (def.item) addItem(st, def.item, def.n ?? 1);
      if (def.gold) { st.gold += def.gold; this.log.goldEarned += def.gold; }
      this.fieldCare();
      return;
    }
    if (def.kind === 'lamp') {
      st.flags[`lit:${key}`] = true;
      healAll(st);
      return;
    }
  }

  /** Opens reachable chests and lights reachable lamps on the current map. */
  async sweep() {
    for (let guard = 0; guard < 20; guard++) {
      const st = this.st;
      const todo = this.world.ents.filter(e => !e.hidden && !e.def.talk && (
        (e.def.kind === 'chest' && !st.flags[`open:${this.world.def.id}:${e.def.id}`]) ||
        (e.def.kind === 'lamp' && !st.flags[`lit:${this.world.def.id}:${e.def.id}`])));
      let did = false;
      for (const e of todo) {
        const map = st.map;
        const avoid = this.avoidSet();
        const moves = this.path((x, y) => Math.abs(x - e.x) + Math.abs(y - e.y) === 1, avoid);
        if (!moves) continue;
        await this.walk(moves);
        if (st.map !== map) return;
        if (Math.abs(st.x - e.x) + Math.abs(st.y - e.y) === 1) { await this.interact(e); did = true; }
      }
      if (!did) return;
    }
  }

  async runRoute(route: RouteStep[]) {
    const swept = new Set<string>();
    for (const step of route) {
      const log = this.log;
      if (this.st.map !== step.map) {
        log.errors.push(`Route expected map ${step.map} but bot is in ${this.st.map} (step ${'ent' in step ? step.ent : step.warp})`);
        return;
      }
      if (!swept.has(this.st.map)) { swept.add(this.st.map); await this.sweep(); }
      const id = 'ent' in step ? step.ent : step.warp;
      const e = this.world.ent(id);
      if (!e) { log.errors.push(`No entity ${id} on ${step.map}`); return; }
      if (e.hidden) { log.errors.push(`Entity ${id} on ${step.map} is hidden at this point`); return; }
      const ok = await this.visit(e);
      if (!ok) { log.errors.push(`Could not reach ${id} on ${step.map} from ${this.st.x},${this.st.y}`); return; }
    }
  }

  async playChapter(n: number) {
    const ch = CHAPTERS[n - 1];
    if (!ch?.route) return;
    const log = this.log;
    log.startLvl = this.lvl();
    try {
      await this.runRoute(ch.route);
    } catch (e) {
      log.errors.push(e instanceof Error ? e.message : String(e));
    }
    this.chapters[n].endLvl = this.st.members[this.st.party[0]]?.lvl ?? 0;
  }
}

export { WEAPON_POWER };
