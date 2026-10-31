import { defMap, defScript, SCRIPTS } from '../game/world';
import { G, flag, setFlag } from '../game/state';
import { battle } from '../game/battleView';
import { act, cart, choose, emote, evening, face, faceToward, fadeWho, field, fightTrainer, fightWild, giveKey, giveMon, givePegs, giveScale, goal, hint, lines, mon, moveNpc, notice, offstage, pan, panBack, prop, say, shake, sound, tannery, tint, unprop, wait, walkIn, walkOff, walkTo, walkUp } from '../game/api';
import { PEOPLE } from '../engine/sprites';
import { giveKeyItem } from './ring';
import { look, stash } from './areakit';
import { sfx } from '../engine/audio';
import { music } from '../engine/music';
import { makeMon } from '../data/species';
import { countTack, tackLosesLine, tackTries, tackWinsLine } from './tack';

const has = (s: string) => G.scales.includes(s);

// ---------------------------------------------------------------- maps

defMap({
  id: 'home', name: 'Gran\'s kitchen', region: 11, indoor: true, music: 'home',
  rows: [
    '##########',
    '#________#',
    '#__cc____#',
    '#__cc____#',
    '#________#',
    '#________#',
    '#________#',
    '####dd####',
  ],
  warps: [{ x: 4, y: 7, to: 'fellside', tx: 10, ty: 6, dir: 0 }, { x: 5, y: 7, to: 'fellside', tx: 10, ty: 6, dir: 0 }],
  npcs: [
    { id: 'gran', x: 2, y: 4, sprite: 'gran', name: 'Gran', talk: 'gran', dir: 1 },
    { id: 'smallgran', x: 7, y: 2, sprite: 'smallgran', name: 'Small Gran', talk: 'smallgran', dir: 3 },
  ],
  props: [{ x: 6, y: 0, pic: 'homeFlag' }],
  spots: [{ x: 6, y: 0, script: async () => { await emote('ouro', 'heart'); } }],
  enter: 'homeEnter',
});

defMap({
  id: 'fellside', name: 'Turnstone', region: 0, music: 'fellside', oldShells: true,
  rows: [
    'TTTTTTTTTTTTT=TTTTTTTTTTTTTTTTTTTTTTTT~~TTTT',
    'T............=..................g...ii~~TTTT',
    'T............=..............,,,,,,,...~~TTTT',
    'T.rrr.rrrrrr.=.rrrrrr.rrr..,,,,,,,,,..~~TTTT',
    'T.rrr.rrrrrr.=.rrrrrr.rrr..,,,,,,,,,..~~TTTT',
    'T.hhh.hhhhdh.=.hhdhhh.hhh.,,,,,,,,,,,i~~TTTT',
    'T.....===================..,,,,,,,,,.i~~TTTT',
    'T............=.............,,,,,,,,,i.~~TTTT',
    'T............=..............,,,,,,,.i.~~TTTT',
    'T.ffffffff...=.................,...g..~~TTTT',
    'T.f......f...=================gi......~~TTTT',
    'T.f......f....=================.......~~TTTT',
    'T.f......f....=================......i~~TTTT',
    'T.f......f....====w============......i~~TTTT',
    'T.fff=ffff....=================......i~~TTTT',
    'T.............============================f=',
    '===============================.......~~TTTT',
    'T.............=================.......~~TTTT',
    'Tirrrrrrrrrr..g===============g.......~~TTTT',
    'T.rrrrrrrrrr.rrrrrr.rrr.=.rrrrrr.rrr..~~TTTT',
    'T.rrrrrrrrrr`rrrrrr.rrr.=.rrrrrr.rrr..~~TTTT',
    'T`hhhhdhhhhh`hhdhhh.hhh.=.hhdhhh.hhh..~~TTTT',
    'T.==================================..~~TTTT',
    'T..`....................=...........i.~~TTTT',
    'T....................g.g=...........ii~~TTTT',
    'T..rrrrrr.rrrr..........=..rrrrrr.rrr.~~TTTT',
    'T..rrrrrr.rrrr..........=..rrrrrr.rrr.~~TTTT',
    'T..hhdhhh.hhqh..........=..hhdhhh.hhh.~~TTTT',
    'T.===================================.~~TTTT',
    'T....g..,,,,,.....g.....=....g.,,,g.i.~~TTTT',
    'T...,,,,,,,,,,,,,....gg.=....,,,,,,,..~~TTTT',
    'T..,,,,,,,,,,,,,,,...g..=...,,,,,,,,i.~~TTTT',
    'T...,,,,,,,,,,,,,g....g.=.g..,,,,,,,.i~~TTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTT=TTTTTTTTTTTTT~~TTTT',
  ],
  mods: [
    // The craze runs across the meadow to the northeast and ends in a hole.
    { x: 27, y: 9, w: 3, ch: 'Z', when: () => !!flag('slipday') },
    { x: 29, y: 8, w: 3, ch: 'Z', when: () => !!flag('slipday') },
    { x: 31, y: 7, w: 2, ch: 'Z', when: () => !!flag('slipday') },
    { x: 32, y: 6, w: 2, ch: 'Z', when: () => !!flag('slipday') },
    { x: 33, y: 5, w: 2, ch: 'Z', when: () => !!flag('slipday') },
    { x: 34, y: 4, w: 2, ch: 'Z', when: () => !!flag('slipday') },
    { x: 7, y: 6, w: 3, ch: 'Z', when: () => !!flag('stayed') },
  ],
  warps: [
    { x: 10, y: 5, to: 'home', tx: 4, ty: 6, dir: 2 },
    { x: 6, y: 21, to: 'fellmonger', tx: 4, ty: 6, dir: 2 },
    { x: 17, y: 5, to: 'tackhouse', tx: 4, ty: 6, dir: 2 },
    { x: 15, y: 21, to: 'shellhouse', tx: 4, ty: 6, dir: 2 },
    { x: 12, y: 27, to: 'oldshell', tx: 4, ty: 6, dir: 2 },
    { x: 0, y: 16, to: 'route1', tx: 54, ty: 7, dir: 3, when: () => !!flag('starter') },
    { x: 13, y: 0, to: 'brookwood', tx: 13, ty: 34, dir: 2, when: () => !!flag('starter') },
    { x: 24, y: 33, to: 'cocklecove', tx: 20, ty: 1, dir: 0, when: () => !!flag('starter') },
  ],
  zone: { kinds: [['cairn', 3], ['hare', 3], ['puffball', 2], ['burr', 3], ['paring', 2]], lv: [1, 2], n: 7, area: 'meadow' },
  tileTalk: { w: 'well', d: 'shutDoor' },
  // The Strandmonger's shop, the widest house in the village: a signboard on the eave, awnings over two shop windows,
  // lanterns at both corners, a crate by the side wall, and a barrel across the road.
  props: [
    { x: 5, y: 20, pic: 'shopSign' },
    { x: 2, y: 21, pic: 'shopfront' },
    { x: 8, y: 21, pic: 'shopfront' },
    { x: 1, y: 21, pic: 'lantern' },
    { x: 12, y: 21, pic: 'lantern' },
    { x: 3, y: 23, pic: 'barrel' },
    { x: 12, y: 20, pic: 'crate' },
  ],
  npcs: [
    { id: 'tack', x: 23, y: 13, sprite: 'tack', name: 'Tack', when: () => !flag('slipday'), talk: 'tackTalk' },
    { id: 'tackle', x: 23, y: 13, sprite: 'tack', mon: 'tackle', name: 'Tackle', when: () => !!flag('tackleOut') && !flag('slipday'), lines: ['Tackle meets Ouro\'s gaze. Ouro holds it. Neither looks away.'] },
    { id: 'tackmum', x: 21, y: 12, sprite: 'villager', name: 'Tack\'s mum', when: () => !flag('crowdGone'), lines: ['Stop scratching, Tack. He\'s already in the square.'] },
    { id: 'oldman', x: 17, y: 11, sprite: 'elder', name: 'Old man', lines: () => flag('slipday') ? ['Your gran? She walked the entire Rim during a drought. Got home missing a boot and wouldn\'t say how.'] : ['Big day! Stand still, that\'s the trick. I didn\'t, and mine shed in a hedge.'] },
    // The old man's own first shell, pale, standing at his side as it has since he turned.
    { id: 'oldcast', x: 16, y: 11, sprite: 'elder', name: 'Old man\'s cast', dir: 1, img: () => PEOPLE.oldcast, talk: 'oldCast' },
    // Gran comes out to the craze on Turning Day.
    { id: 'granout', x: 10, y: 6, sprite: 'gran', name: 'Gran', movable: true, when: () => !!flag('granOut') },
    { id: 'woman1', x: 34, y: 23, sprite: 'villager', name: 'Woman', lines: ['The house shed in spring. We moved into the hollow shell.', 'The new one\'s off being a house somewhere else.'] },
    { id: 'child', x: 25, y: 17, sprite: 'child', name: 'Child', wander: true, lines: ['Not my turn yet. Might be a while. I\'m practicing standing still already.'] },
    { id: 'wellman', x: 17, y: 13, sprite: 'villager2', name: 'Man at the well', dir: 1, lines: () => flag('wellingGone') && !flag('wellingHome') ? ['I let the bucket go all the way down, and she sends me up dust.', 'I\'m waiting for her. However long it takes. She\'d wait for me.'] : ['She\'s been down since the fracture. Wells drop when they\'re scared. Everyone knows that.'] },
    { id: 'signw', x: 1, y: 15, sprite: 'sign', name: null as any, lines: ['Signpost: The Midden Road. Rib is to the west, along the dunes.', 'Please refrain from licking the post.'] },
    { id: 'signe', x: 36, y: 14, sprite: 'sign', name: null as any, lines: ['East: Fall. A long way round. Painted by someone who\'s never been.'] },
    { id: 'signn', x: 12, y: 1, sprite: 'sign', name: null as any, lines: ['North: the Brook Wood. Watch the brook. It watches you back.'] },
    { id: 'signs', x: 25, y: 32, sprite: 'sign', name: null as any, lines: ['South: Cockle Cove. Shells are free. The sea is not for sale.'] },
    { id: 'signshop', x: 1, y: 22, sprite: 'sign', name: null as any, lines: ['THE STRANDMONGER. Strays, horns, the Register. Looking is free.', 'Leaning on the sign costs one cowrie.'] },
    { id: 'carter', x: 7, y: 11, sprite: 'villager2', name: 'Carter', dir: 0, talk: 'carter' },
    { id: 'crowd1', x: 19, y: 16, sprite: 'villager', when: () => !flag('crowdGone') },
    { id: 'crowd2', x: 27, y: 15, sprite: 'villager2', when: () => !flag('crowdGone') },
    { id: 'crowd3', x: 21, y: 11, sprite: 'child', when: () => !flag('crowdGone') },
    { id: 'tackwait', x: 3, y: 16, sprite: 'tack', name: 'Tack', when: () => !!flag('starter') && !flag('tack1') },
  ],
  triggers: [
    { x: 8, y: 15, w: 1, h: 3, script: 'tack1', when: () => !!flag('starter') && !flag('tack1') },
    // Before Ouro has a whorl, someone turns Ouro back at each way out of town and at the craze hole.
    { x: 0, y: 15, w: 2, h: 3, script: 'turnBackWest', when: () => !!flag('slipday') && !flag('starter') },
    { x: 13, y: 0, w: 1, h: 2, script: 'turnBackNorth', when: () => !!flag('slipday') && !flag('starter') },
    { x: 24, y: 32, w: 1, h: 2, script: 'turnBackSouth', when: () => !!flag('slipday') && !flag('starter') },
    { x: 36, y: 3, w: 1, h: 1, script: 'crazeHole', when: () => !!flag('slipday') && !flag('starter') },
  ],
  enter: 'fellsideEnter',
});

defMap({
  id: 'fellmonger', name: 'The Strandmonger\'s', region: 11, indoor: true, music: 'home',
  rows: [
    '##########',
    '#p_p_p_p_#',
    '#________#',
    '#cccc____#',
    '#________#',
    '#________#',
    '#________#',
    '####d#####',
  ],
  warps: [{ x: 4, y: 7, to: 'fellside', tx: 6, ty: 22, dir: 0 }],
  npcs: [{ id: 'fm', blocks: true, x: 2, y: 2, sprite: 'fellmonger', name: 'Strandmonger', talk: 'fellmonger' }],
});

defMap({
  id: 'route1', name: 'The Midden Road', region: 0, music: 'route',
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT~~TTTTTTTTTTTTTTTTTTTTT',
    'T....,,,...i.i..i...i...i.i...i..~~..,,,,,.............T',
    'T..,xxx,,,.i;i..i..,i...i,i...i..~~,,~~~~~,,,.....x%x..T',
    'T.,,x%x,,,,.....i.,,ii.ii,i...i..~~,,~~~~~,,,,....xxx..T',
    'T..,,,,,,,......i..,,,.,,,i...i..~~,,,,,,,,,,..........T',
    'T....,,,........i....,,,..i...i..~~..,,,,,.............T',
    'T................................~~....................T',
    '========================================================',
    'T.....;;;;;;;;;;;;;;;;;;;;;;;;;;;~~;;;;;;;;;;;;;;;.....T',
    'T======================================================T',
    'Tssssssssssssssssssssssssssssssss::sssssssssssssssssssss',
    'Tsssssssxsssssssssssssxxsssssss:::::::::sxsxsssssssssssT',
    'Tssssssssssss,,,sssssssssssssss:::::::::sssxs,,,ssssxssT',
    'T::::sssss,,,,,,,,,sssxssssssss:::::::::sx,,,,,,,,,ssssT',
    'T::::ssss,,,,,,,,,,,sssssssssss:::::::::s,,,,,,,,,,,sssT',
    ':s:::sssss,,,,,,,,,ssssssssssss:::::ss::ss,,,,,,,,,ssssT',
    'T::::ssssssss,,,sssssssssssssss:::::ss::sssss,,,sssssssT',
    'T::::ssssssssssssssssssssssssss:::::::::sssssssssssssssT',
    'Tssssss~ssssss~ssssss~ssssss~ss:::::::::ss~ssssss~sssssT',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~T',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  warps: [
    { x: 55, y: 7, to: 'fellside', tx: 1, ty: 16, dir: 1 },
    { x: 55, y: 10, to: 'cocklecove', tx: 1, ty: 14, dir: 1 },
    { x: 0, y: 7, to: 'rib', tx: 42, ty: 16, dir: 3 },
    { x: 0, y: 15, to: 'knucklebones', tx: 38, ty: 15, dir: 3 },
  ],
  zone: { kinds: [['cairn', 3], ['hare', 3], ['puffball', 2], ['paring', 2], ['burr', 3], ['stoat', 1]], lv: [2, 3], n: 13, area: 'reeds' },
  npcs: [
    { id: 'drover', x: 16, y: 6, sprite: 'villager2', name: 'Drover', dir: 0, trainer: { name: 'Drover', team: [['hare', 3], ['cairn', 3]], intro: 'These four haul carts all day long. I\'m starting to think they deserve a change of pace. You\'re it.', defeat: 'Oh, great. Now they\'re going to demand a snack.', sight: 3 } },
    { id: 'scraper', x: 30, y: 6, sprite: 'tanner', name: 'Scraper', dir: 0, trainer: { nacre: 1, name: 'Scraper', team: [['burr', 3], ['stoat', 3]], intro: 'I scour shells for the grotto. I\'m the finest polisher around. I\'m just taking a look at yours.', defeat: 'Alright, alright! I\'ll go back to the ones that actually stay put.', sight: 3 } },
    { id: 'netgirl', x: 26, y: 6, sprite: 'child', name: 'Girl with a net', dir: 0, trainer: { name: 'Girl with a net', team: [['hare', 3], ['paring', 3]], intro: 'I caught a hare\'s cast! The real hare is still out there, though. It\'s much faster than this.', defeat: 'The hare would\'ve won :-(', sight: 3 } },
    { id: 'peeler1', x: 44, y: 7, sprite: 'peeler', name: 'Hermit', dir: 1, when: () => !flag('peelers') },
    { id: 'peeler2', x: 45, y: 6, sprite: 'peeler', name: 'Hermit', dir: 1, when: () => !flag('peelers') },
    { id: 'wellingRoad', x: 43, y: 7, sprite: 'stone', mon: 'welling', name: 'Kaivodo', when: () => !flag('peelers') },
    // The man from Turnstone's well, only while he chases the Hermits.
    { id: 'wellchase', x: 49, y: 7, sprite: 'villager2', name: 'Man at the well', movable: true, when: () => !!flag('wellChase') },
    { id: 'wellingReeds', x: 39, y: 4, sprite: 'stone', mon: 'welling', name: 'Kaivodo', when: () => !!flag('peelers') && !flag('wellingCaught') && !flag('wellingHome'), talk: 'wellingReeds' },
    { id: 'r1sleeper', x: 22, y: 4, sprite: 'stone', mon: 'cairn', name: 'Kivishi', sleeper: { kind: 'cairn', lv: 8, flag: 'sl_route1' } },
  ],
  spots: [
    stash('r1_dune', 22, 1, 'In the hollow behind the sleeping cairn, someone hid a triton horn and then forgot about it.', { pegs: ['bone', 1] }),
    stash('r1_spit', 36, 15, 'Half-buried on the sand spit, a wax seal still holds the sun\'s warmth.', { notion: 'waxseal' }),
    look(12, 0, 'A bank of sand and roots. People slide down it from the woods above most days.'),
  ],
  triggers: [{ x: 47, y: 1, w: 2, h: 10, script: 'peelers', when: () => !flag('peelers') }],
});

defMap({
  id: 'rib', name: 'Rib', region: 1, music: 'town', oldShells: true,
  rows: [
    'TTTTTTTTTTTTTTTTTTTTT=TTTTTTTTTTTTTTTTTTTTTT',
    'TTT..................=.....................T',
    'TTT..rrrrr..rrr......=...rrrrrr.rrr........T',
    'TTT..rrrrr..rrr......=...rrrrrr.rrr........T',
    '==T..hhdhh..hhh......=...hhhdhh.hhh........T',
    'T=T..................=.....................T',
    'T=T.uuuu..uuuuuuuuuuu=.uuuuuuuuuuu..uuuu...T',
    'T=T..................=.....................T',
    'T=T..................BB....................T',
    'T=T..rrr.............BB...rrrrr.....rrr....T',
    'T=T..rrr....ccc......BB...rrrrr.....rrr....T',
    'T=T..hhh............bBBb..hhdhh.....hhh....T',
    'T=T.................bBBb...................T',
    'T=T.uuuu..uuuuuuuuuuuquuuuuuuuuuuu..uuuu...T',
    'T=T..................=.....................T',
    'T=T..................=.....................T',
    '============================================',
    'TTT..................=.....................T',
    'TTT..................=.....................T',
    'TTT..................=.....................T',
    'TTT.uuuu..uuuuuuuuuuu=.uuuuuuuuuuu..uuuu...T',
    'TTT..................=.....................T',
    'TTT........rrrrr.rrr.=.........rrrrrr.rrr..T',
    'TTT.fff.fffrrrrr.rrr.=.........rrrrrr.rrr..T',
    'TTT.fx.xx.fhhdhh.hhh.=.........hhdhhh.hhh..T',
    'TTT.f.xx..f..........=.....................T',
    'TTT.fffffff,.........=....,......,......,..T',
    'TTT...........,,....,=........,...,.....,..T',
    'TssssssssssssssssssssssssssssssssssssssssssT',
    'TssssssssssssssssssssssssssssssssssssssssssT',
    'TssssssssssssssssssssssssssssssssssssssssssT',
    'TTTTTTTTTTTTTTTTTTTTT=TTTTTTTTTTTTTTTTTTTTTT',
  ],
  warps: [
    { x: 21, y: 13, to: 'ribgym', tx: 7, ty: 12, dir: 2 },
    { x: 7, y: 4, to: 'ribhouse', tx: 4, ty: 6, dir: 2 },
    { x: 28, y: 4, to: 'carverhouse', tx: 4, ty: 6, dir: 2 },
    { x: 43, y: 16, to: 'route1', tx: 1, ty: 7, dir: 1 },
    { x: 21, y: 0, to: 'brookwood', tx: 1, ty: 14, dir: 1 },
    { x: 21, y: 31, to: 'knucklebones', tx: 20, ty: 1, dir: 0 },
    { x: 0, y: 16, to: 'route2', tx: 54, ty: 12, dir: 3, when: () => has('rib') },
    { x: 0, y: 4, to: 'highwater', tx: 46, ty: 10, dir: 3, when: () => has('rib') },
  ],
  tileTalk: { B: 'ribStay', d: 'shutDoor' },
  npcs: [
    { id: 'tanner', x: 13, y: 9, sprite: 'tanner', name: 'Shellwright', talk: 'ribTannery' },
    { id: 'r1', x: 19, y: 9, sprite: 'villager', name: 'Woman', lines: ['The best place to dry off is right up by the Seal, tucked between the ribs.', 'I beat everyone here today!'] },
    { id: 'r2', x: 25, y: 15, sprite: 'villager2', name: 'Man', lines: ['It\'s a giant\'s rib, actually. Nobody ever found the rest of him. I kind of hope he\'s alright.'] },
    { id: 'r3', x: 17, y: 17, sprite: 'boy', name: 'Boy', wander: true, lines: ['Press your ear against the Rib and you can hear the Volute! Go on, do it! Did you hear it?'] },
    { id: 'r4', x: 14, y: 25, sprite: 'oldwoman', name: 'Old woman', lines: ['My cast is up on the porch while I\'m down here in the yard. We wave at each other all day :-]'] },
    { id: 'ribguard', x: 2, y: 16, sprite: 'keeper', name: 'Ribman', when: () => !has('rib'), lines: ['Dry Sea is to the west. High-water Mark is up the slope.', 'Knuckle won\'t let you near either without a pearl.'] },
  ],
});

defMap({
  id: 'ribgym', name: 'Inside the Rib', region: 1, indoor: true, music: 'gym',
  rows: [
    '################',
    '#______________#',
    '#u_u_u____u_u_u#',
    '#______________#',
    '#uuuuuu__uuuuuu#',
    '#______________#',
    '#_u_u_u__u_u_u_#',
    '#______________#',
    '#uuuuu____uuuuu#',
    '#______________#',
    '#______________#',
    '#______________#',
    '#______________#',
    '#######dd#######',
  ],
  warps: [{ x: 7, y: 13, to: 'rib', tx: 21, ty: 14, dir: 0 }, { x: 8, y: 13, to: 'rib', tx: 21, ty: 14, dir: 0 }],
  npcs: [
    { id: 'knuckle', x: 7, y: 1, sprite: 'knuckle', name: 'Knuckle', talk: 'knuckle' },
    { id: 'help1', x: 8, y: 9, sprite: 'villager', name: 'Helper', dir: 3, trainer: { name: 'Helper', team: [['cairn', 4], ['scree', 4]], intro: 'Knuckle\'s advice is to switch when it gets bad. I don\'t. I\'m loyal.', defeat: 'Right, I should\'ve switched.', sight: 4 } },
    { id: 'help2', x: 7, y: 5, sprite: 'villager2', name: 'Helper', dir: 0, trainer: { nacre: 1, name: 'Helper', team: [['hare', 4], ['paring', 4], ['burr', 4]], intro: 'Only one of yours gets to fight at a time. The rest just sit and watch, like my brothers at dinner.', defeat: 'Ugh. Watching.', sight: 3 } },
  ],
});

// ---------------------------------------------------------------- scripts

export const SMALL_GRAN = ['Is it time?', 'Mum says not to scratch.', 'I can feel it beginning.', 'Don\'t look. Not yet.', 'There. It\'s happening.'];
export async function smallGranLine(): Promise<void> {
  const k = flag('sg') % 5;
  setFlag('sg', flag('sg') + 1);
  await say('Small Gran', SMALL_GRAN[k]);
}

defScript('smallgran', smallGranLine);

defScript('intro', async () => {
  await wait(30);
  face('gran', 1);
  await smallGranLine();
  await say('Gran', 'Tell my little turnip it\'s Shedding Day. The biggest day of all.');
  await say('Gran', 'Tell them to stand in the square and wait until their shell falls off.');
  const c = await choose(['Head to the square', 'Eat first']);
  if (c === 1) {
    await say('Gran', 'Let them know there\'s porridge, specifically the leftovers from yesterday.');
    face('ouro', 2);
    await wait(40);
    sfx('heal');
    await emote('ouro', 'heart');
  }
  setFlag('morning');
  goal('Go to the square.');
});

defScript('homeEnter', async () => {
  if (flag('slipday') && !flag('night')) await nightScene();
});

defScript('gran', async () => {
  if (!flag('slipday')) { await say('Gran', 'Let my little turnip know the square is that way, where I\'m pointing.'); return; }
  if (!flag('starter')) { await say('Gran', 'Let my little turnip know the Strandmonger opens at eight. Head south, past the square.'); return; }
  if (!has('rib')) { await say('Gran', 'Let them know the road is dry this time of year, and dustier than you\'d believe.'); return; }
  if (flag('ch5done') && !flag('granNeck')) { await granNeck(); return; }
  await say('Gran', 'Let them know there\'s a bowl waiting, in case they get hungry.');
});

async function nightScene(): Promise<void> {
  await smallGranLine();
  await say('Gran', 'Let my little turnip know their shell didn\'t come off today, which makes them a late bloomer.');
  await say('Gran', 'Let them know late bloomers walk the Rim, the edge of the world, from one Seal to the next.');
  await say('Gran', 'The shell eventually comes off somewhere along the way.');
  await say('Gran', 'Let them know the Seals are the great posts that keep the world sealed shut.');
  await say('Gran', 'That crack in the village means they\'re pulling too tight.');
  await say('Gran', 'Tell the Sealkeepers. Rib is first, heading west along the Midden Road.');
  await say('Gran', 'Let them know most people keep their own shed shell as their first Whorl.');
  await say('Gran', 'Since theirs is still on, they\'ll need another one.');
  await say('Gran', 'Let them know the Strandmonger takes in strays. No specific breeding.');
  await say('Gran', 'Let them know I walked the Rim myself, and came home with a pearl and a cough.');
  const c = await choose(['Walk the Rim', 'Stay home']);
  if (c === 1) {
    await say('Gran', 'Tell them: soup.');
    // Night, then morning. The craze reaches Gran's step in the night.
    await tint('#0b0a10', 1, 40);
    await wait(50);
    setFlag('stayed');
    evening(false);
    sfx('boom');
    field.shakeT = 20;
    await tint('#0b0a10', 0, 40);
    await say('Gran', 'Tell my little turnip that the fracture has arrived at the doorstep.');
  }
  await say('Gran', 'Tell them the Strandmonger opens at eight. South of the square, under the lanterns.');
  setFlag('night');
  evening(false);
  goal('See the Strandmonger, south of the square.');
}

async function granNeck(): Promise<void> {
  setFlag('granNeck');
  await smallGranLine();
  await say('Gran', 'Tell my little turnip to take a seat.');
  await say('Gran', 'Tell them I can see the crack down their back from here.');
  await say('Gran', 'Tell them mine started at the neck, too.');
  await say('Gran', 'Tell them there is soup, and soup comes before going north.');
}

defScript('fellsideEnter', async () => {
  G.flags.visited_fellside = 1;
  if (flag('morning') && !flag('slipday')) { await slipDay(); return; }
  if (flag('slipday') && !flag('night')) evening(true);
  else evening(false);
});

/** The craze's tiles in the order it runs, from the square's edge out to the hole in the meadow. */
const CRAZE: [number, number][] = [[27, 9], [28, 9], [29, 9], [29, 8], [30, 8], [31, 8], [31, 7], [32, 7], [32, 6], [33, 6], [33, 5], [34, 5], [34, 4], [35, 4]];

async function slipDay(): Promise<void> {
  // Ouro walks from Gran's door to the square, where the year's two wait in the middle with everyone round the edge.
  await wait(20);
  await walkTo('ouro', 23, 15);
  face('ouro', 2);
  faceToward('tack', 'ouro');
  await wait(20);
  await say('Tack', 'That\'s 2 of us this year. just you and me. That\'s the whole count.');
  await say('Tack', 'Uh, take 1 step over? It\'s going to come off at an angle.');
  await walkTo('ouro', 22, 15);
  face('ouro', 2);
  face('tack', 0);
  faceToward('tackmum', 'tack');
  await say('Tack\'s mum', 'Don\'t scratch, Tack.');
  await act('tack', 'shiver');
  await say('Tack', 'Mum. I haven\'t scratched for 3 days.');
  await wait(30);
  // Tackle lifts up off Tack's back in one piece, pale, and steps aside.
  sfx('fit');
  await act('tack', 'shiver');
  setFlag('tackleOut');
  field.flashT = 14;
  await Promise.all([fadeWho('tackle', true, 30), act('tackle', 'lift')]);
  await walkTo('tackle', 24, 13);
  face('tackle', 0);
  faceToward('tackmum', 'tackle');
  await say('Tack\'s mum', 'There it is, pet. Your first shell, intact. It even has your shape.');
  await say('Tack\'s mum', 'Every Whorl is a shell something grew out of. Rivers, houses, people. Yours follows you home.');
  await act('tack', 'hop');
  await say('Tack', '1. Right, that\'s 1.');
  await say('Tack', 'Name\'s Tackle. Had it ready 4 years ago. Took you long enough.');
  faceToward('tackle', 'ouro');
  face('tack', 1);
  await emote('tackle', 'question');
  // The square waits for Ouro's. The light goes orange, then gray, and nothing comes off.
  await act('ouro', 'shiver');
  await tint('#e08a3a', 0.13, 70);
  await Promise.all([act('crowd3', 'look'), act('child', 'hop')]);
  await tint('#5a5868', 0.3, 70);
  evening(true);
  await tint('#5a5868', 0, 40);
  await act('ouro', 'shiver');
  await emote('ouro', 'silence');
  await act('ouro', 'look');
  await emote('tackmum', 'sweat');
  await say('Tack\'s mum', 'Oh, love. It\'s been a rough year.');
  // The old man turns to his own cast beside him, and they look at each other fondly.
  faceToward('oldman', 'oldcast');
  faceToward('oldcast', 'oldman');
  await Promise.all([emote('oldman', 'heart'), emote('oldcast', 'heart')]);
  await say('Old man', 'My shell shed late as well, and look at him now. Well, don\'t look at him. He\'s shy.');
  await act('oldcast', 'back');
  faceToward('oldman', 'ouro');
  // The crowd goes home through their own doors, and Tack's mum goes ahead of him.
  const later = (n: number, go: () => Promise<void>) => (async () => { await wait(n); await go(); })();
  await Promise.all([
    later(0, () => walkOff('crowd1', 15, 21)),
    later(12, () => walkOff('crowd2', 28, 21)),
    later(24, () => walkOff('crowd3', 17, 5)),
    later(40, () => walkOff('tackmum', 17, 5)),
  ]);
  setFlag('crowdGone');
  await wait(30);
  faceToward('tack', 'ouro');
  await say('Tack', '0 still counts. I\'ll tally you up tomorrow.');
  await Promise.all([walkOff('tack', 17, 5), later(10, () => walkOff('tackle', 17, 5))]);
  // The ground booms, and the craze runs out across the meadow tile by tile.
  sfx('boom');
  await shake(50);
  await Promise.all([emote('ouro', 'surprise'), emote('oldman', 'surprise')]);
  await pan(30, 8);
  for (const [i, [x, y]] of CRAZE.entries()) {
    void prop('craze' + i, 'Z', x, y, 8);
    field.shakeT = 4;
    if (i % 3 === 0) sfx('bump');
    await wait(7);
  }
  await wait(30);
  setFlag('slipday');
  // Pell comes later, from the brook side, so Pell is not there yet.
  offstage('pell');
  CRAZE.forEach((_, i) => void unprop('craze' + i, 0));
  await panBack();
  faceToward('oldman', 'ouro');
  await say('Old man', 'Huh. That\'s a fracture. Yeah, don\'t stand in that.');
  // Ouro walks to the near end of the craze and looks into it. Something under the meadow breathes.
  await walkTo('ouro', 28, 10);
  face('ouro', 2);
  await act('ouro', 'bow');
  sound('wind');
  field.shakeT = 6;
  await wait(40);
  await act('ouro', 'look');
  await emote('ouro', 'question');
  // Gran comes out of her door and down the lane to Ouro.
  setFlag('granOut');
  offstage('granout');
  await walkIn('granout', 10, 5, 27, 10);
  faceToward('granout', 'ouro');
  faceToward('ouro', 'granout');
  await say('Gran', 'Tell my little turnip that a fracture is not a place to stand.');
  await say('Gran', 'Tell them that late is different from never.');
  await say('Gran', 'Tell them supper is ready, and the explanation comes with it.');
  await walkOff('granout', 10, 5);
  setFlag('granOut', 0);
  // Pell runs up from the brook and stands staring at the craze.
  await walkIn('pell', 37, 9, 31, 9);
  face('pell', 3);
  goal('Go home to Gran.');
}

defScript('oldCast', async () => { await emote('oldcast', 'heart'); });

/** Someone nearby walks up and turns Ouro back from a way out, before Ouro has a whorl to go with. */
async function turnBack(who: string, line: string, speaker: string, bx: number, by: number): Promise<void> {
  const n = field.npc(who);
  await emote('ouro', 'question');
  if (n && !n.hidden && field.npcVisible(n)) {
    const [hx, hy] = [n.x, n.y];
    await walkUp(who);
    await say(speaker, line);
    await walkTo('ouro', bx, by);
    await walkTo(who, hx, hy);
  } else {
    await say(speaker, line);
    await walkTo('ouro', bx, by);
  }
}
defScript('turnBackWest', () => turnBack('carter', 'The west road is for those with a Whorl. The mule won\'t walk it with you, and neither will I.', 'Carter', 4, 16));
defScript('turnBackNorth', () => turnBack('oldman', 'No getting past the wood without a Whorl. The stream\'s rude about it.', 'Old man', 13, 4));
defScript('turnBackSouth', () => turnBack('child', 'Mum\'s rule is simple: no beach access unless you have a Whorl. Not even for paddling. I checked.', 'Child', 24, 29));
/** Before Tack's battle, the ways west out of the wood and the cove: Tack shouts from the village, and Ouro steps back. */
async function tackCalls(bx: number, by: number): Promise<void> {
  await emote('ouro', 'surprise');
  await say('Tack', 'OURO! Not that way! 1 battle first. I\'m at the west road!');
  await walkTo('ouro', bx, by);
}
defScript('tackCallsRib', () => tackCalls(4, 14));
defScript('tackCallsRoad', () => tackCalls(6, 31));
defScript('tackCallsCove', () => tackCalls(1, 16));
/** The craze hole into the Undermeadow, before Ouro has a whorl: the dark breathes, and Pell sends Ouro back. */
defScript('crazeHole', async () => {
  await act('ouro', 'bow');
  sound('wind');
  field.shakeT = 10;
  await wait(30);
  await act('ouro', 'shiver');
  await emote('ouro', 'sweat');
  await turnBack('pell', 'Don\'t go down without a Whorl. Half of us went down there. Look how that went.', 'Pell', 36, 5);
});

defScript('fellmonger', async () => {
  if (!flag('night')) { await say('Strandmonger', 'Opening later, because it\'s Shedding Day!! Go stand under that sky.');
  await say('Strandmonger', 'It\'s a two-cowrie sky and today it\'s free.'); return; }
  if (!flag('starter')) {
    await say('Strandmonger', 'And a late one! That means the Rim walk.');
    await say('Strandmonger', 'The path is free. The road demands shoes.');
    await say('Strandmonger', 'Those who\'ve shed walk out behind their own shell.');
    await say('Strandmonger', 'You haven\'t shed yet. Wild shells won\'t let a lone walker pass.');
    await say('Strandmonger', 'A stray steps up. A shell with no one to guide it. They seek a companion.');
    await say('Strandmonger', 'Three strays this month. Take one. Your gran\'s slate is long enough to take one more.');
    for (;;) {
      await say('Strandmonger', 'Ibabus. Found off a briar by the mill. It clings and bleeds them slowly. Easy eleven thorns.');
      await say('Strandmonger', 'Plus Squall. From a sideways spring rain. Hits twice, which is two for the price of one.');
      await say('Strandmonger', 'Virtaki comes from the old pump. It stuns, if you let the charge build.');
      const c = await choose(['Ibabus', 'Squall', 'Virtaki', 'Could you repeat that?']);
      if (c === 3) continue;
      const kind = ['bramble', 'squall', 'dynamo'][c];
      await giveMon(makeMon(kind, 3));
      break;
    }
    await emote('ouro', 'heart');
    await say('Strandmonger', 'Look at that. It\'s picked you back. That part I don\'t charge for.');
    await say('Strandmonger', 'That one set me back two cowries and a sandwich. I\'m still sore about the sandwich.');
    giveKey('register');
    await say('Strandmonger', 'Here\'s the Register. You catch a species, I log it. Writing\'s free. Holding it\'s a cowrie.');
    givePegs('twig', 5);
    await say('Strandmonger', 'Five periwinkle horns. I charge for those!! Put it on your gran\'s tab. She\'ll love it.');
    await say('Strandmonger', 'Dull them down a bit, then catch them. A weaker Whorl makes for a surer catch.');
    await say('Strandmonger', 'Weak enough, and it never fails.');
    await say('Strandmonger', 'Start with the Rib. Knuckle keeps it. Hands on Knuckle, I\'d price at a house each.');
    await say('Strandmonger', 'The pearl\'s cheap.');
    await say('Strandmonger', 'The Holdfast never asks for anything. Forty years, no horn.');
    await say('Strandmonger', 'I\'ve got a crate waiting with its name on it.');
    await SCRIPTS.lesson();
    await hint('(Press X for the menu. Z to talk or pick. Hold Shift to speed up.)');
    setFlag('starter');
    goal('Head west along the Midden Road to Rib. Knuckle guards the Seal there.');
    return;
  }
  const c = await choose(['Buy and the Midden', 'Speak']);
  if (c === 0) { await tannery('fellside', ['twig', 'brass']); return; }
  const kinds = Object.values(G.register).filter(v => v === 2).length;
  await say('Strandmonger', `\$${kinds} species listed in the Register. to me, every one is worth a cowrie.`);
  await say('Strandmonger', `That's \$${kinds} cowries I don't owe anyone.`);
  if (!flag('wellingHome') && flag('wellingGone')) await say('Strandmonger', 'The well is worth more than everything I have. I\'d give it back. I\'d charge for the advice, too.');
});

defScript('tackTalk', async () => {
  if (!flag('slipday')) await say('Tack', '40 years Cinch has stood there. 0 days off. 1 morning I can do, if there\'s lunch.');
});

defScript('tack1', async () => {
  // Tack walks up the road to meet Ouro, and walks off west when it is done.
  await emote('tackwait', 'surprise');
  await walkUp('tackwait');
  await wait(4);
  const tries = tackTries('1');
  if (tries) await say('Tack', `Try ${tries + 1}. Tackle is ready. Tackle is always ready.`);
  else {
    await say('Tack', 'Hey. 1 battle before you go. Just you and me.');
    await say('Tack', 'Tackle has 4 moves but I\'ve seen 2. Why won\'t it reveal the rest?');
    if (!flag('lesson')) {
      await hint('(Only one Whorl fights at a time. The others wait in reserve. Switch to bring one out.)');
      await hint('(Preview a move before choosing it. It says "Strong" when the foe is weak to it.)');
    }
  }
  const r = await battle({ enemy: [makeMon('tackle', 1)], name: 'Tack', ai: 'trainer', wild: false, bg: field.bg(), music: 'rival', bossHp: 0.75 });
  music.play('fellside');
  countTack('1', r.result === 'win');
  if (r.result !== 'win') {
    // Tack keeps the west road until Ouro wins. He goes back to his spot, and Ouro steps back out of the trigger.
    await say('Tack', `${tackWinsLine()} The road stays closed until you win 1. I'll wait.`);
    await Promise.all([walkTo('tackwait', 3, 16), walkTo('ouro', 9, field.y)]);
    faceToward('tackwait', 'ouro');
    return;
  }
  await say('Tack', `${tackLosesLine()} Alright. I'm writing it down.`);
  await walkOff('tackwait', 0, 16);
  setFlag('tack1');
});

defScript('well', async () => {
  const hasW = [...G.party, ...G.rack].find(m => m.kind === 'welling');
  if (flag('wellingHome')) { sound('heal'); await emote('ouro', 'music'); return; }
  if (!flag('wellingGone')) { await emote('ouro', 'silence'); return; }
  if (!hasW) { sound('bump'); await emote('ouro', 'sweat'); return; }
  const c = await choose(['Return Kaivodo', 'Keep it']);
  if (c !== 0) return;
  G.party = G.party.filter(m => m !== hasW);
  G.rack = G.rack.filter(m => m !== hasW);
  if (hasW.notion) G.notions[hasW.notion] = (G.notions[hasW.notion] || 0) + 1;
  // Kaivodo climbs down into the stone ring and settles, and the water comes up.
  const [wx, wy] = field.facing();
  await prop('welling', 'mon:welling', wx, wy, 20);
  await wait(20);
  await unprop('welling', 30);
  setFlag('wellingHome');
  sound('heal');
  field.shakeT = 8;
  await emote('wellman', 'heart');
  await say('Man at the well', 'There she is! Nobody make a sound. She\'s skittish.');
});

defScript('peelers', async () => {
  // Two Hermits lead Turnstone's well along the road on a halter, still dripping.
  await emote('ouro', 'surprise');
  await act('wellingRoad', 'shiver');
  faceToward('peeler1', 'ouro');
  faceToward('peeler2', 'ouro');
  await say('Hermit', 'Move along, kid. It\'s just a well.');
  // The man from Turnstone's well runs up the road behind Ouro.
  setFlag('wellChase');
  offstage('wellchase');
  await walkIn('wellchase', 54, 7, 49, 7);
  face('wellchase', 3);
  await say('Man at the well', 'Hey! That\'s Kaivodo! That\'s our well, put her down!');
  await say('Hermit', 'My apologies. Bare told me to bring a deep one to the Mast. This one counts as deep.');
  await say('Man at the well', 'She\'s the only water source in Turnstone!');
  await say('Hermit', 'Turnstone\'s got a fracture too, doesn\'t it? That\'s the Seals. They grip too tightly.');
  await say('Hermit', 'Large Whorls can wrench a Seal loose. So we take large Whorls.');
  const c = await choose(['Give it back', 'Who\'s Bare?']);
  if (c === 1) {
    await say('Hermit', 'She leads the Hermits. She hasn\'t had her first shed either.');
    await say('Hermit', 'She says the entire Volute is overdue for a shedding. The fractures are it struggling to break free.');
  } else await say('Hermit', 'No can do. It\'s ours now.');
  await say('Man at the well', 'We drink from her! Where is Turnstone supposed to get its water?');
  await say('Hermit', 'Ugh, this one\'s loose. Can you handle the kid?');
  const r = await fightTrainer({ name: 'Hermit', team: [['cairn', 3], ['puffball', 3]], intro: '', defeat: '' });
  if (r.result !== 'win') { await walkOff('wellchase', 55, 7); setFlag('wellChase', 0); return; }
  await say('Hermit', 'Fine. Leave it. The Mast has its own wells.');
  await say('Hermit', 'She\'ll want to hear about this kid.');
  // The Hermits walk off west down the road, and the well's shell backs up into the reeds by the pond, wild now.
  await Promise.all([
    walkOff('peeler1', 29, 7),
    (async () => { await wait(6); await walkOff('peeler2', 29, 7); })(),
    (async () => { await wait(20); await walkTo('wellingRoad', 39, 4); })(),
  ]);
  setFlag('peelers');
  setFlag('wellingGone');
  faceToward('wellingReeds', 'ouro');
  await emote('wellingReeds', 'question');
  faceToward('wellchase', 'wellingReeds');
  await say('Man at the well', 'She\'s vanished into the reeds. She won\'t come to me. She never does.');
  await say('Man at the well', 'The well stays dry until she returns. I\'ll go and wait by it.');
  await walkOff('wellchase', 55, 7);
  setFlag('wellChase', 0);
});

defScript('wellingReeds', async () => {
  const c = await choose(['Try to catch Kaivodo', 'Leave it']);
  if (c !== 0) return;
  const r = await fightWild(mon('welling', 4), { area: 'reeds' });
  if (r.pegged.length) {
    setFlag('wellingCaught');
    await giveMon(r.pegged[0]);
  }
});

defScript('ribTannery', async () => {
  if (has('rib') && !G.keys.includes('prisingiron')) {
    await say('Shellwright', 'You\'ve got one of Knuckle\'s pearls, right? Then you\'ll be wanting one of these.');
    await say('Shellwright', 'It\'s a prising iron. Old shells overgrow everything out here, rocks, middens, doors.');
    await say('Shellwright', 'When you hit a crust, lean on it, and it pops off. Watch your fingers. I didn\'t.');
    await giveKeyItem('prisingiron', 'Ouro acquires the prising iron.');
    await say('Shellwright', 'It opens clams, too. Prising a bed of them for me at the counter pays well. Any grotto will do.');
  }
  await tannery('rib', ['twig', 'brass']);
});

defScript('carter', async () => {
  await say('Carter', 'The cart goes to any town you\'ve visited. Ten cowries. No haggling.');
  await say('Carter', 'The mule has heard it all before.');
  await cart();
});

/** A door with nobody home to Ouro. */
defScript('shutDoor', async () => {
  const [x, y] = field.facing();
  if (field.map.warps.some(w => w.x === x && w.y === y)) return;
  sound('bump');
  await wait(20);
  await emote('ouro', 'silence');
});

defScript('ribStay', async () => {
  await emote('ouro', 'silence');
});

defScript('knuckle', async () => {
  if (has('rib')) { await say('Knuckle', 'Next up: Mast, yeah? Out along the Dry Sea.'); return; }
  await say('Knuckle', 'Hi. I\'m Knuckle. I keep the Rib.');
  await say('Knuckle', 'I\'ve had these pearls since I shed. Beat me, and you can have one. Not that one. The other one.');
  await say('Knuckle', 'So I send one out and keep three back. When one goes bad, I swap it. Simple.');
  await say('Knuckle', 'You should totally try that too.');
  const r = await fightTrainer({ name: 'Knuckle', team: [['cairn', 5], ['menhir', 5], ['hare', 5]], intro: '', defeat: '', ai: 'keeper' });
  if (r.result !== 'win') return;
  await say('Knuckle', 'Oh. I lost.');
  await say('Knuckle', 'Here. The Rib pearl is yours.');
  giveScale('rib');
  await notice('Ouro receives the Rib pearl.');
  await say('Knuckle', 'I\'ve heard Hermits are lurking on the Midden Road. Not a good sign.');
  await say('Knuckle', 'You\'ve got a fracture in Turnstone? The Rib has been groaning all month. You need to tell Leeward.');
  await say('Knuckle', 'Anyway, Mast\'s next. Go along the Dry Sea.');
  goal('Travel west from Rib, following the Dry Sea to Mast.');
});

void lines; void moveNpc; void flag;
