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

chase('fellside', 'tschase', 29, 4, 'hare', 'Hare', 'child', ['It\'s not mine! I just like chasing it.', 'It always wins. I always nearly win.']);
pairUp('fellside', 'tsbench', 13, 23,
  ['villager', 'Woman', ['We\'re talking about the craze. Again.', 'Don\'t tell her I said "again".']],
  ['elder', 'Old man', ['Back in my day the ground stayed shut.', 'Well. Mostly. There was the one time.']]);
// The carter's cart has a wheel off until Ouro has been out on the roads a while. Then it rolls again.
piece('fellside', 'cartbroken', 5, 12, true, () => chapter() < 3);
piece('fellside', 'cart', 5, 12, false, () => chapter() >= 3);
{
  const carter = MAPS.fellside.npcs.find(n => n.id === 'carter');
  if (carter) carter.idle = { every: 160, act: 'bow' };
}
posts('fellside', 'washline', 30, 24, 3);
add('fellside', { id: 'tswasher', x: 29, y: 24, sprite: 'oldwoman', name: 'Woman', dir: 1, idle: { every: 170, act: 'lift' },
  lines: ['Washing dries fast after a Turning Day. Something about the air.', 'Or I just did less washing. Could be that.'] });
napper('fellside', 'tsnapper', 10, 23, 'puffball', 'Puffball');
piece('fellside', 'broom', 8, 22, false);
add('fellside', { id: 'tssweeper', x: 6, y: 23, sprite: 'villager2', name: 'Sweeper', route: '.rr.ll', pace: 14, idle: { every: 90, act: 'bow' }, movable: true,
  lines: ['Sweeping shell bits off the step. They come back.', 'Everybody\'s shedding something this year.'] });
piece('fellside', 'flowers', 2, 24, false); piece('fellside', 'flowers', 3, 24, false);
piece('fellside', 'lantern', 12, 9, true);
piece('fellside', 'spilled', 26, 30, false);
(MAPS.fellside.spots ||= []).push(look(26, 30, 'A basket on its side and cockles everywhere. Small footprints run off toward the cove.'));

// ---------------------------------------------------------------- Rib

chase('rib', 'ribchase', 31, 17, 'paring', 'Paring', 'boy', ['Paring! Slow down! ...Please?', 'It goes round the same way every time. I could just wait.']);
pairUp('rib', 'ribbench', 8, 18,
  ['villager2', 'Man', ['The Rib hummed all last night.', 'She says it was me snoring. It was the Rib.']],
  ['villager', 'Woman', ['It was him snoring.', 'The Rib doesn\'t snore. It hums. Totally different.']]);
// The wheel is back on once Ouro has the Rib pearl, and the man has time to talk about something else.
piece('rib', 'cartbroken', 36, 26, true, () => chapter() < 2);
piece('rib', 'cart', 36, 26, false, () => chapter() >= 2);
add('rib', { id: 'ribfixer', x: 38, y: 26, sprite: 'tanner', name: 'Man', dir: 3, idle: { every: 140, act: 'bow' },
  lines: () => chapter() < 2 ? ['Wheel came off on a rib bone. Rib bones everywhere here.', 'You\'d think we\'d learn. We don\'t.']
    : ['Wheel\'s back on. Took a week and most of my patience.', 'Now I just polish it. Feels earned.'] });
posts('rib', 'washline', 16, 5, 3);
add('rib', { id: 'ribwasher', x: 15, y: 5, sprite: 'oldwoman', name: 'Woman', dir: 1, idle: { every: 160, act: 'lift' },
  lines: ['Hang it by the Rib and it dries warm. The Rib\'s always a bit warm.'] });
napper('rib', 'ribnapper', 13, 5, 'cairn', 'Cairn');
piece('rib', 'lantern', 19, 14, true); piece('rib', 'lantern', 24, 14, true);
piece('rib', 'flowers', 30, 5, false); piece('rib', 'flowers', 31, 5, false);

// ---------------------------------------------------------------- Mast

posts('mast', 'netframe', 10, 13, 2);
add('mast', { id: 'mastmender', x: 12, y: 13, sprite: 'villager2', name: 'Net-mender', dir: 3, idle: { every: 150, act: 'bow' },
  lines: ['Mending a net for a sea that isn\'t here.', 'When it comes back, I\'m ready. Are you ready? You look ready.'] });
piece('mast', 'rodline', 23, 27, false);
add('mast', { id: 'mastfisher', x: 22, y: 27, sprite: 'beach2', name: 'Fisher', dir: 1, idle: { every: 200, act: 'nod' },
  lines: ['Fishing in the Dry Sea. Nothing\'s bitten.', 'Nothing\'s going to. That\'s not really the point.'] });
chase('mast', 'mastchase', 11, 27, 'fiddler', 'Fiddler', 'child', ['It runs sideways! You can\'t chase sideways!', 'I\'m trying, though.']);
pairUp('mast', 'mastpair', 30, 13,
  ['beach1', 'Sailor', ['Ship\'s not coming. There\'s no sea.', 'We wait anyway. It\'s what sailors do.']],
  ['beach3', 'Sailor', ['I heard the sea\'s coming back.', 'Heard it from him. He heard it from me.']], false);
piece('mast', 'crates', 24, 9, true); piece('mast', 'barrel', 26, 9, true);
napper('mast', 'mastnapper', 12, 9, 'scree', 'Scree');

// ---------------------------------------------------------------- Spire

piece('spire', 'broom', 16, 15, false);
add('spire', { id: 'spiresweep', x: 17, y: 16, sprite: 'ringer', name: 'Sweeper', route: '.rrr.lll', pace: 16, idle: { every: 80, act: 'bow' }, movable: true,
  lines: ['shh. Sweeping the church steps.', 'Quietly. The broom\'s new. It squeaks.'] });
pairUp('spire', 'spirebench', 30, 20,
  ['villager', 'Woman', ['did you hear about the bells', 'they\'re all a bit wrong now']],
  ['elder', 'Old man', ['i heard', 'i liked them better wrong, honestly']]);
chase('spire', 'spirechase', 5, 19, 'mycel', 'Mycel', 'child', ['come back. come back please.', 'i\'m not allowed to shout here. it knows that.']);
piece('spire', 'lantern', 16, 17, true); piece('spire', 'lantern', 24, 17, true);
napper('spire', 'spirenapper', 11, 27, 'peat', 'Peat');

// ---------------------------------------------------------------- Bole

piece('bole', 'broom', 13, 15, false);
add('bole', { id: 'bolesweep', x: 14, y: 15, sprite: 'grafter', name: 'Sweeper', route: '.rr.ll', pace: 14, idle: { every: 90, act: 'bow' }, movable: true,
  lines: ['Bark falls off the Bole all day. Somebody sweeps it.', 'Somebody\'s me. I don\'t mind. It smells nice.'] });
pairUp('bole', 'bolebench', 28, 18,
  ['villager2', 'Man', ['Rain went up again this morning.', 'Took my hat with it.']],
  ['villager', 'Woman', ['It was a bad hat.', 'The rain did you a favor.']]);
chase('bole', 'bolechase', 37, 9, 'dandle', 'Dandle', 'boy', ['It floats when I get close! That\'s cheating!', 'Okay one more lap.']);
piece('bole', 'cartbroken', 12, 23, true);
add('bole', { id: 'bolefixer', x: 14, y: 23, sprite: 'villager2', name: 'Man', dir: 3, idle: { every: 150, act: 'bow' },
  lines: ['A root came up under the cart overnight.', 'Roots do that here. You learn to park on stone.'] });
posts('bole', 'washline', 36, 13, 3);
napper('bole', 'bolenapper', 11, 7, 'burr', 'Burr');

// ---------------------------------------------------------------- Hum

piece('hum', 'cartbroken', 31, 16, true);
add('hum', { id: 'humfixer', x: 33, y: 16, sprite: 'hummer', name: 'Tinker', dir: 3, idle: { every: 130, act: 'bow' },
  lines: ['Putting a Rider cog in a cart wheel.', 'Now it ticks when it rolls. Improvement, I\'d say.'] });
pairUp('hum', 'humbench', 7, 20,
  ['villager', 'Woman', ['The Pylon hums a note. I hum along.', 'He says I\'m flat.']],
  ['villager2', 'Man', ['She\'s flat.', 'The Pylon\'s also flat, to be fair.']]);
chase('hum', 'humchase', 33, 24, 'piston', 'Piston', 'child', ['It goes up and down and up and down!', 'I\'m dizzy. Is it dizzy?']);
piece('hum', 'rodline', 11, 5, false);
add('hum', { id: 'humfisher', x: 10, y: 6, sprite: 'beach4', name: 'Fisher', dir: 1, idle: { every: 220, act: 'nod' },
  lines: ['Fish in the Lipwater taste like batteries.', 'Good batteries, though.'] });
piece('hum', 'lantern', 21, 15, true); piece('hum', 'lantern', 23, 15, true);
napper('hum', 'humnapper', 11, 24, 'turbine', 'Turbine');

// ---------------------------------------------------------------- Tusk

chase('tusk', 'tuskchase', 25, 27, 'auk', 'Auk', 'boy', ['The auk slides better than me.', 'I\'m learning. On my face, mostly.']);
piece('tusk', 'stove', 13, 28, true);
add('tusk',
  { id: 'tuskwarm1', x: 12, y: 28, sprite: 'elder', name: 'Old man', dir: 1, pair: 'tuskwarm2', lines: ['Warm your hands. Brazier\'s for everyone.', 'Tusk rule. Older than the Tusk, maybe.'] },
  { id: 'tuskwarm2', x: 14, y: 28, sprite: 'oldwoman', name: 'Old woman', dir: 3, pair: 'tuskwarm1', lines: ['He made that rule up last year.', 'It\'s a good rule, though.'] });
piece('tusk', 'broom', 21, 31, false);
add('tusk', { id: 'tuskshovel', x: 22, y: 31, sprite: 'villager2', name: 'Shoveler', route: '.rrrr.llll', pace: 16, idle: { every: 80, act: 'bow' }, movable: true,
  lines: ['Snow off the street. More snow on the street.', 'It\'s a job for life.'] });
posts('tusk', 'washline', 2, 28, 3);
napper('tusk', 'tusknapper', 10, 35, 'floe', 'Floe');

// ---------------------------------------------------------------- Hilt

add('hilt', { id: 'hiltpatrol', x: 14, y: 13, sprite: 'keeper', name: 'Guard', route: 'rrrrrrrrrr.llllllllll.', pace: 12, movable: true,
  lines: ['Patrolling. From here to there. Then back.', 'Very important. Nobody\'s said why.'] });
pairUp('hilt', 'hiltbench', 6, 22,
  ['keeper', 'Guard', ['Off shift. Still on guard, sort of.', 'You never really stop.']],
  ['villager', 'Woman', ['He never really stops.', 'He guards the soup. He guards the cat.']]);
chase('hilt', 'hiltchase', 33, 22, 'tang', 'Tang', 'child', ['It\'s a blade-stone with legs!', 'It\'s not sharp. I checked. With my hand.']);
piece('hilt', 'cartbroken', 2, 13, true);
add('hilt', { id: 'hiltfixer', x: 4, y: 13, sprite: 'tanner', name: 'Smith\'s boy', dir: 3, idle: { every: 140, act: 'bow' },
  lines: ['Fixing the smith\'s cart. Smith said it\'d build character.', 'I\'ve got loads of character now.'] });
napper('hilt', 'hiltnapper', 3, 27, 'buckler', 'Buckler');
piece('hilt', 'lantern', 11, 6, true); piece('hilt', 'lantern', 13, 6, true);

// ---------------------------------------------------------------- Fall

chase('fall', 'fallchase', 28, 10, 'tor', 'Tor', 'boy', ['It rolls downhill then walks back up!', 'Then rolls again. It loves it. I love it.']);
pairUp('fall', 'fallbench', 31, 18,
  ['starwalker', 'Woman', ['A star landed in my garden last night.', 'Lovely. Ate my cabbages.']],
  ['villager2', 'Man', ['Stars don\'t eat cabbages.', 'It was something. The cabbages are gone.']]);
add('fall', { id: 'fallsweep', x: 24, y: 20, sprite: 'villager2', name: 'Sweeper', route: '.rrr.lll', pace: 14, idle: { every: 90, act: 'bow' }, movable: true,
  lines: ['Sweeping up star glitter. It sweeps itself downhill.', 'I just walk behind it, really.'] });
piece('fall', 'broom', 23, 20, false);
piece('fall', 'spilled', 24, 24, false);
napper('fall', 'fallnapper', 35, 6, 'coma', 'Coma');

// ---------------------------------------------------------------- the roads: signs, things left behind, and a find in a far corner

const sign = (map: string, id: string, x: number, y: number, line: string) => add(map, { id, x, y, sprite: 'sign', name: null as any, lines: [line] });
const spot = (map: string, s: NonNullable<(typeof MAPS)[string]['spots']>[number]) => (MAPS[map].spots ||= []).push(s);

sign('route1', 'r1sign', 52, 6, 'The Midden Road. Rib, west. Turnstone, east. Leave the middens where they are.');
piece('route1', 'driftpile', 11, 17, true);
piece('route1', 'spilled', 46, 4, false);
spot('route1', look(46, 4, 'A basket of reeds tipped over. Small feet ran off toward the pond.'));
spot('route1', stash('r1_corner', 54, 1, 'Wedged behind a post at the end of the dunes, a periwinkle horn.', { pegs: ['twig', 1] }));

sign('route2', 'r2sign', 52, 11, 'The Dry Sea. Walk where the boats used to. Mast, west.');
piece('route2', 'crates', 38, 23, true);
spot('route2', look(37, 23, 'A crate stamped MAST, empty. Someone chalked "sorry" on the side.'));
posts('route2', 'netframe', 5, 23, 2);
spot('route2', stash('r2_corner', 54, 1, 'Half buried in the top corner, a jar with a cowrie in it.', { rind: 80 }));

sign('route3', 'r3sign', 21, 2, 'The salt marsh. Spire, north. Keep to the boards.');
piece('route3', 'lantern', 19, 9, true); piece('route3', 'lantern', 28, 13, true);
spot('route3', stash('r3_corner', 41, 38, 'In the reeds at the corner, a cake of marsh salt, still dry.', { items: [['saltcake', 1]] }));

sign('route4', 'r4sign', 21, 2, 'The understory. Bole, north. Roots in the road, so step high.');
spot('route4', look(14, 16, 'Two names carved in the bark with a heart, and a third name scratched out.'));
piece('route4', 'flowers', 22, 26, false); piece('route4', 'flowers', 23, 26, false);
spot('route4', stash('r4_corner', 39, 28, 'Under the roots, somebody\'s lunch tin. The lunch is long gone. The coins are not.', { rind: 60 }));

sign('route5', 'r5sign', 21, 2, 'The machine fields. Do not wake the machines. They are on shift.');
piece('route5', 'crates', 42, 13, true);
piece('route5', 'cartbroken', 13, 27, true);
spot('route5', look(15, 27, 'A note tied to the cart: "Back soon. Don\'t take the wheel." The wheel is gone.'));
spot('route5', stash('r5_corner', 46, 1, 'Behind the last machine, a tin of spare parts wrapped in oilcloth.', { rind: 100 }));

sign('route6', 'r6sign', 23, 2, 'The tundra. Tusk, north. The ledges only go one way, like the weather.');
spot('route6', look(30, 26, 'A red mitten on the snow, frozen in the middle of a wave.'));
piece('route6', 'driftpile', 1, 29, true);
spot('route6', stash('r6_corner', 42, 30, 'Under a drift in the corner, a flask of smelling salt, corked tight.', { notions: [['smellingsalt', 1]] }));

sign('route7', 'r7sign', 41, 1, 'The Hilt road. Hilt, east. Tusk, west. The Hermitage, if you must.');
piece('route7', 'cartbroken', 6, 13, true);
spot('route7', look(8, 13, 'Pilgrims\' bags on a cart with a snapped wheel. A sign: "Gone to Hilt for a wheel."'));
piece('route7', 'lantern', 39, 13, true);
spot('route7', stash('r7_corner', 46, 27, 'Under the rubble in the corner, a guard\'s lost button, polished bright.', { rind: 50 }));

sign('route8', 'r8sign', 23, 1, 'The crater fields. Fall, south. Everything here rolls that way.');
piece('route8', 'spilled', 14, 24, false);
spot('route8', look(14, 24, 'A basket on its side, and a trail of apples rolling off toward Fall.'));
spot('route8', stash('r8_corner', 42, 30, 'In the far corner, a sliver of star glass the size of a thumb.', { items: [['starglass', 1]] }));
