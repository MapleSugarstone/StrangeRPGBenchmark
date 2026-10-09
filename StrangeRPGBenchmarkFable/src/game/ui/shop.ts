import type { Scene } from "../../engine/scene";
import type { Screen } from "../../engine/screen";
import type { Key } from "../../engine/input";
import type { Game } from "../game";
import { ITEMS } from "../data/items";
import { ListMenu, type ListItem } from "./list";
import { drawFooter } from "./menu";
import { LINE_H } from "../../engine/font";

/** Shop names run to 28 letters, so the salt count gets a line of its own under the name. */
const SHOP_LINE_Y = 7 + LINE_H * 2;
const SHOP_LIST_Y = SHOP_LINE_Y + 4;
const SHOP_ROWS = 12;

/** Buy and sell. Prices are in salt. Selling pays half. */
export class ShopScene implements Scene {
  overlay = true;
  private mode: "root" | "buy" | "sell" = "root";
  private root: ListMenu;
  private list: ListMenu | null = null;
  private status = "";

  constructor(private game: Game, private stock: string[], private title: string, private done: () => void) {
    this.root = new ListMenu([{ label: "Buy" }, { label: "Sell" }, { label: "Leave" }], 3, (it) => {
      if (it.label === "Buy") { this.mode = "buy"; this.list = this.buyList(); }
      else if (it.label === "Sell") { this.mode = "sell"; this.list = this.sellList(); }
      else this.close();
    }, () => this.close());
  }

  private close(): void {
    this.game.stack.pop();
    this.done();
  }

  private buyList(): ListMenu {
    const items: ListItem[] = this.stock.map((id) => ({ label: ITEMS[id].name, right: `${ITEMS[id].price}`, desc: ITEMS[id].desc, sprite: ITEMS[id].sprite, value: id, disabled: ITEMS[id].price > this.game.state.gold }));
    return new ListMenu(items, SHOP_ROWS, (it) => {
      const id = it.value as string;
      this.game.state.gold -= ITEMS[id].price;
      this.game.addItem(id);
      this.status = `Bought ${ITEMS[id].name}.`;
      const cur = this.list!.cursor;
      this.list = this.buyList();
      this.list.cursor = cur;
    }, () => { this.mode = "root"; this.list = null; });
  }

  private sellList(): ListMenu {
    const inv = this.game.state.inventory;
    const ids = Object.keys(inv).filter((k) => inv[k] > 0 && ITEMS[k].kind !== "key" && ITEMS[k].price > 0);
    const items: ListItem[] = ids.map((id) => ({ label: ITEMS[id].name, right: `${Math.floor(ITEMS[id].price / 2)} x${inv[id]}`, desc: ITEMS[id].desc, sprite: ITEMS[id].sprite, value: id }));
    return new ListMenu(items, SHOP_ROWS, (it) => {
      const id = it.value as string;
      this.game.state.gold += Math.floor(ITEMS[id].price / 2);
      this.game.removeItem(id);
      this.status = `Sold ${ITEMS[id].name}.`;
      const cur = this.list!.cursor;
      this.list = this.sellList();
      this.list.cursor = Math.min(cur, Math.max(0, this.list.items.length - 1));
    }, () => { this.mode = "root"; this.list = null; });
  }

  key(k: Key): void {
    (this.list ?? this.root).key(k);
  }

  update(_dt: number): void {}

  draw(s: Screen): void {
    s.dim(0.6);
    s.panel(4, 4, 184, 184, "dark", "white");
    s.text(this.title, 8, 7, "yellow");
    s.text(`${this.game.state.gold} salt`, 8, 7 + LINE_H, "white");
    s.rect(5, SHOP_LINE_Y, 182, 1, "gray");
    const menu = this.list ?? this.root;
    menu.draw(s, 8, SHOP_LIST_Y, 176);
    const desc = this.status || menu.current?.desc || (this.mode === "root" ? "Salt is money here. Everything is salt." : "");
    drawFooter(s, desc, this.status ? "lime" : "salt");
    this.status = "";
  }
}
