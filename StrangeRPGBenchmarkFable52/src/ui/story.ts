// Plays scenes from the script on the board, and fires each season's scenes when their conditions are met.
import { BLANK, FIXED, OPEN } from '../rules/types';
import type { CharId, GameEvent, Player, State } from '../rules/types';
import { CHARTER_NAME, HALVES, KIND_NAME, LAW_OF } from '../rules/data';
import { T } from '../rules/tuning';
import { cellName, cellOf, compName, counts, dist, localDef, pcell } from '../rules/board';
import { applyDeal, dealAffordable, emptyDeal, grantHalf } from '../rules/engine';
import type { Campaign, RivalId } from '../rules/campaign';
import { friendOf, nemesisOf, trustOf } from '../rules/campaign';
import { C } from '../gfx/screen';
import { TS, tileX, tileY } from '../art/tiles';
import { G, addFx, inkOf, logLine, pawnTarget, pawnsSettled } from './game';
import { menu, say, sound, wait } from './core';
import type { Co, MenuItem } from './core';
import { SCENES, fill, localLines } from './script';
import type { StoryHooks } from './play';
import { dealLines } from './play';
import { setBattleHook } from './battleview';

const SPEAKER: Record<string, [string, number]> = {
  deed: ['Deed', C.ink], auger: ['Auger', C.auger], offset: ['Offset', C.offset], lot: ['Lot', C.lot], either: ['Either', C.doubt2],
  level: ['The Level', C.bp1], page: ['Page', C.town2], parcel: ['A parcel', C.peak3], act: ['A doer', C.sepia], augur: ['A seer', C.auger],
  offshoot: ['A shoot', C.peak2], teller: ['Teller', C.well2], bar: ['Bar', C.sepia], scale: ['Scale', C.well2], rook: ['Rook', C.peak2],
};

const SEAT_CHARS = ['perch', 'deed', 'auger', 'offset', 'lot', 'either'];

export class Story implements StoryHooks {
  camp: Campaign;
  s: State;
  local: Record<string, number> = {};
  fields: Record<string, string | number> = {};

  constructor(camp: Campaign, s: State) {
    this.camp = camp;
    this.s = s;
    setBattleHook((e) => this.onEvent(e));
  }

  perch(): Player { return this.s.players.find((p) => p.char === 'perch')!; }
  seat(c: string): Player | undefined { return this.s.players.find((p) => p.char === c); }
  flag(k: string): boolean { return !!this.camp.flags[k] || !!this.local[k]; }
  once(k: string): boolean { if (this.camp.flags['t_' + k]) return false; this.camp.flags['t_' + k] = 1; return true; }

  baseFields(): Record<string, string | number> {
    const s = this.s, c = this.camp;
    const holder = s.holder >= 0 ? s.players[s.holder].char : 'deed';
    const cnt = counts(s);
    const me = this.perch();
    let them = 0;
    for (const p of s.players) if (p.idx !== me.idx) them = Math.max(them, cnt[p.idx]);
    const seats = s.players.map((p) => p.char);
    const f: Record<string, string | number> = {
      holder: holder === 'deed' && c.holder === 'office' ? 'the Office' : holder.charAt(0).toUpperCase() + holder.slice(1),
      charter: CHARTER_NAME[s.charter], you: cnt[me.idx], them, n: 7 - me.pegs, col: s.level ? 'ABCDEFG'[s.level.x] : 'D',
      friend: friendOf(c, seats), nemesis: nemesisOf(c, seats), next: CHARTER_NAME[c.charter],
    };
    for (const sheet of c.atlas) {
      const parts: string[] = [];
      for (const k of ['road', 'well', 'town', 'peak'] as const) if (sheet.struck[k]) parts.push(sheet.struck[k] + ' ' + KIND_NAME[k].toLowerCase() + (sheet.struck[k] > 1 ? 's' : ''));
      f['s' + (39 + sheet.season)] = parts.join(', ') || 'nothing';
    }
    return { ...f, ...this.fields };
  }

  cond(expr: string): boolean {
    const neg = expr.startsWith('!');
    const e = neg ? expr.slice(1) : expr;
    const [key, arg] = e.split(':');
    const s = this.s, c = this.camp;
    let v = false;
    if (key === 'flag') v = this.flag(arg);
    else if (key === 'seat') v = !!this.seat(arg);
    else if (key === 'winner') v = !!s.result && s.players[s.result.winner].char === arg;
    else if (key === 'holder') v = s.holder >= 0 && s.players[s.holder].char === arg;
    else if (key === 'whole') v = arg !== 'perch' && (c.rivals[arg as RivalId]?.whole || !!this.seat(arg)?.whole);
    else if (key === 'richest') { const top = s.players.slice().sort((a, b) => b.ink - a.ink)[0]; v = top.char === arg; }
    else if (key === 'perch_measured_more') v = c.measures + this.perch().stats.measures > (c.doubts + this.perch().stats.objections + this.perch().stats.unmeasures) * 3;
    else if (key === 'lot_likes_perch') v = trustOf(c, 'lot', 'perch') >= 0;
    else if (key === 'final_writer') v = !!s.result && s.players[s.result.winner].char === arg;
    return neg ? !v : v;
  }

  anchor(name: string): number {
    const s = this.s;
    const me = this.perch();
    const post = cellOf(3, T.H - 1);
    if (name === 'post') return post;
    if (name === 'perch') return pcell(me);
    if (name.startsWith('start')) {
      const k = Number(name.slice(5));
      if (k === 0) return cellOf(me.sx, me.sy);
      const others = s.players.filter((p) => p.char !== 'perch');
      return others[k - 1] ? cellOf(others[k - 1].sx, others[k - 1].sy) : post;
    }
    const site = s.tiles.findIndex((t) => t.site);
    if (name === 'site') return site >= 0 ? site : cellOf(3, 2);
    if (name === 'near_site') return site >= 0 ? (site % T.W > 0 ? site - 1 : site + 1) : cellOf(2, 2);
    if (name === 'near_auger') { const a = this.seat('auger'); return a ? cellOf(a.x, Math.max(0, a.y - 1)) : post; }
    if (name === 'north_open') return cellOf(me.x, 1);
    if (name === 'level_start') return s.level ? cellOf(s.level.x, s.level.y) : post;
    if (name === 'last_tile') return cellOf(3, 0);
    if (name === 'plot') return cellOf(me.sx, me.sy - 1);
    const m = name.match(/^([A-G])([1-7])$/);
    if (m) return cellOf('ABCDEFG'.indexOf(m[1]), Number(m[2]) - 1);
    return post;
  }

  propAt(key: string, c: number): void {
    const x = tileX(c) + 8, y = tileY(c) + TS - 2;
    const pr = G.props.get(key);
    if (pr) { pr.tx = x; pr.ty = y; pr.hide = false; }
    else G.props.set(key, { key, x, y, tx: x, ty: y, hide: false, open: ['rook', 'teller', 'bar', 'scale'].includes(key) });
  }

  *settle(max = 120): Co<void> {
    for (let i = 0; i < max && !pawnsSettled(); i++) yield;
  }

  *direct(cmd: string, args: string[]): Co<void> {
    const s = this.s;
    const seated = (a: string) => (SEAT_CHARS.includes(a) ? s.players.find((p) => p.char === a) : undefined);
    switch (cmd) {
      case 'place': { const a = args[0]; if (!seated(a) && !(a === 'level')) this.propAt(a, this.anchor(args[1])); break; }
      case 'enter': {
        const a = args[0];
        const pl = seated(a);
        const c = this.anchor(args[1]);
        const fromNorth = args[2] === 'north';
        if (pl) { const t = pawnTarget(s, pl.idx); G.pawns[pl.idx] = { x: t.x, y: t.y + (fromNorth ? -60 : 40) }; }
        else if (a !== 'level') { this.propAt(a, c); const pr = G.props.get(a)!; pr.y = pr.ty + (fromNorth || a === 'either' ? -70 : 40); }
        sound.sfx('step');
        yield* this.settle();
        break;
      }
      case 'walk': { const a = args[0]; if (!seated(a)) { this.propAt(a, this.anchor(args[1])); yield* this.settle(); } break; }
      case 'leave': {
        const pr = G.props.get(args[0]);
        if (pr) { pr.ty = args[1] === 'north' ? -30 : 300; yield* this.settle(140); G.props.delete(args[0]); }
        break;
      }
      case 'show': this.propAt(args[0], this.anchor(args[1] ?? 'site')); yield* wait(10, false); break;
      case 'hide': G.props.delete(args[0]); break;
      case 'strike': {
        G.props.delete('page');
        this.propAt(args[0], this.anchor('plot'));
        const pr = G.props.get(args[0])!;
        yield* wait(20, false);
        pr.ty = -30;
        sound.sfx('doubt');
        yield* this.settle(160);
        G.props.delete(args[0]);
        break;
      }
      case 'sign': {
        const who = fill(args[0], this.baseFields());
        G.signed.push(who);
        addFx({ kind: 'stamp', x: 8 + T.W * TS - 14, y: 20 + T.H * TS - 14, t: 0, life: 24, ink: SEAT_CHARS.includes(who) ? inkOf(who as CharId) : C.perch });
        sound.sfx('stamp');
        yield* wait(30, false);
        break;
      }
      case 'doubt': { const p = this.perch(); p.doubt += 1; addFx({ kind: 'ring', x: G.pawns[p.idx].x + 4, y: G.pawns[p.idx].y - 6, t: 0, life: 24, ink: C.doubt2 }); sound.sfx('doubt'); yield* wait(24, false); break; }
      case 'shadow': G.shadowOff = true; break;
      case 'pinall': {
        const p = this.perch();
        for (const c of p.ret) if (c.fixed === 0 && !c.half && localDef(c.id)) { c.fixed = c.active; logLine(compName(c) + ' is entered.', C.warn); }
        sound.sfx('stamp');
        yield* wait(24, false);
        break;
      }
      case 'smudge': this.camp.smudged = true; sound.sfx('doubt'); break;
      case 'procession': {
        for (let i = 0; i < 6; i++) { addFx({ kind: 'struck', x: 20 + i * 26, y: 60 - (i % 3) * 8, t: 0, life: 70, text: ['road', 'well', 'town', 'peak'][i % 4], ink: C.pencil }); yield* wait(8, false); }
        yield* wait(50, false);
        break;
      }
      case 'fx': if (args[0] === 'measure') { const c = this.anchor(fill(args[1] ?? 'site', this.baseFields())); addFx({ kind: 'sight', x: tileX(c), y: tileY(c), t: 0, life: 16 }); sound.sfx('measure'); yield* wait(20, false); } break;
      case 'play': {
        const id = fill(args[0], this.baseFields()).toLowerCase();
        if (id === 'fates') {
          for (const r of ['deed', 'auger', 'offset', 'lot', 'either'] as RivalId[]) {
            if (!this.camp.rivals[r].met) continue;
            const whole = this.camp.rivals[r].whole || !!this.seat(r)?.whole;
            const tier = whole && r !== 'either' ? 'whole' : trustOf(this.camp, r, 'perch') + (this.seat(r) ? this.s.trust[this.seat(r)!.idx][this.perch().idx] : 0) >= 1 ? 'warm' : 'cold';
            yield* this.play('fate.' + r + '.' + tier);
          }
        } else yield* this.play(id);
        break;
      }
      case 'merge': G.props.delete(args[1]); { const pl = seated(args[0]); if (pl) addFx({ kind: 'ring', x: G.pawns[pl.idx].x + 4, y: G.pawns[pl.idx].y - 6, t: 0, life: 30, ink: C.hi }); } sound.sfx('deal'); yield* wait(30, false); break;
      case 'tilt': case 'open': case 'close': case 'pen': case 'thin': case 'pin': yield* wait(16, false); break;
      case 'fix': for (const t of s.tiles) if (t.st === OPEN) { t.st = FIXED; t.k = t.a; } sound.sfx('measure'); yield* wait(40, false); break;
      case 'unfix': for (const t of s.tiles) if (t.st === FIXED && !t.official) { t.st = OPEN; t.k = null; } sound.sfx('doubt'); yield* wait(40, false); break;
      case 'return': for (let i = 0; i < 5; i++) { addFx({ kind: 'ring', x: 30 + i * 30, y: 40 + (i % 2) * 20, t: 0, life: 40, ink: C.doubt2 }); yield* wait(6, false); } break;
      case 'label': { const c = this.anchor(args[0]); const t = s.tiles[c]; if (t.st === BLANK) { t.st = OPEN; t.a = 'town'; t.b = 'peak'; } else if (t.st === FIXED) { t.st = OPEN; t.k = null; } this.local.labelPerch = 1; yield* wait(30, false); break; }
      case 'atlas': this.local.atlas = 1; break;
      default: break;
    }
  }

  *play(id: string, extra: Record<string, string | number> = {}): Co<void> {
    const lines = SCENES.get(id);
    if (!lines) return;
    const saved = this.fields;
    this.fields = { ...this.fields, ...extra };
    const stack: boolean[] = [];
    const live = () => stack.every(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (ln.k === 'if') { stack.push(this.cond(ln.cond)); continue; }
      if (ln.k === 'else') { if (stack.length) stack[stack.length - 1] = !stack[stack.length - 1]; continue; }
      if (ln.k === 'end') { stack.pop(); continue; }
      if (!live()) continue;
      const f = this.baseFields();
      if (ln.k === 'say') {
        const sp = SPEAKER[ln.who] ?? [ln.who.charAt(0).toUpperCase() + ln.who.slice(1), C.sepia];
        yield* say(sp[0], fill(ln.text, f), sp[1]);
      } else if (ln.k === 'sys') yield* say('', fill(ln.text, f).replace(/^\((.*)\)$/, '$1'), C.sepia, true);
      else if (ln.k === 'dir') yield* this.direct(ln.cmd, ln.args);
      else if (ln.k === 'opt') {
        const opts = [ln];
        while (lines[i + 1] && lines[i + 1].k === 'opt') { i++; opts.push(lines[i] as typeof ln); }
        const items: MenuItem[] = opts.map((o) => ({ label: o.label }));
        const r = opts.length === 1 ? (yield* menu(items, { cancel: false, w: 150 })) : yield* menu(items, { cancel: false, w: 230 });
        const flag = opts[Math.max(0, r)].flag;
        this.local[flag] = 1;
        this.camp.flags[flag] = 1;
      }
    }
    this.fields = saved;
  }

  // ---------------------------------------------------------------- season hooks

  *open(): Co<void> {
    const s = this.s;
    const n = s.season;
    if (n === 1) this.propAt('page', this.anchor('plot'));
    yield* this.play('s' + n + '.open');
    const holder = s.holder >= 0 ? s.players[s.holder].char : null;
    if (holder && holder !== 'perch' && n >= 3) {
      if (holder !== 'deed') yield* this.play('holder.' + holder);
      if (LAW_OF[holder] === s.law && s.law !== 'none') yield* this.play('law.' + holder);
    }
    for (const k of ['deed', 'rook']) G.props.delete(k);
  }

  *close(): Co<void> {
    const s = this.s;
    const res = s.result!;
    const cnt = res.counts;
    const me = this.perch();
    const w = s.players[res.winner];
    const sorted = cnt.slice().sort((a, b) => b - a);
    this.fields = { winner: w.char, d: Math.max(1, Math.round(sorted[0] - (sorted[1] ?? 0))), you: cnt[me.idx], them: Math.max(...cnt.filter((_, i) => i !== me.idx)) };
    if (s.season === 5 && s.level && s.level.alive) yield* this.play('s5.level.unopposed');
    yield* this.play('s' + s.season + '.close');
    if (res.deputies.includes(me.idx) && w.char !== 'perch') yield* this.play('deputy.' + w.char);
  }

  *halfScene(id: string): Co<void> {
    const s = this.s;
    const me = this.perch();
    const scene: Record<string, string> = { parcel: 's2.bank.half', act: 's3.court.half', roost: 's4.quarry.half', augur: 's5.pass.half', offshoot: 's6.legend.half' };
    yield* this.play(scene[id]);
    const walk = this.flag(id === 'roost' ? 'roost_carry' : id + '_walk');
    if (walk) {
      if (!grantHalf(s, me, id)) yield* say('', 'Your party is full. It waits here.', C.sepia, true);
      else if (id === 'roost') this.camp.canBlur = true;
    }
    for (const key of Object.keys(s.halves)) if (s.halves[key] === id && (walk || id === 'roost')) delete s.halves[key];
    if (id === 'roost' && !walk) this.camp.flags.roost_leave = 1;
    G.props.delete(id);
    G.props.delete('page_grown'); G.props.delete('page_blank');
    this.local['half_' + id] = 1;
  }

  save: (() => void) | null = null;

  *onTurn(p: Player): Co<void> {
    const s = this.s;
    if (p.char !== 'perch') return;
    if (this.save && p.steps === T.steps) this.save();
    const n = s.season;
    const here = pcell(p);
    const t = s.tiles[here];
    if (n === 1) {
      if (s.round >= 2 && this.once('s1_count')) yield* this.play('s1.teach.count');
      if (p.stats.measures >= 1 && this.once('s1_sketch')) yield* this.play('s1.teach.sketch');
    } else if (n === 2) {
      if (this.once('s2_local')) {
        yield* this.play('s2.teach.local');
        const c = p.ret.find((x) => localDef(x.id));
        if (c) { const ln = localLines(c.id)[0]; if (ln) yield* say(compName(c), ln, C.sepia); }
      }
      if (p.doubt > 0 && this.once('s2_doubt')) yield* this.play('s2.teach.doubt');
      const auger = this.seat('auger');
      if (s.round >= 2 && auger && this.once('s2_trade')) {
        yield* this.play('s2.teach.trade');
        if (p.doubt >= 2 && auger.ink >= 1) {
          const d = emptyDeal(auger.idx, p.idx);
          d.ink[0] = 1; d.doubt[1] = 2;
          const r = yield* menu([{ label: 'Accept' }, { label: 'Refuse' }], { title: 'Auger offers', w: 220, cancel: false, footer: dealLines(s, d, p.idx).join(' ') });
          if (r === 0 && dealAffordable(s, d)) applyDeal(s, d);
        }
      }
      if (s.tiles.some((x, c) => (x.den || x.peg >= 0) && dist(c, here) <= 2 && x.peg !== p.idx) && this.once('s2_fight')) yield* this.play('s2.teach.fight');
    } else if (n === 3) {
      if (this.once('s3_promise')) yield* this.play('s3.teach.promise');
      if (s.round >= 2 && this.once('s3_claim')) yield* this.play('s3.teach.claim');
      if (s.round === s.rounds && this.once('s3_back')) yield* this.play('s3.teach.back');
    } else if (n === 4) {
      if (this.once('s4_sight')) yield* this.play('s4.quarry.sight', { cell: cellName(this.anchor('site')) });
      if (p.doubt >= 3 && this.once('s4_unmeasure')) yield* this.play('s4.teach.unmeasure');
    } else if (n === 6) {
      if (t.site === 'legend' && !t.den && this.once('s6_amend')) yield* this.play('s6.teach.amend');
    }
    if (t.site && !t.den) {
      for (const id of Object.values(s.halves)) {
        if (this.local['half_' + id] || p.ret.some((c) => c.id === id)) continue;
        if (HALVES.find((h) => h.id === id)) yield* this.halfScene(id);
      }
    }
  }

  *onRound(n: number): Co<void> {
    const s = this.s;
    if (s.season === 3 && (n === 3 || n === 5)) {
      const open: number[] = [];
      for (let c = 0; c < s.tiles.length; c++) { const t = s.tiles[c]; if (t.st === OPEN && t.peg < 0 && !t.den && !t.site) open.push(c); }
      if (!open.length) return;
      const c = open[(s.round * 7 + s.rng) % open.length < 0 ? 0 : Math.abs(s.round * 7 + s.rng) % open.length];
      const t = s.tiles[c];
      s.struck[t.b]++;
      t.st = FIXED; t.k = t.a; t.by = -3;
      yield* this.play(n === 3 ? 's3.nomark.1' : 's3.nomark.2', { cell: cellName(c) });
    }
  }

  *onEvent(e: GameEvent): Co<void> {
    const s = this.s;
    const me = this.perch();
    const n = s.season;
    const mine = e.p === me.idx;
    if (e.t === 'reunion') { const to = s.players[e.q!]; yield* this.play('reunion.' + to.char); this.camp.rivals[to.char as RivalId].whole = true; return; }
    if (e.t === 'strikeHalf') { this.camp.flags['halfStruck_' + e.s] = 1; yield* this.play('strike.half'); return; }
    if (n === 1 && mine) {
      const plot = this.anchor('plot');
      if (e.t === 'move' && pcell(me) === plot && this.once('s1_page')) yield* this.play('s1.page.meet');
      if (e.t === 'measure' && e.c === plot && this.once('s1_measured')) {
        if (e.k === 'town') {
          this.camp.flags.has_page_child = 1;
          yield* this.play('s1.page.town');
          me.ret.push({ id: 'page', fixed: 1, active: 1, down: false, half: true });
        } else {
          this.camp.flags.page_child_struck = 1;
          yield* this.play('s1.page.well');
          me.perks.push('page');
          this.camp.perks.push('page');
        }
        G.props.delete('page');
        if (s.tiles[plot].peg < 0) yield* this.play('s1.teach.peg');
      }
      if (e.t === 'work' && e.s === 'ink' && this.once('s1_work')) yield* this.play('s1.teach.work');
    }
    const siteCell = s.tiles.findIndex((t) => t.site);
    if (mine && e.t === 'move' && siteCell >= 0 && s.tiles[siteCell].den && dist(pcell(me), siteCell) <= 1 && !this.local.guard) {
      this.local.guard = 1;
      const id: Record<number, string> = { 2: 's2.bank.guard', 3: 's3.court.guard', 6: 's6.legend.guard' };
      if (id[n]) yield* this.play(id[n]);
    }
    if (e.t === 'siteWon' && mine) {
      const id: Record<number, string> = { 2: 's2.bank.prize', 3: 's3.court.prize', 6: 's6.legend.prize' };
      if (id[n]) yield* this.play(id[n]);
    }
    if (e.t === 'pin' && s.battle && s.battle.boss === 'teller' && !this.local.tellerPin) {
      const u = s.battle.units[e.q!];
      if (u && u.owner === me.idx) { this.local.tellerPin = 1; yield* this.play('s2.bank.pin', { unit: u.name }); }
    }
    if (n === 4 && e.t === 'object' && e.q === me.idx && this.once('s4_object')) yield* this.play('s4.teach.object', { kind: KIND_NAME[e.k!] });
    if (n >= 5) {
      if (e.t === 'fightStart' && mine && s.battle && s.battle.units.some((u) => u.key === 'level') && !this.local.levelFight) { this.local.levelFight = 1; yield* this.play('s5.level.fight'); }
      if (e.t === 'pin' && s.battle && s.battle.units[e.p!]?.key === 'level' && !this.local.levelPin) { this.local.levelPin = 1; yield* this.play('s5.level.pin', { unit: s.battle.units[e.q!].name }); }
      if (e.t === 'levelDown') { if (mine) yield* this.play('s5.level.won'); this.camp.levelNorth = false; }
      if (e.t === 'fightEnd' && mine && this.local.levelFight && !e.n && s.level && s.level.alive && !this.local.levelLost) { this.local.levelLost = 1; yield* this.play('s5.level.lost'); }
    }
  }

  extraActions(): { label: string; hint: string; run: () => Co<void> }[] { return []; }
}
