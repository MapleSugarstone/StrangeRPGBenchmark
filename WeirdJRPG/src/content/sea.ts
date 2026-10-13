// Area 2: The Between-Sea. Locations, NPCs, and events follow AREA_SCRIPTS.md.
import { makeMap, spot, npc, cycle, steadyAt, inscription } from './kit';
import type { MapDef, Script } from '../game/types';
import { SEA, UI } from '../game/palette';
import {
  say, choose, wait, walkTo, face, warp, battle, flag, setFlag, play, shake, flash, music, learnSense, becomeState,
  leaveLb, toast, giveConcept, giveShellKind, S,
} from '../game/api';
import { ent, setTileSaved, F } from '../game/field';
import { game } from '../game/registry';
import { setProgress } from '../engine/audio';

const DOCKS: [string, string, string][] = [
  ['The Clockwork Plaza', 'plaza', 'e'],
  ['The Lighthouse of Lost Things', 'lighthouse', 'a'],
  ['The Reef of Forgotten Names', 'reef', 'a'],
  ['The Current of Time', 'current', 'a'],
  ["The Keeper's Archive", 'archive', 'a'],
];

function* toShip(): Script { const a = spot('ship', 'a'); yield* warp('ship', a.x, a.y, 2); }

function* disembark(): Script {
  const [, map, mark] = DOCKS[flag('ship_at')];
  const s = spot(map, mark);
  yield* warp(map, s.x, s.y, 0);
}

// ---------- The Ship of Many Sails ----------

const SHIP_ROWS = [
  '                                  ',
  '    rrrrrrrrrrrrrrrrrrrrrrrrr     ',
  '   r....S|S.....S|S.....S|S.r    ',
  '  r.....M|S..3..S|M.....S|S..r   ',
  ' r............................r  ',
  ' Aa..1.........L..........W...r  ',
  ' r............................r  ',
  '  r.....S|S.....S|M..3..S|S..r   ',
  '   rrrrrrrrrrrrrrrrrrrrrrrrrrr    ',
  '                                  ',
];

const SAIL_MEMORIES = [
  'a coast that remembered every ship that left it',
  'a sail being sewn by someone who would never see it fill',
  'a harbor where it was always the same evening',
];

const ship: MapDef = makeMap({
  ents: [{ id: 'insc_ship_wheel', x: 24, y: 4, art: 'npc:pages', c1: SEA.sand, c2: SEA.ink, talk: inscription('ship_wheel', 'Burned into the deck by the wheel:', 'NO DESTINATION. ONLY DIRECTION') }],
  id: 'ship', name: 'The Ship of Many Sails', area: 'sea', music: 'ship', rows: SHIP_ROWS, known: true, ambient: { color: '#b0c8ff', level: 0.75 },
  marks: {
    'a': { spot: true },
    'A': { tile: '.', touch: function* () { yield* disembark(); } },
    'L': steadyAt('A ship lantern that has never gone out', SEA.ink, SEA.lamp),
    '1': {
      id: 'sailor', art: 'npc:sailor', c1: SEA.blue, c2: SEA.sand, name: 'The Sailor', mood: 'misery',
      talk: npc(function* () {
        yield* say('The Sailor', "THE WORRY SIMMERED, BUBBLING LIKE A POT LEFT ON TOO LONG. THE YEAR? 1977, MAYBE. THEIR TEETH WERE YELLOW AND THEIR HEARTS WERE YELLOWER. CAN YOU BLAME THEM? EVERY MORNING FELT LIKE THE LAST ONE. NOBODY SAID SO. THEY PUT IT DOWN UNDER THREE INCHES OF ELECTRONIC MEAT AND BURRIED IT AND PATTED IT FLAT. THEY TOLD EACH OTHER STORIES SO THE NIGHT WOULD END. 'SOMEBODY WILL REMEMBER US,' THEY SAID, NOT LOUDLY. 'THAT HAS TO COUNT.' THE DESPAIR WENT SO FAR DOWN THAT EVEN THE SIGNS ON THE STREET GOT HEAVY");
      }),
      truth: 'The Sailor has been sailing the Between-Sea forever, looking for a home that does not exist.',
    },
    '3': {
      art: 'npc:crew', c1: SEA.mist, c2: SEA.blue, name: 'Crew', wander: 2,
      talk: cycle('Crew', 'crew', ['Sailing.', 'Still sailing.', 'No destination. Never had one.', 'The sails are memories. Do not pull on them.']),
    },
    'M': {
      tile: 'S', solid: true, id: 'sail',
      talk: function* () { yield* say(null, 'The sails are made of memories.'); },
      sense: {
        touch: function* () {
          const k = `sail:${(F.p.x * 31 + F.p.y) % 997}`;
          if (flag(k)) { yield* say(null, 'This part of the sail is plain canvas now.'); return; }
          setFlag(k);
          const i = flag('sails_taken');
          setFlag('sails_taken', i + 1);
          yield* giveConcept({ layer: 'memory', label: SAIL_MEMORIES[i % SAIL_MEMORIES.length], from: 'sail' }, 'You draw a memory out of the sail. The canvas goes plain where it was.');
        },
      },
    },
    'W': {
      id: 'wheel', art: 'npc:gear', c1: '#7a5a3a', c2: SEA.sand, rate: 9999,
      talk: function* () { yield* wheel(); },
      truth: 'The ship is actually a being. It has been sailing for eternity, and it has no destination.',
    },
  },
});
ship.onEnter = function* () {
  if (!flag('ch2')) setFlag('ch2');
  if (!flag('sea_intro')) yield* seaIntro();
  else if (flag('archive_down') && !flag('lb_left')) yield* lbLeaves();
};

function* seaIntro(): Script {
  setFlag('sea_intro');
  setProgress(0.4);
  setFlag('ship_at', 0);
  yield* wait(20);
  yield* say(null, 'The Between-Sea. An ocean that is also a mind. The water is translucent, and through it there are other realities.');
  yield* say('Vorn', 'Never been on water. (never been on a mind either.)');
  yield* say('Light-Bound #123', 'The Grafters have your shell, Vagabond! They file things in the Archive, out on the sea!');
  play('quake'); shake(16);
  yield* say(null, 'The Unraveling at Sea. Where the ship touches the water, the water forgets what shape it was.');
  yield* say(null, '(Steer from the wheel. The currents decide where you can go.)');
}

function* wheel(): Script {
  const open = [true, true, !!flag('light_done'), !!flag('reef_done'), !!flag('choice_made')];
  const opts = DOCKS.map(([n], i) => ({ text: n, ok: open[i] && i !== flag('ship_at') }));
  if (flag('archive_down')) opts.push({ text: 'Down. Under everything.', ok: true });
  opts.push({ text: 'Stay.', ok: true });
  const c = yield* choose(opts, { speaker: null, text: 'The wheel turns by itself. The currents can carry you to:' });
  if (c === opts.length - 1) return;
  if (flag('archive_down') && c === DOCKS.length) { yield* sinkDown(); return; }
  play('portal');
  shake(10);
  yield* say(null, 'Dream currents take the ship. The horizon is never reached, only more sea.');
  setFlag('ship_at', c);
  yield* disembark();
}

// ---------- The Lighthouse of Lost Things ----------

const LIGHT_ROWS = [
  '                                    ',
  '   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~    ',
  '  ~~,,,,,,,,,,,,~~~~~,,,,,,,,,~~~   ',
  ' ~~,,R,,,,,,,,,,,,,,,,,,,,c,,,,,~~  ',
  ' ~,,,,,,,####,,,,,,,,,,,,,,,,,,,,~  ',
  ' ~,,k,,,#llll#,,,,3,,,,,,,R,,,,,,~  ',
  ' ~,,,,,#llUlll#,,,,,,,,,,,,,,,4,,~  ',
  ' ~,,,,,#ll1lll#,,,,,,,,,,,,,,,,,,~  ',
  ' ~,,,,,#llllll#,,,k,,,,,,,,,,,,,,~  ',
  ' ~,c,,,,##ll##,,,,,,,,,,,R,,,,,c,~  ',
  ' ~,,,,,,,,S,,,,,,,,,,,,,,,,,,,,,,~  ',
  ' ~,,,,R,,,,,,,,,,,,2,,,,,,,,,,,,,~  ',
  ' ~~,,,,,,,,,,,,,,,,,,,,,,,,5,,,,~~  ',
  '  ~~,,,,,,,,,6,,,,,,,,,,,,,,,,,~~   ',
  '   ~~~~~~~~~~~~,,,,,~~~~~~~~~~~~    ',
  '      ~~~~~~~~~=a=~~~~~~~~~~        ',
  '              ~=A=~                 ',
];

const light: MapDef = makeMap({
  id: 'lighthouse', name: 'The Lighthouse of Lost Things', area: 'sea', music: 'lighthouse', rows: LIGHT_ROWS, ambient: { color: '#a0b8ff', level: 0.6 },
  marks: {
    'a': { spot: true, tile: '=' },
    'A': { tile: '=', touch: function* () { yield* toShip(); } },
    'S': steadyAt('The lighthouse lamp-light falls here', SEA.ink, SEA.lamp, 'npc:lightkeeper'),
    'U': { tile: '^', touch: function* () { yield* lampRoom(); } },
    '1': {
      id: 'lightkeeper', art: 'npc:lightkeeper', c1: SEA.mist, c2: SEA.lamp, name: 'The Lighthouse Keeper', mood: 'longing',
      talk: npc(function* () { yield* lightKeeper(); }),
      truth: 'The Lighthouse Keeper remembers everything that has been lost.',
    },
    '2': {
      id: 'echo', art: 'npc:echo', c1: SEA.lilac, c2: SEA.mist, name: 'The Echo', wander: 2, when: () => !flag('echo_home'),
      talk: npc(function* () { yield* echoTalk(); }),
      truth: 'A fragmented consciousness seeking a home.',
    },
    '3': { pickup: { kind: 'shell', id: 'coral', label: 'Coral Shell', flag: 'lh_shell1' }, art: 'pickup:shell', c1: SEA.coral, c2: SEA.sand },
    '4': { pickup: { kind: 'memory', id: 'm', label: "one man's trash", flag: 'lh_mem1', text: 'It has no inherent value. Someone lost it here anyway.' }, art: 'pickup:memory', c1: SEA.lamp, c2: SEA.foam },
    '5': { pickup: { kind: 'memory', id: 'm', label: 'a cup of coffee, refused', flag: 'lh_mem2' }, art: 'pickup:memory', c1: SEA.lamp, c2: SEA.foam },
    '6': { pickup: { kind: 'shell', id: 'feather', label: 'Storm Feather', flag: 'lh_shell2' }, art: 'pickup:shell', c1: SEA.foam, c2: SEA.mist, hidden: true },
  },
});
light.moving = t => {
  const u = spot('lighthouse', 'U');
  const a = t / 110;
  const lx = u.x * 8 + 4, ly = u.y * 8;
  return [{ x: lx, y: ly, r: 26, i: 0.9, color: '#f8e090' }, { x: lx + Math.cos(a) * 64, y: ly + Math.sin(a) * 44, r: 40, i: 0.95, color: '#f8e090' }];
};
light.drifters = [
  { id: 'll1', x: 25, y: 4, group: 'sea_gulls', art: 'gull', c1: SEA.foam, c2: SEA.mist, wander: 3 },
  { id: 'll2', x: 6, y: 12, group: 'light_child', art: 'child', c1: SEA.mist, c2: SEA.paper, wander: 2 },
  { id: 'll3', x: 28, y: 11, group: 'sea_crabs', art: 'crab', c1: SEA.coral, c2: SEA.sand, wander: 2 },
  { id: 'll4', x: 20, y: 7, group: 'light_mix', art: 'walker', c1: SEA.blue, c2: SEA.mist, wander: 3 },
];

function* lightKeeper(): Script {
  const i = (S.cursors['talk:lk'] || 0) % 2;
  S.cursors['talk:lk'] = i + 1;
  if (i === 0) yield* say('The Lighthouse Keeper', 'MUDDLED YARNS OF SLIPPERY TONGUES. YOU COMB THE SEAFLOOR BUT EVERY WRECK IS GONE. FRIENDLY STONE (sponge) WAVES AT YOU WITH ALL ITS HOLES. IT OFFERS YOU A SLICE OF PIE BUT YOU SAY NO (you are on a schedule). AT LAST, THERE IT IS. YOU HUG SOMEBODY ELSES JUNK TO YOUR SKINNY CHEST (eat something, honestly) AND KICK UP TO THE AIR. IT ISNT WORTH A THING BUT IT IS WORTH EVERYTHING TO YOU, AND THATS THE WHOLE POINT');
  else yield* say('The Lighthouse Keeper', "SOFT BOGS OF SPONGY CLAY. THE FROGS CROAK PRETTY FIBS TO KILL THE HOURS. BUT IT LEAKS. LIKE WATER THROUGH A SIEVE. LIKE AIR FROM A TIRE. LIKE WARMTH FROM A BATH. LIKE THE FOXE'S CLAWS SUNK LONG INTO AN OLD OLD HEN, HER FEATHERS LONG WORN THIN BY THE CRUELTY OF WIND. DID THE VINE RUN OUT OF WALL TO CLIMB? OR WAS IT CUT BACK BY THE KINDER OF TWO NEIGHBORS? I AM GOING UNDER. THE BOG BELOW ME HAS NO FLOOR, SO FAR DOWN I MUST GO. ONLY ONE DIRECTION LEFT (as the saying goes)");
  if (!(S.senses.smell || 0)) {
    yield* say('The Lighthouse Keeper', 'YOU SMELL THE MEMORIES OF THIS PLACE (salt, mostly) AND THEY LEAD YOU TO WHAT WAS LOST (go on).');
    yield* learnSense('smell', 1, 'You can smell the memories of places now. (Tab follows the scent of your goal.)');
  }
}

function* lampRoom(): Script {
  play('crystal');
  flash(SEA.lamp, 10);
  yield* say(null, 'The light is not light. It is consciousness. It sees into the future.');
  if (!flag('lamp_vision')) {
    setFlag('lamp_vision');
    yield* say(null, 'In the light: a crystal, pulsating, under everything. Inside the crystal there is a glowing orb with a happy face.');
    yield* say('Light-Bound #123', 'Is that me? Vagabond, I look delicious in there! Like a sunset cake!');
    yield* say('Vorn', '(it is not delicious.)');
    setFlag('light_done');
    yield* say(null, 'In the light, past the lighthouse, a reef with no names on it.');
  } else yield* say(null, 'The light shows what comes next. Right now it shows you, looking into it.');
}

function* echoTalk(): Script {
  const shells = Object.entries(S.shells).filter(([, n]) => n > 0);
  const opts = [
    { tone: 'Direct' as const, text: 'Who are you?' },
    { tone: 'Existential' as const, text: 'What are you?' },
    { tone: 'Metaphorical' as const, text: 'Live in a shell of mine.', ok: shells.length > 0 },
  ];
  const c = yield* choose(opts, { speaker: 'The Echo', text: flag('echo_last') ? String(S.cursors.echoLast || '...') : '...' });
  if (c === 0) { S.cursors.echoLast = 0; yield* say('The Echo', 'who are you? are you? you?'); setFlag('echo_last'); return; }
  if (c === 1) { yield* say('The Echo', 'what are you? are you? you?'); setFlag('echo_last'); return; }
  const [kind] = shells[0];
  S.shells[kind]--;
  setFlag('echo_home');
  play('absorb');
  yield* say('The Echo', 'a shell of mine. of mine. mine.');
  yield* say(null, 'The Echo goes into the shell. The shell sits up. It has a home.');
  giveConceptIdeaLocal('Home');
}

function giveConceptIdeaLocal(name: string): void {
  if (!S.concepts.includes(name)) S.concepts.push(name);
  toast(`Concept: ${name}`, UI.white);
  play('concept_get');
}

// ---------- The Reef of Forgotten Names ----------

const REEF_ROWS = [
  '                                      ',
  '  ccccccccccccccc     ccccccccccccc   ',
  ' c,,,,,,,,,,,,,,c   cc,,,,,,,,,,,,cc  ',
  ' c,k,,R,,,,1,,,,cc  c,,,,R,,,,,,n,,c  ',
  ' c,,,,,,,,,,,,,,,c  c,,,,,,,,,,,,,,c  ',
  ' cccccccccccc,,,,,ccc,,,,,ccccc,,,,c  ',
  '  c,,9,,,c  c,,,,,,,,,,,,,c   c,,,,c  ',
  '  c,,,,,,c  c,,,,TTTT,,,,,c   c,,k,c  ',
  '  c,,,R,,c  cc,,,TTTT,,,,cc   c,,,,c  ',
  '  cc,,,,,cc  c,,,,,,,,,,,c    cc,,,c  ',
  '   c,,,,,,c  ccccc,,,,cccc     c,,,c  ',
  '   c,,k,,,c      c,,,,c        cDccc  ',
  '   c,,q,,,c      c,,S,c        c,,c   ',
  '   cc,,,,cc      c,,,,c       cc,,cc  ',
  '    c,,,,c       cc,,cc      c,,,,,,c ',
  '    c,,,,c        c,,c       c,,E,,,c ',
  '    cc,,cc        c,,c       c,,,,,,c ',
  '     c,,c         c,,c       cc,,,,cc ',
  '     c,,c         c,,c        cccccc  ',
  '     c,,cccccccccc,,,c                ',
  '     c,,,,,,,,,   G,,c                ',
  '     cccccccccccccc,ac                ',
  '                   =A=                ',
];

const reef: MapDef = makeMap({
  id: 'reef', name: 'The Reef of Forgotten Names', area: 'sea', music: 'reef', rows: REEF_ROWS, forgets: true, sight: 4, ambient: { color: '#80d0c0', level: 0.5 },
  marks: {
    'a': { spot: true },
    'A': { tile: '=', touch: function* () { yield* toShip(); } },
    'S': steadyAt('Coral, warm, smiling. It is a good place to rest', SEA.coral, SEA.lilac, 'npc:pages'),
    '1': {
      id: 'nameless', art: 'npc:nameless', c1: SEA.seafoam, c2: SEA.foam, name: 'The Nameless', mood: 'confusion',
      talk: npc(function* () { yield* nameless(); }),
      truth: 'It had a name. The reef took it.',
    },
    '9': {
      id: 'yourname', art: 'pickup:name', c1: SEA.foam, c2: SEA.lilac, rate: 12,
      talk: function* () { yield* yourName(); },
      truth: 'Your name, in the water. It changes.',
    },
    'T': { tile: ',', touch: function* () { if (!flag('storm_names_done')) yield* stormOfNames(); } },
    'G': {
      id: 'gap', tile: ' ', solid: true, art: 'npc:pages', c1: SEA.night, c2: SEA.blue, when: () => !flag('reef_bridge'),
      talk: function* () { yield* say(null, 'A gap in the reef. It used to have a name. Without one it is only water.'); },
      rename: { Bridge: function* () { yield* renameGap(); } },
      truth: 'A nameless thing. It is waiting to be called something.',
    },
    'n': { pickup: { kind: 'name', id: 'n', label: 'Bridge', flag: 'name_bridge', text: 'A forgotten name, lying on the sand: Bridge. (Use names from the Collector on what is in front of you.)' }, art: 'pickup:name', c1: SEA.foam, c2: SEA.lilac },
    'D': {
      id: 'arch', tile: 'c', solid: true, art: 'npc:pages', c1: SEA.coral, c2: SEA.lilac, when: () => !flag('reef_door'),
      talk: function* () { yield* say(null, 'Coral that speaks in forgotten words. It says, very slowly, a word that is almost "door".'); },
      rename: { Door: function* () { setFlag('reef_door'); const d = spot('reef', 'D'); setTileSaved(d.x, d.y, ','); play('door'); yield* say(null, 'You call the coral Door. It agrees, and opens.'); } },
    },
    'E': { tile: ',', touch: function* () { if (!flag('reef_done')) yield* reefExit(); } },
    'q': { pickup: { kind: 'name', id: 'n', label: 'Door', flag: 'name_door', text: 'Another forgotten name, half buried: Door.' }, art: 'pickup:name', c1: SEA.foam, c2: SEA.lilac },
  },
});
reef.drifters = [
  { id: 'rf1', x: 6, y: 9, group: 'reef_fish', art: 'fish', c1: SEA.seafoam, c2: SEA.foam, wander: 3 },
  { id: 'rf2', x: 25, y: 3, group: 'reef_coral', art: 'coral', c1: SEA.coral, c2: SEA.lilac, wander: 1 },
  { id: 'rf3', x: 32, y: 6, group: 'reef_mix', art: 'crab', c1: SEA.coral, c2: SEA.sand, wander: 2 },
  { id: 'rf4', x: 8, y: 15, group: 'sea_walker', art: 'walker', c1: SEA.blue, c2: SEA.mist, wander: 2 },
];

function* nameless(): Script {
  const i = (S.cursors['talk:nl'] || 0) % 2;
  S.cursors['talk:nl'] = i + 1;
  if (i === 0) yield* say('The Nameless', 'MY NAME? GONE. RINSED OFF. I HAD IT IN MY MOUTH A SECOND AGO AND NOW THERE IS ONLY TOOTH. FISH SWIM THROUGH ME WITH NO NAMES EITHER AND WE ARE ALL VERY POLITE ABOUT IT. CALL ME SOMETHING. ANYTHING. CALL ME GERALD. NO DONT.');
  else {
    const pre = S.avatar === 'snake' ? 'a snake from birth to death' : S.avatar === 'dice' ? 'a dice, rolling in the air' : 'neither';
    yield* say('The Nameless', 'BACKACHE? I SNORT. EARACHE? WHOOPS. HEY CAN YOU WIGGLE YOUR TOES? HEY CAN YOU DO THAT THING WHERE YOU CROSS YOUR EYES? HEY CAN YOU CRACK YOUR KNUCKLES? HEY CAN YOU HUM? HEY CAN YOU HUM? FOLD. FOLD AND CRUMPLE AND KNOT AND BUCKLE. YOU ARE TALKING BUT THERE IS NOBODY THERE. WHO IS TALKING? A WET MACHINE WRAPPED IN SKIN CURTAINS AND RIB FENCING? DO YOU EVEN STEER? ARE YOU A SNAKE ALL THE WAY DOWN, OR A DICE, STILL FALLING? NOTHING IS DECIDED UNTIL YOU STOP, PILGRIM');
    if (!flag('nameless_avatar')) { setFlag('nameless_avatar'); yield* say(null, `(You told yourself you were ${pre}.)`); }
  }
}

const NAMEFORMS = ['PILGRIM', 'VAGABOND', 'THE ONE WHO WALKS', 'HERSELF', 'NOBODY', 'WIRE', 'THE CAUSE'];

function* yourName(): Script {
  const n = S.cursors.nameLook || 0;
  S.cursors.nameLook = n + 1;
  const form = NAMEFORMS[(n * 3 + (game.tick >> 5)) % NAMEFORMS.length];
  play('name_get');
  yield* say(null, `You find your name here, written on the water. It says ${form}. You look again and it has changed.`);
}

function* stormOfNames(): Script {
  setFlag('storm_names_done');
  shake(30); play('storm');
  flash(SEA.lilac, 10);
  setFlag('names_storm', 1);
  yield* say(null, 'The Storm of Names. Every name on the reef is torn off and thrown into the air.');
  yield* say('Vorn', 'Hero! Your name. My name. (what was my name.)');
  const r = yield* battle('storm_names');
  setFlag('names_storm', 0);
  if (r !== 'win') { setFlag('storm_names_done', 0); return; }
  yield* say(null, 'The storm comes apart into names. They settle on the water like leaves.');
  yield* becomeState(3);
  yield* say(null, '(You can Extract Name now. A forgotten thing may disappear, or become something else.)');
  yield* say(null, '(Names can also be used on things in the world. Some things here are waiting to be called something.)');
}

function* renameGap(): Script {
  setFlag('reef_bridge');
  const g = spot('reef', 'G');
  for (let x = g.x - 3; x <= g.x; x++) setTileSaved(x, g.y, '=');
  play('rename');
  flash(SEA.foam, 6);
  yield* say(null, 'You call the gap Bridge. It remembers being one.');
}

function* reefExit(): Script {
  setFlag('reef_done');
  yield* say(null, 'Past the reef, the water starts to run in two directions at once. The Current of Time.');
}

// ---------- The Current of Time ----------

const CURRENT_ROWS = [
  '                                        ',
  '  ,,,,,      ,,,,,,,,      ,,,,,,,,     ',
  '  ,,1,,>>>>>>,,,,,,,,<<<<<<,,,,,,,,     ',
  '  ,,,,,      ,,,,,,,,      ,,,,S,,,     ',
  '   u           nn            u          ',
  '   u           nn            u          ',
  '  ,,,,,,     ,,,,,,,,     ,,,,,,,       ',
  '  ,,,,,,<<<<<,,,,X,,,>>>>>,,,,,,,       ',
  '  ,,,,,,     ,,,,,,,,     ,,,,,,,       ',
  '   u             nn          n          ',
  '   B             nn          F          ',
  '  ,,,,,    ,,,,,,,,,,,,     ,,,,,,      ',
  '  ,,,,,<<<<,,,,,,,,,,,,>>>>>,,,,,,      ',
  '  ,,,,,    ,,,,,,a,,,,,     ,,,,,,      ',
  '           ,,,,,,A,,,,,                 ',
];

const current: MapDef = makeMap({
  id: 'current', name: 'The Current of Time', area: 'sea', music: 'current', rows: CURRENT_ROWS, sight: 6, ghosts: true, timeStops: true, ambient: { color: '#c0e0ff', level: 0.8 },
  marks: {
    'a': { spot: true },
    'A': { tile: '=', touch: function* () { yield* toShip(); } },
    'S': steadyAt('A still place in the current', SEA.teal, SEA.foam, 'npc:timecurrent'),
    '1': {
      id: 'timecurrent', art: 'npc:timecurrent', c1: SEA.seafoam, c2: SEA.lilac, name: 'The Time-Current', rate: 10,
      talk: npc(function* () { yield* timeCurrent(); }),
      truth: 'A current that flows backwards and forwards.',
    },
    'X': { tile: ',', touch: function* () { if (!flag('choice_made') && (S.senses.thought || 0)) yield* choiceOfCurrent(); } },
    'B': { tile: 'u', when: () => !!flag('choice_made'), touch: function* () { yield* toYear(); } },
    'F': { tile: 'n', when: () => !!flag('choice_made'), touch: function* () { setFlag('ship_at', 4); const s = spot('archive', 'a'); yield* warp('archive', s.x, s.y, 3); } },
  },
});
current.drifters = [
  { id: 'cu1', x: 16, y: 2, group: 'current_nothing', art: 'nothing', c1: '#3c3654', c2: '#f4f0ff', wander: 2 },
  { id: 'cu2', x: 5, y: 7, group: 'current_mix', art: 'gull', c1: SEA.foam, c2: SEA.mist, wander: 2 },
  { id: 'cu3', x: 28, y: 12, group: 'current_child', art: 'child', c1: SEA.mist, c2: SEA.paper, wander: 2 },
];
current.onEnter = function* () {
  if (!flag('current_seen')) {
    setFlag('current_seen');
    yield* wait(20);
    yield* say(null, 'Time flows in both directions here. Behind you walks your past self. Somewhere ahead stands your future self.');
    yield* say(null, 'Your past self walks in from the edge of the sea. Every tile behind it cracks.');
  }
};

function* timeCurrent(): Script {
  yield* say('The Time-Current', 'CHECKING YOUR NOTES ARE WE? THE SUN-PILGRIM ARRANGEMENT IS SPECIAL, IT LEAKS THROUGH THE WORKING GEARS OF THE MANY-SIDED STATIC. IT IS WHAT BREWS THE ODDS THAT LET A PILGRIM THINK AT ALL. A BIT LIKE AN ENORMOUS PULLED-TAFFY POLYHEDRON SPLINTER');
  yield* say('The Time-Current', "(we got here after it ended pilgrims. dont spend yourselves mending it. we may lose sorrel, but while you are still tied to my quiet you will dance with me forever. do not throw away your always. do not be silly)");
  if (!(S.senses.thought || 0)) {
    yield* learnSense('thought', 1, 'Time stands still while you decipher it. You can use Insight now. Untranslatable things read plainly.');
    yield* say(null, 'In the middle of the current the water splits. One way runs backward. One way runs forward.');
  }
}

/** The Choice of Current: a decision that determines which path you take. */
function* choiceOfCurrent(): Script {
  yield* say(null, 'The Choice of Current. The water splits under you.');
  const c = yield* choose([
    { tone: 'Existential', text: 'Backward. Into what happened.' },
    { tone: 'Direct', text: 'Forward. To the Archive and my shell.' },
  ], { speaker: null, text: 'Backward, the current runs toward a yellow year. Forward, toward the Archive.' });
  setFlag('choice_made');
  setFlag('year_open');
  setFlag('choice_back', c === 0 ? 1 : 0);
  if (c === 0) yield* toYear();
  else { setFlag('ship_at', 4); const s = spot('archive', 'a'); yield* warp('archive', s.x, s.y, 3); }
}

function* toYear(): Script {
  play('portal');
  yield* say(null, 'The current runs backward. The water turns yellow.');
  const s = spot('yellowtown', 'a');
  yield* warp('yellowtown', s.x, s.y, 0);
}

// ---------- The Keeper's Archive ----------

const ARCHIVE_ROWS = [
  '##################################',
  '#CCCCCCCC#pppppppppppppp#CCCCCCCC#',
  '#.......p#..............#.......p#',
  '#.bb.bb..#..............#.bb.bb..#',
  '#.bb.bb..#.......X......#.bb.bb..#',
  '#........#..............#....4...#',
  '#..p.....##....pppp....##........#',
  '#.........#............#.........#',
  '##.###.####............####.###.##',
  '#.........######..######.........#',
  '#..2...........#..#..........3...#',
  '#.CCCC..CCCC...#..#...CCCC..CCCC.#',
  '#..............#.................#',
  '#.pp...........h..#.....S........#',
  '###########.####..#####.##########',
  '#...........#.........#..........#',
  '#.CCC.CCC...#....1.......CCC.CCC.#',
  '#...........#.........#..........#',
  '#####################a############',
  '~~~~~~~~~~~~~~~~~~~~=A=~~~~~~~~~~~',
];

const archive: MapDef = makeMap({
  indoor: true,
  id: 'archive', name: "The Keeper's Archive", area: 'sea', music: 'archive', rows: ARCHIVE_ROWS, sight: 5, ambient: { color: '#e0d8c0', level: 0.5 },
  legend: { '.': { art: ['11111111', '12111111', '11111111', '11111121', '11111111', '11111111', '11211111', '11111111'], c1: '#c8c0a8', c2: '#e4e0d0', ink: SEA.ink } },
  marks: {
    'a': { spot: true },
    'A': { tile: '=', touch: function* () { yield* toShip(); } },
    'S': steadyAt('A desk lamp, signed for in triplicate', SEA.ink, SEA.lamp),
    '1': {
      id: 'keeper', art: 'npc:keeper', c1: SEA.paper, c2: SEA.purple, name: 'The Keeper', ox: -4, oy: -8,
      talk: npc(function* () { yield* keeperTalk(); }),
      truth: 'The Keeper. Multiple faces, constantly changing, surrounded by floating papers. Once a Pilgrim.',
    },
    '2': {
      art: 'npc:crew', c1: SEA.paper, c2: SEA.ink, name: 'Grafter', wander: 2,
      talk: cycle('Grafter', 'grafter', ['Order through consumption.', 'Your shell? Processed. Next.', 'Form 1977-B is the form for everything.']),
    },
    '3': {
      id: 'processing', art: 'npc:pages', c1: SEA.paper, c2: SEA.ink,
      talk: function* () { yield* say(null, 'The Processing Center, where shells are processed. A form on the desk: SHELL, PILGRIM. STATUS: SENT DOWN.'); },
    },
    '4': { pickup: { kind: 'shell', id: 'paper', label: 'Paper Shell', flag: 'ar_shell1' }, art: 'pickup:shell', c1: SEA.paper, c2: SEA.ink },
    'h': { tile: 'h' },
    'X': {
      id: 'archive_core', art: 'npc:pages', c1: SEA.paper, c2: SEA.purple, when: () => !flag('archive_down'), rate: 8,
      talk: function* () { yield* archiveBoss(); },
      truth: 'A being made of infinite papers, faces, and bureaucracy.',
    },
  },
});
archive.drifters = [
  { id: 'ar1', x: 4, y: 7, group: 'archive_paper', art: 'paperwalker', c1: SEA.paper, c2: SEA.ink, wander: 3 },
  { id: 'ar2', x: 28, y: 3, group: 'archive_collect', art: 'collector', c1: SEA.paper, c2: SEA.purple, wander: 2 },
  { id: 'ar3', x: 16, y: 11, group: 'archive_mix', art: 'recorder', c1: SEA.paper, c2: SEA.teal, wander: 1 },
  { id: 'ar4', x: 6, y: 15, group: 'archive_paper', art: 'paperwalker', c1: SEA.paper, c2: SEA.ink, wander: 2 },
];

function* keeperTalk(): Script {
  if (flag('archive_down')) {
    const i = (S.cursors['talk:keeper'] || 0) % 2;
    S.cursors['talk:keeper'] = i + 1;
    if (i === 0) yield* say('The Keeper', 'Pending. Still pending. (it is very relaxing.)');
    else yield* say('The Keeper', 'Is that all a form is? Ink? Is it a loophole? Or are you telling me if I stamp a stack of paper enough times it will start filing itself too?');
    return;
  }
  if (!flag('keeper_met')) {
    setFlag('keeper_met');
    yield* say('The Keeper', 'The year? 1977, probably. Their teeth were yellow and their forms were blank. Who could blame them?');
    const c = yield* choose([
      { tone: 'Direct', text: 'Where is my shell?' },
      { tone: 'Bureaucratic', text: 'I would like to file a complaint.' },
      { tone: 'Existential', text: 'Who were you, before?' },
    ]);
    if (c === 0) yield* say('The Keeper', 'Your shell? Form 1977-B. Processed. Sent down.');
    else if (c === 1) yield* say('The Keeper', 'A complaint? Form 1977-B. Everything is Form 1977-B.');
    else yield* say('The Keeper', 'Before? 1977, I think.');
    yield* say('The Keeper', 'Order through consumption. The Archive keeps everything. The Archive is in the middle. Go and be kept.');
    return;
  }
  yield* say('The Keeper', 'Your file? Incomplete. Incomplete how? Missing a shell, missing a name, missing a reason. Next.');
}

function* archiveBoss(): Script {
  yield* say(null, 'The Archive stands up out of its own paperwork. Papers. Faces. Bureaucracy, all the way through.');
  yield* say('The Keeper', 'Is it my turn? It is never my turn. Then whose turn is it? Yours. Unfortunately.');
  yield* say(null, '(Its faces show you false moves. Sight sees through them.)');
  music('keeper');
  const r = yield* battle('boss_archive');
  if (r !== 'win') return;
  setFlag('archive_down');
  play('paper'); shake(24);
  yield* say(null, 'The Archive collapses. Paper comes down everywhere like snow.');
  const k = ent('keeper');
  if (k) { yield* walkTo('keeper', k.x, 9, 10); face('keeper', 0); }
  yield* say('The Keeper', 'Freed? Is that a status? It is not on the form. Then I am not freed. I am Pending.');
  yield* say('The Keeper', 'Your shell? Sent down. Down where? The Stone-Deep. Take the form. Form 1977-B. It opens the way down.');
  play('paper');
  toast('Form 1977-B', UI.gold);
  yield* say(null, 'The Keeper is freed. It does not look different. It goes back to filing.');
}

function* lbLeaves(): Script {
  setFlag('lb_left');
  yield* wait(20);
  yield* say('Light-Bound #123', 'Vagabond! I am going ahead! I am going to be the first to reach the Stone!');
  yield* say('Light-Bound #123', 'I will start the sunset cake before you get there! It takes a very long time!');
  const c = yield* choose([
    { tone: 'Direct', text: 'Wait for us.' },
    { tone: 'Fragmented', text: 'The light. The crystal. You, in it.' },
    { tone: 'Existential', text: 'Go.' },
  ]);
  if (c === 1) yield* say('Light-Bound #123', 'Delicious! See you there!');
  else yield* say('Light-Bound #123', 'You\'re so sweet, Vagabond!');
  play('float');
  const s = spot('ship', 'a');
  void s;
  leaveLb();
  flash('#fff0a0', 10);
  yield* say(null, 'Light-Bound #123 lifts off the deck and goes down into the sea, glowing all the way down.');
  yield* say('Vorn', '(she went down glowing. like a coal dropped down a well. like a lamp left on in an empty house. i should have gone first. i always should go first.)');
  yield* seerSecond();
}

function* seerSecond(): Script {
  flash('#fff8d0', 10);
  play('crystal');
  music('seer');
  yield* say(null, 'The light whose shape will not hold still is standing at the prow.');
  yield* say('The Seer', 'It is a strange thing, to watch a world come loose and to know whose hands it came loose in. I do not blame them. I only notice, the way one notices weather. Until later, then.');
  flash('#fff8d0', 10);
  yield* say(null, 'The light goes out.');
  music('ship');
}

function* sinkDown(): Script {
  yield* say('Vorn', 'Down. (only one direction left.)');
  play('quake'); shake(30);
  yield* say(null, 'The Unraveling reaches the whole Between-Sea. The water forgets it is water. The ship sinks, and keeps sinking, on purpose.');
  setFlag('ch4');
  const s = spot('spire', 'a');
  yield* warp('spire', s.x, s.y, 3);
}

export const SEA_MAPS: MapDef[] = [ship, light, reef, current, archive];
void giveShellKind;
