// The expected route through the game, for the balance sim. Keep in step with the maps.
export interface ChapterPlan {
  n: number;
  title: string;
  party: string[];
  joins?: Record<string, number>;
  leaves?: string[];
  mech: string[];
  shop: string[];
  fights: { group: string; n: number }[];
  bosses: { group: string; mech?: string[] }[];
  rests: number;
  newMechanic: string;
  hush?: boolean;
  dialogueLines: number;
  mapTiles: number;
}

export const CAMPAIGN: ChapterPlan[] = [
  {
    n: 1, title: 'Hello?', party: ['hello'], joins: { someday: 2 }, mech: ['timed'],
    shop: ['soup', 'soup', 'soup', 'someday_w2', 'coat2', 'card'],
    fights: [{ group: 'mites', n: 3 }, { group: 'sign', n: 1 }, { group: 'louder', n: 1 }, { group: 'mite3', n: 2 }, { group: 'signs', n: 1 },
      { group: 'shaft1', n: 2 }, { group: 'shaft2', n: 1 }, { group: 'shaft3', n: 1 }, { group: 'shaft4', n: 1 }, { group: 'shaft5', n: 1 }],
    bosses: [{ group: 'want' }], rests: 2, newMechanic: 'listen', dialogueLines: 130, mapTiles: 2400,
  },
  {
    n: 2, title: 'Please Hold', party: ['hello', 'someday'], mech: ['timed', 'answer'],
    shop: ['hello_w3', 'stew', 'stew', 'lozenge', 'lozenge', 'coat3', 'coat3'],
    fights: [{ group: 'wr1', n: 2 }, { group: 'wr2', n: 2 }, { group: 'wr3', n: 2 }, { group: 'wr4', n: 1 }, { group: 'wr5', n: 2 }, { group: 'wr6', n: 1 }, { group: 'wr7', n: 1 }],
    bosses: [{ group: 'bigger' }], rests: 2, newMechanic: 'answer', dialogueLines: 140, mapTiles: 2600,
  },
  {
    n: 3, title: 'The Docket', party: ['hello', 'anyone', 'someday', 'bigger'], joins: { anyone: 10 }, mech: ['timed', 'answer', 'line'],
    shop: ['anyone_w2', 'bigger_w3', 'someday_w3', 'coat4', 'coat3', 'coat3', 'stew', 'stew', 'stew', 'lozenge', 'lozenge', 'honey', 'boots'],
    fights: [{ group: 'dk1', n: 1 }, { group: 'dk2', n: 2 }, { group: 'dk3', n: 2 }, { group: 'dk4', n: 2 }, { group: 'dk5', n: 2 }, { group: 'dk6', n: 1 }, { group: 'dk7', n: 1 }],
    bosses: [{ group: 'supervisor' }], rests: 3, newMechanic: 'line', dialogueLines: 150, mapTiles: 2830,
  },
  {
    n: 4, title: 'Encore', party: ['hello', 'again', 'someday', 'bigger'], joins: { again: 13 }, mech: ['timed', 'answer', 'line', 'rewind'],
    shop: ['hello_w4', 'someday_w4', 'again_w2', 'anyone_w3', 'coat4', 'coat4', 'coat4', 'stew', 'stew', 'stew', 'honey', 'honey', 'picnic'],
    fights: [{ group: 'en1', n: 3 }, { group: 'en2', n: 2 }, { group: 'en3', n: 2 }, { group: 'en4', n: 2 }, { group: 'en5', n: 1 }, { group: 'tw1', n: 2 }, { group: 'tw2', n: 1 }, { group: 'tw3', n: 1 }],
    bosses: [{ group: 'bedtime' }], rests: 4, newMechanic: 'rewind', dialogueLines: 170, mapTiles: 1660,
  },
  {
    n: 5, title: 'Jackpot', party: ['hello', 'someone', 'someday', 'bigger'], joins: { someone: 16 }, mech: ['timed', 'answer', 'line', 'rewind', 'mask'],
    shop: ['bigger_w4', 'anyone_w4', 'again_w3', 'coat5', 'coat5', 'feast', 'feast', 'honey', 'honey', 'bouquet'],
    fights: [{ group: 'jp1', n: 2 }, { group: 'jp2', n: 1 }, { group: 'jp3', n: 1 }, { group: 'jp4', n: 1 }, { group: 'jp5', n: 1 }, { group: 'bout1', n: 1 }, { group: 'bout2', n: 1 }],
    bosses: [{ group: 'house' }], rests: 3, newMechanic: 'mask', dialogueLines: 160, mapTiles: 2010,
  },
  {
    n: 6, title: 'The Unspoken Wood', party: ['hello', 'both', 'someday', 'anyone'], joins: { both: 19 }, mech: ['timed', 'answer', 'line', 'rewind', 'mask'], hush: true,
    shop: ['hello_w5', 'someday_w5', 'anyone_w4', 'again_w4', 'coat6', 'coat6', 'coat6', 'coat6', 'feast', 'feast', 'feast', 'honey', 'honey', 'honey'],
    fights: [{ group: 'wd1', n: 2 }, { group: 'wd2', n: 1 }, { group: 'wd3', n: 1 }, { group: 'wd4', n: 1 }, { group: 'wd5', n: 1 }, { group: 'wd6', n: 1 }],
    bosses: [{ group: 'hush' }, { group: 'linemen' }], rests: 2, newMechanic: 'hush', dialogueLines: 150, mapTiles: 2900,
  },
  {
    n: 7, title: 'The Catch', party: ['hello', 'someday', 'anyone', 'again'], leaves: ['bigger', 'someone'], mech: ['timed', 'answer', 'line', 'rewind', 'mask', 'lastword'],
    shop: ['coat7', 'coat7', 'coat7', 'coat7'],
    fights: [{ group: 'ln1', n: 2 }, { group: 'ln2', n: 2 }, { group: 'ln3', n: 2 }, { group: 'ct1', n: 2 }, { group: 'ct2', n: 1 }, { group: 'ct3', n: 1 }, { group: 'ct4', n: 1 }],
    bosses: [{ group: 'sincerely' }], rests: 2, newMechanic: 'lastword', dialogueLines: 170, mapTiles: 2280,
  },
  {
    n: 8, title: 'The Lonesome Sea', party: ['hello', 'lifeboat', 'bigger', 'anyone'], leaves: ['someday'], joins: { lifeboat: 26, bigger: 0, someone: 0 },
    mech: ['timed', 'answer', 'line', 'rewind', 'mask', 'lastword', 'call'],
    shop: ['anyone_w5', 'bigger_w5', 'again_w5', 'both_w5', 'feast', 'feast', 'honey', 'honey', 'bouquet'],
    fights: [{ group: 'sh1', n: 1 }, { group: 'sh2', n: 1 }, { group: 'sea1', n: 2 }, { group: 'sea2', n: 2 }, { group: 'sea3', n: 1 }, { group: 'wk1', n: 2 }, { group: 'wk2', n: 1 }, { group: 'wk3', n: 1 }],
    bosses: [{ group: 'deadletter' }], rests: 3, newMechanic: 'call', dialogueLines: 180, mapTiles: 3500,
  },
  {
    n: 9, title: 'Amen', party: ['hello', 'lifeboat', 'bigger', 'anyone'], mech: ['timed', 'answer', 'line', 'rewind', 'mask', 'lastword', 'call'],
    shop: ['hello_w6', 'bigger_w6', 'anyone_w6', 'lifeboat_w6', 'coat8', 'coat8', 'coat8', 'coat8', 'feast', 'feast', 'feast', 'honey', 'honey', 'bouquet', 'bouquet'],
    fights: [{ group: 'rt1', n: 2 }, { group: 'rt2', n: 1 }, { group: 'rt3', n: 2 }, { group: 'rt4', n: 2 }, { group: 'rt5', n: 2 }],
    bosses: [{ group: 'amen1' }, { group: 'amen2' }], rests: 2, newMechanic: 'answer', dialogueLines: 200, mapTiles: 2700,
  },
];
