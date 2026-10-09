// Furniture for the houses and small set pieces for the towns: beds, tables, hearths, shelves, carts, washing lines, nets, lanterns.
// Each is a prop painter. A solid piece stands on a furniture tile ('|' indoors, '`' outdoors) that draws as the floor or ground under it.
import { rect, INK } from '../engine/screen';
import { defProp } from './props';

const R = rect;
const WOOD = '#8a5a3a', WOOD_D = '#5a3a2a', WOOD_L = '#b07a4a', LINEN = '#e8e0d0', LINEN_D = '#b8b0a0';
const STONE = '#8a8a90', STONE_D = '#5a5a62', FIRE = '#f0a030', FIRE_L = '#ffe080', GREEN = '#4a8a3a', GREEN_L = '#7ab85a';
const CLAY = '#b0603a', METAL = '#9aa0a8', SHELL = '#f0d8c8', SHELL_P = '#d8a0a8';

/** A bed against the wall, one tile wide and two long, its blanket in the given color. */
function bed(name: string, blanket: string, fold: string): void {
  defProp(name, {
    w: 1, h: 2,
    paint(x, y) {
      R(x, y, 8, 16, INK);
      R(x + 1, y + 1, 6, 14, WOOD);
      R(x + 1, y + 2, 6, 3, LINEN); R(x + 2, y + 3, 4, 1, LINEN_D);
      R(x + 1, y + 6, 6, 8, blanket); R(x + 1, y + 6, 6, 1, fold); R(x + 2, y + 9, 1, 4, fold);
      R(x + 1, y + 14, 1, 1, WOOD_D); R(x + 6, y + 14, 1, 1, WOOD_D);
    },
  });
}
bed('bedRed', '#b84a4a', '#e07a6a');
bed('bedBlue', '#4a6ab0', '#7a9ae0');
bed('bedGreen', '#4a8a5a', '#7ab88a');

defProp('table', {
  w: 2, h: 1,
  paint(x, y) {
    R(x, y + 1, 16, 5, INK);
    R(x + 1, y + 2, 14, 2, WOOD_L); R(x + 1, y + 4, 14, 1, WOOD_D);
    R(x + 2, y + 5, 1, 3, WOOD_D); R(x + 13, y + 5, 1, 3, WOOD_D);
    R(x + 4, y, 2, 2, LINEN); R(x + 4, y + 1, 2, 1, LINEN_D);
    R(x + 10, y, 3, 2, CLAY); R(x + 11, y, 1, 1, '#e8b080');
  },
});

defProp('chair', {
  w: 1, h: 1,
  paint(x, y) {
    R(x + 2, y, 4, 8, INK);
    R(x + 3, y + 1, 2, 3, WOOD); R(x + 2, y + 4, 4, 2, WOOD_L);
    R(x + 2, y + 6, 1, 2, WOOD_D); R(x + 5, y + 6, 1, 2, WOOD_D);
  },
});

defProp('stool', {
  w: 1, h: 1,
  paint(x, y) { R(x + 1, y + 3, 6, 3, INK); R(x + 2, y + 3, 4, 1, WOOD_L); R(x + 2, y + 4, 4, 1, WOOD); R(x + 2, y + 5, 1, 3, WOOD_D); R(x + 5, y + 5, 1, 3, WOOD_D); },
});

/** A hearth against the back wall with a fire that flickers. It lights the room. */
defProp('hearth', {
  w: 2, h: 1,
  paint(x, y, t) {
    R(x, y - 4, 16, 12, INK);
    R(x + 1, y - 3, 14, 10, STONE); R(x + 1, y - 3, 14, 1, '#b0b0b8');
    for (let k = 0; k < 4; k++) R(x + 2 + k * 3, y + (k % 2) * 3, 2, 1, STONE_D);
    R(x + 4, y + 1, 8, 6, '#2a1a14');
    const f = Math.floor(t / 6) % 3;
    R(x + 5, y + 4, 6, 2, FIRE); R(x + 6 - (f === 1 ? 1 : 0), y + 3 - f % 2, 2, 2, FIRE_L); R(x + 9, y + 2 + (f === 2 ? 1 : 0), 1, 2, FIRE_L);
    R(x + 5, y + 6, 6, 1, WOOD_D);
  },
});

/** A shelf of jars and books against the back wall. */
defProp('shelf', {
  w: 2, h: 1,
  paint(x, y) {
    R(x, y - 3, 16, 11, INK);
    R(x + 1, y - 2, 14, 9, WOOD_D);
    R(x + 1, y + 1, 14, 1, WOOD_L); R(x + 1, y + 6, 14, 1, WOOD_L);
    const books = ['#b84a4a', '#4a6ab0', '#c8a040', '#4a8a5a', '#8a4ab0'];
    books.forEach((c, k) => R(x + 2 + k * 2, y - 1 + (k % 2), 2, 2 - (k % 2), c));
    R(x + 12, y - 1, 2, 2, SHELL);
    R(x + 2, y + 2, 3, 4, '#7ab0c8'); R(x + 2, y + 2, 3, 1, '#c8e8f0'); R(x + 7, y + 3, 2, 3, CLAY); R(x + 11, y + 2, 3, 4, SHELL_P);
  },
});

defProp('barrel', {
  w: 1, h: 1,
  paint(x, y) { R(x + 1, y, 6, 8, INK); R(x + 2, y + 1, 4, 6, WOOD); R(x + 2, y + 2, 4, 1, METAL); R(x + 2, y + 5, 4, 1, METAL); R(x + 3, y + 1, 1, 6, WOOD_L); },
});

defProp('crate', {
  w: 1, h: 1,
  paint(x, y) { R(x, y + 1, 8, 7, INK); R(x + 1, y + 2, 6, 5, WOOD_L); R(x + 1, y + 4, 6, 1, WOOD_D); R(x + 3, y + 2, 1, 5, WOOD_D); },
});

defProp('plant', {
  w: 1, h: 1,
  paint(x, y) {
    R(x + 2, y + 4, 4, 4, INK); R(x + 3, y + 5, 2, 3, CLAY);
    R(x + 1, y + 1, 2, 3, GREEN); R(x + 4, y, 2, 4, GREEN_L); R(x + 3, y + 2, 2, 3, GREEN); R(x + 6, y + 2, 1, 2, GREEN);
  },
});

/** A rug on the floor, three by two. Ouro walks on it. */
function rug(name: string, a: string, b: string): void {
  defProp(name, {
    w: 3, h: 2,
    paint(x, y) {
      R(x + 1, y + 2, 22, 12, a); R(x + 3, y + 4, 18, 8, b); R(x + 5, y + 6, 14, 4, a);
      for (let k = 0; k < 6; k++) { R(x + 1 + k * 4, y + 1, 1, 1, b); R(x + 1 + k * 4, y + 14, 1, 1, b); }
    },
  });
}
rug('rugRed', '#8a3a3a', '#c8804a');
rug('rugBlue', '#3a4a8a', '#7a9ac8');
rug('rugGreen', '#3a6a4a', '#9ab87a');

defProp('loom', {
  w: 2, h: 1,
  paint(x, y) {
    R(x, y - 4, 16, 12, INK);
    R(x + 1, y - 3, 2, 10, WOOD); R(x + 13, y - 3, 2, 10, WOOD); R(x + 1, y - 3, 14, 1, WOOD_L); R(x + 1, y + 5, 14, 1, WOOD_L);
    for (let k = 0; k < 10; k++) R(x + 3 + k, y - 2, 1, 7, k % 3 === 0 ? '#c8504a' : k % 3 === 1 ? '#e8c060' : LINEN);
  },
});

defProp('tub', {
  w: 1, h: 1,
  paint(x, y) { R(x, y + 2, 8, 6, INK); R(x + 1, y + 3, 6, 4, WOOD); R(x + 1, y + 3, 6, 1, '#6ab0d0'); R(x + 2, y + 4, 4, 1, METAL); },
});

defProp('cradle', {
  w: 1, h: 1,
  paint(x, y, t) {
    const r = Math.floor(t / 40) % 2;
    R(x, y + 2, 8, 6, INK); R(x + 1, y + 3, 6, 3, WOOD_L); R(x + 2, y + 3, 4, 1, LINEN);
    R(x + 1 + r, y + 6, 1, 2, WOOD_D); R(x + 6 - r, y + 6, 1, 2, WOOD_D);
  },
});

defProp('workbench', {
  w: 2, h: 1,
  paint(x, y) {
    R(x, y + 1, 16, 7, INK); R(x + 1, y + 2, 14, 2, WOOD); R(x + 1, y + 4, 14, 1, WOOD_D);
    R(x + 2, y + 5, 1, 3, WOOD_D); R(x + 13, y + 5, 1, 3, WOOD_D);
    R(x + 3, y, 4, 2, METAL); R(x + 3, y + 1, 1, 1, WOOD_D); R(x + 9, y + 1, 3, 1, SHELL); R(x + 11, y, 1, 1, SHELL_P);
  },
});

defProp('chest', {
  w: 1, h: 1,
  paint(x, y) { R(x, y + 2, 8, 6, INK); R(x + 1, y + 3, 6, 4, WOOD); R(x + 1, y + 3, 6, 1, WOOD_L); R(x + 1, y + 5, 6, 1, '#c8a040'); R(x + 3, y + 5, 2, 2, '#e8d070'); },
});

/** A glass case of small shells, the kind every house in Turnstone keeps. */
defProp('shellcase', {
  w: 1, h: 1,
  paint(x, y) {
    R(x, y, 8, 8, INK); R(x + 1, y + 1, 6, 6, '#3a4a6a'); R(x + 1, y + 1, 6, 1, '#8ab0d0');
    R(x + 2, y + 3, 2, 2, SHELL); R(x + 5, y + 2, 1, 2, SHELL_P); R(x + 4, y + 5, 2, 1, '#e8c060');
  },
});

/** Someone's cast, the shell they left when they turned, kept standing in a corner. */
defProp('cast', {
  w: 1, h: 1,
  paint(x, y) {
    R(x + 1, y, 6, 8, INK); R(x + 2, y + 1, 4, 6, '#d8ccb8'); R(x + 3, y + 2, 2, 3, '#a89880'); R(x + 3, y + 1, 1, 1, '#f4ecd8');
  },
});

/** A window in the back wall with the night outside, and now and then a star going by. */
defProp('window', {
  w: 1, h: 1,
  paint(x, y, t) {
    R(x, y + 1, 8, 6, INK); R(x + 1, y + 2, 6, 4, '#1e2a5a'); R(x + 4, y + 2, 1, 4, WOOD_D); R(x + 1, y + 4, 6, 1, WOOD_D);
    R(x + 2, y + 3, 1, 1, '#e8ecff'); if (Math.floor(t / 90) % 4 === 0) R(x + 5 + (Math.floor(t / 6) % 2), y + 2, 1, 1, '#fff4c4');
  },
});

defProp('stove', {
  w: 1, h: 1,
  paint(x, y, t) { R(x, y, 8, 8, INK); R(x + 1, y + 1, 6, 6, STONE_D); R(x + 2, y + 4, 4, 2, Math.floor(t / 10) % 2 ? FIRE : '#c86020'); R(x + 1, y + 1, 6, 1, METAL); },
});

defProp('netwall', {
  w: 2, h: 1,
  paint(x, y) {
    for (let k = 0; k < 4; k++) { R(x + 1 + k * 4, y + 1, 1, 6, '#a89870'); R(x + 1, y + 1 + k * 2, 14, 1, '#a89870'); }
    R(x + 6, y + 3, 2, 2, '#e8a040'); R(x + 11, y + 5, 2, 2, SHELL);
  },
});

// ---------------------------------------------------------------- outdoors

/** A cart with its wheel off and leaning on the side, waiting to be fixed. */
defProp('cartbroken', {
  w: 2, h: 1,
  paint(x, y) {
    R(x, y, 13, 7, INK);
    R(x + 1, y + 1, 11, 4, WOOD); R(x + 1, y + 1, 11, 1, WOOD_L); R(x + 2, y + 5, 2, 2, WOOD_D);
    R(x + 9, y + 5, 3, 3, INK);
    R(x + 12, y + 1, 4, 6, INK); R(x + 13, y + 2, 2, 4, WOOD_L); R(x + 13, y + 3, 2, 2, WOOD_D);
  },
});

defProp('cart', {
  w: 2, h: 1,
  paint(x, y) {
    R(x, y, 16, 7, INK);
    R(x + 1, y + 1, 14, 4, WOOD); R(x + 1, y + 1, 14, 1, WOOD_L);
    R(x + 2, y + 4, 4, 4, INK); R(x + 3, y + 5, 2, 2, WOOD_L); R(x + 10, y + 4, 4, 4, INK); R(x + 11, y + 5, 2, 2, WOOD_L);
    R(x + 4, y - 1, 3, 2, '#c8a040'); R(x + 8, y - 1, 3, 2, SHELL);
  },
});

/** Two posts and a line of washing that flaps in the wind. Three tiles wide: Ouro walks under the middle. */
defProp('washline', {
  w: 3, h: 1,
  paint(x, y, t) {
    R(x + 3, y - 6, 2, 13, INK); R(x + 19, y - 6, 2, 13, INK); R(x + 3, y - 5, 1, 11, WOOD); R(x + 19, y - 5, 1, 11, WOOD);
    R(x + 4, y - 5, 15, 1, LINEN_D);
    const cols = ['#c8504a', LINEN, '#4a7ac8', '#e8c060'];
    cols.forEach((c, k) => { const flap = (Math.floor(t / 20) + k) % 2; R(x + 5 + k * 4, y - 4, 3, 4 + flap, c); });
  },
});

defProp('bench', {
  w: 2, h: 1,
  paint(x, y) { R(x, y + 2, 16, 5, INK); R(x + 1, y + 3, 14, 2, WOOD_L); R(x + 2, y + 5, 1, 3, WOOD_D); R(x + 13, y + 5, 1, 3, WOOD_D); },
});

/** A fishing net hung on a frame to dry. */
defProp('netframe', {
  w: 2, h: 1,
  paint(x, y) {
    R(x + 1, y - 5, 2, 13, INK); R(x + 13, y - 5, 2, 13, INK); R(x + 1, y - 4, 1, 11, WOOD); R(x + 13, y - 4, 1, 11, WOOD);
    for (let k = 0; k < 5; k++) { R(x + 3 + k * 2, y - 4, 1, 9, '#a89870'); R(x + 3, y - 4 + k * 2, 10, 1, '#a89870'); }
    R(x + 6, y, 2, 2, '#e8a040');
  },
});

/** A shop's signboard along the eave, three tiles wide: a big painted cowrie between two small horns. */
defProp('shopSign', {
  w: 3, h: 1,
  paint(x, y) {
    R(x + 1, y, 22, 8, INK); R(x + 2, y + 1, 20, 6, WOOD); R(x + 2, y + 1, 20, 1, WOOD_L); R(x + 2, y + 6, 20, 1, WOOD_D);
    R(x + 9, y + 2, 6, 4, SHELL); R(x + 10, y + 1, 4, 1, SHELL); R(x + 10, y + 6, 4, 1, SHELL_P);
    R(x + 11, y + 2, 2, 4, SHELL_P); R(x + 12, y + 3, 1, 2, '#8a5a50'); R(x + 10, y + 2, 1, 1, '#ffffff');
    for (const hx of [x + 4, x + 17]) { R(hx, y + 3, 3, 2, '#e8c060'); R(hx + (hx < x + 12 ? 3 : -1), y + 2, 1, 4, '#e8c060'); R(hx + 1, y + 3, 1, 1, '#b08030'); }
  },
});

/** A shopfront under a striped awning: a scalloped rose and cream canopy and a window with shells set out in it. */
defProp('shopfront', {
  w: 3, h: 1,
  paint(x, y) {
    R(x + 1, y + 3, 22, 5, INK); R(x + 2, y + 4, 20, 3, '#2a3048'); R(x + 2, y + 4, 20, 1, '#3a4260');
    R(x + 4, y + 5, 2, 2, SHELL); R(x + 9, y + 5, 3, 2, SHELL_P); R(x + 10, y + 5, 1, 1, SHELL); R(x + 15, y + 5, 2, 2, '#e8c060'); R(x + 19, y + 6, 2, 1, SHELL);
    R(x, y - 1, 24, 4, INK);
    for (let k = 0; k < 11; k++) R(x + 1 + k * 2, y, 2, 2, k % 2 ? '#e8dcc0' : '#c8686a');
    for (let k = 0; k < 6; k++) R(x + 2 + k * 4, y + 3, 2, 1, k % 2 ? '#e8dcc0' : '#c8686a');
  },
});

/** A lantern on a post. It lights the ground round it. */
defProp('lantern', {
  w: 1, h: 1,
  paint(x, y, t) {
    R(x + 3, y - 6, 2, 14, INK); R(x + 3, y - 5, 1, 12, WOOD_D);
    R(x + 1, y - 9, 6, 5, INK); R(x + 2, y - 8, 4, 3, Math.floor(t / 14) % 5 ? FIRE_L : FIRE);
  },
});

/** A basket dropped on its side, shells spilled out, and small footprints going off. */
defProp('spilled', {
  w: 2, h: 1,
  paint(x, y) {
    R(x, y + 2, 6, 5, INK); R(x + 1, y + 3, 4, 3, '#c8a060'); R(x + 1, y + 4, 4, 1, WOOD);
    R(x + 7, y + 4, 2, 1, SHELL); R(x + 9, y + 6, 1, 1, SHELL_P); R(x + 6, y + 6, 1, 1, SHELL); R(x + 10, y + 3, 1, 1, '#e8c060');
    for (let k = 0; k < 3; k++) R(x + 11 + k * 2, y + 2 + (k % 2) * 2, 1, 1, '#5a4a40');
  },
});

defProp('flowers', {
  w: 1, h: 1,
  paint(x, y) {
    R(x + 1, y + 4, 6, 3, '#3a5a2a');
    R(x + 1, y + 3, 1, 1, '#e86a8a'); R(x + 3, y + 2, 1, 1, '#f0c860'); R(x + 5, y + 3, 1, 1, '#a07ae0'); R(x + 6, y + 5, 1, 1, '#e86a8a');
    R(x + 2, y + 4, 1, 2, GREEN_L); R(x + 4, y + 3, 1, 3, GREEN_L);
  },
});

defProp('driftpile', {
  w: 2, h: 1,
  paint(x, y) {
    R(x, y + 2, 16, 6, INK); R(x + 1, y + 3, 14, 2, '#a89880'); R(x + 3, y + 5, 11, 2, '#887868'); R(x + 2, y + 1, 9, 2, '#c8b8a0');
    R(x + 5, y + 4, 1, 1, '#5a4a40'); R(x + 11, y + 6, 1, 1, '#5a4a40');
  },
});

defProp('crates', {
  w: 2, h: 1,
  paint(x, y) {
    R(x, y + 1, 16, 7, INK); R(x + 1, y + 2, 6, 5, WOOD_L); R(x + 9, y + 2, 6, 5, WOOD); R(x + 1, y + 4, 14, 1, WOOD_D);
    R(x + 4, y - 4, 7, 6, INK); R(x + 5, y - 3, 5, 4, WOOD_L); R(x + 5, y - 1, 5, 1, WOOD_D);
  },
});

/** A broom leaning on a wall, for someone who sweeps. */
defProp('broom', {
  w: 1, h: 1,
  paint(x, y) { R(x + 4, y - 4, 1, 9, WOOD_D); R(x + 3, y + 4, 3, 4, '#c8a060'); R(x + 3, y + 7, 3, 1, '#8a6a3a'); },
});

/** A fishing line from the edge out into the water, the float bobbing. */
defProp('rodline', {
  w: 2, h: 1,
  paint(x, y, t) {
    R(x, y, 1, 1, WOOD_D); R(x + 1, y - 1, 1, 1, WOOD_D); R(x + 2, y - 2, 1, 1, WOOD_D);
    for (let k = 3; k < 12; k++) R(x + k, y - 2 + Math.floor((k - 3) / 2), 1, 1, LINEN_D);
    const b = Math.floor(t / 24) % 2;
    R(x + 12, y + 3 + b, 2, 2, '#e85a4a'); R(x + 12, y + 3 + b, 2, 1, LINEN);
  },
});

/** A whorl's empty bowl and a mat by a door, where one sleeps. */
defProp('mat', {
  w: 1, h: 1,
  paint(x, y) { R(x, y + 4, 8, 4, '#8a6a4a'); R(x + 1, y + 5, 6, 2, '#a88a5a'); R(x + 6, y + 2, 2, 2, CLAY); },
});
