// Every house door in the towns opens: small furnished rooms, each laid out differently, each with someone in it or something to find.
import '../game/furniture';
import { PROPS } from '../game/props';
import { defMap, MAPS, type MapDef, type NpcDef } from '../game/world';
import { look, stash } from './areakit';

type Spot = NonNullable<MapDef['spots']>[number];
/** A piece of furniture: a prop at a tile in the room. Rugs and things hung on the back wall do not block the way. */
type Piece = [pic: string, x: number, y: number];
const WALKED = (pic: string) => pic.startsWith('rug') || pic === 'window' || pic === 'netwall';

interface Home { id: string; name: string; town: string; door: [number, number]; w: number; h: number; dx: number; pieces: Piece[]; npcs?: NpcDef[]; spots?: Spot[] }

/** Builds a room from its size and furniture, and joins its door to the house's door in town. */
export function home(h: Home): void {
  const rows: string[][] = Array.from({ length: h.h }, (_, y) => Array.from({ length: h.w }, (_, x) => (y === 0 || y === h.h - 1 || x === 0 || x === h.w - 1 ? '#' : '_')));
  rows[h.h - 1][h.dx] = 'd';
  for (const [pic, x, y] of h.pieces) {
    const p = PROPS[pic];
    if (!p || WALKED(pic)) continue;
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) if (rows[y + j]?.[x + i] === '_') rows[y + j][x + i] = '|';
  }
  defMap({
    id: h.id, name: h.name, region: 11, indoor: true, music: 'home',
    rows: rows.map(r => r.join('')),
    warps: [{ x: h.dx, y: h.h - 1, to: h.town, tx: h.door[0], ty: h.door[1] + 1, dir: 0 }],
    props: h.pieces.map(([pic, x, y]) => ({ x, y, pic })),
    npcs: h.npcs || [],
    spots: h.spots || [],
  });
  MAPS[h.town].warps.push({ x: h.door[0], y: h.door[1], to: h.id, tx: h.dx, ty: h.h - 2, dir: 2 });
}

/** Someone at home, with a line or two. */
const who = (id: string, x: number, y: number, sprite: string, name: string, lines: string[], extra: Partial<NpcDef> = {}): NpcDef => ({ id, x, y, sprite, name, lines, dir: 0, ...extra });

// ---------------------------------------------------------------- Turnstone

home({ id: 'tsweaver', name: 'The weaver\'s', town: 'fellside', door: [28, 21], w: 10, h: 8, dx: 4,
  pieces: [['loom', 1, 1], ['shelf', 5, 1], ['cast', 8, 1], ['table', 2, 4], ['chair', 4, 4], ['bedRed', 8, 4], ['rugBlue', 4, 5], ['plant', 1, 6]],
  npcs: [who('tsweaver1', 6, 3, 'oldwoman', 'Weaver', ['I\'m weaving a coat for my cast. It stays in that corner all winter.', 'Must be cold. It never says.'], { idle: { every: 200, act: 'nod' } })],
});

home({ id: 'tsbaker', name: 'The bread house', town: 'fellside', door: [5, 27], w: 11, h: 7, dx: 5,
  pieces: [['stove', 1, 1], ['shelf', 3, 1], ['table', 6, 2], ['barrel', 9, 1], ['crate', 9, 2], ['chest', 1, 5]],
  npcs: [who('tsbaker1', 3, 3, 'villager', 'Baker', ['The bread is made from Midden Road wheat. The crust has a bit of shell mixed in.', 'Good for your teeth. Probably.'])],
  spots: [stash('ts_biscuit', 1, 5, 'Inside the chest, wrapped in cloth, are two sea biscuits someone saved.', { notions: [['seabiscuit', 2]] })],
});

home({ id: 'tscradle', name: 'The house with the cradle', town: 'fellside', door: [29, 27], w: 9, h: 8, dx: 4,
  pieces: [['window', 3, 0], ['cradle', 1, 1], ['bedBlue', 6, 1], ['bedGreen', 7, 1], ['table', 2, 4], ['stool', 4, 4], ['plant', 7, 5]],
  npcs: [who('tscradle1', 5, 3, 'villager2', 'Dad', ['The baby shed last week. The cast is smaller than a teacup.', 'We keep it in the cradle. The baby sleeps on the floor. Babies, huh.'])],
});

// ---------------------------------------------------------------- Rib

home({ id: 'ribcarvings', name: 'The carvings house', town: 'rib', door: [28, 11], w: 10, h: 8, dx: 6,
  pieces: [['workbench', 1, 1], ['shelf', 4, 1], ['shellcase', 7, 1], ['cast', 8, 1], ['table', 2, 4], ['chair', 4, 4], ['rugRed', 5, 5]],
  npcs: [who('ribcarv1', 7, 4, 'elder', 'Old man', ['The Rib hums at night. You get used to it.', 'Well, I didn\'t. I just got old.'])],
  spots: [look(4, 1, 'Eight tiny bone Seals sit on the shelf, each with a name scratched beneath it.')],
});

home({ id: 'ribtwins', name: 'The twins\' house', town: 'rib', door: [13, 24], w: 12, h: 7, dx: 2,
  pieces: [['bedRed', 1, 1], ['bedBlue', 10, 1], ['stool', 4, 2], ['table', 5, 2], ['stool', 7, 2], ['barrel', 10, 4]],
  npcs: [
    who('ribtwin1', 5, 4, 'child', 'Twin', ['We\'re shedding on the same day. We decided that.'], { pair: 'ribtwin2' }),
    who('ribtwin2', 7, 4, 'boy', 'Twin', ['She decided. I just said okay.'], { pair: 'ribtwin1' }),
  ],
});

home({ id: 'ribfire', name: 'The fireside house', town: 'rib', door: [33, 24], w: 8, h: 9, dx: 3,
  pieces: [['hearth', 1, 1], ['shelf', 5, 1], ['chair', 1, 3], ['rugGreen', 2, 4], ['bedGreen', 6, 4], ['plant', 1, 7]],
  npcs: [who('ribfire1', 4, 6, 'veryold', 'Old woman', ['Come sit by the fire if you like. It\'s for my cast, mostly.', 'The cold makes it stiff. Same as my joints. Same as me, really.'])],
});

// ---------------------------------------------------------------- Mast

home({ id: 'mastnets', name: 'The net-mender\'s', town: 'mast', door: [4, 17], w: 10, h: 7, dx: 7,
  pieces: [['netwall', 1, 0], ['barrel', 1, 1], ['barrel', 2, 1], ['crate', 1, 2], ['tub', 4, 1], ['table', 4, 3], ['stool', 6, 3], ['bedBlue', 8, 1]],
  npcs: [who('mastnets1', 3, 4, 'villager2', 'Net-mender', ['Mending nets for an ocean that\'s gone.', 'Keeps my hands busy. Ready for when it returns.'], { idle: { every: 180, act: 'bow' } })],
});

home({ id: 'mastshells', name: 'The shell-sorter\'s', town: 'mast', door: [38, 17], w: 9, h: 8, dx: 4,
  pieces: [['shellcase', 1, 1], ['shellcase', 2, 1], ['shellcase', 3, 1], ['shelf', 6, 1], ['table', 2, 4], ['chair', 4, 4], ['rugBlue', 5, 4]],
  npcs: [who('mastshell1', 6, 5, 'oldwoman', 'Shell-sorter', ['Every one of these shells came from the bottom of the Dry Sea.', 'I sort them by how mournful they seem. That pile is the most sorrowful.'])],
});

home({ id: 'mastbunks', name: 'The bunk house', town: 'mast', door: [4, 23], w: 11, h: 8, dx: 5,
  pieces: [['bedRed', 1, 1], ['bedBlue', 2, 1], ['bedGreen', 3, 1], ['window', 5, 0], ['table', 7, 2], ['chair', 9, 2], ['crate', 1, 5], ['crate', 2, 5], ['barrel', 9, 5]],
  npcs: [who('mastbunk1', 6, 4, 'beach1', 'Sailor', ['Three beds, no vessel. We take turns standing watch.', 'Nothing\'s happened. But we\'re watching closely.'])],
});

home({ id: 'mastkitchen', name: 'The stilt kitchen', town: 'mast', door: [38, 23], w: 9, h: 7, dx: 2,
  pieces: [['stove', 1, 1], ['shelf', 3, 1], ['tub', 5, 1], ['barrel', 7, 1], ['table', 4, 3], ['stool', 6, 3], ['plant', 7, 5], ['chest', 1, 4]],
  spots: [
    look(1, 1, 'A bubbling pot of seaweed stew that smells far better than it looks.'),
    stash('mk_glass', 1, 4, 'Inside the chest lies a jar of sea glass, sorted by color.', { items: [['beachglass', 3]] }),
  ],
});

// ---------------------------------------------------------------- Spire

home({ id: 'spirehush', name: 'The quiet house', town: 'spire', door: [35, 14], w: 10, h: 8, dx: 5,
  pieces: [['shelf', 1, 1], ['shelf', 3, 1], ['table', 6, 2], ['chair', 8, 2], ['rugRed', 2, 4], ['bedBlue', 8, 4], ['plant', 1, 6]],
  npcs: [who('spirehush1', 3, 3, 'villager', 'Woman', ['shh. Oh, sorry. Habit.', 'Quiet hours are the rule in the Spire.'])],
});

home({ id: 'spirebells', name: 'The bell-tuner\'s', town: 'spire', door: [6, 26], w: 12, h: 8, dx: 6,
  pieces: [['workbench', 1, 1], ['workbench', 4, 1], ['crate', 8, 1], ['barrel', 10, 1], ['table', 2, 4], ['stool', 4, 4], ['cast', 10, 5]],
  npcs: [who('spirebell1', 7, 4, 'tanner', 'Bell-tuner', ['I tune the Spire\'s bells by ear. My hearing isn\'t what it used to be.', 'They\'re all slightly off now. No one\'s complained.'])],
  spots: [look(8, 1, 'Cloth-wrapped bell clappers, preventing them from ringing accidentally.')],
});

// ---------------------------------------------------------------- Bole

home({ id: 'boleroots', name: 'The root house', town: 'bole', door: [4, 6], w: 9, h: 9, dx: 4,
  pieces: [['plant', 1, 1], ['plant', 2, 1], ['plant', 7, 1], ['table', 3, 3], ['stool', 5, 3], ['bedGreen', 7, 4], ['rugGreen', 1, 5], ['barrel', 1, 7]],
  npcs: [who('boleroot1', 5, 6, 'grafter', 'Grafter', ['Roots push through the floor every spring.', 'We just shift the table. It\'s moved around quite a bit.'])],
});

home({ id: 'bolerain', name: 'The bucket house', town: 'bole', door: [4, 21], w: 10, h: 7, dx: 3,
  pieces: [['tub', 1, 1], ['tub', 2, 1], ['tub', 3, 1], ['shelf', 6, 1], ['table', 6, 3], ['chair', 8, 3]],
  npcs: [who('bolerain1', 2, 4, 'oldwoman', 'Old woman', ['I set out buckets to catch the rain that falls upward, then I cover them with a lid.', 'Eventually, I misplace the lid, and the rain escapes.'])],
});

home({ id: 'bolespoons', name: 'The spoon-carver\'s', town: 'bole', door: [38, 21], w: 11, h: 8, dx: 8,
  pieces: [['workbench', 1, 1], ['workbench', 4, 1], ['crate', 8, 1], ['crate', 9, 1], ['table', 4, 4], ['stool', 6, 4], ['cast', 1, 5]],
  npcs: [who('bolespoon1', 3, 6, 'villager2', 'Spoon-carver', ['I whittle spoons from the bark the Bole drops.', 'They have a faint woody flavor, but people don\'t mind.'], { idle: { every: 150, act: 'bow' } })],
});

home({ id: 'bolenote', name: 'The empty house', town: 'bole', door: [15, 27], w: 8, h: 7, dx: 3,
  pieces: [['window', 2, 0], ['bedRed', 1, 1], ['table', 3, 2], ['chair', 5, 2], ['plant', 6, 1]],
  spots: [look(1, 1, 'A note left on the pillow: "Off to see the Bole. I\'ll be back before dark. Do not eat the jam.')],
});

home({ id: 'bolesnail', name: 'The crate house', town: 'bole', door: [27, 27], w: 10, h: 8, dx: 5,
  pieces: [['crates', 1, 1], ['crate', 3, 1], ['plant', 8, 1], ['table', 4, 3], ['chair', 6, 3], ['shellcase', 8, 4]],
  npcs: [who('bolesnail1', 2, 5, 'child', 'Child', ['I\'m cultivating a Whorl in a crate. It\'s just a snail at the moment.', 'Snails develop shells, which turn them into Whorls. I have all the patience in the world.'], { idle: { every: 160, act: 'hop' } })],
});

// ---------------------------------------------------------------- Hum

home({ id: 'humparts', name: 'The parts shop', town: 'hum', door: [5, 23], w: 11, h: 8, dx: 2,
  pieces: [['workbench', 1, 1], ['workbench', 3, 1], ['workbench', 5, 1], ['crate', 8, 1], ['barrel', 9, 1], ['table', 5, 4], ['stool', 7, 4]],
  npcs: [who('humparts1', 3, 5, 'hummer', 'Tinker', ['Rider parts. Every one still ticks.', 'I count those ticks so they know someone is listening.'])],
});

home({ id: 'humhome', name: 'The blue window house', town: 'hum', door: [33, 23], w: 9, h: 8, dx: 6,
  pieces: [['stove', 1, 1], ['shelf', 3, 1], ['bedBlue', 7, 1], ['table', 2, 4], ['chair', 4, 4], ['rugBlue', 2, 6]],
  npcs: [who('humhome1', 5, 6, 'villager', 'Woman', ['The Pylon glows through the wall at night, shifting from bright blue to a dimmer hue.', 'It\'s decent for sleeping, in a way.'])],
});

home({ id: 'humhelmet', name: 'The Rider\'s house', town: 'hum', door: [14, 28], w: 10, h: 7, dx: 4,
  pieces: [['window', 5, 0], ['bedRed', 1, 1], ['bedGreen', 8, 1], ['table', 3, 2], ['stool', 5, 2], ['chest', 8, 4]],
  spots: [
    look(3, 2, 'An upside-down Rider\'s helmet serving as a fruit bowl, containing fruit that also appears metallic.'),
    stash('hm_tin', 8, 4, 'Inside the chest lies a Rider\'s tin, its seal still intact.', { items: [['ridertin', 1]] }),
  ],
});

// ---------------------------------------------------------------- Tusk

home({ id: 'tuskfire', name: 'The warm house', town: 'tusk', door: [5, 34], w: 10, h: 8, dx: 4,
  pieces: [['hearth', 1, 1], ['shelf', 5, 1], ['bedRed', 8, 1], ['table', 3, 4], ['chair', 5, 4], ['rugRed', 5, 5]],
  npcs: [who('tuskfire1', 2, 6, 'elder', 'Old man', ['When the Tusk is in winter, you must keep the fire lit and the casts out.', 'The casts don\'t fear the cold. They fear the fire.'])],
});

home({ id: 'tuskcombs', name: 'The comb-carver\'s', town: 'tusk', door: [30, 34], w: 12, h: 7, dx: 7,
  pieces: [['workbench', 1, 1], ['workbench', 3, 1], ['shellcase', 6, 1], ['shellcase', 7, 1], ['cast', 10, 1], ['table', 2, 4], ['stool', 4, 4]],
  npcs: [who('tuskcomb1', 9, 4, 'keeper', 'Carver', ['I turn the Tusk\'s chips into combs.', 'The Tusk doesn\'t care. Or maybe it\'s just being courteous.'])],
});

// ---------------------------------------------------------------- Hilt

home({ id: 'hiltbunks', name: 'The guards\' bunks', town: 'hilt', door: [4, 20], w: 11, h: 8, dx: 5,
  pieces: [['bedBlue', 1, 1], ['bedBlue', 2, 1], ['bedRed', 3, 1], ['table', 6, 2], ['stool', 8, 2], ['barrel', 9, 5], ['crate', 9, 6]],
  npcs: [who('hiltbunk1', 6, 5, 'keeper', 'Guard', ['I\'m off the clock, yet I still guard the sword in my dreams.', 'The sword is perfectly still. So am I. We\'re both quite good at staying put.'])],
});

home({ id: 'hiltwife', name: 'The guard\'s house', town: 'hilt', door: [19, 20], w: 9, h: 8, dx: 4,
  pieces: [['stove', 1, 1], ['shelf', 3, 1], ['table', 5, 2], ['chair', 7, 2], ['rugGreen', 4, 4], ['plant', 1, 5]],
  npcs: [who('hiltwife1', 2, 4, 'oldwoman', 'Old woman', ['My husband stood watch over that blade for forty years and never once saw it.', 'He finally got a look this week. He said it was fine, though a bit plain.'])],
});

home({ id: 'hiltbuttons', name: 'The button-polisher\'s', town: 'hilt', door: [18, 26], w: 10, h: 7, dx: 3,
  pieces: [['workbench', 1, 1], ['crate', 4, 1], ['barrel', 5, 1], ['table', 6, 3], ['stool', 8, 3]],
  npcs: [who('hiltbutton1', 2, 4, 'villager2', 'Polisher', ['I buff the guards\' buttons. There are plenty of guards.', 'And plenty of buttons. I\'ve never been bored, but I\'ve come close.'], { idle: { every: 140, act: 'nod' } })],
});

// ---------------------------------------------------------------- Fall

home({ id: 'falleast', name: 'The leaning house', town: 'fall', door: [10, 22], w: 10, h: 8, dx: 4,
  pieces: [['barrel', 8, 1], ['barrel', 8, 2], ['crate', 8, 3], ['chair', 7, 3], ['table', 6, 5], ['plant', 8, 5]],
  npcs: [who('falleast1', 2, 4, 'starwalker', 'Man', ['Everything in this place drifts east, chairs and all.', 'I just take a seat wherever the chair happens to stop.'])],
});

home({ id: 'fallcount', name: 'The star-counter\'s', town: 'fall', door: [29, 23], w: 11, h: 7, dx: 5,
  pieces: [['window', 2, 0], ['window', 8, 0], ['table', 1, 2], ['chair', 3, 2], ['shelf', 5, 1], ['bedBlue', 9, 1]],
  npcs: [who('fallcount1', 6, 4, 'villager', 'Star-counter', ['I tally the stars that fall. Two thousand and six have landed this year.', 'I might have double-counted a few. They all look the same.'])],
});

// ---------------------------------------------------------------- the Brook Wood

home({ id: 'brookhut', name: 'The woodcutter\'s hut', town: 'brookwood', door: [10, 3], w: 9, h: 7, dx: 4,
  pieces: [['stove', 1, 1], ['bedGreen', 7, 1], ['table', 3, 3], ['stool', 5, 3], ['crate', 1, 4], ['plant', 7, 4]],
  npcs: [who('brookhut1', 3, 5, 'villager2', 'Woodcutter', ['The brook chatters all night long, and I chatter back.', 'One of us is learning something. I\'m not sure which one.'])],
});

/** Every room this file adds, for the validator's strict checks. */
export const HOMES = ['tsweaver', 'tsbaker', 'tscradle', 'ribcarvings', 'ribtwins', 'ribfire', 'mastnets', 'mastshells', 'mastbunks', 'mastkitchen',
  'spirehush', 'spirebells', 'boleroots', 'bolerain', 'bolespoons', 'bolenote', 'bolesnail', 'humparts', 'humhome', 'humhelmet', 'tuskfire',
  'tuskcombs', 'hiltbunks', 'hiltwife', 'hiltbuttons', 'falleast', 'fallcount', 'brookhut'];
