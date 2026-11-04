import { fillRect, drawSprite, dither, present, buffer } from "../engine/screen.js";
import { drawText, textWidth } from "../engine/font.js";
import { getDirection, isConfirm, isBack, updateInput, MenuCursor, menuDirection } from "../engine/input.js";
import { SPRITES } from "../art/sprites.js";
import {
  COLOR_VOID,
  COLOR_SHADOW,
  COLOR_GROUND,
  COLOR_GROUND_LIGHT,
  COLOR_ASH,
  COLOR_KILN_GLOW,
  COLOR_GLAZE_RED_BRIGHT,
  COLOR_GLAZE_RED,
  COLOR_STONE_WHITE,
  COLOR_STONE_DARK,
  COLOR_GLAZE_LIGHT,
  COLOR_KILN_DARK,
  COLOR_RUST,
  COLOR_METAL,
  COLOR_GLASS,
  COLOR_GLASS_LIGHT,
  COLOR_GLAZE_DARK,
  COLOR_STAR,
} from "../engine/palette.js";

/** Commands and moves that cannot be chosen now. */
const COLOR_DIM = COLOR_GROUND_LIGHT;
import { sceneRef } from "../main.js";
import { setScene } from "../engine/scene_manager.js";
import {
  BattleState,
  startBattle,
  executePlayerAction,
  RuinState,
  canCatch,
  moveBlocked,
  matchup,
  linkReady,
  breakReady,
  rooted,
  openBattle,
  battleRewards,
} from "../battle/engine.js";
import { magnetOf, wornRules, fieldFor, rewardKeeper } from "../engine/charms.js";
import { islandOf } from "../engine/music_director.js";
import { PACK } from "../battle/lines.js";

/** Splits text into the rows the battle box shows. */
function boxRows(text: string): string[] {
  const rows: string[] = [];
  for (const word of text.split(" ")) {
    const last = rows[rows.length - 1];
    if (last !== undefined && textWidth(`${last} ${word}`) <= 176) rows[rows.length - 1] = `${last} ${word}`;
    else rows.push(word);
  }
  return rows;
}

/** One message per Z: lines that came from passives, Resonance, or Field States share a screen while they fit its three
 * rows, so a busy turn does not take a press per small effect. */
function packLines(lines: string[]): string[] {
  const out: string[] = [];
  let packable = false;
  for (const raw of lines) {
    const marked = raw.includes(PACK);
    const text = raw.split(PACK).join("").trim();
    if (!text) continue;
    const joined = out.length ? `${out[out.length - 1]} ${text}` : text;
    if (marked && packable && boxRows(joined).length <= 3) out[out.length - 1] = joined;
    else out.push(text);
    packable = marked;
  }
  return out;
}
import { expFor, grow } from "../battle/growth.js";
import { addToParty, noteSeen, QUENCH_STATS, QUENCH_STEP, type Quench } from "../engine/game_state.js";
import { ITEMS, PASTE, type Item } from "../content/items.js";
import { playSfx } from "../engine/audio.js";
import { battleLight, shadeRows, glowLight, TYPE_LIGHT, LightField, Light } from "../engine/lighting.js";
import { MAPS, TILES } from "../engine/maps.js";
import { SPECIES } from "../battle/species.js";
import { MOVES, type MoveData } from "../battle/moves.js";
import { getTypeMultiplier } from "../battle/types.js";
import { Status } from "../battle/statuses.js";

type BattlePhase =
  | "menu"
  | "moveSelect"
  | "switchSelect"
  | "animating"
  | "message"
  | "bagSelect"
  | "result";

export class BattleScene {
  private battleState: BattleState;
  private phase: BattlePhase = "menu";
  private cursor: MenuCursor = new MenuCursor();
  private animTimer: number = 0;
  private animType: "hit" | "faint" | "catch" | "switch" | null = null;
  private animTarget: { x: number; y: number } | null = null;
  private playerTeam: string[];
  private opponentTeam: string[];
  private isWild: boolean;
  private playerLevels: number[];
  private opponentLevel: number;
  private lastLog: string[] = [];
  private logIndex: number = 0;
  private showLog: boolean = false;
  private catchSuccess: boolean = false;
  private resultData: {
    won: boolean;
    expGained: number[];
    levelsUp: number[];
    caught: string | null;
  } | null = null;
  private fieldState: any;
  private trainerFlag: string | null;
  private partyExp: number[] = [];
  private cinder = 0;
  private storageGain = 0;
  private gift: { species: string; level: number; flag: string; speaker?: string; line?: string } | null = null;

  constructor(playerSpecies: string[], opponentSpecies: string[], isWild: boolean, playerLevels: number[] = [5], opponentLevel: number = 1, fieldState: any = null, trainerFlag: string | null = null,
    gift: { species: string; level: number; flag: string; speaker?: string; line?: string } | null = null) {
    this.gift = gift;
    this.playerTeam = playerSpecies;
    this.opponentTeam = opponentSpecies;
    this.isWild = isWild;
    this.playerLevels = playerLevels;
    this.opponentLevel = opponentLevel;
    this.fieldState = fieldState;
    this.trainerFlag = trainerFlag;
    this.battleState = startBattle(playerSpecies, opponentSpecies, playerLevels.length ? playerLevels : [5], opponentLevel);
    this.battleState.smartFoe = !isWild;
    this.battleState.playerTeam.forEach((r, i) => {
      (r as any).partyIndex = i;
      r.nick = fieldState?.save?.partyNames?.[i] || undefined;
    });
    if (fieldState?.save) for (const key of opponentSpecies) noteSeen(fieldState.save, key);
    // Quench layers raise their stats by 2% each.
    const layers: Quench[] | undefined = fieldState?.save?.partyQuench;
    this.battleState.playerTeam.forEach((r, i) => {
      for (const s of QUENCH_STATS) if (layers?.[i]?.[s]) r.currentStats[s] = Math.round(r.currentStats[s] * (1 + QUENCH_STEP * layers[i][s]!));
    });
    // HP carries over between battles. A fainted Ruin stays down, and the first one standing leads.
    const savedHp: number[] | undefined = fieldState?.save?.partyHp;
    if (savedHp) {
      for (const r of this.battleState.playerTeam) {
        const h = savedHp[(r as any).partyIndex];
        if (h !== undefined) { r.hp = Math.max(0, Math.min(r.maxHp, h)); r.isFainted = r.hp <= 0; }
      }
      const team = this.battleState.playerTeam;
      if (team.every((r) => r.isFainted)) team.forEach((r) => { r.hp = r.maxHp; r.isFainted = false; });
      const up = team.findIndex((r) => !r.isFainted);
      if (up > 0) [team[0], team[up]] = [team[up], team[0]];
    }
    // A big fight hits harder and lasts longer than a wild Ruin of its level.
    if (trainerFlag?.startsWith("beat_")) {
      for (const r of this.battleState.opponentTeam) {
        r.maxHp = Math.round(r.maxHp * 1.6);
        r.hp = r.maxHp;
        r.currentStats.atk = Math.round(r.currentStats.atk * 1.2);
        r.currentStats.mgk = Math.round(r.currentStats.mgk * 1.2);
      }
    }
    // The worn Resonance, the Magnet, and the island's Field State, then the opening: the Field State's line and the
    // leads' entering passives.
    const save = fieldState?.save;
    if (save) {
      this.battleState.magnet = magnetOf(save);
      this.battleState.teamRules = wornRules(save);
      this.battleState.field = fieldFor(save.mapId ?? "");
    }
    // A Field State's opening lines show in the first battle on each island only.
    const seenKey = save && this.battleState.field ? `field_${this.battleState.field.name}_${islandOf(save.mapId ?? "")}` : "";
    const opening = openBattle(this.battleState, !seenKey || !save.flags?.[seenKey]);
    if (seenKey) save.flags[seenKey] = true;
    if (opening.length) {
      this.lastLog = packLines(opening.flatMap((l) => l.split("\n")));
      this.logIndex = 0;
      this.showLog = true;
      this.phase = "message";
    }
  }

  update(dt: number): void {
    updateInput(dt);

    if (this.phase === "animating") {
      this.animTimer -= dt;
      if (this.animTimer <= 0) {
        this.onAnimComplete();
      }
      return;
    }

    if (this.phase === "result") {
      if (isConfirm()) {
        this.onResultConfirm();
      }
      return;
    }

    if (this.phase === "message") {
      if (isConfirm()) {
        // Each Z shows the next line of the turn, then returns to the commands.
        if (this.logIndex < this.lastLog.length - 1) this.logIndex++;
        else {
          this.showLog = false;
          // A fallen lead must be replaced before the next command.
          this.phase = this.battleState.needSwitch ? "switchSelect" : "menu";
        }
      }
      return;
    }

    if (isConfirm()) {
      this.handleConfirm();
    } else if (isBack()) {
      if (this.phase === "menu" || this.phase === "moveSelect" || this.phase === "switchSelect" || this.phase === "bagSelect") {
        // Go back to menu
        if (this.phase !== "menu" && !this.battleState.needSwitch) {
          this.phase = "menu";
        }
      }
    }

    // Handle menu navigation
    if (this.phase === "menu") {
      const menuItems = this.getMenuItems();
      const dir = menuDirection();
      if (dir) playSfx("menu_move");
      if (dir === "up") this.cursor.move("battleMenu", menuItems.length, -3);
      if (dir === "down") this.cursor.move("battleMenu", menuItems.length, 3);
      if (dir === "left") this.cursor.move("battleMenu", menuItems.length, -1);
      if (dir === "right") this.cursor.move("battleMenu", menuItems.length, 1);
    } else if (this.phase === "moveSelect") {
      const moves = this.getActivePlayerRuin()?.moves || [];
      const dir = menuDirection();
      if (dir) playSfx("menu_move");
      if (dir === "up") this.cursor.move("battleMoves", moves.length, -2);
      if (dir === "down") this.cursor.move("battleMoves", moves.length, 2);
      if (dir === "left") this.cursor.move("battleMoves", moves.length, -1);
      if (dir === "right") this.cursor.move("battleMoves", moves.length, 1);
    } else if (this.phase === "switchSelect") {
      const switchable = this.getSwitchableRuins();
      const dir = menuDirection();
      if (dir) playSfx("menu_move");
      if (dir === "up") this.cursor.move("battleSwitch", switchable.length, -2);
      if (dir === "down") this.cursor.move("battleSwitch", switchable.length, 2);
      if (dir === "left") this.cursor.move("battleSwitch", switchable.length, -1);
      if (dir === "right") this.cursor.move("battleSwitch", switchable.length, 1);
    } else if (this.phase === "bagSelect") {
      const n = this.usableItems().length;
      const dir = menuDirection();
      if (dir) playSfx("menu_move");
      if (dir === "up") this.cursor.move("battleBag", n, -2);
      if (dir === "down") this.cursor.move("battleBag", n, 2);
      if (dir === "left") this.cursor.move("battleBag", n, -1);
      if (dir === "right") this.cursor.move("battleBag", n, 1);
    }
  }

  /** Items in the bag that work in this battle: mending the lead, and in the wild a Heavy Grip. */
  private usableItems(): { item: Item; count: number }[] {
    const bag = this.fieldState?.save?.bag ?? {};
    return ITEMS.filter((i) => (bag[i.key] ?? 0) > 0 && (i.use === "heal" || i.use === "full" || (i.use === "grip" && this.isWild)))
      .map((item) => ({ item, count: bag[item.key] }));
  }

  /** Uses an item as the player's turn; the opponent still acts. */
  private useItem(item: Item): void {
    const lead = this.getActivePlayerRuin();
    const bag = this.fieldState?.save?.bag;
    if (!lead || !bag || !(bag[item.key] > 0)) return;
    if (item.use === "heal") lead.hp = Math.min(lead.maxHp, lead.hp + Math.round(lead.maxHp * PASTE));
    else if (item.use === "full") lead.hp = lead.maxHp;
    else if (item.use === "grip") this.battleState.grip = true;
    bag[item.key]--;
    playSfx(item.use === "grip" ? "catch" : "level_up");
    this.executeAction("item", item.name);
  }

  private getMenuItems(): string[] {
    const items = ["Attack", "Moves", "Guard", this.getActivePlayerRuin()?.isLinkActive ? "Break Link" : "Link"];
    if (this.isWild) {
      items.push("Catch");
    }
    items.push("Switch", "Bag");
    if (this.isWild) {
      items.push("Run");
    }
    return items;
  }

  private getActivePlayerRuin(): RuinState | undefined {
    return this.battleState.playerTeam[0];
  }

  private getOpponentActiveRuin(): RuinState | undefined {
    return this.battleState.opponentTeam[0];
  }

  private getSwitchableRuins(): RuinState[] {
    return this.battleState.playerTeam.filter(
      (r, i) => i !== 0 && !r.isFainted
    );
  }

  /** Commands that cannot be chosen now: they show dimmed. */
  private disabledCommands(): Set<string> {
    const lead = this.getActivePlayerRuin();
    const off = new Set<string>();
    if (!lead) return off;
    if (lead.moves.every((m) => moveBlocked(this.battleState, m))) off.add("Moves");
    if (lead.isLinkActive ? !breakReady(this.battleState) : !linkReady(this.battleState)) off.add(lead.isLinkActive ? "Break Link" : "Link");
    if (rooted(lead) || !this.getSwitchableRuins().length) off.add("Switch");
    if (rooted(lead)) off.add("Run");
    if (!this.usableItems().length) off.add("Bag");
    return off;
  }

  private handleConfirm(): void {
    if (this.phase === "menu") {
      const menuItems = this.getMenuItems();
      const selected = this.cursor.get("battleMenu", menuItems.length);
      const action = menuItems[selected];
      if (this.disabledCommands().has(action)) return;

      if (action === "Attack") {
        this.executeAction("attack");
      } else if (action === "Moves") {
        this.phase = "moveSelect";
      } else if (action === "Guard") {
        this.executeAction("guard");
      } else if (action === "Link") {
        this.executeAction("link");
      } else if (action === "Break Link") {
        this.executeAction("breakLink");
      } else if (action === "Catch") {
        this.executeAction("catch");
      } else if (action === "Switch") {
        this.phase = "switchSelect";
      } else if (action === "Bag") {
        if (this.usableItems().length) this.phase = "bagSelect";
      } else if (action === "Run") {
        this.executeAction("run");
      }
    } else if (this.phase === "moveSelect") {
      const moves = this.getActivePlayerRuin()?.moves || [];
      const selected = this.cursor.get("battleMoves", moves.length);
      const move = moves[selected];
      if (move && !moveBlocked(this.battleState, move)) {
        this.executeAction("move", move.data.name);
      }
    } else if (this.phase === "switchSelect") {
      const switchable = this.getSwitchableRuins();
      const selected = this.cursor.get("battleSwitch", switchable.length);
      const target = switchable[selected];
      if (target) {
        const index = this.battleState.playerTeam.indexOf(target);
        this.executeAction("switch", undefined, index);
      }
    } else if (this.phase === "bagSelect") {
      const items = this.usableItems();
      const chosen = items[this.cursor.get("battleBag", items.length)];
      if (chosen) this.useItem(chosen.item);
    }
  }

  private executeAction(
    action: string,
    moveKey?: string,
    switchIndex?: number
  ): void {
    const result = executePlayerAction(
      this.battleState,
      action as any,
      moveKey,
      switchIndex
    );
    if (!result) return;

    if (result.includes("applied")) playSfx("status");
    if (result.includes("Caught")) {
      this.catchSuccess = true;
      this.startAnimation("catch");
      playSfx("catch");
    } else if (result.includes("fainted")) {
      this.startAnimation("faint");
      playSfx("ko");
    } else if (result.includes("Switched")) {
      this.startAnimation("switch");
      playSfx("menu_confirm");
    } else if (result.includes("used") || result.includes("attacked")) {
      this.startAnimation("hit");
      playSfx("hit");
    }

    this.lastLog = packLines(result.split("\n"));
    this.logIndex = 0;
    this.showLog = true;

    // Check for battle end
    if (this.battleState.fled) {
      if (this.fieldState) {
        setScene("field", { save: this.fieldState.save });
      } else {
        setScene("field");
      }
      return;
    } else if (this.battleState.winner) {
      this.phase = "result";
      this.processBattleEnd();
    } else {
      this.phase = "message";
    }
  }

  private startAnimation(type: "hit" | "faint" | "catch" | "switch"): void {
    this.phase = "animating";
    this.animType = type;
    this.animTimer = 0.5;

    if (type === "hit") {
      const opponent = this.getOpponentActiveRuin();
      this.animTarget = { x: 140, y: 40 };
    } else if (type === "faint") {
      const opponent = this.getOpponentActiveRuin();
      this.animTarget = { x: 140, y: 40 };
    } else if (type === "catch") {
      this.animTarget = { x: 140, y: 40 };
    } else if (type === "switch") {
      this.animTarget = { x: 40, y: 100 };
    }
  }

  private onAnimComplete(): void {
    this.phase = "message";
    this.animType = null;
    this.animTarget = null;
    this.showLog = true;
  }

  private processBattleEnd(): void {
    const won = this.battleState.winner === "player";
    const kind = this.isWild ? "wild" : this.trainerFlag?.startsWith("beat_") ? "boss" : "trainer";
    // Cinder pays for the win: twice the level in the wild, six times from a trainer, fifteen times from a big fight.
    // Passives on the standing team may change both rewards.
    const reward = {
      exp: won ? expFor(this.battleState.opponentTeam.map((r) => r.level), kind) : 0,
      cinder: won ? this.battleState.opponentTeam.reduce((sum, r) => sum + r.level * (kind === "boss" ? 15 : kind === "trainer" ? 6 : 2), 0) : 0,
    };
    battleRewards(this.battleState, won, reward);
    const gained = reward.exp;
    this.storageGain = Math.floor(gained / 2);
    this.cinder = reward.cinder;
    const exps: number[] = this.fieldState?.save?.partyExp ?? [];
    const slotOf = (ruin: any, i: number) => ruin.partyIndex ?? i;
    const expGained = this.battleState.playerTeam.map((r) => (r.isFainted ? 0 : gained));
    const levelsUp: number[] = [];
    this.partyExp = this.battleState.playerTeam.map((ruin, i) => {
      const g = grow(ruin.level, exps[slotOf(ruin, i)] ?? 0, expGained[i]);
      if (g.level > ruin.level) { levelsUp.push(i); playSfx("level_up"); }
      ruin.level = g.level;
      return g.exp;
    });

    this.resultData = {
      won,
      expGained,
      levelsUp,
      caught: this.catchSuccess ? this.battleState.opponentTeam[0].speciesKey : null,
    };
  }

  private onResultConfirm(): void {
    if (this.battleState.fled) {
      if (this.fieldState) {
        setScene("field", { save: this.fieldState.save });
      } else {
        setScene("field");
      }
      return;
    }

    if (this.fieldState) {
      // Apply battle results to field state
      const state = this.fieldState.save;
      if (state) {
        // Update levels
        // Switching reorders the battle team, so each Ruin carries its party slot.
        this.battleState.playerTeam.forEach((ruin, i) => {
          const slot = (ruin as any).partyIndex ?? i;
          if (slot < state.partyLevels.length) state.partyLevels[slot] = ruin.level;
          if (!state.partyExp) state.partyExp = state.party.map(() => 0);
          state.partyExp[slot] = this.partyExp[i] ?? state.partyExp[slot] ?? 0;
          if (!state.partyHp) state.partyHp = state.party.map(() => 9999);
          state.partyHp[slot] = ruin.hp;
        });
        // Add caught Ruin
        if (this.resultData?.caught) {
          // A full party sends the catch to storage, where it keeps its level.
          state.partyHp ??= state.party.map(() => 9999);
          addToParty(state, this.resultData.caught, this.battleState.opponentTeam[0].level, this.battleState.opponentTeam[0].hp);
        }
        if (this.cinder) state.bag.cinder = (state.bag.cinder ?? 0) + this.cinder;
        // Stored Ruin learn from the team's wins at half the rate.
        for (const r of state.storage ?? []) { const g = grow(r.level, r.exp ?? 0, this.storageGain); r.level = g.level; r.exp = g.exp; }
        if (this.trainerFlag && this.resultData?.won) {
          state.flags[this.trainerFlag] = true;
          // A beaten companion joins by giving the player a Ruin.
          if (this.gift && !state.flags[this.gift.flag]) {
            addToParty(state, this.gift.species, this.gift.level);
            state.flags[this.gift.flag] = true;
            if (this.gift.line && this.gift.speaker) state.pending = { speaker: this.gift.speaker, line: this.gift.line };
          }
          // A beaten Keeper's Resonance, and the Magnet growing.
          if (this.trainerFlag.startsWith("beat_")) {
            const lines = rewardKeeper(state, this.opponentTeam[0]);
            if (lines.length) state.pending = [...(state.pending ? (Array.isArray(state.pending) ? state.pending : [state.pending]) : []), ...lines];
          }
        }
        if (this.resultData && !this.resultData.won) {
          // A loss sends the party, healed, back to the start of this island.
          state.partyHp = undefined;
          state.mapId = state.mapId.replace(/_\d+$/, "_1");
          const first = state.mapId === "ashen_reach_1";
          state.playerX = first ? 15 : 2;
          state.playerY = first ? 10 : 12;
          state.playerDir = "down";
        }
        setScene("field", { save: state });
      } else {
        setScene("field");
      }
    } else {
      setScene("field");
    }
  }

  private drawLog(): void {
    const logText = this.lastLog[this.logIndex] || "";
    fillRect(0, 160, 192, 32, COLOR_SHADOW);
    // Wrap at spaces into rows that fit the box.
    const rows: string[] = [];
    for (const word of logText.split(" ")) {
      const last = rows[rows.length - 1];
      if (last !== undefined && textWidth(`${last} ${word}`) <= 176) rows[rows.length - 1] = `${last} ${word}`;
      else rows.push(word);
    }
    rows.slice(0, 3).forEach((row, i) => drawText(buffer, row, 8, 163 + i * 9, COLOR_STONE_WHITE));
  }

  render(): void {
    // Clear screen
    fillRect(0, 0, 192, 192, COLOR_VOID);

    // Draw battle background
    this.drawBattleBackground();
    this.shadeBackdrop();

    // Draw Ruin sprites
    this.drawRuinSprites();

    // Draw HUD
    if (this.phase !== "result") this.drawHUD();

    // Draw menu
    if (this.phase !== "animating" && this.phase !== "result") {
      this.drawMenu();
    }

    // Draw log
    if (this.showLog && this.lastLog.length > 0 && (this.phase === "message" || this.phase === "animating")) {
      this.drawLog();
    }

    // Draw animation effects
    if (this.phase === "animating") {
      this.drawAnimation();
    }

    // Draw result screen
    if (this.phase === "result") {
      this.drawResult();
    }

    present();
  }

  private backdrop: { cells: string[][]; pools: [number, number][] } | null = null;

  /** The island's ground as a battle backdrop: floor, grass under each Ruin, obstacles and a pool on the horizon. */
  private buildBackdrop(): { cells: string[][]; pools: [number, number][] } {
    const id = this.fieldState?.save?.mapId ?? "ashen_reach_1";
    let seed = [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    const next = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
    const cells: string[][] = Array.from({ length: 20 }, (_, ty) => Array.from({ length: 24 }, () => (ty < 3 ? "" : ".")));
    const patch = (cx: number, cy: number, rx: number, ry: number) => {
      for (let ty = cy - ry; ty <= cy + ry; ty++) for (let tx = cx - rx; tx <= cx + rx; tx++)
        if (cells[ty]?.[tx] !== undefined && ((tx - cx) / (rx + 0.5)) ** 2 + ((ty - cy) / (ry + 0.5)) ** 2 < 1) cells[ty][tx] = ",";
    };
    patch(16, 6, 3, 2);
    patch(6, 14, 4, 2);
    for (let tx = 0; tx < 24; tx++) if (next() < 0.35) cells[3][tx] = "P";
    for (let i = 0; i < 3; i++) cells[10 + Math.floor(next() * 8)][19 + Math.floor(next() * 5)] = "P";
    const pools: [number, number][] = [];
    const px = 1 + Math.floor(next() * 6);
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1]]) { cells[4 + dy][px + dx] = "~"; pools.push([px + dx, 4 + dy]); }
    return { cells, pools };
  }

  private drawBattleBackground(): void {
    fillRect(0, 0, 192, 192, COLOR_SHADOW);
    this.backdrop ??= this.buildBackdrop();
    const map = MAPS[this.fieldState?.save?.mapId ?? ""];
    const info = (l: string) => map?.tiles?.[l] ?? TILES[l];
    this.backdrop.cells.forEach((row, ty) => row.forEach((l, tx) => {
      if (!l) return;
      const t = info(l);
      if (t?.under && SPRITES[t.under]) drawSprite(SPRITES[t.under], tx * 8, ty * 8, 1);
      if (t && SPRITES[t.sprite]) drawSprite(SPRITES[t.sprite], tx * 8, ty * 8, 1);
    }));
    fillRect(0, 80, 192, 2, COLOR_GROUND_LIGHT);
  }

  private lightKey = "";
  private light: LightField | null = null;

  /** Lights the backdrop with the island's ambient light and each active Ruin's light in its type's color. */
  private shadeBackdrop(): void {
    const me = this.getActivePlayerRuin(), foe = this.getOpponentActiveRuin();
    const key = `${me?.speciesKey}/${foe?.speciesKey}`;
    if (key !== this.lightKey) {
      const colorOf = (r?: RuinState) => TYPE_LIGHT[SPECIES[r?.speciesKey ?? ""]?.types?.[0] ?? "Stone"] ?? TYPE_LIGHT.Stone;
      const map = MAPS[this.fieldState?.save?.mapId ?? ""];
      const glow = (map?.tiles?.["~"] ?? TILES["~"])?.glow ?? "dregs";
      this.light = battleLight(this.fieldState?.save?.mapId ?? "", [
        { x: 48, y: 108, r: 76, color: colorOf(me), power: 0.9 },
        { x: 128, y: 48, r: 64, color: colorOf(foe), power: 0.8 },
        ...(this.backdrop?.pools ?? []).map(([tx, ty]) => glowLight(glow, tx * 8 + 4, ty * 8 + 4)).filter((l): l is Light => !!l),
      ]);
      this.lightKey = key;
    }
    // Pools keep their own color, as on the field.
    const pools = new Set((this.backdrop?.pools ?? []).map(([tx, ty]) => `${tx},${ty}`));
    if (this.light) shadeRows(this.light, 0, 158, (x, y) => pools.has(`${x >> 3},${y >> 3}`));
  }

  private drawRuinSprites(): void {
    const playerRuin = this.getActivePlayerRuin();
    const opponentRuin = this.getOpponentActiveRuin();

    if (playerRuin) {
      const sprite = SPRITES[playerRuin.speciesKey];
      if (sprite) {
        drawSprite(sprite, 40, 100, 2);
      }
    }

    if (opponentRuin) {
      const sprite = SPRITES[opponentRuin.speciesKey];
      if (sprite) {
        drawSprite(sprite, 120, 40, 2);
      }
    }
  }

  private drawRuinLevel(ruin: RuinState, x: number, y: number): void {
    const species = SPECIES[ruin.speciesKey];
    if (species) {
      drawText(buffer, `Lv${ruin.level}`, x, y, COLOR_STONE_WHITE);
    }
  }

  private drawHUD(): void {
    let playerRuin = this.getActivePlayerRuin();
    const opponentRuin = this.getOpponentActiveRuin();

    // Dark backings keep the HUD readable over the lit ground, clear of both sprites.
    if (opponentRuin) {
      fillRect(6, 12, Math.max(88, textWidth(SPECIES[opponentRuin.speciesKey]?.name ?? "") + 8), 48, COLOR_SHADOW);
      fillRect(156, 12, 32, 12, COLOR_SHADOW);
    }
    if (playerRuin) fillRect(6, 121, 180, 34, COLOR_SHADOW);

    // Opponent HUD
    if (opponentRuin) {
      const species = SPECIES[opponentRuin.speciesKey];
      drawText(buffer, species.name, 10, 15, COLOR_STONE_WHITE);
      drawText(buffer, `Lv${opponentRuin.level}`, 160, 15, COLOR_STONE_WHITE);

      // HP Bar
      const hpPercent = opponentRuin.hp / opponentRuin.maxHp;
      const hpWidth = Math.floor(hpPercent * 80);
      fillRect(10, 30, 80, 4, COLOR_SHADOW);
      // A wild Ruin weak enough to catch shows a glowing bar.
      const catchable = this.catchableNow();
      fillRect(10, 30, hpWidth, 4, catchable ? COLOR_KILN_GLOW : hpPercent > 0.5 ? COLOR_GLAZE_RED_BRIGHT : COLOR_GLAZE_RED);

      // HP Text
      drawText(
        buffer,
        `${opponentRuin.hp}/${opponentRuin.maxHp}`,
        10,
        42,
        COLOR_STONE_WHITE
      );

      // Status icons
      let statusX = 10;
      for (const status of opponentRuin.statuses) {
        drawText(buffer, status.status[0], statusX, 50, COLOR_GLAZE_RED_BRIGHT);
        statusX += 8;
      }
    }

    // Player HUD. While choosing who to switch in, the box shows the Ruin under the cursor.
    if (playerRuin) {
      if (this.phase === "switchSelect") {
        const options = this.getSwitchableRuins();
        playerRuin = options[this.cursor.get("battleSwitch", options.length)] ?? playerRuin;
      }
      const species = SPECIES[playerRuin.speciesKey];
      drawText(buffer, species.name, 10, 124, COLOR_STONE_WHITE);
      drawText(buffer, `Lv${playerRuin.level}`, 160, 124, COLOR_STONE_WHITE);

      // While choosing a move, the box shows the chosen move's description on two rows in place of the HP.
      if (this.phase === "moveSelect" || this.phase === "bagSelect") {
        const moves = playerRuin.moves || [];
        const items = this.usableItems();
        const desc = this.phase === "bagSelect"
          ? items[this.cursor.get("battleBag", items.length)]?.item.description ?? ""
          : moves[this.cursor.get("battleMoves", moves.length)]?.data?.description ?? "";
        const rows: string[] = [];
        for (const word of desc.split(" ")) {
          const last = rows[rows.length - 1];
          if (last !== undefined && textWidth(`${last} ${word}`) <= 172) rows[rows.length - 1] = `${last} ${word}`;
          else rows.push(word);
        }
        rows.slice(0, 2).forEach((row, i) => drawText(buffer, row, 10, 135 + i * 9, COLOR_ASH));
        return;
      }

      // HP Bar
      const hpPercent = playerRuin.hp / playerRuin.maxHp;
      const hpWidth = Math.floor(hpPercent * 80);
      fillRect(10, 139, 80, 4, COLOR_SHADOW);
      fillRect(10, 139, hpWidth, 4, hpPercent > 0.5 ? COLOR_GLAZE_RED_BRIGHT : COLOR_GLAZE_RED);

      // HP Text
      drawText(
        buffer,
        `${playerRuin.hp}/${playerRuin.maxHp}`,
        10,
        146,
        COLOR_STONE_WHITE
      );

      // Status letters sit on the HP row, clear of the command box.
      let statusX = 18 + textWidth(`${playerRuin.hp}/${playerRuin.maxHp}`);
      for (const status of playerRuin.statuses) {
        drawText(buffer, status.status[0], statusX, 146, COLOR_GLAZE_RED_BRIGHT);
        statusX += 8;
      }
    }

    // Boost pool
    drawText(buffer, `Boost: ${this.battleState.boost}`, 182 - textWidth(`Boost: ${this.battleState.boost}`), 146, COLOR_KILN_GLOW);
  }

  private drawMenu(): void {
    const menuItems = this.getMenuItems();
    const selected = this.cursor.get("battleMenu", menuItems.length);

    if (this.phase === "menu") {
      const off = this.disabledCommands();
      this.drawMenuGrid(menuItems, selected, 3, (i) => off.has(menuItems[i]), [],
        (i) => (menuItems[i] === "Attack" ? this.matchupOf(MOVES.glass_slam, true) : 1));
    } else if (this.phase === "moveSelect") {
      const moves = this.getActivePlayerRuin()?.moves || [];
      const selectedMove = this.cursor.get("battleMoves", moves.length);
      // Up to six moves in two columns; the description shows in the player's box above, and a move's Boost cost
      // sits at the end of its column in the Boost counter's color.
      this.drawMenuGrid(moves.map(m => m.data.name), selectedMove, 2, (i) => !!moveBlocked(this.battleState, moves[i]),
        moves.map((m) => (m.data.boostCost ? String(m.data.boostCost) : "")), (i) => this.matchupOf(moves[i].data, false));
    } else if (this.phase === "switchSelect") {
      const switchable = this.getSwitchableRuins();
      const selectedSwitch = this.cursor.get("battleSwitch", switchable.length);
      const names = switchable.map(s => SPECIES[s.speciesKey].name);
      this.drawMenuGrid(names, selectedSwitch, 2);
    } else if (this.phase === "bagSelect") {
      const items = this.usableItems();
      this.drawMenuGrid(items.map((i) => `${i.item.name} x${i.count}`), this.cursor.get("battleBag", items.length), 2);
    }
  }

  /** Whether a catch would hold now: a wild Ruin at half its HP or less. */
  private catchableNow(): boolean {
    const foe = this.getOpponentActiveRuin(), lead = this.getActivePlayerRuin();
    return this.isWild && !!foe && !!lead && canCatch(lead, foe, !!this.battleState.grip, this.battleState.magnet ?? 2);
  }

  /** How the active Ruin's hit with this move would land on the foe by type: above 1 hits harder. */
  private matchupOf(move: MoveData, basic: boolean): number {
    const me = this.getActivePlayerRuin(), foe = this.getOpponentActiveRuin();
    return me && foe && move && move.power > 0 ? matchup(me, foe, move, basic) : 1;
  }

  /** Commands in columns. The chosen one has a glowing bar; one that cannot be chosen now is dimmed; an attack the
   * foe's type takes harder is pale gold and one it shrugs off is brown. */
  private drawMenuGrid(items: string[], selected: number, cols = 3, dim: (i: number) => boolean = () => false, tags: string[] = [],
    edge: (i: number) => number = () => 1): void {
    fillRect(0, 160, 192, 32, COLOR_SHADOW);
    const colWidth = Math.floor(192 / cols);
    for (let i = 0; i < items.length; i++) {
      const x = 5 + (i % cols) * colWidth;
      const y = 162 + Math.floor(i / cols) * 9;
      if (i === selected) fillRect(x - 4, y + 1, 2, 6, COLOR_KILN_GLOW);
      // Catch glows while the wild Ruin is weak enough to catch; a command that cannot be chosen now is dimmed.
      const glow = items[i] === "Catch" && this.phase === "menu" && this.catchableNow();
      const m = edge(i);
      const color = glow ? COLOR_KILN_GLOW : dim(i) ? COLOR_DIM : m > 1 ? COLOR_STAR : m < 1 ? COLOR_METAL : i === selected ? COLOR_STONE_WHITE : COLOR_STONE_DARK;
      drawText(buffer, items[i], x, y, color);
      if (tags[i]) drawText(buffer, tags[i], x + colWidth - 12 - textWidth(tags[i]), y, dim(i) ? COLOR_DIM : COLOR_KILN_GLOW);
    }
  }

  private drawAnimation(): void {
    if (!this.animTarget) return;

    const progress = 1 - this.animTimer / 0.5;

    if (this.animType === "hit") {
      // Flash effect
      if (progress < 0.2) {
        fillRect(
          this.animTarget.x - 8,
          this.animTarget.y - 8,
          16,
          16,
          COLOR_STONE_WHITE
        );
      }
    } else if (this.animType === "faint") {
      // Fading effect
      if (progress < 0.5) {
        const alpha = 1 - progress * 2;
        fillRect(
          this.animTarget.x - 8,
          this.animTarget.y - 8,
          16,
          16,
          COLOR_SHADOW
        );
      }
    } else if (this.animType === "catch") {
      // Catch animation
      if (progress < 0.3) {
        fillRect(
          this.animTarget.x - 8,
          this.animTarget.y - 8,
          16,
          16,
          COLOR_KILN_GLOW
        );
      }
    } else if (this.animType === "switch") {
      // Switch animation
      if (progress < 0.3) {
        fillRect(
          this.animTarget.x - 8,
          this.animTarget.y - 8,
          16,
          16,
          COLOR_KILN_GLOW
        );
      }
    }
  }

  private drawResult(): void {
    if (!this.resultData) return;

    // Result background
    fillRect(0, 0, 192, 192, COLOR_VOID);

    const centered = (text: string, y: number, color: string) => drawText(buffer, text, 96 - Math.floor(textWidth(text) / 2), y, color);
    if (this.resultData.won) {
      centered("Victory!", 56, COLOR_KILN_GLOW);
      // One row per team member: name on the left, EXP and any new level in columns on the right.
      let y = 76;
      const rd = this.resultData;
      this.battleState.playerTeam.forEach((ruin, i) => {
        const name = SPECIES[ruin.speciesKey]?.name || ruin.speciesKey;
        const exp = `${rd.expGained[i] || 0} EXP`;
        drawText(buffer, name, 8, y, COLOR_STONE_WHITE);
        drawText(buffer, exp, 150 - textWidth(exp), y, COLOR_STONE_WHITE);
        if (rd.levelsUp.includes(i)) drawText(buffer, `Lv${ruin.level}`, 184 - textWidth(`Lv${ruin.level}`), y, COLOR_GLAZE_RED_BRIGHT);
        y += 10;
      });
      y += 6;
      if (this.cinder) { centered(`+${this.cinder} Cinder`, y, COLOR_STONE_WHITE); y += 12; }
      if (rd.levelsUp.length > 0) { centered("Level up!", y, COLOR_GLAZE_RED_BRIGHT); y += 12; }
      if (rd.caught) centered(`Caught ${SPECIES[rd.caught]?.name ?? rd.caught}!`, y, COLOR_KILN_GLOW);
    } else {
      centered("Defeated...", 80, COLOR_GLAZE_RED);
      centered("Returning to town...", 100, COLOR_ASH);
    }

    centered("Press Z to continue", 172, COLOR_ASH);
  }
}
