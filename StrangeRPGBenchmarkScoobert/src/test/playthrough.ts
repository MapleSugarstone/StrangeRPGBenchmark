// Headless playthrough: an autopilot plays the whole game through game.ts
// with key presses only, for several seeds, and reports how far it got.
// Run: node dist/test/playthrough.js [runs]

import { RNG } from "../core/rng.js";
import { distancesFrom } from "../engine/map.js";
import {
  battleOptions, choosing, consumables, createGame, input, maxHpOf, members, partyRows, shopOptions,
  type Game, type Key, type SaveStore,
} from "../engine/game.js";
import { getSkill } from "../game/skills.js";
import type { SaveData } from "../game/types.js";

function memoryStore(): SaveStore {
  let data: string | null = null;
  return {
    load: () => (data ? (JSON.parse(data) as SaveData) : null),
    save: (d) => { data = JSON.stringify(d); },
    clear: () => { data = null; },
  };
}

const HEALS = new Set(["mend", "prayer", "hymn", "laststitch", "lastprayer", "winding"]);

/** Press keys to move the menu cursor to option `want`, then confirm. */
function pick(g: Game, want: number): void {
  let guard = 0;
  while (g.menu.cursor !== want && guard++ < 40) input(g, "down");
  input(g, "ok");
}

function battleTurn(g: Game, rng: RNG): void {
  const b = g.battle!;
  const m = g.menu;
  if (m.stage === "result") { input(g, "ok"); return; }
  if (m.stage === "enemy") {
    // weakest living enemy
    const alive = b.enemyUnits.map((e, i) => ({ e, i })).filter((x) => x.e.alive);
    alive.sort((a, b2) => a.e.hp - b2.e.hp);
    pick(g, alive[0].i);
    return;
  }
  if (m.stage === "ally") {
    const alive = b.party.map((u, i) => ({ u, i })).filter((x) => x.u.alive);
    alive.sort((a, b2) => a.u.hp / a.u.maxHp - b2.u.hp / b2.u.maxHp);
    pick(g, alive[0].i);
    return;
  }
  if (m.stage === "item") { pick(g, 0); return; }

  const actor = members(g)[m.actor];
  const opts = battleOptions(g);
  const lowest = Math.min(...b.party.filter((u) => u.alive).map((u) => u.hp / u.maxHp));
  const skills = actor.skills.map((id, i) => ({ s: getSkill(id), i })).filter((x) => opts[x.i].enabled);
  const heal = skills.find((x) => HEALS.has(x.s.id) && (x.s.target !== "self" || b.party[m.actor].hp / b.party[m.actor].maxHp < 0.4));
  if (lowest < 0.4 && heal) { pick(g, heal.i); return; }
  if (lowest < 0.3 && consumables(g).length) { pick(g, actor.skills.length + 1); return; }
  const charging = b.enemyUnits.some((e) => e.alive && e.ai === "boss" && e.charge % 3 === 2);
  if (charging && b.party[m.actor].hp / b.party[m.actor].maxHp < 0.6) { pick(g, actor.skills.length); return; }
  const enemies = b.enemyUnits.filter((e) => e.alive).length;
  const scored = skills
    .filter((x) => x.s.power > 0)
    .map((x) => ({ ...x, v: x.s.power * (x.s.target === "all-enemies" ? enemies : 1) - x.s.cost * 2 + rng.next() }));
  scored.sort((a, b2) => b2.v - a.v);
  const buff = skills.find((x) => x.s.power === 0 && !HEALS.has(x.s.id) && rng.chance(0.15));
  pick(g, buff ? buff.i : scored[0].i);
}

function shopTurn(g: Game): void {
  const opts = shopOptions(g);
  // buy the priciest affordable gear, then heals up to 4, then leave
  let best = -1;
  let bestPrice = -1;
  opts.forEach((o, i) => {
    if (!o.enabled || i === opts.length - 1) return;
    const price = Number(/(\d+)c$/.exec(o.label)?.[1] ?? 0);
    const isHeal = o.detail.includes("Heals");
    const have = Number(/You have (\d+)/.exec(o.detail)?.[1] ?? 0);
    const keep = Object.values(g.player.items).reduce((a, n) => a + n, 0);
    if (isHeal && (have >= 3 || keep >= 6)) return;
    if (price > bestPrice) { best = i; bestPrice = price; }
  });
  const target = best >= 0 ? best : opts.length - 1;
  while (g.shopCursor !== target) input(g, "down");
  input(g, "ok");
}

/** Open the party screen and use a healing item on anyone under half hp. */
function healOnMap(g: Game): boolean {
  const hurt = members(g).findIndex((m) => m.hp < maxHpOf(m) / 2);
  if (hurt < 0 || !consumables(g).length) return false;
  input(g, "menu");
  const row = partyRows(g).findIndex((r) => r.kind === "use");
  while (g.partyCursor !== row) input(g, "down");
  input(g, "ok");
  while (g.partyTarget !== hurt) input(g, "down");
  input(g, "ok");
  input(g, "back");
  return true;
}

interface Walker { target: { x: number; y: number } | null; shopped: string }

function mapTurn(g: Game, rng: RNG, w: Walker): void {
  const map = g.map!;
  const floorKey = `${g.chapter}:${map.floor}`;
  let goal: { x: number; y: number } | null = null;
  const find = (pred: (t: (typeof map.tiles)[0][0]) => boolean) => {
    for (const row of map.tiles) for (const t of row) if (pred(t)) return { x: t.x, y: t.y };
    return null;
  };
  if (w.shopped !== floorKey) goal = find((t) => t.isShop);
  if (!goal && map.encountersLeft === 0) goal = find((t) => t.isBossStair);
  if (!goal) {
    const stale = !w.target || map.tiles[w.target.y]?.[w.target.x]?.type === "wall";
    if (stale || (w.target!.x === map.playerX && w.target!.y === map.playerY)) {
      const cand: { x: number; y: number }[] = [];
      for (const row of map.tiles) for (const t of row) if (t.type !== "wall" && !t.isBossStair && !t.isShop) cand.push(t);
      w.target = rng.pick(cand);
    }
    goal = w.target!;
  }
  if (goal.x === map.playerX && goal.y === map.playerY) {
    // standing on the shop already: step off and back on
    w.shopped = floorKey;
    return;
  }
  const dist = distancesFrom(map.tiles, goal.x, goal.y);
  const steps: [Key, number, number][] = [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]];
  let bestKey: Key = "up";
  let bestD = Infinity;
  for (const [k, dx, dy] of steps) {
    const d = dist[map.playerY + dy]?.[map.playerX + dx];
    if (d !== undefined && d >= 0 && d < bestD) { bestD = d; bestKey = k; }
  }
  if (bestD === Infinity) throw new Error(`goal unreachable on ${floorKey}`);
  const wasShop = map.tiles[goal.y][goal.x].isShop;
  input(g, bestKey);
  if (wasShop && g.screen === "shop") w.shopped = floorKey;
}

interface RunResult { seed: number; finished: boolean; chapter: number; losses: number; battles: number; level: number; ending: string; steps: number; error?: string; stats?: string }

interface Tally { lossAt: string[]; party: string[]; levels: number[]; rounds: number[]; bossRounds: number[]; low: number[] }

/** Record round counts and the lowest party hp share for a finished battle. */
function tallyBattle(g: Game, t: Tally): void {
  const b = g.battle!;
  const rounds = b.events.filter((e) => e.kind === "round").length + 1;
  (g.bossFight ? t.bossRounds : t.rounds).push(rounds);
}

function tallyLow(g: Game, t: Tally): void {
  const b = g.battle!;
  const share = b.party.reduce((a, u) => a + u.hp, 0) / b.party.reduce((a, u) => a + u.maxHp, 0);
  t.low[g.chapter] = Math.min(t.low[g.chapter] ?? 1, share);
}

const avg = (xs: number[]) => (xs.length ? (xs.reduce((a, x) => a + x, 0) / xs.length).toFixed(1) : "-");

function playOnce(seed: number): RunResult {
  const g = createGame(memoryStore(), seed);
  const rng = new RNG(seed);
  const w: Walker = { target: null, shopped: "" };
  let losses = 0;
  let steps = 0;
  const t: Tally = { lossAt: [], party: [], levels: [], rounds: [], bossRounds: [], low: [] };
  try {
    input(g, "ok");
    while (steps++ < 200000) {
      if (g.screen === "ending") break;
      if (g.screen === "dialogue") {
        if (choosing(g)) {
          const want = seed % 3;
          for (let i = 0; i < want; i++) input(g, "down");
        }
        input(g, "ok");
      } else if (g.screen === "map") {
        if (!healOnMap(g)) mapTurn(g, rng, w);
      }
      else if (g.screen === "battle") {
        if (g.menu.stage === "result") tallyBattle(g, t);
        battleTurn(g, rng);
        if (g.battle) tallyLow(g, t);
        t.levels[g.chapter] = g.player.level;
        t.party[g.chapter] = members(g).map((m) => m.name).join("+");
      }
      else if (g.screen === "shop") shopTurn(g);
      else if (g.screen === "gameover") {
        losses++;
        t.lossAt.push(`${g.chapter}${g.bossFight ? "B" : ""}`);
        if (losses > 30) break;
        input(g, "ok");   // back to title
        input(g, "ok");   // continue from the last save
      } else if (g.screen === "title" || g.screen === "chapter") input(g, "ok");
      else if (g.screen === "party") input(g, "back");
    }
  } catch (e) {
    return { seed, finished: false, chapter: g.chapter, losses, battles: g.battles, level: g.player.level, ending: "", steps, error: String((e as Error).stack ?? e) };
  }
  const stats = `  losses at: ${t.lossAt.join(" ") || "none"}\n  party by chapter: ${t.party.slice(1).join(", ")}\n  levels by chapter end: ${t.levels.slice(1).join(", ")} | rounds/battle ${avg(t.rounds)} | rounds/boss ${avg(t.bossRounds)} | lowest hp share by chapter: ${t.low.slice(1).map((x) => x.toFixed(2)).join(", ")}`;
  return { seed, finished: g.screen === "ending", chapter: g.chapter, losses, battles: g.battles, level: g.player.level, ending: g.ending.title, steps, stats };
}

declare const process: { argv: string[]; exitCode?: number };
const runs = Number(process.argv[2] ?? 8);
let ok = 0;
for (let s = 1; s <= runs; s++) {
  const r = playOnce(s * 7919);
  if (r.finished) ok++;
  console.log(
    `${r.finished ? "PASS" : "FAIL"} seed=${r.seed} ch=${r.chapter} lv=${r.level} battles=${r.battles} losses=${r.losses} steps=${r.steps}${r.ending ? ` ending="${r.ending}"` : ""}`,
  );
  if (r.stats) console.log(r.stats);
  if (r.error) console.log(r.error);
}
console.log(`${ok}/${runs} runs reached an ending.`);
if (ok < runs) process.exitCode = 1;
