import { MapData } from '../../engine/maps.js';

export const CH4_MAPS: Record<string, MapData> = {
  "granite_vault_1": {
    width: 36,
    height: 27,
    rows: [
      "####################################", // 0
      "##..........####..##.##............#", // 1
      "###..........##.,,,..........,,....#", // 2
      "###............~~~~,........,,,,,..#", // 3
      "###....,,.....~~~~~.........,,,,,..#", // 4
      "###..,,,,,..P~~~~~~..........,,,...#", // 5
      "###..,,,,,..PP~~~~~...~~~~~~~.,....#", // 6
      "###P.,,,,,..~~~~~~~...~~~~~~~..~..##", // 7
      "####P#####..~~~~~~~...~~~~.....P.###", // 8
      "##......###########...~~......~~.###", // 9
      "#............~~~~~....~.......~..###", // 10
      "#........................~~~..~..###", // 11
      "#.......................~~P~......##", // 12
      "#......,,..............~~.~~.......#", // 13
      "#....,,,,,.............P.####....###", // 14
      "#....,~~,~~~..........P.RRRRR......#", // 15
      "#...~~~~~~~....~~P~~~.~.HHHHH......#", // 16
      "###.~~~~~~~....~~~~~~~~~HHEHHP.....#", // 17
      "####~~~~~~....~~~~~~~~~~~~.........#", // 18
      "###~~~~~.......~~~~~~~##########...#", // 19
      "####~~~~....~~P~~~~~~~~~~..........#", // 20
      "####~~~~~~~~~P.~~~~~~~~~~..........#", // 21
      "#####~~~~~~,~...~~~~~~~~######.....#", // 22
      "#####~#~~,~,....~~~~~~~~~.........##", // 23
      "#######,,,,#####.##~#~~###.........#", // 24
      "#######...################.........#", // 25
      "####################################", // 26
    ],
    warps: [
      { x: 26, y: 17, destMap: "granite_vault_1_hut", destX: 11, destY: 15 },
      { x: 34, y: 16, destMap: "mud_mound_3", destX: 2, destY: 25 },
      { x: 20, y: 1, destMap: "granite_vault_2", destX: 12, destY: 21 },
      { x: 1, y: 10, destMap: "granite_vault_2", destX: 26, destY: 4 },
    ],
    encounters: [
      { tiles: [","], species: ["granite_warden", "stone_golem", "rock_spitter", "earth_mover", "basalt_cyst", "quartz_witch"], levels: [11, 13], rate: 0.08 },
    ],
    npcs: [
      {
        x: 32,
        y: 13,
        dir: "right",
        shop: true,
        name: "Gragranit",
        sprite: "slag_miner",
        lines: [
          "The rock is hard.",
          "The pick is soft.",
          "The rock wins.",
        ],
      },
      {
        x: 3,
        y: 16,
        dir: "left",
        name: "Heroda",
        sprite: "slag_miner",
        lines: [
          "The door is closed.",
          "The key is broken.",
          "The stone remembers the lock.",
        ],
      },
    ],
  },
  "granite_vault_2": {
    width: 29,
    height: 24,
    rows: [
      "#############################", // 0
      "#..###################,,....#", // 1
      "##......#############,,,,####", // 2
      "##.......#P.,......,,,,,#####", // 3
      "##.......,,,,,....,,,,,,,...#", // 4
      "##.......,,,,,.....,,,,,....#", // 5
      "###........,,..............##", // 6
      "###......P...#....~........##", // 7
      "##......P....#...~~....~....#", // 8
      "##..........P#..~~~~...~....#", // 9
      "##...........#..~~~~~..~~...#", // 10
      "#............#,,~~~~~..~~...#", // 11
      "#...........,#,,~~~~~..~~...#", // 12
      "#..........,,#,,,,~~~..~~~..#", // 13
      "#...........,,,,,~~~~..~~~..#", // 14
      "#...........,,,,~~~...~~~~..#", // 15
      "#...#....P.....~~~~...####..#", // 16
      "#...#....P..........~~~~~...#", // 17
      "#...#...............~~#~....#", // 18
      "#.#.#............~~~~~#~....#", // 19
      "#####.............~~~.#.....#", // 20
      "######.....#.......#..#.....#", // 21
      "#######.####...##.###.......#", // 22
      "#############################", // 23
    ],
    warps: [
      { x: 12, y: 22, destMap: "granite_vault_1", destX: 20, destY: 2 },
      { x: 1, y: 12, destMap: "granite_vault_3", destX: 29, destY: 24 },
      { x: 27, y: 4, destMap: "granite_vault_1", destX: 2, destY: 10 },
    ],
    encounters: [
      { tiles: [","], species: ["granite_warden", "stone_golem", "rock_spitter", "earth_mover", "slag_biter", "vein_walker"], levels: [12, 14], rate: 0.08 },
    ],
    npcs: [
      {
        x: 6,
        y: 17,
        dir: "up",
        name: "Bunmet",
        sprite: "slag_miner",
        lines: [
          "Stone does not yield.",
          "Break your teeth.",
        ],
        after: [
          "You have weight.",
        ],
        battle: "stone_golem",
        level: 16,
        isTrainer: true,
        flag: "trainer_granite_vault_2_bunmet",
      },
      {
        x: 26,
        y: 7,
        dir: "up",
        name: "Pusteinn",
        sprite: "slag_miner",
        lines: [
          "Granite is old.",
          "It has seen the kiln pour.",
          "It has seen the cracks.",
        ],
      },
      {
        x: 2,
        y: 2,
        dir: "down",
        name: "Shegun",
        sprite: "slag_miner",
        lines: [
          "I build walls.",
          "I build towers.",
          "I build graves.",
        ],
      },
    ],
  },
  "granite_vault_3": {
    width: 32,
    height: 32,
    rows: [
      "################################", // 0
      "#######################.########", // 1
      "#######################.########", // 2
      "#######################.########", // 3
      "#..######,,,.............#.....#", // 4
      "####,,,,#,,,...P....P..........#", // 5
      "#####P,,#,,,..#####............#", // 6
      "#####,P,#,,~~~~~~.....#........#", // 7
      "#####,,,#~~~~~~~~.....#........#", // 8
      "####P...#P~~~~~~~~~............#", // 9
      "#####...#~P~~~~~~~~............#", // 10
      "#####SSS#~~~~~~~~~S~SSSSSSSSS###", // 11
      "####....#~~~~~~~~~~........#####", // 12
      "#.......#..........,........####", // 13
      "#.....,,...........,,,,.....####", // 14
      "#.....,,,,~~~.~~..,,,,,.....####", // 15
      "##...,,,,,.........,P,,.....####", // 16
      "##...,,,,,.........,P........###", // 17
      "##....,,.......................#", // 18
      "###..............~~~~~.........#", // 19
      "##..~.~.........~P~~~~~~~~~....#", // 20
      "#.~~~~~.........~~~~~~~~~~~....#", // 21
      "#.~~~~~........~P~P~~~~~~~~~...#", // 22
      "#.~~~~P..~~....~~P~~~~~~~~~~...#", // 23
      "#~~~~~~..~~~.....~~~~~~~~~~....#", // 24
      "#~~~~~~~P~~....................#", // 25
      "#.~~~~~~~P~....................#", // 26
      "#..~~~~~~~.......#..~~~~~~.....#", // 27
      "#..~.~~~.P.......#.............#", // 28
      "#................######........#", // 29
      "#...######......########.......#", // 30
      "################################", // 31
    ],
    seal: { name: "Cool Block", needs: "Aether", shut: "Aether chills. Quartz Witch sleeps. Shatter it. Hold it.", open: "Aether hums cold.", line: { axis: "y", at: 11, ahead: -1 } },
    warps: [
      { x: 30, y: 24, destMap: "granite_vault_2", destX: 2, destY: 12 },
      { x: 23, y: 1, destMap: "schist_spire_1", destX: 23, destY: 28 },
    ],
    encounters: [
      { tiles: [","], species: ["granite_warden", "stone_golem", "rock_spitter", "earth_mover", "ember_core", "shard_hollow"], levels: [13, 15], rate: 0.08 },
    ],
    npcs: [
      {
        x: 2,
        y: 29,
        dir: "up",
        name: "Baul",
        sprite: "slag_miner",
        lines: [
          "The vault is sealed.",
          "Turn back.",
        ],
        after: [
          "The rock sleeps.",
        ],
        battle: "granite_warden",
        level: 16,
        isTrainer: true,
        flag: "trainer_granite_vault_3_baul",
      },
      {
        x: 29,
        y: 29,
        dir: "up",
        name: "Grom",
        sprite: "slag_miner",
        lines: [
          "The seal is strong.",
          "The stone is permanent.",
          "You are temporary.",
        ],
      },
      {
        x: 23,
        y: 3,
        dir: "down",
        level: 21,
        leaves: true,
        name: "Grom",
        sprite: "slag_miner",
        lines: [
          "Stone does not lie.",
          "Stone breaks.",
          "You are a crack in the stone.",
        ],
        battle: "keeper_grom",
        team: ["granite_warden"],
        flag: "ch4_grom_defeated",
      },
    ],
  },
};
