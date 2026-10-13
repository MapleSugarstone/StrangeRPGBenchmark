// Party system! Characters joining each chapter with unique abilities!

export interface PartyMember {
  name: string;
  spriteType: string;
  class: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  defense: number;
  speed: number;
  abilities: string[];
  joinedChapter: number; // 1-based
  growth: { hp: number; mp: number; attack: number; defense: number };
  personality: string[];
}

const HERO: PartyMember = {
  name: 'Kira',
  spriteType: 'hero',
  class: 'Dreamweaver',
  hp: 80,
  maxHp: 80,
  mp: 30,
  maxMp: 30,
  attack: 12,
  defense: 8,
  speed: 10,
  abilities: ['Dream Slash', 'Starlight', 'Reality Tear'],
  joinedChapter: 1,
  growth: { hp: 9, mp: 3, attack: 2, defense: 1 },
  personality: [
    "I see the world in fragments, but maybe that's how to fix it.",
    "Something's calling me home... or somewhere like it.",
  ]
};

const WARRIOR: PartyMember = {
  name: 'Brass',
  spriteType: 'warrior',
  class: 'Ironheart Knight',
  hp: 120,
  maxHp: 120,
  mp: 10,
  maxMp: 10,
  attack: 18,
  defense: 15,
  speed: 5,
  abilities: ['Shield Bash', 'Iron Wall', 'Counterstrike'],
  joinedChapter: 2,
  growth: { hp: 12, mp: 1, attack: 2, defense: 2 },
  personality: [
    "I fight because fighting is what I do.",
    "You look like trouble. I like you already.",
    "Stand behind me. That's your job."
  ]
};

const MAGE: PartyMember = {
  name: 'Luna',
  spriteType: 'mage',
  class: 'Starlight Weaver',
  hp: 60,
  maxHp: 60,
  mp: 50,
  maxMp: 50,
  attack: 8,
  defense: 4,
  speed: 12,
  abilities: ['Nova Burst', 'Moonbeam', 'Gravity Well'],
  joinedChapter: 3,
  growth: { hp: 6, mp: 5, attack: 2, defense: 1 },
  personality: [
    "I see stars in your eyes, but they're fading.",
    "Magic is just physics we haven't forgiven yet.",
    "The universe is singing. You're just too loud to hear it."
  ]
};

export const PARTY_MEMBERS = [HERO, WARRIOR, MAGE];

function levelled(template: PartyMember, level: number): PartyMember {
  const m: PartyMember = { ...template, abilities: [...template.abilities] };
  const n = level - 1;
  m.maxHp += m.growth.hp * n;
  m.maxMp += m.growth.mp * n;
  m.attack += m.growth.attack * n;
  m.defense += m.growth.defense * n;
  m.hp = m.maxHp;
  m.mp = m.maxMp;
  return m;
}

export const PartySystem = {
  members: [] as PartyMember[],
  level: 1,
  xp: 0,

  reset() {
    this.level = 1;
    this.xp = 0;
    this.members = [levelled(HERO, 1)];
  },

  /** Adds every member who has joined by the given 0-based chapter and returns the new names. */
  joinUpTo(chapter: number): string[] {
    const joined: string[] = [];
    for (const t of PARTY_MEMBERS) {
      if (t.joinedChapter - 1 <= chapter && !this.members.some(m => m.name === t.name)) {
        this.members.push(levelled(t, this.level));
        joined.push(t.name);
      }
    }
    return joined;
  },

  xpToNext(): number {
    return 20 + this.level * 20;
  },

  levelUp() {
    this.level++;
    for (const m of this.members) {
      m.maxHp += m.growth.hp;
      m.maxMp += m.growth.mp;
      m.attack += m.growth.attack;
      m.defense += m.growth.defense;
    }
  },

  /** Returns how many levels the party gained. */
  gainXp(amount: number): number {
    this.xp += amount;
    let gained = 0;
    while (this.xp >= this.xpToNext()) {
      this.xp -= this.xpToNext();
      this.levelUp();
      gained++;
    }
    if (gained) this.healAll();
    return gained;
  },

  /** Raises the party to at least the given level. Returns how many levels it gained. */
  raiseTo(level: number): number {
    let gained = 0;
    while (this.level < level) {
      this.levelUp();
      gained++;
    }
    if (gained) {
      this.xp = 0;
      this.healAll();
    }
    return gained;
  },

  healAll() {
    for (const m of this.members) {
      m.hp = m.maxHp;
      m.mp = m.maxMp;
    }
  },

  /** Rebuilds the party from a level and per-member HP and MP. */
  restore(level: number, xp: number, saved: { name: string; hp: number; mp: number }[]) {
    this.level = Math.max(1, level | 0);
    this.xp = Math.max(0, xp | 0);
    this.members = [];
    for (const s of saved) {
      const t = PARTY_MEMBERS.find(p => p.name === s.name);
      if (!t) continue;
      const m = levelled(t, this.level);
      m.hp = Math.max(0, Math.min(m.maxHp, s.hp | 0));
      m.mp = Math.max(0, Math.min(m.maxMp, s.mp | 0));
      this.members.push(m);
    }
    if (!this.members.length) this.members = [levelled(HERO, this.level)];
  },
};

PartySystem.reset();
