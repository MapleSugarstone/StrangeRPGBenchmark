// Life in the towns: people walking set routes, pairs talking, chores, whorls napping, and small set pieces that tell a story.
import '../game/furniture';
import { chapter } from '../game/state';
import { PROPS } from '../game/props';
import { MAPS, type NpcDef } from '../game/world';
import { look, stash } from './areakit';

/** A set piece in town. A solid one stands on ground tiles that block the way, so it reads as a thing in the street. */
function piece(map: string, pic: string, x: number, y: number, solid: boolean, when?: () => boolean, blockW?: number): void {
  const m = MAPS[map];
  (m.props ||= []).push({ x, y, pic, when });
  if (!solid) return;
  const w = blockW ?? PROPS[pic]?.w ?? 1;
  for (let i = 0; i < w; i++) (m.mods ||= []).push({ x: x + i, y, ch: '`', when: () => true });
}

/** Two posts of a washing line or a net frame block the way, and the middle stays open to walk under. */
function posts(map: string, pic: string, x: number, y: number, w: number): void {
  const m = MAPS[map];
  (m.props ||= []).push({ x, y, pic });
  (m.mods ||= []).push({ x, y, ch: '`', when: () => true }, { x: x + w - 1, y, ch: '`', when: () => true });
}

const add = (map: string, ...people: NpcDef[]) => MAPS[map].npcs.push(...people);

/** A child running a small loop after a whorl, one step behind it. The loop is two tiles on a side, starting at x, y going right. */
function chase(map: string, id: string, x: number, y: number, kind: string, kindName: string, child: string, lines: string[]): void {
  add(map,
    { id: id + 'w', x, y, sprite: 'stone', mon: kind, name: kindName, route: 'rrddlluu', pace: 10, movable: true, lines: ['It skips sideways and keeps going round.'] },
    { id: id + 'c', x, y: y + 2, sprite: child, name: 'Child', route: 'uurrddll', pace: 10, movable: true, lines },
  );
}

/** Two people side by side, talking. They face each other and turn to Ouro while Ouro stands close. */
function pairUp(map: string, id: string, x: number, y: number, a: [string, string, string[]], b: [string, string, string[]], bench = true): void {
  if (bench) piece(map, 'bench', x, y, false);
  add(map,
    { id: id + 'a', x, y, sprite: a[0], name: a[1], lines: a[2], pair: id + 'b', dir: 1 },
    { id: id + 'b', x: x + 1, y, sprite: b[0], name: b[1], lines: b[2], pair: id + 'a', dir: 3 },
  );
}

/** A whorl asleep in the doorway of an old shell, now and then a little bubble of sleep over it. */
function napper(map: string, id: string, x: number, y: number, kind: string, name: string): void {
  add(map, { id, x, y, sprite: 'stone', mon: kind, name, dir: 0, idle: { every: 150, emote: 'sleep' }, lines: ['Fast asleep. One foot twitches.'] });
}

// ---------------------------------------------------------------- Turnstone

chase('fellside', 'tschase', 29, 4, 'hare', 'Hare', 'child', ['It\'s not mine! I just like chasing it.', 'It\'s the one that always wins. I\'m the one who comes closest.']);
pairUp('fellside', 'tsbench', 13, 23,
  ['villager', 'Woman', ['We\'re talking about the fracture. Again.', 'Don\'t reveal that I used that word.']],
  ['elder', 'Old man', ['When I was young, the earth stayed solid.', 'Well. Mostly. There was that single instance.']]);
// The carter's cart has a wheel off until Ouro has been out on the roads a while. Then it rolls again.
piece('fellside', 'cartbroken', 5, 12, true, () => chapter() < 3);
piece('fellside', 'cart', 5, 12, false, () => chapter() >= 3);
{
  const carter = MAPS.fellside.npcs.find(n => n.id === 'carter');
  if (carter) carter.idle = { every: 160, act: 'bow' };
}
posts('fellside', 'washline', 30, 24, 3);
add('fellside', { id: 'tswasher', x: 29, y: 24, sprite: 'oldwoman', name: 'Woman', dir: 1, idle: { every: 170, act: 'lift' },
  lines: ['Laundry dries quickly after a Shedding Day. It must be the air.', 'Or maybe I just had fewer clothes to wash. That\'s probably it.'] });
napper('fellside', 'tsnapper', 10, 23, 'puffball', 'Puffball');
piece('fellside', 'broom', 8, 22, false);
add('fellside', { id: 'tssweeper', x: 6, y: 23, sprite: 'villager2', name: 'Sweeper', route: '.rr.ll', pace: 14, idle: { every: 90, act: 'bow' }, movable: true,
  lines: ['I\'m sweeping shell fragments off the step. They always end up back there.', 'Everyone seems to be shedding something this year.'] });
piece('fellside', 'flowers', 2, 24, false); piece('fellside', 'flowers', 3, 24, false);
piece('fellside', 'lantern', 12, 9, true);
piece('fellside', 'spilled', 26, 30, false);
(MAPS.fellside.spots ||= []).push(look(26, 30, 'A tipped-over basket, with cockles scattered everywhere. Tiny footprints lead away toward the cove.'));

// ---------------------------------------------------------------- Rib

chase('rib', 'ribchase', 31, 17, 'paring', 'Paring', 'boy', ['Paring! Ease up! ...Please?', 'It\'s the same routine every time. I could just wait it out.']);
pairUp('rib', 'ribbench', 8, 18,
  ['villager2', 'Man', ['The Rib was humming all night long.', 'She claims I was snoring. It was the Rib.']],
  ['villager', 'Woman', ['It was actually him snoring.', 'The Rib doesn\'t snore. It hums. That\'s a completely different thing.']]);
// The wheel is back on once Ouro has the Rib pearl, and the man has time to talk about something else.
piece('rib', 'cartbroken', 36, 26, true, () => chapter() < 2);
piece('rib', 'cart', 36, 26, false, () => chapter() >= 2);
add('rib', { id: 'ribfixer', x: 38, y: 26, sprite: 'tanner', name: 'Man', dir: 3, idle: { every: 140, act: 'bow' },
  lines: () => chapter() < 2 ? ['A wheel came off on a rib bone. Rib bones everywhere here.', 'You\'d think we\'d learn by now. We never do.']
    : ['The wheel is back on. It took a week and nearly all my patience.', 'Now I just polish it. It feels well-deserved.'] });
posts('rib', 'washline', 16, 5, 3);
add('rib', { id: 'ribwasher', x: 15, y: 5, sprite: 'oldwoman', name: 'Woman', dir: 1, idle: { every: 160, act: 'lift' },
  lines: ['Hang it near the Rib and it dries warm. The Rib is always slightly warm.'] });
napper('rib', 'ribnapper', 13, 5, 'cairn', 'Cairn');
piece('rib', 'lantern', 19, 14, true); piece('rib', 'lantern', 24, 14, true);
piece('rib', 'flowers', 30, 5, false); piece('rib', 'flowers', 31, 5, false);

// ---------------------------------------------------------------- Mast

posts('mast', 'netframe', 10, 13, 2);
add('mast', { id: 'mastmender', x: 12, y: 13, sprite: 'villager2', name: 'Net-mender', dir: 3, idle: { every: 150, act: 'bow' },
  lines: ['Mending nets for an ocean that doesn\'t exist.', 'When it returns, I\'ll be here. Are you? You look prepared.'] });
piece('mast', 'rodline', 23, 27, false);
add('mast', { id: 'mastfisher', x: 22, y: 27, sprite: 'beach2', name: 'Fisher', dir: 1, idle: { every: 200, act: 'nod' },
  lines: ['Casting lines in the Dry Sea. Not a single bite.', 'There won\'t be. That isn\'t the point.'] });
chase('mast', 'mastchase', 11, 27, 'fiddler', 'Fiddler', 'child', ['It moves laterally! You can\'t pursue what moves sideways!', 'I\'m attempting to, though.']);
pairUp('mast', 'mastpair', 30, 13,
  ['beach1', 'Sailor', ['The ship isn\'t coming. There is no sea.', 'We wait regardless. It is what sailors do.']],
  ['beach3', 'Sailor', ['I\'ve heard the sea is returning.', 'I heard it from him. He heard it from me.']], false);
piece('mast', 'crates', 24, 9, true); piece('mast', 'barrel', 26, 9, true);
napper('mast', 'mastnapper', 12, 9, 'scree', 'Scree');

// ---------------------------------------------------------------- Spire

piece('spire', 'broom', 16, 15, false);
add('spire', { id: 'spiresweep', x: 17, y: 16, sprite: 'ringer', name: 'Sweeper', route: '.rrr.lll', pace: 16, idle: { every: 80, act: 'bow' }, movable: true,
  lines: ['quiet. i\'m sweeping the church steps.', 'Quietly. The broom is new. It squeaks.'] });
pairUp('spire', 'spirebench', 30, 20,
  ['villager', 'Woman', ['did you hear about the bells', 'they\'re all a bit wrong now']],
  ['elder', 'Old man', ['i heard', 'honestly, i preferred them when they were wrong.']]);
chase('spire', 'spirechase', 5, 19, 'mycel', 'Mycel', 'child', ['come back. please, come back.', 'i\'m not permitted to shout here. it knows that.']);
piece('spire', 'lantern', 16, 17, true); piece('spire', 'lantern', 24, 17, true);
napper('spire', 'spirenapper', 11, 27, 'peat', 'Peat');

// ---------------------------------------------------------------- Bole

piece('bole', 'broom', 13, 15, false);
add('bole', { id: 'bolesweep', x: 14, y: 15, sprite: 'grafter', name: 'Sweeper', route: '.rr.ll', pace: 14, idle: { every: 90, act: 'bow' }, movable: true,
  lines: ['Bark sheds from the Bole all day long. Someone must sweep it away.', 'That\'s me. No complaints. It smells lovely.'] });
pairUp('bole', 'bolebench', 28, 18,
  ['villager2', 'Man', ['The rain went up again this morning.', 'It took my hat with it.']],
  ['villager', 'Woman', ['It was a lousy hat anyway.', 'The rain actually did you a service.']]);
chase('bole', 'bolechase', 37, 9, 'dandle', 'Dandle', 'boy', ['It drifts away when I approach! That\'s not fair!', 'Alright, one more lap.']);
piece('bole', 'cartbroken', 12, 23, true);
add('bole', { id: 'bolefixer', x: 14, y: 23, sprite: 'villager2', name: 'Man', dir: 3, idle: { every: 150, act: 'bow' },
  lines: ['A root popped up under the cart overnight.', 'The roots do that here. You get used to parking on rock.'] });
posts('bole', 'washline', 36, 13, 3);
napper('bole', 'bolenapper', 11, 7, 'burr', 'Burr');

// ---------------------------------------------------------------- Hum

piece('hum', 'cartbroken', 31, 16, true);
add('hum', { id: 'humfixer', x: 33, y: 16, sprite: 'hummer', name: 'Tinker', dir: 3, idle: { every: 130, act: 'bow' },
  lines: ['Fitting a Rider cog into a cart wheel.', 'Now it ticks when it rolls. An improvement, I\'d say.'] });
pairUp('hum', 'humbench', 7, 20,
  ['villager', 'Woman', ['The Pylon vibrates with a tone. I match it.', 'He claims I\'m out of tune.']],
  ['villager2', 'Man', ['She\'s flat.', 'The Pylon\'s flat too, to be fair.']]);
chase('hum', 'humchase', 33, 24, 'piston', 'Piston', 'child', ['It rises and falls, rises and falls!', 'I feel sick. Does it feel sick too?']);
piece('hum', 'rodline', 11, 5, false);
add('hum', { id: 'humfisher', x: 10, y: 6, sprite: 'beach4', name: 'Fisher', dir: 1, idle: { every: 220, act: 'nod' },
  lines: ['The Rimwater fish taste like batteries.', 'At least they\'re good batteries.'] });
piece('hum', 'lantern', 21, 15, true); piece('hum', 'lantern', 23, 15, true);
napper('hum', 'humnapper', 11, 24, 'turbine', 'Turbine');

// ---------------------------------------------------------------- Tusk

chase('tusk', 'tuskchase', 25, 27, 'auk', 'Auk', 'boy', ['The auk slides better than I do.', 'I\'m picking it up. Mostly by falling on my face.']);
piece('tusk', 'stove', 13, 28, true);
add('tusk',
  { id: 'tuskwarm1', x: 12, y: 28, sprite: 'elder', name: 'Old man', dir: 1, pair: 'tuskwarm2', lines: ['Warm your hands. The brazier is for everyone.', 'The Tusk\'s decree. Or maybe it\'s older than the Tusk itself.'] },
  { id: 'tuskwarm2', x: 14, y: 28, sprite: 'oldwoman', name: 'Old woman', dir: 3, pair: 'tuskwarm1', lines: ['He just made that rule up last year.', 'But it\'s a good one, anyway.'] });
piece('tusk', 'broom', 21, 31, false);
add('tusk', { id: 'tuskshovel', x: 22, y: 31, sprite: 'villager2', name: 'Shoveler', route: '.rrrr.llll', pace: 16, idle: { every: 80, act: 'bow' }, movable: true,
  lines: ['Clear the street. Then shovel it again.', 'It\'s a life\'s work.'] });
posts('tusk', 'washline', 2, 28, 3);
napper('tusk', 'tusknapper', 10, 35, 'floe', 'Floe');

// ---------------------------------------------------------------- Hilt

add('hilt', { id: 'hiltpatrol', x: 14, y: 13, sprite: 'keeper', name: 'Guard', route: 'rrrrrrrrrr.llllllllll.', pace: 12, movable: true,
  lines: ['On patrol. From here to there, then back.', 'Extremely vital. No one\'s bothered to explain why.'] });
pairUp('hilt', 'hiltbench', 6, 22,
  ['keeper', 'Guard', ['Clocking out. Still on guard duty, in a way.', 'You never truly clock out.']],
  ['villager', 'Woman', ['He never truly clocks out.', 'He watches the soup. He watches the cat.']]);
chase('hilt', 'hiltchase', 33, 22, 'tang', 'Tang', 'child', ['It\'s a blade-stone on legs!', 'It\'s not sharp, though. I tested it. With my hand.']);
piece('hilt', 'cartbroken', 2, 13, true);
add('hilt', { id: 'hiltfixer', x: 4, y: 13, sprite: 'tanner', name: 'Smith\'s boy', dir: 3, idle: { every: 140, act: 'bow' },
  lines: ['Mending the smith\'s cart. Smith said it\'d build character.', 'I\'ve got plenty of character now.'] });
napper('hilt', 'hiltnapper', 3, 27, 'buckler', 'Buckler');
piece('hilt', 'lantern', 11, 6, true); piece('hilt', 'lantern', 13, 6, true);

// ---------------------------------------------------------------- Fall

chase('fall', 'fallchase', 28, 10, 'tor', 'Tor', 'boy', ['It rolls down the hill, then walks back up!', 'Then it rolls again. It loves it. I love it.']);
pairUp('fall', 'fallbench', 31, 18,
  ['starwalker', 'Woman', ['A star crashed into my garden last night.', 'Wonderful. It ate my cabbages.']],
  ['villager2', 'Man', ['Stars don\'t consume vegetables.', 'It was something, though. The cabbages are gone.']]);
add('fall', { id: 'fallsweep', x: 24, y: 20, sprite: 'villager2', name: 'Sweeper', route: '.rrr.lll', pace: 14, idle: { every: 90, act: 'bow' }, movable: true,
  lines: ['Sweeping up star glitter. It sweeps itself down the hill.', 'I just trail behind it, really.'] });
piece('fall', 'broom', 23, 20, false);
piece('fall', 'spilled', 24, 24, false);
napper('fall', 'fallnapper', 35, 6, 'coma', 'Coma');

// ---------------------------------------------------------------- the roads: signs, things left behind, and a find in a far corner

const sign = (map: string, id: string, x: number, y: number, line: string) => add(map, { id, x, y, sprite: 'sign', name: null as any, lines: [line] });
const spot = (map: string, s: NonNullable<(typeof MAPS)[string]['spots']>[number]) => (MAPS[map].spots ||= []).push(s);

sign('route1', 'r1sign', 52, 6, 'The Midden Road. Rib to the west. Turnstone to the east. Leave the middens as they are.');
piece('route1', 'driftpile', 11, 17, true);
piece('route1', 'spilled', 46, 4, false);
spot('route1', look(46, 4, 'A basket of reeds has tipped over. Small footprints lead away toward the pond.'));
spot('route1', stash('r1_corner', 54, 1, 'Hidden behind a post at the dunes\' end, a periwinkle horn.', { pegs: ['twig', 1] }));

sign('route2', 'r2sign', 52, 11, 'The Dry Sea. Walk where the boats used to. Mast to the west.');
piece('route2', 'crates', 38, 23, true);
spot('route2', look(37, 23, 'An empty crate marked with the stamp "MAST." The word "sorry" has been chalked onto its side.'));
posts('route2', 'netframe', 5, 23, 2);
spot('route2', stash('r2_corner', 54, 1, 'Nestled in the upper corner, half-buried, is a jar containing a cowrie shell.', { rind: 80 }));

sign('route3', 'r3sign', 21, 2, 'The salt marsh. Spire, north. Stay on the boardwalks.');
piece('route3', 'lantern', 19, 9, true); piece('route3', 'lantern', 28, 13, true);
spot('route3', stash('r3_corner', 41, 38, 'Tucked among the reeds in the corner is a block of marsh salt, still dry.', { items: [['saltcake', 1]] }));

sign('route4', 'r4sign', 21, 2, 'The understory. Bole, north. Roots block the road, so lift your feet high.');
spot('route4', look(14, 16, 'Two names are carved into the bark alongside a heart. A third name has been scratched out.'));
piece('route4', 'flowers', 22, 26, false); piece('route4', 'flowers', 23, 26, false);
spot('route4', stash('r4_corner', 39, 28, 'Someone\'s lunch tin rests beneath the roots. The food is long gone, but the coins remain.', { rind: 60 }));

sign('route5', 'r5sign', 21, 2, 'The machine fields. Do not disturb the machines. They are on duty.');
piece('route5', 'crates', 42, 13, true);
piece('route5', 'cartbroken', 13, 27, true);
spot('route5', look(15, 27, 'A note tied to the cart reads: "Back soon. Don\'t take the wheel." The wheel is missing.'));
spot('route5', stash('r5_corner', 46, 1, 'Behind the final machine lies a tin of spare parts, wrapped in oilcloth.', { rind: 100 }));

sign('route6', 'r6sign', 23, 2, 'The tundra. Tusk, north. The ledges are one-way only, much like the weather.');
spot('route6', look(30, 26, 'A red mitten lies in the snow, frozen mid-wave.'));
piece('route6', 'driftpile', 1, 29, true);
spot('route6', stash('r6_corner', 42, 30, 'Hidden beneath a snowdrift in the corner is a flask of smelling salts, sealed tight with a cork.', { notions: [['smellingsalt', 1]] }));

sign('route7', 'r7sign', 41, 1, 'The Hilt road. Hilt is east. Tusk is west. The Hermitage is there, if you insist.');
piece('route7', 'cartbroken', 6, 13, true);
spot('route7', look(8, 13, 'Pilgrims\' bags sit on a cart with a broken wheel. A sign reads: "Gone to Hilt for a wheel.'));
piece('route7', 'lantern', 39, 13, true);
spot('route7', stash('r7_corner', 46, 27, 'Polished to a shine, a guard\'s lost button lies under the rubble in the corner.', { rind: 50 }));

sign('route8', 'r8sign', 23, 1, 'The crater fields. Fall, south. Everything here rolls that way.');
piece('route8', 'spilled', 14, 24, false);
spot('route8', look(14, 24, 'A tipped-over basket, with a trail of apples rolling away toward Fall.'));
spot('route8', stash('r8_corner', 42, 30, 'In the far corner, a thumb-sized shard of star glass.', { items: [['starglass', 1]] }));
