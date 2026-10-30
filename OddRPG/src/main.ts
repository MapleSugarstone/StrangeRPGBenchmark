// === Main Game ===

import { generateBeetleGirl, generateMushroom, generateClockworkFox, generateClockworkDragon, generateEntity, generateTerrain, generateItem } from './sprites';
import { chapter1, chapter2, story } from './story';
import { party, createBuphila, createMyco, createCogsworth, getPartyStats, joinParty } from './party';
import { startCombat, selectAction, performAttack, getGridForCombat, getEnemies, getCombatMessage, isCombatActive, getTurnOrder, getCurrentActor, advanceGameState, getPartyHp, CombatState } from './combat';
import { generateWorldMap, movePlayer, checkMapEvents, WorldMap } from './world';

// === Game State ===
let currentState: CombatState = { phase: 'explore' };
let worldMap: WorldMap;
let currentChapter = 1;
let storyIndex = 0;
let showStory = false;
let gameState: 'title' | 'story' | 'explore' | 'combat' | 'gameover' = 'title';
let combatAction = 'move';
let selectedAbility = 0;
let lastStoryLine = 0;

// Canvas
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const SCREEN_W = 400;
const SCREEN_H = 400;
const TILE_SIZE = 16; // Scale 8x8 sprites to 16x16
const SPRITE_SCALE = 2;

// Pre-generate sprites
const sprites: Record<string, Uint8ClampedArray> = {};

function createSpriteFromData(data: string[], width: number, height: number): Uint8ClampedArray {
  const img = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const color = data[y * 8 + x];
      if (color) {
        const r = parseInt(color.slice(1, 3), 16) || 0;
        const g = parseInt(color.slice(3, 5), 16) || 0;
        const b = parseInt(color.slice(5, 7), 16) || 0;
        img[idx] = r;
        img[idx + 1] = g;
        img[idx + 2] = b;
        img[idx + 3] = 255;
      }
    }
  }
  return img;
}

function drawSprite(x: number, y: number, data: string[]): void {
  const scaledX = x * TILE_SIZE;
  const scaledY = y * TILE_SIZE;

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // Draw to offscreen canvas for scaling
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 8;
  tempCanvas.height = 8;
  const tempCtx = tempCanvas.getContext('2d')!;

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
  ctx.drawImage(tempCanvas, scaledX, scaledY, TILE_SIZE, TILE_SIZE);
  ctx.restore();
}

function drawText(text: string, x: number, y: number, size: number, color: string, maxWidth: number, center: boolean = false): void {
  ctx.fillStyle = color;
  ctx.font = `${size}px monospace`;
  ctx.textAlign = center ? 'center' : 'left';

  const lines = text.split('\n');
  const lineHeight = size + 4;

  lines.forEach((line, i) => {
    const lineY = y + i * lineHeight;
    if (center) {
      ctx.textAlign = 'center';
      ctx.fillText(line, x, lineY);
    } else {
      // Word wrap
      const words = line.split(' ');
      let currentLine = '';
      let currentX = center ? x : x;

      words.forEach((word) => {
        const testLine = currentLine + word + ' ';
        if (ctx.measureText(testLine).width > maxWidth && currentLine) {
          ctx.fillText(currentLine.trim(), currentX, lineY);
          currentLine = word + ' ';
        } else {
          currentLine = testLine;
        }
      });
      ctx.fillText(currentLine.trim(), currentX, lineY);
    }
  });
}

// Title screen
function drawTitleScreen(): void {
  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // Animated spores
  const time = Date.now() / 1000;
  for (let i = 0; i < 20; i++) {
    const x = (Math.sin(time + i * 0.5) * 0.5 + 0.5) * SCREEN_W;
    const y = (Math.cos(time * 0.7 + i * 0.3) * 0.5 + 0.5) * SCREEN_H;
    ctx.fillStyle = `hsla(${120 + i * 10}, 70%, 60%, 0.3)`;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Title
  drawText('ODD RPG', SCREEN_W / 2, 80, 32, '#e8c547', SCREEN_W, true);
  drawText('A Spore-Weaver\'s Tale', SCREEN_W / 2, 120, 14, '#9b59b6', SCREEN_W, true);

  // Draw Buphila and Myco
  drawSprite(11, 10, generateBeetleGirl(42).data);
  drawSprite(14, 10, generateMushroom(43).data);

  // Instructions
  drawText('Press any key to begin', SCREEN_W / 2, 340, 14, '#ffffff', SCREEN_W, true);
  drawText('(Arrow keys to move, Enter to confirm)', SCREEN_W / 2, 360, 11, '#888888', SCREEN_W, true);
}

// Story screen
function drawStoryScreen(): void {
  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  const chapter = story[currentChapter];
  if (!chapter) return;

  // Chapter title
  drawText(`Chapter ${currentChapter}: ${chapter.title}`, SCREEN_W / 2, 20, 16, '#e8c547', SCREEN_W, true);

  // Story lines
  const startIdx = Math.max(0, lastStoryLine - 2);
  const endIdx = Math.min(lastStoryLine + 3, chapter.events.length);

  for (let i = startIdx; i < endIdx; i++) {
    const event = chapter.events[i];
    const y = 50 + (i - startIdx) * 28;

    if (i === lastStoryLine - 1) {
      // Highlight current line
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(10, y - 15, SCREEN_W - 20, 26);
    }

    drawText(`${event.speaker}:`, 20, y, 12, '#9b59b6', SCREEN_W - 40);
    drawText(event.text.replace(/\n/g, ' '), 25, y + 14, 11, '#cccccc', SCREEN_W - 50);
  }

  // Progress
  drawText(`[${lastStoryLine}/${chapter.events.length} lines]`, SCREEN_W / 2, 380, 11, '#666666', SCREEN_W, true);
  drawText('Press Enter for next line, Space to skip', SCREEN_W / 2, 395, 10, '#555555', SCREEN_W, true);
}

// Explore screen
function drawExploreScreen(): void {
  const map = worldMap;
  const px = map.playerPos.x;
  const py = map.playerPos.y;
  const viewRadius = 6;

  // Calculate visible area
  const startX = Math.max(0, px - viewRadius);
  const startY = Math.max(0, py - viewRadius);

  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // Draw map tiles
  for (let dy = -viewRadius; dy <= viewRadius; dy++) {
    for (let dx = -viewRadius; dx <= viewRadius; dx++) {
      const tx = px + dx;
      const ty = py + dy;

      if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) continue;

      const screenX = (VIEW_OFFSET_X + dx * TILE_SIZE);
      const screenY = 50 + dy * TILE_SIZE;

      if (screenX < 0 || screenX >= SCREEN_W || screenY < 0 || screenY >= SCREEN_H) continue;

      const tile = map.tiles[ty][tx];
      const sprite = generateTerrain(tile.type, tx * 100 + ty);
      drawSpriteAt(screenX, screenY, sprite.data);

      // Highlight player
      if (dx === 0 && dy === 0) {
        ctx.fillStyle = 'rgba(232, 197, 71, 0.3)';
        ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // Draw player
  const playerSprite = generateBeetleGirl(42);
  drawSpriteAt(SCREEN_W / 2 - TILE_SIZE / 2, 50 + TILE_SIZE / 2, playerSprite.data);

  // Draw Myco
  const mycoSprite = generateMushroom(43);
  drawSpriteAt(SCREEN_W / 2 + TILE_SIZE / 2, 50 + TILE_SIZE / 2, mycoSprite.data);

  // HUD
  drawText(`Chapter ${currentChapter}: ${story[currentChapter]?.title || 'Unknown'}`, 10, 15, 14, '#e8c547', SCREEN_W - 20);

  // Party info
  const stats = getPartyStats();
  drawText(`HP: ${stats.totalHp} | ATK: ${stats.totalAttack} | DEF: ${stats.totalDefense} | SPK: ${stats.totalSporePower}`, 10, SCREEN_H - 20, 12, '#cccccc', SCREEN_W - 20);

  // Controls hint
  drawText('Arrow keys: Move | Enter: Interact', 10, SCREEN_H - 5, 10, '#666666', SCREEN_W - 20);
}

// Combat screen
function drawCombatScreen(): void {
  const combat = currentState;
  if (combat.phase !== 'combat') return;

  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // Grid
  const grid = getGridForCombat(combat);
  if (grid) {
    const offsetX = 30;
    const offsetY = 30;

    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        const cell = grid[y][x];
        const screenX = offsetX + x * TILE_SIZE;
        const screenY = offsetY + y * TILE_SIZE;

        // Draw terrain
        if (cell.isTerrain === 'crystal') {
          drawSpriteAt(screenX, screenY, generateTerrain('crystal', x * 10 + y).data);
        } else {
          ctx.fillStyle = '#0d0d1a';
          ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
        }

        // Grid lines
        ctx.strokeStyle = '#222244';
        ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

        // Draw actor
        if (cell.occupiedBy) {
          if (cell.occupiedBy.startsWith('enemy_')) {
            const enemy = combat.enemies.find(e => e.id === cell.occupiedBy);
            if (enemy) {
              const sprite = generateEntity(enemy.type, 100);
              drawSpriteAt(screenX, screenY, sprite.data);
            }
          } else {
            // Party member
            const partyData = (window as any).__gameParty;
            if (partyData) {
              const member = partyData.find((m: any) => m.id === cell.occupiedBy);
              if (member) {
                if (member.id === 'buphila') {
                  drawSpriteAt(screenX, screenY, generateBeetleGirl(42).data);
                } else if (member.id === 'myco') {
                  drawSpriteAt(screenX, screenY, generateMushroom(43).data);
                } else if (member.id === 'cogsworth') {
                  drawSpriteAt(screenX, screenY, generateClockworkFox(44).data);
                }
              }
            }
          }

          // HP bar
          const hp = getActorHp(combat, cell.occupiedBy);
          const maxHp = getActorMaxHp(combat, cell.occupiedBy);
          if (maxHp > 0) {
            const barWidth = TILE_SIZE - 2;
            ctx.fillStyle = '#333';
            ctx.fillRect(screenX + 1, screenY - 4, barWidth, 3);
            ctx.fillStyle = hp > maxHp * 0.5 ? '#2ecc71' : hp > maxHp * 0.25 ? '#f39c12' : '#e74c3c';
            ctx.fillRect(screenX + 1, screenY - 4, (hp / maxHp) * barWidth, 3);
          }
        }
      }
    }
  }

  // Message box
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, SCREEN_H - 80, SCREEN_W, 80);
  ctx.strokeStyle = '#9b59b6';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, SCREEN_H - 80, SCREEN_W, 80);

  const message = getCombatMessage(combat);
  drawText(message, 10, SCREEN_H - 70, 14, '#e8c547', SCREEN_W - 20);

  // Turn order
  const turnOrder = getTurnOrder(combat);
  const currentActor = getCurrentActor(combat);
  drawText('Turn: ' + turnOrder.join(' > '), 10, SCREEN_H - 20, 11, '#888888', SCREEN_W - 20);

  // Player actions
  if (currentActor && !currentActor.startsWith('enemy_') && !combat.gameOver) {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, SCREEN_H - 100, SCREEN_W, 25);
    drawText('Actions: [M]ove [A]ttack [F]lee | Enter to confirm', 10, SCREEN_H - 85, 11, '#cccccc', SCREEN_W - 20);
  }

  if (combat.gameOver) {
    drawText(combat.victory ? 'VICTORY!' : 'DEFEAT...', SCREEN_W / 2, SCREEN_H / 2 - 30, 24, combat.victory ? '#2ecc71' : '#e74c3c', SCREEN_W, true);
    drawText('Press Enter to continue', SCREEN_W / 2, SCREEN_H / 2, 14, '#cccccc', SCREEN_W, true);
  }
}

function drawSpriteAt(sx: number, sy: number, data: string[]): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 8;
  tempCanvas.height = 8;
  const tempCtx = tempCanvas.getContext('2d')!;

  for (let i = 0; i < 64; i++) {
    const px = i % 8;
    const py = Math.floor(i / 8);
    const color = data[i];
    if (color && color !== '#1a1a2e') {
      tempCtx.fillStyle = color;
      tempCtx.fillRect(px, py, 1, 1);
    }
  }

  ctx.drawImage(tempCanvas, sx, sy, TILE_SIZE, TILE_SIZE);
  ctx.restore();
}

function getActorHp(combat: CombatState, id: string): number {
  const enemy = combat.enemies.find(e => e.id === id);
  if (enemy) return enemy.hp;

  const partyData = (window as any).__gameParty;
  if (partyData) {
    const member = partyData.find((m: any) => m.id === id);
    if (member) return member.hp;
  }
  return 0;
}

function getActorMaxHp(combat: CombatState, id: string): number {
  const enemy = combat.enemies.find(e => e.id === id);
  if (enemy) return enemy.maxHp;

  const partyData = (window as any).__gameParty;
  if (partyData) {
    const member = partyData.find((m: any) => m.id === id);
    if (member) return member.maxHp;
  }
  return 0;
}

let VIEW_OFFSET_X = 0;

// Game loop
let lastTime = 0;

function gameLoop(timestamp: number): void {
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  if (gameState === 'title') {
    drawTitleScreen();
  } else if (gameState === 'story') {
    drawStoryScreen();
  } else if (gameState === 'explore') {
    VIEW_OFFSET_X = SCREEN_W / 2 - 5 * TILE_SIZE;
    drawExploreScreen();
  } else if (gameState === 'combat') {
    drawCombatScreen();
  }

  requestAnimationFrame(gameLoop);
}

// Input handling
document.addEventListener('keydown', (e) => {
  if (gameState === 'title') {
    // Start game
    initGame();
    gameState = 'story';
    lastStoryLine = 0;
    return;
  }

  if (gameState === 'story') {
    const chapter = story[currentChapter];
    if (!chapter) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (e.key === ' ') {
        // Skip to end of chapter
        lastStoryLine = chapter.events.length;
      } else {
        lastStoryLine++;
      }

      // Check if chapter is complete
      if (lastStoryLine >= chapter.events.length) {
        if (currentChapter < 2) {
          currentChapter++;
          lastStoryLine = 0;
        } else {
          // End of demo
          gameState = 'gameover';
        }
      }
    }
    return;
  }

  if (gameState === 'combat' && currentState.phase === 'combat' && !currentState.gameOver) {
    const actorId = getCurrentActor(currentState);

    if (actorId && !actorId.startsWith('enemy_')) {
      // Player's turn
      if (e.key === 'm' || e.key === 'M') {
        currentState = selectAction(currentState, 'move');
      } else if (e.key === 'a' || e.key === 'A') {
        currentState = selectAction(currentState, 'attack');
      } else if (e.key === 'f' || e.key === 'F') {
        currentState = selectAction(currentState, 'flee');
      }
    }

    if (e.key === 'Enter' && currentState.playerAction === 'attack') {
      // Attack first enemy
      const enemy = currentState.enemies.find(e => e.hp > 0);
      if (enemy) {
        currentState = performAttack(currentState, enemy.id);
        if (!isCombatActive(currentState)) {
          setTimeout(() => {
            gameState = 'explore';
          }, 1500);
        }
      }
    }

    return;
  }

  if (gameState === 'explore') {
    let moved = false;
    let dx = 0, dy = 0;

    if (e.key === 'ArrowUp' || e.key === 'w') dy = -1;
    if (e.key === 'ArrowDown' || e.key === 's') dy = 1;
    if (e.key === 'ArrowLeft' || e.key === 'a') dx = -1;
    if (e.key === 'ArrowRight' || e.key === 'd') dx = 1;

    if (dx !== 0 || dy !== 0) {
      e.preventDefault();
      const result = movePlayer(worldMap, dx, dy);
      if (!result.blocked) {
        moved = true;
        // Random encounter chance
        if (Math.random() < 0.1) {
          (window as any).__gameParty = party;
          currentState = startCombat(party, currentState);
          gameState = 'combat';
        }
      }
    }

    if (e.key === 'Enter') {
      // Check for map events
      const eventResult = checkMapEvents(worldMap);
      if (eventResult.event) {
        // For now, just show a message
        // Could open dialogue or dungeon
      }
    }
  }

  if (gameState === 'gameover') {
    if (e.key === 'Enter') {
      // Restart
      location.reload();
    }
  }
});

function initGame(): void {
  worldMap = generateWorldMap();

  // Initialize party
  party.length = 0;
  joinParty(createBuphila());
  joinParty(createMyco());

  // Store party in window for combat access
  (window as any).__gameParty = party;
}

// Start the game
requestAnimationFrame(gameLoop);
