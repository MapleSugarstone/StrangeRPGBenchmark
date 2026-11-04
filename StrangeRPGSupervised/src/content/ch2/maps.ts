import { MapData } from '../../engine/maps.js';

export const CH2_MAPS: Record<string, MapData> = {
  "silica_hollow_1": {
    width: 36,
    height: 25,
    rows: [
      "####################################", // 0
      "#...........###...########.........#", // 1
      "#.......P..........#######......####", // 2
      "#...................##P###.....#####", // 3
      "##....#...#.########.P###......#####", // 4
      "###.RRRRR..~~~~~..............######", // 5
      "###.HHHHH.~~~~~~~.P............#####", // 6
      "###.HHEHH#~~~................#.#####", // 7
      "###.....,#~~~................#######", // 8
      "##.....,####..#~####.............###", // 9
      "##.....,,#,,,,..................P###", // 10
      "##..,,,,,.,,,,.....................#", // 11
      "##.,,,#.,..#####.#...............###", // 12
      "##.,,,,,,#,......#................##", // 13
      "###,,.,,,#,......#......P.........##", // 14
      "###,P,,,P#.....#.....PP...~.......##", // 15
      "##...,#....#...#.#......~~~~~......#", // 16
      "#.....#..#.#..,#,#,.....~~########.#", // 17
      "#.....#..#...,,,,#,,....~~~~.......#", // 18
      "#.....#..#.#.,,#,##,.....~~........#", // 19
      "#.....#.P#.###,##############......#", // 20
      "#.....#P##.#..,#,,############.....#", // 21
      "#.....####.#...#..#############....#", // 22
      "#.....####.#.....##############....#", // 23
      "####################################", // 24
    ],
    warps: [
      { x: 6, y: 7, destMap: "silica_hollow_1_hut", destX: 11, destY: 15 },
      { x: 11, y: 1, destMap: "ashen_reach_3", destX: 16, destY: 29 },
      { x: 34, y: 11, destMap: "silica_hollow_2", destX: 2, destY: 12 },
    ],
    encounters: [
      { tiles: [","], species: ["silica_husk", "oxide_mite", "glass_wisp", "metal_scraper", "resonant_shard", "silica_spider"], levels: [5, 7], rate: 0.08 },
    ],
    npcs: [
      {
        x: 10,
        y: 18,
        dir: "right",
        gives: "silica_husk",
        givesLevel: 8,
        giftLine: "Does it remember the dark?",
        name: "Luma",
        sprite: "luma",
        lines: [
          "What does the shadow see that the light ignores?",
          "The stars are wrong. They are too close.",
          "You are a fragment. You remember the shape.",
        ],
        flag: "ch2_luma_joins",
      },
      {
        x: 15,
        y: 2,
        dir: "right",
        shop: true,
        name: "Surunme",
        sprite: "slag_glass",
        lines: [
          "Sound bounces off the glass.",
          "It hurts my teeth.",
          "The hollow is singing a bad song.",
        ],
      },
    ],
  },
  "silica_hollow_2": {
    width: 39,
    height: 24,
    rows: [
      "#######################################", // 0
      "#........#.#######.........#######.####", // 1
      "##..............#..........############", // 2
      "###..................####.#####~~######", // 3
      "###P.................###.###~~~~~.#####", // 4
      "###..............######################", // 5
      "###PP.......P......#......#..~.~...####", // 6
      "###..............P.#.~~~..#...........#", // 7
      "####P.P.........P..#.~~~..#.......#####", // 8
      "####............##.#########..........#", // 9
      "##.........#########.#######..........#", // 10
      "##...........,,,,,,,......#......P.####", // 11
      "#............,,,,,,#......#......P#####", // 12
      "##...........,,,,,,#......#.....P.#####", // 13
      "##........,,,.P,,,,#.P....#......P.####", // 14
      "#.........,,,P.PP,,#......#........####", // 15
      "#.........,,,,.,,,,#......#........####", // 16
      "#.........,,,,.,,,,#......##.......####", // 17
      "#..........,...,,,,#...,,,##........###", // 18
      "#.....###.....,,,,,....,,,,#....#####.#", // 19
      "#....####.....#,,,#.####,,,,..........#", // 20
      "#....#######.##.,########.,#..........#", // 21
      "#....#######.###.########..#..........#", // 22
      "#######################################", // 23
    ],
    warps: [
      { x: 1, y: 12, destMap: "silica_hollow_1", destX: 33, destY: 11 },
      { x: 12, y: 22, destMap: "silica_hollow_3", destX: 4, destY: 2 },
    ],
    encounters: [
      { tiles: [","], species: ["silica_husk", "oxide_mite", "glass_wisp", "metal_scraper", "magnetic_drifter", "glass_vine"], levels: [6, 8], rate: 0.08 },
    ],
    npcs: [
      {
        x: 16,
        y: 4,
        dir: "up",
        name: "Vrum",
        sprite: "slag_glass",
        lines: [
          "Your steps are loud.",
          "I hear your fear.",
        ],
        after: [
          "Listen to the glass.",
        ],
        battle: "void_glass",
        level: 10,
        isTrainer: true,
        flag: "trainer_silica_hollow_2_vrum",
      },
      {
        x: 35,
        y: 21,
        dir: "left",
        name: "Aritsun",
        sprite: "slag_glass",
        lines: [
          "Glass cuts. I feel it.",
          "You are loud. You vibrate the air.",
          "I am quiet. I am the crack.",
        ],
      },
      {
        x: 3,
        y: 21,
        dir: "up",
        name: "Smime",
        sprite: "slag_glass",
        lines: [
          "Light splits. It does not break.",
          "We are all just angles.",
          "The keeper wants to keep us whole. We are already broken.",
        ],
      },
    ],
  },
  "silica_hollow_3": {
    width: 36,
    height: 31,
    rows: [
      "####################################", // 0
      "#.............#########.S...~~.#####", // 1
      "##............########..S..~~~~#####", // 2
      "###....PP.###########...S.~~~~~~####", // 3
      "###.......P....####.....S.~~~~~~####", // 4
      "####............~.......S..~~P~~####", // 5
      "####...........~###.....S...~~~~####", // 6
      "####..........~~~~~.....S....~..####", // 7
      "####.........#~####..######.....####", // 8
      "###...........~~~~~.....#.......####", // 9
      "#.......#.......~~~.....#....P..####", // 10
      "#...,,..#......,~~...,..#....#######", // 11
      "#.,,,,,.#....,,,,,...P,,#.......####", // 12
      "#.,,,,,.#....,,,,##..####,#..#######", // 13
      "#.,,,,,.##...,,,,,,,.,,,S,......####", // 14
      "#..,,...##...,,,,,...######..##.####", // 15
      "#.......##...,,,,,,,,,,,#.......####", // 16
      "###.....#....,,,,,,,....##......####", // 17
      "####..P.##.....,,,,.....##.........#", // 18
      "####....##~~~...,.......#.......####", // 19
      "###.....##~P~...........##.....P####", // 20
      "####.....~~~~~..........##.....#####", // 21
      "###....P#~~~~...........##..########", // 22
      "#.......#..~............##....P.####", // 23
      "#.......#....,..........S#......####", // 24
      "#.......#..###......#######.....####", // 25
      "#...........,#.,,..###..P#......####", // 26
      "#...........###.,.#####.S#......####", // 27
      "#...........####..#####.S#......####", // 28
      "#...........####..#####.S.......####", // 29
      "####################################", // 30
    ],
    seal: { name: "Glass Chord", needs: "Metal", shut: "Metal sings. Oxide Mite hides. Dull it. Catch it.", open: "Metal rings true.", line: { axis: "x", at: 24, ahead: 1 } },
    warps: [
      { x: 4, y: 1, destMap: "silica_hollow_2", destX: 12, destY: 21 },
      { x: 34, y: 18, destMap: "mud_mound_1", destX: 2, destY: 16 },
    ],
    encounters: [
      { tiles: [","], species: ["silica_husk", "oxide_mite", "glass_wisp", "metal_scraper", "heat_moth", "void_glass"], levels: [7, 9], rate: 0.08 },
    ],
    npcs: [
      {
        x: 2,
        y: 27,
        dir: "up",
        name: "Govkami",
        sprite: "slag_glass",
        lines: [
          "Sound tells the way.",
          "Do not step wrong.",
        ],
        after: [
          "Your noise is gone.",
        ],
        battle: "resonant_shard",
        level: 10,
        isTrainer: true,
        flag: "trainer_silica_hollow_3_govkami",
      },
      {
        x: 11,
        y: 2,
        dir: "down",
        name: "Kaysudun",
        sprite: "slag_glass",
        lines: [
          "The mirrors lie.",
          "They show you what you want to see.",
          "I see the dust behind the glass.",
        ],
      },
      {
        x: 32,
        y: 18,
        dir: "left",
        level: 10,
        leaves: true,
        name: "Nyx",
        sprite: "slag_glass",
        lines: [
          "Beauty is a function of transparency.",
          "You are opaque. You are ugly.",
          "I will make you clear.",
        ],
        battle: "keeper_nyx",
      },
    ],
  },
};
