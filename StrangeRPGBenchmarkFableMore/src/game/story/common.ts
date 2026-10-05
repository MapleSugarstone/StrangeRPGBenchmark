import type { ScriptContext } from "./types";
import type { MapDef, NpcDef } from "../world/map";
import type { SpriteRef } from "../types";

export const P = (seed: string, a: SpriteRef["a"], b: SpriteRef["b"], variant = ""): SpriteRef => ({ kind: "humanoid", seed, a, b, variant });
export const KNOT = (seed: string, a: SpriteRef["a"], b: SpriteRef["b"]): SpriteRef => ({ kind: "knot", seed, a, b });
export const THING = (seed: string, a: SpriteRef["a"], b: SpriteRef["b"], variant = ""): SpriteRef => ({ kind: "thing", seed, a, b, variant });

/** The Scrap Market trader, who turns up in every town with the same cart and the same face. */
export const SCRAP_NPC = (x: number, y: number): NpcDef => ({ id: "scrap", x, y, sprite: P("scrap", "coal", "gold", "hat"), name: "Scrap", note: "F", talk: "scrap_talk" });

export const SCRAP_STOCK = ["l_brass", "l_bone", "l_glass", "l_mute", "l_bell", "l_echo", "w_lead", "g_scale", "s_fin", "l_jaw", "leaddrop", "slattea"];

export async function scrapTalk(ctx: ScriptContext): Promise<void> {
  const n = (ctx.get("scrap_visits") as number | undefined) ?? 0;
  ctx.flag("scrap_visits", n + 1);
  const lines = [
    "Scrap. Fell last night, all of it. Scale, bone, a hook or two, a lure somebody up there lost. Everything the Hull drops ends up on my cart. Prices are what they are.",
    "You again. Different town, same cart. I get about. Nothing on it is stolen, it fell. Falling is not stealing. The Office agrees, for a fee.",
    "I had a sister who was Chosen. I sell what the Hull drops. You work out the arithmetic. Buying?",
    "Ask me how I get from town to town faster than you. Go on. I will not tell you. Buying?",
    "The lures are real. Hang one on a line and the line sings a different note, and the Fish hear a different supper. Buying?",
  ];
  await ctx.say(lines[Math.min(n, lines.length - 1)], { who: "scrap" });
  await ctx.shop(SCRAP_STOCK, "The Scrap Market");
}

/** A well or crack where the slack can fish downward. Rewards scale with the catch. */
export async function hooking(ctx: ScriptContext, spot: string, opts: { hard?: boolean; intro?: string } = {}): Promise<void> {
  if (!ctx.has("slack")) { await ctx.say("A well. The grate is bolted. The held do not go under, and nothing comes up."); return; }
  const visits = Number(ctx.get(`hooked:${spot}`) ?? 0);
  const first = visits === 0;
  if (first) await ctx.say(opts.intro ?? "A crack in the ground. Cold comes up out of it. Fathom has a weighted knot and nothing holding Fathom back from leaning over.");
  // A well is fished out after three more tries
  if (visits >= 4) { await ctx.say("Nothing moves down there now. Whatever lived in this well has learned the twitch, or been eaten."); return; }
  const i = await ctx.choose(["Lower a line", "Leave it"], { cancel: true, title: "Hooking" });
  if (i !== 0) return;
  const r = await ctx.minigame("hook", { rounds: 3, hard: opts.hard });
  if (r.score === 0) { await ctx.say("Nothing. The line comes up wet and empty. Something down there is laughing, or that is the water."); return; }
  // An empty line does not count as a visit, so a first try can be tried again
  ctx.flag(`hooked:${spot}`, visits + 1);
  for (let k = 0; k < r.score; k++) ctx.caught();
  // A well gives less once it has been fished
  const slugs = Math.round((10 + r.score * 12 + (opts.hard ? 20 : 0)) * (first ? 1 : 0.3));
  await ctx.giveSlugs(slugs);
  if (!first && !ctx.has("hook_less")) { ctx.flag("hook_less"); await ctx.say("Less than the first time. Whatever is down there has learned the twitch, and a well only has so much in it."); }
  if (r.score >= 2 && first) await ctx.give(["flatbread", "salve", "spool", "slugpouch", "underbread"][(ctx.g.catches + spot.length) % 5]);
  if (r.score === 3 && first && !ctx.has("hook_lure")) { ctx.flag("hook_lure"); await ctx.give("l_hook"); await ctx.say("A hook, set in a knot of someone's line. It is still cold. Hung on a held line it would sing a note the Hull taught it."); }
  if (ctx.g.catches >= 10 && !ctx.has("hook_ten")) { ctx.flag("hook_ten"); await ctx.say("Ten things pulled up out of the Under. Fathom is getting a feel for the twitch. Somewhere a ledger has a new column."); await ctx.give("s_felt"); }
}

/** An inn. Eight slugs, a line of flavor, a rest. */
export async function inn(ctx: ScriptContext, who: string, open: string, sleep: string, price = 8): Promise<void> {
  await ctx.speak(who, open);
  const i = await ctx.choose([`Pay ${price} slugs`, "No"], { cancel: true });
  if (i !== 0) return;
  if (ctx.g.slugs < price) { await ctx.speak(who, "That is not the price."); return; }
  ctx.g.slugs -= price;
  ctx.rest();
  await ctx.fadeOut();
  await ctx.say(sleep);
  await ctx.fadeIn();
}

/** A bounty: a repeatable hunt the Office or a town pays for. */
export async function bounty(ctx: ScriptContext, id: string, who: string, pitch: string, group: string, reward: number, after: string): Promise<void> {
  const done = (ctx.get(`bounty:${id}`) as number | undefined) ?? 0;
  await ctx.speak(who, done === 0 ? pitch : `Another? ${Math.round(reward * 0.6)} slugs this time. The Office pays less for the second head, and the head stays here.`);
  const i = await ctx.choose(["Take it", "Not now"], { cancel: true });
  if (i !== 0) return;
  const r = await ctx.battle(group, { canFlee: true, loseAllowed: true });
  if (r !== "win") { await ctx.speak(who, "No head, no slugs."); return; }
  ctx.flag(`bounty:${id}`, done + 1);
  await ctx.giveSlugs(Math.round(reward * (done === 0 ? 1 : 0.6)));
  if (done === 0) await ctx.speak(who, after);
}

/** Towns remember being shown that a cut person can stand. */
export function quiet(ctx: ScriptContext, town: string): void {
  ctx.taught(town);
}

export function mapWithScrap(def: MapDef, x: number, y: number): MapDef {
  return { ...def, npcs: [...def.npcs, SCRAP_NPC(x, y)] };
}
