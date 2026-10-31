import './kits3';
import { sp } from './speciesdb';

// ================================================================ meadow
sp({ id: 'dandle', name: 'Tanpoka', types: ['ROOT'], basic: 'M', area: 'meadow',
  moves: ['dandle_sow', 'dandle_spines', 'dandle_snarl', 'dandle_thornburst'], passives: ['dandle_seedhead', 'dandle_garden'],
  sprite: ['.2.22.2.', '22222222', '22222222', '21222212', '.222222.', '...44...', '.44.344.', '...44...'], c: ['#f2eee0', '#f0a820', '#6aa048'],
  fit: 'blows apart and grows back where it lands', pegs: 2,
  entry: 'Plus a dandelion gone to seed. It plants seeds in whoever it argues with. Two cowries. It\'s arguing with me now.' });
sp({ id: 'mawkin', name: 'Mawkin', types: ['ROOT'], basic: 'M', area: 'meadow',
  moves: ['mawkin_rattle', 'mawkin_terrify', 'mawkin_glean', 'mawkin_crowstorm'], passives: ['mawkin_effigy', 'mawkin_dread'],
  sprite: ['...44...', '..4444..', '.444444.', '.212212.', '.222222.', '33333333', '24.44442', '.24..42.'], c: ['#e8d8b0', '#c47a50', '#5e5478'],
  fit: 'stands in a field and frightens what comes', pegs: 2,
  entry: 'A scarecrow\'s casing, from March. Crows still avoid landing near it. Two cowries, or one courageous crow.' });

// ================================================================ tanning
sp({ id: 'fleam', name: 'Teraba', types: ['GEAR'], basic: 'P', area: 'tanning',
  moves: ['fleam_pierce', 'fleam_rend', 'fleam_notch', 'fleam_openvein'], passives: ['fleam_lodged', 'fleam_letting'],
  sprite: ['.4....4.', '.4....4.', '..2222..', '.2322324', '..2.22.4', '.2222224', '.22..224', '..3..3.4'], c: ['#394b53', '#5dedcd', '#989fa7'],
  fit: 'leaves a little of itself in everything', pegs: 3,
  entry: 'From a farrier\'s kit. Six blades, no handle. It leaves one in you. Three cowries for however many it has left.' });
sp({ id: 'vat', name: 'Cutaru', types: ['TIDE'], basic: 'M', area: 'tanning',
  moves: ['vat_rollcask', 'vat_bodyslam', 'vat_drinkup', 'vat_caskburst'], passives: ['vat_ferment', 'vat_hops'],
  sprite: ['.444444.', '.333333.', '.232222.', '.212212.', '.22.222.', '.444444.', '..1..1..', '..1..1..'], c: ['#9e5a07', '#8ab8cc', '#602c00'],
  fit: 'holds something that is still working', pegs: 3,
  entry: 'Plus a curing vat that walked off half full. What\'s inside is still curing. Three cowries for the vat. I wouldn\'t price what\'s inside.' });
sp({ id: 'wain', name: 'Karrum', types: ['GEAR'], basic: 'P', area: 'tanning',
  moves: ['wain_trundle', 'wain_rut', 'wain_chock', 'wain_runaway'], passives: ['wain_creaking', 'wain_runson'],
  sprite: ['4......4', '44.22.44', '.422224.', '.232212.', '.222222.', '44421212', '4.421212', '444.2.2.'], c: ['#d9cdb1', '#e85522', '#4e444c'],
  fit: 'gets harder to stop the longer it rolls', pegs: 4,
  entry: 'From a hay cart. It starts slow and doesn\'t stop. It went through the grotto wall once. Four cowries, plus the wall.' });

// ================================================================ undermeadow
sp({ id: 'talpa', name: 'Talpara', types: ['BEAST'], basic: 'P', area: 'undermeadow',
  moves: ['talpa_gnaw', 'talpa_erupt', 'talpa_burrow', 'talpa_breach'], passives: ['talpa_earthfed', 'talpa_tremor'],
  sprite: ['..2222..', '.222222.', '21222212', '22233222', '.243342.', '33.44433', '33444433', '..2..2..'], c: ['#8c8898', '#e4b4bc', '#feeac5'],
  fit: 'comes up where you were standing', pegs: 2,
  entry: 'A mole\'s shell, pink star on the nose. It comes up under you and goes back down. Two cowries, paid underground.' });
sp({ id: 'cellar', name: 'Kucella', types: ['STONE'], basic: 'P', area: 'undermeadow',
  moves: ['cellar_coldbreath', 'cellar_shelf', 'cellar_frostrot', 'cellar_overwinter'], passives: ['cellar_borrowed', 'cellar_coldkeep'],
  sprite: ['.4....4.', '.422224.', '.212212.', '44444444', '43444434', '44444444', '4344.434', '.444444.'], c: ['#404858', '#8bebeb', '#8d7d6b'],
  fit: 'keeps things cold through the bad months', pegs: 4,
  entry: 'From a root cellar in Turnstone. Hit it when it\'s nearly empty and it fills back up. Four cowries. The jam\'s gone.' });
sp({ id: 'lumbric', name: 'Mimato', types: ['ROOT'], basic: 'P', area: 'undermeadow',
  moves: ['lumbric_stretch', 'lumbric_wriggle', 'lumbric_fling', 'lumbric_bounce'], passives: ['lumbric_split', 'lumbric_segments'],
  sprite: ['..2222..', '.222222.', '21222212', '22322322', '.223322.', '44.44444', '.444444.', '.22..22.'], c: ['#dd8272', '#f7eddd', '#934951'],
  fit: 'keeps going when broken in two', pegs: 1,
  entry: 'A lugworm shell on the sand has a face at each end. Split it. Both halves return. Each half is one cowrie. How many are in play?' });
sp({ id: 'brogue', name: 'Kupas', types: ['GEAR'], basic: 'P', area: 'undermeadow',
  moves: ['brogue_hobnail', 'brogue_scuff', 'brogue_tread', 'brogue_longmarch'], passives: ['brogue_wornin', 'brogue_hardwearing'],
  sprite: ['.2..2..4', '.22.22.4', '.22222.4', '.23232.4', '.2222244', '.44444.4', '2222.2.4', '1.1.11.4'], c: ['#5f473d', '#9b66dd', '#e0b852'],
  fit: 'remembers every step it took', pegs: 3,
  entry: 'A hobnailed boot that nobody wears. It keeps every nail it drives into you. Three cowries. Left foot only.' });
sp({ id: 'pod', name: 'Herya', types: ['ROOT'], basic: 'M', area: 'undermeadow',
  moves: ['pod_pop', 'pod_setpods', 'pod_shuck', 'pod_shower'], passives: ['pod_ripening', 'pod_seedcase'],
  sprite: ['..2222..', '.222222.', '22333322', '23133132', '22333322', '.22.222.', '..2..2..', '..1..1..'], c: ['#a8c48c', '#ece4b4'],
  fit: 'ripens and goes off', pegs: 2,
  entry: 'A beach pea pod, sized like a cat. The peas stare back. It sprouts more pods and kicks them away. Two cowries per pod.' });
sp({ id: 'hatch', name: 'Tobiku', types: ['STONE'], basic: 'M', area: 'undermeadow',
  moves: ['hatch_latch', 'hatch_shutin', 'hatch_bangshut', 'hatch_downbelow'], passives: ['hatch_staleair', 'hatch_heavylid'],
  sprite: ['.3..3...', '.3..3...', '.44224..', '..222.42', '.3.44.42', '3.111.42', '.311.14.', '.111111.'], c: ['#bdeeee', '#e1c2fe', '#443e57'],
  fit: 'shuts things in for a while', pegs: 5,
  entry: 'A cellar door with an eye where the handle should be. What it traps inside eventually returns. Five cowries. Knock first.' });
sp({ id: 'chirr', name: 'Koolus', types: ['BEAST'], basic: 'P', area: 'undermeadow',
  moves: ['chirr_trill', 'chirr_stridulate', 'chirr_cavehop', 'chirr_lastnotes'], passives: ['chirr_fourth', 'chirr_deadquiet'],
  sprite: ['.3....3.', '..3..3..', '4.2222.4', '44122144', '442.2244', '.422224.', '.4.22.4.', '.4....4.'], c: ['#ddd0b0', '#cf8070', '#745f4b'],
  fit: 'counts to four and then shouts', pegs: 3,
  entry: 'A cave cricket with its knees bent backward. It chirps three times, softly. Three cowries, one per chirp.' });

// ================================================================ knucklebones
sp({ id: 'talus', name: 'Honevel', types: ['STONE'], basic: 'P', area: 'knucklebones',
  moves: ['talus_tossup', 'talus_bonechip', 'talus_eggon', 'talus_jackstones'], passives: ['talus_twice', 'talus_shaken'],
  sprite: ['44....44', '444..444', '.223322.', '.212212.', '.222222.', '4.4..444', '444..444', '44....44'], c: ['#ece2c8', '#b06060', '#b8a080'],
  fit: 'lands on the same side twice', pegs: 2,
  entry: 'A giant\'s knucklebone from the Knucklebones. It\'s hollow, with a mouth over its eyes. Throw it, and it lands twice. Two cowries.' });
sp({ id: 'molar', name: 'Hamkuba', types: ['STONE'], basic: 'P', area: 'knucklebones',
  moves: ['molar_cusp', 'molar_rupture', 'molar_gnash', 'molar_chewup'], passives: ['molar_eatswell', 'molar_heft'],
  sprite: ['.22..22.', '.222222.', '21122112', '22222222', '.333333.', '444..444', '4.4..444', '.44..44.'], c: ['#f0ece0', '#b8606c', '#d0b890'],
  fit: 'gets bigger on what it eats', pegs: 4,
  entry: 'A giant\'s back tooth, hollow as a whelk shell. It peers out from its roots. It grows on whatever it chews. Four cowries. Do not bite.' });
sp({ id: 'atlas', name: 'Kaukubi', types: ['STONE'], basic: 'P', area: 'knucklebones',
  moves: ['atlas_quills', 'atlas_marrow', 'atlas_hunker', 'atlas_shrugoff'], passives: ['atlas_turnedback', 'atlas_quillbed'],
  sprite: ['..4.4...', '.444444.', '44444444', '44444212', '44.42223', '4444222.', '.444.22.', '.2...2..'], c: ['#eee0c6', '#da8187', '#857059'],
  fit: 'carries everything on its back and bristles', pegs: 4,
  entry: 'The top bone of a giant\'s neck. It held a head upright for three hundred years. Now it holds a grudge. It demands four cowries as well.' });
sp({ id: 'nail', name: 'Kynme', types: ['BEAST'], basic: 'P', area: 'knucklebones',
  moves: ['nail_flick', 'nail_rake', 'nail_pare', 'nail_gouge'], passives: ['nail_third', 'nail_ingrown'],
  sprite: ['..4444..', '44444444', '.111111.', '.331133.', '.111111.', '444.4444', '44444444', '.44..44.'], c: ['#e0b1a9', '#d63540', '#494360'],
  fit: 'scratches the same place until it gives', pegs: 3,
  entry: 'A giant\'s fingernail. It scratches the same spot until the skin gives way. Three cowries. Unfiled.' });
sp({ id: 'socket', name: 'Koshika', types: ['GEAR'], basic: 'P', area: 'knucklebones',
  moves: ['socket_snap', 'socket_adapt', 'socket_lockjoint', 'socket_fullrotation'], passives: ['socket_rebalance', 'socket_balljoint'],
  sprite: ['..2222..', '.222222.', '22122222', '22222122', '.222222.', '44.22.44', '.444444.', '..3..3..'], c: ['#bcc4d0', '#f0ece4', '#a87a5c'],
  fit: 'turns any way it likes', pegs: 3,
  entry: 'The ball and socket of a giant\'s hip. The head never sits level. It leans heavily to one side or the other. Three cowries. Mine leans left.' });
sp({ id: 'furcula', name: 'Netoive', types: ['STAR'], basic: 'M', area: 'knucklebones',
  moves: ['furcula_wish', 'furcula_fan', 'furcula_stacked', 'furcula_fulldeck'], passives: ['furcula_cardsharp', 'furcula_pulled'],
  sprite: ['...44...', '..4224..', '44444444', '.212212.', '.222222.', '.113331.', '.311313.', '.11..11.'], c: ['#d8dcdb', '#db9431', '#443a67'],
  fit: 'pulls long, then short', pegs: 5,
  entry: 'A wishbone from a bird larger than a barn. It pulls long, then short, then long again. Five cowries. I wished for six.' });

// ================================================================ drysea
sp({ id: 'urchin', name: 'Echili', types: ['TIDE'], basic: 'P', area: 'drysea',
  moves: ['urchin_spinering', 'urchin_gush', 'urchin_pincushion', 'urchin_ravage'], passives: ['urchin_hardtest', 'urchin_spined'],
  sprite: ['4..44..4', '.4.22.4.', '..2222..', '42122124', '.222.22.', '4.2332.4', '.4.44.4.', '4..44..4'], c: ['#d9c1dd', '#50a67e', '#5c3c7a'],
  fit: 'shakes off whatever sticks to it', pegs: 2,
  entry: 'An urchin\'s test from the dry sea floor, with its mouth underneath. Whatever sticks to it falls off. Two cowries. Unsticky.' });
sp({ id: 'fiddler', name: 'Rakani', types: ['BEAST'], basic: 'P', area: 'drysea',
  moves: ['fiddler_clawwave', 'fiddler_sidle', 'fiddler_counterclaw', 'fiddler_regrown'], passives: ['fiddler_waving', 'fiddler_bigclaw'],
  sprite: ['.1..1444', '.3..3444', '.2222.44', '22222244', '22.22244', '.2222.4.', '.1..1...', '1....1..'], c: ['#c6502b', '#d7b352', '#f5e3b9'],
  fit: 'waves one big claw', pegs: 3,
  entry: 'A fiddler crab with one claw larger than the rest. Strike the claw, and it strikes back. Three cowries. The claw is extra.' });
sp({ id: 'fata', name: 'Vistus', types: ['STAR'], basic: 'M', area: 'drysea',
  moves: ['fata_glint', 'fata_waver', 'fata_hazerush', 'fata_massmirage'], passives: ['fata_doubling', 'fata_farshore'],
  sprite: ['.......2', '..3333.1', '33333331', '.4124141', '..4244.1', '.4.44.41', '4.44.4.1', '.44.44.1'], c: ['#69aeed', '#d0513a', '#0534a0'],
  fit: 'is a little farther off than it looks', pegs: 4,
  entry: 'The water hovering over the dry sea, standing on its own reflection. Stones pass right through it. Four cowries. See-through.' });

// ================================================================ wrecks
sp({ id: 'fluke', name: 'Ikara', types: ['GEAR'], basic: 'P', area: 'wrecks',
  moves: ['fluke_anchorswing', 'fluke_markspot', 'fluke_torrent', 'fluke_scuttle'], passives: ['fluke_heavyiron', 'fluke_longhaul'],
  sprite: ['..4444..', '44444444', '.212212.', '.22.222.', '2..22..3', '22.22.3.', '.222223.', '..2..2..'], c: ['#8694a2', '#d7d7de', '#384474'],
  fit: 'drags things back where they were', pegs: 5,
  entry: 'An anchor from the Wrecks, walking on its flukes. It marks a spot and returns you to it. You will come back. Bring five cowries.' });
sp({ id: 'prow', name: 'Prosaki', types: ['STAR'], basic: 'P', area: 'wrecks',
  moves: ['prow_coldspray', 'prow_bulwark', 'prow_standbefore', 'prow_breakwater'], passives: ['prow_figurehead', 'prow_bowwave'],
  sprite: ['..2222..', '.212212.', '33333333', '.444444.', '44433444', '4433.344', '44433444', '.444444.'], c: ['#ecd8bc', '#ca9330', '#375280'],
  fit: 'stands in front and takes it', pegs: 5,
  entry: 'A figurehead that left before the ship sank. It still stands in front of people. Pass the five cowries around it.' });
sp({ id: 'bilge', name: 'Sensi', types: ['GEAR'], basic: 'M', area: 'wrecks',
  moves: ['bilge_bail', 'bilge_siphon', 'bilge_stagnant', 'bilge_deadwater'], passives: ['bilge_pumpshield', 'bilge_overflow'],
  sprite: ['.3....3.', '.212212.', '.132231.', '.222222.', '..3333..', '.34.443.', '.144441.', '...31...'], c: ['#499780', '#44fff1', '#36515f'],
  fit: 'pumps out what comes in', pegs: 3,
  entry: 'A bilge pump with no ship left to bail. It pumps your tide out instead. Three cowries. The bilge boy wants it back.' });
sp({ id: 'sail', name: 'Vesen', types: ['TIDE'], basic: 'P', area: 'wrecks',
  moves: ['sail_gybe', 'sail_boomswing', 'sail_billow', 'sail_galeforce'], passives: ['sail_tacking', 'sail_fervor'],
  sprite: ['...443..', '...44...', '4444.444', '.222222.', '.212212.', '.222222.', '..2..2..', '44444444'], c: ['#e6dec8', '#5395b9', '#5c4939'],
  fit: 'changes tack without being asked', pegs: 2,
  entry: 'Torn sail, mast in face. Tacks in no wind. Two cowries. I\'ve tried blowing.' });
sp({ id: 'keel', name: 'Cakoli', types: ['STONE'], basic: 'P', area: 'wrecks',
  moves: ['keel_doubleknock', 'keel_ram', 'keel_righting', 'keel_verdict'], passives: ['keel_evenkeel', 'keel_deepdraft'],
  sprite: ['4444....', '4444....', '..3.....', '..32222.', '..212212', '..22.222', '...2222.', '..22.22.'], c: ['#9c9890', '#e1c259', '#59493f'],
  fit: 'will not be moved', pegs: 5,
  entry: 'Still after forty years, keel off the dry sea. Moves others far. Five cowries, no delivery.' });
sp({ id: 'bombard', name: 'Taihoki', types: ['GEAR'], basic: 'P', area: 'wrecks',
  moves: ['bombard_lob', 'bombard_grapeshot', 'bombard_ramhome', 'bombard_broadside'], passives: ['bombard_ranging', 'bombard_swab'],
  sprite: ['..22223.', '.212212.', '22222222', '22444422', '2244.422', '22444422', '4.2222.4', '44....44'], c: ['#d79f4f', '#d35f00', '#453f4f'],
  fit: 'sends things up that come down later', pegs: 4,
  entry: 'Ship\'s cannon talks through its head. Shot lands where you will be by then. Four cowries, plus ducking.' });

// ================================================================ shoreline
sp({ id: 'breaker', name: 'Namito', types: ['TIDE'], basic: 'M', area: 'shoreline',
  moves: ['breaker_spill', 'breaker_hollowout', 'breaker_longdraw', 'breaker_ninthwave'], passives: ['breaker_steadydraw', 'breaker_whitewater'],
  sprite: ['..2222..', '.222123.', '2212223.', '2222.33.', '22223...', '.2222...', '3333333.', '........'], c: ['#9cc0d4', '#eaf0f2', '#eaf0f2'],
  fit: 'pulls harder the longer it is left alone', pegs: 4,
  entry: 'Wave breaks off gray wall, one eye in curl. Drags till hit. Four cowries, wet.' });
sp({ id: 'skua', name: 'Tozodo', types: ['BEAST'], basic: 'P', area: 'shoreline',
  moves: ['skua_harry', 'skua_stoop', 'skua_track', 'skua_plunder'], passives: ['skua_highwheel', 'skua_spotter'],
  sprite: ['..2222..', '.242242.', '.214412.', '..2442..', '.113411.', '.244442.', '..2442..', '..1..1..'], c: ['#836858', '#ffb900', '#e2d6c2'],
  fit: 'follows one thing and takes what it has', pegs: 3,
  entry: 'Skua with second beak in belly. Follows yours, paid when it drops. Three cowries. Same trade.' });
sp({ id: 'bloom', name: 'Partica', types: ['TIDE'], basic: 'M', area: 'shoreline',
  moves: ['bloom_tendrils', 'bloom_upwell', 'bloom_swarm', 'bloom_openbloom'], passives: ['bloom_clearbody', 'bloom_nettled'],
  sprite: ['4......4', '44.22.44', '.422224.', '23222232', '21222212', '.222222.', '3.3..3.3', '.3.33.3.'], c: ['#cbd9eb', '#aa8ae7', '#57669a'],
  fit: 'stings everything near it while the tide lasts', pegs: 3,
  entry: 'A bloom of jellyfish off the shoreline. It stings anything nearby and burns through your tide to do it. Three cowries. Ouch.' });
sp({ id: 'drift', name: 'Ajoku', types: ['ROOT'], basic: 'M', area: 'shoreline',
  moves: ['drift_waterlog', 'drift_tideseed', 'drift_graincoat', 'drift_washedup'], passives: ['drift_floats', 'drift_bleached'],
  sprite: ['..3..3..', '...33...', '..2222..', '.244442.', '24144142', '244.4442', '.244442.', '..2222..'], c: ['#756656', '#79b159', '#e2d6be'],
  fit: 'grows a coat of wood on whoever is near', pegs: 2,
  entry: 'Driftwood off gray wall, face on cut end. Grows bark on friends. Two cowries, salted. Unsalted costs more.' });
sp({ id: 'spume', name: 'Spuawa', types: ['STAR'], basic: 'M', area: 'shoreline',
  moves: ['spume_foamwash', 'spume_becalm', 'spume_washout', 'spume_keptafloat'], passives: ['spume_buoyant', 'spume_dissolve'],
  sprite: ['..3..3..', '.22.222.', '22222222', '21222212', '22222222', '2222.222', '.444444.', '..4..4..'], c: ['#f2eee8', '#9bbae2', '#9282b7'],
  fit: 'holds the bill for later', pegs: 4,
  entry: 'Sea foam released by the gray wall. You hit what it holds. The foam keeps the bill. The bill comes. Four cowries, I respect it.' });
sp({ id: 'ebb', name: 'Aeshio', types: ['TIDE'], basic: 'M', area: 'shoreline',
  moves: ['ebb_lap', 'ebb_setback', 'ebb_slackwater', 'ebb_kingtide'], passives: ['ebb_turningtide', 'ebb_recedes'],
  sprite: ['..2233..', '.222333.', '.212313.', '.222333.', '222.3333', '22223333', '.44..44.', '.44..44.'], c: ['#a4acb5', '#3f8ec4', '#424d63'],
  fit: 'goes out and comes back', pegs: 7,
  entry: 'A fragment of the sea\'s own shell, found by the wall at dusk. The sea demands its return. Seven cowries. The sea hasn\'t made an offer yet.' });

// ================================================================ marsh
sp({ id: 'heron', name: 'Ardeagi', types: ['BEAST'], basic: 'P', area: 'marsh',
  moves: ['heron_billstab', 'heron_reedsnare', 'heron_reedstand', 'heron_longneck'], passives: ['heron_stockstill', 'heron_graycoat'],
  sprite: ['..4.....', '..222...', '..212333', '...22...', '..2.22..', '.244442.', '...1....', '..11....'], c: ['#bac6d2', '#ba930f', '#4e586c'],
  fit: 'stands still until it does not', pegs: 3,
  entry: 'Heron on one leg, aiming. Longer it stands, worse for you. Three cowries. Aimed at me all week.' });
sp({ id: 'elver', name: 'Annagi', types: ['TIDE'], basic: 'P', area: 'marsh',
  moves: ['elver_murk', 'elver_glasseel', 'elver_writhe', 'elver_elverrun'], passives: ['elver_thirdbite', 'elver_slick'],
  sprite: ['..2222..', '.222213.', '22444422', '224.4422', '22444422', '.222222.', '..2222..', '.22.....'], c: ['#bfe7e7', '#da3c62', '#67b7d7'],
  fit: 'gets through and bites on the third try', pegs: 2,
  entry: 'Plus a glass eel. You can see its recent meal. Every third bite refuses to let go. Two cowries, plus the cost of whatever it consumed.' });
sp({ id: 'peat', name: 'Deispes', types: ['ROOT'], basic: 'M', area: 'marsh',
  moves: ['peat_seep', 'peat_smoke', 'peat_mire', 'peat_slane'], passives: ['peat_bogbreath', 'peat_preserved'],
  sprite: ['..2242..', '.222422.', '42111124', '21311312', '21111112', '.422424.', '.22.422.', '42224224'], c: ['#473d3d', '#9be262', '#2fffa2'],
  fit: 'takes a little off you every turn', pegs: 3,
  entry: 'A slice of peat from the marsh, facing upward from its top. It retains whatever falls inside. Three cowries per brick. I lost a spoon.' });

// ================================================================ underspire
sp({ id: 'tenor', name: 'Kelpana', types: ['GEAR'], basic: 'M', area: 'underspire',
  moves: ['tenor_clapper', 'tenor_peal', 'tenor_ringout', 'tenor_greattoll'], passives: ['tenor_undertone', 'tenor_bellmouth'],
  sprite: ['...44...', '..2222..', '.222222.', '.212212.', '.222.22.', '22222222', '...3....', '..333...'], c: ['#d19940', '#f1e5bd', '#664c3c'],
  fit: 'rings and everything stops', pegs: 6,
  entry: 'Tenor bell under Spire, hopping on clapper. Rings, front stays put. Six cowries. Goes last.' });
sp({ id: 'glaze', name: 'Madotra', types: ['STAR'], basic: 'M', area: 'underspire',
  moves: ['glaze_stain', 'glaze_refract', 'glaze_leading', 'glaze_rosewindow'], passives: ['glaze_tinted', 'glaze_cracked'],
  sprite: ['...44...', '..4334..', '.432234.', '.413314.', '.444.44.', '.422224.', '.412214.', '.444444.'], c: ['#558be2', '#ae0e30', '#cbb393'],
  fit: 'takes a hit and lets a pane go', pegs: 5,
  entry: 'A fractured window from beneath the Spire, with an eye in each pane. Each pane absorbs one impact. Five cowries, charged per pane.' });
sp({ id: 'pipe', name: 'Urkuda', types: ['STAR'], basic: 'M', area: 'underspire',
  moves: ['pipe_drone', 'pipe_stopped', 'pipe_bellows', 'pipe_fullorgan'], passives: ['pipe_cipher', 'pipe_windchest'],
  sprite: ['3......3', '.3.22.3.', '..2222..', '.244112.', '.211442.', '..2222..', '.32.223.', '3..22..3'], c: ['#95d5b5', '#45a781', '#59ff62'],
  fit: 'has more voices in it than holes', pegs: 4,
  entry: 'Sings from middle, an organ pipe. Notes hit people after it stops. Four cowries, plus earplugs.' });
sp({ id: 'pew', name: 'Nanum', types: ['STONE'], basic: 'P', area: 'underspire',
  moves: ['pew_slidealong', 'pew_hardseat', 'pew_boxpew', 'pew_respite'], passives: ['pew_pewrent', 'pew_kneeling'],
  sprite: ['.2....2.', '.344442.', '.414414.', '.444444.', '.224422.', '..3.22..', '..2322..', '..1..1..'], c: ['#6e4a3a', '#2bd200', '#ecdcc8'],
  fit: 'makes everyone sit and wait', pegs: 4,
  entry: 'A pew from beneath the Spire, with a face in the backrest. While it sits, no one nearby falls completely. Four cowries, seated.' });
sp({ id: 'relic', name: 'Arcapas', types: ['STONE'], basic: 'M', area: 'underspire',
  moves: ['relic_giltedge', 'relic_pall', 'relic_keepsake', 'relic_heartbreak'], passives: ['relic_reliquary', 'relic_underglass'],
  sprite: ['3.3..3.3', '.333333.', '33444433', '.341143.', '33444433', '.33.333.', '3.3..3.3', '........'], c: ['#816242', '#e6b63c', '#d1e9f1'],
  fit: 'keeps a piece of everything it beats', pegs: 6,
  entry: 'A reliquary with one eye watching through the glass. Whatever it puts down, it keeps a piece of. Six cowries. It kept my change.' });
sp({ id: 'censer', name: 'Fumusri', types: ['STAR'], basic: 'M', area: 'underspire',
  moves: ['censer_binding', 'censer_sootshield', 'censer_ashpool', 'censer_smokechain'], passives: ['censer_swungwide', 'censer_incense'],
  sprite: ['....1...', '4...1..4', '44.33.44', '4.2222.4', '42122124', '.222222.', '..1111..', '.3.11.3.'], c: ['#c69e4e', '#8857c3', '#473d56'],
  fit: 'swings and leaves smoke where it went', pegs: 5,
  entry: 'Spire\'s censer smokes at the ears. Smoke hits you two breaths later. Pay five cowries between breaths.' });

// ================================================================ understory
sp({ id: 'strix', name: 'Polro', types: ['BEAST'], basic: 'P', area: 'understory',
  moves: ['strix_swoop', 'strix_dreadcall', 'strix_mantle', 'strix_longnight'], passives: ['strix_nightwings', 'strix_pinned'],
  sprite: ['.4....4.', '44444444', '42244224', '21122112', '422.2224', '44333344', '44.44.44', '.2....2.'], c: ['#e9ddc5', '#d7a02b', '#665444'],
  fit: 'goes quiet and makes you quiet', pegs: 4,
  entry: 'An owl with extra eyes on its wings. It silences all it sees. I\'d quote a price, but it\'s watching. Four cowries.' });
sp({ id: 'hart', name: 'Shivus', types: ['BEAST'], basic: 'P', area: 'understory',
  moves: ['hart_antlers', 'hart_lockantlers', 'hart_haymaker', 'hart_stagleap'], passives: ['hart_grit', 'hart_rutseason'],
  sprite: ['3.3..3.3', '.33..33.', '..2222..', '.212212.', '.222222.', '..2332..', '..2.32..', '..1..1..'], c: ['#a54929', '#e8d4b8', '#b29a7a'],
  fit: 'takes the hits and gives them back', pegs: 5,
  entry: 'A stag\'s shell, antlers attached. It collects everything you strike it with. Five cowries. It\'s collecting them, too.' });
sp({ id: 'skep', name: 'Pechi', types: ['ROOT'], basic: 'P', area: 'understory',
  moves: ['skep_buzz', 'skep_smokeout', 'skep_swarmup', 'skep_hiverage'], passives: ['skep_swarming', 'skep_thickcomb'],
  sprite: ['.44..44.', '.444444.', '42122124', '44444444', '22233222', '4443.444', '.144441.', '.11..11.'], c: ['#d9b159', '#c16f0c', '#7d5419'],
  fit: 'stings the same spot over and over', pegs: 2,
  entry: 'A straw beehive abandoned by its bees. It stings on its own, through the opening in its belly. Two cowries and gloves. My gloves.' });

// ================================================================ rootfall
sp({ id: 'taproot', name: 'Nekkori', types: ['ROOT'], basic: 'M', area: 'rootfall',
  moves: ['taproot_rootshove', 'taproot_twisted', 'taproot_saplingtoss', 'taproot_rootwave'], passives: ['taproot_deepdrink', 'taproot_deepseated'],
  sprite: ['4.4..4.4', '22.22.22', '22222222', '23322332', '22111122', '2.2222.2', '2.2..2.2', '1.1..1.1'], c: ['#523e2f', '#6afa8b', '#459d34'],
  fit: 'holds on to whatever it reaches', pegs: 3,
  entry: 'A taproot from the Bole, walking on its leaves. It anchors things in place and drinks from them. Three cowries and a drink.' });
sp({ id: 'borer', name: 'Mushina', types: ['BEAST'], basic: 'P', area: 'rootfall',
  moves: ['borer_borehole', 'borer_gallery', 'borer_carapace', 'borer_vendetta'], passives: ['borer_tunneler', 'borer_frass'],
  sprite: ['.4....4.', '..1111..', '.121121.', '44111144', '44.44.44', '4.4334.4', '4.4334.4', '.1.11.1.'], c: ['#11ffdb', '#dc9d32', '#2b2320'],
  fit: 'bores in and waits in the hole', pegs: 2,
  entry: 'A bark beetle bored all the way through. It waits in its own holes and hits you on the way out. Two cowries. Holes free.' });
sp({ id: 'clod', name: 'Mulchi', types: ['STONE'], basic: 'P', area: 'rootfall',
  moves: ['clod_rollclod', 'clod_pullclod', 'clod_packearth', 'clod_earthenhold'], passives: ['clod_earthstore', 'clod_clayskin'],
  sprite: ['..3..3..', '..3333..', '.323323.', '.313313.', '.322223.', '224.4422', '24443442', '.33..33.'], c: ['#927c63', '#68d899', '#564434'],
  fit: 'leaves lumps of itself lying about', pegs: 1,
  entry: 'Plus the clump of earth from beneath the Bole\'s roots. A small lump trails behind it. One cowrie. The lump is free. It insists on following.' });
sp({ id: 'whip', name: 'Virtsa', types: ['ROOT'], basic: 'M', area: 'rootfall',
  moves: ['whip_rootcaller', 'whip_seedshield', 'whip_leafing', 'whip_sproutguard'], passives: ['whip_greenhand', 'whip_whiplash'],
  sprite: ['.4.44.4.', '41444414', '14144141', '44444444', '.441144.', '..2.22..', '..3222..', '.22..22.'], c: ['#7c5c3b', '#e1c161', '#4da33b'],
  fit: 'grabs whoever hits its friends', pegs: 3,
  entry: 'A sapling from the Rootfall, face hidden in the leaves. It holds onto anything that harms its friends. Three cowries. Befriend it.' });
sp({ id: 'gnarl', name: 'Kobudus', types: ['STAR'], basic: 'M', area: 'rootfall',
  moves: ['gnarl_enfeeble', 'gnarl_nightmare', 'gnarl_mindsap', 'gnarl_grip'], passives: ['gnarl_baddream', 'gnarl_gnarled'],
  sprite: ['2......2', '22....22', '.444444.', '44333344', '43311334', '44333344', '4.4444.4', '44.44.44'], c: ['#81719e', '#eada7a', '#403850'],
  fit: 'puts things to sleep and keeps them there', pegs: 6,
  entry: 'A face from Bole\'s roots, one eye too big. Gaze at it to sleep. Wakers fall asleep too. Six cowries if you\'re awake.' });
sp({ id: 'upfall', name: 'Amevia', types: ['TIDE'], basic: 'M', area: 'rootfall',
  moves: ['upfall_risingdrops', 'upfall_shrink', 'upfall_helpup', 'upfall_swell'], passives: ['upfall_raindrop', 'upfall_topsy'],
  sprite: ['3.3..3.3', '.3.33.3.', '........', '.444444.', '444.4444', '44144144', '.444444.', '..2..2..'], c: ['#7abae1', '#cde9fc', '#788096'],
  fit: 'makes friends bigger and enemies small', pegs: 3,
  entry: 'Rain that fell upward near the Bole and kept doing so. It makes friends taller and enemies shorter. Three cowries. Ask the Upright Man.' });
