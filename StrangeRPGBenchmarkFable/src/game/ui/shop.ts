import type { Scene } from "../../engine/scene";
import type { Screen } from "../../engine/screen";
import type { Key } from "../../engine/input";
import type { Game } from "../game";
import { ITEMS } from "../data/items";
import { ListMenu, type ListItem } from "./list";
import { wrapDesc } from "./menu";

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
    return new ListMenu(items, 9, (it) => {
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
    return new ListMenu(items, 9, (it) => {
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
    s.textRight(`${this.game.state.gold} salt`, 184, 7, "white");
    s.rect(5, 15, 182, 1, "gray");
    const menu = this.list ?? this.root;
    menu.draw(s, 8, 20, 176);
    s.rect(5, 170, 182, 1, "gray");
    const desc = this.status || menu.current?.desc || (this.mode === "root" ? "Salt is money here. Everything is salt." : "");
    wrapDesc(desc, 44).slice(0, 2).forEach((l, i) => s.text(l, 8, 173 + i * 7, this.status ? "lime" : "salt"));
    this.status = "";
  }
}
