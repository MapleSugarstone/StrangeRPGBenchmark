import type { Scene } from "../../engine/scene";
import type { Screen } from "../../engine/screen";
import type { Key } from "../../engine/input";
import { getSprite } from "../../engine/sprites";
import type { Game } from "../game";
import type { PartyMember, StatKey } from "../types";
import { STAT_KEYS } from "../types";
import { ITEMS, WORDS } from "../data/items";
import { SKILLS } from "../data/skills";
import { CHARACTERS, CLASSES, xpForLevel } from "../data/classes";
import { MECHANIC_INFO } from "../story/mechanics";
import { memberStats, learnedSkills, canEquip } from "../party";
import { ListMenu, type ListItem } from "./list";

type Page = { title: string; list: ListMenu; draw?: (s: Screen) => void; member?: PartyMember };

/** Pause menu. Pages stack inside the scene so cancel walks back. */
export class MenuScene implements Scene {
  overlay = true;
  private pages: Page[] = [];
  private status = "";

  constructor(private game: Game) {
    this.pages.push(this.rootPage());
  }

  private get st() { return this.game.state; }
  private get page() { return this.pages[this.pages.length - 1]; }

  private push(p: Page): void { this.pages.push(p); }
  private pop(): void {
    this.pages.pop();
    if (this.pages.length === 0) this.game.stack.pop();
  }

  key(k: Key): void {
    if (k === "menu") { this.game.stack.pop(); return; }
    this.page.list.key(k);
  }

  update(_dt: number): void {}

  // ---------- Pages ----------

  private rootPage(): Page {
    const items: ListItem[] = [
      { label: "Items", desc: "Use or look at what you carry." },
      { label: "Equip", desc: "Weapons, armor, accessories." },
      { label: "Skills", desc: "What each member can do." },
    ];
    if (this.st.mechanics.includes("memories")) items.push({ label: "Memories", desc: "Slot Memories onto party members." });
    if (this.st.mechanics.includes("words")) items.push({ label: "Words", desc: "Words you have found." });
    items.push({ label: "Party", desc: "Swap active and reserve members." });
    items.push({ label: "Status", desc: "Numbers." });
    items.push({ label: "Story", desc: "Where you are in the story." });
    items.push({ label: "Save", desc: "Save anywhere. Lamps heal too." });
    items.push({ label: "Close", desc: "" });
    const list = new ListMenu(items, 10, (it) => {
      switch (it.label) {
        case "Items": this.push(this.itemsPage()); break;
        case "Equip": this.push(this.pickMember("Equip", (m) => this.push(this.equipPage(m)))); break;
        case "Skills": this.push(this.pickMember("Skills", (m) => this.push(this.skillsPage(m)))); break;
        case "Memories": this.push(this.pickMember("Memories", (m) => this.push(this.memoriesPage(m)))); break;
        case "Words": this.push(this.wordsPage()); break;
        case "Party": this.push(this.partyPage()); break;
        case "Status": this.push(this.pickMember("Status", (m) => this.push(this.statusPage(m)))); break;
        case "Story": this.push(this.storyPage()); break;
        case "Save": this.status = this.game.save() ? "Saved." : "Could not save."; break;
        case "Close": this.game.stack.pop(); break;
      }
    }, () => this.pop());
    return { title: "Menu", list };
  }

  private pickMember(title: string, onPick: (m: PartyMember) => void): Page {
    const members = this.game.membersAll();
    const list = new ListMenu(members.map((m) => ({ label: CHARACTERS[m.charId].name, right: `L${m.level}`, sprite: CHARACTERS[m.charId].sprite, value: m })), 9, (it) => onPick(it.value as PartyMember), () => this.pop());
    return { title, list };
  }

  private itemsPage(): Page {
    const inv = this.st.inventory;
    const ids = Object.keys(inv).filter((k) => inv[k] > 0).sort((a, b) => kindOrder(a) - kindOrder(b));
    const items: ListItem[] = ids.map((id) => ({ label: ITEMS[id].name, right: `x${inv[id]}`, desc: ITEMS[id].desc, sprite: ITEMS[id].sprite, value: id, color: ITEMS[id].kind === "key" ? "yellow" : ITEMS[id].kind === "memory" ? "pink" : "white" }));
    const list = new ListMenu(items, 9, (it) => {
      const id = it.value as string;
      const def = ITEMS[id];
      if (!def.use || def.use.battleOnly) { this.status = "Not usable here."; return; }
      if (def.use.target === "self" && id === "tooth") { this.st.debt = Math.max(0, this.st.debt - 5); this.game.removeItem(id); this.status = `Debt is now ${this.st.debt}.`; this.pages[this.pages.length - 1] = this.itemsPage(); return; }
      this.push(this.pickMember("Use on", (m) => {
        const stats = memberStats(m);
        if (def.use!.revive) { if (m.hp > 1) { this.status = "Not fallen."; return; } m.hp = Math.max(1, Math.round(stats.hp * def.use!.revive)); }
        if (def.use!.heal) m.hp = Math.min(stats.hp, m.hp + def.use!.heal);
        if (def.use!.healPct) m.hp = Math.min(stats.hp, m.hp + Math.round(stats.hp * def.use!.healPct));
        if (def.use!.st || def.use!.stPct) m.st = Math.min(stats.st, m.st + (def.use!.st ?? 0) + Math.round(stats.st * (def.use!.stPct ?? 0)));
        this.game.removeItem(id);
        this.status = `${CHARACTERS[m.charId].name}: ${m.hp}/${stats.hp} HP, ${m.st}/${stats.st} ST.`;
        this.pop();
        this.pages[this.pages.length - 1] = this.itemsPage();
      }));
    }, () => this.pop());
    return { title: `Items  ${this.st.gold} salt`, list };
  }

  private equipPage(m: PartyMember): Page {
    const slots = ["weapon", "armor", "accessory"] as const;
    const items: ListItem[] = slots.map((slot) => ({ label: slot, right: m.equip[slot] ? ITEMS[m.equip[slot]!].name : "-", value: slot, desc: m.equip[slot] ? ITEMS[m.equip[slot]!].desc : "Nothing equipped." }));
    const list = new ListMenu(items, 3, (it) => {
      const slot = it.value as typeof slots[number];
      const inv = this.st.inventory;
      const choices = Object.keys(inv).filter((id) => inv[id] > 0 && ITEMS[id].kind === slot && canEquip(m, id));
      const opts: ListItem[] = [{ label: "(remove)", value: null }, ...choices.map((id) => ({ label: ITEMS[id].name, desc: ITEMS[id].desc, sprite: ITEMS[id].sprite, right: statDelta(m, slot, id), value: id }))];
      const sub = new ListMenu(opts, 8, (o) => {
        const prev = m.equip[slot];
        if (prev) this.game.addItem(prev);
        const id = o.value as string | null;
        if (id) { this.game.removeItem(id); m.equip[slot] = id; } else delete m.equip[slot];
        const stats = memberStats(m);
        m.hp = Math.min(m.hp, stats.hp); m.st = Math.min(m.st, stats.st);
        this.pop();
        this.pages[this.pages.length - 1] = this.equipPage(m);
      }, () => this.pop());
      this.push({ title: `${CHARACTERS[m.charId].name}: ${slot}`, list: sub, member: m });
    }, () => this.pop());
    return { title: `Equip ${CHARACTERS[m.charId].name}`, list, member: m, draw: (s) => this.drawStats(s, m, 60) };
  }

  private skillsPage(m: PartyMember): Page {
    const ids = learnedSkills(m);
    const cls = CLASSES[CHARACTERS[m.charId].classId];
    const upcoming = cls.learn.filter((l) => l.level > m.level).slice(0, 2);
    const items: ListItem[] = ids.map((id) => ({ label: SKILLS[id].name, right: `${SKILLS[id].cost}st`, desc: SKILLS[id].desc, value: id }));
    for (const u of upcoming) items.push({ label: `L${u.level}: ${SKILLS[u.skill].name}`, disabled: true, desc: SKILLS[u.skill].desc });
    const list = new ListMenu(items, 9, undefined, () => this.pop());
    return { title: `${CHARACTERS[m.charId].name} ${cls.name}`, list, member: m };
  }

  private memoriesPage(m: PartyMember): Page {
    const items: ListItem[] = [0, 1, 2].map((i) => ({ label: `slot ${i + 1}`, right: m.memories[i] ? ITEMS[m.memories[i]].name.replace("Mem: ", "") : "-", desc: m.memories[i] ? ITEMS[m.memories[i]].desc : "Empty.", value: i }));
    const list = new ListMenu(items, 3, (it) => {
      const slot = it.value as number;
      const inv = this.st.inventory;
      const choices = Object.keys(inv).filter((id) => inv[id] > 0 && ITEMS[id].kind === "memory");
      const opts: ListItem[] = [{ label: "(remove)", value: null }, ...choices.map((id) => ({ label: ITEMS[id].name.replace("Mem: ", ""), desc: ITEMS[id].desc, sprite: ITEMS[id].sprite, value: id }))];
      const sub = new ListMenu(opts, 8, (o) => {
        const prev = m.memories[slot];
        if (prev) this.game.addItem(prev);
        const id = o.value as string | null;
        if (id) { this.game.removeItem(id); m.memories[slot] = id; } else m.memories.splice(slot, 1);
        m.memories = m.memories.filter(Boolean);
        this.pop();
        this.pages[this.pages.length - 1] = this.memoriesPage(m);
      }, () => this.pop());
      this.push({ title: "Choose a Memory", list: sub });
    }, () => this.pop());
    return { title: `${CHARACTERS[m.charId].name}'s Memories`, list, member: m, draw: (s) => this.drawStats(s, m, 60) };
  }

  private wordsPage(): Page {
    const items: ListItem[] = WORDS.filter((w) => this.st.words.includes(w.id)).map((w) => ({ label: w.word, right: w.slot, desc: w.desc }));
    return { title: "Words", list: new ListMenu(items, 9, undefined, () => this.pop()) };
  }

  private partyPage(): Page {
    const all = this.game.membersAll();
    const items: ListItem[] = all.map((m, i) => ({ label: CHARACTERS[m.charId].name, right: i < this.st.party.length ? "active" : "reserve", sprite: CHARACTERS[m.charId].sprite, value: m, desc: CHARACTERS[m.charId].bio }));
    const list = new ListMenu(items, 9, (it, i) => {
      const m = it.value as PartyMember;
      if (i === 0) { this.status = "Pell leads."; return; }
      if (i < this.st.party.length) {
        if (this.st.party.length <= 1) return;
        this.st.party.splice(i, 1); this.st.reserve.unshift(m);
      } else {
        this.st.reserve.splice(i - this.st.party.length, 1);
        if (this.st.party.length < 4) this.st.party.push(m);
        else { const out = this.st.party.pop()!; this.st.party.push(m); this.st.reserve.unshift(out); }
      }
      this.game.overworld?.resetTrail();
      this.pages[this.pages.length - 1] = this.partyPage();
    }, () => this.pop());
    return { title: "Party (4 active)", list };
  }

  private statusPage(m: PartyMember): Page {
    const list = new ListMenu([], 1, undefined, () => this.pop());
    return { title: `${CHARACTERS[m.charId].name}`, list, member: m, draw: (s) => this.drawStats(s, m, 20, true) };
  }

  private storyPage(): Page {
    const ch = this.game.chapter();
    const step = Number(this.st.flags[`ch${ch.n}.step`] ?? 1);
    const items: ListItem[] = [
      { label: `Chapter ${ch.n}: ${ch.title}`, color: "yellow" },
      { label: `Journey: ${ch.journey}`, color: "salt" },
      { label: `Circle ${step}/8: ${ch.circle[step - 1]}`, color: "salt" },
      { label: "Mechanics:", color: "gray" },
      ...this.st.mechanics.map((mech) => ({ label: ` ${MECHANIC_INFO[mech].name}`, desc: MECHANIC_INFO[mech].desc })),
      { label: `Steps ${this.st.steps}  Battles ${this.st.battles}`, color: "gray" },
      { label: `Debt ${this.st.debt}  Time ${Math.floor(this.st.playtime / 60)}m`, color: "gray" },
    ];
    return { title: "Story", list: new ListMenu(items, 10, undefined, () => this.pop()) };
  }

  // ---------- Drawing ----------

  draw(s: Screen): void {
    s.dim(0.6);
    s.panel(4, 4, 184, 184, "dark", "white");
    const p = this.page;
    s.text(p.title, 8, 7, "yellow");
    s.rect(5, 15, 182, 1, "gray");
    p.draw?.(s);
    const listY = p.draw && !p.title.startsWith("Status") ? 112 : 20;
    if (!p.title.startsWith("Status") || p.list.items.length) p.list.draw(s, 8, listY, 176);
    const cur = p.list.current;
    s.rect(5, 170, 182, 1, "gray");
    const desc = this.status || cur?.desc || "";
    const lines = wrapDesc(desc, 44);
    lines.slice(0, 2).forEach((l, i) => s.text(l, 8, 173 + i * 7, this.status ? "lime" : "salt"));
    this.status = "";
  }

  private drawStats(s: Screen, m: PartyMember, y: number, full = false): void {
    const c = CHARACTERS[m.charId];
    const stats = memberStats(m);
    s.sprite(getSprite(c.sprite), 10, y, c.sprite.a, c.sprite.b, { scale: 2 });
    s.text(`${c.name}  L${m.level}  ${CLASSES[c.classId].name}`, 30, y, "white");
    s.text(`HP ${m.hp}/${stats.hp}  ST ${m.st}/${stats.st}`, 30, y + 8, "white");
    s.text(`XP ${m.xp}/${xpForLevel(m.level)}`, 30, y + 16, "gray");
    const keys: StatKey[] = ["atk", "def", "mag", "res", "spd"];
    keys.forEach((k, i) => s.text(`${k.toUpperCase()} ${stats[k]}`, 10 + (i % 3) * 56, y + 26 + Math.floor(i / 3) * 8, "salt"));
    if (full) {
      s.text(`Weapon: ${m.equip.weapon ? ITEMS[m.equip.weapon].name : "-"}`, 10, y + 46, "white");
      s.text(`Armor:  ${m.equip.armor ? ITEMS[m.equip.armor].name : "-"}`, 10, y + 54, "white");
      s.text(`Extra:  ${m.equip.accessory ? ITEMS[m.equip.accessory].name : "-"}`, 10, y + 62, "white");
      const mem = m.memories.map((id) => ITEMS[id].name.replace("Mem: ", "")).join(", ");
      s.text(`Memories: ${mem || "-"}`, 10, y + 70, "pink");
      wrapDesc(c.bio, 44).slice(0, 4).forEach((l, i) => s.text(l, 10, y + 84 + i * 7, "gray"));
    }
  }
}

function kindOrder(id: string): number {
  return { consumable: 0, weapon: 1, armor: 2, accessory: 3, memory: 4, key: 5, word: 6 }[ITEMS[id].kind] ?? 9;
}

function statDelta(m: PartyMember, slot: "weapon" | "armor" | "accessory", id: string): string {
  const before = memberStats(m);
  const trial: PartyMember = { ...m, equip: { ...m.equip, [slot]: id } };
  const after = memberStats(trial);
  const parts: string[] = [];
  for (const k of STAT_KEYS) { const d = after[k] - before[k]; if (d) parts.push(`${k}${d > 0 ? "+" : ""}${d}`); }
  return parts.slice(0, 2).join(" ");
}

export function wrapDesc(text: string, cols: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(" ")) {
    if (line.length + w.length + 1 > cols && line) { out.push(line); line = w; } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
}
