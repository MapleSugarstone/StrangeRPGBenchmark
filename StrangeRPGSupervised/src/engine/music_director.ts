// Picks the music for whatever scene is showing and starts audio on the first key press or click, since browsers
// keep audio silent until the player acts. M mutes and unmutes.
import { initAudio, toggleMute } from "./audio.js";
import { armAudio, wakeAudio, audioContext } from "../audio/ctx.js";
import { toybox as music } from "../audio/toybox.js";
import type { TrackId } from "../audio/toybox.js";
import chapters from "../../design/chapters.json";

/** Map id prefixes in island order. The score gives each island its own key, mode, and treatment of the motifs. */
export const ISLANDS = [
  "ashen_reach", "silica_hollow", "mud_mound", "granite_vault", "schist_spire", "basalt_forge", "oxide_belt",
  "rust_anchor", "slag_heap", "vitreous_reach", "pug_mire", "clay_deep", "kiln_edge", "ashen_reach_heart",
  // The postgame's six Dregs areas.
  "the_dregs_undercroft", "the_dregs_trench", "the_dregs_core", "the_dregs_depths", "the_dregs_glass", "the_dregs_rift",
] as const;

export interface MusicChoice { track: TrackId; place: number; variant: number }

let started = false;
let resultSeen: object | null = null;

if (typeof window !== "undefined") {
  const wake = () => {
    initAudio();
    started = true;
  };
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    wake();
    if (!e.repeat && e.key.toLowerCase() === "m") toggleMute();
  });
  window.addEventListener("pointerdown", wake);
  // The workspace menu opens the game in a frame that may play sound at once, since the player's click there allows
  // it, so the title music starts before any key. Opened on its own, the context stays silent until the first key.
  if (!(window as any).__noAutoplay) {
    armAudio();
    wakeAudio();
    const ctx = audioContext();
    const check = () => { if (ctx?.state === "running") started = true; };
    check();
    ctx?.resume().then(check, () => undefined);
    ctx?.addEventListener("statechange", check);
  }
}

/** The island a map belongs to. The longest matching prefix wins, so the heart is not taken for Ashen Reach. */
export function islandOf(mapId: string): number {
  let best = -1, len = 0;
  ISLANDS.forEach((p, i) => {
    if ((mapId === p || mapId.startsWith(p + "_")) && p.length > len) { best = i; len = p.length; }
  });
  if (best >= 0) return best;
  return /^the_dregs/.test(mapId) ? ISLANDS.length - 1 : 0;
}

function momentsOf(scene: any): number {
  const i = (chapters as any).endings?.indexOf?.(scene.endingText) ?? -1;
  return i >= 0 ? i : 0;
}

/** The track, island, and variant a scene should play. */
export function musicFor(scene: any): MusicChoice | null {
  // Told apart by their fields, since a minified build renames classes.
  if (!scene) return null;
  if (scene.battleState) {
    const place = islandOf(String(scene.fieldState?.save?.mapId ?? ""));
    if (String(scene.trainerFlag ?? "").startsWith("beat_")) return { track: "keeper", place, variant: 0 };
    return { track: "battle", place, variant: scene.isWild ? 0 : 1 };
  }
  if (scene.endingText !== undefined) return { track: "ending", place: 0, variant: momentsOf(scene) };
  if (scene.state?.mapId) {
    const id = String(scene.state.mapId);
    return { track: /_1(_hut)?$/.test(id) ? "town" : "route", place: islandOf(id), variant: 0 };
  }
  return { track: "title", place: 0, variant: 0 };
}

/** The track a scene should play: an island's first map is its town, the rest are routes. */
export function trackFor(scene: any): string {
  return musicFor(scene)?.track ?? "";
}

/** How hot a fight is: the opponent team's lost health, or most of the lead's, whichever is higher. */
export function battleIntensity(scene: any): number {
  const bs = scene?.battleState;
  if (!bs) return 0;
  let hp = 0, max = 0;
  for (const r of bs.opponentTeam ?? []) { hp += Math.max(0, Number(r?.hp) || 0); max += Math.max(0, Number(r?.maxHp) || 0); }
  const opp = max > 0 ? hp / max : 1;
  const lead = bs.playerTeam?.[0];
  const mine = lead && lead.maxHp > 0 ? Math.max(0, Math.min(1, lead.hp / lead.maxHp)) : 1;
  // Danger to the lead adds layers, but only the opponent's fall reaches the top ones.
  return Math.max(0, Math.min(1, Math.max(1 - opp, 0.7 * (1 - mine))));
}

/** The stinger for a finished battle, and the field music after it under the result screen. */
function onResult(scene: any, place: number): void {
  if (resultSeen === scene) return;
  resultSeen = scene;
  const res = scene.resultData;
  if (!res) return;
  music.stop(0.4);
  let len = music.stinger(res.won ? (res.caught ? "catch" : "win") : "lose", { place, delay: 0.2 });
  if (res.won && res.levelsUp?.length) len = Math.max(len, music.stinger("level", { place, delay: len + 0.1 }));
  const fieldMap = scene.fieldState?.save?.mapId;
  if (res.won && fieldMap) {
    const next = musicFor({ state: { mapId: fieldMap } });
    if (next) music.play(next.track, { place: next.place, variant: next.variant, fade: 2.5, delay: len + 0.4 });
  }
}

/** Called every frame: switches the music when the scene's track changes. */
export function updateMusic(scene: any): void {
  if (!started) return;
  const want = musicFor(scene);
  if (!want) return;
  if (scene.battleState) {
    if (scene.phase === "result") { onResult(scene, want.place); return; }
    music.setIntensity(battleIntensity(scene));
  }
  music.duck(!!scene.dialogue);
  const fade = want.track === "battle" || want.track === "keeper" ? 0.25 : want.track === "ending" ? 2 : 1.2;
  music.play(want.track, { place: want.place, variant: want.variant, fade });
}
