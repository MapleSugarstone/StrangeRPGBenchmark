import { fillRect, drawSprite, dither, present } from "../engine/screen.js";
import { buffer } from "../engine/screen.js";
import { drawText, textWidth } from "../engine/font.js";
import { getDirection, isConfirm, isBack, updateInput } from "../engine/input.js";
import { SPRITES } from "../art/sprites.js";
import {
  COLOR_VOID,
  COLOR_SHADOW,
  COLOR_GROUND,
  COLOR_GROUND_LIGHT,
  COLOR_ASH,
  COLOR_KILN_GLOW,
  COLOR_DREGS_VOID,
} from "../engine/palette.js";
import { sceneRef } from "../main.js";
import { TitleScene } from "./title.js";

// Game state
let playerX: number = 0;
let playerY: number = 0;
let playerDir: "up" | "down" | "left" | "right" = "down";
let playerMoving: boolean = false;
let playerMoveProgress: number = 0;
let targetX: number = 0;
let targetY: number = 0;

// Camera
let cameraX: number = 0;
let cameraY: number = 0;

// Map
const MAP_WIDTH = 32;
const MAP_HEIGHT = 24;
const TILE_SIZE = 8;

// Map data (simplified for test room)
const map: number[][] = [];

// Initialize map
function initMap(): void {
  for (let y = 0; y < MAP_HEIGHT; y++) {
    map[y] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (y === 0 || y === MAP_HEIGHT - 1 || x === 0 || x === MAP_WIDTH - 1) {
        map[y][x] = 1; // Wall
      } else if (y === 1 || y === MAP_HEIGHT - 2 || x === 1 || x === MAP_WIDTH - 2) {
        map[y][x] = 2; // Dregs
      } else {
        map[y][x] = 0; // Ash ground
      }
    }
  }
  // Add some walls and features
  map[5][5] = 3; // Pillar
  map[10][10] = 4; // Lamp post
  map[15][15] = 5; // Cracked ground with Weep
  map[20][20] = 6; // Wall
}

export class RoomScene {
  constructor() {
    initMap();
    playerX = 5;
    playerY = 5;
    targetX = playerX;
    targetY = playerY;
    cameraX = 0;
    cameraY = 0;
  }

  update(dt: number): void {
    updateInput(dt);

    const dir = getDirection();

    if (dir && !playerMoving) {
      let nextX = playerX;
      let nextY = playerY;

      if (dir === "up") nextY--;
      if (dir === "down") nextY++;
      if (dir === "left") nextX--;
      if (dir === "right") nextX++;

      // Check bounds and collisions
      if (nextX >= 0 && nextX < MAP_WIDTH && nextY >= 0 && nextY < MAP_HEIGHT) {
        const tile = map[nextY][nextX];
        if (tile !== 1 && tile !== 3 && tile !== 6 && tile !== 2) {
          // Not a wall, pillar, extra wall, or dregs
          playerDir = dir;
          targetX = nextX;
          targetY = nextY;
          playerMoving = true;
          playerMoveProgress = 0;
        }
      }
    }

    if (playerMoving) {
      playerMoveProgress += dt * 10; // Speed of movement
      if (playerMoveProgress >= 1) {
        playerX = targetX;
        playerY = targetY;
        playerMoving = false;
        playerMoveProgress = 0;
      }
    }

    // Update camera
    const screenX = playerX * TILE_SIZE - 96;
    const screenY = playerY * TILE_SIZE - 96;
    cameraX += (screenX - cameraX) * 0.1;
    cameraY += (screenY - cameraY) * 0.1;

    // Clamp camera
    cameraX = Math.max(0, Math.min(cameraX, MAP_WIDTH * TILE_SIZE - 192));
    cameraY = Math.max(0, Math.min(cameraY, MAP_HEIGHT * TILE_SIZE - 192));

    // Back to title
    if (isBack()) {
      sceneRef.scene = new TitleScene();
    }
  }

  render(): void {
    // Clear screen
    fillRect(0, 0, 192, 192, COLOR_VOID);

    // Draw map
    const startX = Math.floor(cameraX / TILE_SIZE);
    const startY = Math.floor(cameraY / TILE_SIZE);
    const endX = Math.min(startX + 24, MAP_WIDTH);
    const endY = Math.min(startY + 24, MAP_HEIGHT);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = map[y][x];
        let tileSprite: string;
        switch (tile) {
          case 0:
            tileSprite = "tile_ash_ground";
            break;
          case 1:
            tileSprite = "tile_wall";
            break;
          case 2:
            tileSprite = "tile_dregs";
            break;
          case 3:
            tileSprite = "tile_pillar";
            break;
          case 4:
            tileSprite = "tile_lamp_post";
            break;
          case 5:
            tileSprite = "tile_cracked_ground";
            break;
          case 6:
            tileSprite = "tile_wall";
            break;
          default:
            tileSprite = "tile_ash_ground";
        }

        const screenX = (x * TILE_SIZE - cameraX) * 2;
        const screenY = (y * TILE_SIZE - cameraY) * 2;
        drawSprite(SPRITES[tileSprite], screenX, screenY, 2);
      }
    }

    // Draw player
    const playerScreenX = (playerX * TILE_SIZE - cameraX) * 2;
    const playerScreenY = (playerY * TILE_SIZE - cameraY) * 2;
    drawSprite(SPRITES.shard, playerScreenX, playerScreenY, 2);

    // Draw following Ruin
    let followX = playerX;
    let followY = playerY;
    if (playerDir === "left") followX--;
    if (playerDir === "right") followX++;
    if (playerDir === "up") followY--;
    if (playerDir === "down") followY++;
    
    const followScreenX = (followX * TILE_SIZE - cameraX) * 2;
    const followScreenY = (followY * TILE_SIZE - cameraY) * 2;
    drawSprite(SPRITES.glass_sentinel, followScreenX, followScreenY, 2);

    // Draw lighting effects
    drawLighting();
  }
}

// Draw lighting effects
function drawLighting(): void {
  // Lamp post lighting
  const lampX = 10;
  const lampY = 10;
  const lampScreenX = (lampX * TILE_SIZE - cameraX) * 2;
  const lampScreenY = (lampY * TILE_SIZE - cameraY) * 2;

  // Draw dithered rings around lamp
  for (let r = 0; r < 5; r++) {
    const radius = 10 + r * 5;
    const alpha = 0.5 - r * 0.1;
    if (alpha > 0) {
      // Draw a circle approximation with dithering
      for (let y = -radius; y <= radius; y++) {
        for (let x = -radius; x <= radius; x++) {
          const dist = Math.sqrt(x * x + y * y);
          if (dist <= radius && dist > radius - 2) {
            const screenX = lampScreenX + x * 2;
            const screenY = lampScreenY + y * 2;
            if (screenX >= 0 && screenX < 192 && screenY >= 0 && screenY < 192) {
              // Use dithering for smooth gradient
              dither(screenX, screenY, 2, 2, COLOR_KILN_GLOW, COLOR_VOID, alpha * 10);
            }
          }
        }
      }
    }
  }

  // Weep lighting
  const weepX = 15;
  const weepY = 15;
  const weepScreenX = (weepX * TILE_SIZE - cameraX) * 2;
  const weepScreenY = (weepY * TILE_SIZE - cameraY) * 2;

  // Draw dithered rings around Weep
  for (let r = 0; r < 3; r++) {
    const radius = 8 + r * 4;
    const alpha = 0.4 - r * 0.1;
    if (alpha > 0) {
      for (let y = -radius; y <= radius; y++) {
        for (let x = -radius; x <= radius; x++) {
          const dist = Math.sqrt(x * x + y * y);
          if (dist <= radius && dist > radius - 2) {
            const screenX = weepScreenX + x * 2;
            const screenY = weepScreenY + y * 2;
            if (screenX >= 0 && screenX < 192 && screenY >= 0 && screenY < 192) {
              dither(screenX, screenY, 2, 2, COLOR_KILN_GLOW, COLOR_VOID, alpha * 10);
            }
          }
        }
      }
    }
  }
}
