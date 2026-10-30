// Party banter entries: where each exchange in src/script/banter.txt can play and who must be along.
import { addBanter } from './banter';

const CH2 = 'chapter>=2&chapter<3';
const CH3 = 'chapter>=3&chapter<4';
const CH34 = 'chapter>=3&chapter<5';
const CH4 = 'chapter>=4&chapter<5';
const CH5 = 'chapter>=5&chapter<6';

addBanter([
  // Chapters 1 and 2: the Deeps
  { scene: 'b_port_ch1', district: 'deeps', party: ['courtesy'], when: 'spill&chapter<2' },
  { scene: 'b_port_ch2', district: 'deeps', party: ['sallis'], when: CH2 },
  { scene: 'b_cs_behind', district: 'deeps', party: ['courtesy', 'sallis'], when: CH2 },
  { scene: 'b_cq_dents', district: 'deeps', party: ['courtesy', 'quaye'], when: CH2 },
  { scene: 'b_ca_decorum', district: 'deeps', party: ['courtesy', 'ambrose'], when: CH2 },
  { scene: 'b_sa_knee', district: 'deeps', party: ['sallis', 'ambrose'], when: CH2 },
  { scene: 'b_qa_shirt', district: 'deeps', party: ['quaye', 'ambrose'], when: CH2 },
  { scene: 'b_trio_cycles', district: 'deeps', party: ['courtesy', 'sallis', 'quaye'], when: CH2 },
  { scene: 'b_sq_round', maps: ['market'], party: ['sallis', 'quaye'], when: CH2 },
  { scene: 'b_market_posters', maps: ['market'], party: ['sallis', 'ambrose'], when: CH2 },
  { scene: 'b_lock_chamber', maps: ['lock'], party: ['quaye', 'sallis'], when: CH2 },
  { scene: 'b_pound_list', maps: ['pound'], party: ['courtesy', 'quaye'], when: 'chapter>=2&chapter<5' },
  { scene: 'b_depot_dark', maps: ['depot'], party: ['sallis', 'courtesy'], when: 'gig_crates_on|gig_painter_on' },
  { scene: 'b_houseboat_hull', maps: ['houseboat'], party: ['quaye', 'ambrose'] },

  // Chapter 3: the Stair
  { scene: 'b_tc_long', district: 'stair', party: ['tova', 'courtesy'], when: CH3 },
  { scene: 'b_ti_robe', district: 'stair', party: ['tova', 'ignace'], when: CH34 },
  { scene: 'b_is_smile', district: 'stair', party: ['ignace', 'sallis'], when: CH34 },
  { scene: 'b_iq_candle', district: 'stair', party: ['ignace', 'quaye'], when: CH34 },
  { scene: 'b_ta_arms', district: 'stair', party: ['tova', 'ambrose'], when: CH34 },
  { scene: 'b_tq_pins', district: 'stair', party: ['tova', 'quaye'], when: CH34 },
  { scene: 'b_ci_walkways', district: 'stair', party: ['courtesy', 'ignace'], when: CH3 },
  { scene: 'b_st_kees', district: 'stair', party: ['sallis', 'tova'], when: CH3 },
  { scene: 'b_ai_long', district: 'stair', party: ['ambrose', 'ignace'], when: CH34 },
  { scene: 'b_trio_stair', district: 'stair', party: ['tova', 'ambrose', 'ignace'], when: CH34 },
  { scene: 'b_steps_lies', maps: ['steps'], party: ['tova', 'ignace'], when: CH34 },
  { scene: 'b_census_dry', maps: ['census'], party: ['tova'], when: CH34 },
  { scene: 'b_spire_up', maps: ['spirebase'], party: ['ignace'], when: CH34 },
  { scene: 'b_plaza_candles', maps: ['plaza'], party: ['ignace', 'quaye'], when: 'ignace_joined&!statue_seen' },
  { scene: 'b_plaza_after', maps: ['plaza'], party: ['tova', 'ignace'], when: 'statue_seen&chapter<6' },
  { scene: 'b_violet_ball', maps: ['violet'], party: ['tova', 'ignace'] },
  { scene: 'b_rooftop_count', maps: ['rooftop'], party: ['sallis', 'tova'] },

  // Chapter 4: Sunny Steps
  { scene: 'b_cs_copy', district: 'stair', party: ['courtesy', 'sallis'], when: `${CH4}&courtesy_freed&!courtesy_slowing` },
  { scene: 'b_lostprop_owner', maps: ['lostprop'], party: ['courtesy', 'ambrose'], when: 'courtesy_freed' },
  { scene: 'b_tq_key', district: 'stair', party: ['tova', 'quaye'], when: `${CH4}&lam_met` },
  { scene: 'b_port_hand', district: 'stair', party: ['tova'], when: `${CH4}&port_powers&!port_quiet` },

  // Chapter 5: High Water
  { scene: 'b_qs_rope', district: 'deeps', party: ['quaye', 'sallis'], when: CH5 },
  { scene: 'b_at_marit', district: 'deeps', party: ['ambrose', 'tova'], when: `${CH5}&marit_aboard` },
  { scene: 'b_cq_slow', district: 'deeps', party: ['courtesy', 'quaye'], when: `${CH5}&!courtesy_want` },
  { scene: 'b_ct_early', district: 'deeps', party: ['courtesy', 'tova'], when: `${CH5}&courtesy_want` },
  { scene: 'b_port_rain', district: 'deeps', party: ['ignace'], when: `${CH5}&port_want` },
  { scene: 'b_pound_tilly', maps: ['pound'], party: ['sallis', 'courtesy'], when: `${CH5}&courtesy_want` },
  { scene: 'b_ignace_told', district: 'deeps', party: ['ignace', 'quaye'], when: `${CH5}&ignace_told` },
  { scene: 'b_ignace_rich', district: 'deeps', party: ['ignace', 'tova'], when: `${CH5}&ignace_blackmail` },
  { scene: 'b_hanne_vein', party: ['sallis', 'ambrose'], when: 'hanne_vein' },
  { scene: 'b_hanne_gone', party: ['sallis', 'ambrose'], when: 'hanne_killed' },
  { scene: 'b_hanne_spared', party: ['sallis', 'quaye'], when: 'hanne_spared&!hanne_vein' },
  { scene: 'b_ambrose_free', party: ['ambrose', 'tova'], when: 'ambrose_free|lease_burned|lease_stolen|lease_bought' },
  { scene: 'b_tq_score', party: ['tova', 'quaye'], when: 'kees_moved' },

  // Chapter 6: the Brim
  { scene: 'b_seawall_rail', maps: ['seawall'], party: ['sallis', 'quaye'] },
  { scene: 'b_plaza_dry', maps: ['boardplaza'], party: ['ambrose', 'ignace'] },
  { scene: 'b_brim_walkways', district: 'brim', party: ['tova', 'courtesy'], when: 'courtesy_want&!marit_died' },

  // The Flats
  { scene: 'b_flats_level', maps: ['flats_camp', 'flats_mud'], party: ['sallis', 'quaye'] },

  // The Line tunnels
  { scene: 'b_metro_count', maps: ['metro_tunnel'], party: ['sallis', 'quaye'] },
  { scene: 'b_metro_lines', maps: ['metro_station'], party: ['ambrose', 'quaye'] },
  { scene: 'b_metro_gates', maps: ['metro_tunnel'], party: ['courtesy', 'sallis'], when: 'gates_met&!gates_done' },
  { scene: 'b_metro_moles', maps: ['metro_station'], party: ['ambrose', 'sallis'] },
  { scene: 'b_metro_train', maps: ['metro_tunnel'], party: ['quaye', 'courtesy'], when: 'quest:lasttrain' },
  { scene: 'b_metro_tubeb', maps: ['metro_tunnel'], party: ['quaye', 'sallis'], when: '!cutters_gone' },
  { scene: 'b_metro_spoor', maps: ['metro_station'], party: ['courtesy', 'ambrose'], when: 'spoor_met' },
  { scene: 'b_deep_asleep', maps: ['metro_deep'], party: ['ambrose', 'courtesy'] },
  { scene: 'b_deep_clearance', maps: ['metro_deep'], party: ['sallis', 'quaye'] },
  { scene: 'b_deep_window', maps: ['metro_deep'], party: ['ambrose', 'quaye'], when: 'window_seen' },
  { scene: 'b_metro_dark', maps: ['metro_station'], party: ['sallis', 'quaye'], when: 'lamps_dark' },

  // Romance
  { scene: 'b_rom_tova', party: ['tova'], when: 'tova_romance&!port_quiet|romance5_tova&!port_quiet|tova_romance&port_want|romance5_tova&port_want' },
  { scene: 'b_rom_ambrose', party: ['ambrose', 'quaye'], when: 'ambrose_romance|romance5_ambrose' },
  { scene: 'b_rom_sallis', party: ['sallis', 'quaye'], when: 'sallis_romance|romance5_sallis' },

  // Approval
  { scene: 'b_app_tova', party: ['tova', 'sallis'], when: 'approval:tova>=10' },
  { scene: 'b_app_sallis', party: ['sallis', 'quaye'], when: 'approval:sallis>=10' },
  { scene: 'b_app_ignace_low', party: ['ignace', 'ambrose'], when: 'approval:ignace<-10' },
  { scene: 'b_app_ambrose', party: ['ambrose', 'tova'], when: 'approval:ambrose>=10' },

  // Conflicts and Quaye's romance
  { scene: 'b_ti_cold', party: ['tova', 'ignace'], when: 'rel:tova-ignace<-2&!ti_peace' },
  { scene: 'b_ti_warm', party: ['tova', 'ignace'], when: 'ti_peace' },
  { scene: 'b_sq_cold', party: ['sallis', 'quaye'], when: 'rel:sallis-quaye<-2&!sq_peace' },
  { scene: 'b_sq_warm', party: ['sallis', 'quaye'], when: 'sq_peace' },
  { scene: 'b_rom_quaye', party: ['quaye', 'ambrose'], when: 'quaye_romance' },
]);
