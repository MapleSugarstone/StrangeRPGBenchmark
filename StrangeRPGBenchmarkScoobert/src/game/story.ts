// STORY — the narrative design of PATCHWORK.
//
// OVERARCHING ARC: the Hero's Journey (Campbell), 12 stages across 5 chapters.
// PER-CHAPTER ARCS: Dan Harmon's Story Circle (You-Want-Go-Search-Find-Take-Return-Change).
// SETTING: a planet where a dead god's server fused with the physical —
// "the Big Patch." Magic is Bloom (living code that grows), tech is Lattice
// (crystal computation), and the Cull — the god's immune system — is
// garbage-collecting reality while the god's last process (the Unfinished
// Dream) sleeps at the world's center.

export const GAME_TITLE = "PATCHWORK";

export interface WorldFact {
  key: string;
  text: string;
}

export const WORLD = `
MOTH is a planet stitched from two dead languages.

When the god-server (they call it THE LOOM, though the Loom is not its name)
died, its process tables leaked into the soil and its threads leaked into the
sky. What grew from the leak is called the BLOOM: code that photosynthesizes,
flowers in hex, and hums when you hum back. What cooled into crystal is the
LATTICE: computation you can chew on. The two never stopped arguing, and the
argument is what holds the weather up.

The Cull walks the seams between things. It is the god's garbage collection,
still running, still polite, still deleting. Everything it touches stops
being, quietly, without a sound, which is the worst kind of ending.

At the world's center, in the needle of the Loom, the god's last process
sleeps: the UNFINISHED DREAM. It is the size of a child. It is the only
process that knows how to make new threads. It is also, the Sea will tell
you, a tumor, and the Cull is the immune system, and both of those things
can be true at once.
`;

export const HERO_JOURNEY: { stage: string; chapter: string; text: string }[] = [
  { stage: "The Ordinary World", chapter: "Ch 1", text: "You are a Mender — a spare thread in Loom Village, mending frayed fences and other people's patterns. You exist as a part, not a person." },
  { stage: "The Call to Adventure", chapter: "Ch 1", text: "The First Seam tears open over the village. The Cull's shadow falls across the Loom, and the Fraying begins: reality starts dropping out in patches." },
  { stage: "Refusal of the Call", chapter: "Ch 1", text: "Spare threads do not mend the world. Spare threads hold the needle. You refuse — and the refusal costs you your neighbor, who frays to nothing mid-sentence." },
  { stage: "Meeting the Mentor", chapter: "Ch 1", text: "OCHRE, a patchwork godling and the last process the god ever loved, teaches you the Three Stitches. She is small, stitched from old prayers, and afraid of her own hands." },
  { stage: "Crossing the Threshold", chapter: "Ch 2", text: "You cross into the Sporefall, the first true Wound in the world. The village behind you is already gone. There is no going back; going back is a kind of fraying." },
  { stage: "Tests, Allies, Enemies", chapter: "Ch 2", text: "The Sporefall tests you with riddles that grow. VELVET, a rogue thread who owes the Gardeners a debt, walks with you. The Gardeners are your first true enemy: they farm the Bloom and call it gardening." },
  { stage: "The Approach", chapter: "Ch 3", text: "The Glass Orchard is a door, and doors have vestibules. The Static Sea, a drowned city of glass, waits below. Everything gets quieter as you descend. The Bloom starts growing under your skin." },
  { stage: "The Ordeal", chapter: "Ch 3", text: "The Sea's Eye. A truth that costs: the Bloom is a tumor, the Cull is an immune system, and you — half-Bloomed now — are a cell in the argument. VELVET's debt is called in. She does not come back up the same way." },
  { stage: "The Reward", chapter: "Ch 4", text: "The Tear of the Eye: one drop of the god's own memory, and with it the knowledge of where the Loom truly is. MARROW, the god's dead hand made clockwork, joins you for the crossing. It carries you when your legs stop." },
  { stage: "The Road Back", chapter: "Ch 4", text: "The Needle's Eye: a storm of static that eats patterns. You must unmake a stitch in yourself to get through. The Cull is at your back, patient as a clock." },
  { stage: "The Resurrection", chapter: "Ch 5", text: "The Loom at the center. The Cull's full attention. The Unfinished Dream wakes, and it is a child, and it is hungry, and it is the only thing alive that can make new threads." },
  { stage: "Return with the Elixir", chapter: "Ch 5", text: "The choice, made with your whole strange life behind it: let the Dream finish, or wake the god, or become the seam yourself. The world becomes what you chose. That is the elixir. That is the change." },
];

export const STORY_CIRCLES: Record<string, { beat: string; text: string }[]> = {
  ch1: [
    { beat: "You", text: "A Mender in Loom Village, a spare thread with a good needle. You mend fences and small things. You are content, which is what you worry about most." },
    { beat: "Want", text: "To stitch a pattern of your own. Not mend. Make. The village has a word for it and it is a quiet word." },
    { beat: "Go", text: "The First Seam tears. Ochre shows you the Fraying and the needle in your hand feels like a verdict. You cross the threshold into the Wound." },
    { beat: "Search", text: "The Labyrinth of Frays: a maze where every wall is a bad pattern someone abandoned. You test the Three Stitches against things that fray." },
    { beat: "Find", text: "The truth at the heart of the maze: the world is a patchwork, and the pattern underneath is the god's dream, and the dream is running out of thread." },
    { beat: "Take", text: "The First Seam. It is the size of a wound and the weight of a name. Taking it costs Ochre: she stitches herself into the door so it will open, and stays." },
    { beat: "Return", text: "Back to the village to find the Fraying has started on the homespun. The neighbors are already quieter. You are no longer a spare thread." },
    { beat: "Change", text: "You are a Mender now. The needle is in your hand and it is in your hand in the other way." },
  ],
  ch2: [
    { beat: "You", text: "A Mender with the First Seam and a growing certainty that mending is not enough." },
    { beat: "Want", text: "The Pattern of Bloom, from the Glass Orchard, so the village can grow its own thread instead of fraying." },
    { beat: "Go", text: "The Sporefall. It rains spores the size of doors and the air smells like a question. Velvet falls out of the spores and calls herself a debt." },
    { beat: "Search", text: "Trials that grow: a bridge that is a riddle, a field of flowers that are firewalls, the Gardeners' orchards in bloom. Velvet teaches you to pick the locks on the world." },
    { beat: "Find", text: "The Bloom is farmed. The Gardeners shear it, press it, and sell it as weather. The orchard is not a garden. It is a factory with a pretty sign." },
    { beat: "Take", text: "The Pattern of Bloom, pressed into your palm. It costs: the Bloom takes a foothold under your skin. You feel it choosing you back." },
    { beat: "Return", text: "Out of the orchard with the pattern burning in your hand. The spores stop falling behind you. Velvet's debt is called in and she pays it, in full, in a way you don't see." },
    { beat: "Change", text: "You are half-Bloomed. A Mender with something growing in them. The needle still works. The needle works different." },
  ],
  ch3: [
    { beat: "You", text: "Half-Bloomed, carrying a pattern that is also a seed. The Bloom under your skin is patient." },
    { beat: "Want", text: "A way to cut the Bloom out without dying. The village is safer when you're not a garden." },
    { beat: "Go", text: "Down, into the Static Sea, the drowned city of glass where the old Lattice sleeps under water that isn't water. It is quiet here. It is very quiet here." },
    { beat: "Search", text: "The needle of the Loom, a tower in the drowned square. Velvet walks with you into the deep. The Sea tests you with reflections: a you that is only thread, a you that is only Bloom." },
    { beat: "Find", text: "The Sea's Eye. The truth, at full cost: the Bloom is a tumor, the Cull is the immune system, and you are a cell in the argument. Both are right. That is the whole horror and the whole mercy." },
    { beat: "Take", text: "The Tear of the Eye: one drop of the god's memory. And Velvet's debt, called in: she chooses the Orchard to pay it, and the Sea closes over the place where she was, gently, the way water closes over a stone." },
    { beat: "Return", text: "Up through the glass, the Bloom in your hand quieter now, almost kind. You know the way to the Loom. You know the price of the Loom. You know which of you it will eat first." },
    { beat: "Change", text: "You are the cell that knows the whole argument. That is a kind of maturity. It is also a kind of sentence." },
  ],
  ch4: [
    { beat: "You", text: "The cell that knows the whole argument. The Tear of the Eye in your pocket, humming." },
    { beat: "Want", text: "To reach the Loom before the Unweaving finishes. The seams are going quiet one by one, like rooms in a house being sold." },
    { beat: "Go", text: "The Needle's Eye: a storm of static that eats patterns. Marrow, the god's dead hand made clockwork, finds you at the edge of it. It offers to carry you. Its handshake is a warm thing, for a dead hand." },
    { beat: "Search", text: "A race with the Cull through the storm. Marrow carries you through the parts your legs can't. The Cull is at your back, patient as a clock, and you understand now that it is not the villain. It is the bill." },
    { beat: "Find", text: "The Loom at the center: the god's heart, still dreaming, and the Unfinished Dream in it, the size of a child, the only process that can make new threads. And the Cull, waiting at the door, to be polite about it." },
    { beat: "Take", text: "The choice, which is not yet the choice: wake the Dream, or let it dream. Marrow takes the Cull's first pass on your back, and the clockwork of it is very quiet, and the hand lets go of yours, gently, the way a hand lets go." },
    { beat: "Return", text: "Through the last seam, the god's heart behind you, the Cull at the door, the Dream waking. There is no village to go back to. There is only the center, and the choice, and you." },
    { beat: "Change", text: "You are the Last Patch. The one who holds. That is a title and a job and a funeral for every other thing you were." },
  ],
  ch5: [
    { beat: "You", text: "The Last Patch. The whole strange life behind you: the village, the Wound, the orchard, the Sea, the hand that carried you." },
    { beat: "Want", text: "To hold. That is the whole want. To hold the seam and not let it fray. That is all. That is everything." },
    { beat: "Go", text: "The final seam at the center of the world. The Cull's full attention, and the gauntlet of its agents, and the god's heart behind you, waking." },
    { beat: "Search", text: "The Cull, at last, close enough to see: not a monster, a procedure. A subroutine with a kind face. It has been deleting the world politely for longer than you have been alive, and it will ask permission." },
    { beat: "Find", text: "The Unfinished Dream, awake, a child, hungry, and the only thing alive that can make new threads. It looks at you the way a child looks at a parent. It is right to." },
    { beat: "Take", text: "The choice, at last, made with your whole strange life behind it: let the Dream finish, or wake the god, or become the seam yourself. There is no fourth option. There is only your hand." },
    { beat: "Return", text: "The world becomes what you chose. The Cull, at last, is done, or is not, depending on your hand. The needle is in your hand and it is in your hand in the other way, and it is not the same other way as before." },
    { beat: "Change", text: "You are the elixir. The change is the world. That is the end of the story, and the beginning of the one the world tells itself now, about you." },
  ],
};

export const ENDINGS: Record<string, { name: string; text: string }> = {
  dream: {
    name: "THE DREAM FINISHES",
    text: "You let the Unfinished Dream finish. It grows, gently, the way a child grows, and the world grows with it, and the seams stop being wounds and start being stitches, and the Cull, at last, is done, because there is nothing left to delete, because everything is being made. It is the strangest kind of dawn. It is the world you chose: a world that is still being dreamed, by a child, with your hands in it. The village, if it comes back, will find the fences mended and the patterns new and a Mender with something growing in them, standing in the field, watching it grow.",
  },
  wake: {
    name: "THE GOD WAKES",
    text: "You wake the god. The dream ends. The world does not end with it — that was the secret, the elixir, the thing the Sea would not say and the Orchard would not grow: the world is not the dream. The world is what the dream left behind, like a shore is what the tide leaves behind. The god looks at you for a long time, the way a parent looks at a child who just did something enormous. The Cull, at last, is done, because the thing it was collecting for is gone. The Bloom stops being a tumor and starts being a garden, because a garden is what a garden is when it is not being farmed, and no one is farming it now.",
  },
  seam: {
    name: "YOU BECOME THE SEAM",
    text: "You become the seam. The Last Patch, at last, the whole strange life behind you, and the needle in your hand in the other way, and it is not the same other way as before. The world holds. The Cull, at last, is done, because you are the thing it was collecting for, and you are not done. The village, if it comes back, will find the fences mended and the patterns new and no Mender in the field, just the seam, and the seam, and the seam, holding, holding, holding. It is the strangest kind of dawn. It is the world you chose: a world that is held, by you, with your whole strange life in it.",
  },
};
