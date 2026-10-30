// === Sprite Engine ===
// Generates 8x8 procedural sprites with max 3 colors.

export type Color = string;

export type Sprite = {
  data: Color[]; // 64 entries
  colors: Color[]; // unique colors used (max 3)
};

export type Palette = {
  bg: Color; // background/outline
  primary: Color; // main body
  accent: Color; // highlight/detail
};

// Seeded random for reproducible sprites
export function createRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function rngChoice<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// Draw helpers for 8x8 grid
function fill(data: Color[], color: Color): void {
  for (let i = 0; i < 64; i++) data[i] = color;
}

function setPixel(data: Color[], x: number, y: number, c: Color): void {
  if (x < 0 || x >= 8 || y < 0 || y >= 8) return;
  data[y * 8 + x] = c;
}

function drawRect(data: Color[], x0: number, y0: number, w: number, h: number, c: Color): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      setPixel(data, x, y, c);
    }
  }
}

function drawCircle(data: Color[], cx: number, cy: number, r: number, c: Color): void {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) setPixel(data, x, y, c);
    }
  }
}

function drawDiamond(data: Color[], cx: number, cy: number, r: number, c: Color): void {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      if (dx + dy <= r) setPixel(data, x, y, c);
    }
  }
}

// ---- Sprite generators ----

export function generateBeetleGirl(seed: number): Sprite {
  const rng = createRng(seed);
  const pal: Palette = { bg: '#1a1a2e', primary: '#4a7c59', accent: '#e8c547' };
  const data: Color[] = new Array(64).fill(pal.bg);

  // Shell (large oval body)
  drawCircle(data, 3, 5, 3, pal.primary);
  drawCircle(data, 4, 5, 2, pal.accent);

  // Head
  drawCircle(data, 3, 2, 2, pal.primary);

  // Eyes
  setPixel(data, 2, 2, pal.bg);
  setPixel(data, 4, 2, pal.bg);

  // Antennae
  setPixel(data, 2, 1, pal.accent);
  setPixel(data, 1, 0, pal.accent);
  setPixel(data, 4, 1, pal.accent);
  setPixel(data, 5, 0, pal.accent);

  // Legs (small dashes)
  setPixel(data, 1, 6, pal.primary);
  setPixel(data, 0, 7, pal.primary);
  setPixel(data, 6, 6, pal.primary);
  setPixel(data, 7, 7, pal.primary);

  // Shell pattern
  setPixel(data, 3, 5, pal.bg);
  setPixel(data, 4, 4, pal.bg);

  return { data, colors: [pal.bg, pal.primary, pal.accent] };
}

export function generateMushroom(seed: number): Sprite {
  const rng = createRng(seed);
  const pal: Palette = { bg: '#1a1a2e', primary: '#9b59b6', accent: '#e0aaff' };
  const data: Color[] = new Array(64).fill(pal.bg);

  // Cap
  drawCircle(data, 4, 1, 3, pal.primary);
  drawCircle(data, 4, 1, 1, pal.accent);

  // Dots on cap
  setPixel(data, 2, 1, pal.accent);
  setPixel(data, 6, 2, pal.accent);
  setPixel(data, 5, 0, pal.accent);

  // Stem
  drawRect(data, 3, 3, 2, 3, pal.primary);

  // Eyes (friendly)
  setPixel(data, 3, 2, pal.bg);
  setPixel(data, 5, 2, pal.bg);

  // Tiny smile
  setPixel(data, 3, 3, pal.bg);
  setPixel(data, 4, 3, pal.bg);
  setPixel(data, 5, 3, pal.bg);

  // Feet
  setPixel(data, 2, 6, pal.primary);
  setPixel(data, 6, 6, pal.primary);

  return { data, colors: [pal.bg, pal.primary, pal.accent] };
}

export function generateClockworkFox(seed: number): Sprite {
  const pal: Palette = { bg: '#1a1a2e', primary: '#c0392b', accent: '#f39c12' };
  const data: Color[] = new Array(64).fill(pal.bg);

  // Body
  drawDiamond(data, 4, 5, 2, pal.primary);

  // Head
  drawCircle(data, 4, 2, 2, pal.primary);

  // Ears (pointy)
  setPixel(data, 2, 1, pal.primary);
  setPixel(data, 2, 0, pal.primary);
  setPixel(data, 6, 1, pal.primary);
  setPixel(data, 6, 0, pal.primary);

  // Inner ear
  setPixel(data, 2, 1, pal.accent);
  setPixel(data, 6, 1, pal.accent);

  // Gear eye
  drawCircle(data, 4, 2, 1, pal.accent);

  // Tail (curved)
  setPixel(data, 6, 5, pal.accent);
  setPixel(data, 7, 4, pal.accent);
  setPixel(data, 7, 3, pal.accent);
  setPixel(data, 6, 2, pal.accent);

  // Legs
  setPixel(data, 3, 7, pal.primary);
  setPixel(data, 5, 7, pal.primary);

  return { data, colors: [pal.bg, pal.primary, pal.accent] };
}

export function generateClockworkDragon(seed: number): Sprite {
  const pal: Palette = { bg: '#1a1a2e', primary: '#7f8c8d', accent: '#e74c3c' };
  const data: Color[] = new Array(64).fill(pal.bg);

  // Body (large)
  drawDiamond(data, 4, 4, 3, pal.primary);

  // Inner gears
  drawDiamond(data, 4, 4, 2, pal.accent);
  drawDiamond(data, 4, 4, 1, pal.bg);

  // Head
  drawCircle(data, 4, 1, 2, pal.primary);

  // Eyes (menacing)
  setPixel(data, 3, 1, pal.accent);
  setPixel(data, 5, 1, pal.accent);

  // Horns
  setPixel(data, 2, 0, pal.accent);
  setPixel(data, 6, 0, pal.accent);

  // Wings
  setPixel(data, 0, 3, pal.accent);
  setPixel(data, 0, 2, pal.primary);
  setPixel(data, 7, 3, pal.accent);
  setPixel(data, 7, 2, pal.primary);

  // Tail
  setPixel(data, 2, 7, pal.primary);
  setPixel(data, 1, 7, pal.accent);

  // Legs
  setPixel(data, 2, 6, pal.primary);
  setPixel(data, 6, 6, pal.primary);

  return { data, colors: [pal.bg, pal.primary, pal.accent] };
}

// Generic tile generator for terrain
export function generateTerrain(type: string, seed: number): Sprite {
  const rng = createRng(seed);
  const palettes: Record<string, Palette> = {
    grass: { bg: '#1a1a2e', primary: '#2ecc71', accent: '#27ae60' },
    desert: { bg: '#1a1a2e', primary: '#f1c40f', accent: '#e67e22' },
    crystal: { bg: '#1a1a2e', primary: '#3498db', accent: '#9b59b6' },
    ruin: { bg: '#1a1a2e', primary: '#95a5a6', accent: '#7f8c8d' },
    space: { bg: '#1a1a2e', primary: '#2c3e50', accent: '#ecf0f1' },
    water: { bg: '#1a1a2e', primary: '#3498db', accent: '#5dade2' },
    lava: { bg: '#1a1a2e', primary: '#e74c3c', accent: '#f39c12' },
    metal: { bg: '#1a1a2e', primary: '#7f8c8d', accent: '#bdc3c7' },
  };

  const pal = palettes[type] ?? palettes.ruin;
  const data: Color[] = new Array(64).fill(pal.bg);

  // Base fill
  fill(data, pal.primary);

  // Detail pattern based on seed
  const pattern = Math.floor(rng() * 6);

  if (pattern === 0) {
    // Diagonal lines
    for (let i = 0; i < 8; i++) setPixel(data, i, i, pal.accent);
  } else if (pattern === 1) {
    // Checkerboard
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if ((x + y) % 2 === 0) setPixel(data, x, y, pal.accent);
      }
    }
  } else if (pattern === 2) {
    // Cross
    drawRect(data, 3, 0, 2, 8, pal.accent);
    drawRect(data, 0, 3, 8, 2, pal.accent);
  } else if (pattern === 3) {
    // Dots
    for (let y = 1; y < 8; y += 3) {
      for (let x = 1; x < 8; x += 3) {
        drawCircle(data, x, y, 1, pal.accent);
      }
    }
  } else if (pattern === 4) {
    // Border
    drawRect(data, 0, 0, 8, 1, pal.accent);
    drawRect(data, 0, 7, 8, 1, pal.accent);
    drawRect(data, 0, 0, 1, 8, pal.accent);
    drawRect(data, 7, 0, 1, 8, pal.accent);
  } else {
    // Scattered noise
    for (let i = 0; i < 8; i++) {
      const x = Math.floor(rng() * 8);
      const y = Math.floor(rng() * 8);
      setPixel(data, x, y, pal.accent);
    }
  }

  return { data, colors: [pal.bg, pal.primary, pal.accent] };
}

// Entity tile generator
export function generateEntity(type: string, seed: number): Sprite {
  const pal: Palette = { bg: '#1a1a2e', primary: '#e74c3c', accent: '#e8c547' };
  const data: Color[] = new Array(64).fill(pal.bg);

  if (type === 'slime') {
    drawCircle(data, 4, 6, 3, pal.primary);
    drawCircle(data, 4, 4, 2, pal.accent);
    setPixel(data, 3, 5, pal.bg);
    setPixel(data, 5, 5, pal.bg);
  } else if (type === 'ghost') {
    drawCircle(data, 4, 3, 3, pal.primary);
    drawRect(data, 3, 6, 2, 2, pal.primary);
    drawRect(data, 5, 6, 2, 2, pal.primary);
    setPixel(data, 3, 2, pal.bg);
    setPixel(data, 5, 2, pal.bg);
  } else if (type === 'vine') {
    drawRect(data, 3, 0, 2, 8, pal.primary);
    setPixel(data, 2, 2, pal.accent);
    setPixel(data, 5, 4, pal.accent);
    setPixel(data, 2, 6, pal.accent);
  } else {
    // Generic monster
    drawCircle(data, 4, 4, 3, pal.primary);
    setPixel(data, 3, 3, pal.bg);
    setPixel(data, 5, 3, pal.bg);
    setPixel(data, 4, 6, pal.accent);
  }

  return { data, colors: [pal.bg, pal.primary, pal.accent] };
}

// Item generator
export function generateItem(type: string, seed: number): Sprite {
  const pal: Palette = { bg: '#1a1a2e', primary: '#e8c547', accent: '#e8c547' };
  const data: Color[] = new Array(64).fill(pal.bg);

  if (type === 'chest') {
    drawRect(data, 1, 3, 6, 4, pal.primary);
    drawRect(data, 1, 3, 6, 2, pal.accent);
    drawCircle(data, 4, 5, 1, pal.bg);
  } else if (type === 'potion') {
    drawRect(data, 3, 2, 2, 4, pal.primary);
    drawCircle(data, 4, 4, 2, pal.accent);
    drawRect(data, 3, 0, 2, 2, pal.bg);
  } else {
    // Generic sparkle
    drawDiamond(data, 4, 4, 2, pal.primary);
    setPixel(data, 4, 0, pal.accent);
    setPixel(data, 4, 7, pal.accent);
    setPixel(data, 0, 4, pal.accent);
    setPixel(data, 7, 4, pal.accent);
  }

  return { data, colors: [pal.bg, pal.primary, pal.accent] };
}
