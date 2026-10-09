// Region 9 of the ring: the Gate Ring round the foot of the Apex, and its four gates.
import { field, flag, say } from '../game/api';
import { defMap, defScript, MAPS, SPAWNS } from '../game/world';
import { kinds, look } from './areakit';

const open = (g: string) => () => !!flag(g);
const shut = (x: number, y: number, g: string) => ({ ...look(x, y, 'Shut. The bar is on the far side.'), when: () => !flag(g) });

defMap({
  id: 'gatering', name: 'The Gate Ring', region: 43, music: 'gatering', apexTile: [24, 24],
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTT#j#TTTTTTTTTTTTTTTTTTTTTT',
    '~~TTTTTTTTTTTTTTTTTTTTT.=.TTTTTTTTTTTTTTTTTTTT~~',
    'T~~TTTTTTTTTTTTTTTTTTTT.=.TTTTTTTTTTTTTTTTTTT~~T',
    'TT~~TTTTTTTTTTTTTTTTTTT.=.TTTTTTTTTTTTTTTTTT~~TT',
    'TTT~~TTTTTTTTTTTTTTTTTT.=.TTTTTTTTTTTTTTTTT~~TTT',
    'TTTT~~TTTTTTTTTTTTTTTTT.=.TTTTTTTTTTTTTTTT~~TTTT',
    'TTTTT~~TTTTTTTTTTTTTTTT.=.TTTTTTTTTTTTTTT~~TTTTT',
    'TTTTTT~~TTTTTTTTTTTTTTT.=.TTTTTTTTTTTTTT~~TTTTTT',
    'TTTTTTT~~TTTTTTTTTTTTT,.=.TTTTTTTTTTTTT~~TTTTTTT',
    'TTTTTTTT~~TTTTTTTT,,,,,.=.....TTTTTTTT~~TTTTTTTT',
    'TTTTTTTTT~~TTTTT.,,,,,====......TTTTT~~TTTTTTTTT',
    'TTTTTTTTTT~~TTT...============..,TTT~~TTTTTTTTTT',
    'TTTTTTTTTTT~~....===........===.,,,~~TTTTTTTTTTT',
    'TTTTTTTTTTTT::.===,,...TT...,,===,::TTTTTTTTTTTT',
    'TTTTTTTTTTTT.::=.,,TTTTTTTTTT,,,=::,TTTTTTTTTTTT',
    'TTTTTTTTTTT..=::.,TT........TT,.::=,,TTTTTTTTTTT',
    'TTTTTTTTTT...=.::T.....##.....T::.=...TTTTTTTTTT',
    'TTTTTTTTTT,.==..~:..########..:~..==..TTTTTTTTTT',
    'TTTTTTTTT,,==..T.:~##########~:.T..==..TTTTTTTTT',
    'TTTTTTTTT,,==.TT..############..TT.==..TTTTTTTTT',
    'TTTTTTTTT,,=..T..##############..T..=..TTTTTTTTT',
    'TTTTTTTTT,,=..T..##############..T..=..TTTTTTTTT',
    'TTTTTTTT,,==,,T..##############..T,,==..TTTTTTTT',
    '#.........==,TT.################.TT,==.........#',
    'j===========,TT.################.TT,===========j',
    '#.........==,,T..##############..T,,==.........#',
    'TTTTTTTTT..=..T..##############..T..=,,TTTTTTTTT',
    'TTTTTTTTT..=..T..##############..T..=,,TTTTTTTTT',
    'TTTTTTTTT..==.TT..############..TT.==,,TTTTTTTTT',
    'TTTTTTTTT..==..T.:~##########~:.T..==,,TTTTTTTTT',
    'TTTTTTTTTT..==..~:..########..:~..==.,TTTTTTTTTT',
    'TTTTTTTTTT...=.::T.....##.....T::.=...TTTTTTTTTT',
    'TTTTTTTTTTT,,=::.,TT........TT,.::=..TTTTTTTTTTT',
    'TTTTTTTTTTTT,::=,,,TTTTTTTTTT,,.=::.TTTTTTTTTTTT',
    'TTTTTTTTTTTT::,===,,...TT...,,===.::TTTTTTTTTTTT',
    'TTTTTTTTTTT~~,,,.===........===....~~TTTTTTTTTTT',
    'TTTTTTTTTT~~TTT,..============...TTT~~TTTTTTTTTT',
    'TTTTTTTTT~~TTTTT......====,,,,,.TTTTT~~TTTTTTTTT',
    'TTTTTTTT~~TTTTTTTT......=.,,,,TTTTTTTT~~TTTTTTTT',
    'TTTTTTT~~TTTTTTTTTTTTT..=.TTTTTTTTTTTTT~~TTTTTTT',
    'TTTTTT~~TTTTTTTTTTTTTTT.=.TTTTTTTTTTTTTT~~TTTTTT',
    'TTTTT~~TTTTTTTTTTTTTTTT.=.TTTTTTTTTTTTTTT~~TTTTT',
    'TTTT~~TTTTTTTTTTTTTTTTT.=.TTTTTTTTTTTTTTTT~~TTTT',
    'TTT~~TTTTTTTTTTTTTTTTTT.=.TTTTTTTTTTTTTTTTT~~TTT',
    'TT~~TTTTTTTTTTTTTTTTTTT.=.TTTTTTTTTTTTTTTTTT~~TT',
    'T~~TTTTTTTTTTTTTTTTTTTT.=.TTTTTTTTTTTTTTTTTTT~~T',
    '~~TTTTTTTTTTTTTTTTTTTTT.=.TTTTTTTTTTTTTTTTTTTT~~',
    'TTTTTTTTTTTTTTTTTTTTTTT#j#TTTTTTTTTTTTTTTTTTTTTT',
  ],
  mods: [
    { x: 24, y: 0, ch: '=', when: open('gate_n') }, { x: 24, y: 47, ch: '=', when: open('gate_s') },
    { x: 0, y: 24, ch: '=', when: open('gate_w') }, { x: 47, y: 24, ch: '=', when: open('gate_e') },
  ],
  warps: [
    { x: 24, y: 0, to: 'route5', tx: 24, ty: 28, dir: 2, when: open('gate_n') },
    { x: 24, y: 47, to: 'brookwood', tx: 14, ty: 1, dir: 0, when: open('gate_s') },
    { x: 0, y: 24, to: 'shoutwood', tx: 38, ty: 20, dir: 3, when: open('gate_w') },
    { x: 47, y: 24, to: 'moonwater', tx: 1, ty: 14, dir: 1, when: open('gate_e') },
  ],
  zone: { kinds: kinds([['strix', 3], ['hemlock', 2], ['thicket', 2], ['umbra', 1], ['mycel', 2], ['peat', 2]]), lv: [30, 36], n: 14, area: 'deep wood' },
  npcs: [{ id: 'ringwalker', x: 31, y: 11, sprite: 'elder', name: 'Ring-walker', dir: 3, wander: true, talk: 'ringwalker' }],
  spots: [
    shut(24, 0, 'gate_n'), shut(24, 47, 'gate_s'), shut(0, 24, 'gate_w'), shut(47, 24, 'gate_e'),
    look(24, 16, 'The Apex goes straight up out of the wood. Nothing climbs it from this side.'),
    look(18, 18, 'A spring comes up at the foot of the Apex and runs off downhill.'),
  ],
});
SPAWNS.gatering = [24, 11];

// The ring-walker starts every line with the lap he is on.
defScript('ringwalker', async () => {
  const lap = 402 + (field.mapSteps % 7);
  await say('Ring-walker', `Lap ${lap}. Every gate opens from the outside. You came in, so you know that.`);
  await say('Ring-walker', `Lap ${lap}, still. Four springs. Every stream in the Volute starts at one of them.`);
});

// After the credits, two kinds from every region's road walk the ring, stronger.
const POST_KINDS = ['route1', 'route2', 'route3', 'route4', 'route5', 'route6', 'route7', 'route8'];
const quiet = MAPS.gatering.zone!;
field.loadHooks.push(f => {
  if (f.map.id !== 'gatering') return;
  if (!flag('postgame')) { f.map.zone = quiet; return; }
  const ks = POST_KINDS.flatMap(id => (MAPS[id]?.zone?.kinds || []).slice(0, 2)).map(([k]) => [k, 1] as [string, number]);
  f.map.zone = { ...quiet, kinds: ks, lv: [50, 58] };
});

// Each outer gate leads in once its gatekeeper has read the letter.
MAPS.route5.warps.push({ x: 24, y: 29, to: 'gatering', tx: 24, ty: 1, dir: 0, when: open('gate_n') });
MAPS.brookwood.warps.push({ x: 14, y: 0, to: 'gatering', tx: 24, ty: 46, dir: 2, when: open('gate_s') });
MAPS.shoutwood.warps.push({ x: 39, y: 20, to: 'gatering', tx: 1, ty: 24, dir: 1, when: open('gate_w') });
MAPS.moonwater.warps.push({ x: 0, y: 14, to: 'gatering', tx: 46, ty: 24, dir: 3, when: open('gate_e') });
