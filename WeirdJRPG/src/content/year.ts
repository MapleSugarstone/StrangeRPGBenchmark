// Area 4: The Year 1977, a side area outside time. Locations, NPCs, and events follow AREA_SCRIPTS.md.
import { makeMap, spot, npc, cycle, steadyAt } from './kit';
import type { MapDef, Script } from '../game/types';
import { YEAR, UI } from '../game/palette';
import { say, choose, wait, warp, battle, flag, setFlag, play, shake, flash, music, learnSense, toast, giveConcept, S } from '../game/api';
import { setArt } from '../game/api';
import { F } from '../game/field';
import { game } from '../game/registry';
import { setProgress } from '../engine/audio';

// ---------- The Yellow Town ----------

const TOWN_ROWS = [
  '~~~~~~~~~~~~~~~~~N~~~~~~~~~~~~~~~~~~',
  '##W##W##W##W###..n..###W##W##W##W##W',
  '#.......1......,,-,,......2........#',
  '#..L...........,,-,,...........L...#',
  '##W##W###......,,-,,......###W##W###',
  '####t####......,,-,,......####t#####',
  '##W##W###...3..,,-,,..3...###W##W###',
  'q..............,,-,,..............e#',
  'Q,a,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,E',
  'Q---------------,,,,-------------,,E',
  'q,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,e#',
  '#..............,,-,,...............#',
  '##W##W##.##W###,,-,,###W##W##.##W###',
  '##W##.....W####,,-,,####W##..4..##W#',
  '##W##.K...W####,,-,,####W##.....##W#',
  '##W##W##W##W###,,-,,###W##W##W##W###',
  '#..L....$......,,-,,......5....L...#',
  '#..............,,c,,...............#',
  '###############..C..################',
];

const town: MapDef = makeMap({
  id: 'yellowtown', name: 'The Yellow Town', area: 'year', music: 'year', rows: TOWN_ROWS,
  marks: {
    'a': { spot: true, tile: ',' },
    'q': { spot: true },
    'Q': {
      tile: ',', touch: function* () {
        if (flag('escaping')) { yield* escaped(); return; }
        const c = yield* choose([{ text: 'Into the Current of Time.' }, { text: 'Through the memory door to the plaza.' }, { text: 'Stay in 1977.' }], { speaker: null, text: 'The edge of the year. It is sticky, like old paint.' });
        if (c === 0) { const s = spot('current', 'a'); yield* warp('current', s.x, s.y, 3); }
        else if (c === 1) { const s = spot('plaza', 'z'); yield* warp('plaza', s.x, s.y, 0); }
      },
    },
    '$': steadyAt('A bus stop. No bus has come since 1977', YEAR.orange, YEAR.pale, 'npc:yearkeeper'),
    'N': { to: 'storyteller:a', tile: '.' },
    'n': { spot: true },
    'E': { to: 'factory:a', tile: ',' },
    'e': { spot: true, tile: '.' },
    'C': { to: 'chasm:a', tile: 'e' },
    'c': { spot: true, tile: ',' },
    '1': {
      art: 'npc:resident', c1: YEAR.teeth, c2: YEAR.orange, name: 'Yellow-Town Resident', mood: 'misery', wander: 2,
      talk: cycle('Yellow-Town Resident', 'res1', [
        'WE SMILE WITH OUR MOUTHS SHUT. you would too. (look at our teeth.)',
        'THE SUN HAS BEEN GOING DOWN SINCE THE SPRING. ITS VERY PRETTY. NOBODY MENTIONS IT.',
        'IS IT STILL 1977? IT IS STILL 1977. we checked this morning. we will check again tomorrow (it will be 1977).',
      ]),
    },
    '2': {
      art: 'npc:resident', c1: YEAR.teeth, c2: YEAR.green, name: 'Yellow-Town Resident', mood: 'misery', wander: 2,
      talk: cycle('Yellow-Town Resident', 'res2', [
        'EVERYBODY IS FINE. EVERYBODY HERE IS SO FINE. its the finest thing you ever saw.',
        'MY HUSBAND WENT TO THE FACTORY AND CAME BACK ELECTRONIC. he is very quiet now. QUIETER THAN BEFORE, EVEN.',
        'A STORY? GO TO THE CORNER. THE STORYTELLER STILL HAS SOME LEFT.',
      ]),
    },
    '3': {
      art: 'npc:forgotten', c1: YEAR.gray, c2: YEAR.pale, name: 'The Forgotten', wander: 2,
      talk: cycle('The Forgotten', 'forg', ['...why am I. why am I here. no, the other one. why AM I.', 'I was for something. I was FOR something.', 'do you remember me? no? me neither.']),
    },
    '4': {
      id: 'yearkeeper', art: 'npc:yearkeeper', c1: YEAR.orange, c2: YEAR.pale, name: 'The Year-Keeper', mood: 'pride',
      talk: npc(function* () { yield* yearKeeper(); }),
      truth: 'The Year-Keeper keeps track of the year, which does not change.',
    },
    'K': {
      id: 'keeper_form', art: 'npc:pages', c1: YEAR.pale, c2: YEAR.brown,
      talk: function* () {
        setFlag('keeper_past');
        play('paper');
        yield* say(null, 'An old desk with one form on it, yellow at the edges. FORM 1977-B.');
        yield* say(null, 'NAME: (crossed out, many times). STATUS: PILGRIM. ARRIVED: 1977. DEPARTED: 1977. REASON: TO KEEP IT.');
        yield* say('Vorn', 'The Keeper. (he came from here. he never got out.)');
      },
      truth: 'The first form the Keeper ever filed.',
    },
    '5': { pickup: { kind: 'shell', id: 'teeth', label: 'Yellow Teeth', flag: 'yt_shell1' }, art: 'pickup:shell', c1: YEAR.teeth, c2: YEAR.meat, hidden: true },
  },
});
town.drifters = [
  { id: 'yt1', x: 10, y: 3, group: 'year_teeth', art: 'tooth', c1: YEAR.teeth, c2: YEAR.meat, wander: 3 },
  { id: 'yt2', x: 26, y: 10, group: 'year_drones', art: 'drone', c1: YEAR.green, c2: YEAR.mustard, wander: 3 },
  { id: 'yt3', x: 6, y: 16, group: 'year_forgotten', art: 'forgotten', c1: YEAR.gray, c2: YEAR.pale, wander: 2 },
];
town.onEnter = function* () {
  if (!flag('ch3')) setFlag('ch3');
  if (!flag('year_seen')) {
    setFlag('year_seen');
    setProgress(0.55);
    yield* wait(20);
    yield* say(null, 'The Year 1977. Yellow brick, yellow asphalt. The sun is always setting.');
    yield* say('Vorn', 'Everyone is smiling. (nobody is showing teeth.)');
  }
};

function* yearKeeper(): Script {
  const i = (S.cursors['talk:yk'] || 0) % 3;
  S.cursors['talk:yk'] = i + 1;
  if (i === 0) yield* say('The Year-Keeper', 'The year is 1977. Yesterday was 1977. Tomorrow will be 1977, I am told, by 1977.');
  else if (i === 1) yield* say('The Year-Keeper', 'Someone arrived in 1977 with no shell and filed for a year. 1977 was granted. Their desk is still across the street, in 1977.');
  else yield* say('The Year-Keeper', 'Leave? Out of 1977? You would need a reason, and no new reasons have been made since 1977.');
}

// ---------- The Electronic Meat Factory ----------

const FACTORY_ROWS = [
  '##################################',
  '#vvv.....vvv......vvv.......vvv..#',
  '#...>>>>>>>>>>>>>>>>>>>>>>>>>....#',
  '#.1..............................#',
  '#...<<<<<<<<<<<<<<<<<<<<<<<<<....#',
  '#........t.........t.........4...#',
  '#...>>>>>>>>>>>>>>>>>>>>>>>>>....#',
  '#.....3...............3..........#',
  '#...<<<<<<<<<<<<<<<<<<<<<<<<<....#',
  '#..vvv.......vvv.......vvv....$..#',
  '#................................#',
  '####.#############################',
  '~~~~a~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~A~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
];

const factory: MapDef = makeMap({
  indoor: true,
  id: 'factory', name: 'The Electronic Meat Factory', area: 'year', music: 'factory', rows: FACTORY_ROWS, known: true, ambient: { color: '#c0ffb0', level: 0.5 },
  legend: { '.': { art: ['11111111', '11111111', '11211111', '11111111', '11111111', '11111211', '11111111', '11111111'], c1: YEAR.gray, c2: YEAR.mustard, ink: YEAR.dark } },
  marks: {
    'a': { spot: true },
    'A': { to: 'yellowtown:e', tile: '.' },
    '$': steadyAt('A break room nobody takes a break in', YEAR.green, YEAR.pale, 'npc:manager'),
    '1': {
      id: 'manager', art: 'npc:manager', c1: YEAR.mustard, c2: YEAR.pale, name: 'The Factory Manager', mood: 'dread',
      talk: npc(function* () {
        const i = (S.cursors['talk:fm'] || 0) % 2;
        S.cursors['talk:fm'] = i + 1;
        if (i === 0) yield* say('The Factory Manager', 'MEMO: PRODUCTION IS UP. MORALE IS UP. THE MEAT IS ELECTRONIC AND THE WORKERS ARE GRATEFUL. ANY FEELINGS ARE TO BE PLACED IN THE VAT, NOT SPOKEN. THANK YOU FOR YOUR COOPERATION (we are all very tired).');
        else yield* say('The Factory Manager', 'WHAT DO WE MAKE? WE MAKE IT. WHAT IS IT? IT IS THE PRODUCT. WHO BUYS IT? NOBODY BUYS IT. IT IS NOT FOR BUYING, IT IS FOR BURRYING.');
      }),
      truth: 'The meat is actually consciousness. The workers do not remember why they are working.',
    },
    '3': {
      art: 'npc:forgotten', c1: YEAR.gray, c2: YEAR.green, name: 'Worker', wander: 1,
      talk: cycle('Worker', 'worker', ['shift. shift. shift.', 'i forget what i was before the factory. i think i was a feeling.', 'the product is... something else.']),
    },
    '4': {
      id: 'vat_feel', art: 'npc:pages', c1: YEAR.meat, c2: YEAR.green,
      talk: function* () {
        if (flag('vat_taken')) { yield* say(null, 'The vat hums. Three inches of electronic meat, smoothed over.'); return; }
        setFlag('vat_taken');
        yield* giveConcept({ layer: 'emotion', label: 'misery', emotion: 'misery', from: 'vat' }, 'You reach into the vat, under three inches of electronic meat, and pull out a feeling nobody ever said out loud.');
      },
      sense: { taste: function* () { yield* say(null, 'It tastes like a thing you meant to say at dinner and did not.'); } },
    },
  },
});
factory.drifters = [
  { id: 'yf1', x: 8, y: 3, group: 'year_meat', art: 'meat', c1: YEAR.meat, c2: YEAR.green, wander: 3 },
  { id: 'yf2', x: 24, y: 7, group: 'year_drones', art: 'drone', c1: YEAR.green, c2: YEAR.mustard, wander: 3 },
  { id: 'yf3', x: 15, y: 10, group: 'year_meat', art: 'meat', c1: YEAR.meat, c2: YEAR.green, wander: 3 },
];

// ---------- The Storyteller's Corner ----------

const STORY_ROWS = [
  '~~~~~~~~~~~~~~~~~~~~',
  '~##################~',
  '~#bbbb......bbbb..#~',
  '~#.......1........#~',
  '~#..o..o....o..o..#~',
  '~#..o..o....o..o..#~',
  '~#......2.........#~',
  '~#######.a.########~',
  '~~~~~~~~.A.~~~~~~~~~',
];

const STORIES = [
  { label: 'a story about a town where it was always evening', text: 'ONCE THERE WAS A TOWN WHERE IT WAS ALWAYS EVENING, AND THE PEOPLE AGREED NOT TO NOTICE. THEY AGREED SO HARD THEY FORGOT THEY HAD AGREED. THE END. (that one is about here.)' },
  { label: 'a story about a man who filed his own name', text: 'ONCE THERE WAS A MAN WHO FILED HIS OWN NAME AWAY SO NOBODY COULD TAKE IT. HE MADE A FORM FOR IT. HE MADE A FORM FOR THE FORM. HE NEVER FOUND THE DRAWER AGAIN. THE END.' },
  { label: 'a story that does not finish', text: 'ONCE THERE WAS... ONCE THERE WAS... (he opens his mouth and nothing comes out of it, for a long time.)' },
];

const storyteller: MapDef = makeMap({
  indoor: true,
  id: 'storyteller', name: "The Storyteller's Corner", area: 'year', music: 'storyteller', rows: STORY_ROWS, known: true, ambient: { color: '#ffd090', level: 0.4 },
  marks: {
    'a': { spot: true },
    'A': { to: 'yellowtown:n', tile: '.' },
    '1': {
      id: 'storyteller', art: 'npc:storyteller', c1: YEAR.teeth, c2: YEAR.brown, name: 'The Storyteller', mood: 'longing', light: { r: 56, i: 0.85, color: '#f4a850' },
      talk: npc(function* () { yield* storytellerTalk(); }),
      truth: 'An old man with yellow teeth. The stories are actually memories.',
    },
    '2': {
      art: 'npc:resident', c1: YEAR.teeth, c2: YEAR.orange, name: 'Listener',
      talk: cycle('Listener', 'listener', ['SHH. HE IS GOING TO TELL ONE.', 'WE COME EVERY NIGHT. IT IS ALWAYS NIGHT.']),
    },
  },
});

function* storytellerTalk(): Script {
  if (flag('story_end')) { yield* say('The Forgotten', 'once... once there... was...'); return; }
  const n = flag('stories');
  if (n === 0) yield* say('The Storyteller', "SIT DOWN. THEY ALWAYS SAT DOWN. THEY TOLD STORIES SO THE NIGHT WOULD HAVE SOMETHING IN IT. 'TELL ANOTHER ONE,' THEY SAID. SO HE DID.");
  const s = STORIES[n];
  yield* say('The Storyteller', s.text);
  yield* giveConcept({ layer: 'memory', label: s.label, from: 'story' });
  setFlag('stories', n + 1);
  if (n + 1 >= STORIES.length) yield* storysEnd();
}

/** The Story's End: the stories come to an end. */
function* storysEnd(): Script {
  setFlag('story_end');
  yield* wait(30);
  yield* say(null, 'The Story\'s End. The Storyteller looks at his hands for another one. There are none.');
  setArt('storyteller', 'npc:forgotten');
  play('fade');
  flash(YEAR.pale, 8);
  yield* say(null, 'He does not remember why he exists. He is one of the Forgotten now.');
  yield* say('Vorn', '(they made them last as long as they could.)');
}

// ---------- The Chasm of Despair ----------

const CHASM_ROWS = [
  '~~~~~~~~~~~~~~~A~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~.,a,.~~~~~~~~~~~~~',
  '~~~~~~~~eeeee.,,,.eeeeee~~~~~~~',
  '~~~~~~ee      .,.      ee~~~~~~',
  '~~~~~e        .,.       e~~~~~~',
  '~~~~e         .,.        e~~~~~',
  '~~~~e        ...         e~~~~~',
  '~~~~e        .,..        e~~~~~',
  '~~~~e         ..,.       e~~~~~',
  '~~~~~e        .,.$      e~~~~~~',
  '~~~~~~e       .,.      e~~~~~~~',
  '~~~~~~~e     ..,..    e~~~~~~~~',
  '~~~~~~~~e    .,,,.   e~~~~~~~~~',
  '~~~~~~~~~e   ..X..  e~~~~~~~~~~',
  '~~~~~~~~~~e  .....  e~~~~~~~~~~',
  '~~~~~~~~~~~eeeeeeeee~~~~~~~~~~~',
];

const chasm: MapDef = makeMap({
  id: 'chasm', name: 'The Chasm of Despair', area: 'year', music: 'chasm', rows: CHASM_ROWS, sight: 7, ambient: { color: '#ffc080', level: 0.55 },
  marks: {
    'a': { spot: true, tile: ',' },
    'A': { to: 'yellowtown:c', tile: '.' },
    '$': steadyAt('A ledge. You can see the bottom from here', YEAR.orange, YEAR.pale, 'npc:symbol'),
    'X': {
      id: 'despair_bottom', art: 'npc:symbol', c1: YEAR.orange, c2: YEAR.teeth, when: () => !flag('despair_down'), rate: 16,
      talk: function* () { yield* despair(); },
      truth: 'The bottom is something else. The chasm is actually a memory.',
    },
  },
});
chasm.onEnter = function* () { yield* chasmVoice(); };
chasm.drifters = [
  { id: 'yc1', x: 15, y: 6, group: 'year_symbol', art: 'symbol', c1: YEAR.orange, c2: YEAR.yellow, wander: 1 },
];

function* chasmVoice(): Script {
  if (flag('chasm_voice')) return;
  setFlag('chasm_voice');
  yield* say("The Chasm's Voice", 'DOWN AND DOWN AND YOU CAN SEE THE BOTTOM AND THE BOTTOM CAN SEE YOU AND NEITHER OF YOU SAYS ANYTHING ABOUT IT');
  yield* say("The Chasm's Voice", 'IT EATS THE SAD THINGS YOU CARRY DOWN AND GETS BIGGER SO CARRY SOMETHING BRIGHT IF YOU STILL HAVE ONE');
}

/** The Despair: the world's despair is made manifest. */
function* despair(): Script {
  yield* say(null, 'At the bottom of the chasm the bottom stands up. It is the world\'s despair, made manifest.');
  yield* say('The Despair', 'THE YEAR WOULD NOT END AND SO THEY STOPPED ASKING IT TO. (you should stop asking too.)');
  music('despair');
  const r = yield* battle('boss_despair');
  if (r !== 'win') return;
  setFlag('despair_down');
  yield* say(null, 'The Despair comes apart. Under it there is only more chasm, and then a floor.');
  yield* learnSense('hearing', 2, 'Everything they never said out loud comes with you, very quietly. You can make Silence now.');
  yield* escape();
}

/** The Escape: you must escape the year before it consumes you. */
function* escape(): Script {
  setFlag('escaping');
  play('quake'); shake(30);
  yield* say(null, 'The Escape. The year notices you. It starts to close, from the edges in, like a hand.');
  yield* say(null, '(Get out of the Yellow Town by its west edge before 1977 decides you are from here.)');
  music('escape');
  F.timer = { t: 60 * 75, label: 'Leave 1977', fail: () => yearCloses() };
}

function yearCloses(): Script {
  return (function* (): Script {
    play('fade');
    yield* say(null, 'The year closes on you. For a while it is 1977 for you too.');
    S.f = Math.max(1, Math.round(S.f * 0.6));
    const s = spot('chasm', 'a');
    yield* warp('chasm', s.x, s.y, 0);
    F.timer = { t: 60 * 75, label: 'Leave 1977', fail: () => yearCloses() };
    music('escape');
  })();
}

function* escaped(): Script {
  F.timer = null;
  setFlag('escaping', 0);
  setFlag('year_done');
  play('portal');
  flash(YEAR.yellow, 10);
  yield* say(null, 'You step out of 1977. Behind you it keeps on being 1977, the way it always has.');
  if (!flag('keeper_past')) yield* say('Vorn', 'Somebody in there filed for that year. (somebody with no shell, like you.)');
  toast('The Year 1977: you escaped.', UI.gold);
  const s = spot('current', 'a');
  yield* warp('current', s.x, s.y, 3);
  music('current');
  void game;
}

export const YEAR_MAPS: MapDef[] = [town, factory, storyteller, chasm];
