import type { MemberDef } from '../battle/types';

const S = (hp: number, vp: number, pow: number, wit: number, grd: number, spd: number) => ({ hp, vp, pow, wit, grd, spd });

export const MEMBERS: Record<string, MemberDef> = {
  hello: {
    id: 'hello', name: 'Hello', cls: 'Receiver',
    sprite: { t: 'hero', seed: 'hello', a: 'paper', b: 'teal' },
    prayer: '(the words are still coming in)',
    bio: 'Came up out of the Shallows six years ago, fully grown, and said "Hello?" as if picking up a call.',
    base: S(44, 14, 9, 9, 6, 11), growth: S(7.5, 1.6, 1.5, 1.6, 1.1, 0.55),
    learn: [[1, 'listen'], [1, 'ring'], [3, 'pickup'], [6, 'dialtone'], [9, 'hotline'], [13, 'stay'], [17, 'longdist'], [22, 'collect'], [27, 'hello']],
    atkElem: 'blunt', weapons: 'hello',
  },
  someday: {
    id: 'someday', name: 'Someday', cls: 'Dredger',
    sprite: { t: 'person', seed: 'someday3', a: 'tan', b: 'rust' },
    prayer: "Someday I won't be here, so please send someone to look after my little one.",
    bio: 'An old dredger with a hook and a pipe of dried slips. Looks after everyone, since the little one never came.',
    base: S(54, 10, 11, 6, 8, 9), growth: S(8.5, 1.1, 1.8, 0.9, 1.3, 0.45),
    learn: [[1, 'hook'], [1, 'digin'], [4, 'pipe'], [7, 'undertow'], [11, 'dredge'], [15, 'oldtrick'], [20, 'deepcut']],
    atkElem: 'edge', weapons: 'someday',
  },
  bigger: {
    id: 'bigger', name: 'Bigger', cls: 'Good Boy',
    sprite: { t: 'dog', seed: 'bigger', a: 'gold', b: 'red' },
    prayer: 'I wish my dog was bigger, so he can protect me.',
    bio: 'A dog the size of a house. Grows a little every day, and a little more every turn.',
    base: S(72, 8, 12, 4, 9, 8), growth: S(11, 0.8, 1.9, 0.5, 1.4, 0.4),
    learn: [[1, 'bite'], [1, 'liedown'], [1, 'bark'], [5, 'fetch'], [9, 'grow'], [14, 'zoomies'], [19, 'goodboy'], [24, 'bellyflop']],
    atkElem: 'edge', weapons: 'bigger',
  },
  anyone: {
    id: 'anyone', name: 'Anyone', cls: 'Operator',
    sprite: { t: 'robed', seed: 'anyone2', a: 'white', b: 'navy' },
    prayer: 'Is anyone there? Please. Anyone.',
    bio: 'A Switchboard Saint who must answer every call. Cut off from the chorus for helping you.',
    base: S(40, 18, 7, 11, 6, 12), growth: S(6.5, 2.0, 1.0, 1.8, 1.0, 0.6),
    learn: [[1, 'hold'], [1, 'patch'], [1, 'static'], [4, 'assist'], [8, 'conference'], [12, 'disconnect'], [16, 'switchover'], [21, 'surge']],
    atkElem: 'spark', weapons: 'anyone',
  },
  again: {
    id: 'again', name: 'Again', cls: 'Encore',
    sprite: { t: 'child', seed: 'again', a: 'pink', b: 'sky' },
    prayer: 'Please let tomorrow be today again.',
    bio: 'A child who held a whole village inside one perfect day. Can rewind a fight once.',
    base: S(36, 16, 7, 11, 5, 13), growth: S(6, 1.8, 1.0, 1.8, 0.9, 0.7),
    learn: [[1, 'encore'], [1, 'dejavu'], [1, 'yesterday'], [4, 'naptime'], [9, 'tomorrow'], [13, 'fivemore'], [18, 'replay']],
    atkElem: 'chill', weapons: 'again',
  },
  someone: {
    id: 'someone', name: 'Someone Else', cls: 'Mask',
    sprite: { t: 'person', seed: 'someone7', a: 'lilac', b: 'plum' },
    prayer: 'I wish I were someone else.',
    bio: 'Has no face of their own. Wears the faces of kept prayers and uses what those faces know.',
    base: S(42, 14, 10, 10, 6, 13), growth: S(7, 1.5, 1.5, 1.5, 1.0, 0.65),
    learn: [[1, 'impersonate'], [1, 'loaded'], [1, 'metoo'], [6, 'cutdeck'], [12, 'bluff'], [18, 'reveal']],
    atkElem: 'edge', weapons: 'someone',
  },
  both: {
    id: 'both', name: 'Both', cls: 'Twin Knight',
    sprite: { t: 'twin', seed: 'both', a: 'cream', b: 'orange' },
    prayer: 'Let me be first! / No, let ME be first!',
    bio: 'One body, two heads: First and Firster. Each head takes its own action every turn.',
    base: S(66, 12, 12, 6, 9, 10), growth: S(9.5, 1.2, 1.8, 0.8, 1.3, 0.5),
    learn: [[1, 'mefirst'], [1, 'lunge'], [8, 'shieldwall'], [16, 'photofinish']],
    learn2: [[1, 'nome'], [1, 'race'], [8, 'dare'], [16, 'firstest']],
    atkElem: 'edge', weapons: 'both', twin: true,
  },
  lifeboat: {
    id: 'lifeboat', name: 'Lifeboat', cls: 'Rescue',
    sprite: { t: 'robot', seed: 'lifeboat', a: 'orange', b: 'white' },
    prayer: 'Mayday. Please. Send rescue.',
    bio: 'A rescue robot that arrived nine thousand years late. It has been waiting to rescue someone ever since.',
    base: S(56, 16, 9, 10, 10, 9), growth: S(8, 1.7, 1.3, 1.6, 1.4, 0.45),
    learn: [[1, 'evacuate'], [1, 'tow'], [1, 'hull'], [1, 'foghorn'], [1, 'medkit'], [24, 'ramming'], [27, 'beacon']],
    atkElem: 'spark', weapons: 'lifeboat',
  },
};

export const MEMBER_ORDER = ['hello', 'someday', 'bigger', 'anyone', 'again', 'someone', 'both', 'lifeboat'];

// A Calling is the choice each member makes at CALLING_LVL. Mods are added per level, so the gap widens as they grow.
export interface CallingDef { id: string; name: string; desc: string; mods: Partial<Record<keyof ReturnType<typeof S>, number>>; learn: [number, string][]; learn2?: [number, string][]; }
export const CALLING_LVL = 10;

export const CALLINGS: Record<string, [CallingDef, CallingDef]> = {
  hello: [
    { id: 'listener', name: 'Listener', desc: 'Hears what others miss. More voice and wit, a little less punch.', mods: { wit: 0.35, vp: 0.3, pow: -0.15 }, learn: [[10, 'hearout'], [18, 'callback']] },
    { id: 'caller', name: 'Caller', desc: 'Says it louder. More power and speed, a little less voice.', mods: { pow: 0.35, spd: 0.12, vp: -0.2 }, learn: [[10, 'wrongnum'], [18, 'speeddial']] },
  ],
  someday: [
    { id: 'lineman', name: 'Lineman', desc: 'Her old trade, used the other way. Puts foes on hold and reads their names.', mods: { wit: 0.3, spd: 0.1 }, learn: [[10, 'readname'], [18, 'ladder']] },
    { id: 'dredger', name: 'Dredger', desc: 'Digs in and drags people back out. Tougher, and steadier.', mods: { grd: 0.3, hp: 1.5 }, learn: [[10, 'haulup'], [18, 'mudwall']] },
  ],
  bigger: [
    { id: 'guarddog', name: 'Guard Dog', desc: 'Stands over the small ones. Tougher, with more health.', mods: { grd: 0.35, hp: 2 }, learn: [[10, 'standover'], [18, 'growl']] },
    { id: 'bigdog', name: 'Big Dog', desc: 'Just bigger. Hits much harder, a little slower.', mods: { pow: 0.4, spd: -0.05 }, learn: [[10, 'pounce'], [18, 'shakeoff']] },
  ],
  anyone: [
    { id: 'saint', name: 'Saint', desc: 'Answers every call for help. More voice and wit for healing.', mods: { wit: 0.3, vp: 0.4 }, learn: [[10, 'chorus'], [18, 'prayerline']] },
    { id: 'switch', name: 'Switch', desc: 'Routes trouble where it belongs. Faster, and tangles whole crowds.', mods: { spd: 0.15, wit: 0.15 }, learn: [[10, 'crossed'], [18, 'busysig']] },
  ],
  again: [
    { id: 'rerun', name: 'Rerun', desc: 'Plays the good parts again. More voice, and helps allies act twice.', mods: { vp: 0.3, wit: 0.2 }, learn: [[10, 'secondtake'], [18, 'rewrite']] },
    { id: 'overtime', name: 'Overtime', desc: 'Keeps the day going past bedtime. Strong chill and slowing.', mods: { wit: 0.35, spd: 0.05 }, learn: [[10, 'latebell'], [18, 'lastday']] },
  ],
  someone: [
    { id: 'understudy', name: 'Understudy', desc: 'Learns every part. Steadier, and helps the party dodge.', mods: { wit: 0.25, spd: 0.1 }, learn: [[10, 'method'], [18, 'curtain']] },
    { id: 'grifter', name: 'Grifter', desc: 'Works the mark. Harder hits that steal health back.', mods: { pow: 0.3, spd: 0.1 }, learn: [[10, 'mark'], [18, 'skim']] },
  ],
  both: [
    { id: 'truce', name: 'Truce', desc: 'First and Firster agree, for once. Tougher, and they guard the party.', mods: { grd: 0.3, hp: 1.5 }, learn: [[10, 'backtoback']], learn2: [[10, 'sharedshield']] },
    { id: 'rivalry', name: 'Rivalry', desc: 'First and Firster compete. More power, more hits.', mods: { pow: 0.35, spd: 0.05 }, learn: [[10, 'whosfaster']], learn2: [[10, 'photoop']] },
  ],
  lifeboat: [
    { id: 'rescue', name: 'Rescue', desc: 'Its first purpose. More voice for heals and pulling people out.', mods: { wit: 0.3, vp: 0.3 }, learn: [[10, 'triage'], [18, 'airlift']] },
    { id: 'salvage', name: 'Salvage', desc: 'Turns the wreck into weapons. Much more power.', mods: { pow: 0.35 }, learn: [[10, 'scrapcannon'], [18, 'ballast']] },
  ],
};

export function callingOf(id: string, calling?: string): CallingDef | undefined {
  return calling ? CALLINGS[id]?.find((k) => k.id === calling) : undefined;
}

export function xpNext(lvl: number): number {
  return Math.round(14 * Math.pow(lvl, 1.75));
}
