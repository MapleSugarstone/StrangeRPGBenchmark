// UI ENGINE — draws a Game onto one square canvas and maps keys to input().
// All rules live in game.ts; this file only renders and translates keys.

import { generateSprite, drawSpriteTo, SPRITE_SIZE, type SpriteStyle } from "../core/sprite.js";
import { CHAPTER_BY_NUMBER } from "../game/chapters.js";
import type { SaveData } from "../game/types.js";
import { itemById } from "../game/items.js";
import { getSkill } from "../game/skills.js";
import { COMPANIONS, PLAYER_BASE, xpForLevel } from "../game/characters.js";
import type { BattleEvent } from "./battle.js";
import {
  battleOptions, choosing, createGame, currentNode, input, maxHpOf, members, partyRows, shopOptions, spareGear,
  type Game, type Key, type MenuOption, type SaveStore,
} from "./game.js";

export const CANVAS_SIZE = 640;
const SAVE_KEY = "patchwork_save";

const C = {
  bg: "#141216",
  panel: "#1d1a21",
  line: "#5d5a64",
  text: "#e8e2f0",
  dim: "#8a8398",
  soft: "#b8b2c6",
  accent: "#8cb8c9",
  gold: "#e8c36a",
  danger: "#c96b6b",
  ok: "#5d8f82",
};

let game: Game;
let ctx: CanvasRenderingContext2D;

const browserStore: SaveStore = {
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? (JSON.parse(raw) as SaveData) : null;
    } catch {
      return null;
    }
  },
  save(data) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
  },
  clear() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
  },
};

const KEYS: Record<string, Key> = {
  ArrowUp: "up", w: "up", W: "up",
  ArrowDown: "down", s: "down", S: "down",
  ArrowLeft: "left", a: "left", A: "left",
  ArrowRight: "right", d: "right", D: "right",
  Enter: "ok", " ": "ok", z: "ok", Z: "ok",
  Escape: "back", Backspace: "back", x: "back", X: "back",
  n: "new", N: "new",
  m: "save", M: "save",
  c: "menu", C: "menu", i: "menu", I: "menu", Tab: "menu",
};

// Battle events from the last round appear one at a time.
const REVEAL_MS = 320;
const reveal = { log: null as BattleEvent[] | null, shown: 0, at: 0 };

function revealing(): boolean {
  return game.screen === "battle" && reveal.log === game.menu.log && reveal.shown < reveal.log.length;
}

function tickReveal(): void {
  if (game.screen !== "battle") return;
  if (reveal.log !== game.menu.log) {
    reveal.log = game.menu.log;
    reveal.shown = 1;
    reveal.at = Date.now();
  } else if (reveal.shown < reveal.log.length && Date.now() - reveal.at >= REVEAL_MS) {
    reveal.shown++;
    reveal.at = Date.now();
  }
}

export function initUI(canvas: HTMLCanvasElement): void {
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  // Display at a whole number of screen pixels per canvas pixel. A window too small for 1x falls back to fitting.
  const fit = () => {
    const dpr = window.devicePixelRatio || 1;
    const avail = Math.min(window.innerWidth, window.innerHeight) * 0.96 * dpr;
    const s = Math.floor(avail / CANVAS_SIZE);
    const css = (s >= 1 ? CANVAS_SIZE * s : Math.floor(avail)) / dpr;
    canvas.style.width = `${css}px`;
    canvas.style.height = `${css}px`;
  };
  fit();
  window.addEventListener("resize", fit);
  game = createGame(browserStore);
  // debug handle for screenshots and manual testing from the console
  (window as unknown as { __patchwork: Game }).__patchwork = game;

  canvas.tabIndex = 0;
  canvas.focus();
  canvas.addEventListener("blur", () => setTimeout(() => canvas.focus(), 0));
  window.addEventListener("keydown", (e) => {
    const key = KEYS[e.key];
    if (!key) return;
    e.preventDefault();
    if (e.repeat && game.screen !== "map") return;
    if (revealing()) {
      if (key === "ok") reveal.shown = reveal.log!.length;
      return;
    }
    input(game, key);
  });

  const loop = () => {
    draw();
    requestAnimationFrame(loop);
  };
  loop();
}

// ---- drawing -------------------------------------------------------

function draw(): void {
  tickReveal();
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  switch (game.screen) {
    case "title": drawTitle(); break;
    case "chapter": drawChapterCard(); break;
    case "map": drawMap(); break;
    case "party": drawParty(); break;
    case "shop": drawShop(); break;
    case "battle": drawBattle(); break;
    case "dialogue": drawDialogue(); break;
    case "gameover": drawGameOver(); break;
    case "ending": drawEnding(); break;
  }
}

function blink(): boolean {
  return Math.floor(Date.now() / 500) % 2 === 0;
}

function text(s: string, x: number, y: number, color = C.text, font = "14px monospace", align: CanvasTextAlign = "left"): void {
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = align;
  ctx.fillText(s, x, y);
}

/** Draw word-wrapped text and return the y below the last line. */
function wrap(s: string, x: number, y: number, maxWidth: number, lineHeight: number, color = C.text, font = "14px monospace"): number {
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = "left";
  let line = "";
  for (const word of s.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
  return y + lineHeight;
}

function panel(x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = C.panel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

/** A light square behind a sprite, so its near-black outline cells stay visible. */
function plate(x: number, y: number, size: number): void {
  ctx.fillStyle = "#4a4656";
  ctx.fillRect(x - 4, y - 4, size + 8, size + 8);
}

function hpBar(x: number, y: number, w: number, hp: number, maxHp: number): void {
  ctx.fillStyle = "#2a2830";
  ctx.fillRect(x, y, w, 6);
  const pct = Math.max(0, Math.min(1, hp / maxHp));
  ctx.fillStyle = pct > 0.3 ? C.ok : C.danger;
  ctx.fillRect(x, y, Math.round(w * pct), 6);
}

function menu(opts: MenuOption[], cursor: number, x: number, y: number, rowH: number, rows: number): void {
  const start = Math.max(0, Math.min(cursor - rows + 1, opts.length - rows));
  for (let i = start; i < Math.min(opts.length, start + rows); i++) {
    const o = opts[i];
    const yy = y + (i - start) * rowH;
    const color = !o.enabled ? C.line : i === cursor ? C.text : C.soft;
    text(`${i === cursor ? ">" : " "} ${o.label}`, x, yy, color);
  }
}

function drawTitle(): void {
  text("PATCHWORK", CANVAS_SIZE / 2, 200, C.text, "bold 40px monospace", "center");
  text("a strange JRPG in five chapters", CANVAS_SIZE / 2, 240, C.dim, "14px monospace", "center");
  const hasSave = !!game.store.load();
  if (blink()) text(hasSave ? "[ ENTER to continue ]" : "[ ENTER to begin ]", CANVAS_SIZE / 2, 320, C.soft, "18px monospace", "center");
  if (hasSave) text("N to start a new game", CANVAS_SIZE / 2, 350, C.dim, "14px monospace", "center");
  const help = [
    "Arrows or WASD: move and choose",
    "Enter, Space, or Z: confirm      Esc or X: back",
    "C: party and gear      M: save (the game also saves after each win)",
  ];
  help.forEach((h, i) => text(h, CANVAS_SIZE / 2, 440 + i * 20, C.line, "12px monospace", "center"));
}

function drawMap(): void {
  const map = game.map!;
  const ch = CHAPTER_BY_NUMBER[game.chapter];
  const top = 44;
  const bottom = 100;
  const scale = Math.max(1, Math.floor(Math.min(CANVAS_SIZE / (map.w * SPRITE_SIZE), (CANVAS_SIZE - top - bottom) / (map.h * SPRITE_SIZE))));
  const tile = scale * SPRITE_SIZE;
  const ox = Math.floor((CANVAS_SIZE - map.w * tile) / 2);
  const oy = top + Math.floor((CANVAS_SIZE - top - bottom - map.h * tile) / 2);

  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      if (!map.explored[y]?.[x]) continue;
      const t = map.tiles[y][x];
      const px = ox + x * tile;
      const py = oy + y * tile;
      drawSpriteTo(ctx, t.sprite, px, py, scale);
      if (t.isBossStair || t.isShop) {
        const color = t.isShop ? C.gold : map.encountersLeft > 0 ? C.line : C.danger;
        ctx.fillStyle = C.bg;
        ctx.fillRect(px + 2, py + 2, tile - 4, tile - 4);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 3, py + 3, tile - 6, tile - 6);
        text(t.isShop ? "$" : "B", px + tile / 2, py + tile / 2 + 5, color, `bold ${Math.floor(tile / 2)}px monospace`, "center");
      }
    }

  const px = ox + map.playerX * tile;
  const py = oy + map.playerY * tile;
  drawSpriteTo(ctx, generateSprite(PLAYER_BASE.spriteSeed, PLAYER_BASE.spriteStyle, PLAYER_BASE.colors), px, py, scale);

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, CANVAS_SIZE, top);
  text(`Ch${game.chapter} ${ch.name}  ·  Floor ${map.floor + 1}/${map.def.floors}`, 10, 18);
  const fights = map.encountersLeft > 0 ? `${map.encountersLeft} fights until the guardian` : "Guardian stair (B) is open";
  text(fights, 10, 36, map.encountersLeft > 0 ? C.dim : C.danger, "12px monospace");
  text(`${game.credits} credits`, CANVAS_SIZE - 10, 18, C.gold, "14px monospace", "right");
  text("C: party   M: save", CANVAS_SIZE - 10, 36, C.line, "12px monospace", "right");

  const by = CANVAS_SIZE - bottom;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, by, CANVAS_SIZE, bottom);
  const ms = members(game);
  const colW = Math.floor((CANVAS_SIZE - 20) / Math.max(3, ms.length));
  ms.forEach((m, i) => {
    const x = 10 + i * colW;
    const mx = maxHpOf(m);
    text(`${m.name} Lv${m.level}`, x, by + 22, C.accent);
    text(`${m.hp}/${mx} hp`, x, by + 40, C.soft, "12px monospace");
    hpBar(x, by + 46, colW - 30, m.hp, mx);
  });
  if (game.message) text(game.message, CANVAS_SIZE / 2, CANVAS_SIZE - 14, C.text, "14px monospace", "center");
}

function drawShop(): void {
  const opts = shopOptions(game);
  text("SHOP", 20, 40, C.gold, "bold 24px monospace");
  text(`${game.credits} credits`, CANVAS_SIZE - 20, 40, C.gold, "16px monospace", "right");
  panel(10, 60, CANVAS_SIZE - 20, 320);
  menu(opts, game.shopCursor, 30, 95, 30, 9);
  panel(10, 390, CANVAS_SIZE - 20, 130);
  wrap(opts[game.shopCursor]?.detail ?? "", 30, 420, CANVAS_SIZE - 60, 20, C.soft);
  const bag = Object.entries(game.player.items).filter(([, n]) => n > 0);
  const gear = members(game).map((m) => `${m.name}: ${[m.weapon, m.armor, m.trinket].filter(Boolean).length} gear`).join("   ");
  text(gear, 20, 550, C.dim, "12px monospace");
  text(`Bag: ${bag.length ? bag.map(([id, n]) => `${id.replace(/^c_/, "")} x${n}`).join(", ") : "empty"}`, 20, 570, C.dim, "12px monospace");
  if (game.message) text(game.message, CANVAS_SIZE / 2, 605, C.text, "14px monospace", "center");
  text("Enter: buy   Esc: leave", CANVAS_SIZE / 2, 630, C.line, "12px monospace", "center");
}

interface ShownBattle {
  enemyHp: number[];
  partyHp: number[];
  enemyCount: number;     // enemies spawned by splits that have not been revealed stay hidden
  flash: { side: "enemy" | "ally"; idx: number } | null;
  log: BattleEvent[];
}

/** Which unit an event changed hp on, and by how much (negative = damage). */
function hpChange(ev: BattleEvent): { side: "enemy" | "ally"; idx: number; delta: number } | null {
  const p = ev.power ?? 0;
  const enemy = ev.enemy !== undefined && ev.enemy >= 0 ? ev.enemy : -1;
  switch (ev.kind) {
    case "hit":
      return enemy >= 0 ? { side: "enemy", idx: enemy, delta: -p } : { side: "ally", idx: ev.target ?? -1, delta: -p };
    case "status-tick":
      return enemy >= 0 ? { side: "enemy", idx: enemy, delta: -p } : { side: "ally", idx: ev.actor ?? -1, delta: -p };
    case "shield-gain":
      if (!ev.text.includes("absorbs")) return null;
      return (ev.actor ?? -1) >= 0 ? { side: "ally", idx: ev.actor!, delta: p } : { side: "enemy", idx: enemy, delta: p };
    case "heal":
      return { side: "ally", idx: (ev.target ?? -1) >= 0 ? ev.target! : ev.actor ?? -1, delta: p };
    case "item":
      return { side: "ally", idx: ev.target ?? -1, delta: p };
    default:
      return null;
  }
}

/** The battle as it looked after the last revealed event. */
function shownBattle(): ShownBattle {
  const b = game.battle!;
  const log = game.menu.log;
  const shown = revealing() ? reveal.shown : log.length;
  const enemyHp = b.enemyUnits.map((e) => e.hp);
  const partyHp = b.party.map((u) => u.hp);
  let enemyCount = b.enemyUnits.length;
  for (const ev of log.slice(shown)) {
    if (ev.kind === "split" && ev.enemyNew !== undefined) enemyCount = Math.min(enemyCount, ev.enemyNew);
    const ch = hpChange(ev);
    if (!ch || ch.idx < 0) continue;
    if (ch.side === "enemy") enemyHp[ch.idx] -= ch.delta;
    else partyHp[ch.idx] -= ch.delta;
  }
  b.enemyUnits.forEach((e, i) => { enemyHp[i] = Math.max(0, Math.min(e.maxHp, enemyHp[i])); });
  b.party.forEach((u, i) => { partyHp[i] = Math.max(0, Math.min(u.maxHp, partyHp[i])); });
  let flash: ShownBattle["flash"] = null;
  const last = log[shown - 1];
  if (last && revealing() && Date.now() - reveal.at < 200) {
    const ch = hpChange(last);
    if (ch && ch.delta < 0 && ch.idx >= 0) flash = { side: ch.side, idx: ch.idx };
  }
  return { enemyHp, partyHp, enemyCount, flash, log: log.slice(0, shown) };
}

function drawBattle(): void {
  const b = game.battle!;
  const m = game.menu;
  const s = shownBattle();
  const busy = revealing();

  // enemies
  const n = s.enemyCount;
  const ew = Math.floor((CANVAS_SIZE - 20) / Math.max(3, n));
  b.enemyUnits.slice(0, n).forEach((e, i) => {
    const hp = s.enemyHp[i];
    if (hp <= 0) return;
    const x = 10 + i * ew + Math.floor((ew - 64) / 2);
    const targeted = !busy && m.stage === "enemy" && m.cursor === i;
    const hit = s.flash?.side === "enemy" && s.flash.idx === i;
    plate(x, 40, 64);
    drawSpriteTo(ctx, generateSprite(e.spriteSeed, e.spriteStyle, e.colors), x + (hit ? 4 : 0), 40, 8);
    if (hit) {
      ctx.fillStyle = "rgba(232, 226, 240, 0.45)";
      ctx.fillRect(x - 4, 36, 72, 72);
    }
    if (targeted) {
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 7, 33, 78, 78);
    }
    text(e.name, x + 32, 26, targeted ? C.gold : C.text, "11px monospace", "center");
    hpBar(x, 114, 64, hp, e.maxHp);
    const st = [...e.statuses.map((x2) => x2.kind), ...Object.keys(e.buffs), e.charge % 3 === 2 ? "charging" : ""].filter(Boolean).join(" ");
    if (st) text(st, x + 32, 132, C.dim, "10px monospace", "center");
  });

  // party
  const pw = Math.floor((CANVAS_SIZE - 20) / Math.max(3, b.party.length));
  b.party.forEach((u, i) => {
    const hp = s.partyHp[i];
    const x = 10 + i * pw;
    const y = 156;
    const active = !busy && m.stage !== "result" && m.actor === i;
    const targeted = !busy && m.stage === "ally" && m.cursor === i;
    const hit = s.flash?.side === "ally" && s.flash.idx === i;
    ctx.globalAlpha = hp > 0 ? 1 : 0.35;
    plate(x, y, 32);
    drawSpriteTo(ctx, generateSprite(u.spriteSeed, u.spriteStyle, u.colors), x + (hit ? 3 : 0), y, 4);
    ctx.globalAlpha = 1;
    if (hit) {
      ctx.fillStyle = "rgba(201, 107, 107, 0.5)";
      ctx.fillRect(x, y, 32, 32);
    }
    if (active) {
      ctx.fillStyle = C.gold;
      ctx.fillRect(x, y + 36, 32, 3);
    }
    text(u.name, x + 40, y + 12, targeted ? C.gold : active ? C.text : C.accent, active ? "bold 13px monospace" : "13px monospace");
    text(`${hp}/${u.maxHp}`, x + 40, y + 28, C.soft, "11px monospace");
    text(`${b.currency} ${b.pool(i)}`, x + 40, y + 42, C.dim, "11px monospace");
    hpBar(x, y + 48, pw - 30, hp, u.maxHp);
    const st = [...u.statuses.map((x2) => x2.kind), ...Object.keys(u.buffs), u.shieldPool > 0 ? `shield ${u.shieldPool}` : ""].filter(Boolean).join(" ");
    if (st) text(st, x, y + 66, C.dim, "10px monospace");
  });

  // log
  panel(10, 236, CANVAS_SIZE - 20, 186);
  const lines = s.log.slice(-9);
  let y = 260;
  lines.forEach((ev, i) => {
    const latest = i === lines.length - 1;
    y = wrap(ev.text, 24, y, CANVAS_SIZE - 50, 18, latest ? C.text : C.soft, "13px monospace");
  });

  // menu
  panel(10, 430, CANVAS_SIZE - 20, 200);
  if (busy) {
    text("...", 30, 465, C.dim, "bold 18px monospace");
    text("Enter: skip", CANVAS_SIZE - 30, 615, C.line, "12px monospace", "right");
    return;
  }
  if (m.stage === "result") {
    const win = b.result === "win";
    text(win ? "Victory" : "The party has fallen", 30, 465, win ? C.gold : C.danger, "bold 18px monospace");
    m.notes.forEach((note, i) => text(note, 30, 495 + i * 20, C.soft));
    if (blink()) text("[ ENTER ]", CANVAS_SIZE / 2, 615, C.text, "14px monospace", "center");
    return;
  }
  const actor = b.party[m.actor];
  const prompt = { skill: "choose a skill", item: "choose an item", enemy: "choose a target", ally: "choose an ally", result: "" }[m.stage];
  text(`${actor.name}: ${prompt}`, 30, 458, C.accent, "bold 14px monospace");
  const opts = battleOptions(game);
  menu(opts, m.cursor, 30, 484, 20, 6);
  wrap(opts[m.cursor]?.detail ?? "", 330, 484, CANVAS_SIZE - 360, 18, C.dim, "12px monospace");
  text("Enter: confirm   Esc: back", CANVAS_SIZE - 30, 615, C.line, "12px monospace", "right");
}

/** A faded field of the chapter's own floor and wall tiles behind dialogue art. */
function drawBackdrop(top: number, height: number): void {
  const def = CHAPTER_BY_NUMBER[game.chapter].map;
  const size = 64;
  ctx.globalAlpha = 0.13;
  for (let y = 0; y * size < height; y++)
    for (let x = 0; x * size < CANVAS_SIZE; x++) {
      const wall = (x * 7 + y * 13 + def.seed) % 5 === 0;
      const spr = generateSprite(x + y * 10 + def.seed, wall ? def.tileWall : def.tileFloor, def.palette);
      drawSpriteTo(ctx, spr, x * size, top + y * size, size / SPRITE_SIZE);
    }
  ctx.globalAlpha = 1;
  const fade = ctx.createLinearGradient(0, top + height - 80, 0, top + height);
  fade.addColorStop(0, "rgba(20, 18, 22, 0)");
  fade.addColorStop(1, C.bg);
  ctx.fillStyle = fade;
  ctx.fillRect(0, top + height - 80, CANVAS_SIZE, 80);
}

function drawChapterCard(): void {
  const ch = CHAPTER_BY_NUMBER[game.chapter];
  drawBackdrop(0, CANVAS_SIZE);
  ctx.fillStyle = "rgba(20, 18, 22, 0.82)";
  ctx.fillRect(40, 160, CANVAS_SIZE - 80, 360);
  text(`CHAPTER ${game.chapter}`, CANVAS_SIZE / 2, 200, C.dim, "16px monospace", "center");
  text(ch.name, CANVAS_SIZE / 2, 250, C.text, "bold 32px monospace", "center");
  ctx.font = "15px monospace";
  const w = Math.min(CANVAS_SIZE - 120, ctx.measureText(ch.tagline).width);
  wrap(ch.tagline, (CANVAS_SIZE - w) / 2, 300, w, 22, C.soft, "15px monospace");
  text(ch.heroStage, CANVAS_SIZE / 2, 380, C.accent, "italic 14px monospace", "center");
  const ms = members(game);
  ms.forEach((m2, i) => {
    const x = CANVAS_SIZE / 2 - (ms.length * 64) / 2 + i * 64 + 8;
    const u = battleUnitArt(m2.cls);
    plate(x, 430, 48);
    drawSpriteTo(ctx, generateSprite(u.seed, u.style, u.colors), x, 430, 6);
  });
  if (blink()) text("[ ENTER ]", CANVAS_SIZE / 2, 560, C.text, "14px monospace", "center");
}

function drawParty(): void {
  const ms = members(game);
  const rows = partyRows(game);
  const cur = rows[game.partyCursor];
  text("PARTY", 20, 34, C.accent, "bold 22px monospace");
  text(`${game.credits} credits`, CANVAS_SIZE - 20, 34, C.gold, "14px monospace", "right");

  const blockH = 142;
  ms.forEach((m2, mi) => {
    const top = 48 + mi * blockH;
    const targeted = game.partyTarget === mi;
    panel(10, top, CANVAS_SIZE - 20, blockH - 6);
    const art = battleUnitArt(m2.cls);
    plate(22, top + 14, 40);
    drawSpriteTo(ctx, generateSprite(art.seed, art.style, art.colors), 22, top + 14, 5);
    const mx = maxHpOf(m2);
    text(`${m2.name}  Lv${m2.level}`, 76, top + 24, targeted ? C.gold : C.text, "bold 14px monospace");
    text(`${m2.hp}/${mx} hp   xp ${m2.xp}/${xpForLevel(m2.level)}`, 76, top + 42, C.soft, "12px monospace");
    hpBar(76, top + 48, 150, m2.hp, mx);
    const gear = [m2.weapon, m2.armor, m2.trinket].filter(Boolean).map((id) => itemById(id));
    const stat = (k: "atk" | "def" | "spd" | "wit") => m2.stats[k] + gear.reduce((a, it) => a + (it[k] ?? 0), 0);
    text(`atk ${stat("atk")}  def ${stat("def")}  spd ${stat("spd")}  wit ${stat("wit")}`, 76, top + 72, C.dim, "12px monospace");
    wrap(m2.skills.map((id) => getSkill(id).name).join(", "), 76, top + 92, 260, 15, C.line, "11px monospace");
    (["weapon", "armor", "trinket"] as const).forEach((slot, si) => {
      const ri = mi * 3 + si;
      const on = game.partyCursor === ri && game.partyTarget === null;
      const name = m2[slot] ? itemById(m2[slot]).name : "(empty)";
      text(`${on ? ">" : " "} ${slot.padEnd(7)} ${name}`, 350, top + 26 + si * 22, on ? C.text : C.soft, "12px monospace");
    });
  });

  const bagTop = 48 + ms.length * blockH;
  const useRows = rows.map((r, i) => ({ r, i })).filter((x) => x.r.kind === "use");
  text("Bag", 20, bagTop + 18, C.accent, "bold 13px monospace");
  if (!useRows.length) text("No healing items.", 70, bagTop + 18, C.line, "12px monospace");
  useRows.forEach(({ r, i }, k) => {
    if (r.kind !== "use") return;
    const on = game.partyCursor === i;
    const it = itemById(r.id);
    const col = k % 2;
    const row = Math.floor(k / 2);
    text(`${on ? ">" : " "} ${it.name} x${game.player.items[r.id]}`, 70 + col * 270, bagTop + 18 + row * 18, on ? C.text : C.soft, "12px monospace");
  });

  let detail = "";
  if (game.partyTarget !== null) detail = "Choose who gets it, then press Enter. Esc cancels.";
  else if (cur?.kind === "use") detail = `${itemById(cur.id).desc} Heals ${itemById(cur.id).use!.heal}. Enter to use.`;
  else if (cur?.kind === "slot") {
    const m2 = ms[cur.member];
    const spare = spareGear(game, cur.slot).map((id) => itemById(id).name);
    const now = m2[cur.slot] ? itemById(m2[cur.slot]).desc : "Nothing equipped.";
    detail = `${now} ${spare.length ? `Spare: ${spare.join(", ")}. Enter to swap.` : "No spare gear for this slot."}`;
  }
  const dy = CANVAS_SIZE - 64;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, dy - 18, CANVAS_SIZE, 82);
  wrap(detail, 20, dy, CANVAS_SIZE - 40, 16, C.dim, "12px monospace");
  text(game.message || "Esc or C: back to the map", CANVAS_SIZE / 2, CANVAS_SIZE - 12, game.message ? C.text : C.line, "12px monospace", "center");
}

function battleUnitArt(cls: string): { seed: number; style: SpriteStyle; colors: string[] } {
  const b = cls === "mender" ? PLAYER_BASE : COMPANIONS[cls].base;
  return { seed: b.spriteSeed, style: b.spriteStyle, colors: b.colors };
}

function drawDialogue(): void {
  const node = currentNode(game);
  const d = game.dialogue;
  const line = node.lines[Math.min(d.line, node.lines.length - 1)];

  drawBackdrop(0, 380);
  const art = line.art ?? node.lines.slice(0, d.line + 1).reverse().find((l) => l.art)?.art;
  if (art) {
    const scale = (art.scale ?? 3) * 3;
    ctx.fillStyle = "rgba(20, 18, 22, 0.85)";
    ctx.fillRect(CANVAS_SIZE / 2 - 4 * scale - 16, 104, 8 * scale + 32, 8 * scale + 32);
    plate(CANVAS_SIZE / 2 - 4 * scale, 120, 8 * scale);
    drawSpriteTo(ctx, generateSprite(art.seed, art.style, art.colors), CANVAS_SIZE / 2 - 4 * scale, 120, scale);
  }

  panel(10, 380, CANVAS_SIZE - 20, 250);
  let y = 412;
  if (line.who) {
    text(line.who, 30, y, C.accent, "bold 15px monospace");
    y += 26;
  }
  y = wrap(line.text, 30, y, CANVAS_SIZE - 60, 20, line.who ? C.text : C.soft, line.who ? "15px monospace" : "italic 15px monospace");

  if (choosing(game)) {
    menu(node.choices!.map((c) => ({ label: c.label, detail: "", enabled: true })), d.cursor, 40, Math.max(y + 10, 540), 24, 3);
  } else if (blink()) {
    text("▼", CANVAS_SIZE - 36, 615, C.dim);
  }
}

function drawGameOver(): void {
  text("DOWN", CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 30, C.danger, "bold 36px monospace", "center");
  text("The party has fallen.", CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 10, C.dim, "16px monospace", "center");
  if (blink()) text("[ ENTER to return to the title ]", CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 60, C.soft, "14px monospace", "center");
  text("You continue from the last save: a chapter start, a new floor, or a manual save.", CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 100, C.line, "11px monospace", "center");
}

function drawEnding(): void {
  text(game.ending.title, CANVAS_SIZE / 2, 110, C.gold, "bold 24px monospace", "center");
  wrap(game.ending.text, 50, 170, CANVAS_SIZE - 100, 20, C.soft);
  text(`Battles won: ${game.wins}   Level: ${game.player.level}`, CANVAS_SIZE / 2, 570, C.dim, "13px monospace", "center");
  if (blink()) text("[ ENTER to return to the title ]", CANVAS_SIZE / 2, 610, C.text, "14px monospace", "center");
}