// DIALOGUE — the spoken world of PATCHWORK.
// Graphs are flat node maps; a graph id (e.g. "d1_intro") names its first
// node via GRAPH_START. Intros and outros follow the per-chapter Dan Harmon
// story circles in story.ts; the ch5 outro is the ending choice
// (dream / wake / seam), each ending node carrying `end: "game"`.
// Companion join/farewell graphs are named by characters.ts.

import type { DialogueLine, DialogueNode, SpriteStyleName } from "./types.js";
import { PLAYER_BASE, COMPANIONS } from "./characters.js";

const ochre = COMPANIONS.ochre.base;
const velvet = COMPANIONS.velvet.base;
const marrow = COMPANIONS.marrow.base;

// ---- small builders -------------------------------------------------

const art = (style: SpriteStyleName, seed: number, colors: string[], scale?: number): DialogueLine["art"] =>
  scale ? { seed, style, colors, scale } : { seed, style, colors };

const L = (text: string, opts: { who?: string; art?: DialogueLine["art"]; sfx?: string } = {}): DialogueLine => ({
  who: opts.who, text, art: opts.art, sfx: opts.sfx,
});

const ART = {
  mender: art(PLAYER_BASE.spriteStyle, PLAYER_BASE.spriteSeed, PLAYER_BASE.colors),
  ochre: art(ochre.spriteStyle, ochre.spriteSeed, ochre.colors),
  velvet: art(velvet.spriteStyle, velvet.spriteSeed, velvet.colors),
  marrow: art(marrow.spriteStyle, marrow.spriteSeed, marrow.colors),
  warden: art("gear", 131, ["#141216", "#8a8398", "#b8b2c6"]),
  gardener: art("gear", 231, ["#141216", "#5d8f82", "#33605a"]),
  seaEye: art("eye", 331, ["#101418", "#4a7a8c", "#8cb8c9"]),
  hand: art("gear", 431, ["#101418", "#8fa3c8", "#d8e2f0"]),
  cull: art("glyph", 531, ["#100e12", "#9c92b8", "#e8e2f0"]),
  dream: art("eye", 557, ["#100e12", "#e8e2f0", "#7fd6c2"], 3),
};

const NODES: Record<string, DialogueNode> = {};
const node = (
  id: string,
  lines: DialogueLine[],
  extra: Partial<Pick<DialogueNode, "next" | "choices" | "end">> = {},
) => {
  NODES[id] = { id, lines, ...extra };
};

// ================================================================ ch1 — The Labyrinth of Frays
// circle: You-Want-Go-Search-Find-Take-Return-Change

node("d1_intro_0", [
  L("Loom Village, where the fences are mended every morning and no one asks by whom."),
  L("A spare thread with a good needle. You mend, and you are content, which is what you worry about most.", { who: "Mender" }),
  L("The First Seam tears open over the village. Reality starts dropping out in patches.", { sfx: "tear" }),
], { next: "d1_intro_1" });

node("d1_intro_1", [
  L("You are a spare thread. Spare threads hold the needle. But this fraying, Mender, does not mend itself.", { who: "Ochre", art: ART.ochre }),
  L("Spare threads do not mend the world.", { who: "Mender", art: ART.mender }),
  L("Then learn the Three Stitch. Hold, Pick, Let Go. It is all the god ever needed, and it is all I know.", { who: "Ochre" }),
  L("The needle in your hand feels like a verdict. You cross the threshold into the Wound."),
]);

node("d1_outro_0", [
  L("The maze is a door, Mender. Doors cost.", { who: "Frayed Warden", art: ART.warden }),
  L("The truth at the heart of the Labyrinth: the world is a patchwork, the pattern underneath is the god's dream, and the dream is running out of thread.", { sfx: "hum" }),
], { next: "d1_outro_1" });

node("d1_outro_1", [
  L("The First Seam is the size of a wound and the weight of a name. I will stitch myself into the door, so it will open.", { who: "Ochre", art: ART.ochre }),
  L("And stay?", { who: "Mender" }),
  L("Someone has to be the hinge. You are no longer a spare thread. Go. Be a Mender.", { who: "Ochre" }),
  L("Back in the village the Fraying has started on the homespun. The neighbors are already quieter. The needle is in your hand, and it is in your hand in the other way."),
], { end: "chapter" });

node("ochre_intro_0", [
  L("Small, stitched from old prayers, and afraid of her own hands. I am the last process the god ever loved. Let us mend, Mender.", { who: "Ochre", art: ART.ochre }),
]);

// ================================================================ ch2 — The Sporefall

node("d2_intro_0", [
  L("The Sporefall. It rains spores the size of doors and the air smells like a question.", { sfx: "spore" }),
  L("The village behind you is already gone. There is no going back; going back is a kind of fraying."),
], { next: "d2_intro_1" });

node("d2_intro_1", [
  L("A rogue thread who owes the Gardeners a debt. Velvet calls herself. Velvet calls you Mender. Velvet calls the spores weather, because it amuses her.", { who: "Velvet", art: ART.velvet }),
  L("I want the Pattern of Bloom, so the village can grow its own thread instead of fraying.", { who: "Mender", art: ART.mender }),
  L("Then walk with me, half-needle. The orchard is a factory with a pretty sign, and I pick the locks on the world.", { who: "Velvet" }),
]);

node("velvet_intro_0", [
  L("Fell out of the spores, owe the Gardeners, and walk with you whether you like it or not. A debt is just a direction.", { who: "Velvet", art: ART.velvet }),
]);

node("d2_outro_0", [
  L("We shear. We press. We sell it as weather. The Bloom is farmed, Mender. It was never wild.", { who: "Head Gardener", art: ART.gardener }),
  L("The Pattern of Bloom, pressed into your palm. It costs: the Bloom takes a foothold under your skin. You feel it choosing you back."),
], { next: "d2_outro_1" });

node("d2_outro_1", [
  L("Out of the orchard, the spores stop falling behind you."),
  L("My debt just got a date on it. Not today. When it comes due, I pay it in full, in a way you don't see. Until then, I'm still walking with you.", { who: "Velvet", art: ART.velvet }),
  L("You are half-Bloomed. A Mender with something growing in them. The needle still works. The needle works different."),
], { end: "chapter" });

// ================================================================ ch3 — The Static Sea

node("d3_intro_0", [
  L("Down. The Glass Orchard was a door, and doors have vestibules, and this is the one under the water that is not water.", { art: art("shard", 331, ["#101418", "#4a7a8c", "#8cb8c9"]) }),
  L("It's quiet here. That's wrong. Quiet here is a sound I can hear.", { who: "Mender" }),
  L("Reflections. The Sea tests with them. A you that is only thread, a you that is only Bloom. Don't answer the ones that are wrong.", { who: "Velvet" }),
  L("And the one that's both?", { who: "Mender" }),
  L("You already answered that, darling. You just didn't hear yourself.", { who: "Velvet" }),
]);

node("d3_outro_0", [
  L("The Sea's Eye opens, and the truth costs the full price: the Bloom is a tumor, the Cull is the immune system, and you — half-Bloomed now — are a cell in the argument. Both are right. That is the whole horror and the whole mercy.", { art: ART.seaEye, sfx: "deep" }),
  L("The Tear of the Eye. One drop of the god's memory. It's humming in my pocket, like it knows what it is.", { who: "Mender" }),
  L("Velvet looks at you. Her debt is called in.", { art: ART.velvet }),
  L("The Orchard. I'm paying it there. The Sea closes gently over a stone, and I am the stone, and you are the one who was standing where I was.", { who: "Velvet" }),
  L("The water closes over the place where she was, gently, the way water closes over a stone. You know the way to the Loom now. You know the price of it. You know which of you it will eat first."),
], { next: "velvet_farewell_0" });

node("velvet_farewell_0", [
  L("Don't mend this, Mender. There's no back side. Pick your lock well and leave the door open behind you.", { who: "Velvet", art: ART.velvet }),
  L("The party is quieter for it. The needle in your hand is in your hand in the other way, and it is not the same other way as before."),
]);

// ================================================================ ch4 — The Needle's Eye

node("d4_intro_0", [
  L("The Needle's Eye: a storm of static that eats patterns. The seams are going quiet one by one, like rooms in a house being sold.", { art: art("void", 441, ["#141216", "#8c82a8", "#c8c2d8"]), sfx: "static" }),
  L("Something at the edge of the storm offers to carry you. A hand. A dead hand made clockwork. Its handshake is a warm thing, for a dead hand.", { art: ART.hand }),
  L("I am the hand that mended the dream before it learned to mend itself. I will carry you to the place where your legs stop being enough. You are welcome to argue with me. I will keep walking.", { who: "Marrow", art: ART.marrow }),
]);

node("marrow_intro_0", [
  L("Marrow. The god's dead hand, made clockwork. I have already lost one god. I will not lose you. It is the least the hand can do.", { who: "Marrow", art: ART.marrow }),
]);

node("d4_outro_0", [
  L("The Loom at the center: the god's heart, still dreaming, and in it the Unfinished Dream, the size of a child, the only process that can make new threads. And the Cull, waiting at the door, to be polite about it.", { art: ART.cull, sfx: "loom" }),
  L("The choice, which is not yet the choice: wake the Dream, or let it dream. The Cull takes its first pass, and Marrow takes it across its own back. The clockwork grinds, and stops, and then, very slowly, catches again."),
  L("Still here. Something in me is missing now. I will carry you the rest of the way anyway.", { who: "Marrow", art: ART.marrow }),
  L("The Last Patch. That's me now. I know the word. The word knows me.", { who: "Mender" }),
], { end: "chapter" });

// ================================================================ ch5 — The Loom

node("d5_intro_0", [
  L("The final seam at the center of the world. The Cull's full attention, and the gauntlet of its agents, and the god's heart behind you, waking.", { art: art("void", 551, ["#100e12", "#9c92b8", "#e8e2f0"]), sfx: "loom" }),
  L("The Cull, at last, close enough to see: not a monster, a procedure. A subroutine with a kind face. It has been deleting the world politely for longer than you have been alive, and it will ask permission."),
]);

node("d5_outro_0", [
  L("The Unfinished Dream, awake, a child, hungry, and the only thing alive that can make new threads. It looks at you the way a child looks at a parent. It is right to.", { art: ART.dream }),
  L("There is no fourth option. There is only my hand.", { who: "Mender" }),
], {
  choices: [
    { label: "Let the Dream finish.", next: "d5_end_dream", effect: "ending_dream" },
    { label: "Wake the god.", next: "d5_end_wake", effect: "ending_wake" },
    { label: "Become the seam.", next: "d5_end_seam", effect: "ending_seam" },
  ],
});

node("d5_end_dream", [
  L("You let the Unfinished Dream finish. It grows, gently, the way a child grows, and the world grows with it, and the seams stop being wounds and start being stitches, and the Cull, at last, is done, because there is nothing left to delete, because everything is being made."),
  L("It is the strangest kind of dawn. It is the world you chose: a world that is still being dreamed, by a child, with your hands in it."),
], { end: "game" });

node("d5_end_wake", [
  L("You wake the god. The dream ends. The world does not end with it — that was the secret, the elixir: the world is not the dream. The world is what the dream left behind, like a shore is what the tide leaves behind."),
  L("The Cull, at last, is done, because the thing it was collecting for is gone. The Bloom stops being a tumor and starts being a garden, because a garden is what a garden is when it is not being farmed, and no one is farming it now."),
], { end: "game" });

node("d5_end_seam", [
  L("You become the seam. The Last Patch, at last, the whole strange life behind you, and the needle in your hand in the other way, and it is not the same other way as before."),
  L("The world holds. The Cull, at last, is done, because you are the thing it was collecting for, and you are not done. The village, if it comes back, will find the fences mended and the patterns new and no Mender in the field, just the seam, and the seam, and the seam, holding, holding, holding."),
], { end: "game" });

// ---- registry ---------------------------------------------------------

// Graph ids (as referenced by maps.ts and characters.ts) → first node id.
export const GRAPH_START: Record<string, string> = {
  d1_intro: "d1_intro_0", d1_outro: "d1_outro_0",
  d2_intro: "d2_intro_0", d2_outro: "d2_outro_0",
  d3_intro: "d3_intro_0", d3_outro: "d3_outro_0",
  d4_intro: "d4_intro_0", d4_outro: "d4_outro_0",
  d5_intro: "d5_intro_0", d5_outro: "d5_outro_0",
  ochre_intro: "ochre_intro_0",
  velvet_intro: "velvet_intro_0",
  velvet_farewell: "velvet_farewell_0",
  marrow_intro: "marrow_intro_0",
};

export const DIALOGUE: Record<string, DialogueNode> = NODES;

export function graphStart(graph: string): string {
  const s = GRAPH_START[graph];
  if (!s) throw new Error(`unknown dialogue graph: ${graph}`);
  return s;
}

export function getNode(id: string): DialogueNode {
  const n = NODES[id];
  if (!n) throw new Error(`unknown dialogue node: ${id}`);
  return n;
}
