// === Story & Dialogue System ===
// Rhyming dialogue and Hero's Journey chapter structure

export type DialogueLine = {
  speaker: string;
  text: string;
  choices?: { text: string; next: string }[];
};

export type StoryChapter = {
  id: number;
  title: string;
  storyCircle: string[]; // 8 steps
  events: DialogueLine[];
  nextChapterId?: number;
};

export function resolveDialogue(lines: DialogueLine[], startKey: string): DialogueLine[] {
  const result: DialogueLine[] = [];
  const map = new Map<string, DialogueLine>();
  for (const line of lines) map.set(line.text.substring(0, 20), line);

  // Simple linear resolution for now
  return lines;
}

// Story Chapter 1: The Spore Garden
export const chapter1: StoryChapter = {
  id: 1,
  title: "The Spore Garden",
  storyCircle: [
    "Buphila tends her garden, peaceful and small",
    "A blight creeps in, she must save it all",
    "Myco speaks of danger beyond the crystal wall",
    "She ventures forth through the Rusting Menagerie's hall",
    "She finds the clockwork dragon, fierce and tall",
    "She gives up her garden, lets the old tree fall",
    "She returns home with Myco, side by side, never more alone",
    "Changed — a hero now, a spore-weaver on her throne"
  ],
  events: [
    {
      speaker: "Narrator",
      text: "In gardens where the spore-winds softly blow,\nLived Buphila, beetle-girl, and Myco, mushroom, true and slow."
    },
    {
      speaker: "Narrator",
      text: "But blight crept in like rust upon a gear,\nAnd whispers rose from crystal, drawing near."
    },
    {
      speaker: "Myco",
      text: "Dear Buphila, my beetle bright,\nThe garden fades into the night.\nBeyond the veil, a signal calls,\nWe must go forth, we must answer all."
    },
    {
      speaker: "Buphila",
      text: "My dear Myco, soft and round,\nI fear to leave my garden ground.\nThese spores I've nurtured, year by year,\nWould wither if I should disappear."
    },
    {
      speaker: "Myco",
      text: "But stay and watch them all decay,\nAnd never get the chance to try?\nYour claws were made for more than tending,\nYour heart was never meant for mending"
    },
    {
      speaker: "Narrator",
      text: "With tears like dew on morning leaf,\nBuphila packed her spore-sac brief.\nThey set forth where the rusted towers gleam,\nInto the Menagerie's humming dream."
    },
    {
      speaker: "Buphila",
      text: "Oh garden, garden, green and deep,\nI promise that I'll make you leap\nWith new-grown life, with spore-light bright,\nI'll bring you back from dying night."
    },
    {
      speaker: "Narrator",
      text: "Through corridors of gear and bone,\nWhere clockwork beasts now claim their throne,\nShe faced the Dragon, brass and flame,\nAnd called her spore-wards, calling fame."
    },
    {
      speaker: "Buphila",
      text: "Spores of light, spores of life,\nSpores that cut through clockwork strife!\nBloom now, spores, in fury green,\nLet the old world meet its end, amen!"
    },
    {
      speaker: "Narrator",
      text: "With thunderous and clicking roar,\nThe Dragon fell, its gears laid sore.\nFrom its core, a spore-crown grew,\nWoven of gold and ancient blue."
    },
    {
      speaker: "Myco",
      text: "You did it, love! You saved the day!\nBut look — your garden fades away..."
    },
    {
      speaker: "Buphila",
      text: "Then take this crown and plant it true,\nIn garden soil, in morning dew.\nWhere one life ends, another starts,\nThis is what the spore-heartarts."
    },
    {
      speaker: "Narrator",
      text: "And so they returned, with crown and hope,\nTheir bond renewed, their spirits lope.\nThe garden bloomed with colours strange,\nA testament to courage, change."
    }
  ]
};

// Chapter 2: The Rusting Menagerie
export const chapter2: StoryChapter = {
  id: 2,
  title: "The Rusting Menagerie",
  storyCircle: [
    "In the garden, life returns anew",
    "But the Spore Crown calls the sky's view",
    "Into the Menagerie's rusting heart they go",
    "Cogsworth the fox, with gears in his glow",
    "They find the key, but the clock breaks slow",
    "Cogsworth must choose — to stay or go",
    "They return, with Cogsworth by their side",
    "Changed — the party grows, their bond amplified"
  ],
  events: [
    {
      speaker: "Narrator",
      text: "The garden blooms with colours bright,\nBut shadows stir in dead of night.\nThe Spore Crown pulses, whispering tales\nOf clocks undone and metal wails."
    },
    {
      speaker: "Myco",
      text: "Buphila, look! The crown shines clear!\nIt points the way, both far and near.\nTo where the rusting machines sleep,\nAnd ancient secrets they do keep."
    },
    {
      speaker: "Buphila",
      text: "Another journey? But we've just returned,\nMy shell feels heavy, my legs get burnt."
    },
    {
      speaker: "Myco",
      text: "The crown knows best, my love, you'll see,\nIt chose you for a destiny.\nCome, let us visit the Menagerie,\nWhere clockwork beasts still guard their key."
    },
    {
      speaker: "Narrator",
      text: "Through gates of iron, twisted and brown,\nThey entered the Menagerie's domain.\nWhere foxes of brass run circuits free,\nAnd gears still turn in rusted knee."
    },
    {
      speaker: "Cogsworth",
      text: "Who enters here? What flesh and grace?\nI've watched the rusting all of time's space.\nI am Cogsworth, last of the fox-machine,\nKeeper of keys in this hollow scene."
    },
    {
      speaker: "Buphila",
      text: "I'm Buphila, spore-weaver true,\nAnd this is Myco, my mushroom beau.\nThe crown has called us here to find\nA key to power, grand and kind."
    },
    {
      speaker: "Cogsworth",
      text: "Ah, spore-weaver, I've heard the tales!\nOf gardens growing through iron veils.\nI'll help you find the heart-gear's core,\nBut know this path — it demands more."
    },
    {
      speaker: "Narrator",
      text: "Through halls of brass and corridors of steel,\nThey climbed the towers, wound the wheel.\nPast lions of copper, bears of chrome,\nThey sought the key that makes them home."
    },
    {
      speaker: "Buphila",
      text: "There! The heart-gear, spinning fast!\nBut rust has eaten through the past.\nMyco, the crown — can it restore\nWhat time has broken, what war wore?"
    },
    {
      speaker: "Myco",
      text: "Let spores and gears, my love, unite!\nYour crown has power, pure and bright.\nBut Cogsworth must choose — will he stay\nAnd watch his world decay away?"
    },
    {
      speaker: "Cogsworth",
      text: "My gears are slowing, my spring runs thin,\nPerhaps it's time for gears to win\nNot against flesh, but with it — see,\nThe future's forged in company."
    },
    {
      speaker: "Buphila",
      text: "Then come with us, you fox of grace!\nThe garden needs your gear-weave grace!\nWhere spores and circuits intertwine,\nYou'll find new purpose, grand design!"
    },
    {
      speaker: "Narrator",
      text: "And so Cogsworth, with gears anew,\nJoined Buphila's spore-weave crew.\nTogether they would face the dark,\nAnd light the world from every spark."
    }
  ]
};

export const story: Record<number, StoryChapter> = {
  1: chapter1,
  2: chapter2
};
