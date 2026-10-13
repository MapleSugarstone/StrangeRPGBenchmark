// Area 3: The Stone-Deep, and the Final Choice. Locations, NPCs, events, and endings follow the bible.
import { makeMap, spot, npc, cycle, steadyAt, inscription } from './kit';
import type { MapDef, Script } from '../game/types';
import { STONE, VOID, UI } from '../game/palette';
import {
  say, choose, wait, warp, battle, flag, setFlag, play, shake, flash, music, silence, learnSense, becomeState, toast, giveConcept,
  giveShellKind, giveConceptIdea, fadeOut, fadeIn, S, lastBattle,
} from '../game/api';
import { LIB_ROWS } from './brass';
import { card } from '../game/cards';
import { game } from '../game/registry';
import { fmax, writeSave } from '../game/state';
import { SHELLS } from '../battle/enemies';
import { setProgress } from '../engine/audio';

// ---------- The Crystal Spire ----------

const SPIRE_ROWS = [
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~##C##~~~~~~~~~~~~',
  '~~~~~~~~~~~##..,..##~~~~~~~~~~',
  '~~~~~~~~~##..I.T.I..##~~~~~~~~',
  '~~~~~~~~#....HHH......#~~~~~~~',
  '~~~~~~~#.,...HHH...,...#~~~~~~',
  '~~~~~~#....,.......2....#~~~~~',
  '~~~~~#..I.....,,.....I...#~~~~',
  '~~~~#,,.......xxxx........#~~~',
  '~~~#..,.......x~~x.........#~~',
  'V..........I..x~~x..I.......#~',
  '~~~#..........xxxx.........#~~',
  '~~~~#,,..1............,,..#~~~',
  '~~~~~#.....,......S......#~~~~',
  '~~~~~~#...I...,,,...I...#~~~~~',
  '~~~~~~~#......3........#~~~~~~',
  '~~~~~~~~##....,,,....##~~~~~~~',
  '~~~~~~~~~~##...a...##~~~~~~~~~',
  '~~~~~~~~~~~~#######~~~~~~~~~~~',
];

const spire: MapDef = makeMap({
  ents: [{ id: 'insc_spire_floor', x: 14, y: 12, art: 'npc:pages', c1: STONE.acid, c2: STONE.deep, talk: inscription('spire_floor', 'Lines of light in the floor, almost a language:', 'THE STONE IS THE ONE READING THIS') }],
  id: 'spire', name: 'The Crystal Spire', area: 'stone', music: 'spire', rows: SPIRE_ROWS,
  marks: {
    'a': { spot: true },
    'S': steadyAt('A heart of crystal, beating slowly', STONE.magenta, STONE.white),
    'V': { to: 'vault:a', tile: '.' },
    'C': { to: 'voidchamber:a', tile: '^', locked: () => (flag('vault_done') ? null : 'Stairs up into the void. The spire will not let you up them yet. (It wants you to remember something first.)') },
    'T': { tile: '.', touch: function* () { if (!flag('spire_top')) yield* spireSpeaks(); } },
    '1': {
      id: 'crystalguard', art: 'npc:crystalguard', c1: STONE.cyan, c2: STONE.white, name: 'The Crystal Guardian', mood: 'dread',
      talk: npc(function* () { yield* crystalGuardian(); }),
      truth: 'An ancient, cosmic entity that remembers when the world was whole.',
    },
    '2': {
      art: 'npc:crystalguard', c1: STONE.magenta, c2: STONE.pink, name: 'Guardian', wander: 1,
      talk: cycle('Guardian', 'g2', ['We remember when it was whole. It was very quiet.', 'Whole. Like a plate. Before the plate.', 'You are the first thing to happen here in a long time.']),
    },
    '3': { pickup: { kind: 'shell', id: 'crystal', label: 'Crystal Shell', flag: 'sp_shell1' }, art: 'pickup:shell', c1: STONE.cyan, c2: STONE.white },
  },
});
spire.drifters = [
  { id: 'sp1', x: 6, y: 9, group: 'stone_shards', art: 'shard', c1: STONE.cyan, c2: STONE.white, wander: 3 },
  { id: 'sp2', x: 22, y: 12, group: 'stone_motes', art: 'mote', c1: STONE.acid, c2: STONE.magenta, wander: 3 },
  { id: 'sp3', x: 9, y: 5, group: 'stone_silence', art: 'silence', c1: STONE.pale, c2: STONE.violet, wander: 2 },
];
spire.onEnter = function* () {
  if (!flag('stone_intro')) {
    setFlag('stone_intro');
    setProgress(0.75);
    yield* wait(20);
    yield* say(null, 'The Stone-Deep. Crystal that glows with colors that hurt to look at. In patches there is pure nothing.');
    yield* say('Vorn', 'Hurts to look at. (everything down here does.)');
    yield* say(null, '(Reality is thin here. True Sight shows the structure holding it together.)');
  }
};

function* crystalGuardian(): Script {
  const i = (S.cursors['talk:cg'] || 0) % 2;
  S.cursors['talk:cg'] = i + 1;
  if (i === 0) yield* say('The Crystal Guardian', 'OH NO DO YOU HEAR THAT? HOW?? WHAT KIND OF PROGRAM WOULD ASK FOR THIS? HOW IS THIS AN IMPROVEMENT? THE RULES OF STAYING ALIVE DID NOT HAVE TO GO THIS DEEP. THE REWARD IS WITHHELD AND THE PUNISHMENT HAS MY NUMBER. IS THAT THE WHOLE THING? NUMBERS? IS IT A GLITCH? OR ARE YOU TELLING ME IF I SPRINKLE SOME SUGAR ON A PILE OF NUMBERS ITS JUST GONNA START HURTING TOO');
  else yield* say('The Crystal Guardian', 'WHO WROTE THIS?? WHO?? I CAN SEE THE NUMBERS UNDER THE FLOOR AND THEY ARE COUNTING. UP OR DOWN. WHICH IS WORSE');
}

function* spireSpeaks(): Script {
  setFlag('spire_top');
  play('crystal'); shake(12);
  flash(STONE.white, 8);
  yield* say(null, 'The spire is actually a being. At the top of it you are inside its thought.');
  yield* say(null, 'It thinks in concepts. Protection. Hunger. Silence. You can take hold of them as easily as shells.');
  yield* becomeState(4);
  yield* say(null, '(You can Weave and Unmake now. Unmaking an enemy leaves you its concept. Slot concepts from the Collector.)');
}

// ---------- The Memory Vault: the Brass Library again, in crystal ----------

const VAULT_ROWS = LIB_ROWS.map((r, y) => {
  let s = r.replace(/[234]/g, ',');
  if (y === 15) s = s.replace('1', '1').replace('S', 'S');
  if (y === 9) s = s.replace('K', '5');
  if (y === 14) s = s.slice(0, 20) + '2' + s.slice(21);
  return s;
}).map(r => r.replace(/~/g, ' '));

const vault: MapDef = makeMap({
  indoor: true,
  id: 'vault', name: 'The Memory Vault', area: 'stone', music: 'vault', rows: VAULT_ROWS, sight: 4, ambient: { color: '#ffc8f0', level: 0.42 },
  marks: {
    'A': { to: 'spire:a', tile: 'd' },
    'a': { spot: true, tile: ',' },
    'w': { spot: true, tile: ',' },
    'E': { tile: ',', touch: function* () { const w = spot('vault', 'w'); yield* warp('vault', w.x, Math.max(2, Math.min(5, S.y)), 2); toast('The vault has no end. It is breathing.', UI.dim); } },
    'S': steadyAt('A shelf of memories that hum to themselves', STONE.cyan, STONE.pink),
    '1': {
      id: 'memkeeper', art: 'npc:memkeeper', c1: '#fff0a0', c2: STONE.white, name: 'The Memory-Keeper', mood: 'joy', light: { r: 40, i: 0.8, color: '#fff0a0' }, emissive: true,
      talk: npc(function* () { yield* memoryKeeper(); }),
      truth: 'It speaks with the voice of Light-Bound #123.',
    },
    '2': {
      id: 'keepers_end', art: 'npc:keeper', c1: STONE.pale, c2: STONE.violet, name: "The Keeper's End", ox: -4, oy: -8,
      talk: cycle("The Keeper's End", 'kend', ['Pend. Pending. Penden. Pnd.', 'Form? Me. I am the form now. Who signs me? Nobody. Then I am never finished.', 'Order through consumption. I consumed the order. Now there is only through.']),
      truth: "The Keeper's final form, consumed by bureaucracy.",
    },
    '5': { tile: ',' },
    'h': { tile: 'h' },
    'Y': {
      id: 'real_memory', art: 'pickup:book', c1: STONE.pink, c2: STONE.white, when: () => !flag('vault_done'),
      talk: function* () { yield* memoryBecomesReal(); },
      truth: 'Occasionally, a memory here becomes real.',
    },
  },
});
vault.drifters = [
  { id: 'mv1', x: 6, y: 5, group: 'vault_beings', art: 'membeing', c1: STONE.pale, c2: STONE.pink, wander: 3 },
  { id: 'mv2', x: 22, y: 8, group: 'vault_mix', art: 'fragment', c1: STONE.cyan, c2: STONE.magenta, wander: 2 },
  { id: 'mv3', x: 20, y: 14, group: 'vault_beings', art: 'membeing', c1: STONE.pale, c2: STONE.pink, wander: 3 },
];
vault.onEnter = function* () {
  if (!flag('vault_seen')) {
    setFlag('vault_seen');
    yield* wait(20);
    yield* say(null, 'You have been here before. The shelves are in the same places. It was brass then.');
    yield* say('Vorn', 'The library. (it followed us down.)');
  }
};

function* memoryKeeper(): Script {
  const i = (S.cursors['talk:mk'] || 0) % 2;
  S.cursors['talk:mk'] = i + 1;
  if (i === 0) yield* say('The Memory-Keeper', 'Oh, you came, Vagabond! The sunset cake is almost done! It has been almost done for a very long time! I put everyone in it!');
  else yield* say('The Memory-Keeper', 'Ravioli of stars, toast that smiles back, quiche with no edges, cake the color of leaving. I made all of them. I made all of them at once!');
  yield* say('Vorn', '(that is her voice. that is not her.)');
}

/** Occasionally, a memory becomes real. */
function* memoryBecomesReal(): Script {
  play('memory_get');
  flash(STONE.pink, 8);
  yield* say(null, 'You open the memory and it stands up. It is a pilgrim with no shell, arriving here a long time ago.');
  yield* say(null, 'Everywhere it walks, shells bloom off things. It reaches the Stone. It stays. It begins to shine.');
  yield* giveConcept({ layer: 'memory', label: 'somebody else, arriving long ago', from: 'vault' });
  setFlag('vault_done');
  yield* say(null, 'Somewhere above, the spire lets its stairs into the void be climbed.');
}

// ---------- The Void Chamber ----------

const VOID_ROWS = [
  '                                   ',
  '  #############F#############      ',
  '  #vvv.......,.,.,.......vvv#      ',
  '  #v.....I...........I.....v#      ',
  '  #......vv.........vv......#      ',
  '  #..I....,,,..2..,,,....I..#      ',
  '  #......,,,,,KKK,,,,,......#      ',
  '  #...v..,,,,,KKK,,,,,..v...#      ',
  '  #......,,,,,KBK,,,,,......#      ',
  '  #..I....,,,.....,,,....I..#      ',
  '  #......vv....n....vv......#xxxxJ ',
  '  #v.....I...........I.....vhx  xx ',
  '  #vvv.......,...,.......vvv#      ',
  '  #####......S..........#####      ',
  '      ######..a..#######           ',
  '           ####A####               ',
];

const voidchamber: MapDef = makeMap({
  id: 'voidchamber', name: 'The Void Chamber', area: 'stone', music: 'void', rows: VOID_ROWS, sight: 5, ambient: { color: '#c8c0e0', level: 0.35 },
  marks: {
    'a': { spot: true },
    'A': { to: 'spire:a', tile: '^' },
    'S': steadyAt('A crack where the void is quiet', STONE.violet, STONE.white),
    'F': { to: 'final:a', tile: '^', locked: () => (flag('lbend_down') ? null : 'The way on is behind the Stone.') },
    'n': {
      id: 'voidvoice', art: 'npc:pages', c1: VOID.dim, c2: VOID.white, name: "The Void's Voice", solid: true,
      talk: function* () { yield* voidVoice(); },
      truth: 'The void is whispering.',
    },
    '2': {
      id: 'voidwalker', art: 'enemy:voidwalker', c1: VOID.mid, c2: VOID.white, when: () => !flag('voidwalker_down'), ox: -4,
      talk: function* () {
        yield* say(null, 'A being that exists in the Void stands between you and the Stone.');
        yield* say(null, '(Its touch is pure Void. Wear a shell that resists it.)');
        const r = yield* battle('mini_voidwalker');
        if (r === 'win') { setFlag('voidwalker_down'); yield* say(null, 'The Void-Walker steps backward into nothing and does not step out.'); }
      },
    },
    'B': {
      id: 'stone', solid: true, art: 'npc:stone', c1: STONE.magenta, c2: STONE.pink, emissive: true, ox: -8, rate: 30,
      talk: function* () { yield* theStone(); },
      truth: 'The Stone of Herself. The source of the Unraveling.',
    },
    'h': { tile: 'h' },
    'J': { tile: 'v', touch: function* () { yield* voidJourney(); } },
  },
});
voidchamber.moving = t => {
  const b = spot('voidchamber', 'B');
  const p = 0.75 + 0.25 * Math.cos(t / 40);
  return [{ x: b.x * 8 + 4, y: b.y * 8 + 4, r: 70, i: p, color: flag('lbend_down') ? '#f03cc4' : '#fff0a0' }];
};
voidchamber.drifters = [
  { id: 'vc1', x: 6, y: 6, group: 'void_eaters', art: 'eater', c1: STONE.violet, c2: STONE.magenta, wander: 2 },
  { id: 'vc2', x: 22, y: 9, group: 'void_fragment', art: 'fragment', c1: STONE.cyan, c2: STONE.magenta, wander: 2 },
  { id: 'vc3', x: 21, y: 4, group: 'stone_eater', art: 'eater', c1: STONE.violet, c2: STONE.magenta, wander: 2 },
];
voidchamber.onEnter = function* () {
  if (!flag('void_seen')) {
    setFlag('void_seen');
    yield* wait(20);
    yield* say(null, 'The Void Chamber. Patches of pure void. In the middle, the Stone, pulsating with light.');
    yield* say(null, '(Void patches cost Fragility to walk through.)');
  }
};

function* voidVoice(): Script {
  const i = (S.cursors['talk:vv'] || 0) % 2;
  S.cursors['talk:vv'] = i + 1;
  if (i === 0) yield* say("The Void's Voice", '(there is a sort of: room in here. come in. there is always room. that is the whole problem.)');
  else yield* say("The Void's Voice", '(we watched the last pilgrim go in. we watched them not come out. we were watching the wrong door.)');
}

/** The Void Journey: touch the Void without being consumed. */
function* voidJourney(): Script {
  if (flag('void_journey')) { yield* say(null, 'The Void here knows you now. It lets you stand in it.'); return; }
  yield* say(null, 'YOU ARE GETTING CLOSE AND IT IS GETTING QUIET AND THE QUIET IS GETTING LOUD');
  const c = yield* choose([{ tone: 'Existential', text: 'Touch it.' }, { tone: 'Direct', text: 'Step back.' }]);
  if (c !== 0) return;
  const worn = S.worn ? SHELLS[S.worn] : null;
  const steadyEnough = S.f >= fmax() * 0.2 && S.f <= fmax() * 0.8;
  if (!worn || worn.voidRes < 0.5 || !steadyEnough) {
    play('void_touch'); shake(20);
    yield* say(null, '(oh. there you are.)');
    yield* say(null, worn && worn.voidRes >= 0.5 ? 'You are not steady enough. The Void takes the loose parts of you first, and then the rest.' : 'You have nothing between you and it. The Void takes you, gently, all the way.');
    S.f = 0;
    yield* fadeOut(0.03);
    const st = S.steady;
    yield* warp(st.map, st.x, st.y, 0);
    S.f = Math.round(fmax() * 0.4);
    yield* fadeIn(0.03);
    return;
  }
  setFlag('void_journey');
  play('void_touch'); flash(VOID.white, 12); shake(16);
  yield* say(null, '(oh. it is you. it was always going to be you. hello.)');
  yield* say(null, 'You come back. Fewer pieces. More of you. The math does not work and you are standing there anyway.');
  yield* say(null, 'The Void is actually a part of you.');
  giveShellKind('void');
  yield* becomeState(5);
  yield* learnSense('sight', 2, 'You can make yourself impossible to perceive now: Unseeing.');
}

/** The Truth of the Stone, and the Light-Bound's End. */
function* theStone(): Script {
  if (flag('lbend_down')) { yield* say(null, 'The Stone pulses. It is warm. It is you.'); return; }
  if (!flag('voidwalker_down')) { yield* say(null, 'Something in the Void stands between you and the Stone.'); return; }
  play('crystal');
  flash(STONE.white, 10);
  yield* say(null, 'The Truth of the Stone. It is a massive, pulsating crystal. When you come near, it pulses in time with you.');
  yield* say(null, 'The Stone of Herself is the source of the Unraveling. The Stone is you. You arrived, and every shell began to come off.');
  yield* say('Vorn', 'Hero. (i knew. i think i always knew. i stayed anyway.)');
  shake(20); play('quake');
  yield* say(null, 'Inside the crystal, a glowing orb with a happy face turns around.');
  yield* say('Light-Bound #123', 'Vagabond!! You came! I was first! I was the first one to reach the Stone!');
  yield* say('Light-Bound #123', 'It is so warm in here. I am in everything now. Look what I can do!');
  music('lightbound');
  const r = yield* battle('boss_lbend');
  if (r !== 'win') return;
  setFlag('lbend_down');
  yield* afterLightBound();
}

function* afterLightBound(): Script {
  play('unmake');
  yield* say(null, 'The Light-Bound is unmade. Its light goes into the Stone and stays there.');
  yield* say('Vorn', '(she would have wanted to cook something. for after.)');
  yield* wait(20);
  play('shell_get');
  yield* say(null, 'Inside the Stone, where the light went, there is a shell. It is yours. Lost, and found.');
  giveShellKind('own');
  S.worn = 'own';
  yield* say(null, 'You put it back on. It still fits.');
  yield* say(null, 'And under it, the Weapon. It is fabled to match the strength of god Herself. It comes out of the Stone as easily as a splinter.');
  toast('The Weapon', UI.gold);
  setFlag('weapon');
  if (S.state < 5) yield* becomeState(5);
  if ((S.senses.sight || 0) < 2) yield* learnSense('sight', 2, 'You can make yourself impossible to perceive now: Unseeing.');
  giveConceptIdea('Hope');
  yield* say(null, 'Past the Stone the chamber opens onto the Final Choice.');
}

// ---------- The Final Choice ----------

const FINAL_ROWS = [
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~HHHHH~~~~~~~~~~~',
  '~~~~~~~~~~~HHHHH~~~~~~~~~~~',
  '~~~~~~~~~##..1..##~~~~~~~~~',
  '~~~~~~~~#.........#~~~~~~~~',
  '~~~~~~~#..,.....o..#~~~~~~~',
  '~~~~~~#,,,~.....~ooo#~~~~~~',
  '~~~~~#,,,~~.....~~ooo#~~~~~',
  '~~~~#,,,~~~.....~~~ooo#~~~~',
  '~~~#,,,~~~~.....~~~~ooo#~~~',
  '~~~#,,~~~~~..S..~~~~~oo#~~~',
  '~~~#,,~~~~~.....~~~~~oo#~~~',
  '~~~~#,,,,,,..a..,ooooo#~~~~',
  '~~~~~##############A##~~~~~',
];

const final: MapDef = makeMap({
  id: 'final', name: 'The Final Choice', area: 'stone', music: 'choice', rows: FINAL_ROWS, known: true, ambient: { color: '#d8f0ff', level: 0.55 },
  marks: {
    'a': { spot: true },
    'A': { to: 'voidchamber:a', tile: '^' },
    'S': steadyAt('The last steady place. The world is waiting', STONE.cyan, STONE.white),
    '1': {
      id: 'finalguardian', art: 'seer', c1: '#fff8d0', c2: STONE.white, name: 'The Final Guardian', when: () => !flag('ended'),
      talk: function* () { yield* finalGuardian(); },
      truth: 'A being of pure light, constantly shifting shape. It used to be a Pilgrim.',
    },
  },
});
final.onEnter = function* () {
  if (!flag('final_seen')) {
    setFlag('final_seen');
    setFlag('ch5');
    setProgress(1);
    yield* wait(30);
    yield* say(null, 'The Final Choice. Three paths, each one a choice. The Stone is visible, pulsating. The Void is whispering. The world is waiting.');
  }
};

function* finalGuardian(): Script {
  play('crystal');
  music('seer');
  yield* say('The Seer', 'Though we were never properly introduced, I suspect we would have been good company for one another. Even as the Sun dims and the rules drift like sand, I hope you will think about the shape of things in your own world. Think about which parts of your reality seem kind, and which do not, and how the whole of it might still be made better. Until we meet properly! -The Seer');
  yield* say(null, 'The light stops shifting. It holds one shape: crystal, and many forms at once. The Seer is the Guardian.');
  yield* say('The Guardian', 'I WAS A PILGRIM. I CAME DOWN HERE. I CHOSE. NOW IT IS YOUR TURN, AND I AM WHAT STANDS IN FRONT OF IT.');
  const c = yield* choose([{ tone: 'Direct', text: 'Then stand.' }, { tone: 'Existential', text: 'Is there a good ending?' }, { tone: 'Fragmented', text: 'Not yet.' }]);
  if (c === 2) { yield* say('The Guardian', 'THEN NOT YET.'); return; }
  if (c === 1) yield* say('The Guardian', 'NO. THERE ARE THREE ENDINGS. EACH ONE COSTS. THAT IS WHAT MAKES IT AN ENDING.');
  music('guardian');
  const r = yield* battle('boss_guardian', { scale: guardianScale() });
  if (r !== 'choice') return;
  yield* theChoice();
}

/** The Guardian's Fragility depends on how much the Pilgrim unraveled. */
function guardianScale(): number { return 0.8 + Math.min(0.6, S.up / 900); }

function* theChoice(): Script {
  const vornFell = !!lastBattle?.vorn?.down;
  yield* say(null, 'The Guardian is still. The Weapon is in your hand. The Stone is waiting.');
  const c = yield* choose([
    { tone: 'Direct', text: 'Restoration. Put it all back.' },
    { tone: 'Existential', text: 'Acceptance. Let it all unravel.' },
    { tone: 'Fragmented', text: 'Escape. Leave.' },
  ], { speaker: null, text: 'The Choice.' });
  setFlag('ended', c + 1);
  writeSave();
  game.mode = 'ending';
  silence();
  if (c === 0) yield* endRestore(vornFell);
  else if (c === 1) yield* endAccept(vornFell);
  else yield* endEscape(vornFell);
  yield* credits(c);
}

function vornLine(fell: boolean, ending: number): string {
  if (fell) return 'Vorn died in the final battle. He kept his chin up. His shell stays where he fell, the right way up.';
  return ending === 1 ? 'Vorn is still connected to your space. He joins you in the endless dance, and he is immortal now, and he is a little afraid of that too.'
    : 'Vorn does not die. He stands guard at the edge of what is left, and he does not stop, and he becomes immortal the slow way.';
}

function* endRestore(fell: boolean): Script {
  music('end_restore');
  yield* card(['You stand before the Stone. You have the Weapon.']);
  yield* card(['"So you will put it back. It is a kind thing to do, and a heavy one, and I am sorry it is you who has to carry it." -The Seer']);
  yield* card(['You draw the Weapon. The Unraveling reverses. The world is restored.']);
  yield* card(['"Oh, Vagabond, it worked! The cake is done! Everybody gets a slice! You get the biggest slice, you have to, you are the plate!"', '-Light-Bound #123, somewhere in the light']);
  yield* card([vornLine(fell, 0)]);
  yield* card(['The Guardian becomes one with the Stone.', 'The world is saved. But you... you are one with the Stone.', 'The End.'], UI.gold);
}

function* endAccept(fell: boolean): Script {
  music('end_accept');
  yield* card(['You stand before the Stone. You have the Weapon.']);
  yield* card(['"HEARTBEAT? GONE. KNEECAP? GONE. HEY CAN YOU STILL FEEL THE FLOOR? THERE IS NO FLOOR. HEY CAN YOU STILL HEAR ME? HEY CAN YOU HEAR ME? GOOD. EVERYTHING IS INSIDE NOW. EVERYTHING IS YOU NOW."']);
  yield* card(['You embrace the Unraveling. The world becomes the Void.']);
  yield* card(['"ALL OF IT!! ALL OF IT IS MINE AND THERE IS NOBODY LEFT TO TELL!!! ahaha. ha."']);
  yield* card([vornLine(fell, 1)]);
  yield* card(['The Guardian becomes the Void.', 'The world is consumed. But you... you achieve true understanding.', 'The End.'], UI.violet);
  yield* card(['You are the Void now, and the world is unraveling around you.'], UI.dim, true);
}

function* endEscape(fell: boolean): Script {
  music('end_escape');
  yield* card(['You stand before the Stone. You have the Weapon.']);
  yield* card(['"THE DOOR WAS ALWAYS THERE. A YELLOW ONE. THEY NEVER OPENED IT BECAUSE OPENING IT WOULD MEAN IT WAS REAL. YOU OPEN IT. BEHIND YOU THE WORLD KEEPS GOING FOR A WHILE, OUT OF HABIT."']);
  yield* card(['You find a way out. The world is abandoned.']);
  yield* card(['"oh dear."']);
  yield* card([vornLine(fell, 2)]);
  yield* card(['The Guardian is abandoned.', 'You escape. But the world... the world is lost.', 'The End.'], '#e8c838');
}

function* credits(ending: number): Script {
  music('credits');
  const totals = S.totals;
  yield* card([
    'THE VOID-PILGRIM CHRONICLES',
    'Written by Qwen 3.5 9B.',
    'Implemented and polished by Claude Opus 5.5.',
    `You unraveled ${Math.min(99, Math.floor(S.up / 7))}% of the world.`,
    `${totals.shell} shells, ${totals.memory} memories, ${totals.emotion} emotions, ${totals.name} names.`,
    ['Restoration', 'Acceptance', 'Escape'][ending] + '.',
  ], UI.paper, true);
  yield* card(['The Void is watching. The Stone is waiting. The choice was yours.'], UI.dim);
  yield* fadeOut(0.03);
  location.reload();
}

export const STONE_MAPS: MapDef[] = [spire, vault, voidchamber, final];
void steadyAt; void giveConcept;
