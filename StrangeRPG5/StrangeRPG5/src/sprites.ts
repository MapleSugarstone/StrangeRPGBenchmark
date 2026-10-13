// Procedural sprite generator for 8x8 tiles with max 3 colors!
// Black is the first color of every palette and draws as transparent.

export type Color = string;
export type Sprite = Color[][]; // 8x8 grid of colors

export const CLEAR = '#000000';

// Color palettes! Black + 2 colors max per sprite!
const PALETTES: Record<string, [string, string, string]> = {
  hero: [CLEAR, '#66ccff', '#ffffff'],
  warrior: [CLEAR, '#ff4444', '#ffffff'],
  mage: [CLEAR, '#aa00ff', '#ffff00'],
  slime: [CLEAR, '#00ffff', '#ffffff'],
  ghost: [CLEAR, '#ffffff', '#aa00ff'],
  robot: [CLEAR, '#aaaaaa', '#ff4444'],
  dragon: [CLEAR, '#ff0000', '#ffff00'],
  crystal: [CLEAR, '#00ffff', '#ffffff'],
  void: [CLEAR, '#6a2a99', '#ff66ff'],
  door: [CLEAR, '#884422', '#ffcc00'],
};

// Shapes: '.' is black, 'a' is the first color, 'b' is the second
const SHAPES: Record<string, string[]> = {
  hero: [
    '..aaaa..',
    '.aaaaaa.',
    '.abaaba.',
    '.aaaaaa.',
    '..bbbb..',
    '.aaaaaa.',
    '..a..a..',
    '..a..a..',
  ],
  warrior: [
    '.b.bb.b.',
    '.aaaaaa.',
    '.a.aa.a.',
    '.aaaaaa.',
    'bbaaaabb',
    '.aaaaaa.',
    '..a..a..',
    '.aa..aa.',
  ],
  mage: [
    '....b...',
    '...aa...',
    '..aaaa..',
    '.aaaaaa.',
    '..b..b..',
    '.aaaaaa.',
    '.aaaaaa.',
    'aaaaaaaa',
  ],
  ghost: [
    '..aaaa..',
    '.aaaaaa.',
    '.abaaba.',
    '.aaaaaa.',
    '.aaaaaa.',
    '.aaaaaa.',
    '.a.aa.a.',
    '........',
  ],
  void: [
    'a......a',
    '.a.aa.a.',
    '..aaaa..',
    'aabaabaa',
    '..aaaa..',
    '.a.aa.a.',
    'a......a',
    '........',
  ],
  crystal: [
    '..b..b..',
    '.aaaaaa.',
    '.abaaba.',
    '.aaaaaa.',
    'aaaaaaaa',
    'a.aaaa.a',
    '..a..a..',
    '.aa..aa.',
  ],
  robot: [
    '.a....a.',
    '.aaaaaa.',
    '.abaaba.',
    '.aaaaaa.',
    '..aaaa..',
    '.aaaaaa.',
    '.a.aa.a.',
    '.b....b.',
  ],
  slime: [
    '........',
    '...aa...',
    '..aaaa..',
    '.abaaba.',
    '.aaaaaa.',
    'aaaaaaaa',
    'aaaaaaaa',
    '........',
  ],
  dragon: [
    'a......a',
    'aa.aa.aa',
    'aaaaaaaa',
    '.abaaba.',
    '..aaaa..',
    '...bb...',
    '........',
    '........',
  ],
  door: [
    '.bbbbbb.',
    '.aaaaaa.',
    '.aabbaa.',
    '.ab..ba.',
    '.aabbaa.',
    '.aaaaab.',
    '.aaaaaa.',
    '.aaaaaa.',
  ],
};

// Generate a sprite based on entity type and seed!
export function generateSprite(type: string, seed: number): Sprite {
  const palette = PALETTES[type] || [CLEAR, '#ffffff', '#ffff00'];
  const [black, color1, color2] = palette;
  const shape = SHAPES[type];
  if (shape) {
    return shape.map(row => [...row].map(c => (c === 'a' ? color1 : c === 'b' ? color2 : black)));
  }
  // Unknown types get a mirrored random shape from the seed
  let s = seed | 0 || 1;
  const rand = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const sprite: Sprite = Array(8).fill(null).map(() => Array(8).fill(black));
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 4; x++) {
      const r = rand();
      const c = r > 0.75 ? color2 : r > 0.4 ? color1 : black;
      sprite[y][x] = c;
      sprite[y][7 - x] = c;
    }
  }
  return sprite;
}

export function drawSprite(ctx: CanvasRenderingContext2D, sprite: Sprite, x: number, y: number, scale: number) {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const c = sprite[row][col];
      if (c === CLEAR) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
    }
  }
}
