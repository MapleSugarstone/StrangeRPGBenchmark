import './kits6';
import { sp } from './speciesdb';

// ================================================================ the Low Line
sp({ id: 'laminaria', name: 'Konleva', types: ['ROOT'], basic: 'P', area: 'lowline',
  moves: ['laminaria_frond', 'laminaria_sway', 'laminaria_shed', 'laminaria_ebbblade'], passives: ['laminaria_standsup', 'laminaria_undertide'],
  sprite: ['2......2', '22.33.22', '.233332.', '23133132', '.233332.', '2.3333.2', '22.44.22', '2..44..2'], c: ['#726230', '#dea734', '#49392f'],
  fit: 'stands up when the water goes', pegs: 2,
  entry: 'Kelp off the Low Line. Stands up when the sea goes out. Lies down again when you sit near it, out of manners. Manners cost two cowries.' });
sp({ id: 'eelgrass', name: 'Nikusa', types: ['ROOT'], basic: 'M', area: 'lowline',
  moves: ['eelgrass_comb', 'eelgrass_sway', 'eelgrass_mend', 'eelgrass_farreach'], passives: ['eelgrass_flat', 'eelgrass_bed'],
  sprite: ['3......3', '.4....4.', '.442244.', '.212212.', '.22.222.', '..2332..', '.22..22.', '.4....4.'], c: ['#dec6ae', '#d588b7', '#487736'],
  fit: 'lies flat under your boots', pegs: 2,
  entry: 'Patch of sea meadow with a face in it! Step on it and it lies flat and slows your foot. Two cowries, foot back by supper.' });
sp({ id: 'grenadier', name: 'Syvakai', types: ['BEAST'], basic: 'P', area: 'lowline',
  moves: ['grenadier_bite', 'grenadier_rake', 'grenadier_lure', 'grenadier_drop'], passives: ['grenadier_scent', 'grenadier_surface'],
  sprite: ['..4444..', '.444444.', '44233244', '43311334', '44233244', '.444444.', '4.4..4.4', '.4.44.4.'], c: ['#e9e1f1', '#704fbd', '#3700ca'],
  fit: 'looks up from very deep', pegs: 3,
  entry: 'Up from a depth with no light in it, both eyes on top of its head. Stares at the sky the whole time. Three cowries. Won\'t look at money.' });
sp({ id: 'asterias', name: 'Tahtode', types: ['STAR'], basic: 'M', area: 'lowline',
  moves: ['asterias_barrage', 'asterias_five', 'asterias_homing', 'asterias_skydrop'], passives: ['asterias_arms', 'asterias_regrow'],
  sprite: ['...22...', '...22...', '22322222', '.223222.', '..2232..', '..2223..', '..2..2..', '..4..4..'], c: ['#cf6227', '#f1c99a', '#77391f'],
  fit: 'tells you it fell from the sky', pegs: 2,
  entry: 'Says it fell from the sky. Has told me so at every market for six years. Two cowries, whatever it says.' });
sp({ id: 'cirrus', name: 'Lonshu', types: ['BEAST'], basic: 'P', area: 'lowline',
  moves: ['cirrus_slap', 'cirrus_cling', 'cirrus_reach', 'cirrus_wrap'], passives: ['cirrus_suckers', 'cirrus_reaching'],
  sprite: ['..4..4..', '..1441..', '.131131.', '.111111.', '..3.33..', '1.4224..', '.12222..', '...14...'], c: ['#a7c7af', '#a1feaa', '#37473d'],
  fit: 'reaches for whatever is nearest', pegs: 3,
  entry: 'One arm off a nautilus. Let go and kept reaching, and hasn\'t found anything to hold yet. Three cowries. It\'s been reaching for my purse.' });
sp({ id: 'hyponome', name: 'Puhalki', types: ['TIDE'], basic: 'M', area: 'lowline',
  moves: ['hyponome_squirt', 'hyponome_pushoff', 'hyponome_exhale', 'hyponome_jet'], passives: ['hyponome_ebbpull', 'hyponome_breath'],
  sprite: ['3......3', '33....33', '.222222.', '22122122', '22222222', '.22.222.', '..4444..', '.44..44.'], c: ['#a3d3ea', '#effbfe', '#4a78a7'],
  fit: 'breathes things away from it', pegs: 2,
  entry: 'Plus the jet a nautilus breathes out. Breathes other things away from it, mostly my stall. Two cowries. Pay from over there.' });
sp({ id: 'slackwater', name: 'Tynagi', types: ['TIDE'], basic: 'M', area: 'lowline',
  moves: ['slackwater_lap', 'slackwater_slacken', 'slackwater_hold', 'slackwater_minute'], passives: ['slackwater_turn', 'slackwater_unhurried'],
  sprite: ['..2222..', '.222222.', '22232222', '22132122', '22232222', '222.2222', '.222222.', '..4444..'], c: ['#9dadbd', '#41597a', '#dfe5eb'],
  fit: 'holds still and holds you still', pegs: 4,
  entry: 'The still minute between tides, in a shell. Nothing near it moves. Sold one once, and the buyer\'s still standing there. Four cowries.' });
sp({ id: 'brinicle', name: 'Soryubi', types: ['SALT'], basic: 'M', area: 'lowline',
  moves: ['brinicle_drip', 'brinicle_spray', 'brinicle_line', 'brinicle_floor'], passives: ['brinicle_finger', 'brinicle_comfort'],
  sprite: ['3.3..3.3', '.3.33.3.', '...44...', '..3223..', '.444444.', '44444444', '4.4444.4', '4.4..4.4'], c: ['#ddedfc', '#72c2f0', '#354573'],
  fit: 'freezes a line along the bottom', pegs: 3,
  entry: 'Finger of cold brine that froze its way to the sea floor. Points down. Always right about down. Hand me three cowries, mittens on.' });
sp({ id: 'transit', name: 'Yliri', types: ['STAR'], basic: 'M', area: 'lowline',
  moves: ['transit_cross', 'transit_late', 'transit_eclipse', 'transit_double'], passives: ['transit_lonely', 'transit_showing'],
  sprite: ['3.3..3.3', '.3.22.3.', '..2222..', '.232232.', '4.2222.4', '4.2222.4', '44.22.44', '.4....4.'], c: ['#4f97dd', '#dff7fe', '#2e4a88'],
  fit: 'does things twice', pegs: 4,
  entry: 'The night a star crossed the moon, kept and played back. Twice, if you watch. Four cowries, both showings.' });

// ================================================================ the old chambers
sp({ id: 'ballast', name: 'Paimori', types: ['GEAR'], basic: 'P', area: 'oldchambers',
  moves: ['ballast_drop', 'ballast_storm', 'ballast_room', 'ballast_hold'], passives: ['ballast_sinking', 'ballast_ballasted'],
  sprite: ['..3333..', '.3.44.3.', '3.2212.3', '31221213', '3.2212.3', '.3.24.3.', '..3333..', '........'], c: ['#00d5c5', '#e95cad', '#460086'],
  fit: 'sinks a little more each minute', pegs: 3,
  entry: 'Which is stones the Nautilus folk carried to sink a room. They sink on their own now. Three cowries. Weigh it before you pay, and after.' });
sp({ id: 'sluice', name: 'Monti', types: ['GEAR'], basic: 'M', area: 'oldchambers',
  moves: ['sluice_slap', 'sluice_backflow', 'sluice_bolt', 'sluice_swap'], passives: ['sluice_oneway', 'sluice_floodgate'],
  sprite: ['..1111..', '.121111.', '12221221', '12321321', '.122121.', '..4.44..', '.444444.', '..1..1..'], c: ['#5b80bf', '#ddedfc', '#483866'],
  fit: 'lets one side through', pegs: 3,
  entry: 'Gate, between two Nautilus rooms. Lets one side through and never says which. Three cowries, or the other side of three.' });
sp({ id: 'septum', name: 'Mukabe', types: ['STONE'], basic: 'P', area: 'oldchambers',
  moves: ['septum_slam', 'septum_knock', 'septum_seal', 'septum_shot'], passives: ['septum_behind', 'septum_bulkhead'],
  sprite: ['.4.44.4.', '.444444.', '.222222.', '.122221.', '.322223.', '..21212.', '..1131..', '.11131..'], c: ['#6d839a', '#c4ecfb', '#384256'],
  fit: 'seals the room behind you', pegs: 3,
  entry: 'A wall from inside the Nautilus. Seals behind whatever walks past it, so I walk round it, the long way. Three cowries. Don\'t go first.' });
sp({ id: 'vacuole', name: 'Hafusen', types: ['VOID'], basic: 'M', area: 'oldchambers',
  moves: ['vacuole_old', 'vacuole_vacuum', 'vacuole_shell', 'vacuole_wall'], passives: ['vacuole_thin', 'vacuole_airless'],
  sprite: ['3..22..3', '..2222..', '.212212.', '3.2222.3', '..4444..', '.44.444.', '44444444', '........'], c: ['#f1f1f9', '#f2c453', '#aa7332'],
  fit: 'keeps the old air in', pegs: 2,
  entry: 'Air from a sealed room, kept so long it got a shell. Smells of the year the room was shut. Good year. Two cowries.' });
sp({ id: 'evaporite', name: 'Kuorisho', types: ['SALT'], basic: 'M', area: 'oldchambers',
  moves: ['evaporite_flake', 'evaporite_ring', 'evaporite_draw', 'evaporite_room'], passives: ['evaporite_ringed', 'evaporite_dries'],
  sprite: ['........', '.2....2.', '22222222', '24242422', '21242212', '2424.422', '22222222', '.33..33.'], c: ['#efefe9', '#d19a21', '#7f7f87'],
  fit: 'dries rings off you', pegs: 3,
  entry: 'Salt left in rings where a room of water dried. Takes a ring off whatever stands in it. Three cowries, minus a ring.' });
sp({ id: 'hood', name: 'Hupfuta', types: ['STONE'], basic: 'P', area: 'oldchambers',
  moves: ['hood_knock', 'hood_purify', 'hood_holdshut', 'hood_shutdoor'], passives: ['hood_hard', 'hood_door'],
  sprite: ['..4444..', '.444444.', '44144144', '41422414', '41422414', '43222234', '4443.444', '.443444.'], c: ['#977060', '#fc4747', '#efe3cf'],
  fit: 'shuts the door on trouble', pegs: 4,
  entry: 'The hood a nautilus shuts its door with. Shuts any door. Mine hasn\'t opened since! Writing this through the window. Four cowries.' });

// ================================================================ the Long Strand
sp({ id: 'spoor', name: 'Ashiaki', types: ['VOID'], basic: 'M', area: 'longstrand',
  moves: ['spoor_footfall', 'spoor_toes', 'spoor_guard', 'spoor_walkback'], passives: ['spoor_prints', 'spoor_starsland'],
  sprite: ['....33..', '....4...', '..2222..', '.222222.', '22233222', '213.2312', '.222222.', '..2..2..'], c: ['#4a4458', '#facb39', '#926b4b'],
  fit: 'leaves prints that stars land in', pegs: 3,
  entry: 'One of the Gleaner\'s footprints, long as a house. Stars land in it on purpose. Three cowries a footprint. The foot\'s not mine to sell.' });
sp({ id: 'bolide', name: 'Tulisei', types: ['STAR'], basic: 'M', area: 'longstrand',
  moves: ['bolide_flick', 'bolide_streak', 'bolide_ring', 'bolide_whiteline'], passives: ['bolide_burning', 'bolide_brightfall'],
  sprite: ['3.3..3..', '.333.33.', '.344443.', '34122143', '34444443', '.34.443.', '..3333..', '...33...'], c: ['#feefaf', '#d74b0e', '#f3a51d'],
  fit: 'burns brighter while it works', pegs: 4,
  entry: 'Star that came down bright at a spring low and kept burning. Not in your pocket! Four cowries, and a new pocket.' });
sp({ id: 'marram', name: 'Heinaba', types: ['ROOT'], basic: 'P', area: 'longstrand',
  moves: ['marram_sprout', 'marram_runner', 'marram_walkoff', 'marram_rootrun'], passives: ['marram_holds', 'marram_walked'],
  sprite: ['4..44..4', '44.44.44', '.444444.', '.212212.', '.222222.', '332.2233', '33.33.33', '3......3'], c: ['#d3c39b', '#347433', '#8dab54'],
  fit: 'walks off and leaves runners', pegs: 2,
  entry: 'Dune grass. Its roots hold the Long Strand together, and one root walked off, and this is it. Two cowries. The Strand wants it back.' });
sp({ id: 'saltwort', name: 'Ruojiki', types: ['SALT'], basic: 'M', area: 'longstrand',
  moves: ['saltwort_spit', 'saltwort_mist', 'saltwort_cure', 'saltwort_pressed'], passives: ['saltwort_crisp', 'saltwort_post'],
  sprite: ['........', '...4.4..', '..4444..', '.222222.', '22122133', '222.223.', '.222222.', '..4..4..'], c: ['#73a253', '#f2f2ee', '#9b373a'],
  fit: 'salts whatever it spits at', pegs: 2,
  entry: 'Crisp salt plant off the foot of a label post. Spits, and salt piles up on whatever it hits. Two cowries a pinch.' });
sp({ id: 'albedo', name: 'Shidor', types: ['SALT'], basic: 'M', area: 'longstrand',
  moves: ['albedo_glint', 'albedo_field', 'albedo_link', 'albedo_flare'], passives: ['albedo_hard', 'albedo_kept'],
  sprite: ['..4444..', '.444444.', '44222244', '43222234', '442.2244', '3.4444.3', '..4444..', '...14...'], c: ['#cfbfc7', '#b869e6', '#382e42'],
  fit: 'takes the shine off things', pegs: 3,
  entry: 'White glare off a salt flat at night. Look at it and you see less of everything else, the price included. Three cowries.' });
sp({ id: 'cuttle', name: 'Ikapia', types: ['TIDE'], basic: 'M', area: 'longstrand',
  moves: ['cuttle_jab', 'cuttle_clap', 'cuttle_brew', 'cuttle_three'], passives: ['cuttle_matches', 'cuttle_liesby'],
  sprite: ['3......3', '33....33', '.342243.', '.4122143', '.2222223', '..3333.3', '..4444.3', '.4444443'], c: ['#ffffff', '#b18e0c', '#136a29'],
  fit: 'changes color to match', pegs: 3,
  entry: 'Cuttlefish bone. Matches whatever it lies by. Matched my counter a week before I found it. Three cowries. It\'s on the counter. Somewhere.' });
sp({ id: 'medusa', name: 'Kutelo', types: ['TIDE'], basic: 'M', area: 'longstrand',
  moves: ['medusa_sting', 'medusa_pulse', 'medusa_bell', 'medusa_bigripple'], passives: ['medusa_ripples', 'medusa_talked'],
  sprite: ['4......4', '.4.22.4.', '..2222..', '.232232.', '.222222.', '4.3333.4', '.4.33.4.', '..4..4..'], c: ['#6f64c3', '#78c8f7', '#e2e2f3'],
  fit: 'ripples when you talk', pegs: 3,
  entry: 'A jelly the spring low left. Ripples when anyone talks near it, so I am writing this one very quietly. Three cowries.' });

// ================================================================ the Tray
sp({ id: 'bollard', name: 'Pakui', types: ['STONE'], basic: 'P', area: 'tray',
  moves: ['bollard_post', 'bollard_shove', 'bollard_drive', 'bollard_four'], passives: ['bollard_stands', 'bollard_corner'],
  sprite: ['..2222..', '.222222.', '.244442.', '.243342.', '22222222', '2.2222.2', '44444444', '4.4.4.4.'], c: ['#f9f9f1', '#7ded9d', '#444a42'],
  fit: 'stands where it is put', pegs: 4,
  entry: 'And a white post, off the corner of a slot in the Tray. Stands where it\'s put and nowhere else. Four cowries, so put it somewhere good.' });
sp({ id: 'docket', name: 'Tifuda', types: ['GEAR'], basic: 'M', area: 'tray',
  moves: ['docket_tap', 'docket_plant', 'docket_hold', 'docket_blast'], passives: ['docket_nearest', 'docket_letters'],
  sprite: ['..4444..', '44444444', '.222222.', '.211312.', '.222222.', '44444444', '..4444..', '.444444.'], c: ['#fff7ee', '#5ee6fd', '#3c3c4a'],
  fit: 'stands in front of the nearest shell', pegs: 3,
  entry: 'Label post. Walks to the nearest shell and stands in front of it. In front of me since Tuesday. Three cowries. Hasn\'t written anything yet.' });
sp({ id: 'vacancy', name: 'Tyhaki', types: ['VOID'], basic: 'M', area: 'tray',
  moves: ['vacancy_tap', 'vacancy_slip', 'vacancy_emptyout', 'vacancy_square'], passives: ['vacancy_empties', 'vacancy_counter'],
  sprite: ['22222222', '2.1111.2', '41311314', '21111112', '41111114', '2.1111.2', '22222222', '.2....2.'], c: ['#f9f1e0', '#b5dc4a', '#b0998a'],
  fit: 'waits for something to fill it', pegs: 4,
  entry: 'An empty slot from the Tray, still waiting for its shell. Square, and expecting. It expects four cowries off you, at least.' });
sp({ id: 'trochus', name: 'Hyrkoma', types: ['STONE'], basic: 'P', area: 'tray',
  moves: ['trochus_spin', 'trochus_under', 'trochus_grit', 'trochus_spinout'], passives: ['trochus_unwatched', 'trochus_spinning'],
  sprite: ['3......3', '.3....3.', '..2222..', '44122144', '..4444..', '.22.322.', '..2222..', '...43...'], c: ['#ccb48c', '#d6deee', '#2e4d9a'],
  fit: 'spins when you look away', pegs: 3,
  entry: 'Top shell from a world in the Tray. Spins when nobody watches, so I sell it with my eyes shut. Three cowries. Count your change by feel.' });
sp({ id: 'hopper', name: 'Kidedan', types: ['SALT'], basic: 'M', area: 'tray',
  moves: ['hopper_face', 'hopper_stair', 'hopper_crust', 'hopper_core'], passives: ['hopper_stepped', 'hopper_hollow'],
  sprite: ['..2222..', '.222222.', '24422442', '22333322', '23133132', '222.2222', '21122112', '22....22'], c: ['#e5e5dd', '#b1a292', '#424050'],
  fit: 'steps inward', pegs: 3,
  entry: 'Hollow salt crystal, stepped inward like a stair. Every step goes in and none come out. Three cowries go in. None come out.' });
sp({ id: 'crabwise', name: 'Sivuko', types: ['SALT'], basic: 'P', area: 'tray',
  moves: ['crabwise_nip', 'crabwise_flick', 'crabwise_side', 'crabwise_between'], passives: ['crabwise_sideways', 'crabwise_claw'],
  sprite: ['........', '........', '3...2222', '33.21222', '3..22222', '..4222..', '.4.4.4..', '4.4.4...'], c: ['#bb653e', '#efefe9', '#8b3e1d'],
  fit: 'walks sideways round trouble', pegs: 3,
  entry: 'Crab, crusted white with salt. Walks between the slots and never into one. Sideways about the price, too. Three cowries.' });
sp({ id: 'magpie', name: 'Picagi', types: ['BEAST'], basic: 'P', area: 'tray',
  moves: ['magpie_snatch', 'magpie_pecks', 'magpie_hoard', 'magpie_back'], passives: ['magpie_each', 'magpie_wing'],
  sprite: ['..2222..', '.212212.', '31422413', '.222222.', '.34.443.', '..4444..', '.322223.', '...12...'], c: ['#393544', '#e6b733', '#eeeeee'],
  fit: 'keeps one of everything', pegs: 4,
  entry: 'Took one of everything from the Tray and keeps it all under its wings. Took one of my cowries too. Four cowries, so five, really.' });
sp({ id: 'cache', name: 'Kakulo', types: ['VOID'], basic: 'M', area: 'tray',
  moves: ['cache_poke', 'cache_fallin', 'cache_hole', 'cache_keepsit'], passives: ['cache_deep', 'cache_eye'],
  sprite: ['2......2', '22....22', '.444444.', '4.344344', '44111144', '44133144', '.444444.', '4.4..4.4'], c: ['#efe7f7', '#63e376', '#423361'],
  fit: 'keeps whatever falls in', pegs: 3,
  entry: 'Hole where the Mudlark hides finds. Keeps whatever falls in, people included, for a while. Three cowries. I fell in. Lost an afternoon.' });

// ================================================================ the Conch
sp({ id: 'strombus', name: 'Masilma', types: ['BEAST'], basic: 'P', area: 'conchlip',
  moves: ['strombus_jab', 'strombus_look', 'strombus_stare', 'strombus_cull'], passives: ['strombus_never', 'strombus_unblinking'],
  sprite: ['..2222..', '.313313.', '31433413', '.222222.', '...22...', '4.4.24.4', '44444444', '4.4..4.4'], c: ['#747ab8', '#ad0248', '#de9f97'],
  fit: 'never blinks', pegs: 3,
  entry: 'Eye on a stalk, off a conch lip. Hasn\'t blinked in the three years I\'ve had it. Three cowries. I blink first, every time.' });
sp({ id: 'sanderling', name: 'Sirdori', types: ['BEAST'], basic: 'P', area: 'conchlip',
  moves: ['sanderling_pin', 'sanderling_longshot', 'sanderling_run', 'sanderling_wave'], passives: ['sanderling_dry', 'sanderling_edge'],
  sprite: ['........', '..2222..', '.333333.', '22222222', '44444422', '.444444.', '..1.1..3', '.1.1.13.'], c: ['#c0c4cc', '#19be50', '#ebebeb'],
  fit: 'never gets wet', pegs: 2,
  entry: 'Shore bird. Runs at the edge of every wave. Never been wet in its life. Two cowries, dry.' });
sp({ id: 'flood', name: 'Manva', types: ['TIDE'], basic: 'M', area: 'conchlip',
  moves: ['flood_rise', 'flood_spill', 'flood_stay', 'flood_spring'], passives: ['flood_comesup', 'flood_stays'],
  sprite: ['4.4..4.4', '44444444', '.222222.', '.212212.', '332.2233', '.333333.', '.433334.', '.443344.'], c: ['#468cc2', '#eef6fd', '#d7a02b'],
  fit: 'comes in and stays a while', pegs: 3,
  entry: 'Top of a high tide that came into the Conch and stayed. Wets whatever\'s lowest. Three cowries a puddle.' });
sp({ id: 'surf', name: 'Kohisai', types: ['TIDE'], basic: 'M', area: 'conchlip',
  moves: ['surf_hiss', 'surf_crash', 'surf_rush', 'surf_seasound'], passives: ['surf_loud', 'surf_after'],
  sprite: ['........', '.333333.', '3......3', '.222222.', '22122122', '222.2222', '.444444.', '4......4'], c: ['#96c6dd', '#eef6fd', '#305eb9'],
  fit: 'sounds like the sea', pegs: 3,
  entry: 'Sea sound from inside the Conch. Got out. Hold it to your ear and you hear a conch, which is backward. Three cowries, forward or backward.' });
sp({ id: 'fleur', name: 'Kukhana', types: ['SALT'], basic: 'M', area: 'conchlip',
  moves: ['fleur_spray', 'fleur_bloom', 'fleur_crack', 'fleur_flower'], passives: ['fleur_dries', 'fleur_blooms'],
  sprite: ['2..22..2', '.22..22.', '2.2222.2', '.213312.', '22222222', '.244442.', '...44...', '..4444..'], c: ['#efefe9', '#db94a4', '#8c857d'],
  fit: 'dries what it touches', pegs: 3,
  entry: 'Salt flower off the Conch\'s lip, where the spray dries. Dries whatever it touches the same way. Three cowries. My hands are still dry.' });
sp({ id: 'madrepore', name: 'Kosango', types: ['STONE'], basic: 'M', area: 'conchlip',
  moves: ['madrepore_rap', 'madrepore_close', 'madrepore_palm', 'madrepore_hand'], passives: ['madrepore_kind', 'madrepore_shaped'],
  sprite: ['4......4', '44....44', '.432234.', '.312213.', '.222222.', '..1111..', '..4444..', '...23...'], c: ['#f7e7df', '#dbbb52', '#d46f78'],
  fit: 'holds your hand back', pegs: 4,
  entry: 'Coral, grown in the shape of a hand on the Conch\'s outside. Holds your hand back! Four cowries, if it lets go long enough to pay.' });
sp({ id: 'blush', name: 'Shinmi', types: ['STONE'], basic: 'M', area: 'conchpink',
  moves: ['blush_roll', 'blush_hum', 'blush_give', 'blush_home'], passives: ['blush_voices', 'blush_gift'],
  sprite: ['........', '..2222..', '.232222.', '22322222', '21222212', '222.2222', '.222222.', '4.2222.4'], c: ['#e8a0b0', '#fff6f9', '#904a5b'],
  fit: 'rolls toward voices', pegs: 4,
  entry: 'Pink pearl that rolls toward voices. Say its price and it rolls to you. Four cowries! See? Here it comes.' });
sp({ id: 'cochlea', name: 'Korvami', types: ['VOID'], basic: 'M', area: 'conchpink',
  moves: ['cochlea_hum', 'cochlea_ear', 'cochlea_bind', 'cochlea_louder'], passives: ['cochlea_spiral', 'cochlea_both'],
  sprite: ['333.....', '..333...', '444444..', '.42144..', '444444..', '.3333..1', '.422441.', '444441..'], c: ['#ebe3db', '#c4092a', '#39363f'],
  fit: 'makes things louder', pegs: 4,
  entry: 'The spiral in the Conch where a sound goes in and comes out louder. Four cowries. I sneezed near it once and lost a window.' });
sp({ id: 'samphire', name: 'Suomono', types: ['ROOT'], basic: 'M', area: 'conchpink',
  moves: ['samphire_mend', 'samphire_pod', 'samphire_curse', 'samphire_stake'], passives: ['samphire_damp', 'samphire_edge'],
  sprite: ['2..2..2.', '22.22.22', '.2.22.2.', '..2222..', '.212212.', '.22.222.', '..2332..', '.444444.'], c: ['#66ae3d', '#c14537', '#54443a'],
  fit: 'pickles what it holds', pegs: 3,
  entry: 'Sea plant from the Conch\'s damp turns, crisp and salt. Pickles whatever it holds. Yours for three cowries, if you let go of them quick.' });
sp({ id: 'gimbal', name: 'Tenbinka', types: ['GEAR'], basic: 'M', area: 'conchpink',
  moves: ['gimbal_tip', 'gimbal_inner', 'gimbal_outer', 'gimbal_level'], passives: ['gimbal_ride', 'gimbal_tips'],
  sprite: ['..2222..', '.2.33.2.', '2.2332.2', '2.1331.2', '2.3333.2', '.244442.', '.444.44.', '44444444'], c: ['#d3ab5b', '#f0e8f0', '#5d2a3a'],
  fit: 'keeps things level', pegs: 4,
  entry: 'Ring in a ring. Keeps whatever sits in it level. Kept my tea level through a whole storm. Four cowries. The storm was free.' });
sp({ id: 'lull', name: 'Hilzuka', types: ['VOID'], basic: 'M', area: 'conchturn',
  moves: ['lull_bolt', 'lull_note', 'lull_seal', 'lull_long'], passives: ['lull_notes', 'lull_mouth'],
  sprite: ['.4....4.', '.444444.', '42111124', '21311312', '42111124', '..4444..', '..1111..', '.232323.'], c: ['#f8f8ff', '#57e8f7', '#525867'],
  fit: 'goes quiet and makes you quiet', pegs: 4,
  entry: 'The quiet in the Conch\'s mouth while the big one sleeps. Quiet in one particular way. Four cowries. Shh.' });
sp({ id: 'flange', name: 'Laibiru', types: ['GEAR'], basic: 'P', area: 'conchturn',
  moves: ['flange_ring', 'flange_flare', 'flange_call', 'flange_wide'], passives: ['flange_name', 'flange_flared'],
  sprite: ['4......4', '42122124', '.222222.', '.222222.', '332.2233', '3.2222.3', '..4422..', '.444222.'], c: ['#b1291b', '#c4ccd3', '#55332b'],
  fit: 'opens wider when named', pegs: 4,
  entry: 'The flared lip of the Conch. Opens wider when it hears its name, so in my shop it\'s called Plim. Four cowries, Plim.' });
sp({ id: 'pleiad', name: 'Sisarmai', types: ['STAR'], basic: 'M', area: 'conchturn',
  moves: ['pleiad_twinkle', 'pleiad_cluster', 'pleiad_call', 'pleiad_seven'], passives: ['pleiad_six', 'pleiad_sisters'],
  sprite: ['.3.33.3.', '..2222..', '.222222.', '32122123', '.222.22.', '.242242.', '..2..2..', '..3..3..'], c: ['#fff0b0', '#ffb040', '#6a78d8'],
  fit: 'looks for its sisters', pegs: 4,
  entry: 'One of seven stars that fell together. Goes looking for the other six and finds one now and then. Four cowries. The set\'s more.' });
sp({ id: 'aphelion', name: 'Pakaeri', types: ['STAR'], basic: 'M', area: 'conchroar',
  moves: ['aphelion_spear', 'aphelion_farout', 'aphelion_swing', 'aphelion_back'], passives: ['aphelion_way', 'aphelion_far'],
  sprite: ['4.......', '.4......', '..4.3...', '...3333.', '..332.33', '..321233', '...3333.', '....33..'], c: ['#fcf5dd', '#da650f', '#5d3c4b'],
  fit: 'comes back faster', pegs: 5,
  entry: 'Star that went out as far as it could and is on its way back. Quicker the closer it comes. Five cowries, and stand to one side.' });

// ================================================================ rare kinds
sp({ id: 'astrolabe', name: 'Astrolabe', types: ['GEAR'], basic: 'M', area: 'lowline',
  moves: ['astrolabe_sight', 'astrolabe_ring', 'astrolabe_shower', 'astrolabe_last'], passives: ['astrolabe_measuring', 'astrolabe_longsight'],
  sprite: ['...44...', '..4..4..', '.222222.', '2.2112.2', '22222222', '23.3.3.2', '.222222.', '..2222..'], c: ['#d3ab5b', '#eee6be', '#7e5c2c'],
  fit: 'measures before it acts', pegs: 6,
  entry: 'The Tide-reader\'s grandmother\'s brass star-measurer. Kept measuring after she stopped. Six cowries. It measured me. I\'m short.' });
sp({ id: 'pallasite', name: 'Pallasite', types: ['STAR'], basic: 'M', area: 'sanddollar',
  moves: ['pallasite_glint', 'pallasite_sparks', 'pallasite_dive', 'pallasite_nova'], passives: ['pallasite_caught', 'pallasite_unspent'],
  sprite: ['..3..3..', '.333333.', '.322223.', '31133113', '33222233', '..4334..', '.44.244.', '.442244.'], c: ['#ebe3db', '#73bbe3', '#395594'],
  fit: 'shuts into a shell when hurt', pegs: 7,
  entry: 'Fallen star, green inside, caught in a shell before it touched sand. Shuts the shell again when it\'s hurt. Seven cowries, and worth eight.' });
sp({ id: 'halophile', name: 'Rusumo', types: ['SALT'], basic: 'M', area: 'conchroar',
  moves: ['halophile_bloom', 'halophile_draw', 'halophile_stain', 'halophile_pink'], passives: ['halophile_water', 'halophile_lip'],
  sprite: ['..2..2..', '.222222.', '22222222', '21222212', '22233222', '..4444..', '.444444.', '...23...'], c: ['#cf638b', '#fff6f9', '#d2d2ca'],
  fit: 'turns the water pink', pegs: 6,
  entry: 'Pink bloom off the saltiest pool on the Strand. Water it sits in turns the color of the Conch\'s lip. Six cowries, pink if you have them.' });
sp({ id: 'heirloom', name: 'Petami', types: ['VOID'], basic: 'M', area: 'tray',
  moves: ['heirloom_dust', 'heirloom_faded', 'heirloom_nobody', 'heirloom_take'], passives: ['heirloom_unknown', 'heirloom_longest'],
  sprite: ['..2222..', '.244442.', '24411442', '24311342', '24444442', '.24.442.', '..2222..', '...33...'], c: ['#d2c2aa', '#a958e6', '#726141'],
  fit: 'takes the best thing you have', pegs: 7,
  entry: 'Oldest whorl in the Gleaner\'s Tray. Nobody knows what grew in it. Takes the best thing you have. Seven cowries, then your best thing.' });
sp({ id: 'lodestar', name: 'Opaski', types: ['STAR'], basic: 'M', area: 'tray',
  moves: ['lodestar_bearing', 'lodestar_fix', 'lodestar_steer', 'lodestar_course'], passives: ['lodestar_walked', 'lodestar_steady'],
  sprite: ['..3.3...', '..2.2...', '.2222...', '2212123.', '.2.223..', '..2.2...', '..4.4...', '........'], c: ['#f6f2de', '#f0b22c', '#4d4d7a'],
  fit: 'keeps everyone in order', pegs: 7,
  entry: 'The star the Gleaner walked by. Took it down and kept it. Still points the same way. Seven cowries. Don\'t ask it the way home.' });
sp({ id: 'ammonite', name: 'Kotigai', types: ['STONE'], basic: 'P', area: 'tray',
  moves: ['ammonite_knock', 'ammonite_ridge', 'ammonite_septa', 'ammonite_all'], passives: ['ammonite_coil', 'ammonite_struck'],
  sprite: ['4......4', '44....44', '.422224.', '.212212.', '222.2222', '34444443', '24222242', '.244442.'], c: ['#986941', '#e4ecf4', '#d8c199'],
  fit: 'lies still until struck', pegs: 6,
  entry: 'Coiled shell from a beach that\'s gone. Won\'t move until you hit it. Then it gives it back! I\'d pay the six cowries without arguing.' });

// ================================================================ special: the chapter 6 battle form
sp({ id: 'gleaner', name: 'The Gleaner', types: ['VOID', 'BEAST'], basic: 'P', area: 'conchmouth',
  moves: ['gleaner_listen', 'gleaner_label', 'gleaner_setdown', 'gleaner_hold'], passives: ['gleaner_wade', 'gleaner_listening'],
  sprite: ['.4....4.', '.44..44.', '24444442', '21222212', '22222222', '.223322.', '3242242.', '..2..2..'], c: ['#fcf6ff', '#edc5cd', '#675797'],
  fit: 'listens to each shell it lifts', pegs: 0,
  entry: 'The Gleaner, sitting. No price. I would not know whom to pay.', legendary: true, wild: false });
