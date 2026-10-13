// Main game loop! Full state machine: TITLE / DIALOGUE / EXPLORE / COMBAT / VICTORY / GAMEOVER / ENDING

import { drawSprite, generateSprite, Sprite } from './sprites';
import { generateWorld, Room, WALL, FLOOR, ENCOUNTER, BOSS, ROOM_COUNT } from './world';
import { PartySystem, PartyMember } from './party';
import { StoryEngine, story } from './story';
import { ParticleEffects } from './particles';
import { OPENING, BOSS_OUTROS, CHAPTER_INTROS, ENDING, Line, portraitFor } from './dialogue';
import { ABILITIES, Foe, LEVEL_FLOOR, bossSprite, enemyDamage, fleeChance, heroDamage, makeBoss, makeEncounter } from './rules';

type GameState = 'TITLE' | 'DIALOGUE' | 'EXPLORE' | 'COMBAT' | 'VICTORY' | 'GAMEOVER' | 'ENDING';
type Action = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';

const SAVE_KEY = 'toomanydoors.save';
const W = 256, H = 256;
const TILE = 20;
const MAP_X = 8, MAP_Y = 38;
const FONT = 'Consolas, "Lucida Console", "DejaVu Sans Mono", monospace';
const CHAPTERS = story.chapters.length;

const KEYMAP: Record<string, Action> = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  Enter: 'confirm', ' ': 'confirm', z: 'confirm', Z: 'confirm',
  Escape: 'back', x: 'back', X: 'back', Backspace: 'back',
};

const DELTA: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const DIRS: Action[] = ['up', 'down', 'left', 'right'];

// Floor, wall, and wall-edge colors for each chapter
const CHAPTER_TILES = [
  { floor: '#2a2236', wall: '#120c1c', edge: '#3d3150' },
  { floor: '#163a3a', wall: '#0a1a22', edge: '#2a6a6a' },
  { floor: '#3a3226', wall: '#18140e', edge: '#5a4a32' },
  { floor: '#16264a', wall: '#0a1028', edge: '#2a3e72' },
  { floor: '#1a1a2a', wall: '#050510', edge: '#2c2c44' },
  { floor: '#3a2a22', wall: '#1a120e', edge: '#5a4232' },
];

const MEMBER_COLORS: Record<string, string> = { Kira: '#66ccff', Brass: '#ff6666', Luna: '#cc88ff' };

interface Battle {
  foes: Foe[];
  boss: boolean;
  actor: number;
  cursor: number;
  phase: 'choose' | 'wait' | 'won' | 'lost' | 'fled';
  timer: number;
  next: (() => void) | null;
  log: string;
  wall: number;
  well: number;
  counter: string | null;
  round: number;
  foeTurn: number;
}

export class Game {
  canvas = document.getElementById('game') as HTMLCanvasElement;
  ctx = this.canvas.getContext('2d')!;
  private scale = 1;
  private state: GameState = 'TITLE';
  private rooms: Room[] = generateWorld();
  private player = { x: 2, y: 1, room: 0, step: 0 };
  private cleared = new Set<string>();
  private particles = new ParticleEffects();
  private sprites = new Map<string, Sprite>();
  private frame = 0;
  private lastTime = 0;
  private stepCount = 0;

  // Input
  private held = new Set<Action>();
  private pressed: Action[] = [];
  private moveTimer = 0;
  private lastDir: Action | null = null;

  // Explore messages
  private note = '';
  private noteTimer = 0;

  // Title menu
  private titleCursor = 0;
  private hasSave = false;

  // Dialogue
  private lines: Line[] = [];
  private lineIdx = 0;
  private lineStart = 0;
  private choiceIdx = 0;
  private response: string | null = null;
  private onDialogueDone: () => void = () => {};

  // Combat
  private battle: Battle | null = null;
  private lastCursor: Record<string, number> = {};
  private victoryChapter = 0;
  private bossLosses: Record<number, number> = {};
  private screenTime = 0;

  constructor() {
    // Prevent multiple simultaneous game instances
    if ((window as any).__GAME_STARTED__) return;
    (window as any).__GAME_STARTED__ = true;
    (window as any).__game = this;
    (window as any).__debug = { PartySystem, StoryEngine };
    this.setupInput();
    try { this.hasSave = !!localStorage.getItem(SAVE_KEY); } catch (_) {}
    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    const dt = Math.min(100, Math.max(0, now - this.lastTime));
    this.lastTime = now;
    this.update(dt, now);
    this.pressed.length = 0;
    this.particles.update();
    this.render(now);
    this.frame++;
    requestAnimationFrame(this.tick);
  };

  private setupInput() {
    window.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.key];
      if (!a) return;
      e.preventDefault();
      if (!e.repeat) this.pressed.push(a);
      this.held.add(a);
    });
    window.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.key];
      if (a) this.held.delete(a);
    });
    window.addEventListener('blur', () => this.held.clear());
  }

  private was(a: Action) {
    return this.pressed.includes(a);
  }

  // ─── SAVE / LOAD ───

  private saveGame() {
    const data = {
      v: 1,
      chapter: StoryEngine.currentChapter,
      level: PartySystem.level,
      xp: PartySystem.xp,
      members: PartySystem.members.map(m => ({ name: m.name, hp: m.hp, mp: m.mp })),
      room: this.player.room,
      x: this.player.x,
      y: this.player.y,
      cleared: [...this.cleared],
      steps: this.stepCount,
      bossLosses: this.bossLosses,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      this.hasSave = true;
    } catch (_) {}
  }

  private loadGame(): boolean {
    let data: any;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      data = JSON.parse(raw);
    } catch (_) { return false; }
    if (!data || data.v !== 1) return false;

    this.rooms = generateWorld();
    StoryEngine.currentChapter = Math.max(0, Math.min(CHAPTERS, data.chapter | 0));
    PartySystem.restore(data.level, data.xp, Array.isArray(data.members) ? data.members : []);
    PartySystem.joinUpTo(Math.min(StoryEngine.currentChapter, CHAPTERS - 1));
    this.cleared = new Set(Array.isArray(data.cleared) ? data.cleared : []);
    for (const key of this.cleared) {
      const [r, x, y] = key.split(',').map(Number);
      if (this.rooms[r]?.map[y]?.[x] === ENCOUNTER) this.rooms[r].map[y][x] = FLOOR;
    }
    for (const room of this.rooms) {
      if (room.bossRoom && room.chapter < StoryEngine.currentChapter) this.clearBoss(room);
    }
    const room = this.rooms[data.room] ? data.room | 0 : 0;
    const tile = this.rooms[room].map[data.y]?.[data.x];
    this.player = tile === undefined || tile === WALL ? { x: 2, y: 1, room: 0, step: 0 } : { x: data.x, y: data.y, room, step: 0 };
    this.stepCount = data.steps | 0;
    for (const [ch, n] of Object.entries(data.bossLosses || {})) {
      this.bossLosses[+ch] = Math.max(this.bossLosses[+ch] || 0, Number(n) || 0);
    }
    return true;
  }

  private newGame() {
    StoryEngine.currentChapter = 0;
    PartySystem.reset();
    this.rooms = generateWorld();
    this.cleared = new Set();
    this.player = { x: 2, y: 1, room: 0, step: 0 };
    this.stepCount = 0;
    this.lastCursor = {};
    this.bossLosses = {};
  }

  private clearBoss(room: Room) {
    room.map.forEach(row => row.forEach((t, x) => { if (t === BOSS) row[x] = FLOOR; }));
  }

  // ─── UPDATE ───

  private update(dt: number, now: number) {
    switch (this.state) {
      case 'TITLE': this.updateTitle(); break;
      case 'DIALOGUE': this.updateDialogue(now); break;
      case 'EXPLORE': this.updateExplore(dt); break;
      case 'COMBAT': this.updateCombat(dt); break;
      case 'VICTORY':
        this.screenTime += dt;
        if (this.screenTime > 400 && this.was('confirm')) this.afterVictory();
        break;
      case 'GAMEOVER':
        this.screenTime += dt;
        if (this.screenTime > 600 && this.was('confirm')) this.retry();
        break;
      case 'ENDING':
        this.screenTime += dt;
        if (this.screenTime > 800 && this.was('confirm')) {
          this.state = 'TITLE';
          this.titleCursor = 0;
        }
        break;
    }
  }

  private titleOptions(): string[] {
    return this.hasSave ? ['Continue', 'New game'] : ['New game'];
  }

  private updateTitle() {
    const opts = this.titleOptions();
    if (this.was('up')) this.titleCursor = (this.titleCursor + opts.length - 1) % opts.length;
    if (this.was('down')) this.titleCursor = (this.titleCursor + 1) % opts.length;
    if (!this.was('confirm')) return;
    const choice = opts[Math.min(this.titleCursor, opts.length - 1)];
    if (choice === 'Continue' && this.loadGame()) {
      this.state = 'EXPLORE';
      this.showNote(this.rooms[this.player.room].name);
      return;
    }
    this.newGame();
    this.startDialogue(OPENING, () => {
      this.state = 'EXPLORE';
      this.showNote(`Chapter 1: ${story.chapters[0].name}`, 3000);
    });
  }

  private retry() {
    this.battle = null;
    if (this.loadGame()) {
      PartySystem.healAll();
      this.state = 'EXPLORE';
      this.showNote('You wake up again. The crack is still there.', 3000);
    } else {
      this.newGame();
      this.state = 'TITLE';
      this.titleCursor = 0;
    }
  }

  private showNote(text: string, ms = 2200) {
    this.note = text;
    this.noteTimer = ms;
  }

  // ─── DIALOGUE ───

  private startDialogue(lines: Line[], done: () => void) {
    if (!lines.length) { done(); return; }
    this.lines = lines;
    this.lineIdx = 0;
    this.response = null;
    this.choiceIdx = 0;
    this.lineStart = performance.now();
    this.onDialogueDone = done;
    this.state = 'DIALOGUE';
  }

  private dialogueText(): string {
    return this.response ?? this.lines[this.lineIdx]?.text ?? '';
  }

  private revealed(now: number): number {
    return Math.floor((now - this.lineStart) / 22);
  }

  private updateDialogue(now: number) {
    const line = this.lines[this.lineIdx];
    if (!line) return;
    const full = this.revealed(now) >= this.dialogueText().length;
    const choices = full && this.response === null ? line.choices : undefined;
    if (choices) {
      if (this.was('up')) this.choiceIdx = (this.choiceIdx + choices.length - 1) % choices.length;
      if (this.was('down')) this.choiceIdx = (this.choiceIdx + 1) % choices.length;
    }
    if (!this.was('confirm') && !(this.was('back') && !choices)) return;
    if (!full) {
      this.lineStart = now - 1e6;
      return;
    }
    if (choices) {
      const c = choices[this.choiceIdx];
      StoryEngine.recordChoice(c.text);
      this.response = c.response;
      this.lineStart = now;
      return;
    }
    this.lineIdx++;
    this.response = null;
    this.choiceIdx = 0;
    this.lineStart = now;
    if (this.lineIdx >= this.lines.length) this.onDialogueDone();
  }

  // ─── EXPLORE ───

  private updateExplore(dt: number) {
    if (this.noteTimer > 0) this.noteTimer -= dt;
    const fresh = this.pressed.find(a => DIRS.includes(a));
    if (fresh) {
      this.lastDir = fresh;
      this.moveTimer = 220;
      this.tryMove(fresh);
      return;
    }
    const dir = this.lastDir && this.held.has(this.lastDir) ? this.lastDir : DIRS.find(d => this.held.has(d));
    if (!dir) return;
    this.moveTimer -= dt;
    if (this.moveTimer <= 0) {
      this.lastDir = dir;
      this.moveTimer = 130;
      this.tryMove(dir);
    }
  }

  private forwardLocked(room: Room): boolean {
    return room.bossRoom && room.chapter >= StoryEngine.currentChapter;
  }

  private tryMove(dir: Action) {
    const [dx, dy] = DELTA[dir];
    const room = this.rooms[this.player.room];
    const nx = this.player.x + dx;
    const ny = this.player.y + dy;
    if (ny < 0 || ny >= room.map.length || nx < 0 || nx >= room.map[0].length) return;
    const tile = room.map[ny][nx];
    if (tile === WALL) return;

    const exit = room.exits.find(e => e.x === nx && e.y === ny);
    if (exit) {
      if (exit === room.forward && this.forwardLocked(room)) {
        this.showNote('Something holds this door shut.');
        return;
      }
      this.enterRoom(exit.toRoom, exit === room.forward);
      return;
    }

    if (tile === BOSS) {
      const boss = makeBoss(room.chapter, PartySystem.level);
      // Each earlier loss leaves the boss weaker, so a stuck player always gets through
      const losses = this.bossLosses[room.chapter] || 0;
      boss.hp = boss.maxHp = Math.round(boss.maxHp * Math.max(0.4, 1 - 0.15 * losses));
      this.startDialogue([{ speaker: boss.name, text: boss.quote }], () => this.startCombat([boss]));
      return;
    }

    this.player.x = nx;
    this.player.y = ny;
    this.player.step++;
    this.stepCount++;

    if (tile === ENCOUNTER) {
      room.map[ny][nx] = FLOOR;
      this.cleared.add(`${this.player.room},${nx},${ny}`);
      this.startCombat(makeEncounter(room.chapter, PartySystem.members.length, Math.random));
      return;
    }

    // Random encounter chance
    if (this.player.room !== ROOM_COUNT - 1 && Math.random() < 0.035) {
      this.startCombat(makeEncounter(room.chapter, PartySystem.members.length, Math.random));
    }
  }

  private enterRoom(to: number, forward: boolean) {
    const target = this.rooms[to];
    const spot = forward ? target.back : target.forward;
    if (!spot) return;
    this.player.room = to;
    this.player.x = spot.x + (forward ? 1 : -1);
    this.player.y = spot.y;
    StoryEngine.nextStage();
    this.showNote(target.name);
    this.saveGame();
  }

  // ─── COMBAT ───

  private actionsFor(m: PartyMember): string[] {
    return ['Attack', ...m.abilities, 'Flee'];
  }

  private startCombat(foes: Foe[]) {
    const first = foes[0];
    const boss = first.boss;
    const log = boss
      ? this.bossLosses[StoryEngine.currentChapter] ? `${first.name} is still hurt from your last fight.` : `${first.name} blocks the way!`
      : foes.length > 1
        ? `${foes.length} enemies appear! ${first.quote}`
        : `A ${first.name} appears! ${first.quote}`;
    this.battle = {
      foes, boss, actor: -1, cursor: 0, phase: 'choose', timer: 0, next: null,
      log, wall: 0, well: 0, counter: null, round: 1, foeTurn: 0,
    };
    this.state = 'COMBAT';
    this.nextActor();
    this.particles.explode(W / 2, 60, '#ff4444', 10);
  }

  private wait(ms: number, next: () => void) {
    const b = this.battle!;
    b.phase = 'wait';
    b.timer = ms;
    b.next = next;
  }

  private updateCombat(dt: number) {
    const b = this.battle;
    if (!b) return;
    if (b.phase === 'wait' || b.phase === 'fled' || b.phase === 'lost') {
      b.timer -= dt;
      if (b.timer > 0) {
        if (b.phase === 'wait' && this.was('confirm')) b.timer = 0;
        return;
      }
      if (b.phase === 'fled') { this.endBattle(); return; }
      if (b.phase === 'lost') {
        this.battle = null;
        this.state = 'GAMEOVER';
        this.screenTime = 0;
        return;
      }
      const next = b.next;
      b.next = null;
      next?.();
      return;
    }
    if (b.phase === 'won') {
      if (this.was('confirm')) {
        if (b.boss) this.bossBeaten();
        else this.endBattle();
      }
      return;
    }

    const m = PartySystem.members[b.actor];
    const acts = this.actionsFor(m);
    for (const p of this.pressed) {
      if (p === 'up') b.cursor = (b.cursor + acts.length - 1) % acts.length;
      if (p === 'down') b.cursor = (b.cursor + 1) % acts.length;
      if (p === 'left' && b.cursor >= 3) b.cursor -= 3;
      if (p === 'right' && b.cursor < 3) b.cursor = Math.min(acts.length - 1, b.cursor + 3);
      if (p === 'back') b.cursor = acts.length - 1;
      if (p === 'confirm') {
        this.lastCursor[m.name] = b.cursor;
        this.act(m, acts[b.cursor]);
        return;
      }
    }
  }

  private livingFoes(): Foe[] {
    return this.battle!.foes.filter(f => f.hp > 0);
  }

  private foePos(i: number): { x: number; y: number; size: number } {
    const b = this.battle!;
    const size = b.boss ? 9 : 6;
    const n = b.foes.length;
    const x = W / 2 + (i - (n - 1) / 2) * 80;
    return { x, y: (b.boss ? 20 : 34) + size * 4, size };
  }

  private act(m: PartyMember, action: string) {
    const b = this.battle!;
    if (action === 'Flee') {
      if (b.boss) { b.log = 'There is nowhere to run.'; return; }
      const living = PartySystem.members.filter(p => p.hp > 0);
      const speed = living.reduce((s, p) => s + p.speed, 0) / living.length;
      const foeSpeed = Math.max(...this.livingFoes().map(f => f.speed));
      if (Math.random() < fleeChance(speed, foeSpeed)) {
        b.log = 'You ran away into the shadows!';
        b.phase = 'fled';
        b.timer = 800;
      } else {
        b.log = "You couldn't escape!";
        this.wait(700, () => this.startFoeTurn());
      }
      return;
    }

    const ab = ABILITIES[action];
    if (m.mp < ab.cost) { b.log = 'Not enough MP!'; return; }
    m.mp -= ab.cost;
    if (ab.effect === 'wall') b.wall = 3;
    if (ab.effect === 'well') b.well = 3;
    if (ab.effect === 'counter') b.counter = m.name;

    const living = this.livingFoes();
    const targets = ab.effect === 'all' ? living : living.slice(0, 1);
    let total = 0;
    let felled = 0;
    if (ab.hit) {
      for (const f of targets) {
        const d = heroDamage(action, m.attack, f.def, b.well > 0, Math.random);
        f.hp = Math.max(0, f.hp - d);
        total += d;
        if (f.hp === 0) felled++;
        const p = this.foePos(b.foes.indexOf(f));
        this.particles.explode(p.x, p.y, MEMBER_COLORS[m.name] || '#ffaa00', 10);
      }
    }

    let log = action === 'Attack' ? `${m.name} attacks for ${total} damage!` : `${m.name} uses ${action}!`;
    if (action !== 'Attack' && ab.hit) log += targets.length > 1 ? ` ${total} damage across ${targets.length} foes.` : ` ${total} damage.`;
    if (ab.effect === 'wall') log += ' Damage is halved for 3 turns.';
    if (ab.effect === 'well') log += ' Foes take more damage for 3 turns.';
    if (ab.effect === 'counter') log += ` ${m.name} will strike back.`;
    if (felled) log += felled > 1 ? ` ${felled} foes fall!` : ` ${targets.find(f => f.hp === 0)!.name} is defeated!`;
    b.log = log;

    if (!this.livingFoes().length) { this.wait(600, () => this.win()); return; }
    this.wait(650, () => this.nextActor());
  }

  private nextActor() {
    const b = this.battle!;
    const members = PartySystem.members;
    for (let i = b.actor + 1; i < members.length; i++) {
      if (members[i].hp > 0) {
        b.actor = i;
        b.cursor = Math.min(this.lastCursor[members[i].name] ?? 0, this.actionsFor(members[i]).length - 1);
        b.phase = 'choose';
        return;
      }
    }
    this.startFoeTurn();
  }

  private startFoeTurn() {
    this.battle!.foeTurn = 0;
    this.foeAct();
  }

  private foeAct() {
    const b = this.battle!;
    while (b.foeTurn < b.foes.length && b.foes[b.foeTurn].hp <= 0) b.foeTurn++;
    if (b.foeTurn >= b.foes.length) { this.endRound(); return; }
    const f = b.foes[b.foeTurn++];
    const members = PartySystem.members;
    const pool = members.filter(m => m.hp > 0).flatMap(m => (m.name === 'Brass' ? [m, m] : [m]));
    const t = pool[Math.floor(Math.random() * pool.length)];
    const d = enemyDamage(f.atk, t.defense, b.wall > 0, Math.random);
    t.hp = Math.max(0, t.hp - d);
    let log = `${f.name} attacks ${t.name} for ${d} damage!`;
    if (t.hp === 0) log += ` ${t.name} falls!`;
    this.particles.explode(30, 162 + members.indexOf(t) * 14, '#ff0000', 8);
    if (b.counter) {
      const c = members.find(m => m.name === b.counter);
      if (c && c.hp > 0) {
        const cd = heroDamage('Attack', c.attack, f.def, b.well > 0, Math.random);
        f.hp = Math.max(0, f.hp - cd);
        log += ` ${c.name} strikes back for ${cd}!`;
      }
      b.counter = null;
    }
    b.log = log;
    if (members.every(m => m.hp <= 0)) { this.lose(); return; }
    this.wait(750, () => this.foeAct());
  }

  private endRound() {
    const b = this.battle!;
    if (b.wall > 0) b.wall--;
    if (b.well > 0) b.well--;
    b.round++;
    if (!this.livingFoes().length) { this.win(); return; }
    b.actor = -1;
    this.nextActor();
  }

  private win() {
    const b = this.battle!;
    const xp = b.foes.reduce((s, f) => s + f.xp, 0);
    const levels = PartySystem.gainXp(xp);
    if (!levels) this.recover();
    b.log = `Victory! +${xp} XP.` + (levels ? ` Level up! The party is now level ${PartySystem.level}.` : '');
    b.phase = 'won';
    this.particles.explode(W / 2, 60, '#ffcc00', 20);
  }

  private lose() {
    const b = this.battle!;
    b.log = 'You have been defeated... The crack widens.';
    if (b.boss) this.bossLosses[StoryEngine.currentChapter] = (this.bossLosses[StoryEngine.currentChapter] || 0) + 1;
    b.phase = 'lost';
    b.timer = 1400;
  }

  private recover() {
    for (const m of PartySystem.members) {
      if (m.hp <= 0) m.hp = Math.ceil(m.maxHp * 0.25);
      else m.hp = Math.min(m.maxHp, m.hp + Math.ceil(m.maxHp * 0.2));
      m.mp = Math.min(m.maxMp, m.mp + Math.ceil(m.maxMp * 0.25));
    }
  }

  private endBattle() {
    for (const m of PartySystem.members) if (m.hp <= 0) m.hp = Math.ceil(m.maxHp * 0.25);
    this.battle = null;
    this.state = 'EXPLORE';
    this.moveTimer = 220;
    this.saveGame();
  }

  private bossBeaten() {
    const ch = StoryEngine.currentChapter;
    this.clearBoss(this.rooms[this.player.room]);
    StoryEngine.currentChapter = ch + 1;
    this.victoryChapter = ch;
    this.battle = null;
    if (ch + 1 < CHAPTERS) {
      PartySystem.raiseTo(LEVEL_FLOOR[ch + 1]);
      PartySystem.joinUpTo(ch + 1);
    }
    PartySystem.healAll();
    this.saveGame();
    this.state = 'VICTORY';
    this.screenTime = 0;
  }

  private afterVictory() {
    const ch = this.victoryChapter;
    if (ch >= CHAPTERS - 1) {
      this.startDialogue(ENDING, () => {
        this.state = 'ENDING';
        this.screenTime = 0;
      });
      return;
    }
    const next = ch + 1;
    this.startDialogue([...(BOSS_OUTROS[ch] || []), ...(CHAPTER_INTROS[next] || [])], () => {
      this.state = 'EXPLORE';
      this.showNote(`Chapter ${next + 1}: ${story.chapters[next].name}`, 3000);
    });
  }

  // ─── RENDERING ───

  private sprite(type: string): Sprite {
    let s = this.sprites.get(type);
    if (!s) {
      s = generateSprite(type, 42);
      this.sprites.set(type, s);
    }
    return s;
  }

  private fitCanvas() {
    const css = this.canvas.getBoundingClientRect().width || W;
    const k = Math.max(1, Math.min(8, Math.round((css * (window.devicePixelRatio || 1)) / W)));
    if (k !== this.scale || this.canvas.width !== W * k) {
      this.scale = k;
      this.canvas.width = W * k;
      this.canvas.height = H * k;
    }
    this.ctx.setTransform(k, 0, 0, k, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  private text(s: string, x: number, y: number, color: string, size = 8, align: CanvasTextAlign = 'left') {
    const ctx = this.ctx;
    ctx.font = `${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
    ctx.textAlign = 'left';
  }

  private wrap(s: string, maxW: number, size = 8): string[] {
    const ctx = this.ctx;
    ctx.font = `${size}px ${FONT}`;
    const out: string[] = [];
    let line = '';
    for (const word of s.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxW) {
        out.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
    return out;
  }

  private box(x: number, y: number, w: number, h: number, border = '#4488cc') {
    const ctx = this.ctx;
    ctx.fillStyle = '#0a0a1e';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  private blink(): boolean {
    return (this.frame >> 5) % 2 === 0;
  }

  private render(now: number) {
    this.fitCanvas();
    const ctx = this.ctx;
    switch (this.state) {
      case 'TITLE': this.renderTitle(ctx); break;
      case 'DIALOGUE': this.renderDialogue(ctx, now); break;
      case 'EXPLORE': this.renderExplore(ctx); break;
      case 'COMBAT': this.renderCombat(ctx); break;
      case 'VICTORY': this.renderVictory(ctx); break;
      case 'GAMEOVER': this.renderGameOver(ctx); break;
      case 'ENDING': this.renderEnding(ctx); break;
    }
  }

  private renderTitle(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);

    // Glitch lines
    for (let i = 0; i < 5; i++) {
      const gy = Math.floor((this.frame * (1 + i * 0.3) + i * 60) % H);
      ctx.fillStyle = i % 2 ? '#0e1a2a' : '#101c30';
      ctx.fillRect(0, gy, W, 1);
    }

    // Title with a glitch offset now and then
    const glitch = Math.sin(this.frame * 0.1) > 0.95 ? 2 : 0;
    if (glitch) this.text('TOO MANY DOORS', W / 2 - 2, 62, '#aa2233', 18, 'center');
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillStyle = '#66ccff';
    ctx.textAlign = 'center';
    ctx.fillText('TOO MANY DOORS', W / 2 + glitch, 62);
    ctx.textAlign = 'left';

    this.text('A game about broken realities', W / 2, 80, '#667', 8, 'center');

    drawSprite(ctx, this.sprite('door'), W / 2 - 52, 98, 4);
    drawSprite(ctx, this.sprite('hero'), W / 2 + 20, 98 + ((this.frame >> 5) % 2), 4);

    const opts = this.titleOptions();
    opts.forEach((o, i) => {
      const sel = i === Math.min(this.titleCursor, opts.length - 1);
      this.text((sel ? '> ' : '  ') + o, W / 2 - 30, 158 + i * 14, sel ? '#66ccff' : '#778');
    });

    this.text('Arrows move   Z or Enter confirms', W / 2, 220, '#556', 8, 'center');
    this.text('X or Esc goes back', W / 2, 232, '#556', 8, 'center');
  }

  private renderDialogue(ctx: CanvasRenderingContext2D, now: number) {
    this.renderExplore(ctx);
    ctx.fillStyle = 'rgba(5,5,16,0.55)';
    ctx.fillRect(0, 0, W, H);

    const line = this.lines[this.lineIdx];
    if (!line) return;
    this.box(6, 148, W - 12, 102);

    const portrait = portraitFor(line.speaker);
    let tx = 16;
    if (portrait) {
      this.box(14, 158, 40, 40, '#2a4a6a');
      drawSprite(ctx, this.sprite(portrait), 18, 162, 4);
      tx = 62;
    }
    let y = 168;
    if (line.speaker) {
      this.text(line.speaker, tx, y, '#ffcc66');
      y += 13;
    }

    const body = this.dialogueText();
    let left = this.revealed(now);
    for (const l of this.wrap(body, W - tx - 18)) {
      if (left <= 0) break;
      this.text(l.slice(0, left), tx, y, '#ddeeff');
      left -= l.length + 1;
      y += 11;
    }

    const full = this.revealed(now) >= body.length;
    if (full && line.choices && this.response === null) {
      line.choices.forEach((c, i) => {
        const sel = i === this.choiceIdx;
        this.text((sel ? '> ' : '  ') + c.text, tx, 206 + i * 12, sel ? '#66ccff' : '#889');
      });
    } else if (full && this.blink()) {
      this.text('v', W - 18, 242, '#66ccff');
    }
  }

  private renderExplore(ctx: CanvasRenderingContext2D) {
    const room = this.rooms[this.player.room];
    if (!room) return;
    const pal = CHAPTER_TILES[Math.min(room.chapter, CHAPTER_TILES.length - 1)];

    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);

    // Room name bar
    ctx.fillStyle = '#0d0d1e';
    ctx.fillRect(0, 0, W, 16);
    this.text(room.name, 6, 11, '#66ccff');
    this.text(`Ch ${Math.min(StoryEngine.currentChapter + 1, CHAPTERS)}/${CHAPTERS}  Lv ${PartySystem.level}`, W - 6, 11, '#889', 8, 'right');

    if (this.noteTimer > 0) {
      this.text(this.note, W / 2, 30, '#ffcc66', 8, 'center');
    } else if (StoryEngine.currentChapter === 0 && this.player.room === 0) {
      this.text('Red marks are fights. Green doors lead on.', W / 2, 30, '#667', 8, 'center');
    }

    // Map
    for (let y = 0; y < room.map.length; y++) {
      for (let x = 0; x < room.map[y].length; x++) {
        const t = room.map[y][x];
        const px = MAP_X + x * TILE;
        const py = MAP_Y + y * TILE;
        if (t === WALL) {
          ctx.fillStyle = pal.wall;
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = pal.edge;
          ctx.fillRect(px, py, TILE, 3);
          continue;
        }
        ctx.fillStyle = pal.floor;
        ctx.fillRect(px, py, TILE, TILE);
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = pal.edge;
          ctx.fillRect(px + 9, py + 9, 2, 2);
        }
        if (t === ENCOUNTER) {
          ctx.fillStyle = (this.frame >> 4) % 2 ? '#882233' : '#dd3355';
          ctx.fillRect(px + 6, py + 6, 8, 8);
        }
      }
    }
    ctx.strokeStyle = pal.edge;
    ctx.lineWidth = 1;
    ctx.strokeRect(MAP_X - 0.5, MAP_Y - 0.5, room.map[0].length * TILE + 1, room.map.length * TILE + 1);

    // Exits
    for (const e of room.exits) {
      const locked = e === room.forward && this.forwardLocked(room);
      const px = MAP_X + e.x * TILE;
      const py = MAP_Y + e.y * TILE;
      ctx.fillStyle = locked ? '#3a1a22' : '#1e5a2a';
      ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
      this.text(e === room.forward ? '>' : '<', px + TILE / 2, py + 14, locked ? '#aa4455' : '#88ff99', 10, 'center');
    }

    // Boss
    if (room.bossRoom && room.chapter === StoryEngine.currentChapter) {
      drawSprite(ctx, this.sprite(bossSprite(room.chapter)), MAP_X + 5 * TILE, MAP_Y + 3 * TILE + ((this.frame >> 5) % 2), 5);
    }

    // Player
    const bob = this.player.step % 2;
    drawSprite(ctx, this.sprite('hero'), MAP_X + this.player.x * TILE + 2, MAP_Y + this.player.y * TILE + 2 - bob, 2);

    this.renderParticles(ctx);
    this.renderPartyHud(ctx, 204, -1);
  }

  private renderPartyHud(ctx: CanvasRenderingContext2D, y0: number, actor: number) {
    ctx.fillStyle = '#0d0d1e';
    ctx.fillRect(0, y0, W, 52);
    PartySystem.members.forEach((m, i) => {
      const y = y0 + 12 + i * 14;
      const down = m.hp <= 0;
      if (i === actor) this.text('>', 2, y, '#66ccff');
      this.text(m.name, 10, y, down ? '#555' : MEMBER_COLORS[m.name] || '#fff');
      const pct = Math.max(0, m.hp / m.maxHp);
      ctx.fillStyle = '#331122';
      ctx.fillRect(48, y - 6, 64, 5);
      ctx.fillStyle = pct > 0.5 ? '#44cc66' : pct > 0.25 ? '#cccc44' : '#cc4444';
      ctx.fillRect(48, y - 6, Math.round(64 * pct), 5);
      this.text(down ? 'down' : `${m.hp}/${m.maxHp}`, 118, y, down ? '#aa4455' : '#ccc');
      this.text(`MP ${m.mp}/${m.maxMp}`, 182, y, '#66aaff');
    });
  }

  private renderParticles(ctx: CanvasRenderingContext2D) {
    this.particles.particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    });
  }

  private renderCombat(ctx: CanvasRenderingContext2D) {
    const b = this.battle;
    if (!b) return;
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (let i = 0; i < 40; i++) {
      const sx = Math.floor((i * 37 + this.frame * 0.2) % W);
      const sy = Math.floor((i * 23 + Math.sin(this.frame * 0.01 + i) * 5 + 23) % 100);
      ctx.fillStyle = (i + (this.frame >> 4)) % 3 ? '#334' : '#99a';
      ctx.fillRect(sx, sy, 1, 1);
    }

    this.text(`Round ${b.round}`, W - 6, 11, '#556', 8, 'right');

    // Foes
    b.foes.forEach((f, i) => {
      if (f.hp <= 0) return;
      const p = this.foePos(i);
      const left = Math.round(p.x - p.size * 4);
      const top = p.y - p.size * 4 + ((this.frame >> 5) + i) % 2;
      drawSprite(ctx, this.sprite(f.spriteType), left, top, p.size);
      this.text(f.name, p.x, p.y - p.size * 4 - 4, '#ff8888', 8, 'center');
      const pct = f.hp / f.maxHp;
      ctx.fillStyle = '#330000';
      ctx.fillRect(Math.round(p.x - 28), p.y + p.size * 4 + 4, 56, 4);
      ctx.fillStyle = pct > 0.5 ? '#00cc00' : pct > 0.25 ? '#cccc00' : '#cc0000';
      ctx.fillRect(Math.round(p.x - 28), p.y + p.size * 4 + 4, Math.round(56 * pct), 4);
    });

    // Message
    this.box(4, 106, W - 8, 40, b.phase === 'won' ? '#ffaa00' : '#4488cc');
    this.wrap(b.log, W - 20).slice(0, 3).forEach((l, i) => {
      this.text(l, 10, 118 + i * 11, b.phase === 'won' ? '#ffcc00' : '#fff');
    });

    this.renderPartyHud(ctx, 146, b.phase === 'choose' ? b.actor : -1);

    // Action menu
    this.box(4, 198, W - 8, 54);
    if (b.phase === 'choose') {
      const m = PartySystem.members[b.actor];
      this.actionsFor(m).forEach((a, i) => {
        const cost = ABILITIES[a]?.cost ?? 0;
        const sel = i === b.cursor;
        const x = 14 + (i < 3 ? 0 : 122);
        const y = 213 + (i % 3) * 14;
        const short = m.mp < cost;
        const color = sel ? (short ? '#3a6680' : '#66ccff') : short ? '#555' : '#aaa';
        this.text((sel ? '> ' : '  ') + a + (cost ? ` ${cost}MP` : ''), x, y, color);
      });
    } else if (b.phase === 'won' && this.blink()) {
      this.text('Press Enter to continue', W / 2, 228, '#888', 8, 'center');
    }

    this.renderParticles(ctx);
  }

  private renderVictory(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);

    // Victory particles
    const colors = ['#ffcc00', '#66ccff', '#ff66aa', '#88ff88'];
    for (let i = 0; i < 20; i++) {
      const px = (Math.sin(this.frame * 0.02 + i * 1.3) * 0.5 + 0.5) * W;
      const py = (Math.cos(this.frame * 0.015 + i * 0.9) * 0.5 + 0.5) * H;
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
    }

    ctx.font = `bold 16px ${FONT}`;
    ctx.fillStyle = '#ffcc00';
    ctx.textAlign = 'center';
    ctx.fillText('VICTORY', W / 2, 70);
    ctx.textAlign = 'left';

    const ch = this.victoryChapter;
    this.text(`Chapter ${ch + 1} complete`, W / 2, 100, '#fff', 8, 'center');
    this.text(story.chapters[ch]?.name ?? '', W / 2, 114, '#aaa', 8, 'center');
    this.text(`The party is level ${PartySystem.level}.`, W / 2, 140, '#888', 8, 'center');
    if (this.blink()) this.text('Press Enter to continue', W / 2, 190, '#777', 8, 'center');
  }

  private renderGameOver(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);

    // Red glitch
    for (let i = 0; i < 8; i++) {
      const gy = Math.floor((this.frame * 0.5 + i * 30) % H);
      ctx.fillStyle = '#1a0508';
      ctx.fillRect(0, gy, W, 2);
    }

    ctx.font = `bold 16px ${FONT}`;
    ctx.fillStyle = '#cc0000';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', W / 2, 80);
    ctx.textAlign = 'left';

    this.text('You have been defeated...', W / 2, 110, '#888', 8, 'center');
    this.text('The crack widens.', W / 2, 122, '#888', 8, 'center');
    this.text(`Steps taken: ${this.stepCount}`, W / 2, 150, '#666', 8, 'center');
    this.text(`Chapters completed: ${StoryEngine.currentChapter}/${CHAPTERS}`, W / 2, 162, '#666', 8, 'center');
    if (this.blink()) this.text('Press Enter to try again', W / 2, 196, '#777', 8, 'center');
  }

  private renderEnding(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);

    ctx.font = `bold 16px ${FONT}`;
    ctx.fillStyle = '#66ccff';
    ctx.textAlign = 'center';
    ctx.fillText('THE END', W / 2, 60);
    ctx.textAlign = 'left';

    const lines = this.wrap('You have faced yourself. You are the crack. You are the wall. You are home.', W - 40);
    lines.forEach((l, i) => this.text(l, W / 2, 90 + i * 12, '#ddeeff', 8, 'center'));
    this.text('Or the beginning. Same thing.', W / 2, 140, '#889', 8, 'center');
    drawSprite(ctx, this.sprite('hero'), W / 2 - 16, 152, 4);
    this.text(`Steps taken: ${this.stepCount}   Level ${PartySystem.level}`, W / 2, 204, '#666', 8, 'center');
    if (this.blink()) this.text('Press Enter to return to the title', W / 2, 230, '#777', 8, 'center');
  }
}

// Allow manual instantiation from other scripts (e.g. play.html launcher)
(window as any).Game = Game;

// Auto-start only if nothing else has started a game first (for index.html-style pages).
window.addEventListener('load', () => {
  if (!(window as any).__GAME_STARTED__) new Game();
});
