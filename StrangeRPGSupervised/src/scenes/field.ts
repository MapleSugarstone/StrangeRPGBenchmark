import { fillRect, drawSprite, present } from "../engine/screen.js";
import { buffer } from "../engine/screen.js";
import { getDirection, isConfirm, isBack, MenuCursor, wasPressed } from "../engine/input.js";
import { GOALS } from "../content/goals.js";
import { islandOf } from "../engine/music_director.js";
import { SPRITES } from "../art/sprites.js";
import { SPECIES } from "../battle/species.js";
import {
  COLOR_VOID,
  COLOR_SHADOW,
  COLOR_GROUND,
  COLOR_GROUND_LIGHT,
  COLOR_ASH,
  COLOR_KILN_GLOW,
  COLOR_DREGS_VOID,
  COLOR_STONE_WHITE,
} from "../engine/palette.js";
import { sceneRef } from "../main.js";
import { MAPS, TILE_SIZE, TILES, tileInfo, tileAt, MapData, Warp, NPC, pastSeal, arrivalOf } from "../engine/maps.js";
import { GameState, newGameState, saveGame, loadGame, hasSave, addToParty } from "../engine/game_state.js";
import { setScene } from "../engine/scene_manager.js";
import { playSfx, playDialogueVoice } from "../engine/audio.js";
import { EXIT_ARROWS } from "../art/ui.js";
import { StoryRunner, type StoryHost } from "../engine/story.js";
import { encounterRate, afterStep } from "../battle/field_passives.js";
import { findAt, pickUp } from "../engine/finds.js";
import { blockAt, push, stepWire, resetPuzzle, puzzleSolved, puzzleState } from "../engine/puzzles.js";
import { COMPANIONS, TALKS, TWIST, TWIST_MAP, TWIST_NEAR } from "../content/companions.js";
import { DREGS_ENTRY } from "../content/dregs.js";
import { computeLight, shadeWorld, lightAt, inShadow, nameMaps, TYPE_LIGHT } from "../engine/lighting.js";
import { Sprite } from "../engine/sprite.js";
import { startDialogue, updateDialogue, advanceDialogue, renderDialogue, isDialogueFinished, DialogueState } from "../engine/dialogue.js";

nameMaps(MAPS);

export class FieldScene {
  private state: GameState;
  private map: MapData;
  private playerX: number;
  private playerY: number;
  private playerDir: "up" | "down" | "left" | "right";
  private playerMoving: boolean;
  private playerMoveProgress: number;
  private targetX: number;
  private targetY: number;
  private cameraX: number;
  private cameraY: number;
  private dialogue: DialogueState | null;
  private menuCursor: MenuCursor;
  encounterTimer: number;
  stepsSinceBattle: number;

  constructor(data?: any) {
    this.stepsSinceBattle = 0;
    if (data && data.save) {
      this.state = data.save;
    } else {
      this.state = newGameState();
    }
    this.map = MAPS[this.state.mapId] || MAPS["ashen_reach_1"];
    fitSave(this.state, this.map);
    this.playerX = this.state.playerX;
    this.playerY = this.state.playerY;
    this.playerDir = this.state.playerDir;
    this.playerMoving = false;
    this.playerMoveProgress = 0;
    this.targetX = this.playerX;
    this.targetY = this.playerY;
    this.cameraX = 0;
    this.cameraY = 0;
    this.dialogue = null;
    if (this.state.pending) {
      const all = Array.isArray(this.state.pending) ? this.state.pending : [this.state.pending];
      this.queued = all.slice(1);
      if (all[0]) this.dialogue = startDialogue(all[0].speaker, [all[0].line]);
      this.state.pending = undefined;
    }
    this.menuCursor = new MenuCursor();
    this.encounterTimer = 0;
  }

  private story: StoryRunner | null = null;
  /** Lines waiting to show after the one on screen, each with its own speaker. */
  private queued: { speaker: string; line: string }[] = [];
  /** The tiles Shard last stood on, newest first, where the followers walk. */
  private trail: [number, number][] = [];
  private talkingTo: NPC | null = null;

  /** What a story scene may see and change on the field. */
  private host(): StoryHost {
    const field = this;
    return {
      map: this.map, mapId: this.state.mapId, flags: this.state.flags, playerX: this.playerX, playerY: this.playerY,
      get dialogue() { return field.dialogue; },
      set dialogue(d) { field.dialogue = d; },
      present: (npc) => !(npc.leaves && this.state.flags[`beat_${this.state.mapId}_${npc.x}_${npc.y}`]),
      face: (dir) => { this.playerDir = dir; },
      voice: (speaker) => playDialogueVoice(speaker),
      fight: (npc) => { this.talkingTo = npc; this.handleDialogueEnd({ speaker: npc.name } as DialogueState); },
    };
  }

  update(dt: number): void {
    // A story scene runs the field while it plays, and one may begin whenever Shard stands still.
    if (!this.story && !this.dialogue && !this.playerMoving) this.story = StoryRunner.begin(this.host());
    if (!this.story && !this.dialogue && !this.playerMoving) {
      const said = companionLines(this.state, this.playerX, this.playerY);
      if (said.length) {
        this.queued = said.slice(1);
        this.dialogue = startDialogue(said[0].speaker, [said[0].line]);
        return;
      }
    }
    if (this.story) {
      this.story.update(dt, this.host());
      if (this.story.done) this.story = null;
      return;
    }
    if (this.dialogue) {
      const before = Math.floor(this.dialogue.charIndex / 3);
      updateDialogue(this.dialogue, dt);
      // The speaker's voice blips every third letter as the line types.
      if (Math.floor(this.dialogue.charIndex / 3) > before) playDialogueVoice(this.dialogue.speaker);
      if (isConfirm()) {
        advanceDialogue(this.dialogue);
      }
      if (isBack()) {
        this.dialogue = null;
        return;
      }
      if (isDialogueFinished(this.dialogue) && this.queued.length) {
        const next = this.queued.shift()!;
        this.dialogue = startDialogue(next.speaker, [next.line]);
        return;
      }
      if (isDialogueFinished(this.dialogue)) {
        const finishedLine = this.dialogue;
        this.dialogue = null;
        this.handleDialogueEnd(finishedLine);
        return;
      }
      return;
    }

    // Tab shows the goal for this island.
    if (wasPressed("tab")) {
      this.dialogue = startDialogue("", [GOALS[islandOf(this.state.mapId)] ?? ""]);
      return;
    }

    if (isBack()) {
      // The save holds where Shard stands, so closing the menu returns Shard to the same tile.
      this.state.playerX = this.playerX;
      this.state.playerY = this.playerY;
      this.state.playerDir = this.playerDir;
      setScene("menu", { save: this.state });
      return;
    }

    const dir = getDirection();
    if (dir && !this.playerMoving) {
      let nextX = this.playerX;
      let nextY = this.playerY;

      if (dir === "up") nextY--;
      if (dir === "down") nextY++;
      if (dir === "left") nextX--;
      if (dir === "right") nextX++;

      this.playerDir = dir;

      // Walking into a weight pushes it a tile, if the tile beyond is free.
      if (blockAt(this.state, this.state.mapId, this.map, nextX, nextY)) {
        const dx = nextX - this.playerX, dy = nextY - this.playerY;
        if (push(this.state, this.state.mapId, this.map, nextX, nextY, dx, dy, (x, y) => this.isValidMove(x, y))) playSfx("step");
      }

      if (this.isValidMove(nextX, nextY)) {
        this.targetX = nextX;
        this.targetY = nextY;
        this.playerMoving = true;
        this.playerMoveProgress = 0;
        this.stepsSinceBattle++;
        this.checkEncounter();
      }
    }

    if (this.playerMoving) {
      this.playerMoveProgress += dt * 5;
      if (this.playerMoveProgress >= 1) {
        this.trail = [[this.playerX, this.playerY] as [number, number], ...this.trail].slice(0, 6);
        this.playerX = this.targetX;
        this.playerY = this.targetY;
        this.playerMoving = false;
        this.playerMoveProgress = 0;
        this.state.playerX = this.playerX;
        this.state.playerY = this.playerY;
        this.state.playerDir = this.playerDir;
        stepWire(this.state, this.state.mapId, this.map, this.playerX, this.playerY);
        this.checkWarp();
        // A side map's find is taken by stepping on it.
        const found = pickUp(this.state, this.state.mapId, this.map, this.playerX, this.playerY);
        if (found) { playSfx("level_up"); this.dialogue = startDialogue(found.name, [found.line]); }
        // Party passives that act on each step may say something.
        const said = afterStep(this.state);
        if (said.length && !this.dialogue) this.dialogue = startDialogue(said[0].speaker, said.map((s) => s.text));
      }
    }

    // The camera follows the player's drawn position, so it glides with each step instead of jumping a tile.
    const t = this.playerMoving ? this.playerMoveProgress : 0;
    const drawnX = (this.playerX + (this.targetX - this.playerX) * t) * TILE_SIZE;
    const drawnY = (this.playerY + (this.targetY - this.playerY) * t) * TILE_SIZE;
    this.cameraX = Math.max(0, Math.min(Math.round(drawnX + 4 - 96), this.map.width * TILE_SIZE - 192));
    this.cameraY = Math.max(0, Math.min(Math.round(drawnY + 4 - 96), this.map.height * TILE_SIZE - 192));

    this.checkNPCInteraction();
  }

  render(): void {
    fillRect(0, 0, 192, 192, COLOR_VOID);

    const startX = Math.floor(this.cameraX / TILE_SIZE);
    const startY = Math.floor(this.cameraY / TILE_SIZE);
    const endX = Math.min(startX + 25, this.map.width);
    const endY = Math.min(startY + 25, this.map.height);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const sealOpen = this.state.flags[`seal_${this.state.mapId}`];
        const found = tileInfo(this.map, x, y);
        const info = found?.seal && sealOpen ? (this.map.tiles?.["."] ?? TILES["."]) : found;
        if (info?.under && SPRITES[info.under]) drawSprite(SPRITES[info.under], x * TILE_SIZE - this.cameraX, y * TILE_SIZE - this.cameraY, 1);
        const sprite = SPRITES[info?.sprite ?? "tile_wall"];
        if (sprite) {
          drawSprite(sprite, (x * TILE_SIZE - this.cameraX), (y * TILE_SIZE - this.cameraY), 1);
        } else {
          fillRect((x * TILE_SIZE - this.cameraX), (y * TILE_SIZE - this.cameraY), TILE_SIZE, TILE_SIZE, COLOR_GROUND);
        }
      }
    }

    // The player is drawn between tiles while stepping.
    const t = this.playerMoving ? this.playerMoveProgress : 0;
    const px = (this.playerX + (this.targetX - this.playerX) * t) * TILE_SIZE;
    const py = (this.playerY + (this.targetY - this.playerY) * t) * TILE_SIZE;
    const people = this.map.npcs.filter((npc) => !(npc.leaves && this.state.flags[`beat_${this.state.mapId}_${npc.x}_${npc.y}`]) && !joined(this.state, npc));

    const lead = SPECIES[this.state.party[0]]?.types?.[0] ?? "Stone";
    const carried = { x: px + 4, y: py + 4, r: 4.5 * TILE_SIZE, color: TYPE_LIGHT[lead] ?? TYPE_LIGHT.Stone, power: 1.0 };
    const light = computeLight(this.map, this.cameraX, this.cameraY, [carried],
      people.map((npc) => [npc.x, npc.y] as [number, number]), performance.now() / 1000);
    shadeWorld(light, this.map);
    // Puzzle weights, and the lit part of a wire being walked.
    if (this.map.puzzle) {
      const st = puzzleState(this.state, this.state.mapId, this.map);
      const weight = SPRITES[(this.map.tiles?.["P"] ?? TILES["P"]).sprite] ?? SPRITES.tile_pillar;
      for (const [bx, by] of st.blocks ?? []) drawSprite(weight, bx * TILE_SIZE - this.cameraX, by * TILE_SIZE - this.cameraY, 1);
      const lit = puzzleSolved(this.state, this.state.mapId) && this.map.puzzle.kind === "wire" ? this.map.puzzle.wire : st.walked ?? [];
      for (const [wx, wy] of lit) fillRect(wx * TILE_SIZE - this.cameraX + 3, wy * TILE_SIZE - this.cameraY + 3, 2, 2, COLOR_KILN_GLOW);
    }
    // A side map's find glints until it is taken, drawn after the light so it keeps its color.
    const find = findAt(this.state, this.state.mapId, this.map);
    if (find && SPRITES.find) drawSprite(SPRITES.find, find[0] * TILE_SIZE - this.cameraX, find[1] * TILE_SIZE - this.cameraY, 1);
    // An arrow on each exit points off the map, drawn after the light so it keeps its color.
    for (const w of this.map.warps) {
      // A hut's door points in; a room's door points out, down.
      const door = tileAt(this.map, w.x, w.y) === "E";
      const dir = door ? (this.state.mapId.endsWith("_hut") ? "down" : "up")
        : w.x <= 2 ? "left" : w.x >= this.map.width - 3 ? "right" : w.y >= this.map.height / 2 ? "down" : "up";
      drawSprite(EXIT_ARROWS[dir], w.x * TILE_SIZE - this.cameraX, w.y * TILE_SIZE - this.cameraY, 1);
    }
    const lit = (sprite: Sprite, wx: number, wy: number) => (lightAt(light, wx + 4, wy + 4) < 0.3 ? inShadow(sprite) : sprite);

    for (const npc of people) {
      const sprite = SPRITES[npc.sprite] || SPRITES.shard;
      const at = this.story?.drawnAt(npc) ?? npc;
      drawSprite(lit(sprite, at.x * TILE_SIZE, at.y * TILE_SIZE), at.x * TILE_SIZE - this.cameraX, at.y * TILE_SIZE - this.cameraY, 1);
    }

    // Followers walk in Shard's last steps: the party's second Ruin first, then the companions who travel along. Each
    // glides from its tile to the next one forward while Shard steps.
    const followers = [this.state.party.length > 1 ? SPRITES[this.state.party[1]] : null,
      ...travelling(this.state).map((c) => SPRITES[c.sprite] ?? null)].filter((x): x is Sprite => !!x);
    const spots: [number, number][] = [[this.playerX, this.playerY], ...this.trail];
    followers.forEach((sprite, i) => {
      const from = spots[i + 1], to = spots[i];
      if (!from) return;
      const fx = (from[0] + (to[0] - from[0]) * t) * TILE_SIZE, fy = (from[1] + (to[1] - from[1]) * t) * TILE_SIZE;
      drawSprite(lit(sprite, fx, fy), fx - this.cameraX, fy - this.cameraY, 1);
    });

    drawSprite(SPRITES.shard, px - this.cameraX, py - this.cameraY, 1);

    // Draw Dialogue Box
    if (this.dialogue) {
      fillRect(10, 140, 172, 42, COLOR_SHADOW);
      fillRect(11, 141, 170, 40, COLOR_VOID);
      renderDialogue(this.dialogue, 12, 142, 168, 38);
    }
  }

  private isValidMove(x: number, y: number): boolean {
    if (x < 0 || x >= this.map.width || y < 0 || y >= this.map.height) return false;
    const info = tileInfo(this.map, x, y);
    if (!info?.walk) return false;
    if (info.seal && !this.state.flags[`seal_${this.state.mapId}`]) return false;
    if (blockAt(this.state, this.state.mapId, this.map, x, y)) return false;
    for (const npc of this.map.npcs) {
      if (npc.leaves && this.state.flags[`beat_${this.state.mapId}_${npc.x}_${npc.y}`]) continue;
      if (joined(this.state, npc)) continue;
      const at = this.story?.tileOf(npc) ?? npc;
      if (at.x === x && at.y === y) return false;
    }
    return true;
  }

  checkWarp(): void {
    for (let warp of this.map.warps) {
      if (this.playerX === warp.x && this.playerY === warp.y) {
        // After the ending, the last gate leads down into the Dregs; the Final Rift's gate ends the postgame.
        if (warp.destMap === "ending" && !this.state.flags.ending_seen) {
          setScene("ending", { save: this.state });
          return;
        }
        if (warp.destMap === "dregs_end") {
          setScene("ending", { save: this.state, postgame: true });
          return;
        }
        if (warp.destMap === "ending") { const [x, y] = arrivalOf(DREGS_ENTRY.map); warp = { ...warp, destMap: DREGS_ENTRY.map, destX: x, destY: y }; }
        playSfx("door");
        resetPuzzle(this.state, this.state.mapId);
        this.state.mapId = warp.destMap;
        this.state.playerX = warp.destX;
        this.state.playerY = warp.destY;
        this.state.playerDir = "up";
        this.map = MAPS[warp.destMap] || this.map;
        this.playerX = warp.destX;
        this.playerY = warp.destY;
        this.targetX = warp.destX;
        this.targetY = warp.destY;
        this.cameraX = this.playerX * TILE_SIZE - 96;
        this.cameraY = this.playerY * TILE_SIZE - 96;
        this.stepsSinceBattle = 0;
        this.encounterTimer = 0;
        this.trail = [];
        break;
      }
    }
  }

  private checkNPCInteraction(): void {
    if (this.playerMoving) return;
    if (this.dialogue) return;

    let targetNpc: NPC | null = null;
    let nextX = this.playerX;
    let nextY = this.playerY;

    if (this.playerDir === "up") nextY--;
    if (this.playerDir === "down") nextY++;
    if (this.playerDir === "left") nextX--;
    if (this.playerDir === "right") nextX++;

    for (const npc of this.map.npcs) {
      if (joined(this.state, npc)) continue;
      if (npc.x === nextX && npc.y === nextY) {
        targetNpc = npc;
        break;
      }
    }

    // Facing a shut seal: a party Ruin of the needed type opens it for good.
    const seal = this.map.seal;
    if (!targetNpc && seal && isConfirm() && tileInfo(this.map, nextX, nextY)?.seal && !this.state.flags[`seal_${this.state.mapId}`]) {
      // A Ruin of the needed type in the party or in storage opens it.
      if (this.map.puzzle && !puzzleSolved(this.state, this.state.mapId)) { playSfx("ko"); return; }
      const has = [...this.state.party, ...(this.state.storage ?? []).map((r) => r.key), ...Object.keys(this.state.bag ?? {}).filter((k) => (this.state.bag[k] ?? 0) > 0)].some((k) => (SPECIES[k]?.types ?? []).some((t: string) => t === seal.needs));
      if (has) {
        this.state.flags[`seal_${this.state.mapId}`] = true;
        playSfx("door");
      }
      this.dialogue = startDialogue(seal.name, [has ? seal.open : seal.shut]);
      return;
    }

    if (targetNpc && isConfirm()) {
      if (targetNpc.leaves && this.state.flags[`beat_${this.state.mapId}_${targetNpc.x}_${targetNpc.y}`]) return;
      const beaten = targetNpc.flag && this.state.flags[targetNpc.flag] && targetNpc.after;
      this.dialogue = startDialogue(targetNpc.name, beaten ? targetNpc.after! : targetNpc.lines);
      this.talkingTo = targetNpc;
    }
  }

  private handleDialogueEnd(dialogue: DialogueState | null): void {
    if (!dialogue) return;
    // The person spoken to, not just anyone who shares their name.
    const targetNpc = this.talkingTo ?? this.map.npcs.find(npc => npc.name === dialogue.speaker);
    this.talkingTo = null;
    if (!targetNpc) return;
    const giftFlag = `gift_${targetNpc.name}`;
    const gift = targetNpc.gives && !this.state.flags[giftFlag]
      ? { species: targetNpc.gives, level: targetNpc.givesLevel ?? 5, flag: giftFlag, speaker: targetNpc.name, line: targetNpc.giftLine } : null;
    if (targetNpc.isTrainer && targetNpc.battle && targetNpc.flag && !this.state.flags[targetNpc.flag]) {
      this.state.playerX = this.playerX;
      this.state.playerY = this.playerY;
      this.state.playerDir = this.playerDir;
      setScene("battle", {
        playerSpecies: this.state.party,
        opponentSpecies: [targetNpc.battle, ...(targetNpc.team ?? [])],
        isWild: false,
        playerLevels: this.state.partyLevels,
        opponentLevel: targetNpc.level ?? 5,
        trainerFlag: targetNpc.flag,
        fieldState: { save: this.state }
      });
    } else if (targetNpc.leaves && targetNpc.battle && !this.state.flags[`beat_${this.state.mapId}_${targetNpc.x}_${targetNpc.y}`]) {
      this.state.playerX = this.playerX;
      this.state.playerY = this.playerY;
      this.state.playerDir = this.playerDir;
      setScene("battle", {
        playerSpecies: this.state.party,
        opponentSpecies: [targetNpc.battle, ...(targetNpc.team ?? [])],
        isWild: false,
        playerLevels: this.state.partyLevels,
        opponentLevel: targetNpc.level ?? 5,
        trainerFlag: `beat_${this.state.mapId}_${targetNpc.x}_${targetNpc.y}`,
        fieldState: { save: this.state },
        gift,
      });
    } else {
      // Talking with anyone who does not fight rests the party to full, with a chime when someone was hurt.
      if (this.state.partyHp?.some((hp, i) => hp < 9999 && i < this.state.party.length)) playSfx("level_up");
      this.state.partyHp = undefined;
      if (gift) {
        addToParty(this.state, gift.species, gift.level);
        this.state.flags[gift.flag] = true;
        if (gift.line) this.dialogue = startDialogue(gift.speaker, [gift.line]);
      } else if (targetNpc.shop) {
        // A trader's stall opens after their lines.
        setScene("shop", { save: this.state });
      } else if (targetNpc.quench) {
        setScene("quench", { save: this.state });
      } else if (targetNpc.forge) {
        setScene("forge", { save: this.state });
      } else if (targetNpc.board) {
        // The guardian steps aside for good once Shard wins.
        setScene("board", { save: this.state, guardian: targetNpc.name, flag: `beat_${this.state.mapId}_${targetNpc.x}_${targetNpc.y}` });
      }
    }
  }

  private checkEncounter(): void {
    if (this.stepsSinceBattle < 12) return;
    
    // Check if the destination tile is a valid encounter tile
    const destTile = this.map.rows[this.targetY].replace(/\/\/.*$/, "").trim()[this.targetX];
    const encounter = this.map.encounters.find(e => e.tiles.includes(destTile));
    
    if (encounter) {
      const rate = encounterRate(this.state, encounter.rate ?? 0.08);
      if (Math.random() < rate) {
        // Update state to current position before battle
        this.state.playerX = this.targetX;
        this.state.playerY = this.targetY;
        this.state.playerDir = this.playerDir;
        
        const species = encounter.species[Math.floor(Math.random() * encounter.species.length)];
        // Wild pairs: an encounter marked pair brings two wild Ruin.
        const second = encounter.pair ? encounter.species[Math.floor(Math.random() * encounter.species.length)] : null;
        const opponentLevel = encounter.levels[Math.floor(Math.random() * encounter.levels.length)];
        setScene("battle", { 
          playerSpecies: this.state.party, 
          opponentSpecies: second ? [species, second] : [species],
          isWild: true,
          playerLevels: this.state.partyLevels,
          opponentLevel: opponentLevel,
          fieldState: { save: this.state, map: this.map, playerX: this.playerX, playerY: this.playerY, playerDir: this.playerDir }
        });
        this.stepsSinceBattle = 0;
        this.encounterTimer = 0;
      }
    }
  }
}

/** The companions who have joined (their gift given), in the order they join. */
export function travelling(save: GameState): { name: string; sprite: string }[] {
  return COMPANIONS.filter((c) => save.flags[`gift_${c.name}`]);
}

/** A companion who has joined is no longer at the spot where Shard met them. */
function joined(save: GameState, npc: NPC): boolean {
  return !!npc.gives && COMPANIONS.some((c) => c.name === npc.name) && !!save.flags[`gift_${npc.name}`];
}

/** Lines due now: the talk after an island's arrival scene, or the twist on the last map. Each plays once. */
function companionLines(save: GameState, x: number, y: number): { speaker: string; line: string }[] {
  const island = islandOf(save.mapId) + 1;
  const talk = TALKS[island];
  if (talk?.length && /_1$/.test(save.mapId) && save.flags[`story_arrive_${island}`] && !save.flags[`talk_${island}`]) {
    save.flags[`talk_${island}`] = true;
    return talk.map(([speaker, line]) => ({ speaker, line }));
  }
  const near = pastSeal(MAPS[save.mapId], x, y);
  if (TWIST.length && save.mapId === TWIST_MAP && near !== null && near < 0 && near >= -TWIST_NEAR && !save.flags.twist) {
    save.flags.twist = true;
    return TWIST.map(([speaker, line]) => ({ speaker, line }));
  }
  return [];
}

/** Fits a save made before the maps were laid out again: Shard stands on open ground, and a big fight that was won
 * stays won though its person now stands elsewhere. */
function fitSave(save: GameState, map: MapData): void {
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height && !!tileInfo(map, x, y)?.walk;
  if (!open(save.playerX, save.playerY)) [save.playerX, save.playerY] = arrivalOf(save.mapId);
  const here = `beat_${save.mapId}_`;
  const stale = Object.keys(save.flags).some((k) => k.startsWith(here) && save.flags[k] &&
    !map.npcs.some((n) => k === `${here}${n.x}_${n.y}`));
  if (stale) for (const n of map.npcs) if (n.leaves && n.battle) save.flags[`${here}${n.x}_${n.y}`] = true;
}
