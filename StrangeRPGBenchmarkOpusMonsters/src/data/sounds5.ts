// Each move's sound for kits5.ts as a one-line spec, keyed by move id. Notes/move-sounds.md has the words and how to write one.
import type { SoundEntry } from '../game/soundspec';

export const SOUNDS5: Record<string, SoundEntry> = {
  // Rokbo: a barnacle's shell that snaps shut, and its cirri rattling out of it.
  acorn_cirri: 'shell rattle short | shell whistle short | shell snap shell rattle short',
  acorn_cement: 'shell scrape short | salt whistle | shell snap salt crack',
  acorn_shut: 'shell rattle soft fall | shell whistle soft | shell snap hard shell knock low',
  acorn_bed: 'shell rattle long | shell whistle | shell snap wide stone crack stone thud',
  // Comine: an old shell lip that knocks and crunches, and turns to stone when it is big.
  varix_toss: 'shell scrape short | stone whistle low | shell knock stone crack soft',
  varix_hop: 'shell knock soft | - | shell crunch fur thud soft',
  varix_grind: 'shell rattle | stone whistle low | shell crunch stone scrape short',
  varix_spring: 'shell swell | shell whistle | shell crack hard stone thud stone rumble',
  varix_boulder: 'stone swell soft | stone whistle low | stone thud wide shell knock soft',
  varix_wallop: 'stone thud low | - | stone thud wide shell crack',
  varix_crunch: 'stone whoosh | - | shell crunch hard stone crack',
  // Kamorus: a gull's call on A5 over the rush of air.
  mew_dive: 'air chirp a5 | air whistle fall | bone crunch fur rustle short',
  mew_wheel: 'air chirp a5 x2 | air rustle | air chirp e6 air whoosh short',
  mew_snatch: 'air whoosh | water warble | water splash air chirp a5 short',
  mew_forty: 'air chirp a5 long | air rustle | air chirp d6 star chime gear knock soft',
  // Shiola: square grains of salt that snap and crackle.
  halite_grain: 'salt swell | salt fizz | salt snap salt crackle short',
  halite_dryout: 'salt scrape short | salt whistle | salt snap salt crackle long',
  halite_square: 'salt thud | salt fizz | salt snap wide stone crack soft',
  halite_pan: 'salt swell | salt fizz | salt snap hard salt shatter glass chime high',
  // Nomipu: soft hops on sand, and a bite at the end of each.
  skitter_pounce: 'sand knock soft | - | bone crunch sand thud soft',
  skitter_kick: 'sand knock soft x2 | sand hiss | sand splash wide',
  skitter_burrow: 'sand scrape short | sand hiss | sand thud air hiss short',
  skitter_night: 'sand knock soft x3 | - | fur thud soft void hum low long',
  // Rakmata: bladders of wrack that pop wet.
  fucus_lash: 'root creak soft | water warble | air pop water splash',
  fucus_inflate: 'water swell | water warble high | air pop soft water gulp',
  fucus_pop: 'root creak low | water warble | air pop root rustle short',
  fucus_wrack: 'water swell | water warble high | air pop wide water splash root crack',
  // Cistako: a wooden crate that thumps, and nails going in.
  flotsam_batten: 'root whoosh | root whistle | root thud gear snap x2',
  flotsam_stove: 'root thud | - | root crack root thud soft',
  flotsam_bob: 'root scrape short | root rattle | root thud gear knock soft',
  flotsam_nailed: 'root creak | gear rattle | gear snap hard root thud stone crack',
  // Mibu: a warm hum, and a star's chime where its glint lands.
  mote_glint: 'ember hum soft | star warble | star chime ember crackle short',
  mote_turn: 'ember hum | star whistle rise | star chime ember crackle long',
  mote_hand: 'ember hum short | sand hiss | sand thud ember crackle short',
  mote_star: 'ember swell | star warble | star chime high ember crackle long star ring soft',
  // Ampullo: frosted bottle glass that scrapes and snaps.
  seaglass_shard: 'glass scrape short | glass whistle | glass snap salt crackle short',
  seaglass_rub: 'glass scrape | sand hiss | stone thud soft glass scrape short hard',
  seaglass_break: 'glass rattle | glass whistle soft | glass shatter soft glass ring short',
  seaglass_beach: 'glass scrape long | glass whistle | glass shatter hard salt crack glass ring',
  // Kamono: a dry salted fish that crunches.
  kipper_slap: 'salt swell | water warble | salt crunch wide water splash soft',
  kipper_desiccate: 'salt rustle soft | water warble high | salt crunch soft star chime',
  kipper_flip: 'water whoosh wide | water rustle | salt crunch root rustle',
  kipper_cured: 'salt swell | water warble low | salt crunch hard water gulp low void swell fall',
  // Isoko: tentacles rustling in the water, and the snap of its stinging cells.
  actinia_arm: 'water rustle | water whoosh short | bone snap soft water gulp',
  actinia_close: 'water rustle fall | - | fur thud water gulp low',
  actinia_bloom: 'water rustle soft | water rustle | water gulp soft star chime',
  actinia_pool: 'water rustle long | water rustle | bone snap water gulp water splash soft',
  // Keeba: a hollow shell's empty ring, low and beating.
  lacuna_scoop: 'void hum soft | shell whistle | shell knock void hum short',
  lacuna_sweep: 'void warble short | - | sand hiss soft shell ring soft',
  lacuna_sink: 'shell scrape short | shell rattle | bone crunch void hum short',
  lacuna_deadlow: 'void swell fall long | shell whistle rise | shell knock wide void hum low long sand hiss',
  // Cohato: a dove's soft call and wing rustle, and a gold chime when it brings something home.
  columba_wing: 'air rustle soft | air rustle | star chime c6 air chirp e5 soft',
  columba_carry: 'shell whoosh wide | shell whistle | shell snap star chime c6 short',
  columba_home: 'air rustle | air chirp e5 | star chime c6 x2',
  columba_ring: 'air swell soft | air chirp e5 | star chime c6 long star ring air rustle long',
  // Spijire: a curl of wet sand that hisses and slaps.
  lobworm_curl: 'sand whoosh wide | sand hiss | sand thud water gulp soft',
  lobworm_go: 'sand gurgle fall | water warble | sand splash water gulp',
  lobworm_collapse: 'sand thud | sand hiss | sand thud stone rumble short',
  lobworm_coil: 'sand gurgle long | sand hiss rise | sand thud root pluck sand hiss long',
  // Veigai: a long steel shell that slices in threes.
  razor_cut: 'gear whoosh | - | gear scrape short x3 gear snap',
  razor_upright: 'sand hiss soft | sand hiss | gear snap gear scrape short',
  razor_dig: 'sand hiss fall | sand hiss short | sand thud soft gear knock soft',
  razor_wind: 'gear whoosh rise | gear whistle | gear scrape short x3 gear snap hard',
  // Renbiwa: a ring of light that hums on the wet sand.
  annulet_draw: 'star hum soft | star warble | star chime star hum short',
  annulet_glow: 'star hum rise | star warble | star chime soft star ring',
  annulet_dither: 'star hum soft high | star whistle | star chime wide star snap',
  annulet_landing: 'star hum long rise | gear crackle | gear zap hard star chime star ring',
  // Madaku: a dark spot that slides with a low beating hum.
  macula_dark: 'void warble short | void hum | void thud void hum low short',
  macula_moveoff: 'void scrape short | void rattle soft | void knock void hum',
  macula_lookup: 'void warble soft | water warble | water splash void warble short',
  macula_spots: 'void warble | void hum | void knock x2 void hum low long',
  // Haota: a soft shell with its mantle rustling over it, and a gleam that chimes on E6.
  pallium_slide: 'air rustle soft | water rustle | shell chime e6 glass ring soft',
  pallium_buff: 'shell swell | shell whistle rise | shell knock water rustle long shell chime e6',
  pallium_dazzle: 'shell swell | water rustle short | fur thud shell crunch shell chime e6 short',
  pallium_shine: 'shell swell rise | star warble | glass chime e6 shell ring long star chime high',
  // Lainami: standing water that holds a low steady hum before it moves.
  seiche_slosh: 'water hum low soft | - | water splash wide water gurgle short',
  seiche_still: 'water swell rise | water warble | water gulp low water hum low long',
  seiche_hold: 'void swell fall soft | water whoosh soft | void thud water hum low long',
  seiche_break: 'water hum low water rumble | water whoosh | water splash hard wide water rumble long stone thud low',
  // Roibuki: thin high spray that keeps hissing after the blow.
  scud_whip: 'salt scrape short | air whistle high | salt crack salt hiss short',
  scud_skip: 'void warble short | salt fizz soft | air pop salt hiss soft',
  scud_run: 'air whoosh | salt hiss | star chime salt crack short',
  scud_spume: 'void warble air whoosh | air whistle high long | salt shatter hard salt hiss long void thud',
  // Nitorshi: a pane of enamel that rings on G when the light catches it.
  enamel_slam: 'glass chime g5 soft | glass hum wide | stone knock glass chime g6',
  enamel_bash: 'stone swell fall soft | glass whistle soft | stone knock soft glass ring g5 soft',
  enamel_glaze: 'air whoosh | glass whistle | glass chime g6 short glass scrape short hard',
  enamel_whole: 'glass swell rise | glass whistle rise | glass chime g5 stone thud hard glass ring long',
  // Poscus: a glazed pig that clonks like porcelain and gathers ice.
  porcella_snort: 'fur growl short | - | glass knock air pop low',
  porcella_start: 'glass rattle air whoosh wide | - | glass knock hard stone crack ice crackle',
  porcella_bump: 'fur scrape short | ice whistle low | glass knock soft ice crunch',
  porcella_downhill: 'glass rattle ice scrape | - | glass knock hard stone thud ice crackle long',
  // Kolikni: a purse of tiny coins that clinks on B6.
  specie_clip: 'gear snap | shell whistle short | shell chime b6 gear scrape short',
  specie_payout: 'gear rattle short | shell whistle low | shell chime b6 stone knock soft',
  specie_buy: 'gear swell | shell rattle soft | shell chime b6 x2 gear knock soft',
  specie_spend: 'gear rattle shell swell | shell rattle | shell chime b6 x3 stone crack wide shell crunch',
  // Limashi: grit that scrapes under every blow.
  emery_coarse: 'air whoosh | sand hiss short | salt crack sand scrape short hard',
  emery_rub: 'air whoosh short | sand hiss long | stone thud sand scrape hard',
  emery_abrade: 'sand hiss soft | sand rattle | sand crunch soft sand scrape long',
  emery_polishoff: 'sand scrape wide sand rumble | sand hiss | glass shatter hard sand scrape long salt crackle',
  // Faience: a glazed flower that rings true on A5.
  faience_clear: 'glass chime a5 soft | root rustle soft | glass chime a5 hard glass ring',
  faience_chime: 'glass swell | glass chime e6 short | glass chime a5 root knock soft',
  faience_box: 'root creak | water warble | water gulp glass chime a5 short water drip',
  faience_peal: 'glass swell rise | glass chime e6 | glass chime a5 hard glass ring long root knock',
  // Serrari: teeth that crunch and click as they mesh.
  denticle_bite: 'air whoosh | air whistle short | bone crunch water drip short',
  denticle_teeth: 'bone swell | bone rattle | bone snap x3 fur growl short',
  denticle_overbite: 'air whoosh | - | bone crunch hard water gulp low',
  denticle_lockjaw: 'fur growl low air whoosh | air whistle | bone crunch hard bone snap x2 water drip',
  // Rakoma: the hollow whistle of air through a gap in the teeth.
  diastema_null: 'void chime soft | void whistle | void thud void swell fall short',
  diastema_slip: 'void warble short | - | bone snap void whistle short',
  diastema_close: 'void swell fall soft | water warble | water gulp void whistle long',
  diastema_wider: 'void whistle low air whoosh | void hum | void thud hard void whistle long bone crack',
  // Makimen: a soft roll of lip that creaks as it rolls and unrolls.
  furl_lash: 'root creak short | - | root knock fur scrape short x3',
  furl_tight: 'root creak | fur rustle | root knock fur thud soft',
  furl_whip: 'root creak rise air whoosh short | water warble | water splash root snap',
  furl_unroll: 'root creak long | root rustle | root knock wide fur scrape short hard root creak rise',
  // Tardas: a mirror note on D5 that always sounds twice.
  laggard_catchup: 'air rustle soft | glass hum | glass chime d5 x2 void thud soft',
  laggard_behind: 'void warble short | glass warble | void thud wide glass chime d5 x2',
  laggard_lag: 'air rustle soft | water warble | water splash glass chime d5 x2',
  laggard_mirror: 'glass chime d5 soft glass swell | glass whistle | glass chime d5 x2 void thud hard glass ring long',
  // Tain: bare silver that rings low and long.
  tain_backing: 'glass hum soft | glass whistle | glass chime glass ring low short',
  tain_blank: 'star chime soft | glass hum wide | star chime glass ring low long',
  tain_tarnish: 'void swell | - | void thud air hiss soft glass ring low',
  tain_empty: 'glass swell void hum | glass warble | void thud hard glass ring low long void swell fall',
  // Daz: a shimmer of star ring in the dark.
  luster_shine: 'star chime soft | star whistle | star chime high star ring soft',
  luster_drowse: 'air rustle soft | void whistle soft | star chime e5 soft star ring long',
  luster_long: 'void warble short | ember crackle | gear snap star ring short',
  luster_glare: 'star swell glass hum | star hum wide | star chime hard star ring long glass shatter soft',
  // Tulimuji: wind that howls round and round.
  gyre_round: 'air whoosh wide | air howl soft | water splash air whoosh short',
  gyre_whirlin: 'air whoosh wide | air howl | water gulp air howl long',
  gyre_gather: 'air whoosh wide | sand hiss | stone thud soft air howl short',
  gyre_auger: 'air howl rise air whoosh wide | water warble | water gulp air howl long water fizz',
  // Kokala: dry lichen that crackles as it creeps.
  lichen_encrust: 'air rustle soft | root rustle | root knock root crackle long',
  lichen_feed: 'root rustle soft | water rustle | root knock soft root crackle water drip',
  lichen_cling: 'air whoosh | stone whistle | stone crunch root crackle short',
  lichen_crust: 'stone thud root crackle | stone whistle low | stone crack hard root crackle long root pluck',
  // Maineri: water that swells up and sets down.
  groundswell_swell: 'water swell rise | water warble | water splash wide water gulp low',
  groundswell_lift: 'water swell soft | water warble high | water gulp water swell long',
  groundswell_turn: 'water swell soft | water warble low | gear knock water gulp low water swell short',
  groundswell_spring: 'water swell rise water rumble | water warble | water splash hard wide water gulp low water swell fall',
  // Hakutu: puffs of chalk that pop off its hands.
  chalk_toss: 'sand rattle | sand hiss | sand pop air hiss short',
  chalk_dust: 'fur snap x2 | sand hiss | sand pop low sand hiss long',
  chalk_climb: 'fur knock soft | sand hiss short | fur thud sand pop sand scrape short x3',
  chalk_hands: 'sand hiss air whoosh | - | salt crack hard fur thud sand pop',
  // Sujiva: salt that crackles as the line dries.
  saltline_rime: 'salt chime soft | salt fizz | salt crack salt crackle short',
  saltline_wall: 'salt chime low soft | salt fizz | stone crack salt crackle long',
  saltline_wash: 'salt thud | salt fizz | salt crack salt crackle rise',
  saltline_spring: 'salt crackle salt swell | salt fizz | salt shatter hard salt crackle long stone thud',
  // Kokieri: dry twigs that rattle as it rolls.
  tumbleweed_through: 'air whoosh wide | root rattle | root knock air pop soft',
  tumbleweed_bound: 'root rattle air whoosh | sand hiss | root snap air pop',
  tumbleweed_hitch: 'root knock soft | root rattle soft | root knock root rattle short',
  tumbleweed_round: 'root rattle air whoosh wide | root rustle | root knock star warble root rattle long',
  // Pordan: a wooden tread that knocks a step higher each time.
  riser_tread: 'root knock rise | gear rattle | gear crack root knock',
  riser_goup: 'root knock | stone whistle low | stone thud wide root knock rise',
  riser_kick: 'root knock soft | - | gear knock root knock rise x3',
  riser_flight: 'root knock rise gear swell | gear rattle | gear crack hard root knock rise ember crackle long',
  // Coshira: a hollow post that rings low under every blow.
  columella_axis: 'air whoosh wide | stone whistle | stone snap stone scrape short shell ring low',
  columella_dash: 'air whoosh | stone rattle | stone crack shell ring low short',
  columella_middle: 'stone thud | - | stone knock low shell ring low long',
  columella_under: 'stone swell fall soft | - | stone thud shell ring low long stone rumble short',
  // Tegaote: a resin hold that clacks.
  crimp_tip: 'bone knock soft | stone whistle low | stone crack bone knock',
  crimp_under: 'stone rattle | stone whistle | stone crack hard bone knock low',
  crimp_rest: 'stone thud | stone whistle low | bone knock stone crack short',
  crimp_through: 'bone knock x3 air whoosh | stone whistle low | stone shatter hard stone crack bone knock',
  // Kamopra: horns that knock low.
  chamois_butt: 'air whoosh | - | bone knock low hard stone crack',
  chamois_wallrun: 'bone knock soft x2 | stone whistle low | bone knock low stone rattle short',
  chamois_leap: 'water swell soft | water warble | water splash hard bone knock low',
  chamois_headlong: 'fur growl low air whoosh | - | bone knock low hard stone crack stone thud',
  // Pasubame: the high scream of a swift.
  swift_scythe: 'air chirp high soft | air whistle | fur thud bone scrape short',
  swift_screech: 'air chirp high x2 | air warble high | fur thud air chirp high',
  swift_dive: 'air whoosh | water warble | water splash air chirp high',
  swift_endless: 'air chirp high x3 | air rustle | fur thud wide bone scrape short hard air chirp high',
  // Kukira: pressed air that hisses as it builds.
  torr_gust: 'air hiss short | air whistle | air pop gear snap',
  torr_blast: 'air pop low | air whoosh | gear crack wide air hiss short',
  torr_breathe: 'air hiss rise | air whoosh soft | void thud air hiss long',
  torr_blowout: 'air hiss rise gear swell | air whoosh | gear crack hard air pop low air hiss long',
  // Otosus: a hollow whistle that falls and falls.
  plummet_drop: 'void swell fall soft | void whistle fall | stone crack void thud',
  plummet_freefall: 'void swell fall | - | void thud void whistle fall long',
  plummet_trip: 'air rustle soft | water warble | water splash wide void whistle fall short',
  plummet_bottom: 'void whistle fall long void swell fall | void whistle fall | void thud hard wide void rumble long stone crack',
  // Huipki: one high star note on C7, the point it aims at.
  zenith_pointat: 'star chime c7 soft | star whistle | star pop star chime c7 short',
  zenith_shot: 'air rustle soft | star hum | gear snap star chime c7',
  zenith_bearing: 'star chime c7 soft | gear rattle | gear knock gear ring short',
  zenith_highest: 'star chime c7 star swell rise | star whistle fall | star chime c7 hard star shatter glass ring long',
  zenith_parting: 'star chime c7 short | star whistle short | star pop high',
  // Humiri: a low organ note on C3 under everything it does.
  bourdon_low: 'air pipe c3 soft | star hum low | star chime c4 x2 star ring',
  bourdon_drone: 'air pipe c3 soft | star chime c4 | star ring c3 star chime soft',
  bourdon_air: 'air swell low | air pipe c3 | air pop low air whoosh short',
  bourdon_tune: 'air pipe c3 star swell | star chime c4 | star chime c4 star ring c3 long air pipe c3 soft',
  // Reikuchi: a burned hole that crackles at its edge.
  ostium_through: 'void chime soft | star hum wide | void crack ember crackle short',
  ostium_under: 'void swell fall soft | star warble | star chime ember crackle short',
  ostium_step: 'void warble short | void warble | void thud ember crackle short',
  ostium_margin: 'void swell star hum | void warble | void thud star chime ember crackle long',
  // Kairari: a shell drill that scrapes as it bores.
  gimlet_drillmove: 'air whoosh wide | shell whistle | shell crunch shell scrape short',
  gimlet_radula: 'air whoosh | shell rattle | shell scrape hard shell crunch short',
  gimlet_foot: 'water thud | water warble | water splash wide fur thud soft shell scrape short',
  gimlet_goin: 'shell scrape long air whoosh wide | shell whistle | shell crunch hard wide shell scrape long void swell fall',
  // Vobasa: the long rush of an albatross gliding over.
  albatross_wingspan: 'air whoosh long soft | air rustle | fur thud bone scrape short',
  albatross_soar: 'air swell soft | air whoosh long | fur thud air howl soft',
  albatross_shadow: 'void warble short | water warble | water splash air whoosh short',
  albatross_beach: 'air swell soft air whoosh long | air rustle | fur thud wide bone scrape short hard air whoosh',
  albatross_dive: 'air swell soft | air whistle fall | fur thud bone scrape short air whoosh short',
  // Alkume: a shell room that gulps as it fills.
  protoconch_jet: 'water rustle soft | water warble | water splash shell gulp x2',
  protoconch_room: 'shell chime soft | shell whistle | stone crack shell gulp',
  protoconch_pea: 'water gulp high | shell warble | shell gulp water ring soft',
  protoconch_coil: 'shell gulp low water swell | shell whistle | water splash hard shell gulp water ring long',
  // Small Gran: a small soft voice on E4 for each of her lines.
  smallgranw_today: 'fur warble e4 short | - | fur thud bone scrape short x3',
  smallgranw_scratch: 'fur rattle soft | - | fur chirp e4 star chime soft',
  smallgranw_feel: 'fur swell | - | fur chirp g4 fur thud soft bone ring',
  smallgranw_look: 'fur chirp e4 x2 | fur warble soft | fur thud soft star warble',
  smallgranw_there: 'fur warble c5 short air whoosh | - | fur thud wide bone scrape short hard fur chirp e4',
};
