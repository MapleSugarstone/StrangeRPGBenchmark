import { fillRect, drawSprite } from "../engine/screen.js";
import { buffer } from "../engine/screen.js";
import { drawText, textWidth } from "../engine/font.js";
import { isConfirm, isBack, updateInput, MenuCursor, menuDirection, wasPressed } from "../engine/input.js";
import { COLOR_VOID, COLOR_SHADOW, COLOR_ASH, COLOR_KILN_GLOW, COLOR_STONE_WHITE, COLOR_GLAZE_RED, COLOR_GLAZE_RED_BRIGHT, COLOR_GROUND, COLOR_GROUND_LIGHT } from "../engine/palette.js";
import { PASSIVE_TEXT } from "../content/passive_code.js";
import { setScene } from "../engine/scene_manager.js";
import { RESONANCE, RESONANCE_MENU } from "../content/resonance.js";
import { REGISTER_MENU, REGISTER_TITLE, RENAME_TITLE } from "../content/goals.js";
import { GameState, saveGame, settleStorage, swapWithStorage, swapInParty, quenchLayers, QUENCH_MAX } from "../engine/game_state.js";
import { SPECIES } from "../battle/species.js";
import { ruinMaxHp } from "../battle/engine.js";
import { SPRITES } from "../art/sprites.js";
import { ITEM, PASTE } from "../content/items.js";
import { playSfx } from "../engine/audio.js";

// Module-level, so each list's cursor starts on the option used last.
const cursor = new MenuCursor();
/** The options, with the Resonance option once a Resonance has been won. */
const optionsFor = (state: GameState) => ["Team", "Bag", REGISTER_MENU, ...(state.resonance?.owned?.length ? [RESONANCE_MENU] : []), "Save", "Back"];
const REGISTER_ROWS = 9;
const ROWS = 10; // Rows a list shows at once; longer lists scroll with the cursor.

/** One row per party Ruin: its name, level, and HP now and at most. */
export function teamRows(state: GameState): { key: string; name: string; level: number; hp: number; max: number }[] {
  return state.party.map((key, i) => {
    const level = state.partyLevels[i] ?? 1, max = ruinMaxHp(key, level);
    return { key, name: state.partyNames?.[i] || (SPECIES[key]?.name ?? key), level, hp: Math.min(max, state.partyHp?.[i] ?? max), max };
  });
}

/** One row per stored Ruin: its name and level. */
export function storageRows(state: GameState): { key: string; name: string; level: number }[] {
  return (state.storage ?? []).map((r) => ({ key: r.key, name: SPECIES[r.key]?.name ?? r.key, level: r.level }));
}

/** One row per bag item with its count. Ruin are kept in storage, not the bag. */
export function bagRows(state: GameState): { key: string; name: string; count: number }[] {
  return Object.entries(state.bag ?? {}).filter(([k, n]) => n > 0 && !SPECIES[k]).map(([key, count]) => ({
    key, name: ITEM[key]?.name ?? key.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "), count,
  }));
}

/** Uses a mending item from the bag on a party Ruin. Returns whether it did anything. */
export function useOn(state: GameState, itemKey: string, slot: number): boolean {
  const item = ITEM[itemKey], row = teamRows(state)[slot];
  if (!item || !row || !(state.bag[itemKey] > 0)) return false;
  let hp = row.hp;
  if ((item.use === "heal" || item.use === "full") && hp > 0 && hp < row.max) hp = item.use === "full" ? row.max : Math.min(row.max, hp + Math.round(row.max * PASTE));
  else if (item.use === "revive" && hp <= 0) hp = Math.round(row.max / 2);
  else return false;
  (state.partyHp ??= state.party.map(() => 9999))[slot] = hp;
  state.bag[itemKey]--;
  return true;
}

export class MenuScene {
  private state: GameState;
  private view: "options" | "team" | "storage" | "bag" | "target" | "wear" | "register" | "rename" = "options";
  /** The name being typed on the naming screen. */
  private typed = "";
  private savedFlash = 0;
  private slot = 0;
  private using = "";
  /** The team member picked up to move, or -1. */
  private held = -1;

  constructor(data?: any) {
    this.state = data?.save || ({} as GameState);
    if (this.state.party) settleStorage(this.state, (k) => !!SPECIES[k]);
  }

  update(dt: number): void {
    updateInput(dt);
    this.savedFlash = Math.max(0, this.savedFlash - dt);
    const dir = menuDirection();
    if (dir === "up" || dir === "down") playSfx("menu_move");
    const step = dir === "up" ? -1 : dir === "down" ? 1 : 0;
    const party = this.state.party.length;
    if (this.view === "rename") {
      // Letters and space type, Backspace erases, Enter keeps the name, Esc leaves it as it was.
      for (const c of "abcdefghijklmnopqrstuvwxyz ") if (wasPressed(c) && this.typed.length < 12) this.typed += this.typed ? c : c.toUpperCase();
      if (wasPressed("backspace")) this.typed = this.typed.slice(0, -1);
      if (wasPressed("enter")) {
        (this.state.partyNames ??= this.state.party.map(() => ""))[this.slot] = this.typed.trim();
        playSfx("menu_confirm");
        this.view = "team";
      } else if (wasPressed("escape")) this.view = "team";
      return;
    }
    if (this.view === "register") {
      if (step) cursor.move("register", registerKeys(this.state).length, step);
      if (isBack()) this.view = "options";
      return;
    }
    if (this.view === "team" && wasPressed("r")) {
      this.slot = cursor.get("team", party);
      this.typed = this.state.partyNames?.[this.slot] ?? "";
      this.view = "rename";
      return;
    }
    if (this.view === "team" || this.view === "target") {
      if (step) cursor.move("team", party, step);
      if (isConfirm() && this.view === "target") {
        playSfx(useOn(this.state, this.using, cursor.get("team", party)) ? "level_up" : "ko");
        this.view = "bag";
      } else if (isConfirm()) {
        // Z picks a Ruin up; Z on another swaps their places, and Z on the same one opens storage.
        const at = cursor.get("team", party);
        if (this.held < 0) {
          this.held = at;
          playSfx("menu_confirm");
        } else if (this.held !== at) {
          swapInParty(this.state, this.held, at);
          this.held = -1;
          playSfx("door");
        } else {
          this.held = -1;
          if ((this.state.storage?.length ?? 0) > 0) {
            playSfx("menu_confirm");
            this.slot = at;
            this.view = "storage";
          }
        }
      } else if (isBack()) {
        if (this.held >= 0) this.held = -1;
        else this.view = this.view === "target" ? "bag" : "options";
      }
      return;
    }
    if (this.view === "storage") {
      const count = this.state.storage?.length ?? 0;
      if (step) cursor.move("storage", count, step);
      if (isConfirm() && count > 0) {
        swapWithStorage(this.state, this.slot, cursor.get("storage", count));
        playSfx("door");
        this.view = "team";
      } else if (isBack()) this.view = "team";
      return;
    }
    if (this.view === "bag") {
      const rows = bagRows(this.state);
      if (step) cursor.move("bag", rows.length, step);
      const chosen = rows[cursor.get("bag", rows.length)];
      const use = chosen && ITEM[chosen.key]?.use;
      if (isConfirm() && (use === "heal" || use === "full" || use === "revive")) {
        playSfx("menu_confirm");
        this.using = chosen.key;
        this.view = "target";
      } else if (isBack()) this.view = "options";
      return;
    }
    if (this.view === "wear") {
      const owned = this.state.resonance?.owned ?? [];
      if (step) cursor.move("wear", owned.length, step);
      if (isConfirm() && owned.length) {
        this.state.resonance!.worn = owned[cursor.get("wear", owned.length)];
        playSfx("menu_confirm");
      } else if (isBack()) this.view = "options";
      return;
    }
    const OPTIONS = optionsFor(this.state);
    if (step) cursor.move("menu", OPTIONS.length, step);
    if (isConfirm()) {
      const choice = OPTIONS[cursor.get("menu", OPTIONS.length)];
      playSfx("menu_confirm");
      if (choice === "Team") this.view = "team";
      else if (choice === "Bag") this.view = "bag";
      else if (choice === RESONANCE_MENU) this.view = "wear";
      else if (choice === REGISTER_MENU) this.view = "register";
      else if (choice === "Save") { saveGame(this.state); this.savedFlash = 1.5; }
      else setScene("field", { save: this.state });
    } else if (isBack()) {
      setScene("field", { save: this.state });
    }
  }

  render(): void {
    fillRect(0, 0, 192, 192, COLOR_VOID);
    if (this.view === "team" || this.view === "target") return this.team();
    if (this.view === "storage") return this.list(storageRows(this.state).map((r) => [r.name, `Lv${r.level}`, r.key]), cursor.get("storage", this.state.storage?.length ?? 0), this.slot);
    if (this.view === "bag") {
      const rows = bagRows(this.state);
      this.list(rows.map((r) => [r.name, `x${r.count}`, ""]), cursor.get("bag", rows.length));
      const desc = ITEM[rows[cursor.get("bag", rows.length)]?.key]?.description;
      if (desc) drawText(buffer, desc, 18, 164, COLOR_ASH);
      return;
    }
    if (this.view === "wear") return this.wear();
    if (this.view === "register") return this.register();
    if (this.view === "rename") return this.rename();
    fillRect(40, 40, 112, 100, COLOR_SHADOW);
    fillRect(41, 41, 110, 98, COLOR_VOID);
    const OPTIONS = optionsFor(this.state);
    const sel = cursor.get("menu", OPTIONS.length);
    OPTIONS.forEach((o, i) => {
      // A save lights the Save option for a moment.
      const color = o === "Save" && this.savedFlash > 0 ? COLOR_KILN_GLOW : i === sel ? COLOR_STONE_WHITE : COLOR_ASH;
      drawText(buffer, (i === sel ? "> " : "  ") + o, 50, 50 + i * 20, color);
    });
  }

  /** Every species: met ones with sprite and name (white once held), unmet ones as dark silhouettes, and the count met. */
  private register(): void {
    const keys = registerKeys(this.state), sel = cursor.get("register", keys.length);
    const seen = new Set(this.state.seen ?? []), held = new Set([...(this.state.caught ?? []), ...this.state.party, ...(this.state.storage ?? []).map((r) => r.key)]);
    fillRect(12, 8, 168, 176, COLOR_SHADOW);
    fillRect(13, 9, 166, 174, COLOR_VOID);
    drawText(buffer, REGISTER_TITLE, 18, 14, COLOR_KILN_GLOW);
    const count = `${keys.filter((k) => seen.has(k) || held.has(k)).length}/${keys.length}`;
    drawText(buffer, count, 174 - textWidth(count), 14, COLOR_ASH);
    const top = Math.max(0, Math.min(sel - REGISTER_ROWS + 1, keys.length - REGISTER_ROWS));
    keys.slice(top, top + REGISTER_ROWS).forEach((k, n) => {
      const i = top + n, y = 30 + n * 16, met = seen.has(k) || held.has(k);
      if (i === sel) fillRect(15, y + 1, 2, 6, COLOR_KILN_GLOW);
      const sprite = SPRITES[k];
      if (sprite) drawSprite(met ? sprite : { ...sprite, colors: sprite.colors.map(() => COLOR_GROUND) }, 20, y - 1, 1);
      if (met) drawText(buffer, SPECIES[k]?.name ?? k, 32, y, held.has(k) ? COLOR_STONE_WHITE : COLOR_ASH);
    });
  }

  /** The naming screen: the Ruin and the name being typed, with a bar where the next letter goes. */
  private rename(): void {
    fillRect(12, 40, 168, 80, COLOR_SHADOW);
    fillRect(13, 41, 166, 78, COLOR_VOID);
    drawText(buffer, RENAME_TITLE, 20, 48, COLOR_KILN_GLOW);
    const key = this.state.party[this.slot];
    if (SPRITES[key]) drawSprite(SPRITES[key], 20, 70, 2);
    drawText(buffer, this.typed, 44, 74, COLOR_STONE_WHITE);
    fillRect(44 + textWidth(this.typed) + 1, 82, 5, 1, COLOR_KILN_GLOW);
  }

  /** The Resonances won: the worn one glows, and the chosen one's text shows below. */
  private wear(): void {
    const owned = this.state.resonance?.owned ?? [], sel = cursor.get("wear", owned.length);
    fillRect(12, 16, 168, 160, COLOR_SHADOW);
    fillRect(13, 17, 166, 158, COLOR_VOID);
    owned.forEach((k, i) => {
      const y = 24 + i * 14;
      if (i === sel) fillRect(15, y + 1, 2, 6, COLOR_KILN_GLOW);
      const worn = this.state.resonance?.worn === k;
      drawText(buffer, RESONANCE[k]?.name ?? k, 22, y, worn ? COLOR_KILN_GLOW : i === sel ? COLOR_STONE_WHITE : COLOR_ASH);
    });
    const text = RESONANCE[owned[sel]]?.text;
    if (text) wrap(text, 156).slice(0, 2).forEach((row, i) => drawText(buffer, row, 18, 152 + i * 10, COLOR_ASH));
  }

  /** The team: name, level, and an HP bar per Ruin; while an item is being used, the bar shows who needs it. */
  private team(): void {
    const rows = teamRows(this.state), sel = cursor.get("team", rows.length);
    fillRect(12, 16, 168, 160, COLOR_SHADOW);
    fillRect(13, 17, 166, 158, COLOR_VOID);
    rows.forEach((r, i) => {
      const y = 24 + i * 14;
      // A picked-up Ruin sits on a band until it is placed.
      if (i === this.held) fillRect(14, y - 2, 164, 12, COLOR_SHADOW);
      if (i === sel) fillRect(15, y + 1, 2, 6, COLOR_KILN_GLOW);
      if (SPRITES[r.key]) drawSprite(SPRITES[r.key], 19, y - 1, 1);
      drawText(buffer, r.name, 30, y, i === sel ? COLOR_STONE_WHITE : COLOR_ASH);
      drawText(buffer, `Lv${r.level}`, 122, y, COLOR_ASH);
      fillRect(150, y + 2, 24, 4, COLOR_SHADOW);
      fillRect(150, y + 2, Math.round((24 * r.hp) / r.max), 4, r.hp / r.max > 0.5 ? COLOR_GLAZE_RED_BRIGHT : COLOR_GLAZE_RED);
      // Quench layers: ten small cells under the HP bar, lit one per layer.
      const layers = quenchLayers(this.state.partyQuench?.[i]);
      for (let k = 0; k < QUENCH_MAX; k++) fillRect(150 + k * 2 + (k >= 5 ? 1 : 0), y + 8, 1, 1, k < layers ? COLOR_KILN_GLOW : COLOR_SHADOW);
    });
    if (this.view === "target") { drawText(buffer, ITEM[this.using]?.name ?? "", 18, 164, COLOR_KILN_GLOW); return; }
    // The chosen Ruin's passive (a fused Ruin's first), and the key that names a Ruin.
    const key = rows[sel]?.key;
    const passive = key ? PASSIVE_TEXT[SPECIES[key]?.passiveOf?.[0] ?? key] : undefined;
    if (passive) {
      drawText(buffer, passive.name, 18, 122, COLOR_KILN_GLOW);
      wrap(passive.text, 156).slice(0, 2).forEach((row, i) => drawText(buffer, row, 18, 134 + i * 10, COLOR_ASH));
    }
    drawText(buffer, `R: ${RENAME_TITLE}`, 18, 164, COLOR_GROUND_LIGHT);
  }

  /** A list in a box: the chosen row is white with a glowing bar, and long lists scroll with it. For storage,
   * the team member being swapped out shows small in the corner. */
  private list(rows: [string, string, string][], selected: number, swapping = -1): void {
    fillRect(12, 16, 168, 160, COLOR_SHADOW);
    fillRect(13, 17, 166, 158, COLOR_VOID);
    const top = Math.max(0, Math.min(selected - ROWS + 1, rows.length - ROWS));
    rows.slice(top, top + ROWS).forEach(([left, right, sprite], k) => {
      const i = top + k, y = 24 + k * 14;
      if (i === selected) fillRect(15, y + 1, 2, 6, COLOR_KILN_GLOW);
      if (sprite && SPRITES[sprite]) drawSprite(SPRITES[sprite], 19, y - 1, 1);
      drawText(buffer, left, 30, y, i === selected ? COLOR_STONE_WHITE : COLOR_ASH);
      drawText(buffer, right, 172 - textWidth(right), y, COLOR_ASH);
    });
    if (swapping >= 0 && SPRITES[this.state.party[swapping]]) drawSprite(SPRITES[this.state.party[swapping]], 166, 164, 1);
  }
}

/** Splits text into rows that fit a width. */
function wrap(text: string, width: number): string[] {
  const rows: string[] = [];
  for (const word of text.split(" ")) {
    const last = rows[rows.length - 1];
    if (last !== undefined && textWidth(`${last} ${word}`) <= width) rows[rows.length - 1] = `${last} ${word}`;
    else rows.push(word);
  }
  return rows;
}

/** Every species in the order the game meets them, then any fusions the save holds. */
function registerKeys(state: GameState): string[] {
  return [...Object.keys(SPECIES).filter((k) => !k.startsWith("fusion_")), ...Object.keys(state.fusions ?? {})];
}
