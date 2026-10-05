import type { ChapterDef, Script } from "./chapters";
import type { MapDef } from "../world/map";
import { LEGEND, npc, chest, lampSprite, cave, at, creature, shape } from "./common";

const lobby: MapDef = {
  id: "bank_lobby", name: "The Bank of Teeth", chapter: 6, outside: "black", legend: LEGEND,
  grid: [
    "VVVVVVVVVVVVVVVVVVVVVVVV",
    "VwwwwwwwwwwwwwwwwwwwwwwV",
    "VwwwwwwwwwwwwwwwwwwwwwwV",
    "VwccccccwwwwwwwwccccccwV",
    "VwwwwwwwwwwwwwwwwwwwwwwV",
    "VwwwwwwwwwwwwwwwwwwwwwwV",
    "VwPwwwwwwwwwwwwwwwwwwPwV",
    "VwwwwwwwwwwwwwwwwwwwwwwV",
    "VwwwwwwwwwwwwwwwwwwwwwwV",
    "VwPwwwwwwwwLwwwwwwwwwPwV",
    "VwwwwwwwwwwwwwwwwwwwwwwV",
    "VwwwwwwwwwwwwwwwwwwwwwwV",
    "VwVVVVwwwwwwwwwwwwVVVVwV",
    "VwVwwVwwwwwwwwwwwwVwwVwV",
    "VwVwwVwwwwwwwwwwwwVwwVwV",
    "VwVDwVwwwwwwwwwwwwVDwVwV",
    "VwwwwwwwwwwwwwwwwwwwwwwV",
    "VVVVVVVVVVVDDVVVVVVVVVVV",
    "           DD           ",
  ],
  entities: [
    { id: "back", kind: "trigger", x: 11, y: 18, script: "bank.back" },
    { id: "back2", kind: "trigger", x: 12, y: 18, script: "bank.back" },
    { id: "teller1", kind: "npc", x: 4, y: 2, dir: "down", sprite: npc("teller-smile", "white", "gray"), script: "bank.teller", name: "Teller" },
    { id: "teller2", kind: "npc", x: 19, y: 2, dir: "down", sprite: npc("teller-grin", "white", "gray"), script: "bank.teller2", name: "Teller" },
    { id: "shop", kind: "shop", x: 11, y: 2, sprite: npc("teller-shop", "white", "yellow"), name: "Sundries & Securities", stock: ["brine", "lamp_wick", "antidote", "moth_dust", "tonic", "tooth", "ledger_vest", "tooth_saw", "leech_tooth", "clean_bandage"] },
    { id: "lamp", kind: "lamp", x: 11, y: 9, sprite: lampSprite(), name: "Lamp", solid: true },
    { id: "lender", kind: "npc", x: 11, y: 5, dir: "down", sprite: npc("the_lender", "white", "red"), script: "bank.lender", hideIf: "ch6.loanTaken", name: "The Lender" },
    { id: "uhtred", kind: "npc", x: 3, y: 14, dir: "down", sprite: npc("uhtred-seven", "gray", "red"), script: "bank.uhtred", hideIf: "ch6.uhtredJoined", name: "Uhtred-7" },
    { id: "celldoor", kind: "trigger", x: 3, y: 15, script: "bank.celldoor" },
    { id: "vaultdoor", kind: "door", x: 19, y: 15, to: { map: "bank_vaults", x: 2, y: 2, dir: "down" }, showIf: "ch6.loanTaken" },
    { id: "vaultlocked", kind: "trigger", x: 19, y: 15, script: "bank.vaultlocked", hideIf: "ch6.loanTaken" },
    { id: "chest1", kind: "chest", x: 22, y: 1, sprite: chest(), items: ["tooth", "tooth"] },
    { id: "customer", kind: "npc", x: 8, y: 11, dir: "right", sprite: npc("customer-poor", "brown", "white"), script: "bank.customer", wander: true, name: "Customer" },
    { id: "hourgate", kind: "trigger", x: 1, y: 1, script: "bank.hourgate" },
  ],
};

const vaults = cave({
  id: "bank_vaults", name: "The Vaults", chapter: 6, floor: "w", wall: "V", w: 32, h: 24, fill: 0.43, encounters: "bank", encounterRate: 0.09, decor: "P", decorCount: 8,
  place(cells) {
    const far = cells[cells.length - 1];
    return [
      { id: "up", kind: "door", x: 2, y: 1, to: { map: "bank_lobby", x: 19, y: 14, dir: "up" }, sprite: { kind: "tile", seed: "stairs", a: "gray", b: "white", variant: "stairs" } },
      { id: "chestA", kind: "chest", x: at(cells, 0.3)[0], y: at(cells, 0.3)[1], sprite: chest(), items: ["mem_teller", "tooth"] },
      { id: "chestB", kind: "chest", x: at(cells, 0.5)[0], y: at(cells, 0.5)[1], sprite: chest(), gold: 120 },
      { id: "ledger", kind: "npc", x: at(cells, 0.42)[0], y: at(cells, 0.42)[1], sprite: creature("ledger-npc", "white", "red"), script: "vault.ledger", name: "Ledger" },
      { id: "lamp", kind: "lamp", x: at(cells, 0.8)[0], y: at(cells, 0.8)[1], sprite: lampSprite(), name: "Lamp", solid: true },
      { id: "down", kind: "door", x: far[0], y: far[1], to: { map: "bank_deep", x: 2, y: 2, dir: "down" }, sprite: { kind: "tile", seed: "stairs", a: "dark", b: "white", variant: "stairs" } },
    ];
  },
});

const deepVault = cave({
  id: "bank_deep", name: "The Deep Vault", chapter: 6, floor: "w", wall: "V", w: 28, h: 22, fill: 0.46, encounters: "bank_deep", encounterRate: 0.1, outside: "dark",
  place(cells) {
    const far = cells[cells.length - 1];
    return [
      { id: "up", kind: "door", x: 2, y: 1, to: { map: "bank_vaults", x: 0, y: 0, dir: "down", atEntity: "down" }, sprite: { kind: "tile", seed: "stairs", a: "gray", b: "white", variant: "stairs" } },
      { id: "chestA", kind: "chest", x: at(cells, 0.45)[0], y: at(cells, 0.45)[1], sprite: chest(), items: ["tooth_saw"] },
      { id: "lamp", kind: "lamp", x: at(cells, 0.8)[0], y: at(cells, 0.8)[1], sprite: lampSprite(), name: "Lamp", solid: true },
      { id: "lenderboss", kind: "boss", x: far[0], y: far[1], sprite: npc("the_lender", "white", "red"), script: "deep.lender", hideIf: "ch6.lenderBeaten", solid: true },
      { id: "note", kind: "prop", x: far[0], y: far[1], sprite: shape("banknote", "white", "gray", "box"), script: "deep.note", showIf: "ch6.lenderBeaten", hideIf: "ch6.hasNote", solid: true },
    ];
  },
});

const scripts: Record<string, Script> = {
  "ch6.intro": async (c) => {
    c.step(1);
    await c.narrate("The Bank of Teeth. Marble, columns, a Lamp that is never allowed to go out because somebody is paying for it. Every Teller smiles with all of them.");
    await c.say("Fold", "The Backward Hour is on the far side of this building. There is no way around. There was. I drew it. The Bank bought it.", "fold");
  },
  "bank.back": async (c) => { await c.narrate("Back to the Fold? The Tellers are watching. Forward."); c.state.map.y = 16; c.game.overworld?.resetTrail(); },
  "bank.teller": async (c) => {
    const debt = c.state.debt;
    if (debt > 0) {
      const price = debt * 4;
      const i = await c.ask(`Your balance is ${debt} teeth. Paying it off costs ${price} salt. Pay?`, ["Pay it all", `Pay 10 teeth (${40} salt)`, "Not now"], "Teller");
      if (i === 0 && c.state.gold >= price) { c.state.gold -= price; c.state.debt = 0; await c.say("Teller", "Paid in full. The smile is complimentary."); }
      else if (i === 1 && c.state.gold >= 40) { c.state.gold -= 40; c.state.debt = Math.max(0, debt - 10); await c.say("Teller", `Balance: ${c.state.debt} teeth.`); }
      else if (i !== 2) await c.say("Teller", "Insufficient salt. We also accept teeth. Your own are fine.");
      return;
    }
    await c.say("Teller", "No balance. No account. No way through. The Lender is at the center of the hall. He would love to help.");
  },
  "bank.teller2": async (c) => { await c.say("Teller", "Interest compounds every turn you are fighting. Above forty teeth the Bank collects in person. Those are the terms. Everyone agrees to the terms. Nobody reads them."); },
  "bank.customer": async (c) => { await c.say("Customer", "I borrowed a tooth to buy bread. That was my father. I am still paying. The bread was good, he said."); },
  "bank.celldoor": async (c) => { c.state.map.y = 16; c.game.overworld?.resetTrail(); },
  "bank.vaultlocked": async (c) => { await c.narrate("The vault door. A tooth-shaped keyhole. The Lender has the only key, and the Lender only hands it to debtors."); c.state.map.y = 16; c.game.overworld?.resetTrail(); },
  "bank.lender": async (c) => {
    c.step(2);
    await c.narrate("The Lender. Tall, white suit, a smile that is ninety percent tooth. He is counting something on his fingers, and he has a lot of fingers.");
    await c.say("The Lender", "Travelers! To the Hour, I expect. The passage is through my vault. The vault is for account holders. Open an account? It costs nothing. Up front.");
    await c.say("Pell", "What does it cost later?", "pell");
    await c.say("The Lender", "Later is my favorite word. Twenty teeth to open. Interest in battle. Pay it down at any Teller, or with a loose tooth, or do not. Above forty, I collect personally.");
    const i = await c.ask("Open an account with the Bank of Teeth?", ["Sign", "Refuse"], "Pell");
    if (i === 1) { await c.say("The Lender", "Everyone refuses once. Come back when you have run out of other words."); return; }
    c.flag("ch6.loanTaken");
    c.step(3);
    await c.unlock("debt");
    c.state.debt += 20;
    await c.say("The Lender", "Twenty teeth. Borrow restores your Static at once and adds to the balance. The clone in the cell will show you what it does over seven lifetimes. The vault is open. Go earn it.");
    await c.narrate("(Debt is shown at the top of the battle screen. Pay it at the Tellers.)");
  },
  "bank.uhtred": async (c) => {
    if (c.get("ch6.lenderBeaten")) {
      c.step(7);
      await c.say("Uhtred-7", "You closed his account. Mine too, then. Seven prints. The eighth is not coming.");
      await c.say("Uhtred-7", "I am cheaper up front. You have seen the cost. Take me anyway. I know where the Hour starts.");
      await c.join("uhtred");
      c.flag("ch6.uhtredJoined");
      await c.narrate("(The gate to the Backward Hour is in the top left corner of the hall.)");
      return;
    }
    if (!c.get("ch6.loanTaken")) { await c.say("Uhtred-7", "Don't sign. Everyone signs. Don't."); return; }
    c.step(4);
    await c.say("Uhtred-7", "You signed. Of course. I am the seventh print of a soldier who died owing. The Bank prints me again every time I die, and adds the printing to the bill.");
    await c.say("Uhtred-7", "My skills do not cost Static. They cost teeth. Loan Strike hits like a wall and costs six. Collateral is a shield for four. Default is everything for ten and leaves you at one HP. Use them on the Lender. He hates it.");
    await c.give("tooth", 2);
  },
  "bank_vaults.enter": async (c) => {
    if (c.get("ch6.vaultsEntered")) return;
    c.flag("ch6.vaultsEntered");
    c.step(4);
    await c.narrate("The Vaults. Rows of boxes with names on them, and inside each box, teeth. The Tellers down here do not smile. They do not need to.");
  },
  "vault.ledger": async (c) => { await c.say("Ledger", "(A book of balances.) PELL. RIMWARD. OWES: ONE LAMP, ONE SEASON, ONE ANSWER. It is not a good balance."); },
  "bank_deep.enter": async (c) => {
    if (c.get("ch6.deepEntered")) return;
    c.flag("ch6.deepEntered");
    c.step(5);
    await c.narrate("The Deep Vault. One box. It has your name on it, in a hand you recognize as your own.");
  },
  "deep.lender": async (c) => {
    c.step(5);
    await c.say("The Lender", `Ah. Balance: ${c.state.debt} teeth. And you want to leave through my back door with it. Everything is owed, Pell. I am only the one who counts.`);
    await c.say("Pell", "Then stop counting.", "pell");
    await c.say("The Lender", "Compounding.");
    const r = await c.battle(["the_lender"], { boss: true, fleeable: false });
    if (r !== "win") return;
    c.flag("ch6.lenderBeaten");
    c.step(6);
    await c.narrate("The Lender comes apart into teeth, and the teeth into numbers, and the numbers into nothing, because nobody is counting them.");
    await c.narrate("The ledgers in the vault go blank. All of them. Somewhere upstairs a Customer starts crying with relief.");
    c.state.debt = 0;
    await c.say("Sister Vane", "Your balance is zero. Everyone's is. It was only ever a count.", "vane");
    await c.narrate("(Debt still accrues if you Borrow. The Bank is gone, but the counting is a habit the world has.)");
    await c.give("ledger_vest");
  },
  "deep.note": async (c) => {
    c.flag("ch6.hasNote");
    await c.give("bank_note");
    await c.narrate("A Bank Note. It says: PASSAGE, ONE PARTY, THE BACKWARD HOUR. Signed by nobody.");
    await c.narrate("(Uhtred-7 is in his cell in the lobby.)");
  },
  "bank.hourgate": async (c) => {
    if (!c.get("ch6.uhtredJoined")) { await c.narrate("A door with a clock face. The hands go backward. It wants a Bank Note and a debtor."); c.state.map.x = 2; c.game.overworld?.resetTrail(); return; }
    const i = await c.ask("The Backward Hour. Go?", ["Go", "Not yet"], "Pell");
    if (i !== 0) { c.state.map.x = 2; c.game.overworld?.resetTrail(); return; }
    c.step(8);
    await c.say("Uhtred-7", "In there, things that happened stop having happened. I died six times. I would like to go in and see if any of them come back.", "uhtred");
    await c.say("Pell", "We're going to the Crown. Whatever's in there is on the way.", "pell");
    await c.narrate("Chapter 6 ends. The door opens and the air coming out of it is yesterday's.");
    await c.endChapter();
  },
};

export const chapter6: ChapterDef = {
  n: 6,
  title: "Debt",
  journey: "Approach to the inmost cave",
  mechanic: "debt",
  maps: [lobby, vaults, deepVault],
  scripts,
  start: { map: "bank_lobby", x: 11, y: 15, dir: "up" },
  intro: scripts["ch6.intro"],
  circle: ["Marble and smiles", "No account, no passage", "Sign here", "Seven prints of one soldier", "A box with your name", "Nobody counting", "Uhtred's eighth life", "Yesterday's air"],
};
