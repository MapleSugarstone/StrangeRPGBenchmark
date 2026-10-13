// Hero's Journey story structure! Campbell's monomyth + Dan Harmon's story circle!
// Sci-fi/fantasy/weird hybrid world!

const story = {
  // Hero's Journey stages!
  stages: [
    "Ordinary World",         // You live in a tiny town with weird glitches in reality
    "Call to Adventure",      // A portal opens behind your house, showing something impossible
    "Refusal",                // The local wizard says portals are traps, run away
    "Crossing",               // You step through anyway
    "Tests and Allies",       // Meet your first party member, learn new mechanics
    "Approach",               // Discover the world is breaking apart
    "Ordeal",                 // Face a boss that changes everything
    "Reward",                 // Gain power but lose something precious
    "Road Back",              // Return through collapsing realms
    "Resurrection",           // Final test, become what you were meant to be
    "Return",                 // Home but forever changed
    "New Ordinary World",     // Everything's different but beautiful
  ],

  // Dan Harmon's story circle for each chapter!
  chapterTemplate: (chapter: number, theme: string) => ({
    departure: {
      character: `A ${theme.toLowerCase()} who wants more`,
      world: `A ${theme.toLowerCase()} world where something is wrong`,
      problem: `The ${theme.toLowerCase()} can't be fixed`,
    },
    journey: {
      meet: `Someone who sees through you`,
      learn: `The ${theme.toLowerCase()} is fake`,
      lose: `The thing you thought you needed`,
      find: `The thing you never wanted`,
    },
    return: {
      fight: `The truth about yourself`,
      change: `Become the ${theme.toLowerCase()} you denied`,
      home: `The world is better because you're different`,
    },
  }),

  // Chapter themes! Sci-fi/fantasy/weird!
  chapters: [
    { name: "The Glitch in Your Room", theme: "glitch", mechanic: "Shadow Step", party: "the time ghost" },
    { name: "Crystal Forest", theme: "crystal", mechanic: "Dream Weaving", party: "the singing stone" },
    { name: "Mech City", theme: "machine", mechanic: "Reality Warp", party: "the clockwork knight" },
    { name: "Dream Sea", theme: "dream", mechanic: "Sleep Magic", party: "the nightmare child" },
    { name: "Void Between Stars", theme: "void", mechanic: "Gravity", party: "the fallen god" },
    { name: "Home", theme: "home", mechanic: "Remembering", party: "yourself" },
  ],

  // Dialogues! Inside the game window!
  dialogues: (chapter: number) => {
    const lines = {
      0: [
        "You wake up in your room.",
        "There's a crack in the wall.",
        "It's moving.",
        "It's looking back at you.",
        "Do you speak?",
        "Do you run?",
        "Do you reach out?",
      ],
      1: [
        "The crystal forest sings.",
        "You can hear it.",
        "It knows your name.",
        "It knows your fears.",
        "Do you listen?",
        "Do you scream?",
        "Do you dance?",
      ],
    };
    return lines[chapter] || [];
  },

  // Boss fights! Each chapter has a boss!
  bosses: [
    { name: "The Door", type: "glitch", hp: 500, weakTo: "time magic", drops: ["door key"], quote: "Doors aren't exits. Doors are choices." },
    { name: "The Silent Song", type: "crystal", hp: 800, weakTo: "sound attacks", drops: ["crystal shard"], quote: "Listen to me. Please listen." },
    { name: "The Clock King", type: "machine", hp: 1200, weakTo: "steam magic", drops: ["clock gear"], quote: "I am the hour you wasted." },
    { name: "The Dream Eater", type: "dream", hp: 1600, weakTo: "nightmares", drops: ["dream fragment"], quote: "Sleep. Just sleep." },
    { name: "The Void", type: "void", hp: 2000, weakTo: "starlight", drops: ["void stone"], quote: "I am what's left." },
    { name: "Yourself", type: "home", hp: 2500, weakTo: "memory", drops: ["your heart"], quote: "I'm sorry I'm not who you wanted me to be." },
  ],
};

// Story engine! Tracks your progress!
const StoryEngine = {
  currentChapter: 0,
  stageIndex: 0,
  dialogueIndex: 0,
  choicesMade: [] as string[],

  nextStage() {
    this.stageIndex = Math.min(this.stageIndex + 1, story.stages.length - 1);
  },

  nextDialogue(chapter: number) {
    this.dialogueIndex = (this.dialogueIndex + 1) % story.dialogues(chapter).length;
  },

  recordChoice(choice: string) {
    this.choicesMade.push(choice);
  },

  // Balance testing! Make sure the story makes sense!
  checkBalance() {
    const tooHard = this.choicesMade.filter(c => c === "run away").length > 5;
    if (tooHard) {
      console.log("Story too hard, adding hints!");
    }
  },
};

export { story, StoryEngine };
