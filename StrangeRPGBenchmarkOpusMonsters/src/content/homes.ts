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
  npcs: [who('tsweaver1', 6, 3, 'oldwoman', 'Weaver', ['Weaving a coat for my cast. It stands in that corner all winter.', 'Cold, I bet. It never says.'], { idle: { every: 200, act: 'nod' } })],
});

home({ id: 'tsbaker', name: 'The bread house', town: 'fellside', door: [5, 27], w: 11, h: 7, dx: 5,
  pieces: [['stove', 1, 1], ['shelf', 3, 1], ['table', 6, 2], ['barrel', 9, 1], ['crate', 9, 2], ['chest', 1, 5]],
  npcs: [who('tsbaker1', 3, 3, 'villager', 'Baker', ['Bread\'s Midden Road wheat. Crust\'s got a bit of shell in it.', 'Good for your teeth. Probably.'])],
  spots: [stash('ts_biscuit', 1, 5, 'In the chest, under a cloth, two sea biscuits somebody saved.', { notions: [['seabiscuit', 2]] })],
});

home({ id: 'tscradle', name: 'The house with the cradle', town: 'fellside', door: [29, 27], w: 9, h: 8, dx: 4,
  pieces: [['window', 3, 0], ['cradle', 1, 1], ['bedBlue', 6, 1], ['bedGreen', 7, 1], ['table', 2, 4], ['stool', 4, 4], ['plant', 7, 5]],
  npcs: [who('tscradle1', 5, 3, 'villager2', 'Dad', ['Baby turned last week. Cast\'s smaller than a teacup.', 'We keep it in the cradle. Baby sleeps on the floor. Babies, huh.'])],
});

// ---------------------------------------------------------------- Rib

home({ id: 'ribcarvings', name: 'The carvings house', town: 'rib', door: [28, 11], w: 10, h: 8, dx: 6,
  pieces: [['workbench', 1, 1], ['shelf', 4, 1], ['shellcase', 7, 1], ['cast', 8, 1], ['table', 2, 4], ['chair', 4, 4], ['rugRed', 5, 5]],
  npcs: [who('ribcarv1', 7, 4, 'elder', 'Old man', ['The Rib hums at night. You get used to it.', 'Well. I didn\'t. I just got old.'])],
  spots: [look(4, 1, 'Eight little bone Stays on the shelf, each with a name scratched under it.')],
});

home({ id: 'ribtwins', name: 'The twins\' house', town: 'rib', door: [13, 24], w: 12, h: 7, dx: 2,
  pieces: [['bedRed', 1, 1], ['bedBlue', 10, 1], ['stool', 4, 2], ['table', 5, 2], ['stool', 7, 2], ['barrel', 10, 4]],
  npcs: [
    who('ribtwin1', 5, 4, 'child', 'Twin', ['We\'re turning on the same day. We decided.'], { pair: 'ribtwin2' }),
    who('ribtwin2', 7, 4, 'boy', 'Twin', ['She decided. I just said okay.'], { pair: 'ribtwin1' }),
  ],
});

home({ id: 'ribfire', name: 'The fireside house', town: 'rib', door: [33, 24], w: 8, h: 9, dx: 3,
  pieces: [['hearth', 1, 1], ['shelf', 5, 1], ['chair', 1, 3], ['rugGreen', 2, 4], ['bedGreen', 6, 4], ['plant', 1, 7]],
  npcs: [who('ribfire1', 4, 6, 'veryold', 'Old woman', ['Sit by the fire if you like. It\'s for my cast, mostly.', 'Gets stiff in the cold. Like me. Like me exactly.'])],
});

// ---------------------------------------------------------------- Mast

home({ id: 'mastnets', name: 'The net-mender\'s', town: 'mast', door: [4, 17], w: 10, h: 7, dx: 7,
  pieces: [['netwall', 1, 0], ['barrel', 1, 1], ['barrel', 2, 1], ['crate', 1, 2], ['tub', 4, 1], ['table', 4, 3], ['stool', 6, 3], ['bedBlue', 8, 1]],
  npcs: [who('mastnets1', 3, 4, 'villager2', 'Net-mender', ['Mending nets for a sea that isn\'t there.', 'Good practice. For when it is.'], { idle: { every: 180, act: 'bow' } })],
});

home({ id: 'mastshells', name: 'The shell-sorter\'s', town: 'mast', door: [38, 17], w: 9, h: 8, dx: 4,
  pieces: [['shellcase', 1, 1], ['shellcase', 2, 1], ['shellcase', 3, 1], ['shelf', 6, 1], ['table', 2, 4], ['chair', 4, 4], ['rugBlue', 5, 4]],
  npcs: [who('mastshell1', 6, 5, 'oldwoman', 'Shell-sorter', ['Every shell here came off the Dry Sea floor.', 'I sort them by how sad they look. That row\'s the saddest.'])],
});

home({ id: 'mastbunks', name: 'The bunk house', town: 'mast', door: [4, 23], w: 11, h: 8, dx: 5,
  pieces: [['bedRed', 1, 1], ['bedBlue', 2, 1], ['bedGreen', 3, 1], ['window', 5, 0], ['table', 7, 2], ['chair', 9, 2], ['crate', 1, 5], ['crate', 2, 5], ['barrel', 9, 5]],
  npcs: [who('mastbunk1', 6, 4, 'beach1', 'Sailor', ['Three beds and no ship. We take turns being the watch.', 'Nothing\'s happened yet. Very well watched, though.'])],
});

home({ id: 'mastkitchen', name: 'The stilt kitchen', town: 'mast', door: [38, 23], w: 9, h: 7, dx: 2,
  pieces: [['stove', 1, 1], ['shelf', 3, 1], ['tub', 5, 1], ['barrel', 7, 1], ['table', 4, 3], ['stool', 6, 3], ['plant', 7, 5], ['chest', 1, 4]],
  spots: [
    look(1, 1, 'A pot of something with seaweed in it, bubbling. It smells better than it looks.'),
    stash('mk_glass', 1, 4, 'In the chest, a jar of sea glass sorted by color.', { items: [['beachglass', 3]] }),
  ],
});

// ---------------------------------------------------------------- Spire

home({ id: 'spirehush', name: 'The quiet house', town: 'spire', door: [35, 14], w: 10, h: 8, dx: 5,
  pieces: [['shelf', 1, 1], ['shelf', 3, 1], ['table', 6, 2], ['chair', 8, 2], ['rugRed', 2, 4], ['bedBlue', 8, 4], ['plant', 1, 6]],
  npcs: [who('spirehush1', 3, 3, 'villager', 'Woman', ['shh. Oh, sorry. Habit.', 'Spire\'s quiet hours are most of the hours.'])],
});

home({ id: 'spirebells', name: 'The bell-tuner\'s', town: 'spire', door: [6, 26], w: 12, h: 8, dx: 6,
  pieces: [['workbench', 1, 1], ['workbench', 4, 1], ['crate', 8, 1], ['barrel', 10, 1], ['table', 2, 4], ['stool', 4, 4], ['cast', 10, 5]],
  npcs: [who('spirebell1', 7, 4, 'tanner', 'Bell-tuner', ['I tune Spire\'s bells by ear. My ears are bad.', 'They\'re all a bit wrong now. Nobody\'s said anything.'])],
  spots: [look(8, 1, 'Bell clappers wrapped in cloth, so they can\'t ring by accident.')],
});

// ---------------------------------------------------------------- Bole

home({ id: 'boleroots', name: 'The root house', town: 'bole', door: [4, 6], w: 9, h: 9, dx: 4,
  pieces: [['plant', 1, 1], ['plant', 2, 1], ['plant', 7, 1], ['table', 3, 3], ['stool', 5, 3], ['bedGreen', 7, 4], ['rugGreen', 1, 5], ['barrel', 1, 7]],
  npcs: [who('boleroot1', 5, 6, 'grafter', 'Grafter', ['Roots come up through the floor every spring.', 'We just move the table. Table\'s been all over.'])],
});

home({ id: 'bolerain', name: 'The bucket house', town: 'bole', door: [4, 21], w: 10, h: 7, dx: 3,
  pieces: [['tub', 1, 1], ['tub', 2, 1], ['tub', 3, 1], ['shelf', 6, 1], ['table', 6, 3], ['chair', 8, 3]],
  npcs: [who('bolerain1', 2, 4, 'oldwoman', 'Old woman', ['Buckets catch the rain that falls up. Then I put a lid on.', 'Then I lose the lid. Then the rain goes.'])],
});

home({ id: 'bolespoons', name: 'The spoon-carver\'s', town: 'bole', door: [38, 21], w: 11, h: 8, dx: 8,
  pieces: [['workbench', 1, 1], ['workbench', 4, 1], ['crate', 8, 1], ['crate', 9, 1], ['table', 4, 4], ['stool', 6, 4], ['cast', 1, 5]],
  npcs: [who('bolespoon1', 3, 6, 'villager2', 'Spoon-carver', ['I carve spoons out of the bark the Bole drops.', 'They taste a bit like tree. People are fine with it.'], { idle: { every: 150, act: 'bow' } })],
});

home({ id: 'bolenote', name: 'The empty house', town: 'bole', door: [15, 27], w: 8, h: 7, dx: 3,
  pieces: [['window', 2, 0], ['bedRed', 1, 1], ['table', 3, 2], ['chair', 5, 2], ['plant', 6, 1]],
  spots: [look(1, 1, 'A note on the pillow: "Gone to watch the Bole. Back by dark. Don\'t eat the jam."')],
});

home({ id: 'bolesnail', name: 'The crate house', town: 'bole', door: [27, 27], w: 10, h: 8, dx: 5,
  pieces: [['crates', 1, 1], ['crate', 3, 1], ['plant', 8, 1], ['table', 4, 3], ['chair', 6, 3], ['shellcase', 8, 4]],
  npcs: [who('bolesnail1', 2, 5, 'child', 'Child', ['I\'m raising a whorl in a crate. It\'s a snail right now.', 'Snails grow shells. Then it\'s a whorl. I\'m very patient.'], { idle: { every: 160, act: 'hop' } })],
});

// ---------------------------------------------------------------- Hum

home({ id: 'humparts', name: 'The parts shop', town: 'hum', door: [5, 23], w: 11, h: 8, dx: 2,
  pieces: [['workbench', 1, 1], ['workbench', 3, 1], ['workbench', 5, 1], ['crate', 8, 1], ['barrel', 9, 1], ['table', 5, 4], ['stool', 7, 4]],
  npcs: [who('humparts1', 3, 5, 'hummer', 'Tinker', ['Rider parts. Every one still ticks.', 'I count the ticks, so they know someone\'s listening.'])],
});

home({ id: 'humhome', name: 'The blue window house', town: 'hum', door: [33, 23], w: 9, h: 8, dx: 6,
  pieces: [['stove', 1, 1], ['shelf', 3, 1], ['bedBlue', 7, 1], ['table', 2, 4], ['chair', 4, 4], ['rugBlue', 2, 6]],
  npcs: [who('humhome1', 5, 6, 'villager', 'Woman', ['The Pylon shines through the wall at night. Blue, then less blue.', 'Good for sleeping. Sort of.'])],
});

home({ id: 'humhelmet', name: 'The Rider\'s house', town: 'hum', door: [14, 28], w: 10, h: 7, dx: 4,
  pieces: [['window', 5, 0], ['bedRed', 1, 1], ['bedGreen', 8, 1], ['table', 3, 2], ['stool', 5, 2], ['chest', 8, 4]],
  spots: [
    look(3, 2, 'A Rider\'s helmet, upside down, used as a fruit bowl. The fruit is also a bit metal.'),
    stash('hm_tin', 8, 4, 'In the chest, a Rider tin with the seal still on.', { items: [['ridertin', 1]] }),
  ],
});

// ---------------------------------------------------------------- Tusk

home({ id: 'tuskfire', name: 'The warm house', town: 'tusk', door: [5, 34], w: 10, h: 8, dx: 4,
  pieces: [['hearth', 1, 1], ['shelf', 5, 1], ['bedRed', 8, 1], ['table', 3, 4], ['chair', 5, 4], ['rugRed', 5, 5]],
  npcs: [who('tuskfire1', 2, 6, 'elder', 'Old man', ['Tusk winters, you keep the fire in and the cast out.', 'Casts don\'t mind cold. They mind fires.'])],
});

home({ id: 'tuskcombs', name: 'The comb-carver\'s', town: 'tusk', door: [30, 34], w: 12, h: 7, dx: 7,
  pieces: [['workbench', 1, 1], ['workbench', 3, 1], ['shellcase', 6, 1], ['shellcase', 7, 1], ['cast', 10, 1], ['table', 2, 4], ['stool', 4, 4]],
  npcs: [who('tuskcomb1', 9, 4, 'keeper', 'Carver', ['I carve the Tusk\'s chips into combs.', 'The Tusk doesn\'t mind. Or it\'s being polite.'])],
});

// ---------------------------------------------------------------- Hilt

home({ id: 'hiltbunks', name: 'The guards\' bunks', town: 'hilt', door: [4, 20], w: 11, h: 8, dx: 5,
  pieces: [['bedBlue', 1, 1], ['bedBlue', 2, 1], ['bedRed', 3, 1], ['table', 6, 2], ['stool', 8, 2], ['barrel', 9, 5], ['crate', 9, 6]],
  npcs: [who('hiltbunk1', 6, 5, 'keeper', 'Guard', ['Off duty. Still guarding the sword in my sleep.', 'Sword\'s very still. So am I. We\'re good at it.'])],
});

home({ id: 'hiltwife', name: 'The guard\'s house', town: 'hilt', door: [19, 20], w: 9, h: 8, dx: 4,
  pieces: [['stove', 1, 1], ['shelf', 3, 1], ['table', 5, 2], ['chair', 7, 2], ['rugGreen', 4, 4], ['plant', 1, 5]],
  npcs: [who('hiltwife1', 2, 4, 'oldwoman', 'Old woman', ['My husband guarded that sword forty years. Never saw the blade.', 'He saw it this week. Says it\'s fine. Bit plain.'])],
});

home({ id: 'hiltbuttons', name: 'The button-polisher\'s', town: 'hilt', door: [18, 26], w: 10, h: 7, dx: 3,
  pieces: [['workbench', 1, 1], ['crate', 4, 1], ['barrel', 5, 1], ['table', 6, 3], ['stool', 8, 3]],
  npcs: [who('hiltbutton1', 2, 4, 'villager2', 'Polisher', ['I polish the guards\' buttons. Lot of guards.', 'Lot of buttons. I\'ve never been bored. I\'ve been close.'], { idle: { every: 140, act: 'nod' } })],
});

// ---------------------------------------------------------------- Fall

home({ id: 'falleast', name: 'The leaning house', town: 'fall', door: [10, 22], w: 10, h: 8, dx: 4,
  pieces: [['barrel', 8, 1], ['barrel', 8, 2], ['crate', 8, 3], ['chair', 7, 3], ['table', 6, 5], ['plant', 8, 5]],
  npcs: [who('falleast1', 2, 4, 'starwalker', 'Man', ['Everything in here rolls east. The chairs too.', 'I just sit wherever the chair stopped.'])],
});

home({ id: 'fallcount', name: 'The star-counter\'s', town: 'fall', door: [29, 23], w: 11, h: 7, dx: 5,
  pieces: [['window', 2, 0], ['window', 8, 0], ['table', 1, 2], ['chair', 3, 2], ['shelf', 5, 1], ['bedBlue', 9, 1]],
  npcs: [who('fallcount1', 6, 4, 'villager', 'Star-counter', ['I count the stars that land. Two thousand and six this year.', 'I might\'ve counted some twice. Stars look alike.'])],
});

// ---------------------------------------------------------------- the Brook Wood

home({ id: 'brookhut', name: 'The woodcutter\'s hut', town: 'brookwood', door: [10, 3], w: 9, h: 7, dx: 4,
  pieces: [['stove', 1, 1], ['bedGreen', 7, 1], ['table', 3, 3], ['stool', 5, 3], ['crate', 1, 4], ['plant', 7, 4]],
  npcs: [who('brookhut1', 3, 5, 'villager2', 'Woodcutter', ['The brook talks all night. I talk back.', 'One of us is learning something. Not sure who.'])],
});

/** Every room this file adds, for the validator's strict checks. */
export const HOMES = ['tsweaver', 'tsbaker', 'tscradle', 'ribcarvings', 'ribtwins', 'ribfire', 'mastnets', 'mastshells', 'mastbunks', 'mastkitchen',
  'spirehush', 'spirebells', 'boleroots', 'bolerain', 'bolespoons', 'bolenote', 'bolesnail', 'humparts', 'humhome', 'humhelmet', 'tuskfire',
  'tuskcombs', 'hiltbunks', 'hiltwife', 'hiltbuttons', 'falleast', 'fallcount', 'brookhut'];
