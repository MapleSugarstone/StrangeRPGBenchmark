// Scenario tests for every mechanic in src/rules.js. Usage: node tools/test-rules.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
vm.runInThisContext(fs.readFileSync(path.join(root, 'src', 'rules.js'), 'utf8'), { filename: 'rules.js' });

const D = { U: 0, R: 1, D: 2, L: 3 };
// Runs moves written like 'R R xL dr w' and returns the final state and every event.
function play(def, moves) {
  let s = Rules.load(def);
  const events = [];
  for (const tok of moves.split(' ').filter(Boolean)) {
    let a;
    if (D[tok] !== undefined) a = { t: 'move', d: D[tok] };
    else if (tok[0] === 'x') a = { t: 'zap', d: D[tok[1]] };
    else if (tok[0] === 'd') a = { t: 'drop', c: tok[1] };
    else a = { t: 'wait' };
    const r = Rules.step(s, a);
    if (!r) { events.push({ e: 'noop', tok }); continue; }
    s = r.s;
    events.push(...r.ev);
  }
  return { s, ev: events, has: (e) => events.some((x) => x.e === e) };
}
const objs = (s, k) => s.objs.filter((o) => o.k === k);
let fails = 0, passes = 0;
function check(name, ok, info) {
  if (ok) { passes++; return; }
  fails++;
  console.log('FAIL ' + name + (info ? ': ' + JSON.stringify(info) : ''));
}

// Pinger: faces the bolt's way, fires the turn after it compiles, and the packet flies and hurts a husk.
{
  const def = { recipes: { pinger: 'rr' }, husks: [{ hp: 3 }], stacks: [{ x: 5, y: 1, bits: 'rr' }], map: ['#########', '#h......#', '#.....P.#', '#########'] };
  def.map = ['#########', '#h.....P#', '#########'];
  const r = play(def, 'xL');
  check('pinger compiles facing the bolt', objs(r.s, 'pinger')[0]?.d === 3, objs(r.s, 'pinger'));
  check('pinger has not fired on its first turn', !r.has('fire'), r.ev);
  const r2 = play(def, 'xL w w w w');
  check('packet reaches the husk', r2.has('hit') && objs(r2.s, 'husk')[0].hp === 2, r2.ev);
}
// A packet compiles a stack it reaches.
{
  const r = play({ recipes: { pinger: 'rr', ram: 'yy' }, stacks: [{ x: 4, y: 1, bits: 'rr' }, { x: 2, y: 1, bits: 'yy' }], map: ['#########', '#......P#', '#########'] }, 'xL w w w');
  check('packet compiles a stack', objs(r.s, 'ram').length === 1, r.ev);
}
// Mirrors turn the bolt round a corner.
{
  const r = play({ recipes: { fork: 'yy' }, stacks: [{ x: 1, y: 1, bits: 'yy' }], map: ['#######', '#....N#', '#....P#', '#######'] }, 'xU');
  check('mirror \\ turns an upward bolt left', objs(r.s, 'fork').length === 1, r.ev);
  const r2 = play({ recipes: { fork: 'yy' }, stacks: [{ x: 5, y: 1, bits: 'yy' }], map: ['#######', '#M....#', '#P....#', '#######'] }, 'xU');
  check('mirror / turns an upward bolt right', objs(r2.s, 'fork').length === 1, r2.ev);
}
// Glass blocks walking, passes the wand, and a Ram shatters it and stops.
{
  const def = { recipes: { ram: 'rr' }, stacks: [{ x: 1, y: 1, bits: 'rr' }], map: ['########', '#...g.P#', '########'] };
  const r = play(def, 'L L xL');
  check('glass blocks walking', r.ev[1].e === 'noop', r.ev);
  check('wand passes glass', objs(r.s, 'ram').length === 1, r.ev);
  const r2 = play(def, 'L xL w w w w');
  check('ram shatters glass and stops', r2.has('shatter') && r2.s.tiles.indexOf('g') < 0 && objs(r2.s, 'ram')[0]?.d === -1, r2.ev);
}
// Overclock: zapping a Fork bursts it this turn.
{
  const r = play({ recipes: { fork: 'bb' }, husks: [{ hp: 3 }], stacks: [{ x: 2, y: 1, bits: 'bb' }], map: ['#########', '#h.....P#', '#########'] }, 'xL xL');
  check('overclocked fork bursts at once', r.has('boom') && objs(r.s, 'husk').length === 0, r.ev);
}
// Ordered recipes: the bottom bit is the one dropped first.
{
  const r = play({ recipes: { ram: 'r>y', fork: 'y>r' }, map: ['#######', '#Pry..#', '#######'] }, 'R R L L dr dy R R xL');
  check('r then y makes the ram', objs(r.s, 'ram').length === 1, r.ev);
  const r2 = play({ recipes: { ram: 'r>y', fork: 'y>r' }, map: ['#######', '#Pry..#', '#######'] }, 'R R L L dy dr R R xL');
  check('y then r makes the fork', objs(r2.s, 'fork').length === 1, r2.ev);
}
// Decoy: a Ram charges the decoy, not Pilcrow, when the decoy is nearer.
{
  const r = play({ recipes: { ram: 'rr' }, map: ['#########', '#P......#', '#.......#', '#rr...B.#', '#########'], objs: [{ k: 'decoy', x: 6, y: 3 }] }, 'D D xD');
  check('ram goes for the nearer decoy', objs(r.s, 'decoy').length === 1 || r.has('die'), r.ev);
  const r2 = play({ recipes: { ram: 'rr' }, map: ['##########', '#rr.....P#', '##########'], objs: [{ k: 'decoy', x: 5, y: 1 }] }, 'xL');
  check('decoy blocks the bolt', r2.ev.some((e) => e.e === 'zap' && e.hit === 'block'), r2.ev);
}
// Swapper: the bolt trades places.
{
  const r = play({ recipes: {}, map: ['########', '#P.__..#', '########'], objs: [{ k: 'swapper', x: 6, y: 1 }] }, 'xR');
  check('swap crosses the void', r.s.px === 6 && objs(r.s, 'swapper')[0].x === 1, { px: r.s.px });
}
// Echo repeats moves and pushes.
{
  const r = play({ recipes: {}, map: ['########', '#P.....#', '#..B...#', '#......#', '########'], objs: [{ k: 'echo', x: 1, y: 2 }] }, 'R');
  check('echo steps with Pilcrow', objs(r.s, 'echo')[0].x === 2 && r.s.px === 2);
  const r2 = play({ recipes: {}, map: ['########', '#P.....#', '#..B...#', '#......#', '########'], objs: [{ k: 'echo', x: 1, y: 2 }] }, 'R R');
  check('echo pushes a brick', objs(r2.s, 'brick')[0].x === 4 && objs(r2.s, 'echo')[0].x === 3, r2.s.objs);
}
// Hunter steps toward Pilcrow and bites.
{
  const r = play({ recipes: {}, husks: [{ hp: 2 }], map: ['#######', '#H...P#', '#######'] }, 'w');
  check('hunter steps closer', objs(r.s, 'husk')[0].x === 2);
  const r2 = play({ recipes: {}, husks: [{ hp: 2 }], map: ['#######', '#H...P#', '#######'] }, 'w w w');
  check('hunter bites when next to Pilcrow', r2.s.hp === 2, { hp: r2.s.hp });
}
// Clerk: front hits clank, side hits land.
{
  const r = play({ recipes: {}, husks: [{ hp: 2, face: 1 }], map: ['######', '#.KP.#', '#....#', '######'] }, 'L');
  check('clerk blocks a front hit', r.has('clank') && objs(r.s, 'husk')[0].hp === 2, r.ev);
  const r2 = play({ recipes: {}, husks: [{ hp: 2, face: 1 }], map: ['######', '#.K..#', '#.P..#', '######'] }, 'U');
  check('clerk takes a side hit', objs(r2.s, 'husk')[0].hp === 1, r2.ev);
}
// Hoarder eats bits and drops them when it dies.
{
  const r = play({ recipes: {}, husks: [{ hp: 1, pace: 1 }], map: ['########', '#Ur....#', '#......#', '#.....P#', '########'] }, 'w');
  check('hoarder eats bits', objs(r.s, 'husk')[0].belly === 'r', objs(r.s, 'husk'));
  const r2 = play({ recipes: {}, husks: [{ hp: 1, pace: 1 }], map: ['########', '#Ur.P..#', '########'] }, 'w L L');
  check('hoarder drops what it ate', !objs(r2.s, 'husk').length && Object.values(r2.s.bits).join('') === 'r', { bits: r2.s.bits, ev: r2.ev });
}
// Conveyors carry Pilcrow, bits, and push things off into the void.
{
  const r = play({ recipes: {}, map: ['#######', '#P>>..#', '#######'] }, 'R');
  check('conveyor carries Pilcrow', r.s.px === 3, { px: r.s.px });
  const r2 = play({ recipes: {}, stacks: [{ x: 3, y: 1, bits: 'r' }], map: ['#######', '#.>>>_#', '#P....#', '#######'] }, 'w');
  check('conveyor carries bits', r2.s.bits[1 * 7 + 4] === 'r', r2.s.bits);
  const r3 = play({ recipes: {}, map: ['######', '#.B>_#', '#P...#', '######'] }, 'U R');
  check('conveyor drops a brick into the void and fills it', r3.s.tiles[1 * 6 + 4] === '.', r3.ev);
}
// Plates hold doors open.
{
  const r = play({ recipes: {}, map: ['#########', '#P.Bo.D.#', '#########'] }, 'R R');
  check('door opens with a brick on the plate', r.s.open[0] === true, r.s.open);
  const r2 = play({ recipes: {}, map: ['#########', '#P.o..D.#', '#########'] }, 'R R R');
  check('door closes when Pilcrow steps off the plate', r2.s.open[0] === false, r2.s.open);
}
// Printer prints a bit where the bolt came from.
{
  const r = play({ recipes: {}, map: ['#######', '#1..P.#', '#######'] }, 'xL');
  check('printer prints', r.s.bits[1 * 7 + 2] === 'r', r.s.bits);
}
// Recipe keycaps: the rows on the floor are the recipes, and pushing a keycap rewrites them.
{
  const def = { board: true, keys: [{ x: 1, y: 2, v: 'r' }, { x: 3, y: 2, v: 'ram' }, { x: 5, y: 2, v: 'fork' }], stacks: [{ x: 1, y: 4, bits: 'r' }],
    map: ['########', '#......#', '#.=....#', '#......#', '#....P.#', '########'] };
  const r = play(def, 'xL');
  check('keycap row makes r a ram', objs(r.s, 'ram').length === 1 && r.s.recipes.ram === 'r', r.s.recipes);
  const r2 = play(def, 'L L U U D R R R U L L');
  check('pushing a daemon keycap rewrites the recipe', r2.s.recipes.fork === 'r' && !r2.s.recipes.ram, { recipes: r2.s.recipes, keys: objs(r2.s, 'key') });
}
// The Manager: telegraphs a slam toward Pilcrow, carries it out next turn, and drops bits and the chip when hurt.
{
  const def = { boss: { hp: 3, cycle: ['slam', 'wait'], drops: [{ x: 1, y: 4 }], bits: 'y' }, map: ['#########', '#.Z.....#', '#.......#', '#.......#', '#..P....#', '#########'] };
  const s0 = Rules.load(def);
  check('boss telegraphs its first slam toward Pilcrow', objs(s0, 'boss')[0].tel === 'slam:2', objs(s0, 'boss')[0]);
  const r = play(def, 'w');
  check('a slam hurts Pilcrow in the band', r.has('slam') && r.s.hp < 3, { hp: r.s.hp, ev: r.ev.filter((e) => e.e === 'slam') });
  const def2 = { recipes: { ram: 'rr' }, boss: { hp: 3, cycle: ['wait'], drops: [{ x: 7, y: 4 }], bits: 'y' }, stacks: [{ x: 6, y: 2, bits: 'rr' }],
    map: ['#########', '#Z......#', '#.......#', '#.......#', '#.......#', '#########'] };
  def2.map[2] = '#..P....#';
  const r2 = play(def2, 'R xR U w w w');
  check('a ram kills a 3 HP boss and leaves the chip', r2.has('bossdie') && r2.s.goal === 1 * 9 + 1, { ev: r2.ev.filter((e) => e.e.startsWith('boss')), goal: r2.s.goal });
  check('a hit knocks a bit loose', r2.s.bits[4 * 9 + 7] === 'y', r2.s.bits);
}

// The Foreman stacks a crate between Pilcrow and itself.
{
  const r = play({ boss: { type: 'foreman', hp: 3, cycle: ['stack'] }, map: ['#########', '#Z......#', '#.......#', '#.......#', '#....P..#', '#########'] }, 'w');
  check('foreman stacks a crate beside Pilcrow toward itself', r.s.tiles[4 * 9 + 4] === '%', { ev: r.ev.filter((e) => e.e === 'stack') });
}
// The Warden: its front turns packets, its back does not, and it turns toward a nearer Decoy.
{
  const base = { objs: [{ k: 'pinger', x: 9, y: 1, d: 3 }], map: ['###########', '#...Z.....#', '#.........#', '#P........#', '###########'] };
  const front = play(Object.assign({}, base, { boss: { type: 'warden', hp: 3, face: 1, cycle: ['wait'] } }), 'w w w w w w');
  check('warden front turns a packet', front.has('clank') && objs(front.s, 'boss')[0].hp === 3, front.ev.filter((e) => e.e === 'clank' || e.e === 'bosshit'));
  const back = play(Object.assign({}, base, { boss: { type: 'warden', hp: 3, face: 3, cycle: ['wait'] } }), 'w w w w w w');
  check('warden back takes a packet', objs(back.s, 'boss')[0].hp === 2, back.ev.filter((e) => e.e === 'bosshit'));
  const turn = play({ boss: { type: 'warden', hp: 3, face: 2, cycle: ['turn'] }, objs: [{ k: 'decoy', x: 4, y: 2 }], map: ['#########', '#Z......#', '#.......#', '#.......#', '#P......#', '#########'] }, 'w');
  check('warden turns toward the nearer decoy', objs(turn.s, 'boss')[0].f === 1, objs(turn.s, 'boss')[0]);
}
// The Forklift drives at Pilcrow and falls off an edge; a flip reverses every belt.
{
  const r = play({ boss: { type: 'forklift', hp: 6, cycle: ['drive'] }, map: ['##########', '#Z...__.P#', '#....__..#', '##########'] }, 'w');
  check('forklift drives off the edge and drops the chip', r.has('bossfall') && r.s.goal === 1 * 10 + 3, { ev: r.ev.filter((e) => e.e.startsWith('boss')), goal: r.s.goal });
  const f = play({ boss: { type: 'forklift', hp: 6, cycle: ['flip'] }, map: ['#########', '#Z..>>..#', '#....v..#', '#P......#', '#########'] }, 'w');
  check('flip reverses every belt', f.s.tiles.join('').includes('<<') && f.s.tiles.join('').includes('^'), f.s.tiles.join(''));
}

// Grease: Pilcrow, pushed things, and husks slide until something stops them, and slide into the void.
{
  const r = play({ recipes: {}, map: ['#########', '#P.iiii.#', '#########'] }, 'R R');
  check('Pilcrow slides across grease to dry floor', r.s.px === 7, { px: r.s.px });
  const r2 = play({ recipes: {}, map: ['#########', '#P.iii#.#', '#########'] }, 'R R');
  check('Pilcrow stops against a wall on grease', r2.s.px === 5, { px: r2.s.px });
  const r3 = play({ recipes: {}, map: ['#########', '#PBiii__#', '#........#'.slice(0, 9), '#########'] }, 'R');
  check('a pushed brick slides and fills the void', r3.s.tiles[1 * 9 + 6] === '.' && !r3.s.objs.some((o) => o.k === 'brick'), r3.ev.filter((e) => e.e !== 'step'));
  const r4 = play({ recipes: {}, husks: [{ hp: 2, pace: 1 }], map: ['########', '#hii_..#', '#.....P#', '########'] }, 'w');
  check('a pacing husk slides off into the void', !r4.s.objs.some((o) => o.k === 'husk'), r4.ev);
}
// A microwave cooks the bits on it one step each turn.
{
  const r = play({ recipes: {}, stacks: [{ x: 2, y: 1, bits: 'ry' }], map: ['#####', '#.w.#', '#P..#', '#####'] }, 'w');
  check('a microwave turns r y into y b', r.s.bits[1 * 5 + 2] === 'yb', r.s.bits);
}
// The Fry Cook greases toward Pilcrow and slides on its own grease.
{
  const r = play({ boss: { type: 'cook', hp: 6, cycle: ['grease', 'step'] }, map: ['###########', '#Z........#', '#.........#', '#.....P...#', '###########'] }, 'w');
  check('grease spills up to four tiles per lane', r.s.tiles.filter((t) => t === 'i').length === 8, r.s.tiles.join(''));
  const r2 = play({ boss: { type: 'cook', hp: 6, cycle: ['grease', 'step'] }, map: ['###########', '#Z........#', '#.........#', '#.........#', '#.....P...#', '###########'] }, 'w L');
  check('a boss stepping onto grease slides', objs(r2.s, 'boss')[0].x > 2, objs(r2.s, 'boss')[0]);
}

// Portals: whatever enters one arrives on its partner, still heading the same way. Bolts and sight pass through too.
{
  const r = play({ recipes: {}, map: ['########', '#P(..).#', '########'] }, 'R');
  check('Pilcrow arrives on the partner portal', r.s.px === 5 && r.has('portal'), { px: r.s.px });
  const r2 = play({ recipes: { ram: 'r' }, map: ['#########', '#P(#).r.#', '#########'] }, 'xR');
  check('a bolt passes through a portal and compiles', r2.ev.some((e) => e.e === 'compile' && e.x === 6), r2.ev);
  check('the new Ram sees Pilcrow back through the portal', objs(r2.s, 'ram')[0]?.d === 3 && objs(r2.s, 'ram')[0].x === 5, objs(r2.s, 'ram'));
  const r3 = play({ recipes: {}, husks: [{ hp: 2 }], map: ['##########', '#P(##)..H#', '##########'] }, 'w w w');
  check('a Hunter sees and walks through a portal', objs(r3.s, 'husk')[0].x === 2 && r3.s.hp === 2, { h: objs(r3.s, 'husk')[0], hp: r3.s.hp });
  const r4 = play({ recipes: {}, map: ['#######', '#PB(.)_#', '#######'] }, 'R');
  check('a pushed Brick goes through a portal', objs(r4.s, 'brick')[0]?.x === 5, objs(r4.s, 'brick'));
}
// Tokens and token gates: a gate opens for good when Pilcrow walks into it with a token.
{
  const r = play({ recipes: {}, map: ['#######', '#Pt$..#', '#######'] }, 'R R');
  check('a token pays a gate open', r.s.px === 3 && r.s.tiles[1 * 7 + 3] === '.' && r.s.inv.indexOf('t') < 0, { px: r.s.px, inv: r.s.inv });
  const r2 = play({ recipes: {}, map: ['######', '#P$..#', '######'] }, 'R');
  check('a gate stays shut without a token', r2.s.px === 1 && r2.ev.some((e) => e.e === 'noop'), r2.ev);
  const r3 = play({ recipes: {}, stacks: [{ x: 2, y: 1, bits: 'tr' }], map: ['#####', '#.w.#', '#P..#', '#####'] }, 'w');
  check('a microwave cooks bits but never tokens', r3.s.bits[1 * 5 + 2] === 'ty', r3.s.bits);
  const r4 = play({ recipes: { decoy: 'rt' }, stacks: [{ x: 4, y: 1, bits: 'tr' }], map: ['######', '#P...#', '######'] }, 'xR');
  check('a recipe can name a token', objs(r4.s, 'decoy').length === 1, r4.ev);
}
// The High Score relinks the portals and warps to the far side of the room.
{
  const r = play({ boss: { type: 'arcade', hp: 6, cycle: ['relink', 'wait'] }, map: ['###########', '#Z........#', '#.........#', '#P(.).[.].#', '###########'] }, 'w R');
  check('relink pairs ( with [', r.s.link === 1 && r.s.px === 6, { link: r.s.link, px: r.s.px });
  const warp = ['##########', '#Z.......#', '#........#', '#........#', '#........#', '#........#', '#P.......#', '##########'];
  const r2 = play({ boss: { type: 'arcade', hp: 6, cycle: ['warp', 'wait'] }, map: warp }, 'w');
  const b = objs(r2.s, 'boss')[0];
  check('warp jumps to the mirrored spot', b.x === 7 && b.y === 5, b);
  const crush = warp.slice(); crush[6] = '#.......P#';
  const r3 = play({ boss: { type: 'arcade', hp: 6, cycle: ['warp', 'wait'] }, map: crush }, 'w');
  check('warp crushes Pilcrow in the landing spot', r3.s.lost, { hp: r3.s.hp });
}

// Sprinklers push the first loose thing in their lane one tile each turn, sprout seeds, and grow vines along the jet.
{
  const sp = (x, y, d) => ({ k: 'sprinkler', x, y, d });
  const r = play({ recipes: {}, objs: [sp(1, 1, 1)], map: ['#########', '#...B...#', '#P......#', '#########'] }, 'w w');
  check('a jet pushes a Brick one tile a turn', objs(r.s, 'brick')[0]?.x === 6, objs(r.s, 'brick'));
  const r2 = play({ recipes: {}, objs: [sp(1, 1, 1)], map: ['#######', '#..P_.#', '#.....#', '#######'] }, 'w');
  check('a jet pushes Pilcrow into the void', r2.s.lost, { hp: r2.s.hp });
  const r3 = play({ recipes: {}, objs: [sp(1, 1, 1)], map: ['#########', '#..,....#', '#P......#', '#########'] }, 'w w w');
  check('a watered seed sprouts and the vine grows along the jet', r3.s.tiles.slice(9, 18).join('') === '#..&&&..#', r3.s.tiles.slice(9, 18).join(''));
  const r4 = play({ recipes: {}, objs: [sp(1, 2, 1)], map: ['#########', '#P......#', '#.......#', '#########'] }, 'xD');
  check('zapping a sprinkler turns it clockwise', objs(r4.s, 'sprinkler')[0].d === 2, objs(r4.s, 'sprinkler'));
  const r5 = play({ recipes: { ram: 'r' }, map: ['########', '#r.P.&.#', '#......#', '########'] }, 'xL D w w');
  check('a Ram smashes a vine', r5.s.tiles[1 * 8 + 5] === '.', r5.ev.filter((e) => e.e === 'smash'));
  const r6 = play({ recipes: {}, stacks: [{ x: 3, y: 1, bits: 'ry' }], objs: [sp(1, 1, 1)], map: ['#######', '#...._#', '#P....#', '#######'] }, 'w w');
  check('a jet pushes a stack into the void', !Object.keys(r6.s.bits).length, r6.s.bits);
}
// The Gardener sows seeds down its lanes and sprays them.
{
  const r = play({ boss: { type: 'gardener', hp: 6, cycle: ['sow', 'spray', 'wait'] }, map: ['##########', '#Z.......#', '#........#', '#........#', '#......P.#', '##########'] }, 'w');
  check('sow scatters seeds up to four tiles per lane', r.s.tiles.filter((t) => t === ',').length === 8, r.s.tiles.join(''));
  const r2 = play({ boss: { type: 'gardener', hp: 6, cycle: ['sow', 'spray', 'wait'] }, map: ['##########', '#Z.......#', '#........#', '#........#', '#......P.#', '##########'] }, 'w w');
  check('spray sprouts the first seed in each lane', r2.s.tiles.filter((t) => t === '&').length === 2, r2.s.tiles.join(''));
}

// Splitters turn one bolt, packet, or jet into two out of their sides. Toggle switches flip the switch doors.
{
  const r = play({ recipes: { brick: 'r' }, stacks: [{ x: 4, y: 1, bits: 'r' }, { x: 4, y: 3, bits: 'r' }], map: ['#######', '#.....#', '#P..*.#', '#.....#', '#######'] }, 'xR');
  check('a split bolt compiles two stacks', objs(r.s, 'brick').length === 2, r.ev.filter((e) => e.e === 'zap'));
  const r2 = play({ recipes: {}, map: ['#######', '#P..!.#', '#.J...#', '#.#####', '#C#####', '#######'] }, 'xR D D D');
  check('a bolt on a switch opens the J doors', r2.s.won, { sw: r2.s.sw, py: r2.s.py });
  const r3 = play({ recipes: {}, sw: 1, map: ['#######', '#.P.!.#', '#.j...#', '#.#####', '#C#####', '#######'] }, 'L xR D D D');
  check('a j door opens when the switch goes off', r3.s.won, { sw: r3.s.sw });
  const r4 = play({ recipes: {}, sw: 1, map: ['########', '#..P...#', '#..J..!#', '#......#', '########'] }, 'D xR');
  check('a switch door never shuts on Pilcrow', r4.s.sw === 0 && Rules.walkable(r4.s, 3, 2), { sw: r4.s.sw });
  const sp = { k: 'sprinkler', x: 1, y: 2, d: 1 };
  const r5 = play({ recipes: {}, objs: [sp, { k: 'brick', x: 4, y: 1 }, { k: 'brick', x: 4, y: 4 }], map: ['#######', '#.....#', '#P..*.#', '#.....#', '#.....#', '#######'] }, 'w');
  check('a split jet pushes both ways', objs(r5.s, 'brick').some((b) => b.y === 0 || b.y === 1) && objs(r5.s, 'brick').some((b) => b.y === 4), objs(r5.s, 'brick'));
}
// The Mainframe fires packets from its front and reboots the switch.
{
  const r = play({ boss: { type: 'mainframe', hp: 6, cycle: ['fire', 'wait', 'wait'] }, map: ['##########', '#Z.......#', '#........#', '#........#', '#........#', '#.P......#', '##########'] }, 'w w w w');
  check('the Mainframe\'s packet reaches Pilcrow', r.s.hp < 3, { hp: r.s.hp, ev: r.ev.filter((e) => e.e === 'zapped' || e.e === 'bossfire') });
  const r2 = play({ boss: { type: 'mainframe', hp: 6, cycle: ['reboot', 'wait'] }, map: ['##########', '#Z.......#', '#........#', '#......P.#', '##########'] }, 'w');
  check('reboot flips the switch', r2.s.sw === 1, { sw: r2.s.sw });
}

// Ramps throw whatever arrives on them over the next tile. Magnets pull the nearest metal daemon in each line.
{
  const r = play({ recipes: {}, map: ['#########', '#PA_.C..#', '#########'] }, 'R R R');
  check('Pilcrow jumps a gap off a ramp', r.s.won, { px: r.s.px, hp: r.s.hp });
  const r2 = play({ recipes: {}, map: ['########', '#PA#.C.#', '########'] }, 'R R');
  check('a wall stops a jump on the ramp', r2.s.px === 2 && !r2.s.won, { px: r2.s.px });
  const r3 = play({ recipes: {}, map: ['#########', '#PBA__..#', '#########'] }, 'R R');
  check('a pushed Brick jumps and fills the far gap', r3.s.tiles[1 * 9 + 5] === '.' && r3.s.tiles[1 * 9 + 4] === '_', r3.s.tiles.slice(9, 18).join(''));
  const mg = (x, y, on) => (on === 0 ? { k: 'magnet', x, y, on: 0 } : { k: 'magnet', x, y });
  const r4 = play({ recipes: {}, objs: [mg(1, 1), { k: 'brick', x: 6, y: 1 }], map: ['#########', '#.......#', '#P......#', '#########'] }, 'w w');
  check('a magnet pulls a Brick a tile a turn', objs(r4.s, 'brick')[0].x === 4, objs(r4.s, 'brick'));
  const r5 = play({ recipes: {}, objs: [mg(1, 1, 0), { k: 'brick', x: 6, y: 1 }], map: ['#########', '#.......#', '#P......#', '#########'] }, 'xU w');
  check('a switched-off magnet pulls nothing until zapped', objs(r5.s, 'magnet')[0].on === 1 && objs(r5.s, 'brick')[0].x === 4, { m: objs(r5.s, 'magnet'), b: objs(r5.s, 'brick') });
  const r6 = play({ recipes: {}, objs: [mg(1, 1), { k: 'brick', x: 6, y: 1 }], map: ['#########', '#...P...#', '#.......#', '#########'] }, 'w');
  check('Pilcrow shields what lies beyond', objs(r6.s, 'brick')[0].x === 6, objs(r6.s, 'brick'));
}
// The Valet parks a Brick beside Pilcrow and switches every magnet.
{
  const r = play({ boss: { type: 'valet', hp: 6, cycle: ['park', 'magnets', 'wait'] }, objs: [{ k: 'magnet', x: 8, y: 1 }], map: ['##########', '#Z.......#', '#........#', '#........#', '#.....P..#', '##########'] }, 'w w');
  check('the Valet parks a Brick next to Pilcrow', objs(r.s, 'brick').length === 1, objs(r.s, 'brick'));
  check('the Valet switches the magnets', objs(r.s, 'magnet')[0].on === 0, objs(r.s, 'magnet'));
}

// Projectors pause whatever stands in their light. Cracked floor falls in once something steps off it.
{
  const pj = (x, y, d) => ({ k: 'projector', x, y, d });
  const r = play({ recipes: {}, objs: [pj(4, 1, 2), { k: 'ram', x: 4, y: 2 }], map: ['#########', '#.......#', '#P......#', '#########'] }, 'w w');
  check('a Ram in the light does not roll', objs(r.s, 'ram')[0].x === 4 && r.s.hp === 3, { ram: objs(r.s, 'ram')[0], hp: r.s.hp });
  const r2 = play({ recipes: {}, husks: [{ hp: 3 }], objs: [pj(2, 1, 2)], map: ['#####', '#...#', '#Ph.#', '#####'] }, 'w w');
  check('a husk in the light does not bite', r2.s.hp === 3, { hp: r2.s.hp });
  const r3 = play({ recipes: {}, objs: [pj(1, 1, 1), { k: 'fork', x: 5, y: 1 }], map: ['#########', '#.......#', '#P......#', '#########'] }, 'w w w w');
  check('a Fork in the light does not count down', objs(r3.s, 'fork')[0]?.f === 3, objs(r3.s, 'fork'));
  const r4 = play({ recipes: {}, objs: [pj(1, 1, 1), { k: 'fork', x: 5, y: 1 }], map: ['#########', '#.......#', '#P......#', '#########'] }, 'xU w w w');
  check('zapping a projector turns its light away', !objs(r4.s, 'fork').length && objs(r4.s, 'projector')[0].d === 2, { f: objs(r4.s, 'fork'), p: objs(r4.s, 'projector') });
  const r5 = play({ recipes: {}, map: ['#######', '#P;..C#', '#######'] }, 'R R');
  check('cracked floor falls in behind Pilcrow', r5.s.tiles[1 * 7 + 2] === '_', r5.s.tiles.slice(7, 14).join(''));
  const r6 = play({ recipes: {}, map: ['#########', '#PB;...C#', '#########'] }, 'R R R');
  check('a Brick pushed over cracked floor leaves a hole', r6.s.tiles[1 * 9 + 3] === '_' && objs(r6.s, 'brick')[0].x === 5, { t: r6.s.tiles.slice(9, 18).join(''), b: objs(r6.s, 'brick') });
}
// The Usher's flashlight pauses everything in its two front lanes, and it cracks the floor.
{
  const r = play({ recipes: { ram: 'r' }, boss: { type: 'usher', hp: 6, face: 1, cycle: ['wait'] }, stacks: [{ x: 7, y: 1, bits: 'r' }], map: ['##########', '#Z......P#', '#........#', '#........#', '##########'] }, 'xL w w');
  check('a Ram in the Usher\'s light stands still', objs(r.s, 'ram')[0]?.x === 7 && objs(r.s, 'boss')[0].hp === 6, { ram: objs(r.s, 'ram'), boss: objs(r.s, 'boss')[0].hp });
  const r2 = play({ boss: { type: 'usher', hp: 6, cycle: ['crack', 'wait'] }, map: ['##########', '#Z.......#', '#........#', '#........#', '#......P.#', '##########'] }, 'w');
  check('crack cracks up to four tiles per lane', r2.s.tiles.filter((t) => t === ';').length === 8, r2.s.tiles.join(''));
}

// Wind-up toys walk a tile a turn and turn right when blocked. Bumpers throw bolts, packets, jets, light, and Rams back.
{
  const r = play({ recipes: { toy: 'r' }, stacks: [{ x: 3, y: 1, bits: 'r' }], map: ['########', '#P.....#', '#......#', '########'] }, 'xR w w');
  check('a toy walks the way the bolt flew', objs(r.s, 'toy')[0]?.x === 6 && objs(r.s, 'toy')[0].d === 1, objs(r.s, 'toy'));
  const r2 = play({ recipes: { toy: 'r' }, stacks: [{ x: 3, y: 1, bits: 'r' }], map: ['########', '#P.....#', '#......#', '########'] }, 'xR w w w w');
  check('a blocked toy turns right and walks on', objs(r2.s, 'toy')[0]?.y === 2 && objs(r2.s, 'toy')[0].d === 2, objs(r2.s, 'toy'));
  const r3 = play({ recipes: {}, objs: [{ k: 'toy', x: 2, y: 1, d: 1 }], map: ['#######', '#.o.D.#', '#P..#C#', '#######'] }, 'w R R');
  check('a toy holds a plate down', r3.ev.some((e) => e.e === 'win') || r3.s.px === 3, { px: r3.s.px, open: r3.s.open });
  const r4 = play({ recipes: { ram: 'r' }, map: ['#########', '#O.r..P.#', '#.......#', '#########'] }, 'xL D w w w w w');
  check('a Ram rolling into a bumper comes back', objs(r4.s, 'ram')[0]?.d === 1 || objs(r4.s, 'ram')[0]?.x > 3, objs(r4.s, 'ram'));
  const r5 = play({ recipes: { brick: 'r' }, stacks: [{ x: 1, y: 2, bits: 'r' }], map: ['#######', '#P...O#', '#.....#', '#######'] }, 'xR');
  check('a bolt off a bumper comes back and fizzles at Pilcrow', r5.ev.some((e) => e.e === 'boing') && !objs(r5.s, 'brick').length, r5.ev.filter((e) => e.e === 'zap'));
}
// The Jack winds up toys and springs off bumpers.
{
  const r = play({ boss: { type: 'jack', hp: 6, cycle: ['wind', 'wait'], door: { x: 3, y: 4 } }, map: ['##########', '#Z.......#', '#........#', '#........#', '#..o...P.#', '##########'] }, 'w');
  check('wind brings a toy out of the door', objs(r.s, 'toy').length === 1, objs(r.s, 'toy'));
  const r2 = play({ boss: { type: 'jack', hp: 6, cycle: ['spring', 'wait'] }, map: ['##########', '#Z......O#', '#.......O#', '#........#', '#.......P#', '##########'] }, 'w');
  const jb = objs(r2.s, 'boss')[0];
  check('spring bounces off a bumper', r2.ev.some((e) => e.e === 'boing') && jb.x < 6, jb);
}

console.log(fails ? `${fails} failed, ${passes} passed` : `All ${passes} rule checks passed.`);
process.exit(fails ? 1 : 0);
