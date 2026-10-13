// Each move's sound for kits6.ts as a one-line spec, keyed by move id. Notes/move-sounds.md has the words and how to write one.
import type { SoundEntry } from '../game/soundspec';

export const SOUNDS6: Record<string, SoundEntry> = {
  // The Gleaner opens every move with its listening hum and the far whistle.
  gleaner_listen: 'gleaner | void warble soft | void thud void warble air whistle soft',
  gleaner_label: 'gleaner short | shell rattle soft | void thud hard shell snap air rustle short',
  gleaner_setdown: 'gleaner | water warble | water splash hard void thud low water drip',
  gleaner_hold: 'gleaner long void swell | void warble air whistle soft | void thud hard void swell fall long air howl soft',
  // Konleva: a wet kelp blade that snaps as it slaps.
  laminaria_frond: 'water rustle soft | water rustle | root snap water splash short',
  laminaria_sway: 'water rustle | water whoosh soft | water splash root snap soft',
  laminaria_shed: 'root rattle | water warble | water gulp root snap soft water drip',
  laminaria_ebbblade: 'water rustle long air whoosh | water whoosh | root snap hard wide water splash root creak',
  // Nikusa: a meadow that rustles, and dream dust that warbles.
  eelgrass_comb: 'air rustle soft | root rustle | air pop wide root rustle short',
  eelgrass_sway: 'air rustle soft | water rustle | root pluck root rustle long',
  eelgrass_mend: 'root chime soft | water warble | water splash root rustle short',
  eelgrass_farreach: 'root rustle long star warble soft | root rustle soft | root knock wide star warble long root rustle',
  // Syvakai: a deep fish that drums low.
  grenadier_bite: 'void hum low air whoosh | air whistle | bone crunch fur thud low',
  grenadier_rake: 'void hum low soft | bone rattle | fur thud bone scrape short x3 void hum low',
  grenadier_lure: 'void swell fall soft | water warble | water splash fur thud low',
  grenadier_drop: 'void swell fall long fur thud low x2 | void hum | stone thud wide fur thud low x2 void rumble',
  // Tahtode: star arms that crackle as they burn in.
  asterias_barrage: 'star chime soft | star whistle | star chime star crackle short',
  asterias_five: 'star chime soft x2 | star whistle | star chime wide star crackle',
  asterias_homing: 'star swell soft | star whistle fall | stone crack star chime star crackle short',
  asterias_skydrop: 'star swell rise | star whistle fall | star chime hard star shatter star crackle long',
  // Lonshu: suckers that pop as they let go.
  cirrus_slap: 'air whoosh | - | fur thud water pop high',
  cirrus_cling: 'fur knock soft | - | water pop fur thud soft water ring',
  cirrus_reach: 'air whoosh | water rustle long | water pop high bone scrape short x2',
  cirrus_wrap: 'water rustle long air whoosh wide | water rustle | fur thud hard water pop high x3 fur growl short',
  // Puhalki: a jet of water that hisses.
  hyponome_squirt: 'water chime soft | water hiss short | water splash water hiss short',
  hyponome_pushoff: 'water hiss air whoosh | water warble | water splash gear crack',
  hyponome_exhale: 'water swell | - | water gulp water hiss long',
  hyponome_jet: 'water swell water hiss rise | water whoosh | water splash hard wide water hiss long shell crack',
  // Tynagi: a clock that ticks twice in the still minute.
  slackwater_lap: 'gear snap soft x2 | water warble | water splash water hum soft',
  slackwater_slacken: 'void swell fall soft | water hum low | void thud gear snap soft x2',
  slackwater_hold: 'void warble short | - | water gulp gear snap soft x2 glass ring soft',
  slackwater_minute: 'water swell long gear snap soft x2 | water hum | glass chime low water hum long',
  slackwater_flood: 'water swell rise gear snap soft x2 | water warble rise | water splash hard water hiss short',
  // Soryubi: ice that creaks as it freezes down.
  brinicle_drip: 'ice chime soft | water warble | salt crack ice creak short',
  brinicle_spray: 'ice rustle soft | salt fizz | salt crack wide ice creak',
  brinicle_line: 'ice thud | ice whistle | stone thud ice creak long',
  brinicle_floor: 'ice creak long salt swell | salt fizz | ice shatter hard ice creak long salt crack',
  // Yliri: a star note on A5 that always plays twice.
  transit_cross: 'star chime soft | star warble | star pluck a5 x2 star chime soft',
  transit_late: 'air rustle soft | star warble | star pluck a5 x2 star ring soft',
  transit_eclipse: 'star swell soft | void whistle | stone knock star pluck a5 x2',
  transit_double: 'star swell star pluck a5 x2 | star warble | star chime star ring long star pluck a5 x2',
  // Paimori: stones that land low and heavy.
  ballast_drop: 'stone swell soft | stone whistle low | stone thud low hard stone crack',
  ballast_storm: 'stone thud | - | stone thud low gear ring soft',
  ballast_room: 'stone swell soft | stone whistle low fall | stone thud low stone crack short',
  ballast_hold: 'stone thud low gear swell | stone whistle low | stone thud low hard wide gear crack stone rumble',
  // Monti: a gate that creaks as it slides.
  sluice_slap: 'gear creak short | gear rattle | gear knock gear zap short',
  sluice_backflow: 'void swell fall soft | water whoosh | void thud gear creak long',
  sluice_bolt: 'gear creak rise | gear rattle short | gear knock water whoosh short',
  sluice_swap: 'gear creak long void warble short | gear warble | gear knock hard gear creak long void swell fall',
  // Mukabe: a wall that knocks hollow.
  septum_slam: 'air whoosh | - | stone knock hard stone crack',
  septum_knock: 'stone thud | - | stone knock x2 shell ring soft',
  septum_seal: 'air whoosh | gear rattle | stone knock stone crack shell ring short',
  septum_shot: 'stone rumble short air whoosh | stone whistle low | stone shatter hard stone crack stone knock',
  // Hafusen: a sealed jar of old air that pops.
  vacuole_old: 'glass chime soft | void hum | glass pop air hiss long',
  vacuole_vacuum: 'glass chime soft | star warble | glass pop high air hiss short',
  vacuole_shell: 'void swell | glass warble | glass pop soft glass ring long',
  vacuole_wall: 'void swell air hiss long | glass warble | void thud hard glass pop low void swell fall',
  // Kuorisho: rings of salt that ring as they dry.
  evaporite_flake: 'salt chime soft | salt fizz | salt shatter salt ring short',
  evaporite_ring: 'salt thud | salt fizz | salt shatter wide salt ring',
  evaporite_draw: 'salt swell fall soft | salt fizz | salt crack salt ring rise',
  evaporite_room: 'salt swell salt ring long | salt fizz | salt shatter hard salt ring long salt crackle',
  // Hupfuta: a door that thuds shut on its latch.
  hood_knock: 'air whoosh | - | stone thud gear snap stone crack short',
  hood_purify: 'stone swell | - | star chime gear snap soft',
  hood_holdshut: 'air whoosh | gear rattle | stone thud hard gear snap stone crack',
  hood_shutdoor: 'stone thud gear swell | shell whistle | stone thud hard gear snap stone ring long',
  // Ashiaki: a soft giant step, and a high star landing in it.
  spoor_footfall: 'void thud | void hum | void thud low star chime high soft',
  spoor_toes: 'void thud | water warble | water splash star chime high soft',
  spoor_guard: 'void thud | - | void thud low star chime high x2',
  spoor_walkback: 'void thud low x3 | void hum | void thud hard wide stone rumble star chime high',
  // Tulisei: a star that hisses as it burns.
  bolide_flick: 'ember chime soft | ember crackle | star chime wide ember hiss short',
  bolide_streak: 'ember swell soft | star whistle | stone crack wide ember hiss',
  bolide_ring: 'ember swell | ember crackle | star chime ember hiss long',
  bolide_whiteline: 'ember swell rise star whistle fall | star whistle | star chime hard ember hiss long stone thud',
  // Heinaba: stiff dune grass that plucks low.
  marram_sprout: 'sand rustle soft | root rustle | root pluck low sand hiss short',
  marram_runner: 'root swell fall soft | sand rustle | root pluck low air pop soft',
  marram_walkoff: 'air whoosh | sand whistle low | stone crack root pluck low',
  marram_rootrun: 'root swell fall soft sand hiss | root whistle | stone crack wide root pluck low sand hiss long',
  // Ruojiki: crisp salt that crunches.
  saltwort_spit: 'salt pop soft | salt fizz | salt crunch salt crack short',
  saltwort_mist: 'salt rustle soft | salt fizz | salt crunch wide salt crackle short',
  saltwort_cure: 'root rustle soft | root rustle | salt crack wide salt crunch hard',
  saltwort_pressed: 'salt swell fall soft | salt fizz | salt crunch salt crackle long',
  // Shidor: a high thin glare tone.
  albedo_glint: 'glass hum high soft | star warble | salt chime glass ring short',
  albedo_field: 'glass hum high | - | salt chime high glass ring soft',
  albedo_link: 'glass hum high soft | glass hum wide | salt pop glass ring long',
  albedo_flare: 'glass hum high salt swell | salt fizz | salt chime hard glass shatter soft glass ring long',
  // Ikapia: a shifting shell warble as its colors change.
  cuttle_jab: 'shell warble soft | water warble | water splash shell knock high',
  cuttle_clap: 'air whoosh | bone rattle | bone crunch shell warble short',
  cuttle_brew: 'water swell | water warble high | water gulp shell warble long',
  cuttle_three: 'shell warble long void warble short | water warble | star chime water splash shell warble',
  // Kutelo: a jelly whose ripples ring.
  medusa_sting: 'air whoosh | water warble | water gulp water ring short',
  medusa_pulse: 'water swell | - | water gulp soft water ring long',
  medusa_bell: 'air whoosh | water warble | bone crunch water ring short',
  medusa_bigripple: 'water swell water ring long | water warble | water splash hard wide water ring long water gulp low',
  // Pakui: a post that knocks low like a metal bollard.
  bollard_post: 'gear knock low soft | stone whistle low | stone crack gear knock low',
  bollard_shove: 'stone thud | gear rattle | gear knock low wide gear crack short',
  bollard_drive: 'stone swell fall soft | - | stone thud low gear knock low',
  bollard_four: 'stone swell soft | stone whistle low fall | stone thud wide gear knock low x2 stone crack',
  bollard_gatling: 'stone rattle | stone whistle low | gear knock low stone crack short',
  // Tifuda: a ticket stamp that knocks high, and paper.
  docket_tap: 'gear knock high soft | air rustle | gear knock high air rustle short',
  docket_plant: 'gear swell fall soft | air rustle soft | gear knock high root knock soft',
  docket_hold: 'gear swell | air rustle | gear knock high gear ring soft',
  docket_blast: 'gear knock high x3 | air rustle | gear knock high hard wide gear crack air rustle',
  // Tyhaki: an empty slot that knocks hollow and low.
  vacancy_tap: 'void knock low soft | void hum | void knock low void swell fall short',
  vacancy_slip: 'void warble short | water warble | water splash void knock low',
  vacancy_emptyout: 'void swell fall soft | - | void knock low x2 void hum short',
  vacancy_square: 'void swell fall soft void hum | void hum | void knock low x3 void swell fall long',
  // Hyrkoma: a spinning top's hum.
  trochus_spin: 'shell hum rise | shell hum | stone crack shell hum short',
  trochus_under: 'shell hum | - | stone thud shell hum long',
  trochus_grit: 'shell hum | sand hiss | sand crunch wide shell hum short',
  trochus_spinout: 'shell hum rise long | shell hum | stone crack hard stone thud shell hum long',
  // Kidedan: crystal notes that step down inward.
  hopper_face: 'salt chime fall soft | salt fizz | salt shatter salt chime fall short',
  hopper_stair: 'salt swell fall soft | salt whistle | stone crack salt chime fall',
  hopper_crust: 'salt swell | salt fizz | salt crack salt chime fall long',
  hopper_core: 'salt chime fall x3 salt swell | salt fizz | salt shatter hard wide salt chime fall ice crackle',
  // Sivuko: a crab claw that snaps.
  crabwise_nip: 'air whoosh | - | shell snap salt crack short shell scrape short',
  crabwise_flick: 'shell rattle | salt fizz | salt crack shell snap soft salt crackle',
  crabwise_side: 'shell rattle short | - | stone thud shell snap shell scrape short x2',
  crabwise_between: 'shell rattle long air whoosh | salt fizz | shell snap hard salt crack shell scrape short x3',
  // Picagi: a magpie's harsh double chatter, and gold.
  magpie_snatch: 'bone chirp x2 soft | air rustle | fur thud bone scrape short glass chime high',
  magpie_pecks: 'air whoosh | star warble | bone crunch bone chirp short',
  magpie_hoard: 'bone chirp x2 | air rustle | fur thud soft glass chime high',
  magpie_back: 'bone chirp x3 air swell | air rustle | fur thud wide bone scrape short hard glass chime high',
  // Kakulo: a hole that swallows low.
  cache_poke: 'void chime soft | sand hiss | sand thud soft void gulp low',
  cache_fallin: 'void swell fall soft | water warble | water gulp void gulp low long',
  cache_hole: 'void swell fall | - | void gulp low hard sand hiss long',
  cache_keepsit: 'void swell void gulp low | sand hiss | sand crack wide void gulp low hard void swell fall',
  // Masilma: a steady low tone from an eye that never blinks.
  strombus_jab: 'fur hum low soft | fur whistle | bone knock hard fur hum low short',
  strombus_look: 'fur hum low | water warble | water gulp water drip fur hum low short',
  strombus_stare: 'fur swell | - | bone knock soft fur hum low long',
  strombus_cull: 'fur hum low long | bone rattle | bone crunch hard bone scrape short x3',
  // Sirdori: the soft high pips of a shore bird.
  sanderling_pin: 'fur chirp high x2 | - | fur thud wide bone scrape short',
  sanderling_longshot: 'water rustle soft | - | fur chirp high soft water hiss short',
  sanderling_run: 'fur chirp high | star warble | star chime bone scrape short',
  sanderling_wave: 'water rustle long fur chirp high x3 | air rustle | fur thud water hiss long fur chirp high',
  // Manva: water that comes in and gurgles.
  flood_rise: 'water swell soft | water warble | water splash water gurgle short',
  flood_spill: 'water rustle soft | water whoosh | water splash water gurgle',
  flood_stay: 'water whoosh wide | water warble | void thud water gurgle long',
  flood_spring: 'water swell water rumble | water warble | water splash hard wide water gurgle long water swell fall',
  // Kohisai: the sea's rush, heard running backward.
  surf_hiss: 'water rustle soft | water whoosh rise | water gulp water hiss short',
  surf_crash: 'water swell | water warble | water splash soft water whoosh rise',
  surf_rush: 'water swell | water whoosh rise | fur thud water whoosh fall',
  surf_seasound: 'water rumble water whoosh rise | water warble | water gulp wide water whoosh fall long water splash',
  // Kukhana: salt that crazes as it dries.
  fleur_spray: 'salt chime soft | salt fizz | salt shatter glass crackle short',
  fleur_bloom: 'root rustle soft | root rustle soft | salt shatter wide glass crackle',
  fleur_crack: 'salt thud | salt whistle | stone crack glass crackle long',
  fleur_flower: 'salt swell root rustle | salt whistle | salt shatter hard glass crackle long ice crackle',
  // Kosango: coral knuckles that knock.
  madrepore_rap: 'shell rustle soft | - | star chime shell knock soft',
  madrepore_close: 'air whoosh | shell rattle | shell knock hard stone crack',
  madrepore_palm: 'shell swell | - | shell knock soft star chime long',
  madrepore_hand: 'shell swell shell knock x2 | shell whistle | shell knock hard wide star chime long stone crack',
  // Shinmi: pearls that clack high as they roll.
  blush_roll: 'shell rattle soft | shell warble | glass knock high star chime soft',
  blush_hum: 'shell rattle | shell warble low | glass knock high wide stone crack',
  blush_give: 'shell rattle short | shell warble | glass knock high salt shatter',
  blush_home: 'shell rattle long glass knock high x2 | shell warble | glass knock high hard wide stone crack star chime',
  // Korvami: a hollow ring that grows louder.
  cochlea_hum: 'void swell | void warble | void thud wide void ring',
  cochlea_ear: 'void rustle soft | water warble | water gulp void ring soft',
  cochlea_bind: 'void swell | void warble | void thud void ring long',
  cochlea_louder: 'void swell rise void ring | void warble | void crack hard void ring long void swell fall',
  // Suomono: brine that fizzes.
  samphire_mend: 'root rustle soft | root rustle | star chime soft water fizz',
  samphire_pod: 'root swell soft | water warble | water splash water fizz short',
  samphire_curse: 'root rustle soft | salt fizz | glass knock soft water fizz long',
  samphire_stake: 'root thud | salt fizz | root knock hard water fizz long salt crack',
  // Tenbinka: a brass ring that rings level.
  gimbal_tip: 'gear rattle soft | gear warble | gear knock stone crack gear ring short',
  gimbal_inner: 'root rustle soft | root rustle | root knock water drip gear ring soft',
  gimbal_outer: 'gear rattle wide | gear warble | gear knock gear ring long',
  gimbal_level: 'gear swell gear ring long | gear warble | gear knock hard gear ring long glass chime',
  // Hilzuka: a soft hush under everything.
  lull_bolt: 'void warble short | air hiss soft | void thud soft air hiss soft long',
  lull_note: 'void swell soft | water warble low | water gulp air hiss soft',
  lull_seal: 'void warble short | void hum soft | void thud air hiss soft x2',
  lull_long: 'void swell fall soft air hiss soft long | void warble soft | void thud soft wide air hiss soft long void swell fall',
  // Laibiru: a conch lip that sounds on D4.
  flange_ring: 'air whoosh | shell whistle | shell crunch shell pipe d4 short',
  flange_flare: 'shell pipe d4 soft | shell whistle | stone crack wide shell crunch short',
  flange_call: 'shell swell | water whoosh | star chime soft shell pipe d4 long',
  flange_wide: 'shell pipe d4 x3 air whoosh | shell whistle | shell crunch hard gear crack shell pipe d4 long',
  // Sisarmai: three sister notes on E6.
  pleiad_twinkle: 'void warble short | star warble | star chime e6 x3 soft',
  pleiad_cluster: 'star swell | stone whistle low | stone crack star chime e6 x3',
  pleiad_call: 'star swell | star warble | star chime e6 x3 star ring soft',
  pleiad_seven: 'star swell rise star chime e6 x3 | star whistle fall | star chime hard wide star shatter star ring long',
  // Pakaeri: a star whistling higher as it comes back.
  aphelion_spear: 'star chime soft | star whistle rise | star crack ember crackle short',
  aphelion_farout: 'star swell soft | star whistle low | stone crack star chime short',
  aphelion_swing: 'air whoosh wide | star whistle rise | star chime wide star warble short',
  aphelion_back: 'star whistle rise long air whoosh | star whistle rise | star crack hard ember crackle long star chime',
  // Astrolabe: a brass ping on G5 for every reading.
  astrolabe_sight: 'gear rattle soft | gear hum wide | gear chime g5 x2',
  astrolabe_ring: 'gear rattle wide | gear warble | gear knock wide gear chime g5',
  astrolabe_shower: 'gear swell soft | star warble | star chime gear chime g5 short',
  astrolabe_last: 'gear swell gear chime g5 x3 | gear hum | gear chime g5 hard gear knock hard glass ring long',
  // Pallasite: a cold crystal that pings high.
  pallasite_glint: 'void warble short | ice whistle | ice chime high ice crackle short',
  pallasite_sparks: 'ice chime high soft | ember crackle | gear knock ice chime high shell snap',
  pallasite_dive: 'star swell fall soft | shell whistle | shell knock soft ice chime high long',
  pallasite_nova: 'star swell ice chime high | ice whistle | ice shatter hard wide ice chime high star chime',
  // Rusumo: a high pink bloop of water.
  halophile_bloom: 'root swell | root rustle soft | root pluck water gulp high',
  halophile_draw: 'salt rustle soft | salt fizz | salt crack water gulp high short',
  halophile_stain: 'water swell fall soft | water warble | salt crack water gulp high water drip',
  halophile_pink: 'water swell fall long water gulp high | water warble | water splash hard water gulp high long salt crackle',
  // Petami: an old low waver that takes.
  heirloom_dust: 'sand rustle soft | sand hiss | void thud void warble low',
  heirloom_faded: 'air rustle soft | air rustle | water gulp void warble low',
  heirloom_nobody: 'void warble short | void hum | void thud void warble low long',
  heirloom_take: 'void swell void warble low | void hum | void thud hard void warble low long void swell fall',
  // Opaski: a fixed star that tolls on E5.
  lodestar_bearing: 'star rustle soft | star warble | star toll e5 star chime soft',
  lodestar_fix: 'star swell soft | star warble | star toll e5 short star chime',
  lodestar_steer: 'star whoosh wide | gear crackle | gear knock star toll e5',
  lodestar_course: 'star swell star toll e5 long | star warble | star chime hard star toll e5 long glass ring',
  // Kotigai: struck stone that tolls low.
  ammonite_knock: 'air whoosh wide | shell whistle | stone thud wide stone toll low',
  ammonite_ridge: 'stone rattle | shell whistle | stone crack stone toll low short',
  ammonite_septa: 'stone swell | shell warble | stone toll low star chime soft',
  ammonite_all: 'stone thud stone toll low x2 | shell whistle | stone toll low hard stone thud hard stone crack',
};
