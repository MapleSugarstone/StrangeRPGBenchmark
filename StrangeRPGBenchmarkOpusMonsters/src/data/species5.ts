import './kits5';
import { sp } from './speciesdb';

// ================================================================ chapter 1: the Outer Whorl
sp({ id: 'acorn', name: 'Rokbo', types: ['STONE'], basic: 'P', area: 'outerwhorl',
  moves: ['acorn_cirri', 'acorn_cement', 'acorn_shut', 'acorn_bed'], passives: ['acorn_cemented', 'acorn_spat'],
  sprite: ['..2222..', '.211112.', '.233332.', '22222222', '44222244', '44.22244', '44222244', '4.2..2.4'], c: ['#a29e93', '#67e6f6', '#48683e'],
  fit: 'settles on whatever passes', pegs: 2,
  entry: 'Off the Volute\'s outer curve, a barnacle. It lived its entire life on your world, never once glancing inward. Two cowries.' });
sp({ id: 'varix', name: 'Comine', types: ['STONE'], basic: 'P', area: 'outerwhorl',
  moves: ['varix_toss', 'varix_hop', 'varix_grind', 'varix_spring'], passives: ['varix_growth', 'varix_oldlip'],
  sprite: ['........', '........', '..3..3..', '..2222..', '..1331..', '..2222..', '.32.223.', '...23...'], c: ['#ddb58d', '#b75139', '#f2eada'],
  fit: 'grows a new lip when pushed', pegs: 3,
  entry: 'It was the lip of the Volute, until one spring the shell outgrew it. So it packed up and left. Three cowries. It still believes it\'s a lip.' });
sp({ id: 'mew', name: 'Kamorus', types: ['BEAST'], basic: 'P', area: 'outerwhorl',
  moves: ['mew_dive', 'mew_wheel', 'mew_snatch', 'mew_forty'], passives: ['mew_draft', 'mew_eye'],
  sprite: ['..2222..', '.222222.', '.242242.', '..2332..', '44222244', '442.2244', '.222222.', '..3..3..'], c: ['#f0f2f4', '#dd9e09', '#717b8a'],
  fit: 'rides the warm air up', pegs: 2,
  entry: 'Gull. Forty years it rode the Volute\'s air each dusk. Still rises at six, even indoors. Two cowries. Ceiling extra.' });
sp({ id: 'halite', name: 'Shiola', types: ['SALT'], basic: 'M', area: 'outerwhorl',
  moves: ['halite_grain', 'halite_dryout', 'halite_square', 'halite_pan'], passives: ['halite_cubic', 'halite_spray'],
  sprite: ['..2222..', '.212212.', '.222222.', '..4444..', '32222223', '22.22222', '24444442', '.44..44.'], c: ['#f8f6f2', '#f0b0c8', '#8890b0'],
  fit: 'comes apart in squares', pegs: 2,
  entry: 'Spray, dried onto the Volute\'s exterior, square in every grain. I counted them all. Two cowries, plus a week\'s wage for the counting.' });

// ================================================================ chapter 1: the Wrack
sp({ id: 'skitter', name: 'Nomipu', types: ['BEAST'], basic: 'P', area: 'wrack',
  moves: ['skitter_pounce', 'skitter_kick', 'skitter_burrow', 'skitter_night'], passives: ['skitter_shadow', 'skitter_hops'],
  sprite: ['4.4444.4', '.441144.', '44311344', '.444444.', '..1111..', '4.2.42..', '.42432..', '.42422..'], c: ['#d2c2a2', '#f2eee2', '#54443a'],
  fit: 'jumps on shadows', pegs: 1,
  entry: 'A sand hopper, dog-sized. It jumps at shadows and lands on them, so keep yours perfectly still. One cowrie. My shadow is still bruised.' });
sp({ id: 'fucus', name: 'Rakmata', types: ['ROOT'], basic: 'M', area: 'wrack',
  moves: ['fucus_lash', 'fucus_inflate', 'fucus_pop', 'fucus_wrack'], passives: ['fucus_bladders', 'fucus_tideline'],
  sprite: ['..3..3..', '..4..4..', '.22..22.', '22222222', '21222212', '.22.222.', '..2222..', '..4444..'], c: ['#84743a', '#ed9f0b', '#54443a'],
  fit: 'pops when squeezed', pegs: 1,
  entry: 'Wrack weed off the tide line. Kids buy it for the pop. One cowrie. Won\'t pop for anyone who\'s shed.' });
sp({ id: 'flotsam', name: 'Cistako', types: ['GEAR'], basic: 'P', area: 'wrack',
  moves: ['flotsam_batten', 'flotsam_stove', 'flotsam_bob', 'flotsam_nailed'], passives: ['flotsam_stayed', 'flotsam_cargo'],
  sprite: ['.444444.', '4......4', '41311314', '21111112', '.222222.', '242.2242', '22222222', '.22..22.'], c: ['#997149', '#f9ca5a', '#4c4c59'],
  fit: 'stays shut', pegs: 3,
  entry: 'A crate floated in, shut tight. I offered well for its contents, but it refused to open. Rude. Three cowries, contents unknown.' });
sp({ id: 'mote', name: 'Mibu', types: ['STAR'], basic: 'M', area: 'wrack',
  moves: ['mote_glint', 'mote_turn', 'mote_hand', 'mote_star'], passives: ['mote_side', 'mote_grain'],
  sprite: ['3.3..3.3', '.343343.', '34122143', '34122143', '33222233', '.144441.', '.144441.', '..2211..'], c: ['#9e522e', '#e9ab20', '#027977'],
  fit: 'is warm on one side', pegs: 4,
  entry: 'A fallen star, a grain the size of a fist. Warm on one side, and that side keeps rotating. Four cowries. Bring tongs.' });
sp({ id: 'seaglass', name: 'Ampullo', types: ['SALT'], basic: 'P', area: 'wrack',
  moves: ['seaglass_shard', 'seaglass_rub', 'seaglass_break', 'seaglass_beach'], passives: ['seaglass_frosted', 'seaglass_note'],
  sprite: ['......2.', '.....22.', '..23222.', '.212212.', '22222222', '222.2222', '.224422.', '..4444..'], c: ['#a1d9c1', '#eefdf6', '#336351'],
  fit: 'goes smooth slowly', pegs: 2,
  entry: 'Plus a bottle. It broke on the wrack, got frosted by salt, then walked away. Two cowries. The sharp end is the front, so hold the back.' });
sp({ id: 'kipper', name: 'Kamono', types: ['SALT'], basic: 'P', area: 'wrack',
  moves: ['kipper_slap', 'kipper_desiccate', 'kipper_flip', 'kipper_cured'], passives: ['kipper_hung', 'kipper_stiff'],
  sprite: ['...44...', '..4444..', '.222222.', '22122122', '22333322', '21111112', '222.2222', '.222222.'], c: ['#5d8ab9', '#f8f8f8', '#335380'],
  fit: 'is very dry', pegs: 1,
  entry: 'Fish, dried and salted on the wrack line by no one. Who salts a fish for no one? Very dry. One cowrie, which is more than no one charged.' });
sp({ id: 'actinia', name: 'Isoko', types: ['TIDE'], basic: 'M', area: 'wrack',
  moves: ['actinia_arm', 'actinia_close', 'actinia_bloom', 'actinia_pool'], passives: ['actinia_shy', 'actinia_cells'],
  sprite: ['.......4', '......4.', '3.3.34..', '.33333..', '..2222..', '.212212.', '.22.222.', '.222222.'], c: ['#c2533c', '#e596b5', '#dfe5eb'],
  fit: 'shuts when a shadow passes', pegs: 2,
  entry: 'Tide-pool flower. Closes at any shadow, which is always. Closed now. Two cowries, sold shut.' });
sp({ id: 'lacuna', name: 'Keeba', types: ['VOID'], basic: 'M', area: 'wrack',
  moves: ['lacuna_scoop', 'lacuna_sweep', 'lacuna_sink', 'lacuna_deadlow'], passives: ['lacuna_round', 'lacuna_hollow'],
  sprite: ['4.3223.4', '43122134', '.314413.', '.444444.', '..2.42..', '.224422.', '4.432...', '.4432...'], c: ['#59bfaf', '#c0667c', '#f2e2ca'],
  fit: 'looks for what was taken', pegs: 3,
  entry: 'Sand hollow where a taken shell lay. It searches for it, hasn\'t found it. Three cowries. It checks pockets.' });

// ================================================================ chapter 1: the Sand Dollar and the Flats
sp({ id: 'columba', name: 'Cohato', types: ['STAR'], basic: 'M', area: 'sanddollar',
  moves: ['columba_wing', 'columba_carry', 'columba_home', 'columba_ring'], passives: ['columba_doves', 'columba_homing'],
  sprite: ['3.2..2.3', '33422433', '34122143', '34122143', '33222233', '3..11..3', '..4224..', '..2222..'], c: ['#f5f5f9', '#e0b02a', '#919191'],
  fit: 'brings things home', pegs: 4,
  entry: 'One of the five doves from a sand dollar. It flies only at night and brings things back. Four cowries, or whatever it brought you.' });
sp({ id: 'lobworm', name: 'Spijire', types: ['ROOT'], basic: 'P', area: 'flats',
  moves: ['lobworm_curl', 'lobworm_go', 'lobworm_collapse', 'lobworm_coil'], passives: ['lobworm_castings', 'lobworm_lowwater'],
  sprite: ['3.2..2..', '3.2222..', '4.1221..', '3212212.', '4.2222..', '42244...', '442222..', '4424444.'], c: ['#bfa77f', '#a3ebbb', '#554b43'],
  fit: 'curls at low water', pegs: 1,
  entry: 'And the curl of sand a worm pushes up at low water. The worm is gone. The curl keeps curling. One cowrie. The worm is extra, if found.' });
sp({ id: 'razor', name: 'Veigai', types: ['GEAR'], basic: 'P', area: 'flats',
  moves: ['razor_cut', 'razor_upright', 'razor_dig', 'razor_wind'], passives: ['razor_hinge', 'razor_startle'],
  sprite: ['....2...', '...22...', '..2322..', '..2232..', '..2.32..', '.444444.', '..4114..', '...44...'], c: ['#bdc5cd', '#21af43', '#493f47'],
  fit: 'digs down when a star lands', pegs: 3,
  entry: 'Razor clam. It digs straight down whenever a star lands nearby, which is every night here. Three cowries, if you can dig it up.' });
sp({ id: 'annulet', name: 'Renbiwa', types: ['STAR'], basic: 'M', area: 'flats',
  moves: ['annulet_draw', 'annulet_glow', 'annulet_dither', 'annulet_landing'], passives: ['annulet_ring', 'annulet_kept'],
  sprite: ['..3333..', '.333333.', '33222233', '32122123', '.322223.', '..4444.2', '.44.4442', '.4....4.'], c: ['#fcf5dd', '#edbe24', '#5271bc'],
  fit: 'keeps a ring lit', pegs: 5,
  entry: 'The ring of light a landed star leaves on wet sand! This one has never faded. Five cowries. You won\'t sleep with it in the room.' });

// ================================================================ chapter 2: the Cowrie's back
sp({ id: 'macula', name: 'Madaku', types: ['VOID'], basic: 'M', area: 'cowrieback',
  moves: ['macula_dark', 'macula_moveoff', 'macula_lookup', 'macula_spots'], passives: ['macula_unwatched', 'macula_first'],
  sprite: ['4......4', '44.22.44', '.42.224.', '.233332.', '.313313.', '.311113.', '.222222.', '..2..2..'], c: ['#423850', '#f2eae2', '#b32037'],
  fit: 'moves when you look away', pegs: 3,
  entry: 'A dark smudge on the Cowrie\'s dome. It shifts when you aren\'t watching. I\'ve never caught it moving, so I trust it. Three cowries.' });
sp({ id: 'pallium', name: 'Haota', types: ['TIDE'], basic: 'M', area: 'cowrieback',
  moves: ['pallium_slide', 'pallium_buff', 'pallium_dazzle', 'pallium_shine'], passives: ['pallium_polishes', 'pallium_lieson'],
  sprite: ['..2222..', '.212212.', '.222222.', '.222222.', '.434343.', '422.2224', '.222222.', '..4..4..'], c: ['#af7850', '#f9f1e1', '#543423'],
  fit: 'polishes what it lies on', pegs: 3,
  entry: 'The soft sheath a cowrie slides over its shell. It polishes whatever surface it rests on. Three slippery cowries.' });
sp({ id: 'seiche', name: 'Lainami', types: ['TIDE'], basic: 'M', area: 'cowrieback',
  moves: ['seiche_slosh', 'seiche_still', 'seiche_hold', 'seiche_break'], passives: ['seiche_standing', 'seiche_gray'],
  sprite: ['33333333', '22222222', '21222212', '22222222', '24242424', '222.2222', '22222222', '44.44.44'], c: ['#6a8aa7', '#eef6fd', '#30506f'],
  fit: 'stands still and holds the water', pegs: 4,
  entry: 'Wave. Gray, standing on sand since my grandfather. Won\'t budge. Four cowries.' });
sp({ id: 'scud', name: 'Roibuki', types: ['SALT'], basic: 'P', area: 'cowrieback',
  moves: ['scud_whip', 'scud_skip', 'scud_run', 'scud_spume'], passives: ['scud_ahead', 'scud_kept'],
  sprite: ['..2222..', '.222222.', '21311312', '.222222.', '4.2222.4', '44.22.44', '..2..2..', '.2....2.'], c: ['#c0ccd8', '#da031e', '#3c3c4a'],
  fit: 'keeps going', pegs: 2,
  entry: 'Sea spray blown from a wave. The wave has stopped, but the spray hasn\'t. Two cowries, paid in haste.' });

// ================================================================ chapter 2: the Polish
sp({ id: 'enamel', name: 'Nitorshi', types: ['STONE'], basic: 'P', area: 'polish',
  moves: ['enamel_slam', 'enamel_bash', 'enamel_glaze', 'enamel_whole'], passives: ['enamel_gloss', 'enamel_shatter'],
  sprite: ['3.3..3.3', '.333333.', '.422224.', '.212212.', '44222244', '43333334', '4333.334', '.444444.'], c: ['#efe3cf', '#e9ab20', '#9f702f'],
  fit: 'stands up in one sheet', pegs: 3,
  entry: 'The top layer of the Cowrie\'s polish, peeled off in one sheet and left standing. Three cowries. It reveals every fingerprint.' });
sp({ id: 'porcella', name: 'Poscus', types: ['BEAST'], basic: 'P', area: 'polish',
  moves: ['porcella_snort', 'porcella_start', 'porcella_bump', 'porcella_downhill'], passives: ['porcella_glazed', 'porcella_tilts'],
  sprite: ['.2....2.', '.22..22.', '.222222.', '22122122', '22233222', '242.2242', '.222222.', '.22..22.'], c: ['#f5f5f9', '#e697a7', '#3563c2'],
  fit: 'rolls downhill', pegs: 2,
  entry: 'Pig! Small, round, glazed, kept by the Cowrie folk. Rolls when the floor tilts, which it does. Two cowries. You chase it.' });
sp({ id: 'specie', name: 'Kolikni', types: ['GEAR'], basic: 'P', area: 'polish',
  moves: ['specie_clip', 'specie_payout', 'specie_buy', 'specie_spend'], passives: ['specie_clinks', 'specie_shut'],
  sprite: ['..4..4..', '..4..4..', '.444444.', '.222222.', '21222212', '222.2224', '22222244', '.2222243'], c: ['#926b4b', '#72e3c3', '#272723'],
  fit: 'clinks when pleased', pegs: 5,
  entry: 'Cowrie purse that shut up. Clinks when happy. Counting money hurts. Five cowries, or one of itself.' });
sp({ id: 'emery', name: 'Limashi', types: ['SALT'], basic: 'P', area: 'polish',
  moves: ['emery_coarse', 'emery_rub', 'emery_abrade', 'emery_polishoff'], passives: ['emery_scours', 'emery_hardgrit'],
  sprite: ['...33...', '44.22.44', '4.2222.4', '22122122', '22222222', '2.2222.2', '2.2..2.2', '........'], c: ['#ccad6d', '#fbdc7c', '#957444'],
  fit: 'scours what touches it', pegs: 2,
  entry: 'The grit the Cowrie folk use for polishing. It scrubs anything that touches it, including hands. Two cowries. Pay with your other hand.' });
sp({ id: 'faience', name: 'Faience', types: ['ROOT'], basic: 'M', area: 'polish',
  moves: ['faience_clear', 'faience_chime', 'faience_box', 'faience_peal'], passives: ['faience_rings', 'faience_petals'],
  sprite: ['.2.22.2.', '22222222', '22333322', '23133132', '22333322', '.2.44.2.', '..4444..', '.444444.'], c: ['#25a5ad', '#f9ca5a', '#73452c'],
  fit: 'rings when touched', pegs: 3,
  entry: 'Glazed flower from a Cowrie box. Rings when touched. Ting! That\'s me. Three cowries/flower.' });

// ================================================================ chapter 2: the Under-teeth
sp({ id: 'denticle', name: 'Serrari', types: ['BEAST'], basic: 'P', area: 'underteeth',
  moves: ['denticle_bite', 'denticle_teeth', 'denticle_overbite', 'denticle_lockjaw'], passives: ['denticle_nothing', 'denticle_still'],
  sprite: ['..2222..', '.232232.', '21111112', '23232322', '444.4444', '4444.444', '..2..2..', '........'], c: ['#eedace', '#c5002a', '#643d1e'],
  fit: 'meshes on whatever is there', pegs: 2,
  entry: 'Three Cowrie teeth meshing on air. They\'ll mesh on you. Roll up sleeves. Hand me two cowries.' });
sp({ id: 'diastema', name: 'Rakoma', types: ['VOID'], basic: 'M', area: 'underteeth',
  moves: ['diastema_null', 'diastema_slip', 'diastema_close', 'diastema_wider'], passives: ['diastema_wandered', 'diastema_gap'],
  sprite: ['22....22', '22444422', '22344322', '22444422', '224.4422', '22.44.22', '33.44.33', '........'], c: ['#efebdf', '#b565f3', '#54437a'],
  fit: 'gets in between', pegs: 4,
  entry: 'The gap between two of the Cowrie\'s teeth. It wandered off, and the teeth snapped shut behind it. Four cowries, which is a lot for a gap.' });
sp({ id: 'furl', name: 'Makimen', types: ['ROOT'], basic: 'M', area: 'underteeth',
  moves: ['furl_lash', 'furl_tight', 'furl_whip', 'furl_unroll'], passives: ['furl_rolled', 'furl_fast'],
  sprite: ['..2222..', '.212212.', '22444422', '24433442', '24433442', '224.4422', '.222222.', '..2..2..'], c: ['#e3c3b3', '#933c55', '#bc7d8d'],
  fit: 'rolls in on itself', pegs: 2,
  entry: 'Plus the rolled edge of the Cowrie\'s lip. It keeps rolling inward. It comes out fast. Two cowries, faster than you.' });

// ================================================================ chapter 2: the Glaze Halls
sp({ id: 'laggard', name: 'Tardas', types: ['VOID'], basic: 'M', area: 'glazehalls',
  moves: ['laggard_catchup', 'laggard_behind', 'laggard_lag', 'laggard_mirror'], passives: ['laggard_late', 'laggard_glass'],
  sprite: ['3..3....', '33.33.3.', '4322223.', '4212212.', '4322223.', '.444444.', '..4.14..', '..4444..'], c: ['#dadee6', '#d19a21', '#633381'],
  fit: 'does it again later', pegs: 4,
  entry: 'A reflection. It fell three steps behind its owner and never caught up. It mimics your movements. Four cowries, paid three steps ago.' });
sp({ id: 'tain', name: 'Tain', types: ['VOID'], basic: 'M', area: 'glazehalls',
  moves: ['tain_backing', 'tain_blank', 'tain_tarnish', 'tain_empty'], passives: ['tain_silver', 'tain_nothing'],
  sprite: ['4......4', '.3.22.3.', '.322223.', '42122124', '42222224', '..3333..', '3.34.3.3', '.334433.'], c: ['#d4d8e4', '#5a83cd', '#6a5e80'],
  fit: 'shows what is put in front of it', pegs: 3,
  entry: 'The back of a mirror, the silver backing. It shows nothing on its own. Hold it up to me, and it reveals three cowries.' });
sp({ id: 'luster', name: 'Daz', types: ['STAR'], basic: 'M', area: 'glazehalls',
  moves: ['luster_shine', 'luster_drowse', 'luster_long', 'luster_glare'], passives: ['luster_dark', 'luster_went'],
  sprite: ['3..44...', '..4444.4', '.434434.', '.432234.', '.222.22.', '...44...', '..4444..', '...43...'], c: ['#f8f0f0', '#f2c453', '#7a3fb4'],
  fit: 'shines in the dark', pegs: 4,
  entry: 'Glow from the Cowrie\'s dome in total darkness. It wandered off on its own one night. Four cowries. It outshines your lamp out of spite.' });

// ================================================================ chapter 3: the Auger's dune
sp({ id: 'gyre', name: 'Tulimuji', types: ['TIDE'], basic: 'M', area: 'augerdune',
  moves: ['gyre_round', 'gyre_whirlin', 'gyre_gather', 'gyre_auger'], passives: ['gyre_shape', 'gyre_inner'],
  sprite: ['..2332..', '.2....2.', '2..22..2', '2.2112.2', '2..22..2', '.2.2..2.', '..2.22..', '...44...'], c: ['#c4e4f4', '#46a8e6', '#476784'],
  fit: 'goes round', pegs: 3,
  entry: 'Plus wind. It spun inside the Auger so long it took on its shape. Sit down before you count out three cowries.' });
sp({ id: 'lichen', name: 'Kokala', types: ['ROOT'], basic: 'M', area: 'augerdune',
  moves: ['lichen_encrust', 'lichen_feed', 'lichen_cling', 'lichen_crust'], passives: ['lichen_dryside', 'lichen_growth'],
  sprite: ['..2..2..', '.232232.', '22222222', '21222212', '23222322', '223.2232', '.222222.', '..4..4..'], c: ['#afbe97', '#cd7100', '#4a5039'],
  fit: 'creeps to the dry side', pegs: 1,
  entry: 'Lichen, found on the Auger\'s exterior. It migrates to the dry side with every tide. Is it slow? Extremely. One cowrie, payable next year.' });
sp({ id: 'groundswell', name: 'Maineri', types: ['TIDE'], basic: 'M', area: 'augerdune',
  moves: ['groundswell_swell', 'groundswell_lift', 'groundswell_turn', 'groundswell_spring'], passives: ['groundswell_full', 'groundswell_setdown'],
  sprite: ['..3333..', '.322223.', '22222222', '21222212', '222.2222', '24444442', '44444444', '4.4..4.4'], c: ['#42a1b1', '#e6f6f6', '#26526f'],
  fit: 'lifts and sets down', pegs: 4,
  entry: 'The swell that raised the Auger at high water and set it down again lifts cargo, and prices too. Three cowries this morning. Four now.' });

// ================================================================ chapter 3: the mouth room
sp({ id: 'chalk', name: 'Hakutu', types: ['SALT'], basic: 'P', area: 'augermouth',
  moves: ['chalk_toss', 'chalk_dust', 'chalk_climb', 'chalk_hands'], passives: ['chalk_grip', 'chalk_hand'],
  sprite: ['2.2.2.2.', '2.2.2.2.', '22222222', '22122122', '222.2222', '22333322', '.222222.', '..4444..'], c: ['#f2f2ee', '#c0b8d8', '#6d6d7b'],
  fit: 'climbs out of anything', pegs: 2,
  entry: 'White dust, once kept in a climber\'s pouch until it escaped. Two cowries, and it will escape from yours as well.' });
sp({ id: 'saltline', name: 'Sujiva', types: ['SALT'], basic: 'M', area: 'augermouth',
  moves: ['saltline_rime', 'saltline_wall', 'saltline_wash', 'saltline_spring'], passives: ['saltline_roll', 'saltline_mark'],
  sprite: ['....3...', '....33..', '....3...', '22222222', '212.2212', '24444442', '22222222', '22.22.22'], c: ['#efefe9', '#d19a21', '#677d94'],
  fit: 'rises a little every tide', pegs: 3,
  entry: 'The white line the tide leaves on the Auger\'s walls, rising slightly with each wave. Three cowries and climbing.' });

// ================================================================ chapter 3: the rolling rooms
sp({ id: 'tumbleweed', name: 'Kokieri', types: ['ROOT'], basic: 'M', area: 'augerroll',
  moves: ['tumbleweed_through', 'tumbleweed_bound', 'tumbleweed_hitch', 'tumbleweed_round'], passives: ['tumbleweed_never', 'tumbleweed_burs'],
  sprite: ['......3.', '.....333', '..3222.3', '3242.42.', '241.2142', '24122142', '.222.22.', '4.2222.4'], c: ['#bf9f6f', '#c84f80', '#705037'],
  fit: 'never roots', pegs: 1,
  entry: 'Weed. It rolls through the Auger\'s rooms but never takes root. It entered my front door and exited the back without paying. One cowrie.' });
sp({ id: 'riser', name: 'Pordan', types: ['GEAR'], basic: 'P', area: 'augerroll',
  moves: ['riser_tread', 'riser_goup', 'riser_kick', 'riser_flight'], passives: ['riser_goesup', 'riser_banister'],
  sprite: ['.4....4.', '.44..44.', '.222222.', '21222212', '22233222', '42222233', '44444.33', '44444444'], c: ['#b5602f', '#fdbe4e', '#5d5463'],
  fit: 'goes up when stood on', pegs: 3,
  entry: 'One step off the Auger\'s staircase. Stand on it, and it rises on its own. Three cowries, ascending.' });
sp({ id: 'columella', name: 'Coshira', types: ['STONE'], basic: 'P', area: 'augerroll',
  moves: ['columella_axis', 'columella_dash', 'columella_middle', 'columella_under'], passives: ['columella_center', 'columella_climbed'],
  sprite: ['.222222.', '.442222.', '.224422.', '.212212.', '.222244.', '.44.222.', '.224422.', '44433444'], c: ['#decfb7', '#46a8e6', '#937355'],
  fit: 'holds up the middle', pegs: 5,
  entry: 'The central post of the Auger. It climbed itself! Everything leans against it, including me. Five cowries, and it leans back.' });

// ================================================================ chapter 3: the stair
sp({ id: 'crimp', name: 'Tegaote', types: ['STONE'], basic: 'M', area: 'augerstair',
  moves: ['crimp_tip', 'crimp_under', 'crimp_rest', 'crimp_through'], passives: ['crimp_sixty', 'crimp_smooth'],
  sprite: ['....4...', '...444..', '..2222..', '44444444', '.131131.', '..4.44..', '.444444.', '...14...'], c: ['#ff24ce', '#f6d733', '#502f8c'],
  fit: 'is worn by every hand', pegs: 2,
  entry: 'A handhold, worn into the wall by sixty years of touch until it took the shape of a finger. Two cowries. Hold it gently. It is tired.' });
sp({ id: 'chamois', name: 'Kamopra', types: ['BEAST'], basic: 'P', area: 'augerstair',
  moves: ['chamois_butt', 'chamois_wallrun', 'chamois_leap', 'chamois_headlong'], passives: ['chamois_horns', 'chamois_foot'],
  sprite: ['.4....4.', '.44..44.', '.222222.', '21422412', '22422422', '.22.222.', '..2332..', '..2..2..'], c: ['#decfb7', '#bc7676', '#3f3539'],
  fit: 'climbs sideways', pegs: 2,
  entry: 'Goat! The climbers kept it. It still climbs walls sideways. Two cowries, plus the value of whatever it stands on.' });
sp({ id: 'swift', name: 'Pasubame', types: ['BEAST'], basic: 'P', area: 'augerstair',
  moves: ['swift_scythe', 'swift_screech', 'swift_dive', 'swift_endless'], passives: ['swift_aloft', 'swift_double'],
  sprite: ['..4..4..', '..4444..', '.432234.', '.422224.', '...11...', '..2332.1', '.2222221', '..2..2..'], c: ['#4d4353', '#f6eeae', '#817162'],
  fit: 'never lands', pegs: 3,
  entry: 'Swift, which nested at the Auger\'s peak and never landed lower. It sells for three cowries, up a ladder.' });
sp({ id: 'torr', name: 'Kukira', types: ['GEAR'], basic: 'M', area: 'augerstair',
  moves: ['torr_gust', 'torr_blast', 'torr_breathe', 'torr_blowout'], passives: ['torr_kept', 'torr_narrow'],
  sprite: ['...33333', '....444.', '..33344.', '.2232244', '.2131244', '.2232242', '..2.244.', '.22.224.'], c: ['#b3aca2', '#ffeaaa', '#416147'],
  fit: 'keeps pushing', pegs: 2,
  entry: 'The draft moving through the Auger\'s narrow Whorls. It got a shell and kept pushing. Two cowries. It will push for one.' });

// ================================================================ chapter 3: the point
sp({ id: 'plummet', name: 'Otosus', types: ['VOID'], basic: 'M', area: 'augerpoint',
  moves: ['plummet_drop', 'plummet_freefall', 'plummet_trip', 'plummet_bottom'], passives: ['plummet_kept', 'plummet_nofloor'],
  sprite: ['22222222', '24444442', '24222242', '24311342', '24222242', '244.4442', '22222222', '.2....2.'], c: ['#c1b9d1', '#8757c4', '#413657'],
  fit: 'keeps falling', pegs: 4,
  entry: 'The drop beneath the top stair. It kept falling after everyone else stopped, and it falls still. Drop four cowries in and listen for them.' });
sp({ id: 'zenith', name: 'Huipki', types: ['STAR'], basic: 'M', area: 'augerpoint',
  moves: ['zenith_pointat', 'zenith_shot', 'zenith_bearing', 'zenith_highest'], passives: ['zenith_points', 'zenith_plumb'],
  sprite: ['..4444..', '..4444..', '44444444', '.412214.', '.212212.', '333.3333', '..4444..', '...14...'], c: ['#e4ccbc', '#8e764f', '#483866'],
  fit: 'points at one thing', pegs: 5,
  entry: 'The highest point the Auger has ever reached. It points there still. Up. That way. The five cowries go this way.' });
sp({ id: 'bourdon', name: 'Humiri', types: ['STAR'], basic: 'M', area: 'augerpoint',
  moves: ['bourdon_low', 'bourdon_drone', 'bourdon_air', 'bourdon_tune'], passives: ['bourdon_listen', 'bourdon_starts'],
  sprite: ['.3.33.3.', '33333333', '12222221', '12122121', '.22.222.', '44222233', '..2..2..', '.44..44.'], c: ['#9c663e', '#9cd32e', '#3c3c4a'],
  fit: 'hums low', pegs: 3,
  entry: 'The low note the Auger hums when air passes through it. This one kept humming on my shelf all night. Three cowries. Please.' });

// ================================================================ rare
sp({ id: 'ostium', name: 'Reikuchi', types: ['VOID'], basic: 'M', area: 'outerwhorl',
  moves: ['ostium_through', 'ostium_under', 'ostium_step', 'ostium_margin'], passives: ['ostium_anywhere', 'ostium_burn'],
  sprite: ['..2222..', '.213312.', '23333332', '23333332', '2333.332', '.233332.', '..2222..', '..4..4..'], c: ['#000f97', '#eef6fd', '#9098af'],
  fit: 'opens where it is put', pegs: 6,
  entry: 'The hole the star burned through the Margin! It opens wherever it is placed. Six cowries. Mine is on the floor. I can\'t find the floor.' });
sp({ id: 'gimlet', name: 'Kairari', types: ['VOID'], basic: 'P', area: 'underteeth',
  moves: ['gimlet_drillmove', 'gimlet_radula', 'gimlet_foot', 'gimlet_goin'], passives: ['gimlet_drill', 'gimlet_goes'],
  sprite: ['..4444..', '.422224.', '42233224', '42311324', '.422224.', '4.4..4.4', '.4.44.4.', '4..4..4.'], c: ['#ede5ed', '#a958e6', '#563674'],
  fit: 'drills in and stays', pegs: 6,
  entry: 'Moon snail. It drills a round hole in anything and enters. It drilled my cowries, the little button. Six cowries. Three, with a hole in.' });
sp({ id: 'albatross', name: 'Vobasa', types: ['BEAST'], basic: 'P', area: 'augerpoint',
  moves: ['albatross_wingspan', 'albatross_soar', 'albatross_shadow', 'albatross_beach'], passives: ['albatross_never', 'albatross_shell'],
  sprite: ['..3..3..', '..3333..', '.312313.', '.322223.', '4.3223.4', '44333344', '4.3333.4', '...23...'], c: ['#f5f5f5', '#31acdc', '#ffeb35'],
  fit: 'flies over everything', pegs: 7,
  entry: 'A bird circled the beach, never landing. Only its shell fell. Seven cowries. It\'s still circling if you care.' });
sp({ id: 'protoconch', name: 'Alkume', types: ['TIDE'], basic: 'M', area: 'oldchambers',
  moves: ['protoconch_jet', 'protoconch_room', 'protoconch_pea', 'protoconch_coil'], passives: ['protoconch_first', 'protoconch_sealed'],
  sprite: ['4......4', '44.22.44', '44222244', '.232232.', '.22.222.', '4.2222.4', '..2..2..', '.2....2.'], c: ['#62419e', '#ee61c1', '#352b50'],
  fit: 'grows a room at a time', pegs: 6,
  entry: 'The Nautilus\'s first chamber, pea-sized. It grew its own shell and keeps expanding. Six cowries today. Larger tomorrow.' });

// ================================================================ special
sp({ id: 'smallgranw', name: 'Small Gran', types: ['BEAST'], basic: 'P', area: 'sanddollar', wild: false,
  moves: ['smallgranw_today', 'smallgranw_scratch', 'smallgranw_feel', 'smallgranw_look', 'smallgranw_there'], passives: ['smallgranw_next', 'smallgranw_away'],
  sprite: ['.4....4.', '.44..44.', '14444441', '14444441', '41444414', '4.1331.4', '3.13.313', '..1..1..'], c: ['#e8dcd0', '#f4eef8', '#b890d0'],
  fit: 'says her next line', pegs: 0,
  entry: 'Gran\'s cast. It appeared in my bundle, resting atop the cowries. No price. I carried her. I never purchased her, and I would not sell her.' });
