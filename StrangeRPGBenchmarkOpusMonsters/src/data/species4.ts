import './kits4';
import { sp } from './speciesdb';

// ================================================================ machines
sp({ id: 'kiln', name: 'Kiln', types: ['GEAR'], basic: 'P', area: 'machines', moves: ['kiln_clinker', 'kiln_bellows', 'kiln_temper', 'kiln_ram'], passives: ['kiln_glaze', 'kiln_hearth'],
  sprite: ['2......2', '22.22.22', '.232232.', '.222222.', '441.4144', '22111122', '.111111.', '111..111'], c: ['#912c0f', '#e28419', '#dcd0b4'],
  fit: 'fires whatever it is handed', pegs: 4, entry: 'A brick kiln from the old works. One side still warm. Hand it a notion and it hands it back harder. Four cowries, warm side up.' });
sp({ id: 'belt', name: 'Vyobi', types: ['GEAR'], basic: 'M', area: 'machines', moves: ['belt_rollers', 'belt_couple', 'belt_overdrive', 'belt_trip'], passives: ['belt_load', 'belt_idler'],
  sprite: ['..2222..', '.2....2.', '2..33..2', '2.34.3.2', '2.3443.2', '2..33..2', '.2....2.', '..2222..'], c: ['#5c5c6a', '#ebf3fa', '#9dcce3'],
  fit: 'carries whatever stands on it', pegs: 3, entry: 'Which carries whatever stands on it to the same place, same speed. A conveyor belt\'s shell. Three cowries, same price.' });

// ================================================================ skinfall
sp({ id: 'aerial', name: 'Vienum', types: ['STAR'], basic: 'M', area: 'skinfall', moves: ['aerial_reception', 'aerial_broadcast', 'aerial_interference', 'aerial_longwave'], passives: ['aerial_carrier', 'aerial_repeater'],
  sprite: ['.4...4.3', '.42224.4', '.24442.3', '.21412.4', '.22422.3', '22222223', '22.22223', '22222223'], c: ['#e9ebef', '#dabb5b', '#a8acff'],
  fit: 'turns toward talk nobody else hears', pegs: 4, entry: 'Off the old mast on the Lip, where it kept vigil like a monk. Hums signals in no tongue anyone speaks and passes them round. Four cowries, quiet.' });
sp({ id: 'vane', name: 'Kazeli', types: ['STAR'], basic: 'P', area: 'skinfall', moves: ['vane_spar', 'vane_jibe', 'vane_halyard', 'vane_touchdown'], passives: ['vane_landfall', 'vane_fullsail'],
  sprite: ['...33...', '...22...', '..2222..', '32122123', '3222.223', '..2222..', '...22...', '..4444..'], c: ['#bf9847', '#f4d575', '#4a4458'],
  fit: 'lands beside whatever is falling', pegs: 5, entry: 'A sail with nothing left to push it. Comes down next to things about to fall over. Five cowries. I\'m stood well back.' });
sp({ id: 'capsule', name: 'Capkara', types: ['GEAR'], basic: 'M', area: 'skinfall', moves: ['capsule_reentry', 'capsule_hullburst', 'capsule_sealin', 'capsule_mutiny'], passives: ['capsule_coldsoak', 'capsule_drogue'],
  sprite: ['4......4', '.4.33.4.', '..3333..', '.313313.', '..3333..', '22.22.22', '22222222', '.222222.'], c: ['#a29e96', '#abe0fd', '#3a78b6'],
  fit: 'shuts itself around a friend', pegs: 4, entry: 'Down hot from very high, shut like a clam. Opens for a friend and closes behind them. Four cowries. Not my friend.' });
sp({ id: 'booster', name: 'Imshin', types: ['GEAR'], basic: 'P', area: 'skinfall', moves: ['booster_thrust', 'booster_scatter', 'booster_fuelleak', 'booster_downrange'], passives: ['booster_stage', 'booster_last'],
  sprite: ['........', '..22222.', '42222122', '44222333', '42222222', '..2.222.', '...22...', '........'], c: ['#81719e', '#f5f1f1', '#f37533'],
  fit: 'falls off things on purpose', pegs: 3, entry: 'And the part that falls off first. Falls off things on purpose now. Keep it off the roof. Three cowries. The roof\'s on you.' });
sp({ id: 'dish', name: 'Pasara', types: ['STAR'], basic: 'M', area: 'skinfall', moves: ['dish_downlink', 'dish_sidelobe', 'dish_intercept', 'dish_uplift'], passives: ['dish_gain', 'dish_nullsteer'],
  sprite: ['3......3', '33.22.33', '.322223.', '.211112.', '.222222.', '.422224.', '.44.444.', '44144144'], c: ['#dadee6', '#d19a21', '#147e35'],
  fit: 'says the last thing back louder', pegs: 5, entry: 'Off the Dropfield. Points its face at whoever spoke last and says it back louder. Five cowries. FIVE COWRIES.' });
sp({ id: 'debris', name: 'Kuzumen', types: ['STONE'], basic: 'P', area: 'skinfall', moves: ['debris_swarf', 'debris_harpoon', 'debris_plating', 'debris_strafe'], passives: ['debris_hot', 'debris_fins'],
  sprite: ['4..4..4.', '.4..4...', '..2222..', '.211112.', '22333322', '22222222', '2222.222', '11111111'], c: ['#65616b', '#ec4e2e', '#dddde5'],
  fit: 'runs hot and has to sit down', pegs: 3, entry: 'Hull scrap fused into one lump, one eye bigger than the other. Runs hot and has to sit down. Three cowries. I know the feeling.' });

// ================================================================ tundra
sp({ id: 'musk', name: 'Bosshi', types: ['BEAST'], basic: 'P', area: 'tundra', moves: ['musk_bowl', 'musk_sweep', 'musk_hardfreeze', 'musk_corral'], passives: ['musk_coat', 'musk_wall'],
  sprite: ['.....3.3', '.....3.3', '22..3333', '2222222.', '222.2212', '24244222', '2.2.42..', '1.1.11..'], c: ['#5e483a', '#c0e4f7', '#bab09b'],
  fit: 'gathers frost on what it looks at', pegs: 4, entry: 'A musk ox\'s cast, left standing in the snow. Eyes down by its knees. Frost on whatever it looks at. I ask four cowries, from behind it.' });
sp({ id: 'serac', name: 'Hyocies', types: ['TIDE'], basic: 'M', area: 'tundra', moves: ['serac_spall', 'serac_icefloor', 'serac_spindrift', 'serac_icefall'], passives: ['serac_shatter', 'serac_deepcold'],
  sprite: ['33333333', '22222224', '21222124', '22222224', '222.2224', '22222224', '24444444', '.4....4.'], c: ['#bddded', '#f9fcff', '#5a82b9'],
  fit: 'freezes your boots to the floor', pegs: 4, entry: 'Plus a block that walked off the glacier. Stand still near it and your boots freeze to the floor. Pay the four cowries on the move.' });

// ================================================================ iceshelf
sp({ id: 'selkie', name: 'Phoshi', types: ['TIDE'], basic: 'M', area: 'iceshelf', moves: ['selkie_backwash', 'selkie_bubble', 'selkie_gift', 'selkie_seventh'], passives: ['selkie_lull', 'selkie_sealegs'],
  sprite: ['..2222..', '.212212.', '.223322.', '22111122', '21311312', '221.1122', '24122142', '.22..22.'], c: ['#7b8189', '#5becdc', '#465464'],
  fit: 'hides its own shell', pegs: 5, entry: 'What a seal-woman left on the ice. Somebody hid it in a chest once. Sleeps where it likes now. Five cowries. Don\'t tell her husband.' });
sp({ id: 'walrus', name: 'Rosmachi', types: ['TIDE'], basic: 'P', area: 'iceshelf', moves: ['walrus_flipper', 'walrus_snowball', 'walrus_shardwall', 'walrus_haymaker'], passives: ['walrus_thirdblow', 'walrus_pileon'],
  sprite: ['4.4444.4', '44444444', '44222244', '.212212.', '23222232', '23111132', '.222.22.', '22.22.22'], c: ['#9c654d', '#f1e7cd', '#3d4d6c'],
  fit: 'punches hardest every third time', pegs: 3, entry: 'Tusks growing up instead of down. Every third punch it throws is the one people talk about. Three cowries. People talk.' });
sp({ id: 'berg', name: 'Gevuori', types: ['TIDE'], basic: 'P', area: 'iceshelf', moves: ['berg_bit', 'berg_groan', 'berg_growler', 'berg_capsize'], passives: ['berg_undercut', 'berg_keel'],
  sprite: ['...22...', '..2222..', '.244442.', '24344342', '244.4442', '44111144', '11111111', '1.1..1.1'], c: ['#eef6fd', '#57e8f7', '#2f5ca3'],
  fit: 'keeps most of itself under', pegs: 5, entry: 'Off the shelf. Most of it under the ice, face and all. Five cowries for the top. The rest is extra.' });
sp({ id: 'narwhal', name: 'Sarkaku', types: ['TIDE'], basic: 'P', area: 'iceshelf', moves: ['narwhal_lance', 'narwhal_breach', 'narwhal_podrush', 'narwhal_hornshot'], passives: ['narwhal_sighting', 'narwhal_ivory'],
  sprite: ['44443444', '44443444', '....3...', '..2232..', '.222222.', '21222212', '222.2222', '.222222.'], c: ['#808e9e', '#f1e7cd', '#a7c2d2'],
  fit: 'waits and lines up its horn', pegs: 4, entry: 'Which waits under the shelf lining its tusk up on you. The longer it waits the worse. Four cowries, before it\'s lined up.' });
sp({ id: 'rime', name: 'Puikria', types: ['ROOT'], basic: 'M', area: 'iceshelf', moves: ['rime_petal', 'rime_grip', 'rime_bloom', 'rime_field'], passives: ['rime_clearair', 'rime_cracked'],
  sprite: ['.2.22.2.', '21122112', '14122141', '24133142', '.222222.', '.334433.', '.244442.', '...23...'], c: ['#e4eff8', '#7bd0ec', '#ffffff'],
  fit: 'brings its own cold air', pegs: 3, entry: 'Off the eaves of a house, an icicle that fell in love with whoever lived there and came to life over it. Three cowries. It still melts a little when they pass.' });
sp({ id: 'auk', name: 'Ruokme', types: ['BEAST'], basic: 'P', area: 'iceshelf', moves: ['auk_flurry', 'auk_carom', 'auk_bellyflop', 'auk_toboggan'], passives: ['auk_ricochet', 'auk_lastpair'],
  sprite: ['..2222..', '.244442.', '.214412.', '..2332..', '.244442.', '22444422', '224.4422', '.333333.'], c: ['#44404e', '#d48d28', '#e9ebef'],
  fit: 'keeps going after the last one', pegs: 6, entry: 'Off the last pair of great auks, gone in my grandfather\'s time. Their shells kept going. Six cowries, and I\'d rather you kept it.' });

// ================================================================ hiltroad
sp({ id: 'cuirass', name: 'Losari', types: ['GEAR'], basic: 'P', area: 'hiltroad', moves: ['cuirass_rivet', 'cuirass_platespin', 'cuirass_burnish', 'cuirass_hammerout'], passives: ['cuirass_dented', 'cuirass_riveted'],
  sprite: ['..2222..', '.244442.', '.434434.', '22222222', '22333322', '2333.332', '22333322', '.22..22.'], c: ['#717b8b', '#e6ecf2', '#433f50'],
  fit: 'gets harder with every dent', pegs: 4, entry: 'A soldier\'s breastplate, off the Hilt road. Face where the heart went. Every dent makes it harder to dent, and dearer. Four cowries today.' });
sp({ id: 'pennon', name: 'Hatari', types: ['STAR'], basic: 'M', area: 'hiltroad', moves: ['pennon_snap', 'pennon_rally', 'pennon_plant', 'pennon_unfurl'], passives: ['pennon_windcatch', 'pennon_rallying'],
  sprite: ['3.......', '.2.44...', '.24444.4', '.2414.44', '.2444414', '.24.44..', '.2......', '222.....'], c: ['#54443a', '#fbdc7c', '#c13142'],
  fit: 'snaps once before it moves', pegs: 3, entry: 'And a battle banner, pole for a backbone. Snaps once before it does anything. Hand it three cowries and it snaps at those too.' });

// ================================================================ battlefield
sp({ id: 'tang', name: 'Glakago', types: ['GEAR'], basic: 'P', area: 'battlefield', moves: ['tang_chip', 'tang_spin', 'tang_scabbard', 'tang_cuts'], passives: ['tang_edgeguard', 'tang_twostep'],
  sprite: ['...22...', '..2222..', '..2332..', '..2222..', '444.4444', '...33...', '..3333..', '...44...'], c: ['#bdc5d1', '#cb1d27', '#ca9415'],
  fit: 'spins when it is cornered', pegs: 5, entry: 'The half of a sword that stays in the grip. Spins when it\'s cornered. Five cowries for half a sword. The other half\'s dearer.' });
sp({ id: 'buckler', name: 'Scutate', types: ['GEAR'], basic: 'P', area: 'battlefield', moves: ['buckler_rim', 'buckler_vault', 'buckler_parry', 'buckler_fall'], passives: ['buckler_umbo', 'buckler_riposte'],
  sprite: ['..3333..', '.222222.', '.211112.', '44444444', '422.2224', '42233224', '42222224', '.444444.'], c: ['#c38c43', '#c11b24', '#5a3a28'],
  fit: 'counts the blows it takes', pegs: 4, entry: 'A round shield, one eye where the boss should be. Counts the blows it takes and pays each one back. Four cowries. Honest, that.' });
sp({ id: 'destrier', name: 'Umatsu', types: ['BEAST'], basic: 'P', area: 'battlefield', moves: ['destrier_rearup', 'destrier_couch', 'destrier_joust', 'destrier_gallop'], passives: ['destrier_mounted', 'destrier_courage'],
  sprite: ['4......4', '44.33.44', '.444444.', '.412214.', '.42.224.', '44222244', '4.2222.4', '1.1..1.1'], c: ['#805037', '#e1b948', '#9a9eaa'],
  fit: 'climbs back on after a fall', pegs: 5, entry: 'Plus a war horse with the barding still on. Throw it and it gets up and climbs back on itself. Five cowries and a brush.' });
sp({ id: 'mangonel', name: 'Mangonel', types: ['STONE'], basic: 'P', area: 'battlefield', moves: ['mangonel_lob', 'mangonel_hurl', 'mangonel_payload', 'mangonel_ratchet'], passives: ['mangonel_cradle', 'mangonel_creak'],
  sprite: ['..2222..', '.222222.', '22122122', '222.2222', '33222233', '33222233', '.22.222.', '44....44'], c: ['#7a7a7f', '#c2beb2', '#47474d'],
  fit: 'throws what it catches', pegs: 5, entry: 'A catapult, arm growing out of its head. Throws what it catches and gets bigger as it goes. Five cowries. Stand behind it to pay.' });
sp({ id: 'sallet', name: 'Kabura', types: ['STONE'], basic: 'P', area: 'battlefield', moves: ['sallet_hotbreath', 'sallet_browbash', 'sallet_visor', 'sallet_drake'], passives: ['sallet_oldblood', 'sallet_wyrmscale'],
  sprite: ['..2222..', '.222222.', '22222222', '21122112', '222.2224', '.2222244', '..4..4.3', '.44..44.'], c: ['#aab2be', '#db5434', '#156d5c'],
  fit: 'has a drake in it some days', pegs: 5, entry: 'A helmet on two short legs, from the battlefield. Some days there\'s a drake in it. Five cowries, more on drake days.' });
sp({ id: 'fletch', name: 'Sagitli', types: ['ROOT'], basic: 'P', area: 'battlefield', moves: ['fletch_nock', 'fletch_sheaf', 'fletch_overshoot', 'fletch_overdraw'], passives: ['fletch_neverlanded', 'fletch_rimed'],
  sprite: ['......22', '.....212', '....2222', '..2.22..', '.2222...', '3.44....', '.33.....', '3.3.....'], c: ['#d1e1ec', '#95c4ea', '#55647a'],
  fit: 'never lands', pegs: 4, entry: 'An arrow that never came down. Sits in the quiver and comes out sharper. Four cowries. Somebody\'s still waiting under it.' });

// ================================================================ moonbed
sp({ id: 'image', name: 'Kugami', types: ['STAR'], basic: 'M', area: 'moonbed', moves: ['image_glint', 'image_invert', 'image_lure', 'image_mirrortake'], passives: ['image_afterimage', 'image_calm'],
  sprite: ['.4..2...', '444222..', '4.42122.', '44422222', '.4422222', '.44.222.', '.4.2..2.', '44.3..3.'], c: ['#f3dbab', '#2bc1c9', '#8777a5'],
  fit: 'does what you were about to do', pegs: 6, entry: 'Which is a reflection the lakebed kept when the moon\'s shell rose. Does what you were about to do. Six cowries. You were about to pay.' });
sp({ id: 'skipper', name: 'Salgoro', types: ['TIDE'], basic: 'P', area: 'moonbed', moves: ['skipper_dart', 'skipper_hop', 'skipper_barbfin', 'skipper_chum'], passives: ['skipper_slick', 'skipper_sharkwater'],
  sprite: ['.22..22.', '21122112', '22222222', '21333312', '22222243', '..22244.', '..12441.', '..2442..'], c: ['#4f9dbd', '#f2f2ee', '#604737'],
  fit: 'hops when you look at it', pegs: 3, entry: 'A mudskipper. Hops when you look at it. Something bigger follows it about in the mud. Three cowries, and I\'m not asking what.' });
sp({ id: 'silt', name: 'Liemus', types: ['STONE'], basic: 'M', area: 'moonbed', moves: ['silt_sludge', 'silt_cloud', 'silt_mirepit', 'silt_sink'], passives: ['silt_silting', 'silt_lakebed'],
  sprite: ['4......4', '44.22.44', '.222222.', '22322322', '22222222', '22433422', '224.4422', '22.22.22'], c: ['#636171', '#9ce341', '#3d3b48'],
  fit: 'holds you by the ankles', pegs: 3, entry: 'Silt off the Moonwater\'s bed, eyes at the bottom. You go in to the ankles and stop. I\'m asking three cowries, from dry ground.' });
sp({ id: 'spawn', name: 'Ranaru', types: ['BEAST'], basic: 'M', area: 'moonbed', moves: ['spawn_flick', 'spawn_hex', 'spawn_tongue', 'spawn_frogspawn'], passives: ['spawn_toadskin', 'spawn_amphibian'],
  sprite: ['........', '.22..22.', '21222212', '22222222', '.23.332.', '.222222.', '4.2..2.4', '44....44'], c: ['#4e943c', '#dce4ac', '#3b3d45'],
  fit: 'turns things into frogs', pegs: 3, entry: 'And a frog with its mouth on its belly. Turns other things into frogs for a while. Three cowries. I was a frog Tuesday.' });
sp({ id: 'lune', name: 'Lunkuu', types: ['STAR'], basic: 'M', area: 'moonbed', moves: ['lune_facet', 'lune_beam', 'lune_glaive', 'lune_totality'], passives: ['lune_rebound', 'lune_waxing'],
  sprite: ['4......4', '44.22.44', '.422224.', '.212212.', '.222222.', '33.22.33', '.33..33.', '3......3'], c: ['#d3d7e7', '#d4b454', '#4a4a88'],
  fit: 'throws its edges about', pegs: 6, entry: 'Off the moon\'s shell, a piece that broke on the way up. Throws its edges about and they come back. Six cowries. Mine didn\'t.' });

// ================================================================ crater
sp({ id: 'siderite', name: 'Siderite', types: ['STONE'], basic: 'P', area: 'crater', moves: ['siderite_knock', 'siderite_skewer', 'siderite_magnetize', 'siderite_poleswap'], passives: ['siderite_remanence', 'siderite_dense'],
  sprite: ['1.2222.1', '12222221', '22322322', '22222222', '23233232', '22222222', '444.4444', '4.4444.4'], c: ['#645452', '#5cc4fb', '#998169'],
  fit: 'pulls at anything iron', pegs: 5, entry: 'An iron stone off the fallen star. Walk past it and your buckles try to stay. Five cowries, and whatever buckles it keeps.' });
sp({ id: 'slag', name: 'Kuoria', types: ['GEAR'], basic: 'P', area: 'crater', moves: ['slag_dross', 'slag_spill', 'slag_pour', 'slag_remelt'], passives: ['slag_unstable', 'slag_skim'],
  sprite: ['..1111..', '.111111.', '.232132.', '.222122.', '.222222.', '..1.11..', '..22423.', '..12214.'], c: ['#534a51', '#7bfa5a', '#9e8e87'],
  fit: 'brews until it bursts', pegs: 4, entry: 'Plus furnace slag with a brew going in it. Sell it on before the brew goes off. Four cowries. I\'m selling it on.' });

// ================================================================ glassdesert
sp({ id: 'cullet', name: 'Vilasi', types: ['STONE'], basic: 'M', area: 'glassdesert', moves: ['cullet_sliver', 'cullet_ring', 'cullet_mirage', 'cullet_grip'], passives: ['cullet_glazed', 'cullet_sharp'],
  sprite: ['.4...44.', '.44..444', '.4444434', '.4344444', '.4444434', '.444.444', '..11131.', '..11131.'], c: ['#c3d3e3', '#b565f3', '#373352'],
  fit: 'grips and cuts', pegs: 5, entry: 'Off the glass desert, broken. Holds whatever it grips until both of you stop. Five cowries, handed over in gloves.' });
sp({ id: 'telson', name: 'Scorri', types: ['BEAST'], basic: 'P', area: 'glassdesert', moves: ['telson_barb', 'telson_seep', 'telson_pincer', 'telson_cripple'], passives: ['telson_venomtail', 'telson_shell'],
  sprite: ['4......4', '44.22.44', '44222244', '42322324', '.22.222.', '..2332..', '..2..2..', '.3....3.'], c: ['#347433', '#b1ef4e', '#2f3c31'],
  fit: 'stings low and slow', pegs: 5, entry: 'Plus the tail end of a scorpion. Walks on the sting and keeps the rest up top. Five cowries. Don\'t shake on it.' });
sp({ id: 'cholla', name: 'Spitoge', types: ['ROOT'], basic: 'P', area: 'glassdesert', moves: ['cholla_jump', 'cholla_jointdrop', 'cholla_spinebed', 'cholla_grab'], passives: ['cholla_deepspines', 'cholla_storedwater'],
  sprite: ['.3.33.3.', '3.2222.3', '.222222.', '32122123', '.222222.', '3.2222.3', '.3.33.3.', '..4444..'], c: ['#7ba051', '#efe7af', '#4a5930'],
  fit: 'jumps onto whoever passes', pegs: 4, entry: 'A jumping cactus. It does jump. Pull one joint out and another\'s already in. Four cowries, which it jumped at.' });
sp({ id: 'erg', name: 'Sunaka', types: ['STONE'], basic: 'M', area: 'glassdesert', moves: ['erg_sandblast', 'erg_saltation', 'erg_slipface', 'erg_dunewall'], passives: ['erg_grain', 'erg_sandsea'],
  sprite: ['.4....4.', '.44..44.', '..4.44..', '.44.444.', '.222222.', '.444444.', '..3.33..', '.333333.'], c: ['#efe7d7', '#5b4d60', '#8d0101'],
  fit: 'buds polyps and stops at the door', pegs: 4, entry: 'Which is a dune, with a dead reef in it. Comes up the road at night and stops at the door. Buds little ones. Four cowries, and two shovels.' });
sp({ id: 'haze', name: 'Haze', types: ['STAR'], basic: 'M', area: 'glassdesert', moves: ['haze_glare', 'haze_waver', 'haze_dew', 'haze_thermal'], passives: ['haze_mirror', 'haze_veil'],
  sprite: ['..2222..', '.212212.', '21111112', '21311412', '21111112', '.222222.', '2.2222.2', '22.22.22'], c: ['#e9ddc1', '#dc9307', '#4281ae'],
  fit: 'mixes three weathers', pegs: 6, entry: 'The wobble over hot glass, left behind. Keeps three weathers in its mouth and mixes them. Six cowries. Mixing\'s free.' });
sp({ id: 'bonedry', name: 'Calkuro', types: ['BEAST'], basic: 'P', area: 'glassdesert', moves: ['bonedry_marrow', 'bonedry_stare', 'bonedry_crack', 'bonedry_ossuary'], passives: ['bonedry_unburied', 'bonedry_grudge'],
  sprite: ['.3.33.3.', '.333333.', '.222222.', '.232232.', '.211112.', '44222244', '444.4443', '44444443'], c: ['#efebe3', '#39e163', '#34403a'],
  fit: 'gets up once more than you expect', pegs: 5, entry: 'A desert skull, bleached white as nacre. Gets up once more than you\'d think. Five cowries. Then once more.' });

// ================================================================ handsorchard
sp({ id: 'shears', name: 'Hasafex', types: ['GEAR'], basic: 'P', area: 'handsorchard', moves: ['shears_snip', 'shears_lop', 'shears_oil', 'shears_lockblades'], passives: ['shears_notched', 'shears_snapback'],
  sprite: ['2......2', '22....22', '.244442.', '.211112.', '33222233', '33222233', '33.22.33', '3.2..2.3'], c: ['#bdc5d1', '#b90e1d', '#bf9008'],
  fit: 'picks one branch and cuts only that', pegs: 6, entry: 'Off the Hands\' orchard, pruning shears, eye in the pivot. Picks one branch and cuts only that one. Six cowries. Tidy.' });
sp({ id: 'glove', name: 'Tebukas', types: ['BEAST'], basic: 'P', area: 'handsorchard', moves: ['glove_grub', 'glove_springoff', 'glove_helping', 'glove_unclench'], passives: ['glove_cuffed', 'glove_handspring'],
  sprite: ['.2....2.', '.232232.', '.312213.', '43122134', '42222224', '..4444..', '..3333..', '.333333.'], c: ['#d3bb8b', '#8b1a30', '#378847'],
  fit: 'throws itself at a friend', pegs: 5, entry: 'And a gardener\'s glove, face in the palm. Throws itself at a friend and the friend lands swinging. Five cowries. No pairs.' });
sp({ id: 'scion', name: 'Surcuki', types: ['ROOT'], basic: 'P', area: 'handsorchard', moves: ['scion_cleft', 'scion_budding', 'scion_splice', 'scion_ingrowth'], passives: ['scion_rootstock', 'scion_union'],
  sprite: ['..44.3..', '.444333.', '44443333', '41443313', '44443333', '.442233.', '..2.22..', '.222222.'], c: ['#816248', '#84a2c1', '#791723'],
  fit: 'takes after whatever it beats', pegs: 6, entry: 'A grafted branch. Takes after whichever tree it beats first. Six cowries. Grafton would charge seven.' });
sp({ id: 'espalier', name: 'Napirus', types: ['ROOT'], basic: 'M', area: 'handsorchard', moves: ['espalier_spur', 'espalier_propup', 'espalier_saprise', 'espalier_lattice'], passives: ['espalier_trained', 'espalier_pleached'],
  sprite: ['...44...', '...22...', '..2222..', '32122123', '32122123', '33222233', '3.4..4.3', '..4..4..'], c: ['#bad76c', '#870c0c', '#58a84e'],
  fit: 'feeds whoever leans on it', pegs: 6, entry: 'A pear tree trained flat on the orchard wall. Lives on the wall and feeds whoever leans there. Six cowries, pears free.' });
sp({ id: 'rung', name: 'Scalago', types: ['ROOT'], basic: 'M', area: 'handsorchard', moves: ['rung_rap', 'rung_crossbar', 'rung_reststep', 'rung_standstill'], passives: ['rung_stepup', 'rung_footing'],
  sprite: ['..4444..', '.441144.', '.431134.', '.411114.', '..4444..', '.44.344.', '.443244.', '..4444..'], c: ['#ef4343', '#efcf5f', '#266875'],
  fit: 'climbs one step at a time', pegs: 6, entry: 'Plus a rung off a ladder on the Climb. Every turn it takes, it\'s a step higher. Six cowries on the bottom step.' });

// ================================================================ margin
sp({ id: 'nought', name: 'Nolhaku', types: ['STAR'], basic: 'M', area: 'margin', moves: ['nought_edge', 'nought_erase', 'nought_path', 'nought_haunting'], passives: ['nought_spread', 'nought_emptied'],
  sprite: ['.222222.', '.222222.', '.212212.', '.223322.', '.222222.', '.22.222.', '.222244.', '.22244..'], c: ['#f3f1f7', '#9b83ca', '#72688e'],
  fit: 'spreads a hit thin', pegs: 7, entry: 'A blank off the edge where nothing was. Hit it and every one of you feels it. Seven cowries for nothing. Bargain.' });
sp({ id: 'terminus', name: 'Owanis', types: ['STONE'], basic: 'P', area: 'margin', moves: ['terminus_lastmile', 'terminus_deadend', 'terminus_toll', 'terminus_roadsend'], passives: ['terminus_endline', 'terminus_terminal'],
  sprite: ['23232323', '.444444.', '44311344', '4.4444.4', '44444444', '4.4444.4', '4.4..4.4', '4.4..4.4'], c: ['#eeeeee', '#c60117', '#44404e'],
  fit: 'keeps whatever reaches it', pegs: 7, entry: 'The end of a road. Things that reach it stay. Charges at the barrier. Seven cowries, and that\'s the end of it.' });
sp({ id: 'horizon', name: 'Finihei', types: ['STAR'], basic: 'M', area: 'margin', moves: ['horizon_skyline', 'horizon_widen', 'horizon_farpoint', 'horizon_skyfall'], passives: ['horizon_ring', 'horizon_accretion'],
  sprite: ['.3.33.3.', '2.3333.2', '.242242.', '24122142', '24122142', '..3333..', '4122221.', '.42222..'], c: ['#424f9e', '#e8c858', '#8695cb'],
  fit: 'keeps its stars turning', pegs: 7, entry: 'Which has its stars still going round it, this horizon. They fall when it asks. Seven cowries. Never asks me.' });
sp({ id: 'murk', name: 'Murk', types: ['TIDE'], basic: 'P', area: 'margin', moves: ['murk_coldcut', 'murk_pall', 'murk_lurk', 'murk_fogbound'], passives: ['murk_unseen', 'murk_smother'],
  sprite: ['4......4', '44.22.44', '.222222.', '.232232.', '..2222..', '2.2.22.2', '.22222.4', '2.2..2.4'], c: ['#7d739b', '#f5d655', '#48445c'],
  fit: 'cuts whoever is not watching', pegs: 7, entry: 'Off the tide at the edge, the fog. Cuts deepest at whoever hasn\'t touched it yet. Seven cowries. Touch it first.' });
sp({ id: 'undine', name: 'Avachi', types: ['TIDE'], basic: 'M', area: 'margin', moves: ['undine_fathom', 'undine_kelphold', 'undine_glimpse', 'undine_undersong'], passives: ['undine_undercurrent', 'undine_toobig'],
  sprite: ['4.4..4.4', '.4.44.4.', '33333333', '22444422', '24144142', '244.4442', '22433422', '22222222'], c: ['#2e4a68', '#d75d7e', '#bfd7cf'],
  fit: 'is too big to see whole', pegs: 7, entry: 'Out past the edge, something drowned. This is the part that fits in the Register. Seven cowries for this part. Rest on request.' });
sp({ id: 'lip', name: 'Hebrum', types: ['BEAST'], basic: 'P', area: 'margin', moves: ['lip_gnaw', 'lip_pullover', 'lip_fester', 'lip_pullapart'], passives: ['lip_heaped', 'lip_overhang'],
  sprite: ['........', '.212212.', '22222222', '23232323', '11111111', '23232323', '444.4444', '.222222.'], c: ['#e0b1a9', '#f8f4f0', '#624250'],
  fit: 'pulls things over the edge', pegs: 7, entry: 'And a piece of the Lip that walked off. Pulls things over the edge and gets heavier. Seven cowries by weight. Today\'s weight.' });

// ================================================================ slack
sp({ id: 'rumple', name: 'Shiruga', types: ['ROOT'], basic: 'M', area: 'slack', moves: ['rumple_ruck', 'rumple_buckle', 'rumple_pucker', 'rumple_upfold'], passives: ['rumple_foldover', 'rumple_give'],
  sprite: ['..4444..', '.444444.', '.412214.', '.422224.', '44444444', '44333344', '44.44.44', '44444444'], c: ['#9e805e', '#7ad959', '#50405e'],
  fit: 'rises at the other corner', pegs: 6, entry: 'Off the Shallows, a wrinkle in loose ground. Step on one corner and the other corners come up. Six cowries. I\'d iron it.' });
sp({ id: 'sag', name: 'Notbomi', types: ['TIDE'], basic: 'M', area: 'slack', moves: ['sag_runoff', 'sag_coldhollow', 'sag_sinkhole', 'sag_subside'], passives: ['sag_sediment', 'sag_seepage'],
  sprite: ['4......4', '44.22.44', '44222244', '42322324', '44222244', '.222222.', '.22.222.', '.222222.'], c: ['#7d634c', '#e2eef2', '#493f47'],
  fit: 'lays down layers as it goes', pegs: 6, entry: 'And a dip in the Shallows that fills with salt water from below. Lays down mud in layers and wears them. Six cowries, muddy.' });
sp({ id: 'furrow', name: 'Vakone', types: ['ROOT'], basic: 'M', area: 'slack', moves: ['furrow_split', 'furrow_maze', 'furrow_underfold', 'furrow_circlet'], passives: ['furrow_walker', 'furrow_illfooting'],
  sprite: ['.3....3.', '.222422.', '21224212', '22242222', '322.4223', '22242222', '.222422.', '3.2..2.3'], c: ['#9a8262', '#962f97', '#352933'],
  fit: 'crowns whoever follows it', pegs: 7, entry: 'A craze that got up out of the ground and walked off. Sets a ring of thorns on whoever follows. Seven cowries. Walk beside it.' });
