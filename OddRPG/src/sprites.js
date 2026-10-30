// === Sprite Engine ===
// Generates 8x8 procedural sprites with max 3 colors.

export function createRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Generate beetle girl sprite
export function generateBeetleGirl(seed = 42) {
  const data = new Array(64).fill('#1a1a2e');
  const fill = (x, y, c) => { if (x >= 0 && x < 8 && y >= 0 && y < 8) data[y * 8 + x] = c; };

  // Shell body
  fill(2, 4, '#4a7c59'); fill(3, 4, '#4a7c59'); fill(4, 4, '#4a7c59'); fill(5, 4, '#4a7c59');
  fill(1, 5, '#4a7c59'); fill(2, 5, '#4a7c59'); fill(3, 5, '#e8c547'); fill(4, 5, '#e8c547');
  fill(5, 5, '#4a7c59'); fill(6, 5, '#4a7c59');
  fill(1, 6, '#4a7c59'); fill(2, 6, '#4a7c59'); fill(3, 6, '#1a1a2e'); fill(4, 6, '#1a1a2e');
  fill(5, 6, '#4a7c59'); fill(6, 6, '#4a7c59');

  // Head
  fill(2, 2, '#4a7c59'); fill(3, 2, '#4a7c59'); fill(4, 2, '#4a7c59'); fill(5, 2, '#4a7c59');
  fill(2, 3, '#4a7c59'); fill(3, 3, '#4a7c59'); fill(4, 3, '#4a7c59'); fill(5, 3, '#4a7c59');

  // Eyes
  fill(3, 2, '#1a1a2e'); fill(4, 3, '#1a1a2e');

  // Antennae
  fill(2, 1, '#e8c547'); fill(1, 0, '#e8c547');
  fill(5, 1, '#e8c547'); fill(6, 0, '#e8c547');

  // Legs
  fill(1, 6, '#4a7c59'); fill(0, 7, '#4a7c59');
  fill(6, 6, '#4a7c59'); fill(7, 7, '#4a7c59');

  // Shell line
  fill(3, 5, '#1a1a2e'); fill(4, 4, '#1a1a2e');

  return data;
}

// Generate mushroom sprite
export function generateMushroom(seed = 43) {
  const data = new Array(64).fill('#1a1a2e');
  const fill = (x, y, c) => { if (x >= 0 && x < 8 && y >= 0 && y < 8) data[y * 8 + x] = c; };

  // Cap
  fill(2, 0, '#9b59b6'); fill(3, 0, '#9b59b6'); fill(4, 0, '#9b59b6'); fill(5, 0, '#9b59b6');
  fill(1, 1, '#9b59b6'); fill(2, 1, '#9b59b6'); fill(3, 1, '#e0aaff'); fill(4, 1, '#9b59b6');
  fill(5, 1, '#9b59b6'); fill(6, 1, '#9b59b6');

  // Dots
  fill(2, 1, '#e0aaff'); fill(6, 2, '#e0aaff');

  // Stem
  fill(3, 2, '#9b59b6'); fill(4, 2, '#9b59b6');
  fill(3, 3, '#9b59b6'); fill(4, 3, '#9b59b6');
  fill(3, 4, '#9b59b6'); fill(4, 4, '#9b59b6');
  fill(3, 5, '#9b59b6'); fill(4, 5, '#9b59b6');

  // Eyes
  fill(3, 2, '#1a1a2e'); fill(5, 2, '#1a1a2e');

  // Smile
  fill(3, 3, '#1a1a2e'); fill(4, 3, '#1a1a2e');

  // Feet
  fill(2, 6, '#9b59b6'); fill(6, 6, '#9b59b6');

  return data;
}

// Generate clockwork fox
export function generateClockworkFox(seed = 44) {
  const data = new Array(64).fill('#1a1a2e');
  const fill = (x, y, c) => { if (x >= 0 && x < 8 && y >= 0 && y < 8) data[y * 8 + x] = c; };

  // Body
  fill(3, 4, '#c0392b'); fill(4, 4, '#c0392b');
  fill(2, 5, '#c0392b'); fill(3, 5, '#c0392b'); fill(4, 5, '#f39c12'); fill(5, 5, '#c0392b');
  fill(3, 6, '#c0392b'); fill(4, 6, '#c0392b');

  // Head
  fill(2, 2, '#c0392b'); fill(3, 2, '#c0392b'); fill(4, 2, '#c0392b'); fill(5, 2, '#c0392b');
  fill(3, 3, '#c0392b'); fill(4, 3, '#c0392b');

  // Ears
  fill(2, 1, '#c0392b'); fill(2, 0, '#c0392b'); fill(6, 1, '#c0392b'); fill(6, 0, '#c0392b');
  fill(2, 1, '#f39c12'); fill(6, 1, '#f39c12');

  // Eye (gear)
  fill(3, 2, '#f39c12');

  // Tail
  fill(6, 5, '#f39c12'); fill(7, 4, '#f39c12'); fill(7, 3, '#f39c12'); fill(6, 2, '#f39c12');

  // Legs
  fill(3, 7, '#c0392b'); fill(5, 7, '#c0392b');

  return data;
}

// Generate clockwork dragon
export function generateClockworkDragon(seed = 45) {
  const data = new Array(64).fill('#1a1a2e');
  const fill = (x, y, c) => { if (x >= 0 && x < 8 && y >= 0 && y < 8) data[y * 8 + x] = c; };

  // Body
  fill(2, 3, '#7f8c8d'); fill(3, 3, '#7f8c8d'); fill(4, 3, '#7f8c8d'); fill(5, 3, '#7f8c8d');
  fill(1, 4, '#7f8c8d'); fill(2, 4, '#e74c3c'); fill(3, 4, '#7f8c8d'); fill(4, 4, '#e74c3c');
  fill(5, 4, '#7f8c8d'); fill(6, 4, '#7f8c8d');
  fill(2, 5, '#7f8c8d'); fill(3, 5, '#7f8c8d'); fill(4, 5, '#7f8c8d'); fill(5, 5, '#7f8c8d');
  fill(3, 6, '#7f8c8d'); fill(4, 6, '#7f8c8d');

  // Head
  fill(2, 1, '#7f8c8d'); fill(3, 1, '#7f8c8d'); fill(4, 1, '#7f8c8d'); fill(5, 1, '#7f8c8d');
  fill(2, 2, '#7f8c8d'); fill(3, 2, '#7f8c8d'); fill(4, 2, '#7f8c8d'); fill(5, 2, '#7f8c8d');

  // Eyes
  fill(3, 1, '#e74c3c'); fill(5, 2, '#e74c3c');

  // Horns
  fill(2, 0, '#e74c3c'); fill(6, 0, '#e74c3c');

  // Wings
  fill(0, 3, '#e74c3c'); fill(0, 2, '#7f8c8d');
  fill(7, 3, '#e74c3c'); fill(7, 2, '#7f8c8d');

  // Legs
  fill(2, 6, '#7f8c8d'); fill(6, 6, '#7f8c8d');

  // Tail
  fill(1, 7, '#e74c3c');

  return data;
}

// Terrain tile
export function generateTerrain(type, seed = 0) {
  const data = new Array(64).fill('#1a1a2e');
  const fill = (x, y, c) => { if (x >= 0 && x < 8 && y >= 0 && y < 8) data[y * 8 + x] = c; };

  const palettes = {
    grass:    { primary: '#2ecc71', accent: '#27ae60' },
    forest:   { primary: '#1e8449', accent: '#27ae60' },
    desert:   { primary: '#f1c40f', accent: '#e67e22' },
    crystal:  { primary: '#3498db', accent: '#9b59b6' },
    ruin:     { primary: '#95a5a6', accent: '#7f8c8d' },
    metal:    { primary: '#7f8c8d', accent: '#bdc3c7' },
    water:    { primary: '#3498db', accent: '#5dade2' },
    lava:     { primary: '#e74c3c', accent: '#f39c12' },
  };

  const pal = palettes[type] || palettes.ruin;

  // Base
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      fill(x, y, y % 2 === 0 ? pal.primary : pal.accent);
    }
  }

  return data;
}

// Entity enemy
export function generateEntity(type) {
  const data = new Array(64).fill('#1a1a2e');
  const fill = (x, y, c) => { if (x >= 0 && x < 8 && y >= 0 && y < 8) data[y * 8 + x] = c; };

  if (type === 'slime') {
    for (let x = 2; x <= 6; x++) fill(x, 5, '#2ecc71');
    for (let x = 2; x <= 5; x++) fill(x, 6, '#2ecc71');
    for (let x = 3; x <= 4; x++) fill(x, 4, '#27ae60');
    fill(3, 4, '#1a1a2e'); fill(4, 4, '#1a1a2e');
  } else if (type === 'ghost') {
    for (let x = 2; x <= 6; x++) fill(x, 2, '#bdc3c7');
    for (let x = 2; x <= 5; x++) fill(x, 3, '#bdc3c7');
    for (let x = 3; x <= 4; x++) fill(x, 1, '#bdc3c7');
    fill(3, 2, '#1a1a2e'); fill(4, 2, '#1a1a2e');
    for (let y = 4; y <= 6; y++) { fill(3, y, '#bdc3c7'); fill(4, y, '#bdc3c7'); }
  } else {
    // Generic
    for (let y = 2; y <= 6; y++) {
      for (let x = 2; x <= 5; x++) fill(x, y, '#e74c3c');
    }
    fill(3, 3, '#1a1a2e'); fill(4, 3, '#1a1a2e');
    fill(4, 5, '#f39c12');
  }

  return data;
}

// Draw sprite to canvas context
export function drawSpriteToCanvas(ctx, canvas, data, x, y, scale = 16) {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 8;
  tempCanvas.height = 8;
  const tempCtx = tempCanvas.getContext('2d');

  for (let i = 0; i < 64; i++) {
    const px = i % 8;
    const py = Math.floor(i / 8);
    const color = data[i];
    if (color && color !== '#1a1a2e') {
      tempCtx.fillStyle = color;
      tempCtx.fillRect(px, py, 1, 1);
    }
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tempCanvas, x, y, scale, scale);
}
