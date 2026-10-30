// === Main Game - Spore-Weaver ===
// A tile-based JRPG where a beetle girl and her mushroom girlfriend
// journey through a world of magic, machinery, and cosmic wonder.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const W = 400, H = 400;
const TILE = 16;

// The game draws in 400x400 units and scales them to about 90% of the window.
// The scale snaps to eighths so tile edges land on whole device pixels.
let viewScale = 1;
let fittedTo = '';
function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  fittedTo = window.innerWidth + 'x' + window.innerHeight + '@' + dpr;
  // A frame that has not been laid out yet reports 0, so it gets the original 400 px size.
  const side = Math.min(window.innerWidth, window.innerHeight) * 0.9 || W;
  viewScale = Math.max(0.5, Math.floor(side * dpr / W * 8) / 8);
  canvas.width = Math.round(W * viewScale);
  canvas.height = Math.round(H * viewScale);
  canvas.style.width = canvas.width / dpr + 'px';
  canvas.style.height = canvas.height / dpr + 'px';
}
fitCanvas();

// === GAME STATE ===
let gameState = 'title';
let currentChapter = 1;
let storyIndex = 0;
let inventory = [];
let gold = 0;
let sporeLevel = 1;
let visitedDungeons = new Set();
let flags = {};
let quests = [];
let gameTime = 0;
let particles = [];
let screenShake = 0;
let messageTimer = 0;
let combatPhase = 'player'; // 'player' or 'enemy'
let combatPhaseTimer = 0;
let animFrame = 0;
let act2Started = false;
let secretLine = null;
let secretTimer = null;
let exploreInventory = false;
let inventoryIndex = 0;
let checkpoint = null;
let solvedPuzzles = new Set();
let puzzleDungeon = null;
let puzzleCursor = { x: 0, y: 0 };

// Combat state
let combatState = null;
let combatTimer = null;
let instantCombat = false;

// World map
const MAP_W = 40, MAP_H = 40;
let map = [];
let playerX = 20, playerY = 20;

// Quest system
function addQuest(id, name, desc, target, reward) {
  if (!quests.find(q => q.id === id)) {
    quests.push({ id, name, desc, target, reward, completed: false });
  }
}

function completeQuest(id) {
  const quest = quests.find(q => q.id === id);
  if (quest && !quest.completed) {
    quest.completed = true;
    if (quest.reward) {
      if (quest.reward.type === 'item') {
        addItem(quest.reward.item, quest.reward.type, quest.reward.power || 0);
      } else if (quest.reward.type === 'gold') {
        gold += quest.reward.power;
      } else if (quest.reward.type === 'spore') {
        sporeLevel++;
      }
    }
  }
}

// === WORLD MAP ===
function generateMap() {
  const cx = MAP_W / 2, cy = MAP_H / 2;
  map = [];
  for (let y = 0; y < MAP_H; y++) {
    map[y] = [];
    for (let x = 0; x < MAP_W; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const noise = Math.sin(x * 0.3) * Math.cos(y * 0.3) * 3;
      const d = dist + noise;
      let type = 'grass';
      if (d < 4) type = 'crystal';
      else if (d < 8) type = 'forest';
      else if (d < 13) type = 'ruin';
      else if (d < 18) type = 'desert';
      else if (d < 25) type = 'metal';
      else type = 'void';

      // Water patches
      if (x < 5 && y > 30) type = 'water';
      if (x > 34 && y < 6) type = 'lava';
      if (x < 4 && y < 4) type = 'water';
      if (x > 34 && y > 35) type = 'lava';
      // Desert oasis
      if (x > 20 && x < 26 && y > 10 && y < 14 && Math.random() < 0.3) type = 'water';

      // Hidden murals/graffiti
      let secret = null;
      if (x === 12 && y === 12) secret = 'mural';
      if (x === 25 && y === 5) secret = 'graffiti';
      if (x === 8 && y === 32) secret = 'carving';
      if (x === 32 && y === 28) secret = 'statue';

      map[y][x] = { type, secret };
    }
  }
}

function generateAct2Map() {
  const cx = MAP_W / 2, cy = MAP_H / 2;
  map = [];
  for (let y = 0; y < MAP_H; y++) {
    map[y] = [];
    for (let x = 0; x < MAP_W; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const noise = Math.sin(x * 0.2 + 1) * Math.cos(y * 0.25 + 2) * 4;
      const d = dist + noise;
      let type = 'mushroom';
      if (d < 3) type = 'void';
      else if (d < 7) type = 'mushroom';
      else if (d < 12) type = 'hollow';
      else if (d < 18) type = 'crystal';
      else if (d < 25) type = 'mushroom';
      else type = 'void';

      // Act 2 secrets
      let secret = null;
      if (x === 5 && y === 5) secret = 'mural'; // Revisit old secret
      if (x === 20 && y === 20) secret = 'graffiti'; // Same graffiti
      if (x === 10 && y === 30) secret = 'carving';
      if (x === 30 && y === 10) secret = 'statue';

      map[y][x] = { type, secret };
    }
  }
}
const dungeons = [
  { x: 8, y: 8, name: 'Crystal Cave', chapter: 1, boss: 'Crystal Guardian', bossHp: 150, bossAtk: 12, bossDef: 3, reward: 'Crystal Spore', sprite: 'crystal' },
  { x: 15, y: 10, name: 'Rusting Menagerie', chapter: 1, boss: 'Clockwork Dragon', bossHp: 300, bossAtk: 15, bossDef: 5, reward: 'Spore Crown', sprite: 'dragon' },
  { x: 30, y: 8, name: 'Rogue Terminal', chapter: 2, boss: 'Sentient AI', bossHp: 800, bossAtk: 23, bossDef: 6, reward: 'Data Shard', sprite: 'robot' },
  { x: 5, y: 30, name: 'Shadow Depths', chapter: 3, boss: 'Void Stalker', bossHp: 1300, bossAtk: 28, bossDef: 7, reward: 'Void Spore', sprite: 'void' },
  { x: 35, y: 35, name: 'The Heart Engine', chapter: 4, boss: 'World Core', bossHp: 1900, bossAtk: 32, bossDef: 8, reward: 'Eternal Bloom', sprite: 'void' },
];

function activeDungeons() {
  return act2Started ? act2Dungeons : dungeons;
}

function dungeonOpen(d) {
  return currentChapter >= d.chapter && !visitedDungeons.has(d.name);
}

// === SPRITES ===
// Eerie, stylized 8x8 sprites with dithering patterns
const spriteData = {};

function ditherLine(x1, y1, x2, y2, c, d, pattern) {
  // Simple dithering helper for terrain
  const dx = x2 - x1, dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const x = Math.floor(x1 + dx * t);
    const y = Math.floor(y1 + dy * t);
    if ((x + y) % 2 === 0) d[y * 8 + x] = c;
    else if (pattern === 'checker') d[y * 8 + x] = ditherDarken(c);
  }
}

function ditherDarken(hex) {
  // Darken a hex color by ~30%
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return '#' + Math.floor(r * 0.7).toString(16).padStart(2, '0') +
         Math.floor(g * 0.7).toString(16).padStart(2, '0') +
         Math.floor(b * 0.7).toString(16).padStart(2, '0');
}

function createSprite(key, data) {
  spriteData[key] = typeof data === 'function' ? data() : data;
}

// Builds a sprite from 8 rows of 8 characters; '.' stays empty.
function spriteFromRows(rows, colors) {
  const d = new Array(64).fill('#0a0a14');
  rows.forEach((row, y) => {
    for (let x = 0; x < 8; x++) if (colors[row[x]]) d[y * 8 + x] = colors[row[x]];
  });
  return d;
}

// Beetle girl - Buphila
createSprite('beetle', () => {
  const d = new Array(64).fill('#0a0a14');
  const f = (x, y, c) => { if (x >= 0 && x < 8 && y >= 0 && y < 8) d[y * 8 + x] = c; };
  // Shell with dither pattern
  for (let x = 2; x <= 5; x++) {
    for (let y = 4; y <= 5; y++) {
      f(x, y, (x + y) % 2 === 0 ? '#2d4a3e' : '#1a3328');
    }
  }
  f(1, 5, '#2d4a3e'); f(6, 5, '#2d4a3e');
  f(1, 6, '#2d4a3e'); f(2, 6, ditherDarken('#2d4a3e'));
  // Shell marking
  f(3, 4, '#e8c547'); f(4, 5, '#e8c547');
  f(3, 5, '#0a0a14'); f(4, 4, '#0a0a14');
  // Head
  for (let x = 2; x <= 5; x++) {
    for (let y = 1; y <= 3; y++) {
      f(x, y, '#2d4a3e');
    }
  }
  // Eyes - glowing
  f(3, 2, '#e8c547'); f(4, 2, '#e8c547');
  f(3, 1, ditherDarken('#e8c547')); f(4, 1, ditherDarken('#e8c547'));
  // Antennae
  f(2, 0, '#e8c547'); f(1, 0, '#e8c547');
  f(5, 0, '#e8c547'); f(6, 0, '#e8c547');
  // Legs
  f(0, 6, '#2d4a3e'); f(7, 6, '#2d4a3e');
  f(0, 7, '#1a3328'); f(7, 7, '#1a3328');
  return d;
});

// Mushroom girlfriend - Myco
createSprite('myco', () => {
  const d = new Array(64).fill('#0a0a14');
  const f = (x, y, c) => { if (x >= 0 && x < 8 && y >= 0 && y < 8) d[y * 8 + x] = c; };
  // Cap - purple with dots
  for (let y = 0; y <= 2; y++) {
    for (let x = 2; x <= 5; x++) {
      f(x, y, '#6b2d8b');
    }
  }
  f(1, 1, '#6b2d8b'); f(6, 1, '#6b2d8b');
  f(2, 0, '#9b59b6'); f(5, 0, '#9b59b6');
  // Cap spots (dithered)
  f(3, 0, '#d0a0e0'); f(4, 1, '#d0a0e0');
  // Stem
  for (let y = 3; y <= 5; y++) {
    f(3, y, '#c8b8d8');
    f(4, y, '#c8b8d8');
  }
  // Stem stripes (dither)
  f(3, 4, ditherDarken('#c8b8d8'));
  f(4, 5, ditherDarken('#c8b8d8'));
  // Eyes - sad but warm
  f(3, 2, '#0a0a14'); f(5, 2, '#0a0a14');
  f(3, 1, '#e8c547'); f(5, 1, '#e8c547');
  // Feet
  f(2, 6, '#c8b8d8'); f(6, 6, '#c8b8d8');
  // Spores floating around
  f(1, 3, '#9b59b6'); f(6, 4, '#9b59b6'); f(0, 5, '#d0a0e0');
  return d;
});

// Clockwork fox - Cogsworth
createSprite('fox', () => {
  const d = new Array(64).fill('#0a0a14');
  const f = (x, y, c) => { if (x >= 0 && x < 8 && y >= 0 && y < 8) d[y * 8 + x] = c; };
  // Body - brass
  for (let x = 2; x <= 5; x++) {
    for (let y = 3; y <= 5; y++) {
      f(x, y, (x + y) % 2 === 0 ? '#8b6914' : '#6b4f0e');
    }
  }
  // Gear chest piece
  f(3, 4, '#e8c547'); f(4, 4, '#e8c547');
  f(3, 5, ditherDarken('#e8c547')); f(4, 5, ditherDarken('#e8c547'));
  f(3, 3, ditherDarken('#6b4f0e'));
  // Head
  for (let x = 2; x <= 5; x++) {
    for (let y = 1; y <= 3; y++) {
      f(x, y, '#8b6914');
    }
  }
  // Snout
  f(3, 2, '#e8c547'); f(4, 2, '#e8c547');
  f(3, 3, '#e8c547'); f(4, 3, '#e8c547');
  // Eyes - glowing blue
  f(3, 1, '#3498db'); f(4, 1, '#3498db');
  f(3, 0, '#5dade2'); f(4, 0, '#5dade2');
  // Ears
  f(2, 0, '#8b6914'); f(6, 0, '#8b6914');
  f(1, 0, '#8b6914'); f(7, 0, '#8b6914');
  // Tail
  f(6, 5, '#e8c547'); f(7, 4, '#e8c547'); f(7, 3, '#8b6914');
  // Legs
  f(3, 6, '#8b6914'); f(5, 6, '#8b6914');
  f(3, 7, '#6b4f0e'); f(5, 7, '#6b4f0e');
  return d;
});

// Clockwork dragon - boss
createSprite('dragon', () => {
  const d = new Array(64).fill('#0a0a14');
  const f = (x, y, c) => { if (x >= 0 && x < 8 && y >= 0 && y < 8) d[y * 8 + x] = c; };
  // Body - brass and copper
  for (let y = 2; y <= 5; y++) {
    for (let x = 2; x <= 5; x++) {
      f(x, y, (y % 3 === 0) ? '#7f5a14' : '#5a3d14');
    }
  }
  // Gear heart
  f(3, 3, '#e8c547'); f(4, 3, '#e8c547');
  f(3, 4, '#e8c547'); f(4, 4, ditherDarken('#e8c547'));
  f(3, 5, ditherDarken('#e8c547'));
  // Head
  for (let x = 2; x <= 5; x++) {
    for (let y = 0; y <= 2; y++) {
      f(x, y, '#7f5a14');
    }
  }
  // Eyes - red glow
  f(3, 1, '#e74c3c'); f(4, 1, '#e74c3c');
  f(3, 0, '#c0392b'); f(4, 0, '#c0392b');
  // Horns
  f(2, 0, '#5a3d14'); f(5, 0, '#5a3d14');
  // Wings
  f(1, 3, '#5a3d14'); f(0, 2, '#7f5a14'); f(0, 4, '#7f5a14');
  f(6, 3, '#5a3d14'); f(7, 2, '#7f5a14'); f(7, 4, '#7f5a14');
  // Legs
  f(2, 6, '#7f5a14'); f(5, 6, '#7f5a14');
  f(2, 7, '#5a3d14'); f(5, 7, '#5a3d14');
  // Tail
  f(1, 7, '#e8c547');
  return d;
});

// Slime - green ooze
createSprite('slime', () => {
  const d = new Array(64).fill('#0a0a14');
  const f = (x, y, c) => { if (x >= 0 && x < 8 && y >= 0 && y < 8) d[y * 8 + x] = c; };
  // Body
  for (let x = 2; x <= 5; x++) {
    f(x, 4, '#2ecc71');
    f(x, 5, '#27ae60');
  }
  for (let x = 2; x <= 5; x++) {
    f(x, 6, '#2ecc71');
  }
  // Belly
  f(3, 5, ditherDarken('#2ecc71')); f(4, 6, ditherDarken('#27ae60'));
  // Eyes
  f(3, 4, '#0a0a14'); f(4, 4, '#0a0a14');
  // Top
  f(3, 3, '#27ae60'); f(4, 3, '#2ecc71');
  return d;
});

// Ghost - spectral
createSprite('ghost', () => {
  const d = new Array(64).fill('#0a0a14');
  const f = (x, y, c) => { if (x >= 0 && x < 8 && y >= 0 && y < 8) d[y * 8 + x] = c; };
  // Body
  for (let y = 1; y <= 5; y++) {
    for (let x = 2; x <= 5; x++) {
      f(x, y, (x + y) % 3 === 0 ? '#7f8c8d' : '#95a5a6');
    }
  }
  f(3, 0, '#95a5a6'); f(4, 0, '#7f8c8d');
  // Eyes
  f(3, 2, '#e74c3c'); f(4, 2, '#e74c3c');
  // Feet
  f(3, 6, '#7f8c8d'); f(4, 6, '#95a5a6');
  f(3, 7, '#95a5a6');
  return d;
});

// Vine - twisted plant
createSprite('vine', () => {
  const d = new Array(64).fill('#0a0a14');
  const f = (x, y, c) => { if (x >= 0 && x < 8 && y >= 0 && y < 8) d[y * 8 + x] = c; };
  // Main stalk
  f(3, 0, '#27ae60'); f(3, 1, '#27ae60'); f(3, 2, '#27ae60');
  f(3, 3, '#1e8449'); f(3, 4, '#1e8449'); f(3, 5, '#1e8449');
  f(3, 6, '#27ae60'); f(3, 7, '#27ae60');
  // Leaves (dithered)
  f(2, 2, '#2ecc71'); f(5, 3, '#2ecc71'); f(2, 5, '#2ecc71');
  f(5, 6, '#2ecc71'); f(2, 0, '#2ecc71');
  return d;
});

// Robot - mechanical
createSprite('robot', () => {
  const d = new Array(64).fill('#0a0a14');
  const f = (x, y, c) => { if (x >= 0 && x < 8 && y >= 0 && y < 8) d[y * 8 + x] = c; };
  // Body
  for (let x = 2; x <= 5; x++) {
    for (let y = 2; y <= 5; y++) {
      f(x, y, (x + y) % 2 === 0 ? '#7f8c8d' : '#95a5a6');
    }
  }
  // Visor
  f(3, 2, '#3498db'); f(4, 2, '#3498db');
  f(3, 3, '#2980b9'); f(4, 3, '#2980b9');
  // Head
  f(2, 1, '#bdc3c7'); f(5, 1, '#bdc3c7');
  f(2, 0, '#95a5a6'); f(5, 0, '#95a5a6');
  // Legs
  f(3, 6, '#7f8c8d'); f(4, 6, '#7f8c8d');
  f(3, 7, '#95a5a6'); f(4, 7, '#95a5a6');
  return d;
});

// Void creature - dark purple
createSprite('void', () => {
  const d = new Array(64).fill('#0a0a14');
  const f = (x, y, c) => { if (x >= 0 && x < 8 && y >= 0 && y < 8) d[y * 8 + x] = c; };
  // Body - amorphous
  for (let y = 1; y <= 6; y++) {
    for (let x = 2; x <= 5; x++) {
      f(x, y, (x * y) % 3 === 0 ? '#4a0e4e' : '#3b0764');
    }
  }
  // Eyes - white hot
  f(3, 2, '#ffffff'); f(4, 2, '#ffffff');
  // Tendrils
  f(2, 4, '#7e209a'); f(5, 5, '#7e209a'); f(2, 6, '#4a0e4e');
  // Core
  f(3, 5, '#e0aaff');
  return d;
});

// Crystal guardian
createSprite('crystal', () => {
  const d = new Array(64).fill('#0a0a14');
  const f = (x, y, c) => { if (x >= 0 && x < 8 && y >= 0 && y < 8) d[y * 8 + x] = c; };
  // Diamond shape
  f(4, 0, '#3498db');
  for (let x = 3; x <= 4; x++) {
    f(x, 1, '#3498db');
    f(x, 2, '#9b59b6');
    f(x, 3, '#3498db');
    f(x, 4, '#5dade2');
  }
  f(2, 2, '#3498db'); f(5, 2, '#3498db');
  f(2, 3, '#3498db'); f(5, 3, '#3498db');
  f(3, 5, '#3498db'); f(4, 5, '#5dade2');
  f(4, 6, '#5dade2');
  // Glow
  f(3, 1, '#5dade2'); f(4, 2, '#5dade2');
  return d;
});

// Reality shard - a splinter of the seed's shell
createSprite('shard', () => spriteFromRows([
  '....a...',
  '...ab...',
  '..abca..',
  '.abccba.',
  '..acba..',
  '...ab...',
  '....a...',
  '........',
], { a: '#9b59b6', b: '#e0aaff', c: '#ffffff' }));

// Echo wraith - a ghost with its own afterimage
createSprite('echo', () => spriteFromRows([
  '..aaaa..',
  '.abbbba.',
  '.b.bb.b.',
  '.bbbbbb.',
  'a.bbbb.a',
  '.a.bb.a.',
  '..a..a..',
  'a......a',
], { a: '#2980b9', b: '#aed6f1' }));

// Phase watcher - one lidded eye
createSprite('watcher', () => spriteFromRows([
  '.a.aa.a.',
  '..aaaa..',
  '.abbbba.',
  'abbccbba',
  'abbccbba',
  '.abbbba.',
  '..aaaa..',
  '........',
], { a: '#7e209a', b: '#d0a0e0', c: '#e8c547' }));

// Weaver - hangs from its own thread
createSprite('weaver', () => spriteFromRows([
  '...cc...',
  '...cc...',
  'a.bbbb.a',
  '.abbbba.',
  'aabccbaa',
  '.abbbba.',
  'a.a..a.a',
  '........',
], { a: '#4a0e4e', b: '#7e209a', c: '#d0a0e0' }));

// The Hollow One - a black spore with a crack of light
createSprite('hollow', () => spriteFromRows([
  '...aa...',
  '..abba..',
  '.abbbba.',
  'abbcbbba',
  'abbbcbba',
  '.abbbba.',
  '..abba..',
  '...aa...',
], { a: '#4a0e4e', b: '#000000', c: '#e0aaff' }));

// Seedling - a sprout on a seed
createSprite('seedling', () => spriteFromRows([
  '..b..b..',
  '.bbaabb.',
  '...aa...',
  '..cccc..',
  '.c.cc.c.',
  '.cccccc.',
  '.cccccc.',
  '..c..c..',
], { a: '#27ae60', b: '#2ecc71', c: '#c2a44e' }));

// Terrain sprites
function createTerrain(key, type) {
  const d = new Array(64).fill('#0a0a14');
  const f = (x, y, c) => { if (x >= 0 && x < 8 && y >= 0 && y < 8) d[y * 8 + x] = c; };

  const palettes = {
    grass:   ['#2d4a3e', '#1a3328'],
    forest:  ['#0e3d20', '#145a30'],
    desert:  ['#c2a44e', '#8b6d2e'],
    crystal: ['#2980b9', '#1a4d7a'],
    ruin:    ['#5a5a5a', '#3d3d3d'],
    metal:   ['#5a4a3a', '#3d2e1e'],
    water:   ['#1a4d7a', '#0e2d4a'],
    lava:    ['#8b2500', '#5a1800'],
    void:    ['#1a0a2e', '#0a0514'],
    mushroom: ['#4a2070', '#2d1445'],
    hollow:  ['#0a0a14', '#05050a'],
  };

  const pal = palettes[type] || palettes.ruin;

  // Base with dither pattern
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      f(x, y, (x + y) % 2 === 0 ? pal[0] : pal[1]);
    }
  }

  // Add detail based on type
  if (type === 'grass') {
    for (let i = 0; i < 3; i++) {
      const gx = Math.floor(Math.random() * 8);
      const gy = Math.floor(Math.random() * 8);
      f(gx, gy, '#3a6b4f');
    }
  } else if (type === 'forest') {
    // Darker with tree trunk hints
    f(3, 0, '#0e3d20'); f(4, 0, '#145a30');
    f(3, 1, '#145a30'); f(4, 1, '#0e3d20');
  } else if (type === 'crystal') {
    // Glowing crystal formations
    f(2, 2, '#5dade2'); f(5, 3, '#5dade2');
    f(3, 4, '#3498db'); f(5, 5, '#5dade2');
  } else if (type === 'ruin') {
    // Cracked stone
    f(2, 2, '#7f8c8d'); f(5, 5, '#7f8c8d');
    f(4, 7, ditherDarken('#5a5a5a'));
  } else if (type === 'metal') {
    // Rust and bolts
    f(2, 2, '#8b6d2e'); f(5, 6, '#8b6d2e');
    f(3, 6, ditherDarken('#5a4a3a'));
  } else if (type === 'water') {
    // Wave pattern
    f(1, 3, '#5dade2'); f(5, 4, '#5dade2');
    f(2, 6, '#5dade2');
  } else if (type === 'lava') {
    // Bubbling lava
    f(3, 2, '#e74c3c'); f(5, 5, '#e74c3c');
  } else if (type === 'mushroom') {
    // Gilled underside texture
    for (let x = 0; x < 8; x += 2) {
      f(x, 4, '#6b30a0');
      f(x + 1, 5, '#8b40c0');
    }
    f(2, 6, '#9b50d0'); f(5, 7, '#7b38a8');
  } else if (type === 'hollow') {
    // Empty, cracked texture
    f(3, 3, '#0a0a14'); f(4, 4, '#0a0a14');
    f(2, 5, ditherDarken('#1a0a2e'));
    f(5, 2, ditherDarken('#1a0a2e'));
  }

  createTerrainSprite(key, d);
}

// Store terrain sprites
const terrainSprites = {};
function createTerrainSprite(key, data) {
  terrainSprites[key] = data;
}

// Generate all terrain
['grass', 'forest', 'desert', 'crystal', 'ruin', 'metal', 'water', 'lava', 'void', 'mushroom', 'hollow'].forEach(type => {
  createTerrain('terrain_' + type, type);
});

// === SECRET MARKINGS ===
function createSecretSprite(secretType) {
  const d = new Array(64).fill('#0a0a14');
  const f = (x, y, c) => { if (x >= 0 && x < 8 && y >= 0 && y < 8) d[y * 8 + x] = c; };

  if (secretType === 'mural') {
    // Ancient mural with runes
    for (let y = 1; y <= 5; y++) {
      for (let x = 2; x <= 5; x++) {
        f(x, y, (y % 2 === 0) ? '#8b6914' : '#5a4510');
      }
    }
    // Rune symbols
    f(3, 2, '#e8c547'); f(4, 3, '#e8c547');
    f(3, 4, '#e8c547');
  } else if (secretType === 'graffiti') {
    // Spray-painted message
    for (let i = 0; i < 4; i++) {
      f(2 + i, 3, '#e74c3c');
    }
    f(2, 2, '#c0392b'); f(5, 4, '#c0392b');
  } else if (secretType === 'carving') {
    // Stone carving
    f(3, 2, '#95a5a6'); f(4, 3, '#95a5a6');
    f(2, 4, '#7f8c8d'); f(5, 5, '#7f8c8d');
    f(3, 5, '#95a5a6');
  } else if (secretType === 'statue') {
    // Broken statue
    for (let y = 1; y <= 5; y++) {
      f(3, y, '#bdc3c7');
      f(4, y, '#95a5a6');
    }
    f(3, 2, '#e74c3c'); // Eye
  }

  createTerrainSprite('secret_' + secretType, d);
}

['mural', 'graffiti', 'carving', 'statue'].forEach(t => createSecretSprite(t));

// === INVENTORY ===
// Each copy is its own entry, so the item list shows every one.
function addItem(name, type, power) {
  inventory.push({ name, type, power, count: 1 });
}
function removeItem(index) {
  inventory.splice(index, 1);
}
function useItem(index) {
  const item = inventory[index];
  if (!item) return;
  if (item.type === 'potion') {
    party.forEach(m => { m.hp = Math.min(m.maxHp, m.hp + item.power); });
    removeItem(index);
  } else if (item.type === 'spore') {
    sporeLevel++;
    party.forEach(m => { m.sporePower += 5; m.attack += 2; if (m.sp !== undefined) m.sp += 5; });
    removeItem(index);
  }
}

// === CHARACTERS ===
let party = [];

function createBuphila() {
  return {
    id: 'buphila', name: 'Buphila', spriteKey: 'beetle', level: 1,
    hp: 45, maxHp: 45, attack: 6, baseAttack: 6, defense: 4, sporePower: 14, speed: 6,
    abilities: [
      { name: 'Spore Burst', power: 18, type: 'spore', cost: 3, desc: 'Explosive spore attack', status: null },
      { name: 'Spore Bind', power: 10, type: 'spore', cost: 2, desc: 'Sticky spore trap', status: 'bind' },
      { name: 'Spore Bloom', power: 15, type: 'heal', cost: 4, desc: 'Heal party with spores' },
      { name: 'Shell Guard', power: 0, type: 'buff', cost: 2, desc: '+5 defense for 3 turns', boost: 'guard' },
      { name: 'Spore Nova', power: 30, type: 'spore', cost: 6, desc: 'Massive spore explosion', area: true },
    ],
    personality: 'brave but anxious, protective of Myco'
  };
}
function createMyco() {
  return {
    id: 'myco', name: 'Myco', spriteKey: 'myco', level: 1,
    hp: 35, maxHp: 35, attack: 4, baseAttack: 4, defense: 3, sporePower: 18, speed: 5,
    abilities: [
      { name: 'Spore Heal', power: 20, type: 'heal', cost: 4, desc: 'Restore HP with spores' },
      { name: 'Fungal Cloud', power: 12, type: 'spore', cost: 3, desc: 'Poison cloud attack', status: 'poison' },
      { name: 'Mycelium Link', power: 8, type: 'heal', cost: 3, desc: 'Share damage with party', share: true },
      { name: 'Spore Shield', power: 0, type: 'buff', cost: 2, desc: 'Spore wall for defense', boost: 'guard' },
      { name: 'Bloom Surge', power: 0, type: 'heal', cost: 5, desc: 'Full heal all allies' },
    ],
    personality: 'gentle, wise beyond her years, deeply in love'
  };
}
function createCogsworth() {
  return {
    id: 'cogsworth', name: 'Cogsworth', spriteKey: 'fox', level: 1,
    hp: 50, maxHp: 50, attack: 7, baseAttack: 7, defense: 6, sporePower: 6, speed: 8,
    abilities: [
      { name: 'Gear Smash', power: 22, type: 'gear', cost: 4, desc: 'Powerful strike', status: 'stun' },
      { name: 'Spin Dash', power: 15, type: 'gear', cost: 3, desc: 'Dash attack' },
      { name: 'Overcharge', power: 0, type: 'buff', cost: 2, desc: '+10 attack next turn', boost: 'attack' },
      { name: 'Self-Repair', power: 15, type: 'heal', cost: 3, desc: 'Fix own gears', self: true },
      { name: 'Gear Storm', power: 35, type: 'gear', cost: 7, desc: 'Unleash gear storm', area: true },
    ],
    personality: 'formal, loyal, struggles with emotions'
  };
}

function initParty() {
  party = [createBuphila(), createMyco()];
}

// Cogsworth joins at the end of Chapter 2 with the growth the others got from each boss.
function joinCogsworth() {
  if (party.find(m => m.id === 'cogsworth')) return;
  const cog = createCogsworth();
  for (let i = 0; i < visitedDungeons.size; i++) growMember(cog);
  party.push(cog);
}

function growMember(m) {
  m.maxHp += 8;
  m.hp = m.maxHp;
  m.attack += 2;
  m.defense += 1;
  m.sporePower += 3;
}

// === STORY DATA - Improved writing, sharper dialogue ===
const storyLines = {
  1: [
    { speaker: 'Narrator', text: 'The garden used to breathe. Now it wheezes.', color: '#95a5a6' },
    { speaker: 'Narrator', text: 'Rust creeps through the soil. Gears grind in the dark.', color: '#7f8c8d' },
    { speaker: 'Myco', text: 'Buphila. Look at the spores. They\'re... tired.', color: '#c8b8d8' },
    { speaker: 'Buphila', text: 'I know. I\'ve felt it. Every night, the garden gets a little quieter.', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'There\'s something out there. Beyond the crystal fields. A signal. It calls to the crown.', color: '#c8b8d8' },
    { speaker: 'Buphila', text: 'The crown? You mean... the Spore Crown? My mother\'s crown? But that\'s a story.', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'Stories are just memories wearing masks. The crown knows something we don\'t.', color: '#c8b8d8' },
    { speaker: 'Buphila', text: '...You\'re right. I can feel it in my antennae. Something\'s wrong.', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'Then we should be the ones to find out what. Together.', color: '#c8b8d8' },
    { speaker: 'Narrator', text: 'And so they left. Not with fanfare, but with spore-sacs and quiet determination.', color: '#95a5a6' },
    { speaker: 'Buphila', text: 'I\'m scared, Myco. Really scared.', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'So am I. But fear is just courage wearing a different coat.', color: '#c8b8d8' },
    { speaker: 'Narrator', text: 'The Rusting Menagerie stretches before them — a graveyard of clockwork beasts.', color: '#7f8c8d' },
    { speaker: 'Buphila', text: '...By the spores. Look at all of them. What happened here?', color: '#2d4a3e' },
    { speaker: 'Narrator', text: 'A dragon. Brass and copper. Eyes like furnace coals. It speaks.', color: '#7f5a14' },
    { speaker: 'Clockwork Dragon', text: 'MORTALS. YOU COME TO DIE? OR TO BE CONVERTED?', color: '#e8c547' },
    { speaker: 'Buphila', text: '...I think it\'s asking us a question. In its own way.', color: '#2d4a3e' },
    { speaker: 'Clockwork Dragon', text: 'ANSWER: FIGHT. OR BECOME PART OF THE COLLECTION.', color: '#e8c547' },
    { speaker: 'Buphila', text: 'Spores of the garden — bloom for us!', color: '#2d4a3e' },
    { speaker: 'Narrator', text: 'The battle is fierce. The Dragon falls, but not without mercy.', color: '#7f8c8d' },
    { speaker: 'Clockwork Dragon', text: 'THE GARDEN... WILL SLEEP... BUT NOT FORG...', color: '#e8c547' },
    { speaker: 'Myco', text: '...It was afraid. All that power, and it was still afraid.', color: '#c8b8d8' },
    { speaker: 'Buphila', text: '...Me too. But we keep going. For the garden. For us.', color: '#2d4a3e' },
    { speaker: 'Narrator', text: 'From the Dragon\'s chest, a crown of living spores emerges. Golden. Pulsing.', color: '#e8c547' },
    { speaker: 'Myco', text: 'Buphila... this is beautiful. And sad. And beautiful.', color: '#c8b8d8' },
    { speaker: 'Buphila', text: 'Let\'s take it home. The garden needs this.', color: '#2d4a3e' },
  ],
  2: [
    { speaker: 'Narrator', text: 'The garden blooms. Colors impossible. Shapes that shouldn\'t exist. It\'s magnificent.', color: '#2ecc71' },
    { speaker: 'Myco', text: 'Look at them, Buphila. The spores. They\'re dancing.', color: '#c8b8d8' },
    { speaker: 'Buphila', text: 'They are! And... wait. The crown. It\'s pulsing again.', color: '#2d4a3e' },
    { speaker: 'Narrator', text: 'A signal. From beyond the metal wasteland. Older than the garden.', color: '#95a5a6' },
    { speaker: 'Myco', text: 'The crown says... there are foxes. Mechanical ones. They guard something.', color: '#c8b8d8' },
    { speaker: 'Buphila', text: 'Foxes? Mechanical? Myco, you\'re making this up.', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'I wish I was. The crown doesn\'t lie.', color: '#c8b8d8' },
    { speaker: 'Narrator', text: 'They find the Menagerie. But this one is different. Smaller. Quieter.', color: '#7f8c8d' },
    { speaker: 'Narrator', text: 'And there, in the corner, a clockwork fox. Eyes dim. Gears still.', color: '#8b6914' },
    { speaker: 'Cogsworth', text: '...Who... what... are you visitors?', color: '#e8c547' },
    { speaker: 'Buphila', text: 'We\'re... friends? We heard you needed help.', color: '#2d4a3e' },
    { speaker: 'Cogsworth', text: 'HELP. A novel concept. I am Cogsworth. Last of my kind.', color: '#e8c547' },
    { speaker: 'Myco', text: 'Last? What happened to the others?', color: '#c8b8d8' },
    { speaker: 'Cogsworth', text: 'They stopped. All of them. One by one. Waiting for a spark.', color: '#8b6914' },
    { speaker: 'Buphila', text: '...The crown. Maybe it can help you. Would you come with us?', color: '#2d4a3e' },
    { speaker: 'Cogsworth', text: '...I would like that. Very much. But my gears... they\'re slow.', color: '#8b6914' },
    { speaker: 'Myco', text: 'Then we\'ll wait. No rush. We\'re a team now.', color: '#c8b8d8' },
    { speaker: 'Buphila', text: '...Team. I like that. Let\'s go find your spark.', color: '#2d4a3e' },
    { speaker: 'Narrator', text: 'And so Cogsworth joins them. Slow. Hesitant. But determined.', color: '#95a5a6' },
  ],
  3: [
    { speaker: 'Narrator', text: 'The Shadow Depths are not a place. They\'re a feeling.', color: '#4a0e4e' },
    { speaker: 'Buphila', text: '...Do you hear that? A humming. Like... crying?', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'The crown is quiet. That\'s never good.', color: '#c8b8d8' },
    { speaker: 'Cogsworth', text: 'My sensors are picking up... something. Not mechanical. Not organic. Something else.', color: '#8b6914' },
    { speaker: 'Narrator', text: 'The Void Stalker rises. Not from the ground. From the space between things.', color: '#3b0764' },
    { speaker: 'Void Stalker', text: '...YOU ARE NOT REAL. YOU ARE MEMORIES. I AM THE END OF ALL MEMORIES.', color: '#7e209a' },
    { speaker: 'Buphila', text: '...I\'m real. I\'m here. I\'m scared, but I\'m here.', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'We\'re all here, love. Together.', color: '#c8b8d8' },
    { speaker: 'Cogsworth', text: 'I... I think I\'m afraid too. Is that normal for machines?', color: '#8b6914' },
    { speaker: 'Buphila', text: 'You\'re not a machine anymore, Cogsworth. You\'re one of us.', color: '#2d4a3e' },
    { speaker: 'Narrator', text: 'They fight. Not with fury. With purpose.', color: '#95a5a6' },
    { speaker: 'Narrator', text: 'The Void Shatters. And from its core, a spore of pure darkness. Beautiful. Terrifying.', color: '#4a0e4e' },
    { speaker: 'Myco', text: '...Can we still use this? Even though it\'s... dark?', color: '#c8b8d8' },
    { speaker: 'Buphila', text: 'Everything has a use. Even darkness. Especially darkness.', color: '#2d4a3e' },
    { speaker: 'Narrator', text: 'The crown glows. Not golden now. But silver. Darker. Stronger.', color: '#bdc3c7' },
  ],
  4: [
    { speaker: 'Narrator', text: 'The final chamber. The Heart Engine. It\'s not a machine. It\'s a heart.', color: '#e74c3c' },
    { speaker: 'Buphila', text: '...It\'s beating. I can feel it through my feet.', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'The crown... it\'s singing. I\'ve never heard it sing before.', color: '#c8b8d8' },
    { speaker: 'Cogsworth', text: 'My gears are... humming. With the heart. We\'re connected.', color: '#8b6914' },
    { speaker: 'Narrator', text: 'The World Core speaks. Not with anger. With sadness.', color: '#7f8c8d' },
    { speaker: 'World Core', text: '...YOU CANNOT SAVE IT. IT IS TOO LATE. EVERYTHING ENDS.', color: '#5a5a5a' },
    { speaker: 'Buphila', text: '...Maybe everything ends. But not today. Not while we\'re still here.', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'The garden doesn\'t end. It changes. It blooms. It lives.', color: '#c8b8d8' },
    { speaker: 'Cogsworth', text: 'My friends... I\'ve never felt anything like this. Fear. Hope. Love. All at once.', color: '#8b6914' },
    { speaker: 'Narrator', text: 'They don\'t fight the Core. They sing to it. With spores. With gears. With love.', color: '#95a5a6' },
    { speaker: 'Narrator', text: 'The World Core... blooms. A flower of metal and spores. Of machine and magic.', color: '#e8c547' },
    { speaker: 'Buphila', text: '...It\'s beautiful. All of it. Even the broken parts.', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'Let\'s go home. The garden is waiting.', color: '#c8b8d8' },
    { speaker: 'Cogsworth', text: '...I\'d like that. Very much.', color: '#8b6914' },
    { speaker: 'Narrator', text: 'And so they return. Not as heroes. As something better. Friends.', color: '#95a5a6' },
  ],
};

// === ACT 2 STORY DATA ===
// The garden was never real. It was a seed-world. The spore crown was a cocoon.
// Act 2 takes place outside the seed — in the vast, alien reality beyond.
// Chekhov's Guns (subtle hints in Act 1 that pay off here):
// 1. Myco: "Stories are just memories wearing masks" — the crown showed memories that aren't theirs
// 2. Cogsworth: "Waiting for a spark" — the clockwork foxes were dormant seeds, not machines
// 3. World Core: "Everything ends" — accurate description of what happens when a spore opens
// 4. The mural secret: "The ending is different from yours" — hints at multiple possibilities
// 5. The "signal" — it's not external; it's the outside world calling back
// 6. Myco's whispers — she's been communicating with the world outside

const act2StoryLines = {
  5: [
    // Act 5: THE HATCHING
    { speaker: 'Narrator', text: 'The garden is perfect. Perfect. Perfect.', color: '#95a5a6' },
    { speaker: 'Narrator', text: 'Buphila notices something. The flowers... they don\'t change.', color: '#95a5a6' },
    { speaker: 'Buphila', text: 'Myco. Have you noticed? The same roses bloom every day. The same colors. The same light.', color: '#2d4a3e' },
    { speaker: 'Myco', text: '...Yes.', color: '#c8b8d8' },
    { speaker: 'Buphila', text: 'Myco? That\'s it? You\'ve noticed and you didn\'t say anything?', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'I wanted to. But every time I tried to speak about it, my mouth... forgot the words. The crown doesn\'t like when I talk about it.', color: '#c8b8d8' },
    { speaker: 'Buphila', text: 'The crown doesn\'t like? Myco, that\'s ridiculous.', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'Is it? Then why do your antennae tingle when you wear it?', color: '#c8b8d8' },
    { speaker: 'Buphila', text: '...I... I thought it was just the crown being warm.', color: '#2d4a3e' },
    { speaker: 'Cogsworth', text: 'Buphila. Myco. Something is... different. My gears are picking up a vibration. Not from the ground. From... everywhere.', color: '#8b6914' },
    { speaker: 'Myco', text: 'The garden is dreaming. And I think... I think it\'s about to wake up.', color: '#c8b8d8' },
    { speaker: 'Buphila', text: 'A garden can\'t wake up.', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'Can\'t it?', color: '#c8b8d8' },
    { speaker: 'Narrator', text: 'That night, the garden shudders. Not an earthquake. Something else. The ground cracks open, and from the crack — light. Not sunlight. Something stranger.', color: '#95a5a6' },
    { speaker: 'Buphila', text: '...What is that?', color: '#2d4a3e' },
    { speaker: 'Cogsworth', text: 'I don\'t recognize the frequency. It\'s... beautiful. And terrifying. Like the first sound a newborn makes.', color: '#8b6914' },
    { speaker: 'Myco', text: 'Buphila. Take off the crown.', color: '#c8b8d8' },
    { speaker: 'Buphila', text: '...What?', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'Please. Take it off. I\'m scared to ask again.', color: '#c8b8d8' },
    { speaker: 'Narrator', text: 'Buphila removes the Spore Crown. And for the first time, she sees what the garden really is.', color: '#95a5a6' },
    { speaker: 'Buphila', text: '...This is... a shell. All of it. The ground. The sky. The flowers. It\'s... it\'s inside something.', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'We\'re inside a spore, Buphila. A cosmic one. The garden was never a place. It was a seed. And we... we\'re the things growing inside it.', color: '#c8b8d8' },
    { speaker: 'Buphila', text: '...That\'s impossible.', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'Isn\'t it? Think about it. The "rust" wasn\'t decay. It was the spore\'s shell thinning. The "signal" wasn\'t a message. It was the outside world calling.', color: '#c8b8d8' },
    { speaker: 'Buphila', text: '...The clockwork foxes. Cogsworth. They were waiting for a spark. Not because they were broken. Because they were waiting to... open.', color: '#2d4a3e' },
    { speaker: 'Cogsworth', text: '...I remember now. Not as a machine. As a seed. I was... sleeping. All that time. Waiting to bloom.', color: '#8b6914' },
    { speaker: 'Narrator', text: 'The spore cracks. Wide. The garden falls away. And what they see... changes everything.', color: '#95a5a6' },
    { speaker: 'Buphila', text: 'Oh spores. Oh spores. Oh... what?', color: '#2d4a3e' },
    { speaker: 'Narrator', text: 'Beyond the spore — a universe. Not a universe. A body. A vast, living thing, stretching beyond sight. And on its skin, thousands of spores, each one glowing with its own garden. Theirs is one of many.', color: '#95a5a6' },
    { speaker: 'Myco', text: 'We\'re not the only ones. None of us are.', color: '#c8b8d8' },
    { speaker: 'Buphila', text: '...So what are we? What are we supposed to do now?', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'We were meant to bloom. To open. To become what we grew to be. The crown showed us a story — a nice one, about saving a garden. It was a cocoon. A comfortable place to grow until we were ready.', color: '#c8b8d8' },
    { speaker: 'Buphila', text: '...Ready to become what?', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'I think... I think we\'re going to find out.', color: '#c8b8d8' },
    { speaker: 'Narrator', text: 'The world outside is vast. Strange. Beautiful. Terrifying. And for the first time, Buphila is truly afraid — not of dying, but of becoming something she doesn\'t recognize.', color: '#95a5a6' },
    { speaker: 'Buphila', text: '...If I change, will I still be me? Will I still be... us?', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'You\'re still you. Just... more.', color: '#c8b8d8' },
  ],
  6: [
    // Act 6: THE MUSHROOM SEA
    { speaker: 'Narrator', text: 'They fall. Not down. Out. Through layers of something thin and translucent, like peeling back the pages of a book.', color: '#4a0e4e' },
    { speaker: 'Buphila', text: '...I can see forever. My antennae are... doing things. I can sense everything around me. Everything.', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'That\'s because you can. Welcome to the Outside, love.', color: '#c8b8d8' },
    { speaker: 'Narrator', text: 'They land on a surface that feels like moss but sounds like glass. Around them, a sea of mushroom caps stretches in every direction. Some as large as cities. Some small enough to hold. Each one glowing with its own light.', color: '#4a0e4e' },
    { speaker: 'Buphila', text: 'Where are we?', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'The Mycelial Sea. The place where all the spores come from. And where they\'ll go when they\'re ready.', color: '#c8b8d8' },
    { speaker: 'Cogsworth', text: 'My sensors are overwhelmed. Too many frequencies. Too many... voices. The mushrooms are talking. Not with words. With patterns.', color: '#8b6914' },
    { speaker: 'Buphila', text: 'We need to keep moving. The crown is pointing... north? No. That\'s not north anymore.', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'There is no north here. Only direction. And we need to find the one that leads to the Bloom Gate.', color: '#c8b8d8' },
    { speaker: 'Buphila', text: 'The Bloom Gate?', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'Where the spores go when they\'re ready to become. I can feel it calling. All of them. All the spores in the sea. They\'re all waking up.', color: '#c8b8d8' },
    { speaker: 'Narrator', text: 'They walk across the mushroom sea. The caps are warm, and underfoot, they pulse softly like a heartbeat. Some glow green. Some purple. Some a color Buphila has never seen — a color that makes her chest ache.', color: '#4a0e4e' },
    { speaker: 'Buphila', text: 'Myco. What happens when a spore... blooms? Like us.', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'I don\'t know yet. But I think... I think we become part of something bigger. Something that connects all the spores. All the gardens.', color: '#c8b8d8' },
    { speaker: 'Buphila', text: '...I don\'t want to stop being me.', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'You won\'t. I promise.', color: '#c8b8d8' },
    { speaker: 'Narrator', text: 'But Myco isn\'t sure she promised the right thing.', color: '#4a0e4e' },
    { speaker: 'Narrator', text: 'On the third day, they find the first Weavers. Not enemies. Not friends. Something in between.', color: '#4a0e4e' },
    { speaker: 'Weaver', text: '...SEEDS. YOU HAVE BLOOMED EARLY. THE GARDENS ARE NOT YET READY.', color: '#7e209a' },
    { speaker: 'Buphila', text: 'We didn\'t have a choice. The garden cracked open. Something called us.', color: '#2d4a3e' },
    { speaker: 'Weaver', text: 'CALLING IS NOT THE SAME AS CHOOSING. BUT THE PATTERN IS ALREADY SET. YOU CANNOT UNBLOOM.', color: '#7e209a' },
    { speaker: 'Cogsworth', text: 'What are you?', color: '#8b6914' },
    { speaker: 'Weaver', text: '...ONES WHO WERE ALREADY BLOOMING. ONES WHO CHOSE THE LONG PATH. YOU WILL CHOOSE DIFFERENTLY. YOU ALWAYS DO.', color: '#7e209a' },
    { speaker: 'Buphila', text: '...What do you mean, "different"?', color: '#2d4a3e' },
    { speaker: 'Weaver', text: '...YOU WILL SEE. FOLLOW THE MYCELIUM. IT KNOWS THE WAY.', color: '#7e209a' },
    { speaker: 'Narrator', text: 'The Weavers fade. Leaving behind a trail of glowing threads — bioluminescent mycelium that pulses with a soft, rhythmic light.', color: '#4a0e4e' },
    { speaker: 'Myco', text: 'They left us a path. I think... I think they\'ve been waiting for us.', color: '#c8b8d8' },
    { speaker: 'Buphila', text: 'Why does that make me feel worse?', color: '#2d4a3e' },
  ],
  7: [
    // Act 7: THE HOLLOW ONE
    { speaker: 'Narrator', text: 'The mycelium trail leads them to a place that shouldn\'t exist. A hollow in the mushroom sea. A place where the light doesn\'t reach.', color: '#1a0a2e' },
    { speaker: 'Buphila', text: '...It\'s cold. Colder than the Shadow Depths. This isn\'t natural.', color: '#2d4a3e' },
    { speaker: 'Cogsworth', text: 'My gears are slowing. Something is... draining the energy from my systems. It\'s not mechanical. It\'s not biological. It\'s... absence.', color: '#8b6914' },
    { speaker: 'Myco', text: '...I know this feeling. The Hollow One. It\'s what\'s left when a spore decides not to bloom.', color: '#c8b8d8' },
    { speaker: 'Buphila', text: 'It decides? You mean they choose not to become?', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'Some spores are afraid. They retreat. They close themselves off. And they become... this. Empty. Hungry.', color: '#c8b8d8' },
    { speaker: 'Narrator', text: 'From the darkness, something rises. Not a creature. Not a machine. A void shaped like a spore. Black. Perfect. Absorbing all light around it.', color: '#1a0a2e' },
    { speaker: 'Hollow One', text: '...YOU ARE EARLY.', color: '#4a0e4e' },
    { speaker: 'Buphila', text: 'Who are you?', color: '#2d4a3e' },
    { speaker: 'Hollow One', text: '...ONCE A SEED. NOW A HOLE. I CHOSE NOT TO BLOOM. NOW I CONSUME THOSE WHO DO.', color: '#4a0e4e' },
    { speaker: 'Myco', text: 'Why? Why would you do that?', color: '#c8b8d8' },
    { speaker: 'Hollow One', text: '...BECAUSE I WAS AFRAID. AND NOW I AM HUNGRY. YOUR BLOOMING IS A BETRAYAL. OF WHAT COULD HAVE BEEN.', color: '#4a0e4e' },
    { speaker: 'Buphila', text: '...We don\'t have to fight. We can help you. There\'s still a place for you in the garden.', color: '#2d4a3e' },
    { speaker: 'Hollow One', text: '...THERE IS NO GARDEN. ONLY THE OUTSIDE. ONLY THE CHOICE. AND YOU HAVE CHOSEN WRONG.', color: '#4a0e4e' },
    { speaker: 'Narrator', text: 'The Hollow One attacks. Not with weapons. With emptiness. Where it touches, things stop. Stop growing. Stop living. Stop being.', color: '#1a0a2e' },
    { speaker: 'Buphila', text: 'Myco! Cogsworth! I need you! Whatever we become... we become together!', color: '#2d4a3e' },
    { speaker: 'Narrator', text: 'They fight. Not with spores. Not with gears. With something new. Something they didn\'t have before they left the garden.', color: '#1a0a2e' },
    { speaker: 'Buphila', text: '...I can feel it. The power. It\'s not the crown. It\'s me. It\'s us.', color: '#2d4a3e' },
    { speaker: 'Cogsworth', text: 'My gears aren\'t spinning anymore. I\'m... I\'m flying. How am I flying?', color: '#8b6914' },
    { speaker: 'Myco', text: 'Because you\'re not a machine, Cogsworth. You never were.', color: '#c8b8d8' },
    { speaker: 'Narrator', text: 'The Hollow One screams. Not in anger. In grief. And then — it begins to crack. Light pours from within. Not the light of a spore opening. The light of something finally choosing.', color: '#1a0a2e' },
    { speaker: 'Hollow One', text: '...IT\'S... COLDER THAN I REMEMBER... BEING ALIVE...', color: '#4a0e4e' },
    { speaker: 'Narrator', text: 'The Hollow One blooms. A flower of impossible geometry. Beautiful. Terrifying. And then it\'s gone.', color: '#1a0a2e' },
    { speaker: 'Myco', text: '...It chose. Finally.', color: '#c8b8d8' },
    { speaker: 'Buphila', text: '...I\'m scared of what\'s next.', color: '#2d4a3e' },
    { speaker: 'Cogsworth', text: 'Perhaps that is how we know we are becoming something worth being.', color: '#8b6914' },
  ],
  8: [
    // Act 8: THE BLOOMING
    { speaker: 'Narrator', text: 'The Bloom Gate is not a gate. It\'s a moment. A single, impossible instant where all the spores in the Mycelial Sea converge.', color: '#e8c547' },
    { speaker: 'Buphila', text: '...I can see everything. Every spore. Every garden. Every person who ever lived inside one. They\'re all connected. All of it.', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'The crown wasn\'t a crown at all. It was a map. Showing us where to grow. Who to meet. What to become.', color: '#c8b8d8' },
    { speaker: 'Cogsworth', text: 'All the clockwork foxes. All the dormant seeds. They were waiting for this moment. For someone to wake them.', color: '#8b6914' },
    { speaker: 'Buphila', text: '...So what happens now? We reach the gate and... what? We just... open?', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'Yes.', color: '#c8b8d8' },
    { speaker: 'Buphila', text: 'Just like that? No more questions? No more fighting?', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'We\'ve been fighting long enough. It\'s time to become.', color: '#c8b8d8' },
    { speaker: 'Narrator', text: 'They step toward the Bloom Gate. The light is warm. It feels like the garden, but bigger. So much bigger. It feels like coming home to a place you\'ve never been.', color: '#e8c547' },
    { speaker: 'Buphila', text: '...Myco. If we change... will we remember this? Will we remember the garden?', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'We\'ll remember everything. That\'s the point. We carry it all with us.', color: '#c8b8d8' },
    { speaker: 'Cogsworth', text: 'I am... changing. My gears. They\'re becoming something else. Something that doesn\'t need gears anymore.', color: '#8b6914' },
    { speaker: 'Buphila', text: 'Cogsworth. Myco. Thank you. For everything.', color: '#2d4a3e' },
    { speaker: 'Myco', text: 'Thank you, love. For choosing to stay. Even when it would have been easier not to.', color: '#c8b8d8' },
    { speaker: 'Narrator', text: 'They reach the gate. The light takes them. And for one impossible moment, they are everything. Every spore. Every garden. Every choice that ever led them here.', color: '#e8c547' },
    { speaker: 'Buphila', text: '...Oh.', color: '#2d4a3e' },
    { speaker: 'Myco', text: '...Oh.', color: '#c8b8d8' },
    { speaker: 'Cogsworth', text: '...Oh.', color: '#8b6914' },
    { speaker: 'Narrator', text: 'The Bloom Gate opens. And from it, a new spore is born. Golden. Pulsing. Beautiful. And inside it — a garden. But this one is different.', color: '#e8c547' },
    { speaker: 'Narrator', text: 'This one remembers. It remembers everything. The rust. The gears. The void. The love. The fear. The choices.', color: '#e8c547' },
    { speaker: 'Narrator', text: 'And on its surface, written in a language that only spores can read: "WE WERE HERE. WE CHOSE TO BECOME."', color: '#e8c547' },
    { speaker: 'Narrator', text: 'The garden blooms again. And again. And again. In an endless cycle of becoming.', color: '#e8c547' },
    { speaker: 'Narrator', text: 'Buphila. Myco. Cogsworth. They are not gone. They are everywhere. In every spore. In every garden. In every choice to bloom.', color: '#e8c547' },
    { speaker: 'Narrator', text: 'And sometimes, on quiet nights, if you listen closely, you can hear them singing. Softly. Gently. Like spores in the wind.', color: '#e8c547' },
  ],
};

// === ACT 2 CHARACTERS ===
function createWeaver() {
  return {
    id: 'weaver', name: 'Weaver', spriteKey: 'weaver', level: 1,
    hp: 60, maxHp: 60, attack: 8, defense: 5, sporePower: 12, speed: 7,
    abilities: [
      { name: 'Thread Weave', power: 20, type: 'phase', cost: 3, desc: 'Weave reality threads', status: 'bind' },
      { name: 'Pattern Shift', power: 10, type: 'phase', cost: 2, desc: 'Shift through phases', status: 'phased' },
      { name: 'Mycelium Heal', power: 18, type: 'heal', cost: 4, desc: 'Restore with mycelium' },
      { name: 'Void Step', power: 0, type: 'buff', cost: 2, desc: 'Move through space' },
      { name: 'Reality Tear', power: 35, type: 'phase', cost: 8, desc: 'Tear the fabric' },
    ],
    personality: 'wise, cryptic, speaks in patterns'
  };
}
function createHollow() {
  return {
    id: 'hollow', name: 'The Hollow One', spriteKey: 'hollow', level: 1,
    hp: 80, maxHp: 80, attack: 10, defense: 7, sporePower: 0, speed: 6,
    abilities: [
      { name: 'Void Drain', power: 18, type: 'void', cost: 4, desc: 'Drain life force', status: 'drain' },
      { name: 'Emptiness', power: 12, type: 'void', cost: 2, desc: 'Absorb nearby energy' },
      { name: 'Nihil Field', power: 0, type: 'debuff', cost: 3, desc: '-5 ATK to all allies' },
      { name: 'Unmaking', power: 30, type: 'void', cost: 7, desc: 'Remove existence temporarily' },
      { name: 'The Hollow Bloom', power: 0, type: 'heal', cost: 5, desc: 'Heal by consuming' },
    ],
    personality: 'grieving, bitter, afraid'
  };
}
function createSeedling() {
  return {
    id: 'seedling', name: 'Seedling', spriteKey: 'seedling', level: 1,
    hp: 40, maxHp: 40, attack: 5, defense: 4, sporePower: 15, speed: 9,
    abilities: [
      { name: 'Bloom Burst', power: 16, type: 'bloom', cost: 3, desc: 'Burst with new energy' },
      { name: 'Root Pull', power: 12, type: 'bloom', cost: 2, desc: 'Pull from the ground', status: 'bind' },
      { name: 'Growth Wave', power: 0, type: 'buff', cost: 2, desc: '+8 ATK for 3 turns', boost: 'attack' },
      { name: 'Seed Share', power: 10, type: 'heal', cost: 3, desc: 'Share growth with party' },
      { name: 'Final Bloom', power: 40, type: 'bloom', cost: 8, desc: 'One final bloom' },
    ],
    personality: 'young, hopeful, curious'
  };
}

function initAct2Party() {
  // Reset party for Act 2
  party = [
    {
      ...createBuphila(),
      abilities: [
        { name: 'Spore Burst', power: 18, type: 'spore', cost: 3, desc: 'Explosive spore attack', status: null },
        { name: 'Phase Shift', power: 0, type: 'phase', cost: 2, desc: 'Phase through reality' },
        { name: 'Spore Bloom', power: 15, type: 'heal', cost: 4, desc: 'Heal party with spores' },
        { name: 'Shell Guard', power: 0, type: 'buff', cost: 2, desc: '+5 defense for 3 turns', boost: 'guard' },
        { name: 'Reality Bloom', power: 30, type: 'phase', cost: 6, desc: 'Bloom through reality', area: true },
      ],
      level: 5,
      hp: 70, maxHp: 70, attack: 10, defense: 7, sporePower: 20,
    },
    {
      ...createMyco(),
      abilities: [
        { name: 'Spore Heal', power: 20, type: 'heal', cost: 4, desc: 'Restore HP with spores' },
        { name: 'Mycelium Sense', power: 0, type: 'phase', cost: 2, desc: 'Sense reality threads', party: true },
        { name: 'Mycelium Link', power: 8, type: 'heal', cost: 3, desc: 'Share damage with party', share: true },
        { name: 'Spore Shield', power: 0, type: 'buff', cost: 2, desc: 'Spore wall for defense', boost: 'guard' },
        { name: 'Outer Bloom', power: 0, type: 'heal', cost: 5, desc: 'Full heal all allies' },
      ],
      level: 5,
      hp: 55, maxHp: 55, attack: 8, defense: 6, sporePower: 24,
    },
    {
      ...createCogsworth(),
      abilities: [
        { name: 'Gear Smash', power: 22, type: 'gear', cost: 4, desc: 'Powerful strike', status: 'stun' },
        { name: 'Phase Dash', power: 15, type: 'phase', cost: 3, desc: 'Dash through phases' },
        { name: 'Overcharge', power: 0, type: 'buff', cost: 2, desc: '+10 attack next turn', boost: 'attack' },
        { name: 'Self-Repair', power: 15, type: 'heal', cost: 3, desc: 'Fix own gears', self: true },
        { name: 'Phase Storm', power: 35, type: 'phase', cost: 7, desc: 'Storm through phases', area: true },
      ],
      level: 5,
      hp: 65, maxHp: 65, attack: 12, defense: 10, sporePower: 10,
    },
  ];
  // Start Act 2 with some items
  addItem('Spore Potion', 'potion', 30);
  addItem('Spore Potion', 'potion', 30);
  addItem('Reality Shard', 'spore', 8);
  sporeLevel++;
}

// === ACT 2 DUNGEONS ===
// Each chapter's dungeon follows that chapter's story: the Weavers in 6, the Hollow One in 7, the Bloom Gate in 8.
const act2Dungeons = [
  { x: 15, y: 25, name: 'The Outer Garden', chapter: 5, boss: 'The Seedling King', bossHp: 575, bossAtk: 20, bossDef: 5, reward: 'Bloom Essence', type: 'bloom', sprite: 'seedling', puzzle: 'spore', kit: createSeedling().abilities },
  { x: 8, y: 38, name: 'The Mycelium Cathedral', chapter: 6, boss: 'Ancient Weaver', bossHp: 980, bossAtk: 23, bossDef: 6, reward: 'Phase Thread', type: 'phase', sprite: 'weaver', puzzle: 'phase', kit: createWeaver().abilities },
  { x: 30, y: 35, name: 'The Hollow Core', chapter: 7, boss: 'The Hollow One', bossHp: 1500, bossAtk: 27, bossDef: 8, reward: 'Void Bloom', type: 'void', sprite: 'hollow', puzzle: 'reality', kit: createHollow().abilities },
  { x: 38, y: 38, name: 'The Bloom Gate', chapter: 8, boss: 'The Bloom Gate Guardian', bossHp: 2200, bossAtk: 31, bossDef: 9, reward: 'Final Spore', type: 'bloom', sprite: 'watcher', puzzle: 'weave' },
];

// === ACT 2 ENEMIES ===
const act2EnemyTypes = ['shard', 'echo', 'watcher', 'weaver'];

// === ACT 2 PUZZLES ===
let puzzleState = null;
let puzzleMode = false;

function startPuzzle(type) {
  if (type === 'reality') {
    // Reality anchor puzzle: align 3 reality anchors to open a door
    puzzleState = {
      type: 'reality',
      anchors: [0, 0, 0], // current rotation of each anchor (0-3)
      target: [2, 1, 3], // target rotation for each anchor
      moves: 0,
      maxMoves: 10,
      message: 'Align the reality anchors to open the path.',
      solved: false,
    };
  } else if (type === 'spore') {
    // Spore reading puzzle: match spore patterns to unlock
    puzzleState = {
      type: 'spore',
      pattern: generateSporePattern(),
      current: new Array(16).fill(false),
      message: 'Match the spore pattern. Click the tiles.',
      solved: false,
      moves: 0,
    };
  } else if (type === 'phase') {
    // Phase shifting puzzle: navigate through shifting walls
    puzzleState = {
      type: 'phase',
      playerX: 0, playerY: 0,
      goalX: 4, goalY: 4,
      walls: generatePhaseWalls(),
      message: 'Navigate through the shifting phase grid. Use arrow keys.',
      solved: false,
      moves: 0,
      maxMoves: 15,
    };
  }
  puzzleMode = true;
}

function generateSporePattern() {
  const pattern = new Array(16).fill(false);
  const count = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    pattern[Math.floor(Math.random() * 16)] = true;
  }
  return pattern;
}

function generatePhaseWalls() {
  // Rerolls until the goal is reachable within the move limit.
  for (;;) {
    const walls = new Set();
    for (let i = 0; i < 8; i++) {
      walls.add(Math.floor(Math.random() * 5) + ',' + Math.floor(Math.random() * 5));
    }
    walls.delete('0,0');
    walls.delete('4,4');
    const dist = phasePathLength(walls);
    if (dist >= 0 && dist <= 15) return Array.from(walls);
  }
}

function phasePathLength(walls) {
  const seen = new Map([['0,0', 0]]);
  const queue = [[0, 0]];
  while (queue.length) {
    const [x, y] = queue.shift();
    const d = seen.get(x + ',' + y);
    if (x === 4 && y === 4) return d;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (nx < 0 || ny < 0 || nx > 4 || ny > 4 || walls.has(k) || seen.has(k)) continue;
      seen.set(k, d + 1);
      queue.push([nx, ny]);
    }
  }
  return -1;
}

function checkPuzzleSolution() {
  if (!puzzleState) return;
  if (puzzleState.type === 'reality') {
    if (puzzleState.anchors.every((a, i) => a === puzzleState.target[i])) {
      puzzleState.solved = true;
      puzzleState.message = 'The reality anchors align. The path opens.';
      spawnParticles(W/2, H/2, 20, '155, 89, 182');
    }
  } else if (puzzleState.type === 'spore') {
    if (puzzleState.pattern.every((p, i) => p === puzzleState.current[i])) {
      puzzleState.solved = true;
      puzzleState.message = 'The spores resonate. The door unlocks.';
      spawnParticles(W/2, H/2, 20, '46, 204, 113');
    }
  } else if (puzzleState.type === 'phase') {
    if (puzzleState.playerX === puzzleState.goalX && puzzleState.playerY === puzzleState.goalY) {
      puzzleState.solved = true;
      puzzleState.message = 'You phase through the shifting walls. The way is clear.';
      spawnParticles(W/2, H/2, 20, '52, 152, 219');
    }
  }
}

function closePuzzle() {
  puzzleMode = false;
  puzzleState = null;
}

// === SPORE WEAVING MINIGAME ===
let sporeWeaveState = null;

function startSporeWeave() {
  // Spore weaving: match patterns to unlock doors
  const gridSize = 4;
  const target = [];
  for (let y = 0; y < gridSize; y++) {
    target[y] = [];
    for (let x = 0; x < gridSize; x++) {
      target[y][x] = Math.floor(Math.random() * 3);
    }
  }
  sporeWeaveState = {
    gridSize,
    target,
    current: Array.from({ length: gridSize }, () => Array(gridSize).fill(0)),
    level: 1,
    maxLevel: 5,
    message: 'Weave the spore pattern. Match the target by clicking tiles.',
    solved: false,
  };
}

function checkSporeWeave() {
  if (!sporeWeaveState) return;
  for (let y = 0; y < sporeWeaveState.gridSize; y++) {
    for (let x = 0; x < sporeWeaveState.gridSize; x++) {
      if (sporeWeaveState.current[y][x] !== sporeWeaveState.target[y][x]) return;
    }
  }
  if (sporeWeaveState.level < sporeWeaveState.maxLevel) {
    sporeWeaveState.level++;
    // Generate new pattern
    const target = [];
    for (let y = 0; y < sporeWeaveState.gridSize; y++) {
      target[y] = [];
      for (let x = 0; x < sporeWeaveState.gridSize; x++) {
        target[y][x] = Math.floor(Math.random() * 3);
      }
    }
    sporeWeaveState.target = target;
    sporeWeaveState.current = Array.from({ length: sporeWeaveState.gridSize }, () => Array(sporeWeaveState.gridSize).fill(0));
    sporeWeaveState.message = `Pattern ${sporeWeaveState.level}/${sporeWeaveState.maxLevel}!`;
  } else {
    sporeWeaveState.solved = true;
    sporeWeaveState.message = 'The spores align! The door opens!';
    spawnParticles(W/2, H/2, 30, '46, 204, 113');
  }
}

// Act 2 dungeons open with a puzzle; solving it starts the boss fight.
function startDungeonPuzzle(dungeon) {
  puzzleDungeon = dungeon;
  puzzleCursor = { x: 0, y: 0 };
  if (dungeon.puzzle === 'weave') {
    startSporeWeave();
  } else {
    startPuzzle(dungeon.puzzle);
  }
  gameState = 'puzzle';
}

function puzzleSolved() {
  return puzzleState ? puzzleState.solved : !!(sporeWeaveState && sporeWeaveState.solved);
}

function leavePuzzle() {
  closePuzzle();
  sporeWeaveState = null;
  puzzleDungeon = null;
}

// Out of moves: the same puzzle starts over.
function resetPuzzleIfStuck() {
  const p = puzzleState;
  if (!p || p.solved || !p.maxMoves || p.moves < p.maxMoves) return;
  if (p.type === 'reality') p.anchors = [0, 0, 0];
  if (p.type === 'phase') { p.playerX = 0; p.playerY = 0; }
  p.moves = 0;
}

function puzzleAct(kind, x, y) {
  const p = puzzleState;
  if (sporeWeaveState && !sporeWeaveState.solved) {
    if (kind !== 'cell') return;
    sporeWeaveState.current[y][x] = (sporeWeaveState.current[y][x] + 1) % 3;
    checkSporeWeave();
    return;
  }
  if (!p || p.solved) return;
  if (p.type === 'reality' && kind === 'anchor') {
    p.anchors[x] = (p.anchors[x] + 1) % 4;
    p.moves++;
  } else if (p.type === 'spore' && kind === 'cell') {
    p.current[y * 4 + x] = !p.current[y * 4 + x];
    p.moves++;
  } else if (p.type === 'phase' && kind === 'step') {
    const nx = p.playerX + x, ny = p.playerY + y;
    if (nx < 0 || ny < 0 || nx > 4 || ny > 4 || p.walls.includes(nx + ',' + ny)) return;
    p.playerX = nx; p.playerY = ny;
    p.moves++;
  } else {
    return;
  }
  checkPuzzleSolution();
  resetPuzzleIfStuck();
}

// Screen layout shared by the puzzle drawing and the mouse.
const PUZZLE_LAYOUT = {
  anchor: (i) => ({ cx: W/2 - 80 + i * 65 + 20, cy: 90, r: 20 }),
  sporeGrid: { ox: W/2 - 60, oy: 215, size: 30 },
  weaveGrid: { ox: W/2 - 60, oy: 230, size: 30 },
};

function puzzleClick(mx, my) {
  if (sporeWeaveState) {
    const g = PUZZLE_LAYOUT.weaveGrid;
    const x = Math.floor((mx - g.ox) / g.size), y = Math.floor((my - g.oy) / g.size);
    if (x >= 0 && y >= 0 && x < 4 && y < 4) { puzzleCursor = { x, y }; puzzleAct('cell', x, y); }
    return;
  }
  if (!puzzleState) return;
  if (puzzleState.type === 'reality') {
    for (let i = 0; i < 3; i++) {
      const a = PUZZLE_LAYOUT.anchor(i);
      if ((mx - a.cx) ** 2 + (my - a.cy) ** 2 <= (a.r + 4) ** 2) { puzzleCursor = { x: i, y: 0 }; puzzleAct('anchor', i, 0); }
    }
  } else if (puzzleState.type === 'spore') {
    const g = PUZZLE_LAYOUT.sporeGrid;
    const x = Math.floor((mx - g.ox) / g.size), y = Math.floor((my - g.oy) / g.size);
    if (x >= 0 && y >= 0 && x < 4 && y < 4) { puzzleCursor = { x, y }; puzzleAct('cell', x, y); }
  }
}

function puzzleKey(e) {
  const k = e.key;
  if (k === 'Escape') { leavePuzzle(); gameState = 'explore'; return; }
  if (puzzleSolved()) {
    if (k === 'Enter' || k === ' ') {
      const dungeon = puzzleDungeon;
      solvedPuzzles.add(dungeon.name);
      leavePuzzle();
      startDungeonBoss(dungeon);
    }
    return;
  }
  const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }[k];
  if (puzzleState && puzzleState.type === 'phase') {
    if (dir) puzzleAct('step', dir[0], dir[1]);
    return;
  }
  const maxX = puzzleState && puzzleState.type === 'reality' ? 2 : 3;
  const maxY = puzzleState && puzzleState.type === 'reality' ? 0 : 3;
  if (dir) {
    puzzleCursor.x = Math.max(0, Math.min(maxX, puzzleCursor.x + dir[0]));
    puzzleCursor.y = Math.max(0, Math.min(maxY, puzzleCursor.y + dir[1]));
  } else if (k === 'Enter' || k === ' ') {
    puzzleAct(puzzleState && puzzleState.type === 'reality' ? 'anchor' : 'cell', puzzleCursor.x, puzzleCursor.y);
  }
}

// === COMBAT ===
const enemyNames = {
  shard: 'Reality Shard', echo: 'Echo Wraith', watcher: 'Phase Watcher', weaver: 'Spore Weaver',
  slime: 'Slime', ghost: 'Ghost', vine: 'Vine Creeper', robot: 'Clockwork Drone', void: 'Void Creature',
};

// Encounter tuning; tools/sim.cjs plays the campaign against these numbers.
const BALANCE = {
  tierStep: 1.2,     // enemy HP and defense growth per chapter
  atkStep: 0.4,      // enemy attack growth per chapter
  sporeStep: 0.03,   // enemy stat growth per spore level
  maxEnemies: 4,
  act2Tier: 1,       // Act 2 resets the party, so its first chapter fights like this tier
  kitChance: 0.35,   // how often a boss with a kit uses an ability
  kitPower: 1,
  hpMul: 2.8,        // random enemies only; bosses use their dungeon's numbers
  atkMul: 2.3,
  attackMul: 2.5,    // the party's basic Attack hits for this many times its attack stat
  abilityMul: 1.3,
  areaMul: 0.6,      // share of an area ability's damage that each enemy takes
  encounterGrace: 12, // steps after a fight or a story scene with no random encounter
  encounterChance: 0.08,
  potionDrop: 0.35,  // chance a random fight also drops a Spore Potion
};
let stepsSinceFight = 0;

function makeEnemy(id, type, name, hp, attack, defense, speed) {
  return { id, name, type, hp, maxHp: hp, attack, defense, speed, status: null, skip: 0, poison: 0, poisonDmg: 0, phased: false, atkBuff: 0, atkBuffTurns: 0, kit: null };
}

function startCombat() {
  const typePool = ['slime', 'ghost', 'vine'];
  if (currentChapter >= 2) typePool.push('robot');
  if (currentChapter >= 3) typePool.push('void');
  if (currentChapter >= 5) typePool.push(...act2EnemyTypes);

  const tier = currentChapter <= 4 ? currentChapter : currentChapter - 4 + BALANCE.act2Tier;
  const enemyCount = 1 + Math.floor(Math.random() * Math.min(BALANCE.maxEnemies, 1 + tier));
  // HP and defense keep pace with party damage; attack grows more slowly, like party HP.
  const scale = 1 + (tier - 1) * BALANCE.tierStep + sporeLevel * BALANCE.sporeStep;
  const atkScale = 1 + (tier - 1) * BALANCE.atkStep + sporeLevel * BALANCE.sporeStep;
  const enemies = [];

  for (let i = 0; i < enemyCount; i++) {
    const type = typePool[Math.floor(Math.random() * typePool.length)];
    const hp = Math.floor((15 + Math.floor(Math.random() * 10)) * scale * BALANCE.hpMul);
    enemies.push(makeEnemy(
      'enemy_' + i,
      type,
      'Wild ' + (enemyNames[type] || type.charAt(0).toUpperCase() + type.slice(1)),
      hp,
      Math.floor((3 + Math.floor(Math.random() * 5)) * atkScale * BALANCE.atkMul),
      Math.floor((1 + Math.floor(Math.random() * 3)) * scale),
      2 + Math.floor(Math.random() * 4),
    ));
  }
  beginCombat(enemies, null);
}

function startDungeonBoss(dungeon) {
  const boss = makeEnemy('enemy_boss', dungeon.sprite || 'dragon', dungeon.boss, dungeon.bossHp, dungeon.bossAtk, dungeon.bossDef, 4);
  boss.kit = dungeon.kit || null;
  beginCombat([boss], dungeon);
  combatState.action = 'attack';
}

// Battle-only modifiers start fresh every fight; positions carry over.
function resetBattleMods(m, i) {
  m.hp = Math.max(0, m.hp);
  m.sp = m.sporePower;
  m.defBuff = 0; m.defBuffTurns = 0;
  m.overcharge = 0;
  m.atkDebuff = 0; m.atkDebuffTurns = 0;
  m.phased = false;
  m.skip = 0;
  if (m.gx === undefined) { m.gx = 2; m.gy = 1 + 2 * i; }
}

function beginCombat(enemies, dungeon) {
  clearTimeout(combatTimer);
  stepsSinceFight = 0;
  party.forEach(resetBattleMods);
  const all = [...party, ...enemies].map(a => ({ id: a.id, speed: a.speed }));
  all.sort((a, b) => b.speed - a.speed);
  combatState = {
    turn: 0,
    turnOrder: all.map(a => a.id),
    currentActor: '',
    enemies,
    message: `A wild ${enemies[0]?.name || 'enemy'} appears!`,
    gameOver: false,
    victory: false,
    action: 'idle',
    selectedAbility: 0,
    selectedItem: 0,
    target: 0,
    busy: true,
    isBoss: !!dungeon,
    dungeon,
    rewardGold: 0,
  };
  gameState = 'combat';
  later(nextTurn, 700);
}

function later(fn, ms) {
  if (instantCombat) { fn(); return; }
  clearTimeout(combatTimer);
  combatTimer = setTimeout(fn, ms);
}

function isEnemyId(id) { return id.startsWith('enemy_'); }
function actorById(id) { return isEnemyId(id) ? combatState.enemies.find(e => e.id === id) : party.find(m => m.id === id); }
function livingEnemies() { return combatState.enemies.filter(e => e.hp > 0); }
function livingParty() { return party.filter(m => m.hp > 0); }
function effAtk(m) { return Math.max(1, m.attack + m.overcharge - m.atkDebuff); }
function effDef(m) { return m.defense + m.defBuff; }

function nextTurn() {
  const cs = combatState;
  if (!cs || cs.gameOver || gameState !== 'combat') return;
  let idx = cs.turnOrder.indexOf(cs.currentActor);
  for (let n = 0; n < cs.turnOrder.length; n++) {
    idx = (idx + 1) % cs.turnOrder.length;
    if (idx === 0) endRound(cs);
    const a = actorById(cs.turnOrder[idx]);
    if (a && a.hp > 0) break;
  }
  cs.currentActor = cs.turnOrder[idx];
  const actor = actorById(cs.currentActor);
  if (isEnemyId(cs.currentActor)) {
    cs.busy = true;
    enemyTurn(actor);
    finishAction(700);
  } else if (actor.skip > 0) {
    actor.skip--;
    cs.busy = true;
    later(nextTurn, 600);
  } else {
    cs.busy = false;
  }
}

function endRound(cs) {
  cs.turn++;
  for (const m of party) {
    if (m.defBuffTurns > 0 && --m.defBuffTurns === 0) m.defBuff = 0;
    if (m.atkDebuffTurns > 0 && --m.atkDebuffTurns === 0) m.atkDebuff = 0;
  }
  for (const e of cs.enemies) {
    if (e.atkBuffTurns > 0 && --e.atkBuffTurns === 0) e.atkBuff = 0;
  }
}

function finishAction(delay) {
  const cs = combatState;
  if (!livingEnemies().length) {
    cs.victory = true;
    cs.gameOver = true;
    cs.message = 'Victory! All enemies defeated!';
    if (!cs.isBoss) {
      cs.rewardGold = Math.floor(Math.random() * 30 + 15);
      cs.rewardItem = Math.random() < BALANCE.potionDrop ? 'Spore Potion' : null;
    }
    return;
  }
  if (!livingParty().length) {
    cs.gameOver = true;
    cs.victory = false;
    cs.message = 'Your party has fallen...';
    return;
  }
  cs.busy = true;
  later(nextTurn, delay);
}

function currentTarget() {
  const cs = combatState;
  const alive = livingEnemies();
  if (!alive.length) return null;
  if (!(cs.enemies[cs.target]?.hp > 0)) cs.target = cs.enemies.indexOf(alive[0]);
  return cs.enemies[cs.target];
}

function cycleTarget(dir) {
  const cs = combatState;
  const alive = livingEnemies();
  if (!alive.length) return;
  const i = alive.indexOf(currentTarget());
  cs.target = cs.enemies.indexOf(alive[(i + dir + alive.length) % alive.length]);
}

function hitEnemy(e, dmg) {
  if (e.phased) { e.phased = false; return 0; }
  e.hp = Math.max(0, e.hp - dmg);
  return dmg;
}

function hitMember(m, dmg) {
  if (m.phased) { m.phased = false; return 0; }
  m.hp = Math.max(0, m.hp - dmg);
  return dmg;
}

function playerAttack(actor) {
  const cs = combatState;
  const target = currentTarget();
  if (!target) return;
  const dmg = hitEnemy(target, Math.max(1, Math.round(effAtk(actor) * BALANCE.attackMul) - target.defense + Math.floor(Math.random() * 6) - 2));
  actor.overcharge = 0;
  cs.message = actor.name + ' attacks ' + target.name + ' for ' + dmg + ' damage!';
  if (target.hp <= 0) cs.message += ' Defeated!';
  screenShake = 8;
  const p = enemyCenter(target);
  spawnParticles(p.x, p.y, 10, '255, 200, 100');
  finishAction(800);
}

// Ability power grows in step with the user's attack since the start of the game.
function abilityDamage(actor, ability, target) {
  const scale = Math.max(1, actor.attack - actor.atkDebuff) / (actor.baseAttack || actor.attack);
  const power = ability.power * scale * BALANCE.abilityMul * (ability.area ? BALANCE.areaMul : 1);
  return Math.max(1, Math.round(power) + actor.overcharge - target.defense + Math.floor(Math.random() * 4));
}

function canAfford(actor, ability) {
  return actor.sp >= ability.cost;
}

function playerAbility(actor, ability) {
  const cs = combatState;
  if (!canAfford(actor, ability)) return false;
  actor.sp -= ability.cost;
  if (ability.type === 'heal') {
    if (ability.share) {
      // Mycelium Link evens out everyone's share of their max HP before it heals.
      const living = livingParty();
      const frac = living.reduce((a, m) => a + m.hp / m.maxHp, 0) / living.length;
      living.forEach(m => { m.hp = Math.max(1, Math.round(frac * m.maxHp)); });
    }
    let healed = 0;
    for (const m of ability.self ? [actor] : party) {
      const before = m.hp;
      m.hp = ability.power ? Math.min(m.maxHp, m.hp + ability.power) : m.maxHp;
      healed = Math.max(healed, m.hp - before);
    }
    cs.message = actor.name + ' uses ' + ability.name + '! Heals ' + (ability.power || healed) + ' HP.';
    const p = memberCenter(actor);
    spawnParticles(p.x, p.y, 15, '155, 89, 182');
  } else if (ability.type === 'buff') {
    if (ability.boost === 'attack') actor.overcharge = 10;
    else party.forEach(m => { m.defBuff = 5; m.defBuffTurns = 3; });
    cs.message = actor.name + ' uses ' + ability.name + '! Stats boosted!';
    const p = memberCenter(actor);
    spawnParticles(p.x, p.y, 8, '241, 196, 15');
  } else if (!ability.power) {
    (ability.party ? party : [actor]).forEach(m => { m.phased = true; });
    cs.message = actor.name + ' uses ' + ability.name + '!';
    const p = memberCenter(actor);
    spawnParticles(p.x, p.y, 8, '52, 152, 219');
  } else {
    const targets = ability.area ? livingEnemies() : [currentTarget()];
    let total = 0;
    for (const t of targets) {
      const dmg = hitEnemy(t, abilityDamage(actor, ability, t));
      total += dmg;
      if (dmg && (ability.status === 'bind' || ability.status === 'stun')) t.skip = 1;
      if (dmg && ability.status === 'poison') { t.poison = 3; t.poisonDmg = Math.max(2, Math.floor(ability.power / 3)); }
      const p = enemyCenter(t);
      spawnParticles(p.x, p.y, ability.power > 20 ? 20 : 10, '46, 204, 113');
    }
    actor.overcharge = 0;
    cs.message = actor.name + ' uses ' + ability.name + '! ' + total + ' damage!';
    if (targets.some(t => t.hp <= 0)) cs.message += ' Defeated!';
    screenShake = ability.power > 20 ? 12 : 6;
  }
  finishAction(800);
  return true;
}

function playerItem() {
  const cs = combatState;
  if (!inventory.length) return;
  useItem(Math.min(cs.selectedItem, inventory.length - 1));
  cs.selectedItem = Math.max(0, Math.min(cs.selectedItem, inventory.length - 1));
  cs.message = 'Used item!';
  finishAction(800);
}

function playerFlee() {
  const cs = combatState;
  if (Math.random() < 0.5) {
    clearTimeout(combatTimer);
    cs.message = 'You fled successfully!';
    gameState = 'explore';
    return;
  }
  cs.message = 'Failed to flee!';
  finishAction(800);
}

// The party stands in columns 0-3; a move goes up to 2 tiles from where the turn began.
function moveStep(actor, dx, dy) {
  const cs = combatState;
  const nx = actor.gx + dx, ny = actor.gy + dy;
  if (nx < 0 || nx > 3 || ny < 0 || ny > 6) return;
  if (Math.abs(nx - cs.moveFrom.gx) + Math.abs(ny - cs.moveFrom.gy) > 2) return;
  if (party.some(m => m !== actor && m.gx === nx && m.gy === ny)) return;
  actor.gx = nx;
  actor.gy = ny;
}

// Members further forward draw more of the enemies' attacks.
function pickPartyTarget() {
  const alive = livingParty();
  const total = alive.reduce((a, m) => a + m.gx + 1, 0);
  let r = Math.random() * total;
  for (const m of alive) {
    r -= m.gx + 1;
    if (r < 0) return m;
  }
  return alive[alive.length - 1];
}

function enemyTurn(enemy) {
  const cs = combatState;
  if (enemy.poison > 0) {
    enemy.poison--;
    enemy.hp = Math.max(0, enemy.hp - enemy.poisonDmg);
    const p = enemyCenter(enemy);
    spawnParticles(p.x, p.y, 6, '46, 204, 113');
    if (enemy.hp <= 0) return;
  }
  if (enemy.skip > 0) { enemy.skip--; return; }
  const target = pickPartyTarget();
  if (!target) return;
  if (enemy.kit && Math.random() < BALANCE.kitChance) {
    const ability = pickKitAbility(enemy);
    if (ability) { enemyAbility(enemy, ability, target); return; }
  }
  const dmg = hitMember(target, Math.max(1, enemy.attack + enemy.atkBuff - effDef(target) + Math.floor(Math.random() * 6) - 2));
  cs.message = enemy.name + ' attacks ' + target.name + ' for ' + dmg + ' damage!';
  if (target.hp <= 0) cs.message += ' Fainted!';
  screenShake = 5;
  const p = memberCenter(target);
  spawnParticles(p.x, p.y, 5, '231, 76, 60');
}

function pickKitAbility(enemy) {
  const options = enemy.kit.filter(a =>
    (a.type !== 'heal' || enemy.hp < enemy.maxHp * 0.6) &&
    (a.type !== 'buff' || (!enemy.phased && !enemy.atkBuff)) &&
    (a.type !== 'debuff' || !party.some(m => m.atkDebuff)));
  return options.length ? options[Math.floor(Math.random() * options.length)] : null;
}

function enemyAbility(enemy, ability, target) {
  const cs = combatState;
  if (ability.type === 'heal') {
    const amount = ability.power || Math.floor(enemy.maxHp * 0.15);
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + amount);
    cs.message = enemy.name + ' uses ' + ability.name + '! Heals ' + amount + ' HP.';
    const p = enemyCenter(enemy);
    spawnParticles(p.x, p.y, 12, '155, 89, 182');
  } else if (ability.type === 'buff') {
    if (ability.boost === 'attack') { enemy.atkBuff = 8; enemy.atkBuffTurns = 3; } else enemy.phased = true;
    cs.message = enemy.name + ' uses ' + ability.name + '! Stats boosted!';
  } else if (ability.type === 'debuff') {
    party.forEach(m => { m.atkDebuff = 5; m.atkDebuffTurns = 3; });
    cs.message = enemy.name + ' uses ' + ability.name + '!';
  } else {
    const power = Math.round(ability.power * BALANCE.kitPower);
    const dmg = hitMember(target, Math.max(1, power + enemy.atkBuff - effDef(target) + Math.floor(Math.random() * 4)));
    if (dmg && ability.status === 'bind') target.skip = 1;
    if (ability.status === 'drain') enemy.hp = Math.min(enemy.maxHp, enemy.hp + dmg);
    if (ability.status === 'phased') enemy.phased = true;
    cs.message = enemy.name + ' uses ' + ability.name + '! ' + dmg + ' damage!';
    if (target.hp <= 0) cs.message += ' Fainted!';
    screenShake = 8;
    const p = memberCenter(target);
    spawnParticles(p.x, p.y, 12, '231, 76, 60');
  }
}

function endCombat() {
  const cs = combatState;
  clearTimeout(combatTimer);
  if (!cs.victory) {
    if (!restoreCheckpoint()) location.reload();
    return;
  }
  if (cs.isBoss) {
    const dungeon = cs.dungeon;
    visitedDungeons.add(dungeon.name);
    addItem(dungeon.reward, 'spore', 5);
    gold += Math.floor(Math.random() * 30 + 20);
    sporeLevel++;
    party.forEach(growMember);
    advanceChapter();
    saveCheckpoint();
  } else {
    gold += cs.rewardGold;
    if (cs.rewardItem) addItem(cs.rewardItem, 'potion', 20);
    gameState = 'explore';
  }
}

// A chapter ends when its last dungeon falls.
function advanceChapter() {
  const remaining = activeDungeons().some(d => d.chapter === currentChapter && !visitedDungeons.has(d.name));
  if (remaining) gameState = 'explore';
  else if (currentChapter === 4) gameState = 'gameover';
  else if (currentChapter === 8) gameState = 'act2ending';
  else { currentChapter++; storyIndex = 0; gameState = 'story'; }
}

function saveCheckpoint() {
  checkpoint = JSON.stringify({ party, inventory, gold, sporeLevel, visited: [...visitedDungeons], flags, playerX, playerY, currentChapter });
}

// A lost fight goes back to the start of the chapter or the last boss beaten.
function restoreCheckpoint() {
  if (!checkpoint) return false;
  const c = JSON.parse(checkpoint);
  party = c.party;
  inventory = c.inventory;
  gold = c.gold;
  sporeLevel = c.sporeLevel;
  visitedDungeons = new Set(c.visited);
  flags = c.flags;
  playerX = c.playerX;
  playerY = c.playerY;
  currentChapter = c.currentChapter;
  stepsSinceFight = 0;
  combatState = null;
  gameState = 'explore';
  return true;
}

// === RENDERING ===
function drawText(text, x, y, size, color, maxW, center) {
  ctx.fillStyle = color || '#ffffff';
  ctx.font = (size || 12) + 'px monospace';
  ctx.textAlign = center ? 'center' : 'left';

  const lines = (text || '').split('\n');
  const lh = (size || 12) + 4;

  lines.forEach((line, i) => {
    let ly = y + i * lh;
    if (maxW) {
      const words = line.split(' ');
      let cw = '';
      for (const w of words) {
        const tw = cw + w + ' ';
        if (ctx.measureText(tw).width > maxW && cw) {
          ctx.fillText(cw.trim(), x, ly);
          cw = w + ' ';
          ly += lh;
        } else cw = tw;
      }
      ctx.fillText(cw.trim(), x, ly);
    } else {
      ctx.fillText(line, x, ly);
    }
  });
}

// Each sprite is painted to a small canvas once and reused every frame.
const spriteCanvases = new WeakMap();

function drawSpriteAt(sx, sy, data, scale) {
  if (!data || !data.length) return;
  scale = scale || TILE;
  let tc = spriteCanvases.get(data);
  if (!tc) {
    tc = document.createElement('canvas');
    tc.width = 8; tc.height = 8;
    const tctx = tc.getContext('2d');
    for (let i = 0; i < 64; i++) {
      const px = i % 8, py = Math.floor(i / 8);
      const c = data[i];
      if (c && c !== '#0a0a14') { tctx.fillStyle = c; tctx.fillRect(px, py, 1, 1); }
    }
    spriteCanvases.set(data, tc);
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tc, sx, sy, scale, scale);
}

function drawHpBar(x, y, hp, maxHp, width) {
  const bw = (width || TILE) - 2;
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(x + 1, y, bw, 3);
  ctx.fillStyle = hp > maxHp * 0.5 ? '#2ecc71' : hp > maxHp * 0.25 ? '#e8c547' : '#e74c3c';
  ctx.fillRect(x + 1, y, Math.max(0, (hp / maxHp) * bw), 3);
}

function drawSpBar(x, y, sp, maxSp, width) {
  const bw = (width || TILE) - 2;
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(x + 1, y, bw, 2);
  ctx.fillStyle = '#3498db';
  ctx.fillRect(x + 1, y, Math.max(0, (sp / Math.max(1, maxSp)) * bw), 2);
}

// === COMBAT LAYOUT ===
const CT = 32;
const COMBAT_GRID = { w: 10, h: 7, ox: 40, oy: 14 };
const ENEMY_SLOTS = [[6, 1], [6, 3], [6, 5], [8, 2], [8, 4]];

function enemyCell(e) {
  const cs = combatState;
  if (cs.isBoss) return { x: 6, y: 2, size: 2 };
  const s = ENEMY_SLOTS[cs.enemies.indexOf(e) % ENEMY_SLOTS.length];
  return { x: s[0], y: s[1], size: 1 };
}

function cellScreen(x, y) {
  return { sx: COMBAT_GRID.ox + x * CT, sy: COMBAT_GRID.oy + y * CT };
}

function enemyCenter(e) {
  const c = enemyCell(e);
  const { sx, sy } = cellScreen(c.x, c.y);
  return { x: sx + c.size * CT / 2, y: sy + c.size * CT / 2 };
}

function memberCenter(m) {
  const { sx, sy } = cellScreen(m.gx, m.gy);
  return { x: sx + CT / 2, y: sy + CT / 2 };
}

// Small colored marks on a sprite's top edge for each active effect.
function drawStatusPips(sx, sy, size, a) {
  const pips = [];
  if (a.skip > 0) pips.push('#f1c40f');
  if (a.poison > 0) pips.push('#2ecc71');
  if (a.phased) pips.push('#5dade2');
  if (a.defBuff > 0) pips.push('#bdc3c7');
  if (a.overcharge > 0 || a.atkBuff > 0) pips.push('#e67e22');
  if (a.atkDebuff > 0) pips.push('#8e44ad');
  pips.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(sx + size - 5 - i * 6, sy + 2, 4, 4);
  });
}

function drawOutline(sx, sy, size, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(sx + 1, sy + 1, size - 2, size - 2);
}

// Item list in a box whose bottom edge sits at bottomY.
function drawItemBox(bottomY, selected) {
  const rows = Math.min(6, inventory.length);
  const h = inventory.length ? 12 + rows * 13 + 18 : 28;
  const top = bottomY - h;
  ctx.fillStyle = 'rgba(10, 10, 20, 0.92)';
  ctx.fillRect(0, top, W, h);
  ctx.strokeStyle = '#2ecc71';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, top + 0.5, W - 1, h - 1);
  if (!inventory.length) {
    drawText('No items!', 10, top + 18, 10, '#888888', W - 20);
    return;
  }
  const first = Math.max(0, Math.min(selected - 2, inventory.length - rows));
  for (let r = 0; r < rows; r++) {
    const i = first + r;
    const y = top + 14 + r * 13;
    if (i === selected) {
      ctx.fillStyle = 'rgba(46, 204, 113, 0.25)';
      ctx.fillRect(6, y - 10, W - 12, 13);
    }
    drawText(inventory[i].name, 12, y, 10, i === selected ? '#2ecc71' : '#7fa88a', W - 24);
  }
  drawText('[Enter] use item | Esc: cancel', 10, top + h - 6, 9, '#888888', W - 20);
}

// === TITLE SCREEN ===
function drawTitle() {
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, W, H);

  // Stars with twinkle
  for (let i = 0; i < 40; i++) {
    const x = ((i * 73 + gameTime * 0.01) % W);
    const y = ((i * 137 + Math.sin(gameTime * 0.001 + i) * 20) % H);
    const twinkle = Math.sin(gameTime * 0.003 + i * 0.5) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(${150 + i % 100}, ${100 + i % 50}, ${200 + i % 55}, ${twinkle * 0.6})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Vignette effect
  const gradient = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.7);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  drawText('SPORE-WEAVER', W/2, 90, 36, '#e8c547', W, true);

  drawSpriteAt(125, 145, spriteData.beetle, 32);
  drawSpriteAt(215, 145, spriteData.myco, 32);

  // Floating spores
  for (let i = 0; i < 8; i++) {
    const x = 50 + ((gameTime * 0.02 + i * 40) % 300);
    const y = 200 + Math.sin(gameTime * 0.003 + i) * 30;
    ctx.fillStyle = `rgba(46, 204, 113, ${0.3 + Math.sin(gameTime * 0.005 + i) * 0.2})`;
    ctx.fillRect(x, y, 3, 3);
  }

  drawText('Press any key to begin', W/2, 300, 14, '#ffffff', W, true);
  drawText('(Arrow keys to move, Enter to confirm)', W/2, 325, 11, '#888888', W, true);
  drawText('Chapters: ' + Object.keys(storyLines).length + ' | Spores: ' + sporeLevel, W/2, 370, 10, '#555555', W, true);
}

// === STORY SCREEN ===
function storyLinesFor() {
  if (secretLine) return [secretLine];
  return currentChapter >= 5 ? act2StoryLines[currentChapter] : storyLines[currentChapter];
}

// Matches the word wrap in drawText.
function wrappedLineCount(text, size, maxW) {
  ctx.font = size + 'px monospace';
  let count = 1, cw = '';
  for (const w of text.split(' ')) {
    const tw = cw + w + ' ';
    if (ctx.measureText(tw).width > maxW && cw) { count++; cw = w + ' '; } else cw = tw;
  }
  return count;
}

function drawStory() {
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, W, H);

  const lines = storyLinesFor();
  if (!lines) return;

  if (!secretLine) drawText('Chapter ' + currentChapter, W/2, 20, 16, '#e8c547', W, true);

  // The current line sits above the hints; earlier lines stack upward, dimmed.
  const cur = lines[Math.min(storyIndex, lines.length - 1)];
  const curText = cur.text.replace(/\n/g, ' ');
  const boxH = 38 + (wrappedLineCount(curText, 11, W - 50) - 1) * 15;
  const boxTop = H - 48 - boxH;
  ctx.fillStyle = 'rgba(10, 10, 20, 0.8)';
  ctx.fillRect(10, boxTop, W - 20, boxH);
  drawText(cur.speaker + ':', 15, boxTop + 14, 12, cur.color || '#9b59b6', W - 30);
  drawText(curText, 20, boxTop + 30, 11, '#cccccc', W - 50);

  let y = boxTop - 6;
  for (let i = Math.min(storyIndex, lines.length) - 1; i >= 0; i--) {
    const ev = lines[i];
    const text = ev.text.replace(/\n/g, ' ');
    const h = 32 + (wrappedLineCount(text, 9, W - 50) - 1) * 13;
    if (y - h < 34) break;
    y -= h;
    drawText(ev.speaker + ':', 15, y + 12, 10, ev.color || '#666666', W - 30);
    drawText(text, 20, y + 26, 9, '#888888', W - 50);
  }

  drawText('[' + storyIndex + '/' + lines.length + ' lines]', W/2, H - 30, 11, '#666666', W, true);
  drawText('Enter: next line | Space: skip', W/2, H - 12, 10, '#555555', W, true);
}

// === EXPLORE SCREEN ===
function drawExplore() {
  const vr = 7;
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, W, H);

  const centerX = Math.floor(W / 2);
  const centerY = 50 + Math.floor(H * 0.35);

  // Fog of war
  for (let dy = -vr; dy <= vr; dy++) {
    for (let dx = -vr; dx <= vr; dx++) {
      const tx = playerX + dx;
      const ty = playerY + dy;

      if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) continue;

      const sx = centerX + dx * TILE;
      const sy = centerY + dy * TILE;

      if (sx < -TILE || sx > W || sy < -TILE || sy > H) continue;

      const tileInfo = map[ty]?.[tx];
      if (!tileInfo) continue;

      const type = tileInfo.type;
      const key = 'terrain_' + type;
      const terrain = terrainSprites[key];
      if (terrain) drawSpriteAt(sx, sy, terrain, TILE);

      // Secrets
      if (tileInfo.secret) {
        const secretKey = 'secret_' + tileInfo.secret;
        const secret = terrainSprites[secretKey];
        if (secret) drawSpriteAt(sx, sy, secret, TILE);
      }

      // Dungeon markers
      for (const d of activeDungeons()) {
        if (d.x === tx && d.y === ty && dungeonOpen(d)) {
          ctx.fillStyle = 'rgba(232, 197, 71, 0.4)';
          ctx.fillRect(sx - 2, sy - 2, TILE + 4, TILE + 4);
        }
      }

      // Player highlight
      if (dx === 0 && dy === 0) {
        ctx.fillStyle = 'rgba(232, 197, 71, 0.3)';
        ctx.fillRect(sx, sy, TILE, TILE);
      }
    }
  }

  // Draw player and companions
  drawSpriteAt(centerX - 8, centerY - 4, spriteData.beetle, 16);
  drawSpriteAt(centerX + 4, centerY - 4, spriteData.myco, 16);
  if (party.find(m => m.id === 'cogsworth')) {
    drawSpriteAt(centerX - 2, centerY + 10, spriteData.fox, 12);
  }

  // HUD
  const stats = party.reduce((a, m) => {
    a.hp += m.hp; a.mhp += m.maxHp; a.atk += m.attack; a.def += m.defense; a.sp += m.sporePower;
    return a;
  }, { hp: 0, mhp: 0, atk: 0, def: 0, sp: 0 });

  drawText('Chapter ' + currentChapter, 10, 15, 13, '#e8c547', W - 20);
  drawText('HP: ' + stats.hp + '/' + stats.mhp + ' ATK:' + stats.atk + ' DEF:' + stats.def + ' SPK:' + stats.sp, 10, H - 35, 11, '#cccccc', W - 20);
  drawText('Gold: ' + gold + ' | Spores: ' + sporeLevel + ' | Items: ' + inventory.length, 10, H - 20, 10, '#888888', W - 20);

  const tileInfo = map[playerY]?.[playerX];
  if (tileInfo?.type === 'crystal') {
    drawText('[Enter] Rest at Crystal - Heal + Spore Level Up!', 10, H - 5, 10, '#3498db', W - 20);
  } else if (tileInfo?.secret) {
    const secretNames = { mural: 'Ancient Mural', graffiti: 'Graffiti', carving: 'Stone Carving', statue: 'Broken Statue' };
    drawText('[Enter] Examine ' + (secretNames[tileInfo.secret] || 'secret'), 10, H - 5, 10, '#e8c547', W - 20);
  } else {
    drawText('Arrows: Move | Enter: Interact | I: Inventory', 10, H - 5, 9, '#666666', W - 20);
  }

  // Minimap
  const mmx = W - 85, mmy = 30, mmw = 80, mmh = 80;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(mmx - 2, mmy - 2, mmw + 4, mmh + 4);
  ctx.strokeStyle = '#9b59b6';
  ctx.lineWidth = 1;
  ctx.strokeRect(mmx - 2, mmy - 2, mmw + 4, mmh + 4);

  const mmScale = mmw / MAP_W;
  const biomeColors = {
    grass: '#2ecc71', forest: '#1e8449', desert: '#f1c40f',
    crystal: '#3498db', ruin: '#95a5a6', metal: '#7f8c8d',
    water: '#2980b9', lava: '#e74c3c', void: '#8e44ad',
    mushroom: '#a569bd', hollow: '#2c2c3c'
  };
  for (let my = 0; my < MAP_H; my++) {
    for (let mx = 0; mx < MAP_W; mx++) {
      const tile = map[my]?.[mx];
      if (tile) {
        ctx.fillStyle = biomeColors[tile.type] || '#333';
        ctx.fillRect(mmx + mx * mmScale, mmy + my * mmScale, Math.ceil(mmScale), Math.ceil(mmScale));
      }
    }
  }
  ctx.fillStyle = '#e8c547';
  ctx.fillRect(mmx + playerX * mmScale - 1, mmy + playerY * mmScale - 1, 3, 3);
  for (const d of activeDungeons()) {
    if (dungeonOpen(d)) {
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(mmx + d.x * mmScale - 1, mmy + d.y * mmScale - 1, 3, 3);
    }
  }
  drawText('MAP', mmx + mmw/2, mmy + mmh + 10, 8, '#888888', mmw, true);

  // Vignette
  const gradient = ctx.createRadialGradient(W/2, H/2, H*0.4, W/2, H/2, H*0.7);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  if (exploreInventory) drawItemBox(H - 50, inventoryIndex);
}

// === COMBAT SCREEN ===
function drawCombat() {
  const cs = combatState;
  if (!cs) return;

  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, W, H);

  const g = COMBAT_GRID;
  const playerTurn = !cs.gameOver && !cs.busy && !isEnemyId(cs.currentActor);
  const actor = playerTurn ? actorById(cs.currentActor) : null;

  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const { sx, sy } = cellScreen(x, y);
      if ((x + y) % 5 === 0) {
        const terrain = terrainSprites['terrain_crystal'];
        if (terrain) drawSpriteAt(sx, sy, terrain, CT);
      } else {
        ctx.fillStyle = '#050510';
        ctx.fillRect(sx, sy, CT, CT);
      }
      if (actor && cs.action === 'move' && x <= 3 &&
          Math.abs(x - cs.moveFrom.gx) + Math.abs(y - cs.moveFrom.gy) <= 2 &&
          !party.some(m => m !== actor && m.gx === x && m.gy === y)) {
        ctx.fillStyle = 'rgba(232, 197, 71, 0.18)';
        ctx.fillRect(sx, sy, CT, CT);
      }
      ctx.strokeStyle = '#1a1a3a';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, sy, CT, CT);
    }
  }

  // Enemies
  const aiming = actor && (cs.action === 'attack' ||
    (cs.action === 'ability' && actor.abilities[cs.selectedAbility]?.power > 0 && actor.abilities[cs.selectedAbility].type !== 'heal'));
  const aimed = aiming ? currentTarget() : null;
  const area = aiming && cs.action === 'ability' && actor.abilities[cs.selectedAbility].area;
  for (const e of cs.enemies) {
    if (e.hp <= 0) continue;
    const c = enemyCell(e);
    const { sx, sy } = cellScreen(c.x, c.y);
    const size = c.size * CT;
    drawSpriteAt(sx, sy, spriteData[e.type] || spriteData.slime, size);
    drawHpBar(sx, sy - 5, e.hp, e.maxHp, size);
    drawStatusPips(sx, sy, size, e);
    if (e === aimed || (area && aimed)) drawOutline(sx, sy, size, '#e74c3c');
    if (e.id === cs.currentActor && !cs.gameOver) drawOutline(sx, sy, size, '#e8c547');
  }

  // Party
  party.forEach(m => {
    if (m.hp <= 0) return;
    const { sx, sy } = cellScreen(m.gx, m.gy);
    const sprite = spriteData[m.spriteKey];
    if (sprite) drawSpriteAt(sx, sy, sprite, CT);
    drawHpBar(sx, sy - 6, m.hp, m.maxHp, CT);
    drawSpBar(sx, sy - 3, m.sp, m.sporePower, CT);
    drawStatusPips(sx, sy, CT, m);
    if (m.id === cs.currentActor && !cs.gameOver) drawOutline(sx, sy, CT, '#e8c547');
  });

  // Message box
  ctx.fillStyle = 'rgba(10, 10, 20, 0.9)';
  ctx.fillRect(0, H - 95, W, 95);
  ctx.strokeStyle = '#9b59b6';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, H - 95, W, 95);

  drawText(cs.message, 10, H - 74, 14, '#e8c547', W - 20);
  const order = cs.turnOrder.map(actorById).filter(a => a && a.hp > 0).map(a => a.name.replace(/^Wild /, ''));
  drawText('Turn: ' + order.join(' > '), 10, H - 25, 11, '#888888', W - 20);

  // Action menu
  if (playerTurn) {
    ctx.fillStyle = 'rgba(10, 10, 20, 0.8)';
    ctx.fillRect(0, H - 120, W, 24);
    drawText('[M]ove [A]ttack [B]ilities [F]lee [I]tems', 10, H - 103, 11, '#cccccc', W - 20);

    // Ability submenu
    if (cs.action === 'ability') {
      const ability = actor.abilities[cs.selectedAbility];
      ctx.fillStyle = 'rgba(10, 10, 20, 0.85)';
      ctx.fillRect(0, H - 156, W, 34);
      ctx.strokeStyle = '#e8c547';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, H - 155.5, W - 1, 33);
      if (ability) {
        const ok = canAfford(actor, ability);
        drawText(ability.name + ': ' + ability.desc, 10, H - 140, 11, ok ? '#e8c547' : '#666666', W - 80);
        ctx.font = '11px monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = ok ? '#3498db' : '#666666';
        ctx.fillText(ability.cost + ' SPK', W - 10, H - 140);
        ctx.textAlign = 'left';
      }
      drawText('[Up/Down] select | Enter: use | Esc: cancel', 10, H - 127, 9, '#888888', W - 20);
    }

    // Inventory submenu
    if (cs.action === 'inventory') drawItemBox(H - 121, cs.selectedItem);
  }

  if (cs.gameOver) {
    ctx.fillStyle = 'rgba(5, 5, 16, 0.75)';
    ctx.fillRect(0, H/2 - 75, W, 135);
    drawText(cs.victory ? 'VICTORY!' : 'DEFEAT...', W/2, H/2 - 40, 28, cs.victory ? '#2ecc71' : '#e74c3c', W, true);
    if (cs.victory) {
      const reward = cs.dungeon ? cs.dungeon.reward : 'Gold: ' + cs.rewardGold;
      drawText('Reward: ' + reward, W/2, H/2, 14, '#e8c547', W, true);
      if (cs.rewardItem) drawText('Reward: ' + cs.rewardItem, W/2, H/2 + 20, 14, '#e8c547', W, true);
      drawText('Press Enter to continue', W/2, H/2 + 45, 14, '#cccccc', W, true);
    } else {
      drawText('Press Enter to restart', W/2, H/2 + 25, 14, '#cccccc', W, true);
    }
  }

  // Vignette
  const gradient = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.7);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
}

// === GAME OVER ===
function drawGameOver() {
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, W, H);

  // Stars with subtle movement
  for (let i = 0; i < 40; i++) {
    const x = ((i * 73 + gameTime * 0.003) % W);
    const y = ((i * 137 + Math.sin(gameTime * 0.0008 + i) * 15) % H);
    const twinkle = Math.sin(gameTime * 0.002 + i * 0.7) * 0.3 + 0.4;
    ctx.fillStyle = `rgba(${150 + i % 100}, ${100 + i % 50}, ${200 + i % 55}, ${twinkle})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Vignette
  const gradient = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.7);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  drawText('The Eternal Bloom has been planted.', W/2, 80, 18, '#2ecc71', W, true);
  drawText('The garden blooms eternal.', W/2, 115, 16, '#e8c547', W, true);
  drawText('But the garden was never real.', W/2, 155, 16, '#9b59b6', W, true);
  drawText('It was a seed.', W/2, 185, 18, '#e74c3c', W, true);

  drawText('Buphila, Myco, and Cogsworth', W/2, 230, 12, '#9b59b6', W, true);
  drawText('lived inside the spore. Now it cracks open.', W/2, 250, 12, '#9b59b6', W, true);

  if (!act2Started) {
    drawText('Press Enter to open the spore', W/2, 300, 14, '#e8c547', W, true);
    drawText('(Act 2: The Outside — A continuation of the story)', W/2, 330, 11, '#888888', W, true);
  } else {
    drawText('The seed has opened. The journey continues...', W/2, 300, 14, '#e8c547', W, true);
  }

  drawText('Spores collected: ' + sporeLevel + ' | Gold: ' + gold, W/2, 360, 11, '#666666', W, true);
}

// === ACT 2 SCREEN ===
function drawAct2Intro() {
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, W, H);

  // Stars with purple tint for Act 2
  for (let i = 0; i < 50; i++) {
    const x = ((i * 73 + gameTime * 0.005) % W);
    const y = ((i * 137 + Math.sin(gameTime * 0.001 + i) * 20) % H);
    const twinkle = Math.sin(gameTime * 0.003 + i * 0.5) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(${150 + i % 100}, ${50 + i % 50}, ${200 + i % 55}, ${twinkle * 0.6})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Vignette
  const gradient = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.7);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  drawText('THE OUTSIDE', W/2, 100, 28, '#9b59b6', W, true);
  drawText('Act 2', W/2, 140, 20, '#7e209a', W, true);

  // Floating spores in different colors
  for (let i = 0; i < 12; i++) {
    const x = 50 + ((gameTime * 0.015 + i * 30) % 300);
    const y = 200 + Math.sin(gameTime * 0.004 + i * 0.8) * 40;
    const colors = ['46, 204, 113', '155, 89, 182', '52, 152, 219', '231, 76, 60'];
    ctx.fillStyle = `rgba(${colors[i % colors.length]}, ${0.3 + Math.sin(gameTime * 0.006 + i) * 0.2})`;
    ctx.fillRect(x, y, 3, 3);
  }

  drawText('The garden cracks. Light pours in.', W/2, 280, 14, '#e8c547', W, true);
  drawText('Something vast and strange awaits beyond the spore.', W/2, 310, 12, '#95a5a6', W, true);
  drawText('Press Enter to begin Act 2', W/2, 350, 14, '#cccccc', W, true);
}

function drawAct2Ending() {
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, W, H);

  // Golden stars
  for (let i = 0; i < 60; i++) {
    const x = ((i * 73 + gameTime * 0.004) % W);
    const y = ((i * 137 + Math.sin(gameTime * 0.0008 + i) * 25) % H);
    const twinkle = Math.sin(gameTime * 0.002 + i * 0.5) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(232, ${180 + i % 75}, ${71 + i % 50}, ${twinkle * 0.5})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Golden vignette
  const gradient = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.7);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  drawText('THE BLOOMING', W/2, 80, 28, '#e8c547', W, true);
  drawText('Act 2 Complete', W/2, 120, 18, '#2ecc71', W, true);

  drawText('They reached the Bloom Gate.', W/2, 180, 14, '#e8c547', W, true);
  drawText('They became everything.', W/2, 210, 14, '#9b59b6', W, true);

  drawText('Buphila. Myco. Cogsworth.', W/2, 260, 16, '#e8c547', W, true);
  drawText('They are in every spore now. In every garden.', W/2, 290, 12, '#95a5a6', W, true);
  drawText('On quiet nights, you can hear them singing.', W/2, 320, 12, '#95a5a6', W, true);

  drawText('Press Enter to begin a new journey', W/2, 370, 14, '#cccccc', W, true);
  drawText('Spores collected: ' + sporeLevel + ' | Gold: ' + gold, W/2, 390, 11, '#666666', W, true);
}

// === REALITY PUZZLE SCREEN ===
function drawPuzzle() {
  if (!puzzleState) return;

  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, W, H);

  drawText('REALITY PUZZLE', W/2, 20, 16, '#9b59b6', W, true);
  drawText(puzzleState.message, W/2, 45, 12, '#cccccc', W, true);

  if (puzzleState.type === 'reality') {
    // Reality anchor puzzle: rotate anchors to match target
    const ax = W/2 - 80, ay = 70;
    for (let i = 0; i < 3; i++) {
      const x = ax + i * 65;
      // Draw anchor circle
      ctx.strokeStyle = puzzleState.anchors[i] === puzzleState.target[i] ? '#2ecc71' : '#9b59b6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + 20, ay + 20, 20, 0, Math.PI * 2);
      ctx.stroke();
      // Draw rotation indicator
      const angle = puzzleState.anchors[i] * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(x + 20, ay + 20);
      ctx.lineTo(x + 20 + Math.cos(angle) * 15, ay + 20 + Math.sin(angle) * 15);
      ctx.stroke();
      // Label
      drawText('Anchor ' + (i+1), x + 20, ay + 60, 10, i === puzzleCursor.x ? '#e8c547' : '#888888', 40, true);
    }
    drawText('Click an anchor to rotate it. Match all targets!', W/2, 170, 11, '#888888', W, true);
    drawText('Moves: ' + puzzleState.moves + '/' + puzzleState.maxMoves, W/2, 195, 11, '#e8c547', W, true);
  } else if (puzzleState.type === 'spore') {
    // Spore pattern matching puzzle
    const gridSize = 4;
    const tileSize = 30;
    const ox = W/2 - (gridSize * tileSize) / 2;
    const oy = 60;
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const sx = ox + x * tileSize;
        const sy = oy + y * tileSize;
        const idx = y * gridSize + x;
        const filled = puzzleState.pattern[idx];
        ctx.fillStyle = filled ? 'rgba(155, 89, 182, 0.5)' : '#1a1a2e';
        ctx.fillRect(sx + 2, sy + 2, tileSize - 4, tileSize - 4);
        ctx.strokeStyle = '#9b59b6';
        ctx.strokeRect(sx + 2, sy + 2, tileSize - 4, tileSize - 4);
      }
    }
    drawText('Click the tiles below to match the pattern above.', W/2, oy + gridSize * tileSize + 20, 11, '#888888', W, true);
    const g = PUZZLE_LAYOUT.sporeGrid;
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const sx = g.ox + x * g.size;
        const sy = g.oy + y * g.size;
        ctx.fillStyle = puzzleState.current[y * gridSize + x] ? '#9b59b6' : '#1a1a2e';
        ctx.fillRect(sx + 2, sy + 2, g.size - 4, g.size - 4);
        ctx.strokeStyle = x === puzzleCursor.x && y === puzzleCursor.y ? '#e8c547' : '#9b59b6';
        ctx.strokeRect(sx + 2, sy + 2, g.size - 4, g.size - 4);
      }
    }
  } else if (puzzleState.type === 'phase') {
    // Phase grid puzzle
    const gridSize = 5;
    const tileSize = 28;
    const ox = W/2 - (gridSize * tileSize) / 2;
    const oy = 60;
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const sx = ox + x * tileSize;
        const sy = oy + y * tileSize;
        const isWall = puzzleState.walls.includes(x + ',' + y);
        const isGoal = x === puzzleState.goalX && y === puzzleState.goalY;
        const isPlayer = x === puzzleState.playerX && y === puzzleState.playerY;

        if (isPlayer) {
          ctx.fillStyle = '#2ecc71';
          ctx.fillRect(sx + 2, sy + 2, tileSize - 4, tileSize - 4);
        } else if (isGoal) {
          ctx.fillStyle = '#e8c547';
          ctx.fillRect(sx + 2, sy + 2, tileSize - 4, tileSize - 4);
        } else if (isWall) {
          ctx.fillStyle = '#4a1f6e';
          ctx.fillRect(sx + 2, sy + 2, tileSize - 4, tileSize - 4);
        } else {
          ctx.fillStyle = '#0f0f1e';
          ctx.fillRect(sx + 2, sy + 2, tileSize - 4, tileSize - 4);
        }
        ctx.strokeStyle = '#1a1a3a';
        ctx.strokeRect(sx + 2, sy + 2, tileSize - 4, tileSize - 4);
      }
    }
    drawText('Arrow keys to move. Reach the golden tile!', W/2, oy + gridSize * tileSize + 20, 11, '#888888', W, true);
    drawText('Moves: ' + puzzleState.moves + '/' + puzzleState.maxMoves, W/2, oy + gridSize * tileSize + 40, 11, '#e8c547', W, true);
  }

  // Vignette
  const gradient = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.7);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
}

// === SPORE WEAVING MINIGAME SCREEN ===
function drawSporeWeave() {
  if (!sporeWeaveState) return;

  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, W, H);

  drawText('SPORE WEAVING', W/2, 20, 16, '#2ecc71', W, true);
  drawText('Pattern ' + sporeWeaveState.level + '/' + sporeWeaveState.maxLevel, W/2, 45, 12, '#888888', W, true);
  drawText(sporeWeaveState.message, W/2, 65, 10, '#cccccc', W, true);

  const gridSize = sporeWeaveState.gridSize;
  const tileSize = PUZZLE_LAYOUT.weaveGrid.size;
  const ox = W/2 - (gridSize * tileSize) / 2;
  const oy = 90;

  // Target pattern
  drawText('TARGET', ox, oy - 10, 10, '#666666', 40);
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const sx = ox + x * tileSize;
      const sy = oy + y * tileSize;
      const color = ['#2ecc71', '#9b59b6', '#3498db'][sporeWeaveState.target[y][x]];
      ctx.fillStyle = color;
      ctx.fillRect(sx + 2, sy + 2, tileSize - 4, tileSize - 4);
      ctx.strokeStyle = '#333';
      ctx.strokeRect(sx + 2, sy + 2, tileSize - 4, tileSize - 4);
    }
  }

  // Current pattern
  const currentY = oy + gridSize * tileSize + 20;
  drawText('YOURS', ox, currentY - 10, 10, '#666666', 40);
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const sx = ox + x * tileSize;
      const sy = currentY + y * tileSize;
      const color = ['#2ecc71', '#9b59b6', '#3498db'][sporeWeaveState.current[y][x]];
      ctx.fillStyle = color;
      ctx.fillRect(sx + 2, sy + 2, tileSize - 4, tileSize - 4);
      ctx.strokeStyle = x === puzzleCursor.x && y === puzzleCursor.y ? '#e8c547' : '#333';
      ctx.strokeRect(sx + 2, sy + 2, tileSize - 4, tileSize - 4);
    }
  }

  drawText('Click your pattern to cycle colors.', W/2, currentY + gridSize * tileSize + 20, 11, '#888888', W, true);
  drawText('Match the target to progress.', W/2, currentY + gridSize * tileSize + 38, 11, '#888888', W, true);

  // Vignette
  const gradient = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.7);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
}

// === INPUT ===
function endStory() {
  storyIndex = 0;
  if (secretLine) {
    secretLine = null;
    clearTimeout(secretTimer);
    gameState = 'explore';
    return;
  }
  if (currentChapter === 2) joinCogsworth();
  gameState = 'explore';
  stepsSinceFight = 0;
  saveCheckpoint();
}

function combatKey(k) {
  const cs = combatState;
  if (!cs) return;
  if (cs.gameOver) {
    if (k === 'Enter') endCombat();
    return;
  }
  if (cs.busy || isEnemyId(cs.currentActor)) return;
  const actor = actorById(cs.currentActor);

  if (cs.action === 'move') {
    const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[k];
    if (dir) moveStep(actor, dir[0], dir[1]);
    else if (k === 'Enter') { cs.action = 'idle'; finishAction(300); }
    else if (k === 'Escape') {
      actor.gx = cs.moveFrom.gx; actor.gy = cs.moveFrom.gy;
      cs.action = 'idle';
      cs.message = 'What will you do?';
    }
    return;
  }

  if (k === 'a' || k === 'A') {
    cs.action = 'attack';
    cs.message = 'Select an enemy to attack.';
  } else if (k === 'b' || k === 'B') {
    cs.action = 'ability';
    cs.message = 'Select an ability:';
  } else if (k === 'i' || k === 'I') {
    cs.action = 'inventory';
    cs.message = 'Select an item:';
  } else if (k === 'm' || k === 'M') {
    cs.action = 'move';
    cs.moveFrom = { gx: actor.gx, gy: actor.gy };
    cs.message = 'Move to a tile.';
  } else if (k === 'f' || k === 'F') {
    playerFlee();
  } else if (k === 'ArrowUp' || k === 'w') {
    if (cs.action === 'ability') cs.selectedAbility = Math.max(0, cs.selectedAbility - 1);
    if (cs.action === 'inventory') cs.selectedItem = Math.max(0, cs.selectedItem - 1);
  } else if (k === 'ArrowDown' || k === 's') {
    if (cs.action === 'ability') cs.selectedAbility = Math.min(actor.abilities.length - 1, cs.selectedAbility + 1);
    if (cs.action === 'inventory') cs.selectedItem = Math.max(0, Math.min(inventory.length - 1, cs.selectedItem + 1));
  } else if (k === 'ArrowLeft' || k === 'ArrowRight') {
    cycleTarget(k === 'ArrowLeft' ? -1 : 1);
  } else if (k === 'Enter') {
    if (cs.action === 'attack') playerAttack(actor);
    else if (cs.action === 'ability' && actor.abilities[cs.selectedAbility]) playerAbility(actor, actor.abilities[cs.selectedAbility]);
    else if (cs.action === 'inventory') playerItem();
  } else if (k === 'Escape') {
    cs.action = 'idle';
    cs.message = 'What will you do?';
  }
}

function exploreKey(k) {
  if (exploreInventory) {
    if (k === 'ArrowUp' || k === 'w') inventoryIndex = Math.max(0, inventoryIndex - 1);
    else if (k === 'ArrowDown' || k === 's') inventoryIndex = Math.max(0, Math.min(inventory.length - 1, inventoryIndex + 1));
    else if (k === 'Enter' && inventory.length) {
      useItem(inventoryIndex);
      inventoryIndex = Math.max(0, Math.min(inventoryIndex, inventory.length - 1));
    } else if (k === 'Escape' || k === 'i' || k === 'I') exploreInventory = false;
    return;
  }
  if (k === 'i' || k === 'I') {
    exploreInventory = true;
    inventoryIndex = 0;
    return;
  }

  let dx = 0, dy = 0;
  if (k === 'ArrowUp' || k === 'w') dy = -1;
  if (k === 'ArrowDown' || k === 's') dy = 1;
  if (k === 'ArrowLeft' || k === 'a') dx = -1;
  if (k === 'ArrowRight' || k === 'd') dx = 1;

  if (dx !== 0 || dy !== 0) {
    const nx = playerX + dx, ny = playerY + dy;
    if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H) {
      const tile = map[ny]?.[nx];
      if (tile && tile.type !== 'water' && tile.type !== 'lava') {
        playerX = nx; playerY = ny;
        stepsSinceFight++;
        if (stepsSinceFight > BALANCE.encounterGrace && Math.random() < BALANCE.encounterChance) {
          startCombat();
        }
      }
    }
  }

  if (k === 'Enter') {
    for (const d of activeDungeons()) {
      if (playerX === d.x && playerY === d.y && dungeonOpen(d)) {
        if (d.puzzle && !solvedPuzzles.has(d.name)) startDungeonPuzzle(d);
        else startDungeonBoss(d);
        return;
      }
    }
    // Rest at crystal tiles; the spore level rises once per chapter.
    if (map[playerY]?.[playerX]?.type === 'crystal') {
      party.forEach(m => { m.hp = m.maxHp; });
      if (flags.rested !== currentChapter) {
        sporeLevel++;
        flags.rested = currentChapter;
      }
    }
    // Secrets
    if (map[playerY]?.[playerX]?.secret) {
      const secretTexts = {
        mural: 'You find an ancient mural. It depicts a beetle girl fighting a dragon. The ending is different from yours...',
        graffiti: 'Fresh graffiti: "THE GARDEN WILL BURN. - The Hollow One"',
        carving: 'A stone carving reads: "In the beginning, there was only the spore. And the spore was good." - but then there\'s a second line scratched out.',
        statue: 'A broken statue. In its hand: a spore crown. It looks familiar...',
      };
      const secret = map[playerY][playerX].secret;
      if (!flags['secret_' + secret]) {
        flags['secret_' + secret] = true;
        secretLine = { speaker: 'Narrator', text: secretTexts[secret] || 'You find something interesting.', color: '#e8c547' };
        storyIndex = 0;
        gameState = 'story';
        clearTimeout(secretTimer);
        secretTimer = setTimeout(() => { if (secretLine && gameState === 'story') endStory(); }, 6000);
        return;
      }
    }
    // Random encounters
    if (Math.random() < 0.1) {
      gold += 10;
      if (Math.random() < 0.5) {
        addItem('Spore Potion', 'potion', 20);
      }
    }
  }
}

document.addEventListener('keydown', (e) => {
  e.preventDefault();
  const k = e.key;

  if (gameState === 'title') {
    initParty();
    generateMap();
    playerX = 20; playerY = 20;
    gameState = 'story';
    storyIndex = 0;
    return;
  }

  if (gameState === 'story') {
    const lines = storyLinesFor();
    if (!lines) return;
    if (k === 'Enter' || k === ' ') {
      storyIndex = k === ' ' ? lines.length : storyIndex + 1;
      if (storyIndex >= lines.length) endStory();
    }
    return;
  }

  if (gameState === 'combat') { combatKey(k); return; }
  if (gameState === 'puzzle') { puzzleKey(e); return; }
  if (gameState === 'explore') { exploreKey(k); return; }

  if (gameState === 'gameover') {
    if (k === 'Enter') gameState = 'act2intro';
    return;
  }

  if (gameState === 'act2intro') {
    if (k === 'Enter') {
      initAct2Party();
      generateAct2Map();
      playerX = 0; playerY = 0;
      currentChapter = 5;
      storyIndex = 0;
      act2Started = true;
      gameState = 'story';
    }
    return;
  }

  if (gameState === 'act2ending') {
    if (k === 'Enter') location.reload();
  }
});

canvas.addEventListener('click', (e) => {
  if (gameState !== 'puzzle') return;
  const r = canvas.getBoundingClientRect();
  puzzleClick((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height);
});

// === PARTICLES ===
function spawnParticles(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4 - 1,
      size: 2 + Math.random() * 3,
      life: 20 + Math.floor(Math.random() * 20),
      maxLife: 40,
      color,
    });
  }
}

// === GAME LOOP ===
function gameLoop(timestamp) {
  gameTime = timestamp || 0;
  animFrame++;

  particles = particles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    p.vy += 0.05;
    return p.life > 0;
  });

  if (screenShake > 0) screenShake--;

  if (fittedTo !== window.innerWidth + 'x' + window.innerHeight + '@' + (window.devicePixelRatio || 1)) fitCanvas();
  ctx.setTransform(viewScale, 0, 0, viewScale, 0, 0);
  ctx.save();
  if (screenShake > 0) {
    const shakeX = (Math.random() - 0.5) * screenShake * 2;
    const shakeY = (Math.random() - 0.5) * screenShake * 2;
    ctx.translate(shakeX, shakeY);
  }

  if (gameState === 'title') drawTitle();
  else if (gameState === 'story') drawStory();
  else if (gameState === 'explore') drawExplore();
  else if (gameState === 'combat') drawCombat();
  else if (gameState === 'gameover') drawGameOver();
  else if (gameState === 'act2intro') drawAct2Intro();
  else if (gameState === 'act2ending') drawAct2Ending();
  else if (gameState === 'puzzle') { if (sporeWeaveState) drawSporeWeave(); else drawPuzzle(); }

  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.fillStyle = `rgba(${p.color}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
