// The controller: story commands, battles, chapters, and moving between maps.
import { parse } from '../cant/parser';
import { VERBS } from '../cant/vocab';
import { sfx } from '../engine/audio';
import { app } from './app';
import { encounterOf } from './battle';
import { BattleView } from './battleView';
import { Dialogue, StoryHost } from './dialogue';
import { Editor } from './editor';
import { Field } from './field';
import { PauseMenu, RoteList } from './menu';
import { ChapterCard, Credits, LecternMenu, Overlay, TitleScreen, wrapLines } from './screens';
import { Splash } from './splash';
import { GNODE } from './grammar';
import { ALLIES } from './enemies';
import { MarginBook } from './marginView';
import { Shop } from './shop';
import { grantCard, startStet } from './stet';
import { music } from '../engine/music';
import { PAGE_COLORS, allyMax, blankStats, learn, lender, loadGame, newGame, restAll, saveGame } from './state';
import { C, Menu, panel } from './ui';
import { text } from '../engine/font';
import { tapped } from '../engine/input';
import { Scene } from './app';

const CHAPTER_START: Record<number, [string, number, number]> = {
  1: ['busy', 14, 11],
  2: ['river', 3, 20],
  3: ['twice', 2, 12],
  4: ['ears', 2, 14],
  5: ['rung1', 9, 16],
  6: ['millrace', 19, 19],
  7: ['busy', 14, 11],
  8: ['river', 3, 20],
  9: ['ears', 2, 14],
  10: ['scriv1', 9, 18],
};

let said = '';

const host: StoryHost = {
  flag: (f) => !!app.s.flags[f],
  fill: (t) => t.replace(/\{(\w+)\}/g, (_, k) => {
    const own = app.s.pages.filter((p) => !p.fixed);
    if (k === 'page1') return own[0]?.name ?? 'wait';
    if (k === 'page2') return own[1]?.name ?? own[0]?.name ?? 'wait';
    if (k === 'said') return said;
    if (k === 'child_line') return app.s.childLine || '(nothing)';
    if (k === 'halt_line') return app.s.allyLines.halt || '(nothing)';
    if (k === 'gloss_line') return app.s.allyLines.gloss || '(nothing)';
    return k;
  }),
  command: (cmd, args, done) => game.command(cmd, args, done),
};

export const game = {
  field: null as Field | null,

  boot() {
    app.reset(new Splash(() => this.title()));
  },

  title() {
    app.reset(new TitleScreen((cont) => (cont ? this.continueGame() : this.newGame())));
  },

  newGame() {
    app.s = newGame();
    this.field = new Field();
    this.field.load('busy', 14, 11, 0);
    app.reset(this.field);
  },

  continueGame() {
    const s = loadGame();
    if (!s) { this.newGame(); return; }
    app.s = s;
    this.field = new Field();
    this.field.load(s.map, s.x, s.y, s.dir);
    app.reset(this.field);
  },

  play(scene: string, onDone?: () => void) {
    app.s.flags[`seen_${scene}`] = true;
    app.push(new Dialogue(scene, host, onDone));
  },

  /** Plays several scenes in a row. */
  chain(scenes: string[], done: () => void) {
    if (!scenes.length) { done(); return; }
    this.play(scenes[0], () => this.chain(scenes.slice(1), done));
  },

  goto(map: string, x: number, y: number, dir = 0) {
    if (!this.field) return;
    this.field.load(map, x, y, dir);
    this.field.runEnterScenes();
  },

  openMenu() { app.push(new PauseMenu()); },

  lectern() {
    app.push(new LecternMenu(() => {
      restAll(app.s);
      const ok = saveGame(app.s);
      sfx.heal();
      this.field?.say(ok ? 'Rested. Saved.' : 'Rested. (Saving failed.)', C.good);
    }, () => app.push(new RoteList()), app.s.flags.met_gloss ? () => app.push(new MarginBook()) : undefined));
  },

  give(item: string) {
    const s = app.s;
    const named: Record<string, string> = {
      primer1: 'the First Primer', primer1_repeat: 'the torn page', primer2: 'the Second Primer', primer3: 'the Third Primer',
      primer4: 'the Listening Primer', red_primer: 'Once\'s notebook', second_hand: 'the Second Hand', salve: 'a salve', inkpot: 'an inkpot', bell: 'a bell', mark: 'a mark', deep: 'a deep pot', thick: 'a thick page', blanks20: '20 blanks',
    };
    switch (item) {
      case 'primer1': learn(s, 'strike', 'mend', 'ward', 'say'); break;
      case 'primer1_repeat': learn(s, 'repeat'); s.flags.got_repeat = true; break;
      case 'primer2': learn(s, 'if', 'else', 'soak', 'jolt'); break;
      case 'primer3': learn(s, 'let', 'count', 'first', 'last'); break;
      case 'red_primer': learn(s, 'erase'); break;
      case 'second_hand': s.items.second_hand = 1; break;
      case 'mark': s.marks++; break;
      case 'blanks20': s.blanks += 20; break;
      default: s.items[item] = (s.items[item] ?? 0) + 1; break;
    }
    if (item.startsWith('primer') || item === 'red_primer') if (!s.primers.includes(item)) s.primers.push(item);
    sfx.get();
    this.field?.say(`Got ${named[item] ?? item}.`, C.again);
  },

  battle(enc: string, cb: ((r: 'win' | 'lose' | 'fled') => void) | null, done?: () => void) {
    const v = new BattleView(enc, (r, view) => {
      if (r === 'lose') {
        const saved = loadGame();
        if (saved) { app.s = saved; this.field = new Field(); this.field.load(saved.map, saved.x, saved.y, saved.dir); app.reset(this.field); }
        else this.title();
        return;
      }
      cb?.(r);
      const scenes: string[] = [];
      for (const f of view.b.foes) {
        if (f.freed && f.def?.freeScene) scenes.push(f.def.freeScene);
      }
      if (view.b.foes.some((f) => !f.freed && !f.up && f.def?.freeScene)) scenes.push('c6_beaten');
      const after = encounterOf(enc)?.after;
      if (r === 'win' && after) scenes.push(after);
      this.chain(scenes, () => { this.field?.spawnActors(); done?.(); });
    }, this.field?.map.region ?? 'busy');
    app.push(v);
  },

  showGoal() {
    app.push(new Overlay('Now', wrapLines(goal()).map((l) => ({ ...l, color: C.text }))));
  },

  /** After Act 1's credits: that night, in Busy. */
  beginAct2() {
    const s = app.s;
    this.field = new Field();
    this.field.load('busy', s.flags.stood_spot ? 14 : 2, 11, 1);
    this.field.locked = true;
    app.reset(this.field);
    this.play('a2_prologue');
  },

  /** Seven years later. Wait's pages have faded, the level is gone, the words stay. */
  startAct2() {
    const s = app.s;
    s.flags.act2 = true;
    s.pages = [{ id: 'p0', name: 'wait', src: s.pages[0]?.src ?? 'wait  # until it stops', color: 0, fixed: true, stats: blankStats() }];
    s.pageSeals = {};
    s.level = 1;
    s.xp = 0;
    s.marks = 0;
    s.grammar = s.grammar.filter((id) => (GNODE[id]?.words?.length ?? 0) > 0);
    s.party = [];
    s.flags.gloss_with = false;
    for (const k of Object.keys(s.flags)) if (k.startsWith('lent_')) s.flags[k] = false;
    restAll(s);
    if (this.field) this.field.locked = false;
  },

  startChapter(n: number) {
    const s = app.s;
    s.chapter = n;
    s.flags[`chapter${n}`] = true;
    restAll(s);
    const [map, x, y] = n === 7 && !s.flags.stood_spot ? ['busy', 2, 11] as const : CHAPTER_START[n];
    if (this.field) { this.field.load(map, x, y, 1); this.field.runEnterScenes(); }
    saveGame(s);
  },

  command(cmd: string, args: string[], done: (jump?: string) => void) {
    const s = app.s;
    const f = this.field;
    switch (cmd) {
      case 'control':
        if (f) { f.locked = args[0] === 'off'; f.lockPresses = 0; f.lockTimer = 0; }
        done();
        return;
      case 'sync': s.flags.sync = args[0] === 'on'; done(); return;
      case 'show_rote':
        s.flags.rote_opened = true;
        app.push(new Overlay('Wait\'s rote', [
          ...s.pages[0].src.split('\n').map((l) => ({ s: l, code: true })),
          { s: '' }, { s: '' }, { s: '(room)', color: C.faint },
        ], () => done()));
        return;
      case 'tutorial_write':
        learn(s, 'strike');
        if (s.pages.length < 2) s.pages.push({ id: 'p1', name: 'hit', src: '', color: 1, stats: blankStats() });
        app.push(new Editor(1, 'tutorial', () => done()));
        return;
      case 'give': this.give(args[0]); done(); return;
      case 'set': s.flags[args[0]] = true; done(); return;
      case 'once': {
        s.flags[`once_${args[0]}`] = true;
        const n = [1, 2, 3, 4, 5, 6, 7].filter((k) => s.flags[`once_${k}`]).length;
        if (n === 7) s.flags.once_all = true;
        this.field?.say(n === 7 ? 'All seven of Once\'s pages.' : `${n} of Once's pages.`, C.kw);
        music.stinger('secret');
        done();
        return;
      }
      case 'unset': delete s.flags[args[0]]; done(); return;
      case 'word': {
        const w = args[0];
        const k = lender(w);
        if (k && s.party.includes(k)) s.flags[`lent_${w}`] = true;
        else learn(s, w);
        sfx.get();
        done();
        return;
      }
      case 'unword': {
        const w = args[0];
        s.flags[`lent_${w}`] = false;
        s.words = s.words.filter((x) => x !== w);
        done();
        return;
      }
      case 'join': {
        const k = args[0];
        if (k !== 'gloss' && !s.party.includes(k)) { s.party.push(k); s.allyHp[k] = allyMax(s, k); }
        if (k === 'gloss') s.flags.gloss_with = true;
        const lends = ALLIES[k]?.lends;
        if (s.chapter >= 7 && lends) s.flags[`lent_${lends}`] = true;
        grantCard(k);
        sfx.get();
        done();
        return;
      }
      case 'leave': s.party = s.party.filter((k) => k !== args[0]); done(); return;
      case 'battle': this.battle(args[0], null, () => done()); return;
      case 'stet': startStet(args[0], () => done()); return;
      case 'sting': music.stinger(args[0] as 'ending'); done(); return;
      case 'theme': music.play(args[0] as 'theme_room'); done(); return;
      case 'shop':
        app.push(args[0] === 'weigh'
          ? new Shop('Weigh', 'weigh', 'Weighs each blank before taking it. Weighs each thing before giving it.', done)
          : new Shop('Carry', 'carry', 'The cart is full of blank pages. Carry sells everything else.', done,
            (map, x, y) => this.goto(map, x, y), this.field?.map.region ?? ''));
        return;
      case 'end_chapter': {
        const n = Number(args[0]);
        s.flags[`c${n}_done`] = true;
        app.push(new ChapterCard(n + 1, () => { this.startChapter(n + 1); done(); }));
        return;
      }
      case 'unlock': s.flags[`${args[0]}_open`] = true; done(); return;
      case 'read_book': {
        const lines = s.pages.filter((p) => !p.fixed).map((p) => ({ s: `${p.name} ... copied`, color: 0xc8ff2e }));
        app.push(new Overlay('Again reads your rote', lines.length ? lines : [{ s: 'there is nothing to copy', color: C.dim }], () => done(), 20));
        return;
      }
      case 'finish_aside':
        s.pages[0].src = 'wait  # until it stops';
        s.aside = 'until it stops';
        app.push(new Overlay('Wait\'s rote, page 1', [{ s: 'wait  # until it stops', code: true }], () => done(), 0));
        return;
      case 'write_line':
        app.push(new Editor(0, 'oneline', (_c, line) => {
          const l = (line ?? '').trim();
          if (args[0] === 'halt') { s.allyLines.halt = l; done(lineScene('c7_halt', l)); return; }
          if (args[0] === 'gloss') { s.allyLines.gloss = l; done(); return; }
          s.childLine = l;
          done(lineScene('c6_child', l));
        }));
        return;
      case 'seal_wait':
        s.pages[0].src = 'wait  # until it stops\nhalt  # short is kind.';
        done();
        return;
      case 'unseal_wait':
        s.pages[0].src = 'wait  # until it stops\n# halt  # short is kind.';
        done();
        return;
      case 'act2':
        this.startAct2();
        app.push(new ChapterCard(7, () => this.startChapter(7)));
        done();
        return;
      case 'goto_map':
        this.goto(args[0], Number(args[1]), Number(args[2]));
        done();
        return;
      case 'write_rule':
        app.push(new Overlay('The Scrivener\'s rule', [
          { s: 'write the first line', code: true },
          { s: 'leave the last line blank', code: true },
          { s: '  # for them', code: true },
        ], () => done(), 30));
        return;
      case 'end_game2':
        saveGame(s);
        this.play('coda');
        done();
        return;
      case 'credits2':
        s.flags.act2_done = true;
        saveGame(s);
        app.reset(new Credits(2));
        return;
      case 'trade_page':
        if (!s.library.length) { done(); return; }
        app.push(new TradePicker((i) => { s.library.splice(i, 1); done(); }));
        return;
      case 'end_game':
        saveGame(s);
        app.reset(new Credits(1, () => this.beginAct2()));
        return;
      default:
        console.warn('unknown command', cmd, args);
        done();
    }
  },
};

/** The scene that answers a typed line, by what kind of line it is. */
function lineScene(prefix: string, line: string): string {
  if (!line) return `${prefix}_empty`;
  const prog = parse(line);
  if (prog.diags.some((d) => d.sev === 'error')) return `${prefix}_error`;
  const st = prog.stmts[0];
  if (!st) return `${prefix}_empty`;
  switch (st.k) {
    case 'wait': return `${prefix}_wait`;
    case 'say': said = st.args[0]?.k === 'str' ? st.args[0].v : line.replace(/^say\s+/, ''); return `${prefix}_say`;
    case 'halt': return `${prefix}_halt`;
    case 'again': return `${prefix}_again`;
    case 'repeat': case 'each': return `${prefix}_loop`;
    case 'verb': return VERBS[st.verb]?.kind === 'help' ? `${prefix}_help` : `${prefix}_harm`;
    default: return `${prefix}_other`;
  }
}

function goal(): string {
  const s = app.s;
  const F = s.flags;
  switch (s.chapter) {
    case 1:
      if (!F.met_gloss) return 'Wait.';
      if (!F.straw_done) return 'Hit Straw, by the well. Read it first: face it and press R.';
      if (!F.grind_done) return 'Go under the mill. The door is behind the wheel, on the east side of the square.';
      return 'Go to the gate on the west side of Busy.';
    case 2:
      if (!F.standing_seen) return 'Walk up the river.';
      if (!F.has_primer2) return 'Standing is dark. Cast to see. Find the school.';
      return 'Find Hold, in the hall at the top of the city.';
    case 3:
      if (!F.met_each) return 'Look around Twice.';
      if (!F.lent_each) return 'Each know the drain into the Press. It is behind the vats, south of the market.';
      return 'Find the Press.';
    case 4:
      if (!F.has_primer4) return 'Find Heed, the oldest Listener. Keep moving in the field.';
      return 'Go to the Relay, at the foot of the Tether, in the middle of the field.';
    case 5:
      if (!F.gloss_with) return 'Climb.';
      if (!F.has_notebook) return 'Climb to the Writing Room.';
      return 'Go into the Writing Room.';
    case 6:
      if (!F.halt_found) return 'Go up into Busy. Halt fell somewhere.';
      return 'The Nursery, behind Mind.';
    case 7:
      if (!F.c7_cart_done) return 'Write into the cart. Into foe, a colon, then a line.';
      if (!F.c7_closer_done) return 'The Nursery. Mind is in there.';
      return 'Halt is at the wall.';
    case 8:
      if (!F.seen_c8_twice) return 'Up the river to Standing, then east to Twice.';
      if (!F.c8_has_stet) return 'Someone sits by the drain in Twice.';
      if (!F.every_joined) return 'Behind the drain, in the empty lot.';
      return 'The Press. The strip went in there.';
    case 9:
      if (!F.c9_relay_written) return 'The Relay. Write a last line into it.';
      if (!F.l2_open) return 'Along the Line. A sentence that only goes on.';
      return 'The end of the Line.';
    case 10:
      if (!F.arms_done) return 'The filing room. Stop the arms on their plates.';
      return 'The top room.';
  }
  return '';
}

class TradePicker implements Scene {
  menu = new Menu(app.s.library.map((l) => ({ label: l.name, right: l.from })), 7);
  constructor(private pick: (i: number) => void) {}
  update() {
    const r = this.menu.update(false);
    if (r >= 0) { app.pop(); this.pick(r); }
    if (tapped('back')) { /* a choice is required */ }
  }
  draw() {
    panel(10, 30, 172, 76, C.hi);
    text('Give Weigh which page?', 14, 34, C.hi);
    this.menu.draw(14, 46, 164);
  }
}

void PAGE_COLORS;
