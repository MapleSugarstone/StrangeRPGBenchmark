import type { Input } from "../../engine/input";
import { type Screen, W, H, wrap } from "../../engine/screen";
import type { Scene } from "../../engine/scene";
import { deferred } from "../../engine/scene";
import { getSprite } from "../../engine/sprites";
import { FONT_H } from "../../engine/fontdata";
import { drawBox, ListCursor } from "../../engine/dialogue";
import type { Audio } from "../../engine/audio";
import { type GameState, maxHpOf, skillsOf, poolOf, addItem, save, encodeSave, bonded } from "../state";
import { MEMBERS, xpForLevel, statsAt } from "../data/members";
import { SKILLS, PAIRS } from "../data/skills";
import { ITEMS } from "../data/items";
import { knotCells, encodeKnots, KNOT_MESSAGES } from "../knots";

export interface MenuHost {
  g: GameState;
  audio: Audio;
  chapterTitle(): string;
  beats(): string[];
  goalText(): string;
  /** Returns true when saved. */
  save(): boolean;
  setMuted(m: boolean): void;
  toTitle(): void;
}

type Page = "root" | "party" | "member" | "items" | "gear" | "knots" | "rig" | "story" | "options" | "save" | "swap" | "code";

const ROOT = ["Party", "Items", "Knots", "Rig", "Story", "Options", "Save", "Close"];

/** The pause menu. Everything in it fits in the square. */
export class MenuScene implements Scene {
  opaque = false;
  private page: Page = "root";
  private cur = new ListCursor(ROOT.length, 8);
  private sub = new ListCursor(0, 8);
  private memberIdx = 0;
  private gearSlot: "glove" | "line" | "lure" = "glove";
  private done = deferred<void>();
  readonly promise = this.done.promise;
  private note: { text: string; t: number } | null = null;
  private time = 0;
  private swapFrom = -1;
  private code = "";

  constructor(private host: MenuHost) {}

  private get g(): GameState {
    return this.host.g;
  }

  private toast(text: string): void {
    this.note = { text, t: 1.6 };
  }

  update(dt: number, input: Input): void {
    this.time += dt;
    if (this.note) { this.note.t -= dt; if (this.note.t <= 0) this.note = null; }
    const a = this.host.audio;
    switch (this.page) {
      case "root": {
        this.cur.move(input, a);
        if (input.pressed("cancel") || input.pressed("menu")) { input.consume("cancel"); input.consume("menu"); a.sfx("cancel"); this.done.resolve(); return; }
        if (input.pressed("ok")) {
          input.consume("ok");
          a.sfx("ok");
          const pick = ROOT[this.cur.index];
          if (pick === "Close") { this.done.resolve(); return; }
          this.page = pick.toLowerCase() as Page;
          this.sub = new ListCursor(this.subCount(), 8);
        }
        break;
      }
      case "party": {
        this.sub.count = this.g.roster.length;
        this.sub.move(input, a);
        if (input.pressed("cancel")) { input.consume("cancel"); a.sfx("cancel"); if (this.swapFrom >= 0) this.swapFrom = -1; else this.page = "root"; return; }
        if (input.pressed("ok")) {
          input.consume("ok");
          a.sfx("ok");
          this.memberIdx = this.sub.index;
          this.page = "member";
          this.sub = new ListCursor(4, 4);
        }
        if (input.pressed("goal")) {
          input.consume("goal");
          const id = this.g.roster[this.sub.index];
          this.toggleActive(id);
        }
        break;
      }
      case "member": {
        const id = this.g.roster[this.memberIdx];
        this.sub.count = 5;
        this.sub.move(input, a);
        if (input.pressed("left") || input.pressed("right")) {
          this.memberIdx = (this.memberIdx + (input.pressed("left") ? this.g.roster.length - 1 : 1)) % this.g.roster.length;
          a.sfx("cursor");
        }
        if (input.pressed("cancel")) { input.consume("cancel"); a.sfx("cancel"); this.page = "party"; this.sub = new ListCursor(this.g.roster.length, 8); this.sub.index = this.memberIdx; return; }
        if (input.pressed("ok")) {
          input.consume("ok");
          const opt = this.sub.index;
          if (opt === 0) { this.toggleActive(id); }
          else if (opt === 1 || opt === 2 || opt === 3) {
            if (opt === 3 && !MEMBERS[id].held) { this.toast("Only a held line takes a lure."); return; }
            this.gearSlot = opt === 1 ? "glove" : opt === 2 ? "line" : "lure";
            this.page = "gear"; this.sub = new ListCursor(this.gearChoices(id).length, 6); a.sfx("ok");
          }
          else { this.page = "swap"; this.swapFrom = this.g.active.indexOf(id); this.sub = new ListCursor(this.g.active.length, 4); a.sfx("ok"); }
        }
        break;
      }
      case "rig": {
        const known = this.knotList().filter((k) => k.known);
        this.sub.count = known.length;
        this.sub.move(input, a);
        if (input.pressed("cancel")) { input.consume("cancel"); a.sfx("cancel"); this.page = "root"; return; }
        if (input.pressed("ok")) {
          input.consume("ok");
          const k = known[this.sub.index];
          if (!k) return;
          if (this.g.rig.includes(k.id)) { this.g.rig = this.g.rig.filter((r) => r !== k.id); a.sfx("untie"); }
          else if (this.g.rig.length >= 4) this.toast("Four knots is all Fathom can keep rigged.");
          else { this.g.rig.push(k.id); a.sfx("knot"); }
        }
        break;
      }
      case "gear": {
        const id = this.g.roster[this.memberIdx];
        const choices = this.gearChoices(id);
        this.sub.count = choices.length;
        this.sub.move(input, a);
        if (input.pressed("cancel")) { input.consume("cancel"); a.sfx("cancel"); this.page = "member"; this.sub = new ListCursor(4, 4); return; }
        if (input.pressed("ok")) {
          input.consume("ok");
          const pick = choices[this.sub.index];
          const m = this.g.members[id];
          const current = m.gear[this.gearSlot];
          if (current) addItem(this.g, current, 1);
          if (pick === "none") delete m.gear[this.gearSlot];
          else { m.gear[this.gearSlot] = pick; addItem(this.g, pick, -1); }
          m.hp = Math.min(m.hp, maxHpOf(m));
          a.sfx("item");
          this.page = "member";
          this.sub = new ListCursor(4, 4);
          this.sub.index = this.gearSlot === "glove" ? 1 : this.gearSlot === "line" ? 2 : 3;
        }
        break;
      }
      case "swap": {
        this.sub.count = this.g.active.length;
        this.sub.move(input, a);
        if (input.pressed("cancel")) { input.consume("cancel"); a.sfx("cancel"); this.page = "member"; this.sub = new ListCursor(4, 4); return; }
        if (input.pressed("ok")) {
          input.consume("ok");
          const id = this.g.roster[this.memberIdx];
          const target = this.g.active[this.sub.index];
          if (target === "fathom") { this.toast("Fathom leads."); return; }
          if (this.g.active.includes(id)) {
            const i = this.g.active.indexOf(id);
            [this.g.active[i], this.g.active[this.sub.index]] = [this.g.active[this.sub.index], this.g.active[i]];
          } else this.g.active[this.sub.index] = id;
          a.sfx("ok");
          this.page = "party";
          this.sub = new ListCursor(this.g.roster.length, 8);
        }
        break;
      }
      case "items": {
        const ids = this.itemIds();
        this.sub.count = ids.length;
        this.sub.move(input, a);
        if (input.pressed("cancel")) { input.consume("cancel"); a.sfx("cancel"); this.page = "root"; return; }
        if (input.pressed("ok")) {
          input.consume("ok");
          const id = ids[this.sub.index];
          if (id) this.useItem(id);
        }
        break;
      }
      case "knots": {
        const list = this.knotList();
        this.sub.count = list.length;
        this.sub.move(input, a);
        if (input.pressed("cancel") || input.pressed("ok")) { input.consume("cancel"); input.consume("ok"); a.sfx("cancel"); this.page = "root"; return; }
        break;
      }
      case "story": {
        if (input.pressed("cancel") || input.pressed("ok")) { input.consume("cancel"); input.consume("ok"); a.sfx("cancel"); this.page = "root"; return; }
        break;
      }
      case "options": {
        this.sub.count = 7;
        this.sub.move(input, a);
        if (input.pressed("cancel")) { input.consume("cancel"); a.sfx("cancel"); this.page = "root"; return; }
        if (input.pressed("ok") || input.pressed("left") || input.pressed("right")) {
          input.consume("ok");
          const o = this.g.options;
          switch (this.sub.index) {
            case 0: o.music = !o.music; this.host.setMuted(!o.music); break;
            case 1: o.textSpeed = o.textSpeed >= 90 ? 30 : o.textSpeed + 30; break;
            case 2: o.twoPlayer = !o.twoPlayer; this.toast(o.twoPlayer ? "Player two is the Hand. Use the mouse." : "One player."); break;
            case 3: o.tips = !o.tips; break;
            case 4: o.difficulty = o.difficulty === "slack" ? "plumb" : o.difficulty === "plumb" ? "taut" : "slack"; break;
            case 5: this.code = encodeSave(this.g); this.page = "code"; break;
            case 6: this.host.toTitle(); this.done.resolve(); return;
          }
          a.sfx("ok");
        }
        break;
      }
      case "code": {
        if (input.pressed("cancel") || input.pressed("ok")) {
          input.consume("cancel"); input.consume("ok");
          if (input.pressed("ok") || true) {
            try { void navigator.clipboard?.writeText(this.code); this.toast("Copied to the clipboard."); } catch { this.toast("Could not copy."); }
          }
          this.page = "options";
          return;
        }
        break;
      }
      case "save": {
        if (input.pressed("cancel")) { input.consume("cancel"); a.sfx("cancel"); this.page = "root"; return; }
        if (input.pressed("ok")) {
          input.consume("ok");
          if (this.host.save()) { a.sfx("save"); this.toast("Saved."); } else this.toast("Could not save here.");
          this.page = "root";
        }
        break;
      }
    }
  }

  private subCount(): number {
    switch (this.page) {
      case "party": return this.g.roster.length;
      case "items": return this.itemIds().length;
      case "knots": return this.knotList().length;
      case "rig": return this.knotList().filter((k) => k.known).length;
      case "options": return 7;
      default: return 1;
    }
  }

  private toggleActive(id: string): void {
    if (id === "fathom") { this.toast("Fathom leads."); return; }
    if (this.g.active.includes(id)) {
      if (this.g.active.length <= 1) return;
      this.g.active = this.g.active.filter((a) => a !== id);
      this.host.audio.sfx("cancel");
    } else if (this.g.active.length < 4) {
      this.g.active.push(id);
      this.host.audio.sfx("ok");
    } else this.toast("Four is the most. Swap someone out.");
  }

  private gearChoices(id: string): string[] {
    const def = MEMBERS[id];
    const kind = this.gearSlot === "glove" ? "glove" : this.gearSlot === "lure" ? "lure" : def.held ? "weight" : "sole";
    const have = Object.keys(this.g.inventory).filter((i) => this.g.inventory[i] > 0 && ITEMS[i]?.kind === kind);
    return ["none", ...have];
  }

  private itemIds(): string[] {
    return Object.keys(this.g.inventory).filter((i) => this.g.inventory[i] > 0).sort((a, b) => (ITEMS[a].kind === "key" ? 1 : 0) - (ITEMS[b].kind === "key" ? 1 : 0));
  }

  private useItem(id: string): void {
    const it = ITEMS[id];
    if (it.kind !== "consumable" || it.target === "enemy") { this.toast(it.kind === "key" ? it.desc : "Equip it from the Party page."); return; }
    // Heal the most hurt active member, or everyone
    const targets = it.target === "allAllies" ? this.g.active : [[...this.g.active].filter((m) => this.g.members[m].hp > 0 || it.revive).sort((a, b) => this.g.members[a].hp / maxHpOf(this.g.members[a]) - this.g.members[b].hp / maxHpOf(this.g.members[b]))[0]];
    let used = false;
    for (const t of targets) {
      if (!t) continue;
      const m = this.g.members[t];
      const max = maxHpOf(m);
      if (it.revive) { if (m.hp <= 0) { m.hp = Math.round(max * (it.healPct ?? 0.5)); used = true; } continue; }
      if (m.hp <= 0) continue;
      if (it.heal !== undefined && m.hp < max) { m.hp = Math.min(max, m.hp + Math.round(it.heal + (it.healPct ?? 0) * max)); used = true; }
      if (it.cure) used = true;
    }
    if (!used) { this.toast("No one needs that right now."); return; }
    addItem(this.g, id, -1);
    this.host.audio.sfx("heal");
    this.toast(`Used ${it.name}.`);
    this.sub.clamp();
  }

  private knotList(): { id: string; name: string; desc: string; cost: number; known: boolean }[] {
    const m = this.g.members.fathom;
    const known = skillsOf(m, this.g.chapter);
    return MEMBERS.fathom.learn.map((l) => SKILLS[l.skill]).filter((k) => k.kind === "knot").map((k) => ({ id: k.id, name: k.name, desc: k.desc, cost: k.cost, known: known.includes(k.id) }));
  }

  // -------------------------------------------------------------------------

  draw(s: Screen): void {
    s.dimRect(0, 0, W, H, 0.55);
    drawBox(s, 4, 4, W - 8, H - 8);
    const top = 9;
    s.text(this.title(), 10, top, "gold");
    s.textRight(`${this.g.slugs} slugs`, W - 10, top, "bone");
    switch (this.page) {
      case "root": this.drawRoot(s); break;
      case "party": this.drawParty(s); break;
      case "member": this.drawMember(s); break;
      case "gear": this.drawGear(s); break;
      case "swap": this.drawSwap(s); break;
      case "items": this.drawItems(s); break;
      case "knots": this.drawKnots(s); break;
      case "rig": this.drawRig(s); break;
      case "story": this.drawStory(s); break;
      case "options": this.drawOptions(s); break;
      case "code": this.drawCode(s); break;
      case "save": this.drawSave(s); break;
    }
    if (this.note) {
      const tw = s.textWidth(this.note.text) + 10;
      drawBox(s, Math.floor((W - tw) / 2), H - 26, tw, FONT_H + 8);
      s.textCenter(this.note.text, W / 2, H - 22, "gold");
    }
  }

  private title(): string {
    switch (this.page) {
      case "root": return this.host.chapterTitle();
      case "party": return "Party  (Tab: in or out)";
      case "member": return "Member  (left, right: next)";
      case "gear": return this.gearSlot === "glove" ? "Gloves" : "On the line";
      case "swap": return "Swap with";
      case "items": return "Pack";
      case "knots": return "Fathom's knots";
      case "rig": return "Rig: knots for battle";
      case "story": return "Story";
      case "options": return "Options";
      case "code": return "Your line, as a code";
      case "save": return "Save";
    }
  }

  private drawRoot(s: Screen): void {
    ROOT.forEach((r, i) => {
      const y = 24 + i * 10;
      if (i === this.cur.index) s.text("▶", 10, y, "gold");
      s.text(r, 20, y, i === this.cur.index ? "white" : "bone");
    });
    // Party summary on the right
    this.g.active.forEach((id, i) => {
      const m = this.g.members[id];
      const def = MEMBERS[id];
      const y = 24 + i * 22;
      s.sprite(getSprite(def.sprite.kind, def.sprite.seed, def.sprite.variant), 90, y, def.sprite.a, def.sprite.b, { scale: 2 });
      s.text(`${def.name} L${m.level}`, 110, y, "white");
      const max = maxHpOf(m);
      s.rect(110, y + 8, 60, 4, "coal");
      s.rect(110, y + 8, Math.round((60 * m.hp) / max), 4, m.hp < max * 0.3 ? "blood" : "leaf");
      s.text(`${m.hp}/${max}`, 174, y + 7, "bone");
      s.text(def.held ? "held" : "slack", 110, y + 14, def.held ? "bone" : "teal");
    });
    const goal = wrap(this.host.goalText(), W - 30);
    goal.slice(0, 3).forEach((l, i) => s.text(l, 10, H - 40 + i * 8, "lilac"));
  }

  private drawParty(s: Screen): void {
    this.g.roster.forEach((id, i) => {
      const m = this.g.members[id];
      const def = MEMBERS[id];
      const y = 22 + i * 20;
      const sel = i === this.sub.index;
      if (sel) s.rect(8, y - 2, W - 16, 20, "slate");
      s.sprite(getSprite(def.sprite.kind, def.sprite.seed, def.sprite.variant), 12, y, def.sprite.a, def.sprite.b, { scale: 2 });
      s.text(`${def.name}`, 32, y, this.g.active.includes(id) ? "white" : "ash");
      s.text(`L${m.level}  ${m.hp}/${maxHpOf(m)}`, 32, y + 8, "bone");
      s.text(this.g.active.includes(id) ? "in" : "out", W - 26, y, this.g.active.includes(id) ? "mint" : "ash");
      wrap(def.title, 92).slice(0, 3).forEach((l, k) => s.text(l, 96, y + k * 7, "lilac"));
    });
  }

  private drawMember(s: Screen): void {
    const id = this.g.roster[this.memberIdx];
    const m = this.g.members[id];
    const def = MEMBERS[id];
    const st = statsAt(def, m.level);
    s.sprite(getSprite(def.sprite.kind, def.sprite.seed, def.sprite.variant), 12, 22, def.sprite.a, def.sprite.b, { scale: 3 });
    s.text(def.name, 40, 22, "white");
    s.text(def.title.slice(0, 40), 40, 30, "lilac");
    s.text(`Level ${m.level}   XP ${m.xp}/${xpForLevel(m.level)}`, 40, 38, "bone");
    const gearStats = (slot: "glove" | "line") => { const it = m.gear[slot] ? ITEMS[m.gear[slot]!] : null; return it?.stats ?? {}; };
    const gs = { ...gearStats("glove") };
    const ls = gearStats("line");
    const tot = (k: "atk" | "mag" | "def" | "spd") => st[k] + (gs[k] ?? 0) + (ls[k] ?? 0);
    s.text(`HP ${m.hp}/${maxHpOf(m)}  ATK ${tot("atk")}  MAG ${tot("mag")}`, 12, 50, "bone");
    s.text(`DEF ${tot("def")}  SPD ${tot("spd")}  ${def.economy === "length" ? `Line ${poolOf(this.g, m)} fm` : def.economy === "tension" ? "Tension" : "Slack points"}`, 12, 58, "bone");
    s.text(`Weak: ${def.weak.join(", ") || "none"}  Resists: ${def.resist.join(", ") || "none"}`, 12, 66, "ash");
    // Skills
    const skills = skillsOf(m, this.g.chapter).filter((k) => !["hang", "duck", "rise", "letgo"].includes(k));
    s.text("Skills:", 12, 78, "gold");
    skills.slice(0, 10).forEach((k, i) => s.text(SKILLS[k].name, 12 + (i % 2) * 100, 86 + Math.floor(i / 2) * 8, "white"));
    // Options
    const opts = [this.g.active.includes(id) ? "Leave the party" : "Join the party", `Gloves: ${m.gear.glove ? ITEMS[m.gear.glove].name : "none"}`, `${def.held ? "Weight" : "Soles"}: ${m.gear.line ? ITEMS[m.gear.line].name : "none"}`, def.held ? `Lure: ${m.gear.lure ? ITEMS[m.gear.lure].name : "none"}` : "Lure: no line", "Swap position"];
    opts.forEach((o, i) => {
      const y = 128 + i * 10;
      if (i === this.sub.index) s.text("▶", 10, y, "gold");
      s.text(o, 20, y, i === this.sub.index ? "white" : i === 3 && !def.held ? "ash" : "bone");
    });
    // Bonds
    const bonds = PAIRS.filter((p) => p.members.includes(id) && bonded(this.g, p.members[0], p.members[1])).map((p) => SKILLS[p.skill].name);
    if (bonds.length) s.text(`Pairs: ${bonds.join(", ")}`.slice(0, 50), 12, 182, "rose");
    s.text(`Talks around the fire: ${m.talks}${def.held && m.gear.lure ? `   Note: ${ITEMS[m.gear.lure].note ?? def.note}` : def.note ? `   Note: ${def.note}` : ""}`, 12, 192, "ash");
  }

  private drawRig(s: Screen): void {
    const known = this.knotList().filter((k) => k.known);
    this.sub.clamp();
    s.text(`Rigged: ${this.g.rig.length} of 4. Confirm toggles a knot.`, 12, 22, "teal");
    if (!known.length) s.text("Fathom knows no knots yet.", 12, 34, "ash");
    known.forEach((k, i) => {
      const y = 34 + i * 10;
      const on = this.g.rig.includes(k.id);
      if (i === this.sub.index) s.text("▶", 10, y, "gold");
      s.text(on ? "●" : "○", 20, y, on ? "teal" : "slate");
      s.text(k.name, 30, y, i === this.sub.index ? "white" : "bone");
      s.textRight(`${k.cost} fm`, W - 12, y, "teal");
    });
    const k = known[this.sub.index];
    if (k) wrap(k.desc, W - 30).slice(0, 4).forEach((l, i) => s.text(l, 12, 150 + i * 8, "lilac"));
    if (!this.g.rig.length) s.text("Nothing rigged: the first four known knots come.", 12, 186, "ash");
  }

  private drawGear(s: Screen): void {
    const id = this.g.roster[this.memberIdx];
    const choices = this.gearChoices(id);
    choices.forEach((c, i) => {
      const y = 24 + i * 10;
      if (i === this.sub.index) s.text("▶", 10, y, "gold");
      s.text(c === "none" ? "Nothing" : ITEMS[c].name, 20, y, i === this.sub.index ? "white" : "bone");
    });
    const pick = choices[this.sub.index];
    if (pick && pick !== "none") {
      const it = ITEMS[pick];
      wrap(it.desc, W - 30).forEach((l, i) => s.text(l, 12, 100 + i * 8, "lilac"));
      const st = it.stats ?? {};
      s.text(Object.entries(st).map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`).join("  "), 12, 130, "mint");
    } else s.text("Take it off.", 12, 100, "ash");
  }

  private drawSwap(s: Screen): void {
    this.g.active.forEach((id, i) => {
      const y = 24 + i * 10;
      if (i === this.sub.index) s.text("▶", 10, y, "gold");
      s.text(MEMBERS[id].name, 20, y, i === this.sub.index ? "white" : "bone");
    });
  }

  private drawItems(s: Screen): void {
    const ids = this.itemIds();
    this.sub.clamp();
    const vis = ids.slice(this.sub.top, this.sub.top + 8);
    vis.forEach((id, i) => {
      const idx = this.sub.top + i;
      const y = 24 + i * 10;
      const it = ITEMS[id];
      if (idx === this.sub.index) s.text("▶", 10, y, "gold");
      s.sprite(getSprite("item", it.sprite, it.sprite), 20, y - 1, it.kind === "key" ? "gold" : "bone", it.kind === "key" ? "white" : "teal");
      s.text(`${it.name}`, 30, y, idx === this.sub.index ? "white" : it.kind === "key" ? "gold" : "bone");
      s.textRight(`x${this.g.inventory[id]}`, W - 12, y, "bone");
    });
    if (!ids.length) s.text("The pack is empty.", 20, 24, "ash");
    const it = ids[this.sub.index] ? ITEMS[ids[this.sub.index]] : null;
    if (it) wrap(it.desc, W - 30).slice(0, 4).forEach((l, i) => s.text(l, 12, 110 + i * 8, "lilac"));
    s.text("Confirm uses a consumable on whoever needs it most.", 12, 150, "ash");
  }

  private drawKnots(s: Screen): void {
    const list = this.knotList();
    this.sub.clamp();
    const m = this.g.members.fathom;
    s.text(`Line carried: ${poolOf(this.g, m)} fathoms`, 12, 22, "teal");
    const vis = list.slice(this.sub.top, this.sub.top + 8);
    vis.forEach((k, i) => {
      const idx = this.sub.top + i;
      const y = 32 + i * 10;
      if (idx === this.sub.index) s.text("▶", 10, y, "gold");
      s.text(k.known ? k.name : "???", 20, y, k.known ? (idx === this.sub.index ? "white" : "bone") : "ash");
      s.textRight(`${k.cost} fm`, W - 12, y, "teal");
    });
    if (list.length > 8) {
      if (this.sub.top > 0) s.text("↑", W - 16, 22, "ash");
      if (this.sub.top + 8 < list.length) s.text("↓", W - 16, 112, "ash");
    }
    const k = list[this.sub.index];
    if (k) wrap(k.known ? k.desc : "Fathom has not learned this knot yet.", W - 30).slice(0, 4).forEach((l, i) => s.text(l, 12, 120 + i * 8, "lilac"));
    // Decoded knot messages, drawn as knots
    s.text("Read from the line:", 12, 156, "gold");
    const read = this.g.knotsRead.slice(-3);
    read.forEach((id, i) => {
      const msg = KNOT_MESSAGES[id] ?? "";
      const glyphs = encodeKnots(msg).slice(0, 24);
      glyphs.forEach((gl, j) => s.sprite(knotCells(gl), 12 + j * 8, 164 + i * 12, "bone", "teal"));
    });
    if (!read.length) s.text("Nothing yet.", 12, 166, "ash");
  }

  private drawStory(s: Screen): void {
    const beats = this.host.beats();
    s.text(`Chapter ${this.g.chapter}`, 12, 22, "white");
    let y = 32;
    beats.forEach((b, i) => {
      const here = i === this.g.beat;
      const past = i < this.g.beat;
      const label = ["You", "Need", "Go", "Search", "Find", "Take", "Return", "Change"][i];
      s.text(here ? "▶" : past ? "•" : " ", 12, y, here ? "gold" : "ash");
      // Beats still to come stay unwritten
      const lines = past || here ? wrap(`${label}: ${b}`, W - 36).slice(0, 2) : [`${label}: ...`];
      lines.forEach((l, k) => s.text(l, 22, y + k * 7, here ? "white" : past ? "bone" : "ash"));
      y += lines.length * 7 + 2;
    });
    y += 4;
    const journey = ["Ordinary world and the call", "Refusal and the mentor", "Crossing the threshold", "Tests, allies, enemies", "Tests, allies, enemies", "Approach to the inmost cave", "The ordeal", "Reward and the road back", "Resurrection and return"];
    s.text(`Journey: ${journey[this.g.chapter - 1] ?? ""}`, 12, y, "lilac");
    s.text(`Steps ${this.g.steps}   Battles ${this.g.battles}`, 12, y + 9, "ash");
    const h = Math.floor(this.g.playtime / 3600), mn = Math.floor((this.g.playtime % 3600) / 60);
    s.text(`Time ${h}h ${mn}m   Towns taught: ${this.g.taught.length}`, 12, y + 17, "ash");
    const gy = y + 29;
    wrap(this.host.goalText(), W - 30).slice(0, Math.max(1, Math.floor((212 - gy) / 8))).forEach((l, i) => s.text(l, 12, gy + i * 8, "white"));
  }

  private drawOptions(s: Screen): void {
    const o = this.g.options;
    const diff = o.difficulty ?? "plumb";
    const rows = [`Sound: ${o.music ? "on" : "off"}`, `Text speed: ${o.textSpeed <= 30 ? "slow" : o.textSpeed <= 60 ? "normal" : "fast"}`, `Second player (the Hand): ${o.twoPlayer ? "on" : "off"}`, `Tips: ${o.tips ? "on" : "off"}`, `Difficulty: ${diff}`, "Show save code", "Back to title"];
    rows.forEach((r, i) => {
      const y = 24 + i * 10;
      if (i === this.sub.index) s.text("▶", 10, y, "gold");
      s.text(r, 20, y, i === this.sub.index ? "white" : "bone");
    });
    const help = ["M also mutes.", "Hold Shift to hurry text and battle.", "Player two uses the mouse: pluck lines in the field, help in battle.", "Short hints the first time a mechanic appears.", "Slack: foes are softer. Plumb: as tuned. Taut: foes hit harder and last longer. Change it any time.", "A code you can paste at the title screen on another machine.", "Progress since the last save is lost."];
    wrap(help[this.sub.index], W - 30).forEach((l, i) => s.text(l, 12, 100 + i * 8, "lilac"));
  }

  private drawCode(s: Screen): void {
    const lines = wrap(this.code.replace(/(.{48})/g, "$1 "), W - 24);
    lines.slice(0, 20).forEach((l, i) => s.text(l, 12, 24 + i * 7, "bone"));
    s.text("Confirm copies it. Cancel goes back.", 12, H - 22, "gold");
  }

  private drawSave(s: Screen): void {
    s.text("Save here?", 12, 30, "white");
    s.text("Confirm saves. Cancel goes back.", 12, 40, "bone");
    s.text("The game also saves itself at every map change.", 12, 56, "ash");
  }
}

export { save };
