// Area 1: The Brass Dreamscape. Locations, NPCs, and events follow AREA_SCRIPTS.md.
import { makeMap, spot, npc, cycle, steadyAt, inscription, type Mark } from './kit';
import type { MapDef, Script } from '../game/types';
import { BRASS, UI } from '../game/palette';
import {
  say, lines, choose, wait, walk, walkTo, face, warp, battle, flag, setFlag, play, shake, flash, music, fadeIn, learnSense, becomeState,
  joinLb, joinVorn, steadyHere, toast, giveConcept, place, setArt, F, S,
} from '../game/api';
import { loadMap, seedTrail, ent, setFollowers } from '../game/field';
import { fmax } from '../game/state';
import { setProgress } from '../engine/audio';
import { card } from '../game/cards';
import { game } from '../game/registry';

const LBC = { c1: '#fff0a0', c2: '#ffffff' };
const VORNC = { c1: '#6a7a8c', c2: '#a0542c' };
const FLESH = ['#d89a78', '#b8785a', '#e0b090', '#9a6a4a'];
const CLOTH = ['#5a4a8a', '#3a6a5a', '#8a3a4a', '#4a5a8a'];

const steadyMark = (label: string): Mark => steadyAt(label, BRASS.gold, BRASS.steam);

// ---------- The Clockwork Plaza ----------

const PLAZA_ROWS = [
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~#######################~~~~~~~~~~~~',
  '~~~~~~~##c#Y#c###X###c#Z#c####~~~~~~~~~~~~',
  '~~~~~~#,,,,,,,,,,l,,,,,z,,,,,,#~~~~~~~~~~~',
  '~~~~~#,,7,,,,,,,,,,,,,,,,,,,7,,#~~~~~~~~~~',
  '~~~~#,,,,,,,P..........P,,,,,,,,#~~~~~~~~~',
  '~~~#,,,,,,,..,,,,,,,,,,..,,,,5,,,#~~~~~~~~',
  '~~~,,,T,,,,.,,s,,,,,,s,,.,,,,,,,,,,,~~~~~~',
  'Aa=,,,,,,,,.,,,,FS,,,,,.,,,,,,,,,,,,,e=W=E',
  '~~~,,,,,,,,.,,,,FF,,,,,.,,,,,,,,,,,,,,=V=E',
  '~~~#,,,,5,,.,,s,@4,,s,.,,,,,,,,,,,#~~~~~~~',
  '~~~~#,,,,,,..,,,H,,6,..,,,,,,,,,,#~~~~~~~~',
  '~~~~~#,,,,,,P..........P,,,,,,,,#~~~~~~~~~',
  '~~~~~~#,,7,,,,,,,1,,,,,,,,,7,,,#~~~~~~~~~~',
  '~~~~~~~##,,,,,,,,,,,,,,,,,,,,##~~~~~~~~~~~',
  '~~~~~~~~~####,,,,,,,,,,#####~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~#,,,,R,,,#~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~#,,,g,,#~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~=,,G,=~~~~~~~~~~~~~~~~~~~~~',
];

const plaza: MapDef = makeMap({
  id: 'plaza', name: 'The Clockwork Plaza', area: 'brass', music: 'plaza', rows: PLAZA_ROWS,
  marks: {
    '@': { spot: true },
    '4': {
      id: 'wm_intro', art: 'npc:watchman', c1: BRASS.brass, c2: BRASS.shine, name: 'The Watchman', when: () => !flag('wm_at_gate'), rate: 40,
    },
    'H': {
      id: 'husk', art: 'npc:husk', c1: '#9a96a8', c2: '#5a566a', solid: true, when: () => !flag('shell_taken'),
      talk: function* () { yield* say(null, 'Your shell. It lies open on the brass, the shape of you, with nothing in it.'); },
      sense: { touch: function* () { yield* say(null, 'It is warm. It still fits you. You cannot get back in.'); } },
      truth: 'Your shell. It bloomed off you.',
    },
    'W': {
      id: 'watchman', art: 'npc:watchman', c1: BRASS.brass, c2: BRASS.shine, name: 'The Watchman', rate: 40,
      when: () => !!flag('wm_at_gate') && !flag('watchman_down'),
      talk: npc(function* () { yield* watchmanTalk(); }),
      truth: 'A brass construct with a face that changes constantly.',
    },
    'V': {
      id: 'statue', art: 'npc:watchman_statue', c1: BRASS.brass, c2: BRASS.gold, when: () => !!flag('watchman_down'),
      talk: function* () { yield* say(null, 'A simple brass statue. Stripped to its core.'); }, tile: '=',
    },
    'E': { to: 'ship:a', tile: '=', locked: () => (flag('watchman_down') ? null : 'The Watchman guards the entrance.') },
    'e': { tile: '=', touch: function* () { if (!flag('watchman_down') && flag('gardens_done')) yield* riddle(); } },
    'A': { to: 'tower:a', tile: '=' },
    'a': { spot: true, tile: '=' },
    'X': { to: 'library:a', tile: 'd', locked: () => (flag('tower_done') ? null : 'A door to the Brass Library. A stopped gear holds it shut.') },
    'Y': { tile: 'd', solid: true, talk: inscription('plaza_door', 'A memory door. It opens onto a room that is no longer there. Under the handle there are letters:', 'YESTERDAY IS WHERE YOU CAME IN') },
    'Z': { to: 'yellowtown:a', tile: 'd', locked: () => (flag('year_open') ? null : 'A memory door. Through the keyhole everything is yellow.') },
    'l': { spot: true },
    'z': { spot: true },
    'g': { spot: true, tile: ',' },
    'G': { to: 'gardens:a', tile: ',' },
    'R': {
      id: 'bridge_gear', art: 'npc:gear', c1: BRASS.brass, c2: BRASS.gold, when: () => !flag('bridge_down'), rate: 9999,
      talk: function* () { yield* say(null, 'The bridge to the Steam Gardens is folded up inside this gear. It is broken.'); },
    },
    'S': steadyMark('The steam fountain'),
    'F': { tile: 'F', spot: true },
    '1': {
      id: 'lb_intro', art: 'lb', ...LBC, name: 'Light-Bound #123', when: () => !flag('lb_joined'),
      talk: npc(function* () { yield* say('Light-Bound #123', 'Vagabond!'); }),
    },
    'T': {
      id: 'tinkerer', art: 'npc:tinkerer', c1: BRASS.verdigris, c2: BRASS.shine, name: 'The Tinkerer', mood: 'pride',
      talk: npc(function* () { yield* tinkererTalk(); }),
      truth: 'A mad inventor who repairs the world\'s broken parts.',
    },
    '5': {
      art: 'npc:citizen', c1: '#6a2cc0', c2: '#d89a78', name: 'Flesh-Bound', wander: 2, mood: 'fear',
      talk: cycle('Flesh-Bound', 'citizen_a', [
        'Doors here lead to the wrong rooms. We go in anyway.',
        'Gravity fails sometimes. We tie the benches down.',
        'My coat remembers being someone else.',
        'Did you see? Her shell. It came off her like a coat.',
      ]),
      truth: 'A Flesh-Bound. Mostly unaware of what lies beneath.',
    },
    '6': {
      id: 'unraveled', art: 'npc:citizen', c1: '#8c3a44', c2: '#9a6a4a', name: 'Flesh-Bound', when: () => !flag('first_unraveling'), mood: 'joy',
    },
    '7': {
      art: 'npc:bird_npc', c1: BRASS.gold, c2: BRASS.shine, name: 'Clockwork Bird', sings: true, rate: 20,
      when: () => !flag('watchman_down'),
      talk: cycle('Clockwork Bird', 'bird', ['Who\'s asking?', "'WE WERE HERE,'", 'Shut the blinds!!!!!', 'Goodness gracious!!']),
      sense: { hearing: function* () { yield* say(null, 'The clockwork birds sing in human voices. The voices belong to people who are not here.'); } },
    },
  },
});
plaza.drifters = [
  { id: 'mite1', x: 30, y: 6, group: 'plaza_mites', art: 'mite', c1: BRASS.brass, c2: BRASS.gold, wander: 3, when: () => !!flag('first_unraveling') },
  { id: 'mite2', x: 8, y: 12, group: 'plaza_mites', art: 'mite', c1: BRASS.brass, c2: BRASS.gold, wander: 3, when: () => !!flag('first_unraveling') },
];
plaza.onEnter = function* () {
  if (flag('tower_done') && !flag('seer1')) yield* seerFirst();
};

function* tinkererTalk(): Script {
  if (flag('library_done') && !flag('bridge_down')) {
    yield* say('The Tinkerer', 'oh drat.');
    yield* say('The Tinkerer', 'the bridge. the gear in the bridge. broken. I REPAIR THE WORLD\'S BROKEN PARTS. ALL OF THEM. HOLD THIS.');
    play('gear'); shake(10);
    setFlag('bridge_down');
    yield* say(null, 'The gear turns. The bridge to the Steam Gardens unfolds out of it.');
    return;
  }
  const i = (S.cursors['talk:tink'] || 0) % 3;
  S.cursors['talk:tink'] = i + 1;
  if (i === 0) yield* say('The Tinkerer', 'oh drat.');
  else if (i === 1) yield* say('The Tinkerer', 'IT WAS WORTHWHATITWAS. A SORT OF DISCOUNT ON NOTHING. BUT WE ARE SOLVENT, YES?');
  else yield* say('The Tinkerer', 'WE FIXED AND FIXED, WE HAD SO MANY SCREWS, WE TIGHTENED EVERY ONE WE COULD FIND, BUT YOU JUST HAD TO SHOW UP. WAS IT FUN? CONGRATULATIONS, YOU ARRIVED. YOU WANT A MEDAL? WE ALL ARRIVE EVERY DAY, ITS CALLED WAKING UP. EXCEPT NOW EVERYTHING YOU WALK PAST COMES UNSCREWED');
}

function* watchmanTalk(): Script {
  if (flag('gardens_done')) { yield* riddle(); return; }
  const i = (S.cursors['talk:wm'] || 0) % 3;
  S.cursors['talk:wm'] = i + 1;
  if (i === 0) yield* say('The Watchman', 'WHAT WALKS WITH NO LEGS AND LEAVES ITS COAT ON THE FLOOR? you. That\'s how I see it, at least.');
  else if (i === 1) yield* say('The Watchman', 'The gate is shut. The gate was always shut. I keep it shut by looking at it. Very hard. All day.');
  else yield* say('The Watchman', 'Bring me an answer from the Steam Gardens. Not a weapon. You have no hands for a weapon. Yet.');
}

// ---------- The opening ----------

export function* opening(): Script {
  yield* card(['The custard, the bustard, the brine, the flonk, the counterfeit candle and the wobbly sconk.', 'There is a sort of: Hinge.', 'There is a sort of: Gap.'], UI.paper, true);
  game.mode = 'ending';
  const a = yield* choose([
    { tone: 'Existential', text: 'Animal. A snake.' },
    { tone: 'Scientific', text: 'Geometric shape. A dice.' },
    { tone: 'Fragmented', text: 'Abstract concept. A wire.' },
  ], { speaker: null, text: 'WHAT ARE YOU?? something. you have to be something. pick, before the world picks for you.' });
  S.avatar = (['snake', 'dice', 'wire'] as const)[Math.max(0, a)];
  game.fade = 1;
  game.mode = 'field';
  const s = spot('plaza', '@');
  loadMap('plaza', s.x, s.y, 0);
  S.steady = { map: 'plaza', x: s.x, y: s.y };
  setFollowers();
  yield* fadeIn(0.03);
  yield* wait(30);
  yield* say('You', "The Unraveling... it's here. I can feel it. The world is... unraveling.");
  face('wm_intro', 1);
  yield* say('The Watchman', "Your shell. OH. look at it go. It's a sort of undressing, to lose a shell. It's a sort of goodbye. I hope you packed.");
  face('pilgrim', 2);
  yield* walkTo('wm_intro', spot('plaza', 'W').x, spot('plaza', 'W').y, 10);
  setFlag('wm_at_gate');
  yield* wait(20);
  face('pilgrim', 0);
  yield* walkTo('lb_intro', s.x + 1, s.y + 1, 12);
  yield* say('Light-Bound #123', 'Hello!! Oh! Oh, you have no shell at all!');
  const c = yield* choose([
    { tone: 'Direct', text: 'What happened to me?' },
    { tone: 'Existential', text: 'What am I?' },
    { tone: 'Direct', text: 'What do you like to eat?' },
  ]);
  if (c === 0) yield* say('Light-Bound #123', 'Your shell bloomed off! Like a pie crust! The Watchman saw. He watches everything.');
  else if (c === 1) yield* say('Light-Bound #123', 'A pilgrim! Like me! I am Light-Bound #123. One of many pilgrims!');
  yield* say('Light-Bound #123', 'Oh, thank you for asking, Vagabond! It\'s hard to write my recipes down in a way that would make sense to you, but my very favorites are quasar ravioli and sunset cake! Also a sugar toast that makes a thousand people smile at once. And quiche. Everybody likes quiche!');
  yield* say('Light-Bound #123', 'I am going to the Stone. Everybody is! Come with me, Vagabond!');
  const lb = ent('lb_intro');
  if (lb) seedTrail(lb.x, lb.y);
  setFlag('lb_joined');
  joinLb();
  play('confirm');
  yield* firstUnraveling();
}

/** The First Unraveling: you witness a shell being stripped from a being. */
function* firstUnraveling(): Script {
  yield* wait(20);
  face('unraveled', 1);
  yield* say('Flesh-Bound', 'A new one! Hello, hello. Welcome to the plaza.');
  { const s = spot('plaza', '@'); yield* walkTo('unraveled', s.x + 2, s.y, 14); }
  face('pilgrim', 2);
  play('strip'); shake(14); flash('#ffffff', 6);
  setArt('unraveled', 'npc:citizen_hollow');
  yield* wait(30);
  yield* say('Flesh-Bound', 'oh. OH.');
  yield* say('The Watchman', 'That was you. Or the wind. It was you. That\'s how I see it, at least.');
  yield* walkTo('unraveled', 33, 6, 12);
  setFlag('first_unraveling');
  yield* say('Light-Bound #123', 'oh dear.');
  yield* wait(10);
  play('bird');
  yield* say(null, 'A clockwork bird drops out of the sunset, singing in a human voice.');
  yield* say(null, '(Choose Move to get next to it. Strip peels it, layer by layer.)');
  yield* say(null, '(Every hit you take costs Fragility. Every layer you peel gives a little back.)');
  const r = yield* battle('tut_bird', { lossOk: true });
  if (r === 'win') yield* say('Light-Bound #123', 'You did it, Vagabond! It came apart just like a pie!');
  else yield* say('Light-Bound #123', 'It flew off! That is okay! Birds do that!');
  yield* say('Light-Bound #123', 'The Watchman will not let anybody past the entrance. Not without a weapon. The Gear-Keeper knows things. The Gear-Tower is west!');
  setFlag('intro_done');
  setProgress(0.1);
}

// ---------- The Seer ----------

function* seerFirst(): Script {
  setFlag('seer1');
  yield* wait(20);
  flash('#fff8d0', 10);
  play('crystal');
  music('seer');
  yield* say(null, 'A light stands by the fountain. Its shape will not hold still.');
  yield* say('The Seer', 'The Light-Bound believe the Sun gives them their thoughts, which is a lovely thing to believe, though the Sun is only a source of energy, much as a pilgrim is only a source of trouble. I hope you will forgive the comparison.');
  yield* say('Light-Bound #123', 'The Seer!! Vagabond, that is the Seer! Of the Star-Walkers!');
  flash('#fff8d0', 10);
  yield* say(null, 'The light goes out. A clockwork bird takes its place and sings, in the light\'s voice, "Until later, then!"');
  music('plaza');
}

// ---------- The Gatekeeper's Riddle and the First Watchman ----------

const RIDDLES: { q: string; opts: [string, string][]; right: number }[] = [
  {
    q: 'It is taken off so that what was inside can walk. It lies on the plaza in the shape of you. What is it?',
    opts: [['Direct', 'A shell.'], ['Metaphorical', 'A coat in the wind.'], ['Scientific', 'Bone armor and flesh pillows.']], right: 0,
  },
  {
    q: 'The more of it you take from a thing, the less that thing knows. Held, it heals you. What is it?',
    opts: [['Bureaucratic', 'A form, filed.'], ['Fragmented', 'A memory. Taken.'], ['Existential', 'A name.']], right: 1,
  },
  {
    q: 'The plaza had its shells on before. Now it does not. Who took it all?',
    opts: [['Bureaucratic', 'The Grafters.'], ['Metaphorical', 'The Unraveling.'], ['Direct', 'I did.']], right: -1,
  },
];

function* riddle(): Script {
  if (flag('watchman_down')) return;
  face('watchman', 1);
  play('riddle');
  yield* say('The Watchman', 'Riddles, then. Three. Not four, four is greedy. Not two, two is cowardly.');
  for (let i = flag('riddle'); i < RIDDLES.length; i++) {
    const r = RIDDLES[i];
    const pick = yield* choose(r.opts.map(([tone, text]) => ({ tone: tone as never, text })), { speaker: 'The Watchman', text: r.q });
    if (r.right >= 0 && pick !== r.right) {
      play('buzz');
      yield* say('The Watchman', 'No. NO. That\'s how I see it, at least. Come back.');
      return;
    }
    play('riddle');
    setFlag('riddle', i + 1);
  }
  yield* say('The Watchman', 'THREE. You answered. Now there is nothing left for me to guard but the gate, and myself, and the gate.');
  shake(20);
  play('quake');
  yield* say(null, 'The Watchman unfolds. Gears, plates, a face that changes constantly. It is much larger than it was.');
  music('boss', 'brass');
  const r = yield* battle('boss_watchman');
  if (r !== 'win') return;
  setFlag('watchman_down');
  yield* afterWatchman();
}

function* afterWatchman(): Script {
  yield* say(null, 'The First Watchman is stripped to its core. It stands very still. It is a simple brass statue now.');
  yield* wait(20);
  yield* say(null, 'Every clockwork bird in the plaza stops singing.');
  yield* say('Vorn', 'Hero. Your shell.');
  setFlag('shell_taken');
  play('paper');
  yield* say(null, 'Where your shell lay there is only a stamped slip of paper: PROCESSED. FORM 1977-B. ORDER THROUGH CONSUMPTION.');
  yield* say('Vorn', 'Grafters. (they walked right past me. i didn\'t stop them.)');
  yield* say('Light-Bound #123', 'oh dear.');
  play('door');
  yield* say(null, 'Past the statue, beyond the bridge, a ship with very many sails is docking against the sky.');
}

// ---------- The Gear-Tower ----------

const TOWER_ROWS = [
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~##########~~~~~~~~~~',
  '~~~~~~~~##gg,,U,,,gg##~~~~~~~~',
  '~~~~~~~#g,,,,,,,,,,,,g#~~~~~~~',
  '~~~~~~#g,,,+++++++,,,,g#~~~~~~',
  '~~~~~#,,,,,+,,,,,+,,,,,,#~~~~~',
  '~~~~#gg,,,,+,gg,,+,,,,,gg#~~~~',
  '~~~~#,,,,,,+,gg,,+,,Q,,,,#~~~~',
  '~~~~#,,s,,,+,,,,,+,,,,,,,#~~~~',
  '~~~~#,,,,,,+++=+++,,,,s,,#~~~~',
  '~~~~#gg,,,,,,,=,,,,,,,,gg#~~~~',
  '~~~~#,,,,,,,,,=,,,,,,,,,,#~~~~',
  '~~~~#,,,,gg,,,=,,,gg,,,,,#~~~~',
  '~~~~~#,,,gg,,,=,,,gg,,,,#~~~~~',
  '~~~~~~#,,,,,,,,,,,,,,,,#~~~~~~',
  '~~~~~~~#gg,,1,,,,S,,gg#~~~~~~~',
  '~~~~~~~~##,,,,b,,,,,##~~~~~~~~',
  '~~~~~~~~~~####a#####~~~~~~~~~~',
  '~~~~~~~~~~~~~=A=~~~~~~~~~~~~~~',
];

const tower: MapDef = makeMap({
  indoor: true,
  id: 'tower', name: 'The Gear-Tower', area: 'brass', music: 'tower', rows: TOWER_ROWS, ambient: { color: '#ffe8c0', level: 0.85 },
  marks: {
    'A': { to: 'plaza:a', tile: '=' },
    'a': { spot: true, tile: ',' },
    'b': { spot: true, tile: ',' },
    'S': steadyMark('A steam vent that never stops'),
    'U': {
      tile: '^', touch: function* () {
        if (flag('loop_broken')) { yield* warp('tower_top', spot('tower_top', 'a').x, spot('tower_top', 'a').y, 3); return; }
        const n = flag('tower_floor') + 1;
        setFlag('tower_floor', n);
        yield* warp('tower', spot('tower', 'b').x, spot('tower', 'b').y, 3);
        toast(`Floor ${n + 1}. It looks like floor ${n}.`, UI.dim);
        if (n === 3) yield* say('Light-Bound #123', 'Vagabond, I think we have been here. I recognize that gear. It has a burnt bit, like toast.');
        if (n === 5) yield* say('Vorn', 'Same floor. (it is always the same floor.)');
      },
    },
    '1': {
      id: 'gearkeeper', art: 'npc:gearkeeper', c1: BRASS.rust, c2: BRASS.gold, name: 'The Gear-Keeper', mood: 'rage',
      talk: npc(function* () { yield* gearKeeper(); }),
      truth: 'The Gear-Keeper. It has listened to the tower so long that it talks like one.',
    },
    'Q': {
      id: 'wrong_gear', art: 'npc:gear', c1: BRASS.brass, c2: BRASS.gold, rate: 6,
      when: () => !flag('loop_broken'),
      talk: function* () { yield* say(null, flag('heard_gear') ? 'This gear turns the wrong way. (Use Touch on it. Press C.)' : 'A gear. It turns.'); },
      sense: {
        hearing: function* () {
          setFlag('heard_gear');
          play('gear');
          yield* say(null, 'Under the grinding there is a hum, the world\'s structure. One gear hums a different note. It turns the wrong way.');
        },
        touch: function* () {
          if (!flag('heard_gear')) { yield* say(null, 'You take hold of a gear. It is a gear.'); return; }
          play('handshake'); shake(16); play('gear');
          setFlag('loop_broken');
          yield* say(null, 'You hold the wrong gear still. Every gear in the tower stops.');
          yield* say(null, 'Somewhere above, someone shouts. They are stuck.');
        },
      },
    },
  },
});
tower.drifters = [
  { id: 'tg1', x: 8, y: 8, group: 'tower_golem', art: 'golem', c1: BRASS.brass, c2: BRASS.shine, wander: 3 },
  { id: 'tg2', x: 20, y: 11, group: 'tower_beasts', art: 'beast', c1: BRASS.gold, c2: BRASS.rust, wander: 3 },
  { id: 'tg3', x: 14, y: 5, group: 'tower_mix', art: 'mite', c1: BRASS.brass, c2: BRASS.gold, wander: 2 },
  { id: 'tg4', x: 7, y: 13, group: 'tower_birds', art: 'bird', c1: BRASS.gold, c2: BRASS.shine, wander: 3 },
];
Object.defineProperty(tower, 'name', { get: () => (flag('tower_floor') ? `The Gear-Tower, floor ${flag('tower_floor') + 1}` : 'The Gear-Tower') });

function* gearKeeper(): Script {
  if (!(S.senses.hearing || 0)) {
    yield* say('The Gear-Keeper', 'GRINDING AND GROANING AND CLANKING AND CLATTERING AND TICKING AND TOCKING AND CHIPPING AND CHOMPING AND GETTING THE WHOLE TOWER STUCK ALL GUMMED UP IN MY TEETH');
    yield* say('The Gear-Keeper', 'The cog, the clog, the tick, the tiff, the turning tin and the wobbly whiff.');
    yield* say('The Gear-Keeper', 'There is a sort of: Gear. There is a sort of: Stop.');
    yield* say('The Gear-Keeper', 'LISTEN AND HEAR AND HUM AND FIND THE ONE THAT TURNS AND TURNS THE WRONG WAY AND HOLD IT AND STOP IT AND GO UP');
    yield* learnSense('hearing', 1, 'You can hear the world\'s hum now. (Press C and choose Hearing.)');
    return;
  }
  yield* say('The Gear-Keeper', flag('loop_broken') ? 'STOPPED AND STUCK AND STILL AND WAITING AND UP AND UP AND NO TOP' : 'There is a sort of: Gear. There is a sort of: Stop.');
}

const TOWER_TOP_ROWS = [
  '~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~^^~~~~~~~~~~~',
  '~~~~~~~~~~~^^~~~~~~~~~~~',
  '~~~~~~~~~~,UU,~~~~~~~~~~',
  '~~~~~~~~,,,,,,,,~~~~~~~~',
  '~~~~~~~,gg,,,,,,,,~~~~~~',
  '~~~~~~~,gg1gg,,,,,~~~~~~',
  '~~~~~~~,,,,gg,,,,,~~~~~~',
  '~~~~~~~~,,,,,,,,~~~~~~~~',
  '~~~~~~~~~~,a,,~~~~~~~~~~',
  '~~~~~~~~~~~A~~~~~~~~~~~~',
];

const towerTop: MapDef = makeMap({
  ents: [{ id: 'insc_tower_top', x: 9, y: 4, art: 'npc:pages', c1: BRASS.brass, c2: BRASS.dark, talk: inscription('tower_top', 'Scratched into a gear tooth:', 'THERE IS NO TOP. THERE IS ONLY UP, UNTIL THERE IS DOWN') }],
  id: 'tower_top', name: 'The Gear-Tower, no top', area: 'brass', music: 'tower', rows: TOWER_TOP_ROWS, known: true,
  marks: {
    'a': { spot: true },
    'A': { to: 'tower:b', tile: '^' },
    'U': { tile: '^', touch: function* () { yield* say(null, 'The stairs keep spiralling upward into the sunset. There is no top.'); } },
    '1': {
      id: 'vorn_stuck', art: 'vorn', ...VORNC, name: 'Vorn', when: () => !flag('vorn_joined'), tall: true,
      talk: function* () { yield* vornMeet(); },
    },
  },
});

function* vornMeet(): Script {
  yield* say('Vorn', 'Stuck. The gears stopped. (everything stops when you come in.)');
  const c = yield* choose([
    { tone: 'Direct', text: 'Hold still.' },
    { tone: 'Fragmented', text: 'Gear. Shell. Off.' },
    { tone: 'Bureaucratic', text: 'Please state your name and function.' },
  ]);
  if (c === 2) yield* say('Vorn', 'Vorn. Flesh-Bound rebellion. Last one.');
  play('strip'); shake(10);
  yield* say(null, 'You strip the shell off the gear. It falls apart into hollow teeth. Vorn steps out.');
  yield* say('Vorn', 'Vorn. Last of the Flesh-Bound rebellion. They said find the one with no shell. Keep it alive.');
  yield* say('Vorn', 'Losing a plate isn\'t the worst. Chin up, hero. Plenty of plates left. Well?');
  yield* say('Vorn', '(we may lose this one too.)');
  const v = ent('vorn_stuck');
  if (v) seedTrail(v.x, v.y);
  setFlag('vorn_joined');
  joinVorn();
  play('gear'); shake(12);
  yield* say(null, 'Below you every gear in the tower starts turning again. Far off, a door in the plaza unsticks.');
  setFlag('tower_done');
  yield* say(null, '(Vorn hits shells hard. A shadow, a thing with no shell, he cannot grasp.)');
  yield* say(null, '(Guard puts him between you and what is coming.)');
}

// ---------- The Brass Library ----------

export const LIB_ROWS = [
  '###############################',
  '#bbbbbbbbbbbbbbbbbbbbbbbbbbbbb#',
  'w,,,,,,,,,,,,,,,,,,,,,,,,,,,,,E',
  'w,,bbbbbb,bbbbbbb,bbbbbbb,,,,,E',
  'w,,bbbbbb,bbbbbbb,bbbbbbb,,3,,E',
  'w,,,,,,,,,,,,,,,,,,,,,,,,,,,,,E',
  '#,,bbbbbb,bbbhbbb,bbbbbbb,bbbb#',
  '#,,bbbbbb,bbb,bbb,bbbbbbb,bbbb#',
  '#,,,2,,,,,bbb,bbb,,,,,,,,,,,,,#',
  '#,,bbbbbb,bbbKbbb,bbbbbbb,bbbb#',
  '#,,bbbbbb,bbb,bbb,bbbbbbb,bbbb#',
  '#,,,,,,,,,bbbYbbb,,,,,4,,,,,,,#',
  '#,,bbbbbb,bbbbbbb,bbbbbbb,bbbb#',
  '#,,bbbbbb,bbbbbbb,bbbbbbb,bbbb#',
  '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
  '#,,,,,,1,,,,,,,,,,,,,,,,,S,,,,#',
  '#############a#################',
  '~~~~~~~~~~~~~A~~~~~~~~~~~~~~~~~',
];

const library: MapDef = makeMap({
  ents: [{ id: 'insc_library_plaque', x: 11, y: 15, art: 'npc:pages', c1: BRASS.gold, c2: BRASS.dark, talk: inscription('library_plaque', 'A brass plaque by the door:', 'EVERY BOOK HERE IS FINISHED EXCEPT ONE') }],
  indoor: true,
  id: 'library', name: 'The Brass Library', area: 'brass', music: 'library', rows: LIB_ROWS, sight: 4, ambient: { color: '#ffe0a0', level: 0.55 },
  marks: {
    'A': { to: 'plaza:l', tile: 'd' },
    'a': { spot: true, tile: ',' },
    'w': { spot: true, tile: ',' },
    'E': { tile: ',', touch: function* () { yield* libraryLoop(); } },
    'S': steadyMark('A lamp that reads over your shoulder'),
    '1': {
      id: 'librarian', art: 'npc:librarian', c1: BRASS.paper, c2: BRASS.brown, name: 'The Librarian', mood: 'fear',
      talk: npc(function* () { yield* librarian(); }),
      truth: 'The Librarian. Every book here has worms, and the worms are reading.',
    },
    '2': { pickup: { kind: 'book', id: 'b1', label: 'a memory of a door to a wrong room', flag: 'book1', text: 'The book whispers when you read it. It is somebody\'s memory of a door that led to the wrong room. They went in anyway.' }, art: 'pickup:book', c1: BRASS.rust, c2: BRASS.paper },
    '3': { pickup: { kind: 'book', id: 'b2', label: 'a memory of gravity failing', flag: 'book2', text: 'The book whispers. Somebody remembers the afternoon gravity failed, and everything floated up into the sunset.' }, art: 'pickup:book', c1: BRASS.verdigris, c2: BRASS.paper },
    '4': {
      art: 'pickup:book', c1: BRASS.gold, c2: BRASS.paper, id: 'weave_book', when: () => !flag('weave_glimpse'),
      talk: function* () {
        setFlag('weave_glimpse');
        play('weave');
        yield* say(null, 'A book about Weaving. Two concepts, held together until they become one. Shell and Memory. Emotion and Name.');
        yield* say(null, '(You can Weave now: two concepts from your hand, fused into one move.)');
      },
    },
    'K': {
      id: 'soldier', art: 'enemy:soldier', c1: BRASS.verdigris, c2: BRASS.paper, when: () => !!flag('library_book') && !flag('soldier_down'), ox: -4, oy: 0,
      talk: function* () {
        yield* say(null, 'A soldier without a memory blocks the aisle. Its uniform is tattered.');
        const r = yield* battle('lib_soldier');
        if (r !== 'win') return;
        setFlag('soldier_down');
        yield* say(null, 'The Forgotten Soldier becomes a blank figure, then fades away.');
        setFlag('library_done');
        yield* say('Light-Bound #123', 'Vagabond! The Tinkerer fixes broken things. The bridge to the Steam Gardens is broken!');
      },
    },
    'Y': {
      id: 'your_book', art: 'pickup:book', c1: '#dceeff', c2: '#3a4a6a', when: () => !flag('library_book'),
      talk: function* () { yield* yourBook(); },
    },
  },
});
library.drifters = [
  { id: 'lm1', x: 6, y: 5, group: 'lib_moths', art: 'moth', c1: BRASS.paper, c2: BRASS.brown, wander: 3 },
  { id: 'lm2', x: 22, y: 8, group: 'lib_mix', art: 'moth', c1: BRASS.paper, c2: BRASS.brown, wander: 3 },
  { id: 'lm3', x: 20, y: 14, group: 'lib_child', art: 'child', c1: '#9cc0d8', c2: '#e4e0d0', wander: 2 },
];

function* libraryLoop(): Script {
  const w = spot('library', 'w');
  yield* warp('library', w.x, Math.max(2, Math.min(5, S.y)), 2);
  toast('The library has no end. Only more shelves.', UI.dim);
}

function* librarian(): Script {
  const i = (S.cursors['talk:lib'] || 0) % 3;
  S.cursors['talk:lib'] = i + 1;
  if (i === 0) yield* say('The Librarian', 'INK BUBBLES OFF THE OPEN PAGE. WHAT?? WHAT???');
  else if (i === 1) yield* say('The Librarian', 'SHHHHH!!! NO. LOUDER!! THE BOOKS CANT HEAR THEMSELVES THINK OVER ALL THIS QUIET??');
  else yield* say('The Librarian', 'My bookworms scream. Pages are pouring in at 4×10^61 sentences per blink. The clock holds its breath while I read. I am bound, I am cracked. The silver mean starts to tarnish while I leak only brass. Alas, the nickel has spent itself. Close the shutters!!!!!');
  if (!flag('lib_hint')) {
    setFlag('lib_hint');
    yield* say('The Librarian', 'YOUR BOOK?? IN THE DEEP STACKS?? BEHIND THE SHELF THAT LIES?? WHO??');
    yield* say(null, '(True Sight shows what lies. Press C and choose Sight.)');
  }
}

function* yourBook(): Script {
  yield* say(null, 'A book with no title. When you open it, it is about you.');
  play('memory_get');
  yield* say(null, 'You remember being heavy. Very heavy, and very still, under everything. Then you were here, and the shells began to bloom.');
  yield* giveConcept({ layer: 'memory', label: 'being heavy, and very still', from: 'book' });
  yield* becomeState(1);
  yield* say(null, '(You can Extract Memory now, and Absorb what you hold. A memory absorbed restores you.)');
  setFlag('library_book');
  play('quake'); shake(10);
  yield* say(null, 'Behind you, in the aisle, something in a tattered uniform stands up.');
}

// ---------- The Steam Gardens ----------

const GARDEN_ROWS = [
  '~~~~~~~~~~~~~~=A=~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~#,,a,,#~~~~~~~~~~~~~',
  '~~~~~~~~#####,,,,,#####~~~~~~~~~',
  '~~~~~~##fPf,,,,,,,,,fPf##~~~~~~~',
  '~~~~~#f,,,,,s,,1,s,,,,,,f#~~~~~~',
  '~~~~#P,,f,,,,,,,,,,,,,f,,P#~~~~~',
  '~~~#,,,,,,,PPP,,,,PPP,,,,,,#~~~~',
  '~~~#,s,,,,,P2,,,,,,,P,,,s,,#~~~~',
  '~~#,,,,f,,,,,,TTTT,,,,,f,,,,#~~~',
  '~~#,f,,,,,,,,,TTTT,,,,,,,,f,#~~~',
  '~~#,,,,,,s,,,,TTTT,,,,s,,,,,#~~~',
  '~~#P,,,,,,,,,,,,,,,,,,,,,,,P#~~~',
  '~~~#,,f,,PPP,,,,,,,,PPP,,f,#~~~~',
  '~~~#,,,,,P,,,,,,,,,,,,P,,,,#~~~~',
  '~~~~#,,,,,,,,f,,R,,f,,,,,,#~~~~~',
  '~~~~~#,S,,,,,,,,,,,,,,,,3#~~~~~~',
  '~~~~~~##,,,,,,,,,,,,,,,##~~~~~~~',
  '~~~~~~~~#####,,,,,#####~~~~~~~~~',
  '~~~~~~~~~~~~~#####~~~~~~~~~~~~~~',
];

const VISIONS = [
  'The steam shows the plaza with every shell still on. Then it shows you arriving.',
  'The steam shows a lighthouse on a sea that is also a mind.',
  'The steam shows a yellow town where it is always the same year.',
  'The steam shows a stone, pulsating, under everything.',
];

const gardens: MapDef = makeMap({
  id: 'gardens', name: 'The Steam Gardens', area: 'brass', music: 'gardens', rows: GARDEN_ROWS,
  marks: {
    'A': { to: 'plaza:g', tile: '=' },
    'a': { spot: true, tile: ',' },
    'S': steadyMark('A fountain of steam instead of water'),
    '1': {
      id: 'gardener', art: 'npc:gardener', c1: BRASS.leaf, c2: BRASS.steam, name: 'The Gardener', mood: 'pride',
      talk: npc(function* () { yield* gardener(); }),
      truth: 'The Gardener. Steam instead of water, and brass instead of leaves.',
    },
    '2': {
      id: 'steamfruit', art: 'npc:flowerbig', c1: BRASS.gold, c2: BRASS.steam,
      talk: function* () { yield* lbCooks(); },
      truth: 'A brass plant with fruit made of steam.',
    },
    '3': { pickup: { kind: 'shell', id: 'petal', label: 'Petal Shell', flag: 'petal1' }, art: 'pickup:shell', c1: BRASS.gold, c2: BRASS.rust },
    'T': { tile: ',', touch: function* () { if (!flag('storm_done')) yield* brassStorm(); } },
    's': { tile: 's', touch: function* () { const i = (S.cursors.vision || 0) % VISIONS.length; S.cursors.vision = i + 1; yield* say(null, VISIONS[i]); } },
    'f': {
      tile: 'f', sings: true, solid: false,
      sense: { hearing: function* () { yield* say(null, 'The flowers sing when the wind blows. One of them sings, "WE WERE HERE."'); } },
    },
    'R': {
      id: 'ragebloom', art: 'npc:flowerbig', c1: BRASS.rust, c2: BRASS.sky3, when: () => !flag('rage_down'), rate: 8,
      talk: function* () { yield* rageBeast(); },
      truth: 'A flower that is about to bloom into a weapon.',
    },
  },
});
gardens.drifters = [
  { id: 'gw1', x: 8, y: 5, group: 'garden_wisps', art: 'wisp', c1: BRASS.steam, c2: BRASS.sky4, wander: 3 },
  { id: 'gw2', x: 23, y: 12, group: 'garden_blades', art: 'flower', c1: BRASS.gold, c2: BRASS.rust, wander: 1 },
  { id: 'gw3', x: 6, y: 13, group: 'garden_mix', art: 'beast', c1: BRASS.gold, c2: BRASS.rust, wander: 3 },
];

function* gardener(): Script {
  if (flag('rage_down')) {
    yield* say('The Gardener', 'STRENGTH!! ALL THE STRENGTH IN THE GARDEN IS IN MY TROWEL!!! ehehehe. hehe. he.');
    yield* say('The Gardener', 'THE WATCHMAN GUARDS THE WAY DOWN, HERO. ANSWER HIS RIDDLE. ehehehe');
    return;
  }
  if (!flag('gardener_met')) {
    setFlag('gardener_met');
    yield* say('The Gardener', 'The Spoza... how I loathe them. Hands are needed in this matter, hero. Hands indeed. There is a weapon, they say, as strong as god Herself. Pull it out of the Stone so that we may sleep, and that the world may finally be whole.');
    const c = yield* choose([
      { tone: 'Existential', text: 'Why me?' },
      { tone: 'Bureaucratic', text: 'Who are the Spoza?' },
      { tone: 'Direct', text: 'Where is the Stone?' },
    ]);
    if (c === 0) yield* say('Light-Bound #123', 'Because you have no shell, Vagabond! You can reach inside things! Like a ravioli!');
    else if (c === 1) yield* say('The Gardener', 'GRAFTERS. ORDER THROUGH CONSUMPTION. THEY COLLECT SHELLS, HERO. THEY FILE THEM.');
    else yield* say('The Gardener', 'DOWN, HERO. UNDER THE SEA. UNDER EVERYTHING. THE STONE-DEEP.');
    yield* say('The Gardener', 'oh bother. THE BIG FLOWER. IT IS BLOOMING INTO A WEAPON AGAIN.');
    return;
  }
  yield* say('The Gardener', 'oh bother.');
}

function* lbCooks(): Script {
  if ((S.senses.taste || 0) >= 1) { yield* say('Light-Bound #123', 'Steam fruit! Still the best for sunset cake!'); return; }
  yield* say('Light-Bound #123', 'Steam fruit!! Vagabond, taste it! You have to taste the essence of a thing before you cook with it!');
  play('savor');
  yield* learnSense('taste', 1, 'It tastes like a boiling kettle feels. You can Savor now: taste the flavor of a thing and keep it.');
}

/** The Brass Storm: a storm of brass fragments that tests your new abilities. */
function* brassStorm(): Script {
  setFlag('storm_done');
  shake(30); play('storm');
  flash(BRASS.gold, 8);
  yield* say(null, 'The Brass Storm. Fragments of brass come down out of the sunset like hail.');
  yield* say('Vorn', 'Down, hero! (down. down. down.)');
  for (const g of ['storm_brass', 'storm_brass2', 'storm_brass3']) {
    shake(14); play('storm');
    const r = yield* battle(g);
    if (r !== 'win') { setFlag('storm_done', 0); return; }
    if (g !== 'storm_brass3') {
      const mid = Math.round(fmax() * 0.6);
      S.f = Math.round(S.f + (mid - S.f) * 0.4);
      yield* say(null, 'Steam rises off the hot brass between gusts. It steadies you a little.');
    }
  }
  yield* say(null, 'The storm passes. There are brass pieces on everything.');
  yield* say('Light-Bound #123', 'It is all over the steam fruit! oh dear.');
}

function* rageBeast(): Script {
  if (!(S.senses.taste || 0)) { yield* say(null, 'A huge brass flower. It shakes. Something inside it is very angry.'); return; }
  shake(20); play('quake');
  yield* say(null, 'The flower blooms into a weapon. The weapon is a beast made of pure rage.');
  yield* say(null, 'Its rage is so loud that you can feel where it is held. You could pull it out. (Extract Emotion.)');
  const r = yield* battle('garden_rage', { scripted: ['emotion'] });
  if (r !== 'win') return;
  setFlag('rage_down');
  yield* say(null, 'The Rage-Beast becomes calm, then fades away.');
  yield* becomeState(2);
  yield* say(null, '(You can Extract Emotion now. An absorbed emotion becomes your weapon for a while.)');
  setFlag('gardens_done');
}

export const BRASS_MAPS: MapDef[] = [plaza, tower, towerTop, library, gardens];
export const BRASS_HELPERS = { riddle, seerFirst, opening };
void LBC; void lines; void giveConcept;
