import type { Mon, SpriteData } from '../battle/model';
import { sp, SPECIES, WILD_KINDS, type Species } from './speciesdb';
import { halveLevel } from './types';
import { PROFILE_TABLE } from './profileTable';
import { profileFrom } from './profiles';
import './kits1';
import './kits2';
import './kits8';
import './notions';
import './species3';
import './species4';
import './species5';
import './species6';
import './species7';

export { SPECIES, WILD_KINDS, type Species };
// ================================================================ STONE
sp({ id: 'cairn', name: 'Kivishi', types: ['STONE'], basic: 'P', moves: ['topple', 'laystone', 'shoulder', 'landslide'], passives: ['stacking', 'waymark'],
  sprite: ['...33...', '..2222..', '...44...', '.222222.', '.212212.', '.22.222.', '44444444', '22222222'], c: ['#9d9da5', '#ddbe9e', '#5e5c64'],
  fit: 'piles itself higher when hit', pegs: 2, entry: 'Off the path down to the shore, a stone or a shell from every walker who passed. Hit it and it gets taller faster. Two cowries, plus your stone.' });
sp({ id: 'scree', name: 'Jarira', types: ['STONE'], basic: 'P', moves: ['pelt', 'rockfall', 'skid', 'avalanche'], passives: ['loose', 'shedstone'],
  sprite: ['........', '...2....', '..2342..', '.224432.', '21222212', '243.2342', '22444322', '44444444'], c: ['#999189', '#d2c2aa', '#60564e'],
  fit: 'slides when you step on it', pegs: 1, entry: 'Which comes down hills a bit at a time and never all the way. One cowrie and a bandage. The bandage is for you.' });
sp({ id: 'plinth', name: 'Daista', types: ['STONE'], basic: 'M', moves: ['raise', 'lower', 'unveil', 'monument'], passives: ['pedestal', 'unmoved'],
  sprite: ['...33...', '..3113..', '44444444', '.222222.', '.212212.', '.22.222.', '44444444', '44444444'], c: ['#d8d0c0', '#da94a4', '#7a7468'],
  fit: 'keeps a space on top for someone', pegs: 4, entry: 'Under a statue, once. The statue got up and left. It keeps the top clear in case. Four cowries, statue not included.' });
sp({ id: 'grotto', name: 'Luotsu', types: ['STONE'], basic: 'P', moves: ['cavein', 'takein', 'hush', 'swallow'], passives: ['drip', 'deep'],
  sprite: ['..2222..', '.222222.', '22122122', '22111122', '21133112', '21333312', '422.2224', '33333333'], c: ['#797986', '#6eb6d5', '#474d5c'],
  fit: 'breathes the tide in and out', pegs: 3, entry: 'A sea cave\'s old shell, still wet inside, and it breathes with the tide. Things go in it and come out fine. My glove hasn\'t yet. Three cowries, glove inside.' });
sp({ id: 'menhir', name: 'Menhir', types: ['STONE'], basic: 'P', moves: ['lean', 'ringofstones', 'summons', 'fallforward'], passives: ['standing', 'oldmass'],
  sprite: ['4......4', '44.22.44', '44122144', '4.2332.4', '.222222.', '22222222', '22.22.22', '22....22'], c: ['#8d8b93', '#78c8f7', '#585665'],
  fit: 'stands where it was put', pegs: 5, entry: 'Which is a standing stone\'s cast. Stands. Stood before the Stays went in. Five cowries, and I\'d not ask it to sit.' });
sp({ id: 'quarry', name: 'Louriba', types: ['STONE'], basic: 'P', moves: ['cut', 'blast', 'undermine', 'excavate'], passives: ['dugout', 'spoilheap'],
  sprite: ['....4...', '...444..', '.222222.', '22322322', '22222222', '4.2222.3', '44.22.33', '4......3'], c: ['#354573', '#78e8d8', '#586696'],
  fit: 'takes stone out of whatever it touches', pegs: 3, entry: 'The shell a hole left behind. Takes stone out of what it hits and keeps it. Three cowries. Count your walls after.' });
sp({ id: 'grotesque', name: 'Irvino', types: ['STONE'], basic: 'P', moves: ['drop', 'gargle', 'perch', 'leer'], passives: ['gutter', 'spout'],
  sprite: ['4......4', '44.33.44', '4.2222.4', '44322344', '.422224.', '33.22.33', '3.2..2.3', '........'], c: ['#5c3c7a', '#b1e743', '#9374c2'],
  fit: 'pulls a face at the rain', pegs: 2, entry: 'Off a church gutter. Same face six hundred years. It\'s pulling it at you now. Two cowries, face included.' });
sp({ id: 'tor', name: 'Kumpuka', types: ['STONE'], basic: 'P', moves: ['fissure', 'stamp', 'heave', 'quake'], passives: ['aftershock', 'bedrock'],
  sprite: ['..2222..', '44444444', '.222222.', '21222212', '44444444', '22222222', '3.3..3.3', '.3.33.3.'], c: ['#746e62', '#f4a532', '#999189'],
  fit: 'shrugs and the ground shrugs with it', pegs: 4, entry: 'A hilltop that got up and walked off. The hill stayed, a bit lower, a bit put out. Four cowries for the top.' });

// ================================================================ TIDE
sp({ id: 'welling', name: 'Kaivodo', types: ['TIDE'], basic: 'M', moves: ['bucket', 'splash', 'brim', 'spring'], passives: ['deepwater', 'drawnup'],
  sprite: ['...33...', '...33...', '.444444.', '..4..4..', '.222222.', '23133132', '24222242', '22.22.22'], c: ['#a8a0b8', '#fce57d', '#5a4995'],
  fit: 'brings up water when asked', pegs: 0, entry: 'Turnstone\'s well, out walking. Frightens easy. Price: one village. The village would like it back.' });
sp({ id: 'undertow', name: 'Vetoki', types: ['TIDE'], basic: 'M', moves: ['pullunder', 'churn', 'sink', 'rip'], passives: ['drag', 'riptide'],
  sprite: ['..44343.', '.4443433', '44222244', '41122113', '42222224', '.111111.', '42.42424', '44444444'], c: ['#a8e4f4', '#f4fcff', '#2c58c8'],
  fit: 'pulls at your ankles', pegs: 3, entry: 'Off the bottom of a bay. You can\'t see it from the shore. You find out. Three cowries, paid in wet socks.' });
sp({ id: 'fogbank', name: 'Utumi', types: ['TIDE'], basic: 'M', moves: ['damp', 'bank', 'muffle', 'whiteout'], passives: ['grey', 'lift'],
  sprite: ['..4444..', '.444444.', '44111144', '41313134', '44111144', '4.4444.4', '.4.44.4.', '2..2..2.'], c: ['#dde6ee', '#69cafe', '#38344b'],
  fit: 'sits in low places', pegs: 2, entry: 'And a fog off the low places. Hides what\'s in them. Two cowries, if you can find it. I can\'t find it.' });
sp({ id: 'floe', name: 'Hyolau', types: ['TIDE'], basic: 'M', moves: ['shard', 'packice', 'calve', 'freezeover'], passives: ['chill', 'refreeze'],
  sprite: ['4......4', '44....44', '444..444', '.4.2224.', '..2122..', '..2222..', '.33..33.', '3......3'], c: ['#e4f0fb', '#96cee5', '#4378ae'],
  fit: 'drifts and cracks', pegs: 3, entry: 'Down from the north on its own. Cracks when it\'s warm. Three cowries, cash, before it warms up.' });
sp({ id: 'squall', name: 'Squall', types: ['TIDE'], basic: 'P', moves: ['gust', 'sheets', 'bluster', 'cloudburst'], passives: ['downpour', 'clearing'],
  sprite: ['..2222..', '.222322.', '22123122', '22222222', '.4.4.4..', '4.4.4.4.', '.4.4.4..', '4.4.4...'], c: ['#686d85', '#e4ecf4', '#7ba3ca'],
  fit: 'comes in sideways', pegs: 2, entry: 'Off a rain that came sideways. Still does. Hits twice. Two cowries, which is a cowrie a hit.' });
sp({ id: 'bore', name: 'Vuoksho', types: ['TIDE'], basic: 'P', moves: ['surge', 'crest', 'runup', 'boretide'], passives: ['momentum', 'upstream'],
  sprite: ['...44..3', '..4444.3', '.4322343', '244444.3', '222.2223', '22222223', '2.2..2.2', '4.4..4.4'], c: ['#4f8cbc', '#6dedbf', '#2e4a68'],
  fit: 'runs the wrong way up rivers', pegs: 3, entry: 'The wave that runs up rivers the wrong way, quicker every time. Catch it on the way down and it\'s three cowries.' });
sp({ id: 'brine', name: 'Suomizu', types: ['TIDE'], basic: 'M', moves: ['sting', 'crust', 'pickle', 'evaporate'], passives: ['salt', 'cure'],
  sprite: ['....3.3.', '.222222.', '22122122', '21311312', '21111112', '22222222', '.2.4442.', '..4..4..'], c: ['#f6f2e5', '#c8d725', '#776d5e'],
  fit: 'dries everything it sits on', pegs: 2, entry: 'Plus a salt pan\'s crust, out walking. Dries out everything it sits on, wounds too. Two thirsty cowries.' });
sp({ id: 'eddy', name: 'Pyoruzu', types: ['TIDE'], basic: 'M', moves: ['whirl', 'turn', 'exchange', 'maelstrom'], passives: ['turnabout', 'spin'],
  sprite: ['.222....', '24.42...', '2.1.2...', '.242..3.', '...3.242', '...2.1.2', '...24.42', '....222.'], c: ['#75b4d4', '#eef6fd', '#2b5b88'],
  fit: 'turns in place', pegs: 3, entry: 'Off a river bend. Turns in one place and makes you turn. Three cowries. I went dizzy counting them.' });

// ================================================================ ROOT
sp({ id: 'thicket', name: 'Yabuko', types: ['ROOT'], basic: 'P', moves: ['snag', 'bristle', 'tangle', 'overgrow'], passives: ['thorned', 'hedge'],
  sprite: ['...4.4..', '..22222.', '.4232324', '3..222..', '.22222..', '3.23232.', '.222222.', '...4.4..'], c: ['#798e67', '#f18f34', '#334329'],
  fit: 'grows across paths', pegs: 2, entry: 'A hedge. Grew across my road while I was looking at it. Two cowries for the hedge. The road\'s not for sale.' });
sp({ id: 'mycel', name: 'Sienoko', types: ['ROOT'], basic: 'M', moves: ['spore', 'flush', 'decompose', 'mycorrhiza'], passives: ['network', 'fruiting'],
  sprite: ['3......3', '.2..3.2.', '..2.22..', '2.2222.2', '.212212.', '2.2222.2', '.2.22.2.', '2..44..2'], c: ['#efebdf', '#54443a', '#b9b199'],
  fit: 'spreads under everything', pegs: 3, entry: 'Which is the white under a wood. Spreads. Feeds. It has had some of my counter. Three cowries, less the counter.' });
sp({ id: 'burr', name: 'Gobonen', types: ['ROOT'], basic: 'P', moves: ['catch', 'prickle', 'hitch', 'burstpod'], passives: ['stuckon', 'seedfall'],
  sprite: ['44....44', '444..444', '4442.444', '..2222..', '.212212.', '3.2222..', '.3.2.2..', '..3.....'], c: ['#8e6f37', '#ec6f16', '#473745'],
  fit: 'sticks to whoever passes', pegs: 1, entry: 'Off a passing sleeve. Sticks to the next thing that passes. That\'s all it wants. One cowrie. It\'s on my hat.' });
sp({ id: 'orchard', name: 'Tarhaju', types: ['ROOT'], basic: 'M', moves: ['pick', 'graft', 'dropfruit', 'harvest'], passives: ['windfall', 'overripe'],
  sprite: ['3.3..3.3', '.333333.', '33422433', '34122143', '33222233', '.44.444.', '..4444..', '...24...'], c: ['#ebdbcb', '#e596b5', '#5b9849'],
  fit: 'drops things for you', pegs: 4, entry: 'An orchard\'s old shell, dropping fruit. Real fruit. I\'ve eaten some. I don\'t ask. Four cowries, plus asking.' });
sp({ id: 'stump', name: 'Kankabu', types: ['ROOT'], basic: 'P', moves: ['splinter', 'sap', 'stubborn', 'heartwood'], passives: ['rings', 'regrow'],
  sprite: ['..4444..', '.444444.', '44122144', '444.4444', '44333344', '3.4444.2', '2.4..4.2', '2.4..4.2'], c: ['#c4ccd3', '#e3ffaf', '#7c4c91'],
  fit: 'grows a ring every year', pegs: 2, entry: 'What was left when somebody cut the tree. Grows a ring a year anyway. Two cowries now. A cowrie more each ring.' });
sp({ id: 'puffball', name: 'Tuhkori', types: ['ROOT'], basic: 'M', moves: ['toxicpuff', 'setcap', 'dust', 'fairyring'], passives: ['spores', 'camouflage'],
  sprite: ['...33...', '..4444..', '.444444.', '44444444', '.22.222.', '.212212.', '.222222.', '..4444..'], c: ['#efebdf', '#c8252c', '#1b5d10'],
  fit: 'goes off when stepped on', pegs: 1, entry: 'Off a field edge. Goes off when stepped on. Spores in everything, my tea as well. One cowrie, tea extra.' });
sp({ id: 'bramble', name: 'Ibabus', types: ['ROOT'], basic: 'P', moves: ['lash', 'creep', 'ripout', 'thornwall'], passives: ['briar', 'feed'],
  sprite: ['3.4..4.3', '.44..44.', '4.2222.4', '.212212.', '42222224', '.4.22.4.', '3.4..4.3', '.4....4.'], c: ['#3c6b32', '#dd3c4c', '#283826'],
  fit: 'catches and holds', pegs: 2, entry: 'Off a briar by the mill. Catches, holds, bleeds you slow. Mill folk hate it. Two cowries or eleven thorns.' });
sp({ id: 'hemlock', name: 'Myroku', types: ['ROOT'], basic: 'M', moves: ['dose', 'draught', 'wilt', 'lastcup'], passives: ['cup', 'tincture'],
  sprite: ['2.2..2.2', '22.22.22', '.2.44.2.', '...44...', '33333333', '313.3313', '.333333.', '..3333..'], c: ['#f3f3eb', '#cfc7d7', '#347433'],
  fit: 'is offered in a cup', pegs: 4, entry: 'Comes in a cup. Don\'t drink from the cup. Four cowries, cup included, and I mean it about the cup.' });

// ================================================================ GEAR
sp({ id: 'orrery', name: 'Orrery', types: ['GEAR'], basic: 'M', moves: ['wind', 'unwind', 'tick', 'conjunction'], passives: ['epicycle', 'escapement'],
  sprite: ['2......2', '.4....4.', '..4334..', '2.3113.2', '..3.33..', '.4.44.4.', '...44...', '.444444.'], c: ['#6b92d8', '#f0b22c', '#936421'],
  fit: 'goes round and round', pegs: 6, entry: 'The Riders\' model of the sky. Goes round. Makes your lot go round quicker. Six cowries, which is cheap for a sky.' });
sp({ id: 'crane', name: 'Notsuru', types: ['GEAR'], basic: 'P', moves: ['hook', 'swing', 'lift', 'staticfield'], passives: ['counterweight', 'hoist'],
  sprite: ['22222222', '2......3', '2......3', '2.....33', '2....333', '414...3.', '4.4.....', '222.....'], c: ['#cf9111', '#8d663e', '#d8d0c0'],
  fit: 'lifts what is under it', pegs: 4, entry: 'Off a dock. Lifts what\'s under it and puts it where it likes. Put my cart on the roof. Four cowries, cart stays.' });
sp({ id: 'turbine', name: 'Molasha', types: ['GEAR'], basic: 'M', moves: ['spinup', 'gale', 'updraft', 'monsoon'], passives: ['tailwind', 'feather'],
  sprite: ['3......3', '.3....3.', '..3223..', '...11...', '..3223..', '.344443.', '3.4.44.3', '..4444..'], c: ['#e4e4ec', '#bea68e', '#676775'],
  fit: 'faces into the wind', pegs: 3, entry: 'And this one faces the wind and makes wind for its friends. Hold your three cowries tight when you pay.' });
sp({ id: 'perigee', name: 'Varhari', types: ['GEAR'], basic: 'P', moves: ['ping', 'fix', 'burnin', 'deorbit'], passives: ['orbit', 'telemetry'],
  sprite: ['......3.', '.....3..', '44.22.44', '44222244', '44233244', '44231244', '44.22.44', '..2..2..'], c: ['#bdbdc5', '#aff2ff', '#304f94'],
  fit: 'watches from very high up', pegs: 6, entry: 'Out of the sky, one winter. Watches from where it fell. It\'ll watch you count out six cowries, so count right.' });
sp({ id: 'furnace', name: 'Camado', types: ['GEAR'], basic: 'M', moves: ['stoke', 'flue', 'firebox', 'blastheat'], passives: ['radiant', 'banked'],
  sprite: ['..4..4..', '.444444.', '.222222.', '.212212.', '.222222.', '.2.3332.', '.444444.', '..4..4..'], c: ['#8a86a0', '#ffa040', '#4c4a62'],
  fit: 'is warm all the way through', pegs: 3, entry: 'Off the old works, with something living in the firebox. Warm all through for a hundred years. Three cowries, or two and your blanket.' });
sp({ id: 'piston', name: 'Manuchi', types: ['GEAR'], basic: 'P', moves: ['drive', 'plunge', 'vent', 'fullstroke'], passives: ['stroke', 'pressure'],
  sprite: ['...33...', '...33...', '..4444..', '.222222.', '.212212.', '.22.222.', '.244442.', '44444444'], c: ['#9d9dac', '#cad2da', '#51515f'],
  fit: 'goes in and out', pegs: 3, entry: 'In and out, quicker each time. Three cowries. Don\'t stand where the out goes.' });
sp({ id: 'dynamo', name: 'Virtaki', types: ['GEAR'], basic: 'M', moves: ['spark', 'arc', 'induct', 'stormcoil'], passives: ['charge', 'ground'],
  sprite: ['........', '44....44', '42.33.24', '4.3..324', '42....24', '41....14', '44....44', '44....44'], c: ['#9d9dac', '#fdde3d', '#464654'],
  fit: 'hums when it is turned', pegs: 2, entry: 'Off the old pump. Hums when it\'s turned. Two cowries and a sandwich, the going rate for sandwiches.' });
sp({ id: 'siren', name: 'Pilteki', types: ['GEAR'], basic: 'M', moves: ['blare', 'shriek', 'allclear', 'klaxon'], passives: ['alarm', 'wail'],
  sprite: ['3..44..3', '.3.44.3.', '..4444..', '.222222.', '.212212.', '.333333.', '.22.222.', '44444444'], c: ['#d2272d', '#f2f2f2', '#4c4c59'],
  fit: 'goes off when something is wrong', pegs: 3, entry: 'Off a buoy at the marsh mouth. Goes off when something\'s wrong. Something\'s always wrong. Three cowries. It\'s going off now.' });

// ================================================================ BEAST
sp({ id: 'howl', name: 'Lupusmi', types: ['BEAST'], basic: 'P', moves: ['bite', 'rundown', 'hackles', 'pindown'], passives: ['bloodscent', 'pack'],
  sprite: ['4..22...', '...22...', '..2222..', '..2122..', '.222.2..', '.222222.', '.22..22.', '.33..33.'], c: ['#e8e4dc', '#817162', '#aba39b'],
  fit: 'follows by smell', pegs: 4, entry: 'A wolf\'s cast, nose down, still on a smell from years back. It sniffs the four cowries before you can hand them over.' });
sp({ id: 'yoke', name: 'Iesbiki', types: ['BEAST'], basic: 'P', moves: ['toss', 'headbutt', 'bellow', 'undertheyoke'], passives: ['trample', 'unbroken'],
  sprite: ['4......4', '44....44', '.422224.', '.212212.', '.22.222.', '.233332.', '..3333..', '..2412..'], c: ['#855644', '#e6b733', '#efe3cf'],
  fit: 'pulls whatever it is tied to', pegs: 3, entry: 'Off an ox team. Pulls whatever it\'s tied to. Doesn\'t stop when you untie it. Three cowries, and one fence.' });
sp({ id: 'stoat', name: 'Okopa', types: ['BEAST'], basic: 'P', moves: ['nip', 'dart', 'slipaway', 'dance'], passives: ['weasel', 'wintercoat'],
  sprite: ['3.4..4..', '3.44.44.', '3.22222.', '3212212.', '3.22322.', '3222222.', '3.2222..', '..2..2..'], c: ['#f2f2ee', '#9cd3f2', '#a26420'],
  fit: 'goes through small gaps', pegs: 3, entry: 'A stoat in its winter coat. Gets through gaps a horn won\'t. Three cowries, if you can find the gap it\'s in.' });
sp({ id: 'leech', name: 'Iliru', types: ['BEAST'], basic: 'M', moves: ['draw', 'pool', 'bloat', 'hemorrhage'], passives: ['engorge', 'clot'],
  sprite: ['..2222..', '.222222.', '44222244', '43122134', '44111144', '4.3333.4', '44.33.44', '4......4'], c: ['#f1eded', '#c4092a', '#600c20'],
  fit: 'holds on until it is full', pegs: 2, entry: 'Plus a leech. Holds on until it\'s full. Then holds on. Costs two cowries to start.' });
sp({ id: 'carrion', name: 'Varasu', types: ['BEAST'], basic: 'P', moves: ['peck', 'mob', 'circle', 'feast'], passives: ['gather', 'watch'],
  sprite: ['..4444..', '.444444.', '.432234.', '.444444.', '334.4422', '33444422', '3.4..4.2', '..4..4..'], c: ['#393544', '#e13634', '#635969'],
  fit: 'waits on the fence', pegs: 3, entry: 'Off the fence by the mill. Sits and waits. It\'s waited for better than you. Three cowries. It\'ll wait for those too.' });
sp({ id: 'gore', name: 'Sonno', types: ['BEAST'], basic: 'P', moves: ['horn', 'charge', 'stampmove', 'stampede'], passives: ['headdown', 'thickneck'],
  sprite: ['3......3', '43....34', '.44..44.', '.222222.', '22122122', '222.2222', '.233332.', '..2..2..'], c: ['#0060b7', '#ece4d4', '#ccbc9c'],
  fit: 'lowers its head first', pegs: 4, entry: 'A bull\'s cast. Lowers its head first, then you\'ve got about a second. Four cowries, inside that second.' });
sp({ id: 'thumb', name: 'Peubi', types: ['BEAST'], basic: 'P', moves: ['press', 'pinch', 'thumbsdown', 'squash'], passives: ['grip', 'opposable'],
  sprite: ['4......4', '44.33.44', '.233332.', '.222222.', '22122122', '222.2222', '22444422', '22....22'], c: ['#a47e6a', '#cbc7c5', '#634442'],
  fit: 'presses down', pegs: 5, entry: 'A giant\'s thumb, by itself. The rest of the giant didn\'t turn, or turned somewhere else. Five cowries a thumb.' });
sp({ id: 'hare', name: 'Usapus', types: ['BEAST'], basic: 'P', moves: ['kick', 'bolt', 'freeze', 'madmarch'], passives: ['quick', 'box'],
  sprite: ['.2....2.', '.2....2.', '.22..22.', '.222222.', '22122122', '33222233', '33.22.33', '.44..44.'], c: ['#bd9576', '#ebe3db', '#815848'],
  fit: 'boxes in the spring', pegs: 2, entry: 'Off a spring field. Boxes in spring. Boxes in autumn. Boxed me in summer, out of turn. Two cowries to whoever can hold it.' });

// ================================================================ STAR
sp({ id: 'paring', name: 'Mikapi', types: ['STAR'], basic: 'M', moves: ['crescent', 'waning', 'lunarrush', 'fullphase'], passives: ['phase', 'thin'],
  sprite: ['2......2', '22....22', '.222222.', '.212212.', '.222222.', '..4334..', '.443344.', '..4..4..'], c: ['#e9e9f9', '#9696dc', '#454482'],
  fit: 'thins and comes back', pegs: 1, entry: 'Which the moon leaves a thin shell every month, and they come down in fields. One cowrie. Thirteen a year.' });
sp({ id: 'coma', name: 'Hometa', types: ['STAR'], basic: 'M', moves: ['dustmove', 'icecore', 'streak', 'impact'], passives: ['tail', 'perihelion'],
  sprite: ['..2222..', '.232232.', '22222222', '21222212', '22222222', '.22.222.', '.114411.', '.11..11.'], c: ['#c3d3e3', '#f6f9fc', '#6f8fb5'],
  fit: 'comes back once a lifetime', pegs: 6, entry: 'The head of a comet. Comes round once a lifetime and here it is in my shop. Six cowries, once in a lifetime.' });
sp({ id: 'curtain', name: 'Remaku', types: ['STAR'], basic: 'M', moves: ['ripple', 'brighthour', 'bands', 'encore'], passives: ['chord', 'veil'],
  sprite: ['2.4.2.4.', '2.4.2.4.', '24242424', '21242124', '24242424', '2.4.2.4.', '.2.4.2.4', '.3.4.3.4'], c: ['#61e293', '#f7e4ff', '#8757c4'],
  fit: 'hangs over the north', pegs: 5, entry: 'Plus the shell off a sky full of green light. Hangs over the north. Five cowries. Doesn\'t draw.' });
sp({ id: 'fulgur', name: 'Sazuma', types: ['STAR'], basic: 'M', moves: ['arcbolt', 'fork', 'flash', 'thundergod'], passives: ['conductive', 'static'],
  sprite: ['..2222..', '.212212.', '.22.222.', '.333333.', '33333333', '.333333.', '..4..3..', '.44..33.'], c: ['#97d8ff', '#f8f8fc', '#3954b3'],
  fit: 'strikes the same place twice', pegs: 4, entry: 'Glass off the beach where lightning struck it. Strikes the same place twice. Four cowries. Twice.' });
sp({ id: 'halo', name: 'Kakeha', types: ['STAR'], basic: 'M', moves: ['smite', 'aegis', 'sanctify', 'intervention'], passives: ['grace', 'martyr'],
  sprite: ['..3333..', '4......4', '44.22.44', '44222244', '.232232.', '.22.222.', '3.2222.3', '3.2..2.3'], c: ['#faf2da', '#dc9307', '#cacad1'],
  fit: 'floats over someone else', pegs: 7, entry: 'Off a saint who\'s still out walking, bareheaded. Floats over someone. Seven cowries, and a hat for the saint.' });
sp({ id: 'umbra', name: 'Tekage', types: ['STAR'], basic: 'P', moves: ['shade', 'blot', 'umbralstep', 'paranoia'], passives: ['penumbra', 'corona'],
  sprite: ['4......4', '.4.22.4.', '..1221..', '.132231.', '42222224', '4.2.22.4', '..2222..', '.3.12.3.'], c: ['#3c3858', '#8cccfe', '#7d83aa'],
  fit: 'passes over at noon', pegs: 5, entry: 'The shadow off an eclipse, fallen. Passes over at noon. Five cowries. Bring a lamp to count them by.' });
sp({ id: 'portent', name: 'Enneshi', types: ['STAR'], basic: 'M', moves: ['sign', 'badnews', 'unlucky', 'doom'], passives: ['foretold', 'illwind'],
  sprite: ['4.....4.', '...33...', '..2222..', '4.2112.4', '..2.22..', '...33...', '.4....4.', '...4....'], c: ['#bb0029', '#f88949', '#918282'],
  fit: 'arrives before bad news', pegs: 4, entry: 'And a red star\'s shell, hung over somewhere before bad news. Nobody agrees what news. Four cowries. I say rain.' });
sp({ id: 'flare', name: 'Honoki', types: ['STAR'], basic: 'M', moves: ['sear', 'flashpoint', 'prominence', 'supernova'], passives: ['ignite', 'blaze'],
  sprite: ['3......3', '33.22.33', '.322223.', '32122123', '332.2233', '.333333.', '..3333..', '...44...'], c: ['#fdeebe', '#d75a0e', '#f3a51d'],
  fit: 'goes up all at once', pegs: 6, entry: 'Came off the sun. Goes up all at once. Six cowries and a bucket. A full bucket.' });

// ================================================================ special
sp({ id: 'tackle', name: 'Tackle', types: ['BEAST'], basic: 'P', moves: ['shove', 'grab', 'standfirm', 'rush'], passives: ['tally', 'kid'],
  sprite: ['3......3', '33444433', '.444444.', '.212212.', '.22.222.', '..2222..', '.422224.', '..1..1..'], c: ['#e8e0d0', '#0e7d84', '#7a90c8'],
  fit: 'walks like Tack', pegs: 0, entry: 'Tack\'s cast. Not for sale. Tack would want to know who asked, and how many times.', person: true, wild: false });
sp({ id: 'full', name: 'Full', types: ['STAR', 'TIDE'], basic: 'M', moves: ['tidelift', 'neap', 'springtide', 'syzygy'], passives: ['pull', 'massive'],
  sprite: ['..2222..', '.222....', '2212.44.', '222.444.', '222.444.', '.2.2....', '..2222..', '...33...'], c: ['#fcf4e3', '#f0c860', '#3a6ad8'],
  fit: 'pulls the water up after it', pegs: 0, entry: 'The moon\'s first cast. No price. I\'d not sell it to myself, and I\'ve offered.', legendary: true, wild: false });
sp({ id: 'mundane', name: 'Mundane', types: ['STONE', 'BEAST'], basic: 'P', moves: ['plate', 'fold', 'settle', 'peel'], passives: ['overdue', 'oldground'],
  sprite: ['.32..32.', '2323.323', '2223.322', '2224.222', '42422424', '.224422.', '.142241.', '.11..11.'], c: ['#c62d28', '#ffffff', '#f9ff13'],
  fit: 'was the middle of everything once', pegs: 0, entry: 'The old Volute\'s heart. No price. I\'ve no slate that big, and your gran\'s slate is very big.', legendary: true, wild: false });
sp({ id: 'knot', name: 'Knot', types: ['GEAR', 'STONE'], basic: 'P', moves: ['turnkey', 'tension', 'stand', 'thekey'], passives: ['habit', 'holdfast'],
  sprite: ['.44..44.', '4.4444.4', '.444444.', '.212212.', '.222222.', '..2332..', '.444444.', '.1....1.'], c: ['#e0d0b0', '#aa4525', '#8a8aa0'],
  fit: 'keeps doing what it was doing', pegs: 0, entry: 'The Holdfast\'s cast. No price. It was never for sale. It never sent for anything, either.', legendary: true, wild: false });

sp({ id: 'holm', name: 'Holm', types: ['TIDE', 'STONE'], basic: 'P', moves: ['holm_shoulder', 'holm_carry', 'holm_wake', 'holm_lap'], passives: ['holm_island', 'holm_house'],
  sprite: ['...33...', '..3333..', '..4.44..', '.222222.', '22222222', '22122122', '.222222.', '2.2..2.2'], c: ['#d8c8a8', '#c8604a', '#f8f0e0'],
  fit: 'walks round the Lip with a house on', pegs: 0, entry: 'Off a turtle, an island. No price. I\'d need a slate that floats.', legendary: true, wild: false });

const AREA: Record<string, string> = {
  cairn: 'tanning', hare: 'tanning', puffball: 'meadow', paring: 'meadow', burr: 'meadow', stoat: 'tanning', welling: 'tanning',
  scree: 'drysea', brine: 'drysea', bore: 'drysea', carrion: 'drysea', coma: 'drysea', eddy: 'drysea',
  fogbank: 'marsh', undertow: 'marsh', leech: 'marsh', mycel: 'marsh', grotesque: 'marsh', siren: 'marsh',
  thicket: 'understory', orchard: 'understory', hemlock: 'understory', stump: 'understory', howl: 'understory', umbra: 'understory',
  crane: 'machines', turbine: 'machines', furnace: 'machines', orrery: 'machines', perigee: 'machines', fulgur: 'machines', piston: 'machines',
  floe: 'tundra', yoke: 'tundra', menhir: 'tundra', halo: 'tundra', curtain: 'tundra',
  gore: 'hiltroad', thumb: 'hiltroad', quarry: 'hiltroad', portent: 'hiltroad', plinth: 'hiltroad', grotto: 'hiltroad',
  flare: 'crater', tor: 'crater', bramble: 'crater', squall: 'crater', dynamo: 'crater',
};
for (const [k, a] of Object.entries(AREA)) if (SPECIES[k]) SPECIES[k].area = a;
// Every kind's stat profile, onto its species entry (Notes/stat-profiles.md).
for (const [id, [arch, p]] of Object.entries(PROFILE_TABLE)) if (SPECIES[id]) { SPECIES[id].profile = profileFrom(p); SPECIES[id].archetype = arch; }
let uidCounter = 1;
export function setUidFloor(n: number): void { uidCounter = Math.max(uidCounter, n + 1); }
export function nextUid(): number { return uidCounter++; }

export function spriteOf(sp: Species): SpriteData {
  return { px: sp.sprite.slice(), c: [sp.c[0], sp.c[1], sp.c[2]] };
}

/** A new whorl. `level` is on the old 1 to 100 scale that content is written in, and the whorl gets the halved level. */
export function makeMon(kind: string, level: number, over: Partial<Mon> = {}): Mon {
  const sp = SPECIES[kind];
  if (!sp) throw new Error(`no species ${kind}`);
  return {
    uid: nextUid(), kind, name: sp.name, types: sp.types.slice(), basic: sp.basic, moves: sp.moves.slice(), passives: sp.passives.slice(),
    level: halveLevel(level), xp: 0, notion: null, sprite: spriteOf(sp), legendary: sp.legendary, person: sp.person, ...over,
  };
}

/** The Register entry and fit phrase for any slough, fitted or not. */
export function entryOf(m: Mon): string {
  if (m.entry) return m.entry;
  return SPECIES[m.kind]?.entry || '';
}
